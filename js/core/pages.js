/**
 * WHIDER · Cuaderno: páginas, bloques y bases de datos
 *
 * Cada página tiene su ficha (título, icono, portada, página madre, favorita, papelera…) en un
 * índice, y su contenido (bloques) aparte: así abrir el Cuaderno no carga el texto de todas
 * las páginas y en la nube cada página es su propio documento.
 *
 *  - Bloques: texto, títulos, listas, casillas, desplegables, citas, avisos, código, separador,
 *    tabla, imagen, enlace, subpágina, base de datos insertada, tarea de WHIDER y agenda de hoy.
 *  - Bases de datos: propiedades (texto, número, selección, estado, fecha, casilla, enlace,
 *    persona…) y vistas (tabla, tablero, lista, calendario y galería) con filtros y orden.
 *  - Enlaces entre páginas (menciones y subpáginas) con «Enlazado desde».
 *  - Plantillas, papelera, duplicar, exportar a Markdown y búsqueda en todo el texto.
 *  - Los apuntes de versiones anteriores se convierten en páginas (sin duplicados).
 *
 * Almacén local: índice en whider.pages.v1 y cada página en whider.page.<id>
 * (con el mismo espejo nativo de Android que el resto de datos).
 */
window.Whider = window.Whider || {};

(function (W) {
  'use strict';
  var U = W.U;
  var IDX_KEY = 'whider.pages.v1', PAGE_KEY = 'whider.page.';
  var ID_RE = /^[A-Za-z0-9_-]{3,60}$/;
  function st() { return W.State.storage; }

  /* ---------- Tipos de bloque ---------- */
  var BLOCKS = {
    p: { label: 'Texto', icon: 'type', desc: 'Un párrafo normal', text: true, keys: ['texto', 'parrafo', 'text'] },
    h1: { label: 'Título 1', icon: 'h1', desc: 'Título grande de sección', text: true, md: '#', keys: ['titulo', 'h1', 'encabezado'] },
    h2: { label: 'Título 2', icon: 'h2', desc: 'Título mediano', text: true, md: '##', keys: ['titulo2', 'h2', 'subtitulo'] },
    h3: { label: 'Título 3', icon: 'h3', desc: 'Título pequeño', text: true, md: '###', keys: ['titulo3', 'h3'] },
    ul: { label: 'Lista con viñetas', icon: 'bullets', desc: 'Una lista sencilla', text: true, md: '-', keys: ['lista', 'vinetas', 'bullet'] },
    ol: { label: 'Lista numerada', icon: 'numbers', desc: 'Una lista con números', text: true, md: '1.', keys: ['numerada', 'numeros', 'ol'] },
    todo: { label: 'Lista de tareas', icon: 'checklist', desc: 'Casillas para marcar', text: true, md: '[]', keys: ['tareas', 'casilla', 'todo', 'checklist'] },
    toggle: { label: 'Desplegable', icon: 'toggle', desc: 'Oculta contenido dentro', text: true, md: '>', keys: ['desplegable', 'toggle', 'acordeon'] },
    quote: { label: 'Cita', icon: 'quote', desc: 'Para destacar una frase', text: true, md: '"', keys: ['cita', 'quote'] },
    callout: { label: 'Aviso', icon: 'callout', desc: 'Un recuadro para destacar', text: true, keys: ['aviso', 'callout', 'nota', 'destacado'] },
    code: { label: 'Código', icon: 'code', desc: 'Texto con formato de código', text: true, md: '```', keys: ['codigo', 'code'] },
    hr: { label: 'Separador', icon: 'divider', desc: 'Una línea para separar', md: '---', keys: ['separador', 'linea', 'divider'] },
    table: { label: 'Tabla', icon: 'table', desc: 'Una tabla sencilla', keys: ['tabla', 'table'] },
    img: { label: 'Imagen', icon: 'image', desc: 'Una foto de tu dispositivo o de un enlace', keys: ['imagen', 'foto', 'image', 'galeria'] },
    file: { label: 'Archivo', icon: 'paperclip', desc: 'PDF, documento, hoja de cálculo o cualquier archivo', keys: ['archivo', 'adjunto', 'adjuntar', 'documento', 'pdf', 'subir', 'file'] },
    bookmark: { label: 'Enlace web', icon: 'link', desc: 'Una tarjeta con un enlace', keys: ['enlace', 'web', 'url', 'link'] },
    page: { label: 'Página', icon: 'page', desc: 'Una subpágina dentro de esta', keys: ['pagina', 'subpagina', 'page'] },
    db: { label: 'Base de datos', icon: 'database', desc: 'Tabla, tablero, calendario…', keys: ['base', 'datos', 'database', 'tablero'] },
    task: { label: 'Tarea de WHIDER', icon: 'tasks', desc: 'Crea una tarea real con aviso', keys: ['tarea', 'whider', 'aviso'] },
    agenda: { label: 'Agenda de hoy', icon: 'sun', desc: 'Tus tareas de hoy, siempre al día', keys: ['agenda', 'hoy'] },
    toc: { label: 'Índice', icon: 'list', desc: 'Los títulos de esta página', keys: ['indice', 'contenido', 'toc'] }
  };
  var TEXT_TYPES = {};
  Object.keys(BLOCKS).forEach(function (k) { if (BLOCKS[k].text) TEXT_TYPES[k] = true; });

  /* ---------- Propiedades y vistas de las bases de datos ---------- */
  var PROPS = {
    title: { label: 'Nombre', icon: 'type' },
    text: { label: 'Texto', icon: 'type' },
    number: { label: 'Número', icon: 'hash' },
    select: { label: 'Selección', icon: 'down' },
    multi: { label: 'Varias opciones', icon: 'layers' },
    status: { label: 'Estado', icon: 'target' },
    date: { label: 'Fecha', icon: 'calendar' },
    check: { label: 'Casilla', icon: 'check' },
    url: { label: 'Enlace', icon: 'link' },
    person: { label: 'Persona', icon: 'user' },
    created: { label: 'Creada', icon: 'clock' },
    updated: { label: 'Editada', icon: 'clock' }
  };
  var VIEWS = {
    table: { label: 'Tabla', icon: 'table' },
    board: { label: 'Tablero', icon: 'board' },
    list: { label: 'Lista', icon: 'list' },
    calendar: { label: 'Calendario', icon: 'calendar' },
    gallery: { label: 'Galería', icon: 'grid' }
  };
  var COVERS = [
    { id: 'lines', name: 'Líneas' }, { id: 'dots', name: 'Puntos' }, { id: 'grid', name: 'Cuadrícula' },
    { id: 'waves', name: 'Ondas' }, { id: 'fade', name: 'Degradado' }, { id: 'night', name: 'Noche' },
    { id: 'paper', name: 'Papel' }, { id: 'rays', name: 'Rayos' }
  ];
  var ICONS = ['page', 'notebook', 'book', 'briefcase', 'target', 'star', 'bolt', 'flag', 'heart', 'leaf', 'sun', 'moon', 'code',
    'music', 'cart', 'wallet', 'dumbbell', 'gift', 'paw', 'users', 'chat', 'calendar', 'clock', 'pin', 'gem', 'trophy', 'crown',
    'sparkle', 'coffee', 'camera', 'mail', 'home', 'system', 'chart', 'database', 'board', 'list', 'smile', 'key', 'shield'];

  /* ---------- Limpieza de datos ---------- */
  function num(v, d) { return typeof v === 'number' && isFinite(v) ? v : d; }
  function str(v, n) { return typeof v === 'string' ? v.slice(0, n) : ''; }
  function cleanOpts(o) {
    o = o && typeof o === 'object' ? o : {};
    return { full: !!o.full, font: o.font === 'serif' || o.font === 'mono' ? o.font : 'sans', small: !!o.small, lock: !!o.lock };
  }
  function cleanProp(p) {
    if (!p || !ID_RE.test(String(p.id || '')) && p.id !== 'title') return null;
    var type = PROPS[p.type] ? p.type : 'text';
    var out = { id: String(p.id), name: str(p.name, 40) || PROPS[type].label, type: type };
    if (type === 'select' || type === 'multi' || type === 'status') {
      out.opts = (Array.isArray(p.opts) ? p.opts : []).filter(function (o) { return o && ID_RE.test(String(o.id || '')); }).slice(0, 40)
        .map(function (o) { return { id: String(o.id), name: str(o.name, 40) || 'Opción', tone: Math.max(0, Math.min(4, num(o.tone, 0))), group: o.group === 'doing' || o.group === 'done' ? o.group : 'todo' }; });
    }
    if (type === 'number') out.fmt = p.fmt === 'euro' || p.fmt === 'percent' ? p.fmt : 'plain';
    return out;
  }
  function cleanView(v) {
    if (!v || !ID_RE.test(String(v.id || ''))) return null;
    return {
      id: String(v.id), name: str(v.name, 40) || 'Vista', type: VIEWS[v.type] ? v.type : 'table',
      sort: (Array.isArray(v.sort) ? v.sort : []).slice(0, 4).filter(function (x) { return x && x.p; }).map(function (x) { return { p: String(x.p), d: x.d < 0 ? -1 : 1 }; }),
      filter: (Array.isArray(v.filter) ? v.filter : []).slice(0, 8).filter(function (x) { return x && x.p && x.op; }).map(function (x) { return { p: String(x.p), op: String(x.op).slice(0, 12), v: x.v == null ? null : (Array.isArray(x.v) ? x.v.slice(0, 10) : x.v) }; }),
      group: typeof v.group === 'string' ? v.group : null,
      date: typeof v.date === 'string' ? v.date : null,
      hide: Array.isArray(v.hide) ? v.hide.filter(function (x) { return typeof x === 'string'; }).slice(0, 40) : [],
      wide: v.wide && typeof v.wide === 'object' ? v.wide : {}
    };
  }
  function cleanDb(d) {
    if (!d || typeof d !== 'object') return null;
    var props = (Array.isArray(d.props) ? d.props : []).map(cleanProp).filter(Boolean);
    if (!props.some(function (p) { return p.id === 'title'; })) props.unshift({ id: 'title', name: 'Nombre', type: 'title' });
    var views = (Array.isArray(d.views) ? d.views : []).map(cleanView).filter(Boolean);
    if (!views.length) views = [{ id: 'v_table', name: 'Tabla', type: 'table', sort: [], filter: [], group: null, date: null, hide: [], wide: {} }];
    return { props: props.slice(0, 40), views: views.slice(0, 12) };
  }
  function cleanMeta(m) {
    if (!m || !ID_RE.test(String(m.id || ''))) return null;
    var out = {
      id: String(m.id), title: str(m.title, 200), icon: typeof m.icon === 'string' && /^[a-z0-9-]{2,20}$/.test(m.icon) ? m.icon : null,
      cover: typeof m.cover === 'string' && /^[a-z]{2,12}$/.test(m.cover) ? m.cover : null,
      parent: typeof m.parent === 'string' && ID_RE.test(m.parent) ? m.parent : null,
      kind: m.kind === 'db' ? 'db' : 'page', order: num(m.order, 0), fav: !!m.fav,
      at: num(m.at, Date.now()), cat: num(m.cat, num(m.at, Date.now())), cv: num(m.cv, 0), trash: num(m.trash, 0),
      props: m.props && typeof m.props === 'object' && !Array.isArray(m.props) ? m.props : {},
      src: typeof m.src === 'string' ? m.src.slice(0, 80) : null,
      opts: cleanOpts(m.opts), links: Array.isArray(m.links) ? m.links.filter(function (x) { return typeof x === 'string'; }).slice(0, 200) : [],
      snip: str(m.snip, 160), by: typeof m.by === 'string' ? m.by.slice(0, 64) : null, byName: str(m.byName, 40),
      team: typeof m.team === 'string' && /^[A-Za-z0-9_-]{4,40}$/.test(m.team) ? m.team : null
    };
    if (out.kind === 'db') out.db = cleanDb(m.db) || cleanDb({});
    return out;
  }
  function cleanBlock(b) {
    if (!b || !ID_RE.test(String(b.id || ''))) return null;
    var t = BLOCKS[b.t] ? b.t : 'p';
    var out = { id: String(b.id), t: t, at: num(b.at, 0) };
    if (TEXT_TYPES[t] || t === 'page' || t === 'bookmark' || t === 'img') out.x = typeof b.x === 'string' ? b.x.slice(0, 20000) : '';
    if (b.i) out.i = Math.max(0, Math.min(8, num(b.i, 0)));
    if (t === 'todo') out.c = !!b.c;
    if (t === 'toggle') out.o = b.o !== false;
    if (t === 'code') out.l = str(b.l, 20);
    if (t === 'callout') out.ic = typeof b.ic === 'string' && /^[a-z0-9-]{2,20}$/.test(b.ic) ? b.ic : 'bolt';
    if (t === 'page' || t === 'db' || t === 'task') out.ref = typeof b.ref === 'string' ? b.ref.slice(0, 80) : null;
    if (t === 'db') out.view = typeof b.view === 'string' ? b.view.slice(0, 60) : null;
    if (t === 'img') { out.src = typeof b.src === 'string' && (/^data:image\/(png|jpe?g|webp|gif);base64,/.test(b.src) || /^https:\/\//.test(b.src)) ? b.src.slice(0, 400000) : ''; out.w = Math.max(20, Math.min(100, num(b.w, 100))); }
    // Adjuntos (W.Files): solo la referencia; el archivo se guarda aparte
    if ((t === 'img' || t === 'file') && typeof b.f === 'string' && /^[A-Za-z0-9_-]{6,60}$/.test(b.f)) {
      out.f = b.f; out.n = str(b.n, 120); out.m = typeof b.m === 'string' && /^[a-z0-9.+-]+\/[a-z0-9.+-]+$/.test(b.m) ? b.m.slice(0, 100) : 'application/octet-stream';
      out.s = Math.max(0, num(b.s, 0));
      var ar = num(b.ar, 0);
      if (t === 'img' && ar > 0) out.ar = Math.round(Math.max(0.05, Math.min(20, ar)) * 1000) / 1000;
    }
    if (t === 'bookmark') out.url = typeof b.url === 'string' && /^https?:\/\//.test(b.url) ? b.url.slice(0, 600) : '';
    if (t === 'table') {
      var rows = Array.isArray(b.rows) ? b.rows.slice(0, 60) : [['', ''], ['', '']];
      out.rows = rows.map(function (r) { return (Array.isArray(r) ? r : []).slice(0, 12).map(function (c) { return typeof c === 'string' ? c.slice(0, 2000) : ''; }); });
      out.head = b.head !== false;
    }
    return out;
  }
  function cleanContent(c) {
    c = c && typeof c === 'object' ? c : {};
    var seen = {}, blocks = (Array.isArray(c.blocks) ? c.blocks : []).map(cleanBlock).filter(function (b) { if (!b || seen[b.id]) return false; seen[b.id] = 1; return true; });
    var del = {};
    if (c.del && typeof c.del === 'object') Object.keys(c.del).forEach(function (k) { if (typeof c.del[k] === 'number') del[k] = c.del[k]; });
    return { blocks: blocks.slice(0, 3000), del: del };
  }
  function cleanIndex(raw) {
    var out = { v: 1, items: {}, del: {}, dirty: {}, migrated: {} };
    if (!raw || typeof raw !== 'object') return out;
    if (raw.items && typeof raw.items === 'object') Object.keys(raw.items).forEach(function (k) { var m = cleanMeta(raw.items[k]); if (m) out.items[m.id] = m; });
    ['del', 'dirty', 'migrated'].forEach(function (f) {
      if (raw[f] && typeof raw[f] === 'object') Object.keys(raw[f]).forEach(function (k) { if (typeof raw[f][k] === 'number') out[f][k] = raw[f][k]; });
    });
    return out;
  }

  /* ---------- Texto con formato (HTML reducido y seguro) ---------- */
  var ALLOWED = { B: 'b', STRONG: 'b', I: 'i', EM: 'i', U: 'u', S: 's', STRIKE: 's', DEL: 's', CODE: 'code', A: 'a', MARK: 'mark', BR: 'br', SPAN: 'span' };
  var tpl = document.createElement('template');
  function sanitizeNode(node, out) {
    Array.prototype.forEach.call(node.childNodes, function (n) {
      if (n.nodeType === 3) { out.appendChild(document.createTextNode(n.nodeValue)); return; }
      if (n.nodeType !== 1) return;
      var tag = ALLOWED[n.tagName];
      if (n.tagName === 'DIV' || n.tagName === 'P') { if (out.lastChild && out.lastChild.nodeName !== 'BR') out.appendChild(document.createElement('br')); sanitizeNode(n, out); return; }
      if (!tag) { sanitizeNode(n, out); return; }
      if (tag === 'span') {
        var cls = n.getAttribute('class') || '';
        if (!/\bmention\b/.test(cls)) { sanitizeNode(n, out); return; }
        var m = document.createElement('span');
        m.className = 'mention';
        ['data-page', 'data-task', 'data-user', 'data-date'].forEach(function (a) { var v = n.getAttribute(a); if (v && /^[A-Za-z0-9_:-]{1,80}$/.test(v)) m.setAttribute(a, v); });
        m.setAttribute('contenteditable', 'false');
        m.textContent = (n.textContent || '').slice(0, 120);
        out.appendChild(m);
        return;
      }
      var e = document.createElement(tag);
      if (tag === 'a') {
        var href = n.getAttribute('href') || '';
        if (!/^(https?:|mailto:)/i.test(href)) { sanitizeNode(n, out); return; }
        e.setAttribute('href', href.slice(0, 600)); e.setAttribute('target', '_blank'); e.setAttribute('rel', 'noopener noreferrer');
      }
      if (tag !== 'br') sanitizeNode(n, e);
      out.appendChild(e);
    });
  }
  /** Deja solo negrita, cursiva, subrayado, tachado, código, resaltado, enlaces y menciones */
  function sanitize(html) {
    if (!html) return '';
    tpl.innerHTML = String(html);
    var out = document.createElement('div');
    sanitizeNode(tpl.content, out);
    var s = out.innerHTML.replace(/(<br>)+$/, '');
    return s;
  }
  function escapeHtml(s) { return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  /** Texto plano de un fragmento con formato */
  function plain(html) {
    if (!html) return '';
    tpl.innerHTML = String(html).replace(/<br\s*\/?>/gi, '\n');
    return (tpl.content.textContent || '').replace(/ /g, ' ');
  }
  /** Markdown en línea sencillo → HTML seguro (**negrita**, *cursiva*, ~~tachado~~, `código`, [texto](url)) */
  function inlineMd(text) {
    var s = escapeHtml(text);
    s = s.replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
      .replace(/(^|[^*])\*([^*\s][^*]*)\*/g, '$1<i>$2</i>')
      .replace(/~~([^~]+)~~/g, '<s>$1</s>')
      .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
    return s;
  }
  /** HTML con formato → markdown en línea */
  function toInlineMd(html) {
    if (!html) return '';
    tpl.innerHTML = String(html);
    var walk = function (node) {
      var o = '';
      Array.prototype.forEach.call(node.childNodes, function (n) {
        if (n.nodeType === 3) { o += n.nodeValue; return; }
        if (n.nodeType !== 1) return;
        var inner = walk(n), t = n.tagName;
        if (t === 'B' || t === 'STRONG') o += '**' + inner + '**';
        else if (t === 'I' || t === 'EM') o += '*' + inner + '*';
        else if (t === 'S') o += '~~' + inner + '~~';
        else if (t === 'CODE') o += '`' + inner + '`';
        else if (t === 'A') o += '[' + inner + '](' + (n.getAttribute('href') || '') + ')';
        else if (t === 'BR') o += '\n';
        else if (n.classList && n.classList.contains('mention')) o += '@' + inner;
        else o += inner;
      });
      return o;
    };
    return walk(tpl.content);
  }

  /* ---------- Estado ---------- */
  var idx = cleanIndex(st().read(IDX_KEY));
  var cache = {};
  var subs = [], saveTimer = null, notifyTimer = null, pendingReasons = {};

  function saveIndex() { st().write(IDX_KEY, idx); }
  function scheduleSave() { clearTimeout(saveTimer); saveTimer = setTimeout(saveIndex, 120); }
  function emit(reason, id) {
    pendingReasons[reason] = id || true;
    clearTimeout(notifyTimer);
    notifyTimer = setTimeout(function () {
      var r = pendingReasons; pendingReasons = {};
      subs.slice().forEach(function (fn) { try { fn(r); } catch (e) { console.error(e); } });
      if (W.PageSync) W.PageSync.schedule();
    }, 30);
  }
  function markDirty(id, what) { idx.dirty[id] = (idx.dirty[id] || 0) | (what === 'content' ? 2 : 1); }
  function content(id) {
    if (cache[id]) return cache[id];
    var c = cleanContent(st().read(PAGE_KEY + id));
    cache[id] = c;
    return c;
  }
  function writeContent(id) { if (cache[id]) st().write(PAGE_KEY + id, cache[id]); }
  function meta(id) { return idx.items[id] || null; }
  function newId(p) { return U.uid(p || 'pg').replace(/[^A-Za-z0-9_-]/g, ''); }

  /** Siguiente número de orden entre hermanos */
  function lastOrder(parent, team) {
    var max = 0;
    Object.keys(idx.items).forEach(function (k) { var m = idx.items[k]; if (m.parent === parent && (m.team || null) === (team || null) && m.order > max) max = m.order; });
    return max + 1;
  }
  function me() { return W.Auth && W.Auth.user ? W.Auth.user.uid : null; }
  function myName() { return (W.State.displayName && W.State.displayName()) || ''; }

  /* ---------- Enlaces y resumen de cada página ---------- */
  function analyze(id) {
    var c = content(id), m = meta(id), links = {}, snip = '';
    c.blocks.forEach(function (b) {
      if ((b.t === 'page' || b.t === 'db') && b.ref) links[b.ref] = 1;
      if (b.x && b.x.indexOf('data-page') >= 0) b.x.replace(/data-page="([A-Za-z0-9_-]+)"/g, function (all, pid) { links[pid] = 1; return all; });
      if (!snip && TEXT_TYPES[b.t] && b.t !== 'code') { var p = plain(b.x).trim(); if (p) snip = p.slice(0, 160); }
    });
    if (m) { m.links = Object.keys(links).filter(function (k) { return k !== id; }); m.snip = snip; }
  }

  /* ---------- Bloques ---------- */
  function block(t, x, extra) {
    var b = Object.assign({ id: newId('b'), t: t || 'p', x: x || '', at: Date.now() }, extra || {});
    return cleanBlock(b);
  }
  /** Markdown (o texto) → bloques. Sirve para los apuntes antiguos y para pegar texto */
  function fromMarkdown(md) {
    var lines = String(md || '').replace(/\r/g, '').split('\n'), out = [], code = null;
    lines.forEach(function (raw) {
      if (code) {
        if (/^```/.test(raw.trim())) { out.push(block('code', escapeHtml(code.lines.join('\n')), { l: code.lang })); code = null; }
        else code.lines.push(raw);
        return;
      }
      var m = raw.match(/^(\s*)(.*)$/), ind = Math.min(6, Math.floor((m[1].replace(/\t/g, '  ').length) / 2)), line = m[2];
      var ex = ind ? { i: ind } : {};
      var mm;
      if (/^```/.test(line)) { code = { lang: line.replace(/^```/, '').trim().slice(0, 20), lines: [] }; return; }
      if (!line.trim()) return;
      if ((mm = line.match(/^(#{1,3})\s+(.*)$/))) { out.push(block('h' + mm[1].length, inlineMd(mm[2]), ex)); return; }
      if (/^(-{3,}|\*{3,}|_{3,})$/.test(line.trim())) { out.push(block('hr')); return; }
      if ((mm = line.match(/^[-*+]\s+\[([ xX>])\]\s*(.*)$/))) { out.push(block('todo', inlineMd(mm[2]), Object.assign({ c: mm[1] !== ' ' }, ex))); return; }
      if ((mm = line.match(/^\[([ xX])\]\s+(.*)$/))) { out.push(block('todo', inlineMd(mm[2]), Object.assign({ c: mm[1] !== ' ' }, ex))); return; }
      if ((mm = line.match(/^[-*+•]\s+(.*)$/))) { out.push(block('ul', inlineMd(mm[1]), ex)); return; }
      if ((mm = line.match(/^\d+[.)]\s+(.*)$/))) { out.push(block('ol', inlineMd(mm[1]), ex)); return; }
      if ((mm = line.match(/^>\s?(.*)$/))) { out.push(block('quote', inlineMd(mm[1]), ex)); return; }
      out.push(block('p', inlineMd(line), ex));
    });
    if (code) out.push(block('code', escapeHtml(code.lines.join('\n')), { l: code.lang }));
    return out;
  }
  /** Página → Markdown */
  function toMarkdown(id, depth) {
    var m = meta(id); if (!m) return '';
    var c = content(id), lines = ['# ' + (m.title || 'Sin título'), ''], n = 0;
    c.blocks.forEach(function (b, i) {
      var pad = new Array((b.i || 0) + 1).join('  '), x = toInlineMd(b.x || '');
      n = b.t === 'ol' ? (i > 0 && c.blocks[i - 1].t === 'ol' && (c.blocks[i - 1].i || 0) === (b.i || 0) ? n + 1 : 1) : 0;
      switch (b.t) {
        case 'h1': lines.push('', '## ' + x); break;
        case 'h2': lines.push('', '### ' + x); break;
        case 'h3': lines.push('', '#### ' + x); break;
        case 'ul': lines.push(pad + '- ' + x); break;
        case 'ol': lines.push(pad + n + '. ' + x); break;
        case 'todo': lines.push(pad + '- [' + (b.c ? 'x' : ' ') + '] ' + x); break;
        case 'toggle': lines.push(pad + '- ' + x); break;
        case 'quote': lines.push(pad + '> ' + x); break;
        case 'callout': lines.push('> **' + x + '**'); break;
        case 'code': lines.push('```' + (b.l || ''), plain(b.x), '```'); break;
        case 'hr': lines.push('---'); break;
        case 'table': (b.rows || []).forEach(function (r, ri) { lines.push('| ' + r.map(function (cell) { return toInlineMd(cell).replace(/\|/g, '\\|'); }).join(' | ') + ' |'); if (ri === 0) lines.push('|' + r.map(function () { return ' --- '; }).join('|') + '|'); }); break;
        case 'img': lines.push('![' + (plain(b.x) || b.n || '') + '](' + (/^https/.test(b.src || '') ? b.src : 'imagen') + ')'); break;
        case 'file': if (b.n) lines.push(pad + '[Archivo: ' + b.n + ']'); break;
        case 'bookmark': lines.push('[' + (plain(b.x) || b.url) + '](' + b.url + ')'); break;
        case 'page': var sm = meta(b.ref); lines.push(pad + '- ' + (sm ? (sm.title || 'Sin título') : 'Página')); break;
        case 'db': var dm = meta(b.ref); if (dm) lines.push('', '**' + (dm.title || 'Base de datos') + '**', dbMarkdown(dm.id)); break;
        case 'task': var t = W.State.find(b.ref); lines.push(pad + '- [' + (t && t.done ? 'x' : ' ') + '] ' + (t ? t.text : 'Tarea')); break;
        default: if (x) lines.push(pad + x);
      }
    });
    if ((depth || 0) < 1) children(id).forEach(function (ch) { if (ch.kind === 'page' && !c.blocks.some(function (b) { return b.ref === ch.id; })) lines.push('', toMarkdown(ch.id, (depth || 0) + 1)); });
    return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n';
  }
  function dbMarkdown(dbId) {
    var m = meta(dbId); if (!m || !m.db) return '';
    var props = m.db.props, rs = rows(dbId);
    var out = ['| ' + props.map(function (p) { return p.name; }).join(' | ') + ' |', '|' + props.map(function () { return ' --- '; }).join('|') + '|'];
    rs.forEach(function (r) { out.push('| ' + props.map(function (p) { return String(propText(r, p)).replace(/\|/g, '\\|'); }).join(' | ') + ' |'); });
    return out.join('\n');
  }

  /* ---------- Consultas ---------- */
  function alive(m) { return m && !m.trash; }
  function all(opts) {
    opts = opts || {};
    return Object.keys(idx.items).map(function (k) { return idx.items[k]; }).filter(function (m) {
      if (opts.trash) return !!m.trash;
      if (!alive(m)) return false;
      if (opts.team !== undefined && (m.team || null) !== opts.team) return false;
      return true;
    });
  }
  function isRow(m) { var p = m && m.parent ? meta(m.parent) : null; return !!(p && p.kind === 'db'); }
  function children(parent, team) {
    return all().filter(function (m) { return m.parent === (parent || null) && (team === undefined || (m.team || null) === (team || null)); })
      .sort(function (a, b) { return a.order - b.order || a.cat - b.cat; });
  }
  function path(id) {
    var out = [], m = meta(id), guard = 0;
    while (m && guard++ < 20) { out.unshift(m); m = m.parent ? meta(m.parent) : null; }
    return out;
  }
  function title(m) { m = typeof m === 'string' ? meta(m) : m; return m ? (m.title || (m.kind === 'db' ? 'Base de datos sin título' : 'Sin título')) : 'Página'; }
  function descendants(id) {
    var out = [], walk = function (pid) { all({}).concat(all({ trash: true })).forEach(function (m) { if (m.parent === pid && out.indexOf(m) < 0) { out.push(m); walk(m.id); } }); };
    walk(id);
    return out;
  }

  /* ---------- Bases de datos ---------- */
  function rows(dbId) { return children(dbId); }
  function getProp(dbId, propId) { var m = meta(dbId); if (!m || !m.db) return null; for (var i = 0; i < m.db.props.length; i++) if (m.db.props[i].id === propId) return m.db.props[i]; return null; }
  function optName(p, id) { var o = (p.opts || []).filter(function (x) { return x.id === id; })[0]; return o ? o.name : ''; }
  function propValue(row, p) {
    if (p.type === 'title') return row.title || '';
    if (p.type === 'created') return row.cat;
    if (p.type === 'updated') return Math.max(row.at, row.cv || 0);
    return row.props[p.id];
  }
  function propText(row, p) {
    var v = propValue(row, p);
    if (v == null || v === '') return '';
    switch (p.type) {
      case 'select': case 'status': return optName(p, v);
      case 'multi': return (Array.isArray(v) ? v : []).map(function (x) { return optName(p, x); }).filter(Boolean).join(', ');
      case 'date': return typeof v === 'string' ? U.fmtShort(v) : '';
      case 'check': return v ? 'Sí' : 'No';
      case 'number': return fmtNumber(v, p.fmt);
      case 'created': case 'updated': return U.fmtShort(U.ymd(new Date(v)));
      case 'person': return personName(v);
      default: return String(v);
    }
  }
  function fmtNumber(v, fmt) {
    if (typeof v !== 'number') return '';
    var s = v.toLocaleString('es-ES', { maximumFractionDigits: 2 });
    return fmt === 'euro' ? s + ' €' : fmt === 'percent' ? s + ' %' : s;
  }
  function personName(v) {
    if (!v) return '';
    if (v === 'me' || v === me()) return myName() || 'Yo';
    var f = W.State.social && W.State.social.friends[v];
    return f ? f.name || 'Contacto' : 'Persona';
  }
  function cmp(a, b) { if (a == null || a === '') return b == null || b === '' ? 0 : 1; if (b == null || b === '') return -1; return a < b ? -1 : a > b ? 1 : 0; }
  function sortKey(row, p) {
    var v = propValue(row, p);
    if (p.type === 'select' || p.type === 'status') { var i = (p.opts || []).map(function (o) { return o.id; }).indexOf(v); return i < 0 ? null : i; }
    if (p.type === 'multi') return (Array.isArray(v) ? v : []).length ? optName(p, v[0]).toLowerCase() : null;
    if (p.type === 'check') return v ? 0 : 1;
    if (typeof v === 'string') return v.toLowerCase();
    return v;
  }
  function matches(row, f, db) {
    var p = null; for (var i = 0; i < db.props.length; i++) if (db.props[i].id === f.p) p = db.props[i];
    if (!p) return true;
    var v = propValue(row, p), empty = v == null || v === '' || (Array.isArray(v) && !v.length);
    switch (f.op) {
      case 'empty': return empty;
      case 'notempty': return !empty;
      case 'checked': return !!v;
      case 'unchecked': return !v;
      case 'is': return p.type === 'multi' ? (Array.isArray(v) && v.indexOf(f.v) >= 0) : v === f.v;
      case 'not': return p.type === 'multi' ? !(Array.isArray(v) && v.indexOf(f.v) >= 0) : v !== f.v;
      case 'contains': return String(propText(row, p)).toLowerCase().indexOf(String(f.v || '').toLowerCase()) >= 0;
      case 'before': return typeof v === 'string' && f.v && v < f.v;
      case 'after': return typeof v === 'string' && f.v && v > f.v;
      case 'today': return v === U.today();
      case 'week': return typeof v === 'string' && v >= U.today() && v <= U.addDays(U.today(), 7);
      case 'overdue': return typeof v === 'string' && v < U.today();
      case 'gt': return typeof v === 'number' && v > Number(f.v);
      case 'lt': return typeof v === 'number' && v < Number(f.v);
      default: return true;
    }
  }
  /** Filas de una vista: filtradas, ordenadas y (si toca) agrupadas */
  function viewRows(dbId, view, q) {
    var m = meta(dbId); if (!m || !m.db) return [];
    var db = m.db, list = rows(dbId);
    (view && view.filter || []).forEach(function (f) { list = list.filter(function (r) { return matches(r, f, db); }); });
    if (q) { q = q.toLowerCase(); list = list.filter(function (r) { return db.props.some(function (p) { return String(propText(r, p)).toLowerCase().indexOf(q) >= 0; }); }); }
    var sorts = view && view.sort && view.sort.length ? view.sort : [];
    if (sorts.length) list.sort(function (a, b) {
      for (var i = 0; i < sorts.length; i++) { var p = getProp(dbId, sorts[i].p); if (!p) continue; var c = cmp(sortKey(a, p), sortKey(b, p)); if (c) return c * sorts[i].d; }
      return a.order - b.order;
    });
    return list;
  }
  function groups(dbId, view, list) {
    var p = view && view.group ? getProp(dbId, view.group) : null;
    if (!p) return [{ id: null, name: '', rows: list }];
    var out = [];
    if (p.type === 'check') {
      out = [{ id: true, name: 'Hecho', rows: [] }, { id: false, name: 'Sin hacer', rows: [] }];
      list.forEach(function (r) { (r.props[p.id] ? out[0] : out[1]).rows.push(r); });
      return out;
    }
    out = (p.opts || []).map(function (o) { return { id: o.id, name: o.name, tone: o.tone, rows: [] }; });
    var none = { id: null, name: 'Sin ' + p.name.toLowerCase(), rows: [] };
    list.forEach(function (r) {
      var v = r.props[p.id], key = p.type === 'multi' ? (Array.isArray(v) && v[0]) : v;
      var g = out.filter(function (x) { return x.id === key; })[0];
      (g || none).rows.push(r);
    });
    out.push(none);
    return out;
  }
  function newDb(title, parent, opts) {
    opts = opts || {};
    var stId = 'p_estado';
    var db = {
      props: [
        { id: 'title', name: 'Nombre', type: 'title' },
        { id: stId, name: 'Estado', type: 'status', opts: [{ id: 'o_todo', name: 'Sin empezar', tone: 0, group: 'todo' }, { id: 'o_doing', name: 'En curso', tone: 2, group: 'doing' }, { id: 'o_done', name: 'Hecho', tone: 4, group: 'done' }] },
        { id: 'p_fecha', name: 'Fecha', type: 'date' },
        { id: 'p_tags', name: 'Etiquetas', type: 'multi', opts: [] }
      ],
      views: [
        { id: 'v_table', name: 'Tabla', type: 'table' },
        { id: 'v_board', name: 'Tablero', type: 'board', group: stId },
        { id: 'v_cal', name: 'Calendario', type: 'calendar', date: 'p_fecha' }
      ]
    };
    if (opts.db) db = opts.db;
    return Pages.create({ title: title || '', parent: parent || null, kind: 'db', db: db, icon: opts.icon || 'database', team: opts.team || null });
  }

  /* ---------- Plantillas ---------- */
  function mention(type, id, label) { return '<span class="mention" data-' + type + '="' + id + '" contenteditable="false">' + escapeHtml(label) + '</span>'; }
  var TEMPLATES = [
    { id: 'blank', name: 'Página en blanco', icon: 'page', desc: 'Empieza desde cero', build: function () { return { blocks: [] }; } },
    { id: 'meeting', name: 'Reunión', icon: 'users', desc: 'Asistentes, temas, acuerdos y próximos pasos', build: function () {
      var td = U.today();
      return { title: 'Reunión · ' + U.fmtShort(td), icon: 'users', blocks: [
        block('callout', '<b>Fecha:</b> ' + mention('date', td, U.fmtDay(td)) + ' · <b>Lugar:</b> ', { ic: 'calendar' }),
        block('h2', 'Asistentes'), block('ul', ''),
        block('h2', 'Temas'), block('ol', ''), block('ol', ''),
        block('h2', 'Notas'), block('p', ''),
        block('h2', 'Acuerdos'), block('todo', ''),
        block('h2', 'Próximos pasos'), block('todo', '')
      ] };
    } },
    { id: 'project', name: 'Proyecto', icon: 'briefcase', desc: 'Objetivo, hitos y tablero de tareas', build: function (page) {
      var db = newDb('Tareas del proyecto', page.id, { team: page.team });
      return { title: 'Nuevo proyecto', icon: 'briefcase', cover: 'rays', blocks: [
        block('callout', '<b>Objetivo:</b> describe en una frase qué quieres conseguir.', { ic: 'target' }),
        block('h2', 'Hitos'), block('todo', 'Primer hito'), block('todo', 'Entrega final'),
        block('h2', 'Tareas'), block('db', '', { ref: db.id, view: 'v_board' }),
        block('h2', 'Recursos'), block('ul', '')
      ] };
    } },
    { id: 'journal', name: 'Diario', icon: 'moon', desc: 'Cómo ha ido el día y qué has aprendido', build: function () {
      var td = U.today();
      return { title: U.cap(U.fmtLong(td)), icon: 'moon', blocks: [
        block('h3', '¿Cómo me siento?'), block('p', ''),
        block('h3', 'Tres cosas buenas de hoy'), block('ol', ''), block('ol', ''), block('ol', ''),
        block('h3', 'Qué he aprendido'), block('p', ''),
        block('h3', 'Mañana quiero…'), block('todo', '')
      ] };
    } },
    { id: 'class', name: 'Apuntes de clase', icon: 'book', desc: 'Conceptos clave, resumen y dudas', build: function () {
      return { title: 'Tema 1', icon: 'book', blocks: [
        block('callout', '<b>Asignatura:</b>  · <b>Fecha:</b> ' + mention('date', U.today(), U.fmtDay(U.today())), { ic: 'book' }),
        block('h2', 'Conceptos clave'), block('toggle', 'Concepto 1'), block('p', '', { i: 1 }), block('toggle', 'Concepto 2'), block('p', '', { i: 1 }),
        block('h2', 'Resumen'), block('p', ''),
        block('h2', 'Dudas para preguntar'), block('todo', '')
      ] };
    } },
    { id: 'weekly', name: 'Plan semanal', icon: 'calendar', desc: 'Un desplegable por día con sus tareas', build: function () {
      var ws = W.State.settings.weekStart || 1, td = U.today(), start = U.addDays(td, -((U.weekday(td) - ws + 7) % 7)), out = [block('callout', 'Prioridad de la semana: ', { ic: 'flag' })];
      for (var i = 0; i < 7; i++) { var d = U.addDays(start, i); out.push(block('toggle', '<b>' + U.cap(U.fmtDay(d)) + '</b>')); out.push(block('todo', '', { i: 1 })); }
      return { title: 'Semana del ' + U.fmtShort(start), icon: 'calendar', blocks: out };
    } },
    { id: 'reading', name: 'Lista de lectura', icon: 'book', desc: 'Base de datos de libros con estado y nota', build: function (page) {
      return { kind: 'db', title: 'Lista de lectura', icon: 'book', db: {
        props: [{ id: 'title', name: 'Título', type: 'title' }, { id: 'p_autor', name: 'Autor', type: 'text' },
          { id: 'p_estado', name: 'Estado', type: 'status', opts: [{ id: 'o_q', name: 'Pendiente', tone: 0, group: 'todo' }, { id: 'o_r', name: 'Leyendo', tone: 2, group: 'doing' }, { id: 'o_d', name: 'Leído', tone: 4, group: 'done' }] },
          { id: 'p_nota', name: 'Nota', type: 'select', opts: [{ id: 'o_1', name: '★', tone: 1 }, { id: 'o_2', name: '★★', tone: 2 }, { id: 'o_3', name: '★★★', tone: 3 }, { id: 'o_4', name: '★★★★', tone: 4 }] },
          { id: 'p_fin', name: 'Terminado', type: 'date' }],
        views: [{ id: 'v_board', name: 'Por estado', type: 'board', group: 'p_estado' }, { id: 'v_table', name: 'Todos', type: 'table' }, { id: 'v_gal', name: 'Galería', type: 'gallery' }]
      } };
    } },
    { id: 'roadmap', name: 'Hoja de ruta', icon: 'flag', desc: 'Iniciativas por trimestre en un tablero', build: function () {
      return { kind: 'db', title: 'Hoja de ruta', icon: 'flag', db: {
        props: [{ id: 'title', name: 'Iniciativa', type: 'title' },
          { id: 'p_q', name: 'Trimestre', type: 'select', opts: [{ id: 'o_t1', name: 'T1', tone: 1 }, { id: 'o_t2', name: 'T2', tone: 2 }, { id: 'o_t3', name: 'T3', tone: 3 }, { id: 'o_t4', name: 'T4', tone: 4 }] },
          { id: 'p_estado', name: 'Estado', type: 'status', opts: [{ id: 'o_idea', name: 'Idea', tone: 0, group: 'todo' }, { id: 'o_plan', name: 'Planificada', tone: 1, group: 'todo' }, { id: 'o_doing', name: 'En marcha', tone: 2, group: 'doing' }, { id: 'o_done', name: 'Lanzada', tone: 4, group: 'done' }] },
          { id: 'p_owner', name: 'Responsable', type: 'person' }, { id: 'p_fecha', name: 'Fecha', type: 'date' }],
        views: [{ id: 'v_board', name: 'Por trimestre', type: 'board', group: 'p_q' }, { id: 'v_state', name: 'Por estado', type: 'board', group: 'p_estado' }, { id: 'v_cal', name: 'Calendario', type: 'calendar', date: 'p_fecha' }, { id: 'v_table', name: 'Tabla', type: 'table' }]
      } };
    } },
    { id: 'wiki', name: 'Wiki del equipo', icon: 'system', desc: 'Índice, normas y enlaces importantes', build: function () {
      return { title: 'Wiki del equipo', icon: 'system', cover: 'grid', blocks: [
        block('callout', 'Todo lo que el equipo necesita saber, en un solo sitio.', { ic: 'info' }), block('toc'),
        block('h1', 'Cómo trabajamos'), block('ul', 'Horario y reuniones'), block('ul', 'Herramientas'),
        block('h1', 'Normas'), block('ol', ''),
        block('h1', 'Enlaces importantes'), block('bookmark', '', { url: '' })
      ] };
    } },
    { id: 'contacts', name: 'Contactos y clientes', icon: 'users', desc: 'Una base de datos para seguir a cada cliente', build: function () {
      return { kind: 'db', title: 'Clientes', icon: 'users', db: {
        props: [{ id: 'title', name: 'Nombre', type: 'title' }, { id: 'p_empresa', name: 'Empresa', type: 'text' }, { id: 'p_mail', name: 'Correo', type: 'url' },
          { id: 'p_fase', name: 'Fase', type: 'status', opts: [{ id: 'o_lead', name: 'Contacto', tone: 0, group: 'todo' }, { id: 'o_prop', name: 'Propuesta', tone: 2, group: 'doing' }, { id: 'o_won', name: 'Cliente', tone: 4, group: 'done' }] },
          { id: 'p_valor', name: 'Valor', type: 'number', fmt: 'euro' }, { id: 'p_next', name: 'Próximo contacto', type: 'date' }],
        views: [{ id: 'v_board', name: 'Embudo', type: 'board', group: 'p_fase' }, { id: 'v_table', name: 'Todos', type: 'table' }]
      } };
    } }
  ];

  /* ---------- Apuntes de versiones anteriores → páginas ---------- */
  function importNotes() {
    var notes = W.State.notes || [], n = 0;
    notes.forEach(function (note) {
      var id = ('pg_n' + String(note.id)).replace(/[^A-Za-z0-9_-]/g, '').slice(0, 58);
      if (idx.migrated[note.id] || idx.items[id] || idx.del[id]) { idx.migrated[note.id] = idx.migrated[note.id] || Date.now(); return; }
      var blocks = fromMarkdown(note.body);
      var list = note.listId ? W.State.getList(note.listId) : null;
      idx.items[id] = cleanMeta({ id: id, title: note.title || (blocks[0] ? plain(blocks[0].x).slice(0, 60) : 'Apunte'), icon: list && list.icon ? list.icon : 'page', parent: null, kind: 'page', order: lastOrder(null, null), fav: !!note.pinned, at: note.updatedAt || Date.now(), cat: note.createdAt || Date.now(), cv: note.updatedAt || Date.now(), src: 'note:' + note.id });
      cache[id] = { blocks: blocks, del: {} };
      writeContent(id); analyze(id);
      markDirty(id, 'meta'); markDirty(id, 'content');
      idx.migrated[note.id] = Date.now();
      n++;
    });
    if (n) { saveIndex(); emit('import'); }
    return n;
  }

  /* ---------- API ---------- */
  var Pages = {
    BLOCKS: BLOCKS, PROPS: PROPS, VIEWS: VIEWS, COVERS: COVERS, ICONS: ICONS, TEMPLATES: TEMPLATES,
    sanitize: sanitize, plain: plain, escape: escapeHtml, inlineMd: inlineMd, toInlineMd: toInlineMd, mention: mention,
    cleanBlock: cleanBlock, cleanMeta: cleanMeta, cleanContent: cleanContent, cleanDb: cleanDb,
    block: block, fromMarkdown: fromMarkdown, toMarkdown: toMarkdown,
    subscribe: function (fn) { subs.push(fn); return function () { subs = subs.filter(function (x) { return x !== fn; }); }; },
    index: function () { return idx; },

    get: meta, content: content, title: title, all: all, children: children, path: path, isRow: isRow, descendants: descendants,
    count: function () { return all().filter(function (m) { return !isRow(m); }).length; },
    favorites: function () { return all().filter(function (m) { return m.fav; }).sort(function (a, b) { return a.order - b.order; }); },
    recent: function (n) { return all().filter(function (m) { return !isRow(m); }).sort(function (a, b) { return Math.max(b.at, b.cv) - Math.max(a.at, a.cv); }).slice(0, n || 8); },
    trash: function () { return all({ trash: true }).filter(function (m) { var p = m.parent ? meta(m.parent) : null; return !p || !p.trash; }).sort(function (a, b) { return b.trash - a.trash; }); },
    backlinks: function (id) { return all().filter(function (m) { return m.id !== id && m.links.indexOf(id) >= 0 && m.parent !== id; }); },

    /** Búsqueda en títulos y en todo el texto de las páginas */
    search: function (q, max) {
      q = String(q || '').toLowerCase().trim();
      if (!q) return [];
      var out = [];
      all().forEach(function (m) {
        var t = (m.title || '').toLowerCase(), score = t === q ? 100 : t.indexOf(q) === 0 ? 80 : t.indexOf(q) >= 0 ? 60 : 0, hit = '';
        if (!score) {
          var c = content(m.id);
          for (var i = 0; i < c.blocks.length; i++) {
            var bl = c.blocks[i], p = (plain(bl.x || '') + (bl.n ? ' ' + bl.n : '')).trim(), k = p.toLowerCase().indexOf(q);
            if (k >= 0) { score = 30; hit = (k > 30 ? '…' : '') + p.slice(Math.max(0, k - 30), k + 70); break; }
          }
          if (!score && m.props) Object.keys(m.props).forEach(function (pk) { if (!score && String(m.props[pk]).toLowerCase().indexOf(q) >= 0) score = 20; });
        }
        if (score) out.push({ page: m, score: score + (m.fav ? 5 : 0), hit: hit });
      });
      return out.sort(function (a, b) { return b.score - a.score || Math.max(b.page.at, b.page.cv) - Math.max(a.page.at, a.page.cv); }).slice(0, max || 30);
    },

    /** Crea una página: { title, parent, kind, icon, cover, blocks, props, db, team, template } */
    create: function (o) {
      o = o || {};
      var id = o.id && ID_RE.test(o.id) ? o.id : newId('pg');
      var parent = o.parent && meta(o.parent) ? o.parent : null;
      var team = o.team || (parent ? meta(parent).team : null) || null;
      var m = cleanMeta({ id: id, title: o.title || '', icon: o.icon || null, cover: o.cover || null, parent: parent, kind: o.kind || 'page', db: o.db,
        order: o.order != null ? o.order : lastOrder(parent, team), fav: !!o.fav, at: Date.now(), cat: Date.now(), cv: Date.now(), props: o.props || {}, team: team, by: me(), byName: myName() });
      idx.items[id] = m;
      cache[id] = { blocks: (o.blocks || []).map(cleanBlock).filter(Boolean), del: {} };
      if (o.template) {
        var tp = TEMPLATES.filter(function (x) { return x.id === o.template; })[0];
        if (tp) {
          var res = tp.build(m) || {};
          if (res.kind === 'db') { m.kind = 'db'; m.db = cleanDb(res.db); }
          if (res.title && !o.title) m.title = res.title;
          if (res.icon && !o.icon) m.icon = res.icon;
          if (res.cover && !o.cover) m.cover = res.cover;
          if (res.blocks) cache[id].blocks = res.blocks.map(cleanBlock).filter(Boolean);
        }
      }
      writeContent(id); analyze(id);
      markDirty(id, 'meta'); markDirty(id, 'content');
      delete idx.del[id];
      saveIndex();
      emit('create', id);
      return m;
    },
    /** Cambia la ficha de una página (título, icono, portada, favorita, opciones, propiedades…) */
    update: function (id, patch, opts) {
      var m = meta(id); if (!m) return null;
      var next = cleanMeta(Object.assign({}, m, patch, { id: id, at: Date.now() }));
      if (!next) return m;
      if (patch && patch.props) next.props = Object.assign({}, m.props, patch.props);
      var moved = (next.team || null) !== (m.team || null);
      Object.keys(next).forEach(function (k) { m[k] = next[k]; });
      markDirty(id, 'meta');
      // Al pasar a un equipo (o volver a tus páginas) el contenido se guarda también en su nuevo sitio:
      // si no, los demás recibían la página vacía (en la nube solo estaba en el sitio de antes)
      if (moved) markDirty(id, 'content');
      if (!opts || opts.save !== false) scheduleSave();
      emit((opts && opts.reason) || 'meta', id);
      return m;
    },
    setProp: function (rowId, propId, value) {
      var m = meta(rowId); if (!m) return;
      if (propId === 'title') { Pages.update(rowId, { title: String(value || '') }); return; }
      var props = Object.assign({}, m.props);
      if (value == null || value === '' || (Array.isArray(value) && !value.length)) delete props[propId]; else props[propId] = value;
      m.props = props; m.at = Date.now(); markDirty(rowId, 'meta'); scheduleSave(); emit('props', rowId);
    },
    /** Guarda los bloques de una página (marca la hora de los que cambian) */
    setBlocks: function (id, blocks, opts) {
      var m = meta(id); if (!m) return;
      var c = content(id), before = {}, now = Date.now();
      c.blocks.forEach(function (b) { before[b.id] = JSON.stringify(b); });
      var seen = {};
      var next = blocks.map(function (b) {
        var cb = cleanBlock(Object.assign({}, b));
        if (!cb) return null;
        var prev = before[cb.id];
        if (prev) { var pb = JSON.parse(prev); var at = pb.at; pb.at = 0; cb.at = 0; cb.at = JSON.stringify(pb) === JSON.stringify(cb) ? at : now; }
        else cb.at = now;
        seen[cb.id] = 1;
        return cb;
      }).filter(Boolean);
      Object.keys(before).forEach(function (bid) { if (!seen[bid]) c.del[bid] = now; });
      c.blocks = next;
      m.cv = now;
      writeContent(id); analyze(id);
      markDirty(id, 'content');
      scheduleSave();
      if (!opts || !opts.silent) emit('content', id);
      else if (W.PageSync) W.PageSync.schedule();
    },
    /** Aplica bloques ya fusionados (sincronización) sin marcar cambios */
    applyContent: function (id, c, cv) {
      var next = cleanContent(c), prev = cache[id] || content(id);
      var m = meta(id); if (m && cv) m.cv = Math.max(m.cv || 0, cv);
      if (JSON.stringify(next) === JSON.stringify(prev)) { scheduleSave(); return; }
      cache[id] = next;
      writeContent(id); analyze(id);
      scheduleSave();
      emit('remote', id);
    },
    applyMeta: function (m) {
      var c = cleanMeta(m); if (!c) return;
      if (idx.del[c.id] && idx.del[c.id] >= c.at) return;
      var cur = idx.items[c.id];
      if (cur) Object.keys(c).forEach(function (k) { cur[k] = c[k]; }); else idx.items[c.id] = c;
      scheduleSave();
    },
    forget: function (id, ts) {
      delete idx.items[id]; delete cache[id]; delete idx.dirty[id];
      st().remove(PAGE_KEY + id);
      if (ts) idx.del[id] = ts;
      scheduleSave();
    },
    move: function (id, parent, beforeId) {
      var m = meta(id); if (!m) return;
      if (parent && (parent === id || path(parent).some(function (p) { return p.id === id; }))) return;
      var team = parent ? meta(parent).team : m.team;
      var sib = children(parent, team).filter(function (x) { return x.id !== id; });
      var order;
      if (beforeId) {
        var i = sib.map(function (x) { return x.id; }).indexOf(beforeId);
        order = i < 0 ? lastOrder(parent, team) : (i === 0 ? sib[0].order - 1 : (sib[i - 1].order + sib[i].order) / 2);
      } else order = sib.length ? sib[sib.length - 1].order + 1 : 1;
      Pages.update(id, { parent: parent || null, order: order, team: team || null }, { reason: 'move' });
      if ((team || null) !== (m.team || null)) descendants(id).forEach(function (d) { Pages.update(d.id, { team: team || null }, { reason: 'move' }); });
    },
    /** A la papelera (con todo lo que tiene dentro) */
    remove: function (id) {
      var m = meta(id); if (!m) return;
      var ts = Date.now();
      [m].concat(descendants(id)).forEach(function (x) { if (!x.trash) { x.trash = ts; x.at = ts; markDirty(x.id, 'meta'); } });
      saveIndex(); emit('trash', id);
    },
    restore: function (id) {
      var m = meta(id); if (!m) return;
      var ts = m.trash;
      if (m.parent && meta(m.parent) && meta(m.parent).trash) m.parent = null;
      [m].concat(descendants(id)).forEach(function (x) { if (x.trash === ts || x === m) { x.trash = 0; x.at = Date.now(); markDirty(x.id, 'meta'); } });
      saveIndex(); emit('restore', id);
    },
    /** Borrado definitivo (desde la papelera) */
    destroy: function (id) {
      var ids = [id].concat(descendants(id).map(function (x) { return x.id; })), ts = Date.now();
      ids.forEach(function (x) { var m = meta(x); if (W.PageSync && m) W.PageSync.removed(m); Pages.forget(x, ts); });
      saveIndex(); emit('destroy', id);
    },
    emptyTrash: function () { Pages.trash().forEach(function (m) { Pages.destroy(m.id); }); },
    duplicate: function (id, parent) {
      var m = meta(id); if (!m) return null;
      var c = content(id);
      var copy = Pages.create({ title: (m.title || 'Sin título') + ' (copia)', parent: parent !== undefined ? parent : m.parent, kind: m.kind, icon: m.icon, cover: m.cover, db: m.db, props: m.props, team: m.team,
        blocks: c.blocks.map(function (b) { return Object.assign({}, b, { id: newId('b') }); }), order: m.order + 0.01 });
      if (m.kind === 'db') rows(id).forEach(function (r) { Pages.duplicate(r.id, copy.id); });
      children(id).filter(function (ch) { return m.kind !== 'db'; }).forEach(function (ch) { Pages.duplicate(ch.id, copy.id); });
      return copy;
    },
    /** Una subpágina nueva dentro de otra, con su bloque de enlace */
    newSubpage: function (parentId, o) {
      return Pages.create(Object.assign({ parent: parentId }, o || {}));
    },
    newDb: newDb,

    /* Bases de datos */
    rows: rows, getProp: getProp, propValue: propValue, propText: propText, optName: optName, viewRows: viewRows, groups: groups, fmtNumber: fmtNumber, personName: personName,
    addRow: function (dbId, props, title) {
      var m = meta(dbId); if (!m) return null;
      return Pages.create({ parent: dbId, title: title || '', props: props || {}, team: m.team });
    },
    setDb: function (dbId, fn) {
      var m = meta(dbId); if (!m || !m.db) return;
      var db = JSON.parse(JSON.stringify(m.db));
      fn(db);
      Pages.update(dbId, { db: cleanDb(db) }, { reason: 'schema' });
    },
    addProp: function (dbId, type, name) {
      var id = newId('p');
      Pages.setDb(dbId, function (db) { db.props.push({ id: id, name: name || PROPS[type].label, type: type, opts: [] }); });
      return id;
    },
    addOption: function (dbId, propId, name) {
      var oid = newId('o');
      Pages.setDb(dbId, function (db) { db.props.forEach(function (p) { if (p.id === propId) { p.opts = p.opts || []; p.opts.push({ id: oid, name: String(name || 'Opción').slice(0, 40), tone: p.opts.length % 5 }); } }); });
      return oid;
    },

    /* Plantillas y apuntes antiguos */
    importNotes: importNotes,
    fromTemplate: function (tplId, o) { return Pages.create(Object.assign({}, o || {}, { template: tplId })); },

    /* Sincronización */
    dirty: function () { return idx.dirty; },
    clean: function (id, flags) { if (!idx.dirty[id]) return; idx.dirty[id] &= ~flags; if (!idx.dirty[id]) delete idx.dirty[id]; scheduleSave(); },
    saveNow: saveIndex,
    clearLocal: function () {
      Object.keys(idx.items).forEach(function (id) { st().remove(PAGE_KEY + id); });
      idx = cleanIndex(null); cache = {};
      st().remove(IDX_KEY);
      emit('reset');
    },
    resetAll: function () {
      var ts = Date.now();
      Object.keys(idx.items).forEach(function (id) { if (!idx.items[id].team) { if (W.PageSync) W.PageSync.removed(idx.items[id]); Pages.forget(id, ts); } });
      saveIndex(); emit('reset');
    },
    /** Sale de un equipo: se olvidan sus páginas en este dispositivo */
    dropTeam: function (sid) {
      Object.keys(idx.items).forEach(function (id) { if (idx.items[id].team === sid) Pages.forget(id); });
      saveIndex(); emit('team');
    }
  };

  W.Pages = Pages;
  // Apuntes de versiones anteriores: se convierten al arrancar y cuando lleguen de la nube
  importNotes();
  if (W.State && W.State.subscribe) W.State.subscribe(function (r) { if (r === 'sync' || r === 'notes' || r === 'purge') importNotes(); });
})(window.Whider);
