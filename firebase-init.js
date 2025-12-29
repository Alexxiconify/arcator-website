import {initializeApp} from 'https://www.gstatic.com/firebasejs/10.7.0/firebase-app.js';
import {createUserWithEmailAndPassword, getAuth, GithubAuthProvider, GoogleAuthProvider, OAuthProvider, TwitterAuthProvider, onAuthStateChanged, onIdTokenChanged, sendPasswordResetEmail, signInWithEmailAndPassword, signInWithPopup, linkWithPopup, unlink, signOut, updateProfile} from 'https://www.gstatic.com/firebasejs/10.7.0/firebase-auth.js';
import {addDoc, collection, deleteDoc, doc, getDoc, getDocs, increment, initializeFirestore, limit, onSnapshot, orderBy, query, serverTimestamp, setDoc, startAfter, updateDoc, where} from 'https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js';

const cfg = {apiKey: "AIzaSyCP5Zb1CRermAKn7p_S30E8qzCbvsMxhm4", authDomain: "arcator-web.firebaseapp.com", projectId: "arcator-web", storageBucket: "arcator-web.appspot.com", messagingSenderId: "919078249743", appId: "1:919078249743:web:050cc10de97b51f10b9830"};
const app = initializeApp(cfg);
export const auth = getAuth(app), db = initializeFirestore(app, {});
export const projectId = cfg.projectId, appId = cfg.appId;
export const DEFAULT_PROFILE_PIC = './defaultuser.png', DEFAULT_THEME_NAME = 'dark';

const art = `artifacts/${projectId}`;
export const COLLECTIONS = {
    USERS: 'user_profiles', 
    USER_PROFILES: 'user_profiles', 
    FORMS: `${art}/public/data/forms`,
    SUBMISSIONS: (formId) => `${art}/public/data/forms/${formId}/submissions`,
    CONVERSATIONS: 'conversations',
    CONV_MESSAGES: (convId) => `conversations/${convId}/messages`,
    THEMES: `${art}/public/data/custom_themes`,
    PAGES: `${art}/public/data/temp_pages`,
    ADMINS: `${art}/public/data/whitelisted_admins`
};

export const firebaseReadyPromise = new Promise(r => { const u = auth.onAuthStateChanged(() => { u(); r(true); }); });
export const getCurrentUser = () => auth.currentUser;

export {app, collection, doc, addDoc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, onSnapshot, query, where, orderBy, limit, startAfter, serverTimestamp, increment, onAuthStateChanged, onIdTokenChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signInWithPopup, linkWithPopup, unlink, GoogleAuthProvider, GithubAuthProvider, OAuthProvider, TwitterAuthProvider, signOut, updateProfile, sendPasswordResetEmail};