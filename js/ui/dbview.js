/**
 * WHIDER · Bases de datos del Cuaderno: vistas de tabla, tablero, lista, calendario y galería.
 *
 *  - Propiedades: texto, número, selección, varias opciones, estado, fecha, casilla, enlace,
 *    persona, creada y editada. Se añaden, renombran, cambian de tipo, ocultan y ordenan.
 *  - Vistas guardadas con su propio filtro, orden y agrupación; búsqueda rápida.
 *  - Tablero con columnas por estado o selección (arrastrar tarjetas en el ordenador,
 *    «Mover a» en el móvil) y calendario por fecha.
 *  - Cada fila es una página: se abre a pantalla completa con sus propiedades arriba.
 */
window.Whider = window.Whider || {};

(function (W) {
  'use strict';
  var U = W.U, P = function () { return W.Pages; };
  var CARD = 'text/x-whider-row';
  var TONES = ['Gris', 'Claro', 'Medio', 'Oscuro', 'Intenso'];
  var OPS = {
    text: [['contains', 'contiene'], ['empty', 'está vacío'], ['notempty', 'no está vacío']],
    title: [['contains', 'contiene'], ['empty', 'está vacío'], ['notempty', 'no está vacío']],
    url: [['contains', 'contiene'], ['empty', 'está vacío'], ['notempty', 'no está vacío']],
    number: [['gt', 'mayor que'], ['lt', 'menor que'], ['empty', 'está vacío'], ['notempty', 'no está vacío']],
    select: [['is', 'es'], ['not', 'no es'], ['empty', 'está vacío'], ['notempty', 'no está vacío']],
    status: [['is', 'es'], ['not', 'no es'], ['empty', 'está vacío']],
    multi: [['is', 'incluye'], ['not', 'no incluye'], ['empty', 'está vacío'], ['notempty', 'no está vacío']],
    date: [['today', 'es hoy'], ['week', 'próximos 7 días'], ['overdue', 'ya pasó'], ['before', 'antes de'], ['after', 'después de'], ['empty', 'está vacía'], ['notempty', 'tiene fecha']],
    check: [['checked', 'marcada'], ['unchecked', 'sin marcar']],
    person: [['is', 'es'], ['empty', 'está vacío'], ['notempty', 'no está vacío']],
    created: [['before', 'antes de'], ['after', 'después de']],
    updated: [['before', 'antes de'], ['after', 'después de']]
  };

  function chip(p, id) {
    var o = (p.opts || []).filter(function (x) { return x.id === id; })[0];
    if (!o) return null;
    return U.el('span.dbv-chip.t' + (o.tone || 0) + (p.type === 'status' ? '.status' : ''), { text: o.name });
  }
  function visibleProps(db, view) { return db.props.filter(function (p) { return p.id === 'title' || (view.hide || []).indexOf(p.id) < 0; }); }

  /* ---------- Editores de celdas ---------- */
  function editValue(rowId, p, anchor, done) {
    var row = P().get(rowId); if (!row) return;
    var dbId = row.parent, v = P().propValue(row, p);
    var finish = function () { if (done) done(); };
    if (p.type === 'check') { P().setProp(rowId, p.id, !v); finish(); return; }
    if (p.type === 'created' || p.type === 'updated') return;
    if (p.type === 'select' || p.type === 'status' || p.type === 'multi') {
      var items = (p.opts || []).map(function (o) { return { value: o.id, label: o.name, on: p.type === 'multi' ? (Array.isArray(v) && v.indexOf(o.id) >= 0) : v === o.id }; });
      if (v && p.type !== 'multi') items.push({ value: '__clear', label: 'Quitar', icon: 'close', gap: true });
      items.push({ value: '__new', label: 'Nueva opción…', icon: 'plus', gap: !v || p.type === 'multi' });
      W.Menu.open(anchor, items, { title: p.name }).then(function (x) {
        if (!x) return;
        if (x === '__clear') { P().setProp(rowId, p.id, null); finish(); return; }
        var apply = function (oid) {
          if (p.type === 'multi') { var arr = Array.isArray(v) ? v.slice() : []; var k = arr.indexOf(oid); if (k >= 0) arr.splice(k, 1); else arr.push(oid); P().setProp(rowId, p.id, arr); }
          else P().setProp(rowId, p.id, oid);
          finish();
        };
        if (x === '__new') W.Sheet.prompt({ title: 'Nueva opción de «' + p.name + '»', placeholder: 'Nombre', maxLength: 40, ok: 'Crear' }).then(function (name) { if (name) apply(P().addOption(dbId, p.id, name)); });
        else apply(x);
      });
      return;
    }
    if (p.type === 'person') {
      var people = [{ value: 'me', label: (W.State.displayName() || 'Yo') + ' (tú)', icon: 'user', on: v === 'me' }].concat((W.State.friends ? W.State.friends() : []).map(function (f) { return { value: f.uid, label: f.name || 'Contacto', icon: 'user', on: v === f.uid }; }));
      if (v) people.push({ value: '__clear', label: 'Quitar', icon: 'close', gap: true });
      W.Menu.open(anchor, people, { title: p.name }).then(function (x) { if (!x) return; P().setProp(rowId, p.id, x === '__clear' ? null : x); finish(); });
      return;
    }
    if (p.type === 'date') {
      var input = U.el('input.input', { attrs: { type: 'date', 'aria-label': p.name } });
      input.value = typeof v === 'string' ? v : '';
      var sh = W.Sheet.open({ title: p.name, body: [U.el('div.group', [U.el('label.cell', [input])]),
        U.el('div.chips.dbv-quick', [['Hoy', U.today()], ['Mañana', U.addDays(U.today(), 1)], ['En una semana', U.addDays(U.today(), 7)]].map(function (q) { return U.el('button.chip', { text: q[0], on: { click: function () { P().setProp(rowId, p.id, q[1]); sh.close(); finish(); } } }); }))],
        foot: [U.el('button.btn.ghost', { text: 'Quitar fecha', on: { click: function () { P().setProp(rowId, p.id, null); sh.close(); finish(); } } }), U.el('button.btn.primary', { text: 'Guardar', on: { click: function () { P().setProp(rowId, p.id, input.value || null); sh.close(); finish(); } } })] });
      setTimeout(function () { try { input.focus(); } catch (e) { /* sin foco */ } }, 300);
      return;
    }
    // Texto, título, número y enlace
    W.Sheet.prompt({ title: p.name, value: v == null ? '' : String(v), maxLength: p.type === 'title' ? 200 : 600, type: p.type === 'number' ? 'text' : 'text', ok: 'Guardar',
      placeholder: p.type === 'url' ? 'https://…' : p.type === 'number' ? '0' : '' }).then(function (x) {
      if (x == null) return;
      if (p.type === 'number') { var n = parseFloat(String(x).replace(/\./g, '').replace(',', '.')); P().setProp(rowId, p.id, isFinite(n) ? n : null); }
      else P().setProp(rowId, p.id, x);
      finish();
    });
  }
  function cellContent(row, p) {
    var v = P().propValue(row, p);
    if (p.type === 'check') {
      var c = U.el('span.dbv-check' + (v ? '.on' : ''), { attrs: { role: 'checkbox', 'aria-checked': v ? 'true' : 'false' } });
      c.appendChild(U.svg('svg', { viewBox: '0 0 24 24' }, [U.svg('path', { d: 'm5 12.6 4.5 4.5L19 7.6' })]));
      return c;
    }
    if (p.type === 'select' || p.type === 'status') return chip(p, v) || U.el('span.dbv-none');
    if (p.type === 'multi') return U.el('span.dbv-chips', (Array.isArray(v) ? v : []).map(function (x) { return chip(p, x); }).filter(Boolean));
    if (p.type === 'url' && v) return U.el('a.dbv-url', { attrs: { href: /^https?:/.test(v) ? v : 'https://' + v, target: '_blank', rel: 'noopener noreferrer' }, text: String(v).replace(/^https?:\/\/(www\.)?/, ''), on: { click: function (e) { e.stopPropagation(); } } });
    if (p.type === 'person' && v) return U.el('span.dbv-person', [W.Avatar ? W.Avatar.small(v === 'me' ? null : v, 18) : U.icon('user', 'xs'), U.el('span', { text: P().personName(v) })]);
    if (p.type === 'date' && v) return U.el('span.dbv-date' + (v < U.today() ? '.late' : v === U.today() ? '.today' : ''), { text: U.fmtShort(v) });
    return U.el('span.dbv-txt', { text: P().propText(row, p) });
  }

  /* ---------- Vistas ---------- */
  function tableView(ctx) {
    var db = ctx.db, view = ctx.view, props = visibleProps(db, view), rows = ctx.rows;
    var table = U.el('div.dbv-table', { attrs: { role: 'table' }, style: { gridTemplateColumns: props.map(function (p) { return p.type === 'title' ? 'minmax(240px, 2fr)' : p.type === 'check' ? '90px' : 'minmax(150px, 1fr)'; }).join(' ') + (ctx.ro ? '' : ' 44px') } });
    var head = U.el('div.dbv-tr.head', { attrs: { role: 'row' } }, props.map(function (p) {
      return U.el('button.dbv-th', { attrs: { type: 'button', role: 'columnheader' }, on: { click: function (e) { propMenu(ctx, p, e.currentTarget); } } }, [U.icon(P().PROPS[p.type].icon, 'xs'), U.el('span', { text: p.name })]);
    }).concat(ctx.ro ? [] : [U.el('button.dbv-th.add', { attrs: { type: 'button', 'aria-label': 'Añadir propiedad', title: 'Añadir propiedad' }, on: { click: function (e) { addProp(ctx, e.currentTarget); } } }, [U.icon('plus', 'sm')])]));
    table.appendChild(head);
    rows.forEach(function (r) {
      var tr = U.el('div.dbv-tr', { attrs: { role: 'row', 'data-id': r.id } }, props.map(function (p) {
        var td = U.el('div.dbv-td' + (p.type === 'title' ? '.title' : ''), { attrs: { role: 'cell', tabindex: '0' } });
        if (p.type === 'title') {
          td.appendChild(U.el('span.dbv-row-ic', [U.icon(r.icon || 'page', 'xs')]));
          td.appendChild(U.el('span.dbv-row-t', { text: r.title || 'Sin título' }));
          td.appendChild(U.el('button.dbv-open', { attrs: { type: 'button', 'aria-label': 'Abrir como página', title: 'Abrir' }, on: { click: function (e) { e.stopPropagation(); ctx.open(r.id); } } }, [U.icon('expand', 'xs'), U.el('span', { text: 'Abrir' })]));
        } else td.appendChild(cellContent(r, p));
        if (!ctx.ro) {
          td.addEventListener('click', function () { if (p.type === 'title' && !W.Layout.desktop) { ctx.open(r.id); return; } editValue(r.id, p, td, ctx.redraw); });
          td.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); editValue(r.id, p, td, ctx.redraw); } });
        } else if (p.type === 'title') td.addEventListener('click', function () { ctx.open(r.id); });
        return td;
      }).concat(ctx.ro ? [] : [U.el('div.dbv-td.pad', { attrs: { role: 'cell' } })]));
      if (!ctx.ro) tr.addEventListener('contextmenu', function (e) { e.preventDefault(); rowMenu(ctx, r, e.target); });
      table.appendChild(tr);
    });
    var wrap = U.el('div.dbv-scroll', [table]);
    if (!ctx.ro) wrap.appendChild(U.el('button.dbv-new-row', { attrs: { type: 'button' }, on: { click: function () { newRow(ctx, {}); } } }, [U.icon('plus', 'sm'), 'Nueva']));
    if (rows.length) wrap.appendChild(U.el('div.dbv-count', { text: U.plural(rows.length, 'fila', 'filas') }));
    return wrap;
  }
  function boardView(ctx) {
    var db = ctx.db, view = ctx.view;
    var gp = view.group ? P().getProp(ctx.id, view.group) : null;
    if (!gp) {
      var cand = db.props.filter(function (p) { return p.type === 'status' || p.type === 'select' || p.type === 'check'; })[0];
      if (cand) { view.group = cand.id; gp = cand; }
    }
    if (!gp) return U.el('div.dbv-empty', [U.el('p', { text: 'Para ver el tablero, añade una propiedad de estado o de selección.' }),
      ctx.ro ? null : U.el('button.btn.sm.soft', { text: 'Añadir «Estado»', on: { click: function () { var id = P().addProp(ctx.id, 'status', 'Estado'); P().setDb(ctx.id, function (d) { d.props.forEach(function (p) { if (p.id === id) p.opts = [{ id: 'o_todo', name: 'Sin empezar', tone: 0, group: 'todo' }, { id: 'o_doing', name: 'En curso', tone: 2, group: 'doing' }, { id: 'o_done', name: 'Hecho', tone: 4, group: 'done' }]; }); d.views.forEach(function (v) { if (v.id === view.id) v.group = id; }); }); ctx.redraw(); } } })]);
    var groups = P().groups(ctx.id, view, ctx.rows);
    var visible = visibleProps(db, view).filter(function (p) { return p.id !== 'title' && p.id !== gp.id; }).slice(0, 3);
    var board = U.el('div.dbv-board');
    groups.forEach(function (g) {
      if (g.id === null && !g.rows.length && gp.type !== 'check') return;
      var col = U.el('div.dbv-col', { attrs: { 'data-g': g.id === null ? '' : String(g.id) } });
      col.appendChild(U.el('div.dbv-col-h', [gp.type === 'check' ? U.el('span.dbv-chip', { text: g.name }) : (g.id ? chip(gp, g.id) : U.el('span.dbv-chip.t0', { text: g.name })), U.el('small', { text: String(g.rows.length) })]));
      g.rows.forEach(function (r) {
        var card = U.el('div.dbv-card', { attrs: { tabindex: '0', draggable: ctx.ro ? 'false' : 'true', 'data-id': r.id } }, [
          U.el('strong', [U.icon(r.icon || 'page', 'xs'), U.el('span', { text: r.title || 'Sin título' })]),
          visible.length ? U.el('div.dbv-card-props', visible.map(function (p) { var v = P().propValue(r, p); return v == null || v === '' || (Array.isArray(v) && !v.length) ? null : cellContent(r, p); })) : null
        ]);
        card.addEventListener('click', function () { ctx.open(r.id); });
        card.addEventListener('keydown', function (e) { if (e.key === 'Enter') ctx.open(r.id); });
        if (!ctx.ro) {
          card.addEventListener('dragstart', function (e) { e.dataTransfer.setData(CARD, r.id); e.dataTransfer.effectAllowed = 'move'; card.classList.add('dragging'); });
          card.addEventListener('dragend', function () { card.classList.remove('dragging'); });
          card.addEventListener('contextmenu', function (e) { e.preventDefault(); rowMenu(ctx, r, card, gp, groups); });
        }
        col.appendChild(card);
      });
      if (!ctx.ro) {
        col.appendChild(U.el('button.dbv-col-add', { attrs: { type: 'button' }, on: { click: function () { var props = {}; if (g.id !== null) props[gp.id] = gp.type === 'multi' ? [g.id] : g.id; newRow(ctx, props); } } }, [U.icon('plus', 'sm'), 'Nueva']));
        col.addEventListener('dragover', function (e) { if (Array.prototype.indexOf.call(e.dataTransfer.types, CARD) < 0) return; e.preventDefault(); col.classList.add('drop'); });
        col.addEventListener('dragleave', function (e) { if (!col.contains(e.relatedTarget)) col.classList.remove('drop'); });
        col.addEventListener('drop', function (e) {
          col.classList.remove('drop');
          var id = e.dataTransfer.getData(CARD); if (!id) return;
          e.preventDefault();
          P().setProp(id, gp.id, g.id === null ? null : gp.type === 'multi' ? [g.id] : g.id);
          W.Audio.select(); ctx.redraw();
        });
      }
      board.appendChild(col);
    });
    return U.el('div.dbv-board-wrap', [board]);
  }
  function listView(ctx) {
    var props = visibleProps(ctx.db, ctx.view).filter(function (p) { return p.id !== 'title'; }).slice(0, 4);
    var list = U.el('div.dbv-list', ctx.rows.map(function (r) {
      var row = U.el('button.dbv-li', { attrs: { type: 'button' } }, [U.el('span.dbv-row-ic', [U.icon(r.icon || 'page', 'xs')]), U.el('span.dbv-li-t', { text: r.title || 'Sin título' }),
        U.el('span.dbv-li-props', props.map(function (p) { var v = P().propValue(r, p); return v == null || v === '' || (Array.isArray(v) && !v.length) ? null : cellContent(r, p); }))]);
      row.addEventListener('click', function () { ctx.open(r.id); });
      if (!ctx.ro) row.addEventListener('contextmenu', function (e) { e.preventDefault(); rowMenu(ctx, r, row); });
      return row;
    }));
    var wrap = U.el('div', [list]);
    if (!ctx.ro) wrap.appendChild(U.el('button.dbv-new-row', { attrs: { type: 'button' }, on: { click: function () { newRow(ctx, {}); } } }, [U.icon('plus', 'sm'), 'Nueva']));
    return wrap;
  }
  function calendarView(ctx) {
    var db = ctx.db, view = ctx.view;
    var dp = view.date ? P().getProp(ctx.id, view.date) : null;
    if (!dp) dp = db.props.filter(function (p) { return p.type === 'date'; })[0];
    if (!dp) return U.el('div.dbv-empty', [U.el('p', { text: 'Para ver el calendario, añade una propiedad de fecha.' }),
      ctx.ro ? null : U.el('button.btn.sm.soft', { text: 'Añadir «Fecha»', on: { click: function () { P().addProp(ctx.id, 'date', 'Fecha'); ctx.redraw(); } } })]);
    var month = ctx.state.month || U.today().slice(0, 7);
    var y = +month.slice(0, 4), m = +month.slice(5, 7) - 1;
    var first = new Date(y, m, 1), ws = W.State.settings.weekStart || 1;
    var start = U.addDays(U.ymd(first), -((first.getDay() - ws + 7) % 7));
    var byDay = {};
    ctx.rows.forEach(function (r) { var d = r.props[dp.id]; if (typeof d === 'string') (byDay[d] = byDay[d] || []).push(r); });
    var grid = U.el('div.dbv-cal');
    var names = ['L', 'M', 'X', 'J', 'V', 'S', 'D']; if (ws === 0) names = ['D', 'L', 'M', 'X', 'J', 'V', 'S'];
    names.forEach(function (n) { grid.appendChild(U.el('div.dbv-cal-h', { text: n })); });
    for (var i = 0; i < 42; i++) {
      var d = U.addDays(start, i), inMonth = +d.slice(5, 7) - 1 === m;
      var items = byDay[d] || [];
      var cell = U.el('div.dbv-cal-d' + (inMonth ? '' : '.out') + (d === U.today() ? '.today' : ''), { attrs: { 'data-d': d } }, [U.el('span.dbv-cal-n', { text: String(+d.slice(8)) })]);
      items.slice(0, 3).forEach(function (r) { cell.appendChild(U.el('button.dbv-cal-i', { attrs: { type: 'button' }, text: r.title || 'Sin título', on: { click: function (e) { e.stopPropagation(); ctx.open(r.id); } } })); });
      if (items.length > 3) cell.appendChild(U.el('small.dbv-cal-more', { text: '+' + (items.length - 3) }));
      if (!ctx.ro) (function (day) { cell.addEventListener('click', function () { var props = {}; props[dp.id] = day; newRow(ctx, props); }); })(d);
      grid.appendChild(cell);
      if (i >= 34 && +U.addDays(start, i + 1).slice(5, 7) - 1 !== m && i % 7 === 6) break;
    }
    var nav = U.el('div.dbv-cal-nav', [
      U.el('button.nav-icon', { attrs: { 'aria-label': 'Mes anterior' }, on: { click: function () { ctx.state.month = U.addMonths(month + '-01', -1).slice(0, 7); ctx.redraw(); } } }, [U.icon('left')]),
      U.el('strong', { text: U.fmtMonth(y, m) }),
      U.el('button.nav-icon', { attrs: { 'aria-label': 'Mes siguiente' }, on: { click: function () { ctx.state.month = U.addMonths(month + '-01', 1).slice(0, 7); ctx.redraw(); } } }, [U.icon('right')]),
      U.el('button.btn.xs.ghost', { text: 'Hoy', on: { click: function () { ctx.state.month = U.today().slice(0, 7); ctx.redraw(); } } })
    ]);
    return U.el('div', [nav, grid]);
  }
  function galleryView(ctx) {
    var props = visibleProps(ctx.db, ctx.view).filter(function (p) { return p.id !== 'title'; }).slice(0, 3);
    var grid = U.el('div.dbv-gallery', ctx.rows.map(function (r) {
      var img = P().content(r.id).blocks.filter(function (b) { return b.t === 'img' && b.src; })[0];
      var cover = img ? U.el('div.dbv-g-cover', [U.el('img', { attrs: { src: img.src, alt: '', loading: 'lazy' } })]) : U.el('div.dbv-g-cover.cv-' + (r.cover || 'paper'), [U.icon(r.icon || 'page')]);
      var card = U.el('button.dbv-g', { attrs: { type: 'button' } }, [cover, U.el('strong', { text: r.title || 'Sin título' }),
        U.el('div.dbv-card-props', props.map(function (p) { var v = P().propValue(r, p); return v == null || v === '' || (Array.isArray(v) && !v.length) ? null : cellContent(r, p); }))]);
      card.addEventListener('click', function () { ctx.open(r.id); });
      if (!ctx.ro) card.addEventListener('contextmenu', function (e) { e.preventDefault(); rowMenu(ctx, r, card); });
      return card;
    }));
    if (!ctx.ro) grid.appendChild(U.el('button.dbv-g.add', { attrs: { type: 'button' }, on: { click: function () { newRow(ctx, {}); } } }, [U.icon('plus'), U.el('span', { text: 'Nueva' })]));
    return grid;
  }

  /* ---------- Acciones ---------- */
  function newRow(ctx, props) {
    // Los filtros de la vista se respetan en la fila nueva (para que no desaparezca)
    (ctx.view.filter || []).forEach(function (f) { if (f.op === 'is' && f.v != null && props[f.p] === undefined) { var p = P().getProp(ctx.id, f.p); if (p) props[f.p] = p.type === 'multi' ? [f.v] : f.v; } if (f.op === 'checked') props[f.p] = true; });
    var r = P().addRow(ctx.id, props, '');
    W.Audio.select();
    if (W.Layout.desktop && ctx.view.type === 'table') {
      ctx.redraw();
      setTimeout(function () { var title = P().getProp(ctx.id, 'title'); var td = ctx.el.querySelector('.dbv-tr[data-id="' + r.id + '"] .dbv-td.title'); if (td && title) editValue(r.id, title, td, ctx.redraw); }, 40);
    } else ctx.open(r.id, { focusTitle: true });
  }
  function rowMenu(ctx, r, anchor, gp, groups) {
    var items = [{ value: 'open', label: 'Abrir como página', icon: 'expand' }, { value: 'dup', label: 'Duplicar', icon: 'copy' }];
    if (gp && groups) groups.forEach(function (g) { if (g.id !== null) items.push({ value: 'g:' + g.id, label: 'Mover a «' + g.name + '»', icon: 'right' }); });
    items.push({ value: 'del', label: 'Eliminar', icon: 'trash', destructive: true, gap: true });
    W.Menu.open(anchor, items, { title: r.title || 'Sin título' }).then(function (v) {
      if (!v) return;
      if (v === 'open') ctx.open(r.id);
      else if (v === 'dup') { P().duplicate(r.id); ctx.redraw(); }
      else if (v === 'del') { P().remove(r.id); W.Toast.show({ text: 'Fila en la papelera', icon: 'trash', action: { label: 'Deshacer', fn: function () { P().restore(r.id); ctx.redraw(); } } }); ctx.redraw(); }
      else if (v.indexOf('g:') === 0) { var gid = v.slice(2); var real = gp.type === 'check' ? gid === 'true' : gid; P().setProp(r.id, gp.id, gp.type === 'multi' ? [real] : real); ctx.redraw(); }
    });
  }
  function addProp(ctx, anchor) {
    var types = ['text', 'number', 'select', 'multi', 'status', 'date', 'check', 'url', 'person', 'created', 'updated'];
    W.Menu.open(anchor, types.map(function (t) { return { value: t, label: P().PROPS[t].label, icon: P().PROPS[t].icon }; }), { title: 'Nueva propiedad' }).then(function (t) {
      if (!t) return;
      W.Sheet.prompt({ title: 'Nombre de la propiedad', value: P().PROPS[t].label, maxLength: 40, ok: 'Añadir' }).then(function (name) {
        if (!name) return;
        var id = P().addProp(ctx.id, t, name);
        if (t === 'status') P().setDb(ctx.id, function (d) { d.props.forEach(function (p) { if (p.id === id) p.opts = [{ id: 'o_todo', name: 'Sin empezar', tone: 0, group: 'todo' }, { id: 'o_doing', name: 'En curso', tone: 2, group: 'doing' }, { id: 'o_done', name: 'Hecho', tone: 4, group: 'done' }]; }); });
        ctx.redraw();
      });
    });
  }
  function propMenu(ctx, p, anchor) {
    var items = [
      { value: 'asc', label: 'Ordenar de menor a mayor', icon: 'up' },
      { value: 'desc', label: 'Ordenar de mayor a menor', icon: 'down' },
      { value: 'filter', label: 'Filtrar por esta propiedad', icon: 'filter' }
    ];
    if (!ctx.ro) {
      items.push({ value: 'rename', label: 'Cambiar el nombre', icon: 'edit', gap: true });
      if (p.type !== 'title') items.push({ value: 'type', label: 'Cambiar el tipo (' + P().PROPS[p.type].label.toLowerCase() + ')', icon: 'swap' });
      if (p.opts) items.push({ value: 'opts', label: 'Editar las opciones', icon: 'list' });
      if (p.type === 'number') items.push({ value: 'fmt', label: 'Formato del número', icon: 'hash' });
      if (p.type !== 'title') items.push({ value: 'hide', label: 'Ocultar en esta vista', icon: 'eye' });
      if (p.type !== 'title') items.push({ value: 'del', label: 'Eliminar la propiedad', icon: 'trash', destructive: true });
    }
    W.Menu.open(anchor, items, { title: p.name }).then(function (v) {
      if (!v) return;
      if (v === 'asc' || v === 'desc') { setView(ctx, function (vw) { vw.sort = [{ p: p.id, d: v === 'asc' ? 1 : -1 }]; }); }
      else if (v === 'filter') filterSheet(ctx, p);
      else if (v === 'rename') W.Sheet.prompt({ title: 'Nombre de la propiedad', value: p.name, maxLength: 40, ok: 'Guardar' }).then(function (n) { if (n) { P().setDb(ctx.id, function (d) { d.props.forEach(function (x) { if (x.id === p.id) x.name = n; }); }); ctx.redraw(); } });
      else if (v === 'type') {
        var types = ['text', 'number', 'select', 'multi', 'status', 'date', 'check', 'url', 'person'];
        W.Menu.open(anchor, types.map(function (t) { return { value: t, label: P().PROPS[t].label, icon: P().PROPS[t].icon, on: t === p.type }; }), { title: 'Tipo' }).then(function (t) {
          if (!t || t === p.type) return;
          // Convierte los valores que se puedan (texto ↔ opciones ↔ número)
          var rows = P().rows(ctx.id), opts = (p.opts || []).slice();
          P().setDb(ctx.id, function (d) { d.props.forEach(function (x) { if (x.id === p.id) { x.type = t; x.opts = x.opts || []; } }); });
          rows.forEach(function (r) {
            var old = r.props[p.id]; if (old == null) return;
            var txt = p.type === 'select' || p.type === 'status' ? P().optName(p, old) : p.type === 'multi' ? (old || []).map(function (o) { return P().optName(p, o); }).join(', ') : String(old);
            var nv = null;
            if (t === 'text' || t === 'url') nv = txt;
            else if (t === 'number') { var n = parseFloat(txt.replace(',', '.')); nv = isFinite(n) ? n : null; }
            else if (t === 'check') nv = !!old && txt !== 'No';
            else if (t === 'date') nv = /^\d{4}-\d{2}-\d{2}$/.test(txt) ? txt : null;
            else if (t === 'select' || t === 'status' || t === 'multi') {
              var names = t === 'multi' ? txt.split(',').map(function (s) { return s.trim(); }).filter(Boolean) : [txt];
              var ids = names.map(function (nm) { var hit = (P().getProp(ctx.id, p.id).opts || []).filter(function (o) { return o.name === nm; })[0] || opts.filter(function (o) { return o.name === nm; })[0]; return hit ? hit.id : P().addOption(ctx.id, p.id, nm); });
              nv = t === 'multi' ? ids : ids[0];
            }
            P().setProp(r.id, p.id, nv);
          });
          ctx.redraw();
        });
      }
      else if (v === 'opts') optionsSheet(ctx, p);
      else if (v === 'fmt') W.Menu.open(anchor, [{ value: 'plain', label: 'Número' }, { value: 'euro', label: 'Euros (€)' }, { value: 'percent', label: 'Porcentaje (%)' }].map(function (x) { x.on = (p.fmt || 'plain') === x.value; return x; })).then(function (f) { if (f) { P().setDb(ctx.id, function (d) { d.props.forEach(function (x) { if (x.id === p.id) x.fmt = f; }); }); ctx.redraw(); } });
      else if (v === 'hide') setView(ctx, function (vw) { vw.hide = (vw.hide || []).concat([p.id]); });
      else if (v === 'del') W.Sheet.confirm({ title: '¿Eliminar «' + p.name + '»?', text: 'Se borrará de todas las filas.', ok: 'Eliminar', danger: true }).then(function (ok) {
        if (!ok) return;
        P().setDb(ctx.id, function (d) { d.props = d.props.filter(function (x) { return x.id !== p.id; }); d.views.forEach(function (vw) { if (vw.group === p.id) vw.group = null; vw.sort = (vw.sort || []).filter(function (s) { return s.p !== p.id; }); vw.filter = (vw.filter || []).filter(function (f) { return f.p !== p.id; }); }); });
        ctx.redraw();
      });
    });
  }
  function optionsSheet(ctx, p) {
    var host = U.el('div');
    var draw = function () {
      U.clear(host);
      var cur = P().getProp(ctx.id, p.id); if (!cur) return;
      host.appendChild(W.UI.section({ header: 'Opciones', items: (cur.opts || []).map(function (o) {
        return W.UI.cell({ lead: chip(cur, o.id), title: '', right: U.el('span.cell-row', [
          U.el('button.btn.xs.soft', { text: 'Tono', on: { click: function (e) { W.Menu.open(e.currentTarget, TONES.map(function (t, i) { return { value: String(i), label: t, on: (o.tone || 0) === i }; })).then(function (t) { if (t == null) return; P().setDb(ctx.id, function (d) { d.props.forEach(function (x) { if (x.id === p.id) x.opts.forEach(function (y) { if (y.id === o.id) y.tone = +t; }); }); }); draw(); }); } } }),
          U.el('button.btn.xs.soft', { text: 'Nombre', on: { click: function () { W.Sheet.prompt({ title: 'Nombre de la opción', value: o.name, maxLength: 40, ok: 'Guardar' }).then(function (n) { if (!n) return; P().setDb(ctx.id, function (d) { d.props.forEach(function (x) { if (x.id === p.id) x.opts.forEach(function (y) { if (y.id === o.id) y.name = n; }); }); }); draw(); }); } } }),
          U.el('button.circle-btn', { attrs: { 'aria-label': 'Quitar la opción' }, on: { click: function () { P().setDb(ctx.id, function (d) { d.props.forEach(function (x) { if (x.id === p.id) x.opts = x.opts.filter(function (y) { return y.id !== o.id; }); }); }); draw(); } } }, [U.icon('close')])
        ]) });
      }).concat([W.UI.cell({ icon: 'plus', title: 'Nueva opción', accent: true, chevron: false, onTap: function () { W.Sheet.prompt({ title: 'Nueva opción', maxLength: 40, ok: 'Añadir' }).then(function (n) { if (n) { P().addOption(ctx.id, p.id, n); draw(); } }); } })]) }));
    };
    draw();
    W.Sheet.open({ title: p.name, body: [host], onClose: function () { ctx.redraw(); } });
  }
  function setView(ctx, fn) {
    P().setDb(ctx.id, function (d) { d.views.forEach(function (v) { if (v.id === ctx.view.id) fn(v); }); });
    ctx.redraw();
  }
  function filterSheet(ctx, focusProp) {
    var host = U.el('div');
    var draw = function () {
      U.clear(host);
      var m = P().get(ctx.id); if (!m) return;
      var view = m.db.views.filter(function (v) { return v.id === ctx.view.id; })[0] || ctx.view;
      var items = (view.filter || []).map(function (f, i) {
        var p = P().getProp(ctx.id, f.p); if (!p) return null;
        var op = (OPS[p.type] || []).filter(function (x) { return x[0] === f.op; })[0];
        var val = f.v == null ? '' : p.opts ? P().optName(p, f.v) : p.type === 'person' ? P().personName(f.v) : typeof f.v === 'string' && /^\d{4}-/.test(f.v) ? U.fmtShort(f.v) : String(f.v);
        return W.UI.cell({ icon: 'filter', title: p.name + ' ' + (op ? op[1] : f.op) + (val ? ' «' + val + '»' : ''), right: U.el('button.circle-btn', { attrs: { 'aria-label': 'Quitar el filtro' }, on: { click: function () { setView(ctx, function (vw) { vw.filter.splice(i, 1); }); draw(); } } }, [U.icon('close')]) });
      }).filter(Boolean);
      items.push(W.UI.cell({ icon: 'plus', title: 'Añadir un filtro', accent: true, chevron: false, onTap: function (e, node) { pickFilter(ctx, node, null, draw); } }));
      host.appendChild(W.UI.section({ header: 'Filtros de «' + ctx.view.name + '»', items: items, footer: 'Se cumplen todos a la vez.' }));
    };
    draw();
    W.Sheet.open({ title: 'Filtrar', body: [host] });
    if (focusProp) setTimeout(function () { pickFilter(ctx, host, focusProp, draw); }, 350);
  }
  function pickFilter(ctx, anchor, prop, done) {
    var m = P().get(ctx.id); if (!m) return;
    var step2 = function (p) {
      W.Menu.open(anchor, (OPS[p.type] || OPS.text).map(function (o) { return { value: o[0], label: p.name + ' ' + o[1] }; })).then(function (op) {
        if (!op) return;
        var add = function (v) { setView(ctx, function (vw) { vw.filter = (vw.filter || []).concat([{ p: p.id, op: op, v: v }]); }); if (done) done(); };
        if (['empty', 'notempty', 'checked', 'unchecked', 'today', 'week', 'overdue'].indexOf(op) >= 0) { add(null); return; }
        if (p.opts) { W.Menu.open(anchor, p.opts.map(function (o) { return { value: o.id, label: o.name }; })).then(function (v) { if (v) add(v); }); return; }
        if (p.type === 'person') { W.Menu.open(anchor, [{ value: 'me', label: 'Yo' }].concat(W.State.friends().map(function (f) { return { value: f.uid, label: f.name || 'Contacto' }; }))).then(function (v) { if (v) add(v); }); return; }
        if (p.type === 'date' || p.type === 'created' || p.type === 'updated') { W.Sheet.prompt({ title: 'Fecha (AAAA-MM-DD)', value: U.today(), maxLength: 10, ok: 'Añadir' }).then(function (v) { if (v && /^\d{4}-\d{2}-\d{2}$/.test(v)) add(v); }); return; }
        W.Sheet.prompt({ title: 'Valor', maxLength: 60, ok: 'Añadir' }).then(function (v) { if (v) add(v); });
      });
    };
    if (prop) { step2(prop); return; }
    W.Menu.open(anchor, m.db.props.map(function (p) { return { value: p.id, label: p.name, icon: P().PROPS[p.type].icon }; }), { title: 'Filtrar por' }).then(function (pid) { if (pid) step2(P().getProp(ctx.id, pid)); });
  }
  function viewMenu(ctx, anchor) {
    var m = P().get(ctx.id), view = ctx.view;
    var items = [
      { value: 'rename', label: 'Cambiar el nombre', icon: 'edit' },
      { value: 'type', label: 'Tipo de vista: ' + P().VIEWS[view.type].label.toLowerCase(), icon: P().VIEWS[view.type].icon },
      view.type === 'board' ? { value: 'group', label: 'Agrupar por…', icon: 'board' } : null,
      view.type === 'calendar' ? { value: 'date', label: 'Fecha que se usa…', icon: 'calendar' } : null,
      { value: 'sort', label: 'Ordenar…', icon: 'sort' },
      { value: 'filter', label: 'Filtros' + (view.filter && view.filter.length ? ' (' + view.filter.length + ')' : ''), icon: 'filter' },
      { value: 'props', label: 'Propiedades visibles…', icon: 'eye' },
      { value: 'dup', label: 'Duplicar la vista', icon: 'copy', gap: true },
      m.db.views.length > 1 ? { value: 'del', label: 'Eliminar la vista', icon: 'trash', destructive: true } : null
    ].filter(Boolean);
    W.Menu.open(anchor, items, { title: view.name }).then(function (v) {
      if (!v) return;
      if (v === 'rename') W.Sheet.prompt({ title: 'Nombre de la vista', value: view.name, maxLength: 40, ok: 'Guardar' }).then(function (n) { if (n) setView(ctx, function (vw) { vw.name = n; }); });
      else if (v === 'type') W.Menu.open(anchor, Object.keys(P().VIEWS).map(function (k) { return { value: k, label: P().VIEWS[k].label, icon: P().VIEWS[k].icon, on: k === view.type }; })).then(function (t) { if (t) setView(ctx, function (vw) { vw.type = t; }); });
      else if (v === 'group') W.Menu.open(anchor, m.db.props.filter(function (p) { return p.type === 'status' || p.type === 'select' || p.type === 'check' || p.type === 'multi'; }).map(function (p) { return { value: p.id, label: p.name, on: view.group === p.id }; })).then(function (g) { if (g) setView(ctx, function (vw) { vw.group = g; }); });
      else if (v === 'date') W.Menu.open(anchor, m.db.props.filter(function (p) { return p.type === 'date'; }).map(function (p) { return { value: p.id, label: p.name, on: view.date === p.id }; })).then(function (g) { if (g) setView(ctx, function (vw) { vw.date = g; }); });
      else if (v === 'sort') W.Menu.open(anchor, m.db.props.map(function (p) { return { value: p.id, label: p.name, icon: P().PROPS[p.type].icon, on: (view.sort[0] || {}).p === p.id }; }).concat([{ value: '__none', label: 'Sin orden (manual)', gap: true }]), { title: 'Ordenar por' }).then(function (pid) {
        if (!pid) return;
        if (pid === '__none') { setView(ctx, function (vw) { vw.sort = []; }); return; }
        W.Menu.open(anchor, [{ value: '1', label: 'De menor a mayor (A→Z)' }, { value: '-1', label: 'De mayor a menor (Z→A)' }]).then(function (d) { if (d) setView(ctx, function (vw) { vw.sort = [{ p: pid, d: +d }]; }); });
      });
      else if (v === 'filter') filterSheet(ctx);
      else if (v === 'props') {
        var host = U.el('div');
        var draw = function () {
          U.clear(host);
          var cur = (P().get(ctx.id).db.views.filter(function (x) { return x.id === view.id; })[0] || view);
          host.appendChild(W.UI.section({ header: 'Se ven en «' + view.name + '»', items: m.db.props.filter(function (p) { return p.id !== 'title'; }).map(function (p) {
            return W.UI.cell({ icon: P().PROPS[p.type].icon, title: p.name, right: W.UI.toggle((cur.hide || []).indexOf(p.id) < 0, function (on) { setView(ctx, function (vw) { vw.hide = (vw.hide || []).filter(function (x) { return x !== p.id; }); if (!on) vw.hide.push(p.id); }); }, p.name) });
          }) }));
        };
        draw();
        W.Sheet.open({ title: 'Propiedades', body: [host] });
      }
      else if (v === 'dup') { var nid = U.uid('v').replace(/[^A-Za-z0-9_-]/g, ''); P().setDb(ctx.id, function (d) { var c = JSON.parse(JSON.stringify(view)); c.id = nid; c.name = view.name + ' (copia)'; d.views.push(c); }); ctx.state.view = nid; if (ctx.onView) ctx.onView(nid); ctx.redraw(); }
      else if (v === 'del') { P().setDb(ctx.id, function (d) { d.views = d.views.filter(function (x) { return x.id !== view.id; }); }); ctx.state.view = null; ctx.redraw(); }
    });
  }
  function addView(ctx, anchor) {
    W.Menu.open(anchor, Object.keys(P().VIEWS).map(function (k) { return { value: k, label: P().VIEWS[k].label, icon: P().VIEWS[k].icon }; }), { title: 'Nueva vista' }).then(function (t) {
      if (!t) return;
      var nid = U.uid('v').replace(/[^A-Za-z0-9_-]/g, ''), m = P().get(ctx.id);
      var group = t === 'board' ? (m.db.props.filter(function (p) { return p.type === 'status' || p.type === 'select'; })[0] || {}).id || null : null;
      var date = t === 'calendar' ? (m.db.props.filter(function (p) { return p.type === 'date'; })[0] || {}).id || null : null;
      P().setDb(ctx.id, function (d) { d.views.push({ id: nid, name: P().VIEWS[t].label, type: t, group: group, date: date }); });
      ctx.state.view = nid; if (ctx.onView) ctx.onView(nid);
      ctx.redraw();
    });
  }

  /* ---------- Componente ---------- */
  var states = {};
  /** render(dbId, { inline, view, readOnly, onOpenPage, onView }) → elemento que se repinta solo */
  function render(dbId, o) {
    o = o || {};
    var st = states[dbId + (o.inline ? ':i' : '')] || (states[dbId + (o.inline ? ':i' : '')] = { view: o.view || null, q: '', month: null });
    var host = U.el('div.dbv' + (o.inline ? '.inline' : ''), { attrs: { 'data-db': dbId } });
    var ctx = { id: dbId, el: host, state: st, ro: !!o.readOnly, onView: o.onView,
      open: function (id, opts) { if (o.onOpenPage) o.onOpenPage(id, opts); },
      redraw: function () { draw(); } };
    var unsub = P().subscribe(function (r) { if (!host.isConnected) { unsub(); return; } if (r.props || r.create || r.schema || r.trash || r.restore || r.destroy || r.remote || r.meta || r.move) draw(); });
    function draw() {
      var m = P().get(dbId);
      U.clear(host);
      if (!m || !m.db) { host.appendChild(U.el('div.dbv-empty', { text: 'Esta base de datos ya no existe.' })); return; }
      var db = m.db;
      var view = db.views.filter(function (v) { return v.id === st.view; })[0] || db.views[0];
      st.view = view.id;
      ctx.db = db; ctx.view = JSON.parse(JSON.stringify(view));
      ctx.rows = P().viewRows(dbId, view, st.q);
      // Cabecera: título (en las insertadas), pestañas de vistas y herramientas
      if (o.inline) {
        var title = U.el('div.dbv-title', { attrs: { contenteditable: ctx.ro ? 'false' : 'true', 'data-ph': 'Base de datos sin título', spellcheck: 'false' }, text: m.title || '' });
        title.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); title.blur(); } e.stopPropagation(); });
        title.addEventListener('blur', function () { var t = title.textContent.trim(); if (t !== (m.title || '')) P().update(dbId, { title: t }, { reason: 'title' }); });
        host.appendChild(U.el('div.dbv-head', [U.el('span.dbv-head-ic', [U.icon(m.icon || 'database')]), title,
          U.el('button.nav-icon', { attrs: { 'aria-label': 'Abrir a pantalla completa', title: 'Abrir a pantalla completa' }, on: { click: function () { ctx.open(dbId); } } }, [U.icon('expand')])]));
      }
      var tabs = U.el('div.dbv-tabs', db.views.map(function (v) {
        var b = U.el('button.dbv-tab' + (v.id === view.id ? '.on' : ''), { attrs: { type: 'button' } }, [U.icon(P().VIEWS[v.type].icon, 'xs'), U.el('span', { text: v.name })]);
        b.addEventListener('click', function (e) { if (v.id === view.id) { if (!ctx.ro) viewMenu(ctx, e.currentTarget); return; } st.view = v.id; if (o.onView) o.onView(v.id); draw(); });
        return b;
      }));
      if (!ctx.ro) tabs.appendChild(U.el('button.dbv-tab.add', { attrs: { type: 'button', 'aria-label': 'Nueva vista', title: 'Nueva vista' }, on: { click: function (e) { addView(ctx, e.currentTarget); } } }, [U.icon('plus', 'xs')]));
      var search = U.el('input.dbv-search', { attrs: { type: 'search', placeholder: 'Buscar', 'aria-label': 'Buscar en la base de datos' } });
      search.value = st.q || '';
      search.addEventListener('input', U.debounce(function () { st.q = search.value.trim(); var pos = search.selectionStart; draw(); var s2 = host.querySelector('.dbv-search'); if (s2) { s2.focus(); try { s2.setSelectionRange(pos, pos); } catch (e) { /* sin posición */ } } }, 200));
      search.addEventListener('keydown', function (e) { e.stopPropagation(); });
      var nf = (view.filter || []).length;
      var tools = U.el('div.dbv-tools', [search,
        U.el('button.btn.xs.ghost' + (nf ? '.on' : ''), { attrs: { title: 'Filtrar' }, on: { click: function () { filterSheet(ctx); } } }, [U.icon('filter', 'sm'), nf ? String(nf) : null]),
        U.el('button.btn.xs.ghost' + ((view.sort || []).length ? '.on' : ''), { attrs: { title: 'Ordenar', 'aria-label': 'Ordenar' }, on: { click: function (e) { var a = e.currentTarget; ctx.view = view; viewMenuSort(ctx, a); } } }, [U.icon('sort', 'sm')]),
        ctx.ro ? null : U.el('button.btn.xs.primary', { on: { click: function () { newRow(ctx, {}); } } }, [U.icon('plus', 'sm'), 'Nueva'])
      ]);
      host.appendChild(U.el('div.dbv-bar', [tabs, tools]));
      var body;
      switch (view.type) {
        case 'board': body = boardView(ctx); break;
        case 'list': body = listView(ctx); break;
        case 'calendar': body = calendarView(ctx); break;
        case 'gallery': body = galleryView(ctx); break;
        default: body = tableView(ctx);
      }
      if (!ctx.rows.length && view.type !== 'calendar' && view.type !== 'board') {
        host.appendChild(U.el('div.dbv-empty', [U.el('p', { text: st.q || nf ? 'No hay filas con estos filtros.' : 'Aún no hay nada aquí.' }), ctx.ro ? null : U.el('button.btn.sm.soft', { on: { click: function () { newRow(ctx, {}); } } }, [U.icon('plus', 'sm'), 'Añadir la primera'])]));
      } else host.appendChild(body);
    }
    function viewMenuSort(c, a) {
      var m = P().get(dbId), view = c.view;
      W.Menu.open(a, m.db.props.map(function (p) { return { value: p.id, label: p.name, icon: P().PROPS[p.type].icon, on: (view.sort[0] || {}).p === p.id }; }).concat([{ value: '__none', label: 'Sin orden (manual)', gap: true }]), { title: 'Ordenar por' }).then(function (pid) {
        if (!pid) return;
        if (pid === '__none') { setView(c, function (vw) { vw.sort = []; }); return; }
        W.Menu.open(a, [{ value: '1', label: 'De menor a mayor (A→Z)' }, { value: '-1', label: 'De mayor a menor (Z→A)' }]).then(function (d) { if (d) setView(c, function (vw) { vw.sort = [{ p: pid, d: +d }]; }); });
      });
    }
    draw();
    return host;
  }

  /** Propiedades de una fila, arriba de su página */
  function rowProps(rowId, o) {
    o = o || {};
    var row = P().get(rowId); if (!row) return null;
    var db = P().get(row.parent); if (!db || !db.db) return null;
    var host = U.el('div.dbv-rowprops');
    var draw = function () {
      U.clear(host);
      var r = P().get(rowId); if (!r) return;
      db.db.props.filter(function (p) { return p.id !== 'title'; }).forEach(function (p) {
        var val = U.el('button.dbv-rp-v', { attrs: { type: 'button', disabled: o.readOnly } }, [cellContent(r, p)]);
        if (!(P().propValue(r, p) != null && P().propValue(r, p) !== '' && !(Array.isArray(P().propValue(r, p)) && !P().propValue(r, p).length)) && p.type !== 'check' && p.type !== 'created' && p.type !== 'updated') val.appendChild(U.el('span.dbv-rp-empty', { text: 'Vacío' }));
        val.addEventListener('click', function () { editValue(rowId, p, val, draw); });
        host.appendChild(U.el('div.dbv-rp', [U.el('span.dbv-rp-k', [U.icon(P().PROPS[p.type].icon, 'xs'), U.el('span', { text: p.name })]), val]));
      });
      if (!o.readOnly) host.appendChild(U.el('button.dbv-rp-add', { attrs: { type: 'button' }, on: { click: function (e) { addProp({ id: db.id, redraw: draw }, e.currentTarget); } } }, [U.icon('plus', 'xs'), 'Añadir propiedad']));
    };
    var unsub = P().subscribe(function (r) { if (!host.isConnected) { unsub(); return; } if (r.props || r.schema) draw(); });
    draw();
    return host;
  }

  W.DbView = { render: render, rowProps: rowProps, editValue: editValue, cellContent: cellContent };
})(window.Whider);
