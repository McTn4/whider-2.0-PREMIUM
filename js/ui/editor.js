/**
 * WHIDER · Editor de tareas (crear y editar).
 * Diseño progresivo: lo esencial arriba (título, nota y día) y los detalles en filas
 * tranquilas que muestran su valor y se tocan para cambiarlo.
 */
window.Whider = window.Whider || {};

(function (W) {
  'use strict';
  var U = W.U, S = function () { return W.State; };

  var REMIND_OPTS = [
    { value: 0, label: 'A la hora límite' },
    { value: 5, label: '5 minutos antes' },
    { value: 15, label: '15 minutos antes' },
    { value: 30, label: '30 minutos antes' },
    { value: 60, label: '1 hora antes' },
    { value: 180, label: '3 horas antes' },
    { value: 1440, label: '1 día antes' }
  ];
  var PRIO_OPTS = [
    { value: 'none', label: 'Normal', color: 'var(--t4)' },
    { value: 'star', label: 'Destacada', color: 'var(--p-star)' },
    { value: 'purple', label: 'Importante', color: 'var(--p-purple)' },
    { value: 'danger', label: 'Urgente', color: 'var(--p-danger)' }
  ];

  function remindLabel(v) {
    for (var i = 0; i < REMIND_OPTS.length; i++) if (REMIND_OPTS[i].value === v) return REMIND_OPTS[i].label;
    return v + ' min antes';
  }
  function labelOf(list, v) { for (var i = 0; i < list.length; i++) if (list[i].value === v) return list[i].label; return ''; }

  function autosize(t) { t.style.height = 'auto'; t.style.height = t.scrollHeight + 'px'; }

  /** Fila de detalle: icono · etiqueta · valor (›) */
  function detailRow(icon, label) {
    var value = U.el('span.d-value');
    var row = U.el('div.d-row', { attrs: { role: 'button', tabindex: '0' } }, [
      U.el('span.d-ic', [U.icon(icon)]), U.el('span.d-label', { text: label }), value
    ]);
    row._value = value;
    return row;
  }

  var Editor = {
    REMIND_OPTS: REMIND_OPTS,
    remindLabel: remindLabel,

    /** open(id) para editar · open(null, { date, listId }) para crear */
    open: function (taskId, preset) {
      var st = S(), src = taskId ? st.find(taskId) : null;
      if (taskId && !src) return;
      var isNew = !src;
      var d = isNew ? {
        text: '', notes: '', date: preset && preset.date !== undefined ? preset.date : U.today(), time: null,
        highlight: 'none', warn: st.settings.defaultWarn, listId: (preset && preset.listId) || st.ui.listFilter || st.settings.defaultList,
        repeat: 'none', subtasks: [], remindBefore: null
      } : JSON.parse(JSON.stringify(src));
      if (d.listId && !st.getList(d.listId)) d.listId = null;

      /* ----- Título y nota ----- */
      var title = U.el('textarea.input.input-title', { attrs: { rows: 1, maxlength: 160, placeholder: '¿Qué tienes que hacer?', enterkeyhint: 'done' } });
      title.value = d.text;
      title.addEventListener('input', function () { autosize(title); });
      title.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); save(); } });
      var notes = U.el('textarea.input.input-note', { attrs: { rows: 1, maxlength: 2000, placeholder: 'Añadir una nota' } });
      notes.value = d.notes || '';
      notes.addEventListener('input', function () { autosize(notes); });

      /* ----- Día ----- */
      var dateInput = U.el('input.overlay-input', { attrs: { type: 'date', 'aria-label': 'Elegir fecha' } });
      var dayChips = U.el('div.chips.day-chips');
      var renderDays = function () {
        U.clear(dayChips);
        var td = U.today(), tm = U.addDays(td, 1);
        [{ label: 'Hoy', v: td }, { label: 'Mañana', v: tm }, { label: 'Sin fecha', v: null }].forEach(function (q) {
          dayChips.appendChild(U.el('button.chip' + (q.v === d.date ? '.active' : ''), { text: q.label, on: { click: function () { d.date = q.v; renderDays(); W.Audio.tap(); } } }));
        });
        var custom = d.date && d.date !== td && d.date !== tm;
        dateInput.value = d.date || '';
        dayChips.appendChild(U.el('label.chip.has-overlay' + (custom ? '.active' : ''), [U.icon('calendar', 'xs'), custom ? U.fmtShort(d.date) : 'Otro día', dateInput]));
      };
      dateInput.addEventListener('change', function () { if (dateInput.value) { d.date = dateInput.value; renderDays(); } });
      renderDays();

      /* ----- Detalles ----- */
      var timeInput = U.el('input.overlay-input', { attrs: { type: 'time', 'aria-label': 'Hora límite' } });
      var timeRow = detailRow('clock', 'Hora');
      var clearTime = U.el('button.d-clear', { attrs: { 'aria-label': 'Quitar hora' }, on: { click: function (e) { e.preventDefault(); e.stopPropagation(); d.time = null; renderDetails(); } } }, [U.icon('close', 'xs')]);
      timeRow.appendChild(timeInput);
      timeRow.appendChild(clearTime);
      timeInput.addEventListener('change', function () { d.time = timeInput.value || null; renderDetails(); });
      // En navegadores de escritorio, abrir el selector nativo al tocar la fila
      [timeInput, dateInput].forEach(function (inp) {
        inp.addEventListener('click', function () { try { if (inp.showPicker) inp.showPicker(); } catch (e) { /* el sistema ya lo abre */ } });
      });

      var prioRow = detailRow('flag', 'Prioridad');
      prioRow.addEventListener('click', function () {
        W.Sheet.choose({ title: 'Prioridad', value: d.highlight, options: PRIO_OPTS }).then(function (v) { if (v) { d.highlight = v; renderDetails(); } });
      });
      var listRow = detailRow('layers', 'Lista');
      listRow.addEventListener('click', function () {
        var opts = [{ value: '', label: 'Sin lista', color: 'var(--t4)' }].concat(st.lists.map(function (l) { return { value: l.id, label: l.name, color: st.ACCENTS[l.color].a }; }));
        W.Sheet.choose({ title: 'Lista', value: d.listId || '', options: opts }).then(function (v) { if (v !== undefined) { d.listId = v || null; renderDetails(); } });
      });
      var warnToggle = W.UI.toggle(d.warn, function (v) { d.warn = v; renderDetails(); }, 'Avisarme si no la hago');
      var warnRow = U.el('div.d-row', [U.el('span.d-ic', [U.icon('bell')]), U.el('span.d-label', { text: 'Avisarme si no la hago' }), warnToggle]);
      var remindRow = detailRow('alert', 'Recordatorio');
      remindRow.addEventListener('click', function () {
        var cur = typeof d.remindBefore === 'number' ? d.remindBefore : st.settings.remindBefore;
        W.Sheet.choose({ title: 'Recordarme', value: cur, options: REMIND_OPTS }).then(function (v) { if (v !== undefined) { d.remindBefore = v; renderDetails(); } });
      });
      var repeatRow = detailRow('repeat', 'Repetir');
      repeatRow.addEventListener('click', function () {
        W.Sheet.choose({ title: 'Repetir', value: d.repeat, options: Object.keys(st.REPEATS).map(function (k) { return { value: k, label: st.REPEATS[k] }; }) })
          .then(function (v) { if (v) { d.repeat = v; renderDetails(); } });
      });

      var renderDetails = function () {
        timeInput.value = d.time || '';
        timeRow._value.textContent = d.time ? U.fmtTime(d.time) : 'Sin hora';
        timeRow.classList.toggle('set', !!d.time);
        clearTime.style.display = d.time ? '' : 'none';
        var pr = labelOf(PRIO_OPTS, d.highlight);
        U.clear(prioRow._value);
        prioRow._value.appendChild(U.el('i.d-dot', { style: { background: (PRIO_OPTS.filter(function (o) { return o.value === d.highlight; })[0] || PRIO_OPTS[0]).color } }));
        prioRow._value.appendChild(document.createTextNode(pr));
        var l = d.listId ? st.getList(d.listId) : null;
        U.clear(listRow._value);
        if (l) listRow._value.appendChild(U.el('i.d-dot', { style: { background: st.ACCENTS[l.color].a } }));
        listRow._value.appendChild(document.createTextNode(l ? l.name : 'Sin lista'));
        remindRow.style.display = d.warn && d.time ? '' : 'none';
        remindRow._value.textContent = remindLabel(typeof d.remindBefore === 'number' ? d.remindBefore : st.settings.remindBefore);
        repeatRow._value.textContent = d.repeat === 'none' ? 'No' : st.REPEATS[d.repeat];
      };
      renderDetails();

      /* ----- Subtareas ----- */
      var subList = U.el('div.subtasks');
      var subInput = U.el('input.input.sub-input', { attrs: { type: 'text', maxlength: 120, placeholder: 'Añadir subtarea', enterkeyhint: 'enter' } });
      var addSub = function () {
        var v = subInput.value.trim();
        if (!v) return;
        d.subtasks.push({ id: U.uid('s'), text: v, done: false });
        subInput.value = ''; renderSubs(); W.Audio.tap();
      };
      subInput.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); addSub(); } });
      var renderSubs = function () {
        U.clear(subList);
        d.subtasks.forEach(function (s, i) {
          var chk = U.el('button.check.sm' + (s.done ? '.on' : ''), { attrs: { 'aria-label': 'Completar subtarea' }, on: { click: function () { s.done = !s.done; renderSubs(); W.Audio.tap(); } } });
          chk.appendChild(U.svg('svg', { viewBox: '0 0 24 24' }, [U.svg('path', { d: 'm5 12.5 4.6 4.6L19 7.6' })]));
          subList.appendChild(U.el('div.subtask' + (s.done ? '.done' : ''), [
            chk, U.el('span', { text: s.text }),
            U.el('button.sub-x', { attrs: { 'aria-label': 'Quitar subtarea' }, on: { click: function () { d.subtasks.splice(i, 1); renderSubs(); } } }, [U.icon('close', 'xs')])
          ]));
        });
      };
      renderSubs();

      /* ----- Guardar ----- */
      var save = function () {
        var text = title.value.trim();
        if (!text) { title.focus(); title.classList.add('shake'); setTimeout(function () { title.classList.remove('shake'); }, 450); return; }
        d.text = text; d.notes = notes.value.trim();
        if (isNew) {
          var created = st.addTask(d);
          if (created) {
            W.Audio.vibrate([10, 24, 10]);
            if (created.warn && created.date && W.Notify.permission() === 'default') W.Notify.request();
          }
        } else {
          st.updateTask(src.id, d);
          W.Audio.tap();
        }
        sheet.close();
      };

      var body = [
        U.el('div.editor-head', [title, notes]),
        dayChips,
        U.el('div.group.details', [timeRow, prioRow, listRow, warnRow, remindRow, repeatRow]),
        U.el('div.sub-block', [U.el('span.field-label', { text: 'Subtareas' }), subList, U.el('div.sub-add', [subInput,
          U.el('button.icon-btn', { attrs: { 'aria-label': 'Añadir subtarea' }, on: { click: addSub } }, [U.icon('plus', 'sm')])])])
      ];
      if (!isNew && src.focusMin) body.push(U.el('p.hint', [U.icon('timer', 'xs'), ' ' + src.focusMin + ' min de enfoque dedicados']));

      var foot = [];
      if (!isNew) foot.push(U.el('button.btn.ghost.round', { attrs: { 'aria-label': 'Eliminar tarea' }, on: { click: function () {
        W.TaskCard.actions.confirmRemove(src.id).then(function (ok) { if (ok) sheet.close(); });
      } } }, [U.icon('trash')]));
      foot.push(U.el('button.btn.primary', { text: isNew ? 'Crear tarea' : 'Guardar', on: { click: save } }));

      var sheet = W.Sheet.open({ title: isNew ? 'Nueva tarea' : 'Editar tarea', body: body, foot: foot, className: 'editor' });
      W.App.setFab(true);
      requestAnimationFrame(function () { autosize(title); autosize(notes); });
      if (isNew) setTimeout(function () { title.focus(); }, 320);
      return sheet;
    }
  };

  W.Editor = Editor;
})(window.Whider);
