// Generado por tools/version.js desde package.json y CHANGELOG.md: no lo edites a mano.
// Para cambiar la versión: node tools/version.js 1.2.3 (y su entrada en CHANGELOG.md).
window.Whider = window.Whider || {};
window.Whider.VERSION = "1.1.0";
window.Whider.RELEASES = [
 {
  "v": "1.1.0",
  "date": "2026-11-18",
  "summary": "La 1.1: tema claro, importar desde otras apps, un Hoy más claro, sincronización sin pérdidas, copias automáticas, más seguridad y un ordenador que se actualiza solo.",
  "groups": [
   {
    "t": "Novedades",
    "items": [
     "**Importar** desde Todoist, Google Tasks, Notion, calendarios (.ics) o cualquier CSV, con vista previa, categorías nuevas, repetidas reconocidas y opción de deshacer durante un día (Ajustes → Datos → Importar desde otras apps).",
     "**Tema claro**: Ajustes → Apariencia → Tema (Oscuro, Claro o «Como el sistema»). Toda la app, también la ventana del ordenador y las barras del sistema en Android, sin destellos al abrir; el alto contraste también funciona en claro.",
     "**Hoy, por estados**: lo más importante, en curso, vencidas, pendientes y hechas. Una tarea puede marcarse «En curso».",
     "**Copias automáticas** sin cuenta: en el ordenador, una al día en la carpeta de datos de WHIDER (las 10 últimas, con la lista para recuperarlas); en Android, en Descargas › WHIDER › Copias (las 7 últimas, que siguen ahí aunque desinstales la app). En el navegador, un aviso en Hoy si pasa una semana sin copia.",
     "**El ordenador se actualiza solo**: en Windows y en Linux (AppImage), WHIDER descarga la versión nueva y la instala al cerrar; en macOS y en Linux (.deb) avisa con el enlace.",
     "**Color por categoría** (opcional) y **prioridad legible**: «Urgente» e «Importante» se escriben junto a la tarea y pueden ir en color.",
     "**Android**: widget «Hoy», compartir texto con WHIDER desde otras apps y avisos a la hora exacta (permiso opcional).",
     "**Barra inferior a tu gusto** en el móvil: tres pestañas entre Hoy, Tareas, Calendario, Cuaderno, Chats, Hábitos y Enfoque.",
     "**Ayuda** (Ajustes → Ayuda): preguntas frecuentes, las novedades de cada versión y «Enviar comentarios» (una idea, algo que no funciona u otra cosa).",
     "**Bloquear y denunciar** a personas, chats o mensajes. Las personas bloqueadas están en Ajustes → Privacidad.",
     "**Instalar en el iPhone**: WHIDER explica cómo añadirla a la pantalla de inicio; en Chrome y Edge, un botón «Instalar».",
     "**Primeros pasos**: cinco pasos que se cumplen solos mientras usas la app.",
     "**La web, también en inglés**: la portada (/en/) y la política de privacidad (/privacy/). La app sigue en español por ahora."
    ]
   },
   {
    "t": "Mejoras",
    "items": [
     "Sincronización sin sobrescrituras: si cambias la misma tarea en dos dispositivos a la vez, se conservan los dos cambios; en el Cuaderno, las dos versiones de un bloque.",
     "Errores de la nube claros, con lo que hay que hacer y reintentos de verdad; un punto en el engranaje avisa de cambios sin subir.",
     "La web abre antes: en un móvil de gama media, la primera visita tarda un 38 % menos hasta poder usarla, y el navegador guarda la app hasta que cambia.",
     "**Informes de errores, solo si quieres**: se guardan en el dispositivo (Ajustes → Ayuda → Errores recientes) y, si activas «Enviar informes de errores» en Ajustes → Privacidad, se envían sin tu nombre ni tu cuenta.",
     "Cuando la copia en la nube se acerca a su tamaño máximo, las tareas completadas hace más de un año pasan a un archivo (se puede ver y exportar en Ajustes → Datos).",
     "Menos consumo: la app consulta la nube menos a menudo cuando no la estás usando.",
     "Descargas más ligeras para ordenador: un instalador para cada tipo de Mac (Apple Silicon o Intel) en lugar de uno doble, y solo los idiomas que se usan. Nuevo paquete .deb para Debian, Ubuntu y Mint (no necesita libfuse2).",
     "Títulos de sección más legibles; «Sistemas» pasa a llamarse «Automatizaciones».",
     "En el calendario mensual del ordenador, los días del mes anterior y del siguiente se leen mejor (tenían poco contraste).",
     "Portada web: las novedades de cada versión, preguntas frecuentes y cómo pedir ayuda; en el iPhone, cómo añadirla desde Safari."
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
     "Política de privacidad al día: bloqueos, denuncias, archivo, alarmas exactas, quién ve el perfil público, informes de errores y comentarios."
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
