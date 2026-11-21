// Tareas de cada día (antes, hábitos): repetir en varios días de la semana, pasar solas al día siguiente que les
// toca si se quedan sin hacer, convertir los hábitos de versiones anteriores sin perder nada y leerlas al escribir
const test = require('node:test');
const assert = require('node:assert/strict');
const { cargar } = require('./_cargar');

const archivos = ['js/core/i18n.js', 'js/core/util.js', 'js/core/schema.js', 'js/core/store.js'];
// Sábado 21 de noviembre de 2026, por la mañana
const nuevo = (extra) => cargar(archivos.concat(extra || []), { ahora: '2026-11-21T09:40:00' });
/** Copia plana (los objetos del contexto aislado no son del mismo «mundo» que assert) */
const plano = (x) => JSON.parse(JSON.stringify(x));

test('«cada semana» con varios días guarda los días (y solo con «cada semana»)', () => {
  const { Schema } = nuevo();
  const t = Schema.cleanTask({ text: 'Gimnasio', date: '2026-11-23', repeat: 'weekly', days: [5, 1, 3, 3, 9] }, null);
  assert.deepEqual(plano(t.days), [1, 3, 5]);
  const d = Schema.cleanTask({ text: 'Agua', date: '2026-11-23', repeat: 'daily', days: [1, 2] }, null);
  assert.equal('days' in d, false);
  const s = Schema.cleanTask({ text: 'Lunes', date: '2026-11-23', repeat: 'weekly' }, null);
  assert.equal('days' in s, false, 'sin días, como siempre: una vez por semana');
});

test('la siguiente repetición cae en el siguiente día elegido', () => {
  const { State: S } = nuevo();
  const t = S.addTask({ text: 'Gimnasio', date: '2026-11-23', repeat: 'weekly', days: [1, 3, 5] }); // lunes
  S.setDone(t.id, true);
  const sig = S.find(t.spawnedId);
  assert.equal(sig.date, '2026-11-25'); // miércoles
  assert.deepEqual(plano(sig.days), [1, 3, 5]);
  S.setDone(sig.id, true);
  assert.equal(S.find(sig.spawnedId).date, '2026-11-27'); // viernes
  const v = S.find(sig.spawnedId);
  S.setDone(v.id, true);
  assert.equal(S.find(v.spawnedId).date, '2026-11-30'); // y el lunes siguiente
});

test('el calendario prevé las repeticiones de los días elegidos', () => {
  const { State: S } = nuevo();
  const t = S.addTask({ text: 'Inglés', date: '2026-11-24', repeat: 'weekly', days: [2, 4] });
  assert.deepEqual(plano(S.occurrences(t, '2026-11-21', '2026-12-04')), ['2026-11-26', '2026-12-01', '2026-12-03']);
});

test('qué es «de cada día»: cada día, días laborables o varios días por semana', () => {
  const { Schema } = nuevo();
  assert.equal(Schema.isRoutine({ repeat: 'daily' }), true);
  assert.equal(Schema.isRoutine({ repeat: 'weekdays' }), true);
  assert.equal(Schema.isRoutine({ repeat: 'weekly', days: [1, 4] }), true);
  assert.equal(Schema.isRoutine({ repeat: 'weekly', days: [1] }), false);
  assert.equal(Schema.isRoutine({ repeat: 'weekly' }), false);
  assert.equal(Schema.isRoutine({ repeat: 'monthly' }), false);
  assert.equal(Schema.isRoutine({ repeat: 'none' }), false);
});

test('las de cada día que se quedaron sin hacer pasan solas al primer día que les toca', () => {
  const { State: S } = nuevo();
  const diaria = S.addTask({ text: 'Meditar', date: '2026-11-19', repeat: 'daily', time: '08:00' });
  const laborable = S.addTask({ text: 'Correo', date: '2026-11-20', repeat: 'weekdays' });
  const semanal = S.addTask({ text: 'Reunión', date: '2026-11-16', repeat: 'weekly' });
  const normal = S.addTask({ text: 'Llamar', date: '2026-11-18' });
  const movidas = S.rollRoutines();
  assert.equal(movidas, 2);
  assert.equal(diaria.date, '2026-11-21', 'la diaria, a hoy (sábado)');
  assert.equal(diaria.time, '08:00', 'con su hora');
  assert.equal(laborable.date, '2026-11-23', 'la de días laborables, al lunes');
  assert.equal(semanal.date, '2026-11-16', 'una vez por semana sigue siendo un plazo: se queda vencida');
  assert.equal(normal.date, '2026-11-18');
  assert.ok(diaria.ft && diaria.ft.date, 'el cambio de fecha se sincroniza con su hora');
  assert.equal(S.rollRoutines(), 0, 'una segunda vez no cambia nada');
});

test('los hábitos activos pasan a ser tareas de cada día; los archivados no', () => {
  const W = nuevo();
  const S = W.State;
  const viejo = Date.UTC(2026, 9, 1);
  S.habits = W.Schema.cleanHabits([
    {
      id: 'h1',
      name: 'Beber agua',
      freq: 'daily',
      target: 8,
      unit: 'vasos',
      reminder: '09:00',
      createdAt: viejo,
      updatedAt: viejo
    },
    { id: 'h2', name: 'Gimnasio', freq: 'days', days: [1, 3, 5], createdAt: viejo, updatedAt: viejo },
    { id: 'h3', name: 'Leer', freq: 'weekly', perWeek: 3, createdAt: viejo, updatedAt: viejo },
    { id: 'h4', name: 'Entre semana', freq: 'days', days: [1, 2, 3, 4, 5], createdAt: viejo, updatedAt: viejo },
    { id: 'h5', name: 'Antiguo', freq: 'daily', archived: true, createdAt: viejo, updatedAt: viejo }
  ]);
  S.habitLog = { h1: { '2026-11-21': { n: 8, at: viejo } } }; // hoy ya cumplido
  assert.equal(S.habitsToTasks(), 4);
  const por = {};
  S.tasks.forEach((t) => (por[t.text] = t));
  const agua = por['Beber agua · 8 vasos'];
  assert.ok(agua, 'el objetivo diario va en el texto');
  assert.equal(agua.repeat, 'daily');
  assert.equal(agua.time, '09:00');
  assert.equal(agua.warn, true, 'el recordatorio pasa a ser el aviso de la tarea');
  assert.equal(agua.date, '2026-11-22', 'hoy ya estaba hecho: empieza mañana');
  assert.equal(por.Gimnasio.repeat, 'weekly');
  assert.deepEqual(plano(por.Gimnasio.days), [1, 3, 5]);
  assert.equal(por.Gimnasio.date, '2026-11-23');
  assert.equal(por.Gimnasio.warn, false);
  assert.deepEqual(plano(por.Leer.days), [1, 3, 5], '«3 veces por semana» se reparte en días fijos');
  assert.ok(/3/.test(por.Leer.notes));
  assert.equal(por['Entre semana'].repeat, 'weekdays');
  assert.equal(por.Antiguo, undefined);
  assert.ok(
    S.habits.every((h) => h.archived),
    'los hábitos quedan archivados, con su historial'
  );
  assert.equal(S.habitLog.h1['2026-11-21'].n, 8);
  assert.equal(S.meta.habitsMoved, 4, 'Hoy lo cuenta una vez');
  assert.equal(S.habitsToTasks(), 0, 'no se convierten dos veces');
});

test('dos dispositivos que convierten el mismo hábito crean la misma tarea', () => {
  const a = nuevo().Schema.taskFromHabit(
    { id: 'h9', name: 'Leer', freq: 'daily', target: 1, days: [], perWeek: 3, updatedAt: 1700000000000 },
    '2026-11-21',
    false
  );
  const b = nuevo().Schema.taskFromHabit(
    { id: 'h9', name: 'Leer', freq: 'daily', target: 1, days: [], perWeek: 3, updatedAt: 1700000000000 },
    '2026-11-21',
    false
  );
  assert.equal(a.id, b.id);
  assert.equal(a.mine, true, 'nunca se confunde con una tarea de ejemplo');
});

test('«Lun, Mié, Vie»: el nombre de la repetición', () => {
  const { Schema } = nuevo();
  assert.equal(Schema.repeatLabel({ repeat: 'weekly', days: [5, 1, 3] }, 1), 'Lun, Mié, Vie');
  assert.equal(Schema.repeatLabel({ repeat: 'weekly', days: [0, 6] }, 1), 'Sáb, Dom');
  assert.equal(Schema.repeatLabel({ repeat: 'weekly', days: [0, 6] }, 0), 'Dom, Sáb');
  assert.equal(Schema.repeatLabel({ repeat: 'daily' }), 'Cada día');
  assert.equal(Schema.repeatLabel({ repeat: 'none' }), '');
});

test('al escribir: «cada lunes, miércoles y viernes» y «todos los martes y jueves»', () => {
  const W = nuevo(['js/core/parse.js']);
  const a = W.Parse.task('Gimnasio cada lunes, miércoles y viernes a las 7', { lists: [] });
  assert.equal(a.text, 'Gimnasio');
  assert.equal(a.repeat, 'weekly');
  assert.deepEqual(plano(a.days), [1, 3, 5]);
  assert.equal(a.date, '2026-11-23');
  assert.equal(a.time, '07:00');
  const b = W.Parse.task('Inglés todos los martes y jueves', { lists: [] });
  assert.deepEqual(plano(b.days), [2, 4]);
  assert.equal(b.date, '2026-11-24');
  const c = W.Parse.task('Correr cada sábado y domingos', { lists: [] });
  assert.deepEqual(plano(c.days), [0, 6]);
  assert.equal(c.date, '2026-11-21', 'hoy es sábado: empieza hoy');
  const d = W.Parse.task('Reunión cada lunes', { lists: [] });
  assert.equal(d.repeat, 'weekly');
  assert.equal(d.days, undefined, 'un solo día: semanal de siempre');
});
