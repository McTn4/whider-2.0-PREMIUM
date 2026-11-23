// Eliminar la cuenta borra también el Cuaderno, el perfil público, el código, el buzón y los equipos
const { chromium } = require('playwright');
const { APP } = require('./_util');
const { simular, entrar } = require('./_cuentas');
const EMU = 'http://127.0.0.1:9099', FS = 'http://127.0.0.1:8085', PROJECT = 'demo-whider';
const cfg = { firebase: { apiKey: 'demo-key', authDomain: 'demo-whider.firebaseapp.com', projectId: PROJECT, appId: '1:1:web:1' }, googleWebClientId: 'x', requireAccount: true, emulator: { auth: EMU, firestoreHost: '127.0.0.1', firestorePort: 8085 } };
const sleep = ms => new Promise(r => setTimeout(r, ms));
let fails = 0;
const ok = (c, m) => { console.log((c ? 'OK   ' : 'FAIL ') + m); if (!c) fails++; };
const doc = async path => (await fetch(`${FS}/v1/projects/${PROJECT}/databases/(default)/documents/${path}`, { headers: { Authorization: 'Bearer owner' } })).status;
const list = async path => { const r = await (await fetch(`${FS}/v1/projects/${PROJECT}/databases/(default)/documents/${path}`, { headers: { Authorization: 'Bearer owner' } })).json(); return (r.documents || []).length; };
async function register(p, name, email) {
  await entrar(p, email, name); await sleep(2500);
  await p.evaluate(() => { if (Whider.Onboarding.isOpen()) document.querySelector('#onboardingRoot .nav-btn').click(); }); await sleep(600);
}
(async () => {
  await fetch(`${EMU}/emulator/v1/projects/${PROJECT}/accounts`, { method: 'DELETE' });
  await fetch(`${FS}/emulator/v1/projects/${PROJECT}/databases/(default)/documents`, { method: 'DELETE' });
  const browser = await chromium.launch();
  const mk = async () => { const ctx = await browser.newContext(); await ctx.addInitScript(c => { window.WHIDER_CONFIG = c; }, cfg); await ctx.addInitScript(simular); const p = await ctx.newPage(); p.setDefaultTimeout(8000); p.on('pageerror', e => { console.log('pageerror', e.message); fails++; }); await p.goto(APP); await sleep(2200); return p; };
  const A = await mk();
  await register(A, 'Ana Ruiz', 'ana@ejemplo.com');
  const uid = await A.evaluate(() => Whider.Auth.user.uid);
  await A.evaluate(() => { const P = Whider.Pages; P.create({ title: 'Mi plan', blocks: [P.block('p', 'Hola')] }); P.fromTemplate('meeting', {}); });
  await A.evaluate(() => Whider.People.enable()); await sleep(1200);
  const sid = await A.evaluate(() => Whider.People.createTeam('Solo yo', [])); await sleep(800);
  await A.evaluate(id => { const P = Whider.Pages; P.create({ title: 'Del equipo', team: id, blocks: [P.block('p', 'x')] }); }, sid);
  await A.evaluate(() => Whider.PageSync.now()); await sleep(2500);
  const code = await A.evaluate(() => Whider.State.social.code);
  ok(await list(`users/${uid}/pages`) >= 2, 'antes: páginas en la nube (' + await list(`users/${uid}/pages`) + ')');
  ok(await doc(`users/${uid}/state/pages`) === 200, 'antes: índice del Cuaderno en la nube');
  ok(await doc(`profiles/${uid}`) === 200, 'antes: perfil público');
  ok(await doc(`codes/${code}`) === 200, 'antes: código de contacto');
  ok(await doc(`spaces/${sid}`) === 200 && await list(`spaces/${sid}/pages`) >= 1, 'antes: equipo con su página');

  // Inicio de sesión antiguo: no se borra nada y se pide entrar otra vez
  // (el token dice que se entró hace una hora; el reloj del dispositivo no cuenta)
  const early = await A.evaluate(() => { const u = Whider.Auth.user; u.getIdTokenResult = () => Promise.resolve({ authTime: new Date(Date.now() - 3600000).toUTCString(), issuedAtTime: new Date().toUTCString() }); return Whider.Auth.deleteAccount().then(() => 'borrada', e => e.code).finally(() => { delete u.getIdTokenResult; }); });
  // Reloj del dispositivo adelantado una hora: se puede borrar igual (cuentan las horas del servidor)
  const skew = await A.evaluate(() => { const real = Date.now; const t0 = real(); Date.now = () => t0 + 3600000; return Whider.Auth.user.getIdTokenResult(true).then(t => { Date.now = real; return Date.parse(t.issuedAtTime) - Date.parse(t.authTime) < 4 * 60000; }, e => { Date.now = real; return 'error ' + e.code; }); });
  ok(skew === true, 'reloj del dispositivo desajustado: no impide borrar (' + skew + ')');
  ok(early === 'auth/requires-recent-login', 'sesión antigua: pide volver a entrar (' + early + ')');
  ok(await doc(`profiles/${uid}`) === 200 && await list(`users/${uid}/pages`) >= 2, 'sesión antigua: no se ha borrado nada');

  await A.evaluate(() => Whider.App.deleteAccount()); await sleep(3500);
  ok(await list(`users/${uid}/pages`) === 0, 'después: sin páginas en la nube');
  ok(await doc(`users/${uid}/state/pages`) === 404, 'después: sin índice del Cuaderno');
  ok(await doc(`users/${uid}/state/app`) === 404, 'después: sin datos de la app');
  ok(await doc(`profiles/${uid}`) === 404, 'después: sin perfil público');
  ok(await doc(`codes/${code}`) === 404, 'después: sin código de contacto');
  ok(await doc(`spaces/${sid}`) === 404 && await list(`spaces/${sid}/pages`) === 0, 'después: el equipo (solo suyo) y su página, borrados');
  const local = await A.evaluate(() => ({ pages: Whider.Pages.count(), chats: Whider.Chat.list().length, user: !!Whider.Auth.user }));
  ok(local.pages === 0 && local.chats === 0 && !local.user, 'después: nada en el dispositivo ' + JSON.stringify(local));

  // Chats de una cuenta no se ven con otra en el mismo dispositivo
  const B = await mk();
  await register(B, 'Bea Gil', 'bea@ejemplo.com');
  const C = await mk();
  await register(C, 'Carla Sol', 'carla@ejemplo.com');
  await B.evaluate(() => Whider.People.enable()); await sleep(800);
  const link = await B.evaluate(() => Whider.Invite.personLink('work'));
  await C.evaluate(l => Whider.Invite.open(l), link); await sleep(900);
  await C.click('.sheet-layer.open .sheet-foot .btn.primary'); await sleep(2500);
  await B.evaluate(() => Whider.People.poll(true)); await sleep(1500);
  await B.evaluate(() => Whider.Chat.openChat({ uid: Whider.State.friends()[0].uid })); await sleep(1500);
  await B.evaluate(() => Whider.Chat.send(Whider.State.ui.chat, { text: 'Hola Carla' })); await sleep(1200);
  ok(await B.evaluate(() => Whider.Chat.list().length) === 1, 'Bea tiene su chat');
  await B.evaluate(() => Whider.App.logout()); await sleep(1500);
  ok(await B.evaluate(() => Whider.Chat.list().length) === 0, 'sin sesión: no se ven los chats de Bea');
  // Otra cuenta en el mismo navegador
  await B.evaluate(() => Whider.AuthScreen.open({ mode: 'register' })); await sleep(600);
  await register(B, 'Dani Paz', 'dani@ejemplo.com');
  const seen = await B.evaluate(() => ({ list: Whider.Chat.list().length, cache: (localStorage.getItem('whider.chats.v1') || '').indexOf('Hola Carla') >= 0 }));
  ok(seen.list === 0 && !seen.cache, 'otra cuenta: no ve ni guarda los chats de Bea ' + JSON.stringify(seen));
  await browser.close();
  console.log(fails ? fails + ' FALLOS' : 'TODO OK');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
