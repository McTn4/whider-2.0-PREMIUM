/**
 * WHIDER · Presentación inicial (solo la primera vez).
 * Con cuentas: un paso (tu perfil). Sin cuentas: bienvenida + tu perfil.
 */
window.Whider = window.Whider || {};

(function (W) {
  'use strict';
  var U = W.U, S = function () { return W.State; };
  var root = null, steps = [], step = 0, data = {};

  function finish() {
    var st = S(), prof = st.getProfile() || {};
    var patch = {};
    if (data.name && data.name !== st.displayName()) patch.name = data.name;
    if (data.photo && data.photo !== prof.photo) patch.photo = data.photo;
    if (Object.keys(patch).length) { st.setProfile(patch); if (patch.name && W.Auth) W.Auth.updateName(patch.name); }
    if (data.buddy) st.setCharacter({ name: data.buddy.name || 'Whi', body: data.buddy.body, tone: data.buddy.tone });
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
      U.svg('svg', { viewBox: '0 0 64 64', class: 'ob-mark', 'aria-hidden': 'true' }, [U.svg('use', { href: '#logo' })]),
      U.el('h1', { text: 'WHIDER' }),
      U.el('p', { text: 'Tareas, calendario, avisos y enfoque.' })
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

  /** Paso nuevo: elegir el compañero (cuerpo, tono y nombre); el resto, en el perfil */
  function renderBuddy() {
    var C = W.Character;
    if (!data.buddy) data.buddy = Object.assign({}, C.config());
    var stage = U.el('div.ob-buddy');
    var draw = function () { U.clear(stage); stage.appendChild(C.svg({ size: 150, mood: 'happy', cfg: data.buddy })); };
    var row = function (cat, ids) {
      return U.el('div.ob-pick', ids.map(function (id) {
        var cfg = Object.assign({}, data.buddy); cfg[cat] = id;
        var b = U.el('button.be-opt' + (data.buddy[cat] === id ? '.on' : ''), { attrs: { type: 'button', 'aria-label': id } }, [C.svg({ size: 52, cfg: cfg, mood: 'happy' })]);
        b.addEventListener('click', function () { data.buddy[cat] = id; W.Audio.boop(); render(); });
        return b;
      }));
    };
    var input = U.el('input.cell-input.ob-input', { attrs: { type: 'text', maxlength: 16, placeholder: 'Nombre de tu compañero', 'aria-label': 'Nombre de tu compañero' } });
    input.value = data.buddy.name || '';
    input.addEventListener('input', function () { data.buddy.name = input.value.trim(); });
    draw();
    return [
      U.el('h1', { text: 'Tu compañero' }),
      U.el('p', { text: 'Te acompaña en el día, celebra tus avances y gana objetos nuevos cuando subes de nivel.' }),
      stage,
      row('body', ['gota', 'cubo', 'capsula']),
      row('tone', ['blanco', 'perla']),
      U.el('div.group', [U.el('label.cell', [input])])
    ];
  }

  function render() {
    U.clear(root);
    var kind = steps[step];
    var body = kind === 'welcome' ? renderWelcome() : kind === 'buddy' ? renderBuddy() : renderProfile();
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
      U.el('div.ob-body' + (kind === 'welcome' ? '.welcome' : ''), body),
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
      steps = accounts ? ['profile', 'buddy'] : ['welcome', 'profile', 'buddy'];
      step = 0; data = {};
      root.style.display = 'flex';
      document.body.classList.add('no-tabs');
      render();
      requestAnimationFrame(function () { root.classList.add('open'); });
    }
  };
})(window.Whider);
