// @ts-check
/**
 * WHIDER · Instalar la web como app
 *  - iPhone y iPad: Safari no tiene botón de instalar, así que se explica «Compartir → Añadir a pantalla de
 *    inicio». Importa: en iOS los avisos solo llegan con la web añadida a la pantalla de inicio (iOS 16.4+).
 *  - Android y ordenador (Chrome, Edge…): el navegador ofrece instalarla (beforeinstallprompt); se guarda ese
 *    ofrecimiento para un botón «Instalar».
 * Una tarjeta discreta en Hoy cuando ya has empezado a usar WHIDER (se cierra para siempre) y una celda en
 * Ajustes. Nunca en las apps de Android y de escritorio ni si ya está instalada.
 */
window.Whider = window.Whider || {};

(function (W) {
  'use strict';
  var U = W.U, S = function () { return W.State; };
  var KEY = 'whider.installHint';
  /** @type {any} */
  var deferred = null;

  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();
    deferred = e;
    if (W.Router && W.Router.current && W.Router.current() === 'home') W.Router.refresh();
  });
  window.addEventListener('appinstalled', function () { deferred = null; mark('installed'); });

  function isApp() { var w = /** @type {any} */ (window); return !!(w.WhiderAndroid || w.WhiderDesktop); }
  function standalone() {
    return !!((window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || /** @type {any} */ (navigator).standalone === true);
  }
  function ios() {
    var ua = navigator.userAgent || '';
    return /iPhone|iPad|iPod/.test(ua) || (/Mac/.test(navigator.platform || '') && navigator.maxTouchPoints > 1);
  }
  /** ¿Se puede ofrecer instalarla aquí? */
  function canInstall() { return !isApp() && !standalone() && (ios() || !!deferred); }
  function dismissed() { try { return !!localStorage.getItem(KEY); } catch (e) { return false; } }
  function mark(v) { try { localStorage.setItem(KEY, v || String(Date.now())); } catch (e) { /* sin almacenamiento */ } }

  function step(icon, title, text) {
    return U.el('li.in-step', [
      U.el('span.in-ic', { attrs: { 'aria-hidden': 'true' } }, [U.icon(icon)]),
      U.el('span.in-t', [U.el('b', { text: title }), U.el('small', { text: text })])
    ]);
  }
  /** Los pasos en el iPhone o el iPad */
  function sheet() {
    var ipad = /iPad/.test(navigator.userAgent || '') || (/Mac/.test(navigator.platform || '') && navigator.maxTouchPoints > 1);
    return W.Sheet.open({
      title: ipad ? 'Instalar en el iPad' : 'Instalar en el iPhone', className: 'install',
      body: [
        U.el('ol.in-steps', [
          step('share', 'Pulsa Compartir', 'El botón del cuadrado con una flecha hacia arriba, ' + (ipad ? 'arriba en Safari.' : 'abajo en Safari.')),
          step('plus', 'Elige «Añadir a pantalla de inicio»', 'Si no lo ves, desliza la lista hacia arriba. Después, pulsa «Añadir».'),
          step('bell', 'Abre WHIDER desde su icono', 'Se abre como una app, funciona sin conexión y, con iOS 16.4 o posterior, te avisa de tus tareas.')
        ]),
        U.el('p.hint', { text: 'En otros navegadores del iPhone, como Chrome, la opción también está en el menú Compartir. Tus datos siguen siendo los mismos.' })
      ]
    });
  }
  /** Instalar: el ofrecimiento del navegador o, en iOS, los pasos */
  function install() {
    if (deferred) {
      var d = deferred;
      deferred = null;
      d.prompt();
      return Promise.resolve(d.userChoice).then(function (c) {
        if (c && c.outcome === 'accepted') mark('installed');
        if (W.Router) W.Router.refresh();
      });
    }
    if (ios()) sheet();
    return Promise.resolve();
  }
  /** Tarjeta en Hoy: solo a quien ya ha empezado (alguna tarea) y no la ha cerrado */
  function card() {
    if (!canInstall() || dismissed() || !S() || !S().tasks.length) return null;
    var close = U.el('button.circle-btn', { attrs: { type: 'button', 'aria-label': 'Cerrar el aviso de instalar' }, on: { click: function () {
      mark();
      W.Toast.show({ text: 'Puedes instalarla cuando quieras desde Ajustes', icon: 'info' });
      W.Router.refresh();
    } } }, [U.icon('close', 'xs')]);
    var go = U.el('button.btn.sm.soft', { text: ios() ? 'Ver cómo' : 'Instalar', attrs: { type: 'button' }, on: { click: function () { install(); } } });
    return U.el('div.wn-card.in-card', { attrs: { role: 'status' } }, [
      U.el('span.wn-badge', { attrs: { 'aria-hidden': 'true' } }, [U.icon('download', 'xs')]),
      U.el('div.wn-text', [
        U.el('b', { text: ios() ? 'Instala WHIDER en tu iPhone' : 'Instala WHIDER' }),
        U.el('small', { text: ios() ? 'Se abre como una app, funciona sin conexión y te avisa de tus tareas.' : 'Se abre en su propia ventana y funciona sin conexión.' })
      ]),
      go, close
    ]);
  }
  /** Celda de Ajustes (null si no toca) */
  function cell() {
    if (!canInstall()) return null;
    return W.UI.cell({ icon: 'download', title: ios() ? 'Instalar en el iPhone' : 'Instalar WHIDER', sub: ios() ? 'Para que funcione como una app y te avise' : 'En su propia ventana y sin conexión', onTap: function () { install(); } });
  }

  W.Install = { ios: ios, standalone: standalone, isApp: isApp, canInstall: canInstall, install: install, sheet: sheet, card: card, cell: cell };
})(window.Whider);
