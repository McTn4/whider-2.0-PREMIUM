/**
 * WHIDER · Presentación inicial: bienvenida, nombre y color de acento
 */
window.Whider = window.Whider || {};

(function (W) {
  'use strict';
  var U = W.U, S = function () { return W.State; };
  var root = null, step = 0, data = {};

  var FEATURES = [
    { icon: 'tasks', t: 'Tareas inteligentes', d: 'Listas, subtareas, prioridades y repeticiones.' },
    { icon: 'bell', t: 'Avisos que no fallan', d: 'Recordatorios antes del plazo y alertas si no cumples.' },
    { icon: 'timer', t: 'Modo enfoque', d: 'Sesiones Pomodoro vinculadas a tus tareas.' },
    { icon: 'trophy', t: 'Progreso y logros', d: 'Rachas, niveles y tu mapa de constancia.' }
  ];

  function close() {
    S().setMeta('onboarded', true);
    root.classList.remove('open');
    setTimeout(function () { U.clear(root); root.style.display = 'none'; }, 450);
    W.Router.go(S().settings.startScreen || 'home');
    setTimeout(function () { W.Notify.check(); }, 1500);
  }

  function render() {
    var st = S();
    U.clear(root);
    var dots = U.el('div.ob-dots', [0, 1, 2].map(function (i) { return U.el('i' + (i === step ? '.on' : '')); }));
    var body, cta;
    if (step === 0) {
      body = U.el('div.ob-body', [
        U.el('div.ob-logo', [U.svg('svg', { viewBox: '0 0 64 64' }, [U.svg('use', { href: '#logo' })])]),
        U.el('h1', [U.el('span', { text: 'Tu día,' }), U.el('br'), U.el('span.accent-text', { text: 'bajo control.' })]),
        U.el('p', { text: 'WHIDER organiza tus tareas, te avisa a tiempo y te ayuda a concentrarte.' }),
        U.el('div.ob-features', FEATURES.map(function (f) {
          return U.el('div.ob-feature', [U.el('span.row-icon', [U.icon(f.icon)]), U.el('div', [U.el('strong', { text: f.t }), U.el('span', { text: f.d })])]);
        }))
      ]);
      cta = U.el('button.btn.primary.block', { on: { click: function () { step = 1; render(); } } }, ['Empezar', U.icon('right', 'sm')]);
    } else if (step === 1) {
      var input = U.el('input.input.ob-input', { attrs: { type: 'text', maxlength: 30, placeholder: 'Tu nombre', autocomplete: 'given-name', enterkeyhint: 'next' } });
      input.value = data.name != null ? data.name : (st.displayName() || (W.Auth && W.Auth.user && W.Auth.user.displayName) || '');
      var next = function () { data.name = input.value.trim(); step = 2; render(); };
      input.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); next(); } });
      body = U.el('div.ob-body', [
        U.el('span.ob-step-ic', [U.icon('user', 'lg')]),
        U.el('h1', { text: '¿Cómo te llamas?' }),
        U.el('p', { text: 'Lo usaremos para saludarte. Solo se guarda en este dispositivo.' }),
        input
      ]);
      cta = U.el('button.btn.primary.block', { on: { click: next } }, ['Continuar', U.icon('right', 'sm')]);
      setTimeout(function () { input.focus(); }, 350);
    } else {
      body = U.el('div.ob-body', [
        U.el('span.ob-step-ic', [U.icon('palette', 'lg')]),
        U.el('h1', { text: 'Elige tu color' }),
        U.el('p', { text: 'Toda la app se adapta a él. Puedes cambiarlo cuando quieras en Ajustes.' }),
        W.UI.swatches(st.settings.accent, function (k) { st.setSetting('accent', k); }),
        U.el('div.ob-preview', [U.el('span.check.on', [U.svg('svg', { viewBox: '0 0 24 24' }, [U.svg('path', { d: 'm5 12.5 4.6 4.6L19 7.6' })])]), U.el('span', { text: 'Así se verán tus tareas completadas' })])
      ]);
      cta = U.el('button.btn.primary.block', { on: { click: function () {
        if (data.name) st.setProfile({ name: data.name });
        W.Fx.confetti();
        W.Audio.celebrate();
        close();
      } } }, ['Entrar en WHIDER', U.icon('arrow', 'sm')]);
    }
    var back = step > 0 ? U.el('button.btn.ghost.round', { attrs: { 'aria-label': 'Atrás' }, on: { click: function () { step--; render(); } } }, [U.icon('left')]) : null;
    root.appendChild(U.el('div.ob-card', [
      U.el('div.ob-top', [dots, step === 0 ? U.el('button.link-btn', { text: 'Saltar', on: { click: close } }) : null]),
      body,
      U.el('div.ob-foot', [back, cta])
    ]));
  }

  W.Onboarding = {
    isOpen: function () { return !!root && root.classList.contains('open'); },
    back: function () { if (step > 0) { step--; render(); return true; } return true; },
    start: function () {
      root = document.getElementById('onboardingRoot');
      if (!root) return;
      step = 0; data = {};
      root.style.display = 'flex';
      render();
      requestAnimationFrame(function () { root.classList.add('open'); });
    }
  };
})(window.Whider);
