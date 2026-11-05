/**
 * WHIDER · Cuentas de usuario (Firebase Authentication)
 *  - Registro con correo y contraseña, verificación del correo y recuperación de contraseña
 *  - Inicio de sesión con Google (ventana de Google en web; selector nativo de cuentas en Android)
 *  - Cierre de sesión y eliminación de la cuenta
 *
 * El SDK de Firebase se carga en segundo plano DESPUÉS de mostrar la app, así el arranque es inmediato.
 */
window.Whider = window.Whider || {};

(function (W) {
  'use strict';
  var CFG = window.WHIDER_CONFIG || {};
  var F = null, app = null, auth = null, db = null;
  var listeners = [], readyResolve, ready = new Promise(function (r) { readyResolve = r; });
  var loadPromise = null, initialized = false, nativeGoogle = null;
  var REDIRECT_FLAG = 'whider.googleRedirect';

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
    'auth/operation-not-allowed': 'Este método de acceso no está activado en Firebase.',
    'auth/unauthorized-domain': 'Este dominio no está autorizado en Firebase (Authentication → Configuración).',
    'auth/internal-error': 'Error del servidor de cuentas. Inténtalo de nuevo.',
    'whider/domain': 'Solo se admiten correos profesionales de: ',
    'whider/load': 'No se pudo cargar el sistema de cuentas. Comprueba tu conexión.',
    'whider/google-cancelled': 'Inicio de sesión con Google cancelado.',
    'whider/google-timeout': 'No se completó el acceso con Google en el navegador. Inténtalo de nuevo.',
    'whider/google-config': 'Google no reconoce esta app. En Firebase → Configuración del proyecto → Tus apps → Android, comprueba el paquete com.whider.app y la huella SHA-1 de la firma.',
    'whider/google-no-account': 'No hay ninguna cuenta de Google en este móvil. Añádela en Ajustes del teléfono → Cuentas.',
    'whider/google-unavailable': 'Google no está disponible ahora mismo en este dispositivo. Inténtalo de nuevo.',
    'whider/google-client': 'Falta el ID de cliente web de Google en js/config.js.'
  };

  function err(code, extra) { var e = new Error(code); e.code = code; e.extra = extra; return e; }
  function emit() { listeners.forEach(function (fn) { try { fn(Auth.user); } catch (e) { console.error(e); } }); }
  function isAndroid() { return !!(window.WhiderAndroid && typeof window.WhiderAndroid.googleSignIn === 'function'); }
  /** App de escritorio: Google se abre en el navegador del ordenador y devuelve aquí sus credenciales */
  function isDesktopApp() { return !!(window.WhiderDesktop && typeof window.WhiderDesktop.googleSignIn === 'function'); }

  /** Carga js/vendor/firebase.js bajo demanda (una sola vez) */
  function load() {
    if (loadPromise) return loadPromise;
    loadPromise = new Promise(function (resolve, reject) {
      if (window.WFB) { resolve(window.WFB); return; }
      var s = document.createElement('script');
      s.src = 'js/vendor/firebase.js';
      s.async = true;
      s.onload = function () { window.WFB ? resolve(window.WFB) : reject(err('whider/load')); };
      s.onerror = function () { loadPromise = null; reject(err('whider/load')); };
      document.head.appendChild(s);
    });
    return loadPromise;
  }

  function setup() {
    if (initialized) return;
    initialized = true;
    F = window.WFB;
    app = F.initializeApp(CFG.firebase);
    var opts = { persistence: [F.indexedDBLocalPersistence, F.browserLocalPersistence] };
    // En Android el acceso con Google es nativo: no hace falta el sistema de ventanas web
    // (que descarga un iframe de Google en cada arranque)
    if (!isAndroid() && !isDesktopApp()) opts.popupRedirectResolver = F.browserPopupRedirectResolver;
    auth = F.initializeAuth(app, opts);
    auth.languageCode = 'es';
    db = F.getFirestore(app);
    if (CFG.emulator) {
      F.connectAuthEmulator(auth, CFG.emulator.auth, { disableWarnings: true });
      F.connectFirestoreEmulator(db, CFG.emulator.firestoreHost, CFG.emulator.firestorePort);
    }
    var first = true;
    F.onAuthStateChanged(auth, function (u) {
      Auth.user = u;
      if (first) { first = false; readyResolve(u); }
      emit();
    });
    // Solo si el usuario inició un acceso con Google por redirección en la web
    var pending = false;
    try { pending = sessionStorage.getItem(REDIRECT_FLAG) === '1'; sessionStorage.removeItem(REDIRECT_FLAG); } catch (e) { pending = false; }
    if (pending && !isAndroid() && !isDesktopApp()) F.getRedirectResult(auth).catch(function () { /* sin resultado */ });
    setTimeout(function () { if (first) { first = false; readyResolve(Auth.user); } }, 8000);
  }

  /** Espera a que Firebase esté cargado y la sesión restaurada */
  function whenReady() {
    return load().then(function () { setup(); return ready; });
  }

  var Auth = {
    user: null,
    db: function () { return db; },
    sdk: function () { return F; },
    configured: function () { return !!(CFG.firebase && CFG.firebase.apiKey); },
    loaded: function () { return !!F; },
    ready: function () { return ready; },
    whenReady: whenReady,
    onChange: function (fn) { listeners.push(fn); },

    /** Arranca la carga en segundo plano (no bloquea la interfaz) */
    init: function () {
      if (!Auth.configured()) { readyResolve(null); return; }
      var go = function () {
        whenReady().catch(function (e) { console.warn('Firebase no disponible:', e && e.code); readyResolve(null); });
      };
      if (window.requestIdleCallback) requestIdleCallback(go, { timeout: 600 }); else setTimeout(go, 120);
    },

    /* ---------- Validación ---------- */
    validEmail: function (email) { return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email); },
    domainAllowed: function (email) {
      var list = CFG.allowedEmailDomains || [];
      if (!list.length) return true;
      var domain = (String(email).split('@')[1] || '').toLowerCase();
      return list.some(function (d) { d = d.toLowerCase(); return domain === d || domain.slice(-(d.length + 1)) === '.' + d; });
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
      return whenReady().then(function () {
        return F.createUserWithEmailAndPassword(auth, email, password);
      }).then(function (cred) {
        return F.updateProfile(cred.user, { displayName: name }).then(function () {
          return F.sendEmailVerification(cred.user).catch(function () { /* se puede reenviar después */ });
        }).then(function () { emit(); return cred.user; });
      });
    },
    login: function (email, password) {
      return whenReady().then(function () {
        return F.signInWithEmailAndPassword(auth, email.trim().toLowerCase(), password);
      }).then(function (c) { return c.user; });
    },
    google: function () {
      if (isAndroid()) {
        if (!CFG.googleWebClientId) return Promise.reject(err('whider/google-client'));
        // El selector de cuentas se abre a la vez que se termina de cargar Firebase
        var token = new Promise(function (resolve, reject) {
          nativeGoogle = { resolve: resolve, reject: reject };
          try { window.WhiderAndroid.googleSignIn(CFG.googleWebClientId); } catch (e) { nativeGoogle = null; reject(err('whider/google-unavailable')); }
        });
        return Promise.all([token, whenReady()]).then(function (r) {
          return F.signInWithCredential(auth, F.GoogleAuthProvider.credential(r[0]));
        }).then(function (c) { return c.user; });
      }
      if (isDesktopApp()) {
        // Se abre el navegador del ordenador (Google no permite entrar desde ventanas integradas)
        return Promise.all([window.WhiderDesktop.googleSignIn(), whenReady()]).then(function (r) {
          var res = r[0] || {};
          if (!res.ok) throw err(res.kind === 'cancelled' ? 'whider/google-cancelled' : res.kind === 'timeout' ? 'whider/google-timeout' : 'whider/google-unavailable', res.detail || '');
          return F.signInWithCredential(auth, F.GoogleAuthProvider.credential(res.idToken || null, res.accessToken || null));
        }).then(function (c) { return c.user; });
      }
      return whenReady().then(function () {
        var provider = new F.GoogleAuthProvider();
        provider.setCustomParameters({ prompt: 'select_account' });
        return F.signInWithPopup(auth, provider).then(function (c) { return c.user; }).catch(function (e) {
          if (e && (e.code === 'auth/popup-blocked' || e.code === 'auth/operation-not-supported-in-this-environment')) {
            try { sessionStorage.setItem(REDIRECT_FLAG, '1'); } catch (x) { /* sin almacenamiento */ }
            return F.signInWithRedirect(auth, provider);
          }
          throw e;
        });
      });
    },
    /**
     * La app Android devuelve aquí el token de Google, o el error con su detalle técnico.
     * kind: cancelled · config · no-account · unavailable · invalid · client
     */
    onNativeGoogle: function (idToken, kind, detail) {
      var p = nativeGoogle; nativeGoogle = null;
      if (!p) return;
      if (idToken) { p.resolve(idToken); return; }
      var code = kind === 'cancelled' ? 'whider/google-cancelled'
        : kind === 'config' ? 'whider/google-config'
        : kind === 'no-account' ? 'whider/google-no-account'
        : kind === 'client' ? 'whider/google-client'
        : 'whider/google-unavailable';
      p.reject(err(code, detail || ''));
    },
    resetPassword: function (email) {
      return whenReady().then(function () { return F.sendPasswordResetEmail(auth, email.trim().toLowerCase()); });
    },
    resendVerification: function () {
      return whenReady().then(function () { return Auth.user ? F.sendEmailVerification(Auth.user) : null; });
    },
    /** Comprueba si ya se verificó el correo (y renueva el token para que la nube lo reconozca) */
    refresh: function () {
      if (!Auth.user) return Promise.resolve(null);
      return F.reload(Auth.user).then(function () { return Auth.user.getIdToken(true); }).then(function () { emit(); return Auth.user; });
    },
    /** Mantiene el nombre de la cuenta igual que el del perfil de la app */
    updateName: function (name) {
      if (!Auth.user || !F || !name) return Promise.resolve();
      return F.updateProfile(Auth.user, { displayName: name }).catch(function () { /* sin conexión: se queda en el perfil */ });
    },
    logout: function () {
      if (isAndroid() && typeof window.WhiderAndroid.googleSignOut === 'function') {
        try { window.WhiderAndroid.googleSignOut(); } catch (e) { /* opcional */ }
      }
      return auth ? F.signOut(auth) : Promise.resolve();
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
