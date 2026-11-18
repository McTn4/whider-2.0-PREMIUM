// Tema claro: las hojas de estilo de la app no usan grises fijos pensados solo para el fondo oscuro, y cada color
// del tema oscuro (css/tokens.css) tiene su equivalente en el claro. Así, lo que se añada después no se queda
// oscuro (o invisible) con el tema claro.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const CSS = path.join(__dirname, '..', '..', 'css');
const FILES = ['components.css', 'cuaderno.css', 'desktop.css', 'layout.css', 'screens.css', 'social.css'];
// Se ven igual en los dos temas: la tarjeta del QR (blanca, para poder escanearla), el escáner y el visor de
// archivos (sobre negro), los botones sobre fotos, la impresión, el informe (es papel), las portadas del Cuaderno y
// los fondos de avatar (son como imágenes), el icono de la app y el botón de Google (con su versión clara oficial)
const SAME =
  /\.qr-|\.qr\b|\.scan-|\.fv-|\.bk-img-tool|printing-page|\.rp-|\.cv-|\.av-bg-|^\.av-in\b|\.app-icon|\.google-btn/;
// Las sombras son negras en los dos temas
const SHADOW = /^(box-shadow|text-shadow|filter|-webkit-filter)$/;

/** Cada regla normal (también dentro de @media y @supports): { sel, body } */
function rules(css) {
  css = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const out = [];
  let i = 0;
  for (;;) {
    const j = css.indexOf('{', i),
      k = css.indexOf('}', i);
    if (j === -1 && k === -1) return out;
    if (k !== -1 && (j === -1 || k < j)) {
      i = k + 1;
      continue;
    }
    const head = css.slice(i, j).trim();
    if (head.startsWith('@')) {
      if (/^@(media|supports|container)/.test(head)) {
        i = j + 1;
        continue;
      }
      let depth = 1,
        e = j + 1; // @keyframes, @font-face…: enteros fuera
      while (depth && e < css.length) {
        if (css[e] === '{') depth++;
        else if (css[e] === '}') depth--;
        e++;
      }
      i = e;
      continue;
    }
    const e = css.indexOf('}', j);
    out.push({ sel: head, body: css.slice(j + 1, e) });
    i = e + 1;
  }
}

/** Grises de la declaración que solo funcionan sobre un fondo (muy oscuros o muy claros) */
function boundGreys(value) {
  const found = [];
  const grey = (r, g, b) => Math.max(r, g, b) - Math.min(r, g, b) <= 12;
  for (const m of value.matchAll(/#([0-9a-f]{3}|[0-9a-f]{6})\b/gi)) {
    let h = m[1];
    if (h.length === 3)
      h = h
        .split('')
        .map((c) => c + c)
        .join('');
    const [r, g, b] = [0, 2, 4].map((x) => parseInt(h.slice(x, x + 2), 16));
    if (grey(r, g, b) && (r < 90 || r > 190)) found.push(m[0]);
  }
  for (const m of value.matchAll(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)[^)]*\)/g)) {
    const [r, g, b] = [m[1], m[2], m[3]].map(Number);
    if (grey(r, g, b) && (r < 90 || r > 190)) found.push(m[0]);
  }
  for (const m of value.matchAll(/(^|[\s,(])(white|black)\b/gi)) found.push(m[2]);
  return found;
}

test('ninguna regla usa grises fijos que dependan del tema (se usan las variables de css/tokens.css)', () => {
  const bad = [];
  for (const f of FILES) {
    for (const { sel, body } of rules(fs.readFileSync(path.join(CSS, f), 'utf8'))) {
      if (SAME.test(sel)) continue;
      for (const decl of body.split(';')) {
        const at = decl.indexOf(':');
        if (at < 0) continue;
        const prop = decl.slice(0, at).trim().toLowerCase();
        if (prop.startsWith('--') || SHADOW.test(prop)) continue;
        const greys = boundGreys(decl.slice(at + 1));
        if (greys.length)
          bad.push(f + ' · ' + sel.replace(/\s+/g, ' ').slice(0, 70) + ' { ' + prop + ': ' + greys.join(', ') + ' }');
      }
    }
  }
  assert.deepEqual(
    bad,
    [],
    'Colores fijos que se quedarían mal con el tema claro (usa una variable de css/tokens.css):\n' + bad.join('\n')
  );
});

test('cada color del tema oscuro tiene su valor en el tema claro', () => {
  const tok = fs.readFileSync(path.join(CSS, 'tokens.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  const block = (re) => {
    const m = tok.match(re);
    assert.ok(m, 'bloque ' + re);
    return m[1];
  };
  const vars = (s) => new Map([...s.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]));
  const dark = vars(block(/:root\s*\{([\s\S]*?)\n\}/));
  const light = vars(block(/:root\[data-theme='light'\]\s*\{([\s\S]*?)\n\}/));
  // Colores literales (no alias de otra variable): #hex, rgb(a) y tripletes «r, g, b»
  const isColor = (v) =>
    /^#[0-9a-f]{3,8}$/i.test(v) ||
    /^rgba?\(/.test(v) ||
    /^\d+,\s*\d+,\s*\d+$/.test(v) ||
    (/rgba?\(/.test(v) && /^(drop-shadow|0 )/.test(v));
  const missing = [...dark].filter(([k, v]) => isColor(v) && !light.has(k)).map(([k]) => k);
  assert.deepEqual(missing, [], 'Variables de color sin valor en el tema claro: ' + missing.join(', '));
  assert.match(
    fs.readFileSync(path.join(CSS, 'tokens.css'), 'utf8'),
    /:root\[data-theme='light'\]\s*\{\s*color-scheme: light;/
  );
});

test('alto contraste también en el tema claro, después del oscuro (para no quedar pisado)', () => {
  const c = fs.readFileSync(path.join(CSS, 'components.css'), 'utf8');
  const dark = c.indexOf('html[data-contrast="high"] {'),
    light = c.indexOf('html[data-theme="light"][data-contrast="high"] {');
  assert.ok(dark > -1 && light > dark, 'la regla del tema claro va después');
});

test('el tema se aplica antes de pintar (sin destello al abrir) y la app lo recuerda', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', '..', 'index.html'), 'utf8');
  const head = html.slice(0, html.indexOf('</head>'));
  assert.match(head, /setAttribute\('data-theme'/, 'el script del <head> pone data-theme');
  assert.match(head, /prefers-color-scheme: light/, 'y respeta «Como el sistema»');
  assert.match(
    html,
    /<symbol id="logo"[^>]*>[^<]*<path[^>]*stroke="currentColor"/,
    'el logotipo toma el color del texto'
  );
});
