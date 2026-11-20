// La app en inglés (docs/decisiones/0003-idiomas.md): recorre las pantallas ya traducidas, en ordenador y en el móvil,
// y busca lo que se haya quedado en español (letras con tilde y palabras muy comunes) y los textos que se pidieron
// en inglés y no están en el catálogo (W.I18n.missing()). Las tareas de ejemplo van en inglés para no confundirlas.
// Mientras la traducción no esté completa, PANTALLAS solo tiene las que ya lo están.
const { chromium } = require('playwright');
const { APP } = require('./_util');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let fails = 0;
const ok = (c, m, extra) => { console.log((c ? 'OK   ' : 'FAIL ') + m + (!c && extra !== undefined ? '  → ' + JSON.stringify(extra, null, 1).slice(0, 3000) : '')); if (!c) fails++; };
const PANTALLAS = ['home'];
const ESPANOL = /[áéíóúñ¿¡]|\b(de|del|la|las|el|los|que|y|en|con|sin|para|por|una|un|tu|tus|más|hoy|mañana|tarea|tareas|hábito|hábitos|ajustes|cuaderno|nueva|nuevo|ver|todo|nada|semana|día|días|añadir|hecha|hechas|pendientes?|vencidas?)\b/i;

async function abrir(b, movil) {
  const ctx = await b.newContext(movil ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } : { viewport: { width: 1440, height: 900 } });
  await ctx.addInitScript(() => {
    window.WHIDER_CONFIG = { firebase: null };
    localStorage.setItem('whider.lang', 'en');
    localStorage.setItem('whider.meta.v1', JSON.stringify({ onboarded: true, createdAt: Date.now(), seenAchievements: [] }));
  });
  const p = await ctx.newPage();
  p.errs = [];
  p.on('pageerror', (e) => p.errs.push(e.message));
  p.on('console', (m) => { if (m.type() === 'error') p.errs.push('console: ' + m.text()); });
  await p.goto(APP);
  await sleep(1800);
  await p.evaluate(() => {
    Whider.Notify.check = function () {};
    const S = Whider.State, t = Whider.U.today();
    const add = (text, h, time, extra) => S.addTask(Object.assign({ text, date: t, time: time || null, highlight: h || 'none', warn: false }, extra || {}));
    add('Prepare the proposal', 'danger', '10:00'); add('Call Anna', 'purple', '12:00'); add('Check email'); add('Buy bread', 'star');
    add('Send the invoice', 'none', '17:00'); add('Old report', 'none', null, { date: Whider.U.addDays(t, -2) });
    const d = S.addTask({ text: 'Water the plants', date: t }); S.setDone(d.id, true);
    S.addTask({ text: 'Plan the trip', date: Whider.U.addDays(t, 2) });
  });
  return p;
}
/** Texto visible de una pantalla (y de la barra lateral o inferior) más sus etiquetas de accesibilidad */
const leer = (p, scr) => p.evaluate((s) => {
  const zonas = [document.getElementById('screen-' + s), document.getElementById('sidebar'), document.querySelector('.dock')].filter(Boolean);
  const out = [];
  for (const z of zonas) {
    if (z.offsetParent === null && z !== document.getElementById('screen-' + s)) continue;
    z.innerText.split('\n').forEach((l) => { if (l.trim()) out.push(l.trim()); });
    z.querySelectorAll('[aria-label],[title],[placeholder]').forEach((el) => ['aria-label', 'title', 'placeholder'].forEach((a) => { const v = el.getAttribute(a); if (v) out.push('[' + a + '] ' + v); }));
  }
  return out;
}, scr);

(async () => {
  const b = await chromium.launch();
  for (const movil of [false, true]) {
    const p = await abrir(b, movil), donde = movil ? 'móvil' : 'ordenador';
    ok(await p.evaluate(() => document.documentElement.lang === 'en' && Whider.I18n.lang === 'en'), donde + ': la app está en inglés (lang="en")');
    for (const scr of PANTALLAS) {
      await p.evaluate((s) => Whider.Router.go(s), scr);
      await sleep(600);
      const restos = (await leer(p, scr)).filter((l) => ESPANOL.test(l));
      ok(!restos.length, donde + ': «' + scr + '» sin textos en español', restos);
    }
    const faltan = await p.evaluate(() => Whider.I18n.missing());
    ok(!faltan.length, donde + ': todo lo pedido está en el catálogo', faltan);
    ok(!p.errs.length, donde + ': sin errores', p.errs);
    await p.context().close();
  }
  await b.close();
  console.log(fails ? fails + ' FALLOS' : 'TODO OK');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
