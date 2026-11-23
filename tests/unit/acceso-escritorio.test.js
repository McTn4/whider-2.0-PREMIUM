// Entrar con Google, Microsoft o Apple desde la app de escritorio (desktop/lib/acceso.js): el servidor local de un
// solo uso sirve la página del proveedor y solo acepta lo que llega con su código; con Microsoft y Apple devuelve la
// sesión, con Google las credenciales.
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const acceso = require('../../desktop/lib/acceso');

const WWW = path.join(__dirname, '..', '..');
const SESION = {
  uid: 'u1',
  email: 'ana@outlook.com',
  emailVerified: false,
  isAnonymous: false,
  providerData: [{ providerId: 'microsoft.com', uid: 'ms-1' }],
  stsTokenManager: { refreshToken: 'r1', accessToken: 'a1', expirationTime: 1 }
};

/** Empieza un acceso y devuelve { url, resultado } (la dirección que se abriría en el navegador) */
function empezar(provider) {
  let abrir;
  const url = new Promise((r) => (abrir = r));
  const resultado = acceso.signIn({
    provider,
    www: WWW,
    open: abrir,
    config: 'window.WHIDER_CONFIG = { firebase: null };'
  });
  return { url, resultado };
}
const enviar = (base, ruta, cuerpo) =>
  fetch(base + ruta, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(cuerpo) });

test('Microsoft: la página es la de Microsoft y devuelve la sesión que llega con el código', async () => {
  const { url, resultado } = empezar('microsoft.com');
  const u = new URL(await url);
  assert.equal(u.pathname, '/entrar');
  const s = u.searchParams.get('s');
  assert.match(s, /^[0-9a-f]{48}$/);
  const base = u.origin.replace('localhost', '127.0.0.1');

  const pagina = await fetch(base + '/entrar?s=' + s);
  assert.equal(pagina.status, 200);
  const html = await pagina.text();
  assert.match(html, /Continuar con Microsoft/);
  assert.match(html, /OAuthProvider/);
  assert.doesNotMatch(html, /Continuar con Google/);
  // Sin el código o con otro, nada
  assert.equal((await fetch(base + '/entrar?s=otro')).status, 410);
  assert.equal((await enviar(base, '/done', { s: 'otro', user: SESION })).status, 410);
  // Una sesión incompleta no se acepta (y el acceso sigue esperando)
  assert.equal((await enviar(base, '/done', { s, user: { uid: 'u1' } })).status, 400);
  assert.equal((await enviar(base, '/done', { s, user: SESION })).status, 200);
  const r = await resultado;
  assert.equal(r.ok, true);
  assert.equal(r.user.uid, 'u1');
  assert.equal(r.user.stsTokenManager.refreshToken, 'r1');
  // De un solo uso
  assert.equal((await enviar(base, '/done', { s, user: SESION })).status, 410);
});

test('Google: devuelve las credenciales, como antes', async () => {
  const { url, resultado } = empezar('google.com');
  const u = new URL(await url);
  const base = u.origin.replace('localhost', '127.0.0.1');
  const s = u.searchParams.get('s');
  assert.match(await (await fetch(base + '/entrar?s=' + s)).text(), /Continuar con Google/);
  await enviar(base, '/done', { s, idToken: 'id', accessToken: 'ac' });
  assert.deepEqual(await resultado, { ok: true, idToken: 'id', accessToken: 'ac' });
});

test('Apple: la página pide el correo y el nombre; cancelar desde la app termina el acceso', async () => {
  const { url, resultado } = empezar('apple.com');
  const u = new URL(await url);
  const html = await (
    await fetch(u.origin.replace('localhost', '127.0.0.1') + '/entrar?s=' + u.searchParams.get('s'))
  ).text();
  assert.match(html, /Continuar con Apple/);
  assert.match(html, /addScope\('email'\)/);
  acceso.cancel();
  assert.deepEqual(await resultado, { ok: false, kind: 'cancelled' });
});

test('Un proveedor que no es Google, Microsoft ni Apple no abre nada', async () => {
  let abierto = false;
  const r = await acceso.signIn({ provider: 'facebook.com', www: WWW, open: () => (abierto = true) });
  assert.deepEqual(r, { ok: false, kind: 'unavailable', detail: 'provider' });
  assert.equal(abierto, false);
});
