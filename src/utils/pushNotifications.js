class PushNotificationManager {
  constructor() {
    this.swRegistration = null;
    this.isSupported = 'PushManager' in window && 'serviceWorker' in navigator;
  }

  async init() {
    if (!this.isSupported) {
      console.log('❌ Push notifications not supported');
      return false;
    }

    try {
      // Wait for service worker
      this.swRegistration = await navigator.serviceWorker.ready;
      console.log('✅ Service Worker ready for push');
      
      // Check permission
      const permission = await this.requestPermission();
      if (permission === 'granted') {
        await this.subscribeUser();
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Push init error:', error);
      return false;
    }
  }

  async requestPermission() {
    const permission = await Notification.requestPermission();
    console.log('📨 Push permission:', permission);
    return permission;
  }

  async subscribeUser() {
    try {
      // Check existing subscription
      let subscription = await this.swRegistration.pushManager.getSubscription();
      
      if (!subscription) {
        // Create new subscription
        const vapidPublicKey = process.env.REACT_APP_VAPID_PUBLIC_KEY || 
          'BLrbFXeKpEJA4drjbK6tK-XadCx-CFXOFN7JG7J9jfNBj1N1z9FWkFnCzHnCB2YYZwq2ntBp6vdokc6ehTvxXl0';
        
        const convertedVapidKey = this.urlBase64ToUint8Array(vapidPublicKey);
        
        subscription = await this.swRegistration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: convertedVapidKey
        });
        
        console.log('✅ Push subscription created');
      }
      
      // Send subscription to backend
      await this.sendSubscriptionToBackend(subscription);
      
      return subscription;
    } catch (error) {
      console.error('Subscribe error:', error);
      return null;
    }
  }

  async sendSubscriptionToBackend(subscription) {
    try {
      const response = await fetch(
        `${process.env.REACT_APP_API_URL || 'https://fb-telegram-bot-production.up.railway.app'}/api/push/subscribe`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            subscription: subscription,
            device: navigator.userAgent
          })
        }
      );
      
      if (response.ok) {
        console.log('✅ Subscription sent to backend');
      }
    } catch (error) {
      console.error('Failed to send subscription:', error);
    }
  }

  urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
      .replace(/\-/g, '+')
      .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }

  async unsubscribe() {
    try {
      const subscription = await this.swRegistration.pushManager.getSubscription();
      if (subscription) {
        await subscription.unsubscribe();
        console.log('✅ Push unsubscribed');
      }
    } catch (error) {
      console.error('Unsubscribe error:', error);
    }
  }
}

export default new PushNotificationManager();
