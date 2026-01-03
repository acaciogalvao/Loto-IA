const CACHE_NAME = 'lotosmart-v1';
const URLS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(URLS_TO_CACHE);
    })
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;

  // Estratégia para API (Network First, then Cache)
  if (request.url.includes('api.guidi.dev.br')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Clone a resposta para salvar no cache
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseToCache);
          });
          return response;
        })
        .catch(() => {
          // Se falhar (offline), tenta pegar do cache
          return caches.match(request);
        })
    );
    return;
  }

  // Estratégia para Assets estáticos (Cache First)
  event.respondWith(
    caches.match(request).then((response) => {
      return response || fetch(request);
    })
  );
});

self.addEventListener('activate', (event) => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});