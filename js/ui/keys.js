/**
 * WHIDER · Atajos de teclado (pensados para el ordenador; en el móvil no estorban).
 *  N nueva tarea · Ctrl/⌘ K o / buscar · 1–9 secciones · P perfil · Ctrl/⌘ , ajustes · ? ayuda
 *  En una lista: ↑ ↓ para moverse, Espacio completa, Intro edita, Supr elimina
 *  Selección: Ctrl/⌘ clic, Mayús clic, Ctrl/⌘ A todas, Esc quitar (las acciones valen para todas)
 *  En el calendario: ← → anterior y siguiente, T hoy, M S A mes, semana y agenda
 *  En un diálogo: Ctrl/⌘ Intro guarda, Esc cierra
 */
window.Whider = window.Whider || {};

(function (W) {
  'use strict';
  var U = W.U, S = function () { return W.State; };
  var SECTIONS = { 1: 'home', 2: 'tasks', 3: 'calendar', 4: 'habits', 5: 'notes', 6: 'focus', 7: 'stats', 8: 'reports', 9: 'automations' };

  function typing() {
    var a = document.activeElement;
    if (!a || a === document.body) return false;
    var tag = a.tagName;
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || a.isContentEditable;
  }
  function overlayOpen() {
    return W.Sheet.isOpen() || (W.AuthScreen && W.AuthScreen.isOpen()) || (W.Onboarding && W.Onboarding.isOpen()) || !!document.querySelector('.celebrate.open');
  }
  /** El botón principal del diálogo de arriba (para Ctrl/⌘ Intro) */
  function topPrimary() {
    var layers = U.$$('#sheetRoot .sheet-layer.open');
    var top = layers[layers.length - 1];
    return top ? top.querySelector('.sheet-foot .btn.primary:not(:disabled)') : null;
  }

  /* ---------- Moverse por las tareas con el teclado ---------- */
  function rows() {
    var root = document.querySelector('.screen.active');
    return root ? U.$$('.task-body', root).filter(function (b) { return b.offsetParent !== null; }) : [];
  }
  function focusRow(body) {
    if (!body) return;
    body.setAttribute('tabindex', '-1');
    body.focus({ preventScroll: true });
    body.scrollIntoView({ block: 'nearest' });
  }
  /**
   * Tras un cambio la lista se vuelve a pintar: devuelve el foco a la misma tarea o a la que
   * ocupa su sitio. Completar espera a la animación de la casilla.
   */
  function refocus(id, index, delay) {
    setTimeout(function () {
      requestAnimationFrame(function () { requestAnimationFrame(function () {
        var list = rows(), same = list.filter(function (b) { var li = b.closest('.task'); return li && li.getAttribute('data-id') === id; })[0];
        if (!document.activeElement || document.activeElement === document.body) focusRow(same || list[Math.min(index, list.length - 1)]);
      }); });
    }, delay || 0);
  }
  function taskKeys(e) {
    var k = e.key, list = rows();
    var cur = document.activeElement && document.activeElement.closest ? document.activeElement.closest('.task-body') : null;
    if (k === 'ArrowDown' || k === 'ArrowUp' || k === 'j' || k === 'k') {
      if (!list.length) return false;
      var i = list.indexOf(cur);
      i = k === 'ArrowDown' || k === 'j' ? (i < 0 ? 0 : Math.min(list.length - 1, i + 1)) : (i <= 0 ? 0 : i - 1);
      focusRow(list[i]);
      return true;
    }
    if (!cur) return false;
    var li = cur.closest('.task'), id = li && li.getAttribute('data-id'), index = list.indexOf(cur);
    if (!id) return false;
    if (k === 'Enter') { W.Editor.open(id); return true; }
    if (li.classList.contains('projected')) return false;
    if (k === ' ' || k === 'x' || k === 'X') {
      var chk = cur.querySelector('.check');
      if (chk) chk.classList.toggle('on');
      W.TaskCard.actions.toggle(id, true);
      refocus(id, index, U.reducedMotion() ? 0 : 320);
      return true;
    }
    if (k === 'Delete' || k === 'Backspace') {
      W.TaskCard.actions.confirmRemove(id).then(function () { refocus(id, index); });
      return true;
    }
    if (k === 'ContextMenu' || (k === 'F10' && e.shiftKey)) {
      var r = cur.getBoundingClientRect();
      W.TaskCard.actions.menu(id, { x: r.left + 48, y: r.top + r.height / 2 });
      return true;
    }
    return false;
  }

  function onKey(e) {
    var k = e.key, mod = e.ctrlKey || e.metaKey;
    if (k === 'Escape') {
      if (typing() && !overlayOpen()) { document.activeElement.blur(); return; }
      W.App.handleBack({ keyboard: true });
      return;
    }
    if (mod && k === 'Enter') { var btn = topPrimary(); if (btn) { e.preventDefault(); btn.click(); } return; }
    if (mod && !e.altKey && (k === 'k' || k === 'K')) {
      e.preventDefault();
      if (!W.Palette.isOpen() && !(W.AuthScreen && W.AuthScreen.isOpen())) { W.Menu.close(); W.Palette.open(); }
      return;
    }
    if (mod && k === ',') { e.preventDefault(); if (!W.Settings.isOpen()) W.Settings.open(); return; }
    if (typing() || overlayOpen() || e.isComposing) return;
    // Ctrl/⌘ A: todas las tareas que se ven en la pantalla
    if (mod && !e.altKey && (k === 'a' || k === 'A') && W.Select && W.Select.all()) { e.preventDefault(); return; }
    if (e.altKey && SECTIONS[k]) { e.preventDefault(); W.Router.go(SECTIONS[k]); return; }
    if (mod || e.altKey) return;

    if (k === 'n' || k === 'N') { e.preventDefault(); W.App.newTask(); return; }
    if (k === '/') { e.preventDefault(); W.Palette.open(); return; }
    if (k === '?') { e.preventDefault(); Keys.help(); return; }
    if (SECTIONS[k]) { e.preventDefault(); W.Router.go(SECTIONS[k]); return; }
    if (k === 'p' || k === 'P') { e.preventDefault(); W.Router.go('progress'); return; }

    var screen = W.Screens[S().activeScreen];
    if (screen && screen.key && screen.key(e)) { e.preventDefault(); return; }
    if (W.Select && W.Select.key(e)) { e.preventDefault(); return; }
    if (taskKeys(e)) e.preventDefault();
  }

  var GROUPS = function () {
    var K = W.Layout.keys;
    return [
      { title: 'General', rows: [
        ['Nueva tarea', ['N']], ['Buscar tareas y acciones', [K('K'), '/']], ['Hoy · Tareas · Calendario', ['1', '2', '3']],
        ['Hábitos · Apuntes · Enfoque', ['4', '5', '6']], ['Estadísticas · Informes · Sistemas', ['7', '8', '9']],
        ['Perfil y resumen', ['P']], ['Ajustes', [K(',')]], ['Atajos de teclado', ['?']], ['Cerrar o volver', ['Esc']]
      ] },
      { title: 'En una página de tareas', rows: [
        ['Moverse entre tareas', ['↑', '↓']], ['Completar o desmarcar', ['Espacio']], ['Abrir el editor', ['Intro']],
        ['Eliminar', ['Supr']], ['Más opciones', null, 'Clic derecho'], ['Cambiar de categoría o pasar a hoy', null, 'Arrástrala a la barra lateral']
      ] },
      { title: 'Varias tareas a la vez', rows: [
        ['Añadir o quitar de la selección', [K('clic')]], ['Seleccionar un tramo', ['Mayús', 'clic']], ['Seleccionar todas', [K('A')]],
        ['Completar las seleccionadas', ['Espacio']], ['Eliminar las seleccionadas', ['Supr']], ['Quitar la selección', ['Esc']],
        ['Mover todas a otra categoría o día', null, 'Arrastra cualquiera de ellas']
      ] },
      { title: 'En el calendario', rows: [
        ['Anterior y siguiente', ['←', '→']], ['Ir a hoy', ['T']], ['Mes · semana · día · agenda', ['M', 'S', 'D', 'A']],
        ['Cambiar de día o de hora una tarea', null, 'Arrástrala'], ['Cambiar la duración', null, 'Estira el bloque por abajo']
      ] },
      { title: 'Al escribir una tarea', rows: [
        ['Guardar', [K('Intro')]], ['Añadir y seguir escribiendo', ['Intro']], ['Cerrar', ['Esc']]
      ] }
    ];
  };

  var Keys = {
    init: function () { window.addEventListener('keydown', onKey); },
    help: function () {
      var body = GROUPS().map(function (g) {
        return W.UI.section({ header: g.title, items: g.rows.map(function (r) {
          return U.el('div.cell.keys-row', [U.el('span', { text: r[0] }),
            r[1] ? U.el('span.keys', r[1].map(function (key) { return U.el('kbd', { text: key }); })) : U.el('span.keys-text', { text: r[2] })]);
        }) });
      });
      W.Sheet.open({ title: 'Atajos de teclado', className: 'shortcuts', body: body });
    }
  };

  W.Keys = Keys;
})(window.Whider);
