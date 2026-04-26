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
  onSnapshot,
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

// Stores are created here
document.addEventListener('alpine:init', () => {
    const Alpine = globalThis.Alpine;
    if (!Alpine) return;

    Alpine.plugin(morph);
    Alpine.plugin(intersect);

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
      const bio = data.bio === undefined ? (this.profile?.bio || '') : data.bio;
      
      const meta = { 
        ...(this.profile || {}), 
        ...data, 
        bio: bio,
        updatedAt: new Date().toISOString() 
      };
      
      delete meta.id;
      delete meta.uid;
      delete meta.temp;
      delete meta.body;
      
      const cleanBio = bio.replaceAll(/<!--\s*ARCATOR_META:.*?-->/g, '').trim();

      await updateDoc(ref, {
        title: (meta.displayName || 'User').slice(0, 100),
        body: cleanBio || '...',
        temp: `<!-- ARCATOR_META:${JSON.stringify(meta)} -->`,
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
    const meta = {
      displayName: _pendingDisplayName || u.displayName || 'New User',
      handle: _pendingHandle || '',
      glassColor: '#000000',
      glassOpacity: 0.95,
      themePreference: 'dark'
    };

    tx.set(ref, {
      kind: 'profile',
      authorId: u.uid,
      title: (_pendingDisplayName || u.displayName || 'New User').slice(0, 100),
      body: '...',
      temp: `<!-- ARCATOR_META:${JSON.stringify(meta)} -->`,
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

onAuthStateChanged(auth, async (u) => {
  const store = Alpine.store('auth');
  if (!store) return;

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
  if (u) {
    store.phase = u.emailVerified ? 'verified' : 'unverified';
  } else {
    store.phase = 'signed-out';
  }
  store.loading = !!u; // Set loading true if we have a user and need to fetch profile
  if (u) {
    // Use cache for immediate feedback
    const cache = localStorage.getItem('arcator_user_cache');
    if (cache) {
        try {
            const parsed = JSON.parse(cache);
            if (parsed.uid === u.uid) {
                store.profile = parsed;
                updateTheme(parsed.themePreference, parsed.fontScaling, parsed.customCSS, parsed.backgroundImage, parsed.glassColor, parsed.glassOpacity, parsed.glassBlur);
            }
        } catch (e) { console.warn('Cache load error', e); }
    }

    // Admin sync
    const adminUnsub = onSnapshot(doc(db, 'admins', u.uid), (snap) => {
        store.admin = snap.exists() && snap.data().isAdmin === true;
    });

    // Subscribe to real-time updates
    const unsub = onSnapshot(doc(db, 'docs', `u_${u.uid}`), (snap) => {
        if (!snap.exists()) {
            ensureProfile(u);
            return;
        }
        const data = snap.data();
        let bodyData = {};
        let bio = (data.body || '').trim();
        const metaStr = (data.temp || bio || '').trim();
        const metaMatch = metaStr.match(/<!--\s*ARCATOR_META:\s*([\s\S]*?)\s*-->/);
        
        if (metaMatch) {
            try { 
                bodyData = JSON.parse(metaMatch[1]); 
                if (!data.temp) bio = bio.replace(metaMatch[0], '').trim(); 
            } catch(e) { console.error('Meta parse error', e); }
        } else {
            try { bodyData = JSON.parse(metaStr); bio = bodyData.bio || bio; } catch(e) { console.error('Body parse error', e); }
        }
        bodyData.bio = bio;

        if (!bodyData.glassColor || bodyData.glassColor.trim() === '') {
            bodyData.glassColor = '#000000';
        }

        const profile = { 
            displayName: data.title || '', 
            handle: data.handle || '', 
            photoURL: safePhoto(data.photoURL),
            ...data, 
            ...bodyData, 
            id: snap.id 
        };
        store.profile = profile;
        // Fallback admin check from profile if not in admins collection
        if (profile.admin) store.admin = true;
        
        store.loading = false;

        updateTheme(profile.themePreference, profile.fontScaling, profile.customCSS, profile.backgroundImage, profile.glassColor, profile.glassOpacity, profile.glassBlur);
        cacheUser(u, profile);
    });
    // Store unsubs in global for logout cleanup
    globalThis._authUnsubs = [adminUnsub, unsub];
  } else {
    store.profile = null;
    store.loading = false;
    if (globalThis._authUnsubs) {
        globalThis._authUnsubs.forEach(un => un());
        globalThis._authUnsubs = null;
    }
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
