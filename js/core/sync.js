/**
 * WHIDER · Sincronización con la nube (Cloud Firestore, versión ligera)
 *
 * Modelo "local primero": todo se guarda al instante en el dispositivo y, con sesión
 * iniciada, se sincroniza con users/{uid}/state/app. Cada subida es una TRANSACCIÓN que
 * lee la versión de la nube, la FUSIONA con la local y escribe el resultado, así dos
 * dispositivos nunca se pisan:
 *  - Tareas y marcas personales: gana la modificación más reciente de cada elemento.
 *  - Borrados: se recuerdan para que no "resuciten" desde otro dispositivo.
 *  - Historial diario, enfoque y récords: se conserva el valor más alto.
 * Se sincroniza al abrir, al volver a la app, cada minuto mientras está abierta y tras cada cambio.
 * Sin conexión no pasa nada: los datos ya están guardados y se suben al volver la red.
 */
window.Whider = window.Whider || {};

(function (W) {
  'use strict';
  var F = function () { return W.Auth.sdk(); }, S = function () { return W.State; };
  var ref = null, timer = null, poll = null, applying = false, active = false, uid = null;
  var dirty = false, inFlight = null, queued = false, freshDevice = false, firstSyncPromise = null;
  var listeners = [];

  var Sync = {
    status: 'off',       // off · connecting · synced · pending · offline · unverified · error
    lastAt: null,
    onStatus: function (fn) { listeners.push(fn); },

    setStatus: function (s) {
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

      // Tareas
      var byId = {};
      (a.tasks || []).concat(b.tasks || []).forEach(function (t) {
        if (!t || !t.id) return;
        if (!byId[t.id] || stamp(t) > stamp(byId[t.id])) byId[t.id] = t;
      });
      var tasks = Object.keys(byId).map(function (k) { return byId[k]; })
        .filter(function (t) { return !(deleted[t.id] && deleted[t.id] >= stamp(t)); })
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

      var ma = a.meta || {}, mb = b.meta || {};
      var seen = {};
      (ma.seenAchievements || []).concat(mb.seenAchievements || []).forEach(function (x) { seen[x] = true; });

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
        meta: {
          createdAt: Math.min(ma.createdAt || Date.now(), mb.createdAt || Date.now()),
          seenAchievements: Object.keys(seen),
          onboarded: !!(ma.onboarded || mb.onboarded)
        },
        sync: {
          deleted: deleted,
          settingsAt: Math.max(sa.settingsAt || 0, sb.settingsAt || 0),
          listsAt: Math.max(sa.listsAt || 0, sb.listsAt || 0),
          profileAt: Math.max(sa.profileAt || 0, sb.profileAt || 0),
          resetAt: Math.max(resetA, resetB)
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
      freshDevice = !st.meta.owner;
      st.setMeta('owner', uid);
      st.setMeta('guest', false);
      ref = F().doc(W.Auth.db(), 'users', uid, 'state', 'app');
      active = true;
      Sync.setStatus('connecting');
      var resolveFirst;
      firstSyncPromise = new Promise(function (r) { resolveFirst = r; });
      setTimeout(function () { resolveFirst(); }, 5000);
      Sync.push(true).then(resolveFirst, resolveFirst);
      clearInterval(poll);
      poll = setInterval(function () { if (!document.hidden && active && !dirty) Sync.push(); }, 60000);
      return firstSyncPromise;
    },
    stop: function () {
      active = false;
      ref = null; uid = null; dirty = false;
      clearTimeout(timer); clearInterval(poll);
      Sync.setStatus('off');
    },
    restart: function () { if (W.Auth.user) return Sync.start(W.Auth.user); return Promise.resolve(); },

    /** Llamado tras cada cambio local */
    schedule: function () {
      if (!active || applying) return;
      dirty = true;
      clearTimeout(timer);
      Sync.setStatus('pending');
      timer = setTimeout(function () { Sync.push(); }, 1500);
    },

    /**
     * Sube los cambios: transacción que lee la nube, fusiona y escribe.
     * Si la versión fusionada trae novedades de otro dispositivo, se aplican en local.
     */
    push: function (initial) {
      clearTimeout(timer);
      if (!active || !ref) return Promise.resolve();
      if (inFlight) { queued = true; return inFlight; }
      var myRef = ref;
      dirty = false;
      if (navigator.onLine === false) { Sync.setStatus('offline'); dirty = true; return Promise.resolve(); }
      inFlight = F().runTransaction(W.Auth.db(), function (tx) {
        return tx.get(myRef).then(function (snap) {
          var remote = snap.exists() ? snap.data() : null;
          // Un dispositivo nuevo que entra en una cuenta existente no sube sus tareas de ejemplo
          if (initial && remote && freshDevice && S().hasExamples()) {
            S().tasks = S().tasks.filter(function (t) { return !t.example; });
          }
          var local = S().snapshot();
          var merged = Sync.merge(local, remote);
          var mergedFp = Sync.fingerprint(merged);
          if (!remote || mergedFp !== Sync.fingerprint(remote)) {
            var data = JSON.parse(JSON.stringify(merged));
            data.updatedAt = Date.now();
            data.device = /Android/i.test(navigator.userAgent) ? 'android' : 'web';
            tx.set(myRef, data);
          }
          return { merged: merged, changedLocal: mergedFp !== Sync.fingerprint(local) };
        });
      }).then(function (r) {
        if (myRef !== ref) return;
        if (r.changedLocal) {
          // Se vuelve a fusionar con el estado actual por si hubo cambios durante la subida
          var cur = S().snapshot();
          var finalMerged = Sync.merge(cur, r.merged);
          if (Sync.fingerprint(finalMerged) !== Sync.fingerprint(cur)) {
            applying = true;
            try { S().applySnapshot(finalMerged, 'sync'); } finally { applying = false; }
          }
        }
        Sync.setStatus(dirty ? 'pending' : 'synced');
      }).catch(function (e) {
        dirty = true;
        var code = e && e.code;
        if (code === 'permission-denied') Sync.setStatus(W.Auth.isVerified() ? 'error' : 'unverified');
        else if (code === 'unavailable' || navigator.onLine === false) Sync.setStatus('offline');
        else { console.warn('Sincronización:', code || e); Sync.setStatus('error'); }
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
      var r = ref;
      Sync.stop();
      return F().deleteDoc(r).catch(function () { /* sin permiso o sin conexión */ });
    },
    statusText: function () {
      switch (Sync.status) {
        case 'synced': return 'Sincronizado' + (Sync.lastAt ? ' · ' + W.U.fmtRel(Sync.lastAt - Date.now()) : '');
        case 'pending': return 'Guardando en la nube…';
        case 'connecting': return 'Conectando…';
        case 'offline': return 'Sin conexión · se sincronizará al volver';
        case 'unverified': return 'Verifica tu correo para activar la copia en la nube';
        case 'error': return 'No se pudo sincronizar · reintentando';
        default: return 'Solo en este dispositivo';
      }
    }
  };

  window.addEventListener('online', function () { if (active) Sync.push(); });
  // Al volver a la app se traen los cambios hechos en otros dispositivos
  document.addEventListener('visibilitychange', function () {
    if (!active) return;
    if (document.hidden) { if (dirty) Sync.push(); } else Sync.push();
  });
  W.Sync = Sync;
})(window.Whider);
