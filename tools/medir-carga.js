// @ts-check
/* global window, document, MutationObserver -- código que se ejecuta dentro de la página */
/**
 * Mide cuánto tarda en abrirse la app web publicada, empaquetada (lo normal) y sin empaquetar
 * (WHIDER_SIN_EMPAQUETAR=1), con el procesador 4 veces más lento (un móvil de gama media) y, aparte,
 * con 40 ms de latencia por petición (red móvil). Primera visita: sin caché ni Service Worker.
 *
 *   node tools/medir-carga.js [veces]     (por defecto, 7 de cada; da la mediana)
 *
 * Ojo: el servidor local es HTTP/1.1; Vercel usa HTTP/2, que reparte mejor muchas peticiones pequeñas,
 * así que la diferencia «con latencia» aquí es mayor que la real. La de «solo procesador» sí es comparable.
 */
const { chromium } = require('playwright');
const { execFileSync, spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const VECES = Number(process.argv[2]) || 7;
const sleep = (/** @type {number} */ ms) => new Promise((r) => setTimeout(r, ms));
const mediana = (/** @type {number[]} */ a) => a.slice().sort((x, y) => x - y)[Math.floor(a.length / 2)];

/** Compila la web en una carpeta propia (con su vercel.json) y la sirve en un puerto */
function preparar(nombre, empaquetar, puerto) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'whider-medir-' + nombre + '-'));
  execFileSync(process.execPath, [path.join(ROOT, 'tools/web-build.js')], {
    cwd: ROOT,
    stdio: 'ignore',
    env: Object.assign({}, process.env, empaquetar ? {} : { WHIDER_SIN_EMPAQUETAR: '1' })
  });
  fs.cpSync(path.join(ROOT, 'dist'), path.join(dir, 'dist'), { recursive: true });
  fs.copyFileSync(path.join(ROOT, 'vercel.json'), path.join(dir, 'vercel.json'));
  const srv = spawn('python3', ['-I', path.join(ROOT, 'tools/servir-web.py'), dir, String(puerto)], {
    stdio: 'ignore'
  });
  return { url: 'http://127.0.0.1:' + puerto + '/app', srv, dir };
}

async function una(b, url, latencia) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
  await ctx.addInitScript(() => {
    window.WHIDER_CONFIG = { firebase: null };
    localStorage.setItem('whider.meta.v1', JSON.stringify({ onboarded: true, createdAt: Date.now() }));
    localStorage.setItem('whider.seenVersion', '999.0.0');
    // Se observa el documento (siempre existe; <html> puede no estar aún) hasta que la app marca «ready»
    new MutationObserver(function (_m, obs) {
      if (document.documentElement && document.documentElement.classList.contains('ready')) {
        /** @type {any} */ (window).__listo = performance.now();
        obs.disconnect();
      }
    }).observe(document, { subtree: true, attributes: true, attributeFilter: ['class'] });
  });
  const p = await ctx.newPage();
  const cdp = await ctx.newCDPSession(p);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  if (latencia)
    await cdp.send('Network.emulateNetworkConditions', {
      offline: false,
      latency: 40,
      downloadThroughput: 1.25e6,
      uploadThroughput: 0.5e6
    });
  let peticiones = 0;
  p.on('request', () => peticiones++);
  await p.goto(url);
  await p.waitForFunction(() => /** @type {any} */ (window).__listo, null, { timeout: 60000 });
  const t = await p.evaluate(() => {
    const nav = /** @type {PerformanceNavigationTiming} */ (performance.getEntriesByType('navigation')[0]);
    return { listo: /** @type {any} */ (window).__listo, dcl: nav.domContentLoadedEventEnd };
  });
  await ctx.close();
  return Object.assign(t, { peticiones });
}

(async () => {
  const con = preparar('con', true, 8671);
  const sin = preparar('sin', false, 8672);
  // Deja dist/ como se publica (empaquetada)
  execFileSync(process.execPath, [path.join(ROOT, 'tools/web-build.js')], { cwd: ROOT, stdio: 'ignore' });
  await sleep(1200);
  const b = await chromium.launch();
  const filas = [];
  for (const latencia of [false, true]) {
    const r = { sin: [], con: [] };
    for (let i = 0; i < VECES; i++) {
      r.sin.push(await una(b, sin.url, latencia));
      r.con.push(await una(b, con.url, latencia));
    }
    const m = (/** @type {any[]} */ a, /** @type {string} */ k) => Math.round(mediana(a.map((x) => x[k])));
    filas.push({
      caso: latencia ? 'Procesador ×4 y 40 ms por petición' : 'Procesador ×4',
      sinListo: m(r.sin, 'listo'),
      conListo: m(r.con, 'listo'),
      sinPet: m(r.sin, 'peticiones'),
      conPet: m(r.con, 'peticiones')
    });
  }
  await b.close();
  con.srv.kill();
  sin.srv.kill();
  console.log('App lista (mediana de ' + VECES + ' primeras visitas), sin empaquetar → empaquetada:');
  for (const f of filas)
    console.log(
      '  ' +
        f.caso.padEnd(36) +
        f.sinListo +
        ' ms → ' +
        f.conListo +
        ' ms (' +
        Math.round((1 - f.conListo / f.sinListo) * 100) +
        ' % menos) · peticiones ' +
        f.sinPet +
        ' → ' +
        f.conPet
    );
  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
