/**
 * WHIDER · Barra superior del ordenador (desde la 2.1, en lugar de la barra lateral).
 * A la izquierda, el logotipo y, a su lado, las secciones (Inicio, Tareas, Calendario, Cuaderno y, si la usas,
 * Personas; la abierta, en una píldora blanca); a la derecha, buscar, «Nueva tarea» y tu foto con tu nombre (tu cuenta
 * y los ajustes).
 * Tus categorías y tus filtros están dentro de Tareas, en su panel (js/screens/tasks.js).
 * Las tareas (una o varias seleccionadas) se pueden soltar sobre «Inicio» para pasarlas a hoy. Aquí viven también el
 * arrastre de tareas (DRAG_TYPE y dropTarget) y openView, que usan Tareas, el Calendario, los filtros y la paleta.
 */
window.Whider = window.Whider || {};

(function (W) {
  'use strict';
  var U = W.U, S = function () { return W.State; };
  var el = null, queued = false;
  var DRAG_TYPE = 'text/x-whider-task';

  /* Las secciones, por orden de importancia (con su atajo de teclado) */
  var NAV = [
    { id: 'home', label: W.t('Inicio'), icon: 'home', key: '1' },
    { id: 'tasks', label: W.t('Tareas'), icon: 'tasks', key: '2' },
    { id: 'calendar', label: W.t('Calendario'), icon: 'calendar', key: '3' },
    { id: 'notes', label: W.t('Cuaderno'), icon: 'notebook', key: '4' },
    { id: 'friends', label: W.t('Personas'), icon: 'users', key: '5' }
  ];
  // Iconos con su versión rellena para la sección en la que estás
  var FILLED = { home: 1, tasks: 1, calendar: 1, notebook: 1, users: 1 };

  /** Ir a una sección; en Tareas, volver a tocarla vuelve a su vista de siempre */
  function go(id) {
    var st = S();
    if (id === 'tasks' && st.activeScreen === 'tasks' && st.ui.taskView) { W.Screens.tasks.back(); return; }
    W.Router.go(id);
  }

  /** Abre una vista de Tareas: { type: 'smart' | 'list' | 'filter', id } */
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

  /** ¿Se ve Personas? Si la usas, o si alguien te escribe (se elige en la presentación y en Ajustes) */
  function peopleOn(st) {
    var unread = W.Chat ? W.Chat.unreadCount() : 0, reqs = W.People ? W.People.pendingCount() : 0;
    return st.settings.peopleTab !== false || unread + reqs > 0 || st.activeScreen === 'friends' || st.activeScreen === 'chats';
  }

  function render() {
    if (!el) return;
    var st = S(), active = st.activeScreen, td = U.today();
    var overdue = st.overdueAll().length;
    var social = (W.Chat ? W.Chat.unreadCount() : 0) + (W.People ? W.People.pendingCount() : 0);

    var nav = U.el('nav.tb-nav', { attrs: { 'aria-label': W.t('Secciones') } }, NAV.filter(function (n) { return n.id !== 'friends' || peopleOn(st); }).map(function (n) {
      var on = active === n.id || (n.id === 'friends' && active === 'chats');
      var n2 = n.id === 'home' ? overdue : n.id === 'friends' ? social : 0;
      var b = U.el('button.tb-item' + (on ? '.active' : ''), {
        attrs: { type: 'button', 'aria-current': on ? 'page' : null, title: n.label + ' · ' + n.key, 'data-go': n.id },
        on: { click: function () { go(n.id); } }
      }, [
        U.icon(on && FILLED[n.icon] ? n.icon + '-fill' : n.icon, 'sm'),
        U.el('span.tb-label', { text: n.label }),
        n2 ? U.el('span.tb-badge' + (n.id === 'home' ? '.late' : ''), { text: n2 > 99 ? '99+' : String(n2),
          attrs: { title: n.id === 'home' ? U.plural(n2, 'tarea vencida', 'tareas vencidas') : U.plural(n2, 'novedad', 'novedades') } }) : null
      ]);
      if (n.id === 'home') dropTarget(b, function (id) {
        var t = st.find(id); if (!t) return;
        st.updateTask(id, { date: td });
        W.Toast.show({ text: W.t('«{text}» pasa a hoy', { text: t.text }), icon: 'sun' });
      });
      return b;
    }));

    U.clear(el);
    el.appendChild(U.el('div.tb-brand', [
      U.svg('svg', { viewBox: '0 0 64 64', 'aria-hidden': 'true' }, [U.svg('use', { href: '#logo' })]),
      U.el('span', { text: W.t('WHIDER') })
    ]));
    el.appendChild(nav);
    el.appendChild(U.el('div.tb-tools', [
      U.el('button.tb-search', { attrs: { type: 'button', title: W.t('Buscar tareas y acciones · {0}', { 0: W.Layout.keys('K') }) }, on: { click: function () { W.Palette.open(); } } },
        [U.icon('search', 'sm'), U.el('span.tb-search-label', { text: W.t('Buscar') }), U.el('kbd', { text: W.Layout.keys('K') })]),
      U.el('button.btn.primary.tb-new', { attrs: { type: 'button', title: W.t('Nueva tarea · N') }, on: { click: function () { W.App.newTask(); } } },
        [U.icon('plus', 'sm'), U.el('span', { text: W.t('Nueva tarea') })]),
      W.AccountMenu.topButton()
    ]));
    fit();
  }

  /*
   * Que nada se pise: si las herramientas de la derecha (o el logotipo) tocan las secciones del centro, la barra se
   * recoge por pasos: 1) fuera el atajo de buscar; 2) buscar, solo con su icono, y el logotipo sin el nombre de la
   * app; 3) «Nueva tarea», solo con su icono; 4) tu foto sin tu nombre; 5) las secciones, solo con sus iconos (su
   * nombre sigue ahí para los lectores de pantalla). Se mide de verdad porque depende del ancho de la ventana, del
   * tamaño del texto, del idioma, de lo largo que sea tu nombre y, en la app de Windows y macOS, del hueco de los
   * botones de la ventana.
   */
  var STEPS = ['tb-c1', 'tb-c2', 'tb-c3', 'tb-c4', 'tb-c5'];
  function crowded() {
    var nav = el.querySelector('.tb-nav'), tools = el.querySelector('.tb-tools');
    if (!nav || !tools) return false;
    var n = nav.getBoundingClientRect(), t = tools.getBoundingClientRect(), box = el.getBoundingClientRect();
    // Hasta dónde llega: el borde de la barra menos su margen (en Windows y macOS, el hueco de los botones de la ventana)
    var end = box.right - (parseFloat(getComputedStyle(el).paddingRight) || 0);
    return t.left < n.right + 24 || t.right > end + 0.5;
  }
  function fit() {
    if (!el || !W.Layout.desktop || !el.offsetWidth) return;
    STEPS.forEach(function (c) { el.classList.remove(c); });
    for (var i = 0; i < STEPS.length && crowded(); i++) el.classList.add(STEPS[i]);
  }

  var Topbar = {
    DRAG_TYPE: DRAG_TYPE,
    NAV: NAV,
    openView: openView,
    dropTarget: dropTarget,
    /** Solo se dibuja en el ordenador (en el móvil no hace falta: se pintará al pasar a pantalla grande) */
    init: function () {
      el = document.getElementById('topbar');
      if (W.Layout.desktop) render();
      // Al cambiar el ancho de la ventana (y cuando termina de cargar la letra) se vuelve a medir
      var pending = false;
      window.addEventListener('resize', function () {
        if (pending) return;
        pending = true;
        requestAnimationFrame(function () { pending = false; fit(); });
      });
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(fit);
    },
    /** Vuelve a medir si la barra cabe entera */
    fit: fit,
    /** Vuelve a pintar en el siguiente fotograma (varios cambios seguidos = un solo pintado) */
    refresh: function () {
      if (!el || queued || !W.Layout.desktop) return;
      queued = true;
      requestAnimationFrame(function () { queued = false; render(); });
    }
  };

  W.Topbar = Topbar;
  // Su nombre de antes, que siguen usando Tareas, el Calendario, los filtros, la paleta y las filas de tarea
  W.Sidebar = Topbar;
})(window.Whider);
