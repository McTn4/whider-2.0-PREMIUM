// Accesibilidad (axe-core, WCAG 2.1 A/AA) en todas las pantallas, Ajustes y hojas, en móvil y ordenador
const { chromium, devices } = require('playwright');
const { APP, AXE: AXE_RUTA, axePrep } = require('./_util');
const fs = require('fs');
const AXE = fs.readFileSync(AXE_RUTA, 'utf8');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const summary = {};
async function audit(p, label) {
  await axePrep(p);
  await p.evaluate(AXE);
  const r = await p.evaluate(async () => {
    const res = await axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] }, resultTypes: ['violations'] });
    return res.violations.map(v => ({ id: v.id, impact: v.impact, n: v.nodes.length, help: v.help, ex: v.nodes.slice(0, 3).map(n => n.target.join(' ') + ' :: ' + (n.failureSummary || '').split('\n').slice(1, 2).join('')) }));
  });
  for (const v of r) { const k = v.id; summary[k] = summary[k] || { help: v.help, impact: v.impact, where: [] }; summary[k].where.push(label + ' (' + v.n + ')'); if (summary[k].where.length <= 2) summary[k].ex = (summary[k].ex || []).concat(v.ex); }
}
async function run(label, opts) {
  const b = await chromium.launch(); const ctx = await b.newContext(opts);
  await ctx.addInitScript(() => { window.WHIDER_CONFIG = { firebase: null }; localStorage.setItem('whider.meta.v1', JSON.stringify({ onboarded: true, createdAt: Date.now() - 9e8 })); });
  const p = await ctx.newPage(); await p.goto(APP); await sleep(1800);
  await p.evaluate(() => { const S = Whider.State, U = Whider.U, td = U.today(); [['Enviar el presupuesto', '10:00', 'danger'], ['Revisar el informe', '12:30', 'purple'], ['Leer', null, 'none']].forEach(x => S.addTask({ text: x[0], date: td, time: x[1], highlight: x[2], listId: 'work' })); S.addHabit({ name: 'Beber agua', icon: 'leaf' }); });
  for (const id of ['home', 'tasks', 'calendar', 'notes', 'habits', 'focus', 'stats', 'reports', 'automations', 'friends', 'chats', 'progress', 'more']) {
    await p.evaluate(id => Whider.Router.go(id), id); await sleep(500); await audit(p, label + ':' + id);
  }
  for (const pg of [null, 'appearance', 'custom', 'alerts', 'data', 'privacy']) {
    await p.evaluate(() => { while (Whider.Sheet.closeTop()); }); await sleep(450);
    await p.evaluate(pg => Whider.Settings.open(pg || undefined), pg); await sleep(600); await audit(p, label + ':ajustes-' + (pg || 'portada'));
  }
  await p.evaluate(() => { while (Whider.Sheet.closeTop()); }); await sleep(450);
  await p.evaluate(() => Whider.QuickAdd.open({})); await sleep(600); await audit(p, label + ':nueva-tarea');
  await p.evaluate(() => { while (Whider.Sheet.closeTop()); }); await sleep(450);
  await p.evaluate(() => Whider.Character.edit()); await sleep(700); await audit(p, label + ':personaje');
  await b.close();
}
(async () => {
  await run('movil', Object.assign({}, devices['Pixel 7'], { deviceScaleFactor: 1 }));
  await run('pc', { viewport: { width: 1440, height: 900 } });
  const keys = Object.keys(summary);
  for (const k of keys) { const s = summary[k]; console.log(`\n[${s.impact}] ${k}: ${s.help}\n  en: ${s.where.slice(0, 8).join(', ')}${s.where.length > 8 ? ' …(' + s.where.length + ')' : ''}\n  ej: ${(s.ex || []).slice(0, 3).join('\n      ')}`); }
  console.log('\nreglas incumplidas:', keys.length);
  process.exit(keys.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
