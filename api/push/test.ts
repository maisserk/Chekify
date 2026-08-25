import { authenticateRequest, hasPushRole, type ApiRequest, type ApiResponse } from './_auth.js';

export default async function handler(req: ApiRequest & { method?: string; body?: any }, res: ApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const publicKey = process.env.VAPID_PUBLIC_KEY || '';
  const privateKey = process.env.VAPID_PRIVATE_KEY || '';
  if (!publicKey || !privateKey) return res.status(503).json({ error: 'Push notifications are not configured on the server' });

  const subscription = req.body?.subscription;
  if (!subscription?.endpoint) return res.status(400).json({ error: 'Subscription is required' });

  const identity = await authenticateRequest(req, res);
  if (!identity) return;
  if (!hasPushRole(identity.role)) return res.status(403).json({ error: 'Only supervisors and administrators can test push alerts' });

  try {
    const webPushModule: any = await import('web-push');
    const webPush = webPushModule.default || webPushModule;

    const docId = Buffer.from(subscription.endpoint).toString('base64').replace(/[/+=]/g, '_').slice(0, 100);
    const stored = await identity.db.collection('push_subscriptions').doc(docId).get();
    if (!stored.exists || stored.data()?.uid !== identity.uid) {
      return res.status(403).json({ error: 'Subscription is not registered to this user' });
    }

    webPush.setVapidDetails('mailto:soporte@chekify.local', publicKey, privateKey);
    const payload = JSON.stringify({
      title: '🔔 ¡Notificaciones Activadas!',
      body: 'Estás suscrito para recibir alertas instantáneas en Chekify.',
      url: '/',
      tag: 'test-notification',
      requireInteraction: true,
    });

    await webPush.sendNotification(subscription, payload);
    return res.status(200).json({ success: true, message: 'Notificación de prueba enviada' });
  } catch (error: any) {
    console.error('Push test function failed:', error?.statusCode || error?.code || error?.message || error);
    return res.status(500).json({ error: 'Failed to send test notification', detail: error?.statusCode ? `Web Push returned HTTP ${error.statusCode}` : 'Server-side Push error' });
  }
}
