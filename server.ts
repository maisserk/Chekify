import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { initializeApp, getApps, deleteApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import fs from 'fs';
import webPush from 'web-push';

// Web Push credentials must be provided as server-side environment variables.
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || '';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || '';
const PUSH_CONFIGURED = Boolean(VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY);

if (PUSH_CONFIGURED) {
  webPush.setVapidDetails('mailto:soporte@chekify.local', VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
} else {
  console.warn('Web Push disabled: VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY are not configured.');
}

let FIREBASE_PROJECT_ID = 'gen-lang-client-0220183815';
let DATABASE_ID = 'ai-studio-c7d4b1a6-2c20-4b59-832b-c28e09be8db2';

try {
  const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
  if (fs.existsSync(configPath)) {
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    if (config.projectId) FIREBASE_PROJECT_ID = config.projectId;
    if (config.firestoreDatabaseId) DATABASE_ID = config.firestoreDatabaseId;
    console.log('Loaded Firebase config from JSON for Admin SDK:', FIREBASE_PROJECT_ID);
  }
} catch (e) {
  console.warn('Could not read firebase-applet-config.json, using defaults');
}

let adminApp: any;
async function initAdmin() {
  try {
    const existingApps = getApps();
    if (existingApps.length > 0) {
      const existing = existingApps[0];
      if (existing.options.projectId === FIREBASE_PROJECT_ID) {
        adminApp = existing;
      } else {
        await deleteApp(existing);
        adminApp = initializeApp({ projectId: FIREBASE_PROJECT_ID, credential: applicationDefault() });
      }
    } else {
      adminApp = initializeApp({ projectId: FIREBASE_PROJECT_ID, credential: applicationDefault() });
    }
  } catch (e: any) {
    console.error('Firebase Admin initialization failed', e);
  }
}

const expressApp = express();
expressApp.use(express.json({ limit: '1mb' }));

function pushUnavailable(res: express.Response) {
  return res.status(503).json({ error: 'Push notifications are not configured on the server' });
}

async function authenticateRequest(req: express.Request, res: express.Response) {
  if (!adminApp) {
    res.status(500).json({ error: 'Firebase Admin not initialized' });
    return null;
  }

  const authorization = req.get('authorization') || '';
  if (!authorization.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Authentication required' });
    return null;
  }

  const token = authorization.slice(7).trim();
  if (!token) {
    res.status(401).json({ error: 'Authentication required' });
    return null;
  }

  try {
    const auth = getAuth(adminApp);
    const decodedToken = await auth.verifyIdToken(token);
    const db = getFirestore(adminApp, DATABASE_ID);
    const userDoc = await db.collection('users').doc(decodedToken.uid).get();
    const userData = userDoc.exists ? userDoc.data() || {} : {};
    return { decodedToken, userData, db };
  } catch (error: any) {
    console.warn('API authentication failed:', error?.code || error?.message);
    res.status(401).json({ error: 'Invalid or expired authentication token' });
    return null;
  }
}

function hasRole(userData: any, ...roles: string[]) {
  const role = String(userData?.role || '').toLowerCase();
  return roles.map(r => r.toLowerCase()).includes(role);
}

// Admin password reset.
expressApp.post('/api/admin/reset-password', async (req, res) => {
  const { identifier, newPassword, adminToken } = req.body;
  if (!identifier || !newPassword || !adminToken) {
    return res.status(400).json({ error: 'Faltan campos obligatorios' });
  }
  if (!adminApp) return res.status(500).json({ error: 'Firebase Admin not initialized' });

  try {
    const auth = getAuth(adminApp);
    const db = getFirestore(adminApp, DATABASE_ID);
    let decodedToken: any;
    try {
      decodedToken = await auth.verifyIdToken(adminToken);
    } catch (verifyError: any) {
      return res.status(401).json({ error: 'Sesión administrativa no válida o expirada' });
    }

    const adminEmail = decodedToken.email || '';
    const adminDoc = await db.collection('users').doc(decodedToken.uid).get();
    const adminData = adminDoc.exists ? adminDoc.data() || {} : {};
    const isAuthorized = adminEmail === 'maisserk@gmail.com' || hasRole(adminData, 'Administrador', 'Admin');

    if (!isAuthorized) {
      return res.status(403).json({ error: 'No tienes permisos suficientes para realizar esta acción' });
    }

    let targetUid = '';
    try {
      const email = identifier.includes('@') ? identifier : `${identifier}@chekify.local`;
      targetUid = (await auth.getUserByEmail(email)).uid;
    } catch {
      targetUid = identifier;
    }

    await auth.updateUser(targetUid, { password: newPassword });
    res.json({ success: true, message: 'Contraseña actualizada exitosamente' });
  } catch (error: any) {
    console.error('Error resetting password:', error);
    res.status(500).json({ error: 'Error al actualizar la contraseña', code: error.code });
  }
});

// Public key is safe to expose; the private key never leaves the server environment.
expressApp.get('/api/push/vapid-key', (_req, res) => {
  if (!PUSH_CONFIGURED) return pushUnavailable(res);
  res.json({ publicKey: VAPID_PUBLIC_KEY });
});

// Register a device. Identity, role and plant are derived from the verified Firebase token,
// never trusted from the browser-provided user object.
expressApp.post('/api/push/subscribe', async (req, res) => {
  if (!PUSH_CONFIGURED) return pushUnavailable(res);
  const { subscription } = req.body;
  if (!subscription || !subscription.endpoint) {
    return res.status(400).json({ error: 'Subscription is required' });
  }

  const identity = await authenticateRequest(req, res);
  if (!identity) return;

  const { decodedToken, userData, db } = identity;
  const role = String(userData.role || '');
  if (!hasRole(userData, 'Supervisor', 'Administrador', 'Admin')) {
    return res.status(403).json({ error: 'Only supervisors and administrators can enable push alerts' });
  }

  try {
    const docId = Buffer.from(subscription.endpoint).toString('base64').replace(/[/+=]/g, '_').slice(0, 100);
    await db.collection('push_subscriptions').doc(docId).set({
      subscription,
      uid: decodedToken.uid,
      role,
      plantId: userData.plantId || null,
      updatedAt: Date.now()
    }, { merge: true });

    res.json({ success: true, message: 'Subscripción registrada correctamente' });
  } catch (error: any) {
    console.error('Error saving push subscription:', error);
    res.status(500).json({ error: 'Failed to save subscription' });
  }
});

// A user can remove only their own subscription.
expressApp.post('/api/push/unsubscribe', async (req, res) => {
  if (!PUSH_CONFIGURED) return pushUnavailable(res);
  const { endpoint } = req.body;
  if (!endpoint) return res.status(400).json({ error: 'Endpoint is required' });

  const identity = await authenticateRequest(req, res);
  if (!identity) return;

  try {
    const docId = Buffer.from(endpoint).toString('base64').replace(/[/+=]/g, '_').slice(0, 100);
    const ref = identity.db.collection('push_subscriptions').doc(docId);
    const snapshot = await ref.get();
    if (snapshot.exists && snapshot.data()?.uid !== identity.decodedToken.uid) {
      return res.status(403).json({ error: 'You cannot remove another user subscription' });
    }
    await ref.delete();
    res.json({ success: true });
  } catch (error: any) {
    console.error('Error removing push subscription:', error);
    res.status(500).json({ error: 'Failed to remove subscription' });
  }
});

// A user can test only their own registered subscription.
expressApp.post('/api/push/test', async (req, res) => {
  if (!PUSH_CONFIGURED) return pushUnavailable(res);
  const { subscription } = req.body;
  if (!subscription?.endpoint) return res.status(400).json({ error: 'Subscription is required' });

  const identity = await authenticateRequest(req, res);
  if (!identity) return;

  try {
    const docId = Buffer.from(subscription.endpoint).toString('base64').replace(/[/+=]/g, '_').slice(0, 100);
    const stored = await identity.db.collection('push_subscriptions').doc(docId).get();
    if (!stored.exists || stored.data()?.uid !== identity.decodedToken.uid) {
      return res.status(403).json({ error: 'Subscription is not registered to this user' });
    }

    const payload = JSON.stringify({
      title: '🔔 ¡Notificaciones Activadas!',
      body: 'Estás suscrito para recibir alertas instantáneas en tu dispositivo al reportarse hallazgos críticos.',
      url: '/',
      tag: 'test-notification',
      requireInteraction: true
    });
    await webPush.sendNotification(subscription, payload);
    res.json({ success: true, message: 'Notificación de prueba enviada' });
  } catch (error: any) {
    console.error('Error sending test notification:', error);
    res.status(500).json({ error: 'Failed to send test notification' });
  }
});

// Send alerts only for the authenticated user's plant. plantId from the client is ignored.
expressApp.post('/api/push/send-alert', async (req, res) => {
  if (!PUSH_CONFIGURED) return pushUnavailable(res);
  const { title, body, url, priority, findingId, areaName, equipmentName, reportedBy, tag } = req.body;

  const identity = await authenticateRequest(req, res);
  if (!identity) return;

  const callerPlantId = identity.userData?.plantId || null;
  if (!callerPlantId) return res.status(403).json({ error: 'User is not assigned to a plant' });

  try {
    const subsSnapshot = await identity.db.collection('push_subscriptions').get();
    if (subsSnapshot.empty) return res.json({ success: true, sentCount: 0 });

    const payload = JSON.stringify({
      title: title || '⚠️ ¡ALERTA: Hallazgo Reportado!',
      body: body || `Se reportó un hallazgo en ${areaName || 'Área general'} (${equipmentName || 'Equipo'})`,
      url: url || '/',
      tag: tag || `finding-alert-${findingId || Date.now()}`,
      priority: priority || 'Alta',
      findingId: findingId || null,
      areaName,
      equipmentName,
      reportedBy,
      requireInteraction: true
    });

    let sentCount = 0;
    const errors: string[] = [];
    const sendPromises = subsSnapshot.docs.map(async (doc) => {
      const data = doc.data();
      if (!data?.subscription || data.plantId !== callerPlantId) return;

      try {
        await webPush.sendNotification(data.subscription, payload);
        sentCount++;
      } catch (err: any) {
        if (err?.statusCode === 404 || err?.statusCode === 410) {
          await doc.ref.delete().catch(() => undefined);
        } else {
          errors.push(err?.message || 'Unknown push error');
        }
      }
    });

    await Promise.all(sendPromises);
    res.json({ success: true, sentCount, errors });
  } catch (error: any) {
    console.error('Error broadcasting push alert:', error);
    res.status(500).json({ error: 'Failed to send push alerts' });
  }
});

async function startServer() {
  await initAdmin();
  const isProd = process.env.NODE_ENV === 'production';
  const PORT = 3000;

  if (!isProd) {
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: 'spa' });
    expressApp.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    expressApp.use(express.static(distPath));
    expressApp.get('*', (_req, res) => res.sendFile(path.join(distPath, 'index.html')));
  }

  expressApp.listen(PORT, '0.0.0.0', () => console.log(`Server running on http://localhost:${PORT}`));
}

startServer();
