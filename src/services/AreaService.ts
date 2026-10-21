/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Chekify Enterprise Industrial SaaS Framework
 * Module: AreaService
 * 
 * Channel multiplexer for Areas collection.
 * Prevents duplicate Firestore onSnapshot listeners when navigating between
 * OperatorDashboard, AdminManagement, and other views.
 * Strictly adheres to Firebase Auth readiness before attaching listeners.
 */

import { db, auth, handleFirestoreError } from '../firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { 
  collection, 
  query, 
  where, 
  onSnapshot,
  getDocs
} from 'firebase/firestore';
import { Area } from '../types';
import { cacheAreas, getCachedAreas } from '../utils/offlineCache';

interface AreaChannel {
  plantKey: string;
  subscribers: Map<number, (areas: Area[]) => void>;
  latestData: Area[] | null;
  unsubFirestore: (() => void) | null;
  teardownTimeout: ReturnType<typeof setTimeout> | null;
  unsubAuth: (() => void) | null;
}

export class AreaService {
  private static readonly COLLECTION_NAME = 'areas';
  private static nextSubId = 0;
  private static channels: Map<string, AreaChannel> = new Map();
  private static readonly TEARDOWN_GRACE_PERIOD_MS = 5 * 60 * 1000; // 5 minutes grace period

  /**
   * Resets and cleans up all active listeners. Called on logout / sign out.
   */
  public static reset(): void {
    this.channels.forEach(ch => {
      if (ch.teardownTimeout) {
        clearTimeout(ch.teardownTimeout);
        ch.teardownTimeout = null;
      }
      if (ch.unsubFirestore) {
        try { ch.unsubFirestore(); } catch {}
        ch.unsubFirestore = null;
      }
      if (ch.unsubAuth) {
        try { ch.unsubAuth(); } catch {}
        ch.unsubAuth = null;
      }
    });
    this.channels.clear();
  }

  /**
   * Subscribes to real-time areas scoped by plant.
   * Reuses the active Firestore listener across all components.
   * Strictly verifies authentication before attaching any Firestore listener.
   */
  public static subscribeToAreas(
    callback: (areas: Area[]) => void,
    plantId?: string
  ): () => void {
    const subId = ++this.nextSubId;
    const plantKey = plantId ? plantId.trim().toLowerCase() : '__all__';

    let channel = this.channels.get(plantKey);

    if (channel) {
      if (channel.teardownTimeout) {
        clearTimeout(channel.teardownTimeout);
        channel.teardownTimeout = null;
      }
      channel.subscribers.set(subId, callback);
      if (channel.latestData) {
        callback(channel.latestData);
      }
    } else {
      const initialCached = getCachedAreas().filter(item => {
        if (plantId) return item.plantId === plantId;
        return true;
      });

      channel = {
        plantKey,
        subscribers: new Map([[subId, callback]]),
        latestData: initialCached.length > 0 ? initialCached : null,
        unsubFirestore: null,
        teardownTimeout: null,
        unsubAuth: null
      };
      this.channels.set(plantKey, channel);

      if (channel.latestData) {
        callback(channel.latestData);
      }

      const attachFirestoreListener = () => {
        const ch = this.channels.get(plantKey);
        if (!ch || ch.unsubFirestore) return;
        if (!auth.currentUser) return;

        const areasRef = collection(db, this.COLLECTION_NAME);
        const areasQuery = (plantId && plantId !== 'default-plant')
          ? query(areasRef, where('plantId', '==', plantId))
          : areasRef;

        try {
          ch.unsubFirestore = onSnapshot(
            areasQuery,
            (snapshot) => {
              let list = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Area));
              if (plantId && plantId !== 'default-plant') {
                list = list.filter(a => !a.plantId || a.plantId === plantId);
              }

              const currentCh = this.channels.get(plantKey);
              if (currentCh) {
                currentCh.latestData = list;
                currentCh.subscribers.forEach(cb => {
                  try { cb(list); } catch (e) { console.error('[AreaService] Subscriber error:', e); }
                });
              }
              cacheAreas(list);
            },
            (error) => {
              // If unauthenticated or signing out, cleanly dismiss without uncaught throw
              if (!auth.currentUser) {
                if (ch.unsubFirestore) {
                  try { ch.unsubFirestore(); } catch {}
                  ch.unsubFirestore = null;
                }
                return;
              }
              handleFirestoreError(error, 'list', this.COLLECTION_NAME);
            }
          );
        } catch (err) {
          if (!auth.currentUser) return;
          handleFirestoreError(err, 'list', this.COLLECTION_NAME);
        }
      };

      if (auth.currentUser) {
        attachFirestoreListener();
      }

      // Always maintain auth sync so listeners attach on login and detach on logout
      channel.unsubAuth = onAuthStateChanged(auth, (firebaseUser) => {
        if (firebaseUser) {
          attachFirestoreListener();
        } else {
          // User signed out, tear down Firestore listener
          const ch = this.channels.get(plantKey);
          if (ch && ch.unsubFirestore) {
            try { ch.unsubFirestore(); } catch {}
            ch.unsubFirestore = null;
          }
        }
      });
    }

    return () => {
      const ch = this.channels.get(plantKey);
      if (!ch) return;
      ch.subscribers.delete(subId);
      if (ch.subscribers.size === 0) {
        if (ch.teardownTimeout) clearTimeout(ch.teardownTimeout);
        ch.teardownTimeout = setTimeout(() => {
          if (ch.subscribers.size === 0) {
            if (ch.unsubFirestore) {
              try { ch.unsubFirestore(); } catch {}
            }
            if (ch.unsubAuth) {
              try { ch.unsubAuth(); } catch {}
            }
            this.channels.delete(plantKey);
          }
        }, this.TEARDOWN_GRACE_PERIOD_MS);
      }
    };
  }

  /**
   * Fetches areas list scoped by plantId from active channel or cache before hitting network.
   */
  public static async fetchAreas(plantId?: string): Promise<Area[]> {
    const plantKey = plantId ? plantId.trim().toLowerCase() : '__all__';
    const channel = this.channels.get(plantKey);
    if (channel && channel.latestData) {
      return channel.latestData;
    }

    const cached = getCachedAreas();
    if (cached.length > 0) {
      if (plantId) return cached.filter(a => a.plantId === plantId);
      return cached;
    }

    if (!auth.currentUser) {
      return plantId ? cached.filter(a => a.plantId === plantId) : cached;
    }

    try {
      const areasRef = collection(db, this.COLLECTION_NAME);
      const areasQuery = (plantId && plantId !== 'default-plant')
        ? query(areasRef, where('plantId', '==', plantId))
        : areasRef;
      const snapshot = await getDocs(areasQuery);
      const list = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Area));
      cacheAreas(list);
      return list;
    } catch (err) {
      if (!auth.currentUser) {
        return cached;
      }
      handleFirestoreError(err, 'list', this.COLLECTION_NAME);
      return [];
    }
  }
}
