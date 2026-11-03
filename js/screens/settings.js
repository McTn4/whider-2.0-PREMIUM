/**
 * WHIDER · Ajustes: hoja con páginas (como los ajustes del sistema), abierta desde
 * la foto de perfil. Perfil y cuenta arriba; cada apartado abre su propia página.
 */
window.Whider = window.Whider || {};

(function (W) {
  'use strict';
  var U = W.U, S = function () { return W.State; };
  var VERSION = '4.2';
  var SCREENS = [
    { value: 'home', label: 'Hoy' }, { value: 'tasks', label: 'Tareas' }, { value: 'calendar', label: 'Calendario' },
    { value: 'focus', label: 'Enfoque' }, { value: 'progress', label: 'Resumen' }
  ];
  var REWARN = [{ value: 0, label: 'Solo una vez' }, { value: 10, label: 'Cada 10 minutos' }, { value: 20, label: 'Cada 20 minutos' }, { value: 60, label: 'Cada hora' }];
  var TEXT = [{ value: 's', label: 'Pequeño' }, { value: 'm', label: 'Normal' }, { value: 'l', label: 'Grande' }, { value: 'xl', label: 'Enorme' }];

  function labelOf(arr, v) { for (var i = 0; i < arr.length; i++) if (arr[i].value === v) return arr[i].label; return ''; }
  /** Celda con menú: muestra el valor y al tocarla abre las opciones junto a él */
  function menuCell(o, nav) {
    return W.UI.cell({ icon: o.icon, color: o.color, title: o.title, value: labelOf(o.options, o.value), onTap: function (e, node) {
      W.Menu.choose(node.querySelector('.cell-value'), { value: o.value, options: o.options }).then(function (v) {
        if (v !== undefined && v !== o.value) { o.onChange(v); nav.refresh(); }
      });
    } });
  }
  function toggleCell(o) {
    return W.UI.cell({ icon: o.icon, color: o.color, title: o.title, sub: o.sub, right: W.UI.toggle(o.value, o.onChange, o.title) });
  }
  function timePill(value, onChange) {
    var pill = U.el('span.pill.accent', { text: U.fmtTime(value) });
    var input = U.el('input.overlay-input', { attrs: { type: 'time', 'aria-label': 'Hora' } });
    input.value = value;
    input.addEventListener('change', function () { if (input.value) { pill.firstChild.textContent = U.fmtTime(input.value); onChange(input.value); } });
    input.addEventListener('click', function () { try { if (input.showPicker) input.showPicker(); } catch (e) { /* lo abre el sistema */ } });
    pill.appendChild(input);
    return pill;
  }

  /* ---------- Páginas ---------- */
  function rootPage(nav) {
    var st = S(), cfg = st.settings, A = W.Auth, u = A && A.user, accounts = A && A.configured();
    var name = st.displayName();
    var profileCell = W.UI.cell({
      lead: W.Profile.avatar('lg'), cls: 'profile-cell',
      title: name || (u ? u.displayName || 'Tu cuenta' : 'Tu perfil'),
      sub: u ? 'Cuenta, copia en la nube y perfil' : accounts ? 'Inicia sesión para guardar tus datos en la nube' : 'Nombre y foto',
      onTap: function () {
        if (u) nav.push(accountPage);
        else if (accounts) { nav.close(); W.AuthScreen.open({ mode: 'register' }); }
        else W.Profile.edit(function () { nav.refresh(); });
      }
    });
    return {
      title: 'Ajustes',
      body: [
        U.el('div.group', [profileCell]),
        W.UI.group([
          W.UI.cell({ icon: 'palette', color: 'var(--blue)', title: 'Apariencia', value: st.ACCENTS[cfg.accent].name, onTap: function () { nav.push(appearancePage); } }),
          W.UI.cell({ icon: 'tasks', color: 'var(--orange)', title: 'Tareas y listas', onTap: function () { nav.push(tasksPage); } }),
          W.UI.cell({ icon: 'bell', color: 'var(--red)', title: 'Avisos y sonido', onTap: function () { nav.push(alertsPage); } }),
          W.UI.cell({ icon: 'timer', color: 'var(--indigo)', title: 'Enfoque', value: cfg.focus.work + ' min', onTap: function () { nav.push(focusPage); } }),
          W.UI.cell({ icon: 'home', color: 'var(--gray-2)', title: 'Pantalla al abrir', value: labelOf(SCREENS, cfg.startScreen), onTap: function () { nav.push(startPage); } })
        ]),
        W.UI.group([
          W.UI.cell({ icon: 'hand', color: 'var(--blue)', title: 'Privacidad', onTap: function () { nav.push(privacyPage); } }),
          W.UI.cell({ icon: 'shield', color: 'var(--gray-2)', title: 'Datos', onTap: function () { nav.push(dataPage); } })
        ]),
        U.el('p.version', { text: 'WHIDER ' + VERSION })
      ]
    };
  }

  function accountPage(nav) {
    var A = W.Auth, u = A.user, st = S();
    if (!u) return rootPage(nav);
    var verified = A.isVerified();
    var syncCell = W.UI.cell({ icon: 'cloud', color: 'var(--blue)', title: 'Copia en la nube', sub: W.Sync.statusText(), onTap: function () {
      if (!verified) { nav.close(); W.AuthScreen.showVerify(); return; }
      W.Sync.push().then(function () { nav.refresh(); });
    } });
    var rows = [syncCell];
    if (!verified) rows.push(W.UI.cell({ icon: 'mail', color: 'var(--orange)', title: 'Verificar el correo', sub: 'Abre el enlace que te enviamos', onTap: function () { nav.close(); W.AuthScreen.showVerify(); } }));
    if (A.provider() === 'password') rows.push(W.UI.cell({ icon: 'key', color: 'var(--gray-2)', title: 'Cambiar la contraseña', onTap: function () {
      A.resetPassword(u.email).then(function () { W.Toast.show({ text: 'Te hemos enviado un enlace a ' + u.email, type: 'success', icon: 'mail' }); })
        .catch(function (e) { W.Toast.show({ text: A.message(e), type: 'danger' }); });
    } }));
    return {
      title: 'Cuenta',
      body: [
        U.el('div.profile-head', [W.Profile.avatar('xl'), U.el('strong', { text: st.displayName() || u.displayName || 'Tu cuenta' }), U.el('span', { text: u.email || '' }),
          U.el('button.link-btn', { text: 'Editar nombre y foto', on: { click: function () { W.Profile.edit(function () { nav.refresh(); }); } } })]),
        W.UI.section({ items: rows, footer: A.provider() === 'google' ? 'Has iniciado sesión con Google.' : verified ? 'Tus datos se guardan en tu cuenta y en este dispositivo.' : null }),
        W.UI.group([W.UI.cell({ title: 'Cerrar sesión', center: true, danger: true, onTap: function () {
          W.Sheet.confirm({ title: '¿Cerrar sesión?', text: 'Tus datos quedan guardados en tu cuenta.', ok: 'Cerrar sesión', danger: true })
            .then(function (ok) { if (ok) { nav.close(); W.App.logout(); } });
        } })]),
        W.UI.section({ items: [W.UI.cell({ title: 'Eliminar la cuenta', center: true, danger: true, onTap: function () {
          W.Sheet.confirm({ title: '¿Eliminar tu cuenta?', text: 'Se borrarán tu cuenta y todos sus datos de la nube. No se puede deshacer.', ok: 'Eliminar', danger: true })
            .then(function (ok) { if (ok) { nav.close(); W.App.deleteAccount(); } });
        } })], footer: 'Se borra la cuenta y todo lo que contiene, también en otros dispositivos.' })
      ]
    };
  }

  function appearancePage(nav) {
    var st = S(), cfg = st.settings, set = st.setSetting;
    return {
      title: 'Apariencia',
      body: [
        W.UI.section({ header: 'Color de acento', items: [U.el('div.cell.color-cell', [W.UI.swatches(cfg.accent, function (k) { set('accent', k); })])],
          footer: 'Se usa en los botones, las casillas y los elementos seleccionados.' }),
        W.UI.section({ header: 'Tamaño del texto', items: U.el('div', [W.UI.segmented(TEXT, cfg.textSize, function (v) { set('textSize', v); })]) }),
        W.UI.section({ header: 'Densidad', items: U.el('div', [W.UI.segmented([{ value: 'comfortable', label: 'Cómoda' }, { value: 'compact', label: 'Compacta' }], cfg.density, function (v) { set('density', v); })]) }),
        W.UI.section({ items: [toggleCell({ title: 'Reducir movimiento', value: cfg.reduceMotion, onChange: function (v) { set('reduceMotion', v); } })],
          footer: 'Quita las transiciones y animaciones de la interfaz.' })
      ]
    };
  }

  function tasksPage(nav) {
    var st = S(), cfg = st.settings, set = st.setSetting;
    var lists = st.lists.map(function (l) { return { value: l.id, label: l.name, color: st.ACCENTS[l.color].a }; });
    return {
      title: 'Tareas y listas',
      body: [
        W.UI.group([
          W.UI.cell({ icon: 'list', color: 'var(--orange)', title: 'Listas', value: String(st.lists.length), onTap: function () { nav.push(listsPage); } }),
          menuCell({ icon: 'tray', color: 'var(--gray-2)', title: 'Lista por defecto', value: cfg.defaultList, options: lists, onChange: function (v) { set('defaultList', v); } }, nav)
        ]),
        W.UI.section({ items: [toggleCell({ icon: 'trash', color: 'var(--red)', title: 'Confirmar antes de eliminar', value: cfg.confirmDelete, onChange: function (v) { set('confirmDelete', v); } })],
          footer: 'Al deslizar para eliminar siempre puedes deshacer.' }),
        W.UI.group([
          menuCell({ icon: 'calendar', color: 'var(--red)', title: 'La semana empieza el', value: cfg.weekStart, options: [{ value: 1, label: 'Lunes' }, { value: 0, label: 'Domingo' }], onChange: function (v) { set('weekStart', v); } }, nav),
          menuCell({ icon: 'clock', color: 'var(--blue)', title: 'Formato de hora', value: cfg.timeFormat, options: [{ value: '24', label: '24 horas' }, { value: '12', label: '12 horas' }], onChange: function (v) { set('timeFormat', v); } }, nav)
        ])
      ]
    };
  }

  function listsPage(nav) {
    var st = S();
    var rows = st.lists.map(function (l) {
      var n = st.tasks.filter(function (t) { return t.listId === l.id && !t.done; }).length;
      return W.UI.cell({ lead: W.UI.listIcon(st.ACCENTS[l.color].a), title: l.name, value: U.el('span.list-count', { text: n }), onTap: function () {
        W.Lists.edit(l, function () { nav.refresh(); }, function () { nav.refresh(); });
      } });
    });
    rows.push(W.UI.cell({ lead: U.el('span.cell-icon.round', { style: { '--c': 'var(--fill)', color: 'var(--accent)' } }, [U.icon('plus')]), title: 'Nueva lista', accent: true, chevron: false,
      onTap: function () { W.Lists.edit(null, function () { nav.refresh(); }); } }));
    return { title: 'Listas', body: [W.UI.section({ items: rows, footer: 'Toca una lista para cambiar su nombre o su color, o para eliminarla.' })] };
  }

  function alertsPage(nav) {
    var st = S(), cfg = st.settings, set = st.setSetting, q = cfg.quietHours;
    var perm = W.Notify.permission();
    var permText = { granted: 'Activadas', denied: 'Bloqueadas', unsupported: 'No disponibles', 'default': 'Desactivadas' }[perm] || perm;
    var quiet = [toggleCell({ icon: 'moon', color: 'var(--indigo)', title: 'Horas de silencio', value: q.enabled, onChange: function (v) { q.enabled = v; st.saveSettings('settings:quiet'); nav.refresh(); } })];
    if (q.enabled) {
      quiet.push(W.UI.cell({ title: 'Desde', right: timePill(q.from, function (v) { q.from = v; st.saveSettings('settings:quiet'); }) }));
      quiet.push(W.UI.cell({ title: 'Hasta', right: timePill(q.to, function (v) { q.to = v; st.saveSettings('settings:quiet'); }) }));
    }
    return {
      title: 'Avisos y sonido',
      body: [
        W.UI.section({ items: [W.UI.cell({ icon: 'bell', color: 'var(--red)', title: 'Notificaciones', value: permText,
          onTap: perm === 'default' ? function () { W.Notify.request(); setTimeout(function () { nav.refresh(); }, 1500); } : null })],
          footer: perm === 'denied' ? 'Están bloqueadas: actívalas en los ajustes del teléfono para recibir los avisos.' : null }),
        W.UI.group([
          toggleCell({ icon: 'alert', color: 'var(--orange)', title: 'Avisar en las tareas nuevas', value: cfg.defaultWarn, onChange: function (v) { set('defaultWarn', v); } }),
          menuCell({ icon: 'alarm', color: 'var(--indigo)', title: 'Recordatorio previo', value: cfg.remindBefore, options: W.Editor.REMIND_OPTS, onChange: function (v) { set('remindBefore', v); } }, nav),
          menuCell({ icon: 'repeat', color: 'var(--gray-2)', title: 'Repetir alerta vencida', value: cfg.rewarn, options: REWARN, onChange: function (v) { set('rewarn', v); } }, nav)
        ]),
        W.UI.group([
          toggleCell({ icon: 'sound', color: 'var(--pink)', title: 'Sonidos', value: cfg.sound, onChange: function (v) { set('sound', v); if (v) W.Audio.success(); } }),
          toggleCell({ icon: 'vibrate', color: 'var(--gray-2)', title: 'Vibración', value: cfg.vibrate, onChange: function (v) { set('vibrate', v); if (v) W.Audio.vibrate([20]); } })
        ]),
        W.UI.section({ items: quiet, footer: 'Durante las horas de silencio no suenan avisos ni llegan notificaciones.' }),
        W.UI.group([W.UI.cell({ title: 'Probar el aviso', accent: true, center: true, onTap: function () { W.Audio.warning(); W.Audio.vibrate([70, 60, 70]); } })])
      ]
    };
  }

  function focusPage(nav) {
    var st = S(), f = st.settings.focus, setF = function (k) { return function (v) { f[k] = v; st.saveSettings('settings:focus'); }; };
    var mins = function (v) { return v + ' min'; };
    return {
      title: 'Enfoque',
      body: [
        W.UI.section({ header: 'Duración', items: [
          W.UI.cell({ title: 'Sesión', right: W.UI.stepper(f.work, 5, 120, 5, setF('work'), mins) }),
          W.UI.cell({ title: 'Pausa corta', right: W.UI.stepper(f.short, 1, 30, 1, setF('short'), mins) }),
          W.UI.cell({ title: 'Pausa larga', right: W.UI.stepper(f.long, 5, 60, 5, setF('long'), mins) })
        ] }),
        W.UI.section({ items: [
          W.UI.cell({ title: 'Sesiones antes de la pausa larga', right: W.UI.stepper(f.rounds, 2, 8, 1, setF('rounds')) }),
          toggleCell({ title: 'Empezar las pausas automáticamente', value: f.autoBreaks, onChange: setF('autoBreaks') })
        ] })
      ]
    };
  }

  function startPage(nav) {
    var st = S();
    return {
      title: 'Pantalla al abrir',
      body: [W.UI.section({ items: SCREENS.map(function (o) {
        return W.UI.cell({ title: o.label, right: o.value === st.settings.startScreen ? U.icon('check', 'sm') : null, cls: o.value === st.settings.startScreen ? 'accent' : null,
          onTap: function () { st.setSetting('startScreen', o.value); nav.pop(); } });
      }), footer: 'La pestaña que verás cada vez que abras WHIDER.' })]
    };
  }

  function dataPage(nav) {
    var st = S();
    return {
      title: 'Datos',
      body: [
        W.UI.section({ items: [W.UI.cell({ title: 'Ver la presentación', onTap: function () { nav.close(); setTimeout(function () { W.Onboarding.start(); }, 300); } })] }),
        W.UI.section({ items: [W.UI.cell({ title: 'Restablecer todo', center: true, danger: true, onTap: function () {
          W.Sheet.confirm({ title: '¿Restablecer WHIDER?', text: 'Se borrarán todas tus tareas, sesiones de enfoque, marcas y logros. No se puede deshacer.', ok: 'Restablecer', danger: true })
            .then(function (ok) { if (ok) { st.resetAll(); nav.close(); W.Toast.show({ text: 'Se han borrado todos los datos', icon: 'trash' }); } });
        } })], footer: 'Borra tareas, enfoque, marcas y logros' + (W.Auth && W.Auth.user ? ', también en tu cuenta.' : '.') + ' Tus listas y ajustes se conservan.' })
      ]
    };
  }

  function privacyPage() {
    return {
      title: 'Privacidad',
      body: [U.el('div.legal', { html: W.PRIVACY_HTML })]
    };
  }

  W.PRIVACY_HTML =
    '<p><b>Qué guardamos.</b> Tu nombre, tu correo y lo que creas en la app: tareas, listas, enfoque, marcas y ajustes.</p>' +
    '<p><b>Dónde.</b> En tu dispositivo y, si inicias sesión, en tu cuenta de WHIDER alojada en Google Firebase, para que puedas recuperarlo en otros dispositivos.</p>' +
    '<p><b>Para qué.</b> Solo para que la app funcione. No vendemos ni compartimos tus datos ni mostramos publicidad.</p>' +
    '<p><b>Tus derechos.</b> Puedes cerrar sesión o eliminar tu cuenta y todos sus datos cuando quieras, desde Ajustes → Cuenta.</p>' +
    '<p><b>Contraseñas.</b> WHIDER nunca ve ni guarda tu contraseña: la gestiona Firebase Authentication de forma cifrada.</p>';

  var PAGES = { account: accountPage, appearance: appearancePage, tasks: tasksPage, lists: listsPage, alerts: alertsPage, focus: focusPage, start: startPage, data: dataPage, privacy: privacyPage };
  var current = null;

  W.Settings = {
    /** Abre los ajustes (opcionalmente directamente en una página: 'focus', 'account'…) */
    open: function (page) {
      if (current) return current;
      current = W.Sheet.navigator(rootPage, { onClose: function () { current = null; } });
      if (page && PAGES[page]) current.push(PAGES[page]);
      return current;
    },
    isOpen: function () { return !!current; },
    refresh: function () { if (current) current.refresh(); }
  };
})(window.Whider);
