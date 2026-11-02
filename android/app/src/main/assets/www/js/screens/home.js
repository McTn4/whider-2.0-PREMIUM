/**
 * WHIDER · Inicio: saludo, progreso de hoy, avisos pendientes y la lista de hoy.
 * Solo lo necesario para empezar el día, sin ruido.
 */
window.Whider = window.Whider || {};
window.Whider.Screens = window.Whider.Screens || {};

(function (W) {
  'use strict';
  var U = W.U, S = function () { return W.State; };
  var lastPct = 0;

  function hero(st, s) {
    var pct = s.todayPct, from = lastPct;
    lastPct = pct;
    var label = U.el('div', [U.el('div.ring-pct.num', { text: pct + '%' })]);
    var ring = W.Fx.ring(88, 8, pct / 100, label, from / 100);
    var line1 = s.todayTotal ? s.todayDone + ' de ' + U.plural(s.todayTotal, 'tarea', 'tareas') + ' hoy' : 'Nada programado hoy';
    var bits = [];
    if (s.streak) bits.push(U.plural(s.streak, 'día', 'días') + ' de racha');
    if (s.focusToday) bits.push(s.focusToday + ' min de enfoque');
    var msg = !s.todayTotal ? 'Añade lo que quieras conseguir.'
      : s.todayPct === 100 ? '¡Día completado!'
      : s.todayPct >= 50 ? 'Vas muy bien. Sigue así.' : 'Paso a paso.';
    return U.el('button.card.hero', { on: { click: function () { W.Router.go('progress'); } } }, [
      ring,
      U.el('div.hero-text', [
        U.el('strong', { text: line1 }),
        U.el('span', { text: bits.length ? bits.join(' · ') : msg })
      ])
    ]);
  }

  W.Screens.home = {
    title: 'Inicio',
    render: function (root) {
      var st = S(), s = st.stats(), name = st.displayName(), td = U.today();
      var inner = U.el('div.inner');
      inner.appendChild(U.el('div.page-head.home-head', [U.el('div', [
        U.el('span.eyebrow', { text: U.fmtLong(td) }),
        U.el('h1', [U.greeting() + (name ? ', ' : ''), name ? U.el('span.accent-text', { text: name.split(' ')[0] }) : null])
      ])]));
      inner.appendChild(hero(st, s));

      var items = st.tasks.filter(function (t) { return (t.date === td && !t.done) || (!t.done && st.isOverdue(t)); })
        .sort(st.compareDeadline);
      var doneToday = st.tasks.filter(function (t) { return t.done && t.date === td; });
      inner.appendChild(U.el('div.section-head', [U.el('h2', { text: 'Hoy' }),
        U.el('button.link-btn', { on: { click: function () { st.ui.tab = 'today'; W.Router.go('tasks'); } } }, ['Ver todas', U.icon('right', 'xs')])]));
      if (!items.length) {
        inner.appendChild(U.el('div.calm-empty', [
          U.el('span.calm-empty-ic', [U.icon(doneToday.length ? 'check' : 'sun')]),
          U.el('strong', { text: doneToday.length ? 'Todo hecho por hoy' : 'Día libre' }),
          U.el('span', { text: doneToday.length ? 'Has completado ' + U.plural(doneToday.length, 'tarea', 'tareas') + '. Buen trabajo.' : 'No tienes tareas para hoy.' }),
          U.el('button.btn.soft.sm', { on: { click: function () { W.Editor.open(null); } } }, [U.icon('plus', 'sm'), 'Añadir tarea'])
        ]));
      } else {
        var ul = U.el('ul.task-list');
        items.slice(0, 8).forEach(function (t, i) { ul.appendChild(W.TaskCard.create(t, { ctx: 'today', highlight: i === 0 })); });
        inner.appendChild(ul);
        if (items.length > 8) inner.appendChild(U.el('button.link-btn.more', { text: 'Ver ' + (items.length - 8) + ' más', on: { click: function () { st.ui.tab = 'today'; W.Router.go('tasks'); } } }));
      }
      U.clear(root).appendChild(inner);
    }
  };
})(window.Whider);
