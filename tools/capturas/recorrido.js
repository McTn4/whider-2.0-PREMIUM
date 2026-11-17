// Recorrido por todas las pantallas (ordenador y móvil) con datos de ejemplo locales → capturas para
// revisar el diseño de un vistazo. Necesita la app servida (python3 serve.py 8642, o WHIDER_URL).
//   node tools/capturas/recorrido.js [carpeta] [pc|movil]   (por defecto tests/e2e/logs/capturas/recorrido)
const { chromium, devices } = require('playwright');
const path = require('path'), fs = require('fs');
const U = require('../../tests/e2e/_util');
const OUT = process.argv[2] || path.join(U.OUT, 'recorrido'), ONLY = process.argv[3];
fs.mkdirSync(OUT, { recursive: true });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const FX = U.FX;
async function seed(p) {
  await p.evaluate(() => {
    const S = Whider.State, U = Whider.U, td = U.today(), tm = U.addDays(td, 1);
    if (S.tasks.length) return;
    const work = S.addList('Trabajo', 'iris', 'briefcase'), home = S.addList('Casa', 'iris', 'home');
    [['Enviar el presupuesto al cliente', td, '10:00', 'danger', work.id], ['Revisar el informe trimestral', td, '12:30', 'purple', work.id], ['Comprar pan y fruta', td, null, 'none', home.id],
     ['Llamar al fontanero', td, '18:00', 'star', home.id], ['Preparar la reunión del lunes', tm, '09:30', 'purple', work.id], ['Renovar el pasaporte', U.addDays(td, 4), null, 'danger', null],
     ['Leer 20 páginas', td, '21:30', 'none', null]].forEach(x => S.addTask({ text: x[0], date: x[1], time: x[2], highlight: x[3], listId: x[4] }));
    const done = S.tasks[2]; S.setDone(done.id, true);
    S.addHabit({ name: 'Beber agua', icon: 'leaf' }); S.addHabit({ name: 'Leer', icon: 'book' }); S.addHabit({ name: 'Caminar 30 min', icon: 'dumbbell' });
    const P = Whider.Pages;
    const proj = P.fromTemplate('project', { title: 'Lanzamiento de la web' });
    P.fromTemplate('meeting', { title: 'Reunión con el equipo' });
    const pg = P.create({ title: 'Viaje a Lisboa', icon: 'pin', cover: 'waves', blocks: [
      P.block('h2', 'Plan'), P.block('p', 'Tres días en <b>Lisboa</b> con visitas a Alfama y Belém.'),
      P.block('todo', 'Reservar el hotel', { c: true }), P.block('todo', 'Comprar los billetes de tren'), P.block('callout', 'Llevar el cargador del móvil y el pasaporte', { ic: 'alert' }),
      P.block('h2', 'Documentos'), P.block('p', '')] });
    window.__tourPage = pg.id; window.__projPage = proj.id;
  });
}
async function run(label, ctxOpts, mobile) {
  const b = await chromium.launch();
  const ctx = await b.newContext(Object.assign({ deviceScaleFactor: 1 }, ctxOpts));
  await ctx.clock.install({ time: new Date(new Date().toISOString().slice(0, 10) + 'T09:40:00') });
  await ctx.addInitScript(() => { window.WHIDER_CONFIG = { firebase: null }; if (!localStorage.getItem('whider.meta.v1')) localStorage.setItem('whider.meta.v1', JSON.stringify({ onboarded: true, createdAt: Date.now() - 20 * 86400000 })); });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(U.APP); await sleep(1800);
  await p.evaluate(() => { Whider.Notify.check = function () {}; Whider.Notify.permission = function () { return 'granted'; }; });
  await seed(p); await sleep(300);
  const shot = async name => { await sleep(650); await p.evaluate(() => { const t = document.getElementById('toastRoot'); if (t) t.innerHTML = ''; }); await p.screenshot({ path: path.join(OUT, label + '-' + name + '.png') }); };
  const go = async id => { await p.evaluate(id => Whider.Router.go(id), id); await sleep(500); };
  for (const id of ['home', 'tasks', 'calendar', 'notes']) { await go(id); await shot(id); }
  await p.evaluate(() => Whider.Notes.openPage(window.__tourPage)); await sleep(1300);
  // Adjuntos en la página del viaje
  const has = await p.evaluate(() => Whider.Pages.content(window.__tourPage).blocks.some(b => b.f));
  if (!has) {
    await p.click('#screen-notes .bk-text >> nth=-1');
    const btn = mobile ? null : '.pg-addons button:has-text("Adjuntar")';
    if (btn) { const [fc] = await Promise.all([p.waitForEvent('filechooser'), p.click(btn)]); await fc.setFiles([path.join(FX, 'Factura marzo.pdf'), path.join(FX, 'foto.png')]); await sleep(1500); }
    else { await p.locator('.kb-bar.show button[aria-label^="Adjuntar"]').tap(); await sleep(500); const [fc] = await Promise.all([p.waitForEvent('filechooser'), p.locator('.sheet').getByText('Archivos', { exact: true }).tap()]); await fc.setFiles([path.join(FX, 'Factura marzo.pdf'), path.join(FX, 'foto.png')]); await sleep(1500); }
    await p.evaluate(() => document.activeElement && document.activeElement.blur()); await sleep(300);
  }
  await shot('page');
  await p.evaluate(() => { const s = document.querySelector('#screen-notes'); s.scrollTop = 600; }); await shot('page-2');
  await p.evaluate(() => Whider.Notes.openPage(window.__projPage)); await sleep(1300); await shot('project');
  for (const id of (mobile ? ['more', 'habits', 'focus', 'stats', 'progress'] : ['habits', 'focus', 'stats', 'progress', 'reports'])) { await go(id); await shot(id); }
  await p.evaluate(() => Whider.Settings.open()); await sleep(700); await shot('settings');
  await p.evaluate(() => Whider.Sheet.closeTop && Whider.Sheet.closeTop()); await sleep(400);
  await go('home'); await p.evaluate(() => Whider.QuickAdd.open({})); await sleep(700); await shot('quickadd');
  console.log(label, 'errores:', JSON.stringify(errs));
  await b.close();
}
(async () => {
  { const tmp = await chromium.launch(); await U.fixtures(tmp); await tmp.close(); }
  if (ONLY !== 'movil') await run('pc', { viewport: { width: 1440, height: 900 } }, false);
  if (ONLY !== 'pc') await run('movil', Object.assign({}, devices['Pixel 7']), true);
})().catch(e => { console.error(e); process.exit(2); });
