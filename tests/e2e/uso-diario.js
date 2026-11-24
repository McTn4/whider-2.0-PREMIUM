// Uso diario: «Primeros pasos» (que se cumplen solos), Hoy por importancia (lo empezado delante, lo vencido con
// su fecha en rojo y lo hecho plegado), la importancia escrita y en color, colores de categoría, «En curso»
// desde el menú y el editor, y el panel de Tareas del ordenador.
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
  p.on('console', (m) => {
    if (m.type() === 'error') errs.push('console: ' + m.text());
  });
  await p.goto(APP);
  await sleep(1600);
  await p.evaluate(() => {
    Whider.Notify.check = function () {};
  });
  return { ctx, p, errs };
}

(async () => {
  const b = await chromium.launch();

  /* 1. Móvil · persona nueva: Inicio vacío, sin tutorial ni tareas ni categorías de ejemplo */
  {
    const { ctx, p, errs } = await abrir(b, { ...devices['Pixel 7'] });
    const ini = await p.evaluate(() => ({
      tutorial: !!document.querySelector('#screen-home .first-steps, #screen-home .fs-step'),
      tareas: Whider.State.tasks.length,
      categorias: Whider.State.lists.length,
      campo: !!document.querySelector('#screen-home .composer input')
    }));
    ok(!ini.tutorial && ini.tareas === 0 && ini.categorias === 0 && ini.campo, 'persona nueva: Inicio con su campo, sin tutorial, tareas ni categorías de ejemplo', ini);
    // «Cada día» junto al campo: la tarea nace como tarea de cada día
    await p.click('#screen-home .cp-opt:has-text("Cada día")');
    await p.fill('#screen-home .composer input', 'Leer 20 minutos');
    await p.keyboard.press('Enter');
    await sleep(500);
    await p.evaluate(() => {
      Whider.State.addTask({ text: 'Mi primera tarea', date: Whider.U.today(), time: '23:30', highlight: 'purple' });
      Whider.Router.refresh();
    });
    await sleep(500);
    const orden = await p.evaluate(() => [...document.querySelectorAll('#screen-home .sec-t > span:first-child')].map((x) => x.textContent));
    ok(orden.indexOf('Cada día') >= 0 && orden.indexOf('Cada día') < orden.indexOf('Por hacer'), 'arriba lo de cada día y después lo que hay que hacer', orden);
    ok(await p.evaluate(() => Whider.State.tasks.some((t) => t.text === 'Leer 20 minutos' && t.repeat === 'daily')), '«Cada día» junto al campo crea una tarea de cada día');
    ok(!errs.length, 'sin errores (persona nueva)', errs);
    await ctx.close();
  }

  /* 2. Móvil · Hoy por importancia, lo vencido, lo empezado y lo hecho */
  {
    const { ctx, p, errs } = await abrir(b, { ...devices['Pixel 7'] }, { onboarded: true, createdAt: Date.now() - 60 * 86400000 });
    await p.evaluate(() => {
      const S = Whider.State,
        U = Whider.U,
        td = U.today();
      const viaje = S.addList('Viajes', null, 'send', 'azul');
      S.addTask({ text: 'Normal de hoy', date: td });
      S.addTask({ text: 'Destacada de hoy', date: td, highlight: 'star' });
      S.addTask({ text: 'Importante de hoy', date: td, time: '23:55', highlight: 'purple' });
      S.addTask({ text: 'Urgente de hoy', date: td, time: '23:50', highlight: 'danger', listId: viaje.id });
      const e = S.addTask({ text: 'Empezada', date: td });
      S.setStarted(e.id, true);
      S.addTask({ text: 'De anteayer', date: U.addDays(td, -2) });
      S.addTask({ text: 'Urgente de anteayer', date: U.addDays(td, -2), highlight: 'danger' });
      const h = S.addTask({ text: 'Ya hecha', date: td });
      S.setDone(h.id, true);
      Whider.Router.go('home');
      Whider.Router.refresh();
    });
    await sleep(900);
    const hoy = await p.evaluate(() => ({
      todo: [...document.querySelectorAll('#screen-home .todo-sec .task-title')].map((x) => x.textContent),
      hechas: (document.querySelector('#screen-home .done-toggle') || {}).textContent || '',
      cuenta: document.querySelector('#screen-home .lt-sub').textContent
    }));
    ok(
      JSON.stringify(hoy.todo) === JSON.stringify(['Empezada', 'Urgente de anteayer', 'Urgente de hoy', 'Importante de hoy', 'Destacada de hoy', 'De anteayer', 'Normal de hoy']),
      '«Por hacer»: lo empezado, después urgente, importante, destacada y normal (lo vencido delante a igual importancia)',
      hoy.todo
    );
    ok(/1 hecha hoy/.test(hoy.hechas), 'lo hecho, plegado al final', hoy.hechas);
    ok(/de \d+ hechas/.test(hoy.cuenta), 'el día, de un vistazo bajo el título', hoy.cuenta);
    const prio = await p.evaluate(() => {
      const fila = (t) => [...document.querySelectorAll('#screen-home .task')].find((x) => x.querySelector('.task-title').textContent === t);
      const u = fila('Urgente de hoy'),
        i = fila('Importante de hoy'),
        d = fila('Destacada de hoy'),
        v = fila('De anteayer');
      return {
        texto: (u.querySelector('.m-prio') || {}).textContent || '',
        textoImp: (i.querySelector('.m-prio') || {}).textContent || '',
        colorTexto: getComputedStyle(u.querySelector('.m-prio')).color,
        aros: [u, i, d].map((x) => getComputedStyle(x.querySelector('.check')).borderTopColor),
        tarde: v.querySelector('.late') ? getComputedStyle(v.querySelector('.late')).color : null,
        punto: u.querySelector('.tint-dot') ? getComputedStyle(u.querySelector('.tint-dot')).backgroundColor : null,
        aria: u.querySelector('.check').getAttribute('aria-label')
      };
    });
    ok(prio.texto === 'Urgente' && prio.textoImp === 'Importante', 'la importancia se escribe: «Urgente», «Importante»', prio);
    ok(prio.colorTexto === 'rgb(255, 105, 97)', 'y va en color: lo urgente en rojo', prio.colorTexto);
    ok(JSON.stringify(prio.aros) === JSON.stringify(['rgb(255, 105, 97)', 'rgb(255, 159, 10)', 'rgb(255, 214, 10)']), 'el círculo: rojo urgente, naranja importante y amarillo destacada', prio.aros);
    ok(prio.tarde === 'rgb(255, 105, 97)', 'lo vencido lleva su fecha en rojo', prio.tarde);
    ok(prio.punto === 'rgb(57, 135, 229)', 'la categoría «Viajes» lleva su punto azul', prio.punto);
    ok(/urgente/.test(prio.aria), 'el lector de pantalla oye la importancia', prio.aria);
    const doing = await p.evaluate(() => {
      const fila = [...document.querySelectorAll('#screen-home .task')].find((x) => x.querySelector('.task-title').textContent === 'Empezada');
      return { check: fila.querySelector('.check').classList.contains('doing'), meta: (fila.querySelector('.m-doing') || {}).textContent, aria: fila.querySelector('.check').getAttribute('aria-label') };
    });
    ok(doing.check && doing.meta === 'En curso' && /en curso/.test(doing.aria), '«En curso»: medio círculo, texto y lectura', doing);
    const etiq = await p.evaluate(() => {
      const t = getComputedStyle(document.querySelector('#screen-home .sec-t'));
      return { tt: t.textTransform, fs: parseFloat(t.fontSize), fw: +t.fontWeight };
    });
    ok(etiq.tt === 'none' && etiq.fs >= 18 && etiq.fw >= 700, 'los títulos de sección, grandes y en negrita (sin versalitas)', etiq);
    // Con muchas vencidas, Hoy enseña las más recientes y lleva al resto
    await p.evaluate(() => {
      const S = Whider.State,
        U = Whider.U;
      for (let i = 3; i < 12; i++) S.addTask({ text: 'Vieja ' + i, date: U.addDays(U.today(), -i) });
      Whider.Router.refresh();
    });
    await sleep(500);
    ok(await p.evaluate(() => /Ver las \d+ vencidas/.test(document.querySelector('#screen-home .sec-more').textContent)), 'con muchas vencidas: «Ver las N vencidas»');
    ok(!errs.length, 'sin errores (Hoy)', errs);
    await ctx.close();
  }

  /* 3. Ordenador · color de categoría desde su editor, «En curso» desde el menú y el panel de Tareas */
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
    await p.evaluate(() => Whider.Router.go('tasks'));
    await sleep(400);
    const icono = await p.evaluate(() => {
      const it = [...document.querySelectorAll('#screen-tasks .tp-item')].find((x) => x.textContent.includes('Estudio'));
      return it ? getComputedStyle(it.querySelector('.ic')).color : null;
    });
    ok(icono === 'rgb(144, 133, 233)', 'el panel de Tareas pinta su icono de violeta', icono);
    const sb = await p.evaluate(() => [...document.querySelectorAll('#screen-tasks .tp-head')].map((x) => ({ t: x.textContent, tt: getComputedStyle(x).textTransform, fs: parseFloat(getComputedStyle(x).fontSize) })));
    ok(sb.length && sb.every((x) => x.tt === 'none' && x.fs >= 13), 'panel de Tareas: grupos en minúsculas y a 13 px o más', sb);
    // Buscar en el panel: la lista cambia al escribir, pero el campo no se rehace (no se pierden los acentos que se
    // escriben en dos pulsaciones) y, mientras se compone una letra, no se busca
    await p.evaluate(() => ['Comprar pan', 'Pan integral', 'Leche'].forEach((text) => Whider.State.addTask({ text })));
    await sleep(400);
    await p.click('#screen-tasks .tasks-pane input[type=search]');
    await p.keyboard.type('p');
    await sleep(400);
    await p.evaluate(() => { window.__campo = document.querySelector('#screen-tasks .tasks-pane input[type=search]'); });
    await p.keyboard.type('an');
    await sleep(400);
    const busca = await p.evaluate(() => {
      const inp = document.querySelector('#screen-tasks .tasks-pane input[type=search]');
      return { mismo: inp === window.__campo, foco: document.activeElement === inp, valor: inp.value, tareas: [...document.querySelectorAll('#screen-tasks .tasks-main .task-title')].map((x) => x.textContent) };
    });
    ok(busca.mismo && busca.foco && busca.valor === 'pan' && busca.tareas.includes('Comprar pan') && busca.tareas.includes('Pan integral') && !busca.tareas.includes('Leche'), 'buscar en el panel: cambia la lista y el campo sigue siendo el mismo', busca);
    const compone = await p.evaluate(async () => {
      const inp = document.querySelector('#screen-tasks .tasks-pane input[type=search]');
      inp.dispatchEvent(new CompositionEvent('compositionstart'));
      inp.value = 'pan ´';
      inp.dispatchEvent(new InputEvent('input', { isComposing: true }));
      await new Promise((r) => setTimeout(r, 400));
      const durante = Whider.State.ui.query;
      inp.value = 'pan í';
      inp.dispatchEvent(new CompositionEvent('compositionend'));
      await new Promise((r) => setTimeout(r, 400));
      return { durante, despues: Whider.State.ui.query, mismo: inp === document.querySelector('#screen-tasks .tasks-pane input[type=search]') };
    });
    ok(compone.durante === 'pan' && compone.despues === 'pan í' && compone.mismo, 'mientras se compone una letra (´ + i) no se busca ni se rehace el campo', compone);
    await p.evaluate(() => {
      const S = Whider.State;
      S.ui.query = '';
      S.tasks.filter((t) => ['Comprar pan', 'Pan integral', 'Leche'].includes(t.text)).forEach((t) => S.removeTask(t.id));
    });
    const id = await p.evaluate(() => {
      const S = Whider.State,
        td = Whider.U.today();
      ['Urgente A', 'Urgente B'].forEach((x) => S.addTask({ text: x, date: td, highlight: 'danger' }));
      const t = S.addTask({ text: 'Repasar el tema 3', date: td, listId: S.lists.find((x) => x.name === 'Estudio').id });
      Whider.Router.go('home');
      Whider.Router.refresh();
      return t.id;
    });
    await sleep(700);
    await p.click('#screen-home .task:has-text("Repasar el tema 3") .task-title', { button: 'right' });
    await sleep(400);
    await p.click('.menu .menu-item:has-text("Marcar «En curso»")');
    await sleep(600);
    const est = await p.evaluate((x) => ({
      started: !!Whider.State.find(x).startedAt,
      primera: document.querySelector('#screen-home .todo-sec .task-title').textContent
    }), id);
    ok(est.started && est.primera === 'Repasar el tema 3', 'menú → «Marcar En curso» la pone delante de todo', est);
    await p.evaluate((x) => Whider.Editor.open(x), id);
    await sleep(600);
    ok(await p.evaluate(() => document.querySelector('.sheet.editor input[aria-label="En curso"]').checked), 'el editor muestra el interruptor «En curso» encendido');
    await p.click('.sheet.editor label.switch:has(input[aria-label="En curso"])');
    await p.click('.sheet.editor button:has-text("Guardar cambios")');
    await sleep(600);
    ok(await p.evaluate((x) => Whider.State.find(x).startedAt === null, id), 'y desde el editor se vuelve a pendiente');
    ok(await p.evaluate(() => !!document.querySelector('.desk-side .side-card')), 'a la derecha de Hoy, los próximos días');
    ok(!errs.length, 'sin errores (ordenador)', errs);
    await ctx.close();
  }

  await b.close();
  console.log(fails ? fails + ' FALLOS' : 'TODO OK');
  process.exit(fails ? 1 : 0);
})().catch((e) => {
  console.error(e);
  process.exit(2);
});
