/**
 * WHIDER · Navegación: cinco secciones (Inicio, Tareas, Calendario, Cuaderno y Personas, con sus chats y equipos), las
 * mismas en la barra inferior del móvil y en la barra superior del ordenador. URL sincronizada (#pantalla).
 */
window.Whider = window.Whider || {};

(function (W) {
  'use strict';
  var U = W.U;
  var TABS = { home: 1, tasks: 1, calendar: 1, notes: 1, friends: 1 };
  function isTab(id) { return TABS[id] === 1; }
  // Pantallas que cuelgan de una sección (su pestaña queda marcada): los chats, de Personas
  var PARENT = { chats: 'friends' };
  /*
   * Rutas antiguas → pantalla. Los hábitos pasaron a ser tareas de cada día; Enfoque, Estadísticas, Informes,
   * Automatizaciones, Marcas, el Perfil y «Más» ya no existen: llevan a lo más parecido.
   */
  var ALIASES = { records: ['home'], achievements: ['home'], alerts: ['home'], agenda: ['calendar'], profile: ['home'], progress: ['home'],
    habits: ['tasks'], focus: ['home'], stats: ['home'], reports: ['home'], automations: ['tasks'], more: ['home'], people: ['friends'] };
  var refreshQueued = false, lastTab = 'home';

  function screenFromHash() {
    var h = (location.hash || '').replace(/^#\/?/, '');
    if (h === 'cuenta') return null;   // Ajustes → Cuenta en cuanto haya sesión (W.App)
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
      // Un solo oyente para todas las pestañas
      var dock = document.querySelector('.dock');
      if (dock) dock.addEventListener('click', function (e) {
        var b = e.target.closest('.tab');
        if (b) Router.go(b.getAttribute('data-go'));
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
      if (ALIASES[id]) { id = ALIASES[id][0]; if (W.State.activeScreen === id && !opts.initial) { Router.refresh(); return; } }
      if (!W.Screens[id]) id = 'home';
      var prev = W.State.activeScreen;
      var root = document.getElementById('screen-' + id);
      if (prev === id && !opts.initial) {
        // Volver a tocar la pestaña: primero a la portada, después arriba del todo
        if (W.Screens[id].reset && W.Screens[id].reset()) return;
        if (root.scrollTop > 0) root.scrollTo({ top: 0, behavior: U.reducedMotion() ? 'auto' : 'smooth' });
        return;
      }
      if (isTab(prev)) lastTab = prev;
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

      Router.markTabs(id);

      if (history.replaceState && location.protocol !== 'file:') {
        try { history.replaceState(null, '', '#' + id); } catch (e) { /* sin historial */ }
      }
      setTitle(id === 'home' ? 'WHIDER' : W.Screens[id].title + ' · WHIDER');
      W.Screens[id].render(root, true);
      if (!opts.initial) animate(root, isTab(id) ? 'enter' : 'push');
      if (W.Topbar) W.Topbar.refresh();
    },

    /** Marca la pestaña de la pantalla abierta (o la de su sección: los chats, Personas) */
    markTabs: function (id) {
      var tab = PARENT[id] || id;
      U.$$('.tab').forEach(function (b) {
        // Siempre un booleano: toggle(x, undefined) no fuerza, alterna (y encendía las demás pestañas)
        var on = b.getAttribute('data-go') === tab;
        b.classList.toggle('active', on);
        if (on) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
      });
    },

    /** Vuelve a la última sección en la que estabas (desde una pantalla que cuelga de otra) */
    back: function () { Router.go(lastTab || 'home'); },

    /** Animación de una página dentro de la pestaña actual ('push' o 'pop') */
    animate: function (kind) {
      if (W.Select) W.Select.clear(true);
      var root = document.getElementById('screen-' + W.State.activeScreen);
      if (!root) return;
      root.classList.remove('scrolled');
      animate(root, kind);
      if (W.Topbar) W.Topbar.refresh();
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
        if (W.Topbar) W.Topbar.refresh();
        if (W.Select && W.Select.active()) W.Select.repaint();
      });
    }
  };

  W.Router = Router;
})(window.Whider);
