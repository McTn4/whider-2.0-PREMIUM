/**
 * Acceso con Google desde la app de escritorio.
 *
 * Google no permite iniciar sesión dentro de ventanas integradas en otras apps, así que el
 * acceso se hace en el navegador del ordenador, como en cualquier app de escritorio seria:
 *  1. Se abre un servidor local de un solo uso (127.0.0.1 y ::1, puerto libre al azar).
 *  2. El navegador abre http://localhost:PUERTO/google, una página con el botón de Google que usa
 *     el mismo proyecto de Firebase de la app («localhost» es un dominio autorizado por defecto).
 *  3. Al entrar, esa página envía las credenciales de Google a este servidor y se cierra.
 *  4. La app inicia sesión con ellas (signInWithCredential) y el servidor se apaga.
 * Un código aleatorio en la dirección impide que otra página o programa entregue credenciales.
 */
'use strict';
const http = require('http');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const TIMEOUT = 5 * 60 * 1000;
let pending = null;

const GOOGLE_G = '<svg viewBox="0 0 48 48" width="20" height="20" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>';

function page(state) {
  return `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>WHIDER · Entrar con Google</title>
<style>
  @font-face { font-family: 'Hanken Grotesk'; src: url('/font.woff2') format('woff2'); font-weight: 100 900; font-display: swap; }
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  body { margin: 0; min-height: 100vh; display: grid; place-items: center; padding: 24px; background: #050505; color: #F2F2F2;
    font: 16px/1.5 'Hanken Grotesk', 'Helvetica Neue', Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased; }
  main { width: min(26rem, 100%); padding: 36px 28px 30px; border-radius: 22px; text-align: center; background: #111;
    border: 1px solid rgba(255,255,255,.08); box-shadow: 0 30px 70px -30px #000, inset 0 1px 0 rgba(255,255,255,.05); }
  svg.w { width: 64px; height: 64px; filter: drop-shadow(0 0 12px rgba(255,255,255,.35)); }
  h1 { margin: 14px 0 6px; font-size: 1.5rem; font-weight: 600; letter-spacing: -.02em; }
  p { margin: 0 0 22px; color: #A3A3A3; font-size: .95rem; }
  button { display: inline-flex; align-items: center; justify-content: center; gap: 10px; width: 100%; min-height: 50px; padding: 0 20px;
    border-radius: 12px; border: 1px solid #8E918F; background: #131314; color: #E3E3E3; font: inherit; font-weight: 500; cursor: pointer; }
  button:hover { background: #1b1b1c; }
  button:disabled { opacity: .5; cursor: default; }
  .ok svg.w { filter: drop-shadow(0 0 20px rgba(255,255,255,.6)); }
</style></head>
<body>
<main>
  <svg class="w" viewBox="4 8 56 46" aria-hidden="true"><path d="M12.5 22.5 23 45l9-15.5L41 45l11-28" fill="none" stroke="#fff" stroke-width="6.4" stroke-linecap="round" stroke-linejoin="round"/></svg>
  <h1>Entrar en WHIDER</h1>
  <p id="msg">Pulsa el botón para continuar con tu cuenta de Google. Después vuelve a la app.</p>
  <button id="go" type="button">${GOOGLE_G}<span>Continuar con Google</span></button>
</main>
<script src="/config.js"></script>
<script src="/firebase.js"></script>
<script>
(function () {
  var S = ${JSON.stringify(state)};
  var F = window.WFB, cfg = window.WHIDER_CONFIG || {};
  var btn = document.getElementById('go'), msg = document.getElementById('msg');
  function post(path, data) {
    return fetch(path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(Object.assign({ s: S }, data)) });
  }
  if (!F || !cfg.firebase) { msg.textContent = 'Esta copia de WHIDER no tiene cuentas configuradas.'; btn.disabled = true; post('/fail', { kind: 'unavailable', detail: 'no-config' }); return; }
  var app = F.initializeApp(cfg.firebase, 'whider-desktop-google');
  var auth = F.initializeAuth(app, { persistence: F.browserLocalPersistence, popupRedirectResolver: F.browserPopupRedirectResolver });
  if (cfg.emulator) F.connectAuthEmulator(auth, cfg.emulator.auth, { disableWarnings: true });
  auth.languageCode = 'es';
  btn.addEventListener('click', function () {
    btn.disabled = true;
    msg.textContent = 'Elige tu cuenta en la ventana de Google…';
    var provider = new F.GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    F.signInWithPopup(auth, provider).then(function (r) {
      var c = F.GoogleAuthProvider.credentialFromResult(r);
      if (!c || (!c.idToken && !c.accessToken)) throw { code: 'whider/no-credential' };
      return post('/done', { idToken: c.idToken || null, accessToken: c.accessToken || null });
    }).then(function (res) {
      if (!res.ok) throw { code: 'whider/expired' };
      F.signOut(auth).catch(function () {});
      document.body.classList.add('ok');
      btn.hidden = true;
      msg.textContent = 'Listo. Ya puedes cerrar esta pestaña y volver a WHIDER.';
      setTimeout(function () { window.close(); }, 1500);
    }).catch(function (e) {
      btn.disabled = false;
      var code = (e && e.code) || '';
      if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') msg.textContent = 'Has cerrado la ventana de Google. Pulsa el botón para intentarlo otra vez.';
      else if (code === 'auth/popup-blocked') msg.textContent = 'El navegador ha bloqueado la ventana de Google. Permite las ventanas emergentes de esta página e inténtalo otra vez.';
      else if (code === 'auth/unauthorized-domain') { msg.textContent = 'Falta «localhost» en los dominios autorizados de Firebase (Authentication → Configuración).'; post('/fail', { kind: 'unavailable', detail: code }); }
      else if (code === 'whider/expired') { msg.textContent = 'Este enlace ya no es válido. Vuelve a WHIDER y pulsa otra vez «Continuar con Google».'; btn.hidden = true; }
      else msg.textContent = 'No se pudo entrar con Google' + (code ? ' (' + code + ')' : '') + '. Inténtalo otra vez.';
    });
  });
})();
</script>
</body></html>`;
}

function readBody(req) {
  return new Promise(function (resolve, reject) {
    var chunks = [], size = 0;
    req.on('data', function (c) { size += c.length; if (size > 64 * 1024) { reject(new Error('demasiado grande')); req.destroy(); } else chunks.push(c); });
    req.on('end', function () { try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')); } catch (e) { reject(e); } });
    req.on('error', reject);
  });
}

/**
 * signIn({ www, open, config }) → Promise<{ ok: true, idToken, accessToken } | { ok: false, kind, detail }>
 *  - www: carpeta de la app web (para servir firebase.js y config.js)
 *  - open(url): abre la dirección en el navegador del ordenador
 *  - config: texto JS opcional que sustituye a js/config.js (pruebas con los emuladores)
 */
function signIn(opts) {
  cancel();
  return new Promise(function (resolve) {
    var state = crypto.randomBytes(24).toString('hex');
    var servers = [], done = false, timer = null;
    var finish = function (result) {
      if (done) return;
      done = true;
      clearTimeout(timer);
      if (pending && pending.finish === finish) pending = null;
      // Se deja un momento para que la página reciba la respuesta antes de apagar el servidor
      setTimeout(function () { servers.forEach(function (s) { try { s.close(); } catch (e) { /* ya cerrado */ } }); }, 2000);
      resolve(result);
    };
    var send = function (res, code, type, body) {
      res.writeHead(code, { 'content-type': type, 'cache-control': 'no-store', 'x-content-type-options': 'nosniff', 'referrer-policy': 'no-referrer' });
      res.end(body);
    };
    var handler = function (req, res) {
      var u = new URL(req.url, 'http://localhost');
      if (req.method === 'GET' && u.pathname === '/google') {
        if (u.searchParams.get('s') !== state || done) return send(res, 410, 'text/plain; charset=utf-8', 'Este enlace ya no es válido. Vuelve a WHIDER.');
        return send(res, 200, 'text/html; charset=utf-8', page(state));
      }
      if (req.method === 'GET' && u.pathname === '/firebase.js') {
        return fs.readFile(path.join(opts.www, 'js', 'vendor', 'firebase.js'), function (e, buf) { e ? send(res, 404, 'text/plain', '') : send(res, 200, 'text/javascript; charset=utf-8', buf); });
      }
      if (req.method === 'GET' && u.pathname === '/font.woff2') {
        return fs.readFile(path.join(opts.www, 'fonts', 'hanken-grotesk-latin-wght-normal.woff2'), function (e, buf) { e ? send(res, 404, 'text/plain', '') : send(res, 200, 'font/woff2', buf); });
      }
      if (req.method === 'GET' && u.pathname === '/config.js') {
        if (opts.config) return send(res, 200, 'text/javascript; charset=utf-8', opts.config);
        return fs.readFile(path.join(opts.www, 'js', 'config.js'), function (e, buf) { e ? send(res, 404, 'text/plain', '') : send(res, 200, 'text/javascript; charset=utf-8', buf); });
      }
      if (req.method === 'POST' && (u.pathname === '/done' || u.pathname === '/fail')) {
        return readBody(req).then(function (b) {
          if (!b || b.s !== state || done) return send(res, 410, 'application/json', '{"ok":false}');
          send(res, 200, 'application/json', '{"ok":true}');
          if (u.pathname === '/done') finish({ ok: true, idToken: b.idToken || null, accessToken: b.accessToken || null });
          else finish({ ok: false, kind: b.kind === 'unavailable' ? 'unavailable' : 'cancelled', detail: String(b.detail || '') });
        }).catch(function () { send(res, 400, 'application/json', '{"ok":false}'); });
      }
      send(res, 404, 'text/plain; charset=utf-8', 'No encontrado');
    };

    var main = http.createServer(handler);
    main.on('error', function (e) { finish({ ok: false, kind: 'unavailable', detail: e.message }); });
    main.listen(0, '127.0.0.1', function () {
      var port = main.address().port;
      // También en IPv6, por si el navegador resuelve «localhost» como ::1
      var v6 = http.createServer(handler);
      v6.on('error', function () { /* sin IPv6: basta con 127.0.0.1 */ });
      v6.listen(port, '::1');
      servers.push(main, v6);
      try { opts.open('http://localhost:' + port + '/google?s=' + state); } catch (e) { finish({ ok: false, kind: 'unavailable', detail: e.message }); }
    });
    timer = setTimeout(function () { finish({ ok: false, kind: 'timeout' }); }, TIMEOUT);
    pending = { finish: finish };
  });
}

/** Cancela un acceso en curso (botón «Cancelar» de la app o nuevo intento) */
function cancel() {
  if (pending) pending.finish({ ok: false, kind: 'cancelled' });
  pending = null;
}

module.exports = { signIn: signIn, cancel: cancel };
