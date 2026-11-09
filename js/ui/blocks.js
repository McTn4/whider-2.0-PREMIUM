/**
 * WHIDER · Editor por bloques del Cuaderno
 *
 * Cada párrafo, título, lista o casilla es un bloque. Como en los mejores editores:
 *  - «/» abre el menú de bloques (con búsqueda) y «@» menciona páginas, personas, fechas o tareas.
 *  - Atajos de Markdown al escribir: «# », «## », «- », «1. », «[] », «> », «" », «```», «---».
 *  - Intro parte el bloque, Retroceso al principio lo une con el anterior, Tab y Mayús+Tab sangran.
 *  - Barra de formato al seleccionar (negrita, cursiva, subrayado, tachado, código, resaltado y enlace).
 *  - Arrastrar bloques por su asa (ordenador) y menú de cada bloque (duplicar, convertir, mover…).
 *  - Deshacer y rehacer (Ctrl Z / Ctrl Mayús Z) también con los cambios de estructura.
 *  - En el móvil, una barra sobre el teclado con lo más útil.
 * Se guarda solo (y se sincroniza) unos instantes después de dejar de escribir.
 */
window.Whider = window.Whider || {};

(function (W) {
  'use strict';
  var U = W.U, P = function () { return W.Pages; };
  var DRAG = 'text/x-whider-block';
  var PH = { p: 'Escribe o pulsa «/» para elegir un bloque', h1: 'Título 1', h2: 'Título 2', h3: 'Título 3', ul: 'Lista', ol: 'Lista', todo: 'Tarea', toggle: 'Desplegable', quote: 'Cita', callout: 'Escribe algo importante…', code: 'Código' };
  var LIST_TYPES = { ul: 1, ol: 1, todo: 1, toggle: 1 };
  var CONT_TYPES = { ul: 1, ol: 1, todo: 1 }; // Intro crea otro igual
  var MD = [
    { re: /^###\s$/, t: 'h3' }, { re: /^##\s$/, t: 'h2' }, { re: /^#\s$/, t: 'h1' },
    { re: /^[-*+]\s$/, t: 'ul' }, { re: /^1[.)]\s$/, t: 'ol' }, { re: /^\[\s?\]\s$/, t: 'todo' }, { re: /^\[x\]\s$/i, t: 'todo', c: true },
    { re: /^>\s$/, t: 'toggle' }, { re: /^["“]\s$/, t: 'quote' }, { re: /^!\s$/, t: 'callout' }
  ];

  /* ---------- Cursor ---------- */
  function sel() { return window.getSelection(); }
  function textNodes(el) {
    var out = [], w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null), n;
    while ((n = w.nextNode())) out.push(n);
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
  function isEmpty(el) { return !(el.textContent || '').replace(/​/g, '').length && !el.querySelector('.mention'); }

  /* ---------- Editor ---------- */
  /**
   * editor({ pageId, readOnly, onTitleFocus, onOpenPage }) → { el, focus(where), destroy(), reload() }
   */
  function editor(o) {
    var pageId = o.pageId, ro = !!o.readOnly;
    var root = U.el('div.bk-editor' + (ro ? '.ro' : ''), { attrs: { 'data-page': pageId } });
    var blocks = JSON.parse(JSON.stringify(P().content(pageId).blocks));
    var els = {};
    var saveT = null, histT = null, history = [], future = [], lastSnap = '';
    var slash = null, mention = null, toolbar = null, dropLine = null, dragId = null, selBlock = null, lastFocus = null;
    var destroyed = false;

    /* -- Guardado e historial -- */
    function snapshot() { return JSON.stringify(blocks); }
    function pushHistory(force) {
      var s = snapshot();
      if (!force && s === lastSnap) return;
      history.push({ blocks: lastSnap || s, focus: focusInfo() });
      if (history.length > 120) history.shift();
      future = [];
      lastSnap = s;
    }
    function focusInfo() {
      var a = document.activeElement, bel = a && a.closest ? a.closest('.bk') : null;
      if (!bel || !root.contains(bel)) return null;
      var t = bel.querySelector('[contenteditable="true"]');
      return { id: bel.getAttribute('data-id'), off: t ? caretOffset(t) : 0 };
    }
    function save(now) {
      clearTimeout(saveT);
      var run = function () { if (!destroyed && !ro) P().setBlocks(pageId, blocks, { silent: true }); if (o.onSaved) o.onSaved(); };
      if (now) run(); else saveT = setTimeout(run, 450);
      clearTimeout(histT); histT = setTimeout(function () { pushHistory(false); }, 650);
    }
    function structural() { pushHistory(true); }
    function undo() {
      if (!history.length) return;
      var h = history.pop();
      future.push({ blocks: snapshot(), focus: focusInfo() });
      blocks = JSON.parse(h.blocks); lastSnap = h.blocks;
      renderAll(); save(true);
      if (h.focus) focusId(h.focus.id, h.focus.off);
    }
    function redo() {
      if (!future.length) return;
      var f = future.pop();
      history.push({ blocks: snapshot(), focus: focusInfo() });
      blocks = JSON.parse(f.blocks); lastSnap = f.blocks;
      renderAll(); save(true);
      if (f.focus) focusId(f.focus.id, f.focus.off);
    }

    /* -- Utilidades del modelo -- */
    function indexOf(b) { return blocks.indexOf(b); }
    function byId(id) { for (var i = 0; i < blocks.length; i++) if (blocks[i].id === id) return blocks[i]; return null; }
    /** Hijos de un bloque: los siguientes con más sangría */
    function childrenOf(b) {
      var i = indexOf(b), out = [], ind = b.i || 0;
      for (var k = i + 1; k < blocks.length && (blocks[k].i || 0) > ind; k++) out.push(blocks[k]);
      return out;
    }
    function newBlock(t, x, extra) { return P().block(t || 'p', x || '', extra); }
    function textEl(b) { var e = els[b.id]; return e ? e.querySelector('[contenteditable="true"]') : null; }
    function isText(b) { return !!(P().BLOCKS[b.t] && P().BLOCKS[b.t].text); }
    function prevText(b) { for (var i = indexOf(b) - 1; i >= 0; i--) if (isText(blocks[i]) && visible(blocks[i])) return blocks[i]; return null; }
    function nextText(b) { for (var i = indexOf(b) + 1; i < blocks.length; i++) if (isText(blocks[i]) && visible(blocks[i])) return blocks[i]; return null; }
    function visible(b) { var e = els[b.id]; return !e || !e.classList.contains('bk-hidden'); }

    /* -- Pintado -- */
    function renderAll() {
      U.clear(root); els = {};
      blocks.forEach(function (b) { root.appendChild(renderBlock(b)); });
      if (!ro) root.appendChild(tail);
      decorate();
    }
    var tail = U.el('div.bk-tail', { attrs: { title: 'Añadir un bloque al final' }, on: { click: function () {
      var last = blocks[blocks.length - 1];
      if (last && isText(last) && isEmpty(textEl(last) || document.createElement('div')) && last.t === 'p') { focusBlock(last, 'end'); return; }
      structural();
      var nb = newBlock('p'); blocks.push(nb); root.insertBefore(renderBlock(nb), tail); decorate(); focusBlock(nb, 'start'); save();
    } } });

    function decorate() {
      var counters = [], hideUntil = null;
      blocks.forEach(function (b, i) {
        var e = els[b.id]; if (!e) return;
        var ind = b.i || 0;
        e.style.setProperty('--i', ind);
        // Ocultos dentro de un desplegable cerrado
        if (hideUntil != null && ind > hideUntil) e.classList.add('bk-hidden');
        else { e.classList.remove('bk-hidden'); hideUntil = null; }
        if (b.t === 'toggle' && !b.o && hideUntil == null) hideUntil = ind;
        // Numeración
        counters.length = ind + 1;
        if (b.t === 'ol') {
          var prev = blocks[i - 1], cont = prev && prev.t === 'ol' && (prev.i || 0) === ind;
          if (!cont) { for (var k = i - 1; k >= 0; k--) { var pk = blocks[k]; if ((pk.i || 0) < ind) break; if ((pk.i || 0) === ind) { cont = pk.t === 'ol'; break; } } }
          counters[ind] = cont && counters[ind] ? counters[ind] + 1 : 1;
          var nEl = e.querySelector('.bk-num'); if (nEl) nEl.textContent = (ind % 3 === 1 ? String.fromCharCode(96 + ((counters[ind] - 1) % 26) + 1) : ind % 3 === 2 ? roman(counters[ind]) : counters[ind]) + '.';
        } else counters[ind] = 0;
        if (b.t === 'toggle') {
          var kids = childrenOf(b).length;
          e.classList.toggle('has-kids', !!kids);
          var emptyHint = e.querySelector('.bk-toggle-empty'); if (emptyHint) emptyHint.hidden = !!kids || !b.o || ro;
        }
        var t = e.querySelector('[contenteditable]');
        if (t && t.classList.contains('bk-text')) t.classList.toggle('is-empty', isEmpty(t));
        if (b.t === 'toc') fillToc(e);
      });
    }
    function roman(n) { var r = ['i', 'ii', 'iii', 'iv', 'v', 'vi', 'vii', 'viii', 'ix', 'x']; return r[(n - 1) % 10]; }

    function editable(b, cls, ph) {
      var t = U.el('div.bk-text' + (cls ? '.' + cls : ''), { attrs: { contenteditable: ro ? 'false' : 'true', 'data-ph': ph || PH[b.t] || '', spellcheck: b.t === 'code' ? 'false' : 'true', role: 'textbox', 'aria-multiline': 'true' } });
      if (b.t === 'code') t.textContent = P().plain(b.x || ''); else t.innerHTML = b.x || '';
      return t;
    }
    function renderBlock(b) {
      var e = U.el('div.bk.bk-' + b.t, { attrs: { 'data-id': b.id, 'data-t': b.t } });
      e._b = b; els[b.id] = e;
      var gutter = ro ? null : U.el('div.bk-gutter', [
        U.el('button.bk-plus', { attrs: { type: 'button', tabindex: '-1', 'aria-label': 'Añadir bloque debajo', title: 'Añadir debajo (Alt clic: encima)' }, on: { click: function (ev) { ev.preventDefault(); addBelow(b, ev.altKey); } } }, [U.icon('plus')]),
        U.el('button.bk-handle', { attrs: { type: 'button', tabindex: '-1', draggable: 'true', 'aria-label': 'Mover o abrir el menú del bloque', title: 'Arrastra para mover · clic para opciones' }, on: {
          click: function (ev) { ev.preventDefault(); blockMenu(b, ev.currentTarget); },
          dragstart: function (ev) { dragId = b.id; ev.dataTransfer.effectAllowed = 'move'; ev.dataTransfer.setData(DRAG, b.id); try { ev.dataTransfer.setDragImage(e, 10, 10); } catch (x) { /* sin imagen */ } e.classList.add('dragging'); },
          dragend: function () { dragId = null; e.classList.remove('dragging'); hideDrop(); }
        } }, [U.icon('grip')])
      ]);
      var body = U.el('div.bk-body');
      switch (b.t) {
        case 'ul': body.appendChild(U.el('span.bk-mark.bk-bullet', { attrs: { 'aria-hidden': 'true' } })); body.appendChild(editable(b)); break;
        case 'ol': body.appendChild(U.el('span.bk-mark.bk-num', { attrs: { 'aria-hidden': 'true' }, text: '1.' })); body.appendChild(editable(b)); break;
        case 'todo':
          var chk = U.el('button.bk-check' + (b.c ? '.on' : ''), { attrs: { type: 'button', 'aria-label': b.c ? 'Desmarcar' : 'Marcar como hecho', 'aria-pressed': b.c ? 'true' : 'false', disabled: ro } }, [U.svg('svg', { viewBox: '0 0 24 24' }, [U.svg('path', { d: 'm5 12.6 4.5 4.5L19 7.6' })])]);
          chk.addEventListener('click', function () { structural(); b.c = !b.c; chk.classList.toggle('on', b.c); e.classList.toggle('done', b.c); if (b.c) { W.Audio.success(); W.Audio.vibrate([8]); } save(); });
          e.classList.toggle('done', !!b.c);
          body.appendChild(chk); body.appendChild(editable(b)); break;
        case 'toggle':
          var arrow = U.el('button.bk-arrow' + (b.o ? '.open' : ''), { attrs: { type: 'button', 'aria-label': b.o ? 'Plegar' : 'Desplegar', 'aria-expanded': b.o ? 'true' : 'false' } }, [U.icon('right')]);
          arrow.addEventListener('click', function () { b.o = !b.o; arrow.classList.toggle('open', b.o); arrow.setAttribute('aria-expanded', b.o ? 'true' : 'false'); decorate(); save(); });
          body.appendChild(arrow); body.appendChild(editable(b));
          e.appendChild(U.el('button.bk-toggle-empty', { attrs: { type: 'button' }, text: 'Desplegable vacío. Toca para escribir dentro.', on: { click: function () { structural(); var nb = newBlock('p', '', { i: (b.i || 0) + 1 }); insertAt(indexOf(b) + 1, nb); focusBlock(nb, 'start'); save(); } } }));
          break;
        case 'callout':
          var ic = U.el('button.bk-callout-ic', { attrs: { type: 'button', 'aria-label': 'Cambiar el icono', disabled: ro } }, [U.icon(b.ic || 'bolt')]);
          ic.addEventListener('click', function (ev) { iconMenu(ev.currentTarget, b.ic, function (v) { structural(); b.ic = v; U.clear(ic); ic.appendChild(U.icon(v)); save(); }); });
          body.appendChild(ic); body.appendChild(editable(b)); break;
        case 'code':
          var lang = U.el('button.bk-lang', { attrs: { type: 'button', disabled: ro }, text: b.l || 'Texto', on: { click: function (ev) {
            var L = ['Texto', 'JavaScript', 'Python', 'HTML', 'CSS', 'JSON', 'SQL', 'Java', 'C', 'Bash'];
            W.Menu.open(ev.currentTarget, L.map(function (x) { return { value: x, label: x, on: (b.l || 'Texto') === x }; })).then(function (v) { if (!v) return; b.l = v === 'Texto' ? '' : v; lang.textContent = v; save(); });
          } } });
          var copy = U.el('button.bk-copy', { attrs: { type: 'button', 'aria-label': 'Copiar el código', title: 'Copiar' }, on: { click: function () { copyText(textEl(b).textContent); } } }, [U.icon('copy')]);
          body.appendChild(U.el('div.bk-code-bar', [lang, copy]));
          body.appendChild(editable(b, 'bk-codetext'));
          break;
        case 'hr': body.appendChild(U.el('div.bk-hr', { attrs: { tabindex: '0', role: 'separator' } })); break;
        case 'page': body.appendChild(pageLink(b)); break;
        case 'db': body.appendChild(dbBlock(b)); break;
        case 'task': body.appendChild(taskBlock(b)); break;
        case 'agenda': body.appendChild(agendaBlock(b)); break;
        case 'toc': body.appendChild(U.el('div.bk-toc')); break;
        case 'img': body.appendChild(imageBlock(b)); break;
        case 'file': body.appendChild(fileBlock(b)); break;
        case 'bookmark': body.appendChild(bookmarkBlock(b)); break;
        case 'table': body.appendChild(tableBlock(b)); break;
        default: body.appendChild(editable(b));
      }
      if (gutter) e.appendChild(gutter);
      e.insertBefore(body, e.querySelector('.bk-toggle-empty'));
      return e;
    }

    /* -- Bloques especiales -- */
    function pageLink(b) {
      var m = b.ref ? P().get(b.ref) : null;
      var a = U.el('button.bk-pagelink' + (m && m.trash ? '.gone' : ''), { attrs: { type: 'button' } }, [
        U.el('span.bk-pl-ic', [U.icon(m ? (m.icon || (m.kind === 'db' ? 'database' : 'page')) : 'page')]),
        U.el('span.bk-pl-t', { text: m ? P().title(m) : 'Página no encontrada' }),
        m && m.trash ? U.el('small', { text: 'En la papelera' }) : U.icon('right', 'bk-pl-go')
      ]);
      a.addEventListener('click', function () { if (m && !m.trash && o.onOpenPage) { save(true); o.onOpenPage(m.id); } });
      return a;
    }
    function dbBlock(b) {
      var host = U.el('div.bk-db', { attrs: { contenteditable: 'false' } });
      if (!b.ref || !P().get(b.ref) || P().get(b.ref).trash) { host.appendChild(U.el('div.bk-missing', { text: 'Esta base de datos ya no existe.' })); return host; }
      if (W.DbView) host.appendChild(W.DbView.render(b.ref, { inline: true, view: b.view, readOnly: ro, onOpenPage: o.onOpenPage, onView: function (v) { b.view = v; save(); } }));
      return host;
    }
    function taskBlock(b) {
      var t = b.ref ? W.State.find(b.ref) : null;
      if (!t) {
        if (ro) return U.el('div.bk-missing', { text: 'Tarea' });
        var input = U.el('input.bk-task-input', { attrs: { type: 'text', maxlength: 200, placeholder: 'Escribe la tarea: «Llamar a Ana mañana a las 10 #trabajo»', 'aria-label': 'Nueva tarea' } });
        var create = function () {
          var v = input.value.trim(); if (!v) return;
          var pr = W.Parse.task(v);
          var task = W.State.addTask({ text: pr.text || v, date: pr.date !== undefined ? pr.date : U.today(), time: pr.time || null, listId: pr.listId || null, highlight: pr.highlight || 'none', repeat: pr.repeat || 'none', warn: W.State.settings.defaultWarn, notes: 'Desde el Cuaderno: ' + P().title(pageId) });
          structural(); b.ref = task.id; save(true);
          var fresh = renderBlock(b); els[b.id].parentNode.replaceChild(fresh, els[b.id]); decorate();
          W.Toast.show({ text: 'Tarea creada' + (task.date ? ' para ' + U.fmtDay(task.date) : ''), icon: 'check', type: 'success' });
          var nb = newBlock('p'); insertAt(indexOf(b) + 1, nb); focusBlock(nb, 'start');
        };
        input.addEventListener('keydown', function (ev) { if (ev.key === 'Enter') { ev.preventDefault(); create(); } else if (ev.key === 'Escape') input.blur(); });
        setTimeout(function () { if (document.activeElement === document.body) input.focus(); }, 0);
        return U.el('div.bk-taskrow.new', [U.icon('tasks'), input, U.el('button.btn.xs.primary', { text: 'Crear', on: { click: create } })]);
      }
      var chk = U.el('button.check.sm' + (t.done ? '.on' : ''), { attrs: { 'aria-label': t.done ? 'Desmarcar' : 'Completar' } });
      chk.appendChild(U.svg('svg', { viewBox: '0 0 24 24' }, [U.svg('path', { d: 'm5 12.6 4.5 4.5L19 7.6' })]));
      chk.addEventListener('click', function () { W.State.setDone(t.id, !t.done); if (!t.done) W.Audio.success(); refreshBlock(b); });
      var when = t.date ? U.fmtDay(t.date) + (t.time ? ' · ' + U.fmtTime(t.time) : '') : 'Sin fecha';
      return U.el('div.bk-taskrow' + (t.done ? '.done' : ''), [chk, U.el('button.bk-task-t', { attrs: { type: 'button' }, text: t.text, on: { click: function () { W.Editor.open(t.id); } } }),
        U.el('span.bk-task-when' + (W.State.isOverdue(t) ? '.late' : ''), [U.icon('calendar', 'xs'), when]), W.UI.prio(t.highlight)]);
    }
    function agendaBlock(b) {
      var td = U.today(), st = W.State;
      var list = st.tasks.filter(function (t) { return t.date === td || (!t.done && st.isOverdue(t)); }).sort(function (a, c) { return (a.done - c.done) || ((st.PRIORITIES[a.highlight] || {}).rank - (st.PRIORITIES[c.highlight] || {}).rank) || String(a.time || '99').localeCompare(String(c.time || '99')); });
      var rows = list.slice(0, 12).map(function (t) {
        var chk = U.el('button.check.sm' + (t.done ? '.on' : ''), { attrs: { 'aria-label': t.done ? 'Desmarcar' : 'Completar' } });
        chk.appendChild(U.svg('svg', { viewBox: '0 0 24 24' }, [U.svg('path', { d: 'm5 12.6 4.5 4.5L19 7.6' })]));
        chk.addEventListener('click', function () { st.setDone(t.id, !t.done); if (!t.done) W.Audio.success(); refreshBlock(b); });
        return U.el('div.bk-ag-row' + (t.done ? '.done' : ''), [chk, U.el('button.bk-task-t', { attrs: { type: 'button' }, text: t.text, on: { click: function () { W.Editor.open(t.id); } } }), t.time ? U.el('small', { text: U.fmtTime(t.time) }) : null, W.UI.prio(t.highlight)]);
      });
      return U.el('div.bk-agenda', { attrs: { contenteditable: 'false' } }, [
        U.el('div.bk-ag-head', [U.icon('sun'), U.el('strong', { text: 'Hoy · ' + U.cap(U.fmtDay(td)) }), U.el('span', { text: list.filter(function (t) { return t.done; }).length + '/' + list.length })]),
        rows.length ? U.el('div.bk-ag-list', rows) : U.el('p.bk-ag-none', { text: 'No tienes nada para hoy.' }),
        ro ? null : U.el('button.btn.xs.soft', { on: { click: function () { W.QuickAdd.open({ date: td }); } } }, [U.icon('plus', 'sm'), 'Añadir para hoy'])
      ]);
    }
    function fillToc(e) {
      var host = e.querySelector('.bk-toc'); if (!host) return;
      U.clear(host);
      var hs = blocks.filter(function (x) { return x.t === 'h1' || x.t === 'h2' || x.t === 'h3'; });
      if (!hs.length) { host.appendChild(U.el('span.bk-toc-none', { text: 'Añade títulos y aparecerán aquí.' })); return; }
      hs.forEach(function (h) {
        host.appendChild(U.el('button.bk-toc-i.l' + h.t.slice(1), { attrs: { type: 'button' }, text: P().plain(h.x) || 'Sin título', on: { click: function () { var t = els[h.id]; if (t) { t.scrollIntoView({ behavior: U.reducedMotion() ? 'auto' : 'smooth', block: 'center' }); t.classList.add('flash'); setTimeout(function () { t.classList.remove('flash'); }, 1200); } } } }));
      });
    }
    /* -- Adjuntos: imágenes y archivos (W.Files los guarda aparte; el bloque lleva la referencia) -- */
    function scope() { return W.Files ? W.Files.scopeOf(pageId) : 'me'; }
    function fref(b) { return { f: b.f, n: b.n, m: b.m, s: b.s }; }
    function openAttachment(b) { if (W.Files && b.f) W.Files.open(fref(b), scope(), { onDelete: ro ? null : function () { removeAttachment(b); } }); }
    function imageBlock(b) {
      if (!b.src && !b.f) {
        if (ro) return U.el('div.bk-missing', { text: 'Imagen' });
        return U.el('div.bk-att-empty', [U.el('span.bk-att-empty-ic', [U.icon('image')]), U.el('span.bk-att-empty-t', [U.el('b', { text: 'Añade una imagen' }), U.el('small', { text: 'Desde tu dispositivo, arrastrándola aquí o con un enlace' })]),
          U.el('span.bk-att-empty-acts', [
            U.el('button.btn.xs.soft', { on: { click: function () { pickImage(b); } } }, [U.icon('upload', 'sm'), 'Elegir']),
            U.el('button.btn.xs.ghost', { text: 'Pegar enlace', on: { click: function () {
              W.Sheet.prompt({ title: 'Enlace de la imagen', placeholder: 'https://…', maxLength: 600, ok: 'Añadir' }).then(function (u) { if (!u) return; if (!/^https:\/\//.test(u)) { W.Toast.show({ text: 'El enlace debe empezar por https://', type: 'danger' }); return; } structural(); b.src = u; refreshBlock(b); save(); });
            } } })
          ])]);
      }
      var cap = U.el('figcaption.bk-text', { attrs: { contenteditable: ro ? 'false' : 'true', 'data-ph': 'Añade un pie de foto' } });
      cap.innerHTML = b.x || '';
      var alt = P().plain(b.x || '') || b.n || 'Imagen';
      if (!b.f) return U.el('figure.bk-img', { style: { width: (b.w || 100) + '%' } }, [U.el('img', { attrs: { src: b.src, alt: alt, loading: 'lazy', draggable: 'false' } }), cap]);
      // Imagen guardada como adjunto: hueco con su proporción mientras se carga (sin saltos)
      var box = U.el('div.bk-img-box', { attrs: { 'data-file': b.f } });
      if (b.ar) box.style.aspectRatio = String(b.ar);
      var tools = U.el('span.bk-img-tools', [
        U.el('button.bk-img-tool', { attrs: { type: 'button', 'aria-label': 'Ver en grande', title: 'Ver en grande' }, on: { click: function (e) { e.stopPropagation(); openAttachment(b); } } }, [U.icon('expand')]),
        U.el('button.bk-img-tool', { attrs: { type: 'button', 'aria-label': 'Descargar', title: 'Descargar' }, on: { click: function (e) { e.stopPropagation(); W.Files.download(fref(b), scope()); } } }, [U.icon('download')]),
        ro ? null : U.el('button.bk-img-tool', { attrs: { type: 'button', 'aria-label': 'Quitar la imagen', title: 'Quitar de la página' }, on: { click: function (e) { e.stopPropagation(); removeAttachment(b); } } }, [U.icon('trash')])
      ]);
      var show = function (u) {
        U.clear(box); box.classList.remove('error', 'wait'); box.classList.add('ready');
        var img = U.el('img', { attrs: { src: u, alt: alt, draggable: 'false' } });
        img.addEventListener('click', function () { openAttachment(b); });
        box.appendChild(img); box.appendChild(tools);
      };
      var load = function () {
        var ready = W.Files.peekUrl(b.f);
        if (ready) { show(ready); return; }
        U.clear(box); box.classList.add('wait'); box.classList.remove('error');
        box.appendChild(U.el('span.bk-img-wait', { text: 'Cargando la imagen…' }));
        W.Files.url(b.f, scope()).then(show, function (e) {
          U.clear(box); box.classList.remove('wait'); box.classList.add('error');
          box.appendChild(U.el('div.bk-img-err', [U.icon('image'), U.el('span', { text: W.Files.explain(e, b.n) }), U.el('button.btn.xs.ghost', { text: 'Reintentar', on: { click: function (ev) { ev.stopPropagation(); load(); } } })]));
          if (!ro) box.appendChild(tools);
        });
      };
      box._reload = load;
      load();
      return U.el('figure.bk-img.att', { style: { width: (b.w || 100) + '%' } }, [box, cap]);
    }
    function fileBlock(b) {
      if (!b.f) {
        if (ro) return U.el('div.bk-missing', { text: 'Archivo' });
        return U.el('div.bk-att-empty', [U.el('span.bk-att-empty-ic', [U.icon('paperclip')]), U.el('span.bk-att-empty-t', [U.el('b', { text: 'Adjunta un archivo' }), U.el('small', { text: 'PDF, documentos, hojas de cálculo… hasta ' + W.Files.fmtSize(W.Files.MAX) })]),
          U.el('span.bk-att-empty-acts', [U.el('button.btn.xs.soft', { on: { click: function () { pickInto(b); } } }, [U.icon('upload', 'sm'), 'Elegir archivo'])])]);
      }
      var k = W.Files.kind(b.m, b.n);
      var meta = U.el('small.bkf-meta');
      var card = U.el('div.bkf.k-' + k.k, { attrs: { 'data-file': b.f } }, [
        U.el('button.bkf-main', { attrs: { type: 'button', title: 'Abrir', 'aria-label': 'Abrir ' + (b.n || 'el archivo') }, on: { click: function () { openAttachment(b); } } }, [
          U.el('span.bkf-ic', { attrs: { 'aria-hidden': 'true' } }, [U.icon('file'), U.el('b', { text: k.short })]),
          U.el('span.bkf-t', [U.el('strong', { text: b.n || 'Archivo' }), meta])
        ]),
        U.el('span.bkf-acts', [
          U.el('button.bkf-btn', { attrs: { type: 'button', 'aria-label': 'Descargar ' + (b.n || 'el archivo'), title: 'Descargar' }, on: { click: function () { W.Files.download(fref(b), scope()); } } }, [U.icon('download')]),
          ro ? null : U.el('button.bkf-btn', { attrs: { type: 'button', 'aria-label': 'Quitar ' + (b.n || 'el archivo') + ' de la página', title: 'Quitar de la página' }, on: { click: function () { removeAttachment(b); } } }, [U.icon('trash')])
        ])
      ]);
      paintStatus(card, b);
      return card;
    }
    /**
     * Línea de estado de un archivo. El tipo ya lo dice la etiqueta del icono: aquí, el tipo en
     * palabras solo si no hay nada más que contar; si no, el tamaño y si se sube, se baja o está aquí.
     */
    function paintStatus(card, b) {
      var meta = card.querySelector('.bkf-meta'); if (!meta) return;
      var st = W.Files.status(b.f, scope()), size = b.s ? W.Files.fmtSize(b.s) : '', note = '';
      card.classList.remove('busy', 'warn');
      if (st.s === 'up') { note = 'Subiendo ' + Math.round((st.p || 0) * 100) + ' %'; card.classList.add('busy'); }
      else if (st.s === 'down') { note = 'Descargando ' + Math.round((st.p || 0) * 100) + ' %'; card.classList.add('busy'); }
      else if (st.s === 'local') note = W.Files.canSync() ? 'Pendiente de subir' : 'En este dispositivo';
      else if (st.s === 'none') { note = W.Files.short(st.code); card.classList.add('warn'); }
      meta.textContent = (note ? [size, note] : [W.Files.kind(b.m, b.n).label, size]).filter(Boolean).join(' · ');
    }
    /** Quitar un adjunto: sin preguntar y con «Deshacer» (el archivo se borra días después si nadie lo usa) */
    function removeAttachment(b) {
      if (ro || indexOf(b) < 0) return;
      var i = indexOf(b), copy = JSON.parse(JSON.stringify(b)), name = b.n || (b.t === 'img' ? 'La imagen' : 'El archivo');
      structural();
      removeBlock(b);
      if (!blocks.length) insertAt(0, newBlock('p'));
      // Acciones sueltas: se guardan al momento (no hay más escritura que esperar)
      save(true);
      W.Toast.show({ text: (b.n ? '«' + name + '»' : name) + ' se ha quitado de la página', icon: 'trash', action: { label: 'Deshacer', fn: function () {
        if (destroyed || byId(copy.id)) return;
        structural(); insertAt(Math.min(i, blocks.length), copy); save(true);
      } } });
    }
    function pickImage(b) {
      if (!W.Files) return;
      W.Files.pick({ accept: 'image/*' }).then(function (files) { if (files.length) attachFiles(files.slice(0, 1), b, { image: true }); });
    }
    function pickInto(b) {
      if (!W.Files) return;
      W.Files.pick({ multiple: true }).then(function (files) { if (files.length) attachFiles(files, b); });
    }
    function emptyText(b) { var t = textEl(b); return b.t === 'p' && (t ? isEmpty(t) : !P().plain(b.x || '').trim()); }
    /**
     * Añade archivos a la página, en orden: las fotos como imagen (con vista previa) y lo demás como
     * archivo (con nombre y tipo). target: un bloque de imagen o archivo vacío que se rellena, o el
     * bloque junto al que van (detrás; delante si opts.before o si es una línea vacía).
     */
    function attachFiles(list, target, opts) {
      opts = opts || {};
      if (ro || !W.Files || !list || !list.length) return Promise.resolve();
      var fill = target && (target.t === 'img' || target.t === 'file') && !target.f && !target.src ? target : null;
      var last = null;
      var position = function () {
        if (last && indexOf(last) >= 0) return indexOf(last) + 1;
        if (target && indexOf(target) >= 0) {
          if (opts.before || emptyText(target)) return indexOf(target);
          return indexOf(target) + 1 + childrenOf(target).length;
        }
        var end = blocks[blocks.length - 1];
        return end && emptyText(end) ? indexOf(end) : blocks.length;
      };
      var big = list.length > 1 || list[0].size > 1500000;
      if (big) W.Toast.show({ text: list.length > 1 ? 'Añadiendo ' + list.length + ' archivos…' : 'Añadiendo «' + list[0].name + '»…', icon: 'paperclip', duration: 2200 });
      return list.reduce(function (pr, file) {
        return pr.then(function () {
          return W.Files.add(file, { scope: scope(), image: opts.image !== false }).then(function (r) {
            if (destroyed) return;
            if (opts.image && !r.image) W.Toast.show({ text: '«' + r.n + '» no se puede mostrar como imagen: se añade como archivo.', icon: 'paperclip' });
            var data = { f: r.f, n: r.n, m: r.m, s: r.s };
            if (r.image && r.ar) data.ar = r.ar;
            var type = r.image ? 'img' : 'file';
            structural();
            if (fill && indexOf(fill) >= 0) {
              var keepX = fill.x, keepW = fill.w;
              Object.keys(fill).forEach(function (k) { if (k !== 'id' && k !== 'i') delete fill[k]; });
              Object.assign(fill, { t: type, x: type === 'img' ? keepX || '' : '' }, data);
              if (type === 'img' && keepW) fill.w = keepW;
              refreshBlock(fill); last = fill; fill = null;
            } else {
              var ind = target && indexOf(target) >= 0 ? target.i || 0 : 0;
              var nb = newBlock(type, '', Object.assign(ind ? { i: ind } : {}, data));
              insertAt(position(), nb); last = nb;
            }
            save();
          }, function (e) {
            W.Toast.show({ text: W.Files.explain(e, file.name), type: 'danger', icon: 'alert', duration: 5000 });
          });
        });
      }, Promise.resolve()).then(function () {
        if (last && els[last.id] && !W.Layout.desktop) els[last.id].scrollIntoView({ block: 'nearest', behavior: U.reducedMotion() ? 'auto' : 'smooth' });
      });
    }
    function bookmarkBlock(b) {
      if (!b.url) {
        if (ro) return U.el('div.bk-missing', { text: 'Enlace' });
        var input = U.el('input.bk-task-input', { attrs: { type: 'url', placeholder: 'Pega un enlace (https://…) y pulsa Intro', 'aria-label': 'Enlace' } });
        input.addEventListener('keydown', function (ev) {
          if (ev.key !== 'Enter') return; ev.preventDefault();
          var v = input.value.trim(); if (!/^https?:\/\//.test(v)) v = 'https://' + v;
          structural(); b.url = v; b.x = ''; refreshBlock(b); save();
        });
        return U.el('div.bk-taskrow.new', [U.icon('link'), input]);
      }
      var host = ''; try { host = new URL(b.url).hostname.replace(/^www\./, ''); } catch (x) { host = b.url; }
      var titleEl = U.el('span.bk-bm-t.bk-text', { attrs: { contenteditable: ro ? 'false' : 'true', 'data-ph': host } });
      titleEl.innerHTML = b.x || '';
      return U.el('div.bk-bookmark', [U.el('span.bk-bm-ic', [U.icon('link')]), U.el('span.bk-bm-main', [titleEl, U.el('a.bk-bm-url', { attrs: { href: b.url, target: '_blank', rel: 'noopener noreferrer' }, text: b.url })])]);
    }
    function tableBlock(b) {
      var wrap = U.el('div.bk-table-wrap', { attrs: { contenteditable: 'false' } });
      var draw = function () {
        U.clear(wrap);
        var table = U.el('table.bk-table' + (b.head ? '.head' : ''));
        (b.rows || []).forEach(function (r, ri) {
          var tr = U.el('tr');
          r.forEach(function (c, ci) {
            var td = U.el(ri === 0 && b.head ? 'th' : 'td', [U.el('div.bk-cell', { attrs: { contenteditable: ro ? 'false' : 'true', 'data-r': ri, 'data-c': ci }, html: c })]);
            tr.appendChild(td);
          });
          table.appendChild(tr);
        });
        wrap.appendChild(table);
        if (!ro) wrap.appendChild(U.el('div.bk-table-acts', [
          U.el('button.btn.xs.ghost', { on: { click: function () { structural(); b.rows.push(b.rows[0].map(function () { return ''; })); draw(); save(); } } }, [U.icon('plus', 'sm'), 'Fila']),
          U.el('button.btn.xs.ghost', { on: { click: function () { if (b.rows[0].length >= 12) return; structural(); b.rows.forEach(function (r) { r.push(''); }); draw(); save(); } } }, [U.icon('plus', 'sm'), 'Columna']),
          U.el('button.btn.xs.ghost', { text: b.head ? 'Sin encabezado' : 'Con encabezado', on: { click: function () { structural(); b.head = !b.head; draw(); save(); } } }),
          U.el('button.btn.xs.ghost', { attrs: { 'aria-label': 'Quitar la última fila' }, on: { click: function () { if (b.rows.length < 2) return; structural(); b.rows.pop(); draw(); save(); } } }, [U.icon('trash', 'sm'), 'Fila']),
          U.el('button.btn.xs.ghost', { attrs: { 'aria-label': 'Quitar la última columna' }, on: { click: function () { if (b.rows[0].length < 2) return; structural(); b.rows.forEach(function (r) { r.pop(); }); draw(); save(); } } }, [U.icon('trash', 'sm'), 'Columna'])
        ]));
      };
      wrap.addEventListener('input', function (ev) {
        var c = ev.target.closest && ev.target.closest('.bk-cell'); if (!c) return;
        b.rows[+c.getAttribute('data-r')][+c.getAttribute('data-c')] = P().sanitize(c.innerHTML);
        save();
      });
      wrap.addEventListener('keydown', function (ev) {
        var c = ev.target.closest && ev.target.closest('.bk-cell'); if (!c) return;
        if (ev.key === 'Tab') {
          ev.preventDefault();
          var cells = U.$$('.bk-cell', wrap), i = cells.indexOf(c) + (ev.shiftKey ? -1 : 1);
          if (i >= cells.length) { structural(); b.rows.push(b.rows[0].map(function () { return ''; })); draw(); save(); cells = U.$$('.bk-cell', wrap); }
          if (cells[i]) { cells[i].focus(); setCaret(cells[i], 'end'); }
        } else if (ev.key === 'Enter' && !ev.shiftKey) {
          ev.preventDefault();
          var below = wrap.querySelector('.bk-cell[data-r="' + (+c.getAttribute('data-r') + 1) + '"][data-c="' + c.getAttribute('data-c') + '"]');
          if (below) { below.focus(); setCaret(below, 'end'); }
        }
        ev.stopPropagation();
      });
      draw();
      return wrap;
    }
    function refreshBlock(b) {
      var old = els[b.id]; if (!old) return;
      var fresh = renderBlock(b);
      old.parentNode.replaceChild(fresh, old);
      decorate();
    }

    /* -- Operaciones -- */
    function insertAt(i, b) {
      blocks.splice(i, 0, b);
      var el = renderBlock(b), next = blocks[i + 1];
      root.insertBefore(el, next && els[next.id] ? els[next.id] : tail.parentNode === root ? tail : null);
      decorate();
      return el;
    }
    function removeBlock(b) {
      var i = indexOf(b); if (i < 0) return;
      blocks.splice(i, 1);
      var e = els[b.id]; if (e && e.parentNode) e.parentNode.removeChild(e);
      delete els[b.id];
      decorate();
    }
    function focusBlock(b, where) {
      if (!b) return;
      var t = textEl(b);
      if (!t) { var e = els[b.id]; if (e) { var f = e.querySelector('input, [tabindex="0"], button'); if (f) f.focus(); } return; }
      t.focus({ preventScroll: false });
      setCaret(t, where === 'start' ? 0 : where === 'end' || where == null ? 'end' : where);
      ensureVisible(t);
    }
    function focusId(id, off) { var b = byId(id); if (b) focusBlock(b, off); }
    function ensureVisible(t) {
      var r = t.getBoundingClientRect(), vh = window.visualViewport ? window.visualViewport.height : window.innerHeight;
      if (r.bottom > vh - 70 || r.top < 70) t.scrollIntoView({ block: 'nearest', behavior: 'auto' });
    }
    function addBelow(b, above) {
      structural();
      var nb = newBlock('p', '', { i: b.t === 'toggle' && b.o && !above ? (b.i || 0) + 1 : (b.i || 0) });
      var at = above ? indexOf(b) : indexOf(b) + 1 + (b.t === 'toggle' && b.o ? 0 : childrenOf(b).length);
      insertAt(at, nb); focusBlock(nb, 'start');
      setTimeout(function () { openSlash(nb, true); }, 30);
      save();
    }
    function convert(b, t, extra) {
      structural();
      var tEl = textEl(b), keep = tEl ? (b.t === 'code' ? P().escape(tEl.textContent) : html(tEl)) : (b.x || '');
      b.t = t;
      if (P().BLOCKS[t].text || t === 'page' || t === 'bookmark') b.x = t === 'code' ? keep.replace(/<br>/g, '\n') : keep;
      if (t === 'todo') b.c = !!(extra && extra.c);
      if (t === 'toggle') b.o = true;
      if (t === 'callout') b.ic = b.ic || 'bolt';
      if (t === 'table' && !b.rows) { b.rows = [['', '', ''], ['', '', ''], ['', '', '']]; b.head = true; }
      Object.assign(b, extra || {});
      var cleaned = P().cleanBlock(b); Object.keys(b).forEach(function (k) { if (!(k in cleaned)) delete b[k]; }); Object.assign(b, cleaned);
      refreshBlock(b);
      save();
    }
    function moveBlock(b, toIndex) {
      var group = [b].concat(childrenOf(b));
      var from = indexOf(b);
      blocks.splice(from, group.length);
      if (toIndex > from) toIndex -= group.length;
      toIndex = Math.max(0, Math.min(blocks.length, toIndex));
      Array.prototype.splice.apply(blocks, [toIndex, 0].concat(group));
      renderAll();
      save();
    }
    function duplicate(b) {
      structural();
      var group = [b].concat(childrenOf(b)).map(function (x) { return Object.assign(JSON.parse(JSON.stringify(x)), { id: P().block('p').id }); });
      var at = indexOf(b) + 1 + childrenOf(b).length;
      Array.prototype.splice.apply(blocks, [at, 0].concat(group));
      renderAll(); focusBlock(group[0], 'end'); save();
    }
    function deleteBlock(b) {
      structural();
      var prev = prevText(b), next = nextText(b);
      if (b.t === 'page' && b.ref) { var pm = P().get(b.ref); if (pm && pm.parent === pageId) W.Sheet.confirm({ title: '¿Mover «' + P().title(pm) + '» a la papelera?', text: 'Es una subpágina de esta página.', ok: 'Mover a la papelera', danger: true }).then(function (ok) { if (ok) { P().remove(pm.id); } }); }
      removeBlock(b);
      if (!blocks.length) { var nb = newBlock('p'); insertAt(0, nb); focusBlock(nb, 'start'); }
      else focusBlock(prev || next, prev ? 'end' : 'start');
      save();
    }
    function indent(b, dir) {
      var i = indexOf(b); if (i < 0) return;
      var ind = b.i || 0;
      if (dir > 0) {
        if (i === 0) return;
        var max = (blocks[i - 1].i || 0) + 1;
        if (ind >= max || ind >= 8) return;
      } else if (ind === 0) return;
      structural();
      var group = [b].concat(childrenOf(b));
      group.forEach(function (x) { x.i = Math.max(0, Math.min(8, (x.i || 0) + dir)); if (!x.i) delete x.i; });
      decorate(); save();
    }

    /* -- Teclado -- */
    function onKey(ev) {
      var t = ev.target;
      if (!t || !t.classList || !t.classList.contains('bk-text') || t.closest('.bk-db')) return;
      var bel = t.closest('.bk'); if (!bel) return;
      var b = bel._b, mod = ev.ctrlKey || ev.metaKey;
      if (slash && handleMenuKey(ev, slash)) return;
      if (mention && handleMenuKey(ev, mention)) return;
      if (mod && !ev.altKey && (ev.key === 'z' || ev.key === 'Z')) { ev.preventDefault(); if (ev.shiftKey) redo(); else undo(); return; }
      if (mod && (ev.key === 'y' || ev.key === 'Y')) { ev.preventDefault(); redo(); return; }
      if (mod && !ev.shiftKey && (ev.key === 'b' || ev.key === 'B')) { ev.preventDefault(); fmt('bold'); return; }
      if (mod && !ev.shiftKey && (ev.key === 'i' || ev.key === 'I')) { ev.preventDefault(); fmt('italic'); return; }
      if (mod && !ev.shiftKey && (ev.key === 'u' || ev.key === 'U')) { ev.preventDefault(); fmt('underline'); return; }
      if (mod && ev.shiftKey && (ev.key === 'x' || ev.key === 'X' || ev.key === 's' || ev.key === 'S')) { ev.preventDefault(); fmt('strikeThrough'); return; }
      if (mod && (ev.key === 'e' || ev.key === 'E')) { ev.preventDefault(); wrapInline('code'); return; }
      if (mod && ev.shiftKey && (ev.key === 'h' || ev.key === 'H')) { ev.preventDefault(); wrapInline('mark'); return; }
      if (mod && (ev.key === 'k' || ev.key === 'K')) { ev.preventDefault(); link(); return; }
      if (mod && (ev.key === 'd' || ev.key === 'D')) { ev.preventDefault(); duplicate(b); return; }
      if (mod && ev.key === 'Enter') { ev.preventDefault(); if (b.t === 'todo') { var c = els[b.id].querySelector('.bk-check'); if (c) c.click(); } else if (b.t === 'toggle') { var a = els[b.id].querySelector('.bk-arrow'); if (a) a.click(); } return; }
      if (mod && ev.altKey && /^Digit[0-3]$/.test(ev.code)) { ev.preventDefault(); convert(b, ['p', 'h1', 'h2', 'h3'][+ev.code.slice(5)]); focusBlock(b, 'end'); return; }
      if (mod && ev.shiftKey && (ev.key === 'ArrowUp' || ev.key === 'ArrowDown')) {
        ev.preventDefault();
        var i = indexOf(b), off = caretOffset(t);
        if (ev.key === 'ArrowUp' && i > 0) { var pi = i - 1; while (pi > 0 && (blocks[pi].i || 0) > (b.i || 0)) pi--; structural(); moveBlock(b, pi); }
        else if (ev.key === 'ArrowDown') { var end = i + 1 + childrenOf(b).length; if (end < blocks.length) { var nxt = blocks[end]; structural(); moveBlock(b, end + 1 + childrenOf(nxt).length); } }
        focusBlock(b, off); return;
      }
      if (ev.key === 'Tab') { ev.preventDefault(); if (b.t === 'code') { document.execCommand('insertText', false, '  '); return; } indent(b, ev.shiftKey ? -1 : 1); return; }
      if (ev.key === 'Enter' && !ev.shiftKey) {
        if (b.t === 'code') { ev.preventDefault(); document.execCommand('insertText', false, '\n'); return; }
        ev.preventDefault();
        onEnter(b, t);
        return;
      }
      if (ev.key === 'Backspace' && atStart(t) && collapsed()) {
        ev.preventDefault();
        onBackspace(b, t);
        return;
      }
      if (ev.key === 'Delete' && atEnd(t) && collapsed()) {
        var nb = nextText(b);
        if (nb && indexOf(nb) === indexOf(b) + 1) { ev.preventDefault(); structural(); var nt = textEl(nb), off2 = (t.textContent || '').length; t.innerHTML = html(t) + (nb.t === 'code' ? P().escape(nt.textContent) : html(nt)); b.x = html(t); removeBlock(nb); setCaret(t, off2); save(); }
        return;
      }
      if (ev.key === 'ArrowUp' && !ev.shiftKey && onFirstLine(t)) { var p = prevText(b); if (p) { ev.preventDefault(); var x = caretRect(); focusBlock(p, 'end'); placeAtX(textEl(p), x ? x.left : null, true); } return; }
      if (ev.key === 'ArrowDown' && !ev.shiftKey && onLastLine(t)) { var n = nextText(b); if (n) { ev.preventDefault(); var x2 = caretRect(); focusBlock(n, 'start'); placeAtX(textEl(n), x2 ? x2.left : null, false); } return; }
      if (ev.key === 'ArrowLeft' && atStart(t)) { var p2 = prevText(b); if (p2) { ev.preventDefault(); focusBlock(p2, 'end'); } return; }
      if (ev.key === 'ArrowRight' && atEnd(t)) { var n2 = nextText(b); if (n2) { ev.preventDefault(); focusBlock(n2, 'start'); } return; }
      if (ev.key === 'Escape') { t.blur(); hideToolbar(); return; }
    }
    function placeAtX(el, x, last) {
      if (x == null || !el || !document.caretRangeFromPoint) return;
      var r = el.getBoundingClientRect(), y = last ? r.bottom - lineH(el) / 2 : r.top + lineH(el) / 2;
      var range = document.caretRangeFromPoint(Math.max(r.left + 1, Math.min(r.right - 1, x)), y);
      if (range && el.contains(range.startContainer)) { var s = sel(); s.removeAllRanges(); s.addRange(range); }
    }
    function onEnter(b, t) {
      structural();
      var ind = b.i || 0;
      // Enter en una lista vacía: se convierte en texto (o sale un nivel)
      if (LIST_TYPES[b.t] && isEmpty(t)) { if (ind > 0) { indent(b, -1); return; } convert(b, 'p'); focusBlock(b, 'start'); return; }
      if ((b.t === 'quote' || b.t === 'callout') && isEmpty(t)) { convert(b, 'p'); focusBlock(b, 'start'); return; }
      var rest = splitAtCaret(t);
      b.x = html(t);
      var type = CONT_TYPES[b.t] ? b.t : (b.t === 'toggle' ? 'p' : 'p');
      var childIndent = b.t === 'toggle' && b.o ? ind + 1 : ind;
      if (b.t === 'toggle' && !b.o) type = 'toggle';
      var nb = newBlock(type, rest, childIndent ? { i: childIndent } : null);
      var at = indexOf(b) + 1;
      if (b.t === 'toggle' && !b.o) at += childrenOf(b).length;
      // Al partir al principio de un título, el título baja con su texto
      if (/^h[123]$/.test(b.t) && !P().plain(b.x).trim() && rest) { nb.t = b.t; b.t = 'p'; refreshBlock(b); }
      insertAt(at, nb);
      t.classList.toggle('is-empty', isEmpty(t));
      focusBlock(nb, 'start');
      save();
    }
    function onBackspace(b, t) {
      structural();
      if (b.t !== 'p' && isText(b) && b.t !== 'code') { convert(b, 'p'); focusBlock(b, 'start'); return; }
      if ((b.i || 0) > 0) { indent(b, -1); focusBlock(b, 'start'); return; }
      var i = indexOf(b), prev = blocks[i - 1];
      if (!prev) return;
      if (!isText(prev) || !visible(prev)) {
        // El anterior no es texto: primero se selecciona; si este está vacío, se borra este
        if (isEmpty(t)) { removeBlock(b); var pe = els[prev.id]; if (pe) { pe.classList.add('bk-selected'); selBlock = prev; var f = pe.querySelector('[tabindex="0"], button, input'); if (f) f.focus(); } save(); return; }
        var pe2 = els[prev.id]; if (pe2) { pe2.classList.add('bk-selected'); selBlock = prev; setTimeout(function () { if (selBlock === prev) { pe2.classList.remove('bk-selected'); selBlock = null; } }, 2500); }
        return;
      }
      var pt = textEl(prev), off = (pt.textContent || '').length;
      var add = b.t === 'code' ? P().escape(t.textContent) : html(t);
      pt.innerHTML = (prev.t === 'code' ? P().escape(pt.textContent) : html(pt)) + add;
      prev.x = prev.t === 'code' ? pt.innerHTML : html(pt);
      // Los hijos del bloque que desaparece suben con él
      removeBlock(b);
      pt.focus(); setCaret(pt, off);
      decorate(); save();
    }

    /* -- Escritura -- */
    function onInput(ev) {
      var t = ev.target;
      if (!t || !t.classList || !t.classList.contains('bk-text')) return;
      var bel = t.closest('.bk'); if (!bel || t.closest('.bk-db')) return;
      var b = bel._b;
      if (b.t === 'code') b.x = P().escape(t.textContent);
      else if (b.t === 'img' || b.t === 'bookmark') b.x = html(t);
      else b.x = html(t);
      t.classList.toggle('is-empty', isEmpty(t));
      // Atajos de Markdown al principio del bloque
      if (b.t === 'p' || (b.t !== 'code' && ev.inputType === 'insertText' && ev.data === ' ')) {
        var txt = (t.textContent || '').replace(/ /g, ' ');
        var off = caretOffset(t);
        var head = txt.slice(0, off);
        if (b.t === 'p') {
          for (var i = 0; i < MD.length; i++) {
            if (MD[i].re.test(head)) {
              removeText(t, 0, head.length);
              b.x = html(t);
              convert(b, MD[i].t, MD[i].c ? { c: true } : null);
              focusBlock(b, 'start');
              return;
            }
          }
          if (/^```$/.test(head)) { removeText(t, 0, 3); b.x = html(t); convert(b, 'code'); focusBlock(b, 'start'); return; }
          if (/^-{3}$/.test(txt.trim()) && off === txt.length) { structural(); b.t = 'hr'; delete b.x; refreshBlock(b); var nb = newBlock('p'); insertAt(indexOf(b) + 1, nb); focusBlock(nb, 'start'); save(); return; }
        }
      }
      // «/» abre el menú de bloques y «@» el de menciones
      if (ev.inputType === 'insertText' && ev.data === '/' && b.t !== 'code') { var o2 = caretOffset(t), before = (t.textContent || '').charAt(o2 - 2); if (!before || /\s/.test(before)) openSlash(b, false, o2 - 1); }
      else if (ev.inputType === 'insertText' && ev.data === '@' && b.t !== 'code') { var o3 = caretOffset(t), bf = (t.textContent || '').charAt(o3 - 2); if (!bf || /\s/.test(bf)) openMention(b, o3 - 1); }
      if (slash) updateMenu(slash); if (mention) updateMenu(mention);
      save();
    }
    function removeText(el, from, to) {
      var r = document.createRange(), nodes = textNodes(el), pos = 0, started = false;
      for (var i = 0; i < nodes.length; i++) {
        var n = nodes[i], end = pos + n.length;
        if (!started && from <= end) { r.setStart(n, from - pos); started = true; }
        if (started && to <= end) { r.setEnd(n, to - pos); break; }
        pos = end;
      }
      if (started) { r.deleteContents(); }
    }
    function onPaste(ev) {
      var t = ev.target && ev.target.closest ? ev.target.closest('.bk-text') : null;
      if (!t || t.closest('.bk-db')) return;
      var bel = t.closest('.bk'); if (!bel) return;
      var b = bel._b, cd = ev.clipboardData; if (!cd) return;
      var text = cd.getData('text/plain') || '';
      // Archivos pegados (una captura, una foto, un PDF copiado…). Si además hay texto y solo son
      // imágenes (al copiar celdas de una hoja de cálculo llega también su imagen), gana el texto.
      var pasted = cd.files ? Array.prototype.slice.call(cd.files) : [];
      if (pasted.length && !ro && W.Files && !(text.trim() && pasted.every(function (f) { return /^image\//.test(f.type); }))) {
        ev.preventDefault();
        attachFiles(pasted, b);
        return;
      }
      if (b.t === 'code' || t.classList.contains('bk-codetext')) { ev.preventDefault(); document.execCommand('insertText', false, text); return; }
      var lines = text.replace(/\r/g, '').split('\n').filter(function (x) { return x.trim(); });
      if (lines.length > 1) {
        ev.preventDefault();
        structural();
        var parsed = P().fromMarkdown(text);
        if (!parsed.length) return;
        var at = indexOf(b) + 1;
        if (isEmpty(t) && b.t === 'p') { at = indexOf(b); removeBlock(b); }
        parsed.forEach(function (nb, k) { blocks.splice(at + k, 0, nb); });
        renderAll(); focusBlock(parsed[parsed.length - 1], 'end'); save();
        return;
      }
      var htmlData = cd.getData('text/html');
      ev.preventDefault();
      if (htmlData) {
        var clean = P().sanitize(htmlData).replace(/(<br>)+/g, ' ');
        document.execCommand('insertHTML', false, clean);
      } else {
        // Un enlace pegado sobre texto seleccionado se convierte en enlace
        if (/^https?:\/\/\S+$/.test(text.trim()) && !collapsed()) { document.execCommand('createLink', false, text.trim()); }
        else document.execCommand('insertText', false, text);
      }
    }

    /* -- Formato -- */
    function fmt(cmd) { document.execCommand(cmd, false, null); syncFocused(); }
    function syncFocused() {
      var a = document.activeElement; if (!a || !a.classList || !a.classList.contains('bk-text')) return;
      var bel = a.closest('.bk'); if (!bel) return;
      bel._b.x = html(a); save();
    }
    function wrapInline(tag) {
      var s = sel(); if (!s.rangeCount) return;
      var r = s.getRangeAt(0);
      var node = r.commonAncestorContainer.nodeType === 1 ? r.commonAncestorContainer : r.commonAncestorContainer.parentNode;
      var existing = node.closest ? node.closest(tag) : null;
      if (existing) { var frag = document.createDocumentFragment(); while (existing.firstChild) frag.appendChild(existing.firstChild); existing.parentNode.replaceChild(frag, existing); syncFocused(); return; }
      if (r.collapsed) return;
      var text = r.toString();
      document.execCommand('insertHTML', false, '<' + tag + '>' + P().escape(text) + '</' + tag + '>');
      syncFocused();
    }
    function link() {
      var s = sel(); if (!s.rangeCount) return;
      var saved = s.getRangeAt(0).cloneRange();
      var a = document.activeElement;
      var cur = saved.commonAncestorContainer; cur = cur.nodeType === 1 ? cur : cur.parentNode;
      var existing = cur && cur.closest ? cur.closest('a') : null;
      W.Sheet.prompt({ title: existing ? 'Cambiar el enlace' : 'Añadir un enlace', value: existing ? existing.getAttribute('href') : '', placeholder: 'https://…', maxLength: 600, ok: 'Guardar' }).then(function (u) {
        if (a) a.focus();
        var s2 = sel(); s2.removeAllRanges(); s2.addRange(saved);
        if (!u) return;
        if (!/^(https?:|mailto:)/.test(u)) u = 'https://' + u;
        if (existing) existing.setAttribute('href', u);
        else if (saved.collapsed) document.execCommand('insertHTML', false, '<a href="' + P().escape(u) + '">' + P().escape(u) + '</a>');
        else document.execCommand('createLink', false, u);
        syncFocused();
      });
    }
    function showToolbar() {
      if (ro) return;
      var s = sel();
      if (!s || !s.rangeCount || s.isCollapsed) { hideToolbar(); return; }
      var r = s.getRangeAt(0), anc = r.commonAncestorContainer;
      var host = (anc.nodeType === 1 ? anc : anc.parentNode);
      var t = host && host.closest ? host.closest('.bk-text') : null;
      if (!t || !root.contains(t) || t.classList.contains('bk-codetext')) { hideToolbar(); return; }
      if (!toolbar) {
        var btn = function (icon, label, run) { return U.el('button.bt-btn', { attrs: { type: 'button', 'aria-label': label, title: label }, on: { mousedown: function (e) { e.preventDefault(); }, click: function (e) { e.preventDefault(); run(e); } } }, [U.icon(icon)]); };
        toolbar = U.el('div.bk-toolbar', { attrs: { role: 'toolbar', 'aria-label': 'Formato del texto' } }, [
          U.el('button.bt-turn', { attrs: { type: 'button', title: 'Convertir en' }, on: { mousedown: function (e) { e.preventDefault(); }, click: function (e) { var bel = t2().closest('.bk'); if (bel) turnMenu(bel._b, e.currentTarget); } } }, [U.el('span', { text: 'Convertir' }), U.icon('down', 'xs')]),
          U.el('span.bt-sep'),
          btn('bold', 'Negrita (Ctrl B)', function () { fmt('bold'); }),
          btn('italic', 'Cursiva (Ctrl I)', function () { fmt('italic'); }),
          btn('underline', 'Subrayado (Ctrl U)', function () { fmt('underline'); }),
          btn('strike', 'Tachado (Ctrl Mayús X)', function () { fmt('strikeThrough'); }),
          btn('code', 'Código (Ctrl E)', function () { wrapInline('code'); }),
          btn('highlight', 'Resaltar (Ctrl Mayús H)', function () { wrapInline('mark'); }),
          btn('link', 'Enlace (Ctrl K)', function () { link(); }),
          U.el('span.bt-sep'),
          btn('tasks', 'Crear una tarea con este texto', function () { var txt = sel().toString().trim(); if (txt) { W.Editor.open(null, { text: txt.slice(0, 200) }); } })
        ]);
        document.body.appendChild(toolbar);
      }
      toolbar._t = t;
      var rect = r.getBoundingClientRect();
      toolbar.classList.add('show');
      var w = toolbar.offsetWidth, x = Math.max(8, Math.min(window.innerWidth - w - 8, rect.left + rect.width / 2 - w / 2));
      var y = rect.top - toolbar.offsetHeight - 10;
      if (y < 8 + W.Layout.topInset()) y = rect.bottom + 10;
      toolbar.style.left = x + 'px'; toolbar.style.top = y + 'px';
    }
    function t2() { return toolbar && toolbar._t ? toolbar._t : document.createElement('div'); }
    function hideToolbar() { if (toolbar) toolbar.classList.remove('show'); }

    /* -- Menús -- */
    function turnMenu(b, anchor) {
      var types = ['p', 'h1', 'h2', 'h3', 'ul', 'ol', 'todo', 'toggle', 'quote', 'callout', 'code'];
      W.Menu.open(anchor, types.map(function (k) { var d = P().BLOCKS[k]; return { value: k, label: d.label, icon: d.icon, on: b.t === k }; }), { title: 'Convertir en' }).then(function (v) { if (v && v !== b.t) { convert(b, v); focusBlock(b, 'end'); } });
    }
    function iconMenu(anchor, current, done) {
      W.Menu.open(anchor, ['bolt', 'info', 'alert', 'star', 'flag', 'target', 'heart', 'book', 'calendar', 'clock', 'pin', 'sparkle'].map(function (k) { return { value: k, label: { bolt: 'Rayo', info: 'Información', alert: 'Atención', star: 'Estrella', flag: 'Bandera', target: 'Diana', heart: 'Corazón', book: 'Libro', calendar: 'Calendario', clock: 'Reloj', pin: 'Chincheta', sparkle: 'Brillo' }[k], icon: k, on: current === k }; }), { title: 'Icono' }).then(function (v) { if (v) done(v); });
    }
    function blockMenu(b, anchor) {
      // Por grupos: lo propio del bloque (un archivo: abrirlo o descargarlo), editar, mover, convertir y borrar
      var items = [];
      if (b.f) {
        items.push({ value: 'open', label: b.t === 'img' ? 'Ver en grande' : 'Abrir', icon: b.t === 'img' ? 'expand' : 'external' });
        items.push({ value: 'dl', label: 'Descargar', icon: 'download' });
        if (b.t === 'file') items.push({ value: 'rename', label: 'Cambiar el nombre', icon: 'edit' });
      }
      if (b.t === 'img' && (b.src || b.f)) items.push({ value: 'size', label: 'Tamaño de la imagen', icon: 'grid' });
      // «Convertir en» solo para texto: en un archivo o una imagen se perdería el adjunto
      if (isText(b)) items.push({ value: 'turn', label: 'Convertir en…', icon: 'swap', gap: items.length > 0 });
      items.push({ value: 'dup', label: 'Duplicar', icon: 'copy', desc: 'Ctrl D', gap: items.length > 0 && !isText(b) });
      items.push({ value: 'up', label: 'Subir', icon: 'up', desc: 'Ctrl Mayús ↑', gap: true });
      items.push({ value: 'down', label: 'Bajar', icon: 'down', desc: 'Ctrl Mayús ↓' });
      items.push({ value: 'in', label: 'Sangrar', icon: 'right', desc: 'Tab' });
      items.push({ value: 'out', label: 'Quitar sangría', icon: 'left', desc: 'Mayús Tab' });
      if (isText(b) && b.t !== 'code') items.push({ value: 'task', label: 'Crear tarea con este texto', icon: 'tasks', gap: true });
      if (isText(b)) items.push({ value: 'subpage', label: 'Convertir en subpágina', icon: 'page', gap: b.t === 'code' });
      items.push({ value: 'copy', label: b.f && b.t === 'file' ? 'Copiar el nombre' : 'Copiar el texto', icon: 'layers', gap: !isText(b) });
      items.push({ value: 'del', label: 'Eliminar', icon: 'trash', destructive: true, gap: true });
      W.Menu.open(anchor, items).then(function (v) {
        if (!v) return;
        var i = indexOf(b);
        if (v === 'turn') turnMenu(b, anchor);
        else if (v === 'dup') duplicate(b);
        else if (v === 'up' && i > 0) { var pi = i - 1; while (pi > 0 && (blocks[pi].i || 0) > (b.i || 0)) pi--; structural(); moveBlock(b, pi); }
        else if (v === 'down') { var end = i + 1 + childrenOf(b).length; if (end < blocks.length) { structural(); moveBlock(b, end + 1 + childrenOf(blocks[end]).length); } }
        else if (v === 'in') indent(b, 1);
        else if (v === 'out') indent(b, -1);
        else if (v === 'task') { var text = P().plain(b.x).trim(); if (text) { var pr = W.Parse.task(text); var task = W.State.addTask({ text: pr.text || text, date: pr.date !== undefined ? pr.date : U.today(), time: pr.time || null, listId: pr.listId || null, highlight: pr.highlight || 'none', warn: W.State.settings.defaultWarn }); structural(); b.t = 'task'; b.ref = task.id; delete b.x; refreshBlock(b); save(); W.Toast.show({ text: 'Tarea creada', icon: 'check', type: 'success' }); } }
        else if (v === 'subpage') { var titleTxt = P().plain(b.x).trim(); structural(); var sp = P().create({ title: titleTxt, parent: pageId }); b.t = 'page'; b.ref = sp.id; b.x = ''; refreshBlock(b); save(true); }
        else if (v === 'open') openAttachment(b);
        else if (v === 'dl') W.Files.download(fref(b), scope());
        else if (v === 'rename') W.Sheet.prompt({ title: 'Nombre del archivo', value: b.n || '', maxLength: 120, ok: 'Guardar' }).then(function (n) { n = String(n || '').trim(); if (!n || n === b.n) return; structural(); b.n = n; refreshBlock(b); save(); });
        else if (v === 'size') W.Menu.open(anchor, [25, 50, 75, 100].map(function (w) { return { value: w, label: w + ' %', on: (b.w || 100) === w }; })).then(function (w) { if (w) { b.w = w; refreshBlock(b); save(); } });
        else if (v === 'copy') copyText(b.t === 'table' ? (b.rows || []).map(function (r) { return r.map(P().plain).join('\t'); }).join('\n') : P().plain(b.x || '') || b.n || '');
        else if (v === 'del') deleteBlock(b);
      });
    }
    function copyText(s) {
      if (navigator.clipboard) navigator.clipboard.writeText(s).then(function () { W.Toast.show({ text: 'Copiado', icon: 'check' }); }).catch(function () {});
    }

    /* -- Menú «/» y menciones -- */
    function commands() {
      var B = P().BLOCKS, list = ['p', 'h1', 'h2', 'h3', 'todo', 'ul', 'ol', 'toggle', 'quote', 'callout', 'code', 'img', 'file', 'bookmark', 'hr', 'table', 'page', 'db', 'task', 'agenda', 'toc'];
      var out = list.map(function (k) { return { id: k, label: B[k].label, icon: B[k].icon, desc: B[k].desc, keys: B[k].keys, group: k === 'page' || k === 'db' ? 'Páginas' : k === 'task' || k === 'agenda' ? 'WHIDER' : k === 'img' || k === 'file' || k === 'bookmark' ? 'Archivos y enlaces' : k === 'hr' || k === 'table' || k === 'toc' ? 'Insertar' : 'Bloques básicos' }; });
      out.push({ id: 'cmd:mention', label: 'Mencionar una página', icon: 'at', desc: 'Enlaza otra página', keys: ['mencion', 'enlazar', 'pagina'], group: 'Páginas' });
      out.push({ id: 'cmd:date', label: 'Fecha de hoy', icon: 'calendar', desc: U.cap(U.fmtDay(U.today())), keys: ['fecha', 'hoy', 'date'], group: 'Insertar' });
      out.push({ id: 'cmd:dbfull', label: 'Base de datos en página aparte', icon: 'database', desc: 'Como subpágina, a pantalla completa', keys: ['base', 'datos', 'pagina'], group: 'Páginas' });
      return out;
    }
    function openSlash(b, fromPlus, start) {
      if (ro) return;
      closeMenus();
      var t = textEl(b); if (!t) return;
      slash = { kind: 'slash', b: b, t: t, start: start == null ? caretOffset(t) : start, fromPlus: !!fromPlus, i: 0, list: [], el: U.el('div.bk-menu', { attrs: { role: 'listbox', 'aria-label': 'Insertar bloque' } }) };
      document.body.appendChild(slash.el);
      updateMenu(slash);
      watchViewport();
    }
    function openMention(b, start) {
      closeMenus();
      var t = textEl(b); if (!t) return;
      mention = { kind: 'mention', b: b, t: t, start: start, i: 0, list: [], el: U.el('div.bk-menu', { attrs: { role: 'listbox', 'aria-label': 'Mencionar' } }) };
      document.body.appendChild(mention.el);
      updateMenu(mention);
      watchViewport();
    }
    function fold(s) { return W.Parse.fold(String(s || '')); }
    function menuQuery(m) {
      var txt = m.t.textContent || '', off = caretOffset(m.t);
      if (m.kind === 'slash' && m.fromPlus) return { q: txt.slice(0, off).replace(/^\//, ''), ok: true };
      if (off <= m.start || txt.charAt(m.start) !== (m.kind === 'slash' ? '/' : '@')) return { ok: false };
      return { q: txt.slice(m.start + 1, off), ok: true };
    }
    function updateMenu(m) {
      var qq = menuQuery(m);
      if (!qq.ok || qq.q.length > 30 || (m.kind === 'slash' && /\s\s/.test(qq.q))) { closeMenus(); return; }
      var q = fold(qq.q.trim());
      var list;
      if (m.kind === 'slash') {
        list = commands().filter(function (c) { return !q || fold(c.label).indexOf(q) >= 0 || (c.keys || []).some(function (k) { return fold(k).indexOf(q) === 0; }); });
      } else {
        list = [];
        var dates = [{ d: U.today(), l: 'Hoy' }, { d: U.addDays(U.today(), 1), l: 'Mañana' }, { d: U.addDays(U.today(), -1), l: 'Ayer' }];
        if (q) { var pr = W.Parse.task('x ' + qq.q); if (pr.date && !dates.some(function (x) { return x.d === pr.date; })) dates.unshift({ d: pr.date, l: U.cap(U.fmtDay(pr.date)) }); }
        P().all().filter(function (pg) { return pg.id !== pageId && (!q || fold(P().title(pg)).indexOf(q) >= 0); }).sort(function (a, c) { return Math.max(c.at, c.cv) - Math.max(a.at, a.cv); }).slice(0, 6)
          .forEach(function (pg) { list.push({ id: 'page:' + pg.id, label: P().title(pg), icon: pg.icon || (pg.kind === 'db' ? 'database' : 'page'), group: 'Páginas', desc: pg.parent ? 'En ' + P().title(pg.parent) : '' }); });
        (W.State.friends ? W.State.friends() : []).filter(function (f) { return !q || fold(f.name).indexOf(q) >= 0; }).slice(0, 4)
          .forEach(function (f) { list.push({ id: 'user:' + f.uid, label: f.name || 'Contacto', icon: 'user', group: 'Personas' }); });
        dates.filter(function (x) { return !q || fold(x.l).indexOf(q) >= 0 || x === dates[0]; }).slice(0, 3)
          .forEach(function (x) { list.push({ id: 'date:' + x.d, label: x.l, icon: 'calendar', group: 'Fechas', desc: U.fmtShort(x.d) }); });
        W.State.tasks.filter(function (t) { return !t.done && q && fold(t.text).indexOf(q) >= 0; }).slice(0, 4)
          .forEach(function (t) { list.push({ id: 'task:' + t.id, label: t.text, icon: 'tasks', group: 'Tareas', desc: t.date ? U.fmtShort(t.date) : '' }); });
        if (q) list.push({ id: 'new:' + qq.q.trim(), label: 'Nueva página «' + qq.q.trim() + '»', icon: 'plus', group: 'Páginas' });
      }
      m.list = list.slice(0, 24);
      if (!m.list.length) { if (q.length > 3) closeMenus(); else drawMenu(m, true); return; }
      m.i = Math.min(m.i, m.list.length - 1);
      drawMenu(m);
    }
    function drawMenu(m, empty) {
      U.clear(m.el);
      if (empty) m.el.appendChild(U.el('div.bk-menu-none', { text: 'Sin resultados' }));
      var group = null;
      m.list.forEach(function (c, i) {
        if (c.group !== group) { group = c.group; m.el.appendChild(U.el('div.bk-menu-g', { text: group })); }
        var it = U.el('button.bk-menu-i' + (i === m.i ? '.on' : ''), { attrs: { type: 'button', role: 'option', 'aria-selected': i === m.i ? 'true' : 'false' }, on: { mousedown: function (e) { e.preventDefault(); }, click: function () { m.i = i; choose(m); } } }, [
          U.el('span.bk-menu-ic', [U.icon(c.icon || 'type')]), U.el('span.bk-menu-t', [U.el('b', { text: c.label }), c.desc ? U.el('small', { text: c.desc }) : null])
        ]);
        m.el.appendChild(it);
      });
      placeMenu(m);
      var on = m.el.querySelector('.bk-menu-i.on'); if (on) on.scrollIntoView({ block: 'nearest' });
    }
    /**
     * Ordenador: junto al cursor, por el lado con más sitio y con su altura ajustada a ese sitio.
     * Móvil: anclado a lo ancho justo encima de la barra del teclado; nunca queda debajo del
     * teclado ni se corta, y la línea que se escribe se mantiene a la vista.
     */
    function placeMenu(m) {
      if (!m || !m.el.parentNode) return;
      var el = m.el, lim = W.Layout.safeArea(8);
      el.style.maxHeight = '';
      var natural = Math.min(340, el.scrollHeight);
      if (!W.Layout.desktop) {
        var bar = document.querySelector('.kb-bar.show'), cr = caretRect() || m.t.getBoundingClientRect();
        var bottom = bar ? Math.min(lim.bottom, bar.getBoundingClientRect().top - 6) : lim.bottom;
        // Deja sitio para la línea que se escribe encima del menú
        var h = Math.max(120, Math.min(natural, bottom - lim.top - Math.max(24, cr.height || 0) - 16));
        el.classList.add('docked');
        el.style.left = lim.left + 'px'; el.style.width = Math.max(200, lim.right - lim.left) + 'px';
        el.style.maxHeight = h + 'px'; el.style.top = (bottom - h) + 'px';
        keepCaretAbove(m, bottom - h);
        return;
      }
      el.classList.remove('docked'); el.style.width = '';
      var r = caretRect() || m.t.getBoundingClientRect();
      var spaceBelow = lim.bottom - (r.bottom + 6), spaceAbove = (r.top - 6) - lim.top;
      var below = natural <= spaceBelow || spaceBelow >= spaceAbove;
      var room = Math.max(120, Math.min(340, below ? spaceBelow : spaceAbove));
      el.style.maxHeight = room + 'px';
      el.style.left = U.clamp(r.left, lim.left, Math.max(lim.left, lim.right - el.offsetWidth)) + 'px';
      el.style.top = (below ? r.bottom + 6 : r.top - 6 - Math.min(natural, room)) + 'px';
    }
    /**
     * Móvil: si el menú tapa la línea que se escribe, la sube lo justo. Mientras el menú está
     * abierto, la página gana sitio por abajo para poder subir aunque sea corta.
     */
    var roomFor = null;
    function keepCaretAbove(m, menuTop) {
      var r = caretRect() || m.t.getBoundingClientRect(), over = r.bottom + 10 - menuTop;
      if (over <= 0) return;
      var sc = null;
      for (var p = m.t.parentElement; p && p !== document.body; p = p.parentElement) {
        var oy = getComputedStyle(p).overflowY;
        if (oy === 'auto' || oy === 'scroll') { sc = p; break; }
      }
      if (!sc) { window.scrollBy(0, over); return; }
      if (!roomFor || roomFor.el !== sc) { releaseRoom(); roomFor = { el: sc, orig: sc.style.paddingBottom, base: parseFloat(getComputedStyle(sc).paddingBottom) || 0 }; }
      sc.style.paddingBottom = Math.max(roomFor.base, window.innerHeight - menuTop + 24) + 'px';
      sc.scrollTop += over;
    }
    function releaseRoom() { if (roomFor) { roomFor.el.style.paddingBottom = roomFor.orig; roomFor = null; } }
    /** Mientras hay un menú abierto, se recoloca si el teclado aparece o desaparece */
    var vvHandler = null;
    function watchViewport() {
      if (vvHandler) return;
      vvHandler = function () { if (slash) placeMenu(slash); if (mention) placeMenu(mention); };
      if (window.visualViewport) { window.visualViewport.addEventListener('resize', vvHandler); window.visualViewport.addEventListener('scroll', vvHandler); }
      window.addEventListener('resize', vvHandler);
    }
    function unwatchViewport() {
      if (!vvHandler) return;
      if (window.visualViewport) { window.visualViewport.removeEventListener('resize', vvHandler); window.visualViewport.removeEventListener('scroll', vvHandler); }
      window.removeEventListener('resize', vvHandler); vvHandler = null;
    }
    function handleMenuKey(ev, m) {
      if (ev.key === 'ArrowDown') { ev.preventDefault(); m.i = (m.i + 1) % Math.max(1, m.list.length); drawMenu(m); return true; }
      if (ev.key === 'ArrowUp') { ev.preventDefault(); m.i = (m.i - 1 + m.list.length) % Math.max(1, m.list.length); drawMenu(m); return true; }
      if (ev.key === 'Enter' || ev.key === 'Tab') { if (!m.list.length) { closeMenus(); return false; } ev.preventDefault(); choose(m); return true; }
      if (ev.key === 'Escape') { ev.preventDefault(); closeMenus(); return true; }
      return false;
    }
    function closeMenus() {
      [slash, mention].forEach(function (m) { if (m && m.el.parentNode) m.el.parentNode.removeChild(m.el); });
      slash = mention = null;
      unwatchViewport();
      releaseRoom();
    }
    function choose(m) {
      var c = m.list[m.i]; if (!c) return;
      var b = m.b, t = m.t, qq = menuQuery(m);
      // Quita lo escrito («/titulo», «@ana»)
      var from = m.kind === 'slash' && m.fromPlus ? 0 : m.start, to = from + (m.kind === 'slash' && m.fromPlus ? (qq.q || '').length + ((t.textContent || '').charAt(0) === '/' ? 1 : 0) : 1 + (qq.q || '').length);
      t.focus(); removeText(t, from, to); b.x = html(t);
      closeMenus();
      if (m.kind === 'mention') { insertMention(b, t, c); return; }
      structural();
      var id = c.id, emptyNow = isEmpty(t);
      if (id === 'cmd:mention') { document.execCommand('insertText', false, '@'); openMention(b, caretOffset(t) - 1); return; }
      if (id === 'cmd:date') { insertMention(b, t, { id: 'date:' + U.today(), label: U.cap(U.fmtDay(U.today())) }); return; }
      var target = b;
      var place = function (nb) { if (emptyNow && b.t === 'p') { var i = indexOf(b); removeBlock(b); insertAt(i, nb); } else insertAt(indexOf(b) + 1 + childrenOf(b).length, nb); return nb; };
      if (id === 'page') {
        var sp = P().create({ title: '', parent: pageId });
        place(newBlock('page', '', { ref: sp.id, i: b.i || 0 })); save(true);
        if (o.onOpenPage) setTimeout(function () { o.onOpenPage(sp.id, { focusTitle: true }); }, 60);
        return;
      }
      if (id === 'db' || id === 'cmd:dbfull') {
        var meta = P().get(pageId);
        var dbm = P().newDb('', pageId, { team: meta ? meta.team : null });
        var nb2 = place(newBlock(id === 'db' ? 'db' : 'page', '', { ref: dbm.id, i: b.i || 0 }));
        save(true);
        if (id === 'cmd:dbfull' && o.onOpenPage) setTimeout(function () { o.onOpenPage(dbm.id, { focusTitle: true }); }, 60);
        else setTimeout(function () { var ti = els[nb2.id] && els[nb2.id].querySelector('.dbv-title'); if (ti) ti.focus(); }, 60);
        return;
      }
      if (P().BLOCKS[id] && P().BLOCKS[id].text) {
        if (emptyNow || b.t === 'p' && isEmpty(t)) { convert(b, id); focusBlock(b, 'start'); }
        else { var nb3 = place(newBlock(id, '', { i: b.i || 0 })); focusBlock(nb3, 'start'); }
        save();
        return;
      }
      var extra = { i: b.i || 0 };
      if (id === 'table') { extra.rows = [['', '', ''], ['', '', ''], ['', '', '']]; extra.head = true; }
      var nb4 = place(newBlock(id, '', extra));
      if (id === 'hr' || id === 'toc' || id === 'agenda') { var after = newBlock('p', '', { i: b.i || 0 }); insertAt(indexOf(nb4) + 1, after); focusBlock(after, 'start'); }
      else if (id === 'img') setTimeout(function () { pickImage(nb4); }, 50);
      else if (id === 'file') setTimeout(function () { pickInto(nb4); }, 50);
      else setTimeout(function () { var inp = els[nb4.id] && els[nb4.id].querySelector('input, .bk-cell'); if (inp) inp.focus(); }, 30);
      save();
      void target;
    }
    function insertMention(b, t, c) {
      var parts = c.id.split(':'), type = parts[0], val = parts.slice(1).join(':');
      var label = c.label;
      if (type === 'new') { var np = P().create({ title: val, parent: pageId }); type = 'page'; val = np.id; label = val && P().title(np); }
      var span = P().mention(type === 'user' ? 'user' : type, val, type === 'date' ? label : label);
      document.execCommand('insertHTML', false, span + '&nbsp;');
      b.x = html(t); save();
    }

    /* -- Arrastrar bloques -- */
    function showDrop(target, after) {
      if (!dropLine) { dropLine = U.el('div.bk-drop'); }
      var r = target.getBoundingClientRect(), rr = root.getBoundingClientRect();
      dropLine.style.top = (after ? r.bottom : r.top) - rr.top - 1 + 'px';
      if (dropLine.parentNode !== root) root.appendChild(dropLine);
    }
    function hideDrop() { if (dropLine && dropLine.parentNode) dropLine.parentNode.removeChild(dropLine); }
    root.addEventListener('dragover', function (ev) {
      if (!dragId || !ev.dataTransfer || Array.prototype.indexOf.call(ev.dataTransfer.types, DRAG) < 0) return;
      var target = ev.target.closest && ev.target.closest('.bk');
      if (!target || target.getAttribute('data-id') === dragId) return;
      ev.preventDefault();
      var r = target.getBoundingClientRect(), after = ev.clientY > r.top + r.height / 2;
      target._dropAfter = after; root._dropTarget = target;
      showDrop(target, after);
    });
    root.addEventListener('drop', function (ev) {
      if (!dragId) return;
      ev.preventDefault();
      var target = root._dropTarget, b = byId(dragId);
      hideDrop();
      if (!target || !b) return;
      var tb = target._b;
      if (childrenOf(b).indexOf(tb) >= 0) return;
      structural();
      var to = indexOf(tb) + (target._dropAfter ? 1 + childrenOf(tb).length : 0);
      var delta = (tb.i || 0) - (b.i || 0);
      [b].concat(childrenOf(b)).forEach(function (x) { x.i = Math.max(0, (x.i || 0) + delta); if (!x.i) delete x.i; });
      moveBlock(b, to);
      dragId = null;
    });

    /* -- Soltar archivos desde el ordenador (o desde otra app) -- */
    function hasFiles(ev) { var ty = ev.dataTransfer && ev.dataTransfer.types; return !!ty && Array.prototype.indexOf.call(ty, 'Files') >= 0; }
    root.addEventListener('dragover', function (ev) {
      if (dragId || ro || !hasFiles(ev)) return;
      ev.preventDefault();
      try { ev.dataTransfer.dropEffect = 'copy'; } catch (x) { /* solo lectura */ }
      var target = ev.target.closest && ev.target.closest('.bk');
      if (target && root.contains(target)) {
        var r = target.getBoundingClientRect(), after = ev.clientY > r.top + r.height / 2;
        target._dropAfter = after; root._fileDrop = target;
        showDrop(target, after);
      } else { root._fileDrop = null; hideDrop(); }
      root.classList.add('file-over');
    });
    root.addEventListener('dragleave', function (ev) { if (!ev.relatedTarget || !root.contains(ev.relatedTarget)) { hideDrop(); root.classList.remove('file-over'); } });
    root.addEventListener('drop', function (ev) {
      if (dragId || ro || !hasFiles(ev)) return;
      ev.preventDefault();
      hideDrop(); root.classList.remove('file-over');
      var files = Array.prototype.slice.call(ev.dataTransfer.files || []);
      if (!files.length) return;
      var target = root._fileDrop, tb = target && target._b && indexOf(target._b) >= 0 ? target._b : null;
      root._fileDrop = null;
      attachFiles(files, tb, { before: !!(tb && !target._dropAfter) });
    });
    // El estado de los archivos (subiendo, en la nube…) se actualiza sin repintar la página
    var onFiles = function (e) {
      var id = e && e.detail ? e.detail.id : null;
      U.$$(id ? '[data-file="' + id + '"]' : '[data-file]', root).forEach(function (el) {
        var bel = el.closest('.bk'); if (!bel || !bel._b) return;
        if (el.classList.contains('bkf')) paintStatus(el, bel._b);
        else if (el.classList.contains('error') && el._reload && W.Files.has(bel._b.f)) el._reload();
      });
    };
    document.addEventListener('whider:files', onFiles);

    /* -- Eventos -- */
    root.addEventListener('keydown', onKey);
    root.addEventListener('input', onInput);
    root.addEventListener('paste', onPaste);
    root.addEventListener('focusin', function (ev) {
      if (selBlock && els[selBlock.id] && !els[selBlock.id].contains(ev.target)) { els[selBlock.id].classList.remove('bk-selected'); selBlock = null; }
      var bel = ev.target.closest && ev.target.closest('.bk');
      U.$$('.bk.focus', root).forEach(function (x) { if (x !== bel) x.classList.remove('focus'); });
      if (bel) { bel.classList.add('focus'); lastFocus = bel._b; }
      if (o.onFocusBlock) o.onFocusBlock(bel ? bel._b : null);
    });
    root.addEventListener('focusout', function (ev) {
      var bel = ev.target.closest && ev.target.closest('.bk');
      if (bel) setTimeout(function () { if (!bel.contains(document.activeElement)) bel.classList.remove('focus'); }, 0);
      setTimeout(function () {
        if (destroyed || root.contains(document.activeElement)) return;
        closeMenus(); save(true);
        if (o.onBlur) o.onBlur();
      }, 150);
    });
    root.addEventListener('click', function (ev) {
      var m = ev.target.closest && ev.target.closest('.mention');
      if (m) {
        ev.preventDefault();
        var pid = m.getAttribute('data-page'), tid = m.getAttribute('data-task'), d = m.getAttribute('data-date');
        if (pid && P().get(pid) && o.onOpenPage) { save(true); o.onOpenPage(pid); }
        else if (tid && W.State.find(tid)) W.Editor.open(tid);
        else if (d) { W.State.ui.calSelected = d; W.Router.go('calendar'); }
        return;
      }
      var a = ev.target.closest && ev.target.closest('a[href]');
      if (a && (ev.ctrlKey || ev.metaKey || ro || !a.closest('[contenteditable="true"]'))) { ev.preventDefault(); window.open(a.href, '_blank', 'noopener'); }
      if (selBlock && ev.target === root) { els[selBlock.id] && els[selBlock.id].classList.remove('bk-selected'); selBlock = null; }
    });
    // Borrar un bloque seleccionado (imagen, separador…) con Retroceso o Supr
    root.addEventListener('keydown', function (ev) {
      if (!selBlock || (ev.key !== 'Backspace' && ev.key !== 'Delete')) return;
      if (ev.target.closest && ev.target.closest('input, [contenteditable="true"]')) return;
      ev.preventDefault(); var b = selBlock; selBlock = null; deleteBlock(b);
    });
    var onSel = function () { if (!destroyed) requestAnimationFrame(showToolbar); };
    document.addEventListener('selectionchange', onSel);
    var onScroll = function (e) {
      var tg = e && e.target;
      if (tg && tg.nodeType === 1 && tg.closest('.bk-menu')) return;
      hideToolbar(); if (slash) placeMenu(slash); if (mention) placeMenu(mention);
    };
    window.addEventListener('scroll', onScroll, true);

    if (!blocks.length && !ro) blocks.push(newBlock('p'));
    renderAll();
    lastSnap = snapshot();

    return {
      el: root,
      blocks: function () { return blocks; },
      focus: function (where) { var b = where === 'start' ? blocks.filter(isText)[0] : blocks.filter(isText).slice(-1)[0]; if (b) focusBlock(b, where === 'start' ? 'start' : 'end'); else tail.click(); },
      /** Pone el cursor al principio del primer bloque (Intro desde el título) */
      focusFirst: function () {
        var b = blocks[0];
        if (!b || !isText(b) || !isEmpty(textEl(b))) { structural(); b = newBlock('p'); insertAt(0, b); save(); }
        focusBlock(b, 'start');
      },
      save: function () { save(true); },
      undo: undo, redo: redo,
      insertBlock: function (t) { var a = document.activeElement, bel = a && a.closest ? a.closest('.bk') : null, b = bel ? bel._b : blocks[blocks.length - 1]; if (!b) return; if (t === '/') { openSlash(b, false, caretOffset(textEl(b) || a)); document.execCommand('insertText', false, '/'); return; } if (t === '@') { document.execCommand('insertText', false, '@'); openMention(b, caretOffset(textEl(b)) - 1); return; } if (t === 'in' || t === 'out') { indent(b, t === 'in' ? 1 : -1); return; } if (t === 'todo' && b.t === 'todo') { convert(b, 'p'); focusBlock(b, 'end'); return; } convert(b, t); focusBlock(b, 'end'); },
      /** Cambios que llegan de otro dispositivo o de un compañero */
      remote: function () {
        var fresh = JSON.parse(JSON.stringify(P().content(pageId).blocks));
        var a = document.activeElement, bel = a && a.closest ? a.closest('.bk') : null, focusId0 = bel && root.contains(bel) ? bel.getAttribute('data-id') : null;
        var noAt = function (list) { return JSON.stringify(list.map(function (x) { var c = Object.assign({}, x); delete c.at; return c; })); };
        if (noAt(fresh) === noAt(blocks)) return;
        if (!focusId0) { blocks = fresh; renderAll(); lastSnap = snapshot(); return; }
        var off = textEl(byId(focusId0) || {}) ? caretOffset(textEl(byId(focusId0))) : 0;
        var mine = byId(focusId0);
        blocks = fresh.map(function (x) { return x.id === focusId0 && mine ? mine : x; });
        if (mine && !fresh.some(function (x) { return x.id === focusId0; })) blocks.push(mine);
        renderAll(); focusId(focusId0, off); lastSnap = snapshot();
      },
      /** Elige archivos o fotos del dispositivo y los pone donde está el cursor (o al final) */
      attach: function (o) {
        if (ro || !W.Files) return;
        var a = document.activeElement, bel = a && a.closest ? a.closest('.bk') : null;
        // Donde está el cursor; si no, donde estaba (el botón de la cabecera se lleva el foco); si no, al final
        var b = (bel && root.contains(bel) ? bel._b : null) || (lastFocus && indexOf(lastFocus) >= 0 ? lastFocus : null);
        var go = function (images) { W.Files.pick({ multiple: true, accept: images ? 'image/*' : null }).then(function (files) { if (files.length) attachFiles(files, b); }); };
        if (o && o.images != null) { go(!!o.images); return; }
        if (W.Layout.desktop) { go(false); return; }
        // Móvil: la galería de fotos del sistema o el explorador de archivos, como en cualquier app
        W.Sheet.choose({ title: 'Adjuntar a la página', options: [
          { value: 'img', label: 'Fotos', icon: 'image', desc: 'De la galería; se ven dentro de la página' },
          { value: 'file', label: 'Archivos', icon: 'file', desc: 'PDF, documentos, hojas de cálculo… hasta ' + W.Files.fmtSize(W.Files.MAX) }
        ] }).then(function (v) { if (v) go(v === 'img'); });
      },
      refreshLive: function () { blocks.forEach(function (b) { if (b.t === 'task' || b.t === 'agenda' || b.t === 'page' || b.t === 'db') refreshBlock(b); }); },
      destroy: function () {
        if (destroyed) return;
        save(true);
        destroyed = true;
        closeMenus(); hideToolbar();
        if (toolbar && toolbar.parentNode) toolbar.parentNode.removeChild(toolbar);
        document.removeEventListener('selectionchange', onSel);
        document.removeEventListener('whider:files', onFiles);
        window.removeEventListener('scroll', onScroll, true);
      }
    };
  }

  /** Reduce una imagen a un tamaño razonable para guardarla dentro de la página */
  function shrinkImage(file, max, q) {
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(file), img = new Image();
      img.onload = function () {
        try {
          var w = img.naturalWidth, h = img.naturalHeight, k = Math.min(1, max / Math.max(w, h));
          var c = document.createElement('canvas'); c.width = Math.round(w * k); c.height = Math.round(h * k);
          var ctx = c.getContext('2d'); ctx.fillStyle = '#FFFFFF'; ctx.fillRect(0, 0, c.width, c.height); ctx.drawImage(img, 0, 0, c.width, c.height);
          URL.revokeObjectURL(url);
          var out = c.toDataURL('image/jpeg', q);
          if (out.length > 380000) out = c.toDataURL('image/jpeg', 0.6);
          resolve(out);
        } catch (e) { URL.revokeObjectURL(url); reject(e); }
      };
      img.onerror = function () { URL.revokeObjectURL(url); reject(new Error('imagen')); };
      img.src = url;
    });
  }

  W.Blocks = { editor: editor, shrinkImage: shrinkImage, caretOffset: caretOffset, setCaret: setCaret };
})(window.Whider);
