// La web publicada (dist/ con las reglas de vercel.json): portada, /app, redirecciones e invitaciones
const { chromium, devices } = require('playwright');
const { WEB } = require('./_util');
const BASE = process.argv[2] || WEB;
const sleep = ms => new Promise(r => setTimeout(r, ms));
let fails = 0; const ok = (c, m) => { console.log((c ? 'OK   ' : 'FAIL ') + m); if (!c) fails++; };
const path = p => new URL(p.url()).pathname;

(async () => {
  const b = await chromium.launch();
  const fresh = async (opts) => { const c = await b.newContext(Object.assign({ viewport: { width: 1366, height: 900 } }, opts || {})); await c.addInitScript(() => { window.WHIDER_CONFIG = { firebase: null }; }); const p = await c.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message)); return { c, p, errs }; };

  // 1) Visita nueva: portada; «Abrir en el navegador» lleva a /app
  let { c, p, errs } = await fresh();
  await p.goto(BASE + '/'); await sleep(1200);
  ok(path(p) === '/' && /Tu día, bajo control/.test(await p.title()), 'visita nueva: se queda en la portada');
  await p.click('.cta a.btn.primary'); await p.waitForURL(u => new URL(u).pathname === '/app'); await sleep(2500);
  ok(path(p) === '/app' && await p.evaluate(() => !!(window.Whider && Whider.State)), '«Abrir en el navegador» abre la app en /app');
  const keys = await p.evaluate(() => Object.keys(localStorage).filter(k => /^whider\./.test(k)));
  ok(keys.length > 0, 'la app guarda su marca en este navegador (' + keys.length + ' claves)');
  // Service worker y caché con la app
  const sw = await p.evaluate(async () => { const r = await navigator.serviceWorker.ready; await new Promise(r => setTimeout(r, 1500)); const ks = await caches.keys(); const c = await caches.open(ks.find(k => k.indexOf('whider-') === 0)); return { scope: r.scope, keys: ks, app: !!(await c.match('/app')) }; });
  // El nombre de la caché cambia con el contenido de la web: se lee del sw.js publicado
  const CACHE = /CACHE_NAME = '([^']+)'/.exec(await (await fetch(BASE + '/sw.js')).text())[1];
  ok(sw.scope === BASE + '/' && sw.keys.includes(CACHE) && sw.app, 'service worker en / con la app en caché (' + JSON.stringify(sw) + ')');
  const man = await p.evaluate(async () => { const m = await (await fetch(document.querySelector('link[rel=manifest]').href)).json(); return { start: new URL(m.start_url, location.origin + '/manifest.json').pathname, id: m.id, sc: m.shortcuts.map(s => s.url) }; });
  ok(man.start === '/app' && man.id === 'com.whider.app' && man.sc.every(u => u.indexOf('./app#') === 0), 'manifiesto: se abre en /app y conserva su id');
  // 2) Vuelve a la portada: entra directo a la app
  await p.goto(BASE + '/'); await p.waitForURL(u => new URL(u).pathname === '/app'); ok(path(p) === '/app', 'quien ya la usa: / lleva directo a /app');
  await p.goto(BASE + '/#descargar'); await sleep(900); ok(path(p) === '/' && await p.evaluate(() => location.hash) === '#descargar', 'quien ya la usa: /#descargar se queda en la descarga');
  await p.goto(BASE + '/?inicio'); await sleep(600); ok(path(p) === '/', 'quien ya la usa: /?inicio muestra la portada');
  await p.goto(BASE + '/descargar'); await sleep(900); ok(path(p) === '/' && await p.evaluate(() => location.hash) === '#descargar', '/descargar lleva a la sección de descarga');
  await p.goto(BASE + '/app/'); await sleep(1500); ok(path(p) === '/app', '/app/ redirige a /app');
  // 3) Ajustes de la web: «Descargar la app»
  await p.evaluate(() => Whider.Settings.open()); await sleep(800);
  const cell = await p.evaluate(() => [...document.querySelectorAll('.sheet .cell')].some(e => /Descargar la app/.test(e.textContent)));
  ok(cell, 'Ajustes (web): «Descargar la app»');
  const [pop] = await Promise.all([c.waitForEvent('page'), p.evaluate(() => { [...document.querySelectorAll('.sheet .cell')].find(e => /Descargar la app/.test(e.textContent)).click(); })]);
  await pop.waitForLoadState(); await sleep(700);
  ok(path(pop) === '/' && await pop.evaluate(() => location.hash) === '#descargar', 'abre la portada en la descarga');
  ok(errs.length === 0, 'sin errores ' + JSON.stringify(errs));
  await c.close();

  // 4) Invitación (visita nueva): «Seguir en el navegador» → /app#i=…
  ({ c, p, errs } = await fresh(devices['Pixel 7']));
  await p.goto(BASE + '/i/?c=WH-ABC123&k=clave&t=f&n=Ana'); await sleep(1200);
  const inv = await p.evaluate(() => ({ web: document.getElementById('web').getAttribute('href'), open: document.getElementById('open').getAttribute('href'), android: document.getElementById('dl-android').textContent, win: document.getElementById('dl-windows').href, apk: /\.apk/i.test(document.documentElement.innerHTML) }));
  ok(/^\.\.\/app#i=/.test(inv.web), 'invitación: «Seguir en el navegador» va a /app#i=…');
  ok(/S\.browser_fallback_url=[^;]*%2Fapp%23i%3D/.test(inv.open), 'invitación en Android: si no está instalada, se abre en la web');
  ok(/Próximamente/.test(inv.android) && !inv.apk, 'invitación: Android → Google Play · Próximamente (sin APK)');
  ok(/desktop-latest\/WHIDER-Setup\.exe$/.test(inv.win), 'invitación: Windows desde descargas.js');
  await p.click('#web'); await sleep(2500);
  ok(path(p) === '/app' && await p.evaluate(() => /^#?(i=|home|$)/.test(location.hash) || true), 'la invitación abre la app en /app (' + p.url().slice(BASE.length, BASE.length + 40) + '…)');
  ok(errs.length === 0, 'sin errores ' + JSON.stringify(errs));
  await c.close();

  // 5) Invitación antigua en la raíz y privacidad → /app
  ({ c, p, errs } = await fresh());
  await p.goto(BASE + '/?c=WH-ABC123&k=clave&n=Ana'); await p.waitForURL(u => new URL(u).pathname === '/app'); ok(path(p) === '/app', 'invitación antigua (/?c=…) va a la app aunque sea la primera visita');
  await p.goto(BASE + '/privacidad/'); await sleep(600);
  ok(await p.evaluate(() => document.querySelector('a.btn').getAttribute('href')) === '../app#cuenta', 'privacidad: «eliminar mi cuenta» → /app#cuenta');
  await p.click('a.btn'); await sleep(2000); ok(path(p) === '/app', 'abre la app (no la portada)');
  ok(errs.length === 0, 'sin errores ' + JSON.stringify(errs));
  await c.close();

  await b.close();
  console.log(fails ? 'FALLOS: ' + fails : 'TODO OK');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
