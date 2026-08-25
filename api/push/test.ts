import webPush from 'web-push';
import { authenticateRequest, hasPushRole } from './_auth';

const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || '';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || '';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    res.status(503).json({ error: 'Push notifications are not configured on the server' });
    return;
  }

  const { subscription } = req.body || {};
  if (!subscription?.endpoint) {
    res.status(400).json({ error: 'Subscription is required' });
    return;
  }

  const identity = await authenticateRequest(req, res);
  if (!identity) return;

  if (!hasPushRole(identity.role)) {
    res.status(403).json({ error: 'Only supervisors and administrators can test push alerts' });
    return;
  }

  try {
    const docId = Buffer.from(subscription.endpoint).toString('base64').replace(/[/+=]/g, '_').slice(0, 100);
    const stored = await identity.db.collection('push_subscriptions').doc(docId).get();

    if (!stored.exists || stored.data()?.uid !== identity.uid) {
      res.status(403).json({ error: 'Subscription is not registered to this user' });
      return;
    }

    webPush.setVapidDetails('mailto:soporte@chekify.local', VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

    const payload = JSON.stringify({
      title: '🔔 ¡Notificaciones Activadas!',
      body: 'Estás suscrito para recibir alertas instantáneas en Chekify.',
      url: '/',
      tag: 'test-notification',
      requireInteraction: true,
    });

    await webPush.sendNotification(subscription, payload);
    res.status(200).json({ success: true, message: 'Notificación de prueba enviada' });
  } catch (error: any) {
    console.error('Error sending test notification:', error?.statusCode || error?.code || error?.message || error);
    res.status(500).json({ error: 'Failed to send test notification' });
  }
}
