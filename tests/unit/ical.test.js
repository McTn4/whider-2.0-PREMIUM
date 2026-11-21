// Calendarios suscritos (js/core/ical.js): eventos, zonas horarias, todo el día y repeticiones con sus excepciones.
// La zona de las pruebas es Europe/Madrid (tests/unit/_cargar.js), con el cambio de hora del 25 de octubre de 2026.
const test = require('node:test');
const assert = require('node:assert/strict');
const { cargar } = require('./_cargar');

const W = cargar(['js/core/ical.js'], { ahora: '2026-11-18T09:00:00' });
const I = W.ICal;
// Lo que sale del contexto aislado se copia para compararlo con deepEqual (otro Array.prototype)
const plano = (x) => JSON.parse(JSON.stringify(x));
const cal = (...ev) =>
  ['BEGIN:VCALENDAR', 'VERSION:2.0', 'X-WR-CALNAME:Trabajo', ...ev.flat(), 'END:VCALENDAR'].join('\r\n');
const ev = (...lines) => ['BEGIN:VEVENT', ...lines, 'END:VEVENT'];
const dias = (r, from, to) =>
  plano(I.between(r.events, from, to)).map((x) => x.date + (x.time ? ' ' + x.time : '') + ' ' + x.title);

test('no es un calendario: se dice, sin inventar nada', () => {
  assert.equal(I.read('hola').error, 'format');
  assert.equal(I.read('').error, 'format');
  assert.equal(I.read('\uFEFFBEGIN:VCALENDAR\r\nEND:VCALENDAR').error, undefined, 'con BOM sí vale');
});

test('un evento con zona, en UTC, en otra zona y con zona de Windows', () => {
  const r = I.read(
    cal(
      ev(
        'UID:a',
        'SUMMARY:Reunión',
        'DTSTART;TZID=Europe/Madrid:20261120T093000',
        'DTEND;TZID=Europe/Madrid:20261120T103000'
      ),
      ev('UID:b', 'SUMMARY:Llamada', 'DTSTART:20261120T150000Z', 'DURATION:PT45M'),
      ev(
        'UID:c',
        'SUMMARY:Nueva York',
        'DTSTART;TZID=America/New_York:20261120T090000',
        'DTEND;TZID=America/New_York:20261120T100000'
      ),
      ev(
        'UID:d',
        'SUMMARY:Outlook',
        'DTSTART;TZID="Romance Standard Time":20261120T120000',
        'DTEND;TZID="Romance Standard Time":20261120T123000'
      )
    )
  );
  assert.equal(r.name, 'Trabajo');
  const x = plano(I.between(r.events, '2026-11-20', '2026-11-20'));
  assert.deepEqual(
    x.map((e) => e.time + ' ' + e.title + ' ' + e.durMin),
    ['09:30 Reunión 60', '12:00 Outlook 30', '15:00 Nueva York 60', '16:00 Llamada 45']
  );
});

test('todo el día: un día y varios (el final no se incluye)', () => {
  const r = I.read(
    cal(
      ev('UID:f', 'SUMMARY:Festivo', 'DTSTART;VALUE=DATE:20261208', 'DTEND;VALUE=DATE:20261209'),
      ev('UID:v', 'SUMMARY:Vacaciones', 'DTSTART;VALUE=DATE:20261228', 'DTEND;VALUE=DATE:20270102')
    )
  );
  const x = plano(I.between(r.events, '2026-12-01', '2026-12-31'));
  assert.deepEqual(
    x.map((e) => e.date + ' ' + e.title + ' ' + e.part + '/' + e.days),
    [
      '2026-12-08 Festivo 1/1',
      '2026-12-28 Vacaciones 1/5',
      '2026-12-29 Vacaciones 2/5',
      '2026-12-30 Vacaciones 3/5',
      '2026-12-31 Vacaciones 4/5'
    ]
  );
  assert.equal(x[0].time, null);
  assert.equal(x[0].allDay, true);
  assert.deepEqual(
    dias(r, '2027-01-01', '2027-01-03'),
    ['2027-01-01 Vacaciones'],
    'el último día, desde el mes siguiente'
  );
});

test('semanal: la hora de reloj se mantiene con el cambio de hora (y la de otra zona se mueve)', () => {
  const r = I.read(
    cal(
      ev(
        'UID:s',
        'SUMMARY:Equipo',
        'DTSTART;TZID=Europe/Madrid:20261019T090000',
        'DTEND;TZID=Europe/Madrid:20261019T093000',
        'RRULE:FREQ=WEEKLY;BYDAY=MO'
      ),
      ev('UID:n', 'SUMMARY:NY', 'DTSTART;TZID=America/New_York:20261019T090000', 'DURATION:PT30M', 'RRULE:FREQ=WEEKLY')
    )
  );
  // 19 oct: verano en las dos; 26 oct: Madrid ya en invierno, Nueva York no; 2 nov: las dos en invierno
  assert.deepEqual(dias(r, '2026-10-19', '2026-11-02'), [
    '2026-10-19 09:00 Equipo',
    '2026-10-19 15:00 NY',
    '2026-10-26 09:00 Equipo',
    '2026-10-26 14:00 NY',
    '2026-11-02 09:00 Equipo',
    '2026-11-02 15:00 NY'
  ]);
  assert.equal(I.between(r.events, '2026-10-26', '2026-10-26')[0].repeats, true);
});

test('semanal cada dos semanas, varios días, hasta una fecha y con un número de veces', () => {
  const r = I.read(
    cal(
      ev(
        'UID:q',
        'SUMMARY:Quincenal',
        'DTSTART;TZID=Europe/Madrid:20261102T100000',
        'RRULE:FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,WE;UNTIL=20261202T235959Z'
      ),
      ev('UID:c', 'SUMMARY:Tres veces', 'DTSTART;VALUE=DATE:20261103', 'RRULE:FREQ=DAILY;COUNT=3')
    )
  );
  assert.deepEqual(
    dias(r, '2026-11-01', '2026-12-31').filter((s) => /Quincenal/.test(s)),
    [
      '2026-11-02 10:00 Quincenal',
      '2026-11-04 10:00 Quincenal',
      '2026-11-16 10:00 Quincenal',
      '2026-11-18 10:00 Quincenal',
      '2026-11-30 10:00 Quincenal',
      '2026-12-02 10:00 Quincenal'
    ]
  );
  assert.deepEqual(
    dias(r, '2026-11-01', '2026-11-30').filter((s) => /Tres/.test(s)),
    ['2026-11-03 Tres veces', '2026-11-04 Tres veces', '2026-11-05 Tres veces']
  );
});

test('fechas quitadas (EXDATE), una repetición movida y otra anulada (RECURRENCE-ID)', () => {
  const r = I.read(
    cal(
      ev(
        'UID:r1',
        'SUMMARY:Diaria',
        'DTSTART;TZID=Europe/Madrid:20261116T083000',
        'DURATION:PT15M',
        'RRULE:FREQ=DAILY',
        'EXDATE;TZID=Europe/Madrid:20261117T083000,20261118T083000'
      ),
      ev(
        'UID:r1',
        'SUMMARY:Diaria (movida)',
        'RECURRENCE-ID;TZID=Europe/Madrid:20261119T083000',
        'DTSTART;TZID=Europe/Madrid:20261119T120000',
        'DURATION:PT15M'
      ),
      ev(
        'UID:r1',
        'SUMMARY:Diaria',
        'RECURRENCE-ID;TZID=Europe/Madrid:20261120T083000',
        'DTSTART;TZID=Europe/Madrid:20261120T083000',
        'STATUS:CANCELLED'
      )
    )
  );
  assert.deepEqual(dias(r, '2026-11-16', '2026-11-21'), [
    '2026-11-16 08:30 Diaria',
    '2026-11-19 12:00 Diaria (movida)',
    '2026-11-21 08:30 Diaria'
  ]);
});

test('mensual y anual: último viernes, último día, último día laborable (el lunes 30) y el cuarto jueves de noviembre', () => {
  const r = I.read(
    cal(
      ev('UID:m1', 'SUMMARY:Último viernes', 'DTSTART;VALUE=DATE:20260130', 'RRULE:FREQ=MONTHLY;BYDAY=-1FR'),
      ev('UID:m2', 'SUMMARY:Fin de mes', 'DTSTART;VALUE=DATE:20260131', 'RRULE:FREQ=MONTHLY;BYMONTHDAY=-1'),
      ev(
        'UID:m3',
        'SUMMARY:Nóminas',
        'DTSTART;VALUE=DATE:20260130',
        'RRULE:FREQ=MONTHLY;BYDAY=MO,TU,WE,TH,FR;BYSETPOS=-1'
      ),
      ev('UID:m4', 'SUMMARY:Día 31', 'DTSTART;VALUE=DATE:20260131', 'RRULE:FREQ=MONTHLY'),
      ev(
        'UID:y1',
        'SUMMARY:Acción de Gracias',
        'DTSTART;VALUE=DATE:20221124',
        'RRULE:FREQ=YEARLY;BYMONTH=11;BYDAY=4TH'
      ),
      ev('UID:y2', 'SUMMARY:Cumpleaños', 'DTSTART;VALUE=DATE:19900215', 'RRULE:FREQ=YEARLY')
    )
  );
  assert.deepEqual(dias(r, '2026-11-01', '2026-11-30'), [
    '2026-11-26 Acción de Gracias',
    '2026-11-27 Último viernes',
    '2026-11-30 Fin de mes',
    '2026-11-30 Nóminas'
  ]);
  assert.deepEqual(
    dias(r, '2027-01-01', '2027-02-28').filter((s) => /Día 31|Cumple/.test(s)),
    ['2027-01-31 Día 31', '2027-02-15 Cumpleaños'],
    'febrero no tiene 31'
  );
});

test('una repetición diaria que empezó hace años no recorre años para llegar a hoy', () => {
  const r = I.read(
    cal(ev('UID:old', 'SUMMARY:Vieja', 'DTSTART;TZID=Europe/Madrid:20100101T070000', 'RRULE:FREQ=DAILY;INTERVAL=3'))
  );
  const x = I.between(r.events, '2026-11-01', '2026-11-30');
  assert.ok(x.length >= 9 && x.length <= 10, String(x.length));
  const d0 = Date.UTC(2010, 0, 1);
  x.forEach((e) => {
    const p = e.date.split('-');
    assert.equal(Math.round((Date.UTC(+p[0], +p[1] - 1, +p[2]) - d0) / 86400000) % 3, 0, e.date);
  });
});

test('líneas partidas, escapes, HTML en las notas, comillas con dos puntos, hora flotante y alarmas', () => {
  const r = I.read(
    [
      'BEGIN:VCALENDAR',
      'X-WR-TIMEZONE:America/Mexico_City',
      'BEGIN:VEVENT',
      'UID:t',
      'SUMMARY:Cena\\, con\\; amigos',
      'LOCATION;ALTREP="http://x.example/a:b":Calle Mayor\\, 1',
      'DESCRIPTION:Primera línea\\nSegunda <b>negrita</b><br>tercera &amp; m',
      ' ás',
      'DTSTART:20261121T200000',
      'BEGIN:VALARM',
      'DESCRIPTION:Alarma',
      'TRIGGER:-PT15M',
      'END:VALARM',
      'END:VEVENT',
      'END:VCALENDAR'
    ].join('\n')
  );
  const e = I.between(r.events, '2026-11-22', '2026-11-22')[0];
  assert.equal(e.title, 'Cena, con; amigos');
  assert.equal(e.location, 'Calle Mayor, 1');
  assert.equal(e.notes, 'Primera línea\nSegunda negrita\ntercera & más', 'sin etiquetas y con la línea partida unida');
  assert.equal(e.time, '03:00', 'las 20:00 de Ciudad de México son las 3:00 en Madrid');
});

test('cancelados fuera y sin título no rompe nada', () => {
  const r = I.read(
    cal(
      ev('UID:x', 'SUMMARY:Cancelado', 'STATUS:CANCELLED', 'DTSTART;VALUE=DATE:20261125'),
      ev('UID:y', 'DTSTART;VALUE=DATE:20261125'),
      ev('UID:z', 'SUMMARY:Sin fecha')
    )
  );
  assert.deepEqual(dias(r, '2026-11-25', '2026-11-25'), ['2026-11-25 ']);
});
