/**
 * WHIDER · Invitaciones por enlace y por código QR
 *
 *  - Tu enlace de invitación (para amigos o para trabajo) y el de cada equipo. Se comparten por
 *    WhatsApp, correo… o se enseñan como código QR (con tu personaje en el centro).
 *  - Al abrir un enlace: en la web, en la app de Android o en la del ordenador (whider://),
 *    WHIDER enseña quién te invita y te conecta con un toque. Si aún no tienes cuenta, la
 *    invitación espera a que entres.
 *  - Escáner con la cámara (lector nativo si existe; si no, jsQR) o pegar el enlace o el código.
 *
 * Enlaces: https://whider-red.vercel.app/i/?c=WH-XXXXXX&k=clave&t=f|w&n=Nombre&b=personaje
 *          https://whider-red.vercel.app/i/?s=equipo&k=clave&n=Equipo&by=Nombre
 */
window.Whider = window.Whider || {};

(function (W) {
  'use strict';
  var U = W.U, S = function () { return W.State; };
  var CFG = window.WHIDER_CONFIG || {};
  var PENDING = 'whider.pendingInvite';
  var BUDDY_KEYS = ['body', 'tone', 'eyes', 'mouth', 'head', 'acc', 'fx', 'bg', 'frame'];

  function base() { return String((CFG.links && CFG.links.base) || 'https://whider-red.vercel.app').replace(/\/+$/, ''); }
  function enc(v) { return encodeURIComponent(String(v || '')); }
  function buddyCode(c) { c = c || W.Character.config(); return BUDDY_KEYS.map(function (k) { return String(c[k] || '').replace(/[^a-z0-9]/g, ''); }).join('.') + (c.cheeks ? '' : '.0'); }
  function buddyFrom(code) {
    if (!code || typeof code !== 'string') return null;
    var p = code.split('.'), out = {};
    BUDDY_KEYS.forEach(function (k, i) { if (p[i] && /^[a-z0-9]{2,20}$/.test(p[i])) out[k] = p[i]; });
    out.cheeks = p[BUDDY_KEYS.length] !== '0';
    return out;
  }

  /* ---------- Enlaces ---------- */
  function personLink(kind) {
    var st = S(), code = st.social.code;
    if (!code) return null;
    var k = W.People.invite(kind);
    return base() + '/i/?c=' + enc(code) + '&k=' + enc(k) + '&t=' + (kind === 'work' ? 'w' : 'f') + '&n=' + enc(W.People.myName()) + '&b=' + enc(buddyCode());
  }
  function teamLink(sid, key, name) {
    return base() + '/i/?s=' + enc(sid) + '&k=' + enc(key) + '&n=' + enc(name) + '&by=' + enc(W.People.myName());
  }
  /** Lee una invitación de un enlace (web, whider:// o la parte tras #i=), o de un código WH-XXXXXX */
  function parse(raw) {
    if (!raw) return null;
    var s = String(raw).trim();
    var code = s.toUpperCase().replace(/\s+/g, '');
    if (/^WH-?[A-Z0-9]{6}$/.test(code)) return { type: 'code', code: code.replace(/^WH-?/, 'WH-') };
    var q = null;
    try {
      if (/^whider:/i.test(s)) q = s.replace(/^whider:\/*(i\/?)?\??/i, '');
      else if (/^https?:\/\//i.test(s)) { var u = new URL(s); q = u.search ? u.search.slice(1) : (u.hash.indexOf('i=') >= 0 ? decodeURIComponent(u.hash.split('i=')[1] || '') : ''); }
      else if (/^[#?]?i=/.test(s)) q = decodeURIComponent(s.replace(/^[#?]?i=/, ''));
      else if (/(^|&)(c|s)=/.test(s)) q = s.replace(/^[#?]/, '');
    } catch (e) { q = null; }
    if (!q) return null;
    var p = {};
    q.split('&').forEach(function (kv) { var i = kv.indexOf('='); if (i > 0) { try { p[kv.slice(0, i)] = decodeURIComponent(kv.slice(i + 1).replace(/\+/g, ' ')); } catch (e) { /* mal escrito */ } } });
    if (p.s && p.k) return { type: 'team', sid: p.s, key: p.k, name: (p.n || 'Equipo').slice(0, 40), by: (p.by || '').slice(0, 40) };
    if (p.c) return { type: 'person', code: String(p.c).toUpperCase(), key: p.k || '', kind: p.t === 'w' ? 'work' : 'friend', name: (p.n || '').slice(0, 40), buddy: buddyFrom(p.b) };
    return null;
  }

  /* ---------- Abrir una invitación ---------- */
  function savePending(inv) { try { localStorage.setItem(PENDING, JSON.stringify(Object.assign({ at: Date.now() }, inv))); } catch (e) { /* sin almacenamiento */ } }
  function takePending() {
    try { var raw = localStorage.getItem(PENDING); localStorage.removeItem(PENDING); var x = raw ? JSON.parse(raw) : null; return x && Date.now() - (x.at || 0) < 7 * 86400000 ? x : null; } catch (e) { return null; }
  }
  var appReady = false, queue = null;
  /** Abre una invitación (enlace, QR, whider:// o código) */
  function open(raw) {
    var inv = typeof raw === 'object' && raw ? raw : parse(raw);
    if (!inv) { W.Toast.show({ text: 'Ese código no es una invitación de WHIDER', type: 'danger', icon: 'qr' }); return; }
    if (!appReady) { queue = inv; return; }
    if (inv.type === 'code') { if (!needAccount(inv)) W.People.addByCode(inv.code); return; }
    if (needAccount(inv)) return;
    if (inv.type === 'team') teamSheet(inv); else personSheet(inv);
  }
  /** Sin cuenta (o sin verificar): la invitación espera a que entres */
  function needAccount(inv) {
    var b = W.People.blocker();
    if (!b || b.soft) return false;
    savePending(inv);
    if (b.id === 'guest' && W.AuthScreen && W.Auth.configured()) {
      W.Toast.show({ text: 'Entra o crea tu cuenta y te conectamos enseguida', icon: 'users', duration: 5000 });
      W.AuthScreen.open({ mode: 'register' });
    } else W.Toast.show({ text: b.title + '. ' + b.text, icon: 'info', duration: 6000 });
    return true;
  }
  function personSheet(inv) {
    if (inv.code === S().social.code) { W.Toast.show({ text: 'Es tu propia invitación: compártela con otra persona', icon: 'info' }); return; }
    var kind = inv.kind || 'friend';
    var who = inv.name || 'Alguien';
    var seg = W.UI.segmented([{ value: 'friend', label: 'Amigo' }, { value: 'work', label: 'Trabajo' }], kind, function (v) { kind = v; });
    var s = W.Sheet.open({ title: 'Invitación', className: 'invite-sheet', body: [
      U.el('div.inv-hero', [
        W.Avatar.buddy(inv.buddy || null, 112, { live: true, cls: 'inv-av' }),
        U.el('strong', { text: who + ' te invita a conectar' }),
        U.el('p', { text: kind === 'work' ? 'Para trabajar juntos: chats, equipos y páginas compartidas.' : 'Para animaros, comparar rachas y chatear.' })
      ]),
      W.UI.section({ header: 'Guardar como', items: [U.el('div.cell', [seg])] })
    ], foot: [U.el('button.btn.ghost', { text: 'Ahora no', on: { click: function () { s.close(); } } }), U.el('button.btn.primary', { on: { click: function (e) {
      e.currentTarget.disabled = true;
      accept(inv, kind).then(function (okk) { s.close(); if (okk) W.Router.go('friends'); });
    } } }, [U.icon('users', 'sm'), 'Conectar'])] });
  }
  function accept(inv, kind) {
    var F = W.Auth.sdk(), db = W.Auth.db();
    return W.People.ensureEnabled().then(function () {
      return F.getDoc(F.doc(db, 'codes', inv.code));
    }).then(function (snap) {
      if (!snap.exists()) { W.Toast.show({ text: 'Esa invitación ya no es válida. Pídele a ' + (inv.name || 'quien te invitó') + ' un enlace nuevo.', type: 'danger', duration: 5000 }); return false; }
      var to = snap.data().uid, f = S().social.friends[to];
      if (to === W.People.uid()) { W.Toast.show({ text: 'Es tu propia invitación', icon: 'info' }); return false; }
      if (f && !f.removed && !f.pending) { W.Toast.show({ text: (inv.name || 'Esa persona') + ' ya está en tus contactos', icon: 'users' }); return true; }
      return W.People.send(to, 'links', { token: inv.key || '', name: W.People.myName(), code: S().social.code, kind: kind, at: Date.now() }).then(function () {
        S().setFriend(to, { name: inv.name || '', code: inv.code, removed: false, pending: true, kind: kind });
        W.People.loadProfiles([to]);
        W.Toast.show({ text: 'Conectado con ' + (inv.name || 'tu contacto') + '. Ya podéis chatear.', type: 'success', icon: 'users', duration: 4500 });
        W.Audio.complete();
        return true;
      });
    }).catch(function (e) {
      console.warn('Invitación:', e && (e.code || e.message));
      var b = W.People.blocker();
      W.Toast.show({ text: b ? b.title : 'No se pudo conectar. Inténtalo de nuevo.', type: 'danger' });
      return false;
    });
  }
  function teamSheet(inv) {
    if (S().social.spaces[inv.sid] && !S().social.spaces[inv.sid].left) { W.Toast.show({ text: 'Ya estás en «' + inv.name + '»', icon: 'team' }); W.Router.go('friends'); return; }
    var s = W.Sheet.open({ title: 'Invitación a un equipo', className: 'invite-sheet', body: [
      U.el('div.inv-hero', [U.el('span.inv-team', [U.icon('team')]), U.el('strong', { text: (inv.by ? inv.by + ' te invita al equipo' : 'Te invitan al equipo') + ' «' + inv.name + '»' }),
        U.el('p', { text: 'Tendréis un chat de equipo, tareas en común y páginas del Cuaderno que editáis a la vez.' })])
    ], foot: [U.el('button.btn.ghost', { text: 'Ahora no', on: { click: function () { s.close(); } } }), U.el('button.btn.primary', { on: { click: function (e) {
      e.currentTarget.disabled = true;
      W.People.joinTeam(inv.sid, inv.key, inv.name).then(function () {
        s.close();
        W.Toast.show({ text: 'Ya formas parte de «' + inv.name + '»', type: 'success', icon: 'team' });
        W.Audio.complete();
        W.State.ui.peopleTab = 'teams';
        W.Router.go('friends');
      }).catch(function (err) {
        console.warn('Equipo:', err && (err.code || err.message));
        s.close();
        W.Toast.show({ text: err && err.code === 'permission-denied' ? 'El enlace del equipo ya no es válido. Pide uno nuevo.' : 'No se pudo entrar en el equipo. Inténtalo de nuevo.', type: 'danger', duration: 5000 });
      });
    } } }, [U.icon('team', 'sm'), 'Unirme al equipo'])] });
  }

  /* ---------- Código QR ---------- */
  var qrLoading = null;
  /** La librería del QR se carga solo cuando hace falta */
  function loadQR() {
    if (window.qrcode) return Promise.resolve(window.qrcode);
    if (qrLoading) return qrLoading;
    qrLoading = new Promise(function (resolve, reject) {
      var s = document.createElement('script'); s.src = 'js/vendor/qrcode.js'; s.async = true;
      s.onload = function () { window.qrcode ? resolve(window.qrcode) : reject(new Error('qr')); };
      s.onerror = function () { qrLoading = null; reject(new Error('qr')); };
      document.head.appendChild(s);
    });
    return qrLoading;
  }
  /** SVG nítido del código (módulos negros sobre blanco) con un hueco en el centro para el personaje */
  function qrNode(text, o) {
    o = o || {};
    if (!window.qrcode) return U.el('div.qr-missing', { text: 'QR no disponible' });
    var qr = window.qrcode(0, 'Q'); qr.addData(text); qr.make();
    var n = qr.getModuleCount(), pad = 2, size = n + pad * 2, d = '';
    var hole = o.center ? Math.ceil(n * 0.22) | 1 : 0, h0 = Math.floor((n - hole) / 2), h1 = h0 + hole;
    for (var r = 0; r < n; r++) for (var c = 0; c < n; c++) {
      if (!qr.isDark(r, c)) continue;
      if (hole && r >= h0 && r < h1 && c >= h0 && c < h1) continue;
      d += 'M' + (c + pad) + ' ' + (r + pad) + 'h1v1h-1z';
    }
    var svg = '<svg viewBox="0 0 ' + size + ' ' + size + '" shape-rendering="crispEdges" class="qr-svg" role="img" aria-label="Código QR"><rect width="' + size + '" height="' + size + '" fill="#FFFFFF"/><path d="' + d + '" fill="#000000"/></svg>';
    var box = U.el('div.qr-box', { html: svg });
    if (o.center) box.appendChild(U.el('span.qr-center', [o.center]));
    return box;
  }
  function qrSheet(opts) {
    opts = opts || {};
    var kind = opts.kind || 'friend';
    var host = U.el('div.qr-host');
    var draw = function () {
      U.clear(host);
      if (!window.qrcode) { host.appendChild(U.el('p.hint', { text: 'Preparando tu código…' })); loadQR().then(draw).catch(function () { U.clear(host); host.appendChild(U.el('p.hint', { text: 'No se pudo crear el código QR.' })); }); return; }
      var link = opts.team ? W.People.teamLink(opts.team) : personLink(kind);
      if (!link) { host.appendChild(U.el('p.hint', { text: 'Activa la comunidad para tener tu código.' })); return; }
      host.appendChild(U.el('div.qr-card', [
        qrNode(link, { center: opts.team ? U.el('span.qr-team', [U.icon('team')]) : W.Avatar.me(54) }),
        U.el('strong', { text: opts.team ? (W.People.team(opts.team) || {}).name || 'Equipo' : W.People.myName() }),
        U.el('small', { text: opts.team ? 'Escanéalo para unirte al equipo' : (kind === 'work' ? 'Escanéalo para conectar conmigo (trabajo)' : 'Escanéalo para conectar conmigo') })
      ]));
      host.appendChild(U.el('div.qr-acts', [
        U.el('button.btn.soft', { on: { click: function () { share(link, opts.team); } } }, [U.icon('share', 'sm'), 'Compartir enlace']),
        U.el('button.btn.ghost', { on: { click: function () { copy(link); } } }, [U.icon('copy', 'sm'), 'Copiar'])
      ]));
    };
    var body = [host];
    if (!opts.team) body.unshift(U.el('div.qr-kind', [W.UI.segmented([{ value: 'friend', label: 'Amigos' }, { value: 'work', label: 'Trabajo' }], kind, function (v) { kind = v; draw(); })]));
    draw();
    return W.Sheet.open({ title: opts.team ? 'Invitar al equipo' : 'Tu código QR', className: 'qr-sheet', body: body });
  }
  function copy(text) {
    var done = function () { W.Toast.show({ text: 'Enlace copiado', icon: 'copy' }); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done).catch(function () { fallbackCopy(text); done(); });
    else { fallbackCopy(text); done(); }
  }
  function fallbackCopy(text) { var t = U.el('textarea', { style: { position: 'fixed', left: '-9999px' } }); t.value = text; document.body.appendChild(t); t.select(); try { document.execCommand('copy'); } catch (e) { /* sin portapapeles */ } t.parentNode.removeChild(t); }
  function share(link, team) {
    var text = team ? 'Únete a nuestro equipo en WHIDER' : 'Conecta conmigo en WHIDER';
    if (window.WhiderAndroid && typeof window.WhiderAndroid.shareText === 'function') window.WhiderAndroid.shareText(text + ': ' + link);
    else if (navigator.share && !W.Layout.desktop) navigator.share({ title: 'WHIDER', text: text, url: link }).catch(function () {});
    else copy(link);
  }

  /* ---------- Escáner ---------- */
  var jsqrLoading = null;
  function loadJsQR() {
    if (window.jsQR) return Promise.resolve(window.jsQR);
    if (jsqrLoading) return jsqrLoading;
    jsqrLoading = new Promise(function (resolve, reject) {
      var s = document.createElement('script'); s.src = 'js/vendor/jsqr.js'; s.async = true;
      s.onload = function () { window.jsQR ? resolve(window.jsQR) : reject(new Error('jsqr')); };
      s.onerror = function () { jsqrLoading = null; reject(new Error('jsqr')); };
      document.head.appendChild(s);
    });
    return jsqrLoading;
  }
  function scan() {
    var video = U.el('video.scan-video', { attrs: { playsinline: 'true', muted: 'true', autoplay: 'true' } });
    var status = U.el('p.scan-status', { text: 'Apunta al código QR' });
    var input = U.el('input.input', { attrs: { type: 'text', placeholder: 'O pega aquí el enlace o el código (WH-…)', 'aria-label': 'Enlace o código' } });
    var stream = null, timer = null, done = false, detector = null, canvas = document.createElement('canvas');
    var stop = function () { clearInterval(timer); if (stream) stream.getTracks().forEach(function (t) { t.stop(); }); stream = null; };
    var found = function (text) { if (done) return; done = true; stop(); W.Audio.success(); W.Audio.vibrate([20]); s.close(); setTimeout(function () { open(text); }, 250); };
    input.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); var v = input.value.trim(); if (v) found(v); } });
    var s = W.Sheet.open({ title: 'Escanear', className: 'scan-sheet', body: [U.el('div.scan-frame', [video, U.el('span.scan-target')]), status, U.el('div.group', [U.el('label.cell', [input])])],
      foot: [U.el('button.btn.primary', { text: 'Conectar', on: { click: function () { var v = input.value.trim(); if (v) found(v); else input.focus(); } } })],
      onClose: function () { done = true; stop(); } });
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { status.textContent = 'Este dispositivo no permite usar la cámara aquí. Pega el enlace o el código.'; return; }
    navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 } }, audio: false }).then(function (st) {
      if (done) { st.getTracks().forEach(function (t) { t.stop(); }); return; }
      stream = st; video.srcObject = st;
      var p = video.play(); if (p && p.catch) p.catch(function () {});
      var useNative = 'BarcodeDetector' in window ? window.BarcodeDetector.getSupportedFormats().then(function (f) { return f.indexOf('qr_code') >= 0; }).catch(function () { return false; }) : Promise.resolve(false);
      return useNative.then(function (native) {
        if (native) detector = new window.BarcodeDetector({ formats: ['qr_code'] });
        return native ? null : loadJsQR();
      }).then(function () {
        timer = setInterval(function () {
          if (done || video.readyState < 2) return;
          if (detector) { detector.detect(video).then(function (codes) { if (codes && codes[0] && codes[0].rawValue) found(codes[0].rawValue); }).catch(function () {}); return; }
          var w = video.videoWidth, h = video.videoHeight; if (!w || !h) return;
          var k = Math.min(1, 640 / Math.max(w, h)); canvas.width = Math.round(w * k); canvas.height = Math.round(h * k);
          var ctx = canvas.getContext('2d', { willReadFrequently: true }); ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          var img = ctx.getImageData(0, 0, canvas.width, canvas.height), res = window.jsQR(img.data, img.width, img.height, { inversionAttempts: 'dontInvert' });
          if (res && res.data) found(res.data);
        }, 260);
      });
    }).catch(function (e) {
      status.textContent = e && e.name === 'NotAllowedError' ? 'Permite el acceso a la cámara para escanear (o pega el enlace abajo).' : 'No se pudo abrir la cámara. Pega el enlace o el código abajo.';
    });
  }

  var Invite = {
    base: base, personLink: personLink, teamLink: teamLink, parse: parse, open: open, accept: accept,
    qrNode: qrNode, qrSheet: qrSheet, loadQR: loadQR, scan: scan, share: share, copy: copy, buddyCode: buddyCode, buddyFrom: buddyFrom,
    /** Al arrancar: invitación en la dirección (#i=… o ?c=…) */
    fromLocation: function () {
      var h = location.hash || '', q = location.search || '', inv = null;
      if (/^#i=/.test(h)) inv = parse(h);
      else if (/[?&](c|s)=/.test(q) && /[?&]k=/.test(q)) inv = parse(q.slice(1));
      if (!inv) return;
      savePending(inv);
      try { history.replaceState(null, '', location.pathname + '#home'); } catch (e) { /* sin historial */ }
    },
    /** La app ya está lista (y, si hay cuenta, ya entró): se abre lo que estaba esperando */
    ready: function () {
      appReady = true;
      var inv = queue || takePending(); queue = null;
      if (inv) setTimeout(function () { open(inv); }, 600);
    },
    retryPending: function () { var inv = takePending(); if (inv) setTimeout(function () { open(inv); }, 500); }
  };
  W.Invite = Invite;
  // Enlaces whider:// que llegan desde Android (antes de que la app esté lista se guardan)
  window.WhiderOpenLink = function (url) { open(url); };
})(window.Whider);
