/**
 * WHIDER PRO - ENRUTADOR DE PANTALLAS (SCREEN ROUTER)
 * Controla la navegación fluida entre las 5 pantallas dedicadas.
 */
window.Whider = window.Whider || {};

(function () {
  'use strict';

  // Pantallas de la barra inferior: perfil, tareas y ajustes.
  // Calendario y avisos se abren desde los iconos de la cabecera.
  var screensMeta = {
    home: { title: 'Inicio', badge: 'Inicio' },
    records: { title: 'Records', badge: 'Records' },
    tasks: { title: 'Tareas', badge: 'Tareas' },
    calendar: { title: 'Calendario', badge: 'Calendario' },
    warnings: { title: 'Avisos', badge: 'Avisos' },
    stats: { title: 'Perfil', badge: 'Perfil' },
    settings: { title: 'Ajustes', badge: 'Ajustes' }
  };

  Whider.Router = {
    init: function () {
      // Event listeners para los botones de la barra inferior
      var navTabs = document.querySelectorAll('.nav-tab');
      navTabs.forEach(function (tab) {
        tab.addEventListener('click', function () {
          var targetScreen = tab.getAttribute('data-screen');
          if (targetScreen) {
            Whider.Router.navigate(targetScreen);
            Whider.Audio.vibrate([10]);
          }
        });
      });

      // Calendario (izquierda de la cabecera)
      var btnHeaderCalendar = document.getElementById('btnHeaderCalendar');
      if (btnHeaderCalendar) {
        btnHeaderCalendar.addEventListener('click', function () {
          Whider.Router.navigate(Whider.State.activeScreen === 'calendar' ? 'tasks' : 'calendar');
          Whider.Audio.vibrate([12]);
        });
      }

      // Campana de avisos (derecha de la cabecera)
      var btnHeaderAlerts = document.getElementById('btnHeaderAlerts');
      if (btnHeaderAlerts) {
        btnHeaderAlerts.addEventListener('click', function () {
          Whider.Router.navigate(Whider.State.activeScreen === 'warnings' ? 'tasks' : 'warnings');
          Whider.Audio.vibrate([12]);
        });
      }

      // Navegación a la pantalla inicial
      Whider.Router.navigate(Whider.State.activeScreen || 'tasks');
    },

    navigate: function (screenId) {
      if (!screensMeta[screenId]) screenId = 'tasks';
      Whider.State.activeScreen = screenId;

      // Actualizar visibilidad de pantallas
      var allScreens = document.querySelectorAll('.screen');
      allScreens.forEach(function (el) {
        if (el.id === 'screen-' + screenId) {
          el.classList.add('active');
          el.scrollTop = 0;
        } else {
          el.classList.remove('active');
        }
      });

      // Actualizar estado activo en la barra de navegación inferior
      var navTabs = document.querySelectorAll('.nav-tab');
      navTabs.forEach(function (tab) {
        var isTarget = tab.getAttribute('data-screen') === screenId;
        tab.classList.toggle('active', isTarget);
      });

      document.querySelectorAll('.drawer-link').forEach(function (link) {
        link.classList.toggle('active', link.getAttribute('data-screen') === screenId);
      });

      // Marcar el icono de cabecera de la pantalla secundaria activa
      var hdrCal = document.getElementById('btnHeaderCalendar');
      var hdrAlerts = document.getElementById('btnHeaderAlerts');
      if (hdrCal) hdrCal.classList.toggle('active', screenId === 'calendar');
      if (hdrAlerts) hdrAlerts.classList.toggle('active', screenId === 'warnings');

      // Renderizar la pantalla correspondiente
      Whider.Router.renderActiveScreen(screenId);
    },

    renderActiveScreen: function (screenId) {
      if (!Whider.Screens) return;
      if (screenId === 'home' && Whider.Premium) { Whider.Premium.renderHome(); } else if (screenId === 'records' && Whider.Premium) { Whider.Premium.renderRecords(); } else if (screenId === 'tasks' && Whider.Screens.Tasks) {
        Whider.Screens.Tasks.render();
      } else if (screenId === 'calendar' && Whider.Screens.Calendar) {
        Whider.Screens.Calendar.render();
      } else if (screenId === 'warnings' && Whider.Screens.Warnings) {
        Whider.Screens.Warnings.render();
      } else if (screenId === 'stats' && Whider.Screens.Stats) {
        Whider.Screens.Stats.render();
      } else if (screenId === 'settings' && Whider.Screens.Settings) {
        Whider.Screens.Settings.render();
      }
    }
  };
})();
