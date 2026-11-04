/**
 * WHIDER · Calendario con tres vistas:
 *  - Mes: cuadrícula con puntos del color de cada lista (rojo si hay algo vencido y en hueco
 *    las repeticiones futuras) y el día elegido con su lista por horas y un campo para añadir.
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
  var VIEWS = [{ value: 'month', label: 'Mes' }, { value: 'week', label: 'Semana' }, { value: 'agenda', label: 'Agenda' }];

  /* ---------- Estado de la vista ---------- */
  function ui(st) {
    if (!st.ui.calView) st.ui.calView = 'month';
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
  function listColor(st, t) { var l = t.listId ? st.getList(t.listId) : null; return l ? st.ACCENTS[l.color].a : null; }
  function hexRgb(hex) { var h = (hex || '#7C83FF').replace('#', ''); return [0, 2, 4].map(function (i) { return parseInt(h.substr(i, 2), 16); }).join(', '); }
  function dayName(ds) {
    var td = U.today();
    if (ds === td) return 'Hoy';
    if (ds === U.addDays(td, 1)) return 'Mañana';
    if (ds === U.addDays(td, -1)) return 'Ayer';
    return U.fmtLong(ds);
  }

  /* ---------- Datos: tareas reales y repeticiones previstas ---------- */
  function pool(st) {
    var f = st.ui.calList;
    return st.tasks.filter(function (t) { return (!f || t.listId === f) && (st.ui.calShowDone || !t.done); });
  }
  /** { fecha: [tareas] } y { fecha: [{ base, date }] } para un intervalo */
  function collect(st, from, to) {
    var byDate = {}, proj = {}, n = 0;
    pool(st).forEach(function (t) {
      if (t.date && t.date >= from && t.date <= to) (byDate[t.date] = byDate[t.date] || []).push(t);
      if (!t.done && t.repeat !== 'none' && n < 400) {
        st.occurrences(t, from, to, 62).forEach(function (d) { (proj[d] = proj[d] || []).push({ base: t, date: d }); n++; });
      }
    });
    return { byDate: byDate, proj: proj };
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
    if (l) { meta.appendChild(U.el('span.sep', { text: '·' })); meta.appendChild(U.el('span.m-list', [U.el('i', { style: { background: st.ACCENTS[l.color].a } }), l.name])); }
    var body = U.el('div.task-body', [U.el('span.tl-time' + (t.time ? '' : '.none'), { text: t.time ? U.fmtTime(t.time) : '—' }), check,
      U.el('div.task-main', [U.el('span.task-title', { text: t.text }), meta])]);
    body.addEventListener('click', function () { W.Editor.open(t.id); });
    return U.el('li.task.projected', { attrs: { 'aria-label': t.text + ' (se repite)' } }, [body]);
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
    var input = U.el('input', { attrs: { type: 'text', maxlength: 200, placeholder: 'Añadir a ' + (ds === U.today() ? 'hoy' : dayName(ds).toLowerCase()) + '…', enterkeyhint: 'done', 'aria-label': 'Añadir tarea a este día' } });
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
    return U.el('label.quick-day', [U.icon('plus'), input, U.el('button.btn.soft.sm', { text: 'Añadir', on: { click: add } })]);
  }

  function dayPanel(st, ds, data) {
    var real = data.byDate[ds] || [], proj = data.proj[ds] || [];
    var done = real.filter(function (t) { return t.done; }).length;
    var info = real.length ? done + ' de ' + U.plural(real.length, 'tarea completada', 'tareas completadas') : proj.length ? U.plural(proj.length, 'tarea que se repite', 'tareas que se repiten') : 'Sin tareas';
    var head = U.el('div.day-head', [
      U.el('div', [U.el('strong', { text: dayName(ds) }), U.el('span', { text: (ds === U.today() || Math.abs(U.diffDays(U.today(), ds)) === 1 ? U.fmtLong(ds) + ' · ' : '') + info })]),
      real.length ? U.el('div.day-progress', [U.el('div.bar', [U.el('i', { style: { width: Math.round(done / real.length * 100) + '%' } })])]) : null
    ]);
    var body = real.length || proj.length ? dayList(st, ds, real, proj)
      : U.el('div.group', [W.UI.empty('calendar', 'Día libre', ds < U.today() ? 'No hubo tareas este día.' : 'Escribe arriba para añadir algo a este día.', null, true)]);
    return U.el('div.sec', [head, ds >= U.today() ? quickDay(st, ds) : null, body]);
  }

  /* ---------- Vista Mes ---------- */
  function monthView(st) {
    var cm = st.ui.calMonth, td = U.today();
    var from = U.ymd(new Date(cm.y, cm.m, 1)), to = U.ymd(new Date(cm.y, cm.m + 1, 0));
    var data = collect(st, from, to);
    var grid = W.UI.monthGrid({
      y: cm.y, m: cm.m, selected: st.ui.calSelected, slide: slideDir,
      mark: function (ds) {
        var real = data.byDate[ds] || [], proj = data.proj[ds] || [], dots = [], seen = {};
        var pend = real.filter(function (t) { return !t.done; });
        pend.forEach(function (t) {
          var late = st.isOverdue(t), c = late ? 'late' : listColor(st, t) || 'var(--accent)';
          if (seen[c]) return; seen[c] = 1;
          dots.push(late ? { kind: 'late' } : { c: c });
        });
        proj.forEach(function (p) { var c = 'rep' + (listColor(st, p.base) || ''); if (seen[c]) return; seen[c] = 1; dots.push({ kind: 'rep', c: listColor(st, p.base) || 'var(--accent)' }); });
        if (!pend.length && !proj.length && real.length && ds <= td) dots.push({ kind: 'done' });
        if (!dots.length) return null;
        return { dots: dots, label: pend.length ? U.plural(pend.length, 'pendiente', 'pendientes') : proj.length ? 'se repite' : 'completado' };
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
    var title = U.el('button.cal-title', { attrs: { 'aria-label': 'Elegir mes' } }, [U.fmtMonth(cm.y, cm.m), U.icon('down')]);
    title.addEventListener('click', function () { pickMonth(st, title); });
    var card = U.el('div.group.cal', [
      U.el('div.cal-head', [title, U.el('div.cal-arrows', [
        W.UI.navBtn({ icon: 'left', label: 'Mes anterior', onTap: function () { shiftMonth(st, -1); } }),
        W.UI.navBtn({ icon: 'right', label: 'Mes siguiente', onTap: function () { shiftMonth(st, 1); } })
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
    opts.push({ value: (y + 1) + ':0', label: 'Enero ' + (y + 1), gap: true });
    opts.push({ value: 'today', label: 'Ir a hoy', icon: 'today' });
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
        var total = real.length + (data.proj[ds] || []).length;
        var b = U.el('button.wk-day' + (ds === sel ? '.selected' : '') + (ds === td ? '.today' : '') + (ds < td ? '.past' : ''), {
          attrs: { 'aria-label': U.fmtLong(ds) + (total ? ', ' + U.plural(total, 'tarea', 'tareas') : ''), 'aria-pressed': ds === sel ? 'true' : 'false' }
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
    var a = U.parse(start), z = U.parse(end);
    var range = a.getMonth() === z.getMonth() ? a.getDate() + ' – ' + z.getDate() + ' ' + U.MONTHS[z.getMonth()] : a.getDate() + ' ' + U.MONTHS[a.getMonth()].slice(0, 3) + ' – ' + z.getDate() + ' ' + U.MONTHS[z.getMonth()].slice(0, 3);
    var card = U.el('div.group.week', [
      U.el('div.cal-head', [U.el('span.cal-title', { text: U.cap(range) }), U.el('div.cal-arrows', [
        W.UI.navBtn({ icon: 'left', label: 'Semana anterior', onTap: function () { shiftWeek(st, -1); } }),
        W.UI.navBtn({ icon: 'right', label: 'Semana siguiente', onTap: function () { shiftWeek(st, 1); } })
      ])]),
      strip
    ]);
    return [card, dayTimeline(st, sel, data)];
  }
  function shiftWeek(st, delta) { select(st, U.addDays(st.ui.calSelected, 7 * delta)); W.Audio.select(); rerender(); }

  /** El día por horas: sin hora arriba, el resto colocado en su hora */
  function dayTimeline(st, ds, data) {
    var real = sortDay(st, data.byDate[ds] || []), proj = data.proj[ds] || [];
    var timed = [], untimed = [];
    real.forEach(function (t) { (t.time ? timed : untimed).push({ t: t, proj: false }); });
    proj.forEach(function (p) { (p.base.time ? timed : untimed).push({ t: p.base, proj: true }); });
    var mins = function (x) { var p = x.t.time.split(':'); return +p[0] * 60 + +p[1]; };
    var firstH = 7, lastH = 22;
    timed.forEach(function (x) { var m = mins(x); firstH = Math.min(firstH, Math.floor(m / 60)); lastH = Math.max(lastH, Math.min(23, Math.floor(m / 60) + 1)); });
    var nowM = new Date().getHours() * 60 + new Date().getMinutes();
    if (ds === U.today()) { firstH = Math.min(firstH, Math.floor(nowM / 60)); lastH = Math.max(lastH, Math.min(23, Math.floor(nowM / 60) + 1)); }
    var startMin = firstH * 60;

    // Sin hora
    var allday = U.el('div.allday', [U.el('span.allday-label', { text: untimed.length ? 'Sin hora' : 'Sin tareas sin hora · toca una hora para añadir' })]);
    untimed.forEach(function (x) {
      var c = listColor(st, x.t);
      var chip = U.el('button.chip' + (x.t.done && !x.proj ? '.done' : ''), { attrs: { type: 'button' } }, [
        x.proj ? U.icon('repeat') : U.el('span.dot', { style: { '--c': c || 'var(--accent)' } }), U.el('span', { text: x.t.text })]);
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
      if (!cur || m >= cur.end) { cur = { items: [], end: m + 45 }; clusters.push(cur); }
      cur.items.push(x); cur.end = Math.max(cur.end, m + 45);
    });
    clusters.forEach(function (cl) {
      var cols = [];
      cl.items.forEach(function (x) {
        var m = mins(x), placed = false;
        for (var i = 0; i < cols.length; i++) if (cols[i] <= m) { cols[i] = m + 45; x.col = i; placed = true; break; }
        if (!placed) { x.col = cols.length; cols.push(m + 45); }
      });
      cl.items.forEach(function (x) { x.cols = cols.length; });
    });
    timed.forEach(function (x) {
      var m = mins(x), c = listColor(st, x.t);
      var blk = U.el('div.blk' + (x.proj ? '.proj' : '') + (x.t.done && !x.proj ? '.done' : ''), {
        attrs: { role: 'button', tabindex: '0', 'aria-label': U.fmtTime(x.t.time) + ', ' + x.t.text + (x.proj ? ' (se repite)' : '') },
        style: { top: ((m - startMin) / 60 * HOUR_H + 1) + 'px', height: Math.max(34, HOUR_H * 0.75 - 2) + 'px',
          left: 'calc(' + (x.col / x.cols * 100) + '% + ' + (x.col ? 3 : 0) + 'px)', width: 'calc(' + (100 / x.cols) + '% - ' + (x.cols > 1 ? 3 : 0) + 'px)', '--bc-rgb': hexRgb(c) }
      }, [U.el('b', { text: x.t.text }), U.el('small', { text: U.fmtTime(x.t.time) + (x.proj ? ' · se repite' : '') })]);
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
      U.el('span', { text: real.length || proj.length ? U.plural(real.length + proj.length, 'tarea', 'tareas') + ' · mantén pulsada una para cambiar su hora' : 'Toca una hora para añadir una tarea' })])]);
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
        if (hhmm !== t.time) { st.updateTask(t.id, { time: hhmm }); W.Toast.show({ text: 'Hora cambiada a las ' + U.fmtTime(hhmm), icon: 'clock' }); }
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
    if (overdue.length) out.push(W.UI.section({ title: 'Vencidas', red: true, first: true, side: U.el('small', { text: overdue.length }),
      items: W.TaskCard.list(overdue, { ctx: 'alerts', postpone: true }) }));
    var days = 0;
    for (var d = td; d <= to; d = U.addDays(d, 1)) {
      var real = data.byDate[d] || [], proj = data.proj[d] || [];
      if (!real.length && !proj.length) continue;
      days++;
      out.push(U.el('div.ag-day', [U.el('div.ag-head' + (d === td ? '.today' : ''), [
        U.el('strong', { text: dayName(d) }), U.el('span', { text: (d === td || d === U.addDays(td, 1) ? U.fmtLong(d) + ' · ' : '') + U.plural(real.length + proj.length, 'tarea', 'tareas') })]),
        dayList(st, d, real, proj)]));
    }
    if (!days && !overdue.length) out.push(U.el('div.sec', [U.el('div.group', [W.UI.empty('agenda', 'Nada en los próximos 30 días', 'Las tareas con fecha aparecerán aquí, día a día.',
      U.el('button.btn.sm.soft', { on: { click: function () { W.QuickAdd.open({ date: td }); } } }, [U.icon('plus', 'sm'), 'Nueva tarea']))])]));
    else out.push(U.el('p.hint', { text: 'Se muestran los próximos 30 días.' }));
    return out;
  }

  /* ---------- Pantalla ---------- */
  W.Screens.calendar = {
    title: 'Calendario',
    render: function (root) {
      rootEl = root;
      var st = S(), v = ui(st), td = U.today();
      var cm = v.calMonth;
      var all = pool(st).filter(function (t) { return t.date && t.date.slice(0, 7) === cm.y + '-' + U.pad(cm.m + 1); });
      var sub = v.calView === 'agenda' ? 'Próximos 30 días' : v.calView === 'week' ? 'Semana ' + weekNumber(weekStart(st, v.calSelected)) + ' · ' + U.fmtMonth(cm.y, cm.m)
        : U.fmtMonth(cm.y, cm.m) + (all.length ? ' · ' + all.filter(function (t) { return t.done; }).length + ' de ' + all.length + ' completadas' : '');
      var isToday = v.calSelected === td;
      var head = W.UI.header({ title: 'Calendario', profile: true, sub: sub,
        actions: isToday || v.calView === 'agenda' ? [] : [{ text: 'Hoy', label: 'Ir a hoy', onTap: function () { select(st, td); rerender(); } }] });
      var seg = W.UI.segmented(VIEWS, v.calView, function (val) { v.calView = val; rerender(); });
      seg.style.marginTop = '12px';
      var list = v.calList ? st.getList(v.calList) : null;
      var listChip = U.el('button.chip' + (list ? '.on' : ''), { attrs: { type: 'button' } }, [
        list ? U.el('span.dot', { style: { '--c': st.ACCENTS[list.color].a } }) : U.icon('filter'), U.el('span', { text: list ? list.name : 'Todas las listas' }), U.icon('down')]);
      listChip.addEventListener('click', function () {
        W.Menu.open(listChip, [{ value: '', label: 'Todas las listas', icon: 'layers', on: !list }].concat(st.lists.map(function (l) {
          return { value: l.id, label: l.name, color: st.ACCENTS[l.color].a, on: list && list.id === l.id };
        }))).then(function (val) { if (val !== undefined) { v.calList = val || null; rerender(); } });
      });
      var doneChip = U.el('button.chip' + (v.calShowDone ? '.on' : ''), { attrs: { type: 'button', 'aria-pressed': v.calShowDone ? 'true' : 'false' } }, [U.icon('check'), U.el('span', { text: 'Completadas' })]);
      doneChip.addEventListener('click', function () { v.calShowDone = !v.calShowDone; W.Audio.select(); rerender(); });
      var tools = U.el('div.chips.cal-tools', [listChip, doneChip]);
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
