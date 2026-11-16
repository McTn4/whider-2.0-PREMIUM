# Historial de WHIDER antes de la 1.0

La numeración se reinició con la **1.0**, la primera versión preparada para Google Play (gratuita y sin
planes de pago). Este es el registro de las versiones de desarrollo anteriores (3.0 → 8.2.1), tal como se
publicaron. Algunas funciones que se mencionan aquí ya no existen: los planes Gratis/Premium, los pagos con
Stripe y los personajes Premium se retiraron en la 1.0, y todo lo que era de Premium pasó a ser para todos.

## Novedades de la 8.2.1

- La app pregunta al servidor de pagos ya publicado (`whider-20-premium-pagos.vercel.app`) si la activación automática está lista, para que sus textos y el botón «Suscribirse» lo reflejen.

## Novedades de la 8.2

- **«Suscribirse» en lugar de canjear códigos**: en *Planes*, la tarjeta de Premium y la sección del final tienen «Suscribirse», que abre la página de pago de Stripe del periodo elegido; al confirmarse el pago, Premium se activa solo. Ya no hay casilla para canjear códigos.
- Con el enlace de pago real, «Suscribirse» solo se activa cuando el servidor de pagos confirma que activa Premium al pagar (para no cobrar sin darlo).
- **Opciones del propietario** (*Ajustes* → 7 toques en la versión): Premium para siempre con el código de fundador, sin pagar, y el interruptor de pagos de prueba cuando haya enlace real.

## Novedades de la 8.1

- **Premium se activa solo al pagar**: tras pagar en Stripe, vuelve a WHIDER y en unos segundos Premium está activo en tu cuenta y en todos tus dispositivos, sin códigos. Mientras llega la confirmación, *Planes* lo indica y tiene «Comprobar ahora». Los pagos de prueba dan Premium 24 horas; una suscripción, mientras siga activa.
- Para pagar hay que iniciar sesión (Premium se guarda en la cuenta).
- Servidor de pagos en [`pagos/`](pagos) (Vercel, sin dependencias) y reglas de Firestore nuevas: cada cuenta solo puede leer su Premium pagado y nadie puede escribirlo desde la app. Hasta que el servidor esté configurado, la app sigue diciendo con claridad que pagar no activa Premium.

## Novedades de la 8.0.3

- **El pago de prueba se ve sin trucos**: mientras no haya enlace de pago real, *Planes* muestra «Hazte Premium (prueba)» con el enlace del modo de prueba de Stripe, sin tener que tocar 7 veces la versión. Un aviso explica que no se cobra nada y que, por ahora, pagar no activa Premium. Cuando haya enlace real, el de prueba vuelve a quedar solo para quien lo encienda con los 7 toques.

## Novedades de la 8.0.2

- **Sin prueba gratuita de 14 días**: *Planes*, la ventana de Premium y la barra lateral ya no la ofrecen, y quien la tuviera en marcha vuelve al plan gratuito (con un aviso; todo lo suyo sigue ahí). Así se puede probar el pago. Se vuelve a activar con `premium.trialDays` en [`js/config.js`](js/config.js).
- Si no hay pago ni prueba, la tarjeta de Premium ofrece «Canjear un código», que lleva a la casilla del código (antes se quedaba sin botón).

## Novedades de la 8.0.1

- **Modo de pruebas de pago**: oculto para los usuarios; se enciende en cada dispositivo con 7 toques en la versión, al final de *Ajustes*. Con él, *Planes* avisa de que el pago es de prueba y «Hazte Premium (prueba)» abre el enlace del modo de prueba de Stripe (`premium.testCheckoutUrl`), sin cobrar nada. Al apagarlo vuelve a usarse solo el enlace real, si lo hay.
- El pago lleva el identificador de la cuenta (`client_reference_id`) y, si la cuenta tiene correo, ese correo ya escrito en la página de pago (`prefilled_email`).

## Novedades de la 8.0

**Arreglado**
- **Barra inferior del móvil**: ya no se iluminan pestañas que no están elegidas. La causa era el cálculo de la pestaña activa (`classList.toggle(…, undefined)` alterna en vez de apagar). Activa, pulsada, con el ratón encima y con el foco del teclado son ahora estados distintos y cada uno se queda en su pestaña.
- **Desplegables del Cuaderno**: el menú `/` se reconstruía con cada desplazamiento de su propia lista y las últimas opciones no se podían elegir. Ahora se desplaza bien, cabe en la pantalla, en el móvil se coloca encima de la barra del teclado sin tapar la línea que escribes, y los menús generales se abren por el lado con más sitio.
- **Páginas compartidas con un equipo**: si la página ya estaba guardada en la nube, los demás la recibían vacía (solo se subía su ficha). Ahora se sube también su contenido.
- La barra sobre el teclado del móvil ya no tapa hojas, menús ni el visor, y se oculta al dejar de escribir.

**Nuevo: fotos y archivos en el Cuaderno**
- Fotos con vista previa y archivos con su nombre, tipo y tamaño, en el ordenador y en el móvil (galería del sistema o explorador de archivos). Abrir (visor propio para imágenes, vídeo, audio y texto; en Android y en la app de escritorio, con otra aplicación), descargar (Android: *Descargas › WHIDER*) y quitar con *Deshacer*.
- Persistentes: se guardan en el dispositivo (IndexedDB) y en tu cuenta, en trozos de menos de 1 MB; tus otros dispositivos los descargan al abrir la página. Sin conexión se guardan igual y se suben al volver. Los archivos de las páginas de equipo son del equipo. Lo que ya no usa ninguna página se borra solo pasados 3 días, y eliminar la cuenta los borra de la nube.

**Nuevo diseño, *Índice***
- Identidad propia en blanco y negro: cabeceras editoriales cerradas por una regla fina, secciones con su nombre en versalitas y su contador en una pestaña, menos brillo y esquinas más precisas.
- Cuaderno con aire propio (lejos de Notion): icono junto al título, portada como banda, una línea con fecha, palabras, adjuntos y herramientas, y el **margen de cuaderno**, una regla a la izquierda del texto que marca el bloque en el que escribes. En el ordenador, la barra lateral se queda en iconos dentro del Cuaderno.

**Sin gamificación**
- Fuera la experiencia (XP), los niveles, los logros, el ranking semanal y las celebraciones. Se quedan las rachas, las estadísticas, los informes, las marcas personales y el personaje como foto de perfil.

**Mejor organizado**
- Los mismos grupos en el ordenador y en el móvil: Cuaderno y equipo, Rutinas (Hábitos, Enfoque y Sistemas), Análisis y Cuenta. Ajustes con bloques con nombre y sin opciones repetidas, y el menú de cada bloque del Cuaderno por grupos.

## Novedades de la 7.0.2

App de escritorio (Windows y macOS):
- El **Cuaderno** y los **Chats** empiezan debajo de la franja de título de la ventana. Antes, el buscador del Cuaderno, el botón *+*, la ruta de la página y los botones de favorita y *⋯* (y la cabecera de los chats) quedaban tapados por la franja y por los botones de minimizar, maximizar y cerrar.
- Los menús y las ventanitas del editor nunca se colocan sobre esa franja.
- Al cambiar de pantalla (también desde la bandeja o un aviso) se cierra el menú que estuviera abierto.

## Novedades de la 7.0.1

Retoques de diseño en el Cuaderno:
- La **portada** de una página es ahora una tarjeta entera, separada de la barra de arriba (antes quedaba pegada a ella y parecía cortada). Las portadas *Ondas* y *Papel* tienen dibujo propio.
- Los **tableros** muestran enteras tres columnas en el ancho de la página; si hay más, se desplazan.
- En el móvil, las **vistas** de una base de datos (Tabla, Tablero…) ya no se aprietan hasta desaparecer, y el botón *Nueva* no se sale de la pantalla.

## Novedades de la 7.0

**Cuaderno, el nuevo nombre de Apuntes, al estilo de Notion**
- Editor **por bloques** con menú `/`, atajos de Markdown, arrastrar bloques, formato al seleccionar, **subpáginas**, portadas, iconos, favoritas y papelera.
- **Bases de datos** con 11 tipos de propiedad y 5 vistas (tabla, tablero, lista, calendario y galería), filtros y orden.
- **9 plantillas** y **páginas de equipo** que se editan a la vez. Tus apuntes anteriores pasan solos al Cuaderno, y la copia de seguridad (JSON) también lo incluye.

**Personas: amigos y trabajo, por enlace o código QR**
- Contactos **de amigos y de trabajo**, separados. Invitación por **enlace** (con página propia que abre la app), **código QR** con tu personaje en el centro y **lector de QR** con la cámara; también por código `WH-…`.
- Arreglado: ya no hace falta que las dos personas tengan Premium. Basta con quien invita; quien recibe la invitación se une gratis.
- **Equipos** con enlace para entrar, miembros, chat y páginas compartidas.

**Chats**
- Con cada contacto y con cada equipo: responder, reaccionar, editar, borrar, compartir tareas y páginas, avisos y contadores de mensajes sin leer.

**Personajes como foto de perfil**
- Tu personaje es tu avatar en toda la app (o tu foto, o tu inicial). **5 personajes Premium** nuevos, 6 acabados, efectos, fondos y marcos exclusivos.

**Mejor orden en PC y móvil, por prioridades**
- **Lo más importante** arriba en Hoy (hasta 3 tareas elegidas por ti o automáticas) y **quién te está esperando** justo después.
- Ordenador: barra lateral por grupos (lo diario, Equipo, Rutinas, Análisis) y atajos `1`–`9` en ese orden; `Alt N` crea una página.
- Móvil: dock con **Hoy, Tareas, +, Calendario y Más**; *Más* reúne el resto por orden de importancia y avisa de los mensajes.

**Además**
- Eliminar la cuenta borra también de la nube el Cuaderno, el perfil público, el código de contacto y los equipos en los que se estaba solo.
- Al cambiar de cuenta en un mismo dispositivo, no se ven los chats de la cuenta anterior.
- El editor del Cuaderno se carga al abrirlo por primera vez, para que la app siga arrancando rápido.

## Novedades de la 6.0.1

- **Códigos de activación privados**: el código de fundador de la 6.0 deja de valer y en el repositorio solo queda la huella cifrada de los códigos.
- **Imprimir** (Ctrl P) funciona en cualquier pantalla; en *Informes* y al guardar en PDF sale solo el informe, en negro sobre blanco.

## Novedades de la 6.0

**Estructura PC · Móvil · General, con plan Gratis y Premium**
- **Planes y precios** con la comparativa por PC, Móvil y General, prueba de 14 días, códigos de activación y enlace de pago configurable.
- **Tipografía nueva**: Hanken Grotesk en el móvil y en el ordenador.

**PC**
- **Calendario profesional**: vista **Día**, **duración** de las tareas (bloques que se estiran arrastrando), fines de semana y horas a tu gusto y **exportar a otros calendarios** (`.ics`).
- **Categorías con icono** (antes «listas»), **filtros guardados** y **tablero** por categoría, prioridad o fecha.
- **Selección múltiple** con barra de acciones completa e importar/exportar tareas en **CSV** y copias en **JSON**.
- **Apuntes** a dos paneles con formato ligero; las casillas se convierten en tareas.
- **Hábitos**: cuadrícula de días, rachas, mapa de 18 semanas, objetivos diarios y recordatorios.
- **Estadísticas** (cifras con variación, por día, semana y hora, categorías, prioridades, enfoque, hábitos, año entero y conclusiones) e **informes** imprimibles, en PDF, CSV o JSON.
- **Sistemas profesionales** de un toque y **automatizaciones** «Cuando… Si… Entonces…» con prueba e historial.
- **Personalización avanzada**: barra lateral, bloques de Hoy y su orden, calendario y ancho del contenido.
- **Comunidad**: código de amigo, solicitudes, ranking semanal, ánimos y **espacios compartidos**.

**Móvil**
- Hábitos en Hoy, apuntes, selección (mantén pulsada una tarea), estadísticas resumidas y «Tu semana».
- **Premium**: **plantillas de un toque**, sincronización al instante, **gestionar el ordenador** (dispositivos y enfoque a distancia) y amigos.

**General**
- **Tu personaje**: cuerpo, tono, ojos, boca, cabeza y accesorios; estados de ánimo según tu día; te habla al tocarlo y aparece en Hoy, el perfil, el enfoque, las pantallas vacías y las celebraciones.
- **Logros y niveles** renovados: 16 familias con grados, barras de progreso, experiencia de todo lo que haces y **recompensas** para tu personaje al subir de nivel.
- **Sonidos**: botones, avisos y logros por separado, cuatro estilos y volumen. Alto contraste en Apariencia.

## Novedades de la 5.0

**WHIDER para ordenador**
- App de escritorio para **Windows, macOS y Linux**, con instaladores que se compilan solos en GitHub.
- Diseño propio para pantalla grande: barra lateral con secciones y listas, Hoy a dos columnas con los próximos días, editor en un panel a la derecha y diálogos centrados.
- **Calendario grande**: mes con las tareas dentro de cada día y semana en 7 columnas por horas; clic en un hueco para crear y arrastrar para cambiar de día o de hora.
- **Ratón**: clic derecho en las tareas y arrastrarlas a una lista, a «Hoy» o a un día del calendario.
- **Teclado**: búsqueda y acciones con `Ctrl K`, atajos para todo y ayuda con `?`.
- Bandeja del sistema, abrir al iniciar el ordenador, notificaciones del sistema y aviso de tareas vencidas en el icono.
- Entrar con Google desde el navegador del ordenador y vuelta automática a la app.

**Móvil**
- Sin cambios: se mantiene la 4.4 y su APK.

## Novedades de la 4.4

**Blanco y negro**
- Toda la interfaz pasa a **blanco y negro**: fondo negro, superficies en grises, sombras profundas bajo cada tarjeta y un **brillo blanco contenido** en lo activo (botón principal, día elegido, pestaña actual, casillas marcadas y la hora actual del calendario).
- Desaparecen los colores de acento y los colores de las listas, junto con sus selectores. No se pierde ningún dato: los colores elegidos en versiones anteriores simplemente dejan de usarse.
- La prioridad se ve con **luz**: tres barras que se encienden (destacada, importante, urgente) y un borde de la casilla más brillante cuanto más importante es la tarea. Lo vencido se señala con un punto que brilla.

**Tipografía nueva**
- **IBM Plex Sans** para el texto e **IBM Plex Mono** para cifras, horas y fechas (contadores, calendario, estadísticas y marcas). Títulos con pesos más moderados.

**Sin aspecto de plantilla**
- Iconos de trazo sin baldosas de colores, diálogos sin adornos y textos más directos, sin primera persona.
- Presentación inicial reducida a la W, el nombre de la app y un paso para tu perfil.
- El botón + se integra en el dock en lugar de flotar sobre él.

**Pantalla de carga más simple**
- Solo la **silueta de la W**: se traza de un solo gesto y se ilumina. Sin gráfica, sin puntos y sin rótulo.

**Icono**
- La W en blanco con un brillo suave sobre negro, en la web, en Android y en el icono adaptable.

**Rendimiento** (móvil de gama media simulado, 120 tareas): primer render 303 ms (antes 329); completar una tarea sigue en 41 ms.

## Novedades de la 4.3

**Diseño propio, minimalista y con profundidad**
- Se mantiene la estructura limpia de la 4.2, pero con identidad WHIDER en lugar de copiar a Apple: tipografía **Manrope**, fondo de tinta oscura con un leve tono azulado, tarjetas con **sombras suaves**, brillo moderado en los elementos de acento y transiciones cortas.
- Controles propios: interruptores, pestañas segmentadas, diálogos con botones, menús y avisos rediseñados; prioridad en el color del círculo de cada tarea.
- Paleta propia de 12 colores (iris por defecto) e icono de la app con el punto en el color de la marca.

**Pantalla de carga**
- Al abrir la app, la **W del logotipo se dibuja como una gráfica**: líneas de fondo, la línea que pasa por cada punto, el relleno y el último punto que se ilumina con tu color. Dura menos de dos segundos y se puede saltar tocándola.

**Más fácil de usar**
- **Ajustes siempre a mano**: el engranaje está en la barra superior de todas las pantallas (y en el Perfil).
- **Botón + central** en el dock con **creación rápida en lenguaje natural** y «Más detalles» para abrir el editor completo.
- El editor guarda con un botón grande abajo y elige la prioridad con botones visuales.

**Calendario mucho más completo**
- Vistas de **Mes**, **Semana por horas** y **Agenda**; repeticiones previstas, filtro por lista, ocultar completadas, añadir directamente a un día, tocar un hueco para crear a esa hora y **arrastrar una tarea para cambiar su hora**.

**Adiós definitivo a las tareas de ejemplo**
- Se eliminan todas las tareas de ejemplo de cualquier versión anterior aunque estén completadas, repetidas, sin su marca o copiadas en la nube, y el borrado se sube a tu cuenta. Las tareas que escribes tú nunca se tocan.

**Rendimiento** (móvil de gama media simulado, 120 tareas): primer render 329 ms (antes 368) y completar una tarea 41 ms (antes 52).

## Novedades de la 4.2

**Diseño sobrio, al estilo de Apple**
- Fondo negro, celdas agrupadas con separadores finos, títulos grandes y una barra de pestañas fija. Sin degradados, brillos, confeti ni ondas al pulsar.
- Un único color de acento (azul por defecto) y 12 colores del sistema para elegir; interruptores, controles segmentados, menús y alertas como los del iPhone.
- Tipografía Inter (la más parecida a la del sistema de Apple), 110 KB más ligera que las dos fuentes anteriores.
- Interfaz silenciosa: los toques ya no vibran ni suenan; solo hay una respuesta suave al completar una tarea y en los avisos.
- Icono nuevo de la app en grafito, blanco y azul.

**Todo mejor organizado**
- Cinco pestañas: **Hoy, Tareas, Calendario, Enfoque y Resumen**. Tu foto abre **Ajustes**, con una página por apartado.
- **Tareas** al estilo de Recordatorios: listas inteligentes (Hoy, Programadas, Todas, Prioritarias) y tus listas, cada una con su página, su color y su menú (ordenar, borrar completadas, editar o eliminar la lista).
- Lo vencido vive ahora en **Hoy** (con *Posponer*) y la pestaña muestra cuántas tareas hay vencidas; desaparece la pantalla aparte de avisos.
- Editor de tareas por apartados: fecha con calendario integrado, hora, aviso, recordatorio, repetición, lista, prioridad y subtareas. Pregunta antes de descartar cambios.
- Las opciones cortas se eligen en menús junto al botón, en lugar de abrir hojas una tras otra.

**Sin tareas de ejemplo**
- Se eliminan las tareas de ejemplo que quedaban de versiones anteriores, también sus repeticiones y las copias guardadas en la nube (se respetan las que hubieras cambiado y convertido en tuyas).

**Igual de rápida**
- Medido en un móvil de gama media simulado (120 tareas): primer render 368 ms (antes 385 ms), completar una tarea 52 ms y abrir la lista «Todas» 49 ms (antes 73 ms).

## Novedades de la 4.1

**Más rápida**
- Firebase se carga en segundo plano después de mostrar la app y pesa 3 veces menos (Firestore "lite": 631 KB → 203 KB).
- Solo se guarda lo que cambia, y en Android la copia nativa se escribe agrupada y sin bloquear (antes, cada toque escribía 8 veces en disco).
- Sin efectos caros: fuera el desenfoque en tiempo real, el grano animado y las sombras grandes. Transiciones más cortas.
- Medido en un móvil de gama media simulado: completar una tarea pasa de 205 ms a 89 ms y abrir Tareas de 191 ms a 83 ms.

**Más tranquila y ordenada**
- Barra superior con solo dos botones (tu foto y los avisos). Ajustes y Marcas viven dentro del Perfil.
- Inicio con lo esencial: tu progreso de hoy y la lista de hoy.
- Tareas en tres pestañas (Hoy · Próximas · Todas), con la búsqueda y las opciones en un único menú.
- Tarjetas de tarea con una línea de texto discreta en lugar de "pastillas"; editor con los detalles en filas.
- Avisos con una sola acción (Posponer); un único aviso flotante aunque venzan varias tareas.
- Ajustes en apartados; la app empieza limpia, sin tareas de ejemplo.

**Perfil con foto**
- Foto de perfil desde la galería (selector de fotos de Android, sin permisos), recortada y comprimida (~25 KB) y sincronizada con tu cuenta. Con Google se usa tu foto de Google si no eliges otra.

**Correcciones**
- Google en Android: los fallos de configuración (huella SHA‑1 o paquete no registrados) ya no se quedan en silencio; la app explica qué revisar y muestra el detalle técnico.
- El nombre ya no se sobrescribe con el de Google al entrar desde otro dispositivo, y la presentación inicial no se repite.
- El historial y las marcas se reparan solos si llegan datos incompletos de versiones anteriores.

## Novedades de la 4.0

- Cuentas de usuario con correo y contraseña (verificación y recuperación) y con Google.
- Copia en la nube con sincronización automática entre dispositivos y funcionamiento sin conexión.
- Registro de marcas: récords automáticos con historial permanente y marcas personales con su evolución.
- Android: la app se sirve desde un origen seguro local, con espejo nativo de los datos y migración automática desde la versión anterior.

## Novedades de la 3.0

- Rediseño completo: tema oscuro único y coherente, acentos configurables, fondo animado, transiciones entre pantallas, efectos al pulsar, animación al completar y confeti.
- Iconos propios en SVG y nuevo logotipo (una W cuyo último trazo sube como un ✓).
- Nuevas pantallas: Enfoque, Progreso (con logros y mapa de constancia) y presentación inicial.
- Nuevas funciones: listas, subtareas, notas, repeticiones, recordatorios previos, horas de silencio, búsqueda, orden, gestos con deshacer y decenas de ajustes.
- Android: recordatorios con la app cerrada, vibración nativa, tamaño de texto estable e iconos adaptables.
- Eliminado: copia de seguridad/exportación, descargas e instalación de APK desde la app y la marca "PRO".
