import { getApps, initializeApp, cert, applicationDefault } from 'firebase-admin/app';
import { getAuth, type Auth } from 'firebase-admin/auth';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';

export type ApiRequest = {
  get?: (name: string) => string | undefined;
  headers?: Record<string, string | string[] | undefined>;
};

export type ApiResponse = {
  status: (code: number) => ApiResponse;
  json: (body: unknown) => void;
};

export type Identity = {
  uid: string;
  email?: string;
  role: string;
  plantId: string | null;
  db: Firestore;
};

const PROJECT_ID = process.env.FIREBASE_PROJECT_ID || 'gen-lang-client-0220183815';
const DATABASE_ID = process.env.FIRESTORE_DATABASE_ID || 'ai-studio-c7d4b1a6-2c20-4b59-832b-c28e09be8db2';

function getAdminApp() {
  const apps = getApps();
  if (apps.length > 0) return apps[0];

  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (serviceAccountJson) {
    const serviceAccount = JSON.parse(serviceAccountJson);
    return initializeApp({ credential: cert(serviceAccount), projectId: PROJECT_ID });
  }

  return initializeApp({ projectId: PROJECT_ID, credential: applicationDefault() });
}

export async function authenticateRequest(req: ApiRequest, res: ApiResponse): Promise<Identity | null> {
  const authorization = req.get?.('authorization') || (typeof req.headers?.authorization === 'string' ? req.headers.authorization : '');
  if (!authorization.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Authentication required' });
    return null;
  }

  const token = authorization.slice(7).trim();
  if (!token) {
    res.status(401).json({ error: 'Authentication required' });
    return null;
  }

  let app;
  try {
    app = getAdminApp();
  } catch (error: any) {
    console.error('Push API Firebase Admin initialization failed:', error?.message || error);
    res.status(500).json({ error: 'Push server authentication is unavailable' });
    return null;
  }

  let decoded;
  try {
    const auth: Auth = getAuth(app);
    decoded = await auth.verifyIdToken(token);
  } catch (error: any) {
    console.warn('Push API ID token verification failed:', error?.code || error?.message || 'unknown error');
    res.status(401).json({ error: 'Invalid or expired authentication token' });
    return null;
  }

  const db = getFirestore(app, DATABASE_ID);
  try {
    const userDoc = await db.collection('users').doc(decoded.uid).get();
    const userData = userDoc.exists ? userDoc.data() || {} : {};

    return {
      uid: decoded.uid,
      email: decoded.email || undefined,
      role: String(userData.role || ''),
      plantId: userData.plantId || null,
      db,
    };
  } catch (error: any) {
    console.error('Push API Firestore user lookup failed:', error?.code || error?.message || error);
    res.status(500).json({ error: 'Push server could not load the user profile' });
    return null;
  }
}

export function hasPushRole(role: string) {
  const normalized = role.toLowerCase();
  return normalized === 'supervisor' || normalized === 'administrador' || normalized === 'admin';
}
