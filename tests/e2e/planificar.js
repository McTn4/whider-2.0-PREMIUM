// Planificar arrastrando (ordenador): el panel «Por planificar» del calendario con lo vencido y lo que no tiene fecha;
// arrastrar a una hora de la semana, a la fila «Sin hora», a la cabecera de un día y a una casilla del mes; devolver
// una tarea al panel le quita la fecha (salvo si se repite); ocultarlo y volver a mostrarlo; el filtro de categoría.
// El arrastre se simula con DragEvent y DataTransfer, como lo hace el navegador.
const { chromium } = require('playwright');
const { APP } = require('./_util');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let fails = 0;
const ok = (c, m, extra) => { console.log((c ? 'OK   ' : 'FAIL ') + m + (!c && extra !== undefined ? '  → ' + JSON.stringify(extra) : '')); if (!c) fails++; };

(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, timezoneId: 'Europe/Madrid' });
  await ctx.addInitScript(() => {
    window.WHIDER_CONFIG = { firebase: null };
    localStorage.setItem('whider.meta.v1', JSON.stringify({ onboarded: true, createdAt: Date.now() - 60 * 86400000 }));
  });
  const p = await ctx.newPage();
  p.setDefaultTimeout(6000);
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  p.on('console', (m) => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
  await p.goto(APP);
  await sleep(1500);
  const ids = await p.evaluate(() => {
    Whider.Notify.check = function () {};
    const S = Whider.State, U = Whider.U, t = U.today();
    // Las categorías ya no vienen de serie: se crean con los mismos identificadores que antes
    S.lists.push({ id: 'personal', name: 'Personal', color: 'iris', icon: 'user' }, { id: 'work', name: 'Trabajo', color: 'ember', icon: 'briefcase' });
    S.notify('lists');
    const add = (o) => S.addTask(Object.assign({ warn: false, highlight: 'none', repeat: 'none', listId: 'personal' }, o)).id;
    const r = {
      informe: add({ text: 'Escribir el informe', date: null, highlight: 'danger', listId: 'work' }),
      fontanero: add({ text: 'Llamar al fontanero', date: null }),
      dni: add({ text: 'Renovar el DNI', date: U.addDays(t, -2) }),
      plantas: add({ text: 'Regar las plantas', date: t, repeat: 'daily' })
    };
    const h = add({ text: 'Hecha sin fecha', date: null });
    S.setDone(h, true);
    S.ui.calView = 'week';
    S.ui.calSelected = t;
    Whider.Router.go('calendar');
    return r;
  });
  await sleep(600);
  const hoy = await p.evaluate(() => Whider.U.today());

  // ---- El panel
  const panel = p.locator('.cal-plan');
  ok(await panel.count() === 1, 'semana: panel «Por planificar» a la derecha');
  const textos = await p.locator('.cal-plan .pl-item b').allInnerTexts();
  ok(JSON.stringify(textos) === JSON.stringify(['Renovar el DNI', 'Escribir el informe', 'Llamar al fontanero']), 'vencidas primero; sin fecha, lo urgente arriba; lo hecho no sale', textos);
  const secs = await p.locator('.cal-plan .pl-sec').allInnerTexts();
  ok(secs.length === 2 && /Vencidas\s*1/i.test(secs[0]) && /Sin fecha\s*2/i.test(secs[1]), 'con sus apartados y cuántas hay', secs);
  ok(/Vencida · /.test(await p.locator('.pl-item', { hasText: 'Renovar el DNI' }).innerText()), 'la vencida dice desde cuándo');
  ok(await p.locator('.ct-plan.on', { hasText: 'Por planificar (3)' }).count() === 1, 'barra: «Por planificar (3)», encendido');
  ok(await p.locator('.pl-item').first().evaluate((el) => el.draggable === true), 'las tareas del panel se pueden arrastrar');

  /** Suelta una tarea en un elemento, a la altura y (opcional) de una hora concreta */
  const soltar = (id, selector, hhmm) => p.evaluate(({ id, selector, hhmm }) => {
    const el = document.querySelector(selector);
    const r = el.getBoundingClientRect();
    let y = r.top + 10;
    if (hhmm) {
      const body = el.closest('.wg-body'), hourH = parseFloat(body.style.getPropertyValue('--hour-h'));
      const first = parseInt(document.querySelector('.wg-hours span').textContent, 10);
      const parts = hhmm.split(':');
      y = r.top + ((+parts[0] * 60 + +parts[1]) - first * 60) / 60 * hourH + 2;
    }
    const dt = new DataTransfer();
    dt.setData(Whider.Sidebar.DRAG_TYPE, id);
    const at = { bubbles: true, cancelable: true, dataTransfer: dt, clientX: r.left + 10, clientY: y };
    el.dispatchEvent(new DragEvent('dragover', at));
    el.dispatchEvent(new DragEvent('drop', at));
    return !!el;
  }, { id, selector, hhmm });
  const tarea = (id) => p.evaluate((i) => { const t = Whider.State.find(i); return { date: t.date, time: t.time }; }, id);

  // ---- A una hora de hoy
  await soltar(ids.informe, '.wg-col[data-date="' + hoy + '"]', '10:00');
  await sleep(400);
  ok(JSON.stringify(await tarea(ids.informe)) === JSON.stringify({ date: hoy, time: '10:00' }), 'soltada a las 10:00 de hoy: ese día, a esa hora', await tarea(ids.informe));
  ok(await p.locator('.wg-col[data-date="' + hoy + '"] .wg-blk', { hasText: 'Escribir el informe' }).count() === 1, 'y aparece en su hora');
  ok(await p.locator('.cal-plan .pl-item', { hasText: 'Escribir el informe' }).count() === 0, 'y sale del panel');
  ok(/«Escribir el informe» pasa al/.test(await p.locator('.toast').last().innerText().catch(() => '')), 'con un aviso');

  // ---- A la fila «Sin hora» y a la cabecera de un día
  await soltar(ids.fontanero, '.wg-adcell[data-date="' + hoy + '"]');
  await sleep(400);
  ok(JSON.stringify(await tarea(ids.fontanero)) === JSON.stringify({ date: hoy, time: null }), '«Sin hora»: ese día, sin hora', await tarea(ids.fontanero));
  await soltar(ids.dni, '.wg-day.today');
  await sleep(400);
  ok((await tarea(ids.dni)).date === hoy, 'cabecera del día: la vencida pasa a hoy', await tarea(ids.dni));
  ok(await p.locator('.pl-empty', { hasText: 'Todo planificado' }).count() === 1, 'panel vacío: «Todo planificado»');

  // ---- Devolver al panel: sin fecha (las que se repiten, no)
  await soltar(ids.informe, '.cal-plan');
  await sleep(400);
  ok(JSON.stringify(await tarea(ids.informe)) === JSON.stringify({ date: null, time: null }), 'soltada en el panel: sin fecha ni hora', await tarea(ids.informe));
  ok(await p.locator('.cal-plan .pl-item', { hasText: 'Escribir el informe' }).count() === 1, 'y vuelve al panel');
  await soltar(ids.plantas, '.cal-plan');
  await sleep(400);
  ok((await tarea(ids.plantas)).date === hoy, 'una que se repite no pierde la fecha');
  ok(/se repite necesita una fecha/.test(await p.locator('.toast').last().innerText().catch(() => '')), 'y se explica por qué');

  // ---- Filtro de categoría
  await p.evaluate(() => { Whider.State.ui.calList = 'personal'; Whider.Router.refresh(); });
  await sleep(300);
  ok(await p.locator('.cal-plan .pl-item').count() === 0, 'con el filtro «Personal», no sale la de Trabajo');
  await p.evaluate(() => { Whider.State.ui.calList = null; Whider.Router.refresh(); });
  await sleep(300);

  // ---- Mes y día
  await p.evaluate(() => { Whider.State.ui.calView = 'month'; Whider.Router.refresh(); });
  await sleep(500);
  ok(await p.locator('.cal-side .cal-plan').count() === 1, 'mes: el panel, debajo del día elegido');
  const dentro = await p.evaluate(() => Whider.U.addDays(Whider.U.today(), 3));
  const hay = await p.evaluate((d) => !!document.querySelector('.mg-cell[data-date="' + d + '"]'), dentro);
  if (hay) {
    await soltar(ids.informe, '.mg-cell[data-date="' + dentro + '"]');
    await sleep(400);
    ok((await tarea(ids.informe)).date === dentro, 'mes: soltada en una casilla, a ese día', await tarea(ids.informe));
  }
  await p.evaluate(() => { Whider.State.ui.calView = 'day'; Whider.Router.refresh(); });
  await sleep(400);
  ok(await p.locator('.cal-plan').count() === 1, 'día: también');
  await p.evaluate(() => { Whider.State.ui.calView = 'agenda'; Whider.Router.refresh(); });
  await sleep(400);
  ok(await p.locator('.cal-plan').count() === 0 && await p.locator('.ct-plan').count() === 0, 'agenda: sin panel ni botón');

  // ---- Ocultar y volver a mostrar (se recuerda)
  await p.evaluate(() => { Whider.State.ui.calView = 'week'; Whider.Router.refresh(); });
  await sleep(400);
  await p.locator('.cal-plan .pl-head .circle-btn').click();
  await sleep(400);
  ok(await p.locator('.cal-plan').count() === 0 && await p.evaluate(() => Whider.State.settings.desk.plan) === false, 'oculto con ×, y se recuerda en los ajustes');
  ok(await p.locator('.ct-plan:not(.on)').count() === 1, 'el botón de la barra queda apagado');
  await p.locator('.ct-plan').click();
  await sleep(400);
  ok(await p.locator('.cal-plan').count() === 1, 'y lo vuelve a mostrar');

  ok(errs.length === 0, 'sin errores en la página', errs);
  await b.close();
  console.log(fails ? '\n' + fails + ' FALLOS' : '\nTODO OK');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
