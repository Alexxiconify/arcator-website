import intersect from 'https://cdn.jsdelivr.net/npm/@alpinejs/intersect@3.x.x/+esm';
import morph from 'https://cdn.jsdelivr.net/npm/@alpinejs/morph@3.x.x/+esm';
import {
  auth,
  createUserWithEmailAndPassword,
  db,
  doc,
  GithubAuthProvider,
  GoogleAuthProvider,
  linkWithPopup,
  onAuthStateChanged,
  runTransaction,
  sendEmailVerification,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  srvTs,
  unlink,
  updateDoc,
  updateProfile,
} from './firebase.js';
import { cacheUser, updateTheme } from './ui.js';
import { safePhoto } from './sanitize.js';

const { Alpine } = globalThis;

Alpine.plugin(morph);
Alpine.plugin(intersect);

// Stores are created here; Alpine.start() is called inside onAuthStateChanged
// so that all other modules' alpine:init listeners register first (they run
// synchronously at module scope).
document.addEventListener('alpine:init', () => {
  Alpine.store('profiles', {});
  Alpine.store('auth', {
    phase: 'pending', // 'pending' | 'signed-out' | 'unverified' | 'verified'
    admin: false,
    user: null,
    emailSend: 'idle', // 'idle' | 'sending' | 'sent' | { error: string }
    sessionError: null,

    get ready() {
      return this.phase !== 'pending';
    },
    get canWrite() {
      return this.phase === 'verified';
    },
    get isAdmin() {
      return this.admin === true;
    },

    signInGoogle: () => signInWithPopup(auth, new GoogleAuthProvider()),
    signInGitHub: () => signInWithPopup(auth, new GithubAuthProvider()),
    signInEmail: (email, pw) => signInWithEmailAndPassword(auth, email, pw),

    // Legacy method aliases
    login: (email, pw) => signInWithEmailAndPassword(auth, email, pw),
    signup: async (email, pw, name, handle) => {
      let cred;
      try {
        _pendingDisplayName = name;
        _pendingHandle = handle;
        cred = await createUserWithEmailAndPassword(auth, email, pw);
        await updateProfile(cred.user, { displayName: name });
        _pendingDisplayName = null;
        _pendingHandle = null;
        const u = Alpine.store('auth').user;
        if (u) {
          u.displayName = name;
        }
      } catch (e) {
        _pendingDisplayName = null;
        _pendingHandle = null;
        if (cred) {
          await cred.user.delete().catch(() => {});
        }
        throw e;
      }
    },
    logout: () => signOut(auth),
    
    // Linked accounts logic
    getProvider(name) {
      switch (name) {
        case 'google': return new GoogleAuthProvider();
        case 'github': return new GithubAuthProvider();
        default: throw new Error(`Unknown provider: ${name}`);
      }
    },
    async linkProvider(name) {
      const p = this.getProvider(name);
      return await linkWithPopup(auth.currentUser, p);
    },
    async unlinkProvider(id) {
      return await unlink(auth.currentUser, id);
    },
    isProviderLinked(id) {
      return auth.currentUser?.providerData?.some(p => p.providerId === id) || false;
    },

    // Profile management
    async saveProfile(uid, data) {
      const ref = doc(db, 'docs', `u_${uid}`);
      const body = JSON.stringify({
        ...JSON.parse(this.profile?.body || '{}'),
        ...data,
        updatedAt: new Date().toISOString()
      });
      await updateDoc(ref, {
        title: (data.displayName || this.user?.displayName || 'User').slice(0, 100),
        body: body,
        updatedAt: srvTs()
      });
    },

    resendEmailVerification: async () => {
      const u = auth.currentUser;
      if (u && !u.emailVerified) {
        const store = Alpine.store('auth');
        store.emailSend = 'sending';
        try {
          await sendEmailVerification(u);
          store.emailSend = 'sent';
        } catch (e) {
          store.emailSend = { error: `Could not send verification email: ${e.message}` };
        }
      }
    }
  });
});

//  Profile bootstrap

// Set by signUpEmail before createUserWithEmailAndPassword fires onAuthStateChanged,
// so ensureProfile sees the name the user typed rather than the still-null displayName.
let _pendingDisplayName = null;
let _pendingHandle = null;

async function ensureProfile(u) {
  const ref = doc(db, 'docs', `u_${u.uid}`);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (snap.exists()) {
      return;
    }
    const initialBody = JSON.stringify({
      displayName: _pendingDisplayName || u.displayName || 'New User',
      handle: _pendingHandle || '',
      glassColor: '#000000',
      glassOpacity: 0.95,
      themePreference: 'dark'
    });
    tx.set(ref, {
      kind: 'profile',
      authorId: u.uid,
      title: (_pendingDisplayName || u.displayName || 'New User').slice(0, 100),
      body: initialBody,
      photoURL: safePhoto(u.photoURL),
      allowReplies: true,
      allowPublicEdits: false,
      pinned: false,
      featured: false,
      spoiler: false,
      reactions: {},
      createdAt: srvTs(),
      updatedAt: srvTs(),
      lastReplyAt: srvTs(),
    });
  });
}

//  Live auth state 

let _alpineStarted = false;

onAuthStateChanged(auth, async (u) => {
  // First fire starts Alpine (by this point all module-level alpine:init
  // listeners have been registered synchronously).
  if (!_alpineStarted) {
    _alpineStarted = true;
    Alpine.start();
  }

  const store = Alpine.store('auth');

  // user and phase are safe to set synchronously — emailVerified is current
  // in the user object delivered by onAuthStateChanged.
  store.admin = false;
  store.user = u
    ? {
        uid: u.uid,
        displayName: u.displayName,
        photoURL: u.photoURL,
        email: u.email,
        emailVerified: u.emailVerified,
      }
    : null;
  if (!u) {
    store.phase = 'signed-out';
  } else {
    store.phase = u.emailVerified ? 'verified' : 'unverified';
  }
  store.loading = !!u; // Set loading true if we have a user and need to fetch profile

  if (u) {
    const [claimsResult, profileSnap] = await Promise.allSettled([
      u.getIdTokenResult(true),
      ensureProfile(u).then(() => getDoc(doc(db, 'docs', `u_${u.uid}`)))
    ]);
    
    if (claimsResult.status === 'fulfilled') {
      store.admin = claimsResult.value.claims.admin === true;
    }
    
    if (profileSnap.status === 'fulfilled' && profileSnap.value.exists()) {
      const data = profileSnap.value.data();
      let bodyData = {};
      try {
        bodyData = JSON.parse(data.body);
      } catch (e) {
        console.warn('Profile parse error, using fallbacks:', e);
        bodyData = { bio: data.body };
      }
      const profile = {
        ...data,
        ...bodyData,
        id: profileSnap.value.id
      };
      store.profile = profile;
      
      // Apply theme and cache
      updateTheme(
        profile.themePreference, 
        profile.fontScaling, 
        profile.customCSS, 
        profile.backgroundImage, 
        profile.glassColor, 
        profile.glassOpacity, 
        profile.glassBlur
      );
      cacheUser(u, profile);
    }
    store.loading = false;
  } else {
      store.profile = null;
      store.loading = false;
  }
});

//  Session-error handling

globalThis.addEventListener('unhandledrejection', (e) => {
  const code = e.reason?.code;
  if (['auth/user-token-expired', 'auth/id-token-revoked', 'auth/user-disabled'].includes(code)) {
    const store = Alpine.store('auth');
    if (store) {
      store.sessionError = 'Your session has ended — please sign in again.';
    }
    signOut(auth).catch(() => {});
    e.preventDefault();
  }
});
