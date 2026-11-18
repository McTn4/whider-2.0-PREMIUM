#!/usr/bin/env node
// @ts-check
/**
 * WHIDER · Versión única
 *
 * La versión de verdad es la de package.json. Este script la lleva a todo lo demás:
 *   - desktop/package.json y desktop/package-lock.json: la app de escritorio y sus actualizaciones
 *   - android/app/build.gradle: versionName y versionCode (Google Play exige que el código suba siempre)
 *   - js/core/version.js: la versión que enseña la app y las notas de «Novedades» (sacadas de CHANGELOG.md)
 *   - sitio/descargas.js: la versión que anuncia la portada (la última estable del CHANGELOG)
 *
 *   node tools/version.js               sincroniza todo con package.json
 *   node tools/version.js 1.2.0         cambia la versión (y package-lock.json) y sincroniza
 *   node tools/version.js --check       solo comprueba (integración continua): falla si algo no coincide o si
 *                                       CHANGELOG.md no tiene una entrada para la versión
 *   node tools/version.js --notes [v]   imprime las notas de una versión para su publicación en GitHub
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const abs = (/** @type {string} */ p) => path.join(ROOT, p);
const read = (/** @type {string} */ p) => fs.readFileSync(abs(p), 'utf8');

/** Versiones admitidas: 1.2.3 y las de prueba 1.2.3-alpha.N, -beta.N y -rc.N */
const SEMVER = /^(\d+)\.(\d+)\.(\d+)(?:-(alpha|beta|rc)\.(\d+))?$/;
/** Secciones del CHANGELOG que se ven en la app (el resto, como «Para desarrolladores», solo en GitHub) */
const APP_GROUPS = ['Novedades', 'Mejoras', 'Correcciones', 'Seguridad'];
/** Cuántas versiones caben en la pantalla de Novedades */
const APP_RELEASES = 8;

/**
 * Código de versión de Android: siempre mayor para una versión posterior.
 *   MAYOR·1.000.000 + MENOR·10.000 + PARCHE·100 + (alpha 1-29 · beta 31-59 · rc 61-89 · estable 99)
 *   1.1.0-beta.1 → 1010031 · 1.1.0 → 1010099 · 1.1.1 → 1010199
 * @param {string} v
 */
function versionCode(v) {
  const m = SEMVER.exec(v);
  if (!m) throw new Error('Versión no válida: «' + v + '». Usa 1.2.3 o 1.2.3-beta.1');
  const maj = +m[1],
    min = +m[2],
    pat = +m[3];
  if (min > 99 || pat > 99) throw new Error('La versión menor y el parche llegan hasta 99: ' + v);
  if (maj < 1 || maj > 2099) throw new Error('Versión mayor fuera de rango: ' + v);
  let tail = 99;
  if (m[4]) {
    const n = +m[5];
    if (n < 1 || n > 29) throw new Error('El número de la versión de prueba va de 1 a 29: ' + v);
    tail = { alpha: 0, beta: 30, rc: 60 }[m[4]] + n;
  }
  return maj * 1000000 + min * 10000 + pat * 100 + tail;
}

/**
 * Las versiones de CHANGELOG.md, de la más reciente a la más antigua.
 * @param {string} text
 * @returns {{ v: string, date: string, summary: string, groups: { t: string, items: string[] }[] }[]}
 */
function parseChangelog(text) {
  /** @type {{ v: string, date: string, summary: string, groups: { t: string, items: string[] }[] }[]} */
  const out = [];
  /** @type {any} */ let cur = null;
  /** @type {any} */ let group = null;
  let inItem = false;
  for (const line of text.split(/\r?\n/)) {
    let m;
    if ((m = /^## \[([^\]]+)\](?:\s*[·-]\s*(\d{4}-\d{2}-\d{2}))?/.exec(line))) {
      cur = { v: m[1].trim(), date: m[2] || '', summary: '', groups: [] };
      out.push(cur);
      group = null;
      inItem = false;
      continue;
    }
    if (!cur) continue;
    if ((m = /^### (.+)$/.exec(line))) {
      group = { t: m[1].trim(), items: [] };
      cur.groups.push(group);
      inItem = false;
      continue;
    }
    if (group && (m = /^[-*] (.+)$/.exec(line))) {
      group.items.push(m[1].trim());
      inItem = true;
      continue;
    }
    if (group && inItem && /^\s{2,}\S/.test(line)) {
      group.items[group.items.length - 1] += ' ' + line.trim();
      continue;
    }
    if (!line.trim()) {
      inItem = false;
      continue;
    }
    if (!group) cur.summary = (cur.summary ? cur.summary + ' ' : '') + line.trim();
  }
  return out;
}

/** -1, 0 o 1 según el orden de dos versiones (las de prueba van antes que la estable) */
function compare(/** @type {string} */ a, /** @type {string} */ b) {
  const pa = SEMVER.exec(a),
    pb = SEMVER.exec(b);
  if (!pa || !pb) return String(a).localeCompare(String(b));
  for (let i = 1; i <= 3; i++) if (+pa[i] !== +pb[i]) return +pa[i] < +pb[i] ? -1 : 1;
  const ta = pa[4] ? versionCode(a) % 100 : 99,
    tb = pb[4] ? versionCode(b) % 100 : 99;
  return ta === tb ? 0 : ta < tb ? -1 : 1;
}

/** Las notas para la app: solo lo que interesa a quien la usa, y las betas ya publicadas como estable, fuera */
function appReleases(/** @type {ReturnType<typeof parseChangelog>} */ all) {
  const stable = all.filter((r) => !/-/.test(r.v)).map((r) => r.v.replace(/-.*/, ''));
  return all
    .filter((r) => SEMVER.test(r.v))
    .filter((r) => !/-/.test(r.v) || stable.indexOf(r.v.replace(/-.*/, '')) < 0)
    .slice(0, APP_RELEASES)
    .map((r) => ({
      v: r.v,
      date: r.date,
      summary: r.summary,
      groups: r.groups
        .filter((g) => APP_GROUPS.indexOf(g.t) >= 0 && g.items.length)
        .map((g) => ({ t: g.t, items: g.items }))
    }));
}

/** js/core/version.js tal y como debe quedar */
function versionJs(/** @type {string} */ v, /** @type {any[]} */ releases) {
  return (
    '// Generado por tools/version.js desde package.json y CHANGELOG.md: no lo edites a mano.\n' +
    '// Para cambiar la versión: node tools/version.js 1.2.3 (y su entrada en CHANGELOG.md).\n' +
    'window.Whider = window.Whider || {};\n' +
    'window.Whider.VERSION = ' +
    JSON.stringify(v) +
    ';\n' +
    'window.Whider.RELEASES = ' +
    JSON.stringify(releases, null, 1) +
    ';\n'
  );
}

/** Notas de una publicación en GitHub (Markdown): el CHANGELOG de esa versión y cómo instalarla */
function releaseNotes(/** @type {string} */ v, /** @type {ReturnType<typeof parseChangelog>} */ all) {
  const r = all.find((x) => x.v === v);
  if (!r) throw new Error('CHANGELOG.md no tiene la versión ' + v);
  const beta = /-/.test(v);
  const lines = [];
  if (beta) lines.push('> **Versión de prueba.** Puede tener fallos; la versión estable está en «Latest».', '');
  if (r.summary) lines.push(r.summary, '');
  for (const g of r.groups) {
    if (!g.items.length) continue;
    lines.push('### ' + g.t, '');
    for (const it of g.items) lines.push('- ' + it);
    lines.push('');
  }
  lines.push(
    '### Descargas',
    '',
    '| Sistema | Archivo | Cómo |',
    '| --- | --- | --- |',
    '| Windows 10 y 11 | **WHIDER-Setup.exe** | Ábrelo y se instala solo. Si aparece «Windows protegió su PC»: **Más información → Ejecutar de todas formas** (la app no está firmada con un certificado de pago). Después se actualiza sola. |',
    '| macOS con Apple Silicon (M1 o posterior) | **WHIDER-mac-arm64.dmg** | Arrastra WHIDER a Aplicaciones. La primera vez, ábrela con **clic derecho → Abrir**. Te avisa cuando hay una versión nueva. |',
    '| macOS con Intel | **WHIDER-mac-x64.dmg** | Igual que la anterior. |',
    '| Linux (cualquiera) | **WHIDER-linux.AppImage** | Dale permiso de ejecución y ábrelo. Se actualiza sola. En Ubuntu 22.04 o posterior necesita `libfuse2` (`sudo apt install libfuse2`); si no, usa el .deb. |',
    '| Debian, Ubuntu, Mint | **WHIDER-linux.deb** | Ábrelo con el instalador de programas o `sudo apt install ./WHIDER-linux.deb`. Te avisa cuando hay una versión nueva. |',
    '| Android | **WHIDER-android.apk** | De pruebas mientras llega a Google Play: permite «Instalar apps de orígenes desconocidos» si te lo pide. Te avisa cuando hay una versión nueva. |',
    '',
    'En el navegador no hace falta instalar nada: https://whider-red.vercel.app/app',
    '',
    'Historial completo: [CHANGELOG.md](https://github.com/McTn4/whider-2.0-PREMIUM/blob/main/CHANGELOG.md)'
  );
  return lines.join('\n') + '\n';
}

/** Cada archivo que depende de la versión: { file, actual, esperado } */
function targets(/** @type {string} */ v) {
  const all = parseChangelog(read('CHANGELOG.md'));
  /** @type {{ file: string, actual: string, expected: string }[]} */
  const list = [];
  const json = (/** @type {string} */ file, /** @type {(o: any) => void} */ fix) => {
    const actual = read(file);
    const o = JSON.parse(actual);
    fix(o);
    list.push({ file, actual, expected: JSON.stringify(o, null, 2) + '\n' });
  };
  json('package-lock.json', (o) => {
    o.version = v;
    if (o.packages && o.packages['']) o.packages[''].version = v;
  });
  json('desktop/package.json', (o) => {
    o.version = v;
  });
  json('desktop/package-lock.json', (o) => {
    o.version = v;
    if (o.packages && o.packages['']) o.packages[''].version = v;
  });
  const gradle = read('android/app/build.gradle');
  list.push({
    file: 'android/app/build.gradle',
    actual: gradle,
    expected: gradle
      .replace(/versionCode \d+/, 'versionCode ' + versionCode(v))
      .replace(/versionName "[^"]*"/, 'versionName "' + v + '"')
  });
  const vjs = abs('js/core/version.js');
  list.push({
    file: 'js/core/version.js',
    actual: fs.existsSync(vjs) ? read('js/core/version.js') : '',
    expected: versionJs(v, appReleases(all))
  });
  // La portada ofrece la última versión estable (las de prueba no se anuncian)
  const stable = all.find((r) => SEMVER.test(r.v) && !/-/.test(r.v));
  const web = read('sitio/descargas.js');
  list.push({
    file: 'sitio/descargas.js',
    actual: web,
    expected: web.replace(/version: '[^']*'/, "version: '" + (stable ? stable.v : v) + "'")
  });
  return { list, all };
}

function main(/** @type {string[]} */ argv) {
  const pkgFile = abs('package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgFile, 'utf8'));

  if (argv[0] === '--notes') {
    process.stdout.write(releaseNotes(argv[1] || pkg.version, parseChangelog(read('CHANGELOG.md'))));
    return 0;
  }

  if (argv[0] && argv[0] !== '--check') {
    const nueva = argv[0].replace(/^v/, '');
    versionCode(nueva); // valida el formato
    if (compare(nueva, pkg.version) < 0)
      throw new Error('La versión nueva (' + nueva + ') es anterior a la actual (' + pkg.version + ')');
    pkg.version = nueva;
    fs.writeFileSync(pkgFile, JSON.stringify(pkg, null, 2) + '\n');
  }
  const v = pkg.version;
  versionCode(v);
  const { list, all } = targets(v);

  if (argv[0] === '--check') {
    const problems = list.filter((t) => t.actual !== t.expected).map((t) => t.file + ' no está al día');
    if (!all.some((r) => r.v === v)) problems.push('CHANGELOG.md no tiene una entrada «## [' + v + '] · AAAA-MM-DD»');
    const sorted = all.filter((r) => SEMVER.test(r.v));
    for (let i = 1; i < sorted.length; i++) {
      if (compare(sorted[i - 1].v, sorted[i].v) <= 0)
        problems.push('CHANGELOG.md: ' + sorted[i - 1].v + ' debería ir después de ' + sorted[i].v);
    }
    if (problems.length) {
      console.error('Versión ' + v + ':\n  - ' + problems.join('\n  - ') + '\nArréglalo con: node tools/version.js');
      return 1;
    }
    console.log('Versión ' + v + ' (Android ' + versionCode(v) + '): todo al día');
    return 0;
  }

  let changed = 0;
  for (const t of list) {
    if (t.actual === t.expected) continue;
    fs.writeFileSync(abs(t.file), t.expected);
    console.log('· ' + t.file);
    changed++;
  }
  if (!all.some((r) => r.v === v)) console.warn('Aviso: añade a CHANGELOG.md la entrada «## [' + v + '] · AAAA-MM-DD»');
  console.log(
    'Versión ' +
      v +
      ' (Android ' +
      versionCode(v) +
      '): ' +
      (changed ? changed + ' archivos actualizados' : 'ya estaba todo al día')
  );
  return 0;
}

if (require.main === module) {
  try {
    process.exit(main(process.argv.slice(2)));
  } catch (e) {
    console.error(String(e && /** @type {any} */ (e).message ? /** @type {any} */ (e).message : e));
    process.exit(1);
  }
}

module.exports = { versionCode, parseChangelog, compare, appReleases, releaseNotes, versionJs, SEMVER };
