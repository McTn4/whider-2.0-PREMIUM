/**
 * WHIDER · Calendario con tres vistas:
 *  - Mes: cuadrícula con puntos (uno por tarea pendiente, uno que brilla si hay algo vencido y
 *    uno hueco para las repeticiones futuras) y el día elegido por horas con un campo para añadir.
 *  - Semana: tira de 7 días y el día por horas; toca un hueco para crear una tarea a esa hora
 *    y mantén pulsada una tarea para arrastrarla a otra hora.
 *  - Agenda: lo vencido y los próximos 30 días, con las tareas que se repiten.
 * Filtro por lista y opción de mostrar u ocultar las completadas.
 */
window.Whider = window.Whider || {};
window.Whider.Screens = window.Whider.Screens || {};

(function (W) {
  'use strict';
  var U = W.U, S = function () { return W.State; };
  var slideDir = 0, rootEl = null;
  var HOUR_H = 56;
  var VIEWS = [{ value: 'month', label: W.t('Mes') }, { value: 'week', label: W.t('Semana') }, { value: 'agenda', label: W.t('Agenda') }];
  var DESK_VIEWS = [{ value: 'month', label: W.t('Mes') }, { value: 'week', label: W.t('Semana') }, { value: 'day', label: W.t('Día') }, { value: 'agenda', label: W.t('Agenda') }];
  function blockMin(t) { return t.duration || 45; }
  function endLabel(t) { var e = (minutesOf(t) + (t.duration || 0)) % 1440; return U.fmtTime(U.pad(Math.floor(e / 60)) + ':' + U.pad(e % 60)); }

  /* ---------- Exportar a otros calendarios (iCalendar .ics) ---------- */
  function icsText(s) { return String(s || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n'); }
  function icsFold(line) { var out = []; while (line.length > 73) { out.push(line.slice(0, 73)); line = ' ' + line.slice(73); } out.push(line); return out.join('\r\n'); }
  function exportIcs(st) {
    var stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
    var RR = { daily: 'FREQ=DAILY', weekly: 'FREQ=WEEKLY', monthly: 'FREQ=MONTHLY', weekdays: 'FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR' };
    var PRI = { danger: 1, purple: 3, star: 5 };
    var lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//WHIDER//Calendario//ES', 'CALSCALE:GREGORIAN', 'X-WR-CALNAME:WHIDER'];
    var n = 0;
    st.tasks.filter(function (t) { return t.date && !t.done; }).forEach(function (t) {
      var d = t.date.replace(/-/g, ''), l = t.listId ? st.getList(t.listId) : null;
      lines.push('BEGIN:VEVENT', 'UID:' + t.id + '@whider', 'DTSTAMP:' + stamp);
      if (t.time) {
        var s = U.parse(t.date); var p = t.time.split(':'); s.setHours(+p[0], +p[1], 0, 0);
        var e = new Date(s.getTime() + (t.duration || 30) * 60000);
        var f = function (x) { return U.ymd(x).replace(/-/g, '') + 'T' + U.pad(x.getHours()) + U.pad(x.getMinutes()) + '00'; };
        lines.push('DTSTART:' + f(s), 'DTEND:' + f(e));
      } else lines.push('DTSTART;VALUE=DATE:' + d, 'DTEND;VALUE=DATE:' + U.addDays(t.date, 1).replace(/-/g, ''));
      lines.push(icsFold('SUMMARY:' + icsText(t.text)));
      if (t.notes) lines.push(icsFold('DESCRIPTION:' + icsText(t.notes)));
      if (l) lines.push(icsFold('CATEGORIES:' + icsText(l.name)));
      if (RR[t.repeat]) lines.push('RRULE:' + RR[t.repeat]);
      if (PRI[t.highlight]) lines.push('PRIORITY:' + PRI[t.highlight]);
      if (t.warn && t.time) lines.push('BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:' + icsText(t.text), 'TRIGGER:-PT' + (typeof t.remindBefore === 'number' ? t.remindBefore : st.settings.remindBefore) + 'M', 'END:VALARM');
      lines.push('END:VEVENT');
      n++;
    });
    lines.push('END:VCALENDAR');
    if (!n) { W.Toast.show({ text: W.t('No hay tareas pendientes con fecha para exportar'), icon: 'info' }); return; }
    U.saveFile('whider-calendario', lines.join('\r\n') + '\r\n', 'ics');
    if (!window.WhiderDesktop) W.Toast.show({ text: W.t('{n} · ábrelo con tu calendario', { n: U.plural(n, 'tarea exportada', 'tareas exportadas') }), icon: 'download' });
  }

  /* ---------- Estado de la vista ---------- */
  function ui(st) {
    // En el ordenador, la vista al abrir se elige en Ajustes → Personalización
    if (!st.ui.calView) st.ui.calView = W.Layout.desktop ? (st.settings.desk.calView || 'month') : 'month';
    if (!st.ui.calSelected) st.ui.calSelected = U.today();
    if (!st.ui.calMonth) { var n = U.parse(st.ui.calSelected); st.ui.calMonth = { y: n.getFullYear(), m: n.getMonth() }; }
    if (st.ui.calShowDone === undefined) st.ui.calShowDone = true;
    return st.ui;
  }
  function rerender() { if (rootEl) W.Screens.calendar.render(rootEl); }
  function select(st, ds) {
    st.ui.calSelected = ds;
    var d = U.parse(ds);
    st.ui.calMonth = { y: d.getFullYear(), m: d.getMonth() };
  }
  function weekStart(st, ds) { var ws = st.settings.weekStart; return U.addDays(ds, -((U.weekday(ds) - ws + 7) % 7)); }
  function dayName(ds) {
    var td = U.today();
    if (ds === td) return W.t('Hoy');
    if (ds === U.addDays(td, 1)) return W.t('Mañana');
    if (ds === U.addDays(td, -1)) return W.t('Ayer');
    return U.fmtLong(ds);
  }

  /* ---------- Datos: tareas reales y repeticiones previstas ---------- */
  function pool(st) {
    var f = st.ui.calList;
    return st.tasks.filter(function (t) { return (!f || t.listId === f) && (st.ui.calShowDone || !t.done); });
  }
  /**
   * { fecha: [tareas] }, { fecha: [{ base, date }] } (repeticiones previstas) y { fecha: [eventos] } de los
   * calendarios suscritos (js/core/calendars.js) para un intervalo
   */
  function collect(st, from, to) {
    var byDate = {}, proj = {}, n = 0;
    pool(st).forEach(function (t) {
      if (t.date && t.date >= from && t.date <= to) (byDate[t.date] = byDate[t.date] || []).push(t);
      if (!t.done && t.repeat !== 'none' && n < 400) {
        st.occurrences(t, from, to, 62).forEach(function (d) { (proj[d] = proj[d] || []).push({ base: t, date: d }); n++; });
      }
    });
    return { byDate: byDate, proj: proj, ev: W.Calendars ? W.Calendars.byDate(from, to) : {} };
  }
  function eventsOf(data, ds) { return (data.ev && data.ev[ds]) || []; }
  function evCount(n) { return U.plural(n, 'evento', 'eventos'); }
  /** Bloque de un evento en el día por horas o en la semana (no se arrastra: se abre su ficha) */
  function eventBlock(e, style, desk) {
    var blk = U.el('div.blk.ev' + (desk ? '.wg-blk' : ''), {
      attrs: { role: 'button', tabindex: '0', title: W.CalSubs.label(e), 'aria-label': W.t('Evento: {label}', { label: W.CalSubs.label(e) }) }, style: style
    }, [U.el('b', { text: W.CalSubs.title(e) }), U.el('small', { text: W.CalSubs.when(e) + (e.calName ? ' · ' + e.calName : '') })]);
    blk.addEventListener('click', function (ev) { ev.stopPropagation(); W.CalSubs.open(e); });
    blk.addEventListener('keydown', function (ev) { if (ev.key === 'Enter') W.CalSubs.open(e); });
    return blk;
  }
  function sortDay(st, list) {
    return list.slice().sort(function (a, b) {
      if (a.done !== b.done) return a.done ? 1 : -1;
      if (!!a.time !== !!b.time) return a.time ? -1 : 1;
      return st.compareDeadline(a, b);
    });
  }

  /* ---------- Filas (reales y previstas) ---------- */
  function projectedRow(st, p) {
    var t = p.base;
    var check = U.el('span.check' + (t.highlight !== 'none' ? '.p-' + t.highlight : ''));
    var meta = U.el('div.task-meta', [U.el('span.rep-tag', [U.icon('repeat'), st.REPEATS[t.repeat]])]);
    var l = t.listId ? st.getList(t.listId) : null;
    if (l) { meta.appendChild(U.el('span.sep', { text: '·' })); meta.appendChild(U.el('span', { text: l.name })); }
    var body = U.el('div.task-body', [U.el('span.tl-time' + (t.time ? '' : '.none'), { text: t.time ? U.fmtTime(t.time) : '—' }), check,
      U.el('div.task-main', [U.el('span.task-title', { text: t.text }), meta])]);
    body.addEventListener('click', function () { W.Editor.open(t.id); });
    return U.el('li.task.projected', { attrs: { 'aria-label': W.t('{text} (se repite)', { text: t.text }) } }, [body]);
  }
  function dayList(st, ds, real, proj) {
    var items = sortDay(st, real || []);
    var ul = W.TaskCard.list(items, function (t) { return { ctx: 'day', time: t.time ? U.fmtTime(t.time) : '—' }; });
    U.$$('.tl-time', ul).forEach(function (el) { if (el.textContent === '—') el.classList.add('none'); });
    (proj || []).forEach(function (p) { ul.appendChild(projectedRow(st, p)); });
    ul.classList.add('timeline');
    return ul;
  }

  /** Campo para añadir directamente al día elegido (entiende hora, lista y prioridad) */
  function quickDay(st, ds) {
    var input = U.el('input', { attrs: { type: 'text', maxlength: 200, placeholder: W.t('Añadir a {day}…', { day: U.inline(dayName(ds)) }), enterkeyhint: 'done', 'aria-label': W.t('Añadir tarea a este día') } });
    var add = function () {
      var raw = input.value.trim();
      if (!raw) { input.focus(); return; }
      var p = W.Parse.task(raw, { lists: st.lists });
      st.addTask({ text: p.text, date: ds, time: p.time || null, listId: p.listId || st.ui.calList || st.settings.defaultList, highlight: p.highlight || 'none',
        repeat: p.repeat || 'none', warn: st.settings.defaultWarn, notes: '', subtasks: [] });
      W.Audio.vibrate([8]);
      setTimeout(function () { var i = U.$('#screen-calendar .quick-day input'); if (i) i.focus(); }, 60);
    };
    input.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); add(); } });
    return U.el('label.quick-day', [U.icon('plus'), input, U.el('button.btn.soft.sm', { text: W.t('Añadir'), on: { click: add } })]);
  }

  function dayPanel(st, ds, data) {
    var real = data.byDate[ds] || [], proj = data.proj[ds] || [], evs = eventsOf(data, ds);
    var done = real.filter(function (t) { return t.done; }).length;
    var info = real.length ? W.tn(real.length, '{done} de {n} tarea completada', '{done} de {n} tareas completadas', { done: done }) : proj.length ? U.plural(proj.length, 'tarea que se repite', 'tareas que se repiten') : evs.length ? '' : W.t('Sin tareas');
    if (evs.length) info = (info ? info + ' · ' : '') + evCount(evs.length);
    var head = U.el('div.day-head', [
      U.el('div', [U.el('strong', { text: dayName(ds) }), U.el('span', { text: (ds === U.today() || Math.abs(U.diffDays(U.today(), ds)) === 1 ? U.fmtLong(ds) + ' · ' : '') + info })]),
      real.length ? U.el('div.day-progress', [U.el('div.bar', [U.el('i', { style: { width: Math.round(done / real.length * 100) + '%' } })])]) : null
    ]);
    var body = real.length || proj.length ? dayList(st, ds, real, proj) : evs.length ? null
      : U.el('div.group', [W.UI.empty('calendar', W.t('Día libre'), ds < U.today() ? W.t('No hubo tareas este día.') : W.t('Escribe arriba para añadir algo a este día.'), null, true)]);
    return U.el('div.sec', [head, ds >= U.today() ? quickDay(st, ds) : null, evs.length ? U.el('div.group.ev-group', [W.CalSubs.list(evs)]) : null, body]);
  }

  /* ---------- Vista Mes ---------- */
  function monthView(st) {
    var cm = st.ui.calMonth, td = U.today();
    var from = U.ymd(new Date(cm.y, cm.m, 1)), to = U.ymd(new Date(cm.y, cm.m + 1, 0));
    var data = collect(st, from, to);
    var grid = W.UI.monthGrid({
      y: cm.y, m: cm.m, selected: st.ui.calSelected, slide: slideDir,
      /* Hasta tres puntos: uno que brilla si hay algo vencido, uno por tarea pendiente
         (así se ve lo cargado que está el día) y uno hueco si hay repeticiones previstas. */
      mark: function (ds) {
        var real = data.byDate[ds] || [], proj = data.proj[ds] || [], evs = eventsOf(data, ds), dots = [];
        var pend = real.filter(function (t) { return !t.done; });
        var late = pend.filter(function (t) { return st.isOverdue(t); }).length;
        if (late) dots.push({ kind: 'late' });
        var room = 3 - dots.length - (proj.length ? 1 : 0) - (evs.length ? 1 : 0);
        for (var i = 0; i < Math.min(pend.length - late, room); i++) dots.push({});
        if (proj.length) dots.push({ kind: 'rep' });
        // Un rombo hueco: hay eventos de tus calendarios suscritos
        if (evs.length) dots.push({ kind: 'ev' });
        if (!pend.length && !proj.length && real.length && ds <= td) dots.push({ kind: 'done' });
        if (!dots.length) return null;
        var what = pend.length ? U.plural(pend.length, 'pendiente', 'pendientes') : proj.length ? W.t('se repite') : real.length ? W.t('completado') : '';
        return { dots: dots, label: [what, evs.length ? evCount(evs.length) : ''].filter(Boolean).join(', ') };
      },
      onPick: function (ds) { st.ui.calSelected = ds; W.Audio.select(); rerender(); }
    });
    slideDir = 0;
    var sx = null, sy = 0;
    grid.addEventListener('pointerdown', function (e) { sx = e.clientX; sy = e.clientY; });
    grid.addEventListener('pointerup', function (e) {
      if (sx === null) return;
      var dx = e.clientX - sx, dy = e.clientY - sy; sx = null;
      if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) shiftMonth(st, dx < 0 ? 1 : -1);
    });
    grid.addEventListener('pointercancel', function () { sx = null; });
    var title = U.el('button.cal-title', { attrs: { type: 'button', 'aria-label': W.t('{month}, elegir mes', { month: U.fmtMonth(cm.y, cm.m) }) } }, [U.fmtMonth(cm.y, cm.m), U.icon('down')]);
    title.addEventListener('click', function () { pickMonth(st, title); });
    var card = U.el('div.group.cal', [
      U.el('div.cal-head', [title, U.el('div.cal-arrows', [
        W.UI.navBtn({ icon: 'left', label: W.t('Mes anterior'), onTap: function () { shiftMonth(st, -1); } }),
        W.UI.navBtn({ icon: 'right', label: W.t('Mes siguiente'), onTap: function () { shiftMonth(st, 1); } })
      ])]),
      grid
    ]);
    // Panel del día elegido (si está fuera del mes visible, se ve igualmente)
    var sel = st.ui.calSelected, selData = sel >= from && sel <= to ? data : collect(st, sel, sel);
    return [card, dayPanel(st, sel, selData)];
  }
  function shiftMonth(st, delta) {
    var cm = st.ui.calMonth, d = new Date(cm.y, cm.m + delta, 1);
    st.ui.calMonth = { y: d.getFullYear(), m: d.getMonth() };
    var keepDay = Math.min(U.parse(st.ui.calSelected).getDate(), new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate());
    var today = new Date();
    st.ui.calSelected = d.getFullYear() === today.getFullYear() && d.getMonth() === today.getMonth() ? U.today() : U.ymd(new Date(d.getFullYear(), d.getMonth(), keepDay));
    slideDir = delta;
    W.Audio.select();
    rerender();
  }
  function pickMonth(st, anchor) {
    var y = st.ui.calMonth.y, opts = [];
    for (var m = 0; m < 12; m++) opts.push({ value: y + ':' + m, label: U.cap(U.MONTHS[m]) + ' ' + y, on: m === st.ui.calMonth.m });
    opts.push({ value: (y + 1) + ':0', label: U.fmtMonth(y + 1, 0), gap: true });
    opts.push({ value: 'today', label: W.t('Ir a hoy'), icon: 'today' });
    W.Menu.open(anchor, opts).then(function (v) {
      if (!v) return;
      if (v === 'today') { select(st, U.today()); rerender(); return; }
      var p = v.split(':'); st.ui.calMonth = { y: +p[0], m: +p[1] };
      var t = new Date();
      st.ui.calSelected = +p[0] === t.getFullYear() && +p[1] === t.getMonth() ? U.today() : U.ymd(new Date(+p[0], +p[1], 1));
      rerender();
    });
  }

  /* ---------- Vista Semana ---------- */
  function weekView(st) {
    var sel = st.ui.calSelected, start = weekStart(st, sel), end = U.addDays(start, 6), td = U.today();
    var data = collect(st, start, end);
    var strip = U.el('div.week-days');
    for (var i = 0; i < 7; i++) {
      (function (ds) {
        var real = data.byDate[ds] || [], done = real.filter(function (t) { return t.done; }).length;
        var total = real.length + (data.proj[ds] || []).length, nEv = eventsOf(data, ds).length;
        var b = U.el('button.wk-day' + (ds === sel ? '.selected' : '') + (ds === td ? '.today' : '') + (ds < td ? '.past' : ''), {
          attrs: { 'aria-label': U.fmtLong(ds) + (total ? ', ' + U.plural(total, 'tarea', 'tareas') : '') + (nEv ? ', ' + evCount(nEv) : ''), 'aria-pressed': ds === sel ? 'true' : 'false' }
        }, [U.el('small', { text: U.WEEKDAYS_LETTER[U.weekday(ds)] }), U.el('b', { text: U.parse(ds).getDate() }),
          // Barra: lo completado del día (tenue si aún no hay nada hecho)
          U.el('span.wk-bar', [U.el('i', { style: !total ? { width: '0%' } : done ? { width: Math.max(12, Math.round(done / total * 100)) + '%' } : { width: '100%', opacity: '.35' } })])]);
        b.addEventListener('click', function () { st.ui.calSelected = ds; W.Audio.select(); rerender(); });
        strip.appendChild(b);
      })(U.addDays(start, i));
    }
    var sx = null, sy = 0;
    strip.addEventListener('pointerdown', function (e) { sx = e.clientX; sy = e.clientY; });
    strip.addEventListener('pointerup', function (e) {
      if (sx === null) return;
      var dx = e.clientX - sx, dy = e.clientY - sy; sx = null;
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) shiftWeek(st, dx < 0 ? 1 : -1);
    });
    strip.addEventListener('pointercancel', function () { sx = null; });
    var range = U.fmtRange(start, end);
    var card = U.el('div.group.week', [
      U.el('div.cal-head', [U.el('span.cal-title', { text: U.cap(range) }), U.el('div.cal-arrows', [
        W.UI.navBtn({ icon: 'left', label: W.t('Semana anterior'), onTap: function () { shiftWeek(st, -1); } }),
        W.UI.navBtn({ icon: 'right', label: W.t('Semana siguiente'), onTap: function () { shiftWeek(st, 1); } })
      ])]),
      strip
    ]);
    return [card, dayTimeline(st, sel, data)];
  }
  function shiftWeek(st, delta) { select(st, U.addDays(st.ui.calSelected, 7 * delta)); W.Audio.select(); rerender(); }

  /** El día por horas: sin hora arriba, el resto colocado en su hora */
  function dayTimeline(st, ds, data) {
    var real = sortDay(st, data.byDate[ds] || []), proj = data.proj[ds] || [], evs = eventsOf(data, ds);
    var timed = [], untimed = [], evAllDay = [];
    real.forEach(function (t) { (t.time ? timed : untimed).push({ t: t, proj: false }); });
    proj.forEach(function (p) { (p.base.time ? timed : untimed).push({ t: p.base, proj: true }); });
    // Eventos de los calendarios suscritos: los de todo el día arriba; los demás, en su hora y con su duración
    evs.forEach(function (e) { if (e.allDay) evAllDay.push(e); else timed.push({ t: { time: e.time, duration: e.durMin || 45 }, ev: e }); });
    var mins = function (x) { var p = x.t.time.split(':'); return +p[0] * 60 + +p[1]; };
    var firstH = 7, lastH = 22;
    timed.forEach(function (x) { var m = mins(x); firstH = Math.min(firstH, Math.floor(m / 60)); lastH = Math.max(lastH, Math.min(23, Math.floor(m / 60) + 1)); });
    var nowM = new Date().getHours() * 60 + new Date().getMinutes();
    if (ds === U.today()) { firstH = Math.min(firstH, Math.floor(nowM / 60)); lastH = Math.max(lastH, Math.min(23, Math.floor(nowM / 60) + 1)); }
    var startMin = firstH * 60;

    // Sin hora
    var allday = U.el('div.allday', [U.el('span.allday-label', { text: untimed.length ? W.t('Sin hora') : evAllDay.length ? W.t('Todo el día') : W.t('Sin tareas sin hora · toca una hora para añadir') })]);
    evAllDay.forEach(function (e) { allday.appendChild(W.CalSubs.chip(e)); });
    untimed.forEach(function (x) {
      var chip = U.el('button.chip' + (x.t.done && !x.proj ? '.done' : ''), { attrs: { type: 'button' } }, [
        U.icon(x.proj ? 'repeat' : x.t.done ? 'check' : 'clock'), U.el('span', { text: x.t.text })]);
      chip.addEventListener('click', function () { W.Editor.open(x.t.id); });
      allday.appendChild(chip);
    });

    // Horas
    var hours = U.el('div.hours');
    var h12 = st.settings.timeFormat === '12';
    for (var h = firstH; h <= lastH; h++) hours.appendChild(U.el('div.hour.half', [U.el('span', { text: h12 ? ((h % 12) || 12) + (h < 12 ? ' a. m.' : ' p. m.') : h + ':00' })]));
    // Columnas para las que coinciden en el tiempo
    timed.sort(function (a, b) { return mins(a) - mins(b); });
    var clusters = [], cur = null;
    timed.forEach(function (x) {
      var m = mins(x);
      if (!cur || m >= cur.end) { cur = { items: [], end: m + blockMin(x.t) }; clusters.push(cur); }
      cur.items.push(x); cur.end = Math.max(cur.end, m + blockMin(x.t));
    });
    clusters.forEach(function (cl) {
      var cols = [];
      cl.items.forEach(function (x) {
        var m = mins(x), placed = false;
        for (var i = 0; i < cols.length; i++) if (cols[i] <= m) { cols[i] = m + blockMin(x.t); x.col = i; placed = true; break; }
        if (!placed) { x.col = cols.length; cols.push(m + blockMin(x.t)); }
      });
      cl.items.forEach(function (x) { x.cols = cols.length; });
    });
    timed.forEach(function (x) {
      var m = mins(x);
      if (x.ev) {
        hours.appendChild(eventBlock(x.ev, { top: ((m - startMin) / 60 * HOUR_H + 1) + 'px', height: Math.max(34, Math.min(x.ev.durMin || 45, (lastH + 1) * 60 - m) / 60 * HOUR_H - 2) + 'px',
          left: 'calc(' + (x.col / x.cols * 100) + '% + ' + (x.col ? 3 : 0) + 'px)', width: 'calc(' + (100 / x.cols) + '% - ' + (x.cols > 1 ? 3 : 0) + 'px)' }, false));
        return;
      }
      var blk = U.el('div.blk' + (x.proj ? '.proj' : '') + (x.t.done && !x.proj ? '.done' : '') + (x.t.highlight !== 'none' ? '.p-' + x.t.highlight : ''), {
        attrs: { role: 'button', tabindex: '0', 'aria-label': U.fmtTime(x.t.time) + ', ' + (x.proj ? W.t('{text} (se repite)', { text: x.t.text }) : x.t.text) },
        style: { top: ((m - startMin) / 60 * HOUR_H + 1) + 'px', height: Math.max(34, HOUR_H * 0.75 - 2) + 'px',
          left: 'calc(' + (x.col / x.cols * 100) + '% + ' + (x.col ? 3 : 0) + 'px)', width: 'calc(' + (100 / x.cols) + '% - ' + (x.cols > 1 ? 3 : 0) + 'px)' }
      }, [U.el('b', [W.Lists.dot(x.t.listId), x.t.text]), U.el('small', { text: U.fmtTime(x.t.time) + (x.proj ? ' · ' + W.t('se repite') : '') })]);
      if (x.proj || x.t.done) blk.addEventListener('click', function (e) { e.stopPropagation(); W.Editor.open(x.t.id); });
      else attachDrag(st, blk, x.t, startMin);
      hours.appendChild(blk);
    });
    if (ds === U.today() && nowM >= startMin && nowM <= (lastH + 1) * 60) hours.appendChild(U.el('div.now-line', { style: { top: ((nowM - startMin) / 60 * HOUR_H) + 'px' } }));

    // Tocar un hueco: nueva tarea a esa hora
    hours.addEventListener('click', function (e) {
      if (e.target.closest('.blk')) return;
      var r = hours.getBoundingClientRect(), y = e.clientY - r.top;
      var m = startMin + Math.max(0, Math.floor(y / HOUR_H * 2)) * 30;
      if (m > 23 * 60 + 30) m = 23 * 60 + 30;
      var hint = U.el('div.slot-hint', { text: U.fmtTime(U.pad(Math.floor(m / 60)) + ':' + U.pad(m % 60)), style: { top: ((m - startMin) / 60 * HOUR_H) + 'px' } });
      hours.appendChild(hint);
      setTimeout(function () { if (hint.parentNode) hint.parentNode.removeChild(hint); }, 900);
      W.QuickAdd.open({ date: ds, time: U.pad(Math.floor(m / 60)) + ':' + U.pad(m % 60) });
    });

    var head = U.el('div.day-head', [U.el('div', [U.el('strong', { text: dayName(ds) }),
      U.el('span', { text: (real.length || proj.length ? W.t('{n} · mantén pulsada una para cambiar su hora', { n: U.plural(real.length + proj.length, 'tarea', 'tareas') }) : W.t('Toca una hora para añadir una tarea'))
        + (evs.length ? ' · ' + evCount(evs.length) : '') })])]);
    return U.el('div.sec', [head, U.el('div.group', [allday, U.el('div.hours-pad'), hours, U.el('div.hours-pad')])]);
  }

  /** Mantener pulsado y arrastrar: cambia la hora en pasos de 15 minutos */
  function attachDrag(st, blk, t, startMin) {
    var timer = null, active = false, startY = 0, origTop = 0, curMin = null, dragged = false;
    var label = blk.querySelector('small');
    var begin = function (y) {
      startY = y; origTop = blk.offsetTop; dragged = false; curMin = null;
      clearTimeout(timer);
      timer = setTimeout(function () { active = true; blk.classList.add('lifted'); W.Audio.vibrate([10]); }, 300);
    };
    var move = function (y, e) {
      if (!active) { if (Math.abs(y - startY) > 8) clearTimeout(timer); return; }
      if (e.cancelable) e.preventDefault();
      var top = origTop + (y - startY);
      var m = Math.round((startMin + top / HOUR_H * 60) / 15) * 15;
      m = U.clamp(m, 0, 23 * 60 + 45);
      curMin = m; dragged = true;
      blk.style.top = ((m - startMin) / 60 * HOUR_H + 1) + 'px';
      label.textContent = U.fmtTime(U.pad(Math.floor(m / 60)) + ':' + U.pad(m % 60));
    };
    var end = function () {
      clearTimeout(timer);
      if (!active) return;
      active = false;
      blk.classList.remove('lifted');
      blk._justDragged = true;
      setTimeout(function () { blk._justDragged = false; }, 80);
      if (dragged && curMin != null) {
        var hhmm = U.pad(Math.floor(curMin / 60)) + ':' + U.pad(curMin % 60);
        if (hhmm !== t.time) { st.updateTask(t.id, { time: hhmm }); W.Toast.show({ text: W.t('Hora cambiada a las {time}', { time: U.fmtTime(hhmm) }), icon: 'clock' }); }
      }
    };
    blk.addEventListener('touchstart', function (e) { begin(e.touches[0].clientY); }, { passive: true });
    blk.addEventListener('touchmove', function (e) { move(e.touches[0].clientY, e); }, { passive: false });
    blk.addEventListener('touchend', end);
    blk.addEventListener('touchcancel', end);
    blk.addEventListener('mousedown', function (e) {
      if (e.button !== 0) return;
      begin(e.clientY);
      var mm = function (ev) { move(ev.clientY, ev); };
      var mu = function () { end(); window.removeEventListener('mousemove', mm); window.removeEventListener('mouseup', mu); };
      window.addEventListener('mousemove', mm);
      window.addEventListener('mouseup', mu);
    });
    blk.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    blk.addEventListener('click', function (e) { e.stopPropagation(); if (blk._justDragged) return; W.Editor.open(t.id); });
    blk.addEventListener('keydown', function (e) { if (e.key === 'Enter') W.Editor.open(t.id); });
  }

  /* ---------- Vista Agenda ---------- */
  function agendaView(st) {
    var td = U.today(), to = U.addDays(td, 30), out = [];
    var data = collect(st, td, to);
    var overdue = pool(st).filter(function (t) { return st.isOverdue(t) && t.date < td; }).sort(st.compareDeadline);
    if (overdue.length) out.push(W.UI.section({ title: W.t('Vencidas'), red: true, first: true, side: U.el('small', { text: overdue.length }),
      items: W.TaskCard.list(overdue, { ctx: 'alerts', postpone: true }) }));
    var days = 0;
    for (var d = td; d <= to; d = U.addDays(d, 1)) {
      var real = data.byDate[d] || [], proj = data.proj[d] || [], evs = eventsOf(data, d);
      if (!real.length && !proj.length && !evs.length) continue;
      days++;
      var what = [real.length + proj.length ? U.plural(real.length + proj.length, 'tarea', 'tareas') : '', evs.length ? evCount(evs.length) : ''].filter(Boolean).join(' · ');
      out.push(U.el('div.ag-day', [U.el('div.ag-head' + (d === td ? '.today' : ''), [
        U.el('strong', { text: dayName(d) }), U.el('span', { text: (d === td || d === U.addDays(td, 1) ? U.fmtLong(d) + ' · ' : '') + what })]),
        evs.length ? U.el('div.group.ev-group', [W.CalSubs.list(evs)]) : null,
        real.length || proj.length ? dayList(st, d, real, proj) : null]));
    }
    if (!days && !overdue.length) out.push(U.el('div.sec', [U.el('div.group', [W.UI.empty('agenda', W.t('Nada en los próximos 30 días'), W.t('Las tareas con fecha aparecerán aquí, día a día.'),
      U.el('button.btn.sm.soft', { on: { click: function () { W.QuickAdd.open({ date: td }); } } }, [U.icon('plus', 'sm'), W.t('Nueva tarea')]))])]));
    else out.push(U.el('p.hint', { text: W.t('Se muestran los próximos 30 días.') }));
    return out;
  }

  /* ======================================================================
     Ordenador: mes en cuadrícula grande con las tareas dentro de cada día,
     semana con 7 columnas por horas y una barra de herramientas arriba.
     ====================================================================== */
  var MG_MAX = 3;
  var DRAG = function () { return W.Sidebar.DRAG_TYPE; };

  function timeLabel(min) { return U.fmtTime(U.pad(Math.floor(min / 60)) + ':' + U.pad(min % 60)); }
  function minutesOf(t) { var p = t.time.split(':'); return +p[0] * 60 + +p[1]; }

  /** Cambia el día de una tarea soltada (mantiene la hora) */
  function moveToDay(st, id, ds) {
    var t = st.find(id);
    if (!t || t.date === ds) return;
    st.updateTask(id, { date: ds });
    W.Toast.show({ text: W.t('«{text}» pasa al {day}', { text: t.text, day: U.inline(U.fmtLong(ds)) }), icon: 'calendar' });
  }

  /** Tarea dentro de una casilla del mes */
  function mgChip(st, x) {
    var t = x.t, late = !x.proj && st.isOverdue(t);
    var chip = U.el('button.mg-chip' + (x.proj ? '.rep' : '') + (!x.proj && t.done ? '.done' : '') + (late ? '.late' : '') + (t.highlight !== 'none' && !t.done ? '.p-' + t.highlight : ''), {
      attrs: { type: 'button', title: (t.time ? U.fmtTime(t.time) + ' · ' : '') + (x.proj ? W.t('{text} (se repite)', { text: t.text }) : t.text) }
    }, [W.Lists.dot(t.listId), t.time ? U.el('b', { text: U.fmtTime(t.time) }) : null, U.el('span', { text: t.text })]);
    chip.addEventListener('click', function (e) { e.stopPropagation(); W.Editor.open(t.id); });
    chip.addEventListener('dblclick', function (e) { e.stopPropagation(); });
    if (!x.proj) {
      chip.addEventListener('contextmenu', function (e) { e.preventDefault(); e.stopPropagation(); W.TaskCard.actions.menu(t.id, { x: e.clientX, y: e.clientY }); });
      if (!t.done) {
        chip.draggable = true;
        chip.addEventListener('dragstart', function (e) {
          e.dataTransfer.setData(DRAG(), t.id); e.dataTransfer.setData('text/plain', t.text); e.dataTransfer.effectAllowed = 'move';
          chip.classList.add('drag-src');
        });
        chip.addEventListener('dragend', function () { chip.classList.remove('drag-src'); });
      }
    }
    return chip;
  }

  /**
   * Casilla del mes: los eventos de todo el día primero y los demás, por su hora, entre las tareas con hora
   * (el orden de las tareas no cambia; las sin hora y las hechas siguen al final)
   */
  function withEvents(items, evs) {
    if (!evs.length) return items;
    var out = evs.filter(function (e) { return e.allDay; }).map(function (e) { return { ev: e }; });
    var timed = evs.filter(function (e) { return !e.allDay; }), i = 0;
    items.forEach(function (x) {
      var tm = x.t.time && !(x.t.done && !x.proj) ? x.t.time : null;
      while (i < timed.length && (!tm || timed[i].time <= tm)) out.push({ ev: timed[i++] });
      out.push(x);
    });
    while (i < timed.length) out.push({ ev: timed[i++] });
    return out;
  }

  /** ¿Se muestra este día? (los fines de semana se pueden ocultar en el ordenador) */
  function shownDay(st, ds) { var wd = U.weekday(ds); return st.settings.desk.weekends !== false || (wd !== 0 && wd !== 6); }

  function deskMonth(st) {
    var cm = st.ui.calMonth, td = U.today(), ws = st.settings.weekStart, sel = st.ui.calSelected;
    var nCols = st.settings.desk.weekends !== false ? 7 : 5;
    var first = new Date(cm.y, cm.m, 1), lead = (first.getDay() - ws + 7) % 7;
    var start = U.addDays(U.ymd(first), -lead);
    var weeks = Math.ceil((lead + new Date(cm.y, cm.m + 1, 0).getDate()) / 7);
    var data = collect(st, start, U.addDays(start, weeks * 7 - 1));
    var grid = U.el('div.mgrid' + (slideDir > 0 ? '.slide-l' : slideDir < 0 ? '.slide-r' : ''), {
      attrs: { role: 'group', 'aria-label': U.fmtMonth(cm.y, cm.m) },
      style: { gridTemplateRows: 'auto repeat(' + weeks + ', minmax(108px, 1fr))', gridTemplateColumns: 'repeat(' + nCols + ', minmax(0, 1fr))' }
    });
    slideDir = 0;
    for (var i = 0; i < 7; i++) { var wd = (i + ws) % 7; if (nCols === 7 || (wd !== 0 && wd !== 6)) grid.appendChild(U.el('div.mg-wd', { text: U.WEEKDAYS_SHORT[wd] })); }
    for (var k = 0; k < weeks * 7; k++) {
      if (!shownDay(st, U.addDays(start, k))) continue;
      (function (ds) {
        var d = U.parse(ds), inMonth = d.getMonth() === cm.m;
        var real = sortDay(st, data.byDate[ds] || []), proj = data.proj[ds] || [], evs = eventsOf(data, ds);
        var items = withEvents(real.map(function (t) { return { t: t, proj: false }; }).concat(proj.map(function (p) { return { t: p.base, proj: true }; })), evs);
        var pend = real.filter(function (t) { return !t.done; }).length;
        var cell = U.el('div.mg-cell' + (inMonth ? '' : '.out') + (ds === td ? '.today' : '') + (ds === sel ? '.selected' : '') + (ds < td ? '.past' : ''), {
          attrs: { role: 'group', 'data-date': ds, 'aria-current': ds === td ? 'date' : null,
            'aria-label': U.fmtLong(ds) + (pend ? ', ' + U.plural(pend, 'pendiente', 'pendientes') : '') + (evs.length ? ', ' + evCount(evs.length) : '') + (ds === sel ? ', ' + W.t('elegido') : '') }
        });
        cell.appendChild(U.el('div.mg-top', [U.el('span.mg-num', { text: d.getDate() === 1 ? U.fmtDayMon(ds) : d.getDate() }),
          U.el('button.mg-add', { attrs: { type: 'button', 'aria-label': W.t('Nueva tarea el {day}', { day: U.inline(U.fmtLong(ds)) }), title: W.t('Nueva tarea este día') },
            on: { click: function (e) { e.stopPropagation(); W.QuickAdd.open({ date: ds }); } } }, [U.icon('plus', 'xs')])]));
        var list = U.el('div.mg-items');
        items.slice(0, MG_MAX).forEach(function (x) { list.appendChild(x.ev ? W.CalSubs.chip(x.ev, 'mg-chip') : mgChip(st, x)); });
        if (items.length > MG_MAX) list.appendChild(U.el('span.mg-more', { text: W.t('+{n} más', { n: items.length - MG_MAX }) }));
        cell.appendChild(list);
        cell.addEventListener('click', function () {
          if (ds === st.ui.calSelected) return;
          if (inMonth) st.ui.calSelected = ds; else { select(st, ds); slideDir = ds < U.ymd(first) ? -1 : 1; }
          W.Audio.select(); rerender();
        });
        cell.addEventListener('dblclick', function () { W.QuickAdd.open({ date: ds }); });
        W.Sidebar.dropTarget(cell, function (id) { moveToDay(st, id, ds); });
        grid.appendChild(cell);
      })(U.addDays(start, k));
    }
    var selData = sel >= start && sel <= U.addDays(start, weeks * 7 - 1) ? data : collect(st, sel, sel);
    return [U.el('div.cal-split', [U.el('div.group.mg-card', [grid]), U.el('aside.cal-side', [dayPanel(st, sel, selData)])])];
  }

  /** Columnas para las tareas que coinciden en el tiempo (dentro de un mismo día) */
  function placeColumns(timed) {
    timed.sort(function (a, b) { return minutesOf(a.t) - minutesOf(b.t); });
    var clusters = [], cur = null;
    timed.forEach(function (x) {
      var m = minutesOf(x.t);
      if (!cur || m >= cur.end) { cur = { items: [], end: m + 45 }; clusters.push(cur); }
      cur.items.push(x); cur.end = Math.max(cur.end, m + 45);
    });
    clusters.forEach(function (cl) {
      var cols = [];
      cl.items.forEach(function (x) {
        var m = minutesOf(x.t), placed = false;
        for (var i = 0; i < cols.length; i++) if (cols[i] <= m) { cols[i] = m + 45; x.col = i; placed = true; break; }
        if (!placed) { x.col = cols.length; cols.push(m + 45); }
      });
      cl.items.forEach(function (x) { x.cols = cols.length; });
    });
    return timed;
  }

  /** Semana (7 columnas por horas) o, con dayMode, un solo día a lo ancho */
  function deskWeek(st, dayMode) {
    var sel = st.ui.calSelected, start = dayMode ? sel : weekStart(st, sel), td = U.today(), dk = st.settings.desk;
    var days = dayMode ? [sel] : [0, 1, 2, 3, 4, 5, 6].map(function (i) { return U.addDays(start, i); }).filter(function (ds) { return shownDay(st, ds); });
    var data = collect(st, start, dayMode ? sel : U.addDays(start, 6));
    var perDay = {};
    // Horas visibles: las elegidas (Ajustes → Personalización), ampliadas si hay tareas fuera de ellas
    var firstH = U.clamp(dk.calStartH, 0, 22), lastH = U.clamp(Math.max(dk.calEndH, firstH + 1), 1, 23), nowM = new Date().getHours() * 60 + new Date().getMinutes();
    days.forEach(function (ds) {
      var real = sortDay(st, data.byDate[ds] || []), proj = data.proj[ds] || [];
      var timed = [], untimed = [], evDay = [];
      real.forEach(function (t) { (t.time ? timed : untimed).push({ t: t, proj: false }); });
      proj.forEach(function (p) { (p.base.time ? timed : untimed).push({ t: p.base, proj: true }); });
      eventsOf(data, ds).forEach(function (e) { if (e.allDay) evDay.push(e); else timed.push({ t: { time: e.time, duration: e.durMin }, ev: e }); });
      timed.forEach(function (x) { var h = Math.floor(minutesOf(x.t) / 60); firstH = Math.min(firstH, h); lastH = Math.max(lastH, Math.min(23, h + 1)); });
      perDay[ds] = { timed: placeColumns(timed), untimed: untimed, evDay: evDay };
    });
    if (days.indexOf(td) >= 0) { firstH = Math.min(firstH, Math.floor(nowM / 60)); lastH = Math.max(lastH, Math.min(23, Math.floor(nowM / 60) + 1)); }
    var startMin = firstH * 60, hoursN = lastH - firstH + 1;

    var head = U.el('div.wg-head', [U.el('div.wg-corner')].concat(days.map(function (ds) {
      var d = U.parse(ds), n = (data.byDate[ds] || []).filter(function (t) { return !t.done; }).length + (data.proj[ds] || []).length, ne = eventsOf(data, ds).length;
      var b = U.el('button.wg-day' + (ds === td ? '.today' : '') + (ds === sel ? '.selected' : '') + (ds < td ? '.past' : ''), {
        attrs: { type: 'button', 'aria-label': U.fmtLong(ds) + (n ? ', ' + U.plural(n, 'tarea', 'tareas') : '') + (ne ? ', ' + evCount(ne) : ''), 'aria-pressed': ds === sel ? 'true' : 'false' }
      }, [U.el('small', { text: U.WEEKDAYS_SHORT[d.getDay()] }), U.el('b', { text: d.getDate() })]);
      b.addEventListener('click', function () { st.ui.calSelected = ds; W.Audio.select(); rerender(); });
      W.Sidebar.dropTarget(b, function (id) { moveToDay(st, id, ds); });
      return b;
    })));

    var allday = U.el('div.wg-allday', [U.el('div.wg-label', { text: W.t('Sin hora') })].concat(days.map(function (ds) {
      var cell = U.el('div.wg-adcell', { attrs: { 'data-date': ds } });
      perDay[ds].evDay.forEach(function (e) { cell.appendChild(W.CalSubs.chip(e, 'mg-chip')); });
      perDay[ds].untimed.forEach(function (x) { cell.appendChild(mgChip(st, x)); });
      W.Sidebar.dropTarget(cell, function (id) { var t = st.find(id); if (t) { st.updateTask(id, { date: ds, time: null }); W.Toast.show({ text: W.t('«{text}» pasa al {day}, sin hora', { text: t.text, day: U.inline(U.fmtLong(ds)) }), icon: 'calendar' }); } });
      return cell;
    })));

    var hoursCol = U.el('div.wg-hours');
    for (var h = firstH; h <= lastH; h++) hoursCol.appendChild(U.el('span', { text: U.fmtHour(h) }));
    var cols = days.map(function (ds) {
      var col = U.el('div.wg-col' + (ds === td ? '.today' : '') + (ds < td ? '.past' : ''), { attrs: { 'data-date': ds } });
      perDay[ds].timed.forEach(function (x) {
        var m = minutesOf(x.t), t = x.t;
        if (x.ev) {
          col.appendChild(eventBlock(x.ev, { top: ((m - startMin) / 60 * HOUR_H + 1) + 'px', height: Math.max(26, Math.min(x.ev.durMin || 45, (lastH + 1) * 60 - m) / 60 * HOUR_H - 2) + 'px',
            left: 'calc(' + (x.col / x.cols * 100) + '% + ' + (x.col ? 2 : 3) + 'px)', width: 'calc(' + (100 / x.cols) + '% - ' + (x.cols > 1 ? 4 : 6) + 'px)', right: 'auto' }, true));
          return;
        }
        var blk = U.el('div.blk.wg-blk' + (x.proj ? '.proj' : '') + (t.done && !x.proj ? '.done' : '') + (t.highlight !== 'none' ? '.p-' + t.highlight : ''), {
          attrs: { role: 'button', tabindex: '0', title: U.fmtTime(t.time) + ' · ' + t.text, 'aria-label': U.fmtTime(t.time) + ', ' + (x.proj ? W.t('{text} (se repite)', { text: t.text }) : t.text) },
          style: { top: ((m - startMin) / 60 * HOUR_H + 1) + 'px', height: Math.max(26, blockMin(t) / 60 * HOUR_H - 2) + 'px',
            left: 'calc(' + (x.col / x.cols * 100) + '% + ' + (x.col ? 2 : 3) + 'px)', width: 'calc(' + (100 / x.cols) + '% - ' + (x.cols > 1 ? 4 : 6) + 'px)', right: 'auto' }
        }, [U.el('b', { text: t.text }), U.el('small', { text: U.fmtTime(t.time) + (t.duration ? ' – ' + endLabel(t) : '') + (x.proj ? ' · ' + W.t('se repite') : '') })]);
        if (x.proj || t.done) blk.addEventListener('click', function (e) { e.stopPropagation(); W.Editor.open(t.id); });
        else {
          gridDrag(st, blk, t, { startMin: startMin, days: days, cols: function () { return U.$$('.wg-col', blk.closest('.wg-body')); } });
          resizeDrag(st, blk, t);
        }
        if (!x.proj) blk.addEventListener('contextmenu', function (e) { e.preventDefault(); e.stopPropagation(); W.TaskCard.actions.menu(t.id, { x: e.clientX, y: e.clientY }); });
        blk.addEventListener('keydown', function (e) { if (e.key === 'Enter') W.Editor.open(t.id); });
        col.appendChild(blk);
      });
      if (ds === td && nowM >= startMin && nowM <= (lastH + 1) * 60) col.appendChild(U.el('div.now-line', { style: { top: ((nowM - startMin) / 60 * HOUR_H) + 'px' } }));
      // Tocar un hueco: nueva tarea ese día a esa hora
      col.addEventListener('click', function (e) {
        if (e.target.closest('.blk')) return;
        var r = col.getBoundingClientRect(), m = startMin + Math.max(0, Math.floor((e.clientY - r.top) / HOUR_H * 2)) * 30;
        m = Math.min(m, 23 * 60 + 30);
        var hint = U.el('div.slot-hint', { text: timeLabel(m), style: { top: ((m - startMin) / 60 * HOUR_H) + 'px' } });
        col.appendChild(hint);
        setTimeout(function () { if (hint.parentNode) hint.parentNode.removeChild(hint); }, 900);
        W.QuickAdd.open({ date: ds, time: U.pad(Math.floor(m / 60)) + ':' + U.pad(m % 60) });
      });
      // Soltar una tarea de una lista o de otro día: ese día, a la hora del punto donde se suelta
      W.Sidebar.dropTarget(col, function (id, e) {
        var t = st.find(id); if (!t) return;
        var r = col.getBoundingClientRect(), y = e ? e.clientY : r.top;
        var m = Math.round((startMin + (y - r.top) / HOUR_H * 60) / 15) * 15;
        m = U.clamp(m, 0, 23 * 60 + 45);
        var hhmm = U.pad(Math.floor(m / 60)) + ':' + U.pad(m % 60);
        st.updateTask(id, { date: ds, time: hhmm });
        W.Toast.show({ text: W.t('«{text}» pasa al {day}, {time}', { text: t.text, day: U.inline(U.fmtLong(ds)), time: U.fmtTime(hhmm) }), icon: 'clock' });
      });
      return col;
    });
    var body = U.el('div.wg-body', { style: { height: (hoursN * HOUR_H) + 'px', '--hour-h': HOUR_H + 'px' } }, [hoursCol].concat(cols));
    if (days.length !== 7) [head, allday, body].forEach(function (n) { n.style.gridTemplateColumns = '64px repeat(' + days.length + ', minmax(0, 1fr))'; });
    return [U.el('div.group.wg', [head, allday, body])];
  }

  /** Estirar un bloque por abajo: cambia la duración (de 15 en 15 minutos) */
  function resizeDrag(st, blk, t) {
    var h = U.el('span.wg-resize', { attrs: { title: W.t('Arrastra para cambiar la duración'), 'aria-hidden': 'true' } });
    blk.appendChild(h);
    h.addEventListener('mousedown', function (e) {
      if (e.button !== 0) return;
      e.preventDefault(); e.stopPropagation();
      var top = blk.getBoundingClientRect().top, label = blk.querySelector('small'), dur = blockMin(t);
      document.body.classList.add('resizing'); blk.classList.add('lifted');
      var move = function (ev) {
        dur = U.clamp(Math.round((ev.clientY - top) / HOUR_H * 60 / 15) * 15, 15, 720);
        blk.style.height = Math.max(26, dur / 60 * HOUR_H - 2) + 'px';
        var e2 = (minutesOf(t) + dur) % 1440;
        label.textContent = U.fmtTime(t.time) + ' – ' + U.fmtTime(U.pad(Math.floor(e2 / 60)) + ':' + U.pad(e2 % 60)) + ' · ' + W.Editor.durLabel(dur);
      };
      var up = function () {
        window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up);
        document.body.classList.remove('resizing'); blk.classList.remove('lifted');
        if (dur !== t.duration) { st.updateTask(t.id, { duration: dur }); W.Toast.show({ text: W.t('«{text}» dura {time}', { text: t.text, time: W.Editor.durLabel(dur) }), icon: 'timer' }); }
        else rerender();
      };
      window.addEventListener('mousemove', move);
      window.addEventListener('mouseup', up);
    });
    h.addEventListener('click', function (e) { e.stopPropagation(); });
  }

  /** Arrastrar un bloque de la semana con el ratón: cambia de hora (15 min) y de día */
  function gridDrag(st, blk, t, ctx) {
    var label = blk.querySelector('small');
    var startX = 0, startY = 0, active = false, moved = false, target = null, curMin = null, offY = 0;
    blk.addEventListener('mousedown', function (e) {
      if (e.button !== 0 || e.target.closest('.wg-resize')) return;
      e.preventDefault();
      startX = e.clientX; startY = e.clientY; active = true; moved = false; target = null; curMin = null;
      offY = e.clientY - blk.getBoundingClientRect().top;
      var move = function (ev) {
        if (!active) return;
        if (!moved && Math.abs(ev.clientX - startX) + Math.abs(ev.clientY - startY) < 5) return;
        if (!moved) { moved = true; blk.classList.add('lifted'); document.body.classList.add('grabbing'); }
        var cols = ctx.cols(), col = null;
        for (var i = 0; i < cols.length; i++) { var r = cols[i].getBoundingClientRect(); if (ev.clientX >= r.left && ev.clientX < r.right) { col = cols[i]; break; } }
        if (!col) col = blk.parentNode;
        var rc = col.getBoundingClientRect();
        var m = Math.round((ctx.startMin + (ev.clientY - offY - rc.top) / HOUR_H * 60) / 15) * 15;
        m = U.clamp(m, 0, 23 * 60 + 45);
        if (col !== blk.parentNode) { col.appendChild(blk); blk.style.left = '3px'; blk.style.width = 'calc(100% - 6px)'; }
        blk.style.top = ((m - ctx.startMin) / 60 * HOUR_H + 1) + 'px';
        label.textContent = timeLabel(m);
        target = col.getAttribute('data-date'); curMin = m;
      };
      var up = function () {
        window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up);
        document.body.classList.remove('grabbing');
        if (!active) return;
        active = false;
        blk.classList.remove('lifted');
        if (!moved) { W.Editor.open(t.id); return; }
        var hhmm = U.pad(Math.floor(curMin / 60)) + ':' + U.pad(curMin % 60);
        if (target && (target !== t.date || hhmm !== t.time)) {
          st.updateTask(t.id, { date: target, time: hhmm });
          W.Toast.show({ text: (target !== t.date ? U.fmtLong(target) + ', ' : 'Hora cambiada a las ') + U.fmtTime(hhmm), icon: 'clock' });
        } else rerender();
      };
      window.addEventListener('mousemove', move);
      window.addEventListener('mouseup', up);
    });
    blk.addEventListener('click', function (e) { e.stopPropagation(); });
  }

  /** Barra de herramientas del calendario en el ordenador */
  function deskToolbar(st, v, listChip, doneChip) {
    var td = U.today(), week = v.calView === 'week', agenda = v.calView === 'agenda', day = v.calView === 'day';
    var title;
    if (agenda) title = W.t('Próximos 30 días');
    else if (day) title = U.fmtLongYear(v.calSelected);
    else if (week) title = U.fmtRange(weekStart(st, v.calSelected), U.addDays(weekStart(st, v.calSelected), 6), true);
    else title = U.fmtMonth(v.calMonth.y, v.calMonth.m);
    var shift = function (d) { if (day) { select(st, U.addDays(v.calSelected, d)); rerender(); } else if (week) shiftWeek(st, d); else shiftMonth(st, d); };
    var left = U.el('div.ct-left', agenda ? [U.el('h2.ct-title', { text: title })] : [
      U.el('div.ct-arrows', [
        W.UI.navBtn({ icon: 'left', label: day ? W.t('Día anterior (←)') : week ? W.t('Semana anterior (←)') : W.t('Mes anterior (←)'), onTap: function () { shift(-1); } }),
        W.UI.navBtn({ icon: 'right', label: day ? W.t('Día siguiente (→)') : week ? W.t('Semana siguiente (→)') : W.t('Mes siguiente (→)'), onTap: function () { shift(1); } })
      ]),
      U.el('button.btn.ghost.sm.ct-today', { attrs: { type: 'button', title: W.t('Ir a hoy (T)') }, on: { click: function () { select(st, td); rerender(); } } }, [W.t('Hoy')]),
      week || day ? U.el('h2.ct-title', { text: U.cap(title) }) : (function () {
        var b = U.el('button.ct-title', { attrs: { type: 'button', 'aria-label': W.t('{month}, elegir mes', { month: title }) } }, [title, U.icon('down')]);
        b.addEventListener('click', function () { pickMonth(st, b); });
        return b;
      })()
    ]);
    var seg = W.UI.segmented(DESK_VIEWS, v.calView, function (val) { v.calView = val; rerender(); }, { mini: true });
    var exp = U.el('button.btn.ghost.sm.ct-export', { attrs: { type: 'button', title: W.t('Exportar las tareas con fecha a otro calendario (.ics)') }, on: { click: function () { exportIcs(st); } } }, [U.icon('download', 'sm'), W.t('Exportar')]);
    return U.el('div.cal-toolbar', [left, U.el('div.ct-right', [listChip, doneChip, calsButton(true), exp, seg])]);
  }

  /** Calendarios suscritos (Ajustes → Calendarios suscritos): botón en el ordenador, ficha en el móvil */
  function calsButton(desk) {
    var n = W.Calendars ? W.Calendars.list().filter(function (c) { return c.on; }).length : 0;
    var open = function () { W.Settings.open('calendars'); };
    var tip = W.t('Ver aquí los eventos de tus otros calendarios (Google, Outlook, Apple…)');
    if (desk) return U.el('button.btn.ghost.sm.ct-cals', { attrs: { type: 'button', title: tip }, on: { click: open } }, [U.icon('calendar', 'sm'), n ? W.t('Calendarios ({n})', { n: n }) : W.t('Calendarios')]);
    return U.el('button.chip' + (n ? '.on' : ''), { attrs: { type: 'button', title: tip }, on: { click: open } }, [U.icon('calendar'), U.el('span', { text: n ? W.t('Calendarios ({n})', { n: n }) : W.t('Calendarios') })]);
  }

  /** Teclas del calendario (en el ordenador): ← → anterior y siguiente, T hoy, M S D A vistas (en inglés, W para la semana) */
  function calendarKey(e) {
    var st = S(), v = ui(st), k = e.key;
    if (k === 'ArrowLeft' || k === 'ArrowRight') {
      if (v.calView === 'agenda') return false;
      var d = k === 'ArrowLeft' ? -1 : 1;
      if (v.calView === 'day') { select(st, U.addDays(v.calSelected, d)); rerender(); }
      else if (v.calView === 'week') shiftWeek(st, d); else shiftMonth(st, d);
      return true;
    }
    if (k === 't' || k === 'T') { select(st, U.today()); rerender(); return true; }
    var view = { m: 'month', M: 'month', s: 'week', S: 'week', w: 'week', W: 'week', d: 'day', D: 'day', a: 'agenda', A: 'agenda' }[k];
    if (view) { if (v.calView !== view) { v.calView = view; rerender(); } return true; }
    return false;
  }

  /* ---------- Pantalla ---------- */
  W.Screens.calendar = {
    title: W.t('Calendario'),
    key: function (e) { return W.Layout.desktop && calendarKey(e); },
    render: function (root) {
      rootEl = root;
      var st = S(), v = ui(st), td = U.today();
      var cm = v.calMonth;
      var all = pool(st).filter(function (t) { return t.date && t.date.slice(0, 7) === cm.y + '-' + U.pad(cm.m + 1); });
      var nDone = all.filter(function (t) { return t.done; }).length, wk = weekNumber(weekStart(st, v.calSelected));
      var sub = v.calView === 'agenda' ? W.t('Próximos 30 días') : v.calView === 'week' ? W.t('Semana {n} · {month}', { n: wk, month: U.fmtMonth(cm.y, cm.m) })
        : U.fmtMonth(cm.y, cm.m) + (all.length ? ' · ' + W.t('{done} de {total} completadas', { done: nDone, total: all.length }) : '');
      var isToday = v.calSelected === td, desk = W.Layout.desktop;
      if (!desk && v.calView === 'day') v.calView = 'week';
      if (desk) sub = v.calView === 'agenda' ? W.t('Lo vencido y los próximos 30 días') : v.calView === 'day' ? W.t('Día · semana {n}', { n: wk }) : v.calView === 'week' ? W.t('Semana {n}', { n: wk })
        : all.length ? W.t('{done} de {total} completadas este mes', { done: nDone, total: all.length }) : W.t('Sin tareas este mes');
      var head = W.UI.header({ title: W.t('Calendario'), profile: true, sub: sub,
        actions: isToday || v.calView === 'agenda' || desk ? [] : [{ text: W.t('Hoy'), label: W.t('Ir a hoy'), onTap: function () { select(st, td); rerender(); } }] });
      var list = v.calList ? st.getList(v.calList) : null;
      var listChip = U.el('button.chip' + (list ? '.on' : ''), { attrs: { type: 'button' } }, [
        U.icon(list ? W.Lists.icon(list) : 'filter'), U.el('span', { text: list ? list.name : W.t('Todas las categorías') }), U.icon('down')]);
      listChip.addEventListener('click', function () {
        W.Menu.open(listChip, [{ value: '', label: W.t('Todas las categorías'), icon: 'layers', on: !list }].concat(st.lists.map(function (l) {
          return { value: l.id, label: l.name, icon: W.Lists.icon(l), on: list && list.id === l.id };
        }))).then(function (val) { if (val !== undefined) { v.calList = val || null; rerender(); } });
      });
      var doneChip = U.el('button.chip' + (v.calShowDone ? '.on' : ''), { attrs: { type: 'button', 'aria-pressed': v.calShowDone ? 'true' : 'false' } }, [U.icon('check'), U.el('span', { text: W.t('Completadas') })]);
      doneChip.addEventListener('click', function () { v.calShowDone = !v.calShowDone; W.Audio.select(); rerender(); });
      if (desk) {
        var deskBody = v.calView === 'week' ? deskWeek(st) : v.calView === 'day' ? deskWeek(st, true) : v.calView === 'agenda' ? [U.el('div.cal-agenda', agendaView(st))] : deskMonth(st);
        W.UI.mount(root, head, [deskToolbar(st, v, listChip, doneChip)].concat(deskBody));
        return;
      }
      var seg = W.UI.segmented(VIEWS, v.calView, function (val) { v.calView = val; rerender(); });
      seg.style.marginTop = '12px';
      var tools = U.el('div.chips.cal-tools', [listChip, doneChip, calsButton(false)]);
      var body = v.calView === 'week' ? weekView(st) : v.calView === 'agenda' ? agendaView(st) : monthView(st);
      var first = body[0];
      if (first && first.classList && first.classList.contains('group')) first.style.marginTop = '14px';
      W.UI.mount(root, head, [seg, tools].concat(body));
    }
  };

  /** Número de semana ISO */
  function weekNumber(ds) {
    var d = U.parse(ds); d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + 3 - (d.getDay() + 6) % 7);
    var w1 = new Date(d.getFullYear(), 0, 4);
    return 1 + Math.round(((d - w1) / 86400000 - 3 + (w1.getDay() + 6) % 7) / 7);
  }
})(window.Whider);
