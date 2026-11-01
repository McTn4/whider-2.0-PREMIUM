/**
 * WHIDER PRO - PANTALLA 3: CENTRO DE AVISOS & ADVERTENCIAS (SCREEN LOGIC)
 */
window.Whider = window.Whider || {};
window.Whider.Screens = window.Whider.Screens || {};

(function () {
  'use strict';

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  Whider.Screens.Warnings = {
    init: function () {
      var btnTest = document.getElementById('btnTestWarningTone');
      if (btnTest) {
        btnTest.addEventListener('click', function () {
          Whider.Audio.playWarningSound();
          Whider.Audio.vibrate([60, 80, 60]);
        });
      }

      var btnReq = document.getElementById('btnReqNotifWarnings');
      if (btnReq) {
        btnReq.addEventListener('click', function () {
          Whider.Notifications.requestPermission();
        });
      }
    },

    render: function () {
      var container = document.getElementById('warningsListContainer');
      if (!container) return;
      container.textContent = '';

      var activeWarnings = Whider.State.getUncompletedWarnings();
      var heroCard = document.getElementById('warningsHeroCard');
      var heroDesc = document.getElementById('warningsHeroDesc');

      if (heroCard) {
        heroCard.classList.toggle('has-danger', activeWarnings.length > 0);
      }

      if (heroDesc) {
        if (activeWarnings.length === 0) {
          heroDesc.textContent = 'No hay advertencias activas. Todas tus tareas marcadas están al día.';
        } else {
          heroDesc.textContent = 'Tienes ' + activeWarnings.length + (activeWarnings.length === 1 ? ' tarea que requiere atención inmediata antes de que venza.' : ' tareas que requieren atención inmediata antes de que venzan.');
        }
      }

      if (!activeWarnings.length) {
        var empty = el('div', 'card');
        empty.style.textAlign = 'center';
        empty.style.padding = '36px 16px';
        empty.style.display = 'flex';
        empty.style.flexDirection = 'column';
        empty.style.alignItems = 'center';
        empty.style.gap = '10px';
        empty.innerHTML = '<svg class="icon-lg" style="color: var(--success); width: 32px; height: 32px;" viewBox="0 0 24 24"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg><h4 style="font-size: 16px; font-weight: 700; color: var(--text-primary);">Todo al día</h4><p style="font-size: 13px; color: var(--text-secondary); max-width: 320px;">No tienes tareas retrasadas ni pendientes de advertencia en este momento.</p>';
        container.appendChild(empty);
        return;
      }

      var td = Whider.State.today();
      var curTime = Whider.State.currentTimeStr();

      activeWarnings.forEach(function (t) {
        var isLate = t.date && t.date < td;
        var isTimeLate = t.date === td && t.time && t.time <= curTime;

        var card = el('div', 'warning-item-card ' + (isLate || isTimeLate ? 'is-danger' : 'is-warn'));

        // Cabecera del aviso
        var head = el('div', 'warning-item-header');
        head.appendChild(el('span', 'warning-title', t.text));

        var pillText = isLate ? 'Vencida' : isTimeLate ? 'Plazo cumplido' : 'Aviso activo';
        var pill = el('span', 'warning-status-pill ' + (isLate || isTimeLate ? 'danger' : 'warn'), pillText);
        head.appendChild(pill);
        card.appendChild(head);

        // Detalles de plazo
        var details = el('div', 'warning-details-row');
        var timeInfo = t.date ? 'Fecha: ' + (t.date === td ? 'Hoy' : t.date) : 'Sin fecha fija';
        if (t.time) timeInfo += ' a las ' + t.time;
        details.textContent = timeInfo;
        card.appendChild(details);

        // Botones de acción rápida en el aviso
        var actions = el('div', 'warning-actions-row');

        var btnDone = el('button', 'btn btn-primary', 'Completar');
        btnDone.style.minHeight = '34px';
        btnDone.style.padding = '6px 16px';
        btnDone.style.fontSize = '12.5px';
        btnDone.addEventListener('click', function () {
          Whider.State.toggleDone(t.id);
          Whider.Audio.playSuccessSound();
          Whider.Audio.vibrate([30, 40]);
        });
        actions.appendChild(btnDone);

        var btnSnooze1h = el('button', 'btn btn-ghost', '+1h');
        btnSnooze1h.style.padding = '6px 10px';
        btnSnooze1h.style.fontSize = '12px';
        btnSnooze1h.title = 'Posponer 1 hora';
        btnSnooze1h.addEventListener('click', function () {
          Whider.State.snoozeTask(t.id, 1);
          Whider.Audio.vibrate([15]);
        });
        actions.appendChild(btnSnooze1h);

        var btnSnoozeDay = el('button', 'btn btn-ghost', 'Para mañana');
        btnSnoozeDay.style.padding = '6px 10px';
        btnSnoozeDay.style.fontSize = '12px';
        btnSnoozeDay.title = 'Posponer para mañana';
        btnSnoozeDay.addEventListener('click', function () {
          Whider.State.snoozeTask(t.id, 24);
          Whider.Audio.vibrate([15]);
        });
        actions.appendChild(btnSnoozeDay);

        card.appendChild(actions);
        container.appendChild(card);
      });
    }
  };
})();
