/**
 * WHIDER · Personas: tus chats, tus contactos y tus equipos
 *
 *  - Arriba, tu tarjeta (foto, nombre y código) para invitar con un enlace o un código QR, escanear el de otra
 *    persona o escribir su código.
 *  - Las solicitudes, tus chats más recientes (todos, en «Todos los chats») y, debajo, tus contactos (de amigos o de
 *    trabajo) y tus equipos: miembros, enlace y QR para unirse, tareas en común, chat y páginas del equipo.
 */
window.Whider = window.Whider || {};
window.Whider.Screens = window.Whider.Screens || {};

(function (W) {
  'use strict';
  var U = W.U, S = function () { return W.State; }, PE = function () { return W.People; };
  var unsub = null, teamTimer = null;

  // Contactos o equipos (las pestañas antiguas «friend» y «work» son ahora «Contactos»)
  function tab() { return S().ui.peopleTab === 'teams' ? 'teams' : 'contacts'; }

  /* ---------- Tarjetas ---------- */
  function contactCard(f) {
    var p = PE().profile(f.uid) || {}, work = (f.kind || 'friend') === 'work';
    var name = p.name || f.name || W.t('Contacto');
    var card = U.el('div.pp-card' + (f.pending ? '.pending' : ''), [
      U.el('div.pp-av', [W.Avatar.forProfile(p.uid ? p : { name: name }, 48)]),
      U.el('div.pp-main', [
        U.el('strong', { text: name }),
        U.el('span', { text: f.pending ? W.t('Esperando su confirmación…') : (work ? W.t('Trabajo') : W.t('Amigo')) + (p.updatedAt ? ' · ' + W.t('Activo {when}', { when: U.fmtRel(p.updatedAt - Date.now()) }) : '') })
      ]),
      U.el('div.pp-acts', [
        U.el('button.btn.sm.primary', { on: { click: function () { W.Chat.openChat({ uid: f.uid }); } } }, [U.icon('chat', 'sm'), W.t('Chat')]),
        U.el('button.nav-icon', { attrs: { 'aria-label': W.t('Más opciones'), title: W.t('Más opciones') }, on: { click: function (e) { contactMenu(f, name, e.currentTarget); } } }, [U.icon('dots')])
      ])
    ]);
    return card;
  }
  /** Un chat reciente (como en la lista de chats) */
  function chatRow(c) {
    var C = W.Chat, un = C.unread(c);
    var av = c.type === 'team' ? U.el('span.av.av-team', { style: { '--s': '44px' } }, [U.el('span.av-in', [U.icon((S().social.spaces[c.sid] || {}).icon || 'team')])]) : W.Avatar.small(C.other(c), 44);
    var last = c.last ? (c.last.by === C.me() ? W.t('Tú: {text}', { text: c.last.text }) : c.type === 'team' ? (c.last.name || '').split(' ')[0] + ': ' + c.last.text : c.last.text) : W.t('Empieza la conversación');
    return U.el('button.pp-chat' + (un ? '.unread' : ''), { attrs: { type: 'button' }, on: { click: function () { C.openChat(c.id); } } }, [
      av, U.el('span.pp-chat-main', [U.el('b', { text: C.title(c) }), U.el('small', { text: last })]), un ? U.el('i.ct-dot', { attrs: { 'aria-label': W.t('Sin leer') } }) : null
    ]);
  }
  function contactMenu(f, name, anchor) {
    var work = (f.kind || 'friend') === 'work';
    W.Menu.open(anchor, [
      { value: 'move', label: work ? W.t('Pasar a Amigos') : W.t('Pasar a Trabajo'), icon: work ? 'heart' : 'briefcase' },
      { value: 'team', label: W.t('Añadir a un equipo…'), icon: 'team' },
      { value: 'remove', label: W.t('Quitar de contactos'), icon: 'trash', destructive: true, gap: true },
      { value: 'report', label: W.t('Denunciar…'), icon: 'flag' },
      { value: 'block', label: W.t('Bloquear'), icon: 'hand', destructive: true }
    ], { title: name }).then(function (v) {
      if (v === 'report') { PE().reportSheet({ who: f.uid, name: name, where: 'contacto' }); return; }
      if (v === 'block') { PE().blockConfirm(f.uid, name); return; }
      if (v === 'move') { PE().setKind(f.uid, work ? 'friend' : 'work'); W.Toast.show({ text: work ? W.t('{name} ahora está en Amigos', { name: name }) : W.t('{name} ahora está en Trabajo', { name: name }), icon: 'users' }); }
      else if (v === 'team') {
        var mine = PE().teams().filter(function (t) { var d = PE().team(t.id); return d && d.owner === PE().uid(); });
        if (!mine.length) { W.Toast.show({ text: W.t('Crea un equipo primero (solo quien lo crea añade a otros; los demás comparten su enlace).'), icon: 'info', duration: 5000 }); return; }
        W.Sheet.choose({ title: W.t('Añadir a {name} a', { name: name }), options: mine.map(function (t) { return { value: t.id, label: t.name, icon: 'team' }; }) }).then(function (sid) { if (sid) PE().addToTeam(sid, [{ uid: f.uid, name: name }]).then(function () { W.Toast.show({ text: W.t('{name} está en el equipo', { name: name }), icon: 'team', type: 'success' }); }).catch(function () { W.Toast.show({ text: W.t('No se pudo añadir'), type: 'danger' }); }); });
      }
      else if (v === 'remove') W.Sheet.confirm({ title: W.t('¿Quitar a {name}?', { name: name }), ok: W.t('Quitar'), danger: true }).then(function (ok) { if (ok) PE().remove(f.uid); });
    });
  }
  function requestRow(k, r) {
    var kind = r.kind === 'work' ? 'work' : 'friend';
    var p = PE().profile(k) || {};
    return U.el('div.cell.pp-req', [W.Avatar.forProfile(p.uid ? p : { name: r.name }, 40), U.el('span.cell-main', [U.el('span.cell-title', { text: r.name || W.t('Alguien') }), U.el('span.cell-sub', { text: (kind === 'work' ? W.t('Quiere conectar contigo (trabajo)') : W.t('Quiere ser tu amigo')) + (r.code ? ' · ' + r.code : '') })]),
      U.el('span.cell-row', [U.el('button.btn.xs.soft', { text: W.t('Rechazar'), on: { click: function () { PE().answer(k, false); } } }),
        U.el('button.btn.xs.primary', { text: W.t('Aceptar'), on: { click: function (e) {
          W.Menu.open(e.currentTarget, [{ value: 'friend', label: W.t('Aceptar como amigo'), icon: 'heart', on: kind === 'friend' }, { value: 'work', label: W.t('Aceptar como trabajo'), icon: 'briefcase', on: kind === 'work' }]).then(function (v) { if (v) PE().answer(k, true, v); });
        } } })])]);
  }
  /* ---------- Equipos ---------- */
  function teamCard(t) {
    var d = PE().team(t.id), n = d ? Object.keys(d.members || {}).length : null;
    var pages = W.Pages.all({ team: t.id }).filter(function (m) { return !W.Pages.isRow(m); }).length;
    return U.el('button.pp-team', { attrs: { type: 'button' }, on: { click: function () { teamSheet(t.id); } } }, [
      U.el('span.pp-team-ic', [U.icon(t.icon || 'team')]),
      U.el('span.pp-team-main', [U.el('strong', { text: t.name }), U.el('small', { text: (n != null ? U.plural(n, 'miembro', 'miembros') : W.t('Equipo')) + ' · ' + U.plural(pages, 'página', 'páginas') })]),
      d ? U.el('span.pp-team-avs', Object.keys(d.members || {}).slice(0, 4).map(function (k) { return W.Avatar.small(k, 26); })) : null,
      U.icon('chev', 'chev')
    ]);
  }
  function newTeam() {
    var people = PE().contacts().filter(function (f) { return !f.pending; }), chosen = {};
    var name = U.el('input.cell-input.title', { attrs: { type: 'text', maxlength: 40, placeholder: W.t('Nombre del equipo (p. ej. Marketing)'), 'aria-label': W.t('Nombre del equipo') } });
    var s = W.Sheet.open({ title: W.t('Nuevo equipo'), className: 'editor', body: [
      U.el('div.group', [U.el('label.cell', [name])]),
      W.UI.section({ header: W.t('Con quién'), items: people.length ? people.map(function (f) {
        var p = PE().profile(f.uid) || {};
        return W.UI.cell({ lead: W.Avatar.forProfile(p.uid ? p : { name: f.name }, 32), title: p.name || f.name || W.t('Contacto'), sub: f.kind === 'work' ? W.t('Trabajo') : W.t('Amigo'), right: W.UI.toggle(false, function (v) { chosen[f.uid] = v; }, f.name || W.t('Contacto')) });
      }) : [W.UI.cell({ title: W.t('Aún no tienes contactos'), sub: W.t('Crea el equipo y comparte su enlace o su QR') })], footer: W.t('Luego puedes invitar a más gente con el enlace del equipo.') })
    ], foot: [U.el('button.btn.primary', { text: W.t('Crear equipo'), on: { click: function () {
      var n = name.value.trim(); if (!n) { name.focus(); return; }
      var members = people.filter(function (f) { return chosen[f.uid]; }).map(function (f) { return { uid: f.uid, name: (PE().profile(f.uid) || {}).name || f.name }; });
      PE().createTeam(n, members).then(function (id) { s.close(); W.Toast.show({ text: W.t('Equipo «{name}» creado', { name: n }), icon: 'team', type: 'success' }); setTimeout(function () { teamSheet(id); }, 250); })
        .catch(function () { W.Toast.show({ text: W.t('No se pudo crear el equipo'), type: 'danger' }); });
    } } })] });
    setTimeout(function () { name.focus(); }, W.Layout.desktop ? 30 : 380);
  }
  function teamSheet(id) {
    var st = S(), host = U.el('div.space-body'), me = PE().uid();
    var input = U.el('input.input', { attrs: { type: 'text', maxlength: 160, placeholder: W.t('Añadir una tarea del equipo…'), 'aria-label': W.t('Nueva tarea del equipo') } });
    var draw = function () {
      U.clear(host);
      var d = PE().team(id);
      if (!d) { host.appendChild(W.UI.empty('search', W.t('No se pudo abrir el equipo'), W.t('Puede que ya no formes parte de él.'), null, true)); return; }
      var names = d.members || {};
      host.appendChild(U.el('div.pp-members', Object.keys(names).map(function (k) {
        return U.el('span.pp-member', [W.Avatar.small(k, 34), U.el('span', { text: k === me ? W.t('Tú') : names[k] }), k === d.owner ? U.icon('crown', 'xs') : null]);
      })));
      host.appendChild(U.el('div.pp-team-acts', [
        U.el('button.btn.sm.primary', { on: { click: function () { s.close(); W.Chat.openChat({ team: id }); } } }, [U.icon('chat', 'sm'), W.t('Chat del equipo')]),
        U.el('button.btn.sm.soft', { on: { click: function () { s.close(); st.ui.page = null; W.Router.go('notes'); } } }, [U.icon('notebook', 'sm'), W.t('Páginas')]),
        U.el('button.btn.sm.soft', { on: { click: function () { W.Invite.qrSheet({ team: id }); } } }, [U.icon('qr', 'sm'), W.t('Invitar')])
      ]));
      var pend = d.tasks.filter(function (t) { return !t.done; }), done = d.tasks.filter(function (t) { return t.done; });
      var row = function (t) {
        var chk = U.el('button.check.sm' + (t.done ? '.on' : ''), { attrs: { 'aria-label': t.done ? W.t('Desmarcar') : W.t('Completar') } });
        chk.appendChild(U.svg('svg', { viewBox: '0 0 24 24' }, [U.svg('path', { d: 'm5 12.6 4.5 4.5L19 7.6' })]));
        chk.addEventListener('click', function () {
          PE().editTeam(id, function (x) { x.tasks.forEach(function (y) { if (y.id === t.id) { y.done = !y.done; y.doneBy = y.done ? me : null; y.updatedAt = Date.now(); } }); }).then(draw).catch(function () {});
          if (!t.done) W.Audio.success();
        });
        var by = function (u) { return u === me ? W.t('ti') : (names[u] || W.t('alguien')); };
        var who = t.done && t.doneBy ? W.t('Hecha por {who}', { who: by(t.doneBy) }) : W.t('Añadida por {who}', { who: by(t.by) });
        return U.el('div.cell.space-task' + (t.done ? '.done' : ''), [chk, U.el('span.cell-main', [U.el('span.cell-title', { text: t.text }), U.el('span.cell-sub', { text: who })]),
          U.el('button.circle-btn', { attrs: { 'aria-label': W.t('Quitar') }, on: { click: function () { PE().editTeam(id, function (x) { x.tasks = x.tasks.filter(function (y) { return y.id !== t.id; }); }).then(draw).catch(function () {}); } } }, [U.icon('close')])]);
      };
      host.appendChild(W.UI.section({ header: W.t('Tareas del equipo ({n})', { n: pend.length }), items: pend.length ? pend.map(row) : [W.UI.cell({ title: W.t('Nada pendiente'), sub: W.t('Añadid tareas para trabajar en equipo') })] }));
      if (done.length) host.appendChild(W.UI.section({ header: W.t('Hechas ({n})', { n: done.length }), items: done.slice(-30).map(row) }));
      if (d.owner === me) host.appendChild(W.UI.section({ header: W.t('Administrar'), items: [
        W.UI.cell({ icon: 'refresh', title: W.t('Renovar el enlace del equipo'), sub: W.t('El enlace anterior deja de servir'), onTap: function () { PE().renewTeamLink(id).then(function () { W.Toast.show({ text: W.t('Enlace renovado'), icon: 'check' }); draw(); }); } })
      ] }));
    };
    var add = function () {
      var v = input.value.trim(); if (!v) return;
      input.value = '';
      PE().editTeam(id, function (x) { x.tasks.push({ id: U.uid('st'), text: v.slice(0, 160), by: me, done: false, doneBy: null, createdAt: Date.now(), updatedAt: Date.now() }); }).then(draw).catch(function () { W.Toast.show({ text: W.t('No se pudo añadir'), type: 'danger' }); });
    };
    input.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); add(); } });
    var s = W.Sheet.open({ title: (st.social.spaces[id] || {}).name || W.t('Equipo'), className: 'editor space-sheet', full: true,
      body: [host, U.el('div.space-add', [input, U.el('button.btn.primary.sm', { text: W.t('Añadir'), on: { click: add } })])],
      foot: [U.el('button.btn.ghost', { on: { click: function () {
        W.Sheet.confirm({ title: W.t('¿Salir del equipo?'), text: W.t('Dejarás de ver su chat, sus tareas y sus páginas.'), ok: W.t('Salir'), danger: true }).then(function (ok) { if (ok) PE().leaveTeam(id).then(function () { s.close(); }); });
      } } }, [U.icon('logout', 'sm'), W.t('Salir del equipo')])],
      onClose: function () { clearInterval(teamTimer); } });
    PE().loadTeam(id).then(draw).catch(function () { draw(); });
    clearInterval(teamTimer);
    teamTimer = setInterval(function () { if (!document.hidden) PE().loadTeam(id).then(draw).catch(function () {}); }, 12000);
  }

  /* ---------- Pantalla ---------- */
  W.Screens.friends = {
    title: W.t('Personas'),
    render: function (root) {
      var st = S();
      if (!unsub) {
        unsub = PE().subscribe(function (r) { if (S().activeScreen === 'friends' && (r === 'requests' || r === 'profiles' || r === 'error' || r === 'team')) W.Router.refresh(); });
        // Los chats recientes se ponen al día solos
        W.Chat.subscribe(function (r) { if (S().activeScreen === 'friends' && r === 'list') W.Router.refresh(); });
      }
      var head = W.UI.header({ title: W.t('Personas'), sub: W.t('Chats, contactos y equipos') });
      var content = [];
      var b = PE().blocker();
      if (b && !b.soft) {
        var action = null;
        if (b.id === 'guest' && W.Auth.configured()) action = U.el('button.btn.sm.primary', { on: { click: function () { W.AuthScreen.open({ mode: 'login' }); } } }, [U.icon('user', 'sm'), W.t('Iniciar sesión')]);
        else if (b.id === 'unverified') action = U.el('button.btn.sm.primary', { on: { click: function () { W.Auth.refresh().then(function () { W.Router.refresh(); }).catch(function () { W.Router.refresh(); }); } } }, [U.icon('check', 'sm'), W.t('Ya lo he verificado')]);
        else if (b.id === 'permission') action = U.el('button.btn.sm.soft', { on: { click: function () { PE().poll(true); } } }, [U.icon('refresh', 'sm'), W.t('Reintentar')]);
        content.push(U.el('div.group', [W.UI.empty('users', b.title, b.text, action)]));
        W.UI.mount(root, head, content); return;
      }
      if (!st.social.enabled) {
        content.push(U.el('div.group.card.fr-hero', [U.el('span.es-art', [U.icon('users')]), U.el('strong', { text: W.t('Trabaja con otras personas') }),
          U.el('p', { text: W.t('Chatea, crea equipos y comparte tareas y páginas. Tus contactos solo ven tu nombre y tu foto; nunca tus tareas ni tu Cuaderno (salvo lo que compartas).') }),
          U.el('button.btn.primary', { on: { click: function (e) { e.currentTarget.disabled = true; PE().enable().then(function () { W.Router.refresh(); PE().poll(true); }).catch(function () { W.Router.refresh(); }); } } }, [U.icon('users', 'sm'), W.t('Activar')])]));
        W.UI.mount(root, head, content); return;
      }
      if (b && b.soft) content.push(U.el('div.group', [W.UI.cell({ icon: 'cloud', title: b.title, sub: b.text, onTap: function () { PE().poll(true); } })]));
      // Tu tarjeta e invitar
      var code = st.social.code || '…';
      var invite = function (kind) { W.Invite.share(W.Invite.personLink(kind)); };
      var input = U.el('input.input', { attrs: { type: 'text', placeholder: W.t('Código (WH-…) o enlace'), 'aria-label': W.t('Código o enlace de invitación'), autocapitalize: 'characters', spellcheck: 'false' } });
      var go = function () { var v = input.value.trim(); if (!v) { input.focus(); return; } var inv = W.Invite.parse(v); if (inv && inv.type !== 'code') { W.Invite.open(inv); input.value = ''; return; } PE().addByCode(v, 'friend').then(function (okk) { if (okk) input.value = ''; }); };
      input.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); go(); } });
      content.push(U.el('div.pp-top', [
        U.el('div.group.card.pp-me', [
          U.el('button.pp-me-av', { attrs: { 'aria-label': W.t('Editar perfil'), title: W.t('Editar perfil') }, on: { click: function () { W.Profile.edit(function () { W.Router.refresh(); }); } } }, [W.Avatar.me(64)]),
          U.el('div.pp-me-main', [U.el('strong', { text: PE().myName() }), U.el('small', { text: W.t('Tu código: {code}', { code: code }) }),
            U.el('div.pp-me-acts', [
              U.el('button.btn.sm.primary', { on: { click: function () { invite('friend'); } } }, [U.icon('share', 'sm'), W.t('Invitar')]),
              U.el('button.btn.sm.soft', { on: { click: function () { W.Invite.qrSheet({ kind: 'friend' }); } } }, [U.icon('qr', 'sm'), W.t('Mi QR')]),
              U.el('button.btn.sm.soft', { on: { click: function () { W.Invite.scan(); } } }, [U.icon('scan', 'sm'), W.t('Escanear')])
            ])])
        ]),
        U.el('div.group.card.pp-add', [U.el('small', { text: W.t('Añadir con un código o un enlace') }), U.el('div.code-row', [input, U.el('button.btn.primary', { text: W.t('Añadir'), on: { click: go } })])])
      ]));
      var reqs = PE().requests(), rk = Object.keys(reqs);
      if (rk.length) content.push(W.UI.section({ title: W.t('Solicitudes'), side: U.el('small', { text: rk.length }), items: rk.map(function (k) { return requestRow(k, reqs[k]); }) }));
      // Chats recientes (todos, en «Todos los chats»)
      var chats = W.Chat.list();
      if (chats.length) content.push(W.UI.section({ title: W.t('Chats'), side: U.el('button.link-btn', { text: W.t('Todos los chats'), on: { click: function () { W.Router.go('chats'); } } }),
        items: U.el('div.group.pp-chats', chats.slice(0, 4).map(chatRow)) }));
      var contacts = PE().contacts(), teams = PE().teams();
      content.push(U.el('div.pp-tabs', [W.UI.segmented([{ value: 'contacts', label: W.t('Contactos') + (contacts.length ? ' · ' + contacts.length : '') }, { value: 'teams', label: W.t('Equipos') + (teams.length ? ' · ' + teams.length : '') }], tab(), function (v) { st.ui.peopleTab = v; W.Router.refresh(); })]));
      if (tab() === 'teams') {
        teams.forEach(function (t) { if (!PE().team(t.id)) PE().loadTeam(t.id).catch(function () {}); });
        content.push(U.el('div.pp-teams', teams.map(teamCard).concat([
          U.el('button.pp-team.new', { attrs: { type: 'button' }, on: { click: newTeam } }, [U.el('span.pp-team-ic', [U.icon('plus')]), U.el('span.pp-team-main', [U.el('strong', { text: W.t('Nuevo equipo') }), U.el('small', { text: W.t('Chat, tareas y páginas compartidas') })])]),
          U.el('button.pp-team.new', { attrs: { type: 'button' }, on: { click: function () { W.Invite.scan(); } } }, [U.el('span.pp-team-ic', [U.icon('scan')]), U.el('span.pp-team-main', [U.el('strong', { text: W.t('Unirme a un equipo') }), U.el('small', { text: W.t('Con su enlace o su código QR') })])])
        ])));
        if (st.ui.team && PE().team(st.ui.team)) { var t0 = st.ui.team; st.ui.team = null; setTimeout(function () { teamSheet(t0); }, 200); }
      } else {
        content.push(contacts.length ? U.el('div.pp-grid', contacts.map(contactCard)) : U.el('div.group', [W.UI.empty('users', W.t('Aún no tienes contactos'),
          W.t('Invítalos con tu enlace o tu código QR: se conectan con un toque.'), U.el('button.btn.sm.primary', { on: { click: function () { invite('friend'); } } }, [U.icon('share', 'sm'), W.t('Invitar')]), true)]));
      }
      content.push(U.el('div.pp-foot', [U.el('button.link-btn.muted', { text: W.t('Renovar mis enlaces de invitación'), on: { click: function () { W.Sheet.confirm({ title: W.t('¿Renovar tus enlaces?'), text: W.t('Los enlaces y QR que ya enviaste dejarán de conectar solos (quien los use te enviará una solicitud).'), ok: W.t('Renovar') }).then(function (ok) { if (ok) PE().renewInvites(); }); } } })]));
      W.UI.mount(root, head, content);
      if (Date.now() - (PE()._lastShown || 0) > 6000) { PE()._lastShown = Date.now(); setTimeout(function () { PE().poll(true); }, 60); }
    }
  };
})(window.Whider);
