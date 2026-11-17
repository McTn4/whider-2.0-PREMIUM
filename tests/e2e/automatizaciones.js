// Sistemas y automatizaciones: plantillas sin límite, reglas al crear/completar/vencer/diarias y sistemas
const { chromium } = require('playwright');
const { APP } = require('./_util');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const results = []; let failed = 0;
const ok = (name, cond, extra) => { results.push((cond ? 'OK   ' : 'FAIL ') + name + (extra !== undefined ? '  → ' + JSON.stringify(extra) : '')); if (!cond) failed++; };
const URL = process.argv[2] || APP;
const SHOTS = process.argv[3] || null;
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.addInitScript(() => { window.WHIDER_CONFIG = { firebase: null }; localStorage.setItem('whider.meta.v1', JSON.stringify({ onboarded: true, createdAt: Date.now(), seenAchievements: [], levelSeen: 1 })); });
  const p = await ctx.newPage(); p.setDefaultTimeout(5000);
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  p.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
  await p.goto(URL); await sleep(1900);
  await p.evaluate(() => { Whider.Notify.check = function () {}; });
  await p.evaluate(() => Whider.Router.go('automations')); await sleep(400);
  ok('ir a Sistemas', await p.evaluate(() => Whider.State.activeScreen) === 'automations');
  ok('7 sistemas en la galería', await p.evaluate(() => document.querySelectorAll('#screen-automations .sys-card').length) === 7);
  // Plantilla: lo nuevo sin fecha para hoy
  await p.click('#screen-automations .cell:has-text("Lo nuevo sin fecha") label.switch'); await sleep(300);
  const t1 = await p.evaluate(() => { const t = Whider.State.addTask({ text: 'Sin fecha', date: null, listId: 'personal' }); return Whider.State.find(t.id).date; });
  ok('al crear sin fecha pasa a hoy', t1 === await p.evaluate(() => Whider.U.today()), t1);
  // Plantilla: avisos en lo urgente
  await p.click('#screen-automations .cell:has-text("Avisos en lo urgente") label.switch'); await sleep(300);
  const w = await p.evaluate(() => { const t = Whider.State.addTask({ text: 'Urgente', date: Whider.U.today(), highlight: 'danger', warn: false, listId: 'work' }); return Whider.State.find(t.id).warn; });
  ok('lo urgente nace con avisos', w === true);
  // 1.0: sin límite de automatizaciones activas
  await p.click('#screen-automations .cell:has-text("Pasar lo vencido a hoy") label.switch'); await sleep(400);
  ok('tercera automatización sin ventana de pago', await p.evaluate(() => !document.querySelector('.sheet.paywall')));
  ok('3 reglas activas a la vez', await p.evaluate(() => Whider.State.rules.filter(r => r.enabled).length) === 3);
  // Instalar sistemas (gratis)
  const dismiss = () => Promise.resolve(); // 8.0: ya no hay celebraciones que cerrar
  await p.click('#screen-automations .sys-card:has-text("GTD") .btn'); await sleep(900); await dismiss(); await sleep(300);
  const gtd = await p.evaluate(() => ({ lists: Whider.State.lists.map(l => l.name), filters: Whider.State.filters.map(f => f.name), habits: Whider.State.habits.map(h => h.name) }));
  ok('GTD crea sus categorías, filtro y hábito', gtd.lists.includes('Bandeja de entrada') && gtd.filters.includes('Próximas acciones') && gtd.habits.includes('Revisión semanal'), gtd);
  const inbox = await p.evaluate(() => { const t = Whider.State.addTask({ text: 'Idea suelta', date: null, listId: null }); return Whider.State.getList(Whider.State.find(t.id).listId).name; });
  ok('regla GTD: lo nuevo sin categoría va a la bandeja', inbox === 'Bandeja de entrada', inbox);
  await dismiss(); await p.click('#screen-automations .sys-card:has-text("Bandeja a cero") .btn'); await sleep(900); await dismiss(); await sleep(300);
  // Regla diaria (vencidas → hoy): se pone al día al abrir
  const moved = await p.evaluate(async () => {
    const S = Whider.State, U = Whider.U;
    const t = S.addTask({ text: 'Vieja', date: U.addDays(U.today(), -3), listId: 'personal' });
    localStorage.removeItem('whider.autolog.v1');
    const r = S.rules.find(x => x.name === 'Bandeja a cero · Vencidas a hoy'); r.trigger.time = '00:00';
    return t.id;
  });
  await p.evaluate(() => document.dispatchEvent(new Event('visibilitychange'))); await sleep(1400);
  ok('la regla diaria pasa lo vencido a hoy', await p.evaluate(id => Whider.State.find(id).date === Whider.U.today(), moved));
  // Regla propia con el editor
  await dismiss(); await sleep(300);
  await p.click('#screen-automations .nav-trail button'); await sleep(450);
  await p.fill('.rule-editor input.cell-input.title', 'Trabajo importante');
  await p.click('.rule-editor .cell:has-text("Añadir condición")'); await sleep(250);
  if (SHOTS) await p.screenshot({ path: SHOTS + '/d-rule-editor.png' });
  await p.click('.rule-editor .sheet-foot .btn.primary'); await sleep(400);
  ok('regla propia guardada', await p.evaluate(() => Whider.State.rules.some(r => r.name === 'Trabajo importante')));
  await p.keyboard.press('Escape'); await sleep(200);
  if (SHOTS) await p.screenshot({ path: SHOTS + '/d-systems.png' });
  ok('historial con ejecuciones', await p.evaluate(() => Whider.Auto.log().length) >= 3);
  ok('sin errores', errs.length === 0, errs.slice(0, 5));
  await b.close();
  console.log(results.join('\n'));
  console.log(failed ? '\n' + failed + ' FALLOS' : '\nTODO OK');
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
