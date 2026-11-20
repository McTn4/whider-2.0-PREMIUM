# 0003 · Idiomas: el inglés empieza por la web; la app, cuando pueda estar entera

- **Estado**: aceptada (1.1). Hecha la parte de la web; la de la app, en curso (ver «Avance» al final).
- **Fecha**: noviembre de 2026

## Contexto

Se pidió preparar WHIDER para otros idiomas, empezando por el inglés. Medido en la 1.1:

- **La app**: unos **1.660 textos distintos** (≈ 50.000 caracteres, 2.140 apariciones) repartidos en 65 archivos de
  `js/`. Los que más: Ajustes (220), Cuaderno y sus bases de datos (≈ 300 entre `notes.js`, `dbview.js`, `pages.js` y
  los bloques), automatizaciones (137), hábitos, calendario, comunidad y chats, informes y estadísticas.
- **Lo que no es solo traducir**:
  - El intérprete de lenguaje natural de «Nueva tarea» (`js/core/parse.js`) entiende español: «mañana a las 10»,
    «cada lunes», «el día 1». En inglés hace falta otra gramática, no una traducción.
  - Las fechas se escriben con nombres de meses y días propios (`js/core/util.js`), no con `Intl`.
  - Frases construidas por partes («Tienes » + n + « tareas»), con plurales y concordancias.
  - Las notas de cada versión (CHANGELOG), las preguntas frecuentes, las plantillas del Cuaderno, las frases del
    personaje, los menús de la app de escritorio (Electron), los textos nativos de Android (avisos, widget) y la
    ficha de Google Play.
- **La web**: la portada (un solo HTML) y la política de privacidad.

## Decisión

1. **La web, en inglés ya (1.1)**: portada en `/en/` y política de privacidad en `/privacy/`, completas, enlazadas
   entre sí y con `hreflang` para los buscadores. La portada en inglés dice claramente que la app de momento está en
   español. Las novedades de la portada en español salen solas del CHANGELOG (`tools/version.js`); las de la inglesa
   se traducen a mano en cada versión menor, y `npm run version:check` falla si son de otra versión.
2. **La app no se publica traducida a medias.** Una interfaz con pantallas en inglés y otras en español es peor que
   una entera en español. El idioma aparecerá en Ajustes cuando el inglés cubra toda la app.
3. **Cómo se hará en la app** (para que lo que se haga antes no haya que deshacerlo):
   - `W.t('Texto en español', { n: 3 })`: el propio texto en español es la clave (no hay identificadores que
     mantener y el español sigue siendo el original); `W.tn(n, 'una tarea', '{n} tareas')` para los plurales.
   - Catálogos por idioma (`js/i18n/en.js`), que solo se cargan si se usa ese idioma; `<html lang>` y `Intl`
     (`DateTimeFormat`, `NumberFormat`, `PluralRules`) para fechas, números y plurales.
   - Una gramática en inglés para «Nueva tarea» («tomorrow at 10», «every Monday»), aparte de la española.
   - Un script que liste los textos sin traducir; la integración continua fallará si el inglés está activado y falta
     alguno.
   - Menús de Electron y textos nativos de Android (`values-en/strings.xml`) con el idioma del sistema.
4. **Orden**: navegación, Hoy, Tareas, «Nueva tarea» y Ajustes; después Calendario, Hábitos y Enfoque; después el
   Cuaderno; por último comunidad, automatizaciones e informes. Del orden de **dos semanas** de trabajo, con pruebas.

## Consecuencias

- Quien llega desde un país de habla inglesa entiende qué es WHIDER, cómo se descarga y cómo trata sus datos, y sabe
  antes de instalarla que la app está en español.
- La política de privacidad tiene una traducción fiel; si alguna vez difieren, prevalece la española (lo dice la
  propia página).
- Mientras no se haga lo de la app, los textos nuevos se siguen escribiendo en español; cuando empiece, se envuelven
  en `W.t()` según se toque cada pantalla.

## Avance de la app en inglés

Se prueba abriendo la app con `?lang=en` (`?lang=es` para volver); no aparece en Ajustes hasta que esté entera.

- **Hecho**: la base (`js/core/i18n.js`: `W.t`, `W.tn`, `U.plural` traducible, fechas y horas en inglés en
  `js/core/util.js`, `U.inline` para las fechas a mitad de frase), el catálogo `js/i18n/en.js`, la gramática inglesa
  de «Nueva tarea» (`js/core/parse.js`), la herramienta `tools/i18n.js` y la prueba `tests/e2e/ingles.js`, que
  recorre en inglés las pantallas y las hojas ya traducidas, en el ordenador y en el móvil, y falla si queda algo en
  español o sin traducir. Hoy cubre: Hoy (con la barra lateral, la inferior, el personaje, los hábitos de hoy, los
  primeros pasos y las novedades), Tareas (filtros, selección, paleta de órdenes), Calendario (mes, semana, día y
  agenda), Enfoque, «Más», Perfil con Actividad y Marcas, Estadísticas, Informes, la presentación inicial, Ajustes
  con todas sus páginas y el texto de privacidad, la ayuda y los comentarios, los atajos de teclado, el importador,
  las plantillas, los dispositivos, el perfil, las actualizaciones, la instalación, las copias, los avisos y el
  editor de tareas.
- **Fechas**: lo que antes se componía a mano en español (semanas, periodos, «16 de noviembre») sale de
  `js/core/util.js` (`fmtRange`, `fmtSpan`, `fmtDate`, `fmtDayMonth`, `fmtDayMon`, `fmtLongYear`, `fmtHour`), que
  en español da lo mismo que antes. Las frases con un enlace o una negrita dentro usan `W.tp`.
- **Atajos**: en inglés, la vista de semana del calendario va con la W (la S sigue funcionando).
- **Ajuste respecto a lo previsto**: algunos módulos preparan sus textos al cargarse (la barra lateral, por ejemplo),
  así que el catálogo no puede llegar después. En inglés, `i18n.js` escribe la etiqueta del catálogo justo detrás de
  sí misma y se carga antes que el resto; en español no se descarga nada. Por eso la web compilada deja `i18n.js`
  fuera del paquete, como `config.js`.
- **Notas de versión**: en inglés solo salen las versiones con sus notas traducidas en el catálogo (la clave es el
  texto del CHANGELOG): las de la versión que traiga el inglés, en adelante.
- **Cómo seguir con cada pantalla**: `node tools/i18n.js envolver <archivo>` envuelve los textos de las posiciones
  seguras; `node tools/i18n.js pendientes <archivo>` lista lo que queda a mano (frases por partes, textos devueltos
  por funciones); `node tools/i18n.js datos <archivo> <VARIABLE>` envuelve los textos de una tabla (preguntas
  frecuentes, plantillas…); `node tools/i18n.js faltan` da lo que falta en el catálogo; se añade la pantalla a
  `PANTALLAS` (o la hoja a `HOJAS`) en `tests/e2e/ingles.js`.
- **Falta**: Cuaderno (páginas, bloques, bases de datos, archivos y plantillas), Personas y chats,
  automatizaciones y la pantalla de inicio de sesión; después, los menús de la app de escritorio y los textos
  nativos de Android, y por último la opción de idioma en Ajustes.

