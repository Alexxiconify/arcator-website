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
  updateProfile,
  writeBatch,
  profileDocId
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
      const id = profileDocId(uid);
      console.log(`[Auth] Saving profile to: docs/${id} and custom/${id}`, data);
      const ref = doc(db, 'docs', id);
      const cRef = doc(db, 'custom', id);
      const bio = data.bio === undefined ? (this.profile?.bio || '') : data.bio;
      
      const meta = { 
        ...this.profile, 
        ...data, 
        bio: bio,
        updatedAt: new Date().toISOString() 
      };
      
      delete meta.id;
      delete meta.uid;
      delete meta.temp;
      delete meta.body;
      
      const cleanBio = String(bio || '').replaceAll(/<!--\s*ARCATOR_META:.*?-->/g, '').trim();

      const batch = writeBatch(db);
      batch.update(ref, {
        title: (meta.displayName || 'User').slice(0, 100),
        body: cleanBio || '...',
        updatedAt: srvTs()
      });
      batch.set(cRef, meta);
      await batch.commit();
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
  const id = profileDocId(u.uid);
  const ref = doc(db, 'docs', id);
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
    tx.set(doc(db, 'custom', profileDocId(u.uid)), meta);
  });
}

//  Live auth state

// Merges legacy ARCATOR_META HTML-comment metadata with customData
function mergeLegacyMeta(data, customData, bio) {
  let bodyData = customData || {};
  const src = typeof data.temp === 'string' ? data.temp : bio;
  const metaMatch = src.match(/<!--\s*ARCATOR_META:\s*([\s\S]*?)\s*-->/);
  if (!metaMatch) return { bodyData, bio };
  try {
    const parsed = JSON.parse(metaMatch[1]);
    bodyData = Object.keys(bodyData).length > 0 ? { ...parsed, ...bodyData } : parsed;
    if (src === bio) bio = bio.replace(metaMatch[0], '').trim();
  } catch(e) { console.error('Meta parse error', e); }
  return { bodyData, bio };
}

async function syncUserSession(u) {
    const store = Alpine.store('auth');
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
    const adminUnsub = onSnapshot(doc(db, COLLECTIONS.ADMINS, u.uid), (snap) => {
        store.admin = snap.exists() ? snap.data().isAdmin === true : false;
    });

    // Subscribe to real-time updates
    let docData = null;
    let customData = null;
    const sync = () => {
        if (docData) {
            const data = docData;
            let bio = (customData?.bio !== undefined) ? customData.bio : (data.body || '').trim();
            const merged = mergeLegacyMeta(data, customData, bio);
            const bodyData = merged.bodyData;
            bio = merged.bio;
            bodyData.bio = bio;
            bodyData.glassColor = bodyData.glassColor?.trim() || '#000000';

            const profile = {
                displayName: data.title || '',
                handle: data.handle || '',
                photoURL: safePhoto(data.photoURL),
                ...data,
                ...bodyData,
                id: profileDocId(u.uid)
            };
            store.profile = profile;
            if (profile.admin) store.admin = true;
            store.loading = false;
            updateTheme(profile.themePreference, profile.fontScaling, profile.customCSS, profile.backgroundImage, profile.glassColor, profile.glassOpacity, profile.glassBlur);
            cacheUser(u, profile);
        }
    };

    const unsub = onSnapshot(doc(db, COLLECTIONS.USERS, profileDocId(u.uid)), (snap) => {
        console.log(`[Auth] Profile snapshot update for: ${snap.id} (exists: ${snap.exists()})`);
        if (!snap.exists()) { ensureProfile(u); return; }
        docData = snap.data();
        sync();
    });
    const customUnsub = onSnapshot(doc(db, 'custom', profileDocId(u.uid)), (snap) => {
        customData = snap.exists() ? snap.data() : null;
        sync();
    });
    // Store unsubs in global for logout cleanup
    globalThis._authUnsubs = [adminUnsub, unsub, customUnsub];
}

onAuthStateChanged(auth, async (u) => {
  const store = Alpine.store('auth');
  if (!store) return;

  store.admin = false;
  store.user = u ? { uid: u.uid, displayName: u.displayName, photoURL: u.photoURL, email: u.email, emailVerified: u.emailVerified } : null;
  store.loading = !!u;

  if (u) {
    store.phase = u.emailVerified ? 'verified' : 'unverified';
    syncUserSession(u);
  } else {
    store.phase = 'signed-out';
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
