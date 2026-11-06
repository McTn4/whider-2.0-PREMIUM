/**
 * WHIDER · Logros y niveles
 *
 * Experiencia (XP) calculada a partir de lo que haces, así es igual en todos tus dispositivos:
 *  tareas completadas · minutos de enfoque · mejor racha · días de hábitos cumplidos ·
 *  apuntes · amigos · logros conseguidos.
 * Los logros van por familias con varios grados (I, II, III…), cada uno con su barra de
 * progreso hasta el siguiente. Subir de nivel desbloquea objetos para tu personaje.
 */
window.Whider = window.Whider || {};

(function (W) {
  'use strict';
  var U = W.U, S = function () { return W.State; };

  var TITLES = ['Iniciado', 'Aprendiz', 'Constante', 'Enfocado', 'Organizado', 'Imparable', 'Estratega', 'Experto', 'Maestro', 'Sabio',
    'Visionario', 'Referente', 'Titán', 'Leyenda', 'Mito'];
  var ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI'];
  var TIER_XP = [25, 50, 100, 150, 250, 400];

  /* ---------- Métricas (una sola pasada por las tareas) ---------- */
  function metrics() {
    var st = S(), td = U.today();
    var m = {
      done: st.totalDone(), bestStreak: st.bestStreak(), focusMin: st.focusTotals().min, focusSessions: st.focusTotals().sessions,
      habitDays: 0, habitBest: 0, notes: st.notes.length, friends: st.friends().length, records: 0,
      perfectDays: 0, early: 0, late: 0, weekend: 0, onTime: 0, listsUsed: 0, filters: st.filters.length,
      systems: st.rules.length, cheers: (st.meta.cheersSent || 0), level: 1
    };
    var byDate = {}, lists = {};
    st.tasks.forEach(function (t) {
      if (t.date) { var e = byDate[t.date] || (byDate[t.date] = { n: 0, done: 0 }); e.n++; if (t.done) e.done++; }
      if (!t.done) return;
      if (t.listId) lists[t.listId] = true;
      if (t.doneAt) {
        var d = new Date(t.doneAt), h = d.getHours(), wd = d.getDay();
        if (h < 9) m.early++;
        if (h >= 22) m.late++;
        if (wd === 0 || wd === 6) m.weekend++;
        if (t.date && t.doneAt <= U.deadlineTs(t.date, t.time)) m.onTime++;
      }
    });
    Object.keys(byDate).forEach(function (d) { if (d <= td && byDate[d].n >= 3 && byDate[d].done === byDate[d].n) m.perfectDays++; });
    m.listsUsed = Object.keys(lists).length;
    if (W.Habits) st.habits.forEach(function (h) { m.habitDays += W.Habits.total(h); m.habitBest = Math.max(m.habitBest, W.Habits.best(h)); });
    var rec = st.records || {};
    m.records = Object.keys(rec.best || {}).length + (rec.custom || []).reduce(function (a, c) { return a + c.entries.length; }, 0);
    return m;
  }

  /*
   * Familias de logros: { id, icon, title, unit, value(m), tiers: [[umbral, nombre, ids antiguos]] }
   * Los ids de cada grado son «familia-grado» (y se conservan los de versiones anteriores).
   */
  var FAMILIES = [
    { id: 'tasks', icon: 'check', title: 'Tareas completadas', unit: 'tareas', cat: 'Tareas', value: function (m) { return m.done; },
      tiers: [[1, 'Primer paso', 'first'], [10, 'En marcha', 'ten'], [50, 'Imparable', 'fifty'], [100, 'Centenario', 'hundred'], [500, 'Quinientas'], [1000, 'Mil tareas']] },
    { id: 'streak', icon: 'flame', title: 'Racha de días', unit: 'días seguidos', cat: 'Constancia', value: function (m) { return m.bestStreak; },
      tiers: [[3, 'Calentando', 'streak3'], [7, 'Semana perfecta', 'streak7'], [30, 'Mes de hierro', 'streak30'], [100, 'Cien días']] },
    { id: 'perfect', icon: 'star', title: 'Días redondos', unit: 'días con todo hecho (3 o más tareas)', cat: 'Constancia', value: function (m) { return m.perfectDays; },
      tiers: [[1, 'Día redondo', 'perfect'], [10, 'Diez días redondos'], [50, 'Perfeccionista']] },
    { id: 'ontime', icon: 'clock', title: 'A tiempo', unit: 'tareas completadas antes de su plazo', cat: 'Tareas', value: function (m) { return m.onTime; },
      tiers: [[10, 'Puntual'], [50, 'Reloj suizo'], [200, 'Nunca tarde']] },
    { id: 'focus', icon: 'timer', title: 'Enfoque', unit: 'minutos de enfoque', cat: 'Enfoque', value: function (m) { return m.focusMin; },
      tiers: [[25, 'Concentración', 'focus1'], [600, 'Mente de acero', 'focus10h'], [3000, 'Cincuenta horas'], [12000, 'Monje del enfoque']] },
    { id: 'habits', icon: 'target', title: 'Hábitos cumplidos', unit: 'días de hábitos cumplidos', cat: 'Hábitos', value: function (m) { return m.habitDays; },
      tiers: [[1, 'Primer hábito'], [30, 'Rutina'], [100, 'Cien marcas'], [365, 'Un año de hábitos']] },
    { id: 'habitstreak', icon: 'repeat', title: 'Hábito formado', unit: 'días seguidos de un mismo hábito', cat: 'Hábitos', value: function (m) { return m.habitBest; },
      tiers: [[7, 'Una semana'], [21, 'Veintiún días'], [66, 'Hábito para siempre']] },
    { id: 'early', icon: 'sun', title: 'Madrugador', unit: 'tareas completadas antes de las 9', cat: 'Estilo', value: function (m) { return m.early; },
      tiers: [[5, 'Madrugador'], [50, 'Alba']] },
    { id: 'late', icon: 'moon', title: 'Noctámbulo', unit: 'tareas completadas después de las 22', cat: 'Estilo', value: function (m) { return m.late; },
      tiers: [[5, 'Noctámbulo'], [50, 'Búho']] },
    { id: 'weekend', icon: 'coffee', title: 'Fin de semana', unit: 'tareas completadas en fin de semana', cat: 'Estilo', value: function (m) { return m.weekend; },
      tiers: [[10, 'Sin descanso'], [100, 'Siete días']] },
    { id: 'lists', icon: 'layers', title: 'Organizado', unit: 'categorías con tareas completadas', cat: 'Organización', value: function (m) { return m.listsUsed; },
      tiers: [[3, 'Organizado', 'lists'], [6, 'Todo en su sitio']] },
    { id: 'systems', icon: 'system', title: 'Sistemas', unit: 'filtros y automatizaciones', cat: 'Organización', value: function (m) { return m.filters + m.systems; },
      tiers: [[1, 'Primer sistema'], [5, 'Arquitecto']] },
    { id: 'notes', icon: 'notebook', title: 'Apuntes', unit: 'apuntes', cat: 'Organización', value: function (m) { return m.notes; },
      tiers: [[1, 'Primera nota'], [10, 'Cuaderno'], [50, 'Biblioteca']] },
    { id: 'records', icon: 'trophy', title: 'Marcas personales', unit: 'marcas registradas', cat: 'Marcas', value: function (m) { return m.records; },
      tiers: [[1, 'Primera marca'], [10, 'Superándote'], [50, 'Atleta']] },
    { id: 'friends', icon: 'users', title: 'Comunidad', unit: 'amigos', cat: 'Comunidad', value: function (m) { return m.friends; },
      tiers: [[1, 'Primer amigo'], [5, 'Equipo'], [15, 'Tribu']] },
    { id: 'cheers', icon: 'send', title: 'Ánimos', unit: 'ánimos enviados', cat: 'Comunidad', value: function (m) { return m.cheers; },
      tiers: [[1, 'Buen compañero'], [25, 'Motivador']] }
  ];

  /** Logros planos (para avisos y compatibilidad): [{ id, family, tier, title, desc, icon, ok, xp }] */
  function flat(m) {
    var out = [];
    FAMILIES.forEach(function (f) {
      var v = f.value(m);
      f.tiers.forEach(function (t, i) {
        out.push({ id: t[2] || f.id + '-' + (i + 1), family: f.id, tier: i, title: t[1], icon: f.icon,
          desc: t[0] + ' ' + f.unit, ok: v >= t[0], xp: TIER_XP[i] || 400, need: t[0] });
      });
    });
    return out;
  }

  function levelOf(xp) { return Math.floor(Math.sqrt(xp / 60)) + 1; }
  function xpFor(level) { return Math.pow(level - 1, 2) * 60; }

  /** XP y nivel con su desglose */
  function compute() {
    var m = metrics(), list = flat(m);
    var parts = [
      { k: 'tasks', label: 'Tareas completadas', xp: m.done * 10 },
      { k: 'focus', label: 'Minutos de enfoque', xp: m.focusMin * 2 },
      { k: 'streak', label: 'Mejor racha', xp: m.bestStreak * 15 },
      { k: 'habits', label: 'Hábitos cumplidos', xp: m.habitDays * 5 },
      { k: 'notes', label: 'Apuntes', xp: Math.min(m.notes, 50) * 3 },
      { k: 'friends', label: 'Amigos', xp: Math.min(m.friends, 10) * 20 },
      { k: 'achievements', label: 'Logros', xp: list.filter(function (a) { return a.ok; }).reduce(function (s, a) { return s + a.xp; }, 0) }
    ];
    var xp = parts.reduce(function (s, p) { return s + p.xp; }, 0);
    var level = levelOf(xp), from = xpFor(level), to = xpFor(level + 1);
    m.level = level;
    return { xp: xp, level: level, from: from, to: to, progress: (xp - from) / (to - from), parts: parts, metrics: m, list: list };
  }

  var cache = null, cacheAt = 0;
  function get() {
    // Se recalcula como mucho una vez por fotograma (varios componentes lo piden a la vez)
    var now = Date.now();
    if (!cache || now - cacheAt > 300) { cache = compute(); cacheAt = now; }
    return cache;
  }
  if (W.State) W.State.subscribe(function () { cache = null; });
  else document.addEventListener('DOMContentLoaded', function () { W.State.subscribe(function () { cache = null; }); });

  var Game = {
    FAMILIES: FAMILIES,
    ROMAN: ROMAN,
    get: get,
    title: function (level) { return TITLES[Math.min(level - 1, TITLES.length - 1)]; },
    xpFor: xpFor,
    /** Familias con su grado actual y progreso al siguiente */
    families: function () {
      var g = get(), m = g.metrics;
      return FAMILIES.map(function (f) {
        var v = f.value(m), tier = -1;
        f.tiers.forEach(function (t, i) { if (v >= t[0]) tier = i; });
        var next = f.tiers[tier + 1] || null, prev = tier >= 0 ? f.tiers[tier][0] : 0;
        return {
          id: f.id, icon: f.icon, title: f.title, cat: f.cat, unit: f.unit, value: v, tier: tier, tiers: f.tiers.length,
          name: tier >= 0 ? f.tiers[tier][1] : 'Sin empezar', next: next ? { need: next[0], name: next[1] } : null,
          progress: next ? Math.max(0, Math.min(1, (v - prev) / (next[0] - prev))) : 1
        };
      });
    },
    /** Lista plana (compatibilidad con State.achievements) */
    achievements: function () { return get().list; },
    /** Fechas de los conseguidos, de más reciente a más antiguo */
    recent: function (n) {
      var at = S().meta.achievedAt || {}, list = get().list.filter(function (a) { return a.ok && at[a.id]; });
      return list.sort(function (a, b) { return at[b.id] - at[a.id]; }).slice(0, n || 6).map(function (a) { return Object.assign({ at: at[a.id] }, a); });
    }
  };

  W.Game = Game;

  // El resto de la app sigue pidiendo logros y nivel al estado: se calculan aquí
  var baseStats = W.State.stats;
  W.State.achievements = function () { return Game.achievements(); };
  W.State.levelTitle = Game.title;
  W.State.stats = function () {
    var s = baseStats(), g = get();
    s.xp = g.xp; s.level = g.level; s.levelProgress = g.progress; s.nextXp = g.to;
    return s;
  };
})(window.Whider);
