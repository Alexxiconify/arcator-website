<<<<<<< HEAD
import {initializeApp} from 'https://www.gstatic.com/firebasejs/10.7.0/firebase-app.js';
import {
    createUserWithEmailAndPassword,
    getAuth,
    GithubAuthProvider,
    GoogleAuthProvider,
    onAuthStateChanged,
    signInWithEmailAndPassword,
    signInWithPopup,
    signOut,
    updateProfile
} from 'https://www.gstatic.com/firebasejs/10.7.0/firebase-auth.js';
import {
    addDoc,
    collection,
    deleteDoc,
    doc,
    getDoc,
    getDocs,
    initializeFirestore,
    limit,
    onSnapshot,
    orderBy,
    query,
    serverTimestamp,
    setDoc,
    startAfter,
    updateDoc,
    where
} from 'https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js';

const firebaseConfig = {
    apiKey: "AIzaSyCP5Zb1CRermAKn7p_S30E8qzCbvsMxhm4",
    authDomain: "arcator-web.firebaseapp.com",
    projectId: "arcator-web",
    storageBucket: "arcator-web.appspot.com",
    messagingSenderId: "919078249743",
    appId: "1:919078249743:web:050cc10de97b51f10b9830"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = initializeFirestore(app, {});

export const DEFAULT_PROFILE_PIC = './defaultuser.png';
export const DEFAULT_THEME_NAME = 'dark';
export const appId = firebaseConfig.appId;
export const projectId = firebaseConfig.projectId;
export const COLLECTIONS = {
    // Users/documents for profiles stored at top-level user_profiles
    USERS: 'user_profiles',

    DMS: 'conversations',
    MESSAGES: 'messages',

    // User profiles stored at top-level `user_profiles` in legacy DBs
    USER_PROFILES: 'user_profiles',

    // Custom themes in legacy location
    THEMES: `artifacts/${projectId}/public/data/custom_themes`,

    // Pages stored under temp_pages in legacy export
    PAGES: `artifacts/${projectId}/public/data/temp_pages`,

    // Forms kept in artifacts path (fallback)
    FORMS: 'forms',
    SUBMISSIONS: 'submissions',
    ADMIN: `artifacts/${projectId}/public/data/admin`,
};

export const firebaseReadyPromise = new Promise((resolve) => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
        unsubscribe();
        resolve(true);
    });
});

export async function getUserProfileFromFirestore(uid) {
    if (!uid) return null;
    try {
        const userRef = doc(db, COLLECTIONS.USER_PROFILES, uid);
        const userDoc = await getDoc(userRef);
        return userDoc.exists() ? userDoc.data() : null;
    } catch (error) {
        console.error('Error getting user profile:', error);
        return null;
    }
}

export async function setUserProfileInFirestore(uid, data) {
    if (!uid) return false;
    try {
        const userRef = doc(db, COLLECTIONS.USER_PROFILES, uid);
        await setDoc(userRef, {
            ...data,
            lastUpdated: serverTimestamp()
        }, {merge: true});
        return true;
    } catch (error) {
        console.error('Error setting user profile:', error);
        return false;
    }
}

export async function getUserDMs(userId) {
    if (!userId) return [];
    try {
        const dmsRef = collection(db, COLLECTIONS.DMS);
        // Query conversations where user is a participant
        const q = query(dmsRef, where('participants', 'array-contains', userId));
        const dmsSnap = await getDocs(q);
        return dmsSnap.docs.map(doc => ({id: doc.id, ...doc.data()}));
    } catch (error) {
        console.error('Error getting user DMs:', error);
        return [];
    }
}

export async function getDMMessages(dmId, limitCount = 50) {
    if (!dmId) return [];
    try {
        const messagesRef = collection(db, COLLECTIONS.DMS, dmId, COLLECTIONS.MESSAGES);
        const q = query(messagesRef, orderBy('createdAt', 'desc'), limit(limitCount));
        const messagesSnap = await getDocs(q);
        return messagesSnap.docs.map(doc => ({id: doc.id, ...doc.data()}));
    } catch (error) {
        console.error('Error getting DM messages:', error);
        return [];
    }
}

export {
    app,
    auth,
    db,
    collection,
    doc,
    addDoc,
    getDoc,
    getDocs,
    setDoc,
    updateDoc,
    deleteDoc,
    onSnapshot,
    query,
    where,
    orderBy,
    limit,
    startAfter,
    serverTimestamp,
    onAuthStateChanged,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signInWithPopup,
    GoogleAuthProvider,
    GithubAuthProvider,
    signOut,
    updateProfile
};

export function getCurrentUser() {
    return auth.currentUser;
=======
import {initializeApp} from 'https://www.gstatic.com/firebasejs/10.7.0/firebase-app.js';
import {
    createUserWithEmailAndPassword,
    getAuth,
    GithubAuthProvider,
    GoogleAuthProvider,
    onAuthStateChanged,
    signInWithEmailAndPassword,
    signInWithPopup,
    signOut,
    updateProfile
} from 'https://www.gstatic.com/firebasejs/10.7.0/firebase-auth.js';
import {
    addDoc,
    collection,
    deleteDoc,
    doc,
    getDoc,
    getDocs,
    initializeFirestore,
    limit,
    onSnapshot,
    orderBy,
    query,
    serverTimestamp,
    setDoc,
    startAfter,
    updateDoc,
    where
} from 'https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js';

const firebaseConfig = {
    apiKey: "AIzaSyCP5Zb1CRermAKn7p_S30E8qzCbvsMxhm4",
    authDomain: "arcator-web.firebaseapp.com",
    projectId: "arcator-web",
    storageBucket: "arcator-web.appspot.com",
    messagingSenderId: "919078249743",
    appId: "1:919078249743:web:050cc10de97b51f10b9830"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = initializeFirestore(app, {});

export const DEFAULT_PROFILE_PIC = './defaultuser.png';
export const DEFAULT_THEME_NAME = 'dark';
export const appId = firebaseConfig.appId;
export const projectId = firebaseConfig.projectId;
export const COLLECTIONS = {
    // Users/documents for profiles stored at top-level user_profiles
    USERS: 'user_profiles',

    // DMs: use projectId for artifact path to match legacy storage (/artifacts/<projectId>/users/<uid>/dms)
    DMS: (userId) => `artifacts/${projectId}/users/${userId}/dms`,
    MESSAGES: (userId, dmId) => `artifacts/${projectId}/users/${userId}/dms/${dmId}/messages`,

    // User profiles stored at top-level `user_profiles` in legacy DBs
    USER_PROFILES: 'user_profiles',

    // Custom themes in legacy location
    THEMES: `artifacts/${projectId}/public/data/custom_themes`,

    // Pages stored under temp_pages in legacy export
    PAGES: `artifacts/${projectId}/public/data/temp_pages`,

    // Forms kept in artifacts path (fallback)
    FORMS: 'forms',
    SUBMISSIONS: 'submissions',
    ADMIN: `artifacts/${projectId}/public/data/admin`,
};

export const firebaseReadyPromise = new Promise((resolve) => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
        unsubscribe();
        resolve(true);
    });
});

export async function getUserProfileFromFirestore(uid) {
    if (!uid) return null;
    try {
        const userRef = doc(db, COLLECTIONS.USER_PROFILES, uid);
        const userDoc = await getDoc(userRef);
        return userDoc.exists() ? userDoc.data() : null;
    } catch (error) {
        console.error('Error getting user profile:', error);
        return null;
    }
}

export async function setUserProfileInFirestore(uid, data) {
    if (!uid) return false;
    try {
        const userRef = doc(db, COLLECTIONS.USER_PROFILES, uid);
        await setDoc(userRef, {
            ...data,
            lastUpdated: serverTimestamp()
        }, {merge: true});
        return true;
    } catch (error) {
        console.error('Error setting user profile:', error);
        return false;
    }
}

export async function getUserDMs(userId) {
    if (!userId) return [];
    try {
        const dmsRef = collection(db, COLLECTIONS.DMS);
        // Query conversations where user is a participant
        const q = query(dmsRef, where('participants', 'array-contains', userId));
        const dmsSnap = await getDocs(q);
        return dmsSnap.docs.map(doc => ({id: doc.id, ...doc.data()}));
    } catch (error) {
        console.error('Error getting user DMs:', error);
        return [];
    }
}

export async function getDMMessages(dmId, limitCount = 50) {
    if (!dmId) return [];
    try {
        const messagesRef = collection(db, COLLECTIONS.MESSAGES(userId, dmId));
        const q = query(messagesRef, orderBy('createdAt', 'desc'), (limit));
        const messagesSnap = await getDocs(q);
        return messagesSnap.docs.map(doc => ({id: doc.id, ...doc.data()}));
    } catch (error) {
        console.error('Error getting DM messages:', error);
        return [];
    }
}

export {
    app,
    auth,
    db,
    collection,
    doc,
    addDoc,
    getDoc,
    getDocs,
    setDoc,
    updateDoc,
    deleteDoc,
    onSnapshot,
    query,
    where,
    orderBy,
    limit,
    startAfter,
    serverTimestamp,
    onAuthStateChanged,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signInWithPopup,
    GoogleAuthProvider,
    GithubAuthProvider,
    signOut,
    updateProfile
};

export function getCurrentUser() {
    return auth.currentUser;
>>>>>>> 45bdfcda71152709c7beaa1a0cffd06a95a5cec7
}