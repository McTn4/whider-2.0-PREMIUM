/**
 * WHIDER · Editor de tareas (crear y editar), en una hoja con:
 *  título y notas · fecha y hora · avisos y repetición · lista y prioridad · subtareas.
 * Cada detalle es una fila que muestra su valor; las opciones se eligen en un menú.
 */
window.Whider = window.Whider || {};

(function (W) {
  'use strict';
  var U = W.U, S = function () { return W.State; };

  var REMIND_OPTS = [
    { value: 0, label: 'A la hora límite' },
    { value: 5, label: '5 min antes' },
    { value: 15, label: '15 min antes' },
    { value: 30, label: '30 min antes' },
    { value: 60, label: '1 hora antes' },
    { value: 180, label: '3 horas antes' },
    { value: 1440, label: '1 día antes' }
  ];
  var PRIO_OPTS = [
    { value: 'none', label: 'Ninguna' },
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
  function dateLabel(d) {
    if (!d) return '';
    var td = U.today();
    return d === td ? 'Hoy' : d === U.addDays(td, 1) ? 'Mañana' : d === U.addDays(td, -1) ? 'Ayer' : U.fmtLong(d);
  }
  function defaultTime(date) {
    if (date && date !== U.today()) return '09:00';
    return U.pad(Math.min(23, new Date().getHours() + 1)) + ':00';
  }
  function openPicker(input) { try { if (input.showPicker) input.showPicker(); } catch (e) { /* el sistema lo abre al tocar */ } }

  var Editor = {
    REMIND_OPTS: REMIND_OPTS,
    PRIO_OPTS: PRIO_OPTS,
    remindLabel: remindLabel,

    /** open(id) para editar · open(null, { date, listId }) para crear */
    open: function (taskId, preset) {
      var st = S(), src = taskId ? st.find(taskId) : null;
      if (taskId && !src) return null;
      var isNew = !src;
      var d = isNew ? {
        text: '', notes: '', date: preset && preset.date !== undefined ? preset.date : U.today(), time: null,
        highlight: (preset && preset.highlight) || 'none', warn: st.settings.defaultWarn, listId: (preset && preset.listId) || st.ui.listFilter || st.settings.defaultList,
        repeat: 'none', subtasks: [], remindBefore: null
      } : JSON.parse(JSON.stringify(src));
      if (d.listId && !st.getList(d.listId)) d.listId = null;
      var original = JSON.stringify(d);
      var calOpen = false;

      /* ----- Título y notas ----- */
      var title = U.el('textarea.cell-input.title', { attrs: { rows: 1, maxlength: 160, placeholder: 'Título', enterkeyhint: 'done', 'aria-label': 'Título' } });
      title.value = d.text;
      var notes = U.el('textarea.cell-input.note', { attrs: { rows: 1, maxlength: 2000, placeholder: 'Notas', 'aria-label': 'Notas' } });
      notes.value = d.notes || '';
      var saveBtn = U.el('button.nav-btn.bold', { text: isNew ? 'Añadir' : 'OK', on: { click: function () { save(); } } });
      var syncSave = function () { saveBtn.disabled = !title.value.trim(); };
      title.addEventListener('input', function () { autosize(title); syncSave(); });
      title.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); if (title.value.trim()) save(); } });
      notes.addEventListener('input', function () { autosize(notes); });
      syncSave();

      /* ----- Fecha ----- */
      var dateTog = W.UI.toggle(!!d.date, function (v) {
        d.date = v ? (d.date || U.today()) : null;
        if (!v) { d.time = null; calOpen = false; } else calOpen = true;
        renderWhen();
      }, 'Fecha');
      var dateSub = U.el('span.cell-sub.accent');
      var dateRow = U.el('div.cell.tap.has-icon', [
        U.el('span.cell-icon', { style: { '--c': 'var(--red)' } }, [U.icon('calendar')]),
        U.el('span.cell-main', [U.el('span.cell-title', { text: 'Fecha' }), dateSub]), dateTog
      ]);
      dateRow.addEventListener('click', function () {
        if (!d.date) { d.date = U.today(); calOpen = true; } else calOpen = !calOpen;
        renderWhen();
      });
      var picker = W.UI.datePicker(d.date, function (ds) { d.date = ds; renderWhen(true); });
      var calRow = U.el('div.cell.col', [picker]);

      /* ----- Hora ----- */
      var timeInput = U.el('input.overlay-input', { attrs: { type: 'time', 'aria-label': 'Hora' } });
      timeInput.addEventListener('change', function () { if (timeInput.value) { d.time = timeInput.value; renderWhen(); } });
      timeInput.addEventListener('click', function () { openPicker(timeInput); });
      var timeTog = W.UI.toggle(!!d.time, function (v) {
        if (v) {
          if (!d.date) d.date = U.today();
          d.time = d.time || defaultTime(d.date);
          renderWhen();
          timeInput.value = d.time;
          openPicker(timeInput);
        } else { d.time = null; renderWhen(); }
      }, 'Hora');
      var timeSub = U.el('span.cell-sub.accent');
      var timeMain = U.el('span.cell-main', [U.el('span.cell-title', { text: 'Hora' }), timeSub, timeInput]);
      var timeRow = U.el('div.cell.has-icon.time-row', [U.el('span.cell-icon', { style: { '--c': 'var(--blue)' } }, [U.icon('clock')]), timeMain, timeTog]);

      /* ----- Avisos y repetición ----- */
      var warnSub = U.el('span.cell-sub');
      var warnTog = W.UI.toggle(d.warn, function (v) { d.warn = v; renderWhen(); }, 'Avisarme si no la hago');
      var warnRow = U.el('div.cell.has-icon', [U.el('span.cell-icon', { style: { '--c': 'var(--orange)' } }, [U.icon('bell')]),
        U.el('span.cell-main', [U.el('span.cell-title', { text: 'Avisarme si no la hago' }), warnSub]), warnTog]);
      var remindRow = W.UI.cell({ icon: 'alarm', color: 'var(--indigo)', title: 'Recordatorio', value: '', onTap: function (e, node) {
        var cur = typeof d.remindBefore === 'number' ? d.remindBefore : st.settings.remindBefore;
        W.Menu.choose(node.querySelector('.cell-value'), { value: cur, options: REMIND_OPTS }).then(function (v) { if (v !== undefined) { d.remindBefore = v; renderWhen(); } });
      } });
      var repeatRow = W.UI.cell({ icon: 'repeat', color: 'var(--gray-2)', title: 'Repetir', value: '', onTap: function (e, node) {
        W.Menu.choose(node.querySelector('.cell-value'), { value: d.repeat, options: Object.keys(st.REPEATS).map(function (k) { return { value: k, label: k === 'none' ? 'Nunca' : st.REPEATS[k] }; }) })
          .then(function (v) { if (v) { d.repeat = v; renderWhen(); } });
      } });

      /* ----- Lista y prioridad ----- */
      var listIcon = U.el('span.cell-icon.round', [U.icon('list')]);
      var listRow = W.UI.cell({ lead: listIcon, title: 'Lista', value: '', onTap: function (e, node) {
        var opts = [{ value: '', label: 'Sin lista' }].concat(st.lists.map(function (l) { return { value: l.id, label: l.name, color: st.ACCENTS[l.color].a }; }));
        W.Sheet.choose({ anchor: node.querySelector('.cell-value'), title: 'Lista', value: d.listId || '', options: opts }).then(function (v) { if (v !== undefined) { d.listId = v || null; renderWhen(); } });
      } });
      var prioRow = W.UI.cell({ icon: 'flag', color: 'var(--red)', title: 'Prioridad', value: '', onTap: function (e, node) {
        W.Menu.choose(node.querySelector('.cell-value'), { value: d.highlight, options: PRIO_OPTS }).then(function (v) { if (v) { d.highlight = v; renderWhen(); } });
      } });

      var setValue = function (row, text) { var v = row.querySelector('.cell-value > span'); if (v) v.textContent = text; };
      var renderWhen = function (keepCal) {
        dateTog.querySelector('input').checked = !!d.date;
        timeTog.querySelector('input').checked = !!d.time;
        dateSub.textContent = dateLabel(d.date);
        dateSub.style.display = d.date ? '' : 'none';
        calRow.style.display = d.date && calOpen ? '' : 'none';
        if (!keepCal) picker.setValue(d.date);
        timeSub.textContent = d.time ? U.fmtTime(d.time) : '';
        timeSub.style.display = d.time ? '' : 'none';
        timeInput.value = d.time || '';
        timeInput.style.display = d.time ? '' : 'none';
        timeRow.classList.toggle('tap', !!d.time);
        warnSub.textContent = !d.date && d.warn ? 'Elige una fecha para recibir avisos' : '';
        warnSub.style.display = warnSub.textContent ? '' : 'none';
        remindRow.style.display = d.warn && d.time ? '' : 'none';
        setValue(remindRow, remindLabel(typeof d.remindBefore === 'number' ? d.remindBefore : st.settings.remindBefore));
        setValue(repeatRow, d.repeat === 'none' ? 'Nunca' : st.REPEATS[d.repeat]);
        var l = d.listId ? st.getList(d.listId) : null;
        listIcon.style.setProperty('--c', l ? st.ACCENTS[l.color].a : 'var(--gray-2)');
        setValue(listRow, l ? l.name : 'Sin lista');
        setValue(prioRow, labelOf(PRIO_OPTS, d.highlight));
      };
      renderWhen();

      /* ----- Subtareas ----- */
      var subGroup = U.el('div.group');
      var subInput = U.el('input.cell-input', { attrs: { type: 'text', maxlength: 120, placeholder: 'Añadir subtarea', enterkeyhint: 'enter', 'aria-label': 'Añadir subtarea' } });
      var addSub = function () {
        var v = subInput.value.trim();
        if (!v) return;
        d.subtasks.push({ id: U.uid('s'), text: v, done: false });
        subInput.value = ''; renderSubs(); subInput.focus();
      };
      subInput.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); addSub(); } });
      var renderSubs = function () {
        U.clear(subGroup);
        d.subtasks.forEach(function (s, i) {
          var chk = U.el('button.check.sm' + (s.done ? '.on' : ''), { attrs: { 'aria-label': (s.done ? 'Desmarcar: ' : 'Completar: ') + s.text }, on: { click: function () { s.done = !s.done; W.Audio.select(); renderSubs(); } } });
          chk.appendChild(U.svg('svg', { viewBox: '0 0 24 24' }, [U.svg('path', { d: 'm5 12.6 4.5 4.5L19 7.6' })]));
          subGroup.appendChild(U.el('div.cell.sub-row' + (s.done ? '.done' : ''), [
            chk, U.el('span.cell-title', { text: s.text }),
            U.el('button.sub-x', { attrs: { 'aria-label': 'Quitar subtarea' }, on: { click: function () { d.subtasks.splice(i, 1); renderSubs(); } } }, [U.icon('close')])
          ]));
        });
        subGroup.appendChild(U.el('label.cell.sub-add', [U.icon('plus-circle', 'sm'), subInput,
          U.el('button.nav-btn', { attrs: { 'aria-label': 'Añadir' }, style: { height: '28px', minWidth: '0', padding: '0' }, on: { click: addSub } }, [U.icon('check', 'sm')])]));
      };
      renderSubs();

      /* ----- Guardar ----- */
      var collect = function () { d.text = title.value.trim(); d.notes = notes.value.trim(); return d; };
      var dirty = function () { collect(); return JSON.stringify(d) !== original && (!isNew || !!d.text || !!d.notes || d.subtasks.length > 0); };
      var save = function () {
        collect();
        if (!d.text) { title.focus(); return; }
        if (isNew) {
          var created = st.addTask(d);
          if (created) {
            W.Audio.vibrate([8]);
            if (created.warn && created.date && W.Notify.permission() === 'default') W.Notify.request();
          }
        } else st.updateTask(src.id, d);
        sheet.close();
      };
      var askDiscard = function () {
        W.Sheet.confirm({ title: isNew ? '¿Descartar la tarea nueva?' : '¿Descartar los cambios?', ok: 'Descartar', cancel: 'Seguir editando', danger: true })
          .then(function (ok) { if (ok) sheet.close(); });
      };

      var body = [
        U.el('div.group.editor-fields', [U.el('label.cell', [title]), U.el('label.cell', [notes])]),
        U.el('div.group', [dateRow, calRow, timeRow]),
        U.el('div.group', [warnRow, remindRow, repeatRow]),
        U.el('div.group', [listRow, prioRow]),
        W.UI.section({ header: 'Subtareas', items: subGroup })
      ];
      if (!isNew) {
        body.push(U.el('div.group', [W.UI.cell({ title: 'Eliminar tarea', center: true, danger: true, onTap: function () {
          W.TaskCard.actions.confirmRemove(src.id).then(function (ok) { if (ok) sheet.close(); });
        } })]));
        if (src.focusMin) body.push(U.el('p.hint', { text: src.focusMin + ' min de enfoque dedicados a esta tarea' }));
      }

      var sheet = W.Sheet.open({
        title: isNew ? 'Nueva tarea' : 'Detalles', full: true, className: 'editor', body: body,
        lead: { text: 'Cancelar', onTap: function () { if (dirty()) askDiscard(); else sheet.close(); } },
        trail: saveBtn,
        guard: dirty, onGuard: askDiscard
      });
      requestAnimationFrame(function () { autosize(title); autosize(notes); });
      if (isNew) setTimeout(function () { title.focus(); }, 380);
      return sheet;
    }
  };

  W.Editor = Editor;
})(window.Whider);
