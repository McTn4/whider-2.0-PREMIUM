// @ts-check
/**
 * WHIDER · Primeros pasos
 * Una tarjeta discreta en Hoy durante las primeras semanas: cinco pasos que enseñan lo esencial
 * haciéndolo de verdad, con tus propias tareas (WHIDER no crea tareas de ejemplo). Cada paso se
 * marca solo en cuanto se cumple, se puede ocultar en cualquier momento y desaparece al terminar.
 */
window.Whider = window.Whider || {};

(function (W) {
  'use strict';
  var U = W.U, S = function () { return W.State; };
  var DIAS = 21;

  function state() { return Object.assign({ hidden: false, chose: false }, S().meta.firstSteps || {}); }
  function save(patch) { S().setMeta('firstSteps', Object.assign(state(), patch)); }

  function steps() {
    var st = S(), td = U.today(), fs = state();
    return [
      { id: 'task', title: 'Crea tu primera tarea', sub: 'Con el botón + o escribiendo en Hoy',
        done: st.tasks.length > 0, run: function () { W.QuickAdd.open({ date: td }); } },
      { id: 'when', title: 'Dale día y hora escribiendo', sub: 'Prueba: «Llamar a Ana mañana a las 10»',
        done: st.tasks.some(function (t) { return !!t.time; }),
        run: function () { W.QuickAdd.open({ date: td, placeholder: 'Llamar a Ana mañana a las 10' }); } },
      { id: 'top', title: 'Elige lo más importante de hoy', sub: 'Hasta tres tareas, arriba del todo',
        done: !!fs.chose, run: function () { if (W.Screens.home.choose) W.Screens.home.choose(); } },
      { id: 'page', title: 'Escribe tu primera página', sub: 'Notas, listas y archivos en el Cuaderno',
        done: !!(W.Pages && W.Pages.count() > 0), run: function () { W.Router.go('notes'); } },
      { id: 'notify', title: 'Activa los avisos', sub: 'Para que no se te pase ninguna tarea',
        done: W.Notify.permission() === 'granted', run: function () { W.Notify.request(); } }
    ];
  }

  var FirstSteps = {
    steps: steps,
    /** Se enseña los primeros días, hasta completarla u ocultarla */
    visible: function () {
      var st = S(), fs = state();
      if (fs.hidden) return false;
      // A quien lleva tiempo con WHIDER no se le enseña, salvo que la pida desde Ajustes → Ayuda
      if (!fs.forced && Date.now() - (st.meta.createdAt || Date.now()) > DIAS * 86400000) return false;
      return steps().some(function (s) { return !s.done; });
    },
    /** Apunta un paso que no se ve en los datos (p. ej. haber elegido las prioridades) */
    mark: function (k) { var p = {}; p[k] = true; save(p); },
    hide: function () { save({ hidden: true }); },
    card: function () {
      if (!FirstSteps.visible()) return null;
      var list = steps(), hechos = list.filter(function (s) { return s.done; }).length;
      var rows = list.map(function (s) {
        // El nombre accesible es el propio texto (y «hecho», oculto a la vista, en los cumplidos)
        var row = U.el('button.fs-step' + (s.done ? '.done' : ''), { attrs: { type: 'button' } }, [
          U.el('span.fs-check', { attrs: { 'aria-hidden': 'true' } }, [s.done ? U.icon('check', 'xs') : null]),
          U.el('span.fs-main', [U.el('b', { text: s.title }), s.done ? U.el('span.sr-only', { text: ' (hecho)' }) : U.el('small', { text: s.sub })]),
          s.done ? null : U.icon('chev', 'chev')
        ]);
        if (s.done) row.disabled = true;
        else row.addEventListener('click', function () { s.run(); });
        return row;
      });
      var hide = U.el('button.link-btn.muted', { text: 'Ocultar', attrs: { 'aria-label': 'Ocultar los primeros pasos' }, on: { click: function () {
        FirstSteps.hide();
        W.Toast.show({ text: 'Los primeros pasos quedan en Ajustes → Ayuda', icon: 'info' });
        W.Router.refresh();
      } } });
      return W.UI.section({
        cls: 'first-steps', title: 'Primeros pasos',
        side: U.el('span.cell-row', [U.el('small', { text: hechos + ' de ' + list.length }), hide]),
        items: U.el('div.group.fs-list', rows)
      });
    },
    /** Vuelve a enseñar la tarjeta (Ajustes → Ayuda) */
    show: function () { save({ hidden: false, forced: true }); }
  };

  W.FirstSteps = FirstSteps;
})(window.Whider);
