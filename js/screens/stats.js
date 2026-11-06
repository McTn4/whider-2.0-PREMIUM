/**
 * WHIDER · Estadísticas
 *  - Móvil (resumidas): cifras del periodo, completadas por día y por categoría.
 *  - Ordenador: además, días de la semana, horas, prioridades, enfoque, hábitos, el año entero
 *    y conclusiones. Con Premium, hasta un año de historia y todos los apartados.
 * Un único filtro de periodo arriba manda sobre todo lo de abajo.
 */
window.Whider = window.Whider || {};
window.Whider.Screens = window.Whider.Screens || {};

(function (W) {
  'use strict';
  var U = W.U, S = function () { return W.State; }, C = function () { return W.Charts; };
  var RANGES = [{ value: 7, label: '7 días' }, { value: 30, label: '30 días' }, { value: 90, label: '90 días' }, { value: 365, label: '12 meses' }];

  function rangeText(from, to) {
    var a = U.parse(from), b = U.parse(to);
    return 'Del ' + a.getDate() + ' de ' + U.MONTHS[a.getMonth()] + (a.getFullYear() !== b.getFullYear() ? ' de ' + a.getFullYear() : '') + ' al ' + b.getDate() + ' de ' + U.MONTHS[b.getMonth()] + ' de ' + b.getFullYear();
  }
  function xLabel(by, key) {
    var d = U.parse(by === 'month' ? key + '-01' : key);
    if (by === 'month') return U.MONTHS[d.getMonth()].slice(0, 3);
    if (by === 'week') return d.getDate() + ' ' + U.MONTHS[d.getMonth()].slice(0, 3);
    return String(d.getDate());
  }
  function nameOf(by, key) {
    var d = U.parse(by === 'month' ? key + '-01' : key);
    if (by === 'month') return U.cap(U.MONTHS[d.getMonth()]) + ' ' + d.getFullYear();
    if (by === 'week') return 'Semana del ' + d.getDate() + ' de ' + U.MONTHS[d.getMonth()];
    return U.fmtLong(key);
  }

  function build(range, desk) {
    var st = S(), P = W.Plan, Ch = C(), td = U.today();
    var from = U.addDays(td, -(range - 1)), c = W.Stats.compare(from, td), cur = c.cur, prev = c.prev;
    var by = range <= 31 ? 'day' : range <= 120 ? 'week' : 'month';
    var buckets = W.Stats.bucket(cur.days, 'done', by);
    var curKey = buckets.length ? buckets[buckets.length - 1].key : null;
    var out = [];

    /* Cifras */
    var spark = W.Stats.bucket(cur.days, 'done', range <= 7 ? 'day' : range <= 31 ? 'day' : 'week').map(function (b) { return b.value; });
    var tiles = [
      Ch.tile({ label: 'Tareas completadas', value: Ch.fmt(cur.done), delta: prev.done || cur.done ? W.Stats.delta(cur.done, prev.done) : null, spark: spark, sub: 'Sin datos del periodo anterior' }),
      Ch.tile({ label: 'Media al día', value: Ch.fmt(cur.avg), delta: prev.avg ? W.Stats.delta(cur.avg, prev.avg) : null, sub: cur.activeDays + ' días con actividad' }),
      Ch.tile({ label: 'A tiempo', value: cur.onTime == null ? '—' : cur.onTime + ' %', delta: cur.onTime != null && prev.onTime != null ? cur.onTime - prev.onTime : null, vs: 'puntos', sub: cur.withDeadline ? 'De ' + cur.withDeadline + ' con fecha' : 'Sin tareas con fecha' }),
      Ch.tile({ label: 'Enfoque', value: Ch.fmtMin(cur.focus), delta: prev.focus || cur.focus ? W.Stats.delta(cur.focus, prev.focus) : null, sub: U.plural(cur.sessions, 'sesión', 'sesiones') })
    ];
    if (cur.habitRate != null) tiles.push(Ch.tile({ label: 'Hábitos cumplidos', value: cur.habitRate + ' %', delta: prev.habitRate != null ? cur.habitRate - prev.habitRate : null, vs: 'puntos', sub: U.plural(cur.habits.length, 'hábito', 'hábitos') }));
    out.push(U.el('div.st-tiles', tiles));

    var grid = U.el('div.ch-grid');
    out.push(grid);
    /* Completadas en el tiempo */
    var colData = buckets.map(function (b) { return { x: xLabel(by, b.key), name: nameOf(by, b.key), value: b.value, emph: b.key === curKey, future: b.future }; });
    grid.appendChild(Ch.card({ title: 'Tareas completadas', sub: by === 'day' ? 'Por día' : by === 'week' ? 'Por semana' : 'Por mes', wide: true,
      chart: Ch.columns(colData, { height: desk ? 190 : 150, unit: ['tarea', 'tareas'], every: by === 'day' && range > 10 ? 5 : 0, avg: true, title: 'Tareas completadas' }),
      table: function () { return Ch.table([by === 'day' ? 'Día' : by === 'week' ? 'Semana' : 'Mes', 'Completadas', 'Creadas'], W.Stats.bucket(cur.days, 'done', by).map(function (b, i) { return [nameOf(by, b.key), b.value, W.Stats.bucket(cur.days, 'created', by)[i].value]; })); } }));

    /* Por categoría */
    var lists = Object.keys(cur.byList).sort(function (a, b) { return cur.byList[b] - cur.byList[a]; }).map(function (k) {
      var l = st.getList(k); return { label: l ? l.name : 'Sin categoría', icon: l ? W.Lists.icon(l) : 'tray', value: cur.byList[k] };
    });
    grid.appendChild(Ch.card({ title: 'Por categoría', sub: 'Tareas completadas en el periodo',
      chart: lists.length ? Ch.hbars(lists, { unit: ['tarea', 'tareas'], title: 'Por categoría' }) : U.el('p.ch-none', { text: 'Aún no hay tareas completadas en este periodo.' }),
      table: function () { return Ch.table(['Categoría', 'Completadas'], lists.map(function (x) { return [x.label, x.value]; })); } }));

    /* Días de la semana */
    var ws = st.settings.weekStart, order = [0, 1, 2, 3, 4, 5, 6].map(function (i) { return (i + ws) % 7; });
    var wmax = Math.max.apply(null, cur.byWeekday);
    var wdData = order.map(function (d) { return { x: U.WEEKDAYS_LETTER[d], name: U.cap(U.WEEKDAYS[d]), value: cur.byWeekday[d], emph: wmax > 0 && cur.byWeekday[d] === wmax }; });
    grid.appendChild(Ch.card({ title: 'Por día de la semana', sub: wmax ? 'Tu mejor día: ' + U.WEEKDAYS[cur.byWeekday.indexOf(wmax)] : 'Completa tareas para ver tu ritmo',
      chart: Ch.columns(wdData, { height: 150, unit: ['tarea', 'tareas'], title: 'Por día de la semana' }),
      table: function () { return Ch.table(['Día', 'Completadas'], wdData.map(function (d) { return [d.name, d.value]; })); } }));

    if (!desk) return out;

    /* Ordenador: apartados avanzados (Premium) */
    if (!P.isPremium()) {
      grid.appendChild(Ch.locked('Por hora del día', 'Descubre a qué horas rindes más', 'stats'));
      grid.appendChild(Ch.locked('Enfoque, hábitos y prioridades', 'Todo tu año de un vistazo, con conclusiones', 'stats'));
      return out;
    }
    var hmax = Math.max.apply(null, cur.byHour);
    var hData = cur.byHour.map(function (v, h) { return { x: h % 3 === 0 ? String(h) : '', name: h + ':00 – ' + (h + 1) + ':00', value: v, emph: hmax > 0 && v === hmax }; });
    grid.appendChild(Ch.card({ title: 'Por hora del día', sub: hmax ? 'Tu mejor hora: ' + cur.byHour.indexOf(hmax) + ':00' : 'Según la hora a la que completas',
      chart: Ch.columns(hData, { height: 150, unit: ['tarea', 'tareas'], title: 'Por hora del día' }),
      table: function () { return Ch.table(['Hora', 'Completadas'], hData.map(function (d) { return [d.name, d.value]; })); } }));
    var prios = [['danger', 'Urgente'], ['purple', 'Importante'], ['star', 'Destacada'], ['none', 'Normal']].map(function (p) { return { label: p[1], prio: p[0] === 'none' ? null : p[0], value: cur.byPrio[p[0]] || 0 }; });
    grid.appendChild(Ch.card({ title: 'Por prioridad', sub: 'Qué tipo de tareas terminas',
      chart: Ch.hbars(prios, { unit: ['tarea', 'tareas'], title: 'Por prioridad' }),
      table: function () { return Ch.table(['Prioridad', 'Completadas'], prios.map(function (x) { return [x.label, x.value]; })); } }));
    var fb = W.Stats.bucket(cur.days, 'focus', by);
    var fData = fb.map(function (b) { return { x: xLabel(by, b.key), name: nameOf(by, b.key), value: b.value }; });
    grid.appendChild(Ch.card({ title: 'Minutos de enfoque', sub: cur.focus ? Ch.fmtMin(cur.focus) + ' en ' + U.plural(cur.sessions, 'sesión', 'sesiones') : 'Aún sin sesiones en este periodo', wide: true,
      chart: Ch.area(fData, { height: 160, every: fData.length > 12 ? Math.ceil(fData.length / 10) : 0, fmt: function (v) { return Ch.fmtMin(v); }, title: 'Minutos de enfoque' }),
      table: function () { return Ch.table(['Periodo', 'Minutos'], fData.map(function (d) { return [d.name, d.value]; })); } }));
    if (cur.habits.length) {
      grid.appendChild(Ch.card({ title: 'Hábitos', sub: 'Porcentaje cumplido en el periodo',
        chart: Ch.hbars(cur.habits.slice().sort(function (a, b) { return b.rate - a.rate; }).map(function (x) { return { label: x.habit.name, icon: x.habit.icon, value: x.rate, sub: x.rate + ' %' }; }), { unit: ['%', '%'], title: 'Hábitos' }),
        table: function () { return Ch.table(['Hábito', 'Cumplido'], cur.habits.map(function (x) { return [x.habit.name, x.rate + ' %']; })); } }));
    }
    var ins = W.Stats.insights(c);
    grid.appendChild(U.el('div.group.card.ch-card.insights', [U.el('div.ch-head', [U.el('div', [U.el('strong', { text: 'Conclusiones' }), U.el('small', { text: 'Lo más destacado del periodo' })])]),
      ins.length ? U.el('ul.ins-list', ins.map(function (x) { return U.el('li', [U.el('span.ins-ic', [U.icon(x.icon, 'sm')]), U.el('span', { text: x.text })]); })) : U.el('p.ch-none', { text: 'Completa algunas tareas y aquí verás tus conclusiones.' })]));
    var map = st.doneByDay();
    grid.appendChild(Ch.card({ title: 'Constancia del año', sub: Object.keys(map).filter(function (k) { return k >= U.addDays(td, -364); }).length + ' días con tareas completadas en los últimos 12 meses', wide: true,
      chart: Ch.year(map, { title: 'Constancia del año' }),
      table: function () { return Ch.table(['Día', 'Completadas'], Object.keys(map).filter(function (k) { return k >= U.addDays(td, -364); }).sort().reverse().map(function (k) { return [U.fmtLong(k), map[k]]; })); } }));
    return out;
  }

  W.Screens.stats = {
    title: 'Estadísticas',
    back: function () { if (W.Layout.desktop) return false; W.Router.back(); return true; },
    render: function (root) {
      var st = S(), desk = W.Layout.desktop, P = W.Plan;
      var range = st.ui.statsRange || (desk ? 30 : 7);
      if (!P.isPremium() && range > 30) range = 30;
      if (!desk && range > 30) range = 30;
      var td = U.today(), from = U.addDays(td, -(range - 1));
      var head = W.UI.header({ title: 'Estadísticas', back: desk ? null : { label: 'Atrás', onTap: function () { W.Router.back(); } }, sub: rangeText(from, td),
        actions: [{ icon: 'print', label: 'Informe', text: desk ? 'Informe' : null, onTap: function () { W.Router.go('reports'); } }] });
      var opts = (desk ? RANGES : RANGES.slice(0, 2)).map(function (r) { return { value: r.value, label: r.label }; });
      var seg = W.UI.segmented(opts, range, function (v) {
        if (v > 30 && !P.isPremium()) { P.paywall('stats'); W.Router.refresh(); return; }
        st.ui.statsRange = v; W.Router.refresh();
      }, { mini: true });
      var content = [U.el('div.st-filters', [seg])].concat(build(range, desk));
      if (!desk) content.push(U.el('p.hint', { text: 'En el ordenador verás también horas, prioridades, enfoque, hábitos y tu año entero.' }));
      W.UI.mount(root, head, content);
    }
  };
})(window.Whider);
