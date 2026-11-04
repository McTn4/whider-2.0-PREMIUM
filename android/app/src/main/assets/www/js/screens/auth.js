/**
 * WHIDER · Pantalla de acceso: crear cuenta, iniciar sesión, Google,
 * recuperar contraseña y verificación del correo.
 */
window.Whider = window.Whider || {};

(function (W) {
  'use strict';
  var U = W.U, A = function () { return W.Auth; };
  var root = null, mode = 'register', busy = false, view = 'form';
  var CFG = window.WHIDER_CONFIG || {};

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
    var sh = W.Sheet.open({ title: 'Privacidad', trail: { text: 'OK', bold: true, onTap: function () { sh.close(); } }, body: [U.el('div.legal', { html: W.PRIVACY_HTML })] });
  }

  function forgot(prefill) {
    W.Sheet.prompt({ title: 'Recuperar contraseña', text: 'Te enviaremos un enlace para crear una nueva contraseña.', value: prefill || '', placeholder: 'tu@empresa.com', maxLength: 120, ok: 'Enviar enlace' })
      .then(function (email) {
        if (!email) return;
        A().resetPassword(email).then(function () {
          W.Toast.show({ text: 'Si existe una cuenta con ese correo, recibirás el enlace en unos minutos', type: 'success', icon: 'check', duration: 5000 });
        }).catch(function (e) { W.Toast.show({ text: A().message(e), type: 'danger' }); });
      });
  }

  function renderForm() {
    var isReg = mode === 'register';
    var errorBox = U.el('div.auth-error', { attrs: { role: 'alert' } });
    // Mensaje claro + detalle técnico (útil para soporte)
    var showError = function (msg, detail) {
      U.clear(errorBox);
      if (msg) errorBox.appendChild(document.createTextNode(msg));
      if (msg && detail) errorBox.appendChild(U.el('small.err-detail', { text: detail }));
      errorBox.classList.toggle('show', !!msg);
    };

    var name = U.el('input.cell-input', { attrs: { type: 'text', autocomplete: 'name', placeholder: 'Nombre', maxlength: 40, 'aria-label': 'Nombre' } });
    var email = U.el('input.cell-input', { attrs: { type: 'email', autocomplete: 'email', inputmode: 'email', placeholder: 'Correo electrónico', maxlength: 120, 'aria-label': 'Correo electrónico' } });
    var pass = U.el('input.cell-input', { attrs: { type: 'password', autocomplete: isReg ? 'new-password' : 'current-password', placeholder: isReg ? 'Contraseña (mínimo 8 caracteres)' : 'Contraseña', maxlength: 128, 'aria-label': 'Contraseña' } });
    var eye = U.el('button.auth-eye', { attrs: { type: 'button', 'aria-label': 'Mostrar contraseña' }, on: { click: function (e) {
      e.preventDefault();
      pass.type = pass.type === 'password' ? 'text' : 'password'; eye.classList.toggle('on', pass.type === 'text');
    } } }, [U.icon('eye')]);
    var meter = U.el('div.pw-meter', [U.el('i'), U.el('i'), U.el('i'), U.el('i'), U.el('span')]);
    var LABELS = ['Muy débil', 'Débil', 'Aceptable', 'Buena', 'Excelente'];
    pass.addEventListener('input', function () {
      if (!isReg) return;
      var sc = pass.value ? A().passwordScore(pass.value) : -1;
      U.$$('i', meter).forEach(function (b, i) { b.className = i <= sc - 1 || (sc === 0 && i === 0 && pass.value) ? 'on s' + sc : ''; });
      meter.lastChild.textContent = pass.value ? LABELS[sc] : '';
    });
    var accepted = false;
    var terms = U.el('button.check', { attrs: { type: 'button', role: 'checkbox', 'aria-checked': 'false', 'aria-label': 'Acepto la política de privacidad' }, on: { click: function () {
      accepted = !accepted; terms.classList.toggle('on', accepted); terms.setAttribute('aria-checked', accepted ? 'true' : 'false'); W.Audio.select();
    } } });
    terms.appendChild(U.svg('svg', { viewBox: '0 0 24 24' }, [U.svg('path', { d: 'm5 12.6 4.5 4.5L19 7.6' })]));

    var submit = U.el('button.btn.primary.block.auth-submit', { attrs: { type: 'submit' } }, [U.el('span.spinner'), U.el('span.btn-label', { text: isReg ? 'Crear cuenta' : 'Iniciar sesión' })]);
    var form = U.el('form.auth-form', { attrs: { novalidate: true } }, [
      U.el('div.group', [isReg ? field(name) : null, field(email), field(pass, [eye])]),
      isReg ? meter : null,
      isReg ? U.el('div.auth-check', [terms, U.el('span', ['Acepto la ', U.el('button.link-btn', { text: 'política de privacidad', attrs: { type: 'button' }, on: { click: privacy } })])]) : null,
      errorBox,
      submit,
      !isReg ? U.el('button.link-btn.auth-forgot', { text: '¿Has olvidado la contraseña?', attrs: { type: 'button' }, on: { click: function () { forgot(email.value); } } }) : null
    ]);

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (busy) return;
      showError('');
      var em = email.value.trim(), pw = pass.value;
      if (isReg && !name.value.trim()) { showError('Escribe tu nombre.'); name.focus(); return; }
      if (!A().validEmail(em)) { showError('Escribe un correo válido.'); email.focus(); return; }
      if (isReg && !A().domainAllowed(em)) { showError(A().message({ code: 'whider/domain', extra: (CFG.allowedEmailDomains || []).join(', ') })); email.focus(); return; }
      if (isReg) {
        var prob = A().passwordProblem(pw);
        if (prob) { showError(prob); pass.focus(); return; }
        if (!accepted) { showError('Debes aceptar la política de privacidad.'); return; }
      } else if (!pw) { showError('Escribe tu contraseña.'); pass.focus(); return; }
      if (navigator.onLine === false) { showError(A().message({ code: 'auth/network-request-failed' })); return; }
      setBusy(submit, true, isReg ? 'Creando cuenta…' : 'Iniciando sesión…');
      var action = isReg ? A().register(name.value.trim(), em, pw) : A().login(em, pw);
      action.then(function () {
        if (isReg) { W.State.setProfile({ name: name.value.trim(), email: em }); view = 'verify'; render(); }
        // Al iniciar sesión, la app cierra esta pantalla al detectar el cambio de cuenta
      }).catch(function (err) {
        setBusy(submit, false, isReg ? 'Crear cuenta' : 'Iniciar sesión');
        showError(A().message(err));
        W.Audio.vibrate([30, 40, 30]);
      });
    });

    var gbtn = U.el('button.btn.block.google-btn', { attrs: { type: 'button' } }, [U.el('span.g-logo', { html: GOOGLE_G }), U.el('span.btn-label', { text: 'Continuar con Google' })]);
    gbtn.addEventListener('click', function () {
      if (busy) return;
      showError('');
      if (navigator.onLine === false) { showError(A().message({ code: 'auth/network-request-failed' })); return; }
      setBusy(gbtn, true);
      A().google().catch(function (err) {
        setBusy(gbtn, false);
        if (err && (err.code === 'whider/google-cancelled' || err.code === 'auth/popup-closed-by-user' || err.code === 'auth/cancelled-popup-request')) return;
        showError(A().message(err), err && err.extra);
        W.Audio.vibrate([30, 40, 30]);
      }).then(function () { setBusy(gbtn, false); });
    });

    var tabs = W.UI.segmented([{ value: 'register', label: 'Crear cuenta' }, { value: 'login', label: 'Iniciar sesión' }], mode, function (v) { mode = v; render(); });

    return U.el('div.auth-card', [
      U.el('div.app-icon.sm', [U.svg('svg', { viewBox: '0 0 64 64' }, [U.svg('use', { href: '#logo' })])]),
      U.el('h1', { text: isReg ? 'Crea tu cuenta' : 'Inicia sesión' }),
      U.el('p.auth-sub', { text: isReg ? 'Tus tareas, marcas y progreso, seguros y en todos tus dispositivos.' : 'Recupera tus tareas y tus marcas en este dispositivo.' }),
      tabs,
      gbtn,
      U.el('div.auth-divider', [U.el('span', { text: 'o con tu correo' })]),
      form,
      CFG.allowGuest !== false ? U.el('button.link-btn.muted.auth-guest', { text: 'Continuar sin cuenta', on: { click: function () {
        W.Sheet.confirm({ title: '¿Usar WHIDER sin cuenta?', text: 'Tus datos se guardarán solo en este dispositivo. Puedes crear una cuenta más tarde desde Ajustes y se conservará todo.', ok: 'Continuar' })
          .then(function (ok) { if (ok) { W.State.setMeta('guest', true); Screen.close(); W.App.afterAuth(); } });
      } } }) : null
    ]);
  }

  function renderVerify() {
    var u = A().user;
    var check = U.el('button.btn.primary.block', [U.el('span.spinner'), U.el('span.btn-label', { text: 'Ya lo he verificado' })]);
    check.addEventListener('click', function () {
      setBusy(check, true, 'Comprobando…');
      A().refresh().then(function (user) {
        setBusy(check, false, 'Ya lo he verificado');
        if (user && user.emailVerified) {
          W.Toast.show({ text: 'Correo verificado. Tu cuenta está lista.', type: 'success', icon: 'check' });
          if (W.Sync) W.Sync.restart();
          Screen.close(); W.App.afterAuth();
        } else W.Toast.show({ text: 'Aún no aparece como verificado. Abre el enlace del correo.', type: 'danger' });
      }).catch(function (e) { setBusy(check, false, 'Ya lo he verificado'); W.Toast.show({ text: A().message(e), type: 'danger' }); });
    });
    return U.el('div.auth-card.verify', [
      U.icon('mail', 'verify-ic'),
      U.el('h1', { text: 'Verifica tu correo' }),
      U.el('p.auth-sub', ['Hemos enviado un enlace de verificación a ', U.el('b', { text: u ? u.email : 'tu correo' }), '. Ábrelo para activar tu cuenta y la copia en la nube.']),
      check,
      U.el('button.btn.ghost.block', { text: 'Reenviar el correo', on: { click: function () {
        A().resendVerification().then(function () { W.Toast.show({ text: 'Correo reenviado', type: 'success', icon: 'mail' }); })
          .catch(function (e) { W.Toast.show({ text: A().message(e), type: 'danger' }); });
      } } }),
      U.el('button.link-btn.auth-guest', { text: 'Continuar y verificar más tarde', on: { click: function () { Screen.close(); W.App.afterAuth(); } } }),
      U.el('button.link-btn.muted.auth-guest', { text: 'Usar otra cuenta', on: { click: function () { A().logout(); view = 'form'; mode = 'login'; render(); } } })
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
      mode = opts.mode || (W.State.isNewUser ? 'register' : 'login');
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
    /** Atrás de Android: en la pantalla de acceso no se puede volver a la app sin cuenta */
    back: function () { if (view === 'verify') return true; return false; }
  };

  W.AuthScreen = Screen;
})(window.Whider);
