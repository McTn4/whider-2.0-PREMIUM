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
  var probe = null;

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
    },

    /**
     * Márgenes que no se pueden tapar, en píxeles: arriba la franja de título (escritorio) o la
     * muesca y la barra de estado (móvil); abajo la barra de gestos. Se miden con un elemento
     * invisible porque env(safe-area-inset-*) solo se resuelve dentro de CSS.
     */
    insets: function () {
      if (!probe) {
        probe = document.createElement('div');
        probe.setAttribute('aria-hidden', 'true');
        probe.style.cssText = 'position:fixed;left:0;top:0;width:0;height:0;visibility:hidden;pointer-events:none;' +
          'padding:var(--safe-t) env(safe-area-inset-right, 0px) var(--safe-b) env(safe-area-inset-left, 0px)';
        document.body.appendChild(probe);
      }
      var cs = getComputedStyle(probe);
      return { top: parseFloat(cs.paddingTop) || 0, bottom: parseFloat(cs.paddingBottom) || 0, left: parseFloat(cs.paddingLeft) || 0, right: parseFloat(cs.paddingRight) || 0 };
    },

    /**
     * Zona que se ve de verdad, en coordenadas de position: fixed. Con el teclado del móvil abierto
     * es más baja (y en iOS puede estar desplazada); `keyboard` dice si lo está.
     */
    viewport: function () {
      var vv = window.visualViewport;
      var top = vv ? vv.offsetTop : 0, height = vv ? vv.height : window.innerHeight;
      return { top: top, height: height, bottom: top + height, width: vv ? vv.width : window.innerWidth, keyboard: !!vv && window.innerHeight - vv.height > 120 };
    },

    /** Límites verticales para colocar menús y ventanas flotantes sin que nada los tape */
    safeArea: function (margin) {
      var m = margin == null ? 8 : margin, v = Layout.viewport(), ins = Layout.insets();
      return { top: v.top + ins.top + m, bottom: v.bottom - m - (v.keyboard ? 0 : ins.bottom), left: ins.left + m, right: v.width - ins.right - m };
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
