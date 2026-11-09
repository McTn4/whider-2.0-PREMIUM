/**
 * WHIDER · Personas: amigos, trabajo y equipos
 *
 *  - Tu tarjeta con tu personaje y tu código; invitar con un enlace o con tu código QR,
 *    escanear el de otra persona o escribir su código.
 *  - Solicitudes (se elige si es de amigos o de trabajo), contactos de cada tipo con su
 *    personaje, su racha y su estado, y chat directo con cada uno.
 *  - Equipos: miembros, enlace y QR para unirse, tareas en común, chat y páginas del equipo.
 *  - Ánimos entre amigos.
 */
window.Whider = window.Whider || {};
window.Whider.Screens = window.Whider.Screens || {};

(function (W) {
  'use strict';
  var U = W.U, S = function () { return W.State; }, PE = function () { return W.People; };
  var unsub = null, teamTimer = null;

  function tab() { return S().ui.peopleTab || 'friend'; }
  function premiumGem() { return W.Plan.isPremium() ? null : U.el('span.sb-gem', { attrs: { title: 'Premium' } }, [U.icon('gem')]); }

  /* ---------- Tarjetas ---------- */
  function contactCard(f) {
    var p = PE().profile(f.uid) || {}, w = PE().weekStats(), current = p.week === w.week, work = (f.kind || 'friend') === 'work';
    var name = p.name || f.name || 'Contacto';
    var focus = p.status === 'focus' && Date.now() - (p.updatedAt || 0) < 3 * 3600000;
    var card = U.el('div.pp-card' + (f.pending ? '.pending' : ''), [
      U.el('div.pp-av', [W.Avatar.forProfile(p.uid ? p : { name: name, buddy: null }, 64, { live: true }), focus ? U.el('span.pp-status', { attrs: { title: 'Concentrado ahora' } }, [U.icon('timer')]) : null]),
      U.el('div.pp-main', [
        U.el('strong', { text: name }),
        U.el('span', { text: f.pending ? 'Esperando su confirmación…' : !p.uid ? 'Aún sin perfil publicado' : focus ? 'Concentrado ahora' : p.updatedAt ? 'Activo ' + U.fmtRel(p.updatedAt - Date.now()) : (work ? 'Trabajo' : 'Amigos') }),
        !f.pending && p.uid ? U.el('div.pp-stats', [U.el('span', [U.icon('flame', 'xs'), U.el('b', { text: String(p.streak || 0) }), (p.streak === 1 ? ' día' : ' días')]),
          U.el('span', [U.icon('check', 'xs'), U.el('b', { text: String(current ? p.weekDone || 0 : 0) }), ' esta semana']),
          work ? null : U.el('span', [U.icon('timer', 'xs'), U.el('b', { text: W.Charts.fmtMin(current ? p.weekFocus || 0 : 0) })])]) : null
      ]),
      U.el('div.pp-acts', [
        U.el('button.btn.sm.primary', { on: { click: function () { W.Chat.openChat({ uid: f.uid }); } } }, [U.icon('chat', 'sm'), 'Chat']),
        work ? null : U.el('button.btn.sm.soft', { on: { click: function (e) { cheerMenu(f, e.currentTarget); } } }, [U.icon('send', 'sm'), 'Animar']),
        U.el('button.nav-icon', { attrs: { 'aria-label': 'Más opciones', title: 'Más opciones' }, on: { click: function (e) { contactMenu(f, name, e.currentTarget); } } }, [U.icon('dots')])
      ])
    ]);
    return card;
  }
  function cheerMenu(f, anchor) {
    W.Menu.open(anchor, PE().CHEERS.map(function (t) { return { value: t, label: t, icon: 'send' }; }), { title: 'Enviar ánimo' }).then(function (t) { if (t) PE().cheer(f, t); });
  }
  function contactMenu(f, name, anchor) {
    var work = (f.kind || 'friend') === 'work';
    W.Menu.open(anchor, [
      { value: 'move', label: work ? 'Pasar a Amigos' : 'Pasar a Trabajo', icon: work ? 'heart' : 'briefcase' },
      { value: 'team', label: 'Añadir a un equipo…', icon: 'team' },
      { value: 'remove', label: 'Quitar de contactos', icon: 'trash', destructive: true, gap: true }
    ], { title: name }).then(function (v) {
      if (v === 'move') { PE().setKind(f.uid, work ? 'friend' : 'work'); W.Toast.show({ text: name + ' ahora está en ' + (work ? 'Amigos' : 'Trabajo'), icon: 'users' }); }
      else if (v === 'team') {
        var mine = PE().teams().filter(function (t) { var d = PE().team(t.id); return d && d.owner === PE().uid(); });
        if (!mine.length) { W.Toast.show({ text: 'Crea un equipo primero (solo quien lo crea añade a otros; los demás comparten su enlace).', icon: 'info', duration: 5000 }); return; }
        W.Sheet.choose({ title: 'Añadir a ' + name + ' a', options: mine.map(function (t) { return { value: t.id, label: t.name, icon: 'team' }; }) }).then(function (sid) { if (sid) PE().addToTeam(sid, [{ uid: f.uid, name: name }]).then(function () { W.Toast.show({ text: name + ' está en el equipo', icon: 'team', type: 'success' }); }).catch(function () { W.Toast.show({ text: 'No se pudo añadir', type: 'danger' }); }); });
      }
      else if (v === 'remove') W.Sheet.confirm({ title: '¿Quitar a ' + name + '?', ok: 'Quitar', danger: true }).then(function (ok) { if (ok) PE().remove(f.uid); });
    });
  }
  function requestRow(k, r) {
    var kind = r.kind === 'work' ? 'work' : 'friend';
    var p = PE().profile(k) || {};
    return U.el('div.cell.pp-req', [W.Avatar.forProfile(p.uid ? p : { name: r.name }, 40), U.el('span.cell-main', [U.el('span.cell-title', { text: r.name || 'Alguien' }), U.el('span.cell-sub', { text: (kind === 'work' ? 'Quiere conectar contigo (trabajo)' : 'Quiere ser tu amigo') + (r.code ? ' · ' + r.code : '') })]),
      U.el('span.cell-row', [U.el('button.btn.xs.soft', { text: 'Rechazar', on: { click: function () { PE().answer(k, false); } } }),
        U.el('button.btn.xs.primary', { text: 'Aceptar', on: { click: function (e) {
          W.Menu.open(e.currentTarget, [{ value: 'friend', label: 'Aceptar como amigo', icon: 'heart', on: kind === 'friend' }, { value: 'work', label: 'Aceptar como trabajo', icon: 'briefcase', on: kind === 'work' }]).then(function (v) { if (v) PE().answer(k, true, v); });
        } } })])]);
  }
  /* ---------- Equipos ---------- */
  function teamCard(t) {
    var d = PE().team(t.id), n = d ? Object.keys(d.members || {}).length : null;
    var pages = W.Pages.all({ team: t.id }).filter(function (m) { return !W.Pages.isRow(m); }).length;
    return U.el('button.pp-team', { attrs: { type: 'button' }, on: { click: function () { teamSheet(t.id); } } }, [
      U.el('span.pp-team-ic', [U.icon(t.icon || 'team')]),
      U.el('span.pp-team-main', [U.el('strong', { text: t.name }), U.el('small', { text: (n != null ? U.plural(n, 'miembro', 'miembros') : 'Equipo') + ' · ' + U.plural(pages, 'página', 'páginas') })]),
      d ? U.el('span.pp-team-avs', Object.keys(d.members || {}).slice(0, 4).map(function (k) { return W.Avatar.small(k, 26); })) : null,
      U.icon('chev', 'chev')
    ]);
  }
  function newTeam() {
    if (!W.Plan.gate('community')) return;
    var people = PE().contacts().filter(function (f) { return !f.pending; }), chosen = {};
    var name = U.el('input.cell-input.title', { attrs: { type: 'text', maxlength: 40, placeholder: 'Nombre del equipo (p. ej. Marketing)', 'aria-label': 'Nombre del equipo' } });
    var s = W.Sheet.open({ title: 'Nuevo equipo', className: 'editor', body: [
      U.el('div.group', [U.el('label.cell', [name])]),
      W.UI.section({ header: 'Con quién', items: people.length ? people.map(function (f) {
        var p = PE().profile(f.uid) || {};
        return W.UI.cell({ lead: W.Avatar.forProfile(p.uid ? p : { name: f.name }, 32), title: p.name || f.name || 'Contacto', sub: f.kind === 'work' ? 'Trabajo' : 'Amigo', right: W.UI.toggle(false, function (v) { chosen[f.uid] = v; }, f.name || 'Contacto') });
      }) : [W.UI.cell({ title: 'Aún no tienes contactos', sub: 'Crea el equipo y comparte su enlace o su QR' })], footer: 'Luego puedes invitar a más gente con el enlace del equipo.' })
    ], foot: [U.el('button.btn.primary', { text: 'Crear equipo', on: { click: function () {
      var n = name.value.trim(); if (!n) { name.focus(); return; }
      var members = people.filter(function (f) { return chosen[f.uid]; }).map(function (f) { return { uid: f.uid, name: (PE().profile(f.uid) || {}).name || f.name }; });
      PE().createTeam(n, members).then(function (id) { s.close(); W.Toast.show({ text: 'Equipo «' + n + '» creado', icon: 'team', type: 'success' }); setTimeout(function () { teamSheet(id); }, 250); })
        .catch(function (e) { if (!e || e.code !== 'premium') W.Toast.show({ text: 'No se pudo crear el equipo', type: 'danger' }); });
    } } })] });
    setTimeout(function () { name.focus(); }, W.Layout.desktop ? 30 : 380);
  }
  function teamSheet(id) {
    var st = S(), host = U.el('div.space-body'), me = PE().uid();
    var input = U.el('input.input', { attrs: { type: 'text', maxlength: 160, placeholder: 'Añadir una tarea del equipo…', 'aria-label': 'Nueva tarea del equipo' } });
    var draw = function () {
      U.clear(host);
      var d = PE().team(id);
      if (!d) { host.appendChild(W.UI.empty('buddy:search:worried', 'No se pudo abrir el equipo', 'Puede que ya no formes parte de él.', null, true)); return; }
      var names = d.members || {};
      host.appendChild(U.el('div.pp-members', Object.keys(names).map(function (k) {
        return U.el('span.pp-member', [W.Avatar.small(k, 34), U.el('span', { text: k === me ? 'Tú' : names[k] }), k === d.owner ? U.icon('crown', 'xs') : null]);
      })));
      host.appendChild(U.el('div.pp-team-acts', [
        U.el('button.btn.sm.primary', { on: { click: function () { s.close(); W.Chat.openChat({ team: id }); } } }, [U.icon('chat', 'sm'), 'Chat del equipo']),
        U.el('button.btn.sm.soft', { on: { click: function () { s.close(); st.ui.page = null; W.Router.go('notes'); } } }, [U.icon('notebook', 'sm'), 'Páginas']),
        U.el('button.btn.sm.soft', { on: { click: function () { W.Invite.qrSheet({ team: id }); } } }, [U.icon('qr', 'sm'), 'Invitar'])
      ]));
      var pend = d.tasks.filter(function (t) { return !t.done; }), done = d.tasks.filter(function (t) { return t.done; });
      var row = function (t) {
        var chk = U.el('button.check.sm' + (t.done ? '.on' : ''), { attrs: { 'aria-label': t.done ? 'Desmarcar' : 'Completar' } });
        chk.appendChild(U.svg('svg', { viewBox: '0 0 24 24' }, [U.svg('path', { d: 'm5 12.6 4.5 4.5L19 7.6' })]));
        chk.addEventListener('click', function () {
          PE().editTeam(id, function (x) { x.tasks.forEach(function (y) { if (y.id === t.id) { y.done = !y.done; y.doneBy = y.done ? me : null; y.updatedAt = Date.now(); } }); }).then(draw).catch(function () {});
          if (!t.done) W.Audio.success();
        });
        var who = t.done && t.doneBy ? 'Hecha por ' + (t.doneBy === me ? 'ti' : (names[t.doneBy] || 'alguien')) : 'Añadida por ' + (t.by === me ? 'ti' : (names[t.by] || 'alguien'));
        return U.el('div.cell.space-task' + (t.done ? '.done' : ''), [chk, U.el('span.cell-main', [U.el('span.cell-title', { text: t.text }), U.el('span.cell-sub', { text: who })]),
          U.el('button.circle-btn', { attrs: { 'aria-label': 'Quitar' }, on: { click: function () { PE().editTeam(id, function (x) { x.tasks = x.tasks.filter(function (y) { return y.id !== t.id; }); }).then(draw).catch(function () {}); } } }, [U.icon('close')])]);
      };
      host.appendChild(W.UI.section({ header: 'Tareas del equipo (' + pend.length + ')', items: pend.length ? pend.map(row) : [W.UI.cell({ title: 'Nada pendiente', sub: 'Añadid tareas para trabajar en equipo' })] }));
      if (done.length) host.appendChild(W.UI.section({ header: 'Hechas (' + done.length + ')', items: done.slice(-30).map(row) }));
      if (d.owner === me) host.appendChild(W.UI.section({ header: 'Administrar', items: [
        W.UI.cell({ icon: 'refresh', title: 'Renovar el enlace del equipo', sub: 'El enlace anterior deja de servir', onTap: function () { PE().renewTeamLink(id).then(function () { W.Toast.show({ text: 'Enlace renovado', icon: 'check' }); draw(); }); } })
      ] }));
    };
    var add = function () {
      var v = input.value.trim(); if (!v) return;
      input.value = '';
      PE().editTeam(id, function (x) { x.tasks.push({ id: U.uid('st'), text: v.slice(0, 160), by: me, done: false, doneBy: null, createdAt: Date.now(), updatedAt: Date.now() }); }).then(draw).catch(function () { W.Toast.show({ text: 'No se pudo añadir', type: 'danger' }); });
    };
    input.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); add(); } });
    var s = W.Sheet.open({ title: (st.social.spaces[id] || {}).name || 'Equipo', className: 'editor space-sheet', full: true,
      body: [host, U.el('div.space-add', [input, U.el('button.btn.primary.sm', { text: 'Añadir', on: { click: add } })])],
      foot: [U.el('button.btn.ghost', { on: { click: function () {
        W.Sheet.confirm({ title: '¿Salir del equipo?', text: 'Dejarás de ver su chat, sus tareas y sus páginas.', ok: 'Salir', danger: true }).then(function (ok) { if (ok) PE().leaveTeam(id).then(function () { s.close(); }); });
      } } }, [U.icon('logout', 'sm'), 'Salir del equipo'])],
      onClose: function () { clearInterval(teamTimer); } });
    PE().loadTeam(id).then(draw).catch(function () { draw(); });
    clearInterval(teamTimer);
    teamTimer = setInterval(function () { if (!document.hidden) PE().loadTeam(id).then(draw).catch(function () {}); }, 12000);
  }

  /* ---------- Pantalla ---------- */
  W.Screens.friends = {
    title: 'Personas',
    back: function () { if (W.Layout.desktop) return false; W.Router.back(); return true; },
    render: function (root) {
      var st = S(), desk = W.Layout.desktop, P = W.Plan;
      if (!unsub) unsub = PE().subscribe(function (r) { if (S().activeScreen === 'friends' && (r === 'requests' || r === 'profiles' || r === 'error' || r === 'team')) W.Router.refresh(); });
      var head = W.UI.header({ title: 'Personas', back: desk ? null : { label: 'Atrás', onTap: function () { W.Router.back(); } }, sub: 'Amigos, trabajo y equipos' });
      var content = [];
      var b = PE().blocker();
      if (b && !b.soft) {
        var action = null;
        if (b.id === 'guest' && W.Auth.configured()) action = U.el('button.btn.sm.primary', { on: { click: function () { W.AuthScreen.open({ mode: 'login' }); } } }, [U.icon('user', 'sm'), 'Iniciar sesión']);
        else if (b.id === 'unverified') action = U.el('button.btn.sm.primary', { on: { click: function () { W.Auth.refresh().then(function () { W.Router.refresh(); }).catch(function () { W.Router.refresh(); }); } } }, [U.icon('check', 'sm'), 'Ya lo he verificado']);
        else if (b.id === 'permission') action = U.el('button.btn.sm.soft', { on: { click: function () { PE().poll(true); } } }, [U.icon('refresh', 'sm'), 'Reintentar']);
        content.push(U.el('div.group', [W.UI.empty('buddy:friends', b.title, b.text, action)]));
        W.UI.mount(root, head, content); return;
      }
      if (!st.social.enabled) {
        content.push(U.el('div.group.card.fr-hero', [W.Character.illustration('friends', 'happy', 110), U.el('strong', { text: 'Activa la comunidad' }),
          U.el('p', { text: 'Tus contactos verán tu nombre, tu personaje y tu racha. Nunca tus tareas ni tu Cuaderno (salvo lo que compartas).' }),
          U.el('button.btn.primary', { on: { click: function (e) { e.currentTarget.disabled = true; PE().enable().then(function () { W.Router.refresh(); PE().poll(true); }).catch(function () { W.Router.refresh(); }); } } }, [U.icon('users', 'sm'), 'Activar'])]));
        W.UI.mount(root, head, content); return;
      }
      if (b && b.soft) content.push(U.el('div.group', [W.UI.cell({ icon: 'cloud', title: b.title, sub: b.text, onTap: function () { PE().poll(true); } })]));
      // Tu tarjeta e invitar
      var code = st.social.code || '…';
      var invite = function (kind) { if (P.gate('community')) W.Invite.share(W.Invite.personLink(kind)); };
      var input = U.el('input.input', { attrs: { type: 'text', placeholder: 'Código (WH-…) o enlace', 'aria-label': 'Código o enlace de invitación', autocapitalize: 'characters', spellcheck: 'false' } });
      var go = function () { var v = input.value.trim(); if (!v) { input.focus(); return; } var inv = W.Invite.parse(v); if (inv && inv.type !== 'code') { W.Invite.open(inv); input.value = ''; return; } PE().addByCode(v, tab() === 'work' ? 'work' : 'friend').then(function (okk) { if (okk) input.value = ''; }); };
      input.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); go(); } });
      content.push(U.el('div.pp-top', [
        U.el('div.group.card.pp-me', [
          U.el('button.pp-me-av', { attrs: { 'aria-label': 'Personalizar tu personaje', title: 'Personalizar' }, on: { click: function () { W.Character.edit('avatar'); } } }, [W.Avatar.me(78, { live: true })]),
          U.el('div.pp-me-main', [U.el('strong', { text: PE().myName() }), U.el('small', { text: 'Tu código: ' + code }),
            U.el('div.pp-me-acts', [
              U.el('button.btn.sm.primary', { on: { click: function () { invite(tab() === 'work' ? 'work' : 'friend'); } } }, [U.icon('share', 'sm'), 'Invitar', premiumGem()]),
              U.el('button.btn.sm.soft', { on: { click: function () { if (P.gate('community')) W.Invite.qrSheet({ kind: tab() === 'work' ? 'work' : 'friend' }); } } }, [U.icon('qr', 'sm'), 'Mi QR']),
              U.el('button.btn.sm.soft', { on: { click: function () { W.Invite.scan(); } } }, [U.icon('scan', 'sm'), 'Escanear'])
            ])])
        ]),
        U.el('div.group.card.pp-add', [U.el('small', { text: 'Añadir con un código o un enlace' }), U.el('div.pl-code', [input, U.el('button.btn.primary', { text: 'Añadir', on: { click: go } })])])
      ]));
      var reqs = PE().requests(), rk = Object.keys(reqs);
      if (rk.length) content.push(W.UI.section({ title: 'Solicitudes', side: U.el('small', { text: rk.length }), items: rk.map(function (k) { return requestRow(k, reqs[k]); }) }));
      var friends = PE().contacts('friend'), work = PE().contacts('work'), teams = PE().teams();
      content.push(U.el('div.pp-tabs', [W.UI.segmented([{ value: 'friend', label: 'Amigos' + (friends.length ? ' · ' + friends.length : '') }, { value: 'work', label: 'Trabajo' + (work.length ? ' · ' + work.length : '') }, { value: 'teams', label: 'Equipos' + (teams.length ? ' · ' + teams.length : '') }], tab(), function (v) { st.ui.peopleTab = v; W.Router.refresh(); })]));
      if (tab() === 'teams') {
        teams.forEach(function (t) { if (!PE().team(t.id)) PE().loadTeam(t.id).catch(function () {}); });
        content.push(U.el('div.pp-teams', teams.map(teamCard).concat([
          U.el('button.pp-team.new', { attrs: { type: 'button' }, on: { click: newTeam } }, [U.el('span.pp-team-ic', [U.icon('plus')]), U.el('span.pp-team-main', [U.el('strong', { text: 'Nuevo equipo' }), U.el('small', { text: 'Chat, tareas y páginas compartidas' })]), premiumGem()]),
          U.el('button.pp-team.new', { attrs: { type: 'button' }, on: { click: function () { W.Invite.scan(); } } }, [U.el('span.pp-team-ic', [U.icon('scan')]), U.el('span.pp-team-main', [U.el('strong', { text: 'Unirme a un equipo' }), U.el('small', { text: 'Con su enlace o su código QR' })])])
        ])));
        if (st.ui.team && PE().team(st.ui.team)) { var t0 = st.ui.team; st.ui.team = null; setTimeout(function () { teamSheet(t0); }, 200); }
      } else {
        var list = tab() === 'work' ? work : friends;
        content.push(list.length ? U.el('div.pp-grid', list.map(contactCard)) : U.el('div.group', [W.UI.empty('buddy:friends', tab() === 'work' ? 'Aún no tienes contactos de trabajo' : 'Aún no tienes amigos aquí',
          'Invítalos con tu enlace o tu código QR: se conectan con un toque.', U.el('button.btn.sm.primary', { on: { click: function () { invite(tab() === 'work' ? 'work' : 'friend'); } } }, [U.icon('share', 'sm'), 'Invitar']), true)]));
        var cheers = st.social.cheers.slice(-5).reverse();
        if (tab() === 'friend' && cheers.length) content.push(W.UI.section({ header: 'Ánimos recibidos', items: cheers.map(function (c) { return W.UI.cell({ icon: 'send', title: '«' + c.text + '»', sub: (c.name || 'Un amigo') + ' · ' + U.fmtRel(c.at - Date.now()) }); }) }));
      }
      content.push(U.el('div.pp-foot', [U.el('button.link-btn.muted', { text: 'Renovar mis enlaces de invitación', on: { click: function () { W.Sheet.confirm({ title: '¿Renovar tus enlaces?', text: 'Los enlaces y QR que ya enviaste dejarán de conectar solos (quien los use te enviará una solicitud).', ok: 'Renovar' }).then(function (ok) { if (ok) PE().renewInvites(); }); } } })]));
      W.UI.mount(root, head, content);
      if (Date.now() - (PE()._lastShown || 0) > 6000) { PE()._lastShown = Date.now(); setTimeout(function () { PE().poll(true); }, 60); }
    }
  };
})(window.Whider);
