/**
 * WHIDER PRO - MOTOR DE AUDIO SINTETIZADO (WEB AUDIO API)
 * Genera alertas y tonos melódicos 100% offline sin archivos de audio externos.
 */
window.Whider = window.Whider || {};

(function () {
  'use strict';

  var audioCtx = null;

  function getAudioContext() {
    if (!audioCtx) {
      var AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass) {
        audioCtx = new AudioContextClass();
      }
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    return audioCtx;
  }

  // Desbloqueo seguro en el primer toque del usuario
  function initUnlock() {
    var unlock = function () {
      getAudioContext();
      window.removeEventListener('click', unlock);
      window.removeEventListener('touchstart', unlock);
    };
    window.addEventListener('click', unlock, { once: true });
    window.addEventListener('touchstart', unlock, { once: true });
  }
  initUnlock();

  Whider.Audio = {
    // Alerta de advertencia: Tono doble de atención (La4 -> Do#5)
    playWarningSound: function () {
      if (Whider.State && Whider.State.settings && !Whider.State.settings.sound) return;
      try {
        var ctx = getAudioContext();
        if (!ctx) return;
        var now = ctx.currentTime;

        // Tono 1: 440 Hz
        var osc1 = ctx.createOscillator();
        var gain1 = ctx.createGain();
        osc1.type = 'triangle';
        osc1.frequency.setValueAtTime(440, now);
        gain1.gain.setValueAtTime(0.22, now);
        gain1.gain.exponentialRampToValueAtTime(0.01, now + 0.22);
        osc1.connect(gain1);
        gain1.connect(ctx.destination);
        osc1.start(now);
        osc1.stop(now + 0.24);

        // Tono 2: 554 Hz (Tono superior de aviso)
        var osc2 = ctx.createOscillator();
        var gain2 = ctx.createGain();
        osc2.type = 'triangle';
        osc2.frequency.setValueAtTime(554, now + 0.15);
        gain2.gain.setValueAtTime(0.26, now + 0.15);
        gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.44);
        osc2.connect(gain2);
        gain2.connect(ctx.destination);
        osc2.start(now + 0.15);
        osc2.stop(now + 0.46);
      } catch (e) {
        console.warn('Audio warning tone error:', e);
      }
    },

    // Éxito: Acorde mayor limpio ascendente (Do -> Mi -> Sol)
    playSuccessSound: function () {
      if (Whider.State && Whider.State.settings && !Whider.State.settings.sound) return;
      try {
        var ctx = getAudioContext();
        if (!ctx) return;
        var now = ctx.currentTime;
        var notes = [523.25, 659.25, 783.99];

        notes.forEach(function (freq, index) {
          var osc = ctx.createOscillator();
          var gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, now + (index * 0.07));
          gain.gain.setValueAtTime(0.18, now + (index * 0.07));
          gain.gain.exponentialRampToValueAtTime(0.001, now + (index * 0.07) + 0.22);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now + (index * 0.07));
          osc.stop(now + (index * 0.07) + 0.25);
        });
      } catch (e) {
        console.warn('Audio success tone error:', e);
      }
    },

    // Respuesta háptica en dispositivos móviles
    vibrate: function (pattern) {
      if (Whider.State && Whider.State.settings && !Whider.State.settings.vibrate) return;
      if (navigator.vibrate) {
        try {
          navigator.vibrate(pattern);
        } catch (e) {}
      }
    }
  };
})();
