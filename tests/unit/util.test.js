// Fechas y formato (js/core/util.js): la base de calendario, avisos y repeticiones
const test = require('node:test');
const assert = require('node:assert/strict');
const { cargar } = require('./_cargar');

const { U } = cargar(['js/core/util.js'], { ahora: '2026-11-16T09:40:00' });

test('hoy y la hora actual salen del reloj del dispositivo', () => {
  assert.equal(U.today(), '2026-11-16');
  assert.equal(U.nowHM(), '09:40');
});

test('sumar días cruza meses, años y años bisiestos', () => {
  assert.equal(U.addDays('2026-11-30', 1), '2026-12-01');
  assert.equal(U.addDays('2026-12-31', 1), '2027-01-01');
  assert.equal(U.addDays('2028-02-28', 1), '2028-02-29');
  assert.equal(U.addDays('2026-03-01', -1), '2026-02-28');
});

test('sumar días no se descuadra con el cambio de hora', () => {
  // En Europa el horario cambia el último domingo de marzo y de octubre
  assert.equal(U.addDays('2026-03-28', 1), '2026-03-29');
  assert.equal(U.addDays('2026-03-29', 1), '2026-03-30');
  assert.equal(U.addDays('2026-10-24', 2), '2026-10-26');
  assert.equal(U.diffDays('2026-03-28', '2026-03-30'), 2);
  assert.equal(U.diffDays('2026-10-24', '2026-10-26'), 2);
});

test('sumar meses se queda en el último día si el mes es más corto', () => {
  assert.equal(U.addMonths('2026-01-31', 1), '2026-02-28');
  assert.equal(U.addMonths('2028-01-31', 1), '2028-02-29');
  assert.equal(U.addMonths('2026-12-15', 1), '2027-01-15');
});

test('día de la semana y diferencia de días', () => {
  assert.equal(U.weekday('2026-11-16'), 1); // lunes
  assert.equal(U.weekday('2026-11-22'), 0); // domingo
  assert.equal(U.diffDays('2026-11-16', '2026-11-23'), 7);
  assert.equal(U.diffDays('2026-11-23', '2026-11-16'), -7);
});

test('horas en minutos y relleno con ceros', () => {
  assert.equal(U.hmToMin('00:00'), 0);
  assert.equal(U.hmToMin('09:40'), 580);
  assert.equal(U.hmToMin('23:59'), 1439);
  assert.equal(U.pad(7), '07');
  assert.equal(U.pad(12), '12');
});

test('plural, mayúscula inicial y límites', () => {
  assert.equal(U.plural(1, 'tarea', 'tareas'), '1 tarea');
  assert.equal(U.plural(0, 'tarea', 'tareas'), '0 tareas');
  assert.equal(U.cap('hoy'), 'Hoy');
  assert.equal(U.clamp(15, 0, 10), 10);
  assert.equal(U.clamp(-3, 0, 10), 0);
});

test('los identificadores llevan prefijo y no se repiten', () => {
  const ids = new Set(Array.from({ length: 500 }, () => U.uid('t')));
  assert.equal(ids.size, 500);
  for (const id of ids) assert.match(id, /^t_[a-z0-9]+$/);
});

test('el plazo de una tarea sin hora es el final del día', () => {
  const sinHora = U.deadlineTs('2026-11-16');
  const conHora = U.deadlineTs('2026-11-16', '10:00');
  assert.ok(sinHora > conHora);
  assert.equal(new Date(conHora).getHours(), 10);
});
