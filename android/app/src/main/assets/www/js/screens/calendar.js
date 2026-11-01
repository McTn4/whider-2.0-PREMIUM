/**
 * WHIDER · Agenda: calendario mensual con mapa de carga, gesto de deslizar
 * para cambiar de mes y agenda del día seleccionado.
 */
window.Whider = window.Whider || {};
window.Whider.Screens = window.Whider.Screens || {};

(function (W) {
  'use strict';
  var U = W.U, S = function () { return W.State; };
  var slideDir = 0;

  function month(st) {
    if (!st.ui.calMonth) { var n = new Date(); st.ui.calMonth = { y: n.getFullYear(), m: n.getMonth() }; }
    return st.ui.calMonth;
  }
  function shift(st, delta) {
    var cm = month(st), d = new Date(cm.y, cm.m + delta, 1);
    st.ui.calMonth = { y: d.getFullYear(), m: d.getMonth() };
    slideDir = delta;
    W.Audio.tap();
  }

  function grid(st, root) {
    var cm = month(st), td = U.today(), sel = st.ui.calSelected;
    var ws = st.settings.weekStart; // 1 = lunes, 0 = domingo
    var g = U.el('div.cal-grid' + (slideDir > 0 ? '.slide-l' : slideDir < 0 ? '.slide-r' : ''));
    slideDir = 0;
    for (var i = 0; i < 7; i++) g.appendChild(U.el('span.cal-wd', { text: U.WEEKDAYS_SHORT[(i + ws) % 7] }));

    var first = new Date(cm.y, cm.m, 1), lead = (first.getDay() - ws + 7) % 7;
    var days = new Date(cm.y, cm.m + 1, 0).getDate();
    var load = {}, prio = {}, doneMap = {};
    st.tasks.forEach(function (t) {
      if (!t.date) return;
      if (t.done) { doneMap[t.date] = (doneMap[t.date] || 0) + 1; return; }
      load[t.date] = (load[t.date] || 0) + 1;
      if (t.highlight === 'danger' || (t.warn && !prio[t.date])) prio[t.date] = t.highlight === 'danger' ? 'danger' : 'warn';
    });
    var maxLoad = 1;
    Object.keys(load).forEach(function (k) { if (load[k] > maxLoad) maxLoad = load[k]; });

    for (var b = 0; b < lead; b++) g.appendChild(U.el('span.cal-blank'));
    for (var d = 1; d <= days; d++) {
      (function (day) {
        var ds = U.ymd(new Date(cm.y, cm.m, day));
        var n = load[ds] || 0, dn = doneMap[ds] || 0;
        var cls = 'button.cal-day' + (ds === td ? '.today' : '') + (ds === sel ? '.selected' : '') + (ds < td ? '.past' : '') + (n ? '.has' : '');
        var cell = U.el(cls, {
          style: n ? { '--heat': (0.12 + 0.5 * (n / maxLoad)).toFixed(2) } : null,
          attrs: { 'aria-label': U.fmtLong(ds) + (n ? ', ' + U.plural(n, 'pendiente', 'pendientes') : ''), 'aria-pressed': ds === sel ? 'true' : 'false' }
        }, [U.el('span.cal-num', { text: day })]);
        var marks = U.el('span.cal-marks');
        if (n) marks.appendChild(U.el('i.' + (prio[ds] === 'danger' ? 'm-danger' : prio[ds] === 'warn' ? 'm-warn' : 'm-acc') + (ds < td ? '.m-late' : '')));
        if (n > 1) marks.appendChild(U.el('i.m-acc'));
        if (dn && !n) marks.appendChild(U.el('i.m-done'));
        cell.appendChild(marks);
        cell.addEventListener('click', function () {
          st.ui.calSelected = ds; W.Audio.tap(); W.Screens.calendar.render(root);
        });
        g.appendChild(cell);
      })(d);
    }

    // Deslizar horizontalmente para cambiar de mes
    var sx = null, sy = 0;
    g.addEventListener('pointerdown', function (e) { sx = e.clientX; sy = e.clientY; });
    g.addEventListener('pointerup', function (e) {
      if (sx === null) return;
      var dx = e.clientX - sx, dy = e.clientY - sy; sx = null;
      if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) { shift(st, dx < 0 ? 1 : -1); W.Screens.calendar.render(root); }
    });
    return g;
  }

  function agenda(st) {
    var sel = st.ui.calSelected;
    var items = st.forDate(sel).sort(function (a, b) { return (a.done - b.done) || st.compareDeadline(a, b); });
    var wrap = U.el('div.day-agenda');
    var done = items.filter(function (t) { return t.done; }).length;
    wrap.appendChild(U.el('div.section-head', [
      U.el('div', [U.el('h2', { text: U.fmtLong(sel) }), U.el('span.sub', { text: items.length ? done + ' de ' + items.length + ' completadas' : U.fmtDay(sel) })]),
      U.el('button.btn.soft.sm', { on: { click: function () { W.Editor.open(null, { date: sel }); } } }, [U.icon('plus', 'sm'), 'Añadir'])
    ]));
    if (!items.length) {
      wrap.appendChild(U.el('div.card.flat.mini-empty', [U.icon('calendar'), U.el('span', { text: 'Sin tareas este día.' })]));
      return wrap;
    }
    var ul = U.el('ul.task-list.timeline');
    items.forEach(function (t) {
      var li = W.TaskCard.create(t, {});
      li.insertBefore(U.el('span.tl-time', { text: t.time ? U.fmtTime(t.time) : '—' }), li.firstChild);
      ul.appendChild(li);
    });
    wrap.appendChild(ul);
    return wrap;
  }

  W.Screens.calendar = {
    title: 'Agenda',
    render: function (root, fresh) {
      var st = S(), cm = month(st);
      var now = new Date(), isCurrent = cm.y === now.getFullYear() && cm.m === now.getMonth();
      var monthTasks = st.tasks.filter(function (t) { return t.date && t.date.slice(0, 7) === cm.y + '-' + U.pad(cm.m + 1); });
      var mDone = monthTasks.filter(function (t) { return t.done; }).length;
      var inner = U.el('div.inner' + (fresh ? '.stagger' : ''));
      inner.appendChild(W.UI.pageHead('Agenda', U.fmtMonth(cm.y, cm.m),
        monthTasks.length ? mDone + ' de ' + monthTasks.length + ' tareas completadas este mes' : 'Sin tareas programadas este mes'));
      var nav = U.el('div.cal-nav', [
        U.el('button.icon-btn', { attrs: { 'aria-label': 'Mes anterior' }, on: { click: function () { shift(st, -1); W.Screens.calendar.render(root); } } }, [U.icon('left')]),
        U.el('button.chip' + (isCurrent ? '.active' : ''), { text: 'Hoy', on: { click: function () {
          st.ui.calMonth = { y: now.getFullYear(), m: now.getMonth() }; st.ui.calSelected = U.today(); W.Audio.tap(); W.Screens.calendar.render(root);
        } } }),
        U.el('button.icon-btn', { attrs: { 'aria-label': 'Mes siguiente' }, on: { click: function () { shift(st, 1); W.Screens.calendar.render(root); } } }, [U.icon('right')])
      ]);
      inner.appendChild(U.el('div.card.cal-card', [nav, grid(st, root),
        U.el('div.cal-legend', [U.el('span', [U.el('i.m-acc'), 'Pendientes']), U.el('span', [U.el('i.m-warn'), 'Con aviso']), U.el('span', [U.el('i.m-danger'), 'Urgente']), U.el('span', [U.el('i.m-done'), 'Hecho'])])
      ]));
      inner.appendChild(agenda(st));
      U.clear(root).appendChild(inner);
    }
  };
})(window.Whider);
