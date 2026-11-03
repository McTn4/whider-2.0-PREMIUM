/**
 * WHIDER · Registro de marcas
 *  - Marcas automáticas: mejor racha, más tareas en un día, mejor semana y más enfoque en un día.
 *    Se guardan con su fecha y un historial, y NO se pierden aunque borres tareas.
 *  - Marcas personales: el usuario crea sus propias marcas (p. ej. "5 km", "Press banca")
 *    y va registrando valores; la app detecta cuándo supera su mejor marca.
 */
window.Whider = window.Whider || {};

(function (W) {
  'use strict';
  var U = W.U, S = function () { return W.State; };

  var AUTO = {
    streak: { title: 'Mejor racha', unit: 'días', icon: 'flame', fmt: function (v) { return U.plural(v, 'día', 'días'); } },
    day: { title: 'Más tareas en un día', unit: 'tareas', icon: 'bolt', fmt: function (v) { return U.plural(v, 'tarea', 'tareas'); } },
    week: { title: 'Mejor semana', unit: 'tareas', icon: 'calendar', fmt: function (v) { return U.plural(v, 'tarea', 'tareas'); } },
    focusDay: { title: 'Más enfoque en un día', unit: 'min', icon: 'timer', fmt: function (v) { return v + ' min'; } }
  };
  var MILESTONES = [10, 25, 50, 100, 250, 500, 1000, 2500, 5000];

  function weekStartOf(d) {
    var ws = S().settings.weekStart;
    return U.addDays(d, -((U.weekday(d) - ws + 7) % 7));
  }

  /** Valores actuales de cada marca automática */
  function current() {
    var st = S(), td = U.today(), log = st.doneByDay();
    var wk = weekStartOf(td), weekSum = 0;
    for (var i = 0; i < 7; i++) weekSum += log[U.addDays(wk, i)] || 0;
    return { streak: st.streak(), day: log[td] || 0, week: weekSum, focusDay: st.focusOn(td).min };
  }

  /** Mejores valores históricos calculados a partir de los registros diarios (para inicializar) */
  function historical() {
    var st = S(), log = st.doneByDay(), focus = st.focusLog(), best = { streak: { value: st.bestStreak(), date: U.today() } };
    var bd = { value: 0, date: U.today() }, bf = { value: 0, date: U.today() }, weeks = {};
    Object.keys(log).forEach(function (d) {
      if (log[d] > bd.value) bd = { value: log[d], date: d };
      var w = weekStartOf(d); weeks[w] = (weeks[w] || 0) + log[d];
    });
    Object.keys(focus).forEach(function (d) { if ((focus[d].min || 0) > bf.value) bf = { value: focus[d].min, date: d }; });
    var bw = { value: 0, date: U.today() };
    Object.keys(weeks).forEach(function (w) { if (weeks[w] > bw.value) bw = { value: weeks[w], date: w }; });
    best.day = bd; best.week = bw; best.focusDay = bf;
    return best;
  }

  function pushHistory(entry) {
    var r = S().records;
    r.history.push(Object.assign({ id: U.uid('h'), at: Date.now(), date: U.today() }, entry));
    if (r.history.length > 300) r.history = r.history.slice(-300);
  }

  function parseValue(mark, raw) {
    raw = String(raw || '').trim().replace(',', '.');
    if (mark.kind === 'time') {
      var parts = raw.split(':').map(Number);
      if (!parts.length || parts.some(function (n) { return !isFinite(n) || n < 0; })) return NaN;
      return parts.reduce(function (acc, n) { return acc * 60 + n; }, 0);
    }
    return raw === '' ? NaN : Number(raw);
  }

  function fmtValue(mark, v) {
    if (v == null || !isFinite(v)) return '—';
    if (mark.kind === 'time') {
      var h = Math.floor(v / 3600), m = Math.floor(v % 3600 / 60), s = Math.round(v % 60);
      return (h ? h + ':' + U.pad(m) : m) + ':' + U.pad(s);
    }
    var txt = Math.round(v * 100) / 100;
    return String(txt).replace('.', ',') + (mark.unit ? ' ' + mark.unit : '');
  }

  function isBetter(mark, a, b) { return mark.better === 'lower' ? a < b : a > b; }

  function bestEntry(mark) {
    var best = null;
    mark.entries.forEach(function (e) { if (!best || isBetter(mark, e.value, best.value)) best = e; });
    return best;
  }

  var Records = {
    AUTO: AUTO,
    current: current,
    parseValue: parseValue,
    fmtValue: fmtValue,
    bestEntry: bestEntry,

    /** Pone las marcas al día con el historial guardado (sin avisos): nunca valen menos que la realidad */
    init: function () {
      var r = S().records, h = historical(), changed = false;
      Object.keys(h).forEach(function (k) {
        if (h[k].value > 0 && (!r.best[k] || r.best[k].value < h[k].value)) { r.best[k] = h[k]; changed = true; }
      });
      if (changed) S().save();
    },

    /** Comprueba si se ha batido alguna marca. Devuelve las nuevas marcas. */
    check: function (silent) {
      var st = S(), r = st.records, cur = current(), fresh = [];
      Object.keys(AUTO).forEach(function (k) {
        var prev = r.best[k] ? r.best[k].value : 0;
        if (cur[k] > prev) {
          r.best[k] = { value: cur[k], date: U.today() };
          // Solo cuenta como "nueva marca" si supera una anterior (o es la primera de valor ≥ 2)
          if (prev > 0 || cur[k] >= 2) {
            pushHistory({ type: k, value: cur[k], prev: prev });
            fresh.push({ type: k, value: cur[k], prev: prev });
          }
        }
      });
      var total = st.totalDone(), lastMilestone = r.best.milestone ? r.best.milestone.value : 0;
      MILESTONES.forEach(function (m) {
        if (total >= m && m > lastMilestone) {
          r.best.milestone = { value: m, date: U.today() };
          lastMilestone = m;
          pushHistory({ type: 'milestone', value: m, prev: 0 });
          fresh.push({ type: 'milestone', value: m });
        }
      });
      if (fresh.length) st.save();
      if (!silent) fresh.forEach(function (f, i) {
        setTimeout(function () {
          var text = f.type === 'milestone' ? 'Hito: ' + f.value + ' tareas completadas' : 'Nueva marca · ' + AUTO[f.type].title + ': ' + AUTO[f.type].fmt(f.value);
          W.Toast.show({ text: text, type: 'success', icon: f.type === 'milestone' ? 'trophy' : AUTO[f.type].icon, duration: 4200 });
          W.Audio.vibrate([12]);
        }, 1200 + i * 800);
      });
      return fresh;
    },

    historyText: function (h) {
      if (h.type === 'milestone') return h.value + ' tareas completadas en total';
      if (h.type === 'custom') return h.text || 'Nueva marca personal';
      var a = AUTO[h.type];
      return a ? a.title + ': ' + a.fmt(h.value) + (h.prev ? ' (antes ' + h.prev + ')' : '') : '';
    },

    /* ---------- Marcas personales ---------- */
    marks: function () { return S().records.custom; },
    getMark: function (id) {
      var list = S().records.custom;
      for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
      return null;
    },
    addMark: function (o) {
      var m = {
        id: U.uid('m'), name: o.name.trim().slice(0, 40), unit: (o.unit || '').trim().slice(0, 12),
        kind: o.kind === 'time' ? 'time' : 'number', better: o.better === 'lower' ? 'lower' : 'higher',
        icon: o.icon || 'trophy', createdAt: Date.now(), updatedAt: Date.now(), entries: []
      };
      S().records.custom.push(m);
      S().notify('records');
      return m;
    },
    updateMark: function (id, o) {
      var m = Records.getMark(id);
      if (!m) return;
      ['name', 'unit', 'kind', 'better', 'icon'].forEach(function (k) { if (o[k] != null) m[k] = o[k]; });
      m.updatedAt = Date.now();
      S().notify('records');
    },
    removeMark: function (id) {
      var r = S().records;
      r.custom = r.custom.filter(function (m) { return m.id !== id; });
      S().markDeleted('mark:' + id);
      S().notify('records');
    },
    /** Añade un registro; devuelve true si es una nueva mejor marca */
    addEntry: function (markId, value, date, note) {
      var m = Records.getMark(markId);
      if (!m || !isFinite(value)) return false;
      var prevBest = bestEntry(m);
      var e = { id: U.uid('e'), value: value, date: date || U.today(), note: (note || '').slice(0, 120), at: Date.now() };
      m.entries.push(e);
      m.updatedAt = Date.now();
      var record = !prevBest || isBetter(m, value, prevBest.value);
      if (record && prevBest) {
        pushHistory({ type: 'custom', value: value, prev: prevBest.value, markId: m.id,
          text: m.name + ': ' + fmtValue(m, value) + ' (antes ' + fmtValue(m, prevBest.value) + ')' });
      }
      S().notify('records');
      return record && !!prevBest;
    },
    removeEntry: function (markId, entryId) {
      var m = Records.getMark(markId);
      if (!m) return;
      m.entries = m.entries.filter(function (e) { return e.id !== entryId; });
      m.updatedAt = Date.now();
      S().markDeleted('entry:' + entryId);
      S().notify('records');
    }
  };

  W.Records = Records;
})(window.Whider);
