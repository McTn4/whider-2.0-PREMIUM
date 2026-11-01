/**
 * WHIDER · Utilidades compartidas (DOM, fechas, formato, iconos)
 */
window.Whider = window.Whider || {};

(function (W) {
  'use strict';

  var SVG_NS = 'http://www.w3.org/2000/svg';
  var MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  var MONTHS_SHORT = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  var WEEKDAYS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
  var WEEKDAYS_SHORT = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

  function pad(n) { return n < 10 ? '0' + n : '' + n; }
  function cap(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }

  var U = {
    MONTHS: MONTHS,
    WEEKDAYS_SHORT: WEEKDAYS_SHORT,

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
    diffDays: function (a, b) { return Math.round((U.parse(b) - U.parse(a)) / 86400000); },
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
      return ((h % 12) || 12) + ':' + p[1] + (h < 12 ? ' a. m.' : ' p. m.');
    },
    fmtLong: function (s) {
      var d = U.parse(s);
      return cap(WEEKDAYS[d.getDay()]) + ', ' + d.getDate() + ' de ' + MONTHS[d.getMonth()];
    },
    fmtShort: function (s) {
      var d = U.parse(s);
      return WEEKDAYS_SHORT[d.getDay()].toLowerCase() + ' ' + d.getDate() + ' ' + MONTHS_SHORT[d.getMonth()];
    },
    fmtMonth: function (y, m) { return cap(MONTHS[m]) + ' ' + y; },
    fmtDay: function (s) {
      if (!s) return 'Sin fecha';
      var td = U.today(), diff = U.diffDays(td, s);
      if (diff === 0) return 'Hoy';
      if (diff === 1) return 'Mañana';
      if (diff === -1) return 'Ayer';
      if (diff > 1 && diff < 7) return cap(WEEKDAYS[U.parse(s).getDay()]);
      return U.fmtShort(s);
    },
    /** "en 2 h 15 min" / "hace 3 días" */
    fmtRel: function (ms) {
      var past = ms < 0, a = Math.abs(ms), min = Math.round(a / 60000), txt;
      if (min < 1) return past ? 'ahora mismo' : 'en un momento';
      if (min < 60) txt = min + ' min';
      else if (min < 1440) { var h = Math.floor(min / 60), m = min % 60; txt = h + ' h' + (m && h < 10 ? ' ' + m + ' min' : ''); }
      else { var d = Math.round(min / 1440); txt = d + (d === 1 ? ' día' : ' días'); }
      return (past ? 'hace ' : 'en ') + txt;
    },
    plural: function (n, one, many) { return n + ' ' + (n === 1 ? one : many); },
    greeting: function () {
      var h = new Date().getHours();
      return h < 6 ? 'Buenas noches' : h < 13 ? 'Buenos días' : h < 21 ? 'Buenas tardes' : 'Buenas noches';
    },

    uid: function (p) { return (p || 't') + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); },
    clamp: function (v, a, b) { return Math.max(a, Math.min(b, v)); },
    debounce: function (fn, ms) {
      var t; return function () { var a = arguments, s = this; clearTimeout(t); t = setTimeout(function () { fn.apply(s, a); }, ms); };
    },
    reducedMotion: function () {
      return document.documentElement.getAttribute('data-motion') === 'reduced' ||
        (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    }
  };

  W.U = U;
})(window.Whider);
