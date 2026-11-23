// 1.1 · Datos (emuladores): dos dispositivos de la misma cuenta cambian a la vez campos distintos de la
// misma tarea y se conservan los dos cambios; sin conexión los cambios quedan marcados y se suben solos al
// volver; un documento demasiado grande se explica y se arregla archivando lo completado hace tiempo; y un
// mismo bloque del Cuaderno editado a la vez en dos sitios conserva las dos versiones.
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
const get = async (p) => { const r = await fetch(`${FS}/v1/projects/${PROJECT}/databases/(default)/documents/${p}`, { headers: { Authorization: 'Bearer owner' } }); return r.status === 200 ? r.json() : null; };
const list = async (p) => { const r = await (await fetch(`${FS}/v1/projects/${PROJECT}/databases/(default)/documents/${p}?pageSize=300`, { headers: { Authorization: 'Bearer owner' } })).json(); return r.documents || []; };
async function waitFor(p, fn, arg, ms) {
  const end = Date.now() + (ms || 20000);
  while (Date.now() < end) {
    try { if (await p.evaluate(fn, arg)) return true; } catch (e) { /* recargando */ }
    await sleep(400);
  }
  return false;
}
async function device(b, label) {
  const ctx = await b.newContext({ viewport: { width: 1280, height: 860 } });
  await ctx.addInitScript((c) => { window.WHIDER_CONFIG = c; }, cfg);
  await ctx.addInitScript(simular);
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
  await entrar(p, email, name);
  await afterAuth(p);
}
async function login(p, email) {
  await entrar(p, email);
  await afterAuth(p);
}
const push = (p) => p.evaluate(() => Whider.Sync.push());

(async () => {
  await fetch(`${EMU}/emulator/v1/projects/${PROJECT}/accounts`, { method: 'DELETE' });
  await fetch(`${FS}/emulator/v1/projects/${PROJECT}/databases/(default)/documents`, { method: 'DELETE' });
  const b = await chromium.launch();
  const A = await device(b, 'A'), B = await device(b, 'B');
  await register(A, 'Ana', 'ana.sync@ejemplo.com');
  await login(B, 'ana.sync@ejemplo.com');
  ok(await waitFor(A, () => Whider.Sync.status === 'synced') && await waitFor(B, () => Whider.Sync.status === 'synced'), 'los dos dispositivos sincronizan con la misma cuenta');
  const uid = await A.evaluate(() => Whider.Sync.uid());

  /* 1. Cambios a la vez en campos distintos de la misma tarea */
  const id = await A.evaluate(() => Whider.State.addTask({ text: 'Informe trimestral', date: Whider.U.today() }).id);
  await push(A);
  await push(B);
  ok(await waitFor(B, (x) => !!Whider.State.find(x), id), 'la tarea creada en A llega a B');
  const manana = await A.evaluate(() => Whider.U.addDays(Whider.U.today(), 1));
  // Sin sincronizar entre medias: A le cambia la fecha y B la completa
  await Promise.all([
    A.evaluate((x) => { Whider.Sync.stop(); Whider.State.updateTask(x, { date: Whider.U.addDays(Whider.U.today(), 1) }); }, id),
    B.evaluate((x) => { Whider.Sync.stop(); Whider.State.setDone(x, true); }, id)
  ]);
  await A.evaluate(() => Whider.Sync.restart());
  await B.evaluate(() => Whider.Sync.restart());
  await sleep(1500);
  await push(A);
  await push(B);
  await push(A);
  const ra = await A.evaluate((x) => { const t = Whider.State.find(x); return t && { date: t.date, done: t.done }; }, id);
  const rb = await B.evaluate((x) => { const t = Whider.State.find(x); return t && { date: t.date, done: t.done }; }, id);
  ok(ra && rb && ra.date === manana && rb.date === manana && ra.done && rb.done, 'cambios a la vez: los dos acaban con la fecha de A y la tarea completada en B', { ra, rb });

  /* 2. Sin conexión: quedan marcados y se suben al volver */
  await B.context().setOffline(true);
  await B.evaluate(() => { window.dispatchEvent(new Event('offline')); Whider.State.addTask({ text: 'Escrita sin conexión' }); });
  await sleep(1800);
  const off = await B.evaluate(() => ({ st: Whider.Sync.status, unsaved: Whider.Sync.unsaved(), attr: document.documentElement.getAttribute('data-sync'), text: Whider.Sync.statusText(), lateral: getComputedStyle(document.querySelector('.sb-profile .me-av'), '::after').content !== 'none' && /sin guardar/.test(document.querySelector('.sb-profile').textContent) }));
  ok(off.st === 'offline' && off.unsaved && off.attr === 'offline' && /Sin conexión/.test(off.text), 'sin conexión: estado claro y cambios marcados como pendientes', off);
  ok(off.lateral, 'tu foto en la barra lateral avisa de los cambios sin subir');
  await B.context().setOffline(false);
  await B.evaluate(() => window.dispatchEvent(new Event('online')));
  ok(await waitFor(B, () => Whider.Sync.status === 'synced' && !Whider.Sync.pendingSince, null, 20000), 'al volver la conexión se suben solos y desaparece el aviso');
  await push(A);
  ok(await waitFor(A, () => Whider.State.tasks.some((t) => t.text === 'Escrita sin conexión')), 'y llegan al otro dispositivo');

  /* 3. Demasiado grande para la nube: se explica, nada se rompe y archivando vuelve a caber */
  const antes = await get(`users/${uid}/state/app`);
  await A.evaluate(() => {
    const S = Whider.State, nota = 'x'.repeat(1900);
    for (let i = 0; i < 560; i++) S.addTask({ text: 'Pendiente ' + i, notes: nota });
    S.notify('update');
  });
  await sleep(2500);
  await push(A);
  const big = await A.evaluate(() => ({ st: Whider.Sync.status, kind: Whider.Sync.lastError && Whider.Sync.lastError.kind, text: Whider.Sync.statusText(), unsaved: Whider.Sync.unsaved() }));
  ok(big.st === 'error' && big.kind === 'size' && /1 MB/.test(big.text) && big.unsaved, 'más de 1 MB: error claro (tamaño) y los cambios siguen marcados', big);
  const igual = await get(`users/${uid}/state/app`);
  ok(antes && igual && antes.updateTime === igual.updateTime, 'no se intenta escribir un documento que la nube rechazaría');
  // Las 560 pasan a estar completadas hace casi dos años: al sincronizar se archivan solas
  await A.evaluate(() => {
    const S = Whider.State, viejo = Date.now() - 700 * 86400000;
    S.tasks.filter((t) => /^Pendiente /.test(t.text)).forEach((t) => { t.done = true; t.doneOn = '2025-01-10'; t.doneAt = viejo; t.updatedAt = Date.now(); });
    S.notify('update');
  });
  await sleep(1500);
  await push(A);
  ok(await waitFor(A, () => Whider.Sync.status === 'synced', null, 25000), 'archivando lo completado hace tiempo, vuelve a sincronizar');
  const arch = await A.evaluate(() => ({ n: Whider.State.archived().length, quedan: Whider.State.tasks.filter((t) => /^Pendiente /.test(t.text)).length, size: Whider.Sync.size }));
  ok(arch.n >= 560 && arch.quedan === 0 && arch.size < 1000000, 'las 560 están en el archivo y la copia vuelve a caber', arch);
  // El archivo de la nube se sube aparte (varios documentos): se espera a que esté entero
  let meses = [], enNube = 0;
  for (let i = 0; i < 60 && enNube < 560; i++) {
    await sleep(500);
    meses = await list(`users/${uid}/archive`);
    enNube = meses.reduce((n, d) => n + ((((d.fields || {}).tasks || {}).arrayValue || {}).values || []).length, 0);
  }
  ok(meses.length >= 1 && enNube >= 560, 'y también en el archivo de la nube (por meses, en varios documentos)', { docs: meses.length, enNube, pendiente: await A.evaluate(() => Whider.State.meta.archivePending) });
  await push(B);
  ok(await waitFor(B, () => !Whider.State.tasks.some((t) => /^Pendiente /.test(t.text)), null, 20000), 'el otro dispositivo respeta el archivo (no las devuelve a la copia)');

  /* 4. Cuaderno: el mismo bloque editado a la vez en los dos dispositivos */
  const pg = await A.evaluate(() => { const P = Whider.Pages; const m = P.create({ title: 'Acta', blocks: [P.block('p', 'Texto inicial')] }); return { id: m.id, bid: P.content(m.id).blocks[0].id }; });
  await A.evaluate(() => Whider.PageSync.now());
  await sleep(1000);
  await B.evaluate(() => Whider.PageSync.now());
  ok(await waitFor(B, (x) => !!Whider.Pages.get(x) && Whider.Pages.content(x).blocks.length === 1, pg.id, 15000), 'la página de A llega a B');
  await sleep(300);
  const edit = (p, texto) => p.evaluate(({ x, texto }) => {
    const P = Whider.Pages, c = P.content(x.id);
    P.setBlocks(x.id, c.blocks.map((bl) => (bl.id === x.bid ? Object.assign({}, bl, { x: texto }) : bl)));
  }, { x: pg, texto });
  await edit(A, 'Versión de A');
  await sleep(50);
  await edit(B, 'Versión de B');
  await A.evaluate(() => Whider.PageSync.now());
  await sleep(800);
  await B.evaluate(() => Whider.PageSync.now());
  await sleep(800);
  await A.evaluate(() => Whider.PageSync.now());
  await sleep(1000);
  const bloques = (p) => p.evaluate((x) => Whider.Pages.content(x).blocks.map((bl) => ({ t: bl.t, x: bl.x })), pg.id);
  const ba = await bloques(A), bb = await bloques(B);
  const ambas = (bs) => bs.length === 2 && bs[0].x === 'Versión de B' && bs[1].t === 'callout' && /Versión de A/.test(bs[1].x);
  ok(ambas(ba) && ambas(bb), 'el mismo bloque editado a la vez: queda la versión más reciente y debajo la otra, en los dos', { ba, bb });

  ok(!A.errs.length && !B.errs.length, 'sin errores', A.errs.concat(B.errs));
  await b.close();
  console.log(fails ? fails + ' FALLOS' : 'TODO OK');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
