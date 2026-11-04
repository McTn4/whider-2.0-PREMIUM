/**
 * WHIDER · Perfil y resumen: tu foto, nombre y nivel; actividad (estadísticas, gráfico,
 * constancia y listas), marcas personales y logros. Acceso directo a Ajustes.
 */
window.Whider = window.Whider || {};
window.Whider.Screens = window.Whider.Screens || {};

(function (W) {
  'use strict';
  var U = W.U, S = function () { return W.State; };
  var range = 7;

  function fmtAvg(n) { return (Math.round(n * 10) / 10).toString().replace('.', ','); }

  function chart(st, rerender) {
    var days = st.lastDays(range), max = 1;
    days.forEach(function (d) { if (d.count > max) max = d.count; });
    var bars = U.el('div.chart' + (range > 7 ? '.dense' : ''), { attrs: { role: 'img', 'aria-label': 'Tareas completadas por día' } });
    days.forEach(function (d, i) {
      var h = d.count ? Math.max(5, Math.round(d.count / max * 100)) : 2;
      var label = range === 7 ? U.WEEKDAYS_LETTER[U.weekday(d.date)] : (i % 5 === 0 || d.isToday ? String(U.parse(d.date).getDate()) : '');
      bars.appendChild(U.el('div.chart-col' + (d.isToday ? '.today' : ''), { attrs: { title: U.fmtShort(d.date) + ': ' + d.count } }, [
        U.el('div.chart-track', [U.el('i' + (d.count ? '' : '.zero'), { style: { height: h + '%' } })]),
        U.el('span.chart-d', { text: label })
      ]));
    });
    var total = days.reduce(function (a, d) { return a + d.count; }, 0);
    return U.el('div.group.card', [
      U.el('div.card-head', [U.el('strong', { text: 'Tareas completadas' }),
        W.UI.segmented([{ value: 7, label: '7 D' }, { value: 30, label: '30 D' }], range, function (v) { range = v; rerender(); }, { mini: true })]),
      U.el('div.card-kicker', { text: 'Media diaria' }),
      U.el('div.card-big', [fmtAvg(total / range), U.el('small', { text: U.plural(total, 'tarea', 'tareas') + ' en ' + range + ' días' })]),
      bars
    ]);
  }

  function heatmap(st) {
    var weeks = 15, map = st.doneByDay(), td = U.today(), ws = st.settings.weekStart;
    var offset = (U.weekday(td) - ws + 7) % 7;
    var start = U.addDays(td, -(weeks - 1) * 7 - offset);
    var g = U.el('div.heat', { attrs: { 'aria-hidden': 'true' } }), max = 1;
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
    return U.el('div.group.card', [
      U.el('div.card-head', [U.el('strong', { text: 'Constancia' }), U.el('span.muted', { text: U.plural(active, 'día activo', 'días activos') })]),
      g
    ]);
  }

  function byList(st) {
    var rows = st.lists.map(function (l) {
      var all = st.tasks.filter(function (t) { return t.listId === l.id; });
      return { l: l, all: all.length, done: all.filter(function (t) { return t.done; }).length };
    }).filter(function (r) { return r.all; });
    if (!rows.length) return null;
    return U.el('div.group.card', [
      U.el('div.card-head', [U.el('strong', { text: 'Por listas' })]),
      U.el('div.list-bars', rows.map(function (r) {
        var c = st.ACCENTS[r.l.color].a;
        return U.el('div', [U.el('div.list-bar-top', [U.el('span', [U.el('span.dot', { style: { '--c': c } }), r.l.name]), U.el('b', { text: r.done + ' de ' + r.all })]),
          U.el('div.bar', [U.el('i', { style: { width: Math.round(r.done / r.all * 100) + '%', background: c } })])]);
      }))
    ]);
  }

  function activity(st, host, rerender) {
    var s = st.stats();
    var nodes = [
      U.el('div.group.stats', [
        U.el('div', [U.el('strong', { text: s.done }), U.el('span', { text: 'Completadas' })]),
        U.el('div', [U.el('strong', { text: s.streak }), U.el('span', { text: s.streak === 1 ? 'Día de racha' : 'Días de racha' })]),
        U.el('div', [U.el('strong', { text: s.focusMin }), U.el('span', { text: 'Min de enfoque' })])
      ]),
      chart(st, rerender),
      heatmap(st),
      byList(st)
    ];
    U.clear(host);
    nodes.forEach(function (n) { if (n) { n.classList.add('sec'); host.appendChild(n); } });
    host.firstChild.classList.add('first');
  }

  function achievements(st, host) {
    var list = st.achievements(), got = list.filter(function (a) { return a.ok; }).length;
    U.clear(host);
    host.appendChild(W.UI.section({ first: true,
      items: U.el('div.group.badges', list.map(function (a) {
        return U.el('div.badge' + (a.ok ? '.ok' : ''), [
          U.el('span.badge-ic', [U.icon(a.ok ? a.icon : 'lock')]),
          U.el('strong', { text: a.title }), U.el('small', { text: a.desc })
        ]);
      })),
      footer: got + ' de ' + list.length + ' logros conseguidos.'
    }));
  }

  /** Tarjeta de perfil: foto, nombre, cuenta y nivel */
  function profileCard(st) {
    var s = st.stats(), u = W.Auth && W.Auth.user, name = st.displayName();
    return U.el('div.profile-card', [
      U.el('button.photo-pick', { attrs: { 'aria-label': 'Editar nombre y foto' }, on: { click: function () { W.Profile.edit(); } } }, [W.Profile.avatar('lg'), U.el('span.cam', [U.icon('camera')])]),
      U.el('div.profile-id', [
        U.el('strong', { text: name || 'Tu perfil' }),
        U.el('span', { text: u && u.email ? u.email : (W.Auth && W.Auth.configured() ? 'Sin cuenta · datos solo en este dispositivo' : 'Datos guardados en este dispositivo') }),
        U.el('div.level', [U.el('b', { text: 'Nivel ' + s.level + ' · ' + st.levelTitle(s.level) }), U.el('div.bar', [U.el('i', { style: { width: Math.round(s.levelProgress * 100) + '%' } })])])
      ])
    ]);
  }

  W.Screens.progress = {
    title: 'Perfil',
    back: function () { W.Router.back(); return true; },
    render: function (root) {
      var st = S(), tab = st.ui.profileTab || 'summary';
      if (tab !== 'records' && tab !== 'achievements') tab = 'summary';
      var head = W.UI.header({ title: 'Perfil', back: { label: 'Atrás', onTap: function () { W.Router.back(); } },
        actions: tab === 'records' ? [{ icon: 'plus', label: 'Nueva marca', onTap: function () { W.RecordsView.newMark(); } }] : [] });
      var host = U.el('div');
      var draw = function () {
        if (tab === 'records') W.RecordsView.render(host);
        else if (tab === 'achievements') achievements(st, host);
        else activity(st, host, draw);
      };
      var seg = W.UI.segmented([{ value: 'summary', label: 'Actividad' }, { value: 'records', label: 'Marcas' }, { value: 'achievements', label: 'Logros' }],
        tab, function (v) { st.ui.profileTab = v; W.Screens.progress.render(root); });
      seg.style.marginTop = '16px';
      var settingsRow = W.UI.section({ items: [
        W.UI.cell({ icon: 'gear', color: 'var(--accent)', title: 'Ajustes', sub: 'Apariencia, avisos, enfoque, cuenta y datos', onTap: function () { W.Settings.open(); } })
      ] });
      settingsRow.style.marginTop = '14px';
      W.UI.mount(root, head, [profileCard(st), settingsRow, seg, host]);
      draw();
    }
  };
})(window.Whider);
