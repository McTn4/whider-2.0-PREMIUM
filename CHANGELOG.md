# Novedades de WHIDER

Todas las versiones, de la más reciente a la más antigua. El formato sigue
[Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/) y la numeración, [versionado semántico](https://semver.org/lang/es/):
`MAYOR.MENOR.PARCHE`, con `-beta.N` para las versiones de prueba.

Este archivo es la fuente de las notas que enseña la app (Ajustes → Ayuda → Novedades) y de cada publicación en GitHub.
Las secciones «Novedades», «Mejoras», «Correcciones» y «Seguridad» se ven en la app; «Para desarrolladores», solo aquí.
Cómo publicar una versión: [docs/PUBLICAR-UNA-VERSION.md](docs/PUBLICAR-UNA-VERSION.md).

## [2.0.0] · 2026-11-22

WHIDER 2.0: más sencilla y con un diseño nuevo. Nada más abrirla, lo que tienes que hacer hoy, ordenado por
importancia, y tus hábitos pasan a ser tareas de cada día. Además, WHIDER en inglés, tus otros calendarios (Google,
Outlook, Apple) dentro de WHIDER, la semana se planifica arrastrando y lo que cambias llega a tus otros dispositivos al
momento.

### Novedades

- **Hoy, por importancia**: arriba, un campo para escribir la tarea, con su importancia y «Cada día». Debajo, «Cada
  día» (lo que repites a diario) y «Por hacer»: lo de hoy y lo vencido, de lo más urgente a lo menos (lo que ya
  empezaste, delante). Lo hecho se pliega al final.
- **Importancia en color**, sencilla: urgente en rojo, importante en naranja, destacada en amarillo y normal en gris,
  en el círculo de cada tarea, y escrita al lado («Urgente», «Importante»).
- **Tareas de cada día**: una tarea puede repetirse cada día, los días laborables o los días de la semana que elijas
  («Gimnasio cada lunes, miércoles y viernes a las 7»). Si un día se queda sin hacer, pasa sola al siguiente que le
  toca: no se acumula como vencida. Actualiza también tus otros dispositivos: las versiones anteriores repiten una
  vez por semana las tareas de días concretos.
- **Tus hábitos ahora son tareas de cada día**, con su horario y su aviso; su historial sigue guardado en tu cuenta.
- **Una presentación que adapta la app**: para qué la vas a usar (estudios, trabajo, casa, salud, con otras personas)
  prepara tus categorías y la barra; también si quieres avisos. Se puede repetir en Ajustes → Ayuda → «Adaptar WHIDER
  a ti».
- **Diseño nuevo**, inspirado en X y en Apple: tipografía Inter en todo, fondo negro (o blanco), líneas finas en lugar
  de tarjetas, títulos grandes, iconos de trazo redondeado (rellenos en la pestaña activa), barra inferior de cinco
  pestañas, botón «+» flotante y, en el ordenador, una barra lateral con secciones grandes y «Nueva tarea» en cápsula.
- **Personas**: tus chats, tus contactos y tus equipos en una sola pestaña. Si no trabajas con otras personas, puedes
  quitarla de la barra (Ajustes → Lo que ves).
- **Calendarios suscritos**: Ajustes → Calendarios suscritos (o «Calendarios» en el calendario). Pega el enlace iCal de
  tu calendario de Google, Outlook o Apple (o el de los festivos) y sus eventos se ven en el calendario, con su hora y
  su duración, y en Hoy, en «Agenda de hoy». Se actualizan solos cada hora, siguen ahí sin conexión y, desde la ficha
  de un evento, «Crear una tarea» lo convierte en una tarea. Se ven, no se cambian: para eso, su propia app.
- **Planificar arrastrando** (ordenador): en el calendario, el panel «Por planificar» reúne las tareas sin fecha y las
  vencidas. Arrástralas a una hora de la semana o del día, a la fila «Sin hora» o a un día del mes; soltar una tarea
  del calendario en el panel le quita la fecha. Se oculta con × o desde Ajustes → Lo que ves.
- **WHIDER, también en inglés**: Ajustes → Idioma. Toda la app: las pantallas, los avisos, las fechas y «Nueva tarea»,
  que entiende frases en inglés («Call Anna tomorrow at 10 #work»), además de los menús del ordenador y el widget y los
  avisos de Android. Lo que ya habías creado (tareas, categorías, páginas) se queda como estaba.

### Mejoras

- **Más sencilla**: WHIDER se queda con lo importante —Hoy, Tareas, Calendario, Cuaderno y Personas—. Se van el
  personaje, Enfoque, Estadísticas, Informes, Automatizaciones, Marcas, el Perfil, «Más» y los dispositivos; sus datos
  se conservan en tu cuenta. Tu foto (arriba a la izquierda) abre los Ajustes, con tu cuenta lo primero.
- **Ajustes** como los de Apple: grupos redondeados, iconos en cuadrados y, en «Lo que ves», la pestaña Personas, la
  barra lateral y el calendario. Tus contactos solo ven tu nombre y tu foto.
- La app se abre sin esperar a la animación de la W.
- **Invitaciones**: la página de un enlace de invitación enseña la inicial de quien invita (ya no su personaje), con
  el diseño nuevo.
- **Sincronización al momento**: las tareas, los ajustes y los apuntes que cambias en otro dispositivo
  llegan en un par de segundos, sin esperar a la siguiente consulta (antes, hasta 15 segundos; tras un rato sin tocar la
  app, hasta 5 minutos). En Ajustes, la copia en la nube dice «Sincronizado · al momento».
- **Cuaderno**: las páginas nuevas y lo que escribes en ellas, tuyas o de tu equipo, llegan solas a tus otros
  dispositivos y a tus compañeros.
- **Personas y chats**: las solicitudes, los ánimos, los mensajes, las ediciones y las reacciones llegan al momento, y
  el número de chats sin leer se pone al día solo. Cada mensaje avisa una sola vez.
- Sin conexión todo sigue igual: los cambios se guardan en el dispositivo y se suben al volver la red.

### Para desarrolladores

- **Rediseño**: tokens nuevos en `css/tokens.css` (Inter variable con tamaño óptico, `--imp-1…3` para la importancia,
  `--accent` y `--link` para lo que se toca, `--on-color`, `--tile`…) y `layout.css`, `components.css`, `desktop.css` y
  `social.css` reescritos: sin brillos, degradados ni sombras de colores. Fuente única `fonts/inter-latin-opsz-normal.woff2`
  (licencia OFL en `fonts/LICENSE-Inter.txt`); se retiran Onest y Outfit.
- **Tareas de cada día** (`js/core/schema.js`): «cada semana» acepta `days` (0 = domingo); `repeatsOn`, `firstDue`,
  `isRoutine`, `repeatLabel` y `taskFromHabit`. En la sincronización, `days` viaja con `repeat` (mismo grupo de campos).
  Las versiones anteriores, que no conocen `days`, repiten esas tareas una vez por semana.
- `State.tidyRoutines()` (al abrir, al cambiar de día y tras sincronizar): convierte los hábitos activos en tareas
  (id `hab-<hábito>-<marca>`, el mismo en todos los dispositivos) y archiva el hábito; pasa a hoy las de cada día sin
  hacer (`rollRoutines`). Los datos de hábitos, enfoque, marcas, reglas y personaje se siguen guardando y
  sincronizando por compatibilidad.
- Fuera: `js/screens/{focus,stats,reports,automations,records,progress,more,habits}.js`,
  `js/core/{stats,automations,records,habits}.js` y `js/ui/{character,charts,devices,fx,dock}.js`. Las rutas antiguas
  llevan a la pantalla más parecida (`js/router.js`). Ajustes nuevos: `uses` y `peopleTab`.
- Pruebas: `tests/unit/cada-dia.test.js` y `tests/e2e/rediseno.js`; fuera las de automatizaciones, personaje y
  estadísticas, y las demás al día.
- Portada, ficha de Google Play y política de privacidad al día (sin hábitos ni enfoque; perfil público con solo el
  nombre y la foto). `tools/capturas/{portada,og,play}.js` con los datos de ejemplo nuevos (tareas de cada día en
  lugar de hábitos) y sin brillos; `docs/play/` pasa de seis capturas a cuatro (Hoy, Tareas, Calendario y Cuaderno).
  `i/index.html` ya no carga `js/core/util.js` ni el dibujo del personaje.
- `js/core/live.js` (`W.Live`): escuchas con el Firestore completo (`onSnapshot`), solo para escuchar. Leer una vez,
  escribir y las transacciones siguen con «lite», que sin conexión falla enseguida en lugar de quedarse esperando.
  Cada escucha dice si está al día con el servidor (`ok`); mientras no lo está (sin conexión, un fallo o
  `WHIDER_CONFIG.live = false`), cada módulo vuelve a consultar como antes. Con la app más de 2 minutos en segundo
  plano se pausan y al volver se retoman.
- Escuchan `Sync` (`state/app` y `state/notes`), `PageSync` (el índice de tus páginas y el de cada equipo: solo se
  sincroniza el ámbito que cambia), `People` (el buzón) y `Chat` (la lista y el chat abierto). Las subidas siguen
  siendo transacciones que fusionan.
- Menos lecturas: solo por estar al día, un ordenador con WHIDER abierto 8 horas pasa de unas 3.250 a unas 185 al día
  (estimación en [docs/COSTES.md](docs/COSTES.md)). Los perfiles de los contactos se refrescan cada minuto solo con
  Personas abierta, y los avisos de mensajes del buzón no se leen mientras se escucha la lista de chats.
- Paquete de Firebase: añade el Firestore completo sin `re2js` (solo lo usan las consultas «pipeline», que la app no
  usa): 251 → 516 KB (75 → 157 KB comprimido). Se sigue cargando después de mostrar la app.
- Prueba nueva `tests/e2e/tiempo-real.js` (grupo «nube»): tareas, Cuaderno, pausa, sin escuchas, solicitudes, chat y
  reacciones entre dispositivos y cuentas.
- **Idiomas** ([docs/decisiones/0003](docs/decisiones/0003-idiomas.md)): `W.t('texto en español')` (el propio texto
  es la clave), `W.tn` para plurales y `W.tp` para frases con un enlace o una negrita dentro; el catálogo
  `js/i18n/en.js` (≈ 2.400 textos) solo se carga en inglés. Fechas y números por idioma (`js/core/util.js`), gramática
  inglesa de «Nueva tarea» (`js/core/parse.js`), menús del ordenador (`desktop/lib/i18n.js`) y textos nativos de
  Android (`res/values-en`, `Lang.java`), que siguen el idioma de la app y no el del sistema.
- `tools/i18n.js` envuelve textos, lista los pendientes y lo que falta en el catálogo; `npm run i18n:check` (dentro de
  `npm run check` y en la integración continua) falla si un texto de la app no está traducido. `tests/e2e/ingles.js` recorre en inglés todas las
  pantallas y hojas, el Cuaderno con cada plantilla y el cambio de idioma desde Ajustes, y falla si queda algo en
  español.
- Con `?lang=en` (o `?lang=es`) en la dirección, la app se abre en ese idioma y lo recuerda: lo usan los botones de la
  portada en inglés.
- **Calendarios suscritos**: `js/core/ical.js` (`W.ICal`, lógica pura) lee los VEVENT (zonas IANA y de Windows, todo
  el día, `RRULE` diaria, semanal, mensual y anual con `INTERVAL`, `COUNT`, `UNTIL`, `BYDAY`, `BYMONTHDAY`, `BYMONTH`
  y `BYSETPOS`, `EXDATE` y `RECURRENCE-ID`) y repite cada evento en su propia zona, así que la hora de reloj se
  mantiene con los cambios de hora. `js/core/calendars.js` (`W.Calendars`) guarda la lista en los ajustes
  (`settings.calendars`, se sincroniza) y los eventos en cada dispositivo (`whider.cal.v1`, solo lo que puede salir:
  de medio año atrás a dos años vista); `js/ui/calsubs.js`, Ajustes, la ficha y las filas.
- `api/calendario.js`: la primera función de Vercel del proyecto. Trae el `.ics` por la app (los navegadores no dejan
  leerlo de otro sitio) sin guardarlo ni registrar el enlace, que va en el cuerpo de la petición: solo https (y
  webcal://), puerto 443, sin usuario ni contraseña, solo nombres que llevan a direcciones públicas (comprobado en la
  propia conexión y tras cada redirección), 4 redirecciones, 8 segundos, 12 MB, recorte de lo antiguo por encima de
  1 MB, tiene que ser un `VCALENDAR`, CORS solo para la web, Android y el ordenador, y un límite por IP.
  `GET /api/calendario?comprobar` trae siempre el mismo calendario público (los festivos de España de Google) y dice
  cuántos eventos tiene: sirve para comprobar que la función llega a Internet.
- Pruebas: `tests/unit/ical.test.js` (zonas, cambio de hora, repeticiones y excepciones),
  `tests/unit/calendario-api.test.js` (direcciones, IP privadas, redirecciones, tamaño, tiempo, formato y CORS) y
  `tests/e2e/calendarios.js` (añadir, errores, todas las vistas del calendario en el ordenador y el móvil, Hoy, ficha,
  sin conexión, ocultar y quitar).
- Planificar arrastrando: `planPanel` en `js/screens/calendar.js`, con el mismo arrastre que la barra lateral
  (`W.Sidebar.DRAG_TYPE` y `dropTarget`); `settings.desk.plan` lo enciende o lo apaga. Prueba nueva
  `tests/e2e/planificar.js` (arrastre simulado con `DragEvent`).

## [1.1.0] · 2026-11-18

La 1.1: tema claro, importar desde otras apps, un Hoy más claro, sincronización sin pérdidas, copias automáticas, más
seguridad y un ordenador que se actualiza solo.

### Novedades

- **Importar** desde Todoist, Google Tasks, Notion, calendarios (.ics) o cualquier CSV, con vista previa, categorías
  nuevas, repetidas reconocidas y opción de deshacer durante un día (Ajustes → Datos → Importar desde otras apps).
- **Tema claro**: Ajustes → Apariencia → Tema (Oscuro, Claro o «Como el sistema»). Toda la app, también la ventana del
  ordenador y las barras del sistema en Android, sin destellos al abrir; el alto contraste también funciona en claro.
- **Hoy, por estados**: lo más importante, en curso, vencidas, pendientes y hechas. Una tarea puede marcarse «En curso».
- **Copias automáticas** sin cuenta: en el ordenador, una al día en la carpeta de datos de WHIDER (las 10 últimas, con
  la lista para recuperarlas); en Android, en Descargas › WHIDER › Copias (las 7 últimas, que siguen ahí aunque
  desinstales la app). En el navegador, un aviso en Hoy si pasa una semana sin copia.
- **El ordenador se actualiza solo**: en Windows y en Linux (AppImage), WHIDER descarga la versión nueva y la instala
  al cerrar; en macOS y en Linux (.deb) avisa con el enlace.
- **Color por categoría** (opcional) y **prioridad legible**: «Urgente» e «Importante» se escriben junto a la tarea y
  pueden ir en color.
- **Android**: widget «Hoy», compartir texto con WHIDER desde otras apps y avisos a la hora exacta (permiso opcional).
- **Barra inferior a tu gusto** en el móvil: tres pestañas entre Hoy, Tareas, Calendario, Cuaderno, Chats, Hábitos y
  Enfoque.
- **Ayuda** (Ajustes → Ayuda): preguntas frecuentes, las novedades de cada versión y «Enviar comentarios» (una idea,
  algo que no funciona u otra cosa).
- **Bloquear y denunciar** a personas, chats o mensajes. Las personas bloqueadas están en Ajustes → Privacidad.
- **Instalar en el iPhone**: WHIDER explica cómo añadirla a la pantalla de inicio; en Chrome y Edge, un botón
  «Instalar».
- **Primeros pasos**: cinco pasos que se cumplen solos mientras usas la app.
- **La web, también en inglés**: la portada (/en/) y la política de privacidad (/privacy/). La app sigue en español por
  ahora.

### Mejoras

- Sincronización sin sobrescrituras: si cambias la misma tarea en dos dispositivos a la vez, se conservan los dos
  cambios; en el Cuaderno, las dos versiones de un bloque.
- Errores de la nube claros, con lo que hay que hacer y reintentos de verdad; un punto en el engranaje avisa de cambios
  sin subir.
- La web abre antes: en un móvil de gama media, la primera visita tarda un 38 % menos hasta poder usarla, y el
  navegador guarda la app hasta que cambia.
- **Informes de errores, solo si quieres**: se guardan en el dispositivo (Ajustes → Ayuda → Errores recientes) y, si
  activas «Enviar informes de errores» en Ajustes → Privacidad, se envían sin tu nombre ni tu cuenta.
- Cuando la copia en la nube se acerca a su tamaño máximo, las tareas completadas hace más de un año pasan a un archivo
  (se puede ver y exportar en Ajustes → Datos).
- Menos consumo: la app consulta la nube menos a menudo cuando no la estás usando.
- Descargas más ligeras para ordenador: un instalador para cada tipo de Mac (Apple Silicon o Intel) en lugar de uno
  doble, y solo los idiomas que se usan. Nuevo paquete .deb para Debian, Ubuntu y Mint (no necesita libfuse2).
- Títulos de sección más legibles; «Sistemas» pasa a llamarse «Automatizaciones».
- En el calendario mensual del ordenador, los días del mes anterior y del siguiente se leen mejor (tenían poco
  contraste).
- Portada web: las novedades de cada versión, preguntas frecuentes y cómo pedir ayuda; en el iPhone, cómo añadirla
  desde Safari.

### Correcciones

- Al importar o crear muchas tareas de golpe, dos podían recibir el mismo identificador y una sustituía a la otra.

### Seguridad

- Nadie puede obtener la lista de perfiles ni de códigos de amigo; lo que otros dejan en tu buzón tiene un tamaño
  limitado.
- Las claves de las invitaciones y de los enlaces de equipo se generan con el generador criptográfico del sistema.
- Política de privacidad al día: bloqueos, denuncias, archivo, alarmas exactas, quién ve el perfil público, informes de
  errores y comentarios.

### Para desarrolladores

- Pruebas en el repositorio: unitarias (`npm run test:unit`) y de extremo a extremo (`npm run test:todo`; las de la
  nube, contra los emuladores de Firebase), ESLint, Prettier, TypeScript gradual e integración continua en cada cambio.
- Versión única en `package.json`, propagada con `node tools/version.js` (también a la portada: la versión y sus
  novedades); este CHANGELOG; publicaciones versionadas en GitHub (`.github/workflows/release.yml`) y actualizaciones
  automáticas con electron-updater.
- La web publicada va empaquetada y minimizada con esbuild (`tools/web-build.js`), con mapas de código, nombres que
  cambian con el contenido (caché de un año) y un Service Worker cuya caché se llama como su contenido;
  `node tools/medir-carga.js` mide la carga con y sin empaquetar.
- Ningún archivo pasa de 1.000 líneas: `js/core/store.js` se divide en `schema.js` y `js/ui/blocks.js` en `caret.js`,
  `blocks-kinds.js` y `blocks-menus.js`.
- Tema claro con variables (`css/tokens.css`); `tests/unit/tema.test.js` impide grises fijos en las reglas y
  `tests/e2e/tema.js` prueba el cambio, el arranque sin destello, «Como el sistema» y el contraste.
- La comprobación de contraste con axe no comprobaba nada (el contenedor fijo de la app lo dejaba todo «incompleto»):
  `axePrep()` en `tests/e2e/_util.js` lo resuelve.
- Adjuntos del Cuaderno en Firebase Storage, preparados y apagados (`storage: true` en `js/config.js`, con
  `storage.rules` y `storage-cors.json`; necesita el plan Blaze). `tests/e2e/adjuntos-storage.js` los prueba con el
  emulador.
- Decisiones documentadas en `docs/decisiones/` (edición simultánea, Electron o Tauri, idiomas) y análisis de costes
  en `docs/COSTES.md`.

## [1.1.0-beta.1] · 2026-11-18

Versión de prueba de la 1.1: el día a día más claro, importar desde otras apps, sincronización sin pérdidas y más seguridad.

### Novedades

- **Importar** desde Todoist, Google Tasks, Notion, calendarios (.ics) o cualquier CSV, con vista previa, categorías nuevas,
  repetidas reconocidas y opción de deshacer durante un día (Ajustes → Datos → Importar y exportar).
- **Hoy, por estados**: lo más importante, en curso, vencidas, pendientes y hechas. Una tarea puede marcarse «En curso».
- **Color por categoría** (opcional) y **prioridad legible**: «Urgente» e «Importante» se escriben junto a la tarea y pueden ir en color.
- **Barra inferior a tu gusto** en el móvil: tres pestañas entre Hoy, Tareas, Calendario, Cuaderno, Chats, Hábitos y Enfoque.
- **Primeros pasos**: cinco pasos que se cumplen solos mientras usas la app.
- **Android**: widget «Hoy», compartir texto con WHIDER desde otras apps y avisos a la hora exacta (permiso opcional).
- **Bloquear y denunciar** a personas, chats o mensajes. Las personas bloqueadas están en Ajustes → Privacidad.
- **Novedades de cada versión** en Ajustes → Ayuda, y un aviso en Hoy cuando WHIDER se actualiza.
- **Ordenador**: WHIDER se actualiza sola en Windows y en Linux (AppImage), y en macOS y Linux (.deb) avisa cuando hay una versión nueva.

### Mejoras

- Sincronización sin sobrescrituras: si cambias la misma tarea en dos dispositivos a la vez, se conservan los dos cambios;
  en el Cuaderno, las dos versiones de un bloque.
- Errores de la nube claros, con lo que hay que hacer y reintentos de verdad; un punto en el engranaje avisa de cambios sin subir.
- Cuando la copia en la nube se acerca a su tamaño máximo, las tareas completadas hace más de un año pasan a un archivo
  (se puede ver y exportar en Ajustes → Datos).
- Menos consumo: la app consulta la nube menos a menudo cuando no la estás usando.
- Descargas más ligeras para ordenador: un instalador para cada tipo de Mac (Apple Silicon o Intel) en lugar de uno doble,
  y solo los idiomas que se usan. Nuevo paquete .deb para Debian, Ubuntu y Mint (no necesita libfuse2).
- Títulos de sección más legibles; «Sistemas» pasa a llamarse «Automatizaciones».

### Correcciones

- Al importar o crear muchas tareas de golpe, dos podían recibir el mismo identificador y una sustituía a la otra.

### Seguridad

- Nadie puede obtener la lista de perfiles ni de códigos de amigo; lo que otros dejan en tu buzón tiene un tamaño limitado.
- Las claves de las invitaciones y de los enlaces de equipo se generan con el generador criptográfico del sistema.
- Política de privacidad al día: bloqueos, denuncias, archivo, alarmas exactas y quién ve el perfil público.

### Para desarrolladores

- Pruebas en el repositorio: unitarias (`npm run test:unit`) y de extremo a extremo (`npm run test:todo`; las de la nube,
  contra los emuladores de Firebase), ESLint, Prettier, TypeScript gradual e integración continua en cada cambio.
- Versión única en `package.json`, propagada con `node tools/version.js`; este CHANGELOG; publicaciones versionadas en GitHub
  (`.github/workflows/release.yml`) y actualizaciones automáticas con electron-updater.
- Decisiones documentadas en `docs/decisiones/` (edición simultánea) y análisis de costes en `docs/COSTES.md`.

## [1.0.0] · 2026-11-16

Todo gratis, identidad nueva y lista para Google Play.

### Novedades

- Todas las funciones para todos: desaparecen Premium, los planes y los pagos.
- Identidad nueva: tipografías Onest y Outfit, iconos propios y esquinas curvadas.
- Portada web con la descarga para cada dispositivo; la app en el navegador pasa a /app.
- Eliminar la cuenta desde la app o desde la web, sin instalar nada.

### Mejoras

- Preparada para Google Play (Android 16 y paquete AAB).
- En Android, la primera vez se adopta el tamaño de letra del sistema.
- Los enlaces externos se abren en el navegador del sistema.

### Para desarrolladores

- Las versiones anteriores (hasta la 8.2.1) seguían otra numeración; su historial está en el registro de git.
