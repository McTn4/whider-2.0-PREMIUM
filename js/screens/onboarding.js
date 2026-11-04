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
    { icon: 'tasks', c: 'var(--accent)', t: 'Tareas y listas', d: 'Escribe «mañana a las 10» y WHIDER pone la fecha y la hora por ti.' },
    { icon: 'calendar', c: 'var(--teal)', t: 'Calendario', d: 'Mes, semana por horas y agenda, con tus tareas que se repiten.' },
    { icon: 'bell', c: 'var(--orange)', t: 'Avisos a tiempo', d: 'Recordatorios antes del plazo y aviso si algo se queda pendiente.' },
    { icon: 'chart', c: 'var(--green)', t: 'Tu progreso', d: 'Enfoque, rachas, marcas y logros que se guardan para siempre.' }
  ];

  function finish() {
    var st = S(), prof = st.getProfile() || {};
    var patch = {};
    if (data.name && data.name !== st.displayName()) patch.name = data.name;
    if (data.photo && data.photo !== prof.photo) patch.photo = data.photo;
    if (Object.keys(patch).length) { st.setProfile(patch); if (patch.name && W.Auth) W.Auth.updateName(patch.name); }
    st.setMeta('onboarded', true);
    root.classList.remove('open');
    document.body.classList.remove('no-tabs');
    setTimeout(function () { U.clear(root); root.style.display = 'none'; }, 320);
    W.Router.go(st.settings.startScreen || 'home');
    setTimeout(function () { W.Notify.check(); }, 1500);
  }

  function next() { if (step < steps.length - 1) { step++; render(); } else finish(); }

  function renderWelcome() {
    return [
      U.el('div.app-icon', [U.svg('svg', { viewBox: '0 0 64 64' }, [U.svg('use', { href: '#logo' })])]),
      U.el('h1', { text: 'Te damos la bienvenida a WHIDER' }),
      U.el('div.ob-features', FEATURES.map(function (f, i) {
        return U.el('div.ob-feature', { style: { animation: 'fade-up .45s ' + (0.08 * i + 0.1) + 's var(--ease-out) both' } }, [
          U.el('span.cell-icon', { style: { '--c': f.c } }, [U.icon(f.icon)]), U.el('div', [U.el('strong', { text: f.t }), U.el('span', { text: f.d })])]);
      }))
    ];
  }

  function renderProfile() {
    var st = S(), prof = st.getProfile() || {};
    if (data.name == null) data.name = st.displayName() || (W.Auth && W.Auth.user && W.Auth.user.displayName) || '';
    if (data.photo == null) data.photo = prof.photo || '';
    var preview = U.el('span.avatar');
    var link = U.el('button.link-btn');
    var paint = function () {
      U.clear(preview);
      var src = data.photo || prof.photoURL || '';
      preview.classList.toggle('has-photo', !!src);
      if (src) preview.appendChild(U.el('img', { attrs: { alt: '', src: src, referrerpolicy: 'no-referrer' } }));
      else preview.appendChild(document.createTextNode((data.name || 'W').charAt(0).toUpperCase()));
      link.textContent = src ? 'Cambiar foto' : 'Añadir foto';
    };
    var input = U.el('input.cell-input.ob-input', { attrs: { type: 'text', maxlength: 30, placeholder: 'Tu nombre', autocomplete: 'given-name', enterkeyhint: 'next', 'aria-label': 'Tu nombre' } });
    input.value = data.name;
    input.addEventListener('input', function () { data.name = input.value.trim(); if (!preview.classList.contains('has-photo')) paint(); });
    input.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); input.blur(); next(); } });
    var pick = function () { W.Profile.choosePhoto().then(function (d) { if (d) { data.photo = d; paint(); } }); };
    link.addEventListener('click', pick);
    paint();
    return [
      U.el('h1', { text: 'Tu perfil' }),
      U.el('p', { text: 'Así aparecerás en WHIDER. Puedes cambiarlo cuando quieras.' }),
      U.el('div.ob-avatar', [U.el('button.photo-pick', { attrs: { 'aria-label': 'Elegir foto' }, on: { click: pick } }, [preview]), link]),
      U.el('div.group', [U.el('label.cell', [input])])
    ];
  }

  /** Color de acento: la vista previa muestra controles reales, nunca tareas de ejemplo */
  function renderColor() {
    var st = S();
    var check = U.el('span.check.on');
    check.appendChild(U.svg('svg', { viewBox: '0 0 24 24' }, [U.svg('path', { d: 'm5 12.6 4.5 4.5L19 7.6' })]));
    var sw = W.UI.toggle(true, function () {}, 'Ejemplo de interruptor');
    var ring = W.Fx.ring(46, 6, .68, U.el('span', { text: '' }), 0);
    return [
      U.el('h1', { text: 'Elige un color' }),
      U.el('p', { text: 'Se usará en botones, casillas, gráficas y elementos seleccionados.' }),
      U.el('div.group', [U.el('div.cell.color-cell', [W.UI.swatches(st.settings.accent, function (k) { st.setSetting('accent', k); })])]),
      U.el('div.ob-sample', { attrs: { 'aria-hidden': 'true' } }, [check, sw, ring, U.el('span.btn.primary.sm', { text: 'WHIDER' })])
    ];
  }

  function render() {
    U.clear(root);
    var kind = steps[step];
    var body = kind === 'welcome' ? renderWelcome() : kind === 'profile' ? renderProfile() : renderColor();
    var last = step === steps.length - 1;
    var cta = U.el('button.btn.primary.block', { text: last ? 'Empezar' : 'Continuar', on: { click: function () {
      if (kind === 'profile') { var i = U.$('.ob-input', root); if (i) data.name = i.value.trim(); }
      if (last) W.Audio.success();
      next();
    } } });
    root.appendChild(U.el('div.ob-card', [
      U.el('div.ob-top', [
        step > 0 ? W.UI.navBtn({ icon: 'back', text: 'Atrás', back: true, onTap: function () { step--; render(); } }) : U.el('span'),
        U.el('button.nav-btn', { text: 'Omitir', on: { click: finish } })
      ]),
      U.el('div.ob-body', body),
      U.el('div.ob-foot', [
        steps.length > 1 ? U.el('div.ob-dots', { attrs: { 'aria-hidden': 'true' } }, steps.map(function (s, i) { return U.el('i' + (i === step ? '.on' : '')); })) : null,
        cta
      ])
    ]));
    root.scrollTop = 0;
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
      document.body.classList.add('no-tabs');
      render();
      requestAnimationFrame(function () { root.classList.add('open'); });
    }
  };
})(window.Whider);
