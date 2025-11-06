// Service Worker for PWA with Push & Sync
const CACHE_NAME = 'fb-dashboard-v2';
const urlsToCache = [
  '/',
  '/static/css/main.css',
  '/static/js/main.js',
  '/logo192.png',
  '/sounds/notification.wav'
];

// Install event
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('✅ Cache opened');
        return cache.addAll(urlsToCache);
      })
      .catch(err => {
        console.log('❌ Cache error:', err);
      })
  );
  self.skipWaiting();
});

// Activate event
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('🗑️ Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch event
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  if (event.request.url.includes('/api/')) return;

  event.respondWith(
    fetch(event.request)
      .then(response => {
        const responseToCache = response.clone();
        caches.open(CACHE_NAME)
          .then(cache => {
            cache.put(event.request, responseToCache);
          });
        return response;
      })
      .catch(() => {
        return caches.match(event.request)
          .then(response => {
            if (response) {
              return response;
            }
            return caches.match('/');
          });
      })
  );
});

// ============= PUSH NOTIFICATIONS =============
self.addEventListener('push', event => {
  console.log('📨 Push received:', event);
  
  let notificationData = {
    title: 'FB Dashboard',
    body: 'Tin nhắn mới',
    icon: '/logo192.png',
    badge: '/logo192.png',
    timestamp: Date.now(),
    data: {}
  };

  // Parse push data nếu có
  if (event.data) {
    try {
      const data = event.data.json();
      notificationData = {
        title: data.title || 'FB Dashboard',
        body: data.body || data.message || 'Tin nhắn mới',
        icon: data.icon || '/logo192.png',
        badge: '/logo192.png',
        tag: data.tag || 'message',
        data: {
          customerId: data.customerId,
          url: data.url || '/',
          timestamp: data.timestamp || Date.now()
        },
        vibrate: [200, 100, 200],
        requireInteraction: true,
        actions: [
          {
            action: 'view',
            title: 'Xem',
            icon: '/logo192.png'
          },
          {
            action: 'close',
            title: 'Đóng'
          }
        ]
      };
    } catch (e) {
      console.error('Parse push data error:', e);
    }
  }

  event.waitUntil(
    self.registration.showNotification(notificationData.title, notificationData)
  );
});

// Handle notification click
self.addEventListener('notificationclick', event => {
  console.log('🔔 Notification clicked:', event.action);
  event.notification.close();

  if (event.action === 'close') {
    return;
  }

  // Open or focus app
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(clientList => {
        const url = event.notification.data?.url || '/';
        
        // Check if app is already open
        for (let client of clientList) {
          if (client.url.includes('dashboard-production-fd71.up.railway.app') && 'focus' in client) {
            // Focus existing window
            client.focus();
            // Send message to client
            client.postMessage({
              type: 'notification-click',
              customerId: event.notification.data?.customerId
            });
            return;
          }
        }
        
        // Open new window if not open
        if (clients.openWindow) {
          return clients.openWindow(url);
        }
      })
  );
});

// ============= BACKGROUND SYNC =============
self.addEventListener('sync', event => {
  console.log('🔄 Background sync:', event.tag);
  
  if (event.tag === 'send-messages') {
    event.waitUntil(syncMessages());
  } else if (event.tag === 'sync-data') {
    event.waitUntil(syncAllData());
  }
});

// Sync pending messages
async function syncMessages() {
  console.log('📤 Syncing pending messages...');
  
  try {
    // Open IndexedDB
    const db = await openDB();
    const tx = db.transaction('pendingMessages', 'readonly');
    const store = tx.objectStore('pendingMessages');
    const messages = await store.getAll();

    if (messages.length === 0) {
      console.log('✅ No pending messages');
      return;
    }

    // Send each message
    for (const msg of messages) {
      try {
        const response = await fetch('https://fb-telegram-bot-production.up.railway.app/api/conversations/' + msg.customerId + '/send', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            message: msg.message,
            translate: msg.translate
          })
        });

        if (response.ok) {
          // Delete from pending if sent successfully
          const deleteTx = db.transaction('pendingMessages', 'readwrite');
          await deleteTx.objectStore('pendingMessages').delete(msg.id);
          console.log('✅ Message sent:', msg.id);
        }
      } catch (error) {
        console.error('❌ Failed to send message:', error);
      }
    }
  } catch (error) {
    console.error('❌ Sync error:', error);
  }
}

// Sync all data when online
async function syncAllData() {
  console.log('🔄 Syncing all data...');
  
  // Notify all clients to refresh
  const clients = await self.clients.matchAll();
  clients.forEach(client => {
    client.postMessage({
      type: 'sync-complete',
      timestamp: Date.now()
    });
  });
}

// ============= INDEXEDDB HELPERS =============
function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('FBDashboard', 1);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      
      // Create object stores if not exist
      if (!db.objectStoreNames.contains('pendingMessages')) {
        db.createObjectStore('pendingMessages', { keyPath: 'id', autoIncrement: true });
      }
      
      if (!db.objectStoreNames.contains('conversations')) {
        db.createObjectStore('conversations', { keyPath: 'id' });
      }
    };
  });
}

// ============= MESSAGE TO CLIENTS =============
self.addEventListener('message', event => {
  console.log('📩 SW received message:', event.data);
  
  if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data.type === 'SAVE_PENDING_MESSAGE') {
    savePendingMessage(event.data.message);
  }
});

async function savePendingMessage(message) {
  try {
    const db = await openDB();
    const tx = db.transaction('pendingMessages', 'readwrite');
    await tx.objectStore('pendingMessages').add(message);
    console.log('✅ Message saved for sync');
  } catch (error) {
    console.error('❌ Failed to save message:', error);
  }
}
