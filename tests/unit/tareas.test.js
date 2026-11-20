// Tareas en el almacén local (js/core/store.js): crear, completar, repetir, borrar y deshacer
const test = require('node:test');
const assert = require('node:assert/strict');
const { cargar } = require('./_cargar');

const nuevo = () =>
  cargar(['js/core/i18n.js', 'js/core/util.js', 'js/core/schema.js', 'js/core/store.js'], {
    ahora: '2026-11-20T09:40:00'
  }).State; // viernes

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

test('«en curso»: se empieza, se ve también con subtareas a medias y se borra al completar', () => {
  const S = nuevo();
  const t = S.addTask({ text: 'Informe', date: '2026-11-20', repeat: 'daily' });
  assert.equal(S.isDoing(t), false);
  S.setStarted(t.id, true);
  assert.ok(t.startedAt > 0);
  assert.equal(S.isDoing(t), true);
  S.setDone(t.id, true);
  assert.equal(t.startedAt, null, 'al completarla deja de estar en curso');
  assert.equal(S.find(t.spawnedId).startedAt, null, 'la siguiente repetición empieza pendiente');
  const u = S.addTask({
    text: 'Mudanza',
    subtasks: [
      { text: 'Cajas', done: true },
      { text: 'Furgoneta', done: false }
    ]
  });
  assert.equal(S.isDoing(u), true, 'con alguna subtarea hecha ya está en curso');
  S.setStarted(u.id, false);
  assert.equal(u.startedAt, null);
});

test('una tarea completada nunca llega «en curso» (ni desde la nube)', () => {
  const S = nuevo();
  const t = S.addTask({ text: 'Hecha', done: true, startedAt: 123 });
  assert.equal(t.startedAt, null);
});

test('las categorías guardan su color opcional y lo pierden si no es válido', () => {
  const S = nuevo();
  const l = S.addList('Viajes', null, 'send', 'azul');
  assert.equal(l.tint, 'azul');
  S.updateList(l.id, { tint: 'fucsia' });
  assert.equal(l.tint, undefined);
  S.updateList(l.id, { tint: 'verde' });
  assert.equal(S.getList(l.id).tint, 'verde');
  S.updateList(l.id, { tint: null });
  assert.equal(S.getList(l.id).tint, undefined);
  for (const k of Object.keys(S.LIST_TINTS)) assert.match(S.LIST_TINTS[k].hex, /^#[0-9A-F]{6}$/);
});

test('cada campo editado guarda su hora para fusionar sin perder cambios', () => {
  const S = nuevo();
  const t = S.addTask({ text: 'Cita', date: '2026-11-20' });
  assert.equal(t.ft, undefined, 'recién creada no hace falta');
  S.updateTask(t.id, { time: '10:00' });
  assert.ok(t.ft.time > 0);
  assert.equal(t.ft.text, undefined, 'solo lo que cambió');
  S.setDone(t.id, true);
  assert.ok(t.ft.done > 0);
  S.moveToTomorrow(t.id);
  assert.ok(t.ft.date > 0);
});

test('archivar saca de la lista lo completado hace tiempo y lo guarda en el archivo', () => {
  const S = nuevo();
  const vieja = S.addTask({ text: 'Del año pasado' });
  S.setDone(vieja.id, true);
  vieja.doneAt = Date.now() - 500 * 86400000;
  const nueva = S.addTask({ text: 'De ayer' });
  S.setDone(nueva.id, true);
  S.addTask({ text: 'Pendiente' });
  const gone = S.archiveDone(Date.now() - 400 * 86400000);
  assert.equal(gone.length, 1);
  assert.deepEqual([...S.tasks.map((x) => x.text)].sort(), ['De ayer', 'Pendiente']);
  assert.equal(S.archived().length, 1);
  assert.equal(S.archived()[0].text, 'Del año pasado');
  assert.ok(S.syncMeta.archivedBefore > 0);
  assert.equal(S.addToArchive([vieja]), 0, 'no se duplica');
});
