// Offline cache. Release with tools/release.sh, which bumps CACHE_VERSION here and
// VERSION in js/version.js together. The app then offers "Update" and never reloads on its own.
const CACHE_VERSION = '2.16.0';
const CACHE = 'goku-app-' + CACHE_VERSION;
const FILES = [
  './', './index.html', './manifest.webmanifest', './css/app.css',
  './js/app.js', './js/db.js', './js/time.js', './js/crypto.js', './js/ui.js', './js/state.js', './js/validate.js',
  './js/lock.js', './js/onboarding.js', './js/engine.js', './js/perf.js', './js/settings.js', './js/devcheck.js', './js/themes.js', './js/units.js', './js/avatar.js', './js/coach.js', './js/fuel.js', './js/activity.js', './js/insights.js', './js/homecards.js', './js/perf-score.js', './js/why.js', './js/trend.js', './js/weight.js', './js/skills.js', './js/milestones.js', './js/homelayout.js', './js/duel.js', './js/figure.js', './js/moves.js', './js/movepicker.js', './js/foods.js', './js/fuzzy.js', './js/scouter.js', './js/saga.js', './js/calendar.js', './js/muscles.js', './js/supplements.js', './data/interactions.json', './data/everyday.json', './data/restaurants.json', './js/nutrition.js', './js/scan.js', './js/health.js', './js/skins.js', './js/version.js',
  './icons/apple-touch-icon.png', './icons/favicon-32.png', './icons/favicon-48.png', './icons/favicon-192.png',
  './icons/icon-192.png', './icons/icon-512.png', './icons/icon-maskable-512.png',
];

// The food list and barcode scanner are big and rarely change, so they live in their own
// cache that survives app updates; bump DATA_VERSION only when tools/build-foods.py or build-foundation.py runs again.
const DATA_VERSION = 'foods-2026-11-06b';
const DATA = 'goku-data-' + DATA_VERSION;
const DATA_FILES = ['./data/foods.json', './vendor/zxing.min.js'];
// Exercise drawings and the muscle map (2.4), kept across app updates; bump ART_VERSION when they change.
// The drawing list matches ART in js/muscles.js.
// Scan-only barcode files (2.11, data/upc/*.json): fetched one at a time on first scan and kept here.
// Bump UPC_VERSION only when tools/build-barcodes.py runs again.
const UPC_VERSION = 'upc-2026-11-05';
const UPC = 'goku-upc-' + UPC_VERSION;
const ART_VERSION = 'art-2026-11-04';
const ART = 'goku-art-' + ART_VERSION;
const ART_FILES = ['./img/muscles.svg', ...['0077', '0075', '0162', '0055', '0018', '0033', '0056', '0198', '0042', '0020', '0086', '0087', '0224', '0227',
  '0261', '0105', '0122', '0152', '0129', '0115', '0121', '0137', '0109', '0118', '0107', '0099', '0281', '0101', '0113', '0291', '0284', '0287', '0021', '0032',
  '0004', '0024', '0025', '0046', '0048', '0061', '0066', '0091', '0092', '0103', '0114', '0116', '0117', '0119', '0123', '0124', '0127', '0138',
  '0142', '0156', '0157', '0181', '0183', '0204', '0205', '0212', '0239', '0282', '0286', '0288']
  .flatMap(n => [`./img/moves/${n}-relaxation.svg`, `./img/moves/${n}-tension.svg`])];

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
      if (res.ok) await data.put(f, res);
    }).map(x => x.catch(() => {}))); // 2.15: a big file that fails on a weak connection no longer fails the whole install; it is kept on first use instead
    const art = await caches.open(ART);
    await Promise.all(ART_FILES.map(async f => {
      if (await art.match(f)) return;
      const res = await fetch(new Request(f + '?v=' + ART_VERSION, { cache: 'reload' }));
      if (res.ok) await art.put(f, res); // a drawing that fails to download never blocks the update
    }));
  })());
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if ((k.startsWith('goku-app-') && k !== CACHE) || (k.startsWith('goku-data-') && k !== DATA) || (k.startsWith('goku-art-') && k !== ART) || (k.startsWith('goku-upc-') && k !== UPC)) await caches.delete(k);
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
    if (new URL(req.url).pathname.includes('/data/upc/')) {
      const upc = await caches.open(UPC), hit = await upc.match(req, { ignoreSearch: true });
      if (hit) return hit;
      const res = await fetch(new Request(req.url.split('?')[0] + '?v=' + UPC_VERSION, { cache: 'reload' }));
      if (res.ok) await upc.put(req.url.split('?')[0], res.clone());
      return res;
    }
    const hit = (await cache.match(req, { ignoreSearch: true })) || (await (await caches.open(DATA)).match(req, { ignoreSearch: true }))
      || (await (await caches.open(ART)).match(req, { ignoreSearch: true }));
    if (hit) return hit;
    // Not kept at install (2.15): data files and drawings fetched now are stored for offline use.
    const path = './' + new URL(req.url).pathname.split('/').slice(-2).join('/'), keep = DATA_FILES.includes(path) ? [DATA, DATA_VERSION] : new URL(req.url).pathname.includes('/img/') ? [ART, ART_VERSION] : null;
    if (!keep) return fetch(req);
    const res = await fetch(new Request(req.url.split('?')[0] + '?v=' + keep[1], { cache: 'reload' }));
    if (res.ok) await (await caches.open(keep[0])).put(req.url.split('?')[0], res.clone());
    return res;
  })());
});
