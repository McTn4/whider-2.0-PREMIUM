# Configurar las cuentas de WHIDER (Firebase)

WHIDER usa **Firebase** (de Google) para las cuentas de usuario y la copia en la nube. El plan gratuito ("Spark") es suficiente para empezar. Configurarlo lleva unos 15 minutos y solo hay que hacerlo una vez.

Mientras no lo configures, la app funciona igual pero **sin cuentas**: los datos se guardan solo en el dispositivo.

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

## 3. Activar los métodos de acceso

En **Compilación → Authentication → Comenzar → Método de acceso**:

1. Activa **Correo electrónico/contraseña** (deja desactivado "Vínculo de correo electrónico").
2. Activa **Google**, elige un correo de asistencia y guarda.
3. Vuelve a abrir el proveedor **Google**, despliega **Configuración del SDK web** y copia el **ID de cliente web** en `js/config.js`:

```js
googleWebClientId: '1234567890-xxxxxxxx.apps.googleusercontent.com',
```

### Correos con aspecto profesional

En **Authentication → Plantillas**:

- Cambia el idioma de las plantillas a **Español**.
- Personaliza el **nombre del remitente** (p. ej. `WHIDER`) y el texto de los correos de verificación y de recuperación de contraseña.
- Para enviarlos desde tu propio dominio (p. ej. `no-responder@tuempresa.com`), usa **Personalizar dominio** y añade los registros DNS que te indica Firebase.

### Solo correos de empresa (opcional)

Si quieres que solo puedan registrarse correos de tu organización, indícalo en `js/config.js`:

```js
allowedEmailDomains: ['tuempresa.com'],
```

## 4. Crear la base de datos y sus reglas

1. Ve a **Compilación → Firestore Database → Crear base de datos**.
2. Elige una ubicación en Europa (por ejemplo `eur3` o `europe-west1`) y el **modo de producción**.
3. En la pestaña **Reglas**, sustituye el contenido por el del archivo [`firestore.rules`](../firestore.rules) de este repositorio y pulsa **Publicar**.

Estas reglas hacen que cada persona solo pueda leer y escribir **sus propios datos**, y solo con el correo verificado. Además cubren lo que se comparte con otras personas:

| Colección | Quién puede |
| --- | --- |
| `users/{uid}/…` (tareas, ajustes, Cuaderno y sus archivos) | Solo su dueño |
| `profiles/{uid}` (nombre, personaje, racha) | La leen las cuentas verificadas; la escribe su dueño |
| `codes/{código}` e `inbox/{uid}` | Códigos de contacto y buzón de invitaciones; cada uno solo escribe lo suyo |
| `spaces/{id}`, `spaces/{id}/pages` y `spaces/{id}/files` | Equipos, sus páginas y los archivos de esas páginas: solo sus miembros (quien tenga el enlace del equipo puede entrar) |
| `chats/{id}` y `chats/{id}/msgs` | Solo los miembros del chat; cada uno edita o borra sus mensajes |

> **Al actualizar a la 8.0, vuelve a copiar y publicar el archivo completo.** La 8.0 añade la regla de `spaces/{id}/files` (fotos y archivos adjuntos de las páginas de equipo); sin ella, los archivos de un equipo no se suben ni se descargan. Tus propios archivos (`users/{uid}/files`) ya los cubre la regla de tus datos. (Si vienes de una versión anterior a la 7.0, sin las reglas nuevas tampoco conectan *Personas*, *Chats* ni las páginas de equipo.)
>
> **Espacio**: los archivos se guardan en Firestore en trozos de menos de 1 MB (no hace falta Cloud Storage, que exige el plan de pago). Cada archivo puede pesar hasta 15 MB y en el plan gratuito de Firebase caben 1 GB de datos en total; lo que ya no usa ninguna página se borra solo a los 3 días.

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

> Si publicas en Google Play con "Firma de apps de Google Play", añade también la SHA‑1 que aparece en Play Console → Integridad de la app.

### Si "Continuar con Google" falla en el APK

La app muestra el motivo exacto. El más habitual es **"Google no reconoce esta app"** (detalle técnico `[16] Account reauth failed` o `[10] Developer console is not set up correctly`). Significa que la huella SHA‑1 con la que está firmado el APK no está registrada en tu app Android de Firebase, o que el paquete no es `com.whider.app`.

- Los APK que compila GitHub automáticamente están firmados siempre con la misma clave. Su huella aparece en el registro de cada compilación (pestaña **Actions → Compilar APK → paso "Mostrar la huella SHA-1 del APK"**) y es:
  `4F:33:7F:B5:D2:11:79:C2:20:DF:EC:0F:94:AB:C5:D2:57:60:3C:FB`
- Si compilas en tu ordenador con Android Studio, el proyecto usa esa misma clave para las versiones de prueba.
- Después de añadir la huella en Firebase, espera unos minutos y vuelve a probar.

## 6. Versión web (opcional)

Si publicas la app en una web (Vercel, Firebase Hosting, GitHub Pages…), añade su dominio en **Authentication → Configuración → Dominios autorizados** (para WHIDER: `whider-red.vercel.app`). Sin él, *Continuar con Google* no funciona en esa web. `localhost` ya viene autorizado para probar con `python serve.py`.

### Enlaces de invitación y códigos QR

Desde la 7.0, a amigos y compañeros se les invita con un **enlace** o un **código QR**. El enlace tiene la forma `https://whider-red.vercel.app/i/?…` y lleva a la página [`i/index.html`](../i/index.html), que abre la invitación en la app (Android u ordenador) o en la web, o enseña dónde descargarla.

- **Dominio**: es `links.base` en [`js/config.js`](../js/config.js). Si publicas la web en otro dominio, cámbialo ahí y también el `android:host` del filtro de enlaces en [`AndroidManifest.xml`](../android/app/src/main/AndroidManifest.xml).
- **Android (App Links)**: para que el enlace abra la app directamente, sin preguntar, la web publica [`.well-known/assetlinks.json`](../.well-known/assetlinks.json) con la huella **SHA‑256** del certificado del APK. La que hay es la de los APK que compila GitHub (y la de las compilaciones de prueba del proyecto). Si firmas con otra clave, añade su SHA‑256 (`./gradlew signingReport`, valor **SHA-256**) a la lista. Sin esto, el enlace sigue funcionando: se abre la página de invitación y desde ella la app.
- **Ordenador**: la app de escritorio registra los enlaces `whider://`, que la página de invitación usa para abrirla.

Para publicarla con Firebase Hosting (el archivo `firebase.json` ya está preparado):

```bash
npm install -g firebase-tools
firebase login
firebase use --add
firebase deploy --only hosting,firestore:rules
```

## 7. Aplicar los cambios en Android

Cada vez que edites `js/config.js`, copia la web al proyecto Android y vuelve a compilar:

```bash
python package_apk.py --sync
```

```bash
cd android
./gradlew assembleDebug
```

---

## 8. Planes y pagos (Premium)

WHIDER funciona con **Gratis** y **Premium**. En [`js/config.js`](../js/config.js), apartado `premium`:

| Opción | Para qué |
| --- | --- |
| `monthly`, `yearly`, `currency` | Precios que se muestran (por defecto 3,99 € al mes y 29,99 € al año). |
| `trialDays` | Días de la prueba gratuita. Ahora `0`: sin prueba (no se ofrece y una prueba en marcha termina). Con `14`, cada cuenta puede probar Premium 14 días una vez. |
| `checkoutUrl`, `checkoutUrlYearly` | Tu página de pago, por ejemplo un *Payment Link* de Stripe. La app añade `client_reference_id` con el identificador de la cuenta y, si la cuenta tiene correo, `prefilled_email` para que Stripe lo rellene. |
| `testCheckoutUrl`, `testCheckoutUrlYearly` | Enlaces del **modo de prueba** de Stripe (`https://buy.stripe.com/test_…`). Solo se usan con el modo de pruebas de pago encendido (ver abajo). Si no hay enlace anual, el anual usa el mismo. |
| `codes` | Códigos de activación (SHA-256 del código en mayúsculas). |

**Opción sencilla (sin servidor):** crea un *Payment Link* en Stripe, ponlo en `checkoutUrl` y, cuando alguien pague, envíale un código de activación. Para generar el hash de un código nuevo:

```bash
node -e "console.log(require('crypto').createHash('sha256').update('MI-CODIGO-2026').digest('hex'))"
```

**Opción automática:** una Cloud Function que reciba el *webhook* de Stripe (`checkout.session.completed`), lea `client_reference_id` y active Premium en esa cuenta. Es el paso que falta para cobrar de forma totalmente automática; la app ya está preparada para mostrar el estado del plan sincronizado con la cuenta.

### Probar el pago sin cobrar (modo de prueba de Stripe)

El modo de prueba de Stripe no pide los datos de la empresa ni cobra nada. Crea el *Payment Link* con el interruptor **«Modo de prueba»** encendido en Stripe (su enlace empieza por `https://buy.stripe.com/test_`) y ponlo en `testCheckoutUrl`. Los usuarios normales no lo ven nunca: solo se usa en el dispositivo donde enciendas el modo de pruebas de pago.

1. **Ajustes** (el engranaje) → baja del todo y toca **7 veces seguidas** la línea «WHIDER 8.x · …». Aparece «· Pagos de prueba».
2. **Planes** muestra el aviso «Modo de pruebas de pago» y el botón **«Hazte Premium (prueba)»**, que abre tu enlace de prueba.
3. Paga con la tarjeta de prueba `4242 4242 4242 4242`, cualquier fecha futura y cualquier CVC. Para probar un rechazo: `4000 0000 0000 9995`; con verificación 3D Secure: `4000 0025 0000 3155`.
4. En Stripe, con el modo de prueba encendido, el pago aparece en **Transacciones**. El evento `checkout.session.completed` de ese pago lleva `client_reference_id` con el identificador de la cuenta que pagó (o `invitado` si no había sesión): es el dato que usará la activación automática.
5. Otros 7 toques en la misma línea lo apagan.

El pago de prueba no activa Premium por sí solo: igual que con el enlace real, hace falta el código de activación o el *webhook* de la opción automática. Cuando pases a cobrar de verdad, pon el enlace real en `checkoutUrl` (y `checkoutUrlYearly` si tienes uno anual): `testCheckoutUrl` puede quedarse para seguir probando.

## Probar sin tocar el proyecto real (emuladores)

Puedes probar el registro y la sincronización en tu ordenador con los emuladores oficiales de Firebase:

```bash
npx firebase-tools emulators:start --only auth,firestore --project demo-whider
```

Y en `js/config.js`, temporalmente:

```js
firebase: { apiKey: 'demo-key', authDomain: 'demo-whider.firebaseapp.com', projectId: 'demo-whider', appId: '1:1:web:1' },
emulator: { auth: 'http://127.0.0.1:9099', firestoreHost: '127.0.0.1', firestorePort: 8085 },
```

Los correos de verificación no se envían de verdad: el emulador muestra los enlaces en su consola.

## Preguntas frecuentes

- **¿Qué pasa con los datos que ya tenía?** Se conservan. Si usabas la app sin cuenta, al crear la cuenta todo se sube a ella.
- **¿Y si uso dos móviles?** Los cambios se fusionan: no se pierde lo hecho en ninguno. Si algo se borra en uno, también desaparece en el otro.
- **¿Funciona sin internet?** Sí. Todo se guarda al momento en el dispositivo y se sincroniza al volver la conexión.
- **¿Cómo se borra una cuenta?** **Ajustes** (el engranaje) **→ Cuenta → Eliminar la cuenta**. Se borran la cuenta y todo lo suyo en la nube: tareas y ajustes, el Cuaderno, el perfil público, el código de contacto y su sitio en los equipos (si era el único miembro, el equipo también). Es un requisito de Google Play. Si hace rato que se inició sesión, Firebase pide entrar otra vez antes de borrar nada. Los mensajes ya enviados siguen en los chats de las otras personas, como en cualquier mensajería.
