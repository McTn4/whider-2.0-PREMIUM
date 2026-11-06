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
    work: { label: 'Enfoque', icon: 'target', msg: 'Concéntrate en una sola cosa' },
    short: { label: 'Pausa corta', icon: 'coffee', msg: 'Respira y estírate' },
    long: { label: 'Pausa larga', icon: 'moon', msg: 'Desconecta unos minutos' }
  };

  var T = load();
  var tickId = null, ui = null;

  function load() {
    var d = null;
    try { d = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { d = null; }
    return Object.assign({ mode: 'work', running: false, endAt: 0, remaining: null, round: 1, taskId: null }, d || {});
  }
  function persist() { try { localStorage.setItem(KEY, JSON.stringify(T)); } catch (e) { /* sin espacio */ } }
  /** Guarda y lo comparte con tus otros dispositivos (Premium: gestionar el ordenador desde el móvil) */
  function share() { T.at = Date.now(); persist(); if (W.Devices) W.Devices.shareFocus(T); }
  /** Llega un enfoque más reciente desde otro dispositivo: se adopta */
  function adoptRemote() {
    var f = W.Devices ? W.Devices.remoteFocus(T.at || 0) : null;
    if (!f) return;
    T.mode = f.mode; T.running = f.running; T.endAt = f.endAt; T.remaining = f.remaining; T.round = f.round; T.taskId = f.taskId; T.at = f.at;
    persist();
    if (T.running) ensureTick();
    update();
    W.Toast.show({ text: 'Enfoque ' + (T.running ? 'en marcha' : 'en pausa') + ' desde otro dispositivo', icon: 'phone' });
  }
  function duration(mode) { var f = S().settings.focus; return (mode === 'work' ? f.work : mode === 'short' ? f.short : f.long) * 60000; }
  function remaining() {
    if (T.running) return Math.max(0, T.endAt - Date.now());
    return T.remaining != null ? T.remaining : duration(T.mode);
  }
  function fmt(ms) { var s = Math.ceil(ms / 1000), m = Math.floor(s / 60); return U.pad(m) + ':' + U.pad(s % 60); }

  function setMode(mode, keepStopped) {
    T.mode = mode; T.running = false; T.remaining = null; T.endAt = 0;
    share();
    if (!keepStopped) update();
  }

  function start() {
    T.endAt = Date.now() + remaining();
    T.running = true; T.remaining = null;
    share(); ensureTick(); W.Audio.vibrate([12]); update();
  }
  function pause() {
    T.remaining = remaining(); T.running = false;
    share(); W.Audio.vibrate([12]); update();
  }
  function reset() { T.running = false; T.remaining = null; share(); update(); }

  function complete() {
    var st = S(), f = st.settings.focus, was = T.mode;
    T.running = false; T.remaining = null;
    if (was === 'work') {
      st.addFocus(f.work, T.taskId);
      var next = T.round >= f.rounds ? 'long' : 'short';
      W.Toast.show({ text: 'Sesión completada · ' + f.work + ' min de enfoque', type: 'success', icon: 'check' });
      W.Notify.system('Sesión de enfoque completada', 'Es momento de una ' + MODES[next].label.toLowerCase() + '.', 'whider-focus');
      T.mode = next;
      if (T.round >= f.rounds) T.round = 1; else T.round += 1;
    } else {
      W.Toast.show({ text: 'Pausa terminada', icon: 'timer' });
      W.Notify.system('Pausa terminada', 'Puedes volver al enfoque cuando quieras.', 'whider-focus');
      T.mode = 'work';
    }
    W.Audio.bell(); W.Audio.vibrate([80, 60, 80, 60, 160]);
    share();
    if (f.autoBreaks && (was === 'work' || T.mode !== 'work')) start(); else update();
  }

  function ensureTick() {
    if (tickId) return;
    tickId = setInterval(function () {
      if (!T.running) { clearInterval(tickId); tickId = null; return; }
      if (remaining() <= 0) complete(); else { paint(); if (W.Sidebar) W.Sidebar.tick(); if (W.Screens.home && W.Screens.home.tick) W.Screens.home.tick(); }
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
    if (W.Sidebar) W.Sidebar.refresh();
    if (W.State.activeScreen === 'home' && W.Layout.desktop) W.Router.refresh();
    var root = document.getElementById('screen-focus');
    if (root && W.State.activeScreen === 'focus') W.Screens.focus.render(root);
    else if (!T.running) document.title = 'WHIDER';
  }

  function pickTask(anchor) {
    var st = S();
    var pend = st.pending().sort(st.compareDeadline).slice(0, 40);
    var options = [{ value: '', label: 'Ninguna', desc: 'Enfoque libre' }].concat(pend.map(function (t) {
      var l = t.listId ? st.getList(t.listId) : null;
      return { value: t.id, label: t.text, desc: (t.date ? U.fmtDay(t.date) + (t.time ? ', ' + U.fmtTime(t.time) : '') : 'Sin fecha') + (l ? ' · ' + l.name : '') };
    }));
    W.Sheet.choose({ anchor: anchor, title: 'Tarea en la que te enfocas', value: T.taskId || '', options: options }).then(function (v) {
      if (v === undefined) return;
      T.taskId = v || null; persist(); update();
    });
  }

  W.Screens.focus = {
    title: 'Enfoque',
    linkTask: function (id) { T.taskId = id; if (!T.running) setMode('work', true); share(); update(); },
    /** Llamado al sincronizar: adopta el enfoque de otro dispositivo si es más reciente */
    adoptRemote: adoptRemote,
    /** Estado para la barra lateral y la paleta de comandos */
    status: function () { return { running: T.running, mode: T.mode, label: MODES[T.mode].label, text: fmt(remaining()) }; },
    /** Empezar o pausar desde fuera de la pantalla (atajo, paleta, menú de la bandeja) */
    toggle: function () { if (T.running) pause(); else start(); },
    resume: function () { if (T.running) { if (remaining() <= 0) complete(); else ensureTick(); } },

    render: function (root) {
      var st = S(), f = st.settings.focus;
      var rem = remaining(), total = duration(T.mode), fresh = !T.running && rem >= total;
      var head = W.UI.header({ title: 'Enfoque', profile: true, sub: T.running ? MODES[T.mode].label + ' en marcha' : MODES[T.mode].msg });

      var seg = W.UI.segmented([
        { value: 'work', label: 'Enfoque' }, { value: 'short', label: 'Pausa corta' }, { value: 'long', label: 'Pausa larga' }
      ], T.mode, function (v) { setMode(v); });
      seg.style.marginTop = '10px';

      var time = U.el('div.focus-time', { text: fmt(rem) });
      var ring = W.Fx.ring(248, 7, 1 - rem / total, U.el('div.focus-center', [
        time,
        U.el('span.focus-mode', { text: T.mode === 'work' ? 'Sesión ' + T.round + ' de ' + f.rounds : MODES[T.mode].msg })
      ]), 1 - rem / total);

      var dots = U.el('div.focus-dots', { attrs: { 'aria-hidden': 'true' } });
      for (var i = 1; i <= f.rounds; i++) dots.appendChild(U.el('i' + (i < T.round || (i === T.round && T.mode !== 'work') ? '.done' : i === T.round ? '.cur' : '')));

      var controls = U.el('div.focus-controls', [
        U.el('button.focus-side', { attrs: { 'aria-label': 'Reiniciar', title: 'Reiniciar' }, on: { click: function () { reset(); } } }, [U.icon('reset')]),
        U.el('button.focus-play', { attrs: { 'aria-label': T.running ? 'Pausar' : fresh ? 'Iniciar' : 'Reanudar' }, on: { click: function () { if (T.running) pause(); else start(); } } },
          [U.icon(T.running ? 'pause' : 'play')]),
        U.el('button.focus-side', { attrs: { 'aria-label': 'Saltar a la siguiente fase', title: 'Saltar fase' }, on: { click: function () { complete(); } } }, [U.icon('skip')])
      ]);
      controls.firstChild.disabled = fresh;

      var linked = T.taskId ? st.find(T.taskId) : null;
      if (T.taskId && (!linked || linked.done)) { T.taskId = null; persist(); linked = null; }
      var today = st.focusOn(U.today());
      var opts = W.UI.section({
        items: [
          W.UI.cell({ icon: 'target', title: 'Tarea', value: linked ? linked.text : 'Ninguna', onTap: function (e, node) { pickTask(node.querySelector('.cell-value')); } }),
          W.UI.cell({ icon: 'timer', title: 'Duraciones', value: f.work + ' / ' + f.short + ' / ' + f.long + ' min', onTap: function () { W.Settings.open('focus'); } })
        ],
        footer: today.sessions ? 'Hoy: ' + today.min + ' min de enfoque en ' + U.plural(today.sessions, 'sesión', 'sesiones') + '.' : 'Aún no has hecho ninguna sesión hoy.'
      });

      var buddy = W.Character.node({ size: 58, mood: T.running && T.mode === 'work' ? 'focus' : T.running ? 'happy' : 'happy', bubble: false, cls: 'focus-buddy' });
      var inner = W.UI.mount(root, head, [seg, U.el('div.focus-stage', [ring, buddy]), dots, controls, opts]);
      inner.className = 'inner focus mode-' + T.mode + (T.running ? ' running' : '');
      ui = { time: time, ring: ring };
      if (T.running) ensureTick();
      paint();
    }
  };
})(window.Whider);
