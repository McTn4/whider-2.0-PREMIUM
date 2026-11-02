// Punto de entrada del paquete local de Firebase (se genera js/vendor/firebase.js).
// La app funciona sin conexión: el SDK se sirve desde la propia app, no desde un CDN.
// Se usa Firestore "lite" (sin caché propia ni escuchas en tiempo real): 3 veces más ligero.
export { initializeApp } from 'firebase/app';
export {
  initializeAuth, indexedDBLocalPersistence, browserLocalPersistence, browserPopupRedirectResolver,
  createUserWithEmailAndPassword, signInWithEmailAndPassword, sendEmailVerification, sendPasswordResetEmail,
  updateProfile, GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult, signInWithCredential,
  onAuthStateChanged, signOut, reload, deleteUser, connectAuthEmulator
} from 'firebase/auth';
export {
  getFirestore, doc, getDoc, setDoc, deleteDoc, runTransaction, connectFirestoreEmulator
} from 'firebase/firestore/lite';
