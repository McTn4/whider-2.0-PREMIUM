# Ficha de WHIDER en Google Play

Textos e imágenes listos para **Play Console → Crecimiento → Presencia en Play Store → Ficha principal**, en español
(el idioma principal) y en inglés (una traducción de la ficha, con sus propias imágenes). Todo lo que dice la
descripción existe en la app (no se anuncian funciones que no tiene). Las imágenes se regeneran con la app de verdad y
datos de ejemplo, sin nombres de personas: `node tools/capturas/play.js` (con `python3 serve.py 8642` en marcha).

## Textos (español de España)

**Nombre de la app** (30 caracteres como máximo):

```text
WHIDER: tareas y calendario
```

**Descripción breve** (80 como máximo):

```text
Tareas por importancia, las de cada día, calendario y notas. Sin anuncios.
```

**Descripción completa** (4000 como máximo):

```text
WHIDER ordena tu día en un solo sitio: lo que tienes que hacer hoy, de lo más importante a lo menos, las tareas de cada día, tu calendario y un Cuaderno para tus notas. Gratis, sin anuncios y en todos tus dispositivos.

NADA MÁS ABRIR, LO QUE TOCA HOY
• Arriba, un campo para añadir una tarea con su importancia: urgente, importante o destacada.
• «Cada día»: lo que repites a diario o algunos días de la semana, con cuántas llevas hechas.
• «Por hacer»: las de hoy y las que se te pasaron, de lo más importante a lo menos.

TAREAS QUE SE ESCRIBEN SOLAS
• Escribe «Llamar a Ana mañana a las 10» y WHIDER entiende el día y la hora.
• Categorías con color, subtareas, repeticiones (también días sueltos de la semana) y avisos.
• Las tareas de cada día salen en Inicio y tienen su lista en Tareas.

CALENDARIO
• Mes, semana por horas y agenda, con tus tareas y sus repeticiones.
• Toca un día o una hora y escribe la tarea ahí mismo.

CUADERNO
• Páginas con títulos, listas, casillas, tablas, bases de datos, imágenes y archivos adjuntos.
• Plantillas para proyectos, reuniones y más.

SOLO LO TUYO
• Empieza vacía: sin tareas ni categorías de ejemplo. Creas las categorías que quieras, si las quieres.
• Si no la usas con nadie, Personas ni aparece.

CON OTRAS PERSONAS
• Contactos, equipos con su Cuaderno compartido y chats.
• Bloquear y denunciar, si alguien no se porta bien.

TRAE TUS TAREAS
• Importa desde Todoist, Google Tasks, Notion, calendarios (.ics) o cualquier CSV, con vista previa.
• Comparte texto o enlaces con WHIDER desde otras apps para convertirlos en tareas.

EN TODOS TUS DISPOSITIVOS
• Entras con tu cuenta de Google, Microsoft o Apple y todo se sincroniza entre el móvil, el navegador y el ordenador
  (Windows, macOS y Linux).
• Si cambias cosas distintas de una tarea en dos dispositivos a la vez, se conservan las dos.
• También funciona sin conexión.
• Widget «Hoy» para la pantalla de inicio y avisos a la hora exacta (opcional).

PRIVACIDAD
• Sin anuncios, sin seguimiento y sin vender datos.
• Tus tareas y tu Cuaderno solo los ves tú.
• Puedes eliminar tu cuenta y todos tus datos desde la app o desde la web.
```

**Categoría**: Productividad · **Etiquetas**: Lista de tareas, Calendario, Notas, Productividad.

**Datos de contacto**: el correo de contacto del desarrollador (el que indique la política de privacidad) y el
sitio web `https://whider-red.vercel.app`.

## Textos en inglés (traducción de la ficha)

En Play Console: **Ficha principal → Gestionar traducciones → Añadir traducción → Inglés (Estados Unidos)**.

**App name**:

```text
WHIDER: tasks and calendar
```

**Short description**:

```text
Tasks by importance, everyday tasks, a calendar and notes. No ads.
```

**Full description**:

```text
WHIDER puts your day in one place: what you need to do today, from most to least important, your everyday tasks, your calendar and a Notebook for your notes. Free, no ads, on all your devices.

WHAT MATTERS TODAY, AS SOON AS YOU OPEN IT
• At the top, a field to add a task with its importance: urgent, important or starred.
• “Every day”: what you repeat daily or on some days of the week, with how many you’ve done.
• “To do”: today’s tasks and the ones you missed, from most to least important.

TASKS THAT WRITE THEMSELVES
• Type “Call Ana tomorrow at 10” and WHIDER understands the day and the time.
• Color-coded categories, subtasks, repeats (including specific days of the week) and reminders.
• Everyday tasks show up on Home and have their own list in Tasks.

CALENDAR
• Month, week by the hour and agenda, with your tasks and their repeats.
• Tap a day or an hour and type the task right there.

NOTEBOOK
• Pages with headings, lists, checkboxes, tables, databases, images and attachments.
• Templates for projects, meetings and more.

JUST YOURS
• It starts empty: no sample tasks or categories. Create the categories you want, if you want them.
• If you don’t use it with anyone, People doesn’t even show up.

WITH OTHER PEOPLE
• Contacts, teams with their shared Notebook, and chats.
• Block and report, if someone misbehaves.

BRING YOUR TASKS
• Import from Todoist, Google Tasks, Notion, calendars (.ics) or any CSV, with a preview.
• Share text or links with WHIDER from other apps to turn them into tasks.

ON ALL YOUR DEVICES
• Sign in with your Google, Microsoft or Apple account and everything syncs between your phone, the browser and your computer (Windows, macOS and Linux).
• If you change different things in a task on two devices at once, both are kept.
• It also works offline.
• “Today” widget for your home screen and reminders at the exact time (optional).

PRIVACY
• No ads, no tracking and no selling your data.
• Only you can see your tasks and your Notebook.
• You can delete your account and all your data from the app or the web.
```

## Imágenes

Las mismas en los dos idiomas: [`es/`](es/) para la ficha principal y [`en/`](en/) para la traducción al inglés
(en «Gestionar traducciones», cada idioma tiene sus propias imágenes). Siguen lo que pide Google Play (JPEG sin
transparencia, 9:16 o 16:9 y al menos 1080 px) y lo que aconseja: sin marcos de teléfono (envejecen pronto y no todo el
mundo tiene ese modelo), solo la app de verdad, y en el gráfico de funciones nada importante cerca de los bordes.

| Qué pide Play | Archivo | Tamaño |
| --- | --- | --- |
| Icono de la app (PNG de 32 bits, hasta 1 MB) | [`icono-512.png`](icono-512.png) (el mismo en los dos idiomas) | 512 × 512 |
| Gráfico de funciones (JPEG o PNG sin transparencia) | [`es/grafico-de-funciones.jpg`](es/grafico-de-funciones.jpg) · [`en/…`](en/grafico-de-funciones.jpg) | 1024 × 500 |
| Capturas del teléfono (de 2 a 8) | `es/telefono-1-inicio.jpg` … `es/telefono-8-dispositivos.jpg` (y en `en/`) | 1080 × 1920 |
| Capturas de tablet de 7 pulgadas | `es/tableta-1-inicio.jpg` … `es/tableta-4-cuaderno.jpg` (y en `en/`) | 2560 × 1440 |
| Capturas de tablet de 10 pulgadas | las mismas de tablet | 2560 × 1440 |

Las capturas del teléfono, en este orden (las tres primeras son las que más se ven en la ficha):

1. **Tu día, por importancia** — Inicio, con «Cada día» y «Por hacer».
2. **Escribe y listo** — una tarea nueva escrita de corrido: entiende el día, la hora, la categoría y la importancia.
3. **Todo en su sitio** — Tareas: vistas automáticas y categorías.
4. **Tu mes, de un vistazo** — el calendario del mes.
5. **Lo de cada día, sin fallar** — las tareas de cada día.
6. **Tus notas, ordenadas** — una página del Cuaderno.
7. **Claro u oscuro** — Inicio con el tema claro.
8. **En todos tus dispositivos** — el ordenador y el móvil, y dónde funciona.

Las de tablet: Inicio, Tareas, la semana del calendario y el Cuaderno, con el diseño de pantalla grande.

## Antes de pulsar «Enviar a revisión»

- [ ] Cuenta de desarrollador creada y verificada (pago único de 25 USD).
- [ ] Secretos de la clave de subida en GitHub; el resumen de «Compilar APK» dice «firmado con tu clave de subida».
- [ ] Prueba cerrada con al menos 12 personas durante 14 días seguidos (cuentas personales nuevas).
- [ ] Contenido de la app: política de privacidad, acceso a la app, anuncios (no), seguridad de los datos,
      clasificación de contenido (interacción entre usuarios: sí, por los chats) y público objetivo (+14).
- [ ] Permiso de alarmas exactas justificado si Play lo pide (recordatorios de tareas a la hora elegida).
- [ ] Ficha con los textos y las imágenes de esta página.
- [ ] Tras la primera subida: huellas SHA-1 (Firebase) y SHA-256 (`.well-known/assetlinks.json`) de la firma de
      Google, y el enlace de la ficha en `play` dentro de `sitio/descargas.js`.

Pasos detallados: [PUBLICAR-EN-GOOGLE-PLAY.md](../PUBLICAR-EN-GOOGLE-PLAY.md).
