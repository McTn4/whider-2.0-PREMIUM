// 1.1 · Importar desde otras apps: Todoist (con vista previa, categorías nuevas y deshacer), repetidas que
// no se duplican, un calendario .ics (con o sin eventos pasados), una hoja de cálculo eligiendo columnas y
// un archivo de otro tipo que se reconoce solo.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { APP, FX } = require('./_util');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let fails = 0;
const ok = (c, m, extra) => { console.log((c ? 'OK   ' : 'FAIL ') + m + (!c && extra !== undefined ? '  → ' + JSON.stringify(extra) : '')); if (!c) fails++; };

const TODOIST = path.join(FX, 'Trabajo.csv');
const ICS = path.join(FX, 'calendario.ics');
const HOJA = path.join(FX, 'hoja.csv');
fs.writeFileSync(TODOIST, [
  'TYPE,CONTENT,DESCRIPTION,PRIORITY,INDENT,AUTHOR,RESPONSIBLE,DATE,DATE_LANG,TIMEZONE,DURATION,DURATION_UNIT',
  'section,Esta semana,,,,,,,,,,',
  'task,Preparar la presentación,Con gráficos,1,1,Ana (1),,2030-11-20 10:00,es,Europe/Madrid,,',
  'task,Diapositivas,,4,2,Ana (1),,,es,Europe/Madrid,,',
  'task,Regar las plantas,,4,1,Ana (1),,every day,en,Europe/Madrid,,',
  'task,Enviar el informe,,2,1,Ana (1),,2030-11-21,es,Europe/Madrid,,'
].join('\n'));
fs.writeFileSync(ICS, [
  'BEGIN:VCALENDAR', 'VERSION:2.0', 'X-WR-CALNAME:Personal',
  'BEGIN:VEVENT', 'SUMMARY:Dentista', 'DTSTART;TZID=Europe/Madrid:20301120T170000', 'DTEND;TZID=Europe/Madrid:20301120T173000', 'END:VEVENT',
  'BEGIN:VEVENT', 'SUMMARY:Cumpleaños de 2020', 'DTSTART;VALUE=DATE:20200101', 'END:VEVENT',
  'END:VCALENDAR'
].join('\r\n'));
fs.writeFileSync(HOJA, '﻿Asunto;Vence;Etiqueta;Prioridad\nComprar regalo;24/12/2030;Casa;Alta\nRenovar el seguro;2030-12-01;Coche;\n');

(async () => {
  const b = await chromium.launch();
  // Hora de Madrid en el navegador de la prueba: así el resultado no depende de la máquina
  const ctx = await b.newContext({ viewport: { width: 1280, height: 860 }, timezoneId: 'Europe/Madrid' });
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
  await sleep(1600);
  await p.evaluate(() => { Whider.Notify.check = function () {}; });

  const abrir = async (origen) => {
    await p.evaluate(() => Whider.ImportWizard.open());
    await sleep(500);
    await p.click(`.sheet .cell:has-text("${origen}")`);
    await sleep(300);
  };
  const elegir = async (archivo) => {
    const [fc] = await Promise.all([p.waitForEvent('filechooser'), p.click('.sheet .imp-actions .btn.primary')]);
    await fc.setFiles(archivo);
    await sleep(700);
  };
  const datos = () => p.evaluate(() => (document.querySelector('.sheet .imp-facts') || {}).textContent || '');

  /* 1. Todoist: vista previa, importar y deshacer */
  await abrir('Todoist');
  ok(await p.evaluate(() => /Exportar como CSV/.test(document.querySelector('.sheet .imp-how').textContent)), 'explica cómo exportar desde Todoist');
  await elegir(TODOIST);
  const f1 = await datos();
  ok(/3 tareas para importar/.test(f1) && /categorías nuevas: Trabajo · Esta semana/.test(f1), 'vista previa: 3 tareas y la categoría nueva', f1);
  ok(await p.evaluate(() => document.querySelectorAll('.sheet .sec .cell').length) >= 3, 'enseña las tareas que se van a importar');
  await p.click('.sheet .imp-actions .btn.primary:has-text("Importar 3 tareas")');
  await sleep(700);
  const imp = await p.evaluate(() => {
    const S = Whider.State, l = S.lists.find((x) => x.name === 'Trabajo · Esta semana');
    const t = S.tasks.find((x) => x.text === 'Preparar la presentación');
    return { n: S.tasks.length, lista: !!l, enLista: l ? S.tasks.filter((x) => x.listId === l.id).length : 0, t: t && { date: t.date, time: t.time, h: t.highlight, subs: t.subtasks.map((s) => s.text), notes: t.notes } };
  });
  ok(imp.n === 3 && imp.lista && imp.enLista === 3, 'importa las 3 tareas en su categoría nueva', imp);
  ok(imp.t && imp.t.date === '2030-11-20' && imp.t.time === '10:00' && imp.t.h === 'danger' && imp.t.subs[0] === 'Diapositivas' && imp.t.notes === 'Con gráficos', 'con fecha, hora, prioridad, subtareas y notas', imp.t);
  // Otra vez el mismo archivo: todas repetidas, nada que importar
  await abrir('Todoist');
  await elegir(TODOIST);
  const f2 = await datos();
  ok(/0 tareas para importar/.test(f2) && /3 ya las tienes \(no se importan\)/.test(f2), 'el mismo archivo otra vez: reconoce las 3 repetidas', f2);
  ok(await p.evaluate(() => document.querySelector('.sheet .imp-actions .btn.primary').disabled), 'y no deja importar 0 tareas');
  await p.evaluate(() => Whider.Sheet.closeTop());
  await sleep(400);
  // Deshacer
  const undo = await p.evaluate(() => Whider.ImportWizard.undo());
  ok(undo === 3 && await p.evaluate(() => Whider.State.tasks.length === 0 && !Whider.State.lists.some((x) => x.name === 'Trabajo · Esta semana')), 'deshacer quita lo importado y la categoría que creó');

  /* 2. Calendario: lo pasado, solo si se pide */
  await abrir('Calendario');
  await elegir(ICS);
  ok(/1 tarea para importar/.test(await datos()), 'calendario: por defecto solo lo de hoy en adelante', await datos());
  await p.click('.sheet .cell:has-text("Incluir los eventos pasados") label.switch');
  await sleep(400);
  ok(/2 tareas para importar/.test(await datos()), 'con «Incluir los eventos pasados», también el antiguo', await datos());
  await p.click('.sheet .imp-actions .btn.primary');
  await sleep(600);
  const ev = await p.evaluate(() => { const t = Whider.State.tasks.find((x) => x.text === 'Dentista'); return t && { date: t.date, time: t.time, dur: t.duration }; });
  ok(ev && ev.date === '2030-11-20' && ev.time === '17:00' && ev.dur === 30, 'el evento llega con su día, hora y duración', ev);

  /* 3. Hoja de cálculo: se eligen las columnas */
  await abrir('Hoja de cálculo');
  await elegir(HOJA);
  ok(await p.evaluate(() => !!document.querySelector('.sheet .imp-map')), 'pregunta qué es cada columna');
  const adivinado = await p.evaluate(() => [...document.querySelectorAll('.sheet .imp-sel')].map((s) => s.value));
  ok(adivinado[0] === '0' && adivinado[1] === '1' && adivinado[4] === '3', 'adivina la tarea, la fecha y la prioridad', adivinado);
  await p.selectOption('.sheet .imp-sel[aria-label="Categoría"]', '2');
  await p.click('.sheet .imp-actions .btn.primary:has-text("Ver la vista previa")');
  await sleep(400);
  await p.click('.sheet .imp-actions .btn.primary');
  await sleep(600);
  const hoja = await p.evaluate(() => { const S = Whider.State, t = S.tasks.find((x) => x.text === 'Comprar regalo'); return t && { date: t.date, lista: (S.getList(t.listId) || {}).name, h: t.highlight }; });
  ok(hoja && hoja.date === '2030-12-24' && hoja.lista === 'Casa' && hoja.h === 'purple', 'la hoja entra con fecha (día/mes/año), categoría y prioridad', hoja);

  /* 4. Archivo de otro tipo: se reconoce solo */
  await abrir('Google Tasks');
  await elegir(ICS);
  ok(await p.evaluate(() => /Vista previa/.test(document.querySelector('.sheet .imp-title').textContent)), 'un .ics elegido como Google Tasks se lee como calendario');
  await p.evaluate(() => Whider.Sheet.closeTop());

  /* 5. «Compartir con WHIDER» en la web instalada: /app?title=…&text=…&url=… abre una tarea nueva */
  const p2 = await ctx.newPage();
  p2.on('pageerror', (e) => errs.push(e.message));
  await p2.goto(APP + '?title=' + encodeURIComponent('Leer el artículo') + '&text=' + encodeURIComponent('Sobre productividad') + '&url=' + encodeURIComponent('https://ejemplo.com/a'));
  await sleep(2400);
  const sh = await p2.evaluate(() => ({ t: (document.querySelector('.sheet.editor textarea.title') || {}).value, n: (document.querySelector('.sheet.editor textarea.note') || {}).value, q: location.search }));
  ok(sh.t === 'Leer el artículo' && /Sobre productividad/.test(sh.n) && /https:\/\/ejemplo\.com\/a/.test(sh.n) && sh.q === '', 'lo compartido abre una tarea nueva con título, notas y enlace', sh);
  await p2.close();

  /* 6. Android (simulado): el widget recibe las tareas de hoy y Avisos ofrece la hora exacta */
  const ctx2 = await b.newContext({ viewport: { width: 412, height: 860 }, isMobile: true, hasTouch: true });
  await ctx2.addInitScript(() => {
    window.WHIDER_CONFIG = { firebase: null };
    localStorage.setItem('whider.meta.v1', JSON.stringify({ onboarded: true, createdAt: Date.now() - 60 * 86400000 }));
    window.__widget = [];
    window.__pedido = 0;
    window.WhiderAndroid = { fontScale: () => 1, updateWidget: (j) => window.__widget.push(j), exactAlarms: () => 'denied', requestExactAlarms: () => { window.__pedido++; } };
  });
  const p3 = await ctx2.newPage();
  p3.on('pageerror', (e) => errs.push(e.message));
  await p3.goto(APP);
  await sleep(1800);
  await p3.evaluate(() => { const S = Whider.State, td = Whider.U.today(); S.addTask({ text: 'Urgente', date: td, time: '23:50', highlight: 'danger' }); S.addTask({ text: 'Normal', date: td }); });
  await sleep(1500);
  const wd = await p3.evaluate(() => JSON.parse(window.__widget[window.__widget.length - 1] || '{}'));
  ok(wd.total === 2 && wd.tasks && wd.tasks[0].text === 'Urgente' && wd.tasks[0].prio === '!!' && wd.tasks[0].time, 'el widget recibe las tareas de hoy, lo urgente primero', wd);
  await p3.evaluate(() => Whider.Settings.open('alerts'));
  await sleep(800);
  const exacta = await p3.evaluate(() => (document.querySelector('.sheet .cell:has(.cell-title)') && [...document.querySelectorAll('.sheet .cell')].map((c) => c.textContent).find((t) => /hora exacta/.test(t))) || '');
  ok(/Sin permiso/.test(exacta), 'Avisos enseña «Avisos a la hora exacta: sin permiso»', exacta);
  await p3.click('.sheet .cell:has-text("Avisos a la hora exacta")');
  await sleep(300);
  ok(await p3.evaluate(() => window.__pedido) === 1, 'y al tocarlo abre el permiso del sistema');
  await ctx2.close();

  ok(!errs.length, 'sin errores', errs);
  await b.close();
  console.log(fails ? fails + ' FALLOS' : 'TODO OK');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
