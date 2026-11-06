/**
 * WHIDER · Gráficos (sin librerías): columnas, barras horizontales, línea con área,
 * mapa del año, cifras con variación y vista de tabla.
 *
 * En blanco y negro como el resto de la app: una sola serie por gráfico (sin leyenda: el
 * título dice qué se mide), lo destacado en blanco y el resto en gris (#7A7A7A, separación y
 * contraste comprobados), rejilla de una línea muy tenue y escala de grises de 4 pasos para
 * el mapa (#4D4D4D → #FFFFFF, validada). Cada marca tiene su aviso al pasar el ratón o al
 * enfocarla con el teclado, y cada gráfico se puede ver como tabla.
 */
window.Whider = window.Whider || {};

(function (W) {
  'use strict';
  var U = W.U;
  var tip = null;

  function fmt(n) {
    if (n == null || isNaN(n)) return '—';
    var r = Math.round(n * 10) / 10;
    var s = (Math.abs(r) >= 100 || r === Math.round(r) ? Math.round(r) : r).toString().replace('.', ',');
    return s.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  }
  function fmtMin(m) { m = Math.round(m || 0); return m >= 60 ? Math.floor(m / 60) + ' h' + (m % 60 ? ' ' + m % 60 + ' min' : '') : m + ' min'; }
  function niceMax(v) {
    if (!v || v <= 0) return 1;
    var p = Math.pow(10, Math.floor(Math.log(v) / Math.LN10)), n = v / p;
    return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p;
  }

  /* ---------- Aviso flotante ---------- */
  function showTip(target, value, label) {
    if (!tip) { tip = U.el('div.chart-tip', { attrs: { role: 'status' } }); document.body.appendChild(tip); }
    U.clear(tip);
    tip.appendChild(U.el('strong', { text: value }));
    if (label) tip.appendChild(U.el('span', { text: label }));
    var r = target.getBoundingClientRect();
    tip.style.display = 'flex';
    var w = tip.offsetWidth, h = tip.offsetHeight;
    var x = U.clamp(r.left + r.width / 2 - w / 2, 8, window.innerWidth - w - 8);
    var y = r.top - h - 8;
    if (y < 8) y = r.bottom + 8;
    tip.style.left = x + 'px'; tip.style.top = y + 'px';
  }
  function hideTip() { if (tip) tip.style.display = 'none'; }
  function hover(el, value, label) {
    el.addEventListener('pointerenter', function () { showTip(el, value, label); });
    el.addEventListener('pointerleave', hideTip);
    el.addEventListener('focus', function () { showTip(el, value, label); });
    el.addEventListener('blur', hideTip);
  }
  window.addEventListener('scroll', hideTip, true);

  var Charts = {
    fmt: fmt, fmtMin: fmtMin, niceMax: niceMax,

    /**
     * Columnas verticales. data: [{ x (rótulo del eje), name (aviso), value, emph, future }]
     * o: { height, unit: ['tarea','tareas'], every (rótulo cada N), avg: true }
     */
    columns: function (data, o) {
      o = o || {};
      var max = niceMax(Math.max.apply(null, data.map(function (d) { return d.value; }).concat([1])));
      var unit = o.unit || ['', ''];
      var lab = function (v) { return fmt(v) + (unit[0] ? ' ' + (v === 1 ? unit[0] : unit[1]) : ''); };
      var wrap = U.el('div.vchart', { attrs: { role: 'img', 'aria-label': o.title || 'Gráfico de columnas' }, style: { '--h': (o.height || 150) + 'px' } });
      var grid = U.el('div.vc-grid', [max, max / 2, 0].map(function (v) { return U.el('div.vc-line', [U.el('span', { text: fmt(v) })]); }));
      var cols = U.el('div.vc-cols' + (data.length > 40 ? '.dense' : ''));
      data.forEach(function (d, i) {
        var h = d.value ? Math.max(2, d.value / max * 100) : 0;
        var bar = U.el('i.vc-bar' + (d.emph ? '.emph' : '') + (d.future ? '.future' : ''), { style: { height: h + '%' } });
        var col = U.el('div.vc-col', { attrs: { tabindex: '0', 'aria-label': (d.name || d.x) + ': ' + lab(d.value) } }, [U.el('div.vc-track', [bar]),
          U.el('span.vc-x', { text: !o.every || i % o.every === 0 || i === data.length - 1 ? (d.x || '') : '' })]);
        hover(col, lab(d.value), d.name || d.x);
        cols.appendChild(col);
      });
      wrap.appendChild(grid);
      wrap.appendChild(cols);
      if (o.avg) {
        var vals = data.filter(function (d) { return !d.future; }).map(function (d) { return d.value; });
        var avg = vals.length ? vals.reduce(function (a, b) { return a + b; }, 0) / vals.length : 0;
        if (avg > 0) wrap.appendChild(U.el('div.vc-avg', { style: { bottom: 'calc(20px + (var(--h) - 20px) * ' + (avg / max).toFixed(4) + ')' } }, [U.el('span', { text: 'media ' + fmt(avg) })]));
      }
      return wrap;
    },

    /** Barras horizontales ordenadas. data: [{ label, icon, value, sub }] · o: { unit } */
    hbars: function (data, o) {
      o = o || {};
      var max = Math.max.apply(null, data.map(function (d) { return d.value; }).concat([1]));
      var unit = o.unit || ['', ''];
      return U.el('div.hb', { attrs: { role: 'img', 'aria-label': o.title || 'Barras' } }, data.map(function (d) {
        var lab = fmt(d.value) + (unit[0] ? ' ' + (d.value === 1 ? unit[0] : unit[1]) : '');
        var row = U.el('div.hb-row', { attrs: { tabindex: '0', 'aria-label': d.label + ': ' + lab } }, [
          U.el('span.hb-label', [d.prio ? W.UI.prio(d.prio) : d.icon ? U.icon(d.icon, 'sm') : null, U.el('span', { text: d.label })]),
          U.el('div.hb-track', [U.el('i' + (d.emph ? '.emph' : ''), { style: { width: (d.value ? Math.max(1.5, d.value / max * 100) : 0) + '%' } })]),
          U.el('b.hb-val', { text: fmt(d.value) })
        ]);
        hover(row, lab, d.label + (d.sub ? ' · ' + d.sub : ''));
        return row;
      }));
    },

    /** Línea con área (una serie) y cruz que sigue al ratón. data: [{ x, name, value }] · o: { height, fmt } */
    area: function (data, o) {
      o = o || {};
      var H = o.height || 150, n = data.length, max = niceMax(Math.max.apply(null, data.map(function (d) { return d.value; }).concat([1])));
      var f = o.fmt || fmt;
      var pts = data.map(function (d, i) { return [n > 1 ? i / (n - 1) * 1000 : 500, 1000 - d.value / max * 1000]; });
      var line = pts.map(function (p, i) { return (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1); }).join('');
      var svg = '<svg viewBox="0 0 1000 1000" preserveAspectRatio="none" aria-hidden="true"><path d="' + line + 'L1000 1000L0 1000Z" fill="#FFFFFF" fill-opacity=".1"/>' +
        '<path d="' + line + '" fill="none" stroke="#FFFFFF" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"/></svg>';
      var plot = U.el('div.ac-plot', { html: svg });
      var last = data[n - 1] || { value: 0 };
      var end = U.el('i.ac-dot', { style: { left: '100%', top: (100 - last.value / max * 100) + '%' } });
      var cross = U.el('div.ac-cross'), dot = U.el('i.ac-dot.live');
      plot.appendChild(end); plot.appendChild(cross); plot.appendChild(dot);
      var grid = U.el('div.vc-grid', [max, max / 2, 0].map(function (v) { return U.el('div.vc-line', [U.el('span', { text: f(v) })]); }));
      var axis = U.el('div.ac-x', data.map(function (d, i) { return U.el('span', { text: !o.every || i % o.every === 0 || i === n - 1 ? d.x : '' }); }));
      var wrap = U.el('div.achart', { attrs: { role: 'img', 'aria-label': o.title || 'Gráfico de línea', tabindex: '0' }, style: { '--h': H + 'px' } }, [grid, plot, axis]);
      var at = function (clientX) {
        var r = plot.getBoundingClientRect(), i = Math.round(U.clamp((clientX - r.left) / r.width, 0, 1) * (n - 1));
        var d = data[i]; if (!d) return;
        var x = n > 1 ? i / (n - 1) * 100 : 50, y = 100 - d.value / max * 100;
        cross.style.left = x + '%'; dot.style.left = x + '%'; dot.style.top = y + '%';
        wrap.classList.add('hovering');
        showTip(dot, f(d.value), d.name || d.x);
      };
      plot.addEventListener('pointermove', function (e) { at(e.clientX); });
      plot.addEventListener('pointerleave', function () { wrap.classList.remove('hovering'); hideTip(); });
      var ki = n - 1;
      wrap.addEventListener('keydown', function (e) {
        if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
        e.preventDefault(); e.stopPropagation();
        ki = U.clamp(ki + (e.key === 'ArrowRight' ? 1 : -1), 0, n - 1);
        var r = plot.getBoundingClientRect(); at(r.left + (n > 1 ? ki / (n - 1) : .5) * r.width);
      });
      wrap.addEventListener('blur', function () { wrap.classList.remove('hovering'); hideTip(); });
      return wrap;
    },

    /** Mapa del año: una casilla por día, más luz cuanto más se completó. map: { fecha: n } */
    year: function (map, o) {
      o = o || {};
      var td = U.today(), ws = W.State.settings.weekStart, weeks = o.weeks || 53;
      var start = U.addDays(td, -((U.weekday(td) - ws + 7) % 7) - (weeks - 1) * 7);
      var vals = Object.keys(map).filter(function (k) { return k >= start; }).map(function (k) { return map[k]; });
      var max = Math.max.apply(null, vals.concat([1]));
      var grid = U.el('div.yh-grid', { attrs: { role: 'img', 'aria-label': o.title || 'Constancia del año' } });
      var months = U.el('div.yh-months');
      var lastM = -1;
      for (var w = 0; w < weeks; w++) {
        var col = U.el('div.yh-col');
        var wd0 = U.parse(U.addDays(start, w * 7));
        if (wd0.getMonth() !== lastM) { lastM = wd0.getMonth(); months.appendChild(U.el('span', { text: U.MONTHS[lastM].slice(0, 3), style: { gridColumn: (w + 1) + ' / span 4' } })); }
        for (var d = 0; d < 7; d++) {
          var ds = U.addDays(start, w * 7 + d), v = map[ds] || 0;
          var lvl = ds > td ? 'x' : !v ? '0' : String(Math.min(4, Math.ceil(v / max * 4)));
          var cell = U.el('i.yh-c.l' + lvl + (ds === td ? '.today' : ''), { attrs: ds > td ? null : { tabindex: '-1' } });
          if (ds <= td) hover(cell, v + (v === 1 ? ' tarea' : ' tareas'), U.fmtLong(ds));
          col.appendChild(cell);
        }
        grid.appendChild(col);
      }
      months.style.gridTemplateColumns = 'repeat(' + weeks + ', 1fr)';
      var scale = U.el('div.yh-scale', [U.el('span', { text: 'Menos' })].concat(['0', '1', '2', '3', '4'].map(function (l) { return U.el('i.yh-c.l' + l); })).concat([U.el('span', { text: 'Más' })]));
      return U.el('div.yh', [months, grid, scale]);
    },

    /** Tabla con los mismos datos que el gráfico (accesible y para copiar) */
    table: function (head, rows) {
      return U.el('table.ch-table', [U.el('thead', [U.el('tr', head.map(function (h) { return U.el('th', { text: h }); }))]),
        U.el('tbody', rows.map(function (r) { return U.el('tr', r.map(function (c) { return U.el('td', { text: String(c) }); })); }))]);
    },

    /** Tarjeta de gráfico con su título y el botón «Tabla» */
    card: function (o) {
      var body = U.el('div.ch-body', [o.chart]);
      var showing = false;
      var btn = o.table ? U.el('button.link-btn.muted.ch-tbtn', { text: 'Tabla', attrs: { 'aria-pressed': 'false' } }) : null;
      if (btn) btn.addEventListener('click', function () {
        showing = !showing; U.clear(body); body.appendChild(showing ? o.table() : o.chart);
        btn.textContent = showing ? 'Gráfico' : 'Tabla'; btn.setAttribute('aria-pressed', showing ? 'true' : 'false');
      });
      return U.el('div.group.card.ch-card' + (o.wide ? '.wide' : '') + (o.cls ? '.' + o.cls : ''), [
        U.el('div.ch-head', [U.el('div', [U.el('strong', { text: o.title }), o.sub ? U.el('small', { text: o.sub }) : null]), btn]), body]);
    },

    /** Tarjeta bloqueada (Premium) */
    locked: function (title, text, feature) {
      return U.el('div.group.card.ch-card.ch-locked', [U.el('div.ch-head', [U.el('div', [U.el('strong', { text: title }), U.el('small', { text: text })])]),
        U.el('button.btn.sm.soft', { on: { click: function () { W.Plan.paywall(feature || 'stats'); } } }, [U.icon('gem', 'sm'), 'Desbloquear con Premium'])]);
    },

    /** Cifra con variación y mini tendencia. o: { label, value, delta (%), goodUp, spark: [números], sub } */
    tile: function (o) {
      var d = o.delta, good = d == null || d === 0 ? null : (d > 0) === (o.goodUp !== false);
      var spark = null;
      if (o.spark && o.spark.length > 1) {
        var mx = Math.max.apply(null, o.spark.concat([1])), n = o.spark.length;
        var pts = o.spark.map(function (v, i) { return (i / (n - 1) * 100).toFixed(1) + ',' + (30 - v / mx * 26 - 2).toFixed(1); });
        spark = U.el('span.st-spark', { html: '<svg viewBox="0 0 100 30" preserveAspectRatio="none" aria-hidden="true"><polyline points="' + pts.join(' ') + '" fill="none" stroke="#7A7A7A" stroke-width="2" vector-effect="non-scaling-stroke" stroke-linejoin="round"/></svg>' });
      }
      return U.el('div.st-tile', [
        U.el('span.st-label', { text: o.label }),
        U.el('strong.st-value', { text: o.value }),
        d == null ? U.el('span.st-delta.flat', { text: o.sub || 'Sin periodo anterior' })
          : U.el('span.st-delta' + (good === true ? '.good' : good === false ? '.bad' : '.flat'), [U.icon(d > 0 ? 'up' : d < 0 ? 'down' : 'chev', 'xs'),
            (d > 0 ? '+' : '') + d + (o.vs === 'puntos' ? (Math.abs(d) === 1 ? ' punto' : ' puntos') + ' vs. periodo anterior' : ' % ' + (o.vs || 'vs. periodo anterior'))]),
        spark
      ]);
    },
    hideTip: hideTip
  };

  W.Charts = Charts;
})(window.Whider);
