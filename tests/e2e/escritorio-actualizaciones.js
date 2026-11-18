// 1.1 · App de escritorio: versiones nuevas. Un servidor local hace de GitHub.
//  - «Aviso» (como en macOS y Linux .deb): la última publicación trae una versión nueva → aviso del sistema,
//    aviso en la app con «Descargar» (el instalador de esa publicación) y el estado en Ajustes; con la misma
//    versión, «Tienes la última versión»; si GitHub no responde, se dice sin tecnicismos.
//  - «Automática» (como en Windows y Linux AppImage): electron-updater descarga de verdad la versión nueva,
//    comprueba su SHA-512 y la deja lista (aviso con «Reiniciar ahora»); una descarga alterada se rechaza.
//  - La versión de la app (package.json) en Ajustes y «Buscar actualizaciones» en los menús.
const { _electron: electron } = require('playwright');
const { OUT, DESK } = require('./_util');
const http = require('http'), crypto = require('crypto');
const fs = require('fs'), os = require('os'), path = require('path');
const PKG = require('../../package.json');

const LABEL = PKG.version.replace(/-(alpha|beta|rc)\.(\d+)$/, ' $1 $2');
const REL = 'https://github.com/McTn4/whider-2.0-PREMIUM/releases/download/v9.9.9/';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let fails = 0;
const ok = (c, m, x) => { console.log((c ? 'OK   ' : 'FAIL ') + m + (!c && x !== undefined ? '  → ' + JSON.stringify(x) : '')); if (!c) fails++; };

/* ---------- «GitHub» de mentira ---------- */
const BIN = crypto.randomBytes(256 * 1024);
const sha512 = (b) => crypto.createHash('sha512').update(b).digest('base64');
const srv = { api: null, apiStatus: 200, feedSha: sha512(BIN), hits: { api: 0, yml: 0, bin: 0 } };
function publicacion(tag) {
  return { tag_name: tag, draft: false, prerelease: false, html_url: 'https://github.com/McTn4/whider-2.0-PREMIUM/releases/tag/' + tag,
    assets: ['WHIDER-Setup.exe', 'WHIDER-mac-arm64.dmg', 'WHIDER-mac-x64.dmg', 'WHIDER-linux.AppImage', 'WHIDER-linux.deb'].map((name) => ({ name, browser_download_url: REL + name })) };
}
const server = http.createServer((req, res) => {
  if (req.url === '/api/latest') {
    srv.hits.api++;
    res.writeHead(srv.apiStatus, { 'content-type': 'application/json' });
    res.end(srv.apiStatus === 200 ? JSON.stringify(srv.api) : JSON.stringify({ message: 'API rate limit exceeded' }));
  } else if (req.url.startsWith('/feed/latest-linux.yml')) {
    srv.hits.yml++;
    res.writeHead(200, { 'content-type': 'text/yaml' });
    res.end('version: 9.9.9\nfiles:\n  - url: WHIDER-linux.AppImage\n    sha512: ' + srv.feedSha + '\n    size: ' + BIN.length +
      '\npath: WHIDER-linux.AppImage\nsha512: ' + srv.feedSha + "\nreleaseDate: '2026-11-18T08:00:00.000Z'\n");
  } else if (req.url.startsWith('/feed/WHIDER-linux.AppImage')) {
    srv.hits.bin++;
    res.writeHead(200, { 'content-type': 'application/octet-stream', 'content-length': BIN.length });
    res.end(BIN);
  } else { res.writeHead(404); res.end(); }
});

async function abrir(extra) {
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'whider-upd-'));
  const env = Object.assign({}, process.env, { WHIDER_E2E: '1', WHIDER_USER_DATA: userData, WHIDER_E2E_CONFIG: 'window.WHIDER_CONFIG = { firebase: null };',
    NODE_OPTIONS: '', WHIDER_UPDATE_TEST: '1', XDG_CACHE_HOME: path.join(userData, 'cache') });
  delete env.APPIMAGE;
  for (const k of Object.keys(extra)) env[k] = extra[k];
  const app = await electron.launch({ executablePath: path.join(DESK, 'node_modules', '.bin', 'electron'), args: [DESK, '--no-sandbox'], cwd: DESK, env });
  const win = await app.firstWindow();
  win.errs = [];
  win.on('pageerror', (e) => win.errs.push(e.message));
  await win.waitForLoadState('domcontentloaded');
  await sleep(2500);
  await win.evaluate(() => { localStorage.setItem('whider.meta.v1', JSON.stringify({ onboarded: true, createdAt: Date.now() })); localStorage.setItem('whider.seenVersion', Whider.VERSION); });
  await win.reload();
  await sleep(2500);
  await win.evaluate(() => { Whider.Notify.check = function () {}; if (Whider.Onboarding.isOpen()) document.querySelector('#onboardingRoot .nav-btn').click(); });
  return { app, win, userData };
}
async function esperar(win, estado, ms) {
  for (let t = 0; t < ms; t += 250) {
    const s = await win.evaluate(() => Whider.Updates.state());
    if (s.state === estado) return s;
    await sleep(250);
  }
  return win.evaluate(() => Whider.Updates.state());
}
const textoAjustes = async (win) => {
  await win.evaluate(() => { while (Whider.Sheet.closeTop()); Whider.Settings.open('desktop'); });
  await sleep(600);
  return win.evaluate(() => document.querySelector('#sheetRoot').innerText);
};

(async () => {
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const BASE = 'http://127.0.0.1:' + server.address().port;

  /* ---------- 1. Aviso con enlace (macOS y .deb) ---------- */
  srv.api = publicacion('v9.9.9');
  {
    const { app, win } = await abrir({ WHIDER_UPDATE_API: BASE + '/api/latest' });
    ok(await app.evaluate(({ app }) => app.getVersion()) === PKG.version, 'la app de escritorio lleva la versión de package.json (' + PKG.version + ')');
    const s = await esperar(win, 'available', 12000);
    ok(s.mode === 'notify' && s.version === '9.9.9', 'encuentra la versión 9.9.9 en la última publicación', s);
    ok(s.url === REL + 'WHIDER-linux.deb', 'el enlace es el instalador de este sistema (.deb en Linux sin AppImage)', s.url);
    const notes = await app.evaluate(() => global.__whider.notifications || []);
    ok(notes.some((n) => /versión nueva/.test(n.title) && /9\.9\.9/.test(n.body)), 'aviso del sistema: «Hay una versión nueva de WHIDER»', notes);
    const toast = await win.evaluate(() => [...document.querySelectorAll('.toast')].map((t) => t.innerText).join(' | '));
    ok(/versión nueva de WHIDER: la 9\.9\.9/.test(toast) && /Descargar/.test(toast), 'aviso en la app con «Descargar»', toast);
    await win.click('.toast button:has-text("Descargar")');
    await sleep(300);
    ok((await app.evaluate(() => global.__whider.externalUrls)).includes(REL + 'WHIDER-linux.deb'), '«Descargar» abre el instalador en el navegador');
    let txt = await textoAjustes(win);
    ok(txt.includes('WHIDER ' + LABEL) && /Hay una versión nueva: la 9\.9\.9/.test(txt), 'Ajustes → App de escritorio: versión y «Hay una versión nueva»', txt.slice(0, 400));
    await win.screenshot({ path: path.join(OUT, 'escritorio-actualizacion-aviso.png') });

    // Misma versión: al día
    srv.api = publicacion('v' + PKG.version);
    await win.evaluate(() => Whider.Updates.check(true));
    await sleep(400);
    txt = await textoAjustes(win);
    ok(/Tienes la última versión/.test(txt), 'con la misma versión: «Tienes la última versión»', txt.slice(0, 400));
    // Una beta publicada no se ofrece a quien no la pidió
    srv.api = Object.assign(publicacion('v9.9.9-beta.1'), { prerelease: true });
    ok((await win.evaluate(() => Whider.Updates.check(true))).state === 'latest', 'las versiones de prueba no se ofrecen');
    // GitHub no responde
    srv.apiStatus = 403;
    const e = await win.evaluate(() => Whider.Updates.check(true));
    ok(e.state === 'error' && /GitHub no responde/.test(e.error), 'si GitHub no responde, se dice sin tecnicismos', e);
    srv.apiStatus = 200;
    // Menús
    const menus = await app.evaluate(({ Menu }) => Menu.getApplicationMenu().items.find((i) => i.label === 'Ayuda').submenu.items.map((i) => i.label));
    ok(menus.includes('Buscar actualizaciones…') && menus.includes('Novedades'), 'menú Ayuda: «Novedades» y «Buscar actualizaciones…»', menus);
    ok(!win.errs.length, 'sin errores', win.errs);
    await app.close();
  }

  /* ---------- 2. Actualización automática (Windows y AppImage) ---------- */
  {
    const viejo = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'whider-appimage-')), 'WHIDER-linux.AppImage');
    fs.writeFileSync(viejo, 'app anterior');
    const { app, win } = await abrir({ APPIMAGE: viejo, WHIDER_UPDATE_FEED: BASE + '/feed/' });
    const s = await esperar(win, 'ready', 25000);
    ok(s.mode === 'auto' && s.state === 'ready' && s.version === '9.9.9', 'descarga la 9.9.9 en segundo plano y comprueba su SHA-512', s);
    ok(srv.hits.yml >= 1 && srv.hits.bin >= 1, 'pidió la descripción de la versión y el archivo', srv.hits);
    const notes = await app.evaluate(() => global.__whider.notifications || []);
    ok(notes.some((n) => /Actualización lista/.test(n.title)), 'aviso del sistema: «Actualización lista»', notes);
    const toast = await win.evaluate(() => [...document.querySelectorAll('.toast')].map((t) => t.innerText).join(' | '));
    ok(/9\.9\.9 está lista/.test(toast) && /Reiniciar ahora/.test(toast), 'aviso en la app con «Reiniciar ahora»', toast);
    const txt = await textoAjustes(win);
    ok(/La 9\.9\.9 está lista: se instala al cerrar WHIDER/.test(txt) && /Reiniciar/.test(txt), 'Ajustes: «está lista» y el botón «Reiniciar»', txt.slice(0, 400));
    await win.screenshot({ path: path.join(OUT, 'escritorio-actualizacion-lista.png') });
    ok(fs.readFileSync(viejo, 'utf8') === 'app anterior', 'no se toca la app instalada hasta reiniciar');
    ok(!win.errs.length, 'sin errores', win.errs);
    await app.close();
  }

  /* ---------- 3. Una descarga alterada no se instala ---------- */
  {
    srv.feedSha = sha512(Buffer.from('otra cosa'));
    const viejo = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'whider-appimage-')), 'WHIDER-linux.AppImage');
    fs.writeFileSync(viejo, 'app anterior');
    const { app, win } = await abrir({ APPIMAGE: viejo, WHIDER_UPDATE_FEED: BASE + '/feed/' });
    const s = await esperar(win, 'error', 25000);
    ok(s.state === 'error' && /comprobación de seguridad/.test(s.error || ''), 'si la suma SHA-512 no coincide, se rechaza', s);
    ok(fs.readFileSync(viejo, 'utf8') === 'app anterior', 'y la app instalada sigue igual');
    await app.close();
  }

  server.close();
  console.log(fails ? fails + ' FALLOS' : 'TODO OK');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
