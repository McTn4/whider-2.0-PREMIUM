/**
 * WHIDER · Planes y precios: Gratis y Premium, con la comparativa por PC, Móvil y General.
 * Desde aquí uno se suscribe: «Suscribirse» abre la página de pago de Stripe y, al confirmarse el pago,
 * Premium se activa solo. (Y la prueba gratuita, si premium.trialDays es mayor que 0.)
 */
window.Whider = window.Whider || {};
window.Whider.Screens = window.Whider.Screens || {};

(function (W) {
  'use strict';
  var U = W.U, S = function () { return W.State; };
  var period = 'yearly';

  // Comparativa: [función, detalle, gratis (true · false · texto), premium (true · texto)]
  var TABLE = [
    { title: 'PC', icon: 'monitor', sub: 'Experiencia avanzada, organización y productividad profesional', rows: [
      ['Calendario profesional', 'Mes, semana y día; duración de las tareas, arrastrar y exportar', true, true],
      ['Tareas por categorías', 'Con icono, colores de prioridad y vistas automáticas', true, true],
      ['Más orden y organización', 'Hábitos, selección múltiple y filtros guardados', '3 filtros', 'Sin límite'],
      ['Cuaderno', 'Páginas por bloques, bases de datos con vistas y plantillas', true, true],
      ['Creación de sistemas profesionales', 'GTD, Eisenhower, bloqueo de tiempo y automatizaciones', false, true],
      ['Organización muy avanzada', 'Tablero, estadísticas de un año e informes completos', 'Básica', true],
      ['Personalización avanzada', 'Barra lateral, Hoy, calendario, ancho y contraste', false, true],
      ['Equipos de trabajo', 'Crea equipos con su chat y páginas del Cuaderno compartidas', 'Unirte', true]
    ] },
    { title: 'Móvil', icon: 'phone', sub: 'Experiencia rápida, accesible y conectada con el ordenador', rows: [
      ['Calendario', 'Mes, semana y agenda', true, true],
      ['Tareas por categorías', 'Con deslizar para completar', true, true],
      ['Mejor ecosistema', 'Una sola app, sincronizada con el ordenador', true, true],
      ['Mayor rapidez', 'Plantillas de un toque y sincronización al instante', false, true],
      ['Gestionar el ordenador', 'Mira y controla el enfoque y los dispositivos', false, true],
      ['Chats con tus contactos', 'Con quien te invite: mensajes, tareas y páginas', true, true],
      ['Invitar con enlace o QR', 'Añade a amigos y compañeros de trabajo', false, true]
    ] },
    { title: 'General', icon: 'sparkle', sub: 'Personalización, juego, personas, sonidos, notificaciones y planes', rows: [
      ['Sonidos de botones y avisos', 'Elige cuáles suenan y a qué volumen', true, true],
      ['Personaje personalizable', 'Tu compañero y tu foto de perfil', true, 'Y personajes Premium'],
      ['Notificaciones y recordatorios', 'De tareas y de hábitos', true, true],
      ['Copia en la nube', 'En todos tus dispositivos con tu cuenta', true, 'Al instante']
    ] }
  ];

  function mark(v) {
    if (v === true) return U.el('span.pl-yes', { attrs: { 'aria-label': 'Incluido' } }, [U.icon('check')]);
    if (v === false) return U.el('span.pl-no', { attrs: { 'aria-label': 'No incluido' }, text: '—' });
    return U.el('span.pl-txt', { text: v });
  }

  function priceCard(kind) {
    var P = W.Plan, PR = P.PRICES, prem = P.isPremium(), isPrem = kind === 'premium';
    var price, per, note = null;
    if (!isPrem) { price = P.fmtPrice(0); per = 'para siempre'; }
    else if (period === 'yearly') { price = P.fmtPrice(PR.yearly); per = 'al año'; note = P.fmtPrice(PR.yearly / 12) + ' al mes · ahorras ' + Math.round((1 - PR.yearly / (PR.monthly * 12)) * 100) + ' %'; }
    else { price = P.fmtPrice(PR.monthly); per = 'al mes'; note = 'Cancela cuando quieras'; }
    var actions = [];
    if (!isPrem && P.isPurchase()) {
      // Premium pagado: se deja cancelando el pago en Stripe (desde su correo); aquí volvería a activarse solo
      actions.push(U.el('button.btn.ghost.block', { attrs: { disabled: true } }, ['Plan gratuito']));
    } else if (!isPrem) {
      actions.push(U.el('button.btn.ghost.block', { attrs: prem ? null : { disabled: true }, on: { click: function () {
        W.Sheet.confirm({ title: '¿Volver al plan gratuito?', text: 'Tus datos se conservan. Las funciones Premium dejarán de estar disponibles.', ok: 'Volver a Gratis', danger: true })
          .then(function (ok) { if (ok) { P.cancel(); W.Router.refresh(); } });
      } } }, [prem ? 'Volver a Gratis' : 'Tu plan actual']));
    } else if (prem) {
      actions.push(U.el('button.btn.primary.block', { attrs: { disabled: true } }, [U.icon('gem', 'sm'), P.isTrial() ? 'Prueba activa' : P.isTestPurchase() ? 'Premium de prueba activo' : 'Tienes Premium']));
    } else {
      if (P.canTrial() && !P.canSubscribe()) actions.push(U.el('button.btn.primary.block', { on: { click: function () { if (P.startTrial()) W.Router.refresh(); } } }, [U.icon('gem', 'sm'), 'Probar ' + PR.trialDays + ' días gratis']));
      else actions.push(subscribeBtn());
      if (P.canTrial() && P.canSubscribe()) actions.push(U.el('button.btn.ghost.block', { on: { click: function () { if (P.startTrial()) W.Router.refresh(); } } }, ['Probar ' + PR.trialDays + ' días gratis']));
    }
    return U.el('div.pl-card' + (isPrem ? '.premium' : '') + ((isPrem && prem) || (!isPrem && !prem) ? '.current' : ''), [
      U.el('div.pl-top', [isPrem ? U.el('span.pl-gem', [U.icon('gem')]) : U.el('span.pl-gem.free', [U.icon('check')]),
        U.el('div', [U.el('strong', { text: isPrem ? 'Premium' : 'Gratis' }), U.el('span', { text: isPrem ? 'Para trabajar como un profesional' : 'Para organizar tu día' })])]),
      U.el('div.pl-price', [U.el('b', { text: price }), U.el('span', { text: ' ' + per })]),
      note ? U.el('div.pl-note', { text: note }) : U.el('div.pl-note', { text: 'Sin tarjeta, sin anuncios' }),
      U.el('div.pl-actions', actions)
    ]);
  }

  /** «Suscribirse»: abre la página de pago de Stripe del periodo elegido (desactivado si aún no se puede) */
  function subscribeBtn() {
    var P = W.Plan, ok = P.canSubscribe();
    return U.el('button.btn.primary.block', { attrs: ok ? null : { disabled: true }, on: { click: function () { P.checkout(period); } } },
      [U.icon('gem', 'sm'), P.isTestCheckout() ? 'Suscribirse (prueba)' : 'Suscribirse']);
  }

  /** Donde antes se canjeaban códigos: el plan elegido y «Suscribirse»; con Premium, cómo lo tienes */
  function subscribeSection() {
    var P = W.Plan, PR = P.PRICES, auto = P.autoActivation();
    if (P.isPremium()) {
      var how = P.isLifetime() ? 'Premium para siempre en esta cuenta.'
        : P.isTrial() ? P.status() + '.'
        : P.isTestPurchase() ? P.status() + '. Activado con un pago de prueba.'
        : P.isPurchase() ? 'Suscripción activa en tu cuenta y en todos tus dispositivos. Para darte de baja, usa el enlace del correo de Stripe.'
        : P.status() + '.';
      return W.UI.section({ header: 'Tu Premium', items: [W.UI.cell({ icon: 'gem', title: 'Tienes Premium', sub: how })] });
    }
    var yearly = period === 'yearly';
    var summary = W.UI.cell({ icon: 'gem', title: yearly ? 'Premium anual' : 'Premium mensual',
      sub: yearly ? P.fmtPrice(PR.yearly) + ' al año · ' + P.fmtPrice(PR.yearly / 12) + ' al mes' : P.fmtPrice(PR.monthly) + ' al mes · cancela cuando quieras' });
    var footer = !P.canSubscribe() ? 'La suscripción estará disponible muy pronto.'
      : P.isTestCheckout() && auto ? 'Se abre la página de pago de prueba de Stripe: no se cobra nada y, al terminar, Premium se activa solo en tu cuenta durante 24 horas.'
      : P.isTestCheckout() ? 'Se abre la página de pago de prueba de Stripe: no se cobra nada y, por ahora, el pago no activa Premium.'
      : 'Se abre la página de pago segura de Stripe. Al terminar, Premium se activa solo en tu cuenta y en todos tus dispositivos.';
    return W.UI.section({ header: 'Suscribirse', items: U.el('div.group', [summary, U.el('div.cell.col.pl-sub', [subscribeBtn()])]), footer: footer });
  }

  W.Screens.plans = {
    title: 'Planes',
    back: function () { W.Router.back(); return true; },
    render: function (root) {
      var P = W.Plan, PR = P.PRICES, auto = P.autoActivation();
      P.autoStatus();   // pregunta al servidor si la activación automática está configurada (con caché)
      var head = W.UI.header({ title: 'Planes', back: { label: 'Atrás', onTap: function () { W.Router.back(); } }, sub: P.status(), gear: false });
      var seg = W.UI.segmented([{ value: 'monthly', label: 'Mensual' }, { value: 'yearly', label: 'Anual · −' + Math.round((1 - PR.yearly / (PR.monthly * 12)) * 100) + ' %' }], period,
        function (v) { period = v; W.Router.refresh(); }, { mini: true });
      var hero = U.el('div.pl-hero', [
        U.el('span.pl-hero-gem', [U.icon('gem')]),
        U.el('h2', { text: 'WHIDER Premium' }),
        U.el('p', { text: 'Todo lo esencial es gratis en el móvil y en el ordenador. Premium añade lo profesional: sistemas, organización muy avanzada, personalización, invitar y crear equipos.' }),
        seg
      ]);
      var cards = U.el('div.pl-cards', [priceCard('free'), priceCard('premium')]);
      // Pago de prueba de Stripe (sin enlace real todavía, o con los 7 toques en la versión): que nunca
      // se confunda con un pago real
      var testNote = P.isTestCheckout() ? U.el('div.pl-test', { attrs: { role: 'note' } }, [
        U.icon('alert', 'sm'),
        P.isTestForced()
          ? U.el('span', [U.el('strong', { text: 'Modo de pruebas de pago. ' }), 'El pago abre tu enlace de prueba de Stripe y no se cobra nada. Tarjeta: 4242 4242 4242 4242, cualquier fecha futura y cualquier CVC. Se apaga con 7 toques en la versión, en Ajustes.'])
          : U.el('span', [U.el('strong', { text: 'Pagos de prueba. ' }), auto
            ? 'La página de pago es de prueba de Stripe: no se cobra nada y Premium se activa solo en tu cuenta durante 24 horas. Tarjeta: 4242 4242 4242 4242, cualquier fecha futura y cualquier CVC.'
            : 'La página de pago es de prueba de Stripe: no se cobra nada y, por ahora, no activa Premium. Tarjeta: 4242 4242 4242 4242, cualquier fecha futura y cualquier CVC.'])
      ]) : null;
      // Pago hecho desde aquí, esperando la confirmación de Stripe
      var pending = P.isPending() ? U.el('div.pl-wait', { attrs: { role: 'status' } }, [
        U.el('span.pl-wait-dot'),
        U.el('span', [U.el('strong', { text: 'Esperando la confirmación del pago. ' }), 'Premium se activará solo en cuanto Stripe lo confirme (suelen ser unos segundos).']),
        U.el('button.btn.soft', { text: 'Comprobar ahora', on: { click: function () {
          var b = this; b.disabled = true;
          P.syncPurchase(true).then(function (on) {
            b.disabled = false;
            if (!on) W.Toast.show({ text: 'Aún no ha llegado la confirmación del pago. Prueba de nuevo en unos segundos.', icon: 'gem' });
          });
        } } })
      ]) : null;
      var table = U.el('div.pl-table', TABLE.map(function (sec) {
        return U.el('div.group.pl-sec', [
          U.el('div.pl-row.pl-head', [U.el('div.pl-feat', [U.el('strong', [U.icon(sec.icon, 'sm'), sec.title]), U.el('small', { text: sec.sub })]),
            U.el('span.pl-col', { text: 'Gratis' }), U.el('span.pl-col.prem', { text: 'Premium' })])
        ].concat(sec.rows.map(function (r) {
          return U.el('div.pl-row', [U.el('div.pl-feat', [U.el('span', { text: r[0] }), U.el('small', { text: r[1] })]),
            U.el('span.pl-col', [mark(r[2])]), U.el('span.pl-col.prem', [mark(r[3])])]);
        })));
      }));
      var faq = W.UI.section({ header: 'Preguntas frecuentes', items: [
        W.UI.cell({ title: '¿Pierdo algo si vuelvo a Gratis?', sub: 'No. Tus tareas, tu Cuaderno, tus hábitos, tus contactos y tus chats se quedan; solo se pausan las funciones Premium.' }),
        W.UI.cell({ title: '¿Vale para el móvil y el ordenador?', sub: 'Sí. Con tu cuenta, Premium se activa en todos tus dispositivos.' }),
        W.UI.cell({ title: '¿Cómo se activa?', sub: P.isTestCheckout() && auto ? 'Pulsa «Suscribirse»: se abre la página de pago de prueba de Stripe (no se cobra nada) y, al terminar, Premium se activa solo en tu cuenta durante 24 horas.' :
          P.isTestCheckout() ? 'Pulsa «Suscribirse»: se abre la página de pago de prueba de Stripe. Los pagos aún son de prueba: no se cobra nada y, por ahora, Premium no se activa al pagar.' :
          P.canSubscribe() ? 'Pulsa «Suscribirse» y paga en la página segura de Stripe: Premium se activa solo en tu cuenta y en todos tus dispositivos.' :
          P.trialOn() ? 'Empieza la prueba gratuita desde la tarjeta de Premium. La suscripción estará disponible muy pronto.' : 'Con una suscripción, que estará disponible muy pronto.' })
      ] });
      W.UI.mount(root, head, [hero, testNote, pending, cards, table, faq, subscribeSection()]);
    }
  };
})(window.Whider);
