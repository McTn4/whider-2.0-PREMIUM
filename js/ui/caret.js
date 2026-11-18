// @ts-check
/**
 * WHIDER · El cursor dentro de un texto editable
 * Posición en caracteres (sin contar las menciones), colocarlo, saber si está al principio, al final o en la
 * primera o la última línea, y partir el texto donde está. Lo usa el editor del Cuaderno (js/ui/blocks.js).
 */
window.Whider = window.Whider || {};

(function (W) {
  'use strict';
  var P = function () { return W.Pages; };

  /* ---------- Cursor ---------- */
  function sel() { return window.getSelection(); }
  /** Los nodos de texto de un elemento, en orden. @param {Node} el @returns {Text[]} */
  function textNodes(el) {
    /** @type {Text[]} */
    var out = [];
    var w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null), n;
    while ((n = w.nextNode())) out.push(/** @type {Text} */ (n));
    return out;
  }
  function inMention(n) { var p = n.parentNode; while (p && p.nodeType === 1) { if (p.classList && p.classList.contains('mention')) return p; if (p.hasAttribute && p.hasAttribute('contenteditable') && p.getAttribute('contenteditable') === 'true') return null; p = p.parentNode; } return null; }
  function caretOffset(el) {
    var s = sel(); if (!s || !s.rangeCount) return 0;
    var r = s.getRangeAt(0);
    if (!el.contains(r.startContainer) && r.startContainer !== el) return 0;
    var pre = document.createRange(); pre.selectNodeContents(el); pre.setEnd(r.startContainer, r.startOffset);
    return pre.toString().length;
  }
  function setCaret(el, offset) {
    var s = sel(), r = document.createRange();
    if (offset == null || offset === 'end') { r.selectNodeContents(el); r.collapse(false); s.removeAllRanges(); s.addRange(r); return; }
    var left = Math.max(0, offset), nodes = textNodes(el);
    for (var i = 0; i < nodes.length; i++) {
      var n = nodes[i], m = inMention(n);
      if (left <= n.length) {
        if (m) { r.setStartAfter(m); } else r.setStart(n, left);
        r.collapse(true); s.removeAllRanges(); s.addRange(r); return;
      }
      left -= n.length;
    }
    r.selectNodeContents(el); r.collapse(false); s.removeAllRanges(); s.addRange(r);
  }
  function collapsed() { var s = sel(); return !s || !s.rangeCount || s.getRangeAt(0).collapsed; }
  function atStart(el) { return collapsed() && caretOffset(el) === 0; }
  function atEnd(el) { return collapsed() && caretOffset(el) >= (el.textContent || '').length; }
  function caretRect() {
    var s = sel(); if (!s || !s.rangeCount) return null;
    var r = s.getRangeAt(0).cloneRange(); r.collapse(true);
    var rects = r.getClientRects();
    if (rects && rects.length) return rects[0];
    var span = document.createElement('span'); span.textContent = '​';
    r.insertNode(span); var rect = span.getBoundingClientRect(); span.parentNode.removeChild(span);
    return rect;
  }
  function lineH(el) { var lh = parseFloat(getComputedStyle(el).lineHeight); return isFinite(lh) ? lh : 22; }
  function onFirstLine(el) { var c = caretRect(); if (!c || !c.height) return true; return c.top - el.getBoundingClientRect().top < lineH(el) * 0.75; }
  function onLastLine(el) { var c = caretRect(); if (!c || !c.height) return true; return el.getBoundingClientRect().bottom - c.bottom < lineH(el) * 0.75; }
  /** Separa el contenido desde el cursor hasta el final (lo devuelve como HTML) */
  function splitAtCaret(el) {
    var s = sel(); if (!s.rangeCount) return '';
    var r = s.getRangeAt(0);
    if (!r.collapsed) r.deleteContents();
    var after = document.createRange();
    after.setStart(r.startContainer, r.startOffset);
    after.setEnd(el, el.childNodes.length);
    var frag = after.extractContents(), tmp = document.createElement('div');
    tmp.appendChild(frag);
    return P().sanitize(tmp.innerHTML);
  }
  function html(el) { return P().sanitize(el.innerHTML); }
  function isEmpty(el) { return !(el.textContent || '').replace(/\u200b/g, '').length && !el.querySelector('.mention'); }

  W.Caret = { sel: sel, textNodes: textNodes, inMention: inMention, caretOffset: caretOffset, setCaret: setCaret, collapsed: collapsed, atStart: atStart, atEnd: atEnd, caretRect: caretRect, lineH: lineH, onFirstLine: onFirstLine, onLastLine: onLastLine, splitAtCaret: splitAtCaret, html: html, isEmpty: isEmpty };
})(window.Whider);
