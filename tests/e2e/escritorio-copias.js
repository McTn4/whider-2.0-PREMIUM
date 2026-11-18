// 1.1 · App de escritorio: copias automáticas. Una al día en la carpeta de datos (las 10 últimas), con la lista
// para recuperarlas y «Abrir la carpeta». Desde la app web solo se pueden escribir y leer esas copias.
const { _electron: electron } = require('playwright');
const { DESK } = require('./_util');
const fs = require('fs'), os = require('os'), path = require('path');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let fails = 0;
const ok = (c, m, x) => { console.log((c ? 'OK   ' : 'FAIL ') + m + (!c && x !== undefined ? '  → ' + JSON.stringify(x) : '')); if (!c) fails++; };

(async () => {
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'whider-copias-'));
  const dir = path.join(userData, 'Copias');
  const app = await electron.launch({ executablePath: path.join(DESK, 'node_modules', '.bin', 'electron'), args: [DESK, '--no-sandbox'], cwd: DESK,
    env: Object.assign({}, process.env, { WHIDER_E2E: '1', WHIDER_USER_DATA: userData, WHIDER_E2E_CONFIG: 'window.WHIDER_CONFIG = { firebase: null };', NODE_OPTIONS: '' }) });
  const win = await app.firstWindow();
  const errs = [];
  win.on('pageerror', (e) => errs.push(e.message));
  await win.waitForLoadState('domcontentloaded');
  await sleep(2500);
  await win.evaluate(() => { localStorage.setItem('whider.meta.v1', JSON.stringify({ onboarded: true, createdAt: Date.now() })); localStorage.setItem('whider.seenVersion', '999.0.0'); });
  await win.reload();
  await sleep(2500);
  await win.evaluate(() => { Whider.Notify.check = function () {}; });

  ok(await win.evaluate(() => Whider.Backup.where() === 'desktop' && Whider.Backup.enabled()), 'en el ordenador, sin cuenta: copia automática encendida');
  ok((await win.evaluate(() => Whider.Backup.run(false))).reason === 'not-due', 'sin datos todavía, no hace copias vacías');
  await win.evaluate(() => { Whider.State.addTask({ text: 'Revisar el presupuesto', date: Whider.U.today() }); Whider.State.addTask({ text: 'Llamar al dentista' }); });
  const r = await win.evaluate(() => Whider.Backup.run(false));
  const hoy = await win.evaluate(() => Whider.U.today());
  const file = path.join(dir, 'whider-copia-auto-' + hoy + '.json');
  ok(r.ok && r.where === 'desktop' && fs.existsSync(file), 'la copia del día queda en la carpeta de datos', r);
  const copia = JSON.parse(fs.readFileSync(file, 'utf8'));
  ok(copia.tasks.length === 2 && Array.isArray(copia.pages) && copia.backup && copia.backup.app === 'WHIDER', 'con las tareas, el Cuaderno y la versión', Object.keys(copia));
  ok((await win.evaluate(() => Whider.Backup.run(false))).reason === 'not-due', 'una sola al día');

  // Solo las 10 últimas
  for (let d = 1; d <= 12; d++) fs.writeFileSync(path.join(dir, 'whider-copia-auto-2026-10-' + String(d).padStart(2, '0') + '.json'), '{"tasks":[]}');
  await win.evaluate(() => Whider.Backup.run(true));
  const quedan = fs.readdirSync(dir).filter((n) => n.endsWith('.json')).sort();
  ok(quedan.length === 10 && quedan.includes('whider-copia-auto-' + hoy + '.json') && !quedan.includes('whider-copia-auto-2026-10-01.json'), 'se guardan las 10 últimas', quedan);

  // Desde la app web no se puede escribir ni leer otra cosa
  const mal = await win.evaluate(() => Promise.all([window.WhiderDesktop.backup.write('../../.bashrc', 'x'), window.WhiderDesktop.backup.read('../whider-desktop.json')]));
  ok(mal[0].ok === false && mal[1] === null, 'nombres que no son de copias: ni escribir ni leer', mal);

  await win.evaluate(() => Whider.Settings.open('data'));
  await sleep(700);
  const datos = await win.evaluate(() => document.querySelector('#sheetRoot').innerText);
  ok(/Copia automática cada día/.test(datos) && /Última: /.test(datos) && /carpeta de datos de WHIDER/.test(datos), 'Ajustes → Datos: interruptor, última copia y dónde está', datos.slice(0, 300));

  // Se pierden los datos del dispositivo (se borra el almacenamiento) → Ajustes → Datos → Copias guardadas → Recuperar
  await win.evaluate(() => { localStorage.clear(); localStorage.setItem('whider.meta.v1', JSON.stringify({ onboarded: true, createdAt: Date.now() })); localStorage.setItem('whider.seenVersion', '999.0.0'); });
  await win.reload();
  await sleep(2500);
  ok((await win.evaluate(() => Whider.State.tasks.length)) === 0, 'sin datos en el dispositivo (como si se hubieran perdido)');
  await win.evaluate(() => Whider.Settings.open('data'));
  await sleep(700);
  await win.click('#sheetRoot .cell:has-text("Copias guardadas")');
  await sleep(800);
  await win.click('#sheetRoot button[aria-label^="Recuperar la copia del"] >> nth=0');
  await sleep(500);
  await win.click('.alert-layer .alert-actions button:has-text("Recuperar")');
  await sleep(800);
  ok(await win.evaluate(() => Whider.State.tasks.length === 2 && Whider.State.tasks.some((t) => t.text === 'Llamar al dentista')), 'recuperar la copia de hoy devuelve las tareas');
  await win.evaluate(() => { for (let i = 0; i < 8 && Whider.Sheet.closeTop(); i++); Whider.Settings.open('data'); });
  await sleep(600);
  await win.click('#sheetRoot .cell:has-text("Copias guardadas")');
  await sleep(600);
  await win.click('#sheetRoot button:has-text("Abrir la carpeta")');
  await sleep(300);
  ok((await app.evaluate(() => global.__whider.openedBackups)) === dir, '«Abrir la carpeta» abre la de las copias');

  // Apagarla
  await win.evaluate(() => Whider.Backup.setEnabled(false));
  ok((await win.evaluate(() => Whider.Backup.run(false))).reason === 'not-due', 'apagada, no hace copias');
  ok(!errs.length, 'sin errores', errs);
  await app.close();
  console.log(fails ? fails + ' FALLOS' : 'TODO OK');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
