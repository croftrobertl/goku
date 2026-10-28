// Offline cache. Bump CACHE_VERSION (and VERSION in js/version.js) for every release;
// the app then shows "New version available" and never reloads on its own.
const CACHE_VERSION = '1.0.1';
const CACHE = 'goku-app-' + CACHE_VERSION;
const FILES = [
  './', './index.html', './manifest.webmanifest', './css/app.css',
  './js/app.js', './js/db.js', './js/time.js', './js/crypto.js', './js/ui.js', './js/state.js',
  './js/lock.js', './js/onboarding.js', './js/engine.js', './js/perf.js', './js/settings.js', './js/version.js',
  './icons/apple-touch-icon.png', './icons/favicon-32.png', './icons/favicon-48.png', './icons/favicon-192.png', './icons/icon-192.png', './icons/icon-512.png', './icons/icon-maskable-512.png',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES.map(f => new Request(f, { cache: 'reload' })))));
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k.startsWith('goku-app-') && k !== CACHE) await caches.delete(k);
    await self.clients.claim();
  })());
});

self.addEventListener('message', e => { if (e.data === 'SKIP_WAITING') self.skipWaiting(); });

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    if (req.mode === 'navigate') return (await cache.match('./index.html')) || fetch(req);
    return (await cache.match(req, { ignoreSearch: true })) || fetch(req);
  })());
});
