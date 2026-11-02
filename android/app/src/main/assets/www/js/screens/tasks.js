/**
 * WHIDER · Tareas: tres pestañas (Hoy · Próximas · Todas), búsqueda bajo demanda
 * y todas las opciones agrupadas en un único menú.
 */
window.Whider = window.Whider || {};
window.Whider.Screens = window.Whider.Screens || {};

(function (W) {
  'use strict';
  var U = W.U, S = function () { return W.State; };
  var SORTS = [
    { value: 'smart', label: 'Por fecha', desc: 'Lo más urgente primero' },
    { value: 'priority', label: 'Por prioridad', desc: 'Urgentes e importantes primero' },
    { value: 'created', label: 'Más recientes', desc: 'Las últimas que creaste' },
    { value: 'alpha', label: 'Alfabético', desc: 'De la A a la Z' }
  ];
  var collapsed = { done: true, doneToday: true };

  /* ---------- Consejos que se muestran una sola vez ---------- */
  W.Tips = {
    show: function (k) { var t = S().meta.tips || {}; return !t[k]; },
    mark: function (k) { var t = Object.assign({}, S().meta.tips || {}); if (t[k]) return; t[k] = true; S().setMeta('tips', t); }
  };

  /* ---------- Listas ---------- */
  function editList(list, after) {
    var st = S(), color = list ? list.color : 'iris';
    var sw = W.UI.swatches(color, function (c) { color = c; }, true);
    W.Sheet.prompt({ title: list ? 'Editar lista' : 'Nueva lista', value: list ? list.name : '', placeholder: 'Nombre de la lista', maxLength: 24,
      ok: list ? 'Guardar' : 'Crear', extra: [U.el('span.field-label', { text: 'Color' }), sw] })
      .then(function (name) {
        if (name) { if (list) st.updateList(list.id, { name: name, color: color }); else st.addList(name, color); }
        if (after) setTimeout(after, 380);
      });
  }
  function manageLists() {
    var st = S();
    var rows = st.lists.map(function (l) {
      var count = st.tasks.filter(function (t) { return t.listId === l.id && !t.done; }).length;
      return U.el('div.row', [
        U.el('span.dot.big', { style: { '--c': st.ACCENTS[l.color].a } }),
        U.el('span.row-main', [U.el('span.row-label', { text: l.name }), U.el('span.row-desc', { text: U.plural(count, 'pendiente', 'pendientes') })]),
        U.el('button.icon-btn.plain', { attrs: { 'aria-label': 'Editar ' + l.name }, on: { click: function () { s.close(); setTimeout(function () { editList(l, manageLists); }, 300); } } }, [U.icon('edit', 'sm')]),
        st.lists.length > 1 ? U.el('button.icon-btn.plain', { attrs: { 'aria-label': 'Eliminar ' + l.name }, on: { click: function () {
          s.close();
          W.Sheet.confirm({ title: '¿Eliminar "' + l.name + '"?', text: 'Las tareas de esta lista no se borran: quedarán sin lista.', ok: 'Eliminar', danger: true })
            .then(function (ok) { if (ok) st.removeList(l.id); setTimeout(manageLists, 380); });
        } } }, [U.icon('trash', 'sm')]) : null
      ]);
    });
    var s = W.Sheet.open({ title: 'Listas', body: [U.el('div.group', rows)],
      foot: [U.el('button.btn.soft.block', { on: { click: function () { s.close(); setTimeout(function () { editList(null, manageLists); }, 300); } } }, [U.icon('plus', 'sm'), 'Nueva lista'])] });
  }
  W.Lists = { manage: manageLists, edit: editList };

  /* ---------- Filtrado y agrupación ---------- */
  function matches(t, q) {
    if (!q) return true;
    q = q.toLowerCase();
    if (t.text.toLowerCase().indexOf(q) >= 0 || (t.notes && t.notes.toLowerCase().indexOf(q) >= 0)) return true;
    return t.subtasks.some(function (s) { return s.text.toLowerCase().indexOf(q) >= 0; });
  }

  function sorter(st) {
    switch (st.settings.sort) {
      case 'priority': return st.comparePriority;
      case 'created': return function (a, b) { return b.createdAt - a.createdAt; };
      case 'alpha': return function (a, b) { return a.text.localeCompare(b.text, 'es', { sensitivity: 'base' }); };
      default: return st.compareDeadline;
    }
  }

  function buildGroups(st) {
    var td = U.today(), tm = U.addDays(td, 1), wk = U.addDays(td, 7), tab = st.ui.tab || 'today';
    var q = (st.ui.query || '').trim();
    var pool = st.tasks.filter(function (t) { return (!st.ui.listFilter || t.listId === st.ui.listFilter) && matches(t, q); });
    var cmp = sorter(st);
    if (q) {
      return [
        { id: 'res', title: 'Resultados', items: pool.filter(function (t) { return !t.done; }).sort(cmp) },
        { id: 'resDone', title: 'Completadas', items: pool.filter(function (t) { return t.done; }) }
      ];
    }
    var pend = pool.filter(function (t) { return !t.done; });
    var G = function (id, title, items, extra) { return Object.assign({ id: id, title: title, items: items.sort(cmp) }, extra || {}); };
    var overdue = pend.filter(function (t) { return st.isOverdue(t); });
    var notOver = pend.filter(function (t) { return !st.isOverdue(t); });
    if (tab === 'today') {
      return [
        G('overdue', 'Vencidas', overdue, { late: true }),
        G('today', 'Hoy', notOver.filter(function (t) { return t.date === td; })),
        G('doneToday', 'Completadas hoy', pool.filter(function (t) { return t.done && (t.doneOn === td || t.date === td); }), { done: true })
      ];
    }
    if (tab === 'upcoming') {
      return [
        G('tomorrow', 'Mañana', notOver.filter(function (t) { return t.date === tm; })),
        G('week', 'Próximos 7 días', notOver.filter(function (t) { return t.date > tm && t.date <= wk; })),
        G('later', 'Más adelante', notOver.filter(function (t) { return t.date > wk; }))
      ];
    }
    var groups = [
      G('overdue', 'Vencidas', overdue, { late: true }),
      G('today', 'Hoy', notOver.filter(function (t) { return t.date === td; })),
      G('tomorrow', 'Mañana', notOver.filter(function (t) { return t.date === tm; })),
      G('week', 'Próximos 7 días', notOver.filter(function (t) { return t.date > tm && t.date <= wk; })),
      G('later', 'Más adelante', notOver.filter(function (t) { return t.date > wk; })),
      G('nodate', 'Sin fecha', notOver.filter(function (t) { return !t.date; }))
    ];
    if (!st.settings.hideCompleted) {
      groups.push({ id: 'done', title: 'Completadas', done: true, items: pool.filter(function (t) { return t.done; }).sort(function (a, b) { return (b.doneAt || 0) - (a.doneAt || 0); }) });
    }
    return groups;
  }

  function renderGroups(host) {
    var st = S();
    U.clear(host);
    var groups = buildGroups(st).filter(function (g) { return g.items.length; });
    var pendingShown = groups.some(function (g) { return !g.done; });
    if (!pendingShown) {
      var tab = st.ui.tab || 'today', q = (st.ui.query || '').trim();
      host.appendChild(U.el('div.calm-empty', [
        U.el('span.calm-empty-ic', [U.icon(q ? 'search' : tab === 'today' ? 'sun' : 'check')]),
        U.el('strong', { text: q ? 'Sin resultados' : tab === 'today' ? 'Nada pendiente hoy' : tab === 'upcoming' ? 'Nada programado' : 'Todo al día' }),
        U.el('span', { text: q ? 'Ninguna tarea coincide con "' + q + '".' : 'Pulsa + para añadir una tarea.' })
      ]));
    }
    var ctx = (st.ui.tab || 'today') === 'today' ? 'today' : null;
    groups.forEach(function (g) {
      var isCollapsed = !!collapsed[g.id] && g.done;
      var head = U.el('button.group-head' + (g.late ? '.late' : '') + (isCollapsed ? '.collapsed' : ''), { attrs: { 'aria-expanded': isCollapsed ? 'false' : 'true' } }, [
        g.done ? U.icon('down', 'xs') : null, U.el('span', { text: g.title }), U.el('span.count', { text: g.items.length })
      ]);
      if (g.done) head.addEventListener('click', function () { collapsed[g.id] = !collapsed[g.id]; W.Audio.tap(); renderGroups(host); });
      host.appendChild(head);
      if (isCollapsed) return;
      var ul = U.el('ul.task-list');
      var frag = document.createDocumentFragment();
      g.items.slice(0, g.done ? 60 : 400).forEach(function (t) { frag.appendChild(W.TaskCard.create(t, { ctx: g.id === 'today' || g.id === 'doneToday' ? 'today' : ctx === 'today' ? null : null })); });
      ul.appendChild(frag);
      host.appendChild(ul);
    });
    if (pendingShown && W.Tips.show('swipe')) {
      host.appendChild(U.el('p.hint.tip', [U.icon('swipe', 'xs'), ' Desliza una tarea → para completarla o ← para borrarla']));
    }
  }

  function options() {
    var st = S();
    var listName = st.ui.listFilter && st.getList(st.ui.listFilter) ? st.getList(st.ui.listFilter).name : 'Todas';
    var s = W.Sheet.open({ title: 'Opciones', body: [U.el('div.group', [
      W.UI.row({ icon: 'sort', label: 'Ordenar', value: (SORTS.filter(function (o) { return o.value === st.settings.sort; })[0] || SORTS[0]).label, onTap: function () {
        s.close(); W.Sheet.choose({ title: 'Ordenar', value: st.settings.sort, options: SORTS }).then(function (v) { if (v) st.setSetting('sort', v); });
      } }),
      W.UI.row({ icon: 'layers', label: 'Mostrar lista', value: listName, onTap: function () {
        s.close();
        var opts = [{ value: '', label: 'Todas las listas', icon: 'layers' }].concat(st.lists.map(function (l) { return { value: l.id, label: l.name, color: st.ACCENTS[l.color].a }; }));
        W.Sheet.choose({ title: 'Mostrar lista', value: st.ui.listFilter || '', options: opts }).then(function (v) { if (v !== undefined) { st.ui.listFilter = v || null; W.Router.refresh(); } });
      } }),
      W.UI.row({ icon: 'edit', label: 'Gestionar listas', onTap: function () { s.close(); setTimeout(manageLists, 300); } }),
      W.UI.row({ icon: 'check', label: 'Mostrar completadas', right: W.UI.toggle(!st.settings.hideCompleted, function (v) { st.setSetting('hideCompleted', !v); W.Router.refresh(); }) }),
      W.UI.row({ icon: 'trash', label: 'Borrar completadas', onTap: function () {
        s.close();
        W.Sheet.confirm({ title: '¿Borrar las completadas?', text: 'Tus rachas y marcas se conservan.', ok: 'Borrar', danger: true })
          .then(function (ok) { if (ok) { var n = st.clearCompleted(); W.Toast.show({ text: U.plural(n, 'tarea borrada', 'tareas borradas'), icon: 'trash' }); } });
      } })
    ])] });
  }

  W.Screens.tasks = {
    title: 'Tareas',
    manageLists: manageLists,
    render: function (root) {
      var st = S();
      if (!st.ui.tab) st.ui.tab = 'today';
      var pending = st.pending().length;
      var inner = U.el('div.inner');
      var searchOpen = !!st.ui.showSearch || !!st.ui.query;
      inner.appendChild(U.el('div.page-head', [
        U.el('div', [U.el('h1', { text: 'Tareas' }), U.el('p', { text: pending ? U.plural(pending, 'pendiente', 'pendientes') : 'Todo al día' })]),
        U.el('div.head-actions', [
          U.el('button.icon-btn' + (searchOpen ? '.active' : ''), { attrs: { 'aria-label': 'Buscar' }, on: { click: function () {
            st.ui.showSearch = !searchOpen; if (searchOpen) st.ui.query = ''; W.Screens.tasks.render(root);
            if (!searchOpen) setTimeout(function () { var i = U.$('#screen-tasks input[type=search]'); if (i) i.focus(); }, 30);
          } } }, [U.icon(searchOpen ? 'close' : 'search', 'sm')]),
          U.el('button.icon-btn', { attrs: { 'aria-label': 'Opciones' }, on: { click: options } }, [U.icon('dots', 'sm')])
        ])
      ]));

      var listHost = U.el('div.task-groups');
      if (searchOpen) {
        var input = U.el('input.input', { attrs: { type: 'search', placeholder: 'Buscar en tareas, notas y subtareas', 'aria-label': 'Buscar', enterkeyhint: 'search' } });
        input.value = st.ui.query || '';
        input.addEventListener('input', U.debounce(function () { st.ui.query = input.value; renderGroups(listHost); }, 120));
        inner.appendChild(U.el('div.search', [U.icon('search', 'sm'), input]));
      } else {
        inner.appendChild(W.UI.segmented([{ value: 'today', label: 'Hoy' }, { value: 'upcoming', label: 'Próximas' }, { value: 'all', label: 'Todas' }],
          st.ui.tab, function (v) { st.ui.tab = v; renderGroups(listHost); }));
      }
      if (st.ui.listFilter && st.getList(st.ui.listFilter)) {
        var l = st.getList(st.ui.listFilter);
        inner.appendChild(U.el('div.filter-pill', [U.el('span.dot', { style: { '--c': st.ACCENTS[l.color].a } }), 'Lista: ' + l.name,
          U.el('button', { attrs: { 'aria-label': 'Quitar filtro' }, on: { click: function () { st.ui.listFilter = null; W.Screens.tasks.render(root); } } }, [U.icon('close', 'xs')])]));
      }
      inner.appendChild(listHost);
      renderGroups(listHost);
      var focused = document.activeElement && root.contains(document.activeElement) && document.activeElement.type === 'search';
      U.clear(root).appendChild(inner);
      if (focused) { var i2 = U.$('input[type=search]', root); if (i2) { i2.focus(); var v = i2.value; i2.value = ''; i2.value = v; } }
    }
  };
})(window.Whider);
