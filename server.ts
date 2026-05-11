import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import { initializeApp, getApps, deleteApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
await initAdmin();

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

async function startServer() {
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
