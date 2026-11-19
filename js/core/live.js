// @ts-check
/**
 * WHIDER · Escuchas en tiempo real (Firestore completo, solo para escuchar)
 *
 * Lo que cambia en la nube llega en cuanto pasa, en lugar de consultarla cada pocos segundos: tus datos y tus
 * apuntes (Sync), los índices del Cuaderno, tuyo y de cada equipo (PageSync), el buzón de Personas (People) y
 * los chats, la lista y el que tienes abierto (Chat).
 *
 *  - Solo se escucha. Leer una vez, escribir y las transacciones siguen con Firestore «lite» (Auth.db()):
 *    sin caché propia, así que sin conexión fallan enseguida y la app lo explica.
 *  - Cada escucha dice si está al día con el servidor (ok). Mientras no lo está —sin conexión, con un fallo o
 *    sin el SDK de escuchas (WHIDER_CONFIG.live = false)—, cada módulo vuelve a consultar como antes.
 *  - Lo que llega de la caché sin conexión no se entrega: un documento «que no existe» porque no hay red no
 *    borra nada aquí.
 *  - Con la app en segundo plano más de 2 minutos se dejan de escuchar (no se gastan lecturas con lo que
 *    cambian otros dispositivos) y se retoman al volver: la primera respuesta ya trae lo último.
 *  - Lecturas: al empezar a escuchar, una por documento; después, una por cada documento que cambia.
 */
window.Whider = window.Whider || {};

(function (W) {
  'use strict';
  // En segundo plano se deja de escuchar a los 2 min; al (re)conectar se espera hasta 10 s antes de volver a consultar
  var HIDDEN_AFTER = 120000, GRACE = 10000;
  /** @type {Record<string, any>} */
  var watches = {};
  var hideT = null;

  function sdk() { return W.Auth && W.Auth.sdk ? W.Auth.sdk() : null; }
  function db() { return W.Auth && W.Auth.liveDb ? W.Auth.liveDb() : null; }
  function backoff(n) { return Math.min(300000, 5000 * Math.pow(2, Math.max(0, n))); }

  function setLive(w, on) {
    if (w.live === on) return;
    w.live = on;
    if (w.opts.onState) { try { w.opts.onState(on); } catch (e) { console.error(e); } }
  }
  function detach(w) {
    clearTimeout(w.retryT); w.retryT = null;
    if (w.un) { try { w.un(); } catch (e) { /* ya parada */ } }
    w.un = null;
  }
  function attach(w) {
    var L = sdk(), d = db();
    if (!L || !d) return;
    var target;
    try { target = w.target(L, d); } catch (e) { fail(w, e); return; }
    w.since = Date.now(); w.failed = false; w.paused = false;
    try {
      w.un = L.onSnapshot(target, { includeMetadataChanges: true }, function (snap) {
        if (watches[w.key] !== w || w.paused) return;
        // Sin conexión, Firestore responde con lo que tiene en memoria: no cuenta como dato de la nube
        var server = !snap.metadata.fromCache;
        setLive(w, server);
        if (!server) return;
        w.n = 0; w.at = Date.now(); w.events++;
        try { w.onData(snap); } catch (e) { console.error(e); }
      }, function (e) { fail(w, e); });
    } catch (e) { fail(w, e); }
  }
  function fail(w, e) {
    if (watches[w.key] !== w) return;
    var code = String((e && e.code) || '').replace(/^firestore\//, '');
    console.warn('Escucha ' + w.key + ':', code || (e && e.message) || e);
    w.un = null; w.failed = true; w.error = code || 'error';
    setLive(w, false);
    if (w.opts.onError) { try { w.opts.onError(e); } catch (x) { console.error(x); } }
    // Sin permiso no tiene sentido insistir (el módulo vuelve a consultar y explica el fallo); lo demás, más tarde
    if (code === 'permission-denied' || code === 'unauthenticated') return;
    var wait = backoff(w.n++);
    w.retryT = setTimeout(function () { w.retryT = null; if (watches[w.key] === w && !w.paused) attach(w); }, wait);
  }

  var Live = {
    HIDDEN_AFTER: HIDDEN_AFTER,
    /** ¿Se puede escuchar? (Firebase cargado con su SDK completo) */
    available: function () { return !!db(); },
    /**
     * Escucha un documento o una consulta. key: nombre de la escucha (otra con la misma clave sustituye a esta).
     * target(L, db): la referencia o consulta, hecha con las funciones «Live» del SDK (L.docLive, L.queryLive…).
     * onData(snap): solo con datos del servidor (al empezar, con cada cambio y al recuperar la conexión).
     * opts: { onState(live), onError(e) }. Devuelve false si no se puede escuchar.
     */
    watch: function (key, target, onData, opts) {
      Live.stop(key);
      if (!db()) return false;
      var w = { key: key, target: target, onData: onData, opts: opts || {}, un: null, live: false, failed: false, paused: false, error: '', since: Date.now(), at: 0, n: 0, events: 0, retryT: null };
      watches[key] = w;
      if (document.hidden && hideT === null) w.paused = true; // ya en segundo plano: empieza al volver
      else attach(w);
      return true;
    },
    stop: function (key) {
      var w = watches[key];
      if (!w) return;
      delete watches[key];
      detach(w);
    },
    stopAll: function () { Object.keys(watches).forEach(Live.stop); },
    /** ¿Está al día con el servidor (o acaba de empezar y aún tiene unos segundos para estarlo)? */
    ok: function (key) {
      var w = watches[key];
      return !!w && !w.paused && !w.failed && (w.live || Date.now() - w.since < GRACE);
    },
    /** ¿Se dejó de escuchar porque la nube no da permiso? (p. ej., un equipo del que ya no formas parte) */
    denied: function (key) { var w = watches[key]; return !!w && w.failed && (w.error === 'permission-denied' || w.error === 'unauthenticated'); },
    /** ¿Existe esa escucha (aunque esté en pausa o reintentando)? */
    has: function (key) { return !!watches[key]; },
    /** Estado de cada escucha (lo usan las pruebas y el diagnóstico) */
    state: function () {
      var out = {};
      Object.keys(watches).forEach(function (k) { var w = watches[k]; out[k] = { live: w.live, paused: w.paused, failed: w.failed, error: w.error, events: w.events, at: w.at }; });
      return out;
    },
    /** En segundo plano: se deja de escuchar (lo usa también la prueba, sin esperar los 2 minutos) */
    pause: function () {
      clearTimeout(hideT); hideT = null;
      Object.keys(watches).forEach(function (k) { var w = watches[k]; if (w.paused) return; detach(w); w.paused = true; setLive(w, false); });
    },
    resume: function () {
      clearTimeout(hideT); hideT = null;
      Object.keys(watches).forEach(function (k) { if (watches[k].paused) attach(watches[k]); });
    }
  };

  // Debe cargarse antes que sync.js, pagesync.js, community.js y chat.js: así, al volver a la app, las escuchas
  // se retoman antes de que esos módulos decidan si hace falta consultar la nube
  document.addEventListener('visibilitychange', function () {
    clearTimeout(hideT); hideT = null;
    if (document.hidden) hideT = setTimeout(Live.pause, HIDDEN_AFTER);
    else Live.resume();
  });
  // Al cerrar sesión no queda nada escuchando
  if (W.Auth && W.Auth.onChange) W.Auth.onChange(function (u) { if (!u) Live.stopAll(); });
  W.Live = Live;
})(window.Whider);
