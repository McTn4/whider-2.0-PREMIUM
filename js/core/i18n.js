// @ts-check
/**
 * WHIDER · Idiomas (ver docs/decisiones/0003-idiomas.md)
 *
 *  - W.t('Texto en español', { n: 3 }): el propio texto en español es la clave. En otro idioma se busca en su
 *    catálogo (js/i18n/<idioma>.js) y, si falta, se queda en español. {nombre} se sustituye por vars.nombre.
 *  - W.tn(n, 'una tarea', '{n} tareas'): plurales con las reglas de cada idioma (Intl.PluralRules). U.plural ya
 *    traduce sus dos formas, así que sus llamadas no cambian.
 *  - El catálogo solo se descarga si se usa ese idioma, antes de pintar la app (W.I18n.ready()).
 *  - El idioma se guarda en este dispositivo (whider.lang). Mientras el inglés no cubra toda la app, no se ofrece en
 *    Ajustes: se prueba abriendo la app con ?lang=en (y ?lang=es para volver).
 *  - Con otro idioma, lo que se pide y no está en su catálogo se apunta (W.I18n.missing()): lo usan las pruebas.
 */
window.Whider = window.Whider || {};

(function (W) {
  'use strict';
  var KEY = 'whider.lang', SUPPORTED = ['es', 'en'], LOCALES = { es: 'es-ES', en: 'en-US' };
  /** @type {Record<string, Record<string, string> | null>} */
  var catalogs = { es: null };
  /** @type {Record<string, Promise<void>>} */
  var loading = {};
  /** @type {Record<string, number>} */
  var misses = {};
  /** @type {Record<string, any>} */
  var cache = {};
  var has = Object.prototype.hasOwnProperty;

  function stored() { try { return localStorage.getItem(KEY) || ''; } catch (e) { return ''; } }
  // ?lang=en o ?lang=es en la dirección (para probar): se recuerda en este dispositivo
  try {
    var q = /[?&]lang=([a-z]{2})(?:&|$)/.exec(location.search);
    if (q && SUPPORTED.indexOf(q[1]) >= 0) localStorage.setItem(KEY, q[1]);
  } catch (e) { /* sin almacenamiento */ }
  var pref = stored();
  var lang = SUPPORTED.indexOf(pref) >= 0 ? pref : 'es';
  try { document.documentElement.lang = lang; } catch (e) { /* sin documento (pruebas) */ }
  // En otro idioma, su catálogo se carga justo detrás de este archivo y antes que el resto de la app (hay textos que los
  // módulos preparan al cargarse). En español no se descarga nada. Si no pudiera, ready() lo carga después.
  try {
    if (lang !== 'es' && document.readyState === 'loading') document.write('<script src="js/i18n/' + lang + '.js"></scr' + 'ipt>');
  } catch (e) { /* lo carga ready() */ }

  /** Sustituye {clave} por vars.clave (lo que no está en vars se queda como está) */
  function fill(s, vars) {
    if (!vars) return s;
    return String(s).replace(/\{(\w+)\}/g, function (m, k) { return vars[k] != null ? String(vars[k]) : m; });
  }
  /** Texto en el idioma de la app (la clave es el texto en español) */
  function t(es, vars) {
    if (es == null) return '';
    var c = catalogs[lang];
    if (!c) return fill(es, vars);
    if (has.call(c, es)) return fill(c[es], vars);
    misses[es] = (misses[es] || 0) + 1;
    return fill(es, vars);
  }
  /** Forma del plural de n en el idioma de la app: 'one' u 'other' (las demás formas se tratan como 'other') */
  function form(n) {
    try {
      cache.pr = cache.pr || new Intl.PluralRules(LOCALES[lang]);
      return cache.pr.select(n) === 'one' ? 'one' : 'other';
    } catch (e) { return n === 1 ? 'one' : 'other'; }
  }
  /** Plural: W.tn(3, 'una tarea', '{n} tareas') → «3 tareas» / «3 tasks» */
  function tn(n, one, other, vars) {
    return t(form(n) === 'one' ? one : other, Object.assign({ n: n }, vars || {}));
  }
  /**
   * Frase con elementos dentro: W.tp('Acepto la {link}', { link: nodo }) → ['Acepto la ', nodo], para U.el. Así el
   * orden de las palabras lo decide cada idioma y el enlace (o la negrita) no parte la frase en trozos sin traducir.
   */
  function tp(es, parts) {
    var s = t(es), out = [], re = /\{(\w+)\}/g, last = 0, m;
    while ((m = re.exec(s))) {
      if (m.index > last) out.push(s.slice(last, m.index));
      var v = parts ? parts[m[1]] : null;
      out.push(v == null ? m[0] : typeof v === 'object' ? v : String(v));
      last = re.lastIndex;
    }
    if (last < s.length) out.push(s.slice(last));
    return out;
  }
  /** Descarga el catálogo de un idioma (una vez); si no se puede, la app sigue en español */
  function load(l) {
    if (l === 'es' || catalogs[l]) return Promise.resolve();
    if (has.call(loading, l)) return loading[l];
    loading[l] = new Promise(function (resolve) {
      var s = document.createElement('script');
      s.src = 'js/i18n/' + l + '.js';
      s.onload = function () { if (!catalogs[l]) catalogs[l] = {}; resolve(); };
      s.onerror = function () { console.warn('Idioma: no se pudo cargar «' + l + '»; sigue en español'); lang = 'es'; try { document.documentElement.lang = 'es'; } catch (e) { /* sin documento */ } resolve(); };
      document.head.appendChild(s);
    });
    return loading[l];
  }

  var I18n = {
    SUPPORTED: SUPPORTED,
    /** Idioma de la app: 'es' o 'en' */
    get lang() { return lang; },
    /** Etiqueta para Intl (es-ES, en-US) */
    get locale() { return LOCALES[lang]; },
    t: t,
    tn: tn,
    tp: tp,
    form: form,
    /** Se resuelve cuando el catálogo del idioma está cargado (al momento en español) */
    ready: function () { return load(lang); },
    /** Lo usan los catálogos: W.I18n.add('en', { 'Hoy': 'Today', … }) */
    add: function (l, dict) { catalogs[l] = Object.assign(catalogs[l] || {}, dict); },
    /** ¿Hay traducción para este texto? */
    has: function (es) { var c = catalogs[lang]; return !c || has.call(c, es); },
    /** Cambia el idioma de este dispositivo (la app se vuelve a abrir para aplicarlo) */
    set: function (l, reload) {
      if (SUPPORTED.indexOf(l) < 0) return;
      try { localStorage.setItem(KEY, l); } catch (e) { /* sin almacenamiento */ }
      if (reload !== false) location.reload();
    },
    /**
     * Traduce los textos fijos de la página (index.html: la barra inferior, las etiquetas de cada pantalla…): nodos de
     * texto y los atributos aria-label, title, placeholder y alt que estén en el catálogo. Solo al arrancar, sobre el
     * esqueleto de la app (nunca sobre lo que escribe el usuario).
     */
    dom: function (root) {
      var c = catalogs[lang];
      if (!c || !root || !root.querySelectorAll) return;
      var tw = document.createTreeWalker(root, 4 /* NodeFilter.SHOW_TEXT */), n;
      while ((n = tw.nextNode())) {
        var s = (n.nodeValue || '').trim();
        if (s && has.call(c, s)) n.nodeValue = (n.nodeValue || '').replace(s, c[s]);
      }
      Array.prototype.forEach.call(root.querySelectorAll('[aria-label],[title],[placeholder],[alt]'), function (el) {
        ['aria-label', 'title', 'placeholder', 'alt'].forEach(function (a) { var v = el.getAttribute(a); if (v && has.call(c, v)) el.setAttribute(a, c[v]); });
      });
    },
    /** Textos pedidos en este idioma que no están en su catálogo (para las pruebas) */
    missing: function () { return Object.keys(misses); },
    /** Formato de fecha con Intl en el idioma de la app (con caché por opciones) */
    date: function (d, opts) {
      var k = 'd' + JSON.stringify(opts || {});
      try {
        cache[k] = cache[k] || new Intl.DateTimeFormat(LOCALES[lang], opts);
        return cache[k].format(d);
      } catch (e) { return d.toDateString(); }
    },
    /** Número con separadores del idioma */
    number: function (n, opts) {
      var k = 'n' + JSON.stringify(opts || {});
      try {
        cache[k] = cache[k] || new Intl.NumberFormat(LOCALES[lang], opts);
        return cache[k].format(n);
      } catch (e) { return String(n); }
    }
  };
  W.I18n = I18n;
  W.t = t;
  W.tn = tn;
  W.tp = tp;
})(window.Whider);
