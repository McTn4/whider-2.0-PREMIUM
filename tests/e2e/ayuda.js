// 1.1 · Ayuda (emuladores): preguntas frecuentes; enviar comentarios (con cuenta, a la nube sin nombre ni cuenta;
// sin cuenta, a GitHub); errores recientes en el dispositivo y, solo con permiso, a la nube (sin repetir y sin
// correos). Las reglas impiden leerlos desde la app, firmarlos o mandar textos enormes.
const { chromium } = require('playwright');
const { APP } = require('./_util');
const { simular, entrar } = require('./_cuentas');

const EMU = 'http://127.0.0.1:9099', FS = 'http://127.0.0.1:8085', PROJECT = 'demo-whider';
const cfg = {
  firebase: { apiKey: 'demo-key', authDomain: 'demo-whider.firebaseapp.com', projectId: PROJECT, appId: '1:1:web:1' },
  googleWebClientId: 'x', requireAccount: true,
  emulator: { auth: EMU, firestoreHost: '127.0.0.1', firestorePort: 8085 }, links: { base: 'https://whider-red.vercel.app' }
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let fails = 0;
const ok = (c, m, x) => { console.log((c ? 'OK   ' : 'FAIL ') + m + (!c && x !== undefined ? '  → ' + JSON.stringify(x) : '')); if (!c) fails++; };
const list = async (p) => { const r = await (await fetch(`${FS}/v1/projects/${PROJECT}/databases/(default)/documents/${p}?pageSize=300`, { headers: { Authorization: 'Bearer owner' } })).json(); return r.documents || []; };
const campos = (d) => Object.fromEntries(Object.entries(d.fields || {}).map(([k, v]) => [k, Object.values(v)[0]]));
const sheetText = (p) => p.evaluate(() => { const s = document.querySelector('#sheetRoot > .sheet-layer:last-child'); return s ? s.innerText : ''; });
const cerrar = (p) => p.evaluate(() => { for (let i = 0; i < 8 && Whider.Sheet.closeTop(); i++); });
const intenta = (p, fn, arg) => p.evaluate(async ({ src, arg }) => {
  const sdk = Whider.Auth.sdk(), db = Whider.Auth.db();
  try { await new Function('sdk', 'db', 'arg', 'return (' + src + ')(sdk, db, arg)')(sdk, db, arg); return 'ok'; } catch (e) { return e.code || String(e); }
}, { src: fn.toString(), arg });

(async () => {
  await fetch(`${EMU}/emulator/v1/projects/${PROJECT}/accounts`, { method: 'DELETE' });
  await fetch(`${FS}/emulator/v1/projects/${PROJECT}/databases/(default)/documents`, { method: 'DELETE' });
  const b = await chromium.launch();

  /* ---------- Con cuenta ---------- */
  const ctx = await b.newContext({ viewport: { width: 1280, height: 860 } });
  await ctx.addInitScript((c) => { window.WHIDER_CONFIG = c; localStorage.setItem('whider.seenVersion', '999.0.0'); }, cfg);
  await ctx.addInitScript(simular);
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', (e) => { if (!/Fallo de prueba|Otro fallo/.test(e.message)) errs.push(e.message); });
  p.setDefaultTimeout(10000);
  await p.goto(APP);
  await sleep(2300);
  await entrar(p, 'ana.ayuda@ejemplo.com', 'Ana');
  await sleep(2500);
  await p.evaluate(() => { if (Whider.Onboarding.isOpen()) document.querySelector('#onboardingRoot .nav-btn').click(); Whider.Notify.check = function () {}; });
  await sleep(700);

  // Preguntas frecuentes
  await p.evaluate(() => Whider.Settings.open());
  await sleep(600);
  await p.click('#sheetRoot .cell:has-text("Preguntas frecuentes")');
  await sleep(600);
  const n = await p.evaluate(() => document.querySelectorAll('#sheetRoot .hp-q').length);
  await p.click('#sheetRoot .hp-q:has-text("varios dispositivos"), #sheetRoot .hp-q:has-text("móvil y en el ordenador")');
  await sleep(200);
  ok(n === 13 && /misma cuenta/.test(await sheetText(p)), 'trece preguntas frecuentes (con «Cada día», el orden de Inicio y dónde están los ajustes) que se abren con un toque', n);
  await cerrar(p);

  // Comentarios
  await p.evaluate(() => Whider.Help.feedback());
  await sleep(500);
  await p.click('#sheetRoot .sheet-layer:last-child .sheet-foot button:has-text("Enviar")');
  await sleep(300);
  ok((await list('feedback')).length === 0 && /Escribe primero/.test(await p.evaluate(() => document.querySelector('.toast').innerText)), 'sin texto no se envía nada');
  await p.click('#sheetRoot .hp-kind:has-text("Algo no funciona")');
  await p.fill('#sheetRoot .hp-text', 'Al importar desde Todoist se quedó cargando.');
  await p.click('#sheetRoot .sheet-layer:last-child .sheet-foot button:has-text("Enviar")');
  await sleep(1200);
  const fb = (await list('feedback')).map(campos);
  ok(fb.length === 1 && fb[0].kind === 'fallo' && /Todoist/.test(fb[0].text) && fb[0].v && /Navegador/.test(fb[0].p), 'el comentario llega a la nube con la versión y el sistema', fb);
  ok(fb.length === 1 && !('by' in fb[0]) && !JSON.stringify(fb[0]).includes('ana.ayuda') && !JSON.stringify(fb[0]).includes(await p.evaluate(() => Whider.Sync.uid())), 'sin nombre, cuenta ni correo');

  // Errores: apuntados en el dispositivo; a la nube solo con permiso
  await p.evaluate(() => { setTimeout(() => { throw new Error('Fallo de prueba con ana.ayuda@ejemplo.com dentro'); }, 0); });
  await sleep(600);
  const local = await p.evaluate(() => Whider.Errors.list());
  ok(local.length === 1 && /«correo»/.test(local[0].msg) && !/ejemplo\.com/.test(local[0].msg), 'el error queda en el dispositivo, sin el correo', local.map((e) => e.msg));
  ok((await list('errors')).length === 0, 'sin permiso, no se envía');
  await p.evaluate(() => Whider.Settings.open('privacy'));
  await sleep(600);
  await p.click('#sheetRoot .cell:has-text("Enviar informes de errores") .toggle, #sheetRoot .cell:has-text("Enviar informes de errores") [role=switch]');
  await sleep(300);
  ok(await p.evaluate(() => Whider.Errors.enabled()), 'Ajustes → Privacidad: «Enviar informes de errores»');
  await cerrar(p);
  await p.evaluate(() => { for (let i = 0; i < 2; i++) setTimeout(() => { throw new Error('Otro fallo'); }, i * 50); });
  await sleep(1500);
  const enviados = (await list('errors')).map(campos);
  ok(enviados.length === 1 && enviados[0].msg === 'Otro fallo' && enviados[0].v && !('by' in enviados[0]), 'con permiso se envía, una sola vez y sin cuenta', enviados);
  ok((await p.evaluate(() => Whider.Errors.list()))[0].count === 2, 'en el dispositivo cuenta las repeticiones');

  // Reglas
  ok(await intenta(p, (sdk, db) => sdk.getDocs(sdk.collection(db, 'feedback'))) === 'permission-denied', 'nadie puede leer los comentarios desde la app');
  ok(await intenta(p, (sdk, db) => sdk.getDocs(sdk.collection(db, 'errors'))) === 'permission-denied', 'ni los errores');
  ok(await intenta(p, (sdk, db, uid) => sdk.setDoc(sdk.doc(db, 'feedback', 'x1'), { kind: 'idea', text: 'hola', at: 1, by: uid }), await p.evaluate(() => Whider.Sync.uid())) === 'permission-denied', 'no se pueden firmar (campos de más)');
  ok(await intenta(p, (sdk, db) => sdk.setDoc(sdk.doc(db, 'feedback', 'x2'), { kind: 'idea', text: 'x'.repeat(2500), at: 1 })) === 'permission-denied', 'ni mandar textos enormes');

  // Errores recientes en Ajustes → Ayuda
  await p.evaluate(() => Whider.Settings.open());
  await sleep(600);
  await p.click('#sheetRoot .cell:has-text("Errores recientes")');
  await sleep(600);
  ok(/Otro fallo/.test(await sheetText(p)) && /2 veces/.test(await sheetText(p)), 'Ajustes → Ayuda → Errores recientes los enseña');
  await p.click('#sheetRoot button:has-text("Borrar")');
  await sleep(400);
  ok((await p.evaluate(() => Whider.Errors.list().length)) === 0, '«Borrar» los quita');
  ok(!errs.length, 'sin otros errores', errs);
  await ctx.close();

  /* ---------- Sin cuenta: a GitHub ---------- */
  {
    const c2 = await b.newContext({ viewport: { width: 390, height: 844 } });
    await c2.addInitScript(() => { window.WHIDER_CONFIG = { firebase: null }; localStorage.setItem('whider.seenVersion', '999.0.0'); localStorage.setItem('whider.meta.v1', JSON.stringify({ onboarded: true, createdAt: Date.now() })); });
    const q = await c2.newPage();
    await q.goto(APP);
    await sleep(1600);
    await q.evaluate(() => { window.__abierto = null; Whider.U.openExternal = (u) => { window.__abierto = u; }; Whider.Help.feedback('idea'); });
    await sleep(500);
    ok(/es público/.test(await sheetText(q)), 'sin cuenta, avisa de que GitHub es público');
    await q.fill('#sheetRoot .hp-text', 'Modo de lectura para el Cuaderno');
    await q.click('#sheetRoot .sheet-layer:last-child .sheet-foot button:has-text("Escribirlo en GitHub")');
    await sleep(300);
    const url = await q.evaluate(() => window.__abierto);
    ok(/^https:\/\/github\.com\/McTn4\/whider-2\.0-PREMIUM\/issues\/new\?/.test(url || '') && /Modo\+de\+lectura|Modo%20de%20lectura/.test(url), 'abre un aviso nuevo en GitHub con el texto', url);
    await c2.close();
  }

  await b.close();
  console.log(fails ? fails + ' FALLOS' : 'TODO OK');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
