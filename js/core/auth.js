/**
 * WHIDER · Cuentas de usuario (Firebase Authentication)
 *  - Desde la 2.1 se entra solo con Google, Microsoft o Apple:
 *    · Web: la ventana de cada uno (o una redirección si el navegador la bloquea).
 *    · Android: Google con el selector nativo de cuentas; Microsoft y Apple, en el navegador (página entrar/ de la web),
 *      que vuelve a la app con la sesión (onBrowserLink → adopt).
 *    · Ordenador: los tres en el navegador del sistema (desktop/lib/acceso.js); Google devuelve su credencial y
 *      Microsoft y Apple, la sesión (adopt).
 *  - Las cuentas con correo y contraseña de antes siguen entrando (y recuperan la contraseña); ya no se crean nuevas.
 *  - Cierre de sesión y eliminación de la cuenta
 *
 * El SDK de Firebase se carga en segundo plano DESPUÉS de mostrar la app, así el arranque es inmediato.
 */
window.Whider = window.Whider || {};

(function (W) {
  'use strict';
  var CFG = window.WHIDER_CONFIG || {};
  var F = null, app = null, auth = null, db = null, storage = null, liveDb = null;
  var listeners = [], readyResolve, ready = new Promise(function (r) { readyResolve = r; });
  var loadPromise = null, initialized = false, nativeGoogle = null, browserWait = null;
  var REDIRECT_FLAG = 'whider.googleRedirect';
  // Acceso en el navegador del sistema (Android): el código que vuelve con la sesión, para no aceptar otra
  var BROWSER_STATE = 'whider.authState';
  /** Con qué se puede entrar (más el correo y la contraseña de las cuentas que ya existían) */
  var PROVIDERS = { 'google.com': 'Google', 'microsoft.com': 'Microsoft', 'apple.com': 'Apple' };

  var ERRORS = {
    'auth/email-already-in-use': W.t('Ya existe una cuenta con este correo. Inicia sesión.'),
    'auth/invalid-email': W.t('El correo no es válido.'),
    'auth/missing-email': W.t('Escribe tu correo.'),
    'auth/weak-password': W.t('La contraseña es demasiado débil.'),
    'auth/missing-password': W.t('Escribe tu contraseña.'),
    'auth/wrong-password': W.t('Correo o contraseña incorrectos.'),
    'auth/user-not-found': W.t('Correo o contraseña incorrectos.'),
    'auth/invalid-credential': W.t('Correo o contraseña incorrectos.'),
    'auth/invalid-login-credentials': W.t('Correo o contraseña incorrectos.'),
    'auth/user-disabled': W.t('Esta cuenta está desactivada.'),
    'auth/too-many-requests': W.t('Demasiados intentos. Espera unos minutos y vuelve a probar.'),
    'auth/network-request-failed': W.t('Sin conexión. Comprueba tu internet e inténtalo de nuevo.'),
    'auth/popup-closed-by-user': W.t('Has cerrado la ventana de inicio de sesión.'),
    'auth/cancelled-popup-request': W.t('Inicio de sesión cancelado.'),
    'auth/popup-blocked': W.t('El navegador bloqueó la ventana de inicio de sesión.'),
    'auth/account-exists-with-different-credential': W.t('Ya tienes una cuenta de WHIDER con ese correo. Entra con el método que usaste la primera vez (por ejemplo, Google).'),
    'auth/requires-recent-login': W.t('Por seguridad, vuelve a iniciar sesión y repite la acción.'),
    'auth/operation-not-allowed': W.t('Este método de acceso no está activado en Firebase.'),
    'auth/unauthorized-domain': W.t('Este dominio no está autorizado en Firebase (Authentication → Configuración).'),
    'auth/internal-error': W.t('Error del servidor de cuentas. Inténtalo de nuevo.'),
    'whider/load': W.t('No se pudo cargar el sistema de cuentas. Comprueba tu conexión.'),
    'whider/google-cancelled': W.t('Inicio de sesión con Google cancelado.'),
    'whider/google-timeout': W.t('No se completó el acceso con Google en el navegador. Inténtalo de nuevo.'),
    'whider/google-config': W.t('Google no reconoce esta app. En Firebase → Configuración del proyecto → Tus apps → Android, comprueba el paquete com.whider.app y la huella SHA-1 de la firma.'),
    'whider/google-no-account': W.t('No hay ninguna cuenta de Google en este móvil. Añádela en Ajustes del teléfono → Cuentas.'),
    'whider/google-unavailable': W.t('Google no está disponible ahora mismo en este dispositivo. Inténtalo de nuevo.'),
    'whider/google-client': W.t('Falta el ID de cliente web de Google en js/config.js.'),
    'whider/browser-cancelled': W.t('Inicio de sesión cancelado.'),
    'whider/browser-timeout': W.t('No se completó el acceso en el navegador. Inténtalo de nuevo.'),
    'whider/browser-unavailable': W.t('No se pudo abrir el acceso en el navegador. Inténtalo de nuevo.'),
    'whider/browser-invalid': W.t('El acceso que llegó del navegador no es válido. Vuelve a intentarlo desde WHIDER.')
  };

  function err(code, extra) { var e = new Error(code); e.code = code; e.extra = extra; return e; }
  function emit() { listeners.forEach(function (fn) { try { fn(Auth.user); } catch (e) { console.error(e); } }); }
  function isAndroid() { return !!(window.WhiderAndroid && typeof window.WhiderAndroid.googleSignIn === 'function'); }
  /** App de escritorio: Google se abre en el navegador del ordenador y devuelve aquí sus credenciales */
  function isDesktopApp() { return !!(window.WhiderDesktop && typeof window.WhiderDesktop.googleSignIn === 'function'); }
  /** Proveedor de Firebase para Microsoft o Apple (o Google), con lo que pedimos a cada uno */
  function oauthProvider(id) {
    var p = id === 'google.com' ? new F.GoogleAuthProvider() : new F.OAuthProvider(id);
    if (id === 'google.com' || id === 'microsoft.com') p.setCustomParameters({ prompt: 'select_account' });
    if (id === 'apple.com') {
      p.addScope('email');
      p.addScope('name');
      p.setCustomParameters({ locale: W.I18n && W.I18n.lang === 'en' ? 'en_US' : 'es_ES' });
    }
    return p;
  }
  function randomState() {
    var a = new Uint8Array(24);
    (window.crypto || {}).getRandomValues ? window.crypto.getRandomValues(a) : a.forEach(function (x, i) { a[i] = Math.floor(Math.random() * 256); });
    return Array.prototype.map.call(a, function (b) { return ('0' + b.toString(16)).slice(-2); }).join('');
  }
  /** Lo que se guardó al empezar un acceso en el navegador del móvil ({ s, at }), o null */
  function readBrowserState() {
    try { return JSON.parse(localStorage.getItem(BROWSER_STATE) || 'null'); } catch (e) { return null; }
  }
  /** La sesión que trae la vuelta a la app (base64url de JSON), o null */
  function decodeSession(b64url) {
    try {
      var b64 = b64url.replace(/-/g, '+').replace(/_/g, '/');
      var bin = atob(b64 + '==='.slice((b64.length + 3) % 4));
      return JSON.parse(new TextDecoder().decode(Uint8Array.from(bin, function (c) { return c.charCodeAt(0); })));
    } catch (e) { return null; }
  }
  /** La sesión que se abrió en el navegador del sistema, tal como Firebase la guarda (solo lo necesario) */
  function cleanSession(o) {
    if (!o || typeof o !== 'object' || typeof o.uid !== 'string' || !o.uid || !o.stsTokenManager || typeof o.stsTokenManager.refreshToken !== 'string') return null;
    var str = function (v) { return typeof v === 'string' ? v : undefined; };
    var t = o.stsTokenManager;
    return {
      uid: o.uid, email: str(o.email), emailVerified: o.emailVerified === true, isAnonymous: false,
      displayName: str(o.displayName), photoURL: str(o.photoURL),
      providerData: Array.isArray(o.providerData) ? o.providerData.filter(function (x) { return x && typeof x.providerId === 'string'; }).slice(0, 5) : [],
      stsTokenManager: { refreshToken: t.refreshToken, accessToken: str(t.accessToken), expirationTime: typeof t.expirationTime === 'number' ? t.expirationTime : undefined },
      createdAt: str(o.createdAt), lastLoginAt: str(o.lastLoginAt),
      apiKey: CFG.firebase && CFG.firebase.apiKey, appName: '[DEFAULT]'
    };
  }

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
    var pending;
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
    /** Firebase Storage para los adjuntos: solo con WHIDER_CONFIG.storage y un storageBucket (si no, null) */
    storage: function () {
      if (storage) return storage;
      if (!app || !F || !F.getStorage || !CFG.storage || !(CFG.firebase && CFG.firebase.storageBucket)) return null;
      storage = F.getStorage(app);
      if (CFG.emulator && CFG.emulator.storagePort) F.connectStorageEmulator(storage, CFG.emulator.storageHost || '127.0.0.1', CFG.emulator.storagePort);
      return storage;
    },
    /**
     * Firestore completo, solo para escuchar en tiempo real (W.Live). Leer una vez, escribir y las transacciones
     * siguen con «lite» (Auth.db()). null si no hay sesión de Firebase, si el paquete no lo trae o si
     * WHIDER_CONFIG.live es false: entonces cada módulo consulta la nube cada cierto tiempo, como antes.
     */
    liveDb: function () {
      if (liveDb) return liveDb;
      if (!app || !F || !F.getFirestoreLive || !F.onSnapshot || CFG.live === false) return null;
      liveDb = F.getFirestoreLive(app);
      if (CFG.emulator) F.connectFirestoreEmulatorLive(liveDb, CFG.emulator.firestoreHost, CFG.emulator.firestorePort);
      return liveDb;
    },
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

    /* ---------- Acciones ---------- */
    /** Solo las cuentas con correo y contraseña de antes de la 2.1 (ya no se crean nuevas) */
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
     * Microsoft o Apple. En la web, la ventana de Firebase (o una redirección si el navegador la bloquea).
     * En el ordenador y en Android se entra en el navegador del sistema (como con Google en el ordenador): Firebase
     * no abre sus ventanas desde la app, y Microsoft no deja pasar su credencial de una app a otra.
     */
    oauth: function (id) {
      if (!PROVIDERS[id]) return Promise.reject(err('auth/operation-not-allowed'));
      if (id === 'google.com') return Auth.google();
      if (isDesktopApp() && typeof window.WhiderDesktop.browserSignIn === 'function') {
        return Promise.all([window.WhiderDesktop.browserSignIn(id), whenReady()]).then(function (r) {
          var res = r[0] || {};
          if (!res.ok) throw err(res.kind === 'cancelled' ? 'whider/browser-cancelled' : res.kind === 'timeout' ? 'whider/browser-timeout' : 'whider/browser-unavailable', res.detail || '');
          return Auth.adopt(res.user);
        });
      }
      if (window.WhiderAndroid) return whenReady().then(function () { return Auth.browserSignIn(id); });
      return whenReady().then(function () {
        var provider = oauthProvider(id);
        return F.signInWithPopup(auth, provider).then(function (c) { return c.user; }).catch(function (e) {
          if (e && (e.code === 'auth/popup-blocked' || e.code === 'auth/operation-not-supported-in-this-environment')) {
            try { sessionStorage.setItem(REDIRECT_FLAG, '1'); } catch (x) { /* sin almacenamiento */ }
            return F.signInWithRedirect(auth, provider);
          }
          throw e;
        });
      });
    },
    microsoft: function () { return Auth.oauth('microsoft.com'); },
    apple: function () { return Auth.oauth('apple.com'); },
    /**
     * Android: abre la página de acceso de la web en el navegador del móvil. Al terminar, la página vuelve a la app
     * con whider://auth?s=…&u=… (ver onBrowserLink). El código «s» se guarda aquí para no aceptar otra sesión.
     */
    browserSignIn: function (id) {
      var state = randomState();
      try { localStorage.setItem(BROWSER_STATE, JSON.stringify({ s: state, at: Date.now() })); } catch (e) { return Promise.reject(err('whider/browser-unavailable')); }
      var base = String((CFG.links && CFG.links.base) || location.origin).replace(/\/+$/, '');
      W.U.openExternal(base + '/entrar/?p=' + encodeURIComponent(id) + '&s=' + state + '&to=android' + (W.I18n && W.I18n.lang === 'en' ? '&lang=en' : ''));
      // Si la app se cierra mientras tanto, la vuelta se acepta igual (el código está guardado). Si vuelves a la app sin
      // terminar en el navegador, el botón deja de esperar; la vuelta, si llega después, también vale.
      return new Promise(function (resolve, reject) {
        var wait = { resolve: resolve, reject: reject }, hidden = false;
        browserWait = wait;
        var onVis = function () {
          if (document.visibilityState === 'hidden') { hidden = true; return; }
          if (!hidden) return;
          document.removeEventListener('visibilitychange', onVis);
          setTimeout(function () { if (browserWait === wait) { browserWait = null; reject(err('whider/browser-cancelled')); } }, 2500);
        };
        document.addEventListener('visibilitychange', onVis);
      });
    },
    /** «Cancelar» mientras se entra en el navegador (Android) */
    cancelBrowserSignIn: function () {
      var wait = browserWait; browserWait = null;
      if (wait) wait.reject(err('whider/browser-cancelled'));
    },
    /** Vuelve de la página de acceso (Android): whider://auth?s=CÓDIGO&u=SESIÓN (base64url de JSON) */
    onBrowserLink: function (url) {
      var wait = browserWait; browserWait = null;
      var fail = function (code) { var e = err(code); if (wait) wait.reject(e); else if (W.Toast) W.Toast.show({ text: Auth.message(e), type: 'danger' }); };
      var saved = readBrowserState();
      // Sin un acceso empezado desde aquí (o la misma vuelta repetida, ya con la sesión dentro): no se hace nada
      if (!saved && !wait) return Promise.resolve(false);
      // Un solo intento por acceso: si no vale, hay que volver a empezar desde la app
      try { localStorage.removeItem(BROWSER_STATE); } catch (e) { /* sin almacenamiento */ }
      var m = /[?&]s=([0-9a-f]{16,64})(?:&|$)/.exec(url), u = /[?&]u=([A-Za-z0-9_-]+)/.exec(url);
      if (!saved || !m || m[1] !== saved.s || Date.now() - (saved.at || 0) > 15 * 60000) return fail('whider/browser-invalid');
      var json = u ? decodeSession(u[1]) : null;
      if (!json) return fail('whider/browser-invalid');
      return Auth.adopt(json).catch(function (e) { fail((e && e.code) || 'whider/browser-invalid'); });
    },
    /**
     * Adopta la sesión abierta en el navegador del sistema (ordenador y Android): se guarda donde Firebase busca la
     * sesión al arrancar (su almacenamiento local, como cuando se comparte entre pestañas) y se recarga la app.
     */
    adopt: function (json) {
      var user = cleanSession(json);
      if (!user || !CFG.firebase || !CFG.firebase.apiKey) return Promise.reject(err('whider/browser-invalid'));
      var key = 'firebase:authUser:' + CFG.firebase.apiKey + ':[DEFAULT]';
      return (auth ? F.signOut(auth) : Promise.resolve()).catch(function () { /* sin sesión previa */ }).then(function () {
        localStorage.setItem(key, JSON.stringify(user));
        location.reload();
        return new Promise(function () { /* la app se recarga ya con la sesión */ });
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
    /**
     * Elimina la cuenta y todo lo suyo en la nube: tareas y ajustes, el Cuaderno y sus archivos, el perfil público,
     * el código de contacto, el buzón y la pertenencia a equipos. Firebase exige un inicio de sesión
     * reciente: si no lo es, se pide antes de borrar nada (así no queda la cuenta a medio borrar).
     * Se mira con las horas del servidor (las del token), no con el reloj del dispositivo.
     */
    deleteAccount: function () {
      var u = Auth.user;
      if (!u) return Promise.resolve();
      return u.getIdTokenResult(true).then(function (t) {
        var signedAt = Date.parse(t.authTime), now = Date.parse(t.issuedAtTime);
        if (signedAt && now && now - signedAt > 4 * 60000) throw { code: 'auth/requires-recent-login' };
        return Promise.all([W.PageSync && W.PageSync.deleteRemote ? W.PageSync.deleteRemote() : null, W.People && W.People.deleteRemote ? W.People.deleteRemote() : null, W.Files ? W.Files.deleteRemote() : null]);
      }).then(function () { return W.Sync ? W.Sync.deleteRemote() : null; }).then(function () { return F.deleteUser(u); });
    },

    isVerified: function () {
      var u = Auth.user;
      if (!u) return false;
      return u.emailVerified || u.providerData.some(function (p) { return !!PROVIDERS[p.providerId]; });
    },
    /** 'google', 'microsoft', 'apple' o 'password' (las cuentas con correo de antes) */
    provider: function () {
      var u = Auth.user;
      if (!u) return null;
      var p = u.providerData.filter(function (x) { return !!PROVIDERS[x.providerId]; })[0];
      return p ? p.providerId.split('.')[0] : 'password';
    },
    /** El nombre del proveedor para enseñarlo («Google», «Microsoft», «Apple») */
    providerName: function () {
      var p = Auth.provider();
      return p && p !== 'password' ? PROVIDERS[p + '.com'] : null;
    },
    message: function (e) {
      var code = e && (e.code || e.message);
      return ERRORS[code] || W.t('No se ha podido completar.') + (code ? ' (' + code + ')' : '');
    }
  };

  W.Auth = Auth;
})(window.Whider);
