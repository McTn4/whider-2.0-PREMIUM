/**
 * WHIDER · Perfil y resumen: tu foto, nombre y plan; tu personaje con su nivel; actividad
 * (estadísticas, gráfico, constancia y categorías), marcas personales y logros por familias
 * con sus grados y recompensas. Accesos a Hábitos, Apuntes, Amigos, Sistemas, Planes y Ajustes.
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
      U.el('div.card-head', [U.el('strong', { text: 'Por categorías' })]),
      U.el('div.list-bars', rows.map(function (r) {
        return U.el('div', [U.el('div.list-bar-top', [U.el('span', { text: r.l.name }), U.el('b', { text: r.done + ' de ' + r.all })]),
          U.el('div.bar', [U.el('i', { style: { width: Math.round(r.done / r.all * 100) + '%' } })])]);
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
    // En el ordenador: cifras a lo ancho, la gráfica y el mapa de constancia lado a lado
    host.classList.toggle('activity-grid', W.Layout.desktop);
    nodes[0].classList.add('wide');
    if (nodes[3]) nodes[3].classList.add('wide');
    nodes.forEach(function (n) { if (n) { n.classList.add('sec'); host.appendChild(n); } });
    host.firstChild.classList.add('first');
  }

  function fmtN(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.'); }

  /** Logros: nivel y XP, de dónde sale la experiencia, familias con sus grados y lo último conseguido */
  function achievements(st, host) {
    var G = W.Game, g = G.get(), fams = G.families();
    var got = g.list.filter(function (a) { return a.ok; }).length;
    U.clear(host);
    host.classList.toggle('ach-grid', W.Layout.desktop);
    host.classList.remove('activity-grid');
    var next = null;
    for (var L = g.level + 1; L <= g.level + 12 && !next; L++) { var u = W.Character.unlocksAt(L); if (u.length) next = { level: L, items: u }; }
    var levelCard = U.el('div.group.card.lv-card', [
      U.el('div.lv-top', [U.el('span.lv-num', [U.el('small', { text: 'Nivel' }), U.el('b', { text: g.level })]),
        U.el('div.lv-main', [U.el('strong', { text: G.title(g.level) }),
          U.el('span', { text: fmtN(g.xp) + ' XP · faltan ' + fmtN(Math.max(0, g.to - g.xp)) + ' para el nivel ' + (g.level + 1) }),
          U.el('div.bar', [U.el('i', { style: { width: Math.round(g.progress * 100) + '%' } })])])]),
      next ? U.el('div.lv-next', [U.el('span', { text: 'Próxima recompensa · nivel ' + next.level }),
        U.el('div.lv-rewards', next.items.map(function (it) { return U.el('span.lv-reward', [U.el('span.cel-mini', [W.Character.svg({ size: 40, cfg: it.cfg })]), U.el('span', { text: it.name })]); }))]) : null
    ]);
    var parts = U.el('div.group.card.xp-card', [U.el('div.card-head', [U.el('strong', { text: 'De dónde sale tu experiencia' })]),
      U.el('div.xp-rows', g.parts.filter(function (p) { return p.xp > 0; }).map(function (p) {
        return U.el('div.xp-row', [U.el('span', { text: p.label }), U.el('b', { text: '+' + fmtN(p.xp) })]);
      }).concat(g.parts.some(function (p) { return p.xp > 0; }) ? [] : [U.el('p.muted', { text: 'Completa tareas, enfócate y cumple hábitos para ganar experiencia.' })]))]);
    var famGrid = U.el('div.fam-grid', fams.map(function (f) {
      var pips = U.el('span.fam-pips', []);
      for (var i = 0; i < f.tiers; i++) pips.appendChild(U.el('i' + (i <= f.tier ? '.on' : '')));
      return U.el('div.fam' + (f.tier >= 0 ? '.got' : ''), [
        U.el('div.fam-top', [U.el('span.fam-ic', [U.icon(f.tier >= 0 ? f.icon : 'lock')]),
          U.el('div.fam-t', [U.el('strong', { text: f.tier >= 0 ? f.name + ' · ' + G.ROMAN[f.tier] : f.title }), U.el('small', { text: f.cat })]), pips]),
        U.el('div.bar', [U.el('i', { style: { width: Math.round(f.progress * 100) + '%' } })]),
        U.el('small.fam-sub', { text: f.next ? fmtN(f.value) + ' de ' + fmtN(f.next.need) + ' ' + f.unit + ' · siguiente: ' + f.next.name : 'Completado: ' + fmtN(f.value) + ' ' + f.unit })
      ]);
    }));
    var recent = G.recent(5);
    host.appendChild(W.UI.section({ first: true, items: levelCard }));
    host.appendChild(W.UI.section({ title: 'Logros', side: U.el('small', { text: got + '/' + g.list.length }), items: famGrid }));
    host.appendChild(W.UI.section({ items: parts }));
    if (recent.length) host.appendChild(W.UI.section({ header: 'Lo último que has conseguido', items: recent.map(function (a) {
      return W.UI.cell({ icon: a.icon, title: a.title, sub: U.cap(a.desc), value: U.fmtDay(U.ymd(new Date(a.at))) });
    }) }));
  }

  /** Tarjeta de perfil: foto, nombre, cuenta y plan */
  function profileCard(st) {
    var u = W.Auth && W.Auth.user, name = st.displayName(), P = W.Plan;
    return U.el('div.profile-card', [
      U.el('button.photo-pick', { attrs: { 'aria-label': 'Editar nombre y foto' }, on: { click: function () { W.Profile.edit(); } } }, [W.Profile.avatar('lg'), U.el('span.cam', [U.icon('camera')])]),
      U.el('div.profile-id', [
        U.el('strong', { text: name || 'Tu perfil' }),
        U.el('span', { text: u && u.email ? u.email : (W.Auth && W.Auth.configured() ? 'Sin cuenta · datos solo en este dispositivo' : 'Datos guardados en este dispositivo') }),
        U.el('button.plan-pill', { attrs: { type: 'button', title: 'Planes y precios' }, on: { click: function () { P.open(); } } },
          P.isPremium() ? [U.el('span.premium-chip', [U.icon('gem'), 'Premium']), U.el('span', { text: P.isTrial() ? P.status() : '' })] : [U.el('span.premium-chip.ghost', { text: 'Gratis' }), U.el('span', { text: 'Mejorar a Premium' })])
      ])
    ]);
  }

  /** Tu personaje con su nivel (toca para hablar con él) */
  function buddyCard(st) {
    var g = W.Game.get(), c = W.Character.config();
    var bubble = U.el('div.buddy-bubble.static', [U.el('span', { text: W.Character.lines()[0].text })]);
    var b = W.Character.node({ size: 92, bubble: false });
    var i = 0;
    b.addEventListener('click', function () { var l = W.Character.lines(); U.clear(bubble); bubble.appendChild(U.el('span', { text: l[++i % l.length].text })); bubble.classList.remove('pop'); void bubble.offsetWidth; bubble.classList.add('pop'); });
    return U.el('div.group.card.buddy-card.profile-buddy', [
      U.el('div.buddy-row', [b, U.el('div.buddy-meta', [U.el('strong', { text: c.name || 'Tu personaje' }),
        U.el('span', { text: 'Nivel ' + g.level + ' · ' + W.Game.title(g.level) + ' · ' + fmtN(g.xp) + ' XP' }),
        U.el('div.bar', [U.el('i', { style: { width: Math.round(g.progress * 100) + '%' } })])]),
        W.Layout.desktop ? U.el('button.btn.sm.soft', { on: { click: function () { W.Character.edit(); } } }, [U.icon('palette', 'sm'), 'Personalizar'])
          : U.el('button.circle-btn', { attrs: { 'aria-label': 'Personalizar tu personaje' }, on: { click: function () { W.Character.edit(); } } }, [U.icon('palette')])]),
      bubble
    ]);
  }

  /** Accesos (en el móvil están aquí; en el ordenador, en la barra lateral) */
  function shortcuts(st) {
    var desk = W.Layout.desktop, P = W.Plan, items = [];
    if (!desk) {
      var hs = W.Habits.todaySummary();
      items.push(W.UI.cell({ icon: 'target', title: 'Hábitos', value: hs.total ? hs.done + ' de ' + hs.total + ' hoy' : '', onTap: function () { W.Router.go('habits'); } }));
      items.push(W.UI.cell({ icon: 'notebook', title: 'Apuntes', value: st.notes.length ? String(st.notes.length) : '', onTap: function () { W.Router.go('notes'); } }));
      items.push(W.UI.cell({ icon: 'users', title: 'Amigos', value: P.isPremium() ? String(st.friends().length || '') : 'Premium', onTap: function () { W.Router.go('friends'); } }));
      items.push(W.UI.cell({ icon: 'system', title: 'Sistemas y automatizaciones', onTap: function () { W.Router.go('automations'); } }));
      items.push(W.UI.cell({ icon: 'chart', title: 'Estadísticas e informe semanal', onTap: function () { W.Router.go('stats'); } }));
    }
    items.push(W.UI.cell({ icon: desk ? 'monitor' : 'phone', title: 'Mis dispositivos', sub: desk ? 'Enfoque compartido con tu móvil' : 'Gestiona el ordenador desde aquí', value: P.isPremium() ? '' : 'Premium', onTap: function () { W.Devices.sheet(); } }));
    items.push(W.UI.cell({ icon: 'gem', title: 'Planes y precios', value: P.label(), onTap: function () { P.open(); } }));
    items.push(W.UI.cell({ icon: 'gear', title: 'Ajustes', sub: desk ? null : 'Apariencia, sonidos, avisos, cuenta y datos', onTap: function () { W.Settings.open(); } }));
    return W.UI.section({ items: items });
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
      var links = shortcuts(st);
      links.style.marginTop = '14px';
      var top = W.Layout.desktop ? U.el('div.profile-top', [profileCard(st), buddyCard(st)]) : U.el('div', [profileCard(st), buddyCard(st)]);
      W.UI.mount(root, head, [top, links, seg, host]);
      draw();
    }
  };
})(window.Whider);
