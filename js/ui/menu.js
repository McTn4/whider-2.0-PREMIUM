/**
 * WHIDER · Menús contextuales: aparecen junto al botón que los abre, con la opción
 * actual marcada. Sustituyen a las hojas para elegir entre pocas opciones.
 */
window.Whider = window.Whider || {};

(function (W) {
  'use strict';
  var U = W.U;
  var current = null;

  function root() { return document.getElementById('sheetRoot'); }

  /** El ancla es un elemento o un punto { x, y } (menú del botón derecho) */
  function rectOf(anchor) {
    if (anchor && typeof anchor.getBoundingClientRect === 'function') return anchor.getBoundingClientRect();
    var x = anchor && anchor.x || 0, y = anchor && anchor.y || 0;
    return { left: x, right: x, top: y, bottom: y, width: 0, height: 0, point: true };
  }

  function place(menu, anchor) {
    var r = rectOf(anchor);
    var vw = window.innerWidth, vh = window.innerHeight, m = 8;
    var mw = menu.offsetWidth, mh = menu.offsetHeight;
    // Un menú en un punto se abre hacia la derecha salvo que no quepa
    var rightSide = r.point ? r.left + mw > vw - m : r.left + r.width / 2 > vw / 2;
    var left = rightSide ? r.right - mw : r.left;
    left = U.clamp(left, m, vw - mw - m);
    var gap = r.point ? 2 : 6;
    var below = r.bottom + gap, above = r.top - gap - mh;
    var top = below + mh <= vh - m || above < m ? below : above;
    top = U.clamp(top, m, Math.max(m, vh - mh - m));
    menu.style.left = left + 'px';
    menu.style.top = top + 'px';
    menu.style.setProperty('--ox', (rightSide ? mw - 12 : 12) + 'px');
    menu.style.setProperty('--oy', (top >= r.bottom ? 0 : mh) + 'px');
  }

  var Menu = {
    /**
     * open(anchor, items, { title }) → Promise con el valor elegido (o undefined).
     * anchor: el botón que lo abre o un punto { x, y } de la pantalla.
     * items: [{ value, label, desc, icon, prio, on, destructive, gap, disabled }]  (prio: barras de prioridad)
     */
    open: function (anchor, items, opts) {
      opts = opts || {};
      Menu.close();
      return new Promise(function (resolve) {
        var chosen;
        var layer = U.el('div.menu-layer');
        var menu = U.el('div.menu', { attrs: { role: 'menu', 'aria-label': opts.title || 'Opciones' } });
        if (opts.title) menu.appendChild(U.el('div.menu-title', { text: opts.title }));
        items.forEach(function (it) {
          if (it.gap) menu.appendChild(U.el('div.menu-gap'));
          var lead = U.icon('check', 'mi-check');
          var trail = it.prio ? W.UI.prio(it.prio) : it.icon ? U.icon(it.icon, 'mi-ic') : null;
          var b = U.el('button.menu-item' + (it.on ? '.on' : '') + (it.destructive ? '.destructive' : ''), { attrs: { role: 'menuitem' } }, [
            lead,
            U.el('span.mi-label', [it.label, it.desc ? U.el('span.mi-desc', { text: it.desc }) : null]),
            trail
          ]);
          if (it.disabled) b.disabled = true;
          b.addEventListener('click', function (e) { e.stopPropagation(); chosen = it.value; api.close(); });
          menu.appendChild(b);
        });
        layer.appendChild(menu);
        layer.addEventListener('click', function () { api.close(); });
        layer.addEventListener('contextmenu', function (e) { e.preventDefault(); api.close(); });
        // Con teclado: flechas para moverse e Intro para elegir
        menu.setAttribute('tabindex', '-1');
        menu.addEventListener('keydown', function (e) {
          if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp' && e.key !== 'Home' && e.key !== 'End') return;
          e.preventDefault();
          var items = U.$$('.menu-item:not(:disabled)', menu), i = items.indexOf(document.activeElement);
          if (!items.length) return;
          i = e.key === 'Home' ? 0 : e.key === 'End' ? items.length - 1 : e.key === 'ArrowDown' ? (i + 1) % items.length : (i <= 0 ? items.length - 1 : i - 1);
          items[i].focus();
        });
        root().appendChild(layer);
        place(menu, anchor);

        var closed = false;
        var api = {
          close: function () {
            if (closed) return;
            closed = true;
            if (current === api) current = null;
            if (layer.contains(document.activeElement)) document.activeElement.blur();
            layer.classList.remove('open');
            setTimeout(function () { if (layer.parentNode) layer.parentNode.removeChild(layer); }, 200);
            resolve(chosen);
          }
        };
        current = api;
        requestAnimationFrame(function () {
          layer.classList.add('open');
          if (opts.keyboard || (W.Layout && W.Layout.desktop)) menu.focus({ preventScroll: true });
        });
      });
    },

    /** Selección simple: choose(anchor, { value, options:[{value,label,desc,icon,color}] }) */
    choose: function (anchor, o) {
      return Menu.open(anchor, o.options.map(function (op) {
        return Object.assign({}, op, { on: o.value !== undefined && op.value === o.value });
      }), { title: o.title && o.showTitle ? o.title : null });
    },

    isOpen: function () { return !!current; },
    close: function () { if (current) { current.close(); return true; } return false; }
  };

  window.addEventListener('resize', function () { Menu.close(); });
  W.Menu = Menu;
})(window.Whider);
