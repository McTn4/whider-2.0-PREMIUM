/**
 * WHIDER · Avisos flotantes con acción opcional (Deshacer, Completar…)
 */
window.Whider = window.Whider || {};

(function (W) {
  'use strict';
  var U = W.U, MAX = 3;
  var ICONS = { success: 'check', danger: 'alert', info: 'info' };

  function dismiss(node) {
    if (!node || node._gone) return;
    node._gone = true;
    node.classList.add('out');
    setTimeout(function () { if (node.parentNode) node.parentNode.removeChild(node); }, 300);
  }

  W.Toast = {
    /** show({ text, type: 'success'|'danger'|'info', icon, action: { label, fn }, duration }) */
    show: function (o) {
      if (typeof o === 'string') o = { text: o };
      var root = document.getElementById('toastRoot');
      if (!root) return null;
      while (root.children.length >= MAX) dismiss(root.firstChild) || root.removeChild(root.firstChild);
      var node = U.el('div.toast' + (o.type ? '.' + o.type : ''), { attrs: { role: o.type === 'danger' ? 'alert' : 'status' } }, [
        U.el('span.toast-ic', [U.icon(o.icon || ICONS[o.type] || 'sparkle')]),
        U.el('span.toast-text', { text: o.text })
      ]);
      if (o.action) {
        node.appendChild(U.el('button.btn.soft', { text: o.action.label, on: { click: function () {
          dismiss(node);
          try { o.action.fn(); } catch (e) { console.error(e); }
        } } }));
      }
      node.appendChild(U.el('button.toast-x', { attrs: { 'aria-label': 'Cerrar' }, on: { click: function () { dismiss(node); } } }, [U.icon('close', 'sm')]));
      root.appendChild(node);
      setTimeout(function () { dismiss(node); }, o.duration || (o.action ? 6000 : 3200));
      return node;
    }
  };
})(window.Whider);
