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
  if (!hasPushRole(identity.role)) return res.status(403).json({ error: 'Only supervisors and administrators can enable push alerts' });

  try {
    const origin = String(req.body?.origin || '').trim() || undefined;
    const docId = Buffer.from(subscription.endpoint).toString('base64').replace(/[/+=]/g, '_').slice(0, 100);
    await identity.db.collection('push_subscriptions').doc(docId).set({
      subscription,
      uid: identity.uid,
      role: identity.role,
      plantId: identity.plantId,
      origin,
      updatedAt: Date.now(),
    }, { merge: true });
    return res.status(200).json({ success: true, message: 'Subscripción registrada correctamente' });
  } catch (error: any) {
    console.error('Error saving push subscription:', error?.message || error);
    return res.status(500).json({ error: 'Failed to save subscription' });
  }
}
