/**
 * WHIDER · Registro de marcas: récords automáticos, marcas personales e historial
 */
window.Whider = window.Whider || {};
window.Whider.Screens = window.Whider.Screens || {};

(function (W) {
  'use strict';
  var U = W.U, S = function () { return W.State; }, R = function () { return W.Records; };
  var ICONS = ['trophy', 'flame', 'bolt', 'target', 'timer', 'medal', 'crown', 'chart', 'sparkle', 'flag'];

  function autoCard(key) {
    var meta = R().AUTO[key], best = S().records.best[key], cur = R().current()[key];
    var v = best ? best.value : 0;
    var near = v > 0 && cur > 0 && cur < v ? Math.round(cur / v * 100) : null;
    return U.el('div.card.rec-card' + (v ? '' : '.empty'), [
      U.el('span.rec-ic', [U.icon(meta.icon)]),
      U.el('span.eyebrow', { text: meta.title }),
      U.el('strong.num', { text: v ? String(v) : '—' }),
      U.el('span.rec-unit', { text: v ? meta.fmt(v).replace(/^[\d.,]+\s*/, '') : 'Aún sin marca' }),
      U.el('span.rec-date', { text: v ? 'Conseguida ' + (best.date === U.today() ? 'hoy' : 'el ' + U.fmtShort(best.date)) : '' }),
      near ? U.el('div.rec-near', [U.el('div.bar', [U.el('i', { style: { width: near + '%' } })]), U.el('span', { text: 'Ahora: ' + cur + ' (' + near + '%)' })]) : null
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
    return U.svg('svg', { 'class': 'spark', viewBox: '0 0 ' + w + ' ' + h, preserveAspectRatio: 'none' }, [
      U.svg('polyline', { points: pts.join(' '), fill: 'none', stroke: 'url(#g-accent-h)', 'stroke-width': '2.2', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }),
      U.svg('circle', { cx: pts[pts.length - 1].split(',')[0], cy: pts[pts.length - 1].split(',')[1], r: '3', fill: 'var(--accent)' })
    ]);
  }

  function markCard(m) {
    var best = R().bestEntry(m), last = m.entries[m.entries.length - 1];
    return U.el('button.card.mark-card', { on: { click: function () { openMark(m.id); } } }, [
      U.el('span.row-icon', [U.icon(m.icon || 'trophy')]),
      U.el('span.mark-main', [
        U.el('span.row-label', { text: m.name }),
        U.el('span.row-desc', { text: m.entries.length ? U.plural(m.entries.length, 'registro', 'registros') + (last ? ' · último ' + U.fmtShort(last.date) : '') : 'Sin registros todavía' })
      ]),
      U.el('span.mark-best', [U.el('small', { text: 'Mejor' }), U.el('strong', { text: best ? R().fmtValue(m, best.value) : '—' })]),
      sparkline(m)
    ]);
  }

  /** Crear o editar una marca personal */
  function editMark(m) {
    var d = m ? { name: m.name, unit: m.unit, kind: m.kind, better: m.better, icon: m.icon } : { name: '', unit: '', kind: 'number', better: 'higher', icon: 'trophy' };
    var name = U.el('input.input', { attrs: { type: 'text', maxlength: 40, placeholder: 'Ej.: 5 km, Press banca, Páginas leídas' } });
    name.value = d.name;
    var unit = U.el('input.input', { attrs: { type: 'text', maxlength: 12, placeholder: 'Ej.: kg, km, páginas' } });
    unit.value = d.unit;
    var unitField = U.el('div.field', [U.el('span.field-label', { text: 'Unidad (opcional)' }), unit]);
    unitField.style.display = d.kind === 'time' ? 'none' : '';
    var icons = U.el('div.icon-pick', ICONS.map(function (ic) {
      var b = U.el('button.icon-btn' + (ic === d.icon ? '.active' : ''), { attrs: { 'aria-label': ic }, on: { click: function () {
        d.icon = ic; U.$$('.icon-btn', icons).forEach(function (x) { x.classList.remove('active'); }); b.classList.add('active'); W.Audio.tap();
      } } }, [U.icon(ic)]);
      return b;
    }));
    var s = W.Sheet.open({
      title: m ? 'Editar marca' : 'Nueva marca personal',
      body: [
        U.el('div.field', [U.el('span.field-label', { text: 'Nombre' }), name]),
        U.el('div.field', [U.el('span.field-label', { text: 'Tipo de valor' }), W.UI.segmented([{ value: 'number', label: 'Número' }, { value: 'time', label: 'Tiempo (mm:ss)' }], d.kind, function (v) {
          d.kind = v; unitField.style.display = v === 'time' ? 'none' : '';
        })]),
        unitField,
        U.el('div.field', [U.el('span.field-label', { text: '¿Qué es mejor?' }), W.UI.segmented([{ value: 'higher', label: 'Más alto' }, { value: 'lower', label: 'Más bajo' }], d.better, function (v) { d.better = v; })]),
        U.el('div.field', [U.el('span.field-label', { text: 'Icono' }), icons])
      ],
      foot: [
        U.el('button.btn.ghost', { text: 'Cancelar', on: { click: function () { s.close(); } } }),
        U.el('button.btn.primary', { text: m ? 'Guardar' : 'Crear marca', on: { click: function () {
          if (!name.value.trim()) { name.focus(); name.classList.add('shake'); setTimeout(function () { name.classList.remove('shake'); }, 500); return; }
          var data = { name: name.value.trim(), unit: d.kind === 'time' ? '' : unit.value.trim(), kind: d.kind, better: d.better, icon: d.icon };
          if (m) R().updateMark(m.id, data);
          else { var nm = R().addMark(data); s.close(); W.Toast.show({ text: 'Marca "' + nm.name + '" creada', type: 'success', icon: nm.icon }); setTimeout(function () { addEntry(nm.id); }, 450); return; }
          s.close();
        } } })
      ]
    });
    if (!m) setTimeout(function () { name.focus(); }, 400);
  }

  function addEntry(markId) {
    var m = R().getMark(markId);
    if (!m) return;
    var value = U.el('input.input.entry-value', { attrs: { type: 'text', inputmode: m.kind === 'time' ? 'numeric' : 'decimal', placeholder: m.kind === 'time' ? 'mm:ss (p. ej. 24:10)' : 'Valor' + (m.unit ? ' en ' + m.unit : '') } });
    var date = U.el('input.input', { attrs: { type: 'date', value: U.today(), max: U.today() } });
    var note = U.el('input.input', { attrs: { type: 'text', maxlength: 120, placeholder: 'Nota (opcional)' } });
    var best = R().bestEntry(m);
    var s = W.Sheet.open({
      title: 'Registrar · ' + m.name,
      body: [
        best ? U.el('p.hint', { text: 'Tu mejor marca: ' + R().fmtValue(m, best.value) }) : null,
        U.el('div.field', [U.el('span.field-label', { text: m.kind === 'time' ? 'Tiempo' : 'Valor' }), value]),
        U.el('div.field', [U.el('span.field-label', { text: 'Fecha' }), date]),
        U.el('div.field', [U.el('span.field-label', { text: 'Nota' }), note])
      ],
      foot: [
        U.el('button.btn.ghost', { text: 'Cancelar', on: { click: function () { s.close(); } } }),
        U.el('button.btn.primary', { text: 'Guardar registro', on: { click: function () {
          var v = R().parseValue(m, value.value);
          if (!isFinite(v)) { value.focus(); value.classList.add('shake'); setTimeout(function () { value.classList.remove('shake'); }, 500); return; }
          var isRecord = R().addEntry(m.id, v, date.value || U.today(), note.value.trim());
          s.close();
          if (isRecord) {
            W.Fx.confetti(); W.Audio.celebrate();
            W.Toast.show({ text: '¡Nueva mejor marca en ' + m.name + '! ' + R().fmtValue(m, v), type: 'success', icon: 'trophy', duration: 4500 });
          } else {
            W.Audio.success();
            W.Toast.show({ text: 'Registro guardado', type: 'success', icon: 'check' });
          }
        } } })
      ]
    });
    setTimeout(function () { value.focus(); }, 400);
  }

  function openMark(id) {
    var m = R().getMark(id);
    if (!m) return;
    var best = R().bestEntry(m);
    var list = U.el('div.entry-list');
    m.entries.slice().reverse().forEach(function (e) {
      list.appendChild(U.el('div.entry' + (best && e.id === best.id ? '.best' : ''), [
        U.el('div.entry-main', [U.el('strong', { text: R().fmtValue(m, e.value) }), U.el('span', { text: U.fmtLong(e.date) + (e.note ? ' · ' + e.note : '') })]),
        best && e.id === best.id ? U.el('span.tag.today', [U.icon('trophy'), 'Mejor']) : null,
        U.el('button.icon-btn.mini', { attrs: { 'aria-label': 'Borrar registro' }, on: { click: function () {
          W.Sheet.confirm({ title: '¿Borrar este registro?', text: R().fmtValue(m, e.value) + ' · ' + U.fmtLong(e.date), ok: 'Borrar', danger: true })
            .then(function (ok) { if (ok) { R().removeEntry(m.id, e.id); s.close(); setTimeout(function () { openMark(id); }, 420); } });
        } } }, [U.icon('trash', 'xs')])
      ]));
    });
    var s = W.Sheet.open({
      title: m.name,
      body: [
        U.el('div.mark-hero', [
          U.el('span.rec-ic', [U.icon(m.icon || 'trophy')]),
          U.el('div', [U.el('span.eyebrow', { text: 'Mejor marca · ' + (m.better === 'lower' ? 'menos es mejor' : 'más es mejor') }),
            U.el('strong.num', { text: best ? R().fmtValue(m, best.value) : '—' }),
            best ? U.el('span.rec-date', { text: 'el ' + U.fmtShort(best.date) }) : null])
        ]),
        sparkline(m),
        m.entries.length ? list : W.UI.empty('trophy', 'Sin registros', 'Añade tu primer valor para empezar a seguir tu progreso.')
      ],
      foot: [
        U.el('button.btn.danger.round', { attrs: { 'aria-label': 'Eliminar marca' }, on: { click: function () {
          W.Sheet.confirm({ title: '¿Eliminar "' + m.name + '"?', text: 'Se borrarán también sus ' + U.plural(m.entries.length, 'registro', 'registros') + '.', ok: 'Eliminar', danger: true })
            .then(function (ok) { if (ok) { R().removeMark(m.id); s.close(); W.Toast.show({ text: 'Marca eliminada', icon: 'trash' }); } });
        } } }, [U.icon('trash')]),
        U.el('button.btn.ghost.round', { attrs: { 'aria-label': 'Editar marca' }, on: { click: function () { s.close(); setTimeout(function () { editMark(m); }, 420); } } }, [U.icon('edit')]),
        U.el('button.btn.primary', { on: { click: function () { s.close(); setTimeout(function () { addEntry(m.id); }, 420); } } }, [U.icon('plus', 'sm'), 'Registrar'])
      ]
    });
  }

  W.Screens.records = {
    title: 'Marcas',
    newMark: function () { editMark(null); },
    render: function (root, fresh) {
      var st = S(), marks = R().marks();
      var inner = U.el('div.inner' + (fresh ? '.stagger' : ''));
      inner.appendChild(W.UI.pageHead('Registro de marcas', 'Marcas', 'Tus récords quedan guardados para siempre, aunque borres tareas.',
        U.el('button.icon-btn', { attrs: { 'aria-label': 'Nueva marca' }, on: { click: function () { editMark(null); } } }, [U.icon('plus')])));

      inner.appendChild(U.el('div.section-head', [U.el('h2', { text: 'Récords automáticos' })]));
      inner.appendChild(U.el('div.rec-grid', ['streak', 'day', 'week', 'focusDay'].map(autoCard)));
      var total = st.totalDone();
      inner.appendChild(U.el('div.card.flat.rec-total', [U.icon('trophy'), U.el('span', [U.el('b', { text: total }), ' tareas completadas desde el principio']),
        st.records.best.milestone ? U.el('span.tag.today', { text: 'Hito ' + st.records.best.milestone.value }) : null]));

      inner.appendChild(U.el('div.section-head', [U.el('h2', { text: 'Marcas personales' }),
        U.el('button.link-btn', { on: { click: function () { editMark(null); } } }, [U.icon('plus', 'xs'), 'Nueva'])]));
      if (!marks.length) {
        inner.appendChild(U.el('div.card.flat.mini-empty.marks-empty', [U.icon('medal'),
          U.el('span', { text: 'Registra lo que quieras mejorar: tiempos, pesos, kilómetros, páginas…' }),
          U.el('button.btn.soft.sm', { text: 'Crear', on: { click: function () { editMark(null); } } })]));
      } else {
        inner.appendChild(U.el('div.mark-list', marks.map(markCard)));
      }

      var hist = st.records.history.slice().reverse().slice(0, 40);
      inner.appendChild(U.el('div.section-head', [U.el('h2', { text: 'Historial de marcas' }), U.el('span.sub', { text: hist.length ? U.plural(st.records.history.length, 'marca', 'marcas') : '' })]));
      if (!hist.length) inner.appendChild(U.el('p.hint', { text: 'Cada vez que superes una marca quedará registrada aquí con su fecha.' }));
      else inner.appendChild(U.el('ul.timeline-list', hist.map(function (h) {
        var meta = R().AUTO[h.type];
        var mark = h.type === 'custom' ? R().getMark(h.markId) : null;
        return U.el('li', [
          U.el('span.tl-dot', [U.icon(h.type === 'milestone' ? 'trophy' : mark ? (mark.icon || 'medal') : meta ? meta.icon : 'medal', 'xs')]),
          U.el('div', [U.el('strong', { text: R().historyText(h) }), U.el('span', { text: U.fmtLong(h.date) })])
        ]);
      })));
      inner.appendChild(U.el('p.hint', [U.icon(W.Auth && W.Auth.user ? 'cloud' : 'shield', 'xs'),
        W.Auth && W.Auth.user ? ' Guardado en tu cuenta y en este dispositivo' : ' Guardado en este dispositivo · crea una cuenta para tenerlo en la nube']));
      U.clear(root).appendChild(inner);
    }
  };
})(window.Whider);
