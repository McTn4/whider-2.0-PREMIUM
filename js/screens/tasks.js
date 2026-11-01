/**
 * WHIDER · Pantalla de Tareas: búsqueda, filtros, listas, orden y grupos plegables
 */
window.Whider = window.Whider || {};
window.Whider.Screens = window.Whider.Screens || {};

(function (W) {
  'use strict';
  var U = W.U, S = function () { return W.State; };

  var FILTERS = [
    { id: 'all', label: 'Todas', icon: 'layers' },
    { id: 'today', label: 'Hoy', icon: 'sun' },
    { id: 'upcoming', label: 'Próximas', icon: 'calendar' },
    { id: 'overdue', label: 'Vencidas', icon: 'alert' },
    { id: 'nodate', label: 'Sin fecha', icon: 'inbox' },
    { id: 'done', label: 'Hechas', icon: 'check' }
  ];
  var SORTS = [
    { value: 'smart', label: 'Inteligente', desc: 'Agrupadas por plazo y prioridad' },
    { value: 'priority', label: 'Prioridad', desc: 'Urgentes e importantes primero' },
    { value: 'created', label: 'Más recientes', desc: 'Las últimas que creaste' },
    { value: 'alpha', label: 'Alfabético', desc: 'De la A a la Z' }
  ];
  var collapsed = { done: true };
  var searchFocused = false;

  function matches(t, q) {
    if (!q) return true;
    q = q.toLowerCase();
    if (t.text.toLowerCase().indexOf(q) >= 0 || (t.notes && t.notes.toLowerCase().indexOf(q) >= 0)) return true;
    return t.subtasks.some(function (s) { return s.text.toLowerCase().indexOf(q) >= 0; });
  }

  function applyFilter(st, list) {
    var td = U.today(), f = st.ui.filter;
    return list.filter(function (t) {
      if (st.ui.listFilter && t.listId !== st.ui.listFilter) return false;
      if (!matches(t, st.ui.query.trim())) return false;
      switch (f) {
        case 'today': return t.date === td || (!t.done && st.isOverdue(t));
        case 'upcoming': return !t.done && t.date && t.date > td;
        case 'overdue': return st.isOverdue(t);
        case 'nodate': return !t.done && !t.date;
        case 'done': return t.done;
        default: return true;
      }
    });
  }

  function groupsSmart(st, items) {
    var td = U.today(), tm = U.addDays(td, 1), wk = U.addDays(td, 7);
    var g = [
      { id: 'overdue', title: 'Vencidas', late: true, items: [] },
      { id: 'today', title: 'Hoy', items: [] },
      { id: 'tomorrow', title: 'Mañana', items: [] },
      { id: 'week', title: 'Próximos 7 días', items: [] },
      { id: 'later', title: 'Más adelante', items: [] },
      { id: 'nodate', title: 'Sin fecha', items: [] },
      { id: 'done', title: 'Completadas', items: [] }
    ];
    var by = {}; g.forEach(function (x) { by[x.id] = x; });
    items.forEach(function (t) {
      if (t.done) by.done.items.push(t);
      else if (st.isOverdue(t)) by.overdue.items.push(t);
      else if (!t.date) by.nodate.items.push(t);
      else if (t.date === td) by.today.items.push(t);
      else if (t.date === tm) by.tomorrow.items.push(t);
      else if (t.date <= wk) by.week.items.push(t);
      else by.later.items.push(t);
    });
    g.forEach(function (x) {
      if (x.id === 'done') x.items.sort(function (a, b) { return (b.doneAt || 0) - (a.doneAt || 0); });
      else if (x.id === 'nodate') x.items.sort(st.comparePriority);
      else x.items.sort(st.compareDeadline);
    });
    return g;
  }

  function groupsSorted(st, items, sort) {
    var cmp = sort === 'priority' ? st.comparePriority
      : sort === 'created' ? function (a, b) { return b.createdAt - a.createdAt; }
      : function (a, b) { return a.text.localeCompare(b.text, 'es', { sensitivity: 'base' }); };
    var pend = items.filter(function (t) { return !t.done; }).sort(cmp);
    var done = items.filter(function (t) { return t.done; }).sort(function (a, b) { return (b.doneAt || 0) - (a.doneAt || 0); });
    return [{ id: 'pending', title: 'Pendientes', items: pend }, { id: 'done', title: 'Completadas', items: done }];
  }

  function renderGroup(g, root, st) {
    if (!g.items.length) return;
    var isCollapsed = !!collapsed[g.id] && st.ui.filter !== 'done';
    var head = U.el('button.group-head' + (g.late ? '.late' : '') + (isCollapsed ? '.collapsed' : ''), { attrs: { 'aria-expanded': isCollapsed ? 'false' : 'true' } }, [
      U.icon('down'), g.title, U.el('span.count', { text: g.items.length }), U.el('span.line')
    ]);
    head.addEventListener('click', function () { collapsed[g.id] = !collapsed[g.id]; W.Audio.tap(); W.Screens.tasks.renderList(root); });
    root.appendChild(head);
    if (isCollapsed) return;
    var ul = U.el('ul.task-list');
    g.items.slice(0, g.id === 'done' ? 50 : 500).forEach(function (t) { ul.appendChild(W.TaskCard.create(t)); });
    root.appendChild(ul);
  }

  W.Screens.tasks = {
    title: 'Tareas',
    render: function (root, fresh) {
      var st = S();
      var pending = st.pending().length;
      var inner = U.el('div.inner' + (fresh ? '.stagger' : ''));

      inner.appendChild(W.UI.pageHead('Tu lista', 'Tareas', pending ? U.plural(pending, 'pendiente', 'pendientes') : 'Todo al día',
        U.el('button.icon-btn', { attrs: { 'aria-label': 'Ordenar' }, on: { click: function () {
          W.Sheet.choose({ title: 'Ordenar tareas', value: st.settings.sort, options: SORTS }).then(function (v) { if (v) st.setSetting('sort', v); });
        } } }, [U.icon('sort')])));

      /* Búsqueda */
      var search = U.el('div.search' + (st.ui.query ? '.has-value' : ''));
      var input = U.el('input.input', { attrs: { type: 'search', placeholder: 'Buscar tareas, notas o subtareas', 'aria-label': 'Buscar', enterkeyhint: 'search' } });
      input.value = st.ui.query;
      var refreshList = U.debounce(function () { W.Screens.tasks.renderList(listHost); }, 120);
      input.addEventListener('input', function () { st.ui.query = input.value; search.classList.toggle('has-value', !!input.value); refreshList(); });
      input.addEventListener('focus', function () { searchFocused = true; });
      input.addEventListener('blur', function () { searchFocused = false; });
      search.appendChild(U.icon('search'));
      search.appendChild(input);
      search.appendChild(U.el('button.clear-btn', { attrs: { 'aria-label': 'Borrar búsqueda' }, on: { click: function () {
        st.ui.query = ''; input.value = ''; search.classList.remove('has-value'); W.Screens.tasks.renderList(listHost); input.focus();
      } } }, [U.icon('close', 'sm')]));
      inner.appendChild(search);

      /* Filtros */
      var counts = {};
      var savedF = st.ui.filter, savedQ = st.ui.query;
      st.ui.query = '';
      FILTERS.forEach(function (f) {
        st.ui.filter = f.id;
        counts[f.id] = applyFilter(st, st.tasks).filter(function (t) { return f.id === 'done' ? true : !t.done; }).length;
      });
      st.ui.filter = savedF; st.ui.query = savedQ;
      inner.appendChild(U.el('div.chips', FILTERS.map(function (f) {
        return U.el('button.chip' + (st.ui.filter === f.id ? '.active' : ''), { on: { click: function () {
          st.ui.filter = f.id; W.Audio.tap(); W.Screens.tasks.render(root);
        } } }, [U.icon(f.icon, 'xs'), f.label, counts[f.id] ? U.el('span.count', { text: counts[f.id] }) : null]);
      })));

      /* Listas */
      var lists = [U.el('button.chip' + (!st.ui.listFilter ? '.active' : ''), { text: 'Todas las listas', on: { click: function () { st.ui.listFilter = null; W.Screens.tasks.render(root); } } })];
      st.lists.forEach(function (l) {
        lists.push(U.el('button.chip' + (st.ui.listFilter === l.id ? '.active' : ''), { on: { click: function () {
          st.ui.listFilter = st.ui.listFilter === l.id ? null : l.id; W.Audio.tap(); W.Screens.tasks.render(root);
        } } }, [U.el('span.dot', { style: { '--c': st.ACCENTS[l.color].a } }), l.name]));
      });
      lists.push(U.el('button.chip.ghost-chip', { attrs: { 'aria-label': 'Gestionar listas' }, on: { click: function () { W.Screens.settings.manageLists(); } } }, [U.icon('plus', 'xs'), 'Lista']));
      inner.appendChild(U.el('div.chips.lists-row', lists));

      var listHost = U.el('div.task-groups');
      inner.appendChild(listHost);
      W.Screens.tasks.renderList(listHost);

      inner.appendChild(U.el('p.hint', [U.icon('swipe', 'xs'), ' Desliza → para completar · ← para eliminar']));

      U.clear(root).appendChild(inner);
      if (searchFocused) { input.focus(); var v = input.value; input.value = ''; input.value = v; }
    },

    renderList: function (host) {
      var st = S();
      U.clear(host);
      var items = applyFilter(st, st.tasks);
      if (st.settings.hideCompleted && st.ui.filter !== 'done') items = items.filter(function (t) { return !t.done; });
      if (!items.length) {
        var q = st.ui.query.trim();
        host.appendChild(q ? W.UI.empty('search', 'Sin resultados', 'No hay tareas que coincidan con "' + q + '".')
          : st.ui.filter === 'done' ? W.UI.empty('check', 'Aún nada completado', 'Las tareas que termines aparecerán aquí.')
          : st.ui.filter === 'overdue' ? W.UI.empty('shield', 'Nada vencido', 'Vas al día. ¡Sigue así!')
          : W.UI.empty('tasks', 'Tu lista está vacía', 'Crea tu primera tarea y empieza a avanzar.',
            U.el('button.btn.primary', { on: { click: function () { W.Editor.open(null); } } }, [U.icon('plus', 'sm'), 'Nueva tarea'])));
        return;
      }
      var groups = st.settings.sort === 'smart' ? groupsSmart(st, items) : groupsSorted(st, items, st.settings.sort);
      groups.forEach(function (g) { renderGroup(g, host, st); });
    }
  };
})(window.Whider);
