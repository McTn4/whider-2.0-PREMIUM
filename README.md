# WHIDER PRO 2.2.1 — Premium

Gestor de tareas y agenda multipantalla, optimizado para smartphones y pantallas táctiles, con estética **Pure Dark / neón**, remarcado visual, avisos sonoros y notificaciones por incumplimiento, perfil local, progreso y records. Se puede usar como **web/PWA instalable** o como **APK nativo de Android**.

---

## ▶️ Probar la app en el ordenador

Necesitas Python 3.8 o superior:

```bash
python serve.py
```

Se abrirá `http://localhost:8080` y en la consola verás también la dirección para tu móvil en la red Wi‑Fi (por ejemplo `http://192.168.1.140:8080`). Opciones: `python serve.py 9000` (otro puerto) y `python serve.py --no-open` (sin abrir el navegador).

> Si tienes [`cloudflared`](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/) instalado (en el PATH o junto a `serve.py`), el servidor crea además un **enlace HTTPS público temporal**. Es necesario para instalar la app en el móvil como WebAPK, porque Android solo permite instalar PWAs servidas por HTTPS.

---

## 📱 Instalar en Android

### Método 1: Instalación directa (WebAPK)
1. Ejecuta `python serve.py` con `cloudflared` disponible y copia el enlace `https://….trycloudflare.com`.
2. Ábrelo en **Chrome** en tu teléfono (también puedes escanear el QR de *Ajustes → App móvil → Instalar*).
3. Pulsa **Instalar** en la app o, en el menú de Chrome (`⋮`), **"Instalar aplicación"**.
4. Android instala la app con su icono, en ventana propia, con soporte offline y notificaciones.

### Método 2: APK firmado con PWABuilder
1. Publica la app en una URL HTTPS (el enlace de `cloudflared` o, por ejemplo, GitHub Pages).
2. Entra en [PWABuilder.com](https://www.pwabuilder.com/), introduce esa URL y pulsa **"Package for stores" → Android**.
3. Descarga el `.apk` e instálalo habilitando "Instalar apps de orígenes desconocidos".

### Método 3: Compilar con Android Studio (proyecto nativo incluido)
1. Ejecuta `python package_apk.py --sync` para copiar la última versión de la web dentro del proyecto Android.
2. Abre la carpeta **`android/`** en Android Studio (Hedgehog o posterior, JDK 17+).
3. Conecta tu teléfono con depuración USB o usa un emulador y pulsa **Run**, o compila desde la terminal:
   ```bash
   cd android
   ./gradlew assembleDebug
   ```
4. El APK se genera en `android/app/build/outputs/apk/debug/app-debug.apk`.

La app nativa carga la web desde `assets/www` (100 % offline) e incluye un puente nativo para: notificaciones del sistema (con permiso de Android 13+), guardar la copia de seguridad JSON en *Descargas*, importar archivos, abrir enlaces externos en el navegador y gestionar el botón **Atrás** (cierra menús/modales y vuelve a Inicio antes de salir).

---

## 📂 Estructura del proyecto

```text
.
├── index.html            # Shell de la app y todas las pantallas
├── manifest.json         # Manifiesto PWA (iconos, accesos directos #tasks/#warnings/#calendar)
├── sw.js                 # Service Worker: red primero + respaldo offline + clic en notificaciones
├── serve.py              # Servidor local multihilo con IP Wi‑Fi y túnel HTTPS opcional
├── package_apk.py        # Sincroniza la web con Android y genera el ZIP del proyecto
├── icons/                # Iconos 192/512, maskable y SVG
├── fonts/                # Tipografías locales (Archivo, IBM Plex Sans)
├── css/                  # Estilos por módulo/pantalla + premium.css
├── js/                   # Estado, router, audio, notificaciones, componentes y pantallas
└── android/              # Proyecto Android nativo (Gradle wrapper incluido)
    ├── gradlew / gradlew.bat
    ├── gradle.properties
    └── app/src/main/
        ├── AndroidManifest.xml
        ├── java/com/whider/app/MainActivity.java
        ├── res/ (iconos mipmap, icono de notificación, temas)
        └── assets/www/   # Copia de la web (generada con package_apk.py --sync)
```

---

## ⚡ Comandos rápidos

| Acción | Comando |
| --- | --- |
| Servidor para PC y móvil | `python serve.py` |
| Sincronizar web → Android | `python package_apk.py --sync` |
| Sincronizar y crear ZIP del proyecto | `python package_apk.py` |
| Compilar APK de depuración | `cd android && ./gradlew assembleDebug` |

---

## 👤 Perfil y cuentas

El perfil (nombre y correo) se guarda **solo en este dispositivo** (`localStorage`). No es un sistema de registro o inicio de sesión seguro y no sincroniza datos entre dispositivos; para eso hace falta un backend de identidad y base de datos (por ejemplo Firebase Authentication + Firestore o Supabase). La app no guarda contraseñas. Usa **Ajustes → Copia de seguridad** para exportar/importar tus tareas en JSON.

---

## 📝 Cambios en 2.2.1 (correcciones)

**Funcionamiento general**
- Al arrancar, el HTML marcaba "Tareas" como pantalla activa mientras la app abría "Inicio" (parpadeo y estado incoherente): ahora la pantalla inicial es coherente.
- Los accesos directos del manifiesto (`#tasks`, `#warnings`) no hacían nada: el router ahora lee y sincroniza la URL (`#pantalla`) y responde a `hashchange`.
- El contador de avisos vencidos no se mostraba en ningún sitio (apuntaba a elementos eliminados en el rediseño 2.2): ahora aparece en el botón **Menú**, en el menú lateral y en el icono de menú.
- `Escape` solo cerraba el modal de edición: ahora cierra también el perfil, el modal de instalación y el menú lateral.
- Si la app seguía abierta al cambiar de día, fechas, rachas y avisos no se actualizaban.
- Sincronización entre pestañas abiertas de la app.

**Tareas, avisos y notificaciones**
- En Android (Chrome) `new Notification()` lanza un error: las notificaciones se muestran ahora mediante el Service Worker, que además abre la pantalla de avisos al pulsarlas.
- La alarma sonora que llegaba antes del primer toque se perdía (el navegador bloquea el audio); ahora se reproduce al primer gesto. También se evita el aviso de vibración bloqueada.
- Si vencían varias tareas a la vez sonaban varias alarmas superpuestas: ahora suena una sola.
- "Completar ahora" en un aviso podía **desmarcar** una tarea ya completada; ahora siempre la completa.
- Al cambiar la fecha/hora de una tarea, el aviso no volvía a sonar hasta pasados 20 min del anterior.
- El filtro "Vencidas" y el resaltado de la tarjeta usaban criterios distintos a los del motor de avisos (`<` frente a `<=`).
- Al añadir una tarea con un filtro activo, la nueva tarea podía quedar oculta.
- El interruptor "Avisarme si no la hago" y los chips de fecha no reflejaban bien el estado al elegir una fecha a mano.
- Borrar una tarea desde el editor ahora pide confirmación.

**Ajustes y copia de seguridad**
- Exportar JSON revocaba la URL antes de descargar (fallaba en algunos navegadores) y en la app Android no funcionaba: ahora se guarda en *Descargas* mediante el puente nativo.
- Importar el mismo archivo dos veces no hacía nada; ahora pide confirmación antes de sustituir tareas y muestra el resultado.
- "Copiar enlace" fallaba al abrir la app por la IP Wi‑Fi (HTTP sin cifrar, sin `navigator.clipboard`).
- La sección "Instalar" se oculta cuando la app ya está instalada o se ejecuta como APK.
- El código QR externo se descargaba siempre al abrir la app (aunque no se usara); ahora solo al abrir el modal.

**PWA / Service Worker**
- La caché servía siempre la versión antigua (estrategia "caché primero" sin actualización): los usuarios nunca recibían cambios. Ahora es "red primero" con respaldo offline.
- Cualquier recurso fallido devolvía `index.html`; ahora solo las navegaciones.
- Un solo recurso que fallara impedía instalar el Service Worker.
- Icono *maskable* propio (antes se recortaba el icono normal).

**Android**
- El proyecto no compilaba: faltaban `@mipmap/ic_launcher`/`ic_launcher_round`, `gradle.properties` con `android.useAndroidX=true`, `proguard-rules.pro` y el Gradle wrapper (`./gradlew`).
- Importar JSON (`<input type="file">`) no abría el selector de archivos en el WebView.
- Los enlaces externos se abrían dentro de la app; ahora se abren en el navegador.
- El botón Atrás cerraba la app directamente.
- Notificaciones nativas con canal propio y permiso `POST_NOTIFICATIONS` (Android 13+).
- Se eliminó un `app.js` obsoleto que sobraba en `assets/www`.

**Scripts**
- `serve.py`: el túnel de Cloudflare se congelaba al no leer su salida; solo buscaba `cloudflared.exe` (Windows); servidor de un solo hilo; cabecera CORS duplicada en `/api/tunnel`.
- `package_apk.py`: ahora sincroniza la web con el proyecto Android y excluye carpetas de compilación, claves y binarios del ZIP.
