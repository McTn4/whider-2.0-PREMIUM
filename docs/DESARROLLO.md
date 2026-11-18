# Desarrollar WHIDER

Guía para instalar, ejecutar, probar y compilar WHIDER desde cero. Todo lo que se describe aquí se
puede hacer en Windows, macOS o Linux; los comandos se escriben en una terminal abierta en la carpeta
del repositorio.

## 1. Qué necesitas

| Herramienta | Versión | Para qué |
| --- | --- | --- |
| [Node.js](https://nodejs.org) | 22 (mínimo 20) | Comprobaciones, pruebas, web y app de escritorio |
| [Python](https://www.python.org) | 3.10 o superior | Servidor de desarrollo (`serve.py`) y utilidades |
| Git | cualquiera reciente | Descargar el código |
| Java (JDK) | 21 | Solo para los emuladores de Firebase (`npm run test:nube`) |
| Android Studio / JDK 17 | — | Solo para compilar el APK |

## 2. Primera vez

```bash
git clone https://github.com/McTn4/whider-2.0-PREMIUM.git
cd whider-2.0-PREMIUM
npm ci
npx playwright install chromium
```

`npm ci` instala las herramientas de desarrollo (ESLint, Prettier, TypeScript, Playwright, axe-core y las
herramientas de Firebase) con las versiones exactas de `package-lock.json`. La app en sí no necesita
compilarse: son archivos HTML, CSS y JavaScript que el navegador carga tal cual.

## 3. Ejecutar la app

```bash
npm run dev
```

Abre `http://localhost:8080`: la app está en `/` y en `/app`, y la portada de la web en `/sitio/`. La
consola enseña también la dirección para abrirla desde el móvil en la misma red Wi‑Fi. Sin configuración
de Firebase la app funciona con los datos guardados en el propio dispositivo; para las cuentas, mira
[CONFIGURAR-CUENTAS.md](CONFIGURAR-CUENTAS.md).

### La web tal y como se publica

```bash
npm run build:web
npm run serve:web
```

`build:web` deja en `dist/` lo mismo que publica Vercel (portada en `/`, app en `/app`) y `serve:web` lo
sirve en `http://127.0.0.1:8650` con las mismas redirecciones de [`vercel.json`](../vercel.json).

### La app de escritorio

```bash
cd desktop
npm ci
npm start
```

`npm start` copia la web a `desktop/www` y abre WHIDER. `npm run dist` crea el instalador de tu sistema en
`desktop/dist`.

### La app de Android

```bash
python package_apk.py --sync
cd android
./gradlew assembleDebug
```

El APK queda en `android/app/build/outputs/apk/debug/app-debug.apk`. Para Google Play, ver
[PUBLICAR-EN-GOOGLE-PLAY.md](PUBLICAR-EN-GOOGLE-PLAY.md).

## 4. Comprobar los cambios

| Comando | Qué hace | Tiempo |
| --- | --- | --- |
| `npm run check` | ESLint, Prettier, TypeScript y pruebas unitarias | segundos |
| `npm test` | Pruebas unitarias y de extremo a extremo de la app y la web | ~10 min |
| `npm run test:nube` | Cuentas, sincronización, comunidad y adjuntos en la nube contra los emuladores de Firebase (necesita Java) | ~5 min |
| `npm run test:escritorio` | La app de escritorio (necesita `npm ci` dentro de `desktop/`) | ~1 min |
| `npm run test:todo` | Todo lo anterior | ~20 min |

Para una prueba suelta: `node tests/run.mjs adjuntos` (`node tests/run.mjs --lista` enseña todas). El
lanzador arranca por su cuenta lo que haga falta (servidor de la app, web compilada, emuladores) o usa lo
que ya esté en marcha, y deja la salida de cada prueba y sus capturas en `tests/e2e/logs/`. Si la app ya
está servida en otra dirección, indícala con `WHIDER_URL` (y `WHIDER_WEB_URL` para la web compilada).

Las mismas comprobaciones se ejecutan en GitHub con cada cambio (pestaña **Actions → Comprobaciones**). Si
algo falla, los registros y las capturas quedan como artefacto de esa ejecución.

### Qué hay en `tests/`

- `tests/unit/`: lógica sin navegador con `node --test` (fechas, lectura de lenguaje natural, tareas
  repetidas, fusión de la sincronización, detección del dispositivo para las descargas). `_cargar.js` carga
  los scripts de la app en un contexto aislado con el reloj fijo y una zona horaria con cambio de hora.
- `tests/e2e/`: recorridos reales con Playwright. `_util.js` reúne las direcciones, los archivos de ejemplo
  (se generan en la carpeta temporal del sistema) y la carpeta de capturas.
- `tests/run.mjs`: el lanzador y los grupos (`app`, `nube`, `web`, `escritorio`).

## 5. Cómo está hecho el código

- **Scripts clásicos sin compilación.** Cada archivo de `js/` es una función autoejecutable que cuelga su
  módulo de `window.Whider` (`Whider.State`, `Whider.Sync`, `Whider.Pages`…). El orden de carga es el de
  las etiquetas `<script>` de `index.html`.
- **Datos.** `js/core/store.js` guarda todo en el propio dispositivo y `js/core/sync.js` lo fusiona con la
  copia de la nube (Firestore) cuando hay cuenta. La fusión es una función pura, cubierta por
  `tests/unit/sincronizacion.test.js`.
- **Estilos.** Variables de diseño en `css/tokens.css` (colores, radios, tipografías Onest y Outfit).
- **Iconos.** La colección «Índice» se genera con `python3 tools/iconos/generar.py --escribir` (actualiza
  el sprite de `index.html`) y se revisa con `node tools/iconos/muestrario.js`.
- **Capturas de la web.** `node tools/capturas/portada.js --guardar` rehace las imágenes de `sitio/img/`,
  `node tools/capturas/og.js` la imagen para compartir y `node tools/capturas/recorrido.js` captura todas
  las pantallas para revisar el diseño (las tres necesitan `npm run dev` en el puerto 8642 o `WHIDER_URL`).

## 6. Convenciones

- **Idioma.** La interfaz, los comentarios, la documentación y los mensajes de los commits van en español.
- **Estilo.** ESLint (`eslint.config.mjs`) vigila errores reales; Prettier (`.prettierrc.json`) da formato
  al código nuevo y el anterior se formatea cuando se reescribe (lo que queda fuera está en
  `.prettierignore`). `.editorconfig` fija UTF‑8, LF y dos espacios.
- **Tipos.** TypeScript se adopta poco a poco: un archivo que empieza por `// @ts-check` se comprueba con
  `npm run typecheck`, usando los tipos comunes de `types/whider.d.ts`. Los módulos nuevos nacen con él.
- **Archivos grandes.** Los módulos de más de 1000 líneas (`js/ui/blocks.js`, `js/core/store.js`…) se
  dividen cuando se tocan en profundidad, no de golpe.
- **Pruebas.** Un fallo corregido o una función nueva llevan su prueba (unitaria si es lógica, de extremo
  a extremo si es un recorrido). Nunca se desactiva una prueba para que pase.
- **Commits.** Un cambio por commit, con un título que diga qué cambia para quien usa la app.
- **Secretos.** El repositorio es público: ninguna clave, contraseña ni código de activación se escribe en
  él. Las claves de firma y los secretos de servidor van en los secretos de GitHub o de Vercel.

## 7. Publicar

| Qué | Cuándo | Dónde |
| --- | --- | --- |
| Web (portada y app) | Cada cambio en `main` | Vercel |
| Comprobaciones | Cada cambio y cada pull request | GitHub Actions → Comprobaciones |
| App de escritorio, APK y AAB de prueba | Cambios en la app, en `desktop/` o en `android/` | Artefactos de Actions (Compilar app de escritorio, Compilar APK) |
| **Una versión** (todos los instaladores, con sus notas) | Al cambiar la versión de `package.json` | Releases → `vX.Y.Z` (flujo «Publicar versión») |

La versión es una sola, la de `package.json`: `node tools/version.js 1.2.0` la cambia en la app de escritorio, en
Android (con su `versionCode`) y en la app; `npm run version:check` comprueba que todo coincide y que
[`CHANGELOG.md`](../CHANGELOG.md) tiene su entrada. Paso a paso: [PUBLICAR-UNA-VERSION.md](PUBLICAR-UNA-VERSION.md).
Los recursos de la ficha de Google Play se regeneran con `node tools/capturas/play.js` ([docs/play/](play/FICHA.md)).

## 8. Problemas frecuentes

- **«no responde en el puerto 8642»**: otro programa usa ese puerto. Ciérralo o arranca la app en otro y
  pasa su dirección: `WHIDER_URL=http://127.0.0.1:9000 node tests/run.mjs app`.
- **Los emuladores no arrancan**: falta Java 21 (`java -version`).
- **La app de escritorio no abre en Linux sin escritorio**: el lanzador usa `xvfb-run` si no hay pantalla;
  instálalo con el paquete `xvfb` de tu distribución.
- **Capturas distintas entre máquinas**: las fuentes van dentro del repositorio, pero el suavizado del
  texto cambia según el sistema; las pruebas comprueban el comportamiento, no los píxeles.
