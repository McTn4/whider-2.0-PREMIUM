/**
 * WHIDER · Navegación entre pantallas con transiciones direccionales
 * y URL sincronizada (#pantalla) para los accesos directos.
 */
window.Whider = window.Whider || {};

(function (W) {
  'use strict';
  var U = W.U;
  var ORDER = { home: 0, tasks: 1, calendar: 2, focus: 3 };
  var SECONDARY = { progress: 'btnProfile', alerts: 'btnAlerts', settings: 'btnSettings' };

  function screenFromHash() {
    var h = (location.hash || '').replace(/^#\/?/, '');
    return W.Screens[h] ? h : null;
  }

  function placeIndicator() {
    var ind = document.getElementById('dockIndicator');
    var act = U.$('.dock-tab.active');
    if (!ind) return;
    if (!act) { ind.classList.remove('show'); return; }
    ind.style.width = (act.offsetWidth - 8) + 'px';
    ind.style.transform = 'translateX(' + (act.offsetLeft + 4) + 'px)';
    ind.classList.add('show');
  }

  var Router = {
    init: function (initial) {
      U.$$('.dock-tab').forEach(function (b) {
        b.addEventListener('click', function () { Router.go(b.getAttribute('data-go')); W.Audio.tap(); });
      });
      window.addEventListener('hashchange', function () {
        var s = screenFromHash();
        if (s && s !== W.State.activeScreen) Router.go(s);
      });
      window.addEventListener('resize', U.debounce(placeIndicator, 100));
      Router.go(screenFromHash() || initial || 'home', { initial: true });
    },

    current: function () { return W.State.activeScreen; },

    go: function (id, opts) {
      opts = opts || {};
      if (!W.Screens[id] || id === 'onboarding') id = 'home';
      var prev = W.State.activeScreen;
      var root = document.getElementById('screen-' + id);
      if (prev === id && !opts.initial) {
        if (root.scrollTop > 0) root.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }
      W.State.activeScreen = id;

      var cls = 'enter-up';
      if (prev && ORDER[prev] != null && ORDER[id] != null) cls = ORDER[id] > ORDER[prev] ? 'enter-right' : 'enter-left';
      U.$$('.screen').forEach(function (s) {
        var on = s === root;
        s.classList.toggle('active', on);
        s.classList.remove('enter-right', 'enter-left', 'enter-up');
        s.setAttribute('aria-hidden', on ? 'false' : 'true');
      });
      if (!opts.initial) { void root.offsetWidth; root.classList.add(cls); }
      root.scrollTop = 0;

      U.$$('.dock-tab').forEach(function (b) {
        var on = b.getAttribute('data-go') === id;
        b.classList.toggle('active', on);
        if (on) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
      });
      Object.keys(SECONDARY).forEach(function (k) {
        var b = document.getElementById(SECONDARY[k]);
        if (b) b.classList.toggle('active', k === id);
      });
      placeIndicator();

      if (history.replaceState && location.protocol !== 'file:') {
        try { history.replaceState(null, '', '#' + id); } catch (e) { /* sin historial */ }
      }
      document.title = id === 'home' ? 'WHIDER' : W.Screens[id].title + ' · WHIDER';
      W.Screens[id].render(root, true);
    },

    /** Vuelve a pintar la pantalla actual tras un cambio de datos (sin animación de entrada) */
    refresh: function () {
      var id = W.State.activeScreen;
      if (!id || !W.Screens[id]) return;
      var root = document.getElementById('screen-' + id);
      var y = root.scrollTop;
      W.Screens[id].render(root, false);
      root.scrollTop = y;
    },

    placeIndicator: placeIndicator
  };

  W.Router = Router;
})(window.Whider);
