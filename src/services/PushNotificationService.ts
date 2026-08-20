import { AppUser } from '../types';
import { auth } from '../firebase';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

async function authHeaders(): Promise<Record<string, string>> {
  const user = auth.currentUser;
  if (!user) throw new Error('Sesión no disponible. Inicia sesión nuevamente.');
  const token = await user.getIdToken();
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
}

export class PushNotificationService {
  public static isSupported(): boolean {
    return typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  }

  public static getPermissionState(): 'default' | 'granted' | 'denied' | 'unsupported' {
    if (!this.isSupported()) return 'unsupported';
    return Notification.permission as 'default' | 'granted' | 'denied';
  }

  public static async isSubscribed(): Promise<boolean> {
    if (!this.isSupported()) return false;
    try {
      const registration = await navigator.serviceWorker.ready;
      return !!(await registration.pushManager.getSubscription());
    } catch (error) {
      console.warn('Error checking push subscription:', error);
      return false;
    }
  }

  public static async subscribe(user?: AppUser): Promise<boolean> {
    if (!this.isSupported()) throw new Error('Las notificaciones Push no están soportadas en este navegador o dispositivo.');

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') throw new Error('Permiso de notificaciones denegado. Habilita las notificaciones en la configuración de tu navegador.');

    try {
      const vapidRes = await fetch('/api/push/vapid-key');
      if (!vapidRes.ok) {
        const data = await vapidRes.json().catch(() => ({}));
        throw new Error(data?.error || 'Las notificaciones Push no están configuradas en el servidor.');
      }
      const vapidData = await vapidRes.json();
      if (!vapidData?.publicKey) throw new Error('Clave pública VAPID no disponible.');

      const registration = await navigator.serviceWorker.register('/sw.js');
      await navigator.serviceWorker.ready;
      let subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidData.publicKey)
        });
      }

      const headers = await authHeaders();
      const subRes = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers,
        body: JSON.stringify({ subscription, user })
      });

      if (!subRes.ok) {
        const data = await subRes.json().catch(() => ({}));
        throw new Error(data?.error || 'No se pudo registrar la suscripción Push en el servidor.');
      }

      console.log('Subscrito a notificaciones Push exitosamente.');
      return true;
    } catch (error: any) {
      console.error('Push subscribe error:', error);
      throw error;
    }
  }

  public static async unsubscribe(): Promise<boolean> {
    if (!this.isSupported()) return false;
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        const headers = await authHeaders();
        const endpoint = subscription.endpoint;
        await subscription.unsubscribe();
        await fetch('/api/push/unsubscribe', {
          method: 'POST',
          headers,
          body: JSON.stringify({ endpoint })
        }).catch(err => console.warn('Failed to inform backend of unsubscribe:', err));
      }
      return true;
    } catch (error) {
      console.error('Push unsubscribe error:', error);
      return false;
    }
  }

  public static async sendTestNotification(): Promise<boolean> {
    if (!this.isSupported()) return false;
    try {
      if (Notification.permission !== 'granted') {
        const perm = await Notification.requestPermission();
        if (perm !== 'granted') throw new Error('Permiso de notificaciones denegado en tu navegador.');
      }

      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        const headers = await authHeaders();
        const res = await fetch('/api/push/test', {
          method: 'POST',
          headers,
          body: JSON.stringify({ subscription })
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data?.error || 'No se pudo enviar la notificación de prueba.');
        }
      }

      if (typeof registration.showNotification === 'function') {
        await registration.showNotification('🚨 PROBAR ALERTA DE HALLAZGO', {
          body: '¡Alertas activas correctamente! Recibirás avisos ante cualquier hallazgo relevante.',
          icon: '/icon.png',
          badge: '/icon.png',
          tag: 'test-push-' + Date.now(),
          vibrate: [200, 100, 200],
          data: { url: '/' }
        } as any);
      }
      return true;
    } catch (error: any) {
      console.error('Test push error:', error);
      throw error;
    }
  }

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

      const reporter = reportedBy || finding?.operatorName || finding?.inspector || 'Operador';
      const title = isCritical ? `🚨 ALERTA CRÍTICA: ${areaName || 'Área general'}` : `⚠️ NUEVO HALLAZGO: ${areaName || 'Área general'}`;
      const cleanDesc = finding?.description ? finding.description.replace(/^\[.*?\]\s*/g, '').slice(0, 70) : '';
      const body = isCritical
        ? `Hallazgo Crítico reportado por ${reporter}: ${equipmentName ? equipmentName + ' - ' : ''}${cleanDesc || 'Atención prioritaria requerida.'}`
        : `Hallazgo reportado por ${reporter}: ${equipmentName ? equipmentName + ' - ' : ''}${cleanDesc || 'Revisión requerida.'}`;

      const headers = await authHeaders();
      const response = await fetch('/api/push/send-alert', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          title,
          body,
          url: '/',
          priority: isCritical ? 'Alta' : 'Media',
          findingId: finding?.id || Date.now(),
          areaName,
          equipmentName,
          reportedBy: reporter
        })
      });
      if (!response.ok) console.warn('Push alert server rejected request:', await response.text());
    } catch (error) {
      console.warn('Could not broadcast push alert:', error);
    }
  }
}
