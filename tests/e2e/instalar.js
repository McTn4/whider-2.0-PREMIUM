// 1.1 · Instalar la web como app
//  - iPhone (Safari): tarjeta en Hoy cuando ya hay tareas, «Ver cómo» enseña los tres pasos y la tarjeta se cierra
//    para siempre; Ajustes la ofrece siempre. Ya instalada (pantalla de inicio), nada.
//  - Chrome/Edge: con el ofrecimiento del navegador (beforeinstallprompt), «Instalar» lo abre.
//  - En las apps (Android, escritorio) nunca aparece.
const { chromium, devices } = require('playwright');
const { APP, OUT } = require('./_util');
const path = require('path');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let fails = 0;
const ok = (c, m, x) => { console.log((c ? 'OK   ' : 'FAIL ') + m + (!c && x !== undefined ? '  → ' + JSON.stringify(x) : '')); if (!c) fails++; };
const sheetText = (p) => p.evaluate(() => { const s = document.querySelector('#sheetRoot > .sheet-layer:last-child'); return s ? s.innerText : ''; });

async function abrir(b, opts, init) {
  const ctx = await b.newContext(opts);
  await ctx.addInitScript((extra) => {
    window.WHIDER_CONFIG = { firebase: null };
    localStorage.setItem('whider.seenVersion', '999.0.0');
    if (!localStorage.getItem('whider.meta.v1')) localStorage.setItem('whider.meta.v1', JSON.stringify({ onboarded: true, createdAt: Date.now() - 40 * 86400000, firstSteps: { hidden: true } }));
    if (extra === 'standalone') Object.defineProperty(navigator, 'standalone', { value: true });
    if (extra === 'android') window.WhiderAndroid = { fontScale: () => 1, installer: () => 'com.android.vending' };
  }, init || '');
  const p = await ctx.newPage();
  p.errs = [];
  p.on('pageerror', (e) => p.errs.push(e.message));
  await p.goto(APP);
  await sleep(1600);
  await p.evaluate(() => { Whider.Notify.check = function () {}; });
  return { ctx, p };
}
const tarjeta = (p) => p.evaluate(() => { const c = document.querySelector('#screen-home .in-card'); return c ? c.innerText : null; });

(async () => {
  const b = await chromium.launch();

  /* 1. iPhone con Safari */
  {
    const { ctx, p } = await abrir(b, { ...devices['iPhone 13'] });
    ok(await p.evaluate(() => Whider.Install.ios() && Whider.Install.canInstall()), 'iPhone en Safari: se puede instalar');
    ok((await tarjeta(p)) === null, 'sin tareas todavía, no hay tarjeta (nada de avisos el primer día)');
    await p.evaluate(() => { Whider.State.addTask({ text: 'Comprar pan', date: Whider.U.today() }); Whider.Router.refresh(); });
    await sleep(400);
    const t = await tarjeta(p);
    ok(t && /Instala WHIDER en tu iPhone/.test(t) && /te avisa/.test(t), 'con alguna tarea: «Instala WHIDER en tu iPhone»', t);
    await p.click('#screen-home .in-card button:has-text("Ver cómo")');
    await sleep(600);
    const pasos = await sheetText(p);
    ok(/Instalar en el iPhone/.test(pasos) && /Pulsa Compartir/.test(pasos) && /Añadir a pantalla de inicio/.test(pasos) && /iOS 16\.4/.test(pasos), 'los tres pasos: Compartir, Añadir a pantalla de inicio y abrir desde el icono', pasos.slice(0, 200));
    await p.screenshot({ path: path.join(OUT, 'instalar-iphone.png') });
    await p.evaluate(() => { for (let i = 0; i < 6 && Whider.Sheet.closeTop(); i++); });
    await p.click('#screen-home .in-card button[aria-label="Cerrar el aviso de instalar"]');
    await sleep(400);
    ok((await tarjeta(p)) === null && await p.evaluate(() => /Ajustes/.test(document.querySelector('.toast').innerText)), '✕ la cierra y dice que sigue en Ajustes');
    await p.reload();
    await sleep(1500);
    ok((await tarjeta(p)) === null, 'y no vuelve');
    await p.evaluate(() => Whider.Settings.open());
    await sleep(600);
    await p.click('#sheetRoot .cell:has-text("Instalar en el iPhone")');
    await sleep(600);
    ok(/Pulsa Compartir/.test(await sheetText(p)), 'Ajustes → «Instalar en el iPhone» enseña los pasos');
    ok(!p.errs.length, 'sin errores (iPhone)', p.errs);
    await ctx.close();
  }

  /* 2. iPhone, ya en la pantalla de inicio */
  {
    const { ctx, p } = await abrir(b, { ...devices['iPhone 13'] }, 'standalone');
    await p.evaluate(() => { Whider.State.addTask({ text: 'Comprar pan', date: Whider.U.today() }); Whider.Router.refresh(); });
    await sleep(400);
    ok(!(await p.evaluate(() => Whider.Install.canInstall())) && (await tarjeta(p)) === null, 'ya instalada: ni tarjeta ni celda');
    await ctx.close();
  }

  /* 3. Chrome con el ofrecimiento de instalar */
  {
    const { ctx, p } = await abrir(b, { viewport: { width: 1280, height: 860 } });
    ok(!(await p.evaluate(() => Whider.Install.canInstall())), 'Chrome sin ofrecimiento: nada');
    await p.evaluate(() => {
      Whider.State.addTask({ text: 'Comprar pan', date: Whider.U.today() });
      const e = new Event('beforeinstallprompt');
      e.prompt = () => { window.__pedido = true; };
      e.userChoice = Promise.resolve({ outcome: 'accepted' });
      window.dispatchEvent(e);
    });
    await sleep(500);
    const t = await tarjeta(p);
    ok(t && /Instala WHIDER/.test(t) && /Instalar/.test(t), 'con el ofrecimiento: tarjeta con «Instalar»', t);
    await p.click('#screen-home .in-card button:has-text("Instalar")');
    await sleep(400);
    ok(await p.evaluate(() => window.__pedido === true), '«Instalar» abre el ofrecimiento del navegador');
    ok(await p.evaluate(() => localStorage.getItem('whider.installHint') === 'installed' && !Whider.Install.canInstall()), 'aceptado: queda instalada y no se vuelve a ofrecer');
    ok(!p.errs.length, 'sin errores (Chrome)', p.errs);
    await ctx.close();
  }

  /* 4. En la app de Android */
  {
    const { ctx, p } = await abrir(b, { ...devices['Pixel 7'] }, 'android');
    await p.evaluate(() => { Whider.State.addTask({ text: 'Comprar pan', date: Whider.U.today() }); Whider.Router.refresh(); });
    await sleep(400);
    ok(!(await p.evaluate(() => Whider.Install.canInstall())) && (await tarjeta(p)) === null, 'en la app de Android no se ofrece');
    await ctx.close();
  }

  await b.close();
  console.log(fails ? fails + ' FALLOS' : 'TODO OK');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
