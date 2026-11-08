/**
 * WHIDER · Mis dispositivos y plantillas de un toque (Premium)
 *
 *  - Gestionar el ordenador desde el móvil: cada dispositivo con tu cuenta se anuncia (nombre y
 *    última conexión) y el enfoque se comparte: si lo empiezas en el ordenador, el móvil ve la
 *    cuenta atrás y puede pausarlo o reanudarlo (y al revés).
 *  - Mayor rapidez: plantillas que crean varias tareas de un toque desde la creación rápida.
 */
window.Whider = window.Whider || {};

(function (W) {
  'use strict';
  var U = W.U, S = function () { return W.State; };
  var KEY = 'whider.device';
  var myId = null;

  function deviceId() {
    if (myId) return myId;
    try { myId = localStorage.getItem(KEY); } catch (e) { myId = null; }
    if (!myId) { myId = U.uid('d'); try { localStorage.setItem(KEY, myId); } catch (e) { /* sin almacenamiento */ } }
    return myId;
  }
  function info() {
    var D = window.WhiderDesktop, ua = navigator.userAgent || '';
    if (D) return { kind: 'pc', name: 'Ordenador · ' + ({ win32: 'Windows', darwin: 'Mac', linux: 'Linux' }[D.platform] || 'escritorio') };
    if (window.WhiderAndroid) return { kind: 'mobile', name: 'Móvil · Android' };
    if (/Android|iPhone|iPad|Mobile/i.test(ua)) return { kind: 'mobile', name: 'Móvil · navegador' };
    return { kind: 'pc', name: 'Ordenador · navegador' };
  }
  function active() { return !!(W.Auth && W.Auth.user) && W.Plan.isPremium(); }

  var Devices = {
    id: deviceId,
    /** Este dispositivo sigue conectado (se sube con la siguiente sincronización) */
    seen: function () { if (active()) S().seeDevice(deviceId(), info()); },
    list: function () {
      var d = S().social.devices;
      return Object.keys(d).map(function (k) { return Object.assign({ id: k, me: k === deviceId() }, d[k]); }).sort(function (a, b) { return (b.me - a.me) || (b.seen - a.seen); });
    },
    /** El enfoque cambió aquí: se comparte con tus otros dispositivos */
    shareFocus: function (T) {
      if (!active()) return;
      S().setSharedFocus({ mode: T.mode, running: T.running, endAt: T.endAt, remaining: T.remaining, round: T.round, taskId: T.taskId, device: deviceId() });
    },
    /** Enfoque compartido más reciente de otro dispositivo (o null) */
    remoteFocus: function (since) {
      var f = S().social.focus;
      return active() && f && f.device && f.device !== deviceId() && f.at > (since || 0) ? f : null;
    },
    sheet: function () {
      if (!W.Plan.gate('remote')) return;
      var host = U.el('div.dev-body'), timer = null;
      var draw = function () {
        U.clear(host);
        var f = W.Screens.focus.status(), shared = S().social.focus;
        var from = shared && shared.device ? (S().social.devices[shared.device] || {}).name : null;
        host.appendChild(U.el('div.group.card.dev-focus', [
          U.el('div.card-head', [U.el('strong', { text: 'Enfoque en tus dispositivos' }), U.el('span.muted', { text: f.running ? f.label + ' en marcha' : 'En pausa' })]),
          U.el('div.dev-time', { text: f.text }),
          U.el('small.muted', { text: from && shared.device !== deviceId() ? 'Último cambio desde: ' + from : 'Lo que hagas aquí se ve en tus otros dispositivos' }),
          U.el('div.dev-acts', [U.el('button.btn.primary', { on: { click: function () { W.Screens.focus.toggle(); setTimeout(draw, 60); } } }, [U.icon(f.running ? 'pause' : 'play', 'sm'), f.running ? 'Pausar' : 'Empezar o reanudar']),
            U.el('button.btn.ghost', { on: { click: function () { W.Sheet.closeTop(); W.Router.go('focus'); } } }, ['Abrir Enfoque'])])
        ]));
        var list = Devices.list();
        host.appendChild(W.UI.section({ header: 'Conectados con tu cuenta', items: list.length ? list.map(function (d) {
          var mins = Math.round((Date.now() - d.seen) / 60000);
          return W.UI.cell({ icon: d.kind === 'pc' ? 'monitor' : 'phone', title: d.name + (d.me ? ' (este)' : ''), sub: d.me ? 'Ahora' : mins < 3 ? 'Conectado ahora' : 'Visto ' + U.fmtRel(d.seen - Date.now()) });
        }) : [W.UI.cell({ title: 'Solo este dispositivo', sub: 'Abre WHIDER con tu cuenta en el ordenador o en el móvil' })],
          footer: 'Tus tareas, tu Cuaderno y tus hábitos se sincronizan al instante entre todos ellos.' }));
      };
      var s = W.Sheet.open({ title: 'Mis dispositivos', className: 'devices-sheet', body: [host], onClose: function () { clearInterval(timer); } });
      draw();
      timer = setInterval(function () { var t = host.querySelector('.dev-time'); if (t) t.textContent = W.Screens.focus.status().text; }, 500);
      if (W.Sync) W.Sync.push();
      return s;
    },
    init: function () {
      deviceId();
      Devices.seen();
      setInterval(function () { if (!document.hidden) Devices.seen(); }, 5 * 60000);
      document.addEventListener('visibilitychange', function () { if (!document.hidden) Devices.seen(); });
      if (W.Sync) W.Sync.onStatus(function (st) { if (st === 'synced' && active() && !S().social.devices[deviceId()]) Devices.seen(); });
    }
  };

  /* ---------- Plantillas de un toque ---------- */
  var SUGGEST = [
    { name: 'Rutina de mañana', icon: 'sun', lines: ['Desayunar con calma', 'Revisar el día', 'Ejercicio 20 minutos'] },
    { name: 'Cierre del día', icon: 'moon', lines: ['Repasar lo hecho', 'Planificar mañana', 'Ordenar el escritorio'] },
    { name: 'Inicio de semana', icon: 'week', lines: ['Revisar el calendario de la semana', 'Elegir las 3 prioridades', 'Responder correos pendientes'] }
  ];
  function applyTemplate(t) {
    if (!W.Plan.gate('quick')) return;
    var st = S(), n = 0;
    st.batch(function () {
      t.tasks.forEach(function (x) {
        var p = W.Parse.task(x.text, { lists: st.lists });
        if (!p.text) return;
        if (st.addTask({ text: p.text, date: p.date !== undefined ? p.date : U.today(), time: p.time || x.time || null, listId: p.listId || x.listId || st.settings.defaultList,
          highlight: p.highlight || x.highlight || 'none', repeat: p.repeat || 'none', warn: st.settings.defaultWarn, notes: '', subtasks: [] })) n++;
      });
    });
    W.Audio.success();
    W.Toast.show({ text: '«' + t.name + '»: ' + U.plural(n, 'tarea creada', 'tareas creadas'), type: 'success', icon: t.icon || 'bolt' });
  }
  function editTemplate(t, preset) {
    if (!W.Plan.gate('quick')) return;
    var st = S(), src = t || preset || { name: '', lines: [] };
    var name = U.el('input.cell-input.title', { attrs: { type: 'text', maxlength: 40, placeholder: 'Nombre (p. ej. Rutina de mañana)', 'aria-label': 'Nombre de la plantilla' } });
    name.value = src.name || '';
    var lines = U.el('textarea.cell-input', { attrs: { rows: 6, placeholder: 'Una tarea por línea:\nRevisar el correo a las 9\nLlamar al cliente #trabajo !!', 'aria-label': 'Tareas de la plantilla' } });
    lines.value = t ? t.tasks.map(function (x) { return x.text; }).join('\n') : (src.lines || []).join('\n');
    var body = [U.el('div.group', [U.el('label.cell', [name]), U.el('label.cell', [lines])]),
      U.el('p.hint', { text: 'Cada línea entiende la fecha, la hora, la #categoría y la prioridad, como la creación rápida.' })];
    if (t) body.push(U.el('div.group', [W.UI.cell({ title: 'Eliminar la plantilla', center: true, danger: true, onTap: function () { st.removeTemplate(t.id); s.close(); } })]));
    var s = W.Sheet.open({ title: t ? 'Editar plantilla' : 'Nueva plantilla', className: 'editor', body: body,
      foot: [U.el('button.btn.primary', { text: 'Guardar', on: { click: function () {
        var tasks = lines.value.split('\n').map(function (l) { return l.trim(); }).filter(Boolean).map(function (l) { return { text: l }; });
        if (!name.value.trim() || !tasks.length) { W.Toast.show({ text: 'Pon un nombre y al menos una tarea', type: 'danger' }); return; }
        st.saveTemplate({ id: t ? t.id : undefined, name: name.value.trim(), icon: (t && t.icon) || src.icon || 'bolt', tasks: tasks });
        s.close();
      } } })] });
    if (!t) setTimeout(function () { name.focus(); }, W.Layout.desktop ? 30 : 380);
  }
  /** Fila de plantillas para la creación rápida */
  function row(after) {
    var st = S(), list = st.templates;
    var chips = list.map(function (t) {
      var c = U.el('button.chip.tpl-chip', { attrs: { type: 'button', title: t.tasks.map(function (x) { return x.text; }).join(' · ') } }, [U.icon(t.icon || 'bolt'), U.el('span', { text: t.name }), U.el('small', { text: t.tasks.length })]);
      c.addEventListener('click', function () { applyTemplate(t); if (after) after(); });
      c.addEventListener('contextmenu', function (e) { e.preventDefault(); editTemplate(t); });
      return c;
    });
    if (!list.length) SUGGEST.slice(0, 2).forEach(function (sg) {
      var c = U.el('button.chip.tpl-chip.ghost', { attrs: { type: 'button' } }, [U.icon(sg.icon), U.el('span', { text: sg.name })]);
      c.addEventListener('click', function () { editTemplate(null, sg); });
      chips.push(c);
    });
    var add = U.el('button.chip.tpl-chip', { attrs: { type: 'button', 'aria-label': 'Nueva plantilla' } }, [U.icon('plus'), U.el('span', { text: list.length ? '' : 'Plantilla' })]);
    add.addEventListener('click', function () { editTemplate(null); });
    chips.push(add);
    return U.el('div.tpl-row', [U.el('span.tpl-h', [U.icon('bolt', 'xs'), 'De un toque', W.Plan.isPremium() ? null : U.el('span.sb-gem', [U.icon('gem')])]), U.el('div.chips', chips)]);
  }

  W.Devices = Devices;
  W.Templates = { row: row, apply: applyTemplate, edit: editTemplate, SUGGEST: SUGGEST };
})(window.Whider);
