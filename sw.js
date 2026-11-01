/**
 * WHIDER PRO - SERVICE WORKER (PWA & OFFLINE ENGINE)
 */
var CACHE_NAME = 'whider-pro-v3-premium';
var ASSETS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
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
      return cache.addAll(ASSETS_TO_CACHE);
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
          if (name !== CACHE_NAME) {
            return caches.delete(name);
          }
        })
      );
    }).then(function () {
      return self.clients.claim();
    })
  );
});

self.addEventListener('fetch', function (event) {
  event.respondWith(
    caches.match(event.request).then(function (response) {
      return response || fetch(event.request).catch(function () {
        // Fallback en caso de estar offline
        return caches.match('./index.html');
      });
    })
  );
});
