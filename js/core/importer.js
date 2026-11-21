// @ts-check
/**
 * WHIDER · Importar desde otras apps (solo la lógica: leer y convertir; la pantalla está en
 * js/ui/importwiz.js).
 *  - Todoist: el CSV de cada proyecto («Exportar como CSV»).
 *  - Google Tasks: el JSON de Google Takeout (Tasks.json).
 *  - Notion: el CSV de una base de datos («Exportar» → «Markdown y CSV»).
 *  - Calendarios: archivos .ics de Google Calendar, Outlook o Apple (tareas y eventos).
 *  - Hoja de cálculo: un CSV cualquiera, eligiendo qué columna es cada cosa.
 * Devuelve tareas con el formato de WHIDER, las categorías que usan y avisos de lo que no se entendió.
 * Nada se guarda aquí: la pantalla enseña una vista previa y solo importa al confirmar.
 */
window.Whider = window.Whider || {};

(function (W) {
  'use strict';
  var U = W.U;
  var MONTHS = {
    jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
    ene: 0, abr: 3, ago: 7, set: 8, dic: 11
  };
  var DONE_WORDS = /^(done|completed?|complete|finished|closed|hech[ao]s?|completad[ao]s?|terminad[ao]s?|finalizad[ao]s?|cerrad[ao]s?|listo|lista|yes|si|true|x|1)$/;

  /** Minúsculas y sin tildes */
  function fold(s) { return String(s == null ? '' : s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim(); }
  function pad(n) { return n < 10 ? '0' + n : '' + n; }
  function ymd(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function hm(d) { return pad(d.getHours()) + ':' + pad(d.getMinutes()); }
  function valid(y, m, d) { var x = new Date(y, m, d); return x.getFullYear() === y && x.getMonth() === m && x.getDate() === d; }

  /** CSV con comillas; el separador (, ; o tabulador) es el que más aparece en la primera línea */
  function csv(text) {
    text = String(text || '').replace(/^\ufeff/, '');
    var first = text.split('\n')[0] || '';
    var counts = [[',', (first.match(/,/g) || []).length], [';', (first.match(/;/g) || []).length], ['\t', (first.match(/\t/g) || []).length]];
    counts.sort(function (a, b) { return Number(b[1]) - Number(a[1]); });
    var sep = counts[0][1] ? String(counts[0][0]) : ',';
    var rows = [], row = [], cell = '', q = false;
    for (var i = 0; i < text.length; i++) {
      var ch = text[i];
      if (q) {
        if (ch === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += ch;
      } else if (ch === '"') q = true;
      else if (ch === sep) { row.push(cell); cell = ''; }
      else if (ch === '\n' || ch === '\r') {
        if (ch === '\r' && text[i + 1] === '\n') i++;
        row.push(cell); rows.push(row); row = []; cell = '';
      } else cell += ch;
    }
    if (cell || row.length) { row.push(cell); rows.push(row); }
    return rows.filter(function (r) { return r.some(function (c) { return String(c).trim(); }); });
  }

  /**
   * Fecha y hora desde casi cualquier formato: 2024-05-01, 2024-05-01T10:00, 2024-05-01T08:00:00Z,
   * 01/05/2024 (día/mes), May 1, 2024 10:00 AM, 1 de mayo de 2024 10:00. Con «→» (intervalo de Notion)
   * se usa el principio. → { date, time } (null si no se entiende)
   */
  function when(v) {
    var s = String(v == null ? '' : v).split(/\s*(?:→|->)\s*/)[0].trim();
    var out = { date: /** @type {string|null} */ (null), time: /** @type {string|null} */ (null) };
    if (!s) return out;
    var m = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::\d{2}(?:\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?)?/);
    if (m) {
      if (m[6]) { var d = new Date(s); if (!isNaN(d.getTime())) return { date: ymd(d), time: hm(d) }; }
      if (!valid(+m[1], +m[2] - 1, +m[3])) return out;
      return { date: m[1] + '-' + m[2] + '-' + m[3], time: m[4] ? m[4] + ':' + m[5] : null };
    }
    var f = fold(s), t = null;
    var tm = f.match(/(\d{1,2})[:.](\d{2})\s*(am|pm|a\.?\s?m\.?|p\.?\s?m\.?)?/);
    if (tm) {
      var h = +tm[1], ap = (tm[3] || '').replace(/[\s.]/g, '');
      if (ap === 'pm' && h < 12) h += 12;
      if (ap === 'am' && h === 12) h = 0;
      if (h < 24 && +tm[2] < 60) t = pad(h) + ':' + tm[2];
    }
    m = f.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})/);
    if (m) {
      var y = +m[3] < 100 ? 2000 + +m[3] : +m[3];
      if (valid(y, +m[2] - 1, +m[1])) return { date: y + '-' + pad(+m[2]) + '-' + pad(+m[1]), time: t };
      return out;
    }
    m = f.match(/([a-z]{3})[a-z]*\.?\s+(\d{1,2}),?\s+(\d{4})/);
    if (m && MONTHS[m[1]] !== undefined && valid(+m[3], MONTHS[m[1]], +m[2])) return { date: m[3] + '-' + pad(MONTHS[m[1]] + 1) + '-' + pad(+m[2]), time: t };
    m = f.match(/(\d{1,2})\s+(?:de\s+)?([a-z]{3})[a-z]*\.?\s+(?:de\s+)?(\d{4})/);
    if (m && MONTHS[m[2]] !== undefined && valid(+m[3], MONTHS[m[2]], +m[1])) return { date: m[3] + '-' + pad(MONTHS[m[2]] + 1) + '-' + pad(+m[1]), time: t };
    return out;
  }

  /** Clave para reconocer una tarea que ya tienes: mismo texto y misma fecha */
  function dupKey(t) { return fold(t.text).replace(/\s+/g, ' ') + '|' + (t.date || ''); }

  function base(text) {
    return { text: String(text || '').trim().slice(0, 160), notes: '', date: /** @type {string|null} */ (null), time: /** @type {string|null} */ (null),
      done: false, doneOn: /** @type {string|null} */ (null), doneAt: /** @type {number|null} */ (null), highlight: 'none', repeat: 'none',
      duration: /** @type {number|null} */ (null), listName: '', subtasks: /** @type {{text:string,done:boolean}[]} */ ([]) };
  }
  function markDone(t, at) {
    t.done = true;
    var d = at ? new Date(at) : new Date();
    if (isNaN(d.getTime())) d = new Date();
    t.doneAt = d.getTime();
    t.doneOn = ymd(d);
  }

  /** Repetición escrita (español o inglés): «cada día», «every week», «every monday»… */
  function repeatOf(s) {
    var f = fold(s);
    if (/(every|cada)\s+(weekday|workday|dia laborable|laborable)/.test(f)) return 'weekdays';
    if (/(every|cada)\s+(day|dia)\b|^daily$|^diario$/.test(f)) return 'daily';
    if (/(every|cada)\s+(week|semana|monday|tuesday|wednesday|thursday|friday|saturday|sunday|lunes|martes|miercoles|jueves|viernes|sabado|domingo)|^weekly$|^semanal$/.test(f)) return 'weekly';
    if (/(every|cada)\s+(month|mes)|^monthly$|^mensual$/.test(f)) return 'monthly';
    return 'none';
  }

  /* ---------------------------------------------------------------- Todoist (CSV) */
  function todoist(text, fileName) {
    var rows = csv(text), warnings = [], items = [];
    if (!rows.length) return { items: items, warnings: [W.t('El archivo está vacío.')] };
    var head = rows[0].map(function (h) { return String(h).trim().toUpperCase(); });
    var c = function (n) { return head.indexOf(n); };
    if (c('CONTENT') < 0 || c('TYPE') < 0) return { items: items, warnings: [W.t('No parece un CSV de Todoist: faltan las columnas TYPE y CONTENT.')], error: true };
    var project = String(fileName || '').replace(/\.csv$/i, '').replace(/[_-]+/g, ' ').trim();
    var section = '', last = null, top = null, today = new Date();
    rows.slice(1).forEach(function (r) {
      var type = fold(r[c('TYPE')]), content = String(r[c('CONTENT')] || '').trim();
      if (type === 'section') { section = content; return; }
      if (type === 'note') { if (last) last.notes = (last.notes ? last.notes + '\n\n' : '') + content; return; }
      if (type !== 'task' || !content) return;
      var indent = +(r[c('INDENT')] || 1) || 1;
      // Subtareas (sangría > 1): van dentro de la tarea principal anterior
      if (indent > 1 && top) { top.subtasks.push({ text: content.slice(0, 120), done: false }); return; }
      var t = base(content);
      if (c('DESCRIPTION') >= 0) t.notes = String(r[c('DESCRIPTION')] || '').trim();
      // En el CSV, 1 es la prioridad más alta (P1) y 4 la normal
      var p = +(r[c('PRIORITY')] || 4);
      t.highlight = p === 1 ? 'danger' : p === 2 ? 'purple' : p === 3 ? 'star' : 'none';
      var raw = c('DATE') >= 0 ? String(r[c('DATE')] || '').trim() : '';
      if (raw) {
        var w = when(raw), rep = repeatOf(raw), f = fold(raw);
        if (w.date) { t.date = w.date; t.time = w.time; }
        else if (/^(today|hoy)\b/.test(f)) t.date = ymd(today);
        else if (/^(tomorrow|manana)\b/.test(f)) { var tm = new Date(today); tm.setDate(tm.getDate() + 1); t.date = ymd(tm); }
        else if (rep !== 'none') t.date = ymd(today);
        else if (W.Parse && W.Parse.task) { var pp = W.Parse.task('x ' + raw, {}); t.date = pp.date || null; t.time = pp.time || null; }
        if (rep !== 'none') t.repeat = rep;
        if (!t.date) warnings.push(W.t('«{task}»: no se entendió la fecha «{date}» (se importa sin fecha).', { task: content.slice(0, 40), date: raw }));
      }
      t.listName = section ? (project ? project + ' · ' + section : section).slice(0, 24) : project.slice(0, 24);
      items.push(t);
      last = t; top = t;
    });
    return { items: items, warnings: warnings };
  }

  /* ---------------------------------------------------------------- Google Tasks (Takeout JSON) */
  function gtasks(text) {
    var data, warnings = [], items = [];
    try { data = JSON.parse(text); } catch (e) { return { items: items, warnings: [W.t('El archivo no es un JSON válido.')], error: true }; }
    var lists = data && Array.isArray(data.items) ? data.items : null;
    if (!lists || (data.kind && data.kind !== 'tasks#taskLists')) return { items: items, warnings: [W.t('No parece el archivo de Google Tasks de Google Takeout (Tasks.json).')], error: true };
    lists.forEach(function (l) {
      var byId = {}, tasks = Array.isArray(l.items) ? l.items : [];
      tasks.forEach(function (x) {
        if (!x || x.deleted || !String(x.title || '').trim() || x.parent) return;
        var t = base(x.title);
        t.notes = String(x.notes || '').trim();
        // Google Tasks guarda solo el día (la hora del campo «due» no significa nada)
        if (x.due) t.date = String(x.due).slice(0, 10);
        if (x.status === 'completed') markDone(t, x.completed);
        t.listName = String(l.title || '').slice(0, 24);
        byId[x.id] = t;
        items.push(t);
      });
      // Las subtareas van dentro de su tarea
      tasks.forEach(function (x) {
        if (!x || !x.parent || x.deleted || !String(x.title || '').trim()) return;
        var p = byId[x.parent];
        if (p) p.subtasks.push({ text: String(x.title).trim().slice(0, 120), done: x.status === 'completed' });
        else { warnings.push(W.t('Subtarea sin su tarea: «{task}» (se importa como tarea).', { task: String(x.title).slice(0, 40) })); var t = base(x.title); t.listName = String(l.title || '').slice(0, 24); items.push(t); }
      });
    });
    return { items: items, warnings: warnings };
  }

  /* ---------------------------------------------------------------- CSV: Notion y cualquier hoja de cálculo */
  var GUESS = {
    text: ['name', 'nombre', 'title', 'titulo', 'tarea', 'task', 'tareas', 'content', 'asunto', 'subject'],
    date: ['date', 'fecha', 'due', 'due date', 'vence', 'vencimiento', 'deadline', 'fecha limite', 'cuando', 'dia', 'start date'],
    time: ['time', 'hora'],
    list: ['categoria', 'category', 'lista', 'list', 'project', 'proyecto', 'tags', 'etiquetas', 'area', 'tipo', 'type'],
    priority: ['priority', 'prioridad', 'importancia'],
    notes: ['notes', 'notas', 'nota', 'description', 'descripcion', 'detalles', 'comentarios'],
    done: ['status', 'estado', 'done', 'hecho', 'completed', 'completada', 'complete', 'terminada', 'check']
  };
  /** Qué columna parece cada cosa (por el nombre de la cabecera) */
  function guess(head) {
    var h = head.map(fold), out = {};
    Object.keys(GUESS).forEach(function (k) {
      var i = -1;
      GUESS[k].some(function (n) { i = h.indexOf(n); return i >= 0; });
      if (i < 0) GUESS[k].some(function (n) { i = h.findIndex(function (x) { return x.indexOf(n) === 0; }); return i >= 0; });
      out[k] = i;
    });
    if (out.text < 0) out.text = 0;
    return out;
  }
  function prioOf(v) {
    var f = fold(v);
    if (!f) return 'none';
    if (/urgent|critic|!!!|p1\b|^1$/.test(f)) return 'danger';
    if (/alta|high|importan|!!|p2\b|^2$/.test(f)) return 'purple';
    if (/media|medium|normal alta|destac|p3\b|^3$/.test(f)) return 'star';
    return 'none';
  }
  /** Convierte filas con la correspondencia de columnas elegida: { text, date, time, list, priority, notes, done } */
  function fromRows(rows, map) {
    var items = [], warnings = [];
    rows.forEach(function (r, i) {
      var text = String(r[map.text] || '').trim();
      if (!text) return;
      var t = base(text);
      if (map.date >= 0 && String(r[map.date] || '').trim()) {
        var w = when(r[map.date]);
        if (w.date) { t.date = w.date; t.time = w.time; } else warnings.push(W.t('Fila {n}: no se entendió la fecha «{date}».', { n: i + 2, date: String(r[map.date]).slice(0, 30) }));
      }
      if (map.time >= 0) { var tt = String(r[map.time] || '').match(/^(\d{1,2}):(\d{2})/); if (tt && +tt[1] < 24) t.time = pad(+tt[1]) + ':' + tt[2]; }
      if (map.list >= 0) t.listName = String(r[map.list] || '').split(',')[0].trim().slice(0, 24);
      if (map.priority >= 0) t.highlight = prioOf(r[map.priority]);
      if (map.notes >= 0) t.notes = String(r[map.notes] || '').trim().slice(0, 2000);
      if (map.done >= 0 && DONE_WORDS.test(fold(r[map.done]))) markDone(t, null);
      items.push(t);
    });
    return { items: items, warnings: warnings };
  }

  /* ---------------------------------------------------------------- Calendarios (.ics) */
  /** Desfase (ms) de una zona horaria en un momento dado; 0 si el sistema no la conoce */
  function tzOffset(ts, tz) {
    try {
      var p = {};
      new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })
        .formatToParts(new Date(ts)).forEach(function (x) { p[x.type] = x.value; });
      return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute, +p.second) - ts;
    } catch (e) { return null; }
  }
  /** Valor de fecha de iCalendar → { date, time, ts } en la hora de este dispositivo */
  function icsWhen(params, value) {
    var m = String(value || '').match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?/);
    if (!m) return null;
    if (!m[4]) return { date: m[1] + '-' + m[2] + '-' + m[3], time: null, ts: new Date(+m[1], +m[2] - 1, +m[3]).getTime() };
    var y = +m[1], mo = +m[2] - 1, d = +m[3], h = +m[4], mi = +m[5], ts;
    var tz = (String(params || '').match(/TZID=([^;:]+)/) || [])[1];
    if (m[7]) ts = Date.UTC(y, mo, d, h, mi);
    else if (tz) {
      var guessTs = Date.UTC(y, mo, d, h, mi), off = tzOffset(guessTs, tz);
      ts = off === null ? new Date(y, mo, d, h, mi).getTime() : guessTs - off;
    } else ts = new Date(y, mo, d, h, mi).getTime();
    var local = new Date(ts);
    return { date: ymd(local), time: hm(local), ts: ts };
  }
  function icsText(v) { return String(v || '').replace(/\\n/gi, '\n').replace(/\\([,;\\])/g, '$1').trim(); }
  function ics(text, opts) {
    opts = opts || {};
    var warnings = [], items = [], lines = String(text || '').replace(/\r\n[ \t]/g, '').replace(/\n[ \t]/g, '').split(/\r?\n/);
    if (!/BEGIN:VCALENDAR/i.test(lines.slice(0, 5).join('\n'))) return { items: items, warnings: [W.t('No parece un calendario (.ics).')], error: true };
    var cal = '', cur = null, skippedPast = 0, today = ymd(new Date());
    lines.forEach(function (line) {
      var i = line.indexOf(':'); if (i < 0) return;
      var left = line.slice(0, i), value = line.slice(i + 1), name = left.split(';')[0].toUpperCase(), params = left.slice(name.length);
      if (name === 'X-WR-CALNAME' && !cal) cal = icsText(value).slice(0, 24);
      else if (name === 'BEGIN' && /^(VTODO|VEVENT)$/i.test(value)) cur = { kind: value.toUpperCase() };
      else if (name === 'END' && cur && /^(VTODO|VEVENT)$/i.test(value)) {
        var x = cur; cur = null;
        if (!x.SUMMARY || !icsText(x.SUMMARY.v)) return;
        var t = base(icsText(x.SUMMARY.v));
        t.notes = icsText(x.DESCRIPTION ? x.DESCRIPTION.v : '').slice(0, 2000);
        var start = x.kind === 'VTODO' ? (x.DUE || x.DTSTART) : x.DTSTART;
        var w = start ? icsWhen(start.p, start.v) : null;
        if (w) { t.date = w.date; t.time = w.time; }
        if (x.kind === 'VEVENT' && w && w.time && x.DTEND) {
          var e = icsWhen(x.DTEND.p, x.DTEND.v);
          if (e && e.ts > w.ts) { var mins = Math.round((e.ts - w.ts) / 60000); if (mins >= 5 && mins <= 720) t.duration = mins; }
        }
        var rr = String((x.RRULE && x.RRULE.v) || '');
        if (rr) {
          var freq = (rr.match(/FREQ=([A-Z]+)/) || [])[1];
          t.repeat = freq === 'DAILY' ? 'daily' : freq === 'WEEKLY' ? (/BYDAY=MO,TU,WE,TH,FR(;|$)/.test(rr) ? 'weekdays' : 'weekly') : freq === 'MONTHLY' ? 'monthly' : 'none';
          // Cada semana en varios días (BYDAY=MO,WE,FR): los mismos días
          var by = t.repeat === 'weekly' && /BYDAY=([A-Z,0-9+-]+)/.exec(rr);
          if (by) {
            var days = by[1].split(',').map(function (x) { return ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'].indexOf(x.replace(/[^A-Z]/g, '')); }).filter(function (x) { return x >= 0; });
            if (days.length > 1) t.days = days;
          }
          if (t.repeat === 'none') warnings.push(W.t('«{task}»: esa repetición no existe en WHIDER (se importa una vez).', { task: t.text.slice(0, 40) }));
        }
        var p = +((x.PRIORITY && x.PRIORITY.v) || 0);
        t.highlight = p >= 1 && p <= 2 ? 'danger' : p >= 3 && p <= 4 ? 'purple' : p === 5 ? 'star' : 'none';
        if (/COMPLETED/i.test((x.STATUS && x.STATUS.v) || '')) { var cw = x.COMPLETED ? icsWhen(x.COMPLETED.p, x.COMPLETED.v) : null; markDone(t, cw ? cw.ts : null); }
        if (/CANCELLED/i.test((x.STATUS && x.STATUS.v) || '')) return;
        // Por defecto solo lo de hoy en adelante (un calendario puede traer años de eventos pasados)
        if (!opts.past && t.date && t.date < today && t.repeat === 'none' && !t.done) { skippedPast++; return; }
        t.listName = cal;
        items.push(t);
      } else if (cur && !cur[name]) cur[name] = { p: params, v: value };
    });
    if (skippedPast) warnings.push(U ? U.plural(skippedPast, 'evento pasado no se importa', 'eventos pasados no se importan') + '.' : skippedPast + ' pasados');
    return { items: items, warnings: warnings, skippedPast: skippedPast };
  }

  /** ¿De qué app parece el archivo? todoist · gtasks · ics · notion · csv · null */
  function detect(name, text) {
    var n = String(name || '').toLowerCase(), head = String(text || '').replace(/^\ufeff/, '').slice(0, 2000);
    if (/BEGIN:VCALENDAR/i.test(head)) return 'ics';
    if (/^\s*[{[]/.test(head) && /tasks#task/.test(head)) return 'gtasks';
    if (/(^|[",;\t])TYPE[",;\t].*CONTENT/i.test(head.split('\n')[0] || '')) return 'todoist';
    if (/\.csv$/.test(n) || /[,;\t]/.test(head.split('\n')[0] || '')) return /notion|[0-9a-f]{32}/i.test(n) ? 'notion' : 'csv';
    return null;
  }

  /** Marca las que ya tienes (mismo texto y fecha) */
  function markDuplicates(items, existing) {
    var have = {};
    (existing || []).forEach(function (t) { have[dupKey(t)] = true; });
    var seen = {};
    items.forEach(function (t) {
      var k = dupKey(t);
      t.dup = !!have[k] || !!seen[k];
      seen[k] = true;
    });
    return items.filter(function (t) { return t.dup; }).length;
  }

  W.Importer = { csv: csv, when: when, guess: guess, fromRows: fromRows, todoist: todoist, gtasks: gtasks, ics: ics, detect: detect, markDuplicates: markDuplicates, dupKey: dupKey, repeatOf: repeatOf, prioOf: prioOf, fold: fold };
})(window.Whider);
