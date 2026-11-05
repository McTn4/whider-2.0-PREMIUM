/**
 * WHIDER · Barra lateral del ordenador.
 * Nueva tarea y búsqueda arriba, las cuatro secciones, tus listas y, abajo, tu perfil y los ajustes.
 * Las tareas se pueden soltar sobre «Hoy» (pasan a hoy) o sobre una lista (se mueven a ella).
 */
window.Whider = window.Whider || {};

(function (W) {
  'use strict';
  var U = W.U, S = function () { return W.State; };
  var el = null, queued = false, timerEl = null;
  var DRAG_TYPE = 'text/x-whider-task';

  var NAV = [
    { id: 'home', label: 'Hoy', icon: 'sun', key: '1' },
    { id: 'tasks', label: 'Tareas', icon: 'tasks', key: '2' },
    { id: 'calendar', label: 'Calendario', icon: 'calendar', key: '3' },
    { id: 'focus', label: 'Enfoque', icon: 'timer', key: '4' }
  ];

  function openedList(st) {
    var v = st.ui.taskView;
    return st.activeScreen === 'tasks' && v && v.type === 'list' ? v.id : null;
  }

  function go(id) {
    var st = S();
    if (id === 'tasks' && st.activeScreen === 'tasks' && st.ui.taskView) { W.Screens.tasks.back(); return; }
    W.Router.go(id);
  }

  function openList(id) {
    var st = S();
    if (st.activeScreen !== 'tasks') { st.ui.taskView = { type: 'list', id: id }; W.Router.go('tasks'); }
    else W.Screens.tasks.open({ type: 'list', id: id });
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
      var id = e.dataTransfer && e.dataTransfer.getData(DRAG_TYPE);
      if (!id) return;
      e.preventDefault(); e.stopPropagation();
      onDrop(id, e);
    });
  }

  function count(n, strong) { return n ? U.el('span.sb-count' + (strong ? '.strong' : ''), { text: n > 99 ? '99+' : String(n) }) : null; }

  function render() {
    if (!el) return;
    var st = S(), active = st.activeScreen, listOpen = openedList(st), td = U.today();
    var overdue = st.overdueAll().length;
    var todayLeft = st.tasks.filter(function (t) { return !t.done && t.date === td && !st.isOverdue(t); }).length;
    var pending = st.tasks.filter(function (t) { return !t.done; }).length;
    var focus = W.Screens.focus && W.Screens.focus.status ? W.Screens.focus.status() : null;

    var nav = U.el('nav.sb-nav', NAV.map(function (n) {
      var on = active === n.id && !(n.id === 'tasks' && listOpen);
      var extra = n.id === 'home' ? count(overdue || todayLeft, overdue > 0)
        : n.id === 'tasks' ? count(pending)
        : n.id === 'focus' && focus && focus.running ? (timerEl = U.el('span.sb-timer', { text: focus.text }))
        : null;
      var b = U.el('button.sb-item' + (on ? '.active' : ''), {
        attrs: { 'aria-current': on ? 'page' : null, title: n.label + ' · ' + n.key, 'data-go': n.id },
        on: { click: function () { go(n.id); } }
      }, [U.icon(n.icon), U.el('span.sb-label', { text: n.label }), extra]);
      if (n.id === 'home') dropTarget(b, function (id) {
        var t = st.find(id); if (!t) return;
        st.updateTask(id, { date: td });
        W.Toast.show({ text: '«' + t.text + '» pasa a hoy', icon: 'sun' });
      });
      return b;
    }));
    if (!focus || !focus.running) timerEl = null;

    var lists = U.el('div.sb-lists', st.lists.map(function (l) {
      var n = st.tasks.filter(function (t) { return t.listId === l.id && !t.done; }).length;
      var b = U.el('button.sb-item.sb-list' + (listOpen === l.id ? '.active' : ''), {
        attrs: { title: l.name, 'aria-current': listOpen === l.id ? 'page' : null },
        on: {
          click: function () { openList(l.id); },
          contextmenu: function (e) {
            e.preventDefault();
            W.Menu.open({ x: e.clientX, y: e.clientY }, [
              { value: 'open', label: 'Abrir', icon: 'list' },
              { value: 'edit', label: 'Cambiar nombre…', icon: 'edit' },
              { value: 'remove', label: 'Eliminar lista', icon: 'trash', destructive: true, gap: true }
            ]).then(function (v) {
              if (v === 'open') openList(l.id);
              else if (v === 'edit') W.Lists.edit(l);
              else if (v === 'remove') W.Lists.remove(l, function () { if (openedList(S()) === l.id) W.Screens.tasks.back(); });
            });
          }
        }
      }, [U.icon('list'), U.el('span.sb-label', { text: l.name }), count(n)]);
      dropTarget(b, function (id) {
        var t = st.find(id); if (!t || t.listId === l.id) return;
        st.updateTask(id, { listId: l.id });
        W.Toast.show({ text: '«' + t.text + '» movida a ' + l.name, icon: 'list' });
      });
      return b;
    }));

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
    el.appendChild(U.el('div.sb-sec', [
      U.el('div.sb-head', [U.el('span', { text: 'Listas' }),
        U.el('button.sb-add', { attrs: { 'aria-label': 'Nueva lista', title: 'Nueva lista' }, on: { click: function () {
          W.Lists.edit(null, function (l) { openList(l.id); });
        } } }, [U.icon('plus', 'xs')])]),
      lists
    ]));
    el.appendChild(U.el('div.sb-foot', [
      U.el('button.sb-profile' + (active === 'progress' ? '.active' : ''), { attrs: { title: 'Perfil y resumen · P' }, on: { click: function () { W.Router.go('progress'); } } }, [
        W.Profile.avatar(),
        U.el('span.sb-who', [U.el('strong', { text: name || 'Tu perfil' }), U.el('small', { text: sync })])
      ]),
      U.el('button.nav-icon.sb-gear', { attrs: { 'aria-label': 'Ajustes', title: 'Ajustes · ' + W.Layout.keys(',') }, on: { click: function () { W.Settings.open(); } } }, [U.icon('gear')])
    ]));
  }

  var Sidebar = {
    DRAG_TYPE: DRAG_TYPE,
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
