/**
 * WHIDER · Tareas, organizadas por categorías:
 *  - Vistas automáticas: Hoy · Programadas · Todas · Prioritarias
 *  - Mis categorías (Personal, Trabajo…), cada una con su icono
 *  - Filtros guardados (varias categorías, prioridades, fechas o un texto)
 * Cada una abre su propia página; la búsqueda filtra todas las tareas.
 */
window.Whider = window.Whider || {};
window.Whider.Screens = window.Whider.Screens || {};

(function (W) {
  'use strict';
  var U = W.U, S = function () { return W.State; };
  var SMART = {
    today: { title: 'Hoy', icon: 'sun' },
    scheduled: { title: 'Programadas', icon: 'calendar' },
    all: { title: 'Todas', icon: 'tray' },
    flagged: { title: 'Prioritarias', icon: 'flag' }
  };
  var SORTS = [
    { value: 'smart', label: 'Fecha' },
    { value: 'priority', label: 'Prioridad' },
    { value: 'created', label: 'Más recientes' },
    { value: 'alpha', label: 'Título' }
  ];
  var showDone = {}, homeScroll = 0, rootEl = null;

  /* ---------- Consejos que se muestran una sola vez ---------- */
  W.Tips = {
    show: function (k) { var t = S().meta.tips || {}; return !t[k]; },
    mark: function (k) { var t = Object.assign({}, S().meta.tips || {}); if (t[k]) return; t[k] = true; S().setMeta('tips', t); }
  };

  /* ---------- Categorías: crear, editar y eliminar ---------- */
  var CAT_ICONS = ['list', 'user', 'briefcase', 'heart', 'home', 'book', 'cart', 'wallet', 'dumbbell', 'send', 'music', 'code', 'paw', 'gift', 'leaf', 'star', 'target', 'coffee', 'camera', 'flag'];
  function listIcon(l) { return l && l.icon ? l.icon : 'list'; }
  function editList(list, after, afterRemove) {
    var st = S(), icon = list ? listIcon(list) : 'list';
    var name = U.el('input.list-name', { attrs: { type: 'text', maxlength: 24, placeholder: 'Nombre de la categoría', enterkeyhint: 'done', 'aria-label': 'Nombre de la categoría' } });
    name.value = list ? list.name : '';
    var picker = U.el('div.icon-pick.cat-pick', CAT_ICONS.map(function (ic) {
      var b = U.el('button' + (ic === icon ? '.active' : ''), { attrs: { type: 'button', 'aria-label': 'Icono ' + ic } }, [U.icon(ic)]);
      b.addEventListener('click', function () { icon = ic; U.$$('button', picker).forEach(function (x) { x.classList.toggle('active', x === b); }); W.Audio.select(); });
      return b;
    }));
    var ok = function () {
      var v = name.value.trim();
      if (!v) { name.focus(); name.classList.add('shake'); setTimeout(function () { name.classList.remove('shake'); }, 450); return; }
      var res = list ? (st.updateList(list.id, { name: v, icon: icon }), list) : st.addList(v, null, icon);
      s.close();
      if (after) after(res);
    };
    name.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); ok(); } });
    var s = W.Sheet.open({
      title: list ? 'Editar categoría' : 'Nueva categoría',
      lead: { text: 'Cancelar', onTap: function () { s.close(); } },
      trail: { text: 'OK', bold: true, onTap: ok },
      body: [
        name,
        W.UI.section({ header: 'Icono', items: U.el('div.group', [U.el('div.cell.col', [picker])]) }),
        list && st.lists.length > 1 ? U.el('div.group', [W.UI.cell({ title: 'Eliminar la categoría', center: true, danger: true, onTap: function () {
          removeList(list, function () { s.close(); if (afterRemove) afterRemove(); });
        } })]) : null
      ]
    });
    if (!list) setTimeout(function () { name.focus(); }, W.Layout.desktop ? 30 : 420);
  }
  function removeList(list, after) {
    var st = S();
    if (st.lists.length <= 1) { W.Toast.show({ text: 'Necesitas al menos una categoría', icon: 'info' }); return; }
    W.Sheet.confirm({ title: '¿Eliminar «' + list.name + '»?', text: 'Sus tareas no se borran: quedarán sin categoría.', ok: 'Eliminar', danger: true })
      .then(function (ok) { if (ok) { st.removeList(list.id); if (after) after(); } });
  }
  W.Lists = { edit: editList, remove: removeList, icon: listIcon, ICONS: CAT_ICONS };

  /* ---------- Filtrado, orden y agrupación ---------- */
  function matches(t, q) {
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
  function smartCount(st, id) {
    var td = U.today();
    return st.tasks.filter(function (t) {
      if (t.done) return false;
      if (id === 'today') return t.date === td || st.isOverdue(t);
      if (id === 'scheduled') return !!t.date;
      if (id === 'flagged') return t.highlight !== 'none';
      return true;
    }).length;
  }
  function viewTitle(st, v) {
    if (v.type === 'list') return (st.getList(v.id) || {}).name || 'Categoría';
    if (v.type === 'filter') return (st.getFilter(v.id) || {}).name || 'Filtro';
    return SMART[v.id].title;
  }

  /** Grupos de una página: [{ title, red, items, ctx }] + completadas */
  function buildGroups(st, v) {
    var td = U.today(), tm = U.addDays(td, 1), wk = U.addDays(td, 7), cmp = sorter(st);
    var inView = function (t) { return v.type === 'list' ? t.listId === v.id : v.id === 'flagged' ? t.highlight !== 'none' : true; };
    var flt = v.type === 'filter' ? st.getFilter(v.id) : null;
    var pool = flt ? st.filterTasks(flt) : st.tasks.filter(inView);
    var pend = pool.filter(function (t) { return !t.done; });
    var over = pend.filter(function (t) { return st.isOverdue(t); }).sort(cmp);
    var rest = pend.filter(function (t) { return !st.isOverdue(t); });
    var G = function (title, items, extra) { return Object.assign({ title: title, items: items.sort(cmp) }, extra || {}); };
    var groups = [];
    if (v.id === 'flagged') {
      groups = [G('Urgentes', pend.filter(function (t) { return t.highlight === 'danger'; })),
        G('Importantes', pend.filter(function (t) { return t.highlight === 'purple'; })),
        G('Destacadas', pend.filter(function (t) { return t.highlight === 'star'; }))];
    } else if (v.id === 'today') {
      groups = [G('Vencidas', over, { red: true, ctx: 'alerts' }), G('Hoy', rest.filter(function (t) { return t.date === td; }), { ctx: 'today' })];
    } else if (v.id === 'scheduled') {
      groups.push(G('Vencidas', over, { red: true, ctx: 'alerts' }));
      var byDate = {};
      rest.filter(function (t) { return t.date; }).forEach(function (t) { (byDate[t.date] = byDate[t.date] || []).push(t); });
      Object.keys(byDate).sort().forEach(function (ds) {
        var diff = U.diffDays(td, ds);
        groups.push(G(diff <= 1 ? U.fmtDay(ds) : U.fmtLong(ds), byDate[ds], { ctx: 'day' }));
      });
    } else {
      groups = [
        G('Vencidas', over, { red: true, ctx: 'alerts' }),
        G('Hoy', rest.filter(function (t) { return t.date === td; }), { ctx: 'today' }),
        G('Mañana', rest.filter(function (t) { return t.date === tm; }), { ctx: 'day' }),
        G('Próximos 7 días', rest.filter(function (t) { return t.date > tm && t.date <= wk; })),
        G('Más adelante', rest.filter(function (t) { return t.date > wk; })),
        G('Sin fecha', rest.filter(function (t) { return !t.date; }))
      ];
    }
    groups = groups.filter(function (g) { return g.items.length; });
    var done = v.id === 'scheduled' ? [] : pool.filter(function (t) { return t.done && (v.id !== 'today' || t.doneOn === td || t.date === td); })
      .sort(function (a, b) { return (b.doneAt || 0) - (a.doneAt || 0); });
    return { groups: groups, done: done };
  }

  /* ---------- Tablero (Premium, ordenador): columnas por categoría, prioridad o fecha ---------- */
  var BOARD_BY = [{ value: 'list', label: 'Categoría' }, { value: 'priority', label: 'Prioridad' }, { value: 'date', label: 'Fecha' }];
  function boardColumns(st, pend, by) {
    var td = U.today(), tm = U.addDays(td, 1), wk = U.addDays(td, 7), cmp = st.compareDeadline;
    var col = function (key, title, icon, items, drop, extra) { return Object.assign({ key: key, title: title, icon: icon, items: items.sort(cmp), drop: drop }, extra || {}); };
    if (by === 'priority') {
      return [['danger', 'Urgente'], ['purple', 'Importante'], ['star', 'Destacada'], ['none', 'Normal']].map(function (p) {
        return col(p[0], p[1], null, pend.filter(function (t) { return t.highlight === p[0]; }), { highlight: p[0] }, { prio: p[0] });
      });
    }
    if (by === 'date') {
      var late = pend.filter(function (t) { return st.isOverdue(t); }), rest = pend.filter(function (t) { return !st.isOverdue(t); });
      return [
        col('late', 'Vencidas', 'alert', late, null, { red: true }),
        col('today', 'Hoy', 'sun', rest.filter(function (t) { return t.date === td; }), { date: td }),
        col('tomorrow', 'Mañana', 'calendar', rest.filter(function (t) { return t.date === tm; }), { date: tm }),
        col('week', 'Próximos 7 días', 'week', rest.filter(function (t) { return t.date > tm && t.date <= wk; }), { date: U.addDays(td, 2) }),
        col('later', 'Más adelante', 'agenda', rest.filter(function (t) { return t.date > wk; }), { date: U.addDays(td, 8) }),
        col('none', 'Sin fecha', 'tray', rest.filter(function (t) { return !t.date; }), { date: null, time: null })
      ];
    }
    return st.lists.map(function (l) { return col(l.id, l.name, listIcon(l), pend.filter(function (t) { return t.listId === l.id; }), { listId: l.id }); })
      .concat(pend.some(function (t) { return !t.listId; }) ? [col('-', 'Sin categoría', 'tray', pend.filter(function (t) { return !t.listId; }), { listId: null })] : []);
  }
  function boardCard(st, t) {
    var check = U.el('button.check.sm' + (t.highlight !== 'none' ? '.p-' + t.highlight : ''), { attrs: { 'aria-label': 'Completar: ' + t.text } });
    check.appendChild(U.svg('svg', { viewBox: '0 0 24 24' }, [U.svg('path', { d: 'm5 12.6 4.5 4.5L19 7.6' })]));
    check.addEventListener('click', function (e) { e.stopPropagation(); check.classList.add('on'); W.TaskCard.actions.toggle(t.id, true); });
    var meta = W.TaskCard.metaLine(t, 'board');
    var card = U.el('div.bd-card' + (st.isOverdue(t) ? '.late' : ''), { attrs: { 'data-id': t.id, tabindex: '0', role: 'button' } }, [
      check, U.el('div.bd-main', [U.el('span.bd-title', { text: t.text }), meta]), t.highlight !== 'none' ? W.UI.prio(t.highlight) : null
    ]);
    card.draggable = true;
    card.addEventListener('dragstart', function (e) { e.dataTransfer.setData(W.Sidebar.DRAG_TYPE, t.id); e.dataTransfer.setData('text/plain', t.text); e.dataTransfer.effectAllowed = 'move'; card.classList.add('drag-src'); });
    card.addEventListener('dragend', function () { card.classList.remove('drag-src'); });
    card.addEventListener('click', function () { W.Editor.open(t.id); });
    card.addEventListener('keydown', function (e) { if (e.key === 'Enter') W.Editor.open(t.id); });
    card.addEventListener('contextmenu', function (e) { e.preventDefault(); W.TaskCard.actions.menu(t.id, { x: e.clientX, y: e.clientY }); });
    return card;
  }
  function board(st, pend, by, preset) {
    var cols = boardColumns(st, pend, by);
    return U.el('div.board', cols.map(function (c) {
      var body = U.el('div.bd-body', c.items.map(function (t) { return boardCard(st, t); }));
      if (!c.items.length) body.appendChild(U.el('div.bd-empty', { text: c.drop ? 'Suelta aquí' : 'Nada' }));
      var add = c.drop ? U.el('button.bd-add', { attrs: { type: 'button', title: 'Nueva tarea en «' + c.title + '»' }, on: { click: function () { W.QuickAdd.open(Object.assign({}, preset, c.drop)); } } }, [U.icon('plus', 'xs')]) : null;
      var colEl = U.el('section.bd-col' + (c.red ? '.red' : ''), [
        U.el('div.bd-head', [c.prio ? W.UI.prio(c.prio) : c.icon ? U.icon(c.icon, 'sm') : null, U.el('strong', { text: c.title }), U.el('small', { text: c.items.length }), add]),
        body
      ]);
      if (c.drop) W.Sidebar.dropTarget(colEl, function (id) {
        var t = st.find(id); if (!t) return;
        st.updateTask(id, c.drop);
        W.Toast.show({ text: '«' + t.text + '» → ' + c.title, icon: c.icon || 'flag' });
      });
      return colEl;
    }));
  }

  /* ---------- Página de una lista ---------- */
  function detail(root, v) {
    var st = S(), key = v.type + ':' + v.id;
    var list = v.type === 'list' ? st.getList(v.id) : null;
    var flt = v.type === 'filter' ? st.getFilter(v.id) : null;
    if ((v.type === 'list' && !list) || (v.type === 'filter' && !flt)) { st.ui.taskView = null; return home(root); }
    var title = viewTitle(st, v);
    var b = buildGroups(st, v);
    var preset = list ? { listId: list.id } : v.id === 'flagged' ? { highlight: 'star' } : flt ? {} : { date: U.today() };
    if (flt) {
      if (flt.lists.length === 1 && flt.lists[0]) preset.listId = flt.lists[0];
      if (flt.priorities.length === 1 && flt.priorities[0] !== 'none') preset.highlight = flt.priorities[0];
      if (flt.when === 'today' || flt.when === 'week' || flt.when === 'next7' || flt.when === 'dated') preset.date = U.today();
      if (flt.status === 'done' && showDone[key] === undefined) showDone[key] = true;
    }

    var more = function (e, btn) {
      var items = [{ value: 'sort', label: 'Ordenar por', desc: (SORTS.filter(function (o) { return o.value === st.settings.sort; })[0] || SORTS[0]).label, icon: 'sort' }];
      if (b.groups.length || b.done.length) items.push({ value: 'select', label: 'Seleccionar', desc: W.Layout.desktop ? 'También con ' + W.Layout.keys('clic') : 'También manteniendo pulsada una tarea', icon: 'check' });
      if (b.done.length) items.push({ value: 'clear', label: 'Borrar completadas', icon: 'trash' });
      if (list) {
        items.push({ value: 'edit', label: 'Editar la categoría', icon: 'edit', gap: true });
        items.push({ value: 'remove', label: 'Eliminar la categoría', icon: 'trash', destructive: true });
      }
      if (flt) {
        items.push({ value: 'fedit', label: 'Editar el filtro', icon: 'edit', gap: true });
        items.push({ value: 'fremove', label: 'Eliminar el filtro', icon: 'trash', destructive: true });
      }
      W.Menu.open(btn, items).then(function (a) {
        if (a === 'sort') {
          setTimeout(function () {
            W.Menu.choose(btn, { value: st.settings.sort, options: SORTS }).then(function (s) { if (s) st.setSetting('sort', s); });
          }, 60);
        } else if (a === 'clear') {
          W.Sheet.confirm({ title: '¿Borrar las completadas?', text: 'Tus rachas y marcas se conservan.', ok: 'Borrar', danger: true }).then(function (ok) {
            if (!ok) return;
            var ids = {}; b.done.forEach(function (t) { ids[t.id] = true; });
            st.tasks.forEach(function (t) { if (ids[t.id]) st.markDeleted(t.id); });
            st.tasks = st.tasks.filter(function (t) { return !ids[t.id]; });
            st.notify('clear');
            W.Toast.show({ text: U.plural(b.done.length, 'tarea borrada', 'tareas borradas'), icon: 'trash' });
          });
        } else if (a === 'select') { if (W.Layout.desktop) W.Select.all(); else W.Select.start(); }
        else if (a === 'edit') editList(list);
        else if (a === 'remove') removeList(list, function () { Screen.back(); });
        else if (a === 'fedit') W.Filters.edit(flt);
        else if (a === 'fremove') W.Filters.remove(flt);
      });
    };

    var head = W.UI.header({
      title: title,
      back: { label: 'Tareas', onTap: function () { Screen.back(); } },
      actions: [{ icon: 'dots', label: 'Más opciones', onTap: more }], gear: false,
      sub: flt ? W.Filters.describe(flt) : b.groups.length || b.done.length ? U.plural(b.groups.reduce(function (a, g) { return a + g.items.length; }, 0), 'pendiente', 'pendientes') + (b.done.length ? ' · ' + U.plural(b.done.length, 'completada', 'completadas') : '') : null
    });
    var content = [];
    // En el ordenador se añade escribiendo aquí mismo (con la lista o el filtro de esta página)
    var desk = W.Layout.desktop;
    var layout = desk && st.ui.taskLayout === 'board' && W.Plan.can('board') ? 'board' : 'list';
    if (desk) {
      var by = st.ui.boardBy || (list ? 'priority' : 'list');
      if (list && by === 'list') by = 'priority';
      var tools = [W.UI.segmented([{ value: 'list', label: 'Lista' }, { value: 'board', label: 'Tablero' }], layout, function (val) {
        if (val === 'board' && !W.Plan.gate('board')) { Screen.render(rootEl); return; }
        st.ui.taskLayout = val; Screen.render(rootEl);
      }, { mini: true })];
      if (layout === 'board') tools.push(W.UI.segmented(BOARD_BY.filter(function (o) { return !(list && o.value === 'list'); }), by, function (val) { st.ui.boardBy = val; Screen.render(rootEl); }, { mini: true }));
      content.push(U.el('div.task-tools', tools));
    }
    if (desk && !(flt && flt.status === 'done')) content.push(W.QuickAdd.inline(preset, list ? 'Añadir a ' + list.name + '…' : 'Añadir una tarea…'));
    if (layout === 'board') {
      var pend = b.groups.reduce(function (a, g) { return a.concat(g.items); }, []);
      content.push(board(st, pend, by, preset));
      W.UI.mount(root, head, content);
      return;
    }
    b.groups.forEach(function (g, i) {
      content.push(W.UI.section({ title: g.title, red: g.red, first: i === 0, side: U.el('small', { text: g.items.length }),
        items: W.TaskCard.list(g.items, { ctx: v.type === 'list' ? (g.ctx === 'alerts' ? 'alerts' : 'list') : g.ctx, postpone: !!g.red }) }));
    });
    if (!b.groups.length) {
      content.push(W.UI.empty(SMART[v.id] ? SMART[v.id].icon : flt ? 'filter' : listIcon(list), b.done.length ? 'Todo hecho' : 'Sin tareas',
        b.done.length ? 'No queda nada pendiente aquí.' : W.Layout.desktop ? 'Escribe arriba para añadir una tarea.' : 'Pulsa + para añadir una tarea.',
        W.Layout.desktop ? null : U.el('button.btn.sm.soft', { on: { click: function () { W.QuickAdd.open(preset); } } }, [U.icon('plus', 'sm'), 'Nueva tarea'])));
    }
    if (b.done.length) {
      var host = U.el('div.sec');
      var drawDone = function () {
        U.clear(host);
        host.appendChild(U.el('div.done-toggle', [U.el('span', { text: U.plural(b.done.length, 'completada', 'completadas') }),
          U.el('button.link-btn', { text: showDone[key] ? 'Ocultar' : 'Mostrar', on: { click: function () { showDone[key] = !showDone[key]; drawDone(); } } })]));
        if (showDone[key]) host.appendChild(W.TaskCard.list(b.done.slice(0, 100), { ctx: v.type === 'list' ? 'list' : 'done' }));
      };
      drawDone();
      content.push(host);
    }
    if (b.groups.length && !W.Layout.desktop && W.Tips.show('swipe')) content.push(U.el('p.hint', { text: 'Desliza una tarea hacia la derecha para completarla o hacia la izquierda para eliminarla.' }));
    W.UI.mount(root, head, content);
  }

  /* ---------- Portada: búsqueda, listas inteligentes y mis listas ---------- */
  function results(host) {
    var st = S(), q = (st.ui.query || '').trim();
    U.clear(host);
    if (!q) return;
    var found = st.tasks.filter(function (t) { return matches(t, q); });
    var pend = found.filter(function (t) { return !t.done; }).sort(st.compareDeadline);
    var done = found.filter(function (t) { return t.done; }).sort(function (a, b) { return (b.doneAt || 0) - (a.doneAt || 0); });
    if (!found.length) { host.appendChild(W.UI.empty('buddy:search:worried', 'Sin resultados', 'Ninguna tarea coincide con «' + q + '».')); return; }
    if (pend.length) host.appendChild(W.UI.section({ title: 'Pendientes', side: U.el('small', { text: pend.length }), items: W.TaskCard.list(pend.slice(0, 200), {}) }));
    if (done.length) host.appendChild(W.UI.section({ title: 'Completadas', side: U.el('small', { text: done.length }), items: W.TaskCard.list(done.slice(0, 100), { ctx: 'done' }) }));
  }

  function home(root) {
    var st = S();
    var pendingAll = st.tasks.filter(function (t) { return !t.done; }).length;
    var head = W.UI.header({ title: 'Tareas', profile: true, sub: pendingAll ? U.plural(pendingAll, 'tarea pendiente', 'tareas pendientes') : 'Todo al día' });
    var input = U.el('input.input', { attrs: { type: 'search', placeholder: 'Buscar', 'aria-label': 'Buscar tareas', enterkeyhint: 'search', autocomplete: 'off' } });
    input.value = st.ui.query || '';
    var search = U.el('div.search' + (input.value ? '.has-value' : ''), [U.icon('search'), input,
      U.el('button.clear', { attrs: { 'aria-label': 'Borrar búsqueda' }, on: { click: function () { input.value = ''; st.ui.query = ''; update(); input.focus(); } } }, [U.icon('close')])]);
    var resHost = U.el('div');
    var browse = U.el('div');

    var grid = U.el('div.smart-grid', Object.keys(SMART).map(function (id) {
      var m = SMART[id];
      return U.el('button.smart', { attrs: { 'aria-label': m.title + ': ' + smartCount(st, id) }, on: { click: function () { Screen.open({ type: 'smart', id: id }); } } }, [
        U.el('span.smart-top', [W.UI.cellIcon(m.icon), U.el('span.smart-count', { text: smartCount(st, id) })]),
        U.el('span.smart-label', { text: m.title })
      ]);
    }));
    var lists = st.lists.map(function (l) {
      var n = st.tasks.filter(function (t) { return t.listId === l.id && !t.done; }).length;
      return W.UI.cell({ icon: listIcon(l), title: l.name, value: U.el('span.list-count', { text: n }), onTap: function () { Screen.open({ type: 'list', id: l.id }); } });
    });
    browse.appendChild(grid);
    lists.push(W.UI.cell({ icon: 'plus', title: 'Nueva categoría', accent: true,
      onTap: function () { editList(null, function (l) { Screen.open({ type: 'list', id: l.id }); }); } }));
    browse.appendChild(W.UI.section({ title: 'Mis categorías', items: lists }));
    var filters = st.filters.map(function (f) {
      return W.UI.cell({ icon: 'filter', title: f.name, sub: W.Filters.describe(f), value: U.el('span.list-count', { text: st.filterTasks(f).length }), onTap: function () { Screen.open({ type: 'filter', id: f.id }); } });
    });
    filters.push(W.UI.cell({ icon: 'plus', title: 'Nuevo filtro', accent: true,
      onTap: function () { W.Filters.edit(null, function (f) { Screen.open({ type: 'filter', id: f.id }); }); } }));
    browse.appendChild(W.UI.section({ title: 'Filtros', items: filters, footer: st.filters.length ? null : 'Reúne tareas de varias categorías, prioridades o fechas en una sola página.' }));

    var update = function () {
      var q = (st.ui.query || '').trim();
      search.classList.toggle('has-value', !!input.value);
      browse.style.display = q ? 'none' : '';
      results(resHost);
    };
    input.addEventListener('input', U.debounce(function () { st.ui.query = input.value; update(); }, 120));

    var focused = document.activeElement && root.contains(document.activeElement) && document.activeElement.type === 'search';
    W.UI.mount(root, head, [search, resHost, browse]);
    update();
    if (focused) { input.focus(); var v = input.value; input.value = ''; input.value = v; }
  }

  var Screen = {
    title: 'Tareas',
    open: function (v) {
      homeScroll = rootEl ? rootEl.scrollTop : 0;
      S().ui.taskView = v;
      W.Router.animate('push');
      if (rootEl) { Screen.render(rootEl); rootEl.scrollTop = 0; }
    },
    back: function () {
      if (!S().ui.taskView) return false;
      S().ui.taskView = null;
      W.Router.animate('pop');
      if (rootEl) { Screen.render(rootEl); rootEl.scrollTop = homeScroll; }
      return true;
    },
    /** Al volver a tocar la pestaña: vuelve a la portada */
    reset: function () { return Screen.back(); },
    render: function (root) {
      rootEl = root;
      var v = S().ui.taskView;
      if (v) detail(root, v); else home(root);
    }
  };
  W.Screens.tasks = Screen;
})(window.Whider);
