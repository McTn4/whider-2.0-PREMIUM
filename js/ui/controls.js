/**
 * WHIDER · Controles reutilizables: segmentado, interruptor, paso a paso,
 * muestras de color y filas de ajustes.
 */
window.Whider = window.Whider || {};

(function (W) {
  'use strict';
  var U = W.U;

  function placeThumb(wrap) {
    var thumb = wrap.querySelector('.seg-thumb'), act = wrap.querySelector('button.active');
    if (!thumb || !act) return;
    thumb.style.width = act.offsetWidth + 'px';
    thumb.style.transform = 'translateX(' + (act.offsetLeft - 4) + 'px)';
  }

  var UI = {
    segmented: function (options, value, onChange) {
      var wrap = U.el('div.segmented', { attrs: { role: 'tablist' } });
      wrap.appendChild(U.el('span.seg-thumb'));
      options.forEach(function (op) {
        var b = U.el('button' + (op.value === value ? '.active' : ''), { attrs: { role: 'tab', 'aria-selected': op.value === value ? 'true' : 'false' } },
          [op.icon ? U.icon(op.icon, 'sm') : null, op.label]);
        b.addEventListener('click', function () {
          if (b.classList.contains('active')) return;
          U.$$('button', wrap).forEach(function (x) { x.classList.remove('active'); x.setAttribute('aria-selected', 'false'); });
          b.classList.add('active'); b.setAttribute('aria-selected', 'true');
          placeThumb(wrap);
          W.Audio.tap();
          onChange(op.value);
        });
        wrap.appendChild(b);
      });
      // Colocar el indicador cuando el control ya tiene tamaño
      var ro = window.ResizeObserver ? new ResizeObserver(function () { placeThumb(wrap); }) : null;
      if (ro) ro.observe(wrap); else setTimeout(function () { placeThumb(wrap); }, 60);
      requestAnimationFrame(function () { placeThumb(wrap); });
      return wrap;
    },

    toggle: function (checked, onChange, label) {
      var input = U.el('input', { attrs: { type: 'checkbox', 'aria-label': label || '' } });
      input.checked = !!checked;
      input.addEventListener('change', function () { W.Audio.tap(); onChange(input.checked); });
      return U.el('label.switch', [input, U.el('span.track')]);
    },

    stepper: function (value, min, max, step, onChange, fmt) {
      var out = U.el('output', { text: fmt ? fmt(value) : value });
      var set = function (v) {
        v = U.clamp(v, min, max);
        if (v === value) return;
        value = v; out.textContent = fmt ? fmt(v) : v; W.Audio.tap(); onChange(v);
      };
      return U.el('div.stepper', [
        U.el('button', { text: '−', attrs: { 'aria-label': 'Menos' }, on: { click: function () { set(value - step); } } }),
        out,
        U.el('button', { text: '+', attrs: { 'aria-label': 'Más' }, on: { click: function () { set(value + step); } } })
      ]);
    },

    swatches: function (value, onChange, small) {
      var A = W.State.ACCENTS;
      var wrap = U.el('div.swatches' + (small ? '.sm' : ''));
      Object.keys(A).forEach(function (k) {
        var b = U.el('button.swatch' + (k === value ? '.active' : ''), {
          attrs: { 'aria-label': A[k].name, title: A[k].name }, style: { '--a': A[k].a, '--b': A[k].b }
        }, [U.icon('check')]);
        b.addEventListener('click', function () {
          U.$$('.swatch', wrap).forEach(function (x) { x.classList.remove('active'); });
          b.classList.add('active');
          W.Audio.tap();
          onChange(k);
        });
        wrap.appendChild(b);
      });
      return wrap;
    },

    /** row({ icon, label, desc, right, onTap, danger, value }) */
    row: function (o) {
      var right = o.right || (o.value != null ? U.el('span.row-value', [o.value, o.onTap ? U.icon('right') : null]) : (o.onTap ? U.el('span.row-value', [U.icon('right')]) : null));
      var node = U.el((o.onTap ? 'button' : 'div') + '.row' + (o.danger ? '.danger' : ''), { attrs: o.onTap ? { 'data-tap': '' } : null }, [
        o.icon ? U.el('span.row-icon' + (o.danger ? '.danger' : ''), [U.icon(o.icon)]) : null,
        U.el('span.row-main', [U.el('span.row-label', { text: o.label }), o.desc ? U.el('span.row-desc', { text: o.desc }) : null]),
        right
      ]);
      if (o.onTap) node.addEventListener('click', o.onTap);
      return node;
    },

    empty: function (icon, title, text, action) {
      return U.el('div.empty', [
        U.el('div.empty-art', [U.icon(icon)]),
        U.el('h3', { text: title }),
        text ? U.el('p', { text: text }) : null,
        action || null
      ]);
    },

    pageHead: function (eyebrow, title, sub, right) {
      return U.el('div.page-head', [
        U.el('div', [eyebrow ? U.el('span.eyebrow', { text: eyebrow }) : null, U.el('h1', { text: title }), sub ? U.el('p', { text: sub }) : null]),
        right || null
      ]);
    }
  };

  W.UI = UI;
})(window.Whider);
