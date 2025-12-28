import {
    auth, collection, COLLECTIONS, createUserWithEmailAndPassword, db, DEFAULT_THEME_NAME, doc, getDoc,
    GithubAuthProvider, GoogleAuthProvider, sendPasswordResetEmail, setDoc, signInWithEmailAndPassword,
    signInWithPopup, signOut, updateDoc, updateProfile
} from './firebase-init.js';
import {showMessageBox} from './utils.js';
import {showMessageBox} from './utils.js';

// Generate colored avatar with initials
function generateProfilePic(displayName) {
    const colors = ['#2563eb', '#059669', '#dc2626', '#7c3aed', '#d97706', '#0891b2'];
    const hash = Array.from(displayName).reduce((acc, c) => acc + c.codePointAt(0), 0);
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 200;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = colors[Math.abs(hash) % colors.length];
    ctx.fillRect(0, 0, 200, 200);
    ctx.fillStyle = '#FFF';
    ctx.font = 'bold 80px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(displayName.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2), 100, 100);
    return canvas.toDataURL('image/png');
}

// Random name generator for OAuth
function generateRandomIdentity() {
    const adj = ['Happy', 'Lucky', 'Sunny', 'Clever', 'Swift', 'Bright', 'Cool', 'Smart'];
    const noun = ['Fox', 'Bear', 'Wolf', 'Eagle', 'Hawk', 'Tiger', 'Lion', 'Owl'];
    const a = adj[Math.floor(Math.random() * adj.length)];
    const n = noun[Math.floor(Math.random() * noun.length)];
    const num = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return {displayName: `${a} ${n}`, handle: `${a.toLowerCase()}${n}${num}`};
}

class AuthManager {
    currentUser = null;
    authStateListeners = new Set();
    isInitialized = false;
    #authToken = null;

    async init() {
        if (this.isInitialized) return;
        auth.onAuthStateChanged(async user => {
            this.currentUser = user;
            this.#authToken = user ? await user.getIdToken() : null;
            if (user) await this.loadUserProfile();
            this.authStateListeners.forEach(cb => cb(user));
        });
        this.isInitialized = true;
    }

    async loadUserProfile() {
        if (!this.currentUser) return null;
        try {
            const snap = await getDoc(doc(db, COLLECTIONS.USER_PROFILES, this.currentUser.uid));
            return snap.exists() ? snap.data() : null;
        } catch (e) {
            console.error('loadUserProfile:', e);
            return null;
        }
    }

    async createAccount(email, password, displayName, handle) {
        const {user} = await createUserWithEmailAndPassword(auth, email, password);
        const photoURL = generateProfilePic(displayName);
        await updateProfile(user, {displayName, photoURL});
        const profile = {
            uid: user.uid, displayName, email, photoURL, handle,
            createdAt: new Date(), lastLoginAt: new Date(),
            themePreference: DEFAULT_THEME_NAME, isAdmin: false
        };
        await setDoc(doc(db, COLLECTIONS.USER_PROFILES, user.uid), profile);
        return profile;
    }

    async #oauthSignIn(Provider, providerName) {
        const result = await signInWithPopup(auth, new Provider());
        if (result._tokenResponse?.isNewUser) {
            const {displayName: randName, handle} = generateRandomIdentity();
            const displayName = result.user.displayName || randName;
            const photoURL = result.user.photoURL || generateProfilePic(displayName);
            await setDoc(doc(collection(db, COLLECTIONS.USER_PROFILES), result.user.uid), {
                displayName, email: result.user.email || '', photoURL, handle,
                themePreference: DEFAULT_THEME_NAME, createdAt: new Date(),
                lastLoginAt: new Date(), provider: providerName
            });
        } else {
            await this.#updateLastLogin(result.user.uid);
        }
        return result.user;
    }

    signInWithGoogle() { return this.#oauthSignIn(GoogleAuthProvider, 'google'); }
    signInWithGithub() { return this.#oauthSignIn(GithubAuthProvider, 'github'); }

    async signInWithEmail(email, password) {
        const {user} = await signInWithEmailAndPassword(auth, email, password);
        await this.#updateLastLogin(user.uid);
        return user;
    }

    async resetPassword(email) { await sendPasswordResetEmail(auth, email); }

    async #updateLastLogin(uid) {
        await updateDoc(doc(db, COLLECTIONS.USER_PROFILES, uid), {lastLoginAt: new Date()});
    }

    onAuthStateChanged(cb) {
        this.authStateListeners.add(cb);
        if (this.currentUser !== undefined) cb(this.currentUser);
        return () => this.authStateListeners.delete(cb);
    }

    getCurrentUser() { return this.currentUser; }
    getAuthToken() { return this.#authToken; }
    isAuthenticated() { return !!this.currentUser; }

    async signOut() {
        try {
            await signOut(auth);
            this.#authToken = null;
            return true;
        } catch (e) {
            console.error('signOut:', e);
            return false;
        }
    }
}

export const authManager = new AuthManager();

// Convenience wrappers with user feedback
export async function signIn(email, password) {
    try { return (await signInWithEmailAndPassword(auth, email, password)).user; }
    catch (e) { showMessageBox(e.message, true); throw e; }
}

export async function signUp(email, password) {
    try { return (await createUserWithEmailAndPassword(auth, email, password)).user; }
    catch (e) { showMessageBox(e.message, true); throw e; }
}

export async function googleSignIn() {
    try { return (await signInWithPopup(auth, new GoogleAuthProvider())).user; }
    catch (e) { showMessageBox(e.message, true); throw e; }
}

export async function githubSignIn() {
    try { return (await signInWithPopup(auth, new GithubAuthProvider())).user; }
    catch (e) { showMessageBox(e.message, true); throw e; }
}

export async function signOutUser() {
    try { await signOut(auth); showMessageBox('Signed out successfully'); }
    catch (e) { showMessageBox(e.message, true); throw e; }
}

export async function resetPassword(email) {
    try { await sendPasswordResetEmail(auth, email); showMessageBox('Password reset email sent'); }
    catch (e) { showMessageBox(e.message, true); throw e; }
}

export async function updateUserProfile(displayName, photoURL) {
    const user = auth.currentUser;
    if (!user) throw new Error('No user signed in');
    try {
        await updateProfile(user, {displayName: displayName || user.displayName, photoURL: photoURL || user.photoURL});
        showMessageBox('Profile updated successfully');
    } catch (e) { showMessageBox(e.message, true); throw e; }
}