/**
 * WHIDER PRO - APLICACIÓN PRINCIPAL (BOOTSTRAPPER)
 * Inicializa todos los subsistemas, servicios y pantallas.
 */
window.Whider = window.Whider || {};

(function () {
  'use strict';

  function initApp() {
    console.log('🚀 Whider Pro iniciando...');

    // 1. Inicializar Modal de Edición
    if (Whider.Modal) Whider.Modal.init();

    // 2. Inicializar Pantallas
    if (Whider.Screens) {
      if (Whider.Screens.Tasks) Whider.Screens.Tasks.init();
      if (Whider.Screens.Calendar) Whider.Screens.Calendar.init();
      if (Whider.Screens.Warnings) Whider.Screens.Warnings.init();
      if (Whider.Screens.Stats) Whider.Screens.Stats.init();
      if (Whider.Screens.Settings) Whider.Screens.Settings.init();
    }

    // 3. Inicializar Notificaciones y Alertas Proactivas
    if (Whider.Notifications) Whider.Notifications.init();

    // 4. Inicializar Router
    if (Whider.Router) Whider.Router.init();

    // 5. Suscripción Reactiva del Estado
    Whider.State.subscribe(function () {
      if (Whider.Router) {
        Whider.Router.renderActiveScreen(Whider.State.activeScreen);
      }
      if (Whider.Notifications) {
        Whider.Notifications.updateBadges();
      }
    });

    // 6. Atajos de teclado en escritorio
    window.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        var modal = document.getElementById('editModal');
        if (modal && modal.style.display !== 'none') {
          modal.style.display = 'none';
        }
      } else if (e.key === '/' && document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') {
        var quickInput = document.getElementById('quickTaskInput');
        if (quickInput) {
          e.preventDefault();
          Whider.Router.navigate('tasks');
          quickInput.focus();
        }
      }
    });

    // 7. Registro de Service Worker (PWA & Offline WebAPK)
    initServiceWorker();

    // 8. Gestor de Instalación Nativa (WebAPK / PWA)
    initInstallPrompt();

    // 9. Conexión opcional a Cloud (window.claude) si está disponible
    connectClaudeDoc();

    console.log('✅ Whider Pro listo y operativo.');
  }

  var deferredPrompt = null;

  function initServiceWorker() {
    if ('serviceWorker' in navigator && (window.location.protocol === 'http:' || window.location.protocol === 'https:')) {
      navigator.serviceWorker.register('./sw.js').then(function (reg) {
        console.log('📦 Service Worker registrado con éxito:', reg.scope);
      }).catch(function (err) {
        console.warn('Service Worker registro omitido:', err);
      });
    }
  }

  function initInstallPrompt() {
    var installModal = document.getElementById('installModal');
    var btnHeaderInstall = document.getElementById('btnHeaderInstall');
    var btnInstallAppPrompt = document.getElementById('btnInstallAppPrompt');
    var btnTriggerPwaInstall = document.getElementById('btnTriggerPwaInstall');
    var btnClose = document.getElementById('btnCloseInstallModal');
    var btnDismiss = document.getElementById('btnDismissInstallModal');

    window.addEventListener('beforeinstallprompt', function (e) {
      e.preventDefault();
      deferredPrompt = e;
      if (btnHeaderInstall) btnHeaderInstall.classList.add('has-alert');
      console.log('📲 Instalación WebAPK disponible en este dispositivo');
    });

    var openInstallDialog = function () {
      if (deferredPrompt) {
        deferredPrompt.prompt();
        deferredPrompt.userChoice.then(function () {
          deferredPrompt = null;
        });
      } else if (installModal) {
        updateTunnelInfoInModal();
        installModal.style.display = 'flex';
      }
    };

    function updateTunnelInfoInModal() {
      fetch('./api/tunnel').then(function (res) {
        return res.json();
      }).then(function (data) {
        var targetUrl = data.tunnel_url || data.local_ip_url || window.location.href;
        var input = document.getElementById('tunnelUrlInput');
        var qrImg = document.getElementById('qrCodeImg');
        var pwaBtn = document.getElementById('btnPwaBuilderLink');

        if (input) input.value = targetUrl;
        if (qrImg) qrImg.src = 'https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=' + encodeURIComponent(targetUrl);
        if (pwaBtn && data.tunnel_url) {
          pwaBtn.href = 'https://www.pwabuilder.com/reportcard?site=' + encodeURIComponent(data.tunnel_url);
        }
      }).catch(function () {
        var fallback = window.location.href;
        var input = document.getElementById('tunnelUrlInput');
        var qrImg = document.getElementById('qrCodeImg');
        if (input) input.value = fallback;
        if (qrImg) qrImg.src = 'https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=' + encodeURIComponent(fallback);
      });
    }

    var btnCopy = document.getElementById('btnCopyTunnelUrl');
    if (btnCopy) {
      btnCopy.addEventListener('click', function () {
        var input = document.getElementById('tunnelUrlInput');
        if (input) {
          navigator.clipboard.writeText(input.value).catch(function () {
            input.select();
            document.execCommand('copy');
          });
        }
      });
    }

    if (btnHeaderInstall) btnHeaderInstall.addEventListener('click', openInstallDialog);
    if (btnInstallAppPrompt) btnInstallAppPrompt.addEventListener('click', openInstallDialog);
    if (btnTriggerPwaInstall) btnTriggerPwaInstall.addEventListener('click', openInstallDialog);

    var closeDialog = function () {
      if (installModal) installModal.style.display = 'none';
    };
    if (btnClose) btnClose.addEventListener('click', closeDialog);
    if (btnDismiss) btnDismiss.addEventListener('click', closeDialog);
  }

  async function connectClaudeDoc() {
    try {
      var c = window.claude;
      if (!c || !c.use) return;
      var user = await c.use('user');
      var db = await c.use('db');
      if (!user || !db) return;
      var id = await user.id();
      if (!id) return;
      var ref = db.doc('data/users/' + id + '/whider');
      ref.onSnapshot(function (snap) {
        if (snap.metadata && snap.metadata.hasPendingWrites) return;
        if (snap.exists) {
          var d = snap.data();
          if (d && Array.isArray(d.tasks)) {
            Whider.State.tasks = d.tasks;
            Whider.State.saveLocal();
            Whider.State.notify();
          }
        }
      }, function () {});
    } catch (e) {}
  }

  // Ejecutar cuando el DOM esté listo
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
  } else {
    initApp();
  }
})();
