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
    sync: 'whider.sync.v1'          // Marcas de tiempo y borrados para la sincronización
  };
  var ALL_KEYS = Object.keys(KEYS).map(function (k) { return KEYS[k]; });

  /*
   * Colores de acento y de listas (paleta propia de WHIDER, legible sobre fondo oscuro).
   * Las claves se conservan de versiones anteriores para no perder la elección del usuario.
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
    vibrate: true,
    quietHours: { enabled: false, from: '22:00', to: '08:00' },
    focus: { work: 25, short: 5, long: 15, rounds: 4, autoBreaks: true }
  };

  var DEFAULT_LISTS = [
    { id: 'personal', name: 'Personal', color: 'iris' },
    { id: 'work', name: 'Trabajo', color: 'ember' },
    { id: 'health', name: 'Salud', color: 'jade' }
  ];

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
      .map(function (l) { return { id: l.id, name: l.name.trim().slice(0, 24), color: ACCENTS[l.color] ? l.color : 'iris' }; });
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

  var subscribers = [];

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
    ACCENTS: ACCENTS,
    PRIORITIES: PRIORITIES,
    REPEATS: REPEATS,
    DEFAULT_SETTINGS: DEFAULT_SETTINGS,
    tasks: tasks,
    lists: lists,
    settings: settings,
    meta: meta,
    records: records,
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
      State.save();
      subscribers.forEach(function (fn) { try { fn(reason || 'change'); } catch (e) { console.error(e); } });
    },
    save: function () {
      write(KEYS.tasks, { tasks: State.tasks });
      write(KEYS.settings, State.settings);
      write(KEYS.lists, State.lists);
      write(KEYS.meta, State.meta);
      write(KEYS.focus, focusLog);
      write(KEYS.doneLog, doneLog);
      write(KEYS.records, State.records);
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
        profile: { name: profile.name || '', email: profile.email || '', photo: profile.photo || '', photoURL: profile.photoURL || '' },
        meta: { createdAt: State.meta.createdAt, seenAchievements: State.meta.seenAchievements, onboarded: !!State.meta.onboarded },
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
      if (snap.profile) {
        var sp = snap.profile;
        profile = Object.assign({}, profile, {
          name: sp.name || profile.name || '', email: sp.email || profile.email || '',
          photo: typeof sp.photo === 'string' ? sp.photo : (profile.photo || ''),
          photoURL: typeof sp.photoURL === 'string' && sp.photoURL ? sp.photoURL : (profile.photoURL || '')
        });
        write(KEYS.profile, profile);
      }
      if (snap.meta) {
        if (snap.meta.createdAt) State.meta.createdAt = Math.min(State.meta.createdAt || Date.now(), snap.meta.createdAt);
        if (Array.isArray(snap.meta.seenAchievements)) State.meta.seenAchievements = snap.meta.seenAchievements;
        if (snap.meta.onboarded) State.meta.onboarded = true;
      }
      // Si llegaron tareas de ejemplo de la nube, se borran y el borrado se sube enseguida
      State.notify(purged ? 'purge' : (reason || 'sync'));
    },
    /** Borra los datos de este dispositivo (al cerrar sesión o cambiar de cuenta) */
    clearLocal: function () {
      ALL_KEYS.forEach(remove);
      remove('whider.focus.timer');
      profile = {};
      State.tasks = []; State.lists = cleanLists(null); State.settings = clone(DEFAULT_SETTINGS);
      focusLog = {}; doneLog = {}; State.records = emptyRecords();
      State.syncMeta = { deleted: {}, settingsAt: 0, listsAt: 0, profileAt: 0 };
      State.meta = { onboarded: false, createdAt: Date.now(), celebrated: null, seenAchievements: [], owner: null, guest: false };
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
    addList: function (name, color) {
      var l = { id: U.uid('l'), name: name.trim().slice(0, 24), color: ACCENTS[color] ? color : 'iris' };
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
    listColor: function (id) {
      var l = State.getList(id);
      return l ? ACCENTS[l.color].a : null;
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
      var xp = done * 10 + ft.min * 2 + State.bestStreak() * 15;
      var level = Math.floor(Math.sqrt(xp / 60)) + 1;
      var levelXp = Math.pow(level - 1, 2) * 60, nextXp = Math.pow(level, 2) * 60;
      return {
        total: total, done: done, pending: total - doneNow,
        rate: total ? Math.round(doneNow / total * 100) : 0,
        todayTotal: today.length, todayDone: todayDone,
        todayPct: today.length ? Math.round(todayDone / today.length * 100) : 0,
        streak: State.streak(), bestStreak: State.bestStreak(),
        focusMin: ft.min, focusSessions: ft.sessions,
        focusToday: State.focusOn(U.today()).min,
        overdue: State.overdueAll().length,
        xp: xp, level: level, levelProgress: (xp - levelXp) / (nextXp - levelXp), nextXp: nextXp
      };
    },
    levelTitle: function (level) {
      var titles = ['Iniciado', 'Aprendiz', 'Constante', 'Enfocado', 'Imparable', 'Estratega', 'Maestro', 'Leyenda'];
      return titles[Math.min(level - 1, titles.length - 1)];
    },
    achievements: function () {
      var s = State.stats(), byDate = {};
      State.tasks.forEach(function (t) {
        if (!t.date) return;
        var e = byDate[t.date] || (byDate[t.date] = { n: 0, done: 0 });
        e.n++; if (t.done) e.done++;
      });
      var perfectDay = Object.keys(byDate).some(function (d) { return byDate[d].n >= 3 && byDate[d].done === byDate[d].n; });
      var listsUsed = {};
      State.tasks.forEach(function (t) { if (t.done && t.listId) listsUsed[t.listId] = true; });
      return [
        { id: 'first', icon: 'check', title: 'Primer paso', desc: 'Completa tu primera tarea', ok: s.done >= 1 },
        { id: 'ten', icon: 'bolt', title: 'En marcha', desc: 'Completa 10 tareas', ok: s.done >= 10 },
        { id: 'fifty', icon: 'medal', title: 'Imparable', desc: 'Completa 50 tareas', ok: s.done >= 50 },
        { id: 'hundred', icon: 'trophy', title: 'Centenario', desc: 'Completa 100 tareas', ok: s.done >= 100 },
        { id: 'streak3', icon: 'flame', title: 'Calentando', desc: 'Racha de 3 días', ok: s.bestStreak >= 3 },
        { id: 'streak7', icon: 'flame', title: 'Semana perfecta', desc: 'Racha de 7 días', ok: s.bestStreak >= 7 },
        { id: 'streak30', icon: 'crown', title: 'Hábito de hierro', desc: 'Racha de 30 días', ok: s.bestStreak >= 30 },
        { id: 'focus1', icon: 'timer', title: 'Concentración', desc: 'Termina una sesión de enfoque', ok: s.focusSessions >= 1 },
        { id: 'focus10h', icon: 'target', title: 'Mente de acero', desc: '10 horas de enfoque', ok: s.focusMin >= 600 },
        { id: 'perfect', icon: 'sparkle', title: 'Día redondo', desc: 'Completa todo un día con 3+ tareas', ok: perfectDay },
        { id: 'lists', icon: 'layers', title: 'Organizado', desc: 'Completa tareas en 3 listas', ok: Object.keys(listsUsed).length >= 3 }
      ];
    },

    focusLog: function () { return focusLog; },

    /* ---------- Ajustes ---------- */
    setSetting: function (path, value) {
      var parts = path.split('.'), obj = State.settings;
      for (var i = 0; i < parts.length - 1; i++) obj = obj[parts[i]];
      obj[parts[parts.length - 1]] = value;
      State.saveSettings('settings:' + path);
    },
    setMeta: function (k, v) { State.meta[k] = v; write(KEYS.meta, State.meta); }
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
