// La app en inglés (docs/decisiones/0003-idiomas.md): recorre las pantallas ya traducidas, en ordenador y en el móvil,
// y busca lo que se haya quedado en español (letras con tilde y palabras muy comunes) y los textos que se pidieron
// en inglés y no están en el catálogo (W.I18n.missing()). Las tareas de ejemplo van en inglés para no confundirlas.
// Mientras la traducción no esté completa, PANTALLAS y HOJAS solo tienen las que ya lo están.
const { chromium } = require('playwright');
const { APP } = require('./_util');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let fails = 0;
const ok = (c, m, extra) => { console.log((c ? 'OK   ' : 'FAIL ') + m + (!c && extra !== undefined ? '  → ' + JSON.stringify(extra, null, 1).slice(0, 3000) : '')); if (!c) fails++; };
// «calendar:week» abre el calendario en esa vista (en el móvil no hay vista de día)
const PANTALLAS = ['home', 'tasks', 'calendar:month', 'calendar:week', 'calendar:day', 'calendar:agenda', 'focus', 'progress', 'records', 'more', 'stats', 'reports', 'friends', 'chats', 'automations'];
// Hojas que se abren encima (Ajustes y sus páginas, la ayuda, los atajos, el importador, el editor de tareas…)
const HOJAS = [
  ['ajustes', () => Whider.Settings.open()],
  ...['appearance', 'custom', 'sounds', 'alerts', 'tasks', 'lists', 'habits', 'focus', 'start', 'data', 'privacy', 'desktop'].map((pg) => ['ajustes › ' + pg, (x) => Whider.Settings.open(x), pg]),
  ['preguntas frecuentes', () => Whider.Help.faq()],
  ['enviar comentarios', () => Whider.Help.feedback()],
  ['atajos de teclado', () => Whider.Keys.help(), null, 'ordenador'],
  ['importar', () => Whider.ImportWizard.open()],
  ['plantilla nueva', () => Whider.Templates.edit()],
  ['tarea nueva', () => Whider.Editor.open()],
  ['regla nueva', () => Whider.Screens.automations.edit(null)],
  ['editar regla', () => Whider.Screens.automations.edit(Whider.State.rules[0])],
  ['editar tarea', () => Whider.Editor.open(Whider.State.tasks.find((t) => t.text === 'Prepare the proposal').id)]
];
const ESPANOL = /[áéíóúñ¿¡]|\b(de|del|la|las|el|los|que|y|en|con|sin|para|por|una|un|tu|tus|más|hoy|mañana|tarea|tareas|hábito|hábitos|ajustes|cuaderno|nueva|nuevo|ver|todo|nada|semana|día|días|añadir|hecha|hechas|pendientes?|vencidas?|fecha|lugar|objetivo|asignatura|nombre|estado|página|páginas)\b/i;

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
    // Una regla propia, para ver su resumen («Every day at 7:00, if date: is overdue → date today»)
    const tp = Whider.Auto.TEMPLATES[0];
    S.saveRule(Object.assign({ name: 'Morning sweep', enabled: true }, JSON.parse(JSON.stringify(tp.rule))));
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

/** Todo el texto de las hojas abiertas (u otra zona), también el que está plegado (las respuestas de las preguntas frecuentes) */
const leerHojas = (p, sel) => p.evaluate((selector) => {
  const out = [];
  document.querySelectorAll(selector || '.sheet-layer').forEach((z) => {
    const tw = document.createTreeWalker(z, NodeFilter.SHOW_TEXT);
    for (let n = tw.nextNode(); n; n = tw.nextNode()) n.nodeValue.split('\n').forEach((l) => { if (l.trim()) out.push(l.trim()); });
    z.querySelectorAll('[aria-label],[title],[placeholder]').forEach((el) => ['aria-label', 'title', 'placeholder'].forEach((a) => { const v = el.getAttribute(a); if (v) out.push('[' + a + '] ' + v); }));
  });
  return out;
}, sel);

(async () => {
  const b = await chromium.launch();
  for (const movil of [false, true]) {
    const p = await abrir(b, movil), donde = movil ? 'móvil' : 'ordenador';
    ok(await p.evaluate(() => document.documentElement.lang === 'en' && Whider.I18n.lang === 'en'), donde + ': la app está en inglés (lang="en")');
    for (const pantalla of PANTALLAS) {
      const [scr, vista] = pantalla.split(':');
      if (movil && vista === 'day') continue;
      await p.evaluate(([s, v]) => { if (v) Whider.State.ui.calView = v; Whider.Router.go(s); Whider.Router.refresh(); }, [scr, vista]);
      await sleep(600);
      // «records» es la pestaña Marcas de la pantalla de perfil
      const restos = (await leer(p, scr === 'records' ? 'progress' : scr)).filter((l) => ESPANOL.test(l));
      ok(!restos.length, donde + ': «' + pantalla + '» sin textos en español', restos);
    }
    for (const [nombre, abrirHoja, arg, solo] of HOJAS) {
      if (solo === 'ordenador' && movil) continue;
      await p.evaluate(abrirHoja, arg);
      await sleep(500);
      const texto = await leerHojas(p);
      const restos = texto.filter((l) => ESPANOL.test(l));
      ok(texto.length > 2 && !restos.length, donde + ': hoja «' + nombre + '» sin textos en español', restos.length ? restos : texto);
      await p.evaluate(() => { let n = 0; while (Whider.Sheet.isOpen() && n++ < 10) Whider.Sheet.closeTop(); });
      await sleep(450);
    }
    // El Cuaderno: la portada, una página de cada plantilla (con sus bases de datos) y la papelera
    await p.evaluate(() => { Whider.Router.go('notes'); });
    await sleep(1500);
    const paginas = await p.evaluate(() => ['meeting', 'project', 'journal', 'class', 'weekly', 'reading', 'roadmap', 'wiki', 'contacts']
      .map((t) => { const m = Whider.Pages.fromTemplate(t); return [t, m && (m.id || m)]; }));
    for (const [plantilla, id] of paginas) {
      await p.evaluate((x) => Whider.Notes.openPage(x), id);
      await sleep(800);
      const restos = (await leer(p, 'notes')).filter((l) => ESPANOL.test(l));
      ok(!restos.length, donde + ': Cuaderno, plantilla «' + plantilla + '» sin textos en español', restos);
    }
    // El menú «/» de bloques
    await p.evaluate((x) => Whider.Notes.openPage(x), paginas[0][1]);
    await sleep(800);
    await p.evaluate(() => { const b = document.querySelector('#screen-notes .bk-plus'); if (b) b.click(); });
    await sleep(500);
    const menu = await leerHojas(p, '.bk-menu');
    ok(menu.length > 10 && !menu.filter((l) => ESPANOL.test(l)).length, donde + ': menú de bloques sin textos en español', menu.length > 10 ? menu.filter((l) => ESPANOL.test(l)) : menu);
    await p.keyboard.press('Escape');
    // La pantalla de acceso: crear cuenta, iniciar sesión y verificar el correo
    for (const [modo, vista] of [['register', 'form'], ['login', 'form'], ['login', 'verify']]) {
      await p.evaluate(([m, v]) => Whider.AuthScreen.open({ mode: m, view: v }), [modo, vista]);
      await sleep(400);
      const texto = await leerHojas(p, '#authRoot');
      const restos = texto.filter((l) => ESPANOL.test(l));
      ok(texto.length > 2 && !restos.length, donde + ': acceso (' + modo + ', ' + vista + ') sin textos en español', restos.length ? restos : texto);
      await p.evaluate(() => Whider.AuthScreen.close());
      await sleep(500);
    }
    // La presentación inicial, paso a paso (sin terminarla, para no cambiar el nombre ni el personaje)
    await p.evaluate(() => Whider.Onboarding.start());
    for (let paso = 1; paso <= 3; paso++) {
      await sleep(500);
      const texto = await leerHojas(p, '#onboardingRoot');
      const restos = texto.filter((l) => ESPANOL.test(l));
      ok(texto.length > 1 && !restos.length, donde + ': presentación, paso ' + paso + ', sin textos en español', restos.length ? restos : texto);
      if (paso < 3) await p.click('#onboardingRoot .ob-foot button');
    }
    const faltan = await p.evaluate(() => Whider.I18n.missing());
    ok(!faltan.length, donde + ': todo lo pedido está en el catálogo', faltan);
    ok(!p.errs.length, donde + ': sin errores', p.errs);
    await p.context().close();
  }
  // Cambiar de idioma desde Ajustes: de español a inglés y vuelta (la app se vuelve a abrir en el idioma elegido)
  {
    const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
    await ctx.addInitScript(() => {
      window.WHIDER_CONFIG = { firebase: null };
      localStorage.setItem('whider.meta.v1', JSON.stringify({ onboarded: true, createdAt: Date.now(), seenAchievements: [] }));
    });
    const p = await ctx.newPage();
    const errs = [];
    p.on('pageerror', (e) => errs.push(e.message));
    await p.goto(APP);
    await sleep(1500);
    const elegir = async (celda, idioma) => {
      await p.evaluate(() => Whider.Settings.open());
      await sleep(500);
      await p.locator('.sheet-layer .cell', { hasText: celda }).first().click();
      await sleep(400);
      await p.getByText(idioma, { exact: true }).last().click();
      await p.waitForLoadState('load');
      await sleep(1800);
    };
    ok(await p.evaluate(() => Whider.I18n.lang === 'es' && /Idioma/.test(document.body.innerText) === false), 'por defecto, en español');
    await elegir('Idioma', 'English');
    ok(await p.evaluate(() => Whider.I18n.lang === 'en' && document.documentElement.lang === 'en' && /Today/.test(document.getElementById('sidebar').innerText)), 'Ajustes → Idioma → English: la app pasa a inglés');
    await elegir('Language', 'Español');
    ok(await p.evaluate(() => Whider.I18n.lang === 'es' && /Hoy/.test(document.getElementById('sidebar').innerText)), 'Settings → Language → Español: vuelve a español');
    ok(!errs.length, 'cambio de idioma sin errores', errs);
    await ctx.close();
  }
  await b.close();
  console.log(fails ? fails + ' FALLOS' : 'TODO OK');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
