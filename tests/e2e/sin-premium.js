// 1.0 · Sin Premium: recorre todas las pantallas y hojas (móvil y ordenador) y comprueba que no
// queda ni rastro de Premium/planes, que no hay errores y que lo antes bloqueado funciona.
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
  // Migración
  const mig = await p.evaluate(() => ({ plan: localStorage.getItem('whider.plan.v1'), pend: localStorage.getItem('whider.payPending'), hasPlan: 'plan' in Whider.State, W: typeof Whider.Plan, body: Whider.Character.config().body, raw: Whider.State.character.body, name: Whider.Character.config().name, tone: Whider.Character.config().tone, frame: Whider.Character.config().frame }));
  ok(mig.plan === null && mig.pend === null, label + ': se borran las claves antiguas de plan y pago');
  ok(!mig.hasPlan && mig.W === 'undefined', label + ': no existe W.Plan ni State.plan');
  ok(mig.body === 'gota' && mig.raw === undefined && mig.name === 'Draco', label + ': el personaje Premium pasa al de siempre y conserva su nombre (' + JSON.stringify(mig) + ')');
  ok(mig.tone === 'holo' && mig.frame === 'diamante', label + ': acabados y marcos que eran Premium quedan disponibles');
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
  for (const page of ['appearance', 'custom', 'sounds', 'alerts', 'tasks', 'habits', 'focus', 'start', 'privacy', 'data']) {
    await p.evaluate(() => { while (Whider.Sheet.closeTop()); }); await sleep(600);
    await p.evaluate(pg => Whider.Settings.open(pg), page); await sleep(500);
    t = await p.evaluate(() => document.querySelector('.sheet-root').innerText);
    const m = t.match(/.{0,30}(premium|desbloquear|plan gratuito).{0,30}/i);
    ok(!m, label + ': Ajustes → ' + page + (m ? ' → «' + m[0] + '»' : ''));
    if (page === 'custom' && desk) ok(/Barra lateral/i.test(t) && /Lateral de Hoy/i.test(t), label + ': Personalización completa sin pagar');
  }
  // 7 toques en la versión: ya no abren nada
  await p.evaluate(() => Whider.Sheet.closeTop()); await sleep(250);
  await p.evaluate(() => Whider.Settings.open()); await sleep(500);
  for (let i = 0; i < 8; i++) { await p.click('.sheet-root .version'); await sleep(60); }
  await sleep(400);
  t = await p.evaluate(() => document.querySelector('.sheet-root').innerText);
  ok(!/propietario|fundador/i.test(t), label + ': los 7 toques ya no abren opciones ocultas');
  await p.evaluate(() => { while (Whider.Sheet.closeTop()); }); await sleep(300);
  // Editor del personaje: ni candados ni especies Premium
  await p.evaluate(() => Whider.Character.edit()); await sleep(700);
  const ed = await p.evaluate(() => ({ txt: document.querySelector('.sheet-root').innerText, locks: document.querySelectorAll('.be-lock,.be-star,.be-opt.locked').length }));
  ok(!/Dragón|Astronauta|Fénix|Unicornio|\bGema\b/.test(ed.txt) && ed.locks === 0, label + ': editor sin personajes Premium ni candados');
  await p.evaluate(() => { while (Whider.Sheet.closeTop()); }); await sleep(300);
  // Lo antes bloqueado ahora funciona
  const fx = await p.evaluate(() => {
    const S = Whider.State, out = {};
    for (let i = 0; i < 5; i++) S.saveFilter({ name: 'Filtro ' + i, lists: [], priorities: [], when: 'any', text: '', status: 'pending' });
    out.filters = S.filters.length;
    Whider.Auto.TEMPLATES.slice(0, 4).forEach(tp => S.saveRule(Object.assign({ name: tp.name, enabled: true, template: tp.id }, JSON.parse(JSON.stringify(tp.rule)))));
    out.active = Whider.Auto.activeRules().length;
    return out;
  });
  ok(fx.filters >= 5, label + ': más de 3 filtros guardados (' + fx.filters + ')');
  ok(fx.active >= 4, label + ': más de 2 reglas activas a la vez (' + fx.active + ')');
  await p.evaluate(() => Whider.Router.go('automations')); await sleep(500);
  await p.click('.sys-card button >> nth=0'); await sleep(600);
  ok(await p.evaluate(() => !!(Whider.State.meta.systems || {}).gtd), label + ': se instala un sistema profesional');
  if (desk) {
    await p.evaluate(() => { Whider.State.ui.taskLayout = 'board'; Whider.Router.go('tasks'); Whider.Sidebar.openView({ type: 'list', id: 'personal' }); }); await sleep(700);
    ok(await p.evaluate(() => !!document.querySelector('#screen-tasks .board')), label + ': vista de tablero disponible');
    await p.evaluate(() => { Whider.State.ui.taskLayout = 'list'; });
    await p.evaluate(() => { Whider.State.ui.statsRange = 365; Whider.Router.go('stats'); }); await sleep(700);
    ok(await p.evaluate(() => /Por hora del día/.test(document.querySelector('#screen-stats').innerText) && /12 meses/.test(document.querySelector('#screen-stats').innerText)), label + ': estadísticas de 12 meses y apartados avanzados');
    await p.evaluate(() => Whider.Router.go('reports')); await sleep(500);
    await p.click('#screen-reports .seg button:has-text("Este año"), #screen-reports button:has-text("Este año")'); await sleep(600);
    const rp = await p.evaluate(() => document.querySelector('#screen-reports').innerText);
    ok(/1 de enero/.test(rp) || /Del 1 de enero/.test(rp), label + ': informe de «Este año» sin bloqueo');
    const sb = await p.evaluate(() => document.getElementById('sidebar').innerText);
    ok(!BAD.test(sb), label + ': barra lateral sin Premium');
    await p.evaluate(() => Whider.Palette.open()); await sleep(400);
    await p.keyboard.type('plan'); await sleep(300);
    const pal = await p.evaluate(() => document.body.innerText);
    ok(!/Planes y precios/.test(pal), label + ': la paleta ya no ofrece «Planes y precios»');
    await p.keyboard.press('Escape');
  }
  // Dispositivos y plantillas de un toque
  await p.evaluate(() => Whider.Devices.sheet()); await sleep(500);
  ok(await p.evaluate(() => /Mis dispositivos/.test(document.querySelector('.sheet-root').innerText)), label + ': «Mis dispositivos» se abre sin pagar');
  await p.evaluate(() => { while (Whider.Sheet.closeTop()); }); await sleep(300);
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
