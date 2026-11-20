/**
 * WHIDER · Estadísticas
 *  - Móvil (resumidas): cifras del periodo, completadas por día y por categoría.
 *  - Ordenador: además, horas, prioridades, enfoque, hábitos, el año entero y conclusiones,
 *    con hasta un año de historia.
 * Un único filtro de periodo arriba manda sobre todo lo de abajo.
 */
window.Whider = window.Whider || {};
window.Whider.Screens = window.Whider.Screens || {};

(function (W) {
  'use strict';
  var U = W.U, S = function () { return W.State; }, C = function () { return W.Charts; };
  var RANGES = [{ value: 7, label: W.t('7 días') }, { value: 30, label: W.t('30 días') }, { value: 90, label: W.t('90 días') }, { value: 365, label: W.t('12 meses') }];

  var TASKS = [W.t('tarea'), W.t('tareas')];
  function rangeText(from, to) { return U.fmtSpan(from, to); }
  function xLabel(by, key) {
    var d = U.parse(by === 'month' ? key + '-01' : key);
    if (by === 'month') return U.MONTHS_SHORT[d.getMonth()];
    if (by === 'week') return U.fmtDayMon(U.ymd(d));
    return String(d.getDate());
  }
  function nameOf(by, key) {
    var d = U.parse(by === 'month' ? key + '-01' : key);
    if (by === 'month') return U.cap(U.MONTHS[d.getMonth()]) + ' ' + d.getFullYear();
    if (by === 'week') return W.t('Semana del {date}', { date: U.fmtDayMonth(U.ymd(d)) });
    return U.fmtLong(key);
  }

  function build(range, desk) {
    var st = S(), Ch = C(), td = U.today();
    var from = U.addDays(td, -(range - 1)), c = W.Stats.compare(from, td), cur = c.cur, prev = c.prev;
    var by = range <= 31 ? 'day' : range <= 120 ? 'week' : 'month';
    var buckets = W.Stats.bucket(cur.days, 'done', by);
    var curKey = buckets.length ? buckets[buckets.length - 1].key : null;
    var out = [];

    /* Cifras */
    var spark = W.Stats.bucket(cur.days, 'done', range <= 7 ? 'day' : range <= 31 ? 'day' : 'week').map(function (b) { return b.value; });
    var tiles = [
      Ch.tile({ label: W.t('Tareas completadas'), value: Ch.fmt(cur.done), delta: prev.done || cur.done ? W.Stats.delta(cur.done, prev.done) : null, spark: spark, sub: W.t('Sin datos del periodo anterior') }),
      Ch.tile({ label: W.t('Media al día'), value: Ch.fmt(cur.avg), delta: prev.avg ? W.Stats.delta(cur.avg, prev.avg) : null, sub: W.tn(cur.activeDays, '{n} día con actividad', '{n} días con actividad') }),
      Ch.tile({ label: W.t('A tiempo'), value: cur.onTime == null ? '—' : cur.onTime + ' %', delta: cur.onTime != null && prev.onTime != null ? cur.onTime - prev.onTime : null, vs: 'puntos', sub: cur.withDeadline ? W.t('De {n} con fecha', { n: cur.withDeadline }) : W.t('Sin tareas con fecha') }),
      Ch.tile({ label: W.t('Enfoque'), value: Ch.fmtMin(cur.focus), delta: prev.focus || cur.focus ? W.Stats.delta(cur.focus, prev.focus) : null, sub: U.plural(cur.sessions, 'sesión', 'sesiones') })
    ];
    if (cur.habitRate != null) tiles.push(Ch.tile({ label: W.t('Hábitos cumplidos'), value: cur.habitRate + ' %', delta: prev.habitRate != null ? cur.habitRate - prev.habitRate : null, vs: 'puntos', sub: U.plural(cur.habits.length, 'hábito', 'hábitos') }));
    out.push(U.el('div.st-tiles', tiles));

    var grid = U.el('div.ch-grid');
    out.push(grid);
    /* Completadas en el tiempo */
    var colData = buckets.map(function (b) { return { x: xLabel(by, b.key), name: nameOf(by, b.key), value: b.value, emph: b.key === curKey, future: b.future }; });
    grid.appendChild(Ch.card({ title: W.t('Tareas completadas'), sub: by === 'day' ? W.t('Por día') : by === 'week' ? W.t('Por semana') : W.t('Por mes'), wide: true,
      chart: Ch.columns(colData, { height: desk ? 190 : 150, unit: TASKS, every: by === 'day' && range > 10 ? 5 : 0, avg: true, title: W.t('Tareas completadas') }),
      table: function () { return Ch.table([by === 'day' ? W.t('Día') : by === 'week' ? W.t('Semana') : W.t('Mes'), W.t('Completadas'), W.t('Creadas')], W.Stats.bucket(cur.days, 'done', by).map(function (b, i) { return [nameOf(by, b.key), b.value, W.Stats.bucket(cur.days, 'created', by)[i].value]; })); } }));

    /* Por categoría */
    var lists = Object.keys(cur.byList).sort(function (a, b) { return cur.byList[b] - cur.byList[a]; }).map(function (k) {
      var l = st.getList(k); return { label: l ? l.name : W.t('Sin categoría'), icon: l ? W.Lists.icon(l) : 'tray', value: cur.byList[k] };
    });
    grid.appendChild(Ch.card({ title: W.t('Por categoría'), sub: W.t('Tareas completadas en el periodo'),
      chart: lists.length ? Ch.hbars(lists, { unit: TASKS, title: W.t('Por categoría') }) : U.el('p.ch-none', { text: W.t('Aún no hay tareas completadas en este periodo.') }),
      table: function () { return Ch.table([W.t('Categoría'), W.t('Completadas')], lists.map(function (x) { return [x.label, x.value]; })); } }));

    /* Días de la semana */
    var ws = st.settings.weekStart, order = [0, 1, 2, 3, 4, 5, 6].map(function (i) { return (i + ws) % 7; });
    var wmax = Math.max.apply(null, cur.byWeekday);
    var wdData = order.map(function (d) { return { x: U.WEEKDAYS_LETTER[d], name: U.cap(U.WEEKDAYS[d]), value: cur.byWeekday[d], emph: wmax > 0 && cur.byWeekday[d] === wmax }; });
    grid.appendChild(Ch.card({ title: W.t('Por día de la semana'), sub: wmax ? W.t('Tu mejor día: {day}', { day: U.WEEKDAYS[cur.byWeekday.indexOf(wmax)] }) : W.t('Completa tareas para ver tu ritmo'),
      chart: Ch.columns(wdData, { height: 150, unit: TASKS, title: W.t('Por día de la semana') }),
      table: function () { return Ch.table([W.t('Día'), W.t('Completadas')], wdData.map(function (d) { return [d.name, d.value]; })); } }));

    if (!desk) return out;

    /* Ordenador: apartados detallados */
    var hmax = Math.max.apply(null, cur.byHour);
    var hData = cur.byHour.map(function (v, h) { return { x: h % 3 === 0 ? String(h) : '', name: h + ':00 – ' + (h + 1) + ':00', value: v, emph: hmax > 0 && v === hmax }; });
    grid.appendChild(Ch.card({ title: W.t('Por hora del día'), sub: hmax ? W.t('Tu mejor hora: {time}', { time: cur.byHour.indexOf(hmax) + ':00' }) : W.t('Según la hora a la que completas'),
      chart: Ch.columns(hData, { height: 150, unit: TASKS, title: W.t('Por hora del día') }),
      table: function () { return Ch.table([W.t('Hora'), W.t('Completadas')], hData.map(function (d) { return [d.name, d.value]; })); } }));
    var prios = [['danger', W.t('Urgente')], ['purple', W.t('Importante')], ['star', W.t('Destacada')], ['none', W.t('Normal')]].map(function (p) { return { label: p[1], prio: p[0] === 'none' ? null : p[0], value: cur.byPrio[p[0]] || 0 }; });
    grid.appendChild(Ch.card({ title: W.t('Por prioridad'), sub: W.t('Qué tipo de tareas terminas'),
      chart: Ch.hbars(prios, { unit: TASKS, title: W.t('Por prioridad') }),
      table: function () { return Ch.table([W.t('Prioridad'), W.t('Completadas')], prios.map(function (x) { return [x.label, x.value]; })); } }));
    var fb = W.Stats.bucket(cur.days, 'focus', by);
    var fData = fb.map(function (b) { return { x: xLabel(by, b.key), name: nameOf(by, b.key), value: b.value }; });
    grid.appendChild(Ch.card({ title: W.t('Minutos de enfoque'), sub: cur.focus ? W.t('{time} en {sessions}', { time: Ch.fmtMin(cur.focus), sessions: U.plural(cur.sessions, 'sesión', 'sesiones') }) : W.t('Aún sin sesiones en este periodo'), wide: true,
      chart: Ch.area(fData, { height: 160, every: fData.length > 12 ? Math.ceil(fData.length / 10) : 0, fmt: function (v) { return Ch.fmtMin(v); }, title: W.t('Minutos de enfoque') }),
      table: function () { return Ch.table([W.t('Periodo'), W.t('Minutos')], fData.map(function (d) { return [d.name, d.value]; })); } }));
    if (cur.habits.length) {
      grid.appendChild(Ch.card({ title: W.t('Hábitos'), sub: W.t('Porcentaje cumplido en el periodo'),
        chart: Ch.hbars(cur.habits.slice().sort(function (a, b) { return b.rate - a.rate; }).map(function (x) { return { label: x.habit.name, icon: x.habit.icon, value: x.rate, sub: x.rate + ' %' }; }), { unit: ['%', '%'], title: W.t('Hábitos') }),
        table: function () { return Ch.table([W.t('Hábito'), W.t('Cumplido')], cur.habits.map(function (x) { return [x.habit.name, x.rate + ' %']; })); } }));
    }
    var ins = W.Stats.insights(c);
    grid.appendChild(U.el('div.group.card.ch-card.insights', [U.el('div.ch-head', [U.el('div', [U.el('strong', { text: W.t('Conclusiones') }), U.el('small', { text: W.t('Lo más destacado del periodo') })])]),
      ins.length ? U.el('ul.ins-list', ins.map(function (x) { return U.el('li', [U.el('span.ins-ic', [U.icon(x.icon, 'sm')]), U.el('span', { text: x.text })]); })) : U.el('p.ch-none', { text: W.t('Completa algunas tareas y aquí verás tus conclusiones.') })]));
    var map = st.doneByDay();
    grid.appendChild(Ch.card({ title: W.t('Constancia del año'), sub: W.tn(Object.keys(map).filter(function (k) { return k >= U.addDays(td, -364); }).length, '{n} día con tareas completadas en los últimos 12 meses', '{n} días con tareas completadas en los últimos 12 meses'), wide: true,
      chart: Ch.year(map, { title: W.t('Constancia del año') }),
      table: function () { return Ch.table([W.t('Día'), W.t('Completadas')], Object.keys(map).filter(function (k) { return k >= U.addDays(td, -364); }).sort().reverse().map(function (k) { return [U.fmtLong(k), map[k]]; })); } }));
    return out;
  }

  W.Screens.stats = {
    title: W.t('Estadísticas'),
    back: function () { if (W.Layout.desktop) return false; W.Router.back(); return true; },
    render: function (root) {
      var st = S(), desk = W.Layout.desktop;
      var range = st.ui.statsRange || (desk ? 30 : 7);
      if (!desk && range > 30) range = 30;
      var td = U.today(), from = U.addDays(td, -(range - 1));
      var head = W.UI.header({ title: W.t('Estadísticas'), back: desk ? null : { label: W.t('Atrás'), onTap: function () { W.Router.back(); } }, sub: rangeText(from, td),
        actions: [{ icon: 'print', label: W.t('Informe'), text: desk ? W.t('Informe') : null, onTap: function () { W.Router.go('reports'); } }] });
      var opts = (desk ? RANGES : RANGES.slice(0, 2)).map(function (r) { return { value: r.value, label: r.label }; });
      var seg = W.UI.segmented(opts, range, function (v) { st.ui.statsRange = v; W.Router.refresh(); }, { mini: true });
      var content = [U.el('div.st-filters', [seg])].concat(build(range, desk));
      if (!desk) content.push(U.el('p.hint', { text: W.t('En el ordenador verás también horas, prioridades, enfoque, hábitos y tu año entero.') }));
      W.UI.mount(root, head, content);
    }
  };
})(window.Whider);
