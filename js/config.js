/**
 * WHIDER · Configuración de cuentas (Firebase)
 *
 * Para activar el registro con correo y con Google, crea un proyecto gratuito en
 * https://console.firebase.google.com y copia aquí su configuración web.
 * Los pasos completos están en docs/CONFIGURAR-CUENTAS.md.
 *
 * Mientras `firebase` sea null, la app funciona sin cuentas (datos solo en el dispositivo).
 */
window.WHIDER_CONFIG = window.WHIDER_CONFIG || {
  // Proyecto de Firebase "whider" (Configuración del proyecto → Tus apps → Web)
  firebase: {
    apiKey: 'AIzaSyCiCgQxnu_X8uLj9ffJxy2jSUylPzs-BOU',
    authDomain: 'whider.firebaseapp.com',
    projectId: 'whider',
    storageBucket: 'whider.firebasestorage.app',
    messagingSenderId: '173378261361',
    appId: '1:173378261361:web:0319ba555a829e236aa6d0'
  },

  // ID de cliente OAuth de tipo "Aplicación web" (Authentication → Método de acceso → Google → Configuración del SDK web).
  // Necesario para "Continuar con Google" dentro del APK de Android.
  googleWebClientId: '173378261361-4je18n2pg7h9g39ei2prjmnasobc8m6v.apps.googleusercontent.com',

  // Pedir iniciar sesión o crear cuenta al abrir la app
  requireAccount: true,

  // Permitir "Continuar sin cuenta" (los datos se quedan solo en el dispositivo)
  allowGuest: true,

  // Restringir el registro con correo a dominios profesionales concretos, p. ej. ['miempresa.com'].
  // Vacío = cualquier correo.
  allowedEmailDomains: [],

  // Planes (Gratis y Premium): precios que muestra la app, días de prueba y cómo se activa Premium.
  //  - trialDays: días de la prueba gratuita de Premium. 0 = sin prueba (ni se ofrece ni se puede
  //    empezar, y una prueba que estuviera en marcha termina). Para volver a ofrecerla, pon 14.
  //  - checkoutUrl / checkoutUrlYearly: tu enlace de pago (por ejemplo un «Payment Link» de Stripe).
  //    Si los dejas en null, Premium solo se activa con códigos (o con la prueba, si trialDays > 0).
  //  - testCheckoutUrl / testCheckoutUrlYearly: enlaces del MODO DE PRUEBA de Stripe
  //    (https://buy.stripe.com/test_…: no se cobra nada). Mientras checkoutUrl sea null, «Hazte
  //    Premium» usa este enlace para todos, avisando de que es de prueba. Con un enlace real, el de
  //    prueba solo se usa en el dispositivo donde enciendas el modo de pruebas de pago: Ajustes →
  //    toca 7 veces la línea «WHIDER 8.x» del final. Sin enlace anual, el anual usa el mismo enlace.
  //  - codes: códigos de activación guardados como SHA-256 del código en MAYÚSCULAS. Para crear uno:
  //    node -e "console.log(require('crypto').createHash('sha256').update('MI-CODIGO').digest('hex'))"
  //    Escribe aquí solo la huella (SHA-256), nunca el código en claro: este repositorio es público.
  //    La primera es tu código de fundador.
  //  Ver docs/CONFIGURAR-CUENTAS.md, apartado «Planes y pagos».
  premium: {
    currency: '€', monthly: 3.99, yearly: 29.99, trialDays: 0, checkoutUrl: null, checkoutUrlYearly: null,
    testCheckoutUrl: 'https://buy.stripe.com/test_bJe4gz3kF4wm2rz1wBcAo00', testCheckoutUrlYearly: null,
    // Servidor de pagos (carpeta pagos/ publicada en Vercel): recibe el aviso de Stripe y activa Premium
    // solo en la cuenta que paga. La app le pregunta aquí si está configurado (no hay nada secreto).
    activationUrl: 'https://whider-20-premium-pagos.vercel.app/api/stripe-webhook',
    codes: ['6eb1ff5a9855a1bb70b2bb4e606bfe77beeaa32eb41d33307e4fb45879a0af44']
  },

  // Enlaces de invitación (contactos y equipos). Es la web donde está publicada la app: los enlaces
  // https://…/i/?… abren la invitación en la app (Android, ordenador) o en la web.
  // Si la publicas en otro dominio, cámbialo aquí y en .well-known/assetlinks.json (Android).
  links: { base: 'https://whider-red.vercel.app' },

  // Solo para pruebas locales con Firebase Emulator Suite
  emulator: null
};
