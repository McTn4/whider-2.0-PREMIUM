// @ts-check
/**
 * WHIDER · Sincronización con la nube (Cloud Firestore, versión ligera)
 *
 * Modelo "local primero": todo se guarda al instante en el dispositivo y, con sesión
 * iniciada, se sincroniza con users/{uid}/state/app (los apuntes, que pueden ser largos,
 * van aparte en users/{uid}/state/notes, en la misma transacción). Cada subida es una TRANSACCIÓN que
 * lee la versión de la nube, la FUSIONA con la local y escribe el resultado, así dos
 * dispositivos nunca se pisan:
 *  - Tareas, marcas personales, hábitos, automatizaciones y listas personalizadas: gana la
 *    modificación más reciente de cada elemento.
 *  - Registro de hábitos: en cada día gana la marca más reciente (así desmarcar también se sincroniza).
 *  - Borrados: se recuerdan para que no "resuciten" desde otro dispositivo.
 *  - Historial diario, enfoque y récords: se conserva el valor más alto.
 *  - Personaje y enfoque compartido: gana el cambio más reciente.
 * Se sincroniza al abrir, al volver a la app y tras cada cambio. Mientras está a la vista se
 * mira la nube cada 15 s si la estás usando, cada minuto tras 2 min sin tocarla y cada 5 min tras
 * 15 min (así un ordenador con WHIDER abierto todo el día no gasta lecturas sin necesidad).
 * Sin conexión no pasa nada: los datos ya están guardados y se suben al volver la red.
 * Si algo falla, el error se clasifica (conexión, sesión, permisos, choque con otro dispositivo,
 * límite de uso, tamaño o servidor), se explica en Ajustes y se reintenta solo cuando tiene sentido,
 * cada vez más espaciado (2 s, 4 s, 8 s… hasta 5 min).
 */
window.Whider = window.Whider || {};

(function (W) {
  'use strict';
  var F = function () { return W.Auth.sdk(); }, S = function () { return W.State; }, U2 = function () { return W.U; };
  var ref = null, notesRef = null, timer = null, poll = null, applying = false, active = false, uid = null, lastPush = 0;
  var dirty = false, inFlight = null, queued = false, firstSyncPromise = null;
  var listeners = [];
  // Con la app a la vista se mira la nube cada 15 s; un cambio se sube a los 0,6 s
  var POLL_EVERY = 15000, PUSH_DELAY = 600;
  // Firestore admite hasta 1 MiB por documento: se avisa a partir de 700 KB y no se intenta pasar de 1 MB
  var SIZE_WARN = 700 * 1024, SIZE_MAX = 1000 * 1000;
  var retryTimer = null, retryN = 0, lastInput = Date.now();

  function utf8Size(str) { return new TextEncoder().encode(str).length; }
  /** Espera antes de reintentar: 2, 4, 8… s (o desde 1 min si la nube está al límite), hasta 5 min, ±20 % */
  function backoff(n, slow, rnd) {
    var base = Math.min(300000, (slow ? 60000 : 2000) * Math.pow(2, Math.max(0, n)));
    return Math.round(base * (0.8 + (rnd === undefined ? Math.random() : rnd) * 0.4));
  }
  /** Cada cuánto mirar la nube según el tiempo que llevas sin tocar la app */
  function pollEvery(idle) { return idle < 120000 ? POLL_EVERY : idle < 900000 ? 60000 : 300000; }

  /* Fusión de dos versiones de la misma tarea: gana la editada más tarde, pero los campos que la
     otra cambió después (según su hora, «ft») se conservan. Algunos campos van juntos. */
  var FIELD_GROUPS = { done: ['done', 'doneOn', 'doneAt', 'spawnedId'], date: ['date', 'warnedAt', 'remindedAt'] };
  function stampOf(x) { return x.updatedAt || x.createdAt || 0; }
  function mergeTask(x, y) {
    var sx = stampOf(x), sy = stampOf(y);
    var win = sy > sx ? y : x, lose = win === x ? y : x;
    var fw = win.ft || {}, fl = lose.ft || {};
    var keys = Object.keys(fl).filter(function (k) { return (fl[k] || 0) > (fw[k] || 0); });
    if (!keys.length && (lose.focusMin || 0) <= (win.focusMin || 0)) return win;
    var out = Object.assign({}, win, { ft: Object.assign({}, fw) });
    keys.forEach(function (k) {
      (FIELD_GROUPS[k] || [k]).forEach(function (f) { out[f] = lose[f]; });
      out.ft[k] = fl[k];
    });
    // El tiempo de enfoque dedicado solo suma: se queda el mayor
    out.focusMin = Math.max(win.focusMin || 0, lose.focusMin || 0);
    out.updatedAt = Math.max(sx, sy);
    return out;
  }

  var Sync = {
    status: 'off',       // off · connecting · synced · pending · offline · unverified · error
    lastAt: null,
    /** Último error: { kind, text, retry, code, at } (kind: connection, auth, unverified, permissions, conflict, quota, size, server) */
    lastError: null,
    /** Primer cambio de este dispositivo que aún no está en la nube */
    pendingSince: null,
    /** Próximo reintento programado (marca de tiempo) */
    retryAt: null,
    /** Tamaño del documento principal en la última subida (bytes) y sus límites */
    size: 0,
    SIZE_WARN: SIZE_WARN,
    SIZE_MAX: SIZE_MAX,
    mergeTask: mergeTask,
    backoff: backoff,
    pollEvery: pollEvery,
    /** Milisegundos desde la última vez que se tocó la app (lo usan también el Cuaderno y Personas) */
    idleFor: function () { return Date.now() - lastInput; },
    onStatus: function (fn) { listeners.push(fn); },

    /**
     * Traduce un fallo de la nube a algo que se entiende y dice si tiene sentido reintentar.
     * ctx: { offline, verified }
     */
    classify: function (e, ctx) {
      ctx = ctx || {};
      var code = String((e && e.code) || '').replace(/^firestore\//, ''), msg = String((e && e.message) || '');
      if (code === 'size' || (code === 'invalid-argument' && /size|bytes|too large|exceed/i.test(msg))) {
        return { kind: 'size', retry: false, text: 'Tus datos ya no caben en la copia de la nube (máximo 1 MB). Siguen a salvo en este dispositivo: archiva las tareas completadas antiguas en Ajustes → Datos.' };
      }
      if (ctx.offline || code === 'unavailable' || code === 'deadline-exceeded' || /network|failed to fetch|offline|load failed/i.test(msg)) {
        return { kind: 'connection', retry: true, text: 'Sin conexión con la nube. Tus cambios están guardados aquí y se subirán solos.' };
      }
      if (code === 'unauthenticated') return { kind: 'auth', retry: false, text: 'La sesión ha caducado. Vuelve a iniciar sesión para seguir guardando en la nube.' };
      if (code === 'permission-denied') {
        return ctx.verified === false
          ? { kind: 'unverified', retry: false, text: 'Verifica tu correo para activar la copia en la nube.' }
          : { kind: 'permissions', retry: false, text: 'La nube no ha aceptado los cambios. Cierra sesión y vuelve a entrar; si sigue pasando, escríbenos.' };
      }
      if (code === 'aborted' || code === 'failed-precondition') return { kind: 'conflict', retry: true, text: 'Otro dispositivo estaba guardando a la vez. Se vuelve a intentar enseguida.' };
      if (code === 'resource-exhausted') return { kind: 'quota', retry: true, slow: true, text: 'La nube está al límite de uso. Se volverá a intentar en unos minutos.' };
      return { kind: 'server', retry: true, text: 'La nube no responde bien ahora mismo. Se volverá a intentar.' };
    },

    setStatus: function (s) {
      try { document.documentElement.setAttribute('data-sync', s); } catch (e) { /* sin documento (pruebas) */ }
      if (Sync.status === s && s !== 'synced') return;
      Sync.status = s;
      if (s === 'synced') Sync.lastAt = Date.now();
      listeners.forEach(function (fn) { try { fn(s); } catch (e) { console.error(e); } });
    },

    /* ---------- Fusión (función pura, sin efectos) ---------- */
    merge: function (a, b) {
      if (!b) return a;
      if (!a) return b;
      var sa = a.sync || {}, sb = b.sync || {};
      var deleted = {};
      [sa.deleted || {}, sb.deleted || {}].forEach(function (d) {
        Object.keys(d).forEach(function (k) { deleted[k] = Math.max(deleted[k] || 0, d[k]); });
      });
      var stamp = function (x) { return x.updatedAt || x.createdAt || 0; };

      // Tareas: por tarea gana la más reciente, campo a campo si las dos traen la hora de sus campos
      var byId = {};
      (a.tasks || []).concat(b.tasks || []).forEach(function (t) {
        if (!t || !t.id) return;
        byId[t.id] = byId[t.id] ? mergeTask(byId[t.id], t) : t;
      });
      // Lo completado antes de la marca de archivo vive en el archivo, no en la copia principal
      var archivedBefore = Math.max(sa.archivedBefore || 0, sb.archivedBefore || 0);
      var tasks = Object.keys(byId).map(function (k) { return byId[k]; })
        .filter(function (t) { return !(deleted[t.id] && deleted[t.id] >= stamp(t)); })
        .filter(function (t) { return !(archivedBefore && t.done && (t.doneAt || 0) < archivedBefore); })
        .sort(function (x, y) { return (x.createdAt || 0) - (y.createdAt || 0); });

      var newer = function (key, field) { return (sa[key] || 0) >= (sb[key] || 0) ? a[field] : b[field]; };

      // Si un dispositivo restableció los datos después de los cambios del otro, ese reinicio manda
      var resetA = sa.resetAt || 0, resetB = sb.resetAt || 0;
      var logsFrom = resetA > resetB ? [a] : resetB > resetA ? [b] : [a, b];
      var maxMap = function (field, inner) {
        var out = {};
        logsFrom.forEach(function (src) {
          var m = src[field] || {};
          Object.keys(m).forEach(function (d) {
            if (inner) {
              var cur = out[d] || { min: 0, sessions: 0 };
              out[d] = { min: Math.max(cur.min, m[d].min || 0), sessions: Math.max(cur.sessions, m[d].sessions || 0) };
            } else out[d] = Math.max(out[d] || 0, m[d] || 0);
          });
        });
        return out;
      };

      // Récords
      var ra = a.records || {}, rb = b.records || {};
      var recSources = logsFrom.map(function (src) { return src.records || {}; });
      var best = {};
      recSources.forEach(function (r) {
        Object.keys(r.best || {}).forEach(function (k) {
          if (!best[k] || r.best[k].value > best[k].value) best[k] = r.best[k];
        });
      });
      var hist = {};
      recSources.forEach(function (r) { (r.history || []).forEach(function (h) { hist[h.id] = h; }); });
      var marks = {};
      (ra.custom || []).concat(rb.custom || []).forEach(function (m) {
        if (!m || !m.id) return;
        var prev = marks[m.id];
        var entries = {};
        (prev ? prev.entries : []).concat(m.entries || []).forEach(function (e) { if (e && e.id) entries[e.id] = e; });
        var base = !prev || (m.updatedAt || 0) > (prev.updatedAt || 0) ? m : prev;
        marks[m.id] = Object.assign({}, base, {
          updatedAt: Math.max(m.updatedAt || 0, prev ? prev.updatedAt || 0 : 0),
          entries: Object.keys(entries).map(function (k) { return entries[k]; })
            .filter(function (e) { return !deleted['entry:' + e.id]; })
            .sort(function (x, y) { return x.date < y.date ? -1 : x.date > y.date ? 1 : (x.at || 0) - (y.at || 0); })
        });
      });
      var custom = Object.keys(marks).map(function (k) { return marks[k]; })
        .filter(function (m) { return !(deleted['mark:' + m.id] && deleted['mark:' + m.id] >= (m.updatedAt || 0)); });

      // Hábitos, automatizaciones y listas personalizadas: por elemento, gana el más reciente
      var newestById = function (field, prefix) {
        var map = {};
        (a[field] || []).concat(b[field] || []).forEach(function (x) {
          if (x && x.id && (!map[x.id] || stamp(x) > stamp(map[x.id]))) map[x.id] = x;
        });
        return Object.keys(map).map(function (k) { return map[k]; })
          .filter(function (x) { return !(deleted[prefix + x.id] && deleted[prefix + x.id] >= stamp(x)); })
          .sort(function (x, y) { return (x.order || 0) - (y.order || 0) || (x.createdAt || 0) - (y.createdAt || 0); });
      };
      var habitLog = {};
      logsFrom.forEach(function (src) {
        var L = src.habitLog || {};
        Object.keys(L).forEach(function (hid) {
          if (deleted['habit:' + hid]) return;
          var days = L[hid] || {}, out = habitLog[hid] || (habitLog[hid] = {});
          Object.keys(days).forEach(function (d) {
            var e = days[d];
            if (e && (!out[d] || (e.at || 0) > (out[d].at || 0))) out[d] = e;
          });
        });
      });

      var ma = a.meta || {}, mb = b.meta || {};
      var newest = function (x, y) { if (!x) return y || null; if (!y) return x; return (y.at || 0) > (x.at || 0) ? y : x; };

      // Amigos, dispositivos y enfoque compartido
      var soa = a.social || {}, sob = b.social || {};
      var perKey = function (ka, kb, field) {
        var out = {};
        [ka || {}, kb || {}].forEach(function (m) { Object.keys(m).forEach(function (k) { if (!out[k] || (m[k][field] || 0) > (out[k][field] || 0)) out[k] = m[k]; }); });
        return out;
      };
      var cheers = {};
      (soa.cheers || []).concat(sob.cheers || []).forEach(function (c) { if (c && c.id) cheers[c.id] = c; });

      return {
        v: 1,
        tasks: tasks,
        lists: newer('listsAt', 'lists') || a.lists || b.lists,
        settings: newer('settingsAt', 'settings') || a.settings || b.settings,
        profile: newer('profileAt', 'profile') || a.profile || b.profile,
        focus: maxMap('focus', true),
        doneLog: maxMap('doneLog', false),
        records: {
          best: best,
          history: Object.keys(hist).map(function (k) { return hist[k]; }).sort(function (x, y) { return (x.at || 0) - (y.at || 0); }).slice(-300),
          custom: custom
        },
        habits: newestById('habits', 'habit:'),
        habitLog: habitLog,
        rules: newestById('rules', 'rule:'),
        filters: newestById('filters', 'filter:'),
        notes: newestById('notes', 'note:'),
        templates: newestById('templates', 'tpl:'),
        character: newest(a.character, b.character),
        social: {
          friends: perKey(soa.friends, sob.friends, 'at'),
          devices: perKey(soa.devices, sob.devices, 'seen'),
          focus: newest(soa.focus, sob.focus),
          spaces: perKey(soa.spaces, sob.spaces, 'at'),
          code: soa.code || sob.code || null,
          enabled: (soa.enabledAt || 0) >= (sob.enabledAt || 0) ? !!soa.enabled : !!sob.enabled,
          enabledAt: Math.max(soa.enabledAt || 0, sob.enabledAt || 0),
          cheers: Object.keys(cheers).map(function (k) { return cheers[k]; }).sort(function (x, y) { return x.at - y.at; }).slice(-30),
          invites: perKey(soa.invites, sob.invites, 'at'),
          chats: (function () {
            // Lo leído es lo máximo de los dos lados; silenciar y fijar, lo último que se cambió
            var out = perKey(soa.chats, sob.chats, 'at'), A = soa.chats || {}, B = sob.chats || {};
            Object.keys(out).forEach(function (k) { out[k] = Object.assign({}, out[k], { read: Math.max((A[k] || {}).read || 0, (B[k] || {}).read || 0) }); });
            return out;
          })()
        },
        meta: {
          createdAt: Math.min(ma.createdAt || Date.now(), mb.createdAt || Date.now()),
          onboarded: !!(ma.onboarded || mb.onboarded)
        },
        sync: {
          deleted: deleted,
          settingsAt: Math.max(sa.settingsAt || 0, sb.settingsAt || 0),
          listsAt: Math.max(sa.listsAt || 0, sb.listsAt || 0),
          profileAt: Math.max(sa.profileAt || 0, sb.profileAt || 0),
          resetAt: Math.max(resetA, resetB),
          archivedBefore: archivedBefore || undefined
        }
      };
    },

    /** Representación estable para comparar versiones */
    fingerprint: function (snap) {
      if (!snap) return '';
      var copy = JSON.parse(JSON.stringify(snap));
      delete copy.updatedAt; delete copy.device;
      (copy.tasks || []).sort(function (x, y) { return x.id < y.id ? -1 : 1; });
      var stable = function (v) {
        if (Array.isArray(v)) return '[' + v.map(stable).join(',') + ']';
        if (v && typeof v === 'object') return '{' + Object.keys(v).sort().map(function (k) { return JSON.stringify(k) + ':' + stable(v[k]); }).join(',') + '}';
        return JSON.stringify(v);
      };
      return stable(copy);
    },

    /* ---------- Ciclo de vida ---------- */
    /** Se resuelve tras la primera sincronización (o a los pocos segundos si no hay red) */
    firstSync: function () { return firstSyncPromise || Promise.resolve(); },

    start: function (user) {
      Sync.stop();
      if (!user || !W.Auth.db()) return Promise.resolve();
      var st = S();
      uid = user.uid;
      // Los datos locales eran de otra cuenta: se limpian antes de cargar los de esta
      if (st.meta.owner && st.meta.owner !== uid) st.clearLocal();
      st.setMeta('owner', uid);
      st.setMeta('guest', false);
      ref = F().doc(W.Auth.db(), 'users', uid, 'state', 'app');
      notesRef = F().doc(W.Auth.db(), 'users', uid, 'state', 'notes');
      active = true;
      Sync.setStatus('connecting');
      var resolveFirst;
      firstSyncPromise = new Promise(function (r) { resolveFirst = r; });
      setTimeout(function () { resolveFirst(); }, 5000);
      Sync.push(true).then(resolveFirst, resolveFirst);
      clearInterval(poll);
      poll = setInterval(function () {
        if (!document.hidden && active && !dirty && Date.now() - lastPush >= pollEvery(Date.now() - lastInput)) Sync.push();
      }, 5000);
      return firstSyncPromise;
    },
    stop: function () {
      active = false;
      ref = null; notesRef = null; uid = null; dirty = false;
      clearTimeout(timer); clearInterval(poll); clearTimeout(retryTimer);
      retryN = 0; Sync.retryAt = null; Sync.lastError = null; Sync.pendingSince = null;
      Sync.setStatus('off');
    },
    restart: function () { if (W.Auth.user) return Sync.start(W.Auth.user); return Promise.resolve(); },

    /** Llamado tras cada cambio local */
    schedule: function () {
      if (!active || applying) return;
      dirty = true;
      if (!Sync.pendingSince) Sync.pendingSince = Date.now();
      clearTimeout(timer);
      Sync.setStatus('pending');
      timer = setTimeout(function () { Sync.push(); }, PUSH_DELAY);
    },

    /**
     * Sube los cambios: transacción que lee la nube, fusiona y escribe.
     * Si la versión fusionada trae novedades de otro dispositivo, se aplican en local.
     */
    push: function (initial) {
      clearTimeout(timer);
      clearTimeout(retryTimer); Sync.retryAt = null;
      if (!active || !ref) return Promise.resolve();
      if (inFlight) { queued = true; return inFlight; }
      var myRef = ref, myNotes = notesRef;
      dirty = false;
      lastPush = Date.now();
      if (navigator.onLine === false) { Sync.setStatus('offline'); dirty = true; return Promise.resolve(); }
      inFlight = F().runTransaction(W.Auth.db(), function (tx) {
        return tx.get(myRef).then(function (snap) {
          return tx.get(myNotes).then(function (nsnap) {
            var main = snap.exists() ? snap.data() : null;
            var noteDoc = nsnap.exists() ? nsnap.data() : null;
            var remoteNotes = noteDoc && Array.isArray(noteDoc.notes) ? noteDoc.notes : (main && main.notes) || [];
            var remote = main || noteDoc ? Object.assign({}, main || {}, { notes: remoteNotes }) : null;
            var local = S().snapshot();
            var merged = Sync.merge(local, remote);
            // Lo que la marca de archivo deja fuera (de aquí o de la nube) se guarda en el archivo, no se pierde
            var cut = (merged.sync && merged.sync.archivedBefore) || 0;
            var toArchive = cut ? (local.tasks || []).concat((remote && remote.tasks) || []).filter(function (t) { return t && t.done && (t.doneAt || 0) < cut; }) : [];
            var mergedFp = Sync.fingerprint(merged);
            // Documento principal (sin los apuntes)
            var mainOut = JSON.parse(JSON.stringify(merged));
            delete mainOut.notes;
            var mainPrev = main ? Object.assign({}, main) : null;
            if (mainPrev) delete mainPrev.notes;
            // Antes de escribir: ¿cabe? (un documento de más de 1 MiB lo rechaza la nube)
            var bytes = utf8Size(JSON.stringify(mainOut));
            Sync.size = bytes;
            if (bytes > SIZE_MAX) throw { code: 'size', bytes: bytes };
            if (!mainPrev || Sync.fingerprint(mainOut) !== Sync.fingerprint(mainPrev)) {
              mainOut.updatedAt = Date.now();
              mainOut.device = /Android/i.test(navigator.userAgent) ? 'android' : window.WhiderDesktop ? 'desktop' : 'web';
              tx.set(myRef, mainOut);
            }
            // Apuntes, en su propio documento
            var notesOut = { notes: JSON.parse(JSON.stringify(merged.notes || [])) };
            if ((notesOut.notes.length || noteDoc) && Sync.fingerprint(notesOut) !== Sync.fingerprint({ notes: remoteNotes })) {
              notesOut.updatedAt = Date.now();
              tx.set(myNotes, notesOut);
            }
            return { merged: merged, changedLocal: mergedFp !== Sync.fingerprint(local), toArchive: toArchive };
          });
        });
      }).then(function (r) {
        if (myRef !== ref) return;
        if (r.toArchive && r.toArchive.length && S().addToArchive(r.toArchive)) Sync.archiveRemote(r.toArchive);
        if (r.changedLocal) {
          // Se vuelve a fusionar con el estado actual por si hubo cambios durante la subida
          var cur = S().snapshot();
          var finalMerged = Sync.merge(cur, r.merged);
          if (Sync.fingerprint(finalMerged) !== Sync.fingerprint(cur)) {
            applying = true;
            try { S().applySnapshot(finalMerged, 'sync'); } finally { applying = false; }
          }
        }
        retryN = 0; Sync.lastError = null;
        if (!dirty) Sync.pendingSince = null;
        Sync.setStatus(dirty ? 'pending' : 'synced');
        // Cerca del límite de 1 MB: se archivan solas las completadas de hace más de un año
        if (Sync.size > SIZE_WARN) Sync.autoArchive();
        // Un archivo que no llegó a subirse se vuelve a intentar (juntar por id no duplica nada)
        else if (S().meta.archivePending) Sync.archiveRemote(S().archived());
      }).catch(function (e) {
        dirty = true;
        if (!Sync.pendingSince) Sync.pendingSince = Date.now();
        var c = Sync.classify(e, { offline: navigator.onLine === false, verified: W.Auth.isVerified() });
        Sync.lastError = Object.assign({ code: (e && e.code) || '', at: Date.now() }, c);
        // Demasiado grande: se archiva lo completado hace tiempo y se vuelve a intentar una vez
        if (c.kind === 'size' && Sync.autoArchive()) { c = Object.assign({}, c, { retry: true }); Sync.lastError.retry = true; }
        if (c.kind === 'connection') Sync.setStatus('offline');
        else if (c.kind === 'unverified') Sync.setStatus('unverified');
        else { console.warn('Sincronización:', (e && e.code) || e); Sync.setStatus('error'); }
        // Reintentos espaciados (sin red se espera a que vuelva: lo avisa el navegador)
        if (c.retry && navigator.onLine !== false && active) {
          var wait = backoff(retryN++, c.slow);
          Sync.retryAt = Date.now() + wait;
          retryTimer = setTimeout(function () { retryTimer = null; Sync.retryAt = null; if (active) Sync.push(); }, wait);
        }
      }).then(function () {
        inFlight = null;
        if (queued) { queued = false; return Sync.push(); }
      });
      return inFlight;
    },
    /** Intenta subir lo pendiente antes de cerrar sesión (máx. 4 s) */
    flush: function () {
      if (!active) return Promise.resolve();
      return Promise.race([Sync.push(), new Promise(function (r) { setTimeout(r, 4000); })]);
    },
    deleteRemote: function () {
      if (!ref) return Promise.resolve();
      var r = ref, n = notesRef;
      Sync.stop();
      return Promise.all([F().deleteDoc(r), n ? F().deleteDoc(n) : null]).catch(function () { /* sin permiso o sin conexión */ });
    },
    /** Identificador de la cuenta conectada (o null) */
    uid: function () { return uid; },
    statusText: function () {
      var since = Sync.pendingSince && Date.now() - Sync.pendingSince > 60000 ? ' · cambios sin subir desde ' + W.U.fmtRel(Sync.pendingSince - Date.now()) : '';
      var next = Sync.retryAt ? ' · nuevo intento ' + W.U.fmtRel(Sync.retryAt - Date.now()) : '';
      switch (Sync.status) {
        case 'synced': return 'Sincronizado' + (Sync.lastAt ? ' · ' + W.U.fmtRel(Sync.lastAt - Date.now()) : '');
        case 'pending': return 'Guardando en la nube…';
        case 'connecting': return 'Conectando…';
        case 'offline': return 'Sin conexión · tus cambios se subirán al volver' + since;
        case 'unverified': return 'Verifica tu correo para activar la copia en la nube';
        case 'error': return (Sync.lastError ? Sync.lastError.text : 'No se pudo sincronizar') + next + since;
        default: return 'Solo en este dispositivo';
      }
    },
    /**
     * Archivo en la nube: users/{uid}/archive/{AAAA-MM-n}, cuatro documentos por mes (n = 0…3, fijo para
     * cada tarea según su id) para que ninguno se acerque al límite de 1 MB. Se juntan por id: subir dos
     * veces lo mismo no duplica nada.
     */
    archiveRemote: function (list) {
      if (!active || !uid || !list || !list.length) return Promise.resolve(false);
      var groups = {}, u = uid;
      list.forEach(function (t) {
        var h = 0;
        for (var i = 0; i < String(t.id).length; i++) h = (h + String(t.id).charCodeAt(i)) % 4;
        var d = new Date(t.doneAt || t.createdAt || Date.now()), k = d.getFullYear() + '-' + W.U.pad(d.getMonth() + 1) + '-' + h;
        (groups[k] = groups[k] || []).push(t);
      });
      return Object.keys(groups).reduce(function (pr, k) {
        return pr.then(function () {
          var r = F().doc(W.Auth.db(), 'users', u, 'archive', k);
          return F().runTransaction(W.Auth.db(), function (tx) {
            return tx.get(r).then(function (s) {
              var byId = {};
              // Copia limpia (Firestore no admite campos «undefined»)
              ((s.exists() && s.data().tasks) || []).concat(JSON.parse(JSON.stringify(groups[k]))).forEach(function (t) { if (t && t.id) byId[t.id] = t; });
              tx.set(r, { tasks: Object.keys(byId).map(function (id) { return byId[id]; }), updatedAt: Date.now() });
            });
          });
        });
      }, Promise.resolve()).then(function () { if (S().meta.archivePending) S().setMeta('archivePending', false); return true; }, function (e) {
        console.warn('Archivo:', (e && e.code) || e);
        S().setMeta('archivePending', true);
        return false;
      });
    },
    /** Archiva lo completado hace más de un año (y, si no basta, hace más de 6 meses) → ¿archivó algo? */
    autoArchive: function () {
      var st = S(), day = 86400000, gone = st.archiveDone(Date.now() - 400 * day);
      if (!gone.length && Sync.size > SIZE_MAX) gone = st.archiveDone(Date.now() - 180 * day);
      if (!gone.length) return false;
      Sync.archiveRemote(gone);
      if (W.Toast) W.Toast.show({ text: U2().plural(gone.length, 'tarea completada hace tiempo pasa', 'tareas completadas hace tiempo pasan') + ' al archivo (Ajustes → Datos)', icon: 'inbox', duration: 6000 });
      return true;
    },
    /** ¿Hay cambios de este dispositivo que no han llegado a la nube por un fallo? */
    unsaved: function () { return !!Sync.pendingSince && (Sync.status === 'offline' || Sync.status === 'error' || Sync.status === 'unverified'); }
  };

  window.addEventListener('online', function () { if (active) Sync.push(); });
  // Actividad: al volver a usar la app tras un rato sin tocarla, se trae lo último enseguida
  ['pointerdown', 'keydown', 'wheel', 'touchstart'].forEach(function (ev) {
    window.addEventListener(ev, function () {
      var was = lastInput;
      lastInput = Date.now();
      if (active && !dirty && !inFlight && lastInput - was > 120000 && lastInput - lastPush > POLL_EVERY) Sync.push();
    }, { passive: true, capture: true });
  });
  // Al volver a la app se traen los cambios hechos en otros dispositivos
  document.addEventListener('visibilitychange', function () {
    if (!active) return;
    if (document.hidden) { if (dirty) Sync.push(); } else Sync.push();
  });
  W.Sync = Sync;
})(window.Whider);
