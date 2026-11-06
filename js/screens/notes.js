/**
 * WHIDER · Apuntes
 *  - Ordenador: dos paneles (lista con búsqueda y categorías a la izquierda, editor a la derecha).
 *  - Móvil: la lista y, al tocar un apunte, el editor a pantalla completa.
 * El texto admite un formato ligero: «# título», «- lista», «- [ ] casilla», **negrita**, *cursiva*.
 * Las casillas sin marcar se convierten en tareas de un toque (entienden fecha, hora y #categoría).
 * Se guarda solo, mientras escribes, y se sincroniza con tu cuenta.
 */
window.Whider = window.Whider || {};
window.Whider.Screens = window.Whider.Screens || {};

(function (W) {
  'use strict';
  var U = W.U, S = function () { return W.State; };
  var ui = { id: null, q: '', cat: '', mode: 'edit', editor: null, listHost: null, rootEl: null };

  function fold(s) { return W.Parse && W.Parse.fold ? W.Parse.fold(s) : String(s || '').toLowerCase(); }
  function firstLine(n) { var t = (n.body || '').split('\n').filter(function (l) { return l.trim(); })[0] || ''; return t.replace(/^#+\s*|^-\s*\[[ x>]\]\s*|^[-*]\s+/i, ''); }
  function titleOf(n) { return n.title.trim() || firstLine(n) || 'Apunte sin título'; }
  function snippet(n) {
    var lines = (n.body || '').split('\n').map(function (l) { return l.replace(/^#+\s*|^-\s*\[[ x>]\]\s*|^[-*]\s+|\*\*|`/gi, '').trim(); }).filter(Boolean);
    if (!n.title.trim()) lines.shift();
    return lines.join(' · ').slice(0, 140);
  }
  function words(n) { var t = (n.title + ' ' + n.body).trim(); return t ? t.split(/\s+/).length : 0; }
  function sorted(st) {
    return st.notes.slice().sort(function (a, b) { return (b.pinned - a.pinned) || (b.updatedAt - a.updatedAt); });
  }
  function visible(st) {
    var q = fold(ui.q).trim();
    return sorted(st).filter(function (n) {
      if (ui.cat && (n.listId || '-') !== ui.cat) return false;
      return !q || q.split(/\s+/).every(function (w) { return fold(n.title + ' ' + n.body).indexOf(w) >= 0; });
    });
  }

  /* ---------- Formato ligero (texto seguro: se escapa antes de dar formato) ---------- */
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function inline(s) {
    return esc(s)
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
      .replace(/(^|[^*])\*([^*\s][^*]*)\*/g, '$1<i>$2</i>')
      .replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>');
  }
  /** Vista de lectura: las casillas se pueden marcar (cambia el texto del apunte) */
  function render(body, onToggle) {
    var out = U.el('div.note-read'), list = null;
    var lines = (body || '').split('\n');
    lines.forEach(function (line, i) {
      var m;
      if ((m = line.match(/^\s*-\s*\[([ xX>])\]\s?(.*)$/))) {
        if (!list || list.tagName !== 'UL' || !list.classList.contains('checks')) { list = U.el('ul.checks'); out.appendChild(list); }
        var state = m[1].toLowerCase(), li = U.el('li' + (state === 'x' ? '.done' : state === '>' ? '.sent' : ''));
        var box = U.el('button.check.sm' + (state === 'x' ? '.on' : ''), { attrs: { type: 'button', 'aria-label': state === 'x' ? 'Desmarcar' : 'Marcar' } });
        box.appendChild(U.svg('svg', { viewBox: '0 0 24 24' }, [U.svg('path', { d: 'm5 12.6 4.5 4.5L19 7.6' })]));
        if (state === '>') { box = U.el('span.sent-ic', { attrs: { title: 'Convertida en tarea' } }, [U.icon('send', 'xs')]); }
        else box.addEventListener('click', function () { onToggle(i, state === 'x' ? ' ' : 'x'); });
        li.appendChild(box);
        li.appendChild(U.el('span', { html: inline(m[2]) }));
        list.appendChild(li);
        return;
      }
      if ((m = line.match(/^\s*[-*]\s+(.*)$/))) {
        if (!list || list.tagName !== 'UL' || list.classList.contains('checks')) { list = U.el('ul'); out.appendChild(list); }
        list.appendChild(U.el('li', { html: inline(m[1]) }));
        return;
      }
      list = null;
      if ((m = line.match(/^(#{1,3})\s+(.*)$/))) { out.appendChild(U.el(m[1].length === 1 ? 'h2' : 'h3', { html: inline(m[2]) })); return; }
      if ((m = line.match(/^>\s?(.*)$/))) { out.appendChild(U.el('blockquote', { html: inline(m[1]) })); return; }
      if (!line.trim()) { out.appendChild(U.el('div.gap')); return; }
      out.appendChild(U.el('p', { html: inline(line) }));
    });
    U.$$('a', out).forEach(function (a) {
      a.addEventListener('click', function (e) { if (window.WhiderDesktop) { e.preventDefault(); window.WhiderDesktop.openExternal(a.href); } });
    });
    return out;
  }

  /** Casillas sin marcar → tareas (en la categoría del apunte) */
  function convert(note) {
    var st = S(), lines = note.body.split('\n'), made = 0;
    var out = lines.map(function (line) {
      var m = line.match(/^(\s*-\s*)\[ \]\s?(.*)$/);
      if (!m || !m[2].trim()) return line;
      var p = W.Parse.task(m[2].replace(/^(-\s*\[[ xX>]\]\s*)+/, ''), { lists: st.lists });
      if (!p.text) return line;
      st.addTask({ text: p.text, date: p.date !== undefined ? p.date : null, time: p.time || null, listId: p.listId || note.listId || st.settings.defaultList,
        highlight: p.highlight || 'none', repeat: p.repeat || 'none', warn: st.settings.defaultWarn, notes: 'De tu apunte «' + titleOf(note) + '»', subtasks: [] });
      made++;
      return m[1] + '[>] ' + m[2];
    });
    if (!made) { W.Toast.show({ text: 'No hay casillas sin marcar en este apunte', icon: 'info' }); return 0; }
    st.saveNote({ id: note.id, body: out.join('\n') });
    W.Audio.success();
    W.Toast.show({ text: U.plural(made, 'tarea creada', 'tareas creadas') + ' desde el apunte', type: 'success', icon: 'send',
      action: { label: 'Ver', fn: function () { W.Router.go('tasks'); } } });
    return made;
  }

  function download(name, text) { U.saveFile(name, text, 'txt'); }

  /* ---------- Editor ---------- */
  function editor(note, opts) {
    opts = opts || {};
    var st = S(), id = note ? note.id : U.uid('n');
    var cur = note ? Object.assign({}, note) : { id: id, title: '', body: '', listId: opts.listId || null, pinned: false };
    var timer = null;
    var title = U.el('input.note-title', { attrs: { type: 'text', maxlength: 120, placeholder: 'Título', 'aria-label': 'Título del apunte' } });
    title.value = cur.title;
    var body = U.el('textarea.note-body', { attrs: { placeholder: 'Escribe aquí…\n\n# Título  ·  - lista  ·  - [ ] casilla  ·  **negrita**', 'aria-label': 'Texto del apunte', spellcheck: 'true' } });
    body.value = cur.body;
    var status = U.el('span.note-status');
    var read = U.el('div.note-read-host');
    var paintStatus = function () {
      var n = st.getNote(id);
      status.textContent = n ? 'Guardado · ' + U.fmtRel(n.updatedAt - Date.now()) + ' · ' + U.plural(words(n), 'palabra', 'palabras') : 'Se guarda solo mientras escribes';
    };
    var save = function () {
      clearTimeout(timer); timer = null;
      cur.title = title.value; cur.body = body.value;
      var n = st.getNote(id);
      if (n && n.title === cur.title && n.body === cur.body && n.listId === cur.listId && n.pinned === cur.pinned) return;
      if (!n && !cur.title.trim() && !cur.body.trim()) return;
      st.saveNote({ id: id, title: cur.title, body: cur.body, listId: cur.listId, pinned: cur.pinned });
      paintStatus();
    };
    var queue = function () { clearTimeout(timer); timer = setTimeout(save, 450); };
    title.addEventListener('input', queue);
    body.addEventListener('input', function () { autosize(); queue(); });
    title.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); body.focus(); } });
    [title, body].forEach(function (i) { i.addEventListener('blur', function () { if (timer) save(); }); });
    var autosize = function () { if (opts.fill) return; body.style.height = 'auto'; body.style.height = Math.max(220, body.scrollHeight + 4) + 'px'; };

    // Listas que continúan solas al pulsar Intro
    body.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter' || e.shiftKey || e.ctrlKey || e.metaKey) return;
      var v = body.value, pos = body.selectionStart, start = v.lastIndexOf('\n', pos - 1) + 1, line = v.slice(start, pos);
      var m = line.match(/^(\s*)(-\s*\[[ xX>]\]\s|[-*]\s|(\d+)\.\s)/);
      if (!m) return;
      e.preventDefault();
      if (line.trim() === m[0].trim()) { body.setRangeText('', start, pos, 'end'); queue(); return; }  // línea vacía: termina la lista
      var bullet = m[3] ? (parseInt(m[3], 10) + 1) + '. ' : /\[/.test(m[2]) ? '- [ ] ' : m[2];
      body.setRangeText('\n' + m[1] + bullet, pos, body.selectionEnd, 'end');
      autosize(); queue();
    });

    /* Barra de herramientas */
    var linePrefix = function (prefix) {
      var v = body.value, pos = body.selectionStart, start = v.lastIndexOf('\n', pos - 1) + 1;
      if (v.slice(start, start + prefix.length) === prefix) body.setRangeText('', start, start + prefix.length, 'end');
      else body.setRangeText(prefix, start, start, 'end');
      body.focus(); autosize(); queue();
    };
    var wrap = function (mark) {
      var a = body.selectionStart, b = body.selectionEnd, sel = body.value.slice(a, b) || 'texto';
      body.setRangeText(mark + sel + mark, a, b, 'select');
      body.focus(); queue();
    };
    var tool = function (icon, label, fn, text) {
      return U.el('button.nt-btn', { attrs: { type: 'button', title: label, 'aria-label': label }, on: { mousedown: function (e) { e.preventDefault(); }, click: fn } }, [icon ? U.icon(icon, 'sm') : U.el('b', { text: text })]);
    };
    var tools = U.el('div.nt-tools', [
      tool(null, 'Título', function () { linePrefix('# '); }, 'H'),
      tool(null, 'Negrita', function () { wrap('**'); }, 'B'),
      tool('list', 'Lista', function () { linePrefix('- '); }),
      tool('check', 'Casilla', function () { linePrefix('- [ ] '); }),
      tool('send', 'Convertir las casillas en tareas', function () { save(); var n = st.getNote(id); if (n) { convert(n); body.value = st.getNote(id).body; drawRead(); } })
    ]);

    var catBtn = U.el('button.chip.nt-cat', { attrs: { type: 'button' } });
    var paintCat = function () {
      var l = cur.listId ? st.getList(cur.listId) : null;
      U.clear(catBtn);
      catBtn.appendChild(U.icon(l ? W.Lists.icon(l) : 'tray'));
      catBtn.appendChild(U.el('span', { text: l ? l.name : 'Sin categoría' }));
      catBtn.classList.toggle('on', !!l);
    };
    catBtn.addEventListener('click', function () {
      W.Menu.open(catBtn, [{ value: '-', label: 'Sin categoría', icon: 'tray', on: !cur.listId }].concat(st.lists.map(function (l) {
        return { value: l.id, label: l.name, icon: W.Lists.icon(l), on: cur.listId === l.id };
      }))).then(function (v) { if (v === undefined) return; cur.listId = v === '-' ? null : v; paintCat(); save(); });
    });
    var pinBtn = U.el('button.chip.nt-pin', { attrs: { type: 'button', 'aria-pressed': cur.pinned ? 'true' : 'false', title: 'Fijar arriba' } }, [U.icon('pin'), U.el('span', { text: 'Fijado' })]);
    var paintPin = function () { pinBtn.classList.toggle('on', !!cur.pinned); pinBtn.lastChild.textContent = cur.pinned ? 'Fijado' : 'Fijar'; };
    pinBtn.addEventListener('click', function () { cur.pinned = !cur.pinned; paintPin(); save(); W.Audio.select(); });

    var modeSeg = W.UI.segmented([{ value: 'edit', label: 'Escribir' }, { value: 'read', label: 'Leer' }], ui.mode, function (v) { ui.mode = v; applyMode(); }, { mini: true });
    var more = U.el('button.nav-icon.nt-more', { attrs: { 'aria-label': 'Más opciones', title: 'Más opciones' } }, [U.icon('dots')]);
    more.addEventListener('click', function () {
      save();
      var n = st.getNote(id);
      W.Menu.open(more, [
        { value: 'convert', label: 'Convertir las casillas en tareas', icon: 'send', disabled: !n },
        { value: 'copy', label: 'Duplicar', icon: 'layers', disabled: !n },
        { value: 'export', label: 'Guardar como texto', icon: 'download', disabled: !n },
        { value: 'delete', label: 'Eliminar el apunte', icon: 'trash', destructive: true, gap: true, disabled: !n }
      ]).then(function (v) {
        n = st.getNote(id);
        if (!n) return;
        if (v === 'convert') { convert(n); body.value = st.getNote(id).body; drawRead(); }
        else if (v === 'copy') { var c = st.saveNote({ title: n.title ? n.title + ' (copia)' : '', body: n.body, listId: n.listId }); if (c && opts.onOpen) opts.onOpen(c.id); }
        else if (v === 'export') download((titleOf(n) || 'apunte').slice(0, 60), (n.title ? n.title + '\n\n' : '') + n.body);
        else if (v === 'delete') {
          var gone = st.removeNote(n.id);
          W.Toast.show({ text: 'Apunte eliminado', icon: 'trash', action: { label: 'Deshacer', fn: function () { st.restoreNote(gone); } } });
          if (opts.onDelete) opts.onDelete();
        }
      });
    });

    var drawRead = function () {
      U.clear(read);
      read.appendChild(body.value.trim() ? render(body.value, function (lineIdx, mark) {
        var ls = body.value.split('\n');
        ls[lineIdx] = ls[lineIdx].replace(/\[[ xX]\]/, '[' + mark + ']');
        body.value = ls.join('\n'); save(); drawRead(); W.Audio.select();
      }) : U.el('p.muted', { text: 'Este apunte está vacío.' }));
    };
    var editWrap = U.el('div.nt-edit', [tools, body]);
    var applyMode = function () {
      var r = ui.mode === 'read';
      editWrap.style.display = r ? 'none' : '';
      read.style.display = r ? '' : 'none';
      if (r) { save(); drawRead(); } else autosize();
    };

    var el = U.el('div.note-editor' + (opts.fill ? '.fill' : ''), [
      U.el('div.nt-bar', [catBtn, pinBtn, U.el('span.nt-sp'), modeSeg, more]),
      title,
      editWrap, read,
      U.el('div.nt-foot', [status])
    ]);
    paintCat(); paintPin(); paintStatus(); applyMode();
    setTimeout(autosize, 0);
    return {
      el: el, id: id, save: save,
      focus: function () { (title.value ? body : title).focus(); },
      isEditing: function () { return el.contains(document.activeElement); },
      refreshStatus: paintStatus
    };
  }

  /* ---------- Lista ---------- */
  function noteItem(n, active, onOpen) {
    var l = n.listId ? S().getList(n.listId) : null;
    var b = U.el('button.note-item' + (active ? '.active' : ''), { attrs: { type: 'button', 'data-note': n.id } }, [
      U.el('div.ni-top', [n.pinned ? U.icon('pin', 'xs') : null, U.el('strong', { text: titleOf(n) })]),
      snippet(n) ? U.el('span.ni-snip', { text: snippet(n) }) : null,
      U.el('div.ni-meta', [U.el('span', { text: U.fmtDay(U.ymd(new Date(n.updatedAt))) }), l ? U.el('span.ni-cat', [U.icon(W.Lists.icon(l), 'xs'), l.name]) : null])
    ]);
    b.addEventListener('click', function () { onOpen(n.id); });
    b.addEventListener('contextmenu', function (e) {
      e.preventDefault();
      var st = S();
      W.Menu.open({ x: e.clientX, y: e.clientY }, [
        { value: 'pin', label: n.pinned ? 'Dejar de fijar' : 'Fijar arriba', icon: 'pin' },
        { value: 'convert', label: 'Convertir las casillas en tareas', icon: 'send' },
        { value: 'delete', label: 'Eliminar', icon: 'trash', destructive: true, gap: true }
      ]).then(function (v) {
        if (v === 'pin') st.saveNote({ id: n.id, pinned: !n.pinned });
        else if (v === 'convert') convert(n);
        else if (v === 'delete') { var gone = st.removeNote(n.id); W.Toast.show({ text: 'Apunte eliminado', icon: 'trash', action: { label: 'Deshacer', fn: function () { st.restoreNote(gone); } } }); }
      });
    });
    return b;
  }

  function filters(st, onChange) {
    var used = {};
    st.notes.forEach(function (n) { used[n.listId || '-'] = (used[n.listId || '-'] || 0) + 1; });
    var opts = [{ value: '', label: 'Todos', n: st.notes.length }].concat(st.lists.filter(function (l) { return used[l.id]; }).map(function (l) { return { value: l.id, label: l.name, icon: W.Lists.icon(l), n: used[l.id] }; }));
    if (used['-'] && opts.length > 1) opts.push({ value: '-', label: 'Sin categoría', n: used['-'] });
    if (opts.length < 3) return null;
    return U.el('div.chips.note-chips', opts.map(function (o) {
      var c = U.el('button.chip' + (ui.cat === o.value ? '.on' : ''), { attrs: { type: 'button' } }, [o.icon ? U.icon(o.icon) : null, U.el('span', { text: o.label }), U.el('small', { text: o.n })]);
      c.addEventListener('click', function () { ui.cat = o.value; onChange(); });
      return c;
    }));
  }

  function search(onChange) {
    var input = U.el('input.input', { attrs: { type: 'search', placeholder: 'Buscar en tus apuntes', 'aria-label': 'Buscar en tus apuntes', autocomplete: 'off' } });
    input.value = ui.q;
    input.addEventListener('input', U.debounce(function () { ui.q = input.value; onChange(); }, 120));
    return U.el('div.search' + (ui.q ? '.has-value' : ''), [U.icon('search'), input]);
  }

  /** Abre un apunte: en el ordenador, en el panel; en el móvil, a pantalla completa */
  function open(id, opts) {
    opts = opts || {};
    if (W.Layout.desktop) {
      ui.id = id || null; ui.fresh = !id;
      if (S().activeScreen !== 'notes') W.Router.go('notes'); else Screen.render(ui.rootEl);
      setTimeout(function () { if (ui.editor) ui.editor.focus(); }, 60);
      return;
    }
    var note = id ? S().getNote(id) : null;
    var ed = editor(note, { listId: opts.listId, onDelete: function () { s.close(); }, onOpen: function (nid) { s.close(); setTimeout(function () { open(nid); }, 250); } });
    var s = W.Sheet.open({ title: note ? 'Apunte' : 'Nuevo apunte', className: 'editor note-sheet', full: true, body: [ed.el], onClose: function () { ed.save(); } });
    if (!note) setTimeout(function () { ed.focus(); }, 380);
  }

  var Screen = {
    title: 'Apuntes',
    open: open,
    convert: convert,
    back: function () { if (W.Layout.desktop) return false; W.Router.back(); return true; },
    render: function (root) {
      ui.rootEl = root;
      var st = S(), desk = W.Layout.desktop;
      // Mientras escribes, solo se actualiza la lista (no se pierde el cursor)
      if (desk && ui.editor && ui.editor.isEditing() && root.contains(ui.editor.el) && ui.listHost) {
        ui.editor.refreshStatus(); drawList(); return;
      }
      var head = W.UI.header({
        title: 'Apuntes',
        back: desk ? null : { label: 'Atrás', onTap: function () { W.Router.back(); } },
        sub: st.notes.length ? U.plural(st.notes.length, 'apunte', 'apuntes') : 'Ideas, reuniones y listas, siempre a mano',
        actions: desk ? [{ text: 'Nuevo apunte', icon: 'plus', label: 'Nuevo apunte', onTap: function () { open(null); } }] : [{ icon: 'plus', label: 'Nuevo apunte', onTap: function () { open(null); } }]
      });
      ui.listHost = U.el('div.note-list');
      var redraw = function () { drawList(); };
      var chipsHost = U.el('div');
      var drawChips = function () { U.clear(chipsHost); var c = filters(st, function () { drawChips(); redraw(); }); if (c) chipsHost.appendChild(c); };
      drawChips();
      if (!st.notes.length && !ui.fresh) {
        W.UI.mount(root, head, [U.el('div.group', [W.UI.empty('buddy:note', 'Sin apuntes todavía', 'Anota ideas, reuniones o listas. Las casillas se convierten en tareas cuando quieras.',
          U.el('button.btn.sm.primary', { on: { click: function () { open(null); } } }, [U.icon('plus', 'sm'), 'Nuevo apunte']))])]);
        ui.editor = null;
        return;
      }
      if (!desk) {
        W.UI.mount(root, head, [search(redraw), chipsHost, ui.listHost]);
        drawList();
        return;
      }
      // Ordenador: dos paneles
      if (!ui.fresh && (!ui.id || !st.getNote(ui.id))) { var first = sorted(st)[0]; ui.id = first ? first.id : null; }
      var note = ui.id ? st.getNote(ui.id) : null;
      ui.editor = editor(note, { fill: true,
        onDelete: function () { ui.id = null; ui.fresh = false; Screen.render(root); },
        onOpen: function (nid) { ui.id = nid; ui.fresh = false; Screen.render(root); } });
      if (ui.fresh) ui.id = ui.editor.id;
      ui.fresh = false;
      var side = U.el('aside.notes-side', [search(redraw), chipsHost, ui.listHost]);
      W.UI.mount(root, head, [U.el('div.notes-split', [side, U.el('section.notes-main', [ui.editor.el])])]);
      drawList();
    }
  };

  function drawList() {
    var st = S(), host = ui.listHost;
    if (!host) return;
    U.clear(host);
    var list = visible(st);
    if (!list.length) { host.appendChild(U.el('p.note-none', { text: ui.q ? 'Ningún apunte coincide con «' + ui.q + '».' : 'No hay apuntes en esta categoría.' })); return; }
    var pinned = list.filter(function (n) { return n.pinned; }), rest = list.filter(function (n) { return !n.pinned; });
    var onOpen = function (id) { open(id); };
    if (pinned.length) { host.appendChild(U.el('div.note-h', { text: 'Fijados' })); pinned.forEach(function (n) { host.appendChild(noteItem(n, W.Layout.desktop && n.id === ui.id, onOpen)); }); }
    if (rest.length) { if (pinned.length) host.appendChild(U.el('div.note-h', { text: 'Todos' })); rest.forEach(function (n) { host.appendChild(noteItem(n, W.Layout.desktop && n.id === ui.id, onOpen)); }); }
  }

  W.Screens.notes = Screen;
  W.Notes = { open: open, convert: convert, render: render, title: titleOf };
})(window.Whider);
