/**
 * WHIDER · Planes y precios: Gratis y Premium, con la comparativa por PC, Móvil y General.
 * Desde aquí se paga (si está configurado), se canjea un código o se empieza la prueba gratuita
 * (si premium.trialDays es mayor que 0).
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
    if (!isPrem) {
      actions.push(U.el('button.btn.ghost.block', { attrs: prem ? null : { disabled: true }, on: { click: function () {
        W.Sheet.confirm({ title: '¿Volver al plan gratuito?', text: 'Tus datos se conservan. Las funciones Premium dejarán de estar disponibles.', ok: 'Volver a Gratis', danger: true })
          .then(function (ok) { if (ok) { P.cancel(); W.Router.refresh(); } });
      } } }, [prem ? 'Volver a Gratis' : 'Tu plan actual']));
    } else if (prem) {
      actions.push(U.el('button.btn.primary.block', { attrs: { disabled: true } }, [U.icon('gem', 'sm'), P.isTrial() ? 'Prueba activa' : 'Tienes Premium']));
    } else {
      if (P.hasCheckout()) actions.push(U.el('button.btn.primary.block', { on: { click: function () { P.checkout(period); } } }, [U.icon('gem', 'sm'), P.isTestCheckout() ? 'Hazte Premium (prueba)' : 'Hazte Premium']));
      if (P.canTrial()) actions.push(U.el('button.btn.' + (P.hasCheckout() ? 'ghost' : 'primary') + '.block', { on: { click: function () { if (P.startTrial()) W.Router.refresh(); } } }, [P.hasCheckout() ? null : U.icon('gem', 'sm'), 'Probar ' + PR.trialDays + ' días gratis']));
      // Sin pago ni prueba, la única forma es un código: lleva a la casilla de abajo
      if (!actions.length) actions.push(U.el('button.btn.soft.block', { on: { click: function () {
        var input = document.querySelector('#screen-plans .pl-code input');
        if (!input) return;
        input.scrollIntoView({ block: 'center', behavior: U.reducedMotion() ? 'auto' : 'smooth' });
        input.focus({ preventScroll: true });
      } } }, ['Canjear un código']));
    }
    return U.el('div.pl-card' + (isPrem ? '.premium' : '') + ((isPrem && prem) || (!isPrem && !prem) ? '.current' : ''), [
      U.el('div.pl-top', [isPrem ? U.el('span.pl-gem', [U.icon('gem')]) : U.el('span.pl-gem.free', [U.icon('check')]),
        U.el('div', [U.el('strong', { text: isPrem ? 'Premium' : 'Gratis' }), U.el('span', { text: isPrem ? 'Para trabajar como un profesional' : 'Para organizar tu día' })])]),
      U.el('div.pl-price', [U.el('b', { text: price }), U.el('span', { text: ' ' + per })]),
      note ? U.el('div.pl-note', { text: note }) : U.el('div.pl-note', { text: 'Sin tarjeta, sin anuncios' }),
      U.el('div.pl-actions', actions)
    ]);
  }

  function codeBox() {
    var input = U.el('input.input', { attrs: { type: 'text', placeholder: 'Código de activación', 'aria-label': 'Código de activación', autocapitalize: 'characters', autocomplete: 'off', spellcheck: 'false' } });
    var go = function () {
      if (!input.value.trim()) { input.focus(); return; }
      if (W.Plan.redeem(input.value)) { input.value = ''; W.Router.refresh(); }
      else { input.classList.add('shake'); setTimeout(function () { input.classList.remove('shake'); }, 450); W.Toast.show({ text: 'Ese código no es válido', type: 'danger' }); }
    };
    input.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); go(); } });
    return U.el('div.pl-code', [input, U.el('button.btn.soft', { text: 'Canjear', on: { click: go } })]);
  }

  W.Screens.plans = {
    title: 'Planes',
    back: function () { W.Router.back(); return true; },
    render: function (root) {
      var P = W.Plan, PR = P.PRICES;
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
      // Modo de pruebas de pago (Ajustes → 7 toques en la versión): que nunca se confunda con un pago real
      var testNote = P.isTestCheckout() ? U.el('div.pl-test', { attrs: { role: 'note' } }, [
        U.icon('alert', 'sm'),
        U.el('span', [U.el('strong', { text: 'Modo de pruebas de pago. ' }), 'El pago abre tu enlace de prueba de Stripe y no se cobra nada. Tarjeta: 4242 4242 4242 4242, cualquier fecha futura y cualquier CVC. Se apaga con 7 toques en la versión, en Ajustes.'])
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
        W.UI.cell({ title: '¿Cómo se activa?', sub: P.hasCheckout() ? 'Paga de forma segura en la página de pago y canjea el código que recibirás.' :
          P.trialOn() ? 'Empieza la prueba gratuita o canjea tu código de activación aquí abajo.' : 'Con un código de activación: escríbelo aquí abajo.' })
      ] });
      var code = W.UI.section({ header: 'Código de activación', items: U.el('div.group', [U.el('div.cell.col', [codeBox()])]),
        footer: P.isPremium() && P.get().source === 'code' ? 'Premium activado con un código.' : 'Si te han dado un código de Premium, escríbelo aquí.' });
      W.UI.mount(root, head, [hero, testNote, cards, table, faq, code]);
    }
  };
})(window.Whider);
