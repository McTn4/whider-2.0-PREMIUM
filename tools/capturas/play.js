// Imágenes de la ficha de Google Play (docs/play/), hechas con la app de verdad y datos de ejemplo sin nombres de
// personas, en español y en inglés. Necesita la app servida (python3 serve.py 8642, o WHIDER_URL).
//
//   node tools/capturas/play.js [es|en]
//     → docs/play/icono-512.png              icono de 512 × 512 (PNG de 32 bits) a sangre: Play le pone las esquinas
//     → docs/play/<idioma>/telefono-N-….jpg   8 capturas del teléfono de 1080 × 1920 (9:16): titular arriba y la
//                                             pantalla de la app debajo, sobre el fondo grafito
//     → docs/play/<idioma>/tableta-N-….jpg    4 capturas de tableta de 2560 × 1440 (16:9; valen para 7 y 10 pulgadas)
//     → docs/play/<idioma>/grafico-de-funciones.jpg   1024 × 500
// Como pide Google Play: sin transparencia (salvo el icono), en 9:16 o 16:9 y con al menos 1080 px; y, como aconseja,
// sin marcos de dispositivo (envejecen pronto y no todo el mundo tiene ese teléfono). Las capturas sueltas de la app
// quedan en tests/e2e/logs/capturas/play/ para revisarlas.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { APP, OUT } = require('../../tests/e2e/_util');
const { seed: seedEs } = require('./portada');

const R = path.join(__dirname, '..', '..');
const DIR = path.join(R, 'docs', 'play');
const RAW = path.join(OUT, 'play');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const b64 = (f) => fs.readFileSync(path.join(R, f)).toString('base64');
const FONT = b64('fonts/inter-latin-opsz-normal.woff2');
const W_PATH = 'M12.5 22.5 23 45l9-15.5L41 45l11-28';
const HOY = new Date().toISOString().slice(0, 10);
const UA_ANDROID =
  'Mozilla/5.0 (Linux; Android 15; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36';

/* ---------- Textos de cada imagen ---------- */
const TEXTOS = {
  es: {
    telefono: [
      ['inicio', 'Tu día, por importancia', 'Lo urgente primero y lo demás, a su hora.'],
      ['nueva-tarea', 'Escribe y listo', 'Entiende el día, la hora, la categoría y la importancia.'],
      ['tareas', 'Todo en su sitio', 'Vistas automáticas y tus propias categorías.'],
      ['calendario', 'Tu mes, de un vistazo', 'Toca un día y escribe la tarea ahí mismo.'],
      ['cada-dia', 'Lo de cada día, sin fallar', 'Tareas que se repiten, hechas en un toque.'],
      ['cuaderno', 'Tus notas, ordenadas', 'Páginas con listas, tablas y bases de datos.'],
      ['claro', 'Claro u oscuro', 'Grafito o blanco, como más te guste.'],
      ['dispositivos', 'En todos tus dispositivos', 'Móvil, ordenador y web, siempre al día.']
    ],
    tableta: [
      ['inicio', 'Tu día,<br>por importancia', 'Lo urgente primero, con el mes y los próximos días al lado.'],
      ['tareas', 'Todo<br>en su sitio', 'Tus vistas, categorías y filtros, y la lista a su lado.'],
      ['calendario', 'Planifica<br>tu semana', 'Arrastra cada tarea a su día y a su hora.'],
      ['cuaderno', 'Tus notas,<br>ordenadas', 'Páginas con listas, casillas, tablas y bases de datos.']
    ],
    grafico: [
      'Tu día,<br>bajo control.',
      'Tus tareas por importancia, las de cada día, el calendario y tus notas. Gratis, sin anuncios y en todos tus dispositivos.'
    ],
    escribir: 'Reunión con el equipo mañana a las 10 #trabajo !!',
    // Más tareas de cada día, solo para su captura: [texto, hora, categoría, una vez a la semana]
    cadaDia: [
      ['Estirar 10 minutos', '18:00', 'Salud'],
      ['Leer 20 páginas', '22:30', 'Personal'],
      ['Regar las plantas', null, 'Casa', true]
    ],
    plataformas: [
      ['movil', 'Móvil', 'Android'],
      ['pc', 'Ordenador', 'Windows, macOS y Linux'],
      ['web', 'Web', 'En cualquier navegador']
    ],
    cuenta: 'Con tu cuenta de Google, Microsoft o Apple'
  },
  en: {
    telefono: [
      ['inicio', 'Your day, by importance', 'Urgent first, everything else in its time.'],
      ['nueva-tarea', 'Just type it', 'It understands the day, time, category and importance.'],
      ['tareas', 'Everything in its place', 'Smart views and your own categories.'],
      ['calendario', 'Your month at a glance', 'Tap a day and type the task right there.'],
      ['cada-dia', 'Every day, without fail', 'Repeating tasks, checked off in one tap.'],
      ['cuaderno', 'Your notes, organized', 'Pages with lists, tables and databases.'],
      ['claro', 'Light or dark', 'Graphite or white, whichever you like.'],
      ['dispositivos', 'On all your devices', 'Phone, computer and web, always in sync.']
    ],
    tableta: [
      ['inicio', 'Your day,<br>by importance', 'Urgent first, with the month and the coming days alongside.'],
      ['tareas', 'Everything<br>in its place', 'Your views, categories and filters, with the list beside them.'],
      ['calendario', 'Plan<br>your week', 'Drag each task to its day and time.'],
      ['cuaderno', 'Your notes,<br>organized', 'Pages with lists, checkboxes, tables and databases.']
    ],
    grafico: [
      'Your day,<br>under control.',
      'Tasks by importance, everyday tasks, your calendar and your notes. Free, no ads, on all your devices.'
    ],
    escribir: 'Team meeting tomorrow at 10 #work !!',
    cadaDia: [
      ['Stretch 10 minutes', '18:00', 'Health'],
      ['Read 20 pages', '22:30', 'Personal'],
      ['Water the plants', null, 'Home', true]
    ],
    plataformas: [
      ['movil', 'Phone', 'Android'],
      ['pc', 'Computer', 'Windows, macOS and Linux'],
      ['web', 'Web', 'In any browser']
    ],
    cuenta: 'With your Google, Microsoft or Apple account'
  }
};

/* ---------- Datos de ejemplo en inglés (los de español son los de la portada) ---------- */
async function seedEn(p) {
  await p.evaluate(() => {
    const S = Whider.State,
      U = Whider.U,
      td = U.today(),
      tm = U.addDays(td, 1);
    if (S.tasks.length) return;
    const L = (n, ic) => (S.lists.find((l) => l.name === n) || S.addList(n, 'iris', ic)).id;
    const work = L('Work', 'briefcase'),
      pers = L('Personal', 'user'),
      health = L('Health', 'heart'),
      home = L('Home', 'home');
    [
      ["Prepare Monday's presentation", td, '10:00', 'danger', work],
      ['Review the trip budget', td, '12:30', 'purple', pers],
      ['Call the dentist', td, '17:00', 'star', health],
      ['Buy fruit and bread', td, null, 'none', home],
      ['Read chapter 4', td, '21:30', 'none', pers],
      ['Send the weekly report', td, '09:00', 'purple', work],
      ['Go for a run', td, '07:30', 'none', health],
      ['Design team meeting', tm, '09:30', 'purple', work],
      ['Renew the passport', U.addDays(td, 3), null, 'danger', null]
    ].forEach((x) => S.addTask({ text: x[0], date: x[1], time: x[2], highlight: x[3], listId: x[4] }));
    ['Send the weekly report', 'Go for a run'].forEach((t) => {
      const k = S.tasks.find((z) => z.text === t);
      if (k) S.setDone(k.id, true);
    });
    S.addTask({ text: 'Drink water · 8 glasses', date: td, time: '09:00', repeat: 'daily', listId: health });
    S.addTask({ text: 'Walk 30 minutes', date: td, repeat: 'weekly', days: [1, 3, 5, U.weekday(td)], listId: health });
    const med = S.addTask({ text: 'Meditate 10 minutes', date: td, repeat: 'daily', listId: pers });
    S.setDone(med.id, true);
    const P = Whider.Pages;
    P.fromTemplate('project', { title: 'Website launch' });
    P.fromTemplate('meeting', { title: 'Weekly meeting' });
    const pg = P.create({
      title: 'Trip to Lisbon',
      icon: 'pin',
      cover: 'waves',
      blocks: [
        P.block('h2', 'Plan'),
        P.block('p', 'Three days in <b>Lisbon</b>: Alfama, Belém and the sunset at the viewpoint.'),
        P.block('todo', 'Book the hotel', { c: true }),
        P.block('todo', 'Buy the train tickets'),
        P.block('todo', 'Look for restaurants by the river'),
        P.block('callout', 'Bring the phone charger and the passport', { ic: 'alert' }),
        P.block('h2', 'Budget'),
        P.block('p', 'Hotel, trains and meals: about €450 per person.')
      ]
    });
    window.__pg = pg.id;
  });
}

/* ---------- La app, en el idioma y el tema que toquen ---------- */
async function abrir(b, lang, opts) {
  const ctx = await b.newContext(
    Object.assign(
      { locale: lang === 'en' ? 'en-US' : 'es-ES', colorScheme: opts.theme === 'light' ? 'light' : 'dark' },
      opts.ctx
    )
  );
  await ctx.clock.install({ time: new Date(HOY + 'T08:40:00') });
  await ctx.addInitScript(
    ([lang, theme]) => {
      window.WHIDER_CONFIG = { firebase: null };
      localStorage.setItem('whider.seenVersion', '999.0.0');
      localStorage.setItem('whider.backup.v1', JSON.stringify({ manual: Date.now() }));
      localStorage.setItem('whider.lang', lang);
      localStorage.setItem('whider.ui', JSON.stringify({ t: 'm', th: theme, sys: false }));
      if (!localStorage.getItem('whider.meta.v1'))
        localStorage.setItem(
          'whider.meta.v1',
          JSON.stringify({ onboarded: true, createdAt: Date.now() - 40 * 86400000, firstSteps: { hidden: true } })
        );
    },
    [lang, opts.theme || 'dark']
  );
  const p = await ctx.newPage();
  p.errs = [];
  p.on('pageerror', (e) => p.errs.push(e.message));
  await p.goto(APP);
  await sleep(1800);
  await p.evaluate((theme) => {
    Whider.Notify.check = function () {};
    Whider.Notify.permission = function () {
      return 'granted';
    };
    Whider.State.setSetting('theme', theme);
    Whider.State.setProfile({ name: '' });
  }, opts.theme || 'dark');
  await (lang === 'en' ? seedEn : seedEs)(p);
  await sleep(400);
  return { ctx, p };
}

/** Deja la pantalla lista para la foto: sin hojas abiertas (salvo que se quiera una), sin foco ni avisos */
async function limpia(p, keepSheet) {
  await p.evaluate((keep) => {
    if (!keep) for (let i = 0; i < 6 && Whider.Sheet.closeTop(); i++);
    const t = document.getElementById('toastRoot');
    if (t) t.innerHTML = '';
    if (!keep && document.activeElement) document.activeElement.blur();
    const s = document.querySelector('.screen.active');
    if (s) s.scrollTop = 0;
  }, !!keepSheet);
  await p.evaluate(() => document.fonts.ready);
  await sleep(350);
}

/** Pone la app en cada estado y devuelve su captura (PNG) */
async function estado(p, que, lang) {
  await p.evaluate(() => {
    for (let i = 0; i < 6 && Whider.Sheet.closeTop(); i++);
    Whider.State.ui.query = '';
  });
  if (que === 'inicio' || que === 'claro') await p.evaluate(() => Whider.Router.go('home'));
  else if (que === 'tareas')
    await p.evaluate(() => {
      Whider.State.ui.taskView = null;
      Whider.Router.go('tasks');
      if (Whider.Layout.desktop) Whider.Sidebar.openView({ type: 'smart', id: 'all' });
    });
  else if (que === 'cada-dia')
    // Más tareas de cada día, solo para esta captura (las de antes ya están hechas), para que la lista no quede corta
    await p.evaluate((extra) => {
      const S = Whider.State,
        U = Whider.U,
        td = U.today(),
        dia = U.addDays(td, 2);
      const lista = (n) => (S.lists.find((l) => l.name === n) || {}).id || null;
      for (const [text, time, cat, semanal] of extra)
        if (!S.tasks.some((t) => t.text === text))
          S.addTask(
            semanal
              ? {
                  text,
                  date: dia,
                  time,
                  listId: lista(cat),
                  repeat: 'weekly',
                  days: [U.weekday(dia), U.weekday(U.addDays(dia, 3))]
                }
              : { text, date: td, time, listId: lista(cat), repeat: 'daily' }
          );
      Whider.Sidebar.openView({ type: 'smart', id: 'daily' });
    }, TEXTOS[lang].cadaDia);
  else if (que === 'calendario' || que === 'calendario-semana')
    await p.evaluate(
      (v) => {
        Whider.State.ui.calView = v;
        Whider.State.settings.desk.plan = false;
        Whider.State.ui.calSelected = Whider.U.today();
        Whider.Router.go('calendar');
        Whider.Router.refresh();
      },
      que === 'calendario' ? 'month' : 'week'
    );
  else if (que === 'cuaderno') {
    await p.evaluate(() => {
      Whider.State.ui.page = null;
      Whider.Router.go('notes');
    });
    await sleep(500);
    await p.evaluate(() => Whider.Notes.openPage(window.__pg));
    await sleep(1200);
  } else if (que === 'nueva-tarea') {
    await p.evaluate(() => Whider.Router.go('home'));
    await sleep(300);
    await p.evaluate(() => Whider.App.newTask());
    await sleep(600);
    await p.keyboard.type(TEXTOS[lang].escribir, { delay: 8 });
    await sleep(500);
  }
  await sleep(450);
  await limpia(p, que === 'nueva-tarea');
  return p.screenshot({ type: 'png' });
}

/** Trozos de Inicio para el gráfico de funciones: «Cada día» y «Por hacer», cada uno con sus tres primeras tareas */
async function recortes(p) {
  await p.setViewportSize({ width: 412, height: 1600 });
  await sleep(500);
  const r = {};
  for (const [k, sel] of [
    ['cadaDia', '.daily-sec'],
    ['porHacer', '.todo-sec']
  ]) {
    const c = await p.evaluate((sel) => {
      const s = document.querySelector('.screen.active ' + sel),
        t = s.querySelectorAll('li.task');
      return { y: s.getBoundingClientRect().top, fin: (t.length > 2 ? t[2] : s).getBoundingClientRect().bottom };
    }, sel);
    // hasta el final de la tercera tarea, sin la raya de separación de la cuarta
    r[k] = await p.screenshot({ clip: { x: 0, y: Math.max(0, c.y - 16), width: 412, height: c.fin - c.y + 15.5 } });
  }
  await p.setViewportSize({ width: 412, height: 820 });
  await sleep(500);
  return r;
}

/* ---------- Composición: titular + la app, sobre el fondo grafito ---------- */
// Sin marcos de dispositivo: la pantalla de la app con sus esquinas redondeadas, su barra de estado y una sombra suave
const ESTILO = `
  @font-face { font-family: Inter; src: url(data:font/woff2;base64,${FONT}) format('woff2'); font-weight: 100 900; }
  * { box-sizing: border-box; margin: 0; }
  body { position: relative; overflow: hidden; font-family: Inter, sans-serif; color: #ECEDEF; -webkit-font-smoothing: antialiased; }
  .head { position: absolute; display: flex; flex-direction: column; justify-content: center; }
  .head.c { left: 0; right: 0; align-items: center; text-align: center; padding: 0 64px; }
  .head h1, .head .sub { width: 100%; }
  h1 { font-weight: 800; letter-spacing: -.035em; line-height: 1.04; white-space: nowrap; }
  .sub { color: #A9ADB4; font-weight: 500; letter-spacing: -.01em; line-height: 1.32; text-wrap: balance; }
  .marca { display: flex; align-items: center; font-weight: 800; letter-spacing: -.02em; }
  .scr { position: absolute; overflow: hidden; background: #121316;
    box-shadow: 0 0 0 2px rgba(255, 255, 255, .08), 0 44px 120px rgba(0, 0, 0, .55), 0 12px 32px rgba(0, 0, 0, .3); }
  .scr.claro { background: #F6F7F9;
    box-shadow: 0 0 0 2px rgba(255, 255, 255, .22), 0 44px 120px rgba(0, 0, 0, .55), 0 12px 32px rgba(0, 0, 0, .3); }
  .scr img { display: block; width: 100%; }
  .bar { display: flex; align-items: center; justify-content: space-between; font-weight: 600; letter-spacing: -.01em; }
  .bar svg { display: block; }
  .fila { display: flex; align-items: center; gap: 24px; }
  .fila i { flex: none; display: grid; place-items: center; width: 72px; height: 72px; border-radius: 22px;
    background: rgba(255, 255, 255, .06); box-shadow: inset 0 0 0 2px #34373E; }
  .fila b { display: block; font-size: 32px; font-weight: 700; letter-spacing: -.02em; line-height: 1.2; }
  .fila span { display: block; color: #A9ADB4; font-size: 27px; font-weight: 500; line-height: 1.3; }
`;

/** Fondo grafito, con un brillo suave detrás de la app (posición del brillo, en %) */
const fondo = (x, y) =>
  `background: radial-gradient(60% 46% at ${x}% ${y}%, rgba(255, 255, 255, .075), rgba(255, 255, 255, 0) 70%), linear-gradient(180deg, #18191D 0%, #0D0E10 100%);`;

/** Logotipo: la W y el nombre, con el tamaño de letra «tam» */
const marca = (
  tam
) => `<div class="marca" style="gap:${Math.round(tam * 0.4)}px;font-size:${tam}px;margin-bottom:${Math.round(tam * 0.85)}px">
    <svg width="${Math.round(tam * 1.3)}" height="${Math.round(tam * 1.3)}" viewBox="0 0 64 64"><path d="${W_PATH}" fill="none" stroke="#fff" stroke-width="6.4" stroke-linecap="round" stroke-linejoin="round"/></svg>WHIDER</div>`;

/** Iconos de línea de «En todos tus dispositivos» */
const ICONO = {
  movil: '<rect x="6.5" y="2.5" width="11" height="19" rx="2.8"/><path d="M10.5 18.5h3"/>',
  pc: '<rect x="2.5" y="4" width="19" height="12.5" rx="2"/><path d="M9 20.5h6M12 16.5v4"/>',
  web: '<circle cx="12" cy="12" r="9.3"/><path d="M2.7 12h18.6M12 2.7c2.5 2.6 3.8 5.7 3.8 9.3s-1.3 6.7-3.8 9.3M12 2.7c-2.5 2.6-3.8 5.7-3.8 9.3s1.3 6.7 3.8 9.3"/>'
};
const iconoLinea = (k) =>
  `<svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#D5D7DB" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${ICONO[k]}</svg>`;

/** Barra de estado de Android: la hora a la izquierda; wifi, cobertura y batería a la derecha (k: píxeles por dp) */
function barra(k, color, fondoBarra, hora) {
  const alto = Math.round(26 * k),
    ic = Math.round(15 * k);
  return `<div class="bar" style="height:${alto}px;padding:0 ${Math.round(24 * k)}px;background:${fondoBarra};color:${color};font-size:${Math.round(14 * k)}px">
    <span>${hora}</span>
    <span style="display:flex;gap:${Math.round(ic * 0.32)}px;align-items:center">
      <svg width="${ic}" height="${ic}" viewBox="0 0 24 24"><path d="M12 19.5 2.5 9.6a13.4 13.4 0 0 1 19 0z" fill="${color}"/></svg>
      <svg width="${ic}" height="${ic}" viewBox="0 0 24 24"><path d="M3 20h3v-4H3zm5 0h3v-8H8zm5 0h3V8h-3zm5 0h3V4h-3z" fill="${color}"/></svg>
      <svg width="${Math.round(ic * 1.5)}" height="${ic}" viewBox="0 0 36 24"><rect x="1.5" y="5" width="29" height="14" rx="4" fill="none" stroke="${color}" stroke-width="2"/><rect x="4.5" y="8" width="20" height="8" rx="2" fill="${color}"/><rect x="32" y="9.5" width="2.5" height="5" rx="1" fill="${color}"/></svg>
    </span></div>`;
}

/** La pantalla de la app, sin marco: la captura («dp» de ancho) con la barra de estado encima */
function pantalla(png, { ancho, x, y, claro, hora, dp = 412, radio = 30 }) {
  const k = ancho / dp;
  return `<div class="scr${claro ? ' claro' : ''}" style="left:${x}px;top:${y}px;width:${ancho}px;border-radius:${Math.round(radio * k)}px">
    ${barra(k, claro ? '#14161A' : '#ECEDEF', claro ? '#F6F7F9' : '#121316', hora)}<img src="data:image/png;base64,${png.toString('base64')}"></div>`;
}

/** Alto de esa pantalla: la barra de estado y la captura */
const altoPantalla = (ancho, dp = 412, altoDp = 820) =>
  Math.round(26 * (ancho / dp)) + Math.round((ancho * altoDp) / dp);

/** El mayor tamaño de letra (hasta «max») con el que todos esos titulares caben en «ancho» píxeles */
async function medir(b, titulos, ancho, max) {
  const p = await b.newPage();
  const h1 = titulos.map((t) => `<h1 style="font-size:${max}px;width:max-content">${t}</h1>`).join('');
  await p.setContent(
    `<!doctype html><html><head><meta charset="utf-8"><style>${ESTILO}</style></head><body>${h1}</body></html>`
  );
  await p.evaluate(() => document.fonts.ready);
  const anchos = await p.$$eval('h1', (els) => els.map((e) => e.getBoundingClientRect().width));
  await p.close();
  return Math.min(max, Math.floor((max * ancho) / Math.max(...anchos)));
}

/** Dibuja la imagen y avisa (devuelve) si algún titular o bloque de texto no cabe en su sitio */
async function pinta(b, w, h, html, out, bg) {
  const p = await b.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  await p.setContent(
    `<!doctype html><html><head><meta charset="utf-8"><style>${ESTILO} body { width: ${w}px; height: ${h}px; ${bg} }</style></head><body>${html}</body></html>`
  );
  await p.evaluate(() => document.fonts.ready);
  await sleep(300);
  const mal = await p.$$eval('h1, .head', (els) =>
    els
      .filter((e) => (e.tagName === 'H1' ? e.scrollWidth > e.clientWidth + 1 : e.scrollHeight > e.clientHeight + 1))
      .map((e) => 'no cabe: ' + e.textContent.trim().slice(0, 40))
  );
  await p.screenshot({ path: out, type: 'jpeg', quality: 94 });
  await p.close();
  console.log(path.relative(R, out), Math.round(fs.statSync(out).size / 1024) + ' KB', mal.join(' · '));
  return mal;
}

/* ---------- Cada idioma ---------- */
async function idioma(b, lang) {
  const T = TEXTOS[lang],
    dir = path.join(DIR, lang),
    raw = path.join(RAW, lang);
  fs.mkdirSync(dir, { recursive: true });
  fs.mkdirSync(raw, { recursive: true });
  const hora = '8:40'; // la del reloj de la app en las capturas (antes de las 9, para que no haya nada vencido)
  const errs = [];
  const guarda = (nombre, png) => fs.writeFileSync(path.join(raw, nombre + '.png'), png);

  // Teléfono (412 × 820, como un móvil de 6,3″): oscuro y, para «claro», el tema claro
  const MOVIL = {
    viewport: { width: 412, height: 820 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
    userAgent: UA_ANDROID
  };
  const shots = {};
  let trozos;
  {
    const { ctx, p } = await abrir(b, lang, { ctx: MOVIL });
    for (const q of ['inicio', 'nueva-tarea', 'tareas', 'calendario', 'cada-dia', 'cuaderno']) {
      guarda('movil-' + q, (shots[q] = await estado(p, q, lang)));
      if (q === 'inicio') trozos = await recortes(p);
    }
    errs.push(...p.errs);
    await ctx.close();
  }
  {
    const { ctx, p } = await abrir(b, lang, { ctx: MOVIL, theme: 'light' });
    guarda('movil-claro', (shots.claro = await estado(p, 'claro', lang)));
    errs.push(...p.errs);
    await ctx.close();
  }
  // Ordenador (para «en todos tus dispositivos») y tableta (1280 × 800, con el diseño de pantalla grande)
  const tab = {};
  {
    const { ctx, p } = await abrir(b, lang, {
      ctx: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1.5 }
    });
    guarda('pc-inicio', (shots.pc = await estado(p, 'inicio', lang)));
    errs.push(...p.errs);
    await ctx.close();
  }
  {
    const { ctx, p } = await abrir(b, lang, {
      ctx: {
        viewport: { width: 1280, height: 800 },
        deviceScaleFactor: 2,
        isMobile: true,
        hasTouch: true,
        userAgent: UA_ANDROID
      }
    });
    for (const [q, est] of [
      ['inicio', 'inicio'],
      ['tareas', 'tareas'],
      ['calendario', 'calendario-semana'],
      ['cuaderno', 'cuaderno']
    ])
      guarda('tableta-' + q, (tab[q] = await estado(p, est, lang)));
    errs.push(...p.errs);
    await ctx.close();
  }

  // 8 capturas del teléfono: 1080 × 1920, el titular arriba (todos del mismo tamaño) y la pantalla debajo
  const W = 1080,
    H = 1920,
    ancho = 740,
    yP = H - altoPantalla(ancho) - 64;
  const t1 = await medir(
    b,
    T.telefono.map((t) => t[1]),
    W - 128,
    76
  );
  for (let i = 0; i < T.telefono.length; i++) {
    const [clave, titulo, sub] = T.telefono[i];
    let cuerpo,
      arriba = yP;
    if (clave === 'dispositivos') {
      // La ventana del ordenador a lo ancho y, delante, la pantalla del teléfono; al lado, dónde está WHIDER
      const vw = 1000,
        vh = Math.round((vw * 900) / 1440),
        vx = 40,
        vy = 392,
        tb = 36;
      const pw = 420,
        px = W - pw - 40,
        py = H - altoPantalla(pw) - 64;
      const filas = T.plataformas
        .map(
          ([ic, nombre, detalle]) =>
            `<div class="fila"><i>${iconoLinea(ic)}</i><div><b>${nombre}</b><span>${detalle}</span></div></div>`
        )
        .join('');
      cuerpo = `<div class="scr" style="left:${vx}px;top:${vy}px;width:${vw}px;border-radius:18px">
          <div style="height:${tb}px;display:flex;align-items:center;gap:9px;padding:0 16px;background:#1A1B1F;box-shadow:inset 0 -1px 0 #2A2C32">${'<i style="width:11px;height:11px;border-radius:50%;background:#3A3D45"></i>'.repeat(3)}</div>
          <img style="height:${vh}px" src="data:image/png;base64,${shots.pc.toString('base64')}"></div>
        <div style="position:absolute;left:64px;top:${vy + tb + vh}px;bottom:64px;width:${px - 64 - 44}px;display:flex;flex-direction:column;justify-content:center;gap:30px">
          ${filas}<p class="sub" style="font-size:27px;margin-top:6px">${T.cuenta}</p></div>
        ${pantalla(shots.calendario, { ancho: pw, x: px, y: py, hora })}`;
      arriba = vy;
    } else {
      cuerpo = pantalla(shots[clave], { ancho, x: (W - ancho) / 2, y: yP, claro: clave === 'claro', hora });
    }
    const head = `<div class="head c" style="top:52px;height:${arriba - 92}px">${i === 0 ? marca(36) : ''}<h1 style="font-size:${t1}px">${titulo}</h1><p class="sub" style="font-size:36px;margin-top:20px">${sub}</p></div>`;
    errs.push(
      ...(await pinta(
        b,
        W,
        H,
        head + cuerpo,
        path.join(dir, 'telefono-' + (i + 1) + '-' + clave + '.jpg'),
        fondo(50, 62)
      ))
    );
  }

  // 4 capturas de tableta: 2560 × 1440 (16:9; valen para 7 y 10 pulgadas), el titular a la izquierda y la app a la derecha
  {
    const TW = 2560,
      TH = 1440,
      cw = 1560,
      ch = altoPantalla(cw, 1280, 800),
      cx = TW - cw - 110,
      cy = Math.round((TH - ch) / 2);
    const col = cx - 140 - 100,
      t2 = await medir(
        b,
        T.tableta.map((t) => t[1]),
        col,
        96
      );
    for (let i = 0; i < T.tableta.length; i++) {
      const [clave, titulo, sub] = T.tableta[i];
      const head = `<div class="head" style="left:140px;width:${col}px;top:0;bottom:0">${i === 0 ? marca(40) : ''}<h1 style="font-size:${t2}px">${titulo}</h1><p class="sub" style="font-size:42px;margin-top:34px">${sub}</p></div>`;
      const app = pantalla(tab[clave], { ancho: cw, x: cx, y: cy, hora, dp: 1280, radio: 16 });
      errs.push(
        ...(await pinta(
          b,
          TW,
          TH,
          head + app,
          path.join(dir, 'tableta-' + (i + 1) + '-' + clave + '.jpg'),
          fondo(66, 50)
        ))
      );
    }
  }

  // Gráfico de funciones: 1024 × 500, sin dispositivos: el mensaje a la izquierda y dos trozos de la app a la derecha,
  // todo lejos de los bordes (Google Play puede recortarlos)
  {
    const [titulo, sub] = T.grafico;
    const t3 = await medir(b, [titulo], 400, 58);
    const trozo = (png, w, x, y) =>
      `<div class="scr" style="left:${x}px;top:${y}px;width:${w}px;border-radius:${Math.round(w * 0.055)}px"><img src="data:image/png;base64,${png.toString('base64')}"></div>`;
    const html = `<div class="head" style="left:72px;width:400px;top:0;bottom:0">${marca(22)}<h1 style="font-size:${t3}px">${titulo}</h1><p class="sub" style="font-size:19px;margin-top:18px">${sub}</p></div>
      ${trozo(trozos.cadaDia, 320, 628, 56)}
      ${trozo(trozos.porHacer, 360, 540, 196)}`;
    errs.push(...(await pinta(b, 1024, 500, html, path.join(dir, 'grafico-de-funciones.jpg'), fondo(74, 50))));
  }
  return errs;
}

/** Icono para Play: 512 × 512 a sangre (Play pone su máscara), en PNG de 32 bits como pide: con canal alfa, opaco del
 *  todo. Se pinta en un lienzo porque así el PNG sale con el canal alfa; una captura de pantalla opaca sale sin él. */
async function icono(b) {
  const svg = `<svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
    <defs><linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#202020"/><stop offset="1" stop-color="#050505"/></linearGradient>
    <filter id="glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="2.4"/></filter></defs>
    <rect width="512" height="512" fill="url(#bg)"/>
    <g transform="translate(30.25 39.00) scale(7)"><path d="${W_PATH}" fill="none" stroke="#FFFFFF" stroke-opacity=".38" stroke-width="6.4" stroke-linecap="round" stroke-linejoin="round" filter="url(#glow)"/>
    <path d="${W_PATH}" fill="none" stroke="#FFFFFF" stroke-width="6.4" stroke-linecap="round" stroke-linejoin="round"/></g></svg>`;
  const p = await b.newPage();
  const url = await p.evaluate(async (svg) => {
    const img = new Image();
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    await img.decode();
    const c = document.createElement('canvas');
    c.width = c.height = 512;
    c.getContext('2d').drawImage(img, 0, 0);
    return c.toDataURL('image/png');
  }, svg);
  await p.close();
  const out = path.join(DIR, 'icono-512.png');
  fs.writeFileSync(out, Buffer.from(url.split(',')[1], 'base64'));
  console.log(path.relative(R, out), Math.round(fs.statSync(out).size / 1024) + ' KB');
}

(async () => {
  const b = await chromium.launch();
  await icono(b);
  const errs = [];
  for (const lang of process.argv[2] ? [process.argv[2]] : ['es', 'en']) errs.push(...(await idioma(b, lang)));
  await b.close();
  if (errs.length) console.log('Errores en la página:', JSON.stringify(errs));
  process.exit(errs.length ? 1 : 0);
})().catch((e) => {
  console.error(e);
  process.exit(2);
});
