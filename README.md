# WHIDER 4.1

**Tu día, bajo control.** WHIDER es una app de productividad para Android (y cualquier navegador) que reúne tareas, agenda, avisos por incumplimiento, modo enfoque y seguimiento de progreso, con un diseño oscuro y efectos fluidos. Incluye **cuentas de usuario** (correo y contraseña o Google) con **copia en la nube**, y un **registro de marcas** que conserva tus récords para siempre. Funciona también sin conexión.

<p align="center">
  <img src="docs/capturas/02-inicio.jpg" width="200" alt="Inicio">
  <img src="docs/capturas/03-tareas.jpg" width="200" alt="Tareas">
  <img src="docs/capturas/09-editor.jpg" width="200" alt="Editor de tareas">
  <img src="docs/capturas/04-agenda.jpg" width="200" alt="Agenda">
</p>
<p align="center">
  <img src="docs/capturas/05-enfoque.jpg" width="200" alt="Enfoque">
  <img src="docs/capturas/06-perfil.jpg" width="200" alt="Perfil">
  <img src="docs/capturas/11-marcas.jpg" width="200" alt="Marcas">
  <img src="docs/capturas/13-editar-perfil.jpg" width="200" alt="Editar perfil con foto">
</p>

---

## ✨ Funciones

**Cuentas y copia en la nube**
- Registro con **correo y contraseña** (con verificación del correo, medidor de seguridad de la contraseña y recuperación por correo) o con **Google** (en Android, con el selector nativo de cuentas del teléfono).
- Opción para admitir **solo correos de empresa** (`allowedEmailDomains`).
- Tus tareas, listas, marcas, enfoque y ajustes se guardan en tu cuenta y se **sincronizan en tiempo real** entre dispositivos; los cambios de varios móviles se fusionan sin perder nada.
- Funciona sin internet y sincroniza al volver la conexión. Cerrar sesión y **eliminar la cuenta** desde Ajustes.
- Modo **sin cuenta** opcional: los datos se quedan en el dispositivo y se suben a la cuenta si la creas más tarde.
- Configuración: [docs/CONFIGURAR-CUENTAS.md](docs/CONFIGURAR-CUENTAS.md).

**Registro de marcas**
- **Récords automáticos**: mejor racha, más tareas en un día, mejor semana y más enfoque en un día, con su fecha. Aviso de "¡Nueva marca!" al superarlos e hitos de tareas completadas (10, 25, 50, 100…).
- **Marcas personales**: crea las tuyas (tiempos, pesos, distancias, páginas…), indica si es mejor más o menos, registra valores con fecha y nota y sigue tu evolución con su gráfica.
- **Historial de marcas** con todas las que has batido.
- El historial es permanente: **no se borra aunque elimines tareas**, y queda guardado en tu cuenta.

**Tus datos no se pierden**
- Todo se guarda al instante en el dispositivo; en el APK además en un almacén nativo de Android, que los recupera aunque el sistema limpie el almacenamiento de la app.
- Con cuenta, también en la nube: al iniciar sesión en otro móvil lo recuperas todo.

**Tareas**
- Prioridades (Normal, Destacada, Importante, Urgente) con color propio.
- **Listas** personalizables con color (Personal, Trabajo, Salud… o las que quieras).
- **Subtareas** con barra de progreso, **notas** y **repeticiones** (cada día, días laborables, cada semana, cada mes).
- **Gestos**: desliza → para completar y ← para eliminar, con botón **Deshacer**.
- Tres pestañas (Hoy · Próximas · Todas), búsqueda en títulos, notas y subtareas, filtro por lista y 4 tipos de orden en un único menú.
- Grupos claros: Vencidas, Hoy, Mañana, Próximos 7 días, Más adelante, Sin fecha y Completadas (plegadas).

**Avisos**
- **Recordatorio previo** configurable (de 5 minutos a 1 día antes) y **alerta si no la haces** al vencer el plazo, repetible cada 10, 20 o 60 minutos.
- **Horas de silencio**: sin sonidos ni notificaciones en tu horario de descanso (los avisos se retrasan hasta que termina).
- En la app Android, los recordatorios **suenan aunque la app esté cerrada** y se restauran al reiniciar el móvil.
- Centro de avisos: lo vencido primero, con una sola acción (Posponer: 1 hora, esta tarde, mañana o eligiendo fecha).

**Agenda**
- Calendario mensual con mapa de carga, marcas por prioridad y gesto de deslizar para cambiar de mes.
- Agenda del día con línea de tiempo y botón para añadir una tarea a ese día.

**Enfoque (Pomodoro)**
- Anillo animado, rondas, pausas cortas y largas automáticas y tarea vinculada.
- Exacto aunque la app pase a segundo plano. Notificación y sonido al terminar.

**Progreso**
- Niveles y experiencia, racha actual y mejor racha, % de cumplimiento y minutos de enfoque.
- Gráfica de 7/30 días, **mapa de constancia** de 15 semanas, reparto por listas y **11 logros** desbloqueables.
- Confeti al completar todas las tareas del día.

**Personalización (Perfil → Ajustes)**
- 6 colores de acento (Iris, Océano, Jade, Brasa, Orquídea, Oro): toda la app cambia al instante.
- Tamaño de texto (4 niveles), densidad cómoda o compacta y modo de animaciones reducidas.
- Pantalla al abrir.
- Lista por defecto, aviso por defecto, primer día de la semana, formato 12/24 h, ocultar completadas y confirmación al eliminar.
- Duración de las sesiones de enfoque y de las pausas.
- Presentación inicial breve: tu foto, tu nombre y tu color.

---

## 📱 Pantalla y Android

- La interfaz ocupa exactamente la pantalla del dispositivo (barra superior, contenido con scroll y barra inferior flotante) y respeta las zonas seguras (muesca y barra de gestos).
- Se adapta a móviles pequeños (360 px), grandes, en horizontal y a tablets.
- En el APK, el tamaño de fuente del sistema no descuadra el diseño: el tamaño del texto se controla desde **Ajustes → Apariencia**.
- Teclado: los formularios se redimensionan para no quedar tapados.
- Icono adaptable (Android 8+), icono temático (Android 13+) e icono propio en la barra de notificaciones.
- Botón **Atrás**: cierra hojas y menús, vuelve a la pantalla inicial y solo entonces sale.

---

## ▶️ Probar en el ordenador

Con Python 3.8 o superior:

```bash
python serve.py
```

Se abre `http://localhost:8080` y la consola muestra también la dirección para el móvil en tu red Wi‑Fi. Opciones: `python serve.py 9000` (otro puerto) y `python serve.py --no-open`.

Si tienes [`cloudflared`](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/) instalado, el servidor crea además un enlace HTTPS temporal: ábrelo en Chrome del móvil y usa **⋮ → Instalar aplicación** para instalarla como app.

## 🛠️ Compilar el APK (Android Studio)

1. Sincroniza la web con el proyecto Android:
   ```bash
   python package_apk.py --sync
   ```
2. Abre la carpeta **`android/`** en Android Studio (JDK 17 o superior) y pulsa **Run**, o desde la terminal:
   ```bash
   cd android
   ./gradlew assembleDebug
   ```
3. El APK queda en `android/app/build/outputs/apk/debug/app-debug.apk`.

---

## 📂 Estructura

```text
.
├── index.html              # Estructura de la app + juego de iconos SVG propio
├── manifest.json           # PWA: iconos y accesos directos (#tasks, #calendar, #focus, #alerts)
├── sw.js                   # Funcionamiento sin conexión y clic en notificaciones
├── css/
│   ├── tokens.css          # Colores, tipografía, tamaños y movimiento
│   ├── layout.css          # Estructura a pantalla completa, fondo animado y barra inferior
│   ├── components.css      # Botones, tarjetas, hojas, interruptores, avisos…
│   └── screens.css         # Estilos de cada pantalla
├── firestore.rules         # Reglas de seguridad de la base de datos (cada usuario, solo sus datos)
├── firebase.json           # Configuración de Firebase (reglas, hosting y emuladores)
├── js/
│   ├── config.js           # ← Configuración de cuentas (Firebase): ver docs/CONFIGURAR-CUENTAS.md
│   ├── vendor/firebase.js  # SDK de Firebase empaquetado (funciona sin CDN)
│   ├── core/               # util, store, audio, notify, records (marcas), auth (cuentas), sync (nube)
│   ├── ui/                 # efectos, avisos flotantes, hojas, controles, editor y tarjeta de tarea
│   ├── screens/            # home, tasks, calendar, focus, progress, records, alerts, settings, onboarding, auth
│   ├── router.js
│   └── app.js
├── icons/                  # Logotipo (SVG) e iconos PNG 192/512/maskable
├── fonts/                  # Archivo e IBM Plex Sans (locales)
├── android/                # Proyecto nativo (WebView + recordatorios + notificaciones)
├── tools/firebase-bundle/  # Cómo regenerar js/vendor/firebase.js
├── serve.py                # Servidor local para PC y móvil
└── package_apk.py          # Copia la web a android/…/assets/www y crea el ZIP del proyecto
```

## 🔒 Privacidad

Sin cuenta, todo se queda en el dispositivo. Con cuenta, los datos se guardan además en tu proyecto de Firebase, protegidos por reglas que solo permiten a cada usuario acceder a lo suyo ([`firestore.rules`](firestore.rules)). WHIDER nunca ve ni guarda contraseñas (las gestiona Firebase Authentication), no muestra publicidad y permite eliminar la cuenta y sus datos desde Ajustes.

---

## 📝 Novedades de la 4.1

**Más rápida**
- Firebase se carga en segundo plano después de mostrar la app y pesa 3 veces menos (Firestore "lite": 631 KB → 203 KB).
- Solo se guarda lo que cambia, y en Android la copia nativa se escribe agrupada y sin bloquear (antes, cada toque escribía 8 veces en disco).
- Sin efectos caros: fuera el desenfoque en tiempo real, el grano animado y las sombras grandes. Transiciones más cortas.
- Medido en un móvil de gama media simulado: completar una tarea pasa de 205 ms a 89 ms y abrir Tareas de 191 ms a 83 ms.

**Más tranquila y ordenada**
- Barra superior con solo dos botones (tu foto y los avisos). Ajustes y Marcas viven dentro del Perfil.
- Inicio con lo esencial: tu progreso de hoy y la lista de hoy.
- Tareas en tres pestañas (Hoy · Próximas · Todas), con la búsqueda y las opciones en un único menú.
- Tarjetas de tarea con una línea de texto discreta en lugar de "pastillas"; editor con los detalles en filas.
- Avisos con una sola acción (Posponer); un único aviso flotante aunque venzan varias tareas.
- Ajustes en apartados; la app empieza limpia, sin tareas de ejemplo.

**Perfil con foto**
- Foto de perfil desde la galería (selector de fotos de Android, sin permisos), recortada y comprimida (~25 KB) y sincronizada con tu cuenta. Con Google se usa tu foto de Google si no eliges otra.

**Correcciones**
- Google en Android: los fallos de configuración (huella SHA‑1 o paquete no registrados) ya no se quedan en silencio; la app explica qué revisar y muestra el detalle técnico.
- El nombre ya no se sobrescribe con el de Google al entrar desde otro dispositivo, y la presentación inicial no se repite.
- El historial y las marcas se reparan solos si llegan datos incompletos de versiones anteriores.

## 📝 Novedades de la 4.0

- Cuentas de usuario con correo y contraseña (verificación y recuperación) y con Google.
- Copia en la nube con sincronización en tiempo real entre dispositivos y funcionamiento sin conexión.
- Registro de marcas: récords automáticos con historial permanente y marcas personales con su evolución.
- Android: la app se sirve desde un origen seguro local, con espejo nativo de los datos y migración automática desde la versión anterior.

## 📝 Novedades de la 3.0

- Rediseño completo: tema oscuro único y coherente, acentos configurables, fondo animado, transiciones entre pantallas, efectos al pulsar, animación al completar y confeti.
- Iconos propios en SVG y nuevo logotipo (una W cuyo último trazo sube como un ✓).
- Nuevas pantallas: Enfoque, Progreso (con logros y mapa de constancia) y presentación inicial.
- Nuevas funciones: listas, subtareas, notas, repeticiones, recordatorios previos, horas de silencio, búsqueda, orden, gestos con deshacer y decenas de ajustes.
- Android: recordatorios con la app cerrada, vibración nativa, tamaño de texto estable e iconos adaptables.
- Eliminado: copia de seguridad/exportación, descargas e instalación de APK desde la app y la marca "PRO".
