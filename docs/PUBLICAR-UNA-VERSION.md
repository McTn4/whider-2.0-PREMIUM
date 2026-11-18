# Publicar una versión de WHIDER

Una versión es una foto de la app con número, notas y todos sus instaladores. Desde la 1.1 se publica sola en
GitHub al cambiar el número en `package.json`; la web (Vercel) se sigue publicando con cada cambio en `main`.

## Números de versión

[Versionado semántico](https://semver.org/lang/es/): `MAYOR.MENOR.PARCHE`.

| Cambio | Ejemplo | Cuándo |
| --- | --- | --- |
| Parche | 1.1.0 → 1.1.1 | Solo correcciones |
| Menor | 1.1.1 → 1.2.0 | Funciones nuevas que no rompen nada |
| Mayor | 1.2.0 → 2.0.0 | Algo deja de funcionar como antes (datos, cuentas, requisitos del sistema) |
| De prueba | 1.2.0-beta.1, 1.2.0-rc.1 | Para probar antes de la estable (`alpha` < `beta` < `rc`, de 1 a 29) |

La versión de verdad está en **`package.json`**. `node tools/version.js` la copia a todo lo demás (no se toca a mano):

| Dónde | Qué |
| --- | --- |
| `desktop/package.json` | La app de escritorio y sus actualizaciones automáticas |
| `android/app/build.gradle` | `versionName` y `versionCode` = MAYOR·1.000.000 + MENOR·10.000 + PARCHE·100 + (alpha 1-29 · beta 31-59 · rc 61-89 · estable 99). Siempre sube, como exige Google Play: 1.1.0-beta.1 → 1010031, 1.1.0 → 1010099 |
| `js/core/version.js` | La versión que enseña la app y las notas de «Novedades» (sacadas del CHANGELOG) |
| `sitio/descargas.js` | La versión que anuncia la portada: la última **estable** del CHANGELOG |
| `sitio/index.html` y `sitio/en/index.html` | Esa versión en la portada («WHIDER 1.2») y, en la de español, sus novedades (las primeras de «Novedades» del CHANGELOG, en su primera frase) |

## Pasos

1. **Escribe la entrada en [`CHANGELOG.md`](../CHANGELOG.md)**, arriba del todo:

   ```markdown
   ## [1.2.0] · 2026-12-01

   Una frase que resuma la versión.

   ### Novedades
   - **Lo nuevo**: qué es y dónde está.
   ### Mejoras
   ### Correcciones
   ### Seguridad
   ### Para desarrolladores
   ```

   Las cuatro primeras secciones se ven en la app (Ajustes → Ayuda → Novedades y el aviso en Hoy); «Para
   desarrolladores», solo en GitHub. Escribe para quien usa la app: qué puede hacer ahora y dónde.

2. **Cambia el número** (y todo lo que depende de él):

   ```bash
   node tools/version.js 1.2.0
   ```

   Si es una versión **estable nueva menor o mayor** (1.2.0, 2.0.0), traduce también sus novedades en la portada
   en inglés: la lista `<ul class="news">` de `sitio/en/index.html`, con `data-news-version="1.2"`. Hasta entonces
   `npm run version:check` lo recuerda y falla (las de un parche, 1.2.1, valen las de la 1.2).

3. **Comprueba** que todo está en verde:

   ```bash
   npm run check
   ```

   ```bash
   npm run test:todo
   ```

4. **Sube los cambios a `main`.** El flujo [«Publicar versión»](../.github/workflows/release.yml) ve que la etiqueta
   `v1.2.0` no existe y entonces:
   - compila Windows, macOS (Apple Silicon e Intel), Linux (AppImage y .deb) y Android;
   - comprueba que `latest.yml` es de esa versión;
   - crea la publicación `v1.2.0` con las notas del CHANGELOG, las instrucciones de instalación y las sumas SHA-256.

   Una versión **de prueba** sale como *Pre-release*: no la reciben las actualizaciones automáticas ni la anuncia
   la portada. Una **estable** pasa a ser *Latest*.

## Qué recibe cada persona

| Dónde usa WHIDER | Cómo le llega |
| --- | --- |
| Navegador | Al recargar (el Service Worker trae los archivos nuevos). Ve el aviso de novedades en Hoy |
| Windows (instalador) y Linux (AppImage) | Se descarga sola en segundo plano, comprobando su SHA-512, y se instala al cerrar la app (o con «Reiniciar ahora») |
| macOS y Linux (.deb) | Aviso del sistema y en la app con el enlace al instalador de su sistema (en el Mac, sin la firma de pago de Apple, no puede instalarse sola) |
| Android desde GitHub | Una vez al día mira si hay una estable nueva y ofrece descargar el APK |
| Android desde Google Play | La tienda la actualiza (subes el AAB de la ejecución, ver [PUBLICAR-EN-GOOGLE-PLAY.md](PUBLICAR-EN-GOOGLE-PLAY.md)) |

Las versiones 1.0 de escritorio no traen el actualizador: quien las tenga instala la 1.1 a mano una vez; desde ahí,
se actualiza sola.

## Si una versión sale mal

- **No se borra**: publica cuanto antes una corrección (`1.2.1`). Las actualizaciones automáticas nunca bajan de
  versión, así que la forma de arreglarlo es subir.
- Mientras tanto, en GitHub → Releases → la versión → *Edit*, marca **Set as a pre-release**: deja de ser *Latest*,
  las apps de escritorio dejan de ofrecerla y la portada vuelve a la anterior estable.
- La web se puede volver atrás al momento desde Vercel (*Deployments → … → Promote to Production* en el despliegue
  anterior).

## Comprobaciones automáticas

- `npm run version:check` (también en la integración continua): todo lleva la misma versión y el CHANGELOG la tiene,
  con las versiones en orden.
- `tests/unit/versiones.test.js`: los códigos de Android siempre suben, el CHANGELOG se lee bien y las notas de la app
  no incluyen lo de desarrolladores.
- `tests/e2e/novedades.js` y `tests/e2e/escritorio-actualizaciones.js`: el aviso de novedades, el aviso de versión
  nueva en Android y una actualización de escritorio de verdad (descarga, SHA-512 y rechazo de un archivo alterado)
  contra un servidor que hace de GitHub.
