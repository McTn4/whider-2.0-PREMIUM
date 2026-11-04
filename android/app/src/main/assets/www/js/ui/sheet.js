/**
 * WHIDER · Hojas (sheets), alertas y navegación dentro de una hoja.
 * Se cierran con el fondo, arrastrando hacia abajo, con Escape o con el botón Atrás de Android.
 */
window.Whider = window.Whider || {};

(function (W) {
  'use strict';
  var U = W.U;
  var stack = [];

  function root() { return document.getElementById('sheetRoot'); }
  function syncBody() { document.body.classList.toggle('sheet-open', stack.length > 0); }

  /** Botón de cabecera a partir de un nodo o de { text, bold, icon, label, onTap, disabled } */
  function headBtn(spec) {
    if (!spec) return null;
    if (spec.nodeType) return spec;
    var b = U.el('button.nav-btn' + (spec.bold ? '.bold' : ''), { attrs: spec.label ? { 'aria-label': spec.label } : null },
      [spec.icon ? U.icon(spec.icon) : null, spec.text || null]);
    if (spec.disabled) b.disabled = true;
    if (spec.onTap) b.addEventListener('click', spec.onTap);
    return b;
  }

  function enableDrag(sheet, handle, close) {
    var startY = 0, dy = 0, active = false, startT = 0;
    handle.addEventListener('pointerdown', function (e) {
      if (e.target.closest('button, input, textarea, select')) return;
      active = true; startY = e.clientY; dy = 0; startT = performance.now();
      sheet.classList.add('dragging');
      try { handle.setPointerCapture(e.pointerId); } catch (err) { /* sin captura */ }
    });
    handle.addEventListener('pointermove', function (e) {
      if (!active) return;
      dy = Math.max(0, e.clientY - startY);
      sheet.style.transform = 'translate3d(0,' + dy + 'px,0)';
    });
    var end = function () {
      if (!active) return;
      active = false;
      sheet.classList.remove('dragging');
      var fast = dy / Math.max(1, performance.now() - startT) > 0.6;
      if (dy > sheet.offsetHeight * 0.25 || (fast && dy > 40)) close();
      else sheet.style.transform = '';
    };
    handle.addEventListener('pointerup', end);
    handle.addEventListener('pointercancel', end);
  }

  var Sheet = {
    /**
     * open({ title, body, foot, lead, trail, full, className, onClose, dismissible, guard, onGuard })
     * Devuelve { el, body, close, setTitle, setLead, setTrail }
     */
    open: function (o) {
      var layer = U.el('div.sheet-layer');
      var scrim = U.el('div.sheet-scrim');
      var title = U.el('h3', { text: o.title || '' });
      var lead = U.el('div.sh-lead'), trail = U.el('div.sh-trail');
      var head = U.el('div.sheet-head', [lead, title, trail]);
      var body = U.el('div.sheet-body', o.body);
      var sheet = U.el('div.sheet' + (o.full ? '.full' : '') + (o.className ? '.' + o.className : ''),
        { attrs: { role: 'dialog', 'aria-modal': 'true', 'aria-label': o.title || 'Diálogo' } },
        [U.el('div.sheet-grip'), head, body, o.foot ? U.el('div.sheet-foot', o.foot) : null]);
      layer.appendChild(scrim);
      layer.appendChild(sheet);
      root().appendChild(layer);

      var closed = false;
      var closeBtn = U.el('button.circle-btn', { attrs: { 'aria-label': 'Cerrar' }, on: { click: function () { api.close(); } } }, [U.icon('close')]);
      var api = {
        el: sheet, body: body, back: null,
        /** Cierre "suave" (fondo, arrastre, Atrás): si hay cambios sin guardar, se pregunta antes */
        dismiss: function () {
          if (o.guard && o.guard()) { sheet.style.transform = ''; if (o.onGuard) o.onGuard(); return; }
          api.close();
        },
        setTitle: function (t) { title.textContent = t || ''; sheet.setAttribute('aria-label', t || 'Diálogo'); },
        setLead: function (spec) { U.clear(lead); var b = headBtn(spec); if (b) lead.appendChild(b); },
        setTrail: function (spec) { U.clear(trail); var b = spec === 'close' ? closeBtn : headBtn(spec); if (b) trail.appendChild(b); },
        close: function (result) {
          if (closed) return;
          closed = true;
          stack = stack.filter(function (s) { return s !== api; });
          syncBody();
          layer.classList.remove('open');
          sheet.style.transform = '';
          if (o.onClose) try { o.onClose(result); } catch (e) { console.error(e); }
          setTimeout(function () { if (layer.parentNode) layer.parentNode.removeChild(layer); }, 440);
        }
      };
      api.setLead(o.lead);
      api.setTrail(o.trail !== undefined ? o.trail : (o.lead ? null : 'close'));
      if (o.dismissible !== false) {
        scrim.addEventListener('click', function () { api.dismiss(); });
        enableDrag(sheet, head, function () { api.dismiss(); });
      }
      stack.push(api);
      syncBody();
      requestAnimationFrame(function () { requestAnimationFrame(function () { layer.classList.add('open'); }); });
      return api;
    },

    isOpen: function () { return stack.length > 0 || (W.Menu && W.Menu.isOpen()); },
    /** Atrás: menú → página anterior de la hoja → hoja/alerta superior */
    closeTop: function () {
      if (W.Menu && W.Menu.close()) return true;
      if (!stack.length) return false;
      var top = stack[stack.length - 1];
      if (top.back && top.back()) return true;
      if (top.dismiss) top.dismiss(); else top.close();
      return true;
    },

    /**
     * Navegación por páginas dentro de una hoja (como Ajustes).
     * page(nav) → { title, body: [nodos], trail }
     */
    navigator: function (rootPage, opts) {
      opts = opts || {};
      var entries = [];
      var done = 'close';
      var s = Sheet.open({ title: '', body: [], full: opts.full !== false, className: 'nav-sheet', onClose: opts.onClose, lead: null, trail: done });
      var nav = {
        sheet: s,
        push: function (page) { var cur = entries[entries.length - 1]; if (cur) cur.scroll = s.body.scrollTop; entries.push({ page: page }); render(1); },
        pop: function () { if (entries.length < 2) return false; entries.pop(); render(-1); return true; },
        refresh: function () { render(0); },
        close: function () { s.close(); },
        depth: function () { return entries.length; }
      };
      function render(dir) {
        var e = entries[entries.length - 1];
        var keep = dir === 0 ? s.body.scrollTop : (dir < 0 ? e.scroll || 0 : 0);
        var p = e.page(nav) || {};
        e.title = p.title || '';
        s.setTitle(e.title);
        var prev = entries.length > 1 ? entries[entries.length - 2] : null;
        if (prev) {
          var label = prev.title && prev.title.length <= 14 ? prev.title : 'Atrás';
          s.setLead({ icon: 'back', text: label, label: 'Volver a ' + (prev.title || 'la página anterior'), onTap: function () { nav.pop(); } });
          var b = s.el.querySelector('.sh-lead .nav-btn'); if (b) b.classList.add('back');
        } else s.setLead(opts.lead || null);
        s.setTrail(p.trail !== undefined ? p.trail : done);
        U.clear(s.body);
        U.append(s.body, p.body);
        s.body.classList.remove('paging', 'paging-back');
        if (dir && !U.reducedMotion()) { void s.body.offsetWidth; s.body.classList.add(dir > 0 ? 'paging' : 'paging-back'); }
        s.body.scrollTop = keep;
      }
      s.back = function () { return nav.pop(); };
      entries.push({ page: rootPage });
      render(0);
      return nav;
    },

    /** Elegir una opción. Con `anchor`, como menú contextual; sin él, en una hoja (listas largas). */
    choose: function (o) {
      if (o.anchor && W.Menu && o.options.length <= 9) return W.Menu.choose(o.anchor, o);
      return new Promise(function (resolve) {
        var chosen;
        var cells = o.options.map(function (op) {
          var lead = op.icon ? W.UI.cellIcon(op.icon) : null;
          return U.el('button.cell' + (op.value === o.value ? '.active' : '') + (op.icon ? '.has-icon' : ''), { on: { click: function () {
            chosen = op.value; s.close();
          } } }, [
            lead,
            U.el('span.cell-main', [U.el('span.cell-title', { text: op.label }), op.desc ? U.el('span.cell-sub', { text: op.desc }) : null]),
            U.icon('check', 'tick')
          ]);
        });
        var s = Sheet.open({ title: o.title, body: [U.el('div.group.options', cells)].concat(o.extra || []), onClose: function () { resolve(chosen); } });
      });
    },

    /** Confirmación (tarjeta centrada, sin adornos). confirm({ title, text, ok, cancel, danger }) → Promise<boolean> */
    confirm: function (o) {
      return new Promise(function (resolve) {
        var result = false, closed = false;
        var layer = U.el('div.alert-layer', { attrs: { role: 'alertdialog', 'aria-modal': 'true', 'aria-label': o.title } });
        var okLabel = o.ok || 'Aceptar', cancelLabel = o.cancel || 'Cancelar';
        var stackBtns = okLabel.length + cancelLabel.length > 24;
        var api = {
          close: function () {
            if (closed) return;
            closed = true;
            stack = stack.filter(function (s) { return s !== api; });
            layer.classList.remove('open');
            setTimeout(function () { if (layer.parentNode) layer.parentNode.removeChild(layer); }, 260);
            resolve(result);
          }
        };
        var cancel = U.el('button.btn.ghost', { text: cancelLabel, on: { click: function () { api.close(); } } });
        var ok = U.el('button.btn.' + (o.danger ? 'danger-fill' : 'primary'), { text: okLabel, on: { click: function () { result = true; api.close(); } } });
        layer.appendChild(U.el('div.alert-scrim', { on: { click: function () { api.close(); } } }));
        layer.appendChild(U.el('div.alert', [
          U.el('div.alert-title', { text: o.title }),
          o.text ? U.el('div.alert-text', { text: o.text }) : null,
          U.el('div.alert-actions' + (stackBtns ? '.stack' : ''), [cancel, ok])
        ]));
        root().appendChild(layer);
        stack.push(api);
        requestAnimationFrame(function () { requestAnimationFrame(function () { layer.classList.add('open'); }); });
      });
    },

    /** Pedir un texto: prompt({ title, text, value, placeholder, maxLength, ok, extra }) → Promise<string|null> */
    prompt: function (o) {
      return new Promise(function (resolve) {
        var result = null;
        var input = U.el('input.cell-input', { attrs: { type: o.type || 'text', maxlength: o.maxLength || 40, placeholder: o.placeholder || '', enterkeyhint: 'done', 'aria-label': o.title } });
        input.value = o.value || '';
        var submit = function () {
          var v = input.value.trim();
          if (!v) { input.focus(); return; }
          result = v; s.close();
        };
        input.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); submit(); } });
        var s = Sheet.open({
          title: o.title,
          body: [o.text ? U.el('p.sheet-lead-text', { text: o.text }) : null, U.el('div.group', [U.el('label.cell', [input])])].concat(o.extra || []),
          foot: [U.el('button.btn.primary', { text: o.ok || 'Aceptar', on: { click: submit } })],
          onClose: function () { resolve(result); }
        });
        setTimeout(function () { input.focus(); }, 420);
      });
    }
  };

  W.Sheet = Sheet;
})(window.Whider);
