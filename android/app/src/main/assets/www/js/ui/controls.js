/**
 * WHIDER · Controles reutilizables: cabecera de pantalla, secciones y celdas,
 * segmentado, interruptor, paso a paso, colores y calendario mensual.
 */
window.Whider = window.Whider || {};

(function (W) {
  'use strict';
  var U = W.U;

  function placeThumb(wrap) {
    var thumb = wrap.querySelector('.seg-thumb'), act = wrap.querySelector('button.active');
    if (!thumb || !act || !act.offsetWidth) return;
    var first = !wrap._placed;
    if (first) thumb.style.transition = 'none';
    thumb.style.width = act.offsetWidth + 'px';
    thumb.style.transform = 'translateX(' + (act.offsetLeft - 2) + 'px)';
    if (first) { void thumb.offsetWidth; thumb.style.transition = ''; wrap._placed = true; }
    U.$$('button', wrap).forEach(function (b) { b.classList.toggle('after-active', b.previousElementSibling === act); });
  }

  /** Botón de barra de navegación: { icon, text, label, onTap, bold, back } o un nodo */
  function navBtn(spec) {
    if (!spec) return null;
    if (spec.nodeType) return spec;
    var b = U.el('button.nav-btn' + (spec.bold ? '.bold' : '') + (spec.back ? '.back' : ''), { attrs: spec.label ? { 'aria-label': spec.label } : null },
      [spec.icon ? U.icon(spec.icon) : null, spec.text ? U.el('span', { text: spec.text }) : null]);
    if (spec.onTap) b.addEventListener('click', function (e) { spec.onTap(e, b); });
    if (spec.disabled) b.disabled = true;
    return b;
  }

  var UI = {
    navBtn: navBtn,

    /**
     * Cabecera de pantalla: barra de navegación fija + título grande.
     * header({ title, eyebrow, back: { label, onTap }, actions: [spec], avatar, titleColor })
     */
    header: function (o) {
      var lead = U.el('div.nav-lead', [o.back ? navBtn({ icon: 'back', text: o.back.label, label: 'Volver a ' + o.back.label, onTap: o.back.onTap, back: true }) : null]);
      var trail = U.el('div.nav-trail', (o.actions || []).map(navBtn));
      var nav = U.el('header.nav', [lead, U.el('div.nav-title', { text: o.compact || o.title }), trail]);
      var avatar = o.avatar ? U.el('button.avatar-btn', { attrs: { 'aria-label': 'Perfil y ajustes' }, on: { click: function () { W.Settings.open(); } } }, [W.Profile.avatar()]) : null;
      var lt = U.el('div.lt', [
        U.el('div.lt-text', [
          o.eyebrow ? U.el('span.eyebrow', { text: o.eyebrow }) : null,
          U.el('h1', { text: o.title, style: o.titleColor ? { color: o.titleColor } : null })
        ]),
        avatar
      ]);
      return { nav: nav, lt: lt };
    },

    /** Monta una pantalla: barra + contenido */
    mount: function (root, head, content) {
      var inner = U.el('div.inner', [head.lt].concat(content));
      U.clear(root);
      root.appendChild(head.nav);
      root.appendChild(inner);
      return inner;
    },

    /**
     * Sección: section({ header, title, side, red, items, footer, first })
     *  - header: encabezado pequeño en mayúsculas (ajustes)
     *  - title: encabezado en negrita (listas de tareas)
     */
    section: function (o) {
      var head = null;
      if (o.title) head = U.el('div.sec-t' + (o.red ? '.red' : ''), [U.el('span', { text: o.title }), o.side || null]);
      else if (o.header) head = U.el('div.sec-h' + (o.red ? '.red' : ''), { text: o.header });
      var items = Array.isArray(o.items) ? U.el('div.group', o.items) : o.items;
      return U.el('div.sec' + (o.first ? '.first' : '') + (o.cls ? '.' + o.cls : ''), [head, items, o.footer ? U.el('div.sec-f', { text: o.footer }) : null]);
    },

    group: function (cells) { return U.el('div.group', cells); },

    /**
     * Celda: cell({ icon, color, round, lead, title, sub, subCls, value, right, chevron, onTap, danger, accent, center, cls, attrs })
     */
    cell: function (o) {
      var tappable = !!o.onTap;
      var lead = o.lead || (o.icon ? U.el('span.cell-icon' + (o.round ? '.round' : ''), { style: { '--c': o.color || 'var(--gray-2)' } }, [U.icon(o.icon)]) : null);
      var right = o.right || null;
      if (!right && (o.value != null || (tappable && !o.center && !o.accent && o.chevron !== false))) {
        right = U.el('span.cell-value', [
          o.value != null ? (o.value.nodeType ? o.value : U.el('span', { text: String(o.value) })) : null,
          o.chevron !== false && tappable ? U.icon('chev', 'chev') : null
        ]);
      }
      var cls = (tappable ? 'button' : 'div') + '.cell' + (lead && !o.center ? '.has-icon' : '') + (o.danger ? '.danger' : '') + (o.accent ? '.accent' : '') + (o.center ? '.center' : '') + (o.cls ? '.' + o.cls : '');
      var main = o.center ? U.el('span.cell-title', { text: o.title }) : U.el('span.cell-main', [
        U.el('span.cell-title', { text: o.title }),
        o.sub ? U.el('span.cell-sub' + (o.subCls ? '.' + o.subCls : ''), { text: o.sub }) : null
      ]);
      var node = U.el(cls, { attrs: o.attrs || null }, [lead, main, right]);
      if (tappable) node.addEventListener('click', function (e) { o.onTap(e, node); });
      return node;
    },

    /** Compatibilidad: row({ icon, label, desc, value, right, onTap, danger }) */
    row: function (o) {
      return UI.cell({ icon: o.icon, color: o.color, title: o.label, sub: o.desc, value: o.value, right: o.right, onTap: o.onTap, danger: o.danger, chevron: o.onTap ? true : undefined });
    },

    /** Icono redondo de lista (color de la lista) */
    listIcon: function (color, icon) {
      return U.el('span.cell-icon.round', { style: { '--c': color } }, [U.icon(icon || 'list')]);
    },

    segmented: function (options, value, onChange, opts) {
      opts = opts || {};
      var wrap = U.el('div.segmented' + (opts.mini ? '.mini' : ''), { attrs: { role: 'tablist' } });
      wrap.appendChild(U.el('span.seg-thumb'));
      options.forEach(function (op) {
        var b = U.el('button' + (op.value === value ? '.active' : ''), { attrs: { role: 'tab', 'aria-selected': op.value === value ? 'true' : 'false' } }, [op.label]);
        b.addEventListener('click', function () {
          if (b.classList.contains('active')) return;
          U.$$('button', wrap).forEach(function (x) { x.classList.remove('active'); x.setAttribute('aria-selected', 'false'); });
          b.classList.add('active'); b.setAttribute('aria-selected', 'true');
          placeThumb(wrap);
          W.Audio.select();
          onChange(op.value);
        });
        wrap.appendChild(b);
      });
      var ro = window.ResizeObserver ? new ResizeObserver(function () { placeThumb(wrap); }) : null;
      if (ro) ro.observe(wrap); else setTimeout(function () { placeThumb(wrap); }, 60);
      requestAnimationFrame(function () { placeThumb(wrap); });
      return wrap;
    },

    toggle: function (checked, onChange, label) {
      var input = U.el('input', { attrs: { type: 'checkbox', role: 'switch', 'aria-label': label || '' } });
      input.checked = !!checked;
      input.addEventListener('change', function () { W.Audio.select(); onChange(input.checked); });
      input.addEventListener('click', function (e) { e.stopPropagation(); });
      return U.el('label.switch', { on: { click: function (e) { e.stopPropagation(); } } }, [input, U.el('span.track')]);
    },

    /** Valor + botones − / + (como en los ajustes del sistema) */
    stepper: function (value, min, max, step, onChange, fmt) {
      var out = U.el('span.step-value', { text: fmt ? fmt(value) : value });
      var minus, plus;
      var sync = function () { minus.disabled = value <= min; plus.disabled = value >= max; };
      var set = function (v) {
        v = U.clamp(v, min, max);
        if (v === value) return;
        value = v; out.textContent = fmt ? fmt(v) : v; sync(); W.Audio.select(); onChange(v);
      };
      minus = U.el('button', { text: '−', attrs: { 'aria-label': 'Menos' }, on: { click: function () { set(value - step); } } });
      plus = U.el('button', { text: '+', attrs: { 'aria-label': 'Más' }, on: { click: function () { set(value + step); } } });
      sync();
      return U.el('span.cell-row', [out, U.el('span.stepper', [minus, plus])]);
    },

    swatches: function (value, onChange) {
      var A = W.State.ACCENTS;
      var wrap = U.el('div.swatches', { attrs: { role: 'radiogroup' } });
      Object.keys(A).forEach(function (k) {
        var b = U.el('button.swatch' + (k === value ? '.active' : ''), {
          attrs: { role: 'radio', 'aria-checked': k === value ? 'true' : 'false', 'aria-label': A[k].name, title: A[k].name }, style: { '--a': A[k].a }
        });
        b.addEventListener('click', function () {
          U.$$('.swatch', wrap).forEach(function (x) { x.classList.remove('active'); x.setAttribute('aria-checked', 'false'); });
          b.classList.add('active'); b.setAttribute('aria-checked', 'true');
          W.Audio.select();
          onChange(k);
        });
        wrap.appendChild(b);
      });
      return wrap;
    },

    /** Estado vacío: icono gris, título y texto (y una acción opcional) */
    empty: function (icon, title, text, action, small) {
      return U.el('div.empty-state' + (small ? '.small' : ''), [
        icon ? U.icon(icon, 'es-ic') : null,
        U.el('strong', { text: title }),
        text ? U.el('span', { text: text }) : null,
        action || null
      ]);
    },

    /**
     * Mes en cuadrícula (pantalla Calendario y selector de fecha).
     * monthGrid({ y, m, selected, mark(ds) → 'dot'|'late'|'done'|null, onPick(ds), slide })
     */
    monthGrid: function (o) {
      var ws = W.State.settings.weekStart, td = U.today();
      var g = U.el('div.cal-grid' + (o.slide > 0 ? '.slide-l' : o.slide < 0 ? '.slide-r' : ''), { attrs: { role: 'grid' } });
      for (var i = 0; i < 7; i++) g.appendChild(U.el('span.cal-wd', { text: U.WEEKDAYS_LETTER[(i + ws) % 7], attrs: { 'aria-hidden': 'true' } }));
      var first = new Date(o.y, o.m, 1), lead = (first.getDay() - ws + 7) % 7;
      var days = new Date(o.y, o.m + 1, 0).getDate();
      for (var b = 0; b < lead; b++) g.appendChild(U.el('span.cal-blank'));
      for (var d = 1; d <= days; d++) {
        (function (day) {
          var ds = U.ymd(new Date(o.y, o.m, day));
          var mk = o.mark ? o.mark(ds) : null;
          var cell = U.el('button.cal-day' + (ds === td ? '.today' : '') + (ds === o.selected ? '.selected' : '') + (ds < td ? '.past' : ''), {
            attrs: { 'aria-label': U.fmtLong(ds) + (mk && mk.label ? ', ' + mk.label : ''), 'aria-pressed': ds === o.selected ? 'true' : 'false' }
          }, [U.el('span.cal-num', { text: day }), mk ? U.el('i.cal-dot' + (mk.kind && mk.kind !== 'dot' ? '.' + mk.kind : '')) : null]);
          cell.addEventListener('click', function () { o.onPick(ds); });
          g.appendChild(cell);
        })(d);
      }
      return g;
    },

    /** Selector de fecha en línea (calendario con flechas de mes) */
    datePicker: function (value, onChange) {
      var base = value ? U.parse(value) : new Date();
      var view = { y: base.getFullYear(), m: base.getMonth() }, slide = 0;
      var wrap = U.el('div.cal.cal-inline');
      var draw = function () {
        U.clear(wrap);
        wrap.appendChild(U.el('div.cal-head', [
          U.el('strong', { text: U.fmtMonth(view.y, view.m) }),
          U.el('div.cal-arrows', [
            navBtn({ icon: 'left', label: 'Mes anterior', onTap: function () { shift(-1); } }),
            navBtn({ icon: 'right', label: 'Mes siguiente', onTap: function () { shift(1); } })
          ])
        ]));
        wrap.appendChild(UI.monthGrid({ y: view.y, m: view.m, selected: value, slide: slide, onPick: function (ds) { value = ds; W.Audio.select(); onChange(ds); slide = 0; draw(); } }));
        slide = 0;
      };
      var shift = function (delta) { var d = new Date(view.y, view.m + delta, 1); view = { y: d.getFullYear(), m: d.getMonth() }; slide = delta; draw(); };
      wrap.setValue = function (v) { value = v; if (v) { var p = U.parse(v); view = { y: p.getFullYear(), m: p.getMonth() }; } draw(); };
      draw();
      return wrap;
    }
  };

  W.UI = UI;
})(window.Whider);
