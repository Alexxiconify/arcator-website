import {
    auth, db, COLLECTIONS, DEFAULT_PROFILE_PIC, DEFAULT_THEME_NAME,
    createUserWithEmailAndPassword, signInWithEmailAndPassword, signInWithPopup, linkWithPopup, unlink,
    signOut, updateProfile, GoogleAuthProvider, GithubAuthProvider,
    doc, getDoc, setDoc, updateDoc, serverTimestamp,
    OAuthProvider, TwitterAuthProvider, onIdTokenChanged
} from './firebase-init.js';

const ADMIN_UID = 'CEch8cXWemSDQnM3dHVKPt0RGpn2';

function generateProfilePic(name) {
    const colors = ['#2563eb', '#059669', '#dc2626', '#7c3aed', '#d97706', '#0891b2'];
    const hash = [...name].reduce((a, c) => a + c.codePointAt(0), 0);
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 200;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = colors[Math.abs(hash) % colors.length];
    ctx.fillRect(0, 0, 200, 200);
    ctx.fillStyle = '#FFF';
    ctx.font = 'bold 80px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2), 100, 100);
    return canvas.toDataURL('image/png');
}

function randomIdentity() {
    const adj = ['Happy', 'Lucky', 'Sunny', 'Clever', 'Swift', 'Bright', 'Cool', 'Smart'];
    const noun = ['Fox', 'Bear', 'Wolf', 'Eagle', 'Hawk', 'Tiger', 'Lion', 'Owl'];
    const a = adj[Math.floor(Math.random() * adj.length)];
    const n = noun[Math.floor(Math.random() * noun.length)];
    return { displayName: `${a} ${n}`, handle: `${a.toLowerCase()}${n}${Math.floor(Math.random() * 1000)}` };
}

const AuthService = {
    getCurrentUser: () => auth.currentUser,
    isAuthenticated: () => !!auth.currentUser,

    async getProfile(uid) {
        if (!uid) return null;
        try {
            const snap = await getDoc(doc(db, COLLECTIONS.USER_PROFILES, uid));
            return snap.exists() ? { uid, ...snap.data() } : null;
        } catch { return null; }
    },

    async getCurrentProfile() {
        return auth.currentUser ? await this.getProfile(auth.currentUser.uid) : null;
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

    async loginWithGoogle() { 
        const p = new GoogleAuthProvider();
        p.setCustomParameters({ prompt: 'select_account' });
        return this._oauth(p, 'google'); 
    },
    async loginWithGithub() { 
        const p = new GithubAuthProvider();
        return this._oauth(p, 'github'); 
    },
    async loginWithTwitter() { return this._oauth(new TwitterAuthProvider(), 'twitter'); },
    async loginWithApple() { return this._oauth(new OAuthProvider('apple.com'), 'apple'); },
    
    async loginWithDiscord() {
        try {
            return await this._oauth(new OAuthProvider('discord.com'), 'discord');
        } catch (e) {
            const discordClientId = '1455253162276683869';
            const redirectUri = encodeURIComponent(window.location.origin + '/discord-callback.html');
            const scope = encodeURIComponent('identify email');
            const state = Math.random().toString(36).substring(7);
            sessionStorage.setItem('discord_oauth_state', state);
            window.location.href = `https://discord.com/api/oauth2/authorize?client_id=${discordClientId}&redirect_uri=${redirectUri}&response_type=token&scope=${scope}&state=${state}`;
        }
    },

    async _oauth(provider, name) {
        try {
            const result = await signInWithPopup(auth, provider);
            if (result._tokenResponse?.isNewUser) {
                const { displayName: rn, handle } = randomIdentity();
                const displayName = result.user.displayName || rn;
                const photoURL = result.user.photoURL || generateProfilePic(displayName);
                await setDoc(doc(db, COLLECTIONS.USER_PROFILES, result.user.uid), { uid: result.user.uid, displayName, email: result.user.email || '', photoURL, handle, themePreference: DEFAULT_THEME_NAME, createdAt: serverTimestamp(), lastLoginAt: serverTimestamp(), provider: name });
            } else {
                await updateDoc(doc(db, COLLECTIONS.USER_PROFILES, result.user.uid), { lastLoginAt: serverTimestamp() }).catch(() => {});
            }
            return result.user;
        } catch (e) {
            console.error(`${name} login error:`, e);
            if (e.code === 'auth/operation-not-allowed') {
                throw new Error(`${name} login is not enabled in Firebase Console. Enable it under Authentication > Sign-in method.`);
            }
            if (e.code === 'auth/unauthorized-domain') {
                throw new Error(`This domain (${window.location.hostname}) is not authorized in Firebase Console. Add it under Authentication > Settings > Authorized domains.`);
            }
            throw e;
        }
    },

    async linkProvider(provider) {
        if (!auth.currentUser) throw new Error('Must be logged in to link accounts');
        
        // Force account selection for Google
        if (provider instanceof GoogleAuthProvider) {
            provider.setCustomParameters({ prompt: 'select_account' });
        }

        const result = await linkWithPopup(auth.currentUser, provider);
        
        // Force token refresh to update providerData in the UI
        await auth.currentUser.getIdToken(true);
        
        await updateDoc(doc(db, COLLECTIONS.USER_PROFILES, auth.currentUser.uid), { 
            lastUpdated: serverTimestamp() 
        }).catch(() => {});
        
        return result.user;
    },

    async unlinkProvider(providerId) {
        if (!auth.currentUser) throw new Error('Must be logged in to unlink accounts');
        const result = await unlink(auth.currentUser, providerId);
        await updateDoc(doc(db, COLLECTIONS.USER_PROFILES, auth.currentUser.uid), { 
            lastUpdated: serverTimestamp() 
        }).catch(() => {});
        return result;
    },

    async logout() { await signOut(auth); },

    async updateProfile(uid, data) {
        if (!uid) throw new Error('No user ID');
        await updateDoc(doc(db, COLLECTIONS.USER_PROFILES, uid), { ...data, lastUpdated: serverTimestamp() });
        if (auth.currentUser && (data.displayName || data.photoURL)) {
            await updateProfile(auth.currentUser, { displayName: data.displayName || auth.currentUser.displayName, photoURL: data.photoURL || auth.currentUser.photoURL });
        }
    },

    onAuthChange(callback) {
        return onIdTokenChanged(auth, async user => {
            const profile = user ? await this.getProfile(user.uid) : null;
            callback({ user, profile, providerData: user?.providerData || [] });
        });
    },

    ready: () => new Promise(r => { const u = auth.onAuthStateChanged(() => { u(); r(); }); }),

    async isAdmin(uid) {
        if (!uid) return false;
        if (uid === ADMIN_UID) return true;
        try {
            const snap = await getDoc(doc(db, 'artifacts', 'arcator-web', 'public', 'data', 'whitelisted_admins', uid));
            return snap.exists();
        } catch { return false; }
    },

    DEFAULT_PROFILE_PIC,
    DEFAULT_THEME_NAME
};

export default AuthService;
