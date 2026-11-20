// @ts-check
/**
 * WHIDER · Ayuda: preguntas frecuentes, enviar comentarios y errores recientes (Ajustes → Ayuda).
 *  - Comentarios: con cuenta se envían a la nube (colección «feedback», que solo se lee desde la consola), sin tu
 *    nombre ni tu cuenta. Sin cuenta, se pueden escribir en GitHub (es público) o copiar.
 *  - Datos técnicos opcionales: versión, sistema y los últimos errores (sin tus tareas ni tu Cuaderno).
 */
window.Whider = window.Whider || {};

(function (W) {
  'use strict';
  var U = W.U;
  var ISSUES = 'https://github.com/McTn4/whider-2.0-PREMIUM/issues/new';

  /** Preguntas frecuentes: [pregunta, respuesta] */
  var FAQ = [
    [W.t('¿Dónde se guardan mis datos?'), W.t('En tu dispositivo. Si inicias sesión, también en tu cuenta en la nube, y solo tú puedes leerlos. Sin cuenta, nadie más los ve, pero tampoco se recuperan si pierdes el dispositivo: guarda copias en Ajustes → Datos.')],
    [W.t('¿Cómo uso WHIDER en el móvil y en el ordenador?'), W.t('Inicia sesión con la misma cuenta en los dos (correo o Google). Todo se sincroniza solo: tareas, Cuaderno, hábitos y ajustes.')],
    [W.t('¿Qué pasa si cambio lo mismo en dos dispositivos a la vez?'), W.t('Se conservan los dos cambios si son distintos (uno cambia la fecha y otro la completa). Si los dos editan el mismo bloque del Cuaderno, se queda el más reciente y la otra versión, justo debajo.')],
    [W.t('¿Cómo escribo una tarea con fecha rápido?'), W.t('Escríbelo tal cual: «Llamar a Ana mañana a las 10» o «Pagar el alquiler el día 1». Añade «#trabajo» para la categoría y «!!» para marcarla importante («!!!», urgente).')],
    [W.t('No me llegan los avisos'), W.t('Comprueba que WHIDER tiene permiso para notificar (Ajustes → Avisos). En Android, activa los avisos a la hora exacta para que no se retrasen. En el iPhone, añade WHIDER a la pantalla de inicio: Safari solo avisa así.')],
    [W.t('¿Cómo traigo mis tareas de otra app?'), W.t('Ajustes → Datos → Importar desde otras apps: Todoist, Google Tasks, Notion, calendarios (.ics) o cualquier hoja de cálculo (CSV). Verás una vista previa y podrás deshacerlo durante un día.')],
    [W.t('¿Cómo guardo una copia de seguridad?'), W.t('Ajustes → Datos → Guardar una copia. En el ordenador y en Android, sin cuenta, WHIDER guarda además una copia automática cada día.')],
    [W.t('¿Cómo bloqueo o denuncio a alguien?'), W.t('Desde sus opciones en Personas o en un chat: «Denunciar…» o «Bloquear». Las personas bloqueadas están en Ajustes → Privacidad.')],
    [W.t('¿Cómo elimino mi cuenta?'), W.t('Ajustes → Cuenta → Eliminar la cuenta. Se borran tus datos de la nube. También puedes hacerlo desde la web, en /app#cuenta.')],
    [W.t('¿WHIDER es gratis?'), W.t('Sí. Todas las funciones, sin anuncios ni compras dentro de la app.')]
  ];

  function faq() {
    return W.Sheet.open({
      title: W.t('Preguntas frecuentes'), className: 'help',
      body: [U.el('div.hp-faq', FAQ.map(function (q) {
        return U.el('details.hp-q', [U.el('summary', { text: q[0] }), U.el('p', { text: q[1] })]);
      })), U.el('p.hint', { text: W.t('¿No está tu pregunta? Escríbenos desde «Enviar comentarios».') })]
    });
  }

  function tecnico(withErrors) {
    var lines = ['WHIDER ' + (W.WhatsNew ? W.WhatsNew.label(W.VERSION) : W.VERSION), W.Errors ? W.Errors.platform() : navigator.userAgent];
    var errs = withErrors && W.Errors ? W.Errors.report(3) : '';
    return { v: String(W.VERSION || ''), p: lines[1], text: lines.join(' · ') + (errs ? '\n\n' + W.t('Errores recientes:') + '\n' + errs : ''), errors: errs };
  }
  function signedIn() { var A = W.Auth; return !!(A && A.user && (!A.isVerified || A.isVerified())); }

  /** Enviar comentarios: una idea, algo que no funciona u otra cosa */
  function feedback(kind) {
    var k = kind || 'idea';
    var text = U.el('textarea.input.hp-text', { attrs: { rows: 6, maxlength: 2000, placeholder: W.t('¿Qué te gustaría o qué ha pasado? Cuéntalo con tus palabras.'), 'aria-label': W.t('Tu comentario') } });
    var tech = U.el('input', { attrs: { type: 'checkbox', id: 'hp-tech' } });
    /** @type {HTMLInputElement} */ (tech).checked = true;
    var kinds = [{ value: 'idea', label: W.t('Una idea') }, { value: 'fallo', label: W.t('Algo no funciona') }, { value: 'otro', label: W.t('Otra cosa') }];
    var seg = U.el('div.hp-kinds', { attrs: { role: 'radiogroup', 'aria-label': W.t('Tipo de comentario') } });
    var drawKinds = function () {
      U.clear(seg);
      kinds.forEach(function (o) {
        seg.appendChild(U.el('button.hp-kind' + (o.value === k ? '.on' : ''), { text: o.label, attrs: { type: 'button', role: 'radio', 'aria-checked': o.value === k ? 'true' : 'false' }, on: { click: function () { k = o.value; drawKinds(); } } }));
      });
    };
    drawKinds();
    var send = U.el('button.btn.primary.block', { text: signedIn() ? W.t('Enviar') : W.t('Escribirlo en GitHub'), attrs: { type: 'button' } });
    var copy = U.el('button.btn.ghost.block', { text: W.t('Copiar el texto'), attrs: { type: 'button' } });
    var body = function () {
      var t = /** @type {HTMLTextAreaElement} */ (text).value.trim();
      var info = /** @type {HTMLInputElement} */ (tech).checked ? tecnico(k === 'fallo') : null;
      return { t: t, info: info, full: t + (info ? '\n\n---\n' + info.text : '') };
    };
    var sheet = W.Sheet.open({
      title: W.t('Enviar comentarios'), className: 'help',
      body: [
        seg, text,
        U.el('label.hp-check', { attrs: { for: 'hp-tech' } }, [tech, U.el('span', { text: W.t('Añadir datos técnicos: versión, sistema y, si algo falla, los últimos errores (nunca tus tareas ni tu Cuaderno).') })]),
        U.el('p.hint', { text: signedIn() ? W.t('Se envía sin tu nombre ni tu cuenta. No podremos contestarte por aquí.') : W.t('Sin cuenta, puedes escribirlo en GitHub (es público: cualquiera lo verá) o copiarlo y enviarlo como prefieras.') })
      ],
      foot: [send, signedIn() ? null : copy]
    });
    send.addEventListener('click', function () {
      var b = body();
      if (!b.t) { W.Toast.show({ text: W.t('Escribe primero tu comentario'), icon: 'info' }); text.focus(); return; }
      if (!signedIn()) {
        U.openExternal(ISSUES + '?' + new URLSearchParams({ title: (k === 'fallo' ? 'Fallo: ' : k === 'idea' ? 'Idea: ' : '') + b.t.slice(0, 70), body: b.full.slice(0, 6000) }).toString());
        sheet.close();
        return;
      }
      /** @type {HTMLButtonElement} */ (send).disabled = true;
      var F = W.Auth.sdk(), db = W.Auth.db();
      var doc = { kind: k, text: b.t.slice(0, 2000), at: Date.now() };
      if (b.info) Object.assign(doc, { v: b.info.v.slice(0, 40), p: b.info.p.slice(0, 120), errors: b.info.errors.slice(0, 2000) });
      F.setDoc(F.doc(db, 'feedback', U.uid('c')), doc).then(function () {
        sheet.close();
        W.Toast.show({ text: W.t('Gracias. Lo leeremos con calma.'), icon: 'check', type: 'success' });
      }).catch(function () {
        /** @type {HTMLButtonElement} */ (send).disabled = false;
        W.Toast.show({ text: W.t('No se pudo enviar. Inténtalo con conexión.'), type: 'danger' });
      });
    });
    copy.addEventListener('click', function () {
      var b = body();
      if (!navigator.clipboard) return;
      navigator.clipboard.writeText(b.full).then(function () { W.Toast.show({ text: W.t('Copiado'), icon: 'check' }); }).catch(function () { /* sin portapapeles */ });
    });
    setTimeout(function () { text.focus(); }, 300);
    return sheet;
  }

  /** Errores recientes (página de Ajustes) */
  function errorsPage(nav) {
    var list = W.Errors ? W.Errors.list() : [];
    return {
      title: W.t('Errores recientes'),
      body: list.length ? [
        W.UI.section({ items: list.map(function (e) {
          return W.UI.cell({ icon: 'alert', title: e.msg, sub: U.fmtRel(e.at - Date.now()) + ' · ' + e.v + (e.count > 1 ? ' · ' + e.count + ' veces' : '') });
        }), footer: W.Errors.enabled() ? W.t('Se envían sin tu nombre ni tu cuenta (Ajustes → Privacidad).') : W.t('Solo están en este dispositivo. Puedes copiarlos para contarnos qué pasó.') }),
        U.el('div.cell-row', { style: { justifyContent: 'center', gap: '10px', padding: '8px 0' } }, [
          U.el('button.btn.sm.soft', { text: W.t('Copiar'), attrs: { type: 'button' }, on: { click: function () {
            if (navigator.clipboard) navigator.clipboard.writeText(W.Errors.report()).then(function () { W.Toast.show({ text: W.t('Copiado'), icon: 'check' }); }).catch(function () { /* sin portapapeles */ });
          } } }),
          U.el('button.btn.sm.ghost', { text: W.t('Borrar'), attrs: { type: 'button' }, on: { click: function () { W.Errors.clear(); nav.refresh(); } } })
        ])
      ] : [U.el('p.hint', { text: W.t('No hay errores recientes.') })]
    };
  }

  W.Help = { FAQ: FAQ, faq: faq, feedback: feedback, errorsPage: errorsPage };
})(window.Whider);
