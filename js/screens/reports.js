/**
 * WHIDER · Informes
 *  - Ordenador: informe completo de un periodo con los apartados que elijas, listo para
 *    imprimir o guardar en PDF, y para exportar en CSV (hoja de cálculo), JSON o texto.
 *    Gratis: esta semana y la pasada, para imprimir. Premium: cualquier periodo y exportaciones.
 *  - Móvil: el resumen de tu semana, para leerlo o compartirlo.
 */
window.Whider = window.Whider || {};
window.Whider.Screens = window.Whider.Screens || {};

(function (W) {
  'use strict';
  var U = W.U, S = function () { return W.State; };
  var PERIODS = [
    { value: 'week', label: 'Esta semana' }, { value: 'lastweek', label: 'Semana pasada' }, { value: 'month', label: 'Este mes' },
    { value: 'lastmonth', label: 'Mes pasado' }, { value: 'year', label: 'Este año' }, { value: 'custom', label: 'Personalizado' }
  ];
  var SECTIONS = [
    { id: 'summary', label: 'Resumen' }, { id: 'done', label: 'Completadas' }, { id: 'pending', label: 'Pendientes' }, { id: 'lists', label: 'Categorías' },
    { id: 'focus', label: 'Enfoque' }, { id: 'habits', label: 'Hábitos' }, { id: 'notes', label: 'Cuaderno' }, { id: 'achievements', label: 'Logros' }
  ];
  var ui = { period: 'week', from: null, to: null, sections: { summary: true, done: true, pending: true, lists: true, focus: true, habits: true, notes: false, achievements: true } };

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
  function premiumPeriod(p) { return p !== 'week' && p !== 'lastweek'; }
  function longDate(ds) { var d = U.parse(ds); return d.getDate() + ' de ' + U.MONTHS[d.getMonth()] + ' de ' + d.getFullYear(); }
  function periodText(a, b) { return a === b ? longDate(a) : 'Del ' + longDate(a) + ' al ' + longDate(b); }

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
    var at = st.meta.achievedAt || {};
    var ach = W.Game.achievements().filter(function (a) { return a.ok && at[a.id] && at[a.id] >= startTs && at[a.id] < endTs; });
    return { from: from, to: to, c: c, cur: cur, prev: c.prev, done: done, pending: pending, lists: lists, notes: notes, ach: ach, name: st.displayName() };
  }

  /* ---------- Documento ---------- */
  function doc(d, sections) {
    var Ch = W.Charts, cur = d.cur, out = U.el('article.rp-doc');
    out.appendChild(U.el('header.rp-head', [
      U.el('div.rp-brand', [U.svg('svg', { viewBox: '0 0 64 64', 'aria-hidden': 'true' }, [U.svg('use', { href: '#logo' })]), U.el('span', { text: 'WHIDER' })]),
      U.el('h2', { text: 'Informe de actividad' }),
      U.el('p', { text: periodText(d.from, d.to) + (d.name ? ' · ' + d.name : '') }),
      U.el('small', { text: 'Generado el ' + longDate(U.today()) + ' a las ' + U.fmtTime(U.nowHM()) })
    ]));
    var sec = function (title, body) { out.appendChild(U.el('section.rp-sec', [U.el('h3', { text: title })].concat(body))); };
    if (sections.summary) {
      var dl = W.Stats.delta(cur.done, d.prev.done);
      var kp = [['Completadas', Ch.fmt(cur.done) + (dl != null && d.prev.done ? ' (' + (dl > 0 ? '+' : '') + dl + ' %)' : '')], ['Creadas', Ch.fmt(cur.created)], ['Media al día', Ch.fmt(cur.avg)],
        ['A tiempo', cur.onTime == null ? '—' : cur.onTime + ' %'], ['Enfoque', Ch.fmtMin(cur.focus)], ['Hábitos', cur.habitRate == null ? '—' : cur.habitRate + ' %'],
        ['Días con actividad', cur.activeDays + ' de ' + cur.days.filter(function (r) { return !r.future; }).length], ['Mejor día', cur.best.date ? U.fmtShort(cur.best.date) + ' (' + cur.best.done + ')' : '—']];
      sec('Resumen', [U.el('div.rp-kpis', kp.map(function (k) { return U.el('div', [U.el('span', { text: k[0] }), U.el('strong', { text: k[1] })]); })),
        U.el('ul.rp-ins', W.Stats.insights(d.c).slice(0, 4).map(function (x) { return U.el('li', { text: x.text }); }))]);
    }
    if (sections.done) {
      var byDay = {}, order = [];
      d.done.forEach(function (t) { var k = U.ymd(new Date(t.doneAt)); if (!byDay[k]) { byDay[k] = []; order.push(k); } byDay[k].push(t); });
      sec('Tareas completadas (' + d.done.length + ')', d.done.length ? order.map(function (k) {
        return U.el('div.rp-day', [U.el('h4', { text: U.cap(U.fmtLong(k)) }), U.el('ul', byDay[k].map(function (t) {
          var l = t.listId ? S().getList(t.listId) : null;
          return U.el('li', [U.el('span.rp-t', { text: U.fmtTime(U.pad(new Date(t.doneAt).getHours()) + ':' + U.pad(new Date(t.doneAt).getMinutes())) }), U.el('span', { text: t.text }), l ? U.el('em', { text: l.name }) : null]);
        }))]);
      }) : [U.el('p.rp-none', { text: 'Sin tareas completadas en este periodo.' })]);
    }
    if (sections.pending) {
      var late = d.pending.filter(function (t) { return S().isOverdue(t); });
      sec('Pendientes con fecha (' + d.pending.length + ')', d.pending.length ? [U.el('ul.rp-list', d.pending.slice(0, 60).map(function (t) {
        return U.el('li', [U.el('span.rp-t', { text: U.fmtShort(t.date) + (t.time ? ' ' + U.fmtTime(t.time) : '') }), U.el('span', { text: t.text }), S().isOverdue(t) ? U.el('em', { text: 'vencida' }) : null]);
      })), late.length ? U.el('p.rp-note', { text: U.plural(late.length, 'tarea vencida', 'tareas vencidas') + ' en total.' }) : null] : [U.el('p.rp-none', { text: 'Nada pendiente con fecha. ¡Al día!' })]);
    }
    if (sections.lists && d.lists.length) sec('Por categoría', [Ch.table(['Categoría', 'Completadas', 'Pendientes'], d.lists.map(function (x) { return [x.name, x.done, x.pending]; }))]);
    if (sections.focus) {
      var fd = cur.days.filter(function (r) { return r.focus > 0; });
      sec('Enfoque', [U.el('p', { text: cur.focus ? Ch.fmtMin(cur.focus) + ' en ' + U.plural(cur.sessions, 'sesión', 'sesiones') + '.' : 'Sin sesiones de enfoque en este periodo.' }),
        fd.length ? Ch.table(['Día', 'Minutos', 'Sesiones'], fd.map(function (r) { return [U.fmtShort(r.date), r.focus, r.sessions]; })) : null]);
    }
    if (sections.habits && cur.habits.length) sec('Hábitos', [Ch.table(['Hábito', 'Cumplido', 'Racha actual'], cur.habits.map(function (x) { return [x.habit.name, x.rate + ' %', W.Habits.streak(x.habit)]; }))]);
    if (sections.notes) sec('Páginas editadas (' + d.notes.length + ')', d.notes.length ? [U.el('ul.rp-list', d.notes.map(function (n) { return U.el('li', [U.el('span.rp-t', { text: U.fmtShort(U.ymd(new Date(n.updatedAt))) }), U.el('span', { text: W.Notes.title(n) })]); }))] : [U.el('p.rp-none', { text: 'Sin páginas editadas en este periodo.' })]);
    if (sections.achievements) sec('Logros', d.ach.length ? [U.el('ul.rp-list', d.ach.map(function (a) { return U.el('li', [U.el('span.rp-t', { text: '+' + a.xp + ' XP' }), U.el('span', { text: a.title + ' · ' + a.desc })]); }))] : [U.el('p.rp-none', { text: 'Nivel ' + W.Game.get().level + ' · ' + W.Game.title(W.Game.get().level) + '. Ningún logro nuevo en este periodo.' })]);
    return out;
  }

  /* ---------- Exportar ---------- */
  function csvCell(v) { var s = v == null ? '' : String(v); return /[";\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }
  function toCsv(d) {
    var st = S(), rows = [['Estado', 'Tarea', 'Categoría', 'Prioridad', 'Fecha', 'Hora', 'Completada el', 'Notas']];
    d.done.forEach(function (t) { var l = st.getList(t.listId); rows.push(['Completada', t.text, l ? l.name : '', st.PRIORITIES[t.highlight].label, t.date || '', t.time || '', new Date(t.doneAt).toLocaleString('es-ES'), t.notes || '']); });
    d.pending.forEach(function (t) { var l = st.getList(t.listId); rows.push([st.isOverdue(t) ? 'Vencida' : 'Pendiente', t.text, l ? l.name : '', st.PRIORITIES[t.highlight].label, t.date || '', t.time || '', '', t.notes || '']); });
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
    var cur = d.cur, L = ['WHIDER · Informe de actividad', periodText(d.from, d.to), ''];
    L.push('· Completadas: ' + cur.done + ' (media de ' + W.Charts.fmt(cur.avg) + ' al día)');
    if (cur.onTime != null) L.push('· A tiempo: ' + cur.onTime + ' %');
    L.push('· Enfoque: ' + W.Charts.fmtMin(cur.focus));
    if (cur.habitRate != null) L.push('· Hábitos: ' + cur.habitRate + ' % cumplidos');
    W.Stats.insights(d.c).slice(0, 3).forEach(function (x) { L.push('· ' + x.text); });
    return L.join('\n');
  }
  function copy(text) {
    var done = function () { W.Toast.show({ text: 'Copiado: ya puedes pegarlo donde quieras', icon: 'check' }); };
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
          if (r && r.ok) W.Toast.show({ text: 'Informe guardado en PDF', icon: 'download', action: D.showFile ? { label: 'Mostrar', fn: function () { D.showFile(r.path); } } : null });
        }, end);
      }, 120);
    } else { setTimeout(function () { window.print(); end(); }, 60); }
  }

  /* ---------- Pantalla ---------- */
  var current = null;
  W.Screens.reports = {
    title: 'Informes',
    back: function () { if (W.Layout.desktop) return false; W.Router.back(); return true; },
    /** Menú Archivo → Informe en PDF */
    pdf: function () { if (current) pdf(current); },
    render: function (root) {
      var st = S(), desk = W.Layout.desktop, P = W.Plan;
      if (!P.isPremium() && premiumPeriod(ui.period)) ui.period = 'week';
      if (!desk && ui.period !== 'week' && ui.period !== 'lastweek') ui.period = 'week';
      var r = range(ui.period), d = data(r[0], r[1]);
      current = d;
      var head = W.UI.header({ title: desk ? 'Informes' : 'Tu semana', back: desk ? null : { label: 'Atrás', onTap: function () { W.Router.back(); } }, sub: periodText(r[0], r[1]) });
      var content = [];
      var opts = (desk ? PERIODS : PERIODS.slice(0, 2));
      var periodSeg = W.UI.segmented(opts.map(function (o) { return { value: o.value, label: o.label }; }), ui.period, function (v) {
        if (premiumPeriod(v) && !P.isPremium()) { P.paywall('reports'); W.Router.refresh(); return; }
        ui.period = v; W.Router.refresh();
      }, { mini: true });
      var controls = [U.el('div.rp-row', [periodSeg])];
      if (desk && ui.period === 'custom') {
        var mk = function (val, set) { var i = U.el('input.input.rp-date', { attrs: { type: 'date', 'aria-label': 'Fecha' } }); i.value = val; i.addEventListener('change', function () { if (i.value) { set(i.value); W.Router.refresh(); } }); return i; };
        controls.push(U.el('div.rp-row', [U.el('span.muted', { text: 'Del' }), mk(r[0], function (v) { ui.from = v; }), U.el('span.muted', { text: 'al' }), mk(r[1], function (v) { ui.to = v; })]));
      }
      if (desk) {
        controls.push(U.el('div.chips.wrap.rp-secs', SECTIONS.map(function (s) {
          var c = U.el('button.chip' + (ui.sections[s.id] ? '.on' : ''), { attrs: { type: 'button', 'aria-pressed': ui.sections[s.id] ? 'true' : 'false' }, text: s.label });
          c.addEventListener('click', function () { ui.sections[s.id] = !ui.sections[s.id]; W.Router.refresh(); });
          return c;
        })));
        var gate = function (fn) { return function () { if (!P.isPremium()) { P.paywall('reports'); return; } fn(); }; };
        controls.push(U.el('div.rp-actions', [
          U.el('button.btn.primary.sm', { on: { click: function () { pdf(d); } } }, [U.icon('print', 'sm'), window.WhiderDesktop ? 'Guardar en PDF' : 'Imprimir o PDF']),
          U.el('button.btn.ghost.sm', { on: { click: gate(function () { U.saveFile('whider-informe-' + r[0] + '_' + r[1], toCsv(d), 'csv'); }) } }, [U.icon('download', 'sm'), 'CSV']),
          U.el('button.btn.ghost.sm', { on: { click: gate(function () { U.saveFile('whider-informe-' + r[0] + '_' + r[1], toJson(d), 'json'); }) } }, [U.icon('download', 'sm'), 'JSON']),
          U.el('button.btn.ghost.sm', { on: { click: function () { copy(toText(d)); } } }, [U.icon('layers', 'sm'), 'Copiar resumen']),
          P.isPremium() ? null : U.el('span.premium-chip.ghost', [U.icon('gem'), 'Más periodos, CSV y JSON con Premium'])
        ]));
        content.push(U.el('div.rp-controls', controls));
        content.push(U.el('div.rp-paper', [doc(d, ui.sections)]));
      } else {
        // Móvil: resumen de la semana
        var cur = d.cur, Ch = W.Charts;
        content.push(U.el('div.rp-controls', controls));
        content.push(U.el('div.st-tiles', [
          Ch.tile({ label: 'Completadas', value: Ch.fmt(cur.done), delta: d.prev.done ? W.Stats.delta(cur.done, d.prev.done) : null, vs: 'vs. semana anterior', sub: 'Primera semana con datos' }),
          Ch.tile({ label: 'A tiempo', value: cur.onTime == null ? '—' : cur.onTime + ' %', sub: cur.withDeadline ? 'De ' + cur.withDeadline + ' con fecha' : 'Sin tareas con fecha' }),
          Ch.tile({ label: 'Enfoque', value: Ch.fmtMin(cur.focus), sub: U.plural(cur.sessions, 'sesión', 'sesiones') }),
          Ch.tile({ label: 'Hábitos', value: cur.habitRate == null ? '—' : cur.habitRate + ' %', sub: cur.habits.length ? U.plural(cur.habits.length, 'hábito', 'hábitos') : 'Sin hábitos' })
        ]));
        var ins = W.Stats.insights(d.c);
        content.push(W.UI.section({ title: 'Lo más destacado', items: U.el('div.group.card', [ins.length ? U.el('ul.ins-list', ins.slice(0, 5).map(function (x) { return U.el('li', [U.el('span.ins-ic', [U.icon(x.icon, 'sm')]), U.el('span', { text: x.text })]); }))
          : W.UI.empty('buddy:trophy', 'Tu semana empieza ahora', 'Completa tareas y aquí verás lo mejor de tu semana.', null, true)]) }));
        content.push(U.el('div.rp-mobile-actions', [U.el('button.btn.primary.block', { on: { click: function () {
          var text = toText(d);
          if (navigator.share) navigator.share({ title: 'Mi semana en WHIDER', text: text }).catch(function () { copy(text); }); else copy(text);
        } } }, [U.icon('send', 'sm'), 'Compartir mi semana'])]));
        content.push(U.el('p.hint', { text: 'El informe completo, con PDF y hoja de cálculo, está en WHIDER para ordenador.' }));
      }
      W.UI.mount(root, head, content);
    }
  };
})(window.Whider);
