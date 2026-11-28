// Revisión de toda la app: recorre cada pantalla, vista, hoja y menú en el ordenador (1440 y 1000 px) y en el móvil
// (390 y 320 px), con el tema oscuro y el claro, en español y en inglés, con datos de ejemplo. En cada sitio comprueba:
//  - que no hay errores (de la página ni de la consola);
//  - que nada se sale de lado (ni la pantalla ni las hojas, los diálogos o los menús abiertos);
//  - que no hay nombres cortados en la barra de abajo, la barra superior, los selectores ni los botones del calendario;
//  - que en el móvil la barra flotante no tapa lo último de la pantalla al llegar al final.
//   node tests/e2e/revision.js [carpeta]   (con una carpeta, guarda además una captura de cada sitio para revisarlas)
const { chromium, devices } = require('playwright');
const path = require('path');
const fs = require('fs');
const { APP } = require('./_util');
const { seed } = require('../../tools/capturas/portada');

const OUT = process.argv[2] || '';
if (OUT) fs.mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let fails = 0;
const ok = (c, m, extra) => {
  console.log((c ? 'OK   ' : 'FAIL ') + m + (extra !== undefined && !c ? '  → ' + JSON.stringify(extra).slice(0, 600) : ''));
  if (!c) fails++;
};

const CONFIGS = [
  { name: 'pc', opts: { viewport: { width: 1440, height: 900 } } },
  { name: 'pc-claro', opts: { viewport: { width: 1440, height: 900 } }, theme: 'light' },
  { name: 'pc-en', opts: { viewport: { width: 1440, height: 900 } }, lang: 'en' },
  { name: 'pc-1000', opts: { viewport: { width: 1000, height: 700 } } },
  { name: 'movil', opts: { ...devices['iPhone 12'] } },
  { name: 'movil-claro', opts: { ...devices['iPhone 12'] }, theme: 'light' },
  { name: 'movil-en', opts: { ...devices['Pixel 7'] }, lang: 'en' },
  { name: 'movil-320', opts: { viewport: { width: 320, height: 568 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } }
];

/** Lo que se visita: [nombre, función que lo abre (en la página), solo en…] */
const SITIOS = [
  ['inicio', () => Whider.Router.go('home')],
  ['tareas', () => { Whider.State.ui.taskView = null; Whider.Router.go('tasks'); }],
  ['tareas-hoy', () => Whider.Sidebar.openView({ type: 'smart', id: 'today' })],
  ['tareas-cada-dia', () => Whider.Sidebar.openView({ type: 'smart', id: 'daily' })],
  ['tareas-programadas', () => Whider.Sidebar.openView({ type: 'smart', id: 'scheduled' })],
  ['tareas-todas', () => Whider.Sidebar.openView({ type: 'smart', id: 'all' })],
  ['tareas-categoria', () => Whider.Sidebar.openView({ type: 'list', id: Whider.State.lists[0].id })],
  ['tareas-filtro', () => Whider.Sidebar.openView({ type: 'filter', id: Whider.State.filters[0].id })],
  ['tareas-buscar', () => { Whider.State.ui.taskView = null; Whider.State.ui.query = 'la'; Whider.Router.go('tasks'); Whider.Router.refresh(); }],
  ['calendario-mes', () => { Whider.State.ui.query = ''; Whider.State.ui.calView = 'month'; Whider.Router.go('calendar'); Whider.Router.refresh(); }],
  ['calendario-semana', () => { Whider.State.ui.calView = 'week'; Whider.Router.go('calendar'); Whider.Router.refresh(); }, 'pc'],
  ['calendario-dia', () => { Whider.State.ui.calView = 'day'; Whider.Router.go('calendar'); Whider.Router.refresh(); }, 'pc'],
  ['calendario-agenda', () => { Whider.State.ui.calView = 'agenda'; Whider.Router.go('calendar'); Whider.Router.refresh(); }, 'pc'],
  ['cuaderno', () => { Whider.State.ui.calView = 'month'; Whider.State.ui.page = null; Whider.Router.go('notes'); }],
  ['cuaderno-pagina', () => Whider.Notes.openPage(window.__pg)],
  ['personas', () => Whider.Router.go('friends')],
  ['chats', () => Whider.Router.go('chats')],
  // Hojas, diálogos y menús (desde Inicio)
  ['ajustes', () => { Whider.Router.go('home'); Whider.Settings.open(); }],
  ...['account', 'appearance', 'tasks', 'lists', 'alerts', 'start', 'data', 'privacy', 'sounds', 'custom', 'calendars', 'desktop'].map((pg) => ['ajustes-' + pg, new Function('Whider.Settings.open(' + JSON.stringify(pg) + ')'), pg === 'desktop' ? 'pc' : null]),
  ['tu-cuenta', () => Whider.AccountMenu.open(document.querySelector('#topbar .tb-me') || document.querySelector('.screen.active .me-btn'))],
  ['nueva-tarea', () => Whider.App.newTask()],
  ['editar-tarea', () => Whider.Editor.open(Whider.State.tasks.find((t) => !t.done && t.time).id)],
  ['buscar-todo', () => Whider.Palette.open()],
  ['atajos', () => Whider.Keys.help(), 'pc'],
  ['nueva-categoria', () => Whider.Lists.edit(null)],
  ['nuevo-filtro', () => Whider.Filters.edit(null)],
  ['novedades', () => Whider.WhatsNew.open()],
  ['perfil', () => Whider.Profile.edit()],
  ['importar', () => Whider.ImportWizard.open()],
  ['menu-tarea', () => {
    Whider.Router.go('home');
    const t = document.querySelector('#screen-home .todo-sec .task');
    const r = t.getBoundingClientRect();
    t.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: r.left + r.width - 40, clientY: r.top + 10 }));
  }, 'pc'],
  ['presentacion', () => Whider.Onboarding.start()],
  ['acceso', () => Whider.AuthScreen.open()]
];

async function cerrar(p) {
  await p.keyboard.press('Escape').catch(() => {});
  await p.evaluate(() => {
    for (let i = 0; i < 8 && Whider.Sheet.closeTop(); i++);
    if (Whider.Onboarding && Whider.Onboarding.isOpen && Whider.Onboarding.isOpen()) {
      const b = document.querySelector('#onboardingRoot .nav-btn');
      if (b) b.click();
    }
    if (Whider.AuthScreen && Whider.AuthScreen.close) Whider.AuthScreen.close();
    document.querySelectorAll('.menu').forEach((m) => m.remove());
  });
  await sleep(250);
}

/** Qué se sale de lado, qué tapa la barra y qué falta, en el estado actual */
const medir = () =>
  new Promise((resolve) => {
    const W = innerWidth, H = innerHeight;
    const vis = (el) => { const cs = getComputedStyle(el); const r = el.getBoundingClientRect(); return cs.display !== 'none' && cs.visibility !== 'hidden' && r.width > 0 && r.height > 0; };
    const desc = (el) => el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + (el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.') : '');
    const out = { ancho: [], fuera: [], tapa: null, cortados: [] };
    // Nombres que no caben: en la barra de abajo, la superior, los selectores (Mes · Semana…) y los botones del calendario
    for (const el of document.querySelectorAll('.dock .tab-label, #topbar .tb-item, #topbar .tb-search, #topbar .tb-new, .segmented button, .cal-toolbar .btn, .cal-toolbar .chip')) {
      if (!vis(el)) continue;
      const alto = el.getBoundingClientRect().height, linea = parseFloat(getComputedStyle(el).lineHeight) || 20;
      // Con puntos suspensivos se corta en cuanto no cabe un píxel; el resto, con margen de redondeo
      const margen = getComputedStyle(el).textOverflow === 'ellipsis' ? 0 : 1;
      if (el.scrollWidth > el.clientWidth + margen || (el.matches('.btn, .chip, .segmented button') && alto > Math.max(44, linea * 1.9))) out.cortados.push(desc(el) + ' «' + el.textContent.trim().slice(0, 24) + '»');
    }
    // La pantalla abierta: nada más ancho que ella (sin barra de desplazamiento lateral)
    const scr = document.querySelector('.screen.active');
    const cajas = [scr, ...document.querySelectorAll('.sheet-layer.open .sheet, .sheet-layer.open .sheet-body, .menu, .onboarding-root.open, #onboardingRoot > *, #authRoot > *')].filter((x) => x && vis(x));
    for (const c of cajas) if (c.scrollWidth > c.clientWidth + 2 && getComputedStyle(c).overflowX !== 'visible') out.ancho.push(desc(c) + ' ' + c.scrollWidth + '>' + c.clientWidth);
    // Diálogos, hojas y menús: dentro de la ventana
    for (const c of document.querySelectorAll('.sheet-layer.open .sheet, .menu')) {
      if (!vis(c)) continue;
      const r = c.getBoundingClientRect();
      if (r.left < -1 || r.right > W + 1 || r.top < -1 || r.bottom > H + 1) out.fuera.push(desc(c) + ' ' + [r.left, r.top, r.right, r.bottom].map(Math.round).join(','));
    }
    // Contenido de la pantalla que se sale por la derecha (sin estar dentro de algo que se desplaza de lado)
    if (scr) {
      const sr = scr.getBoundingClientRect();
      let n = 0;
      for (const el of scr.querySelectorAll('*')) {
        if (n > 4) break;
        const r = el.getBoundingClientRect();
        if (!r.width || r.right <= sr.right + 1) continue;
        let a = el.parentElement, clipped = false;
        while (a && a !== scr) { const ox = getComputedStyle(a).overflowX; if (ox !== 'visible') { clipped = true; break; } a = a.parentElement; }
        if (!clipped && vis(el)) { out.fuera.push(desc(el) + ' → ' + Math.round(r.right) + ' > ' + Math.round(sr.right)); n++; }
      }
    }
    // Móvil: al llegar al final, lo último de la pantalla queda por encima de la barra flotante
    const dock = document.querySelector('.dock');
    if (scr && dock && vis(dock) && !document.querySelector('.sheet-layer.open')) {
      scr.scrollTop = scr.scrollHeight;
      requestAnimationFrame(() => {
        const dr = dock.getBoundingClientRect();
        const ultimos = [...scr.querySelectorAll('.inner > *, .tasks-main > *')].filter(vis);
        const ult = ultimos[ultimos.length - 1];
        if (ult) {
          const r = ult.getBoundingClientRect();
          if (r.bottom > dr.top + 1 && r.top < dr.top) out.tapa = desc(ult) + ' acaba en ' + Math.round(r.bottom) + ', la barra empieza en ' + Math.round(dr.top);
        }
        scr.scrollTop = 0;
        resolve(out);
      });
    } else resolve(out);
  });

(async () => {
  const b = await chromium.launch();
  for (const cfg of CONFIGS) {
    const pc = !/movil/.test(cfg.name);
    const ctx = await b.newContext(cfg.opts);
    await ctx.addInitScript(([lang, theme]) => {
      window.WHIDER_CONFIG = { firebase: null };
      localStorage.setItem('whider.seenVersion', '999.0.0');
      localStorage.setItem('whider.backup.v1', JSON.stringify({ manual: Date.now() }));
      if (!localStorage.getItem('whider.meta.v1')) localStorage.setItem('whider.meta.v1', JSON.stringify({ onboarded: true, createdAt: Date.now() - 20 * 86400000 }));
      if (lang) localStorage.setItem('whider.lang', lang);
      if (theme) localStorage.setItem('whider.ui', JSON.stringify({ t: 'm', th: theme, sys: false }));
    }, [cfg.lang || '', cfg.theme || '']);
    const p = await ctx.newPage();
    const errs = [];
    p.on('pageerror', (e) => errs.push('[' + p.__sitio + '] ' + e.message));
    p.on('console', (m) => { if (m.type() === 'error') errs.push('[' + p.__sitio + '] consola: ' + m.text().slice(0, 200)); });
    p.__sitio = 'arranque';
    await p.goto(APP);
    await sleep(1600);
    await p.evaluate((theme) => {
      Whider.Notify.check = function () {};
      if (theme) Whider.State.setSetting('theme', theme);
      Whider.State.setProfile({ name: 'Ana Ruiz' });
      Whider.State.saveFilter({ name: 'Urgente del trabajo', lists: [], priorities: ['danger'], when: 'any', text: '', status: 'pending' });
    }, cfg.theme || '');
    await seed(p);
    await sleep(500);
    const problemas = [];
    let vistos = 0;
    for (const [nombre, abrir, solo] of SITIOS) {
      if (solo === 'pc' && !pc) continue;
      p.__sitio = nombre;
      try {
        await p.evaluate(abrir);
      } catch (e) {
        problemas.push(nombre + ': no se pudo abrir (' + e.message.split('\n')[0] + ')');
        continue;
      }
      await sleep(450);
      const m = await p.evaluate(medir);
      if (m.ancho.length) problemas.push(nombre + ': más ancho que la pantalla → ' + m.ancho.join(' | '));
      if (m.fuera.length) problemas.push(nombre + ': se sale de la ventana → ' + m.fuera.join(' | '));
      if (m.tapa) problemas.push(nombre + ': la barra flotante tapa ' + m.tapa);
      if (m.cortados.length) problemas.push(nombre + ': nombres cortados → ' + m.cortados.join(' | '));
      if (OUT) await p.screenshot({ path: path.join(OUT, cfg.name + '-' + nombre + '.png') });
      vistos++;
      if (/^(ajustes|tu-cuenta|nueva|editar|buscar|atajos|novedades|perfil|importar|menu|presentacion|acceso)/.test(nombre)) await cerrar(p);
    }
    ok(!problemas.length, cfg.name + ': ' + vistos + ' sitios sin desbordes ni nada tapado', problemas);
    ok(!errs.length, cfg.name + ': sin errores', errs);
    await ctx.close();
  }
  await b.close();
  console.log(fails ? fails + ' FALLOS' : 'TODO OK');
  process.exit(fails ? 1 : 0);
})();
