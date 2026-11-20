// Fusión de la sincronización (Sync.merge, función pura): lo que decide qué versión sobrevive cuando
// dos dispositivos cambian los mismos datos. Estas pruebas fijan el comportamiento actual.
const test = require('node:test');
const assert = require('node:assert/strict');
const { cargar } = require('./_cargar');

const W = cargar(['js/core/i18n.js', 'js/core/util.js', 'js/core/schema.js', 'js/core/store.js', 'js/core/sync.js'], {
  ahora: '2026-11-16T09:40:00'
});
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

test('dos dispositivos cambian campos distintos de la misma tarea: se conservan los dos cambios', () => {
  // A cambia la fecha (más tarde en general); B la completa antes pero su campo «done» es más nuevo que el de A
  const base = { id: 't1', text: 'Informe', createdAt: 1000 };
  const a = snap({
    tasks: [Object.assign({}, base, { date: '2026-11-20', done: false, updatedAt: 300, ft: { date: 300 } })]
  });
  const b = snap({
    tasks: [
      Object.assign({}, base, {
        date: '2026-11-18',
        done: true,
        doneOn: '2026-11-18',
        doneAt: 250,
        updatedAt: 250,
        ft: { done: 250 }
      })
    ]
  });
  for (const m of [merge(a, b), merge(b, a)]) {
    const t = m.tasks[0];
    assert.equal(t.date, '2026-11-20', 'la fecha nueva de A');
    assert.equal(t.done, true, 'y la tarea completada en B');
    assert.equal(t.doneOn, '2026-11-18');
    assert.equal(t.ft.date, 300);
    assert.equal(t.ft.done, 250);
  }
});

test('si los dos cambian el mismo campo, gana la edición más reciente de ese campo', () => {
  const a = snap({ tasks: [t('t1', 'Texto de A', 500, { ft: { text: 200 } })] });
  const b = snap({ tasks: [t('t1', 'Texto de B', 400, { ft: { text: 400 } })] });
  assert.equal(merge(a, b).tasks[0].text, 'Texto de B');
  assert.equal(merge(b, a).tasks[0].text, 'Texto de B');
});

test('versiones sin hora por campo (de una app anterior): gana la más reciente, como antes', () => {
  const a = snap({ tasks: [t('t1', 'Vieja', 100)] });
  const b = snap({ tasks: [t('t1', 'Nueva', 200)] });
  assert.equal(merge(a, b).tasks[0].text, 'Nueva');
  assert.equal(merge(a, b).tasks[0].ft, undefined);
});

test('el tiempo de enfoque dedicado se queda con el mayor', () => {
  const a = snap({ tasks: [t('t1', 'X', 500, { focusMin: 25 })] });
  const b = snap({ tasks: [t('t1', 'X', 400, { focusMin: 50 })] });
  assert.equal(merge(a, b).tasks[0].focusMin, 50);
});

test('la marca de archivo saca de la copia lo completado antes de ella (y no lo que sigue pendiente)', () => {
  const a = snap({
    tasks: [
      t('t1', 'Vieja hecha', 10, { done: true, doneAt: 100 }),
      t('t2', 'Reciente hecha', 10, { done: true, doneAt: 900 }),
      t('t3', 'Pendiente', 10, { done: false })
    ],
    sync: { deleted: {}, archivedBefore: 500 }
  });
  const b = snap({ tasks: [t('t1', 'Vieja hecha', 10, { done: true, doneAt: 100 })] });
  const m = merge(b, a);
  assert.deepEqual(m.tasks.map((x) => x.id).sort(), ['t2', 't3']);
  assert.equal(m.sync.archivedBefore, 500);
});

test('los fallos de la nube se explican y solo se reintentan cuando tiene sentido', () => {
  const c = (code, ctx, message) => W.Sync.classify({ code, message }, ctx);
  assert.equal(c('unavailable').kind, 'connection');
  assert.equal(c('unavailable').retry, true);
  assert.equal(c(undefined, { offline: true }).kind, 'connection');
  assert.equal(c('unauthenticated').kind, 'auth');
  assert.equal(c('unauthenticated').retry, false);
  assert.equal(c('permission-denied', { verified: false }).kind, 'unverified');
  assert.equal(c('permission-denied', { verified: true }).kind, 'permissions');
  assert.equal(c('aborted').kind, 'conflict');
  assert.equal(c('resource-exhausted').slow, true);
  assert.equal(c('size').kind, 'size');
  assert.equal(c('invalid-argument', {}, 'Document exceeds the maximum allowed size').kind, 'size');
  assert.equal(c('internal').kind, 'server');
  for (const k of ['unavailable', 'unauthenticated', 'aborted', 'internal', 'size'])
    assert.ok(c(k).text.length > 20, k);
});

test('reintentos cada vez más espaciados, con tope de 5 minutos', () => {
  const b = (n, slow) => W.Sync.backoff(n, slow, 0.5);
  assert.equal(b(0), 2000);
  assert.equal(b(1), 4000);
  assert.equal(b(3), 16000);
  assert.equal(b(20), 300000);
  assert.equal(b(0, true), 60000);
  assert.ok(W.Sync.backoff(0, false, 0) >= 1600 && W.Sync.backoff(0, false, 1) <= 2400, 'con ±20 % de azar');
});

test('sin tocar la app se mira la nube cada vez menos', () => {
  assert.equal(W.Sync.pollEvery(10000), 15000);
  assert.equal(W.Sync.pollEvery(5 * 60000), 60000);
  assert.equal(W.Sync.pollEvery(60 * 60000), 300000);
});
