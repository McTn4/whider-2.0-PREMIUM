/**
 * WHIDER · Cuaderno: bloques especiales del editor
 * Páginas y bases de datos enlazadas, tareas y la agenda de hoy, el índice, imágenes y archivos adjuntos
 * (con su estado de subida y «Deshacer» al quitarlos), enlaces y tablas. Cada editor crea los suyos.
 */
window.Whider = window.Whider || {};

(function (W) {
  'use strict';
  var U = W.U, P = function () { return W.Pages; }, C = W.Caret;

  /** ed: el editor que lo usa (js/ui/blocks.js). Lo que el editor reasigna llega como función: ed.blocks() */
  W.BlockKinds = function (ed) {
    var o = ed.o, pageId = ed.pageId, ro = ed.ro;
    var byId = ed.byId, childrenOf = ed.childrenOf, decorate = ed.decorate, focusBlock = ed.focusBlock, indexOf = ed.indexOf, insertAt = ed.insertAt;
    var newBlock = ed.newBlock, refreshBlock = ed.refreshBlock, removeBlock = ed.removeBlock, renderBlock = ed.renderBlock, save = ed.save;
    var structural = ed.structural, textEl = ed.textEl;
    var isEmpty = C.isEmpty, setCaret = C.setCaret;

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
          var fresh = renderBlock(b); ed.els()[b.id].parentNode.replaceChild(fresh, ed.els()[b.id]); decorate();
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
      var hs = ed.blocks().filter(function (x) { return x.t === 'h1' || x.t === 'h2' || x.t === 'h3'; });
      if (!hs.length) { host.appendChild(U.el('span.bk-toc-none', { text: 'Añade títulos y aparecerán aquí.' })); return; }
      hs.forEach(function (h) {
        host.appendChild(U.el('button.bk-toc-i.l' + h.t.slice(1), { attrs: { type: 'button' }, text: P().plain(h.x) || 'Sin título', on: { click: function () { var t = ed.els()[h.id]; if (t) { t.scrollIntoView({ behavior: U.reducedMotion() ? 'auto' : 'smooth', block: 'center' }); t.classList.add('flash'); setTimeout(function () { t.classList.remove('flash'); }, 1200); } } } }));
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
      if (!ed.blocks().length) insertAt(0, newBlock('p'));
      // Acciones sueltas: se guardan al momento (no hay más escritura que esperar)
      save(true);
      W.Toast.show({ text: (b.n ? '«' + name + '»' : name) + ' se ha quitado de la página', icon: 'trash', action: { label: 'Deshacer', fn: function () {
        if (ed.destroyed() || byId(copy.id)) return;
        structural(); insertAt(Math.min(i, ed.blocks().length), copy); save(true);
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
        var end = ed.blocks()[ed.blocks().length - 1];
        return end && emptyText(end) ? indexOf(end) : ed.blocks().length;
      };
      var big = list.length > 1 || list[0].size > 1500000;
      if (big) W.Toast.show({ text: list.length > 1 ? 'Añadiendo ' + list.length + ' archivos…' : 'Añadiendo «' + list[0].name + '»…', icon: 'paperclip', duration: 2200 });
      return list.reduce(function (pr, file) {
        return pr.then(function () {
          return W.Files.add(file, { scope: scope(), image: opts.image !== false }).then(function (r) {
            if (ed.destroyed()) return;
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
        if (last && ed.els()[last.id] && !W.Layout.desktop) ed.els()[last.id].scrollIntoView({ block: 'nearest', behavior: U.reducedMotion() ? 'auto' : 'smooth' });
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
      var host; try { host = new URL(b.url).hostname.replace(/^www\./, ''); } catch (x) { host = b.url; }
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

    return { pageLink: pageLink, dbBlock: dbBlock, taskBlock: taskBlock, agendaBlock: agendaBlock, fillToc: fillToc, scope: scope, fref: fref, openAttachment: openAttachment, imageBlock: imageBlock, fileBlock: fileBlock, paintStatus: paintStatus, removeAttachment: removeAttachment, pickImage: pickImage, pickInto: pickInto, emptyText: emptyText, attachFiles: attachFiles, bookmarkBlock: bookmarkBlock, tableBlock: tableBlock };
  };
})(window.Whider);
