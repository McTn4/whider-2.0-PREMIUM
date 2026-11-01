/**
 * WHIDER · Editor de tareas (crear y editar) en hoja inferior
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

  function remindLabel(v) {
    for (var i = 0; i < REMIND_OPTS.length; i++) if (REMIND_OPTS[i].value === v) return REMIND_OPTS[i].label;
    return v + ' min antes';
  }

  var Editor = {
    REMIND_OPTS: REMIND_OPTS,
    remindLabel: remindLabel,

    /** open(taskId) para editar · open(null, { date, listId }) para crear */
    open: function (taskId, preset) {
      var st = S(), src = taskId ? st.find(taskId) : null;
      if (taskId && !src) return;
      var isNew = !src;
      var d = isNew ? {
        text: '', notes: '', date: preset && preset.date !== undefined ? preset.date : U.today(), time: null,
        highlight: 'none', warn: st.settings.defaultWarn, listId: (preset && preset.listId) || st.ui.listFilter || st.settings.defaultList,
        repeat: 'none', subtasks: [], remindBefore: null
      } : JSON.parse(JSON.stringify(src));
      if (!st.getList(d.listId)) d.listId = null;

      /* ----- Título y notas ----- */
      var title = U.el('textarea.input.input-title', { attrs: { rows: 1, maxlength: 160, placeholder: '¿Qué quieres conseguir?', enterkeyhint: 'done' } });
      title.value = d.text;
      var autosize = function () { title.style.height = 'auto'; title.style.height = title.scrollHeight + 'px'; };
      title.addEventListener('input', autosize);
      title.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); save(); } });
      var notes = U.el('textarea.input', { attrs: { rows: 2, maxlength: 2000, placeholder: 'Notas, enlaces o detalles (opcional)' } });
      notes.value = d.notes || '';

      /* ----- Fecha ----- */
      var dateInput = U.el('input.input', { attrs: { type: 'date', 'aria-label': 'Fecha personalizada' } });
      dateInput.value = d.date || '';
      var dateChips = U.el('div.chips');
      var quickDates = [
        { label: 'Hoy', v: function () { return U.today(); } },
        { label: 'Mañana', v: function () { return U.addDays(U.today(), 1); } },
        { label: 'Próx. semana', v: function () { var t = U.today(), wd = U.weekday(t); return U.addDays(t, ((8 - wd) % 7) || 7); } },
        { label: 'Sin fecha', v: function () { return null; } }
      ];
      var renderDateChips = function () {
        U.clear(dateChips);
        quickDates.forEach(function (q) {
          var val = q.v();
          dateChips.appendChild(U.el('button.chip' + (val === d.date ? '.active' : ''), { text: q.label, on: { click: function () {
            d.date = val; dateInput.value = val || ''; renderDateChips(); W.Audio.tap();
          } } }));
        });
      };
      dateInput.addEventListener('change', function () { d.date = dateInput.value || null; renderDateChips(); });
      renderDateChips();

      /* ----- Hora ----- */
      var timeInput = U.el('input.input', { attrs: { type: 'time', 'aria-label': 'Hora límite' } });
      timeInput.value = d.time || '';
      timeInput.addEventListener('change', function () { d.time = timeInput.value || null; renderRemind(); });
      var clearTime = U.el('button.btn.ghost.sm', { text: 'Quitar hora', on: { click: function () { d.time = null; timeInput.value = ''; renderRemind(); } } });

      /* ----- Prioridad ----- */
      var prio = W.UI.segmented([
        { value: 'none', label: 'Normal' }, { value: 'star', label: 'Destacada' },
        { value: 'purple', label: 'Importante' }, { value: 'danger', label: 'Urgente' }
      ], d.highlight, function (v) { d.highlight = v; });

      /* ----- Lista ----- */
      var listChips = U.el('div.chips');
      var renderLists = function () {
        U.clear(listChips);
        listChips.appendChild(U.el('button.chip' + (!d.listId ? '.active' : ''), { text: 'Ninguna', on: { click: function () { d.listId = null; renderLists(); } } }));
        st.lists.forEach(function (l) {
          listChips.appendChild(U.el('button.chip' + (d.listId === l.id ? '.active' : ''), { on: { click: function () { d.listId = l.id; W.Audio.tap(); renderLists(); } } },
            [U.el('span.dot', { style: { '--c': st.ACCENTS[l.color].a } }), l.name]));
        });
      };
      renderLists();

      /* ----- Repetición y aviso ----- */
      var repeatRow = W.UI.row({ icon: 'repeat', label: 'Repetir', value: st.REPEATS[d.repeat], onTap: function () {
        W.Sheet.choose({ title: 'Repetir', value: d.repeat, options: Object.keys(st.REPEATS).map(function (k) { return { value: k, label: st.REPEATS[k] }; }) })
          .then(function (v) { if (v) { d.repeat = v; repeatRow.querySelector('.row-value').firstChild.textContent = st.REPEATS[v]; } });
      } });
      var warnToggle = W.UI.toggle(d.warn, function (v) { d.warn = v; renderRemind(); }, 'Avisarme');
      var warnRow = W.UI.row({ icon: 'bell', label: 'Avisarme si no la hago', desc: 'Alerta y notificación al vencer el plazo', right: warnToggle });
      var remindHost = U.el('div');
      var renderRemind = function () {
        U.clear(remindHost);
        if (!d.warn || !d.time) return;
        var current = typeof d.remindBefore === 'number' ? d.remindBefore : st.settings.remindBefore;
        remindHost.appendChild(W.UI.row({ icon: 'clock', label: 'Recordatorio previo', value: remindLabel(current), onTap: function () {
          W.Sheet.choose({ title: 'Recordarme', value: current, options: REMIND_OPTS }).then(function (v) {
            if (v !== undefined) { d.remindBefore = v; renderRemind(); }
          });
        } }));
      };
      renderRemind();

      /* ----- Subtareas ----- */
      var subList = U.el('div.subtasks');
      var subInput = U.el('input.input', { attrs: { type: 'text', maxlength: 120, placeholder: 'Añadir subtarea', enterkeyhint: 'enter' } });
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
            U.el('button.icon-btn.mini', { attrs: { 'aria-label': 'Quitar subtarea' }, on: { click: function () { d.subtasks.splice(i, 1); renderSubs(); } } }, [U.icon('close', 'xs')])
          ]));
        });
      };
      renderSubs();

      /* ----- Montaje ----- */
      var body = [
        U.el('div.editor-title', [title]),
        U.el('div.field', [U.el('span.field-label', { text: 'Fecha' }), dateChips, U.el('div.editor-grid', [dateInput, timeInput])]),
        U.el('div.field', [U.el('span.field-label', { text: 'Prioridad' }), prio]),
        U.el('div.field', [U.el('span.field-label', { text: 'Lista' }), listChips]),
        U.el('div.group', [warnRow, remindHost, repeatRow]),
        U.el('div.field', [U.el('span.field-label', { text: 'Subtareas' }), subList, U.el('div.sub-add', [subInput, U.el('button.btn.soft.round', { attrs: { 'aria-label': 'Añadir subtarea' }, on: { click: addSub } }, [U.icon('plus')])])]),
        U.el('div.field', [U.el('span.field-label', { text: 'Notas' }), notes])
      ];
      if (d.time) body[1].appendChild(clearTime);
      if (!isNew && src.focusMin) body.push(U.el('p.editor-foot-note', [U.icon('timer', 'xs'), ' ' + src.focusMin + ' min de enfoque dedicados']));

      var foot = [];
      if (!isNew) foot.push(U.el('button.btn.danger.round', { attrs: { 'aria-label': 'Eliminar tarea' }, on: { click: function () {
        W.TaskCard.actions.confirmRemove(src.id).then(function (ok) { if (ok) sheet.close(); });
      } } }, [U.icon('trash')]));
      if (!isNew && !src.done) foot.push(U.el('button.btn.ghost', { on: { click: function () {
        sheet.close(); W.Router.go('focus'); W.Screens.focus.linkTask(src.id);
      } } }, [U.icon('timer', 'sm'), 'Enfocar']));
      foot.push(U.el('button.btn.primary', { on: { click: function () { save(); } } }, [U.icon('check', 'sm'), isNew ? 'Crear tarea' : 'Guardar']));

      var saved = false;
      var save = function () {
        var text = title.value.trim();
        if (!text) { title.focus(); title.classList.add('shake'); setTimeout(function () { title.classList.remove('shake'); }, 500); return; }
        d.text = text; d.notes = notes.value.trim();
        saved = true;
        if (isNew) {
          var created = st.addTask(d);
          if (created) {
            W.Audio.vibrate([14, 30, 14]);
            W.Toast.show({ text: 'Tarea creada' + (created.date ? ' para ' + U.fmtDay(created.date).toLowerCase() : ''), type: 'success', icon: 'check' });
            if (created.warn && W.Notify.permission() === 'default') W.Notify.request();
          }
        } else {
          st.updateTask(src.id, d);
          W.Toast.show({ text: 'Cambios guardados', type: 'success', icon: 'check' });
        }
        sheet.close();
      };

      var sheet = W.Sheet.open({ title: isNew ? 'Nueva tarea' : 'Editar tarea', body: body, foot: foot, className: 'editor' });
      W.App.setFab(true);
      if (isNew) setTimeout(function () { title.focus(); }, 420);
      requestAnimationFrame(autosize);
      return sheet;
    }
  };

  W.Editor = Editor;
})(window.Whider);
