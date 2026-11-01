/**
 * WHIDER PRO - PANTALLA 5: AJUSTES & CONFIGURACIÓN (SCREEN LOGIC)
 */
window.Whider = window.Whider || {};
window.Whider.Screens = window.Whider.Screens || {};

(function () {
  'use strict';

  Whider.Screens.Settings = {
    init: function () {
      // Toggle de Sonido
      var chkSound = document.getElementById('settingSoundToggle');
      if (chkSound) {
        chkSound.checked = Whider.State.settings.sound;
        chkSound.addEventListener('change', function () {
          Whider.State.settings.sound = this.checked;
          Whider.State.saveLocal();
          if (this.checked) Whider.Audio.playSuccessSound();
        });
      }

      // Toggle de Vibración Háptica
      var chkVibrate = document.getElementById('settingVibrateToggle');
      if (chkVibrate) {
        chkVibrate.checked = Whider.State.settings.vibrate;
        chkVibrate.addEventListener('change', function () {
          Whider.State.settings.vibrate = this.checked;
          Whider.State.saveLocal();
          if (this.checked) Whider.Audio.vibrate([30]);
        });
      }

      // Botón de Solicitar Permiso de Notificaciones
      var btnReqNotif = document.getElementById('btnReqNotifSettings');
      if (btnReqNotif) {
        btnReqNotif.addEventListener('click', async function () {
          await Whider.Notifications.requestPermission();
          Whider.Screens.Settings.render();
        });
      }

      // Exportar JSON
      var btnExport = document.getElementById('btnExportBackup');
      if (btnExport) {
        btnExport.addEventListener('click', function () {
          var jsonStr = Whider.State.exportJSON();
          var fileName = 'whider-pro-backup-' + Whider.State.today() + '.json';

          // En la app Android (WebView) las descargas blob: no funcionan: se guarda vía puente nativo
          var bridge = window.WhiderAndroid;
          if (bridge && typeof bridge.saveFile === 'function') {
            var savedOk = false;
            try { savedOk = bridge.saveFile(fileName, jsonStr); } catch (e) { savedOk = false; }
            Whider.Toast.show(savedOk ? 'Copia guardada en Descargas: ' + fileName : 'No se pudo guardar la copia', savedOk ? 'success' : 'danger');
            return;
          }

          var blob = new Blob([jsonStr], { type: 'application/json' });
          var url = URL.createObjectURL(blob);
          var a = document.createElement('a');
          a.href = url;
          a.download = fileName;
          a.style.display = 'none';
          document.body.appendChild(a); // Firefox necesita el enlace en el DOM
          a.click();
          // Revocar inmediatamente cancela la descarga en algunos navegadores
          setTimeout(function () {
            URL.revokeObjectURL(url);
            if (a.parentNode) a.parentNode.removeChild(a);
          }, 1500);
          Whider.Toast.show('Copia de seguridad exportada', 'success');
        });
      }

      // Importar JSON
      var fileInput = document.getElementById('fileImportBackup');
      if (fileInput) {
        fileInput.addEventListener('change', function (e) {
          var file = e.target.files[0];
          if (!file) return;

          var reader = new FileReader();
          reader.onload = function (evt) {
            var current = Whider.State.tasks.length;
            if (current > 0 && !window.confirm('Importar la copia sustituirá tus ' + current + ' tareas actuales. ¿Continuar?')) {
              fileInput.value = '';
              return;
            }
            var success = Whider.State.importJSON(evt.target.result);
            if (success) {
              Whider.Audio.playSuccessSound();
              Whider.Screens.Settings.render();
              Whider.Toast.show('Copia importada: ' + Whider.State.tasks.length + ' tareas', 'success');
            } else {
              Whider.Toast.show('El archivo JSON no tiene un formato válido', 'danger');
            }
            fileInput.value = ''; // Permite volver a importar el mismo archivo
          };
          reader.onerror = function () {
            Whider.Toast.show('No se pudo leer el archivo', 'danger');
            fileInput.value = '';
          };
          reader.readAsText(file);
        });
      }

      // Reset de datos
      var btnReset = document.getElementById('btnResetAllData');
      if (btnReset) {
        btnReset.addEventListener('click', function () {
          if (window.confirm('¿Estás seguro de que quieres eliminar todas las tareas? Esta acción no se puede deshacer.')) {
            Whider.State.resetAll();
            Whider.Screens.Settings.render();
            Whider.Toast.show('Todos los datos se han restablecido');
          }
        });
      }
    },

    render: function () {
      // Estado del Permiso de Notificaciones
      var chkSound = document.getElementById('settingSoundToggle');
      if (chkSound) chkSound.checked = !!Whider.State.settings.sound;
      var chkVibrate = document.getElementById('settingVibrateToggle');
      if (chkVibrate) chkVibrate.checked = !!Whider.State.settings.vibrate;

      var permLabel = document.getElementById('settingNotifStatusLabel');
      var btnReq = document.getElementById('btnReqNotifSettings');
      if (permLabel) {
        var perm = Whider.Notifications.getPermission();
        if (btnReq) btnReq.disabled = perm === 'granted' || perm === 'unsupported';
        if (perm === 'granted') {
          permLabel.textContent = 'Permiso concedido (Activo) ✓';
          permLabel.style.color = 'var(--success)';
        } else if (perm === 'denied') {
          permLabel.textContent = 'Bloqueado por el navegador ✗';
          permLabel.style.color = 'var(--danger)';
        } else if (perm === 'unsupported') {
          permLabel.textContent = 'No soportado en este dispositivo';
          permLabel.style.color = 'var(--text-muted)';
        } else {
          permLabel.textContent = 'Pendiente de solicitud';
          permLabel.style.color = 'var(--warn)';
        }
      }

      // Estado del almacenamiento
      var storageLabel = document.getElementById('settingStorageCount');
      if (storageLabel) {
        var n = Whider.State.tasks.length;
        storageLabel.textContent = n + (n === 1 ? ' tarea almacenada' : ' tareas almacenadas') + ' localmente';
      }
    }
  };
})();
