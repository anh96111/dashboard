// src/utils/notification.js

class NotificationService {
  constructor() {
    this.audioContext = null;
    this.audioBuffer = null;
    this.enabled = true;
    
    // Auto init khi load
    this.init();
  }

  async init() {
    // Init audio context an toàn
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      this.audioContext = new AudioContext();
      console.log('✓ Sound ready');
      
      // Load file wav cho desktop
      if (this.isDesktop()) {
        await this.loadAudioFile();
      }
    } catch (error) {
      console.warn('Sound not available');
    }

    // Auto request permission trên desktop
    if (this.isDesktop() && this.hasNotificationAPI()) {
      if (Notification.permission === 'default') {
        Notification.requestPermission().catch(() => {});
      }
    }
  }

  // Load file notification.wav cho desktop
  async loadAudioFile() {
    try {
      const response = await fetch('/sounds/notification.wav');
      const arrayBuffer = await response.arrayBuffer();
      this.audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
      console.log('✓ Notification sound loaded');
    } catch (error) {
      console.warn('Could not load notification.wav, using beep sound');
      this.audioBuffer = null;
    }
  }

  // Check xem có phải desktop không
  isDesktop() {
    return !/iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  }

  // Check xem browser có hỗ trợ Notification không
  hasNotificationAPI() {
    return typeof Notification !== 'undefined';
  }

  // Play sound - ưu tiên file wav trên desktop
  async playSound() {
    if (!this.enabled || !this.audioContext) return;

    try {
      // Resume nếu bị suspended
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }

      // Nếu là desktop VÀ có file wav -> play file
      if (this.isDesktop() && this.audioBuffer) {
        const source = this.audioContext.createBufferSource();
        source.buffer = this.audioBuffer;
        
        const gainNode = this.audioContext.createGain();
        gainNode.gain.value = 0.7;
        
        source.connect(gainNode);
        gainNode.connect(this.audioContext.destination);
        
        source.start(0);
        console.log('✓ WAV sound played');
      } 
      // Ngược lại (mobile hoặc không có file) -> beep đơn giản
      else {
        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(this.audioContext.destination);

        oscillator.frequency.value = 800;
        oscillator.type = 'sine';

        gainNode.gain.setValueAtTime(0.1, this.audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(
          0.01,
          this.audioContext.currentTime + 0.3
        );

        oscillator.start(this.audioContext.currentTime);
        oscillator.stop(this.audioContext.currentTime + 0.3);
        
        console.log('✓ Beep sound played');
      }
    } catch (error) {
      console.warn('Sound play error:', error);
    }
  }

  // Show notification an toàn
  showNotification(title, body) {
    // Chỉ show trên desktop và khi có permission
    if (this.isDesktop() && 
        this.hasNotificationAPI() && 
        Notification.permission === 'granted') {
      try {
        const notification = new Notification(title, {
          body: body,
          icon: '/logo192.png',
          badge: '/logo192.png',
          tag: 'msg',
          requireInteraction: false,
          silent: true
        });

        notification.onclick = () => {
          window.focus();
          notification.close();
        };

        setTimeout(() => notification.close(), 5000);
      } catch (error) {
        // Silently fail
      }
    }
  }

  // Main notify method
  notify(customerName, message) {
    console.log('🔔 Notification:', customerName);
    
    // Luôn phát âm thanh
    this.playSound();
    
    // Chỉ show popup trên desktop
    this.showNotification(
      `💬 ${customerName}`,
      message ? message.substring(0, 100) : 'Tin nhắn mới'
    );
  }

  // Simple enable/disable
  setEnabled(enabled) {
    this.enabled = enabled;
  }

  enable() {
    this.enabled = true;
  }

  disable() {
    this.enabled = false;
  }

  // Các method này để tương thích với code cũ
  async enableAudio() {
    // Reload audio file nếu cần
    if (this.isDesktop() && !this.audioBuffer) {
      await this.loadAudioFile();
    }
    return true;
  }

  async requestPermission() {
    if (this.hasNotificationAPI()) {
      try {
        return await Notification.requestPermission();
      } catch {
        return 'denied';
      }
    }
    return 'unsupported';
  }

  checkPermission() {
    if (this.hasNotificationAPI()) {
      return Notification.permission;
    }
    return 'unsupported';
  }
}

const notificationService = new NotificationService();
export default notificationService;
