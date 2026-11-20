/**
 * WHIDER · Sincronización del Cuaderno
 *
 *  - Mis páginas: índice en users/{uid}/state/pages y cada página en users/{uid}/pages/{id}.
 *  - Páginas de equipo: índice dentro de spaces/{id} (campo «pages») y cada página en
 *    spaces/{id}/pages/{pid}. Solo los miembros del equipo pueden leerlas y cambiarlas.
 *  - Se fusiona bloque a bloque: si dos personas cambian bloques distintos de la misma página,
 *    se conservan los dos cambios; si cambian el mismo a la vez (los dos después de la última vez
 *    que este dispositivo vio la página en la nube), se queda el más reciente y, justo debajo, una
 *    nota con la otra versión: no se pierde ninguna de las dos.
 *  - Lo que cambia en la nube llega al momento: se escucha el índice de tus páginas y el de cada equipo (W.Live)
 *    y, cuando cambia, se sincroniza solo ese ámbito y se traen las páginas que han cambiado. Si no se puede
 *    escuchar, se vuelve a consultar como antes (cada 15-30 s y, la página de equipo abierta, cada 4 s).
 */
window.Whider = window.Whider || {};

(function (W) {
  'use strict';
  var P = function () { return W.Pages; };
  var F = function () { return W.Auth.sdk(); }, DB = function () { return W.Auth.db(); };
  var KEY = 'whider.pagesync.v1';
  var uid = null, active = false, timer = null, poll = null, livePoll = null, inFlight = null, queued = false, lastRun = 0, warnedBig = {};
  // Escuchas: huella del índice de cada ámbito que llegó de la nube y la que ya está sincronizada aquí; ámbitos por sincronizar
  var remoteIdx = {}, lastIdx = {}, queuedSome = {}, checkT = null, watching = {};
  // Ámbitos ya al día en esta sesión (sin fallos al traer páginas): los adjuntos solo se limpian en ellos
  var settled = {};
  // Pendiente de subir: borrados por ámbito; y versión del contenido que ya está en la nube
  // seen: cuándo vio este dispositivo por última vez cada página tal como está en la nube
  var pend = (function () { try { var x = JSON.parse(localStorage.getItem(KEY) || 'null'); if (x && x.del) { x.cvs = x.cvs || {}; x.seen = x.seen || {}; return x; } } catch (e) { /* vacío */ } return { del: {}, cvs: {}, seen: {} }; })();
  var TOMB_DAYS = 45 * 86400000;

  function savePend() { try { localStorage.setItem(KEY, JSON.stringify(pend)); } catch (e) { /* sin espacio */ } }
  function ref() { var a = Array.prototype.slice.call(arguments); return F().doc.apply(null, [DB()].concat(a)); }
  function scopeKey(team) { return team ? 't:' + team : 'me'; }
  function idxRef(team) { return team ? ref('spaces', team) : ref('users', uid, 'state', 'pages'); }
  function pageRef(team, id) { return team ? ref('spaces', team, 'pages', id) : ref('users', uid, 'pages', id); }
  function teams() {
    var sp = (W.State.social && W.State.social.spaces) || {};
    return Object.keys(sp).filter(function (k) { return !sp[k].left; });
  }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function prune(del) {
    var out = {}, old = Date.now() - TOMB_DAYS;
    Object.keys(del || {}).forEach(function (k) { if (del[k] > old) out[k] = del[k]; });
    return out;
  }

  /* ---------- Fusiones ---------- */
  /** Nota con la versión que no ganó (id fijo: si los dos dispositivos la crean, es la misma) */
  function conflictCopy(bl) {
    var id = (String(bl.id) + '-v' + (bl.at || 0).toString(36)).slice(0, 60);
    return { id: id, t: 'callout', ic: 'alert', x: W.t('Otra versión (se editó a la vez en otro sitio):') + ' ' + (bl.x || ''), at: bl.at || 0 };
  }
  /**
   * mergeContent(a, b, since): fusión de dos versiones de una página. `since` es cuándo vio este
   * dispositivo la página en la nube por última vez: un bloque cambiado en los dos lados después de
   * ese momento es una edición a la vez, y se conservan las dos versiones.
   */
  function mergeContent(a, b, since) {
    a = a || { blocks: [], del: {}, cv: 0 }; b = b || { blocks: [], del: {}, cv: 0 };
    var del = {};
    [a.del || {}, b.del || {}].forEach(function (d) { Object.keys(d).forEach(function (k) { del[k] = Math.max(del[k] || 0, d[k]); }); });
    var map = {};
    [a.blocks || [], b.blocks || []].forEach(function (list) { list.forEach(function (bl) { var c = map[bl.id]; if (!c || (bl.at || 0) > (c.at || 0)) map[bl.id] = bl; }); });
    Object.keys(map).forEach(function (id) { if (del[id] && del[id] >= (map[id].at || 0)) delete map[id]; });
    // Ediciones a la vez del mismo bloque de texto: además del ganador, una nota con la otra versión
    var extra = {};
    if (since) {
      var ma = {}, mb = {};
      (a.blocks || []).forEach(function (bl) { ma[bl.id] = bl; });
      (b.blocks || []).forEach(function (bl) { mb[bl.id] = bl; });
      Object.keys(map).forEach(function (id) {
        var x = ma[id], y = mb[id];
        if (!x || !y || typeof x.x !== 'string' || typeof y.x !== 'string' || x.x === y.x) return;
        if ((x.at || 0) <= since || (y.at || 0) <= since) return;
        var copy = conflictCopy(map[id] === x ? y : x);
        if (!map[copy.id] && !del[copy.id]) extra[id] = copy;
      });
    }
    var primary = (a.cv || 0) >= (b.cv || 0) ? a : b, secondary = primary === a ? b : a;
    var order = (primary.blocks || []).map(function (x) { return x.id; }).filter(function (id) { return map[id]; });
    (secondary.blocks || []).forEach(function (bl, i) {
      if (!map[bl.id] || order.indexOf(bl.id) >= 0) return;
      var prev = i > 0 ? secondary.blocks[i - 1].id : null, pos = prev ? order.indexOf(prev) : -1;
      order.splice(pos + 1, 0, bl.id);
    });
    Object.keys(extra).forEach(function (id) {
      var c = extra[id];
      map[c.id] = c;
      order.splice(order.indexOf(id) + 1, 0, c.id);
    });
    return { blocks: order.map(function (id) { return map[id]; }), del: prune(del), cv: Math.max(a.cv || 0, b.cv || 0) };
  }
  /** Índice de un ámbito (mis páginas o un equipo): lo más reciente de cada ficha y los borrados */
  function mergeIndex(localItems, remote, team) {
    remote = remote || {};
    var items = {}, del = Object.assign({}, remote.del || remote.pdel || {}), sk = scopeKey(team);
    Object.keys(pend.del[sk] || {}).forEach(function (k) { del[k] = Math.max(del[k] || 0, pend.del[sk][k]); });
    var R = remote.items || remote.pages || {};
    Object.keys(R).forEach(function (k) { var m = P().cleanMeta(R[k]); if (m) items[k] = m; });
    var moved = [];
    // Lo que se ha ido de este ámbito (pasó a otro equipo o a mis páginas) se marca como borrado aquí
    Object.keys(items).forEach(function (k) {
      var loc = P().get(k);
      if (loc && (loc.team || null) !== (team || null) && loc.at >= items[k].at) { del[k] = Math.max(del[k] || 0, loc.at); moved.push(k); }
    });
    // La ficha más reciente gana, pero la versión del contenido es siempre la mayor de las dos
    localItems.forEach(function (m) {
      var r = items[m.id];
      if (!r || m.at > r.at) items[m.id] = Object.assign({}, m, { cv: Math.max(m.cv || 0, r ? r.cv || 0 : 0) });
      else r.cv = Math.max(r.cv || 0, m.cv || 0);
    });
    Object.keys(items).forEach(function (k) { if (del[k] && del[k] >= items[k].at) delete items[k]; });
    return { items: items, del: prune(del), moved: moved };
  }
  function fp(o) { return JSON.stringify(o); }
  /** Huella estable: no depende del orden de las claves (el de la nube no tiene por qué ser el de aquí) */
  function sfp(v) {
    if (Array.isArray(v)) return '[' + v.map(function (x) { return x === undefined ? 'null' : sfp(x); }).join(',') + ']';
    if (v && typeof v === 'object') return '{' + Object.keys(v).filter(function (k) { return v[k] !== undefined; }).sort().map(function (k) { return JSON.stringify(k) + ':' + sfp(v[k]); }).join(',') + '}';
    return JSON.stringify(v);
  }
  /** Huella del índice de un ámbito tal y como está en la nube (users/{uid}/state/pages o spaces/{id}) */
  function idxFp(team, d) { d = d || {}; return team ? sfp([d.pages || {}, d.pdel || {}]) : sfp([d.items || {}, d.del || {}]); }
  function strip(meta) { var m = clone(meta); delete m.team; return m; }

  /* ---------- Un ámbito ---------- */
  function syncScope(team) {
    var I = P().index(), sk = scopeKey(team);
    var local = Object.keys(I.items).map(function (k) { return I.items[k]; }).filter(function (m) { return (m.team || null) === (team || null); });
    var dirty = local.filter(function (m) { return (I.dirty[m.id] || 0) & 2; }).slice(0, 15);
    var deletes = Object.keys(pend.del[sk] || {});
    var result = null;
    return F().runTransaction(DB(), function (tx) {
      var iRef = idxRef(team);
      return tx.get(iRef).then(function (snap) {
        if (team && !snap.exists()) throw { code: 'not-found-team' };
        var remoteDoc = snap.exists() ? snap.data() : null;
        var merged = mergeIndex(local, team ? { pages: (remoteDoc || {}).pages, pdel: (remoteDoc || {}).pdel } : remoteDoc, team);
        var reads = dirty.map(function (m) { return tx.get(pageRef(team, m.id)); });
        return Promise.all(reads).then(function (snaps) {
          var contents = {};
          snaps.forEach(function (s, i) {
            var m = dirty[i];
            if (!merged.items[m.id]) return;
            var remoteC = s.exists() ? s.data() : null;
            var mine = clone(P().content(m.id)); mine.cv = m.cv || 0;
            var mc = mergeContent(mine, remoteC ? { blocks: remoteC.blocks || [], del: remoteC.del || {}, cv: remoteC.cv || 0 } : null, pend.seen[m.id] || 0);
            var out = { blocks: mc.blocks.map(P().cleanBlock).filter(Boolean), del: mc.del, cv: Math.max(mc.cv, m.cv || 0), updatedAt: Date.now() };
            var size = fp(out).length;
            if (size > 950000) {
              out.blocks = out.blocks.map(function (b) { return b.t === 'img' && /^data:/.test(b.src || '') ? Object.assign({}, b, { src: '' }) : b; });
              if (!warnedBig[m.id]) { warnedBig[m.id] = 1; W.Toast.show({ text: W.t('Las imágenes de «{name}» son muy grandes para la nube: se quedan en este dispositivo.', { name: P().title(m) }), icon: 'cloud', duration: 6000 }); }
            }
            tx.set(pageRef(team, m.id), out);
            if (merged.items[m.id]) merged.items[m.id].cv = Math.max(merged.items[m.id].cv || 0, out.cv);
            mc.snapCv = m.cv || 0;
            contents[m.id] = mc;
          });
          merged.moved.concat(deletes).forEach(function (k) { if (!contents[k]) tx.delete(pageRef(team, k)); });
          var idxOut = {}; Object.keys(merged.items).forEach(function (k) { idxOut[k] = strip(merged.items[k]); });
          // Lo que quedará en la nube al terminar: con esa huella, la escucha sabe que no hay nada nuevo
          var after = remoteDoc;
          if (team) {
            var before = remoteDoc || {};
            if (sfp(before.pages || {}) !== sfp(idxOut) || sfp(before.pdel || {}) !== sfp(merged.del)) {
              after = Object.assign({}, before, { pages: idxOut, pdel: merged.del, updatedAt: Date.now() });
              tx.set(iRef, after);
            }
          } else if (!remoteDoc || sfp(remoteDoc.items || {}) !== sfp(idxOut) || sfp(remoteDoc.del || {}) !== sfp(merged.del)) {
            after = { v: 1, items: idxOut, del: merged.del, updatedAt: Date.now() };
            tx.set(iRef, after);
          }
          result = { merged: merged, contents: contents, remote: remoteDoc, idx: idxFp(team, after) };
        });
      });
    }).then(function () {
      if (!result) return;
      lastIdx[sk] = result.idx;
      var merged = result.merged;
      // Aplicar en local: fichas nuevas o más recientes, borrados y contenidos fusionados
      Object.keys(merged.items).forEach(function (k) {
        var m = Object.assign({}, merged.items[k], { team: team || null }), loc = P().get(k);
        if (!loc || m.at > loc.at) P().applyMeta(m);
      });
      Object.keys(merged.del).forEach(function (k) { var loc = P().get(k); if (loc && (loc.team || null) === (team || null) && merged.del[k] >= loc.at) P().forget(k, merged.del[k]); });
      Object.keys(result.contents).forEach(function (k) {
        var c = result.contents[k], loc = P().get(k); if (!loc) return;
        // Si se siguió escribiendo durante la subida, se vuelve a fusionar con lo último
        var now = clone(P().content(k)); now.cv = loc.cv || 0;
        var fin = (loc.cv || 0) > c.snapCv ? mergeContent(now, c) : c;
        P().applyContent(k, fin, Math.max(fin.cv || 0, loc.cv || 0));
        pend.cvs[k] = Math.max(c.cv || 0, c.snapCv);
        pend.seen[k] = Date.now();
        if ((loc.cv || 0) <= c.snapCv) P().clean(k, 2);
      });
      local.forEach(function (m) { if (!((P().index().dirty[m.id] || 0) & 2)) P().clean(m.id, 1); });
      delete pend.del[sk]; savePend();
      // Contenidos que han cambiado en otro dispositivo (o los cambió un compañero)
      var need = Object.keys(merged.items).filter(function (k) {
        var loc = P().get(k), r = merged.items[k];
        return loc && !result.contents[k] && (r.cv || 0) > (pend.cvs[k] || 0) && !(((P().index().dirty[k] || 0) & 2));
      });
      return fetchContents(team, need).then(function (failed) { if (failed) delete settled[sk]; else settled[sk] = Date.now(); });
    });
  }
  /** Trae el contenido de esas páginas → número de las que no se pudieron traer */
  function fetchContents(team, ids) {
    var chunks = [], failed = 0;
    for (var i = 0; i < ids.length; i += 8) chunks.push(ids.slice(i, i + 8));
    return chunks.reduce(function (pr, chunk) {
      return pr.then(function () {
        return Promise.all(chunk.map(function (id) {
          return F().getDoc(pageRef(team, id)).then(function (s) {
            var loc = P().get(id); if (!loc) return;
            if (!s.exists()) { pend.cvs[id] = loc.cv || 0; return; }
            var r = s.data(), mine = clone(P().content(id)); mine.cv = loc.cv || 0;
            var mc = mergeContent(mine, { blocks: r.blocks || [], del: r.del || {}, cv: r.cv || 0 }, pend.seen[id] || 0);
            P().applyContent(id, mc, mc.cv);
            pend.cvs[id] = Math.max(mc.cv, r.cv || 0);
            pend.seen[id] = Date.now();
            if (((P().index().dirty[id] || 0) & 2) === 0 && sfp(mc.blocks) !== sfp(r.blocks || [])) P().index().dirty[id] = (P().index().dirty[id] || 0) | 2;
          }).catch(function () { failed++; /* sin permiso o sin conexión */ });
        }));
      });
    }, Promise.resolve()).then(function () { P().saveNow(); savePend(); return failed; });
  }

  /* ---------- Ciclo ---------- */
  /** Sincroniza todos los ámbitos o solo los de `list` (null = mis páginas, o el id de un equipo) */
  function run(list) {
    if (!active || !uid || !DB()) return Promise.resolve();
    if (inFlight) {
      if (Array.isArray(list)) list.forEach(function (t) { queuedSome[scopeKey(t)] = t; }); else queued = true;
      return inFlight;
    }
    if (navigator.onLine === false) return Promise.resolve();
    var mine = teams(), all = !Array.isArray(list);
    if (all) lastRun = Date.now();
    var scopes = all ? [null].concat(mine) : list.filter(function (t) { return !t || mine.indexOf(t) >= 0; });
    // Sin nada por subir aquí, los ámbitos que se escuchan y no han cambiado en la nube no hace falta leerlos
    if (all && !localDirt()) scopes = scopes.filter(function (t) { return !upToDate(t); });
    inFlight = scopes.reduce(function (pr, team) {
      return pr.then(function () {
        return syncScope(team).catch(function (e) {
          var sk = scopeKey(team);
          delete settled[sk];
          // Lo que no se ha podido sincronizar no se vuelve a pedir por la escucha hasta que vuelva a cambiar
          if (remoteIdx[sk] !== undefined) lastIdx[sk] = remoteIdx[sk];
          if (e && e.code === 'not-found-team') return;
          if (e && e.code === 'permission-denied' && team) { console.warn('Cuaderno: sin acceso al equipo', team); return; }
          console.warn('Cuaderno:', e && (e.code || e.message) || e);
        });
      });
    }, Promise.resolve()).then(function () {
      inFlight = null;
      if (queued) { queued = false; queuedSome = {}; return run(); }
      var some = Object.keys(queuedSome);
      if (some.length) { var next = some.map(function (k) { return queuedSome[k]; }); queuedSome = {}; return run(next); }
      watchIndexes();
      checkScopes();
      if (W.Files) W.Files.maintain(1500);
    });
    return inFlight;
  }

  /* ---------- Escuchas (W.Live) ---------- */
  function liveKey(sk) { return 'pages:' + sk; }
  /** Escucha el índice de mis páginas y el de cada equipo (y deja de escuchar los equipos de los que sales) */
  function watchIndexes() {
    if (!active || !uid || !W.Live || !W.Live.available()) return;
    var want = { me: null }, u = uid;
    teams().forEach(function (t) { want[scopeKey(t)] = t; });
    Object.keys(watching).forEach(function (sk) { if (!(sk in want)) { W.Live.stop(liveKey(sk)); delete watching[sk]; delete remoteIdx[sk]; } });
    Object.keys(want).forEach(function (sk) {
      if (watching[sk]) return;
      var team = want[sk];
      watching[sk] = true;
      W.Live.watch(liveKey(sk), function (L, d) { return team ? L.docLive(d, 'spaces', team) : L.docLive(d, 'users', u, 'state', 'pages'); }, function (snap) {
        if (!active || uid !== u) return;
        remoteIdx[sk] = idxFp(team, snap.exists() ? snap.data() : null);
        clearTimeout(checkT);
        checkT = setTimeout(checkScopes, 250);
      });
    });
  }
  function unwatchIndexes() {
    Object.keys(watching).forEach(function (sk) { if (W.Live) W.Live.stop(liveKey(sk)); });
    watching = {}; remoteIdx = {}; lastIdx = {}; queuedSome = {}; clearTimeout(checkT);
  }
  /** Ámbitos cuyo índice en la nube ha cambiado desde la última vez que se sincronizaron aquí */
  function checkScopes() {
    if (!active || inFlight) return;
    var list = [];
    Object.keys(remoteIdx).forEach(function (sk) {
      if (remoteIdx[sk] === lastIdx[sk]) return;
      list.push(sk === 'me' ? null : sk.slice(2));
    });
    if (list.length) run(list);
  }
  /** ¿Se escuchan todos los ámbitos? (entonces no hace falta consultar la nube cada cierto tiempo). Un equipo al
   *  que ya no tienes acceso no cuenta: consultarlo tampoco serviría */
  function liveAll() {
    if (!W.Live || !W.Live.available()) return false;
    return ['me'].concat(teams().map(scopeKey)).every(function (sk) { return watching[sk] && (W.Live.ok(liveKey(sk)) || W.Live.denied(liveKey(sk))); });
  }
  /** ¿Hay algo de este dispositivo por subir? (fichas o contenidos cambiados, o borrados pendientes) */
  function localDirt() {
    var d = P().index().dirty || {};
    if (Object.keys(d).some(function (k) { return d[k]; })) return true;
    return Object.keys(pend.del).some(function (sk) { return Object.keys(pend.del[sk] || {}).length > 0; });
  }
  /** Un ámbito al día: se escucha, la nube no ha cambiado desde la última vez y lo último se trajo entero */
  function upToDate(team) {
    var sk = scopeKey(team);
    return !!(watching[sk] && W.Live && W.Live.ok(liveKey(sk)) && settled[sk] && lastIdx[sk] !== undefined && remoteIdx[sk] === lastIdx[sk]);
  }
  /** Página de equipo abierta: lo que escriben los demás llega en unos segundos */
  function livePage() {
    if (!active || document.hidden) return;
    var id = W.State.activeScreen === 'notes' ? W.State.ui.page : null, m = id ? P().get(id) : null;
    if (!m || !m.team) return;
    // Escuchando el índice del equipo, los cambios de esta página llegan solos
    if (watching[scopeKey(m.team)] && W.Live && W.Live.ok(liveKey(scopeKey(m.team)))) return;
    F().getDoc(pageRef(m.team, id)).then(function (s) {
      if (!s.exists()) return;
      var r = s.data(), loc = P().get(id); if (!loc) return;
      if ((r.cv || 0) <= (pend.cvs[id] || 0)) return;
      var mine = clone(P().content(id)); mine.cv = loc.cv || 0;
      var mc = mergeContent(mine, { blocks: r.blocks || [], del: r.del || {}, cv: r.cv || 0 }, pend.seen[id] || 0);
      P().applyContent(id, mc, mc.cv);
      pend.cvs[id] = r.cv || 0; pend.seen[id] = Date.now(); savePend();
    }).catch(function () { /* sin conexión */ });
  }

  var PageSync = {
    mergeContent: mergeContent,
    start: function (user) {
      PageSync.stop();
      if (!user || !DB()) return;
      uid = user.uid; active = true;
      setTimeout(function () { run(); }, 1200);
      poll = setInterval(function () {
        if (document.hidden || !active) return;
        // Escuchando la nube (también los equipos nuevos): no hace falta consultarla cada cierto tiempo
        watchIndexes();
        if (liveAll()) return;
        var every = W.State.activeScreen === 'notes' ? 15000 : 30000;
        // Sin tocar la app, cada vez menos a menudo (como la sincronización de tareas)
        if (W.Sync && W.Sync.idleFor) every = Math.max(every, W.Sync.pollEvery(W.Sync.idleFor()));
        if (Date.now() - lastRun >= every) run();
      }, 5000);
      livePoll = setInterval(livePage, 4000);
    },
    stop: function () { active = false; uid = null; settled = {}; clearTimeout(timer); clearInterval(poll); clearInterval(livePoll); unwatchIndexes(); },
    /** ¿Se escucha la nube? (los cambios de otros dispositivos y del equipo llegan solos) */
    live: liveAll,
    /** ¿Las páginas de este ámbito ('me' o 't:<equipo>') están al día en esta sesión? */
    settled: function (sk) { return !!settled[sk]; },
    schedule: function () {
      if (!active) return;
      clearTimeout(timer);
      timer = setTimeout(function () { run(); }, 900);
    },
    now: function () { return run(); },
    /** Borrado definitivo: también desaparece de la nube */
    removed: function (meta) {
      if (!meta) return;
      var sk = scopeKey(meta.team);
      pend.del[sk] = pend.del[sk] || {};
      pend.del[sk][meta.id] = Date.now();
      savePend();
    },
    /** Al eliminar la cuenta: se borran de la nube todas tus páginas y su índice */
    deleteRemote: function () {
      var u = W.Auth && W.Auth.user ? W.Auth.user.uid : null;
      if (!u || !DB()) return Promise.resolve();
      PageSync.stop();
      pend = { del: {}, cvs: {}, seen: {} }; savePend();
      return F().getDocs(F().collection(DB(), 'users', u, 'pages')).then(function (snap) {
        var refs = [];
        snap.forEach(function (d) { refs.push(d.ref); });
        refs.push(F().doc(DB(), 'users', u, 'state', 'pages'));
        var chain = Promise.resolve();
        for (var i = 0; i < refs.length; i += 400) {
          (function (part) { chain = chain.then(function () { var b = F().writeBatch(DB()); part.forEach(function (r) { b.delete(r); }); return b.commit(); }); })(refs.slice(i, i + 400));
        }
        return chain;
      }).catch(function (e) { console.warn('Cuaderno:', e && (e.code || e.message)); });
    },
    /** Una página de equipo pasa a tus páginas: se quita del equipo */
    leaveTeam: function (id) {
      var m = P().get(id); if (!m || !m.team) return;
      [m].concat(P().descendants(id)).forEach(function (x) { PageSync.removed(x); });
    }
  };
  W.PageSync = PageSync;

  // Se enciende y se apaga con la sincronización de la cuenta
  if (W.Auth && W.Auth.onChange) {
    W.Auth.onChange(function (user) {
      if (user && W.Auth.isVerified && W.Auth.isVerified()) setTimeout(function () { if (W.Auth.db()) PageSync.start(user); }, 800);
      else PageSync.stop();
    });
  }
  window.addEventListener('online', function () { if (active) run(); });
  document.addEventListener('visibilitychange', function () { if (!document.hidden && active && Date.now() - lastRun > 10000 && !liveAll()) run(); });
})(window.Whider);
