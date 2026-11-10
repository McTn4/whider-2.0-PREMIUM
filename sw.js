/**
 * WHIDER · Service Worker: funciona sin conexión y se actualiza solo
 * (estrategia "red primero" con respaldo en caché).
 */
var CACHE_NAME = 'whider-v8.0.1';
var ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/icon.svg',
  './fonts/hanken-grotesk-latin-wght-normal.woff2',
  './css/components.css',
  './css/cuaderno.css',
  './css/desktop.css',
  './css/layout.css',
  './css/screens.css',
  './css/social.css',
  './css/tokens.css',
  './js/app.js',
  './js/config.js',
  './js/router.js',
  './js/core/audio.js',
  './js/core/auth.js',
  './js/core/automations.js',
  './js/core/chat.js',
  './js/core/community.js',
  './js/core/files.js',
  './js/core/habits.js',
  './js/core/invite.js',
  './js/core/notify.js',
  './js/core/pages.js',
  './js/core/pagesync.js',
  './js/core/parse.js',
  './js/core/plan.js',
  './js/core/records.js',
  './js/core/stats.js',
  './js/core/store.js',
  './js/core/sync.js',
  './js/core/util.js',
  './js/screens/auth.js',
  './js/screens/automations.js',
  './js/screens/calendar.js',
  './js/screens/chats.js',
  './js/screens/focus.js',
  './js/screens/friends.js',
  './js/screens/habits.js',
  './js/screens/home.js',
  './js/screens/more.js',
  './js/screens/notes.js',
  './js/screens/onboarding.js',
  './js/screens/plans.js',
  './js/screens/progress.js',
  './js/screens/records.js',
  './js/screens/reports.js',
  './js/screens/settings.js',
  './js/screens/stats.js',
  './js/screens/tasks.js',
  './js/ui/avatar.js',
  './js/ui/blocks.js',
  './js/ui/character.js',
  './js/ui/charts.js',
  './js/ui/controls.js',
  './js/ui/dbview.js',
  './js/ui/devices.js',
  './js/ui/editor.js',
  './js/ui/filters.js',
  './js/ui/fx.js',
  './js/ui/keys.js',
  './js/ui/layout.js',
  './js/ui/menu.js',
  './js/ui/palette.js',
  './js/ui/profile.js',
  './js/ui/quickadd.js',
  './js/ui/select.js',
  './js/ui/sheet.js',
  './js/ui/sidebar.js',
  './js/ui/taskcard.js',
  './js/ui/toast.js',
  './js/vendor/firebase.js',
  './js/vendor/jsqr.js',
  './js/vendor/qrcode.js'
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      return Promise.all(ASSETS.map(function (url) {
        return cache.add(new Request(url, { cache: 'reload' })).catch(function () { /* recurso opcional */ });
      }));
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (names) {
      return Promise.all(names.map(function (n) {
        if (n.indexOf('whider-') === 0 && n !== CACHE_NAME) return caches.delete(n);
      }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (event) {
  var req = event.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    fetch(req).then(function (res) {
      if (res && res.ok && res.type === 'basic') {
        var copy = res.clone();
        caches.open(CACHE_NAME).then(function (c) { c.put(req, copy); });
      }
      return res;
    }).catch(function () {
      return caches.match(req, { ignoreSearch: true }).then(function (hit) {
        if (hit) return hit;
        if (req.mode === 'navigate') return caches.match('./index.html');
        return Response.error();
      });
    })
  );
});

// Pulsar una notificación abre (o enfoca) la app en el centro de avisos
self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  var screen = (event.notification.data && event.notification.data.screen) || 'home';
  var target = new URL('./index.html#' + screen, self.registration.scope).href;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (list) {
      for (var i = 0; i < list.length; i++) {
        if (list[i].url.indexOf(self.registration.scope) === 0 && 'focus' in list[i]) {
          list[i].postMessage({ type: 'open-screen', screen: screen });
          return list[i].focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(target);
    })
  );
});
