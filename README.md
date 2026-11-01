# WHIDER PRO (Mobile-First Multi-Screen Task Architecture & Android APK)

Gestor de tareas y agenda multipantalla de alto rendimiento, optimizado para smartphones y pantallas táctiles con estética **Pure Dark**, remarcado visual, alertas sonoras de advertencia y **descarga/instalación como aplicación móvil (APK)**.

---

## 📱 Cómo Descargar e Instalar en tu Móvil (Android)

Tienes **3 vías directas** para testear e instalar la app en tu teléfono Android:

### 🌟 Método 1: Instalación Directa WebAPK (Sin Cables ni Complicaciones)
Android (mediante Google Chrome, Edge o Brave) incluye el servicio nativo **WebAPK Minting Service**:
1. Ejecuta el servidor local en tu PC:
   ```bash
   python serve.py
   ```
2. En la consola verás la dirección de tu móvil en la red Wi-Fi (por ejemplo, `http://192.168.1.140:8080`).
3. Abre esa dirección en el navegador **Chrome** de tu teléfono móvil.
4. Pulsa sobre el botón del encabezado **📲 Instalar APK** o en el menú de Chrome (`⋮`) selecciona **"Instalar aplicación"** / **"Añadir a la pantalla de inicio"**.
5. **Android compilará e instalará automáticamente el APK nativo en tu cajón de aplicaciones**, con su icono propio de alta resolución, ventana independiente sin barra de navegador, soporte offline total y acceso a notificaciones del sistema.

---

### 📦 Método 2: Generar APK Firmado con PWABuilder (Online en 1 Clic)
1. Entra en [**PWABuilder.com**](https://www.pwabuilder.com/) (herramienta oficial de Microsoft para empaquetar WebAPKs).
2. Sube el paquete `whider-pro-android-project.zip` o introduce la URL de tu app.
3. Haz clic en **"Build APK"** para descargar directamente el archivo `.apk` firmado e instalarlo en cualquier teléfono Android habilitando "Instalar orígenes desconocidos".

---

### 🛠️ Método 3: Compilar con Android Studio (Proyecto Nativo Incluido)
El proyecto incluye el código nativo completo en la carpeta `android/`:
1. Abre la carpeta `whider-mobile/android` en **Android Studio**.
2. Conecta tu teléfono por USB con depuración habilitada o usa un emulador.
3. Ejecuta **Run** o compila el APK con el comando:
   ```bash
   ./gradlew assembleDebug
   ```
4. El archivo ejecutable se generará en:
   `android/app/build/outputs/apk/debug/app-debug.apk`

---

## 📂 Arquitectura del Proyecto

```text
whider-mobile/
├── index.html                   # Shell principal de la app y contenedor de pantallas
├── manifest.json                # Manifiesto PWA para instalación nativa WebAPK
├── sw.js                        # Service Worker con almacenamiento offline
├── serve.py                     # Servidor local con detección Wi-Fi para móviles
├── package_apk.py               # Generador del paquete ZIP para Android
├── whider-pro-android-project.zip # Paquete listo para Android Studio / PWABuilder
├── icons/
│   ├── icon-192.png             # Icono HD 192x192
│   ├── icon-512.png             # Icono HD 512x512
│   └── icon.svg                 # Icono vectorial
├── android/                     # Proyecto nativo Java / Gradle completo
│   ├── build.gradle
│   ├── settings.gradle
│   └── app/
│       ├── build.gradle
│       └── src/main/
│           ├── AndroidManifest.xml
│           └── java/com/whider/app/MainActivity.java
├── css/                         # 8 módulos de hojas de estilo (Pure Dark)
└── js/                          # 12 módulos desacoplados (audio, router, state, pantallas)
```

---

## ⚡ Comandos Rápidos

* **Lanzar servidor para móvil y PC:**
  ```bash
  python serve.py
  ```
* **Generar paquete ZIP para APK:**
  ```bash
  python package_apk.py
  ```


## WHIDER PRO 2.2 — Premium UI upgrade

This build adds a home dashboard, slide-out navigation, a local user profile, profile/progress presentation, records, and a refreshed dark glass/neon visual system. The existing task, calendar, notification and statistics modules remain in place.

### Account/authentication status
The profile form in this build is **local-only** and stores a display name and email in this browser/device. It is not a secure account registration or login system, and it does not sync data between devices. Real registration, login, password reset, and cloud sync require a backend identity provider and database (for example Firebase Authentication + Firestore or Supabase Auth + Postgres). No passwords are stored by this prototype.
