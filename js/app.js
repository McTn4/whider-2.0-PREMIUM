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

  /** Aplica tamaño de texto, densidad y animaciones (la app es en blanco y negro: no hay colores que elegir) */
  function applyAppearance() {
    var cfg = S.settings, html = document.documentElement;
    html.setAttribute('data-text', cfg.textSize);
    html.setAttribute('data-density', cfg.density);
    html.setAttribute('data-motion', cfg.reduceMotion ? 'reduced' : 'full');
    html.setAttribute('data-contrast', cfg.contrast === 'high' ? 'high' : 'normal');
    // Personalización avanzada (ordenador, Premium): contenido a todo el ancho
    html.setAttribute('data-wide', cfg.desk && cfg.desk.wide && W.Plan && W.Plan.isPremium() ? 'true' : 'false');
    // El tamaño de texto se aplica antes de pintar en el siguiente arranque
    try { localStorage.setItem('whider.ui', JSON.stringify({ t: cfg.textSize })); } catch (e) { /* opcional */ }
    W.Profile.refreshAll();
  }

  /** Pantalla de carga: se mantiene lo justo para ver cómo se traza la W */
  var splashDone = false;
  function hideSplash(now) {
    var sp = document.getElementById('splash');
    if (!sp || splashDone) return;
    var min = now ? 0 : (U.reducedMotion() ? 300 : 1500);
    setTimeout(function () {
      if (splashDone) return;
      splashDone = true;
      sp.classList.add('hide');
      setTimeout(function () { if (sp.parentNode) sp.parentNode.removeChild(sp); }, 600);
    }, Math.max(0, min - performance.now()));
  }

  /** Nueva tarea según dónde estás: el día del calendario, la lista abierta… */
  function newTaskFromContext() {
    var id = S.activeScreen, preset = {}, v = S.ui.taskView;
    if (id === 'calendar') preset.date = S.ui.calSelected;
    if (id === 'tasks' && v) {
      if (v.type === 'list') preset.listId = v.id;
      else if (v.id === 'flagged') preset.highlight = 'star';
      else if (v.id === 'scheduled' || v.id === 'today') preset.date = U.today();
    }
    W.QuickAdd.open(preset);
  }

  /**
   * Atrás (Android/Escape): menús y hojas → acceso/presentación → página anterior → pestaña inicial → salir.
   * En el ordenador, Escape no cambia de sección: solo cierra y vuelve dentro de la sección.
   */
  function handleBack(opts) {
    if (W.Files && W.Files.closePreview()) return true;
    if (W.Sheet.closeTop()) return true;
    if (W.Select && W.Select.active()) { W.Select.clear(); return true; }
    if (W.AuthScreen.isOpen()) return W.AuthScreen.back();
    if (W.Onboarding.isOpen()) return W.Onboarding.back();
    var cur = W.Screens[S.activeScreen];
    if (cur && cur.back && cur.back()) return true;
    if (S.activeScreen === 'progress') { W.Router.back(); return true; }
    if (opts && opts.keyboard && W.Layout.desktop) return false;
    var start = S.settings.startScreen || 'home';
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
        if (wasDone) dayDoneNotice();
        if (wasDone || wasFocus) W.Records.check(false);
      });
    }, 350);
  }

  /** Todo lo de hoy hecho: un aviso sobrio, una vez al día (sin celebraciones de juego) */
  function dayDoneNotice() {
    var s = S.stats();
    if (s.todayTotal > 0 && s.todayDone === s.todayTotal && S.meta.celebrated !== U.today()) {
      S.setMeta('celebrated', U.today());
      W.Audio.success();
      W.Toast.show({ text: 'Todo lo de hoy está hecho.', type: 'success', icon: 'check', duration: 3500 });
      W.Router.refresh();
    }
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
      W.Sync.start(user).then(function () {
        adoptGoogleProfile(user);
        if (W.Auth.isVerified()) {
          if (W.Invite) W.Invite.retryPending();
          if (W.People && W.People.ready()) { W.People.publish(); W.People.poll(true); }
          if (W.Chat) W.Chat.refreshList();
        }
      });
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
    // Antes de salir se sube lo pendiente (también los archivos del Cuaderno, como mucho 20 s)
    W.Sync.flush().then(function () { return W.Files ? W.Files.flush(20000) : null; }).then(function () { return W.Auth.logout(); }).catch(function () { /* se cierra igualmente */ }).then(function () {
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

  /** App de escritorio: órdenes del menú, de la bandeja y de los atajos del sistema */
  function initDesktopApp() {
    var D = window.WhiderDesktop;
    if (!D || typeof D.onCommand !== 'function') return;
    // Preferencias propias de la app (abrir al iniciar, seguir en la bandeja, versión)
    D.getSettings().then(function (p) { W.DesktopPrefs = p || {}; }).catch(function () { W.DesktopPrefs = {}; });
    D.onCommand(function (cmd) {
      if (cmd === 'new-task') { if (!W.QuickAdd.isOpen()) newTaskFromContext(); }
      else if (cmd === 'search') { if (!W.Palette.isOpen()) W.Palette.open(); }
      else if (cmd === 'settings') { if (!W.Settings.isOpen()) W.Settings.open(); }
      else if (cmd === 'shortcuts') W.Keys.help();
      else if (cmd === 'focus-toggle') W.Screens.focus.toggle();
      else if (cmd === 'new-note' || cmd === 'new-page') W.Notes.open(null);
      else if (cmd.indexOf('invite:') === 0) { if (W.Invite) W.Invite.open(cmd.slice(7)); }
      else if (cmd === 'report-pdf') { W.Router.go('reports'); setTimeout(function () { if (W.Screens.reports.pdf) W.Screens.reports.pdf(); }, 350); }
      else if (cmd === 'data') { if (!W.Settings.isOpen()) W.Settings.open('data'); }
      else if (cmd.indexOf('go:') === 0) W.Router.go(cmd.slice(3));
    });
  }

  function init() {
    if (migrateFromFileOrigin()) return;
    applyAppearance();

    S.subscribe(function (reason) {
      if (/^settings|^profile|^plan/.test(reason)) applyAppearance();
      W.Router.refresh();
      W.Notify.emitBadge();
      if (reason === 'done' || reason === 'focus') scheduleLateWork(reason);
      else if (reason === 'habit' || reason === 'notes' || reason === 'habits' || reason === 'social' || reason === 'filters' || reason === 'rules') scheduleLateWork('focus');
      if (reason === 'sync') W.Screens.focus.adoptRemote();
      if (reason === 'purge') setTimeout(function () { W.Sync.schedule(); }, 0);
      else if (reason !== 'sync') W.Sync.schedule();
    });

    W.Keys.init();
    W.Sidebar.init();
    W.Auto.init();
    W.Plan.check();
    W.People.init();
    W.Chat.init();
    W.Devices.init();
    // Los chats y las solicitudes cambian el contador de la pestaña «Más» y de la barra lateral
    W.Chat.subscribe(function (r) { if (r === 'list') { W.Notify.emitBadge(); W.Sidebar.refresh(); } });
    W.People.subscribe(function (r) { if (r === 'requests' || r === 'poll') { W.Notify.emitBadge(); W.Sidebar.refresh(); } });
    // Páginas nuevas, borradas o recuperadas: contador del Cuaderno en la barra lateral y logros
    W.Pages.subscribe(function (r) { if (r.create || r.trash || r.restore || r.destroy || r.import || r.remote) { W.Sidebar.refresh(); scheduleLateWork('focus'); } });
    // Al pasar de móvil a ordenador (o al revés) se vuelve a pintar con el otro diseño
    W.Layout.onChange(function () { W.Menu.close(); W.Router.refresh(); W.Sidebar.refresh(); });
    initDesktopApp();

    // Refrescar fechas y avisos si la app sigue abierta al cambiar de día
    var day = U.today();
    setInterval(function () { if (U.today() !== day) { day = U.today(); W.Router.refresh(); } }, 60000);
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) { S.flush(); return; }
      W.Screens.focus.resume(); W.Router.refresh();
    });

    document.getElementById('fab').addEventListener('click', function () { newTaskFromContext(); });
    var sp = document.getElementById('splash');
    if (sp) sp.addEventListener('click', function () { hideSplash(true); });

    // Una invitación en la dirección (#i=… o ?c=…): se guarda y se abre cuando la app esté lista
    if (W.Invite) W.Invite.fromLocation();
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
        idle(function () { W.Records.check(true); });
        if (accounts) { W.Auth.onChange(onUser); W.Auth.init(); }
        initServiceWorker();
        if (W.Invite) W.Invite.ready();
      }, 0);
    });
    document.documentElement.classList.add('ready');
    hideSplash();
  }

  W.App = { handleBack: handleBack, applyAppearance: applyAppearance, afterAuth: afterAuth, logout: logout, deleteAccount: deleteAccount, newTask: newTaskFromContext, hideSplash: hideSplash };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})(window.Whider);
