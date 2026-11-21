// @ts-check
/**
 * WHIDER · Esquema de los datos
 * Valores por defecto (ajustes, categorías, prioridades, repeticiones) y la limpieza de todo lo que se guarda:
 * cada tarea, categoría, hábito, regla, filtro, apunte, personaje o dato de la comunidad pasa por aquí al
 * cargarse del dispositivo o llegar de la nube, así que un dato roto o de una versión antigua nunca llega a la
 * app. Son funciones puras (sin almacenamiento ni estado): las usa js/core/store.js y se prueban por separado.
 */
window.Whider = window.Whider || {};

(function (W) {
  'use strict';
  var U = W.U;

  /*
   * Colores de versiones anteriores. Desde la 4.4 la interfaz es en blanco y negro y no los usa,
   * pero se conservan en los datos (listas y ajustes) para que la copia en la nube siga siendo
   * compatible con dispositivos que aún tengan una versión antigua.
   */
  var ACCENTS = {
    iris:     { name: W.t('Iris'),     a: '#7C83FF', on: '#FFFFFF' },
    indigo:   { name: W.t('Azul'),     a: '#4C8DFF', on: '#FFFFFF' },
    violet:   { name: W.t('Violeta'),  a: '#A98BFF', on: '#FFFFFF' },
    rose:     { name: W.t('Rosa'),     a: '#FF6B9A', on: '#FFFFFF' },
    red:      { name: W.t('Coral'),    a: '#FF6B5E', on: '#FFFFFF' },
    ember:    { name: W.t('Naranja'),  a: '#FF9A4D', on: '#1A1206' },
    gold:     { name: W.t('Ámbar'),    a: '#F5BE4B', on: '#1A1406' },
    jade:     { name: W.t('Verde'),    a: '#3DD68C', on: '#06180F' },
    mint:     { name: W.t('Menta'),    a: '#5EE0C8', on: '#061814' },
    aqua:     { name: W.t('Cian'),     a: '#3CC6E0', on: '#061418' },
    brown:    { name: W.t('Arena'),    a: '#C9A27C', on: '#1A1209' },
    graphite: { name: W.t('Plata'),    a: '#A3AAB9', on: '#101217' }
  };

  /*
   * Color opcional de cada categoría (por defecto, ninguno: la app sigue en blanco y negro).
   * Cinco tonos comprobados sobre el fondo oscuro: contraste ≥ 3:1 y separados entre sí también
   * para quien no distingue bien rojo y verde. El color nunca va solo: acompaña al nombre y al icono.
   * El rojo y el ámbar quedan para la prioridad (urgente e importante).
   */
  var LIST_TINTS = {
    verde:    { name: W.t('Verde'),    hex: '#008300' },
    azul:     { name: W.t('Azul'),     hex: '#3987E5' },
    turquesa: { name: W.t('Turquesa'), hex: '#199E70' },
    violeta:  { name: W.t('Violeta'),  hex: '#9085E9' },
    rosa:     { name: W.t('Rosa'),     hex: '#D55181' }
  };

  var PRIORITIES = {
    danger: { label: W.t('Urgente'), short: W.t('Urgente'), rank: 0 },
    purple: { label: W.t('Importante'), short: W.t('Importante'), rank: 1 },
    star:   { label: W.t('Destacada'), short: W.t('Destacada'), rank: 2 },
    none:   { label: W.t('Normal'), short: W.t('Normal'), rank: 3 }
  };

  var REPEATS = {
    none: W.t('No se repite'),
    daily: W.t('Cada día'),
    weekdays: W.t('Días laborables'),
    weekly: W.t('Cada semana'),
    monthly: W.t('Cada mes')
  };

  var DEFAULT_SETTINGS = {
    accent: 'iris',
    textSize: 'm',
    density: 'comfortable',
    bgEffects: true,
    reduceMotion: false,
    startScreen: 'home',
    homeSections: { summary: true, actions: true, next: true, agenda: true, week: true },
    dailyGoal: 5,
    weekStart: 1,
    timeFormat: '24',
    hideCompleted: false,
    confirmDelete: true,
    defaultWarn: true,
    defaultList: 'personal',
    remindBefore: 15,
    rewarn: 20,
    sort: 'smart',
    sound: true,
    sounds: { buttons: true, notify: true, events: true, volume: 70, style: 'soft' },
    vibrate: true,
    quietHours: { enabled: false, from: '22:00', to: '08:00' },
    focus: { work: 25, short: 5, long: 15, rounds: 4, autoBreaks: true },
    homeHabits: true,
    homeBuddy: true,
    contrast: 'normal',
    // Tema: 'dark' (de siempre), 'light' o 'system' (el del dispositivo)
    theme: 'dark',
    // Prioridad también en color (rojo urgente, ámbar importante); siempre con texto y barras
    prioColor: false,
    // Pestañas de la barra inferior del móvil (la cuarta es siempre «Más»)
    dock: 'home,tasks,calendar',
    // Calendarios suscritos (js/core/calendars.js): [{ id, url, name, on }]. Los eventos no van aquí, sino en cada dispositivo
    calendars: [],
    // Personalización avanzada del ordenador
    desk: {
      sidebar: { habits: true, notes: true, focus: true, stats: true, reports: true, automations: true, friends: true, chats: true, filters: true, counts: true, compact: false },
      widgets: { buddy: true, summary: true, habits: true, upcoming: true, focus: false },
      widgetOrder: 'buddy,summary,messages,habits,upcoming,pages,focus',
      calView: 'month', calStartH: 7, calEndH: 21, weekends: true,
      wide: false, contrast: 'normal'
    }
  };

  var DEFAULT_LISTS = [
    { id: 'personal', name: W.t('Personal'), color: 'iris', icon: 'user' },
    { id: 'work', name: W.t('Trabajo'), color: 'ember', icon: 'briefcase' },
    { id: 'health', name: W.t('Salud'), color: 'jade', icon: 'heart' }
  ];
  var DEFAULT_LIST_ICON = { personal: 'user', work: 'briefcase', health: 'heart' };
  function cleanIcon(ic, id) { return typeof ic === 'string' && /^[a-z-]{2,20}$/.test(ic) ? ic : (DEFAULT_LIST_ICON[id] || 'list'); }

  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  /** Fusiona respetando solo claves conocidas y del mismo tipo */
  function mergeTyped(def, src) {
    var out = clone(def);
    if (!src || typeof src !== 'object') return out;
    Object.keys(def).forEach(function (k) {
      var d = def[k], v = src[k];
      if (v === undefined || v === null) return;
      if (d && typeof d === 'object' && !Array.isArray(d)) out[k] = mergeTyped(d, v);
      else if (typeof v === typeof d) out[k] = v;
    });
    return out;
  }

  var isDate = function (s) { return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s); };
  var isTime = function (s) { return typeof s === 'string' && /^\d{2}:\d{2}$/.test(s); };

  /*
   * Hora de la última edición de cada campo de una tarea («ft»). Con ella, si dos dispositivos
   * cambian a la vez campos distintos de la misma tarea (uno la fecha y otro la completa), la
   * sincronización conserva los dos cambios en lugar de quedarse solo con la versión más reciente.
   * Se guarda solo lo editado en los últimos 30 días: pasado ese tiempo ya no puede haber choque.
   */
  var FT_KEYS = { text: 1, notes: 1, date: 1, time: 1, done: 1, highlight: 1, warn: 1, remindBefore: 1, listId: 1, repeat: 1, subtasks: 1, duration: 1, startedAt: 1 };
  var FT_DAYS = 30 * 86400000;
  function cleanFt(ft) {
    if (!ft || typeof ft !== 'object') return undefined;
    var out = {}, old = Date.now() - FT_DAYS, n = 0;
    Object.keys(ft).forEach(function (k) {
      var v = ft[k];
      if (FT_KEYS[k] && typeof v === 'number' && isFinite(v) && v > old) { out[k] = v; n++; }
    });
    return n ? out : undefined;
  }
  /** Campos con hora propia que cambian de una versión a otra de la tarea */
  function changedFields(before, after) {
    return Object.keys(FT_KEYS).filter(function (k) { return JSON.stringify(before[k]) !== JSON.stringify(after[k]); });
  }
  function stampFields(t, keys) {
    if (!keys.length) return;
    var now = Date.now();
    t.ft = Object.assign({}, t.ft || {});
    keys.forEach(function (k) { t.ft[k] = now; });
  }

  function cleanTask(item, listIds) {
    if (!item || typeof item.text !== 'string' || !item.text.trim()) return null;
    var subs = Array.isArray(item.subtasks) ? item.subtasks.filter(function (s) {
      return s && typeof s.text === 'string' && s.text.trim();
    }).map(function (s) {
      return { id: typeof s.id === 'string' ? s.id : U.uid('s'), text: s.text.trim().slice(0, 120), done: !!s.done };
    }) : [];
    return {
      id: typeof item.id === 'string' ? item.id : U.uid(),
      text: item.text.trim().slice(0, 160),
      notes: typeof item.notes === 'string' ? item.notes.slice(0, 2000) : '',
      date: isDate(item.date) ? item.date : null,
      time: isTime(item.time) ? item.time : null,
      done: !!item.done,
      doneOn: isDate(item.doneOn) ? item.doneOn : null,
      doneAt: typeof item.doneAt === 'number' ? item.doneAt : null,
      highlight: PRIORITIES[item.highlight] ? item.highlight : 'none',
      warn: !!item.warn,
      warnedAt: typeof item.warnedAt === 'number' && isFinite(item.warnedAt) ? item.warnedAt : null,
      remindedAt: typeof item.remindedAt === 'number' ? item.remindedAt : null,
      remindBefore: typeof item.remindBefore === 'number' ? item.remindBefore : null,
      listId: typeof item.listId === 'string' && (!listIds || listIds[item.listId]) ? item.listId : null,
      repeat: REPEATS[item.repeat] ? item.repeat : 'none',
      spawnedId: typeof item.spawnedId === 'string' ? item.spawnedId : null,
      // Empezada (en curso) desde este momento; se borra al completarla
      startedAt: !item.done && typeof item.startedAt === 'number' && isFinite(item.startedAt) ? item.startedAt : null,
      subtasks: subs,
      focusMin: typeof item.focusMin === 'number' ? item.focusMin : 0,
      duration: typeof item.duration === 'number' && item.duration >= 5 && item.duration <= 720 ? Math.round(item.duration) : null,
      createdAt: typeof item.createdAt === 'number' ? item.createdAt : Date.now(),
      updatedAt: typeof item.updatedAt === 'number' ? item.updatedAt : (typeof item.createdAt === 'number' ? item.createdAt : Date.now()),
      example: !!item.example,
      mine: !!item.mine,
      ft: cleanFt(item.ft)
    };
  }

  function cleanTasks(arr, lists) {
    var ids = {};
    (lists || []).forEach(function (l) { ids[l.id] = true; });
    var out = [];
    (Array.isArray(arr) ? arr : []).forEach(function (t) { var c = cleanTask(t, ids); if (c) out.push(c); });
    return out;
  }

  function cleanLists(arr) {
    if (!Array.isArray(arr) || !arr.length) return clone(DEFAULT_LISTS);
    var out = arr.filter(function (l) { return l && typeof l.id === 'string' && typeof l.name === 'string' && l.name.trim(); })
      .map(function (l) {
        var out = { id: l.id, name: l.name.trim().slice(0, 24), color: ACCENTS[l.color] ? l.color : 'iris', icon: cleanIcon(l.icon, l.id) };
        if (LIST_TINTS[l.tint]) out.tint = l.tint;
        return out;
      });
    return out.length ? out : clone(DEFAULT_LISTS);
  }

  /*
   * Tareas de ejemplo de versiones anteriores (2.x – 4.0). Ya no se crean y se eliminan
   * SIEMPRE que aparezcan — en el dispositivo o llegadas de la nube —, aunque estén
   * completadas, repetidas, sin la marca de ejemplo o cambiadas de fecha.
   * Solo se respetan las que el usuario escribió a mano en esta versión (marca "mine")
   * y las de ejemplo a las que cambió el texto (ya son suyas).
   * Se registran como borradas para que la nube no las devuelva.
   */
  var SAMPLE_TEXTS = {
    'planificar prioridades de la semana': 1, 'planificar las prioridades de la semana': 1,
    'entrenamiento o sesión de ejercicio': 1, 'entrenamiento de 30 minutos': 1,
    'leer 20 páginas': 1, 'reunión de revisión de avances': 1
  };
  function normText(t) { return String(t.text || '').trim().replace(/\s+/g, ' ').toLowerCase(); }
  function isSampleText(t) { return !!SAMPLE_TEXTS[normText(t)]; }
  /** Devuelve los ids a eliminar */
  function sampleIds(list) {
    var out = {};
    list.forEach(function (t) {
      if (t.mine) return;
      if (isSampleText(t)) out[t.id] = true;
      else if (t.example) t.example = false;   // la renombró: ya es suya
    });
    return out;
  }
  function purgeSamples(list, deleted) {
    var ids = sampleIds(list), now = Date.now();
    if (!Object.keys(ids).length) return list;
    Object.keys(ids).forEach(function (id) { deleted[id] = now; });
    return list.filter(function (t) { return !ids[t.id]; });
  }

  function emptyRecords() {
    return { best: {}, history: [], custom: [] };
  }
  function cleanRecords(r) {
    var out = emptyRecords();
    if (!r || typeof r !== 'object') return out;
    if (r.best && typeof r.best === 'object') Object.keys(r.best).forEach(function (k) {
      var b = r.best[k];
      if (b && typeof b.value === 'number') out.best[k] = { value: b.value, date: isDate(b.date) ? b.date : U.today() };
    });
    if (Array.isArray(r.history)) out.history = r.history.filter(function (h) { return h && h.id && h.type && typeof h.value === 'number'; }).slice(-300);
    if (Array.isArray(r.custom)) out.custom = r.custom.filter(function (m) { return m && m.id && typeof m.name === 'string'; }).map(function (m) {
      return {
        id: m.id, name: m.name.slice(0, 40), unit: typeof m.unit === 'string' ? m.unit.slice(0, 12) : '',
        kind: m.kind === 'time' ? 'time' : 'number', better: m.better === 'lower' ? 'lower' : 'higher', icon: typeof m.icon === 'string' ? m.icon : 'trophy',
        createdAt: typeof m.createdAt === 'number' ? m.createdAt : Date.now(),
        updatedAt: typeof m.updatedAt === 'number' ? m.updatedAt : Date.now(),
        entries: (Array.isArray(m.entries) ? m.entries : []).filter(function (e) { return e && e.id && typeof e.value === 'number' && isFinite(e.value); })
          .map(function (e) { return { id: e.id, value: e.value, date: isDate(e.date) ? e.date : U.today(), note: typeof e.note === 'string' ? e.note.slice(0, 120) : '', at: typeof e.at === 'number' ? e.at : Date.now() }; })
      };
    });
    return out;
  }

  /* ---------- Hábitos ---------- */
  var HABIT_FREQS = { daily: 1, days: 1, weekly: 1 };
  function cleanHabit(h, i) {
    if (!h || typeof h.name !== 'string' || !h.name.trim()) return null;
    var days = Array.isArray(h.days) ? h.days.filter(function (d) { return d >= 0 && d <= 6; }).map(Number) : [];
    return {
      id: typeof h.id === 'string' ? h.id : U.uid('h'),
      name: h.name.trim().slice(0, 40),
      icon: typeof h.icon === 'string' ? h.icon.slice(0, 20) : 'target',
      freq: HABIT_FREQS[h.freq] ? h.freq : 'daily',
      days: days.length ? days.filter(function (d, k) { return days.indexOf(d) === k; }).sort() : [1, 2, 3, 4, 5],
      perWeek: Math.max(1, Math.min(7, Math.round(+h.perWeek || 3))),
      target: Math.max(1, Math.min(50, Math.round(+h.target || 1))),
      unit: typeof h.unit === 'string' ? h.unit.trim().slice(0, 14) : '',
      reminder: isTime(h.reminder) ? h.reminder : null,
      archived: !!h.archived,
      order: typeof h.order === 'number' ? h.order : (i || 0),
      createdAt: typeof h.createdAt === 'number' ? h.createdAt : Date.now(),
      updatedAt: typeof h.updatedAt === 'number' ? h.updatedAt : Date.now()
    };
  }
  function cleanHabits(arr) {
    var out = [];
    (Array.isArray(arr) ? arr : []).forEach(function (h, i) { var c = cleanHabit(h, i); if (c) out.push(c); });
    return out.sort(function (a, b) { return a.order - b.order || a.createdAt - b.createdAt; });
  }
  /** Registro: { idHábito: { 'AAAA-MM-DD': { n: veces, at: marca de tiempo } } } */
  function cleanHabitLog(log) {
    var out = {};
    if (!log || typeof log !== 'object') return out;
    Object.keys(log).forEach(function (id) {
      var days = log[id], dst = {};
      if (!days || typeof days !== 'object') return;
      Object.keys(days).forEach(function (d) {
        var e = days[d];
        if (!isDate(d) || !e || typeof e.n !== 'number' || !isFinite(e.n)) return;
        dst[d] = { n: Math.max(0, Math.min(99, Math.round(e.n))), at: typeof e.at === 'number' ? e.at : 0 };
      });
      out[id] = dst;
    });
    return out;
  }

  /* ---------- Automatizaciones ---------- */
  var RULE_TRIGGERS = { created: 1, completed: 1, overdue: 1, daily: 1 };
  function cleanRule(r) {
    if (!r || typeof r.id !== 'string' || !r.trigger || !RULE_TRIGGERS[r.trigger.type]) return null;
    var simple = function (v) { return typeof v === 'string' ? v.slice(0, 160) : typeof v === 'number' && isFinite(v) ? v : typeof v === 'boolean' ? v : null; };
    return {
      id: r.id,
      name: typeof r.name === 'string' && r.name.trim() ? r.name.trim().slice(0, 60) : W.t('Regla'),
      enabled: r.enabled !== false,
      trigger: { type: r.trigger.type, time: isTime(r.trigger.time) ? r.trigger.time : (r.trigger.type === 'daily' ? '07:00' : null) },
      conditions: (Array.isArray(r.conditions) ? r.conditions : []).slice(0, 10).filter(function (c) { return c && typeof c.field === 'string' && typeof c.op === 'string'; })
        .map(function (c) { return { field: c.field.slice(0, 20), op: c.op.slice(0, 20), value: simple(c.value) }; }),
      actions: (Array.isArray(r.actions) ? r.actions : []).slice(0, 8).filter(function (a) { return a && typeof a.type === 'string'; })
        .map(function (a) { return { type: a.type.slice(0, 20), value: simple(a.value), value2: simple(a.value2) }; }),
      template: typeof r.template === 'string' ? r.template.slice(0, 30) : null,
      runs: typeof r.runs === 'number' ? r.runs : 0,
      lastRun: typeof r.lastRun === 'number' ? r.lastRun : null,
      createdAt: typeof r.createdAt === 'number' ? r.createdAt : Date.now(),
      updatedAt: typeof r.updatedAt === 'number' ? r.updatedAt : Date.now()
    };
  }
  function cleanRules(arr) { return (Array.isArray(arr) ? arr : []).map(cleanRule).filter(Boolean); }

  /* ---------- Listas personalizadas (filtros guardados) ---------- */
  var FILTER_WHEN = { any: 1, today: 1, week: 1, next7: 1, overdue: 1, nodate: 1, dated: 1 };
  function cleanFilter(f, i) {
    if (!f || typeof f.name !== 'string' || !f.name.trim()) return null;
    var ids = function (a) { return Array.isArray(a) ? a.filter(function (x) { return typeof x === 'string'; }).slice(0, 40) : []; };
    return {
      id: typeof f.id === 'string' ? f.id : U.uid('f'),
      name: f.name.trim().slice(0, 24),
      lists: ids(f.lists),
      priorities: ids(f.priorities).filter(function (x) { return PRIORITIES[x]; }),
      when: FILTER_WHEN[f.when] ? f.when : 'any',
      text: typeof f.text === 'string' ? f.text.trim().slice(0, 40) : '',
      status: f.status === 'all' || f.status === 'done' ? f.status : 'pending',
      order: typeof f.order === 'number' ? f.order : (i || 0),
      createdAt: typeof f.createdAt === 'number' ? f.createdAt : Date.now(),
      updatedAt: typeof f.updatedAt === 'number' ? f.updatedAt : Date.now()
    };
  }
  function cleanFilters(arr) {
    var out = [];
    (Array.isArray(arr) ? arr : []).forEach(function (f, i) { var c = cleanFilter(f, i); if (c) out.push(c); });
    return out.sort(function (a, b) { return a.order - b.order; });
  }

  /* ---------- Apuntes ---------- */
  function cleanNote(n) {
    if (!n || typeof n.id !== 'string') return null;
    var title = typeof n.title === 'string' ? n.title.slice(0, 120) : '', body = typeof n.body === 'string' ? n.body.slice(0, 20000) : '';
    if (!title.trim() && !body.trim()) return null;
    return {
      id: n.id, title: title, body: body,
      listId: typeof n.listId === 'string' ? n.listId : null,
      pinned: !!n.pinned,
      createdAt: typeof n.createdAt === 'number' ? n.createdAt : Date.now(),
      updatedAt: typeof n.updatedAt === 'number' ? n.updatedAt : Date.now()
    };
  }
  function cleanNotes(arr) { return (Array.isArray(arr) ? arr : []).map(cleanNote).filter(Boolean); }

  /* ---------- Personaje, amigos y dispositivos ---------- */
  // Especies retiradas en la 1.0: quien tuviera una vuelve a la de siempre
  var RETIRED_BODIES = { gema: 1, dragon: 1, astronauta: 1, fenix: 1, unicornio: 1 };
  function cleanCharacter(c) {
    var out = {};
    if (c && typeof c === 'object') Object.keys(c).forEach(function (k) {
      if (!/^[a-z]{2,12}$/.test(k)) return;
      var v = c[k];
      if (typeof v === 'string') out[k] = v.slice(0, k === 'name' ? 16 : 24);
      else if (typeof v === 'number' && isFinite(v)) out[k] = v;
      else if (typeof v === 'boolean') out[k] = v;
    });
    if (out.body && RETIRED_BODIES[out.body]) delete out.body;
    if (typeof out.at !== 'number') out.at = 0;
    return out;
  }
  function cleanSocial(s) {
    var out = { friends: {}, devices: {}, focus: null, cheers: [], spaces: {}, code: null, enabled: false, enabledAt: 0, invites: {}, chats: {} };
    if (!s || typeof s !== 'object') return out;
    if (typeof s.code === 'string' && /^[A-Z0-9-]{4,16}$/.test(s.code)) out.code = s.code;
    out.enabled = !!s.enabled; out.enabledAt = typeof s.enabledAt === 'number' ? s.enabledAt : 0;
    if (s.spaces && typeof s.spaces === 'object') Object.keys(s.spaces).forEach(function (id) {
      var x = s.spaces[id];
      if (x && typeof x.at === 'number' && /^[A-Za-z0-9_-]{4,40}$/.test(id)) out.spaces[id] = { name: typeof x.name === 'string' ? x.name.slice(0, 40) : W.t('Espacio'), at: x.at, left: !!x.left, icon: typeof x.icon === 'string' ? x.icon.slice(0, 20) : '' };
    });
    if (s.friends && typeof s.friends === 'object') Object.keys(s.friends).forEach(function (uid) {
      var f = s.friends[uid];
      if (f && typeof f.at === 'number') out.friends[uid] = { name: typeof f.name === 'string' ? f.name.slice(0, 40) : '', code: typeof f.code === 'string' ? f.code.slice(0, 12) : '', at: f.at, removed: !!f.removed, kind: f.kind === 'work' ? 'work' : 'friend', pending: !!f.pending };
    });
    if (s.devices && typeof s.devices === 'object') Object.keys(s.devices).forEach(function (id) {
      var d = s.devices[id];
      if (d && typeof d.seen === 'number') out.devices[id] = { name: typeof d.name === 'string' ? d.name.slice(0, 40) : W.t('Dispositivo'), kind: d.kind === 'pc' ? 'pc' : 'mobile', seen: d.seen };
    });
    if (s.focus && typeof s.focus === 'object' && typeof s.focus.at === 'number') {
      var f0 = s.focus;
      out.focus = { mode: f0.mode === 'short' || f0.mode === 'long' ? f0.mode : 'work', running: !!f0.running, endAt: typeof f0.endAt === 'number' ? f0.endAt : 0,
        remaining: typeof f0.remaining === 'number' ? f0.remaining : null, round: typeof f0.round === 'number' ? f0.round : 1,
        taskId: typeof f0.taskId === 'string' ? f0.taskId : null, at: f0.at, device: typeof f0.device === 'string' ? f0.device : '' };
    }
    if (Array.isArray(s.cheers)) out.cheers = s.cheers.filter(function (c) { return c && typeof c.at === 'number'; }).slice(-30);
    // Invitaciones por enlace o QR que has creado (la clave secreta va en el enlace)
    if (s.invites && typeof s.invites === 'object') Object.keys(s.invites).forEach(function (k) {
      var v = s.invites[k];
      if (/^[A-Za-z0-9]{6,24}$/.test(k) && v && typeof v.at === 'number') out.invites[k] = { at: v.at, kind: v.kind === 'work' ? 'work' : 'friend', uses: typeof v.uses === 'number' ? v.uses : 0, off: !!v.off };
    });
    // Preferencias de cada chat: leído hasta, silenciado y fijado
    if (s.chats && typeof s.chats === 'object') Object.keys(s.chats).forEach(function (k) {
      var v = s.chats[k];
      if (/^[A-Za-z0-9_-]{4,80}$/.test(k) && v && typeof v === 'object') out.chats[k] = { read: typeof v.read === 'number' ? v.read : 0, muted: !!v.muted, pinned: !!v.pinned, at: typeof v.at === 'number' ? v.at : 0, hidden: !!v.hidden };
    });
    return out;
  }
  function cleanTemplates(arr) {
    return (Array.isArray(arr) ? arr : []).filter(function (t) { return t && typeof t.id === 'string' && typeof t.name === 'string' && t.name.trim(); }).map(function (t) {
      return {
        id: t.id, name: t.name.trim().slice(0, 40), icon: typeof t.icon === 'string' ? t.icon.slice(0, 20) : 'bolt',
        tasks: (Array.isArray(t.tasks) ? t.tasks : []).filter(function (x) { return x && typeof x.text === 'string' && x.text.trim(); }).slice(0, 20).map(function (x) {
          return { text: x.text.trim().slice(0, 160), time: isTime(x.time) ? x.time : null, highlight: PRIORITIES[x.highlight] ? x.highlight : 'none', listId: typeof x.listId === 'string' ? x.listId : null };
        }),
        order: typeof t.order === 'number' ? t.order : 0,
        createdAt: typeof t.createdAt === 'number' ? t.createdAt : Date.now(),
        updatedAt: typeof t.updatedAt === 'number' ? t.updatedAt : Date.now()
      };
    });
  }

  function isOverdue(t, now) {
    if (t.done || !t.date) return false;
    return (now || Date.now()) >= U.deadlineTs(t.date, t.time);
  }

  function nextDate(t) {
    var base = t.date || U.today();
    switch (t.repeat) {
      case 'daily': return U.addDays(base, 1);
      case 'weekly': return U.addDays(base, 7);
      case 'monthly': return U.addMonths(base, 1);
      case 'weekdays':
        var d = U.addDays(base, 1);
        while (U.weekday(d) === 0 || U.weekday(d) === 6) d = U.addDays(d, 1);
        return d;
      default: return null;
    }
  }

  W.Schema = {
    ACCENTS: ACCENTS,
    LIST_TINTS: LIST_TINTS,
    PRIORITIES: PRIORITIES,
    REPEATS: REPEATS,
    DEFAULT_SETTINGS: DEFAULT_SETTINGS,
    DEFAULT_LISTS: DEFAULT_LISTS,
    DEFAULT_LIST_ICON: DEFAULT_LIST_ICON,
    cleanIcon: cleanIcon,
    clone: clone,
    mergeTyped: mergeTyped,
    isDate: isDate,
    isTime: isTime,
    FT_KEYS: FT_KEYS,
    FT_DAYS: FT_DAYS,
    cleanFt: cleanFt,
    changedFields: changedFields,
    stampFields: stampFields,
    cleanTask: cleanTask,
    cleanTasks: cleanTasks,
    cleanLists: cleanLists,
    SAMPLE_TEXTS: SAMPLE_TEXTS,
    normText: normText,
    isSampleText: isSampleText,
    sampleIds: sampleIds,
    purgeSamples: purgeSamples,
    emptyRecords: emptyRecords,
    cleanRecords: cleanRecords,
    HABIT_FREQS: HABIT_FREQS,
    cleanHabit: cleanHabit,
    cleanHabits: cleanHabits,
    cleanHabitLog: cleanHabitLog,
    RULE_TRIGGERS: RULE_TRIGGERS,
    cleanRule: cleanRule,
    cleanRules: cleanRules,
    FILTER_WHEN: FILTER_WHEN,
    cleanFilter: cleanFilter,
    cleanFilters: cleanFilters,
    cleanNote: cleanNote,
    cleanNotes: cleanNotes,
    RETIRED_BODIES: RETIRED_BODIES,
    cleanCharacter: cleanCharacter,
    cleanSocial: cleanSocial,
    cleanTemplates: cleanTemplates,
    isOverdue: isOverdue,
    nextDate: nextDate
  };
})(window.Whider);
