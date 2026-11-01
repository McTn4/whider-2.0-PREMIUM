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
  // Pega aquí el objeto firebaseConfig de tu proyecto (Configuración del proyecto → Tus apps → Web):
  // firebase: { apiKey: '...', authDomain: '...', projectId: '...', storageBucket: '...', messagingSenderId: '...', appId: '...' },
  firebase: null,

  // ID de cliente OAuth de tipo "Aplicación web" (Authentication → Método de acceso → Google → Configuración del SDK web).
  // Necesario para "Continuar con Google" dentro del APK de Android.
  googleWebClientId: '',

  // Pedir iniciar sesión o crear cuenta al abrir la app
  requireAccount: true,

  // Permitir "Continuar sin cuenta" (los datos se quedan solo en el dispositivo)
  allowGuest: true,

  // Restringir el registro con correo a dominios profesionales concretos, p. ej. ['miempresa.com'].
  // Vacío = cualquier correo.
  allowedEmailDomains: [],

  // Solo para pruebas locales con Firebase Emulator Suite
  emulator: null
};
