/**
 * WHIDER · Inicio: lo que tienes que hacer hoy, de lo más importante a lo menos.
 *  - Arriba, el campo para añadir una tarea (con su importancia y, si quieres, para cada día).
 *  - «Cada día»: las tareas que se repiten varias veces por semana (antes, los hábitos); las ya hechas,
 *    tachadas en su sitio.
 *  - «Por hacer»: las de hoy y las vencidas, por importancia (urgente, importante, destacada y normal);
 *    a igual importancia, primero lo vencido y después por hora. Lo que ya empezaste va delante.
 *  - Las hechas hoy, plegadas; después, la agenda de tus calendarios y los avisos.
 * En el ordenador, a la derecha: la agenda de hoy, los próximos días, quién te escribe y tus páginas.
 */
window.Whider = window.Whider || {};
window.Whider.Screens = window.Whider.Screens || {};

(function (W) {
  'use strict';
  var U = W.U, S = function () { return W.State; };
  var showDone = false, MAX_LATE = 5;
  // Lo elegido junto al campo (importancia y «Cada día") vale para la siguiente tarea
  var draft = { prio: 'none', daily: false };
  var IMPORTANCE = ['danger', 'purple', 'star', 'none'];

  function rank(st, t) { return (st.PRIORITIES[t.highlight] || { rank: 3 }).rank; }
  function isRoutine(t) { return W.Schema.isRoutine(t); }

  /** Por hacer (sin las de cada día): lo empezado delante; después por importancia, lo vencido y la hora */
  function todo(st) {
    var td = U.today();
    return st.tasks.filter(function (t) { return !t.done && !isRoutine(t) && (t.date === td || st.isOverdue(t) || st.isDoing(t)); })
      .sort(function (a, b) {
        var da = st.isDoing(a) ? 0 : 1, db = st.isDoing(b) ? 0 : 1;
        var oa = st.isOverdue(a) ? 0 : 1, ob = st.isOverdue(b) ? 0 : 1;
        return (da - db) || (rank(st, a) - rank(st, b)) || (oa - ob) || st.compareDeadline(a, b);
      });
  }
  /** Las de cada día que tocan hoy: pendientes (por hora) y, al final, las hechas */
  function routines(st) {
    var td = U.today();
    return st.tasks.filter(function (t) { return t.date === td && isRoutine(t); }).sort(function (a, b) {
      return (Number(a.done) - Number(b.done)) || String(a.time || '99').localeCompare(String(b.time || '99')) || (rank(st, a) - rank(st, b));
    });
  }
  /** Lo primero para el widget de Android y la bandeja del ordenador: lo que toca hoy, por importancia */
  function topTasks(st) {
    var list = todo(st).concat(routines(st).filter(function (t) { return !t.done; }));
    return { list: list.slice(0, 5), total: list.length };
  }

  /* ---------- Escribir una tarea ---------- */
  function composer(st) {
    var td = U.today();
    var input = U.el('input', { attrs: { type: 'text', maxlength: 200, placeholder: W.t('Añadir una tarea…'), enterkeyhint: 'done', 'aria-label': W.t('Nueva tarea para hoy') } });
    var prioBtn = U.el('button.cp-opt', { attrs: { type: 'button', title: W.t('Importancia de la tarea') } });
    var dailyBtn = U.el('button.cp-opt', { attrs: { type: 'button', title: W.t('Se repite todos los días') } });
    var paint = function () {
      U.clear(prioBtn);
      prioBtn.appendChild(U.el('i.imp-dot.imp-' + draft.prio, { attrs: { 'aria-hidden': 'true' } }));
      prioBtn.appendChild(document.createTextNode(draft.prio === 'none' ? W.t('Importancia') : st.PRIORITIES[draft.prio].label));
      prioBtn.classList.toggle('on', draft.prio !== 'none');
      U.clear(dailyBtn);
      dailyBtn.appendChild(U.icon('repeat', 'xs'));
      dailyBtn.appendChild(document.createTextNode(W.t('Cada día')));
      dailyBtn.classList.toggle('on', draft.daily);
      dailyBtn.setAttribute('aria-pressed', draft.daily ? 'true' : 'false');
    };
    prioBtn.addEventListener('click', function () {
      W.Menu.open(prioBtn, IMPORTANCE.map(function (k) { return { value: k, label: st.PRIORITIES[k].label, prio: k, on: draft.prio === k }; }), { title: W.t('Importancia') })
        .then(function (v) { if (v) { draft.prio = v; paint(); } input.focus(); });
    });
    dailyBtn.addEventListener('click', function () { draft.daily = !draft.daily; paint(); input.focus(); });
    var add = function () {
      var raw = input.value.trim();
      if (!raw) { input.focus(); return; }
      var p = W.Parse.task(raw, { lists: st.lists });
      if (!p.text) return;
      st.addTask({
        text: p.text, date: p.date !== undefined ? p.date : td, time: p.time || null, listId: p.listId || st.defaultListId(),
        highlight: p.highlight || draft.prio, repeat: p.repeat || (draft.daily ? 'daily' : 'none'), days: p.days,
        warn: st.settings.defaultWarn, notes: '', subtasks: []
      });
      draft = { prio: 'none', daily: false };
      W.Audio.vibrate([8]);
      // La pantalla se vuelve a pintar: el foco vuelve al campo para seguir escribiendo
      requestAnimationFrame(function () { requestAnimationFrame(function () { var i = U.$('.screen.active .composer input'); if (i) i.focus(); }); });
    };
    input.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); add(); } });
    var send = U.el('button.cp-send', { attrs: { type: 'button', 'aria-label': W.t('Añadir'), title: W.t('Añadir (Intro)') }, on: { click: add } }, [U.icon('arrow-up')]);
    paint();
    return U.el('div.composer', [
      U.el('div.cp-row', [U.el('span.cp-plus', { attrs: { 'aria-hidden': 'true' } }, [U.icon('plus')]), input, send]),
      U.el('div.cp-opts', [prioBtn, dailyBtn])
    ]);
  }

  /* ---------- Lateral del ordenador ---------- */
  /** Mensajes sin leer y solicitudes: lo de otras personas que espera respuesta */
  function messagesCard() {
    if (!W.Chat || !W.People) return null;
    var unread = W.Chat.list().filter(W.Chat.unread).slice(0, 3), reqs = W.People.pendingCount();
    if (!unread.length && !reqs) return null;
    var rows = unread.map(function (c) {
      return U.el('button.hm-msg', { attrs: { type: 'button' }, on: { click: function () { W.Chat.openChat(c.id); } } }, [
        c.type === 'team' ? U.el('span.av.av-team', { style: { '--s': '34px' } }, [U.el('span.av-in', [U.icon('team')])]) : W.Avatar.small(W.Chat.other(c), 34),
        U.el('span.hm-main', [U.el('b', { text: W.Chat.title(c) }), U.el('small', { text: (c.last && c.last.text) || '' })]), U.el('i.ct-dot')]);
    });
    if (reqs) rows.push(U.el('button.hm-msg', { attrs: { type: 'button' }, on: { click: function () { W.Router.go('friends'); } } }, [U.el('span.hm-ic', [U.icon('users')]),
      U.el('span.hm-main', [U.el('b', { text: U.plural(reqs, 'solicitud nueva', 'solicitudes nuevas') }), U.el('small', { text: W.t('Quieren conectar contigo') })]), U.el('i.ct-dot')]));
    return U.el('div.side-card.hm-card', [U.el('div.card-head', [U.el('strong', { text: W.t('Te están esperando') }), U.el('button.link-btn.muted', { text: W.t('Personas'), on: { click: function () { W.Router.go('friends'); } } })]), U.el('div.hm-list', rows)]);
  }
  /** Páginas recientes del Cuaderno */
  function pagesCard() {
    if (!W.Pages) return null;
    var list = W.Pages.recent(4);
    if (!list.length) return null;
    var items = list.map(function (p) {
      return U.el('button.hm-page', { attrs: { type: 'button' }, on: { click: function () { W.Notes.openPage(p.id); } } }, [U.el('span.hm-ic', [U.icon(p.icon || (p.kind === 'db' ? 'database' : 'page'))]), U.el('span.hm-main', [U.el('b', { text: W.Pages.title(p) }), U.el('small', { text: W.t('Editada {0}', { 0: U.fmtRel(Math.max(p.at, p.cv) - Date.now()) }) })])]);
    });
    return U.el('div.side-card', [U.el('div.card-head', [U.el('strong', { text: W.t('Cuaderno') }), U.el('button.link-btn.muted', { text: W.t('Abrir'), on: { click: function () { W.Router.go('notes'); } } })]), U.el('div.hm-list', items)]);
  }
  /** El mes de un vistazo (ordenador): los días con tareas, marcados; un clic abre ese día en el calendario */
  function miniCal(st) {
    var now = new Date(), y = now.getFullYear(), m = now.getMonth(), td = U.today(), prefix = y + '-' + U.pad(m + 1), byDay = {};
    st.tasks.forEach(function (t) { if (!t.done && t.date && t.date.slice(0, 7) === prefix) byDay[t.date] = (byDay[t.date] || 0) + 1; });
    var grid = W.UI.monthGrid({ y: y, m: m, selected: null,
      mark: function (ds) { var n = byDay[ds]; return n ? { dots: [{ kind: ds < td ? 'late' : null }], label: U.plural(n, 'tarea', 'tareas') } : null; },
      onPick: function (ds) {
        var d = U.parse(ds);
        st.ui.calSelected = ds;
        st.ui.calMonth = { y: d.getFullYear(), m: d.getMonth() };
        W.Router.go('calendar');
      } });
    return U.el('div.side-card.mini-cal', [
      U.el('div.card-head', [U.el('strong', { text: U.cap(U.fmtMonth(y, m)) }),
        U.el('button.link-btn.muted', { text: W.t('Calendario'), on: { click: function () { W.Router.go('calendar'); } } })]),
      grid
    ]);
  }

  /** Lo que viene en los próximos 7 días, día a día */
  function upcoming(st) {
    var td = U.today(), days = [];
    for (var i = 1; i <= 7; i++) {
      var ds = U.addDays(td, i);
      var list = st.tasks.filter(function (t) { return !t.done && t.date === ds; }).sort(function (a, b) { return (rank(st, a) - rank(st, b)) || st.compareDeadline(a, b); });
      if (list.length) days.push({ ds: ds, list: list });
    }
    var body = days.length ? U.el('div.upc', days.map(function (d) {
      var label = d.ds === U.addDays(td, 1) ? W.t('Mañana') : U.cap(U.WEEKDAYS[U.weekday(d.ds)]);
      var rows = d.list.slice(0, 4).map(function (t) {
        return U.el('button.upc-row', { attrs: { title: t.text }, on: {
          click: function () { W.Editor.open(t.id); },
          contextmenu: function (e) { e.preventDefault(); W.TaskCard.actions.menu(t.id, { x: e.clientX, y: e.clientY }); }
        } }, [U.el('i.imp-dot.imp-' + t.highlight, { attrs: { 'aria-hidden': 'true' } }), U.el('span', { text: t.text }), U.el('b', { text: t.time ? U.fmtTime(t.time) : '' })]);
      });
      return U.el('div.upc-day', [
        U.el('div.upc-date', [U.el('strong', { text: label }), U.el('span', { text: U.parse(d.ds).getDate() + ' ' + U.MONTHS[U.parse(d.ds).getMonth()].slice(0, 3) })]),
        U.el('div', rows),
        d.list.length > 4 ? U.el('div.upc-more', { text: W.t('+{0} más', { 0: d.list.length - 4 }) }) : null
      ]);
    })) : U.el('p.upc-empty', { text: W.t('Nada programado en los próximos 7 días.') });
    return U.el('div.side-card', [
      U.el('div.card-head', [U.el('strong', { text: W.t('Próximos días') }),
        U.el('button.link-btn.muted', { text: W.t('Calendario'), on: { click: function () { W.Router.go('calendar'); } } })]),
      body
    ]);
  }

  function permissionText(perm) {
    if (perm !== 'denied') return W.t('Para recibir los avisos de tus tareas');
    if (W.Layout.app) return W.t('Actívalas en la configuración de notificaciones del sistema');
    return W.Layout.desktop ? W.t('Actívalas en los ajustes del navegador') : W.t('Actívalas en los ajustes del teléfono');
  }

  /** Aviso, una sola vez, de que los hábitos ahora son tareas de cada día */
  function movedNotice(st) {
    var n = st.meta.habitsMoved;
    if (!n) return null;
    var close = function () { st.setMeta('habitsMoved', 0); W.Router.refresh(); };
    return U.el('div.notice', [
      U.el('span.notice-ic', [U.icon('repeat')]),
      U.el('span.notice-main', [U.el('b', { text: W.t('Tus hábitos ahora son tareas de cada día') }),
        U.el('small', { text: W.tn(n, 'Está en «Cada día», con su horario. Su historial sigue guardado.', 'Están en «Cada día», con su horario. Su historial sigue guardado.') })]),
      U.el('button.nav-icon', { attrs: { 'aria-label': W.t('Cerrar'), title: W.t('Cerrar') }, on: { click: close } }, [U.icon('close')])
    ]);
  }

  W.Screens.home = {
    title: W.t('Inicio'),
    topTasks: topTasks,
    todo: todo,
    routines: routines,
    /** Al campo de arriba, con la importancia ({ prio }) o «Cada día» ({ daily }) ya elegidos */
    compose: function (opts) {
      opts = opts || {};
      if (opts.prio) draft.prio = 'purple';
      if (opts.daily) draft.daily = true;
      W.Router.refresh();
      requestAnimationFrame(function () { var i = U.$('.screen.active .composer input'); if (i) { i.focus(); i.scrollIntoView({ block: 'center' }); } });
    },
    render: function (root) {
      var st = S(), s = st.stats(), td = U.today(), desk = W.Layout.desktop;
      var progress = s.todayTotal ? W.t('{done} de {total} hechas', { done: s.todayDone, total: s.todayTotal }) : '';
      var head = W.UI.header({ title: W.t('Inicio'), sub: U.cap(U.fmtLong(td)) + (progress ? ' · ' + progress : '') });
      var main = [composer(st)], side = [], notices = [];

      var moved = movedNotice(st);
      if (moved) main.push(moved);
      // Tras una actualización: aviso discreto con las novedades (se cierra o se abre con un toque)
      var news = !moved && W.WhatsNew ? W.WhatsNew.card() : null;
      if (news) main.push(news);

      // Cada día
      var daily = routines(st);
      if (daily.length) {
        var hechas = daily.filter(function (t) { return t.done; }).length;
        main.push(W.UI.section({ cls: 'daily-sec', title: W.t('Cada día'), side: U.el('small', { text: W.t('{done} de {total}', { done: hechas, total: daily.length }) }),
          items: W.TaskCard.list(daily, { ctx: 'today' }) }));
      }

      // Por hacer: hoy y lo vencido (si hay muchas vencidas, las más recientes y el resto en Tareas)
      var list = todo(st), late = list.filter(function (t) { return t.date && t.date < td && !st.isDoing(t); });
      var hidden = [];
      if (late.length > MAX_LATE) {
        var keep = late.slice().sort(function (a, b) { return a.date < b.date ? 1 : a.date > b.date ? -1 : 0; }).slice(0, MAX_LATE);
        hidden = late.filter(function (t) { return keep.indexOf(t) < 0; });
        list = list.filter(function (t) { return hidden.indexOf(t) < 0; });
      }
      var doneToday = st.tasks.filter(function (t) { return t.done && !isRoutine(t) && (t.doneOn === td || t.date === td); })
        .sort(function (a, b) { return (b.doneAt || 0) - (a.doneAt || 0); });
      if (list.length) {
        var moreLate = hidden.length ? U.el('div.sec-more', [U.el('button.link-btn', { text: W.t('Ver las {length} vencidas', { length: late.length }),
          on: { click: function () { st.ui.taskView = { type: 'smart', id: 'today' }; W.Router.go('tasks'); } } })]) : null;
        main.push(W.UI.section({ cls: 'todo-sec', title: W.t('Por hacer'), side: U.el('small', { text: String(list.length + hidden.length) }),
          items: U.el('div', [W.TaskCard.list(list, { ctx: 'today', postpone: false }), moreLate]) }));
      } else if (!daily.length) {
        main.push(U.el('div.group', [W.UI.empty(doneToday.length ? 'check' : 'coffee',
          doneToday.length ? W.t('Todo hecho por hoy') : W.t('Nada por hacer hoy'),
          doneToday.length ? W.t('Has completado {n}.', { n: U.plural(doneToday.length, 'tarea', 'tareas') }) : W.t('Escribe arriba lo que quieras hacer y elige su importancia.'), null, true)]));
      } else main.push(U.el('p.hint', { text: W.t('Nada más por hacer hoy.') }));

      if (doneToday.length) {
        var host = U.el('div.sec.done-sec');
        var drawDone = function () {
          U.clear(host);
          host.appendChild(U.el('button.done-toggle', { attrs: { type: 'button', 'aria-expanded': showDone ? 'true' : 'false' }, on: { click: function () { showDone = !showDone; drawDone(); } } }, [
            U.icon(showDone ? 'down' : 'chev', 'xs'),
            U.el('span', { text: U.plural(doneToday.length, 'hecha hoy', 'hechas hoy') })
          ]));
          if (showDone) host.appendChild(W.TaskCard.list(doneToday, { ctx: 'today' }));
        };
        drawDone();
        main.push(host);
      }

      // Agenda de hoy: los eventos de tus calendarios suscritos (si tienes alguno y hay eventos hoy)
      var agenda = W.CalSubs ? W.CalSubs.homeSection() : null;
      if (agenda) (desk ? side : main).push(agenda);

      // Avisos: debajo de las tareas
      var perm = W.Notify.permission();
      if ((perm === 'default' || perm === 'denied') && st.tasks.some(function (t) { return t.warn && !t.done; })) {
        notices.push(W.UI.section({ items: [W.UI.cell({
          icon: 'bell', title: perm === 'denied' ? W.t('Notificaciones bloqueadas') : W.t('Activar notificaciones'),
          sub: permissionText(perm), onTap: function () { W.Notify.request(); }
        })] }));
      }
      // En el navegador del iPhone (o con el «Instalar» del navegador): cómo tenerla como app; nunca dos avisos a la vez
      var inst = W.Install ? W.Install.card() : null;
      if (inst) notices.push(inst);
      // En el navegador sin cuenta: una semana sin copia de seguridad
      var bk = !inst && W.Backup ? W.Backup.card() : null;
      if (bk) notices.push(bk);
      main = main.concat(notices);

      if (!desk && W.Tips.show('swipe') && (list.length || daily.length)) {
        main.push(U.el('p.hint', { text: W.t('Desliza una tarea hacia la derecha para completarla o hacia la izquierda para eliminarla.') }));
      }

      if (desk) {
        side.unshift(miniCal(st));
        side.push(upcoming(st));
        var m = messagesCard(); if (m) side.push(m);
        var p = pagesCard(); if (p) side.push(p);
        W.UI.mount(root, head, [U.el('div.desk-cols', [U.el('div.desk-main', main), U.el('aside.desk-side', side)])]);
      } else W.UI.mount(root, head, main);
    }
  };
})(window.Whider);
