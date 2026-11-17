// Estadísticas e informes con 120 días de datos: todos los apartados, gráficos, tabla, exportaciones
const { chromium } = require('playwright');
const { APP } = require('./_util');
const seed = require('./_datos-ejemplo.js');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const results = []; let failed = 0;
const ok = (name, cond, extra) => { results.push((cond ? 'OK   ' : 'FAIL ') + name + (extra !== undefined ? '  → ' + JSON.stringify(extra) : '')); if (!cond) failed++; };
const URL = process.argv[2] || APP;
const SHOTS = process.argv[3] || null;
async function setup(b, viewport, mobile) {
  const ctx = await b.newContext(Object.assign({ viewport, acceptDownloads: true }, mobile ? { isMobile: true, hasTouch: true, deviceScaleFactor: 1 } : {}));
  await ctx.addInitScript(() => { window.WHIDER_CONFIG = { firebase: null }; });
  await ctx.addInitScript(seed());
  const p = await ctx.newPage(); p.setDefaultTimeout(6000);
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  p.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
  await p.goto(URL); await sleep(2000);
  await p.evaluate(() => { Whider.Notify.check = function () {}; });
  return { ctx, p, errs };
}
(async () => {
  const b = await chromium.launch();
  {
    const { p, errs } = await setup(b, { width: 1440, height: 900 });
    await p.keyboard.press('9'); await sleep(500);
    ok('tecla 9 → Estadísticas', await p.evaluate(() => Whider.State.activeScreen) === 'stats');
    ok('cifras con variación', await p.evaluate(() => document.querySelectorAll('#screen-stats .st-tile').length) >= 4);
    ok('1.0: ningún apartado bloqueado', await p.evaluate(() => document.querySelectorAll('#screen-stats .ch-locked').length) === 0);
    await p.click('#screen-stats .st-filters button:has-text("90 días")'); await sleep(600);
    ok('90 días sin ventana de pago', await p.evaluate(() => !document.querySelector('.sheet.paywall') && Whider.State.ui.statsRange === 90));
    const cards = await p.evaluate(() => [...document.querySelectorAll('#screen-stats .ch-card strong')].map(x => x.textContent));
    ok('todos los apartados', ['Por hora del día', 'Por prioridad', 'Minutos de enfoque', 'Hábitos', 'Conclusiones', 'Constancia del año'].every(t => cards.includes(t)), cards);
    ok('conclusiones con frases', await p.evaluate(() => document.querySelectorAll('#screen-stats .ins-list li').length) >= 3);
    // Aviso al pasar el ratón por una columna
    const col = await p.$('#screen-stats .vchart .vc-col:nth-child(5)');
    await col.hover(); await sleep(200);
    ok('aviso al pasar por una columna', await p.evaluate(() => { const t = document.querySelector('.chart-tip'); return !!t && t.style.display === 'flex' && /tarea/.test(t.textContent); }));
    // Vista de tabla
    await p.click('#screen-stats .ch-card .ch-tbtn'); await sleep(200);
    ok('vista de tabla', await p.evaluate(() => document.querySelectorAll('#screen-stats .ch-table tbody tr').length) > 5);
    await p.click('#screen-stats .ch-card .ch-tbtn'); await sleep(200);
    await p.evaluate(() => window.scrollTo(0, 0));
    if (SHOTS) { await p.screenshot({ path: SHOTS + '/d-stats.png' }); await p.evaluate(() => { document.getElementById('screen-stats').scrollTop = 900; }); await sleep(300); await p.screenshot({ path: SHOTS + '/d-stats2.png' }); }
    // Informes
    await p.evaluate(() => Whider.Router.go('reports')); await sleep(500);
    ok('tecla 8 → Informes', await p.evaluate(() => Whider.State.activeScreen) === 'reports');
    ok('documento con resumen y completadas', await p.evaluate(() => { const d = document.querySelector('#screen-reports .rp-doc'); return !!d && /Resumen/.test(d.textContent) && /Tareas completadas/.test(d.textContent); }));
    await p.click('#screen-reports .rp-row button:has-text("Mes pasado")'); await sleep(500);
    ok('periodo «Mes pasado»', await p.evaluate(() => /Del 1 de/.test(document.querySelector('#screen-reports .lt-sub').textContent)));
    const [dl] = await Promise.all([p.waitForEvent('download'), p.click('#screen-reports .rp-actions button:has-text("CSV")')]);
    const path = await dl.path(); const csv = require('fs').readFileSync(path, 'utf8');
    ok('CSV descargado con cabecera', /Estado;Tarea;Categoría/.test(csv) && csv.split('\n').length > 10, csv.split('\n').length);
    if (SHOTS) await p.screenshot({ path: SHOTS + '/d-report.png' });
    // Impresión: solo el informe
    await p.emulateMedia({ media: 'print' }); await sleep(200);
    ok('al imprimir se ve solo el informe', await p.evaluate(() => getComputedStyle(document.getElementById('sidebar')).visibility === 'hidden' && getComputedStyle(document.querySelector('.rp-doc')).visibility === 'visible'));
    if (SHOTS) await p.pdf({ path: SHOTS + '/informe.pdf', format: 'A4' }).catch(() => {});
    await p.emulateMedia({ media: 'screen' });
    ok('sin errores (ordenador)', errs.length === 0, errs.slice(0, 5));
  }
  {
    const { p, errs } = await setup(b, { width: 390, height: 844 }, true);
    await p.evaluate(() => Whider.Router.go('stats')); await sleep(600);
    ok('móvil: estadísticas resumidas', await p.evaluate(() => document.querySelectorAll('#screen-stats .ch-card').length === 3 && !document.querySelector('#screen-stats .ch-locked')));
    if (SHOTS) await p.screenshot({ path: SHOTS + '/m-stats.png' });
    await p.evaluate(() => Whider.Router.go('reports')); await sleep(600);
    ok('móvil: tu semana', await p.evaluate(() => document.querySelector('#screen-reports h1').textContent === 'Tu semana' && document.querySelectorAll('#screen-reports .st-tile').length === 4));
    if (SHOTS) await p.screenshot({ path: SHOTS + '/m-week.png' });
    ok('sin errores (móvil)', errs.length === 0, errs.slice(0, 5));
  }
  await b.close();
  console.log(results.join('\n'));
  console.log(failed ? '\n' + failed + ' FALLOS' : '\nTODO OK');
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
