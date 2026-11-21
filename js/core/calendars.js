// @ts-check
/**
 * WHIDER · Calendarios suscritos: los eventos de otros calendarios (Google, Outlook, Apple, festivos…) dentro de
 * WHIDER, a partir de su enlace .ics. Se ven en el calendario y en Hoy, pero no se pueden cambiar desde aquí.
 *
 *  - La lista (nombre, enlace y si está encendido) va en los ajustes (settings.calendars), así que con cuenta la
 *    tienes en todos tus dispositivos. Los eventos se descargan en cada dispositivo y se guardan en él (whider.cal.v1)
 *    para verlos sin conexión; con la app abierta se vuelven a pedir cada hora.
 *  - Se descargan a través del servidor de WHIDER (api/calendario.js), que los reenvía sin guardarlos: los navegadores
 *    no dejan que una web lea un calendario de otro sitio.
 *  - between(desde, hasta): las apariciones de los calendarios encendidos (W.ICal.between) con calId y calName.
 */
window.Whider = window.Whider || {};

(function (W) {
  'use strict';
  var KEY = 'whider.cal.v1', HOUR = 3600000, DAY = 86400000, EVERY = HOUR, RETRY = 10 * 60000, MAX_CALS = 10, MAX_EVENTS = 2000;
  var U = W.U, S = function () { return W.State; };
  /** @type {Record<string, any>} */
  var cache = load();
  /** @type {Record<string, Promise<any>>} */
  var busy = {};
  var memo = { key: '', out: [] }, version = 0, started = false;

  function load() { try { return JSON.parse(localStorage.getItem(KEY) || 'null') || {}; } catch (e) { return {}; } }
  function persist() {
    try { localStorage.setItem(KEY, JSON.stringify(cache)); return; } catch (e) { /* lleno */ }
    // Sin sitio: se quedan los eventos más cercanos a hoy de cada calendario
    Object.keys(cache).forEach(function (id) { var c = cache[id]; if (c && c.events && c.events.length > 300) { c.events = nearest(c.events, 300); c.partial = true; } });
    try { localStorage.setItem(KEY, JSON.stringify(cache)); } catch (e2) { /* solo en memoria hasta la próxima vez */ }
  }

  /** Los n eventos más cercanos a hoy (los que se repiten, primero) */
  function nearest(events, n) {
    var now = Date.now();
    return events.slice().sort(function (a, b) {
      if (!!a.rrule !== !!b.rrule) return a.rrule ? -1 : 1;
      return Math.abs(a.ts - now) - Math.abs(b.ts - now);
    }).slice(0, n);
  }
  /** Lo que ya no puede salir (pasado hace más de medio año o dentro de más de dos) no se guarda */
  function prune(events) {
    var now = Date.now(), from = now - 183 * DAY, to = now + 2 * 365 * DAY;
    var keep = events.filter(function (e) {
      if (e.rrule) return !e.rrule.until || e.rrule.until >= from;
      var end = e.ts + (e.allDay ? e.days * DAY : e.durMs);
      return end >= from && e.ts <= to;
    }).map(function (e) {
      if (e.notes && e.notes.length > 600) e.notes = e.notes.slice(0, 600) + '…';
      return e;
    });
    return keep.length > MAX_EVENTS ? nearest(keep, MAX_EVENTS) : keep;
  }

  /* ---------------------------------------------------------------- Lista (en los ajustes) */
  function valid(c) { return !!c && typeof c.id === 'string' && typeof c.url === 'string' && /^https:\/\//.test(c.url) && c.url.length <= 2048; }
  /** Los calendarios suscritos: [{ id, url, name, on }] */
  function list() {
    var st = S(), raw = st && st.settings && Array.isArray(st.settings.calendars) ? st.settings.calendars : [];
    return raw.filter(valid).slice(0, MAX_CALS).map(function (c) {
      return { id: c.id, url: c.url, name: String(c.name || '').slice(0, 60), on: c.on !== false };
    });
  }
  function save(next, reason) {
    var st = S();
    st.settings.calendars = next.map(function (c) { return { id: c.id, url: c.url, name: c.name, on: c.on !== false }; });
    st.saveSettings(reason || 'settings-calendars');
    changed();
  }
  function get(id) { return list().filter(function (c) { return c.id === id; })[0] || null; }

  /**
   * Enlace que pega la persona → enlace .ics por https (o null). Arregla los despistes habituales: webcal://,
   * http://, el enlace para insertar de Google Calendar y el enlace HTML de Outlook.
   */
  function normalize(raw) {
    var s = String(raw || '').trim().replace(/^<|>$/g, '');
    if (!s || s.length > 2048) return null;
    s = s.replace(/^webcals?:\/\//i, 'https://').replace(/^http:\/\//i, 'https://');
    if (!/^https:\/\//i.test(s)) {
      if (/^[a-z0-9.-]+\.[a-z]{2,}\//i.test(s)) s = 'https://' + s; else return null;
    }
    var g = s.match(/^https:\/\/calendar\.google\.com\/calendar\/(?:u\/\d+\/)?embed\?(?:.*&)?src=([^&#]+)/i);
    if (g) s = 'https://calendar.google.com/calendar/ical/' + g[1] + '/public/basic.ics';
    s = s.replace(/^(https:\/\/outlook\.(?:office365|live)\.com\/owa\/calendar\/.+\/)calendar\.html$/i, '$1calendar.ics');
    try { var u = new URL(s); if (u.protocol !== 'https:' || u.username || u.password) return null; return u.href; } catch (e) { return null; }
  }

  /* ---------------------------------------------------------------- Descarga */
  function endpoint() {
    var CFG = /** @type {any} */ (window).WHIDER_CONFIG || {};
    var base = String((CFG.links && CFG.links.base) || 'https://whider-red.vercel.app').replace(/\/+$/, '');
    // En la web, la función está en el mismo sitio; las apps (Android, ordenador) la piden a la web publicada
    if (/^https?:$/.test(location.protocol) && location.hostname !== 'appassets.androidplatform.net') return '/api/calendario';
    return base + '/api/calendario';
  }
  /**
   * Descarga y lee un calendario: { ok, name, events } o { ok: false, error, upstream }
   * @returns {Promise<any>}
   */
  function download(url) {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return Promise.resolve({ ok: false, error: 'offline' });
    var ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var timer = setTimeout(function () { if (ctrl) ctrl.abort(); }, 25000);
    return fetch(endpoint(), {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: url }),
      cache: 'no-store', credentials: 'omit', signal: ctrl ? ctrl.signal : undefined
    }).then(function (res) {
      if (res.ok) return res.text().then(function (text) {
        var r = W.ICal.read(text);
        if (r.error) return { ok: false, error: 'format' };
        return { ok: true, name: r.name, events: r.events };
      });
      return res.json().then(function (j) { return { ok: false, error: j && j.error ? String(j.error) : 'unavailable', upstream: j && j.upstream }; },
        function () { return { ok: false, error: 'unavailable' }; });
    }, function () {
      return { ok: false, error: typeof navigator !== 'undefined' && navigator.onLine === false ? 'offline' : 'network' };
    }).then(function (r) { clearTimeout(timer); return r; });
  }

  /** Vuelve a pedir un calendario si toca (o si se fuerza). Devuelve su estado. */
  function refresh(id, force) {
    var c = get(id);
    if (!c) return Promise.resolve(null);
    var cur = cache[id];
    // Al día: cada hora; tras un fallo, a los 10 minutos (sin conexión, en cuanto vuelva la red)
    var wait = cur && cur.ok === false ? RETRY : EVERY;
    if (!force && cur && Date.now() - (cur.tried || cur.at || 0) < wait) return Promise.resolve(status(id));
    if (busy[id]) return busy[id];
    busy[id] = download(c.url).then(function (r) {
      delete busy[id];
      var prev = cache[id] || {};
      if (!get(id)) return null; // lo han quitado mientras se descargaba
      if (r.ok) {
        var events = prune(r.events || []);
        var sig = events.length + ':' + JSON.stringify(events).length;
        cache[id] = { at: Date.now(), tried: Date.now(), ok: true, name: r.name || '', events: events, sig: sig, partial: false };
        persist();
        if (sig !== prev.sig) changed();
      } else {
        // Un fallo no borra lo que ya había: se sigue viendo lo último que llegó
        cache[id] = Object.assign({}, prev, { tried: r.error === 'offline' ? prev.tried || 0 : Date.now(), ok: false, error: r.error, upstream: r.upstream || null, events: prev.events || [] });
        persist();
        if (prev.ok !== false || prev.error !== r.error) changed();
      }
      return status(id);
    });
    return busy[id];
  }
  /** Todos los encendidos, de uno en uno (sin prisa) */
  function refreshAll(force) {
    var ids = list().filter(function (c) { return c.on; }).map(function (c) { return c.id; });
    return ids.reduce(function (p, id) { return p.then(function () { return refresh(id, force); }); }, Promise.resolve(null));
  }

  /* ---------------------------------------------------------------- Altas y cambios */
  /** Comprueba un enlace antes de añadirlo: { ok, url, name, count } o { ok: false, error } */
  function test(raw) {
    var url = normalize(raw);
    if (!url) return Promise.resolve({ ok: false, error: 'url' });
    if (list().some(function (c) { return c.url === url; })) return Promise.resolve({ ok: false, error: 'dup' });
    if (list().length >= MAX_CALS) return Promise.resolve({ ok: false, error: 'max' });
    return download(url).then(function (r) { return r.ok ? { ok: true, url: url, name: r.name, events: r.events, count: r.events.length } : r; });
  }
  /** Añade un calendario ya comprobado (con lo que trajo test) */
  function add(checked, name) {
    var id = 'cal_' + U.uid();
    var events = prune(checked.events || []);
    cache[id] = { at: Date.now(), tried: Date.now(), ok: true, name: checked.name || '', events: events, sig: events.length + ':' + JSON.stringify(events).length };
    persist();
    save(list().concat([{ id: id, url: checked.url, name: String(name || checked.name || '').trim().slice(0, 60) || hostName(checked.url), on: true }]));
    return id;
  }
  function update(id, patch) {
    save(list().map(function (c) { return c.id === id ? Object.assign({}, c, patch) : c; }));
    if (patch.on) refresh(id, false);
  }
  function remove(id) {
    delete cache[id]; persist();
    save(list().filter(function (c) { return c.id !== id; }));
  }
  function hostName(url) { try { return new URL(url).hostname.replace(/^www\./, '').slice(0, 60); } catch (e) { return W.t('Calendario'); } }

  /* ---------------------------------------------------------------- Lectura */
  /** Estado de un calendario para Ajustes: { at, ok, error, upstream, count, partial } */
  function status(id) {
    var c = cache[id];
    if (!c) return { at: 0, ok: null, error: null, count: 0 };
    return { at: c.at || 0, ok: c.ok, error: c.error || null, upstream: c.upstream || null, count: (c.events || []).length, partial: !!c.partial };
  }
  /** Apariciones de los calendarios encendidos entre dos fechas (AAAA-MM-DD, incluidas) */
  function between(from, to) {
    var key = version + '|' + from + '|' + to;
    if (memo.key === key) return memo.out;
    var out = [];
    list().forEach(function (c) {
      var ca = cache[c.id];
      if (!c.on || !ca || !ca.events || !ca.events.length) return;
      W.ICal.between(ca.events, from, to).forEach(function (x) { x.calId = c.id; x.calName = c.name; out.push(x); });
    });
    out.sort(function (a, b) {
      if (a.date !== b.date) return a.date < b.date ? -1 : 1;
      if (a.allDay !== b.allDay) return a.allDay ? -1 : 1;
      return (a.time || '') < (b.time || '') ? -1 : (a.time || '') > (b.time || '') ? 1 : 0;
    });
    memo = { key: key, out: out };
    return out;
  }
  /** { fecha: [apariciones] } para un intervalo (lo usan las vistas del calendario) */
  function byDate(from, to) {
    /** @type {Record<string, any[]>} */
    var m = {};
    between(from, to).forEach(function (x) { (m[x.date] = m[x.date] || []).push(x); });
    return m;
  }
  function any() { return list().some(function (c) { return c.on; }); }

  /** Algo cambió (lista o eventos): se olvida lo calculado y se vuelve a pintar */
  function changed() {
    version++;
    memo = { key: '', out: [] };
    if (started && W.Router) W.Router.refresh();
  }

  /** Al abrir la app: lo que toque actualizar, sin prisa; y cada hora mientras siga abierta */
  function init() {
    if (started) return;
    started = true;
    // Calendarios que ya no están en la lista (quitados en otro dispositivo): fuera de la caché
    var ids = list().map(function (c) { return c.id; });
    Object.keys(cache).forEach(function (id) { if (ids.indexOf(id) < 0) delete cache[id]; });
    setTimeout(function () { refreshAll(false); }, 4000);
    setInterval(function () { if (!document.hidden) refreshAll(false); }, 15 * 60000);
    document.addEventListener('visibilitychange', function () { if (!document.hidden) refreshAll(false); });
    window.addEventListener('online', function () { refreshAll(false); });
    // Un calendario añadido en otro dispositivo llega con los ajustes: se descarga aquí
    S().subscribe(function (reason) {
      if (reason !== 'sync' && !/^settings/.test(reason)) return;
      var now = list();
      Object.keys(cache).forEach(function (id) { if (!now.some(function (c) { return c.id === id; })) { delete cache[id]; persist(); } });
      now.forEach(function (c) { if (c.on && !cache[c.id]) refresh(c.id, true); });
      version++; memo = { key: '', out: [] };
    });
  }

  W.Calendars = {
    MAX: MAX_CALS, list: list, get: get, normalize: normalize, test: test, add: add, update: update, remove: remove,
    refresh: refresh, refreshAll: refreshAll, status: status, between: between, byDate: byDate, any: any, init: init, endpoint: endpoint
  };
})(window.Whider);
