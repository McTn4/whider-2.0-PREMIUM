// App de escritorio: versión (la de package.json), tipografía (Inter, también en los títulos), esquinas curvadas, sin Premium, todas
// las secciones sin errores y el tema claro (ventana, barra de título y lo nativo a juego, y recordado al abrir)
const { _electron: electron } = require('playwright');
const { OUT, DESK } = require('./_util');
const fs = require('fs'), os = require('os'), path = require('path');
const PKG = require('../../package.json'), LABEL = PKG.version.replace(/-(alpha|beta|rc)\.(\d+)$/, ' $1 $2');
const sleep = ms => new Promise(r => setTimeout(r, ms));
let fails = 0; const ok = (c, m) => { console.log((c ? 'OK   ' : 'FAIL ') + m); if (!c) fails++; };
(async () => {
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'whider100-'));
  const LAUNCH = { executablePath: path.join(DESK, 'node_modules', '.bin', 'electron'), args: [DESK, '--no-sandbox'], cwd: DESK,
    env: Object.assign({}, process.env, { WHIDER_E2E: '1', WHIDER_USER_DATA: userData, WHIDER_E2E_CONFIG: 'window.WHIDER_CONFIG = { firebase: null };', NODE_OPTIONS: '' }) };
  const app = await electron.launch(LAUNCH);
  const win = await app.firstWindow(); const errs = []; win.on('pageerror', e => errs.push(e.message));
  await win.waitForLoadState('domcontentloaded'); await sleep(3000);
  await win.evaluate(() => { localStorage.setItem('whider.meta.v1', JSON.stringify({ onboarded: true, createdAt: Date.now() })); });
  await win.reload(); await sleep(3000);
  await win.evaluate(() => { if (Whider.Onboarding.isOpen()) document.querySelector('#onboardingRoot .nav-btn').click(); }); await sleep(600);
  const v = await app.evaluate(({ app }) => app.getVersion());
  ok(v === PKG.version, 'versión de la app de escritorio (la de package.json): ' + v);
  const info = await win.evaluate(async () => {
    await document.fonts.ready;
    const el = document.querySelector('.btn, .tb-new'), cs = getComputedStyle(el), h1 = document.querySelector('.screen.active .lt h1') || document.querySelector('.lt h1');
    return { font: document.fonts.check('16px Inter'), display: [...document.fonts].some(f => f.family.replace(/"/g, '') === 'Inter' && f.status === 'loaded'), family: getComputedStyle(document.body).fontFamily, h1: h1 ? getComputedStyle(h1).fontFamily : '', radius: cs.borderTopLeftRadius, cs: cs.getPropertyValue('corner-shape') || '', plan: typeof Whider.Plan };
  });
  ok(info.font && /Inter/.test(info.family), 'tipografía Inter cargada (' + info.family.split(',')[0] + ')');
  ok(info.display && /^"?Inter/.test(info.h1), 'títulos también en Inter (' + info.h1.split(',')[0] + ')');
  ok(parseFloat(info.radius) > 0 && !/bevel|superellipse\(0\)/.test(info.cs), 'esquinas curvadas (radio ' + info.radius + (info.cs ? ', corner-shape ' + info.cs : '') + ')');
  ok(info.plan === 'undefined', 'sin módulo de planes');
  for (const id of ['home', 'tasks', 'calendar', 'notes', 'chats', 'friends']) {
    await win.evaluate(id => Whider.Router.go(id), id); await sleep(450);
  }
  const txt = await win.evaluate(() => document.body.innerText);
  ok(!/premium|suscrib|planes y precios/i.test(txt), 'sin rastro de Premium en el ordenador');
  // 2.1: Microsoft y Apple se completan en el navegador (el puente llega al proceso principal; con otro proveedor, nada)
  const puente = await win.evaluate(async () => ({ fns: typeof window.WhiderDesktop.browserSignIn === 'function' && typeof window.WhiderDesktop.cancelBrowserSignIn === 'function', otro: await window.WhiderDesktop.browserSignIn('facebook.com') }));
  ok(puente.fns && puente.otro && puente.otro.ok === false && puente.otro.detail === 'provider', 'el puente para entrar con Microsoft y Apple en el navegador ' + JSON.stringify(puente.otro));
  // Sin engranaje: tu foto y tu nombre abren el panel de tu cuenta
  await win.evaluate(() => Whider.Router.go('home')); await sleep(400);
  await win.click('#topbar .tb-me'); await sleep(500);
  ok(await win.evaluate(() => !!document.querySelector('.menu.acct-pop') && !document.querySelector('use[href="#i-gear"]')), 'tu foto abre el panel de tu cuenta (sin engranaje)');
  await win.keyboard.press('Escape'); await sleep(300);
  await win.evaluate(() => Whider.Settings.open()); await sleep(600);
  ok((await win.evaluate(() => document.querySelector('.sheet-root').innerText)).includes('WHIDER ' + LABEL), 'Ajustes muestra «WHIDER ' + LABEL + '»');
  await win.evaluate(() => { while (Whider.Sheet.closeTop()); Whider.Router.go('home'); }); await sleep(500);
  await win.screenshot({ path: path.join(OUT, 'electron-hoy-1.0.png') });

  // Tema claro: la ventana (fondo y barra de título) y lo nativo (menús y diálogos) lo siguen
  const nat = () => app.evaluate(({ nativeTheme, BrowserWindow }) => ({ src: nativeTheme.themeSource, th: global.__whider.theme, bg: BrowserWindow.getAllWindows()[0].getBackgroundColor() }));
  const page = () => win.evaluate(() => ({ th: document.documentElement.getAttribute('data-theme'), bg: getComputedStyle(document.body).backgroundColor }));
  let n = await nat();
  ok(n.src === 'dark' && n.th === 'dark' && /^#121316$/i.test(n.bg), 'empieza con el tema oscuro (ventana ' + n.bg + ', nativo ' + n.src + ')');
  await win.evaluate(() => Whider.State.setSetting('theme', 'light')); await sleep(500);
  n = await nat(); const pg = await page();
  ok(pg.th === 'light' && pg.bg === 'rgb(246, 247, 249)' && n.th === 'light' && n.src === 'light' && /^#F6F7F9$/i.test(n.bg),
    'tema claro: la página (' + pg.bg + '), la ventana (' + n.bg + ') y lo nativo (' + n.src + ')');
  await win.evaluate(() => Whider.State.setSetting('theme', 'system')); await sleep(500);
  n = await nat();
  ok(n.src === 'system', '«Como el sistema»: lo nativo sigue al sistema, así la página ve sus cambios (' + n.src + ')');
  await win.evaluate(() => Whider.State.setSetting('theme', 'light')); await sleep(500);
  await win.screenshot({ path: path.join(OUT, 'electron-hoy-claro.png') });
  // Los menús siguen el idioma de la app: en español por defecto, en inglés al cambiarlo (y se recuerda)
  const menus = () => app.evaluate(({ Menu }) => Menu.getApplicationMenu().items.map((i) => i.label));
  ok((await menus()).includes('Archivo'), 'menús en español ' + JSON.stringify(await menus()));
  await win.evaluate(() => { localStorage.setItem('whider.lang', 'en'); location.reload(); });
  await win.waitForLoadState(); await sleep(1500);
  const en = await menus();
  ok(en.includes('File') && en.includes('Edit') && en.includes('View') && !en.includes('Archivo'), 'menús en inglés al cambiar el idioma ' + JSON.stringify(en));
  await win.evaluate(() => { localStorage.setItem('whider.lang', 'es'); location.reload(); });
  await win.waitForLoadState(); await sleep(1500);
  ok((await menus()).includes('Archivo'), 'y de vuelta en español');
  ok(!errs.length, 'sin errores ' + JSON.stringify(errs.slice(0, 3)));
  await app.close();
  // Se recuerda: al abrir de nuevo, la ventana nace ya clara (sin destello oscuro antes de cargar la página)
  const saved = JSON.parse(fs.readFileSync(path.join(userData, 'whider-desktop.json'), 'utf8'));
  ok(saved.theme === 'light' && saved.themeSystem === false, 'guarda el tema para la próxima vez ' + JSON.stringify({ theme: saved.theme, themeSystem: saved.themeSystem }));
  const app2 = await electron.launch(LAUNCH);
  await app2.firstWindow();
  const n2 = await app2.evaluate(({ nativeTheme, BrowserWindow }) => ({ src: nativeTheme.themeSource, bg: BrowserWindow.getAllWindows()[0].getBackgroundColor() }));
  ok(n2.src === 'light' && /^#F6F7F9$/i.test(n2.bg), 'al abrir otra vez, la ventana ya sale clara (' + n2.bg + ', nativo ' + n2.src + ')');
  await app2.close();
  console.log(fails ? fails + ' FALLOS' : 'TODO OK'); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
