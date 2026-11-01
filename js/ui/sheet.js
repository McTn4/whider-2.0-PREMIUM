/**
 * WHIDER · Hojas inferiores (bottom sheets): genéricas, selección, confirmación y texto.
 * Se cierran con el fondo, arrastrando hacia abajo, con Escape o con el botón Atrás de Android.
 */
window.Whider = window.Whider || {};

(function (W) {
  'use strict';
  var U = W.U;
  var stack = [];

  function root() { return document.getElementById('sheetRoot'); }

  function enableDrag(layer, sheet, handles, close) {
    var startY = 0, dy = 0, active = false, startT = 0;
    handles.forEach(function (h) {
      h.addEventListener('pointerdown', function (e) {
        if (e.target.closest('button, input, textarea, select')) return;
        active = true; startY = e.clientY; dy = 0; startT = performance.now();
        sheet.classList.add('dragging');
        try { h.setPointerCapture(e.pointerId); } catch (err) { /* sin captura */ }
      });
      h.addEventListener('pointermove', function (e) {
        if (!active) return;
        dy = Math.max(0, e.clientY - startY);
        sheet.style.transform = 'translate3d(0,' + dy + 'px,0)';
      });
      var end = function () {
        if (!active) return;
        active = false;
        sheet.classList.remove('dragging');
        var fast = dy / Math.max(1, performance.now() - startT) > 0.6;
        if (dy > sheet.offsetHeight * 0.28 || (fast && dy > 40)) close();
        else sheet.style.transform = '';
      };
      h.addEventListener('pointerup', end);
      h.addEventListener('pointercancel', end);
    });
  }

  var Sheet = {
    /**
     * open({ title, body: Node|[Node], foot: [Node], className, onClose, dismissible })
     * Devuelve { close, el, body }
     */
    open: function (o) {
      var layer = U.el('div.sheet-layer');
      var scrim = U.el('div.sheet-scrim');
      var grip = U.el('div.sheet-grip');
      var head = o.title != null ? U.el('div.sheet-head', [
        U.el('h3', { text: o.title }),
        o.headAction || U.el('button.icon-btn', { attrs: { 'aria-label': 'Cerrar' }, on: { click: function () { api.close(); } } }, [U.icon('close', 'sm')])
      ]) : null;
      var body = U.el('div.sheet-body', o.body);
      var sheet = U.el('div.sheet' + (o.className ? '.' + o.className : ''), { attrs: { role: 'dialog', 'aria-modal': 'true', 'aria-label': o.title || 'Diálogo' } },
        [grip, head, body, o.foot ? U.el('div.sheet-foot', o.foot) : null]);
      layer.appendChild(scrim);
      layer.appendChild(sheet);
      root().appendChild(layer);

      var closed = false;
      var api = {
        el: sheet, body: body,
        close: function (result) {
          if (closed) return;
          closed = true;
          stack = stack.filter(function (s) { return s !== api; });
          layer.classList.remove('open');
          sheet.style.transform = '';
          if (o.onClose) try { o.onClose(result); } catch (e) { console.error(e); }
          setTimeout(function () { if (layer.parentNode) layer.parentNode.removeChild(layer); }, 420);
          if (!stack.length && W.App) W.App.setFab(false);
        }
      };
      if (o.dismissible !== false) {
        scrim.addEventListener('click', function () { api.close(); });
        enableDrag(layer, sheet, [grip].concat(head ? [head] : []), function () { api.close(); });
      }
      stack.push(api);
      requestAnimationFrame(function () { requestAnimationFrame(function () { layer.classList.add('open'); }); });
      W.Audio.tap();
      return api;
    },

    isOpen: function () { return stack.length > 0; },
    closeTop: function () {
      if (!stack.length) return false;
      stack[stack.length - 1].close();
      return true;
    },

    /** Lista de opciones; devuelve una promesa con el valor elegido (o undefined) */
    choose: function (o) {
      return new Promise(function (resolve) {
        var chosen;
        var opts = U.el('div.options', o.options.map(function (op) {
          var lead = op.color ? U.el('span.dot', { style: { '--c': op.color } }) : (op.icon ? U.el('span.row-icon', [U.icon(op.icon)]) : null);
          return U.el('button.option' + (op.value === o.value ? '.active' : ''), { on: { click: function () {
            chosen = op.value; W.Audio.tap(); s.close();
          } } }, [
            lead,
            U.el('span.opt-main', [U.el('div.opt-label', { text: op.label }), op.desc ? U.el('div.opt-desc', { text: op.desc }) : null]),
            U.icon('check', 'tick')
          ]);
        }));
        var s = Sheet.open({ title: o.title, body: [opts].concat(o.extra || []), onClose: function () { resolve(chosen); } });
      });
    },

    /** Confirmación con estilo de la app (sustituye a window.confirm) */
    confirm: function (o) {
      return new Promise(function (resolve) {
        var result = false;
        var s = Sheet.open({
          className: 'center-dialog',
          body: [
            U.el('div.dialog-icon' + (o.danger ? '.danger' : ''), [U.icon(o.icon || (o.danger ? 'trash' : 'info'))]),
            U.el('h3', { text: o.title, style: { fontFamily: 'var(--font-display)', fontSize: '1.2rem' } }),
            o.text ? U.el('p', { text: o.text, style: { color: 'var(--t2)', fontSize: '.9rem', lineHeight: '1.5' } }) : null
          ],
          foot: [
            U.el('button.btn.ghost', { text: o.cancel || 'Cancelar', on: { click: function () { s.close(); } } }),
            U.el('button.btn.' + (o.danger ? 'danger' : 'primary'), { text: o.ok || 'Aceptar', on: { click: function () { result = true; s.close(); } } })
          ],
          onClose: function () { resolve(result); }
        });
      });
    },

    /** Pide un texto */
    prompt: function (o) {
      return new Promise(function (resolve) {
        var result = null;
        var input = U.el('input.input', { attrs: { type: 'text', maxlength: o.maxLength || 40, placeholder: o.placeholder || '', value: o.value || '', enterkeyhint: 'done' } });
        var submit = function () { var v = input.value.trim(); if (!v) { input.focus(); return; } result = v; s.close(); };
        input.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); submit(); } });
        var s = Sheet.open({
          title: o.title,
          body: [o.text ? U.el('p', { text: o.text, style: { color: 'var(--t2)', fontSize: '.88rem' } }) : null, input].concat(o.extra || []),
          foot: [
            U.el('button.btn.ghost', { text: 'Cancelar', on: { click: function () { s.close(); } } }),
            U.el('button.btn.primary', { text: o.ok || 'Guardar', on: { click: submit } })
          ],
          onClose: function () { resolve(result); }
        });
        setTimeout(function () { input.focus(); }, 380);
      });
    }
  };

  W.Sheet = Sheet;
})(window.Whider);
