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
  //  - checkoutUrl / checkoutUrlYearly: tu enlace de pago (por ejemplo un «Payment Link» de Stripe).
  //    Si los dejas en null, la app ofrece la prueba gratuita y los códigos de activación.
  //  - codes: códigos de activación guardados como SHA-256 del código en MAYÚSCULAS. Para crear uno:
  //    node -e "console.log(require('crypto').createHash('sha256').update('MI-CODIGO').digest('hex'))"
  //  Ver docs/CONFIGURAR-CUENTAS.md, apartado «Planes y pagos».
  premium: { currency: '€', monthly: 3.99, yearly: 29.99, trialDays: 14, checkoutUrl: null, checkoutUrlYearly: null, codes: [] },

  // Solo para pruebas locales con Firebase Emulator Suite
  emulator: null
};
