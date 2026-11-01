/**
 * WHIDER PRO - SERVICIO DE NOTIFICACIONES Y MOTOR DE ADVERTENCIAS
 */
window.Whider = window.Whider || {};

(function () {
  'use strict';

  var checkIntervalId = null;

  Whider.Notifications = {
    init: function () {
      Whider.Notifications.checkWarnings();
      // Verificación periódica cada 20 segundos
      if (checkIntervalId) clearInterval(checkIntervalId);
      checkIntervalId = setInterval(Whider.Notifications.checkWarnings, 20000);

      // Verificación reactiva al volver a la pestaña o abrir la app
      document.addEventListener('visibilitychange', function () {
        if (!document.hidden) {
          Whider.Notifications.checkWarnings();
        }
      });
    },

    isSupported: function () {
      return 'Notification' in window;
    },

    getPermission: function () {
      if (!Whider.Notifications.isSupported()) return 'unsupported';
      return Notification.permission;
    },

    requestPermission: async function () {
      if (!Whider.Notifications.isSupported()) {
        return false;
      }
      try {
        var res = await Notification.requestPermission();
        if (res === 'granted') {
          Whider.Audio.vibrate([30, 40, 30]);
          Whider.Notifications.updateBadges();
          return true;
        }
      } catch (e) {
        console.error(e);
      }
      Whider.Notifications.updateBadges();
      return false;
    },

    dispatchSystemNotification: function (title, body, taskId) {
      if (Whider.Notifications.isSupported() && Notification.permission === 'granted') {
        try {
          var n = new Notification(title, {
            body: body,
            tag: 'whider-warn-' + taskId,
            requireInteraction: true,
            icon: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="%23f59e0b" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path></svg>'
          });
          n.onclick = function () {
            window.focus();
            if (Whider.Router) Whider.Router.navigate('warnings');
            n.close();
          };
        } catch (e) {}
      }
    },

    // Motor proactivo de detección de incumplimiento
    checkWarnings: function () {
      if (!Whider.State) return;

      var td = Whider.State.today();
      var curTime = Whider.State.currentTimeStr();
      var nowTs = Date.now();
      var tasks = Whider.State.tasks;
      var hasAlertTriggered = false;

      tasks.forEach(function (t) {
        if (t.done || !t.warn) return;

        var isExpired = false;
        var reason = '';

        if (t.date && t.date < td) {
          isExpired = true;
          reason = 'Venció el ' + t.date;
        } else if (t.date === td && t.time && t.time <= curTime) {
          isExpired = true;
          reason = 'Superó la hora límite (' + t.time + ')';
        }

        if (isExpired) {
          var lastWarned = t.warnedAt || 0;
          // Intervalo de reaviso: cada 20 minutos por tarea no atendida
          if (nowTs - lastWarned > 20 * 60 * 1000) {
            t.warnedAt = nowTs;
            hasAlertTriggered = true;

            // Alerta Sonora y Háptica
            Whider.Audio.playWarningSound();
            Whider.Audio.vibrate([60, 80, 60, 100, 60]);

            // Notificación del Sistema Operativo
            Whider.Notifications.dispatchSystemNotification(
              '⚠️ ALERTA: Tarea Pendiente Sin Realizar',
              '"' + t.text + '" — ' + reason,
              t.id
            );

            // Toast Emergente In-App con Botón Directo de Cumplimiento
            Whider.Toast.show(
              'Advertencia: "' + t.text + '" sigue pendiente.',
              'danger',
              'Completar ahora',
              function () {
                Whider.State.toggleDone(t.id);
                Whider.Audio.playSuccessSound();
              }
            );
          }
        }
      });

      if (hasAlertTriggered) {
        Whider.State.saveLocal();
      }
      Whider.Notifications.updateBadges();
    },

    // Actualiza los badges contadores en tiempo real
    updateBadges: function () {
      if (!Whider.State) return;
      var count = Whider.State.getUncompletedWarnings().length;
      var badge = document.getElementById('navWarnBadge');
      var headerBtn = document.getElementById('btnHeaderAlerts');

      if (badge) {
        if (count > 0) {
          badge.textContent = count > 9 ? '9+' : String(count);
          badge.style.display = 'inline-flex';
        } else {
          badge.style.display = 'none';
        }
      }

      if (headerBtn) {
        headerBtn.classList.toggle('has-alert', count > 0);
      }
    }
  };
})();
