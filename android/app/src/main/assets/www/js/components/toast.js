/**
 * WHIDER PRO - COMPONENTE: TOAST FLOTANTE
 */
window.Whider = window.Whider || {};

(function () {
  'use strict';

  Whider.Toast = {
    show: function (message, type, actionLabel, actionCallback) {
      var container = document.getElementById('toastContainer');
      if (!container) return;

      var toast = document.createElement('div');
      toast.className = 'toast ' + (type || '');

      var span = document.createElement('span');
      span.textContent = message;
      toast.appendChild(span);

      if (actionLabel && actionCallback) {
        var actionBtn = document.createElement('button');
        actionBtn.className = 'btn btn-primary';
        actionBtn.style.padding = '4px 10px';
        actionBtn.style.fontSize = '12px';
        actionBtn.textContent = actionLabel;
        actionBtn.addEventListener('click', function () {
          actionCallback();
          if (toast.parentNode === container) container.removeChild(toast);
        });
        toast.appendChild(actionBtn);
      }

      var closeBtn = document.createElement('button');
      closeBtn.className = 'icon-btn-action';
      closeBtn.textContent = '×';
      closeBtn.style.fontSize = '18px';
      closeBtn.addEventListener('click', function () {
        if (toast.parentNode === container) container.removeChild(toast);
      });
      toast.appendChild(closeBtn);

      container.appendChild(toast);

      setTimeout(function () {
        if (toast.parentNode === container) {
          toast.style.opacity = '0';
          toast.style.transform = 'translateY(-20px)';
          toast.style.transition = 'all 0.3s ease';
          setTimeout(function () {
            if (toast.parentNode === container) container.removeChild(toast);
          }, 300);
        }
      }, 5000);
    }
  };
})();
