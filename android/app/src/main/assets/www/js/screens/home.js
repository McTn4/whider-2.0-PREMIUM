/**
 * WHIDER · Hoy: progreso del día, lo vencido (con Posponer) y las tareas de hoy.
 */
window.Whider = window.Whider || {};
window.Whider.Screens = window.Whider.Screens || {};

(function (W) {
  'use strict';
  var U = W.U, S = function () { return W.State; };
  var lastPct = 0, showDone = false, MAX_OVERDUE = 5;

  function summary(s) {
    var pct = s.todayPct, from = lastPct;
    lastPct = pct;
    var ring = W.Fx.ring(52, 6, pct / 100, U.el('span.ring-pct', { text: pct + '%' }), from / 100);
    var line1 = s.todayTotal ? s.todayDone + ' de ' + U.plural(s.todayTotal, 'tarea completada', 'tareas completadas') : 'Nada programado para hoy';
    var bits = [];
    if (s.streak) bits.push('Racha de ' + U.plural(s.streak, 'día', 'días'));
    if (s.focusToday) bits.push(s.focusToday + ' min de enfoque');
    if (!bits.length) bits.push(s.todayTotal && s.todayPct === 100 ? 'Día completado' : 'Ver tu resumen');
    return U.el('button.group.summary', { attrs: { 'aria-label': 'Ver resumen' }, on: { click: function () { W.Router.go('progress'); } } }, [
      ring,
      U.el('span.summary-text', [U.el('strong', { text: line1 }), U.el('span', { text: bits.join(' · ') })]),
      U.icon('chev', 'chev')
    ]);
  }

  W.Screens.home = {
    title: 'Hoy',
    render: function (root) {
      var st = S(), s = st.stats(), td = U.today();
      var head = W.UI.header({
        title: 'Hoy', eyebrow: U.fmtLong(td), avatar: true,
        actions: [{ icon: 'plus', label: 'Nueva tarea', onTap: function () { W.Editor.open(null); } }]
      });
      var content = [summary(s)];

      var perm = W.Notify.permission();
      if ((perm === 'default' || perm === 'denied') && st.tasks.some(function (t) { return t.warn && !t.done; })) {
        content.push(W.UI.section({ items: [W.UI.cell({
          icon: 'bell', color: 'var(--red)', title: perm === 'denied' ? 'Notificaciones bloqueadas' : 'Activar notificaciones',
          sub: perm === 'denied' ? 'Actívalas en los ajustes del teléfono' : 'Para recibir los avisos de tus tareas', onTap: function () { W.Notify.request(); }
        })] }));
      }

      var overdue = st.overdueAll().sort(st.compareDeadline);
      var today = st.tasks.filter(function (t) { return t.date === td && !t.done && !st.isOverdue(t); }).sort(st.compareDeadline);
      var doneToday = st.tasks.filter(function (t) { return t.done && (t.doneOn === td || t.date === td); })
        .sort(function (a, b) { return (b.doneAt || 0) - (a.doneAt || 0); });

      if (overdue.length) {
        // Las más recientes primero; si hay muchas, el resto en Tareas → Hoy
        var recent = overdue.slice().reverse().slice(0, MAX_OVERDUE);
        var more = overdue.length > MAX_OVERDUE ? U.el('div.cell-row', { style: { justifyContent: 'flex-end', padding: '6px 4px 0' } }, [
          U.el('button.link-btn', { text: 'Ver las ' + overdue.length + ' vencidas', on: { click: function () { st.ui.taskView = { type: 'smart', id: 'today' }; W.Router.go('tasks'); } } })]) : null;
        content.push(W.UI.section({ title: 'Vencidas', red: true, side: U.el('small', { text: overdue.length }),
          items: U.el('div', [W.TaskCard.list(recent, { ctx: 'alerts', postpone: true }), more]) }));
      }

      var todaySec = W.UI.section({ title: 'Para hoy', side: today.length ? U.el('small', { text: today.length }) : null,
        items: today.length ? W.TaskCard.list(today, { ctx: 'today' }) : U.el('div.group', [W.UI.empty(doneToday.length ? 'check' : 'sun',
          doneToday.length ? 'Todo hecho por hoy' : 'Nada pendiente',
          doneToday.length ? 'Has completado ' + U.plural(doneToday.length, 'tarea', 'tareas') + '.' : 'Añade lo que quieras hacer hoy.',
          doneToday.length ? null : U.el('button.btn.sm.soft', { on: { click: function () { W.Editor.open(null); } } }, ['Nueva tarea']), true)]) });
      content.push(todaySec);

      if (doneToday.length) {
        var host = U.el('div.sec');
        var drawDone = function () {
          U.clear(host);
          host.appendChild(U.el('div.done-toggle', [
            U.el('span', { text: U.plural(doneToday.length, 'completada', 'completadas') }),
            U.el('button.link-btn', { text: showDone ? 'Ocultar' : 'Mostrar', on: { click: function () { showDone = !showDone; drawDone(); } } })
          ]));
          if (showDone) host.appendChild(W.TaskCard.list(doneToday, { ctx: 'today' }));
        };
        drawDone();
        content.push(host);
      }

      if (W.Tips.show('swipe') && (overdue.length || today.length)) {
        content.push(U.el('p.hint', { text: 'Desliza una tarea hacia la derecha para completarla o hacia la izquierda para eliminarla.' }));
      }
      W.UI.mount(root, head, content);
    }
  };
})(window.Whider);
