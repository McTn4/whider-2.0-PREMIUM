# 0002 · App de escritorio: seguir con Electron (Tauri, evaluado y aplazado)

- **Estado**: aceptada (1.1)
- **Fecha**: noviembre de 2026

## Contexto

La app de escritorio es la app web dentro de Electron 45 (Chromium + Node), servida desde `app://whider`. Pesa
lo que pesa Chromium. Medido en la 1.1:

| Instalador | Tamaño |
| --- | --- |
| Windows (`WHIDER-Setup.exe`) | 121,6 MB |
| Linux AppImage | 124,7 MB (126,3 MB en la 1.0) |
| Linux .deb (nuevo) | 100,3 MB |
| macOS | 224 MB el universal de la 1.0; desde la 1.1, un `.dmg` por arquitectura (Apple Silicon o Intel) |

Se pidió valorar Tauri, que usa el navegador del propio sistema en lugar de llevar uno dentro.

## Opciones

| | Electron (actual) | Tauri 2 |
| --- | --- | --- |
| Motor | Chromium, el mismo en Windows, macOS y Linux | WebView2 (Chromium) en Windows, **WebKit** en macOS (WKWebView) y Linux (WebKitGTK) |
| Instalador | ~100-125 MB | Del orden de 5-15 MB |
| Memoria | Más (un Chromium propio) | Menos (comparte el del sistema) |
| Lo que usa WHIDER | Todo funciona y está probado (3 pruebas de extremo a extremo con Playwright) | Habría que rehacer o sustituir: informe en PDF (`webContents.printToPDF` no existe), notificaciones, bandeja, abrir al iniciar, acceso con Google por el navegador, adjuntos, actualizaciones (con su propio formato y firma) y el protocolo `app://` (cambia el origen: dominios autorizados de Firebase, almacenamiento) |
| Diferencias de aspecto | Ninguna entre sistemas | WebKit no tiene funciones de Chromium que usa el diseño (como `corner-shape`, con alternativa) y en Linux WebKitGTK va por detrás (cámara para escanear QR, rendimiento de los desenfoques) |
| Pruebas automáticas | Playwright controla Electron (las de `tests/e2e/escritorio*.js`) | `tauri-driver` (WebDriver) solo en Windows y Linux; habría que reescribir las pruebas |
| Compilación | Node | Node + Rust en los tres sistemas de la integración continua |
| Esfuerzo | — | Reescribir `desktop/main.js` (~400 líneas), `lib/google.js` y `lib/updates.js`, y validar la app en tres motores distintos: varias semanas |

## Decisión

1. **Seguir con Electron en la 1.x.** El ahorro de descarga de Tauri es real, pero a cambio la app se vería y se
   comportaría distinto en cada sistema, se perderían funciones que hoy funcionan (el informe en PDF) y habría que
   reescribir las pruebas. Para una app que se instala una vez y desde la 1.1 se actualiza sola (y descarga solo lo
   que cambia, gracias a los `.blockmap`), el tamaño pesa menos que la fiabilidad.
2. **Reducir lo que se pueda dentro de Electron** (hecho en la 1.1): un `.dmg` por arquitectura en lugar del universal,
   solo los idiomas que se usan (`electronLanguages`) y el paquete `.deb`, más pequeño que la AppImage.
3. **Volver a valorarlo si**: el tamaño de la descarga se convierte en una queja medida (por ejemplo, abandonos en la
   descarga), Tauri ofrece una salida a PDF y pruebas automáticas en los tres sistemas, o hace falta una versión para
   equipos con muy poca memoria.

## Consecuencias

- La descarga sigue siendo de ~100-125 MB; las actualizaciones posteriores son mucho más pequeñas (diferenciales en
  Windows y AppImage).
- Cualquier cambio de diseño se prueba en un solo motor (Chromium), igual que en Android (WebView de Chromium) y en
  la mayoría de navegadores.
