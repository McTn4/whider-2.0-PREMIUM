/**
 * Copias automáticas de la app de escritorio: la carpeta «Copias» dentro de la de datos de la app, con las
 * 10 últimas (una por día). Solo acepta los nombres de las copias automáticas, así que desde la app web no se
 * puede escribir ni leer ningún otro archivo.
 */
'use strict';
const fs = require('fs');
const path = require('path');

const KEEP = 10;
const NAME = /^whider-copia-auto-\d{4}-\d{2}-\d{2}\.json$/;

function create(dir) {
  /** Las copias, de la más reciente a la más antigua: [{ name, size, at }] */
  function list() {
    let names;
    try { names = fs.readdirSync(dir).filter((n) => NAME.test(n)); } catch (e) { return []; }
    return names.sort().reverse().map((n) => {
      const st = fs.statSync(path.join(dir, n));
      return { name: n, size: st.size, at: st.mtimeMs };
    });
  }
  /** Guarda (o sustituye) la copia del día y deja solo las 10 últimas */
  function write(name, json) {
    if (!NAME.test(String(name))) return { ok: false, error: 'nombre' };
    try {
      fs.mkdirSync(dir, { recursive: true });
      const file = path.join(dir, name);
      fs.writeFileSync(file + '.tmp', String(json));
      fs.renameSync(file + '.tmp', file);
      list().slice(KEEP).forEach((f) => { try { fs.rmSync(path.join(dir, f.name)); } catch (e) { /* ya no está */ } });
      return { ok: true, path: file };
    } catch (e) {
      return { ok: false, error: String((e && e.message) || e) };
    }
  }
  function read(name) {
    if (!NAME.test(String(name))) return null;
    try { return fs.readFileSync(path.join(dir, name), 'utf8'); } catch (e) { return null; }
  }
  return { list, write, read, dir };
}

module.exports = { create, NAME, KEEP };
