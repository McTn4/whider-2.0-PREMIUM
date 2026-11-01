// Punto de entrada del paquete local de Firebase (se genera js/vendor/firebase.js).
// La app funciona sin conexión: el SDK se sirve desde la propia app, no desde un CDN.
export { initializeApp } from 'firebase/app';
export {
  initializeAuth, indexedDBLocalPersistence, browserLocalPersistence, browserPopupRedirectResolver,
  createUserWithEmailAndPassword, signInWithEmailAndPassword, sendEmailVerification, sendPasswordResetEmail,
  updateProfile, GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult, signInWithCredential,
  onAuthStateChanged, signOut, reload, deleteUser, connectAuthEmulator
} from 'firebase/auth';
export {
  initializeFirestore, persistentLocalCache, persistentSingleTabManager, memoryLocalCache,
  doc, getDoc, setDoc, deleteDoc, onSnapshot, connectFirestoreEmulator
} from 'firebase/firestore';
