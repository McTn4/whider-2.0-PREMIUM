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

  function field(label, input, extra) {
    return U.el('label.auth-field', [U.el('span', { text: label }), U.el('div.auth-input', [input].concat(extra || []))]);
  }

  function privacy() {
    W.Sheet.open({ title: 'Privacidad', body: [
      U.el('div.legal', { html:
        '<p><b>Qué guardamos.</b> Tu nombre, tu correo y los datos que creas en la app (tareas, listas, enfoque, marcas y ajustes).</p>' +
        '<p><b>Dónde.</b> En tu dispositivo y, si inicias sesión, en tu cuenta de WHIDER alojada en Google Firebase, para que puedas recuperarlos en otros dispositivos.</p>' +
        '<p><b>Para qué.</b> Solo para que la app funcione. No vendemos ni compartimos tus datos ni mostramos publicidad.</p>' +
        '<p><b>Tus derechos.</b> Puedes cerrar sesión o eliminar tu cuenta y todos sus datos en cualquier momento desde Ajustes → Cuenta.</p>' +
        '<p><b>Contraseñas.</b> WHIDER nunca ve ni guarda tu contraseña: la gestiona Firebase Authentication de forma cifrada.</p>' })
    ] });
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
    var showError = function (msg) { errorBox.textContent = msg || ''; errorBox.classList.toggle('show', !!msg); };

    var name = U.el('input.input', { attrs: { type: 'text', autocomplete: 'name', placeholder: 'Tu nombre', maxlength: 40 } });
    var email = U.el('input.input', { attrs: { type: 'email', autocomplete: 'email', inputmode: 'email', placeholder: 'tu@empresa.com', maxlength: 120 } });
    var pass = U.el('input.input', { attrs: { type: 'password', autocomplete: isReg ? 'new-password' : 'current-password', placeholder: isReg ? 'Mínimo 8 caracteres' : 'Tu contraseña', maxlength: 128 } });
    var eye = U.el('button.auth-eye', { attrs: { type: 'button', 'aria-label': 'Mostrar contraseña' }, on: { click: function () {
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
    var terms = U.el('input', { attrs: { type: 'checkbox' } });

    var submit = U.el('button.btn.primary.block.auth-submit', { attrs: { type: 'submit' } }, [U.el('span.spinner'), U.el('span.btn-label', { text: isReg ? 'Crear cuenta' : 'Entrar' })]);
    var form = U.el('form.auth-form', { attrs: { novalidate: true } }, [
      isReg ? field('Nombre', name) : null,
      field('Correo electrónico', email),
      field('Contraseña', pass, [eye]),
      isReg ? meter : null,
      isReg ? U.el('label.auth-check', [terms, U.el('span', ['Acepto la ', U.el('button.link-btn', { text: 'política de privacidad', attrs: { type: 'button' }, on: { click: privacy } })])]) : null,
      !isReg ? U.el('button.link-btn.auth-forgot', { text: '¿Has olvidado la contraseña?', attrs: { type: 'button' }, on: { click: function () { forgot(email.value); } } }) : null,
      errorBox,
      submit
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
        if (!terms.checked) { showError('Debes aceptar la política de privacidad.'); return; }
      } else if (!pw) { showError('Escribe tu contraseña.'); pass.focus(); return; }
      if (navigator.onLine === false) { showError(A().message({ code: 'auth/network-request-failed' })); return; }
      setBusy(submit, true, isReg ? 'Creando cuenta…' : 'Entrando…');
      var action = isReg ? A().register(name.value.trim(), em, pw) : A().login(em, pw);
      action.then(function () {
        if (isReg) { W.State.setProfile({ name: name.value.trim(), email: em }); view = 'verify'; render(); }
        // Al iniciar sesión, la app cierra esta pantalla al detectar el cambio de cuenta
      }).catch(function (err) {
        setBusy(submit, false, isReg ? 'Crear cuenta' : 'Entrar');
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
        if (err && (err.code === 'whider/google-cancelled' || err.code === 'auth/popup-closed-by-user')) return;
        showError(A().message(err));
      }).then(function () { setBusy(gbtn, false); });
    });

    var tabs = W.UI.segmented([{ value: 'register', label: 'Crear cuenta' }, { value: 'login', label: 'Iniciar sesión' }], mode, function (v) { mode = v; render(); });

    return U.el('div.auth-card', [
      U.el('div.auth-brand', [U.el('div.ob-logo.sm', [U.svg('svg', { viewBox: '0 0 64 64' }, [U.svg('use', { href: '#logo' })])])]),
      U.el('h1', { text: isReg ? 'Crea tu cuenta' : 'Bienvenido de nuevo' }),
      U.el('p.auth-sub', { text: isReg ? 'Tus tareas, marcas y progreso, seguros y en todos tus dispositivos.' : 'Entra para recuperar tus tareas y tus marcas.' }),
      tabs,
      gbtn,
      U.el('div.auth-divider', [U.el('span', { text: 'o con tu correo' })]),
      form,
      CFG.allowGuest !== false ? U.el('button.link-btn.auth-guest', { text: 'Continuar sin cuenta', on: { click: function () {
        W.Sheet.confirm({ title: '¿Usar sin cuenta?', icon: 'info', text: 'Tus datos se guardarán solo en este dispositivo. Puedes crear una cuenta más tarde desde Ajustes y se conservará todo.', ok: 'Continuar' })
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
          W.Toast.show({ text: '¡Correo verificado! Tu cuenta está lista', type: 'success', icon: 'shield' });
          if (W.Sync) W.Sync.restart();
          Screen.close(); W.App.afterAuth();
        } else W.Toast.show({ text: 'Aún no aparece como verificado. Abre el enlace del correo.', type: 'danger' });
      }).catch(function (e) { setBusy(check, false, 'Ya lo he verificado'); W.Toast.show({ text: A().message(e), type: 'danger' }); });
    });
    return U.el('div.auth-card.verify', [
      U.el('span.ob-step-ic', [U.icon('mail', 'lg')]),
      U.el('h1', { text: 'Verifica tu correo' }),
      U.el('p.auth-sub', ['Hemos enviado un enlace de verificación a ', U.el('b', { text: u ? u.email : 'tu correo' }), '. Ábrelo para activar tu cuenta y la copia en la nube.']),
      check,
      U.el('button.btn.ghost.block', { text: 'Reenviar correo', on: { click: function () {
        A().resendVerification().then(function () { W.Toast.show({ text: 'Correo reenviado', type: 'success', icon: 'mail' }); })
          .catch(function (e) { W.Toast.show({ text: A().message(e), type: 'danger' }); });
      } } }),
      U.el('button.link-btn.auth-guest', { text: 'Continuar y verificar más tarde', on: { click: function () { Screen.close(); W.App.afterAuth(); } } }),
      U.el('button.link-btn.auth-guest', { text: 'Usar otra cuenta', on: { click: function () { A().logout(); view = 'form'; mode = 'login'; render(); } } })
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
      render();
      requestAnimationFrame(function () { root.classList.add('open'); });
    },
    showVerify: function () { view = 'verify'; if (!Screen.isOpen()) Screen.open({ view: 'verify' }); else render(); },
    close: function () {
      if (!root) return;
      root.classList.remove('open');
      setTimeout(function () { if (!root.classList.contains('open')) { U.clear(root); root.style.display = 'none'; } }, 450);
    },
    /** Atrás de Android: en la pantalla de acceso no se puede volver a la app sin cuenta */
    back: function () { if (view === 'verify') return true; return false; }
  };

  W.AuthScreen = Screen;
})(window.Whider);
