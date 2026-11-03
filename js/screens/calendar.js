/**
 * WHIDER · Calendario: mes en cuadrícula (desliza para cambiar de mes)
 * y las tareas del día seleccionado, ordenadas por hora.
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
  }
  function goToday(st) {
    var n = new Date();
    st.ui.calMonth = { y: n.getFullYear(), m: n.getMonth() };
    st.ui.calSelected = U.today();
  }

  function card(st, root) {
    var cm = month(st), td = U.today();
    var pend = {}, late = {}, done = {};
    st.tasks.forEach(function (t) {
      if (!t.date) return;
      if (t.done) { done[t.date] = (done[t.date] || 0) + 1; return; }
      pend[t.date] = (pend[t.date] || 0) + 1;
      if (st.isOverdue(t)) late[t.date] = true;
    });
    var rerender = function () { W.Screens.calendar.render(root); };
    var grid = W.UI.monthGrid({
      y: cm.y, m: cm.m, selected: st.ui.calSelected, slide: slideDir,
      mark: function (ds) {
        if (pend[ds]) return { kind: late[ds] ? 'late' : 'dot', label: U.plural(pend[ds], 'pendiente', 'pendientes') };
        if (done[ds] && ds <= td) return { kind: 'done', label: U.plural(done[ds], 'completada', 'completadas') };
        return null;
      },
      onPick: function (ds) { st.ui.calSelected = ds; W.Audio.select(); rerender(); }
    });
    slideDir = 0;
    // Deslizar horizontalmente para cambiar de mes
    var sx = null, sy = 0;
    grid.addEventListener('pointerdown', function (e) { sx = e.clientX; sy = e.clientY; });
    grid.addEventListener('pointerup', function (e) {
      if (sx === null) return;
      var dx = e.clientX - sx, dy = e.clientY - sy; sx = null;
      if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) { shift(st, dx < 0 ? 1 : -1); rerender(); }
    });
    grid.addEventListener('pointercancel', function () { sx = null; });
    return U.el('div.group.cal', [
      U.el('div.cal-head', [
        U.el('strong', { text: U.fmtMonth(cm.y, cm.m) }),
        U.el('div.cal-arrows', [
          W.UI.navBtn({ icon: 'left', label: 'Mes anterior', onTap: function () { shift(st, -1); rerender(); } }),
          W.UI.navBtn({ icon: 'right', label: 'Mes siguiente', onTap: function () { shift(st, 1); rerender(); } })
        ])
      ]),
      grid
    ]);
  }

  function agenda(st) {
    var sel = st.ui.calSelected;
    var items = st.forDate(sel).sort(function (a, b) { return (a.done - b.done) || st.compareDeadline(a, b); });
    var done = items.filter(function (t) { return t.done; }).length;
    var td = U.today();
    var title = sel === td ? 'Hoy' : sel === U.addDays(td, 1) ? 'Mañana' : sel === U.addDays(td, -1) ? 'Ayer' : U.fmtLong(sel);
    var side = items.length ? U.el('small', { text: done + ' de ' + items.length }) : null;
    var body = items.length
      ? W.TaskCard.list(items, function (t) { return { ctx: 'day', time: t.time ? U.fmtTime(t.time) : '' }; })
      : U.el('div.group', [W.UI.empty(null, 'Sin tareas', sel < td ? 'No hubo tareas este día.' : 'No hay nada programado para este día.',
        sel >= td ? U.el('button.btn.sm.soft', { on: { click: function () { W.Editor.open(null, { date: sel }); } } }, ['Añadir tarea']) : null, true)]);
    var ul = body;
    if (items.length) ul.classList.add('timeline');
    return W.UI.section({ title: title, side: side, items: body });
  }

  W.Screens.calendar = {
    title: 'Calendario',
    render: function (root) {
      var st = S(), cm = month(st), now = new Date();
      var isCurrent = cm.y === now.getFullYear() && cm.m === now.getMonth() && st.ui.calSelected === U.today();
      var head = W.UI.header({
        title: 'Calendario', avatar: true,
        actions: [
          isCurrent ? null : { text: 'Hoy', onTap: function () { goToday(st); W.Screens.calendar.render(root); } },
          { icon: 'plus', label: 'Nueva tarea este día', onTap: function () { W.Editor.open(null, { date: st.ui.calSelected }); } }
        ].filter(Boolean)
      });
      W.UI.mount(root, head, [card(st, root), agenda(st)]);
    }
  };
})(window.Whider);
