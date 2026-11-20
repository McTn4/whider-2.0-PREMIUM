/**
 * WHIDER · Chats con tus contactos y con tus equipos
 *
 *  - Chats de dos (con cada contacto) y chat de cada equipo.
 *  - Mensajes de texto, tareas y páginas compartidas (se añaden a lo tuyo con un toque),
 *    respuestas, reacciones, editar y borrar lo tuyo, y leído hasta dónde.
 *  - Todo llega al momento: se escuchan la lista de tus chats y el chat abierto (W.Live). Con la app en otra
 *    pantalla, un mensaje nuevo hace saltar un aviso y una notificación (una sola vez, llegue por la escucha
 *    o por el buzón). Si no se puede escuchar, se consulta como antes: el chat abierto cada 3 s y la lista
 *    cada 25 s con Chats abierta (cada 2 min fuera).
 *
 * Firestore: chats/{id} (miembros y último mensaje) y chats/{id}/msgs/{mid} (mensajes).
 * Solo los miembros pueden leer y escribir; cada uno solo cambia sus mensajes. Ver firestore.rules.
 */
window.Whider = window.Whider || {};

(function (W) {
  'use strict';
  var U = W.U, S = function () { return W.State; };
  var F = function () { return W.Auth.sdk(); }, DB = function () { return W.Auth.db(); };
  var CACHE = 'whider.chats.v1';
  var REACTIONS = [{ id: 'like', icon: 'thumb', label: W.t('Me gusta') }, { id: 'heart', icon: 'heart', label: W.t('Me encanta') }, { id: 'star', icon: 'star', label: W.t('Genial') }, { id: 'check', icon: 'check', label: W.t('Hecho') }, { id: 'flame', icon: 'flame', label: W.t('¡Fuego!') }, { id: 'smile', icon: 'smile', label: W.t('Jaja') }];
  var cache = (function () { try { var x = JSON.parse(localStorage.getItem(CACHE) || 'null'); return x && x.chats ? x : { chats: {}, msgs: {} }; } catch (e) { return { chats: {}, msgs: {} }; } })();
  var chats = cache.chats, msgs = cache.msgs, owner = cache.owner || null, openCid = null, listAt = 0, msgTimer = null, listTimer = null, subs = [], saveT = null, loading = {}, readT = null;
  // Escuchas: de quién es la lista, qué chat se escucha, si aún no ha llegado la primera lista y hasta dónde se ha avisado de cada chat
  var listFor = null, msgsFor = null, firstList = true, notified = {};

  function me() { return W.Auth && W.Auth.user ? W.Auth.user.uid : null; }
  function ready() { return W.People && W.People.canUse(); }
  function ref() { var a = Array.prototype.slice.call(arguments); return F().doc.apply(null, [DB()].concat(a)); }
  function col(cid) { return F().collection(DB(), 'chats', cid, 'msgs'); }
  function emit(r, cid) { subs.slice().forEach(function (fn) { try { fn(r, cid); } catch (e) { console.error(e); } }); }
  function persist() {
    clearTimeout(saveT);
    saveT = setTimeout(function () {
      var slim = {}; Object.keys(msgs).forEach(function (k) { slim[k] = msgs[k].slice(-60); });
      try { localStorage.setItem(CACHE, JSON.stringify({ chats: chats, msgs: slim, owner: me() || owner })); } catch (e) { /* sin espacio */ }
    }, 400);
  }
  /** Olvida los chats guardados en este dispositivo (otra cuenta o cuenta eliminada) */
  function forget() {
    clearTimeout(saveT); chats = {}; msgs = {}; openCid = null; notified = {};
    if (W.Live) { W.Live.stop('chats'); W.Live.stop('msgs'); }
    listFor = msgsFor = null;
    try { localStorage.removeItem(CACHE); } catch (e) { /* nada que borrar */ }
    emit('list');
  }
  if (W.Auth && W.Auth.onChange) W.Auth.onChange(function (u) {
    if (!u) return;
    if (owner && u.uid !== owner) forget();
    owner = u.uid;
  });

  function dmId(a, b) { var x = [a, b].sort(); return 'dm_' + x[0] + '_' + x[1]; }
  function teamId(sid) { return 'tm_' + sid; }
  function prefs(cid) { var c = S().social.chats; return c[cid] || { read: 0, muted: false, pinned: false, at: 0 }; }
  function setPrefs(cid, patch, silent) {
    var c = S().social.chats;
    c[cid] = Object.assign({ read: 0, muted: false, pinned: false, at: 0 }, c[cid] || {}, patch, { at: Date.now() });
    if (!silent) S().notify('social');
  }
  function preview(m) {
    if (m.del) return W.t('Mensaje eliminado');
    if (m.kind === 'task') return W.t('Tarea: {text}', { text: (m.ref && m.ref.text) || '' });
    if (m.kind === 'page') return W.t('Página: {text}', { text: (m.ref && m.ref.title) || '' });
    if (m.kind === 'cheer') return W.t('Ánimo: {text}', { text: m.text || '' });
    return String(m.text || '').slice(0, 120);
  }
  function title(c) {
    if (!c) return W.t('Chat');
    if (c.type === 'team') { var sp = S().social.spaces[c.sid]; return (sp && sp.name) || c.title || W.t('Equipo'); }
    var other = (c.memberIds || []).filter(function (x) { return x !== me(); })[0];
    var p = other && W.People.profile(other), f = other && S().social.friends[other];
    return (p && p.name) || (f && f.name) || (c.members && c.members[other]) || W.t('Contacto');
  }
  function other(c) { return c && c.type === 'dm' ? (c.memberIds || []).filter(function (x) { return x !== me(); })[0] : null; }
  function unread(c) { var p = prefs(c.id); return !!(c.last && c.last.by !== me() && (c.lastAt || 0) > (p.read || 0)); }

  /* ---------- Lista de chats ---------- */
  function refreshList() {
    if (!ready()) return Promise.resolve();
    // Escuchando la lista, ya está al día
    if (listLive()) return Promise.resolve();
    listAt = Date.now();
    var q = F().query(F().collection(DB(), 'chats'), F().where('memberIds', 'array-contains', me()));
    return F().getDocs(q).then(function (snap) {
      var seen = {};
      snap.forEach(function (d) { var x = d.data(); x.id = d.id; chats[d.id] = x; seen[d.id] = 1; });
      Object.keys(chats).forEach(function (k) { if (!seen[k] && chats[k].local !== true) delete chats[k]; });
      persist(); emit('list');
    }).catch(function (e) { console.warn('Chats:', e && (e.code || e.message)); emit('error'); });
  }
  function list() {
    if (!me()) return [];
    return Object.keys(chats).map(function (k) { return chats[k]; })
      .filter(function (c) { return !prefs(c.id).hidden && (c.type !== 'team' || (S().social.spaces[c.sid] && !S().social.spaces[c.sid].left)) && !(c.type === 'dm' && W.People && W.People.isBlocked(other(c))); })
      .sort(function (a, b) { return (prefs(b.id).pinned - prefs(a.id).pinned) || ((b.lastAt || b.createdAt || 0) - (a.lastAt || a.createdAt || 0)); });
  }

  /* ---------- Abrir o crear ---------- */
  /** Crea el chat si no existe (escribir sin leer antes: así las reglas no lo bloquean) y lo trae */
  function upsertChat(cid, data) {
    chats[cid] = Object.assign({ id: cid, createdAt: Date.now() }, chats[cid] || {}, data, { local: !(chats[cid] && !chats[cid].local) });
    return F().setDoc(ref('chats', cid), data, { merge: true }).then(function () {
      return F().getDoc(ref('chats', cid));
    }).then(function (s) {
      var x = s.exists() ? s.data() : data; x.id = cid; x.createdAt = x.createdAt || chats[cid].createdAt;
      chats[cid] = x; persist(); emit('list');
      return cid;
    });
  }
  function ensureDm(friendUid) {
    var cid = dmId(me(), friendUid);
    if (chats[cid] && !chats[cid].local) return Promise.resolve(cid);
    var ids = [me(), friendUid].sort(), members = {};
    members[me()] = W.People.myName();
    var f = S().social.friends[friendUid];
    members[friendUid] = (W.People.profile(friendUid) || {}).name || (f && f.name) || 'Contacto';
    return upsertChat(cid, { type: 'dm', memberIds: ids, members: members });
  }
  function ensureTeam(sid) {
    var cid = teamId(sid);
    return W.People.loadTeam(sid).then(function (t) {
      if (!t) throw { code: 'not-found' };
      var ids = Object.keys(t.members || {}).sort(), c = chats[cid];
      if (c && !c.local && JSON.stringify((c.memberIds || []).slice().sort()) === JSON.stringify(ids) && c.title === (t.name || 'Equipo')) return cid;
      return upsertChat(cid, { type: 'team', sid: sid, title: t.name || W.t('Equipo'), memberIds: ids, members: t.members || {} });
    });
  }

  /* ---------- Mensajes ---------- */
  function sortMsgs(cid) { (msgs[cid] || []).sort(function (a, b) { return a.at - b.at; }); }
  function mergeMsgs(cid, list) {
    var cur = msgs[cid] || (msgs[cid] = []), byId = {};
    cur.forEach(function (m, i) { byId[m.id] = i; });
    list.forEach(function (m) { if (byId[m.id] != null) cur[byId[m.id]] = m; else { cur.push(m); byId[m.id] = cur.length - 1; } });
    sortMsgs(cid);
    if (cur.length > 400) msgs[cid] = cur.slice(-400);
  }
  function loadMsgs(cid, older) {
    if (!ready() || loading[cid]) return Promise.resolve();
    loading[cid] = true;
    var cur = msgs[cid] || [], q;
    var last = cur.filter(function (m) { return !m.pending; }).slice(-1)[0];
    if (older && cur.length) q = F().query(col(cid), F().where('at', '<', cur[0].at), F().orderBy('at', 'desc'), F().limit(40));
    else if (last && !older) q = F().query(col(cid), F().where('at', '>=', last.at - 120000), F().orderBy('at', 'asc'), F().limit(150));
    else q = F().query(col(cid), F().orderBy('at', 'desc'), F().limit(60));
    return F().getDocs(q).then(function (snap) {
      var got = [];
      snap.forEach(function (d) { var x = d.data(); x.id = d.id; got.push(x); });
      mergeMsgs(cid, got);
      persist(); emit('msgs', cid);
      return got.length;
    }).catch(function (e) { console.warn('Mensajes:', e && (e.code || e.message)); emit('error', cid); return 0; }).then(function (n) { loading[cid] = false; return n; });
  }
  function send(cid, o) {
    var c = chats[cid]; if (!c) return Promise.reject({ code: 'no-chat' });
    var mid = U.uid('m').replace(/[^A-Za-z0-9_-]/g, ''), at = Date.now();
    var m = { by: me(), name: W.People.myName(), text: String(o.text || '').slice(0, 4000), at: at, kind: o.kind || 'text' };
    if (o.ref) m.ref = o.ref;
    if (o.reply) m.reply = { id: o.reply.id, name: o.reply.name || '', text: preview(o.reply).slice(0, 140) };
    var local = Object.assign({ id: mid, pending: true }, m);
    mergeMsgs(cid, [local]); emit('msgs', cid);
    var batch = F().writeBatch(DB());
    batch.set(F().doc(DB(), 'chats', cid, 'msgs', mid), m);
    batch.update(ref('chats', cid), { last: { by: m.by, name: m.name, text: preview(m), at: at }, lastAt: at });
    return batch.commit().then(function () {
      local.pending = false; delete local.pending;
      c.last = { by: m.by, name: m.name, text: preview(m), at: at }; c.lastAt = at;
      setPrefs(cid, { read: at }, true);
      persist(); emit('msgs', cid); emit('list');
      W.Audio.boop();
      // Aviso en el buzón de cada miembro (lo que hace saltar su notificación)
      (c.memberIds || []).filter(function (x) { return x !== me(); }).forEach(function (to) {
        var p = {}; p[cid] = at;
        W.People.send(to, 'pings', p).catch(function () { /* sin permiso: lo verá al abrir sus chats */ });
      });
      return mid;
    }).catch(function (e) {
      local.failed = true; delete local.pending;
      emit('msgs', cid);
      console.warn('Enviar:', e && (e.code || e.message));
      W.Toast.show({ text: W.t('No se pudo enviar. Toca el mensaje para reintentar.'), type: 'danger' });
      throw e;
    });
  }
  function retry(cid, mid) {
    var list = msgs[cid] || [], m = list.filter(function (x) { return x.id === mid; })[0];
    if (!m) return;
    msgs[cid] = list.filter(function (x) { return x.id !== mid; });
    send(cid, { text: m.text, kind: m.kind, ref: m.ref, reply: m.reply ? { id: m.reply.id, name: m.reply.name, text: m.reply.text } : null }).catch(function () {});
  }
  function patchMsg(cid, mid, patch, local) {
    var list = msgs[cid] || []; list.forEach(function (m) { if (m.id === mid) Object.assign(m, local || patch); });
    emit('msgs', cid);
    return F().updateDoc(F().doc(DB(), 'chats', cid, 'msgs', mid), patch).then(persist).catch(function (e) { console.warn('Mensaje:', e && (e.code || e.message)); W.Toast.show({ text: W.t('No se pudo cambiar el mensaje'), type: 'danger' }); loadMsgs(cid); });
  }
  function react(cid, mid, kind) {
    var m = (msgs[cid] || []).filter(function (x) { return x.id === mid; })[0]; if (!m) return;
    var mine = m.react && m.react[me()];
    var patch = {}; patch['react.' + me()] = mine === kind ? F().deleteField() : kind;
    var react0 = Object.assign({}, m.react || {}); if (mine === kind) delete react0[me()]; else react0[me()] = kind;
    patchMsg(cid, mid, patch, { react: react0 });
    W.Audio.select();
  }
  function edit(cid, mid, text) { return patchMsg(cid, mid, { text: String(text).slice(0, 4000), edited: Date.now() }); }
  function remove(cid, mid) { return patchMsg(cid, mid, { del: true, text: '', ref: F().deleteField() }, { del: true, text: '', ref: null }); }
  function markRead(cid) {
    var c = chats[cid]; if (!c) return;
    var at = Math.max(c.lastAt || 0, Date.now());
    if (prefs(cid).read >= (c.lastAt || 0)) return;
    setPrefs(cid, { read: at }, true);
    clearTimeout(readT);
    readT = setTimeout(function () { S().notify('social'); }, 1500);
    emit('list');
  }

  /* ---------- Avisos del buzón ---------- */
  function onPings(pings) {
    var news = {};
    Object.keys(pings).forEach(function (from) {
      var p = pings[from] || {};
      Object.keys(p).forEach(function (cid) { if (typeof p[cid] === 'number' && p[cid] > (prefs(cid).read || 0)) news[cid] = Math.max(news[cid] || 0, p[cid]); });
    });
    var ids = Object.keys(news); if (!ids.length) return;
    Promise.all(ids.map(function (cid) {
      // Escuchando la lista, el chat ya está al día
      if (listLive() && chats[cid] && (chats[cid].lastAt || 0) >= news[cid]) return null;
      return F().getDoc(ref('chats', cid)).then(function (s) { if (s.exists()) { var x = s.data(); x.id = cid; chats[cid] = x; } }).catch(function () {});
    })).then(function () {
      persist(); emit('list');
      ids.forEach(announce);
      S().notify('chats');
    });
  }
  /** Aviso de un mensaje nuevo de otra persona: una sola vez, llegue por la escucha de la lista o por el buzón */
  function announce(cid) {
    var c = chats[cid]; if (!c || !c.last || c.last.by === me()) return;
    var at = c.lastAt || 0;
    if (at <= (notified[cid] || 0) || at <= (prefs(cid).read || 0)) return;
    notified[cid] = at;
    if (cid === openCid && !document.hidden && S().activeScreen === 'chats') { (msgsLive(cid) ? Promise.resolve() : loadMsgs(cid)).then(function () { markRead(cid); }); return; }
    if (prefs(cid).muted) return;
    var t = title(c), body = (c.type === 'team' ? (c.last.name || '') + ': ' : '') + (c.last.text || '');
    W.Toast.show({ text: t + ': ' + body.slice(0, 90), icon: 'chat', duration: 5000, action: { label: W.t('Abrir'), fn: function () { Chat.openChat(cid); } } });
    W.Audio.chime();
    if (document.hidden || S().activeScreen !== 'chats') W.Notify.system(t, body.slice(0, 140), 'chat-' + cid);
  }

  /* ---------- Escuchas (W.Live) ---------- */
  function listLive() { return !!(listFor && W.Live && W.Live.ok('chats')); }
  function msgsLive(cid) { return !!(cid && msgsFor === cid && W.Live && W.Live.ok('msgs')); }
  /** La lista de tus chats, tal y como está en la nube */
  function onList(snap) {
    var seen = {}, fresh = [];
    snap.forEach(function (d) {
      var x = d.data(); x.id = d.id; seen[d.id] = 1;
      var old = chats[d.id];
      if (!firstList && x.last && x.last.by !== me() && (x.lastAt || 0) > ((old && old.lastAt) || 0)) fresh.push(d.id);
      chats[d.id] = x;
    });
    Object.keys(chats).forEach(function (k) { if (!seen[k] && chats[k].local !== true) delete chats[k]; });
    listAt = Date.now(); firstList = false;
    persist(); emit('list');
    fresh.forEach(announce);
  }
  /** El chat abierto: lo nuevo (y lo que se edita o se reacciona en los dos últimos minutos) llega al momento */
  function watchMsgs(cid) {
    W.Live.watch('msgs', function (L, d) {
      // Se calcula cada vez que se empieza a escuchar (también al volver a la app): solo lo que falta aquí
      var have = (msgs[cid] || []).filter(function (m) { return !m.pending && !m.failed; }), last = have[have.length - 1];
      var col2 = L.collectionLive(d, 'chats', cid, 'msgs');
      return last ? L.queryLive(col2, L.whereLive('at', '>=', last.at - 120000), L.orderByLive('at', 'asc'))
        : L.queryLive(col2, L.orderByLive('at', 'desc'), L.limitLive(60));
    }, function (snap) {
      if (msgsFor !== cid) return;
      var got = [];
      // Los que salen de la consulta (los más antiguos, al llegar nuevos) se quedan aquí
      snap.docChanges().forEach(function (ch) { if (ch.type === 'removed') return; var x = ch.doc.data(); x.id = ch.doc.id; got.push(x); });
      if (got.length) { mergeMsgs(cid, got); persist(); emit('msgs', cid); }
      if (openCid === cid && S().activeScreen === 'chats' && !document.hidden) markRead(cid);
    });
  }
  /** Escucha lo que toca: la lista con sesión y la comunidad disponibles, y el chat abierto en la pantalla Chats */
  function reconcile() {
    var u = ready() && W.Live && W.Live.available() ? me() : null;
    if (listFor !== u) {
      if (listFor && W.Live) W.Live.stop('chats');
      listFor = u; firstList = true;
      if (u) W.Live.watch('chats', function (L, d) { return L.queryLive(L.collectionLive(d, 'chats'), L.whereLive('memberIds', 'array-contains', u)); }, onList);
    }
    var want = u && openCid && S().activeScreen === 'chats' ? openCid : null;
    if (msgsFor !== want) {
      if (msgsFor && W.Live) W.Live.stop('msgs');
      msgsFor = want;
      if (want) watchMsgs(want);
    }
  }

  /* ---------- Ritmo ---------- */
  function tick() {
    reconcile();
    if (!ready() || document.hidden) return;
    // Solo sin escuchas (o mientras no están al día): consultar cada pocos segundos
    if (S().activeScreen === 'chats' && Date.now() - listAt > 25000 && !listLive()) refreshList();
    if (openCid && S().activeScreen === 'chats' && !msgsLive(openCid)) loadMsgs(openCid).then(function (n) { if (n) markRead(openCid); });
  }

  var Chat = {
    REACTIONS: REACTIONS,
    subscribe: function (fn) { subs.push(fn); return function () { subs = subs.filter(function (x) { return x !== fn; }); }; },
    me: me, ready: ready, dmId: dmId, teamId: teamId, title: title, other: other, preview: preview, prefs: prefs, setPrefs: setPrefs, unread: unread,
    forget: forget,
    list: list, get: function (cid) { return chats[cid] || null; }, messages: function (cid) { return msgs[cid] || []; },
    refreshList: refreshList, loadMsgs: loadMsgs, send: send, retry: retry, react: react, edit: edit, remove: remove, markRead: markRead, onPings: onPings,
    ensureDm: ensureDm, ensureTeam: ensureTeam,
    unreadCount: function () { return list().filter(unread).length; },
    setOpen: function (cid) {
      openCid = cid;
      reconcile();
      if (cid && msgsLive(cid)) markRead(cid);
      else if (cid) loadMsgs(cid).then(function () { markRead(cid); });
    },
    /** ¿Se escuchan la lista de chats y, si hay uno abierto, sus mensajes? */
    live: function () { return listLive() && (!msgsFor || msgsLive(msgsFor)); },
    /** ¿Se escucha la lista de chats? (entonces los avisos de mensajes del buzón sobran) */
    listLive: listLive,
    open: function () { return openCid; },
    /** Abre (o crea) un chat: { uid } de un contacto, { team } de un equipo o el id de un chat */
    openChat: function (target) {
      var go = typeof target === 'string' ? Promise.resolve(target) : target && target.uid ? ensureDm(target.uid) : target && target.team ? ensureTeam(target.team) : Promise.reject({ code: 'invalid' });
      return go.then(function (cid) {
        S().ui.chat = cid;
        if (S().activeScreen !== 'chats') W.Router.go('chats'); else W.Router.refresh();
        return cid;
      }).catch(function (e) {
        console.warn('Chat:', e && (e.code || e.message));
        var b = W.People.blocker();
        W.Toast.show({ text: b ? b.title : W.t('No se pudo abrir el chat'), type: 'danger' });
      });
    },
    init: function () {
      clearInterval(msgTimer); clearInterval(listTimer);
      msgTimer = setInterval(tick, 3000);
      listTimer = setInterval(function () { if (ready() && !document.hidden && Date.now() - listAt > 120000 && !listLive()) refreshList(); }, 30000);
      setTimeout(function () { reconcile(); if (ready()) refreshList(); }, 4000);
    }
  };
  W.Chat = Chat;
})(window.Whider);
