/**
 * WHIDER · Avisos breves en la parte inferior, con acción opcional (Deshacer, Ver…)
 */
window.Whider = window.Whider || {};

(function (W) {
  'use strict';
  var U = W.U, MAX = 2, muted = false;
  var ICONS = { success: 'check', danger: 'alert', info: 'info' };

  function dismiss(node) {
    if (!node || node._gone) return false;
    node._gone = true;
    node.classList.add('out');
    setTimeout(function () { if (node.parentNode) node.parentNode.removeChild(node); }, 260);
    return true;
  }

  W.Toast = {
    /** Mientras se aplica un cambio a muchas tareas, los avisos de cada una se callan (luego va uno solo) */
    mute: function (on) { muted = !!on; },
    /** show({ text, type: 'success'|'danger'|'info', icon, action: { label, fn }, duration }) */
    show: function (o) {
      if (muted) return null;
      if (typeof o === 'string') o = { text: o };
      var root = document.getElementById('toastRoot');
      if (!root) return null;
      var live = U.$$('.toast:not(.out)', root);
      while (live.length >= MAX) dismiss(live.shift());
      var node = U.el('div.toast' + (o.type ? '.' + o.type : ''), { attrs: { role: o.type === 'danger' ? 'alert' : 'status' } }, [
        o.icon === false ? null : U.el('span.toast-ic', [U.icon(o.icon || ICONS[o.type] || 'info')]),
        U.el('span.toast-text', { text: o.text })
      ]);
      if (o.action) {
        node.appendChild(U.el('button.toast-action', { text: o.action.label, on: { click: function () {
          dismiss(node);
          try { o.action.fn(); } catch (e) { console.error(e); }
        } } }));
      }
      node.addEventListener('click', function (e) { if (!e.target.closest('.toast-action')) dismiss(node); });
      root.appendChild(node);
      setTimeout(function () { dismiss(node); }, o.duration || (o.action ? 5500 : 2800));
      return node;
    }
  };
})(window.Whider);
