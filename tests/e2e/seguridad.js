// 1.1 · Seguridad (emuladores): nadie puede listar los perfiles ni los códigos de amigo; lo que otros dejan
// en tu buzón tiene tamaño limitado; bloquear impide de verdad (en las reglas de la nube) que te escriban o
// te manden mensajes en un chat de dos; las denuncias quedan registradas y solo se leen desde la consola;
// y desbloquear lo deshace.
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
const ok = (c, m, extra) => { console.log((c ? 'OK   ' : 'FAIL ') + m + (!c && extra !== undefined ? '  → ' + JSON.stringify(extra) : '')); if (!c) fails++; };
const list = async (p) => { const r = await (await fetch(`${FS}/v1/projects/${PROJECT}/databases/(default)/documents/${p}?pageSize=300`, { headers: { Authorization: 'Bearer owner' } })).json(); return r.documents || []; };
async function device(b, label) {
  const ctx = await b.newContext({ viewport: { width: 1280, height: 860 } });
  await ctx.addInitScript((c) => { window.WHIDER_CONFIG = c; }, cfg);
  await ctx.addInitScript(simular);
  const p = await ctx.newPage();
  p.errs = [];
  p.setDefaultTimeout(10000);
  p.on('pageerror', (e) => p.errs.push(label + ': ' + e.message));
  await p.goto(APP);
  await sleep(2300);
  return p;
}
async function register(p, name, email) {
  await entrar(p, email, name);
  await sleep(2500);
  await p.evaluate(() => { if (Whider.Onboarding.isOpen()) document.querySelector('#onboardingRoot .nav-btn').click(); });
  await sleep(700);
  await p.evaluate(() => { Whider.Notify.check = function () {}; });
}
// Intenta una operación con el SDK desde la página → 'ok' o el código de error
const intenta = (p, fn, arg) => p.evaluate(async ({ src, arg }) => {
  const sdk = Whider.Auth.sdk(), db = Whider.Auth.db();
  try { await new Function('sdk', 'db', 'arg', 'return (' + src + ')(sdk, db, arg)')(sdk, db, arg); return 'ok'; } catch (e) { return e.code || String(e); }
}, { src: fn.toString(), arg });

(async () => {
  await fetch(`${EMU}/emulator/v1/projects/${PROJECT}/accounts`, { method: 'DELETE' });
  await fetch(`${FS}/emulator/v1/projects/${PROJECT}/databases/(default)/documents`, { method: 'DELETE' });
  const b = await chromium.launch();
  const A = await device(b, 'A'), B = await device(b, 'B');
  await register(A, 'Ana', 'ana.seg@ejemplo.com');
  await register(B, 'Bruno', 'bruno.seg@ejemplo.com');
  const ua = await A.evaluate(() => Whider.Sync.uid()), ub = await B.evaluate(() => Whider.Sync.uid());
  await A.evaluate(() => Whider.People.publish && Whider.People.publish());
  await sleep(1500);

  /* 1. Perfiles y códigos: uno concreto sí, la lista entera no */
  ok(await intenta(B, (sdk, db, id) => sdk.getDoc(sdk.doc(db, 'profiles', id)), ua) === 'ok', 'se puede leer el perfil de alguien concreto');
  ok(await intenta(B, (sdk, db) => sdk.getDocs(sdk.collection(db, 'profiles'))) === 'permission-denied', 'nadie puede listar todos los perfiles');
  ok(await intenta(B, (sdk, db) => sdk.getDocs(sdk.collection(db, 'codes'))) === 'permission-denied', 'ni todos los códigos de amigo');

  /* 2. Buzón: entradas pequeñas */
  const escribe = (p, arg) => intenta(p, (sdk, db, a) => sdk.setDoc(sdk.doc(db, 'inbox', a.to), { cheers: { [a.me]: { name: 'Bruno', text: a.text, at: Date.now(), id: 'c1' } } }, { merge: true }), arg);
  ok(await escribe(B, { to: ua, me: ub, text: '¡Ánimo!' }) === 'ok', 'un ánimo normal llega al buzón');
  ok(await escribe(B, { to: ua, me: ub, text: 'x'.repeat(5000) }) === 'permission-denied', 'uno enorme se rechaza (nadie puede llenar tu buzón)');

  /* 3. Chat de dos antes de bloquear */
  const cid = await B.evaluate((x) => Whider.Chat.ensureDm(x), ua);
  const mensaje = (p, arg) => intenta(p, (sdk, db, a) => sdk.setDoc(sdk.doc(db, 'chats', a.cid, 'msgs', a.mid), { by: a.me, text: 'hola', at: Date.now() }), arg);
  ok(await mensaje(B, { cid, mid: 'm1', me: ub }) === 'ok', 'antes de bloquear, el chat funciona');

  /* 4. Ana bloquea a Bruno */
  await A.evaluate((x) => Whider.People.block(x, 'Bruno'), ub);
  await sleep(800);
  const bloqueos = await list('blocks');
  ok(bloqueos.length === 1 && bloqueos[0].name.endsWith('/' + ua + '_' + ub), 'el bloqueo se guarda en la nube', bloqueos.map((d) => d.name));
  ok(await escribe(B, { to: ua, me: ub, text: 'Hola otra vez' }) === 'permission-denied', 'bloqueado: ya no puede escribir en su buzón');
  ok(await mensaje(B, { cid, mid: 'm2', me: ub }) === 'permission-denied', 'ni mandarle mensajes en el chat de dos');
  ok(await intenta(B, (sdk, db, id) => sdk.getDoc(sdk.doc(db, 'blocks', id)), ua + '_' + ub) === 'permission-denied', 'y no puede ver que le han bloqueado');
  const ui = await A.evaluate((x) => ({ contacto: Whider.People.contacts().some((f) => f.uid === x), chat: Whider.Chat.list().some((c) => c.type === 'dm'), lista: Object.keys(Whider.People.blocked()) }), ub);
  ok(!ui.contacto && !ui.chat && ui.lista[0] === ub, 'en la app de Ana desaparece de contactos y chats', ui);
  await A.evaluate(() => Whider.Settings.open('privacy'));
  await sleep(700);
  ok(await A.evaluate(() => /Personas bloqueadas\s*1/.test(document.querySelector('.sheet').textContent)), 'Ajustes → Privacidad enseña «Personas bloqueadas: 1»');
  await A.evaluate(() => { for (let i = 0; i < 6 && Whider.Sheet.closeTop(); i++); });

  /* 5. Denunciar */
  await B.evaluate((x) => Whider.People.report({ who: x, reason: 'spam', where: 'prueba', excerpt: 'texto' }), ua);
  await sleep(600);
  const den = await list('reports');
  ok(den.length === 1, 'la denuncia queda registrada', den.length);
  ok(await intenta(B, (sdk, db) => sdk.getDocs(sdk.collection(db, 'reports'))) === 'permission-denied', 'y desde la app nadie puede leer las denuncias');
  ok(await intenta(B, (sdk, db, x) => sdk.setDoc(sdk.doc(db, 'reports', 'falsa'), { by: x, who: 'otro', reason: 'spam', at: 1 }), ua) === 'permission-denied', 'ni denunciar en nombre de otro');

  /* 6. Desbloquear */
  await A.evaluate((x) => Whider.People.unblock(x), ub);
  await sleep(800);
  ok((await list('blocks')).length === 0, 'desbloquear borra el bloqueo');
  ok(await mensaje(B, { cid, mid: 'm3', me: ub }) === 'ok', 'y el chat vuelve a funcionar');

  ok(!A.errs.length && !B.errs.length, 'sin errores', A.errs.concat(B.errs));
  await b.close();
  console.log(fails ? fails + ' FALLOS' : 'TODO OK');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
