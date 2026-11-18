// @ts-check
// Carga los scripts clásicos de la app (los que cuelgan de window.Whider) en un contexto aislado de
// Node, con lo mínimo del navegador: así se prueba la lógica sin abrir Chromium.
//   const W = cargar(['js/core/util.js', 'js/core/parse.js'], { ahora: '2026-11-16T09:40:00' });
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const RAIZ = path.join(__dirname, '..', '..');
// Zona horaria con cambio de hora (si no se elige otra) para que las pruebas de fechas lo cubran
if (!process.env.TZ) process.env.TZ = 'Europe/Madrid';

function almacen() {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => {
      m.set(k, String(v));
    },
    removeItem: (k) => {
      m.delete(k);
    },
    clear: () => m.clear(),
    key: (i) => [...m.keys()][i] || null,
    get length() {
      return m.size;
    }
  };
}

/** Date con el «ahora» fijo (el resto de constructores se comporta igual) */
function relojFijo(iso) {
  const fijo = new Date(iso).getTime();
  class FDate extends Date {
    constructor(...a) {
      if (a.length) super(.../** @type {[any]} */ (a));
      else super(fijo);
    }
    static now() {
      return fijo;
    }
  }
  return FDate;
}

function cargar(archivos, opts = {}) {
  const ua =
    opts.ua || 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';
  const nodo = () => ({
    style: {},
    classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
    setAttribute() {},
    appendChild() {},
    addEventListener() {}
  });
  const win = {
    console,
    // Los temporizadores no deben retener el proceso de pruebas
    setTimeout: (f, ms, ...x) => {
      const t = setTimeout(f, ms, ...x);
      t.unref();
      return t;
    },
    setInterval: (f, ms, ...x) => {
      const t = setInterval(f, ms, ...x);
      t.unref();
      return t;
    },
    clearTimeout,
    clearInterval,
    localStorage: almacen(),
    sessionStorage: almacen(),
    navigator: {
      userAgent: ua,
      platform: opts.platform || '',
      language: 'es-ES',
      maxTouchPoints: opts.touch || 0,
      onLine: true
    },
    location: {
      href: 'http://127.0.0.1/app',
      origin: 'http://127.0.0.1',
      protocol: 'http:',
      hash: '',
      search: '',
      pathname: '/app'
    },
    matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent() {
      return true;
    },
    document: {
      documentElement: nodo(),
      body: nodo(),
      head: nodo(),
      createElement: nodo,
      createElementNS: nodo,
      createTextNode: nodo,
      querySelector: () => null,
      querySelectorAll: () => [],
      getElementById: () => null,
      addEventListener() {},
      visibilityState: 'visible',
      hidden: false
    },
    Intl,
    JSON,
    Math,
    Promise,
    URL,
    URLSearchParams,
    TextEncoder,
    TextDecoder,
    structuredClone,
    Uint8Array,
    crypto: opts.sinCrypto ? undefined : globalThis.crypto,
    Date: opts.ahora ? relojFijo(opts.ahora) : Date
  };
  win.window = win;
  win.self = win;
  win.globalThis = win;
  const ctx = vm.createContext(win);
  for (const f of archivos) {
    const codigo = fs.readFileSync(path.join(RAIZ, f), 'utf8');
    vm.runInContext(codigo, ctx, { filename: f });
  }
  // La ventana simulada queda a mano (localStorage, temporizadores…) sin estorbar al recorrer Whider
  if (win.Whider) Object.defineProperty(win.Whider, '__win', { value: win });
  return win.Whider || win;
}

module.exports = { cargar, RAIZ };
