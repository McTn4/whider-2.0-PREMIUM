# Novedades de WHIDER

Todas las versiones, de la más reciente a la más antigua. El formato sigue
[Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/) y la numeración, [versionado semántico](https://semver.org/lang/es/):
`MAYOR.MENOR.PARCHE`, con `-beta.N` para las versiones de prueba.

Este archivo es la fuente de las notas que enseña la app (Ajustes → Ayuda → Novedades) y de cada publicación en GitHub.
Las secciones «Novedades», «Mejoras», «Correcciones» y «Seguridad» se ven en la app; «Para desarrolladores», solo aquí.
Cómo publicar una versión: [docs/PUBLICAR-UNA-VERSION.md](docs/PUBLICAR-UNA-VERSION.md).

## [Sin publicar]

Lo que cambias en un dispositivo llega a los demás al momento, y WHIDER consulta mucho menos la nube.

### Mejoras

- **Sincronización al momento**: las tareas, los hábitos, los ajustes y los apuntes que cambias en otro dispositivo
  llegan en un par de segundos, sin esperar a la siguiente consulta (antes, hasta 15 segundos; tras un rato sin tocar la
  app, hasta 5 minutos). En Ajustes, la copia en la nube dice «Sincronizado · al momento».
- **Cuaderno**: las páginas nuevas y lo que escribes en ellas, tuyas o de tu equipo, llegan solas a tus otros
  dispositivos y a tus compañeros.
- **Personas y chats**: las solicitudes, los ánimos, los mensajes, las ediciones y las reacciones llegan al momento, y
  el número de chats sin leer se pone al día solo. Cada mensaje avisa una sola vez.
- Sin conexión todo sigue igual: los cambios se guardan en el dispositivo y se suben al volver la red.

### Para desarrolladores

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
