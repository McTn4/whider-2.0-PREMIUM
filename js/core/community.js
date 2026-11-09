/**
 * WHIDER · Comunidad: personas (amigos y trabajo), equipos e invitaciones
 *
 * Arreglos de la 7.0:
 *  - Cualquiera con cuenta puede aceptar invitaciones, tener contactos y chatear. Premium sirve
 *    para invitar (código, enlace o QR) y para crear equipos: así nadie se queda sin poder
 *    responder a quien le invita.
 *  - Los avisos dicen qué pasa de verdad (sin cuenta, correo sin verificar, servidor sin las
 *    reglas nuevas o sin conexión) en vez de «revisa tu conexión» para todo.
 *  - El buzón se mira cada pocos segundos con Personas o Chats abiertos (antes, cada minuto).
 *  - Invitar con un enlace o un código QR: quien lo abre queda conectado al momento (sin
 *    esperar a que aceptes), y los enlaces de equipo meten directamente en el equipo.
 *
 * Firestore: profiles/{uid} (perfil público), codes/{código}, inbox/{uid} (buzón: cada
 * remitente solo escribe su entrada) y spaces/{id} (equipos). Ver firestore.rules.
 */
window.Whider = window.Whider || {};

(function (W) {
  'use strict';
  var U = W.U, S = function () { return W.State; };
  var F = function () { return W.Auth.sdk(); }, DB = function () { return W.Auth.db(); };
  var CACHE_KEY = 'whider.people.v1';
  var BOXES = ['requests', 'accepted', 'cheers', 'spaces', 'pings', 'links'];
  var profiles = (function () { try { return JSON.parse(localStorage.getItem(CACHE_KEY) || '{}') || {}; } catch (e) { return {}; } })();
  var inbox = { requests: {} }, teamData = {};
  var lastPoll = 0, lastProfiles = 0, ticker = null, errorState = null, failures = 0, publishTimer = null, subs = [], polling = null;
  var CHEERS = ['¡Vamos, tú puedes!', '¡Qué racha llevas!', 'A por el día de hoy', 'Te reto a completar 3 tareas hoy', 'Gran semana, sigue así', '¡Buen trabajo en equipo!'];

  function uid() { return W.Auth && W.Auth.user ? W.Auth.user.uid : null; }
  function ref() { var a = Array.prototype.slice.call(arguments); return F().doc.apply(null, [DB()].concat(a)); }
  function myName() { return (S().displayName() || (W.Auth.user && W.Auth.user.displayName) || 'Sin nombre').slice(0, 40); }
  function canUse() { return !!uid() && W.Auth.isVerified() && !!DB(); }
  function ready() { return canUse() && !!S().social.enabled; }
  function emit(r) { subs.slice().forEach(function (fn) { try { fn(r); } catch (e) { console.error(e); } }); }
  function saveCache() { try { localStorage.setItem(CACHE_KEY, JSON.stringify(profiles)); } catch (e) { /* sin espacio */ } }
  function fail(e) {
    var code = e && (e.code || e.message);
    console.warn('Comunidad:', code || e);
    errorState = code === 'permission-denied' ? 'permission' : (navigator.onLine === false || code === 'unavailable') ? 'offline' : 'network';
    failures++;
    emit('error');
    if (W.Router) W.Router.refresh();
    throw e;
  }
  function ok() { if (errorState) { errorState = null; emit('error'); } failures = 0; }

  /* ---------- Estado para las pantallas ---------- */
  /** Qué impide usar la comunidad (o null si todo va bien) */
  function blocker() {
    if (!(W.Auth && W.Auth.configured())) return { id: 'noaccounts', title: 'Cuentas no configuradas', text: 'Esta copia de WHIDER no tiene cuentas activadas.' };
    if (!uid()) return { id: 'guest', title: 'Necesitas una cuenta', text: 'Inicia sesión para conectar con tus amigos y tu equipo, chatear y compartir páginas.' };
    if (!W.Auth.isVerified()) return { id: 'unverified', title: 'Verifica tu correo', text: 'Te enviamos un enlace al registrarte. Ábrelo y vuelve aquí.' };
    if (!DB()) return { id: 'loading', title: 'Conectando…', text: 'Un momento.' };
    if (errorState === 'permission') return { id: 'permission', title: 'La comunidad no está disponible', text: 'El servidor todavía no tiene la configuración de la comunidad. Si eres quien publica la app: publica el archivo firestore.rules en Firebase → Firestore Database → Reglas.' };
    if (errorState === 'offline') return { id: 'offline', title: 'Sin conexión', text: 'Cuando vuelva internet, lo pendiente se envía solo.', soft: true };
    if (errorState === 'network') return { id: 'network', title: 'No se pudo conectar', text: 'Lo intentamos de nuevo en unos segundos.', soft: true };
    return null;
  }

  /* ---------- Perfil público ---------- */
  function weekStats() {
    var st = S(), td = U.today(), ws = st.settings.weekStart, start = U.addDays(td, -((U.weekday(td) - ws + 7) % 7)), done = 0, focus = 0, map = st.doneByDay();
    for (var d = start; d <= td; d = U.addDays(d, 1)) { done += map[d] || 0; focus += st.focusOn(d).min || 0; }
    return { done: done, focus: focus, week: start };
  }
  function buddyData() {
    var c = W.Character.config(), out = {};
    W.Character.CATS.concat(['name', 'cheeks']).forEach(function (k) { if (c[k] != null) out[k] = c[k]; });
    return out;
  }
  function profileData() {
    var st = S(), w = weekStats(), mode = W.Avatar ? W.Avatar.mode() : 'buddy';
    var photo = mode === 'photo' ? S().photo() : '';
    var f = W.Screens.focus && W.Screens.focus.status ? W.Screens.focus.status() : null;
    var d = {
      uid: uid(), name: myName(), code: st.social.code,
      streak: st.streak(), bestStreak: st.bestStreak(), weekDone: w.done, weekFocus: w.focus, week: w.week,
      buddy: buddyData(), avatar: mode === 'photo' && photo && /^data:image\//.test(photo) && photo.length < 90000 ? 'photo' : mode === 'initial' ? 'initial' : 'buddy',
      status: f && f.running && f.mode === 'work' ? 'focus' : 'online', updatedAt: Date.now()
    };
    if (d.avatar === 'photo') d.photo = photo;
    return d;
  }
  function publish() {
    if (!ready()) return Promise.resolve();
    return F().setDoc(ref('profiles', uid()), profileData()).then(ok).catch(function (e) { try { fail(e); } catch (x) { /* ya avisado */ } });
  }
  function schedulePublish(ms) { clearTimeout(publishTimer); publishTimer = setTimeout(publish, ms || 15000); }
  function newCode() { var A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', s = 'WH-'; for (var i = 0; i < 6; i++) s += A[Math.floor(Math.random() * A.length)]; return s; }
  /** Activa la comunidad: reserva tu código y publica tu perfil */
  function enable() {
    var st = S(), me = uid();
    if (!canUse()) return Promise.reject({ code: 'blocked' });
    var tryCode = function (n) {
      var code = st.social.code || newCode();
      return F().runTransaction(DB(), function (tx) {
        var r = ref('codes', code);
        return tx.get(r).then(function (snap) {
          if (snap.exists() && snap.data().uid !== me) throw { retry: true };
          if (!snap.exists()) tx.set(r, { uid: me, at: Date.now() });
          return code;
        });
      }).catch(function (e) { if (e && e.retry && n < 6) { st.social.code = null; return tryCode(n + 1); } throw e; });
    };
    return tryCode(0).then(function (code) {
      st.social.code = code; st.social.enabled = true; st.social.enabledAt = Date.now();
      st.notify('social');
      ok();
      return publish();
    }).catch(fail);
  }
  function ensureEnabled() { return ready() ? Promise.resolve() : enable(); }

  /* ---------- Buzón ---------- */
  function send(toUid, box, value) {
    var data = {}; data[box] = {}; data[box][uid()] = value;
    return F().setDoc(ref('inbox', toUid), data, { merge: true });
  }
  /** Lee el buzón y lo vacía (las solicitudes se quedan hasta que respondas) */
  function poll(force) {
    if (!ready()) return Promise.resolve();
    if (polling) return polling;
    if (!force && Date.now() - lastPoll < 4000) return Promise.resolve();
    lastPoll = Date.now();
    var st = S(), me = uid(), got = null, toRequests = {};
    polling = F().runTransaction(DB(), function (tx) {
      var r = ref('inbox', me);
      return tx.get(r).then(function (snap) {
        got = snap.exists() ? snap.data() : {};
        var reqs = Object.assign({}, got.requests || {});
        // Enlaces con una clave que ya no vale: pasan a ser solicitudes normales
        Object.keys(got.links || {}).forEach(function (k) {
          var l = got.links[k] || {}, inv = st.social.invites[l.token];
          if (!inv || inv.off) { reqs[k] = { name: l.name || '', code: l.code || '', at: l.at || Date.now(), kind: l.kind === 'work' ? 'work' : 'friend', via: 'link' }; toRequests[k] = 1; }
        });
        var busy = BOXES.some(function (b) { return b !== 'requests' && Object.keys(got[b] || {}).length; });
        if (busy) tx.set(r, { requests: reqs, accepted: {}, cheers: {}, spaces: {}, pings: {}, links: {} });
        got.requests = reqs;
      });
    }).then(function () {
      ok();
      inbox.requests = got.requests || {};
      var changed = false, fresh = Object.keys(got.accepted || {}).concat(Object.keys(got.links || {}).filter(function (k) { return !toRequests[k]; })).concat(Object.keys(got.requests || {}).filter(function (k) { return !profiles[k]; }));
      Object.keys(got.accepted || {}).forEach(function (k) {
        var a = got.accepted[k], old = st.social.friends[k] || {};
        st.social.friends[k] = Object.assign({}, old, { name: a.name || old.name || '', code: a.code || old.code || '', at: Date.now(), removed: false, pending: false, kind: old.kind || (a.kind === 'work' ? 'work' : 'friend') });
        changed = true;
        W.Toast.show({ text: (a.name || 'Alguien') + ' ya está en tus contactos', type: 'success', icon: 'users' });
      });
      Object.keys(got.links || {}).forEach(function (k) {
        if (toRequests[k]) return;
        var l = got.links[k], inv = st.social.invites[l.token];
        var old = st.social.friends[k] || {};
        st.social.friends[k] = Object.assign({}, old, { name: l.name || old.name || '', code: l.code || old.code || '', at: Date.now(), removed: false, pending: false, kind: inv && inv.kind === 'work' ? 'work' : (l.kind === 'work' ? 'work' : 'friend') });
        if (inv) { inv.uses = (inv.uses || 0) + 1; inv.at = Date.now(); }
        changed = true;
        send(k, 'accepted', { name: myName(), code: st.social.code, at: Date.now(), kind: l.kind }).catch(function () {});
        W.Toast.show({ text: (l.name || 'Alguien') + ' se ha unido con tu invitación', type: 'success', icon: 'users', duration: 4500 });
        W.Audio.chime();
      });
      Object.keys(got.cheers || {}).forEach(function (k) {
        var c = got.cheers[k];
        st.social.cheers.push({ id: c.id || U.uid('c'), from: k, name: c.name || '', text: String(c.text || '').slice(0, 80), at: c.at || Date.now() });
        st.social.cheers = st.social.cheers.slice(-30);
        changed = true;
        W.Toast.show({ text: (c.name || 'Alguien') + ': «' + String(c.text || '').slice(0, 80) + '»', icon: 'send', duration: 6000 });
        W.Audio.chime();
      });
      Object.keys(got.spaces || {}).forEach(function (k) {
        var sp = got.spaces[k];
        if (sp && sp.id && /^[A-Za-z0-9_-]{4,40}$/.test(sp.id)) {
          st.social.spaces[sp.id] = { name: String(sp.name || 'Equipo').slice(0, 40), at: Date.now(), left: false, icon: sp.icon || '' };
          changed = true;
          W.Toast.show({ text: (sp.from || 'Alguien') + ' te ha añadido al equipo «' + (sp.name || '') + '»', icon: 'team', duration: 5000 });
        }
      });
      if (changed) st.notify('social');
      if (W.Chat && got.pings && Object.keys(got.pings).length) W.Chat.onPings(got.pings);
      if (Object.keys(inbox.requests).length) emit('requests');
      emit('poll');
      if (Date.now() - lastProfiles > 60000) return loadProfiles();
      // Contactos nuevos: su personaje y su nombre, al momento
      if (fresh.length) return loadProfiles(fresh);
    }).catch(function (e) { try { fail(e); } catch (x) { /* ya avisado */ } }).then(function () { polling = null; });
    return polling;
  }
  function loadProfiles(ids) {
    lastProfiles = Date.now();
    var list = ids || S().friends().map(function (f) { return f.uid; });
    return Promise.all(list.map(function (id) {
      return F().getDoc(ref('profiles', id)).then(function (s) { if (s.exists()) profiles[id] = s.data(); }).catch(function () { /* perfil no publicado */ });
    })).then(function () { saveCache(); emit('profiles'); if (W.Router) W.Router.refresh(); });
  }

  /* ---------- Contactos ---------- */
  function normCode(code) { return String(code || '').toUpperCase().replace(/\s+/g, '').replace(/^WH(?!-)/, 'WH-'); }
  function addByCode(code, kind) {
    code = normCode(code);
    if (!/^WH-[A-Z0-9]{6}$/.test(code)) { W.Toast.show({ text: 'Los códigos son así: WH-7K3Q9P', type: 'danger' }); return Promise.resolve(false); }
    if (code === S().social.code) { W.Toast.show({ text: 'Ese es tu propio código', icon: 'info' }); return Promise.resolve(false); }
    if (!W.Plan.gate('community')) return Promise.resolve(false);
    return ensureEnabled().then(function () { return F().getDoc(ref('codes', code)); }).then(function (s) {
      if (!s.exists()) { W.Toast.show({ text: 'No hay nadie con ese código. Revisa que esté bien escrito.', type: 'danger' }); return false; }
      var to = s.data().uid, f = S().social.friends[to];
      if (f && !f.removed && !f.pending) { W.Toast.show({ text: 'Ya está en tus contactos', icon: 'users' }); return false; }
      return send(to, 'requests', { name: myName(), code: S().social.code, at: Date.now(), kind: kind === 'work' ? 'work' : 'friend' }).then(function () {
        S().setFriend(to, { name: '', code: code, removed: false, pending: true, kind: kind === 'work' ? 'work' : 'friend' });
        W.Toast.show({ text: 'Solicitud enviada. Le llegará al momento.', type: 'success', icon: 'send' });
        return true;
      });
    }).catch(function (e) { try { fail(e); } catch (x) { /* ya avisado */ } W.Toast.show({ text: blocker() ? blocker().title : 'No se pudo enviar', type: 'danger' }); return false; });
  }
  function answer(fromUid, accept, kind) {
    var st = S(), me = uid(), req = inbox.requests[fromUid] || {};
    return F().runTransaction(DB(), function (tx) {
      var r = ref('inbox', me);
      return tx.get(r).then(function (snap) {
        var d = snap.exists() ? snap.data() : {}, reqs = Object.assign({}, d.requests || {});
        delete reqs[fromUid];
        var out = { requests: reqs }; BOXES.forEach(function (b) { if (b !== 'requests') out[b] = d[b] || {}; });
        tx.set(r, out);
      });
    }).then(function () {
      delete inbox.requests[fromUid];
      emit('requests');
      if (!accept) { W.Router.refresh(); return; }
      var k = kind || req.kind || 'friend';
      st.setFriend(fromUid, { name: req.name || '', code: req.code || '', removed: false, pending: false, kind: k === 'work' ? 'work' : 'friend' });
      return send(fromUid, 'accepted', { name: myName(), code: st.social.code, at: Date.now(), kind: k }).then(function () {
        W.Toast.show({ text: 'Ya estáis conectados', type: 'success', icon: 'users' });
        return loadProfiles([fromUid]);
      });
    }).catch(function (e) { try { fail(e); } catch (x) { /* ya avisado */ } });
  }
  function cheer(f, text) {
    return send(f.uid, 'cheers', { name: myName(), text: text, at: Date.now(), id: U.uid('c') }).then(function () {
      S().setMeta('cheersSent', (S().meta.cheersSent || 0) + 1);
      W.Toast.show({ text: 'Ánimo enviado a ' + (f.name || 'tu contacto'), icon: 'send' });
      W.Audio.boop();
    }).catch(function (e) { try { fail(e); } catch (x) { /* ya avisado */ } });
  }

  /* ---------- Invitaciones por enlace o QR ---------- */
  function token() { var A = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789', s = ''; for (var i = 0; i < 12; i++) s += A[Math.floor(Math.random() * A.length)]; return s; }
  /** Tu invitación (una para amigos y otra para trabajo; se reutiliza hasta que la renueves) */
  function invite(kind) {
    var st = S(), inv = st.social.invites, k = kind === 'work' ? 'work' : 'friend';
    var found = Object.keys(inv).filter(function (t) { return !inv[t].off && inv[t].kind === k; })[0];
    if (!found) { found = token(); inv[found] = { at: Date.now(), kind: k, uses: 0, off: false }; st.notify('social'); }
    return found;
  }
  function renewInvites() {
    var inv = S().social.invites;
    Object.keys(inv).forEach(function (t) { inv[t].off = true; inv[t].at = Date.now(); });
    S().notify('social');
    W.Toast.show({ text: 'Enlaces renovados: los anteriores ya no conectan solos', icon: 'refresh' });
  }

  /* ---------- Equipos ---------- */
  function teamRef(id) { return ref('spaces', id); }
  function loadTeam(id) {
    return F().getDoc(teamRef(id)).then(function (s) { teamData[id] = s.exists() ? s.data() : null; emit('team'); return teamData[id]; });
  }
  function editTeam(id, fn) {
    return F().runTransaction(DB(), function (tx) {
      return tx.get(teamRef(id)).then(function (s) {
        if (!s.exists()) throw new Error('sin equipo');
        var d = s.data(); d.tasks = Array.isArray(d.tasks) ? d.tasks : [];
        fn(d); d.updatedAt = Date.now();
        tx.set(teamRef(id), d);
        return d;
      });
    }).then(function (d) { teamData[id] = d; emit('team'); return d; });
  }
  function createTeam(name, members, icon) {
    if (!W.Plan.gate('community')) return Promise.reject({ code: 'premium' });
    var st = S(), id = U.uid('sp').replace(/[^A-Za-z0-9_-]/g, ''), me = uid(), m = {};
    m[me] = myName();
    members.forEach(function (f) { m[f.uid] = f.name || 'Contacto'; });
    var d = { name: String(name).slice(0, 40), icon: icon || 'team', owner: me, members: m, joinKey: token(), joins: {}, tasks: [], pages: {}, pdel: {}, createdAt: Date.now(), updatedAt: Date.now() };
    return ensureEnabled().then(function () { return F().setDoc(teamRef(id), d); }).then(function () {
      teamData[id] = d;
      st.social.spaces[id] = { name: d.name, at: Date.now(), left: false, icon: d.icon };
      st.notify('social');
      return Promise.all(members.map(function (f) { return send(f.uid, 'spaces', { id: id, name: d.name, icon: d.icon, from: myName(), at: Date.now() }).catch(function () {}); }));
    }).then(function () { return id; });
  }
  function addToTeam(id, people) {
    var d = teamData[id];
    if (!d || d.owner !== uid()) return Promise.reject({ code: 'owner' });
    return editTeam(id, function (x) { people.forEach(function (f) { x.members[f.uid] = f.name || 'Contacto'; }); }).then(function (x) {
      return Promise.all(people.map(function (f) { return send(f.uid, 'spaces', { id: id, name: x.name, icon: x.icon || '', from: myName(), at: Date.now() }).catch(function () {}); }));
    });
  }
  function leaveTeam(id) {
    var d = teamData[id], me = uid(), st = S();
    var go = d && d.owner !== me ? editTeam(id, function (x) { delete x.members[me]; if (x.joins) delete x.joins[me]; }) : Promise.resolve();
    return go.catch(function () {}).then(function () {
      st.social.spaces[id] = Object.assign({}, st.social.spaces[id], { left: true, at: Date.now() });
      st.notify('social');
      if (W.Pages) W.Pages.dropTeam(id);
    });
  }
  /**
   * Al eliminar la cuenta: sales de tus equipos (si eres el único miembro, el equipo y sus páginas
   * se borran) y desaparecen tu perfil público, tu código de contacto y tu buzón.
   */
  function deleteRemote() {
    var me = uid(), st = S();
    if (!me || !DB()) return Promise.resolve();
    var sp = st.social.spaces || {};
    var leave = function (id) {
      return loadTeam(id).then(function (d) {
        if (!d || !d.members || !d.members[me]) return null;
        if (d.owner !== me) return editTeam(id, function (x) { delete x.members[me]; if (x.joins) delete x.joins[me]; });
        if (Object.keys(d.members).some(function (k) { return k !== me; })) return editTeam(id, function (x) { delete x.members[me]; if (x.joins) delete x.joins[me]; });
        // Eras el único: primero sus páginas y sus archivos (las reglas exigen ser miembro) y después el equipo
        return F().getDocs(F().collection(DB(), 'spaces', id, 'pages')).then(function (snap) {
          var b = F().writeBatch(DB()), n = 0;
          snap.forEach(function (x) { if (n < 450) { b.delete(x.ref); n++; } });
          return n ? b.commit() : null;
        }).then(function () { return W.Files ? W.Files.deleteTeam(id) : null; }).then(function () { return F().deleteDoc(teamRef(id)); });
      }).catch(function () { /* sin permiso o sin conexión */ });
    };
    var teams = Object.keys(sp).filter(function (k) { return !sp[k].left; });
    return Promise.all(teams.map(leave)).then(function () {
      var dels = [F().deleteDoc(ref('profiles', me)), F().deleteDoc(ref('inbox', me))];
      if (st.social.code) dels.push(F().deleteDoc(ref('codes', st.social.code)));
      return Promise.all(dels.map(function (p) { return p.catch(function () { /* ya no existe */ }); }));
    }).then(function () {
      profiles = {}; teamData = {}; saveCache();
      if (W.Chat && W.Chat.forget) W.Chat.forget();
    });
  }
  /** Entrar en un equipo con su enlace (la clave del enlace lo autoriza) */
  function joinTeam(id, key, name) {
    var me = uid(), st = S();
    if (!/^[A-Za-z0-9_-]{4,40}$/.test(id) || !/^[A-Za-z0-9]{6,24}$/.test(key)) return Promise.reject({ code: 'invalid' });
    var patch = {}; patch['members.' + me] = myName(); patch['joins.' + me] = key;
    return ensureEnabled().then(function () { return F().updateDoc(teamRef(id), patch); }).then(function () {
      st.social.spaces[id] = { name: String(name || 'Equipo').slice(0, 40), at: Date.now(), left: false, icon: 'team' };
      st.notify('social');
      return loadTeam(id).then(function (d) {
        if (d && d.name && d.name !== name) { st.social.spaces[id].name = d.name; st.notify('social'); }
        if (W.PageSync) W.PageSync.now();
        return d;
      });
    });
  }
  function teamLink(id) {
    var d = teamData[id];
    if (!d || !d.joinKey) return null;
    return W.Invite ? W.Invite.teamLink(id, d.joinKey, d.name) : null;
  }
  function renewTeamLink(id) {
    return editTeam(id, function (x) { x.joinKey = token(); });
  }
  /** Personas de un equipo (con su nombre y si son contacto tuyo) */
  function teamMembers(id) {
    var d = teamData[id]; if (!d) return [];
    return Object.keys(d.members || {}).map(function (k) { return { uid: k, name: k === uid() ? myName() : d.members[k], owner: k === d.owner, me: k === uid() }; });
  }

  /* ---------- Ritmo del buzón ---------- */
  function tick() {
    if (document.hidden || !ready()) return;
    var active = S().activeScreen === 'friends' || S().activeScreen === 'chats';
    var every = active ? 7000 : 30000;
    if (failures) every = Math.min(120000, every * Math.pow(2, Math.min(failures, 4)));
    if (Date.now() - lastPoll >= every) poll();
  }

  var People = {
    CHEERS: CHEERS,
    subscribe: function (fn) { subs.push(fn); return function () { subs = subs.filter(function (x) { return x !== fn; }); }; },
    uid: uid, ready: ready, canUse: canUse, blocker: blocker, error: function () { return errorState; },
    enable: enable, ensureEnabled: ensureEnabled, poll: poll, publish: publish, schedulePublish: schedulePublish, loadProfiles: loadProfiles, weekStats: weekStats, myName: myName, send: send,
    profile: function (id) { return profiles[id] || null; },
    profiles: function () { return profiles; },
    requests: function () { return inbox.requests || {}; },
    pendingCount: function () { return Object.keys(inbox.requests || {}).length; },
    contacts: function (kind) { return S().friends().filter(function (f) { return !kind || (f.kind || 'friend') === kind; }); },
    addByCode: addByCode, answer: answer, cheer: cheer,
    setKind: function (id, kind) { S().setFriend(id, { kind: kind === 'work' ? 'work' : 'friend' }); },
    remove: function (id) { S().setFriend(id, { removed: true }); },
    invite: invite, renewInvites: renewInvites,
    teams: function () { var sp = S().social.spaces; return Object.keys(sp).filter(function (k) { return !sp[k].left; }).map(function (k) { return { id: k, name: sp[k].name, icon: sp[k].icon || 'team' }; }); },
    team: function (id) { return teamData[id] || null; },
    deleteRemote: deleteRemote,
    loadTeam: loadTeam, editTeam: editTeam, createTeam: createTeam, addToTeam: addToTeam, leaveTeam: leaveTeam, joinTeam: joinTeam, teamLink: teamLink, renewTeamLink: renewTeamLink, teamMembers: teamMembers,
    init: function () {
      clearInterval(ticker);
      ticker = setInterval(tick, 3000);
      S().subscribe(function (reason) { if (ready() && (reason === 'done' || reason === 'focus' || reason === 'character' || reason === 'profile' || reason === 'habit')) schedulePublish(); });
      if (W.Sync) W.Sync.onStatus(function (s) { if (s === 'synced' && ready() && !lastPoll) { publish(); poll(true); } });
      document.addEventListener('visibilitychange', function () { if (!document.hidden && ready() && Date.now() - lastPoll > 5000) poll(true); });
    }
  };
  W.People = People;
  // Compatibilidad con la 6.0
  W.Friends = { init: People.init, poll: People.poll, publish: People.publish, enable: People.enable, addFriend: function (c) { return addByCode(c); }, answer: answer, pendingCount: People.pendingCount };
})(window.Whider);
