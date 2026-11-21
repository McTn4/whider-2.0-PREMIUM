/**
 * WHIDER · Presentación inicial (solo la primera vez): adapta la app a quien la usa.
 *  1. Bienvenida (solo sin cuentas).
 *  2. Tu perfil: nombre y foto.
 *  3. Para qué la vas a usar (estudios, trabajo, casa, salud, con otras personas): según lo que elijas, tus
 *     categorías de partida, los ejemplos que te propone y si la pestaña Personas está en la barra.
 *  4. Avisos: si quieres que te avise a la hora de tus tareas.
 * Todo se puede cambiar después en Ajustes; «Omitir» deja la app como viene.
 */
window.Whider = window.Whider || {};

(function (W) {
  'use strict';
  var U = W.U, S = function () { return W.State; };
  var root = null, steps = [], step = 0, data = {};

  /** Usos que se pueden elegir (el orden es el de la pantalla) */
  var USES = [
    { id: 'study', icon: 'book', title: W.t('Estudios'), sub: W.t('Clases, exámenes y entregas') },
    { id: 'work', icon: 'briefcase', title: W.t('Trabajo'), sub: W.t('Reuniones, plazos y proyectos') },
    { id: 'home', icon: 'home', title: W.t('Casa y vida personal'), sub: W.t('Recados, compras y citas') },
    { id: 'health', icon: 'heart', title: W.t('Salud y deporte'), sub: W.t('Rutinas, entrenos y descanso') },
    { id: 'people', icon: 'users', title: W.t('Con otras personas'), sub: W.t('Chats, equipos y tareas compartidas') }
  ];

  /**
   * Categorías de partida según el uso. Solo con la app recién estrenada (sin tareas y sin haber tocado las
   * categorías): nunca cambia las de una cuenta que ya tiene datos.
   */
  function adaptLists(uses) {
    var st = S();
    if (st.tasks.length || st.syncMeta.listsAt) return;
    var want = { personal: true, work: uses.indexOf('work') >= 0, health: uses.indexOf('health') >= 0 };
    st.lists.slice().forEach(function (l) { if (want[l.id] === false && st.lists.length > 1) st.removeList(l.id); });
    var first = null;
    if (uses.indexOf('study') >= 0 && !st.lists.some(function (l) { return l.icon === 'book'; })) first = st.addList(W.t('Estudios'), 'iris', 'book');
    var main = first ? first.id : uses.indexOf('work') >= 0 && uses.indexOf('home') < 0 ? 'work' : 'personal';
    if (st.getList(main)) st.setSetting('defaultList', main);
  }

  function finish(skipped) {
    var st = S(), prof = st.getProfile() || {};
    var patch = {};
    if (data.name && data.name !== st.displayName()) patch.name = data.name;
    if (data.photo && data.photo !== prof.photo) patch.photo = data.photo;
    if (Object.keys(patch).length) { st.setProfile(patch); if (patch.name && W.Auth) W.Auth.updateName(patch.name); }
    if (!skipped && data.uses) {
      st.setSetting('uses', data.uses.join(','));
      // Sin «Con otras personas», la barra se queda con lo tuyo (Personas sigue en Ajustes)
      st.setSetting('peopleTab', data.uses.indexOf('people') >= 0);
      adaptLists(data.uses);
    }
    st.setMeta('onboarded', true);
    root.classList.remove('open');
    document.body.classList.remove('no-tabs');
    setTimeout(function () { U.clear(root); root.style.display = 'none'; }, 320);
    W.Router.go(st.settings.startScreen || 'home');
    if (data.notify) W.Notify.request();
    else setTimeout(function () { W.Notify.check(); }, 1500);
  }

  function next() { if (step < steps.length - 1) { step++; render(); } else finish(false); }

  function renderWelcome() {
    return [
      U.svg('svg', { viewBox: '0 0 64 64', class: 'ob-mark', 'aria-hidden': 'true' }, [U.svg('use', { href: '#logo' })]),
      U.el('h1', { text: W.t('WHIDER') }),
      U.el('p', { text: W.t('Tus tareas, tu calendario y tus notas, ordenados por lo que más importa.') })
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
      link.textContent = src ? W.t('Cambiar foto') : W.t('Añadir foto');
    };
    var input = U.el('input.cell-input.ob-input', { attrs: { type: 'text', maxlength: 30, placeholder: W.t('Tu nombre'), autocomplete: 'given-name', enterkeyhint: 'next', 'aria-label': W.t('Tu nombre') } });
    input.value = data.name;
    input.addEventListener('input', function () { data.name = input.value.trim(); if (!preview.classList.contains('has-photo')) paint(); });
    input.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); input.blur(); next(); } });
    var pick = function () { W.Profile.choosePhoto().then(function (d) { if (d) { data.photo = d; paint(); } }); };
    link.addEventListener('click', pick);
    paint();
    return [
      U.el('h1', { text: W.t('Tu perfil') }),
      U.el('p', { text: W.t('Así aparecerás en WHIDER. Puedes cambiarlo cuando quieras.') }),
      U.el('div.ob-avatar', [U.el('button.photo-pick', { attrs: { 'aria-label': W.t('Elegir foto') }, on: { click: pick } }, [preview]), link]),
      U.el('div.group', [U.el('label.cell', [input])])
    ];
  }

  /** Para qué la vas a usar (varias respuestas) */
  function renderUses() {
    if (!data.uses) data.uses = String(S().settings.uses || '').split(',').filter(Boolean);
    var rows = USES.map(function (u) {
      var on = data.uses.indexOf(u.id) >= 0;
      var b = U.el('button.ob-use' + (on ? '.on' : ''), { attrs: { type: 'button', 'aria-pressed': on ? 'true' : 'false' } }, [
        U.el('span.ob-use-ic', [U.icon(u.icon)]),
        U.el('span.ob-use-main', [U.el('b', { text: u.title }), U.el('small', { text: u.sub })]),
        U.el('span.ob-use-check', { attrs: { 'aria-hidden': 'true' } }, [U.icon('check', 'xs')])
      ]);
      b.addEventListener('click', function () {
        var i = data.uses.indexOf(u.id);
        if (i >= 0) data.uses.splice(i, 1); else data.uses.push(u.id);
        W.Audio.select();
        render();
      });
      return b;
    });
    return [
      U.el('h1', { text: W.t('¿Para qué la vas a usar?') }),
      U.el('p', { text: W.t('Elige todo lo que quieras. Con eso preparo tus categorías y lo que ves; puedes cambiarlo después.') }),
      U.el('div.ob-uses', rows)
    ];
  }

  /** Avisos: la decisión, aquí; el permiso del sistema se pide al terminar */
  function renderNotify() {
    if (data.notify == null) data.notify = true;
    var opt = function (val, icon, title, sub) {
      var on = data.notify === val;
      var b = U.el('button.ob-use' + (on ? '.on' : ''), { attrs: { type: 'button', role: 'radio', 'aria-checked': on ? 'true' : 'false' } }, [
        U.el('span.ob-use-ic', [U.icon(icon)]),
        U.el('span.ob-use-main', [U.el('b', { text: title }), U.el('small', { text: sub })]),
        U.el('span.ob-use-check', { attrs: { 'aria-hidden': 'true' } }, [U.icon('check', 'xs')])
      ]);
      b.addEventListener('click', function () { data.notify = val; W.Audio.select(); render(); });
      return b;
    };
    return [
      U.el('h1', { text: W.t('¿Te aviso?') }),
      U.el('p', { text: W.t('A la hora de cada tarea y de tus tareas de cada día. Nada más.') }),
      U.el('div.ob-uses', { attrs: { role: 'radiogroup', 'aria-label': W.t('Avisos') } }, [
        opt(true, 'bell', W.t('Sí, avísame'), W.t('Te lo pedirá el sistema al terminar')),
        opt(false, 'moon', W.t('Ahora no'), W.t('Puedes activarlos en Ajustes → Avisos'))
      ])
    ];
  }

  function render() {
    U.clear(root);
    var kind = steps[step];
    var body = kind === 'welcome' ? renderWelcome() : kind === 'uses' ? renderUses() : kind === 'notify' ? renderNotify() : renderProfile();
    var last = step === steps.length - 1;
    var cta = U.el('button.btn.primary.block', { text: last ? W.t('Empezar') : W.t('Continuar'), on: { click: function () {
      if (kind === 'profile') { var i = U.$('.ob-input', root); if (i) data.name = i.value.trim(); }
      if (last) W.Audio.success();
      next();
    } } });
    root.appendChild(U.el('div.ob-card', [
      U.el('div.ob-top', [
        step > 0 ? W.UI.navBtn({ icon: 'back', text: W.t('Atrás'), back: true, onTap: function () { step--; render(); } }) : U.el('span'),
        U.el('button.nav-btn', { text: W.t('Omitir'), on: { click: function () { finish(true); } } })
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
    USES: USES,
    isOpen: function () { return !!root && root.classList.contains('open'); },
    back: function () { if (step > 0) { step--; render(); } return true; },
    start: function () {
      root = document.getElementById('onboardingRoot');
      if (!root || W.Onboarding.isOpen()) return;   // nunca se reinicia a medias
      var accounts = W.Auth && W.Auth.configured() && !S().meta.guest;
      steps = (accounts ? [] : ['welcome']).concat(['profile', 'uses']).concat(W.Notify.permission() === 'default' ? ['notify'] : []);
      step = 0; data = {};
      root.style.display = 'flex';
      document.body.classList.add('no-tabs');
      render();
      requestAnimationFrame(function () { root.classList.add('open'); });
    }
  };
})(window.Whider);
