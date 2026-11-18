// App de escritorio: versión (la de package.json), tipografías (Onest y Outfit), esquinas curvadas, sin Premium y todas las secciones sin errores
const { _electron: electron } = require('playwright');
const { OUT, DESK } = require('./_util');
const fs = require('fs'), os = require('os'), path = require('path');
const PKG = require('../../package.json'), LABEL = PKG.version.replace(/-(alpha|beta|rc)\.(\d+)$/, ' $1 $2');
const sleep = ms => new Promise(r => setTimeout(r, ms));
let fails = 0; const ok = (c, m) => { console.log((c ? 'OK   ' : 'FAIL ') + m); if (!c) fails++; };
(async () => {
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'whider100-'));
  const app = await electron.launch({ executablePath: path.join(DESK, 'node_modules', '.bin', 'electron'), args: [DESK, '--no-sandbox'], cwd: DESK,
    env: Object.assign({}, process.env, { WHIDER_E2E: '1', WHIDER_USER_DATA: userData, WHIDER_E2E_CONFIG: 'window.WHIDER_CONFIG = { firebase: null };', NODE_OPTIONS: '' }) });
  const win = await app.firstWindow(); const errs = []; win.on('pageerror', e => errs.push(e.message));
  await win.waitForLoadState('domcontentloaded'); await sleep(3000);
  await win.evaluate(() => { localStorage.setItem('whider.meta.v1', JSON.stringify({ onboarded: true, createdAt: Date.now() })); });
  await win.reload(); await sleep(3000);
  await win.evaluate(() => { if (Whider.Onboarding.isOpen()) document.querySelector('#onboardingRoot .nav-btn').click(); }); await sleep(600);
  const v = await app.evaluate(({ app }) => app.getVersion());
  ok(v === PKG.version, 'versión de la app de escritorio (la de package.json): ' + v);
  const info = await win.evaluate(async () => {
    await document.fonts.ready;
    const el = document.querySelector('.btn, .sb-new'), cs = getComputedStyle(el), h1 = document.querySelector('.screen.active .lt h1') || document.querySelector('.lt h1');
    return { font: document.fonts.check('16px Onest'), display: [...document.fonts].some(f => f.family.replace(/"/g, '') === 'Outfit' && f.status === 'loaded'), family: getComputedStyle(document.body).fontFamily, h1: h1 ? getComputedStyle(h1).fontFamily : '', radius: cs.borderTopLeftRadius, cs: cs.getPropertyValue('corner-shape') || '', plan: typeof Whider.Plan };
  });
  ok(info.font && /Onest/.test(info.family), 'tipografía Onest cargada (' + info.family.split(',')[0] + ')');
  ok(info.display && /^"?Outfit/.test(info.h1), 'títulos en Outfit (' + info.h1.split(',')[0] + ')');
  ok(parseFloat(info.radius) > 0 && !/bevel|superellipse\(0\)/.test(info.cs), 'esquinas curvadas (radio ' + info.radius + (info.cs ? ', corner-shape ' + info.cs : '') + ')');
  ok(info.plan === 'undefined', 'sin módulo de planes');
  for (const id of ['home', 'tasks', 'calendar', 'notes', 'chats', 'friends', 'habits', 'focus', 'automations', 'stats', 'reports', 'progress']) {
    await win.evaluate(id => Whider.Router.go(id), id); await sleep(450);
  }
  const txt = await win.evaluate(() => document.body.innerText);
  ok(!/premium|suscrib|planes y precios/i.test(txt), 'sin rastro de Premium en el ordenador');
  await win.evaluate(() => Whider.Settings.open()); await sleep(600);
  ok((await win.evaluate(() => document.querySelector('.sheet-root').innerText)).includes('WHIDER ' + LABEL), 'Ajustes muestra «WHIDER ' + LABEL + '»');
  await win.evaluate(() => { while (Whider.Sheet.closeTop()); Whider.Router.go('home'); }); await sleep(500);
  await win.screenshot({ path: path.join(OUT, 'electron-hoy-1.0.png') });
  ok(!errs.length, 'sin errores ' + JSON.stringify(errs.slice(0, 3)));
  await app.close();
  console.log(fails ? fails + ' FALLOS' : 'TODO OK'); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
