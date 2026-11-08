/**
 * WHIDER · Navegación: cuatro secciones (Hoy, Tareas, Calendario, Enfoque) en el dock del
 * móvil o en la barra lateral del ordenador, y una pantalla de Perfil y resumen (desde tu foto).
 * URL sincronizada (#pantalla).
 */
window.Whider = window.Whider || {};

(function (W) {
  'use strict';
  var U = W.U;
  var TABS = { home: 1, tasks: 1, calendar: 1, more: 1 };
  // Pantallas que se abren desde «Más» en el móvil (la pestaña Más queda marcada)
  var UNDER_MORE = { notes: 1, chats: 1, friends: 1, habits: 1, focus: 1, stats: 1, reports: 1, automations: 1, plans: 1, progress: 1 };
  // Rutas antiguas o secundarias → pantalla (y apartado)
  var ALIASES = { records: ['progress', 'records'], achievements: ['progress', 'achievements'], alerts: ['home'], agenda: ['calendar'], profile: ['progress'] };
  var refreshQueued = false, lastTab = 'home';

  function screenFromHash() {
    var h = (location.hash || '').replace(/^#\/?/, '');
    if (ALIASES[h] || h === 'settings') return h;
    return W.Screens[h] ? h : null;
  }

  /** La barra superior muestra el título pequeño y una sombra al hacer scroll */
  function watchScroll(screen) {
    var on = false, ticking = false;
    screen.addEventListener('scroll', function () {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(function () {
        ticking = false;
        var now = screen.scrollTop > 40;
        if (now !== on) { on = now; screen.classList.toggle('scrolled', on); }
      });
    }, { passive: true });
  }

  /** Título de la ventana (y de la franja superior en la app de escritorio) */
  function setTitle(text) {
    document.title = text;
    var bar = document.getElementById('titlebar');
    if (bar) bar.textContent = text;
  }

  function animate(root, kind) {
    if (U.reducedMotion()) return;
    root.classList.remove('push', 'pop', 'enter');
    void root.offsetWidth;
    root.classList.add(kind);
    clearTimeout(root._animT);
    root._animT = setTimeout(function () { root.classList.remove(kind); }, 420);
  }

  var Router = {
    init: function (initial) {
      U.$$('.tab').forEach(function (b) {
        b.addEventListener('click', function () { Router.go(b.getAttribute('data-go')); });
      });
      U.$$('.screen').forEach(watchScroll);
      window.addEventListener('hashchange', function () {
        var s = screenFromHash();
        if (s && s !== W.State.activeScreen) Router.go(s);
      });
      // Accesos directos de la app instalada: #new-task y #new-note
      var h0 = (location.hash || '').replace(/^#\/?/, '');
      if (h0 === 'new-task' || h0 === 'new-note') {
        Router.go(initial || 'home', { initial: true });
        setTimeout(function () { if (h0 === 'new-task') W.App.newTask(); else W.Notes.open(null); }, 700);
        return;
      }
      var first = screenFromHash();
      Router.go(first && first !== 'settings' ? first : (initial || 'home'), { initial: true });
      if (first === 'settings') setTimeout(function () { W.Settings.open(); }, 300);
    },

    current: function () { return W.State.activeScreen; },

    go: function (id, opts) {
      opts = opts || {};
      if (id === 'settings') { W.Settings.open(); return; }
      if (ALIASES[id]) { if (ALIASES[id][1]) W.State.ui.profileTab = ALIASES[id][1]; id = ALIASES[id][0]; if (W.State.activeScreen === id && !opts.initial) { Router.refresh(); return; } }
      if (!W.Screens[id]) id = 'home';
      var prev = W.State.activeScreen;
      var root = document.getElementById('screen-' + id);
      if (prev === id && !opts.initial) {
        // Volver a tocar la pestaña: primero a la portada, después arriba del todo
        if (W.Screens[id].reset && W.Screens[id].reset()) return;
        if (root.scrollTop > 0) root.scrollTo({ top: 0, behavior: U.reducedMotion() ? 'auto' : 'smooth' });
        return;
      }
      if (TABS[prev]) lastTab = prev;
      // Un menú abierto pertenece a la pantalla anterior (p. ej. al cambiar desde la bandeja o un aviso)
      if (W.Menu && W.Menu.close) W.Menu.close();
      document.body.setAttribute('data-screen', id);
      if (W.Select) W.Select.clear(true);
      W.State.activeScreen = id;
      U.$$('.screen').forEach(function (s) {
        var on = s === root;
        s.classList.toggle('active', on);
        s.classList.remove('push', 'pop', 'enter');
        s.setAttribute('aria-hidden', on ? 'false' : 'true');
      });
      root.scrollTop = 0;
      root.classList.remove('scrolled');

      U.$$('.tab').forEach(function (b) {
        var on = b.getAttribute('data-go') === id || (UNDER_MORE[id] && b.getAttribute('data-go') === 'more');
        b.classList.toggle('active', on);
        if (on) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
      });

      if (history.replaceState && location.protocol !== 'file:') {
        try { history.replaceState(null, '', '#' + id); } catch (e) { /* sin historial */ }
      }
      setTitle(id === 'home' ? 'WHIDER' : W.Screens[id].title + ' · WHIDER');
      W.Screens[id].render(root, true);
      if (!opts.initial) animate(root, TABS[id] ? 'enter' : 'push');
      if (W.Sidebar) W.Sidebar.refresh();
    },

    /** Desde el Perfil, vuelve a la pestaña en la que estabas */
    back: function () { Router.go(lastTab || 'home'); },

    /** Animación de una página dentro de la pestaña actual ('push' o 'pop') */
    animate: function (kind) {
      if (W.Select) W.Select.clear(true);
      var root = document.getElementById('screen-' + W.State.activeScreen);
      if (!root) return;
      root.classList.remove('scrolled');
      animate(root, kind);
      if (W.Sidebar) W.Sidebar.refresh();
    },

    /** Vuelve a pintar la pantalla actual tras un cambio (varios cambios seguidos = un solo pintado) */
    refresh: function () {
      if (refreshQueued) return;
      refreshQueued = true;
      requestAnimationFrame(function () {
        refreshQueued = false;
        var id = W.State.activeScreen;
        if (!id || !W.Screens[id]) return;
        var root = document.getElementById('screen-' + id);
        var y = root.scrollTop;
        W.Screens[id].render(root, false);
        root.scrollTop = y;
        if (W.Sidebar) W.Sidebar.refresh();
        if (W.Select && W.Select.active()) W.Select.repaint();
      });
    }
  };

  W.Router = Router;
})(window.Whider);
