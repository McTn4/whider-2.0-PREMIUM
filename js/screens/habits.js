/**
 * WHIDER · Hábitos (móvil y ordenador)
 *  - Lista con el botón para marcar el día, la racha y la semana en curso.
 *  - Editor: nombre, icono, frecuencia (cada día, días concretos o X veces por semana),
 *    objetivo diario con unidad y recordatorio a una hora.
 *  - Detalle: racha actual y mejor racha, porcentaje del último mes, total y mapa de 18 semanas.
 *  - En el ordenador, además, una cuadrícula con los últimos 7, 14 o 30 días para marcar de un vistazo.
 */
window.Whider = window.Whider || {};
window.Whider.Screens = window.Whider.Screens || {};

(function (W) {
  'use strict';
  var U = W.U, S = function () { return W.State; }, H = function () { return W.Habits; };

  var SUGGEST = [
    { name: 'Beber agua', icon: 'coffee', target: 8, unit: 'vasos' },
    { name: 'Leer 20 minutos', icon: 'note' },
    { name: 'Meditar', icon: 'moon' },
    { name: 'Hacer ejercicio', icon: 'flame', freq: 'weekly', perWeek: 3 },
    { name: 'Caminar 30 minutos', icon: 'bolt' },
    { name: 'Dormir 8 horas', icon: 'moon' }
  ];
  var FREQS = [{ value: 'daily', label: 'Cada día' }, { value: 'days', label: 'Días concretos' }, { value: 'weekly', label: 'Veces por semana' }];

  function weekStart(ds) { var ws = S().settings.weekStart; return U.addDays(ds, -((U.weekday(ds) - ws + 7) % 7)); }
  function checkSvg() { return U.svg('svg', { viewBox: '0 0 24 24' }, [U.svg('path', { d: 'm5 12.6 4.5 4.5L19 7.6' })]); }

  /* ---------- Piezas ---------- */
  /** Botón para marcar: ✓ o «3/8» en los hábitos con objetivo */
  function checkBtn(h, ds) {
    var n = H().count(h, ds), done = n >= h.target;
    var b = U.el('button.hcheck' + (done ? '.on' : '') + (h.target > 1 ? '.count' : '') + (n > 0 && !done ? '.partial' : ''), {
      style: h.target > 1 ? { '--p': Math.round(Math.min(n, h.target) / h.target * 100) } : null,
      attrs: { type: 'button', 'aria-pressed': done ? 'true' : 'false', title: h.target > 1 ? 'Sumar uno (' + n + ' de ' + h.target + ')' : done ? 'Desmarcar' : 'Marcar como hecho',
        'aria-label': (done ? 'Hecho: ' : 'Marcar: ') + h.name + (h.target > 1 ? ', ' + n + ' de ' + h.target : '') }
    }, h.target > 1 ? [U.el('span', { text: n + '/' + h.target })] : [checkSvg()]);
    b.addEventListener('click', function (e) { e.stopPropagation(); H().tap(h, ds); });
    b.addEventListener('contextmenu', function (e) {
      if (h.target <= 1) return;
      e.preventDefault(); e.stopPropagation();
      S().setHabitCount(h.id, ds, Math.max(0, n - 1));   // clic derecho: resta uno
    });
    return b;
  }

  /** Semana en curso: una casilla por día (se puede marcar cualquier día pasado) */
  function weekStrip(h) {
    var td = U.today(), start = weekStart(td);
    return U.el('div.hweek', [0, 1, 2, 3, 4, 5, 6].map(function (i) {
      var ds = U.addDays(start, i), future = ds > td, due = H().isDue(h, ds), done = H().isDone(h, ds);
      var b = U.el('button.hday' + (done ? '.done' : '') + (due ? '.due' : '.off') + (ds === td ? '.today' : '') + (future ? '.future' : ''), {
        attrs: { type: 'button', title: U.fmtLong(ds) + (done ? ' · hecho' : due && !future ? ' · sin hacer' : ''), 'aria-label': U.fmtLong(ds) + (done ? ', hecho' : '') }
      }, [U.el('small', { text: U.WEEKDAYS_LETTER[U.weekday(ds)] })]);
      if (future) b.disabled = true;
      else b.addEventListener('click', function (e) { e.stopPropagation(); H().tap(h, ds); });
      return b;
    }));
  }

  /** Fila de un hábito: marcar, nombre con su racha y (opcional) la semana */
  function habitRow(h, opts) {
    opts = opts || {};
    var td = U.today(), st = H().stats(h);
    var meta = [U.el('span', { text: H().freqLabel(h) })];
    if (h.freq === 'weekly') meta.push(U.el('span', { text: st.week + ' de ' + h.perWeek + ' esta semana' }));
    if (st.streak) meta.push(U.el('span.hstreak', [U.icon('flame', 'xs'), U.el('b', { text: String(st.streak) })]));
    if (h.reminder && !opts.compact) meta.push(U.el('span.hrem', [U.icon('bell', 'xs'), U.fmtTime(h.reminder)]));
    var main = U.el('div.hmain', [U.el('span.htitle', [U.icon(h.icon, 'sm'), U.el('span', { text: h.name })]),
      U.el('div.hmeta', meta.reduce(function (acc, m, i) { if (i) acc.push(U.el('span.sep', { text: '·' })); acc.push(m); return acc; }, []))]);
    var row = U.el('li.habit-row' + (H().isDone(h, td) ? '.is-done' : '') + (h.archived ? '.archived' : ''), { attrs: { 'data-habit': h.id } }, [
      h.archived ? U.el('span.hcheck.ghost', [U.icon(h.icon, 'sm')]) : checkBtn(h, td), main, opts.week ? weekStrip(h) : null
    ]);
    main.addEventListener('click', function () { HabitView.open(h.id); });
    row.addEventListener('contextmenu', function (e) { e.preventDefault(); HabitView.menu(h, { x: e.clientX, y: e.clientY }); });
    return row;
  }

  /** Mapa de cumplimiento: 18 semanas, más luz cuanto más cerca del objetivo */
  function heat(h, weeks) {
    var td = U.today(), end = U.addDays(weekStart(td), 6), start = U.addDays(end, -(weeks * 7 - 1)), born = U.ymd(new Date(h.createdAt));
    var cols = [];
    for (var w = 0; w < weeks; w++) {
      var col = U.el('div.heat-col');
      for (var i = 0; i < 7; i++) {
        var ds = U.addDays(start, w * 7 + i), n = H().count(h, ds);
        var lvl = ds > td ? 'lx' : n >= h.target ? 'l4' : n > 0 ? (n / h.target >= .5 ? 'l3' : 'l2') : (H().isDue(h, ds) && ds >= born ? 'l0' : 'lx');
        col.appendChild(U.el('i.' + lvl + (ds === td ? '.today' : ''), { attrs: { title: U.fmtLong(ds) + (n ? ' · ' + n + (h.target > 1 ? ' de ' + h.target : '') : '') } }));
      }
      cols.push(col);
    }
    return U.el('div.heat.hheat', cols);
  }

  function statTiles(h) {
    var s = H().stats(h), unit = h.freq === 'weekly' ? ['semana', 'semanas'] : ['día', 'días'];
    var tile = function (v, l) { return U.el('div', [U.el('strong', { text: v }), U.el('span', { text: l })]); };
    return U.el('div.group.stats.hstats', [
      tile(String(s.streak), 'Racha (' + (s.streak === 1 ? unit[0] : unit[1]) + ')'),
      tile(String(s.best), 'Mejor racha'),
      tile(s.rate30 == null ? '—' : s.rate30 + '%', 'Último mes'),
      tile(String(s.total), 'Días cumplidos')
    ]);
  }

  /* ---------- Editor ---------- */
  function editor(id, preset) {
    var st = S(), src = id ? st.getHabit(id) : null;
    var d = src ? JSON.parse(JSON.stringify(src)) : Object.assign({ name: '', icon: 'target', freq: 'daily', days: [1, 2, 3, 4, 5], perWeek: 3, target: 1, unit: '', reminder: null }, preset || {});
    var name = U.el('input.cell-input.title', { attrs: { type: 'text', maxlength: 40, placeholder: 'Nombre del hábito', 'aria-label': 'Nombre del hábito', enterkeyhint: 'done' } });
    name.value = d.name;
    var saveBtn = U.el('button.btn.primary', { text: src ? 'Guardar cambios' : 'Crear hábito', on: { click: function () { save(); } } });
    var sync = function () { saveBtn.disabled = !name.value.trim(); };
    name.addEventListener('input', sync);
    name.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); if (name.value.trim()) save(); } });

    var icons = U.el('div.icon-pick', H().ICONS.map(function (ic) {
      var b = U.el('button' + (ic === d.icon ? '.active' : ''), { attrs: { type: 'button', 'aria-label': 'Icono ' + ic } }, [U.icon(ic)]);
      b.addEventListener('click', function () { d.icon = ic; U.$$('button', icons).forEach(function (x) { x.classList.toggle('active', x === b); }); W.Audio.select(); });
      return b;
    }));

    var freqHost = U.el('div.cell.col');
    var drawFreq = function () {
      U.clear(freqHost);
      freqHost.appendChild(W.UI.segmented(FREQS, d.freq, function (v) { d.freq = v; drawFreq(); }));
      if (d.freq === 'days') {
        freqHost.appendChild(U.el('div.day-pick', H().DAY_ORDER().map(function (wd) {
          var on = d.days.indexOf(wd) >= 0;
          var b = U.el('button' + (on ? '.on' : ''), { attrs: { type: 'button', 'aria-pressed': on ? 'true' : 'false', title: U.WEEKDAYS[wd] }, text: U.WEEKDAYS_LETTER[wd] });
          b.addEventListener('click', function () {
            var i = d.days.indexOf(wd);
            if (i >= 0) { if (d.days.length > 1) d.days.splice(i, 1); } else d.days.push(wd);
            drawFreq(); W.Audio.select();
          });
          return b;
        })));
      } else if (d.freq === 'weekly') {
        freqHost.appendChild(U.el('div.cell-row.hfreq-row', [U.el('span', { text: 'Veces por semana' }),
          W.UI.stepper(d.perWeek, 1, 7, 1, function (v) { d.perWeek = v; })]));
      }
    };
    drawFreq();

    var unit = U.el('input.cell-input', { attrs: { type: 'text', maxlength: 14, placeholder: 'Unidad (vasos, páginas…)', 'aria-label': 'Unidad' } });
    unit.value = d.unit || '';
    var unitRow = U.el('label.cell', [unit]);
    var targetRow = W.UI.cell({ title: 'Objetivo diario', right: W.UI.stepper(d.target, 1, 50, 1, function (v) { d.target = v; unitRow.style.display = v > 1 ? '' : 'none'; }, function (v) { return v === 1 ? '1 vez' : v + ' veces'; }) });
    unitRow.style.display = d.target > 1 ? '' : 'none';

    var remPill = U.el('span.pill.accent', { text: U.fmtTime(d.reminder || '09:00') });
    var remInput = U.el('input.overlay-input', { attrs: { type: 'time', 'aria-label': 'Hora del recordatorio' } });
    remInput.value = d.reminder || '09:00';
    remInput.addEventListener('change', function () { if (remInput.value) { d.reminder = remInput.value; remPill.firstChild.textContent = U.fmtTime(remInput.value); } });
    remPill.appendChild(remInput);
    var remTime = W.UI.cell({ title: 'Hora', right: remPill });
    var remRow = W.UI.cell({ icon: 'bell', title: 'Recordármelo', right: W.UI.toggle(!!d.reminder, function (v) { d.reminder = v ? (remInput.value || '09:00') : null; remTime.style.display = v ? '' : 'none'; }, 'Recordatorio') });
    remTime.style.display = d.reminder ? '' : 'none';

    var body = [];
    if (!src) {
      body.push(U.el('div.chips.wrap.hsuggest', SUGGEST.map(function (sg) {
        var c = U.el('button.chip', { attrs: { type: 'button' } }, [U.icon(sg.icon), U.el('span', { text: sg.name })]);
        c.addEventListener('click', function () { s.close(); setTimeout(function () { editor(null, Object.assign({ freq: 'daily', perWeek: 3, target: 1, unit: '' }, sg)); }, 200); });
        return c;
      })));
    }
    body.push(U.el('div.group', [U.el('label.cell', [name])]));
    body.push(W.UI.section({ header: 'Icono', items: U.el('div.group', [U.el('div.cell.col', [icons])]) }));
    body.push(W.UI.section({ header: 'Frecuencia', items: U.el('div.group', [freqHost]) }));
    body.push(W.UI.section({ header: 'Objetivo', items: [targetRow, unitRow], footer: 'Con más de una vez al día, cada toque suma una (por ejemplo, 8 vasos de agua).' }));
    body.push(W.UI.section({ header: 'Recordatorio', items: [remRow, remTime], footer: 'Te avisa a esa hora si todavía no lo has marcado.' }));
    if (src) {
      body.push(W.UI.section({ items: [
        W.UI.cell({ title: src.archived ? 'Recuperar el hábito' : 'Archivar el hábito', center: true, onTap: function () { st.updateHabit(src.id, { archived: !src.archived }); s.close(); } }),
        W.UI.cell({ title: 'Eliminar el hábito', center: true, danger: true, onTap: function () {
          W.Sheet.confirm({ title: '¿Eliminar «' + src.name + '»?', text: 'Se borra también su historial. Si solo quieres dejarlo de momento, mejor archívalo.', ok: 'Eliminar', danger: true })
            .then(function (ok) {
              if (!ok) return;
              var snap = st.removeHabit(src.id); s.close();
              W.Toast.show({ text: 'Hábito eliminado', icon: 'trash', action: { label: 'Deshacer', fn: function () { st.restoreHabit(snap); } } });
            });
        } })
      ], footer: 'Archivado, deja de aparecer en Hoy pero conserva su historial.' }));
    }
    var save = function () {
      d.name = name.value.trim(); d.unit = unit.value.trim();
      if (!d.name) { name.focus(); return; }
      if (src) st.updateHabit(src.id, d); else st.addHabit(d);
      W.Audio.vibrate([8]);
      s.close();
    };
    var s = W.Sheet.open({ title: src ? 'Editar hábito' : 'Nuevo hábito', className: 'editor', full: true, body: body, foot: [saveBtn] });
    sync();
    if (!src) setTimeout(function () { name.focus(); }, W.Layout.desktop ? 30 : 380);
    return s;
  }

  /* ---------- Detalle ---------- */
  function detail(id) {
    var st = S(), h = st.getHabit(id);
    if (!h) return null;
    var host = U.el('div.hdetail');
    var draw = function () {
      h = st.getHabit(id);
      if (!h) { s.close(); return; }
      U.clear(host);
      var td = U.today(), n = H().count(h, td), done = n >= h.target;
      var today = h.target > 1
        ? U.el('div.group', [W.UI.cell({ title: 'Hoy', sub: H().targetLabel(h), right: W.UI.stepper(n, 0, Math.max(h.target, 99), 1, function (v) { st.setHabitCount(h.id, td, v); }, function (v) { return v + ' de ' + h.target; }) })])
        : U.el('button.btn.block' + (done ? '.ghost' : '.primary'), { on: { click: function () { H().tap(h, td); } } }, [U.icon(done ? 'reset' : 'check', 'sm'), done ? 'Hecho hoy · desmarcar' : 'Marcar hoy como hecho']);
      host.appendChild(U.el('div.hhead', [U.el('span.hbadge', [U.icon(h.icon)]), U.el('div', [
        U.el('strong', { text: h.name }),
        U.el('span', { text: [H().freqLabel(h), H().targetLabel(h), h.reminder ? 'aviso a las ' + U.fmtTime(h.reminder) : ''].filter(Boolean).join(' · ') })
      ])]));
      host.appendChild(today);
      host.appendChild(statTiles(h));
      host.appendChild(W.UI.section({ header: 'Últimas 18 semanas', items: U.el('div.group.card', [heat(h, 18)]) }));
      host.appendChild(W.UI.section({ header: 'Esta semana', items: U.el('div.group.card', [weekStrip(h)]) }));
    };
    var unsub = st.subscribe(function (reason) { if (reason === 'habit' || reason === 'habits' || reason === 'sync') draw(); });
    var s = W.Sheet.open({ title: 'Hábito', className: 'editor', full: true, body: [host],
      foot: [U.el('button.btn.ghost', { on: { click: function () { s.close(); setTimeout(function () { editor(id); }, 200); } } }, [U.icon('edit', 'sm'), 'Editar'])],
      onClose: function () { unsub(); } });
    draw();
    return s;
  }

  var HabitView = {
    open: detail,
    edit: editor,
    row: habitRow,
    weekStrip: weekStrip,
    /** Menú del botón derecho */
    menu: function (h, at) {
      var st = S(), td = U.today();
      W.Menu.open(at, [
        { value: 'tap', label: H().isDone(h, td) ? 'Desmarcar hoy' : 'Marcar hoy', icon: 'check' },
        { value: 'open', label: 'Ver detalle', icon: 'chart' },
        { value: 'edit', label: 'Editar…', icon: 'edit' },
        { value: 'up', label: 'Subir', icon: 'up', gap: true },
        { value: 'down', label: 'Bajar', icon: 'down' },
        { value: 'archive', label: h.archived ? 'Recuperar' : 'Archivar', icon: 'tray', gap: true }
      ]).then(function (v) {
        if (v === 'tap') H().tap(h, td);
        else if (v === 'open') detail(h.id);
        else if (v === 'edit') editor(h.id);
        else if (v === 'up') st.moveHabit(h.id, -1);
        else if (v === 'down') st.moveHabit(h.id, 1);
        else if (v === 'archive') st.updateHabit(h.id, { archived: !h.archived });
      });
    },
    /** Bloque «Hábitos de hoy» (pantalla Hoy, en el móvil y en el lateral del ordenador) */
    today: function () {
      var st = S(), list = H().dueToday();
      if (!H().list().length) {
        if (st.meta.habitsHint) return null;
        return W.UI.section({ title: 'Hábitos', items: U.el('div.group', [W.UI.cell({ icon: 'target', title: 'Crea tu primer hábito', sub: 'Beber agua, leer, hacer ejercicio…', onTap: function () { editor(null); },
          right: U.el('button.circle-btn', { attrs: { 'aria-label': 'No mostrar' }, on: { click: function (e) { e.stopPropagation(); st.setMeta('habitsHint', true); W.Router.refresh(); } } }, [U.icon('close')]) })]) });
      }
      if (!list.length) return null;
      var sum = H().todaySummary();
      return W.UI.section({ title: 'Hábitos de hoy', cls: 'habits-today',
        side: U.el('button.link-btn.muted', { text: sum.done + ' de ' + sum.total, attrs: { title: 'Ver todos los hábitos' }, on: { click: function () { W.Router.go('habits'); } } }),
        items: U.el('ul.group.habit-list.compact', list.map(function (h) { return habitRow(h, { compact: true }); })) });
    }
  };
  W.HabitView = HabitView;

  /* ---------- Pantalla ---------- */
  function desktopGrid(st) {
    var range = st.ui.habitRange || 14, td = U.today(), days = [];
    for (var i = range - 1; i >= 0; i--) days.push(U.addDays(td, -i));
    var list = H().list();
    var cols = 'minmax(220px, 1.6fr) repeat(' + range + ', minmax(22px, 1fr)) 64px 64px 64px';
    var head = U.el('div.hg-row.hg-head', { style: { gridTemplateColumns: cols } }, [U.el('span', { text: 'Hábito' })].concat(days.map(function (ds) {
      return U.el('span.hg-day' + (ds === td ? '.today' : ''), { attrs: { title: U.fmtLong(ds) } }, [U.el('small', { text: U.WEEKDAYS_LETTER[U.weekday(ds)] }), U.el('b', { text: U.parse(ds).getDate() })]);
    })).concat([U.el('span.hg-num', { text: 'Racha' }), U.el('span.hg-num', { text: 'Mejor' }), U.el('span.hg-num', { text: '30 días' })]));
    var rows = list.map(function (h) {
      var s = H().stats(h);
      var name = U.el('button.hg-name', { attrs: { type: 'button', title: 'Ver detalle' }, on: { click: function () { detail(h.id); } } },
        [U.icon(h.icon, 'sm'), U.el('span', [U.el('b', { text: h.name }), U.el('small', { text: H().freqLabel(h) + (h.target > 1 ? ' · ' + H().targetLabel(h) : '') })])]);
      var cells = days.map(function (ds) {
        var n = H().count(h, ds), done = n >= h.target, due = H().isDue(h, ds);
        var c = U.el('button.hg-cell' + (done ? '.done' : n ? '.partial' : '') + (due ? '' : '.off') + (ds === td ? '.today' : ''), {
          attrs: { type: 'button', title: U.fmtLong(ds) + (n ? ' · ' + n + (h.target > 1 ? ' de ' + h.target : '') : due ? ' · sin hacer' : ' · no toca') }
        }, h.target > 1 && n && !done ? [U.el('span', { text: n })] : []);
        c.addEventListener('click', function () { H().tap(h, ds); });
        c.addEventListener('contextmenu', function (e) { e.preventDefault(); if (n > 0) st.setHabitCount(h.id, ds, h.target > 1 ? n - 1 : 0); });
        return c;
      });
      var row = U.el('div.hg-row', { style: { gridTemplateColumns: cols }, attrs: { 'data-habit': h.id } }, [name].concat(cells).concat([
        U.el('span.hg-num', [s.streak ? U.icon('flame', 'xs') : null, String(s.streak)]), U.el('span.hg-num', { text: String(s.best) }),
        U.el('span.hg-num', { text: s.rate30 == null ? '—' : s.rate30 + '%' })]));
      row.addEventListener('contextmenu', function (e) { if (e.target.closest('.hg-cell')) return; e.preventDefault(); HabitView.menu(h, { x: e.clientX, y: e.clientY }); });
      return row;
    });
    var seg = W.UI.segmented([{ value: 7, label: '7 días' }, { value: 14, label: '14 días' }, { value: 30, label: '30 días' }], range,
      function (v) { st.ui.habitRange = v; W.Router.refresh(); }, { mini: true });
    var sum = H().todaySummary();
    var rates = list.map(function (h) { return H().rate(h, U.addDays(td, -6), td); }).filter(function (r) { return r != null; });
    var week = rates.length ? Math.round(rates.reduce(function (a, b) { return a + b; }, 0) / rates.length) : null;
    var bestNow = list.reduce(function (m, h) { var s = H().streak(h); return s > m.n ? { n: s, h: h } : m; }, { n: 0, h: null });
    var kpi = function (v, l) { return U.el('div', [U.el('strong', { text: v }), U.el('span', { text: l })]); };
    return [
      U.el('div.group.stats.hkpis', [kpi(sum.total ? sum.done + '/' + sum.total : '—', 'Hechos hoy'), kpi(week == null ? '—' : week + '%', 'Cumplido esta semana'),
        kpi(String(bestNow.n), bestNow.h ? 'Mejor racha · ' + bestNow.h.name : 'Mejor racha'), kpi(String(list.length), list.length === 1 ? 'Hábito activo' : 'Hábitos activos')]),
      U.el('div.hg-tools', [seg, U.el('span.muted', { text: 'Clic en una casilla para marcar ese día · clic derecho para quitar' })]),
      U.el('div.group.hgrid', [head].concat(rows))
    ];
  }

  W.Screens.habits = {
    title: 'Hábitos',
    back: function () { if (W.Layout.desktop) return false; W.Router.back(); return true; },
    render: function (root) {
      var st = S(), desk = W.Layout.desktop, list = H().list();
      var sum = H().todaySummary();
      var head = W.UI.header({
        title: 'Hábitos',
        back: desk ? null : { label: 'Atrás', onTap: function () { W.Router.back(); } },
        sub: list.length ? (sum.total ? sum.done + ' de ' + sum.total + ' hechos hoy' : 'Hoy no toca ninguno') : 'Pequeñas rutinas que se repiten',
        actions: desk ? [{ text: 'Nuevo hábito', icon: 'plus', label: 'Nuevo hábito', onTap: function () { editor(null); } }] : [{ icon: 'plus', label: 'Nuevo hábito', onTap: function () { editor(null); } }]
      });
      var content = [];
      if (!list.length) {
        content.push(U.el('div.group', [W.UI.empty('buddy:sprout', 'Sin hábitos todavía', 'Crea uno y márcalo cada día: verás tu racha y tu progreso.',
          U.el('button.btn.sm.primary', { on: { click: function () { editor(null); } } }, [U.icon('plus', 'sm'), 'Crear un hábito']))]));
        content.push(U.el('div.chips.wrap.hsuggest', SUGGEST.map(function (sg) {
          var c = U.el('button.chip', { attrs: { type: 'button' } }, [U.icon(sg.icon), U.el('span', { text: sg.name })]);
          c.addEventListener('click', function () { editor(null, Object.assign({ freq: 'daily', perWeek: 3, target: 1, unit: '' }, sg)); });
          return c;
        })));
      } else if (desk) {
        content = content.concat(desktopGrid(st));
      } else {
        var dueIds = {};
        H().dueToday().forEach(function (h) { dueIds[h.id] = true; });
        var todayList = list.filter(function (h) { return dueIds[h.id]; });
        var others = list.filter(function (h) { return !dueIds[h.id]; });
        if (todayList.length) content.push(W.UI.section({ title: 'Hoy', first: true, side: U.el('small', { text: sum.done + '/' + sum.total }),
          items: U.el('ul.group.habit-list', todayList.map(function (h) { return habitRow(h, { week: true }); })) }));
        if (others.length) content.push(W.UI.section({ title: 'Otros días', first: !todayList.length,
          items: U.el('ul.group.habit-list', others.map(function (h) { return habitRow(h, { week: true }); })) }));
      }
      var arch = H().archived();
      if (arch.length) {
        content.push(W.UI.section({ header: 'Archivados', items: U.el('ul.group.habit-list', arch.map(function (h) { return habitRow(h, {}); })),
          footer: 'No aparecen en Hoy. Ábrelos para recuperarlos.' }));
      }
      W.UI.mount(root, head, content);
    }
  };
})(window.Whider);
