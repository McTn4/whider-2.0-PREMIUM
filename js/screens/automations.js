/**
 * WHIDER · Sistemas
 *  - Sistemas profesionales (Premium): métodos completos que se instalan de un toque
 *    (categorías, filtros, reglas, hábitos y ajustes): GTD, Eisenhower, bloques de tiempo,
 *    1-3-5, revisión semanal, bandeja a cero y Pomodoro.
 *  - Automatizaciones rápidas (gratis): plantillas que se activan con un interruptor.
 *  - Mis reglas (Premium, en el ordenador): «Cuando… Si… Entonces…» con prueba e historial.
 */
window.Whider = window.Whider || {};
window.Whider.Screens = window.Whider.Screens || {};

(function (W) {
  'use strict';
  var U = W.U, S = function () { return W.State; }, A = function () { return W.Auto; };

  /* ---------- Sistemas profesionales ---------- */
  function ensureList(name, icon) {
    var st = S(), l = st.lists.filter(function (x) { return x.name.toLowerCase() === name.toLowerCase(); })[0];
    return l || st.addList(name, null, icon);
  }
  function ensureFilter(f) {
    var st = S(), ex = st.filters.filter(function (x) { return x.name.toLowerCase() === f.name.toLowerCase(); })[0];
    return ex || st.saveFilter(f);
  }
  function ensureRule(r, sys) {
    var st = S(), ex = st.rules.filter(function (x) { return x.name === r.name; })[0];
    return ex || st.saveRule(Object.assign({ enabled: true, template: 'sys-' + sys }, r));
  }
  function ensureHabit(h) {
    var st = S(), ex = st.habits.filter(function (x) { return x.name.toLowerCase() === h.name.toLowerCase(); })[0];
    return ex || st.addHabit(h);
  }

  var SYSTEMS = [
    { id: 'gtd', icon: 'tray', name: 'GTD · Organízalo todo', desc: 'Captura todo en una bandeja, decide la siguiente acción y revisa cada semana.',
      gives: ['Categorías Bandeja de entrada, Próximas acciones, En espera y Algún día', 'Filtro «Próximas acciones»', 'Regla: lo nuevo sin categoría va a la bandeja', 'Hábito semanal de revisión'],
      install: function () {
        var inbox = ensureList('Bandeja de entrada', 'tray'), next = ensureList('Próximas acciones', 'bolt');
        ensureList('En espera', 'clock'); ensureList('Algún día', 'star');
        ensureFilter({ name: 'Próximas acciones', lists: [next.id], when: 'any', status: 'pending' });
        ensureRule({ name: 'GTD · A la bandeja', trigger: { type: 'created' }, conditions: [{ field: 'list', op: 'is', value: '' }], actions: [{ type: 'set_list', value: inbox.id }] }, 'gtd');
        ensureHabit({ name: 'Revisión semanal', icon: 'repeat', freq: 'weekly', perWeek: 1 });
      } },
    { id: 'eisenhower', icon: 'grid', name: 'Matriz de Eisenhower', desc: 'Separa lo urgente de lo importante: haz, planifica, delega o descarta.',
      gives: ['Filtros 1 · Hacer ya, 2 · Planificar, 3 · Delegar y 4 · Revisar', 'Regla: lo urgente siempre con avisos', 'Ideal con la vista de tablero por prioridad'],
      install: function () {
        ensureFilter({ name: '1 · Hacer ya', priorities: ['danger'], when: 'any', status: 'pending' });
        ensureFilter({ name: '2 · Planificar', priorities: ['purple'], when: 'any', status: 'pending' });
        ensureFilter({ name: '3 · Delegar', priorities: ['star'], when: 'any', status: 'pending' });
        ensureFilter({ name: '4 · Revisar', priorities: ['none'], when: 'overdue', status: 'pending' });
        ensureRule({ name: 'Eisenhower · Avisos en lo urgente', trigger: { type: 'created' }, conditions: [{ field: 'priority', op: 'is', value: 'danger' }], actions: [{ type: 'set_warn', value: true }] }, 'eisenhower');
      } },
    { id: 'timeblock', icon: 'calendar', name: 'Bloques de tiempo', desc: 'Cada tarea con hora ocupa su hueco en el calendario: planifica el día como una agenda.',
      gives: ['Calendario en vista Semana, de 8:00 a 20:00', 'Regla: las tareas con hora duran 1 h si no dices otra cosa', 'Hábito diario «Planificar el día» a las 8:30'],
      install: function () {
        var st = S(), dk = st.settings.desk; dk.calView = 'week'; dk.calStartH = 8; dk.calEndH = 20; st.ui.calView = 'week'; st.saveSettings('settings:desk');
        ensureRule({ name: 'Bloques · Duración de 1 h', trigger: { type: 'created' }, conditions: [{ field: 'time', op: 'has' }], actions: [{ type: 'set_duration', value: 60 }] }, 'timeblock');
        ensureHabit({ name: 'Planificar el día', icon: 'calendar', freq: 'daily', reminder: '08:30' });
      } },
    { id: '135', icon: 'target', name: 'Método 1-3-5', desc: 'Cada día: una tarea grande, tres medianas y cinco pequeñas. Ni más ni menos.',
      gives: ['Filtro «Hoy · 1-3-5»', 'Aviso cada mañana a las 8:00 para elegirlas', 'Hábito «Elegir mi 1-3-5»'],
      install: function () {
        ensureFilter({ name: 'Hoy · 1-3-5', when: 'today', status: 'pending' });
        ensureRule({ name: '1-3-5 · Elegir el día', trigger: { type: 'daily', time: '08:00' }, conditions: [], actions: [{ type: 'notify', value: 'Elige tu 1-3-5: una grande, tres medianas y cinco pequeñas.' }] }, '135');
        ensureHabit({ name: 'Elegir mi 1-3-5', icon: 'target', freq: 'daily' });
      } },
    { id: 'weekly', icon: 'repeat', name: 'Revisión semanal', desc: 'Los viernes por la tarde, una tarea para cerrar la semana y preparar la siguiente.',
      gives: ['Regla: cada viernes a las 17:00 crea «Revisión semanal»', 'Filtro «Esta semana»'],
      install: function () {
        ensureFilter({ name: 'Esta semana', when: 'week', status: 'pending' });
        ensureRule({ name: 'Revisión semanal', trigger: { type: 'daily', time: '17:00' }, conditions: [{ field: 'weekday', op: 'is', value: 5 }], actions: [{ type: 'create_task', value: 'Revisión semanal a las 17:30' }] }, 'weekly');
      } },
    { id: 'zero', icon: 'check', name: 'Bandeja a cero', desc: 'Nada se queda atrás: lo vencido pasa a hoy y lo completado antiguo se limpia solo.',
      gives: ['Regla: lo vencido pasa a hoy cada mañana', 'Regla: borrar completadas de hace más de 30 días'],
      install: function () {
        ensureRule({ name: 'Bandeja a cero · Vencidas a hoy', trigger: { type: 'daily', time: '07:00' }, conditions: [{ field: 'date', op: 'overdue' }], actions: [{ type: 'set_date', value: 'today' }] }, 'zero');
        ensureRule({ name: 'Bandeja a cero · Limpieza', trigger: { type: 'daily', time: '03:00' }, conditions: [{ field: 'done_age', op: 'gt', value: 30 }], actions: [{ type: 'delete' }] }, 'zero');
      } },
    { id: 'pomodoro', icon: 'timer', name: 'Pomodoro', desc: 'Bloques de 25 minutos con pausas: concentración sin agotarte.',
      gives: ['Enfoque 25 / 5 / 15 min, 4 sesiones, pausas automáticas', 'Hábito «4 pomodoros» con objetivo diario'],
      install: function () {
        var st = S(), f = st.settings.focus; f.work = 25; f.short = 5; f.long = 15; f.rounds = 4; f.autoBreaks = true; st.saveSettings('settings:focus');
        ensureHabit({ name: '4 pomodoros', icon: 'timer', freq: 'daily', target: 4, unit: 'sesiones' });
      } }
  ];

  function installed(id) { return !!(S().meta.systems || {})[id]; }
  function install(sys) {
    if (!W.Plan.gate('systems')) return;
    var st = S();
    st.batch(function () { sys.install(); });
    var m = Object.assign({}, st.meta.systems || {}); m[sys.id] = Date.now(); st.setMeta('systems', m);
    W.Audio.success();
    W.Toast.show({ text: 'Sistema «' + sys.name + '» listo', type: 'success', icon: sys.icon, duration: 4000 });
    W.Router.refresh();
  }

  /* ---------- Editor de reglas ---------- */
  function valueControl(kind, value, onChange) {
    var st = S();
    if (!kind) return null;
    var menu = function (opts) {
      var cur = opts.filter(function (o) { return String(o.value) === String(value); })[0] || opts[0];
      if (!opts.some(function (o) { return String(o.value) === String(value); })) onChange(cur.value);
      var b = U.el('button.chip.rb-val', { attrs: { type: 'button' } }, [U.el('span', { text: cur.label }), U.icon('down')]);
      b.addEventListener('click', function () {
        W.Menu.open(b, opts.map(function (o) { return { value: o.value, label: o.label, on: String(o.value) === String(value) }; })).then(function (v) {
          if (v === undefined) return; value = v; b.firstChild.textContent = (opts.filter(function (o) { return o.value === v; })[0] || {}).label; onChange(v);
        });
      });
      return b;
    };
    switch (kind) {
      case 'list': return menu([{ value: '', label: 'Sin categoría' }, { value: '@default', label: 'La de por defecto' }].concat(st.lists.map(function (l) { return { value: l.id, label: l.name }; })));
      case 'prio': return menu(W.Editor.PRIO_OPTS.map(function (o) { return { value: o.value, label: o.value === 'none' ? 'Normal' : o.label }; }));
      case 'when': return menu(A().WHEN);
      case 'onoff': return menu([{ value: true, label: 'Activar' }, { value: false, label: 'Quitar' }]);
      case 'duration': return menu(W.Editor.DUR_OPTS);
      case 'weekday': return menu([1, 2, 3, 4, 5, 6, 0].map(function (d) { return { value: d, label: U.cap(U.WEEKDAYS[d]) }; }));
      case 'days': return menu([7, 14, 30, 60, 90].map(function (d) { return { value: d, label: d + ' días' }; }));
      case 'time': var t = U.el('input.input.rb-time', { attrs: { type: 'time', 'aria-label': 'Hora' } }); t.value = /^\d{2}:\d{2}$/.test(value) ? value : '09:00'; if (!/^\d{2}:\d{2}$/.test(value)) onChange(t.value); t.addEventListener('change', function () { onChange(t.value); }); return t;
      default: var i = U.el('input.input.rb-text', { attrs: { type: 'text', maxlength: 120, placeholder: 'Escribe…' } }); i.value = value == null ? '' : value; i.addEventListener('input', function () { onChange(i.value); }); return i;
    }
  }

  function editRule(rule) {
    if (!W.Plan.gate('automations')) return;
    var st = S(), src = rule ? JSON.parse(JSON.stringify(rule)) : { name: '', enabled: true, trigger: { type: 'created', time: '07:00' }, conditions: [], actions: [{ type: 'set_date', value: 'today' }] };
    var d = src;
    var name = U.el('input.cell-input.title', { attrs: { type: 'text', maxlength: 60, placeholder: 'Nombre de la regla', 'aria-label': 'Nombre de la regla' } });
    name.value = d.name;
    var host = U.el('div.rb');
    var draw = function () {
      U.clear(host);
      // Cuando
      var when = [W.UI.segmented(A().TRIGGERS.map(function (t) { return { value: t.value, label: t.label.replace('Se crea una tarea', 'Al crear').replace('Se completa una tarea', 'Al completar').replace('Una tarea vence', 'Al vencer').replace('Cada día, a una hora', 'Cada día') }; }),
        d.trigger.type, function (v) { d.trigger.type = v; draw(); }, { mini: true })];
      if (d.trigger.type === 'daily') when.push(U.el('label.rb-line', [U.el('span', { text: 'a las' }), valueControl('time', d.trigger.time, function (v) { d.trigger.time = v; })]));
      host.appendChild(W.UI.section({ header: 'Cuando', items: U.el('div.group', [U.el('div.cell.col', when)]) }));
      // Si
      var conds = d.conditions.map(function (c, i) {
        var F = A().FIELDS[c.field];
        var field = U.el('button.chip.rb-val', { attrs: { type: 'button' } }, [U.el('span', { text: F.label }), U.icon('down')]);
        field.addEventListener('click', function () {
          W.Menu.open(field, Object.keys(A().FIELDS).map(function (k) { return { value: k, label: A().FIELDS[k].label, on: k === c.field }; })).then(function (v) {
            if (!v) return; c.field = v; c.op = A().FIELDS[v].ops[0].value; c.value = null; draw();
          });
        });
        var opOpts = F.ops;
        var op = null;
        if (opOpts.length > 1) {
          var curOp = opOpts.filter(function (o) { return o.value === c.op; })[0] || opOpts[0];
          op = U.el('button.chip.rb-val', { attrs: { type: 'button' } }, [U.el('span', { text: curOp.label }), U.icon('down')]);
          op.addEventListener('click', function () { W.Menu.open(op, opOpts.map(function (o) { return { value: o.value, label: o.label, on: o.value === c.op }; })).then(function (v) { if (v) { c.op = v; draw(); } }); });
        } else c.op = opOpts[0].value;
        return U.el('div.cell.rb-row', [field, op, valueControl(F.kind, c.value, function (v) { c.value = v; }),
          U.el('button.circle-btn.rb-x', { attrs: { 'aria-label': 'Quitar condición' }, on: { click: function () { d.conditions.splice(i, 1); draw(); } } }, [U.icon('close')])]);
      });
      conds.push(W.UI.cell({ icon: 'plus', title: 'Añadir condición', accent: true, chevron: false, onTap: function () { d.conditions.push({ field: 'list', op: 'is', value: '' }); draw(); } }));
      host.appendChild(W.UI.section({ header: 'Si (todas se cumplen)', items: conds, footer: d.conditions.length ? null : 'Sin condiciones, vale para todas las tareas.' }));
      // Entonces
      var acts = d.actions.map(function (a, i) {
        var X = A().ACTIONS[a.type];
        var type = U.el('button.chip.rb-val', { attrs: { type: 'button' } }, [U.el('span', { text: X.label }), U.icon('down')]);
        type.addEventListener('click', function () {
          W.Menu.open(type, Object.keys(A().ACTIONS).map(function (k) { return { value: k, label: A().ACTIONS[k].label, on: k === a.type }; })).then(function (v) { if (v) { a.type = v; a.value = null; draw(); } });
        });
        return U.el('div.cell.rb-row', [type, valueControl(X.kind, a.value, function (v) { a.value = v; }),
          U.el('button.circle-btn.rb-x', { attrs: { 'aria-label': 'Quitar acción' }, on: { click: function () { d.actions.splice(i, 1); draw(); } } }, [U.icon('close')])]);
      });
      if (d.actions.length < 8) acts.push(W.UI.cell({ icon: 'plus', title: 'Añadir acción', accent: true, chevron: false, onTap: function () { d.actions.push({ type: 'set_priority', value: 'purple' }); draw(); } }));
      host.appendChild(W.UI.section({ header: 'Entonces', items: acts }));
    };
    draw();
    var test = function () {
      d.name = name.value.trim() || 'Regla';
      var pool = A().dryRun(d);
      W.Sheet.open({ title: 'Prueba de la regla', body: [
        U.el('p.sheet-lead-text', { text: A().describe(d) }),
        pool.length ? W.UI.section({ header: 'Ahora mismo afectaría a ' + U.plural(pool.length, 'tarea', 'tareas'), items: pool.slice(0, 12).map(function (t) { return W.UI.cell({ icon: t.done ? 'check' : 'note', title: t.text, sub: t.date ? U.fmtDay(t.date) : 'Sin fecha' }); }),
          footer: pool.length > 12 ? 'Y ' + (pool.length - 12) + ' más.' : 'No se ha cambiado nada: es solo una prueba.' })
          : U.el('div.group', [W.UI.empty('buddy:search', 'Ninguna tarea cumple la regla ahora', d.trigger.type === 'created' || d.trigger.type === 'completed' ? 'Se aplicará a las tareas nuevas o completadas que la cumplan.' : 'Se aplicará cuando alguna la cumpla.', null, true)])
      ] });
    };
    var s = W.Sheet.open({ title: rule ? 'Editar regla' : 'Nueva regla', className: 'editor rule-editor', full: true,
      body: [U.el('div.group', [U.el('label.cell', [name])]), host].concat(rule ? [U.el('div.group', [W.UI.cell({ title: 'Eliminar la regla', center: true, danger: true, onTap: function () {
        W.Sheet.confirm({ title: '¿Eliminar «' + rule.name + '»?', ok: 'Eliminar', danger: true }).then(function (ok) { if (ok) { st.removeRule(rule.id); s.close(); } });
      } })])] : []),
      foot: [U.el('button.btn.ghost', { on: { click: test } }, [U.icon('search', 'sm'), 'Probar']),
        U.el('button.btn.primary', { text: 'Guardar', on: { click: function () {
          d.name = name.value.trim() || 'Mi regla';
          if (!d.actions.length) { W.Toast.show({ text: 'Añade al menos una acción', type: 'danger' }); return; }
          if (!rule && !W.Plan.gateLimit('rules', st.rules.filter(function (r) { return r.enabled; }).length, 'automations')) return;
          st.saveRule(Object.assign({}, d, rule ? { id: rule.id } : {}));
          W.Audio.success(); s.close();
        } } })] });
    if (!rule) setTimeout(function () { name.focus(); }, W.Layout.desktop ? 30 : 380);
  }

  /* ---------- Pantalla ---------- */
  function templateCell(tp) {
    var st = S(), r = A().templateRule(tp.id), on = !!(r && r.enabled);
    return W.UI.cell({ icon: tp.icon, title: tp.name, sub: tp.desc, right: W.UI.toggle(on, function (v) {
      var cur = A().templateRule(tp.id);
      if (v) {
        var active = st.rules.filter(function (x) { return x.enabled; }).length;
        if (!W.Plan.gateLimit('rules', active, 'automations')) { W.Router.refresh(); return; }
        if (cur) st.saveRule({ id: cur.id, enabled: true });
        else st.saveRule(Object.assign({ name: tp.name, enabled: true, template: tp.id }, JSON.parse(JSON.stringify(tp.rule))));
        W.Toast.show({ text: '«' + tp.name + '» activada', icon: 'bolt' });
      } else if (cur) st.saveRule({ id: cur.id, enabled: false });
    }, tp.name) });
  }

  function ruleCell(r) {
    var st = S(), act = A().activeRules().indexOf(r) >= 0;
    return U.el('div.cell.rule-cell', [
      W.UI.cellIcon(r.trigger.type === 'daily' ? 'clock' : r.trigger.type === 'overdue' ? 'alert' : r.trigger.type === 'completed' ? 'check' : 'plus'),
      U.el('span.cell-main', [U.el('span.cell-title', { text: r.name }), U.el('span.cell-sub', { text: A().describe(r) }),
        U.el('span.rule-meta', { text: (r.enabled && !act ? 'En pausa: el plan gratuito incluye 2 reglas activas · ' : '') + (r.runs ? U.plural(r.runs, 'vez', 'veces') + (r.lastRun ? ' · última ' + U.fmtRel(r.lastRun - Date.now()) : '') : 'Aún no se ha ejecutado') })]),
      U.el('div.rule-trail', [
        U.el('button.btn.xs.soft', { text: 'Editar', on: { click: function () { editRule(r); } } }),
        W.UI.toggle(r.enabled, function (v) {
          if (v && !W.Plan.gateLimit('rules', st.rules.filter(function (x) { return x.enabled; }).length, 'automations')) { W.Router.refresh(); return; }
          st.saveRule({ id: r.id, enabled: v });
        }, r.name)
      ])
    ]);
  }

  W.Screens.automations = {
    title: 'Sistemas',
    edit: editRule,
    SYSTEMS: SYSTEMS,
    back: function () { if (W.Layout.desktop) return false; W.Router.back(); return true; },
    render: function (root) {
      var st = S(), desk = W.Layout.desktop, P = W.Plan;
      var custom = st.rules.filter(function (r) { return !r.template || r.template.indexOf('sys-') === 0; });
      var head = W.UI.header({ title: 'Sistemas', back: desk ? null : { label: 'Atrás', onTap: function () { W.Router.back(); } },
        sub: 'Métodos y automatizaciones que trabajan por ti',
        actions: desk ? [{ text: 'Nueva regla', icon: 'plus', label: 'Nueva regla', onTap: function () { editRule(null); } }] : [] });
      var content = [];
      // Sistemas profesionales
      var cards = U.el('div.sys-grid', SYSTEMS.map(function (sys) {
        var done = installed(sys.id);
        return U.el('div.sys-card' + (done ? '.done' : ''), [
          U.el('div.sys-top', [U.el('span.sys-ic', [U.icon(sys.icon)]), U.el('div', [U.el('strong', { text: sys.name }), U.el('span', { text: sys.desc })])]),
          U.el('ul.sys-gives', sys.gives.map(function (g) { return U.el('li', [U.icon('check', 'xs'), U.el('span', { text: g })]); })),
          U.el('button.btn.sm.' + (done ? 'ghost' : 'primary'), { on: { click: function () { install(sys); } } }, [P.isPremium() ? null : U.icon('gem', 'sm'), done ? 'Instalado · reinstalar' : 'Instalar'])
        ]);
      }));
      content.push(W.UI.section({ title: 'Sistemas profesionales', first: true, side: P.isPremium() ? null : U.el('span.premium-chip', [U.icon('gem'), 'Premium']), items: cards }));
      // Plantillas rápidas
      content.push(W.UI.section({ title: 'Automatizaciones rápidas', items: A().TEMPLATES.map(templateCell),
        footer: P.isPremium() ? 'Se ejecutan solas, también con la app en segundo plano mientras esté abierta.' : 'El plan gratuito incluye 2 automatizaciones activas a la vez.' }));
      // Mis reglas
      var mine = custom.map(ruleCell);
      mine.push(W.UI.cell({ icon: 'plus', title: 'Nueva regla', sub: P.isPremium() ? 'Cuando… Si… Entonces…' : 'Reglas a tu medida con Premium', accent: true, chevron: false, onTap: function () { editRule(null); } }));
      content.push(W.UI.section({ title: 'Mis reglas', side: custom.length ? U.el('small', { text: custom.length }) : null, items: mine }));
      // Historial
      var hist = A().log().slice(0, desk ? 20 : 8);
      if (hist.length) content.push(W.UI.section({ header: 'Lo último que han hecho', items: hist.map(function (e) {
        return W.UI.cell({ icon: 'bolt', title: e.name, sub: e.text, value: U.fmtRel(e.at - Date.now()) });
      }) }));
      W.UI.mount(root, head, content);
    }
  };
})(window.Whider);
