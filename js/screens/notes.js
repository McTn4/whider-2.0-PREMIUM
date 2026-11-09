/**
 * WHIDER · Cuaderno (antes «Apuntes»): tu espacio de páginas, al estilo de Notion
 *
 *  - Páginas dentro de páginas, con icono, portada, favoritas, recientes y papelera.
 *  - Editor por bloques (W.Blocks) y bases de datos con varias vistas (W.DbView).
 *  - Plantillas: reunión, proyecto, diario, apuntes de clase, plan semanal, lista de lectura,
 *    hoja de ruta, wiki del equipo y clientes.
 *  - Páginas de equipo: se comparten con un espacio de trabajo y se editan entre todos.
 *  - «Enlazado desde», exportar a Markdown, imprimir o guardar en PDF, importar archivos .md.
 *  - Ordenador: árbol de páginas a la izquierda y la página a la derecha (se arrastran para
 *    ordenarlas). Móvil: portada con lo reciente y la página a pantalla completa, con una barra
 *    de herramientas sobre el teclado.
 */
window.Whider = window.Whider || {};
window.Whider.Screens = window.Whider.Screens || {};

(function (W) {
  'use strict';
  var U = W.U, S = function () { return W.State; }, P = function () { return W.Pages; };
  var TREE_DRAG = 'text/x-whider-page';
  var cur = null;          // { id, editor, pane }
  var wantFocus = false, editorLoading = null;
  /** El editor y las bases de datos se cargan la primera vez que se abre el Cuaderno (arranque más rápido) */
  function ensureEditor() {
    if (W.Blocks && W.DbView) return Promise.resolve();
    if (editorLoading) return editorLoading;
    var load = function (src) { return new Promise(function (resolve, reject) { var s = document.createElement('script'); s.src = src; s.onload = resolve; s.onerror = function () { editorLoading = null; reject(new Error(src)); }; document.head.appendChild(s); }); };
    var css = new Promise(function (resolve) {
      if (document.querySelector('link[href="css/cuaderno.css"]')) { resolve(); return; }
      var l = document.createElement('link'); l.rel = 'stylesheet'; l.href = 'css/cuaderno.css';
      l.onload = resolve; l.onerror = resolve; document.head.appendChild(l);
    });
    editorLoading = Promise.all([css, load('js/ui/blocks.js').then(function () { return load('js/ui/dbview.js'); })]);
    return editorLoading;
  }
  var screenRoot = null, treeEl = null, paneEl = null, searchQ = '', unsub = null, titleTimer = null, kbBar = null;

  function ui() {
    var u = S().ui;
    if (!u.treeOpen) { u.treeOpen = {}; try { var last = localStorage.getItem('whider.lastPage'); if (last && u.page === undefined && W.Layout.desktop) u.page = last; } catch (e) { /* sin almacenamiento */ } }
    return u;
  }
  function openId() { var id = ui().page; return id && P().get(id) && !P().get(id).trash ? id : null; }
  function desk() { return W.Layout.desktop; }
  function teams() {
    var sp = S().social.spaces || {};
    return Object.keys(sp).filter(function (k) { return !sp[k].left; }).map(function (k) { return { id: k, name: sp[k].name, icon: sp[k].icon || 'users' }; });
  }

  /* ---------- Abrir y crear ---------- */
  function open(id, opts) {
    opts = opts || {};
    if (id && !P().get(id)) return;
    if (cur && cur.editor) cur.editor.save();
    ui().page = id || null;
    try { if (id) localStorage.setItem('whider.lastPage', id); else localStorage.removeItem('whider.lastPage'); } catch (e) { /* sin almacenamiento */ }
    if (id) { var m = P().get(id); if (m) P().path(id).slice(0, -1).forEach(function (p) { ui().treeOpen[p.id] = true; }); }
    if (S().activeScreen !== 'notes') { W.Router.go('notes'); }
    else if (desk()) { drawPane(opts); drawTree(); }
    // Móvil: de la portada a la página (o al revés) se vuelve a montar la pantalla
    else if (screenRoot) { W.Screens.notes.render(screenRoot, true); W.Router.animate(id ? 'push' : 'pop'); }
    if (opts.focusTitle) { wantFocus = true; setTimeout(function () { if (wantFocus && document.querySelector('#screen-notes .pg-title')) { wantFocus = false; focusTitle(); } }, desk() ? 40 : 380); }
  }
  function focusTitle() { var t = document.querySelector('#screen-notes .pg-title'); if (t && W.Blocks) { t.focus(); W.Blocks.setCaret(t, 'end'); } }
  function create(o) {
    o = o || {};
    var m = o.template ? P().fromTemplate(o.template, o) : o.kind === 'db' ? P().newDb(o.title || '', o.parent || null, { team: o.team }) : P().create(o);
    if (o.parent) {
      // La subpágina aparece también como bloque dentro de su página madre
      var parent = P().get(o.parent);
      if (parent && parent.kind === 'page') {
        var blocks = P().content(o.parent).blocks.slice();
        blocks.push(P().block(m.kind === 'db' ? 'page' : 'page', '', { ref: m.id }));
        P().setBlocks(o.parent, blocks);
      }
      ui().treeOpen[o.parent] = true;
    }
    open(m.id, { focusTitle: true });
    return m;
  }
  function newMenu(anchor, o) {
    o = o || {};
    var items = [{ value: 'blank', label: 'Página en blanco', icon: 'page' }, { value: 'db', label: 'Base de datos', icon: 'database', desc: 'Tabla, tablero, calendario…' }]
      .concat(P().TEMPLATES.filter(function (t) { return t.id !== 'blank'; }).map(function (t, i) { return { value: 'tpl:' + t.id, label: t.name, icon: t.icon, desc: t.desc, gap: i === 0 }; }))
      .concat([{ value: 'import', label: 'Importar un archivo .md o .txt', icon: 'upload', gap: true }]);
    var pick = function (v) {
      if (!v) return;
      if (v === 'blank') create({ parent: o.parent, team: o.team });
      else if (v === 'db') create({ kind: 'db', parent: o.parent, team: o.team });
      else if (v === 'import') importFile(o);
      else create({ template: v.slice(4), parent: o.parent, team: o.team });
    };
    if (anchor && desk()) W.Menu.open(anchor, items, { title: 'Nueva página' }).then(pick);
    else W.Sheet.choose({ title: 'Nueva página', options: items.map(function (x) { return { value: x.value, label: x.label, icon: x.icon, desc: x.desc }; }) }).then(pick);
  }
  function importFile(o) {
    var input = U.el('input', { attrs: { type: 'file', accept: '.md,.markdown,.txt,text/markdown,text/plain' }, style: { position: 'fixed', left: '-9999px' } });
    input.addEventListener('change', function () {
      var f = input.files && input.files[0]; if (!f) return;
      var r = new FileReader();
      r.onload = function () {
        var text = String(r.result || ''), m = text.match(/^#\s+(.+)$/m), title = m ? m[1].trim() : f.name.replace(/\.(md|markdown|txt)$/i, '');
        if (m) text = text.replace(m[0], '');
        var pg = P().create({ title: title, parent: o.parent || null, team: o.team || null, blocks: P().fromMarkdown(text) });
        W.Toast.show({ text: '«' + title + '» importada', icon: 'check', type: 'success' });
        open(pg.id);
      };
      r.readAsText(f);
      setTimeout(function () { if (input.parentNode) input.parentNode.removeChild(input); }, 1000);
    });
    document.body.appendChild(input); input.click();
  }

  /* ---------- Menús de cada página ---------- */
  function pageMenu(id, anchor) {
    var m = P().get(id); if (!m) return;
    var o = m.opts || {};
    var items = [
      { value: 'fav', label: m.fav ? 'Quitar de favoritas' : 'Añadir a favoritas', icon: 'star' },
      { value: 'sub', label: 'Nueva subpágina', icon: 'plus' },
      { value: 'dup', label: 'Duplicar', icon: 'copy' },
      { value: 'move', label: 'Mover a…', icon: 'right' },
      teams().length ? { value: 'team', label: m.team ? 'Pasar a mis páginas' : 'Compartir con un equipo…', icon: 'users' } : null,
      { value: 'full', label: o.full ? 'Ancho normal' : 'Ancho completo', icon: 'expand', gap: true },
      { value: 'font', label: 'Letra: ' + ({ sans: 'normal', serif: 'con serifa', mono: 'monoespaciada' }[o.font || 'sans']), icon: 'type' },
      { value: 'small', label: o.small ? 'Texto normal' : 'Texto pequeño', icon: 'type' },
      { value: 'lock', label: o.lock ? 'Desbloquear la página' : 'Bloquear (solo lectura)', icon: 'lock' },
      { value: 'md', label: 'Exportar a Markdown', icon: 'download', gap: true },
      W.Layout.desktop ? { value: 'print', label: 'Imprimir o guardar en PDF', icon: 'print' } : null,
      { value: 'trash', label: 'Mover a la papelera', icon: 'trash', destructive: true, gap: true }
    ].filter(Boolean);
    W.Menu.open(anchor, items, { title: P().title(m) }).then(function (v) {
      if (!v) return;
      if (v === 'fav') { P().update(id, { fav: !m.fav }); W.Toast.show({ text: m.fav ? 'En favoritas' : 'Quitada de favoritas', icon: 'star' }); }
      else if (v === 'sub') create({ parent: id });
      else if (v === 'dup') { var c = P().duplicate(id); W.Toast.show({ text: 'Página duplicada', icon: 'copy' }); open(c.id); }
      else if (v === 'move') moveSheet(id);
      else if (v === 'team') teamSheet(id);
      else if (v === 'full') { P().update(id, { opts: Object.assign({}, o, { full: !o.full }) }); drawPane(); }
      else if (v === 'font') W.Menu.open(anchor, [['sans', 'Normal'], ['serif', 'Con serifa'], ['mono', 'Monoespaciada']].map(function (x) { return { value: x[0], label: x[1], on: (o.font || 'sans') === x[0] }; })).then(function (f) { if (f) { P().update(id, { opts: Object.assign({}, o, { font: f }) }); drawPane(); } });
      else if (v === 'small') { P().update(id, { opts: Object.assign({}, o, { small: !o.small }) }); drawPane(); }
      else if (v === 'lock') { P().update(id, { opts: Object.assign({}, o, { lock: !o.lock }) }); drawPane(); W.Toast.show({ text: o.lock ? 'Página desbloqueada' : 'Página bloqueada: nadie la cambia sin querer', icon: 'lock' }); }
      else if (v === 'md') { U.saveFile(slug(P().title(m)), P().toMarkdown(id), 'md'); }
      else if (v === 'print') printPage(id);
      else if (v === 'trash') trash(id);
    });
  }
  function slug(t) { return (W.Parse.fold(t || 'pagina').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'pagina').slice(0, 60); }
  function trash(id) {
    var m = P().get(id); if (!m) return;
    var parent = m.parent;
    P().remove(id);
    W.Toast.show({ text: '«' + P().title(m) + '» está en la papelera', icon: 'trash', action: { label: 'Deshacer', fn: function () { P().restore(id); open(id); } } });
    if (ui().page === id || P().path(ui().page || '').some(function (x) { return x.id === id; })) open(parent && P().get(parent) && !P().get(parent).trash ? parent : null);
  }
  function printPage(id) {
    document.body.classList.add('printing-page');
    var done = function () { document.body.classList.remove('printing-page'); window.removeEventListener('afterprint', done); };
    window.addEventListener('afterprint', done);
    setTimeout(function () { window.print(); setTimeout(done, 1500); }, 60);
    void id;
  }
  function moveSheet(id) {
    var m = P().get(id); if (!m) return;
    var blocked = {}; blocked[id] = 1; P().descendants(id).forEach(function (d) { blocked[d.id] = 1; });
    var opts = [{ value: '__root', label: m.team ? 'Raíz del equipo' : 'Mis páginas (sin página madre)', icon: 'home' }];
    var walk = function (parent, depth, team) {
      P().children(parent, team).forEach(function (c) {
        if (blocked[c.id] || c.kind === 'db') return;
        opts.push({ value: c.id, label: new Array(depth + 1).join('   ') + P().title(c), icon: c.icon || 'page' });
        walk(c.id, depth + 1, team);
      });
    };
    walk(null, 0, m.team || null);
    W.Sheet.choose({ title: 'Mover «' + P().title(m) + '» a', options: opts, value: m.parent || '__root' }).then(function (v) {
      if (!v) return;
      P().move(id, v === '__root' ? null : v);
      if (v !== '__root') ui().treeOpen[v] = true;
      W.Toast.show({ text: 'Página movida', icon: 'check' });
      drawTree(); drawPane();
    });
  }
  function teamSheet(id) {
    var m = P().get(id); if (!m) return;
    if (m.team) {
      W.Sheet.confirm({ title: '¿Pasar a tus páginas?', text: 'Dejará de estar en el equipo para los demás.', ok: 'Pasar a mis páginas' }).then(function (ok) {
        if (!ok) return;
        if (W.PageSync) W.PageSync.leaveTeam(id);
        P().move(id, null);
        [P().get(id)].concat(P().descendants(id)).forEach(function (x) { P().update(x.id, { team: null }); });
        drawTree(); drawPane();
      });
      return;
    }
    if (!W.Plan.gate('community')) return;
    W.Sheet.choose({ title: 'Compartir «' + P().title(m) + '» con', options: teams().map(function (t) { return { value: t.id, label: t.name, icon: t.icon }; }) }).then(function (sid) {
      if (!sid) return;
      [P().get(id)].concat(P().descendants(id)).forEach(function (x) { P().update(x.id, { team: sid }); });
      P().update(id, { parent: null });
      W.Toast.show({ text: 'Compartida con el equipo. Podéis editarla a la vez.', icon: 'users', type: 'success' });
      drawTree(); drawPane();
    });
  }
  function iconSheet(id) {
    var m = P().get(id);
    var grid = U.el('div.pg-icons', P().ICONS.map(function (ic) {
      return U.el('button.pg-icon-opt' + (m.icon === ic ? '.on' : ''), { attrs: { type: 'button', 'aria-label': ic }, on: { click: function () { P().update(id, { icon: ic }); s.close(); drawPane(); drawTree(); } } }, [U.icon(ic)]);
    }));
    var s = W.Sheet.open({ title: 'Icono', body: [grid], foot: [U.el('button.btn.ghost', { text: 'Quitar el icono', on: { click: function () { P().update(id, { icon: null }); s.close(); drawPane(); drawTree(); } } })] });
  }
  function coverSheet(id) {
    var m = P().get(id);
    var grid = U.el('div.pg-covers', P().COVERS.map(function (c) {
      return U.el('button.pg-cover-opt.cv-' + c.id + (m.cover === c.id ? '.on' : ''), { attrs: { type: 'button' }, on: { click: function () { P().update(id, { cover: c.id }); s.close(); drawPane(); } } }, [U.el('span', { text: c.name })]);
    }));
    var s = W.Sheet.open({ title: 'Portada', body: [grid], foot: [U.el('button.btn.ghost', { text: 'Quitar la portada', on: { click: function () { P().update(id, { cover: null }); s.close(); drawPane(); } } })] });
  }

  /* ---------- Árbol de páginas ---------- */
  function treeItem(m, depth) {
    var u = ui(), kids = m.kind === 'db' ? [] : P().children(m.id).filter(function (c) { return !P().isRow(c); });
    var opened = !!u.treeOpen[m.id], active = ui().page === m.id;
    var item = U.el('div.pt-item' + (active ? '.active' : ''), { attrs: { 'data-id': m.id, draggable: desk() ? 'true' : 'false', role: 'treeitem', 'aria-expanded': kids.length ? String(opened) : null }, style: { '--d': depth } });
    var tw = U.el('button.pt-tw' + (kids.length ? '' : '.leaf') + (opened ? '.open' : ''), { attrs: { type: 'button', tabindex: '-1', 'aria-label': opened ? 'Plegar' : 'Desplegar' }, on: { click: function (e) { e.stopPropagation(); u.treeOpen[m.id] = !opened; drawTree(); } } }, [U.icon('right')]);
    var main = U.el('button.pt-main', { attrs: { type: 'button' }, on: { click: function () { open(m.id); } } }, [U.el('span.pt-ic', [U.icon(m.icon || (m.kind === 'db' ? 'database' : 'page'))]), U.el('span.pt-t', { text: P().title(m) })]);
    var acts = U.el('span.pt-acts', [
      U.el('button.pt-act', { attrs: { type: 'button', 'aria-label': 'Más opciones', title: 'Más opciones' }, on: { click: function (e) { e.stopPropagation(); pageMenu(m.id, e.currentTarget); } } }, [U.icon('dots')]),
      m.kind === 'db' ? null : U.el('button.pt-act', { attrs: { type: 'button', 'aria-label': 'Nueva subpágina', title: 'Nueva subpágina' }, on: { click: function (e) { e.stopPropagation(); newMenu(e.currentTarget, { parent: m.id, team: m.team }); } } }, [U.icon('plus')])
    ]);
    item.appendChild(tw); item.appendChild(main); item.appendChild(acts);
    item.addEventListener('contextmenu', function (e) { e.preventDefault(); pageMenu(m.id, e.target); });
    if (desk()) {
      item.addEventListener('dragstart', function (e) { e.dataTransfer.setData(TREE_DRAG, m.id); e.dataTransfer.effectAllowed = 'move'; item.classList.add('dragging'); });
      item.addEventListener('dragend', function () { item.classList.remove('dragging'); });
      item.addEventListener('dragover', function (e) {
        if (Array.prototype.indexOf.call(e.dataTransfer.types, TREE_DRAG) < 0) return;
        e.preventDefault();
        var r = item.getBoundingClientRect(), y = e.clientY - r.top;
        item.classList.toggle('drop-before', y < r.height * 0.28);
        item.classList.toggle('drop-in', y >= r.height * 0.28 && m.kind !== 'db');
      });
      item.addEventListener('dragleave', function () { item.classList.remove('drop-before', 'drop-in'); });
      item.addEventListener('drop', function (e) {
        var id = e.dataTransfer.getData(TREE_DRAG), before = item.classList.contains('drop-before');
        item.classList.remove('drop-before', 'drop-in');
        if (!id || id === m.id) return;
        e.preventDefault();
        if (before) P().move(id, m.parent, m.id);
        else if (m.kind !== 'db') { P().move(id, m.id); ui().treeOpen[m.id] = true; }
        drawTree();
      });
    }
    var out = [item];
    if (opened) kids.forEach(function (k) { out = out.concat(treeItem(k, depth + 1)); });
    if (opened && !kids.length && m.kind !== 'db') out.push(U.el('div.pt-none', { style: { '--d': depth + 1 }, text: 'Sin páginas dentro' }));
    return out;
  }
  function section(title, items, action) {
    return U.el('div.pt-sec', [U.el('div.pt-h', [U.el('span', { text: title }), action || null]), U.el('div.pt-list', { attrs: { role: 'tree' } }, items)]);
  }
  function drawTree() {
    if (!treeEl) return;
    var st = S();
    U.clear(treeEl);
    var search = U.el('input.input.pt-search', { attrs: { type: 'search', placeholder: 'Buscar en el Cuaderno', 'aria-label': 'Buscar en el Cuaderno' } });
    search.value = searchQ;
    search.addEventListener('input', U.debounce(function () { searchQ = search.value; drawTree(); var s2 = treeEl.querySelector('.pt-search'); if (s2) { s2.focus(); s2.setSelectionRange(s2.value.length, s2.value.length); } }, 160));
    treeEl.appendChild(U.el('div.pt-top', [search, U.el('button.btn.sm.primary.pt-new', { attrs: { title: 'Nueva página (Alt N)', 'aria-label': 'Nueva página' }, on: { click: function (e) { newMenu(e.currentTarget, {}); } } }, [U.icon('plus', 'sm')])]));
    if (searchQ.trim()) {
      var res = P().search(searchQ, 40);
      treeEl.appendChild(section('Resultados (' + res.length + ')', res.length ? res.map(function (r) {
        return U.el('button.pt-res', { attrs: { type: 'button' }, on: { click: function () { open(r.page.id); } } }, [U.el('span.pt-ic', [U.icon(r.page.icon || (r.page.kind === 'db' ? 'database' : 'page'))]),
          U.el('span.pt-res-main', [U.el('b', { text: P().title(r.page) }), r.hit ? U.el('small', { text: r.hit }) : r.page.parent ? U.el('small', { text: 'En ' + P().title(r.page.parent) }) : null])]);
      }) : [U.el('div.pt-none', { text: 'No hay nada con «' + searchQ.trim() + '»' })]));
      return;
    }
    var favs = P().favorites().filter(function (m) { return !P().isRow(m) || true; });
    if (favs.length) treeEl.appendChild(section('Favoritas', favs.map(function (m) {
      return U.el('button.pt-res.fav' + (ui().page === m.id ? '.active' : ''), { attrs: { type: 'button' }, on: { click: function () { open(m.id); } } }, [U.el('span.pt-ic', [U.icon(m.icon || 'page')]), U.el('span.pt-t', { text: P().title(m) })]);
    })));
    var roots = P().children(null, null).filter(function (m) { return !m.team; });
    var mine = [];
    roots.forEach(function (m) { mine = mine.concat(treeItem(m, 0)); });
    treeEl.appendChild(section('Mis páginas', mine.length ? mine : [U.el('div.pt-none', { text: 'Crea tu primera página' })],
      U.el('button.pt-h-add', { attrs: { type: 'button', 'aria-label': 'Nueva página', title: 'Nueva página' }, on: { click: function (e) { newMenu(e.currentTarget, {}); } } }, [U.icon('plus')])));
    teams().forEach(function (t) {
      var items = [];
      P().children(null, t.id).forEach(function (m) { items = items.concat(treeItem(m, 0)); });
      treeEl.appendChild(section(t.name, items.length ? items : [U.el('div.pt-none', { text: 'Aún no hay páginas del equipo' })],
        U.el('button.pt-h-add', { attrs: { type: 'button', 'aria-label': 'Nueva página del equipo', title: 'Nueva página del equipo' }, on: { click: function (e) { if (W.Plan.gate('community')) newMenu(e.currentTarget, { team: t.id }); } } }, [U.icon('plus')])));
    });
    var trashN = P().trash().length;
    treeEl.appendChild(U.el('div.pt-foot', [
      U.el('button.pt-res', { attrs: { type: 'button' }, on: { click: function (e) { templatesSheet(e.currentTarget); } } }, [U.el('span.pt-ic', [U.icon('sparkle')]), U.el('span.pt-t', { text: 'Plantillas' })]),
      U.el('button.pt-res', { attrs: { type: 'button' }, on: { click: function () { trashSheet(); } } }, [U.el('span.pt-ic', [U.icon('trash')]), U.el('span.pt-t', { text: 'Papelera' }), trashN ? U.el('small.pt-count', { text: String(trashN) }) : null])
    ]));
    void st;
  }
  function templatesSheet() {
    var cards = P().TEMPLATES.map(function (t) {
      return U.el('button.pg-tpl', { attrs: { type: 'button' }, on: { click: function () { s.close(); create({ template: t.id }); } } }, [U.el('span.pg-tpl-ic', [U.icon(t.icon)]), U.el('strong', { text: t.name }), U.el('small', { text: t.desc })]);
    });
    var s = W.Sheet.open({ title: 'Plantillas', className: 'pg-tpl-sheet', body: [U.el('div.pg-tpls', cards)] });
  }
  function trashSheet() {
    var host = U.el('div');
    var draw = function () {
      U.clear(host);
      var list = P().trash();
      if (!list.length) { host.appendChild(W.UI.empty('trash', 'La papelera está vacía', 'Lo que borres del Cuaderno se queda aquí hasta que lo vacíes.', null, true)); return; }
      host.appendChild(W.UI.section({ header: U.plural(list.length, 'página', 'páginas'), items: list.map(function (m) {
        return U.el('div.cell', [W.UI.cellIcon(m.icon || 'page'), U.el('span.cell-main', [U.el('span.cell-title', { text: P().title(m) }), U.el('span.cell-sub', { text: 'Borrada ' + U.fmtRel(m.trash - Date.now()) })]),
          U.el('span.cell-row', [U.el('button.btn.xs.soft', { text: 'Recuperar', on: { click: function () { P().restore(m.id); draw(); drawTree(); } } }),
            U.el('button.btn.xs.ghost', { text: 'Borrar', on: { click: function () { W.Sheet.confirm({ title: '¿Borrar «' + P().title(m) + '» para siempre?', ok: 'Borrar', danger: true }).then(function (ok) { if (ok) { P().destroy(m.id); draw(); drawTree(); } }); } } })])]);
      }) }));
    };
    draw();
    W.Sheet.open({ title: 'Papelera', body: [host], foot: [U.el('button.btn.ghost', { text: 'Vaciar la papelera', on: { click: function () {
      W.Sheet.confirm({ title: '¿Vaciar la papelera?', text: 'Se borra todo para siempre.', ok: 'Vaciar', danger: true }).then(function (ok) { if (ok) { P().emptyTrash(); draw(); drawTree(); } });
    } } })] });
  }

  /* ---------- Página ---------- */
  function wordCount(id) {
    var n = 0;
    P().content(id).blocks.forEach(function (b) { var t = P().plain(b.x || '').trim(); if (t) n += t.split(/\s+/).length; });
    return n;
  }
  function closeEditor() { if (cur && cur.editor) { cur.editor.destroy(); } cur = null; hideKb(); }
  function drawPane(opts) {
    if (!paneEl) return;
    opts = opts || {};
    var id = openId();
    closeEditor();
    U.clear(paneEl);
    paneEl.className = 'pg-pane';
    if (!id) { paneEl.appendChild(desk() ? homeDesk() : U.el('div')); return; }
    var m = P().get(id), o = m.opts || {}, ro = !!o.lock;
    paneEl.classList.toggle('full', !!o.full);
    paneEl.setAttribute('data-font', o.font || 'sans');
    paneEl.classList.toggle('small', !!o.small);
    // Migas de pan y acciones
    var crumbs = U.el('nav.pg-crumbs', { attrs: { 'aria-label': 'Ruta de la página' } });
    var path = P().path(id);
    if (m.team) { var tm = teams().filter(function (t) { return t.id === m.team; })[0]; crumbs.appendChild(U.el('span.pg-crumb.team', [U.icon('users', 'xs'), U.el('span', { text: tm ? tm.name : 'Equipo' })])); }
    path.forEach(function (p, i) {
      if (i) crumbs.appendChild(U.el('span.pg-sep', { text: '/' }));
      crumbs.appendChild(U.el('button.pg-crumb' + (p.id === id ? '.on' : ''), { attrs: { type: 'button' }, on: { click: function () { open(p.id); } } }, [U.icon(p.icon || (p.kind === 'db' ? 'database' : 'page'), 'xs'), U.el('span', { text: P().title(p) })]));
    });
    var edited = Math.max(m.at, m.cv);
    var actions = U.el('div.pg-acts', [
      U.el('span.pg-edited', { text: (m.byName && m.team ? m.byName + ' · ' : '') + 'Editada ' + U.fmtRel(edited - Date.now()) }),
      m.team ? U.el('span.pg-live', { attrs: { title: 'Página de equipo: se actualiza sola' } }, [U.el('i'), 'En equipo']) : null,
      U.el('button.nav-icon' + (m.fav ? '.on' : ''), { attrs: { 'aria-label': m.fav ? 'Quitar de favoritas' : 'Añadir a favoritas', title: 'Favorita' }, on: { click: function () { P().update(id, { fav: !m.fav }); drawPane(); drawTree(); } } }, [U.icon(m.fav ? 'star-fill' : 'star')]),
      U.el('button.nav-icon', { attrs: { 'aria-label': 'Más opciones', title: 'Más opciones' }, on: { click: function (e) { pageMenu(id, e.currentTarget); } } }, [U.icon('dots')])
    ]);
    var top = U.el('div.pg-top', [desk() ? crumbs : U.el('button.nav-btn.back', { on: { click: function () { closePage(); } } }, [U.icon('back'), U.el('span', { text: m.parent ? P().title(m.parent).slice(0, 14) : 'Cuaderno' })]), actions]);
    paneEl.appendChild(top);
    var sheet = U.el('article.pg-sheet');
    if (m.cover) sheet.appendChild(U.el('div.pg-cover.cv-' + m.cover, [ro ? null : U.el('button.btn.xs.soft.pg-cover-btn', { text: 'Cambiar portada', on: { click: function () { coverSheet(id); } } })]));
    var head = U.el('header.pg-head' + (m.cover ? '.has-cover' : ''));
    var tool = function (icon, label, fn, hint) { return U.el('button.pg-tool', { attrs: { type: 'button', title: hint || label }, on: { click: fn } }, [U.icon(icon, 'sm'), U.el('span', { text: label })]); };
    var title = U.el('h1.pg-title', { attrs: { contenteditable: ro ? 'false' : 'true', 'data-ph': m.kind === 'db' ? 'Base de datos sin título' : 'Sin título', spellcheck: 'true', role: 'textbox', 'aria-label': 'Título de la página' } });
    title.textContent = m.title || '';
    var syncTitle = function () {
      clearTimeout(titleTimer);
      var t = title.textContent.trim().slice(0, 200);
      if (t !== (P().get(id) || {}).title) P().update(id, { title: t }, { reason: 'title' });
      drawTree();
      var c = paneEl && paneEl.querySelector('.pg-crumb.on span'); if (c) c.textContent = P().title(id);
    };
    title.addEventListener('input', function () {
      clearTimeout(titleTimer);
      title.classList.toggle('is-empty', !title.textContent.trim());
      titleTimer = setTimeout(syncTitle, 300);
    });
    title.addEventListener('blur', syncTitle);
    title.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); syncTitle(); if (cur && cur.editor) cur.editor.focusFirst(); }
      else if (e.key === 'ArrowDown' && cur && cur.editor) { e.preventDefault(); cur.editor.focus('start'); }
    });
    title.addEventListener('paste', function (e) { e.preventDefault(); var t = (e.clipboardData && e.clipboardData.getData('text/plain') || '').replace(/\s+/g, ' '); document.execCommand('insertText', false, t); });
    title.classList.toggle('is-empty', !m.title);
    // El icono va junto al título (no encima de la portada) y debajo, cerrada por una regla, una línea
    // con los datos de la página y sus herramientas: icono, portada y adjuntar
    head.appendChild(U.el('div.pg-titlerow', [
      m.icon ? U.el('button.pg-bigicon', { attrs: { type: 'button', 'aria-label': 'Cambiar el icono', title: 'Cambiar el icono', disabled: ro }, on: { click: function () { iconSheet(id); } } }, [U.icon(m.icon)]) : null,
      title
    ]));
    var words = wordCount(id), nFiles = m.kind === 'db' ? 0 : P().content(id).blocks.filter(function (b) { return b.f; }).length;
    var info = [desk() ? 'Creada ' + U.fmtShort(U.ymd(new Date(m.cat))) : 'Editada ' + U.fmtRel(edited - Date.now())];
    if (words) info.push(U.plural(words, 'palabra', 'palabras'));
    if (nFiles) info.push(U.plural(nFiles, 'adjunto', 'adjuntos'));
    head.appendChild(U.el('div.pg-meta', [
      U.el('span.pg-meta-t', { text: info.join(' · ') }),
      ro ? U.el('span.pg-meta-lock', [U.icon('lock', 'xs'), 'Solo lectura']) : U.el('div.pg-addons', [
        m.icon ? null : tool('smile', 'Icono', function () { iconSheet(id); }, 'Añadir un icono'),
        m.cover ? null : tool('image', 'Portada', function () { coverSheet(id); }, 'Añadir una portada'),
        m.kind === 'db' ? null : tool('paperclip', 'Adjuntar', function () { if (cur && cur.editor) cur.editor.attach(); }, 'Adjuntar fotos o archivos a esta página')
      ])
    ]));
    sheet.appendChild(head);
    // Propiedades si es una fila de una base de datos
    if (P().isRow(m) && W.DbView) {
      var rp = W.DbView.rowProps(id, { readOnly: ro });
      if (rp) sheet.appendChild(rp);
    }
    if (m.kind === 'db') {
      sheet.appendChild(W.DbView.render(id, { inline: false, readOnly: ro, onOpenPage: function (pid, op) { open(pid, op); } }));
    } else {
      var ed = W.Blocks.editor({ pageId: id, readOnly: ro, onOpenPage: function (pid, op) { open(pid, op); }, onFocusBlock: function (b) { if (!desk()) showKb(b); }, onBlur: hideKb });
      cur = { id: id, editor: ed };
      sheet.appendChild(ed.el);
      // Página vacía: plantillas a mano
      var empty = !m.title && P().content(id).blocks.every(function (b) { return !P().plain(b.x || '').trim() && (b.t === 'p'); });
      if (empty && !ro) sheet.appendChild(U.el('div.pg-start', [U.el('small', { text: 'Empieza con una plantilla' }), U.el('div.chips', P().TEMPLATES.filter(function (t) { return t.id !== 'blank'; }).slice(0, 6).map(function (t) {
        return U.el('button.chip', { on: { click: function () { applyTemplate(id, t.id); } } }, [U.icon(t.icon, 'xs'), t.name]);
      }))]));
    }
    if (!cur) cur = { id: id, editor: null };
    // Enlazado desde
    var back = P().backlinks(id);
    if (back.length) sheet.appendChild(U.el('div.pg-backlinks', [U.el('div.sec-h', { text: 'Enlazado desde' }), U.el('div.pg-bl-list', back.map(function (b) {
      return U.el('button.pg-bl', { attrs: { type: 'button' }, on: { click: function () { open(b.id); } } }, [U.icon(b.icon || 'page', 'sm'), U.el('span', { text: P().title(b) })]);
    }))]));
    paneEl.appendChild(sheet);
    if (opts.focusTitle || wantFocus) { wantFocus = false; setTimeout(focusTitle, 30); }
  }
  function applyTemplate(id, tplId) {
    var tp = P().TEMPLATES.filter(function (t) { return t.id === tplId; })[0]; if (!tp) return;
    var m = P().get(id);
    var res = tp.build(m) || {};
    if (res.kind === 'db') {
      var dbm = P().fromTemplate(tplId, { parent: m.parent, team: m.team });
      P().forget(id, Date.now());
      open(dbm.id);
      return;
    }
    P().update(id, { title: m.title || res.title || '', icon: m.icon || res.icon || null, cover: m.cover || res.cover || null });
    P().setBlocks(id, res.blocks || []);
    drawPane(); drawTree();
  }
  function closePage() {
    var id = openId(), m = id ? P().get(id) : null;
    open(m && m.parent && P().get(m.parent) && !P().get(m.parent).trash ? m.parent : null);
  }

  /* ---------- Portada (sin página abierta) ---------- */
  function card(m) {
    var c = U.el('button.pg-card', { attrs: { type: 'button' }, on: { click: function () { open(m.id); } } }, [
      U.el('span.pg-card-cover.cv-' + (m.cover || 'paper'), [U.icon(m.icon || (m.kind === 'db' ? 'database' : 'page'))]),
      U.el('strong', { text: P().title(m) }),
      U.el('small', { text: m.snip || (m.kind === 'db' ? U.plural(P().rows(m.id).length, 'fila', 'filas') : 'Editada ' + U.fmtRel(Math.max(m.at, m.cv) - Date.now())) })
    ]);
    c.addEventListener('contextmenu', function (e) { e.preventDefault(); pageMenu(m.id, c); });
    return c;
  }
  function homeDesk() {
    var recent = P().recent(8), favs = P().favorites();
    var host = U.el('div.pg-home');
    // Cabecera como la del resto de pantallas: título, resumen y la acción principal
    host.appendChild(U.el('div.lt.pg-home-lt', [
      U.el('div.lt-text', [U.el('h1', { text: 'Cuaderno' }), U.el('span.lt-sub', { text: U.plural(P().count(), 'página', 'páginas') + ' · Escribe «/» en una página para insertar bloques, archivos o bases de datos' })]),
      U.el('button.btn.sm.primary', { on: { click: function (e) { newMenu(e.currentTarget, {}); } } }, [U.icon('plus', 'sm'), 'Nueva página'])
    ]));
    if (favs.length) host.appendChild(U.el('div.pg-home-sec', [U.el('div.sec-t', [U.el('span', { text: 'Favoritas' })]), U.el('div.pg-cards', favs.slice(0, 8).map(card))]));
    host.appendChild(U.el('div.pg-home-sec', [U.el('div.sec-t', [U.el('span', { text: 'Recientes' })]), recent.length ? U.el('div.pg-cards', recent.map(card)) : U.el('p.hint', { text: 'Aún no hay páginas. Crea la primera o empieza con una plantilla.' })]));
    host.appendChild(U.el('div.pg-home-sec', [U.el('div.sec-t', [U.el('span', { text: 'Plantillas' })]), U.el('div.pg-tpls', P().TEMPLATES.map(function (t) {
      return U.el('button.pg-tpl', { attrs: { type: 'button' }, on: { click: function () { create({ template: t.id }); } } }, [U.el('span.pg-tpl-ic', [U.icon(t.icon)]), U.el('strong', { text: t.name }), U.el('small', { text: t.desc })]);
    }))]));
    return host;
  }
  function homeMobile(root) {
    var head = W.UI.header({ title: 'Cuaderno', profile: true, sub: U.plural(P().count(), 'página', 'páginas'), actions: [{ icon: 'search', label: 'Buscar en el Cuaderno', onTap: function () { searchSheet(); } }, { icon: 'plus', label: 'Nueva página', onTap: function () { newMenu(null, {}); } }] });
    var content = [];
    var recent = P().recent(10), favs = P().favorites();
    if (!P().count()) content.push(U.el('div.group', [W.UI.empty('buddy:note', 'Tu cuaderno está vacío', 'Crea páginas, listas, bases de datos y mucho más. Escribe «/» para insertar bloques.', U.el('button.btn.sm.primary', { on: { click: function () { newMenu(null, {}); } } }, [U.icon('plus', 'sm'), 'Nueva página']))]));
    if (favs.length) content.push(W.UI.section({ title: 'Favoritas', items: U.el('div.pg-strip', favs.map(card)) }));
    if (recent.length) content.push(W.UI.section({ title: 'Recientes', items: U.el('div.pg-strip', recent.map(card)) }));
    var mine = []; P().children(null, null).filter(function (m) { return !m.team; }).forEach(function (m) { mine = mine.concat(treeItem(m, 0)); });
    if (mine.length) content.push(W.UI.section({ title: 'Mis páginas', items: U.el('div.group.pt-list.mobile', mine) }));
    teams().forEach(function (t) {
      var items = []; P().children(null, t.id).forEach(function (m) { items = items.concat(treeItem(m, 0)); });
      content.push(W.UI.section({ title: t.name, side: U.el('button.btn.xs.soft', { on: { click: function () { if (W.Plan.gate('community')) newMenu(null, { team: t.id }); } } }, [U.icon('plus', 'sm'), 'Nueva']), items: items.length ? U.el('div.group.pt-list.mobile', items) : [W.UI.cell({ title: 'Aún no hay páginas del equipo', sub: 'Crea una y editadla entre todos' })] }));
    });
    content.push(W.UI.section({ title: 'Plantillas', items: U.el('div.pg-strip', P().TEMPLATES.map(function (t) {
      return U.el('button.pg-tpl', { attrs: { type: 'button' }, on: { click: function () { create({ template: t.id }); } } }, [U.el('span.pg-tpl-ic', [U.icon(t.icon)]), U.el('strong', { text: t.name }), U.el('small', { text: t.desc })]);
    })) }));
    var tn = P().trash().length;
    content.push(U.el('div.group', [W.UI.cell({ icon: 'trash', title: 'Papelera', value: tn ? String(tn) : '', onTap: trashSheet })]));
    W.UI.mount(root, head, content);
  }
  function searchSheet() {
    var input = U.el('input.input', { attrs: { type: 'search', placeholder: 'Busca en títulos y en el texto', 'aria-label': 'Buscar en el Cuaderno' } });
    var list = U.el('div');
    var draw = function () {
      U.clear(list);
      var q = input.value.trim(); if (!q) return;
      var res = P().search(q, 30);
      list.appendChild(res.length ? W.UI.group(res.map(function (r) { return W.UI.cell({ icon: r.page.icon || 'page', title: P().title(r.page), sub: r.hit || (r.page.parent ? 'En ' + P().title(r.page.parent) : ''), onTap: function () { s.close(); open(r.page.id); } }); })) : U.el('p.hint', { text: 'Nada con «' + q + '»' }));
    };
    input.addEventListener('input', U.debounce(draw, 150));
    var s = W.Sheet.open({ title: 'Buscar', full: true, body: [U.el('div.group', [U.el('label.cell', [input])]), list] });
    setTimeout(function () { input.focus(); }, 400);
  }

  /* ---------- Barra sobre el teclado (móvil) ---------- */
  function showKb(b) {
    if (!b || !cur || !cur.editor) { hideKb(); return; }
    if (!kbBar) {
      var btn = function (icon, label, fn) { return U.el('button.kb-btn', { attrs: { type: 'button', 'aria-label': label, title: label }, on: { mousedown: function (e) { e.preventDefault(); }, touchstart: function (e) { e.preventDefault(); fn(); }, click: function (e) { e.preventDefault(); fn(); } } }, [U.icon(icon)]); };
      // Abrir el selector de archivos exige un toque completo (touchstart no cuenta como gesto): va con click
      var tapBtn = function (icon, label, fn) { return U.el('button.kb-btn', { attrs: { type: 'button', 'aria-label': label, title: label }, on: { mousedown: function (e) { e.preventDefault(); }, click: function (e) { e.preventDefault(); fn(); } } }, [U.icon(icon)]); };
      kbBar = U.el('div.kb-bar', { attrs: { role: 'toolbar', 'aria-label': 'Herramientas del editor' } }, [
        btn('plus', 'Insertar bloque', function () { cur && cur.editor && cur.editor.insertBlock('/'); }),
        tapBtn('paperclip', 'Adjuntar una foto o un archivo', function () { cur && cur.editor && cur.editor.attach(); }),
        btn('checklist', 'Casilla', function () { cur && cur.editor && cur.editor.insertBlock('todo'); }),
        btn('h1', 'Título', function () { cur && cur.editor && cur.editor.insertBlock('h2'); }),
        btn('bullets', 'Lista', function () { cur && cur.editor && cur.editor.insertBlock('ul'); }),
        btn('right', 'Sangrar', function () { cur && cur.editor && cur.editor.insertBlock('in'); }),
        btn('left', 'Quitar sangría', function () { cur && cur.editor && cur.editor.insertBlock('out'); }),
        btn('at', 'Mencionar', function () { cur && cur.editor && cur.editor.insertBlock('@'); }),
        btn('undo', 'Deshacer', function () { cur && cur.editor && cur.editor.undo(); }),
        btn('down', 'Ocultar el teclado', function () { if (document.activeElement) document.activeElement.blur(); hideKb(); })
      ]);
      document.body.appendChild(kbBar);
      var place = function () {
        if (!kbBar) return;
        var vv = window.visualViewport;
        var bottom = vv ? Math.max(0, window.innerHeight - vv.height - vv.offsetTop) : 0;
        kbBar.style.bottom = bottom + 'px';
      };
      if (window.visualViewport) { window.visualViewport.addEventListener('resize', place); window.visualViewport.addEventListener('scroll', place); }
      kbBar._place = place;
    }
    kbBar.classList.add('show');
    document.body.classList.add('kb-editing');
    kbBar._place();
  }
  function hideKb() { if (kbBar) kbBar.classList.remove('show'); document.body.classList.remove('kb-editing'); }

  /* ---------- Pantalla ---------- */
  W.Screens.notes = {
    title: 'Cuaderno',
    /** Atrás en el móvil: de la página a su página madre o a la portada del Cuaderno */
    back: function () { if (!desk() && openId()) { closePage(); return true; } return false; },
    reset: function () { if (!desk() && openId()) { open(null); return true; } return false; },
    render: function (root, full) {
      screenRoot = root;
      if (!W.Blocks || !W.DbView) {
        if (!root.querySelector('.pg-loading')) { U.clear(root); root.appendChild(U.el('div.pg-loading', [W.Character.illustration('note', 'happy', 84), U.el('p', { text: 'Abriendo tu Cuaderno…' })])); }
        ensureEditor().then(function () { if (S().activeScreen === 'notes') W.Screens.notes.render(root, true); }).catch(function () {
          U.clear(root); root.appendChild(W.UI.empty('buddy:note:worried', 'No se pudo abrir el Cuaderno', 'Comprueba tu conexión y vuelve a intentarlo.', null));
        });
        return;
      }
      if (!unsub) unsub = P().subscribe(function (r) {
        if (S().activeScreen !== 'notes') return;
        var id = openId();
        if (r.remote && id && (r.remote === id || r.remote === true) && cur && cur.editor) { cur.editor.remote(); }
        if (r.create || r.meta || r.title || r.trash || r.restore || r.destroy || r.move || r.import || r.remote || r.team || r.reset || r.schema) drawTree();
        if ((r.trash || r.destroy || r.reset || r.team) && ui().page && !openId()) drawPane();
        if (r.remote && id && r.remote !== id && cur && !cur.editor) drawPane();
      });
      var id = openId();
      if (desk()) {
        var shell = root.querySelector('.pg-shell');
        if (!shell || full) {
          closeEditor();
          U.clear(root);
          treeEl = U.el('aside.pg-tree', { attrs: { 'aria-label': 'Páginas del Cuaderno' } });
          paneEl = U.el('section.pg-pane');
          shell = U.el('div.pg-shell', [treeEl, paneEl]);
          root.appendChild(shell);
          drawTree(); drawPane();
        } else {
          drawTree();
          if (!cur || cur.id !== id) drawPane();
          else if (cur && cur.editor) cur.editor.refreshLive();
        }
        return;
      }
      // Móvil: portada o página a pantalla completa
      if (!id) {
        closeEditor(); treeEl = null; paneEl = null;
        homeMobile(root);
        return;
      }
      if (full || !root.querySelector('.pg-pane') || !cur || cur.id !== id) {
        closeEditor();
        U.clear(root);
        treeEl = null;
        paneEl = U.el('section.pg-pane');
        root.appendChild(U.el('div.pg-mobile', [paneEl]));
        drawPane();
      } else if (cur && cur.editor) cur.editor.refreshLive();
    }
  };

  // Compatibilidad con la 6.0 (atajos, menú de la app y búsqueda): W.Notes.open(id|null)
  W.Notes = {
    open: function (id) {
      if (!id) { if (W.Router && S().activeScreen !== 'notes') W.Router.go('notes'); setTimeout(function () { create({}); }, S().activeScreen === 'notes' ? 0 : 120); return; }
      var pid = P().get(id) ? id : ('pg_n' + String(id)).replace(/[^A-Za-z0-9_-]/g, '').slice(0, 58);
      open(P().get(pid) ? pid : null);
    },
    title: function (n) { return n && n.title ? n.title : 'Sin título'; },
    newPage: function (o) { if (S().activeScreen !== 'notes') W.Router.go('notes'); return create(o || {}); },
    openPage: open,
    menu: newMenu
  };
})(window.Whider);
