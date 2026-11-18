// Generado por tools/version.js desde package.json y CHANGELOG.md: no lo edites a mano.
// Para cambiar la versión: node tools/version.js 1.2.3 (y su entrada en CHANGELOG.md).
window.Whider = window.Whider || {};
window.Whider.VERSION = "1.1.0-beta.1";
window.Whider.RELEASES = [
 {
  "v": "1.1.0-beta.1",
  "date": "2026-11-18",
  "summary": "Versión de prueba de la 1.1: el día a día más claro, importar desde otras apps, sincronización sin pérdidas y más seguridad.",
  "groups": [
   {
    "t": "Novedades",
    "items": [
     "**Importar** desde Todoist, Google Tasks, Notion, calendarios (.ics) o cualquier CSV, con vista previa, categorías nuevas, repetidas reconocidas y opción de deshacer durante un día (Ajustes → Datos → Importar y exportar).",
     "**Hoy, por estados**: lo más importante, en curso, vencidas, pendientes y hechas. Una tarea puede marcarse «En curso».",
     "**Color por categoría** (opcional) y **prioridad legible**: «Urgente» e «Importante» se escriben junto a la tarea y pueden ir en color.",
     "**Barra inferior a tu gusto** en el móvil: tres pestañas entre Hoy, Tareas, Calendario, Cuaderno, Chats, Hábitos y Enfoque.",
     "**Primeros pasos**: cinco pasos que se cumplen solos mientras usas la app.",
     "**Android**: widget «Hoy», compartir texto con WHIDER desde otras apps y avisos a la hora exacta (permiso opcional).",
     "**Bloquear y denunciar** a personas, chats o mensajes. Las personas bloqueadas están en Ajustes → Privacidad.",
     "**Novedades de cada versión** en Ajustes → Ayuda, y un aviso en Hoy cuando WHIDER se actualiza.",
     "**Ordenador**: WHIDER se actualiza sola en Windows y en Linux (AppImage), y en macOS y Linux (.deb) avisa cuando hay una versión nueva."
    ]
   },
   {
    "t": "Mejoras",
    "items": [
     "Sincronización sin sobrescrituras: si cambias la misma tarea en dos dispositivos a la vez, se conservan los dos cambios; en el Cuaderno, las dos versiones de un bloque.",
     "Errores de la nube claros, con lo que hay que hacer y reintentos de verdad; un punto en el engranaje avisa de cambios sin subir.",
     "Cuando la copia en la nube se acerca a su tamaño máximo, las tareas completadas hace más de un año pasan a un archivo (se puede ver y exportar en Ajustes → Datos).",
     "Menos consumo: la app consulta la nube menos a menudo cuando no la estás usando.",
     "Descargas más ligeras para ordenador: un instalador para cada tipo de Mac (Apple Silicon o Intel) en lugar de uno doble, y solo los idiomas que se usan. Nuevo paquete .deb para Debian, Ubuntu y Mint (no necesita libfuse2).",
     "Títulos de sección más legibles; «Sistemas» pasa a llamarse «Automatizaciones»."
    ]
   },
   {
    "t": "Correcciones",
    "items": [
     "Al importar o crear muchas tareas de golpe, dos podían recibir el mismo identificador y una sustituía a la otra."
    ]
   },
   {
    "t": "Seguridad",
    "items": [
     "Nadie puede obtener la lista de perfiles ni de códigos de amigo; lo que otros dejan en tu buzón tiene un tamaño limitado.",
     "Las claves de las invitaciones y de los enlaces de equipo se generan con el generador criptográfico del sistema.",
     "Política de privacidad al día: bloqueos, denuncias, archivo, alarmas exactas y quién ve el perfil público."
    ]
   }
  ]
 },
 {
  "v": "1.0.0",
  "date": "2026-11-16",
  "summary": "Todo gratis, identidad nueva y lista para Google Play.",
  "groups": [
   {
    "t": "Novedades",
    "items": [
     "Todas las funciones para todos: desaparecen Premium, los planes y los pagos.",
     "Identidad nueva: tipografías Onest y Outfit, iconos propios y esquinas curvadas.",
     "Portada web con la descarga para cada dispositivo; la app en el navegador pasa a /app.",
     "Eliminar la cuenta desde la app o desde la web, sin instalar nada."
    ]
   },
   {
    "t": "Mejoras",
    "items": [
     "Preparada para Google Play (Android 16 y paquete AAB).",
     "En Android, la primera vez se adopta el tamaño de letra del sistema.",
     "Los enlaces externos se abren en el navegador del sistema."
    ]
   }
  ]
 }
];
