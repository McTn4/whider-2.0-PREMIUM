/**
 * WHIDER · Ajustes: hoja con páginas (como los ajustes del sistema), abierta desde
 * la foto de perfil. Perfil y cuenta arriba; cada apartado abre su propia página:
 * apariencia, lo que ves, sonidos, avisos, tareas, calendarios y datos.
 */
window.Whider = window.Whider || {};

(function (W) {
  'use strict';
  var U = W.U, S = function () { return W.State; };
  /** «1.1.0», «1.1.0 beta 1» (la versión sale de package.json vía js/core/version.js) */
  function versionText() { return W.WhatsNew ? W.WhatsNew.label(W.VERSION) : String(W.VERSION || ''); }
  var SCREENS = [
    { value: 'home', label: W.t('Inicio') }, { value: 'tasks', label: W.t('Tareas') }, { value: 'calendar', label: W.t('Calendario') },
    { value: 'notes', label: W.t('Cuaderno') }, { value: 'friends', label: W.t('Personas') }
  ];
  var REWARN = [{ value: 0, label: W.t('Solo una vez') }, { value: 10, label: W.t('Cada 10 minutos') }, { value: 20, label: W.t('Cada 20 minutos') }, { value: 60, label: W.t('Cada hora') }];
  var TEXT = [{ value: 's', label: W.t('Pequeño') }, { value: 'm', label: W.t('Normal') }, { value: 'l', label: W.t('Grande') }, { value: 'xl', label: W.t('Enorme') }];

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
    var input = U.el('input.overlay-input', { attrs: { type: 'time', 'aria-label': W.t('Hora') } });
    input.value = value;
    input.addEventListener('change', function () { if (input.value) { pill.firstChild.textContent = U.fmtTime(input.value); onChange(input.value); } });
    input.addEventListener('click', function () { try { if (input.showPicker) input.showPicker(); } catch (e) { /* lo abre el sistema */ } });
    pill.appendChild(input);
    return pill;
  }

  /** Línea de la versión, al final de los ajustes */
  function versionLine() {
    return U.el('p.version', [
      U.svg('svg', { viewBox: '0 0 64 64', 'aria-hidden': 'true' }, [U.svg('use', { href: '#logo' })]),
      W.t('WHIDER {0}', { 0: versionText() })
    ]);
  }

  /* ---------- Páginas ---------- */
  function rootPage(nav) {
    var st = S(), cfg = st.settings, A = W.Auth, u = A && A.user, accounts = A && A.configured();
    var name = st.displayName();
    var profileCell = W.UI.cell({
      lead: W.Profile.avatar('lg'), cls: 'profile-cell',
      title: name || (u ? u.displayName || W.t('Tu cuenta') : W.t('Tu perfil')),
      sub: u ? W.t('Cuenta: sesión, contraseña y copia en la nube') : accounts ? W.t('Inicia sesión para guardar tus datos en la nube') : W.t('Nombre y foto'),
      onTap: function () {
        if (u) nav.push(accountPage);
        else if (accounts) { nav.close(); W.AuthScreen.open(); }
        else W.Profile.edit(function () { nav.refresh(); });
      }
    });
    var desk = W.Layout.desktop;
    /*
     * Por orden de uso y con nombre: tu cuenta arriba; cómo se ve y cómo suena; cómo te avisa y
     * cómo organiza tu trabajo; lo de este ordenador; y al final privacidad y datos.
     */
    return {
      title: W.t('Ajustes'),
      body: [
        U.el('div.group', [profileCell]),
        W.UI.section({ header: W.t('Cómo se ve y suena'), items: [
          W.UI.cell({ icon: 'type', title: W.t('Apariencia'), value: U.cap(W.t('Texto {size}', { size: labelOf(TEXT, cfg.textSize).toLowerCase() })), onTap: function () { nav.push(appearancePage); } }),
          // El nombre de cada idioma, en ese idioma (así lo encuentra quien no entiende el actual)
          W.UI.cell({ icon: 'globe', title: W.t('Idioma'), value: LANGS[W.I18n.lang] || 'Español', onTap: function (e, node) { chooseLang(node && node.querySelector('.cell-value')); } }),
          W.UI.cell({ icon: 'sliders', title: W.t('Lo que ves'), value: desk ? W.t('Barra, calendario y categorías') : W.t('Pestañas'), onTap: function () { nav.push(customPage); } }),
          W.UI.cell({ icon: 'sound', title: W.t('Sonidos y vibración'), value: cfg.sound ? W.t('Activados') : W.t('Desactivados'), onTap: function () { nav.push(soundsPage); } })
        ] }),
        W.UI.section({ header: W.t('Avisos y organización'), items: [
          W.UI.cell({ icon: 'bell', title: W.t('Avisos'), sub: W.t('Recordatorios, vencidas y horas de silencio'), onTap: function () { nav.push(alertsPage); } }),
          W.UI.cell({ icon: 'tasks', title: W.t('Tareas y categorías'), onTap: function () { nav.push(tasksPage); } }),
          W.UI.cell({ icon: 'calendar', title: W.t('Calendarios suscritos'), value: W.Calendars && W.Calendars.list().length ? String(W.Calendars.list().length) : W.t('Ninguno'), onTap: function () { nav.push(W.CalSubs.page); } }),
          W.UI.cell({ icon: 'home', title: W.t('Pantalla al abrir'), value: labelOf(SCREENS, cfg.startScreen), onTap: function () { nav.push(startPage); } })
        ] }),
        W.Layout.desktop || W.Layout.app ? W.UI.section({ header: W.t('Este ordenador'), items: [
          W.Layout.app ? W.UI.cell({ icon: 'monitor', title: W.t('App de escritorio'), sub: W.t('Abrir al iniciar, bandeja y versión'), onTap: function () { nav.push(desktopPage); } }) : null,
          W.Layout.desktop ? W.UI.cell({ icon: 'keyboard', title: W.t('Atajos de teclado'), value: '?', onTap: function () { nav.close(); setTimeout(function () { W.Keys.help(); }, 120); } }) : null
        ].filter(Boolean) }) : null,
        W.UI.section({ header: W.t('Privacidad y datos'), items: [
          W.UI.cell({ icon: 'hand', title: W.t('Privacidad'), onTap: function () { nav.push(privacyPage); } }),
          W.UI.cell({ icon: 'shield', title: W.t('Datos'), sub: W.t('Copia de seguridad, importar y exportar'), onTap: function () { nav.push(dataPage); } })
        ] }),
        // Solo en el navegador: la sección de descarga de la portada (en las apps ya la tienes)
        !W.Layout.app && !window.WhiderAndroid && /^https?:$/.test(location.protocol) ? W.UI.section({ items: [
          // Instalar esta web como app (iPhone: los pasos; Chrome o Edge: su botón)
          W.Install ? W.Install.cell() : null,
          W.UI.cell({ icon: 'monitor', title: W.t('Descargar la app'), sub: desk ? W.t('Para Windows, macOS y Linux') : W.t('Para ordenador · Android, pronto en Google Play'),
            onTap: function () { U.openExternal(location.origin + '/#descargar'); } })
        ].filter(Boolean) }) : null,
        W.UI.section({ header: W.t('Ayuda'), items: [
          W.UI.cell({ icon: 'sliders', title: W.t('Adaptar WHIDER a ti'), sub: W.t('Vuelve a la presentación: tu perfil, con quién la usas y los avisos'), onTap: function () { nav.close(); setTimeout(function () { W.Onboarding.start(); }, 300); } }),
          W.UI.cell({ icon: 'star', title: W.t('Novedades'), sub: W.t('Qué ha cambiado en cada versión'), onTap: function () { W.WhatsNew.open(); } }),
          W.UI.cell({ icon: 'book', title: W.t('Preguntas frecuentes'), onTap: function () { W.Help.faq(); } }),
          W.UI.cell({ icon: 'send', title: W.t('Enviar comentarios'), sub: W.t('Una idea, algo que no funciona u otra cosa'), onTap: function () { W.Help.feedback(); } }),
          W.Errors && W.Errors.list().length ? W.UI.cell({ icon: 'alert', title: W.t('Errores recientes'), value: String(W.Errors.list().length), onTap: function () { nav.push(W.Help.errorsPage); } }) : null,
          // En el ordenador y en el APK de GitHub: la versión y si hay otra más nueva
          W.Updates && W.Updates.state().mode === 'android' ? W.Updates.cell(nav) : null
        ].filter(Boolean) }),
        versionLine()
      ]
    };
  }

  function accountPage(nav) {
    var A = W.Auth, u = A.user, st = S();
    if (!u) return rootPage(nav);
    var verified = A.isVerified();
    var err = W.Sync.lastError;
    var syncCell = W.UI.cell({ icon: 'cloud', title: W.t('Copia en la nube'), sub: W.Sync.statusText(), subCls: W.Sync.unsaved() ? 'warn' : null, onTap: function () {
      if (!verified) { nav.close(); W.AuthScreen.showVerify(); return; }
      // Cada fallo, con lo que hay que hacer
      if (err && err.kind === 'auth') { nav.close(); W.App.logout(); return; }
      if (err && err.kind === 'size') { nav.push(dataPage); return; }
      W.Sync.push().then(function () { nav.refresh(); });
    } });
    var rows = [syncCell];
    if (!verified) rows.push(W.UI.cell({ icon: 'mail', title: W.t('Verificar el correo'), sub: W.t('Abre el enlace que te enviamos'), onTap: function () { nav.close(); W.AuthScreen.showVerify(); } }));
    if (A.provider() === 'password') rows.push(W.UI.cell({ icon: 'key', title: W.t('Cambiar la contraseña'), onTap: function () {
      A.resetPassword(u.email).then(function () { W.Toast.show({ text: W.t('Te hemos enviado un enlace a {email}', { email: u.email }), type: 'success', icon: 'mail' }); })
        .catch(function (e) { W.Toast.show({ text: A.message(e), type: 'danger' }); });
    } }));
    return {
      title: W.t('Cuenta'),
      body: [
        U.el('div.profile-head', [W.Profile.avatar('xl'), U.el('strong', { text: st.displayName() || u.displayName || W.t('Tu cuenta') }), U.el('span', { text: u.email || '' }),
          U.el('button.link-btn', { text: W.t('Editar nombre y foto'), on: { click: function () { W.Profile.edit(function () { nav.refresh(); }); } } })]),
        W.UI.section({ items: rows, footer: A.providerName() ? W.t('Has iniciado sesión con {name}.', { name: A.providerName() }) : verified ? W.t('Tus datos se guardan en tu cuenta y en este dispositivo.') : null }),
        W.UI.group([W.UI.cell({ title: W.t('Cerrar sesión'), center: true, danger: true, onTap: function () {
          W.Sheet.confirm({ title: W.t('¿Cerrar sesión?'), text: W.t('Tus datos quedan guardados en tu cuenta.'), ok: W.t('Cerrar sesión'), danger: true })
            .then(function (ok) { if (ok) { nav.close(); W.App.logout(); } });
        } })]),
        W.UI.section({ items: [W.UI.cell({ title: W.t('Eliminar la cuenta'), center: true, danger: true, onTap: function () {
          W.Sheet.confirm({ title: W.t('¿Eliminar tu cuenta?'), text: W.t('Se borrarán tu cuenta y todos sus datos de la nube. No se puede deshacer.'), ok: W.t('Eliminar'), danger: true })
            .then(function (ok) { if (ok) { nav.close(); W.App.deleteAccount(); } });
        } })], footer: W.t('Se borra la cuenta y todo lo que contiene, también en otros dispositivos.') })
      ]
    };
  }

  function appearancePage(nav) {
    var st = S(), cfg = st.settings, set = st.setSetting;
    return {
      title: W.t('Apariencia'),
      body: [
        W.UI.section({ header: W.t('Tema'), items: U.el('div', [W.UI.segmented([{ value: 'dark', label: W.t('Oscuro') }, { value: 'light', label: W.t('Claro') }, { value: 'system', label: W.t('Como el sistema') }], cfg.theme || 'dark', function (v) { set('theme', v); })]),
          footer: W.t('«Como el sistema» cambia solo cuando el dispositivo pasa de modo claro a oscuro.') }),
        W.UI.section({ header: W.t('Tamaño del texto'), items: U.el('div', [W.UI.segmented(TEXT, cfg.textSize, function (v) { set('textSize', v); })]) }),
        W.UI.section({ header: W.t('Densidad'), items: U.el('div', [W.UI.segmented([{ value: 'comfortable', label: W.t('Cómoda') }, { value: 'compact', label: W.t('Compacta') }], cfg.density, function (v) { set('density', v); })]) }),
        W.UI.section({ items: [toggleCell({ title: W.t('Reducir movimiento'), value: cfg.reduceMotion, onChange: function (v) { set('reduceMotion', v); } })],
          footer: W.t('Quita las transiciones y animaciones de la interfaz.') }),
        W.UI.section({ items: [toggleCell({ title: W.t('Alto contraste'), value: cfg.contrast === 'high', onChange: function (v) { set('contrast', v ? 'high' : 'normal'); } })],
          footer: W.t('Textos secundarios y líneas más marcados, para leer mejor.') })
      ]
    };
  }

  function tasksPage(nav) {
    var st = S(), cfg = st.settings, set = st.setSetting;
    // Sin categoría por defecto (lo de siempre al empezar) o una de las tuyas
    var lists = [{ value: null, label: W.t('Ninguna') }].concat(st.lists.map(function (l) { return { value: l.id, label: l.name }; }));
    return {
      title: W.t('Tareas y categorías'),
      body: [
        W.UI.group([
          W.UI.cell({ icon: 'list', title: W.t('Categorías'), value: String(st.lists.length), onTap: function () { nav.push(listsPage); } }),
          menuCell({ icon: 'tray', title: W.t('Categoría por defecto'), value: st.defaultListId(), options: lists, onChange: function (v) { set('defaultList', v); } }, nav),
          W.UI.cell({ icon: 'edit', title: W.t('Escribir tareas rápido'), sub: W.t('Fecha, hora y categoría en el propio texto'), onTap: function () { nav.push(quickHelpPage); } })
        ]),
        W.UI.section({ items: [toggleCell({ icon: 'trash', title: W.t('Confirmar antes de eliminar'), value: cfg.confirmDelete, onChange: function (v) { set('confirmDelete', v); } })],
          footer: W.t('Al deslizar para eliminar siempre puedes deshacer.') }),
        W.UI.group([
          menuCell({ icon: 'calendar', title: W.t('La semana empieza el'), value: cfg.weekStart, options: [{ value: 1, label: W.t('Lunes') }, { value: 0, label: W.t('Domingo') }], onChange: function (v) { set('weekStart', v); } }, nav),
          menuCell({ icon: 'clock', title: W.t('Formato de hora'), value: cfg.timeFormat, options: [{ value: '24', label: W.t('24 horas') }, { value: '12', label: W.t('12 horas') }], onChange: function (v) { set('timeFormat', v); } }, nav)
        ])
      ]
    };
  }

  function helpRow(code, what) {
    return U.el('div.cell', [U.el('span.help-ex', [U.el('code', { text: code }), U.el('span', { text: what })])]);
  }
  function quickHelpPage() {
    var ex = [
      [W.t('Llamar a Ana mañana a las 10'), W.t('Mañana · 10:00')],
      [W.t('Dentista el 15 a las 5 de la tarde'), W.t('Día 15 · 17:00')],
      [W.t('Reunión el lunes #trabajo'), W.t('Próximo lunes · categoría Trabajo')],
      [W.t('Pagar el alquiler cada mes'), W.t('Se repite cada mes')],
      [W.t('Entregar informe 20/11 !!!'), W.t('20 de noviembre · urgente')],
      [W.t('Gimnasio entre semana a las 7'), W.t('Días laborables · 07:00')]
    ];
    return {
      title: W.t('Escribir tareas rápido'),
      body: [
        U.el('p.sheet-lead-text', { text: W.t('Con el botón + se puede escribir la fecha, la hora, la categoría y la prioridad en el propio texto: se detectan y se quitan del título. Si algo no era una fecha, toca la × de su etiqueta.') }),
        W.UI.section({ header: W.t('Ejemplos'), items: ex.map(function (e) { return helpRow(e[0], e[1]); }) }),
        W.UI.section({ header: W.t('Atajos'), items: [
          helpRow(W.t('#nombre'), W.t('Categoría (por ejemplo #trabajo)')),
          helpRow('!  ·  !!  ·  !!!', W.t('Destacada · importante · urgente')),
          helpRow(W.t('cada día · cada semana · cada lunes'), W.t('Repeticiones'))
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
    rows.push(W.UI.cell({ icon: 'plus', title: W.t('Nueva categoría'), accent: true, chevron: false,
      onTap: function () { W.Lists.edit(null, function () { nav.refresh(); }); } }));
    return { title: W.t('Categorías'), body: [W.UI.section({ items: rows, footer: W.t('Toca una categoría para cambiarle el nombre, el icono o eliminarla.') })] };
  }

  /** Android 12+: avisos a la hora exacta (permiso «Alarmas y recordatorios») */
  function exactCell(nav) {
    var b = window.WhiderAndroid;
    if (!b || typeof b.exactAlarms !== 'function') return null;
    var state;
    try { state = b.exactAlarms(); } catch (e) { return null; }
    if (state === 'unneeded') return null;
    var on = state === 'granted';
    return W.UI.section({ items: [W.UI.cell({ icon: 'alarm', title: W.t('Avisos a la hora exacta'), value: on ? W.t('Permitidos') : W.t('Sin permiso'),
      onTap: on ? null : function () { b.requestExactAlarms(); setTimeout(function () { nav.refresh(); }, 2500); } })],
      footer: on ? W.t('Los recordatorios suenan a su hora aunque el teléfono esté ahorrando batería.') : W.t('Sin este permiso, Android puede retrasar los avisos unos minutos. Tócalo y activa «Permitir alarmas y recordatorios».') });
  }

  function alertsPage(nav) {
    var st = S(), cfg = st.settings, set = st.setSetting, q = cfg.quietHours;
    var perm = W.Notify.permission();
    var permText = { granted: W.t('Activadas'), denied: W.t('Bloqueadas'), unsupported: W.t('No disponibles'), 'default': W.t('Desactivadas') }[perm] || perm;
    var quiet = [toggleCell({ icon: 'moon', title: W.t('Horas de silencio'), value: q.enabled, onChange: function (v) { q.enabled = v; st.saveSettings('settings:quiet'); nav.refresh(); } })];
    if (q.enabled) {
      quiet.push(W.UI.cell({ title: W.t('Desde'), right: timePill(q.from, function (v) { q.from = v; st.saveSettings('settings:quiet'); }) }));
      quiet.push(W.UI.cell({ title: W.t('Hasta'), right: timePill(q.to, function (v) { q.to = v; st.saveSettings('settings:quiet'); }) }));
    }
    return {
      title: W.t('Avisos'),
      body: [
        W.UI.section({ items: [W.UI.cell({ icon: 'bell', title: W.t('Notificaciones'), value: permText,
          onTap: perm === 'default' ? function () { W.Notify.request(); setTimeout(function () { nav.refresh(); }, 1500); } : null })],
          footer: perm === 'denied' ? W.t('Están bloqueadas: actívalas en los ajustes del teléfono para recibir los avisos.') : null }),
        exactCell(nav),
        W.UI.group([
          toggleCell({ icon: 'alert', title: W.t('Avisar en las tareas nuevas'), value: cfg.defaultWarn, onChange: function (v) { set('defaultWarn', v); } }),
          menuCell({ icon: 'alarm', title: W.t('Recordatorio previo'), value: cfg.remindBefore, options: W.Editor.REMIND_OPTS, onChange: function (v) { set('remindBefore', v); } }, nav),
          menuCell({ icon: 'repeat', title: W.t('Repetir alerta vencida'), value: cfg.rewarn, options: REWARN, onChange: function (v) { set('rewarn', v); } }, nav)
        ]),
        W.UI.group([W.UI.cell({ icon: 'sound', title: W.t('Sonidos de los avisos'), value: cfg.sound && cfg.sounds.notify ? W.t('Activados') : W.t('Desactivados'), onTap: function () { nav.push(soundsPage); } })]),
        W.UI.section({ items: quiet, footer: W.t('Durante las horas de silencio no suenan avisos ni llegan notificaciones.') }),
        W.UI.group([W.UI.cell({ title: W.t('Probar el aviso'), accent: true, center: true, onTap: function () { W.Audio.warning(); W.Audio.vibrate([70, 60, 70]); } })])
      ]
    };
  }

  /** Sonidos: botones, avisos y confirmaciones por separado, estilo y volumen */
  function soundsPage(nav) {
    var st = S(), cfg = st.settings, snd = cfg.sounds;
    var setS = function (k, v) { snd[k] = v; st.saveSettings('settings:sounds'); };
    var styles = Object.keys(W.Audio.STYLES).map(function (k) { return { value: k, label: W.Audio.STYLES[k] }; });
    var vol = U.el('input.range', { attrs: { type: 'range', min: 0, max: 100, step: 5, 'aria-label': W.t('Volumen') } });
    vol.value = snd.volume;
    var volVal = U.el('span.range-val', { text: snd.volume + ' %' });
    vol.addEventListener('input', function () { volVal.textContent = vol.value + ' %'; });
    vol.addEventListener('change', function () { setS('volume', +vol.value); W.Audio.success(); });
    var rows = cfg.sound ? [
      W.UI.section({ header: W.t('Qué suena'), items: [
        toggleCell({ icon: 'hand', title: W.t('Botones'), sub: W.t('Un toque breve al pulsar'), value: snd.buttons, onChange: function (v) { setS('buttons', v); if (v) W.Audio.click(); } }),
        toggleCell({ icon: 'bell', title: W.t('Avisos y notificaciones'), sub: W.t('Recordatorios y tareas vencidas'), value: snd.notify, onChange: function (v) { setS('notify', v); if (v) W.Audio.chime(); } }),
        toggleCell({ icon: 'check', title: W.t('Confirmaciones'), sub: W.t('Completar tareas y terminar el día'), value: snd.events !== false, onChange: function (v) { setS('events', v); if (v) W.Audio.complete(); } })
      ] }),
      W.UI.section({ header: W.t('Estilo de los botones'), items: U.el('div', [W.UI.segmented(styles, snd.style, function (v) { setS('style', v); W.Audio.click(v); })]) }),
      W.UI.section({ header: W.t('Volumen'), items: U.el('div.group', [U.el('div.cell.range-row', [U.icon('sound', 'sm'), vol, volVal])]) }),
      W.UI.group([
        W.UI.cell({ title: W.t('Probar un aviso'), accent: true, center: true, onTap: function () { W.Audio.chime(); } }),
        W.UI.cell({ title: W.t('Probar una confirmación'), accent: true, center: true, onTap: function () { W.Audio.complete(); } })
      ])
    ] : [];
    return {
      title: W.t('Sonidos y vibración'),
      body: [
        W.UI.section({ items: [toggleCell({ icon: 'sound', title: W.t('Sonidos'), value: cfg.sound, onChange: function (v) { st.setSetting('sound', v); nav.refresh(); if (v) W.Audio.success(); } })],
          footer: cfg.sound ? null : W.t('Sin sonidos: ni botones, ni avisos, ni confirmaciones.') })
      ].concat(rows).concat([
        W.UI.section({ items: [toggleCell({ icon: 'vibrate', title: W.t('Vibración'), value: cfg.vibrate, onChange: function (v) { st.setSetting('vibrate', v); if (v) W.Audio.vibrate([20]); } })],
          footer: W.t('Las horas de silencio (en Avisos) también callan los sonidos de los avisos.') })
      ])
    };
  }

  /** Lo que ves: la pestaña Personas y, en el ordenador, la barra lateral, el calendario y el orden de las categorías */
  function customPage(nav) {
    var st = S(), cfg = st.settings, dk = cfg.desk, desk = W.Layout.desktop;
    var people = W.UI.section({ header: W.t('Pestañas'), items: [
      toggleCell({ icon: 'users', title: W.t('Personas'), sub: W.t('Chats, contactos y equipos'), value: cfg.peopleTab !== false, onChange: function (v) { st.setSetting('peopleTab', v); } })
    ], footer: W.t('Si no trabajas con otras personas, quítala y la barra se queda con lo tuyo: Inicio, Tareas, Calendario y Cuaderno.') });
    if (!desk) return { title: W.t('Lo que ves'), body: [people, U.el('p.hint', { text: W.t('En el ordenador también eliges cómo se ve la barra lateral y el calendario.') })] };
    var saveDesk = function () { st.saveSettings('settings:desk'); };
    var sb = dk.sidebar;
    var lists = st.lists.map(function (l, i) {
      return U.el('div.cell.order-row', [W.UI.cellIcon(W.Lists.icon(l)), U.el('span.cell-title', { text: l.name }),
        U.el('span.order-btns', [U.el('button.circle-btn', { attrs: { 'aria-label': W.t('Subir'), disabled: i === 0 }, on: { click: function () { st.moveList(l.id, -1); nav.refresh(); } } }, [U.icon('up')]),
          U.el('button.circle-btn', { attrs: { 'aria-label': W.t('Bajar'), disabled: i === st.lists.length - 1 }, on: { click: function () { st.moveList(l.id, 1); nav.refresh(); } } }, [U.icon('down')])])]);
    });
    var calViews = [{ value: 'month', label: W.t('Mes') }, { value: 'week', label: W.t('Semana') }, { value: 'day', label: W.t('Día') }, { value: 'agenda', label: W.t('Agenda') }];
    var hour = function (v) { return U.pad(v) + ':00'; };
    return {
      title: W.t('Lo que ves'),
      body: [
        people,
        W.UI.section({ header: W.t('Barra lateral'), items: [
          toggleCell({ icon: 'filter', title: W.t('Filtros guardados'), value: sb.filters !== false, onChange: function (v) { sb.filters = v; saveDesk(); } }),
          toggleCell({ icon: 'hash', title: W.t('Mostrar los contadores'), value: sb.counts !== false, onChange: function (v) { sb.counts = v; saveDesk(); } }),
          toggleCell({ icon: 'list', title: W.t('Barra compacta'), value: !!sb.compact, onChange: function (v) { sb.compact = v; saveDesk(); } })
        ] }),
        W.UI.section({ header: W.t('Calendario'), items: [
          menuCell({ icon: 'calendar', title: W.t('Vista al abrir'), value: dk.calView, options: calViews, onChange: function (v) { dk.calView = v; st.ui.calView = v; saveDesk(); } }, nav),
          W.UI.cell({ icon: 'clock', title: W.t('La semana empieza a las'), right: W.UI.stepper(dk.calStartH, 0, 12, 1, function (v) { dk.calStartH = v; saveDesk(); }, hour) }),
          W.UI.cell({ icon: 'moon', title: W.t('Y termina a las'), right: W.UI.stepper(dk.calEndH, 13, 23, 1, function (v) { dk.calEndH = v; saveDesk(); }, hour) }),
          toggleCell({ icon: 'week', title: W.t('Mostrar los fines de semana'), value: dk.weekends !== false, onChange: function (v) { dk.weekends = v; saveDesk(); } }),
          toggleCell({ icon: 'inbox', title: W.t('Panel «Por planificar»'), sub: W.t('Tareas sin fecha y vencidas junto al calendario, para arrastrarlas a un día y una hora'), value: dk.plan !== false, onChange: function (v) { dk.plan = v; saveDesk(); } })
        ] }),
        W.UI.section({ header: W.t('Pantalla'), items: [
          toggleCell({ icon: 'monitor', title: W.t('Contenido a todo el ancho'), sub: W.t('Aprovecha las pantallas grandes'), value: !!dk.wide, onChange: function (v) { dk.wide = v; saveDesk(); } })
        ] }),
        W.UI.section({ header: W.t('Orden de las categorías'), items: lists }),
        W.UI.section({ header: W.t('Filtros guardados'), items: st.filters.map(function (f) {
          return W.UI.cell({ icon: 'filter', title: f.name, sub: W.Filters.describe(f), onTap: function () { W.Filters.edit(f, function () { nav.refresh(); }); } });
        }).concat([W.UI.cell({ icon: 'plus', title: W.t('Nuevo filtro'), accent: true, chevron: false, onTap: function () { W.Filters.edit(null, function () { nav.refresh(); }); } })]) })
      ]
    };
  }

  function startPage(nav) {
    var st = S();
    return {
      title: W.t('Pantalla al abrir'),
      body: [W.UI.section({ items: SCREENS.map(function (o) {
        return W.UI.cell({ title: o.label, right: o.value === st.settings.startScreen ? U.icon('check', 'sm') : null, cls: o.value === st.settings.startScreen ? 'accent' : null,
          onTap: function () { st.setSetting('startScreen', o.value); nav.pop(); } });
      }), footer: W.t('La pestaña que verás cada vez que abras WHIDER.') })]
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

  function exportCsv() {
    var st = S(), cell = function (v) { var s = v == null ? '' : String(v); return /[";\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
    var rows = [[W.t('Tarea'), W.t('Categoría'), W.t('Prioridad'), W.t('Fecha'), W.t('Hora'), W.t('Duración (min)'), W.t('Repetición'), W.t('Estado'), W.t('Completada el'), W.t('Notas')]];
    st.tasks.forEach(function (t) {
      var l = st.getList(t.listId);
      rows.push([t.text, l ? l.name : '', st.PRIORITIES[t.highlight].label, t.date || '', t.time || '', t.duration || '', st.REPEATS[t.repeat], t.done ? W.t('Completada') : st.isOverdue(t) ? W.t('Vencida') : W.t('Pendiente'), t.doneAt ? new Date(t.doneAt).toLocaleString(W.I18n.locale) : '', t.notes || '']);
    });
    U.saveFile('whider-tareas-' + U.today(), rows.map(function (r) { return r.map(cell).join(';'); }).join('\r\n'), 'csv');
  }
  /** Copia completa: también el Cuaderno (fichas y contenido de cada página, salvo las de equipo) */
  function exportBackup() { W.Backup.download(); }
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
    pickFile('.json,application/json').then(function (f) { if (f) restoreText(f.text); });
  }
  /** Recuperar una copia (de un archivo o de las copias automáticas del ordenador): se junta con lo que hay */
  function restoreText(text) {
    (function () {
      var data = null;
      try { data = JSON.parse(text); } catch (e) { data = null; }
      if (!data || !Array.isArray(data.tasks)) { W.Toast.show({ text: W.t('No es una copia de WHIDER'), type: 'danger' }); return; }
      W.Sheet.confirm({ title: W.t('¿Recuperar la copia?'), text: W.t('Se juntará con lo que ya tienes ({what}). Gana siempre lo más reciente.', { what: U.plural(data.tasks.length, 'tarea', 'tareas') + (data.pages ? ', ' + U.plural(data.pages.length, 'página', 'páginas') : data.notes ? ', ' + U.plural(data.notes.length, 'apunte', 'apuntes') : '') }), ok: W.t('Recuperar') }).then(function (ok) {
        if (!ok) return;
        var merged = W.Sync.merge(S().snapshot(), data);
        S().applySnapshot(merged, 'import');
        var np = W.Pages && data.pages ? importPages(data.pages) : 0;
        W.Toast.show({ text: np ? W.t('Copia recuperada ({n} del Cuaderno)', { n: U.plural(np, 'página', 'páginas') }) : W.t('Copia recuperada'), type: 'success', icon: 'upload' });
      });
    })();
  }
  /** Ordenador: las copias automáticas guardadas, para recuperar una o abrir la carpeta */
  function backupsPage(nav) {
    var D = W.Backup.desktop(), host = U.el('div', [U.el('p.hint', { text: W.t('Cargando…') })]);
    D.list().then(function (list) {
      U.clear(host);
      host.appendChild(list.length ? W.UI.section({ items: list.map(function (f) {
        var day = /(\d{4}-\d{2}-\d{2})/.exec(f.name)[1];
        return W.UI.cell({ icon: 'shield', title: U.cap(U.fmtDay(day)), sub: W.t('{0} KB', { 0: Math.max(1, Math.round(f.size / 1000)) }),
          right: U.el('button.btn.xs.soft', { text: W.t('Recuperar'), attrs: { type: 'button', 'aria-label': W.t('Recuperar la copia del {0}', { 0: U.fmtDay(day) }) }, on: { click: function () {
            D.read(f.name).then(function (text) { if (text) restoreText(text); else W.Toast.show({ text: W.t('No se pudo leer la copia'), type: 'danger' }); });
          } } }) });
      }), footer: W.t('Se guardan las 10 últimas. Recuperar una copia la junta con lo que tienes: gana lo más reciente.') }) : U.el('p.hint', { text: W.t('Todavía no hay copias automáticas.') }));
    }).catch(function () { U.clear(host); host.appendChild(U.el('p.hint', { text: W.t('No se pudieron leer las copias.') })); });
    return { title: W.t('Copias automáticas'), body: [host, U.el('div.cell-row', { style: { justifyContent: 'center', padding: '8px 0' } }, [
      U.el('button.btn.sm.soft', { text: W.t('Abrir la carpeta'), attrs: { type: 'button' }, on: { click: function () { D.open(); } } })])] };
  }

  /** Archivar a mano las completadas antiguas (elige desde cuándo) */
  function archiveNow(nav) {
    var day = 86400000;
    W.Sheet.choose({ title: W.t('Archivar las tareas completadas…'), options: [
      { value: 365, label: W.t('Hace más de un año') }, { value: 180, label: W.t('Hace más de 6 meses') }, { value: 90, label: W.t('Hace más de 3 meses') }
    ] }).then(function (days) {
      if (!days) return;
      var gone = S().archiveDone(Date.now() - days * day);
      if (!gone.length) { W.Toast.show({ text: W.t('No hay tareas completadas tan antiguas'), icon: 'info' }); return; }
      if (W.Sync) W.Sync.archiveRemote(gone);
      W.Toast.show({ text: U.plural(gone.length, 'tarea archivada', 'tareas archivadas'), icon: 'inbox' });
      nav.refresh();
    });
  }
  /** Ver el archivo: por meses, de lo más reciente a lo más antiguo, y exportarlo */
  function archiveView() {
    var list = S().archived().slice().reverse(), groups = {}, order = [];
    list.forEach(function (t) {
      var d = new Date(t.doneAt || t.createdAt || 0), k = W.t('{month} de {year}', { month: U.cap(U.MONTHS[d.getMonth()]), year: d.getFullYear() });
      if (!groups[k]) { groups[k] = []; order.push(k); }
      groups[k].push(t);
    });
    var body = order.slice(0, 24).map(function (k) {
      return W.UI.section({ header: k + ' · ' + groups[k].length, items: groups[k].slice(0, 60).map(function (t) { return W.UI.cell({ title: t.text, sub: t.doneOn ? W.t('Completada {0}', { 0: U.inline(U.fmtDay(t.doneOn)) }) : null }); }) });
    });
    if (order.length > 24) body.push(U.el('p.hint', { text: W.t('Y más meses: exporta el archivo para verlo entero.') }));
    var csv = function () {
      var esc = function (v) { v = String(v == null ? '' : v); return /[",\n;]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
      var rows = [[W.t('Tarea'), W.t('Completada'), W.t('Fecha'), W.t('Hora'), W.t('Notas')]].concat(S().archived().map(function (t) { return [t.text, t.doneOn || '', t.date || '', t.time || '', t.notes || '']; }));
      U.saveFile('whider-archivo.csv', '\ufeff' + rows.map(function (r) { return r.map(esc).join(','); }).join('\r\n'), 'text/csv');
    };
    W.Sheet.open({ title: W.t('Archivo') + ' · ' + U.plural(list.length, 'tarea', 'tareas'), body: body.length ? body : [U.el('p.hint', { text: W.t('Todavía no hay nada archivado.') })],
      foot: [U.el('button.btn.primary', { text: W.t('Exportar (CSV)'), on: { click: csv } })] });
  }

  function dataPage(nav) {
    var st = S(), desk = W.Layout.desktop;
    var signed = !!(W.Auth && W.Auth.user), size = W.Sync ? W.Sync.size : 0, archived = st.archived().length;
    var kb = function (b) { return b >= 1000 * 1000 ? (b / 1000000).toFixed(2).replace('.', ',') + ' MB' : Math.max(1, Math.round(b / 1000)) + ' KB'; };
    return {
      title: W.t('Datos'),
      body: [
        W.UI.section({ header: W.t('Espacio y archivo'), items: [
          signed ? W.UI.cell({ icon: 'cloud', title: W.t('Copia en la nube'), value: size ? W.t('{size} de 1 MB', { size: kb(size) }) : W.t('Se mide al sincronizar') }) : null,
          W.UI.cell({ icon: 'inbox', title: W.t('Archivar completadas antiguas'), sub: W.t('Salen de las listas; las estadísticas no cambian'), onTap: function () { archiveNow(nav); } }),
          W.UI.cell({ icon: 'tray', title: W.t('Archivo'), value: archived ? String(archived) : W.t('Vacío'), onTap: archiveView })
        ].filter(Boolean), footer: signed && size > (W.Sync.SIZE_WARN || 0)
          ? W.t('Tu copia en la nube se acerca al límite de 1 MB: WHIDER archiva sola las tareas completadas hace más de un año.')
          : W.t('Las tareas completadas hace más de un año se archivan solas si la copia en la nube se acerca a su límite.') }),
        W.UI.section({ header: W.t('Copia de seguridad'), items: [
          W.Backup.where() ? toggleCell({ icon: 'shield', title: W.t('Copia automática cada día'), sub: W.Backup.status(), value: W.Backup.enabled(), onChange: function (v) { W.Backup.setEnabled(v); setTimeout(function () { nav.refresh(); }, 400); } }) : null,
          W.Backup.where() === 'desktop' ? W.UI.cell({ icon: 'tray', title: W.t('Copias guardadas'), sub: W.t('Recuperar una o abrir la carpeta'), onTap: function () { nav.push(backupsPage); } }) : null,
          W.UI.cell({ icon: 'download', title: W.t('Guardar una copia'), sub: W.Backup.where() ? W.t('Todo: tareas, Cuaderno y ajustes (JSON)') : W.Backup.status(), onTap: function () { exportBackup(); setTimeout(function () { nav.refresh(); }, 300); } }),
          W.UI.cell({ icon: 'upload', title: W.t('Recuperar una copia'), sub: W.t('Se junta con lo que ya tienes'), onTap: importBackup })
        ].filter(Boolean), footer: W.Backup.where() === 'android' ? W.t('La copia automática va a Descargas › WHIDER › Copias (las 7 últimas) y sigue ahí aunque desinstales la app.')
          : W.Backup.where() === 'desktop' ? W.t('La copia automática va a la carpeta de datos de WHIDER (las 10 últimas).')
          : W.Auth && W.Auth.user ? W.t('Con tu cuenta, todo se guarda además en la nube.') : W.t('Sin cuenta, tus datos solo están en este navegador: guarda una copia de vez en cuando (te lo recordaremos cada semana).') }),
        W.UI.section({ header: W.t('Importar y exportar'), items: [
          W.UI.cell({ icon: 'upload', title: W.t('Importar desde otras apps'), sub: W.t('Todoist, Google Tasks, Notion, calendarios (.ics) u hojas de cálculo'), onTap: function () { nav.close(); setTimeout(function () { W.ImportWizard.open(); }, 250); } }),
          W.ImportWizard.last() ? W.UI.cell({ icon: 'undo', title: W.t('Deshacer la última importación'), sub: W.t('{n} de {from}', { n: U.plural(W.ImportWizard.last().ids.length, 'tarea', 'tareas'), from: W.ImportWizard.last().from }) + ' · ' + U.fmtRel(W.ImportWizard.last().at - Date.now()),
            onTap: function () { W.ImportWizard.undo(); nav.refresh(); } }) : null,
          desk ? W.UI.cell({ icon: 'download', title: W.t('Exportar las tareas (CSV)'), sub: W.t('Para Excel, Numbers o Google Sheets'), onTap: exportCsv }) : null
        ].filter(Boolean) }),
        W.UI.section({ items: [W.UI.cell({ title: W.t('Restablecer todo'), center: true, danger: true, onTap: function () {
          W.Sheet.confirm({ title: W.t('¿Restablecer WHIDER?'), text: W.t('Se borrarán tus tareas y tu Cuaderno. No se puede deshacer.'), ok: W.t('Restablecer'), danger: true })
            .then(function (ok) { if (ok) { st.resetAll(); nav.close(); W.Toast.show({ text: W.t('Se han borrado todos los datos'), icon: 'trash' }); } });
        } })], footer: (W.Auth && W.Auth.user ? W.t('Borra tus tareas y tu Cuaderno, también en tu cuenta.') : W.t('Borra tus tareas y tu Cuaderno.')) + ' ' + W.t('Tus categorías y ajustes se conservan.') })
      ]
    };
  }

  /** App de escritorio: abrir al iniciar el ordenador y seguir en la bandeja al cerrar */
  function desktopPage(nav) {
    var D = window.WhiderDesktop, prefs = W.DesktopPrefs || {};
    var set = function (k, v) { prefs[k] = v; W.DesktopPrefs = prefs; if (D) D.setSetting(k, v); nav.refresh(); };
    var tray = D && D.platform === 'darwin' ? W.t('el Dock') : W.t('la bandeja del sistema');
    return {
      title: W.t('App de escritorio'),
      body: [
        W.UI.section({ items: [toggleCell({ icon: 'power', title: W.t('Abrir WHIDER al iniciar el ordenador'), value: !!prefs.openAtLogin, onChange: function (v) { set('openAtLogin', v); } })],
          footer: W.t('Se abre en segundo plano, sin ventana, para que los avisos lleguen desde el primer momento.') }),
        W.UI.section({ items: [toggleCell({ icon: 'bell', title: W.t('Seguir abierta al cerrar la ventana'), value: prefs.closeToTray !== false, onChange: function (v) { set('closeToTray', v); } })],
          footer: W.t('WHIDER sigue en {tray} y te avisa de tus tareas aunque no tengas la ventana abierta. Para salir del todo, usa «Salir» en su menú.', { tray: tray }) }),
        W.UI.section({ header: W.t('Actualizaciones'), items: [W.Updates.cell(nav)],
          footer: D && D.platform === 'darwin' ? W.t('En el Mac, WHIDER te avisa cuando hay una versión nueva y la descargas tú (sin la firma de pago de Apple no puede instalarse sola).')
            : W.t('Las versiones nuevas se descargan solas y se instalan al cerrar WHIDER. Si la instalaste con el paquete .deb, te avisa y la descargas tú.') })
      ]
    };
  }

  /** Personas bloqueadas, con «Desbloquear» */
  function blockedPage(nav) {
    var m = W.People ? W.People.blocked() : {}, ids = Object.keys(m);
    return {
      title: W.t('Personas bloqueadas'),
      body: [ids.length ? W.UI.section({ items: ids.map(function (id) {
        return W.UI.cell({ icon: 'hand', title: m[id].name || W.t('Persona bloqueada'), sub: W.t('Desde {0}', { 0: U.fmtRel(m[id].at - Date.now()) }),
          right: U.el('button.btn.xs.soft', { text: W.t('Desbloquear'), on: { click: function () { W.People.unblock(id).catch(function () {}).then(function () { nav.refresh(); }); } } }) });
      }), footer: W.t('Quien está bloqueado no puede enviarte solicitudes ni mensajes en un chat de dos.') }) : U.el('p.hint', { text: W.t('No has bloqueado a nadie.') })]
    };
  }

  function privacyPage(nav) {
    var base = ((window.WHIDER_CONFIG || {}).links || {}).base || 'https://whider-red.vercel.app';
    var nBlocked = W.People ? Object.keys(W.People.blocked()).length : 0;
    return {
      title: W.t('Privacidad'),
      body: [
        W.UI.group([W.UI.cell({ icon: 'hand', title: W.t('Personas bloqueadas'), value: nBlocked ? String(nBlocked) : W.t('Nadie'), onTap: function () { nav.push(blockedPage); } })]),
        W.UI.section({ items: [toggleCell({ icon: 'alert', title: W.t('Enviar informes de errores'), value: W.Errors.enabled(), onChange: function (v) { W.Errors.setEnabled(v); nav.refresh(); } })],
          footer: W.t('Si algo falla, WHIDER envía qué falló, la versión y el sistema, sin tu nombre ni tu cuenta y nunca tus tareas ni tu Cuaderno. Necesita cuenta. Apagado, los errores solo se guardan en este dispositivo (Ajustes → Ayuda).') }),
        U.el('div.legal', { html: W.PRIVACY_HTML }),
        W.UI.group([W.UI.cell({ icon: 'external', title: W.t('Política de privacidad completa'), sub: W.t('Qué datos se guardan, para qué y tus derechos'), onTap: function () { U.openExternal(base + '/privacidad/'); } })])
      ]
    };
  }

  // Cada párrafo, entero y con su HTML, es una clave del catálogo (js/i18n/en.js)
  W.PRIVACY_HTML = [
    W.t('<p><b>Qué guardamos.</b> Tu nombre, tu correo y lo que creas en la app: tareas (también las de cada día), categorías, tu Cuaderno, tus chats y ajustes. Si usaste una versión anterior, sus datos (hábitos, enfoque, marcas y personaje) se conservan en tu cuenta aunque la app ya no los muestre.</p>'),
    W.t('<p><b>Dónde.</b> En tu cuenta de WHIDER, alojada en Google Firebase, y en tu dispositivo, para que funcione sin conexión. Entras con Google, Microsoft o Apple: comprueban quién eres y nos dan tu nombre y tu correo.</p>'),
    W.t('<p><b>Personas y chats.</b> Tus contactos ven tu perfil público: tu nombre y tu foto (o tu inicial). Nunca ven tus tareas ni tu Cuaderno. Los mensajes de un chat solo los leen sus miembros, y las páginas de un equipo, solo sus miembros. Los chats van cifrados en tránsito y en los servidores, pero no de extremo a extremo.</p>'),
    W.t('<p><b>Bloquear y denunciar.</b> Quien bloqueas no puede escribirte ni mandarte mensajes en vuestro chat. Si denuncias, se guarda el motivo y, si es un mensaje, un extracto, para revisarlo.</p>'),
    W.t('<p><b>Comentarios e informes de errores.</b> Son opcionales y van sin tu nombre ni tu cuenta: el texto que escribas, la versión de WHIDER, el sistema y, si lo permites, los errores de la app. Nunca tus tareas ni tu Cuaderno.</p>'),
    W.t('<p><b>Calendarios suscritos.</b> Si añades uno, su enlace va con tus ajustes y sus eventos se quedan en tu dispositivo. El servidor de WHIDER lo descarga por ti sin guardarlo.</p>'),
    W.t('<p><b>Para qué.</b> Solo para que la app funcione. No vendemos ni compartimos tus datos ni mostramos publicidad.</p>'),
    W.t('<p><b>Tus derechos.</b> Puedes exportar tus datos (Ajustes → Datos), cerrar sesión o eliminar tu cuenta y todos sus datos cuando quieras, desde tu cuenta (toca tu foto).</p>'),
    W.t('<p><b>Contraseñas.</b> WHIDER nunca ve ni guarda tu contraseña: la gestiona Firebase Authentication de forma cifrada.</p>')
  ].join('');

  /* ---------- Idioma ---------- */
  var LANGS = { es: 'Español', en: 'English' };
  /** Cambiar el idioma vuelve a abrir la app (los textos se preparan al cargarla); los datos no cambian */
  function chooseLang(anchor) {
    W.Sheet.choose({ anchor: anchor, title: W.t('Idioma'), value: W.I18n.lang, options: Object.keys(LANGS).map(function (l) { return { value: l, label: LANGS[l] }; }) })
      .then(function (l) { if (l && l !== W.I18n.lang) W.I18n.set(l); });
  }

  var PAGES = { desktop: desktopPage, account: accountPage, appearance: appearancePage, tasks: tasksPage, lists: listsPage, alerts: alertsPage, start: startPage,
    data: dataPage, privacy: privacyPage, sounds: soundsPage, custom: customPage, calendars: function (nav) { return W.CalSubs.page(nav); } };
  var current = null;

  W.Settings = {
    /** Abre los ajustes (opcionalmente directamente en una página: 'account', 'privacy'…) */
    open: function (page) {
      if (current) return current;
      current = W.Sheet.navigator(rootPage, { onClose: function () { current = null; } });
      if (page && PAGES[page]) current.push(PAGES[page]);
      return current;
    },
    isOpen: function () { return !!current; },
    refresh: function () { if (current) current.refresh(); },
    /** El selector de idioma (también desde el menú de tu cuenta) y el nombre del idioma actual */
    chooseLang: chooseLang,
    langName: function () { return LANGS[W.I18n.lang] || 'Español'; }
  };
})(window.Whider);
