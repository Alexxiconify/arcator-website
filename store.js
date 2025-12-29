import { auth, db, COLLECTIONS, signInWithEmailAndPassword, signOut, createUserWithEmailAndPassword, updateProfile, doc, getDoc, setDoc, updateDoc, serverTimestamp, onAuthStateChanged, signInWithPopup, GoogleAuthProvider, GithubAuthProvider, TwitterAuthProvider, OAuthProvider, linkWithPopup, unlink } from './firebase-init.js';
import { generateProfilePic, randomIdentity } from './utils.js';

const DEFAULT_THEME_NAME = 'dark';
const ADMIN_UID = 'CEch8cXWemSDQnM3dHVKPt0RGpn2';

document.addEventListener('alpine:init', () => {
    Alpine.store('auth', {
        user: null,
        profile: null,
        loading: true,
        isAdmin: false,

        async init() {
            // Load from cache first
            const cached = localStorage.getItem('arcator_user_cache');
            if (cached) {
                const data = JSON.parse(cached);
                this.user = { uid: data.uid, ...data }; // Mock user object
                this.profile = data;
                this.updateTheme(data.themePreference, data.fontScaling);
            }

            onAuthStateChanged(auth, async (u) => {
                this.user = u;
                if (u) {
                    const snap = await getDoc(doc(db, COLLECTIONS.USER_PROFILES, u.uid));
                    if (snap.exists()) {
                        this.profile = snap.data();
                        this.cacheUser(u, this.profile);
                        this.updateTheme(this.profile.themePreference, this.profile.fontScaling);
                        this.isAdmin = await this.checkAdmin(u.uid);
                    }
                } else {
                    this.profile = null;
                    this.isAdmin = false;
                    localStorage.removeItem('arcator_user_cache');
                }
                this.loading = false;
            });
        },

        cacheUser(user, profile) {
            localStorage.setItem('arcator_user_cache', JSON.stringify({
                uid: user.uid,
                displayName: profile.displayName || user.displayName,
                photoURL: profile.photoURL || user.photoURL,
                themePreference: profile.themePreference || 'dark',
                fontScaling: profile.fontScaling || 'normal'
            }));
        },

        updateTheme(theme = 'dark', fontSize = 'normal') {
            document.documentElement.setAttribute('data-bs-theme', theme);
            document.documentElement.setAttribute('data-font-size', fontSize);
        },

        async checkAdmin(uid) {
            if (uid === ADMIN_UID) return true;
            try {
                const snap = await getDoc(doc(db, 'artifacts', 'arcator-web', 'public', 'data', 'whitelisted_admins', uid));
                return snap.exists();
            } catch { return false; }
        },

        async login(email, password) {
            const { user } = await signInWithEmailAndPassword(auth, email, password);
            await updateDoc(doc(db, COLLECTIONS.USER_PROFILES, user.uid), { lastLoginAt: serverTimestamp() }).catch(() => {});
            return user;
        },

        async signup(email, password, displayName, handle) {
            const { user } = await createUserWithEmailAndPassword(auth, email, password);
            const photoURL = generateProfilePic(displayName);
            await updateProfile(user, { displayName, photoURL });
            const profile = { uid: user.uid, displayName, email, photoURL, handle, createdAt: serverTimestamp(), lastLoginAt: serverTimestamp(), themePreference: DEFAULT_THEME_NAME, isAdmin: false };
            await setDoc(doc(db, COLLECTIONS.USER_PROFILES, user.uid), profile);
            return { user, profile };
        },

        async logout() {
            await signOut(auth);
            this.user = null;
            this.profile = null;
            localStorage.removeItem('arcator_user_cache');
        },

        async loginWithProvider(providerName) {
            let provider;
            switch (providerName) {
                case 'google': provider = new GoogleAuthProvider(); provider.setCustomParameters({ prompt: 'select_account' }); break;
                case 'github': provider = new GithubAuthProvider(); break;
                case 'twitter': provider = new TwitterAuthProvider(); break;
                case 'apple': provider = new OAuthProvider('apple.com'); break;
                case 'discord': provider = new OAuthProvider('discord.com'); break;
            }
            
            try {
                const result = await signInWithPopup(auth, provider);
                if (result._tokenResponse?.isNewUser) {
                    const { displayName: rn, handle } = randomIdentity();
                    const displayName = result.user.displayName || rn;
                    const photoURL = result.user.photoURL || generateProfilePic(displayName);
                    await setDoc(doc(db, COLLECTIONS.USER_PROFILES, result.user.uid), { 
                        uid: result.user.uid, displayName, email: result.user.email || '', photoURL, handle, 
                        themePreference: DEFAULT_THEME_NAME, createdAt: serverTimestamp(), lastLoginAt: serverTimestamp(), provider: providerName 
                    });
                } else {
                    await updateDoc(doc(db, COLLECTIONS.USER_PROFILES, result.user.uid), { lastLoginAt: serverTimestamp() }).catch(() => {});
                }
                return result.user;
            } catch (e) {
                console.error(e);
                throw e;
            }
        }
    });
});
