// @ts-check
// Idiomas (js/core/i18n.js): en español todo sigue igual; en inglés, catálogo, plurales, fechas y lo que falta
const test = require('node:test');
const assert = require('node:assert/strict');
const { cargar } = require('./_cargar');

const ES = ['js/core/i18n.js', 'js/core/util.js'];
const EN = ['js/core/i18n.js', 'js/i18n/en.js', 'js/core/util.js'];
const ingles = (extra) =>
  cargar(EN.concat(extra || []), { almacen: { 'whider.lang': 'en' }, ahora: '2026-11-16T09:40:00' });

test('en español, W.t devuelve el mismo texto (con sus {variables} rellenas) y no apunta nada', () => {
  const W = cargar(ES);
  assert.equal(W.I18n.lang, 'es');
  assert.equal(W.t('Hoy'), 'Hoy');
  assert.equal(W.t('Tienes {n} tareas', { n: 3 }), 'Tienes 3 tareas');
  assert.equal(W.t('Llaves {sin} rellenar'), 'Llaves {sin} rellenar');
  assert.equal(W.tn(1, 'una tarea', '{n} tareas'), 'una tarea');
  assert.equal(W.tn(4, 'una tarea', '{n} tareas'), '4 tareas');
  assert.equal(W.U.plural(1, 'tarea', 'tareas'), '1 tarea');
  assert.equal(W.U.plural(0, 'tarea', 'tareas'), '0 tareas');
  assert.deepEqual([...W.I18n.missing()], []);
});

test('en español, las fechas no cambian', () => {
  const W = cargar(ES, { ahora: '2026-11-16T09:40:00' });
  assert.equal(W.U.fmtLong('2026-03-02'), 'Lunes, 2 de marzo');
  assert.equal(W.U.fmtShort('2026-03-02'), 'lun 2 mar');
  assert.equal(W.U.fmtMonth(2026, 2), 'Marzo 2026');
  assert.equal(W.U.fmtDay('2026-11-17'), 'Mañana');
  assert.equal(W.U.fmtRel(-3 * 86400000), 'hace 3 días');
  assert.equal(W.U.fmtRel(90 * 60000), 'en 1 h 30 min');
});

test('en inglés: catálogo, variables, plurales y lo que falta', () => {
  const W = ingles();
  assert.equal(W.I18n.lang, 'en');
  assert.equal(W.I18n.locale, 'en-US');
  W.I18n.add('en', {
    'Tienes {n} tareas': 'You have {n} tasks',
    'una tarea': 'one task',
    '{n} tareas': '{n} tasks',
    tarea: 'task',
    tareas: 'tasks'
  });
  assert.equal(W.t('Hoy'), 'Today');
  assert.equal(W.t('Tienes {n} tareas', { n: 3 }), 'You have 3 tasks');
  assert.equal(W.tn(1, 'una tarea', '{n} tareas'), 'one task');
  assert.equal(W.tn(2, 'una tarea', '{n} tareas'), '2 tasks');
  assert.equal(W.U.plural(1, 'tarea', 'tareas'), '1 task');
  assert.equal(W.U.plural(0, 'tarea', 'tareas'), '0 tasks');
  // Lo que no está en el catálogo se queda en español y se apunta
  assert.equal(W.t('Texto sin traducir'), 'Texto sin traducir');
  assert.deepEqual([...W.I18n.missing()], ['Texto sin traducir']);
});

test('en inglés, fechas y horas con su formato', () => {
  const W = ingles();
  assert.equal(W.U.fmtLong('2026-03-02'), 'Monday, March 2');
  assert.equal(W.U.fmtShort('2026-03-02'), 'Mon, Mar 2');
  assert.equal(W.U.fmtMonth(2026, 2), 'March 2026');
  assert.equal(W.U.fmtDay('2026-11-16'), 'Today');
  assert.equal(W.U.fmtDay('2026-11-17'), 'Tomorrow');
  assert.equal(W.U.fmtDay('2026-11-15'), 'Yesterday');
  assert.equal(W.U.fmtDay('2026-11-19'), 'Thursday');
  assert.equal(W.U.fmtDay(''), 'No date');
  assert.equal(W.U.fmtRel(-3 * 86400000), '3 days ago');
  assert.equal(W.U.fmtRel(-1 * 86400000), '1 day ago');
  assert.equal(W.U.fmtRel(90 * 60000), 'in 1 h 30 min');
  assert.equal(W.U.fmtRel(-10000), 'just now');
  assert.deepEqual([...W.U.WEEKDAYS_LETTER], ['S', 'M', 'T', 'W', 'T', 'F', 'S']);
  assert.equal(W.U.MONTHS[0], 'January');
});

test('el idioma se puede elegir con ?lang= y solo admite los que hay', () => {
  const W = cargar(['js/core/i18n.js'], { almacen: { 'whider.lang': 'fr' } });
  assert.equal(W.I18n.lang, 'es', 'un idioma que no existe se queda en español');
  W.I18n.set('en', false);
  assert.equal(W.__win.localStorage.getItem('whider.lang'), 'en');
});
