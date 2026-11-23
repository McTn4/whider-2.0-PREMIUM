// 1.0: enlace #cuenta (eliminar la cuenta desde la web), tamaño de letra del sistema en Android,
// enlaces externos, página de privacidad y selector de hora de «Nueva tarea»
const { chromium } = require('playwright');
const { APP } = require('./_util');
const { simular, entrar } = require('./_cuentas');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const BASE = APP.replace(/app$/, ''), EMU = 'http://127.0.0.1:9099', PROJECT = 'demo-whider';
const cfg = { firebase: { apiKey: 'demo-key', authDomain: 'demo-whider.firebaseapp.com', projectId: PROJECT, appId: '1:1:web:1' },
  emulator: { auth: EMU, firestoreHost: '127.0.0.1', firestorePort: 8085 }, requireAccount: true, links: { base: 'https://whider-red.vercel.app' } };
let fails = 0; const ok = (c, m, x) => { console.log((c ? 'OK   ' : 'FAIL ') + m + (x !== undefined && !c ? '  → ' + JSON.stringify(x) : '')); if (!c) fails++; };
(async () => {
  const b = await chromium.launch();
  /* 1. Tamaño de letra del sistema (Android): solo la primera vez y sin pisar lo elegido */
  {
    const ctx = await b.newContext({ viewport: { width: 412, height: 900 } });
    await ctx.addInitScript(() => {
      window.WHIDER_CONFIG = { firebase: null };
      const urls = []; window.__opened = urls;
      window.WhiderAndroid = { fontScale: () => 1.35, openUrl: u => urls.push(u) };
      if (!localStorage.getItem('whider.meta.v1')) localStorage.setItem('whider.meta.v1', JSON.stringify({ onboarded: true, createdAt: Date.now() }));
    });
    const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.goto(BASE + 'index.html'); await sleep(1600);
    ok(await p.evaluate(() => Whider.State.settings.textSize === 'xl' && document.documentElement.getAttribute('data-text') === 'xl' && Whider.State.meta.fontScaleSeen === true), 'Android con letra grande del sistema → texto «Enorme» la primera vez');
    await p.evaluate(() => Whider.State.setSetting('textSize', 'm')); await sleep(200);
    await p.reload(); await sleep(1600);
    ok(await p.evaluate(() => Whider.State.settings.textSize === 'm'), 'después manda lo elegido en Ajustes (no vuelve a cambiarlo)');
    // Enlaces externos: en Android van al navegador del sistema
    await p.evaluate(() => Whider.Settings.open('privacy')); await sleep(700);
    await p.click('.sheet-root .cell:has-text("Política de privacidad completa")'); await sleep(300);
    ok(await p.evaluate(() => window.__opened[0] === 'https://whider-red.vercel.app/privacidad/'), 'Ajustes → Privacidad abre la política completa en el navegador', await p.evaluate(() => window.__opened));
    ok(await p.evaluate(() => { Whider.U.openExternal('javascript:alert(1)'); return window.__opened.length === 1; }), 'openExternal rechaza lo que no es http(s)');
    await p.evaluate(() => { while (Whider.Sheet.closeTop()); }); await sleep(400);
    // Selector de hora en «Nueva tarea»: etiqueta con campo (no un campo dentro de un botón)
    await p.evaluate(() => Whider.QuickAdd.open({})); await sleep(700);
    const chip = await p.evaluate(() => { const i = document.querySelector('.sheet-root .chips input[type=time]'); return i ? { tag: i.parentElement.tagName, inButton: !!i.closest('button') } : null; });
    ok(chip && chip.tag === 'SPAN' && !chip.inButton, 'la hora es un campo dentro de una etiqueta', chip);
    await p.fill('.sheet-root .chips input[type=time]', '17:45'); await p.dispatchEvent('.sheet-root .chips input[type=time]', 'change'); await sleep(300);
    ok(await p.evaluate(() => /17:45/.test(document.querySelector('.sheet-root .chips').textContent)), 'elegir la hora la muestra en la etiqueta');
    ok(errs.length === 0, 'sin errores (Android simulado)', errs);
    await ctx.close();
  }
  /* 2. Página de privacidad pública */
  {
    const p = await b.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
    await p.goto(BASE + 'privacidad/'); await sleep(600);
    const t = await p.evaluate(() => ({ h1: document.querySelector('h1').textContent, del: document.querySelector('a.btn').getAttribute('href'), txt: document.body.innerText }));
    ok(t.h1 === 'Política de privacidad' && t.del === '../app#cuenta' && /Eliminar la cuenta/.test(t.txt) && /Firebase/.test(t.txt) && !/Premium|Stripe/i.test(t.txt), 'política de privacidad pública con eliminación de cuenta', t.h1 + ' · ' + t.del);
    ok(errs.length === 0, 'privacidad sin errores', errs);
    await p.close();
  }
  /* 3. #cuenta: tras iniciar sesión se abre Ajustes → Cuenta (eliminar la cuenta sin la app) */
  {
    await fetch(`${EMU}/emulator/v1/projects/${PROJECT}/accounts`, { method: 'DELETE' });
    const ctx = await b.newContext({ viewport: { width: 1280, height: 860 } });
    await ctx.addInitScript(c => { window.WHIDER_CONFIG = c; }, cfg);
    await ctx.addInitScript(simular);
    const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.goto(BASE + 'index.html'); await sleep(2300);
    await entrar(p, 'ana@ejemplo.com', 'Ana Prueba'); await sleep(2500);
    // Otra pestaña con el enlace de la política: la sesión ya está iniciada
    const q = await ctx.newPage(); q.on('pageerror', e => errs.push(e.message));
    await q.goto(BASE + 'index.html#cuenta'); await sleep(3500);
    const acc = await q.evaluate(() => { const r = document.querySelector('.sheet-root'); return r ? r.innerText : ''; });
    ok(/Eliminar la cuenta/.test(acc) && /ana@ejemplo\.com/.test(acc), '#cuenta abre Ajustes → Cuenta con «Eliminar la cuenta»', acc.slice(0, 200));
    ok(errs.length === 0, 'sin errores con cuenta', errs);
    await ctx.close();
  }
  await b.close();
  console.log(fails ? fails + ' FALLOS' : 'TODO OK'); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
