// @ts-check
/**
 * WHIDER · Utilidades compartidas (DOM, fechas, formato, iconos)
 */
window.Whider = window.Whider || {};

(function (W) {
  'use strict';

  var SVG_NS = 'http://www.w3.org/2000/svg';
  var A36 = 'abcdefghijklmnopqrstuvwxyz0123456789';
  /**
   * n caracteres al azar de un alfabeto, con el generador criptográfico del navegador (sin sesgo: se
   * descartan los bytes que no caben un número entero de veces). Sin crypto, Math.random.
   * @param {number} n
   * @param {string} [alphabet]
   */
  function randomChars(n, alphabet) {
    var A = alphabet || A36, out = '', max = 256 - (256 % A.length);
    var c = /** @type {any} */ (window).crypto || /** @type {any} */ (window).msCrypto;
    while (out.length < n) {
      var buf = new Uint8Array(Math.max(8, (n - out.length) * 2));
      try { c.getRandomValues(buf); } catch (e) { for (var k = 0; k < buf.length; k++) buf[k] = Math.floor(Math.random() * 256); }
      for (var i = 0; i < buf.length && out.length < n; i++) if (buf[i] < max) out += A.charAt(buf[i] % A.length);
    }
    return out;
  }
  // Contador de la sesión: dos identificadores creados en el mismo milisegundo (al importar cientos de
  // tareas, por ejemplo) nunca coinciden; el azar los separa de los de otros dispositivos.
  var uidSeq = Math.floor(Math.random() * 1296);
  // Idioma de la app (js/core/i18n.js): en inglés, nombres de meses y días y formatos de fecha propios
  var EN = !!(W.I18n && W.I18n.lang === 'en');
  var tr = function (/** @type {string} */ s, /** @type {any} */ v) { return W.t ? W.t(s, v) : s; };
  var MONTHS = EN ? ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
    : ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  var MONTHS_SHORT = EN ? ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] : ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  var WEEKDAYS = EN ? ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] : ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
  var WEEKDAYS_SHORT = EN ? ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] : ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
  var WEEKDAYS_LETTER = EN ? ['S', 'M', 'T', 'W', 'T', 'F', 'S'] : ['D', 'L', 'M', 'X', 'J', 'V', 'S'];

  function pad(n) { return n < 10 ? '0' + n : '' + n; }
  function cap(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }

  var U = {
    MONTHS: MONTHS,
    MONTHS_SHORT: MONTHS_SHORT,
    WEEKDAYS_SHORT: WEEKDAYS_SHORT,
    WEEKDAYS_LETTER: WEEKDAYS_LETTER,
    WEEKDAYS: WEEKDAYS,

    /* ---------- DOM ---------- */
    $: function (sel, root) { return (root || document).querySelector(sel); },
    $$: function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); },

    /**
     * Crea un elemento: el('div.card.hero', {text, html, on:{click}, attrs:{}, style:{}}, [hijos])
     */
    el: function (spec, opts, children) {
      var parts = spec.split('.');
      var tag = parts.shift() || 'div';
      var node = document.createElement(tag);
      if (parts.length) node.className = parts.join(' ');
      if (Array.isArray(opts) || (opts && opts.nodeType)) { children = opts; opts = null; }
      opts = opts || {};
      if (opts.cls) node.className += (node.className ? ' ' : '') + opts.cls;
      if (opts.text != null) node.textContent = opts.text;
      if (opts.html != null) node.innerHTML = opts.html;
      if (opts.attrs) Object.keys(opts.attrs).forEach(function (k) {
        var v = opts.attrs[k];
        if (v === false || v == null) return;
        node.setAttribute(k, v === true ? '' : v);
      });
      if (opts.style) Object.keys(opts.style).forEach(function (k) {
        if (k.indexOf('--') === 0) node.style.setProperty(k, opts.style[k]);
        else node.style[k] = opts.style[k];
      });
      if (opts.on) Object.keys(opts.on).forEach(function (ev) { node.addEventListener(ev, opts.on[ev]); });
      if (tag === 'button' && !(opts.attrs && opts.attrs.type)) node.type = 'button';
      U.append(node, children);
      return node;
    },

    append: function (node, children) {
      if (children == null) return node;
      if (!Array.isArray(children)) children = [children];
      children.forEach(function (c) {
        if (c == null || c === false) return;
        node.appendChild(typeof c === 'string' || typeof c === 'number' ? document.createTextNode(String(c)) : c);
      });
      return node;
    },

    clear: function (node) { while (node && node.firstChild) node.removeChild(node.firstChild); return node; },

    /** Icono del sprite SVG de index.html */
    icon: function (name, cls) {
      var svg = document.createElementNS(SVG_NS, 'svg');
      svg.setAttribute('class', 'ic' + (cls ? ' ' + cls : ''));
      svg.setAttribute('aria-hidden', 'true');
      svg.setAttribute('focusable', 'false');
      var use = document.createElementNS(SVG_NS, 'use');
      use.setAttribute('href', '#i-' + name);
      svg.appendChild(use);
      return svg;
    },

    svg: function (tag, attrs, children) {
      var n = document.createElementNS(SVG_NS, tag);
      Object.keys(attrs || {}).forEach(function (k) { n.setAttribute(k, attrs[k]); });
      (children || []).forEach(function (c) { n.appendChild(c); });
      return n;
    },

    /* ---------- Fechas (cadenas YYYY-MM-DD en hora local) ---------- */
    pad: pad,
    cap: cap,
    ymd: function (d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); },
    parse: function (s) { var p = s.split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); },
    today: function () { return U.ymd(new Date()); },
    nowHM: function () { var n = new Date(); return pad(n.getHours()) + ':' + pad(n.getMinutes()); },
    addDays: function (s, n) { var d = U.parse(s); d.setDate(d.getDate() + n); return U.ymd(d); },
    addMonths: function (s, n) {
      var d = U.parse(s), day = d.getDate();
      d.setDate(1); d.setMonth(d.getMonth() + n);
      var last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
      d.setDate(Math.min(day, last));
      return U.ymd(d);
    },
    diffDays: function (a, b) { return Math.round((U.parse(b).getTime() - U.parse(a).getTime()) / 86400000); },
    weekday: function (s) { return U.parse(s).getDay(); },
    /** Marca de tiempo del plazo: con hora → esa hora; sin hora → fin del día */
    deadlineTs: function (date, time) {
      var d = U.parse(date);
      if (time) { var p = time.split(':'); d.setHours(+p[0], +p[1], 0, 0); } else d.setHours(23, 59, 59, 999);
      return d.getTime();
    },
    hmToMin: function (hm) { var p = hm.split(':'); return (+p[0]) * 60 + (+p[1]); },

    /* ---------- Formato ---------- */
    fmtTime: function (hm) {
      if (!hm) return '';
      if (!W.State || W.State.settings.timeFormat !== '12') return hm;
      var p = hm.split(':'), h = +p[0];
      return ((h % 12) || 12) + ':' + p[1] + (EN ? (h < 12 ? ' AM' : ' PM') : (h < 12 ? ' a. m.' : ' p. m.'));
    },
    /** «Lunes, 3 de marzo» / «Monday, March 3» */
    fmtLong: function (s) {
      var d = U.parse(s);
      if (EN) return WEEKDAYS[d.getDay()] + ', ' + MONTHS[d.getMonth()] + ' ' + d.getDate();
      return cap(WEEKDAYS[d.getDay()]) + ', ' + d.getDate() + ' de ' + MONTHS[d.getMonth()];
    },
    /** «lun 3 mar» / «Mon, Mar 3» */
    fmtShort: function (s) {
      var d = U.parse(s);
      if (EN) return WEEKDAYS_SHORT[d.getDay()] + ', ' + MONTHS_SHORT[d.getMonth()] + ' ' + d.getDate();
      return WEEKDAYS_SHORT[d.getDay()].toLowerCase() + ' ' + d.getDate() + ' ' + MONTHS_SHORT[d.getMonth()];
    },
    fmtMonth: function (y, m) { return cap(MONTHS[m]) + ' ' + y; },
    /** «Jueves, 19 de noviembre 2026» / «Thursday, November 19, 2026» */
    fmtLongYear: function (s) { return U.fmtLong(s) + (EN ? ', ' : ' ') + U.parse(s).getFullYear(); },
    /** «16 de noviembre» / «November 16» */
    fmtDayMonth: function (s) { var d = U.parse(s); return EN ? MONTHS[d.getMonth()] + ' ' + d.getDate() : d.getDate() + ' de ' + MONTHS[d.getMonth()]; },
    /** «20 de noviembre de 2026» / «November 20, 2026» */
    fmtDate: function (s) { return U.fmtDayMonth(s) + (EN ? ', ' : ' de ') + U.parse(s).getFullYear(); },
    /** «Del 14 de noviembre al 20 de noviembre de 2026» / «November 14 – November 20, 2026» (el primer año, solo si es otro) */
    fmtSpan: function (from, to) {
      var a = U.parse(from), b = U.parse(to), otherYear = a.getFullYear() !== b.getFullYear();
      if (EN) return U.fmtDayMonth(from) + (otherYear ? ', ' + a.getFullYear() : '') + ' – ' + U.fmtDayMonth(to) + ', ' + b.getFullYear();
      return 'Del ' + U.fmtDayMonth(from) + (otherYear ? ' de ' + a.getFullYear() : '') + ' al ' + U.fmtDayMonth(to) + ' de ' + b.getFullYear();
    },
    /** «1 nov» / «Nov 1» */
    fmtDayMon: function (s) { var d = U.parse(s); return EN ? MONTHS_SHORT[d.getMonth()] + ' ' + d.getDate() : d.getDate() + ' ' + MONTHS_SHORT[d.getMonth()]; },
    /** Una hora en punto para la regla del calendario: «15:00», «3 p. m.» o «3 PM» */
    fmtHour: function (h) {
      if (!W.State || W.State.settings.timeFormat !== '12') return pad(h) + ':00';
      return ((h % 12) || 12) + (EN ? (h < 12 ? ' AM' : ' PM') : (h < 12 ? ' a. m.' : ' p. m.'));
    },
    /**
     * Una semana: «16 – 22 noviembre» (con el año, «16 – 22 de noviembre 2026»), «30 nov – 6 dic»; en inglés
     * «November 16 – 22» (con el año, «November 16 – 22, 2026») y «Nov 30 – Dec 6»
     */
    fmtRange: function (a, z, withYear) {
      var x = U.parse(a), y = U.parse(z), same = x.getMonth() === y.getMonth(), yr = withYear ? y.getFullYear() : null;
      if (EN) {
        var r = same ? MONTHS[y.getMonth()] + ' ' + x.getDate() + ' – ' + y.getDate()
          : MONTHS_SHORT[x.getMonth()] + ' ' + x.getDate() + ' – ' + MONTHS_SHORT[y.getMonth()] + ' ' + y.getDate();
        return yr ? r + ', ' + yr : r;
      }
      if (same) return x.getDate() + ' – ' + y.getDate() + (yr ? ' de ' : ' ') + MONTHS[y.getMonth()] + (yr ? ' ' + yr : '');
      return x.getDate() + ' ' + MONTHS_SHORT[x.getMonth()] + ' – ' + y.getDate() + ' ' + MONTHS_SHORT[y.getMonth()] + (yr ? ' ' + yr : '');
    },
    fmtDay: function (s) {
      if (!s) return tr('Sin fecha');
      var td = U.today(), diff = U.diffDays(td, s);
      if (diff === 0) return tr('Hoy');
      if (diff === 1) return tr('Mañana');
      if (diff === -1) return tr('Ayer');
      if (diff > 1 && diff < 7) return cap(WEEKDAYS[U.parse(s).getDay()]);
      return U.fmtShort(s);
    },
    /** "en 2 h 15 min" / "hace 3 días" (en inglés, «in 2 h 15 min» / «3 days ago») */
    fmtRel: function (ms) {
      var past = ms < 0, a = Math.abs(ms), min = Math.round(a / 60000), txt;
      if (min < 1) return past ? tr('ahora mismo') : tr('en un momento');
      if (min < 60) txt = min + ' min';
      else if (min < 1440) { var h = Math.floor(min / 60), m = min % 60; txt = h + ' h' + (m && h < 10 ? ' ' + m + ' min' : ''); }
      else { var d = Math.round(min / 1440); txt = EN ? d + (d === 1 ? ' day' : ' days') : d + (d === 1 ? ' día' : ' días'); }
      if (EN) return past ? txt + ' ago' : 'in ' + txt;
      return (past ? 'hace ' : 'en ') + txt;
    },
    /**
     * Fecha o día para la mitad de una frase: en español, en minúscula («el jueves, 19 de noviembre»); en inglés los
     * días y los meses van con mayúscula, y solo «today», «tomorrow» y «yesterday» pasan a minúscula
     */
    inline: function (s) {
      s = String(s || '');
      if (!EN) return s.toLowerCase();
      return /^(Today|Tomorrow|Yesterday|No date)$/.test(s) ? s.toLowerCase() : s;
    },
    /** «3 tareas»: cada forma se traduce (el catálogo tiene «tarea» y «tareas») y el plural sigue las reglas del idioma */
    plural: function (n, one, many) {
      var f = EN ? W.I18n.form(n) : (n === 1 ? 'one' : 'other');
      return n + ' ' + tr(f === 'one' ? one : many);
    },
    greeting: function () {
      var h = new Date().getHours();
      return tr(h < 6 ? 'Buenas noches' : h < 13 ? 'Buenos días' : h < 21 ? 'Buenas tardes' : 'Buenas noches');
    },

    /**
     * Guarda un archivo: en la app de escritorio pregunta dónde; en el navegador lo descarga.
     * kind: 'csv' · 'json' · 'txt' · 'ics' · 'md'
     */
    /** Abre un enlace web fuera de la app: navegador del sistema en Android y en el ordenador */
    openExternal: function (url) {
      if (!/^https?:\/\//i.test(String(url || ''))) return;
      var D = window.WhiderDesktop, A = window.WhiderAndroid;
      if (D && D.openExternal) D.openExternal(url);
      else if (A && A.openUrl) A.openUrl(url);
      else window.open(url, '_blank', 'noopener');
    },
    saveFile: function (name, text, kind) {
      var MIME = { csv: 'text/csv', json: 'application/json', txt: 'text/plain', ics: 'text/calendar', md: 'text/markdown' };
      var D = window.WhiderDesktop;
      if (D && D.saveFile) {
        return D.saveFile(name, text, kind).then(function (r) {
          if (r && r.ok && W.Toast) W.Toast.show({ text: 'Guardado en ' + r.path.split(/[\\/]/).pop(), icon: 'download', action: D.showFile ? { label: 'Mostrar', fn: function () { D.showFile(r.path); } } : null });
          return r;
        });
      }
      var blob = new Blob([kind === 'csv' ? '\ufeff' + text : text], { type: (MIME[kind] || 'text/plain') + ';charset=utf-8' });
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = name + '.' + kind;
      document.body.appendChild(a); a.click();
      setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 800);
      return Promise.resolve({ ok: true });
    },

    /** Identificador: prefijo_ + hora (base 36, así se ordenan por creación) + contador + 6 al azar */
    uid: function (p) {
      uidSeq = (uidSeq + 1) % 1296;
      return (p || 't') + '_' + Date.now().toString(36) + (uidSeq < 36 ? '0' : '') + uidSeq.toString(36) + randomChars(6);
    },
    randomChars: randomChars,
    clamp: function (v, a, b) { return Math.max(a, Math.min(b, v)); },
    debounce: function (fn, ms) {
      var t; return /** @this {any} */ function () { var a = arguments, s = this; clearTimeout(t); t = setTimeout(function () { fn.apply(s, a); }, ms); };
    },
    reducedMotion: function () {
      return document.documentElement.getAttribute('data-motion') === 'reduced' ||
        (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    }
  };

  W.U = U;
})(window.Whider);
