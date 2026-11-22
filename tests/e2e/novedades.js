// 1.1 · Novedades y versiones nuevas
//  - Quien ya usaba WHIDER ve en Hoy un aviso discreto tras actualizar (móvil y ordenador): abre las notas de
//    esta versión (las de CHANGELOG.md, sin las de desarrolladores), se cierra con un toque y no vuelve.
//  - En una instalación nueva no aparece. Siempre a mano en Ajustes → Ayuda → Novedades y en la paleta.
//  - Android instalado desde GitHub: avisa de una versión nueva con su APK (una vez al día); desde Google
//    Play no consulta nada; un enlace que no sea de las publicaciones de WHIDER se ignora.
const { chromium } = require('playwright');
const { APP } = require('./_util');
const PKG = require('../../package.json');

const LABEL = PKG.version.replace(/-(alpha|beta|rc)\.(\d+)$/, ' $1 $2');
const API = 'https://api.github.com/repos/McTn4/whider-2.0-PREMIUM/releases/latest';
const APK = 'https://github.com/McTn4/whider-2.0-PREMIUM/releases/download/v9.9.9/WHIDER-android.apk';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let fails = 0;
const ok = (c, m, x) => { console.log((c ? 'OK   ' : 'FAIL ') + m + (!c && x !== undefined ? '  → ' + JSON.stringify(x) : '')); if (!c) fails++; };
const sheetText = (p) => p.evaluate(() => { const s = document.querySelector('#sheetRoot > .sheet-layer:last-child'); return s ? s.innerText : ''; });
const closeAll = (p) => p.evaluate(() => { for (let i = 0; i < 8 && Whider.Sheet.closeTop(); i++); });

(async () => {
  const b = await chromium.launch();

  for (const [nombre, viewport] of [['móvil', { width: 390, height: 844 }], ['ordenador', { width: 1280, height: 860 }]]) {
    const ctx = await b.newContext({ viewport });
    // Alguien que ya usaba la 1.0 (ha hecho la presentación y no tiene versión vista)
    await ctx.addInitScript(() => {
      window.WHIDER_CONFIG = { firebase: null };
      if (!localStorage.getItem('whider.meta.v1')) localStorage.setItem('whider.meta.v1', JSON.stringify({ onboarded: true, createdAt: Date.now() - 90 * 86400000 }));
    });
    const p = await ctx.newPage();
    const errs = [];
    p.on('pageerror', (e) => errs.push(e.message));
    await p.goto(APP);
    await sleep(1800);
    await p.evaluate(() => { Whider.Notify.check = function () {}; });

    const card = await p.evaluate(() => { const c = document.querySelector('#screen-home .wn-card'); return c ? c.innerText : null; });
    ok(card && card.includes('WHIDER se ha actualizado a la ' + LABEL), nombre + ': aviso en Hoy tras actualizar', card);
    await p.click('#screen-home .wn-card button:has-text("Ver novedades")');
    await sleep(600);
    const notas = await sheetText(p);
    ok(/^Novedades/m.test(notas) && notas.includes('WHIDER ' + LABEL), nombre + ': «Ver novedades» abre las notas de esta versión', notas.slice(0, 200));
    // La primera novedad de esta versión (su título en negrita) y el apartado «Mejoras»
    const primera = await p.evaluate(() => (/\*\*([^*]+)\*\*/.exec(Whider.RELEASES[0].groups[0].items[0]) || [])[1] || '');
    ok(!!primera && notas.includes(primera) && /Mejoras/.test(notas), nombre + ': con sus apartados (Novedades, Mejoras…)', primera);
    ok(!/Para desarrolladores|ESLint/.test(notas), nombre + ': sin las notas para desarrolladores');
    ok(notas.includes('Estás usando WHIDER ' + LABEL), nombre + ': dice qué versión estás usando');
    await closeAll(p);
    await sleep(500);
    ok(await p.evaluate(() => !document.querySelector('#screen-home .wn-card') && localStorage.getItem('whider.seenVersion') === Whider.VERSION), nombre + ': después, el aviso desaparece');
    await p.reload();
    await sleep(1600);
    ok(await p.evaluate(() => !document.querySelector('#screen-home .wn-card')), nombre + ': y no vuelve al abrir otra vez');

    // Cerrar el aviso sin abrirlo
    await p.evaluate(() => { localStorage.removeItem('whider.seenVersion'); localStorage.removeItem('whider.updatedAt'); Whider.Router.refresh(); });
    await sleep(500);
    await p.click('#screen-home .wn-card button[aria-label="Cerrar el aviso de novedades"]');
    await sleep(400);
    const toast = await p.evaluate(() => [...document.querySelectorAll('.toast')].map((t) => t.innerText).join(' | '));
    ok(/Ajustes → Ayuda/.test(toast) && await p.evaluate(() => !document.querySelector('#screen-home .wn-card')), nombre + ': ✕ lo cierra y dice dónde encontrarlo', toast);

    // Ajustes → Ayuda → Novedades: todas las versiones
    await p.evaluate(() => Whider.Settings.open());
    await sleep(600);
    await p.click('#sheetRoot .cell:has-text("Novedades")');
    await sleep(600);
    const todas = await sheetText(p);
    ok(todas.includes('WHIDER ' + LABEL) && todas.includes('WHIDER 1.0.0'), nombre + ': Ajustes → Ayuda → Novedades enseña todas las versiones', todas.slice(0, 120));
    await closeAll(p);
    if (nombre === 'ordenador') {
      await p.evaluate(() => Whider.Palette.open('Novedades'));
      await sleep(400);
      await p.keyboard.press('Enter');
      await sleep(600);
      ok(/^Novedades/m.test(await sheetText(p)), 'la paleta de órdenes abre las novedades');
      await closeAll(p);
    }
    ok(!errs.length, nombre + ': sin errores', errs);
    await ctx.close();
  }

  /* Instalación nueva: nada que contar */
  {
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
    await ctx.addInitScript(() => { window.WHIDER_CONFIG = { firebase: null }; });
    const p = await ctx.newPage();
    await p.goto(APP);
    await sleep(1800);
    ok(await p.evaluate(() => Whider.WhatsNew.pending().length === 0 && !document.querySelector('.wn-card')), 'instalación nueva: sin aviso de novedades');
    await ctx.close();
  }

  /* Android instalado desde GitHub: aviso de versión nueva con su APK */
  async function android(installer, respuesta) {
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
    let hits = 0;
    await ctx.route(API, (route) => { hits++; route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(respuesta) }); });
    await ctx.addInitScript((who) => {
      window.WHIDER_CONFIG = { firebase: null };
      window.__abiertos = [];
      window.WhiderAndroid = { installer: () => who, openUrl: (u) => window.__abiertos.push(u), fontScale: () => 1 };
      localStorage.setItem('whider.meta.v1', JSON.stringify({ onboarded: true, createdAt: Date.now(), fontScaleSeen: true }));
      localStorage.setItem('whider.seenVersion', '99.0.0');
    }, installer);
    const p = await ctx.newPage();
    p.errs = [];
    p.on('pageerror', (e) => p.errs.push(e.message));
    await p.goto(APP);
    await sleep(1500);
    return { ctx, p, hits: () => hits };
  }
  const rel = (tag, url, extra) => Object.assign({ tag_name: tag, prerelease: false, html_url: 'https://github.com/McTn4/whider-2.0-PREMIUM/releases/tag/' + tag, assets: [{ name: 'WHIDER-android.apk', browser_download_url: url }] }, extra || {});
  {
    const { ctx, p, hits } = await android('', rel('v9.9.9', APK));
    ok(await p.evaluate(() => Whider.Updates.state().mode === 'android'), 'APK de GitHub: comprueba si hay versiones nuevas');
    await p.evaluate(() => Whider.Updates.check(true));
    await sleep(500);
    const toast = await p.evaluate(() => [...document.querySelectorAll('.toast')].map((t) => t.innerText).join(' | '));
    ok(/versión nueva de WHIDER: la 9\.9\.9/.test(toast), 'avisa de la 9.9.9', toast);
    await p.click('.toast-action:has-text("Descargar")');
    await sleep(300);
    ok((await p.evaluate(() => window.__abiertos)).includes(APK), '«Descargar» abre el APK de esa versión en el navegador');
    await p.evaluate(() => Whider.Settings.open());
    await sleep(600);
    ok(/Hay una versión nueva: la 9\.9\.9/.test(await sheetText(p)), 'Ajustes → Ayuda enseña la versión y que hay una nueva');
    await closeAll(p);
    const antes = hits();
    await p.evaluate(() => Whider.Updates.check(false));
    await sleep(300);
    ok(hits() === antes, 'se consulta como mucho una vez al día', { antes, despues: hits() });
    ok(!p.errs.length, 'sin errores (Android)', p.errs);
    await ctx.close();
  }
  {
    const { ctx, p, hits } = await android('', rel('v9.9.9', 'https://malo.example/WHIDER-android.apk'));
    const s = await p.evaluate(() => Whider.Updates.check(true));
    ok(s.state === 'latest' && hits() === 1, 'un enlace que no es de las publicaciones de WHIDER se ignora', s);
    await ctx.close();
  }
  {
    const { ctx, p, hits } = await android('', rel('v9.9.9-beta.1', APK.replace('v9.9.9', 'v9.9.9-beta.1'), { prerelease: true }));
    const s = await p.evaluate(() => Whider.Updates.check(true));
    ok(s.state === 'latest', 'las versiones de prueba no se ofrecen', { s, hits: hits() });
    await ctx.close();
  }
  {
    const { ctx, p, hits } = await android('com.android.vending', rel('v9.9.9', APK));
    await p.evaluate(() => Whider.Updates.check(true));
    await sleep(300);
    ok(await p.evaluate(() => Whider.Updates.state().mode === 'none') && hits() === 0, 'instalada desde Google Play: no consulta nada (la tienda la actualiza)');
    await ctx.close();
  }

  await b.close();
  console.log(fails ? fails + ' FALLOS' : 'TODO OK');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
