/**
 * WHIDER · Enfoque: temporizador Pomodoro con anillo animado, rondas,
 * pausas automáticas, tarea vinculada y estadísticas del día.
 * El tiempo se calcula con marcas absolutas: sigue siendo exacto aunque la app
 * pase a segundo plano o se recargue.
 */
window.Whider = window.Whider || {};
window.Whider.Screens = window.Whider.Screens || {};

(function (W) {
  'use strict';
  var U = W.U, S = function () { return W.State; };
  var KEY = 'whider.focus.timer';
  var MODES = {
    work: { label: 'Enfoque', icon: 'target', msg: 'Concéntrate en una sola cosa.' },
    short: { label: 'Pausa corta', icon: 'coffee', msg: 'Respira, estírate, bebe agua.' },
    long: { label: 'Pausa larga', icon: 'moon', msg: 'Desconecta de verdad unos minutos.' }
  };

  var T = load();
  var tickId = null, ui = null;

  function load() {
    var d = null;
    try { d = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { d = null; }
    return Object.assign({ mode: 'work', running: false, endAt: 0, remaining: null, round: 1, taskId: null }, d || {});
  }
  function persist() { try { localStorage.setItem(KEY, JSON.stringify(T)); } catch (e) { /* sin espacio */ } }
  function duration(mode) { var f = S().settings.focus; return (mode === 'work' ? f.work : mode === 'short' ? f.short : f.long) * 60000; }
  function remaining() {
    if (T.running) return Math.max(0, T.endAt - Date.now());
    return T.remaining != null ? T.remaining : duration(T.mode);
  }
  function fmt(ms) { var s = Math.ceil(ms / 1000), m = Math.floor(s / 60); return U.pad(m) + ':' + U.pad(s % 60); }

  function setMode(mode, keepStopped) {
    T.mode = mode; T.running = false; T.remaining = null; T.endAt = 0;
    persist();
    if (!keepStopped) update();
  }

  function start() {
    T.endAt = Date.now() + remaining();
    T.running = true; T.remaining = null;
    persist(); ensureTick(); W.Audio.vibrate([12]); update();
  }
  function pause() {
    T.remaining = remaining(); T.running = false;
    persist(); W.Audio.vibrate([12]); update();
  }
  function reset() { T.running = false; T.remaining = null; persist(); update(); }

  function complete() {
    var st = S(), f = st.settings.focus, was = T.mode;
    T.running = false; T.remaining = null;
    if (was === 'work') {
      st.addFocus(f.work, T.taskId);
      var next = T.round >= f.rounds ? 'long' : 'short';
      W.Toast.show({ text: '¡Sesión completada! +' + f.work + ' min de enfoque', type: 'success', icon: 'target' });
      W.Notify.system('🎯 Sesión de enfoque completada', 'Tómate un respiro: ' + MODES[next].label.toLowerCase() + '.', 'whider-focus');
      T.mode = next;
      if (T.round >= f.rounds) T.round = 1; else T.round += 1;
    } else {
      W.Toast.show({ text: 'Pausa terminada. ¡A por la siguiente!', icon: 'bolt' });
      W.Notify.system('⚡ Pausa terminada', 'Vuelve al enfoque cuando quieras.', 'whider-focus');
      T.mode = 'work';
    }
    W.Audio.bell(); W.Audio.vibrate([80, 60, 80, 60, 160]);
    persist();
    if (f.autoBreaks && (was === 'work' || T.mode !== 'work')) start(); else update();
  }

  function ensureTick() {
    if (tickId) return;
    tickId = setInterval(function () {
      if (!T.running) { clearInterval(tickId); tickId = null; return; }
      if (remaining() <= 0) complete(); else paint();
    }, 250);
  }

  /** Repinta solo lo que cambia cada segundo (sin reconstruir la pantalla) */
  function paint() {
    if (!ui) return;
    var rem = remaining(), total = duration(T.mode);
    ui.time.textContent = fmt(rem);
    ui.ring._set(1 - rem / total);
    document.title = (T.running ? fmt(rem) + ' · ' : '') + 'WHIDER';
  }

  function update() {
    var root = document.getElementById('screen-focus');
    if (root && W.State.activeScreen === 'focus') W.Screens.focus.render(root);
    else if (!T.running) document.title = 'WHIDER';
  }

  function pickTask() {
    var st = S();
    var pend = st.pending().sort(st.compareDeadline).slice(0, 30);
    var options = [{ value: '', label: 'Sin tarea', desc: 'Enfoque libre', icon: 'target' }].concat(pend.map(function (t) {
      var l = t.listId ? st.getList(t.listId) : null;
      return { value: t.id, label: t.text, desc: t.date ? U.fmtDay(t.date) + (t.time ? ' · ' + U.fmtTime(t.time) : '') : 'Sin fecha', color: l ? st.ACCENTS[l.color].a : 'var(--t4)' };
    }));
    W.Sheet.choose({ title: 'Vincular una tarea', value: T.taskId || '', options: options }).then(function (v) {
      if (v === undefined) return;
      T.taskId = v || null; persist(); update();
    });
  }

  W.Screens.focus = {
    title: 'Enfoque',
    linkTask: function (id) { T.taskId = id; if (!T.running) setMode('work', true); persist(); update(); },
    resume: function () { if (T.running) { if (remaining() <= 0) complete(); else ensureTick(); } },

    render: function (root, fresh) {
      var st = S(), f = st.settings.focus;
      var inner = U.el('div.inner.focus' + (fresh ? '.stagger' : '') + '.mode-' + T.mode + (T.running ? '.running' : ''));
      inner.appendChild(W.UI.pageHead('Modo concentración', 'Enfoque', MODES[T.mode].msg));

      inner.appendChild(W.UI.segmented([
        { value: 'work', label: 'Enfoque' }, { value: 'short', label: 'Pausa' }, { value: 'long', label: 'Descanso' }
      ], T.mode, function (v) { setMode(v); }));

      var rem = remaining(), total = duration(T.mode);
      var time = U.el('div.focus-time.num', { text: fmt(rem) });
      var dots = U.el('div.focus-rounds');
      for (var i = 1; i <= f.rounds; i++) dots.appendChild(U.el('i' + (i < T.round || (i === T.round && T.mode !== 'work') ? '.done' : i === T.round ? '.cur' : '')));
      var ring = W.Fx.ring(260, 14, 1 - rem / total, U.el('div.focus-center', [
        U.el('span.focus-mode', [U.icon(MODES[T.mode].icon, 'sm'), MODES[T.mode].label]), time, dots
      ]), 1 - rem / total);
      var stage = U.el('div.focus-stage', [U.el('div.focus-aura'), ring]);
      inner.appendChild(stage);

      inner.appendChild(U.el('div.focus-controls', [
        U.el('button.icon-btn.lg', { attrs: { 'aria-label': 'Reiniciar' }, on: { click: function () { W.Audio.tap(); reset(); } } }, [U.icon('reset')]),
        U.el('button.focus-play.fx-press', { attrs: { 'aria-label': T.running ? 'Pausar' : 'Iniciar' }, on: { click: function () { if (T.running) pause(); else start(); } } },
          [U.icon(T.running ? 'pause' : 'play')]),
        U.el('button.icon-btn.lg', { attrs: { 'aria-label': 'Saltar' }, on: { click: function () { W.Audio.tap(); complete(); } } }, [U.icon('skip')])
      ]));

      var linked = T.taskId ? st.find(T.taskId) : null;
      if (T.taskId && (!linked || linked.done)) { T.taskId = null; persist(); linked = null; }
      inner.appendChild(U.el('button.card.focus-task', { on: { click: pickTask } }, [
        U.el('span.row-icon', [U.icon(linked ? 'tasks' : 'target')]),
        U.el('span.row-main', [U.el('span.eyebrow', { text: linked ? 'Trabajando en' : 'Tarea vinculada' }),
          U.el('span.row-label', { text: linked ? linked.text : 'Elegir una tarea (opcional)' })]),
        U.icon('right')
      ]));

      var today = st.focusOn(U.today()), tot = st.focusTotals();
      inner.appendChild(U.el('div.stat-grid.three', [
        U.el('div.card.stat', [U.el('span.stat-v.num', { text: today.min }), U.el('span.stat-l', { text: 'min hoy' })]),
        U.el('div.card.stat', [U.el('span.stat-v.num', { text: today.sessions }), U.el('span.stat-l', { text: 'sesiones hoy' })]),
        U.el('div.card.stat', [U.el('span.stat-v.num', { text: Math.round(tot.min / 60 * 10) / 10 }), U.el('span.stat-l', { text: 'horas en total' })])
      ]));
      inner.appendChild(U.el('p.hint', { text: f.work + ' min de enfoque · ' + f.short + ' de pausa · ' + f.long + ' de descanso cada ' + f.rounds + ' rondas. Cámbialo en Ajustes.' }));

      U.clear(root).appendChild(inner);
      ui = { time: time, ring: ring };
      if (T.running) ensureTick();
      paint();
    }
  };
})(window.Whider);
