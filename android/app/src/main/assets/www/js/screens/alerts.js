/**
 * WHIDER · Avisos: lo vencido primero, con una sola acción clara (Posponer);
 * después los próximos avisos, solo informativos.
 */
window.Whider = window.Whider || {};
window.Whider.Screens = window.Whider.Screens || {};

(function (W) {
  'use strict';
  var U = W.U, S = function () { return W.State; };

  function overdueItem(t) {
    var li = W.TaskCard.create(t, { swipe: false, ctx: 'alerts' });
    li.querySelector('.task-body').appendChild(U.el('button.btn.ghost.sm.postpone', { text: 'Posponer', on: { click: function (e) { e.stopPropagation(); W.TaskCard.actions.postpone(t.id); } } }));
    return li;
  }

  W.Screens.alerts = {
    title: 'Avisos',
    render: function (root) {
      var st = S(), overdue = st.overdueAll().sort(st.compareDeadline), upcoming = st.upcomingWarnings();
      var inner = U.el('div.inner');
      inner.appendChild(U.el('div.page-head', [U.el('div', [U.el('h1', { text: 'Avisos' }),
        U.el('p', { text: overdue.length ? U.plural(overdue.length, 'tarea vencida', 'tareas vencidas') : 'Todo bajo control' })])]));

      var perm = W.Notify.permission();
      if (perm === 'default' || perm === 'denied') {
        inner.appendChild(U.el('button.notice', { on: { click: function () { W.Notify.request(); } } }, [
          U.icon('bell', 'sm'), U.el('span', { text: perm === 'denied' ? 'Notificaciones bloqueadas: actívalas en los ajustes del teléfono' : 'Activa las notificaciones para no perderte nada' }), U.icon('right', 'sm')
        ]));
      }

      if (overdue.length) {
        inner.appendChild(U.el('div.group-head.late', [U.el('span', { text: 'Vencidas' }), U.el('span.count', { text: overdue.length })]));
        var ul = U.el('ul.task-list');
        overdue.forEach(function (t) { ul.appendChild(overdueItem(t)); });
        inner.appendChild(ul);
      }
      if (upcoming.length) {
        inner.appendChild(U.el('div.group-head', [U.el('span', { text: 'Próximos avisos' }), U.el('span.count', { text: upcoming.length })]));
        var ul2 = U.el('ul.task-list');
        upcoming.slice(0, 20).forEach(function (t) { ul2.appendChild(W.TaskCard.create(t, { swipe: false })); });
        inner.appendChild(ul2);
      }
      if (!overdue.length && !upcoming.length) {
        inner.appendChild(U.el('div.calm-empty', [
          U.el('span.calm-empty-ic.ok', [U.icon('shield')]),
          U.el('strong', { text: 'Sin avisos' }),
          U.el('span', { text: 'Activa "Avisarme si no la hago" en una tarea y aparecerá aquí.' })
        ]));
      }
      U.clear(root).appendChild(inner);
    }
  };
})(window.Whider);
