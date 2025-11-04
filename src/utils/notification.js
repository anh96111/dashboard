// src/utils/notification.js

class NotificationService {
  constructor() {
    this.audioContext = null;
    this.audioBuffer = null;
    this.enabled = true;
    this.audioReady = false;
  }

  async enableAudio() {
    try {
      // Tạo AudioContext
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      this.audioContext = new AudioContext();
      
      // Fetch và decode audio file
      const response = await fetch('/sounds/notification.wav');
      const arrayBuffer = await response.arrayBuffer();
      this.audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
      
      this.audioReady = true;
      console.log('✓ Audio context ready');
      
      return true;
    } catch (error) {
      console.error('Error enabling audio:', error);
      throw error;
    }
  }

  async playSound() {
    if (!this.enabled || !this.audioReady || !this.audioContext || !this.audioBuffer) {
      console.log('Sound not ready');
      return;
    }
    
    try {
      // Resume context nếu bị suspend
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }
      
      // Tạo source mới mỗi lần play
      const source = this.audioContext.createBufferSource();
      source.buffer = this.audioBuffer;
      
      // Tạo gain node để điều chỉnh volume
      const gainNode = this.audioContext.createGain();
      gainNode.gain.value = 0.7;
      
      source.connect(gainNode);
      gainNode.connect(this.audioContext.destination);
      
      source.start(0);
      console.log('✓ Sound played');
    } catch (error) {
      console.error('Sound play error:', error);
    }
  }

  showNotification(title, body) {
    if (!this.enabled) return;
    
    if ('Notification' in window && Notification.permission === 'granted') {
      const notification = new Notification(title, {
        body: body,
        icon: '/logo192.png',
        badge: '/logo192.png',
        tag: 'new-message',
        requireInteraction: false,
        silent: true // Tắt âm thanh hệ thống vì đã có custom sound
      });
      
      setTimeout(() => notification.close(), 5000);
      
      notification.onclick = () => {
        window.focus();
        notification.close();
      };
      
      return notification;
    }
  }

  notify(customerName, message) {
    console.log('🔔 Notification triggered:', customerName);
    this.playSound();
    this.showNotification(
      `💬 ${customerName}`,
      message.substring(0, 100)
    );
  }

  setEnabled(enabled) {
    this.enabled = enabled;
  }

  // Yêu cầu quyền thông báo
  async requestPermission() {
    if ('Notification' in window) {
      const permission = await Notification.requestPermission();
      return permission;
    }
    return 'unsupported';
  }

  // Kiểm tra quyền thông báo
  checkPermission() {
    if ('Notification' in window) {
      return Notification.permission;
    }
    return 'unsupported';
  }
}

const notificationService = new NotificationService();
export default notificationService;
