// 1.1 · Uso diario: etiquetas legibles, prioridad con texto y forma (color opcional), colores de
// categoría, «En curso», Hoy agrupado por estado sin recuentos repetidos, barra inferior a elegir,
// Cuaderno y Chats a la vista en «Más», nombres claros y «Primeros pasos».
const { chromium, devices } = require('playwright');
const { APP } = require('./_util');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let fails = 0;
const ok = (c, m, extra) => {
  console.log((c ? 'OK   ' : 'FAIL ') + m + (extra !== undefined && !c ? '  → ' + JSON.stringify(extra) : ''));
  if (!c) fails++;
};

async function abrir(b, opts, meta) {
  const ctx = await b.newContext(opts);
  await ctx.addInitScript((m) => {
    window.WHIDER_CONFIG = { firebase: null };
    if (!localStorage.getItem('whider.meta.v1')) localStorage.setItem('whider.meta.v1', JSON.stringify(m));
  }, meta || { onboarded: true, createdAt: Date.now() });
  const p = await ctx.newPage();
  p.setDefaultTimeout(6000);
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  p.on('console', (m) => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
  await p.goto(APP);
  await sleep(1600);
  await p.evaluate(() => { Whider.Notify.check = function () {}; });
  return { ctx, p, errs };
}

(async () => {
  const b = await chromium.launch();

  /* 1. Móvil · persona nueva: primeros pasos, sin tareas de ejemplo */
  {
    const { ctx, p, errs } = await abrir(b, { ...devices['Pixel 7'] });
    const fs = await p.evaluate(() => {
      const sec = document.querySelector('#screen-home .sec.first-steps');
      return { hay: !!sec, n: sec ? sec.querySelectorAll('.fs-step').length : 0, cuenta: sec ? sec.querySelector('.sec-t small').textContent : '', tareas: Whider.State.tasks.length };
    });
    ok(fs.hay && fs.n === 5 && fs.cuenta === '0 de 5' && fs.tareas === 0, 'persona nueva: «Primeros pasos» con 5 pasos y ninguna tarea de ejemplo', fs);
    await p.evaluate(() => { Whider.State.addTask({ text: 'Mi primera tarea', date: Whider.U.today(), time: '23:30' }); Whider.Router.refresh(); });
    await sleep(500);
    const hechos = await p.evaluate(() => [...document.querySelectorAll('#screen-home .fs-step.done b')].map((x) => x.textContent));
    ok(hechos.includes('Crea tu primera tarea') && hechos.includes('Dale día y hora escribiendo'), 'los pasos se marcan solos al cumplirse', hechos);
    const orden = await p.evaluate(() => [...document.querySelectorAll('#screen-home .sec-t > span:first-child')].map((x) => x.textContent));
    ok(orden.indexOf('Primeros pasos') > orden.indexOf('Pendientes'), 'con tareas, los primeros pasos van después de ellas', orden);
    await p.click('#screen-home .first-steps button:has-text("Ocultar")');
    await sleep(500);
    ok(await p.evaluate(() => !document.querySelector('#screen-home .first-steps') && Whider.State.meta.firstSteps.hidden === true), '«Ocultar» quita la tarjeta');
    await p.evaluate(() => Whider.Settings.open());
    await sleep(700);
    await p.click('.sheet .cell:has-text("Primeros pasos")');
    await sleep(900);
    ok(await p.evaluate(() => !!document.querySelector('#screen-home .first-steps')), 'Ajustes → Ayuda → Primeros pasos la vuelve a enseñar');
    ok(!errs.length, 'sin errores (persona nueva)', errs);
    await ctx.close();
  }

  /* 2. Móvil · Hoy agrupado por estado, prioridad legible y colores */
  {
    const { ctx, p, errs } = await abrir(b, { ...devices['Pixel 7'] }, { onboarded: true, createdAt: Date.now() - 60 * 86400000 });
    await p.evaluate(() => {
      const S = Whider.State, U = Whider.U, td = U.today();
      const viaje = S.addList('Viajes', null, 'send', 'azul');
      S.addTask({ text: 'Urgente de hoy', date: td, time: '23:50', highlight: 'danger', listId: viaje.id });
      S.addTask({ text: 'Importante de hoy', date: td, time: '23:55', highlight: 'purple' });
      S.addTask({ text: 'Destacada de hoy', date: td, highlight: 'star' });
      const e = S.addTask({ text: 'Empezada', date: td });
      S.setStarted(e.id, true);
      S.addTask({ text: 'Con subtareas a medias', date: U.addDays(td, 2), subtasks: [{ text: 'a', done: true }, { text: 'b', done: false }] });
      S.addTask({ text: 'Normal de hoy', date: td });
      S.addTask({ text: 'De anteayer', date: U.addDays(td, -2) });
      const h = S.addTask({ text: 'Ya hecha', date: td });
      S.setDone(h.id, true);
      Whider.Router.go('home');
      Whider.Router.refresh();
    });
    await sleep(900);
    const hoy = await p.evaluate(() => {
      const secs = [...document.querySelectorAll('#screen-home .sec')].map((s) => {
        const t = s.querySelector('.sec-t > span:first-child');
        return { t: t ? t.textContent : '', tareas: [...s.querySelectorAll('.task-title')].map((x) => x.textContent) };
      });
      return {
        secs,
        dia: !!document.querySelector('#screen-home .day-card'),
        tira: !!document.querySelector('#screen-home .buddy-strip'),
        hero: !!document.querySelector('#screen-home .hero'),
        burbuja: (document.querySelector('#screen-home .day-card .buddy-bubble') || {}).textContent || '',
        hechas: (document.querySelector('#screen-home .done-toggle') || {}).textContent || ''
      };
    });
    const titulo = (t) => hoy.secs.find((s) => s.t === t) || { tareas: [] };
    ok(hoy.dia && !hoy.tira && !hoy.hero, 'móvil: el personaje y el progreso van en una sola tarjeta', hoy);
    ok(!/Te quedan \d+ tareas/.test(hoy.burbuja), 'la frase del personaje no repite el recuento del día', hoy.burbuja);
    ok(titulo('Lo más importante').tareas[0] === 'Urgente de hoy', 'lo urgente encabeza «Lo más importante»', titulo('Lo más importante'));
    ok(titulo('En curso').tareas.includes('Empezada') && titulo('En curso').tareas.includes('Con subtareas a medias'), '«En curso»: empezadas y con subtareas a medias (aunque sean de otro día)', titulo('En curso'));
    ok(titulo('Vencidas').tareas.includes('De anteayer'), '«Vencidas» sigue aparte', titulo('Vencidas'));
    ok(titulo('Pendientes').tareas.length >= 1 && !titulo('Pendientes').tareas.includes('Empezada'), '«Pendientes» con el resto de hoy', titulo('Pendientes'));
    ok(/1 hecha hoy/.test(hoy.hechas), '«Hechas» recogidas al final', hoy.hechas);
    ok(/de otro día/.test(hoy.burbuja) || /Lo siguiente|Se te pasó/.test(hoy.burbuja), 'el personaje propone algo útil y exacto', hoy.burbuja);

    const prio = await p.evaluate(() => {
      const fila = [...document.querySelectorAll('#screen-home .task')].find((x) => x.querySelector('.task-title').textContent === 'Urgente de hoy');
      const imp = [...document.querySelectorAll('#screen-home .task')].find((x) => x.querySelector('.task-title').textContent === 'Importante de hoy');
      const barras = [...fila.querySelectorAll('.prio i')].map((i) => getComputedStyle(i).backgroundColor);
      const vacia = getComputedStyle(imp.querySelector('.prio i:nth-child(3)'));
      const punto = fila.querySelector('.tint-dot');
      return {
        texto: (fila.querySelector('.m-prio') || {}).textContent || '',
        textoImp: (imp.querySelector('.m-prio') || {}).textContent || '',
        barras, vaciaFondo: vacia.backgroundColor, vaciaBorde: vacia.boxShadow,
        punto: punto ? getComputedStyle(punto).backgroundColor : null,
        aria: fila.querySelector('.check').getAttribute('aria-label')
      };
    });
    ok(prio.texto === 'Urgente' && prio.textoImp === 'Importante', 'la prioridad se escribe: «Urgente», «Importante»', prio);
    ok(prio.vaciaFondo === 'rgba(0, 0, 0, 0)' && /inset/.test(prio.vaciaBorde), 'las barras que no cuentan quedan con su contorno (forma, no solo luz)', prio);
    ok(prio.punto === 'rgb(57, 135, 229)', 'la categoría «Viajes» lleva su punto azul', prio.punto);
    ok(/urgente/.test(prio.aria), 'el lector de pantalla oye la prioridad', prio.aria);
    const doing = await p.evaluate(() => {
      const fila = [...document.querySelectorAll('#screen-home .task')].find((x) => x.querySelector('.task-title').textContent === 'Empezada');
      return { check: fila.querySelector('.check').classList.contains('doing'), meta: (fila.querySelector('.m-doing') || {}).textContent, aria: fila.querySelector('.check').getAttribute('aria-label') };
    });
    ok(doing.check && doing.meta === 'En curso' && /en curso/.test(doing.aria), '«En curso»: media casilla, texto y lectura', doing);

    // Etiquetas de sección: en minúsculas y a 14-15 px
    const etiq = await p.evaluate(() => {
      const t = getComputedStyle(document.querySelector('#screen-home .sec-t'));
      return { tt: t.textTransform, fs: parseFloat(t.fontSize), ls: t.letterSpacing };
    });
    ok(etiq.tt === 'none' && etiq.fs >= 14, 'los títulos de sección ya no van en versalitas pequeñas', etiq);

    // Prioridad en color (opcional)
    await p.evaluate(() => Whider.State.setSetting('prioColor', true));
    await sleep(500);
    const color = await p.evaluate(() => {
      const fila = [...document.querySelectorAll('#screen-home .task')].find((x) => x.querySelector('.task-title').textContent === 'Urgente de hoy');
      return { attr: document.documentElement.getAttribute('data-prio-color'), texto: getComputedStyle(fila.querySelector('.m-prio')).color, barra: getComputedStyle(fila.querySelector('.prio')).color };
    });
    ok(color.attr === 'on' && color.texto === 'rgb(230, 103, 103)' && color.barra === 'rgb(230, 103, 103)', 'Ajustes → «Prioridad en color» pinta lo urgente en rojo', color);
    await p.evaluate(() => Whider.State.setSetting('prioColor', false));
    await sleep(300);
    ok(await p.evaluate(() => document.documentElement.getAttribute('data-prio-color')) === 'off', 'y se puede volver al blanco y negro');
    ok(!errs.length, 'sin errores (Hoy)', errs);
    await ctx.close();
  }

  /* 3. Móvil · barra inferior a elegir, «Más» y nombres claros */
  {
    const { ctx, p, errs } = await abrir(b, { ...devices['Pixel 7'] });
    const tabs = () => p.evaluate(() => [...document.querySelectorAll('.dock .tab')].map((t) => t.getAttribute('data-go')));
    ok(JSON.stringify(await tabs()) === JSON.stringify(['home', 'tasks', 'calendar', 'more']), 'barra por defecto: Hoy, Tareas, Calendario y Más', await tabs());
    await p.evaluate(() => Whider.Settings.open());
    await sleep(700);
    await p.click('.sheet .cell:has-text("Personalización")');
    await sleep(600);
    await p.click('.sheet .cell:has-text("Barra inferior")');
    await sleep(700);
    // Segunda pestaña → Cuaderno (la hoja de la barra queda encima de los Ajustes)
    const arriba = '#sheetRoot > .sheet-layer:last-child';
    await p.click(arriba + ' .cell:has-text("Tareas")');
    await sleep(600);
    await p.click('.menu .menu-item:has-text("Cuaderno")');
    await sleep(500);
    await p.click(arriba + ' button:has-text("Guardar")');
    await sleep(700);
    ok(JSON.stringify(await tabs()) === JSON.stringify(['home', 'notes', 'calendar', 'more']), 'elegir «Cuaderno» lo pone en la barra', await tabs());
    ok(await p.evaluate(() => Whider.State.settings.dock) === 'home,notes,calendar', 'y queda guardado en los ajustes');
    // «Atrás» primero vuelve de página dentro de los Ajustes y después los cierra
    await p.evaluate(() => { for (let i = 0; i < 6 && Whider.Sheet.closeTop(); i++); });
    await sleep(600);
    await p.evaluate(() => document.querySelector('.dock .tab[data-go="notes"]').click());
    await sleep(800);
    const activo = await p.evaluate(() => ({ screen: Whider.State.activeScreen, on: [...document.querySelectorAll('.dock .tab.active')].map((t) => t.getAttribute('data-go')) }));
    ok(activo.screen === 'notes' && JSON.stringify(activo.on) === '["notes"]', 'la pestaña Cuaderno abre el Cuaderno y es la única marcada', activo);
    await p.evaluate(() => Whider.Router.go('chats'));
    await sleep(500);
    ok(JSON.stringify(await p.evaluate(() => [...document.querySelectorAll('.dock .tab.active')].map((t) => t.getAttribute('data-go')))) === '["more"]', 'sin pestaña propia, Chats sigue marcando «Más»');
    // Una configuración con repetidos (p. ej. llegada de otra versión) se arregla sola: sin repetir y siempre tres
    await p.evaluate(() => Whider.State.setSetting('dock', 'chats,chats,focus'));
    await sleep(400);
    ok(JSON.stringify(await tabs()) === JSON.stringify(['chats', 'focus', 'home', 'more']), 'una configuración con repetidos se arregla sola (sin repetir, siempre tres)', await tabs());
    await p.evaluate(() => Whider.State.setSetting('dock', 'home,tasks,calendar'));
    await sleep(300);

    // «Más»: Cuaderno y Chats grandes; «Automatizaciones» en lugar de «Sistemas»
    await p.evaluate(() => Whider.Router.go('more'));
    await sleep(700);
    const mas = await p.evaluate(() => ({
      tiles: [...document.querySelectorAll('#screen-more .mo-tile b')].map((x) => x.textContent),
      filas: [...document.querySelectorAll('#screen-more .cell-title')].map((x) => x.textContent),
      sistemas: /Sistemas/.test(document.querySelector('#screen-more').textContent)
    }));
    ok(JSON.stringify(mas.tiles) === '["Cuaderno","Chats"]', '«Más» enseña el Cuaderno y los Chats en grande', mas);
    ok(mas.filas.includes('Automatizaciones') && !mas.sistemas, '«Sistemas» pasa a llamarse «Automatizaciones»', mas);
    await p.click('#screen-more .mo-tile:has-text("Cuaderno")');
    await sleep(700);
    ok(await p.evaluate(() => Whider.State.activeScreen) === 'notes', 'el acceso grande abre el Cuaderno');
    await p.evaluate(() => Whider.Router.go('automations'));
    await sleep(600);
    ok(await p.evaluate(() => document.querySelector('#screen-automations h1, #screen-automations .lt-title') && /Automatizaciones/.test(document.querySelector('#screen-automations').textContent)), 'la pantalla se titula «Automatizaciones»');
    ok(!errs.length, 'sin errores (barra y Más)', errs);
    await ctx.close();
  }

  /* 4. Ordenador · color de categoría desde su editor, «En curso» desde el menú y sin recuento repetido */
  {
    const { ctx, p, errs } = await abrir(b, { viewport: { width: 1440, height: 900 } });
    await p.evaluate(() => Whider.Lists.edit(null));
    await sleep(500);
    await p.fill('.sheet input.list-name', 'Estudio');
    await p.click('.sheet .tint-opt[aria-label="Violeta"]');
    await p.click('.sheet button:has-text("OK")');
    await sleep(500);
    const l = await p.evaluate(() => Whider.State.lists.find((x) => x.name === 'Estudio'));
    ok(l && l.tint === 'violeta', 'el editor de categoría guarda su color', l);
    const icono = await p.evaluate(() => {
      const it = [...document.querySelectorAll('.sb-item')].find((x) => x.textContent.includes('Estudio'));
      return it ? getComputedStyle(it.querySelector('.ic')).color : null;
    });
    ok(icono === 'rgb(144, 133, 233)', 'la barra lateral pinta su icono de violeta', icono);
    const id = await p.evaluate(() => {
      const S = Whider.State, td = Whider.U.today();
      // Tres urgentes ocupan «Lo más importante»; la del tema 3 queda en «Pendientes»
      ['Urgente A', 'Urgente B', 'Urgente C'].forEach((x) => S.addTask({ text: x, date: td, highlight: 'danger' }));
      const t = S.addTask({ text: 'Repasar el tema 3', date: td, listId: S.lists.find((x) => x.name === 'Estudio').id });
      Whider.Router.go('home'); Whider.Router.refresh();
      return t.id;
    });
    await sleep(700);
    await p.click('#screen-home .task:has-text("Repasar el tema 3") .task-title', { button: 'right' });
    await sleep(400);
    await p.click('.menu .menu-item:has-text("Marcar «En curso»")');
    await sleep(600);
    const est = await p.evaluate((x) => ({ started: !!Whider.State.find(x).startedAt, sec: [...document.querySelectorAll('#screen-home .sec')].filter((s) => /En curso/.test((s.querySelector('.sec-t') || {}).textContent || '')).map((s) => s.textContent) }), id);
    ok(est.started && est.sec.length === 1 && /Repasar el tema 3/.test(est.sec[0]), 'menú → «Marcar En curso» la lleva a su grupo', est);
    await p.evaluate((x) => Whider.Editor.open(x), id);
    await sleep(600);
    ok(await p.evaluate(() => document.querySelector('.sheet.editor input[aria-label="En curso"]').checked), 'el editor muestra el interruptor «En curso» encendido');
    await p.click('.sheet.editor label.switch:has(input[aria-label="En curso"])');
    await p.click('.sheet.editor button:has-text("Guardar cambios")');
    await sleep(600);
    ok(await p.evaluate((x) => Whider.State.find(x).startedAt === null, id), 'y desde el editor se vuelve a pendiente');
    const lado = await p.evaluate(() => ({
      buddy: (document.querySelector('.buddy-card .buddy-meta') || {}).textContent || '',
      resumen: !!document.querySelector('.desk-side .hero')
    }));
    ok(lado.resumen && !/tareas? hechas? hoy/.test(lado.buddy), 'ordenador: con el resumen a la vista, el personaje no repite el recuento', lado);
    const sb = await p.evaluate(() => [...document.querySelectorAll('.sb-head')].map((x) => ({ t: x.textContent, tt: getComputedStyle(x).textTransform, fs: parseFloat(getComputedStyle(x).fontSize) })));
    ok(sb.length && sb.every((x) => x.tt === 'none' && x.fs >= 13), 'barra lateral: grupos en minúsculas y a 13 px o más', sb);
    ok(await p.evaluate(() => [...document.querySelectorAll('.sb-item')].some((x) => x.textContent.includes('Automatizaciones'))), 'barra lateral: «Automatizaciones»');
    ok(!errs.length, 'sin errores (ordenador)', errs);
    await ctx.close();
  }

  await b.close();
  console.log(fails ? fails + ' FALLOS' : 'TODO OK');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
