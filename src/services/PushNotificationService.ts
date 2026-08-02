import { AppUser } from '../types';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

const DEFAULT_VAPID_PUBLIC_KEY = 'BLoAyNRWGSv3W5HaN23dUw5IM_KSfJQHNgebTl245nGkmjtXkbumNb5rx-PfmHboxOSt_CTE6IO4jXYRfwqhSGI';

export class PushNotificationService {
  /**
   * Check if web push notifications are supported in this browser
   */
  public static isSupported(): boolean {
    return (
      typeof window !== 'undefined' &&
      'serviceWorker' in navigator &&
      'PushManager' in window &&
      'Notification' in window
    );
  }

  /**
   * Get the current notification permission state
   */
  public static getPermissionState(): 'default' | 'granted' | 'denied' | 'unsupported' {
    if (!this.isSupported()) return 'unsupported';
    return Notification.permission as 'default' | 'granted' | 'denied';
  }

  /**
   * Check if the device is currently subscribed to push notifications
   */
  public static async isSubscribed(): Promise<boolean> {
    if (!this.isSupported()) return false;
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      return !!subscription;
    } catch (error) {
      console.warn('Error checking push subscription:', error);
      return false;
    }
  }

  /**
   * Subscribe current device to push notifications and register with server
   */
  public static async subscribe(user?: AppUser): Promise<boolean> {
    if (!this.isSupported()) {
      throw new Error('Las notificaciones Push no están soportadas en este navegador o dispositivo.');
    }

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      throw new Error('Permiso de notificaciones denegado. Habilita las notificaciones en la configuración de tu navegador.');
    }

    try {
      // 1. Get VAPID public key from backend (with embedded fallback)
      let publicKey = DEFAULT_VAPID_PUBLIC_KEY;
      try {
        const vapidRes = await fetch('/api/push/vapid-key');
        if (vapidRes.ok) {
          const data = await vapidRes.json();
          if (data && data.publicKey) {
            publicKey = data.publicKey;
          }
        }
      } catch (keyErr) {
        console.warn('[PushNotificationService] Failed to fetch VAPID key from server, using default key:', keyErr);
      }

      const applicationServerKey = urlBase64ToUint8Array(publicKey);

      // 2. Ensure Service Worker registration is ready
      let registration: ServiceWorkerRegistration;
      if ('serviceWorker' in navigator) {
        try {
          registration = await navigator.serviceWorker.register('/sw.js');
          await navigator.serviceWorker.ready;
        } catch (swErr) {
          console.warn('[PushNotificationService] SW registration check:', swErr);
          registration = await navigator.serviceWorker.ready;
        }
      } else {
        throw new Error('Servicio de notificaciones (ServiceWorker) no disponible.');
      }

      // 3. Subscribe with PushManager
      let subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey
        });
      }

      // 4. Send subscription to server
      try {
        const subRes = await fetch('/api/push/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            subscription,
            user: user || { role: 'Supervisor' }
          })
        });

        if (!subRes.ok) {
          console.warn('[PushNotificationService] Server returned non-ok status for subscription sync, but browser push registration succeeded.');
        }
      } catch (syncErr) {
        console.warn('[PushNotificationService] Offline/Server sync issue while registering push, subscription remains active locally:', syncErr);
      }

      console.log('Subscrito a notificaciones Push exitosamente.');
      return true;
    } catch (error: any) {
      console.error('Push subscribe error:', error);
      throw error;
    }
  }

  /**
   * Unsubscribe current device from push notifications
   */
  public static async unsubscribe(): Promise<boolean> {
    if (!this.isSupported()) return false;

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        const endpoint = subscription.endpoint;
        await subscription.unsubscribe();

        // Inform backend
        await fetch('/api/push/unsubscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint })
        }).catch(err => console.warn('Failed to inform backend of unsubscribe:', err));
      }

      return true;
    } catch (error) {
      console.error('Push unsubscribe error:', error);
      return false;
    }
  }

  /**
   * Send a test push notification to this device
   */
  public static async sendTestNotification(): Promise<boolean> {
    if (!this.isSupported()) return false;

    try {
      if ('Notification' in window && Notification.permission !== 'granted') {
        const perm = await Notification.requestPermission();
        if (perm !== 'granted') {
          throw new Error('Permiso de notificaciones denegado en tu navegador.');
        }
      }

      let registration: ServiceWorkerRegistration | null = null;
      if ('serviceWorker' in navigator) {
        try {
          registration = await navigator.serviceWorker.ready;
        } catch (swErr) {
          console.warn('[PushNotificationService] ServiceWorker ready wait:', swErr);
        }
      }

      const subscription = registration ? await registration.pushManager.getSubscription() : null;

      let serverSent = false;
      if (subscription) {
        try {
          const res = await fetch('/api/push/test', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ subscription })
          });
          if (res.ok) {
            serverSent = true;
          }
        } catch (serverErr) {
          console.warn('[PushNotificationService] Backend test notification fetch error:', serverErr);
        }
      }

      // Always display a local notification as direct confirmation
      if (registration && typeof registration.showNotification === 'function') {
        await registration.showNotification('🚨 PROBAR ALERTA HSEC', {
          body: '¡Alertas activas correctamente! Recibirás avisos ante cualquier hallazgo crítico.',
          icon: '/icon.png',
          badge: '/icon.png',
          tag: 'test-push-' + Date.now(),
          vibrate: [200, 100, 200],
          data: { url: '/' }
        } as any);
      } else if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('🚨 PROBAR ALERTA HSEC', {
          body: '¡Alertas activas correctamente! Recibirás avisos ante cualquier hallazgo crítico.',
          icon: '/icon.png'
        });
      }

      return true;
    } catch (error: any) {
      console.error('Test push error:', error);
      throw error;
    }
  }

  /**
   * Broadcast a push notification alert to supervisors/admins when a critical finding is created
   */
  public static async broadcastCriticalAlert(
    finding: any,
    areaName?: string,
    equipmentName?: string,
    reportedBy?: string
  ): Promise<void> {
    try {
      const isCritical =
        finding?.priority === 'Alta' ||
        finding?.status === 'Crítico' ||
        finding?.type === 'Crítico' ||
        (Array.isArray(finding?.vosoIssues) && finding.vosoIssues.some((v: any) => v?.status === 'Crítico')) ||
        (finding?.vosoResponses && Object.values(finding.vosoResponses).some((r: any) => r?.status === 'Crítico'));

      if (!isCritical) return;

      const reporter = reportedBy || finding?.operatorName || finding?.inspector || 'Inspector';
      const title = `🚨 ALERTA CRÍTICA: ${areaName || 'Área general'}`;
      const body = `Hallazgo Crítico reportado por ${reporter}: ${equipmentName || finding?.description?.slice(0, 50) || 'Atención prioritaria requerida.'}`;

      await fetch('/api/push/send-alert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          body,
          url: '/',
          priority: 'Alta',
          findingId: finding?.id || Date.now(),
          areaName,
          equipmentName,
          reportedBy: reporter
        })
      });

      console.log('Push notification alert triggered for critical finding.');
    } catch (error) {
      console.warn('Could not broadcast critical push alert:', error);
    }
  }
}
