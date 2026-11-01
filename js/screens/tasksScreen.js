/**
 * WHIDER - PANTALLA DE TAREAS (lógica)
 * Tarjeta de progreso, lista en píldoras y entrada rápida.
 */
window.Whider = window.Whider || {};
window.Whider.Screens = window.Whider.Screens || {};

(function () {
  'use strict';

  var currentHighlightSelection = 'none';
  var firstRender = true;

  var ICON_BELL = '<svg class="icon-sm" viewBox="0 0 24 24"><path d="M10.268 21a2 2 0 0 0 3.464 0"/><path d="M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326"/></svg>';
  var HL_NAMES = { star: 'Destacada', danger: 'Urgente', purple: 'Prioridad' };

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  function formatDisplayDate(dateStr) {
    if (!dateStr) return '';
    var td = Whider.State.today();
    if (dateStr === td) return 'Hoy';
    if (dateStr === Whider.State.addDays(td, 1)) return 'Mañana';
    if (dateStr === Whider.State.addDays(td, -1)) return 'Ayer';
    return dateStr;
  }

  // "Viernes 30 de Octubre"
  function formatTodayLabel(d) {
    var s = new Intl.DateTimeFormat('es-ES', { weekday: 'long', day: 'numeric', month: 'long' }).format(d).replace(',', '');
    return s.split(' ').map(function (w) {
      return w === 'de' ? w : w.charAt(0).toUpperCase() + w.slice(1);
    }).join(' ');
  }

  function createTaskCardElement(t) {
    var td = Whider.State.today();
    var curTime = Whider.State.currentTimeStr();
    var isLate = !t.done && t.date && t.date < td;
    var isTimeLate = !t.done && t.date === td && t.time && t.time < curTime;
    var isLateWarn = !t.done && t.warn && (isLate || isTimeLate);

    var cardCls = 'task-card';
    if (t.done) cardCls += ' done';
    if (t.highlight && t.highlight !== 'none') cardCls += ' hl-' + t.highlight;
    if (isLateWarn) cardCls += ' is-overdue';

    var li = el('li', cardCls);

    // Círculo para completar
    var checkBtn = el('button', 'check-trigger', t.done ? '✓' : '');
    checkBtn.type = 'button';
    checkBtn.setAttribute('aria-label', (t.done ? 'Marcar incompleta: ' : 'Completar: ') + t.text);
    checkBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      var updated = Whider.State.toggleDone(t.id);
      if (updated && updated.done) {
        Whider.Audio.playSuccessSound();
        Whider.Audio.vibrate([25, 40]);
      } else {
        Whider.Audio.vibrate([12]);
      }
    });
    li.appendChild(checkBtn);

    // Título + fecha/hora (toque para editar)
    var main = el('div', 'task-main');
    main.addEventListener('click', function () {
      Whider.Modal.open(t.id);
      Whider.Audio.vibrate([10]);
    });
    main.appendChild(el('span', 'task-title', t.text));

    var parts = [];
    if (t.date) parts.push(formatDisplayDate(t.date));
    if (t.time) parts.push(t.time);
    if (parts.length || t.example) {
      var meta = el('div', 'task-meta' + (isLate || isTimeLate ? ' late' : ''));
      if (parts.length) meta.appendChild(el('span', null, parts.join(' · ')));
      if (t.example) meta.appendChild(el('span', 'badge', 'ejemplo'));
      main.appendChild(meta);
    }
    li.appendChild(main);

    // Indicadores: remarcado (punto de color) y aviso (campana)
    var flags = el('div', 'task-flags');
    if (t.highlight && t.highlight !== 'none') {
      var dot = el('span', 'flag-dot hl-' + t.highlight);
      dot.title = HL_NAMES[t.highlight] || '';
      flags.appendChild(dot);
    }
    if (t.warn) {
      var bell = el('span', 'flag-bell' + (isLateWarn ? ' late' : ''));
      bell.innerHTML = ICON_BELL;
      bell.title = isLateWarn ? 'Vencida con aviso' : 'Con aviso';
      flags.appendChild(bell);
    }
    if (flags.children.length) li.appendChild(flags);

    return li;
  }

  function renderGroup(title, tasks, isLate, isStar) {
    if (!tasks || !tasks.length) return null;
    var group = el('div', 'tasks-group');
    var titleRow = el('div', 'group-title-row');

    var titleCls = 'group-title';
    if (isLate) titleCls += ' late';
    if (isStar) titleCls += ' star';

    titleRow.appendChild(el('span', titleCls, title + ' · ' + tasks.length));
    group.appendChild(titleRow);

    var ul = el('ul', 'tasks-list');
    tasks.forEach(function (t) {
      ul.appendChild(createTaskCardElement(t));
    });
    group.appendChild(ul);
    return group;
  }

  function byDate(a, b) {
    var da = (a.date || '') + ' ' + (a.time || '00:00');
    var db = (b.date || '') + ' ' + (b.time || '00:00');
    return da < db ? -1 : da > db ? 1 : 0;
  }

  Whider.Screens.Tasks = {
    init: function () {
      // Formulario de nueva tarea
      var form = document.getElementById('taskCaptureForm');
      if (form) {
        form.addEventListener('submit', function (e) {
          e.preventDefault();
          var input = document.getElementById('quickTaskInput');
          var text = input.value.trim();
          if (!text) return;

          var date = document.getElementById('quickTaskDate').value || null;
          var time = document.getElementById('quickTaskTime').value || null;
          var warn = document.getElementById('quickTaskWarn').checked;

          Whider.State.addTask(text, date, time, currentHighlightSelection, warn);
          input.value = '';
          input.focus();
          Whider.Audio.vibrate([20]);

          if (warn && Whider.Notifications.getPermission() === 'default') {
            Whider.Notifications.requestPermission();
          }
        });
      }

      // Panel de opciones (fecha, hora, remarcado, aviso)
      var btnOpts = document.getElementById('btnCaptureOptions');
      var optsPanel = document.getElementById('captureOptions');
      if (btnOpts && optsPanel) {
        btnOpts.addEventListener('click', function () {
          var open = optsPanel.classList.toggle('open');
          btnOpts.classList.toggle('active', open);
          btnOpts.setAttribute('aria-expanded', open ? 'true' : 'false');
          Whider.Audio.vibrate([10]);
        });
      }

      // Chips de fecha rápida
      var chipToday = document.getElementById('chipQuickToday');
      var chipTomorrow = document.getElementById('chipQuickTomorrow');
      var chipSomeday = document.getElementById('chipQuickSomeday');
      var dateInput = document.getElementById('quickTaskDate');

      function setActiveChip(btn) {
        [chipToday, chipTomorrow, chipSomeday].forEach(function (c) { if (c) c.classList.remove('active'); });
        if (btn) btn.classList.add('active');
      }

      if (chipToday) {
        chipToday.addEventListener('click', function () {
          dateInput.value = Whider.State.today();
          setActiveChip(chipToday);
        });
      }
      if (chipTomorrow) {
        chipTomorrow.addEventListener('click', function () {
          dateInput.value = Whider.State.addDays(Whider.State.today(), 1);
          setActiveChip(chipTomorrow);
        });
      }
      if (chipSomeday) {
        chipSomeday.addEventListener('click', function () {
          dateInput.value = '';
          setActiveChip(chipSomeday);
        });
      }

      // Selector de remarcado
      var hlChips = document.querySelectorAll('.hl-chip');
      hlChips.forEach(function (chip) {
        chip.addEventListener('click', function () {
          hlChips.forEach(function (c) { c.classList.remove('active'); });
          chip.classList.add('active');
          currentHighlightSelection = chip.getAttribute('data-hl') || 'none';
          Whider.Audio.vibrate([10]);
        });
      });

      // Interruptor visual de aviso
      var warnBox = document.getElementById('switchQuickWarn');
      var warnCheckbox = document.getElementById('quickTaskWarn');
      if (warnBox && warnCheckbox) {
        warnBox.addEventListener('click', function () {
          setTimeout(function () {
            warnBox.classList.toggle('active', warnCheckbox.checked);
          }, 10);
        });
      }

      // Filtro de la lista
      var filterSel = document.getElementById('taskFilterSelect');
      if (filterSel) {
        filterSel.addEventListener('change', function () {
          Whider.State.filter = filterSel.value || 'all';
          Whider.Screens.Tasks.render();
          Whider.Audio.vibrate([10]);
        });
      }

      // Fecha por defecto: hoy
      if (dateInput) dateInput.value = Whider.State.today();
    },

    render: function () {
      var td = Whider.State.today();
      var tasks = Whider.State.tasks;

      // Tarjeta de progreso
      var todayLabel = document.getElementById('todayDateLabel');
      if (todayLabel) todayLabel.textContent = formatTodayLabel(new Date());

      var todays = tasks.filter(function (t) { return t.date === td; });
      var doneCount = todays.filter(function (t) { return t.done; }).length;
      var totalToday = todays.length;
      var pct = totalToday > 0 ? Math.round((doneCount / totalToday) * 100) : 0;

      var progCount = document.getElementById('todayProgressCount');
      if (progCount) progCount.textContent = doneCount + '/' + totalToday;

      var progFill = document.getElementById('todayProgressBarFill');
      if (progFill) progFill.style.width = pct + '%';

      var track = document.querySelector('.progress-track');
      if (track) track.setAttribute('aria-valuenow', String(pct));

      var streakPill = document.getElementById('todayStreakValue');
      if (streakPill) {
        var streak = Whider.State.getStreak();
        streakPill.textContent = 'Racha: ' + streak + (streak === 1 ? ' día' : ' días');
      }

      var filterSel = document.getElementById('taskFilterSelect');
      if (filterSel && filterSel.value !== Whider.State.filter) filterSel.value = Whider.State.filter;

      // Lista de tareas
      var container = document.getElementById('tasksListContainer');
      if (!container) return;
      container.textContent = '';
      container.classList.toggle('enter', firstRender);
      if (firstRender) {
        firstRender = false;
        setTimeout(function () { container.classList.remove('enter'); }, 1200);
      }

      var list = tasks.slice();

      if (Whider.State.filter === 'highlighted') {
        list = list.filter(function (t) { return t.highlight && t.highlight !== 'none'; });
      } else if (Whider.State.filter === 'warns') {
        list = list.filter(function (t) { return t.warn; });
      } else if (Whider.State.filter === 'today') {
        list = list.filter(function (t) { return t.date === td; });
      } else if (Whider.State.filter === 'late') {
        list = list.filter(function (t) { return !t.done && t.date && t.date < td; });
      } else if (Whider.State.filter === 'done') {
        list = list.filter(function (t) { return t.done; });
      }

      var pend = list.filter(function (t) { return !t.done; });

      var groups = [
        renderGroup('Vencidas', pend.filter(function (t) { return t.date && t.date < td; }).sort(byDate), true, false),
        renderGroup('Prioritarias', pend.filter(function (t) { return (!t.date || t.date >= td) && t.highlight && t.highlight !== 'none'; }).sort(byDate), false, true),
        renderGroup('Para hoy', pend.filter(function (t) { return t.date === td && (!t.highlight || t.highlight === 'none'); }).sort(byDate), false, false),
        renderGroup('Próximos días', pend.filter(function (t) { return t.date && t.date > td && (!t.highlight || t.highlight === 'none'); }).sort(byDate), false, false),
        renderGroup('Sin fecha', pend.filter(function (t) { return !t.date && (!t.highlight || t.highlight === 'none'); }), false, false),
        renderGroup('Completadas', list.filter(function (t) { return t.done; }).sort(function (a, b) { return (b.doneOn || '') < (a.doneOn || '') ? -1 : 1; }).slice(0, 30), false, false)
      ];

      var hasContent = false;
      groups.forEach(function (g) {
        if (g) { container.appendChild(g); hasContent = true; }
      });

      if (!hasContent) {
        var empty = el('div', 'empty-state');
        empty.appendChild(el('p', 'empty-note', Whider.State.filter === 'all' ? 'Aún no hay tareas. Escribe la primera abajo.' : 'No hay tareas en esta sección.'));
        container.appendChild(empty);
      }

      if (tasks.some(function (t) { return t.example; })) {
        var clearRow = el('div', 'examples-row');
        var btnClear = el('button', 'btn btn-ghost', 'Eliminar tareas de ejemplo');
        btnClear.type = 'button';
        btnClear.addEventListener('click', function () {
          Whider.State.clearExamples();
        });
        clearRow.appendChild(btnClear);
        container.appendChild(clearRow);
      }
    }
  };
})();
