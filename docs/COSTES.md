# Costes y sostenibilidad de la nube

WHIDER usa Firebase (Authentication y Cloud Firestore). La app funciona sin cuenta y sin red; la nube
solo guarda la copia y sincroniza dispositivos. Este documento estima cuánto gasta cada persona y qué
se ha hecho en la 1.1 para que el proyecto siga siendo gratuito el mayor tiempo posible.

## Límites que importan

| Plan | Lecturas | Escrituras | Borrados | Almacenamiento |
| --- | --- | --- | --- | --- |
| Spark (gratis) | 50.000 / día | 20.000 / día | 20.000 / día | 1 GiB |
| Blaze (pago por uso, a partir de lo gratuito) | ~0,03 € / 100.000 | ~0,09 € / 100.000 | ~0,01 € / 100.000 | ~0,15 € / GiB·mes |

Precios orientativos de la región europea; consulta la página de precios de Firebase antes de decidir.

## De dónde salen las lecturas

| Qué | Hasta la 1.0 | Desde la 1.1 |
| --- | --- | --- |
| Tareas, hábitos y ajustes (`state/app` + `state/notes`) | 2 lecturas cada 15 s con la app a la vista | Cada 15 s mientras la usas; cada minuto tras 2 min sin tocarla; cada 5 min tras 15 min |
| Cuaderno (índice y páginas cambiadas) | Cada 15-30 s | Igual mientras la usas; luego como las tareas |
| Personas (buzón) | Cada 7-30 s | Igual mientras la usas; luego como las tareas |
| Chat abierto | Cada 3 s | Igual (solo con un chat abierto y a la vista) |

### Estimación: un ordenador con WHIDER abierto 8 horas (1 hora de uso real)

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
4. **Siguiente paso de ahorro**: cambiar el sondeo por escuchas en tiempo real (SDK completo de
   Firestore). Con la app a la vista y sin cambios, el coste sería casi cero (ver
   [decisiones/0001](decisiones/0001-edicion-simultanea.md)).
