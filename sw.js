// Offline cache. Release with tools/release.sh, which bumps CACHE_VERSION here and
// VERSION in js/version.js together. The app then offers "Update" and never reloads on its own.
const CACHE_VERSION = '2.1.0';
const CACHE = 'goku-app-' + CACHE_VERSION;
const FILES = [
  './', './index.html', './manifest.webmanifest', './css/app.css',
  './js/app.js', './js/db.js', './js/time.js', './js/crypto.js', './js/ui.js', './js/state.js', './js/validate.js',
  './js/lock.js', './js/onboarding.js', './js/engine.js', './js/perf.js', './js/settings.js', './js/devcheck.js', './js/themes.js', './js/units.js', './js/avatar.js', './js/coach.js', './js/fuel.js', './js/activity.js', './js/insights.js', './js/homecards.js', './js/perf-score.js', './js/why.js', './js/trend.js', './js/skills.js', './js/milestones.js', './js/homelayout.js', './js/duel.js', './js/figure.js', './js/moves.js', './js/movepicker.js', './js/foods.js', './js/fuzzy.js', './data/everyday.json', './js/nutrition.js', './js/scan.js', './js/health.js', './js/version.js',
  './icons/apple-touch-icon.png', './icons/favicon-32.png', './icons/favicon-48.png', './icons/favicon-192.png',
  './icons/icon-192.png', './icons/icon-512.png', './icons/icon-maskable-512.png',
];

// The food list and barcode scanner are big and rarely change, so they live in their own
// cache that survives app updates; bump DATA_VERSION only when tools/build-foods.py runs again.
const DATA_VERSION = 'foods-2026-10-29';
const DATA = 'goku-data-' + DATA_VERSION;
const DATA_FILES = ['./data/foods.json', './vendor/zxing.min.js'];

// Each file is fetched with ?v=<version> so GitHub's CDN can't hand back a stale copy
// from before the release, then stored under its plain address.
self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await Promise.all(FILES.map(async f => {
      const res = await fetch(new Request(f + (f.includes('?') ? '&' : '?') + 'v=' + CACHE_VERSION, { cache: 'reload' }));
      if (!res.ok) throw new Error('Missing ' + f);
      await cache.put(f, res);
    }));
    const data = await caches.open(DATA);
    await Promise.all(DATA_FILES.map(async f => {
      if (await data.match(f)) return;
      const res = await fetch(new Request(f + '?v=' + DATA_VERSION, { cache: 'reload' }));
      if (!res.ok) throw new Error('Missing ' + f);
      await data.put(f, res);
    }));
  })());
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if ((k.startsWith('goku-app-') && k !== CACHE) || (k.startsWith('goku-data-') && k !== DATA)) await caches.delete(k);
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
    return (await cache.match(req, { ignoreSearch: true })) || (await (await caches.open(DATA)).match(req, { ignoreSearch: true })) || fetch(req);
  })());
});
