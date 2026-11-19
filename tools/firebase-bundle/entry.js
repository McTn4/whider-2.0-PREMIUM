// Punto de entrada del paquete local de Firebase (se genera js/vendor/firebase.js).
// La app funciona sin conexión: el SDK se sirve desde la propia app, no desde un CDN.
// Leer una vez, escribir y las transacciones van con Firestore "lite": sin caché propia, así que sin conexión
// fallan enseguida (y la app lo explica) en vez de quedarse esperando.
// Desde la 7.0 incluye consultas (chats, buzón) y escrituras agrupadas.
// Desde la 1.1, Storage para los adjuntos (solo se usa si WHIDER_CONFIG.storage está activado; +7 KB comprimido).
// Desde la 1.2, el Firestore completo SOLO para escuchar en tiempo real (onSnapshot), con sus nombres terminados en
// «Live»: sus referencias no se mezclan con las de «lite». Va sin re2js (ver re2js-stub.js): −146 KB.
export { initializeApp } from 'firebase/app';
export {
  initializeAuth, indexedDBLocalPersistence, browserLocalPersistence, browserPopupRedirectResolver,
  createUserWithEmailAndPassword, signInWithEmailAndPassword, sendEmailVerification, sendPasswordResetEmail,
  updateProfile, GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult, signInWithCredential,
  onAuthStateChanged, signOut, reload, deleteUser, connectAuthEmulator
} from 'firebase/auth';
export {
  getFirestore, doc, getDoc, setDoc, deleteDoc, runTransaction, connectFirestoreEmulator,
  collection, query, where, orderBy, limit, getDocs, writeBatch, updateDoc, deleteField
} from 'firebase/firestore/lite';
export { getStorage, ref, uploadBytesResumable, getBytes, deleteObject, connectStorageEmulator } from 'firebase/storage';
export {
  getFirestore as getFirestoreLive, connectFirestoreEmulator as connectFirestoreEmulatorLive,
  doc as docLive, collection as collectionLive, query as queryLive, where as whereLive, orderBy as orderByLive,
  limit as limitLive, onSnapshot
} from 'firebase/firestore';
