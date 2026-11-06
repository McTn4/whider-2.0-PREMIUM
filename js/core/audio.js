/**
 * WHIDER · Sonido sintetizado (Web Audio, 100 % sin conexión) y respuesta háptica.
 *
 * Tres familias de sonidos que se activan por separado (Ajustes → Sonidos y vibración):
 *  - Botones: un toque breve al pulsar (cuatro estilos: suave, mecánico, cristal y burbuja).
 *  - Avisos: recordatorios, alertas de tareas vencidas, hábitos y fin del enfoque.
 *  - Logros: completar tareas, días redondos, logros y subidas de nivel.
 * Un volumen general y el interruptor «Sonidos» mandan sobre todo lo demás.
 */
window.Whider = window.Whider || {};

(function (W) {
  'use strict';

  var ctx = null, master = null, unlocked = false, pending = null, lastClick = 0;
  var STYLES = { soft: 'Suave', click: 'Mecánico', crystal: 'Cristal', pop: 'Burbuja' };

  function settings() { return W.State ? W.State.settings : { sound: true, vibrate: true, sounds: { buttons: true, notify: true, events: true, volume: 70, style: 'soft' } }; }
  function cfg() { return settings().sounds || { buttons: true, notify: true, events: true, volume: 70, style: 'soft' }; }
  function quiet() { return W.Notify && W.Notify.isQuiet && W.Notify.isQuiet(); }

  function getCtx() {
    if (!unlocked) return null;
    if (!ctx) {
      var C = window.AudioContext || window.webkitAudioContext;
      if (C) { try { ctx = new C(); master = ctx.createGain(); master.connect(ctx.destination); } catch (e) { ctx = null; } }
    }
    if (ctx && ctx.state === 'suspended' && ctx.resume) ctx.resume().catch(function () {});
    if (master) master.gain.value = Math.max(0, Math.min(1, (cfg().volume == null ? 70 : cfg().volume) / 100)) * 1.4;
    return ctx;
  }

  // El navegador solo permite audio tras un gesto del usuario
  ['pointerdown', 'touchstart', 'keydown'].forEach(function (ev) {
    window.addEventListener(ev, function unlock() {
      if (unlocked) return;
      unlocked = true;
      getCtx();
      if (pending) { var p = pending; pending = null; if (Audio[p]) Audio[p](); }
    }, { capture: true, passive: true });
  });

  /** Nota con envolvente suave (y, si se indica, deslizamiento de frecuencia) */
  function tone(c, freq, start, dur, type, vol, toFreq) {
    var o = c.createOscillator(), g = c.createGain();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(freq, start);
    if (toFreq) o.frequency.exponentialRampToValueAtTime(toFreq, start + dur * 0.8);
    g.gain.setValueAtTime(0.0001, start);
    g.gain.exponentialRampToValueAtTime(vol || 0.16, start + Math.min(0.015, dur / 3));
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    o.connect(g); g.connect(master || c.destination);
    o.start(start); o.stop(start + dur + 0.02);
  }

  /** kind: 'ui' (botones) · 'notify' (avisos) · 'event' (logros) */
  function play(name, fn, kind) {
    var s = settings(), c0 = cfg();
    if (!s.sound) return;
    if (kind === 'ui' && !c0.buttons) return;
    if (kind === 'notify' && (!c0.notify || quiet())) return;
    if (kind === 'event' && c0.events === false) return;
    if (!unlocked) { if (kind !== 'ui') pending = name; return; }
    var c = getCtx();
    if (!c) return;
    try { fn(c, c.currentTime); } catch (e) { /* audio no disponible */ }
  }

  /** Toque de botón según el estilo elegido */
  function clickSound(c, t, style) {
    switch (style) {
      case 'click': tone(c, 2600, t, 0.022, 'square', 0.018); tone(c, 1300, t + 0.012, 0.03, 'triangle', 0.03); break;
      case 'crystal': tone(c, 2093, t, 0.09, 'sine', 0.03); tone(c, 3136, t + 0.02, 0.08, 'sine', 0.018); break;
      case 'pop': tone(c, 380, t, 0.07, 'sine', 0.07, 920); break;
      default: tone(c, 1180, t, 0.045, 'sine', 0.04);
    }
  }

  var Audio = {
    STYLES: STYLES,

    /* ---------- Botones ---------- */
    click: function (style) {
      var now = Date.now();
      if (now - lastClick < 45) return;
      lastClick = now;
      play('click', function (c, t) { clickSound(c, t, style || cfg().style); }, 'ui');
    },

    /* ---------- Logros ---------- */
    /** Tarea completada: un toque breve y suave */
    success: function () {
      play('success', function (c, t) {
        tone(c, 1046.5, t, 0.16, 'sine', 0.07);
        tone(c, 1568, t + 0.045, 0.2, 'sine', 0.045);
      }, 'event');
    },
    /** Todas las tareas del día completadas: tres notas tranquilas */
    celebrate: function () {
      play('celebrate', function (c, t) {
        [783.99, 987.77, 1318.5].forEach(function (f, i) { tone(c, f, t + i * 0.09, 0.45, 'sine', 0.06); });
      }, 'event');
    },
    /** Logro conseguido: arpegio brillante */
    achievement: function () {
      play('achievement', function (c, t) {
        [1046.5, 1318.5, 1568, 2093].forEach(function (f, i) { tone(c, f, t + i * 0.07, 0.35, 'sine', 0.05); });
        tone(c, 2637, t + 0.32, 0.5, 'sine', 0.025);
      }, 'event');
    },
    /** Subida de nivel: fanfarria corta */
    levelUp: function () {
      play('levelUp', function (c, t) {
        [523.25, 659.25, 783.99].forEach(function (f, i) { tone(c, f, t + i * 0.1, 0.25, 'triangle', 0.07); });
        [1046.5, 1318.5].forEach(function (f) { tone(c, f, t + 0.32, 0.7, 'sine', 0.06); });
      }, 'event');
    },
    /** El personaje reacciona al tocarlo */
    boop: function () {
      play('boop', function (c, t) { tone(c, 520, t, 0.09, 'sine', 0.06, 1040); tone(c, 1300, t + 0.08, 0.08, 'sine', 0.03); }, 'event');
    },

    /* ---------- Avisos ---------- */
    /** Alerta por incumplimiento: dos tonos de atención */
    warning: function () {
      play('warning', function (c, t) {
        tone(c, 587.33, t, 0.22, 'triangle', 0.2);
        tone(c, 783.99, t + 0.18, 0.3, 'triangle', 0.22);
        tone(c, 587.33, t + 0.52, 0.22, 'triangle', 0.18);
        tone(c, 783.99, t + 0.7, 0.34, 'triangle', 0.2);
      }, 'notify');
    },
    /** Recordatorio previo: campanilla suave */
    chime: function () {
      play('chime', function (c, t) {
        tone(c, 880, t, 0.5, 'sine', 0.12);
        tone(c, 1318.5, t + 0.12, 0.6, 'sine', 0.08);
      }, 'notify');
    },
    /** Fin de una sesión de enfoque */
    bell: function () {
      play('bell', function (c, t) {
        [1046.5, 1318.5, 1046.5, 1318.5].forEach(function (f, i) { tone(c, f, t + i * 0.22, 0.6, 'sine', 0.08); });
      }, 'notify');
    },
    tick: function () {
      play('tick', function (c, t) { tone(c, 1400, t, 0.05, 'sine', 0.035); }, 'ui');
    },

    /** Vibración: usa el puente nativo de Android si existe */
    vibrate: function (pattern) {
      if (!settings().vibrate) return;
      var bridge = window.WhiderAndroid;
      if (bridge && typeof bridge.vibrate === 'function') {
        try { bridge.vibrate(JSON.stringify(pattern)); } catch (e) { /* sin vibración */ }
        return;
      }
      var ua = navigator.userActivation;
      if (navigator.vibrate && (unlocked || (ua && ua.hasBeenActive))) {
        try { navigator.vibrate(pattern); } catch (e) { /* sin vibración */ }
      }
    },
    /** Respuesta háptica muy ligera para cambios de selección (interruptores, segmentos…) */
    select: function () { Audio.vibrate([6]); },
    tap: function () { Audio.click(); }
  };

  /*
   * Sonido de los botones: un único oyente para toda la app. Las casillas de completar ya tienen
   * su propio sonido (el de logro), así que no suenan dos veces.
   */
  document.addEventListener('click', function (e) {
    if (!e.isTrusted) return;
    var b = e.target.closest && e.target.closest('button, a[href], [role="button"], .cell.tap, label.switch');
    if (!b || b.disabled || b.matches('.check, .hcheck, .hg-cell, .hday')) return;
    Audio.click();
  }, true);

  W.Audio = Audio;
})(window.Whider);
