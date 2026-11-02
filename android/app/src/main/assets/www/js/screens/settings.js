/**
 * WHIDER · Ajustes: una portada tranquila con apartados; cada apartado abre sus opciones.
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
  var rootRef = null;

  function labelOf(arr, v) { for (var i = 0; i < arr.length; i++) if (arr[i].value === v) return arr[i].label; return ''; }
  function rerender() { if (rootRef && S().activeScreen === 'settings') W.Screens.settings.render(rootRef); }
  function section(title, rows, foot) { return W.Sheet.open({ title: title, body: [U.el('div.group', rows)], foot: foot, onClose: rerender }); }
  function inlineRow(icon, label, control) {
    return U.el('div.row.col', [U.el('div.row-inline', [U.el('span.row-icon', [U.icon(icon)]), U.el('span.row-main', [U.el('span.row-label', { text: label })])]), control]);
  }

  /* ---------- Apartados ---------- */
  function account() {
    var A = W.Auth, u = A.user;
    if (!u) { W.AuthScreen.open({ mode: 'register' }); return; }
    var verified = A.isVerified();
    var syncRow = W.UI.row({ icon: 'cloud', label: 'Copia en la nube', desc: W.Sync.statusText(), onTap: function () {
      if (!verified) { s.close(); W.AuthScreen.showVerify(); return; }
      W.Sync.push().then(function () { var d = syncRow.querySelector('.row-desc'); if (d) d.textContent = W.Sync.statusText(); });
    } });
    var rows = [
      U.el('div.row', [W.Profile.avatar('md'), U.el('div.row-main', [U.el('span.row-label', { text: S().displayName() || u.displayName || 'Tu cuenta' }), U.el('span.row-desc', { text: u.email || '' })]),
        U.el('span.tag' + (verified ? '.ok' : '.late'), { text: A.provider() === 'google' ? 'Google' : verified ? 'Verificada' : 'Sin verificar' })]),
      syncRow
    ];
    if (!verified) rows.push(W.UI.row({ icon: 'mail', label: 'Verificar correo', desc: 'Abre el enlace que te enviamos', onTap: function () { s.close(); W.AuthScreen.showVerify(); } }));
    if (A.provider() === 'password') rows.push(W.UI.row({ icon: 'key', label: 'Cambiar contraseña', desc: 'Te enviaremos un enlace por correo', onTap: function () {
      A.resetPassword(u.email).then(function () { W.Toast.show({ text: 'Enlace enviado a ' + u.email, type: 'success', icon: 'mail' }); })
        .catch(function (e) { W.Toast.show({ text: A.message(e), type: 'danger' }); });
    } }));
    rows.push(W.UI.row({ icon: 'logout', label: 'Cerrar sesión', onTap: function () {
      s.close();
      W.Sheet.confirm({ title: '¿Cerrar sesión?', icon: 'logout', text: 'Tus datos quedan guardados en tu cuenta.', ok: 'Cerrar sesión' }).then(function (ok) { if (ok) W.App.logout(); });
    } }));
    rows.push(W.UI.row({ icon: 'trash', label: 'Eliminar cuenta', danger: true, onTap: function () {
      s.close();
      W.Sheet.confirm({ title: '¿Eliminar tu cuenta?', text: 'Se borrarán tu cuenta y todos tus datos de la nube. No se puede deshacer.', ok: 'Eliminar cuenta', danger: true })
        .then(function (ok) { if (ok) W.App.deleteAccount(); });
    } }));
    var s = section('Cuenta', rows);
  }

  function appearance() {
    var st = S(), cfg = st.settings, set = st.setSetting;
    section('Apariencia', [
      inlineRow('palette', 'Color', W.UI.swatches(cfg.accent, function (k) { set('accent', k); })),
      inlineRow('type', 'Tamaño del texto', W.UI.segmented([{ value: 's', label: 'Pequeño' }, { value: 'm', label: 'Normal' }, { value: 'l', label: 'Grande' }, { value: 'xl', label: 'Enorme' }], cfg.textSize, function (v) { set('textSize', v); })),
      inlineRow('layers', 'Densidad', W.UI.segmented([{ value: 'comfortable', label: 'Cómoda' }, { value: 'compact', label: 'Compacta' }], cfg.density, function (v) { set('density', v); })),
      W.UI.row({ icon: 'bolt', label: 'Reducir animaciones', desc: 'Menos movimiento y más batería', right: W.UI.toggle(cfg.reduceMotion, function (v) { set('reduceMotion', v); }) })
    ]);
  }

  function tasks() {
    var st = S(), cfg = st.settings, set = st.setSetting;
    var defList = st.getList(cfg.defaultList);
    var s = section('Tareas', [
      W.UI.row({ icon: 'layers', label: 'Listas', value: String(st.lists.length), onTap: function () { s.close(); setTimeout(W.Lists.manage, 300); } }),
      W.UI.row({ icon: 'inbox', label: 'Lista por defecto', value: defList ? defList.name : 'Ninguna', onTap: function () {
        s.close();
        W.Sheet.choose({ title: 'Lista por defecto', value: cfg.defaultList, options: st.lists.map(function (l) { return { value: l.id, label: l.name, color: st.ACCENTS[l.color].a }; }) })
          .then(function (v) { if (v) set('defaultList', v); setTimeout(tasks, 300); });
      } }),
      W.UI.row({ icon: 'trash', label: 'Confirmar antes de eliminar', right: W.UI.toggle(cfg.confirmDelete, function (v) { set('confirmDelete', v); }) }),
      inlineRow('calendar', 'La semana empieza en', W.UI.segmented([{ value: 1, label: 'Lunes' }, { value: 0, label: 'Domingo' }], cfg.weekStart, function (v) { set('weekStart', v); })),
      inlineRow('clock', 'Formato de hora', W.UI.segmented([{ value: '24', label: '24 h' }, { value: '12', label: '12 h (a. m./p. m.)' }], cfg.timeFormat, function (v) { set('timeFormat', v); }))
    ]);
  }

  function alerts() {
    var st = S(), cfg = st.settings, set = st.setSetting, q = cfg.quietHours;
    var perm = W.Notify.permission();
    var permText = { granted: 'Activadas', denied: 'Bloqueadas', unsupported: 'No disponibles', 'default': 'Sin activar' }[perm] || perm;
    var quietTimes = U.el('div.row.quiet-times', [U.el('span', { text: 'De' }), timeInput(q.from, function (v) { q.from = v; st.saveSettings('settings:quiet'); }),
      U.el('span', { text: 'a' }), timeInput(q.to, function (v) { q.to = v; st.saveSettings('settings:quiet'); })]);
    quietTimes.style.display = q.enabled ? '' : 'none';
    var s = section('Avisos y sonido', [
      W.UI.row({ icon: 'bell', label: 'Notificaciones', value: permText, onTap: perm === 'granted' || perm === 'unsupported' ? null : function () { W.Notify.request(); } }),
      W.UI.row({ icon: 'alert', label: 'Avisar en las tareas nuevas', right: W.UI.toggle(cfg.defaultWarn, function (v) { set('defaultWarn', v); }) }),
      W.UI.row({ icon: 'clock', label: 'Recordatorio previo', value: W.Editor.remindLabel(cfg.remindBefore), onTap: function () {
        s.close(); W.Sheet.choose({ title: 'Recordatorio previo', value: cfg.remindBefore, options: W.Editor.REMIND_OPTS }).then(function (v) { if (v !== undefined) set('remindBefore', v); setTimeout(alerts, 300); });
      } }),
      W.UI.row({ icon: 'repeat', label: 'Repetir alerta vencida', value: labelOf(REWARN, cfg.rewarn), onTap: function () {
        s.close(); W.Sheet.choose({ title: 'Repetir alerta', value: cfg.rewarn, options: REWARN }).then(function (v) { if (v !== undefined) set('rewarn', v); setTimeout(alerts, 300); });
      } }),
      W.UI.row({ icon: 'sound', label: 'Sonidos', right: W.UI.toggle(cfg.sound, function (v) { set('sound', v); if (v) W.Audio.success(); }) }),
      W.UI.row({ icon: 'vibrate', label: 'Vibración', right: W.UI.toggle(cfg.vibrate, function (v) { set('vibrate', v); if (v) W.Audio.vibrate([30]); }) }),
      W.UI.row({ icon: 'moon', label: 'Horas de silencio', desc: 'Sin sonidos ni notificaciones', right: W.UI.toggle(q.enabled, function (v) { q.enabled = v; st.saveSettings('settings:quiet'); quietTimes.style.display = v ? '' : 'none'; }) }),
      quietTimes,
      W.UI.row({ icon: 'sound', label: 'Probar alarma', onTap: function () { W.Audio.warning(); W.Audio.vibrate([70, 60, 70]); } })
    ]);
  }

  function focus() {
    var st = S(), f = st.settings.focus, setF = function (k) { return function (v) { f[k] = v; st.saveSettings('settings:focus'); }; };
    var mins = function (v) { return v + ' min'; };
    section('Enfoque', [
      W.UI.row({ icon: 'target', label: 'Sesión', right: W.UI.stepper(f.work, 5, 120, 5, setF('work'), mins) }),
      W.UI.row({ icon: 'coffee', label: 'Pausa corta', right: W.UI.stepper(f.short, 1, 30, 1, setF('short'), mins) }),
      W.UI.row({ icon: 'moon', label: 'Pausa larga', right: W.UI.stepper(f.long, 5, 60, 5, setF('long'), mins) }),
      W.UI.row({ icon: 'repeat', label: 'Sesiones hasta la pausa larga', right: W.UI.stepper(f.rounds, 2, 8, 1, setF('rounds')) }),
      W.UI.row({ icon: 'play', label: 'Empezar pausas solas', right: W.UI.toggle(f.autoBreaks, setF('autoBreaks')) })
    ]);
  }

  function data() {
    var st = S();
    var s = section('Datos', [
      W.UI.row({ icon: 'sparkle', label: 'Ver la presentación de nuevo', onTap: function () { s.close(); W.Onboarding.start(); } }),
      W.UI.row({ icon: 'trash', label: 'Restablecer todo', desc: 'Borra tareas, enfoque, marcas y logros' + (W.Auth && W.Auth.user ? ' (también en tu cuenta)' : ''), danger: true, onTap: function () {
        s.close();
        W.Sheet.confirm({ title: '¿Restablecer WHIDER?', text: 'Se borrarán todas tus tareas, sesiones de enfoque, marcas y logros. No se puede deshacer.', ok: 'Restablecer', danger: true })
          .then(function (ok) { if (ok) st.resetAll(); });
      } })
    ]);
  }

  function timeInput(value, onChange) {
    var i = U.el('input.input.time-mini', { attrs: { type: 'time', value: value } });
    i.addEventListener('change', function () { if (i.value) onChange(i.value); });
    return i;
  }

  W.Screens.settings = {
    title: 'Ajustes',
    manageLists: function () { W.Lists.manage(); },
    render: function (root) {
      rootRef = root;
      var st = S(), cfg = st.settings, A = W.Auth;
      var inner = U.el('div.inner.settings');
      inner.appendChild(U.el('div.page-head', [U.el('div', [U.el('h1', { text: 'Ajustes' })])]));

      var u = A && A.user;
      inner.appendChild(U.el('button.card.profile-row', { on: { click: function () { W.Profile.edit(); } } }, [
        W.Profile.avatar('lg'),
        U.el('div.row-main', [U.el('span.row-label', { text: st.displayName() || 'Añade tu nombre' }), U.el('span.row-desc', { text: u && u.email ? u.email : 'Editar nombre y foto' })]),
        U.icon('right', 'sm')
      ]));

      var rows = [];
      if (A && A.configured()) {
        rows.push(W.UI.row({ icon: 'cloud', label: u ? 'Cuenta y copia en la nube' : 'Crear cuenta o iniciar sesión',
          desc: u ? W.Sync.statusText() : 'Guarda tus datos en la nube', onTap: account }));
      }
      rows.push(W.UI.row({ icon: 'palette', label: 'Apariencia', value: st.ACCENTS[cfg.accent].name, onTap: appearance }));
      rows.push(W.UI.row({ icon: 'tasks', label: 'Tareas', onTap: tasks }));
      rows.push(W.UI.row({ icon: 'bell', label: 'Avisos y sonido', onTap: alerts }));
      rows.push(W.UI.row({ icon: 'timer', label: 'Enfoque', value: cfg.focus.work + ' min', onTap: focus }));
      rows.push(W.UI.row({ icon: 'home', label: 'Pantalla al abrir', value: labelOf(SCREENS, cfg.startScreen), onTap: function () {
        W.Sheet.choose({ title: 'Pantalla al abrir', value: cfg.startScreen, options: SCREENS }).then(function (v) { if (v) { st.setSetting('startScreen', v); rerender(); } });
      } }));
      rows.push(W.UI.row({ icon: 'shield', label: 'Datos', onTap: data }));
      var group = U.el('div.group', rows);
      var syncDesc = A && A.configured() && u ? group.querySelector('.row .row-desc') : null;
      if (syncDesc) syncDesc.classList.add('sync-desc');
      inner.appendChild(group);

      inner.appendChild(U.el('div.about', [
        U.svg('svg', { 'class': 'about-logo', viewBox: '0 0 64 64' }, [U.svg('use', { href: '#logo' })]),
        U.el('strong', { text: 'WHIDER' }),
        U.el('span', { text: 'Versión 4.1' })
      ]));
      U.clear(root).appendChild(inner);
    }
  };
})(window.Whider);
