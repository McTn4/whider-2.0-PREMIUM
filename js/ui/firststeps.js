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

  function state() { return Object.assign({ hidden: false }, S().meta.firstSteps || {}); }
  /** Un ejemplo según para qué usas la app (lo elegiste en la presentación) */
  function example() {
    var uses = String(S().settings.uses || '');
    var ex = /study/.test(uses) ? W.t('Prueba: «Repasar el tema 3 mañana a las 18 !!»')
      : /work/.test(uses) ? W.t('Prueba: «Enviar el informe el viernes a las 10 !!»')
      : /health/.test(uses) ? W.t('Prueba: «Salir a correr cada día a las 8»')
      : W.t('Prueba: «Llamar a Ana mañana a las 10»');
    return ex;
  }
  /** Lleva al campo de Hoy (con la importancia o «Cada día» preparados) */
  function compose(opts) {
    if (S().activeScreen !== 'home') W.Router.go('home');
    setTimeout(function () { if (W.Screens.home.compose) W.Screens.home.compose(opts || {}); }, 80);
  }
  function save(patch) { S().setMeta('firstSteps', Object.assign(state(), patch)); }

  function steps() {
    var st = S();
    return [
      { id: 'task', title: W.t('Escribe tu primera tarea'), sub: example(),
        done: st.tasks.length > 0, run: function () { compose(); } },
      { id: 'prio', title: W.t('Marca lo importante'), sub: W.t('Urgente, importante o destacada: sale primero en Hoy'),
        done: st.tasks.some(function (t) { return t.highlight !== 'none'; }), run: function () { compose({ prio: true }); } },
      { id: 'daily', title: W.t('Añade algo de cada día'), sub: W.t('Leer, entrenar, beber agua… Vuelve cada día a «Cada día»'),
        done: st.tasks.some(function (t) { return W.Schema.isRoutine(t); }), run: function () { compose({ daily: true }); } },
      { id: 'page', title: W.t('Escribe tu primera página'), sub: W.t('Notas, listas y archivos en el Cuaderno'),
        done: !!(W.Pages && W.Pages.count() > 0), run: function () { W.Router.go('notes'); } },
      { id: 'notify', title: W.t('Activa los avisos'), sub: W.t('Para que no se te pase ninguna tarea'),
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
    hide: function () { save({ hidden: true }); },
    card: function () {
      if (!FirstSteps.visible()) return null;
      var list = steps(), hechos = list.filter(function (s) { return s.done; }).length;
      var rows = list.map(function (s) {
        // El nombre accesible es el propio texto (y «hecho», oculto a la vista, en los cumplidos)
        var row = U.el('button.fs-step' + (s.done ? '.done' : ''), { attrs: { type: 'button' } }, [
          U.el('span.fs-check', { attrs: { 'aria-hidden': 'true' } }, [s.done ? U.icon('check', 'xs') : null]),
          U.el('span.fs-main', [U.el('b', { text: s.title }), s.done ? U.el('span.sr-only', { text: W.t(' (hecho)') }) : U.el('small', { text: s.sub })]),
          s.done ? null : U.icon('chev', 'chev')
        ]);
        if (s.done) row.disabled = true;
        else row.addEventListener('click', function () { s.run(); });
        return row;
      });
      var hide = U.el('button.link-btn.muted', { text: W.t('Ocultar'), attrs: { 'aria-label': W.t('Ocultar los primeros pasos') }, on: { click: function () {
        FirstSteps.hide();
        W.Toast.show({ text: W.t('Los primeros pasos quedan en Ajustes → Ayuda'), icon: 'info' });
        W.Router.refresh();
      } } });
      return W.UI.section({
        cls: 'first-steps', title: W.t('Primeros pasos'),
        side: U.el('span.cell-row', [U.el('small', { text: W.t('{hechos} de {length}', { hechos: hechos, length: list.length }) }), hide]),
        items: U.el('div.group.fs-list', rows)
      });
    },
    /** Vuelve a enseñar la tarjeta (Ajustes → Ayuda) */
    show: function () { save({ hidden: false, forced: true }); }
  };

  W.FirstSteps = FirstSteps;
})(window.Whider);
