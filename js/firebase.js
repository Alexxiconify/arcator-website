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

// Re-exports
export { db, auth, srvTs };

export {
  collection, doc, query, where, orderBy, limit, startAfter,
  getDoc, getDocs, setDoc, updateDoc, deleteDoc,
  onSnapshot, runTransaction, writeBatch, serverTimestamp, deleteField,
  getCountFromServer, FieldPath
} from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-firestore.js';

export {
  onAuthStateChanged, signInWithPopup, signInWithEmailAndPassword,
  createUserWithEmailAndPassword, sendPasswordResetEmail, sendEmailVerification, updateProfile, signOut,
  linkWithPopup, unlink,
  GoogleAuthProvider, GithubAuthProvider
} from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-auth.js';
