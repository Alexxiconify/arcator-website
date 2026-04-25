import intersect from 'https://cdn.jsdelivr.net/npm/@alpinejs/intersect@3.x.x/+esm';
import morph from 'https://cdn.jsdelivr.net/npm/@alpinejs/morph@3.x.x/+esm';
import Alpine from 'https://cdn.jsdelivr.net/npm/alpinejs@3/dist/module.esm.js';
import { PROFILE_STUB_BODY } from './constants.js';
import {
  auth,
  createUserWithEmailAndPassword,
  db,
  doc,
  GithubAuthProvider,
  GoogleAuthProvider,
  onAuthStateChanged,
  runTransaction,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  srvTs,
  updateProfile,
} from './firebase.js';
import { safePhoto } from './sanitize.js';

window.Alpine = Alpine;

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
  store.phase = u ? (u.emailVerified ? 'verified' : 'unverified') : 'signed-out';

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
        bodyData = { bio: data.body };
      }
      store.profile = {
        ...data,
        ...bodyData,
        id: profileSnap.value.id
      };
    }
  }
});

//  Session-error handling

window.addEventListener('unhandledrejection', (e) => {
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
