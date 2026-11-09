/**
 * WHIDER · Perfil: tu cuenta (foto o personaje, nombre, correo y plan) y tu actividad
 * (cifras, gráfico, constancia y categorías) y tus marcas personales.
 * Las secciones de la app no se repiten aquí: están en la barra lateral (ordenador) y en Más (móvil).
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

  /** Tu foto de perfil: el personaje (o tu foto), con acceso a personalizarlo */
  function avatarCard() {
    var c = W.Character.config(), mode = W.Avatar ? W.Avatar.mode() : 'buddy';
    var sub = mode === 'photo' ? 'Usas tu foto como imagen de perfil' : mode === 'initial' ? 'Usas tu inicial como imagen de perfil' : (c.name || 'Tu personaje') + ' es tu imagen de perfil';
    return W.UI.section({ items: [W.UI.cell({ icon: 'palette', title: 'Personaje e imagen de perfil', sub: sub, onTap: function () { W.Character.edit(); } })] });
  }

  /** Cuenta: lo que es de tu cuenta, no de las secciones de la app */
  function accountLinks() {
    var desk = W.Layout.desktop, P = W.Plan;
    return W.UI.section({ items: [
      W.UI.cell({ icon: desk ? 'monitor' : 'phone', title: 'Mis dispositivos', sub: desk ? 'Enfoque compartido con tu móvil' : 'Gestiona el ordenador desde aquí', value: P.isPremium() ? '' : 'Premium', onTap: function () { W.Devices.sheet(); } }),
      W.UI.cell({ icon: 'gem', title: 'Plan', value: P.label(), onTap: function () { P.open(); } }),
      W.UI.cell({ icon: 'gear', title: 'Ajustes', sub: 'Apariencia, avisos, cuenta y datos', onTap: function () { W.Settings.open(); } })
    ] });
  }

  W.Screens.progress = {
    title: 'Perfil',
    back: function () { W.Router.back(); return true; },
    render: function (root) {
      var st = S(), tab = st.ui.profileTab === 'records' ? 'records' : 'summary';
      var head = W.UI.header({ title: 'Perfil', back: { label: 'Atrás', onTap: function () { W.Router.back(); } },
        actions: tab === 'records' ? [{ icon: 'plus', label: 'Nueva marca', onTap: function () { W.RecordsView.newMark(); } }] : [] });
      var host = U.el('div');
      var draw = function () { if (tab === 'records') W.RecordsView.render(host); else activity(st, host, draw); };
      var seg = W.UI.segmented([{ value: 'summary', label: 'Actividad' }, { value: 'records', label: 'Marcas' }],
        tab, function (v) { st.ui.profileTab = v; W.Screens.progress.render(root); });
      seg.style.marginTop = '16px';
      var account = U.el('div.profile-account', [avatarCard(), accountLinks()]);
      var top = W.Layout.desktop ? U.el('div.profile-top', [profileCard(st), account]) : U.el('div', [profileCard(st), account]);
      W.UI.mount(root, head, [top, seg, host]);
      draw();
    }
  };
})(window.Whider);
