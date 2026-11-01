/**
 * WHIDER PRO - COMPONENTE: MODAL BOTTOM-SHEET
 */
window.Whider = window.Whider || {};

(function () {
  'use strict';

  Whider.Modal = {
    init: function () {
      var backdrop = document.getElementById('editModal');
      var form = document.getElementById('editForm');
      var btnClose = document.getElementById('btnCloseModal');
      var btnCancel = document.getElementById('btnCancelModal');
      var btnDelete = document.getElementById('btnDeleteFromModal');

      if (!backdrop || !form) return;

      var close = function () {
        backdrop.style.display = 'none';
      };

      if (btnClose) btnClose.addEventListener('click', close);
      if (btnCancel) btnCancel.addEventListener('click', close);
      backdrop.addEventListener('click', function (e) {
        if (e.target === backdrop) close();
      });

      if (btnDelete) {
        btnDelete.addEventListener('click', function () {
          var id = document.getElementById('editTaskId').value;
          if (!id) return;
          if (!window.confirm('¿Eliminar esta tarea?')) return;
          Whider.State.removeTask(id);
          Whider.Audio.vibrate([20]);
          close();
          if (Whider.Toast) Whider.Toast.show('Tarea eliminada');
        });
      }

      form.addEventListener('submit', function (e) {
        e.preventDefault();
        var id = document.getElementById('editTaskId').value;
        var text = document.getElementById('editTaskText').value.trim();
        if (!text) return;

        var date = document.getElementById('editTaskDate').value || null;
        var time = document.getElementById('editTaskTime').value || null;
        var highlight = document.getElementById('editTaskHighlight').value;
        var warn = document.getElementById('editTaskWarn').checked;

        Whider.State.updateTask(id, {
          text: text,
          date: date,
          time: time,
          highlight: highlight,
          warn: warn
        });

        Whider.Audio.vibrate([15]);
        close();
      });
    },

    close: function () {
      var modal = document.getElementById('editModal');
      if (modal) modal.style.display = 'none';
    },

    isOpen: function () {
      var modal = document.getElementById('editModal');
      return !!modal && modal.style.display !== 'none';
    },

    open: function (taskId) {
      var t = Whider.State.find(taskId);
      if (!t) return;

      document.getElementById('editTaskId').value = t.id;
      document.getElementById('editTaskText').value = t.text;
      document.getElementById('editTaskDate').value = t.date || '';
      document.getElementById('editTaskTime').value = t.time || '';
      document.getElementById('editTaskHighlight').value = t.highlight || 'none';
      document.getElementById('editTaskWarn').checked = !!t.warn;

      var modal = document.getElementById('editModal');
      modal.style.display = 'flex';
      setTimeout(function () {
        document.getElementById('editTaskText').focus();
      }, 50);
    }
  };
})();
