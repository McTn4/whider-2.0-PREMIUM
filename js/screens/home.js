/**
 * WHIDER · Hoy: lo más importante, tu día de un vistazo y las tareas agrupadas por estado:
 * en curso (las que ya empezaste), vencidas (con Posponer), pendientes y hechas.
 * En el móvil, el personaje y el progreso van en una sola tarjeta (sin repetir el recuento).
 * En el ordenador, a dos columnas: las tareas a la izquierda y, a la derecha, los bloques que
 * elijas (resumen del día, próximos días, enfoque…).
 */
window.Whider = window.Whider || {};
window.Whider.Screens = window.Whider.Screens || {};

(function (W) {
  'use strict';
  var U = W.U, S = function () { return W.State; };
  var lastPct = 0, showDone = false, MAX_OVERDUE = 5, focusTimeEl = null;
  var WIDGETS = ['buddy', 'summary', 'messages', 'habits', 'upcoming', 'pages', 'focus'];
  var TOP = 3;

  /*
   * Lo más importante de hoy: las que elegiste tú y, después, por prioridad (urgentes,
   * importantes, destacadas y el resto); a igual prioridad, primero las vencidas y luego por hora.
   */
  function topTasks(st) {
    var td = U.today(), pinned = st.meta.top && st.meta.top.d === td ? st.meta.top.ids : [];
    var pool = st.tasks.filter(function (t) { return !t.done && (t.date === td || st.isOverdue(t)); });
    var rank = function (t) { return (st.PRIORITIES[t.highlight] || { rank: 3 }).rank; };
    pool.sort(function (a, b) {
      var pa = pinned.indexOf(a.id), pb = pinned.indexOf(b.id);
      if (pa >= 0 || pb >= 0) return (pa < 0 ? 99 : pa) - (pb < 0 ? 99 : pb);
      var oa = st.isOverdue(a) ? 0 : 1, ob = st.isOverdue(b) ? 0 : 1;
      return (rank(a) - rank(b)) || (oa - ob) || String(a.time || '99').localeCompare(String(b.time || '99'));
    });
    return { list: pool.slice(0, TOP), total: pool.length, pinned: pinned };
  }
  function choosePriorities(st) {
    var td = U.today(), pool = st.tasks.filter(function (t) { return !t.done && (t.date === td || st.isOverdue(t)); }).sort(st.compareDeadline);
    var chosen = (st.meta.top && st.meta.top.d === td ? st.meta.top.ids : topTasks(st).list.map(function (t) { return t.id; })).slice(0, TOP);
    var host = U.el('div');
    var draw = function () {
      U.clear(host);
      host.appendChild(W.UI.section({ header: W.t('Elige hasta {TOP} ({length}/{TOP})', { TOP: TOP, length: chosen.length }), items: pool.map(function (t) {
        var on = chosen.indexOf(t.id) >= 0;
        return W.UI.cell({ lead: W.UI.prio(t.highlight), title: t.text, sub: (st.isOverdue(t) ? W.t('Vencida') + ' · ' : '') + (t.time ? U.fmtTime(t.time) : W.t('Hoy')), right: U.icon(on ? 'star-fill' : 'star', 'sm'), cls: on ? 'accent' : null,
          onTap: function () { if (on) chosen.splice(chosen.indexOf(t.id), 1); else if (chosen.length < TOP) chosen.push(t.id); else { W.Toast.show({ text: W.t('Máximo {TOP}. Quita una antes.', { TOP: TOP }), icon: 'info' }); return; } draw(); } });
      }), footer: W.t('Lo que elijas sale arriba en Hoy, en este orden. Mañana vuelve a ser automático.') }));
    };
    draw();
    var s = W.Sheet.open({ title: W.t('Tus prioridades de hoy'), body: [host], foot: [
      U.el('button.btn.ghost', { text: W.t('Automático'), on: { click: function () { st.setMeta('top', null); s.close(); } } }),
      U.el('button.btn.primary', { text: W.t('Guardar'), on: { click: function () {
        st.setMeta('top', { d: td, ids: chosen.slice(0, TOP) });
        if (W.FirstSteps) W.FirstSteps.mark('chose');
        s.close();
      } } })
    ] });
  }
  function prioritySection(st, desk) {
    var top = topTasks(st);
    if (!top.list.length) return null;
    // «Elegir cuáles»: decides tú las tres de arriba (si no, salen solas por prioridad y hora)
    return W.UI.section({ cls: 'top3', title: W.t('Lo más importante'),
      side: U.el('button.link-btn', { text: top.pinned.length ? W.t('Cambiar') : W.t('Elegir cuáles'), attrs: { title: W.t('Elegir las tareas más importantes de hoy') },
        on: { click: function () { choosePriorities(st); } } }),
      items: W.TaskCard.list(top.list, { ctx: 'today' }) });
  }
  /** Mensajes sin leer y solicitudes: lo de otras personas que espera respuesta */
  function messagesCard(st, desk) {
    if (!W.Chat || !W.People) return null;
    var unread = W.Chat.list().filter(W.Chat.unread).slice(0, 3), reqs = W.People.pendingCount();
    if (!unread.length && !reqs) return desk ? null : null;
    var rows = unread.map(function (c) {
      return U.el('button.hm-msg', { attrs: { type: 'button' }, on: { click: function () { W.Chat.openChat(c.id); } } }, [
        c.type === 'team' ? U.el('span.av.av-team', { style: { '--s': '34px' } }, [U.el('span.av-in', [U.icon('team')])]) : W.Avatar.small(W.Chat.other(c), 34),
        U.el('span.hm-main', [U.el('b', { text: W.Chat.title(c) }), U.el('small', { text: (c.last && c.last.text) || '' })]), U.el('i.ct-dot')]);
    });
    if (reqs) rows.push(U.el('button.hm-msg', { attrs: { type: 'button' }, on: { click: function () { W.Router.go('friends'); } } }, [U.el('span.hm-ic', [U.icon('users')]),
      U.el('span.hm-main', [U.el('b', { text: U.plural(reqs, 'solicitud nueva', 'solicitudes nuevas') }), U.el('small', { text: W.t('Quieren conectar contigo') })]), U.el('i.ct-dot')]));
    return U.el('div.group.card' + (desk ? '.side-card' : '') + '.hm-card', [U.el('div.card-head', [U.el('strong', { text: W.t('Te están esperando') }), U.el('button.link-btn.muted', { text: W.t('Chats'), on: { click: function () { W.Router.go('chats'); } } })]), U.el('div.hm-list', rows)]);
  }
  /** Páginas recientes del Cuaderno */
  function pagesCard(desk) {
    if (!W.Pages) return null;
    var list = W.Pages.recent(desk ? 4 : 6);
    if (!list.length) return null;
    var items = list.map(function (p) {
      return U.el('button.hm-page', { attrs: { type: 'button' }, on: { click: function () { W.Notes.openPage(p.id); } } }, [U.el('span.hm-ic', [U.icon(p.icon || (p.kind === 'db' ? 'database' : 'page'))]), U.el('span.hm-main', [U.el('b', { text: W.Pages.title(p) }), U.el('small', { text: W.t('Editada {0}', { 0: U.fmtRel(Math.max(p.at, p.cv) - Date.now()) }) })])]);
    });
    if (desk) return U.el('div.group.card.side-card', [U.el('div.card-head', [U.el('strong', { text: W.t('Cuaderno') }), U.el('button.link-btn.muted', { text: W.t('Abrir'), on: { click: function () { W.Router.go('notes'); } } })]), U.el('div.hm-list', items)]);
    return W.UI.section({ title: W.t('Tu Cuaderno'), side: U.el('button.link-btn', { text: W.t('Ver todo'), on: { click: function () { W.Router.go('notes'); } } }), items: U.el('div.hm-pages', items) });
  }

  function summary(s) {
    var pct = s.todayPct, from = lastPct;
    lastPct = pct;
    var ring = W.Fx.ring(62, 7, pct / 100, U.el('span.ring-pct', { text: pct + '%' }), from / 100);
    var line1 = s.todayTotal ? W.t('{done} de {total}', { done: s.todayDone, total: U.plural(s.todayTotal, 'tarea completada', 'tareas completadas') }) : W.t('Nada programado para hoy');
    var chips = [];
    if (s.streak) chips.push(U.el('span.hero-chip', [U.icon('flame'), U.el('b', { text: String(s.streak) }), ' ' + W.tn(s.streak, 'día de racha', 'días de racha')]));
    if (s.focusToday) chips.push(U.el('span.hero-chip', [U.icon('timer'), U.el('b', { text: String(s.focusToday) }), W.t(' min')]));
    if (!chips.length) chips.push(U.el('span.hero-chip', [U.icon('chart'), s.todayTotal && pct === 100 ? W.t('Día completado') : W.t('Ver resumen')]));
    return U.el('button.hero', { attrs: { type: 'button', title: W.t('Ver tu perfil y resumen') }, on: { click: function () { W.Router.go('progress'); } } }, [
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
      var label = d.ds === U.addDays(td, 1) ? W.t('Mañana') : U.cap(U.WEEKDAYS[U.weekday(d.ds)]);
      var rows = d.list.slice(0, 4).map(function (t) {
        return U.el('button.upc-row', { attrs: { title: t.text }, on: {
          click: function () { W.Editor.open(t.id); },
          contextmenu: function (e) { e.preventDefault(); W.TaskCard.actions.menu(t.id, { x: e.clientX, y: e.clientY }); }
        } }, [U.el('b', { text: t.time ? U.fmtTime(t.time) : '—' }), U.el('span', { text: t.text }), t.highlight !== 'none' ? W.UI.prio(t.highlight) : null]);
      });
      return U.el('div.upc-day', [
        U.el('div.upc-date', [U.el('strong', { text: label }), U.el('span', { text: U.parse(d.ds).getDate() + ' ' + U.MONTHS[U.parse(d.ds).getMonth()].slice(0, 3) })]),
        U.el('div', rows),
        d.list.length > 4 ? U.el('div.upc-more', { text: W.t('+{0} más', { 0: d.list.length - 4 }) }) : null
      ]);
    })) : U.el('p.upc-empty', { text: W.t('Nada programado en los próximos 7 días.') });
    return U.el('div.group.card.side-card', [
      U.el('div.card-head', [U.el('strong', { text: W.t('Próximos días') }),
        U.el('button.link-btn.muted', { text: W.t('Calendario'), on: { click: function () { W.Router.go('calendar'); } } })]),
      body
    ]);
  }

  /** Ordenador: el enfoque a mano (empezar o pausar sin salir de Hoy) */
  function focusCard(st) {
    var f = W.Screens.focus.status(), today = st.focusOn(U.today());
    focusTimeEl = U.el('span.fc-time', { text: f.text });
    return U.el('div.group.card.side-card.focus-card' + (f.running ? '.running' : ''), [
      U.el('div.card-head', [U.el('strong', { text: W.t('Enfoque') }),
        U.el('button.link-btn.muted', { text: W.t('Abrir'), on: { click: function () { W.Router.go('focus'); } } })]),
      U.el('div.fc-row', [
        U.el('div.fc-main', [focusTimeEl, U.el('small', { text: f.label + (today.sessions ? ' · ' + W.t('hoy {min} min', { min: today.min }) : '') })]),
        U.el('button.btn.sm' + (f.running ? '.ghost' : '.primary'), { attrs: { title: f.running ? W.t('Pausar') : W.t('Empezar') }, on: { click: function () { W.Screens.focus.toggle(); W.Router.refresh(); } } },
          [U.icon(f.running ? 'pause' : 'play', 'sm'), f.running ? W.t('Pausar') : W.t('Empezar')])
      ])
    ]);
  }

  /** Orden de los bloques del lateral (Ajustes → Personalización) */
  function widgetOrder(st) {
    var order = String(st.settings.desk.widgetOrder || '').split(',').filter(function (k) { return WIDGETS.indexOf(k) >= 0; });
    WIDGETS.forEach(function (k) { if (order.indexOf(k) < 0) order.push(k); });
    return order;
  }

  function permissionText(perm) {
    if (perm !== 'denied') return W.t('Para recibir los avisos de tus tareas');
    if (W.Layout.app) return W.t('Actívalas en la configuración de notificaciones del sistema');
    return W.Layout.desktop ? W.t('Actívalas en los ajustes del navegador') : W.t('Actívalas en los ajustes del teléfono');
  }

  W.Screens.home = {
    title: W.t('Hoy'),
    WIDGETS: WIDGETS,
    widgetOrder: widgetOrder,
    topTasks: topTasks,
    /** Hoja para elegir lo más importante (también desde «Primeros pasos») */
    choose: function () { choosePriorities(S()); },
    /** Cada segundo con el enfoque en marcha: solo cambia el reloj de la tarjeta */
    tick: function () { if (focusTimeEl && focusTimeEl.isConnected) focusTimeEl.textContent = W.Screens.focus.status().text; },
    render: function (root) {
      var st = S(), s = st.stats(), td = U.today(), desk = W.Layout.desktop;
      var name = st.displayName();
      var head = W.UI.header({
        title: W.t('Hoy'), profile: true,
        sub: U.el('span', [U.greeting() + (name ? ', ' : ''), name ? U.el('b', { text: name.split(' ')[0] }) : null, ' · ' + U.inline(U.fmtLong(td))])
      });
      var main = [], side = [];

      // Tras una actualización: aviso discreto con las novedades (se cierra o se abre con un toque)
      var news = W.WhatsNew ? W.WhatsNew.card() : null;
      if (news) main.push(news);
      // En el navegador del iPhone (o con el «Instalar» del navegador): cómo tenerla como app; nunca dos avisos a la vez
      var inst = !news && W.Install ? W.Install.card() : null;
      if (inst) main.push(inst);
      // En el navegador sin cuenta: una semana sin copia de seguridad
      var bk = !news && !inst && W.Backup ? W.Backup.card() : null;
      if (bk) main.push(bk);

      var perm = W.Notify.permission();
      if ((perm === 'default' || perm === 'denied') && st.tasks.some(function (t) { return t.warn && !t.done; })) {
        main.push(W.UI.section({ items: [W.UI.cell({
          icon: 'bell', title: perm === 'denied' ? W.t('Notificaciones bloqueadas') : W.t('Activar notificaciones'),
          sub: permissionText(perm), onTap: function () { W.Notify.request(); }
        })] }));
      }

      var topIds = topTasks(st).list.map(function (t) { return t.id; });
      var topSec = prioritySection(st, desk);
      if (topSec) main.push(topSec);
      // Primeros pasos: arriba mientras no haya nada pendiente; con tareas, después de ellas
      var steps = W.FirstSteps ? W.FirstSteps.card() : null;
      var stepsFirst = !!steps && !st.tasks.some(function (t) { return !t.done; });
      if (stepsFirst) main.push(steps);
      if (!desk) { var mc = messagesCard(st, false); if (mc) main.push(mc); }
      var notTop = function (t) { return topIds.indexOf(t.id) < 0; };
      // En curso: lo que ya empezaste, tenga la fecha que tenga (manda sobre «vencida»)
      var doing = st.tasks.filter(function (t) { return st.isDoing(t) && notTop(t); }).sort(st.compareDeadline);
      var doingIds = doing.map(function (t) { return t.id; });
      var waiting = function (t) { return notTop(t) && doingIds.indexOf(t.id) < 0; };
      var overdue = st.overdueAll().sort(st.compareDeadline).filter(waiting);
      var today = st.tasks.filter(function (t) { return t.date === td && !t.done && !st.isOverdue(t) && waiting(t); }).sort(st.compareDeadline);
      var doneToday = st.tasks.filter(function (t) { return t.done && (t.doneOn === td || t.date === td); })
        .sort(function (a, b) { return (b.doneAt || 0) - (a.doneAt || 0); });

      if (doing.length) {
        main.push(W.UI.section({ cls: 'doing-sec', title: W.t('En curso'), side: U.el('small', { text: doing.length }), items: W.TaskCard.list(doing, { ctx: 'today' }) }));
      }

      if (overdue.length) {
        // Las más recientes primero; si hay muchas, el resto en Tareas → Hoy
        var recent = overdue.slice().reverse().slice(0, MAX_OVERDUE);
        var more = overdue.length > MAX_OVERDUE ? U.el('div.cell-row', { style: { justifyContent: 'flex-end', padding: '6px 4px 0' } }, [
          U.el('button.link-btn', { text: W.t('Ver las {length} vencidas', { length: overdue.length }), on: { click: function () { st.ui.taskView = { type: 'smart', id: 'today' }; W.Router.go('tasks'); } } })]) : null;
        main.push(W.UI.section({ title: W.t('Vencidas'), red: true, side: U.el('small', { text: overdue.length }),
          items: U.el('div', [W.TaskCard.list(recent, { ctx: 'alerts', postpone: true }), more]) }));
      }

      var empty = U.el('div.group', [W.UI.empty(doneToday.length ? 'buddy:trophy:proud' : 'buddy:coffee',
        doneToday.length ? W.t('Todo hecho por hoy') : W.t('Nada pendiente'),
        doneToday.length ? W.t('Has completado {n}.', { n: U.plural(doneToday.length, 'tarea', 'tareas') }) : desk ? W.t('Escribe arriba para añadir algo a hoy.') : W.t('Añade lo que quieras hacer hoy.'),
        doneToday.length || desk ? null : U.el('button.btn.sm.soft', { on: { click: function () { W.QuickAdd.open({ date: td }); } } }, [U.icon('plus', 'sm'), W.t('Nueva tarea')]), true)]);
      var others = topIds.length || doing.length || overdue.length;
      var todayItems = today.length ? W.TaskCard.list(today, { ctx: 'today' }) : (others ? U.el('p.hint', { text: W.t('Nada más pendiente para hoy.') }) : empty);
      main.push(W.UI.section({ cls: 'pending-sec', title: W.t('Pendientes'), side: today.length ? U.el('small', { text: today.length }) : null,
        items: desk ? U.el('div', [W.QuickAdd.inline({ date: td }, W.t('Añadir una tarea para hoy…')), todayItems]) : todayItems }));

      if (doneToday.length) {
        var host = U.el('div.sec');
        var drawDone = function () {
          U.clear(host);
          host.appendChild(U.el('div.done-toggle', [
            U.el('span', { text: U.plural(doneToday.length, 'hecha hoy', 'hechas hoy') }),
            U.el('button.link-btn', { text: showDone ? W.t('Ocultar') : W.t('Mostrar'), on: { click: function () { showDone = !showDone; drawDone(); } } })
          ]));
          if (showDone) host.appendChild(W.TaskCard.list(doneToday, { ctx: 'today' }));
        };
        drawDone();
        main.push(host);
      }
      if (steps && !stepsFirst) main.push(steps);

      if (!desk && st.settings.homeHabits) {
        var hb = W.HabitView.today();
        if (hb) main.push(hb);
      }

      if (!desk) { var pc = pagesCard(false); if (pc) main.push(pc); }

      if (!desk && W.Tips.show('swipe') && (overdue.length || today.length)) {
        main.push(U.el('p.hint', { text: W.t('Desliza una tarea hacia la derecha para completarla o hacia la izquierda para eliminarla.') }));
      }

      focusTimeEl = null;
      if (desk) {
        var widgets = st.settings.desk.widgets;
        widgetOrder(st).forEach(function (k) {
          if (widgets[k] === false) return;
          if (k === 'buddy') side.push(W.Character.companion(true));
          else if (k === 'summary') side.push(summary(s));
          else if (k === 'habits') { var b = W.HabitView.today(); if (b) side.push(b); }
          else if (k === 'upcoming') side.push(upcoming(st));
          else if (k === 'focus') side.push(focusCard(st));
          else if (k === 'messages') { var m2 = messagesCard(st, true); if (m2) side.push(m2); }
          else if (k === 'pages') { var p2 = pagesCard(true); if (p2) side.push(p2); }
        });
        W.UI.mount(root, head, side.length ? [U.el('div.desk-cols', [U.el('div.desk-main', main), U.el('aside.desk-side', side)])] : [U.el('div.desk-solo', main)]);
      } else {
        // Móvil: lo más importante, arriba del todo; después tu día (el personaje y el progreso en
        // una sola tarjeta, o solo el progreso si ocultaste el personaje) y el resto
        var rest = main.filter(function (x) { return x !== topSec; });
        W.UI.mount(root, head, (topSec ? [topSec] : []).concat([st.settings.homeBuddy ? W.Character.dayCard() : summary(s)]).concat(rest));
      }
    }
  };
})(window.Whider);
