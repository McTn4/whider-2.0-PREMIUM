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
    var focus = W.Screens.focus.status();
    var K = W.Layout.keys;
    return [
      { icon: 'plus', label: 'Nueva tarea', hint: 'N', run: function () { W.App.newTask(); } },
      { icon: 'sun', label: 'Ir a Hoy', hint: '1', run: function () { W.Router.go('home'); } },
      { icon: 'tasks', label: 'Ir a Tareas', hint: '2', run: function () { W.Router.go('tasks'); } },
      { icon: 'calendar', label: 'Ir al Calendario', hint: '3', run: function () { W.Router.go('calendar'); } },
      { icon: 'target', label: 'Ir a Hábitos', hint: '4', run: function () { W.Router.go('habits'); } },
      { icon: 'notebook', label: 'Ir a Apuntes', hint: '5', run: function () { W.Router.go('notes'); } },
      { icon: 'timer', label: 'Ir a Enfoque', hint: '6', run: function () { W.Router.go('focus'); } },
      { icon: 'chart', label: 'Estadísticas', hint: '7', run: function () { W.Router.go('stats'); } },
      { icon: 'print', label: 'Informes', hint: '8', run: function () { W.Router.go('reports'); } },
      { icon: 'system', label: 'Sistemas y automatizaciones', hint: '9', run: function () { W.Router.go('automations'); } },
      { icon: 'users', label: 'Amigos', run: function () { W.Router.go('friends'); } },
      { icon: 'plus', label: 'Nuevo apunte', run: function () { W.Notes.open(null); } },
      { icon: 'plus', label: 'Nuevo hábito', run: function () { W.HabitView.edit(null); } },
      { icon: 'smile', label: 'Personalizar tu personaje', run: function () { W.Character.edit(); } },
      { icon: 'gem', label: 'Planes y precios', run: function () { W.Plan.open(); } },
      { icon: focus.running ? 'pause' : 'play', label: focus.running ? 'Pausar el enfoque' : 'Empezar una sesión de enfoque', run: function () { W.Screens.focus.toggle(); } },
      { icon: 'user', label: 'Perfil y resumen', hint: 'P', run: function () { W.Router.go('progress'); } },
      { icon: 'trophy', label: 'Marcas personales', run: function () { W.Router.go('records'); } },
      { icon: 'list', label: 'Nueva categoría', run: function () { W.Lists.edit(null, function (l) { W.Sidebar && openList(l.id); }); } },
      { icon: 'filter', label: 'Nuevo filtro', run: function () { W.Filters.edit(null, function (f) { W.Sidebar.openView({ type: 'filter', id: f.id }); }); } },
      { icon: 'layers', label: 'Importar o exportar tareas', run: function () { W.Settings.open('data'); } },
      { icon: 'sliders', label: 'Personalización', run: function () { W.Settings.open('custom'); } },
      { icon: 'gear', label: 'Ajustes', hint: K(','), run: function () { W.Settings.open(); } },
      { icon: 'type', label: 'Atajos de teclado', hint: '?', run: function () { W.Keys.help(); } }
    ];
  }

  function openList(id) {
    var st = S();
    if (st.activeScreen !== 'tasks') { st.ui.taskView = { type: 'list', id: id }; W.Router.go('tasks'); }
    else W.Screens.tasks.open({ type: 'list', id: id });
  }

  function taskSub(st, t) {
    if (t.done) return 'Completada';
    var parts = [];
    if (t.date) parts.push(U.fmtDay(t.date) + (t.time ? ', ' + U.fmtTime(t.time) : ''));
    var l = t.listId ? st.getList(t.listId) : null;
    if (l) parts.push(l.name);
    return parts.join(' · ') || 'Sin fecha';
  }

  /** Grupos de resultados para un texto */
  function search(q) {
    var st = S(), words = fold(q).split(/\s+/).filter(Boolean), groups = [];
    if (!words.length) {
      groups.push({ title: 'Acciones', items: actions() });
      groups.push({ title: 'Categorías', items: st.lists.map(function (l) {
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
      return { icon: W.Lists.icon(l), label: l.name, sub: 'Categoría', run: function () { openList(l.id); } };
    }).concat(st.filters.filter(function (f) { return matches(f.name, words); }).map(function (f) {
      return { icon: 'filter', label: f.name, sub: 'Filtro', run: function () { W.Sidebar.openView({ type: 'filter', id: f.id }); } };
    }));
    var notes = st.notes.filter(function (n) { return matches(n.title + ' ' + n.body, words); }).slice(0, 6).map(function (n) {
      return { icon: 'notebook', label: W.Notes.title(n), sub: 'Apunte · ' + U.fmtDay(U.ymd(new Date(n.updatedAt))), run: function () { W.Notes.open(n.id); } };
    });
    var habits = st.habits.filter(function (h) { return matches(h.name, words); }).map(function (h) {
      var done = W.Habits.isDone(h, U.today());
      return { icon: h.icon || 'target', label: h.name, sub: (h.archived ? 'Archivado · ' : '') + W.Habits.freqLabel(h) + (done ? ' · hecho hoy' : ''), run: function () { W.HabitView.open(h.id); } };
    });
    var acts = actions().filter(function (a) { return matches(a.label, words); });
    var create = { icon: 'plus', label: 'Crear «' + q.trim() + '»', sub: 'Nueva tarea con este texto', run: function () { createTask(q); } };
    if (tasks.length) groups.push({ title: 'Tareas', items: tasks });
    if (lists.length) groups.push({ title: 'Categorías y filtros', items: lists });
    if (notes.length) groups.push({ title: 'Apuntes', items: notes });
    if (habits.length) groups.push({ title: 'Hábitos', items: habits });
    if (acts.length) groups.push({ title: 'Acciones', items: acts });
    // Sin coincidencias, crear la tarea es lo primero (Intro la crea)
    if (!tasks.length && !lists.length && !acts.length && !habits.length && !notes.length) groups.unshift({ title: 'Nueva tarea', items: [create] });
    else groups.push({ title: 'Nueva tarea', items: [create] });
    return groups;
  }

  function createTask(raw) {
    var st = S(), p = W.Parse.task(raw, { lists: st.lists });
    if (!p.text) return;
    var t = st.addTask({ text: p.text, date: p.date !== undefined ? p.date : U.today(), time: p.time || null, listId: p.listId || st.settings.defaultList,
      highlight: p.highlight || 'none', repeat: p.repeat || 'none', warn: st.settings.defaultWarn, notes: '', subtasks: [] });
    if (t) W.Toast.show({ text: 'Tarea creada: ' + t.text, type: 'success', icon: 'check' });
  }

  var Palette = {
    isOpen: function () { return !!current; },

    open: function (initial) {
      if (current) return current;
      var input = U.el('input.pal-input', { attrs: { type: 'text', placeholder: 'Busca tareas, categorías, apuntes o acciones…', 'aria-label': 'Buscar', autocomplete: 'off', spellcheck: 'false' } });
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
        if (!flat.length) results.appendChild(U.el('p.pal-empty', { text: 'Sin resultados.' }));
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
        U.el('span', [U.el('kbd', { text: 'Intro' }), 'abrir']),
        U.el('span', [U.el('kbd', { text: 'Esc' }), 'cerrar'])
      ]);
      var sheet = W.Sheet.open({
        title: 'Buscar', className: 'palette', trail: null,
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
