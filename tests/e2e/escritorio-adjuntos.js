// App de escritorio 8.0: adjuntos del Cuaderno con el puente nativo (abrir con la app del sistema,
// guardar donde se elija, no abrir programas) y el Cuaderno a todo el ancho, bajo la barra superior
const { _electron: electron } = require('playwright');
const { FX, OUT, DESK, fixtures } = require('./_util');
const fs = require('fs'), os = require('os'), path = require('path');
const sleep = ms => new Promise(r => setTimeout(r, ms));
let fails = 0; const ok = (c, m) => { console.log((c ? 'OK   ' : 'FAIL ') + m); if (!c) fails++; };
(async () => {
  { const { chromium } = require('playwright'); const tmp = await chromium.launch(); await fixtures(tmp); await tmp.close(); }
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'whider80-'));
  fs.writeFileSync(path.join(FX, 'instalar.bat'), '@echo off\r\necho hola\r\n');
  const app = await electron.launch({ executablePath: path.join(DESK, 'node_modules', '.bin', 'electron'), args: [DESK, '--no-sandbox'], cwd: DESK,
    env: Object.assign({}, process.env, { WHIDER_E2E: '1', WHIDER_USER_DATA: userData, WHIDER_E2E_CONFIG: 'window.WHIDER_CONFIG = { firebase: null };', NODE_OPTIONS: '' }) });
  const win = await app.firstWindow(); const errs = []; win.on('pageerror', e => errs.push(e.message));
  await win.waitForLoadState('domcontentloaded'); await sleep(3500);
  await win.evaluate(() => { localStorage.setItem('whider.meta.v1', JSON.stringify({ onboarded: true, createdAt: Date.now() })); });
  await win.reload(); await sleep(3500);
  await win.evaluate(() => { Whider.Notify.check = function () {}; if (Whider.Onboarding.isOpen()) document.querySelector('#onboardingRoot .nav-btn').click(); });
  await win.setViewportSize ? null : null;
  await win.evaluate(() => Whider.Router.go('notes')); await sleep(1500);
  const id = await win.evaluate(() => { const P = Whider.Pages; const m = P.create({ title: 'Contrato', blocks: [P.block('p', 'Adjuntos:'), P.block('p', '')] }); Whider.Notes.openPage(m.id); return m.id; });
  await sleep(1200);
  ok(await win.evaluate(() => !!window.WhiderDesktop && typeof window.WhiderDesktop.openFile === 'function' && typeof window.WhiderDesktop.saveBinary === 'function'), 'el puente de escritorio ofrece abrir y guardar archivos');
  const top = await win.evaluate(() => ({ h: Math.round(document.getElementById('topbar').getBoundingClientRect().height), left: Math.round(document.getElementById('screen-notes').getBoundingClientRect().left) }));
  ok(top.h > 0 && top.h <= 64 && top.left === 0, 'el Cuaderno usa todo el ancho, bajo la barra superior (' + top.h + ' px)');
  await win.click('#screen-notes .bk-text >> nth=0');
  const [fc] = await Promise.all([win.waitForEvent('filechooser'), win.click('.pg-addons button:has-text("Adjuntar")')]);
  await fc.setFiles([path.join(FX, 'Factura marzo.pdf'), path.join(FX, 'instalar.bat')]); await sleep(1500);
  const n = await win.evaluate(id => Whider.Pages.content(id).blocks.filter(b => b.f).length, id);
  ok(n === 2, 'dos archivos adjuntos en la página');
  // Abrir el PDF: copia temporal y aplicación del sistema (en la prueba solo se anota)
  await win.locator('.bkf').first().locator('.bkf-main').click(); await sleep(1500);
  const opened = await app.evaluate(() => global.__whider.openedFiles || []);
  ok(opened.length === 1 && /Factura marzo\.pdf$/.test(opened[0]) && fs.statSync(opened[0]).size === fs.statSync(path.join(FX, 'Factura marzo.pdf')).size, 'Abrir: copia temporal completa para la app del sistema → ' + opened[0]);
  // Descargar: se guarda (en la prueba, en la carpeta de datos, sin diálogo) y avisa con «Mostrar»
  await win.locator('.bkf').first().locator('.bkf-btn').first().click(); await sleep(1500);
  const saved = path.join(userData, 'exports', 'Factura marzo.pdf');
  ok(fs.existsSync(saved) && fs.readFileSync(saved).equals(fs.readFileSync(path.join(FX, 'Factura marzo.pdf'))), 'Descargar: guardado idéntico al original');
  const toast = await win.evaluate(() => document.getElementById('toastRoot').textContent);
  ok(/Guardado en/.test(toast) && /Mostrar/.test(toast), 'avisa dónde se guardó, con «Mostrar» → ' + toast.slice(0, 80));
  // Un programa adjunto (.bat) nunca se abre
  await win.evaluate(() => { document.getElementById('toastRoot').innerHTML = ''; });
  await win.locator('.bkf').nth(1).locator('.bkf-main').click(); await sleep(1200);
  const opened2 = await app.evaluate(() => global.__whider.openedFiles || []);
  const toast2 = await win.evaluate(() => document.getElementById('toastRoot').textContent);
  ok(opened2.length === 1 && /no abre programas/.test(toast2), 'un .bat adjunto no se abre y se explica por qué → ' + toast2.slice(0, 70));
  await win.screenshot({ path: path.join(OUT, 'electron-cuaderno.png') });
  ok(!errs.length, 'sin errores ' + JSON.stringify(errs.slice(0, 3)));
  await app.close();
  console.log(fails ? fails + ' FALLOS' : 'TODO OK'); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
