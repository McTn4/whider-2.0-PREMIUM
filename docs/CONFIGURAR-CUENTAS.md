# Configurar las cuentas de WHIDER (Firebase)

WHIDER usa **Firebase** (de Google) para las cuentas de usuario y la copia en la nube. El plan gratuito ("Spark") es suficiente para empezar. Configurarlo lleva unos 15 minutos y solo hay que hacerlo una vez.

Desde la 2.1, **WHIDER solo se usa con una cuenta de Google, Microsoft o Apple** (ya no hay «Continuar sin cuenta» ni
se crean cuentas nuevas con correo y contraseña; las que ya existían siguen entrando). Mientras no configures Firebase
(`firebase: null` en `js/config.js`, como en las pruebas), la app funciona sin cuentas y guarda todo en el dispositivo.

---

## 1. Crear el proyecto

1. Entra en <https://console.firebase.google.com> con tu cuenta de Google.
2. Pulsa **Crear un proyecto**, llámalo por ejemplo `whider` y termina el asistente (Google Analytics es opcional).

## 2. Registrar la app web y copiar la configuración

1. En la página del proyecto pulsa el icono **`</>` (Web)**, ponle de nombre `WHIDER` y pulsa **Registrar app** (no hace falta activar Hosting).
2. Firebase te muestra un bloque `const firebaseConfig = { ... }`. Copia esos valores en **`js/config.js`**:

```js
firebase: {
  apiKey: 'AIza…',
  authDomain: 'whider-xxxx.firebaseapp.com',
  projectId: 'whider-xxxx',
  storageBucket: 'whider-xxxx.firebasestorage.app',
  messagingSenderId: '1234567890',
  appId: '1:1234567890:web:abc123'
},
```

> Estos valores no son secretos: identifican tu proyecto. La seguridad la dan las reglas del paso 4.

## 3. Activar los métodos de acceso: Google, Microsoft y Apple

En **Compilación → Authentication → Comenzar → Método de acceso**. La dirección de vuelta que piden Microsoft y Apple
es la que enseña Firebase al abrir cada proveedor: `https://<tu-proyecto>.firebaseapp.com/__/auth/handler` (para
WHIDER, `https://whider.firebaseapp.com/__/auth/handler`).

### Google

1. Activa **Google**, elige un correo de asistencia y guarda.
2. Vuelve a abrir el proveedor **Google**, despliega **Configuración del SDK web** y copia el **ID de cliente web** en `js/config.js`:

```js
googleWebClientId: '1234567890-xxxxxxxx.apps.googleusercontent.com',
```

### Microsoft

1. En <https://entra.microsoft.com> (o el portal de Azure): **Registros de aplicaciones → Nuevo registro**.
   - Tipos de cuenta: **cuentas de cualquier directorio organizativo y cuentas Microsoft personales** (Outlook, Hotmail, Xbox…).
   - URI de redirección: **Web**, con la dirección de vuelta de Firebase (arriba).
2. Copia el **Id. de aplicación (cliente)**. En **Certificados y secretos → Nuevo secreto de cliente**, copia su **valor**
   (caduca: apunta la fecha y renuévalo antes; si caduca, nadie podrá entrar con Microsoft).
3. En Firebase activa **Microsoft** y pega el Id. de aplicación y el secreto.

Algunas cuentas de Microsoft no traen el correo marcado como verificado: la app y las reglas del paso 4 las aceptan
igual (lo que cuenta es haber entrado con Microsoft).

### Apple

Hace falta el **Apple Developer Program** (de pago). En <https://developer.apple.com/account>:

1. **Identifiers → App IDs**: un App ID (por ejemplo `com.whider.app`) con **Sign in with Apple** activado.
2. **Identifiers → Services IDs**: un Services ID (por ejemplo `com.whider.web`), con **Sign in with Apple →
   Configure**: el App ID del paso anterior, el dominio `whider.firebaseapp.com` y la dirección de vuelta de Firebase.
3. **Keys**: una clave con **Sign in with Apple**. Descarga el archivo `.p8` (solo se puede una vez) y apunta su
   **Key ID** y tu **Team ID** (arriba a la derecha de la cuenta).
4. En Firebase activa **Apple** y rellena el Services ID, el Team ID, el Key ID y la clave privada (el contenido del `.p8`).

Quien entra con Apple puede ocultar su correo: Apple da una dirección de reenvío (`…@privaterelay.appleid.com`).
WHIDER no envía correos a esas cuentas, así que no hace falta configurar nada más.

### Correo y contraseña (solo las cuentas de antes)

Deja activado **Correo electrónico/contraseña**: lo usan las cuentas creadas antes de la 2.1, que siguen entrando
(«¿Tu cuenta es de correo y contraseña?») y pueden recuperar la contraseña. La app ya no crea cuentas así. Si lo
desactivas, esas personas no podrán entrar hasta que lo vuelvas a activar.

En **Authentication → Plantillas** puedes poner el idioma de los correos en **Español** y el nombre del remitente
(p. ej. `WHIDER`) para el de recuperar la contraseña.

### Dominios autorizados

En **Authentication → Configuración → Dominios autorizados** tienen que estar:

- `localhost`: viene por defecto. Lo usa la **app de ordenador**, que abre el acceso en el navegador del sistema
  (`http://localhost:PUERTO/entrar`).
- El dominio de la web, para WHIDER `whider-red.vercel.app`: la app web y la página **`/entrar/`**, que usa la **app de
  Android** para Microsoft y Apple (se abre en el navegador del móvil y vuelve a la app ya con la sesión).
- `<tu-proyecto>.firebaseapp.com`: viene por defecto.

## 4. Crear la base de datos y sus reglas

1. Ve a **Compilación → Firestore Database → Crear base de datos**.
2. Elige una ubicación en Europa (por ejemplo `eur3` o `europe-west1`) y el **modo de producción**.
3. En la pestaña **Reglas**, sustituye el contenido por el del archivo [`firestore.rules`](../firestore.rules) de este repositorio y pulsa **Publicar**.

Estas reglas hacen que cada persona solo pueda leer y escribir **sus propios datos**, y solo si ha entrado con Google, Microsoft o Apple (o, en las cuentas de correo de antes, con el correo verificado). Además cubren lo que se comparte con otras personas:

| Colección | Quién puede |
| --- | --- |
| `users/{uid}/…` (tareas, ajustes, Cuaderno y sus archivos) | Solo su dueño |
| `profiles/{uid}` (nombre, personaje, racha) | La leen las cuentas verificadas; la escribe su dueño |
| `codes/{código}` e `inbox/{uid}` | Códigos de contacto y buzón de invitaciones; cada uno solo escribe lo suyo |
| `spaces/{id}`, `spaces/{id}/pages` y `spaces/{id}/files` | Equipos, sus páginas y los archivos de esas páginas: solo sus miembros (quien tenga el enlace del equipo puede entrar) |
| `chats/{id}` y `chats/{id}/msgs` | Solo los miembros del chat; cada uno edita o borra sus mensajes |

> **Al actualizar a la 2.1, vuelve a copiar y publicar el archivo completo** (y [`storage.rules`](../storage.rules), si usas Storage). La 2.1 deja entrar a las cuentas de Google, Microsoft y Apple aunque el proveedor no marque su correo como verificado; sin las reglas nuevas, algunas cuentas de Microsoft entran en la app pero la nube rechaza sus datos («La nube no ha aceptado los cambios»).
>
> **Al actualizar a la 8.0, vuelve a copiar y publicar el archivo completo.** La 8.0 añade la regla de `spaces/{id}/files` (fotos y archivos adjuntos de las páginas de equipo); sin ella, los archivos de un equipo no se suben ni se descargan. Tus propios archivos (`users/{uid}/files`) ya los cubre la regla de tus datos. (Si vienes de una versión anterior a la 7.0, sin las reglas nuevas tampoco conectan *Personas*, *Chats* ni las páginas de equipo.)
>
> **Espacio**: los archivos se guardan en Firestore en trozos de menos de 1 MB (no hace falta Cloud Storage, que exige el plan de pago). Cada archivo puede pesar hasta 15 MB y en el plan gratuito de Firebase caben 1 GB de datos en total; lo que ya no usa ninguna página se borra solo a los 3 días. Si crecen mucho, pueden ir a Firebase Storage (apartado siguiente).

### Adjuntos en Firebase Storage (opcional, plan Blaze)

Con muchos archivos, Storage sale más barato que Firestore (≈ 0,026 $/GB al mes frente a ≈ 0,18 $/GB, y una sola
lectura por archivo en lugar de una por cada trozo de 600 KB) y descarga más rápido. Pero **Firebase solo ofrece
Storage en el plan Blaze** (pago por uso; tiene una parte gratuita): actívalo solo si lo decides así, y pon antes una
alerta de presupuesto ([COSTES.md](COSTES.md)). La app ya está preparada y probada con el emulador; para encenderlo:

1. Firebase → **Storage** → *Comenzar* (pide pasar a Blaze). Apunta el nombre del bucket (`whider.firebasestorage.app`).
2. Publica las reglas de [`storage.rules`](../storage.rules) (Storage → Reglas, o `npx firebase-tools deploy --only storage`).
   La primera vez, Firebase pide permiso para que las reglas de Storage lean Firestore (las de los equipos miran
   quién es miembro): acéptalo.
3. Permite que la app lea los archivos desde el navegador (CORS), con [`storage-cors.json`](../storage-cors.json)
   (añade tu dominio si publicas la web en otro):

   ```bash
   gcloud storage buckets update gs://whider.firebasestorage.app --cors-file=storage-cors.json
   ```

4. En `js/config.js`, `storage: true` (y que `firebase.storageBucket` sea el bucket). Publica una versión nueva.
5. Añade «Cloud Storage» a los proveedores de la [política de privacidad](../privacidad/index.html) (y a la
   [inglesa](../privacy/index.html)), junto a Authentication y Cloud Firestore.

Lo que ya estaba en Firestore se sigue leyendo y se borra igual (cada ficha dice dónde está su archivo); los archivos
nuevos van enteros a Storage, en `users/{uid}/files/{id}` o `spaces/{id}/files/{id}`. Apagarlo de nuevo (`false`) no
borra nada, pero los dispositivos ya no podrán descargar lo que esté en Storage hasta volver a encenderlo.

## 5. Google en el APK de Android

Para que "Continuar con Google" funcione dentro del APK, Firebase tiene que conocer la huella SHA‑1 del certificado con el que firmas la app:

1. Obtén la huella. Desde la carpeta `android/`:
   ```bash
   ./gradlew signingReport
   ```
   Copia el valor **SHA1** de la variante que vayas a instalar (`debug` para pruebas; tu clave de publicación para Google Play).
2. En Firebase: **Configuración del proyecto → Tus apps → Agregar app → Android**.
   - Nombre del paquete: `com.whider.app`
   - Certificado SHA‑1: el valor del paso anterior
3. No hace falta descargar `google-services.json` ni añadir nada más al proyecto Android.

> **Google Play:** la versión de la tienda la firma Google con su propia clave («Firma de apps de Google Play»), así que tiene otra huella. Copia la **SHA‑1** de Play Console → *Prueba y publica → Configuración de la app → Integridad de la app → Firma de apps* y añádela en Firebase como otra huella de la misma app Android. Sin ella, «Continuar con Google» falla en la versión descargada de Google Play. Los pasos completos están en [PUBLICAR-EN-GOOGLE-PLAY.md](PUBLICAR-EN-GOOGLE-PLAY.md).

### Si "Continuar con Google" falla en el APK

La app muestra el motivo exacto. El más habitual es **"Google no reconoce esta app"** (detalle técnico `[16] Account reauth failed` o `[10] Developer console is not set up correctly`). Significa que la huella SHA‑1 con la que está firmado el APK no está registrada en tu app Android de Firebase, o que el paquete no es `com.whider.app`.

- Los APK que compila GitHub automáticamente están firmados siempre con la misma clave. Su huella aparece en el registro de cada compilación (pestaña **Actions → Compilar APK → paso "Mostrar la huella SHA-1 del APK"**) y es:
  `4F:33:7F:B5:D2:11:79:C2:20:DF:EC:0F:94:AB:C5:D2:57:60:3C:FB`
- Si compilas en tu ordenador con Android Studio, el proyecto usa esa misma clave para las versiones de prueba.
- Después de añadir la huella en Firebase, espera unos minutos y vuelve a probar.

## 6. Versión web (opcional)

Si publicas la app en una web (Vercel, Firebase Hosting, GitHub Pages…), añade su dominio en **Authentication → Configuración → Dominios autorizados** (para WHIDER: `whider-red.vercel.app`). Sin él, no se puede entrar con Google, Microsoft ni Apple en esa web, ni desde Android con Microsoft o Apple (usan su página `/entrar/`). `localhost` ya viene autorizado para probar con `python serve.py`.

### Enlaces de invitación y códigos QR

Desde la 7.0, a amigos y compañeros se les invita con un **enlace** o un **código QR**. El enlace tiene la forma `https://whider-red.vercel.app/i/?…` y lleva a la página [`i/index.html`](../i/index.html), que abre la invitación en la app (Android u ordenador) o en la web (`/app`), o enseña dónde descargarla.

- **Dominio**: es `links.base` en [`js/config.js`](../js/config.js). Si publicas la web en otro dominio, cámbialo ahí y también el `android:host` del filtro de enlaces en [`AndroidManifest.xml`](../android/app/src/main/AndroidManifest.xml).
- **Android (App Links)**: para que el enlace abra la app directamente, sin preguntar, la web publica [`.well-known/assetlinks.json`](../.well-known/assetlinks.json) con la huella **SHA‑256** del certificado del APK. La que hay es la de los APK que compila GitHub (y la de las compilaciones de prueba del proyecto). Para la versión de Google Play, añade a la lista la **SHA‑256** de la firma de apps de Google Play (Play Console → Integridad de la app). Sin esto, el enlace sigue funcionando: se abre la página de invitación y desde ella la app.
- **Ordenador**: la app de escritorio registra los enlaces `whider://`, que la página de invitación usa para abrirla.

Para publicarla con Firebase Hosting (el archivo `firebase.json` ya está preparado):

```bash
npm install -g firebase-tools
firebase login
firebase use --add
firebase deploy --only hosting,firestore:rules
```

## 7. Aplicar los cambios en Android

GitHub recompila el APK de pruebas y el paquete para Google Play cada vez que cambia la app. Si compilas en tu ordenador, copia antes la web al proyecto Android:

```bash
python package_apk.py --sync
```

```bash
cd android
./gradlew assembleDebug
```

---

## Probar sin tocar el proyecto real (emuladores)

Puedes probar las cuentas y la sincronización en tu ordenador con los emuladores oficiales de Firebase:

```bash
npx firebase-tools emulators:start --only auth,firestore,storage --project demo-whider
```

Y en `js/config.js`, temporalmente:

```js
firebase: { apiKey: 'demo-key', authDomain: 'demo-whider.firebaseapp.com', projectId: 'demo-whider', appId: '1:1:web:1', storageBucket: 'demo-whider.appspot.com' },
emulator: { auth: 'http://127.0.0.1:9099', firestoreHost: '127.0.0.1', firestorePort: 8085, storageHost: '127.0.0.1', storagePort: 9199 },
// storage: true,   // para probar los adjuntos en Storage
```

El emulador abre su propia ventana para Google, Microsoft y Apple, con cuentas de prueba (necesita poder cargar
`apis.google.com`). Las pruebas automáticas no la abren: entran con la credencial de prueba que acepta el emulador
(ver `tests/e2e/_cuentas.js`).

## Preguntas frecuentes

- **¿Qué pasa con los datos que ya tenía?** Se conservan. Si usabas la app sin cuenta, al entrar con tu cuenta todo se sube a ella.
- **¿Y si uso dos móviles?** Los cambios se fusionan: no se pierde lo hecho en ninguno. Si algo se borra en uno, también desaparece en el otro.
- **¿Funciona sin internet?** Sí. Todo se guarda al momento en el dispositivo y se sincroniza al volver la conexión.
- **¿Cómo se borra una cuenta?** Tocando **tu foto** (arriba a la derecha; en el ordenador, con tu nombre en la barra superior) **→ tu nombre → Eliminar la cuenta**. Sin la app, desde la web: `https://whider-red.vercel.app/app#cuenta` abre esa misma pantalla al iniciar sesión (es el enlace que pide Google Play). Se borran la cuenta y todo lo suyo en la nube: tareas y ajustes, el Cuaderno, el perfil público, el código de contacto y su sitio en los equipos (si era el único miembro, el equipo también). Es un requisito de Google Play. Si hace rato que se inició sesión, Firebase pide entrar otra vez antes de borrar nada. Los mensajes ya enviados siguen en los chats de las otras personas, como en cualquier mensajería.
