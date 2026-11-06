/**
 * WHIDER · Hábitos: qué días tocan, si se han cumplido, rachas y porcentajes.
 *
 * Frecuencias:
 *  - daily  · todos los días
 *  - days   · días concretos de la semana (p. ej. lunes, miércoles y viernes)
 *  - weekly · X veces por semana, el día que quieras
 * Cada hábito tiene un objetivo diario (1 = hecho / no hecho; 8 = «8 vasos de agua»).
 * Los datos viven en W.State (habits y habitLog) y se sincronizan con la cuenta.
 */
window.Whider = window.Whider || {};

(function (W) {
  'use strict';
  var U = W.U, S = function () { return W.State; };

  var ICONS = ['target', 'flame', 'bolt', 'timer', 'note', 'coffee', 'moon', 'sun', 'check', 'star', 'trophy', 'user', 'repeat', 'bell', 'flag'];
  var DAY_ORDER = function () { var ws = S().settings.weekStart; return [0, 1, 2, 3, 4, 5, 6].map(function (i) { return (i + ws) % 7; }); };

  function created(h) { return U.ymd(new Date(h.createdAt)); }
  function weekStartOf(ds) { var ws = S().settings.weekStart; return U.addDays(ds, -((U.weekday(ds) - ws + 7) % 7)); }

  var Habits = {
    ICONS: ICONS,
    DAY_ORDER: DAY_ORDER,

    /** Hábitos activos (o todos), en su orden */
    list: function (withArchived) {
      return S().habits.filter(function (h) { return withArchived || !h.archived; });
    },
    archived: function () { return S().habits.filter(function (h) { return h.archived; }); },

    /** ¿Toca este día? (los semanales cuentan cualquier día) */
    isDue: function (h, ds) {
      if (ds < created(h)) return false;
      if (h.freq === 'days') return h.days.indexOf(U.weekday(ds)) >= 0;
      return true;
    },
    count: function (h, ds) { return S().habitCount(h.id, ds); },
    isDone: function (h, ds) { return Habits.count(h, ds) >= h.target; },

    /** Hechos esta semana (para los de X veces por semana) */
    weekDone: function (h, ds) {
      var start = weekStartOf(ds || U.today()), n = 0;
      for (var i = 0; i < 7; i++) if (Habits.isDone(h, U.addDays(start, i))) n++;
      return n;
    },
    /** Pendiente hoy: toca y aún no está hecho (los semanales, si no han llegado a su objetivo) */
    pendingToday: function (h) {
      var td = U.today();
      if (Habits.isDone(h, td)) return false;
      if (h.freq === 'weekly') return Habits.weekDone(h, td) < h.perWeek;
      return Habits.isDue(h, td);
    },
    dueToday: function () {
      var td = U.today();
      return Habits.list().filter(function (h) { return h.freq === 'weekly' ? (Habits.weekDone(h, td) < h.perWeek || Habits.isDone(h, td)) : Habits.isDue(h, td); });
    },

    /** Toque rápido: con objetivo 1 marca o desmarca; con más, suma uno (y al pasarse vuelve a 0) */
    tap: function (h, ds) {
      var n = Habits.count(h, ds);
      var next = h.target <= 1 ? (n >= 1 ? 0 : 1) : (n >= h.target ? 0 : n + 1);
      S().setHabitCount(h.id, ds, next);
      if (next >= h.target && n < h.target) { W.Audio.success(); W.Audio.vibrate([12]); } else W.Audio.select();
      return next;
    },

    /** Racha actual: días que tocaban seguidos y cumplidos (o semanas, en los semanales) */
    streak: function (h) {
      var td = U.today(), n = 0, guard = 0;
      if (h.freq === 'weekly') {
        var wk = weekStartOf(td);
        if (Habits.weekDone(h, td) < h.perWeek) wk = U.addDays(wk, -7);
        while (guard++ < 520 && wk >= weekStartOf(created(h)) && Habits.weekDone(h, wk) >= h.perWeek) { n++; wk = U.addDays(wk, -7); }
        return n;
      }
      var d = td;
      if (Habits.isDue(h, d) && !Habits.isDone(h, d)) d = U.addDays(d, -1);
      while (guard++ < 3700 && d >= created(h)) {
        if (Habits.isDue(h, d)) { if (!Habits.isDone(h, d)) break; n++; }
        d = U.addDays(d, -1);
      }
      return n;
    },
    /** Mejor racha de la historia */
    best: function (h) {
      var best = 0, run = 0, td = U.today();
      if (h.freq === 'weekly') {
        for (var wk = weekStartOf(created(h)); wk <= td; wk = U.addDays(wk, 7)) {
          if (Habits.weekDone(h, wk) >= h.perWeek) { run++; if (run > best) best = run; } else if (wk !== weekStartOf(td)) run = 0;
        }
        return best;
      }
      for (var d = created(h); d <= td; d = U.addDays(d, 1)) {
        if (!Habits.isDue(h, d)) continue;
        if (Habits.isDone(h, d)) { run++; if (run > best) best = run; } else if (d !== td) run = 0;
      }
      return best;
    },
    /** Porcentaje cumplido entre dos fechas (días que tocaban, o semanas en los semanales) */
    rate: function (h, from, to) {
      var start = from > created(h) ? from : created(h), due = 0, done = 0;
      if (start > to) return null;
      if (h.freq === 'weekly') {
        for (var wk = weekStartOf(start); wk <= to; wk = U.addDays(wk, 7)) { due++; if (Habits.weekDone(h, wk) >= h.perWeek) done++; }
      } else {
        for (var d = start; d <= to; d = U.addDays(d, 1)) {
          if (!Habits.isDue(h, d)) continue;
          if (d === U.today() && !Habits.isDone(h, d)) continue;   // hoy aún se puede cumplir
          due++; if (Habits.isDone(h, d)) done++;
        }
      }
      return due ? Math.round(done / due * 100) : null;
    },
    /** Días cumplidos en total */
    total: function (h) {
      var log = S().habitLog[h.id] || {};
      return Object.keys(log).filter(function (d) { return log[d].n >= h.target; }).length;
    },
    stats: function (h) {
      var td = U.today();
      return {
        streak: Habits.streak(h), best: Habits.best(h), total: Habits.total(h),
        rate30: Habits.rate(h, U.addDays(td, -29), td),
        today: { count: Habits.count(h, td), done: Habits.isDone(h, td), due: Habits.isDue(h, td) },
        week: Habits.weekDone(h, td)
      };
    },

    /** Texto de la frecuencia: «Cada día», «L, X, V», «3 veces por semana» */
    freqLabel: function (h) {
      if (h.freq === 'weekly') return h.perWeek === 1 ? '1 vez por semana' : h.perWeek + ' veces por semana';
      if (h.freq === 'days') {
        if (h.days.length === 7) return 'Cada día';
        if (h.days.join() === '1,2,3,4,5') return 'De lunes a viernes';
        if (h.days.join() === '0,6') return 'Fines de semana';
        return DAY_ORDER().filter(function (d) { return h.days.indexOf(d) >= 0; }).map(function (d) { return U.WEEKDAYS_SHORT[d]; }).join(', ');
      }
      return 'Cada día';
    },
    targetLabel: function (h) { return h.target > 1 ? h.target + (h.unit ? ' ' + h.unit : ' veces') + ' al día' : ''; },

    /** Resumen de hoy para Hoy y la barra lateral: { done, total } */
    todaySummary: function () {
      var list = Habits.dueToday(), td = U.today();
      return { done: list.filter(function (h) { return Habits.isDone(h, td); }).length, total: list.length };
    }
  };

  W.Habits = Habits;
})(window.Whider);
