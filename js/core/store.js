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
    character: 'whider.character.v1', // Tu personaje
    social: 'whider.social.v1',     // Amigos, dispositivos y enfoque compartido
    templates: 'whider.templates.v1', // Plantillas de un toque (acciones rápidas)
    rules: 'whider.rules.v1',       // Automatizaciones
    filters: 'whider.filters.v1',   // Listas personalizadas (filtros guardados)
    sync: 'whider.sync.v1',         // Marcas de tiempo y borrados para la sincronización
    archive: 'whider.archive.v1'    // Tareas completadas hace tiempo, fuera de la lista (y de la copia principal)
  };
  var ALL_KEYS = Object.keys(KEYS).map(function (k) { return KEYS[k]; });
  // Claves de versiones anteriores que ya no se usan (planes y pagos): se borran al arrancar
  var RETIRED_KEYS = ['whider.plan.v1', 'whider.payPending', 'whider.payTest'];

  // Valores por defecto y limpieza de los datos: js/core/schema.js
  var X = W.Schema;
  var ACCENTS = X.ACCENTS;
  var LIST_TINTS = X.LIST_TINTS;
  var PRIORITIES = X.PRIORITIES;
  var REPEATS = X.REPEATS;
  var DEFAULT_SETTINGS = X.DEFAULT_SETTINGS;
  var cleanIcon = X.cleanIcon;
  var clone = X.clone;
  var mergeTyped = X.mergeTyped;
  var isDate = X.isDate;
  var changedFields = X.changedFields;
  var stampFields = X.stampFields;
  var cleanTask = X.cleanTask;
  var cleanTasks = X.cleanTasks;
  var cleanLists = X.cleanLists;
  var purgeSamples = X.purgeSamples;
  var emptyRecords = X.emptyRecords;
  var cleanRecords = X.cleanRecords;
  var cleanHabit = X.cleanHabit;
  var cleanHabits = X.cleanHabits;
  var cleanHabitLog = X.cleanHabitLog;
  var cleanRule = X.cleanRule;
  var cleanRules = X.cleanRules;
  var cleanFilter = X.cleanFilter;
  var cleanFilters = X.cleanFilters;
  var cleanNotes = X.cleanNotes;
  var cleanCharacter = X.cleanCharacter;
  var cleanSocial = X.cleanSocial;
  var cleanTemplates = X.cleanTemplates;
  var isOverdue = X.isOverdue;
  var nextDate = X.nextDate;

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
    var raw;
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
  var meta = Object.assign({ onboarded: false, createdAt: Date.now(), celebrated: null, owner: null, guest: false }, read(KEYS.meta) || {});
  // Restos de versiones anteriores (logros y planes): ya no se usan
  delete meta.seenAchievements; delete meta.achievedAt; delete meta.trialEndSeen;
  var focusLog = read(KEYS.focus) || {};
  var profile = read(KEYS.profile) || {};

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
  RETIRED_KEYS.forEach(function (k) {
    var has = false;
    try { has = localStorage.getItem(k) != null; } catch (e) { /* bloqueado */ }
    if (!has && bridge()) { try { has = !!bridge().storeGet(k); } catch (e) { /* sin puente */ } }
    if (has) remove(k);
  });
  var character = cleanCharacter(read(KEYS.character));
  var social = cleanSocial(read(KEYS.social));
  var templates = cleanTemplates(read(KEYS.templates));
  var filters = cleanFilters(read(KEYS.filters));

  var subscribers = [];
  var batching = 0, batchReason = null;

  var State = {
    KEYS: KEYS,
    /** Lectura y escritura con el espejo nativo de Android (lo usa también el Cuaderno) */
    storage: { read: read, write: write, remove: remove, flush: function () { flushNative(); } },
    ACCENTS: ACCENTS,
    LIST_TINTS: LIST_TINTS,
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
        notes: State.notes, character: State.character, social: State.social, templates: State.templates,
        profile: { name: profile.name || '', email: profile.email || '', photo: profile.photo || '', photoURL: profile.photoURL || '', avatar: profile.avatar || '' },
        meta: { createdAt: State.meta.createdAt, onboarded: !!State.meta.onboarded },
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
      if (W.Files) W.Files.clearLocal();
      profile = {};
      State.tasks = []; State.lists = cleanLists(null); State.settings = clone(DEFAULT_SETTINGS);
      focusLog = {}; doneLog = {}; State.records = emptyRecords();
      State.habits = []; State.habitLog = {}; State.rules = []; State.filters = [];
      State.notes = []; State.character = cleanCharacter(null); State.social = cleanSocial(null); State.templates = [];
      State.syncMeta = { deleted: {}, settingsAt: 0, listsAt: 0, profileAt: 0 };
      State.meta = { onboarded: false, createdAt: Date.now(), celebrated: null, owner: null, guest: false };
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
    addList: function (name, color, icon, tint) {
      var l = { id: U.uid('l'), name: name.trim().slice(0, 24), color: ACCENTS[color] ? color : 'iris', icon: cleanIcon(icon) };
      if (LIST_TINTS[tint]) l.tint = tint;
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
      // tint: nombre de un color de LIST_TINTS, o null para quitarlo
      if (fields.tint !== undefined) { if (LIST_TINTS[fields.tint]) l.tint = fields.tint; else delete l.tint; }
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
      var changed = changedFields(t, c);
      Object.keys(c).forEach(function (k) { t[k] = c[k]; });
      stampFields(t, changed);
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
      if (t.done) t.startedAt = null;
      stampFields(t, ['done', 'startedAt']);
      if (t.done) doneLog[t.doneOn] = (doneLog[t.doneOn] || 0) + 1;
      t.updatedAt = Date.now();
      if (t.done && t.repeat !== 'none' && !t.spawnedId) {
        var nd = nextDate(t);
        if (nd) {
          var next = cleanTask(Object.assign({}, t, {
            id: U.uid(), date: nd, done: false, doneOn: null, doneAt: null, warnedAt: null, remindedAt: null,
            spawnedId: null, startedAt: null, focusMin: 0, createdAt: Date.now(), example: false,
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
    /* ---------- Archivo: completadas hace tiempo, fuera de la lista ---------- */
    /** Tareas archivadas en este dispositivo (de la más antigua a la más reciente) */
    archived: function () { var a = read(KEYS.archive); return Array.isArray(a) ? a : []; },
    /** ¿Queda por debajo de la marca de archivo? (completada antes de esa fecha) */
    isArchived: function (t, before) { return !!(t && t.done && before && (t.doneAt || 0) < before); },
    /** Junta tareas al archivo de este dispositivo, sin repetir (como mucho las 5000 más recientes) */
    addToArchive: function (list) {
      if (!list || !list.length) return 0;
      var byId = {}, n = 0;
      State.archived().forEach(function (t) { if (t && t.id) byId[t.id] = t; });
      list.forEach(function (t) { if (t && t.id && !byId[t.id]) { byId[t.id] = t; n++; } });
      var out = Object.keys(byId).map(function (k) { return byId[k]; }).sort(function (x, y) { return (x.doneAt || 0) - (y.doneAt || 0); });
      write(KEYS.archive, out.slice(-5000));
      return n;
    },
    /**
     * Archiva las completadas antes de `before`: salen de la lista y de la copia principal de la nube
     * (que admite como mucho 1 MB) y quedan en el archivo. Las estadísticas por día no cambian: van en
     * su propio registro. Devuelve las tareas archivadas.
     */
    archiveDone: function (before) {
      var gone = State.tasks.filter(function (t) { return State.isArchived(t, before); });
      if (!gone.length) return [];
      State.addToArchive(gone);
      State.tasks = State.tasks.filter(function (t) { return !State.isArchived(t, before); });
      State.syncMeta.archivedBefore = Math.max(State.syncMeta.archivedBefore || 0, before);
      State.notify('archive');
      return gone;
    },
    /** Marca una tarea como empezada (en curso) o la devuelve a pendiente */
    setStarted: function (id, on) {
      var t = State.find(id);
      if (!t || t.done) return t;
      var now = on ? (t.startedAt || Date.now()) : null;
      if (now === t.startedAt) return t;
      t.startedAt = now;
      stampFields(t, ['startedAt']);
      t.updatedAt = Date.now();
      State.notify(on ? 'started' : 'update');
      return t;
    },
    /** En curso: la empezaste o ya tiene alguna subtarea hecha (pero no todas) */
    isDoing: function (t) {
      if (!t || t.done) return false;
      if (t.startedAt) return true;
      var subs = t.subtasks || [], hechas = subs.filter(function (x) { return x.done; }).length;
      return hechas > 0 && hechas < subs.length;
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
      stampFields(t, ['date', 'time']);
      t.warnedAt = null; t.remindedAt = null; t.updatedAt = Date.now();
      State.notify('update');
    },
    moveToTomorrow: function (id) {
      var t = State.find(id);
      if (!t) return;
      t.date = U.addDays(U.today(), 1);
      stampFields(t, ['date']);
      t.warnedAt = null; t.remindedAt = null; t.updatedAt = Date.now();
      State.notify('update');
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
      if (W.Files) W.Files.resetAll();
      State.syncMeta.resetAt = Date.now();
      State.meta.celebrated = null;
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
    overdueAll: function () {
      var now = Date.now();
      return State.tasks.filter(function (t) { return isOverdue(t, now); });
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
    removeNote: function (id) {
      var n = State.getNote(id);
      if (!n) return null;
      State.notes = State.notes.filter(function (x) { return x.id !== id; });
      State.markDeleted('note:' + id);
      State.notify('notes');
      return n;
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
        var changed = changedFields(t, c);
        Object.keys(c).forEach(function (k) { t[k] = c[k]; });
        stampFields(t, changed);
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
