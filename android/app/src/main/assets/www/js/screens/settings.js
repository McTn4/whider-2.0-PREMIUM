/**
 * WHIDER · Ajustes: personalización completa de apariencia, inicio, tareas,
 * listas, enfoque, avisos y datos.
 */
window.Whider = window.Whider || {};
window.Whider.Screens = window.Whider.Screens || {};

(function (W) {
  'use strict';
  var U = W.U, S = function () { return W.State; };
  var SCREENS = [
    { value: 'home', label: 'Inicio', icon: 'home' }, { value: 'tasks', label: 'Tareas', icon: 'tasks' },
    { value: 'calendar', label: 'Agenda', icon: 'calendar' }, { value: 'focus', label: 'Enfoque', icon: 'timer' }
  ];
  var REWARN = [{ value: 0, label: 'Solo una vez' }, { value: 10, label: 'Cada 10 minutos' }, { value: 20, label: 'Cada 20 minutos' }, { value: 60, label: 'Cada hora' }];
  var SECTIONS = [
    { k: 'summary', label: 'Rendimiento de hoy', icon: 'target' }, { k: 'actions', label: 'Accesos rápidos', icon: 'grid' },
    { k: 'next', label: 'Siguiente paso', icon: 'bolt' }, { k: 'agenda', label: 'Agenda de hoy', icon: 'calendar' },
    { k: 'week', label: 'Últimos 7 días', icon: 'chart' }
  ];

  function labelOf(arr, v) { for (var i = 0; i < arr.length; i++) if (arr[i].value === v) return arr[i].label; return ''; }

  function editList(list) {
    var st = S(), color = list ? list.color : 'iris';
    var sw = W.UI.swatches(color, function (c) { color = c; }, true);
    W.Sheet.prompt({ title: list ? 'Editar lista' : 'Nueva lista', value: list ? list.name : '', placeholder: 'Nombre de la lista', maxLength: 24,
      ok: list ? 'Guardar' : 'Crear', extra: [U.el('span.field-label', { text: 'Color' }), sw] })
      .then(function (name) {
        if (!name) return;
        if (list) st.updateList(list.id, { name: name, color: color });
        else st.addList(name, color);
        W.Toast.show({ text: list ? 'Lista actualizada' : 'Lista "' + name + '" creada', type: 'success', icon: 'layers' });
        manageLists();
      });
  }

  function manageLists() {
    var st = S();
    var rows = st.lists.map(function (l) {
      var count = st.tasks.filter(function (t) { return t.listId === l.id && !t.done; }).length;
      return U.el('div.row', [
        U.el('span.dot.big', { style: { '--c': st.ACCENTS[l.color].a } }),
        U.el('span.row-main', [U.el('span.row-label', { text: l.name }), U.el('span.row-desc', { text: U.plural(count, 'pendiente', 'pendientes') })]),
        U.el('button.icon-btn', { attrs: { 'aria-label': 'Editar ' + l.name }, on: { click: function () { s.close(); editList(l); } } }, [U.icon('edit', 'sm')]),
        st.lists.length > 1 ? U.el('button.icon-btn', { attrs: { 'aria-label': 'Eliminar ' + l.name }, on: { click: function () {
          s.close();
          W.Sheet.confirm({ title: '¿Eliminar "' + l.name + '"?', text: 'Las tareas de esta lista no se borran: quedarán sin lista.', ok: 'Eliminar', danger: true })
            .then(function (ok) { if (ok) { st.removeList(l.id); W.Toast.show({ text: 'Lista eliminada', icon: 'trash' }); } manageLists(); });
        } } }, [U.icon('trash', 'sm')]) : null
      ]);
    });
    var s = W.Sheet.open({ title: 'Tus listas', body: [U.el('div.group', rows), U.el('p.hint', { text: 'Usa las listas para separar ámbitos: trabajo, estudios, casa, deporte…' })],
      foot: [U.el('button.btn.primary', { on: { click: function () { s.close(); editList(null); } } }, [U.icon('plus', 'sm'), 'Nueva lista'])] });
  }

  function timeInput(value, onChange) {
    var i = U.el('input.input.time-mini', { attrs: { type: 'time', value: value } });
    i.addEventListener('change', function () { if (i.value) onChange(i.value); });
    return i;
  }

  function accountGroup(rerender) {
    var A = W.Auth;
    if (!A || !A.configured()) return null;
    var u = A.user;
    if (!u) {
      return U.el('div.group', [
        W.UI.row({ icon: 'cloud', label: 'Crea tu cuenta o inicia sesión', desc: 'Guarda tus tareas y marcas en la nube y recupéralas en cualquier dispositivo. No perderás lo que ya tienes.',
          onTap: function () { W.AuthScreen.open({ mode: 'register' }); } })
      ]);
    }
    var verified = A.isVerified();
    var syncRow = W.UI.row({ icon: 'cloud', label: 'Copia en la nube', desc: W.Sync.statusText(), onTap: function () {
      if (!verified) { W.AuthScreen.showVerify(); return; }
      W.Sync.push().then(function () { W.Toast.show({ text: 'Sincronizado', type: 'success', icon: 'cloud' }); rerender(); });
    } });
    syncRow.classList.add('sync-row');
    var rows = [
      U.el('div.row.account-row', [
        U.el('div.avatar-xl.sm', [U.el('span', { text: (u.displayName || u.email || 'W').charAt(0).toUpperCase() })]),
        U.el('div.row-main', [U.el('span.row-label', { text: u.displayName || W.State.displayName() || 'Tu cuenta' }), U.el('span.row-desc', { text: u.email || '' })]),
        U.el('span.tag' + (verified ? '.today' : '.late'), [U.icon(A.provider() === 'google' ? 'user' : verified ? 'shield' : 'mail'), A.provider() === 'google' ? 'Google' : verified ? 'Verificada' : 'Sin verificar'])
      ]),
      syncRow
    ];
    if (!verified) rows.push(W.UI.row({ icon: 'mail', label: 'Verificar correo', desc: 'Abre el enlace que te enviamos a ' + u.email, onTap: function () { W.AuthScreen.showVerify(); } }));
    if (A.provider() === 'password') rows.push(W.UI.row({ icon: 'key', label: 'Cambiar contraseña', desc: 'Te enviaremos un enlace seguro por correo', onTap: function () {
      A.resetPassword(u.email).then(function () { W.Toast.show({ text: 'Enlace enviado a ' + u.email, type: 'success', icon: 'mail' }); })
        .catch(function (e) { W.Toast.show({ text: A.message(e), type: 'danger' }); });
    } }));
    rows.push(W.UI.row({ icon: 'logout', label: 'Cerrar sesión', onTap: function () {
      W.Sheet.confirm({ title: '¿Cerrar sesión?', icon: 'logout', text: 'Tus datos quedan guardados en tu cuenta. Al volver a entrar se recuperarán.', ok: 'Cerrar sesión' })
        .then(function (ok) { if (ok) W.App.logout(); });
    } }));
    rows.push(W.UI.row({ icon: 'trash', label: 'Eliminar cuenta', desc: 'Borra tu cuenta y todos sus datos de la nube', danger: true, onTap: function () {
      W.Sheet.confirm({ title: '¿Eliminar tu cuenta?', text: 'Se borrarán tu cuenta y todos tus datos de la nube de forma permanente. Esta acción no se puede deshacer.', ok: 'Eliminar cuenta', danger: true })
        .then(function (ok) { if (ok) W.App.deleteAccount(); });
    } }));
    return U.el('div.group', rows);
  }

  W.Screens.settings = {
    title: 'Ajustes',
    manageLists: manageLists,
    accountGroup: accountGroup,
    render: function (root, fresh) {
      var st = S(), cfg = st.settings, set = st.setSetting;
      var rerender = function () { W.Screens.settings.render(root); };
      var inner = U.el('div.inner.settings' + (fresh ? '.stagger' : ''));
      inner.appendChild(W.UI.pageHead('Hazla tuya', 'Ajustes', 'Adapta WHIDER a tu forma de trabajar.'));

      /* Perfil */
      inner.appendChild(U.el('button.card.profile-row', { on: { click: function () { W.Router.go('progress'); } } }, [
        U.el('div.avatar-xl.sm', [U.el('span', { text: (st.displayName() || 'W').charAt(0).toUpperCase() })]),
        U.el('div.row-main', [U.el('span.row-label', { text: st.displayName() || 'Añade tu nombre' }), U.el('span.row-desc', { text: 'Ver perfil, nivel y logros' })]),
        U.icon('right')
      ]));

      /* Cuenta */
      var acc = W.Screens.settings.accountGroup(rerender);
      if (acc) { inner.appendChild(U.el('h3.group-title', { text: 'Cuenta' })); inner.appendChild(acc); }

      /* Apariencia */
      inner.appendChild(U.el('h3.group-title', { text: 'Apariencia' }));
      inner.appendChild(U.el('div.group', [
        U.el('div.row.col', [U.el('div.row-inline', [U.el('span.row-icon', [U.icon('palette')]), U.el('span.row-main', [U.el('span.row-label', { text: 'Color de acento' }), U.el('span.row-desc', { text: st.ACCENTS[cfg.accent].name })])]),
          W.UI.swatches(cfg.accent, function (k) { set('accent', k); rerender(); })]),
        U.el('div.row.col', [U.el('div.row-inline', [U.el('span.row-icon', [U.icon('type')]), U.el('span.row-main', [U.el('span.row-label', { text: 'Tamaño del texto' })])]),
          W.UI.segmented([{ value: 's', label: 'Pequeño' }, { value: 'm', label: 'Normal' }, { value: 'l', label: 'Grande' }, { value: 'xl', label: 'Enorme' }], cfg.textSize, function (v) { set('textSize', v); })]),
        U.el('div.row.col', [U.el('div.row-inline', [U.el('span.row-icon', [U.icon('layers')]), U.el('span.row-main', [U.el('span.row-label', { text: 'Densidad' })])]),
          W.UI.segmented([{ value: 'comfortable', label: 'Cómoda' }, { value: 'compact', label: 'Compacta' }], cfg.density, function (v) { set('density', v); })]),
        W.UI.row({ icon: 'sparkle', label: 'Fondo animado', desc: 'Luces de color en movimiento detrás de la app', right: W.UI.toggle(cfg.bgEffects, function (v) { set('bgEffects', v); }) }),
        W.UI.row({ icon: 'bolt', label: 'Reducir animaciones', desc: 'Menos movimiento y más ahorro de batería', right: W.UI.toggle(cfg.reduceMotion, function (v) { set('reduceMotion', v); }) })
      ]));

      /* Inicio */
      inner.appendChild(U.el('h3.group-title', { text: 'Inicio' }));
      var sections = SECTIONS.map(function (sc) {
        return W.UI.row({ icon: sc.icon, label: sc.label, right: W.UI.toggle(cfg.homeSections[sc.k], function (v) { cfg.homeSections[sc.k] = v; st.saveSettings('settings:home'); }) });
      });
      inner.appendChild(U.el('div.group', [
        W.UI.row({ icon: 'home', label: 'Pantalla al abrir', value: labelOf(SCREENS, cfg.startScreen), onTap: function () {
          W.Sheet.choose({ title: 'Pantalla al abrir', value: cfg.startScreen, options: SCREENS }).then(function (v) { if (v) { set('startScreen', v); rerender(); } });
        } }),
        W.UI.row({ icon: 'target', label: 'Objetivo diario', desc: 'Tareas que quieres completar cada día', right: W.UI.stepper(cfg.dailyGoal, 1, 30, 1, function (v) { set('dailyGoal', v); }) })
      ].concat(sections)));

      /* Tareas */
      inner.appendChild(U.el('h3.group-title', { text: 'Tareas' }));
      var defList = st.getList(cfg.defaultList);
      inner.appendChild(U.el('div.group', [
        W.UI.row({ icon: 'layers', label: 'Tus listas', value: String(st.lists.length), onTap: manageLists }),
        W.UI.row({ icon: 'inbox', label: 'Lista por defecto', value: defList ? defList.name : 'Ninguna', onTap: function () {
          W.Sheet.choose({ title: 'Lista por defecto', value: cfg.defaultList, options: st.lists.map(function (l) { return { value: l.id, label: l.name, color: st.ACCENTS[l.color].a }; }) })
            .then(function (v) { if (v) { set('defaultList', v); rerender(); } });
        } }),
        W.UI.row({ icon: 'sort', label: 'Orden', value: { smart: 'Inteligente', priority: 'Prioridad', created: 'Recientes', alpha: 'Alfabético' }[cfg.sort], onTap: function () {
          W.Sheet.choose({ title: 'Ordenar tareas', value: cfg.sort, options: [{ value: 'smart', label: 'Inteligente' }, { value: 'priority', label: 'Prioridad' }, { value: 'created', label: 'Más recientes' }, { value: 'alpha', label: 'Alfabético' }] })
            .then(function (v) { if (v) { set('sort', v); rerender(); } });
        } }),
        W.UI.row({ icon: 'check', label: 'Ocultar completadas', right: W.UI.toggle(cfg.hideCompleted, function (v) { set('hideCompleted', v); }) }),
        W.UI.row({ icon: 'trash', label: 'Confirmar antes de eliminar', right: W.UI.toggle(cfg.confirmDelete, function (v) { set('confirmDelete', v); }) }),
        U.el('div.row.col', [U.el('div.row-inline', [U.el('span.row-icon', [U.icon('calendar')]), U.el('span.row-main', [U.el('span.row-label', { text: 'La semana empieza en' })])]),
          W.UI.segmented([{ value: 1, label: 'Lunes' }, { value: 0, label: 'Domingo' }], cfg.weekStart, function (v) { set('weekStart', v); })]),
        U.el('div.row.col', [U.el('div.row-inline', [U.el('span.row-icon', [U.icon('clock')]), U.el('span.row-main', [U.el('span.row-label', { text: 'Formato de hora' })])]),
          W.UI.segmented([{ value: '24', label: '24 h (18:30)' }, { value: '12', label: '12 h (6:30 p. m.)' }], cfg.timeFormat, function (v) { set('timeFormat', v); })])
      ]));

      /* Avisos */
      inner.appendChild(U.el('h3.group-title', { text: 'Avisos y sonido' }));
      var perm = W.Notify.permission();
      var permText = { granted: 'Activadas', denied: 'Bloqueadas', unsupported: 'No disponibles', 'default': 'Sin activar' }[perm] || perm;
      var q = cfg.quietHours;
      var quietRows = [W.UI.row({ icon: 'moon', label: 'Horas de silencio', desc: 'Sin sonidos ni notificaciones en ese horario', right: W.UI.toggle(q.enabled, function (v) { q.enabled = v; st.saveSettings('settings:quiet'); rerender(); }) })];
      if (q.enabled) quietRows.push(U.el('div.row.quiet-times', [U.el('span', { text: 'Desde' }), timeInput(q.from, function (v) { q.from = v; st.saveSettings('settings:quiet'); }),
        U.el('span', { text: 'hasta' }), timeInput(q.to, function (v) { q.to = v; st.saveSettings('settings:quiet'); })]));
      inner.appendChild(U.el('div.group', [
        W.UI.row({ icon: 'bell', label: 'Notificaciones del sistema', value: permText, onTap: perm === 'granted' || perm === 'unsupported' ? null : function () { W.Notify.request(); } }),
        W.UI.row({ icon: 'alert', label: 'Avisar por defecto', desc: 'Las tareas nuevas avisan si no se cumplen', right: W.UI.toggle(cfg.defaultWarn, function (v) { set('defaultWarn', v); }) }),
        W.UI.row({ icon: 'clock', label: 'Recordatorio previo', value: W.Editor.remindLabel(cfg.remindBefore), onTap: function () {
          W.Sheet.choose({ title: 'Recordatorio previo', value: cfg.remindBefore, options: W.Editor.REMIND_OPTS }).then(function (v) { if (v !== undefined) { set('remindBefore', v); rerender(); } });
        } }),
        W.UI.row({ icon: 'repeat', label: 'Repetir alerta vencida', value: labelOf(REWARN, cfg.rewarn), onTap: function () {
          W.Sheet.choose({ title: 'Repetir alerta', value: cfg.rewarn, options: REWARN }).then(function (v) { if (v !== undefined) { set('rewarn', v); rerender(); } });
        } }),
        W.UI.row({ icon: 'sound', label: 'Sonidos', right: W.UI.toggle(cfg.sound, function (v) { set('sound', v); if (v) W.Audio.success(); }) }),
        W.UI.row({ icon: 'vibrate', label: 'Vibración', right: W.UI.toggle(cfg.vibrate, function (v) { set('vibrate', v); if (v) W.Audio.vibrate([30]); }) })
      ].concat(quietRows)));

      /* Enfoque */
      inner.appendChild(U.el('h3.group-title', { text: 'Enfoque' }));
      var f = cfg.focus, setF = function (k) { return function (v) { f[k] = v; st.saveSettings('settings:focus'); }; };
      var mins = function (v) { return v + ' min'; };
      inner.appendChild(U.el('div.group', [
        W.UI.row({ icon: 'target', label: 'Sesión de enfoque', right: W.UI.stepper(f.work, 5, 120, 5, setF('work'), mins) }),
        W.UI.row({ icon: 'coffee', label: 'Pausa corta', right: W.UI.stepper(f.short, 1, 30, 1, setF('short'), mins) }),
        W.UI.row({ icon: 'moon', label: 'Pausa larga', right: W.UI.stepper(f.long, 5, 60, 5, setF('long'), mins) }),
        W.UI.row({ icon: 'repeat', label: 'Rondas hasta la pausa larga', right: W.UI.stepper(f.rounds, 2, 8, 1, setF('rounds')) }),
        W.UI.row({ icon: 'play', label: 'Iniciar pausas automáticamente', right: W.UI.toggle(f.autoBreaks, setF('autoBreaks')) })
      ]));

      /* Datos */
      inner.appendChild(U.el('h3.group-title', { text: 'Datos' }));
      var dataRows = [];
      if (st.hasExamples()) dataRows.push(W.UI.row({ icon: 'sparkle', label: 'Quitar tareas de ejemplo', onTap: function () { st.clearExamples(); W.Toast.show({ text: 'Ejemplos eliminados', type: 'success' }); rerender(); } }));
      dataRows.push(W.UI.row({ icon: 'check', label: 'Borrar tareas completadas', onTap: function () {
        W.Sheet.confirm({ title: '¿Borrar las completadas?', text: 'Se eliminarán todas las tareas ya hechas. Tus estadísticas de racha se basan en ellas.', ok: 'Borrar', danger: true })
          .then(function (ok) { if (ok) { var n = st.clearCompleted(); W.Toast.show({ text: U.plural(n, 'tarea borrada', 'tareas borradas'), icon: 'trash' }); } });
      } }));
      dataRows.push(W.UI.row({ icon: 'sparkle', label: 'Ver la presentación de nuevo', onTap: function () { W.Onboarding.start(); } }));
      dataRows.push(W.UI.row({ icon: 'trash', label: 'Restablecer todo', desc: 'Elimina tareas, enfoque, marcas y logros' + (W.Auth && W.Auth.user ? ' (también de tu cuenta)' : ''), danger: true, onTap: function () {
        W.Sheet.confirm({ title: '¿Restablecer WHIDER?', text: 'Se borrarán todas tus tareas, sesiones de enfoque, marcas y logros. No se puede deshacer.', ok: 'Restablecer', danger: true })
          .then(function (ok) { if (ok) { st.resetAll(); W.Toast.show({ text: 'Datos restablecidos' }); } });
      } }));
      inner.appendChild(U.el('div.group', dataRows));

      /* Acerca de */
      inner.appendChild(U.el('div.about', [
        U.svg('svg', { 'class': 'about-logo', viewBox: '0 0 64 64' }, [U.svg('use', { href: '#logo' })]),
        U.el('strong', { text: 'WHIDER' }),
        U.el('span', { text: 'Versión 4.0 · ' + (W.Auth && W.Auth.user ? 'Tus datos se guardan en tu cuenta y en este dispositivo' : 'Tus datos se guardan en este dispositivo') })
      ]));
      U.clear(root).appendChild(inner);
    }
  };
})(window.Whider);
