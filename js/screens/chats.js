/**
 * WHIDER · Chats
 *
 * Ordenador: la lista a la izquierda y la conversación a la derecha.
 * Móvil: la lista y, al tocar, la conversación a pantalla completa.
 * En cada mensaje: responder, reaccionar, copiar, crear tarea, editar y borrar (los tuyos).
 * El botón + comparte una tarea, una página del Cuaderno o un ánimo.
 */
window.Whider = window.Whider || {};
window.Whider.Screens = window.Whider.Screens || {};

(function (W) {
  'use strict';
  var U = W.U, S = function () { return W.State; }, C = function () { return W.Chat; };
  var unsub = null, unsubPeople = null, listEl = null, convEl = null, replyTo = null, editing = null, draftFor = {}, lastRendered = {};

  function openId() { return S().ui.chat || null; }
  function desk() { return W.Layout.desktop; }
  function fmtTime(ts) { var d = new Date(ts); return U.pad(d.getHours()) + ':' + U.pad(d.getMinutes()); }
  function dayLabel(ts) { var d = U.ymd(new Date(ts)), td = U.today(); return d === td ? 'Hoy' : d === U.addDays(td, -1) ? 'Ayer' : U.cap(U.fmtDay(d)); }
  function avatarFor(c, size) {
    if (c.type === 'team') return U.el('span.av.av-team', { style: { '--s': size + 'px' } }, [U.el('span.av-in', [U.icon((S().social.spaces[c.sid] || {}).icon || 'team')])]);
    return W.Avatar.small(C().other(c), size);
  }
  function statusText(c) {
    if (c.type === 'team') { var n = (c.memberIds || []).length; return U.plural(n, 'miembro', 'miembros'); }
    var p = W.People.profile(C().other(c));
    if (!p) return '';
    if (p.status === 'focus' && Date.now() - (p.updatedAt || 0) < 3 * 3600000) return 'Concentrado ahora';
    return p.updatedAt ? 'Activo ' + U.fmtRel(p.updatedAt - Date.now()) : '';
  }

  /* ---------- Lista ---------- */
  function drawList() {
    if (!listEl) return;
    U.clear(listEl);
    var chats = C().list(), sel = openId();
    var head = U.el('div.ct-list-top', [
      U.el('strong', { text: 'Chats' }),
      U.el('button.nav-icon', { attrs: { 'aria-label': 'Nuevo chat', title: 'Nuevo chat' }, on: { click: function (e) { newChat(e.currentTarget); } } }, [U.icon('edit')])
    ]);
    if (desk()) listEl.appendChild(head);
    if (!chats.length) {
      listEl.appendChild(U.el('div.ct-empty', [W.Character.illustration('friends', 'happy', 92), U.el('strong', { text: 'Aún no hay chats' }),
        U.el('p', { text: W.People.contacts().length ? 'Escribe a uno de tus contactos o a tu equipo.' : 'Añade a tus amigos o a tu equipo con un enlace o un código QR.' }),
        U.el('button.btn.sm.primary', { on: { click: function (e) { if (W.People.contacts().length || W.People.teams().length) newChat(e.currentTarget); else W.Router.go('friends'); } } }, [U.icon(W.People.contacts().length ? 'edit' : 'users', 'sm'), W.People.contacts().length ? 'Nuevo chat' : 'Añadir personas'])]));
      return;
    }
    chats.forEach(function (c) {
      var un = C().unread(c), p = C().prefs(c.id);
      var row = U.el('button.ct-row' + (c.id === sel ? '.active' : '') + (un ? '.unread' : ''), { attrs: { type: 'button' } }, [
        avatarFor(c, 46),
        U.el('span.ct-row-main', [
          U.el('span.ct-row-top', [U.el('b', { text: C().title(c) }), p.pinned ? U.icon('pin', 'xs') : null, p.muted ? U.icon('sound', 'xs mute') : null, U.el('small', { text: c.lastAt ? (U.ymd(new Date(c.lastAt)) === U.today() ? fmtTime(c.lastAt) : U.fmtShort(U.ymd(new Date(c.lastAt)))) : '' })]),
          U.el('span.ct-row-sub', [U.el('span', { text: c.last ? (c.last.by === C().me() ? 'Tú: ' : c.type === 'team' ? (c.last.name || '').split(' ')[0] + ': ' : '') + c.last.text : 'Empieza la conversación' }), un ? U.el('i.ct-dot') : null])
        ])
      ]);
      row.addEventListener('click', function () { openChat(c.id); });
      row.addEventListener('contextmenu', function (e) { e.preventDefault(); chatMenu(c, row); });
      listEl.appendChild(row);
    });
  }
  function chatMenu(c, anchor) {
    var p = C().prefs(c.id);
    W.Menu.open(anchor, [
      { value: 'pin', label: p.pinned ? 'Dejar de fijar' : 'Fijar arriba', icon: 'pin' },
      { value: 'mute', label: p.muted ? 'Activar avisos' : 'Silenciar avisos', icon: 'sound' },
      { value: 'read', label: 'Marcar como leído', icon: 'check' },
      c.type === 'dm' ? { value: 'hide', label: 'Ocultar el chat', icon: 'eye', gap: true } : null
    ].filter(Boolean), { title: C().title(c) }).then(function (v) {
      if (v === 'pin') C().setPrefs(c.id, { pinned: !p.pinned });
      else if (v === 'mute') C().setPrefs(c.id, { muted: !p.muted });
      else if (v === 'read') C().markRead(c.id);
      else if (v === 'hide') { C().setPrefs(c.id, { hidden: true }); if (openId() === c.id) openChat(null); }
      drawList();
    });
  }
  function newChat(anchor) {
    var people = W.People.contacts(), teams = W.People.teams();
    var opts = people.map(function (f) { return { value: 'u:' + f.uid, label: f.name || 'Contacto', icon: f.kind === 'work' ? 'briefcase' : 'user', desc: f.pending ? 'Pendiente de confirmar' : (f.kind === 'work' ? 'Trabajo' : 'Amigo') }; })
      .concat(teams.map(function (t) { return { value: 't:' + t.id, label: t.name, icon: 'team', desc: 'Chat del equipo' }; }));
    if (!opts.length) { W.Router.go('friends'); return; }
    W.Sheet.choose({ title: 'Nuevo chat', options: opts }).then(function (v) {
      if (!v) return;
      C().openChat(v.indexOf('u:') === 0 ? { uid: v.slice(2) } : { team: v.slice(2) });
    });
    void anchor;
  }

  /* ---------- Conversación ---------- */
  function openChat(cid) {
    S().ui.chat = cid;
    replyTo = null; editing = null;
    if (desk()) { drawList(); drawConv(); }
    else { W.Router.refresh(); W.Router.animate(cid ? 'push' : 'pop'); }
  }
  function bubble(c, m, prev) {
    var mine = m.by === C().me(), grouped = prev && prev.by === m.by && m.at - prev.at < 5 * 60000 && !m.reply;
    var body = U.el('div.ct-bubble' + (mine ? '.mine' : '') + (m.del ? '.deleted' : ''));
    if (c.type === 'team' && !mine && !grouped) body.appendChild(U.el('span.ct-author', { text: m.name || 'Alguien' }));
    if (m.reply) body.appendChild(U.el('button.ct-quote', { attrs: { type: 'button' }, on: { click: function () { var t = convEl && convEl.querySelector('[data-mid="' + m.reply.id + '"]'); if (t) { t.scrollIntoView({ block: 'center', behavior: 'smooth' }); t.classList.add('flash'); setTimeout(function () { t.classList.remove('flash'); }, 1100); } } } }, [U.el('b', { text: m.reply.name || '' }), U.el('span', { text: m.reply.text || '' })]));
    if (m.del) body.appendChild(U.el('span.ct-text.muted', { text: 'Mensaje eliminado' }));
    else if (m.kind === 'task' && m.ref) body.appendChild(taskCard(m));
    else if (m.kind === 'page' && m.ref) body.appendChild(pageCard(c, m));
    else if (m.kind === 'cheer') body.appendChild(U.el('span.ct-cheer', [U.icon('send', 'sm'), U.el('span', { text: m.text })]));
    if (!m.del && m.text && m.kind !== 'cheer') body.appendChild(U.el('span.ct-text', { text: m.text }));
    var meta = U.el('span.ct-meta', [m.edited ? 'editado · ' : '', fmtTime(m.at), mine ? (m.pending ? U.icon('clock', 'xs') : m.failed ? U.icon('alert', 'xs') : U.icon('check', 'xs')) : null]);
    body.appendChild(meta);
    var reacts = m.react ? Object.keys(m.react).reduce(function (acc, k) { acc[m.react[k]] = (acc[m.react[k]] || 0) + 1; return acc; }, {}) : null;
    var row = U.el('div.ct-msg' + (mine ? '.mine' : '') + (grouped ? '.grouped' : ''), { attrs: { 'data-mid': m.id } }, [
      !mine && c.type === 'team' ? (grouped ? U.el('span.ct-av-gap') : W.Avatar.small(m.by, 30)) : null,
      U.el('div.ct-col', [body, reacts && Object.keys(reacts).length ? U.el('div.ct-reacts', Object.keys(reacts).map(function (k) {
        var r = C().REACTIONS.filter(function (x) { return x.id === k; })[0]; if (!r) return null;
        var mineR = m.react[C().me()] === k;
        return U.el('button.ct-react' + (mineR ? '.on' : ''), { attrs: { type: 'button', title: r.label }, on: { click: function () { C().react(c.id, m.id, k); } } }, [U.icon(r.icon, 'xs'), reacts[k] > 1 ? String(reacts[k]) : null]);
      })) : null])
    ]);
    if (m.failed) row.addEventListener('click', function () { C().retry(c.id, m.id); });
    var menu = function (e) { e.preventDefault(); if (!m.del && !m.pending) msgMenu(c, m, body); };
    row.addEventListener('contextmenu', menu);
    body.addEventListener('dblclick', function () { if (!m.del && !m.pending) { C().react(c.id, m.id, 'like'); } });
    if (!desk()) {
      var t0 = null;
      body.addEventListener('touchstart', function () { t0 = setTimeout(function () { W.Audio.vibrate([10]); msgMenu(c, m, body); }, 480); }, { passive: true });
      ['touchend', 'touchmove', 'touchcancel'].forEach(function (ev) { body.addEventListener(ev, function () { clearTimeout(t0); }, { passive: true }); });
    }
    return row;
  }
  function taskCard(m) {
    var t = m.ref;
    return U.el('div.ct-card', [U.el('span.ct-card-ic', [U.icon('tasks')]), U.el('span.ct-card-main', [U.el('b', { text: t.text || 'Tarea' }), U.el('small', { text: t.date ? U.cap(U.fmtDay(t.date)) + (t.time ? ' · ' + U.fmtTime(t.time) : '') : 'Sin fecha' })]),
      m.by !== C().me() ? U.el('button.btn.xs.soft', { text: 'Añadir', on: { click: function (e) {
        e.stopPropagation();
        W.State.addTask({ text: String(t.text || 'Tarea').slice(0, 200), date: t.date || null, time: t.time || null, highlight: t.highlight || 'none', warn: W.State.settings.defaultWarn, notes: 'De ' + (m.name || 'un contacto') + ' (chat)' });
        W.Toast.show({ text: 'Añadida a tus tareas', icon: 'check', type: 'success' });
      } } }) : null]);
  }
  function pageCard(c, m) {
    var pg = m.ref, local = W.Pages.get(pg.id);
    return U.el('div.ct-card', [U.el('span.ct-card-ic', [U.icon(pg.icon || 'page')]), U.el('span.ct-card-main', [U.el('b', { text: pg.title || 'Página' }), U.el('small', { text: local && !local.trash ? (local.team ? 'Página del equipo' : 'En tu Cuaderno') : 'Copia para tu Cuaderno' })]),
      U.el('button.btn.xs.soft', { text: local && !local.trash ? 'Abrir' : 'Guardar copia', on: { click: function (e) {
        e.stopPropagation();
        if (local && !local.trash) { W.Notes.openPage(pg.id); return; }
        var np = W.Pages.create({ title: pg.title || 'Página compartida', icon: pg.icon || 'page', blocks: W.Pages.fromMarkdown(pg.md || '') });
        W.Toast.show({ text: 'Guardada en tu Cuaderno', icon: 'notebook', type: 'success' });
        W.Notes.openPage(np.id);
      } } })]);
  }
  function msgMenu(c, m, anchor) {
    var mine = m.by === C().me();
    var items = [{ value: 'reply', label: 'Responder', icon: 'reply' }];
    C().REACTIONS.forEach(function (r, i) { items.push({ value: 'r:' + r.id, label: r.label, icon: r.icon, gap: i === 0, on: m.react && m.react[C().me()] === r.id }); });
    items.push({ value: 'copy', label: 'Copiar', icon: 'copy', gap: true });
    if (m.text) items.push({ value: 'task', label: 'Crear una tarea', icon: 'tasks' });
    if (mine && m.kind === 'text') items.push({ value: 'edit', label: 'Editar', icon: 'edit' });
    if (mine) items.push({ value: 'del', label: 'Eliminar', icon: 'trash', destructive: true });
    W.Menu.open(anchor, items).then(function (v) {
      if (!v) return;
      if (v === 'reply') { replyTo = m; editing = null; drawComposer(c); }
      else if (v.indexOf('r:') === 0) C().react(c.id, m.id, v.slice(2));
      else if (v === 'copy') W.Invite.copy(m.text || (m.ref && (m.ref.text || m.ref.title)) || '');
      else if (v === 'task') W.Editor.open(null, { text: String(m.text).slice(0, 200) });
      else if (v === 'edit') { editing = m; replyTo = null; drawComposer(c); }
      else if (v === 'del') W.Sheet.confirm({ title: '¿Eliminar el mensaje?', text: 'Se borra para todos.', ok: 'Eliminar', danger: true }).then(function (ok) { if (ok) C().remove(c.id, m.id); });
    });
  }
  var composerHost = null, msgsHost = null;
  function drawMessages(c, keepBottom) {
    if (!msgsHost) return;
    var wasBottom = keepBottom || msgsHost.scrollHeight - msgsHost.scrollTop - msgsHost.clientHeight < 80;
    var prevH = msgsHost.scrollHeight, prevTop = msgsHost.scrollTop;
    U.clear(msgsHost);
    var list = C().messages(c.id);
    if (list.length >= 40) msgsHost.appendChild(U.el('button.ct-older', { text: 'Ver mensajes anteriores', on: { click: function () { C().loadMsgs(c.id, true).then(function () { drawMessages(c); }); } } }));
    if (!list.length) msgsHost.appendChild(U.el('div.ct-hello', [avatarFor(c, 72), U.el('strong', { text: C().title(c) }), U.el('p', { text: c.type === 'team' ? 'El chat de vuestro equipo. Compartid tareas y páginas con el +.' : 'Escribe el primer mensaje. Con el + compartes tareas y páginas.' })]));
    var lastDay = null;
    list.forEach(function (m, i) {
      var day = U.ymd(new Date(m.at));
      if (day !== lastDay) { msgsHost.appendChild(U.el('div.ct-day', [U.el('span', { text: dayLabel(m.at) })])); lastDay = day; }
      msgsHost.appendChild(bubble(c, m, i ? list[i - 1] : null));
    });
    if (wasBottom) msgsHost.scrollTop = msgsHost.scrollHeight;
    else msgsHost.scrollTop = prevTop + (msgsHost.scrollHeight - prevH > 0 && prevTop < 50 ? msgsHost.scrollHeight - prevH : 0);
    lastRendered[c.id] = list.length;
  }
  function drawComposer(c) {
    if (!composerHost) return;
    U.clear(composerHost);
    var ta = U.el('textarea.ct-input', { attrs: { rows: '1', maxlength: '4000', placeholder: c.type === 'team' ? 'Mensaje al equipo' : 'Mensaje', 'aria-label': 'Escribe un mensaje', enterkeyhint: 'send' } });
    ta.value = editing ? editing.text : (draftFor[c.id] || '');
    var grow = function () { ta.style.height = 'auto'; ta.style.height = Math.min(160, ta.scrollHeight) + 'px'; };
    var submit = function () {
      var v = ta.value.trim(); if (!v) return;
      if (editing) { C().edit(c.id, editing.id, v); editing = null; }
      else { C().send(c.id, { text: v, reply: replyTo }).catch(function () {}); replyTo = null; }
      ta.value = ''; draftFor[c.id] = ''; grow(); drawComposer(c);
      var f = composerHost.querySelector('.ct-input'); if (f && desk()) f.focus();
    };
    ta.addEventListener('input', function () { draftFor[c.id] = editing ? draftFor[c.id] : ta.value; grow(); });
    ta.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey && (desk() || e.ctrlKey)) { e.preventDefault(); submit(); }
      else if (e.key === 'Escape' && (replyTo || editing)) { e.preventDefault(); replyTo = null; editing = null; drawComposer(c); }
      e.stopPropagation();
    });
    var bar = null;
    if (replyTo || editing) {
      var x = replyTo || editing;
      bar = U.el('div.ct-replybar', [U.icon(replyTo ? 'reply' : 'edit', 'sm'), U.el('span', [U.el('b', { text: replyTo ? 'Respondiendo a ' + (x.by === C().me() ? 'ti' : x.name || 'alguien') : 'Editando' }), U.el('small', { text: C().preview(x) })]),
        U.el('button.circle-btn', { attrs: { 'aria-label': 'Cancelar' }, on: { click: function () { replyTo = null; editing = null; drawComposer(c); } } }, [U.icon('close')])]);
    }
    composerHost.appendChild(U.el('div.ct-compose', [bar,
      U.el('div.ct-compose-row', [
        U.el('button.ct-plus', { attrs: { type: 'button', 'aria-label': 'Compartir', title: 'Compartir una tarea, una página o un ánimo' }, on: { click: function (e) { attach(c, e.currentTarget); } } }, [U.icon('plus')]),
        ta,
        U.el('button.ct-send', { attrs: { type: 'button', 'aria-label': editing ? 'Guardar' : 'Enviar' }, on: { click: submit } }, [U.icon(editing ? 'check' : 'send')])
      ])]));
    grow();
    if (replyTo || editing) setTimeout(function () { ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); }, 30);
  }
  function attach(c, anchor) {
    W.Menu.open(anchor, [{ value: 'task', label: 'Compartir una tarea', icon: 'tasks' }, { value: 'page', label: 'Compartir una página', icon: 'page' }, { value: 'cheer', label: 'Enviar un ánimo', icon: 'send' }]).then(function (v) {
      if (v === 'task') {
        var tasks = W.State.tasks.filter(function (t) { return !t.done; }).sort(W.State.compareDeadline).slice(0, 40);
        if (!tasks.length) { W.Toast.show({ text: 'No tienes tareas pendientes', icon: 'info' }); return; }
        W.Sheet.choose({ title: 'Compartir una tarea', options: tasks.map(function (t) { return { value: t.id, label: t.text, icon: 'tasks', desc: t.date ? U.cap(U.fmtDay(t.date)) : 'Sin fecha' }; }) }).then(function (id) {
          var t = id && W.State.find(id); if (!t) return;
          C().send(c.id, { kind: 'task', text: '', ref: { text: t.text, date: t.date || null, time: t.time || null, highlight: t.highlight || 'none' } }).catch(function () {});
        });
      } else if (v === 'page') {
        var pages = W.Pages.recent(30);
        if (!pages.length) { W.Toast.show({ text: 'Tu Cuaderno está vacío', icon: 'info' }); return; }
        W.Sheet.choose({ title: 'Compartir una página', options: pages.map(function (p) { return { value: p.id, label: W.Pages.title(p), icon: p.icon || 'page', desc: p.team ? 'Página del equipo' : '' }; }) }).then(function (id) {
          var p = id && W.Pages.get(id); if (!p) return;
          var md = W.Pages.toMarkdown(id).slice(0, 20000);
          C().send(c.id, { kind: 'page', text: '', ref: { id: p.id, title: W.Pages.title(p), icon: p.icon || 'page', team: p.team || null, md: p.team === (c.sid || '__') ? '' : md } }).catch(function () {});
        });
      } else if (v === 'cheer') {
        W.Menu.open(anchor, W.People.CHEERS.map(function (t) { return { value: t, label: t, icon: 'send' }; })).then(function (t) { if (t) C().send(c.id, { kind: 'cheer', text: t }).catch(function () {}); });
      }
    });
  }
  var headEl = null;
  function buildHead(c) {
    return U.el('div.ct-head', [
      desk() ? null : U.el('button.nav-btn.back', { on: { click: function () { openChat(null); } } }, [U.icon('back'), U.el('span', { text: 'Chats' })]),
      avatarFor(c, 38),
      U.el('div.ct-head-t', [U.el('strong', { text: C().title(c) }), U.el('small', { text: statusText(c) })]),
      c.type === 'team' ? U.el('button.nav-icon', { attrs: { 'aria-label': 'Ver el equipo', title: 'Ver el equipo' }, on: { click: function () { W.State.ui.peopleTab = 'teams'; W.State.ui.team = c.sid; W.Router.go('friends'); } } }, [U.icon('team')]) : null,
      U.el('button.nav-icon', { attrs: { 'aria-label': 'Opciones del chat', title: 'Opciones' }, on: { click: function (e) { chatMenu(c, e.currentTarget); } } }, [U.icon('dots')])
    ]);
  }
  /** Al llegar los perfiles de los contactos: sus personajes en la lista, la cabecera y el chat del equipo */
  function onProfiles() {
    if (S().activeScreen !== 'chats') return;
    if (listEl && listEl.isConnected) drawList();
    var c = openId() ? C().get(openId()) : null;
    if (!c) return;
    if (headEl && headEl.isConnected) { var h = buildHead(c); headEl.parentNode.replaceChild(h, headEl); headEl = h; }
    if (c.type === 'team' && msgsHost && msgsHost.isConnected) drawMessages(c);
  }
  function drawConv() {
    if (!convEl) return;
    U.clear(convEl);
    var cid = openId(), c = cid ? C().get(cid) : null;
    // En el móvil, la conversación ocupa toda la pantalla (sin la barra de abajo)
    document.body.classList.toggle('chat-open', !desk() && !!c);
    C().setOpen(c ? cid : null);
    if (!c) {
      if (desk()) convEl.appendChild(U.el('div.ct-none', [W.Character.illustration('friends', 'happy', 120), U.el('strong', { text: 'Elige un chat' }), U.el('p', { text: 'O empieza uno nuevo con tus contactos o con tu equipo.' })]));
      return;
    }
    headEl = buildHead(c);
    msgsHost = U.el('div.ct-msgs', { attrs: { role: 'log', 'aria-live': 'polite' } });
    composerHost = U.el('div.ct-compose-host');
    convEl.appendChild(headEl); convEl.appendChild(msgsHost); convEl.appendChild(composerHost);
    drawMessages(c, true); drawComposer(c);
    if (desk()) { var ta = composerHost.querySelector('.ct-input'); if (ta) setTimeout(function () { ta.focus(); }, 30); }
  }

  /* ---------- Pantalla ---------- */
  W.Screens.chats = {
    title: 'Chats',
    back: function () { if (!desk() && openId()) { openChat(null); return true; } return false; },
    reset: function () { if (!desk() && openId()) { openChat(null); return true; } return false; },
    render: function (root, full) {
      if (!unsub) unsub = C().subscribe(function (r, cid) {
        if (S().activeScreen !== 'chats') return;
        if (r === 'list' || r === 'error') drawList();
        if (r === 'msgs' && cid && cid === openId()) { var c = C().get(cid); if (c && msgsHost && msgsHost.isConnected) drawMessages(c); }
      });
      if (!unsubPeople) unsubPeople = W.People.subscribe(function (r) { if (r === 'profiles') onProfiles(); });
      var b = W.People.blocker();
      if (b && !b.soft) {
        listEl = convEl = null;
        var head = W.UI.header({ title: 'Chats', profile: true });
        W.UI.mount(root, head, [U.el('div.group', [W.UI.empty('buddy:friends', b.title, b.text, b.id === 'guest' && W.Auth.configured() ? U.el('button.btn.sm.primary', { on: { click: function () { W.AuthScreen.open({ mode: 'login' }); } } }, [U.icon('user', 'sm'), 'Iniciar sesión']) : null)])]);
        return;
      }
      if (desk()) {
        var shell = root.querySelector('.ct-shell');
        if (!shell || full) {
          U.clear(root);
          listEl = U.el('aside.ct-list');
          convEl = U.el('section.ct-conv');
          root.appendChild(U.el('div.ct-shell', [listEl, convEl]));
          drawList(); drawConv();
          C().refreshList();
        } else {
          drawList();
          var c0 = openId() && C().get(openId());
          if (c0 && convEl && convEl.querySelector('.ct-msgs') && lastRendered[c0.id] !== C().messages(c0.id).length) drawMessages(c0);
          else if (!convEl.querySelector('.ct-head') !== !c0) drawConv();
        }
        return;
      }
      // Móvil
      if (!openId()) {
        convEl = null;
        document.body.classList.remove('chat-open');
        var h = W.UI.header({ title: 'Chats', profile: true, sub: C().unreadCount() ? U.plural(C().unreadCount(), 'chat sin leer', 'chats sin leer') : '', actions: [{ icon: 'edit', label: 'Nuevo chat', onTap: function (e, btn) { newChat(btn); } }] });
        listEl = U.el('div.group.ct-list.mobile');
        W.UI.mount(root, h, [listEl]);
        drawList();
        if (full) C().refreshList();
        return;
      }
      if (full || !root.querySelector('.ct-conv')) {
        U.clear(root);
        listEl = null;
        convEl = U.el('section.ct-conv.mobile');
        root.appendChild(convEl);
        drawConv();
      } else {
        var c1 = C().get(openId());
        if (c1 && lastRendered[c1.id] !== C().messages(c1.id).length) drawMessages(c1);
      }
    }
  };
})(window.Whider);
