// Portada: capturas y comprobaciones por dispositivo
// uso: node portada-ver.js <url> <carpeta> [completo]
const { chromium, devices } = require('playwright');
const { WEB, OUT } = require('./_util');
const path = require('path'), fs = require('fs');
const URL0 = process.argv[2] || WEB + '/';
const OUTD = process.argv[3] || path.join(OUT, 'portada'); fs.mkdirSync(OUTD, { recursive: true });
const FULL = process.argv[4] === 'completo';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const WIN = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36';
const MAC = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36';
const cases = [
  ['windows', { viewport: { width: 1440, height: 900 }, userAgent: WIN }],
  ['mac', { viewport: { width: 1280, height: 800 }, userAgent: MAC }],
  ['linux', { viewport: { width: 1024, height: 768 } }],
  ['android', { ...devices['Pixel 7'] }],
  ['iphone', { ...devices['iPhone 13'] }]
];
let fails = 0; const ok = (c, m) => { console.log((c ? 'OK   ' : 'FAIL ') + m); if (!c) fails++; };
(async () => {
  const b = await chromium.launch();
  for (const [name, opts] of cases) {
    const ctx = await b.newContext(Object.assign({ deviceScaleFactor: 1 }, opts));
    const p = await ctx.newPage(); const errs = [];
    p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
    await p.goto(URL0); await p.evaluate(() => document.fonts.ready); await sleep(2900);
    const info = await p.evaluate(() => ({
      pl: document.documentElement.getAttribute('data-plataforma'),
      cta: (document.querySelector('#cta-dl:not([hidden]) span') || {}).textContent || '',
      play: !document.querySelector('#cta-play').hidden,
      main: document.querySelector('#pc-main').hidden ? '' : document.querySelector('#pc-main-btn span').textContent,
      mainHref: document.querySelector('#pc-main-btn').getAttribute('href'),
      note: document.querySelector('#cta-note').textContent,
      h1: getComputedStyle(document.querySelector('h1')).fontFamily,
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      apk: /\.apk/i.test(document.documentElement.innerHTML)
    }));
    console.log(name, JSON.stringify(info));
    const expectPl = { windows: 'windows', mac: 'mac', linux: 'linux', android: 'android', iphone: 'ios' }[name];
    ok(info.pl === expectPl, name + ': detecta ' + info.pl);
    if (['windows', 'mac', 'linux'].includes(name)) {
      ok(/Descargar para (Windows|macOS|Linux)/.test(info.cta) && info.main === info.cta, name + ': botón «' + info.cta + '»');
      ok(/releases\/download\/desktop-latest\//.test(info.mainHref), name + ': enlace al instalador');
    } else {
      ok(info.play && !info.cta, name + ': Google Play · Próximamente en lugar de descarga');
    }
    ok(!info.apk, name + ': sin APK');
    ok(/^"?Outfit/.test(info.h1), name + ': titular en Outfit');
    ok(info.overflow <= 0, name + ': sin desplazamiento horizontal (' + info.overflow + ')');
    ok(errs.length === 0, name + ': sin errores ' + JSON.stringify(errs));
    await p.screenshot({ path: path.join(OUTD, name + '-arriba.png') });
    if (FULL) { await p.evaluate(() => document.querySelectorAll('.rv').forEach(e => e.classList.add('in'))); await sleep(900); await p.screenshot({ path: path.join(OUTD, name + '-completa.png'), fullPage: true }); }
    await ctx.close();
  }
  await b.close();
  console.log(fails ? 'FALLOS: ' + fails : 'TODO OK');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
