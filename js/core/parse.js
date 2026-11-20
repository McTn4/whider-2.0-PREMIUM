// @ts-check
/**
 * WHIDER · Lectura de fechas y detalles en lenguaje natural al crear tareas (en español y, con la app en inglés,
 * con su propia gramática: parseEn, más abajo).
 *   "Llamar a Ana mañana a las 10 #trabajo !!"  →  título "Llamar a Ana", mañana 10:00, lista Trabajo, importante
 * Reconoce: hoy, mañana, pasado mañana, días de la semana, "el 15", "15/11", "15 de noviembre",
 * "en 3 días", "la semana que viene", "el finde", horas ("a las 10", "10:30", "a las 5 de la tarde",
 * "a mediodía"), repeticiones ("cada día", "cada lunes"…), prioridad (!, !!, !!!) y listas (#nombre).
 */
window.Whider = window.Whider || {};

(function (W) {
  'use strict';
  var U = W.U;

  var DAYS = { domingo: 0, lunes: 1, martes: 2, 'miércoles': 3, miercoles: 3, jueves: 4, viernes: 5, 'sábado': 6, sabado: 6 };
  var MONTHS = { enero: 0, febrero: 1, marzo: 2, abril: 3, mayo: 4, junio: 5, julio: 6, agosto: 7, septiembre: 8, setiembre: 8, octubre: 9, noviembre: 10, diciembre: 11,
    ene: 0, feb: 1, mar: 2, abr: 3, may: 4, jun: 5, jul: 6, ago: 7, sep: 8, sept: 8, oct: 9, nov: 10, dic: 11 };
  var DAY_RE = '(domingo|lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado)';
  var MONTH_RE = '(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre|ene|feb|mar|abr|may|jun|jul|ago|sept|sep|oct|nov|dic)';
  var NUM_WORDS = { un: 1, una: 1, uno: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10 };
  var B = '(?:^|\\s)', E = '(?=$|[\\s,.;!?])';

  function fold(s) { return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); }
  function nextWeekday(from, wd, forceNext) {
    var d = U.parse(from), diff = (wd - d.getDay() + 7) % 7;
    if (diff === 0 && forceNext) diff = 7;
    return U.addDays(from, diff);
  }
  function hm(h, m) { return U.pad(h) + ':' + U.pad(m || 0); }
  function num(s) { return NUM_WORDS[s] != null ? NUM_WORDS[s] : parseInt(s, 10); }

  /**
   * parse(texto, { lists, ignore }) → { text, date, time, listId, highlight, repeat, found: [{ key, label, kind }] }
   * `ignore`: claves de detecciones que el usuario descartó (se dejan en el título).
   */
  function parse(input, opts) {
    opts = opts || {};
    var ignore = opts.ignore || {};
    var td = U.today(), out = { text: input, date: undefined, time: undefined, listId: undefined, highlight: undefined, repeat: undefined, found: [] };
    var s = ' ' + input + ' ';
    var take = function (re, kind, fn) {
      var m = re.exec(s);
      if (!m) return false;
      var key = kind + ':' + fold(m[0].trim());
      if (ignore[key]) return false;
      var label = fn(m);
      if (label === false) return false;
      out.found.push({ key: key, label: label, kind: kind });
      s = s.slice(0, m.index) + ' ' + s.slice(m.index + m[0].length);
      return true;
    };

    /* ----- Prioridad: !!! urgente · !! importante · ! destacada (signos sueltos) ----- */
    take(new RegExp(B + '(!{1,3})' + E), 'prio', function (m) {
      var n = m[1].length;
      out.highlight = n === 3 ? 'danger' : n === 2 ? 'purple' : 'star';
      return n === 3 ? 'Urgente' : n === 2 ? 'Importante' : 'Destacada';
    });

    /* ----- Lista: #nombre ----- */
    take(/(?:^|\s)#([\wáéíóúñü-]+)/i, 'list', function (m) {
      var want = fold(m[1]), lists = opts.lists || [];
      var hit = lists.filter(function (l) { return fold(l.name) === want; })[0] || lists.filter(function (l) { return fold(l.name).indexOf(want) === 0; })[0];
      if (!hit) return false;
      out.listId = hit.id;
      return hit.name;
    });

    /* ----- Repetición ----- */
    var rep = [
      [new RegExp(B + '(todos los d[ií]as|cada d[ií]a|a diario|diariamente)' + E, 'i'), 'daily', 'Cada día'],
      [new RegExp(B + '(entre semana|d[ií]as laborables|de lunes a viernes)' + E, 'i'), 'weekdays', 'Días laborables'],
      [new RegExp(B + '(cada semana|todas las semanas|semanalmente)' + E, 'i'), 'weekly', 'Cada semana'],
      [new RegExp(B + '(cada mes|todos los meses|mensualmente)' + E, 'i'), 'monthly', 'Cada mes']
    ];
    rep.some(function (r) { return take(r[0], 'repeat', function () { out.repeat = r[1]; return r[2]; }); });
    // "cada lunes" / "todos los lunes": semanal desde ese día
    if (!out.repeat) take(new RegExp(B + '(?:cada|todos los)\\s+' + DAY_RE + 's?' + E, 'i'), 'repeat', function (m) {
      out.repeat = 'weekly';
      out.date = nextWeekday(td, DAYS[fold(m[1])] != null ? DAYS[fold(m[1])] : DAYS[m[1].toLowerCase()], false);
      return 'Cada ' + m[1].toLowerCase();
    });

    /* ----- Hora ----- */
    var setTime = function (h, m, part) {
      h = +h; m = +(m || 0);
      if (part) {
        part = fold(part);
        if (/tarde|noche|pm|p\. ?m/.test(part) && h < 12) h += 12;
        if (/madrugada|manana|am|a\. ?m/.test(part) && h === 12) h = 0;
      }
      if (h > 23 || m > 59) return false;
      out.time = hm(h, m);
      return out.time;
    };
    var PART = '(?:\\s*(?:de la|por la)\\s+(mañana|manana|tarde|noche|madrugada)|\\s*(a\\.?\\s?m\\.?|p\\.?\\s?m\\.?|am|pm))?';
    take(new RegExp(B + 'a mediod[ií]a' + E, 'i'), 'time', function () { return setTime(12, 0); }) ||
    take(new RegExp(B + 'a medianoche' + E, 'i'), 'time', function () { return setTime(23, 59); }) ||
    take(new RegExp(B + '(?:a las?|sobre las?|hacia las?)\\s+(\\d{1,2})(?:[:.h](\\d{2}))?h?(?:\\s*y\\s*(media|cuarto))?' + PART + E, 'i'), 'time', function (m) {
      var mm = m[2] || (m[3] ? (/media/i.test(m[3]) ? 30 : 15) : 0);
      return setTime(m[1], mm, m[4] || m[5]);
    }) ||
    take(new RegExp(B + '(\\d{1,2})[:.](\\d{2})' + PART + E, 'i'), 'time', function (m) { return setTime(m[1], m[2], m[3] || m[4]); }) ||
    take(new RegExp(B + '(\\d{1,2})\\s*(am|pm|a\\.\\s?m\\.|p\\.\\s?m\\.)' + E, 'i'), 'time', function (m) { return setTime(m[1], 0, m[2]); });
    // "por la mañana / tarde / noche" sin hora concreta
    if (!out.time) take(new RegExp(B + '(?:por la|esta)\\s+(mañana|manana|tarde|noche)' + E, 'i'), 'time', function (m) {
      var p = fold(m[1]);
      if (/^esta/i.test(m[0].trim()) && !out.date) out.date = td;
      return setTime(p === 'tarde' ? 17 : p === 'noche' ? 21 : 9, 0);
    });

    /* ----- Fecha ----- */
    if (!out.date) {
      var dateRules = [
        [new RegExp(B + 'pasado mañana' + E, 'i'), function () { out.date = U.addDays(td, 2); return 'Pasado mañana'; }],
        [new RegExp(B + 'mañana' + E, 'i'), function () { out.date = U.addDays(td, 1); return 'Mañana'; }],
        [new RegExp(B + '(hoy|esta noche|esta tarde)' + E, 'i'), function () { out.date = td; return 'Hoy'; }],
        [new RegExp(B + '(?:la semana que viene|la pr[oó]xima semana)' + E, 'i'), function () { out.date = nextWeekday(td, 1, true); return 'Próxima semana'; }],
        [new RegExp(B + '(?:este |el )?(?:fin de semana|finde)' + E, 'i'), function () { out.date = nextWeekday(td, 6, false); return 'Fin de semana'; }],
        [new RegExp(B + '(?:en|dentro de)\\s+(\\d{1,3}|un|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez)\\s+(d[ií]as?|semanas?|mes(?:es)?)' + E, 'i'), function (m) {
          var n = num(m[1].toLowerCase()), u = fold(m[2]);
          out.date = /^d/.test(u) ? U.addDays(td, n) : /^s/.test(u) ? U.addDays(td, n * 7) : U.addMonths(td, n);
          return 'En ' + n + ' ' + (/^d/.test(u) ? (n === 1 ? 'día' : 'días') : /^s/.test(u) ? (n === 1 ? 'semana' : 'semanas') : (n === 1 ? 'mes' : 'meses'));
        }],
        [new RegExp(B + '(?:el |este |el pr[oó]ximo |el siguiente )?' + DAY_RE + '(?:\\s+que viene)?' + E, 'i'), function (m) {
          var wd = DAYS[fold(m[1])]; if (wd == null) wd = DAYS[m[1].toLowerCase()];
          var forceNext = /pr[oó]ximo|siguiente|que viene/i.test(m[0]);
          out.date = nextWeekday(td, wd, true);
          if (!forceNext && out.date === U.addDays(td, 7) && /^este/i.test(m[0].trim())) out.date = td;
          return U.cap(m[1].toLowerCase());
        }],
        [new RegExp(B + '(?:el )?(\\d{1,2})\\s+(?:de\\s+)?' + MONTH_RE + '(?:\\s+(?:de\\s+)?(\\d{4}))?' + E, 'i'), function (m) {
          var d = +m[1], mo = MONTHS[fold(m[2])], y = m[3] ? +m[3] : new Date().getFullYear();
          var ds = U.ymd(new Date(y, mo, d));
          if (new Date(y, mo, d).getDate() !== d) return false;
          if (!m[3] && ds < td) ds = U.ymd(new Date(y + 1, mo, d));
          out.date = ds; return U.fmtShort(ds);
        }],
        [new RegExp(B + '(\\d{1,2})[/-](\\d{1,2})(?:[/-](\\d{2,4}))?' + E), function (m) {
          var d = +m[1], mo = +m[2] - 1, y = m[3] ? (+m[3] < 100 ? 2000 + +m[3] : +m[3]) : new Date().getFullYear();
          if (mo < 0 || mo > 11) return false;
          var dt = new Date(y, mo, d);
          if (dt.getDate() !== d) return false;
          var ds = U.ymd(dt);
          if (!m[3] && ds < td) ds = U.ymd(new Date(y + 1, mo, d));
          out.date = ds; return U.fmtShort(ds);
        }],
        [new RegExp(B + 'el (?:d[ií]a )?(\\d{1,2})' + E, 'i'), function (m) {
          var d = +m[1], now = new Date(), y = now.getFullYear(), mo = now.getMonth();
          if (d < 1 || d > 31) return false;
          var dt = new Date(y, mo, d);
          if (dt.getDate() !== d || U.ymd(dt) < td) dt = new Date(y, mo + 1, d);
          if (dt.getDate() !== d) return false;
          out.date = U.ymd(dt); return U.fmtShort(out.date);
        }]
      ];
      dateRules.some(function (r) { return take(r[0], 'date', r[1]); });
    }
    // Una hora sin fecha: hoy (o mañana si esa hora ya pasó)
    if (out.time && !out.date) out.date = out.time <= U.nowHM() ? U.addDays(td, 1) : td;

    out.text = s.replace(/\s+/g, ' ').trim()
      .replace(/\s+(a|el|la|para|de|en|y|,)$/i, '').trim();
    if (!out.text) out.text = input.trim();
    return out;
  }

  /* ======================================================================================================
   * English grammar (the app in English: js/core/i18n.js). Same result as parse(); dates like 11/15 are
   * month/day (en-US).
   *   "Call Anna tomorrow at 10am #work !!" → "Call Anna", tomorrow 10:00, list Work, important
   * ====================================================================================================== */
  var DAYS_EN = { sunday: 0, sun: 0, monday: 1, mon: 1, tuesday: 2, tue: 2, tues: 2, wednesday: 3, wed: 3, thursday: 4, thu: 4, thur: 4, thurs: 4, friday: 5, fri: 5, saturday: 6, sat: 6 };
  var MONTHS_EN = { january: 0, jan: 0, february: 1, feb: 1, march: 2, mar: 2, april: 3, apr: 3, may: 4, june: 5, jun: 5, july: 6, jul: 6, august: 7, aug: 7, september: 8, sep: 8, sept: 8, october: 9, oct: 9, november: 10, nov: 10, december: 11, dec: 11 };
  // Solos, los días van con su nombre completo («sun» o «sat» son también palabras); abreviados, detrás de on/next/this/every
  var DAY_FULL_EN = '(sunday|monday|tuesday|wednesday|thursday|friday|saturday)';
  var DAY_RE_EN = '(sunday|monday|tuesday|wednesday|thursday|friday|saturday|sun|mon|tues|tue|wed|thurs|thur|thu|fri|sat)';
  var MONTH_RE_EN = '(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sept|sep|oct|nov|dec)';
  var NUM_EN = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 };
  var DAY_NAMES_EN = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  function parseEn(input, opts) {
    opts = opts || {};
    var ignore = opts.ignore || {};
    var td = U.today(), out = { text: input, date: undefined, time: undefined, listId: undefined, highlight: undefined, repeat: undefined, found: [] };
    var s = ' ' + input + ' ';
    var take = function (re, kind, fn) {
      var m = re.exec(s);
      if (!m) return false;
      var key = kind + ':' + fold(m[0].trim());
      if (ignore[key]) return false;
      var label = fn(m);
      if (label === false) return false;
      out.found.push({ key: key, label: label, kind: kind });
      s = s.slice(0, m.index) + ' ' + s.slice(m.index + m[0].length);
      return true;
    };
    var wday = function (w) { return DAYS_EN[String(w).toLowerCase()]; };
    var plural = function (n, one, many) { return n + ' ' + (n === 1 ? one : many); };

    /* ----- Priority: !!! urgent · !! important · ! starred ----- */
    take(new RegExp(B + '(!{1,3})' + E), 'prio', function (m) {
      var n = m[1].length;
      out.highlight = n === 3 ? 'danger' : n === 2 ? 'purple' : 'star';
      return n === 3 ? 'Urgent' : n === 2 ? 'Important' : 'Starred';
    });

    /* ----- List: #name ----- */
    take(/(?:^|\s)#([\wáéíóúñü-]+)/i, 'list', function (m) {
      var want = fold(m[1]), lists = opts.lists || [];
      var hit = lists.filter(function (l) { return fold(l.name) === want; })[0] || lists.filter(function (l) { return fold(l.name).indexOf(want) === 0; })[0];
      if (!hit) return false;
      out.listId = hit.id;
      return hit.name;
    });

    /* ----- Repeat ----- */
    var rep = [
      [new RegExp(B + '(every ?day|each day|daily)' + E, 'i'), 'daily', 'Every day'],
      [new RegExp(B + '(every weekday|on weekdays|weekdays|monday to friday|mon-fri)' + E, 'i'), 'weekdays', 'Weekdays'],
      [new RegExp(B + '(every week|each week|weekly)' + E, 'i'), 'weekly', 'Every week'],
      [new RegExp(B + '(every month|each month|monthly)' + E, 'i'), 'monthly', 'Every month']
    ];
    rep.some(function (r) { return take(r[0], 'repeat', function () { out.repeat = r[1]; return r[2]; }); });
    // "every Monday" / "each Monday": weekly from that day
    if (!out.repeat) take(new RegExp(B + '(?:every|each)\\s+' + DAY_RE_EN + E, 'i'), 'repeat', function (m) {
      var wd = wday(m[1]);
      out.repeat = 'weekly';
      out.date = nextWeekday(td, wd, false);
      return 'Every ' + DAY_NAMES_EN[wd];
    });

    /* ----- Time ----- */
    var setTime = function (h, m, part) {
      h = +h; m = +(m || 0);
      if (part) {
        part = String(part).toLowerCase().replace(/[.\s]/g, '');
        if (part === 'pm' && h < 12) h += 12;
        if (part === 'am' && h === 12) h = 0;
      }
      if (h > 23 || m > 59) return false;
      out.time = hm(h, m);
      return U.fmtTime(out.time);
    };
    var AMPM = '\\s*(a\\.?\\s?m\\.?|p\\.?\\s?m\\.?)';
    take(new RegExp(B + '(?:at )?noon' + E, 'i'), 'time', function () { return setTime(12, 0); }) ||
    take(new RegExp(B + '(?:at )?midnight' + E, 'i'), 'time', function () { return setTime(23, 59); }) ||
    take(new RegExp(B + '(?:at|around|by)\\s+(\\d{1,2})(?:[:.](\\d{2}))?(?:' + AMPM + ')?(?:\\s+in the\\s+(morning|afternoon|evening))?' + E, 'i'), 'time', function (m) {
      var part = m[3] || (m[4] ? (/morning/i.test(m[4]) ? 'am' : 'pm') : '');
      return setTime(m[1], m[2], part);
    }) ||
    take(new RegExp(B + '(\\d{1,2})[:.](\\d{2})(?:' + AMPM + ')?' + E, 'i'), 'time', function (m) { return setTime(m[1], m[2], m[3]); }) ||
    take(new RegExp(B + '(\\d{1,2})' + AMPM + E, 'i'), 'time', function (m) { return setTime(m[1], 0, m[2]); });
    // "tonight", "this morning / afternoon / evening", "in the morning…" without a time
    if (!out.time) take(new RegExp(B + '(tonight|this (?:morning|afternoon|evening)|in the (?:morning|afternoon|evening))' + E, 'i'), 'time', function (m) {
      var p = m[1].toLowerCase();
      if ((/^this|tonight/.test(p)) && !out.date) out.date = td;
      return setTime(/afternoon/.test(p) ? 17 : /evening|tonight/.test(p) ? 21 : 9, 0);
    });

    /* ----- Date ----- */
    if (!out.date) {
      var monthDay = function (mo, d, y) {
        var yy = y ? +y : new Date().getFullYear();
        var dt = new Date(yy, mo, d);
        if (dt.getDate() !== d) return false;
        var ds = U.ymd(dt);
        if (!y && ds < td) ds = U.ymd(new Date(yy + 1, mo, d));
        out.date = ds; return U.fmtShort(ds);
      };
      var dateRules = [
        [new RegExp(B + '(?:the )?day after tomorrow' + E, 'i'), function () { out.date = U.addDays(td, 2); return 'Day after tomorrow'; }],
        [new RegExp(B + 'tomorrow' + E, 'i'), function () { out.date = U.addDays(td, 1); return 'Tomorrow'; }],
        [new RegExp(B + 'today' + E, 'i'), function () { out.date = td; return 'Today'; }],
        [new RegExp(B + 'next week' + E, 'i'), function () { out.date = nextWeekday(td, 1, true); return 'Next week'; }],
        [new RegExp(B + '(?:this |on the |next )?weekend' + E, 'i'), function (m) { out.date = nextWeekday(td, 6, /next/i.test(m[0])); return 'Weekend'; }],
        [new RegExp(B + 'in\\s+(\\d{1,3}|a|an|one|two|three|four|five|six|seven|eight|nine|ten)\\s+(days?|weeks?|months?)' + E, 'i'), function (m) {
          var n = NUM_EN[m[1].toLowerCase()] != null ? NUM_EN[m[1].toLowerCase()] : parseInt(m[1], 10), u = m[2].toLowerCase();
          out.date = /^d/.test(u) ? U.addDays(td, n) : /^w/.test(u) ? U.addDays(td, n * 7) : U.addMonths(td, n);
          return 'In ' + (/^d/.test(u) ? plural(n, 'day', 'days') : /^w/.test(u) ? plural(n, 'week', 'weeks') : plural(n, 'month', 'months'));
        }],
        [new RegExp(B + '(?:(?:on |this |next |on next )' + DAY_RE_EN + '|' + DAY_FULL_EN + ')' + E, 'i'), function (m) {
          var wd = wday(m[1] || m[2]), next = /next/i.test(m[0]);
          out.date = nextWeekday(td, wd, true);
          if (!next && out.date === U.addDays(td, 7) && /^this/i.test(m[0].trim())) out.date = td;
          return DAY_NAMES_EN[wd];
        }],
        // "November 15", "Nov 15th", "November 15, 2027"
        [new RegExp(B + '(?:on )?' + MONTH_RE_EN + '\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?(?:,?\\s+(\\d{4}))?' + E, 'i'), function (m) {
          return monthDay(MONTHS_EN[m[1].toLowerCase()], +m[2], m[3]);
        }],
        // "15 November", "15th of November", "the 15th of Nov 2027"
        [new RegExp(B + '(?:on )?(?:the )?(\\d{1,2})(?:st|nd|rd|th)?\\s+(?:of\\s+)?' + MONTH_RE_EN + '\\.?(?:,?\\s+(\\d{4}))?' + E, 'i'), function (m) {
          return monthDay(MONTHS_EN[m[2].toLowerCase()], +m[1], m[3]);
        }],
        // 11/15, 11/15/2027 (month/day)
        [new RegExp(B + '(?:on )?(\\d{1,2})/(\\d{1,2})(?:/(\\d{2,4}))?' + E), function (m) {
          var mo = +m[1] - 1, d = +m[2], y = m[3] ? (+m[3] < 100 ? 2000 + +m[3] : +m[3]) : null;
          if (mo < 0 || mo > 11) return false;
          return monthDay(mo, d, y);
        }],
        // "on the 15th", "the 3rd"
        [new RegExp(B + '(?:on )?the (\\d{1,2})(?:st|nd|rd|th)' + E, 'i'), function (m) {
          var d = +m[1], now = new Date(), y = now.getFullYear(), mo = now.getMonth();
          if (d < 1 || d > 31) return false;
          var dt = new Date(y, mo, d);
          if (dt.getDate() !== d || U.ymd(dt) < td) dt = new Date(y, mo + 1, d);
          if (dt.getDate() !== d) return false;
          out.date = U.ymd(dt); return U.fmtShort(out.date);
        }]
      ];
      dateRules.some(function (r) { return take(r[0], 'date', r[1]); });
    }
    // A time without a date: today (or tomorrow if that time has passed)
    if (out.time && !out.date) out.date = out.time <= U.nowHM() ? U.addDays(td, 1) : td;

    out.text = s.replace(/\s+/g, ' ').trim()
      .replace(/\s+(at|on|the|for|by|in|and|,)$/i, '').trim();
    if (!out.text) out.text = input.trim();
    return out;
  }

  W.Parse = { task: function (input, opts) { return W.I18n && W.I18n.lang === 'en' ? parseEn(input, opts) : parse(input, opts); }, fold: fold };
})(window.Whider);
