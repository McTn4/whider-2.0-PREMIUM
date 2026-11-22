// Versiones (tools/version.js), Novedades (js/ui/whatsnew.js) y actualizaciones del ordenador (desktop/lib/updates.js)
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { cargar } = require('./_cargar');
const V = require('../../tools/version.js');
const UPD = require('../../desktop/lib/updates.js');

const RAIZ = path.join(__dirname, '..', '..');
const CHANGELOG = fs.readFileSync(path.join(RAIZ, 'CHANGELOG.md'), 'utf8');
const PKG = require('../../package.json');

test('el código de versión de Android siempre sube', () => {
  const orden = [
    '1.0.0',
    '1.1.0-alpha.1',
    '1.1.0-beta.1',
    '1.1.0-beta.2',
    '1.1.0-rc.1',
    '1.1.0',
    '1.1.1',
    '1.2.0-beta.1',
    '1.2.0',
    '2.0.0'
  ];
  const codigos = orden.map(V.versionCode);
  for (let i = 1; i < codigos.length; i++) assert.ok(codigos[i] > codigos[i - 1], orden[i] + ' > ' + orden[i - 1]);
  assert.equal(V.versionCode('1.1.0'), 1010099);
  assert.equal(V.versionCode('1.1.0-beta.1'), 1010031);
  // Por encima del de la 1.0 ya instalada (1000) y de Google Play (máximo 2.100.000.000)
  assert.ok(V.versionCode('1.0.0') > 1000);
  assert.ok(V.versionCode('2099.99.99') < 2100000000);
  assert.throws(() => V.versionCode('1.1'), /no válida/);
  assert.throws(() => V.versionCode('1.100.0'), /hasta 99/);
  assert.throws(() => V.versionCode('1.1.0-beta.30'), /de 1 a 29/);
});

test('comparar versiones: las de prueba van antes que la estable', () => {
  for (const cmp of [V.compare, UPD.compare]) {
    assert.equal(cmp('1.1.0-beta.1', '1.1.0'), -1);
    assert.equal(cmp('1.1.0', '1.1.0-rc.2'), 1);
    assert.equal(cmp('1.1.0-beta.2', '1.1.0-beta.10'), -1);
    assert.equal(cmp('1.10.0', '1.9.9'), 1);
    assert.equal(cmp('2.0.0', '2.0.0'), 0);
  }
  assert.equal(UPD.compare('v1.2.0', '1.1.9'), 1);
});

test('el CHANGELOG del repositorio: la versión actual, en orden y con fecha', () => {
  // Arriba puede haber una sección «Sin publicar» (lo hecho desde la última versión)
  const todas = V.parseChangelog(CHANGELOG);
  assert.ok(
    todas.every((r, i) => V.SEMVER.test(r.v) || (i === 0 && r.v === 'Sin publicar')),
    'solo versiones (y «Sin publicar» arriba)'
  );
  const all = todas.filter((r) => V.SEMVER.test(r.v));
  assert.ok(all.length >= 2);
  assert.equal(all[0].v, PKG.version, 'la primera versión es la de package.json');
  for (const r of all) assert.match(r.date, /^\d{4}-\d{2}-\d{2}$/, r.v);
  for (let i = 1; i < all.length; i++) assert.equal(V.compare(all[i - 1].v, all[i].v), 1);
  const beta1 = all.find((r) => r.v === '1.1.0-beta.1');
  assert.ok(beta1.summary.length > 20);
  assert.ok(beta1.groups.find((g) => g.t === 'Novedades').items.length >= 3);
  // Los puntos que ocupan dos líneas se unen
  assert.ok(beta1.groups[0].items.some((t) => /Importar.*deshacer durante un día/.test(t)));
});

test('al cambiar de versión, «Sin publicar» pasa a ser esa versión con su fecha (y nunca se ve en la app)', () => {
  const md =
    '# Novedades\n\n## [Sin publicar]\n\nAlgo.\n\n### Mejoras\n\n- Uno\n\n## [1.1.0-beta.1] · 2026-11-18\n\n### Novedades\n\n- Dos\n';
  assert.deepEqual(
    V.appReleases(V.parseChangelog(md)).map((r) => r.v),
    ['1.1.0-beta.1']
  );
  const nueva = V.publicar(md, '1.1.0-beta.2', '2026-11-19');
  assert.match(nueva, /^## \[1\.1\.0-beta\.2\] · 2026-11-19$/m);
  assert.deepEqual(
    V.parseChangelog(nueva).map((r) => r.v),
    ['1.1.0-beta.2', '1.1.0-beta.1']
  );
  assert.equal(V.publicar(nueva, '1.2.0', '2026-12-01'), nueva, 'sin «Sin publicar», no cambia nada');
});

test('notas de la app: sin «Para desarrolladores» y sin las betas de una versión ya estable', () => {
  const md = [
    '## [1.2.0] · 2026-12-01',
    'Estable.',
    '### Novedades',
    '- Uno',
    '### Para desarrolladores',
    '- Interno',
    '## [1.2.0-beta.1] · 2026-11-25',
    '### Novedades',
    '- Prueba',
    '## [1.1.0] · 2026-11-20',
    '### Correcciones',
    '- Dos'
  ].join('\n');
  const app = V.appReleases(V.parseChangelog(md));
  assert.deepEqual(
    app.map((r) => r.v),
    ['1.2.0', '1.1.0']
  );
  assert.deepEqual(
    app[0].groups.map((g) => g.t),
    ['Novedades']
  );
  assert.equal(app[0].summary, 'Estable.');
});

test('notas de la publicación en GitHub: CHANGELOG y cómo instalar cada archivo', () => {
  const notas = V.releaseNotes(PKG.version, V.parseChangelog(CHANGELOG));
  for (const f of [
    'WHIDER-Setup.exe',
    'WHIDER-mac-arm64.dmg',
    'WHIDER-mac-x64.dmg',
    'WHIDER-linux.AppImage',
    'WHIDER-linux.deb',
    'WHIDER-android.apk'
  ]) {
    assert.ok(notas.includes(f), f);
  }
  assert.ok(notas.includes('### Novedades'));
  assert.ok(notas.includes('libfuse2'));
  if (/-/.test(PKG.version)) assert.ok(notas.startsWith('> **Versión de prueba.**'));
  assert.throws(() => V.releaseNotes('0.0.1', V.parseChangelog(CHANGELOG)), /no tiene la versión/);
});

test('todo el repositorio lleva la misma versión (lo que comprueba la integración continua)', () => {
  const vjs = fs.readFileSync(path.join(RAIZ, 'js/core/version.js'), 'utf8');
  assert.ok(vjs.includes('window.Whider.VERSION = ' + JSON.stringify(PKG.version)));
  assert.equal(require('../../desktop/package.json').version, PKG.version);
  const gradle = fs.readFileSync(path.join(RAIZ, 'android/app/build.gradle'), 'utf8');
  assert.ok(gradle.includes('versionCode ' + V.versionCode(PKG.version)));
  assert.ok(gradle.includes('versionName "' + PKG.version + '"'));
  // La portada anuncia la última estable, no una de prueba
  const web = fs.readFileSync(path.join(RAIZ, 'sitio/descargas.js'), 'utf8');
  const estable = V.parseChangelog(CHANGELOG).find((r) => V.SEMVER.test(r.v) && !/-/.test(r.v)).v;
  assert.ok(web.includes("version: '" + estable + "'"), 'portada: ' + estable);
});

/* ---------- Novedades en la app ---------- */
function app(opts) {
  const W = cargar(['js/core/i18n.js', 'js/core/util.js', 'js/core/version.js', 'js/ui/whatsnew.js'], {
    ahora: '2026-11-18T09:00:00'
  });
  W.State = { meta: { onboarded: !!opts.onboarded } };
  if (opts.seen) W.__win.localStorage.setItem('whider.seenVersion', opts.seen);
  if (opts.version) W.VERSION = opts.version;
  if (opts.releases) W.RELEASES = opts.releases;
  return W;
}
const R = (v) => ({ v, date: '2026-11-18', summary: 'Notas de ' + v, groups: [{ t: 'Novedades', items: ['algo'] }] });

test('Novedades: instalación nueva → nada que contar (y queda vista)', () => {
  const W = app({ onboarded: false });
  assert.equal(W.WhatsNew.pending().length, 0);
  assert.equal(W.WhatsNew.due(), false);
  assert.equal(W.__win.localStorage.getItem('whider.seenVersion'), W.VERSION);
});

test('Novedades: quien venía de la 1.0 ve las de esta versión, una sola vez', () => {
  const W = app({ onboarded: true });
  assert.deepEqual([...W.WhatsNew.pending().map((r) => r.v)], [W.VERSION]);
  assert.equal(W.WhatsNew.due(), true);
  W.WhatsNew.markSeen();
  assert.equal(W.WhatsNew.due(), false);
  assert.equal(W.WhatsNew.pending().length, 0);
});

test('Novedades: al pasar a una estable no se repiten las notas de sus betas', () => {
  const W = app({
    onboarded: true,
    seen: '1.0.0',
    version: '1.1.0',
    releases: [R('1.1.0'), R('1.1.0-beta.2'), R('1.1.0-beta.1'), R('1.0.0')]
  });
  assert.deepEqual([...W.WhatsNew.pending().map((r) => r.v)], ['1.1.0']);
  // …pero quien prueba las betas ve la nueva beta
  const B = app({
    onboarded: true,
    seen: '1.1.0-beta.1',
    version: '1.1.0-beta.2',
    releases: [R('1.1.0-beta.2'), R('1.1.0-beta.1'), R('1.0.0')]
  });
  assert.deepEqual([...B.WhatsNew.pending().map((r) => r.v)], ['1.1.0-beta.2']);
});

test('Novedades: al pasar a una versión mayor no se cuentan como nuevas las de la anterior', () => {
  const todas = [R('2.1.0'), R('2.0.0'), R('1.1.0'), R('1.0.0')];
  const pend = (seen, version) => [
    ...app({ onboarded: true, seen, version, releases: todas })
      .WhatsNew.pending()
      .map((r) => r.v)
  ];
  // De la 1.0 o la 1.1 a la 2.0: solo las de la 2.0 (las de la 1.1 hablan de cosas que ya no están)
  assert.deepEqual(pend('1.0.0', '2.0.0'), ['2.0.0']);
  assert.deepEqual(pend('1.1.0', '2.0.0'), ['2.0.0']);
  // Dentro de la misma versión mayor, todas las que faltan
  assert.deepEqual(pend('1.1.0', '2.1.0'), ['2.1.0', '2.0.0']);
  assert.deepEqual(pend('2.0.0', '2.1.0'), ['2.1.0']);
});

test('Novedades: el aviso en Hoy caduca a las dos semanas', () => {
  const W = app({ onboarded: true });
  assert.equal(W.WhatsNew.due(), true);
  W.__win.localStorage.setItem('whider.updatedAt', String(Date.parse('2026-11-01T09:00:00')));
  assert.equal(W.WhatsNew.due(), false);
  assert.equal(W.__win.localStorage.getItem('whider.seenVersion'), W.VERSION);
});

test('Novedades: etiquetas y texto seguro', () => {
  const W = app({ onboarded: false });
  assert.equal(W.WhatsNew.label('1.1.0-beta.2'), '1.1.0 beta 2');
  assert.equal(W.WhatsNew.label('1.1.0'), '1.1.0');
  assert.equal(
    W.WhatsNew.inline('**Importar** `CSV` <img src=x onerror=alert(1)> [web](https://x)'),
    '<b>Importar</b> <code>CSV</code> &lt;img src=x onerror=alert(1)&gt; web'
  );
});

/* ---------- Actualizaciones del ordenador ---------- */
test('cómo se actualiza cada instalación', () => {
  assert.equal(UPD.mode('win32', {}, true), 'auto');
  assert.equal(UPD.mode('linux', { APPIMAGE: '/home/a/WHIDER.AppImage' }, true), 'auto');
  assert.equal(UPD.mode('linux', {}, true), 'notify', '.deb');
  assert.equal(UPD.mode('darwin', {}, true), 'notify', 'macOS sin firma de Apple');
  assert.equal(UPD.mode('win32', {}, false), 'off', 'sin empaquetar');
  assert.equal(UPD.mode('darwin', { WHIDER_UPDATE_TEST: '1' }, false), 'notify', 'pruebas');
});

test('el instalador de cada ordenador, solo de las publicaciones de WHIDER', () => {
  const base = 'https://github.com/McTn4/whider-2.0-PREMIUM/releases/download/v1.2.0/';
  const assets = [
    'WHIDER-Setup.exe',
    'WHIDER-mac-arm64.dmg',
    'WHIDER-mac-x64.dmg',
    'WHIDER-linux.AppImage',
    'WHIDER-linux.deb'
  ].map((name) => ({ name, browser_download_url: base + name }));
  assert.equal(UPD.pickAsset(assets, 'darwin', 'arm64'), base + 'WHIDER-mac-arm64.dmg');
  assert.equal(UPD.pickAsset(assets, 'darwin', 'x64'), base + 'WHIDER-mac-x64.dmg');
  assert.equal(UPD.pickAsset(assets, 'linux', 'x64'), base + 'WHIDER-linux.deb');
  assert.equal(UPD.pickAsset(assets, 'win32', 'x64'), base + 'WHIDER-Setup.exe');
  assert.equal(
    UPD.pickAsset(
      [{ name: 'WHIDER-linux.deb', browser_download_url: 'https://malo.example/WHIDER-linux.deb' }],
      'linux',
      'x64'
    ),
    null
  );
  assert.equal(UPD.pickAsset([], 'darwin', 'arm64'), null);
});

test('los errores se explican sin tecnicismos', () => {
  assert.match(UPD.errorText(new Error('net::ERR_INTERNET_DISCONNECTED')), /Sin conexión/);
  assert.match(UPD.errorText(new Error('HTTP 404')), /Todavía no hay/);
  assert.match(UPD.errorText(new Error('Cannot find latest.yml in the latest release artifacts')), /Todavía no hay/);
  assert.match(UPD.errorText(new Error('HTTP 403: API rate limit exceeded')), /GitHub no responde/);
  assert.match(UPD.errorText(new Error('sha512 checksum mismatch')), /comprobación de seguridad/);
});

test('portada: la versión menor y las novedades sacadas del CHANGELOG', () => {
  assert.equal(V.minor('1.1.3'), '1.1');
  assert.equal(V.minor('1.2.0-beta.1'), '1.2');
  assert.equal(V.mdInline('**Tema** `x` [y](https://z) <b>&'), '<b>Tema</b> <code>x</code> y &lt;b&gt;&amp;');
  const r = {
    groups: [
      { t: 'Novedades', items: ['**Uno**: primera frase. Segunda frase.', 'Dos sin punto'] },
      { t: 'Mejoras', items: ['M1.', 'M2.', 'M3.'] },
      { t: 'Para desarrolladores', items: ['Nunca en la portada.'] }
    ]
  };
  const html = V.newsHtml(/** @type {any} */ (r));
  const items = html.split('\n');
  // Con menos de 4 novedades se completa con mejoras; cada una, en su primera frase
  assert.deepEqual(items, [
    '        <li class="rv"><b>Uno</b>: primera frase.</li>',
    '        <li class="rv">Dos sin punto</li>',
    '        <li class="rv">M1.</li>',
    '        <li class="rv">M2.</li>'
  ]);
  // Con 6 o más novedades, solo las 6 primeras
  const many = {
    groups: [
      { t: 'Novedades', items: ['a.', 'b.', 'c.', 'd.', 'e.', 'f.', 'g.'] },
      { t: 'Mejoras', items: ['m.'] }
    ]
  };
  assert.equal(V.newsHtml(/** @type {any} */ (many)).split('\n').length, 6);
});

test('portada: las dos páginas anuncian la misma versión que sitio/descargas.js', () => {
  const v = /version: '([^']+)'/.exec(fs.readFileSync(path.join(RAIZ, 'sitio/descargas.js'), 'utf8'))[1];
  for (const f of ['sitio/index.html', 'sitio/en/index.html']) {
    const html = fs.readFileSync(path.join(RAIZ, f), 'utf8');
    const shown = [...html.matchAll(/<span data-version>([^<]*)<\/span>/g)].map((m) => m[1]);
    assert.ok(shown.length >= 3, f);
    for (const s of shown) assert.equal(s, 'WHIDER ' + V.minor(v), f);
  }
  assert.match(
    fs.readFileSync(path.join(RAIZ, 'sitio/en/index.html'), 'utf8'),
    new RegExp('data-news-version="' + V.minor(v).replace('.', '\\.') + '"')
  );
});
