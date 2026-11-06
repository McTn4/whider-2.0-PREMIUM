/**
 * WHIDER · Creación rápida de tareas (botón + del dock).
 * La tarea se escribe en una línea — "Llamar a Ana mañana a las 10 #trabajo !!" — y se detectan
 * la fecha, la hora, la lista, la prioridad y la repetición. Con Intro se añade y queda listo
 * para la siguiente; "Más detalles" abre el editor completo con lo escrito.
 */
window.Whider = window.Whider || {};

(function (W) {
  'use strict';
  var U = W.U, S = function () { return W.State; };
  var current = null;
  var KIND_ICON = { date: 'calendar', time: 'clock', list: 'list', prio: 'flag', repeat: 'repeat' };

  function dayLabel(ds) {
    if (!ds) return 'Sin fecha';
    var td = U.today();
    return ds === td ? 'Hoy' : ds === U.addDays(td, 1) ? 'Mañana' : U.fmtShort(ds);
  }

  var QuickAdd = {
    isOpen: function () { return !!current; },

    /**
     * Campo para añadir sin abrir nada (ordenador): se escribe, Intro y queda creada.
     * Entiende fecha, hora, #lista y prioridad; lo que no se escriba sale de `preset`.
     */
    inline: function (preset, placeholder) {
      var st = S();
      var input = U.el('input', { attrs: { type: 'text', maxlength: 200, placeholder: placeholder || 'Añadir una tarea…', enterkeyhint: 'done', 'aria-label': placeholder || 'Añadir una tarea' } });
      var add = function () {
        var raw = input.value.trim();
        if (!raw) return;
        var p = W.Parse.task(raw, { lists: st.lists });
        if (!p.text) return;
        st.addTask({
          text: p.text, date: p.date !== undefined ? p.date : (preset.date !== undefined ? preset.date : null),
          time: p.time || null, listId: p.listId || preset.listId || st.settings.defaultList,
          highlight: p.highlight || preset.highlight || 'none', repeat: p.repeat || 'none',
          warn: st.settings.defaultWarn, notes: '', subtasks: []
        });
        W.Audio.vibrate([8]);
        // La pantalla se vuelve a pintar: el foco vuelve al campo para seguir escribiendo
        var sel = '.screen.active .inline-add input';
        requestAnimationFrame(function () { requestAnimationFrame(function () { var i = U.$(sel); if (i) i.focus(); }); });
      };
      input.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); add(); } });
      return U.el('label.inline-add', [U.icon('plus'), input, U.el('span.ia-hint', [U.el('kbd', { text: 'Intro' })])]);
    },

    /** open({ date, time, listId, highlight }) — valores de partida según la pantalla */
    open: function (preset) {
      if (current) return current;
      preset = preset || {};
      var st = S();
      var base = {
        date: preset.date !== undefined ? preset.date : U.today(),
        time: preset.time || null,
        listId: preset.listId || st.settings.defaultList,
        highlight: preset.highlight || 'none',
        repeat: 'none'
      };
      if (base.listId && !st.getList(base.listId)) base.listId = null;
      var manual = {};          // lo que el usuario fijó con los botones (manda sobre lo detectado)
      var ignore = {};          // detecciones descartadas
      var parsed = null, added = 0;

      var input = U.el('textarea.qa-input', { attrs: { rows: 1, maxlength: 200, placeholder: 'Escribe una tarea', enterkeyhint: 'send', 'aria-label': 'Nueva tarea' } });
      var detected = U.el('div.qa-detected', { attrs: { 'aria-live': 'polite' } });
      var chips = U.el('div.chips');
      var help = U.el('p.qa-help', ['Ej.: ', U.el('code', { text: 'Llamar a Ana mañana a las 10 #trabajo !!' }), U.el('br'),
        'Fecha y hora en el texto · # categoría · ! a !!! prioridad · «cada semana» repite.']);
      var addedNote = U.el('span.qa-added');
      var addBtn = U.el('button.btn.primary', { text: 'Añadir', on: { click: function () { submit(true); } } });

      var value = function (k) {
        if (manual[k] !== undefined) return manual[k];
        if (parsed && parsed[k] !== undefined) return parsed[k];
        return base[k];
      };
      var autosize = function () { input.style.height = 'auto'; input.style.height = input.scrollHeight + 'px'; };

      var reparse = function () {
        parsed = input.value.trim() ? W.Parse.task(input.value, { lists: st.lists, ignore: ignore }) : null;
        U.clear(detected);
        (parsed ? parsed.found : []).forEach(function (f) {
          detected.appendChild(U.el('span.qa-tag', [U.icon(KIND_ICON[f.kind] || 'note'), f.label,
            U.el('button', { attrs: { 'aria-label': 'Descartar ' + f.label, type: 'button' }, on: { click: function () { ignore[f.key] = true; reparse(); input.focus(); } } }, [U.icon('close')])]));
        });
        help.style.display = input.value.trim() ? 'none' : '';
        addBtn.disabled = !input.value.trim();
        drawChips();
      };

      var chip = function (icon, label, on, onTap, extra) {
        var b = U.el('button.chip' + (on ? '.on' : ''), { attrs: { type: 'button' } }, [extra || U.icon(icon), U.el('span', { text: label })]);
        b.addEventListener('click', function () { onTap(b); });
        return b;
      };
      var drawChips = function () {
        U.clear(chips);
        var date = value('date'), time = value('time'), listId = value('listId'), hl = value('highlight'), repeat = value('repeat');
        var l = listId ? st.getList(listId) : null;
        chips.appendChild(chip('calendar', dayLabel(date), !!date, function (b) {
          var opts = [{ value: U.today(), label: 'Hoy', icon: 'sun' }, { value: U.addDays(U.today(), 1), label: 'Mañana', icon: 'calendar' },
            { value: U.addDays(U.today(), (8 - new Date().getDay()) % 7 || 7), label: 'Próximo lunes', icon: 'week' },
            { value: '', label: 'Sin fecha', icon: 'inbox' }, { value: 'pick', label: 'Elegir día…', icon: 'today', gap: true }];
          W.Menu.open(b, opts.map(function (o) { return Object.assign({ on: o.value === (date || '') }, o); })).then(function (v) {
            if (v === undefined) return;
            if (v === 'pick') { pickDate(date); return; }
            manual.date = v || null; if (!v) manual.time = null; drawChips();
          });
        }));
        var timeChip = chip('clock', time ? U.fmtTime(time) : 'Hora', !!time, function () {});
        var ti = U.el('input.overlay-input', { attrs: { type: 'time', 'aria-label': 'Hora' } });
        ti.value = time || '';
        ti.addEventListener('click', function () { try { if (ti.showPicker) ti.showPicker(); } catch (e) { /* lo abre el sistema */ } });
        ti.addEventListener('change', function () { manual.time = ti.value || null; if (manual.time && !value('date')) manual.date = U.today(); drawChips(); });
        timeChip.appendChild(ti);
        chips.appendChild(timeChip);
        chips.appendChild(chip(l ? W.Lists.icon(l) : 'list', l ? l.name : 'Sin categoría', !!l, function (b) {
          W.Menu.open(b, [{ value: '', label: 'Sin lista', on: !l }].concat(st.lists.map(function (x) { return { value: x.id, label: x.name, on: x.id === listId }; })))
            .then(function (v) { if (v !== undefined) { manual.listId = v || null; drawChips(); } });
        }));
        var prio = W.Editor.PRIO_OPTS.filter(function (o) { return o.value === hl; })[0] || W.Editor.PRIO_OPTS[0];
        chips.appendChild(chip('flag', hl === 'none' ? 'Prioridad' : prio.label, hl !== 'none', function (b) {
          W.Menu.open(b, W.Editor.PRIO_OPTS.map(function (o) { return Object.assign({ prio: o.value }, o, { on: o.value === hl }); }))
            .then(function (v) { if (v) { manual.highlight = v; drawChips(); } });
        }, hl !== 'none' ? W.UI.prio(hl) : null));
        chips.appendChild(chip('repeat', repeat === 'none' ? 'Repetir' : st.REPEATS[repeat], repeat !== 'none', function (b) {
          W.Menu.open(b, Object.keys(st.REPEATS).map(function (k) { return { value: k, label: k === 'none' ? 'Nunca' : st.REPEATS[k], on: k === repeat }; }))
            .then(function (v) { if (v) { manual.repeat = v; drawChips(); } });
        }));
      };

      var pickDate = function (cur) {
        var picker = W.UI.datePicker(cur || U.today(), function (ds) { manual.date = ds; drawChips(); ps.close(); });
        var ps = W.Sheet.open({ title: 'Elegir día', body: [U.el('div.group', [U.el('div.cell.col', [picker])])] });
      };

      /** Crea la tarea; con `close`, cierra al terminar (si no, queda lista para la siguiente) */
      var submit = function (close) {
        var raw = input.value.trim();
        if (!raw) { if (close) sheet.close(); return; }
        var p = W.Parse.task(raw, { lists: st.lists, ignore: ignore });
        var fields = {
          text: p.text, date: value('date'), time: value('time'), listId: value('listId'),
          highlight: value('highlight'), repeat: value('repeat'), warn: st.settings.defaultWarn, notes: '', subtasks: []
        };
        if (fields.time && !fields.date) fields.date = U.today();
        var t = st.addTask(fields);
        if (!t) return;
        added++;
        W.Audio.vibrate([8]);
        if (t.warn && t.date && W.Notify.permission() === 'default') W.Notify.request();
        if (close) { sheet.close(); W.Toast.show({ text: 'Tarea añadida: ' + t.text, type: 'success', icon: 'check' }); return; }
        input.value = ''; manual = {}; ignore = {}; autosize(); reparse();
        addedNote.textContent = U.plural(added, 'tarea añadida', 'tareas añadidas');
        input.focus();
      };

      input.addEventListener('input', function () { autosize(); reparse(); });
      input.addEventListener('keydown', function (e) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(false); } });

      var more = U.el('button.btn.ghost', { text: 'Más detalles', on: { click: function () {
        var raw = input.value.trim(), p = raw ? W.Parse.task(raw, { lists: st.lists, ignore: ignore }) : { text: '' };
        var draft = { text: p.text || '', date: value('date'), time: value('time'), listId: value('listId'), highlight: value('highlight'), repeat: value('repeat') };
        sheet.close();
        setTimeout(function () { W.Editor.open(null, draft); }, 300);
      } } });

      var sheet = W.Sheet.open({
        title: 'Nueva tarea', className: 'quick-add',
        body: [U.el('div.qa-box', [input, detected]), chips, W.Templates.row(function () { sheet.close(); }), help, addedNote],
        foot: [more, addBtn],
        onClose: function () { current = null; var f = document.getElementById('fab'); if (f) f.classList.remove('open'); }
      });
      current = sheet;
      var fab = document.getElementById('fab');
      if (fab) fab.classList.add('open');
      reparse();
      setTimeout(function () { input.focus(); }, W.Layout.desktop ? 30 : 380);
      return sheet;
    }
  };

  W.QuickAdd = QuickAdd;
})(window.Whider);
