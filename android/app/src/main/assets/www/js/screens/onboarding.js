/**
 * WHIDER · Presentación inicial (solo la primera vez).
 * Con cuentas: 2 pasos (tu perfil y tu color). Sin cuentas: bienvenida + esos 2 pasos.
 */
window.Whider = window.Whider || {};

(function (W) {
  'use strict';
  var U = W.U, S = function () { return W.State; };
  var root = null, steps = [], step = 0, data = {};

  var FEATURES = [
    { icon: 'tasks', t: 'Tareas sin estrés', d: 'Listas, subtareas, prioridades y repeticiones.' },
    { icon: 'bell', t: 'Avisos a tiempo', d: 'Recordatorios y alertas si algo se te pasa.' },
    { icon: 'timer', t: 'Modo enfoque', d: 'Sesiones de concentración con tus tareas.' },
    { icon: 'trophy', t: 'Tus marcas', d: 'Rachas, récords y logros que no se pierden.' }
  ];

  function finish() {
    var st = S(), prof = st.getProfile() || {};
    var patch = {};
    if (data.name && data.name !== st.displayName()) patch.name = data.name;
    if (data.photo && data.photo !== prof.photo) patch.photo = data.photo;
    if (Object.keys(patch).length) { st.setProfile(patch); if (patch.name && W.Auth) W.Auth.updateName(patch.name); }
    st.setMeta('onboarded', true);
    root.classList.remove('open');
    setTimeout(function () { U.clear(root); root.style.display = 'none'; }, 350);
    W.Router.go(st.settings.startScreen || 'home');
    setTimeout(function () { W.Notify.check(); }, 1500);
  }

  function next() { if (step < steps.length - 1) { step++; render(); } else finish(); }

  function renderWelcome() {
    return [
      U.el('div.ob-logo', [U.svg('svg', { viewBox: '0 0 64 64' }, [U.svg('use', { href: '#logo' })])]),
      U.el('h1', [U.el('span', { text: 'Tu día,' }), U.el('br'), U.el('span.accent-text', { text: 'bajo control.' })]),
      U.el('div.ob-features', FEATURES.map(function (f) {
        return U.el('div.ob-feature', [U.el('span.row-icon', [U.icon(f.icon)]), U.el('div', [U.el('strong', { text: f.t }), U.el('span', { text: f.d })])]);
      }))
    ];
  }

  function renderProfile() {
    var st = S(), prof = st.getProfile() || {};
    if (data.name == null) data.name = st.displayName() || (W.Auth && W.Auth.user && W.Auth.user.displayName) || '';
    if (data.photo == null) data.photo = prof.photo || '';
    var preview = U.el('span.avatar.xl');
    var paint = function () {
      U.clear(preview);
      var src = data.photo || prof.photoURL || '';
      preview.classList.toggle('has-photo', !!src);
      if (src) preview.appendChild(U.el('img', { attrs: { alt: '', src: src, referrerpolicy: 'no-referrer' } }));
      else preview.appendChild(document.createTextNode((data.name || 'W').charAt(0).toUpperCase()));
    };
    paint();
    var input = U.el('input.input.ob-input', { attrs: { type: 'text', maxlength: 30, placeholder: 'Tu nombre', autocomplete: 'given-name', enterkeyhint: 'next' } });
    input.value = data.name;
    input.addEventListener('input', function () { data.name = input.value.trim(); if (!preview.classList.contains('has-photo')) paint(); });
    input.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); input.blur(); next(); } });
    var pick = function () { W.Profile.choosePhoto().then(function (d) { if (d) { data.photo = d; paint(); } }); };
    return [
      U.el('h1', { text: 'Tu perfil' }),
      U.el('p', { text: 'Así te verás en WHIDER. Puedes cambiarlo cuando quieras.' }),
      U.el('div.ob-avatar', [
        U.el('button.avatar-pick', { attrs: { 'aria-label': 'Elegir foto' }, on: { click: pick } }, [preview, U.el('span.avatar-cam', [U.icon('camera', 'sm')])]),
        U.el('button.link-btn', { text: data.photo || prof.photoURL ? 'Cambiar foto' : 'Añadir foto', on: { click: pick } })
      ]),
      input
    ];
  }

  function renderColor() {
    var st = S();
    return [
      U.el('h1', { text: 'Elige tu color' }),
      U.el('p', { text: 'Toda la app se adapta a él.' }),
      W.UI.swatches(st.settings.accent, function (k) { st.setSetting('accent', k); }),
      U.el('div.ob-preview', [U.el('span.check.on', [U.svg('svg', { viewBox: '0 0 24 24' }, [U.svg('path', { d: 'm5 12.5 4.6 4.6L19 7.6' })])]), U.el('span', { text: 'Así se verán tus tareas completadas' })])
    ];
  }

  function render() {
    U.clear(root);
    var kind = steps[step];
    var body = kind === 'welcome' ? renderWelcome() : kind === 'profile' ? renderProfile() : renderColor();
    var last = step === steps.length - 1;
    var cta = U.el('button.btn.primary.block', { on: { click: function () {
      if (kind === 'profile') { var i = U.$('.ob-input', root); if (i) data.name = i.value.trim(); }
      if (last) { W.Audio.celebrate(); W.Fx.confetti(); }
      next();
    } } }, [last ? 'Empezar' : 'Continuar', U.icon(last ? 'arrow' : 'right', 'sm')]);
    var dots = U.el('div.ob-dots', steps.map(function (s, i) { return U.el('i' + (i === step ? '.on' : '')); }));
    root.appendChild(U.el('div.ob-card', [
      U.el('div.ob-top', [dots, U.el('button.link-btn.muted', { text: 'Saltar', on: { click: finish } })]),
      U.el('div.ob-body', body),
      U.el('div.ob-foot', [
        step > 0 ? U.el('button.btn.ghost.round', { attrs: { 'aria-label': 'Atrás' }, on: { click: function () { step--; render(); } } }, [U.icon('left')]) : null,
        cta
      ])
    ]));
  }

  W.Onboarding = {
    isOpen: function () { return !!root && root.classList.contains('open'); },
    back: function () { if (step > 0) { step--; render(); } return true; },
    start: function () {
      root = document.getElementById('onboardingRoot');
      if (!root || W.Onboarding.isOpen()) return;   // nunca se reinicia a medias
      var accounts = W.Auth && W.Auth.configured() && !S().meta.guest;
      steps = accounts ? ['profile', 'color'] : ['welcome', 'profile', 'color'];
      step = 0; data = {};
      root.style.display = 'flex';
      render();
      requestAnimationFrame(function () { root.classList.add('open'); });
    }
  };
})(window.Whider);
