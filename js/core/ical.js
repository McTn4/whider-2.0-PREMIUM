// @ts-check
/**
 * WHIDER · Calendarios .ics (iCalendar, RFC 5545) para los calendarios suscritos (js/core/calendars.js)
 *
 *  - W.ICal.read(texto): los eventos (VEVENT) de un calendario: título, inicio y fin, todo el día, lugar, notas,
 *    repetición (RRULE), fechas quitadas (EXDATE) y cambios de una sola repetición (RECURRENCE-ID). Lo cancelado no
 *    se cuenta. Las horas se guardan en la zona del propio evento para repetirlas bien con los cambios de hora.
 *  - W.ICal.between(eventos, desde, hasta): cada aparición entre dos fechas (AAAA-MM-DD, las dos incluidas), con su
 *    fecha y hora en este dispositivo.
 *
 * Lógica pura, sin DOM: tests/unit/ical.test.js. Lo que no entiende (repeticiones por horas, zonas desconocidas) lo
 * trata con prudencia: una sola vez, o en la hora de este dispositivo.
 */
window.Whider = window.Whider || {};

(function (W) {
  'use strict';
  var DAY = 86400000;
  var MAX_EVENTS = 3000, MAX_TEXT = 1000, MAX_PER_EVENT = 400;
  var WD = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 };

  /**
   * Zonas de Windows (Outlook, Exchange) → zona IANA, que es lo que entiende Intl. Las más habituales; con las demás,
   * la hora de este dispositivo.
   * @type {Record<string, string>}
   */
  var WINDOWS_TZ = {
    'Romance Standard Time': 'Europe/Paris', 'W. Europe Standard Time': 'Europe/Berlin', 'Central Europe Standard Time': 'Europe/Budapest',
    'Central European Standard Time': 'Europe/Warsaw', 'GMT Standard Time': 'Europe/London', 'Greenwich Standard Time': 'Atlantic/Reykjavik',
    'E. Europe Standard Time': 'Europe/Chisinau', 'FLE Standard Time': 'Europe/Kiev', 'GTB Standard Time': 'Europe/Bucharest',
    'Russian Standard Time': 'Europe/Moscow', 'Turkey Standard Time': 'Europe/Istanbul', 'Azores Standard Time': 'Atlantic/Azores',
    'Morocco Standard Time': 'Africa/Casablanca', 'W. Central Africa Standard Time': 'Africa/Lagos', 'South Africa Standard Time': 'Africa/Johannesburg',
    'Egypt Standard Time': 'Africa/Cairo', 'Israel Standard Time': 'Asia/Jerusalem', 'Arabian Standard Time': 'Asia/Dubai',
    'Pakistan Standard Time': 'Asia/Karachi', 'India Standard Time': 'Asia/Kolkata', 'SE Asia Standard Time': 'Asia/Bangkok',
    'China Standard Time': 'Asia/Shanghai', 'Taipei Standard Time': 'Asia/Taipei', 'Singapore Standard Time': 'Asia/Singapore',
    'Tokyo Standard Time': 'Asia/Tokyo', 'Korea Standard Time': 'Asia/Seoul', 'AUS Eastern Standard Time': 'Australia/Sydney',
    'E. Australia Standard Time': 'Australia/Brisbane', 'Cen. Australia Standard Time': 'Australia/Adelaide', 'W. Australia Standard Time': 'Australia/Perth',
    'New Zealand Standard Time': 'Pacific/Auckland', 'Eastern Standard Time': 'America/New_York', 'Central Standard Time': 'America/Chicago',
    'Mountain Standard Time': 'America/Denver', 'US Mountain Standard Time': 'America/Phoenix', 'Pacific Standard Time': 'America/Los_Angeles',
    'Alaskan Standard Time': 'America/Anchorage', 'Hawaiian Standard Time': 'Pacific/Honolulu', 'Atlantic Standard Time': 'America/Halifax',
    'Newfoundland Standard Time': 'America/St_Johns', 'Canada Central Standard Time': 'America/Regina', 'Central America Standard Time': 'America/Guatemala',
    'Central Standard Time (Mexico)': 'America/Mexico_City', 'Eastern Standard Time (Mexico)': 'America/Cancun', 'Pacific Standard Time (Mexico)': 'America/Tijuana',
    'Mountain Standard Time (Mexico)': 'America/Mazatlan', 'Cuba Standard Time': 'America/Havana', 'SA Pacific Standard Time': 'America/Bogota',
    'SA Western Standard Time': 'America/La_Paz', 'Venezuela Standard Time': 'America/Caracas', 'SA Eastern Standard Time': 'America/Cayenne',
    'E. South America Standard Time': 'America/Sao_Paulo', 'Argentina Standard Time': 'America/Argentina/Buenos_Aires', 'Pacific SA Standard Time': 'America/Santiago',
    'Montevideo Standard Time': 'America/Montevideo', 'Paraguay Standard Time': 'America/Asuncion', 'Cape Verde Standard Time': 'Atlantic/Cape_Verde',
    'UTC': 'UTC', 'Coordinated Universal Time': 'UTC'
  };

  function pad(n) { return (n < 10 ? '0' : '') + n; }
  /** @param {Date} d */
  function ymd(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  /** @param {Date} d */
  function hm(d) { return pad(d.getHours()) + ':' + pad(d.getMinutes()); }
  /** Días desde 1970 de una fecha civil (sin zona): sirve para contar días y semanas sin cambios de hora */
  function dayNum(y, m, d) { return Math.floor(Date.UTC(y, m, d) / DAY); }
  /** @param {number} n */
  function fromDayNum(n) { var d = new Date(n * DAY); return { y: d.getUTCFullYear(), m: d.getUTCMonth(), d: d.getUTCDate() }; }
  /** @param {string} s AAAA-MM-DD */
  function dayOf(s) { var p = s.split('-'); return dayNum(+p[0], +p[1] - 1, +p[2]); }
  function daysIn(y, m) { return new Date(Date.UTC(y, m + 1, 0)).getUTCDate(); }

  /** Zona IANA que entiende este sistema (o null): Windows, prefijos antiguos de Thunderbird («/mozilla.org/…/Europe/Madrid») */
  /** @type {Record<string, string|null>} */
  var tzCache = {};
  function zone(raw) {
    var s = String(raw || '').replace(/^"|"$/g, '').trim();
    if (!s) return null;
    if (Object.prototype.hasOwnProperty.call(tzCache, s)) return tzCache[s];
    var cands = [WINDOWS_TZ[s], s, (s.match(/([A-Za-z_]+\/[A-Za-z_]+(?:\/[A-Za-z_]+)?)$/) || [])[1]];
    var ok = null;
    for (var i = 0; i < cands.length && !ok; i++) {
      if (!cands[i]) continue;
      try { new Intl.DateTimeFormat('en-US', { timeZone: cands[i] }); ok = cands[i]; } catch (e) { /* no la conoce */ }
    }
    tzCache[s] = ok;
    return ok;
  }
  /** Desfase (ms) de una zona en un momento dado; null si falla */
  function tzOffset(ts, tz) {
    try {
      /** @type {Record<string, string>} */
      var p = {};
      new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })
        .formatToParts(new Date(ts)).forEach(function (x) { p[x.type] = x.value; });
      return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute, +p.second) - ts;
    } catch (e) { return null; }
  }
  /**
   * Momento (ms) de una hora de reloj en una zona: 'UTC', una zona IANA o null (la de este dispositivo).
   * Se ajusta dos veces para acertar también cerca de los cambios de hora.
   */
  function instant(y, m, d, h, mi, tz) {
    if (tz === 'UTC') return Date.UTC(y, m, d, h, mi);
    if (!tz) return new Date(y, m, d, h, mi).getTime();
    var guess = Date.UTC(y, m, d, h, mi), off = tzOffset(guess, tz);
    if (off === null) return new Date(y, m, d, h, mi).getTime();
    var ts = guess - off, off2 = tzOffset(ts, tz);
    return off2 !== null && off2 !== off ? guess - off2 : ts;
  }

  /**
   * Valor de fecha de iCalendar → { allDay, y, m, d, h, mi, tz, ts }. tz es la zona en que está escrita la hora
   * ('UTC', una IANA o null si es «flotante» y va en la hora de este dispositivo).
   */
  function when(params, value, defTz) {
    var mt = String(value || '').trim().match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?/);
    if (!mt) return null;
    var y = +mt[1], m = +mt[2] - 1, d = +mt[3];
    if (m < 0 || m > 11 || d < 1 || d > 31) return null;
    if (!mt[4] || /VALUE=DATE(?!-)/i.test(String(params && params.VALUE ? 'VALUE=' + params.VALUE : ''))) {
      return { allDay: true, y: y, m: m, d: d, h: 0, mi: 0, tz: null, ts: new Date(y, m, d).getTime() };
    }
    var h = Math.min(23, +mt[4]), mi = Math.min(59, +mt[5]);
    var tz = mt[7] ? 'UTC' : zone(params && params.TZID) || (params && params.TZID ? null : defTz || null);
    return { allDay: false, y: y, m: m, d: d, h: h, mi: mi, tz: tz, ts: instant(y, m, d, h, mi, tz) };
  }

  /** Duración de iCalendar (P1DT2H30M, PT45M, P1W) → milisegundos (0 si no se entiende o es negativa) */
  function duration(v) {
    var mt = String(v || '').trim().match(/^\+?P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/i);
    if (!mt) return 0;
    return ((+mt[1] || 0) * 7 * DAY) + ((+mt[2] || 0) * DAY) + ((+mt[3] || 0) * 3600000) + ((+mt[4] || 0) * 60000) + ((+mt[5] || 0) * 1000);
  }

  /** Texto de iCalendar sin escapes (\n, \, \; \\) */
  function text(v, max) {
    var s = String(v || '').replace(/\\n/gi, '\n').replace(/\\([,;\\])/g, '$1').replace(/\r/g, '').trim();
    return s.length > (max || MAX_TEXT) ? s.slice(0, max || MAX_TEXT) + '…' : s;
  }
  /** Notas sin etiquetas HTML (Google y Outlook a veces las escriben con <br> o <b>): siempre se enseñan como texto */
  function plain(s) {
    if (!/[<&]/.test(s)) return s;
    return s.replace(/<br\s*\/?>/gi, '\n').replace(/<\/(p|div|li)>/gi, '\n').replace(/<[^>]{0,400}>/g, '')
      .replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&')
      .replace(/\n{3,}/g, '\n\n').trim();
  }

  /** Una línea → { name, params, value } (los dos puntos dentro de comillas no cuentan) */
  function line(raw) {
    var q = false, cut = -1;
    for (var i = 0; i < raw.length; i++) {
      var c = raw.charAt(i);
      if (c === '"') q = !q;
      else if (c === ':' && !q) { cut = i; break; }
    }
    if (cut < 0) return null;
    var left = raw.slice(0, cut), parts = [], cur = '', inq = false;
    for (var j = 0; j < left.length; j++) {
      var ch = left.charAt(j);
      if (ch === '"') inq = !inq;
      if (ch === ';' && !inq) { parts.push(cur); cur = ''; } else cur += ch;
    }
    parts.push(cur);
    /** @type {Record<string, string>} */
    var params = {};
    parts.slice(1).forEach(function (p) {
      var k = p.indexOf('=');
      if (k > 0) params[p.slice(0, k).toUpperCase()] = p.slice(k + 1).replace(/^"|"$/g, '');
    });
    return { name: parts[0].toUpperCase(), params: params, value: raw.slice(cut + 1) };
  }

  /** RRULE → objeto (o null si no se puede repetir aquí: por horas o minutos) */
  function rule(v, defTz) {
    /** @type {Record<string, string>} */
    var r = {};
    String(v || '').split(';').forEach(function (p) { var k = p.indexOf('='); if (k > 0) r[p.slice(0, k).toUpperCase()] = p.slice(k + 1).toUpperCase(); });
    if (!/^(DAILY|WEEKLY|MONTHLY|YEARLY)$/.test(r.FREQ || '')) return null;
    var byday = (r.BYDAY || '').split(',').filter(Boolean).map(function (x) {
      var mt = x.match(/^([+-]?\d{1,2})?(SU|MO|TU|WE|TH|FR|SA)$/);
      return mt ? { n: mt[1] ? +mt[1] : 0, wd: WD[mt[2]] } : null;
    }).filter(Boolean);
    var nums = function (s, lo, hi) { return String(s || '').split(',').map(Number).filter(function (n) { return n && n >= lo && n <= hi; }); };
    var until = r.UNTIL ? when({}, r.UNTIL, defTz) : null;
    return {
      freq: r.FREQ, interval: Math.max(1, Math.min(1000, +r.INTERVAL || 1)), count: r.COUNT ? Math.max(1, Math.min(5000, +r.COUNT || 1)) : 0,
      until: until ? (until.allDay ? new Date(until.y, until.m, until.d, 23, 59, 59).getTime() : until.ts) : 0,
      byday: byday, bymonthday: nums(r.BYMONTHDAY, -31, 31), bymonth: nums(r.BYMONTH, 1, 12), bysetpos: nums(r.BYSETPOS, -366, 366),
      wkst: WD[r.WKST] !== undefined ? WD[r.WKST] : 1
    };
  }

  /**
   * Lee un calendario. Devuelve { name, events, warnings } o { error: 'format' } si no es un .ics.
   * Cada evento: { uid, title, location, notes, allDay, y, m, d, h, mi, tz, ts, durMs, days, rrule, exTs, exDays, override }.
   */
  function read(src) {
    var raw = String(src || '').replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').replace(/\n[ \t]/g, '');
    if (!/^\s*BEGIN:VCALENDAR/i.test(raw)) return { error: 'format', name: '', events: [], warnings: [] };
    var lines = raw.split('\n'), stack = [], cur = null, name = '', defTz = null, events = [], skipped = 0;
    for (var i = 0; i < lines.length; i++) {
      var ln = line(lines[i]);
      if (!ln) continue;
      if (ln.name === 'BEGIN') {
        var comp = ln.value.trim().toUpperCase();
        stack.push(comp);
        if (comp === 'VEVENT' && stack.length === 2) cur = { props: {}, multi: { EXDATE: [] } };
        continue;
      }
      if (ln.name === 'END') {
        var done = stack.pop();
        if (done === 'VEVENT' && cur && stack.length === 1) {
          var ev = build(cur, defTz);
          if (ev) { if (events.length < MAX_EVENTS) events.push(ev); else skipped++; }
          cur = null;
        }
        continue;
      }
      if (stack.length === 1) {
        if (ln.name === 'X-WR-CALNAME' && !name) name = text(ln.value, 60);
        else if (ln.name === 'X-WR-TIMEZONE' && !defTz) defTz = zone(ln.value);
      } else if (cur && stack.length === 2 && stack[1] === 'VEVENT') {
        if (ln.name === 'EXDATE') cur.multi.EXDATE.push(ln);
        else if (!cur.props[ln.name]) cur.props[ln.name] = ln;
      }
    }
    return { name: name, events: events, warnings: skipped ? ['many'] : [] };
  }

  /** Un VEVENT ya leído → evento (o null si no tiene inicio o está cancelado y no es el cambio de una repetición) */
  function build(c, defTz) {
    var P = c.props, st = P.DTSTART ? when(P.DTSTART.params, P.DTSTART.value, defTz) : null;
    if (!st) return null;
    var rid = P['RECURRENCE-ID'] ? when(P['RECURRENCE-ID'].params, P['RECURRENCE-ID'].value, defTz) : null;
    var cancelled = /CANCELLED/i.test(P.STATUS ? P.STATUS.value : '');
    if (cancelled && !rid) return null;
    var en = P.DTEND ? when(P.DTEND.params, P.DTEND.value, defTz) : null;
    var durMs = 0, days = 1;
    if (st.allDay) {
      if (en && en.allDay) days = Math.max(1, Math.min(366, dayNum(en.y, en.m, en.d) - dayNum(st.y, st.m, st.d)));
      else if (P.DURATION) days = Math.max(1, Math.min(366, Math.round(duration(P.DURATION.value) / DAY)));
    } else if (en && !en.allDay && en.ts > st.ts) durMs = Math.min(en.ts - st.ts, 14 * DAY);
    else if (P.DURATION) durMs = Math.min(duration(P.DURATION.value), 14 * DAY);
    var exTs = [], exDays = [];
    c.multi.EXDATE.forEach(function (ln) {
      ln.value.split(',').forEach(function (v) {
        var x = when(ln.params, v, defTz);
        if (!x) return;
        if (x.allDay) exDays.push(dayNum(x.y, x.m, x.d)); else exTs.push(Math.floor(x.ts / 60000));
      });
    });
    return {
      uid: text(P.UID ? P.UID.value : '', 300) || 'sin-uid-' + st.ts + '-' + text(P.SUMMARY ? P.SUMMARY.value : '', 40),
      title: text(P.SUMMARY ? P.SUMMARY.value : '', 200), location: text(P.LOCATION ? P.LOCATION.value : '', 200),
      notes: plain(text(P.DESCRIPTION ? P.DESCRIPTION.value : '', MAX_TEXT)),
      allDay: st.allDay, y: st.y, m: st.m, d: st.d, h: st.h, mi: st.mi, tz: st.tz, ts: st.ts, durMs: durMs, days: days,
      rrule: P.RRULE && !rid ? rule(P.RRULE.value, defTz) : null, exTs: exTs, exDays: exDays,
      // Cambio (o anulación) de una sola repetición: la fecha original que sustituye
      override: rid ? { allDay: rid.allDay, day: dayNum(rid.y, rid.m, rid.d), min: Math.floor(rid.ts / 60000) } : null,
      cancelled: cancelled
    };
  }

  /* ---------------------------------------------------------------- Repeticiones */
  /** Las fechas (días desde 1970) de un periodo que cumplen la regla, en orden */
  function candidates(ev, r, y, m, weekStartDay) {
    var out = [];
    if (r.freq === 'DAILY') {
      var dd = fromDayNum(weekStartDay);
      if ((!r.bymonth.length || r.bymonth.indexOf(dd.m + 1) >= 0) && (!r.byday.length || r.byday.some(function (b) { return b.wd === new Date(weekStartDay * DAY).getUTCDay(); }))
        && (!r.bymonthday.length || r.bymonthday.some(function (n) { return n > 0 ? n === dd.d : daysIn(dd.y, dd.m) + n + 1 === dd.d; }))) out.push(weekStartDay);
      return out;
    }
    if (r.freq === 'WEEKLY') {
      var wds = r.byday.length ? r.byday.map(function (b) { return b.wd; }) : [new Date(dayNum(ev.y, ev.m, ev.d) * DAY).getUTCDay()];
      for (var k = 0; k < 7; k++) {
        var n = weekStartDay + k, wd = new Date(n * DAY).getUTCDay();
        if (wds.indexOf(wd) >= 0 && (!r.bymonth.length || r.bymonth.indexOf(fromDayNum(n).m + 1) >= 0)) out.push(n);
      }
      return out;
    }
    // Mensual y anual: los días de cada mes que toque
    var months = r.freq === 'MONTHLY' ? [m] : r.bymonth.length ? r.bymonth.map(function (x) { return x - 1; }) : [ev.m];
    months.forEach(function (mm) {
      if (r.freq === 'MONTHLY' && r.bymonth.length && r.bymonth.indexOf(mm + 1) < 0) return;
      var dim = daysIn(y, mm), set = [];
      if (r.byday.length) {
        r.byday.forEach(function (b) {
          var all = [];
          for (var d = 1; d <= dim; d++) if (new Date(Date.UTC(y, mm, d)).getUTCDay() === b.wd) all.push(d);
          if (!b.n) set = set.concat(all);
          else { var pick = b.n > 0 ? all[b.n - 1] : all[all.length + b.n]; if (pick) set.push(pick); }
        });
        if (r.bymonthday.length) set = set.filter(function (d) { return r.bymonthday.some(function (n) { return n > 0 ? n === d : dim + n + 1 === d; }); });
      } else if (r.bymonthday.length) {
        r.bymonthday.forEach(function (n) { var d = n > 0 ? n : dim + n + 1; if (d >= 1 && d <= dim) set.push(d); });
      } else if (ev.d <= dim) set.push(ev.d);
      set.sort(function (a, b) { return a - b; }).forEach(function (d) { if (out.indexOf(dayNum(y, mm, d)) < 0) out.push(dayNum(y, mm, d)); });
    });
    out.sort(function (a, b) { return a - b; });
    if (r.bysetpos.length && out.length) {
      var picked = [];
      r.bysetpos.forEach(function (p) { var x = p > 0 ? out[p - 1] : out[out.length + p]; if (x !== undefined && picked.indexOf(x) < 0) picked.push(x); });
      out = picked.sort(function (a, b) { return a - b; });
    }
    return out;
  }

  /**
   * Días (desde 1970, en el calendario del propio evento) en que aparece un evento que se repite, hasta `toDay`.
   * Sin COUNT, empieza cerca de `fromDay` en lugar de recorrer años de repeticiones.
   */
  function occurrenceDays(ev, fromDay, toDay) {
    var r = ev.rrule, startDay = dayNum(ev.y, ev.m, ev.d), out = [], count = 0;
    var p = 0;
    // Saltar periodos enteros antes del intervalo pedido (solo sin COUNT: con COUNT hay que contarlos)
    if (!r.count && fromDay > startDay) {
      var gap = r.freq === 'DAILY' ? fromDay - startDay : r.freq === 'WEEKLY' ? Math.floor((fromDay - startDay) / 7) - 1
        : r.freq === 'MONTHLY' ? (fromDayNum(fromDay).y - ev.y) * 12 + fromDayNum(fromDay).m - ev.m - 1 : fromDayNum(fromDay).y - ev.y - 1;
      if (gap > 0) p = Math.floor(gap / r.interval) * r.interval;
    }
    // Inicio de la semana del evento (según WKST) para la repetición semanal
    var sw = startDay - ((new Date(startDay * DAY).getUTCDay() - r.wkst + 7) % 7);
    for (var guard = 0; guard < 6000; guard++, p += r.interval) {
      var list, y, m, periodStart;
      if (r.freq === 'DAILY') { periodStart = startDay + p; list = candidates(ev, r, 0, 0, periodStart); }
      else if (r.freq === 'WEEKLY') { periodStart = sw + 7 * p; list = candidates(ev, r, 0, 0, periodStart); }
      else if (r.freq === 'MONTHLY') { var tm = ev.m + p; y = ev.y + Math.floor(tm / 12); m = ((tm % 12) + 12) % 12; periodStart = dayNum(y, m, 1); list = candidates(ev, r, y, m, 0); }
      else { y = ev.y + p; periodStart = dayNum(y, 0, 1); list = candidates(ev, r, y, 0, 0); }
      if (periodStart > toDay + 1) break;
      for (var i = 0; i < list.length; i++) {
        var n = list[i];
        if (n < startDay) continue;
        if (r.until && dayStart(ev, n) > r.until) return out;
        count++;
        if (n >= fromDay && n <= toDay) out.push(n);
        if (r.count && count >= r.count) return out;
        if (out.length >= MAX_PER_EVENT) return out;
      }
    }
    return out;
  }
  /** Momento (ms) en que empieza la aparición del día n (día civil del evento) */
  function dayStart(ev, n) {
    var c = fromDayNum(n);
    return ev.allDay ? new Date(c.y, c.m, c.d).getTime() : instant(c.y, c.m, c.d, ev.h, ev.mi, ev.tz);
  }

  /**
   * Apariciones entre dos fechas locales (AAAA-MM-DD, incluidas), ordenadas.
   * Cada una: { key, uid, title, location, notes, date, time (null si es todo el día), durMin, allDay, days, part, repeats }.
   * Los eventos de varios días salen en cada día (part: 1, 2…).
   */
  function between(events, from, to) {
    var fromDay = dayOf(from), toDay = dayOf(to), out = [];
    // Las repeticiones cambiadas o anuladas, por evento: no salen en su fecha original
    /** @type {Record<string, {days: number[], mins: number[]}>} */
    var moved = {};
    events.forEach(function (ev) {
      if (!ev.override) return;
      var k = moved[ev.uid] = moved[ev.uid] || { days: [], mins: [] };
      if (ev.override.allDay) k.days.push(ev.override.day); else k.mins.push(ev.override.min);
    });
    events.forEach(function (ev) {
      if (ev.cancelled) return;
      var mv = moved[ev.uid];
      var starts = [];
      if (ev.rrule && !ev.override) {
        // Un día de margen a cada lado: el cambio de zona puede mover la fecha
        occurrenceDays(ev, fromDay - Math.max(1, ev.days), toDay + 1).forEach(function (n) {
          var ts = dayStart(ev, n), min = Math.floor(ts / 60000);
          if (ev.exDays.indexOf(n) >= 0 || ev.exTs.indexOf(min) >= 0) return;
          if (mv && (mv.days.indexOf(n) >= 0 || mv.mins.indexOf(min) >= 0)) return;
          starts.push(ts);
        });
      } else starts.push(ev.ts);
      starts.forEach(function (ts) {
        var local = new Date(ts), date = ymd(local);
        var span = ev.allDay ? ev.days : 1;
        for (var k = 0; k < span; k++) {
          var ds = k ? ymd(new Date(local.getFullYear(), local.getMonth(), local.getDate() + k)) : date;
          var n = dayOf(ds);
          if (n < fromDay || n > toDay) continue;
          out.push({
            key: ev.uid + '|' + Math.floor(ts / 60000) + (k ? '|' + k : ''), uid: ev.uid, title: ev.title, location: ev.location, notes: ev.notes,
            date: ds, start: date, time: ev.allDay ? null : hm(local), durMin: ev.allDay ? 0 : Math.round(ev.durMs / 60000),
            allDay: ev.allDay, days: span, part: k + 1, repeats: !!ev.rrule
          });
        }
      });
    });
    out.sort(function (a, b) {
      if (a.date !== b.date) return a.date < b.date ? -1 : 1;
      if (a.allDay !== b.allDay) return a.allDay ? -1 : 1;
      if (a.time !== b.time) return (a.time || '') < (b.time || '') ? -1 : 1;
      return a.title < b.title ? -1 : a.title > b.title ? 1 : 0;
    });
    return out;
  }

  W.ICal = { read: read, between: between, when: when, duration: duration, zone: zone };
})(window.Whider);
