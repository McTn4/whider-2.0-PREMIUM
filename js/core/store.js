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
  var changedFields = X.changedFields;
  var stampFields = X.stampFields;
  var cleanTask = X.cleanTask;
  var cleanTasks = X.cleanTasks;
  var cleanLists = X.cleanLists;
  var purgeSamples = X.purgeSamples;
  var emptyRecords = X.emptyRecords;
  var cleanRecords = X.cleanRecords;
  var cleanHabits = X.cleanHabits;
  var cleanHabitLog = X.cleanHabitLog;
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
      if (!State.getList(id)) return false;
      State.lists = State.lists.filter(function (l) { return l.id !== id; });
      State.tasks.forEach(function (t) { if (t.listId === id) t.listId = null; });
      // Sin categoría por defecto: las tareas nuevas quedan sin categoría
      if (State.settings.defaultList === id) { State.settings.defaultList = null; State.saveSettings('settings:defaultList'); }
      if (State.ui.listFilter === id) State.ui.listFilter = null;
      State.syncMeta.listsAt = Date.now();
      State.notify('lists');
      return true;
    },
    /** La categoría por defecto para una tarea nueva, si existe (si no, ninguna) */
    defaultListId: function () {
      var id = State.settings.defaultList;
      return id && State.getList(id) ? id : null;
    },
    /**
     * Las categorías de ejemplo de versiones anteriores (Personal, Trabajo, Salud y «Estudios») se quitan si
     * nadie las usa: sin tareas (tampoco archivadas), sin filtros que las nombren y con su nombre de siempre.
     * La app la llama una vez por dispositivo, ya con lo de la nube. Devuelve cuántas ha quitado.
     */
    dropExampleLists: function () {
      var used = {};
      State.tasks.concat(State.archived()).forEach(function (t) { if (t && t.listId) used[t.listId] = true; });
      State.filters.forEach(function (f) { (f.lists || []).forEach(function (id) { used[id] = true; }); });
      var gone = State.lists.filter(function (l) { return !used[l.id] && X.isExampleList(l); });
      if (!gone.length) return 0;
      var ids = {};
      gone.forEach(function (l) { ids[l.id] = true; });
      State.lists = State.lists.filter(function (l) { return !ids[l.id]; });
      if (ids[State.settings.defaultList]) { State.settings.defaultList = null; State.saveSettings('settings:defaultList'); }
      if (ids[State.ui.listFilter]) State.ui.listFilter = null;
      State.syncMeta.listsAt = Date.now();
      State.notify('lists');
      return gone.length;
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
      var byDay = t.repeat === 'weekdays' || (t.repeat === 'weekly' && t.days && t.days.length);
      while (out.length < max && guard++ < 1500) {
        if (byDay) {
          d = U.addDays(d, 1);
          if (!X.repeatsOn(t, d)) { if (d > to) break; continue; }
        } else d = t.repeat === 'daily' ? U.addDays(t.date, k) : t.repeat === 'weekly' ? U.addDays(t.date, 7 * k) : U.addMonths(t.date, k);
        k++;
        if (d > to) break;
        if (d >= from && d > t.date) out.push(d);
      }
      return out;
    },
    isOverdue: function (t) { return isOverdue(t); },
    pending: function () { return State.tasks.filter(function (t) { return !t.done; }); },
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

    /* ---------- Métricas ---------- */
    /** Completadas por día (historial permanente, sobrevive al borrado de tareas) */
    doneByDay: function () {
      var map = {};
      Object.keys(doneLog).forEach(function (d) { if (doneLog[d] > 0) map[d] = doneLog[d]; });
      return map;
    },
    streak: function () {
      var seen = State.doneByDay(), td = U.today();
      var cur = seen[td] ? td : U.addDays(td, -1), n = 0;
      while (seen[cur]) { n++; cur = U.addDays(cur, -1); }
      return n;
    },
    stats: function () {
      var total = State.tasks.length;
      var doneNow = State.tasks.filter(function (t) { return t.done; }).length;
      var td = U.today(), today = State.tasks.filter(function (t) { return t.date === td; });
      var todayDone = today.filter(function (t) { return t.done; }).length;
      return {
        total: total, pending: total - doneNow,
        todayTotal: today.length, todayDone: todayDone,
        todayPct: today.length ? Math.round(todayDone / today.length * 100) : 0,
        streak: State.streak(),
        overdue: State.overdueAll().length
      };
    },

    /* ---------- Ajustes ---------- */
    setSetting: function (path, value) {
      var parts = path.split('.'), obj = State.settings;
      for (var i = 0; i < parts.length - 1; i++) obj = obj[parts[i]];
      obj[parts[parts.length - 1]] = value;
      State.saveSettings('settings:' + path);
    },
    setMeta: function (k, v) { State.meta[k] = v; write(KEYS.meta, State.meta); },

    /* ---------- Tareas de cada día (antes, hábitos) ---------- */
    habitCount: function (id, d) { var e = State.habitLog[id] && State.habitLog[id][d]; return e ? e.n : 0; },
    /**
     * Convierte los hábitos activos de versiones anteriores en tareas de cada día. Cada hábito queda
     * archivado con todo su historial (nada se borra, y una versión antigua lo sigue viendo).
     * Devuelve cuántas tareas ha creado.
     */
    habitsToTasks: function () {
      var active = State.habits.filter(function (h) { return !h.archived; });
      if (!active.length) return 0;
      var td = U.today(), made = 0, now = Date.now();
      active.forEach(function (h) {
        var t = X.taskFromHabit(h, td, State.habitCount(h.id, td) >= h.target);
        if (t && !State.find(t.id) && !State.syncMeta.deleted[t.id]) { State.tasks.push(t); made++; }
        h.archived = true; h.updatedAt = now;
      });
      // Hoy lo cuenta una vez («Tus hábitos ahora son tareas de cada día»)
      if (made) State.meta.habitsMoved = (State.meta.habitsMoved || 0) + made;
      State.notify('habits');
      return made;
    },
    /**
     * Las tareas de cada día que se quedaron sin hacer pasan solas al primer día que les toca desde hoy:
     * no se acumulan como vencidas. Devuelve cuántas ha movido.
     */
    rollRoutines: function () {
      var td = U.today(), moved = 0;
      State.tasks.forEach(function (t) {
        if (t.done || !t.date || t.date >= td || !X.isRoutine(t)) return;
        t.date = X.firstDue(t, td);
        t.warnedAt = null; t.remindedAt = null;
        stampFields(t, ['date']);
        t.updatedAt = Date.now();
        moved++;
      });
      if (moved) State.notify('update');
      return moved;
    },
    /** Hábitos convertidos y tareas de cada día al día (al abrir, al cambiar de día y al sincronizar) */
    tidyRoutines: function () { return State.batch(function () { return State.habitsToTasks() + State.rollRoutines(); }); },

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

    /* ---------- Contactos ---------- */
    setFriend: function (uid, info) {
      State.social.friends[uid] = Object.assign({}, State.social.friends[uid] || {}, info, { at: Date.now() });
      State.notify('social');
    },
    friends: function () {
      var f = State.social.friends;
      return Object.keys(f).filter(function (k) { return !f[k].removed; }).map(function (k) { return Object.assign({ uid: k }, f[k]); });
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
