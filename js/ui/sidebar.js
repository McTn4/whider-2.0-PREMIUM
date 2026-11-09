/**
 * WHIDER · Barra lateral del ordenador.
 * Nueva tarea y búsqueda arriba; las secciones (Hoy, Tareas, Calendario, Hábitos, Enfoque),
 * análisis y herramientas, tus listas y tus filtros; abajo, tu perfil y los ajustes.
 * Las tareas (una o varias seleccionadas) se pueden soltar sobre «Hoy» o sobre una lista.
 * Qué se ve, los contadores y el tamaño se eligen en Ajustes → Personalización.
 */
window.Whider = window.Whider || {};

(function (W) {
  'use strict';
  var U = W.U, S = function () { return W.State; };
  var el = null, queued = false, timerEl = null;
  var DRAG_TYPE = 'text/x-whider-task';

  /*
   * Secciones por orden de importancia: lo principal (tu día, tus tareas, tu calendario y tu
   * Cuaderno), el trabajo con otros, tus rutinas (con los Sistemas: métodos y automatizaciones,
   * que son forma de trabajar y no análisis) y, al final, el análisis. Los mismos grupos que «Más»
   * en el móvil. «opt» es la clave para ocultarla (Ajustes → Personalización).
   */
  var NAV = [
    { id: 'home', label: 'Hoy', icon: 'sun', key: '1' },
    { id: 'tasks', label: 'Tareas', icon: 'tasks', key: '2' },
    { id: 'calendar', label: 'Calendario', icon: 'calendar', key: '3' },
    { id: 'notes', label: 'Cuaderno', icon: 'notebook', key: '4', opt: 'notes' }
  ];
  var TEAM = [
    { id: 'chats', label: 'Chats', icon: 'chat', key: '5', opt: 'chats' },
    { id: 'friends', label: 'Personas', icon: 'users', key: '6', opt: 'friends' }
  ];
  var DAY = [
    { id: 'habits', label: 'Hábitos', icon: 'target', key: '7', opt: 'habits' },
    { id: 'focus', label: 'Enfoque', icon: 'timer', key: '8', opt: 'focus' },
    { id: 'automations', label: 'Sistemas', icon: 'system', opt: 'automations', premium: 'systems' }
  ];
  var TOOLS = [
    { id: 'stats', label: 'Estadísticas', icon: 'chart', key: '9', opt: 'stats' },
    { id: 'reports', label: 'Informes', icon: 'print', opt: 'reports' }
  ];

  function openedList(st) {
    var v = st.ui.taskView;
    return st.activeScreen === 'tasks' && v && v.type === 'list' ? v.id : null;
  }
  function openedFilter(st) {
    var v = st.ui.taskView;
    return st.activeScreen === 'tasks' && v && v.type === 'filter' ? v.id : null;
  }
  function shown(st, n) { return !n.opt || st.settings.desk.sidebar[n.opt] !== false; }

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

  function navItem(st, n, on, extra) {
    if (!extra && n.premium && W.Plan && !W.Plan.isPremium()) extra = U.el('span.sb-gem', { attrs: { title: 'Premium' } }, [U.icon('gem')]);
    return U.el('button.sb-item' + (on ? '.active' : ''), {
      attrs: { 'aria-current': on ? 'page' : null, title: n.label + (n.key ? ' · ' + n.key : ''), 'data-go': n.id },
      on: { click: function () { go(n.id); } }
    }, [U.icon(n.icon), U.el('span.sb-label', { text: n.label }), extra]);
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
    var focus = W.Screens.focus && W.Screens.focus.status ? W.Screens.focus.status() : null;
    var habitsLeft = W.Habits ? W.Habits.list().filter(W.Habits.pendingToday).length : 0;

    var nav = U.el('nav.sb-nav', NAV.filter(function (n) { return shown(st, n); }).map(function (n) {
      var on = active === n.id && !(n.id === 'tasks' && (listOpen || filterOpen));
      var extra = n.id === 'home' ? count(overdue || todayLeft, overdue > 0)
        : n.id === 'tasks' ? count(pending)
        : n.id === 'notes' ? count(W.Pages ? W.Pages.count() : 0)
        : null;
      var b = navItem(st, n, on, extra);
      if (n.id === 'home') dropTarget(b, function (id) {
        var t = st.find(id); if (!t) return;
        st.updateTask(id, { date: td });
        W.Toast.show({ text: '«' + t.text + '» pasa a hoy', icon: 'sun' });
      });
      return b;
    }));
    if (!focus || !focus.running) timerEl = null;

    var group = function (title, items, extraFor) {
      var list = items.filter(function (n) { return shown(st, n); });
      return list.length ? U.el('div.sb-sec.sb-tools', [
        U.el('div.sb-head', [U.el('span', { text: title })]),
        U.el('div.sb-group', list.map(function (n) { return navItem(st, n, active === n.id, extraFor ? extraFor(n) : null); }))
      ]) : null;
    };
    var unread = W.Chat ? W.Chat.unreadCount() : 0, reqs = W.People ? W.People.pendingCount() : 0;
    var teamSec = group('Equipo', TEAM, function (n) { return n.id === 'chats' ? count(unread, true) : n.id === 'friends' ? count(reqs, true) : null; });
    var daySec = group('Rutinas', DAY, function (n) { return n.id === 'habits' ? count(habitsLeft) : n.id === 'focus' && focus && focus.running ? (timerEl = U.el('span.sb-timer', { text: focus.text })) : null; });
    var toolsSec = group('Análisis', TOOLS);

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
              { value: 'open', label: 'Abrir', icon: W.Lists.icon(l) },
              { value: 'edit', label: 'Editar…', icon: 'edit' },
              { value: 'up', label: 'Subir', icon: 'up', gap: true, disabled: i === 0 },
              { value: 'down', label: 'Bajar', icon: 'down', disabled: i === st.lists.length - 1 },
              { value: 'remove', label: 'Eliminar la categoría', icon: 'trash', destructive: true, gap: true }
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
      dropTarget(b, function (id) {
        var t = st.find(id); if (!t || t.listId === l.id) return;
        st.updateTask(id, { listId: l.id });
        W.Toast.show({ text: '«' + t.text + '» movida a ' + l.name, icon: 'list' });
      });
      return b;
    }));

    var filtersSec = null;
    if (sb.filters !== false && W.Filters) {
      filtersSec = U.el('div.sb-sec', [
        U.el('div.sb-head', [U.el('span', { text: 'Filtros' }),
          U.el('button.sb-add', { attrs: { 'aria-label': 'Nuevo filtro', title: 'Nuevo filtro' }, on: { click: function () {
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
        })) : U.el('button.sb-empty', { text: 'Guarda una búsqueda como filtro', on: { click: function () {
          W.Filters.edit(null, function (f) { openView({ type: 'filter', id: f.id }); });
        } } })
      ]);
    }

    var name = st.displayName();
    var sync = W.Auth && W.Auth.user ? W.Sync.statusText() : (W.Auth && W.Auth.configured() ? 'Sin cuenta' : 'En este dispositivo');

    U.clear(el);
    el.appendChild(U.el('div.sb-brand', [
      U.svg('svg', { viewBox: '0 0 64 64', 'aria-hidden': 'true' }, [U.svg('use', { href: '#logo' })]),
      U.el('span', { text: 'WHIDER' })
    ]));
    el.appendChild(U.el('div.sb-actions', [
      U.el('button.btn.primary.sb-new', { attrs: { title: 'Nueva tarea · N' }, on: { click: function () { W.App.newTask(); } } },
        [U.icon('plus', 'sm'), U.el('span', { text: 'Nueva tarea' }), U.el('kbd', { text: 'N' })]),
      U.el('button.sb-search', { attrs: { title: 'Buscar tareas y acciones · ' + W.Layout.keys('K') }, on: { click: function () { W.Palette.open(); } } },
        [U.icon('search', 'sm'), U.el('span', { text: 'Buscar' }), U.el('kbd', { text: W.Layout.keys('K') })])
    ]));
    el.appendChild(nav);
    if (teamSec) el.appendChild(teamSec);
    if (daySec) el.appendChild(daySec);
    if (toolsSec) el.appendChild(toolsSec);
    el.appendChild(U.el('div.sb-sec', [
      U.el('div.sb-head', [U.el('span', { text: 'Categorías' }),
        U.el('button.sb-add', { attrs: { 'aria-label': 'Nueva categoría', title: 'Nueva categoría' }, on: { click: function () {
          W.Lists.edit(null, function (l) { openList(l.id); });
        } } }, [U.icon('plus', 'xs')])]),
      lists
    ]));
    if (filtersSec) el.appendChild(filtersSec);
    var P = W.Plan;
    if (P && !P.isPremium()) el.appendChild(U.el('button.sb-premium', { attrs: { title: 'Planes y precios' }, on: { click: function () { P.open(); } } }, [
      U.el('span.sb-premium-ic', [U.icon('gem')]), U.el('span', [U.el('strong', { text: 'Hazte Premium' }), U.el('small', { text: P.canTrial() ? P.PRICES.trialDays + ' días gratis' : 'Sistemas, comunidad y más' })])]));
    el.appendChild(U.el('div.sb-foot', [
      U.el('button.sb-profile' + (active === 'progress' ? '.active' : ''), { attrs: { title: 'Perfil y resumen · P' }, on: { click: function () { W.Router.go('progress'); } } }, [
        W.Profile.avatar(),
        U.el('span.sb-who', [U.el('strong', [name || 'Tu perfil', P && P.isPremium() ? U.el('span.premium-chip.mini', [U.icon('gem')]) : null]), U.el('small', { text: sync })])
      ]),
      U.el('button.nav-icon.sb-gear', { attrs: { 'aria-label': 'Ajustes', title: 'Ajustes · ' + W.Layout.keys(',') }, on: { click: function () { W.Settings.open(); } } }, [U.icon('gear')])
    ]));
  }

  var Sidebar = {
    DRAG_TYPE: DRAG_TYPE,
    NAV: NAV,
    TEAM: TEAM,
    DAY: DAY,
    TOOLS: TOOLS,
    openView: openView,
    dropTarget: dropTarget,
    /** Solo se dibuja en el ordenador (en el móvil no hace falta: se pintará al pasar a pantalla grande) */
    init: function () { el = document.getElementById('sidebar'); if (W.Layout.desktop) render(); },
    /** Vuelve a pintar en el siguiente fotograma (varios cambios seguidos = un solo pintado) */
    refresh: function () {
      if (!el || queued || !W.Layout.desktop) return;
      queued = true;
      requestAnimationFrame(function () { queued = false; render(); });
    },
    /** Cada segundo con el enfoque en marcha: solo cambia el reloj */
    tick: function () {
      if (!timerEl || !W.Layout.desktop) return;
      var f = W.Screens.focus.status();
      timerEl.textContent = f.text;
    }
  };

  W.Sidebar = Sidebar;
})(window.Whider);
