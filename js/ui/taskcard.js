/**
 * WHIDER · Tarjeta de tarea (diseño tranquilo y ligero)
 *  - Tocar el círculo: completar · tocar la tarjeta: editar
 *  - Deslizar → completar · deslizar ← eliminar (con Deshacer)
 * La información secundaria es una sola línea de texto, sin "pastillas".
 */
window.Whider = window.Whider || {};

(function (W) {
  'use strict';
  var U = W.U, S = function () { return W.State; };
  var PCOLORS = { danger: 'var(--p-danger)', purple: 'var(--p-purple)', star: 'var(--p-star)', none: '' };

  var Actions = {
    toggle: function (id, animated) {
      var t = S().find(id);
      if (!t) return;
      var willBeDone = !t.done;
      if (willBeDone) { W.Audio.success(); W.Audio.vibrate([14, 30, 18]); }
      else W.Audio.vibrate([8]);
      var apply = function () { S().setDone(id, willBeDone); };
      if (animated && !U.reducedMotion()) setTimeout(apply, 260); else apply();
    },
    remove: function (id) {
      var snap = S().removeTask(id);
      if (!snap) return;
      W.Audio.vibrate([16]);
      W.Toast.show({ text: 'Tarea eliminada', icon: 'trash', action: { label: 'Deshacer', fn: function () { S().restoreTask(snap); } } });
    },
    confirmRemove: function (id) {
      if (!S().settings.confirmDelete) { Actions.remove(id); return Promise.resolve(true); }
      var t = S().find(id);
      return W.Sheet.confirm({ title: '¿Eliminar tarea?', text: t ? '"' + t.text + '"' : '', ok: 'Eliminar', danger: true })
        .then(function (ok) { if (ok) Actions.remove(id); return ok; });
    },
    /** Posponer con opciones sencillas */
    postpone: function (id) {
      var now = new Date(), opts = [{ value: 60, label: 'Dentro de 1 hora', icon: 'clock' }];
      if (now.getHours() < 17) opts.push({ value: 'evening', label: 'Esta tarde (18:00)', icon: 'sun' });
      opts.push({ value: 'tomorrow', label: 'Mañana', icon: 'calendar' });
      opts.push({ value: 'edit', label: 'Elegir fecha y hora…', icon: 'edit' });
      W.Sheet.choose({ title: 'Posponer', options: opts }).then(function (v) {
        if (v === undefined) return;
        if (v === 'edit') { W.Editor.open(id); return; }
        if (v === 'tomorrow') S().moveToTomorrow(id);
        else if (v === 'evening') S().updateTask(id, { date: U.today(), time: '18:00' });
        else S().snooze(id, v);
        W.Audio.tap();
      });
    }
  };

  /** Línea de detalles: "Hoy · 10:30 · ● Trabajo · 1/3 · ↻ · 🔔" (lo que no aporta, no se muestra) */
  function metaLine(t, ctx) {
    var parts = [], st = S(), late = st.isOverdue(t);
    var showDay = t.date && !(ctx === 'today' && t.date === U.today());
    var when = (showDay ? U.fmtDay(t.date) : '') + (t.time ? (showDay ? ' · ' : '') + U.fmtTime(t.time) : '');
    if (ctx === 'alerts' && late) when = 'Venció ' + U.fmtRel(U.deadlineTs(t.date, t.time) - Date.now());
    if (when) parts.push(U.el('span' + (late ? '.late' : ''), { text: when }));
    var list = t.listId ? st.getList(t.listId) : null;
    if (list && ctx !== 'list') parts.push(U.el('span.m-list', [U.el('i', { style: { background: st.ACCENTS[list.color].a } }), list.name]));
    if (t.subtasks.length) parts.push(U.el('span', { text: t.subtasks.filter(function (s) { return s.done; }).length + '/' + t.subtasks.length }));
    var icons = [];
    if (t.repeat !== 'none') icons.push(U.icon('repeat', 'xs'));
    if (t.warn && !t.done) icons.push(U.icon('bell', 'xs'));
    if (t.notes) icons.push(U.icon('note', 'xs'));
    if (icons.length) parts.push(U.el('span.m-icons', icons));
    if (!parts.length) return null;
    var line = U.el('div.task-meta');
    parts.forEach(function (p, i) { if (i) line.appendChild(U.el('span.sep', { text: '·' })); line.appendChild(p); });
    return line;
  }

  function attachSwipe(card, body, t) {
    var sx = 0, sy = 0, dx = 0, mode = null, id = null, bgR = null, bgL = null, limit = 110;
    var ensureBg = function () {
      if (bgR) return;
      bgR = U.el('div.task-swipe-bg.right', [U.icon(t.done ? 'reset' : 'check')]);
      bgL = U.el('div.task-swipe-bg.left', [U.icon('trash')]);
      card.insertBefore(bgL, body); card.insertBefore(bgR, bgL);
    };
    body.addEventListener('pointerdown', function (e) {
      if (e.button > 0 || e.target.closest('.check, button')) return;
      sx = e.clientX; sy = e.clientY; dx = 0; mode = 'pending'; id = e.pointerId;
    });
    body.addEventListener('pointermove', function (e) {
      if (!mode || e.pointerId !== id) return;
      var mx = e.clientX - sx, my = e.clientY - sy;
      if (mode === 'pending') {
        if (Math.abs(mx) > 12 && Math.abs(mx) > Math.abs(my) * 1.4) {
          mode = 'drag'; ensureBg(); card.classList.add('dragging');
          limit = Math.min(120, card.offsetWidth * 0.3);
          try { body.setPointerCapture(id); } catch (err) { /* sin captura */ }
        } else if (Math.abs(my) > 10) { mode = null; return; } else return;
      }
      dx = mx;
      body.style.transform = 'translate3d(' + (dx * (Math.abs(dx) > limit ? 0.55 : 1)) + 'px,0,0)';
      bgR.style.opacity = dx > 0 ? Math.min(1, dx / limit) : 0;
      bgL.style.opacity = dx < 0 ? Math.min(1, -dx / limit) : 0;
      var armR = dx > limit, armL = dx < -limit;
      if (armR !== bgR.classList.contains('armed') || armL !== bgL.classList.contains('armed')) W.Audio.vibrate([5]);
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
        body.style.transform = ''; bgR.style.opacity = 0;
        var chk = card.querySelector('.check');
        chk.classList.toggle('on', !t.done);
        Actions.toggle(t.id, true);
        if (W.Tips) W.Tips.mark('swipe');
      } else if (dx < -limit) {
        body.style.transform = 'translate3d(-110%,0,0)';
        setTimeout(function () { Actions.remove(t.id); }, 180);
      } else {
        body.style.transform = ''; bgR.style.opacity = 0; bgL.style.opacity = 0;
      }
    };
    body.addEventListener('pointerup', end);
    body.addEventListener('pointercancel', end);
  }

  /** create(tarea, { ctx: 'today'|'list'|..., swipe, highlight }) */
  function create(t, opts) {
    opts = opts || {};
    var pc = PCOLORS[t.highlight] || '';
    var check = U.el('button.check' + (t.done ? '.on' : ''), {
      attrs: { 'aria-label': (t.done ? 'Marcar como pendiente: ' : 'Completar: ') + t.text, 'aria-pressed': t.done ? 'true' : 'false' }
    });
    check.appendChild(U.svg('svg', { viewBox: '0 0 24 24' }, [U.svg('path', { d: 'm5 12.5 4.6 4.6L19 7.6' })]));
    var main = U.el('div.task-main', [U.el('span.task-title', { text: t.text })]);
    var meta = metaLine(t, opts.ctx);
    if (meta) main.appendChild(meta);
    var body = U.el('div.task-body', { style: pc ? { '--pc': pc } : null }, [check, main]);
    var node = U.el('li.task' + (t.done ? '.is-done' : '') + (S().isOverdue(t) ? '.overdue' : '') + (opts.highlight ? '.next' : ''), { attrs: { 'data-id': t.id } }, [body]);

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
    if (opts.swipe !== false) attachSwipe(node, body, t);
    return node;
  }

  W.TaskCard = { create: create, actions: Actions };
})(window.Whider);
