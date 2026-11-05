/**
 * WHIDER · Fila de tarea
 *  - Tocar el círculo: completar · tocar la fila: editar
 *  - Deslizar → completar · deslizar ← eliminar (con Deshacer)
 *  - En el ordenador: clic derecho para más opciones y arrastrar la tarea a una lista,
 *    a «Hoy» o a un día del calendario
 * La prioridad se ve en la luz: el borde de la casilla brilla más y a la derecha se encienden
 * una, dos o tres barras (destacada · importante · urgente).
 */
window.Whider = window.Whider || {};

(function (W) {
  'use strict';
  var U = W.U, S = function () { return W.State; };
  var PRIO_CLS = { danger: '.p-danger', purple: '.p-purple', star: '.p-star', none: '' };
  var PRIO_NAME = { danger: 'urgente', purple: 'importante', star: 'destacada' };

  var Actions = {
    toggle: function (id, animated) {
      var t = S().find(id);
      if (!t) return;
      var willBeDone = !t.done;
      if (willBeDone) { W.Audio.success(); W.Audio.vibrate([12]); }
      else W.Audio.select();
      var apply = function () { S().setDone(id, willBeDone); };
      if (animated && !U.reducedMotion()) setTimeout(apply, 280); else apply();
    },
    remove: function (id) {
      var snap = S().removeTask(id);
      if (!snap) return;
      W.Audio.select();
      W.Toast.show({ text: 'Tarea eliminada', icon: 'trash', action: { label: 'Deshacer', fn: function () { S().restoreTask(snap); } } });
    },
    confirmRemove: function (id) {
      if (!S().settings.confirmDelete) { Actions.remove(id); return Promise.resolve(true); }
      var t = S().find(id);
      return W.Sheet.confirm({ title: '¿Eliminar la tarea?', text: t ? '«' + t.text + '»' : '', ok: 'Eliminar', danger: true })
        .then(function (ok) { if (ok) Actions.remove(id); return ok; });
    },
    /** Posponer con opciones sencillas (menú junto al botón) */
    postpone: function (id, anchor) {
      var now = new Date(), opts = [{ value: 60, label: 'Dentro de 1 hora', icon: 'clock' }];
      if (now.getHours() < 17) opts.push({ value: 'evening', label: 'Esta tarde', desc: 'Hoy a las ' + U.fmtTime('18:00'), icon: 'sun' });
      opts.push({ value: 'tomorrow', label: 'Mañana', icon: 'calendar' });
      opts.push({ value: 'edit', label: 'Elegir fecha y hora…', icon: 'edit', gap: true });
      var pick = anchor ? W.Menu.open(anchor, opts) : W.Sheet.choose({ title: 'Posponer', options: opts });
      pick.then(function (v) {
        if (v === undefined) return;
        if (v === 'edit') { W.Editor.open(id); return; }
        if (v === 'tomorrow') S().moveToTomorrow(id);
        else if (v === 'evening') S().updateTask(id, { date: U.today(), time: '18:00' });
        else S().snooze(id, v);
        W.Toast.show({ text: 'Tarea pospuesta', icon: 'clock' });
      });
    },
    /** Menú del botón derecho (o de la tecla de menú) */
    menu: function (id, at) {
      var st = S(), t = st.find(id);
      if (!t) return;
      var td = U.today(), next = U.addDays(td, (8 - new Date().getDay()) % 7 || 7);
      var items = [
        { value: 'toggle', label: t.done ? 'Marcar como pendiente' : 'Completar', icon: t.done ? 'reset' : 'check' },
        { value: 'edit', label: 'Editar…', icon: 'edit' }
      ];
      if (!t.done) {
        items.push({ value: 'today', label: 'Para hoy', icon: 'sun', gap: true, on: t.date === td });
        items.push({ value: 'tomorrow', label: 'Para mañana', icon: 'calendar', on: t.date === U.addDays(td, 1) });
        items.push({ value: 'monday', label: 'Para el lunes', desc: U.fmtLong(next), icon: 'week', on: t.date === next });
        items.push({ value: 'prio', label: 'Prioridad…', icon: 'flag', gap: true });
        items.push({ value: 'list', label: 'Mover a otra lista…', icon: 'list' });
        items.push({ value: 'focus', label: 'Enfocarme en esta tarea', icon: 'target' });
      }
      items.push({ value: 'delete', label: 'Eliminar', icon: 'trash', destructive: true, gap: true });
      var again = function (list) { return new Promise(function (r) { setTimeout(function () { r(W.Menu.open(at, list)); }, 40); }); };
      W.Menu.open(at, items).then(function (v) {
        if (!v) return;
        if (v === 'toggle') Actions.toggle(id, false);
        else if (v === 'edit') W.Editor.open(id);
        else if (v === 'today') st.updateTask(id, { date: td });
        else if (v === 'tomorrow') st.updateTask(id, { date: U.addDays(td, 1) });
        else if (v === 'monday') st.updateTask(id, { date: next });
        else if (v === 'prio') again(W.Editor.PRIO_OPTS.map(function (o) { return { value: o.value, label: o.label, prio: o.value, on: o.value === t.highlight }; }))
          .then(function (h) { if (h) st.updateTask(id, { highlight: h }); });
        else if (v === 'list') again([{ value: '', label: 'Sin lista', on: !t.listId }].concat(st.lists.map(function (l) { return { value: l.id, label: l.name, icon: 'list', on: l.id === t.listId }; })))
          .then(function (l) { if (l !== undefined) st.updateTask(id, { listId: l || null }); });
        else if (v === 'focus') { W.Screens.focus.linkTask(id); W.Router.go('focus'); }
        else if (v === 'delete') Actions.confirmRemove(id);
      });
    }
  };

  /** Arrastrar con el ratón (ordenador): se suelta en una lista, en «Hoy» o en un día del calendario */
  function attachDragDrop(node, t) {
    node.draggable = true;
    node.addEventListener('dragstart', function (e) {
      if (!e.dataTransfer) return;
      e.dataTransfer.setData(W.Sidebar.DRAG_TYPE, t.id);
      e.dataTransfer.setData('text/plain', t.text);
      e.dataTransfer.effectAllowed = 'move';
      node.classList.add('drag-src');
      requestAnimationFrame(function () { document.body.classList.add('dnd'); });
    });
    node.addEventListener('dragend', function () { node.classList.remove('drag-src'); document.body.classList.remove('dnd'); });
  }

  /** Línea de detalles: "Mañana, 10:30 · Trabajo · 1/3 · ↻" (lo que no aporta, no se muestra) */
  function metaLine(t, ctx) {
    var parts = [], st = S(), late = st.isOverdue(t);
    var showDay = t.date && (ctx === 'alerts' || (!(ctx === 'today' && t.date === U.today()) && ctx !== 'day'));
    var day = showDay ? U.fmtDay(t.date) : '', time = t.time && ctx !== 'day' ? U.fmtTime(t.time) : '';
    if (t.done && t.doneOn && ctx === 'done') { day = 'Completada ' + U.fmtDay(t.doneOn).toLowerCase(); time = ''; }
    if (day || time) parts.push(U.el('span' + (late ? '.late' : ''), [day + (day && time ? ', ' : ''), time ? U.el('span.m-num', { text: time }) : null]));
    var list = t.listId ? st.getList(t.listId) : null;
    if (list && ctx !== 'list') parts.push(U.el('span', { text: list.name }));
    if (t.subtasks.length) parts.push(U.el('span.m-num', { text: t.subtasks.filter(function (s) { return s.done; }).length + '/' + t.subtasks.length }));
    var icons = [];
    if (ctx === 'alerts') icons = null;   // en Vencidas basta con la fecha resaltada
    else if (t.repeat !== 'none') icons.push(U.icon('repeat', 'xs'));
    if (icons && t.warn && !t.done) icons.push(U.icon('bell', 'xs'));
    if (icons && t.notes) icons.push(U.icon('note', 'xs'));
    if (icons && icons.length) parts.push(U.el('span.m-icons', icons));
    if (!parts.length) return null;
    var line = U.el('div.task-meta');
    parts.forEach(function (p, i) { if (i) line.appendChild(U.el('span.sep', { text: '·' })); line.appendChild(p); });
    return line;
  }

  function attachSwipe(card, body, t) {
    var sx = 0, sy = 0, dx = 0, mode = null, id = null, bgR = null, bgL = null, limit = 96;
    var ensureBg = function () {
      if (bgR) return;
      bgR = U.el('div.task-swipe-bg.right', [U.icon(t.done ? 'reset' : 'check'), U.el('span', { text: t.done ? 'Pendiente' : 'Completar' })]);
      bgL = U.el('div.task-swipe-bg.left', [U.el('span', { text: 'Eliminar' }), U.icon('trash')]);
      card.insertBefore(bgL, body); card.insertBefore(bgR, bgL);
    };
    body.addEventListener('pointerdown', function (e) {
      // También se puede empezar a deslizar desde el círculo (un toque sin mover sigue completando)
      if (e.button > 0 || e.target.closest('button:not(.check)')) return;
      sx = e.clientX; sy = e.clientY; dx = 0; mode = 'pending'; id = e.pointerId;
    });
    body.addEventListener('pointermove', function (e) {
      if (!mode || e.pointerId !== id) return;
      var mx = e.clientX - sx, my = e.clientY - sy;
      if (mode === 'pending') {
        if (Math.abs(mx) > 12 && Math.abs(mx) > Math.abs(my) * 1.4) {
          mode = 'drag'; ensureBg(); card.classList.add('dragging');
          limit = Math.min(110, card.offsetWidth * 0.28);
          try { body.setPointerCapture(id); } catch (err) { /* sin captura */ }
        } else if (Math.abs(my) > 10) { mode = null; return; } else return;
      }
      dx = mx;
      body.style.transform = 'translate3d(' + (dx * (Math.abs(dx) > limit ? 0.6 : 1)) + 'px,0,0)';
      bgR.style.visibility = dx > 0 ? 'visible' : 'hidden';
      bgL.style.visibility = dx < 0 ? 'visible' : 'hidden';
      var armR = dx > limit, armL = dx < -limit;
      if (armR !== bgR.classList.contains('armed') || armL !== bgL.classList.contains('armed')) W.Audio.select();
      bgR.classList.toggle('armed', armR); bgL.classList.toggle('armed', armL);
    });
    var end = function (e) {
      if (!mode || (e && e.pointerId !== id)) return;
      var wasDrag = mode === 'drag';
      mode = null;
      card.classList.remove('dragging');
      if (!wasDrag) return;
      card._swiped = true;
      setTimeout(function () { card._swiped = false; }, 60);
      if (dx > limit) {
        body.style.transform = '';
        var chk = card.querySelector('.check');
        chk.classList.toggle('on', !t.done);
        Actions.toggle(t.id, true);
        if (W.Tips) W.Tips.mark('swipe');
      } else if (dx < -limit) {
        body.style.transform = 'translate3d(-110%,0,0)';
        setTimeout(function () { Actions.remove(t.id); }, 200);
      } else {
        body.style.transform = '';
      }
    };
    body.addEventListener('pointerup', end);
    body.addEventListener('pointercancel', end);
  }

  /** create(tarea, { ctx: 'today'|'list'|'day'|'alerts'|'done', swipe, postpone, time }) */
  function create(t, opts) {
    opts = opts || {};
    var check = U.el('button.check' + (PRIO_CLS[t.highlight] || '') + (t.done ? '.on' : ''), {
      attrs: { 'aria-label': (t.done ? 'Marcar como pendiente: ' : 'Completar: ') + t.text + (PRIO_NAME[t.highlight] ? ' (' + PRIO_NAME[t.highlight] + ')' : ''), 'aria-pressed': t.done ? 'true' : 'false' }
    });
    check.appendChild(U.svg('svg', { viewBox: '0 0 24 24' }, [U.svg('path', { d: 'm5 12.6 4.5 4.5L19 7.6' })]));
    var title = U.el('span.task-title', { text: t.text });
    var main = U.el('div.task-main', [title]);
    var meta = metaLine(t, opts.ctx);
    if (meta) main.appendChild(meta);
    var trail = [];
    if (PRIO_NAME[t.highlight] && !t.done) trail.push(W.UI.prio(t.highlight));
    if (opts.postpone && !t.done) {
      trail.push(U.el('button.btn.xs.soft', { text: 'Posponer', on: { click: function (e) { e.stopPropagation(); Actions.postpone(t.id, e.currentTarget); } } }));
    }
    var body = U.el('div.task-body', [
      opts.time !== undefined ? U.el('span.tl-time', { text: opts.time }) : null,
      check, main,
      trail.length ? U.el('div.task-trail', trail) : null
    ]);
    var node = U.el('li.task' + (t.done ? '.is-done' : '') + (S().isOverdue(t) ? '.overdue' : ''), { attrs: { 'data-id': t.id } }, [body]);
    body.setAttribute('tabindex', '-1');
    node.addEventListener('contextmenu', function (e) { e.preventDefault(); Actions.menu(t.id, { x: e.clientX, y: e.clientY }); });

    var moved = function (e) { return node._down && Math.abs(e.clientX - node._down[0]) + Math.abs(e.clientY - node._down[1]) > 12; };
    body.addEventListener('pointerdown', function (e) { node._down = [e.clientX, e.clientY]; }, true);
    check.addEventListener('click', function (e) {
      e.stopPropagation();
      if (moved(e)) return;
      check.classList.toggle('on', !t.done);
      check.classList.remove('pop'); void check.offsetWidth; check.classList.add('pop');
      Actions.toggle(t.id, true);
    });
    body.addEventListener('click', function (e) {
      if (node._swiped || moved(e)) return;
      W.Editor.open(t.id);
    });
    // Con ratón se arrastra a otro sitio; con el dedo se desliza para completar o eliminar
    if (W.Layout && W.Layout.desktop) { if (!t.done) attachDragDrop(node, t); }
    else if (opts.swipe !== false) attachSwipe(node, body, t);
    return node;
  }

  /** Lista agrupada de tareas */
  function list(tasks, opts) {
    var ul = U.el('ul.task-list');
    var frag = document.createDocumentFragment();
    tasks.forEach(function (t) { frag.appendChild(create(t, typeof opts === 'function' ? opts(t) : opts)); });
    ul.appendChild(frag);
    return ul;
  }

  W.TaskCard = { create: create, list: list, actions: Actions, metaLine: metaLine };
})(window.Whider);
