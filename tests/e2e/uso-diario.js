// Uso diario: «Primeros pasos» (que se cumplen solos), Hoy por importancia (lo empezado delante, lo vencido con
// su fecha en rojo y lo hecho plegado), la importancia escrita y en color, colores de categoría, «En curso»
// desde el menú y el editor, y la barra lateral del ordenador.
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

  /* 1. Móvil · persona nueva: primeros pasos, sin tareas de ejemplo */
  {
    const { ctx, p, errs } = await abrir(b, { ...devices['Pixel 7'] });
    const fs = await p.evaluate(() => {
      const sec = document.querySelector('#screen-home .sec.first-steps');
      return { hay: !!sec, n: sec ? sec.querySelectorAll('.fs-step').length : 0, cuenta: sec ? sec.querySelector('.sec-t small').textContent : '', tareas: Whider.State.tasks.length };
    });
    ok(fs.hay && fs.n === 5 && fs.cuenta === '0 de 5' && fs.tareas === 0, 'persona nueva: «Primeros pasos» con 5 pasos y ninguna tarea de ejemplo', fs);
    // «Añade algo de cada día» lleva al campo de Hoy con «Cada día» ya elegido
    await p.click('#screen-home .fs-step:has-text("Añade algo de cada día")');
    await sleep(500);
    ok(await p.evaluate(() => document.activeElement && document.activeElement.closest('.composer') && document.querySelector('#screen-home .cp-opt[aria-pressed="true"]')), 'el paso «cada día» lleva al campo con «Cada día» elegido');
    await p.keyboard.type('Leer 20 minutos');
    await p.keyboard.press('Enter');
    await sleep(500);
    await p.evaluate(() => {
      Whider.State.addTask({ text: 'Mi primera tarea', date: Whider.U.today(), time: '23:30', highlight: 'purple' });
      Whider.Router.refresh();
    });
    await sleep(500);
    const hechos = await p.evaluate(() => [...document.querySelectorAll('#screen-home .fs-step.done b')].map((x) => x.textContent));
    ok(hechos.includes('Escribe tu primera tarea') && hechos.includes('Marca lo importante') && hechos.includes('Añade algo de cada día'), 'los pasos se marcan solos al cumplirse', hechos);
    const orden = await p.evaluate(() => [...document.querySelectorAll('#screen-home .sec-t > span:first-child')].map((x) => x.textContent));
    ok(orden.indexOf('Primeros pasos') > orden.indexOf('Por hacer') && orden.indexOf('Cada día') < orden.indexOf('Por hacer'), 'arriba lo de cada día y lo que hay que hacer; los primeros pasos, después', orden);
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

  /* 3. Ordenador · color de categoría desde su editor, «En curso» desde el menú y la barra lateral */
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
    const sb = await p.evaluate(() => [...document.querySelectorAll('.sb-head')].map((x) => ({ t: x.textContent, tt: getComputedStyle(x).textTransform, fs: parseFloat(getComputedStyle(x).fontSize) })));
    ok(sb.length && sb.every((x) => x.tt === 'none' && x.fs >= 13), 'barra lateral: grupos en minúsculas y a 13 px o más', sb);
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
