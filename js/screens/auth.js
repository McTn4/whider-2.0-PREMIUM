/**
 * WHIDER · Pantalla de acceso. WHIDER solo se usa con una cuenta de Google, Microsoft o Apple; las cuentas con correo y
 * contraseña de antes siguen pudiendo entrar (y recuperar la contraseña), pero ya no se crean nuevas.
 */
window.Whider = window.Whider || {};

(function (W) {
  'use strict';
  var U = W.U, A = function () { return W.Auth; };
  var root = null, mode = 'providers', busy = false, view = 'form';

  var GOOGLE_G = '<svg viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>';

  function setBusy(btn, on, label) {
    busy = on;
    btn.disabled = on;
    btn.classList.toggle('loading', on);
    if (label) btn.querySelector('.btn-label').textContent = label;
  }

  /** Campo de formulario dentro de un grupo (sin etiqueta visible: el marcador la indica) */
  function field(input, extra) {
    return U.el('label.cell', [input].concat(extra || []));
  }

  function privacy() {
    var sh = W.Sheet.open({ title: W.t('Privacidad'), trail: { text: 'OK', bold: true, onTap: function () { sh.close(); } }, body: [U.el('div.legal', { html: W.PRIVACY_HTML })] });
  }

  function forgot(prefill) {
    W.Sheet.prompt({ title: W.t('Recuperar contraseña'), text: W.t('Te enviaremos un enlace para crear una nueva contraseña.'), value: prefill || '', placeholder: W.t('tu@empresa.com'), maxLength: 120, ok: W.t('Enviar enlace') })
      .then(function (email) {
        if (!email) return;
        A().resetPassword(email).then(function () {
          W.Toast.show({ text: W.t('Si existe una cuenta con ese correo, recibirás el enlace en unos minutos'), type: 'success', icon: 'check', duration: 5000 });
        }).catch(function (e) { W.Toast.show({ text: A().message(e), type: 'danger' }); });
      });
  }

  var MS_LOGO = '<svg viewBox="0 0 21 21" aria-hidden="true"><rect x="1" y="1" width="9" height="9" fill="#F25022"/><rect x="11" y="1" width="9" height="9" fill="#7FBA00"/><rect x="1" y="11" width="9" height="9" fill="#00A4EF"/><rect x="11" y="11" width="9" height="9" fill="#FFB900"/></svg>';
  var APPLE_LOGO = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M16.37 12.73c-.03-2.86 2.34-4.24 2.45-4.31-1.33-1.95-3.41-2.22-4.15-2.25-1.77-.18-3.45 1.04-4.35 1.04-.9 0-2.28-1.01-3.75-.99-1.93.03-3.71 1.12-4.7 2.85-2 3.48-.51 8.62 1.44 11.44.95 1.38 2.09 2.93 3.58 2.87 1.44-.06 1.98-.93 3.72-.93 1.74 0 2.23.93 3.75.9 1.55-.03 2.53-1.4 3.47-2.79 1.1-1.6 1.55-3.15 1.57-3.23-.03-.02-3.01-1.16-3.04-4.6zM13.51 4.32c.79-.96 1.33-2.29 1.18-3.62-1.14.05-2.53.76-3.35 1.72-.73.85-1.38 2.2-1.2 3.51 1.27.1 2.57-.65 3.37-1.61z"/></svg>';
  var PROVIDERS = [
    { id: 'google.com', name: 'Google', logo: GOOGLE_G, cls: 'google' },
    { id: 'microsoft.com', name: 'Microsoft', logo: MS_LOGO, cls: 'microsoft' },
    { id: 'apple.com', name: 'Apple', logo: APPLE_LOGO, cls: 'apple' }
  ];

  function errorArea() {
    var box = U.el('div.auth-error', { attrs: { role: 'alert' } });
    // Mensaje claro + detalle técnico (útil para soporte)
    box.show = function (msg, detail) {
      U.clear(box);
      if (msg) box.appendChild(document.createTextNode(msg));
      if (msg && detail) box.appendChild(U.el('small.err-detail', { text: detail }));
      box.classList.toggle('show', !!msg);
    };
    return box;
  }

  /** Entrar con Google, Microsoft o Apple: lo único con lo que se puede usar WHIDER */
  function renderProviders() {
    var errorBox = errorArea();
    var buttons = PROVIDERS.map(function (pv) {
      var b = U.el('button.btn.block.provider-btn.' + pv.cls, { attrs: { type: 'button' } }, [
        U.el('span.spinner'), U.el('span.p-logo', { html: pv.logo }), U.el('span.btn-label', { text: W.t('Continuar con {name}', { name: pv.name }) })]);
      b.addEventListener('click', function () {
        if (busy) return;
        errorBox.show('');
        if (navigator.onLine === false) { errorBox.show(A().message({ code: 'auth/network-request-failed' })); return; }
        setBusy(b, true);
        // En el ordenador (y en Android, salvo Google) el acceso se completa en el navegador del sistema
        var inBrowser = !!window.WhiderDesktop || (!!window.WhiderAndroid && pv.id !== 'google.com');
        if (inBrowser) W.Toast.show({ text: W.t('Se ha abierto tu navegador: entra allí con {name} y vuelve a WHIDER.', { name: pv.name }), icon: 'info', duration: 20000,
          action: { label: W.t('Cancelar'), fn: function () {
            var D = window.WhiderDesktop;
            if (!D) A().cancelBrowserSignIn();
            else if (pv.id === 'google.com') D.cancelGoogle(); else if (D.cancelBrowserSignIn) D.cancelBrowserSignIn();
          } } });
        (pv.id === 'google.com' ? A().google() : A().oauth(pv.id)).catch(function (err) {
          setBusy(b, false);
          var code = err && err.code;
          if (code === 'whider/google-cancelled' || code === 'whider/browser-cancelled' || code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') return;
          errorBox.show(A().message(err), err && err.extra);
          W.Audio.vibrate([30, 40, 30]);
        }).then(function () { setBusy(b, false); });
      });
      return b;
    });
    return U.el('div.auth-card', [
      U.el('div.app-icon.sm', [U.svg('svg', { viewBox: '0 0 64 64' }, [U.svg('use', { href: '#logo' })])]),
      U.el('h1', { text: W.t('Entra en WHIDER') }),
      U.el('p.auth-sub', { text: W.t('Tus tareas, tu calendario y tus notas, guardados en tu cuenta y en todos tus dispositivos.') }),
      U.el('div.auth-providers', buttons),
      errorBox,
      U.el('p.auth-legal', W.tp('Al continuar, aceptas la {link}.', { link: U.el('button.link-btn', { text: W.t('política de privacidad'), attrs: { type: 'button' }, on: { click: privacy } }) })),
      U.el('button.link-btn.muted.auth-guest', { text: W.t('¿Tu cuenta es de correo y contraseña?'), on: { click: function () { mode = 'email'; render(); } } })
    ]);
  }

  /** Las cuentas con correo y contraseña de antes: solo entrar (ya no se crean cuentas nuevas así) */
  function renderEmail() {
    var errorBox = errorArea();
    var email = U.el('input.cell-input', { attrs: { type: 'email', autocomplete: 'email', inputmode: 'email', placeholder: W.t('Correo electrónico'), maxlength: 120, 'aria-label': W.t('Correo electrónico') } });
    var pass = U.el('input.cell-input', { attrs: { type: 'password', autocomplete: 'current-password', placeholder: W.t('Contraseña'), maxlength: 128, 'aria-label': W.t('Contraseña') } });
    var eye = U.el('button.auth-eye', { attrs: { type: 'button', 'aria-label': W.t('Mostrar contraseña') }, on: { click: function (e) {
      e.preventDefault();
      pass.type = pass.type === 'password' ? 'text' : 'password'; eye.classList.toggle('on', pass.type === 'text');
    } } }, [U.icon('eye')]);
    var submit = U.el('button.btn.primary.block.auth-submit', { attrs: { type: 'submit' } }, [U.el('span.spinner'), U.el('span.btn-label', { text: W.t('Iniciar sesión') })]);
    var form = U.el('form.auth-form', { attrs: { novalidate: true } }, [
      U.el('div.group', [field(email), field(pass, [eye])]),
      errorBox,
      submit,
      U.el('button.link-btn.auth-forgot', { text: W.t('¿Has olvidado la contraseña?'), attrs: { type: 'button' }, on: { click: function () { forgot(email.value); } } })
    ]);
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (busy) return;
      errorBox.show('');
      var em = email.value.trim(), pw = pass.value;
      if (!A().validEmail(em)) { errorBox.show(W.t('Escribe un correo válido.')); email.focus(); return; }
      if (!pw) { errorBox.show(W.t('Escribe tu contraseña.')); pass.focus(); return; }
      if (navigator.onLine === false) { errorBox.show(A().message({ code: 'auth/network-request-failed' })); return; }
      setBusy(submit, true, W.t('Iniciando sesión…'));
      // Al entrar, la app cierra esta pantalla al detectar la cuenta
      A().login(em, pw).catch(function (err) {
        setBusy(submit, false, W.t('Iniciar sesión'));
        errorBox.show(A().message(err));
        W.Audio.vibrate([30, 40, 30]);
      });
    });
    return U.el('div.auth-card', [
      U.el('div.app-icon.sm', [U.svg('svg', { viewBox: '0 0 64 64' }, [U.svg('use', { href: '#logo' })])]),
      U.el('h1', { text: W.t('Entrar con tu correo') }),
      U.el('p.auth-sub', { text: W.t('Para las cuentas que ya tenías con correo y contraseña. Las nuevas se crean con Google, Microsoft o Apple.') }),
      form,
      U.el('button.link-btn.muted.auth-guest', { text: W.t('Volver'), on: { click: function () { mode = 'providers'; render(); } } })
    ]);
  }

  function renderForm() { return mode === 'email' ? renderEmail() : renderProviders(); }

  function renderVerify() {
    var u = A().user;
    var check = U.el('button.btn.primary.block', [U.el('span.spinner'), U.el('span.btn-label', { text: W.t('Ya lo he verificado') })]);
    check.addEventListener('click', function () {
      setBusy(check, true, W.t('Comprobando…'));
      A().refresh().then(function (user) {
        setBusy(check, false, W.t('Ya lo he verificado'));
        if (user && user.emailVerified) {
          W.Toast.show({ text: W.t('Correo verificado. Tu cuenta está lista.'), type: 'success', icon: 'check' });
          if (W.Sync) W.Sync.restart();
          Screen.close(); W.App.afterAuth();
        } else W.Toast.show({ text: W.t('Aún no aparece como verificado. Abre el enlace del correo.'), type: 'danger' });
      }).catch(function (e) { setBusy(check, false, W.t('Ya lo he verificado')); W.Toast.show({ text: A().message(e), type: 'danger' }); });
    });
    return U.el('div.auth-card.verify', [
      U.icon('mail', 'verify-ic'),
      U.el('h1', { text: W.t('Verifica tu correo') }),
      U.el('p.auth-sub', W.tp('Hemos enviado un enlace de verificación a {email}. Ábrelo para activar tu cuenta y la copia en la nube.', { email: U.el('b', { text: u ? u.email : W.t('tu correo') }) })),
      check,
      U.el('button.btn.ghost.block', { text: W.t('Reenviar el correo'), on: { click: function () {
        A().resendVerification().then(function () { W.Toast.show({ text: W.t('Correo reenviado'), type: 'success', icon: 'mail' }); })
          .catch(function (e) { W.Toast.show({ text: A().message(e), type: 'danger' }); });
      } } }),
      U.el('button.link-btn.auth-guest', { text: W.t('Continuar y verificar más tarde'), on: { click: function () { Screen.close(); W.App.afterAuth(); } } }),
      U.el('button.link-btn.muted.auth-guest', { text: W.t('Usar otra cuenta'), on: { click: function () { A().logout(); view = 'form'; mode = 'providers'; render(); } } })
    ]);
  }

  function render() {
    if (!root) return;
    busy = false;
    U.clear(root);
    root.appendChild(view === 'verify' ? renderVerify() : renderForm());
    root.scrollTop = 0;
  }

  var Screen = {
    isOpen: function () { return !!root && root.classList.contains('open'); },
    open: function (opts) {
      opts = opts || {};
      root = document.getElementById('authRoot');
      if (!root) return;
      mode = opts.mode === 'email' ? 'email' : 'providers';
      view = opts.view || 'form';
      root.style.display = 'flex';
      document.body.classList.add('no-tabs');
      render();
      requestAnimationFrame(function () { root.classList.add('open'); });
    },
    showVerify: function () { view = 'verify'; if (!Screen.isOpen()) Screen.open({ view: 'verify' }); else render(); },
    close: function () {
      if (!root) return;
      root.classList.remove('open');
      document.body.classList.remove('no-tabs');
      setTimeout(function () { if (!root.classList.contains('open')) { U.clear(root); root.style.display = 'none'; } }, 450);
    },
    /** Atrás de Android: del acceso con correo se vuelve a los botones; a la app no se puede volver sin cuenta */
    back: function () {
      if (view === 'form' && mode === 'email') { mode = 'providers'; render(); return true; }
      return view === 'verify';
    }
  };

  W.AuthScreen = Screen;
})(window.Whider);
