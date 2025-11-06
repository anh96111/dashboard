class BackgroundSyncManager {
  constructor() {
    this.db = null;
    this.isSupported = 'serviceWorker' in navigator && 'SyncManager' in window;
  }

  async init() {
    if (!this.isSupported) {
      console.log('Background sync not supported');
      return false;
    }

    try {
      // Open IndexedDB
      this.db = await this.openDB();
      
      // Listen for messages from service worker
      navigator.serviceWorker.addEventListener('message', event => {
        console.log('📩 Message from SW:', event.data);
        
        if (event.data.type === 'MESSAGE_SENT') {
          // Remove from UI pending list
          window.dispatchEvent(new CustomEvent('messageSent', {
            detail: event.data.data
          }));
        } else if (event.data.type === 'DATA_SYNCED') {
          // Update UI with fresh data
          window.dispatchEvent(new CustomEvent('dataUpdated', {
            detail: event.data.data
          }));
        }
      });
      
      console.log('✅ Background sync ready');
      return true;
    } catch (error) {
      console.error('Background sync init error:', error);
      return false;
    }
  }

  openDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('FBDashboard', 1);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
      
      request.onupgradeneeded = event => {
        const db = event.target.result;
        
        if (!db.objectStoreNames.contains('pendingMessages')) {
          db.createObjectStore('pendingMessages', { 
            keyPath: 'id', 
            autoIncrement: true 
          });
        }
      };
    });
  }

  // Queue message for background sync
  async queueMessage(customerId, message, translate = false) {
    if (!this.db) {
      console.error('Database not initialized');
      return false;
    }

    try {
      const tx = this.db.transaction('pendingMessages', 'readwrite');
      const store = tx.objectStore('pendingMessages');
      
      const messageData = {
        customerId,
        message,
        translate,
        timestamp: new Date().toISOString(),
        status: 'pending'
      };
      
      const request = store.add(messageData);
      
      return new Promise((resolve, reject) => {
        request.onsuccess = async () => {
          console.log('✅ Message queued:', request.result);
          
          // Request background sync
          const registration = await navigator.serviceWorker.ready;
          await registration.sync.register('send-messages');
          
          resolve(request.result);
        };
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error('Queue message error:', error);
      return false;
    }
  }

  // Get all pending messages
  async getPendingMessages() {
    if (!this.db) return [];

    try {
      const tx = this.db.transaction('pendingMessages', 'readonly');
      const store = tx.objectStore('pendingMessages');
      
      return new Promise((resolve, reject) => {
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error('Get pending messages error:', error);
      return [];
    }
  }

  // Request manual sync
  async requestSync() {
    try {
      const registration = await navigator.serviceWorker.ready;
      await registration.sync.register('sync-data');
      console.log('✅ Manual sync requested');
      return true;
    } catch (error) {
      console.error('Request sync error:', error);
      return false;
    }
  }
}

export default new BackgroundSyncManager();
