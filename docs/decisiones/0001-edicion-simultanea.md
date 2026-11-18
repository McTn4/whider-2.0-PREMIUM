# 0001 · Edición simultánea: fusión por campo y por bloque, sin Yjs por ahora

- **Estado**: aceptada (1.1)
- **Fecha**: noviembre de 2026

## Contexto

WHIDER guarda todo primero en el dispositivo y lo sincroniza con Firestore mediante transacciones que
leen la versión de la nube, la fusionan con la local y escriben el resultado. Hasta la 1.0, si dos
dispositivos (o dos personas de un equipo) cambiaban a la vez **la misma tarea** o **el mismo bloque**
de una página, ganaba la versión más reciente y la otra se perdía sin aviso.

Se pidió evaluar Yjs u otro CRDT y, en cualquier caso, que no haya sobrescrituras silenciosas.

## Opciones

| | Yjs (CRDT) | Automerge | Fusión por campo y por bloque (elegida) |
| --- | --- | --- | --- |
| Qué conserva | Cada carácter de cada persona | Igual que Yjs | Cada campo de una tarea; en un bloque editado a la vez, las dos versiones |
| Cambios en la app | Reescribir el editor de bloques (`js/ui/blocks.js`, ~1.700 líneas) sobre `Y.Text`, un proveedor para Firestore y compactar el historial | Igual, con WebAssembly | Pequeños: `store.js`, `sync.js` y `pagesync.js` |
| Tamaño | +70 KB (Yjs) + proveedor | +600 KB (wasm) | 0 |
| Coste en Firestore | Más escrituras (cada pausa al escribir) y un historial que crece | Igual | El mismo que ahora |
| Tiempo real | Necesita escuchas (SDK completo de Firestore, +130 KB) | Igual | Funciona con el sondeo actual |
| Riesgo | Alto: migrar todo el contenido existente | Alto | Bajo, con pruebas unitarias y de extremo a extremo |

## Decisión

1. **Tareas**: cada campo editado guarda su hora (`ft`). Al fusionar, gana la versión más reciente,
   pero se respetan los campos que la otra cambió después. Un dispositivo cambia la fecha y otro la
   completa: se conservan las dos cosas. Las horas se guardan 30 días.
2. **Páginas del Cuaderno**: se sigue fusionando bloque a bloque. Si el mismo bloque se editó en los
   dos lados después de la última vez que este dispositivo vio la página en la nube, se queda el más
   reciente y, justo debajo, una nota («Otra versión…») con la otra. Su identificador es fijo, así que
   si los dos dispositivos la crean es la misma nota.
3. **Yjs queda para más adelante**, junto con el paso al SDK completo de Firestore con escuchas en
   tiempo real, si la edición en vivo por varias personas pasa a ser algo central (equipos grandes).

## Consecuencias

- No se pierde trabajo en silencio; en el peor caso hay que elegir entre dos versiones de un párrafo.
- Las versiones anteriores de la app no conocen `ft`: si editan una tarea, esa tarea vuelve a fusionarse
  como antes (gana la más reciente).
- La detección depende de los relojes de los dispositivos; con desfases de minutos puede no verse un
  choque (como antes, ganaría la más reciente).
- Pruebas: `tests/unit/sincronizacion.test.js`, `tests/unit/cuaderno.test.js` y
  `tests/e2e/sincronizacion.js` (dos dispositivos contra los emuladores).
