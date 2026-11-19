# Costes y sostenibilidad de la nube

WHIDER usa Firebase (Authentication y Cloud Firestore). La app funciona sin cuenta y sin red; la nube
solo guarda la copia y sincroniza dispositivos. Este documento estima cuánto gasta cada persona y qué
se ha hecho en la 1.1 y después (escuchas en tiempo real) para que el proyecto siga siendo gratuito el mayor tiempo
posible.

## Límites que importan

| Plan | Lecturas | Escrituras | Borrados | Almacenamiento |
| --- | --- | --- | --- | --- |
| Spark (gratis) | 50.000 / día | 20.000 / día | 20.000 / día | 1 GiB |
| Blaze (pago por uso, a partir de lo gratuito) | ~0,03 € / 100.000 | ~0,09 € / 100.000 | ~0,01 € / 100.000 | ~0,15 € / GiB·mes |

Precios orientativos de la región europea; consulta la página de precios de Firebase antes de decidir.

## Desde la 1.2: escuchas en tiempo real

La app ya no consulta la nube cada pocos segundos: **escucha** los documentos que le importan (`js/core/live.js`) y
Firestore le manda cada cambio. Escuchar cuesta **una lectura por documento al empezar y una por cada documento que
cambia** (también cuando lo cambias tú: tu cambio vuelve a la escucha). Si nada cambia, no cuesta nada.

| Qué se escucha | Cuándo |
| --- | --- |
| `users/{uid}/state/app` y `state/notes` (tareas, hábitos, ajustes, apuntes) | Siempre, con sesión iniciada |
| El índice del Cuaderno: `users/{uid}/state/pages` y `spaces/{id}` de cada equipo | Siempre; solo se sincroniza el ámbito que cambia |
| Tu buzón `inbox/{uid}` | Con la comunidad activada |
| La lista de tus chats (`chats` donde estás) | Con sesión iniciada |
| Los mensajes del chat abierto (desde 2 min antes del último que ya tienes) | Con ese chat abierto en Chats |

- **En segundo plano** más de 2 minutos (el navegador o el móvil con otra app delante) se deja de escuchar: no se
  gastan lecturas con lo que cambian otros dispositivos. Al volver, cada escucha vuelve a costar una lectura por
  documento y trae lo último. En el ordenador, con la ventana cerrada a la bandeja, WHIDER no pasa a segundo plano:
  sigue escuchando (y avisando).
- **Sin escuchas** (sin conexión, un fallo o `live: false` en `js/config.js`), cada parte vuelve a consultar como en la
  1.1 (tabla de abajo) hasta que la escucha vuelve a estar al día.
- **Subir tus cambios cuesta lo mismo que antes**: cada subida es una transacción que lee los dos documentos y escribe
  1-2.
- Los perfiles de tus contactos se refrescan cada minuto **solo con Personas abierta** (antes, en cualquier pantalla), y
  los avisos de mensajes que llegan al buzón no se leen mientras se escucha la lista de chats (ya trae cada mensaje).

### Estimación: un ordenador con WHIDER abierto 8 horas (1 hora de uso real)

Lecturas solo por estar al día (sin las de subir tus cambios, que son las mismas). Suposiciones: 30 subidas propias, 20
cambios hechos en el móvil, 10 guardados en el Cuaderno, 3 contactos (Personas abierta 5 minutos), 5 chats con 30
mensajes recibidos y 20 enviados.

| | 1.1 (consultando) | 1.2 (escuchando) |
| --- | --- | --- |
| Tareas, hábitos, ajustes y apuntes | ~650 | ~60 (2 al empezar + 1 por cambio, tuyo o del móvil, y por cada chat leído) |
| Cuaderno | ~450 | ~15 (1 por ámbito al empezar + 1 por guardado) |
| Buzón de Personas | ~500 | ~35 (1 al empezar + 1 por aviso de mensaje + 3 por solicitud o ánimo) |
| Perfiles de 3 contactos | ~450 * | ~20 (al empezar y cada minuto con Personas abierta) |
| Lista de 5 chats | ~1.200 * (los 5 cada 2 min) | ~55 (5 al empezar + 1 por mensaje enviado o recibido) |
| **Total** | **~3.250** | **~185 (-94 %)** |

\* La estimación que se hizo para la 1.1 (más abajo) no contaba la lista de chats ni los perfiles.

Sumando las de subir tus cambios (~80 lecturas en este ejemplo), una persona muy activa pasa de unas 3.300 lecturas al
día a unas 270: con el plan gratuito, de unas **15** personas así al día a unas **185**. Con uso normal en el móvil, muchas
más.

El paquete de Firebase crece de 75 a 157 KB comprimido (el Firestore completo, sin `re2js`, que solo usan las
consultas «pipeline»); se carga después de mostrar la app, como antes.

## De dónde salen las lecturas (1.1)

| Qué | Hasta la 1.0 | Desde la 1.1 |
| --- | --- | --- |
| Tareas, hábitos y ajustes (`state/app` + `state/notes`) | 2 lecturas cada 15 s con la app a la vista | Cada 15 s mientras la usas; cada minuto tras 2 min sin tocarla; cada 5 min tras 15 min |
| Cuaderno (índice y páginas cambiadas) | Cada 15-30 s | Igual mientras la usas; luego como las tareas |
| Personas (buzón) | Cada 7-30 s | Igual mientras la usas; luego como las tareas |
| Chat abierto | Cada 3 s | Igual (solo con un chat abierto y a la vista) |

### Estimación de la 1.1: un ordenador con WHIDER abierto 8 horas (1 hora de uso real)

| | 1.0 | 1.1 |
| --- | --- | --- |
| Tareas | ~3.800 lecturas | ~650 |
| Cuaderno | ~1.400 | ~450 |
| Personas | ~1.500 | ~500 |
| **Total** | **~6.700 lecturas/día** | **~1.600 lecturas/día (-75 %)** |

Con el plan gratuito, eso pasa de unas **7** a unas **30** personas muy activas al día; con uso normal
en el móvil (la app solo está a la vista unos minutos), muchas más.

Las escrituras dependen de lo que se cambia: cada cambio local supone 1-2 escrituras (tareas y, si
cambiaron, apuntes) y cada página editada 1-2 más. Una persona típica: 50-150 escrituras al día.

## Otras medidas de la 1.1

- **Tamaño**: Firestore no admite documentos de más de 1 MiB. La app mide la copia antes de escribirla,
  avisa a partir de 700 KB y archiva sola las tareas completadas hace más de un año (en
  `users/{uid}/archive/{AAAA-MM-n}`), sin tocar las estadísticas. Ajustes → Datos enseña el espacio usado.
- **Reintentos** espaciados (2 s, 4 s, 8 s… hasta 5 min) en lugar de repetir sin control.
- **Archivos adjuntos**: siguen troceados en Firestore (sin coste de Storage). Firebase Storage está preparado y
  probado (con el emulador) detrás de `storage: true` en `js/config.js`: cada archivo, una lectura en lugar de una por
  trozo de 600 KB, y ≈ 0,026 $/GB al mes frente a ≈ 0,18 $/GB en Firestore. Necesita el plan Blaze; pasos en
  [CONFIGURAR-CUENTAS.md](CONFIGURAR-CUENTAS.md).

## Recomendaciones (necesitan la consola de Google Cloud o Firebase)

1. **Alertas de presupuesto**: Google Cloud → Facturación → Presupuestos y alertas → un presupuesto de
   5 € al mes con avisos al 50 %, 90 % y 100 % (solo existe en el plan Blaze).
2. **App Check** (reCAPTCHA Enterprise en la web, Play Integrity en Android) para que nadie pueda gastar
   lecturas con scripts en nombre de la app (preparado en la app; se activa en la consola).
3. **Panel de uso**: Firebase → Firestore → Uso, para comparar con estas estimaciones.
4. ~~**Siguiente paso de ahorro**: cambiar el sondeo por escuchas en tiempo real~~ Hecho después de la 1.1 (arriba).
   Lo siguiente sería juntar en un solo documento lo que hoy se escucha por separado, pero con estas cifras no compensa.
