/**
 * WHIDER · Archivos adjuntos del Cuaderno (imágenes, documentos y cualquier otro archivo)
 *
 * Dónde se guardan:
 *  - Enteros en este dispositivo (IndexedDB «whider-files»): se abren al momento y sin conexión.
 *  - En la nube, con la cuenta abierta. Firestore no admite documentos de más de 1 MB, así que cada
 *    archivo se sube en trozos (…/files/{id}/parts/{n}) y su ficha (…/files/{id}) se escribe la
 *    última: si la ficha existe, el archivo está completo.
 *      · Páginas tuyas: users/{uid}/files        · Páginas de un equipo: spaces/{id}/files
 *  - En otro dispositivo se descarga la primera vez que se abre la página y se queda guardado.
 *
 * Los bloques solo guardan la referencia ({ f, n, m, s }); el sitio en la nube es el de su página.
 * Si una página pasa a un equipo (o vuelve a tus páginas), un dispositivo que tenga sus archivos los
 * copia allí. Lo que ya no usa ninguna página (ni siquiera en la papelera) se borra solo pasados
 * unos días: mientras tanto se puede deshacer.
 */
window.Whider = window.Whider || {};

(function (W) {
  'use strict';
  var U = W.U;
  var MAX = 15 * 1024 * 1024;            // por archivo
  var PART = 600 * 1024;                 // trozo en la nube (≈ 800 KB en base64, por debajo de 1 MB)
  var SHRINK_OVER = 2.5 * 1024 * 1024;   // las fotos más grandes se reducen…
  var MAX_SIDE = 2560;                   // …a este lado mayor
  var GRACE = 3 * 86400000;              // lo que no se usa se borra pasados 3 días
  var DBN = 'whider-files', META = 'meta', DATA = 'data', KEY = 'whider.files.v1';
  var F = function () { return W.Auth.sdk(); }, DB = function () { return W.Auth.db(); }, P = function () { return W.Pages; };

  var recs = {}, urls = {}, inflight = {}, progress = {}, miss = {}, fails = {};
  var loaded = null, dbp = null, mem = null, pumping = null, pumpAgain = false, pumpT = null, retryT = null, maintT = null;
  var st = loadState();

  /* ---------- Estado pequeño (borrados pendientes y limpieza) ---------- */
  function loadState() {
    try {
      var x = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (x && typeof x === 'object') return { del: x.del || {}, unref: x.unref || {}, cloudUnref: x.cloudUnref || {}, gcAt: x.gcAt || {} };
    } catch (e) { /* vacío */ }
    return { del: {}, unref: {}, cloudUnref: {}, gcAt: {} };
  }
  function saveState() { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (e) { /* sin espacio */ } }
  function emit(id) { try { document.dispatchEvent(new CustomEvent('whider:files', { detail: { id: id || null } })); } catch (e) { /* sin eventos */ } }

  /* ---------- Almacén local ---------- */
  function idb() {
    if (dbp) return dbp;
    dbp = new Promise(function (resolve) {
      var req = null;
      try { req = window.indexedDB ? window.indexedDB.open(DBN, 1) : null; } catch (e) { req = null; }
      if (!req) { mem = mem || { meta: {}, data: {} }; resolve(null); return; }
      req.onupgradeneeded = function () {
        var db = req.result;
        if (!db.objectStoreNames.contains(META)) db.createObjectStore(META, { keyPath: 'id' });
        if (!db.objectStoreNames.contains(DATA)) db.createObjectStore(DATA, { keyPath: 'id' });
      };
      req.onsuccess = function () { var db = req.result; db.onversionchange = function () { db.close(); dbp = null; }; resolve(db); };
      req.onerror = function () { mem = mem || { meta: {}, data: {} }; resolve(null); };
    });
    return dbp;
  }
  function done(t) {
    return new Promise(function (resolve, reject) {
      t.oncomplete = function () { resolve(); };
      t.onerror = function () { reject(t.error || new Error('idb')); };
      t.onabort = function () { reject(t.error || new Error('idb')); };
    });
  }
  function readAllMeta() {
    return idb().then(function (db) {
      if (!db) return Object.keys(mem.meta).map(function (k) { return mem.meta[k]; });
      return new Promise(function (resolve) {
        try {
          var r = db.transaction(META, 'readonly').objectStore(META).getAll();
          r.onsuccess = function () { resolve(r.result || []); };
          r.onerror = function () { resolve([]); };
        } catch (e) { resolve([]); }
      });
    });
  }
  function readBlob(id) {
    return idb().then(function (db) {
      if (!db) return mem.data[id] || null;
      return new Promise(function (resolve) {
        try {
          var r = db.transaction(DATA, 'readonly').objectStore(DATA).get(id);
          r.onsuccess = function () {
            var v = r.result;
            if (!v) resolve(null);
            else if (v.blob) resolve(v.blob);
            else if (v.buf) resolve(new Blob([v.buf], { type: v.type || 'application/octet-stream' }));
            else resolve(null);
          };
          r.onerror = function () { resolve(null); };
        } catch (e) { resolve(null); }
      });
    });
  }
  function putRows(meta, data) {
    return idb().then(function (db) {
      if (!db) { mem.meta[meta.id] = meta; if (data) mem.data[meta.id] = data.blob || new Blob([data.buf], { type: data.type }); return; }
      var t = db.transaction(data ? [META, DATA] : [META], 'readwrite');
      t.objectStore(META).put(meta);
      if (data) t.objectStore(DATA).put(data);
      return done(t);
    });
  }
  /** Guarda la ficha (y el contenido, si se da). Algún WebView antiguo no guarda Blob: entonces, los bytes */
  function write(meta, blob) {
    var copy = JSON.parse(JSON.stringify(meta));
    if (!blob) return putRows(copy);
    return putRows(copy, { id: meta.id, blob: blob }).catch(function (e) {
      if (!e || e.name !== 'DataCloneError') throw e;
      return bytes(blob).then(function (u8) { return putRows(copy, { id: meta.id, buf: u8.buffer, type: blob.type }); });
    });
  }
  function drop(id) {
    if (urls[id]) { try { URL.revokeObjectURL(urls[id]); } catch (e) { /* ya liberada */ } delete urls[id]; }
    delete recs[id];
    return idb().then(function (db) {
      if (!db) { delete mem.meta[id]; delete mem.data[id]; return; }
      var t = db.transaction([META, DATA], 'readwrite');
      t.objectStore(META).delete(id); t.objectStore(DATA).delete(id);
      return done(t);
    }).catch(function () { /* se intentará en la próxima limpieza */ });
  }
  function wipe() {
    Object.keys(urls).forEach(function (id) { try { URL.revokeObjectURL(urls[id]); } catch (e) { /* ya liberada */ } });
    urls = {}; recs = {}; miss = {}; progress = {}; fails = {};
    return idb().then(function (db) {
      if (!db) { mem = { meta: {}, data: {} }; return; }
      var t = db.transaction([META, DATA], 'readwrite');
      t.objectStore(META).clear(); t.objectStore(DATA).clear();
      return done(t);
    }).catch(function () { /* sin almacén */ });
  }
  function ready() {
    if (!loaded) loaded = readAllMeta().then(function (list) { list.forEach(function (m) { if (m && m.id) { m.cloud = m.cloud || {}; recs[m.id] = m; } }); });
    return loaded;
  }
  /** Pide al navegador que no borre lo guardado aunque falte espacio */
  var askedPersist = false;
  function persist() {
    if (askedPersist) return;
    askedPersist = true;
    try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(function () {}); } catch (e) { /* opcional */ }
  }

  /* ---------- Utilidades ---------- */
  function newId() {
    var a = new Uint8Array(9), s = '';
    try { (window.crypto || window.msCrypto).getRandomValues(a); } catch (e) { for (var k = 0; k < a.length; k++) a[k] = Math.floor(Math.random() * 256); }
    for (var i = 0; i < a.length; i++) s += (a[i] % 36).toString(36);
    return 'f' + Date.now().toString(36) + s;
  }
  var EXT = {
    pdf: 'application/pdf', txt: 'text/plain', md: 'text/markdown', csv: 'text/csv', json: 'application/json', rtf: 'application/rtf',
    doc: 'application/msword', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    xls: 'application/vnd.ms-excel', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ppt: 'application/vnd.ms-powerpoint', pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    odt: 'application/vnd.oasis.opendocument.text', ods: 'application/vnd.oasis.opendocument.spreadsheet', odp: 'application/vnd.oasis.opendocument.presentation',
    zip: 'application/zip', rar: 'application/vnd.rar', '7z': 'application/x-7z-compressed', epub: 'application/epub+zip',
    jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp', avif: 'image/avif', bmp: 'image/bmp',
    heic: 'image/heic', heif: 'image/heif', svg: 'image/svg+xml',
    mp3: 'audio/mpeg', m4a: 'audio/mp4', aac: 'audio/aac', wav: 'audio/wav', ogg: 'audio/ogg', opus: 'audio/ogg',
    mp4: 'video/mp4', m4v: 'video/mp4', mov: 'video/quicktime', webm: 'video/webm'
  };
  function ext(name) { var m = /\.([A-Za-z0-9]{1,8})$/.exec(String(name || '')); return m ? m[1].toLowerCase() : ''; }
  function cleanType(t) { t = String(t || '').toLowerCase().split(';')[0].trim(); return /^[a-z0-9.+-]+\/[a-z0-9.+-]+$/.test(t) && t.length <= 100 ? t : 'application/octet-stream'; }
  function mimeOf(file) { var t = cleanType(file.type); return t !== 'application/octet-stream' ? t : (EXT[ext(file.name)] || t); }
  /** Nombre que se puede guardar en cualquier sistema (sin rutas ni caracteres prohibidos) */
  function cleanName(n) {
    n = String(n || '').replace(/[\\/:*?"<>|\u0000-\u001f]+/g, ' ').replace(/\s+/g, ' ').trim();
    if (!n || /^\.+$/.test(n)) n = 'archivo';
    if (n.length > 120) { var e = ext(n); n = n.slice(0, 110 - e.length).trim() + (e ? '.' + e : ''); }
    return n;
  }
  function rename(name, e) { return cleanName(String(name || 'imagen').replace(/\.[A-Za-z0-9]{1,8}$/, '') + '.' + e); }
  function fmtSize(n) {
    n = +n || 0;
    if (n < 1024) return n + ' B';
    if (n < 1048576) return Math.max(1, Math.round(n / 1024)) + ' KB';
    return (n / 1048576).toFixed(n < 10 * 1048576 ? 1 : 0).replace('.', ',') + ' MB';
  }
  /** Tipo legible de un archivo: { label: 'Documento PDF', short: 'PDF' } */
  function kind(mime, name) {
    var m = String(mime || ''), e = ext(name), up = function (d) { return (e || d).toUpperCase().slice(0, 4); };
    if (m === 'application/pdf' || e === 'pdf') return { label: 'Documento PDF', short: 'PDF', k: 'pdf' };
    if (/wordprocessing|msword|opendocument\.text|rtf/.test(m) || /^(docx?|odt|rtf|pages)$/.test(e)) return { label: 'Documento', short: up('doc'), k: 'doc' };
    if (/spreadsheet|ms-excel|text\/csv/.test(m) || /^(xlsx?|ods|csv|numbers)$/.test(e)) return { label: 'Hoja de cálculo', short: up('xls'), k: 'sheet' };
    if (/presentation|powerpoint/.test(m) || /^(pptx?|odp|key)$/.test(e)) return { label: 'Presentación', short: up('ppt'), k: 'slides' };
    if (/^image\//.test(m)) return { label: 'Imagen', short: up('img'), k: 'image' };
    if (/^audio\//.test(m)) return { label: 'Audio', short: up('aud'), k: 'audio' };
    if (/^video\//.test(m)) return { label: 'Vídeo', short: up('vid'), k: 'video' };
    if (/zip|rar|7z|tar|gzip/.test(m) || /^(zip|rar|7z|tar|gz)$/.test(e)) return { label: 'Archivo comprimido', short: up('zip'), k: 'zip' };
    if (/^text\//.test(m) || /json|xml/.test(m)) return { label: 'Texto', short: up('txt'), k: 'text' };
    return { label: 'Archivo', short: up('file'), k: 'file' };
  }
  function b64(blob) {
    return new Promise(function (resolve, reject) {
      var r = new FileReader();
      r.onload = function () { var s = String(r.result || ''); resolve(s.slice(s.indexOf(',') + 1)); };
      r.onerror = function () { reject(r.error || new Error('lectura')); };
      r.readAsDataURL(blob);
    });
  }
  function unb64(s) {
    var bin = atob(s), u = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
    return u;
  }
  function bytes(blob) {
    if (blob.arrayBuffer) return blob.arrayBuffer().then(function (b) { return new Uint8Array(b); });
    return new Promise(function (resolve, reject) {
      var r = new FileReader();
      r.onload = function () { resolve(new Uint8Array(r.result)); };
      r.onerror = function () { reject(r.error); };
      r.readAsArrayBuffer(blob);
    });
  }
  function textOf(blob) {
    if (blob.text) return blob.text();
    return new Promise(function (resolve) { var r = new FileReader(); r.onload = function () { resolve(String(r.result || '')); }; r.onerror = function () { resolve(''); }; r.readAsText(blob); });
  }
  /** Ejecuta fn sobre cada elemento con como mucho n a la vez, en orden */
  function pmap(list, n, fn) {
    var out = new Array(list.length), i = 0;
    var worker = function () { if (i >= list.length) return Promise.resolve(); var k = i++; return fn(list[k]).then(function (v) { out[k] = v; return worker(); }); };
    var ws = [];
    for (var j = 0; j < Math.min(n, list.length); j++) ws.push(worker());
    return Promise.all(ws).then(function () { return out; });
  }

  /* ---------- Fotos: tamaño razonable y proporción ---------- */
  function decode(blob) {
    return new Promise(function (resolve, reject) {
      var u = URL.createObjectURL(blob), img = new Image();
      img.onload = function () { resolve({ img: img, w: img.naturalWidth, h: img.naturalHeight, done: function () { URL.revokeObjectURL(u); } }); };
      img.onerror = function () { URL.revokeObjectURL(u); reject(new Error('imagen')); };
      img.src = u;
    });
  }
  function toBlob(c, type, q) {
    return new Promise(function (resolve, reject) {
      if (!c.toBlob) { reject(new Error('canvas')); return; }
      c.toBlob(function (b) { if (b) resolve(b); else reject(new Error('canvas')); }, type, q);
    });
  }
  /** → { blob, type, name, ar, image } · si no se puede mostrar (p. ej. HEIC en Windows), image: false */
  function prepImage(file, type, name) {
    if (file.size > 60 * 1048576) return Promise.resolve({ blob: file, type: type, name: name, image: false });
    return decode(file).then(function (d) {
      if (!d.w || !d.h) { d.done(); return { blob: file, type: type, name: name, image: false }; }
      var ar = Math.round(d.w / d.h * 1000) / 1000;
      var big = file.size > SHRINK_OVER || Math.max(d.w, d.h) > MAX_SIDE * 1.2 || /hei[cf]|bmp/.test(type);
      if (!big || type === 'image/gif') { d.done(); return { blob: file, type: type, name: name, ar: ar, image: true }; }
      var k = Math.min(1, MAX_SIDE / Math.max(d.w, d.h)), c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(d.w * k)); c.height = Math.max(1, Math.round(d.h * k));
      var ctx = c.getContext('2d'), png = type === 'image/png';
      if (!png) { ctx.fillStyle = '#FFFFFF'; ctx.fillRect(0, 0, c.width, c.height); }
      ctx.drawImage(d.img, 0, 0, c.width, c.height);
      d.done();
      var asJpeg = function () {
        var c2 = c;
        if (png) { c2 = document.createElement('canvas'); c2.width = c.width; c2.height = c.height; var x = c2.getContext('2d'); x.fillStyle = '#FFFFFF'; x.fillRect(0, 0, c2.width, c2.height); x.drawImage(c, 0, 0); }
        return toBlob(c2, 'image/jpeg', 0.86).then(function (b) { return { blob: b, type: 'image/jpeg', name: rename(name, 'jpg'), ar: ar, image: true }; });
      };
      var out = png ? toBlob(c, 'image/png').then(function (b) { return b.size > SHRINK_OVER ? asJpeg() : { blob: b, type: 'image/png', name: name, ar: ar, image: true }; }) : asJpeg();
      // Si al reducirla pesa más (pasa con algunas ya muy comprimidas), se queda la original
      return out.then(function (r) { return r.blob.size < file.size || file.size > MAX || /hei[cf]|bmp/.test(type) ? r : { blob: file, type: type, name: name, ar: ar, image: true }; });
    }, function () { return { blob: file, type: type, name: name, image: false }; });
  }

  /* ---------- Nube ---------- */
  function uid() { return W.Auth && W.Auth.user ? W.Auth.user.uid : null; }
  function canSync() { return !!(uid() && DB() && (!W.Auth.isVerified || W.Auth.isVerified())); }
  function online() { return canSync() && navigator.onLine !== false; }
  function scopeOf(pageId) { var m = pageId && P() ? P().get(pageId) : null; return m && m.team ? 't:' + m.team : 'me'; }
  function scopeOk(sk) {
    if (sk === 'me') return true;
    if (!/^t:[A-Za-z0-9_-]{4,40}$/.test(sk)) return false;
    var sp = (W.State.social && W.State.social.spaces) || {}, s = sp[sk.slice(2)];
    return !!(s && !s.left);
  }
  function path(sk) { return sk === 'me' ? ['users', uid(), 'files'] : ['spaces', sk.slice(2), 'files']; }
  function fileRef(sk, id) { return F().doc.apply(null, [DB()].concat(path(sk), [id])); }
  function partRef(sk, id, i) { return F().doc.apply(null, [DB()].concat(path(sk), [id, 'parts', String(i)])); }
  function colRef(sk) { return F().collection.apply(null, [DB()].concat(path(sk))); }

  function upload(id, sk) {
    var meta = recs[id];
    if (!meta) return Promise.resolve();
    return readBlob(id).then(function (blob) {
      if (!blob) { delete meta.cloud[sk]; return write(meta); }
      // Si ya está (lo subió otro dispositivo), no se sube otra vez
      return F().getDoc(fileRef(sk, id)).then(function (s) {
        if (s.exists() && (s.data() || {}).size === blob.size) return;
        var n = Math.max(1, Math.ceil(blob.size / PART)), i = 0;
        progress[id] = 0; emit(id);
        var next = function () {
          if (i >= n) return Promise.resolve();
          return b64(blob.slice(i * PART, Math.min(blob.size, (i + 1) * PART))).then(function (d) {
            return F().setDoc(partRef(sk, id, i), { d: d });
          }).then(function () { i++; progress[id] = i / n; emit(id); return next(); });
        };
        return next().then(function () {
          return F().setDoc(fileRef(sk, id), { name: meta.name, type: meta.type, size: blob.size, parts: n, at: meta.at || Date.now(), ar: meta.ar || null, by: uid() });
        });
      }).then(function () {
        var cur = recs[id]; if (!cur) return;
        cur.cloud[sk] = 'done';
        return write(cur);
      });
    }).then(function () { delete progress[id]; delete fails[id + sk]; emit(id); }, function (e) { delete progress[id]; emit(id); throw e; });
  }
  function downloadFrom(id, sk) {
    if (!online()) return Promise.reject({ code: navigator.onLine === false ? 'offline' : 'signed-out' });
    if (!scopeOk(sk)) return Promise.reject({ code: 'no-access' });
    return F().getDoc(fileRef(sk, id)).then(function (s) {
      if (!s.exists()) throw { code: 'missing' };
      var m = s.data() || {}, n = Math.max(1, Math.min(64, m.parts | 0)), got = 0, list = [];
      for (var i = 0; i < n; i++) list.push(i);
      progress[id] = 0; emit(id);
      return pmap(list, 3, function (k) {
        return F().getDoc(partRef(sk, id, k)).then(function (ps) {
          if (!ps.exists()) throw { code: 'missing' };
          got++; progress[id] = got / n; emit(id);
          return unb64(String((ps.data() || {}).d || ''));
        });
      }).then(function (bufs) {
        var type = cleanType(m.type), blob = new Blob(bufs, { type: type });
        if (m.size && blob.size !== m.size) throw { code: 'corrupt' };
        var meta = { id: id, name: cleanName(m.name), type: type, size: blob.size, at: +m.at || Date.now(), ar: +m.ar || null, cloud: {} };
        meta.cloud[sk] = 'done';
        return write(meta, blob).then(function () { recs[id] = meta; persist(); }, function () { /* sin espacio: se usa sin guardarlo */ }).then(function () { return blob; });
      });
    }).then(function (b) { delete progress[id]; delete miss[id]; emit(id); return b; }, function (e) {
      delete progress[id];
      if (e && e.code === 'permission-denied') e = { code: 'no-access' };
      throw e;
    });
  }
  function fetchRemote(id, sk) {
    if (inflight[id]) return inflight[id];
    // Página de equipo recién compartida desde otro dispositivo tuyo: puede seguir en tu espacio
    var order = sk === 'me' ? ['me'] : [sk, 'me'];
    var p = order.reduce(function (pr, s) {
      return pr.catch(function (e) { if (e && e.code !== 'missing' && e.code !== 'no-access' && e !== 'start') throw e; return downloadFrom(id, s); });
    }, Promise.reject('start'));
    inflight[id] = p.then(function (b) { delete inflight[id]; return b; }, function (e) {
      delete inflight[id];
      e = e && e.code ? e : { code: 'error' };
      miss[id] = { code: e.code, at: Date.now() }; emit(id);
      throw e;
    });
    return inflight[id];
  }
  function removeRemote(sk, id, parts) {
    var known = parts ? Promise.resolve(parts) : F().getDoc(fileRef(sk, id)).then(function (s) { return s.exists() ? ((s.data() || {}).parts | 0) : 0; });
    return known.then(function (n) {
      var b = F().writeBatch(DB());
      for (var i = 0; i < Math.min(Math.max(n, 1), 64); i++) b.delete(partRef(sk, id, i));
      b.delete(fileRef(sk, id));
      return b.commit();
    });
  }
  function queueDel(sk, id, parts) { (st.del[sk] = st.del[sk] || {})[id] = parts || 0; saveState(); }
  function flushDeletes() {
    var jobs = [];
    Object.keys(st.del).forEach(function (sk) { Object.keys(st.del[sk] || {}).forEach(function (id) { jobs.push([sk, id, st.del[sk][id]]); }); });
    var forget = function (sk, id) { if (st.del[sk]) { delete st.del[sk][id]; if (!Object.keys(st.del[sk]).length) delete st.del[sk]; } saveState(); };
    return jobs.reduce(function (pr, j) {
      return pr.then(function () {
        if (!scopeOk(j[0])) { forget(j[0], j[1]); return; }
        return removeRemote(j[0], j[1], j[2]).then(function () { forget(j[0], j[1]); }, function (e) {
          if (e && (e.code === 'permission-denied' || e.code === 'not-found')) forget(j[0], j[1]); else throw e;
        });
      });
    }, Promise.resolve());
  }
  function nextPending() {
    var out = null;
    Object.keys(recs).some(function (id) {
      var c = recs[id].cloud || {};
      return Object.keys(c).some(function (sk) { if (c[sk] === 'pending' && (fails[id + sk] || 0) < 3) { out = [id, sk]; return true; } return false; });
    });
    return out;
  }
  function schedulePump(ms) { clearTimeout(pumpT); pumpT = setTimeout(pump, ms || 0); }
  /** Sube lo pendiente y borra de la nube lo que ya no hace falta, de uno en uno */
  function pump() {
    if (!online()) return Promise.resolve();
    if (pumping) { pumpAgain = true; return pumping; }
    var loop = function () {
      if (!online()) return null;
      var next = nextPending();
      if (!next) return null;
      if (!scopeOk(next[1])) { delete recs[next[0]].cloud[next[1]]; return write(recs[next[0]]).then(loop); }
      return upload(next[0], next[1]).then(loop, function (e) {
        var code = e && e.code;
        fails[next[0] + next[1]] = (fails[next[0] + next[1]] || 0) + 1;
        if (code === 'permission-denied' || code === 'invalid-argument' || code === 'resource-exhausted') { console.warn('Archivos:', code); return loop(); }
        throw e;
      });
    };
    pumping = ready().then(flushDeletes).then(loop).catch(function (e) {
      console.warn('Archivos:', e && (e.code || e.message) || e);
      clearTimeout(retryT); retryT = setTimeout(pump, 60000);
    }).then(function () {
      pumping = null;
      if (pumpAgain) { pumpAgain = false; schedulePump(400); }
    });
    return pumping;
  }

  /* ---------- Mantenimiento: copias en el sitio correcto y limpieza ---------- */
  /** Archivos que usa cada sitio (cuentan también las páginas de la papelera) */
  function references() {
    var out = {};
    if (!P()) return out;
    var I = P().index();
    Object.keys(I.items).forEach(function (pid) {
      var m = I.items[pid], sk = m.team ? 't:' + m.team : 'me';
      P().content(pid).blocks.forEach(function (b) { if (b.f) (out[sk] = out[sk] || {})[b.f] = 1; });
    });
    return out;
  }
  function maintain() {
    return ready().then(function () {
      var refs = references(), used = {}, now = Date.now(), changed = false, writes = [];
      Object.keys(refs).forEach(function (sk) {
        Object.keys(refs[sk]).forEach(function (id) {
          used[id] = 1;
          var r = recs[id];
          // Un archivo que se usa en un sitio donde aún no está: se copia allí desde aquí
          if (r && scopeOk(sk) && !r.cloud[sk]) { r.cloud[sk] = 'pending'; writes.push(write(r)); }
        });
      });
      Object.keys(recs).forEach(function (id) {
        if (used[id]) { if (st.unref[id]) { delete st.unref[id]; changed = true; } return; }
        if (!st.unref[id]) { st.unref[id] = now; changed = true; return; }
        if (now - st.unref[id] < GRACE) return;
        var r = recs[id];
        Object.keys(r.cloud || {}).forEach(function (sk) { if (r.cloud[sk] === 'done') queueDel(sk, id, Math.ceil((r.size || 1) / PART)); });
        delete st.unref[id]; changed = true;
        writes.push(drop(id));
      });
      Object.keys(st.unref).forEach(function (id) { if (!recs[id]) { delete st.unref[id]; changed = true; } });
      if (changed) saveState();
      return Promise.all(writes).then(function () {
        if (writes.length) emit(null);
        if (!online()) return;
        schedulePump(300);
        // En la nube, una vez al día por sitio y solo si las páginas de ese sitio ya están al día
        var scopes = ['me'].concat(Object.keys(refs).filter(function (s) { return s !== 'me'; }));
        return scopes.reduce(function (pr, sk) {
          return pr.then(function () {
            if (!scopeOk(sk) || now - (st.gcAt[sk] || 0) < 86400000) return;
            if (!W.PageSync || !W.PageSync.settled || !W.PageSync.settled(sk)) return;
            return gcCloud(sk, refs[sk] || {}).catch(function (e) { console.warn('Archivos:', e && (e.code || e.message)); });
          });
        }, Promise.resolve());
      });
    });
  }
  function gcCloud(sk, refs) {
    return F().getDocs(colRef(sk)).then(function (snap) {
      var listed = {}, now = Date.now(), cu = st.cloudUnref[sk] = st.cloudUnref[sk] || {}, writes = [];
      snap.forEach(function (d) {
        var id = d.id, data = d.data() || {};
        listed[id] = 1;
        if (refs[id]) { delete cu[id]; return; }
        if (!cu[id]) { cu[id] = now; return; }
        if (now - cu[id] < GRACE) return;
        queueDel(sk, id, data.parts | 0);
        delete cu[id];
        if (recs[id] && recs[id].cloud[sk]) { delete recs[id].cloud[sk]; writes.push(write(recs[id])); }
      });
      Object.keys(cu).forEach(function (id) { if (!listed[id]) delete cu[id]; });
      // Lo que este dispositivo creía subido y no está en la nube: se vuelve a subir
      Object.keys(refs).forEach(function (id) { var r = recs[id]; if (r && r.cloud[sk] === 'done' && !listed[id]) { r.cloud[sk] = 'pending'; writes.push(write(r)); } });
      st.gcAt[sk] = now; saveState();
      return Promise.all(writes).then(function () { schedulePump(300); });
    });
  }
  function scheduleMaintain(ms) { clearTimeout(maintT); maintT = setTimeout(function () { maintain().catch(function (e) { console.warn('Archivos:', e && (e.message || e)); }); }, ms || 2000); }

  /* ---------- Abrir, descargar y ver ---------- */
  function explain(e, name) {
    var c = e && e.code, n = name ? '«' + name + '»' : 'este archivo';
    switch (c) {
      case 'too-big': return n + ' pesa ' + fmtSize(e.size) + '. El máximo es ' + fmtSize(MAX) + ' por archivo.';
      case 'quota': return 'No queda espacio en este dispositivo para guardar ' + n + '.';
      case 'store': return 'No se pudo guardar ' + n + ' en este dispositivo.';
      case 'offline': return 'Sin conexión: ' + n + ' aún no está en este dispositivo.';
      case 'signed-out': return 'Entra en tu cuenta para traer ' + n + ' de la nube.';
      case 'missing': return n.charAt(0).toUpperCase() + n.slice(1) + ' aún no está en la nube: se subirá desde el dispositivo donde se añadió.';
      case 'no-access': return 'No tienes acceso a ' + n + '.';
      case 'corrupt': return 'No se pudo descargar ' + n + ' entero. Vuelve a intentarlo.';
      default: return 'No se pudo abrir ' + n + '.';
    }
  }
  function short(code) {
    return { offline: 'Sin conexión', 'signed-out': 'En la nube', missing: 'Aún no está en la nube', 'no-access': 'Sin acceso', corrupt: 'Descarga incompleta' }[code] || 'No disponible';
  }
  /** Estado para mostrarlo: local (pendiente de subir), up (subiendo), ok, down (bajando), cloud (no está aquí), none */
  function status(id, sk) {
    var r = recs[id];
    if (r) {
      var c = r.cloud[sk];
      if (c === 'done') return { s: 'ok' };
      if (progress[id] != null && c === 'pending') return { s: 'up', p: progress[id] };
      return { s: 'local' };
    }
    if (progress[id] != null) return { s: 'down', p: progress[id] };
    if (miss[id]) return { s: 'none', code: miss[id].code };
    return { s: 'cloud' };
  }
  function get(id, sk) {
    return ready().then(function () {
      if (!recs[id]) return fetchRemote(id, sk || 'me');
      return readBlob(id).then(function (b) {
        if (b) return b;
        delete recs[id];
        return fetchRemote(id, sk || 'me');
      });
    });
  }
  function url(id, sk) {
    if (urls[id]) return Promise.resolve(urls[id]);
    return get(id, sk).then(function (b) { if (!urls[id]) urls[id] = URL.createObjectURL(b); return urls[id]; });
  }
  function withBlob(ref, sk, fn, onFail) {
    var slow = setTimeout(function () { W.Toast.show({ text: 'Trayendo «' + (ref.n || 'archivo') + '» de la nube…', icon: 'download', duration: 2500 }); }, 450);
    return get(ref.f, sk).then(function (blob) { clearTimeout(slow); return fn(blob); }, function (e) {
      clearTimeout(slow);
      if (onFail) onFail(e);
      W.Toast.show({ text: explain(e, ref.n), type: 'danger', icon: 'alert', duration: 5000 });
    });
  }
  /** Apps de Android y de ordenador: abrir con otra aplicación y guardar donde toca */
  function native() {
    var A = window.WhiderAndroid, D = window.WhiderDesktop;
    var type = function (ref, blob) { return cleanType(ref.m || blob.type); };
    if (A && typeof A.openFile === 'function' && typeof A.saveFile === 'function') return {
      open: function (ref, blob) { return b64(blob).then(function (d) { A.openFile(cleanName(ref.n), type(ref, blob), d); }); },
      save: function (ref, blob) { return b64(blob).then(function (d) { A.saveFile(cleanName(ref.n), type(ref, blob), d); }); }
    };
    if (D && typeof D.openFile === 'function' && typeof D.saveBinary === 'function') return {
      open: function (ref, blob) {
        return bytes(blob).then(function (u8) { return D.openFile(cleanName(ref.n), u8); }).then(function (r) {
          if (r && r.blocked) W.Toast.show({ text: 'Por seguridad, WHIDER no abre programas ni scripts. Descárgalo si confías en quien lo añadió.', icon: 'shield', duration: 6000 });
          else if (r && !r.ok) W.Toast.show({ text: 'No hay ninguna aplicación para abrir «' + ref.n + '». Puedes descargarlo.', type: 'danger', icon: 'alert' });
        });
      },
      save: function (ref, blob) {
        return bytes(blob).then(function (u8) { return D.saveBinary(cleanName(ref.n), u8); }).then(function (r) {
          if (r && r.ok) W.Toast.show({ text: 'Guardado en ' + r.path, icon: 'check', type: 'success', action: D.showFile ? { label: 'Mostrar', fn: function () { D.showFile(r.path); } } : null });
          else if (r && r.error) W.Toast.show({ text: 'No se pudo guardar: ' + r.error, type: 'danger', icon: 'alert' });
        });
      }
    };
    return null;
  }
  function saveBlob(name, blob) {
    var u = URL.createObjectURL(blob), a = U.el('a', { attrs: { href: u, download: cleanName(name) }, style: { display: 'none' } });
    document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(u); if (a.parentNode) a.parentNode.removeChild(a); }, 5000);
  }
  function download(ref, sk) {
    var nat = native();
    return withBlob(ref, sk, function (blob) { if (nat) return nat.save(ref, blob); saveBlob(ref.n, blob); });
  }
  /** Lo que se ve dentro de la app: imágenes, vídeo, audio y texto. El SVG nunca (puede llevar código) */
  function viewable(ref) {
    var t = String(ref.m || '');
    if (/^image\//.test(t)) return t !== 'image/svg+xml' && !/hei[cf]/.test(t);
    if (/^video\//.test(t)) return !!document.createElement('video').canPlayType(t);
    if (/^audio\//.test(t)) return !!document.createElement('audio').canPlayType(t);
    if (/^text\/(plain|markdown|csv)$/.test(t) || t === 'application/json') return (ref.s || 0) <= 2 * 1048576;
    return false;
  }
  function open(ref, sk, opts) {
    if (!ref || !ref.f) return null;
    if (viewable(ref)) return preview(ref, sk, opts);
    var nat = native();
    if (nat) return withBlob(ref, sk, function (blob) { return nat.open(ref, blob); });
    // Navegador de ordenador: el PDF en otra pestaña (se abre ya para que no la bloquee el navegador)
    if (W.Layout.desktop && ref.m === 'application/pdf') {
      var w = null;
      try { w = window.open('', '_blank'); } catch (e) { w = null; }
      return withBlob(ref, sk, function (blob) {
        var u = URL.createObjectURL(new Blob([blob], { type: 'application/pdf' }));
        if (w && !w.closed) w.location.href = u; else saveBlob(ref.n, blob);
        setTimeout(function () { URL.revokeObjectURL(u); }, 120000);
      }, function () { if (w) w.close(); });
    }
    return download(ref, sk);
  }

  var viewer = null;
  function preview(ref, sk, opts) {
    opts = opts || {};
    closePreview();
    var k = kind(ref.m, ref.n), nat = native();
    var stage = U.el('div.fv-stage');
    var btn = function (icon, label, fn, cls) {
      return U.el('button.fv-btn' + (cls ? '.' + cls : ''), { attrs: { type: 'button', 'aria-label': label, title: label }, on: { click: function (e) { e.stopPropagation(); fn(); } } }, [U.icon(icon)]);
    };
    var close = btn('close', 'Cerrar', closePreview, 'close');
    var layer = U.el('div.fv-layer', { attrs: { role: 'dialog', 'aria-modal': 'true', 'aria-label': ref.n || 'Vista previa' } }, [
      U.el('header.fv-bar', [
        U.el('div.fv-title', [U.el('strong', { text: ref.n || 'Archivo' }), U.el('small', { text: k.label + (ref.s ? ' · ' + fmtSize(ref.s) : '') })]),
        U.el('div.fv-acts', [
          btn('download', nat ? 'Guardar en el dispositivo' : 'Descargar', function () { download(ref, sk); }),
          nat ? btn('external', 'Abrir con otra aplicación', function () { withBlob(ref, sk, function (b) { return nat.open(ref, b); }); }) : null,
          opts.onDelete ? btn('trash', 'Quitar de la página', function () { closePreview(); opts.onDelete(); }, 'danger') : null,
          close
        ])
      ]),
      stage
    ]);
    stage.appendChild(U.el('div.fv-wait', [U.el('span.fv-spin'), U.el('span', { text: 'Abriendo…' })]));
    layer.addEventListener('click', function (e) { if (e.target === layer || e.target === stage) closePreview(); });
    var onKey = function (e) {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closePreview(); }
      else if (e.key === 'Tab') {
        // El foco se queda dentro del visor
        var f = U.$$('button, video, audio, [tabindex="0"]', layer).filter(function (x) { return !x.disabled; });
        if (!f.length) return;
        var i = f.indexOf(document.activeElement);
        if (e.shiftKey && i <= 0) { e.preventDefault(); f[f.length - 1].focus(); } else if (!e.shiftKey && i === f.length - 1) { e.preventDefault(); f[0].focus(); }
      }
    };
    document.addEventListener('keydown', onKey, true);
    document.body.appendChild(layer);
    requestAnimationFrame(function () { layer.classList.add('open'); });
    var mine = viewer = { el: layer, onKey: onKey, back: document.activeElement };
    setTimeout(function () { if (viewer === mine) close.focus({ preventScroll: true }); }, 40);
    var fail = function (e) {
      if (viewer !== mine) return;
      U.clear(stage);
      stage.appendChild(U.el('div.fv-wait', [U.icon('alert'), U.el('span', { text: explain(e, ref.n) })]));
    };
    get(ref.f, sk).then(function (blob) {
      if (viewer !== mine) return;
      var t = String(ref.m || blob.type || '');
      if (/^image\/|^video\/|^audio\//.test(t)) {
        return url(ref.f, sk).then(function (u) {
          if (viewer !== mine) return;
          U.clear(stage);
          if (/^image\//.test(t)) {
            var img = U.el('img.fv-img', { attrs: { src: u, alt: ref.n || 'Imagen', draggable: 'false' } });
            // Toca para ver a tamaño real (y moverla); otra vez para encajarla
            img.addEventListener('click', function (e) { e.stopPropagation(); stage.classList.toggle('zoom'); });
            stage.appendChild(img);
          } else if (/^video\//.test(t)) stage.appendChild(U.el('video.fv-media', { attrs: { src: u, controls: true, playsinline: true, preload: 'metadata' } }));
          else stage.appendChild(U.el('div.fv-audio', [U.el('span.fv-audio-ic', [U.icon('music')]), U.el('audio.fv-media', { attrs: { src: u, controls: true, preload: 'metadata' } })]));
        });
      }
      return textOf(blob.slice(0, 400000)).then(function (txt) {
        if (viewer !== mine) return;
        U.clear(stage);
        stage.appendChild(U.el('pre.fv-text', { attrs: { tabindex: '0' }, text: txt + (blob.size > 400000 ? '\n\n…' : '') }));
      });
    }).catch(fail);
    return null;
  }
  function closePreview() {
    if (!viewer) return false;
    var v = viewer; viewer = null;
    document.removeEventListener('keydown', v.onKey, true);
    U.$$('video, audio', v.el).forEach(function (m) { try { m.pause(); } catch (e) { /* sin reproducción */ } });
    v.el.classList.remove('open');
    setTimeout(function () { if (v.el.parentNode) v.el.parentNode.removeChild(v.el); }, 220);
    try { if (v.back && v.back.focus && document.body.contains(v.back)) v.back.focus({ preventScroll: true }); } catch (e) { /* sin foco */ }
    return true;
  }

  /** Abre el selector de archivos del sistema → Promise<File[]> */
  function pick(opts) {
    opts = opts || {};
    return new Promise(function (resolve) {
      var input = U.el('input', { attrs: { type: 'file', accept: opts.accept || null }, style: { position: 'fixed', left: '-9999px', top: '0', opacity: '0' } });
      if (opts.multiple) input.multiple = true;
      var finished = false;
      var finish = function (list) { if (finished) return; finished = true; resolve(list || []); setTimeout(function () { if (input.parentNode) input.parentNode.removeChild(input); }, 0); };
      input.addEventListener('change', function () { finish(Array.prototype.slice.call(input.files || [])); });
      input.addEventListener('cancel', function () { finish([]); });
      document.body.appendChild(input);
      input.click();
    });
  }

  var Files = {
    MAX: MAX,
    ready: ready,
    pick: pick,
    /**
     * Guarda un archivo para una página → Promise<{ f, n, m, s, ar, image }>
     * opts: { scope: 'me' | 't:<equipo>', image: false para no tratarlo como imagen }
     */
    add: function (file, opts) {
      opts = opts || {};
      return ready().then(function () {
        if (!file) throw { code: 'store' };
        var name = cleanName(file.name), type = mimeOf(file);
        var asImage = opts.image !== false && /^image\/(jpeg|png|gif|webp|avif|bmp|heic|heif)$/.test(type);
        if (!asImage && file.size > MAX) throw { code: 'too-big', size: file.size, name: name };
        var prep = asImage ? prepImage(file, type, name) : Promise.resolve({ blob: file, type: type, name: name, image: false });
        return prep.then(function (p) {
          if (p.blob.size > MAX) throw { code: 'too-big', size: p.blob.size, name: name };
          var meta = { id: newId(), name: p.name, type: p.type, size: p.blob.size, at: Date.now(), ar: p.ar || null, cloud: {} };
          meta.cloud[opts.scope && /^(me|t:[A-Za-z0-9_-]{4,40})$/.test(opts.scope) ? opts.scope : 'me'] = 'pending';
          return write(meta, p.blob).then(function () {
            recs[meta.id] = meta;
            if (p.image) { try { urls[meta.id] = URL.createObjectURL(p.blob); } catch (e) { /* se crea al verla */ } }
            persist(); emit(meta.id); schedulePump(500);
            return { f: meta.id, n: meta.name, m: meta.type, s: meta.size, ar: meta.ar || null, image: !!p.image };
          }, function (e) { throw { code: e && e.name === 'QuotaExceededError' ? 'quota' : 'store', name: name }; });
        });
      });
    },
    get: get,
    url: url,
    /** Dirección ya preparada (sin esperar), o null */
    peekUrl: function (id) { return urls[id] || null; },
    status: status,
    has: function (id) { return !!recs[id]; },
    scopeOf: scopeOf,
    canSync: canSync,
    kind: kind,
    fmtSize: fmtSize,
    explain: explain,
    short: short,
    open: open,
    download: download,
    preview: preview,
    closePreview: closePreview,
    isPreviewOpen: function () { return !!viewer; },
    /** Sube lo pendiente ahora */
    sync: pump,
    maintain: scheduleMaintain,
    /** Antes de cerrar sesión: espera (como mucho ms) a que se suba lo pendiente */
    flush: function (ms) {
      return Promise.race([pump(), new Promise(function (r) { setTimeout(r, ms || 15000); })]);
    },
    /** Hay archivos que aún no están en la nube */
    pendingCount: function () { var n = 0; Object.keys(recs).forEach(function (id) { var c = recs[id].cloud; if (Object.keys(c).some(function (k) { return c[k] === 'pending'; })) n++; }); return n; },
    /** Al cerrar sesión: fuera de este dispositivo (lo de la cuenta sigue en la nube) */
    clearLocal: function () {
      st = { del: {}, unref: {}, cloudUnref: {}, gcAt: {} }; saveState();
      loaded = Promise.resolve();
      return wipe().then(function () { emit(null); });
    },
    /** «Borrar todos los datos»: tus archivos (los de tus equipos se quedan con su equipo) */
    resetAll: function () {
      return ready().then(function () {
        var refs = references(), used = {};
        Object.keys(refs).forEach(function (sk) { Object.keys(refs[sk]).forEach(function (id) { used[id] = 1; }); });
        var jobs = [];
        Object.keys(recs).forEach(function (id) {
          if (used[id]) return;
          var r = recs[id];
          if (r.cloud.me === 'done') queueDel('me', id, Math.ceil((r.size || 1) / PART));
          jobs.push(drop(id));
        });
        return Promise.all(jobs).then(function () {
          emit(null);
          if (!online()) return;
          return F().getDocs(colRef('me')).then(function (snap) {
            snap.forEach(function (d) { if (!(refs.me || {})[d.id]) queueDel('me', d.id, (d.data() || {}).parts | 0); });
          }).catch(function () { /* se borrarán en la limpieza */ }).then(function () { schedulePump(100); });
        });
      });
    },
    /** Al eliminar la cuenta: todos tus archivos de la nube */
    deleteRemote: function () {
      if (!online()) return Promise.resolve();
      return F().getDocs(colRef('me')).then(function (snap) {
        var list = [];
        snap.forEach(function (d) { list.push([d.id, (d.data() || {}).parts | 0]); });
        return list.reduce(function (pr, x) { return pr.then(function () { return removeRemote('me', x[0], x[1]); }); }, Promise.resolve());
      }).then(function () { st.del = {}; saveState(); }).catch(function (e) { console.warn('Archivos:', e && (e.code || e.message)); });
    },
    /** Al borrar un equipo entero (si eras su único miembro): sus archivos */
    deleteTeam: function (sid) {
      var sk = 't:' + sid;
      if (!online() || !/^t:[A-Za-z0-9_-]{4,40}$/.test(sk)) return Promise.resolve();
      return F().getDocs(colRef(sk)).then(function (snap) {
        var list = [];
        snap.forEach(function (d) { list.push([d.id, (d.data() || {}).parts | 0]); });
        return list.reduce(function (pr, x) { return pr.then(function () { return removeRemote(sk, x[0], x[1]); }); }, Promise.resolve());
      }).catch(function (e) { console.warn('Archivos:', e && (e.code || e.message)); });
    }
  };
  W.Files = Files;

  // Soltar un archivo fuera del editor no debe sacar al navegador de la app
  var hasFiles = function (e) { var t = e.dataTransfer && e.dataTransfer.types; return !!t && Array.prototype.indexOf.call(t, 'Files') >= 0; };
  window.addEventListener('dragover', function (e) { if (hasFiles(e)) e.preventDefault(); });
  window.addEventListener('drop', function (e) { if (hasFiles(e)) e.preventDefault(); });

  // Se sube al entrar, al recuperar la conexión, cada poco si hay algo pendiente y tras sincronizar páginas
  if (W.Auth && W.Auth.onChange) W.Auth.onChange(function (user) { if (user) { fails = {}; ready().then(function () { scheduleMaintain(4000); }); } });
  window.addEventListener('online', function () { fails = {}; schedulePump(1500); });
  setInterval(function () { if (!document.hidden && online() && (nextPending() || Object.keys(st.del).length)) pump(); }, 60000);
  if (W.Pages && W.Pages.subscribe) W.Pages.subscribe(function (r) { if (r.team || r.move || r.trash || r.restore || r.destroy || r.remote || r.reset) scheduleMaintain(2500); });
  ready().then(function () { scheduleMaintain(6000); });
})(window.Whider);
