// Fusión de la sincronización (Sync.merge, función pura): lo que decide qué versión sobrevive cuando
// dos dispositivos cambian los mismos datos. Estas pruebas fijan el comportamiento actual.
const test = require('node:test');
const assert = require('node:assert/strict');
const { cargar } = require('./_cargar');

const W = cargar(['js/core/util.js', 'js/core/store.js', 'js/core/sync.js'], { ahora: '2026-11-16T09:40:00' });
const merge = (a, b) => JSON.parse(JSON.stringify(W.Sync.merge(a, b)));
const t = (id, text, updatedAt, extra) => Object.assign({ id, text, createdAt: 1000, updatedAt }, extra);
const snap = (fields) => Object.assign({ v: 1, tasks: [], sync: { deleted: {} } }, fields);

test('si falta una de las dos versiones, gana la otra tal cual', () => {
  const a = snap({ tasks: [t('t1', 'A', 5)] });
  assert.equal(W.Sync.merge(a, null), a);
  assert.equal(W.Sync.merge(null, a), a);
});

test('las tareas se unen y, si coinciden, gana la editada más tarde', () => {
  const a = snap({ tasks: [t('t1', 'Viejo', 10), t('t2', 'Solo en A', 10)] });
  const b = snap({ tasks: [t('t1', 'Nuevo', 20), t('t3', 'Solo en B', 10)] });
  const m = merge(a, b);
  assert.deepEqual(m.tasks.map((x) => x.id).sort(), ['t1', 't2', 't3']);
  assert.equal(m.tasks.find((x) => x.id === 't1').text, 'Nuevo');
  // Simétrica: da igual qué lado sea el local
  assert.equal(merge(b, a).tasks.find((x) => x.id === 't1').text, 'Nuevo');
});

test('una tarea borrada no vuelve… salvo que se edite después del borrado', () => {
  const borrada = snap({ tasks: [], sync: { deleted: { t1: 50 } } });
  assert.equal(merge(borrada, snap({ tasks: [t('t1', 'Antes', 40)] })).tasks.length, 0);
  assert.equal(merge(borrada, snap({ tasks: [t('t1', 'Después', 60)] })).tasks.length, 1);
  // El registro de borrados se conserva (el más reciente de cada lado)
  const m = merge(snap({ sync: { deleted: { t1: 50, t9: 5 } } }), snap({ sync: { deleted: { t1: 70 } } }));
  assert.equal(m.sync.deleted.t1, 70);
  assert.equal(m.sync.deleted.t9, 5);
});

test('ajustes, listas y perfil: gana el lado cambiado más tarde', () => {
  const a = snap({ settings: { sound: true }, sync: { deleted: {}, settingsAt: 100 } });
  const b = snap({ settings: { sound: false }, sync: { deleted: {}, settingsAt: 200 } });
  assert.equal(merge(a, b).settings.sound, false);
  assert.equal(merge(b, a).settings.sound, false);
  assert.equal(merge(a, b).sync.settingsAt, 200);
});

test('hábitos por elemento y registro diario por la marca más reciente', () => {
  const a = snap({
    habits: [{ id: 'h1', name: 'Agua', updatedAt: 5 }],
    habitLog: { h1: { '2026-11-15': { n: 1, at: 10 }, '2026-11-16': { n: 1, at: 30 } } }
  });
  const b = snap({
    habits: [{ id: 'h1', name: 'Beber agua', updatedAt: 9 }],
    habitLog: { h1: { '2026-11-16': { n: 3, at: 20 } } }
  });
  const m = merge(a, b);
  assert.equal(m.habits.length, 1);
  assert.equal(m.habits[0].name, 'Beber agua');
  assert.equal(m.habitLog.h1['2026-11-15'].n, 1);
  assert.equal(m.habitLog.h1['2026-11-16'].n, 1); // la marca de las 30 es posterior a la de las 20
});

test('enfoque y tareas hechas por día: se queda el máximo, no la suma', () => {
  const a = snap({ focus: { '2026-11-16': { min: 25, sessions: 1 } }, doneLog: { '2026-11-16': 3 } });
  const b = snap({ focus: { '2026-11-16': { min: 50, sessions: 2 } }, doneLog: { '2026-11-16': 2 } });
  const m = merge(a, b);
  assert.deepEqual(m.focus['2026-11-16'], { min: 50, sessions: 2 });
  assert.equal(m.doneLog['2026-11-16'], 3);
});

test('un «restablecer datos» posterior manda sobre los registros del otro dispositivo', () => {
  const reiniciado = snap({ doneLog: {}, sync: { deleted: {}, resetAt: 500 } });
  const viejo = snap({ doneLog: { '2026-11-01': 9 }, sync: { deleted: {}, resetAt: 0 } });
  assert.deepEqual(merge(reiniciado, viejo).doneLog, {});
  assert.equal(merge(viejo, reiniciado).sync.resetAt, 500);
});

test('chats: lo leído es lo máximo de los dos lados', () => {
  const a = snap({ social: { chats: { c1: { at: 10, read: 300, muted: false } } } });
  const b = snap({ social: { chats: { c1: { at: 20, read: 200, muted: true } } } });
  const c = merge(a, b).social.chats.c1;
  assert.equal(c.read, 300);
  assert.equal(c.muted, true);
});

test('la huella no cambia por el orden de las claves', () => {
  const x = snap({ tasks: [t('t1', 'A', 5)], settings: { a: 1, b: 2 } });
  const y = JSON.parse(JSON.stringify(x));
  y.settings = { b: 2, a: 1 };
  assert.equal(W.Sync.fingerprint(x), W.Sync.fingerprint(y));
});
