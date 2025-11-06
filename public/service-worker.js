// Service Worker for PWA
const CACHE_NAME = 'fb-dashboard-v1';
const urlsToCache = [
  '/',
  '/static/css/main.css',
  '/static/js/main.js',
  '/logo192.png',
  '/sounds/notification.wav'
];

// Install event - cache resources
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
      .catch(err => {
        console.log('Cache error:', err);
      })
  );
  self.skipWaiting();
});

// Activate event - clean old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch event - serve from cache when offline
self.addEventListener('fetch', event => {
  // Skip non-GET requests
  if (event.request.method !== 'GET') return;

  // Skip API calls - always fetch fresh
  if (event.request.url.includes('/api/')) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then(response => {
        // Clone the response
        const responseToCache = response.clone();

        caches.open(CACHE_NAME)
          .then(cache => {
            cache.put(event.request, responseToCache);
          });

        return response;
      })
      .catch(() => {
        // Offline - try cache
        return caches.match(event.request)
          .then(response => {
            if (response) {
              return response;
            }
            // Return offline page if no cache
            return caches.match('/');
          });
      })
  );
});

// Background sync for offline messages
self.addEventListener('sync', event => {
  if (event.tag === 'send-messages') {
    event.waitUntil(sendPendingMessages());
  }
});

async function sendPendingMessages() {
  // Get pending messages from IndexedDB
  // Send them when online
  console.log('Syncing pending messages...');
}

// Push notifications
self.addEventListener('push', event => {
  const options = {
    body: event.data ? event.data.text() : 'Tin nhắn mới',
    icon: '/logo192.png',
    badge: '/logo192.png',
    vibrate: [200, 100, 200]
  };

  event.waitUntil(
    self.registration.showNotification('FB Dashboard', options)
  );
});
