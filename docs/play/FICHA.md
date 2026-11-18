# Ficha de WHIDER en Google Play

Textos e imágenes listos para **Play Console → Crecimiento → Presencia en Play Store → Ficha principal**.
Todo lo que dice la descripción existe en la app (no se anuncian funciones que no tiene). Las imágenes se regeneran
con la app de verdad y datos de ejemplo, sin nombres de personas: `node tools/capturas/play.js` (con
`python3 serve.py 8642` en marcha).

## Textos (español de España)

**Nombre de la app** (30 caracteres como máximo):

```text
WHIDER: tareas y calendario
```

**Descripción breve** (80 como máximo):

```text
Tareas, calendario, hábitos, enfoque y notas. Gratis, sin anuncios.
```

**Descripción completa** (4000 como máximo):

```text
WHIDER ordena tu día en un solo sitio: tus tareas, tu calendario, tus hábitos, tu tiempo de enfoque y un Cuaderno para todo lo demás. Gratis, sin anuncios y en todos tus dispositivos.

TAREAS QUE SE ESCRIBEN SOLAS
• Escribe «Llamar a Ana mañana a las 10» y WHIDER entiende el día y la hora.
• Prioridad urgente o importante, categorías con color, subtareas, repeticiones y avisos.
• Hoy por estados: lo más importante, en curso, vencidas, pendientes y hechas.
• Elige hasta tres tareas como lo más importante del día.

CALENDARIO
• Mes, semana por horas, día y agenda, con tus tareas y sus repeticiones.

CUADERNO
• Páginas con títulos, listas, casillas, tablas, bases de datos, imágenes y archivos adjuntos.
• Plantillas para proyectos, reuniones y más.

HÁBITOS Y ENFOQUE
• Hábitos diarios con su racha.
• Temporizador de enfoque para trabajar sin interrupciones.
• Estadísticas e informes de tu semana, tu mes y tu año.

CON OTRAS PERSONAS
• Contactos, equipos con su Cuaderno compartido y chats.
• Bloquear y denunciar, si alguien no se porta bien.

TRAE TUS TAREAS
• Importa desde Todoist, Google Tasks, Notion, calendarios (.ics) o cualquier CSV, con vista previa.
• Comparte texto o enlaces con WHIDER desde otras apps para convertirlos en tareas.

EN TODOS TUS DISPOSITIVOS
• Con tu cuenta, todo se sincroniza entre el móvil, el navegador y el ordenador (Windows, macOS y Linux).
• Si cambias cosas distintas de una tarea en dos dispositivos a la vez, se conservan las dos.
• Sin cuenta, todo se queda en tu teléfono. También funciona sin conexión.
• Widget «Hoy» para la pantalla de inicio y avisos a la hora exacta (opcional).

PRIVACIDAD
• Sin anuncios, sin seguimiento y sin vender datos.
• Tus tareas y tu Cuaderno solo los ves tú.
• Puedes eliminar tu cuenta y todos tus datos desde la app o desde la web.
```

**Categoría**: Productividad · **Etiquetas**: Lista de tareas, Calendario, Notas, Hábitos, Productividad.

**Datos de contacto**: el correo de contacto del desarrollador (el que indique la política de privacidad) y el
sitio web `https://whider-red.vercel.app`.

## Imágenes

| Qué pide Play | Archivo | Tamaño |
| --- | --- | --- |
| Icono (512 × 512, PNG) | [`icons/icon-512.png`](../../icons/icon-512.png) | 512 × 512 |
| Gráfico de funciones (1024 × 500, sin transparencia) | [`grafico-de-funciones.jpg`](grafico-de-funciones.jpg) | 1024 × 500 |
| Capturas del teléfono (de 2 a 8; lado largo ≤ 2 × lado corto) | [`captura-1-hoy.jpg`](captura-1-hoy.jpg) … [`captura-6-enfoque.jpg`](captura-6-enfoque.jpg) | 1080 × 1920 |

Orden recomendado de las capturas: Hoy, Tareas, Calendario, Cuaderno, Hábitos y Enfoque.

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
