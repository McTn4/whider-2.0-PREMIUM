/**
 * WHIDER · Cuaderno: menús «/» y «@» del editor
 * «/» inserta un bloque (texto, títulos, listas, tablas, páginas, bases de datos, tareas…) y «@» menciona
 * una página, una persona, una fecha o una tarea. En el ordenador, junto al cursor; en el móvil, encima del
 * teclado y sin tapar la línea que se escribe.
 */
window.Whider = window.Whider || {};

(function (W) {
  'use strict';
  var U = W.U, P = function () { return W.Pages; }, C = W.Caret;

  /** ed: el editor que lo usa (js/ui/blocks.js). Lo que el editor reasigna llega como función: ed.blocks() */
  W.BlockMenus = function (ed) {
    var o = ed.o, pageId = ed.pageId, ro = ed.ro;
    var childrenOf = ed.childrenOf, convert = ed.convert, focusBlock = ed.focusBlock, indexOf = ed.indexOf, insertAt = ed.insertAt, newBlock = ed.newBlock;
    var removeBlock = ed.removeBlock, removeText = ed.removeText, save = ed.save, structural = ed.structural, textEl = ed.textEl, pickImage = ed.pickImage;
    var pickInto = ed.pickInto;
    var caretOffset = C.caretOffset, caretRect = C.caretRect, html = C.html, isEmpty = C.isEmpty;

    var slash = null, mention = null;

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
        else setTimeout(function () { var ti = ed.els()[nb2.id] && ed.els()[nb2.id].querySelector('.dbv-title'); if (ti) ti.focus(); }, 60);
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
      else setTimeout(function () { var inp = ed.els()[nb4.id] && ed.els()[nb4.id].querySelector('input, .bk-cell'); if (inp) inp.focus(); }, 30);
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

    /** Teclas con un menú abierto (flechas, Intro, Tab y Escape): true si las ha usado */
    function key(ev) { return !!((slash && handleMenuKey(ev, slash)) || (mention && handleMenuKey(ev, mention))); }
    /** Al escribir: filtra el menú abierto (o lo cierra si ya no toca) */
    function update() { if (slash) updateMenu(slash); if (mention) updateMenu(mention); }
    /** Al desplazarse o cambiar el tamaño: lo recoloca */
    function place() { if (slash) placeMenu(slash); if (mention) placeMenu(mention); }

    return { openSlash: openSlash, openMention: openMention, close: closeMenus, key: key, update: update, place: place };
  };
})(window.Whider);
