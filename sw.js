/**
 * WHIDER PRO - SERVICE WORKER (PWA & OFFLINE ENGINE)
 */
var CACHE_NAME = 'whider-pro-v4-premium-2.2.1';
var ASSETS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/icon.svg',
  './fonts/archivo-latin-wdth-normal.woff2',
  './fonts/ibm-plex-sans-latin-400-normal.woff2',
  './fonts/ibm-plex-sans-latin-500-normal.woff2',
  './fonts/ibm-plex-sans-latin-600-normal.woff2',
  './fonts/ibm-plex-sans-latin-700-normal.woff2',
  './css/variables.css',
  './css/layout.css',
  './css/components.css',
  './css/screen-tasks.css',
  './css/screen-calendar.css',
  './css/screen-warnings.css',
  './css/screen-stats.css',
  './css/screen-settings.css',
  './css/premium.css',
  './js/audio.js',
  './js/state.js',
  './js/notifications.js',
  './js/components/toast.js',
  './js/components/modal.js',
  './js/router.js',
  './js/premium.js',
  './js/screens/tasksScreen.js',
  './js/screens/calendarScreen.js',
  './js/screens/warningsScreen.js',
  './js/screens/statsScreen.js',
  './js/screens/settingsScreen.js',
  './js/app.js'
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      // Se cachea cada recurso por separado: un único fallo no debe impedir la instalación
      return Promise.all(ASSETS_TO_CACHE.map(function (url) {
        return cache.add(new Request(url, { cache: 'reload' })).catch(function (err) {
          console.warn('[SW] No se pudo cachear', url, err);
        });
      }));
    }).then(function () {
      return self.skipWaiting();
    })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (cacheNames) {
      return Promise.all(
        cacheNames.map(function (name) {
          if (name.indexOf('whider-pro-') === 0 && name !== CACHE_NAME) {
            return caches.delete(name);
          }
        })
      );
    }).then(function () {
      return self.clients.claim();
    })
  );
});

// Estrategia "red primero": siempre se sirve la versión más reciente si hay conexión
// (así las actualizaciones llegan a los usuarios) y la caché actúa como respaldo offline.
self.addEventListener('fetch', function (event) {
  var req = event.request;
  if (req.method !== 'GET') return;

  var url = new URL(req.url);
  // Solo recursos propios; el resto (p. ej. el generador de QR) va directo a la red
  if (url.origin !== self.location.origin) return;
  // La API local de serve.py nunca se cachea
  if (url.pathname.indexOf('/api/') !== -1) return;

  event.respondWith(
    fetch(req).then(function (response) {
      if (response && response.ok && response.type === 'basic') {
        var copy = response.clone();
        caches.open(CACHE_NAME).then(function (cache) { cache.put(req, copy); });
      }
      return response;
    }).catch(function () {
      return caches.match(req, { ignoreSearch: true }).then(function (cached) {
        if (cached) return cached;
        // Sin conexión: las navegaciones caen en la app; el resto, error de red normal
        if (req.mode === 'navigate') return caches.match('./index.html');
        return Response.error();
      });
    })
  );
});

// Al pulsar una notificación de aviso, enfocar (o abrir) la app en la pantalla de avisos
self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  var target = new URL('./index.html#warnings', self.registration.scope).href;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (list) {
      for (var i = 0; i < list.length; i++) {
        var client = list[i];
        if (client.url.indexOf(self.registration.scope) === 0 && 'focus' in client) {
          client.postMessage({ type: 'open-warnings' });
          return client.focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(target);
    })
  );
});
