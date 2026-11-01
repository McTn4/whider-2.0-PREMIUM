/**
 * WHIDER · Perfil y progreso: nivel, estadísticas, gráfica, mapa de actividad,
 * reparto por listas y logros.
 */
window.Whider = window.Whider || {};
window.Whider.Screens = window.Whider.Screens || {};

(function (W) {
  'use strict';
  var U = W.U, S = function () { return W.State; };
  var range = 7;

  function editName() {
    var st = S();
    W.Sheet.prompt({ title: 'Tu nombre', text: 'Así te saludará WHIDER. Se guarda solo en este dispositivo.', value: st.displayName(), placeholder: 'Cómo te llamas', maxLength: 30 })
      .then(function (v) { if (v) { st.setProfile({ name: v }); W.Toast.show({ text: 'Perfil actualizado', type: 'success', icon: 'user' }); } });
  }

  function chart(st, root) {
    var days = st.lastDays(range), max = 1;
    days.forEach(function (d) { if (d.count > max) max = d.count; });
    var bars = U.el('div.chart' + (range > 7 ? '.dense' : ''));
    days.forEach(function (d, i) {
      var h = d.count ? Math.max(6, Math.round(d.count / max * 100)) : 3;
      var label = range === 7 ? U.WEEKDAYS_SHORT[U.weekday(d.date)] : (i % 5 === 0 || d.isToday ? String(U.parse(d.date).getDate()) : '');
      var col = U.el('div.chart-col' + (d.isToday ? '.today' : ''), { attrs: { title: U.fmtShort(d.date) + ': ' + d.count } }, [
        range === 7 ? U.el('span.chart-n', { text: d.count || '' }) : null,
        U.el('div.chart-track', [U.el('i', { style: { height: '0%', transitionDelay: (i * (range > 7 ? 15 : 50)) + 'ms' } })]),
        U.el('span.chart-d', { text: label })
      ]);
      bars.appendChild(col);
      setTimeout(function () { col.querySelector('i').style.height = h + '%'; }, 50);
    });
    var total = days.reduce(function (a, d) { return a + d.count; }, 0);
    var avg = Math.round(total / range * 10) / 10;
    return U.el('div.card', [
      U.el('div.card-title', [U.icon('chart'), 'Actividad', U.el('span.card-title-right', { text: avg + ' / día' })]),
      W.UI.segmented([{ value: 7, label: '7 días' }, { value: 30, label: '30 días' }], range, function (v) { range = v; W.Screens.progress.render(root); }),
      bars
    ]);
  }

  function heatmap(st) {
    var weeks = 15, map = st.doneByDay(), td = U.today(), ws = st.settings.weekStart;
    var offset = (U.weekday(td) - ws + 7) % 7;
    var start = U.addDays(td, -(weeks - 1) * 7 - offset);
    var g = U.el('div.heat');
    var max = 1;
    Object.keys(map).forEach(function (k) { if (map[k] > max) max = map[k]; });
    for (var w = 0; w < weeks; w++) {
      var col = U.el('div.heat-col');
      for (var d = 0; d < 7; d++) {
        var ds = U.addDays(start, w * 7 + d);
        var n = map[ds] || 0, lvl = ds > td ? -1 : n === 0 ? 0 : Math.min(4, Math.ceil(n / max * 4));
        col.appendChild(U.el('i.l' + (lvl < 0 ? 'x' : lvl) + (ds === td ? '.today' : ''), { attrs: { title: U.fmtShort(ds) + ': ' + n } }));
      }
      g.appendChild(col);
    }
    var activeDays = Object.keys(map).filter(function (k) { return k >= start; }).length;
    return U.el('div.card', [
      U.el('div.card-title', [U.icon('grid'), 'Constancia', U.el('span.card-title-right', { text: U.plural(activeDays, 'día activo', 'días activos') })]),
      g,
      U.el('div.heat-legend', [U.el('span', { text: 'Menos' }), U.el('i.l0'), U.el('i.l1'), U.el('i.l2'), U.el('i.l3'), U.el('i.l4'), U.el('span', { text: 'Más' })])
    ]);
  }

  function byList(st) {
    var rows = st.lists.map(function (l) {
      var all = st.tasks.filter(function (t) { return t.listId === l.id; });
      var done = all.filter(function (t) { return t.done; }).length;
      return { l: l, all: all.length, done: done };
    }).filter(function (r) { return r.all; });
    if (!rows.length) return null;
    return U.el('div.card', [
      U.el('div.card-title', [U.icon('layers'), 'Por listas']),
      U.el('div.list-bars', rows.map(function (r) {
        var pct = Math.round(r.done / r.all * 100), c = st.ACCENTS[r.l.color];
        var bar = U.el('div.bar', [U.el('i', { style: { background: 'linear-gradient(90deg,' + c.a + ',' + c.b + ')', boxShadow: '0 0 12px ' + c.a } })]);
        setTimeout(function () { bar.firstChild.style.width = pct + '%'; }, 80);
        return U.el('div.list-bar', [U.el('div.list-bar-top', [U.el('span', [U.el('span.dot', { style: { '--c': c.a } }), r.l.name]), U.el('b', { text: r.done + '/' + r.all })]), bar]);
      }))
    ]);
  }

  function achievements(st) {
    var list = st.achievements(), got = list.filter(function (a) { return a.ok; }).length;
    return U.el('div', [
      U.el('div.section-head', [U.el('h2', { text: 'Logros' }), U.el('span.sub', { text: got + ' de ' + list.length })]),
      U.el('div.badges', list.map(function (a) {
        return U.el('div.badge' + (a.ok ? '.ok' : ''), { attrs: { title: a.desc } }, [
          U.el('span.badge-ic', [U.icon(a.ok ? a.icon : 'lock')]),
          U.el('strong', { text: a.title }), U.el('small', { text: a.desc })
        ]);
      }))
    ]);
  }

  W.Screens.progress = {
    title: 'Progreso',
    editName: editName,
    render: function (root, fresh) {
      var st = S(), s = st.stats(), name = st.displayName() || 'Tu perfil';
      var since = new Date(st.meta.createdAt || Date.now());
      var inner = U.el('div.inner' + (fresh ? '.stagger' : ''));

      var lvlBar = U.el('div.bar', [U.el('i')]);
      setTimeout(function () { lvlBar.firstChild.style.width = Math.round(s.levelProgress * 100) + '%'; }, 80);
      inner.appendChild(U.el('div.card.glow.profile-card', [
        U.el('div.profile-top', [
          U.el('div.avatar-xl', [U.el('span', { text: (st.displayName() || 'W').charAt(0).toUpperCase() })]),
          U.el('div.profile-id', [
            U.el('span.eyebrow', { text: 'Nivel ' + s.level + ' · ' + st.levelTitle(s.level) }),
            U.el('h2', { text: name }),
            U.el('p', { text: 'En WHIDER desde ' + U.MONTHS[since.getMonth()] + ' de ' + since.getFullYear() })
          ]),
          U.el('button.icon-btn', { attrs: { 'aria-label': 'Editar nombre' }, on: { click: editName } }, [U.icon('edit', 'sm')])
        ]),
        U.el('div.level', [U.el('div.level-row', [U.el('span', { text: s.xp + ' XP' }), U.el('span', { text: 'Siguiente nivel: ' + s.nextXp + ' XP' })]), lvlBar])
      ]));

      var stat = function (icon, v, label, suffix) {
        var n = U.el('span.stat-v.num', { text: '0', attrs: { 'data-val': 0 } });
        setTimeout(function () { W.Fx.countUp(n, v, { suffix: suffix || '' }); }, 100);
        return U.el('div.card.stat', [U.el('span.stat-ic', [U.icon(icon, 'sm')]), n, U.el('span.stat-l', { text: label })]);
      };
      inner.appendChild(U.el('div.stat-grid', [
        stat('check', s.done, 'Completadas'),
        stat('flame', s.streak, 'Racha actual (días)'),
        stat('crown', s.bestStreak, 'Mejor racha'),
        stat('target', s.rate, 'Cumplimiento', '%'),
        stat('timer', s.focusMin, 'Minutos de enfoque'),
        stat('alert', s.overdue, 'Vencidas ahora')
      ]));
      inner.appendChild(chart(st, root));
      inner.appendChild(heatmap(st));
      var bl = byList(st);
      if (bl) inner.appendChild(bl);
      inner.appendChild(achievements(st));
      U.clear(root).appendChild(inner);
    }
  };
})(window.Whider);
