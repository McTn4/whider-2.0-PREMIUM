/**
 * WHIDER · Motor de automatizaciones
 *
 * Reglas «Cuando… Si… Entonces…»:
 *  - Cuando: se crea una tarea · se completa una tarea · una tarea vence · cada día a una hora.
 *  - Si: categoría, prioridad, texto, fecha, hora, repetición, días desde que se completó, día de la semana.
 *  - Entonces: fecha, hora, duración, prioridad, categoría, avisos, completar, eliminar, avisarte o crear una tarea.
 * Lo que hace una regla nunca dispara otras (sin bucles). Las reglas diarias se ponen al día si la app
 * estaba cerrada a su hora. Cada ejecución queda en el historial (solo en este dispositivo).
 * Plan gratuito: hasta 2 reglas activas (las plantillas); con Premium, sin límite y reglas propias.
 */
window.Whider = window.Whider || {};

(function (W) {
  'use strict';
  var U = W.U, S = function () { return W.State; };
  var LOG = 'whider.autolog.v1';
  var running = false;
  var log = load();

  function load() {
    var d = null;
    try { d = JSON.parse(localStorage.getItem(LOG) || 'null'); } catch (e) { d = null; }
    d = d && typeof d === 'object' ? d : {};
    return { entries: Array.isArray(d.entries) ? d.entries.slice(-80) : [], seen: d.seen && typeof d.seen === 'object' ? d.seen : {}, daily: d.daily && typeof d.daily === 'object' ? d.daily : {} };
  }
  function persist() { try { localStorage.setItem(LOG, JSON.stringify(log)); } catch (e) { /* sin espacio */ } }

  /* ---------- Vocabulario (para el editor y los resúmenes) ---------- */
  var TRIGGERS = [
    { value: 'created', label: 'Se crea una tarea' },
    { value: 'completed', label: 'Se completa una tarea' },
    { value: 'overdue', label: 'Una tarea vence' },
    { value: 'daily', label: 'Cada día, a una hora' }
  ];
  var FIELDS = {
    list: { label: 'Categoría', ops: [{ value: 'is', label: 'es' }, { value: 'not', label: 'no es' }], kind: 'list' },
    priority: { label: 'Prioridad', ops: [{ value: 'is', label: 'es' }, { value: 'not', label: 'no es' }], kind: 'prio' },
    text: { label: 'Texto', ops: [{ value: 'contains', label: 'contiene' }, { value: 'not_contains', label: 'no contiene' }], kind: 'text' },
    date: { label: 'Fecha', ops: [{ value: 'none', label: 'sin fecha' }, { value: 'any', label: 'con fecha' }, { value: 'today', label: 'es hoy' }, { value: 'overdue', label: 'ya venció' }, { value: 'future', label: 'es futura' }], kind: null },
    time: { label: 'Hora', ops: [{ value: 'has', label: 'tiene hora' }, { value: 'none', label: 'sin hora' }], kind: null },
    repeat: { label: 'Repetición', ops: [{ value: 'yes', label: 'se repite' }, { value: 'no', label: 'no se repite' }], kind: null },
    done_age: { label: 'Completada hace', ops: [{ value: 'gt', label: 'más de' }], kind: 'days' },
    weekday: { label: 'Hoy es', ops: [{ value: 'is', label: '' }], kind: 'weekday' }
  };
  var ACTIONS = {
    set_date: { label: 'Poner fecha', kind: 'when' },
    set_time: { label: 'Poner hora', kind: 'time' },
    set_duration: { label: 'Poner duración', kind: 'duration' },
    set_priority: { label: 'Poner prioridad', kind: 'prio' },
    set_list: { label: 'Mover a la categoría', kind: 'list' },
    set_warn: { label: 'Avisos', kind: 'onoff' },
    complete: { label: 'Completarla', kind: null },
    delete: { label: 'Eliminarla', kind: null },
    notify: { label: 'Avisarme con el texto', kind: 'text' },
    create_task: { label: 'Crear la tarea', kind: 'text' }
  };
  var WHEN = [{ value: 'today', label: 'Hoy' }, { value: 'tomorrow', label: 'Mañana' }, { value: 'monday', label: 'El lunes' }, { value: 'week', label: 'En una semana' }, { value: 'none', label: 'Sin fecha' }];

  /* ---------- Plantillas rápidas (gratis, también en el móvil) ---------- */
  var TEMPLATES = [
    { id: 'tpl-overdue-today', icon: 'sun', name: 'Pasar lo vencido a hoy', desc: 'Cada mañana a las 7, lo que se quedó sin hacer pasa a hoy.',
      rule: { trigger: { type: 'daily', time: '07:00' }, conditions: [{ field: 'date', op: 'overdue' }], actions: [{ type: 'set_date', value: 'today' }] } },
    { id: 'tpl-new-today', icon: 'calendar', name: 'Lo nuevo sin fecha, para hoy', desc: 'Si creas una tarea sin fecha, se queda para hoy.',
      rule: { trigger: { type: 'created' }, conditions: [{ field: 'date', op: 'none' }], actions: [{ type: 'set_date', value: 'today' }] } },
    { id: 'tpl-urgent-warn', icon: 'bell', name: 'Avisos en lo urgente', desc: 'Las tareas urgentes siempre tienen avisos.',
      rule: { trigger: { type: 'created' }, conditions: [{ field: 'priority', op: 'is', value: 'danger' }], actions: [{ type: 'set_warn', value: true }] } },
    { id: 'tpl-clean-done', icon: 'trash', name: 'Limpiar completadas antiguas', desc: 'Borra las completadas hace más de 30 días (tus rachas se conservan).',
      rule: { trigger: { type: 'daily', time: '03:00' }, conditions: [{ field: 'done_age', op: 'gt', value: 30 }], actions: [{ type: 'delete' }] } },
    { id: 'tpl-no-list', icon: 'tray', name: 'Sin categoría → la de por defecto', desc: 'Lo que crees sin categoría va a tu categoría por defecto.',
      rule: { trigger: { type: 'created' }, conditions: [{ field: 'list', op: 'is', value: '' }], actions: [{ type: 'set_list', value: '@default' }] } }
  ];

  /* ---------- Evaluación ---------- */
  function nextMonday() { var td = U.today(), wd = U.weekday(td); return U.addDays(td, ((8 - wd) % 7) || 7); }
  function whenDate(v) {
    var td = U.today();
    return v === 'today' ? td : v === 'tomorrow' ? U.addDays(td, 1) : v === 'monday' ? nextMonday() : v === 'week' ? U.addDays(td, 7) : null;
  }
  function matches(rule, t) {
    var st = S(), td = U.today(), now = Date.now();
    return rule.conditions.every(function (c) {
      switch (c.field) {
        case 'list': var l = c.value === '@default' ? st.settings.defaultList : (c.value || ''); return c.op === 'not' ? (t.listId || '') !== l : (t.listId || '') === l;
        case 'priority': return c.op === 'not' ? t.highlight !== c.value : t.highlight === c.value;
        case 'text': var has = String(t.text + ' ' + (t.notes || '')).toLowerCase().indexOf(String(c.value || '').toLowerCase()) >= 0; return c.op === 'not_contains' ? !has : has;
        case 'date':
          if (c.op === 'none') return !t.date;
          if (c.op === 'any') return !!t.date;
          if (c.op === 'today') return t.date === td;
          if (c.op === 'overdue') return !t.done && !!t.date && now >= U.deadlineTs(t.date, t.time);
          if (c.op === 'future') return !!t.date && t.date > td;
          return true;
        case 'time': return c.op === 'none' ? !t.time : !!t.time;
        case 'repeat': return c.op === 'no' ? t.repeat === 'none' : t.repeat !== 'none';
        case 'done_age': return !!t.done && !!t.doneAt && (now - t.doneAt) / 86400000 > (+c.value || 0);
        case 'weekday': return U.weekday(td) === +c.value;
        default: return true;
      }
    });
  }
  function needsTask(rule) { return rule.actions.some(function (a) { return a.type !== 'notify' && a.type !== 'create_task'; }); }
  function targetsDone(rule) { return rule.conditions.some(function (c) { return c.field === 'done_age'; }); }

  /** Cambios que haría una regla en una tarea (sin aplicarlos) → { fields, complete, remove } */
  function plan(rule, t) {
    var st = S(), out = { fields: {}, complete: false, remove: false };
    rule.actions.forEach(function (a) {
      switch (a.type) {
        case 'set_date': out.fields.date = whenDate(a.value); if (!out.fields.date) out.fields.time = null; break;
        case 'set_time': out.fields.time = /^\d{2}:\d{2}$/.test(a.value) ? a.value : null; if (out.fields.time && !t.date && out.fields.date === undefined) out.fields.date = U.today(); break;
        case 'set_duration': out.fields.duration = +a.value || null; break;
        case 'set_priority': if (st.PRIORITIES[a.value]) out.fields.highlight = a.value; break;
        case 'set_list': out.fields.listId = a.value === '@default' ? st.settings.defaultList : (a.value || null); break;
        case 'set_warn': out.fields.warn = a.value === true || a.value === 'true' || a.value === 'on'; break;
        case 'complete': out.complete = true; break;
        case 'delete': out.remove = true; break;
      }
    });
    return out;
  }

  /** Reglas que se ejecutan (sin Premium, solo las primeras activas hasta el límite) */
  function activeRules() {
    var st = S(), lim = W.Plan ? W.Plan.limit('rules') : Infinity;
    return st.rules.filter(function (r) { return r.enabled; }).sort(function (a, b) { return a.createdAt - b.createdAt; }).slice(0, lim);
  }

  function record(rule, n, text) {
    log.entries.push({ at: Date.now(), ruleId: rule.id, name: rule.name, n: n, text: text || '' });
    log.entries = log.entries.slice(-80);
    persist();
    S().ruleRan(rule.id, n);
  }

  /** Aplica una regla a unas tareas (y sus acciones sin tarea: avisar, crear) */
  function apply(rule, tasks, reason) {
    var st = S(), n = 0, made = [];
    running = true;
    try {
      st.batch(function () {
        tasks.forEach(function (t) {
          if (!st.find(t.id)) return;
          var p = plan(rule, t);
          if (p.remove) { st.removeTask(t.id); n++; return; }
          if (Object.keys(p.fields).length) st.updateTask(t.id, p.fields);
          if (p.complete && !t.done) st.setDone(t.id, true);
          n++;
        });
        rule.actions.forEach(function (a) {
          if (a.type === 'create_task' && a.value) {
            var parsed = W.Parse.task(String(a.value), { lists: st.lists });
            var c = st.addTask({ text: parsed.text || String(a.value), date: parsed.date !== undefined ? parsed.date : U.today(), time: parsed.time || null,
              listId: parsed.listId || st.settings.defaultList, highlight: parsed.highlight || 'none', warn: st.settings.defaultWarn, notes: 'Creada por «' + rule.name + '»', subtasks: [] });
            if (c) made.push(c.text);
          }
        });
      });
    } finally { running = false; }
    var notes = rule.actions.filter(function (a) { return a.type === 'notify' && a.value; });
    notes.forEach(function (a) {
      W.Toast.show({ text: String(a.value), icon: 'bolt', duration: 5000 });
      if (W.Notify) W.Notify.system('WHIDER · ' + rule.name, String(a.value), 'whider-rule-' + rule.id);
    });
    var total = n + made.length + (notes.length && !n && !made.length ? 1 : 0);
    if (total) record(rule, total, reason + (n ? ' · ' + U.plural(n, 'tarea', 'tareas') : '') + (made.length ? ' · creada: ' + made.join(', ') : ''));
    return total;
  }

  /* ---------- Disparadores ---------- */
  function fire(type, t) {
    if (running || !t) return;
    var rules = activeRules().filter(function (r) { return r.trigger.type === type; });
    rules.forEach(function (r) {
      var cur = S().find(t.id);
      if (cur && matches(r, cur)) apply(r, [cur], type === 'created' ? 'Al crear «' + cur.text + '»' : 'Al completar «' + cur.text + '»');
    });
  }

  /** Vencidas (cada minuto) y diarias (a su hora, o en cuanto se abre la app si ya pasó) */
  function tick() {
    if (running) return;
    var st = S(), now = Date.now(), td = U.today(), hm = U.nowHM();
    activeRules().forEach(function (r) {
      if (r.trigger.type === 'overdue') {
        var seen = log.seen[r.id] || (log.seen[r.id] = {});
        var list = st.tasks.filter(function (t) {
          if (t.done || !t.date) return false;
          var dl = U.deadlineTs(t.date, t.time);
          return now >= dl && seen[t.id] !== dl && matches(r, t);
        });
        if (!list.length) return;
        list.forEach(function (t) { seen[t.id] = U.deadlineTs(t.date, t.time); });
        persist();
        apply(r, list, 'Al vencer');
      } else if (r.trigger.type === 'daily') {
        var at = r.trigger.time || '07:00';
        if (hm < at || log.daily[r.id] === td) return;
        log.daily[r.id] = td; persist();
        if (needsTask(r)) {
          var pool = st.tasks.filter(function (t) { return (targetsDone(r) ? t.done : !t.done) && matches(r, t); });
          if (pool.length) apply(r, pool, 'Cada día a las ' + U.fmtTime(at));
          else if (r.actions.some(function (a) { return a.type === 'notify' || a.type === 'create_task'; }) && matches(r, { text: '', done: false, highlight: 'none', repeat: 'none' })) apply(r, [], 'Cada día a las ' + U.fmtTime(at));
        } else if (matches(r, { text: '', done: false, highlight: 'none', repeat: 'none', listId: null })) apply(r, [], 'Cada día a las ' + U.fmtTime(at));
      }
    });
  }

  /** Prueba sin cambiar nada: qué tareas tocaría ahora */
  function dryRun(rule) {
    var st = S(), type = rule.trigger.type;
    var pool = st.tasks.filter(function (t) {
      if (type === 'completed') return t.done && matches(rule, t);
      if (type === 'daily') return (targetsDone(rule) ? t.done : !t.done) && matches(rule, t);
      if (type === 'overdue') return !t.done && t.date && Date.now() >= U.deadlineTs(t.date, t.time) && matches(rule, t);
      return !t.done && matches(rule, t);
    });
    return pool;
  }

  /* ---------- Descripciones ---------- */
  function listName(id) { if (id === '@default') return 'la de por defecto'; var l = S().getList(id); return l ? l.name : 'sin categoría'; }
  function describeCond(c) {
    var F = FIELDS[c.field]; if (!F) return '';
    var op = (F.ops.filter(function (o) { return o.value === c.op; })[0] || F.ops[0]).label;
    if (c.field === 'list') return 'categoría ' + op + ' ' + listName(c.value);
    if (c.field === 'priority') return 'prioridad ' + op + ' ' + (S().PRIORITIES[c.value] || {}).label.toLowerCase();
    if (c.field === 'text') return 'el texto ' + op + ' «' + (c.value || '') + '»';
    if (c.field === 'done_age') return 'completada hace más de ' + (+c.value || 0) + ' días';
    if (c.field === 'weekday') return 'hoy es ' + U.WEEKDAYS[+c.value || 0];
    return (c.field === 'date' ? 'fecha: ' : c.field === 'time' ? '' : '') + op;
  }
  function describeAction(a) {
    switch (a.type) {
      case 'set_date': return 'fecha ' + ((WHEN.filter(function (w) { return w.value === a.value; })[0] || {}).label || '').toLowerCase();
      case 'set_time': return a.value && a.value !== 'none' ? 'a las ' + U.fmtTime(a.value) : 'sin hora';
      case 'set_duration': return 'dura ' + W.Editor.durLabel(+a.value);
      case 'set_priority': return 'prioridad ' + (S().PRIORITIES[a.value] || {}).label.toLowerCase();
      case 'set_list': return 'a ' + listName(a.value);
      case 'set_warn': return a.value === true || a.value === 'true' || a.value === 'on' ? 'con avisos' : 'sin avisos';
      case 'complete': return 'completarla';
      case 'delete': return 'eliminarla';
      case 'notify': return 'avisarme: «' + (a.value || '') + '»';
      case 'create_task': return 'crear «' + (a.value || '') + '»';
      default: return '';
    }
  }
  function describe(rule) {
    var t = (TRIGGERS.filter(function (x) { return x.value === rule.trigger.type; })[0] || {}).label || '';
    if (rule.trigger.type === 'daily') t = 'Cada día a las ' + U.fmtTime(rule.trigger.time || '07:00');
    var c = rule.conditions.map(describeCond).filter(Boolean).join(' y ');
    return t + (c ? ', si ' + c : '') + ' → ' + rule.actions.map(describeAction).filter(Boolean).join(', ');
  }

  var Auto = {
    TRIGGERS: TRIGGERS, FIELDS: FIELDS, ACTIONS: ACTIONS, WHEN: WHEN, TEMPLATES: TEMPLATES,
    matches: matches, dryRun: dryRun, describe: describe, describeAction: describeAction, describeCond: describeCond,
    log: function () { return log.entries.slice().reverse(); },
    activeRules: activeRules,
    /** Ejecuta ya una regla (botón «Ejecutar ahora») */
    runNow: function (rule) {
      var pool = dryRun(rule);
      if (!pool.length && needsTask(rule)) return 0;
      return apply(rule, rule.trigger.type === 'created' || rule.trigger.type === 'completed' ? pool : pool, 'A mano');
    },
    template: function (id) { return TEMPLATES.filter(function (t) { return t.id === id; })[0] || null; },
    templateRule: function (id) { return S().rules.filter(function (r) { return r.template === id; })[0] || null; },
    init: function () {
      var st = S();
      // Se engancha a crear y completar tareas
      var add = st.addTask, done = st.setDone;
      st.addTask = function () { var t = add.apply(st, arguments); if (t) fire('created', t); return t; };
      st.setDone = function (id, d) { var was = st.find(id), before = was && was.done, t = done.apply(st, arguments); if (t && d && !before && t.done) fire('completed', t); return t; };
      setTimeout(tick, 2500);
      setInterval(tick, 60000);
      document.addEventListener('visibilitychange', function () { if (!document.hidden) setTimeout(tick, 800); });
    }
  };

  W.Auto = Auto;
})(window.Whider);
