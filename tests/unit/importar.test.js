// Importar desde otras apps (js/core/importer.js): Todoist, Google Tasks, Notion, calendarios .ics y CSV
const test = require('node:test');
const assert = require('node:assert/strict');
const { cargar } = require('./_cargar');

const W = cargar(['js/core/i18n.js', 'js/core/util.js', 'js/core/importer.js'], { ahora: '2026-11-18T09:00:00' });
const I = W.Importer;
const plano = (x) => JSON.parse(JSON.stringify(x));

test('fechas y horas en los formatos de cada app', () => {
  const w = (s) => plano(I.when(s));
  assert.deepEqual(w('2026-11-20'), { date: '2026-11-20', time: null });
  assert.deepEqual(w('2026-11-20 10:30'), { date: '2026-11-20', time: '10:30' });
  assert.deepEqual(w('20/11/2026'), { date: '2026-11-20', time: null });
  assert.deepEqual(w('November 20, 2026 3:15 PM'), { date: '2026-11-20', time: '15:15' });
  assert.deepEqual(w('20 de noviembre de 2026 9:05'), { date: '2026-11-20', time: '09:05' });
  assert.deepEqual(w('November 25, 2026 → November 27, 2026'), { date: '2026-11-25', time: null });
  assert.equal(w('2026-11-20T09:00:00Z').date, '2026-11-20');
  assert.equal(w('2026-11-20T09:00:00Z').time, '10:00', 'UTC → hora de Madrid');
  assert.equal(w('31/02/2026').date, null, 'una fecha imposible no se inventa');
  assert.equal(w('cuando pueda').date, null);
});

test('Todoist: tareas, subtareas, comentarios, prioridad (1 = P1), secciones y repeticiones', () => {
  const csv = [
    'TYPE,CONTENT,DESCRIPTION,PRIORITY,INDENT,AUTHOR,RESPONSIBLE,DATE,DATE_LANG,TIMEZONE,DURATION,DURATION_UNIT',
    'section,Esta semana,,,,,,,,,,',
    'task,Preparar la presentación,Con gráficos,1,1,Ana (1),,2026-11-20 10:00,es,Europe/Madrid,,',
    'task,Diapositivas,,4,2,Ana (1),,,es,Europe/Madrid,,',
    'note,Revisar con Luis,,,,Ana (1),,,,,,',
    'task,Regar las plantas,,4,1,Ana (1),,every day,en,Europe/Madrid,,',
    'task,Algo raro,,2,1,Ana (1),,el día que llueva,es,Europe/Madrid,,'
  ].join('\n');
  const r = plano(I.todoist(csv, 'Trabajo.csv'));
  assert.equal(r.items.length, 3);
  const [a, b, c] = r.items;
  assert.equal(a.text, 'Preparar la presentación');
  assert.equal(a.date, '2026-11-20');
  assert.equal(a.time, '10:00');
  assert.equal(a.highlight, 'danger');
  assert.equal(a.notes, 'Con gráficos\n\nRevisar con Luis');
  assert.deepEqual(a.subtasks, [{ text: 'Diapositivas', done: false }]);
  assert.equal(a.listName, 'Trabajo · Esta semana');
  assert.equal(b.repeat, 'daily');
  assert.equal(b.date, '2026-11-18', 'una repetición sin día empieza hoy');
  assert.equal(c.highlight, 'purple');
  assert.equal(c.date, null);
  assert.ok(
    r.warnings.some((x) => /Algo raro/.test(x)),
    'avisa de la fecha que no entendió'
  );
});

test('Todoist: un CSV que no es de Todoist se rechaza con un motivo', () => {
  const r = I.todoist('Nombre,Fecha\nPan,2026-11-20', 'x.csv');
  assert.equal(r.error, true);
  assert.match(r.warnings[0], /TYPE y CONTENT/);
});

test('Google Tasks: listas, subtareas, completadas y fecha sin desplazar el día', () => {
  const json = JSON.stringify({
    kind: 'tasks#taskLists',
    items: [
      {
        kind: 'tasks#taskList',
        id: 'L1',
        title: 'Mis tareas',
        items: [
          { kind: 'tasks#task', id: 'a', title: 'Comprar pan', status: 'needsAction', due: '2026-11-21T00:00:00.000Z' },
          {
            kind: 'tasks#task',
            id: 'b',
            title: 'Llamar al banco',
            status: 'completed',
            completed: '2026-11-10T09:00:00.000Z',
            notes: 'Por la hipoteca'
          },
          { kind: 'tasks#task', id: 'c', title: 'Integral', status: 'needsAction', parent: 'a' },
          { kind: 'tasks#task', id: 'd', title: 'Borrada', deleted: true }
        ]
      }
    ]
  });
  const r = plano(I.gtasks(json));
  assert.equal(r.items.length, 2);
  const pan = r.items.find((x) => x.text === 'Comprar pan');
  assert.equal(pan.date, '2026-11-21');
  assert.deepEqual(pan.subtasks, [{ text: 'Integral', done: false }]);
  assert.equal(pan.listName, 'Mis tareas');
  const banco = r.items.find((x) => x.text === 'Llamar al banco');
  assert.equal(banco.done, true);
  assert.equal(banco.doneOn, '2026-11-10');
  assert.equal(banco.notes, 'Por la hipoteca');
  assert.equal(I.gtasks('{"a":1}').error, true);
});

test('Notion y hojas de cálculo: columnas adivinadas, estado, etiquetas y prioridad', () => {
  const csv = [
    'Name,Status,Fecha,Tags,Priority',
    'Lanzar la web,Done,"November 20, 2026 10:00 AM",Trabajo,High',
    'Escribir el blog,In progress,20 de noviembre de 2026,"Marketing, Blog",Low',
    'Revisión,Not started,"November 25, 2026 → November 27, 2026",Trabajo,'
  ].join('\n');
  const rows = I.csv(csv);
  const map = plano(I.guess(rows[0]));
  assert.deepEqual(map, { text: 0, date: 2, time: -1, list: 3, priority: 4, notes: -1, done: 1 });
  const r = plano(I.fromRows(rows.slice(1), map));
  assert.equal(r.items.length, 3);
  assert.equal(r.items[0].done, true);
  assert.equal(r.items[0].date, '2026-11-20');
  assert.equal(r.items[0].time, '10:00');
  assert.equal(r.items[0].highlight, 'purple');
  assert.equal(r.items[0].listName, 'Trabajo');
  assert.equal(r.items[1].done, false);
  assert.equal(r.items[1].listName, 'Marketing', 'de varias etiquetas, la primera');
  assert.equal(r.items[1].highlight, 'none');
  assert.equal(r.items[2].date, '2026-11-25');
});

test('calendarios .ics: eventos y tareas, zonas horarias, duración, repetición y prioridad', () => {
  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'X-WR-CALNAME:Trabajo',
    'BEGIN:VEVENT',
    'UID:1',
    'SUMMARY:Reunión de equipo',
    'DTSTART;TZID=Europe/Madrid:20301120T100000',
    'DTEND;TZID=Europe/Madrid:20301120T110000',
    'RRULE:FREQ=WEEKLY;BYDAY=MO',
    'END:VEVENT',
    'BEGIN:VEVENT',
    'SUMMARY:Evento pasado',
    'DTSTART:20200101T090000Z',
    'END:VEVENT',
    'BEGIN:VTODO',
    'SUMMARY:Enviar factura\\, urgente',
    'DUE;VALUE=DATE:20301201',
    'PRIORITY:1',
    'DESCRIPTION:Línea 1\\nLínea 2',
    'END:VTODO',
    'BEGIN:VEVENT',
    'SUMMARY:Vuelo a Lisboa',
    'DTSTART:20301205T073000Z',
    'DTEND:20301205T100000Z',
    'END:VEVENT',
    'BEGIN:VEVENT',
    'SUMMARY:Llamada con Nueva Yo',
    ' rk',
    'DTSTART;TZID=America/New_York:20301120T100000',
    'END:VEVENT',
    'BEGIN:VEVENT',
    'SUMMARY:Cancelado',
    'STATUS:CANCELLED',
    'DTSTART:20301201T090000Z',
    'END:VEVENT',
    'END:VCALENDAR'
  ].join('\r\n');
  const r = plano(I.ics(ics));
  const by = (t) => r.items.find((x) => x.text === t);
  assert.equal(r.items.length, 4, r.items.map((x) => x.text).join(' | '));
  const reu = by('Reunión de equipo');
  assert.deepEqual(
    [reu.date, reu.time, reu.duration, reu.repeat, reu.listName],
    ['2030-11-20', '10:00', 60, 'weekly', 'Trabajo']
  );
  const fac = by('Enviar factura, urgente');
  assert.deepEqual([fac.date, fac.time, fac.highlight, fac.notes], ['2030-12-01', null, 'danger', 'Línea 1\nLínea 2']);
  const vuelo = by('Vuelo a Lisboa');
  assert.deepEqual([vuelo.time, vuelo.duration], ['08:30', 150], 'UTC → hora de Madrid en invierno');
  const ny = by('Llamada con Nueva York');
  assert.ok(ny, 'las líneas partidas se vuelven a unir');
  assert.equal(ny.time, '16:00', '10:00 en Nueva York son las 16:00 en Madrid');
  assert.equal(r.skippedPast, 1);
  assert.ok(r.warnings.some((x) => /pasado/.test(x)));
  assert.equal(plano(I.ics(ics, { past: true })).items.length, 5, 'con «incluir lo pasado» también entra');
});

test('reconoce de qué app es cada archivo', () => {
  assert.equal(I.detect('mi.ics', 'BEGIN:VCALENDAR\r\nVERSION:2.0'), 'ics');
  assert.equal(I.detect('Tasks.json', '{"kind":"tasks#taskLists","items":[]}'), 'gtasks');
  assert.equal(I.detect('Trabajo.csv', 'TYPE,CONTENT,DESCRIPTION,PRIORITY'), 'todoist');
  assert.equal(I.detect('Tareas 1b2c3d4e5f60718293a4b5c6d7e8f901.csv', 'Name,Status'), 'notion');
  assert.equal(I.detect('hoja.csv', 'Tarea;Fecha'), 'csv');
  assert.equal(I.detect('foto.png', '\u0089PNG'), null);
});

test('las que ya tienes (mismo texto y fecha) se marcan como repetidas', () => {
  const items = [
    { text: 'Comprar pan', date: '2026-11-21' },
    { text: 'comprar  PAN', date: '2026-11-21' },
    { text: 'Comprar pan', date: '2026-11-22' }
  ];
  const n = I.markDuplicates(items, [{ text: 'Comprar Pan', date: '2026-11-21' }]);
  assert.equal(n, 2);
  assert.deepEqual(
    items.map((x) => x.dup),
    [true, true, false]
  );
});

test('prioridades escritas de varias formas', () => {
  assert.equal(I.prioOf('Urgente'), 'danger');
  assert.equal(I.prioOf('High'), 'purple');
  assert.equal(I.prioOf('Media'), 'star');
  assert.equal(I.prioOf('Low'), 'none');
  assert.equal(I.repeatOf('cada lunes'), 'weekly');
  assert.equal(I.repeatOf('every weekday'), 'weekdays');
  assert.equal(I.repeatOf('el lunes'), 'none');
});
