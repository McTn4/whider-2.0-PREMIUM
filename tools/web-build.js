#!/usr/bin/env node
/*
 * WHIDER · Prepara la web para publicarla en Vercel (vercel.json ejecuta este script).
 *
 *   dist/index.html  ← sitio/index.html   la portada (qué es WHIDER y la descarga para cada dispositivo)
 *   dist/app.html    ← index.html         la app; vercel.json la sirve en /app
 *   y el resto de la web tal cual: css, js, fuentes, iconos, invitaciones (i/), privacidad, sitio/, .well-known…
 *
 * Android y la app de escritorio siguen usando index.html como la app: para ellos no cambia nada.
 * En local: «node tools/web-build.js» y sirve dist/ con las mismas reglas que vercel.json
 * (o usa «python serve.py», que sirve la app en / y en /app, y la portada en /sitio/).
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'dist');
// Solo lo que forma parte de la web (nada de android/, desktop/, docs/, herramientas ni registros)
const WEB = ['index.html', 'manifest.json', 'sw.js', 'css', 'js', 'fonts', 'icons', 'i', 'privacidad', 'sitio', '.well-known'];

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
for (const name of WEB) {
  const from = path.join(ROOT, name);
  if (!fs.existsSync(from)) throw new Error('Falta ' + name + ' en el proyecto');
  fs.cpSync(from, path.join(OUT, name), { recursive: true });
}

// La app pasa a /app y la portada ocupa la raíz
fs.renameSync(path.join(OUT, 'index.html'), path.join(OUT, 'app.html'));
fs.renameSync(path.join(OUT, 'sitio', 'index.html'), path.join(OUT, 'index.html'));

let files = 0, bytes = 0;
(function count(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) count(p); else { files++; bytes += fs.statSync(p).size; }
  }
})(OUT);
console.log('Web lista en dist/: ' + files + ' archivos, ' + (bytes / 1e6).toFixed(1) + ' MB (portada en /, app en /app)');
