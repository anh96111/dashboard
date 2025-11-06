// src/utils/notification.js

class NotificationService {
  constructor() {
    this.audioContext = null;
    this.enabled = true;
    
    // Auto init khi load
    this.init();
  }

  init() {
    // Init audio context an toàn
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      this.audioContext = new AudioContext();
      console.log('✓ Sound ready');
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

  // Check xem có phải desktop không
  isDesktop() {
    return !/iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  }

  // Check xem browser có hỗ trợ Notification không
  hasNotificationAPI() {
    return typeof Notification !== 'undefined';
  }

  // Play sound đơn giản (không cần file wav)
  async playSound() {
    if (!this.enabled || !this.audioContext) return;

    try {
      // Resume nếu bị suspended
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }

      // Tạo âm thanh beep đơn giản
      const oscillator = this.audioContext.createOscillator();
      const gainNode = this.audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(this.audioContext.destination);

      oscillator.frequency.value = 800; // Frequency
      oscillator.type = 'sine';

      gainNode.gain.setValueAtTime(0.1, this.audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(
        0.01,
        this.audioContext.currentTime + 0.3
      );

      oscillator.start(this.audioContext.currentTime);
      oscillator.stop(this.audioContext.currentTime + 0.3);
      
      console.log('✓ Sound played');
    } catch (error) {
      // Silently fail - không crash app
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
          tag: 'msg',
          silent: true
        });

        notification.onclick = () => {
          window.focus();
          notification.close();
        };

        setTimeout(() => notification.close(), 4000);
      } catch (error) {
        // Silently fail
      }
    }
  }

  // Main notify method
  notify(customerName, message) {
    console.log('🔔 Notification:', customerName);
    
    // Luôn phát âm thanh (hoạt động trên mọi thiết bị)
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
    return true; // Always return true
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
