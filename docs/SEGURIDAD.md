# Seguridad de WHIDER

Resumen de cómo se protegen los datos, qué se ha reforzado en la 1.1 y qué queda por activar desde las
consolas de Firebase y Google Cloud (pasos que solo puede dar quien administra el proyecto).

## Lo que ya protege la nube

Las reglas de [`firestore.rules`](../firestore.rules) se comprueban en el servidor, así que valen igual
aunque alguien use la API sin la app:

| Qué | Quién puede |
| --- | --- |
| Tus datos (`users/{uid}/…`: tareas, Cuaderno, adjuntos, archivo) | Solo tú |
| Un perfil público (`profiles/{uid}`) | Leerlo: cualquier cuenta verificada que sepa el identificador. **Listarlos todos: nadie.** Escribirlo: su dueño (nombre ≤ 80 caracteres, foto < 100 KB) |
| Un código de amigo (`codes/…`) | Consultar uno concreto; nadie puede listarlos |
| Tu buzón (`inbox/{uid}`) | Tú lo lees y lo vacías; los demás solo escriben su propia entrada, pequeña, y **no si los has bloqueado** |
| Equipos, sus páginas y adjuntos | Solo sus miembros |
| Chats y mensajes | Solo sus miembros; en un chat de dos, **no si la otra persona te ha bloqueado** |
| Bloqueos (`blocks/{tú_otro}`) | Solo quien bloquea los ve y los cambia |
| Denuncias (`reports/`) | Se crean desde la app; **solo se leen desde la consola** |

Todo exige un correo verificado. Las pruebas `tests/e2e/seguridad.js` comprueban estas reglas contra el
emulador con el archivo real.

## Moderación: denuncias

Las denuncias quedan en Firestore → colección `reports` (quién denuncia, a quién, el motivo, dónde y un
extracto). Revísalas desde la consola de Firebase. Para actuar:

1. Si alguien incumple las normas, desactiva su cuenta en Authentication → Usuarios → «Inhabilitar cuenta».
2. Si hace falta, borra su perfil (`profiles/{uid}`) y su código (`codes/…`).
3. Responde a quien denunció si dejó un modo de contacto.

## Límites de uso y App Check

Las reglas de Firestore no pueden contar cuántas peticiones hace cada persona. Lo que sí se aplica:
tamaños máximos, quién puede escribir dónde y el bloqueo. Para frenar abusos con scripts:

1. **App Check** (Firebase → App Check): registra la app web con **reCAPTCHA Enterprise** y empieza en modo
   «supervisión» para ver cuánto tráfico vendría de fuera de la app. Ojo: la app de **Android** es una
   WebView y la de **escritorio** carga desde `app://`, y ninguna de las dos puede obtener un token de
   reCAPTCHA. **No actives la aplicación obligatoria** hasta que esas apps tengan su propio proveedor (Play
   Integrity en Android con el SDK nativo; un token de depuración o un servidor propio para el escritorio).
2. **Cuotas**: Google Cloud → APIs → Cloud Firestore API → Cuotas, y un **presupuesto con alertas** (ver
   [COSTES.md](COSTES.md)).
3. **Dominios autorizados** de Authentication: deja solo `whider-red.vercel.app` (y tu dominio propio si lo
   compras) además de `localhost` para desarrollo.

## Verificación en dos pasos (2FA)

**Estudio:**

- Firebase Authentication ofrece segundo factor por **SMS** y por **app de autenticación (TOTP)** solo con
  **Identity Platform** (plan de pago por uso; los SMS se cobran aparte y varían por país).
- TOTP es la opción recomendable: no cuesta por mensaje y funciona sin cobertura. El SDK web lo soporta
  (`multiFactor`, `TotpMultiFactorGenerator`) y WHIDER ya tiene lector y generador de QR para el alta.
- Quien entra con **Google** ya puede tener la verificación en dos pasos en su cuenta de Google; afecta solo
  a las cuentas de correo y contraseña.
- En la app de escritorio el inicio de sesión con Google va por el navegador del sistema, que ya pide el
  segundo factor de Google.

**Estado:** no implementado en la 1.1. Pasos para hacerlo: activar Identity Platform en la consola,
habilitar TOTP, añadir al paquete de Firebase (`tools/firebase-bundle/entry.js`) las funciones de MFA, una
pantalla en Ajustes → Cuenta para darlo de alta (QR + código) y pedir el código al iniciar sesión
(`auth/multi-factor-auth-required`). El emulador de Authentication no admite TOTP, así que habría que
probarlo contra un proyecto de pruebas.

## Otras recomendaciones

- La clave de firma de **depuración** de Android está en el repositorio a propósito (solo firma el APK de
  pruebas); la clave de **subida a Google Play** nunca debe estar en el repositorio: va en los secretos de
  GitHub (ver [PUBLICAR-EN-GOOGLE-PLAY.md](PUBLICAR-EN-GOOGLE-PLAY.md)).
- Los correos de verificación y de cambio de contraseña salen en español (`auth.languageCode = 'es'`). Para
  que salgan desde un dominio propio hace falta comprar el dominio y configurar SPF y DKIM en Authentication
  → Plantillas.
