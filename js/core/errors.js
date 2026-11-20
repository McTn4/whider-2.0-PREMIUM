// @ts-check
/**
 * WHIDER · Informes de errores (solo con permiso)
 *  - Cada error de la app se apunta en el propio dispositivo (los 20 últimos): qué falló, en qué archivo, la
 *    versión y el sistema. Se ven y se copian en Ajustes → Ayuda → Errores recientes.
 *  - Solo si activas «Enviar informes de errores» (Ajustes → Privacidad; apagado de serie) y tienes cuenta, se
 *    envían a la nube (colección «errors», que solo se lee desde la consola): como mucho 10 al día, sin
 *    repetir y sin tu nombre ni tu cuenta.
 * Nunca llevan tus tareas ni tu Cuaderno: los correos y los textos largos entre comillas se quitan.
 */
window.Whider = window.Whider || {};

(function (W) {
  'use strict';
  var KEY = 'whider.errors.v1', MAX = 20, PER_DAY = 10;
  /** @type {Record<string, boolean>} */
  var sent = {};
  // Ruido de los navegadores que no es un fallo de WHIDER
  var NOISE = /^Script error\.?$|ResizeObserver loop|Non-Error promise rejection captured|AbortError|The user aborted a request/i;

  function load() {
    try { return Object.assign({ on: false, list: [], day: '', n: 0 }, JSON.parse(localStorage.getItem(KEY) || 'null') || {}); } catch (e) { return { on: false, list: [], day: '', n: 0 }; }
  }
  function save(o) { try { localStorage.setItem(KEY, JSON.stringify(o)); } catch (e) { /* sin almacenamiento */ } }

  /** «Escritorio · Windows», «Android», «Navegador · Chrome 140 · macOS» */
  function platform() {
    var w = /** @type {any} */ (window);
    if (w.WhiderDesktop) return W.t('Escritorio') + ' · ' + ({ win32: 'Windows', darwin: 'macOS', linux: 'Linux' }[w.WhiderDesktop.platform] || w.WhiderDesktop.platform);
    if (w.WhiderAndroid) return 'Android';
    var ua = navigator.userAgent || '';
    var b = /Edg\/(\d+)/.exec(ua) ? 'Edge ' + /Edg\/(\d+)/.exec(ua)[1] : /Firefox\/(\d+)/.exec(ua) ? 'Firefox ' + /Firefox\/(\d+)/.exec(ua)[1]
      : /Chrome\/(\d+)/.exec(ua) ? 'Chrome ' + /Chrome\/(\d+)/.exec(ua)[1] : /Version\/(\d+).*Safari/.exec(ua) ? 'Safari ' + /Version\/(\d+).*Safari/.exec(ua)[1] : W.t('otro');
    var os = /iPhone|iPad/.test(ua) ? 'iOS' : /Android/.test(ua) ? 'Android' : /Windows/.test(ua) ? 'Windows' : /Mac OS X/.test(ua) ? 'macOS' : /Linux/.test(ua) ? 'Linux' : '';
    return W.t('Navegador') + ' · ' + b + (os ? ' · ' + os : '');
  }
  /** Quita lo que pueda ser personal: correos y textos largos entre comillas */
  function clean(s, max) {
    return String(s || '')
      .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, '«correo»')
      .replace(/(["'«])[^"'»\n]{24,}(["'»])/g, '$1…$2')
      .slice(0, max);
  }

  function signedIn() { var A = W.Auth; return !!(A && A.user && (!A.isVerified || A.isVerified())); }
  function send(e) {
    var o = load();
    if (!o.on || sent[e.sig] || !signedIn() || !W.Auth.sdk || !W.Auth.sdk()) return;
    var day = new Date().toISOString().slice(0, 10);
    if (o.day !== day) { o.day = day; o.n = 0; }
    if (o.n >= PER_DAY) return;
    o.n++;
    save(o);
    sent[e.sig] = true;
    var F = W.Auth.sdk(), db = W.Auth.db();
    F.setDoc(F.doc(db, 'errors', W.U.uid('e')), { msg: e.msg, stack: e.stack, where: e.where, v: String(e.v || ''), p: e.p, at: e.at })
      .catch(function () { delete sent[e.sig]; /* sin conexión: queda en el dispositivo */ });
  }

  /** Apunta un error (y lo envía si hay permiso) */
  function record(msg, stack, where) {
    msg = String(msg || '');
    if (!msg || NOISE.test(msg)) return;
    var o = load();
    var e = { msg: clean(msg, 300), stack: clean(stack, 1500), where: clean(where, 160), v: String(W.VERSION || ''), p: platform(), at: Date.now(), sig: '', count: 1 };
    e.sig = e.msg + '|' + (e.stack.split('\n')[1] || e.where);
    var same = o.list.filter(function (x) { return x.sig === e.sig; })[0];
    if (same) { same.count = (same.count || 1) + 1; same.at = e.at; save(o); send(same); return; }
    o.list.push(e);
    if (o.list.length > MAX) o.list = o.list.slice(-MAX);
    save(o);
    send(e);
  }

  /** «Otro fallo», «TypeError: x is undefined» (sin el «Uncaught» que añade el navegador) */
  function message(err, fallback) {
    if (err && err.message) return (err.name && err.name !== 'Error' ? err.name + ': ' : '') + err.message;
    return String(fallback || '').replace(/^Uncaught (\w*Error: )?/, function (_m, t) { return t && t !== 'Error: ' ? t : ''; });
  }
  window.addEventListener('error', function (ev) {
    record(message(ev.error, ev.message), ev.error && ev.error.stack, (ev.filename || '').replace(/^.*\//, '') + ':' + (ev.lineno || 0));
  });
  window.addEventListener('unhandledrejection', function (ev) {
    var r = ev.reason;
    record(message(r, typeof r === 'string' ? r : ''), r && r.stack, 'promesa');
  });

  /** Texto para copiar o adjuntar a un comentario */
  function report(n) {
    var list = load().list.slice(-(n || MAX)).reverse();
    return list.map(function (e) {
      return new Date(e.at).toISOString().replace('T', ' ').slice(0, 16) + ' · ' + e.v + ' · ' + e.p + (e.count > 1 ? ' · ×' + e.count : '') + '\n' + e.msg +
        (e.stack ? '\n' + e.stack.split('\n').slice(0, 6).join('\n') : e.where ? '\n' + e.where : '');
    }).join('\n\n');
  }

  W.Errors = {
    list: function () { return load().list.slice().reverse(); },
    clear: function () { var o = load(); o.list = []; save(o); },
    enabled: function () { return load().on; },
    setEnabled: function (on) { var o = load(); o.on = !!on; save(o); },
    record: record, report: report, platform: platform, clean: clean, message: message
  };
})(window.Whider);
