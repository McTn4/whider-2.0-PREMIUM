/**
 * WHIDER · Motor de estadísticas (lo usan Estadísticas e Informes)
 *
 * Para un periodo [desde, hasta] calcula lo hecho y lo compara con el periodo anterior de la
 * misma duración. Lo completado por día sale del historial permanente (sobrevive aunque borres
 * tareas); horas, días de la semana, categorías, prioridades y puntualidad salen de las tareas
 * completadas que siguen en la app.
 */
window.Whider = window.Whider || {};

(function (W) {
  'use strict';
  var U = W.U, S = function () { return W.State; };

  function daysBetween(from, to) { var out = [], d = from; while (d <= to && out.length < 800) { out.push(d); d = U.addDays(d, 1); } return out; }
  function pct(a, b) { return b ? Math.round(a / b * 100) : null; }

  /** Datos de un periodo */
  function period(from, to) {
    var st = S(), doneMap = st.doneByDay(), days = daysBetween(from, to), td = U.today();
    var startTs = U.parse(from).getTime(), endTs = U.parse(to).getTime() + 86400000;
    var created = {};
    st.tasks.forEach(function (t) { if (t.createdAt >= startTs && t.createdAt < endTs) { var d = U.ymd(new Date(t.createdAt)); created[d] = (created[d] || 0) + 1; } });
    var byWeekday = [0, 0, 0, 0, 0, 0, 0], byHour = [], byList = {}, byPrio = { danger: 0, purple: 0, star: 0, none: 0 };
    for (var h = 0; h < 24; h++) byHour.push(0);
    var withDeadline = 0, onTime = 0, doneTasks = [];
    st.tasks.forEach(function (t) {
      if (!t.done || !t.doneAt || t.doneAt < startTs || t.doneAt >= endTs) return;
      var at = new Date(t.doneAt);
      byWeekday[at.getDay()]++; byHour[at.getHours()]++;
      byList[t.listId || '-'] = (byList[t.listId || '-'] || 0) + 1;
      byPrio[t.highlight] = (byPrio[t.highlight] || 0) + 1;
      if (t.date) { withDeadline++; if (t.doneAt <= U.deadlineTs(t.date, t.time)) onTime++; }
      doneTasks.push(t);
    });
    var rows = days.map(function (d) {
      var f = st.focusOn(d);
      return { date: d, done: doneMap[d] || 0, created: created[d] || 0, focus: f.min || 0, sessions: f.sessions || 0, future: d > td };
    });
    var past = rows.filter(function (r) { return !r.future; });
    var done = past.reduce(function (a, r) { return a + r.done; }, 0);
    var focus = past.reduce(function (a, r) { return a + r.focus; }, 0);
    var best = past.reduce(function (m, r) { return r.done > m.done ? r : m; }, { done: 0, date: null });
    var habits = W.Habits ? W.Habits.list().map(function (hb) { return { habit: hb, rate: W.Habits.rate(hb, from, to > td ? td : to) }; }).filter(function (x) { return x.rate != null; }) : [];
    return {
      from: from, to: to, days: rows, len: days.length,
      done: done, created: rows.reduce(function (a, r) { return a + r.created; }, 0),
      focus: focus, sessions: past.reduce(function (a, r) { return a + r.sessions; }, 0),
      avg: past.length ? done / past.length : 0,
      activeDays: past.filter(function (r) { return r.done > 0; }).length,
      best: best, onTime: pct(onTime, withDeadline), withDeadline: withDeadline,
      byWeekday: byWeekday, byHour: byHour, byList: byList, byPrio: byPrio, doneTasks: doneTasks,
      habits: habits, habitRate: habits.length ? Math.round(habits.reduce(function (a, x) { return a + x.rate; }, 0) / habits.length) : null
    };
  }

  /** Periodo actual y anterior (para las variaciones) */
  function compare(from, to) {
    var len = U.diffDays(from, to) + 1;
    return { cur: period(from, to), prev: period(U.addDays(from, -len), U.addDays(from, -1)) };
  }

  /** Variación en %: null si no hay base */
  function delta(a, b) { return b ? Math.round((a - b) / b * 100) : (a ? null : 0); }

  /** Conclusiones en frases (Premium en el ordenador) */
  function insights(c) {
    var cur = c.cur, prev = c.prev, out = [], st = S();
    var d = delta(cur.done, prev.done);
    if (d != null && prev.done) out.push({ icon: d >= 0 ? 'up' : 'down', text: d >= 0 ? 'Has completado un ' + d + ' % más que en el periodo anterior.' : 'Has completado un ' + Math.abs(d) + ' % menos que en el periodo anterior.' });
    var wd = cur.byWeekday.indexOf(Math.max.apply(null, cur.byWeekday));
    if (cur.byWeekday[wd] > 0) out.push({ icon: 'calendar', text: 'Tu día más productivo es el ' + U.WEEKDAYS[wd] + '.' });
    var hs = cur.byHour, bestH = 0, bestV = 0;
    for (var h = 0; h < 23; h++) { var v = hs[h] + hs[h + 1]; if (v > bestV) { bestV = v; bestH = h; } }
    if (bestV > 1) out.push({ icon: 'clock', text: 'Completas más entre las ' + bestH + ':00 y las ' + (bestH + 2) + ':00.' });
    if (cur.onTime != null && cur.withDeadline >= 3) out.push({ icon: 'check', text: cur.onTime >= 80 ? 'El ' + cur.onTime + ' % de tus tareas con fecha las terminas a tiempo. ¡Muy bien!' : 'El ' + cur.onTime + ' % de tus tareas con fecha se terminan a tiempo: prueba a poner menos para cada día.' });
    var topList = Object.keys(cur.byList).sort(function (a, b) { return cur.byList[b] - cur.byList[a]; })[0];
    if (topList && cur.byList[topList] >= 2) { var l = st.getList(topList); out.push({ icon: l ? W.Lists.icon(l) : 'tray', text: 'Donde más avanzas: ' + (l ? l.name : 'sin categoría') + ' (' + cur.byList[topList] + ' completadas).' }); }
    if (cur.focus >= 60) out.push({ icon: 'timer', text: 'Llevas ' + String(Math.round(cur.focus / 60 * 10) / 10).replace('.', ',') + ' h de enfoque en este periodo.' });
    var weak = cur.habits.filter(function (x) { return x.rate < 50; }).sort(function (a, b) { return a.rate - b.rate; })[0];
    if (weak) out.push({ icon: 'target', text: 'El hábito que más te cuesta: «' + weak.habit.name + '» (' + weak.rate + ' %).' });
    if (st.bestStreak() >= 3) out.push({ icon: 'flame', text: 'Tu mejor racha: ' + st.bestStreak() + ' días seguidos completando tareas.' });
    return out;
  }

  /** Agrupa días en semanas o meses para periodos largos: [{ label, title, value }] */
  function bucket(rows, field, by) {
    if (by === 'day') return rows.map(function (r) { return { key: r.date, value: r[field], future: r.future, date: r.date }; });
    var map = {}, order = [];
    rows.forEach(function (r) {
      var k = by === 'month' ? r.date.slice(0, 7) : weekKey(r.date);
      if (!map[k]) { map[k] = { key: k, value: 0, date: r.date, future: true }; order.push(k); }
      map[k].value += r[field];
      if (!r.future) map[k].future = false;
    });
    return order.map(function (k) { return map[k]; });
  }
  function weekKey(ds) { var ws = S().settings.weekStart; return U.addDays(ds, -((U.weekday(ds) - ws + 7) % 7)); }

  W.Stats = { period: period, compare: compare, delta: delta, insights: insights, bucket: bucket, days: daysBetween };
})(window.Whider);
