/**
 * WHIDER · Tarjeta de tarea con gestos:
 *  - Tocar el círculo: completar (animación + sonido)
 *  - Deslizar a la derecha: completar · a la izquierda: eliminar (con Deshacer)
 *  - Tocar la tarjeta: abrir el editor
 */
window.Whider = window.Whider || {};

(function (W) {
  'use strict';
  var U = W.U, S = function () { return W.State; };
  var PCOLORS = { danger: 'var(--p-danger)', purple: 'var(--p-purple)', star: 'var(--p-star)', none: '' };

  var Actions = {
    toggle: function (id, sourceNode) {
      var t = S().find(id);
      if (!t) return;
      var willBeDone = !t.done;
      if (willBeDone) { W.Audio.success(); W.Audio.vibrate([18, 40, 26]); }
      else W.Audio.vibrate([10]);
      var apply = function () {
        S().setDone(id, willBeDone);
        if (willBeDone && t.repeat !== 'none') W.Toast.show({ text: 'Siguiente repetición programada', icon: 'repeat', type: 'success' });
      };
      if (sourceNode && !U.reducedMotion()) setTimeout(apply, 420); else apply();
    },

    remove: function (id) {
      var snap = S().removeTask(id);
      if (!snap) return;
      W.Audio.vibrate([24]);
      W.Toast.show({ text: 'Tarea eliminada', icon: 'trash', action: { label: 'Deshacer', fn: function () { S().restoreTask(snap); } } });
    },

    confirmRemove: function (id) {
      if (!S().settings.confirmDelete) { Actions.remove(id); return Promise.resolve(true); }
      var t = S().find(id);
      return W.Sheet.confirm({ title: '¿Eliminar tarea?', text: t ? '"' + t.text + '"' : '', ok: 'Eliminar', danger: true })
        .then(function (ok) { if (ok) Actions.remove(id); return ok; });
    }
  };

  function metaTags(t) {
    var tags = [], td = U.today();
    if (t.date) {
      var late = S().isOverdue(t);
      tags.push(U.el('span.tag' + (late ? '.late' : t.date === td ? '.today' : ''), [
        U.icon(late ? 'alert' : 'calendar'), U.fmtDay(t.date) + (t.time ? ' · ' + U.fmtTime(t.time) : '')
      ]));
    } else if (t.time) {
      tags.push(U.el('span.tag', [U.icon('clock'), U.fmtTime(t.time)]));
    }
    var list = t.listId ? S().getList(t.listId) : null;
    if (list) tags.push(U.el('span.tag', [U.el('span.dot', { style: { '--c': S().ACCENTS[list.color].a, width: '.45rem', height: '.45rem' } }), list.name]));
    if (t.subtasks.length) {
      var d = t.subtasks.filter(function (s) { return s.done; }).length;
      tags.push(U.el('span.tag', [U.icon('subtask'), d + '/' + t.subtasks.length]));
    }
    if (t.repeat !== 'none') tags.push(U.el('span.tag', { attrs: { title: S().REPEATS[t.repeat] } }, [U.icon('repeat')]));
    if (t.warn && !t.done) tags.push(U.el('span.tag', { attrs: { title: 'Con aviso' } }, [U.icon('bell')]));
    if (t.notes) tags.push(U.el('span.tag', { attrs: { title: 'Con notas' } }, [U.icon('note')]));
    if (t.example) tags.push(U.el('span.tag', { text: 'Ejemplo' }));
    return tags;
  }

  function attachSwipe(card, body, t) {
    var bgR = card.querySelector('.task-swipe-bg.right'), bgL = card.querySelector('.task-swipe-bg.left');
    var sx = 0, sy = 0, dx = 0, mode = null, id = null;
    body.addEventListener('pointerdown', function (e) {
      if (e.button > 0 || e.target.closest('.check')) return;
      sx = e.clientX; sy = e.clientY; dx = 0; mode = 'pending'; id = e.pointerId;
    });
    body.addEventListener('pointermove', function (e) {
      if (!mode || e.pointerId !== id) return;
      var mx = e.clientX - sx, my = e.clientY - sy;
      if (mode === 'pending') {
        if (Math.abs(mx) > 10 && Math.abs(mx) > Math.abs(my) * 1.3) {
          mode = 'drag'; card.classList.add('dragging');
          try { body.setPointerCapture(id); } catch (err) { /* sin captura */ }
        } else if (Math.abs(my) > 10) { mode = null; return; } else return;
      }
      dx = mx;
      var w = card.offsetWidth, limit = Math.min(130, w * 0.32);
      body.style.transform = 'translate3d(' + (dx * (Math.abs(dx) > limit ? 0.6 : 1)) + 'px,0,0)';
      bgR.style.opacity = dx > 0 ? Math.min(1, dx / limit) : 0;
      bgL.style.opacity = dx < 0 ? Math.min(1, -dx / limit) : 0;
      var armedR = dx > limit, armedL = dx < -limit;
      if (armedR !== bgR.classList.contains('armed') || armedL !== bgL.classList.contains('armed')) W.Audio.vibrate([6]);
      bgR.classList.toggle('armed', armedR); bgL.classList.toggle('armed', armedL);
    });
    var end = function (e) {
      if (!mode || (e && e.pointerId !== id)) return;
      var wasDrag = mode === 'drag';
      mode = null;
      card.classList.remove('dragging');
      if (!wasDrag) return;
      var limit = Math.min(130, card.offsetWidth * 0.32);
      if (dx > limit) {
        body.style.transform = '';
        bgR.style.opacity = 0;
        var chk = card.querySelector('.check');
        chk.classList.toggle('on', !t.done); chk.classList.add('pop'); W.Fx.burst(chk);
        Actions.toggle(t.id, card);
      } else if (dx < -limit) {
        body.style.transform = 'translate3d(-110%,0,0)';
        setTimeout(function () { Actions.remove(t.id); }, 220);
      } else {
        body.style.transform = '';
        bgR.style.opacity = 0; bgL.style.opacity = 0;
      }
      card._swiped = true;
      setTimeout(function () { card._swiped = false; }, 50);
    };
    body.addEventListener('pointerup', end);
    body.addEventListener('pointercancel', end);
  }

  /** Crea la tarjeta de una tarea */
  function card(t, opts) {
    opts = opts || {};
    var pc = PCOLORS[t.highlight] || '';
    var check = U.el('button.check' + (t.done ? '.on' : ''), {
      attrs: { 'aria-label': (t.done ? 'Marcar como pendiente: ' : 'Completar: ') + t.text, 'aria-pressed': t.done ? 'true' : 'false' }
    });
    check.appendChild(U.svg('svg', { viewBox: '0 0 24 24' }, [U.svg('path', { d: 'm5 12.5 4.6 4.6L19 7.6' })]));
    check.addEventListener('click', function (e) {
      e.stopPropagation();
      if (node._down && Math.abs(e.clientX - node._down[0]) + Math.abs(e.clientY - node._down[1]) > 12) return;
      check.classList.toggle('on', !t.done);
      check.classList.remove('pop'); void check.offsetWidth; check.classList.add('pop');
      if (!t.done) W.Fx.burst(check);
      Actions.toggle(t.id, check);
    });

    var main = U.el('div.task-main', [U.el('span.task-title', { text: t.text })]);
    if (opts.meta !== false) {
      var tags = metaTags(t);
      if (tags.length) main.appendChild(U.el('div.task-meta', tags));
    }
    if (t.subtasks.length && !t.done) {
      var done = t.subtasks.filter(function (s) { return s.done; }).length;
      main.appendChild(U.el('div.task-sub', [U.el('i', { style: { width: Math.round(done / t.subtasks.length * 100) + '%' } })]));
    }

    var body = U.el('div.task-body', { style: pc ? { '--pc': pc } : null }, [check, main]);
    var node = U.el('li.task' + (t.done ? '.is-done' : '') + (S().isOverdue(t) ? '.overdue' : ''), { attrs: { 'data-id': t.id } }, [
      U.el('div.task-swipe-bg.right', [U.icon(t.done ? 'reset' : 'check')]),
      U.el('div.task-swipe-bg.left', [U.icon('trash')]),
      body
    ]);
    // Un arrastre (aunque empiece sobre el círculo) nunca cuenta como toque
    body.addEventListener('pointerdown', function (e) { node._down = [e.clientX, e.clientY]; }, true);
    body.addEventListener('click', function (e) {
      if (node._swiped) return;
      if (node._down && Math.abs(e.clientX - node._down[0]) + Math.abs(e.clientY - node._down[1]) > 12) return;
      W.Audio.tap();
      W.Editor.open(t.id);
    });
    if (opts.swipe !== false) attachSwipe(node, body, t);
    return node;
  }

  W.TaskCard = { create: card, actions: Actions };
})(window.Whider);
