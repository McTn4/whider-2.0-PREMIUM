// @ts-check
/**
 * WHIDER · Asistente para importar desde otras apps
 *  1. De dónde: Todoist, Google Tasks, Notion, un calendario (.ics) o una hoja de cálculo, con cómo
 *     exportar en cada una.
 *  2. El archivo (de Todoist, varios a la vez: uno por proyecto).
 *  3. En una hoja de cálculo o en Notion, qué columna es cada cosa (ya viene adivinado).
 *  4. Vista previa: cuántas, cuáles ya tienes, categorías nuevas y lo que no se pudo entender.
 *  5. Importar. Se puede deshacer durante un día desde el aviso o desde Ajustes → Datos.
 * La lectura de cada formato está en js/core/importer.js (con sus pruebas).
 */
window.Whider = window.Whider || {};

(function (W) {
  'use strict';
  var U = W.U, S = function () { return W.State; }, I = function () { return W.Importer; };
  var DAY = 86400000;
  var SOURCES = [
    { id: 'todoist', icon: 'check', title: W.t('Todoist'), sub: W.t('CSV de cada proyecto'), accept: '.csv,text/csv', multiple: true,
      how: W.t('En Todoist, abre el proyecto → menú (⋯) → «Exportar como CSV». Puedes elegir varios archivos a la vez, uno por proyecto.') },
    { id: 'gtasks', icon: 'tasks', title: W.t('Google Tasks'), sub: W.t('Tasks.json de Google Takeout'), accept: '.json,application/json',
      how: W.t('Entra en takeout.google.com, marca solo «Tasks», descarga el archivo y descomprímelo: dentro está Tasks.json.') },
    { id: 'notion', icon: 'database', title: W.t('Notion'), sub: W.t('CSV de una base de datos'), accept: '.csv,text/csv',
      how: W.t('En Notion, abre la base de datos → menú (⋯) → «Exportar» → «Markdown y CSV». Descomprime el archivo y elige el .csv.') },
    { id: 'ics', icon: 'calendar', title: W.t('Calendario'), sub: W.t('Google Calendar, Outlook o Apple (.ics)'), accept: '.ics,text/calendar',
      how: W.t('Google Calendar: Configuración → Importar y exportar → Exportar. Outlook: Calendario → Compartir → Publicar. Apple Calendario: Archivo → Exportar.') },
    { id: 'csv', icon: 'table', title: W.t('Hoja de cálculo'), sub: W.t('Cualquier CSV: Excel, Numbers o Google Sheets'), accept: '.csv,text/csv',
      how: W.t('Guarda la hoja como CSV. Después eliges qué columna es la tarea, la fecha, la categoría…') }
  ];
  var FIELDS = [
    { k: 'text', label: W.t('Tarea'), need: true }, { k: 'date', label: W.t('Fecha') }, { k: 'time', label: W.t('Hora') }, { k: 'list', label: W.t('Categoría') },
    { k: 'priority', label: W.t('Prioridad') }, { k: 'notes', label: W.t('Notas') }, { k: 'done', label: W.t('Estado o hecha') }
  ];
  var PRIO_TEXT = { danger: W.t('Urgente'), purple: W.t('Importante'), star: W.t('Destacada') };

  /** Elegir uno o varios archivos de texto → [{ name, text }] */
  function pickFiles(accept, multiple) {
    return new Promise(function (resolve) {
      var input = /** @type {HTMLInputElement} */ (U.el('input', { attrs: { type: 'file', accept: accept }, style: { display: 'none' } }));
      if (multiple) input.multiple = true;
      input.addEventListener('change', function () {
        var files = Array.prototype.slice.call(input.files || []);
        input.remove();
        Promise.all(files.map(function (f) {
          return new Promise(function (r) {
            var fr = new FileReader();
            fr.onload = function () { r({ name: f.name, text: String(fr.result || '') }); };
            fr.onerror = function () { r(null); };
            fr.readAsText(f);
          });
        })).then(function (list) { resolve(list.filter(Boolean)); });
      });
      document.body.appendChild(input);
      input.click();
    });
  }

  function open() {
    var host = U.el('div.imp');
    var sheet = W.Sheet.open({ title: W.t('Importar desde otras apps'), body: [host], className: 'importer' });
    var show = function (nodes) { U.clear(host); U.append(host, nodes); host.scrollTop = 0; };

    /* 1. De dónde */
    var step1 = function () {
      show([
        U.el('p.imp-lead', { text: W.t('Trae tus tareas de otra app. Antes de importar verás una vista previa; nada se borra de lo que ya tienes.') }),
        W.UI.section({ items: SOURCES.map(function (src) { return W.UI.cell({ icon: src.icon, title: src.title, sub: src.sub, onTap: function () { step2(src); } }); }) })
      ]);
    };

    /* 2. El archivo */
    var step2 = function (src, error) {
      var pick = U.el('button.btn.primary', { text: src.multiple ? W.t('Elegir los archivos') : W.t('Elegir el archivo'), on: { click: function () {
        pickFiles(src.accept, src.multiple).then(function (files) { if (files.length) read(src, files); });
      } } });
      show([
        U.el('button.link-btn.imp-back', { text: W.t('‹ Otra app'), on: { click: step1 } }),
        U.el('h3.imp-title', { text: src.title }),
        U.el('p.imp-how', { text: src.how }),
        error ? U.el('p.imp-error', { attrs: { role: 'alert' }, text: error }) : null,
        U.el('div.imp-actions', [pick])
      ]);
    };

    var read = function (src, files) {
      var kind = src.id, first = files[0];
      var seen = I().detect(first.name, first.text);
      // Si el archivo es de otro tipo, se lee como lo que es
      if (seen && seen !== kind && !(kind === 'csv' && seen === 'notion') && !(kind === 'notion' && seen === 'csv')) {
        var other = SOURCES.filter(function (s) { return s.id === seen; })[0];
        if (other) { W.Toast.show({ text: W.t('Parece un archivo de {title}: se lee como tal', { title: other.title }), icon: 'info' }); src = other; kind = seen; }
      }
      if (kind === 'csv' || kind === 'notion') {
        var rows = I().csv(first.text);
        if (rows.length < 2) { step2(src, W.t('El archivo no tiene filas con tareas.')); return; }
        mapping(src, rows);
        return;
      }
      var items = [], warnings = [], err = null;
      files.forEach(function (f) {
        var r = kind === 'todoist' ? I().todoist(f.text, f.name) : kind === 'gtasks' ? I().gtasks(f.text) : I().ics(f.text, { past: false });
        if (r.error) err = '«' + f.name + '»: ' + r.warnings[0];
        else { items = items.concat(r.items); warnings = warnings.concat(r.warnings); }
      });
      if (err && !items.length) { step2(src, err); return; }
      if (err) warnings.unshift(err);
      preview(src, items, warnings, { files: files });
    };

    /* 3. Qué columna es cada cosa (hoja de cálculo y Notion) */
    var mapping = function (src, rows) {
      var head = rows[0], map = I().guess(head), sample = rows[1] || [];
      var selects = FIELDS.map(function (f) {
        var sel = /** @type {HTMLSelectElement} */ (U.el('select.imp-sel', { attrs: { 'aria-label': f.label } }));
        if (!f.need) sel.appendChild(U.el('option', { attrs: { value: '-1' }, text: W.t('— Ninguna —') }));
        head.forEach(function (h, i) { sel.appendChild(U.el('option', { attrs: { value: String(i) }, text: (h || W.t('Columna {n}', { n: i + 1 })) + (sample[i] ? ' · ' + String(sample[i]).slice(0, 24) : '') })); });
        sel.value = String(map[f.k]);
        sel.addEventListener('change', function () { map[f.k] = +sel.value; });
        return U.el('label.cell.imp-map', [U.el('span.cell-title', { text: f.label }), sel]);
      });
      show([
        U.el('button.link-btn.imp-back', { text: W.t('‹ Otro archivo'), on: { click: function () { step2(src); } } }),
        U.el('h3.imp-title', { text: W.t('Qué es cada columna') }),
        U.el('p.imp-how', { text: W.t('Lo hemos adivinado por los nombres de las columnas; cámbialo si no acierta.') }),
        U.el('div.group', selects),
        U.el('div.imp-actions', [U.el('button.btn.primary', { text: W.t('Ver la vista previa'), on: { click: function () {
          var r = I().fromRows(rows.slice(1), map);
          preview(src, r.items, r.warnings, { rows: rows, map: map });
        } } })])
      ]);
    };

    /* 4. Vista previa */
    var preview = function (src, items, warnings, ctx) {
      var st = S(), opts = { done: false, dups: false, past: false };
      var draw = function () {
        var dups = I().markDuplicates(items, st.tasks);
        var chosen = items.filter(function (t) { return (opts.done || !t.done) && (opts.dups || !t.dup); });
        var have = {};
        st.lists.forEach(function (l) { have[l.name.toLowerCase()] = true; });
        var newLists = [];
        chosen.forEach(function (t) { var n = (t.listName || '').trim(); if (n && !have[n.toLowerCase()] && newLists.indexOf(n) < 0) newLists.push(n); });
        var doneN = items.filter(function (t) { return t.done; }).length;
        var facts = [U.plural(chosen.length, 'tarea para importar', 'tareas para importar')];
        if (dups) facts.push(U.plural(dups, 'ya la tienes', 'ya las tienes') + ' ' + (opts.dups ? W.t('(se importan igualmente)') : W.t('(no se importan)')));
        if (doneN && !opts.done) facts.push(U.plural(doneN, 'completada no se importa', 'completadas no se importan'));
        if (newLists.length) facts.push(W.t('categorías nuevas: {list}', { list: newLists.slice(0, 4).join(', ') + (newLists.length > 4 ? '…' : '') }));
        var toggles = [
          doneN ? W.UI.cell({ title: W.t('Importar también las completadas'), right: W.UI.toggle(opts.done, function (v) { opts.done = v; draw(); }, W.t('Importar también las completadas')) }) : null,
          dups ? W.UI.cell({ title: W.t('Importar también las que ya tengo'), right: W.UI.toggle(opts.dups, function (v) { opts.dups = v; draw(); }, W.t('Importar también las que ya tengo')) }) : null,
          src.id === 'ics' && ctx.files ? W.UI.cell({ title: W.t('Incluir los eventos pasados'), right: W.UI.toggle(opts.past, function (v) {
            opts.past = v;
            var all = [], warn = [];
            ctx.files.forEach(function (f) { var r = I().ics(f.text, { past: v }); if (!r.error) { all = all.concat(r.items); warn = warn.concat(r.warnings); } });
            items = all; warnings = warn; draw();
          }, W.t('Incluir los eventos pasados')) }) : null
        ].filter(Boolean);
        var rows = chosen.slice(0, 8).map(function (t) {
          var bits = [t.date ? U.fmtDay(t.date) + (t.time ? ', ' + U.fmtTime(t.time) : '') : W.t('Sin fecha'), t.listName, PRIO_TEXT[t.highlight], t.repeat !== 'none' ? W.t('se repite') : '', t.subtasks.length ? U.plural(t.subtasks.length, 'subtarea', 'subtareas') : '', t.done ? 'completada' : ''].filter(Boolean);
          return W.UI.cell({ title: t.text, sub: bits.join(' · ') });
        });
        show([
          U.el('button.link-btn.imp-back', { text: ctx.rows ? W.t('‹ Columnas') : W.t('‹ Otro archivo'), on: { click: function () { if (ctx.rows) mapping(src, ctx.rows); else step2(src); } } }),
          U.el('h3.imp-title', { text: W.t('Vista previa') }),
          U.el('p.imp-facts', { attrs: { 'aria-live': 'polite' }, text: facts.join(' · ') + '.' }),
          toggles.length ? U.el('div.group', toggles) : null,
          rows.length ? W.UI.section({ header: chosen.length > 8 ? W.t('Las 8 primeras de {length}', { length: chosen.length }) : W.t('Se importarán'), items: rows }) : U.el('p.hint', { text: W.t('No hay nada nuevo que importar.') }),
          warnings.length ? W.UI.section({ header: W.t('Avisos'), items: U.el('ul.imp-warn', warnings.slice(0, 6).map(function (w) { return U.el('li', { text: w }); }).concat(warnings.length > 6 ? [U.el('li', { text: W.t('Y {0} más.', { 0: warnings.length - 6 }) })] : [])) }) : null,
          U.el('div.imp-actions', [U.el('button.btn.primary', { text: W.t('Importar {n}', { n: U.plural(chosen.length, 'tarea', 'tareas') }), attrs: chosen.length ? {} : { disabled: 'disabled' }, on: { click: function () { run(src, chosen); } } })])
        ]);
      };
      draw();
    };

    /* 5. Importar (y poder deshacer) */
    var run = function (src, chosen) {
      var st = S(), created = [], byName = {};
      st.lists.forEach(function (l) { byName[l.name.toLowerCase()] = l; });
      var items = chosen.map(function (t) {
        var n = (t.listName || '').trim(), l = n ? byName[n.toLowerCase()] : null;
        if (n && !l) { l = st.addList(n, null, 'list'); byName[n.toLowerCase()] = l; created.push(l.id); }
        return { id: U.uid(), text: t.text, notes: t.notes, date: t.date, time: t.time, done: t.done, doneOn: t.doneOn, doneAt: t.doneAt, highlight: t.highlight,
          repeat: t.repeat, days: t.days, duration: t.duration, listId: l ? l.id : (n ? null : st.defaultListId()), subtasks: t.subtasks, warn: false };
      });
      var n = st.importTasks(items);
      st.setMeta('lastImport', { at: Date.now(), from: src.title, ids: items.map(function (x) { return x.id; }), lists: created });
      sheet.close();
      W.Toast.show({ text: W.t('{n} de {from}', { n: U.plural(n, 'tarea importada', 'tareas importadas'), from: src.title }), type: 'success', icon: 'upload', duration: 8000,
        action: { label: W.t('Deshacer'), fn: function () { Wizard.undo(); } } });
    };

    step1();
    return sheet;
  }

  var Wizard = {
    open: open,
    /** La última importación, si se puede deshacer (durante un día) */
    last: function () { var x = S().meta.lastImport; return x && Date.now() - x.at < DAY ? x : null; },
    /** Quita lo importado (y las categorías creadas, si se quedaron vacías) */
    undo: function () {
      var st = S(), x = Wizard.last();
      if (!x) return 0;
      var ids = x.ids.filter(function (id) { return !!st.find(id); });
      if (ids.length) st.bulkRemove(ids);
      (x.lists || []).forEach(function (lid) { if (st.getList(lid) && !st.tasks.some(function (t) { return t.listId === lid; })) st.removeList(lid); });
      st.setMeta('lastImport', null);
      W.Toast.show({ text: W.t('Importación deshecha: {n}', { n: U.plural(ids.length, 'tarea quitada', 'tareas quitadas') }), icon: 'undo' });
      return ids.length;
    }
  };

  W.ImportWizard = Wizard;
})(window.Whider);
