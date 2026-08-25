import { authenticateRequest, type ApiRequest, type ApiResponse } from './_auth.js';

export default async function handler(req: ApiRequest & { method?: string; body?: any }, res: ApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const publicKey = process.env.VAPID_PUBLIC_KEY || '';
  const privateKey = process.env.VAPID_PRIVATE_KEY || '';
  if (!publicKey || !privateKey) return res.status(503).json({ error: 'Push notifications are not configured on the server' });

  const identity = await authenticateRequest(req, res);
  if (!identity) return;

  const { title, body, url = '/', priority = 'Media', findingId, areaName, equipmentName, reportedBy } = req.body || {};
  if (!title || !body) return res.status(400).json({ error: 'Notification title and body are required' });

  try {
    const webPushModule: any = await import('web-push');
    const webPush = webPushModule.default || webPushModule;
    webPush.setVapidDetails('mailto:soporte@chekify.local', publicKey, privateKey);

    const snapshot = await identity.db.collection('push_subscriptions').get();
    const requestOrigin = String(req.headers?.origin || '').trim();

    // Only deliver to subscriptions registered by this exact app origin.
    // This prevents old Vercel Preview deployments from receiving the same alert.
    const recipients = snapshot.docs.filter(doc => {
      const data = doc.data() || {};
      const role = String(data.role || '').toLowerCase();
      const isPushRole = role === 'supervisor' || role === 'administrador' || role === 'admin';
      if (!isPushRole || !requestOrigin || !data.origin || data.origin !== requestOrigin) return false;

      const samePlant = !identity.plantId || !data.plantId || data.plantId === identity.plantId;
      return samePlant || role === 'administrador' || role === 'admin';
    });

    if (recipients.length === 0) {
      return res.status(200).json({ success: true, sent: 0, message: 'No hay suscripciones Push destinatarias para este origen' });
    }

    const payload = JSON.stringify({
      title,
      body,
      url,
      tag: findingId ? `finding-${findingId}` : `finding-${Date.now()}`,
      requireInteraction: priority === 'Alta',
      data: { url, findingId, areaName, equipmentName, reportedBy, priority },
    });

    let sent = 0;
    let removed = 0;

    for (const doc of recipients) {
      const data = doc.data() || {};
      const subscription = data.subscription;
      if (!subscription?.endpoint) continue;

      try {
        await webPush.sendNotification(subscription, payload);
        sent += 1;
      } catch (error: any) {
        const statusCode = error?.statusCode;
        console.warn(`Push delivery failed for ${doc.id}:`, statusCode || error?.message || error);
        if (statusCode === 404 || statusCode === 410) {
          await doc.ref.delete().catch(() => {});
          removed += 1;
        }
      }
    }

    return res.status(200).json({ success: true, sent, removed, totalRecipients: recipients.length });
  } catch (error: any) {
    console.error('Push alert server failed:', error?.message || error);
    return res.status(500).json({ error: 'Failed to send push alert' });
  }
}
