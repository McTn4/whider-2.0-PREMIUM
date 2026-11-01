/**
 * WHIDER · Centro de avisos: tareas vencidas, próximos avisos y estado de notificaciones
 */
window.Whider = window.Whider || {};
window.Whider.Screens = window.Whider.Screens || {};

(function (W) {
  'use strict';
  var U = W.U, S = function () { return W.State; };

  function alertCard(t, overdue) {
    var st = S(), ms = U.deadlineTs(t.date, t.time) - Date.now();
    var card = U.el('div.card.alert-card' + (overdue ? '.danger' : ''), [
      U.el('div.alert-top', [
        U.el('span.alert-ic', [U.icon(overdue ? 'alert' : 'bell')]),
        U.el('div.alert-main', [
          U.el('strong', { text: t.text }),
          U.el('span', { text: (overdue ? 'Venció ' : 'Vence ') + U.fmtRel(ms) + ' · ' + U.fmtDay(t.date) + (t.time ? ' ' + U.fmtTime(t.time) : '') })
        ])
      ])
    ]);
    var actions = U.el('div.alert-actions', [
      U.el('button.btn.success.sm', { on: { click: function () { W.TaskCard.actions.toggle(t.id); } } }, [U.icon('check', 'sm'), 'Completar'])
    ]);
    if (overdue) {
      actions.appendChild(U.el('button.btn.ghost.sm', { text: '+1 h', on: { click: function () { st.snooze(t.id, 60); W.Toast.show({ text: 'Pospuesta 1 hora', icon: 'clock' }); } } }));
      actions.appendChild(U.el('button.btn.ghost.sm', { text: 'Mañana', on: { click: function () { st.moveToTomorrow(t.id); W.Toast.show({ text: 'Movida a mañana', icon: 'calendar' }); } } }));
    }
    actions.appendChild(U.el('button.btn.ghost.sm', { attrs: { 'aria-label': 'Editar' }, on: { click: function () { W.Editor.open(t.id); } } }, [U.icon('edit', 'sm')]));
    card.appendChild(actions);
    return card;
  }

  W.Screens.alerts = {
    title: 'Avisos',
    render: function (root, fresh) {
      var st = S(), overdue = st.overdueWarnings().sort(st.compareDeadline), upcoming = st.upcomingWarnings();
      var inner = U.el('div.inner' + (fresh ? '.stagger' : ''));
      inner.appendChild(W.UI.pageHead('Centro de avisos', 'Avisos', null));

      var ok = !overdue.length;
      inner.appendChild(U.el('div.card.alert-hero' + (ok ? '.ok' : '.bad'), [
        U.el('div.alert-hero-ic', [U.icon(ok ? 'shield' : 'alert', 'lg')]),
        U.el('div', [
          U.el('h2', { text: ok ? 'Todo bajo control' : U.plural(overdue.length, 'tarea vencida', 'tareas vencidas') }),
          U.el('p', { text: ok ? (upcoming.length ? 'Te avisaremos de ' + U.plural(upcoming.length, 'tarea', 'tareas') + ' antes de que venzan.' : 'Activa "Avisarme" en una tarea para vigilar su plazo.')
            : 'Complétalas, pospónlas o muévelas para mañana.' })
        ])
      ]));

      var perm = W.Notify.permission();
      if (perm !== 'granted') {
        inner.appendChild(U.el('div.card.perm-card', [
          U.el('span.row-icon', [U.icon('bell')]),
          U.el('div.row-main', [U.el('span.row-label', { text: perm === 'denied' ? 'Notificaciones bloqueadas' : perm === 'unsupported' ? 'Sin notificaciones del sistema' : 'Activa las notificaciones' }),
            U.el('span.row-desc', { text: perm === 'unsupported' ? 'Los avisos se mostrarán dentro de la app.' : 'Recibe los avisos aunque estés en otra app.' })]),
          perm !== 'unsupported' ? U.el('button.btn.primary.sm', { text: 'Activar', on: { click: function () { W.Notify.request(); } } }) : null
        ]));
      }

      if (overdue.length) {
        inner.appendChild(U.el('div.group-head.late', [U.icon('alert'), 'Vencidas', U.el('span.count', { text: overdue.length }), U.el('span.line')]));
        overdue.forEach(function (t) { inner.appendChild(alertCard(t, true)); });
      }
      if (upcoming.length) {
        inner.appendChild(U.el('div.group-head', [U.icon('clock'), 'Próximos avisos', U.el('span.count', { text: upcoming.length }), U.el('span.line')]));
        upcoming.slice(0, 20).forEach(function (t) { inner.appendChild(alertCard(t, false)); });
      }
      if (!overdue.length && !upcoming.length) {
        inner.appendChild(W.UI.empty('bell', 'Sin avisos programados', 'Cuando una tarea tenga "Avisarme" activado aparecerá aquí.'));
      }

      var q = st.settings.quietHours;
      inner.appendChild(U.el('div.group', [
        W.UI.row({ icon: 'sound', label: 'Probar alarma', desc: 'Escucha cómo suena un aviso', onTap: function () { W.Audio.warning(); W.Audio.vibrate([70, 60, 70]); } }),
        W.UI.row({ icon: 'moon', label: 'Horas de silencio', value: q.enabled ? q.from + '–' + q.to : 'Desactivadas', onTap: function () { W.Router.go('settings'); } })
      ]));
      U.clear(root).appendChild(inner);
    }
  };
})(window.Whider);
