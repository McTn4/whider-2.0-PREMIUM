// Fusión de páginas del Cuaderno (PageSync.mergeContent): bloque a bloque y sin perder ediciones a la vez
const test = require('node:test');
const assert = require('node:assert/strict');
const { cargar } = require('./_cargar');

const W = cargar(['js/core/util.js', 'js/core/pagesync.js']);
const merge = (a, b, since) => JSON.parse(JSON.stringify(W.PageSync.mergeContent(a, b, since)));
const blk = (id, x, at) => ({ id, t: 'p', x, at });

test('cambios en bloques distintos: se conservan los dos', () => {
  const a = { blocks: [blk('b1', 'Uno editado', 300), blk('b2', 'Dos', 100)], del: {}, cv: 300 };
  const b = { blocks: [blk('b1', 'Uno', 100), blk('b2', 'Dos editado', 250)], del: {}, cv: 250 };
  const m = merge(a, b, 200);
  assert.deepEqual(
    m.blocks.map((x) => x.x),
    ['Uno editado', 'Dos editado']
  );
});

test('el mismo bloque editado a la vez: gana el más reciente y la otra versión queda debajo', () => {
  const a = { blocks: [blk('b1', 'Versión de Ana', 300)], del: {}, cv: 300 };
  const b = { blocks: [blk('b1', 'Versión de Luis', 250)], del: {}, cv: 250 };
  for (const m of [merge(a, b, 200), merge(b, a, 200)]) {
    assert.equal(m.blocks.length, 2);
    assert.equal(m.blocks[0].x, 'Versión de Ana');
    assert.equal(m.blocks[1].t, 'callout');
    assert.match(m.blocks[1].x, /Otra versión.*Versión de Luis/);
  }
  // Las dos fusiones crean la misma nota (mismo id): al juntarlas no se duplica
  const una = merge(a, b, 200);
  const otra = merge(b, a, 200);
  assert.equal(merge(una, otra, 200).blocks.length, 2);
});

test('si el otro lado no lo tocó desde la última vez, no es un choque', () => {
  const a = { blocks: [blk('b1', 'Nuevo', 300)], del: {}, cv: 300 };
  const b = { blocks: [blk('b1', 'Viejo', 100)], del: {}, cv: 100 };
  const m = merge(a, b, 200);
  assert.equal(m.blocks.length, 1);
  assert.equal(m.blocks[0].x, 'Nuevo');
});

test('sin saber cuándo se vio la nube (primera vez), gana el más reciente como antes', () => {
  const a = { blocks: [blk('b1', 'A', 300)], del: {}, cv: 300 };
  const b = { blocks: [blk('b1', 'B', 250)], del: {}, cv: 250 };
  assert.equal(merge(a, b).blocks.length, 1);
});

test('lo borrado no vuelve y los bloques nuevos de cada lado se colocan en su sitio', () => {
  const a = { blocks: [blk('b1', 'Uno', 100), blk('b3', 'Tres (de A)', 300)], del: { b2: 280 }, cv: 300 };
  const b = {
    blocks: [blk('b1', 'Uno', 100), blk('b2', 'Dos', 150), blk('b4', 'Cuatro (de B)', 260)],
    del: {},
    cv: 260
  };
  const m = merge(a, b, 200);
  assert.ok(!m.blocks.some((x) => x.id === 'b2'), 'b2 estaba borrado');
  assert.ok(m.blocks.some((x) => x.id === 'b4') && m.blocks.some((x) => x.id === 'b3'));
});
