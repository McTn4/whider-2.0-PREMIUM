/**
 * WHIDER · Búsqueda y acciones (Ctrl/⌘ K o /).
 * Escribe para encontrar tareas y listas, o para ir a cualquier parte. Si no hay ninguna
 * tarea con ese texto, Intro la crea (entiende fecha, hora, #lista y prioridad).
 */
window.Whider = window.Whider || {};

(function (W) {
  'use strict';
  var U = W.U, S = function () { return W.State; };
  var current = null;

  function fold(s) { return W.Parse && W.Parse.fold ? W.Parse.fold(s) : String(s || '').toLowerCase(); }
  function matches(text, words) { var t = fold(text); return words.every(function (w) { return t.indexOf(w) >= 0; }); }

  function actions() {
    var K = W.Layout.keys;
    return [
      { icon: 'plus', label: W.t('Nueva tarea'), hint: 'N', run: function () { W.App.newTask(); } },
      { icon: 'home', label: W.t('Ir a Inicio'), hint: '1', run: function () { W.Router.go('home'); } },
      { icon: 'tasks', label: W.t('Ir a Tareas'), hint: '2', run: function () { W.Router.go('tasks'); } },
      { icon: 'calendar', label: W.t('Ir al Calendario'), hint: '3', run: function () { W.Router.go('calendar'); } },
      { icon: 'notebook', label: W.t('Ir al Cuaderno'), hint: '4', run: function () { W.Router.go('notes'); } },
      { icon: 'users', label: W.t('Ir a Personas'), hint: '5', run: function () { W.Router.go('friends'); } },
      { icon: 'chat', label: W.t('Ir a Chats'), run: function () { W.Router.go('chats'); } },
      { icon: 'plus', label: W.t('Nueva página del Cuaderno'), hint: W.t('Alt N'), run: function () { W.Notes.open(null); } },
      { icon: 'database', label: W.t('Nueva base de datos'), run: function () { W.Notes.newPage({ kind: 'db' }); } },
      { icon: 'qr', label: W.t('Mi código QR para invitar'), run: function () { W.Invite.qrSheet({}); } },
      { icon: 'scan', label: W.t('Escanear una invitación'), run: function () { W.Invite.scan(); } },
      { icon: 'team', label: W.t('Nuevo equipo'), run: function () { W.State.ui.peopleTab = 'teams'; W.Router.go('friends'); } },
      { icon: 'user', label: W.t('Editar perfil'), run: function () { W.Profile.edit(); } },
      { icon: 'list', label: W.t('Nueva categoría'), run: function () { W.Lists.edit(null, function (l) { W.Sidebar && openList(l.id); }); } },
      { icon: 'filter', label: W.t('Nuevo filtro'), run: function () { W.Filters.edit(null, function (f) { W.Sidebar.openView({ type: 'filter', id: f.id }); }); } },
      { icon: 'upload', label: W.t('Importar desde Todoist, Google Tasks, Notion o un calendario'), run: function () { W.ImportWizard.open(); } },
      { icon: 'layers', label: W.t('Copias, importar y exportar'), run: function () { W.Settings.open('data'); } },
      { icon: 'star', label: W.t('Novedades de WHIDER'), run: function () { W.WhatsNew.open(); } },
      { icon: 'sliders', label: W.t('Personalización'), run: function () { W.Settings.open('custom'); } },
      { icon: 'gear', label: W.t('Ajustes'), hint: K(','), run: function () { W.Settings.open(); } },
      { icon: 'type', label: W.t('Atajos de teclado'), hint: '?', run: function () { W.Keys.help(); } }
    ];
  }

  function openList(id) {
    var st = S();
    if (st.activeScreen !== 'tasks') { st.ui.taskView = { type: 'list', id: id }; W.Router.go('tasks'); }
    else W.Screens.tasks.open({ type: 'list', id: id });
  }

  function taskSub(st, t) {
    if (t.done) return W.t('Completada');
    var parts = [];
    if (t.date) parts.push(U.fmtDay(t.date) + (t.time ? ', ' + U.fmtTime(t.time) : ''));
    var l = t.listId ? st.getList(t.listId) : null;
    if (l) parts.push(l.name);
    return parts.join(' · ') || W.t('Sin fecha');
  }

  /** Grupos de resultados para un texto */
  function search(q) {
    var st = S(), words = fold(q).split(/\s+/).filter(Boolean), groups = [];
    if (!words.length) {
      groups.push({ title: W.t('Acciones'), items: actions() });
      groups.push({ title: W.t('Categorías'), items: st.lists.map(function (l) {
        return { icon: W.Lists.icon(l), label: l.name, sub: U.plural(st.tasks.filter(function (t) { return t.listId === l.id && !t.done; }).length, 'pendiente', 'pendientes'), run: function () { openList(l.id); } };
      }) });
      return groups;
    }
    var found = st.tasks.filter(function (t) {
      return matches(t.text + ' ' + (t.notes || '') + ' ' + t.subtasks.map(function (s) { return s.text; }).join(' '), words);
    });
    var pend = found.filter(function (t) { return !t.done; }).sort(st.compareDeadline);
    var done = found.filter(function (t) { return t.done; }).sort(function (a, b) { return (b.doneAt || 0) - (a.doneAt || 0); });
    var tasks = pend.concat(done).slice(0, 8).map(function (t) {
      return { icon: t.done ? 'check' : 'note', label: t.text, sub: taskSub(st, t), done: t.done, run: function () { W.Editor.open(t.id); } };
    });
    var lists = st.lists.filter(function (l) { return matches(l.name, words); }).map(function (l) {
      return { icon: W.Lists.icon(l), label: l.name, sub: W.t('Categoría'), run: function () { openList(l.id); } };
    }).concat(st.filters.filter(function (f) { return matches(f.name, words); }).map(function (f) {
      return { icon: 'filter', label: f.name, sub: W.t('Filtro'), run: function () { W.Sidebar.openView({ type: 'filter', id: f.id }); } };
    }));
    var notes = W.Pages ? W.Pages.search(q, 8).map(function (r) {
      var p = r.page;
      return { icon: p.icon || (p.kind === 'db' ? 'database' : 'page'), label: W.Pages.title(p), sub: (r.hit ? r.hit.slice(0, 70) : W.t('Cuaderno · {0}', { 0: U.fmtDay(U.ymd(new Date(Math.max(p.at, p.cv)))) })), run: function () { W.Notes.openPage(p.id); } };
    }) : [];
    var people = W.People ? W.People.contacts().filter(function (f) { return matches(((W.People.profile(f.uid) || {}).name || f.name || ''), words); }).slice(0, 5).map(function (f) {
      return { icon: f.kind === 'work' ? 'briefcase' : 'user', label: (W.People.profile(f.uid) || {}).name || f.name || W.t('Contacto'), sub: W.t('Abrir el chat'), run: function () { W.Chat.openChat({ uid: f.uid }); } };
    }) : [];
    var acts = actions().filter(function (a) { return matches(a.label, words); });
    var create = { icon: 'plus', label: W.t('Crear «{0}»', { 0: q.trim() }), sub: W.t('Nueva tarea con este texto'), run: function () { createTask(q); } };
    if (tasks.length) groups.push({ title: W.t('Tareas'), items: tasks });
    if (lists.length) groups.push({ title: W.t('Categorías y filtros'), items: lists });
    if (notes.length) groups.push({ title: W.t('Cuaderno'), items: notes });
    if (people.length) groups.push({ title: W.t('Personas'), items: people });
    if (acts.length) groups.push({ title: W.t('Acciones'), items: acts });
    // Sin coincidencias, crear la tarea es lo primero (Intro la crea)
    if (!tasks.length && !lists.length && !acts.length && !notes.length && !people.length) groups.unshift({ title: W.t('Nueva tarea'), items: [create] });
    else groups.push({ title: W.t('Nueva tarea'), items: [create] });
    return groups;
  }

  function createTask(raw) {
    var st = S(), p = W.Parse.task(raw, { lists: st.lists });
    if (!p.text) return;
    var t = st.addTask({ text: p.text, date: p.date !== undefined ? p.date : U.today(), time: p.time || null, listId: p.listId || st.defaultListId(),
      highlight: p.highlight || 'none', repeat: p.repeat || 'none', days: p.days, warn: st.settings.defaultWarn, notes: '', subtasks: [] });
    if (t) W.Toast.show({ text: W.t('Tarea creada: {text}', { text: t.text }), type: 'success', icon: 'check' });
  }

  var Palette = {
    isOpen: function () { return !!current; },

    open: function (initial) {
      if (current) return current;
      var input = U.el('input.pal-input', { attrs: { type: 'text', placeholder: W.t('Busca tareas, páginas, personas o acciones…'), 'aria-label': W.t('Buscar'), autocomplete: 'off', spellcheck: 'false' } });
      input.value = initial || '';
      var results = U.el('div.pal-results', { attrs: { role: 'listbox' } });
      var flat = [], active = 0;

      var setActive = function (i, scroll) {
        if (!flat.length) return;
        active = (i + flat.length) % flat.length;
        flat.forEach(function (f, k) { f.node.classList.toggle('active', k === active); f.node.setAttribute('aria-selected', k === active ? 'true' : 'false'); });
        if (scroll) flat[active].node.scrollIntoView({ block: 'nearest' });
      };
      var run = function (item) {
        sheet.close();
        setTimeout(function () { item.run(); }, 60);
      };
      var draw = function () {
        U.clear(results); flat = []; active = 0;
        var groups = search(input.value);
        groups.forEach(function (g) {
          if (!g.items.length) return;
          results.appendChild(U.el('div.pal-group', { text: g.title }));
          g.items.forEach(function (it) {
            var node = U.el('button.pal-item' + (it.done ? '.done' : ''), { attrs: { role: 'option', type: 'button' } }, [
              U.icon(it.icon),
              U.el('span.pal-main', [U.el('span', { text: it.label }), it.sub ? U.el('small', { text: it.sub }) : null]),
              it.hint ? U.el('kbd', { text: it.hint }) : null
            ]);
            var idx = flat.length;
            node.addEventListener('mousemove', function () { if (active !== idx) setActive(idx); });
            node.addEventListener('click', function () { run(it); });
            flat.push({ node: node, item: it });
            results.appendChild(node);
          });
        });
        if (!flat.length) results.appendChild(U.el('p.pal-empty', { text: W.t('Sin resultados.') }));
        setActive(0);
      };

      input.addEventListener('input', U.debounce(draw, 60));
      input.addEventListener('keydown', function (e) {
        if (e.key === 'ArrowDown') { e.preventDefault(); setActive(active + 1, true); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(active - 1, true); }
        else if (e.key === 'Enter') { e.preventDefault(); if (flat[active]) run(flat[active].item); }
      });

      var foot = U.el('div.pal-foot', [
        U.el('span', [U.el('kbd', { text: '↑' }), U.el('kbd', { text: '↓' }), 'moverse']),
        U.el('span', [U.el('kbd', { text: W.t('Intro') }), 'abrir']),
        U.el('span', [U.el('kbd', { text: W.t('Esc') }), 'cerrar'])
      ]);
      var sheet = W.Sheet.open({
        title: W.t('Buscar'), className: 'palette', trail: null,
        body: [U.el('div.pal-box', [U.icon('search'), input]), results, foot],
        onClose: function () { current = null; }
      });
      current = sheet;
      draw();
      setTimeout(function () { input.focus(); input.select(); }, 30);
      return sheet;
    }
  };

  W.Palette = Palette;
})(window.Whider);
