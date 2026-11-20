// @ts-check
/**
 * WHIDER · Barra inferior del móvil
 * Tres pestañas a elegir (Ajustes → Personalización → Barra inferior), el botón + en el centro y
 * «Más» siempre a la derecha, que lleva a todo lo demás. Por defecto: Hoy, Tareas y Calendario.
 * Quien usa mucho el Cuaderno o los chats puede tenerlos a un toque.
 */
window.Whider = window.Whider || {};

(function (W) {
  'use strict';
  var U = W.U;
  /** Pestañas posibles: icono normal, icono de la pestaña activa y el aviso que llevan */
  var OPTIONS = {
    home: { label: W.t('Hoy'), icon: 'sun', on: 'sun-fill', badge: 'alerts' },
    tasks: { label: W.t('Tareas'), icon: 'tasks', on: 'tasks-fill' },
    calendar: { label: W.t('Calendario'), icon: 'calendar', on: 'calendar-fill' },
    notes: { label: W.t('Cuaderno'), icon: 'notebook', on: 'notebook-fill' },
    chats: { label: W.t('Chats'), icon: 'chat', on: 'chat-fill', badge: 'chats' },
    habits: { label: W.t('Hábitos'), icon: 'target', on: 'target' },
    focus: { label: W.t('Enfoque'), icon: 'timer', on: 'timer-fill' }
  };
  var DEFAULT = ['home', 'tasks', 'calendar'];
  var drawn = '';

  /** Las tres pestañas elegidas, sin repetir y siempre tres */
  function slots() {
    var raw = String((W.State && W.State.settings && W.State.settings.dock) || '').split(',');
    var out = [];
    raw.forEach(function (k) {
      k = k.trim();
      if (OPTIONS[k] && out.indexOf(k) < 0) out.push(k);
    });
    DEFAULT.concat(Object.keys(OPTIONS)).forEach(function (k) {
      if (out.length < 3 && out.indexOf(k) < 0) out.push(k);
    });
    return out.slice(0, 3);
  }

  function tab(id) {
    var o = OPTIONS[id];
    return U.el('button.tab', { attrs: { 'data-go': id, type: 'button' } }, [
      U.el('span.tab-ic', [U.icon(o.icon, 'off'), U.icon(o.on, 'on'), o.badge ? U.el('span.tab-badge', { attrs: { 'data-badge': o.badge } }) : null]),
      U.el('span.tab-label', { text: o.label })
    ]);
  }

  var Dock = {
    OPTIONS: OPTIONS,
    DEFAULT: DEFAULT,
    slots: slots,
    /** ¿Tiene pestaña propia esta pantalla? («Más» siempre) */
    has: function (id) { return id === 'more' || slots().indexOf(id) >= 0; },
    /** Texto para Ajustes: «Hoy · Tareas · Calendario» */
    summary: function () { return slots().map(function (k) { return OPTIONS[k].label; }).join(' · '); },
    /** Coloca las pestañas elegidas (solo si cambiaron) */
    render: function (force) {
      var nav = document.querySelector('.dock');
      if (!nav) return;
      var key = slots().join(',');
      if (key === drawn && !force) return;
      drawn = key;
      var fab = nav.querySelector('#fab'), more = nav.querySelector('[data-go="more"]');
      if (!fab || !more) return;
      U.$$('.tab', nav).forEach(function (b) { if (b !== more) b.parentNode.removeChild(b); });
      var s = slots();
      nav.insertBefore(tab(s[0]), fab);
      nav.insertBefore(tab(s[1]), fab);
      nav.insertBefore(tab(s[2]), more);
      if (W.Router && W.Router.markTabs && W.State.activeScreen) W.Router.markTabs(W.State.activeScreen);
      if (W.Notify && W.Notify.emitBadge) W.Notify.emitBadge();
    },
    /** Hoja para elegir las tres pestañas */
    edit: function (after) {
      var chosen = slots();
      var host = U.el('div');
      var draw = function () {
        U.clear(host);
        host.appendChild(W.UI.section({
          header: W.t('Pestañas'),
          items: chosen.map(function (k, i) {
            return W.UI.cell({
              icon: OPTIONS[k].icon, title: OPTIONS[k].label, value: [W.t('Izquierda'), W.t('Centro izquierda'), W.t('Derecha')][i],
              onTap: function (e, node) {
                var opts = Object.keys(OPTIONS).map(function (id) { return { value: id, label: OPTIONS[id].label, icon: OPTIONS[id].icon, on: id === k }; });
                W.Sheet.choose({ anchor: node.querySelector('.cell-value'), title: W.t('Pestaña {n}', { n: i + 1 }), value: k, options: opts }).then(function (v) {
                  if (!v || v === k) return;
                  // Si ya estaba en otro hueco, se intercambian
                  var j = chosen.indexOf(v);
                  if (j >= 0) chosen[j] = k;
                  chosen[i] = v;
                  draw();
                });
              }
            });
          }),
          footer: W.t('El botón + queda en el centro y «Más» a la derecha, con todo lo demás.')
        }));
      };
      draw();
      var sheet = W.Sheet.open({
        title: W.t('Barra inferior'), body: [host], foot: [
          U.el('button.btn.ghost', { text: W.t('Restablecer'), on: { click: function () { chosen = DEFAULT.slice(); draw(); } } }),
          U.el('button.btn.primary', { text: W.t('Guardar'), on: { click: function () {
            W.State.setSetting('dock', chosen.join(','));
            sheet.close();
            if (after) after();
          } } })
        ]
      });
      return sheet;
    }
  };

  W.Dock = Dock;
})(window.Whider);
