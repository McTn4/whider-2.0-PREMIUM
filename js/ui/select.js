/**
 * WHIDER · Varias tareas a la vez (gestión masiva)
 *
 *  - Ordenador: Ctrl/⌘ clic añade o quita una tarea, Mayús clic selecciona un tramo,
 *    Ctrl/⌘ A todas las que se ven y Esc quita la selección. La barra de abajo cambia
 *    a la vez fecha, hora, prioridad, categoría, repetición y avisos, duplica, completa o
 *    elimina (siempre con Deshacer). Arrastrar una tarea seleccionada mueve todas.
 *  - Móvil: «Seleccionar» en el menú de una página de tareas o mantener pulsada una tarea.
 *    Acciones básicas: completar, mover de categoría y eliminar.
 */
window.Whider = window.Whider || {};

(function (W) {
  'use strict';
  var U = W.U, S = function () { return W.State; };
  var sel = {}, anchor = null, mode = false, bar = null, startedAt = 0;

  function desk() { return W.Layout.desktop; }
  function ids() { var st = S(); return Object.keys(sel).filter(function (id) { return !!st.find(id); }); }
  function count() { return ids().length; }

  /** Tareas visibles en la pantalla actual, en orden */
  function visible() {
    var root = document.querySelector('.screen.active');
    if (!root) return [];
    var seen = {}, out = [];
    U.$$('.task[data-id]', root).forEach(function (li) {
      if (li.classList.contains('projected') || li.offsetParent === null) return;
      var id = li.getAttribute('data-id');
      if (!seen[id]) { seen[id] = true; out.push(id); }
    });
    return out;
  }

  function paint() {
    var on = mode || count() > 0;
    U.$$('.task[data-id]').forEach(function (li) { li.classList.toggle('selected', !!sel[li.getAttribute('data-id')]); });
    document.body.classList.toggle('selecting', on);
    document.body.classList.toggle('select-mode', mode && !desk());
    drawBar();
  }

  function toggle(id) { if (sel[id]) delete sel[id]; else sel[id] = true; anchor = id; W.Audio.select(); paint(); }
  function range(a, b) {
    var vis = visible(), i = vis.indexOf(a), j = vis.indexOf(b);
    if (i < 0 || j < 0) { toggle(b); return; }
    for (var k = Math.min(i, j); k <= Math.max(i, j); k++) sel[vis[k]] = true;
    W.Audio.select(); paint();
  }

  /* ---------- Acciones ---------- */
  /** Cambia campos de todas (con Deshacer): fields es un objeto o fn(tarea) → objeto */
  function apply(fields, label, icon) {
    var st = S(), list = ids();
    if (!list.length) return;
    var before = {};
    list.forEach(function (id) {
      var t = st.find(id), f = typeof fields === 'function' ? fields(t) : fields, prev = {};
      Object.keys(f).forEach(function (k) { prev[k] = t[k]; });
      before[id] = prev;
    });
    var n = st.bulkUpdate(list, fields);
    W.Audio.success();
    W.Toast.show({ text: U.plural(n, 'tarea', 'tareas') + ' · ' + label, icon: icon || 'check',
      action: { label: 'Deshacer', fn: function () { st.bulkUpdate(Object.keys(before), function (t) { return before[t.id]; }); } } });
  }

  function complete() {
    var st = S(), list = ids();
    if (!list.length) return;
    var allDone = list.every(function (id) { return st.find(id).done; });
    var target = !allDone, changed = list.filter(function (id) { return st.find(id).done !== target; });
    st.batch(function () { changed.forEach(function (id) { st.setDone(id, target); }); });
    if (target) { W.Audio.success(); W.Audio.vibrate([12]); } else W.Audio.select();
    W.Toast.show({ text: U.plural(changed.length, 'tarea', 'tareas') + (target ? ' completadas' : ' pendientes de nuevo'), icon: target ? 'check' : 'reset',
      action: { label: 'Deshacer', fn: function () { st.batch(function () { changed.forEach(function (id) { st.setDone(id, !target); }); }); } } });
    clear();
  }

  function remove() {
    var st = S(), list = ids();
    if (!list.length) return Promise.resolve(false);
    var go = function () {
      var snaps = st.bulkRemove(list);
      W.Audio.select();
      W.Toast.show({ text: U.plural(snaps.length, 'tarea eliminada', 'tareas eliminadas'), icon: 'trash',
        action: { label: 'Deshacer', fn: function () { st.bulkRestore(snaps); } } });
      clear();
      return true;
    };
    if (!st.settings.confirmDelete) return Promise.resolve(go());
    return W.Sheet.confirm({ title: '¿Eliminar ' + U.plural(list.length, 'tarea', 'tareas') + '?', text: 'Podrás deshacerlo justo después.', ok: 'Eliminar', danger: true })
      .then(function (ok) { return ok ? go() : false; });
  }

  function duplicate() {
    var st = S(), list = ids();
    var copies = list.map(function (id) {
      var t = JSON.parse(JSON.stringify(st.find(id)));
      delete t.id; t.done = false; t.doneOn = null; t.doneAt = null; t.spawnedId = null; t.warnedAt = null; t.remindedAt = null;
      t.focusMin = 0; t.createdAt = Date.now();
      t.subtasks = t.subtasks.map(function (s) { return { text: s.text, done: false }; });
      return t;
    });
    var n = st.importTasks(copies);
    W.Toast.show({ text: U.plural(n, 'tarea duplicada', 'tareas duplicadas'), icon: 'layers' });
    clear();
  }

  function pickDate(anchorEl) {
    var td = U.today(), wd = new Date().getDay(), monday = U.addDays(td, (8 - wd) % 7 || 7);
    return W.Menu.open(anchorEl, [
      { value: td, label: 'Hoy', icon: 'sun' },
      { value: U.addDays(td, 1), label: 'Mañana', icon: 'calendar' },
      { value: monday, label: 'El lunes', desc: U.fmtLong(monday), icon: 'week' },
      { value: U.addDays(td, 7), label: 'Dentro de una semana', icon: 'calendar' },
      { value: 'pick', label: 'Elegir un día…', icon: 'edit', gap: true },
      { value: 'none', label: 'Sin fecha', icon: 'close' }
    ]).then(function (v) {
      if (!v) return;
      if (v === 'none') return apply({ date: null, time: null }, 'sin fecha', 'calendar');
      if (v !== 'pick') return apply({ date: v }, U.fmtDay(v).toLowerCase(), 'calendar');
      var chosen = td;
      var s = W.Sheet.open({ title: 'Elegir un día', body: [U.el('div.group', [W.UI.datePicker(td, function (ds) { chosen = ds; })])],
        foot: [U.el('button.btn.primary', { text: 'Aplicar', on: { click: function () { s.close(); apply({ date: chosen }, U.fmtDay(chosen).toLowerCase(), 'calendar'); } } })] });
    });
  }

  function pickTime(anchorEl) {
    var opts = ['09:00', '12:00', '15:00', '18:00', '20:00'].map(function (t) { return { value: t, label: U.fmtTime(t), icon: 'clock' }; });
    opts.push({ value: 'pick', label: 'Otra hora…', icon: 'edit', gap: true });
    opts.push({ value: 'none', label: 'Sin hora', icon: 'close' });
    return W.Menu.open(anchorEl, opts).then(function (v) {
      if (!v) return;
      if (v === 'none') return apply({ time: null }, 'sin hora', 'clock');
      if (v !== 'pick') return apply(function (t) { return { time: v, date: t.date || U.today() }; }, 'a las ' + U.fmtTime(v), 'clock');
      var input = U.el('input.input', { attrs: { type: 'time', 'aria-label': 'Hora' } });
      input.value = '10:00';
      var s = W.Sheet.open({ title: 'Elegir la hora', body: [input],
        foot: [U.el('button.btn.primary', { text: 'Aplicar', on: { click: function () {
          var hm = input.value; s.close();
          if (hm) apply(function (t) { return { time: hm, date: t.date || U.today() }; }, 'a las ' + U.fmtTime(hm), 'clock');
        } } })] });
      setTimeout(function () { input.focus(); }, 60);
    });
  }

  function pickPrio(anchorEl) {
    return W.Menu.open(anchorEl, W.Editor.PRIO_OPTS.map(function (o) { return { value: o.value, label: o.label, prio: o.value }; })).then(function (v) {
      if (v) apply({ highlight: v }, 'prioridad ' + S().PRIORITIES[v].label.toLowerCase(), 'flag');
    });
  }

  function pickList(anchorEl) {
    var st = S();
    return W.Menu.open(anchorEl, st.lists.map(function (l) { return { value: l.id, label: l.name, icon: W.Lists.icon(l) }; })
      .concat([{ value: '-', label: 'Sin categoría', icon: 'close', gap: true }])).then(function (v) {
      if (!v) return;
      var l = st.getList(v);
      apply({ listId: v === '-' ? null : v }, l ? 'en ' + l.name : 'sin categoría', 'list');
    });
  }

  function pickRepeat(anchorEl) {
    var R = S().REPEATS;
    return W.Menu.open(anchorEl, Object.keys(R).map(function (k) { return { value: k, label: R[k], icon: k === 'none' ? 'close' : 'repeat' }; })).then(function (v) {
      if (v) apply(function (t) { return { repeat: v, date: v !== 'none' && !t.date ? U.today() : t.date }; }, R[v].toLowerCase(), 'repeat');
    });
  }

  function pickWarn(anchorEl) {
    return W.Menu.open(anchorEl, [{ value: 'on', label: 'Activar los avisos', icon: 'bell' }, { value: 'off', label: 'Quitar los avisos', icon: 'close' }]).then(function (v) {
      if (v) apply({ warn: v === 'on' }, v === 'on' ? 'con avisos' : 'sin avisos', 'bell');
    });
  }

  /* ---------- Barra de acciones ---------- */
  function btn(icon, label, fn, cls) {
    var b = U.el('button.bb-btn' + (cls ? '.' + cls : ''), { attrs: { type: 'button', title: label, 'aria-label': label } }, [U.icon(icon), U.el('span', { text: label })]);
    b.addEventListener('click', function (e) { e.stopPropagation(); fn(b); });
    return b;
  }

  function drawBar() {
    var n = count(), on = mode || n > 0;
    if (!bar) {
      if (!on) return;
      bar = U.el('div.bulkbar', { attrs: { role: 'toolbar', 'aria-label': 'Acciones para las tareas seleccionadas' } });
      document.body.appendChild(bar);
    }
    U.clear(bar);
    bar.classList.toggle('show', on);
    bar.classList.toggle('desk', desk());
    if (!on) return;
    var st = S(), list = ids(), allDone = n > 0 && list.every(function (id) { return st.find(id).done; });
    var head = U.el('div.bb-head', [
      U.el('button.bb-close', { attrs: { type: 'button', 'aria-label': 'Quitar la selección', title: 'Quitar la selección · Esc' }, on: { click: function () { clear(); } } }, [U.icon('close')]),
      U.el('strong', { text: n ? U.plural(n, 'seleccionada', 'seleccionadas') : 'Toca las tareas' }),
      U.el('button.link-btn.bb-all', { text: 'Todas', on: { click: function () { Select.all(); } } })
    ]);
    var acts = U.el('div.bb-acts');
    var dis = !n;
    var add = function (b) { if (dis) b.disabled = true; acts.appendChild(b); };
    add(btn(allDone ? 'reset' : 'check', allDone ? 'Pendientes' : 'Completar', complete, 'main'));
    if (desk()) {
      add(btn('calendar', 'Fecha', pickDate));
      add(btn('clock', 'Hora', pickTime));
      add(btn('flag', 'Prioridad', pickPrio));
      add(btn('list', 'Categoría', pickList));
      add(btn('repeat', 'Repetir', pickRepeat));
      add(btn('bell', 'Avisos', pickWarn));
      add(btn('layers', 'Duplicar', duplicate));
    } else {
      add(btn('calendar', 'Para hoy', function () { apply({ date: U.today() }, 'para hoy', 'sun'); }));
      add(btn('list', 'Mover', pickList));
    }
    add(btn('trash', 'Eliminar', function () { remove(); }, 'danger'));
    bar.appendChild(head);
    bar.appendChild(acts);
  }

  function clear(silent) {
    var had = mode || count() > 0;
    sel = {}; anchor = null; mode = false;
    if (had || !silent) paint();
    return had;
  }

  var Select = {
    ids: ids,
    count: count,
    has: function (id) { return !!sel[id]; },
    /** ¿Hay selección o modo de selección (móvil)? */
    active: function () { return mode || count() > 0; },
    mode: function () { return mode; },
    toggle: toggle,
    /** Entra en el modo de selección (móvil) con una tarea ya elegida */
    start: function (id) {
      mode = true; startedAt = Date.now();
      if (id) { sel[id] = true; anchor = id; }
      W.Audio.vibrate([18]);
      paint();
    },
    /** Clic en una tarea: true si lo gestiona la selección (y no se abre el editor) */
    click: function (e, id) {
      if (Date.now() - startedAt < 650) return true;   // el toque que abrió el modo
      if (desk() && (e.ctrlKey || e.metaKey)) { toggle(id); return true; }
      if (desk() && e.shiftKey) { if (anchor) range(anchor, id); else toggle(id); return true; }
      if (!Select.active()) return false;
      if (desk()) { clear(); return true; }
      toggle(id);
      return true;
    },
    /** Ctrl/⌘ A: todas las tareas visibles (false si no hay ninguna) */
    all: function () {
      var vis = visible();
      if (!vis.length) return false;
      vis.forEach(function (id) { sel[id] = true; });
      if (!desk()) mode = true;
      paint();
      // Algunos sistemas seleccionan también el texto de la página: se quita
      setTimeout(function () { try { window.getSelection().removeAllRanges(); } catch (e) { /* sin selección */ } }, 0);
      return true;
    },
    clear: clear,
    /** Teclas con selección: Espacio completa, Supr elimina */
    key: function (e) {
      if (!count()) return false;
      var k = e.key;
      if (k === ' ' || k === 'x' || k === 'X') { complete(); return true; }
      if (k === 'Delete' || k === 'Backspace') { remove(); return true; }
      return false;
    },
    /** Tras volver a pintar una lista */
    repaint: paint,
    actions: { complete: complete, remove: remove, duplicate: duplicate, apply: apply }
  };

  // Los cambios de los datos (otra pestaña, la nube…) actualizan el contador
  document.addEventListener('DOMContentLoaded', function () {
    if (W.State) W.State.subscribe(function () { if (Select.active()) requestAnimationFrame(paint); });
  });

  W.Select = Select;
})(window.Whider);
