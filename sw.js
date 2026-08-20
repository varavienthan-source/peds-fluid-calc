const CACHE = 'peds-neph-v1';

const PRECACHE = [
  './',
  './index.html',
  './manifest.json',
  './icon.svg',
  './src/app.js',
  './src/registry.js',
  './src/units.js',
  './src/fmt.js',
  './src/descriptor.js',
  './src/expression.js',
  './src/ui/form.js',
  './src/ui/result.js',
  './src/ui/calculator.js',
  './src/calc/fluids.js',
  './src/calc/electrolytes.js',
  './src/calc/acidbase.js',
  './src/calc/aki.js',
  './src/calc/egfr.js',
  './src/calc/proteinuria.js',
  './src/calc/bp.js',
  './src/calc/growth.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request).then((hit) => hit || fetch(e.request).then((res) => {
      if (res && res.status === 200 && res.type === 'basic') {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy));
      }
      return res;
    }).catch(() => caches.match('./index.html')))
  );
});
