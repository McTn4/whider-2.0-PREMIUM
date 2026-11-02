/**
 * WHIDER · Arranque de la aplicación
 * La interfaz se muestra al instante con los datos locales; las cuentas y la nube
 * se cargan después, en segundo plano.
 */
window.Whider = window.Whider || {};

(function (W) {
  'use strict';
  var U = W.U, S = W.State;
  var CFG = window.WHIDER_CONFIG || {};

  function hexToRgb(hex) {
    var h = hex.replace('#', '');
    return [parseInt(h.substr(0, 2), 16), parseInt(h.substr(2, 2), 16), parseInt(h.substr(4, 2), 16)].join(', ');
  }

  /** Aplica acento, tamaño de texto, densidad y animaciones */
  function applyAppearance() {
    var cfg = S.settings, html = document.documentElement, acc = S.ACCENTS[cfg.accent] || S.ACCENTS.iris;
    html.style.setProperty('--accent', acc.a);
    html.style.setProperty('--accent-2', acc.b);
    html.style.setProperty('--accent-rgb', hexToRgb(acc.a));
    html.style.setProperty('--accent-2-rgb', hexToRgb(acc.b));
    html.setAttribute('data-text', cfg.textSize);
    html.setAttribute('data-density', cfg.density);
    html.setAttribute('data-motion', cfg.reduceMotion ? 'reduced' : 'full');
    W.Profile.refreshAll();
    requestAnimationFrame(W.Router.placeIndicator);
  }

  function setFab(open) {
    var f = document.getElementById('btnFab');
    if (f) f.classList.toggle('open', !!open);
  }

  function newTaskFromContext() {
    var id = S.activeScreen, preset = {};
    if (id === 'calendar') preset.date = S.ui.calSelected;
    if (id === 'tasks' && S.ui.tab === 'upcoming') preset.date = U.addDays(U.today(), 1);
    W.Editor.open(null, preset);
  }

  /** Atrás (Android/Escape): hojas → acceso/presentación → pantalla inicial → salir */
  function handleBack() {
    if (W.Sheet.closeTop()) return true;
    if (W.AuthScreen.isOpen()) return W.AuthScreen.back();
    if (W.Onboarding.isOpen()) return W.Onboarding.back();
    var start = S.settings.startScreen || 'home';
    if (S.activeScreen === 'settings') { W.Router.go('progress'); return true; }
    if (S.activeScreen !== start) { W.Router.go(start); return true; }
    return false;
  }

  /* ---------- Trabajo pesado fuera del toque del usuario ---------- */
  var idle = window.requestIdleCallback || function (fn) { return setTimeout(fn, 60); };
  var lateWork = { done: false, focus: false };
  function scheduleLateWork(reason) {
    if (reason === 'done') lateWork.done = true;
    if (reason === 'focus') lateWork.focus = true;
    if (lateWork.timer) return;
    lateWork.timer = setTimeout(function () {
      lateWork.timer = null;
      var wasDone = lateWork.done, wasFocus = lateWork.focus;
      lateWork.done = lateWork.focus = false;
      idle(function () {
        if (wasDone) celebrateIfDone();
        if (wasDone || wasFocus) { checkAchievements(false); W.Records.check(false); }
      });
    }, 350);
  }

  function celebrateIfDone() {
    var s = S.stats();
    if (s.todayTotal > 0 && s.todayDone === s.todayTotal && S.meta.celebrated !== U.today()) {
      S.setMeta('celebrated', U.today());
      W.Fx.confetti();
      W.Audio.celebrate();
      W.Toast.show({ text: '¡Día completado! Todo lo de hoy está hecho', type: 'success', icon: 'trophy', duration: 4000 });
    }
  }

  function checkAchievements(silent) {
    var seen = S.meta.seenAchievements.slice(), fresh = [];
    S.achievements().forEach(function (a) { if (a.ok && seen.indexOf(a.id) < 0) { seen.push(a.id); fresh.push(a); } });
    if (!fresh.length) return;
    S.setMeta('seenAchievements', seen);
    if (silent) return;
    fresh.slice(0, 2).forEach(function (a, i) {
      setTimeout(function () { W.Toast.show({ text: 'Logro desbloqueado: ' + a.title, type: 'success', icon: a.icon, duration: 3500 }); W.Audio.vibrate([20, 40, 60]); }, 600 + i * 900);
    });
  }

  /* ---------- Cuentas ---------- */
  var onboardingChecked = false;
  /** Tras entrar (o elegir modo sin cuenta): presentación solo si hace falta */
  function afterAuth() {
    var go = function () {
      if (onboardingChecked) return;
      onboardingChecked = true;
      if (!S.meta.onboarded) W.Onboarding.start();
    };
    // Con cuenta, se espera a la primera sincronización: si ya hiciste la presentación en otro
    // dispositivo, no se repite (ni se piden de nuevo nombre y color)
    if (W.Auth.user) W.Sync.firstSync().then(go); else go();
  }

  /** Datos de Google (nombre y foto) solo si el perfil no tiene ninguno; nunca pisan los tuyos */
  function adoptGoogleProfile(user) {
    var prof = S.getProfile() || {}, patch = {};
    if (!S.displayName() && user.displayName) patch.name = user.displayName;
    if (!prof.photo && !prof.photoURL && user.photoURL) patch.photoURL = user.photoURL;
    if (!prof.email && user.email) patch.email = user.email;
    if (Object.keys(patch).length) S.setProfile(patch, { stamp: false });
  }

  function onUser(user) {
    if (user) {
      var wasOpen = W.AuthScreen.isOpen();
      W.Sync.start(user).then(function () { adoptGoogleProfile(user); });
      if (wasOpen) {
        if (W.Auth.isVerified()) { W.AuthScreen.close(); afterAuth(); }
        else W.AuthScreen.showVerify();
      } else if (!onboardingChecked) afterAuth();
    } else {
      W.Sync.stop();
      // La sesión se cerró fuera de la app (caducada o revocada): se pide entrar otra vez
      if (S.meta.owner && !W.AuthScreen.isOpen()) W.AuthScreen.open({ mode: 'login' });
    }
    applyAppearance();
    W.Router.refresh();
  }

  function logout() {
    W.Sync.flush().then(function () { return W.Auth.logout(); }).catch(function () { /* se cierra igualmente */ }).then(function () {
      W.Sync.stop();
      S.clearLocal();
      onboardingChecked = false;
      applyAppearance();
      W.Router.go('home');
      W.AuthScreen.open({ mode: 'login' });
    });
  }

  function deleteAccount() {
    W.Auth.deleteAccount().then(function () {
      S.clearLocal();
      onboardingChecked = false;
      applyAppearance();
      W.Router.go('home');
      W.AuthScreen.open({ mode: 'register' });
      W.Toast.show({ text: 'Tu cuenta y sus datos se han eliminado', icon: 'trash' });
    }).catch(function (e) {
      W.Toast.show({ text: W.Auth.message(e), type: 'danger', duration: 6000 });
      if (e && e.code === 'auth/requires-recent-login') { W.Sync.restart(); logout(); }
    });
  }

  /** Android: la primera vez tras actualizar desde la versión 3, copia los datos del origen antiguo */
  function migrateFromFileOrigin() {
    var b = window.WhiderAndroid;
    if (location.protocol !== 'file:' || !b || typeof b.migrationPending !== 'function' || !b.migrationPending()) return false;
    try {
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (k && k.indexOf('whider') === 0) b.storeSet(k, localStorage.getItem(k));
      }
    } catch (e) { /* sin datos antiguos */ }
    b.migrationDone();
    return true;
  }

  function initServiceWorker() {
    if (window.WhiderAndroid) return; // En el APK la app ya se sirve desde el propio teléfono
    if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(function () { /* opcional */ });
    if (!('serviceWorker' in navigator) || !window.isSecureContext) return;
    if (location.protocol !== 'http:' && location.protocol !== 'https:') return;
    navigator.serviceWorker.register('./sw.js').catch(function (err) { console.warn('Service Worker no registrado:', err); });
  }

  function init() {
    if (migrateFromFileOrigin()) return;
    applyAppearance();

    document.getElementById('btnFab').addEventListener('click', function () { newTaskFromContext(); });
    document.getElementById('btnProfile').addEventListener('click', function () { W.Audio.tap(); W.Router.go('progress'); });
    document.getElementById('btnAlerts').addEventListener('click', function () { W.Audio.tap(); W.Router.go('alerts'); });

    S.subscribe(function (reason) {
      if (/^settings|^profile/.test(reason)) applyAppearance();
      // En Ajustes, los propios controles ya reflejan el cambio: no se reconstruye la pantalla
      if (!(/^settings:/.test(reason) && S.activeScreen === 'settings')) W.Router.refresh();
      W.Notify.emitBadge();
      if (reason === 'done' || reason === 'focus') scheduleLateWork(reason);
      if (reason !== 'sync') W.Sync.schedule();
    });

    window.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { handleBack(); return; }
      var tag = document.activeElement ? document.activeElement.tagName : '';
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || W.Sheet.isOpen()) return;
      if (e.key === 'n' || e.key === 'N') { e.preventDefault(); newTaskFromContext(); }
    });

    // Refrescar fechas y avisos si la app sigue abierta al cambiar de día
    var day = U.today();
    setInterval(function () { if (U.today() !== day) { day = U.today(); W.Router.refresh(); } }, 60000);
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) { S.flush(); return; }
      W.Screens.focus.resume(); W.Router.refresh();
    });

    W.Router.init(S.settings.startScreen);

    // Decisión inmediata (sin esperar a Firebase): quien ya tiene sesión entra directo
    var accounts = W.Auth.configured();
    if (accounts && !S.meta.owner && !S.meta.guest && CFG.requireAccount !== false) W.AuthScreen.open();
    else if (!accounts || S.meta.guest) afterAuth();

    // Lo demás, cuando la pantalla ya está pintada
    requestAnimationFrame(function () {
      setTimeout(function () {
        W.Notify.init();
        W.Screens.focus.resume();
        W.Records.init();
        idle(function () { checkAchievements(true); W.Records.check(true); });
        if (accounts) { W.Auth.onChange(onUser); W.Auth.init(); }
        initServiceWorker();
      }, 0);
    });
    document.documentElement.classList.add('ready');
  }

  W.App = { handleBack: handleBack, setFab: setFab, applyAppearance: applyAppearance, afterAuth: afterAuth, logout: logout, deleteAccount: deleteAccount };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})(window.Whider);
