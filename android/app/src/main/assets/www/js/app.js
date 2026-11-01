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
        closeTopLayer();
        return;
      }
      var tag = document.activeElement ? document.activeElement.tagName : '';
      if (e.key === '/' && tag !== 'INPUT' && tag !== 'TEXTAREA' && tag !== 'SELECT') {
        var quickInput = document.getElementById('quickTaskInput');
        if (quickInput) {
          e.preventDefault();
          Whider.Router.navigate('tasks');
          quickInput.focus();
        }
      }
    });

    // 6b. Al cambiar de día con la app abierta, refrescar fechas, rachas y avisos
    var lastDay = Whider.State.today();
    setInterval(function () {
      var now = Whider.State.today();
      if (now !== lastDay) {
        lastDay = now;
        Whider.Router.renderActiveScreen(Whider.State.activeScreen);
      }
    }, 60000);

    // 7. Registro de Service Worker (PWA & Offline WebAPK)
    initServiceWorker();

    // 8. Gestor de Instalación Nativa (WebAPK / PWA)
    initInstallPrompt();

    // 9. Conexión opcional a Cloud (window.claude) si está disponible
    connectClaudeDoc();

    console.log('✅ Whider Pro listo y operativo.');
  }

  var deferredPrompt = null;

  function isVisible(id) {
    var n = document.getElementById(id);
    return !!n && n.style.display !== 'none';
  }

  function hide(id) {
    var n = document.getElementById(id);
    if (n) n.style.display = 'none';
  }

  // Cierra la capa superior abierta (modal o menú). Devuelve true si cerró algo.
  function closeTopLayer() {
    if (isVisible('editModal')) { hide('editModal'); return true; }
    if (isVisible('accountModal')) { hide('accountModal'); return true; }
    if (isVisible('installModal')) { hide('installModal'); return true; }
    if (Whider.Premium && Whider.Premium.isDrawerOpen && Whider.Premium.isDrawerOpen()) {
      Whider.Premium.closeDrawer();
      return true;
    }
    return false;
  }

  // Botón "atrás" de Android: cierra capas, vuelve a Inicio y solo entonces sale.
  // La app nativa (MainActivity) lo invoca y espera true si la web gestionó el gesto.
  function handleBack() {
    if (closeTopLayer()) return true;
    if (Whider.State.activeScreen && Whider.State.activeScreen !== 'home') {
      Whider.Router.navigate('home');
      return true;
    }
    return false;
  }

  Whider.App = { handleBack: handleBack, closeTopLayer: closeTopLayer };

  function isStandalone() {
    return !!window.WhiderAndroid ||
      (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) ||
      window.navigator.standalone === true;
  }

  function initServiceWorker() {
    // Los Service Workers solo funcionan en HTTPS o localhost (no en file:// ni en el WebView de assets)
    if ('serviceWorker' in navigator && window.isSecureContext && (window.location.protocol === 'http:' || window.location.protocol === 'https:')) {
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

    // Ya instalada (APK nativo o PWA abierta como app): no tiene sentido ofrecer la instalación
    var installCard = btnInstallAppPrompt ? btnInstallAppPrompt.closest('.settings-section-card') : null;
    if (installCard && isStandalone()) installCard.style.display = 'none';

    window.addEventListener('beforeinstallprompt', function (e) {
      e.preventDefault();
      deferredPrompt = e;
      if (btnHeaderInstall) btnHeaderInstall.classList.add('has-alert');
      console.log('📲 Instalación WebAPK disponible en este dispositivo');
    });

    window.addEventListener('appinstalled', function () {
      deferredPrompt = null;
      if (installModal) installModal.style.display = 'none';
      if (Whider.Toast) Whider.Toast.show('¡WHIDER PRO instalada en tu dispositivo!', 'success');
    });

    var openInstallDialog = function () {
      if (deferredPrompt) {
        var promptEvent = deferredPrompt;
        deferredPrompt = null; // Un evento de instalación solo puede usarse una vez
        if (installModal) installModal.style.display = 'none';
        promptEvent.prompt();
        promptEvent.userChoice.then(function (choice) {
          if (choice && choice.outcome === 'accepted' && Whider.Toast) {
            Whider.Toast.show('Instalando WHIDER PRO…', 'success');
          }
        }).catch(function () {});
      } else if (installModal) {
        updateTunnelInfoInModal();
        installModal.style.display = 'flex';
      }
    };

    function setQr(url) {
      var input = document.getElementById('tunnelUrlInput');
      var qrImg = document.getElementById('qrCodeImg');
      if (input) input.value = url;
      if (qrImg) {
        qrImg.onerror = function () { qrImg.style.display = 'none'; };
        qrImg.style.display = 'block';
        qrImg.src = 'https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=' + encodeURIComponent(url);
      }
    }

    function currentAppUrl() {
      return window.location.href.split('#')[0];
    }

    function updateTunnelInfoInModal() {
      var pwaBtn = document.getElementById('btnPwaBuilderLink');
      // /api/tunnel solo existe cuando se sirve con serve.py
      if (window.location.protocol !== 'http:' && window.location.protocol !== 'https:') {
        setQr(currentAppUrl());
        return;
      }
      fetch('./api/tunnel', { cache: 'no-store' }).then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      }).then(function (data) {
        var targetUrl = (data && (data.tunnel_url || data.local_ip_url)) || currentAppUrl();
        setQr(targetUrl);
        var publicUrl = data && data.tunnel_url;
        if (!publicUrl && window.location.protocol === 'https:') publicUrl = currentAppUrl();
        if (pwaBtn && publicUrl) {
          pwaBtn.href = 'https://www.pwabuilder.com/reportcard?site=' + encodeURIComponent(publicUrl);
        }
      }).catch(function () {
        setQr(currentAppUrl());
        if (pwaBtn && window.location.protocol === 'https:') {
          pwaBtn.href = 'https://www.pwabuilder.com/reportcard?site=' + encodeURIComponent(currentAppUrl());
        }
      });
    }

    function legacyCopy(input) {
      try {
        input.removeAttribute('readonly');
        input.select();
        input.setSelectionRange(0, input.value.length);
        var ok = document.execCommand('copy');
        input.setAttribute('readonly', '');
        return ok;
      } catch (e) {
        input.setAttribute('readonly', '');
        return false;
      }
    }

    var btnCopy = document.getElementById('btnCopyTunnelUrl');
    if (btnCopy) {
      btnCopy.addEventListener('click', function () {
        var input = document.getElementById('tunnelUrlInput');
        if (!input) return;
        var done = function (ok) {
          if (Whider.Toast) Whider.Toast.show(ok ? 'Enlace copiado al portapapeles' : 'No se pudo copiar el enlace', ok ? 'success' : 'danger');
        };
        // navigator.clipboard no existe en HTTP sin cifrar (p. ej. la IP Wi-Fi del PC)
        if (navigator.clipboard && navigator.clipboard.writeText && window.isSecureContext) {
          navigator.clipboard.writeText(input.value).then(function () { done(true); })
            .catch(function () { done(legacyCopy(input)); });
        } else {
          done(legacyCopy(input));
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
    if (installModal) {
      installModal.addEventListener('click', function (e) {
        if (e.target === installModal) closeDialog();
      });
    }
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
          // importJSON sanea los datos remotos antes de sustituir los locales
          if (d && Array.isArray(d.tasks)) {
            Whider.State.importJSON(JSON.stringify({ tasks: d.tasks }));
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
