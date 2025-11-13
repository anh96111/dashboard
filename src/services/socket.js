import io from 'socket.io-client';

class SocketService {
  constructor() {
    this.socket = null;
    this.connected = false;
    this.reconnectAttempts = 0;
    this.messageQueue = [];
  }

  connect() {
    if (this.socket && this.connected) {
      console.log('🔌 Socket already connected');
      return;
    }

    const API_URL = process.env.REACT_APP_API_URL || 
                    'https://fb-telegram-bot-production.up.railway.app';
    
    console.log('🔌 Connecting to Socket.io:', API_URL);
    
    this.socket = io(API_URL, {
      transports: ['polling', 'websocket'],
      reconnection: true,
      reconnectionAttempts: Infinity,  // Luôn cố reconnect
      reconnectionDelay: 1000,
      reconnectionDelayMax: 3000,
      timeout: 20000,
      forceNew: false,  // Giữ connection cũ
      multiplex: true,  // Share connection
      
      // Mobile optimization
      pingTimeout: 60000,
      pingInterval: 25000,
      upgradeTimeout: 30000,
      
      // Auto reconnect on mobile
      autoConnect: true,
      query: {
        device: /iPhone|iPad|Android/i.test(navigator.userAgent) ? 'mobile' : 'desktop'
      }
    });

    this.setupEventHandlers();
  }

  setupEventHandlers() {
    this.socket.on('connect', () => {
      this.connected = true;
      this.reconnectAttempts = 0;
      console.log('✅ Socket connected!', this.socket.id);
      
      // Send queued messages
      this.flushMessageQueue();
      
      // Notify app về reconnection
      window.dispatchEvent(new CustomEvent('socketReconnected'));
    });

    this.socket.on('connect_error', (error) => {
      console.error('❌ Socket connection error:', error.message);
      this.connected = false;
      this.reconnectAttempts++;
      
      // Thử polling nếu websocket fail
      if (this.reconnectAttempts > 3) {
        this.socket.io.opts.transports = ['polling'];
      }
    });

    this.socket.on('disconnect', (reason) => {
      console.log('🔌 Socket disconnected:', reason);
      this.connected = false;
      
      // Auto reconnect nếu không phải manual disconnect
      if (reason === 'io server disconnect' || reason === 'transport close') {
        setTimeout(() => {
          console.log('🔄 Attempting reconnect...');
          this.socket.connect();
        }, 1000);
      }
    });

    this.socket.on('reconnect', (attemptNumber) => {
      console.log('🔄 Socket reconnected after', attemptNumber, 'attempts');
      this.connected = true;
      
      // Request missed messages
      this.socket.emit('get_missed_messages');
    });

    // Ping pong để giữ connection
    this.socket.on('pong', () => {
      console.log('🏓 Pong received');
    });
  }

  // Queue messages khi offline
  flushMessageQueue() {
    while (this.messageQueue.length > 0) {
      const { event, data } = this.messageQueue.shift();
      this.emit(event, data);
    }
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.connected = false;
    }
  }

  on(event, callback) {
    if (this.socket) {
      this.socket.on(event, callback);
    }
  }

  emit(event, data) {
    if (this.socket && this.connected) {
      this.socket.emit(event, data);
      console.log('📤 Socket emit:', event);
    } else {
      // Queue message nếu chưa connected
      console.warn('⚠️ Socket not connected, queuing:', event);
      this.messageQueue.push({ event, data });
    }
  }

  off(event) {
    if (this.socket) {
      this.socket.off(event);
    }
  }

  // Force reconnect
  forceReconnect() {
    console.log('🔄 Force reconnecting...');
    if (this.socket) {
      this.socket.disconnect();
      setTimeout(() => {
        this.connect();
      }, 100);
    }
  }
}

export default new SocketService();
