/**
 * WHIDER · Diseño según la pantalla.
 *  - Móvil: pestañas abajo (dock) y hojas que suben desde abajo.
 *  - Ordenador (1000 px o más): barra lateral, contenido ancho, diálogos centrados y
 *    el editor en un panel a la derecha.
 * Marca <html data-layout="desktop|mobile"> y avisa cuando cambia (al redimensionar la ventana).
 */
window.Whider = window.Whider || {};

(function (W) {
  'use strict';
  var QUERY = '(min-width: 1000px)';
  var mq = window.matchMedia ? window.matchMedia(QUERY) : null;
  var subs = [];
  var bridge = window.WhiderDesktop || null;

  var Layout = {
    /** true con diseño de ordenador */
    desktop: false,
    /** true dentro de la app de escritorio (Windows, macOS o Linux) */
    app: !!bridge,
    platform: bridge ? bridge.platform : '',
    /** Tecla de los atajos: ⌘ en Mac, Ctrl en los demás */
    mod: /Mac|iPhone|iPad/.test(navigator.platform || '') || (bridge && bridge.platform === 'darwin') ? '⌘' : 'Ctrl',

    apply: function () {
      var d = !!(mq && mq.matches);
      var changed = d !== Layout.desktop;
      Layout.desktop = d;
      document.documentElement.setAttribute('data-layout', d ? 'desktop' : 'mobile');
      return changed;
    },

    /** fn(desktop) cada vez que se pasa de un diseño a otro */
    onChange: function (fn) { subs.push(fn); },

    /** Texto de un atajo: "Ctrl K" o "⌘ K" */
    keys: function (k) { return Layout.mod + ' ' + k; },

    /**
     * Alto de la franja de título de la app de escritorio (Windows y macOS: título y botones de la
     * ventana); 0 en el navegador y en Linux. Menús y ventanas flotantes no deben quedar debajo.
     */
    topInset: function () {
      var v = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--titlebar-h'));
      return isNaN(v) ? 0 : v;
    }
  };

  Layout.apply();
  if (Layout.app) document.documentElement.classList.add('desktop-app', 'os-' + Layout.platform);
  if (mq) {
    var handler = function () { if (Layout.apply()) subs.forEach(function (fn) { try { fn(Layout.desktop); } catch (e) { console.error(e); } }); };
    if (mq.addEventListener) mq.addEventListener('change', handler); else if (mq.addListener) mq.addListener(handler);
  }

  W.Layout = Layout;
})(window.Whider);
