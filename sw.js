// Service worker: app shell em cache, funciona offline.
// Aumente VERSAO a cada publicação para forçar a atualização.
const VERSAO = 'tn-v1';
const ARQUIVOS = [
  './', './index.html', './styles.css', './manifest.webmanifest',
  './js/app.js', './js/calc.js', './js/label.js', './js/store.js',
  './data/seed.js', './data/taco.js',
  './icons/icon-180.png', './icons/icon-192.png', './icons/icon-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSAO).then((c) => c.addAll(ARQUIVOS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== VERSAO).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

// Cache primeiro; atualiza em segundo plano quando houver internet
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith(
    caches.match(req, { ignoreSearch: true }).then((hit) => {
      const rede = fetch(req).then((res) => {
        if (res && res.ok) { const copia = res.clone(); caches.open(VERSAO).then((c) => c.put(req, copia)); }
        return res;
      }).catch(() => hit);
      return hit || rede;
    }),
  );
});
