
const CACHE_NAME = 'lotosmart-v1.0.1';
const URLS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.json'
];

self.addEventListener('install', (event) => {
  // Força o SW a assumir o controle imediatamente após a instalação
  self.skipWaiting();
  
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
          // Verifica se a resposta é válida antes de cachear
          if (!response || response.status !== 200 || response.type !== 'basic' && response.type !== 'cors') {
            return response;
          }
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

  // Estratégia para Assets estáticos (Stale-While-Revalidate)
  // Tenta servir o cache, mas atualiza em background
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      const fetchPromise = fetch(request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
           caches.open(CACHE_NAME).then((cache) => {
             cache.put(request, networkResponse.clone());
           });
        }
        return networkResponse;
      });
      return cachedResponse || fetchPromise;
    })
  );
});

self.addEventListener('activate', (event) => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    Promise.all([
      // Toma o controle de todas as abas abertas imediatamente
      self.clients.claim(),
      // Limpa caches antigos
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheWhitelist.indexOf(cacheName) === -1) {
              console.log('Deletando cache antigo:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
    ])
  );
});
