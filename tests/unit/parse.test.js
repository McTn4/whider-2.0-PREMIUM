// Lectura de lenguaje natural al crear tareas (js/core/parse.js), con el reloj fijo en el lunes 16-11-2026
const test = require('node:test');
const assert = require('node:assert/strict');
const { cargar } = require('./_cargar');

const W = cargar(['js/core/i18n.js', 'js/core/util.js', 'js/core/parse.js'], { ahora: '2026-11-16T09:40:00' });
const listas = [
  { id: 'l1', name: 'Trabajo' },
  { id: 'l2', name: 'Casa' }
];
const leer = (t, o) => W.Parse.task(t, Object.assign({ lists: listas }, o));

test('día, hora, lista y prioridad en una sola frase', () => {
  const r = leer('Llamar a Ana mañana a las 10 #trabajo !!');
  assert.equal(r.text, 'Llamar a Ana');
  assert.equal(r.date, '2026-11-17');
  assert.equal(r.time, '10:00');
  assert.equal(r.listId, 'l1');
  assert.equal(r.highlight, 'purple');
});

test('días de la semana y horas de la tarde', () => {
  const r = leer('Revisar informe el viernes a las 5 de la tarde');
  assert.equal(r.text, 'Revisar informe');
  assert.equal(r.date, '2026-11-20');
  assert.equal(r.time, '17:00');
});

test('fechas escritas de varias formas', () => {
  assert.equal(leer('Leer en 3 días').date, '2026-11-19');
  assert.equal(leer('cita el 20 de diciembre a mediodía').date, '2026-12-20');
  assert.equal(leer('cita el 20 de diciembre a mediodía').time, '12:00');
  assert.equal(leer('Pagar el 1').date, '2026-12-01');
  // Un día del año que ya pasó se entiende como el del año que viene
  assert.equal(leer('Comprar pan 15/11').date, '2027-11-15');
});

test('repeticiones y urgencia', () => {
  const r = leer('Gimnasio cada lunes !!!');
  assert.equal(r.text, 'Gimnasio');
  assert.equal(r.repeat, 'weekly');
  assert.equal(r.highlight, 'danger');
  assert.equal(r.date, '2026-11-16');
  assert.equal(leer('Pagar alquiler cada mes el 1').repeat, 'monthly');
});

test('lo que el usuario descarta se queda en el título', () => {
  const r = leer('Reunión mañana', { ignore: { 'date:manana': true } });
  assert.equal(r.text, 'Reunión mañana');
  assert.equal(r.date, undefined);
});

test('un texto sin detalles no cambia', () => {
  const r = leer('Comprar fruta');
  assert.equal(r.text, 'Comprar fruta');
  assert.equal(r.date, undefined);
  assert.equal(r.time, undefined);
  assert.equal(r.found.length, 0);
});
