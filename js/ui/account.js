/**
 * WHIDER · Tu cuenta: la foto de perfil (y tu nombre, en el ordenador) es la entrada a todo lo tuyo; ya no hay
 * engranaje. Al tocarla se abre un menú con tu cuenta, unos interruptores rápidos, los ajustes, la ayuda y «Cerrar
 * sesión»: en el ordenador, un panel amplio que baja desde la barra superior; en el móvil, una hoja.
 * Si hay cambios sin subir a la nube, la foto lleva un punto (y lo dice al lector de pantalla).
 */
window.Whider = window.Whider || {};

(function (W) {
  'use strict';
  var U = W.U, S = function () { return W.State; };
  var open = null;   // { close } del panel o la hoja abiertos

  function unsaved() { return !!(W.Sync && W.Sync.unsaved && W.Sync.unsaved()); }
  /** Lo que dice el lector de pantalla del botón de la foto (y su texto al pasar el ratón) */
  function label() { return unsaved() ? W.t('Tu cuenta y tus ajustes (hay cambios sin guardar en la nube)') : W.t('Tu cuenta y tus ajustes'); }
  function name() {
    var u = W.Auth && W.Auth.user;
    return S().displayName() || (u && u.displayName) || W.t('Tu perfil');
  }
  /** La foto, con el punto de «cambios sin subir» (decorativa: el botón ya dice qué es) */
  function photo(size) { return U.el('span.me-av', { attrs: { 'aria-hidden': 'true' } }, [W.Profile.avatar(size)]); }

  /** Cierra el menú y después hace lo elegido (abrir unos ajustes, la ayuda…) */
  function go(fn) {
    Account.close();
    setTimeout(fn, W.Layout && W.Layout.desktop ? 0 : 280);
  }
  function setting(page) { return function () { W.Settings.open(page); }; }

  function isDark() { return document.documentElement.getAttribute('data-theme') !== 'light'; }

  /** Lo que hay dentro, igual en el panel y en la hoja */
  function content(desk) {
    var st = S(), cfg = st.settings, A = W.Auth, u = A && A.user;
    var prov = u && A.providerName ? A.providerName() : null;
    var who = u ? (prov ? W.t('Cuenta de {name}', { name: prov }) : W.t('Cuenta')) + (u.email ? ' · ' + u.email : '') : W.t('Nombre y foto');
    var sync = u && W.Sync && W.Sync.statusText ? W.Sync.statusText() : '';
    var head = U.el('button.acct-head', { attrs: { type: 'button' }, on: { click: function () { go(u ? setting('account') : function () { W.Profile.edit(); }); } } }, [
      photo('lg'),
      U.el('span.acct-who', [
        U.el('strong', { text: name() }),
        U.el('small', { text: who }),
        sync ? U.el('small.acct-sync' + (unsaved() ? '.warn' : ''), { text: sync }) : null
      ]),
      U.icon('chev', 'chev')
    ]);

    var toggle = function (icon, title, value, fn) {
      return W.UI.cell({ icon: icon, title: title, right: W.UI.toggle(value, fn, title) });
    };
    var quick = [
      toggle('moon', W.t('Tema oscuro'), isDark(), function (v) { st.setSetting('theme', v ? 'dark' : 'light'); }),
      toggle('sound', W.t('Sonidos'), !!cfg.sound, function (v) { st.setSetting('sound', v); if (v) W.Audio.success(); }),
      desk && cfg.desk ? toggle('monitor', W.t('Contenido a todo el ancho'), !!cfg.desk.wide, function (v) { cfg.desk.wide = v; st.saveSettings('settings:desk'); }) : null,
      !desk && window.WhiderAndroid ? toggle('vibrate', W.t('Vibración'), !!cfg.vibrate, function (v) { st.setSetting('vibrate', v); if (v) W.Audio.vibrate([20]); }) : null
    ].filter(Boolean);

    var item = function (icon, title, fn, value) {
      return W.UI.cell({ icon: icon, title: title, value: value, onTap: function (e, node) { if (fn.anchored) fn(node); else go(fn); } });
    };
    var lang = function (node) { W.Settings.chooseLang(node && node.querySelector('.cell-value')); };
    lang.anchored = true;
    var settings = [
      item('type', W.t('Apariencia'), setting('appearance')),
      item('bell', W.t('Avisos'), setting('alerts')),
      item('globe', W.t('Idioma'), lang, W.Settings.langName()),
      item('tasks', W.t('Tareas y categorías'), setting('tasks')),
      item('calendar', W.t('Calendarios suscritos'), setting('calendars')),
      item('sliders', W.t('Lo que ves'), setting('custom')),
      item('shield', W.t('Datos y copias'), setting('data')),
      item('hand', W.t('Privacidad'), setting('privacy'))
    ];
    var help = [
      item('book', W.t('Preguntas frecuentes'), function () { W.Help.faq(); }),
      item('star', W.t('Novedades'), function () { W.WhatsNew.open(); }),
      item('send', W.t('Enviar comentarios'), function () { W.Help.feedback(); }),
      desk ? item('keyboard', W.t('Atajos de teclado'), function () { W.Keys.help(); }, '?') : null
    ].filter(Boolean);

    var foot = U.el('div.acct-foot', [
      U.el('button.btn.soft.sm.acct-all', { text: W.t('Todos los ajustes'), attrs: { type: 'button', title: desk ? W.t('Todos los ajustes · {0}', { 0: W.Layout.keys(',') }) : null }, on: { click: function () { go(setting(null)); } } }),
      u ? U.el('button.btn.ghost.sm.acct-out', { text: W.t('Cerrar sesión'), attrs: { type: 'button' }, on: { click: function () {
        go(function () {
          W.Sheet.confirm({ title: W.t('¿Cerrar sesión?'), text: W.t('Tus datos quedan guardados en tu cuenta.'), ok: W.t('Cerrar sesión'), danger: true })
            .then(function (ok) { if (ok) W.App.logout(); });
        });
      } } }) : null
    ]);
    var version = U.el('p.acct-version', { text: W.t('WHIDER {0}', { 0: W.WhatsNew ? W.WhatsNew.label(W.VERSION) : String(W.VERSION || '') }) });

    var sec = function (header, items) { return W.UI.section({ header: header, items: items }); };
    if (!desk) return [U.el('div.group', [head]), sec(W.t('Rápido'), quick), sec(W.t('Ajustes'), settings), sec(W.t('Ayuda'), help), foot, version];
    // En el ordenador, a lo ancho y en dos columnas (así cabe entero): lo rápido y la ayuda, y los ajustes
    return [
      head,
      U.el('div.acct-cols', [U.el('div', [sec(W.t('Rápido'), quick), sec(W.t('Ayuda'), help)]), U.el('div', [sec(W.t('Ajustes'), settings)])]),
      foot, version
    ];
  }

  var Account = {
    /** La foto de la barra superior del móvil */
    button: function () {
      var b = U.el('button.me-btn', { attrs: { type: 'button', 'aria-label': label(), title: label(), 'aria-haspopup': 'true' } }, [photo()]);
      b.addEventListener('click', function () { Account.open(b); });
      return b;
    },
    /**
     * Tu foto y tu nombre, arriba a la derecha en el ordenador. Su nombre para el lector de pantalla es el que se ve
     * (tu nombre), más el aviso de cambios sin subir; lo demás, en su descripción (se repinta al cambiar la nube).
     */
    topButton: function () {
      var b = U.el('button.tb-me.me-btn', { attrs: { type: 'button', title: label(), 'aria-haspopup': 'true' } }, [
        photo(), U.el('span.tb-name', { text: name() }),
        unsaved() ? U.el('span.sr-only', { text: ' · ' + W.t('hay cambios sin guardar en la nube') }) : null
      ]);
      b.addEventListener('click', function () { Account.open(b); });
      return b;
    },
    open: function (anchor) {
      if (open) { Account.close(); return; }
      var desk = !!(W.Layout && W.Layout.desktop);
      if (desk && W.Menu.panel) {
        var api = W.Menu.panel(anchor, U.el('div.acct-panel', content(true)), { title: W.t('Tu cuenta'), cls: 'acct-pop', onClose: function () { if (open === api) open = null; } });
        open = api;
        return;
      }
      var sheet = W.Sheet.open({ title: W.t('Tu cuenta'), className: 'acct-sheet', body: content(false), onClose: function () { if (open === sheet) open = null; } });
      open = sheet;
    },
    close: function () {
      var o = open; open = null;
      if (o) o.close();
    },
    isOpen: function () { return !!open; },
    label: label,
    /** Al cambiar el estado de la nube: lo que dicen los botones de tu foto */
    refreshLabels: function () {
      U.$$('.me-btn').forEach(function (b) {
        if (!b.classList.contains('tb-me')) b.setAttribute('aria-label', label());
        b.setAttribute('title', label());
      });
    }
  };

  W.AccountMenu = Account;
})(window.Whider);
