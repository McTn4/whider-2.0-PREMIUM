/**
 * WHIDER · Efectos visuales: ondas al pulsar, confeti, contadores y anillos
 */
window.Whider = window.Whider || {};

(function (W) {
  'use strict';
  var U = W.U;

  // Onda al pulsar en botones y tarjetas interactivas
  var RIPPLE_SEL = '.btn, .chip, .option, .row[data-tap], .dock-tab, .quick, .icon-btn, .segmented button, .swatch';
  document.addEventListener('pointerdown', function (e) {
    if (U.reducedMotion()) return;
    var host = e.target.closest && e.target.closest(RIPPLE_SEL);
    if (!host || host.disabled) return;
    host.classList.add('ripple-host');
    var r = host.getBoundingClientRect(), size = Math.max(r.width, r.height) * 2.2;
    var dot = document.createElement('span');
    dot.className = 'ripple';
    dot.style.width = dot.style.height = size + 'px';
    dot.style.left = (e.clientX - r.left - size / 2) + 'px';
    dot.style.top = (e.clientY - r.top - size / 2) + 'px';
    host.appendChild(dot);
    setTimeout(function () { if (dot.parentNode) dot.parentNode.removeChild(dot); }, 650);
  }, { passive: true });

  var Fx = {
    /** Anima un número desde su valor actual hasta `to` */
    countUp: function (node, to, opts) {
      opts = opts || {};
      var from = parseFloat(node.getAttribute('data-val')) || 0;
      node.setAttribute('data-val', to);
      var suffix = opts.suffix || '';
      if (U.reducedMotion() || from === to) { node.textContent = to + suffix; return; }
      var start = performance.now(), dur = opts.dur || 900;
      (function frame(now) {
        var p = Math.min(1, (now - start) / dur), e = 1 - Math.pow(1 - p, 3);
        node.textContent = Math.round(from + (to - from) * e) + suffix;
        if (p < 1) requestAnimationFrame(frame);
      })(start);
    },

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
      wrap._set = function (v) { fg.setAttribute('stroke-dashoffset', c * (1 - U.clamp(v, 0, 1))); };
      requestAnimationFrame(function () { requestAnimationFrame(function () { wrap._set(value); }); });
      return wrap;
    },

    /** Lluvia de confeti con los colores del acento */
    confetti: function (originX, originY) {
      if (U.reducedMotion()) return;
      var cv = document.getElementById('confetti');
      if (!cv) return;
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      var w = window.innerWidth, h = window.innerHeight;
      cv.width = w * dpr; cv.height = h * dpr;
      var ctx = cv.getContext('2d');
      ctx.scale(dpr, dpr);
      var css = getComputedStyle(document.documentElement);
      var colors = [css.getPropertyValue('--accent').trim(), css.getPropertyValue('--accent-2').trim(), '#FFFFFF', '#FFC45C', '#3DDC97'];
      var ox = originX != null ? originX : w / 2, oy = originY != null ? originY : h * 0.35;
      var parts = [];
      for (var i = 0; i < 140; i++) {
        var a = Math.random() * Math.PI * 2, v = 4 + Math.random() * 9;
        parts.push({ x: ox, y: oy, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 6, s: 4 + Math.random() * 6,
          r: Math.random() * Math.PI, vr: (Math.random() - .5) * .3, c: colors[i % colors.length], life: 0, shape: i % 3 });
      }
      var start = performance.now();
      (function frame(now) {
        var t = now - start;
        ctx.clearRect(0, 0, w, h);
        parts.forEach(function (p) {
          p.vy += 0.28; p.vx *= 0.99; p.x += p.vx; p.y += p.vy; p.r += p.vr;
          ctx.save();
          ctx.globalAlpha = Math.max(0, 1 - t / 2600);
          ctx.translate(p.x, p.y); ctx.rotate(p.r); ctx.fillStyle = p.c;
          if (p.shape === 0) ctx.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2);
          else if (p.shape === 1) { ctx.beginPath(); ctx.arc(0, 0, p.s / 2.6, 0, Math.PI * 2); ctx.fill(); }
          else { ctx.beginPath(); ctx.moveTo(0, -p.s / 2); ctx.lineTo(p.s / 2, p.s / 2); ctx.lineTo(-p.s / 2, p.s / 2); ctx.fill(); }
          ctx.restore();
        });
        if (t < 2700) requestAnimationFrame(frame); else ctx.clearRect(0, 0, w, h);
      })(start);
    },

    /** Onda expansiva sobre un elemento (al completar una tarea) */
    burst: function (node) {
      if (U.reducedMotion() || !node) return;
      var b = U.el('span.check-burst');
      node.appendChild(b);
      setTimeout(function () { if (b.parentNode) b.parentNode.removeChild(b); }, 520);
    }
  };

  W.Fx = Fx;
})(window.Whider);
