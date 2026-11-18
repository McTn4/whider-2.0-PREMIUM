# WHIDER

**Tu día, bajo control.** WHIDER es una app de productividad **gratuita para ordenador (Windows, macOS y Linux), la web y Android** (pronto en Google Play) que reúne tareas por categorías, calendario profesional, un **Cuaderno** (páginas por bloques con **fotos y archivos adjuntos**, bases de datos y plantillas), hábitos, avisos, enfoque, sistemas y automatizaciones, estadísticas e informes. **Tu personaje** es tu foto de perfil, y para trabajar con otros tienes **Personas, equipos y chats**: a amigos y compañeros se les añade con un **enlace o un código QR**. Incluye **cuentas** (correo o Google) con **copia en la nube**, así que tienes lo mismo en el ordenador y en el móvil, y funciona sin conexión. Con **tema oscuro o claro** (o el del sistema), importa tus tareas de **Todoist, Google Tasks, Notion o un CSV**, y en el ordenador **se actualiza sola**.

**Todo es gratis y para todos**: no hay planes de pago, anuncios ni compras dentro de la app.

**Web: [whider-red.vercel.app](https://whider-red.vercel.app)** — la portada presenta WHIDER, sus novedades y preguntas frecuentes, y ofrece la descarga para tu dispositivo (en el ordenador, Windows, macOS o Linux; en el iPhone, cómo añadirla desde Safari; en Android, Google Play, próximamente). También [en inglés](https://whider-red.vercel.app/en/) (la app, de momento, está en español). La app en el navegador está en [`/app`](https://whider-red.vercel.app/app).

**Diseño «Índice»**, en blanco y negro: cabeceras cerradas por una regla fina, secciones en versalitas y **esquinas curvadas** y precisas en tarjetas, hojas, botones, campos y etiquetas, igual que en los iconos de la app, una colección propia en rejilla de 24. Dos tipografías: **Outfit**, geométrica y rotunda, en los títulos, las cabeceras y las cifras grandes, y **Onest**, una grotesca moderna de x alta y aperturas abiertas, muy legible en pantallas pequeñas, en el resto del texto, con cifras tabulares en horas y contadores.

<p align="center">
  <img src="sitio/img/pc-hoy.webp" width="900" alt="WHIDER 1.0 en el ordenador: Hoy con lo más importante arriba, tu personaje, el progreso y los hábitos del día">
</p>

---

## 🧩 Estructura de WHIDER

| Apartado | Objetivo |
| --- | --- |
| **PC** | Experiencia avanzada, organización y productividad profesional. |
| **Móvil** | Experiencia rápida, accesible y conectada con el ordenador. |
| **General** | Personalización, tu personaje como foto de perfil, personas y chats, sonidos y notificaciones. |

### Todo incluido, gratis

| | Qué incluye |
| --- | --- |
| **PC** | Calendario profesional (mes, semana y **día**; duración de las tareas, arrastrar y estirar, exportar a `.ics`) · Tareas por **categorías** con icono, **filtros** sin límite y vista de **tablero** · **Hábitos** y **selección múltiple** · **Sistemas profesionales** (GTD, Eisenhower, bloques de tiempo, 1-3-5, revisión semanal, bandeja a cero, Pomodoro) y **automatizaciones** a medida · **Estadísticas de hasta un año** e **informes** en PDF, CSV y JSON · **Personalización** de la barra lateral, Hoy y el calendario · **Cuaderno** completo |
| **Móvil** | Calendario · Tareas · Cuaderno · Plantillas de un toque · **Gestionar el ordenador** (dispositivos y enfoque compartido) · Una sola app sincronizada al instante con el ordenador |
| **General** | Sonidos de botones y avisos · **Personaje** personalizable como foto de perfil (especies, acabados, efectos, fondos y marcos) · Notificaciones · **Personas, chats y equipos**: invitar por enlace, QR o código, chatear y crear equipos con su chat y páginas compartidas |

<p align="center">
  <img src="docs/capturas/pc-70-cuaderno.jpg" width="440" alt="Cuaderno: página de proyecto con su base de datos en tablero">
  <img src="docs/capturas/pc-70-basedatos.jpg" width="440" alt="Cuaderno: base de datos en tabla con propiedades">
</p>
<p align="center">
  <img src="docs/capturas/pc-70-chats.jpg" width="440" alt="Chats con tus contactos: reacciones y tareas compartidas">
  <img src="docs/capturas/pc-70-personas.jpg" width="440" alt="Personas: amigos, trabajo y equipos, con enlace y código QR">
</p>
<p align="center">
  <img src="docs/capturas/pc-70-personajes.jpg" width="440" alt="Editor del personaje">
  <img src="docs/capturas/pc-60-estadisticas.jpg" width="440" alt="Estadísticas">
</p>
<p align="center">
  <img src="docs/capturas/movil-70.jpg" width="900" alt="WHIDER 7.0 en el móvil: Hoy con lo más importante arriba, Más, una página de equipo del Cuaderno y un chat">
</p>

---

## 💻 WHIDER para ordenador

| Sistema | Descarga | Instalación |
| --- | --- | --- |
| **Windows 10 y 11** | [WHIDER-Setup.exe](https://github.com/McTn4/whider-2.0-PREMIUM/releases/download/desktop-latest/WHIDER-Setup.exe) | Ábrelo y se instala solo (crea un acceso directo). Si aparece «Windows protegió su PC»: **Más información → Ejecutar de todas formas** (la app no está firmada con un certificado de pago). |
| **macOS** | [WHIDER-mac.dmg](https://github.com/McTn4/whider-2.0-PREMIUM/releases/download/desktop-latest/WHIDER-mac.dmg) | Arrastra WHIDER a Aplicaciones. La primera vez, ábrela con **clic derecho → Abrir**. |
| **Linux** | [WHIDER-linux.AppImage](https://github.com/McTn4/whider-2.0-PREMIUM/releases/download/desktop-latest/WHIDER-linux.AppImage) | Dale permiso de ejecución y ábrelo. |

La portada los ofrece en [whider-red.vercel.app/descargar](https://whider-red.vercel.app/descargar), destacando el de tu sistema, y cada versión publicada los trae todos en la pestaña **[Releases](https://github.com/McTn4/whider-2.0-PREMIUM/releases)**, con sus novedades. **Desde la 1.1 la app se actualiza sola** en Windows y en Linux (AppImage) y avisa de cada versión nueva en macOS y en Linux (.deb, nuevo en la 1.1, que no necesita `libfuse2`). La app también funciona en el navegador del ordenador con el mismo diseño, en [`/app`](https://whider-red.vercel.app/app).

**Pensada para pantalla grande, ratón y teclado**
- **Barra lateral ordenada por importancia**: *Nueva tarea* y *Buscar*; **Hoy, Tareas, Calendario y Cuaderno**; **Equipo** (Chats y Personas, con los mensajes sin leer); **Rutinas** (Hábitos y Enfoque); **Análisis** (Estadísticas, Informes y Automatizaciones); tus **categorías** y **filtros**; y abajo, tu perfil, tu plan y los ajustes. Qué se ve, los contadores y el tamaño se eligen en *Personalización*.
- **Hoy a dos columnas**: arriba, **lo más importante** (hasta 3 tareas: las que elijas o, si no, las más prioritarias, empezando por las vencidas) y después el resto; a la derecha, **quién te está esperando** (mensajes y solicitudes), **tu personaje**, el resumen del día, los hábitos, **los próximos 7 días**, tus páginas recientes y el enfoque (bloques y orden a tu gusto).
- **Varias tareas a la vez**: `Ctrl`/`⌘` clic, `Mayús` clic o `Ctrl A` y una barra para cambiar fecha, hora, prioridad, categoría, repetición y avisos, duplicar, completar o eliminar (con Deshacer). Arrastra cualquiera de ellas y se mueven todas.
- **Cuaderno** con el árbol de páginas a la izquierda y la página a lo ancho; **chats** con la lista y la conversación a la vez; **hábitos en cuadrícula** de 7, 14 o 30 días, **estadísticas** con gráficos y conclusiones e **informes** listos para imprimir o guardar en PDF.
- **Calendario grande**: el **mes** con las tareas dentro de cada día y el día elegido al lado, y la **semana en 7 columnas por horas** con la hora actual. Haz clic en un hueco para crear una tarea a esa hora y **arrastra** cualquier tarea a otro día u otra hora.
- **Editor en un panel a la derecha**, sin perder de vista la lista; diálogos centrados y la creación rápida arriba, como una barra de comandos.
- **Campo para añadir** en Hoy y en cada lista: escribe y pulsa Intro (entiende fecha, hora, `#lista` y `!` de prioridad).
- **Clic derecho** en una tarea: completar, editar, pasarla a hoy, a mañana o al lunes, cambiar la prioridad o la lista, enfocarte en ella o eliminarla.
- **Arrastra** una tarea a una lista de la barra lateral para moverla, a «Hoy» para hacerla hoy o a un día del calendario.
- **Buscar** (`Ctrl K` / `⌘ K`): encuentra tareas y listas, ve a cualquier sección o crea la tarea con lo que has escrito.

**Atajos de teclado** (pulsa `?` para verlos en la app)

| Atajo | Acción |
| --- | --- |
| `N` · `Alt N` | Nueva tarea · nueva página del Cuaderno |
| `Ctrl K` · `/` | Buscar tareas, páginas, personas y acciones |
| `1` … `9` | Hoy · Tareas · Calendario · Cuaderno · Chats · Personas · Hábitos · Enfoque · Estadísticas |
| `/` en una página | Menú de bloques del Cuaderno (títulos, listas, casillas, tablas, bases de datos…) |
| `P` · `Ctrl ,` | Perfil · Ajustes |
| `↑` `↓` · `Espacio` · `Intro` · `Supr` | Moverse por la lista · completar · editar · eliminar |
| `←` `→` · `T` · `M` `S` `D` `A` | En el calendario: anterior y siguiente · hoy · mes, semana, día y agenda |
| `Ctrl` clic · `Mayús` clic · `Ctrl A` | Seleccionar varias tareas · un tramo · todas (`Espacio` las completa, `Supr` las elimina) |
| `Ctrl P` | Informe en PDF (app de escritorio) |
| `Ctrl Intro` · `Esc` | Guardar · cerrar |

**La app de escritorio**
- Ventana con la franja de título integrada en el diseño (Windows y macOS); recuerda su tamaño y posición.
- **Sigue en la bandeja del sistema** al cerrar la ventana para avisarte de tus tareas, y puede **abrirse al iniciar el ordenador** (Ajustes → Ordenador). Desde la bandeja: abrir, nueva tarea, buscar, enfoque y salir.
- Notificaciones del sistema y aviso en el icono de la barra de tareas cuando hay tareas vencidas.
- **Entrar con Google**: se abre tu navegador, eliges la cuenta y vuelves a la app (Google no permite iniciar sesión dentro de otras apps). Con correo y contraseña se entra directamente.
- Funciona sin conexión: la app web va dentro y tus datos se guardan en el ordenador (y en tu cuenta, si has iniciado sesión).

<p align="center">
  <img src="docs/capturas/pc-02-calendario-mes.jpg" width="440" alt="Calendario: mes">
  <img src="docs/capturas/pc-03-calendario-semana.jpg" width="440" alt="Calendario: semana por horas">
</p>
<p align="center">
  <img src="docs/capturas/pc-04-editor.jpg" width="440" alt="Editor en panel lateral">
  <img src="docs/capturas/pc-05-buscar.jpg" width="440" alt="Buscar tareas y acciones">
</p>

---

## 🧭 Organización

En el ordenador, las secciones están en la barra lateral, de lo más importante a lo menos. En el móvil, un dock flotante abajo con cuatro pestañas y el botón **+** en el centro. Las tres primeras se eligen en *Ajustes → Personalización → Barra inferior* (por ejemplo, el **Cuaderno** o los **Chats** a un toque); por defecto son estas:

| Pestaña | Qué encontrarás |
| --- | --- |
| **Hoy** | Arriba, **lo más importante** del día (hasta 3 tareas, elegidas por ti o automáticas); después **tu día en una tarjeta** (tu personaje, cuántas llevas, la racha y por dónde seguir), **quién te está esperando** (mensajes y solicitudes) y tus tareas **agrupadas por estado**: **en curso**, **vencidas** (con *Posponer*), **pendientes** y **hechas**; al final, los hábitos y tus páginas recientes. Los primeros días, **Primeros pasos** enseña lo esencial con tus propias tareas. |
| **Tareas** | Buscador, **listas inteligentes** (Hoy · Programadas · Todas · Prioritarias) y **Mis listas** (Personal, Trabajo…). Cada lista abre su propia página. |
| **+** | **Creación rápida** desde cualquier pantalla: escribe «Llamar a Ana mañana a las 10 #trabajo !!» y WHIDER pone la fecha, la hora, la lista y la prioridad. |
| **Calendario** | Vistas de **Mes**, **Semana por horas** y **Agenda**, con filtro por lista y tus tareas que se repiten. |
| **Más** | El **Cuaderno** y los **Chats** en grande (con los mensajes sin leer) y, debajo, lo demás: **Personas**, **Rutinas** (Hábitos, Enfoque y Automatizaciones), **Análisis** (Estadísticas e Informes) y los ajustes. La pestaña avisa de los mensajes sin leer. |

Arriba, en todas las pantallas: **tu personaje** (o tu foto, a la izquierda) abre tu **Perfil y resumen** (actividad y marcas) y el **engranaje** (derecha) abre los **Ajustes**, con una página por apartado.

---

## ✨ Funciones

**Cuaderno (antes «Apuntes»)**
- **Páginas por bloques**: texto, tres tamaños de título, listas, casillas, desplegables, citas, avisos destacados, código, separadores, tablas, imágenes, enlaces web, subpáginas, índice, **bases de datos**, **tareas de WHIDER** con su aviso y la **agenda de hoy**. Escribe `/` para el menú de bloques (o `#`, `-`, `[]`… al empezar la línea), arrastra cualquier bloque para moverlo y selecciona texto para darle formato.
- **Fotos y archivos adjuntos** (PDF, documentos, hojas de cálculo… hasta 15 MB cada uno): con *Adjuntar*, el menú `/`, pegando o arrastrándolos. Las fotos se ven en la página y en un visor a pantalla completa; los archivos, con su nombre, tipo y tamaño, se abren, se descargan o se quitan (con *Deshacer*). Se guardan en el dispositivo y en tu cuenta, así que siguen ahí al recargar y en tus otros dispositivos.
- **Páginas dentro de páginas**, con icono, portada, favoritas, papelera y búsqueda en todo el Cuaderno (también por el nombre de los archivos).
- **Bases de datos** con propiedades (texto, número, selección, varias opciones, estado, fecha, casilla, enlace, persona, creada y editada) y vistas de **tabla**, **tablero**, **lista**, **calendario** y **galería**, con filtros, orden y búsqueda. Cada fila es también una página.
- **Plantillas**: reunión, proyecto, diario, apuntes de clase, plan semanal, lista de lectura, hoja de ruta, wiki del equipo y contactos y clientes.
- **Páginas de equipo**: compártelas con un equipo y editadlas a la vez (los cambios se juntan bloque a bloque).
- Se guarda al momento, funciona sin conexión y se sincroniza con tu cuenta. Los apuntes de versiones anteriores se convierten solos en páginas.

**Personas, equipos y chats**
- **Contactos de amigos y de trabajo**, separados. Se añaden con tu **enlace de invitación**, tu **código QR** (se escanea con la cámara del móvil o del ordenador) o tu código `WH-…`. El enlace funciona aunque la otra persona aún no tenga la app: la página de invitación la abre o le dice dónde descargarla.
- **Equipos** con sus miembros, su enlace para entrar, su **chat** y sus **páginas del Cuaderno**.
- **Chats** con cada contacto y con cada equipo: responder, reaccionar, editar y borrar tus mensajes, y compartir **tareas**, **páginas** y ánimos (quien los recibe los añade a lo suyo con un toque). Avisos de mensajes nuevos con la app abierta y contadores en la barra lateral, en *Más* y en Hoy.

**Tu personaje y tu foto de perfil**
- Tu personaje es **tu foto de perfil** en toda la app: la barra lateral, tu perfil, tus contactos, los chats y los equipos. Si lo prefieres, usa tu foto o solo la inicial.
- 10 especies (gota, cubo, cápsula, nube, gato, oso, búho, zorro, fantasma y robot), 10 acabados (de blanco y noche a platino, obsidiana, holográfico, cristal, mármol y cromo) y ojos, bocas, cabezas, accesorios, efectos, fondos y marcos: todo disponible desde el principio.

**Cuentas y copia en la nube**
- Registro con **correo y contraseña** (con verificación del correo, medidor de seguridad de la contraseña y recuperación por correo) o con **Google** (en Android, con el selector nativo de cuentas del teléfono).
- Opción para admitir **solo correos de empresa** (`allowedEmailDomains`).
- Tus tareas, listas, marcas, enfoque y ajustes se guardan en tu cuenta y se **sincronizan automáticamente** entre dispositivos (al abrir la app, al volver a ella, cada minuto y tras cada cambio); los cambios de varios móviles se fusionan sin perder nada.
- Funciona sin internet y sincroniza al volver la conexión. Cerrar sesión y **eliminar la cuenta** desde Ajustes → Cuenta.
- Modo **sin cuenta** opcional: los datos se quedan en el dispositivo y se suben a la cuenta si la creas más tarde.
- Configuración: [docs/CONFIGURAR-CUENTAS.md](docs/CONFIGURAR-CUENTAS.md).

**Tareas y listas**
- **Creación rápida en lenguaje natural**: «mañana», «el lunes», «el 15», «20/11», «en 3 días», «a las 5 de la tarde», «cada semana», «#lista» y «!»/«!!»/«!!!» para la prioridad. Lo detectado aparece en etiquetas que puedes descartar; con Intro se añade y queda listo para la siguiente.
- La prioridad se ve de tres formas, nunca solo por el brillo: a la derecha se **rellenan** una, dos o tres barras (destacada, importante y urgente; las demás quedan con su contorno), lo urgente y lo importante **lo dicen con texto** junto a la tarea y, si lo activas en *Ajustes → Apariencia → Prioridad en color*, también se ve **en color** (rojo y ámbar).
- **En curso**: marca una tarea como empezada (clic derecho, el editor o al enfocarte en ella) y sale aparte en Hoy, con media casilla rellena. Las que tienen alguna subtarea hecha también cuentan.
- **Color de categoría** opcional (verde, azul, turquesa, violeta o rosa): un punto junto a su nombre en las tareas, el calendario y la barra lateral. Elegidos para leerse bien sobre fondo oscuro y distinguirse también con daltonismo; la app sigue en blanco y negro si no eliges ninguno.
- **Listas** propias, más cuatro **listas automáticas** que se rellenan solas (Hoy, Programadas, Todas y Prioritarias).
- **Importar desde otras apps** (*Ajustes → Datos* o la paleta de comandos): **Todoist** (CSV de cada proyecto), **Google Tasks** (Google Takeout), **Notion** (CSV de una base de datos), **calendarios** `.ics` de Google, Outlook o Apple (con su hora y zona horaria, duración y repetición) y cualquier **hoja de cálculo** CSV eligiendo qué columna es cada cosa. Antes de importar se ve una vista previa con las categorías nuevas, las tareas que ya tienes (no se duplican) y lo que no se entendió; durante un día se puede **deshacer**.
- **Compartir con WHIDER**: desde otra app (Android) o desde el menú *Compartir* del sistema (web instalada), un texto o un enlace se convierte en una tarea nueva.
- Fecha con **calendario integrado**, hora, **subtareas**, **notas** y **repeticiones** (cada día, días laborables, cada semana, cada mes).
- **Gestos**: desliza → para completar y ← para eliminar, con **Deshacer**.
- Búsqueda en títulos, notas y subtareas; orden por fecha, prioridad, recientes o título.
- Si cierras el editor con cambios sin guardar, WHIDER te pregunta antes de descartarlos.

**Avisos**
- **Recordatorio previo** configurable (de 5 minutos a 1 día antes) y **aviso si no la haces** al vencer el plazo, repetible cada 10, 20 o 60 minutos.
- **Horas de silencio**: sin sonidos ni notificaciones en tu horario de descanso.
- En la app Android, los recordatorios **suenan aunque la app esté cerrada** y se restauran al reiniciar el móvil.

**Calendario**
- **Mes**: un punto por tarea pendiente (hasta tres), uno que brilla si hay algo vencido y uno hueco para las repeticiones futuras; menú para saltar de mes y el día elegido con sus tareas por hora y un campo para **añadir directamente a ese día**.
- **Semana**: tira de 7 días con su progreso y el **día por horas** con la hora actual; **toca un hueco** para crear una tarea a esa hora y **mantén pulsada una tarea para arrastrarla** a otra hora.
- **Agenda**: lo vencido y los próximos 30 días, día a día.
- Las tareas que se repiten se ven también en los días futuros, filtro por lista y opción de ocultar las completadas.

**Enfoque**
- Sesiones y pausas cortas o largas, con pausas automáticas opcionales y una tarea vinculada.
- Exacto aunque la app pase a segundo plano. Notificación y sonido suave al terminar.

**Perfil y marcas**
- Tu foto y tu nombre; completadas, racha y minutos de enfoque; gráfica de 7 o 30 días, **mapa de constancia** de 15 semanas y reparto por listas.
- **Récords automáticos** (mejor racha, más tareas en un día, mejor semana, más enfoque en un día) e **hitos**.
- **Marcas personales**: tiempos, pesos, distancias, páginas… con su evolución. El historial es permanente: **no se borra aunque elimines tareas**.

**Tus datos no se pierden**
- Todo se guarda al instante en el dispositivo; en el APK además en un almacén nativo de Android, que los recupera aunque el sistema limpie el almacenamiento de la app.
- Con cuenta, también en la nube: al iniciar sesión en otro móvil lo recuperas todo.

**Personalización (Ajustes)**
- Tamaño de texto (4 niveles), densidad cómoda o compacta y movimiento reducido.
- Pantalla al abrir, lista por defecto, aviso por defecto, primer día de la semana, formato 12/24 h y confirmación al eliminar.
- Duración de las sesiones de enfoque y de las pausas.

---

## 📱 Pantalla y Android

- **Widget «Hoy»** para la pantalla de inicio: las tareas de hoy (lo urgente primero), cuántas llevas y un botón para añadir.
- **Avisos a la hora exacta** (Android 12+), si lo permites en *Ajustes → Avisos*; sin el permiso, los recordatorios llegan igualmente, con unos minutos de margen.

> **Descarga el APK de pruebas**: [app-debug.apk](https://github.com/McTn4/whider-2.0-PREMIUM/releases/download/apk-latest/app-debug.apk) (pestaña **Releases → WHIDER (última versión)**). Se recompila solo con cada cambio de la app, junto con el **paquete para Google Play (AAB)**, que queda en los artefactos de cada compilación (**Actions → Compilar APK**). Cómo publicarla: [`docs/PUBLICAR-EN-GOOGLE-PLAY.md`](docs/PUBLICAR-EN-GOOGLE-PLAY.md).

- Los **enlaces de invitación** (`https://whider-red.vercel.app/i/…`) abren la app directamente, y el lector de **códigos QR** usa la cámara trasera.

- Preparada para Google Play: apunta a **Android 16 (API 36)** y se dibuja **de borde a borde**, apartando el contenido de la barra de estado, la de navegación, la muesca y el teclado; detrás de las barras se ve el mismo fondo que la app.
- Se adapta a móviles pequeños (360 px), grandes, en horizontal y a tablets.
- Tamaño del texto: la primera vez sigue el tamaño de letra del sistema (normal, grande o enorme) y después se elige en **Ajustes → Apariencia**, sin descuadrar el diseño.
- Teclado: los formularios se redimensionan para no quedar tapados.
- Icono adaptable (Android 8+) con la W en blanco sobre negro, icono temático (Android 13+) e icono propio en la barra de notificaciones.
- Botón **Atrás** (también con el gesto predictivo de Android 16): cierra menús y hojas, vuelve a la página anterior (de una lista a Tareas, del Perfil a la pestaña en la que estabas o dentro de Ajustes), después a la pestaña inicial y solo entonces sale.

---

## ▶️ Probar en el navegador

Con Python 3.8 o superior:

```bash
python serve.py
```

Se abre `http://localhost:8080` y la consola muestra también la dirección para el móvil en tu red Wi‑Fi. Opciones: `python serve.py 9000` (otro puerto) y `python serve.py --no-open`. En local la app está en `/` y en `/app`, y la portada en `/sitio/`.

## 🌐 La web (Vercel)

| Dirección | Qué es |
| --- | --- |
| `/` | **Portada** ([`sitio/index.html`](sitio/index.html)): qué es WHIDER, «Abrir en el navegador» y la descarga según el dispositivo. En el ordenador destaca su sistema (Windows, macOS o Linux) con el tamaño de cada instalador; en el móvil muestra **Google Play · Próximamente** y cómo añadir la web a la pantalla de inicio. Quien ya usa WHIDER en ese navegador entra directo a la app (`/?inicio` enseña la portada igualmente). |
| `/app` | La app en el navegador (la misma `index.html` que usan Android y el ordenador). |
| `/descargar` | Lleva a la sección de descarga de la portada (también desde **Ajustes → Descargar la app** en la web). |
| `/i/…` | Invitaciones: abren la app o la web y ofrecen las mismas descargas. |
| `/privacidad/` | Política de privacidad; «Eliminar mi cuenta» abre `/app#cuenta`. |
| `/en/` y `/privacy/` | La portada y la política de privacidad en inglés ([`sitio/en/index.html`](sitio/en/index.html), [`privacy/index.html`](privacy/index.html)). |

Vercel ejecuta `node tools/web-build.js` (ver [`vercel.json`](vercel.json)), que deja en `dist/` la portada como `index.html` y la app como `app.html`, servida en `/app`. Para verla igual en local: `node tools/web-build.js` y sirve `dist/` con esas mismas reglas. Las direcciones de descarga están todas en [`sitio/descargas.js`](sitio/descargas.js): cuando WHIDER esté en Google Play, basta con poner su enlace en `play`.

Si tienes [`cloudflared`](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/) instalado, el servidor crea además un enlace HTTPS temporal: ábrelo en Chrome del móvil y usa **⋮ → Instalar aplicación** para instalarla como app.

## 🛠️ Abrir y compilar la app de escritorio

Con Node.js 20 o superior:

```bash
cd desktop
npm install
npm start
```

`npm start` copia la app web a `desktop/www` y abre WHIDER. Para crear el instalador de tu sistema: `npm run dist` (queda en `desktop/dist`).

## 🛠️ Compilar el APK (Android Studio)

1. Sincroniza la web con el proyecto Android:
   ```bash
   python package_apk.py --sync
   ```
2. Abre la carpeta **`android/`** en Android Studio (JDK 17 o superior) y pulsa **Run**, o desde la terminal:
   ```bash
   cd android
   ./gradlew assembleDebug
   ```
3. El APK queda en `android/app/build/outputs/apk/debug/app-debug.apk`.

---

## 📂 Estructura

```text
.
├── index.html              # Estructura de la app + colección de iconos «Índice» (SVG propio)
├── manifest.json           # PWA: iconos y accesos directos (nueva tarea, nueva página, chats, hábitos)
├── sw.js                   # Funcionamiento sin conexión y clic en notificaciones
├── sitio/                  # La web: portada (index.html), enlaces de descarga (descargas.js) y capturas (img/)
├── i/index.html            # Página de las invitaciones (enlaces y QR): abre la app o la web, o enseña a descargarla
├── privacidad/index.html   # Política de privacidad pública (la que pide Google Play) y cómo eliminar la cuenta
├── .well-known/            # assetlinks.json: los enlaces de invitación abren la app de Android (App Links)
├── css/
│   ├── tokens.css          # Grises, sombras, tipografías, radios de esquina, tamaños y movimiento
│   ├── layout.css          # Pantalla de carga, estructura a pantalla completa, barra superior y dock
│   ├── components.css      # Celdas agrupadas, botones, hojas, alertas, menús, interruptores…
│   ├── screens.css         # Estilos de cada pantalla
│   ├── social.css          # Personas, chats, avatares con tu personaje, invitaciones y QR, Más
│   ├── cuaderno.css        # Cuaderno: editor por bloques y bases de datos (se carga al abrirlo)
│   └── desktop.css         # Ordenador: barra lateral, diálogos, calendario grande, ratón y teclado
├── firestore.rules         # Reglas de seguridad: tus datos solo tuyos; perfiles, buzón, equipos y chats solo de sus miembros
├── firebase.json           # Configuración de Firebase (reglas, hosting y emuladores)
├── vercel.json             # Publicación de la web: compilación (tools/web-build.js), /app y /descargar
├── js/
│   ├── config.js           # ← Configuración de cuentas (Firebase) y enlaces: ver docs/CONFIGURAR-CUENTAS.md
│   ├── vendor/             # SDK de Firebase empaquetado (funciona sin CDN), generador y lector de códigos QR
│   ├── core/               # util, store, parse (lenguaje natural), audio (sonidos), notify, records, auth (cuentas),
│   │                       #   sync (nube), habits, files (archivos adjuntos del Cuaderno),
│   │                       #   automations (motor de reglas), stats (estadísticas), pages y pagesync (Cuaderno),
│   │                       #   community (personas y equipos), chat (chats) e invite (enlaces y QR)
│   ├── ui/                 # anillos, avisos, menús, hojas, controles, perfil, editor, creación rápida, fila de tarea,
│   │                       #   diseño (layout), barra lateral, búsqueda, atajos, selección múltiple (select),
│   │                       #   filtros, personaje (character), avatares (avatar), gráficos (charts),
│   │                       #   dispositivos/plantillas (devices) y, para el Cuaderno, blocks (editor) y dbview (bases de datos)
│   ├── screens/            # home (Hoy), tasks, calendar, notes (Cuaderno), chats, friends (Personas), more (Más),
│   │                       #   habits, focus, stats, reports, automations (Automatizaciones), progress (Perfil), settings…
│   ├── router.js
│   └── app.js
├── icons/                  # Logotipo (SVG) e iconos PNG 192/512/maskable
├── fonts/                  # Outfit (títulos y cifras) y Onest (texto), variables 100–900, locales, con sus licencias OFL
├── desktop/                # App de escritorio (Electron): ventana, bandeja, acceso con Google por el navegador
├── android/                # Proyecto nativo (WebView + recordatorios + notificaciones), API 36
├── tools/
│   ├── web-build.js        # Prepara la web para Vercel en dist/ (portada en /, app en /app)
│   ├── servir-web.py       # Sirve dist/ en local con las mismas reglas que vercel.json
│   ├── iconos/             # Generador de la colección de iconos «Índice» y su muestrario
│   ├── capturas/           # Capturas de la portada, imagen para compartir y recorrido por las pantallas
│   └── firebase-bundle/    # Cómo regenerar js/vendor/firebase.js
├── tests/
│   ├── unit/               # Lógica sin navegador (node --test): fechas, lenguaje natural, tareas, sincronización…
│   ├── e2e/                # Recorridos reales con Playwright: app, web, cuentas (emuladores) y escritorio
│   └── run.mjs             # Lanzador de las pruebas (arranca servidores y emuladores si hace falta)
├── types/whider.d.ts       # Tipos comunes para la comprobación progresiva con TypeScript
├── package.json            # Herramientas de desarrollo y comandos (npm run check, npm test…)
├── serve.py                # Servidor local para PC y móvil
└── package_apk.py          # Copia la web a android/…/assets/www y crea el ZIP del proyecto
```

Cómo instalar, ejecutar, probar y compilar todo desde cero: [docs/DESARROLLO.md](docs/DESARROLLO.md).

## 🚀 Para quien publica la app

- **Versiones**: la versión está en `package.json` y se cambia con `node tools/version.js 1.2.0`; al subirla a `main`, GitHub publica la versión con todos los instaladores y las notas de [`CHANGELOG.md`](CHANGELOG.md). Paso a paso: [`docs/PUBLICAR-UNA-VERSION.md`](docs/PUBLICAR-UNA-VERSION.md).
- **Google Play**: la guía paso a paso (clave de subida, secretos de GitHub, Play Console, seguridad de los datos y las huellas de la firma de Google) está en [`docs/PUBLICAR-EN-GOOGLE-PLAY.md`](docs/PUBLICAR-EN-GOOGLE-PLAY.md).
- **Cuentas y nube**: [`docs/CONFIGURAR-CUENTAS.md`](docs/CONFIGURAR-CUENTAS.md). Publica las reglas de [`firestore.rules`](firestore.rules) en *Firebase → Firestore Database → Reglas* cada vez que cambien.
- **Archivos del Cuaderno**: se guardan en Firestore en trozos de menos de 1 MB, sin Cloud Storage (que exige el plan de pago de Firebase); en el plan gratuito caben 1 GB de datos en total. Si crecen mucho, pueden ir a Firebase Storage con `storage: true` en `js/config.js` (preparado y probado; pasos en [`docs/CONFIGURAR-CUENTAS.md`](docs/CONFIGURAR-CUENTAS.md)).
- **Sincronización**: con la app a la vista se mira la nube cada 15 segundos y los cambios se suben al momento; si algún día se queda corto el plan gratuito de Firebase (50 000 lecturas al día), basta con pasar al plan de pago por uso.

## 🔒 Privacidad

Sin cuenta, todo se queda en el dispositivo. Con cuenta, los datos se guardan además en tu proyecto de Firebase, protegidos por reglas que solo permiten a cada usuario acceder a lo suyo ([`firestore.rules`](firestore.rules)). Tus contactos solo ven tu perfil público (nombre, personaje o foto, racha y cuántas tareas y minutos de enfoque llevas en la semana), nunca tus tareas ni tu Cuaderno. Los mensajes de un chat solo los leen sus miembros, y las páginas de un equipo y sus archivos adjuntos, solo los miembros del equipo. WHIDER nunca ve ni guarda contraseñas (las gestiona Firebase Authentication), no muestra publicidad y permite eliminar la cuenta y todos sus datos de la nube (también el Cuaderno con sus archivos, el perfil público y el código de contacto) desde Ajustes o, sin la app, desde la web (`https://whider-red.vercel.app/app#cuenta`). Política completa: [`privacidad/index.html`](privacidad/index.html), publicada en `https://whider-red.vercel.app/privacidad/`.

---

---

## 📝 Novedades

Todas las versiones y lo que trae cada una: [`CHANGELOG.md`](CHANGELOG.md) (también en la app: Ajustes → Ayuda → Novedades).

### 1.1

- **Importar** desde Todoist, Google Tasks, Notion, calendarios (.ics) o un CSV, con vista previa y deshacer.
- **Tema claro** (u «Como el sistema»), con contraste comprobado en todas las pantallas.
- **Hoy por estados** y tareas «En curso»; **color por categoría** y **prioridad legible** (también sin color).
- **Sincronización sin pérdidas** entre dispositivos y errores de la nube explicados.
- **Copias automáticas** sin cuenta (ordenador y Android) y **actualizaciones automáticas** en el ordenador.
- **Android**: widget «Hoy», compartir con WHIDER y avisos a la hora exacta.
- **Seguridad**: bloquear y denunciar, reglas más estrictas e informes de errores solo con permiso.
- **Ayuda** dentro de la app, instalar en el iPhone, la web en inglés y una web un 38 % más rápida.

Detalle completo en [`CHANGELOG.md`](CHANGELOG.md) y el porqué de cada cambio en [`docs/EVOLUCION-1.1.md`](docs/EVOLUCION-1.1.md).

### 1.0

La primera versión preparada para **Google Play**. La numeración empieza de nuevo; el historial anterior está en [`docs/HISTORIAL.md`](docs/HISTORIAL.md).

- **Todo gratis**: desaparecen los planes, los pagos, la pantalla de Planes, los candados y los avisos de Premium. Sistemas y automatizaciones, tablero, filtros y reglas sin límite, estadísticas de un año, informes completos con CSV y JSON, personalización del ordenador, invitar y crear equipos, gestionar el ordenador desde el móvil y las plantillas de un toque son para todos.
- **Personajes**: se retiran los personajes que eran de Premium (gema, dragón, astronauta, fénix y unicornio); quien tuviera uno pasa al de siempre y conserva su nombre. Los acabados, accesorios, efectos, fondos y marcos quedan disponibles para todos.
- **Nueva identidad visual**: **Outfit** en los títulos y las cifras grandes y **Onest** en el resto del texto, una **colección de iconos propia** (rejilla de 24, trazo único, contenedores de esquinas curvadas) y la misma forma curvada en toda la interfaz: casillas, botones, campos, tarjetas, hojas, el botón central y el dock. «Más» pasa a ser un índice en lista y el contenido arranca siempre a la misma distancia de la cabecera.
- **Accesibilidad**: textos secundarios con contraste AA, nombres accesibles coherentes, calendarios y gráficos bien descritos para lectores de pantalla y zoom permitido en la web. Auditoría con axe-core: 0 incumplimientos de WCAG 2.1 A/AA en 25 vistas de móvil y ordenador.
- **Android**: Android 16 (API 36), de borde a borde, gesto Atrás predictivo, tamaño de letra del sistema la primera vez, recordatorios compatibles con las reglas de Android 15+, acceso a archivos del WebView cerrado en instalaciones nuevas y paquete AAB para Google Play compilado en GitHub (firmado con tu clave de subida desde los secretos del repositorio).
- **Privacidad**: política pública en `/privacidad/` y eliminación de la cuenta desde la web (`/app#cuenta`), como pide Google Play.
- **Web**: portada nueva en `/` con la descarga para cada dispositivo (ordenador: Windows, macOS y Linux; móvil: Google Play, próximamente) y la app en el navegador en `/app`.
- **Limpieza**: fuera el servidor de pagos (`pagos/` y `api/`), la regla `entitlements` de Firestore, ~90 reglas de estilo y 12 funciones sin uso, restos de la gamificación en la sincronización y la copia antigua de la web que se guardaba dentro del proyecto Android.
