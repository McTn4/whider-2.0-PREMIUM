# Dominio propio

WHIDER funciona hoy en `whider-red.vercel.app`. Un dominio propio da una dirección fácil de recordar y de confiar,
permite enviar los correos de la cuenta desde él y es lo que esperan Google Play y quien busca la app.

**Plan: `whider.com`**, todavía sin comprar (comprar es decisión de quien publica la app). El 21 de noviembre de
2026 estaba libre: 12,03 USD al año en Vercel, lo mismo al renovar.

## Disponibilidad (consultada en el registro de Vercel)

| Dominio | ¿Libre? | Precio en Vercel |
| --- | --- | --- |
| `whider.com` | Sí (21 de noviembre de 2026) | 12,03 USD al año |
| `whider.app` | Sí (21 de noviembre de 2026) | 9,99 USD el primer año; 15 USD al renovar |
| `whider.es` | Sí (18 de noviembre de 2026) | Vercel no vende `.es`: se compra en un registrador español y se apunta a Vercel |

La disponibilidad cambia: se vuelve a comprobar justo antes de comprar.

## Lo que pasó el 20 de noviembre de 2026 (para que no se repita)

Se añadió `whider.app` al proyecto de Vercel **sin comprarlo** y se hizo que `whider-red.vercel.app` redirigiera a él.
Como `whider.app` no llevaba a ninguna parte, la web, la app en el navegador, las invitaciones y la política de
privacidad dejaron de funcionar unas 13 horas, y cualquiera que comprara `whider.app` habría recibido todas las
visitas. Al quitar `whider.app`, Vercel quitó también `whider-red.vercel.app` (las direcciones que redirigen a un
dominio se van con él); se volvió a añadir, sin redirección. Dos reglas:

- **Nunca redirigir a un dominio que no está comprado y respondiendo.**
- Para quitar un dominio al que redirige otro, quitar antes la redirección.

## Orden seguro al tenerlo

1. **Comprar** `whider.com` (Vercel → *Domains* → *Buy*) y **añadirlo al proyecto** «whider», conectado a
   **Production**. Dejar `whider-red.vercel.app` tal cual, **sin redirección**.
2. **Comprobar** que `https://whider.com` enseña la portada y `https://whider.com/app` la app.
3. **Firebase** → *Authentication → Settings → Authorized domains*: añadir `whider.com` (si no, no se puede entrar con
   Google desde él). En *Templates*, el dominio de los correos (con sus registros SPF y DKIM).
4. **La app** (lo hace el desarrollo): la dirección base de los enlaces (`links.base` en
   [`js/config.js`](../js/config.js)) y las páginas que la repiten (`sitio/`, `i/index.html`, `privacidad/`, `privacy/`,
   `js/core/invite.js`, `js/screens/settings.js`, `storage-cors.json`, `tools/version.js`).
5. **Android**: el dominio de los enlaces que abren la app (`android:host` en
   [`AndroidManifest.xml`](../android/app/src/main/AndroidManifest.xml) y `MainActivity.java`) y
   [`.well-known/assetlinks.json`](../.well-known/assetlinks.json) servido desde el dominio nuevo.
6. **Política de privacidad y Google Play**: las direcciones de la política y de «eliminar la cuenta» en la ficha.
7. **Solo entonces**, que la dirección antigua lleve a la nueva. Ojo: quien usaba la web **sin cuenta** tiene sus datos
   guardados en el navegador **con la dirección antigua**; con una redirección sin más, en la nueva vería la app vacía.
   Antes de redirigir hay que darle una forma de llevárselos (la dirección antigua sigue sirviendo la app y ofrece
   «Llevar mis datos a whider.com»); con cuenta basta con entrar en la nueva.

Después, `npm run test:todo` y una prueba a mano de invitación por enlace en el móvil.
