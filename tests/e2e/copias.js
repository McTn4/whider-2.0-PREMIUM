// 1.1 · Copias de seguridad sin cuenta
//  - Android (puente simulado): una copia al día, sola, con todo (tareas y Cuaderno), y se puede apagar.
//  - Navegador sin cuenta: si pasa una semana sin copia, aviso en Hoy; «Guardar una copia» descarga el archivo
//    y el aviso se va; con ✕ vuelve a la semana.
const { chromium, devices } = require('playwright');
const { APP } = require('./_util');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let fails = 0;
const ok = (c, m, x) => { console.log((c ? 'OK   ' : 'FAIL ') + m + (!c && x !== undefined ? '  → ' + JSON.stringify(x) : '')); if (!c) fails++; };
const DIA = 86400000;

async function abrir(b, opts, android) {
  const ctx = await b.newContext(Object.assign({ acceptDownloads: true }, opts));
  await ctx.addInitScript((a) => {
    window.WHIDER_CONFIG = { firebase: null };
    localStorage.setItem('whider.seenVersion', '999.0.0');
    localStorage.setItem('whider.installHint', 'x');
    if (!localStorage.getItem('whider.meta.v1')) localStorage.setItem('whider.meta.v1', JSON.stringify({ onboarded: true, createdAt: Date.now() - 10 * 86400000, firstSteps: { hidden: true } }));
    if (a) {
      window.__copias = [];
      window.WhiderAndroid = { fontScale: () => 1, installer: () => 'com.android.vending', backupWrite: (n, j) => { const d = JSON.parse(j); window.__copias.push({ n, tareas: d.tasks.length, paginas: (d.pages || []).length }); return true; } };
    }
  }, !!android);
  const p = await ctx.newPage();
  p.errs = [];
  p.on('pageerror', (e) => p.errs.push(e.message));
  await p.goto(APP);
  await sleep(1600);
  await p.evaluate(() => { Whider.Notify.check = function () {}; });
  return { ctx, p };
}

(async () => {
  const b = await chromium.launch();

  /* 1. Android: copia del día, sola */
  {
    const { ctx, p } = await abrir(b, { ...devices['Pixel 7'] }, true);
    await p.evaluate(() => { Whider.State.addTask({ text: 'Pagar el alquiler', date: Whider.U.today() }); Whider.Pages.create({ title: 'Ideas' }); });
    const r = await p.evaluate(() => Whider.Backup.run(false));
    const copias = await p.evaluate(() => window.__copias);
    ok(r.ok && r.where === 'android' && copias.length === 1, 'Android: hace la copia del día sin preguntar', { r, copias });
    ok(/^whider-copia-auto-\d{4}-\d{2}-\d{2}\.json$/.test(copias[0].n) && copias[0].tareas === 1 && copias[0].paginas >= 1, 'con las tareas y el Cuaderno', copias[0]);
    ok((await p.evaluate(() => Whider.Backup.run(false))).reason === 'not-due', 'una al día');
    await p.evaluate(() => Whider.Settings.open('data'));
    await sleep(700);
    const t = await p.evaluate(() => document.querySelector('#sheetRoot').innerText);
    ok(/Copia automática cada día/.test(t) && /Descargas › WHIDER › Copias/.test(t), 'Ajustes → Datos dice dónde está', t.slice(0, 300));
    await p.evaluate(() => { for (let i = 0; i < 6 && Whider.Sheet.closeTop(); i++); Whider.Backup.setEnabled(false); localStorage.setItem('whider.backup.v1', JSON.stringify({ on: false })); });
    ok((await p.evaluate(() => Whider.Backup.run(false))).reason === 'not-due', 'apagada, no hace copias');
    ok(!p.errs.length, 'sin errores (Android)', p.errs);
    await ctx.close();
  }

  /* 2. Navegador sin cuenta: aviso semanal */
  {
    const { ctx, p } = await abrir(b, { viewport: { width: 390, height: 844 } });
    ok((await p.evaluate(() => Whider.Backup.where())) === '', 'en el navegador no puede guardarla sola');
    ok(!(await p.evaluate(() => Whider.Backup.reminderDue())), 'sin datos, no hay aviso');
    await p.evaluate(() => { Whider.State.addTask({ text: 'Pagar el alquiler', date: Whider.U.today() }); Whider.Router.refresh(); });
    await sleep(400);
    const card = await p.evaluate(() => { const c = document.querySelector('#screen-home .bk-card'); return c ? c.innerText : null; });
    ok(card && /Guarda una copia de tus datos/.test(card) && /solo están en este navegador/.test(card), 'con datos y una semana sin copia: aviso en Hoy', card);
    const [dl] = await Promise.all([p.waitForEvent('download'), p.click('#screen-home .bk-card button:has-text("Guardar una copia")')]);
    const nombre = dl.suggestedFilename();
    const fs = require('fs');
    const datos = JSON.parse(fs.readFileSync(await dl.path(), 'utf8'));
    ok(/^whider-copia-\d{4}-\d{2}-\d{2}\.json$/.test(nombre) && datos.tasks.length === 1 && datos.backup.app === 'WHIDER', '«Guardar una copia» descarga todo', { nombre, tareas: datos.tasks.length });
    await sleep(400);
    ok(await p.evaluate(() => !document.querySelector('#screen-home .bk-card')), 'y el aviso se va');
    // Una semana después vuelve; con ✕ se aplaza otra semana
    await p.evaluate((d) => { const o = JSON.parse(localStorage.getItem('whider.backup.v1')); o.manual = Date.now() - 8 * d; localStorage.setItem('whider.backup.v1', JSON.stringify(o)); Whider.Router.refresh(); }, DIA);
    await sleep(400);
    ok(await p.evaluate(() => !!document.querySelector('#screen-home .bk-card')), 'a la semana vuelve el aviso');
    await p.click('#screen-home .bk-card button[aria-label="Recordármelo dentro de una semana"]');
    await sleep(400);
    ok(await p.evaluate(() => !document.querySelector('#screen-home .bk-card') && !Whider.Backup.reminderDue()), '✕ lo aplaza una semana');
    await p.evaluate(() => Whider.Settings.open('data'));
    await sleep(700);
    ok(/Última copia guardada|te lo recordaremos cada semana/.test(await p.evaluate(() => document.querySelector('#sheetRoot').innerText)), 'Ajustes → Datos dice cuándo fue la última copia');
    ok(!p.errs.length, 'sin errores (navegador)', p.errs);
    await ctx.close();
  }

  await b.close();
  console.log(fails ? fails + ' FALLOS' : 'TODO OK');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
