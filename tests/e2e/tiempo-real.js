// 1.2 · Tiempo real (emuladores): lo que cambia en un dispositivo llega a los demás sin consultar la nube cada pocos
// segundos. Tareas y Cuaderno entre dos dispositivos de la misma cuenta; mientras se escucha no se consulta la nube;
// en pausa (app en segundo plano) se vuelve a consultar y al volver se retoma; sin el SDK de escuchas todo sigue
// funcionando como antes; y con otra cuenta, la solicitud de contacto, los mensajes y las reacciones llegan al momento.
const { chromium } = require('playwright');
const { APP } = require('./_util');

const EMU = 'http://127.0.0.1:9099', FS = 'http://127.0.0.1:8085', PROJECT = 'demo-whider';
const cfg = {
  firebase: { apiKey: 'demo-key', authDomain: 'demo-whider.firebaseapp.com', projectId: PROJECT, appId: '1:1:web:1' },
  googleWebClientId: 'x', requireAccount: true, allowGuest: true, allowedEmailDomains: [],
  emulator: { auth: EMU, firestoreHost: '127.0.0.1', firestorePort: 8085 }, links: { base: 'https://whider-red.vercel.app' }
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let fails = 0;
const ok = (c, m, extra) => { console.log((c ? 'OK   ' : 'FAIL ') + m + (!c && extra !== undefined ? '  → ' + JSON.stringify(extra) : '')); if (!c) fails++; };
const get = async (p) => { const r = await fetch(`${FS}/v1/projects/${PROJECT}/databases/(default)/documents/${p}`, { headers: { Authorization: 'Bearer owner' } }); return r.status === 200 ? r.json() : null; };
async function waitFor(p, fn, arg, ms) {
  const end = Date.now() + (ms || 8000);
  while (Date.now() < end) {
    try { if (await p.evaluate(fn, arg)) return true; } catch (e) { /* recargando */ }
    await sleep(250);
  }
  return false;
}
async function device(b, label, extra) {
  const ctx = await b.newContext({ viewport: { width: 1280, height: 860 } });
  await ctx.addInitScript((c) => { window.WHIDER_CONFIG = c; }, Object.assign({}, cfg, extra || {}));
  const p = await ctx.newPage();
  p.errs = [];
  p.setDefaultTimeout(10000);
  p.on('pageerror', (e) => p.errs.push(label + ': ' + e.message));
  p.on('console', (m) => { if (m.type() === 'error' && !/400|401|403|404|ERR_|permission|insufficient|offline|network/i.test(m.text())) p.errs.push(label + ': ' + m.text()); });
  await p.goto(APP);
  await sleep(2300);
  return p;
}
async function afterAuth(p) {
  await sleep(2500);
  await p.evaluate(() => { if (Whider.Onboarding.isOpen()) document.querySelector('#onboardingRoot .nav-btn').click(); });
  await sleep(700);
  await p.evaluate(() => { Whider.Notify.check = function () {}; });
}
async function register(p, name, email) {
  await p.fill('#authRoot input[autocomplete=name]', name);
  await p.fill('#authRoot input[type=email]', email);
  await p.fill('#authRoot input[type=password]', 'Secreta123');
  await p.click('#authRoot .auth-check .check');
  await p.click('#authRoot .auth-submit');
  await sleep(2500);
  const r = await (await fetch(`${EMU}/emulator/v1/projects/${PROJECT}/oobCodes`)).json();
  await fetch(r.oobCodes.filter((c) => c.email === email).pop().oobLink);
  await p.click('text=Ya lo he verificado');
  await afterAuth(p);
}
async function login(p, email) {
  await p.click('#authRoot >> text=Iniciar sesión');
  await sleep(300);
  await p.fill('#authRoot input[type=email]', email);
  await p.fill('#authRoot input[type=password]', 'Secreta123');
  await p.click('#authRoot .auth-submit');
  await afterAuth(p);
}
// Cuenta las veces que se consulta la nube (cada subida es una transacción que la lee)
const countPushes = (p) => p.evaluate(() => { const S = Whider.Sync, orig = S.push; window.__pushes = 0; S.push = function () { window.__pushes++; return orig.apply(this, arguments); }; });
const pushes = (p) => p.evaluate(() => window.__pushes);

(async () => {
  await fetch(`${EMU}/emulator/v1/projects/${PROJECT}/accounts`, { method: 'DELETE' });
  await fetch(`${FS}/emulator/v1/projects/${PROJECT}/databases/(default)/documents`, { method: 'DELETE' });
  const b = await chromium.launch();
  const A = await device(b, 'A'), B = await device(b, 'B');
  await register(A, 'Ana', 'ana.rt@ejemplo.com');
  await login(B, 'ana.rt@ejemplo.com');
  ok(await waitFor(A, () => Whider.Sync.status === 'synced' && Whider.Sync.live() && Whider.PageSync.live(), null, 20000) &&
    await waitFor(B, () => Whider.Sync.status === 'synced' && Whider.Sync.live() && Whider.PageSync.live(), null, 20000), 'los dos dispositivos escuchan la nube (tareas y Cuaderno)',
  await Promise.all([A, B].map((p) => p.evaluate(() => ({ st: Whider.Sync.status, live: Whider.Live.state() })))));
  ok(/al momento/.test(await A.evaluate(() => Whider.Sync.statusText())), 'Ajustes dice «Sincronizado · al momento»', await A.evaluate(() => Whider.Sync.statusText()));
  const uid = await A.evaluate(() => Whider.Sync.uid());

  /* 1. Tareas: sin pedir nada, llegan solas al otro dispositivo */
  await A.evaluate(() => Whider.State.addTask({ text: 'Llamar al proveedor', date: Whider.U.today() }));
  ok(await waitFor(B, () => Whider.State.tasks.some((t) => t.text === 'Llamar al proveedor'), null, 6000), 'la tarea creada en A llega sola a B (en segundos)');
  await B.evaluate(() => { const t = Whider.State.tasks.find((x) => x.text === 'Llamar al proveedor'); Whider.State.setDone(t.id, true); });
  ok(await waitFor(A, () => { const t = Whider.State.tasks.find((x) => x.text === 'Llamar al proveedor'); return !!t && t.done; }, null, 6000), 'y la completada en B llega sola a A');

  /* 2. Mientras se escucha no se consulta la nube cada 15 s */
  await countPushes(A); await countPushes(B);
  await sleep(21000);
  const quietos = { A: await pushes(A), B: await pushes(B) };
  ok(quietos.A === 0 && quietos.B === 0, 'escuchando, 21 s sin cambios no consultan la nube ni una vez (antes, cada 15 s)', quietos);

  /* 3. Cuaderno: la página nueva y sus cambios llegan solos */
  const pg = await A.evaluate(() => { const P = Whider.Pages; const m = P.create({ title: 'Ideas', blocks: [P.block('p', 'Primera idea')] }); return { id: m.id, bid: P.content(m.id).blocks[0].id }; });
  ok(await waitFor(B, (x) => !!Whider.Pages.get(x) && Whider.Pages.content(x).blocks.some((bl) => bl.x === 'Primera idea'), pg.id, 10000), 'la página nueva de A llega sola a B, con su contenido');
  // Cuántas transacciones hace B para traer el cambio (cada una lee la nube)
  // (las funciones del paquete de Firebase no se pueden sustituir: se envuelve el objeto que devuelve Auth.sdk())
  await B.evaluate(() => {
    const Au = Whider.Auth, real = Au.sdk(), px = Object.create(real);
    window.__tx = 0;
    Object.defineProperty(px, 'runTransaction', { value: function () { window.__tx++; return real.runTransaction.apply(real, arguments); } });
    Au.sdk = function () { return px; };
  });
  await A.evaluate((x) => { const P = Whider.Pages, c = P.content(x.id); P.setBlocks(x.id, c.blocks.map((bl) => (bl.id === x.bid ? Object.assign({}, bl, { x: 'Primera idea, corregida' }) : bl))); }, pg);
  ok(await waitFor(B, (x) => Whider.Pages.content(x).blocks.some((bl) => bl.x === 'Primera idea, corregida'), pg.id, 10000), 'y lo que A escribe en ella también');
  await sleep(2500);
  const txB = await B.evaluate(() => window.__tx);
  ok(txB === 1, 'B lo trae con una sola lectura del índice (sin volver a sincronizar todo después)', txB);
  // Sin cambios, sincronizar no vuelve a escribir el índice (cada escritura despertaría las escuchas de los demás dispositivos)
  await sleep(1500);
  const idx1 = await get(`users/${uid}/state/pages`);
  await A.evaluate(() => Whider.PageSync.now());
  await A.evaluate(() => Whider.PageSync.now());
  const idx2 = await get(`users/${uid}/state/pages`);
  ok(idx1 && idx2 && idx1.updateTime === idx2.updateTime, 'sin cambios, el índice del Cuaderno no se reescribe', { antes: idx1 && idx1.updateTime, despues: idx2 && idx2.updateTime });

  /* 4. En pausa (como con la app en segundo plano) se vuelve a consultar; al volver se escucha otra vez */
  await B.evaluate(() => Whider.Live.pause());
  ok(await B.evaluate(() => !Whider.Sync.live() && Whider.Live.state()['sync:app'].paused), 'en pausa no se escucha');
  // Como si se estuviera usando B (si no, tras 2 min sin tocarla consulta cada minuto, como en la 1.1)
  await B.evaluate(() => window.dispatchEvent(new Event('pointerdown')));
  await sleep(1000);
  await A.evaluate(() => Whider.State.addTask({ text: 'Escrita con B en pausa' }));
  ok(await waitFor(B, () => Whider.State.tasks.some((t) => t.text === 'Escrita con B en pausa'), null, 25000) && await pushes(B) > 0, 'sin escucha, B vuelve a consultar la nube (cada 15 s) y la recibe', { consultas: await pushes(B) });
  await B.evaluate(() => Whider.Live.resume());
  ok(await waitFor(B, () => Whider.Sync.live() && Whider.Live.state()['sync:app'].live, null, 8000), 'al volver, B escucha de nuevo');
  await A.evaluate(() => Whider.State.addTask({ text: 'Después de volver' }));
  ok(await waitFor(B, () => Whider.State.tasks.some((t) => t.text === 'Después de volver'), null, 6000), 'y lo nuevo vuelve a llegar solo');

  /* 5. Sin el SDK de escuchas (WHIDER_CONFIG.live = false): como antes, consultando cada 15 s */
  const C = await device(b, 'C', { live: false });
  await login(C, 'ana.rt@ejemplo.com');
  ok(await waitFor(C, () => Whider.Sync.status === 'synced', null, 15000) && await C.evaluate(() => !Whider.Auth.liveDb() && !Whider.Sync.live() && !Whider.PageSync.live()), 'sin escuchas: sincroniza y no escucha');
  await A.evaluate(() => Whider.State.addTask({ text: 'Para el dispositivo sin escuchas' }));
  ok(await waitFor(C, () => Whider.State.tasks.some((t) => t.text === 'Para el dispositivo sin escuchas'), null, 25000), 'y aun así le llega (consulta la nube cada 15 s)');
  ok(!C.errs.length, 'sin errores (C)', C.errs);
  await C.context().close();
  // El buzón es uno por cuenta: con otro dispositivo de Ana abierto, el primero que lo lee enseña el aviso (y el otro
  // recibe el ánimo por la sincronización). Para ver los avisos en A, B se cierra
  await B.context().close();

  /* 6. Otra cuenta: solicitud, mensajes y reacciones al momento (sin consultar el buzón ni el chat a mano) */
  const D = await device(b, 'D');
  await register(D, 'Diego', 'diego.rt@ejemplo.com');
  await A.evaluate(() => Whider.People.enable());
  await D.evaluate(() => Whider.People.enable());
  ok(await waitFor(A, () => Whider.People.live(), null, 8000) && await waitFor(D, () => Whider.People.live(), null, 8000), 'los dos escuchan su buzón');
  const codeA = await A.evaluate(() => Whider.State.social.code);
  await D.evaluate((c) => Whider.People.addByCode(c, 'work'), codeA);
  ok(await waitFor(A, () => Whider.People.pendingCount() === 1, null, 8000), 'A recibe la solicitud de Diego al momento');
  const dUid = await D.evaluate(() => Whider.Auth.user.uid);
  await A.evaluate((u) => Whider.People.answer(u, true, 'work'), dUid);
  ok(await waitFor(D, () => { const f = Whider.State.friends()[0]; return !!f && !f.pending; }, null, 8000), 'y Diego ve al momento que la ha aceptado');
  await D.evaluate(() => Whider.Chat.openChat({ uid: Whider.State.friends()[0].uid }));
  ok(await waitFor(D, () => Whider.State.activeScreen === 'chats' && !!Whider.State.ui.chat, null, 8000), 'Diego abre el chat con Ana');
  // Los avisos que salen en A (para ver que un mensaje avisa una sola vez)
  await A.evaluate(() => { const T = Whider.Toast, o = T.show; window.__avisos = []; T.show = function (x) { window.__avisos.push(String((x && x.text) || '')); return o.apply(this, arguments); }; });
  await D.evaluate(() => Whider.Chat.send(Whider.State.ui.chat, { text: 'Hola Ana, ¿tienes un momento?' }));
  ok(await waitFor(A, () => Whider.Chat.unreadCount() === 1, null, 8000), 'A ve el chat sin leer al momento (sin abrir Chats)');
  // El aviso del buzón llega después: no debe repetir el de la escucha
  await sleep(3500);
  const avisos = await A.evaluate(() => window.__avisos.filter((t) => /^Diego: Hola Ana/.test(t)));
  ok(avisos.length === 1, 'un mensaje, un solo aviso (aunque llegue por la escucha y por el buzón)', avisos);
  await A.evaluate(() => Whider.Router.go('chats'));
  await sleep(800);
  await A.click('#screen-chats .ct-row');
  ok(await waitFor(A, () => Whider.Chat.live() && /tienes un momento/.test((document.querySelector('#screen-chats .ct-msgs') || {}).textContent || ''), null, 8000), 'A abre el chat, lo escucha y ve el mensaje');
  await D.evaluate(() => Whider.Chat.send(Whider.State.ui.chat, { text: 'Es sobre el presupuesto' }));
  ok(await waitFor(A, () => /sobre el presupuesto/.test((document.querySelector('#screen-chats .ct-msgs') || {}).textContent || ''), null, 6000), 'el segundo mensaje aparece solo en el chat abierto de A');
  ok(await waitFor(A, () => Whider.Chat.unreadCount() === 0, null, 4000), 'y queda leído');
  await A.evaluate(() => { const c = Whider.State.ui.chat, m = Whider.Chat.messages(c).filter((x) => x.by !== Whider.Chat.me()).pop(); Whider.Chat.react(c, m.id, 'like'); });
  ok(await waitFor(D, () => Whider.Chat.messages(Whider.State.ui.chat).some((m) => m.react && Object.values(m.react).indexOf('like') >= 0), null, 6000), 'Diego ve la reacción de Ana al momento');
  // Un ánimo: el buzón se lee y se vacía (con los avisos de mensajes que se habían quedado) sin repetir avisos
  const enviado = await D.evaluate(() => Whider.People.cheer(Whider.State.friends()[0], '¡Vamos, que llegamos!').then(() => Whider.State.meta.cheersSent || 0));
  ok(await waitFor(A, () => window.__avisos.some((t) => /Vamos, que llegamos/.test(t)), null, 8000), 'el ánimo de Diego llega al momento',
    { enviados: enviado, ana: await A.evaluate(() => ({ animos: Whider.State.social.cheers.map((c) => c.text), avisos: window.__avisos, buzon: Whider.Live.state().inbox })) });
  await sleep(1500);
  const deMensajes = await A.evaluate(() => window.__avisos.filter((t) => /^Diego: (Hola Ana|Es sobre)/.test(t)));
  ok(deMensajes.length === 1, 'al vaciar el buzón no se repiten los avisos de mensajes ya vistos', deMensajes);
  ok(await A.evaluate(() => { const F = Whider.Auth.sdk(); return F.getDoc(F.doc(Whider.Auth.db(), 'inbox', Whider.Auth.user.uid)).then((s) => Object.keys((s.data() || {}).pings || {}).length === 0); }), 'y el buzón queda vacío');

  ok(!A.errs.length && !B.errs.length && !D.errs.length, 'sin errores', A.errs.concat(B.errs, D.errs));
  await b.close();
  console.log(fails ? fails + ' FALLOS' : 'TODO OK');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
