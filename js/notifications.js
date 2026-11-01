/**
 * WHIDER PRO - SERVICIO DE NOTIFICACIONES Y MOTOR DE ADVERTENCIAS
 */
window.Whider = window.Whider || {};

(function () {
  'use strict';

  var checkIntervalId = null;
  var REWARN_MS = 20 * 60 * 1000; // Reaviso cada 20 minutos por tarea no atendida
  var NOTIF_ICON = 'icons/icon-192.png';

  // Puente nativo opcional que expone la app Android (WebView)
  function androidBridge() {
    var b = window.WhiderAndroid;
    return b && typeof b.showNotification === 'function' ? b : null;
  }

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

      // Clic en una notificación mostrada por el Service Worker
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.addEventListener('message', function (e) {
          if (e.data && e.data.type === 'open-warnings' && Whider.Router) {
            Whider.Router.navigate('warnings');
          }
        });
      }
    },

    isSupported: function () {
      return !!androidBridge() || 'Notification' in window;
    },

    getPermission: function () {
      var bridge = androidBridge();
      if (bridge) {
        try { return bridge.getNotificationPermission(); } catch (e) { return 'default'; }
      }
      if (!('Notification' in window)) return 'unsupported';
      return Notification.permission;
    },

    requestPermission: async function () {
      var bridge = androidBridge();
      if (bridge) {
        try { bridge.requestNotificationPermission(); } catch (e) {}
        Whider.Notifications.updateBadges();
        return Whider.Notifications.getPermission() === 'granted';
      }
      if (!('Notification' in window)) {
        if (Whider.Toast) Whider.Toast.show('Este navegador no admite notificaciones del sistema', 'danger');
        return false;
      }
      try {
        // Safari antiguo usa la versión con callback
        var res = await new Promise(function (resolve) {
          var maybePromise = Notification.requestPermission(resolve);
          if (maybePromise && typeof maybePromise.then === 'function') maybePromise.then(resolve);
        });
        if (res === 'granted') {
          Whider.Audio.vibrate([30, 40, 30]);
          if (Whider.Toast) Whider.Toast.show('Notificaciones activadas', 'success');
          Whider.Notifications.updateBadges();
          return true;
        }
        if (res === 'denied' && Whider.Toast) {
          Whider.Toast.show('Notificaciones bloqueadas. Actívalas en los ajustes del navegador.', 'danger');
        }
      } catch (e) {
        console.error(e);
      }
      Whider.Notifications.updateBadges();
      return false;
    },

    dispatchSystemNotification: function (title, body, taskId) {
      var tag = 'whider-warn-' + taskId;

      var bridge = androidBridge();
      if (bridge) {
        try { bridge.showNotification(title, body, tag); } catch (e) {}
        return;
      }

      if (!('Notification' in window) || Notification.permission !== 'granted') return;
      var options = {
        body: body,
        tag: tag,
        renotify: true,
        requireInteraction: true,
        icon: NOTIF_ICON,
        badge: NOTIF_ICON,
        data: { screen: 'warnings' }
      };

      // En Android (Chrome) el constructor `new Notification` no está permitido:
      // hay que mostrarla a través del Service Worker.
      var showDirect = function () {
        try {
          var n = new Notification(title, options);
          n.onclick = function () {
            window.focus();
            if (Whider.Router) Whider.Router.navigate('warnings');
            n.close();
          };
        } catch (e) {}
      };

      if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.getRegistration().then(function (reg) {
          if (reg && reg.showNotification) return reg.showNotification(title, options);
          showDirect();
        }).catch(showDirect);
      } else {
        showDirect();
      }
    },

    // Motor proactivo de detección de incumplimiento
    checkWarnings: function () {
      if (!Whider.State) return;

      var td = Whider.State.today();
      var nowTs = Date.now();
      var triggered = [];

      Whider.State.getOverdueWarnings().forEach(function (t) {
        var lastWarned = t.warnedAt || 0;
        if (nowTs - lastWarned <= REWARN_MS) return;
        t.warnedAt = nowTs;
        triggered.push(t);

        var reason = t.date < td
          ? 'Venció el ' + t.date
          : 'Superó la hora límite (' + t.time + ')';

        // Notificación del Sistema Operativo
        Whider.Notifications.dispatchSystemNotification(
          '⚠️ ALERTA: Tarea pendiente sin realizar',
          '"' + t.text + '" — ' + reason,
          t.id
        );

        // Toast emergente in-app con botón directo de cumplimiento
        if (Whider.Toast) {
          Whider.Toast.show(
            'Advertencia: "' + t.text + '" sigue pendiente.',
            'danger',
            'Completar ahora',
            function () {
              var done = Whider.State.completeTask(t.id);
              if (done) Whider.Audio.playSuccessSound();
            }
          );
        }
      });

      if (triggered.length) {
        // Un único aviso sonoro/háptico aunque venzan varias tareas a la vez
        Whider.Audio.playWarningSound();
        Whider.Audio.vibrate([60, 80, 60, 100, 60]);
        Whider.State.saveLocal();
      }
      Whider.Notifications.updateBadges();
    },

    // Llamado por la app Android cuando el usuario responde al diálogo de permiso
    onNativePermissionResult: function (granted) {
      if (Whider.Toast) {
        Whider.Toast.show(granted ? 'Notificaciones activadas' : 'Permiso de notificaciones denegado', granted ? 'success' : 'danger');
      }
      if (Whider.Screens && Whider.Screens.Settings) Whider.Screens.Settings.render();
      Whider.Notifications.updateBadges();
    },

    // Actualiza los badges contadores en tiempo real
    updateBadges: function () {
      if (!Whider.State) return;
      var count = Whider.State.getOverdueWarnings().length;
      var text = count > 9 ? '9+' : String(count);

      ['navWarnBadge', 'drawerWarnBadge'].forEach(function (id) {
        var badge = document.getElementById(id);
        if (!badge) return;
        if (count > 0) {
          badge.textContent = text;
          badge.style.display = 'inline-flex';
          badge.setAttribute('aria-label', count + (count === 1 ? ' aviso vencido' : ' avisos vencidos'));
        } else {
          badge.style.display = 'none';
        }
      });

      var menuBtn = document.getElementById('btnMenu');
      if (menuBtn) menuBtn.classList.toggle('has-alert', count > 0);
    }
  };
})();
