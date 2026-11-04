/**
 * WHIDER · Lectura de fechas y detalles en lenguaje natural (español) al crear tareas.
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

  W.Parse = { task: parse, fold: fold };
})(window.Whider);
