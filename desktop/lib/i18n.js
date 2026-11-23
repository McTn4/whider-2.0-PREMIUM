/**
 * Textos de la app de escritorio (menús, bandeja, avisos, diálogos, actualizaciones y la página de acceso) en el
 * idioma de la app. La ventana lo comunica al arrancar (js/app.js → WhiderDesktop.setLang) y se guarda en las
 * preferencias, así que los menús salen en ese idioma también al abrir la app la vez siguiente. Como en la app
 * (js/i18n/en.js), la clave es el propio texto en español; lo que no esté en el catálogo sale en español.
 */
'use strict';

const EN = {
  // Bandeja
  'Abrir WHIDER': 'Open WHIDER',
  'Nueva tarea': 'New task',
  Buscar: 'Search',
  'Tareas de hoy': "Today's tasks",
  'Nueva página del Cuaderno': 'New Notebook page',
  'Buscar actualizaciones': 'Check for updates',
  'Salir de WHIDER': 'Quit WHIDER',
  // Menús
  'Acerca de WHIDER': 'About WHIDER',
  'Ajustes…': 'Settings…',
  'Ocultar WHIDER': 'Hide WHIDER',
  'Ocultar otras': 'Hide others',
  'Mostrar todas': 'Show all',
  Archivo: 'File',
  'Buscar…': 'Search…',
  'Importar o exportar tareas…': 'Import or export tasks…',
  'Cerrar ventana': 'Close window',
  Edición: 'Edit',
  Deshacer: 'Undo',
  Rehacer: 'Redo',
  Cortar: 'Cut',
  Copiar: 'Copy',
  Pegar: 'Paste',
  'Seleccionar todo': 'Select all',
  Ver: 'View',
  Hoy: 'Today',
  Inicio: 'Home',
  Tareas: 'Tasks',
  Calendario: 'Calendar',
  Cuaderno: 'Notebook',
  Chats: 'Chats',
  Personas: 'People',
  'Tamaño real': 'Actual size',
  Ampliar: 'Zoom in',
  Reducir: 'Zoom out',
  'Pantalla completa': 'Full screen',
  Ventana: 'Window',
  Minimizar: 'Minimize',
  Zoom: 'Zoom',
  'Traer todo al frente': 'Bring all to front',
  Ayuda: 'Help',
  'Atajos de teclado': 'Keyboard shortcuts',
  Novedades: "What's new",
  'Buscar actualizaciones…': 'Check for updates…',
  // Aviso al cerrar la ventana
  'WHIDER sigue abierta': 'WHIDER is still open',
  'Te avisará de tus tareas desde {where}. Para salir, usa «Salir de WHIDER» en su menú.':
    'It will remind you of your tasks from {where}. To quit, use “Quit WHIDER” in its menu.',
  'el Dock': 'the Dock',
  'la bandeja del sistema': 'the system tray',
  // Diálogo de guardar
  'CSV (hoja de cálculo)': 'CSV (spreadsheet)',
  Texto: 'Text',
  'Calendario (iCalendar)': 'Calendar (iCalendar)',
  // Actualizaciones
  'Sin conexión: se volverá a mirar más tarde.': "Offline: it will check again later.",
  'Todavía no hay una versión publicada para este sistema.': "There's no published version for this system yet.",
  'GitHub no responde ahora mismo: se volverá a mirar más tarde.': "GitHub isn't responding right now: it will check again later.",
  'La descarga no pasó la comprobación de seguridad: se volverá a intentar.': "The download didn't pass the security check: it will try again.",
  'No se pudo comprobar ({error}).': "Couldn't check ({error}).",
  'Actualización lista': 'Update ready',
  'WHIDER {version} se instalará al cerrar la app.': 'WHIDER {version} will be installed when you close the app.',
  'Hay una versión nueva de WHIDER': "There's a new version of WHIDER",
  'La {version} ya se puede descargar.': '{version} is ready to download.',
  // Página para entrar con Google, Microsoft o Apple en el navegador (lib/acceso.js)
  'Entrar en WHIDER': 'Sign in to WHIDER',
  'WHIDER · Entrar con {name}': 'WHIDER · Sign in with {name}',
  'Pulsa el botón para continuar con tu cuenta de {name}. Después vuelve a la app.':
    'Press the button to continue with your {name} account. Then go back to the app.',
  'Continuar con {name}': 'Continue with {name}',
  'Esta copia de WHIDER no tiene cuentas configuradas.': "This copy of WHIDER doesn't have accounts set up.",
  'Elige tu cuenta en la ventana de {name}…': 'Choose your account in the {name} window…',
  'Listo. Ya puedes cerrar esta pestaña y volver a WHIDER.': 'Done. You can close this tab and go back to WHIDER.',
  'Has cerrado la ventana de {name}. Pulsa el botón para intentarlo otra vez.':
    'You closed the {name} window. Press the button to try again.',
  'El navegador ha bloqueado la ventana de {name}. Permite las ventanas emergentes de esta página e inténtalo otra vez.':
    'The browser blocked the {name} window. Allow pop-ups for this page and try again.',
  'Falta «localhost» en los dominios autorizados de Firebase (Authentication → Configuración).':
    '“localhost” is missing from the authorized domains in Firebase (Authentication → Settings).',
  'Este enlace ya no es válido. Vuelve a WHIDER y pulsa otra vez «Continuar con {name}».':
    'This link is no longer valid. Go back to WHIDER and press “Continue with {name}” again.',
  'Este enlace ya no es válido. Vuelve a WHIDER.': 'This link is no longer valid. Go back to WHIDER.',
  'Ya tienes una cuenta de WHIDER con ese correo. Entra con el método que usaste la primera vez (por ejemplo, Google).':
    'You already have a WHIDER account with that email. Sign in with the method you used the first time (for example, Google).',
  '{name} no está activado en Firebase (Authentication → Método de acceso).':
    "{name} isn't enabled in Firebase (Authentication → Sign-in method).",
  'No se pudo entrar con {name}': "Couldn't sign in with {name}",
  '. Inténtalo otra vez.': '. Try again.'
};
const CATALOGS = { en: EN };

/** Idioma guardado (el de la app la última vez que se abrió): «es» si no hay otro */
function lang() {
  let l = null;
  try {
    // Al usarlo, no al cargar el archivo: las preferencias necesitan Electron, que las pruebas unitarias no tienen
    l = require('./prefs').get('lang');
  } catch (e) {
    /* fuera de Electron (pruebas unitarias): español */
  }
  return CATALOGS[l] ? l : 'es';
}

/** Texto en el idioma de la app, con {variables} */
function t(es, vars) {
  const c = CATALOGS[lang()];
  let s = c && Object.prototype.hasOwnProperty.call(c, es) ? c[es] : es;
  if (vars) s = s.replace(/\{(\w+)\}/g, (m, k) => (vars[k] != null ? String(vars[k]) : m));
  return s;
}

module.exports = { t, lang, CATALOGS };
