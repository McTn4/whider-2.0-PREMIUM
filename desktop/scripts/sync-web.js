/**
 * Copia la app web (la misma que usa el móvil) dentro de desktop/www para empaquetarla.
 * Se ejecuta antes de abrir o compilar la app de escritorio: npm start · npm run dist
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const OUT = path.resolve(__dirname, '..', 'www');
const FILES = ['index.html', 'manifest.json'];
const DIRS = ['css', 'js', 'fonts', 'icons'];

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
for (const f of FILES) fs.copyFileSync(path.join(ROOT, f), path.join(OUT, f));
for (const d of DIRS) fs.cpSync(path.join(ROOT, d), path.join(OUT, d), { recursive: true });

let n = 0;
(function count(dir) { for (const e of fs.readdirSync(dir, { withFileTypes: true })) e.isDirectory() ? count(path.join(dir, e.name)) : n++; })(OUT);
console.log('App web copiada en desktop/www (' + n + ' archivos)');
