/**
 * WHIDER · Estado de la aplicación, persistencia, migración y métricas
 */
window.Whider = window.Whider || {};

(function (W) {
  'use strict';

  var U = W.U;
  var KEYS = {
    tasks: 'whider.v1',             // Se conserva la clave original: los datos de versiones anteriores siguen funcionando
    settings: 'whider.settings.v2',
    legacySettings: 'whider.settings.v1',
    profile: 'whider.profile.v1',
    lists: 'whider.lists.v1',
    focus: 'whider.focus.v1',
    meta: 'whider.meta.v1',
    doneLog: 'whider.donelog.v1',   // Historial permanente de tareas completadas por día
    records: 'whider.records.v1',   // Marcas automáticas y personales
    habits: 'whider.habits.v1',     // Hábitos y su registro diario
    notes: 'whider.notes.v1',       // Apuntes
    plan: 'whider.plan.v1',         // Plan (Gratis o Premium)
    character: 'whider.character.v1', // Tu personaje
    social: 'whider.social.v1',     // Amigos, dispositivos y enfoque compartido
    templates: 'whider.templates.v1', // Plantillas de un toque (acciones rápidas)
    rules: 'whider.rules.v1',       // Automatizaciones
    filters: 'whider.filters.v1',   // Listas personalizadas (filtros guardados)
    sync: 'whider.sync.v1'          // Marcas de tiempo y borrados para la sincronización
  };
  var ALL_KEYS = Object.keys(KEYS).map(function (k) { return KEYS[k]; });

  /*
   * Colores de versiones anteriores. Desde la 4.4 la interfaz es en blanco y negro y no los usa,
   * pero se conservan en los datos (listas y ajustes) para que la copia en la nube siga siendo
   * compatible con dispositivos que aún tengan una versión antigua.
   */
  var ACCENTS = {
    iris:     { name: 'Iris',     a: '#7C83FF', on: '#FFFFFF' },
    indigo:   { name: 'Azul',     a: '#4C8DFF', on: '#FFFFFF' },
    violet:   { name: 'Violeta',  a: '#A98BFF', on: '#FFFFFF' },
    rose:     { name: 'Rosa',     a: '#FF6B9A', on: '#FFFFFF' },
    red:      { name: 'Coral',    a: '#FF6B5E', on: '#FFFFFF' },
    ember:    { name: 'Naranja',  a: '#FF9A4D', on: '#1A1206' },
    gold:     { name: 'Ámbar',    a: '#F5BE4B', on: '#1A1406' },
    jade:     { name: 'Verde',    a: '#3DD68C', on: '#06180F' },
    mint:     { name: 'Menta',    a: '#5EE0C8', on: '#061814' },
    aqua:     { name: 'Cian',     a: '#3CC6E0', on: '#061418' },
    brown:    { name: 'Arena',    a: '#C9A27C', on: '#1A1209' },
    graphite: { name: 'Plata',    a: '#A3AAB9', on: '#101217' }
  };

  var PRIORITIES = {
    danger: { label: 'Urgente', short: 'Urgente', rank: 0 },
    purple: { label: 'Importante', short: 'Importante', rank: 1 },
    star:   { label: 'Destacada', short: 'Destacada', rank: 2 },
    none:   { label: 'Normal', short: 'Normal', rank: 3 }
  };

  var REPEATS = {
    none: 'No se repite',
    daily: 'Cada día',
    weekdays: 'Días laborables',
    weekly: 'Cada semana',
    monthly: 'Cada mes'
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
    { id: 'personal', name: 'Personal', color: 'iris', icon: 'user' },
    { id: 'work', name: 'Trabajo', color: 'ember', icon: 'briefcase' },
    { id: 'health', name: 'Salud', color: 'jade', icon: 'heart' }
  ];
  var DEFAULT_LIST_ICON = { personal: 'user', work: 'briefcase', health: 'heart' };
  function cleanIcon(ic, id) { return typeof ic === 'string' && /^[a-z-]{2,20}$/.test(ic) ? ic : (DEFAULT_LIST_ICON[id] || 'list'); }

  /*
   * Persistencia doble: localStorage + espejo nativo en Android (SharedPreferences).
   * Si el sistema limpia el almacenamiento del WebView, los datos se recuperan del espejo.
   */
  function bridge() {
    var b = window.WhiderAndroid;
    return b && typeof b.storeGet === 'function' ? b : null;
  }
  // Último valor escrito de cada clave: solo se guarda lo que realmente cambia
  var written = {};
  // Cambios pendientes para el almacén nativo (se envían agrupados y sin bloquear)
  var nativeQueue = {}, nativeTimer = null;

  function flushNative() {
    clearTimeout(nativeTimer); nativeTimer = null;
    var keys = Object.keys(nativeQueue);
    if (!keys.length || !bridge()) { nativeQueue = {}; return; }
    var batch = nativeQueue; nativeQueue = {};
    try {
      if (typeof bridge().storeSetMany === 'function') bridge().storeSetMany(JSON.stringify(batch));
      else keys.forEach(function (k) { bridge().storeSet(k, batch[k]); });
    } catch (e) { /* sin puente */ }
  }
  function queueNative(key, raw) {
    if (!bridge()) return;
    nativeQueue[key] = raw;
    if (!nativeTimer) nativeTimer = setTimeout(flushNative, 400);
  }
  // Al salir de la app (o pasar a segundo plano) se guarda todo lo pendiente
  document.addEventListener('visibilitychange', function () { if (document.hidden) flushNative(); });
  window.addEventListener('pagehide', flushNative);

  function read(key) {
    var raw = null;
    try { raw = localStorage.getItem(key); } catch (e) { raw = null; }
    if (raw == null && bridge()) {
      try { raw = bridge().storeGet(key) || null; } catch (e) { raw = null; }
      if (raw != null) { try { localStorage.setItem(key, raw); } catch (e) { /* sin espacio */ } }
    }
    if (raw != null) written[key] = raw;
    try { return raw ? JSON.parse(raw) : null; } catch (e) { return null; }
  }
  function write(key, value) {
    var raw = JSON.stringify(value);
    if (written[key] === raw) return;
    written[key] = raw;
    try { localStorage.setItem(key, raw); } catch (e) { /* almacenamiento lleno o bloqueado */ }
    queueNative(key, raw);
  }
  function remove(key) {
    delete written[key];
    try { localStorage.removeItem(key); } catch (e) { /* bloqueado */ }
    queueNative(key, null);
  }
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
      subtasks: subs,
      focusMin: typeof item.focusMin === 'number' ? item.focusMin : 0,
      duration: typeof item.duration === 'number' && item.duration >= 5 && item.duration <= 720 ? Math.round(item.duration) : null,
      createdAt: typeof item.createdAt === 'number' ? item.createdAt : Date.now(),
      updatedAt: typeof item.updatedAt === 'number' ? item.updatedAt : (typeof item.createdAt === 'number' ? item.createdAt : Date.now()),
      example: !!item.example,
      mine: !!item.mine
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
      .map(function (l) { return { id: l.id, name: l.name.trim().slice(0, 24), color: ACCENTS[l.color] ? l.color : 'iris', icon: cleanIcon(l.icon, l.id) }; });
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

  /* ---------- Carga inicial y migración ---------- */
  var savedSettings = read(KEYS.settings);
  var settings = mergeTyped(DEFAULT_SETTINGS, savedSettings);
  if (!savedSettings) {
    var legacy = read(KEYS.legacySettings);
    if (legacy) {
      if (typeof legacy.sound === 'boolean') settings.sound = legacy.sound;
      if (typeof legacy.vibrate === 'boolean') settings.vibrate = legacy.vibrate;
    }
  }
  if (!ACCENTS[settings.accent]) settings.accent = 'iris';

  var lists = cleanLists(read(KEYS.lists));
  var storedTasks = read(KEYS.tasks);
  var isNewUser = !(storedTasks && Array.isArray(storedTasks.tasks));
  var tasks = isNewUser ? [] : cleanTasks(storedTasks.tasks, lists);
  var syncMeta = Object.assign({ deleted: {}, settingsAt: 0, listsAt: 0, profileAt: 0 }, read(KEYS.sync) || {});
  if (!syncMeta.deleted || typeof syncMeta.deleted !== 'object') syncMeta.deleted = {};
  var tasksBefore = tasks.length;
  tasks = purgeSamples(tasks, syncMeta.deleted);
  var purgedOnLoad = tasks.length !== tasksBefore;
  var meta = Object.assign({ onboarded: false, createdAt: Date.now(), celebrated: null, seenAchievements: [], owner: null, guest: false }, read(KEYS.meta) || {});
  var focusLog = read(KEYS.focus) || {};
  var profile = read(KEYS.profile) || {};
  if (!Array.isArray(meta.seenAchievements)) meta.seenAchievements = [];

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
      name: typeof r.name === 'string' && r.name.trim() ? r.name.trim().slice(0, 60) : 'Regla',
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

  /* ---------- Plan, personaje, amigos y dispositivos ---------- */
  var FREE_PLAN = { tier: 'free', source: null, until: null, trialUsed: false, code: null, at: 0 };
  function cleanPlan(p) {
    if (!p || typeof p !== 'object') return clone(FREE_PLAN);
    return {
      tier: p.tier === 'premium' ? 'premium' : 'free',
      source: p.source === 'trial' || p.source === 'code' || p.source === 'purchase' ? p.source : null,
      until: typeof p.until === 'number' ? p.until : null,
      trialUsed: !!p.trialUsed,
      code: typeof p.code === 'string' ? p.code.slice(0, 12) : null,
      at: typeof p.at === 'number' ? p.at : 0
    };
  }
  function cleanCharacter(c) {
    var out = {};
    if (c && typeof c === 'object') Object.keys(c).forEach(function (k) {
      if (!/^[a-z]{2,12}$/.test(k)) return;
      var v = c[k];
      if (typeof v === 'string') out[k] = v.slice(0, k === 'name' ? 16 : 24);
      else if (typeof v === 'number' && isFinite(v)) out[k] = v;
      else if (typeof v === 'boolean') out[k] = v;
    });
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
      if (x && typeof x.at === 'number' && /^[A-Za-z0-9_-]{4,40}$/.test(id)) out.spaces[id] = { name: typeof x.name === 'string' ? x.name.slice(0, 40) : 'Espacio', at: x.at, left: !!x.left, icon: typeof x.icon === 'string' ? x.icon.slice(0, 20) : '' };
    });
    if (s.friends && typeof s.friends === 'object') Object.keys(s.friends).forEach(function (uid) {
      var f = s.friends[uid];
      if (f && typeof f.at === 'number') out.friends[uid] = { name: typeof f.name === 'string' ? f.name.slice(0, 40) : '', code: typeof f.code === 'string' ? f.code.slice(0, 12) : '', at: f.at, removed: !!f.removed, kind: f.kind === 'work' ? 'work' : 'friend', pending: !!f.pending };
    });
    if (s.devices && typeof s.devices === 'object') Object.keys(s.devices).forEach(function (id) {
      var d = s.devices[id];
      if (d && typeof d.seen === 'number') out.devices[id] = { name: typeof d.name === 'string' ? d.name.slice(0, 40) : 'Dispositivo', kind: d.kind === 'pc' ? 'pc' : 'mobile', seen: d.seen };
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

  // Historial diario permanente: no depende de que las tareas sigan existiendo
  var doneLog = read(KEYS.doneLog);
  if (!doneLog || typeof doneLog !== 'object') doneLog = {};
  /** El historial nunca cuenta menos que las tareas completadas que siguen existiendo (se autocorrige) */
  function healDoneLog(list) {
    var counts = {};
    list.forEach(function (t) { if (t.done && t.doneOn) counts[t.doneOn] = (counts[t.doneOn] || 0) + 1; });
    Object.keys(counts).forEach(function (d) { if ((doneLog[d] || 0) < counts[d]) doneLog[d] = counts[d]; });
  }
  healDoneLog(tasks);
  var records = cleanRecords(read(KEYS.records));
  var storedHabits = read(KEYS.habits) || {};
  var habits = cleanHabits(storedHabits.habits);
  var habitLog = cleanHabitLog(storedHabits.log);
  var rules = cleanRules(read(KEYS.rules));
  var notes = cleanNotes(read(KEYS.notes));
  var planData = cleanPlan(read(KEYS.plan));
  var character = cleanCharacter(read(KEYS.character));
  var social = cleanSocial(read(KEYS.social));
  var templates = cleanTemplates(read(KEYS.templates));
  if (!meta.achievedAt || typeof meta.achievedAt !== 'object') meta.achievedAt = {};
  var filters = cleanFilters(read(KEYS.filters));

  var subscribers = [];
  var batching = 0, batchReason = null;

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

  var State = {
    KEYS: KEYS,
    /** Lectura y escritura con el espejo nativo de Android (lo usa también el Cuaderno) */
    storage: { read: read, write: write, remove: remove, flush: function () { flushNative(); } },
    ACCENTS: ACCENTS,
    PRIORITIES: PRIORITIES,
    REPEATS: REPEATS,
    DEFAULT_SETTINGS: DEFAULT_SETTINGS,
    tasks: tasks,
    lists: lists,
    settings: settings,
    meta: meta,
    records: records,
    habits: habits,
    habitLog: habitLog,
    rules: rules,
    filters: filters,
    notes: notes,
    plan: planData,
    character: character,
    social: social,
    templates: templates,
    syncMeta: syncMeta,
    isNewUser: isNewUser,
    activeScreen: null,
    ui: { filter: 'all', query: '', listFilter: null, calMonth: null, calSelected: U.today() },

    /* ---------- Suscripción ---------- */
    subscribe: function (fn) {
      subscribers.push(fn);
      return function () { subscribers = subscribers.filter(function (s) { return s !== fn; }); };
    },
    notify: function (reason) {
      if (batching) { batchReason = reason || 'change'; return; }
      State.save();
      subscribers.forEach(function (fn) { try { fn(reason || 'change'); } catch (e) { console.error(e); } });
    },
    /** Agrupa varios cambios: se guarda y se avisa una sola vez al terminar */
    batch: function (fn) {
      batching++;
      try { return fn(); } finally {
        batching--;
        if (!batching && batchReason) { var r = batchReason; batchReason = null; State.notify(r); }
      }
    },
    save: function () {
      write(KEYS.tasks, { tasks: State.tasks });
      write(KEYS.settings, State.settings);
      write(KEYS.lists, State.lists);
      write(KEYS.meta, State.meta);
      write(KEYS.focus, focusLog);
      write(KEYS.doneLog, doneLog);
      write(KEYS.records, State.records);
      write(KEYS.habits, { habits: State.habits, log: State.habitLog });
      write(KEYS.rules, State.rules);
      write(KEYS.filters, State.filters);
      write(KEYS.notes, State.notes);
      write(KEYS.plan, State.plan);
      write(KEYS.character, State.character);
      write(KEYS.social, State.social);
      write(KEYS.templates, State.templates);
      write(KEYS.sync, State.syncMeta);
    },
    saveSettings: function (reason) {
      State.syncMeta.settingsAt = Date.now();
      write(KEYS.settings, State.settings);
      State.notify(reason || 'settings');
    },
    touch: function (t) { t.updatedAt = Date.now(); return t; },
    markDeleted: function (key) { State.syncMeta.deleted[key] = Date.now(); },

    /* ---------- Instantánea completa (sincronización en la nube) ---------- */
    snapshot: function () {
      return {
        v: 1,
        tasks: State.tasks, lists: State.lists, settings: State.settings,
        focus: focusLog, doneLog: doneLog, records: State.records,
        habits: State.habits, habitLog: State.habitLog, rules: State.rules, filters: State.filters,
        notes: State.notes, plan: State.plan, character: State.character, social: State.social, templates: State.templates,
        profile: { name: profile.name || '', email: profile.email || '', photo: profile.photo || '', photoURL: profile.photoURL || '', avatar: profile.avatar || '' },
        meta: { createdAt: State.meta.createdAt, seenAchievements: State.meta.seenAchievements, achievedAt: State.meta.achievedAt, onboarded: !!State.meta.onboarded },
        sync: State.syncMeta
      };
    },
    /** Sustituye el estado local por uno ya fusionado */
    applySnapshot: function (snap, reason) {
      if (!snap) return;
      State.lists = cleanLists(snap.lists);
      State.syncMeta = Object.assign({ deleted: {}, settingsAt: 0, listsAt: 0, profileAt: 0 }, snap.sync || {});
      State.syncMeta.deleted = Object.assign({}, State.syncMeta.deleted);
      var incoming = cleanTasks(snap.tasks, State.lists);
      State.tasks = purgeSamples(incoming, State.syncMeta.deleted);
      var purged = State.tasks.length !== incoming.length;
      if (snap.settings) State.settings = mergeTyped(DEFAULT_SETTINGS, snap.settings);
      focusLog = snap.focus && typeof snap.focus === 'object' ? snap.focus : {};
      doneLog = snap.doneLog && typeof snap.doneLog === 'object' ? snap.doneLog : {};
      healDoneLog(State.tasks);
      State.records = cleanRecords(snap.records);
      State.habits = cleanHabits(snap.habits);
      State.habitLog = cleanHabitLog(snap.habitLog);
      State.rules = cleanRules(snap.rules);
      State.filters = cleanFilters(snap.filters);
      State.notes = cleanNotes(snap.notes);
      if (snap.plan) State.plan = cleanPlan(snap.plan);
      if (snap.character) State.character = cleanCharacter(snap.character);
      if (snap.social) State.social = cleanSocial(snap.social);
      State.templates = cleanTemplates(snap.templates);
      if (snap.profile) {
        var sp = snap.profile;
        profile = Object.assign({}, profile, {
          name: sp.name || profile.name || '', email: sp.email || profile.email || '',
          photo: typeof sp.photo === 'string' ? sp.photo : (profile.photo || ''),
          photoURL: typeof sp.photoURL === 'string' && sp.photoURL ? sp.photoURL : (profile.photoURL || ''),
          avatar: typeof sp.avatar === 'string' ? sp.avatar : (profile.avatar || '')
        });
        write(KEYS.profile, profile);
      }
      if (snap.meta) {
        if (snap.meta.createdAt) State.meta.createdAt = Math.min(State.meta.createdAt || Date.now(), snap.meta.createdAt);
        if (Array.isArray(snap.meta.seenAchievements)) State.meta.seenAchievements = snap.meta.seenAchievements;
        if (snap.meta.achievedAt && typeof snap.meta.achievedAt === 'object') State.meta.achievedAt = Object.assign({}, snap.meta.achievedAt);
        if (snap.meta.onboarded) State.meta.onboarded = true;
      }
      // Si llegaron tareas de ejemplo de la nube, se borran y el borrado se sube enseguida
      State.notify(purged ? 'purge' : (reason || 'sync'));
    },
    /** Borra los datos de este dispositivo (al cerrar sesión o cambiar de cuenta) */
    clearLocal: function () {
      ALL_KEYS.forEach(remove);
      remove('whider.focus.timer');
      if (W.Pages) W.Pages.clearLocal();
      profile = {};
      State.tasks = []; State.lists = cleanLists(null); State.settings = clone(DEFAULT_SETTINGS);
      focusLog = {}; doneLog = {}; State.records = emptyRecords();
      State.habits = []; State.habitLog = {}; State.rules = []; State.filters = [];
      State.notes = []; State.plan = clone(FREE_PLAN); State.character = cleanCharacter(null); State.social = cleanSocial(null); State.templates = [];
      State.syncMeta = { deleted: {}, settingsAt: 0, listsAt: 0, profileAt: 0 };
      State.meta = { onboarded: false, createdAt: Date.now(), celebrated: null, seenAchievements: [], achievedAt: {}, owner: null, guest: false };
      State.save();
      State.notify('reset');
    },

    /* ---------- Perfil ---------- */
    getProfile: function () { return profile; },
    /**
     * Cambia el perfil. Con { stamp: false } no cuenta como edición del usuario
     * (p. ej. datos traídos de Google): así nunca pisa un nombre elegido en otro dispositivo.
     */
    setProfile: function (p, opts) {
      profile = Object.assign({}, profile, p, { updatedAt: new Date().toISOString() });
      if (!opts || opts.stamp !== false) State.syncMeta.profileAt = Date.now();
      write(KEYS.profile, profile);
      write(KEYS.sync, State.syncMeta);
      State.notify('profile');
    },
    displayName: function () { return profile && profile.name ? String(profile.name).trim() : ''; },
    /** Foto de perfil: la elegida por el usuario o, si no, la de su cuenta de Google */
    photo: function () { return (profile && (profile.photo || profile.photoURL)) || ''; },
    initial: function () { return (State.displayName() || 'W').charAt(0).toUpperCase(); },
    flush: function () { State.save(); flushNative(); },

    /* ---------- Listas ---------- */
    getList: function (id) {
      for (var i = 0; i < State.lists.length; i++) if (State.lists[i].id === id) return State.lists[i];
      return null;
    },
    addList: function (name, color, icon) {
      var l = { id: U.uid('l'), name: name.trim().slice(0, 24), color: ACCENTS[color] ? color : 'iris', icon: cleanIcon(icon) };
      State.lists.push(l);
      State.syncMeta.listsAt = Date.now();
      State.notify('lists');
      return l;
    },
    updateList: function (id, fields) {
      var l = State.getList(id);
      if (!l) return;
      if (fields.name && fields.name.trim()) l.name = fields.name.trim().slice(0, 24);
      if (fields.color && ACCENTS[fields.color]) l.color = fields.color;
      if (fields.icon) l.icon = cleanIcon(fields.icon, l.id);
      State.syncMeta.listsAt = Date.now();
      State.notify('lists');
    },
    removeList: function (id) {
      if (State.lists.length <= 1) return false;
      State.lists = State.lists.filter(function (l) { return l.id !== id; });
      State.tasks.forEach(function (t) { if (t.listId === id) t.listId = null; });
      if (State.settings.defaultList === id) State.settings.defaultList = State.lists[0].id;
      if (State.ui.listFilter === id) State.ui.listFilter = null;
      State.syncMeta.listsAt = Date.now();
      State.notify('lists');
      return true;
    },

    /* ---------- Tareas ---------- */
    find: function (id) {
      for (var i = 0; i < State.tasks.length; i++) if (State.tasks[i].id === id) return State.tasks[i];
      return null;
    },
    addTask: function (fields) {
      var listIds = {}; State.lists.forEach(function (l) { listIds[l.id] = true; });
      // "mine": escrita por el usuario; nunca se confunde con una tarea de ejemplo
      var t = cleanTask(Object.assign({ id: U.uid(), createdAt: Date.now() }, fields, { mine: true }), listIds);
      if (!t) return null;
      State.tasks.push(t);
      State.notify('add');
      return t;
    },
    updateTask: function (id, fields) {
      var t = State.find(id);
      if (!t) return null;
      var oldDeadline = (t.date || '') + ' ' + (t.time || '');
      var merged = Object.assign({}, t, fields);
      var listIds = {}; State.lists.forEach(function (l) { listIds[l.id] = true; });
      var c = cleanTask(merged, listIds);
      if (!c) return null;
      Object.keys(c).forEach(function (k) { t[k] = c[k]; });
      // Un nuevo plazo rearma los avisos
      if ((t.date || '') + ' ' + (t.time || '') !== oldDeadline) { t.warnedAt = null; t.remindedAt = null; }
      t.updatedAt = Date.now();
      State.notify('update');
      return t;
    },
    /**
     * Marca/desmarca una tarea. Si se repite, al completarla se crea la siguiente;
     * si se desmarca, se elimina la siguiente que generó (si sigue intacta).
     */
    setDone: function (id, done) {
      var t = State.find(id);
      if (!t || t.done === !!done) return t;
      if (!done && t.doneOn && doneLog[t.doneOn]) doneLog[t.doneOn] = Math.max(0, doneLog[t.doneOn] - 1);
      t.done = !!done;
      t.doneOn = t.done ? U.today() : null;
      t.doneAt = t.done ? Date.now() : null;
      if (t.done) doneLog[t.doneOn] = (doneLog[t.doneOn] || 0) + 1;
      t.updatedAt = Date.now();
      if (t.done && t.repeat !== 'none' && !t.spawnedId) {
        var nd = nextDate(t);
        if (nd) {
          var next = cleanTask(Object.assign({}, t, {
            id: U.uid(), date: nd, done: false, doneOn: null, doneAt: null, warnedAt: null, remindedAt: null,
            spawnedId: null, focusMin: 0, createdAt: Date.now(), example: false,
            subtasks: t.subtasks.map(function (s) { return { text: s.text, done: false }; })
          }));
          if (next) { State.tasks.push(next); t.spawnedId = next.id; }
        }
      } else if (!t.done && t.spawnedId) {
        var sp = State.find(t.spawnedId);
        if (sp && !sp.done) { State.tasks = State.tasks.filter(function (x) { return x.id !== sp.id; }); State.markDeleted(sp.id); }
        t.spawnedId = null;
      }
      State.notify(t.done ? 'done' : 'undone');
      return t;
    },
    toggleSubtask: function (id, subId) {
      var t = State.find(id);
      if (!t) return;
      t.subtasks.forEach(function (s) { if (s.id === subId) s.done = !s.done; });
      t.updatedAt = Date.now();
      State.notify('update');
    },
    removeTask: function (id) {
      var idx = -1;
      for (var i = 0; i < State.tasks.length; i++) if (State.tasks[i].id === id) { idx = i; break; }
      if (idx < 0) return null;
      var removed = State.tasks.splice(idx, 1)[0];
      State.markDeleted(removed.id);
      State.notify('remove');
      return { task: removed, index: idx };
    },
    restoreTask: function (snapshot) {
      if (!snapshot || !snapshot.task || State.find(snapshot.task.id)) return;
      delete State.syncMeta.deleted[snapshot.task.id];
      snapshot.task.updatedAt = Date.now();
      State.tasks.splice(Math.min(snapshot.index, State.tasks.length), 0, snapshot.task);
      State.notify('restore');
    },
    snooze: function (id, minutes) {
      var t = State.find(id);
      if (!t) return;
      var d = new Date(Date.now() + minutes * 60000);
      t.date = U.ymd(d);
      t.time = U.pad(d.getHours()) + ':' + U.pad(d.getMinutes());
      t.warnedAt = null; t.remindedAt = null; t.updatedAt = Date.now();
      State.notify('update');
    },
    moveToTomorrow: function (id) {
      var t = State.find(id);
      if (!t) return;
      t.date = U.addDays(U.today(), 1);
      t.warnedAt = null; t.remindedAt = null; t.updatedAt = Date.now();
      State.notify('update');
    },
    clearCompleted: function () {
      var n = State.tasks.filter(function (t) { return t.done; }).length;
      State.tasks.forEach(function (t) { if (t.done) State.markDeleted(t.id); });
      State.tasks = State.tasks.filter(function (t) { return !t.done; });
      State.notify('clear');
      return n;
    },
    resetAll: function () {
      State.tasks.forEach(function (t) { State.markDeleted(t.id); });
      State.tasks = [];
      focusLog = {};
      doneLog = {};
      State.records = emptyRecords();
      State.habits.forEach(function (h) { State.markDeleted('habit:' + h.id); });
      State.habits = []; State.habitLog = {};
      State.notes.forEach(function (n) { State.markDeleted('note:' + n.id); });
      State.notes = [];
      if (W.Pages) W.Pages.resetAll();
      State.syncMeta.resetAt = Date.now();
      State.meta.celebrated = null;
      State.meta.seenAchievements = [];
      State.notify('reset');
    },

    /* ---------- Consultas ---------- */
    /**
     * Próximas fechas de una tarea que se repite (solo pendientes y desde hoy), para verlas en el
     * calendario aunque todavía no existan como tarea. occurrences(t, desde, hasta, máximo)
     */
    occurrences: function (t, from, to, max) {
      if (!t || t.done || !t.date || !REPEATS[t.repeat] || t.repeat === 'none') return [];
      var out = [], k = 1, d = t.date, guard = 0, td = U.today();
      if (from < td) from = td;
      max = max || 62;
      while (out.length < max && guard++ < 1500) {
        if (t.repeat === 'weekdays') {
          d = U.addDays(d, 1);
          var wd = U.weekday(d);
          if (wd === 0 || wd === 6) { if (d > to) break; continue; }
        } else d = t.repeat === 'daily' ? U.addDays(t.date, k) : t.repeat === 'weekly' ? U.addDays(t.date, 7 * k) : U.addMonths(t.date, k);
        k++;
        if (d > to) break;
        if (d >= from && d > t.date) out.push(d);
      }
      return out;
    },
    isOverdue: function (t) { return isOverdue(t); },
    pending: function () { return State.tasks.filter(function (t) { return !t.done; }); },
    forDate: function (d) { return State.tasks.filter(function (t) { return t.date === d; }); },
    todayTasks: function () { return State.forDate(U.today()); },
    overdueWarnings: function () {
      var now = Date.now();
      return State.tasks.filter(function (t) { return t.warn && isOverdue(t, now); });
    },
    overdueAll: function () {
      var now = Date.now();
      return State.tasks.filter(function (t) { return isOverdue(t, now); });
    },
    upcomingWarnings: function () {
      var now = Date.now();
      return State.tasks.filter(function (t) { return t.warn && !t.done && !isOverdue(t, now); })
        .sort(State.compareDeadline);
    },
    compareDeadline: function (a, b) {
      var da = a.date ? U.deadlineTs(a.date, a.time) : Infinity;
      var db = b.date ? U.deadlineTs(b.date, b.time) : Infinity;
      if (da !== db) return da < db ? -1 : 1;
      return PRIORITIES[a.highlight].rank - PRIORITIES[b.highlight].rank;
    },
    comparePriority: function (a, b) {
      var r = PRIORITIES[a.highlight].rank - PRIORITIES[b.highlight].rank;
      return r || State.compareDeadline(a, b);
    },
    /** Siguiente tarea relevante: vencida más antigua o la próxima con plazo, si no la de más prioridad */
    nextTask: function () {
      var p = State.pending().filter(function (t) { return !t.date || t.date <= U.today(); });
      if (!p.length) p = State.pending();
      return p.sort(function (a, b) {
        var ao = isOverdue(a) ? 0 : 1, bo = isOverdue(b) ? 0 : 1;
        if (ao !== bo) return ao - bo;
        return State.compareDeadline(a, b);
      })[0] || null;
    },

    /* ---------- Enfoque ---------- */
    addFocus: function (minutes, taskId) {
      var d = U.today();
      var entry = focusLog[d] || { min: 0, sessions: 0 };
      entry.min += minutes; entry.sessions += 1;
      focusLog[d] = entry;
      var t = taskId ? State.find(taskId) : null;
      if (t) { t.focusMin += minutes; t.updatedAt = Date.now(); }
      State.notify('focus');
    },
    focusOn: function (d) { return focusLog[d] || { min: 0, sessions: 0 }; },
    focusTotals: function () {
      var min = 0, sessions = 0;
      Object.keys(focusLog).forEach(function (k) { min += focusLog[k].min || 0; sessions += focusLog[k].sessions || 0; });
      return { min: min, sessions: sessions };
    },

    /* ---------- Métricas ---------- */
    /** Completadas por día (historial permanente, sobrevive al borrado de tareas) */
    doneByDay: function () {
      var map = {};
      Object.keys(doneLog).forEach(function (d) { if (doneLog[d] > 0) map[d] = doneLog[d]; });
      return map;
    },
    totalDone: function () {
      return Object.keys(doneLog).reduce(function (a, d) { return a + (doneLog[d] || 0); }, 0);
    },
    streak: function () {
      var seen = State.doneByDay(), td = U.today();
      var cur = seen[td] ? td : U.addDays(td, -1), n = 0;
      while (seen[cur]) { n++; cur = U.addDays(cur, -1); }
      return n;
    },
    bestStreak: function () {
      var days = Object.keys(State.doneByDay()).sort(), best = 0, run = 0, prev = null;
      days.forEach(function (d) {
        run = prev && U.addDays(prev, 1) === d ? run + 1 : 1;
        if (run > best) best = run;
        prev = d;
      });
      return best;
    },
    lastDays: function (n) {
      var map = State.doneByDay(), td = U.today(), out = [];
      for (var i = n - 1; i >= 0; i--) {
        var d = U.addDays(td, -i);
        out.push({ date: d, count: map[d] || 0, focus: State.focusOn(d).min, isToday: i === 0 });
      }
      return out;
    },
    stats: function () {
      var total = State.tasks.length;
      var doneNow = State.tasks.filter(function (t) { return t.done; }).length;
      var done = Math.max(State.totalDone(), doneNow);
      var today = State.todayTasks();
      var todayDone = today.filter(function (t) { return t.done; }).length;
      var ft = State.focusTotals();
      return {
        total: total, done: done, pending: total - doneNow,
        rate: total ? Math.round(doneNow / total * 100) : 0,
        todayTotal: today.length, todayDone: todayDone,
        todayPct: today.length ? Math.round(todayDone / today.length * 100) : 0,
        streak: State.streak(), bestStreak: State.bestStreak(),
        focusMin: ft.min, focusSessions: ft.sessions,
        focusToday: State.focusOn(U.today()).min,
        overdue: State.overdueAll().length
      };
    },

    focusLog: function () { return focusLog; },

    /* ---------- Ajustes ---------- */
    setSetting: function (path, value) {
      var parts = path.split('.'), obj = State.settings;
      for (var i = 0; i < parts.length - 1; i++) obj = obj[parts[i]];
      obj[parts[parts.length - 1]] = value;
      State.saveSettings('settings:' + path);
    },
    setMeta: function (k, v) { State.meta[k] = v; write(KEYS.meta, State.meta); },

    /* ---------- Hábitos ---------- */
    getHabit: function (id) {
      for (var i = 0; i < State.habits.length; i++) if (State.habits[i].id === id) return State.habits[i];
      return null;
    },
    addHabit: function (fields) {
      var order = State.habits.reduce(function (m, h) { return Math.max(m, h.order); }, -1) + 1;
      var h = cleanHabit(Object.assign({}, fields, { id: U.uid('h'), order: order, createdAt: Date.now(), updatedAt: Date.now() }));
      if (!h) return null;
      State.habits.push(h);
      State.notify('habits');
      return h;
    },
    updateHabit: function (id, fields) {
      var h = State.getHabit(id);
      if (!h) return null;
      var c = cleanHabit(Object.assign({}, h, fields, { id: h.id, createdAt: h.createdAt, updatedAt: Date.now() }));
      if (!c) return null;
      Object.keys(c).forEach(function (k) { h[k] = c[k]; });
      State.habits.sort(function (a, b) { return a.order - b.order || a.createdAt - b.createdAt; });
      State.notify('habits');
      return h;
    },
    removeHabit: function (id) {
      var h = State.getHabit(id);
      if (!h) return null;
      State.habits = State.habits.filter(function (x) { return x.id !== id; });
      var log = State.habitLog[id];
      delete State.habitLog[id];
      State.markDeleted('habit:' + id);
      State.notify('habits');
      return { habit: h, log: log };
    },
    restoreHabit: function (snap) {
      if (!snap || !snap.habit || State.getHabit(snap.habit.id)) return;
      delete State.syncMeta.deleted['habit:' + snap.habit.id];
      snap.habit.updatedAt = Date.now();
      State.habits.push(snap.habit);
      if (snap.log) State.habitLog[snap.habit.id] = snap.log;
      State.habits.sort(function (a, b) { return a.order - b.order; });
      State.notify('habits');
    },
    /** Cambia el orden: delta -1 sube, +1 baja */
    moveHabit: function (id, delta) {
      var list = State.habits.slice().sort(function (a, b) { return a.order - b.order; });
      var i = list.findIndex(function (h) { return h.id === id; }), j = i + delta;
      if (i < 0 || j < 0 || j >= list.length) return;
      var tmp = list[i]; list[i] = list[j]; list[j] = tmp;
      list.forEach(function (h, k) { if (h.order !== k) { h.order = k; h.updatedAt = Date.now(); } });
      State.habits = list;
      State.notify('habits');
    },
    habitCount: function (id, d) { var e = State.habitLog[id] && State.habitLog[id][d]; return e ? e.n : 0; },
    setHabitCount: function (id, d, n) {
      var h = State.getHabit(id);
      if (!h || !isDate(d)) return;
      var log = State.habitLog[id] || (State.habitLog[id] = {});
      log[d] = { n: Math.max(0, Math.min(99, Math.round(n))), at: Date.now() };
      State.notify('habit');
    },

    /* ---------- Automatizaciones ---------- */
    getRule: function (id) {
      for (var i = 0; i < State.rules.length; i++) if (State.rules[i].id === id) return State.rules[i];
      return null;
    },
    saveRule: function (rule) {
      var existing = rule.id ? State.getRule(rule.id) : null;
      var c = cleanRule(Object.assign({}, existing || {}, rule, { id: rule.id || U.uid('r'), updatedAt: Date.now(), createdAt: existing ? existing.createdAt : Date.now() }));
      if (!c) return null;
      if (existing) Object.keys(c).forEach(function (k) { existing[k] = c[k]; }); else State.rules.push(c);
      delete State.syncMeta.deleted['rule:' + c.id];
      State.notify('rules');
      return existing || c;
    },
    removeRule: function (id) {
      State.rules = State.rules.filter(function (r) { return r.id !== id; });
      State.markDeleted('rule:' + id);
      State.notify('rules');
    },
    /** Anota una ejecución sin contar como edición (no gana a cambios hechos en otro dispositivo) */
    ruleRan: function (id, n) {
      var r = State.getRule(id);
      if (!r) return;
      r.runs += n; r.lastRun = Date.now();
    },

    /* ---------- Listas personalizadas ---------- */
    getFilter: function (id) {
      for (var i = 0; i < State.filters.length; i++) if (State.filters[i].id === id) return State.filters[i];
      return null;
    },
    saveFilter: function (f) {
      var existing = f.id ? State.getFilter(f.id) : null;
      var order = existing ? existing.order : State.filters.reduce(function (m, x) { return Math.max(m, x.order); }, -1) + 1;
      var c = cleanFilter(Object.assign({}, existing || {}, f, { id: f.id || U.uid('f'), order: order, updatedAt: Date.now(), createdAt: existing ? existing.createdAt : Date.now() }));
      if (!c) return null;
      if (existing) Object.keys(c).forEach(function (k) { existing[k] = c[k]; }); else State.filters.push(c);
      delete State.syncMeta.deleted['filter:' + c.id];
      State.notify('filters');
      return existing || c;
    },
    /** Cambia el orden de los filtros: delta -1 sube, +1 baja */
    moveFilter: function (id, delta) {
      var list = State.filters.slice().sort(function (a, b) { return a.order - b.order; });
      var i = list.findIndex(function (f) { return f.id === id; }), j = i + delta;
      if (i < 0 || j < 0 || j >= list.length) return;
      var tmp = list[i]; list[i] = list[j]; list[j] = tmp;
      list.forEach(function (f, k) { if (f.order !== k) { f.order = k; f.updatedAt = Date.now(); } });
      State.filters = list;
      State.notify('filters');
    },
    removeFilter: function (id) {
      State.filters = State.filters.filter(function (f) { return f.id !== id; });
      State.markDeleted('filter:' + id);
      State.notify('filters');
    },
    /** Tareas que cumple un filtro guardado */
    filterTasks: function (f) {
      var td = U.today(), weekEnd = U.addDays(td, 6 - ((U.weekday(td) - State.settings.weekStart + 7) % 7)), now = Date.now();
      var q = (f.text || '').toLowerCase();
      return State.tasks.filter(function (t) {
        if (f.status === 'pending' && t.done) return false;
        if (f.status === 'done' && !t.done) return false;
        if (f.lists.length && f.lists.indexOf(t.listId || '') < 0) return false;
        if (f.priorities.length && f.priorities.indexOf(t.highlight) < 0) return false;
        if (q && t.text.toLowerCase().indexOf(q) < 0 && (t.notes || '').toLowerCase().indexOf(q) < 0) return false;
        switch (f.when) {
          case 'today': return t.date === td || (!t.done && isOverdue(t, now));
          case 'week': return !!t.date && t.date >= td && t.date <= weekEnd;
          case 'next7': return !!t.date && t.date >= td && t.date <= U.addDays(td, 6);
          case 'overdue': return isOverdue(t, now);
          case 'nodate': return !t.date;
          case 'dated': return !!t.date;
          default: return true;
        }
      });
    },

    /* ---------- Apuntes ---------- */
    getNote: function (id) {
      for (var i = 0; i < State.notes.length; i++) if (State.notes[i].id === id) return State.notes[i];
      return null;
    },
    saveNote: function (n) {
      var existing = n.id ? State.getNote(n.id) : null;
      var c = cleanNote(Object.assign({}, existing || {}, n, { id: n.id || U.uid('n'), createdAt: existing ? existing.createdAt : Date.now(), updatedAt: Date.now() }));
      if (!c) return existing ? (State.removeNote(existing.id), null) : null;
      if (existing) Object.keys(c).forEach(function (k) { existing[k] = c[k]; }); else State.notes.push(c);
      delete State.syncMeta.deleted['note:' + c.id];
      State.notify('notes');
      return existing || c;
    },
    removeNote: function (id) {
      var n = State.getNote(id);
      if (!n) return null;
      State.notes = State.notes.filter(function (x) { return x.id !== id; });
      State.markDeleted('note:' + id);
      State.notify('notes');
      return n;
    },
    restoreNote: function (n) {
      if (!n || State.getNote(n.id)) return;
      delete State.syncMeta.deleted['note:' + n.id];
      n.updatedAt = Date.now();
      State.notes.push(n);
      State.notify('notes');
    },

    /* ---------- Plan ---------- */
    setPlan: function (p) {
      State.plan = cleanPlan(Object.assign({}, State.plan, p, { at: Date.now() }));
      State.notify('plan');
    },

    /* ---------- Personaje ---------- */
    setCharacter: function (c) {
      State.character = cleanCharacter(Object.assign({}, State.character, c, { at: Date.now() }));
      State.notify('character');
    },

    /* ---------- Amigos, dispositivos y enfoque compartido ---------- */
    setFriend: function (uid, info) {
      State.social.friends[uid] = Object.assign({}, State.social.friends[uid] || {}, info, { at: Date.now() });
      State.notify('social');
    },
    friends: function () {
      var f = State.social.friends;
      return Object.keys(f).filter(function (k) { return !f[k].removed; }).map(function (k) { return Object.assign({ uid: k }, f[k]); });
    },
    /** Este dispositivo sigue conectado (sin contar como cambio del usuario) */
    seeDevice: function (id, info) {
      State.social.devices[id] = Object.assign({}, State.social.devices[id] || {}, info, { seen: Date.now() });
      write(KEYS.social, State.social);
    },
    setSharedFocus: function (f) {
      State.social.focus = f ? Object.assign({}, f, { at: Date.now() }) : null;
      write(KEYS.social, State.social);
      State.notify('focus-shared');
    },

    /* ---------- Plantillas de un toque ---------- */
    saveTemplate: function (t) {
      var list = State.templates, existing = null;
      for (var i = 0; i < list.length; i++) if (list[i].id === t.id) existing = list[i];
      var c = cleanTemplates([Object.assign({}, existing || {}, t, { id: t.id || U.uid('tp'), createdAt: existing ? existing.createdAt : Date.now(), updatedAt: Date.now() })])[0];
      if (!c) return null;
      if (existing) Object.keys(c).forEach(function (k) { existing[k] = c[k]; }); else list.push(c);
      delete State.syncMeta.deleted['tpl:' + c.id];
      State.notify('templates');
      return existing || c;
    },
    removeTemplate: function (id) {
      State.templates = State.templates.filter(function (t) { return t.id !== id; });
      State.markDeleted('tpl:' + id);
      State.notify('templates');
    },


    /* ---------- Listas: orden ---------- */
    moveList: function (id, delta) {
      var i = State.lists.findIndex(function (l) { return l.id === id; }), j = i + delta;
      if (i < 0 || j < 0 || j >= State.lists.length) return;
      var tmp = State.lists[i]; State.lists[i] = State.lists[j]; State.lists[j] = tmp;
      State.syncMeta.listsAt = Date.now();
      State.notify('lists');
    },

    /* ---------- Varias tareas a la vez (un solo guardado y un solo aviso) ---------- */
    bulkUpdate: function (ids, fields) {
      var n = 0, listIds = {};
      State.lists.forEach(function (l) { listIds[l.id] = true; });
      ids.forEach(function (id) {
        var t = State.find(id);
        if (!t) return;
        var old = (t.date || '') + ' ' + (t.time || '');
        var c = cleanTask(Object.assign({}, t, typeof fields === 'function' ? fields(t) : fields), listIds);
        if (!c) return;
        Object.keys(c).forEach(function (k) { t[k] = c[k]; });
        if ((t.date || '') + ' ' + (t.time || '') !== old) { t.warnedAt = null; t.remindedAt = null; }
        t.updatedAt = Date.now();
        n++;
      });
      if (n) State.notify('update');
      return n;
    },
    bulkRemove: function (ids) {
      var removed = [];
      ids.forEach(function (id) {
        for (var i = 0; i < State.tasks.length; i++) if (State.tasks[i].id === id) {
          removed.push({ task: State.tasks[i], index: i });
          State.tasks.splice(i, 1);
          State.markDeleted(id);
          break;
        }
      });
      if (removed.length) State.notify('remove');
      return removed;
    },
    bulkRestore: function (snaps) {
      (snaps || []).slice().reverse().forEach(function (s) {
        if (!s || !s.task || State.find(s.task.id)) return;
        delete State.syncMeta.deleted[s.task.id];
        s.task.updatedAt = Date.now();
        State.tasks.splice(Math.min(s.index, State.tasks.length), 0, s.task);
      });
      State.notify('restore');
    },
    /** Tareas nuevas a partir de datos importados (copia de seguridad o CSV) */
    importTasks: function (items) {
      var listIds = {}, n = 0;
      State.lists.forEach(function (l) { listIds[l.id] = true; });
      items.forEach(function (it) {
        if (it.id && State.find(it.id)) return;
        var t = cleanTask(Object.assign({}, it, { id: it.id || U.uid(), mine: true, createdAt: it.createdAt || Date.now(), updatedAt: Date.now() }), listIds);
        if (t) { State.tasks.push(t); n++; }
      });
      if (n) State.notify('add');
      return n;
    }
  };

  // Mantener sincronizadas varias pestañas/ventanas de la app
  window.addEventListener('storage', function (e) {
    if (e.key === KEYS.tasks) {
      var fresh = read(KEYS.tasks);
      if (fresh && Array.isArray(fresh.tasks)) { State.tasks = purgeSamples(cleanTasks(fresh.tasks, State.lists), State.syncMeta.deleted); State.notify('sync'); }
    } else if (e.key === KEYS.settings) {
      State.settings = mergeTyped(DEFAULT_SETTINGS, read(KEYS.settings));
      State.notify('settings');
    }
  });

  // La limpieza de tareas de ejemplo se guarda enseguida (y se sube a la nube al sincronizar)
  if (purgedOnLoad) State.save();

  W.State = State;
})(window.Whider);
