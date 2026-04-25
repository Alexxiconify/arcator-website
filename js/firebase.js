import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-app.js';
import {
  initializeFirestore, persistentLocalCache, persistentMultipleTabManager,
  collection, doc, query, where, orderBy, limit, startAfter,
  getDoc, getDocs, setDoc, updateDoc, deleteDoc,
  onSnapshot, runTransaction, writeBatch, serverTimestamp, deleteField,
  getCountFromServer, FieldPath,
} from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-firestore.js';
import { getAuth, onAuthStateChanged, signInWithPopup, signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail, sendEmailVerification, updateProfile, signOut, GoogleAuthProvider, GithubAuthProvider } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-auth.js';

const app = initializeApp({
  apiKey: "AIzaSyAYzo2zbIZwq9PYZmsXI6_RTnzbNSEpzwQ",
  authDomain: "arcator-v2.firebaseapp.com",
  projectId: "arcator-v2",
  storageBucket: "arcator-v2.firebasestorage.app",
  messagingSenderId: "171774915460",
  appId: "1:171774915460:web:2fc364da8a1bd095eae3d1",
  measurementId: "G-W3QFECRHV6",
});

const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
  experimentalAutoDetectLongPolling: true,
});
const auth = getAuth(app);
const srvTs = serverTimestamp;

export {
  db, auth, srvTs, deleteField,
  collection, doc, query, where, orderBy, limit, startAfter,
  getDoc, getDocs, setDoc, updateDoc, deleteDoc,
  onSnapshot, runTransaction, writeBatch, getCountFromServer, FieldPath,
  onAuthStateChanged, signInWithPopup, signInWithEmailAndPassword,
  createUserWithEmailAndPassword, sendPasswordResetEmail, sendEmailVerification, updateProfile, signOut,
  GoogleAuthProvider, GithubAuthProvider,
};
