/**
 * WHIDER · Registro de marcas: récords automáticos, marcas personales e historial
 */
window.Whider = window.Whider || {};
window.Whider.Screens = window.Whider.Screens || {};

(function (W) {
  'use strict';
  var U = W.U, S = function () { return W.State; }, R = function () { return W.Records; };
  var ICONS = ['trophy', 'flame', 'bolt', 'target', 'timer', 'medal', 'crown', 'chart', 'star', 'flag'];

  function autoCard(key) {
    var meta = R().AUTO[key], best = S().records.best[key], cur = R().current()[key];
    var v = best ? best.value : 0;
    var unit = v ? meta.fmt(v).replace(/^[\d.,]+\s*/, '') : '';
    var near = v > 0 && cur > 0 && cur < v ? Math.round(cur / v * 100) : null;
    return U.el('div.rec-card' + (v ? '' : '.empty'), [
      U.el('span.rec-label', [U.icon(meta.icon), meta.title]),
      U.el('div.rec-value', [v ? String(v) : '—', unit ? U.el('small', { text: unit }) : null]),
      U.el('span.rec-date', { text: v ? (best.date === U.today() ? 'Hoy' : U.fmtShort(best.date)) : 'Aún sin marca' }),
      near ? U.el('div.rec-near', [U.el('div.bar', [U.el('i', { style: { width: near + '%' } })]), U.el('span', { text: 'Ahora: ' + cur + ' (' + near + ' %)' })]) : null
    ]);
  }

  function sparkline(mark) {
    var es = mark.entries.slice(-12);
    if (es.length < 2) return null;
    var vals = es.map(function (e) { return e.value; });
    var min = Math.min.apply(null, vals), max = Math.max.apply(null, vals), span = max - min || 1;
    var w = 120, h = 34, step = w / (es.length - 1);
    var pts = vals.map(function (v, i) {
      var norm = (v - min) / span;
      if (mark.better === 'lower') norm = 1 - norm;   // arriba = mejor
      return (i * step).toFixed(1) + ',' + (h - 3 - norm * (h - 6)).toFixed(1);
    });
    var last = pts[pts.length - 1].split(',');
    return U.svg('svg', { 'class': 'spark', viewBox: '0 0 ' + w + ' ' + h, preserveAspectRatio: 'none', 'aria-hidden': 'true' }, [
      U.svg('polyline', { points: pts.join(' '), fill: 'none', stroke: 'var(--t1)', 'stroke-width': '1.8', 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'vector-effect': 'non-scaling-stroke' }),
      U.svg('circle', { cx: last[0], cy: last[1], r: '3', fill: 'var(--t1)' })
    ]);
  }

  function markCell(m) {
    var best = R().bestEntry(m), last = m.entries[m.entries.length - 1];
    return W.UI.cell({
      icon: m.icon || 'trophy', title: m.name,
      sub: m.entries.length ? U.plural(m.entries.length, 'registro', 'registros') + (last ? ' · último ' + U.fmtShort(last.date) : '') : 'Sin registros',
      right: U.el('span.cell-row', [U.el('span.mark-best', [U.el('small', { text: 'Mejor' }), U.el('strong', { text: best ? R().fmtValue(m, best.value) : '—' })]), U.icon('chev', 'chev')]),
      onTap: function () { openMark(m.id); }
    });
  }

  function field(label, input) {
    return W.UI.section({ header: label, items: [U.el('label.cell', [input])] });
  }

  /** Crear o editar una marca personal */
  function editMark(m) {
    var d = m ? { name: m.name, unit: m.unit, kind: m.kind, better: m.better, icon: m.icon } : { name: '', unit: '', kind: 'number', better: 'higher', icon: 'trophy' };
    var name = U.el('input.cell-input', { attrs: { type: 'text', maxlength: 40, placeholder: 'Ej.: 5 km, press banca, páginas', 'aria-label': 'Nombre' } });
    name.value = d.name;
    var unit = U.el('input.cell-input', { attrs: { type: 'text', maxlength: 12, placeholder: 'Ej.: kg, km, páginas', 'aria-label': 'Unidad' } });
    unit.value = d.unit;
    var unitField = field('Unidad (opcional)', unit);
    unitField.style.display = d.kind === 'time' ? 'none' : '';
    var icons = U.el('div.icon-pick', ICONS.map(function (ic) {
      var b = U.el('button' + (ic === d.icon ? '.active' : ''), { attrs: { 'aria-label': ic }, on: { click: function () {
        d.icon = ic; U.$$('button', icons).forEach(function (x) { x.classList.remove('active'); }); b.classList.add('active'); W.Audio.select();
      } } }, [U.icon(ic)]);
      return b;
    }));
    var save = function () {
      if (!name.value.trim()) { name.focus(); return; }
      var data = { name: name.value.trim(), unit: d.kind === 'time' ? '' : unit.value.trim(), kind: d.kind, better: d.better, icon: d.icon };
      s.close();
      if (m) { R().updateMark(m.id, data); return; }
      var nm = R().addMark(data);
      setTimeout(function () { addEntry(nm.id); }, 450);
    };
    var s = W.Sheet.open({
      title: m ? 'Editar marca' : 'Nueva marca',
      lead: { text: 'Cancelar', onTap: function () { s.close(); } },
      trail: { text: m ? 'OK' : 'Crear', bold: true, onTap: save },
      body: [
        field('Nombre', name),
        W.UI.section({ header: 'Tipo de valor', items: U.el('div', [W.UI.segmented([{ value: 'number', label: 'Número' }, { value: 'time', label: 'Tiempo (mm:ss)' }], d.kind, function (v) {
          d.kind = v; unitField.style.display = v === 'time' ? 'none' : '';
        })]) }),
        unitField,
        W.UI.section({ header: 'Mejor resultado', items: U.el('div', [W.UI.segmented([{ value: 'higher', label: 'El más alto' }, { value: 'lower', label: 'El más bajo' }], d.better, function (v) { d.better = v; })]) }),
        W.UI.section({ header: 'Icono', items: U.el('div.group', [U.el('div.cell.col', [icons])]) })
      ]
    });
    if (!m) setTimeout(function () { name.focus(); }, 420);
  }

  function addEntry(markId) {
    var m = R().getMark(markId);
    if (!m) return;
    var value = U.el('input.cell-input', { attrs: { type: 'text', inputmode: m.kind === 'time' ? 'numeric' : 'decimal', placeholder: m.kind === 'time' ? 'mm:ss (p. ej. 24:10)' : 'Valor' + (m.unit ? ' en ' + m.unit : ''), 'aria-label': 'Valor' } });
    var date = U.el('input.cell-input', { attrs: { type: 'date', value: U.today(), max: U.today(), 'aria-label': 'Fecha' } });
    var note = U.el('input.cell-input', { attrs: { type: 'text', maxlength: 120, placeholder: 'Nota (opcional)', 'aria-label': 'Nota' } });
    var best = R().bestEntry(m);
    var save = function () {
      var v = R().parseValue(m, value.value);
      if (!isFinite(v)) { value.focus(); value.closest('.group').classList.add('shake'); setTimeout(function () { value.closest('.group').classList.remove('shake'); }, 450); return; }
      var isRecord = R().addEntry(m.id, v, date.value || U.today(), note.value.trim());
      s.close();
      if (isRecord) { W.Audio.complete(); W.Toast.show({ text: 'Nueva mejor marca en ' + m.name + ': ' + R().fmtValue(m, v), type: 'success', icon: 'trophy', duration: 4200 }); }
      else { W.Audio.success(); W.Toast.show({ text: 'Registro guardado', type: 'success', icon: 'check' }); }
    };
    var s = W.Sheet.open({
      title: m.name,
      lead: { text: 'Cancelar', onTap: function () { s.close(); } },
      trail: { text: 'Guardar', bold: true, onTap: save },
      body: [
        W.UI.section({ header: m.kind === 'time' ? 'Tiempo' : 'Valor', items: [U.el('label.cell', [value])], footer: best ? 'Tu mejor marca: ' + R().fmtValue(m, best.value) : null }),
        W.UI.section({ items: [U.el('label.cell', [U.el('span.cell-title', { text: 'Fecha', style: { flex: '1' } }), date]), U.el('label.cell', [note])] })
      ]
    });
    date.style.textAlign = 'right';
    date.style.color = 'var(--t1)';
    setTimeout(function () { value.focus(); }, 420);
  }

  function openMark(id) {
    var m = R().getMark(id);
    if (!m) return;
    var best = R().bestEntry(m);
    var entries = m.entries.slice().reverse().map(function (e) {
      var isBest = best && e.id === best.id;
      return W.UI.cell({ title: R().fmtValue(m, e.value), sub: U.fmtLong(e.date) + (e.note ? ' · ' + e.note : ''),
        right: U.el('span.cell-row', [isBest ? U.el('span.entry-best', { text: 'Mejor' }) : null,
          U.el('button.sub-x', { attrs: { 'aria-label': 'Borrar registro' }, on: { click: function (ev) {
            ev.stopPropagation();
            W.Sheet.confirm({ title: '¿Borrar este registro?', text: R().fmtValue(m, e.value) + ' · ' + U.fmtLong(e.date), ok: 'Borrar', danger: true })
              .then(function (ok) { if (ok) { R().removeEntry(m.id, e.id); s.close(); setTimeout(function () { openMark(id); }, 420); } });
          } } }, [U.icon('trash')])]) });
    });
    var s = W.Sheet.open({
      title: m.name, full: entries.length > 6,
      lead: { text: 'Editar', onTap: function () { s.close(); setTimeout(function () { editMark(m); }, 420); } },
      trail: 'close',
      body: [
        U.el('div.mark-hero', [
          U.el('span.rec-label', [U.icon(m.icon || 'trophy'), 'Mejor marca']),
          U.el('div.rec-value', { text: best ? R().fmtValue(m, best.value) : '—' }),
          U.el('span.rec-date', { text: best ? U.fmtLong(best.date) : (m.better === 'lower' ? 'Gana el valor más bajo' : 'Gana el valor más alto') })
        ]),
        sparkline(m) ? U.el('div.group.card', [sparkline(m)]) : null,
        U.el('button.btn.primary.block', { on: { click: function () { s.close(); setTimeout(function () { addEntry(m.id); }, 420); } } }, ['Añadir registro']),
        entries.length ? W.UI.section({ header: 'Historial', items: entries }) : W.UI.empty(null, 'Sin registros', 'Añade tu primer valor para seguir tu progreso.', null, true),
        U.el('div.group', [W.UI.cell({ title: 'Eliminar marca', center: true, danger: true, onTap: function () {
          W.Sheet.confirm({ title: '¿Eliminar «' + m.name + '»?', text: 'Se borrarán también sus ' + U.plural(m.entries.length, 'registro', 'registros') + '.', ok: 'Eliminar', danger: true })
            .then(function (ok) { if (ok) { R().removeMark(m.id); s.close(); W.Toast.show({ text: 'Marca eliminada', icon: 'trash' }); } });
        } })])
      ]
    });
  }

  /** Contenido de la pestaña "Marcas" del resumen */
  W.RecordsView = {
    newMark: function () { editMark(null); },
    render: function (host) {
      var st = S(), marks = R().marks();
      U.clear(host);
      host.classList.remove('activity-grid');
      host.appendChild(W.UI.section({ title: 'Récords', first: true, items: U.el('div.rec-grid', ['streak', 'day', 'week', 'focusDay'].map(autoCard)),
        footer: U.plural(st.totalDone(), 'tarea completada', 'tareas completadas') + ' desde el principio.' }));
      host.appendChild(W.UI.section({ title: 'Marcas personales',
        items: marks.length ? marks.map(markCell) : U.el('div.group', [W.UI.empty('medal', 'Sin marcas personales', 'Registra lo que quieras mejorar: tiempos, pesos, distancias, páginas…',
          U.el('button.btn.sm.soft', { on: { click: function () { editMark(null); } } }, ['Crear una marca']), true)]) }));

      var hist = st.records.history.slice().reverse().slice(0, 30);
      if (hist.length) {
        host.appendChild(W.UI.section({ title: 'Historial', items: hist.map(function (h) {
          var meta = R().AUTO[h.type];
          var mark = h.type === 'custom' ? R().getMark(h.markId) : null;
          return W.UI.cell({ lead: U.el('span.cell-icon', [U.icon(h.type === 'milestone' ? 'trophy' : mark ? (mark.icon || 'medal') : meta ? meta.icon : 'medal', 'hist-ic')]),
            title: R().historyText(h), sub: U.fmtLong(h.date) });
        }) }));
      }
    }
  };
})(window.Whider);
