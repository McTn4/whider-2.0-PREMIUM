/**
 * WHIDER · Sonido sintetizado (Web Audio, 100 % offline) y respuesta háptica
 */
window.Whider = window.Whider || {};

(function (W) {
  'use strict';

  var ctx = null, unlocked = false, pending = null;

  function settings() { return W.State ? W.State.settings : { sound: true, vibrate: true }; }
  function quiet() { return W.Notify && W.Notify.isQuiet && W.Notify.isQuiet(); }

  function getCtx() {
    if (!unlocked) return null;
    if (!ctx) {
      var C = window.AudioContext || window.webkitAudioContext;
      if (C) { try { ctx = new C(); } catch (e) { ctx = null; } }
    }
    if (ctx && ctx.state === 'suspended' && ctx.resume) ctx.resume().catch(function () {});
    return ctx;
  }

  // El navegador solo permite audio tras un gesto del usuario
  ['pointerdown', 'touchstart', 'keydown'].forEach(function (ev) {
    window.addEventListener(ev, function unlock() {
      if (unlocked) return;
      unlocked = true;
      getCtx();
      if (pending) { var p = pending; pending = null; Audio[p](); }
    }, { capture: true, passive: true });
  });

  /** Nota con envolvente suave */
  function tone(c, freq, start, dur, type, vol) {
    var o = c.createOscillator(), g = c.createGain();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(freq, start);
    g.gain.setValueAtTime(0.0001, start);
    g.gain.exponentialRampToValueAtTime(vol || 0.16, start + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    o.connect(g); g.connect(c.destination);
    o.start(start); o.stop(start + dur + 0.02);
  }

  function play(name, fn, respectQuiet) {
    if (!settings().sound) return;
    if (respectQuiet && quiet()) return;
    if (!unlocked) { pending = name; return; }
    var c = getCtx();
    if (!c) return;
    try { fn(c, c.currentTime); } catch (e) { /* audio no disponible */ }
  }

  var Audio = {
    /** Tarea completada: un toque breve y suave */
    success: function () {
      play('success', function (c, t) {
        tone(c, 1046.5, t, 0.16, 'sine', 0.07);
        tone(c, 1568, t + 0.045, 0.2, 'sine', 0.045);
      });
    },
    /** Todas las tareas del día completadas: tres notas tranquilas */
    celebrate: function () {
      play('celebrate', function (c, t) {
        [783.99, 987.77, 1318.5].forEach(function (f, i) { tone(c, f, t + i * 0.09, 0.45, 'sine', 0.06); });
      });
    },
    /** Alerta por incumplimiento: dos tonos de atención */
    warning: function () {
      play('warning', function (c, t) {
        tone(c, 587.33, t, 0.22, 'triangle', 0.2);
        tone(c, 783.99, t + 0.18, 0.3, 'triangle', 0.22);
        tone(c, 587.33, t + 0.52, 0.22, 'triangle', 0.18);
        tone(c, 783.99, t + 0.7, 0.34, 'triangle', 0.2);
      }, true);
    },
    /** Recordatorio previo: campanilla suave */
    chime: function () {
      play('chime', function (c, t) {
        tone(c, 880, t, 0.5, 'sine', 0.12);
        tone(c, 1318.5, t + 0.12, 0.6, 'sine', 0.08);
      }, true);
    },
    /** Fin de una sesión de enfoque */
    bell: function () {
      play('bell', function (c, t) {
        [1046.5, 1318.5, 1046.5, 1318.5].forEach(function (f, i) { tone(c, f, t + i * 0.22, 0.6, 'sine', 0.08); });
      });
    },
    tick: function () {
      play('tick', function (c, t) { tone(c, 1400, t, 0.05, 'sine', 0.035); });
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
    /** Los toques normales no vibran ni suenan: la interfaz es silenciosa */
    tap: function () {}
  };

  W.Audio = Audio;
})(window.Whider);
