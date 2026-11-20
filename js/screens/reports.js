/**
 * WHIDER · Informes
 *  - Ordenador: informe completo de un periodo con los apartados que elijas, listo para
 *    imprimir o guardar en PDF, y para exportar en CSV (hoja de cálculo), JSON o texto.
 *  - Móvil: el resumen de tu semana, para leerlo o compartirlo.
 */
window.Whider = window.Whider || {};
window.Whider.Screens = window.Whider.Screens || {};

(function (W) {
  'use strict';
  var U = W.U, S = function () { return W.State; };
  var PERIODS = [
    { value: 'week', label: W.t('Esta semana') }, { value: 'lastweek', label: W.t('Semana pasada') }, { value: 'month', label: W.t('Este mes') },
    { value: 'lastmonth', label: W.t('Mes pasado') }, { value: 'year', label: W.t('Este año') }, { value: 'custom', label: W.t('Personalizado') }
  ];
  var SECTIONS = [
    { id: 'summary', label: W.t('Resumen') }, { id: 'done', label: W.t('Completadas') }, { id: 'pending', label: W.t('Pendientes') }, { id: 'lists', label: W.t('Categorías') },
    { id: 'focus', label: W.t('Enfoque') }, { id: 'habits', label: W.t('Hábitos') }, { id: 'notes', label: W.t('Cuaderno') }
  ];
  var ui = { period: 'week', from: null, to: null, sections: { summary: true, done: true, pending: true, lists: true, focus: true, habits: true, notes: false } };

  function weekStart(ds) { var ws = S().settings.weekStart; return U.addDays(ds, -((U.weekday(ds) - ws + 7) % 7)); }
  function range(p) {
    var td = U.today(), d = U.parse(td);
    switch (p) {
      case 'lastweek': var lw = U.addDays(weekStart(td), -7); return [lw, U.addDays(lw, 6)];
      case 'month': return [U.ymd(new Date(d.getFullYear(), d.getMonth(), 1)), td];
      case 'lastmonth': return [U.ymd(new Date(d.getFullYear(), d.getMonth() - 1, 1)), U.ymd(new Date(d.getFullYear(), d.getMonth(), 0))];
      case 'year': return [d.getFullYear() + '-01-01', td];
      case 'custom': return [ui.from || U.addDays(td, -13), ui.to || td];
      default: return [weekStart(td), td];
    }
  }
  function longDate(ds) { return U.fmtDate(ds); }
  function periodText(a, b) { return a === b ? longDate(a) : W.t('Del {from} al {to}', { from: longDate(a), to: longDate(b) }); }

  /** Todo lo que va en el informe */
  function data(from, to) {
    var st = S(), c = W.Stats.compare(from, to), cur = c.cur;
    var startTs = U.parse(from).getTime(), endTs = U.parse(to).getTime() + 86400000;
    var done = cur.doneTasks.slice().sort(function (a, b) { return a.doneAt - b.doneAt; });
    var pending = st.tasks.filter(function (t) { return !t.done && t.date && t.date <= to; }).sort(st.compareDeadline);
    var lists = st.lists.map(function (l) {
      return { name: l.name, done: cur.byList[l.id] || 0, pending: st.tasks.filter(function (t) { return !t.done && t.listId === l.id; }).length };
    }).filter(function (x) { return x.done || x.pending; });
    var notes = (W.Pages ? W.Pages.all().filter(function (m) { return !W.Pages.isRow(m); }).map(function (m) { return { title: W.Pages.title(m), updatedAt: Math.max(m.at, m.cv) }; }) : st.notes)
      .filter(function (n) { return n.updatedAt >= startTs && n.updatedAt < endTs; }).sort(function (a, b) { return b.updatedAt - a.updatedAt; });
    return { from: from, to: to, c: c, cur: cur, prev: c.prev, done: done, pending: pending, lists: lists, notes: notes, name: st.displayName() };
  }

  /* ---------- Documento ---------- */
  function doc(d, sections) {
    var Ch = W.Charts, cur = d.cur, out = U.el('article.rp-doc');
    out.appendChild(U.el('header.rp-head', [
      U.el('div.rp-brand', [U.svg('svg', { viewBox: '0 0 64 64', 'aria-hidden': 'true' }, [U.svg('use', { href: '#logo' })]), U.el('span', { text: W.t('WHIDER') })]),
      U.el('h2', { text: W.t('Informe de actividad') }),
      U.el('p', { text: periodText(d.from, d.to) + (d.name ? ' · ' + d.name : '') }),
      U.el('small', { text: W.t('Generado el {date} a las {time}', { date: longDate(U.today()), time: U.fmtTime(U.nowHM()) }) })
    ]));
    var sec = function (title, body) { out.appendChild(U.el('section.rp-sec', [U.el('h3', { text: title })].concat(body))); };
    if (sections.summary) {
      var dl = W.Stats.delta(cur.done, d.prev.done);
      var kp = [[W.t('Completadas'), Ch.fmt(cur.done) + (dl != null && d.prev.done ? ' (' + (dl > 0 ? '+' : '') + dl + ' %)' : '')], [W.t('Creadas'), Ch.fmt(cur.created)], [W.t('Media al día'), Ch.fmt(cur.avg)],
        [W.t('A tiempo'), cur.onTime == null ? '—' : cur.onTime + ' %'], [W.t('Enfoque'), Ch.fmtMin(cur.focus)], [W.t('Hábitos'), cur.habitRate == null ? '—' : cur.habitRate + ' %'],
        [W.t('Días con actividad'), W.t('{done} de {total}', { done: cur.activeDays, total: cur.days.filter(function (r) { return !r.future; }).length })], [W.t('Mejor día'), cur.best.date ? U.fmtShort(cur.best.date) + ' (' + cur.best.done + ')' : '—']];
      sec(W.t('Resumen'), [U.el('div.rp-kpis', kp.map(function (k) { return U.el('div', [U.el('span', { text: k[0] }), U.el('strong', { text: k[1] })]); })),
        U.el('ul.rp-ins', W.Stats.insights(d.c).slice(0, 4).map(function (x) { return U.el('li', { text: x.text }); }))]);
    }
    if (sections.done) {
      var byDay = {}, order = [];
      d.done.forEach(function (t) { var k = U.ymd(new Date(t.doneAt)); if (!byDay[k]) { byDay[k] = []; order.push(k); } byDay[k].push(t); });
      sec(W.t('Tareas completadas ({n})', { n: d.done.length }), d.done.length ? order.map(function (k) {
        return U.el('div.rp-day', [U.el('h4', { text: U.cap(U.fmtLong(k)) }), U.el('ul', byDay[k].map(function (t) {
          var l = t.listId ? S().getList(t.listId) : null;
          return U.el('li', [U.el('span.rp-t', { text: U.fmtTime(U.pad(new Date(t.doneAt).getHours()) + ':' + U.pad(new Date(t.doneAt).getMinutes())) }), U.el('span', { text: t.text }), l ? U.el('em', { text: l.name }) : null]);
        }))]);
      }) : [U.el('p.rp-none', { text: W.t('Sin tareas completadas en este periodo.') })]);
    }
    if (sections.pending) {
      var late = d.pending.filter(function (t) { return S().isOverdue(t); });
      sec(W.t('Pendientes con fecha ({n})', { n: d.pending.length }), d.pending.length ? [U.el('ul.rp-list', d.pending.slice(0, 60).map(function (t) {
        return U.el('li', [U.el('span.rp-t', { text: U.fmtShort(t.date) + (t.time ? ' ' + U.fmtTime(t.time) : '') }), U.el('span', { text: t.text }), S().isOverdue(t) ? U.el('em', { text: W.t('vencida') }) : null]);
      })), late.length ? U.el('p.rp-note', { text: W.t('{n} en total.', { n: U.plural(late.length, 'tarea vencida', 'tareas vencidas') }) }) : null] : [U.el('p.rp-none', { text: W.t('Nada pendiente con fecha. ¡Al día!') })]);
    }
    if (sections.lists && d.lists.length) sec(W.t('Por categoría'), [Ch.table([W.t('Categoría'), W.t('Completadas'), W.t('Pendientes')], d.lists.map(function (x) { return [x.name, x.done, x.pending]; }))]);
    if (sections.focus) {
      var fd = cur.days.filter(function (r) { return r.focus > 0; });
      sec(W.t('Enfoque'), [U.el('p', { text: cur.focus ? W.t('{time} en {sessions}.', { time: Ch.fmtMin(cur.focus), sessions: U.plural(cur.sessions, 'sesión', 'sesiones') }) : W.t('Sin sesiones de enfoque en este periodo.') }),
        fd.length ? Ch.table([W.t('Día'), W.t('Minutos'), W.t('Sesiones')], fd.map(function (r) { return [U.fmtShort(r.date), r.focus, r.sessions]; })) : null]);
    }
    if (sections.habits && cur.habits.length) sec(W.t('Hábitos'), [Ch.table([W.t('Hábito'), W.t('Cumplido'), W.t('Racha actual')], cur.habits.map(function (x) { return [x.habit.name, x.rate + ' %', W.Habits.streak(x.habit)]; }))]);
    if (sections.notes) sec(W.t('Páginas editadas ({n})', { n: d.notes.length }), d.notes.length ? [U.el('ul.rp-list', d.notes.map(function (n) { return U.el('li', [U.el('span.rp-t', { text: U.fmtShort(U.ymd(new Date(n.updatedAt))) }), U.el('span', { text: W.Notes.title(n) })]); }))] : [U.el('p.rp-none', { text: W.t('Sin páginas editadas en este periodo.') })]);
    return out;
  }

  /* ---------- Exportar ---------- */
  function csvCell(v) { var s = v == null ? '' : String(v); return /[";\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }
  function toCsv(d) {
    var st = S(), rows = [[W.t('Estado'), W.t('Tarea'), W.t('Categoría'), W.t('Prioridad'), W.t('Fecha'), W.t('Hora'), W.t('Completada el'), W.t('Notas')]];
    d.done.forEach(function (t) { var l = st.getList(t.listId); rows.push([W.t('Completada'), t.text, l ? l.name : '', st.PRIORITIES[t.highlight].label, t.date || '', t.time || '', new Date(t.doneAt).toLocaleString(W.I18n.locale), t.notes || '']); });
    d.pending.forEach(function (t) { var l = st.getList(t.listId); rows.push([st.isOverdue(t) ? W.t('Vencida') : W.t('Pendiente'), t.text, l ? l.name : '', st.PRIORITIES[t.highlight].label, t.date || '', t.time || '', '', t.notes || '']); });
    return rows.map(function (r) { return r.map(csvCell).join(';'); }).join('\r\n');
  }
  function toJson(d) {
    var cur = d.cur;
    return JSON.stringify({ app: 'WHIDER', informe: { desde: d.from, hasta: d.to, generado: new Date().toISOString() },
      resumen: { completadas: cur.done, creadas: cur.created, mediaDiaria: Math.round(cur.avg * 100) / 100, aTiempo: cur.onTime, enfoqueMin: cur.focus, sesiones: cur.sessions, habitos: cur.habitRate },
      porDia: cur.days.map(function (r) { return { fecha: r.date, completadas: r.done, creadas: r.created, enfoqueMin: r.focus }; }),
      completadas: d.done.map(function (t) { return { tarea: t.text, categoria: (S().getList(t.listId) || {}).name || null, completada: new Date(t.doneAt).toISOString() }; }),
      pendientes: d.pending.map(function (t) { return { tarea: t.text, fecha: t.date, hora: t.time }; }),
      habitos: cur.habits.map(function (x) { return { habito: x.habit.name, cumplido: x.rate }; }) }, null, 2);
  }
  function toText(d) {
    var cur = d.cur, L = [W.t('WHIDER · Informe de actividad'), periodText(d.from, d.to), ''];
    L.push('· ' + W.t('Completadas: {n} (media de {avg} al día)', { n: cur.done, avg: W.Charts.fmt(cur.avg) }));
    if (cur.onTime != null) L.push('· ' + W.t('A tiempo: {pct} %', { pct: cur.onTime }));
    L.push('· ' + W.t('Enfoque: {time}', { time: W.Charts.fmtMin(cur.focus) }));
    if (cur.habitRate != null) L.push('· ' + W.t('Hábitos: {pct} % cumplidos', { pct: cur.habitRate }));
    W.Stats.insights(d.c).slice(0, 3).forEach(function (x) { L.push('· ' + x.text); });
    return L.join('\n');
  }
  function copy(text) {
    var done = function () { W.Toast.show({ text: W.t('Copiado: ya puedes pegarlo donde quieras'), icon: 'check' }); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, function () { fallback(); });
    else fallback();
    function fallback() { var ta = U.el('textarea', { style: { position: 'fixed', opacity: '0' } }); ta.value = text; document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); done(); } catch (e) { /* sin portapapeles */ } ta.remove(); }
  }
  function pdf(d) {
    var D = window.WhiderDesktop, name = 'whider-informe-' + d.from + (d.to !== d.from ? '_' + d.to : '');
    document.body.classList.add('printing-report');
    var end = function () { document.body.classList.remove('printing-report'); };
    if (D && D.printToPDF) {
      setTimeout(function () {
        D.printToPDF(name).then(function (r) {
          end();
          if (r && r.ok) W.Toast.show({ text: W.t('Informe guardado en PDF'), icon: 'download', action: D.showFile ? { label: W.t('Mostrar'), fn: function () { D.showFile(r.path); } } : null });
        }, end);
      }, 120);
    } else { setTimeout(function () { window.print(); end(); }, 60); }
  }

  /* ---------- Pantalla ---------- */
  var current = null;
  W.Screens.reports = {
    title: W.t('Informes'),
    back: function () { if (W.Layout.desktop) return false; W.Router.back(); return true; },
    /** Menú Archivo → Informe en PDF */
    pdf: function () { if (current) pdf(current); },
    render: function (root) {
      var desk = W.Layout.desktop;
      if (!desk && ui.period !== 'week' && ui.period !== 'lastweek') ui.period = 'week';
      var r = range(ui.period), d = data(r[0], r[1]);
      current = d;
      var head = W.UI.header({ title: desk ? W.t('Informes') : W.t('Tu semana'), back: desk ? null : { label: W.t('Atrás'), onTap: function () { W.Router.back(); } }, sub: periodText(r[0], r[1]) });
      var content = [];
      var opts = (desk ? PERIODS : PERIODS.slice(0, 2));
      var periodSeg = W.UI.segmented(opts.map(function (o) { return { value: o.value, label: o.label }; }), ui.period, function (v) { ui.period = v; W.Router.refresh(); }, { mini: true });
      var controls = [U.el('div.rp-row', [periodSeg])];
      if (desk && ui.period === 'custom') {
        var mk = function (val, set) { var i = U.el('input.input.rp-date', { attrs: { type: 'date', 'aria-label': W.t('Fecha') } }); i.value = val; i.addEventListener('change', function () { if (i.value) { set(i.value); W.Router.refresh(); } }); return i; };
        controls.push(U.el('div.rp-row', [U.el('span.muted', { text: W.t('Del') }), mk(r[0], function (v) { ui.from = v; }), U.el('span.muted', { text: 'al' }), mk(r[1], function (v) { ui.to = v; })]));
      }
      if (desk) {
        controls.push(U.el('div.chips.wrap.rp-secs', SECTIONS.map(function (s) {
          var c = U.el('button.chip' + (ui.sections[s.id] ? '.on' : ''), { attrs: { type: 'button', 'aria-pressed': ui.sections[s.id] ? 'true' : 'false' }, text: s.label });
          c.addEventListener('click', function () { ui.sections[s.id] = !ui.sections[s.id]; W.Router.refresh(); });
          return c;
        })));
        controls.push(U.el('div.rp-actions', [
          U.el('button.btn.primary.sm', { on: { click: function () { pdf(d); } } }, [U.icon('print', 'sm'), window.WhiderDesktop ? W.t('Guardar en PDF') : W.t('Imprimir o PDF')]),
          U.el('button.btn.ghost.sm', { on: { click: function () { U.saveFile('whider-informe-' + r[0] + '_' + r[1], toCsv(d), 'csv'); } } }, [U.icon('download', 'sm'), 'CSV']),
          U.el('button.btn.ghost.sm', { on: { click: function () { U.saveFile('whider-informe-' + r[0] + '_' + r[1], toJson(d), 'json'); } } }, [U.icon('download', 'sm'), 'JSON']),
          U.el('button.btn.ghost.sm', { on: { click: function () { copy(toText(d)); } } }, [U.icon('layers', 'sm'), W.t('Copiar resumen')])
        ]));
        content.push(U.el('div.rp-controls', controls));
        content.push(U.el('div.rp-paper', [doc(d, ui.sections)]));
      } else {
        // Móvil: resumen de la semana
        var cur = d.cur, Ch = W.Charts;
        content.push(U.el('div.rp-controls', controls));
        content.push(U.el('div.st-tiles', [
          Ch.tile({ label: W.t('Completadas'), value: Ch.fmt(cur.done), delta: d.prev.done ? W.Stats.delta(cur.done, d.prev.done) : null, vs: W.t('vs. semana anterior'), sub: W.t('Primera semana con datos') }),
          Ch.tile({ label: W.t('A tiempo'), value: cur.onTime == null ? '—' : cur.onTime + ' %', sub: cur.withDeadline ? W.t('De {n} con fecha', { n: cur.withDeadline }) : W.t('Sin tareas con fecha') }),
          Ch.tile({ label: W.t('Enfoque'), value: Ch.fmtMin(cur.focus), sub: U.plural(cur.sessions, 'sesión', 'sesiones') }),
          Ch.tile({ label: W.t('Hábitos'), value: cur.habitRate == null ? '—' : cur.habitRate + ' %', sub: cur.habits.length ? U.plural(cur.habits.length, 'hábito', 'hábitos') : W.t('Sin hábitos') })
        ]));
        var ins = W.Stats.insights(d.c);
        content.push(W.UI.section({ title: W.t('Lo más destacado'), items: U.el('div.group.card', [ins.length ? U.el('ul.ins-list', ins.slice(0, 5).map(function (x) { return U.el('li', [U.el('span.ins-ic', [U.icon(x.icon, 'sm')]), U.el('span', { text: x.text })]); }))
          : W.UI.empty('buddy:trophy', W.t('Tu semana empieza ahora'), W.t('Completa tareas y aquí verás lo mejor de tu semana.'), null, true)]) }));
        content.push(U.el('div.rp-mobile-actions', [U.el('button.btn.primary.block', { on: { click: function () {
          var text = toText(d);
          if (navigator.share) navigator.share({ title: W.t('Mi semana en WHIDER'), text: text }).catch(function () { copy(text); }); else copy(text);
        } } }, [U.icon('send', 'sm'), W.t('Compartir mi semana')])]));
        content.push(U.el('p.hint', { text: W.t('El informe completo, con PDF y hoja de cálculo, está en WHIDER para ordenador.') }));
      }
      W.UI.mount(root, head, content);
    }
  };
})(window.Whider);
