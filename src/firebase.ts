import { initializeApp } from 'firebase/app';
import { getAuth, setPersistence, browserLocalPersistence } from 'firebase/auth';
import { 
  initializeFirestore,
  doc, 
  getDocFromServer,
  persistentLocalCache,
  persistentMultipleTabManager,
  onSnapshotsInSync
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// Use initializeFirestore with modern cache settings and long-polling for iframe compatibility
const db = initializeFirestore(app, {
  localCache: persistentLocalCache({tabManager: persistentMultipleTabManager()}),
  experimentalForceLongPolling: true,
  useFetchStreams: false,
  host: "firestore.googleapis.com", // Explicitly set host
} as any, firebaseConfig.firestoreDatabaseId || '(default)');

// Set persistence to local to handle framed environment better
setPersistence(auth, browserLocalPersistence).catch(err => {
  console.error("Auth persistence error:", err);
});

// Listener to track server synchronization status
onSnapshotsInSync(db, () => {
  // console.log("Firestore: Snapshots in sync with server");
});

// CRITICAL CONSTRAINT: Test connection on boot but don't block
async function testConnection() {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s for connection test

  try {
    if (navigator.onLine) {
      // Use getDocFromServer to strictly test if backend is reachable
      await getDocFromServer(doc(db, 'test', 'connection'));
      console.log("Firestore connection test: SUCCESS (Server reached)");
    } else {
      console.warn("Firestore check: Browser reports offline mode.");
    }
  } catch (error: any) {
    if (error.name === 'AbortError') {
      console.warn("Firestore connection test timed out after 30s. This usually indicates a network restriction, tracking blocker, or very slow connection.");
    } else if (error.code === 'permission-denied' || error.code === 'not-found') {
      // These errors actually mean we DID reach the server (it responded with denied/not found)
      console.log("Firestore reachability test: REACHED");
    } else if (error.message?.includes('Backend didn\'t respond within 10 seconds') || error.code === 'unavailable') {
      console.warn("Firestore connection warning: The backend is taking too long to respond. Check if uBlock/AdBlock or a VPN is interfering.");
    } else {
      console.warn("Firestore connection check status:", error.code || error.message);
    }
  } finally {
    clearTimeout(timeoutId);
  }
}
testConnection();

export interface FirestoreErrorInfo {
  error: string;
  operationType: 'create' | 'update' | 'delete' | 'list' | 'get' | 'write';
  path: string | null;
  authInfo: {
    userId: string;
    email: string;
    emailVerified: boolean;
    isAnonymous: boolean;
    providerInfo: { providerId: string; displayName: string; email: string; }[];
  }
}

export function handleFirestoreError(error: any, operationType: FirestoreErrorInfo['operationType'], path: string | null = null): never {
  const authInfo = auth.currentUser ? {
    userId: auth.currentUser.uid,
    email: auth.currentUser.email || '',
    emailVerified: auth.currentUser.emailVerified,
    isAnonymous: auth.currentUser.isAnonymous,
    providerInfo: auth.currentUser.providerData.map(p => ({
      providerId: p.providerId,
      displayName: p.displayName || '',
      email: p.email || ''
    }))
  } : {
    userId: 'unauthenticated',
    email: '',
    emailVerified: false,
    isAnonymous: true,
    providerInfo: []
  };

  const errorInfo: FirestoreErrorInfo = {
    error: error.message || String(error),
    operationType,
    path,
    authInfo
  };
  
  if (error.code === 'permission-denied') {
    throw new Error(JSON.stringify(errorInfo));
  }
  
  throw error;
}

export { auth, db };
