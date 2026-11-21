// Portada: capturas y comprobaciones por dispositivo, sus secciones (novedades, preguntas frecuentes, soporte) y la
// versión en inglés (/en/)
// uso: node web-portada.js <url> <carpeta> [completo]
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
    // Los tamaños de los instaladores salen de la API de GitHub: aquí, una respuesta fija (la prueba no depende
    // de la red ni del límite de peticiones de GitHub, que comparten muchas máquinas)
    await ctx.route('https://api.github.com/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
      assets: ['WHIDER-Setup.exe', 'WHIDER-mac-arm64.dmg', 'WHIDER-mac-x64.dmg', 'WHIDER-linux.AppImage', 'WHIDER-linux.deb'].map((name) => ({ name, size: 120e6 })) }) }));
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
      const want = { windows: /WHIDER-Setup\.exe$/, mac: /WHIDER-mac-(arm64|x64)\.dmg$/, linux: /WHIDER-linux\.AppImage$/ }[name];
      ok(/\/releases\/latest\/download\//.test(info.mainHref) && want.test(info.mainHref), name + ': enlace al instalador de la última versión (' + info.mainHref.split('/').pop() + ')');
    } else if (name === 'android') {
      ok(info.play && !info.cta, name + ': Google Play · Próximamente en lugar de descarga');
    } else {
      ok(!info.play && !info.cta && /Safari/.test(info.note), name + ': sin Google Play; cómo añadirla desde Safari («' + info.note + '»)');
      ok(await p.evaluate(() => !document.querySelector('#play') || document.querySelector('#play').hidden), name + ': la tarjeta del móvil no ofrece Google Play');
    }
    ok(!info.apk, name + ': sin APK');
    ok(/^"?Inter/.test(info.h1), name + ': titular en Inter');
    ok(info.overflow <= 0, name + ': sin desplazamiento horizontal (' + info.overflow + ')');
    ok(errs.length === 0, name + ': sin errores ' + JSON.stringify(errs));
    await p.screenshot({ path: path.join(OUTD, name + '-arriba.png') });
    if (FULL) { await p.evaluate(() => document.querySelectorAll('.rv').forEach(e => e.classList.add('in'))); await sleep(900); await p.screenshot({ path: path.join(OUTD, name + '-completa.png'), fullPage: true }); }
    await ctx.close();
  }

  // Las secciones nuevas y lo que dice qué versión se descarga (lo mantiene tools/version.js)
  const D = (await (async () => { const c = await b.newContext(); const p = await c.newPage(); await p.goto(URL0); const d = await p.evaluate(() => ({ v: window.WhiderDescargas.version })); await c.close(); return d; })());
  const minor = D.v.split(/[.-]/).slice(0, 2).join('.');
  for (const [lang, url] of [['es', URL0], ['en', URL0.replace(/\/?$/, '/') + 'en/']]) {
    const ctx = await b.newContext({ viewport: { width: 1280, height: 800 }, userAgent: WIN, deviceScaleFactor: 1 });
    await ctx.route('https://api.github.com/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"assets":[]}' }));
    const p = await ctx.newPage(); const errs = [];
    p.on('pageerror', e => errs.push(e.message));
    await p.goto(url); await sleep(1500);
    const s = await p.evaluate(() => ({
      lang: document.documentElement.lang,
      versions: [...document.querySelectorAll('[data-version]')].map((e) => e.textContent),
      news: document.querySelectorAll('.news li').length,
      newsVersion: (document.querySelector('.news') || {}).dataset ? document.querySelector('.news').dataset.newsVersion || null : null,
      faq: document.querySelectorAll('.faq details').length,
      support: document.querySelectorAll('.support .card').length,
      other: (document.querySelector('a.lang') || {}).href || '',
      alt: [...document.querySelectorAll('link[rel="alternate"]')].map((l) => l.hreflang).sort().join(','),
      cta: document.querySelector('#cta-dl span').textContent,
      text: document.body.innerText
    }));
    ok(s.lang === lang, lang + ': idioma de la página «' + s.lang + '»');
    ok(s.versions.length >= 3 && s.versions.every((t) => t === 'WHIDER ' + minor), lang + ': anuncia WHIDER ' + minor + ' en todas partes (' + s.versions.join(', ') + ')');
    ok(s.news >= 3, lang + ': novedades de la ' + minor + ' (' + s.news + ')');
    ok(s.faq >= 9 && s.support === 2, lang + ': preguntas frecuentes (' + s.faq + ') y soporte (' + s.support + ')');
    ok(s.alt === 'en,es,x-default', lang + ': enlaces a la otra versión para buscadores (' + s.alt + ')');
    if (lang === 'es') {
      ok(/\/en\/$/.test(s.other) && /Descargar para Windows/.test(s.cta), 'es: enlace «EN» a la versión en inglés');
    } else {
      ok(s.newsVersion === minor, 'en: las novedades traducidas son de la ' + minor + ' (' + s.newsVersion + ')');
      ok(/\/$/.test(s.other) && !/\/en\/$/.test(s.other) && /Download for Windows/.test(s.cta), 'en: enlace «ES» y descarga en inglés («' + s.cta + '»)');
      ok(/already in English/i.test(s.text), 'en: dice que la app ya está en inglés en el navegador');
      ok(!/the app is in Spanish for now/i.test(s.text), 'en: ya no dice que la app solo está en español');
      ok(!/Descargar|Próximamente|Preguntas/.test(s.text), 'en: sin textos en español sueltos');
    }
    ok(!errs.length, lang + ': sin errores ' + JSON.stringify(errs));
    await ctx.close();
  }

  await b.close();
  console.log(fails ? 'FALLOS: ' + fails : 'TODO OK');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
