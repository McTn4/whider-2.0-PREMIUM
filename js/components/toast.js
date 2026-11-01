/**
 * WHIDER PRO - COMPONENTE: TOAST FLOTANTE
 */
window.Whider = window.Whider || {};

(function () {
  'use strict';

  var MAX_TOASTS = 3;

  function removeToast(container, toast) {
    if (toast.parentNode === container) container.removeChild(toast);
  }

  Whider.Toast = {
    show: function (message, type, actionLabel, actionCallback) {
      var container = document.getElementById('toastContainer');
      if (!container) return;

      // Evita que una ráfaga de avisos llene la pantalla
      while (container.children.length >= MAX_TOASTS) {
        container.removeChild(container.firstChild);
      }

      var toast = document.createElement('div');
      toast.className = 'toast ' + (type || '');
      toast.setAttribute('role', type === 'danger' ? 'alert' : 'status');

      var span = document.createElement('span');
      span.textContent = message;
      toast.appendChild(span);

      if (actionLabel && typeof actionCallback === 'function') {
        var actionBtn = document.createElement('button');
        actionBtn.type = 'button';
        actionBtn.className = 'btn btn-primary';
        actionBtn.style.padding = '4px 10px';
        actionBtn.style.fontSize = '12px';
        actionBtn.textContent = actionLabel;
        actionBtn.addEventListener('click', function () {
          try { actionCallback(); } finally { removeToast(container, toast); }
        });
        toast.appendChild(actionBtn);
      }

      var closeBtn = document.createElement('button');
      closeBtn.type = 'button';
      closeBtn.className = 'icon-btn-action';
      closeBtn.textContent = '×';
      closeBtn.setAttribute('aria-label', 'Cerrar aviso');
      closeBtn.style.fontSize = '18px';
      closeBtn.addEventListener('click', function () {
        removeToast(container, toast);
      });
      toast.appendChild(closeBtn);

      container.appendChild(toast);

      // Los avisos con acción permanecen más tiempo para que dé tiempo a pulsarlos
      var ttl = actionLabel ? 9000 : 4000;
      setTimeout(function () {
        if (toast.parentNode === container) {
          toast.style.transition = 'all 0.3s ease';
          toast.style.opacity = '0';
          toast.style.transform = 'translateY(-20px)';
          setTimeout(function () { removeToast(container, toast); }, 300);
        }
      }, ttl);
    }
  };
})();
