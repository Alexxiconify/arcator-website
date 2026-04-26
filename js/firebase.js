import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-app.js';
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager, serverTimestamp } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-firestore.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-auth.js';

const config = {
  apiKey: "AIzaSyAYzo2zbIZwq9PYZmsXI6_RTnzbNSEpzwQ",
  authDomain: "arcator-v2.firebaseapp.com",
  projectId: "arcator-v2",
  storageBucket: "arcator-v2.firebasestorage.app",
  messagingSenderId: "171774915460",
  appId: "1:171774915460:web:2fc364da8a1bd095eae3d1",
  measurementId: "G-W3QFECRHV6",
};

const app = initializeApp(config);
const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
  experimentalAutoDetectLongPolling: true,
});
const auth = getAuth(app);
const srvTs = serverTimestamp;
export const COLLECTIONS = {
    DOCS: 'docs', // Blogs (~b) and Forums (~f)
    USERS: 'users', // Profiles (u_...)
    PAGES: 'pages', // Standard pages (pg_...)
    WIKI: 'wiki', // Wiki entries (~w...)
    CONVERSATIONS: 'conversations', // Direct messages (cv_...)
    MESSAGES: 'messages', // Replies/comments
    ADMINS: 'admins',
    BANS: 'bans',
    GLOBAL: 'global',
};

// Re-exports
export { db, auth, srvTs };

export const profileDocId = uid => `u_${uid}`;
export const pageDocId = slug => `pg_${(slug || '').toLowerCase().replaceAll(/[^a-z0-9-]/g, '-') || crypto.randomUUID()}`;
export const wikiDocId = id => `~w${(id || '').toLowerCase().replaceAll(/[^a-z0-9-]/g, '-') || crypto.randomUUID()}`;
export const forumDocId = id => `~f${(id || '').toLowerCase().replaceAll(/[^a-z0-9-]/g, '-') || crypto.randomUUID()}`;

export const isWikiDocId = id => typeof id === 'string' && (id.startsWith('~w') || id.startsWith('wk_') || id.startsWith('wiki_'));
export const isForumDocId = id => typeof id === 'string' && (id.startsWith('~f') || id.startsWith('fr_') || id.startsWith('forum_'));
export const isPageDocId = id => typeof id === 'string' && (id.startsWith('pg_') || id.startsWith('~p'));
export const isProfileDocId = id => typeof id === 'string' && (id.startsWith('u_') || id.startsWith('~u'));

export const getCollectionRef = (id, kind = null) => {
    if (kind === 'message') return doc(db, COLLECTIONS.MESSAGES, id);
    if (kind === 'profile' || isProfileDocId(id)) return doc(db, COLLECTIONS.USERS, id);
    if (isWikiDocId(id)) return doc(db, COLLECTIONS.WIKI, id);
    if (isPageDocId(id)) return doc(db, COLLECTIONS.PAGES, id);
    if (id?.startsWith('cv_')) return doc(db, COLLECTIONS.CONVERSATIONS, id);
    return doc(db, COLLECTIONS.DOCS, id);
};

export {
  collection, doc, query, where, orderBy, limit, startAfter,
  getDoc, getDocs, setDoc, addDoc, updateDoc, deleteDoc,
  onSnapshot, runTransaction, writeBatch, serverTimestamp, deleteField,
  getCountFromServer, FieldPath
} from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-firestore.js';

export {
  onAuthStateChanged, signInWithPopup, signInWithEmailAndPassword,
  createUserWithEmailAndPassword, sendPasswordResetEmail, sendEmailVerification, updateProfile, signOut,
  linkWithPopup, unlink,
  GoogleAuthProvider, GithubAuthProvider
} from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-auth.js';
