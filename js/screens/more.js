/**
 * WHIDER · «Más» (móvil): el índice de todo WHIDER
 *
 * Arriba tu perfil con tu personaje y, bien grandes, el Cuaderno y los Chats (con lo que tienes
 * sin leer). Después, en lista: Personas, Rutinas (Hábitos, Enfoque y Automatizaciones), Análisis
 * (Estadísticas e Informes) y Ajustes. Una fila por sección con su estado al día.
 */
window.Whider = window.Whider || {};
window.Whider.Screens = window.Whider.Screens || {};

(function (W) {
  'use strict';
  var U = W.U, S = function () { return W.State; };

  function row(o) {
    return W.UI.cell({
      icon: o.icon, title: o.label, sub: o.sub, cls: 'mo-row', attrs: o.go ? { 'data-go': o.go } : null,
      value: o.badge ? U.el('span.mo-badge', { text: o.badge > 9 ? '9+' : String(o.badge), attrs: { 'aria-label': W.t('{n} sin ver', { n: o.badge }) } }) : null,
      onTap: function () { if (o.run) o.run(); else W.Router.go(o.go); }
    });
  }

  /** Acceso grande (Cuaderno y Chats) */
  function tile(o) {
    return U.el('button.mo-tile', { attrs: { type: 'button', 'data-go': o.go }, on: { click: function () { W.Router.go(o.go); } } }, [
      U.el('span.mo-tile-ic', [U.icon(o.icon)]),
      U.el('b', { text: o.label }),
      U.el('small', { text: o.sub }),
      o.badge ? U.el('span.mo-badge', { text: o.badge > 9 ? '9+' : String(o.badge), attrs: { 'aria-label': W.t('{n} sin leer', { n: o.badge }) } }) : null
    ]);
  }

  W.Screens.more = {
    title: W.t('Más'),
    render: function (root) {
      var st = S(), u = W.Auth && W.Auth.user;
      var head = W.UI.header({ title: W.t('Más'), profile: false, sub: W.t('Todo WHIDER, por orden de importancia') });
      var unread = W.Chat ? W.Chat.unreadCount() : 0, reqs = W.People ? W.People.pendingCount() : 0;
      var habitsLeft = W.Habits ? W.Habits.list().filter(W.Habits.pendingToday).length : 0;
      var f = W.Screens.focus.status();
      var me = U.el('button.mo-me', { attrs: { type: 'button' }, on: { click: function () { W.Router.go('progress'); } } }, [
        W.Avatar.me(56, { live: true }),
        U.el('span.mo-me-main', [U.el('strong', { text: st.displayName() || W.t('Tu perfil') }), U.el('small', { text: u && u.email ? u.email : W.t('Perfil, actividad y marcas') })]),
        U.icon('chev', 'chev')
      ]);
      var pages = W.Pages ? W.Pages.count() : 0;
      W.UI.mount(root, head, [
        me,
        U.el('div.mo-tiles', [
          tile({ go: 'notes', icon: 'notebook', label: W.t('Cuaderno'), sub: pages ? U.plural(pages, 'página', 'páginas') : W.t('Notas, listas y archivos') }),
          tile({ go: 'chats', icon: 'chat', label: W.t('Chats'), sub: unread ? U.plural(unread, 'mensaje sin leer', 'mensajes sin leer') : W.t('Con tus contactos y equipos'), badge: unread })
        ]),
        W.UI.section({ header: W.t('Equipo'), items: [
          row({ go: 'friends', icon: 'users', label: W.t('Personas'), sub: reqs ? W.t('{n} por responder', { n: U.plural(reqs, 'solicitud', 'solicitudes') }) : W.t('Amigos, trabajo y equipos'), badge: reqs })
        ] }),
        W.UI.section({ header: W.t('Rutinas'), items: [
          row({ go: 'habits', icon: 'target', label: W.t('Hábitos'), sub: habitsLeft ? W.tn(habitsLeft, 'Te queda 1 hoy', 'Te quedan {n} hoy') : W.t('Rutinas y rachas') }),
          row({ go: 'focus', icon: 'timer', label: W.t('Enfoque'), sub: f.running ? W.t('{time} · en marcha', { time: f.text }) : W.t('Temporizador para concentrarte') }),
          row({ go: 'automations', icon: 'system', label: W.t('Automatizaciones'), sub: W.t('Reglas y métodos listos para usar') })
        ] }),
        W.UI.section({ header: W.t('Análisis'), items: [
          row({ go: 'stats', icon: 'chart', label: W.t('Estadísticas'), sub: W.t('Tu progreso') }),
          row({ go: 'reports', icon: 'print', label: W.t('Informes'), sub: W.t('Resúmenes para compartir') })
        ] }),
        W.UI.section({ items: [row({ icon: 'gear', label: W.t('Ajustes'), sub: W.t('Apariencia, avisos, cuenta y datos'), run: function () { W.Settings.open(); } })] })
      ]);
    }
  };
})(window.Whider);
