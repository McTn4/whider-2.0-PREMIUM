// Categorías: la app empieza sin ninguna; las de ejemplo de versiones anteriores se quitan si nadie las usa, y un
// dispositivo recién estrenado (sin categorías) no deja sin la suya a las tareas de la cuenta al sincronizar
const test = require('node:test');
const assert = require('node:assert/strict');
const { cargar } = require('./_cargar');

const archivos = ['js/core/i18n.js', 'js/core/util.js', 'js/core/schema.js', 'js/core/store.js', 'js/core/sync.js'];
const nuevo = () => cargar(archivos, { ahora: '2026-11-22T10:00:00' });
const plano = (x) => JSON.parse(JSON.stringify(x));
const ids = (lists) => plano(lists).map((l) => l.id);

test('una instalación nueva empieza sin categorías y sin categoría por defecto', () => {
  const { State: S } = nuevo();
  assert.deepEqual(ids(S.lists), []);
  assert.equal(S.defaultListId(), null);
  const t = S.addTask({ text: 'Algo', date: '2026-11-22', listId: S.defaultListId() });
  assert.equal(t.listId, null);
});

test('reconoce las categorías de ejemplo de antes (con su nombre de siempre)', () => {
  const { Schema } = nuevo();
  assert.equal(Schema.isExampleList({ id: 'personal', name: 'Personal' }), true);
  assert.equal(Schema.isExampleList({ id: 'work', name: 'Trabajo' }), true);
  assert.equal(Schema.isExampleList({ id: 'work', name: 'Work' }), true);
  assert.equal(Schema.isExampleList({ id: 'health', name: 'Salud' }), true);
  assert.equal(Schema.isExampleList({ id: 'work', name: 'Oficina' }), false, 'renombrada: ya es tuya');
  assert.equal(Schema.isExampleList({ id: 'l_x', name: 'Trabajo' }), false, 'creada por ti');
  assert.equal(Schema.isExampleList({ id: 'l_y', name: 'Estudios', icon: 'book', color: 'iris' }), true);
  assert.equal(Schema.isExampleList({ id: 'l_z', name: 'Estudios', icon: 'pin', color: 'iris' }), false);
});

test('quita las de ejemplo sin usar; deja las que tienen tareas, filtros o un nombre tuyo', () => {
  const { State: S } = nuevo();
  S.lists = plano([
    { id: 'personal', name: 'Personal', color: 'iris', icon: 'user' },
    { id: 'work', name: 'Trabajo', color: 'ember', icon: 'briefcase' },
    { id: 'health', name: 'Salud', color: 'jade', icon: 'heart' },
    { id: 'l_1', name: 'Estudios', color: 'iris', icon: 'book' },
    { id: 'l_2', name: 'Viajes', color: 'iris', icon: 'pin' }
  ]);
  S.settings.defaultList = 'personal';
  S.addTask({ text: 'Informe', date: '2026-11-23', listId: 'work' });
  S.filters = plano([
    { id: 'f1', name: 'Salud', lists: ['health'], priorities: [], when: 'any', text: '', status: 'pending', order: 0 }
  ]);
  const antes = S.syncMeta.listsAt;
  assert.equal(S.dropExampleLists(), 2);
  assert.deepEqual(ids(S.lists), ['work', 'health', 'l_2']);
  assert.equal(S.settings.defaultList, null, 'la categoría por defecto se ha ido');
  assert.ok(S.syncMeta.listsAt > antes || S.syncMeta.listsAt === Date.now(), 'el cambio viaja a la nube');
  assert.equal(S.dropExampleLists(), 0, 'una segunda vez no hace nada');
});

test('se puede borrar la última categoría; sus tareas se quedan sin categoría', () => {
  const { State: S } = nuevo();
  const l = S.addList('Casa', 'iris', 'home');
  S.setSetting('defaultList', l.id);
  const t = S.addTask({ text: 'Fregar', date: '2026-11-22', listId: l.id });
  assert.equal(S.removeList(l.id), true);
  assert.deepEqual(ids(S.lists), []);
  assert.equal(S.find(t.id).listId, null);
  assert.equal(S.defaultListId(), null);
});

test('sincronizar: un dispositivo nuevo (sin categorías) no borra las de la cuenta que nadie ha tocado', () => {
  const W = nuevo();
  const snap = (fields) => Object.assign({ v: 1, tasks: [], sync: { deleted: {} } }, fields);
  const nube = snap({
    lists: [{ id: 'personal', name: 'Personal', color: 'iris', icon: 'user' }],
    sync: { deleted: {}, listsAt: 0 }
  });
  const nuevoDisp = snap({ lists: [], sync: { deleted: {}, listsAt: 0 } });
  assert.deepEqual(ids(W.Sync.merge(nuevoDisp, nube).lists), ['personal']);
  assert.deepEqual(ids(W.Sync.merge(nube, nuevoDisp).lists), ['personal']);
  // Si alguien las cambió (o las quitó) después, manda ese cambio
  const quitadas = snap({ lists: [], sync: { deleted: {}, listsAt: 500 } });
  assert.deepEqual(ids(W.Sync.merge(quitadas, nube).lists), []);
  assert.deepEqual(ids(W.Sync.merge(nube, quitadas).lists), []);
});
