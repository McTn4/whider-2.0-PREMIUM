// Cuentas en las pruebas con los emuladores de Firebase.
// Desde la 2.1, WHIDER solo se usa con una cuenta de Google, Microsoft o Apple. La ventana de cada proveedor no se
// puede abrir en una prueba (y el emulador necesita apis.google.com para la suya), así que «simular» cambia
// signInWithPopup por la credencial de prueba que acepta el emulador de Auth: un token sin firmar con sub, email y
// email_verified. Todo lo demás (Firebase, la app, las reglas de la nube) es lo de verdad.

/**
 * Para addInitScript: en cuanto se carga js/vendor/firebase.js (var WFB = …), window.WFB pasa a ser una copia cuyo
 * signInWithPopup entra con la cuenta de window.__cuentaPrueba. Sin cuenta elegida, como si se cerrara la ventana.
 */
function simular() {
  let real;
  Object.defineProperty(window, 'WFB', {
    configurable: true,
    get() {
      return real;
    },
    set(v) {
      const o = {};
      for (const k of Object.keys(v)) o[k] = v[k];
      o.signInWithPopup = (auth, provider) => {
        const c = window.__cuentaPrueba;
        if (!c) return Promise.reject(Object.assign(new Error('auth/popup-closed-by-user'), { code: 'auth/popup-closed-by-user' }));
        const id = provider.providerId;
        const token = JSON.stringify({ sub: c.sub, email: c.email, email_verified: c.verified !== false, name: c.name || undefined });
        const cred = id === 'google.com' ? v.GoogleAuthProvider.credential(token) : new v.OAuthProvider(id).credential({ idToken: token });
        return v.signInWithCredential(auth, cred);
      };
      real = o;
    }
  });
}

/**
 * Una cuenta de prueba: el mismo correo y proveedor son siempre la misma cuenta. Las de Microsoft llegan sin el correo
 * verificado (como pasa a veces de verdad), para comprobar que se pueden usar igual.
 */
function cuenta(email, name, proveedor) {
  const p = proveedor || 'google';
  return { sub: p + '-' + String(email).replace(/[^a-z0-9]/gi, ''), email, name: name || '', proveedor: p, verified: p !== 'microsoft' };
}

/** Pulsa «Continuar con Google» (o Microsoft, o Apple) en la pantalla de acceso, con esa cuenta */
async function entrar(p, email, name, proveedor) {
  const c = cuenta(email, name, proveedor);
  await p.evaluate((x) => {
    window.__cuentaPrueba = x;
  }, c);
  await p.click('#authRoot .provider-btn.' + c.proveedor);
}

module.exports = { simular, cuenta, entrar };
