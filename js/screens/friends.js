/**
 * WHIDER · Comunidad con amigos (Premium, con cuenta)
 *
 *  - Tu código de amigo (p. ej. WH-7K3Q9P) para que te añadan; tú añades a otros con el suyo.
 *  - Solicitudes, amigos con su personaje, nivel, racha y avances de la semana.
 *  - Ranking semanal, ánimos con un toque y espacios de trabajo compartidos (tareas en común).
 *
 * Privacidad: tus amigos solo ven tu perfil público (nombre, personaje, nivel, racha y cuántas
 * tareas y minutos de enfoque llevas esta semana). Nunca tus tareas ni tus apuntes.
 *
 * Firestore (solo documentos, sin consultas):
 *  profiles/{uid} perfil público · codes/{código} → uid · inbox/{uid} buzón (solicitudes,
 *  aceptaciones, ánimos e invitaciones: cada remitente solo puede escribir su propia entrada) ·
 *  spaces/{id} espacio compartido (solo sus miembros). Ver firestore.rules.
 */
window.Whider = window.Whider || {};
window.Whider.Screens = window.Whider.Screens || {};

(function (W) {
  'use strict';
  var U = W.U, S = function () { return W.State; };
  var F = function () { return W.Auth.sdk(); }, DB = function () { return W.Auth.db(); };
  var profiles = {}, inbox = { requests: {}, accepted: {}, cheers: {}, spaces: {} }, spaceData = {};
  var lastPoll = 0, polling = null, error = null, publishTimer = null, openSpace = null, spaceTimer = null;
  var CHEERS = ['¡Vamos, tú puedes!', '¡Qué racha llevas!', 'A por el día de hoy', 'Te reto a completar 3 tareas hoy', 'Gran semana, sigue así'];

  function uid() { return W.Auth && W.Auth.user ? W.Auth.user.uid : null; }
  function ready() { return !!uid() && W.Auth.isVerified() && !!DB() && W.Plan.isPremium() && S().social.enabled; }
  function ref() { var a = Array.prototype.slice.call(arguments); return F().doc.apply(null, [DB()].concat(a)); }
  function myName() { return S().displayName() || (W.Auth.user && W.Auth.user.displayName) || 'Sin nombre'; }
  function fail(e) {
    console.warn('Comunidad:', e && (e.code || e.message) || e);
    error = e && e.code === 'permission-denied' ? 'permission' : 'network';
    W.Router.refresh();
  }

  /* ---------- Perfil público y código ---------- */
  function weekStats() {
    var st = S(), td = U.today(), ws = st.settings.weekStart, start = U.addDays(td, -((U.weekday(td) - ws + 7) % 7)), done = 0, focus = 0, map = st.doneByDay();
    for (var d = start; d <= td; d = U.addDays(d, 1)) { done += map[d] || 0; focus += st.focusOn(d).min || 0; }
    return { done: done, focus: focus, week: start };
  }
  function profileData() {
    var st = S(), g = W.Game.get(), w = weekStats(), c = W.Character.config();
    return { uid: uid(), name: myName().slice(0, 40), code: st.social.code, level: g.level, title: W.Game.title(g.level), xp: g.xp,
      streak: st.streak(), bestStreak: st.bestStreak(), weekDone: w.done, weekFocus: w.focus, week: w.week,
      buddy: { name: c.name, body: c.body, tone: c.tone, eyes: c.eyes, mouth: c.mouth, head: c.head, acc: c.acc, cheeks: !!c.cheeks }, updatedAt: Date.now() };
  }
  function publish() {
    if (!ready()) return Promise.resolve();
    return F().setDoc(ref('profiles', uid()), profileData()).catch(fail);
  }
  function schedulePublish() { clearTimeout(publishTimer); publishTimer = setTimeout(publish, 20000); }
  function newCode() { var A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', s = 'WH-'; for (var i = 0; i < 6; i++) s += A[Math.floor(Math.random() * A.length)]; return s; }
  /** Activa la comunidad: reserva un código libre y publica el perfil */
  function enable() {
    var st = S(), me = uid();
    if (!me) return Promise.reject(new Error('sin cuenta'));
    var tryCode = function (n) {
      var code = st.social.code || newCode();
      return F().runTransaction(DB(), function (tx) {
        var r = ref('codes', code);
        return tx.get(r).then(function (snap) {
          if (snap.exists() && snap.data().uid !== me) throw { retry: true };
          if (!snap.exists()) tx.set(r, { uid: me, at: Date.now() });
          return code;
        });
      }).catch(function (e) { if (e && e.retry && n < 5) { st.social.code = null; return tryCode(n + 1); } throw e; });
    };
    return tryCode(0).then(function (code) {
      st.social.code = code; st.social.enabled = true; st.social.enabledAt = Date.now();
      st.notify('social');
      error = null;
      return publish();
    });
  }

  /* ---------- Buzón ---------- */
  /** Escribe mi entrada en el buzón de otra persona (solo la mía: así lo exigen las reglas) */
  function send(toUid, box, value) {
    var data = {}; data[box] = {}; data[box][uid()] = value;
    return F().setDoc(ref('inbox', toUid), data, { merge: true });
  }
  /** Lee mi buzón y lo vacía (en una transacción, sin perder lo que llegue a la vez) */
  function poll(force) {
    if (!ready()) return Promise.resolve();
    if (!force && Date.now() - lastPoll < 20000) return Promise.resolve();
    lastPoll = Date.now();
    var st = S(), me = uid(), got = null;
    return F().runTransaction(DB(), function (tx) {
      var r = ref('inbox', me);
      return tx.get(r).then(function (snap) {
        got = snap.exists() ? snap.data() : {};
        // Las solicitudes se quedan hasta que respondas; lo demás se procesa y se borra
        if (snap.exists() && (Object.keys(got.accepted || {}).length || Object.keys(got.cheers || {}).length || Object.keys(got.spaces || {}).length)) {
          tx.set(r, { requests: got.requests || {}, accepted: {}, cheers: {}, spaces: {} });
        }
      });
    }).then(function () {
      error = null;
      inbox.requests = got.requests || {};
      Object.keys(got.accepted || {}).forEach(function (k) {
        var a = got.accepted[k];
        st.setFriend(k, { name: a.name || '', code: a.code || '', removed: false });
        W.Toast.show({ text: (a.name || 'Alguien') + ' ha aceptado tu solicitud', type: 'success', icon: 'users' });
      });
      Object.keys(got.cheers || {}).forEach(function (k) {
        var c = got.cheers[k];
        st.social.cheers.push({ id: c.id || U.uid('c'), from: k, name: c.name || '', text: String(c.text || '').slice(0, 80), at: c.at || Date.now() });
        st.social.cheers = st.social.cheers.slice(-30);
        W.Toast.show({ text: (c.name || 'Un amigo') + ': «' + String(c.text || '').slice(0, 80) + '»', icon: 'send', duration: 6000 });
        W.Audio.chime();
      });
      Object.keys(got.spaces || {}).forEach(function (k) {
        var sp = got.spaces[k];
        if (sp && sp.id) { st.social.spaces[sp.id] = { name: sp.name || 'Espacio', at: Date.now(), left: false }; W.Toast.show({ text: (sp.from || 'Un amigo') + ' te ha añadido a «' + (sp.name || 'un espacio') + '»', icon: 'users' }); }
      });
      if (Object.keys(got.accepted || {}).length || Object.keys(got.cheers || {}).length || Object.keys(got.spaces || {}).length) st.notify('social');
      return loadProfiles();
    }).catch(fail);
  }
  function loadProfiles() {
    var list = S().friends().map(function (f) { return f.uid; });
    return Promise.all(list.map(function (id) {
      return F().getDoc(ref('profiles', id)).then(function (s) { if (s.exists()) profiles[id] = s.data(); }).catch(function () { /* perfil no publicado */ });
    })).then(function () { W.Router.refresh(); if (W.Sidebar) W.Sidebar.refresh(); });
  }

  /* ---------- Acciones ---------- */
  function addFriend(code) {
    code = String(code || '').toUpperCase().replace(/\s+/g, '');
    if (!/^WH-[A-Z0-9]{6}$/.test(code)) { W.Toast.show({ text: 'Los códigos son así: WH-7K3Q9P', type: 'danger' }); return Promise.resolve(false); }
    if (code === S().social.code) { W.Toast.show({ text: 'Ese es tu propio código', icon: 'info' }); return Promise.resolve(false); }
    return F().getDoc(ref('codes', code)).then(function (s) {
      if (!s.exists()) { W.Toast.show({ text: 'No hay nadie con ese código', type: 'danger' }); return false; }
      var to = s.data().uid;
      if (S().social.friends[to] && !S().social.friends[to].removed) { W.Toast.show({ text: 'Ya sois amigos', icon: 'users' }); return false; }
      return send(to, 'requests', { name: myName(), code: S().social.code, at: Date.now() }).then(function () {
        W.Toast.show({ text: 'Solicitud enviada', type: 'success', icon: 'send' }); return true;
      });
    }).catch(function (e) { fail(e); return false; });
  }
  function answer(fromUid, accept) {
    var st = S(), me = uid(), req = inbox.requests[fromUid] || {};
    return F().runTransaction(DB(), function (tx) {
      var r = ref('inbox', me);
      return tx.get(r).then(function (snap) {
        var d = snap.exists() ? snap.data() : {}, reqs = Object.assign({}, d.requests || {});
        delete reqs[fromUid];
        tx.set(r, { requests: reqs, accepted: d.accepted || {}, cheers: d.cheers || {}, spaces: d.spaces || {} });
      });
    }).then(function () {
      delete inbox.requests[fromUid];
      if (!accept) { W.Router.refresh(); return; }
      st.setFriend(fromUid, { name: req.name || '', code: req.code || '', removed: false });
      return send(fromUid, 'accepted', { name: myName(), code: st.social.code, at: Date.now() }).then(function () {
        W.Toast.show({ text: 'Ahora sois amigos', type: 'success', icon: 'users' });
        return loadProfiles();
      });
    }).catch(fail);
  }
  function cheer(f, anchor) {
    W.Menu.open(anchor, CHEERS.map(function (t) { return { value: t, label: t, icon: 'send' }; }), { title: 'Enviar ánimo a ' + (f.name || 'tu amigo') }).then(function (t) {
      if (!t) return;
      send(f.uid, 'cheers', { name: myName(), text: t, at: Date.now(), id: U.uid('c') }).then(function () {
        S().setMeta('cheersSent', (S().meta.cheersSent || 0) + 1);
        W.Toast.show({ text: 'Ánimo enviado a ' + (f.name || 'tu amigo'), icon: 'send' });
        W.Audio.boop();
      }).catch(fail);
    });
  }

  /* ---------- Espacios compartidos ---------- */
  function spaceRef(id) { return ref('spaces', id); }
  function loadSpace(id) {
    return F().getDoc(spaceRef(id)).then(function (s) { spaceData[id] = s.exists() ? s.data() : null; return spaceData[id]; });
  }
  /** Cambia un espacio en una transacción (las tareas se fusionan por elemento) */
  function editSpace(id, fn) {
    return F().runTransaction(DB(), function (tx) {
      return tx.get(spaceRef(id)).then(function (s) {
        if (!s.exists()) throw new Error('sin espacio');
        var d = s.data(); d.tasks = Array.isArray(d.tasks) ? d.tasks : [];
        fn(d); d.updatedAt = Date.now();
        tx.set(spaceRef(id), d);
        return d;
      });
    }).then(function (d) { spaceData[id] = d; return d; });
  }
  function createSpace(name, members) {
    var st = S(), id = U.uid('sp').replace(/[^A-Za-z0-9_-]/g, ''), me = uid(), m = {};
    m[me] = myName();
    members.forEach(function (f) { m[f.uid] = f.name || 'Amigo'; });
    var d = { name: name.slice(0, 40), owner: me, members: m, tasks: [], createdAt: Date.now(), updatedAt: Date.now() };
    return F().setDoc(spaceRef(id), d).then(function () {
      spaceData[id] = d;
      st.social.spaces[id] = { name: d.name, at: Date.now(), left: false };
      st.notify('social');
      return Promise.all(members.map(function (f) { return send(f.uid, 'spaces', { id: id, name: d.name, from: myName(), at: Date.now() }); }));
    }).then(function () { return id; });
  }

  function spaceSheet(id) {
    var st = S(), host = U.el('div.space-body'), me = uid();
    var input = U.el('input.input', { attrs: { type: 'text', maxlength: 160, placeholder: 'Añadir una tarea al espacio…', 'aria-label': 'Nueva tarea del espacio' } });
    var draw = function () {
      var d = spaceData[id];
      U.clear(host);
      if (!d) { host.appendChild(W.UI.empty('buddy:search:worried', 'No se pudo abrir el espacio', 'Puede que ya no formes parte de él.', null, true)); return; }
      var names = d.members || {};
      host.appendChild(U.el('div.space-members', Object.keys(names).map(function (k) { return U.el('span.chip', [U.icon(k === d.owner ? 'crown' : 'user'), U.el('span', { text: k === me ? 'Tú' : names[k] })]); })));
      var pend = d.tasks.filter(function (t) { return !t.done; }), done = d.tasks.filter(function (t) { return t.done; });
      var row = function (t) {
        var chk = U.el('button.check.sm' + (t.done ? '.on' : ''), { attrs: { 'aria-label': t.done ? 'Desmarcar' : 'Completar' } });
        chk.appendChild(U.svg('svg', { viewBox: '0 0 24 24' }, [U.svg('path', { d: 'm5 12.6 4.5 4.5L19 7.6' })]));
        chk.addEventListener('click', function () {
          editSpace(id, function (x) { x.tasks.forEach(function (y) { if (y.id === t.id) { y.done = !y.done; y.doneBy = y.done ? me : null; y.updatedAt = Date.now(); } }); }).then(draw).catch(fail);
          if (!t.done) W.Audio.success();
        });
        var who = t.done && t.doneBy ? 'Hecha por ' + (t.doneBy === me ? 'ti' : (names[t.doneBy] || 'alguien')) : 'Añadida por ' + (t.by === me ? 'ti' : (names[t.by] || 'alguien'));
        return U.el('div.cell.space-task' + (t.done ? '.done' : ''), [chk, U.el('span.cell-main', [U.el('span.cell-title', { text: t.text }), U.el('span.cell-sub', { text: who })]),
          U.el('button.circle-btn', { attrs: { 'aria-label': 'Quitar' }, on: { click: function () { editSpace(id, function (x) { x.tasks = x.tasks.filter(function (y) { return y.id !== t.id; }); }).then(draw).catch(fail); } } }, [U.icon('close')])]);
      };
      host.appendChild(W.UI.section({ header: 'Pendientes (' + pend.length + ')', items: pend.length ? pend.map(row) : [W.UI.cell({ title: 'Nada pendiente en este espacio', sub: 'Añadid tareas para trabajar en equipo' })] }));
      if (done.length) host.appendChild(W.UI.section({ header: 'Hechas (' + done.length + ')', items: done.slice(-30).map(row) }));
    };
    var add = function () {
      var v = input.value.trim(); if (!v) return;
      input.value = '';
      editSpace(id, function (x) { x.tasks.push({ id: U.uid('st'), text: v.slice(0, 160), by: me, done: false, doneBy: null, createdAt: Date.now(), updatedAt: Date.now() }); }).then(draw).catch(fail);
    };
    input.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); add(); } });
    var s = W.Sheet.open({ title: (st.social.spaces[id] || {}).name || 'Espacio', className: 'editor space-sheet', full: true,
      body: [U.el('div.space-add', [input, U.el('button.btn.primary.sm', { text: 'Añadir', on: { click: add } })]), host],
      foot: [U.el('button.btn.ghost', { on: { click: function () {
        W.Sheet.confirm({ title: '¿Salir del espacio?', text: 'Dejarás de verlo en tu lista.', ok: 'Salir', danger: true }).then(function (ok) {
          if (!ok) return;
          var d = spaceData[id];
          var leave = d && d.owner !== me ? editSpace(id, function (x) { delete x.members[me]; }) : Promise.resolve();
          leave.catch(function () {}).then(function () { st.social.spaces[id] = Object.assign({}, st.social.spaces[id], { left: true, at: Date.now() }); st.notify('social'); s.close(); });
        });
      } } }, [U.icon('logout', 'sm'), 'Salir del espacio'])],
      onClose: function () { openSpace = null; clearInterval(spaceTimer); } });
    openSpace = id;
    loadSpace(id).then(draw).catch(function (e) { fail(e); draw(); });
    clearInterval(spaceTimer);
    spaceTimer = setInterval(function () { if (!document.hidden) loadSpace(id).then(draw).catch(function () {}); }, 15000);
  }

  function newSpace() {
    var friends = S().friends(), chosen = {};
    var name = U.el('input.cell-input.title', { attrs: { type: 'text', maxlength: 40, placeholder: 'Nombre del espacio (p. ej. Proyecto final)', 'aria-label': 'Nombre del espacio' } });
    var s = W.Sheet.open({ title: 'Nuevo espacio compartido', className: 'editor', body: [
      U.el('div.group', [U.el('label.cell', [name])]),
      W.UI.section({ header: 'Con quién', items: friends.length ? friends.map(function (f) {
        return W.UI.cell({ title: f.name || 'Amigo', right: W.UI.toggle(false, function (v) { chosen[f.uid] = v; }, f.name || 'Amigo') });
      }) : [W.UI.cell({ title: 'Aún no tienes amigos', sub: 'Añade amigos con su código para compartir espacios' })] })
    ], foot: [U.el('button.btn.primary', { text: 'Crear espacio', on: { click: function () {
      var n = name.value.trim(); if (!n) { name.focus(); return; }
      var members = friends.filter(function (f) { return chosen[f.uid]; });
      createSpace(n, members).then(function (id) { s.close(); setTimeout(function () { spaceSheet(id); }, 250); }).catch(fail);
    } } })] });
    setTimeout(function () { name.focus(); }, W.Layout.desktop ? 30 : 380);
  }

  /* ---------- Pantalla ---------- */
  function friendCard(f) {
    var p = profiles[f.uid] || {}, w = weekStats();
    var current = p.week === w.week;
    var card = U.el('div.fr-card', [
      U.el('div.fr-buddy', [W.Character.svg({ size: 76, cfg: p.buddy || null, mood: p.streak >= 3 ? 'proud' : 'happy' })]),
      U.el('div.fr-main', [U.el('strong', { text: p.name || f.name || 'Amigo' }),
        U.el('span', { text: p.level ? 'Nivel ' + p.level + ' · ' + (p.title || '') : 'Aún sin perfil publicado' }),
        U.el('div.fr-stats', [U.el('span', [U.icon('flame', 'xs'), U.el('b', { text: String(p.streak || 0) }), (p.streak === 1 ? ' día' : ' días')]),
          U.el('span', [U.icon('check', 'xs'), U.el('b', { text: String(current ? p.weekDone || 0 : 0) }), ' esta semana']),
          U.el('span', [U.icon('timer', 'xs'), U.el('b', { text: W.Charts.fmtMin(current ? p.weekFocus || 0 : 0) })])])]),
      U.el('div.fr-acts', [U.el('button.btn.sm.soft', { on: { click: function (e) { cheer(f, e.currentTarget); } } }, [U.icon('send', 'sm'), 'Animar']),
        U.el('button.nav-icon', { attrs: { 'aria-label': 'Más opciones' }, on: { click: function (e) {
          W.Menu.open(e.currentTarget, [{ value: 'remove', label: 'Quitar de amigos', icon: 'trash', destructive: true }]).then(function (v) {
            if (v === 'remove') W.Sheet.confirm({ title: '¿Quitar a ' + (p.name || f.name || 'tu amigo') + '?', ok: 'Quitar', danger: true }).then(function (ok) { if (ok) S().setFriend(f.uid, { removed: true }); });
          });
        } } }, [U.icon('dots')])])
    ]);
    return card;
  }

  function ranking(st) {
    var w = weekStats(), me = { uid: uid(), name: 'Tú', weekDone: w.done, streak: st.streak(), buddy: null, me: true };
    var rows = [me].concat(st.friends().map(function (f) { var p = profiles[f.uid] || {}; return { uid: f.uid, name: p.name || f.name || 'Amigo', weekDone: p.week === w.week ? p.weekDone || 0 : 0, streak: p.streak || 0, buddy: p.buddy }; }))
      .sort(function (a, b) { return b.weekDone - a.weekDone || b.streak - a.streak; });
    return U.el('div.group.rank', rows.map(function (r, i) {
      return U.el('div.rank-row' + (r.me ? '.me' : ''), [U.el('span.rank-pos' + (i < 3 ? '.top' : ''), { text: String(i + 1) }),
        U.el('span.rank-buddy', [W.Character.svg({ size: 34, cfg: r.me ? null : r.buddy })]),
        U.el('span.rank-name', { text: r.name }), U.el('span.rank-val', [U.el('b', { text: String(r.weekDone) }), ' tareas'])]);
    }));
  }

  W.Screens.friends = {
    title: 'Amigos',
    back: function () { if (W.Layout.desktop) return false; W.Router.back(); return true; },
    render: function (root) {
      var st = S(), desk = W.Layout.desktop, P = W.Plan;
      var head = W.UI.header({ title: 'Amigos', back: desk ? null : { label: 'Atrás', onTap: function () { W.Router.back(); } }, sub: 'Comunidad de trabajo: avanza con los tuyos' });
      var content = [];
      if (!P.isPremium()) {
        content.push(U.el('div.group.card.fr-hero', [W.Character.illustration('friends', 'happy', 110), U.el('strong', { text: 'Conecta con tus amigos' }),
          U.el('p', { text: P.FEATURES.community.text }),
          U.el('button.btn.primary', { on: { click: function () { P.paywall('community'); } } }, [U.icon('gem', 'sm'), P.canTrial() ? 'Probar Premium gratis' : 'Hazte Premium'])]));
        W.UI.mount(root, head, content); return;
      }
      if (!uid() || !W.Auth.isVerified() || !DB()) {
        content.push(U.el('div.group', [W.UI.empty('buddy:friends', 'Necesitas una cuenta', 'Inicia sesión para tener tu código de amigo y conectar con otros.',
          W.Auth && W.Auth.configured() ? U.el('button.btn.sm.primary', { on: { click: function () { W.AuthScreen.open({ mode: uid() ? 'login' : 'register' }); } } }, [U.icon('user', 'sm'), 'Iniciar sesión']) : null)]));
        W.UI.mount(root, head, content); return;
      }
      if (!st.social.enabled) {
        content.push(U.el('div.group.card.fr-hero', [W.Character.illustration('friends', 'happy', 110), U.el('strong', { text: 'Activa la comunidad' }),
          U.el('p', { text: 'Tus amigos verán tu nombre, tu personaje, tu nivel, tu racha y cuántas tareas completas a la semana. Nunca tus tareas ni tus apuntes.' }),
          U.el('button.btn.primary', { on: { click: function (e) { e.currentTarget.disabled = true; enable().then(function () { W.Router.refresh(); poll(true); }).catch(fail); } } }, [U.icon('users', 'sm'), 'Activar y crear mi código'])]));
        if (error) content.push(U.el('p.hint', { text: 'No se pudo conectar con la comunidad. Inténtalo de nuevo en un momento.' }));
        W.UI.mount(root, head, content); return;
      }
      if (error) content.push(U.el('div.group', [W.UI.cell({ icon: 'alert', title: 'No se pudo conectar con la comunidad', sub: 'Revisa tu conexión. Lo intentaremos de nuevo.', onTap: function () { error = null; poll(true); } })]));
      // Tu código y añadir amigos
      var code = st.social.code || '…';
      var input = U.el('input.input', { attrs: { type: 'text', placeholder: 'Código de tu amigo (WH-…)', 'aria-label': 'Código de tu amigo', autocapitalize: 'characters', spellcheck: 'false' } });
      var go = function () { addFriend(input.value).then(function (okk) { if (okk) input.value = ''; }); };
      input.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); go(); } });
      content.push(U.el('div.fr-top', [
        U.el('div.group.card.fr-me', [W.Character.node({ size: 64, bubble: false }), U.el('div', [U.el('small', { text: 'Tu código de amigo' }), U.el('strong.fr-code', { text: code })]),
          U.el('button.btn.sm.soft', { on: { click: function () {
            var text = 'Agrégame en WHIDER con mi código ' + code;
            if (navigator.share && !desk) navigator.share({ title: 'WHIDER', text: text }).catch(function () {});
            else if (navigator.clipboard) navigator.clipboard.writeText(code).then(function () { W.Toast.show({ text: 'Código copiado', icon: 'check' }); });
          } } }, [U.icon(desk ? 'layers' : 'send', 'sm'), desk ? 'Copiar' : 'Compartir'])]),
        U.el('div.group.card.fr-add', [U.el('small', { text: 'Añadir a un amigo' }), U.el('div.pl-code', [input, U.el('button.btn.primary', { text: 'Enviar', on: { click: go } })])])
      ]));
      var reqs = Object.keys(inbox.requests || {});
      if (reqs.length) content.push(W.UI.section({ title: 'Solicitudes', side: U.el('small', { text: reqs.length }), items: reqs.map(function (k) {
        var r = inbox.requests[k];
        return U.el('div.cell', [W.UI.cellIcon('user'), U.el('span.cell-main', [U.el('span.cell-title', { text: r.name || 'Alguien' }), U.el('span.cell-sub', { text: 'Quiere ser tu amigo · ' + (r.code || '') })]),
          U.el('span.cell-row', [U.el('button.btn.xs.soft', { text: 'Rechazar', on: { click: function () { answer(k, false); } } }), U.el('button.btn.xs.primary', { text: 'Aceptar', on: { click: function () { answer(k, true); } } })])]);
      }) }));
      var friends = st.friends();
      content.push(W.UI.section({ title: 'Ranking de la semana', items: ranking(st), footer: 'Tareas completadas desde el inicio de la semana.' }));
      content.push(W.UI.section({ title: 'Tus amigos', side: friends.length ? U.el('small', { text: friends.length }) : null,
        items: friends.length ? U.el('div.fr-grid', friends.map(friendCard)) : U.el('div.group', [W.UI.empty('buddy:friends', 'Aún no tienes amigos aquí', 'Comparte tu código o escribe el de un amigo para conectar.', null, true)]) }));
      var spaces = Object.keys(st.social.spaces).filter(function (k) { return !st.social.spaces[k].left; });
      content.push(W.UI.section({ title: 'Espacios compartidos', items: spaces.map(function (k) {
        return W.UI.cell({ icon: 'users', title: st.social.spaces[k].name, sub: 'Tareas en común', onTap: function () { spaceSheet(k); } });
      }).concat([W.UI.cell({ icon: 'plus', title: 'Nuevo espacio', sub: 'Una lista de tareas para trabajar en equipo', accent: true, chevron: false, onTap: newSpace })]) }));
      var cheers = st.social.cheers.slice(-5).reverse();
      if (cheers.length) content.push(W.UI.section({ header: 'Ánimos recibidos', items: cheers.map(function (c) { return W.UI.cell({ icon: 'send', title: '«' + c.text + '»', sub: (c.name || 'Un amigo') + ' · ' + U.fmtRel(c.at - Date.now()) }); }) }));
      W.UI.mount(root, head, content);
      if (Date.now() - lastPoll > 20000) setTimeout(function () { poll(); }, 50);
    }
  };

  W.Friends = {
    enable: enable, poll: poll, publish: publish, addFriend: addFriend, answer: answer,
    pendingCount: function () { return Object.keys(inbox.requests || {}).length; },
    init: function () {
      clearInterval(polling);
      polling = setInterval(function () { if (!document.hidden && ready()) poll(); }, 60000);
      S().subscribe(function (reason) { if (ready() && (reason === 'done' || reason === 'focus' || reason === 'character' || reason === 'profile' || reason === 'habit')) schedulePublish(); });
      if (W.Sync) W.Sync.onStatus(function (s) { if (s === 'synced' && ready() && !lastPoll) { publish(); poll(true); } });
    }
  };
})(window.Whider);
