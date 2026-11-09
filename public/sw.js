// DALTA Esports service worker: only an offline fallback page.
// It caches /offline (and the logo it shows) when installed. When a page can't load because the
// device is offline, /offline is shown instead. Nothing else is cached: scores, brackets and
// accounts always come fresh from the network, so nobody sees old or someone else's data.
const CACHE = 'dalta-offline-v1';
const OFFLINE_URL = '/offline';
const ASSETS = [OFFLINE_URL, '/icons/icon-192.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  // Remove caches of older versions of this file
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  // Only page loads; everything else goes to the network untouched
  if (request.mode !== 'navigate') return;
  event.respondWith(
    fetch(request).catch(() => caches.match(OFFLINE_URL).then((page) => page || Response.error())),
  );
});
