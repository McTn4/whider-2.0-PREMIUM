/**
 * WHIDER PRO - ENRUTADOR DE PANTALLAS (SCREEN ROUTER)
 * Controla la navegación entre pantallas y sincroniza la URL (#pantalla)
 * para que funcionen los accesos directos del manifiesto (p. ej. #warnings).
 */
window.Whider = window.Whider || {};

(function () {
  'use strict';

  var screensMeta = {
    home: { title: 'Inicio' },
    tasks: { title: 'Tareas' },
    calendar: { title: 'Calendario' },
    warnings: { title: 'Avisos' },
    stats: { title: 'Perfil' },
    records: { title: 'Records' },
    settings: { title: 'Ajustes' }
  };
  var DEFAULT_SCREEN = 'home';

  function screenFromHash() {
    var h = (window.location.hash || '').replace(/^#\/?/, '');
    return screensMeta[h] ? h : null;
  }

  Whider.Router = {
    init: function () {
      // Botones de la barra inferior
      document.querySelectorAll('.nav-tab').forEach(function (tab) {
        tab.addEventListener('click', function () {
          var targetScreen = tab.getAttribute('data-screen');
          if (targetScreen) {
            Whider.Router.navigate(targetScreen);
            Whider.Audio.vibrate([10]);
          }
        });
      });

      // Cambios manuales de la URL (atrás/adelante del navegador, accesos directos)
      window.addEventListener('hashchange', function () {
        var target = screenFromHash();
        if (target && target !== Whider.State.activeScreen) Whider.Router.navigate(target);
      });

      Whider.Router.navigate(screenFromHash() || Whider.State.activeScreen || DEFAULT_SCREEN);
    },

    isValid: function (screenId) {
      return !!screensMeta[screenId];
    },

    navigate: function (screenId) {
      if (!screensMeta[screenId]) screenId = DEFAULT_SCREEN;
      Whider.State.activeScreen = screenId;

      // Actualizar visibilidad de pantallas
      document.querySelectorAll('.screen').forEach(function (el) {
        if (el.id === 'screen-' + screenId) {
          el.classList.add('active');
          el.scrollTop = 0;
        } else {
          el.classList.remove('active');
        }
      });

      // Estado activo en la barra inferior y en el menú lateral
      document.querySelectorAll('.nav-tab[data-screen]').forEach(function (tab) {
        var isTarget = tab.getAttribute('data-screen') === screenId;
        tab.classList.toggle('active', isTarget);
        if (isTarget) tab.setAttribute('aria-current', 'page'); else tab.removeAttribute('aria-current');
      });
      document.querySelectorAll('.drawer-link').forEach(function (link) {
        link.classList.toggle('active', link.getAttribute('data-screen') === screenId);
      });

      document.title = screenId === DEFAULT_SCREEN ? 'WHIDER' : screensMeta[screenId].title + ' · WHIDER';

      // Mantener la URL sincronizada sin llenar el historial
      if (window.history && window.history.replaceState && window.location.protocol !== 'file:') {
        try { window.history.replaceState(null, '', '#' + screenId); } catch (e) {}
      }

      Whider.Router.renderActiveScreen(screenId);
    },

    renderActiveScreen: function (screenId) {
      var S = Whider.Screens || {};
      if (screenId === 'home' && Whider.Premium) Whider.Premium.renderHome();
      else if (screenId === 'records' && Whider.Premium) Whider.Premium.renderRecords();
      else if (screenId === 'tasks' && S.Tasks) S.Tasks.render();
      else if (screenId === 'calendar' && S.Calendar) S.Calendar.render();
      else if (screenId === 'warnings' && S.Warnings) S.Warnings.render();
      else if (screenId === 'stats' && S.Stats) S.Stats.render();
      else if (screenId === 'settings' && S.Settings) S.Settings.render();
    }
  };
})();
