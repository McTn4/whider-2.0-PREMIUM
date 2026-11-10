/**
 * WHIDER · Ajustes: hoja con páginas (como los ajustes del sistema), abierta desde
 * la foto de perfil. Perfil, cuenta y plan arriba; cada apartado abre su propia página:
 * apariencia, personalización, personaje, sonidos, avisos, tareas, hábitos, enfoque y datos.
 */
window.Whider = window.Whider || {};

(function (W) {
  'use strict';
  var U = W.U, S = function () { return W.State; };
  var VERSION = '8.0.1';
  var SCREENS = [
    { value: 'home', label: 'Hoy' }, { value: 'tasks', label: 'Tareas' }, { value: 'calendar', label: 'Calendario' },
    { value: 'notes', label: 'Cuaderno' }, { value: 'chats', label: 'Chats' }, { value: 'habits', label: 'Hábitos' }, { value: 'focus', label: 'Enfoque' }
  ];
  var REWARN = [{ value: 0, label: 'Solo una vez' }, { value: 10, label: 'Cada 10 minutos' }, { value: 20, label: 'Cada 20 minutos' }, { value: 60, label: 'Cada hora' }];
  var TEXT = [{ value: 's', label: 'Pequeño' }, { value: 'm', label: 'Normal' }, { value: 'l', label: 'Grande' }, { value: 'xl', label: 'Enorme' }];

  function labelOf(arr, v) { for (var i = 0; i < arr.length; i++) if (arr[i].value === v) return arr[i].label; return ''; }
  /** Celda con menú: muestra el valor y al tocarla abre las opciones junto a él */
  function menuCell(o, nav) {
    return W.UI.cell({ icon: o.icon, title: o.title, value: labelOf(o.options, o.value), onTap: function (e, node) {
      W.Menu.choose(node.querySelector('.cell-value'), { value: o.value, options: o.options }).then(function (v) {
        if (v !== undefined && v !== o.value) { o.onChange(v); nav.refresh(); }
      });
    } });
  }
  function toggleCell(o) {
    return W.UI.cell({ icon: o.icon, title: o.title, sub: o.sub, right: W.UI.toggle(o.value, o.onChange, o.title) });
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

  /**
   * Línea de la versión. Siete toques seguidos encienden o apagan el modo de pruebas de pago de
   * este dispositivo (los enlaces de prueba de Stripe de js/config.js): solo para quien publica la app.
   */
  function versionLine(nav) {
    var P = W.Plan, taps = 0, last = 0, test = P.isTestCheckout();
    var line = U.el('p.version' + (test ? '.test' : ''), { attrs: { title: 'WHIDER ' + VERSION } }, [
      U.svg('svg', { viewBox: '0 0 64 64', 'aria-hidden': 'true' }, [U.svg('use', { href: '#logo' })]),
      'WHIDER ' + VERSION + ' · ' + P.label() + (test ? ' · Pagos de prueba' : '')
    ]);
    line.addEventListener('click', function () {
      if (!P.canTestCheckout()) return;
      var now = Date.now();
      taps = now - last < 1200 ? taps + 1 : 1; last = now;
      if (taps < 7) return;
      taps = 0;
      var on = !P.isTestCheckout();
      P.setTestCheckout(on);
      W.Toast.show(on
        ? { text: 'Modo de pruebas de pago activado en este dispositivo. En Planes, «Hazte Premium» abre tu pago de prueba de Stripe.', icon: 'gem', type: 'success', duration: 6000 }
        : { text: 'Modo de pruebas de pago desactivado', icon: 'gem' });
      nav.refresh();
    });
    return line;
  }

  /* ---------- Páginas ---------- */
  function rootPage(nav) {
    var st = S(), cfg = st.settings, A = W.Auth, u = A && A.user, accounts = A && A.configured();
    var name = st.displayName();
    var profileCell = W.UI.cell({
      lead: W.Profile.avatar('lg'), cls: 'profile-cell',
      title: name || (u ? u.displayName || 'Tu cuenta' : 'Tu perfil'),
      sub: u ? 'Cuenta: sesión, contraseña y copia en la nube' : accounts ? 'Inicia sesión para guardar tus datos en la nube' : 'Nombre y foto',
      onTap: function () {
        if (u) nav.push(accountPage);
        else if (accounts) { nav.close(); W.AuthScreen.open({ mode: 'register' }); }
        else W.Profile.edit(function () { nav.refresh(); });
      }
    });
    var P = W.Plan, desk = W.Layout.desktop;
    var planCell = W.UI.cell({ icon: 'gem', title: 'Plan', sub: P.status(), value: P.label(), onTap: function () { nav.close(); setTimeout(function () { P.open(); }, 200); } });
    /*
     * Por orden de uso y con nombre: tu cuenta arriba; cómo se ve y cómo suena; cómo te avisa y
     * cómo organiza tu trabajo; lo de este ordenador; y al final privacidad y datos.
     */
    return {
      title: 'Ajustes',
      body: [
        U.el('div.group', [profileCell, planCell]),
        W.UI.section({ header: 'Cómo se ve y suena', items: [
          W.UI.cell({ icon: 'type', title: 'Apariencia', value: 'Texto ' + labelOf(TEXT, cfg.textSize).toLowerCase(), onTap: function () { nav.push(appearancePage); } }),
          W.UI.cell({ icon: 'palette', title: 'Personalización', value: desk ? (P.isPremium() ? 'Barra, Hoy y calendario' : 'Premium') : 'Qué ves en Hoy', onTap: function () { nav.push(customPage); } }),
          W.UI.cell({ icon: 'smile', title: 'Tu personaje', value: W.Character.config().name, onTap: function () { nav.close(); setTimeout(function () { W.Character.edit(); }, 200); } }),
          W.UI.cell({ icon: 'sound', title: 'Sonidos y vibración', value: cfg.sound ? 'Activados' : 'Desactivados', onTap: function () { nav.push(soundsPage); } })
        ] }),
        W.UI.section({ header: 'Avisos y organización', items: [
          W.UI.cell({ icon: 'bell', title: 'Avisos', sub: 'Recordatorios, vencidas y horas de silencio', onTap: function () { nav.push(alertsPage); } }),
          W.UI.cell({ icon: 'tasks', title: 'Tareas y categorías', onTap: function () { nav.push(tasksPage); } }),
          W.UI.cell({ icon: 'target', title: 'Hábitos', onTap: function () { nav.push(habitsPage); } }),
          W.UI.cell({ icon: 'timer', title: 'Enfoque', value: cfg.focus.work + ' min', onTap: function () { nav.push(focusPage); } }),
          W.UI.cell({ icon: 'home', title: 'Pantalla al abrir', value: labelOf(SCREENS, cfg.startScreen), onTap: function () { nav.push(startPage); } })
        ] }),
        W.Layout.desktop || W.Layout.app ? W.UI.section({ header: 'Este ordenador', items: [
          W.Layout.app ? W.UI.cell({ icon: 'monitor', title: 'App de escritorio', sub: 'Abrir al iniciar, bandeja y versión', onTap: function () { nav.push(desktopPage); } }) : null,
          W.Layout.desktop ? W.UI.cell({ icon: 'keyboard', title: 'Atajos de teclado', value: '?', onTap: function () { nav.close(); setTimeout(function () { W.Keys.help(); }, 120); } }) : null
        ].filter(Boolean) }) : null,
        W.UI.section({ header: 'Privacidad y datos', items: [
          W.UI.cell({ icon: 'hand', title: 'Privacidad', onTap: function () { nav.push(privacyPage); } }),
          W.UI.cell({ icon: 'shield', title: 'Datos', sub: 'Copia de seguridad, importar y exportar', onTap: function () { nav.push(dataPage); } })
        ] }),
        versionLine(nav)
      ]
    };
  }

  function accountPage(nav) {
    var A = W.Auth, u = A.user, st = S();
    if (!u) return rootPage(nav);
    var verified = A.isVerified();
    var syncCell = W.UI.cell({ icon: 'cloud', title: 'Copia en la nube', sub: W.Sync.statusText(), onTap: function () {
      if (!verified) { nav.close(); W.AuthScreen.showVerify(); return; }
      W.Sync.push().then(function () { nav.refresh(); });
    } });
    var rows = [syncCell];
    if (!verified) rows.push(W.UI.cell({ icon: 'mail', title: 'Verificar el correo', sub: 'Abre el enlace que te enviamos', onTap: function () { nav.close(); W.AuthScreen.showVerify(); } }));
    if (A.provider() === 'password') rows.push(W.UI.cell({ icon: 'key', title: 'Cambiar la contraseña', onTap: function () {
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
        W.UI.section({ header: 'Tamaño del texto', items: U.el('div', [W.UI.segmented(TEXT, cfg.textSize, function (v) { set('textSize', v); })]) }),
        W.UI.section({ header: 'Densidad', items: U.el('div', [W.UI.segmented([{ value: 'comfortable', label: 'Cómoda' }, { value: 'compact', label: 'Compacta' }], cfg.density, function (v) { set('density', v); })]) }),
        W.UI.section({ items: [toggleCell({ title: 'Reducir movimiento', value: cfg.reduceMotion, onChange: function (v) { set('reduceMotion', v); } })],
          footer: 'Quita las transiciones y animaciones de la interfaz.' }),
        W.UI.section({ items: [toggleCell({ title: 'Alto contraste', value: cfg.contrast === 'high', onChange: function (v) { set('contrast', v ? 'high' : 'normal'); } })],
          footer: 'Textos secundarios y líneas más claros, para leer mejor.' })
      ]
    };
  }

  function tasksPage(nav) {
    var st = S(), cfg = st.settings, set = st.setSetting;
    var lists = st.lists.map(function (l) { return { value: l.id, label: l.name }; });
    return {
      title: 'Tareas y categorías',
      body: [
        W.UI.group([
          W.UI.cell({ icon: 'list', title: 'Categorías', value: String(st.lists.length), onTap: function () { nav.push(listsPage); } }),
          menuCell({ icon: 'tray', title: 'Categoría por defecto', value: cfg.defaultList, options: lists, onChange: function (v) { set('defaultList', v); } }, nav),
          W.UI.cell({ icon: 'edit', title: 'Escribir tareas rápido', sub: 'Fecha, hora y categoría en el propio texto', onTap: function () { nav.push(quickHelpPage); } })
        ]),
        W.UI.section({ items: [toggleCell({ icon: 'trash', title: 'Confirmar antes de eliminar', value: cfg.confirmDelete, onChange: function (v) { set('confirmDelete', v); } })],
          footer: 'Al deslizar para eliminar siempre puedes deshacer.' }),
        W.UI.group([
          menuCell({ icon: 'calendar', title: 'La semana empieza el', value: cfg.weekStart, options: [{ value: 1, label: 'Lunes' }, { value: 0, label: 'Domingo' }], onChange: function (v) { set('weekStart', v); } }, nav),
          menuCell({ icon: 'clock', title: 'Formato de hora', value: cfg.timeFormat, options: [{ value: '24', label: '24 horas' }, { value: '12', label: '12 horas' }], onChange: function (v) { set('timeFormat', v); } }, nav)
        ])
      ]
    };
  }

  function helpRow(code, what) {
    return U.el('div.cell', [U.el('span.help-ex', [U.el('code', { text: code }), U.el('span', { text: what })])]);
  }
  function quickHelpPage() {
    var ex = [
      ['Llamar a Ana mañana a las 10', 'Mañana · 10:00'],
      ['Dentista el 15 a las 5 de la tarde', 'Día 15 · 17:00'],
      ['Reunión el lunes #trabajo', 'Próximo lunes · categoría Trabajo'],
      ['Pagar el alquiler cada mes', 'Se repite cada mes'],
      ['Entregar informe 20/11 !!!', '20 de noviembre · urgente'],
      ['Gimnasio entre semana a las 7', 'Días laborables · 07:00']
    ];
    return {
      title: 'Escribir tareas rápido',
      body: [
        U.el('p.sheet-lead-text', { text: 'Con el botón + se puede escribir la fecha, la hora, la categoría y la prioridad en el propio texto: se detectan y se quitan del título. Si algo no era una fecha, toca la × de su etiqueta.' }),
        W.UI.section({ header: 'Ejemplos', items: ex.map(function (e) { return helpRow(e[0], e[1]); }) }),
        W.UI.section({ header: 'Atajos', items: [
          helpRow('#nombre', 'Categoría (por ejemplo #trabajo)'),
          helpRow('!  ·  !!  ·  !!!', 'Destacada · importante · urgente'),
          helpRow('cada día · cada semana · cada lunes', 'Repeticiones')
        ] })
      ]
    };
  }

  function listsPage(nav) {
    var st = S();
    var rows = st.lists.map(function (l) {
      var n = st.tasks.filter(function (t) { return t.listId === l.id && !t.done; }).length;
      return W.UI.cell({ icon: W.Lists.icon(l), title: l.name, value: U.el('span.list-count', { text: n }), onTap: function () {
        W.Lists.edit(l, function () { nav.refresh(); }, function () { nav.refresh(); });
      } });
    });
    rows.push(W.UI.cell({ icon: 'plus', title: 'Nueva categoría', accent: true, chevron: false,
      onTap: function () { W.Lists.edit(null, function () { nav.refresh(); }); } }));
    return { title: 'Categorías', body: [W.UI.section({ items: rows, footer: 'Toca una categoría para cambiarle el nombre, el icono o eliminarla.' })] };
  }

  function alertsPage(nav) {
    var st = S(), cfg = st.settings, set = st.setSetting, q = cfg.quietHours;
    var perm = W.Notify.permission();
    var permText = { granted: 'Activadas', denied: 'Bloqueadas', unsupported: 'No disponibles', 'default': 'Desactivadas' }[perm] || perm;
    var quiet = [toggleCell({ icon: 'moon', title: 'Horas de silencio', value: q.enabled, onChange: function (v) { q.enabled = v; st.saveSettings('settings:quiet'); nav.refresh(); } })];
    if (q.enabled) {
      quiet.push(W.UI.cell({ title: 'Desde', right: timePill(q.from, function (v) { q.from = v; st.saveSettings('settings:quiet'); }) }));
      quiet.push(W.UI.cell({ title: 'Hasta', right: timePill(q.to, function (v) { q.to = v; st.saveSettings('settings:quiet'); }) }));
    }
    return {
      title: 'Avisos',
      body: [
        W.UI.section({ items: [W.UI.cell({ icon: 'bell', title: 'Notificaciones', value: permText,
          onTap: perm === 'default' ? function () { W.Notify.request(); setTimeout(function () { nav.refresh(); }, 1500); } : null })],
          footer: perm === 'denied' ? 'Están bloqueadas: actívalas en los ajustes del teléfono para recibir los avisos.' : null }),
        W.UI.group([
          toggleCell({ icon: 'alert', title: 'Avisar en las tareas nuevas', value: cfg.defaultWarn, onChange: function (v) { set('defaultWarn', v); } }),
          menuCell({ icon: 'alarm', title: 'Recordatorio previo', value: cfg.remindBefore, options: W.Editor.REMIND_OPTS, onChange: function (v) { set('remindBefore', v); } }, nav),
          menuCell({ icon: 'repeat', title: 'Repetir alerta vencida', value: cfg.rewarn, options: REWARN, onChange: function (v) { set('rewarn', v); } }, nav)
        ]),
        W.UI.group([W.UI.cell({ icon: 'sound', title: 'Sonidos de los avisos', value: cfg.sound && cfg.sounds.notify ? 'Activados' : 'Desactivados', onTap: function () { nav.push(soundsPage); } })]),
        W.UI.section({ items: quiet, footer: 'Durante las horas de silencio no suenan avisos ni llegan notificaciones.' }),
        W.UI.group([W.UI.cell({ title: 'Probar el aviso', accent: true, center: true, onTap: function () { W.Audio.warning(); W.Audio.vibrate([70, 60, 70]); } })])
      ]
    };
  }

  /** Sonidos: botones, avisos y confirmaciones por separado, estilo y volumen */
  function soundsPage(nav) {
    var st = S(), cfg = st.settings, snd = cfg.sounds;
    var setS = function (k, v) { snd[k] = v; st.saveSettings('settings:sounds'); };
    var styles = Object.keys(W.Audio.STYLES).map(function (k) { return { value: k, label: W.Audio.STYLES[k] }; });
    var vol = U.el('input.range', { attrs: { type: 'range', min: 0, max: 100, step: 5, 'aria-label': 'Volumen' } });
    vol.value = snd.volume;
    var volVal = U.el('span.range-val', { text: snd.volume + ' %' });
    vol.addEventListener('input', function () { volVal.textContent = vol.value + ' %'; });
    vol.addEventListener('change', function () { setS('volume', +vol.value); W.Audio.success(); });
    var rows = cfg.sound ? [
      W.UI.section({ header: 'Qué suena', items: [
        toggleCell({ icon: 'hand', title: 'Botones', sub: 'Un toque breve al pulsar', value: snd.buttons, onChange: function (v) { setS('buttons', v); if (v) W.Audio.click(); } }),
        toggleCell({ icon: 'bell', title: 'Avisos y notificaciones', sub: 'Recordatorios, vencidas, hábitos y enfoque', value: snd.notify, onChange: function (v) { setS('notify', v); if (v) W.Audio.chime(); } }),
        toggleCell({ icon: 'check', title: 'Confirmaciones', sub: 'Completar tareas, terminar el día y nuevas marcas', value: snd.events !== false, onChange: function (v) { setS('events', v); if (v) W.Audio.complete(); } })
      ] }),
      W.UI.section({ header: 'Estilo de los botones', items: U.el('div', [W.UI.segmented(styles, snd.style, function (v) { setS('style', v); W.Audio.click(v); })]) }),
      W.UI.section({ header: 'Volumen', items: U.el('div.group', [U.el('div.cell.range-row', [U.icon('sound', 'sm'), vol, volVal])]) }),
      W.UI.group([
        W.UI.cell({ title: 'Probar un aviso', accent: true, center: true, onTap: function () { W.Audio.chime(); } }),
        W.UI.cell({ title: 'Probar una confirmación', accent: true, center: true, onTap: function () { W.Audio.complete(); } })
      ])
    ] : [];
    return {
      title: 'Sonidos y vibración',
      body: [
        W.UI.section({ items: [toggleCell({ icon: 'sound', title: 'Sonidos', value: cfg.sound, onChange: function (v) { st.setSetting('sound', v); nav.refresh(); if (v) W.Audio.success(); } })],
          footer: cfg.sound ? null : 'Sin sonidos: ni botones, ni avisos, ni confirmaciones.' })
      ].concat(rows).concat([
        W.UI.section({ items: [toggleCell({ icon: 'vibrate', title: 'Vibración', value: cfg.vibrate, onChange: function (v) { st.setSetting('vibrate', v); if (v) W.Audio.vibrate([20]); } })],
          footer: 'Las horas de silencio (en Avisos) también callan los sonidos de los avisos.' })
      ])
    };
  }

  function habitsPage(nav) {
    var st = S(), cfg = st.settings;
    return {
      title: 'Hábitos',
      body: [
        W.UI.section({ items: [toggleCell({ icon: 'home', title: 'Mostrar los hábitos en Hoy', value: cfg.homeHabits, onChange: function (v) { st.setSetting('homeHabits', v); } })],
          footer: 'En el ordenador se eligen los bloques de Hoy en Personalización.' }),
        W.UI.group([
          W.UI.cell({ icon: 'target', title: 'Ver mis hábitos', value: String(W.Habits.list().length), onTap: function () { nav.close(); setTimeout(function () { W.Router.go('habits'); }, 150); } }),
          W.UI.cell({ icon: 'plus', title: 'Nuevo hábito', accent: true, chevron: false, onTap: function () { nav.close(); setTimeout(function () { W.HabitView.edit(null); }, 200); } })
        ])
      ]
    };
  }

  /** Personalización: básica en el móvil; avanzada (Premium) en el ordenador */
  function customPage(nav) {
    var st = S(), cfg = st.settings, dk = cfg.desk, P = W.Plan, desk = W.Layout.desktop;
    var basic = W.UI.section({ header: 'Qué ves en Hoy', items: [
      toggleCell({ icon: 'smile', title: 'Tu personaje', value: cfg.homeBuddy, onChange: function (v) { st.setSetting('homeBuddy', v); } }),
      toggleCell({ icon: 'target', title: 'Hábitos de hoy', value: cfg.homeHabits, onChange: function (v) { st.setSetting('homeHabits', v); } })
    ] });
    // Móvil: solo lo que se decide aquí (Apariencia y Tu personaje ya están en la portada de Ajustes)
    if (!desk) return { title: 'Personalización', body: [basic, U.el('p.hint', { text: 'En el ordenador, con Premium, también eliges la barra lateral, los bloques junto a Hoy y el calendario.' })] };
    if (!P.isPremium()) {
      return { title: 'Personalización', body: [
        U.el('div.pw-hero', [U.el('span.pw-gem', [U.icon('palette')]), U.el('strong', { text: 'Personalización avanzada' }), U.el('p', { text: P.FEATURES.custom.text })]),
        U.el('div.pw-actions', [U.el('button.btn.primary.block', { on: { click: function () { nav.close(); setTimeout(function () { P.paywall('custom'); }, 150); } } }, [U.icon('gem', 'sm'), 'Desbloquear con Premium'])]),
        basic
      ] };
    }
    var saveDesk = function () { st.saveSettings('settings:desk'); };
    var sb = dk.sidebar;
    var sbItem = function (key, label, icon) { return toggleCell({ icon: icon, title: label, value: sb[key] !== false, onChange: function (v) { sb[key] = v; saveDesk(); } }); };
    // Bloques de Hoy con su orden
    var order = W.Screens.home.widgetOrder(st), names = { buddy: 'Tu personaje', summary: 'Resumen del día', messages: 'Mensajes y solicitudes', habits: 'Hábitos de hoy', upcoming: 'Próximos días', pages: 'Cuaderno', focus: 'Enfoque' };
    var widgets = order.map(function (k, i) {
      var move = function (d) { var o = order.slice(), j = i + d; if (j < 0 || j >= o.length) return; o[i] = o[j]; o[j] = k; dk.widgetOrder = o.join(','); saveDesk(); nav.refresh(); };
      return U.el('div.cell.order-row', [U.el('span.cell-title', { text: names[k] }),
        U.el('span.order-btns', [U.el('button.circle-btn', { attrs: { 'aria-label': 'Subir', disabled: i === 0 }, on: { click: function () { move(-1); } } }, [U.icon('up')]),
          U.el('button.circle-btn', { attrs: { 'aria-label': 'Bajar', disabled: i === order.length - 1 }, on: { click: function () { move(1); } } }, [U.icon('down')])]),
        W.UI.toggle(dk.widgets[k] !== false, function (v) { dk.widgets[k] = v; saveDesk(); }, names[k])]);
    });
    var lists = st.lists.map(function (l, i) {
      return U.el('div.cell.order-row', [W.UI.cellIcon(W.Lists.icon(l)), U.el('span.cell-title', { text: l.name }),
        U.el('span.order-btns', [U.el('button.circle-btn', { attrs: { 'aria-label': 'Subir', disabled: i === 0 }, on: { click: function () { st.moveList(l.id, -1); nav.refresh(); } } }, [U.icon('up')]),
          U.el('button.circle-btn', { attrs: { 'aria-label': 'Bajar', disabled: i === st.lists.length - 1 }, on: { click: function () { st.moveList(l.id, 1); nav.refresh(); } } }, [U.icon('down')])])]);
    });
    var calViews = [{ value: 'month', label: 'Mes' }, { value: 'week', label: 'Semana' }, { value: 'day', label: 'Día' }, { value: 'agenda', label: 'Agenda' }];
    var hour = function (v) { return U.pad(v) + ':00'; };
    return {
      title: 'Personalización',
      body: [
        W.UI.section({ header: 'Barra lateral', items: [
          sbItem('notes', 'Cuaderno', 'notebook'), sbItem('chats', 'Chats', 'chat'), sbItem('friends', 'Personas', 'users'),
          sbItem('habits', 'Hábitos', 'target'), sbItem('focus', 'Enfoque', 'timer'), sbItem('automations', 'Sistemas', 'system'),
          sbItem('stats', 'Estadísticas', 'chart'), sbItem('reports', 'Informes', 'print'),
          sbItem('filters', 'Filtros', 'filter'),
          toggleCell({ icon: 'hash', title: 'Mostrar los contadores', value: sb.counts !== false, onChange: function (v) { sb.counts = v; saveDesk(); } }),
          toggleCell({ icon: 'list', title: 'Barra compacta', value: !!sb.compact, onChange: function (v) { sb.compact = v; saveDesk(); } })
        ] }),
        W.UI.section({ header: 'Lateral de Hoy', items: widgets, footer: 'Elige qué bloques ves junto a tus tareas de hoy y en qué orden.' }),
        W.UI.section({ header: 'Calendario', items: [
          menuCell({ icon: 'calendar', title: 'Vista al abrir', value: dk.calView, options: calViews, onChange: function (v) { dk.calView = v; st.ui.calView = v; saveDesk(); } }, nav),
          W.UI.cell({ icon: 'clock', title: 'La semana empieza a las', right: W.UI.stepper(dk.calStartH, 0, 12, 1, function (v) { dk.calStartH = v; saveDesk(); }, hour) }),
          W.UI.cell({ icon: 'moon', title: 'Y termina a las', right: W.UI.stepper(dk.calEndH, 13, 23, 1, function (v) { dk.calEndH = v; saveDesk(); }, hour) }),
          toggleCell({ icon: 'week', title: 'Mostrar los fines de semana', value: dk.weekends !== false, onChange: function (v) { dk.weekends = v; saveDesk(); } })
        ] }),
        W.UI.section({ header: 'Pantalla', items: [
          toggleCell({ icon: 'monitor', title: 'Contenido a todo el ancho', sub: 'Aprovecha las pantallas grandes', value: !!dk.wide, onChange: function (v) { dk.wide = v; saveDesk(); } })
        ] }),
        basic,
        W.UI.section({ header: 'Orden de las categorías', items: lists }),
        W.UI.section({ header: 'Filtros guardados', items: st.filters.map(function (f) {
          return W.UI.cell({ icon: 'filter', title: f.name, sub: W.Filters.describe(f), onTap: function () { W.Filters.edit(f, function () { nav.refresh(); }); } });
        }).concat([W.UI.cell({ icon: 'plus', title: 'Nuevo filtro', accent: true, chevron: false, onTap: function () { W.Filters.edit(null, function () { nav.refresh(); }); } })]) })
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

  /* ---------- Importar y exportar ---------- */
  function pickFile(accept) {
    return new Promise(function (resolve) {
      var input = U.el('input', { attrs: { type: 'file', accept: accept }, style: { display: 'none' } });
      input.addEventListener('change', function () {
        var f = input.files && input.files[0]; input.remove();
        if (!f) { resolve(null); return; }
        var r = new FileReader();
        r.onload = function () { resolve({ name: f.name, text: String(r.result || '') }); };
        r.onerror = function () { resolve(null); };
        r.readAsText(f);
      });
      document.body.appendChild(input); input.click();
    });
  }
  function csvParse(text) {
    var rows = [], row = [], cell = '', q = false, sep = (text.split('\n')[0].match(/;/g) || []).length >= (text.split('\n')[0].match(/,/g) || []).length ? ';' : ',';
    text = text.replace(/^\ufeff/, '');
    for (var i = 0; i < text.length; i++) {
      var ch = text[i];
      if (q) { if (ch === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += ch; }
      else if (ch === '"') q = true;
      else if (ch === sep) { row.push(cell); cell = ''; }
      else if (ch === '\n' || ch === '\r') { if (ch === '\r' && text[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = ''; }
      else cell += ch;
    }
    if (cell || row.length) { row.push(cell); rows.push(row); }
    return rows.filter(function (r) { return r.some(function (c) { return c.trim(); }); });
  }
  function importCsv() {
    var st = S();
    pickFile('.csv,text/csv').then(function (f) {
      if (!f) return;
      var rows = csvParse(f.text);
      if (rows.length < 2) { W.Toast.show({ text: 'El archivo no tiene tareas', type: 'danger' }); return; }
      var head = rows[0].map(function (h) { return (W.Parse.fold ? W.Parse.fold(h) : h.toLowerCase()).trim(); });
      var col = function (names) { for (var i = 0; i < head.length; i++) if (names.indexOf(head[i]) >= 0) return i; return -1; };
      var cText = col(['tarea', 'titulo', 'title', 'text', 'texto', 'nombre']), cDate = col(['fecha', 'date', 'dia']), cTime = col(['hora', 'time']),
        cList = col(['categoria', 'lista', 'list', 'category']), cPrio = col(['prioridad', 'priority']), cNotes = col(['notas', 'notes', 'nota']), cState = col(['estado', 'status']);
      if (cText < 0) cText = 0;
      var prio = function (v) { v = (W.Parse.fold ? W.Parse.fold(v) : String(v).toLowerCase()); return /urgent/.test(v) ? 'danger' : /importan/.test(v) ? 'purple' : /destac/.test(v) ? 'star' : 'none'; };
      var date = function (v) { v = String(v || '').trim(); var m = v.match(/^(\d{4})-(\d{2})-(\d{2})/) || v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/); if (!m) return null; return m[1].length === 4 ? m[1] + '-' + m[2] + '-' + m[3] : m[3] + '-' + U.pad(+m[2]) + '-' + U.pad(+m[1]); };
      var made = {}, items = rows.slice(1).map(function (r) {
        var name = cList >= 0 ? String(r[cList] || '').trim() : '', l = null;
        if (name) { l = st.lists.filter(function (x) { return x.name.toLowerCase() === name.toLowerCase(); })[0] || made[name.toLowerCase()]; if (!l) { l = st.addList(name); made[name.toLowerCase()] = l; } }
        var done = cState >= 0 && /complet|hecha|done/i.test(r[cState] || '');
        var t = cTime >= 0 && /^\d{1,2}:\d{2}/.test(r[cTime] || '') ? U.pad(+r[cTime].split(':')[0]) + ':' + r[cTime].split(':')[1].slice(0, 2) : null;
        return { text: String(r[cText] || '').trim(), date: cDate >= 0 ? date(r[cDate]) : null, time: t, listId: l ? l.id : st.settings.defaultList,
          highlight: cPrio >= 0 ? prio(r[cPrio]) : 'none', notes: cNotes >= 0 ? String(r[cNotes] || '') : '', done: done, doneOn: done ? U.today() : null, doneAt: done ? Date.now() : null, warn: false, subtasks: [] };
      }).filter(function (x) { return x.text; });
      W.Sheet.confirm({ title: '¿Importar ' + U.plural(items.length, 'tarea', 'tareas') + '?', text: 'Desde «' + f.name + '». No se borra nada de lo que ya tienes.', ok: 'Importar' }).then(function (ok) {
        if (!ok) return;
        var n = st.importTasks(items);
        W.Toast.show({ text: U.plural(n, 'tarea importada', 'tareas importadas'), type: 'success', icon: 'upload' });
      });
    });
  }
  function exportCsv() {
    var st = S(), cell = function (v) { var s = v == null ? '' : String(v); return /[";\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
    var rows = [['Tarea', 'Categoría', 'Prioridad', 'Fecha', 'Hora', 'Duración (min)', 'Repetición', 'Estado', 'Completada el', 'Notas']];
    st.tasks.forEach(function (t) {
      var l = st.getList(t.listId);
      rows.push([t.text, l ? l.name : '', st.PRIORITIES[t.highlight].label, t.date || '', t.time || '', t.duration || '', st.REPEATS[t.repeat], t.done ? 'Completada' : st.isOverdue(t) ? 'Vencida' : 'Pendiente', t.doneAt ? new Date(t.doneAt).toLocaleString('es-ES') : '', t.notes || '']);
    });
    U.saveFile('whider-tareas-' + U.today(), rows.map(function (r) { return r.map(cell).join(';'); }).join('\r\n'), 'csv');
  }
  /** Copia completa: también el Cuaderno (fichas y contenido de cada página, salvo las de equipo) */
  function exportBackup() {
    var snap = S().snapshot();
    if (W.Pages) {
      var mine = W.Pages.all().concat(W.Pages.all({ trash: true })).filter(function (m) { return !m.team; });
      snap.pages = mine.map(function (m) { return { meta: m, content: W.Pages.content(m.id) }; });
    }
    U.saveFile('whider-copia-' + U.today(), JSON.stringify(snap, null, 1), 'json');
  }
  /** Páginas de una copia: se añaden las que faltan y se actualizan las más recientes */
  function importPages(list) {
    var n = 0;
    (Array.isArray(list) ? list : []).forEach(function (x) {
      if (!x || !x.meta || !x.meta.id) return;
      var cur = W.Pages.get(x.meta.id);
      if (cur && cur.at >= (x.meta.at || 0) && (cur.cv || 0) >= (x.meta.cv || 0)) return;
      W.Pages.applyMeta(Object.assign({}, x.meta, { team: null }));
      W.Pages.applyContent(x.meta.id, x.content || { blocks: [] }, x.meta.cv || Date.now());
      var idx = W.Pages.index(); idx.dirty[x.meta.id] = 3;
      n++;
    });
    if (n) { W.Pages.saveNow(); if (W.PageSync) W.PageSync.schedule(); }
    return n;
  }
  function importBackup() {
    pickFile('.json,application/json').then(function (f) {
      if (!f) return;
      var data = null;
      try { data = JSON.parse(f.text); } catch (e) { data = null; }
      if (!data || !Array.isArray(data.tasks)) { W.Toast.show({ text: 'No es una copia de WHIDER', type: 'danger' }); return; }
      W.Sheet.confirm({ title: '¿Recuperar la copia?', text: 'Se juntará con lo que ya tienes (' + U.plural(data.tasks.length, 'tarea', 'tareas') + (data.pages ? ', ' + U.plural(data.pages.length, 'página', 'páginas') : data.notes ? ', ' + U.plural(data.notes.length, 'apunte', 'apuntes') : '') + '). Gana siempre lo más reciente.', ok: 'Recuperar' }).then(function (ok) {
        if (!ok) return;
        var merged = W.Sync.merge(S().snapshot(), data);
        S().applySnapshot(merged, 'import');
        var np = W.Pages && data.pages ? importPages(data.pages) : 0;
        W.Toast.show({ text: 'Copia recuperada' + (np ? ' (' + U.plural(np, 'página', 'páginas') + ' del Cuaderno)' : ''), type: 'success', icon: 'upload' });
      });
    });
  }

  function dataPage(nav) {
    var st = S(), desk = W.Layout.desktop;
    return {
      title: 'Datos',
      body: [
        W.UI.section({ header: 'Copia de seguridad', items: [
          W.UI.cell({ icon: 'download', title: 'Guardar una copia', sub: 'Todo: tareas, Cuaderno, hábitos, sistemas y ajustes (JSON)', onTap: exportBackup }),
          W.UI.cell({ icon: 'upload', title: 'Recuperar una copia', sub: 'Se junta con lo que ya tienes', onTap: importBackup })
        ], footer: W.Auth && W.Auth.user ? 'Con tu cuenta, todo se guarda además en la nube.' : 'Sin cuenta, tus datos solo están en este dispositivo: guarda copias de vez en cuando.' }),
        desk ? W.UI.section({ header: 'Hoja de cálculo', items: [
          W.UI.cell({ icon: 'download', title: 'Exportar las tareas (CSV)', sub: 'Para Excel, Numbers o Google Sheets', onTap: exportCsv }),
          W.UI.cell({ icon: 'upload', title: 'Importar tareas (CSV)', sub: 'Columnas: Tarea, Fecha, Hora, Categoría, Prioridad, Notas', onTap: importCsv })
        ] }) : null,
        W.UI.section({ items: [W.UI.cell({ title: 'Ver la presentación', onTap: function () { nav.close(); setTimeout(function () { W.Onboarding.start(); }, 300); } })] }),
        W.UI.section({ items: [W.UI.cell({ title: 'Restablecer todo', center: true, danger: true, onTap: function () {
          W.Sheet.confirm({ title: '¿Restablecer WHIDER?', text: 'Se borrarán tus tareas, tu Cuaderno, tus hábitos, sesiones de enfoque y marcas. No se puede deshacer.', ok: 'Restablecer', danger: true })
            .then(function (ok) { if (ok) { st.resetAll(); nav.close(); W.Toast.show({ text: 'Se han borrado todos los datos', icon: 'trash' }); } });
        } })], footer: 'Borra tareas, Cuaderno, hábitos, enfoque y marcas' + (W.Auth && W.Auth.user ? ', también en tu cuenta.' : '.') + ' Tus categorías, sistemas y ajustes se conservan.' })
      ]
    };
  }

  /** App de escritorio: abrir al iniciar el ordenador y seguir en la bandeja al cerrar */
  function desktopPage(nav) {
    var D = window.WhiderDesktop, prefs = W.DesktopPrefs || {};
    var set = function (k, v) { prefs[k] = v; W.DesktopPrefs = prefs; if (D) D.setSetting(k, v); nav.refresh(); };
    var tray = D && D.platform === 'darwin' ? 'el Dock' : 'la bandeja del sistema';
    return {
      title: 'App de escritorio',
      body: [
        W.UI.section({ items: [toggleCell({ icon: 'power', title: 'Abrir WHIDER al iniciar el ordenador', value: !!prefs.openAtLogin, onChange: function (v) { set('openAtLogin', v); } })],
          footer: 'Se abre en segundo plano, sin ventana, para que los avisos lleguen desde el primer momento.' }),
        W.UI.section({ items: [toggleCell({ icon: 'bell', title: 'Seguir abierta al cerrar la ventana', value: prefs.closeToTray !== false, onChange: function (v) { set('closeToTray', v); } })],
          footer: 'WHIDER sigue en ' + tray + ' y te avisa de tus tareas aunque no tengas la ventana abierta. Para salir del todo, usa «Salir» en su menú.' }),
        W.UI.section({ items: [
          W.UI.cell({ title: 'Versión de la app', value: prefs.version || '' }),
          W.UI.cell({ title: 'Descargar la última versión', onTap: function () { if (D) D.openExternal('https://github.com/McTn4/whider-2.0-PREMIUM/releases/tag/desktop-latest'); } })
        ] })
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
    '<p><b>Qué guardamos.</b> Tu nombre, tu correo y lo que creas en la app: tareas, categorías, tu Cuaderno, hábitos, enfoque, marcas, tu personaje, tus chats y ajustes.</p>' +
    '<p><b>Dónde.</b> En tu dispositivo y, si inicias sesión, en tu cuenta de WHIDER alojada en Google Firebase, para que puedas recuperarlo en otros dispositivos.</p>' +
    '<p><b>Personas y chats.</b> Tus contactos ven tu perfil público: tu nombre, tu personaje o tu foto, tu racha y cuántas tareas completas a la semana. Nunca ven tus tareas ni tu Cuaderno. Los mensajes de un chat solo los leen sus miembros, y las páginas de un equipo, solo sus miembros.</p>' +
    '<p><b>Para qué.</b> Solo para que la app funcione. No vendemos ni compartimos tus datos ni mostramos publicidad.</p>' +
    '<p><b>Tus derechos.</b> Puedes cerrar sesión o eliminar tu cuenta y todos sus datos cuando quieras, desde Ajustes → Cuenta.</p>' +
    '<p><b>Contraseñas.</b> WHIDER nunca ve ni guarda tu contraseña: la gestiona Firebase Authentication de forma cifrada.</p>';

  var PAGES = { desktop: desktopPage, account: accountPage, appearance: appearancePage, tasks: tasksPage, lists: listsPage, alerts: alertsPage, focus: focusPage, start: startPage,
    data: dataPage, privacy: privacyPage, sounds: soundsPage, custom: customPage, habits: habitsPage };
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
