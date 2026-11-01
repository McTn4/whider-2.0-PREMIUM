/**
 * WHIDER · Arranque de la aplicación
 */
window.Whider = window.Whider || {};

(function (W) {
  'use strict';
  var U = W.U, S = W.State;

  function hexToRgb(hex) {
    var h = hex.replace('#', '');
    return [parseInt(h.substr(0, 2), 16), parseInt(h.substr(2, 2), 16), parseInt(h.substr(4, 2), 16)].join(', ');
  }

  /** Aplica acento, tamaño de texto, densidad y efectos */
  function applyAppearance() {
    var cfg = S.settings, html = document.documentElement, acc = S.ACCENTS[cfg.accent] || S.ACCENTS.iris;
    html.style.setProperty('--accent', acc.a);
    html.style.setProperty('--accent-2', acc.b);
    html.style.setProperty('--accent-rgb', hexToRgb(acc.a));
    html.style.setProperty('--accent-2-rgb', hexToRgb(acc.b));
    html.setAttribute('data-text', cfg.textSize);
    html.setAttribute('data-density', cfg.density);
    html.setAttribute('data-motion', cfg.reduceMotion ? 'reduced' : 'full');
    html.setAttribute('data-fx', cfg.bgEffects && !cfg.reduceMotion ? 'on' : 'off');
    var name = S.displayName();
    var av = document.getElementById('topAvatar');
    if (av) av.textContent = (name || 'W').charAt(0).toUpperCase();
    var b = window.WhiderAndroid;
    if (b && typeof b.setAccent === 'function') { try { b.setAccent(acc.a); } catch (e) { /* opcional */ } }
    requestAnimationFrame(W.Router.placeIndicator);
  }

  function setFab(open) {
    var f = document.getElementById('btnFab');
    if (f) f.classList.toggle('open', !!open);
  }

  function newTaskFromContext() {
    var id = S.activeScreen, preset = {};
    if (id === 'calendar') preset.date = S.ui.calSelected;
    if (id === 'tasks' && S.ui.filter === 'nodate') preset.date = null;
    if (id === 'tasks' && S.ui.filter === 'upcoming') preset.date = U.addDays(U.today(), 1);
    W.Editor.open(null, preset);
  }

  /** Atrás (Android/Escape): presentación → hojas → pantalla inicial → salir */
  function handleBack() {
    if (W.Onboarding.isOpen()) return W.Onboarding.back();
    if (W.Sheet.closeTop()) return true;
    var start = S.settings.startScreen || 'home';
    if (S.activeScreen !== start) { W.Router.go(start); return true; }
    return false;
  }

  function celebrateIfDone(reason) {
    if (reason !== 'done') return;
    var s = S.stats();
    if (s.todayTotal > 0 && s.todayDone === s.todayTotal && S.meta.celebrated !== U.today()) {
      S.setMeta('celebrated', U.today());
      setTimeout(function () {
        W.Fx.confetti();
        W.Audio.celebrate();
        W.Toast.show({ text: '¡Día completado! Todas las tareas de hoy están hechas', type: 'success', icon: 'trophy', duration: 4500 });
      }, 450);
    }
  }

  function checkAchievements(silent) {
    var seen = S.meta.seenAchievements.slice(), fresh = [];
    S.achievements().forEach(function (a) { if (a.ok && seen.indexOf(a.id) < 0) { seen.push(a.id); fresh.push(a); } });
    if (!fresh.length) return;
    S.setMeta('seenAchievements', seen);
    if (silent) return;
    fresh.forEach(function (a, i) {
      setTimeout(function () { W.Toast.show({ text: 'Logro desbloqueado: ' + a.title, type: 'success', icon: a.icon, duration: 4000 }); W.Audio.vibrate([20, 40, 20, 40, 60]); }, 900 + i * 700);
    });
  }

  function initServiceWorker() {
    if (!('serviceWorker' in navigator) || !window.isSecureContext) return;
    if (location.protocol !== 'http:' && location.protocol !== 'https:') return;
    navigator.serviceWorker.register('./sw.js').catch(function (err) { console.warn('Service Worker no registrado:', err); });
  }

  function init() {
    applyAppearance();
    checkAchievements(true);

    document.getElementById('btnFab').addEventListener('click', function () { newTaskFromContext(); });
    document.getElementById('btnProfile').addEventListener('click', function () { W.Audio.tap(); W.Router.go('progress'); });
    document.getElementById('btnAlerts').addEventListener('click', function () { W.Audio.tap(); W.Router.go('alerts'); });
    document.getElementById('btnSettings').addEventListener('click', function () { W.Audio.tap(); W.Router.go('settings'); });

    S.subscribe(function (reason) {
      if (/^settings|^profile/.test(reason)) applyAppearance();
      // En Ajustes, los propios controles ya reflejan el cambio: no se reconstruye la pantalla
      if (!(/^settings:/.test(reason) && S.activeScreen === 'settings')) W.Router.refresh();
      W.Notify.emitBadge();
      celebrateIfDone(reason);
      if (/^(done|focus)$/.test(reason)) checkAchievements(false);
    });

    window.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { handleBack(); return; }
      var tag = document.activeElement ? document.activeElement.tagName : '';
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || W.Sheet.isOpen()) return;
      if (e.key === 'n' || e.key === 'N') { e.preventDefault(); newTaskFromContext(); }
      else if (e.key === '/') { e.preventDefault(); W.Router.go('tasks'); setTimeout(function () { var i = U.$('#screen-tasks input[type=search]'); if (i) i.focus(); }, 60); }
    });

    // Refrescar fechas y avisos si la app sigue abierta al cambiar de día
    var day = U.today();
    setInterval(function () { if (U.today() !== day) { day = U.today(); W.Router.refresh(); } }, 60000);
    document.addEventListener('visibilitychange', function () { if (!document.hidden) { W.Screens.focus.resume(); W.Router.refresh(); } });

    W.Router.init(S.settings.startScreen);
    W.Notify.init();
    W.Screens.focus.resume();
    initServiceWorker();

    if (!S.meta.onboarded) setTimeout(W.Onboarding.start, 250);
    document.documentElement.classList.add('ready');
  }

  W.App = { handleBack: handleBack, setFab: setFab, applyAppearance: applyAppearance };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})(window.Whider);
