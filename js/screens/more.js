/**
 * WHIDER · «Más» (móvil): todo WHIDER ordenado por importancia
 *
 * Arriba tu perfil con tu personaje. Después, por prioridad: el trabajo con otros (Cuaderno,
 * Chats y Personas, con lo que tienes sin leer), tu día (Hábitos y Enfoque), el análisis
 * (Estadísticas, Informes y Sistemas) y tu cuenta (Planes y Ajustes).
 */
window.Whider = window.Whider || {};
window.Whider.Screens = window.Whider.Screens || {};

(function (W) {
  'use strict';
  var U = W.U, S = function () { return W.State; };

  function tile(o) {
    var t = U.el('button.mo-tile' + (o.premium && !W.Plan.isPremium() ? '.locked' : ''), { attrs: { type: 'button', 'data-go': o.go || null } }, [
      U.el('span.mo-ic', [U.icon(o.icon), o.badge ? U.el('span.mo-badge', { text: o.badge > 9 ? '9+' : String(o.badge) }) : null]),
      U.el('span.mo-t', [U.el('strong', { text: o.label }), o.sub ? U.el('small', { text: o.sub }) : null]),
      o.premium && !W.Plan.isPremium() ? U.el('span.sb-gem', { attrs: { title: 'Premium' } }, [U.icon('gem')]) : null
    ]);
    t.addEventListener('click', function () { if (o.run) o.run(); else W.Router.go(o.go); });
    return t;
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
        W.Avatar.me(64, { live: true }),
        U.el('span.mo-me-main', [U.el('strong', { text: st.displayName() || 'Tu perfil' }), U.el('small', { text: u && u.email ? u.email : 'Perfil, actividad y marcas' })]),
        U.el('span.mo-plan' + (W.Plan.isPremium() ? '.on' : ''), [U.icon('gem', 'xs'), W.Plan.isPremium() ? 'Premium' : 'Gratis']),
        U.icon('chev', 'chev')
      ]);
      var sec = function (title, tiles) { return U.el('div.mo-sec', [U.el('div.sec-h', { text: title }), U.el('div.mo-grid', tiles)]); };
      var pages = W.Pages ? W.Pages.count() : 0;
      W.UI.mount(root, head, [
        me,
        sec('Trabajo y equipo', [
          tile({ go: 'notes', icon: 'notebook', label: 'Cuaderno', sub: pages ? U.plural(pages, 'página', 'páginas') : 'Páginas, listas y bases de datos' }),
          tile({ go: 'chats', icon: 'chat', label: 'Chats', sub: unread ? U.plural(unread, 'sin leer', 'sin leer') : 'Con tus contactos y equipos', badge: unread }),
          tile({ go: 'friends', icon: 'users', label: 'Personas', sub: reqs ? U.plural(reqs, 'solicitud', 'solicitudes') : 'Amigos, trabajo y equipos', badge: reqs })
        ]),
        sec('Tu día', [
          tile({ go: 'habits', icon: 'target', label: 'Hábitos', sub: habitsLeft ? 'Te quedan ' + habitsLeft + ' hoy' : 'Rutinas y rachas' }),
          tile({ go: 'focus', icon: 'timer', label: 'Enfoque', sub: f.running ? f.text + ' · en marcha' : 'Temporizador para concentrarte' })
        ]),
        sec('Análisis', [
          tile({ go: 'stats', icon: 'chart', label: 'Estadísticas', sub: 'Tu progreso' }),
          tile({ go: 'reports', icon: 'print', label: 'Informes', sub: 'Resúmenes para compartir' }),
          tile({ go: 'automations', icon: 'system', label: 'Sistemas', sub: 'Métodos y automatizaciones', premium: true })
        ]),
        sec('Cuenta', [
          tile({ go: 'plans', icon: 'gem', label: 'Planes', sub: W.Plan.label() }),
          tile({ icon: 'gear', label: 'Ajustes', sub: 'Apariencia, avisos y datos', run: function () { W.Settings.open(); } })
        ])
      ]);
    }
  };
})(window.Whider);
