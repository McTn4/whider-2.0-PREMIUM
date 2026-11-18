# Dominio propio

WHIDER funciona hoy en `whider-red.vercel.app`. Un dominio propio da una dirección fácil de recordar y de confiar,
permite enviar los correos de la cuenta desde él y es lo que esperan Google Play y quien busca la app.
**No se ha comprado ninguno**: comprar es decisión de quien publica la app.

## Disponibilidad (consultada el 18 de noviembre de 2026 en el registro de Vercel)

| Dominio | ¿Libre? | Precio en Vercel |
| --- | --- | --- |
| `whider.app` | Sí | 9,99 USD el primer año; 15 USD al renovar |
| `whider.com` | Sí | 12,03 USD al año |
| `whider.es` | Sí | Vercel no vende `.es`: se compra en un registrador español y se apunta a Vercel |
| `whider.io`, `whider.co`, `getwhider.com`, `whiderapp.com` | Sí | — |

Recomendación: **`whider.app`** (es de una app, y el dominio `.app` obliga a HTTPS en todos los navegadores) y, si
se quiere proteger el nombre, también `whider.com` redirigiendo al primero. La disponibilidad cambia: se vuelve a
comprobar justo antes de comprar.

## Qué cambiar al tenerlo

1. **Vercel** → el proyecto → *Settings → Domains*: añadir el dominio (si se compró fuera, crear los registros DNS
   que indica). Dejar `whider-red.vercel.app` funcionando: los enlaces ya compartidos siguen valiendo.
2. **Firebase** → *Authentication → Settings → Authorized domains*: añadir el dominio (si no, no se puede entrar con
   Google desde él). En *Templates*, el dominio de los correos (con sus registros SPF y DKIM).
3. **La app**: la dirección base de los enlaces (`links.base` en [`js/config.js`](../js/config.js)) y las páginas que la
   repiten (`sitio/index.html`, `i/index.html`, `js/core/invite.js`, `js/screens/settings.js`).
4. **Android**: el dominio de los enlaces que abren la app (`android:host` en
   [`AndroidManifest.xml`](../android/app/src/main/AndroidManifest.xml) y `MainActivity.java`) y el mismo
   [`.well-known/assetlinks.json`](../.well-known/assetlinks.json) servido desde el dominio nuevo.
5. **Política de privacidad y Google Play**: las direcciones de la política y de «eliminar la cuenta» en la ficha.

Después, `npm run test:todo` y una prueba a mano de invitación por enlace en el móvil.
