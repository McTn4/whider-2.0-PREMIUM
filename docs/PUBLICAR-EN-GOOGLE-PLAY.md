# Publicar WHIDER en Google Play

La versión 1.0 ya cumple lo técnico que pide Google Play hoy: apunta a **Android 16 (API 36)**, se dibuja de borde a borde, usa el botón Atrás moderno (gesto predictivo), no pide permisos especiales de alarmas y GitHub genera el **paquete AAB** que se sube a Play Console. Lo que queda son pasos de tu cuenta, que solo puedes dar tú.

## 1. Crear tu clave de subida (una sola vez)

Google firma la app que reciben los usuarios con su propia clave («Firma de apps de Google Play»). Tú solo necesitas una **clave de subida** para firmar los paquetes que le envías. Créala en tu ordenador (hace falta Java; viene con Android Studio):

```bash
keytool -genkeypair -v -keystore whider-subida.jks -alias whider -keyalg RSA -keysize 4096 -validity 10000
```

Te pedirá una contraseña y tus datos (nombre, ciudad, país). **Guarda el archivo `whider-subida.jks` y la contraseña en un lugar seguro**: sin ellos no podrás publicar actualizaciones (Google puede restablecer la clave de subida, pero tarda días). Nunca lo subas al repositorio.

## 2. Dar la clave a GitHub (secretos del repositorio)

En GitHub: repositorio **→ Settings → Secrets and variables → Actions → New repository secret**. Crea estos cuatro:

| Secreto | Valor |
|---|---|
| `ANDROID_UPLOAD_KEYSTORE_B64` | El archivo `whider-subida.jks` en base64 (ver abajo) |
| `ANDROID_UPLOAD_STORE_PASSWORD` | La contraseña del almacén |
| `ANDROID_UPLOAD_KEY_ALIAS` | `whider` (el alias que pusiste) |
| `ANDROID_UPLOAD_KEY_PASSWORD` | La contraseña de la clave (con `keytool` suele ser la misma) |

Para obtener el base64 del archivo:

```bash
base64 -w0 whider-subida.jks
```

(En macOS: `base64 -i whider-subida.jks`; en Windows PowerShell: `[Convert]::ToBase64String([IO.File]::ReadAllBytes("whider-subida.jks"))`.)

Los secretos solo los lee la compilación; nadie los ve, ni siquiera en los registros.

## 3. Generar el paquete para Google Play

GitHub lo compila solo con cada cambio de la app, o a mano: **Actions → Compilar APK → Run workflow**. Al terminar, en la ejecución verás el artefacto **whider-google-play** con `whider-play.aab` dentro, y en el resumen si está **firmado con tu clave de subida** (si no ves los secretos, sale «sin firmar» y Play Console no lo aceptará).

## 4. Play Console

1. Crea la cuenta de desarrollador en [play.google.com/console](https://play.google.com/console) (pago único de 25 USD y verificación de identidad).
2. **Crear app**: nombre «WHIDER», idioma español (España), tipo *App*, *Gratis*.
3. **Prueba cerrada obligatoria (cuentas personales nuevas):** Google exige una prueba cerrada con al menos 12 personas durante 14 días seguidos antes de poder publicar en producción. Crea la pista *Prueba cerrada*, sube ahí el AAB e invita a esas personas por correo o con una lista de Google Groups.
4. Sube `whider-play.aab` a la pista elegida. La primera vez, acepta la **Firma de apps de Google Play**.
5. Completa **Contenido de la app**:
   - **Política de privacidad**: `https://whider-red.vercel.app/privacidad/`
   - **Acceso a la app**: indica que todo se puede probar con «Continuar sin cuenta» (o facilita una cuenta de prueba con correo y contraseña).
   - **Anuncios**: no contiene anuncios.
   - **Seguridad de los datos** (resumen fiel de lo que hace la app):
     - Datos recogidos: *Información personal* → nombre y dirección de correo; *Fotos* → foto de perfil (opcional); *Mensajes* → mensajes de los chats; *Archivos y documentos* → adjuntos del Cuaderno; *Actividad en la app* → contenido generado por el usuario (tareas, notas, hábitos).
     - Finalidad: *Funcionalidad de la app* y *Gestión de la cuenta*. No se comparten con terceros (Firebase es proveedor de servicios, no cuenta como compartir).
     - Cifrados en tránsito: sí. Se pueden eliminar: sí.
     - **Eliminación de la cuenta**: dentro de la app (Ajustes → Cuenta → Eliminar la cuenta) y en la web: `https://whider-red.vercel.app/#cuenta`.
   - **Clasificación de contenido**: rellena el cuestionario (app de productividad; tiene chats entre usuarios, así que marca que permite la interacción entre usuarios).
   - **Público objetivo**: mayores de 14 años (la política lo indica así).
6. **Ficha de Play Store**: descripción, icono de 512 × 512 (`icons/icon-512.png`), gráfico de funciones de 1024 × 500 y capturas del móvil (al menos 2). El **correo de contacto del desarrollador** que pongas aquí es el que la política de privacidad indica para consultas.

## 5. Después de la primera subida (imprescindible para Google)

La versión de Google Play está firmada con la clave de Google, distinta de la de los APK de pruebas. Copia sus huellas de **Play Console → Prueba y publica → Configuración de la app → Integridad de la app → Firma de apps**:

1. **SHA‑1** → Firebase → Configuración del proyecto → tu app Android `com.whider.app` → *Agregar huella digital*. Sin esto, **«Continuar con Google» falla** en la versión de la tienda.
2. **SHA‑256** → añádela a la lista de [`.well-known/assetlinks.json`](../.well-known/assetlinks.json) (junto a la que ya hay) para que los enlaces de invitación abran la app directamente.
3. Cuando la ficha esté publicada, cambia en [`i/index.html`](../i/index.html) los enlaces de descarga de Android (ahora el APK de GitHub) por `https://play.google.com/store/apps/details?id=com.whider.app`.

## 6. Actualizaciones

Cada nueva versión necesita un `versionCode` mayor en [`android/app/build.gradle`](../android/app/build.gradle) (la 1.0 es `1000`; la siguiente puede ser `1001`) y, si quieres, un `versionName` nuevo. GitHub generará el AAB firmado y lo subes a Play Console.

## Lo técnico ya resuelto en la 1.0

- `targetSdk` y `compileSdk` 36 (Android 16), plugin de Android 8.13 y Gradle 8.14.
- De borde a borde: la app aparta su contenido de la barra de estado, la de navegación, el recorte de la cámara y el teclado.
- Botón Atrás con `OnBackPressedDispatcher` (compatible con el gesto predictivo).
- Recordatorios con alarmas inexactas (`setAndAllowWhileIdle`): no hace falta el permiso de alarmas exactas, que Google restringe.
- Permisos mínimos: Internet, notificaciones, vibración, reprogramar al reiniciar y cámara (solo al escanear un QR).
- Sin anuncios, sin análisis ni seguimiento, sin compras dentro de la app.
- Acceso a archivos del WebView cerrado en las instalaciones nuevas.
