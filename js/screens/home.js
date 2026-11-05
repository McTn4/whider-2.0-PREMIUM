/**
 * WHIDER · Hoy: progreso del día, lo vencido (con Posponer) y las tareas de hoy.
 * En el ordenador, a dos columnas: las tareas a la izquierda y, a la derecha, el resumen
 * del día y lo que viene en los próximos días.
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
    var ring = W.Fx.ring(62, 7, pct / 100, U.el('span.ring-pct', { text: pct + '%' }), from / 100);
    var line1 = s.todayTotal ? s.todayDone + ' de ' + U.plural(s.todayTotal, 'tarea completada', 'tareas completadas') : 'Nada programado para hoy';
    var chips = [];
    if (s.streak) chips.push(U.el('span.hero-chip', [U.icon('flame'), U.el('b', { text: String(s.streak) }), (s.streak === 1 ? ' día' : ' días') + ' de racha']));
    if (s.focusToday) chips.push(U.el('span.hero-chip', [U.icon('timer'), U.el('b', { text: String(s.focusToday) }), ' min']));
    if (!chips.length) chips.push(U.el('span.hero-chip', [U.icon('chart'), s.todayTotal && pct === 100 ? 'Día completado' : 'Ver resumen']));
    return U.el('button.hero', { attrs: { 'aria-label': 'Ver tu perfil y resumen' }, on: { click: function () { W.Router.go('progress'); } } }, [
      ring,
      U.el('span.hero-text', [U.el('strong', { text: line1 }), U.el('span.hero-chips', chips)]),
      U.icon('chev', 'chev')
    ]);
  }

  /** Ordenador: lo que viene en los próximos 7 días, día a día */
  function upcoming(st) {
    var td = U.today(), days = [];
    for (var i = 1; i <= 7; i++) {
      var ds = U.addDays(td, i);
      var list = st.tasks.filter(function (t) { return !t.done && t.date === ds; }).sort(st.compareDeadline);
      if (list.length) days.push({ ds: ds, list: list });
    }
    var body = days.length ? U.el('div.upc', days.map(function (d) {
      var label = d.ds === U.addDays(td, 1) ? 'Mañana' : U.cap(U.WEEKDAYS[U.weekday(d.ds)]);
      var rows = d.list.slice(0, 4).map(function (t) {
        return U.el('button.upc-row', { attrs: { title: t.text }, on: {
          click: function () { W.Editor.open(t.id); },
          contextmenu: function (e) { e.preventDefault(); W.TaskCard.actions.menu(t.id, { x: e.clientX, y: e.clientY }); }
        } }, [U.el('b', { text: t.time ? U.fmtTime(t.time) : '—' }), U.el('span', { text: t.text }), t.highlight !== 'none' ? W.UI.prio(t.highlight) : null]);
      });
      return U.el('div.upc-day', [
        U.el('div.upc-date', [U.el('strong', { text: label }), U.el('span', { text: U.parse(d.ds).getDate() + ' ' + U.MONTHS[U.parse(d.ds).getMonth()].slice(0, 3) })]),
        U.el('div', rows),
        d.list.length > 4 ? U.el('div.upc-more', { text: '+' + (d.list.length - 4) + ' más' }) : null
      ]);
    })) : U.el('p.upc-empty', { text: 'Nada programado en los próximos 7 días.' });
    return U.el('div.group.card.side-card', [
      U.el('div.card-head', [U.el('strong', { text: 'Próximos días' }),
        U.el('button.link-btn.muted', { text: 'Calendario', on: { click: function () { W.Router.go('calendar'); } } })]),
      body
    ]);
  }

  function permissionText(perm) {
    if (perm !== 'denied') return 'Para recibir los avisos de tus tareas';
    if (W.Layout.app) return 'Actívalas en la configuración de notificaciones del sistema';
    return W.Layout.desktop ? 'Actívalas en los ajustes del navegador' : 'Actívalas en los ajustes del teléfono';
  }

  W.Screens.home = {
    title: 'Hoy',
    render: function (root) {
      var st = S(), s = st.stats(), td = U.today(), desk = W.Layout.desktop;
      var name = st.displayName();
      var head = W.UI.header({
        title: 'Hoy', profile: true,
        sub: U.el('span', [U.greeting() + (name ? ', ' : ''), name ? U.el('b', { text: name.split(' ')[0] }) : null, ' · ' + U.fmtLong(td).toLowerCase()])
      });
      var main = [], side = [];

      var perm = W.Notify.permission();
      if ((perm === 'default' || perm === 'denied') && st.tasks.some(function (t) { return t.warn && !t.done; })) {
        main.push(W.UI.section({ items: [W.UI.cell({
          icon: 'bell', title: perm === 'denied' ? 'Notificaciones bloqueadas' : 'Activar notificaciones',
          sub: permissionText(perm), onTap: function () { W.Notify.request(); }
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
        main.push(W.UI.section({ title: 'Vencidas', red: true, side: U.el('small', { text: overdue.length }),
          items: U.el('div', [W.TaskCard.list(recent, { ctx: 'alerts', postpone: true }), more]) }));
      }

      var empty = U.el('div.group', [W.UI.empty(doneToday.length ? 'check' : 'sun',
        doneToday.length ? 'Todo hecho por hoy' : 'Nada pendiente',
        doneToday.length ? 'Has completado ' + U.plural(doneToday.length, 'tarea', 'tareas') + '.' : desk ? 'Escribe arriba para añadir algo a hoy.' : 'Añade lo que quieras hacer hoy.',
        doneToday.length || desk ? null : U.el('button.btn.sm.soft', { on: { click: function () { W.QuickAdd.open({ date: td }); } } }, [U.icon('plus', 'sm'), 'Nueva tarea']), true)]);
      var todayItems = today.length ? W.TaskCard.list(today, { ctx: 'today' }) : empty;
      main.push(W.UI.section({ title: 'Para hoy', side: today.length ? U.el('small', { text: today.length }) : null,
        items: desk ? U.el('div', [W.QuickAdd.inline({ date: td }, 'Añadir una tarea para hoy…'), todayItems]) : todayItems }));

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
        main.push(host);
      }

      if (!desk && W.Tips.show('swipe') && (overdue.length || today.length)) {
        main.push(U.el('p.hint', { text: 'Desliza una tarea hacia la derecha para completarla o hacia la izquierda para eliminarla.' }));
      }

      if (desk) {
        side.push(summary(s));
        side.push(upcoming(st));
        W.UI.mount(root, head, [U.el('div.desk-cols', [U.el('div.desk-main', main), U.el('aside.desk-side', side)])]);
      } else {
        W.UI.mount(root, head, [summary(s)].concat(main));
      }
    }
  };
})(window.Whider);
