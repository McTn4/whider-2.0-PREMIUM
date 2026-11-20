#!/usr/bin/env node
// @ts-check
/**
 * WHIDER · Herramienta de idiomas (ver docs/decisiones/0003-idiomas.md y js/core/i18n.js)
 *
 *   node tools/i18n.js faltan [archivo…]      textos que pasan por W.t / W.tn / W.tp / U.plural y no están en
 *                                             js/i18n/en.js, por archivo y listos para traducir
 *   node tools/i18n.js sobran                 claves del catálogo que ya no usa nadie
 *   node tools/i18n.js pendientes [archivo…]  textos que parecen de la interfaz y aún no pasan por W.t (aproximado)
 *   node tools/i18n.js envolver archivo…      envuelve en W.t() los textos de las posiciones de interfaz seguras
 *                                             (text, title, sub, label…, los hijos de U.el, W.UI.empty…) y convierte
 *                                             las concatenaciones en textos con {variables}; lo demás, a mano
 *   node tools/i18n.js datos archivo VAR…     envuelve los textos de esas tablas de datos (var VAR = [ … ])
 *   node tools/i18n.js resumen                cuántos textos hay envueltos y traducidos
 *
 * Con --estricto, «faltan» termina con error si falta alguno (para la integración continua).
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const acorn = require('acorn');
const walk = require('acorn-walk');

const RAIZ = path.join(__dirname, '..');
const DIRS = ['js', 'js/core', 'js/ui', 'js/screens'];
const NO = new Set(['js/config.js', 'js/core/i18n.js']);
const CATALOGO = path.join(RAIZ, 'js', 'i18n', 'en.js');

// Propiedades cuyo valor es texto de la interfaz
const CLAVES = new Set([
  'text',
  'title',
  'sub',
  'header',
  'footer',
  'label',
  'desc',
  'description',
  'placeholder',
  'aria-label',
  'hint',
  'ok',
  'cancel',
  'html',
  'caption',
  'note',
  'help',
  'empty',
  'subtitle',
  'lead',
  'body',
  'tip',
  'question',
  'heading'
]);
// Funciones que reciben texto en argumentos sueltos: nombre → posiciones
const ARGS = {
  'W.UI.empty': [1, 2],
  'UI.empty': [1, 2],
  'W.UI.toggle': [2],
  'W.Notify.system': [0, 1],
  'U.plural': [1, 2],
  'W.tn': [1, 2]
};

function archivos(lista) {
  if (lista && lista.length) return lista.map((f) => f.replace(/^\.\//, ''));
  const out = [];
  for (const d of DIRS)
    for (const f of fs.readdirSync(path.join(RAIZ, d)))
      if (f.endsWith('.js') && !NO.has(d + '/' + f)) out.push(d + '/' + f);
  return out;
}
function leer(f) {
  return fs.readFileSync(path.join(RAIZ, f), 'utf8');
}
function arbol(src, f) {
  try {
    return acorn.parse(src, { ecmaVersion: 2022, ranges: true, locations: true });
  } catch (e) {
    throw new Error(f + ': ' + e.message, { cause: e });
  }
}
/** Nombre de una llamada: W.UI.empty, U.plural… */
function nombre(n) {
  if (!n) return '';
  if (n.type === 'Identifier') return n.name;
  if (n.type === 'MemberExpression' && !n.computed) {
    const o = nombre(n.object);
    return o ? o + '.' + n.property.name : '';
  }
  if (n.type === 'CallExpression') {
    const o = nombre(n.callee);
    return o ? o + '()' : '';
  }
  return '';
}
function clave(p) {
  return p.key && (p.key.type === 'Identifier' ? p.key.name : p.key.type === 'Literal' ? String(p.key.value) : '');
}
const LETRAS = /[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]{2}/;
/** ¿Parece texto para leer (y no un identificador, una clase, una ruta o un selector)? */
function legible(s) {
  if (typeof s !== 'string' || !LETRAS.test(s)) return false;
  if (/^(#|\.|\/|https?:|data:|mailto:|whider\.|[a-z]+:\/\/)/.test(s)) return false;
  if (/^(url|rgba?|hsla?|var|calc|translate|rotate|scale|minmax|repeat)\(/.test(s)) return false;
  // Marcado que no es texto (un SVG) y siglas que se dicen igual en todos los idiomas (CSV, JSON, PDF)
  if (/^<(svg|path|polyline|use|g)\b/.test(s) || /^[A-Z]{2,5}$/.test(s)) return false;
  if (
    /^[a-z][a-zA-Z0-9_-]*$/.test(s) &&
    !/^(sí|no|de|y|o|ok|hoy|ayer|nada|todas|todos|ninguno|ninguna|nunca|siempre|ahora|antes|después|mañana)$/.test(s)
  )
    return false;
  if (/^[a-z0-9_-]+(\.[a-z0-9_-]+)+$/.test(s)) return false;
  if (/^[a-z]+\[[^\]]*\]$/.test(s)) return false;
  return true;
}
/** Texto de un literal o de una plantilla sin variables */
function literal(n) {
  if (n.type === 'Literal' && typeof n.value === 'string') return n.value;
  if (n.type === 'TemplateLiteral' && n.expressions.length === 0) return n.quasis[0].value.cooked;
  return null;
}
const comillas = (s) => "'" + s.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n') + "'";

/* ---------- Claves usadas ---------- */
function usadas(lista) {
  /** @type {Map<string, string>} clave → primer archivo */
  const keys = new Map();
  const dinamicas = [];
  for (const f of archivos(lista).filter((x) => x.endsWith('.js'))) {
    const src = leer(f);
    walk.simple(arbol(src, f), {
      CallExpression(n) {
        const c = nombre(n.callee);
        let pos = null;
        if (c === 'W.t' || c === 'W.tk' || c === 'W.tp' || c === 'tr') pos = [0];
        else if (c === 'W.tn') pos = [1, 2];
        else if (/(^|\.)plural$/.test(c) || /U2\(\)\.plural$/.test(c)) pos = [1, 2];
        if (!pos) return;
        for (const i of pos) {
          const a = n.arguments[i];
          if (!a) continue;
          const s = literal(a);
          if (s != null) {
            if (!keys.has(s)) keys.set(s, f);
          } else if (c === 'W.t' || c === 'W.tk' || c === 'W.tp') dinamicas.push(f + ':' + a.loc.start.line);
        }
      }
    });
  }
  if (!lista || !lista.length || lista.includes('index.html'))
    for (const s of fijos()) if (!keys.has(s)) keys.set(s, 'index.html');
  return { keys, dinamicas };
}
/** Textos fijos de index.html (los traduce W.I18n.dom al arrancar): nodos de texto y aria-label, title, placeholder */
function fijos() {
  const html = fs
    .readFileSync(path.join(RAIZ, 'index.html'), 'utf8')
    .replace(/<script[\s\S]*?<\/script>/g, '')
    .replace(/<svg[\s\S]*?<\/svg>/g, '')
    .replace(/<head>[\s\S]*?<\/head>/, '');
  const out = new Set();
  for (const m of html.matchAll(/(?:aria-label|title|placeholder|alt)="([^"]+)"/g)) if (legible(m[1])) out.add(m[1]);
  for (const m of html.matchAll(/>([^<>]+)</g)) {
    const s = m[1].trim();
    if (s && legible(s)) out.add(s);
  }
  return [...out];
}
function catalogo() {
  const W = { I18n: { add: (l, d) => Object.assign(dic, d) } };
  const dic = {};
  if (fs.existsSync(CATALOGO))
    vm.runInNewContext(fs.readFileSync(CATALOGO, 'utf8'), { window: { Whider: W } }, { filename: CATALOGO });
  return dic;
}

/* ---------- Envolver ---------- */
function envolver(f) {
  const src = leer(f);
  const ast = arbol(src, f);
  const cambios = [];
  const ya = []; // rangos ya dentro de W.t / W.tn / W.tk / U.plural
  walk.simple(ast, {
    CallExpression(n) {
      const c = nombre(n.callee);
      if (/^(W\.t|W\.tn|W\.tk|W\.tp|tr)$/.test(c) || /(^|\.)plural$/.test(c)) ya.push([n.start, n.end]);
    }
  });
  const dentro = (n) => ya.some(([a, b]) => n.start >= a && n.end <= b);
  /** Convierte una expresión de texto (literal, condicional, concatenación) */
  function texto(n) {
    if (!n || dentro(n)) return;
    const s = literal(n);
    if (s != null) {
      if (legible(s)) cambios.push([n.start, n.end, 'W.t(' + comillas(s) + ')']);
      return;
    }
    if (n.type === 'ConditionalExpression') {
      texto(n.consequent);
      texto(n.alternate);
      return;
    }
    if (n.type === 'LogicalExpression' && (n.operator === '||' || n.operator === '??')) {
      texto(n.right);
      return;
    }
    if (n.type === 'BinaryExpression' && n.operator === '+') concat(n);
  }
  /** 'Guardado en ' + r.path → W.t('Guardado en {path}', { path: r.path }) */
  function concat(n) {
    const partes = [];
    // Solo se separa lo que de verdad es concatenación de texto: «a + b + ' x'» suma a y b antes de añadir el texto, y
    // lo que va entre paréntesis a la derecha («'Pestaña ' + (i + 1)») es una sola parte
    const esTexto = (x) =>
      literal(x) != null ||
      (x.type === 'BinaryExpression' && x.operator === '+' && (esTexto(x.left) || esTexto(x.right)));
    (function aplanar(x) {
      if (x.type === 'BinaryExpression' && x.operator === '+' && esTexto(x)) {
        if (esTexto(x.left)) aplanar(x.left);
        else partes.push(x.left);
        partes.push(x.right);
      } else partes.push(x);
    })(n);
    const textos = partes.filter((p) => literal(p) != null);
    if (!textos.length || !textos.some((p) => legible(literal(p)))) return;
    // Si alguna parte ya es texto traducido o un plural, o lleva texto dentro (condiciones), se deja para hacerlo a mano
    if (partes.some((p) => p.type === 'CallExpression' && /^(W\.t|W\.tn|W\.tp|tr)$|plural$/.test(nombre(p.callee))))
      return;
    const conTexto = (x) => {
      let hay = false;
      walk.full(x, (m) => {
        if (literal(m) != null && legible(literal(m))) hay = true;
      });
      return hay;
    };
    if (partes.some((p) => literal(p) == null && conTexto(p))) return;
    const usados = new Set(),
      vars = [],
      porCodigo = new Map();
    let k = '';
    for (const p of partes) {
      const s = literal(p);
      if (s != null) {
        k += s.replace(/\{/g, '(').replace(/\}/g, ')');
        continue;
      }
      const codigo = src.slice(p.start, p.end);
      if (porCodigo.has(codigo)) {
        k += '{' + porCodigo.get(codigo) + '}';
        continue;
      }
      let v = p.type === 'Identifier' ? p.name : p.type === 'MemberExpression' && !p.computed ? p.property.name : '';
      if (!/^[A-Za-z]\w{0,15}$/.test(v) || usados.has(v)) {
        let i = 0;
        while (usados.has(String(i))) i++;
        v = String(i);
      }
      usados.add(v);
      porCodigo.set(codigo, v);
      vars.push(v + ': ' + codigo);
      k += '{' + v + '}';
    }
    cambios.push([n.start, n.end, 'W.t(' + comillas(k) + ', { ' + vars.join(', ') + ' })']);
  }
  walk.ancestor(ast, {
    Property(n) {
      if (CLAVES.has(clave(n)) && !n.computed) texto(n.value);
    },
    CallExpression(n) {
      const c = nombre(n.callee);
      if (ARGS[c] && c !== 'U.plural' && c !== 'W.tn') ARGS[c].forEach((i) => texto(n.arguments[i]));
      // Hijos de U.el(…, [ 'texto', … ]): nodos de texto
      if (c === 'U.el' || c === 'el')
        n.arguments.forEach((a) => {
          if (a.type === 'ArrayExpression') a.elements.forEach((e) => e && texto(e));
        });
      // setAttribute('aria-label' | 'title' | 'placeholder', 'texto')
      if (/\.setAttribute$/.test(c) && n.arguments.length === 2) {
        const a0 = literal(n.arguments[0]);
        if (a0 && /^(aria-label|title|placeholder|alt)$/.test(a0)) texto(n.arguments[1]);
      }
    },
    AssignmentExpression(n) {
      if (
        n.left.type === 'MemberExpression' &&
        !n.left.computed &&
        /^(textContent|innerText|title|placeholder)$/.test(/** @type {any} */ (n.left.property).name)
      )
        texto(n.right);
    }
  });
  // Sin solapes: se aplican de atrás adelante
  cambios.sort((a, b) => b[0] - a[0]);
  let out = src,
    ultimo = Infinity,
    n = 0;
  for (const [a, b, r] of cambios) {
    if (b > ultimo) continue;
    out = out.slice(0, a) + r + out.slice(b);
    ultimo = a;
    n++;
  }
  if (n) fs.writeFileSync(path.join(RAIZ, f), out);
  return n;
}

/* ---------- Envolver los textos de una tabla de datos ---------- */
/** Envuelve en W.t los textos legibles de la variable `nombreVar` (su valor inicial: tablas de preguntas, plantillas…) */
function envolverDatos(f, nombreVar, minimo) {
  const src = leer(f);
  const ast = arbol(src, f);
  let objetivo = null;
  walk.simple(ast, {
    VariableDeclarator(n) {
      if (n.id && n.id.type === 'Identifier' && n.id.name === nombreVar && n.init) objetivo = n.init;
    }
  });
  if (!objetivo) throw new Error(f + ': no hay ninguna variable «' + nombreVar + '»');
  const ya = [];
  walk.simple(objetivo, {
    CallExpression(n) {
      if (/^(W\.t|W\.tn|W\.tk|W\.tp|tr)$/.test(nombre(n.callee))) ya.push([n.start, n.end]);
    }
  });
  const cambios = [];
  walk.simple(objetivo, {
    Literal(n) {
      if (typeof n.value !== 'string' || ya.some(([x, y]) => n.start >= x && n.end <= y)) return;
      if (!legible(n.value) || /[<>=]/.test(n.value) || !new RegExp('[a-záéíóúñ]{' + (minimo || 2) + '}').test(n.value))
        return;
      cambios.push([n.start, n.end, 'W.t(' + comillas(n.value) + ')']);
    }
  });
  cambios.sort((x, y) => y[0] - x[0]);
  let out = src;
  for (const [x, y, r] of cambios) out = out.slice(0, x) + r + out.slice(y);
  if (cambios.length) fs.writeFileSync(path.join(RAIZ, f), out);
  return cambios.length;
}

/* ---------- Pendientes (aproximado) ---------- */
function pendientes(lista) {
  const out = [];
  for (const f of archivos(lista)) {
    const src = leer(f);
    const ast = arbol(src, f);
    const ya = [];
    walk.simple(ast, {
      CallExpression(n) {
        const c = nombre(n.callee);
        if (
          /^(W\.t|W\.tn|W\.tk|W\.tp|tr|console\.\w+)$/.test(c) ||
          /(^|\.)plural$/.test(c) ||
          /querySelector|getItem|setItem|removeItem|addEventListener|classList|getAttribute|setAttribute|matchMedia|RegExp|test|indexOf|split|replace|match/.test(
            c
          )
        )
          ya.push([n.start, n.end]);
      }
    });
    // Lo que el código compara (teclas, tipos…) o usa en un «case» no se enseña
    walk.simple(ast, {
      BinaryExpression(n) {
        if (/^(===|!==|==|!=|in)$/.test(n.operator)) ya.push([n.start, n.end]);
      },
      SwitchCase(n) {
        if (n.test) ya.push([n.test.start, n.test.end]);
      },
      Property(n) {
        if (n.key && n.key.type === 'Literal') ya.push([n.key.start, n.key.end]);
      }
    });
    const API =
      /^(Date|Object|Array|Promise|Error|Number|String|Boolean|Math|JSON|Intl|Enter|Escape|Tab|Backspace|Delete|Space|Home|End|Shift|Control|Alt|Meta|ArrowUp|ArrowDown|ArrowLeft|ArrowRight|PageUp|PageDown|Bearer|WHIDER|Whider|Chrome|Android|Windows|Linux|Firefox|Safari|Edge|Electron|Google|Microsoft|Notion|Todoist|GitHub|Firebase|Firestore)$/;
    walk.simple(ast, {
      Literal(n) {
        if (typeof n.value !== 'string' || !legible(n.value) || ya.some(([a, b]) => n.start >= a && n.end <= b)) return;
        // Marcado (SVG, HTML, estilos) y clases sueltas no son texto
        if (/[<>=]/.test(n.value) || (/^ ?[a-z0-9-]+$/.test(n.value) && !/[áéíóúñ]/.test(n.value))) return;
        // Frases: con espacios y alguna letra en minúscula, o con tildes, eñes o signos de apertura; o una palabra con
        // mayúscula («Vencidas», «Hoy»), salvo nombres del lenguaje, de teclas o de marcas
        const palabra = /^[A-ZÁÉÍÓÚÑ][a-záéíóúñü]+$/.test(n.value) && !API.test(n.value);
        if (!palabra && !(/\s/.test(n.value) && /[a-záéíóúñ]/.test(n.value)) && !/[áéíóúñ¿¡]/i.test(n.value)) return;
        if (
          /^([a-z0-9-]+ )+[a-z0-9-]+$/.test(n.value) &&
          !/[áéíóúñ]/.test(n.value) &&
          !/\b(de|la|el|en|con|sin|para|por|y|un|una|los|las|del|al|tu|tus|se|que|no|más)\b/.test(n.value)
        )
          return;
        out.push(f + ':' + n.loc.start.line + '  ' + JSON.stringify(n.value).slice(0, 110));
      }
    });
  }
  return out;
}

/* ---------- Órdenes ---------- */
const [orden, ...resto] = process.argv.slice(2);
const opciones = resto.filter((a) => a.startsWith('--')),
  lista = resto.filter((a) => !a.startsWith('--'));
if (orden === 'faltan') {
  const { keys } = usadas(lista);
  const dic = catalogo();
  const porArchivo = {};
  for (const [k, f] of keys)
    if (!Object.prototype.hasOwnProperty.call(dic, k)) (porArchivo[f] = porArchivo[f] || []).push(k);
  let total = 0;
  for (const f of Object.keys(porArchivo)) {
    console.log('  // ' + f);
    for (const k of porArchivo[f]) {
      console.log('  ' + comillas(k) + ": '',");
      total++;
    }
  }
  console.error(total ? total + ' textos sin traducir' : 'Todo traducido (' + keys.size + ' textos)');
  if (total && opciones.includes('--estricto')) process.exit(1);
} else if (orden === 'sobran') {
  const { keys } = usadas();
  const sobran = Object.keys(catalogo()).filter((k) => !keys.has(k));
  sobran.forEach((k) => console.log(comillas(k)));
  console.error(sobran.length + ' claves sin usar (algunas pueden usarse con W.t(variable): revísalas)');
} else if (orden === 'pendientes') {
  const p = pendientes(lista);
  p.forEach((l) => console.log(l));
  console.error(p.length + ' textos que parecen de la interfaz sin W.t');
} else if (orden === 'envolver') {
  if (!lista.length) {
    console.error('Indica los archivos');
    process.exit(2);
  }
  for (const f of lista) console.log(f + ': ' + envolver(f.replace(/^\.\//, '')) + ' textos envueltos');
} else if (orden === 'datos') {
  // node tools/i18n.js datos archivo VARIABLE [VARIABLE…]: los textos de esas tablas de datos
  const [f, ...vars] = lista;
  if (!f || !vars.length) {
    console.error('Uso: node tools/i18n.js datos archivo VARIABLE…');
    process.exit(2);
  }
  for (const v of vars)
    console.log(f + ' · ' + v + ': ' + envolverDatos(f.replace(/^\.\//, ''), v) + ' textos envueltos');
} else if (orden === 'resumen') {
  const { keys, dinamicas } = usadas();
  const dic = catalogo();
  const hechas = [...keys.keys()].filter((k) => Object.prototype.hasOwnProperty.call(dic, k)).length;
  console.log(
    'Textos envueltos: ' +
      keys.size +
      ' · traducidos: ' +
      hechas +
      ' · en el catálogo: ' +
      Object.keys(dic).length +
      ' · W.t con variable: ' +
      dinamicas.length
  );
  console.log('Sin envolver (aproximado): ' + pendientes().length);
} else {
  console.log(fs.readFileSync(__filename, 'utf8').split('\n').slice(2, 16).join('\n'));
  process.exit(orden ? 2 : 0);
}
