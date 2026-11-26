// Generado por tools/version.js desde package.json y CHANGELOG.md: no lo edites a mano.
// Para cambiar la versión: node tools/version.js 1.2.3 (y su entrada en CHANGELOG.md).
window.Whider = window.Whider || {};
window.Whider.VERSION = "2.1.0";
window.Whider.RELEASES = [
 {
  "v": "2.1.0",
  "date": "2026-11-26",
  "summary": "WHIDER 2.1: aspecto y orden propios. Fondo grafito en lugar del negro y, en el ordenador, una barra superior con las secciones en el centro y Tareas con su propio panel; en el móvil, una barra flotante con el «+» en el centro. Además, entras con tu cuenta de Google, Microsoft o Apple, tu foto sustituye al engranaje, «Hoy» pasa a llamarse Inicio, el calendario deja añadir tareas tocando en él y la app empieza vacía.",
  "groups": [
   {
    "t": "Novedades",
    "items": [
     "**Fondo grafito**: un gris muy oscuro en lugar del negro, con las tarjetas y los paneles un punto más claros. En el tema claro, un gris muy suave con tarjetas blancas. También en la ventana del ordenador, en Android (y su widget), en la pantalla de acceso y en la web.",
     "**Barra superior en el ordenador**, en lugar de la barra lateral: las secciones en una cápsula en el centro y, a la derecha, buscar, «Nueva tarea» y tu foto con tu nombre. La sección abierta va resaltada, Inicio lleva el número de tareas vencidas y el contenido gana todo el ancho. Con la ventana más estrecha (o el texto más grande) se recoge por pasos para que nada se pise; tu nombre es de lo último en irse. En la app de Windows y macOS hace además de barra de título: desde ella se mueve la ventana. Arrastra una tarea a Inicio para pasarla a hoy.",
     "**Barra flotante en el móvil**: una isla redondeada con Inicio, Tareas, Calendario y Cuaderno y el «+» en el centro. Personas pasa arriba, junto a tu foto, con el número de chats y solicitudes sin ver.",
     "**Tareas con su propio panel** (ordenador): a la izquierda, las vistas, tus categorías y tus filtros, con sus contadores; a la derecha, la lista. Se abre en «Todas». Arrastra una tarea a una categoría para moverla (o a «Hoy»), y con el botón derecho abres, editas, ordenas o quitas una categoría.",
     "**Entra con Google, Microsoft o Apple**: es lo único que hace falta para usar WHIDER. Ya no hay «Continuar sin cuenta» ni se crean cuentas con correo y contraseña. En la web se abre la ventana de cada uno; en el ordenador y en Android, Microsoft y Apple se completan en el navegador y vuelves a la app ya dentro. Si usabas WHIDER sin cuenta, tus tareas siguen ahí y pasan a tu cuenta al entrar. Las cuentas de correo y contraseña que ya existían siguen entrando («¿Tu cuenta es de correo y contraseña?») y recuperan la contraseña igual.",
     "**Calendario más hábil**: toca un día (mes) o una hora (semana y día) y escribe la tarea ahí mismo. Intro la añade a ese día y a esa hora, y entiende lo mismo que «Nueva tarea» (hora, categoría, importancia). En el mes del móvil, el campo aparece bajo la semana del día elegido y sigue abierto para añadir varias; en «Sin hora», tareas sin hora.",
     "**Tu foto, en lugar del engranaje**: arriba a la derecha (en el ordenador, con tu nombre). Al tocarla se abre tu cuenta, con interruptores rápidos (tema oscuro, sonidos, contenido a todo el ancho), los ajustes, la ayuda, «Todos los ajustes» y «Cerrar sesión»: en el ordenador, en un panel amplio; en el móvil, en una hoja. Si hay cambios sin subir a la nube, la foto lleva un punto.",
     "**El mes, en Inicio** (ordenador): a la derecha, un calendario del mes con un punto en los días con tareas (en rojo si quedó algo sin hacer). Toca un día para abrirlo en el Calendario; debajo siguen los próximos días.",
     "**Inicio**: la pantalla principal (antes «Hoy») se llama así en la barra, en el ordenador y en los atajos. Lo de dentro no cambia: lo que toca hoy, por importancia, y tus tareas de cada día.",
     "**«Cada día» en Tareas**: una lista con todas las tareas que se repiten (hoy, mañana y más adelante), las mismas que salen en Inicio. Lo que añades desde ella nace como tarea de cada día."
    ]
   },
   {
    "t": "Mejoras",
    "items": [
     "**Empieza vacía**: sin la tarjeta de «Primeros pasos» ni categorías de ejemplo. Las categorías las creas tú si las quieres; las tareas funcionan igual sin categoría. Las de ejemplo de versiones anteriores (Personal, Trabajo, Salud y Estudios) se quitan solas si siguen vacías y con su nombre de siempre; las que usas no se tocan.",
     "**La presentación**, más corta: tu nombre y tu foto, si la vas a usar con otras personas (si no, la sección Personas no está) y los avisos.",
     "**Blanco en lugar de azul** en botones, enlaces, el «+» y lo elegido (negro en el tema claro); hoy, en el calendario, lleva un aro.",
     "**Interruptores blancos** (con la bola negra) en lugar de verdes; en el tema claro, negros.",
     "La pantalla de acceso, más sencilla: los tres botones, la política de privacidad y nada más."
    ]
   },
   {
    "t": "Correcciones",
    "items": [
     "Deshacer una importación quita también la categoría que creó, aunque sea la única."
    ]
   },
   {
    "t": "Seguridad",
    "items": [
     "Las cuentas de Google, Microsoft y Apple guardan en la nube aunque el proveedor no marque el correo como verificado (pasa con algunas cuentas de Microsoft); las de correo y contraseña siguen necesitando el correo verificado."
    ]
   }
  ]
 },
 {
  "v": "2.0.0",
  "date": "2026-11-22",
  "summary": "WHIDER 2.0: más sencilla y con un diseño nuevo. Nada más abrirla, lo que tienes que hacer hoy, ordenado por importancia, y tus hábitos pasan a ser tareas de cada día. Además, WHIDER en inglés, tus otros calendarios (Google, Outlook, Apple) dentro de WHIDER, la semana se planifica arrastrando y lo que cambias llega a tus otros dispositivos al momento.",
  "groups": [
   {
    "t": "Novedades",
    "items": [
     "**Hoy, por importancia**: arriba, un campo para escribir la tarea, con su importancia y «Cada día». Debajo, «Cada día» (lo que repites a diario) y «Por hacer»: lo de hoy y lo vencido, de lo más urgente a lo menos (lo que ya empezaste, delante). Lo hecho se pliega al final.",
     "**Importancia en color**, sencilla: urgente en rojo, importante en naranja, destacada en amarillo y normal en gris, en el círculo de cada tarea, y escrita al lado («Urgente», «Importante»).",
     "**Tareas de cada día**: una tarea puede repetirse cada día, los días laborables o los días de la semana que elijas («Gimnasio cada lunes, miércoles y viernes a las 7»). Si un día se queda sin hacer, pasa sola al siguiente que le toca: no se acumula como vencida. Actualiza también tus otros dispositivos: las versiones anteriores repiten una vez por semana las tareas de días concretos.",
     "**Tus hábitos ahora son tareas de cada día**, con su horario y su aviso; su historial sigue guardado en tu cuenta.",
     "**Una presentación que adapta la app**: para qué la vas a usar (estudios, trabajo, casa, salud, con otras personas) prepara tus categorías y la barra; también si quieres avisos. Se puede repetir en Ajustes → Ayuda → «Adaptar WHIDER a ti».",
     "**Diseño nuevo**, inspirado en X y en Apple: tipografía Inter en todo, fondo negro (o blanco), líneas finas en lugar de tarjetas, títulos grandes, iconos de trazo redondeado (rellenos en la pestaña activa), barra inferior de cinco pestañas, botón «+» flotante y, en el ordenador, una barra lateral con secciones grandes y «Nueva tarea» en cápsula.",
     "**Personas**: tus chats, tus contactos y tus equipos en una sola pestaña. Si no trabajas con otras personas, puedes quitarla de la barra (Ajustes → Lo que ves).",
     "**Calendarios suscritos**: Ajustes → Calendarios suscritos (o «Calendarios» en el calendario). Pega el enlace iCal de tu calendario de Google, Outlook o Apple (o el de los festivos) y sus eventos se ven en el calendario, con su hora y su duración, y en Hoy, en «Agenda de hoy». Se actualizan solos cada hora, siguen ahí sin conexión y, desde la ficha de un evento, «Crear una tarea» lo convierte en una tarea. Se ven, no se cambian: para eso, su propia app.",
     "**Planificar arrastrando** (ordenador): en el calendario, el panel «Por planificar» reúne las tareas sin fecha y las vencidas. Arrástralas a una hora de la semana o del día, a la fila «Sin hora» o a un día del mes; soltar una tarea del calendario en el panel le quita la fecha. Se oculta con × o desde Ajustes → Lo que ves.",
     "**WHIDER, también en inglés**: Ajustes → Idioma. Toda la app: las pantallas, los avisos, las fechas y «Nueva tarea», que entiende frases en inglés («Call Anna tomorrow at 10 #work»), además de los menús del ordenador y el widget y los avisos de Android. Lo que ya habías creado (tareas, categorías, páginas) se queda como estaba."
    ]
   },
   {
    "t": "Mejoras",
    "items": [
     "**Más sencilla**: WHIDER se queda con lo importante —Hoy, Tareas, Calendario, Cuaderno y Personas—. Se van el personaje, Enfoque, Estadísticas, Informes, Automatizaciones, Marcas, el Perfil, «Más» y los dispositivos; sus datos se conservan en tu cuenta. Tu foto (arriba a la izquierda) abre los Ajustes, con tu cuenta lo primero.",
     "**Ajustes** como los de Apple: grupos redondeados, iconos en cuadrados y, en «Lo que ves», la pestaña Personas, la barra lateral y el calendario. Tus contactos solo ven tu nombre y tu foto.",
     "La app se abre sin esperar a la animación de la W.",
     "**Invitaciones**: la página de un enlace de invitación enseña la inicial de quien invita (ya no su personaje), con el diseño nuevo.",
     "**Sincronización al momento**: las tareas, los ajustes y los apuntes que cambias en otro dispositivo llegan en un par de segundos, sin esperar a la siguiente consulta (antes, hasta 15 segundos; tras un rato sin tocar la app, hasta 5 minutos). En Ajustes, la copia en la nube dice «Sincronizado · al momento».",
     "**Cuaderno**: las páginas nuevas y lo que escribes en ellas, tuyas o de tu equipo, llegan solas a tus otros dispositivos y a tus compañeros.",
     "**Personas y chats**: las solicitudes, los ánimos, los mensajes, las ediciones y las reacciones llegan al momento, y el número de chats sin leer se pone al día solo. Cada mensaje avisa una sola vez.",
     "Sin conexión todo sigue igual: los cambios se guardan en el dispositivo y se suben al volver la red."
    ]
   }
  ]
 },
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
