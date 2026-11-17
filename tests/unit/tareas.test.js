// Tareas en el almacén local (js/core/store.js): crear, completar, repetir, borrar y deshacer
const test = require('node:test');
const assert = require('node:assert/strict');
const { cargar } = require('./_cargar');

const nuevo = () => cargar(['js/core/util.js', 'js/core/store.js'], { ahora: '2026-11-20T09:40:00' }).State; // viernes

test('una tarea nueva se guarda limpia y marcada como propia', () => {
  const S = nuevo();
  const t = S.addTask({ text: '  Comprar pan  ', date: '2026-11-20', time: '10:00' });
  assert.ok(t && t.id);
  assert.equal(t.mine, true);
  assert.equal(t.done, false);
  assert.equal(S.tasks.length, 1);
  assert.equal(S.find(t.id), t);
});

test('una tarea sin texto no se crea', () => {
  const S = nuevo();
  assert.equal(S.addTask({ text: '   ' }), null);
  assert.equal(S.tasks.length, 0);
});

test('completar una tarea diaria crea la del día siguiente; desmarcarla la quita', () => {
  const S = nuevo();
  const t = S.addTask({ text: 'Regar', date: '2026-11-20', repeat: 'daily' });
  S.setDone(t.id, true);
  assert.equal(S.tasks.length, 2);
  const sig = S.find(t.spawnedId);
  assert.equal(sig.date, '2026-11-21');
  assert.equal(sig.done, false);
  S.setDone(t.id, false);
  assert.equal(S.tasks.length, 1);
  assert.equal(t.spawnedId, null);
  assert.ok(S.syncMeta.deleted[sig.id], 'la copia quitada queda registrada como borrada para la nube');
});

test('«entre semana» salta del viernes al lunes', () => {
  const S = nuevo();
  const t = S.addTask({ text: 'Informe', date: '2026-11-20', repeat: 'weekdays' });
  S.setDone(t.id, true);
  assert.equal(S.find(t.spawnedId).date, '2026-11-23');
});

test('mensual respeta los meses cortos', () => {
  const S = nuevo();
  const t = S.addTask({ text: 'Alquiler', date: '2026-01-31', repeat: 'monthly' });
  S.setDone(t.id, true);
  assert.equal(S.find(t.spawnedId).date, '2026-02-28');
});

test('las subtareas de la siguiente repetición empiezan sin marcar', () => {
  const S = nuevo();
  const t = S.addTask({
    text: 'Limpieza',
    date: '2026-11-20',
    repeat: 'weekly',
    subtasks: [{ text: 'Cocina', done: true }]
  });
  S.setDone(t.id, true);
  const sig = S.find(t.spawnedId);
  assert.equal(sig.date, '2026-11-27');
  assert.equal(sig.subtasks.length, 1);
  assert.equal(sig.subtasks[0].done, false);
});

test('borrar y deshacer devuelve la tarea a su sitio', () => {
  const S = nuevo();
  const a = S.addTask({ text: 'A' });
  S.addTask({ text: 'B' });
  const snap = S.removeTask(a.id);
  assert.equal(S.tasks.length, 1);
  assert.ok(S.syncMeta.deleted[a.id]);
  S.restoreTask(snap);
  assert.equal(S.tasks[0].id, a.id);
  assert.equal(S.syncMeta.deleted[a.id], undefined);
});

test('editar el plazo vuelve a armar los avisos', () => {
  const S = nuevo();
  const t = S.addTask({ text: 'Cita', date: '2026-11-20', time: '10:00' });
  t.warnedAt = 1;
  t.remindedAt = 1;
  S.updateTask(t.id, { time: '11:00' });
  assert.equal(t.warnedAt, null);
  assert.equal(t.remindedAt, null);
  S.updateTask(t.id, { text: 'Cita médica' });
  assert.equal(t.text, 'Cita médica');
});
