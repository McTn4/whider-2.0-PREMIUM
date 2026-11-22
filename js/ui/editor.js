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
    { value: 0, label: W.t('A la hora límite') },
    { value: 5, label: W.t('5 min antes') },
    { value: 15, label: W.t('15 min antes') },
    { value: 30, label: W.t('30 min antes') },
    { value: 60, label: W.t('1 hora antes') },
    { value: 180, label: W.t('3 horas antes') },
    { value: 1440, label: W.t('1 día antes') }
  ];
  var DUR_OPTS = [
    { value: 15, label: W.t('15 min') }, { value: 30, label: W.t('30 min') }, { value: 45, label: W.t('45 min') }, { value: 60, label: '1 h' },
    { value: 90, label: W.t('1 h 30 min') }, { value: 120, label: '2 h' }, { value: 180, label: '3 h' }, { value: 240, label: '4 h' }
  ];
  function durLabel(v) { for (var i = 0; i < DUR_OPTS.length; i++) if (DUR_OPTS[i].value === v) return DUR_OPTS[i].label; return v ? (v >= 60 ? Math.floor(v / 60) + ' h' + (v % 60 ? ' ' + v % 60 + ' min' : '') : v + ' min') : W.t('Sin indicar'); }
  var PRIO_OPTS = [
    { value: 'none', label: W.t('Ninguna') },
    { value: 'star', label: W.t('Destacada') },
    { value: 'purple', label: W.t('Importante') },
    { value: 'danger', label: W.t('Urgente') }
  ];

  function remindLabel(v) {
    for (var i = 0; i < REMIND_OPTS.length; i++) if (REMIND_OPTS[i].value === v) return REMIND_OPTS[i].label;
    return W.t('{n} min antes', { n: v });
  }
  function autosize(t) { t.style.height = 'auto'; t.style.height = t.scrollHeight + 'px'; }
  function dateLabel(d) {
    if (!d) return '';
    var td = U.today();
    return d === td ? W.t('Hoy') : d === U.addDays(td, 1) ? W.t('Mañana') : d === U.addDays(td, -1) ? W.t('Ayer') : U.fmtLong(d);
  }
  function defaultTime(date) {
    if (date && date !== U.today()) return '09:00';
    return U.pad(Math.min(23, new Date().getHours() + 1)) + ':00';
  }
  function openPicker(input) { try { if (input.showPicker) input.showPicker(); } catch (e) { /* el sistema lo abre al tocar */ } }

  var Editor = {
    REMIND_OPTS: REMIND_OPTS,
    PRIO_OPTS: PRIO_OPTS,
    DUR_OPTS: DUR_OPTS,
    durLabel: durLabel,
    remindLabel: remindLabel,

    /** open(id) para editar · open(null, { date, listId }) para crear */
    open: function (taskId, preset) {
      var st = S(), src = taskId ? st.find(taskId) : null;
      if (taskId && !src) return null;
      var isNew = !src;
      var d = isNew ? {
        text: (preset && preset.text) || '', notes: (preset && preset.notes) || '', date: preset && preset.date !== undefined ? preset.date : U.today(), time: (preset && preset.time) || null,
        highlight: (preset && preset.highlight) || 'none', warn: st.settings.defaultWarn, listId: (preset && preset.listId) || st.ui.listFilter || st.defaultListId(),
        repeat: (preset && preset.repeat) || 'none', days: (preset && preset.days) || undefined, subtasks: [], remindBefore: null
      } : JSON.parse(JSON.stringify(src));
      if (d.listId && !st.getList(d.listId)) d.listId = null;
      var original = JSON.stringify(d);
      var calOpen = false;

      /* ----- Título y notas ----- */
      var title = U.el('textarea.cell-input.title', { attrs: { rows: 1, maxlength: 160, placeholder: W.t('Título'), enterkeyhint: 'done', 'aria-label': W.t('Título') } });
      title.value = d.text;
      var notes = U.el('textarea.cell-input.note', { attrs: { rows: 1, maxlength: 2000, placeholder: W.t('Notas'), 'aria-label': W.t('Notas') } });
      notes.value = d.notes || '';
      var saveBtn = U.el('button.btn.primary', { text: isNew ? W.t('Crear tarea') : W.t('Guardar cambios'), on: { click: function () { save(); } } });
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
      }, W.t('Fecha'));
      var dateSub = U.el('span.cell-sub.accent');
      var dateRow = U.el('div.cell.tap.has-icon', [
        W.UI.cellIcon('calendar'),
        U.el('span.cell-main', [U.el('span.cell-title', { text: W.t('Fecha') }), dateSub]), dateTog
      ]);
      dateRow.addEventListener('click', function () {
        if (!d.date) { d.date = U.today(); calOpen = true; } else calOpen = !calOpen;
        renderWhen();
      });
      var picker = W.UI.datePicker(d.date, function (ds) { d.date = ds; renderWhen(true); });
      var calRow = U.el('div.cell.col', [picker]);

      /* ----- Hora ----- */
      var timeInput = U.el('input.overlay-input', { attrs: { type: 'time', 'aria-label': W.t('Hora') } });
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
      }, W.t('Hora'));
      var timeSub = U.el('span.cell-sub.accent');
      var timeMain = U.el('span.cell-main', [U.el('span.cell-title', { text: W.t('Hora') }), timeSub, timeInput]);
      var timeRow = U.el('div.cell.has-icon.time-row', [W.UI.cellIcon('clock'), timeMain, timeTog]);
      var durRow = W.UI.cell({ icon: 'timer', title: W.t('Duración'), value: '', onTap: function (e, node) {
        W.Menu.choose(node.querySelector('.cell-value'), { value: d.duration || null, options: [{ value: null, label: W.t('Sin indicar') }].concat(DUR_OPTS) })
          .then(function (v) { if (v !== undefined) { d.duration = v; renderWhen(); } });
      } });

      /* ----- Avisos y repetición ----- */
      var warnSub = U.el('span.cell-sub');
      var warnTog = W.UI.toggle(d.warn, function (v) { d.warn = v; renderWhen(); }, W.t('Avisarme si no la hago'));
      var warnRow = U.el('div.cell.has-icon', [W.UI.cellIcon('bell'),
        U.el('span.cell-main', [U.el('span.cell-title', { text: W.t('Avisarme si no la hago') }), warnSub]), warnTog]);
      var remindRow = W.UI.cell({ icon: 'alarm', title: W.t('Recordatorio'), value: '', onTap: function (e, node) {
        var cur = typeof d.remindBefore === 'number' ? d.remindBefore : st.settings.remindBefore;
        W.Menu.choose(node.querySelector('.cell-value'), { value: cur, options: REMIND_OPTS }).then(function (v) { if (v !== undefined) { d.remindBefore = v; renderWhen(); } });
      } });
      var repeatRow = W.UI.cell({ icon: 'repeat', title: W.t('Repetir'), value: '', onTap: function (e, node) {
        W.Menu.choose(node.querySelector('.cell-value'), { value: d.repeat, options: Object.keys(st.REPEATS).map(function (k) { return { value: k, label: k === 'none' ? W.t('Nunca') : st.REPEATS[k] }; }) })
          .then(function (v) {
            if (!v) return;
            d.repeat = v;
            if (v !== 'none' && !d.date) d.date = U.today();
            if (v !== 'weekly') delete d.days;
            renderWhen();
          });
      } });
      /* ----- Cada semana: qué días (varios = tarea de cada día, sale en «Cada día» de Inicio y de Tareas) ----- */
      var ws = st.settings.weekStart === 0 ? 0 : 1;
      var dayBtns = [0, 1, 2, 3, 4, 5, 6].map(function (i) {
        var wd = (i + ws) % 7;
        return U.el('button.day-opt', { attrs: { type: 'button', 'aria-pressed': 'false', 'aria-label': U.cap(U.WEEKDAYS[wd]), title: U.cap(U.WEEKDAYS[wd]) }, on: { click: function () {
          var cur = d.days && d.days.length ? d.days.slice() : (d.date ? [U.weekday(d.date)] : []);
          var k = cur.indexOf(wd);
          if (k >= 0) { if (cur.length > 1) cur.splice(k, 1); } else cur.push(wd);
          d.days = cur.sort();
          // La fecha pasa al primer día elegido (desde la que tenía)
          if (d.date && d.days.indexOf(U.weekday(d.date)) < 0) d.date = W.Schema.firstDue({ repeat: 'weekly', days: d.days, date: d.date }, d.date);
          W.Audio.select();
          renderWhen();
        } } }, [U.WEEKDAYS_LETTER[wd]]);
      });
      var daysRow = U.el('div.cell.col.days-cell', [U.el('span.cell-sub', { text: W.t('Qué días de la semana') }), U.el('div.days-row', { attrs: { role: 'group', 'aria-label': W.t('Qué días de la semana') } }, dayBtns)]);

      /* ----- Lista y prioridad ----- */
      var listRow = W.UI.cell({ icon: 'list', title: W.t('Categoría'), value: '', onTap: function (e, node) {
        var opts = [{ value: '', label: W.t('Sin categoría') }].concat(st.lists.map(function (l) { return { value: l.id, label: l.name, icon: W.Lists.icon(l) }; }));
        W.Sheet.choose({ anchor: node.querySelector('.cell-value'), title: W.t('Categoría'), value: d.listId || '', options: opts }).then(function (v) { if (v !== undefined) { d.listId = v || null; renderWhen(); } });
      } });
      var prioBtns = PRIO_OPTS.map(function (o) {
        return U.el('button.prio-opt', { attrs: { 'aria-pressed': 'false' }, on: { click: function () {
          d.highlight = o.value; W.Audio.select(); renderWhen();
        } } }, [W.UI.prio(o.value), o.label]);
      });
      var prioRow = U.el('div.cell.col', [U.el('span.cell-row', [W.UI.cellIcon('flag'), U.el('span.cell-title', { text: W.t('Prioridad') })]),
        U.el('div.prio-row', prioBtns)]);
      /* ----- En curso: ya la empezaste (sale delante en Inicio) ----- */
      var doingTog = W.UI.toggle(!!d.startedAt, function (v) { d.startedAt = v ? (d.startedAt || Date.now()) : null; }, W.t('En curso'));
      var doingRow = U.el('div.cell.has-icon', [W.UI.cellIcon('play'),
        U.el('span.cell-main', [U.el('span.cell-title', { text: W.t('En curso') }), U.el('span.cell-sub', { text: W.t('Ya la empezaste: en Inicio sale delante') })]), doingTog]);
      if (d.done) doingRow.style.display = 'none';

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
        durRow.style.display = d.time ? '' : 'none';
        setValue(durRow, d.duration ? durLabel(d.duration) + (d.time ? ' · ' + W.t('hasta las {time}', { time: U.fmtTime(U.pad(Math.floor((U.hmToMin(d.time) + d.duration) / 60) % 24) + ':' + U.pad((U.hmToMin(d.time) + d.duration) % 60)) }) : '') : W.t('Sin indicar'));
        warnSub.textContent = !d.date && d.warn ? W.t('Elige una fecha para recibir avisos') : '';
        warnSub.style.display = warnSub.textContent ? '' : 'none';
        remindRow.style.display = d.warn && d.time ? '' : 'none';
        setValue(remindRow, remindLabel(typeof d.remindBefore === 'number' ? d.remindBefore : st.settings.remindBefore));
        setValue(repeatRow, d.repeat === 'none' ? W.t('Nunca') : W.Schema.repeatLabel(d, ws));
        daysRow.style.display = d.repeat === 'weekly' ? '' : 'none';
        var on = d.days && d.days.length ? d.days : (d.date ? [U.weekday(d.date)] : []);
        dayBtns.forEach(function (b, i) { var x = on.indexOf((i + ws) % 7) >= 0; b.classList.toggle('on', x); b.setAttribute('aria-pressed', x ? 'true' : 'false'); });
        var l = d.listId ? st.getList(d.listId) : null;
        setValue(listRow, l ? l.name : W.t('Sin categoría'));
        prioBtns.forEach(function (b, i) { var on = PRIO_OPTS[i].value === d.highlight; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on ? 'true' : 'false'); });
      };
      renderWhen();

      /* ----- Subtareas ----- */
      var subGroup = U.el('div.group');
      var subInput = U.el('input.cell-input', { attrs: { type: 'text', maxlength: 120, placeholder: W.t('Añadir subtarea'), enterkeyhint: 'enter', 'aria-label': W.t('Añadir subtarea') } });
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
          var chk = U.el('button.check.sm' + (s.done ? '.on' : ''), { attrs: { 'aria-label': s.done ? W.t('Desmarcar: {text}', { text: s.text }) : W.t('Completar: {text}', { text: s.text }) }, on: { click: function () { s.done = !s.done; W.Audio.select(); renderSubs(); } } });
          chk.appendChild(U.svg('svg', { viewBox: '0 0 24 24' }, [U.svg('path', { d: 'm5 12.6 4.5 4.5L19 7.6' })]));
          subGroup.appendChild(U.el('div.cell.sub-row' + (s.done ? '.done' : ''), [
            chk, U.el('span.cell-title', { text: s.text }),
            U.el('button.sub-x', { attrs: { 'aria-label': W.t('Quitar subtarea') }, on: { click: function () { d.subtasks.splice(i, 1); renderSubs(); } } }, [U.icon('close')])
          ]));
        });
        subGroup.appendChild(U.el('label.cell.sub-add', [U.icon('plus-circle', 'sm'), subInput,
          U.el('button.nav-btn', { attrs: { 'aria-label': W.t('Añadir') }, style: { height: '28px', minWidth: '0', padding: '0' }, on: { click: addSub } }, [U.icon('check', 'sm')])]));
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
        W.Sheet.confirm({ title: isNew ? W.t('¿Descartar la tarea nueva?') : W.t('¿Descartar los cambios?'), ok: W.t('Descartar'), cancel: W.t('Seguir editando'), danger: true })
          .then(function (ok) { if (ok) sheet.close(); });
      };

      var body = [
        U.el('div.group.editor-fields', [U.el('label.cell', [title]), U.el('label.cell', [notes])]),
        U.el('div.group', [dateRow, calRow, timeRow, durRow]),
        U.el('div.group', [warnRow, remindRow, repeatRow, daysRow]),
        U.el('div.group', [listRow, prioRow, doingRow]),
        W.UI.section({ header: W.t('Subtareas'), items: subGroup })
      ];
      var foot = [];
      if (!isNew) foot.push(U.el('button.btn.ghost', { attrs: { 'aria-label': W.t('Eliminar tarea'), title: W.t('Eliminar tarea') }, style: { padding: '0 16px' }, on: { click: function () {
        W.TaskCard.actions.confirmRemove(src.id).then(function (ok) { if (ok) sheet.close(); });
      } } }, [U.icon('trash')]));
      foot.push(saveBtn);

      var sheet = W.Sheet.open({
        title: isNew ? W.t('Nueva tarea') : W.t('Editar tarea'), full: true, className: 'editor', body: body,
        trail: U.el('button.circle-btn', { attrs: { 'aria-label': W.t('Cerrar') }, on: { click: function () { if (dirty()) askDiscard(); else sheet.close(); } } }, [U.icon('close')]),
        foot: foot,
        guard: dirty, onGuard: askDiscard
      });
      requestAnimationFrame(function () { autosize(title); autosize(notes); });
      if (isNew) setTimeout(function () { title.focus(); }, W.Layout.desktop ? 30 : 380);
      return sheet;
    }
  };

  W.Editor = Editor;
})(window.Whider);
