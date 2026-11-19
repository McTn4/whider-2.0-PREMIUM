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

  // Enlaces de invitación (contactos y equipos). Es la web donde está publicada la app: los enlaces
  // https://…/i/?… abren la invitación en la app (Android, ordenador) o en la web.
  // Si la publicas en otro dominio, cámbialo aquí y en .well-known/assetlinks.json (Android).
  links: { base: 'https://whider-red.vercel.app' },

  // Adjuntos del Cuaderno en Firebase Storage en lugar de en Firestore (en trozos). Más barato y rápido con archivos
  // grandes, pero Storage exige el plan Blaze (de pago por uso), desplegar storage.rules y la configuración CORS del
  // bucket: pasos en docs/CONFIGURAR-CUENTAS.md. Lo que ya esté en Firestore se sigue leyendo igual.
  storage: false,

  // Escuchas en tiempo real: lo que cambia en otro dispositivo (o lo que escribe tu equipo) llega al momento y la app
  // no consulta la nube cada pocos segundos. Con false, consulta la nube cada cierto tiempo, como hasta la 1.1 (por si
  // una red bloqueara las conexiones que se quedan abiertas).
  live: true,

  // Solo para pruebas locales con Firebase Emulator Suite
  emulator: null
};
