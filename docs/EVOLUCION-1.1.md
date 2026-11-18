# WHIDER 1.1 · Auditoría, plan y decisiones

Documento vivo de la evolución de la 1.0 a la 1.1. Recoge qué se comprobó, en qué orden se trabaja,
qué se decidió y por qué, y qué depende de servicios o decisiones externas.

## 1. Arquitectura real (punto de partida)

| Pieza | Cómo es |
| --- | --- |
| App | JavaScript sin módulos sobre un espacio global `window.Whider` (`W`): 56 archivos cargados en orden desde `index.html`, ~17 000 líneas propias. CSS en 7 archivos con *tokens*. |
| Datos locales | `localStorage` (estado) e IndexedDB (archivos del Cuaderno). En Android, además, un almacén nativo espejo. |
| Nube | Firebase Auth + Cloud Firestore **lite** (peticiones REST, sin escuchas). Todo el estado de una persona en `users/{uid}/state/app` y los apuntes en `state/notes`; las páginas del Cuaderno, en su propia colección. |
| Sincronización | Por sondeo: transacción cada 15 s; chat abierto cada 3 s; comunidad cada 7–30 s; página compartida abierta cada 4 s. |
| Escritorio | Electron 45 con protocolo propio `app://`, bandeja y acceso con Google por el navegador. Instaladores sin firmar en una publicación `desktop-latest` que se sobrescribe. |
| Android | WebView con la web copiada al compilar, recordatorios con `AlarmManager` (inexactos). APK de depuración y AAB sin firmar. |
| Web | Vercel: `tools/web-build.js` deja la portada en `/` y la app en `/app`. |
| Calidad | Sin pruebas ni comprobaciones en el repositorio; la integración continua solo compila. |

## 2. Verificación de cada punto

Todos los puntos de la lista se comprobaron en el código o ejecutando la app. Los matices encontrados:

| Punto | Estado | Evidencia o matiz |
| --- | --- | --- |
| Dirección provisional y «PREMIUM» en descargas | Confirmado | `whider-red.vercel.app`; los enlaces apuntan a `github.com/McTn4/whider-2.0-PREMIUM/...`. |
| Propósito poco claro | Confirmado | 12 secciones al mismo nivel; «Más» las lista casi todas. |
| App vacía tras la bienvenida | Confirmado | Bienvenida de 1–2 pasos; luego Hoy vacío sin guía. Los ejemplos de tareas se retiraron a petición expresa en la 4.2: la guía no debe crear tareas falsas. |
| Prioridad solo por brillo | Confirmado | `taskcard.js`: barras con distinta luminosidad y un borde que brilla. |
| Categorías sin color | Confirmado (matiz) | Las categorías aún guardan un `color` antiguo (`iris`, `ember`…) que no se muestra: no se puede reutilizar sin colorear de golpe lo que nadie eligió. |
| Hoy fragmentado y progreso duplicado | Confirmado | Tarjeta del personaje («2 de 7 tareas hechas hoy» + barra) y tarjeta de progreso («2 de 7 tareas completadas» + anillo). |
| Cuaderno y Chats en «Más» | Confirmado | Barra inferior: Hoy, Tareas, +, Calendario, Más. |
| Etiquetas en mayúsculas de 12–13 px | Confirmado | Cabeceras de sección y portada. |
| Calendarios externos | Confirmado | Solo exportación `.ics`. |
| Importación desde otras apps | Confirmado | Solo copias propias de WHIDER. |
| Widget y «Compartir con» en Android | Confirmado | Ni receptor `SEND` ni `AppWidgetProvider`. |
| Edición simultánea | Confirmado | `pagesync.js`: «si cambian el mismo [bloque], gana el último». |
| Errores de sincronización | Confirmado | Un único estado `error`: «No se pudo sincronizar · reintentando». |
| Adjuntos en la base de datos | Confirmado | `files.js`: trozos de 600 KB en base64 dentro de Firestore. |
| 56 archivos sin empaquetar | Confirmado | 56 `<script>` en `index.html`. |
| Escritorio pesado | Confirmado | 122 / 224 / 126 MB; el de Mac es universal (dos arquitecturas en uno). |
| App Check y límites | Confirmado | No hay App Check ni límites en las reglas. |
| Sin 2FA | Confirmado | Ningún uso de `multiFactor`. |
| Sin actualización automática | Confirmado | Sin `electron-updater`. |
| Google Play | Confirmado | Faltan recursos de la ficha y la clave de subida; además, **falta denunciar y bloquear** (requisito de contenido generado por usuarios). |
| Sostenibilidad | Confirmado | El sondeo multiplica las lecturas de Firestore. |
| Informes de errores | Confirmado | Ninguno. |
| `main` directo a producción | Confirmado | Vercel y las publicaciones se generan en cada subida, sin pruebas. |
| Archivos de más de 1 000 líneas | Confirmado | `ui/blocks.js` (1346) y `core/store.js` (1230). |
| Correos por defecto | Confirmado (en el código) | No se fija el idioma ni una página propia de acciones; las plantillas viven en la consola de Firebase. |
| Portada sin FAQ, contacto ni novedades | Confirmado | — |
| Sin ayuda ni comentarios | Confirmado | Solo la ayuda de escritura rápida. |
| «Sistemas» y «3 de 5 · Elegir» | Confirmado | «3 de 5» significa que se muestran 3 de las 5 tareas del día. |
| Solo tema oscuro | Confirmado | — |
| Solo español | Confirmado | Textos escritos directamente en el código. |
| iPhone sin indicaciones | Confirmado | — |
| Siempre «1.0» | Confirmado | `VERSION = '1.0'`, `versionCode 1000`, escritorio `1.0.0`. |
| Accesibilidad real | Confirmado | Solo axe-core automático. |
| Copias sin cuenta | Confirmado | Solo exportación manual. |
| Alarmas inexactas | Confirmado | `setAndAllowWhileIdle`. |
| `libfuse2` en Linux | Confirmado | Solo AppImage. |
| Privacidad de los chats | Confirmado | La política no afirma cifrado de extremo a extremo (correcto) pero no lo aclara; además dice que tus datos «solo los puedes leer tú», y las reglas dejan leer los perfiles públicos a cualquier cuenta. |
| Herramientas fuera del repositorio | Confirmado | Pruebas, generador de iconos y capturas vivían fuera del proyecto. |

## 3. Qué depende de algo externo

| Necesita | Para |
| --- | --- |
| Comprar un dominio (decisión y pago) | Dominio propio, correo con dominio propio. Todo queda preparado para cambiarlo en un sitio. |
| Plan Blaze de Firebase (pago por uso) | Firebase Storage para adjuntos (Firebase ya no ofrece Storage en el plan gratuito), alertas de presupuesto. |
| Consola de Firebase | App Check (reCAPTCHA / Play Integrity), 2FA (Identity Platform), plantillas y dominio de correo, URL de acciones de cuenta. |
| Cuentas de Google Cloud y Microsoft (OAuth verificado) | Sincronización bidireccional con Google Calendar y Outlook. |
| Clave de subida y Play Console | Publicar en Google Play. |
| Certificados de firma (Windows) y cuenta de Apple | Instaladores firmados y notarizados; actualización automática en Mac. |
| Dispositivos reales | TalkBack y VoiceOver, widget y alarmas exactas de Android. |

## 4. Plan por bloques

Orden elegido por dependencias, impacto y riesgo:

1. **Cimientos** — Herramientas en el repositorio (`package.json`, ESLint, Prettier, `tsconfig` con comprobación de tipos), pruebas dentro del proyecto e integración continua que las ejecuta. *Todo lo demás se apoya en esto.*
2. **Uso diario** — Prioridades legibles, colores de categoría, Hoy rediseñado, navegación móvil, etiquetas, nombres claros y primeros pasos.
3. **Datos fiables y baratos** — SDK completo de Firestore con escuchas en tiempo real (fin del sondeo), errores de sincronización comprensibles con reintentos, fusión por bloques sin pérdidas.
4. **Integraciones** — Asistente de importación (Todoist, Google Tasks, Notion, CSV), calendarios (`.ics`), Android (compartir, widget, alarmas exactas).
5. **Seguridad** — Reglas más estrictas, límites de envío, denunciar y bloquear, App Check y 2FA preparados, página propia de acciones de cuenta.
6. **Versiones y distribución** — Versionado semántico, novedades, publicaciones con historial, actualización automática del escritorio, `.deb`, instaladores más ligeros, ficha de Google Play.
7. **Rendimiento y arquitectura** — Empaquetado con carga diferida, división de los archivos grandes, tipos.
8. **Complementos** — Tema claro, ayuda y comentarios, iPhone, internacionalización, copias automáticas, informes de errores, almacenamiento de adjuntos.
9. **Web** — Portada con FAQ, soporte y novedades; política de privacidad al día.

## 5. Decisiones de arquitectura

Las decisiones de arquitectura de esta versión se documentan junto al código que las aplica; el resumen
final y su estado están en el apartado 6.

## 6. Estado

Se actualiza al cerrar cada bloque.

### Bloque 1 · Cimientos — hecho

- **Herramientas en el repositorio**: `package.json` con versiones exactas y `package-lock.json`; ESLint 10
  (configuración plana, 0 problemas en todo el código), Prettier 3 (adopción gradual: lo nuevo nace
  formateado, ver `.prettierignore`), `.editorconfig`, TypeScript 5.9 en modo progresivo (`// @ts-check` por
  archivo, tipos comunes en `types/whider.d.ts`; ya lo llevan `util.js`, `parse.js`, `sync.js` y
  `sitio/descargas.js`).
- **Correcciones que salieron al pasar ESLint y TypeScript** (sin cambiar el comportamiento): asignaciones
  iniciales que nunca se usaban, una variable de `sync.js` que era a la vez mapa y función (ahora
  `newestById`), espacios especiales escritos tal cual en expresiones regulares (ahora `\u00a0` y
  `\u200b`), variables sin usar y una resta de fechas sin `getTime()`.
- **Pruebas dentro del proyecto**: 23 pruebas de extremo a extremo (`tests/e2e/`) y 36 unitarias
  (`tests/unit/`, con el reloj fijo y una zona horaria con cambio de hora). El lanzador `tests/run.mjs`
  arranca por su cuenta el servidor, la web compilada, los emuladores de Firebase y la pantalla virtual de
  Electron.
- **Integración continua** (`.github/workflows/ci.yml`): estilo, tipos y unitarias; después la app, la web
  y la nube en paralelo, y la app de escritorio. Los registros de una prueba fallida quedan como artefacto.
- **Herramientas de diseño reproducibles**: `tools/iconos/` (el generador produce exactamente el sprite
  publicado), `tools/capturas/` (portada, imagen para compartir y recorrido) y `tools/servir-web.py`.
- **Vercel** instala solo lo necesario para compilar (`npm ci --omit=dev`).
- **Guía** `docs/DESARROLLO.md`: instalar, ejecutar, probar, compilar, convenciones y problemas frecuentes.
- Verificado en GitHub: los cinco trabajos de «Comprobaciones» (estilo y tipos, app, web, nube y escritorio)
  pasan en la primera ejecución; Vercel publica con la instalación reducida.

### Bloque 2 · Uso diario — hecho

- **Prioridad legible sin depender de la luz**: barras rellenas frente a barras con solo su contorno (forma),
  «Urgente» e «Importante» escritos junto a la tarea (texto) y, si se activa, en color (rojo y ámbar con
  ≥ 5,8:1 de contraste, válidos también como texto). El lector de pantalla las anuncia.
- **Colores de categoría opcionales**: campo nuevo `tint` (vacío por defecto, así nada cambia para quien no lo
  use). Cinco tonos comprobados con el validador de paletas (contraste ≥ 3:1 sobre el fondo, separación
  para daltonismo entre vecinos); el rojo y el ámbar quedan reservados a la prioridad. Siempre acompañan al
  nombre y al icono. Una versión anterior que edite las categorías no conoce el campo y lo perdería.
- **«En curso»**: campo nuevo `startedAt` en las tareas; se marca desde el menú, el editor o al enfocarse
  en una tarea; también cuenta tener subtareas a medias. Se borra al completar y la siguiente repetición
  empieza pendiente.
- **Hoy rediseñado**: lo más importante → tu día (una sola tarjeta con el personaje, el progreso y la racha:
  desaparece el recuento repetido; en el ordenador el personaje deja el recuento al bloque «Resumen del
  día») → en curso → vencidas → pendientes → hechas. La frase del personaje propone la siguiente tarea y ya
  no ofrece «pasar a hoy» tareas que ya son de hoy.
- **Navegación móvil**: la barra inferior se elige (tres pestañas entre Hoy, Tareas, Calendario, Cuaderno,
  Chats, Hábitos y Enfoque; «Más» siempre a la derecha). Por defecto no cambia nada. «Más» enseña el
  Cuaderno y los Chats en grande. La pestaña de Chats lleva su propio aviso de mensajes sin leer.
- **Etiquetas**: las cabeceras de sección dejan las versalitas de 10,5-12 px por texto normal de 13-15 px.
- **Nombres claros**: «Sistemas» pasa a «Automatizaciones» («Métodos listos para usar» dentro); «3 de 5 ·
  Elegir» pasa a «Elegir cuáles».
- **Primeros pasos**: cinco pasos que se cumplen haciendo (primera tarea, día y hora escritos, elegir lo
  importante, primera página, avisos), sin tareas de ejemplo; se marcan solos, se ocultan con un toque,
  salen solo las primeras tres semanas y vuelven desde *Ajustes → Ayuda*.
- **Pruebas**: `tests/e2e/uso-diario.js` (43 comprobaciones en móvil y ordenador) y 3 unitarias nuevas; la
  auditoría de accesibilidad (axe) sigue sin incumplimientos: los botones nuevos se nombran con su texto visible.
