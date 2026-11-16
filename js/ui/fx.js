/**
 * WHIDER · Efectos visuales discretos: anillos de progreso
 */
window.Whider = window.Whider || {};

(function (W) {
  'use strict';
  var U = W.U;

  var Fx = {

    /** Anillo SVG de progreso (0..1) */
    ring: function (size, stroke, value, label, from) {
      var r = (size - stroke) / 2, c = 2 * Math.PI * r;
      var startOffset = c * (1 - U.clamp(from || 0, 0, 1));
      var wrap = U.el('div.ring', { style: { width: size + 'px', height: size + 'px' } });
      var bg = U.svg('circle', { 'class': 'ring-bg', cx: size / 2, cy: size / 2, r: r, 'stroke-width': stroke });
      var fg = U.svg('circle', { 'class': 'ring-fg', cx: size / 2, cy: size / 2, r: r, 'stroke-width': stroke,
        'stroke-dasharray': c, 'stroke-dashoffset': startOffset });
      wrap.appendChild(U.svg('svg', { viewBox: '0 0 ' + size + ' ' + size }, [bg, fg]));
      if (label) wrap.appendChild(U.el('div.ring-label', [label]));
      wrap._set = function (v) { fg.style.opacity = v > 0 ? '' : '0'; fg.setAttribute('stroke-dashoffset', c * (1 - U.clamp(v, 0, 1))); };
      // Valores casi nulos: sin "punto" suelto del extremo redondeado
      if (value <= 0) fg.style.opacity = '0';
      requestAnimationFrame(function () { requestAnimationFrame(function () { wrap._set(value); }); });
      return wrap;
    }
  };

  W.Fx = Fx;
})(window.Whider);
