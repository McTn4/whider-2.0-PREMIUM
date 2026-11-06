/**
 * WHIDER · Filtros guardados (listas personalizadas).
 * Un filtro reúne tareas de varias listas, prioridades y fechas, o que contienen un texto:
 * por ejemplo «Urgente del trabajo» o «Sin fecha». Aparecen en la barra lateral del
 * ordenador y se abren como una página más de Tareas.
 */
window.Whider = window.Whider || {};

(function (W) {
  'use strict';
  var U = W.U, S = function () { return W.State; };

  var WHEN = [
    { value: 'any', label: 'Cualquier fecha' },
    { value: 'today', label: 'Hoy y vencidas' },
    { value: 'week', label: 'Esta semana' },
    { value: 'next7', label: 'Próximos 7 días' },
    { value: 'overdue', label: 'Vencidas' },
    { value: 'dated', label: 'Con fecha' },
    { value: 'nodate', label: 'Sin fecha' }
  ];
  var STATUS = [{ value: 'pending', label: 'Pendientes' }, { value: 'all', label: 'Todas' }, { value: 'done', label: 'Completadas' }];
  var PRIOS = [{ value: 'danger', label: 'Urgente' }, { value: 'purple', label: 'Importante' }, { value: 'star', label: 'Destacada' }, { value: 'none', label: 'Normal' }];

  function labelOf(arr, v) { for (var i = 0; i < arr.length; i++) if (arr[i].value === v) return arr[i].label; return ''; }

  /** Resumen legible: «Trabajo · Urgente · Esta semana» */
  function describe(f) {
    var st = S(), parts = [];
    if (f.lists.length) parts.push(f.lists.map(function (id) { var l = st.getList(id); return l ? l.name : null; }).filter(Boolean).join(', ') || 'Sin lista');
    if (f.priorities.length) parts.push(f.priorities.map(function (p) { return labelOf(PRIOS, p); }).join(', '));
    if (f.when !== 'any') parts.push(labelOf(WHEN, f.when));
    if (f.text) parts.push('«' + f.text + '»');
    if (f.status !== 'pending') parts.push(labelOf(STATUS, f.status));
    return parts.join(' · ') || 'Todas las tareas pendientes';
  }

  /** Grupo de chips de selección múltiple */
  function multi(options, selected, onChange) {
    var wrap = U.el('div.chips.wrap');
    options.forEach(function (o) {
      var on = selected.indexOf(o.value) >= 0;
      var c = U.el('button.chip' + (on ? '.on' : ''), { attrs: { type: 'button', 'aria-pressed': on ? 'true' : 'false' } }, [o.prio ? W.UI.prio(o.prio) : o.icon ? U.icon(o.icon) : null, U.el('span', { text: o.label })]);
      c.addEventListener('click', function () {
        var i = selected.indexOf(o.value);
        if (i >= 0) selected.splice(i, 1); else selected.push(o.value);
        c.classList.toggle('on', i < 0); c.setAttribute('aria-pressed', i < 0 ? 'true' : 'false');
        W.Audio.select(); onChange();
      });
      wrap.appendChild(c);
    });
    return wrap;
  }

  function edit(f, after) {
    var st = S();
    // Plan gratuito: hasta 3 filtros guardados
    if (!f && !W.Plan.gateLimit('filters', st.filters.length, 'filters')) return null;
    var d = f ? JSON.parse(JSON.stringify(f)) : { name: '', lists: [], priorities: [], when: 'any', text: '', status: 'pending' };
    var name = U.el('input.cell-input.title', { attrs: { type: 'text', maxlength: 24, placeholder: 'Nombre del filtro', 'aria-label': 'Nombre del filtro' } });
    name.value = d.name;
    var text = U.el('input.cell-input', { attrs: { type: 'text', maxlength: 40, placeholder: 'Contiene el texto… (opcional)', 'aria-label': 'Texto' } });
    text.value = d.text;
    var preview = U.el('div.sec-f');
    var saveBtn = U.el('button.btn.primary', { text: f ? 'Guardar cambios' : 'Crear filtro', on: { click: function () { save(); } } });
    var refresh = function () {
      d.text = text.value.trim();
      var n = st.filterTasks(Object.assign({}, d, { lists: d.lists, priorities: d.priorities })).length;
      preview.textContent = 'Ahora mismo: ' + U.plural(n, 'tarea', 'tareas') + '.';
      saveBtn.disabled = !name.value.trim();
    };
    name.addEventListener('input', refresh);
    text.addEventListener('input', U.debounce(refresh, 120));
    [name, text].forEach(function (i) { i.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); if (name.value.trim()) save(); } }); });

    var listOpts = st.lists.map(function (l) { return { value: l.id, label: l.name, icon: 'list' }; }).concat([{ value: '', label: 'Sin lista' }]);
    var when = W.UI.cell({ icon: 'calendar', title: 'Fecha', value: labelOf(WHEN, d.when), onTap: function (e, node) {
      W.Menu.choose(node.querySelector('.cell-value'), { value: d.when, options: WHEN }).then(function (v) {
        if (v === undefined) return; d.when = v; node.querySelector('.cell-value span').textContent = labelOf(WHEN, v); refresh();
      });
    } });
    var status = W.UI.segmented(STATUS, d.status, function (v) { d.status = v; refresh(); });

    var save = function () {
      d.name = name.value.trim(); d.text = text.value.trim();
      if (!d.name) { name.focus(); return; }
      var res = st.saveFilter(f ? Object.assign({ id: f.id }, d) : d);
      s.close();
      if (res && after) after(res);
    };
    var body = [
      U.el('div.group', [U.el('label.cell', [name])]),
      W.UI.section({ header: 'Listas', items: U.el('div.group', [U.el('div.cell.col', [multi(listOpts, d.lists, refresh)])]), footer: 'Sin elegir ninguna, cuentan todas.' }),
      W.UI.section({ header: 'Prioridad', items: U.el('div.group', [U.el('div.cell.col', [multi(PRIOS.map(function (p) { return Object.assign({ prio: p.value === 'none' ? null : p.value }, p); }), d.priorities, refresh)])]) }),
      W.UI.section({ header: 'Fecha y texto', items: [when, U.el('label.cell', [text])] }),
      W.UI.section({ header: 'Estado', items: U.el('div', [status]) }),
      preview
    ];
    if (f) body.push(U.el('div.group', [W.UI.cell({ title: 'Eliminar el filtro', center: true, danger: true, onTap: function () { s.close(); setTimeout(function () { remove(f); }, 200); } })]));
    var s = W.Sheet.open({ title: f ? 'Editar filtro' : 'Nuevo filtro', className: 'editor', full: true, body: body, foot: [saveBtn] });
    refresh();
    if (!f) setTimeout(function () { name.focus(); }, W.Layout.desktop ? 30 : 380);
    return s;
  }

  function remove(f, after) {
    W.Sheet.confirm({ title: '¿Eliminar el filtro «' + f.name + '»?', text: 'Sus tareas no se borran.', ok: 'Eliminar', danger: true }).then(function (ok) {
      if (!ok) return;
      var st = S(), v = st.ui.taskView;
      if (v && v.type === 'filter' && v.id === f.id && st.activeScreen === 'tasks') W.Screens.tasks.back();
      st.removeFilter(f.id);
      if (after) after();
    });
  }

  /** Menú del botón derecho (barra lateral) */
  function menu(f, at) {
    var st = S(), i = st.filters.indexOf(f);
    W.Menu.open(at, [
      { value: 'open', label: 'Abrir', icon: 'filter' },
      { value: 'edit', label: 'Editar…', icon: 'edit' },
      { value: 'up', label: 'Subir', icon: 'up', gap: true, disabled: i <= 0 },
      { value: 'down', label: 'Bajar', icon: 'down', disabled: i === st.filters.length - 1 },
      { value: 'remove', label: 'Eliminar filtro', icon: 'trash', destructive: true, gap: true }
    ]).then(function (v) {
      if (v === 'open') W.Sidebar.openView({ type: 'filter', id: f.id });
      else if (v === 'edit') edit(f);
      else if (v === 'up' || v === 'down') move(f.id, v === 'up' ? -1 : 1);
      else if (v === 'remove') remove(f);
    });
  }

  function move(id, delta) { S().moveFilter(id, delta); }

  W.Filters = { WHEN: WHEN, STATUS: STATUS, edit: edit, remove: remove, menu: menu, move: move, describe: describe };
})(window.Whider);
