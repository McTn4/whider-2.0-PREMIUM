/**
 * WHIDER · Perfil: foto, nombre y nivel, con tres pestañas (Resumen · Marcas · Logros).
 * Desde aquí se abren "Editar perfil" y Ajustes.
 */
window.Whider = window.Whider || {};
window.Whider.Screens = window.Whider.Screens || {};

(function (W) {
  'use strict';
  var U = W.U, S = function () { return W.State; };
  var range = 7;

  function chart(st, rerender) {
    var days = st.lastDays(range), max = 1;
    days.forEach(function (d) { if (d.count > max) max = d.count; });
    var bars = U.el('div.chart' + (range > 7 ? '.dense' : ''));
    days.forEach(function (d, i) {
      var h = d.count ? Math.max(6, Math.round(d.count / max * 100)) : 3;
      var label = range === 7 ? U.WEEKDAYS_SHORT[U.weekday(d.date)] : (i % 5 === 0 || d.isToday ? String(U.parse(d.date).getDate()) : '');
      bars.appendChild(U.el('div.chart-col' + (d.isToday ? '.today' : ''), { attrs: { title: U.fmtShort(d.date) + ': ' + d.count } }, [
        range === 7 ? U.el('span.chart-n', { text: d.count || '' }) : null,
        U.el('div.chart-track', [U.el('i', { style: { height: h + '%' } })]),
        U.el('span.chart-d', { text: label })
      ]));
    });
    var total = days.reduce(function (a, d) { return a + d.count; }, 0);
    return U.el('div.card', [
      U.el('div.card-title', [U.el('span', { text: 'Actividad' }),
        U.el('div.mini-seg', [7, 30].map(function (r) {
          return U.el('button' + (r === range ? '.active' : ''), { text: r + ' d', on: { click: function () { range = r; rerender(); } } });
        }))]),
      U.el('p.card-sub', { text: U.plural(total, 'tarea completada', 'tareas completadas') + ' · ' + (Math.round(total / range * 10) / 10) + ' al día' }),
      bars
    ]);
  }

  function heatmap(st) {
    var weeks = 15, map = st.doneByDay(), td = U.today(), ws = st.settings.weekStart;
    var offset = (U.weekday(td) - ws + 7) % 7;
    var start = U.addDays(td, -(weeks - 1) * 7 - offset);
    var g = U.el('div.heat'), max = 1;
    Object.keys(map).forEach(function (k) { if (map[k] > max) max = map[k]; });
    for (var w = 0; w < weeks; w++) {
      var col = U.el('div.heat-col');
      for (var d = 0; d < 7; d++) {
        var ds = U.addDays(start, w * 7 + d);
        var n = map[ds] || 0, lvl = ds > td ? -1 : n === 0 ? 0 : Math.min(4, Math.ceil(n / max * 4));
        col.appendChild(U.el('i.l' + (lvl < 0 ? 'x' : lvl) + (ds === td ? '.today' : '')));
      }
      g.appendChild(col);
    }
    var active = Object.keys(map).filter(function (k) { return k >= start; }).length;
    return U.el('div.card', [
      U.el('div.card-title', [U.el('span', { text: 'Constancia' }), U.el('span.card-title-right', { text: U.plural(active, 'día activo', 'días activos') })]),
      g
    ]);
  }

  function byList(st) {
    var rows = st.lists.map(function (l) {
      var all = st.tasks.filter(function (t) { return t.listId === l.id; });
      return { l: l, all: all.length, done: all.filter(function (t) { return t.done; }).length };
    }).filter(function (r) { return r.all; });
    if (!rows.length) return null;
    return U.el('div.card', [
      U.el('div.card-title', [U.el('span', { text: 'Por listas' })]),
      U.el('div.list-bars', rows.map(function (r) {
        var c = st.ACCENTS[r.l.color];
        return U.el('div.list-bar', [U.el('div.list-bar-top', [U.el('span', [U.el('span.dot', { style: { '--c': c.a } }), r.l.name]), U.el('b', { text: r.done + '/' + r.all })]),
          U.el('div.bar', [U.el('i', { style: { width: Math.round(r.done / r.all * 100) + '%', background: c.a } })])]);
      }))
    ]);
  }

  function summary(st, host, rerender) {
    var s = st.stats();
    var frag = U.el('div.tab-body', [
      U.el('div.card.stat-row', [
        U.el('div', [U.el('strong.num', { text: s.done }), U.el('span', { text: 'completadas' })]),
        U.el('div', [U.el('strong.num', { text: s.streak }), U.el('span', { text: s.streak === 1 ? 'día de racha' : 'días de racha' })]),
        U.el('div', [U.el('strong.num', { text: s.focusMin }), U.el('span', { text: 'min de enfoque' })])
      ]),
      chart(st, rerender),
      heatmap(st),
      byList(st)
    ]);
    U.clear(host).appendChild(frag);
  }

  function achievements(st, host) {
    var list = st.achievements(), got = list.filter(function (a) { return a.ok; }).length;
    U.clear(host).appendChild(U.el('div.tab-body', [
      U.el('p.hint.left', { text: got + ' de ' + list.length + ' logros conseguidos' }),
      U.el('div.badges', list.map(function (a) {
        return U.el('div.badge' + (a.ok ? '.ok' : ''), [
          U.el('span.badge-ic', [U.icon(a.ok ? a.icon : 'lock')]),
          U.el('strong', { text: a.title }), U.el('small', { text: a.desc })
        ]);
      }))
    ]));
  }

  W.Screens.progress = {
    title: 'Perfil',
    render: function (root) {
      var st = S(), s = st.stats(), tab = st.ui.profileTab || 'summary';
      var inner = U.el('div.inner');
      var name = st.displayName();
      inner.appendChild(U.el('div.card.profile-card', [
        U.el('button.avatar-pick', { attrs: { 'aria-label': 'Editar perfil' }, on: { click: function () { W.Profile.edit(); } } }, [
          W.Profile.avatar('xl'), U.el('span.avatar-cam', [U.icon('camera', 'xs')])
        ]),
        U.el('div.profile-id', [
          U.el('h2', { text: name || 'Tu perfil' }),
          U.el('span', { text: 'Nivel ' + s.level + ' · ' + st.levelTitle(s.level) }),
          U.el('div.bar.thin', [U.el('i', { style: { width: Math.round(s.levelProgress * 100) + '%' } })]),
          name ? null : U.el('button.link-btn', { text: 'Añadir nombre y foto', on: { click: function () { W.Profile.edit(); } } })
        ]),
        U.el('button.icon-btn.plain', { attrs: { 'aria-label': 'Ajustes' }, on: { click: function () { W.Router.go('settings'); } } }, [U.icon('sliders', 'sm')])
      ]));
      var host = U.el('div');
      var draw = function () {
        if (tab === 'records') W.RecordsView.render(host);
        else if (tab === 'achievements') achievements(st, host);
        else summary(st, host, draw);
      };
      inner.appendChild(W.UI.segmented([{ value: 'summary', label: 'Resumen' }, { value: 'records', label: 'Marcas' }, { value: 'achievements', label: 'Logros' }],
        tab, function (v) { tab = v; st.ui.profileTab = v; draw(); }));
      inner.appendChild(host);
      draw();
      U.clear(root).appendChild(inner);
    }
  };
})(window.Whider);
