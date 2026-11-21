// @ts-check
// «Nueva tarea» en inglés (js/core/parse.js, gramática inglesa): fechas, horas, repeticiones, prioridad y categoría
const test = require('node:test');
const assert = require('node:assert/strict');
const { cargar } = require('./_cargar');

// Lunes 16 de noviembre de 2026, 9:40
const W = cargar(['js/core/i18n.js', 'js/i18n/en.js', 'js/core/util.js', 'js/core/parse.js'], {
  almacen: { 'whider.lang': 'en' },
  ahora: '2026-11-16T09:40:00'
});
const lists = [
  { id: 'work', name: 'Work' },
  { id: 'home', name: 'Home' }
];
const p = (s) => {
  const r = W.Parse.task(s, { lists });
  return { t: r.text, d: r.date, h: r.time, l: r.listId, p: r.highlight, r: r.repeat };
};

test('título, mañana a las 10, categoría y prioridad', () => {
  assert.deepEqual(p('Call Anna tomorrow at 10 #work !!'), {
    t: 'Call Anna',
    d: '2026-11-17',
    h: '10:00',
    l: 'work',
    p: 'purple',
    r: undefined
  });
  assert.equal(p('Today buy milk !!!').p, 'danger');
});

test('días de la semana, «next», «this weekend», «in 3 days» y «next week»', () => {
  assert.equal(p('Dentist on Friday at 4pm').d, '2026-11-20');
  assert.equal(p('Dentist on Friday at 4pm').h, '16:00');
  assert.equal(p('Water plants on sat').d, '2026-11-21');
  assert.equal(p('Report in 3 days').d, '2026-11-19');
  assert.equal(p('Trip next week').d, '2026-11-23');
  assert.equal(p('Plan the weekend').d, '2026-11-21');
  assert.equal(p('Call Bob day after tomorrow').d, '2026-11-18');
  assert.equal(p('Car service in a month').d, '2026-12-16');
});

test('fechas: «Nov 20», «20 November», «12/1» (mes/día) y «the 25th»', () => {
  assert.equal(p('Party Nov 20').d, '2026-11-20');
  assert.equal(p('Party 20 November').d, '2026-11-20');
  assert.equal(p('Bills 12/1').d, '2026-12-01');
  assert.equal(p('Meeting on the 25th').d, '2026-11-25');
  assert.equal(p('Renew on March 3rd, 2027').d, '2027-03-03');
});

test('horas: am/pm, mediodía, «tonight», «this afternoon» y una hora ya pasada va a mañana', () => {
  assert.deepEqual([p('Lunch at noon').h, p('Lunch at noon').d], ['12:00', '2026-11-16']);
  assert.deepEqual([p('Flight 7:45am').h, p('Flight 7:45am').d], ['07:45', '2026-11-17']);
  assert.equal(p('Review 5 pm').h, '17:00');
  assert.deepEqual([p('Read tonight').h, p('Read tonight').d], ['21:00', '2026-11-16']);
  assert.equal(p('Call mom this afternoon').h, '17:00');
  assert.equal(p('Wake up at 7 in the morning').h, '07:00');
});

test('repeticiones', () => {
  assert.equal(p('Yoga daily').r, 'daily');
  assert.equal(p('Standup every weekday at 9:15').r, 'weekdays');
  assert.equal(p('Pay rent every month').r, 'monthly');
  const g = p('Gym every Monday');
  assert.deepEqual([g.r, g.d, g.t], ['weekly', '2026-11-16', 'Gym']);
});

test('lo que no es una fecha se queda en el título', () => {
  assert.deepEqual(p('Buy sun cream'), {
    t: 'Buy sun cream',
    d: undefined,
    h: undefined,
    l: undefined,
    p: undefined,
    r: undefined
  });
  assert.equal(p('I may call later').t, 'I may call later');
});

test('en español sigue entendiendo español', () => {
  const E = cargar(['js/core/i18n.js', 'js/core/util.js', 'js/core/parse.js'], { ahora: '2026-11-16T09:40:00' });
  const r = E.Parse.task('Llamar a Ana mañana a las 10 #trabajo !!', { lists: [{ id: 'work', name: 'Trabajo' }] });
  assert.deepEqual(
    [r.text, r.date, r.time, r.listId, r.highlight],
    ['Llamar a Ana', '2026-11-17', '10:00', 'work', 'purple']
  );
});

test('«every Monday and Wednesday»: cada semana esos días', () => {
  const r = W.Parse.task('Gym every Mon, Wed and Fri at 7am', { lists });
  assert.equal(r.text, 'Gym');
  assert.equal(r.repeat, 'weekly');
  assert.deepEqual(JSON.parse(JSON.stringify(r.days)), [1, 3, 5]);
  assert.equal(r.date, '2026-11-16', 'hoy es lunes: empieza hoy');
  assert.equal(r.time, '07:00');
  const s = W.Parse.task('English every Tuesday and Thursday', { lists });
  assert.deepEqual(JSON.parse(JSON.stringify(s.days)), [2, 4]);
  assert.equal(s.date, '2026-11-17');
});
