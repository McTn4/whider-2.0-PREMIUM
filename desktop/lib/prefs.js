/**
 * Preferencias de la app de escritorio (tamaño de la ventana, bandeja…) en un JSON
 * dentro de la carpeta de datos de la app. Los datos de WHIDER (tareas, listas…) no van
 * aquí: los guarda la propia app web en su almacenamiento, igual que en el navegador.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { app } = require('electron');

let file = null, data = null, timer = null;

function load() {
  if (data) return data;
  file = path.join(app.getPath('userData'), 'whider-desktop.json');
  try { data = JSON.parse(fs.readFileSync(file, 'utf8')) || {}; } catch (e) { data = {}; }
  return data;
}

function flush() {
  clearTimeout(timer); timer = null;
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file + '.tmp', JSON.stringify(data, null, 2));
    fs.renameSync(file + '.tmp', file);
  } catch (e) { /* sin permisos de escritura: se queda en memoria */ }
}

module.exports = {
  get(key) { return load()[key]; },
  set(key, value) {
    load()[key] = value;
    clearTimeout(timer);
    timer = setTimeout(flush, 300);
  },
  flush() { if (data) flush(); }
};
