/**
 * WHIDER · Cuentas de usuario (Firebase Authentication)
 *  - Registro con correo y contraseña, verificación del correo y recuperación de contraseña
 *  - Inicio de sesión con Google (ventana de Google en web; selector nativo de cuentas en Android)
 *  - Cierre de sesión y eliminación de la cuenta
 */
window.Whider = window.Whider || {};

(function (W) {
  'use strict';
  var CFG = window.WHIDER_CONFIG || {};
  var F = window.WFB;
  var app = null, auth = null, db = null;
  var listeners = [], readyResolve, ready = new Promise(function (r) { readyResolve = r; });
  var nativeGoogle = null;

  var ERRORS = {
    'auth/email-already-in-use': 'Ya existe una cuenta con este correo. Inicia sesión.',
    'auth/invalid-email': 'El correo no es válido.',
    'auth/missing-email': 'Escribe tu correo.',
    'auth/weak-password': 'La contraseña es demasiado débil.',
    'auth/missing-password': 'Escribe tu contraseña.',
    'auth/wrong-password': 'Correo o contraseña incorrectos.',
    'auth/user-not-found': 'Correo o contraseña incorrectos.',
    'auth/invalid-credential': 'Correo o contraseña incorrectos.',
    'auth/invalid-login-credentials': 'Correo o contraseña incorrectos.',
    'auth/user-disabled': 'Esta cuenta está desactivada.',
    'auth/too-many-requests': 'Demasiados intentos. Espera unos minutos y vuelve a probar.',
    'auth/network-request-failed': 'Sin conexión. Comprueba tu internet e inténtalo de nuevo.',
    'auth/popup-closed-by-user': 'Has cerrado la ventana de Google.',
    'auth/cancelled-popup-request': 'Inicio de sesión cancelado.',
    'auth/popup-blocked': 'El navegador bloqueó la ventana de Google.',
    'auth/account-exists-with-different-credential': 'Este correo ya está registrado con otro método. Entra con correo y contraseña.',
    'auth/requires-recent-login': 'Por seguridad, vuelve a iniciar sesión y repite la acción.',
    'auth/operation-not-allowed': 'Este método de acceso no está activado en el proyecto de Firebase.',
    'auth/unauthorized-domain': 'Este dominio no está autorizado en Firebase (Authentication → Configuración).',
    'auth/internal-error': 'Error del servidor de cuentas. Inténtalo de nuevo.',
    'whider/domain': 'Solo se admiten correos profesionales de: ',
    'whider/google-cancelled': 'Inicio de sesión con Google cancelado.',
    'whider/google-unavailable': 'Google no está disponible en este dispositivo.',
    'whider/google-config': 'Falta el ID de cliente web de Google en js/config.js.'
  };

  function err(code, extra) { var e = new Error(code); e.code = code; e.extra = extra; return e; }
  function emit() { listeners.forEach(function (fn) { try { fn(Auth.user); } catch (e) { console.error(e); } }); }

  var Auth = {
    user: null,
    db: function () { return db; },
    configured: function () { return !!(CFG.firebase && CFG.firebase.apiKey && F); },
    ready: function () { return ready; },
    onChange: function (fn) { listeners.push(fn); },

    init: function () {
      if (!Auth.configured()) { readyResolve(null); return; }
      try {
        app = F.initializeApp(CFG.firebase);
        auth = F.initializeAuth(app, {
          persistence: [F.indexedDBLocalPersistence, F.browserLocalPersistence],
          popupRedirectResolver: F.browserPopupRedirectResolver
        });
        auth.languageCode = 'es';
        var cache;
        try { cache = F.persistentLocalCache({ tabManager: F.persistentSingleTabManager() }); } catch (e) { cache = F.memoryLocalCache(); }
        db = F.initializeFirestore(app, { localCache: cache });
        if (CFG.emulator) {
          F.connectAuthEmulator(auth, CFG.emulator.auth, { disableWarnings: true });
          F.connectFirestoreEmulator(db, CFG.emulator.firestoreHost, CFG.emulator.firestorePort);
        }
      } catch (e) {
        console.error('Firebase no se pudo iniciar', e);
        readyResolve(null);
        return;
      }
      var first = true;
      F.onAuthStateChanged(auth, function (u) {
        Auth.user = u;
        if (first) { first = false; readyResolve(u); }
        emit();
      });
      F.getRedirectResult(auth).catch(function () { /* sin redirección pendiente */ });
      // Sin conexión el SDK responde igualmente con la sesión guardada; esto es solo una red de seguridad
      setTimeout(function () { if (first) { first = false; readyResolve(Auth.user); } }, 6000);
    },

    /* ---------- Validación ---------- */
    validEmail: function (email) { return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email); },
    domainAllowed: function (email) {
      var list = CFG.allowedEmailDomains || [];
      if (!list.length) return true;
      var domain = String(email).split('@')[1] || '';
      return list.some(function (d) { d = d.toLowerCase(); domain = domain.toLowerCase(); return domain === d || domain.slice(-(d.length + 1)) === '.' + d; });
    },
    passwordScore: function (p) {
      var score = 0;
      if (p.length >= 8) score++;
      if (p.length >= 12) score++;
      if (/[a-z]/.test(p) && /[A-Z]/.test(p)) score++;
      if (/\d/.test(p)) score++;
      if (/[^A-Za-z0-9]/.test(p)) score++;
      return Math.min(4, score);
    },
    passwordProblem: function (p) {
      if (p.length < 8) return 'Usa al menos 8 caracteres.';
      if (!/[A-Za-z]/.test(p) || !/\d/.test(p)) return 'Combina letras y números.';
      return null;
    },

    /* ---------- Acciones ---------- */
    register: function (name, email, password) {
      email = email.trim().toLowerCase();
      if (!Auth.domainAllowed(email)) return Promise.reject(err('whider/domain', (CFG.allowedEmailDomains || []).join(', ')));
      return F.createUserWithEmailAndPassword(auth, email, password).then(function (cred) {
        return F.updateProfile(cred.user, { displayName: name }).then(function () {
          return F.sendEmailVerification(cred.user).catch(function () { /* se puede reenviar después */ });
        }).then(function () { emit(); return cred.user; });
      });
    },
    login: function (email, password) {
      return F.signInWithEmailAndPassword(auth, email.trim().toLowerCase(), password).then(function (c) { return c.user; });
    },
    google: function () {
      var bridge = window.WhiderAndroid;
      if (bridge && typeof bridge.googleSignIn === 'function') {
        if (!CFG.googleWebClientId) return Promise.reject(err('whider/google-config'));
        return new Promise(function (resolve, reject) {
          nativeGoogle = { resolve: resolve, reject: reject };
          try { bridge.googleSignIn(CFG.googleWebClientId); } catch (e) { nativeGoogle = null; reject(err('whider/google-unavailable')); }
        }).then(function (idToken) {
          return F.signInWithCredential(auth, F.GoogleAuthProvider.credential(idToken));
        }).then(function (c) { return c.user; });
      }
      var provider = new F.GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      return F.signInWithPopup(auth, provider).then(function (c) { return c.user; }).catch(function (e) {
        if (e && (e.code === 'auth/popup-blocked' || e.code === 'auth/operation-not-supported-in-this-environment')) {
          return F.signInWithRedirect(auth, provider);
        }
        throw e;
      });
    },
    /** La app Android devuelve aquí el token de Google (o el error) */
    onNativeGoogle: function (idToken, errorCode) {
      var p = nativeGoogle; nativeGoogle = null;
      if (!p) return;
      if (idToken) p.resolve(idToken);
      else p.reject(err(errorCode === 'cancelled' ? 'whider/google-cancelled' : 'whider/google-unavailable'));
    },
    resetPassword: function (email) { return F.sendPasswordResetEmail(auth, email.trim().toLowerCase()); },
    resendVerification: function () { return Auth.user ? F.sendEmailVerification(Auth.user) : Promise.resolve(); },
    /** Comprueba si ya se verificó el correo (y renueva el token para que la nube lo reconozca) */
    refresh: function () {
      if (!Auth.user) return Promise.resolve(null);
      return F.reload(Auth.user).then(function () { return Auth.user.getIdToken(true); }).then(function () { emit(); return Auth.user; });
    },
    logout: function () {
      var bridge = window.WhiderAndroid;
      if (bridge && typeof bridge.googleSignOut === 'function') { try { bridge.googleSignOut(); } catch (e) { /* opcional */ } }
      return F.signOut(auth);
    },
    deleteAccount: function () {
      var u = Auth.user;
      if (!u) return Promise.resolve();
      return (W.Sync ? W.Sync.deleteRemote() : Promise.resolve()).then(function () { return F.deleteUser(u); });
    },

    isVerified: function () {
      var u = Auth.user;
      if (!u) return false;
      return u.emailVerified || u.providerData.some(function (p) { return p.providerId === 'google.com'; });
    },
    provider: function () {
      var u = Auth.user;
      if (!u) return null;
      return u.providerData.some(function (p) { return p.providerId === 'google.com'; }) ? 'google' : 'password';
    },
    message: function (e) {
      var code = e && (e.code || e.message);
      var m = ERRORS[code];
      if (code === 'whider/domain') return m + (e.extra || '');
      return m || 'No se ha podido completar. ' + (code ? '(' + code + ')' : '');
    }
  };

  W.Auth = Auth;
})(window.Whider);
