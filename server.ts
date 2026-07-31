import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { initializeApp, getApps, deleteApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import fs from 'fs';
import webPush from 'web-push';

// Configure Web Push VAPID keys
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || 'BLoAyNRWGSv3W5HaN23dUw5IM_KSfJQHNgebTl245nGkmjtXkbumNb5rx-PfmHboxOSt_CTE6IO4jXYRfwqhSGI';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || 'rcdap5QeRatgCBIVbJ7H2XGLNjeGWBLvEJlQI9gKs-4';

webPush.setVapidDetails(
  'mailto:soporte@chekify.local',
  VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY
);

// Try to load project details from config file
let FIREBASE_PROJECT_ID = "gen-lang-client-0220183815";
let DATABASE_ID = "ai-studio-c7d4b1a6-2c20-4b59-832b-c28e09be8db2";

try {
  const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
  if (fs.existsSync(configPath)) {
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    if (config.projectId) FIREBASE_PROJECT_ID = config.projectId;
    if (config.firestoreDatabaseId) DATABASE_ID = config.firestoreDatabaseId;
    console.log("Loaded Firebase config from JSON for Admin SDK:", FIREBASE_PROJECT_ID);
  }
} catch (e) {
  console.warn("Could not read firebase-applet-config.json, using defaults");
}

// Initialize Firebase Admin
let adminApp: any;
async function initAdmin() {
  try {
    const existingApps = getApps();
    if (existingApps.length > 0) {
      // Check if the existing app matches our target project
      const existing = existingApps[0];
      if (existing.options.projectId === FIREBASE_PROJECT_ID) {
        adminApp = existing;
        console.log("Using existing Firebase Admin app. Project ID:", adminApp.options.projectId);
      } else {
        console.log("Existing app project mismatch. Re-initializing...");
        await deleteApp(existing);
        adminApp = initializeApp({
          projectId: FIREBASE_PROJECT_ID,
          credential: applicationDefault()
        });
      }
    } else {
      console.log("Initializing Firebase Admin with Project ID:", FIREBASE_PROJECT_ID);
      adminApp = initializeApp({
        projectId: FIREBASE_PROJECT_ID,
        credential: applicationDefault()
      });
    }
  } catch (e: any) {
    console.error("Firebase Admin initialization failed", e);
  }
}

const expressApp = express(); // Renamed from 'app' to avoid confusion with firebase 'app'
expressApp.use(express.json());

// API Route to reset password
expressApp.post('/api/admin/reset-password', async (req, res) => {
  const { identifier, newPassword, adminToken } = req.body;

  console.log(`Password reset request for: ${identifier}`);

  if (!identifier || !newPassword || !adminToken) {
    return res.status(400).json({ error: 'Faltan campos obligatorios' });
  }

  if (!adminApp) {
    return res.status(500).json({ error: 'Firebase Admin not initialized' });
  }

  try {
    // 1. Verify Admin Token using the initialized app
    const auth = getAuth(adminApp);
    const db = getFirestore(adminApp, DATABASE_ID);
    
    let decodedToken;
    try {
      decodedToken = await auth.verifyIdToken(adminToken);
    } catch (verifyError: any) {
      console.error("Token verification failed:", verifyError);
      return res.status(401).json({ 
        error: 'Sesión administrativa no válida o expirada',
        details: verifyError.message
      });
    }
    
    const adminUid = decodedToken.uid;
    const adminEmail = decodedToken.email;
    console.log(`Admin UID verified: ${adminUid} (${adminEmail})`);

    // 2. Check if user is admin in Firestore
    let isAuthorized = false;
    
    if (adminEmail === 'maisserk@gmail.com') {
      console.log("Authorization granted via hardcoded email (primary check)");
      isAuthorized = true;
    } else {
      try {
        const userDocRef = db.collection('users').doc(adminUid);
        const userDoc = await userDocRef.get();
        if (userDoc.exists && userDoc.data()?.role === 'Administrador') {
          isAuthorized = true;
        }
      } catch (fsError: any) {
        console.error("Firestore check failed:", fsError);
        // If firestore fails but we have a valid token for the core admin email, we allow it
        if (adminEmail === 'maisserk@gmail.com') isAuthorized = true;
      }
    }
    
    if (!isAuthorized) {
      console.warn(`Unauthorized attempt to reset password by: ${adminEmail}`);
      return res.status(403).json({ error: 'No tienes permisos suficientes para realizar esta acción' });
    }

    console.log(`Admin ${adminUid} authorized. Resetting password for ${identifier}`);

    // 3. Update the password
    let targetUid = "";
    try {
      // Try by email first
      const email = identifier.includes('@') ? identifier : `${identifier}@chekify.local`;
      const userRecord = await auth.getUserByEmail(email);
      targetUid = userRecord.uid;
    } catch (e) {
      // Try by UID directly
      console.log(`Could not find user by email, trying by identifier as UID: ${identifier}`);
      targetUid = identifier;
    }

    await auth.updateUser(targetUid, {
      password: newPassword
    });

    console.log(`Password updated successfully for UID: ${targetUid}`);
    res.json({ success: true, message: 'Contraseña actualizada exitosamente' });
  } catch (error: any) {
    console.error('Error resetting password details:', error);
    res.status(500).json({ 
      error: 'Error al actualizar la contraseña', 
      details: error.message,
      code: error.code
    });
  }
});

// API Route: Get VAPID Public Key for push notifications
expressApp.get('/api/push/vapid-key', (req, res) => {
  res.json({ publicKey: VAPID_PUBLIC_KEY });
});

// API Route: Subscribe user device to push notifications
expressApp.post('/api/push/subscribe', async (req, res) => {
  const { subscription, user } = req.body;
  if (!subscription || !subscription.endpoint) {
    return res.status(400).json({ error: 'Subscription is required' });
  }

  try {
    const db = getFirestore(adminApp);
    const docId = Buffer.from(subscription.endpoint).toString('base64').replace(/[/+=]/g, '_').slice(0, 100);
    await db.collection('push_subscriptions').doc(docId).set({
      subscription,
      user: user || {},
      role: user?.role || 'Supervisor',
      uid: user?.uid || '',
      updatedAt: Date.now()
    }, { merge: true });

    console.log(`Push subscription saved for user: ${user?.name || 'Anonymous'} (${user?.role || 'Supervisor'})`);
    res.json({ success: true, message: 'Subscripción registrada correctamente' });
  } catch (error: any) {
    console.error('Error saving push subscription:', error);
    res.status(500).json({ error: 'Failed to save subscription', details: error.message });
  }
});

// API Route: Unsubscribe user device from push notifications
expressApp.post('/api/push/unsubscribe', async (req, res) => {
  const { endpoint } = req.body;
  if (!endpoint) {
    return res.status(400).json({ error: 'Endpoint is required' });
  }

  try {
    const db = getFirestore(adminApp);
    const docId = Buffer.from(endpoint).toString('base64').replace(/[/+=]/g, '_').slice(0, 100);
    await db.collection('push_subscriptions').doc(docId).delete();
    console.log(`Push subscription removed for endpoint: ${endpoint.slice(0, 30)}...`);
    res.json({ success: true });
  } catch (error: any) {
    console.error('Error removing push subscription:', error);
    res.status(500).json({ error: 'Failed to remove subscription' });
  }
});

// API Route: Send a test notification to a specific subscription
expressApp.post('/api/push/test', async (req, res) => {
  const { subscription } = req.body;
  if (!subscription) {
    return res.status(400).json({ error: 'Subscription is required' });
  }

  try {
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
    res.status(500).json({ error: 'Failed to send test notification', details: error.message });
  }
});

// API Route: Send critical finding alert push notification to supervisors & admins
expressApp.post('/api/push/send-alert', async (req, res) => {
  const { title, body, url, priority, findingId, areaName, equipmentName, reportedBy, tag } = req.body;

  try {
    if (!adminApp) {
      return res.status(500).json({ error: 'Firebase Admin not initialized' });
    }

    const db = getFirestore(adminApp);
    const subsSnapshot = await db.collection('push_subscriptions').get();

    if (subsSnapshot.empty) {
      console.log('No push subscriptions found in Firestore.');
      return res.json({ success: true, sentCount: 0 });
    }

    const payload = JSON.stringify({
      title: title || '⚠️ ¡ALERTA: Hallazgo Crítico Reportado!',
      body: body || `Se reportó un hallazgo crítico en ${areaName || 'Área general'} (${equipmentName || 'Equipo'})`,
      url: url || '/',
      tag: tag || `critical-finding-${findingId || Date.now()}`,
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
      if (!data || !data.subscription) return;

      try {
        await webPush.sendNotification(data.subscription, payload);
        sentCount++;
      } catch (err: any) {
        console.error(`Error sending push to doc ${doc.id}:`, err?.statusCode || err?.message);
        if (err?.statusCode === 404 || err?.statusCode === 410) {
          try {
            await doc.ref.delete();
            console.log(`Deleted expired subscription doc: ${doc.id}`);
          } catch (deleteErr) {
            console.error('Failed to delete expired doc:', deleteErr);
          }
        } else {
          errors.push(err?.message || 'Unknown push error');
        }
      }
    });

    await Promise.all(sendPromises);

    console.log(`Critical push alert broadcasted. Sent: ${sentCount}, Total targets: ${subsSnapshot.size}`);
    res.json({ success: true, sentCount, errors });
  } catch (error: any) {
    console.error('Error broadcasting push alert:', error);
    res.status(500).json({ error: 'Failed to send push alerts', details: error.message });
  }
});

async function startServer() {
  await initAdmin();
  const isProd = process.env.NODE_ENV === 'production';
  const PORT = 3000;

  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    expressApp.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    expressApp.use(express.static(distPath));
    expressApp.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  expressApp.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
