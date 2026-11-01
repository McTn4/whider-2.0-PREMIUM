/**
 * WHIDER · Pantalla de Inicio: resumen del día, acciones rápidas, siguiente paso,
 * agenda de hoy y semana (secciones configurables en Ajustes).
 */
window.Whider = window.Whider || {};
window.Whider.Screens = window.Whider.Screens || {};

(function (W) {
  'use strict';
  var U = W.U, S = function () { return W.State; };

  function motivation(pct, total) {
    if (!total) return 'Día despejado. Añade lo que quieras conseguir hoy.';
    if (pct === 100) return '¡Día completado! Te has ganado un descanso.';
    if (pct >= 70) return 'Ya casi lo tienes. Un último empujón.';
    if (pct >= 40) return 'Buen ritmo. Sigue avanzando.';
    if (pct > 0) return 'Has empezado. La constancia hace el resto.';
    return 'Cada gran día empieza con una tarea.';
  }

  var lastPct = 0;

  function summaryCard(st, s) {
    var pct = s.todayPct, from = lastPct;
    lastPct = pct;
    var label = U.el('div', [U.el('div.ring-pct.num', { text: from + '%', attrs: { 'data-val': from } }), U.el('div.ring-cap', { text: 'hoy' })]);
    var ring = W.Fx.ring(132, 11, pct / 100, label, from / 100);
    setTimeout(function () { W.Fx.countUp(label.firstChild, pct, { suffix: '%' }); }, 60);

    var doneToday = st.tasks.filter(function (t) { return t.done && t.doneOn === U.today(); }).length;
    var goal = st.settings.dailyGoal;
    var goalPct = Math.min(100, Math.round(doneToday / goal * 100));
    var bar = U.el('div.bar', [U.el('i')]);
    setTimeout(function () { bar.firstChild.style.width = goalPct + '%'; }, 80);

    return U.el('div.card.glow.summary', [
      ring,
      U.el('div.summary-info', [
        U.el('span.eyebrow', { text: 'Rendimiento de hoy' }),
        U.el('div.summary-count', [U.el('strong.num', { text: s.todayDone }), U.el('span', { text: ' / ' + s.todayTotal + ' tareas' })]),
        U.el('div.summary-chips', [
          U.el('span.tag.flame', [U.icon('flame'), U.plural(s.streak, 'día', 'días')]),
          s.focusToday ? U.el('span.tag', [U.icon('timer'), s.focusToday + ' min']) : null
        ]),
        U.el('div.goal', [
          U.el('div.goal-row', [U.el('span', { text: 'Objetivo diario' }), U.el('b', { text: Math.min(doneToday, goal) + '/' + goal })]),
          bar
        ]),
        U.el('p.summary-msg', { text: motivation(pct, s.todayTotal) })
      ])
    ]);
  }

  function quickActions(st) {
    var overdue = st.overdueWarnings().length;
    var q = function (icon, label, fn, badge) {
      return U.el('button.quick.fx-press', { on: { click: fn } }, [
        U.el('span.quick-ic', [U.icon(icon), badge ? U.el('span.quick-badge', { text: badge }) : null]),
        U.el('span', { text: label })
      ]);
    };
    return U.el('div.quick-grid', [
      q('plus', 'Nueva', function () { W.Editor.open(null); }),
      q('timer', 'Enfoque', function () { W.Router.go('focus'); }),
      q('calendar', 'Agenda', function () { W.Router.go('calendar'); }),
      q('bell', 'Avisos', function () { W.Router.go('alerts'); }, overdue ? String(overdue) : null)
    ]);
  }

  function nextCard(st) {
    var t = st.nextTask();
    if (!t) {
      return U.el('div.card.next-card.clear', [
        U.el('span.row-icon', [U.icon('shield')]),
        U.el('div', [U.el('strong', { text: 'Todo despejado' }), U.el('p', { text: 'No tienes tareas pendientes. Disfruta o planifica lo siguiente.' })])
      ]);
    }
    var overdue = st.isOverdue(t), when = '';
    if (t.date) {
      var ms = U.deadlineTs(t.date, t.time) - Date.now();
      when = overdue ? 'Venció ' + U.fmtRel(ms) : (t.time ? 'Vence ' + U.fmtRel(ms) : U.fmtDay(t.date));
    } else when = 'Sin fecha límite';
    var list = t.listId ? st.getList(t.listId) : null;
    return U.el('div.card.next-card' + (overdue ? '.overdue' : ''), [
      U.el('div.next-top', [
        U.el('span.eyebrow', { text: overdue ? 'Requiere atención' : 'Siguiente paso' }),
        U.el('span.tag' + (overdue ? '.late' : '.today'), [U.icon(overdue ? 'alert' : 'clock'), when])
      ]),
      U.el('h3.next-title', { text: t.text }),
      list ? U.el('span.next-list', [U.el('span.dot', { style: { '--c': st.ACCENTS[list.color].a } }), list.name]) : null,
      U.el('div.next-actions', [
        U.el('button.btn.primary.sm', { on: { click: function () { W.TaskCard.actions.toggle(t.id); } } }, [U.icon('check', 'sm'), 'Completar']),
        U.el('button.btn.ghost.sm', { on: { click: function () { W.Router.go('focus'); W.Screens.focus.linkTask(t.id); } } }, [U.icon('timer', 'sm'), 'Enfocar']),
        U.el('button.btn.ghost.sm', { on: { click: function () { W.Editor.open(t.id); } } }, [U.icon('edit', 'sm')])
      ])
    ]);
  }

  function agenda(st) {
    var td = U.today();
    var items = st.tasks.filter(function (t) { return t.date === td || (st.isOverdue(t)); })
      .sort(function (a, b) { return (a.done - b.done) || st.compareDeadline(a, b); });
    var wrap = U.el('div');
    wrap.appendChild(U.el('div.section-head', [U.el('h2', { text: 'Agenda de hoy' }),
      U.el('button.link-btn', { on: { click: function () { st.ui.filter = 'today'; W.Router.go('tasks'); } } }, ['Ver todo', U.icon('right', 'xs')])]));
    if (!items.length) {
      wrap.appendChild(U.el('div.card.flat.mini-empty', [U.icon('sun'), U.el('span', { text: 'Nada programado para hoy.' }),
        U.el('button.link-btn', { text: 'Añadir', on: { click: function () { W.Editor.open(null); } } })]));
      return wrap;
    }
    var ul = U.el('ul.task-list');
    items.slice(0, 6).forEach(function (t) { ul.appendChild(W.TaskCard.create(t)); });
    wrap.appendChild(ul);
    if (items.length > 6) wrap.appendChild(U.el('button.link-btn.more', { text: '+' + (items.length - 6) + ' más', on: { click: function () { st.ui.filter = 'today'; W.Router.go('tasks'); } } }));
    return wrap;
  }

  function week(st, fresh) {
    var days = st.lastDays(7), max = 1;
    days.forEach(function (d) { if (d.count > max) max = d.count; });
    var total = days.reduce(function (a, d) { return a + d.count; }, 0);
    var bars = U.el('div.week-bars');
    days.forEach(function (d, i) {
      var h = d.count ? Math.round(d.count / max * 100) : 4;
      var col = U.el('div.week-col' + (d.isToday ? '.today' : ''), [
        U.el('span.week-n', { text: d.count || '' }),
        U.el('div.week-track', [U.el('i', { style: { height: fresh ? '0%' : h + '%', transitionDelay: (i * 50) + 'ms' } })]),
        U.el('span.week-d', { text: U.WEEKDAYS_SHORT[U.weekday(d.date)].charAt(0) })
      ]);
      bars.appendChild(col);
      if (fresh) setTimeout(function () { col.querySelector('i').style.height = h + '%'; }, 60);
    });
    return U.el('div.card.week-card', [
      U.el('div.card-title', [U.icon('chart'), 'Últimos 7 días', U.el('span.card-title-right', { text: U.plural(total, 'completada', 'completadas') })]),
      bars
    ]);
  }

  W.Screens.home = {
    title: 'Inicio',
    render: function (root, fresh) {
      var st = S(), s = st.stats(), sec = st.settings.homeSections;
      var name = st.displayName();
      var inner = U.el('div.inner' + (fresh ? '.stagger' : ''));
      inner.appendChild(U.el('div.page-head.home-head', [U.el('div', [
        U.el('span.eyebrow', { text: U.fmtLong(U.today()) }),
        U.el('h1', [U.greeting() + (name ? ', ' : ''), name ? U.el('span.accent-text', { text: name.split(' ')[0] }) : null])
      ])]));
      if (st.hasExamples()) {
        inner.appendChild(U.el('div.card.flat.banner', [U.icon('sparkle'), U.el('span', { text: 'Estas son tareas de ejemplo para que explores la app.' }),
          U.el('button.link-btn', { text: 'Quitar', on: { click: function () { st.clearExamples(); W.Toast.show({ text: 'Ejemplos eliminados', type: 'success' }); } } })]));
      }
      if (sec.summary) inner.appendChild(summaryCard(st, s));
      if (sec.actions) inner.appendChild(quickActions(st));
      if (sec.next) inner.appendChild(nextCard(st));
      if (sec.agenda) inner.appendChild(agenda(st));
      if (sec.week) inner.appendChild(week(st, fresh));
      if (!sec.summary && !sec.actions && !sec.next && !sec.agenda && !sec.week) {
        inner.appendChild(W.UI.empty('grid', 'Inicio vacío', 'Has ocultado todas las secciones. Actívalas en Ajustes → Inicio.',
          U.el('button.btn.soft', { text: 'Abrir ajustes', on: { click: function () { W.Router.go('settings'); } } })));
      }
      U.clear(root).appendChild(inner);
    }
  };
})(window.Whider);
