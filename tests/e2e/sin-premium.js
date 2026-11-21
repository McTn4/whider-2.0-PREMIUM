// 1.0 · Sin Premium: recorre todas las pantallas y hojas (móvil y ordenador) y comprueba que no
// queda ni rastro de Premium/planes, que no hay errores y que lo antes bloqueado funciona (filtros y tablero).
// Las rutas de lo que se quitó en el rediseño (hábitos, enfoque, estadísticas…) llevan a otra pantalla sin fallar.
const { chromium, devices } = require('playwright');
const { APP } = require('./_util');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const URL = APP;
let fails = 0;
const ok = (c, m) => { console.log((c ? 'OK   ' : 'FAIL ') + m); if (!c) fails++; };
const BAD = /premium|hazte|planes y precios|suscrib|plan gratuito|desbloquear|\bplan\b/i;
async function run(label, ctxOpts, desk) {
  const b = await chromium.launch();
  const ctx = await b.newContext(Object.assign({ deviceScaleFactor: 1 }, ctxOpts));
  await ctx.addInitScript(() => {
    window.WHIDER_CONFIG = { firebase: null };
    if (!localStorage.getItem('whider.meta.v1')) localStorage.setItem('whider.meta.v1', JSON.stringify({ onboarded: true, createdAt: Date.now() - 20 * 86400000 }));
    // Datos de versiones anteriores: plan Premium y un personaje Premium guardados
    if (!localStorage.getItem('whider.plan.v1')) localStorage.setItem('whider.plan.v1', JSON.stringify({ tier: 'premium', source: 'code', until: null, at: 1 }));
    if (!localStorage.getItem('whider.character.v1')) localStorage.setItem('whider.character.v1', JSON.stringify({ name: 'Draco', body: 'dragon', tone: 'holo', fx: 'aura', frame: 'diamante', at: 5 }));
    localStorage.setItem('whider.payPending', String(Date.now() + 60000));
  });
  const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', e => errs.push('pageerror: ' + e.message));
  p.on('console', m => { if (m.type() === 'error' && !/favicon|net::ERR|Failed to load resource/.test(m.text())) errs.push('console: ' + m.text()); });
  await p.goto(URL); await sleep(1800);
  // Migración: las claves de plan y pago se borran; el personaje guardado se conserva en los datos (ya no se enseña)
  const mig = await p.evaluate(() => ({ plan: localStorage.getItem('whider.plan.v1'), pend: localStorage.getItem('whider.payPending'), hasPlan: 'plan' in Whider.State, W: typeof Whider.Plan, ch: typeof Whider.Character, name: Whider.State.character && Whider.State.character.name }));
  ok(mig.plan === null && mig.pend === null, label + ': se borran las claves antiguas de plan y pago');
  ok(!mig.hasPlan && mig.W === 'undefined', label + ': no existe W.Plan ni State.plan');
  ok(mig.ch === 'undefined' && mig.name === 'Draco', label + ': sin personaje en la app, pero sus datos se conservan (' + JSON.stringify(mig) + ')');
  const screens = ['home', 'tasks', 'calendar', 'notes', 'chats', 'friends', 'habits', 'focus', 'automations', 'stats', 'reports', 'more', 'progress', 'plans'];
  for (const id of screens) {
    await p.evaluate(id => Whider.Router.go(id), id); await sleep(450);
    const r = await p.evaluate(() => ({ cur: Whider.State.activeScreen, txt: document.body.innerText }));
    if (id === 'plans') ok(r.cur === 'home', label + ': #plans ya no existe y lleva a Hoy');
    const m = r.txt.match(/.{0,30}(premium|hazte|planes y precios|suscrib|plan gratuito|desbloquear).{0,30}/i);
    ok(!m, label + ': ' + id + ' sin rastro de Premium' + (m ? ' → «' + m[0] + '»' : ''));
  }
  // Ajustes (todas las páginas)
  await p.evaluate(() => Whider.Settings.open()); await sleep(600);
  let t = await p.evaluate(() => document.querySelector('.sheet-root').innerText);
  ok(!BAD.test(t), label + ': portada de Ajustes sin plan' + (BAD.test(t) ? ' → ' + t.match(/.{0,30}(premium|plan).{0,30}/i)[0] : ''));
  ok(/WHIDER \d/.test(t), label + ': línea de versión visible');
  for (const page of ['appearance', 'custom', 'sounds', 'alerts', 'tasks', 'start', 'privacy', 'data']) {
    await p.evaluate(() => { while (Whider.Sheet.closeTop()); }); await sleep(600);
    await p.evaluate(pg => Whider.Settings.open(pg), page); await sleep(500);
    t = await p.evaluate(() => document.querySelector('.sheet-root').innerText);
    const m = t.match(/.{0,30}(premium|desbloquear|plan gratuito).{0,30}/i);
    ok(!m, label + ': Ajustes → ' + page + (m ? ' → «' + m[0] + '»' : ''));
    if (page === 'custom' && desk) ok(/Barra lateral/i.test(t) && /Calendario/i.test(t), label + ': «Lo que ves» completo sin pagar');
  }
  // 7 toques en la versión: ya no abren nada
  await p.evaluate(() => Whider.Sheet.closeTop()); await sleep(250);
  await p.evaluate(() => Whider.Settings.open()); await sleep(500);
  for (let i = 0; i < 8; i++) { await p.click('.sheet-root .version'); await sleep(60); }
  await sleep(400);
  t = await p.evaluate(() => document.querySelector('.sheet-root').innerText);
  ok(!/propietario|fundador/i.test(t), label + ': los 7 toques ya no abren opciones ocultas');
  await p.evaluate(() => { while (Whider.Sheet.closeTop()); }); await sleep(300);
  // Lo antes bloqueado ahora funciona
  const fx = await p.evaluate(() => {
    const S = Whider.State, out = {};
    for (let i = 0; i < 5; i++) S.saveFilter({ name: 'Filtro ' + i, lists: [], priorities: [], when: 'any', text: '', status: 'pending' });
    out.filters = S.filters.length;
    return out;
  });
  ok(fx.filters >= 5, label + ': más de 3 filtros guardados (' + fx.filters + ')');
  if (desk) {
    await p.evaluate(() => { Whider.State.ui.taskLayout = 'board'; Whider.Router.go('tasks'); Whider.Sidebar.openView({ type: 'list', id: 'personal' }); }); await sleep(700);
    ok(await p.evaluate(() => !!document.querySelector('#screen-tasks .board')), label + ': vista de tablero disponible');
    await p.evaluate(() => { Whider.State.ui.taskLayout = 'list'; });
    const sb = await p.evaluate(() => document.getElementById('sidebar').innerText);
    ok(!BAD.test(sb), label + ': barra lateral sin Premium');
    await p.evaluate(() => Whider.Palette.open()); await sleep(400);
    await p.keyboard.type('plan'); await sleep(300);
    const pal = await p.evaluate(() => document.body.innerText);
    ok(!/Planes y precios/.test(pal), label + ': la paleta ya no ofrece «Planes y precios»');
    await p.keyboard.press('Escape');
  }
  console.log(label, 'errores:', JSON.stringify(errs));
  ok(errs.length === 0, label + ': sin errores en la consola');
  await b.close();
}
(async () => {
  await run('pc', { viewport: { width: 1440, height: 900 } }, true);
  await run('movil', Object.assign({}, devices['Pixel 7']), false);
  console.log(fails ? 'FALLOS: ' + fails : 'TODO OK');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
