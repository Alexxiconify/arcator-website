import {
    createUserWithEmailAndPassword,
    GithubAuthProvider,
    GoogleAuthProvider,
    sendPasswordResetEmail,
    signInWithEmailAndPassword,
    signInWithPopup,
    signOut,
    updateProfile
} from 'https://www.gstatic.com/firebasejs/10.7.0/firebase-auth.js';
import {
    collection,
    doc,
    getDoc,
    setDoc,
    updateDoc
} from 'https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js';

import {auth, COLLECTIONS, db, DEFAULT_THEME_NAME} from './firebase-init.js';
import {showMessageBox} from './utils.js';


function generateColoredProfilePic(displayName) {
    const colors = [
        '#2563eb', // Blue
        '#059669', // Green
        '#dc2626', // Red
        '#7c3aed', // Purple
        '#d97706', // Orange
        '#0891b2', // Cyan
    ];


    const color = colors[Math.abs(Array.from(displayName).reduce((acc, char) => acc + char.codePointAt(0), 0)) % colors.length];


    const canvas = document.createElement('canvas');
    canvas.width = 200;
    canvas.height = 200;
    const ctx = canvas.getContext('2d');


    ctx.fillStyle = color;
    ctx.fillRect(0, 0, 200, 200);


    const initials = displayName
        .split(' ')
        .map(word => word[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);

    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 80px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(initials, 100, 100);

    return canvas.toDataURL('image/png');
}

function generateRandomNameAndHandle() {
    const adjectives = ['Happy', 'Lucky', 'Sunny', 'Clever', 'Swift', 'Bright', 'Cool', 'Smart'];
    const nouns = ['Fox', 'Bear', 'Wolf', 'Eagle', 'Hawk', 'Tiger', 'Lion', 'Owl'];
    const numbers = () => Math.floor(Math.random() * 1000).toString().padStart(3, '0');

    const randomAdjective = adjectives[Math.floor(Math.random() * adjectives.length)];
    const randomNoun = nouns[Math.floor(Math.random() * nouns.length)];
    const randomNum = numbers();

    return {
        displayName: `${randomAdjective} ${randomNoun}`,
        handle: `${randomAdjective.toLowerCase()}${randomNoun}${randomNum}`
    };
}

class AuthManager {
    currentUser = null;
    authStateListeners = new Set();
    __initial_auth_token = null;
    isInitialized = false;



    async init() {
        if (this.isInitialized) return;

        auth.onAuthStateChanged(async (user) => {
            this.currentUser = user;
            if (user) {
                this.__initial_auth_token = await user.getIdToken();
                await this.loadUserProfile();
            } else {
                this.__initial_auth_token = null;
            }
            this.notifyListeners();
        });

        this.isInitialized = true;
    }

    async loadUserProfile() {
        if (!this.currentUser) return null;

        try {
            const userRef = doc(db, COLLECTIONS.USER_PROFILES, this.currentUser.uid);
            const docSnap = await getDoc(userRef);
            return docSnap.exists() ? docSnap.data() : null;
        } catch (error) {
            console.error('Error loading user profile:', error);
            return null;
        }
    }

    async createAccount(email, password, displayName, handle) {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;


        const profilePicUrl = generateColoredProfilePic(displayName);


        await updateProfile(user, {
            displayName,
            photoURL: profilePicUrl
        });


        const userProfile = {
            uid: user.uid,
            displayName,
            email,
            photoURL: profilePicUrl,
            handle,
            createdAt: new Date(),
            lastLoginAt: new Date(),
            themePreference: DEFAULT_THEME_NAME,
            isAdmin: false
        };

        const userRef = doc(db, COLLECTIONS.USER_PROFILES, user.uid);
        await setDoc(userRef, userProfile);
        return userProfile;
    }

    async signInWithEmailAndPassword(email, password) {
        const userCredential = await auth.signInWithEmailAndPassword(email, password);
        await this.updateLastLogin(userCredential.user.uid);
        return userCredential.user;
    }

    async signInWithGoogle() {
        const provider = new GoogleAuthProvider();
        const result = await signInWithPopup(auth, provider);

        if (result._tokenResponse?.isNewUser) {
            const randomData = generateRandomNameAndHandle();
            const displayName = result.user.displayName || randomData.displayName;
            const handle = randomData.handle;
            const profilePicUrl = result.user.photoURL || generateColoredProfilePic(displayName);

            const userProfile = {
                displayName,
                email: result.user.email || "",
                photoURL: profilePicUrl,
                handle,
                themePreference: DEFAULT_THEME_NAME,
                createdAt: new Date(),
                lastLoginAt: new Date(),
                provider: "google"
            };

            const profilesRef = collection(db, COLLECTIONS.USER_PROFILES);
            await setDoc(doc(profilesRef, result.user.uid), userProfile);
        } else {
            await this.updateLastLogin(result.user.uid);
        }

        return result.user;
    }

    async signInWithGithub() {
        const provider = new GithubAuthProvider();
        const result = await signInWithPopup(auth, provider);

        if (result._tokenResponse?.isNewUser) {
            const randomData = generateRandomNameAndHandle();
            const displayName = result.user.displayName || randomData.displayName;
            const handle = randomData.handle;
            const profilePicUrl = result.user.photoURL || generateColoredProfilePic(displayName);

            const userProfile = {
                displayName,
                email: result.user.email || "",
                photoURL: profilePicUrl,
                handle,
                themePreference: DEFAULT_THEME_NAME,
                createdAt: new Date(),
                lastLoginAt: new Date(),
                provider: "github"
            };

            const profilesRef = collection(db, COLLECTIONS.USER_PROFILES);
            await setDoc(doc(profilesRef, result.user.uid), userProfile);
        } else {
            await this.updateLastLogin(result.user.uid);
        }

        return result.user;
    }

    async resetPassword(email) {
        await sendPasswordResetEmail(auth, email);
    }

    async updateLastLogin(uid) {
        const userRef = doc(db, COLLECTIONS.USER_PROFILES, uid);
        await updateDoc(userRef, {
            lastLoginAt: new Date()
        });
    }

    onAuthStateChanged(callback) {
        this.authStateListeners.add(callback);
        if (this.currentUser !== undefined) {
            callback(this.currentUser);
        }
        return () => this.authStateListeners.delete(callback);
    }

    notifyListeners() {
        this.authStateListeners.forEach(callback => callback(this.currentUser));
    }

    getCurrentUser() {
        return this.currentUser;
    }

    getAuthToken() {
        return this.__initial_auth_token;
    }

    isAuthenticated() {
        return !!this.currentUser;
    }

    async signOut() {
        try {
            await signOut(auth);
            this.__initial_auth_token = null;

            return true;
        } catch (error) {
            console.error('Error signing out:', error);
            return false;
        }
    }
}

export const authManager = new AuthManager();


export async function signIn(email, password) {
    try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        return userCredential.user;
    } catch (error) {
        console.error('Sign in error:', error);
        showMessageBox(error.message, true);
        throw error;
    }
}

export async function signUp(email, password) {
    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        return userCredential.user;
    } catch (error) {
        console.error('Sign up error:', error);
        showMessageBox(error.message, true);
        throw error;
    }
}

export async function googleSignIn() {
    try {
        const provider = new GoogleAuthProvider();
        const result = await signInWithPopup(auth, provider);
        return result.user;
    } catch (error) {
        console.error('Google sign in error:', error);
        showMessageBox(error.message, true);
        throw error;
    }
}

export async function githubSignIn() {
    try {
        const provider = new GithubAuthProvider();
        const result = await signInWithPopup(auth, provider);
        return result.user;
    } catch (error) {
        console.error('GitHub sign in error:', error);
        showMessageBox(error.message, true);
        throw error;
    }
}

export async function signOutUser() {
    try {
        await signOut(auth);

        showMessageBox('Signed out successfully');
    } catch (error) {
        console.error('Sign out error:', error);
        showMessageBox(error.message, true);
        throw error;
    }
}

export async function resetPassword(email) {
    try {
        await sendPasswordResetEmail(auth, email);
        showMessageBox('Password reset email sent');
    } catch (error) {
        console.error('Password reset error:', error);
        showMessageBox(error.message, true);
        throw error;
    }
}

export async function updateUserProfile(displayName, photoURL) {
    try {
        const user = auth.currentUser;
        if (!user) throw new Error('No user signed in');

        await updateProfile(user, {
            displayName: displayName || user.displayName,
            photoURL: photoURL || user.photoURL
        });

        showMessageBox('Profile updated successfully');
    } catch (error) {
        console.error('Profile update error:', error);
        showMessageBox(error.message, true);
        throw error;
    }
}