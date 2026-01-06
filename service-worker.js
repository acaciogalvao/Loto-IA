
const CACHE_NAME = 'lotosmart-v1.1.0';
const URLS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.ico'
];

const API_BASE_URL = 'https://api.guidi.dev.br/loteria';

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
      self.clients.claim(),
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheWhitelist.indexOf(cacheName) === -1) {
              return caches.delete(cacheName);
            }
          })
        );
      })
    ])
  );
});

// Sincronização em Segundo Plano (Background Sync)
self.addEventListener('sync', (event) => {
  if (event.tag === 'update-results') {
    event.waitUntil(updateLotteryCache());
  }
});

// Notificações Push
self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {
    title: 'Loto-IA',
    body: 'Novos resultados disponíveis!'
  };

  const options = {
    body: data.body,
    icon: '/icon-192x192.png',
    badge: '/badge-72x72.png',
    vibrate: [100, 50, 100],
    data: {
      url: data.url || '/'
    }
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.openWindow(event.notification.data.url)
  );
});

async function updateLotteryCache() {
  const games = ['megasena', 'lotofacil', 'quina', 'lotomania'];
  const cache = await caches.open(CACHE_NAME);
  
  for (const game of games) {
    try {
      const response = await fetch(`${API_BASE_URL}/${game}/latest`);
      if (response.ok) {
        await cache.put(`${API_BASE_URL}/${game}/latest`, response.clone());
      }
    } catch (error) {
      console.error(`Erro ao atualizar cache para ${game}:`, error);
    }
  }
}
