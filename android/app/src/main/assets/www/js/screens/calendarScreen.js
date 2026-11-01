/**
 * WHIDER PRO - PANTALLA 2: CALENDARIO (SCREEN LOGIC)
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

  Whider.Screens.Calendar = {
    init: function () {
      var btnPrev = document.getElementById('calBtnPrev');
      var btnNext = document.getElementById('calBtnNext');
      var btnToday = document.getElementById('calBtnToday');

      if (btnPrev) {
        btnPrev.addEventListener('click', function () {
          Whider.State.calMonth.m--;
          if (Whider.State.calMonth.m < 0) {
            Whider.State.calMonth.m = 11;
            Whider.State.calMonth.y--;
          }
          Whider.Screens.Calendar.render();
          Whider.Audio.vibrate([10]);
        });
      }

      if (btnNext) {
        btnNext.addEventListener('click', function () {
          Whider.State.calMonth.m++;
          if (Whider.State.calMonth.m > 11) {
            Whider.State.calMonth.m = 0;
            Whider.State.calMonth.y++;
          }
          Whider.Screens.Calendar.render();
          Whider.Audio.vibrate([10]);
        });
      }

      if (btnToday) {
        btnToday.addEventListener('click', function () {
          var now = new Date();
          Whider.State.calMonth = { y: now.getFullYear(), m: now.getMonth() };
          Whider.State.selectedCalDate = Whider.State.today();
          Whider.Screens.Calendar.render();
          Whider.Audio.vibrate([15]);
        });
      }
    },

    render: function () {
      var td = Whider.State.today();
      var cur = Whider.State.calMonth;
      var selected = Whider.State.selectedCalDate;

      // Actualizar Cabecera del Mes
      var monthLabel = document.getElementById('calMonthHeading');
      if (monthLabel) {
        var fmtMonth = new Intl.DateTimeFormat('es-ES', { month: 'long', year: 'numeric' });
        monthLabel.textContent = fmtMonth.format(new Date(cur.y, cur.m, 1));
      }

      // Generar Grid
      var grid = document.getElementById('calGrid');
      if (!grid) return;
      grid.textContent = '';

      // Encabezados de días
      ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].forEach(function (wd) {
        grid.appendChild(el('div', 'cal-weekday', wd));
      });

      var lead = (new Date(cur.y, cur.m, 1).getDay() + 6) % 7;
      var daysInMonth = new Date(cur.y, cur.m + 1, 0).getDate();

      // Celdas en blanco iniciales
      for (var b = 0; b < lead; b++) {
        grid.appendChild(el('div', 'cal-day-cell blank'));
      }

      // Mapear tareas pendientes por fecha
      var pendingByDate = {};
      var hasWarnByDate = {};
      Whider.State.tasks.forEach(function (t) {
        if (!t.done && t.date) {
          pendingByDate[t.date] = (pendingByDate[t.date] || 0) + 1;
          if (t.warn) hasWarnByDate[t.date] = true;
        }
      });

      // Renderizar días del mes
      for (var d = 1; d <= daysInMonth; d++) {
        (function (dayNum) {
          var dateStr = Whider.State.ymd(new Date(cur.y, cur.m, dayNum));
          var count = pendingByDate[dateStr] || 0;
          var hasWarn = hasWarnByDate[dateStr];
          var isToday = dateStr === td;
          var isSelected = dateStr === selected;

          var cellCls = 'cal-day-cell';
          if (isToday) cellCls += ' today';
          if (isSelected) cellCls += ' selected';

          var cell = el('div', cellCls);
          cell.appendChild(el('span', 'cal-day-num', String(dayNum)));

          var dots = el('div', 'cal-dots-row');
          if (count > 0) {
            var dotCls = 'cal-dot';
            if (hasWarn) dotCls += ' warn';
            else if (dateStr < td) dotCls += ' late';
            dots.appendChild(el('span', dotCls));
            if (count > 1) {
              dots.appendChild(el('span', 'cal-dot'));
            }
          }
          cell.appendChild(dots);

          cell.addEventListener('click', function () {
            Whider.State.selectedCalDate = dateStr;
            Whider.Screens.Calendar.render();
            Whider.Audio.vibrate([10]);
          });

          grid.appendChild(cell);
        })(d);
      }

      // Renderizar Agenda del Día Seleccionado
      var agendaContainer = document.getElementById('dayAgendaContainer');
      var agendaTitle = document.getElementById('dayAgendaTitle');

      if (agendaTitle) {
        var fmtFull = new Intl.DateTimeFormat('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
        agendaTitle.textContent = fmtFull.format(Whider.State.parseDate(selected));
      }

      if (agendaContainer) {
        agendaContainer.textContent = '';
        var dayTasks = Whider.State.tasks.filter(function (t) { return t.date === selected; })
          .sort(function (a, b) { return a.done === b.done ? 0 : a.done ? 1 : -1; });

        if (!dayTasks.length) {
          var empty = el('div', 'card');
          empty.style.textAlign = 'center';
          empty.style.padding = '24px 16px';
          empty.style.color = 'var(--text-muted)';
          empty.innerHTML = '<p style="font-size: 13.5px;">No hay tareas programadas para este día.</p>';
          agendaContainer.appendChild(empty);
        } else {
          var ul = el('ul', 'tasks-list');
          dayTasks.forEach(function (t) {
            // Reutiliza la función de render de tarjeta
            var li = el('li', 'task-card' + (t.done ? ' done' : '') + (t.highlight !== 'none' ? ' hl-' + t.highlight : ''));
            var cb = el('button', 'check-trigger', t.done ? '✓' : '');
            cb.addEventListener('click', function () {
              Whider.State.toggleDone(t.id);
            });
            li.appendChild(cb);

            var main = el('div', 'task-main');
            main.addEventListener('click', function () { Whider.Modal.open(t.id); });
            main.appendChild(el('span', 'task-title', t.text));

            var badges = el('div', 'task-meta');
            if (t.time) badges.appendChild(el('span', null, t.time));
            if (t.warn) badges.appendChild(el('span', 'badge', 'Con aviso'));
            if (badges.children.length > 0) main.appendChild(badges);
            li.appendChild(main);

            ul.appendChild(li);
          });
          agendaContainer.appendChild(ul);
        }
      }
    }
  };
})();
