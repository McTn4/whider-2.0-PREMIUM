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
      value: o.badge ? U.el('span.mo-badge', { text: o.badge > 9 ? '9+' : String(o.badge), attrs: { 'aria-label': o.badge + ' sin ver' } }) : null,
      onTap: function () { if (o.run) o.run(); else W.Router.go(o.go); }
    });
  }

  /** Acceso grande (Cuaderno y Chats) */
  function tile(o) {
    return U.el('button.mo-tile', { attrs: { type: 'button', 'data-go': o.go }, on: { click: function () { W.Router.go(o.go); } } }, [
      U.el('span.mo-tile-ic', [U.icon(o.icon)]),
      U.el('b', { text: o.label }),
      U.el('small', { text: o.sub }),
      o.badge ? U.el('span.mo-badge', { text: o.badge > 9 ? '9+' : String(o.badge), attrs: { 'aria-label': o.badge + ' sin leer' } }) : null
    ]);
  }

  W.Screens.more = {
    title: 'Más',
    render: function (root) {
      var st = S(), u = W.Auth && W.Auth.user;
      var head = W.UI.header({ title: 'Más', profile: false, sub: 'Todo WHIDER, por orden de importancia' });
      var unread = W.Chat ? W.Chat.unreadCount() : 0, reqs = W.People ? W.People.pendingCount() : 0;
      var habitsLeft = W.Habits ? W.Habits.list().filter(W.Habits.pendingToday).length : 0;
      var f = W.Screens.focus.status();
      var me = U.el('button.mo-me', { attrs: { type: 'button' }, on: { click: function () { W.Router.go('progress'); } } }, [
        W.Avatar.me(56, { live: true }),
        U.el('span.mo-me-main', [U.el('strong', { text: st.displayName() || 'Tu perfil' }), U.el('small', { text: u && u.email ? u.email : 'Perfil, actividad y marcas' })]),
        U.icon('chev', 'chev')
      ]);
      var pages = W.Pages ? W.Pages.count() : 0;
      W.UI.mount(root, head, [
        me,
        U.el('div.mo-tiles', [
          tile({ go: 'notes', icon: 'notebook', label: 'Cuaderno', sub: pages ? U.plural(pages, 'página', 'páginas') : 'Notas, listas y archivos' }),
          tile({ go: 'chats', icon: 'chat', label: 'Chats', sub: unread ? U.plural(unread, 'mensaje sin leer', 'mensajes sin leer') : 'Con tus contactos y equipos', badge: unread })
        ]),
        W.UI.section({ header: 'Equipo', items: [
          row({ go: 'friends', icon: 'users', label: 'Personas', sub: reqs ? U.plural(reqs, 'solicitud', 'solicitudes') + ' por responder' : 'Amigos, trabajo y equipos', badge: reqs })
        ] }),
        W.UI.section({ header: 'Rutinas', items: [
          row({ go: 'habits', icon: 'target', label: 'Hábitos', sub: habitsLeft ? 'Te ' + (habitsLeft === 1 ? 'queda 1' : 'quedan ' + habitsLeft) + ' hoy' : 'Rutinas y rachas' }),
          row({ go: 'focus', icon: 'timer', label: 'Enfoque', sub: f.running ? f.text + ' · en marcha' : 'Temporizador para concentrarte' }),
          row({ go: 'automations', icon: 'system', label: 'Automatizaciones', sub: 'Reglas y métodos listos para usar' })
        ] }),
        W.UI.section({ header: 'Análisis', items: [
          row({ go: 'stats', icon: 'chart', label: 'Estadísticas', sub: 'Tu progreso' }),
          row({ go: 'reports', icon: 'print', label: 'Informes', sub: 'Resúmenes para compartir' })
        ] }),
        W.UI.section({ items: [row({ icon: 'gear', label: 'Ajustes', sub: 'Apariencia, avisos, cuenta y datos', run: function () { W.Settings.open(); } })] })
      ]);
    }
  };
})(window.Whider);
