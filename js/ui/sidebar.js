/**
 * WHIDER · Barra lateral del ordenador.
 * Nueva tarea y búsqueda arriba; las cinco secciones (Inicio, Tareas, Calendario, Cuaderno y Personas); tus categorías y
 * tus filtros; abajo, tu perfil y los ajustes. Las tareas (una o varias seleccionadas) se pueden soltar sobre «Hoy» o
 * sobre una categoría. Los contadores y el tamaño se eligen en Ajustes → Personalización.
 */
window.Whider = window.Whider || {};

(function (W) {
  'use strict';
  var U = W.U, S = function () { return W.State; };
  var el = null, queued = false;
  var DRAG_TYPE = 'text/x-whider-task';

  /* Las mismas cinco secciones que la barra inferior del móvil, por orden de importancia */
  var NAV = [
    { id: 'home', label: W.t('Inicio'), icon: 'home', key: '1' },
    { id: 'tasks', label: W.t('Tareas'), icon: 'tasks', key: '2' },
    { id: 'calendar', label: W.t('Calendario'), icon: 'calendar', key: '3' },
    { id: 'notes', label: W.t('Cuaderno'), icon: 'notebook', key: '4' },
    { id: 'friends', label: W.t('Personas'), icon: 'users', key: '5' }
  ];

  function openedList(st) {
    var v = st.ui.taskView;
    return st.activeScreen === 'tasks' && v && v.type === 'list' ? v.id : null;
  }
  function openedFilter(st) {
    var v = st.ui.taskView;
    return st.activeScreen === 'tasks' && v && v.type === 'filter' ? v.id : null;
  }
  function go(id) {
    var st = S();
    if (id === 'tasks' && st.activeScreen === 'tasks' && st.ui.taskView) { W.Screens.tasks.back(); return; }
    W.Router.go(id);
  }

  function openList(id) { openView({ type: 'list', id: id }); }
  function openView(v) {
    var st = S();
    if (st.activeScreen !== 'tasks') { st.ui.taskView = v; W.Router.go('tasks'); }
    else W.Screens.tasks.open(v);
  }

  /** Destino para soltar tareas arrastradas: onDrop(id, evento) */
  function dropTarget(node, onDrop) {
    node.addEventListener('dragover', function (e) {
      if (!e.dataTransfer || Array.prototype.indexOf.call(e.dataTransfer.types, DRAG_TYPE) < 0) return;
      e.preventDefault(); e.stopPropagation(); e.dataTransfer.dropEffect = 'move'; node.classList.add('drop-on');
    });
    node.addEventListener('dragleave', function (e) { if (!node.contains(e.relatedTarget)) node.classList.remove('drop-on'); });
    node.addEventListener('drop', function (e) {
      node.classList.remove('drop-on');
      var raw = e.dataTransfer && e.dataTransfer.getData(DRAG_TYPE);
      if (!raw) return;
      e.preventDefault(); e.stopPropagation();
      var ids = raw.split(',').filter(Boolean);
      if (ids.length === 1) { onDrop(ids[0], e); return; }
      // Varias tareas seleccionadas: un solo guardado y un solo aviso
      W.Toast.mute(true);
      try { W.State.batch(function () { ids.forEach(function (id) { onDrop(id, e); }); }); } finally { W.Toast.mute(false); }
      W.Toast.show({ text: U.plural(ids.length, 'tarea movida', 'tareas movidas'), icon: 'check' });
      if (W.Select) W.Select.clear();
    });
  }

  var showCounts = true;
  function count(n, strong) { return n && (showCounts || strong) ? U.el('span.sb-count' + (strong ? '.strong' : ''), { text: n > 99 ? '99+' : String(n) }) : null; }

  // Secciones con su icono relleno cuando estás en ella (como en la barra inferior del móvil)
  var FILLED = { home: 1, sun: 1, tasks: 1, calendar: 1, notebook: 1, users: 1 };
  function navItem(st, n, on, extra) {
    return U.el('button.sb-item' + (on ? '.active' : ''), {
      attrs: { 'aria-current': on ? 'page' : null, title: n.label + (n.key ? ' · ' + n.key : ''), 'data-go': n.id },
      on: { click: function () { go(n.id); } }
    }, [U.icon(on && FILLED[n.icon] ? n.icon + '-fill' : n.icon), U.el('span.sb-label', { text: n.label }), extra]);
  }

  function render() {
    if (!el) return;
    var st = S(), active = st.activeScreen, listOpen = openedList(st), filterOpen = openedFilter(st), td = U.today();
    var sb = st.settings.desk.sidebar;
    showCounts = sb.counts !== false;
    el.classList.toggle('compact', !!sb.compact);
    var overdue = st.overdueAll().length;
    var todayLeft = st.tasks.filter(function (t) { return !t.done && t.date === td && !st.isOverdue(t); }).length;
    var pending = st.tasks.filter(function (t) { return !t.done; }).length;
    var unread = W.Chat ? W.Chat.unreadCount() : 0, reqs = W.People ? W.People.pendingCount() : 0;

    // Personas, solo si la usas (o si alguien te escribe): se elige en la presentación y en Ajustes
    var people = st.settings.peopleTab !== false || unread + reqs > 0 || active === 'friends' || active === 'chats';
    var nav = U.el('nav.sb-nav', NAV.filter(function (n) { return n.id !== 'friends' || people; }).map(function (n) {
      var on = (active === n.id || (n.id === 'friends' && active === 'chats')) && !(n.id === 'tasks' && (listOpen || filterOpen));
      var extra = n.id === 'home' ? count(overdue || todayLeft, overdue > 0)
        : n.id === 'tasks' ? count(pending)
        : n.id === 'notes' ? count(W.Pages ? W.Pages.count() : 0)
        : n.id === 'friends' ? count(unread + reqs, true)
        : null;
      var b = navItem(st, n, on, extra);
      if (n.id === 'home') dropTarget(b, function (id) {
        var t = st.find(id); if (!t) return;
        st.updateTask(id, { date: td });
        W.Toast.show({ text: W.t('«{text}» pasa a hoy', { text: t.text }), icon: 'sun' });
      });
      return b;
    }));
    var lists = U.el('div.sb-lists', st.lists.map(function (l) {
      var n = st.tasks.filter(function (t) { return t.listId === l.id && !t.done; }).length;
      var b = U.el('button.sb-item.sb-list' + (listOpen === l.id ? '.active' : ''), {
        attrs: { title: l.name, 'aria-current': listOpen === l.id ? 'page' : null },
        on: {
          click: function () { openList(l.id); },
          contextmenu: function (e) {
            e.preventDefault();
            var i = st.lists.indexOf(l);
            W.Menu.open({ x: e.clientX, y: e.clientY }, [
              { value: 'open', label: W.t('Abrir'), icon: W.Lists.icon(l) },
              { value: 'edit', label: W.t('Editar…'), icon: 'edit' },
              { value: 'up', label: W.t('Subir'), icon: 'up', gap: true, disabled: i === 0 },
              { value: 'down', label: W.t('Bajar'), icon: 'down', disabled: i === st.lists.length - 1 },
              { value: 'remove', label: W.t('Eliminar la categoría'), icon: 'trash', destructive: true, gap: true }
            ]).then(function (v) {
              if (v === 'open') openList(l.id);
              else if (v === 'edit') W.Lists.edit(l);
              else if (v === 'up') st.moveList(l.id, -1);
              else if (v === 'down') st.moveList(l.id, 1);
              else if (v === 'remove') W.Lists.remove(l, function () { if (openedList(S()) === l.id) W.Screens.tasks.back(); });
            });
          }
        }
      }, [U.icon(W.Lists.icon(l)), U.el('span.sb-label', { text: l.name }), count(n)]);
      W.Lists.paint(b, l);
      dropTarget(b, function (id) {
        var t = st.find(id); if (!t || t.listId === l.id) return;
        st.updateTask(id, { listId: l.id });
        W.Toast.show({ text: W.t('«{text}» movida a {name}', { text: t.text, name: l.name }), icon: 'list' });
      });
      return b;
    }));

    var filtersSec = null;
    if (sb.filters !== false && W.Filters) {
      filtersSec = U.el('div.sb-sec', [
        U.el('div.sb-head', [U.el('span', { text: W.t('Filtros') }),
          U.el('button.sb-add', { attrs: { 'aria-label': W.t('Nuevo filtro'), title: W.t('Nuevo filtro') }, on: { click: function () {
            W.Filters.edit(null, function (f) { openView({ type: 'filter', id: f.id }); });
          } } }, [U.icon('plus', 'xs')])]),
        st.filters.length ? U.el('div.sb-lists', st.filters.map(function (f) {
          var n = st.filterTasks(f).length;
          return U.el('button.sb-item.sb-list' + (filterOpen === f.id ? '.active' : ''), {
            attrs: { title: f.name + ' · ' + W.Filters.describe(f), 'aria-current': filterOpen === f.id ? 'page' : null },
            on: {
              click: function () { openView({ type: 'filter', id: f.id }); },
              contextmenu: function (e) { e.preventDefault(); W.Filters.menu(f, { x: e.clientX, y: e.clientY }); }
            }
          }, [U.icon('filter'), U.el('span.sb-label', { text: f.name }), count(n)]);
        })) : U.el('button.sb-empty', { text: W.t('Guarda una búsqueda como filtro'), on: { click: function () {
          W.Filters.edit(null, function (f) { openView({ type: 'filter', id: f.id }); });
        } } })
      ]);
    }

    U.clear(el);
    el.appendChild(U.el('div.sb-brand', [
      U.svg('svg', { viewBox: '0 0 64 64', 'aria-hidden': 'true' }, [U.svg('use', { href: '#logo' })]),
      U.el('span', { text: W.t('WHIDER') })
    ]));
    el.appendChild(U.el('button.sb-search', { attrs: { title: W.t('Buscar tareas y acciones · {0}', { 0: W.Layout.keys('K') }) }, on: { click: function () { W.Palette.open(); } } },
      [U.icon('search', 'sm'), U.el('span', { text: W.t('Buscar') }), U.el('kbd', { text: W.Layout.keys('K') })]));
    el.appendChild(nav);
    el.appendChild(U.el('div.sb-actions', [
      U.el('button.btn.primary.sb-new', { attrs: { title: W.t('Nueva tarea · N') }, on: { click: function () { W.App.newTask(); } } },
        [U.icon('plus', 'sm'), U.el('span', { text: W.t('Nueva tarea') })])
    ]));
    el.appendChild(U.el('div.sb-sec', [
      U.el('div.sb-head', [U.el('span', { text: W.t('Categorías') }),
        U.el('button.sb-add', { attrs: { 'aria-label': W.t('Nueva categoría'), title: W.t('Nueva categoría') }, on: { click: function () {
          W.Lists.edit(null, function (l) { openList(l.id); });
        } } }, [U.icon('plus', 'xs')])]),
      lists
    ]));
    if (filtersSec) el.appendChild(filtersSec);
    // Abajo, solo tu foto y tu nombre: abren el menú de tu cuenta (ajustes, ayuda, cerrar sesión…)
    el.appendChild(U.el('div.sb-foot', [W.AccountMenu.sidebarButton()]));
  }

  var Sidebar = {
    DRAG_TYPE: DRAG_TYPE,
    NAV: NAV,
    openView: openView,
    dropTarget: dropTarget,
    /** Solo se dibuja en el ordenador (en el móvil no hace falta: se pintará al pasar a pantalla grande) */
    init: function () { el = document.getElementById('sidebar'); if (W.Layout.desktop) render(); },
    /** Vuelve a pintar en el siguiente fotograma (varios cambios seguidos = un solo pintado) */
    refresh: function () {
      if (!el || queued || !W.Layout.desktop) return;
      queued = true;
      requestAnimationFrame(function () { queued = false; render(); });
    }
  };

  W.Sidebar = Sidebar;
})(window.Whider);
