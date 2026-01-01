import { auth, db, COLLECTIONS, signInWithEmailAndPassword, signOut, createUserWithEmailAndPassword, updateProfile, doc, getDoc, setDoc, updateDoc, serverTimestamp, onAuthStateChanged, signInWithPopup, linkWithPopup, unlink, GoogleAuthProvider, GithubAuthProvider, TwitterAuthProvider, OAuthProvider } from './firebase-init.js';
import { generateProfilePic, randomIdentity } from './helpers.js';
import { updateUserSection } from './layout.js';

const DEFAULT_THEME_NAME = 'dark';
const ADMIN_UID = 'CEch8cXWemSDQnM3dHVKPt0RGpn2';

function cacheUser(user, profile) {
    localStorage.setItem('arcator_user_cache', JSON.stringify({
        uid: user.uid,
        displayName: profile?.displayName || user.displayName,
        photoURL: profile?.photoURL || user.photoURL,
        themePreference: profile?.themePreference || 'dark',
        fontScaling: profile?.fontScaling || 'normal'
    }));
}

function updateTheme(theme = 'dark', fontSize = 'normal', customCSS = '') {
    document.documentElement.setAttribute('data-bs-theme', theme);
    document.documentElement.setAttribute('data-font-size', fontSize);
    
    let style = document.getElementById('custom-css-style');
    if (!style) {
        style = document.createElement('style');
        style.id = 'custom-css-style';
        document.head.appendChild(style);
    }
    style.textContent = customCSS || '';
}

async function checkAdmin(uid) {
    if (uid === ADMIN_UID) return true;
    try {
        const snap = await getDoc(doc(db, 'artifacts', 'arcator-web', 'public', 'data', 'whitelisted_admins', uid));
        return snap.exists();
    } catch { return false; }
}

function registerStore() {
    Alpine.store('auth', {
        user: null,
        profile: null,
        loading: true,
        isAdmin: false,
        checkAdmin: checkAdmin,

        async init() {
            // Load from cache first for instant UI
            const cached = localStorage.getItem('arcator_user_cache');
            if (cached) {
                try {
                    const data = JSON.parse(cached);
                    this.user = { uid: data.uid, ...data };
                    this.profile = data;
                    updateTheme(data.themePreference, data.fontScaling, data.customCSS);
                    updateUserSection(this.user, this.profile);
                } catch (e) {}
            }

            // Listen for auth state
            onAuthStateChanged(auth, async (u) => {
                this.user = u;
                if (u) {
                    try {
                        const snap = await getDoc(doc(db, COLLECTIONS.USER_PROFILES, u.uid));
                        if (snap.exists()) {
                            this.profile = snap.data();
                            cacheUser(u, this.profile);
                            updateTheme(this.profile.themePreference, this.profile.fontScaling, this.profile.customCSS);
                            this.isAdmin = await checkAdmin(u.uid);
                        }
                    } catch (e) {
                        console.error('Profile load error:', e);
                    }
                } else {
                    this.profile = null;
                    this.isAdmin = false;
                    localStorage.removeItem('arcator_user_cache');
                }
                this.loading = false;
                updateUserSection(this.user, this.profile);
            });
        },

        async login(email, password) {
            try {
                console.log('Attempting login with:', email);
                const result = await signInWithEmailAndPassword(auth, email, password);
                console.log('Login successful:', result.user.uid);
                await updateDoc(doc(db, COLLECTIONS.USER_PROFILES, result.user.uid), { lastLoginAt: serverTimestamp() }).catch(() => {});
                return result.user;
            } catch (e) {
                console.error('Login error:', e.code, e.message);
                throw e;
            }
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
            updateUserSection(null, null);
        },

        async loginWithProvider(providerName) {
            let provider;
            switch (providerName) {
                case 'google': provider = new GoogleAuthProvider(); provider.setCustomParameters({ prompt: 'select_account' }); break;
                case 'github': provider = new GithubAuthProvider(); break;
                case 'twitter': provider = new TwitterAuthProvider(); break;
                case 'apple': provider = new OAuthProvider('apple.com'); break;
                case 'discord': provider = new OAuthProvider('oidc.oidc.discord'); break;
            }
            
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
        },

        async saveProfile(uid, profileData) {
            await updateDoc(doc(db, COLLECTIONS.USER_PROFILES, uid), profileData);
            this.profile = { ...this.profile, ...profileData };
            cacheUser(this.user, this.profile);
            updateTheme(this.profile.themePreference, this.profile.fontScaling, this.profile.customCSS);
            updateUserSection(this.user, this.profile);
        },

        getProvider(name) {
            switch (name) {
                case 'google': const g = new GoogleAuthProvider(); g.setCustomParameters({ prompt: 'select_account' }); return g;
                case 'github': return new GithubAuthProvider();
                case 'twitter': return new TwitterAuthProvider();
                case 'apple': return new OAuthProvider('apple.com');
                case 'discord': return new OAuthProvider('oidc.oidc.discord');
            }
        },

        async linkProvider(providerName) {
            const provider = this.getProvider(providerName);
            await linkWithPopup(auth.currentUser, provider);
            this.user = auth.currentUser;
        },

        async unlinkProvider(providerId) {
            await unlink(auth.currentUser, providerId);
            this.user = auth.currentUser;
        },

        isProviderLinked(providerId) {
            return this.user?.providerData?.some(p => p.providerId === providerId) || false;
        },

        checkAdmin,
        cacheUser,
        updateTheme
    });
}

if (window.Alpine) {
    registerStore();
} else {
    document.addEventListener('alpine:init', registerStore);
}
