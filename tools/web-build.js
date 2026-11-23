#!/usr/bin/env node
/*
 * WHIDER · Prepara la web para publicarla en Vercel (vercel.json ejecuta este script).
 *
 *   dist/index.html  ← sitio/index.html   la portada (qué es WHIDER y la descarga para cada dispositivo)
 *   dist/en/index.html ← sitio/en/index.html   la portada en inglés (/en/; la política de privacidad, en /privacy/)
 *   dist/app.html    ← index.html         la app; vercel.json la sirve en /app (empaquetada: ver más abajo)
 *   y el resto de la web tal cual: css, js, fuentes, iconos, invitaciones (i/), acceso desde Android (entrar/),
 *   privacidad, sitio/, .well-known…
 *
 * Android y la app de escritorio siguen usando index.html como la app: para ellos no cambia nada.
 * En local: «node tools/web-build.js» y sirve dist/ con las mismas reglas que vercel.json
 * (o usa «python serve.py», que sirve la app en / y en /app, y la portada en /sitio/).
 */
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const zlib = require('zlib');
const esbuild = require('esbuild');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'dist');
// Solo lo que forma parte de la web (nada de android/, desktop/, docs/, herramientas ni registros)
const WEB = ['index.html', 'manifest.json', 'sw.js', 'css', 'js', 'fonts', 'icons', 'i', 'entrar', 'privacidad', 'privacy', 'sitio', '.well-known'];

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
fs.mkdirSync(path.join(OUT, 'en'), { recursive: true });
fs.renameSync(path.join(OUT, 'sitio', 'en', 'index.html'), path.join(OUT, 'en', 'index.html'));
fs.rmdirSync(path.join(OUT, 'sitio', 'en'));

/*
 * ---------- Empaquetado de la app (solo la web publicada) ----------
 * La app son ~60 scripts clásicos que cuelgan de window.Whider. En desarrollo, en Android y en la app de
 * escritorio se cargan tal cual (desde el propio dispositivo). En la web se juntan y se minimizan:
 *   assets/app.<huella>.js       todos los scripts de app.html, en el mismo orden (salvo js/config.js y js/core/i18n.js)
 *   assets/cuaderno.<huella>.js  el editor del Cuaderno, que se sigue cargando solo al abrirlo
 *   assets/app.<huella>.css      las hojas de estilo de app.html (desktop.css, dentro de su @media)
 * Cada uno con su mapa de código (.map, con los archivos originales dentro) y un nombre que cambia con su
 * contenido, así que el navegador puede guardarlos un año (vercel.json) y nunca usa uno viejo.
 * El Service Worker publicado guarda estos archivos y su caché se llama como la huella de todo lo que guarda.
 * WHIDER_SIN_EMPAQUETAR=1 deja la web sin empaquetar (para comparar).
 */
const PKG = require(path.join(ROOT, 'package.json'));
const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');
const kb = (n) => (n / 1024).toFixed(1) + ' KB';

/** Junta y minimiza scripts clásicos; el mapa es un «índice» con una sección por archivo */
function juntarJs(files, nombre) {
  let code = '', line = 0;
  const sections = [];
  for (const f of files) {
    const src = fs.readFileSync(path.join(OUT, f), 'utf8');
    const r = esbuild.transformSync(src, { minify: true, charset: 'utf8', legalComments: 'none', sourcemap: 'external', sourcefile: '../' + f });
    let out = r.code.endsWith('\n') ? r.code : r.code + '\n';
    // Cada archivo acaba en «;» para que juntarlos nunca cambie el significado
    if (!/;\s*$/.test(out)) out = out.replace(/\s*$/, ';\n');
    sections.push({ offset: { line, column: 0 }, map: JSON.parse(r.map) });
    code += out;
    line += out.split('\n').length - 1;
  }
  const file = 'assets/' + nombre + '.' + sha(code).slice(0, 10) + '.js';
  fs.mkdirSync(path.join(OUT, 'assets'), { recursive: true });
  fs.writeFileSync(path.join(OUT, file), code + '//# sourceMappingURL=' + path.basename(file) + '.map\n');
  fs.writeFileSync(path.join(OUT, file + '.map'), JSON.stringify({ version: 3, file: path.basename(file), sections }));
  return { file, code, files };
}

function juntarCss(items, nombre) {
  let css = '';
  for (const it of items) {
    const src = fs.readFileSync(path.join(OUT, it.file), 'utf8');
    css += (it.media ? '@media ' + it.media + ' {\n' + src + '\n}\n' : src) + '\n';
  }
  const r = esbuild.transformSync(css, { loader: 'css', minify: true, charset: 'utf8', legalComments: 'none' });
  const file = 'assets/' + nombre + '.' + sha(r.code).slice(0, 10) + '.css';
  fs.writeFileSync(path.join(OUT, file), r.code);
  return { file, code: r.code, files: items.map((i) => i.file) };
}

function tamanos(files) {
  const buf = Buffer.concat(files.map((f) => fs.readFileSync(path.join(OUT, f))));
  return { bruto: buf.length, gzip: zlib.gzipSync(buf, { level: 9 }).length, brotli: zlib.brotliCompressSync(buf).length };
}

function empaquetar() {
  const APP = path.join(OUT, 'app.html');
  let html = fs.readFileSync(APP, 'utf8');

  // 1. Scripts de app.html. Se quedan aparte config.js (la configuración de cada despliegue) e i18n.js (en otro idioma
  //    escribe la etiqueta de su catálogo justo detrás de sí misma: tiene que ir antes del paquete, no dentro)
  const APARTE = ['js/config.js', 'js/core/i18n.js'];
  const scriptTags = [...html.matchAll(/<script src="(js\/[^"]+)"><\/script>\n?/g)].filter((m) => !APARTE.includes(m[1]));
  const jsFiles = scriptTags.map((m) => m[1]);
  // 2. El editor del Cuaderno: la misma lista que usa js/screens/notes.js para cargarlo
  const notes = fs.readFileSync(path.join(OUT, 'js/screens/notes.js'), 'utf8');
  const editorFiles = JSON.parse(/var EDITOR = (\[[^\]]+\]);/.exec(notes)[1].replace(/'/g, '"'));
  // 3. Hojas de estilo
  const linkTags = [...html.matchAll(/<link rel="stylesheet" href="(css\/[^"]+)"(?: media="([^"]+)")?>\n?/g)];

  const antes = { js: tamanos(jsFiles), cuaderno: tamanos(editorFiles), css: tamanos(linkTags.map((m) => m[1])), peticiones: scriptTags.length + linkTags.length };
  const app = juntarJs(jsFiles, 'app');
  const cuaderno = juntarJs(editorFiles, 'cuaderno');
  const estilos = juntarCss(linkTags.map((m) => ({ file: m[1], media: m[2] })), 'app');

  // app.html: un solo script (detrás de config.js) y una sola hoja de estilo
  const first = scriptTags[0][0];
  html = html.replace(first, '<script>window.WHIDER_CHUNKS = ' + JSON.stringify({ cuaderno: [cuaderno.file] }) + ';</script>\n<script src="' + app.file + '"></script>\n');
  for (const m of scriptTags.slice(1)) html = html.replace(m[0], '');
  html = html.replace(linkTags[0][0], '<link rel="stylesheet" href="' + estilos.file + '">\n');
  for (const m of linkTags.slice(1)) html = html.replace(m[0], '');
  fs.writeFileSync(APP, html);
  // La hoja del Cuaderno se sigue cargando aparte, al abrirlo: solo se minimiza
  const cuadernoCss = path.join(OUT, 'css/cuaderno.css');
  fs.writeFileSync(cuadernoCss, esbuild.transformSync(fs.readFileSync(cuadernoCss, 'utf8'), { loader: 'css', minify: true, charset: 'utf8' }).code);

  // Los originales ya van dentro de los paquetes (y de sus mapas): fuera de la web, para que nada los use por error
  const juntados = new Set([...app.files, ...cuaderno.files, ...estilos.files]);
  for (const f of juntados) fs.rmSync(path.join(OUT, f));

  // Service Worker: guarda los paquetes en lugar de los originales y su caché cambia con el contenido
  const swFile = path.join(OUT, 'sw.js');
  let sw = fs.readFileSync(swFile, 'utf8');
  const lista = /var ASSETS = \[([\s\S]*?)\];/.exec(sw);
  const assets = [...lista[1].matchAll(/'([^']+)'/g)].map((m) => m[1]).filter((u) => !juntados.has(u.replace(/^\.\//, '')));
  assets.push('./' + app.file, './' + cuaderno.file, './' + estilos.file);
  const huella = sha(assets.map((u) => {
    const f = u === './app' ? 'app.html' : u.replace(/^\.\//, '');
    return u + ':' + (fs.existsSync(path.join(OUT, f)) ? sha(fs.readFileSync(path.join(OUT, f))) : '');
  }).join('\n')).slice(0, 10);
  sw = sw.replace(lista[0], 'var ASSETS = [\n' + assets.map((u) => "  '" + u + "'").join(',\n') + '\n];')
    .replace(/var CACHE_NAME = '[^']*';/, "var CACHE_NAME = 'whider-" + PKG.version + '-' + huella + "';");
  fs.writeFileSync(swFile, sw);

  const despues = { js: tamanos([app.file]), cuaderno: tamanos([cuaderno.file]), css: tamanos([estilos.file]), peticiones: 3 };
  const fila = (t, a, d) => '  ' + t.padEnd(22) + (kb(a.bruto) + ' → ' + kb(d.bruto)).padEnd(26) + (kb(a.gzip) + ' → ' + kb(d.gzip)).padEnd(24) + kb(a.brotli) + ' → ' + kb(d.brotli);
  console.log('Empaquetado (sin comprimir · gzip · brotli):');
  console.log(fila('Scripts al abrir', antes.js, despues.js));
  console.log(fila('Cuaderno (al abrirlo)', antes.cuaderno, despues.cuaderno));
  console.log(fila('Estilos', antes.css, despues.css));
  console.log('  Archivos al abrir la app: ' + antes.peticiones + ' → ' + despues.peticiones + ' (más config.js) · caché ' + /CACHE_NAME = '([^']+)'/.exec(sw)[1]);
  fs.writeFileSync(path.join(OUT, 'assets', 'informe.json'), JSON.stringify({ version: PKG.version, antes, despues, app: app.file, cuaderno: cuaderno.file, css: estilos.file }, null, 2));
}

if (process.env.WHIDER_SIN_EMPAQUETAR !== '1') empaquetar();

let files = 0, bytes = 0;
(function count(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) count(p); else { files++; bytes += fs.statSync(p).size; }
  }
})(OUT);
console.log('Web lista en dist/: ' + files + ' archivos, ' + (bytes / 1e6).toFixed(1) + ' MB (portada en /, app en /app)');
