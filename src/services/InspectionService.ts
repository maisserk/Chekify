/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Chekify Enterprise Industrial SaaS Framework
 * Module: InspectionService
 * 
 * Channel multiplexer for Inspections collection.
 * Prevents redundant onSnapshot listeners when OperatorDashboard mounts or navigates.
 * Scopes recent inspections by plantId and caps to latest 150 items.
 */

import { db, auth, handleFirestoreError } from '../firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { 
  collection, 
  query, 
  where, 
  orderBy,
  limit, 
  onSnapshot 
} from 'firebase/firestore';

interface InspectionChannel {
  channelKey: string;
  subscribers: Map<number, (inspections: any[]) => void>;
  latestData: any[] | null;
  unsubFirestore: (() => void) | null;
  teardownTimeout: ReturnType<typeof setTimeout> | null;
  unsubAuth: (() => void) | null;
}

export class InspectionService {
  private static readonly COLLECTION_NAME = 'inspections';
  private static nextSubId = 0;
  private static channels: Map<string, InspectionChannel> = new Map();
  private static readonly TEARDOWN_GRACE_PERIOD_MS = 5 * 60 * 1000; // 5 minutes grace period

  /**
   * Resets all inspection channels on sign out.
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
   * Subscribes to recent inspections with multiplexing.
   */
  public static subscribeToRecentInspections(
    callback: (inspections: any[]) => void,
    plantId?: string,
    isAdmin: boolean = false
  ): () => void {
    const subId = ++this.nextSubId;
    const plantKey = isAdmin ? '__admin_all__' : (plantId ? plantId.trim().toLowerCase() : '__all__');

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
      channel = {
        channelKey: plantKey,
        subscribers: new Map([[subId, callback]]),
        latestData: null,
        unsubFirestore: null,
        teardownTimeout: null,
        unsubAuth: null
      };
      this.channels.set(plantKey, channel);

      const attachFirestoreListener = () => {
        const ch = this.channels.get(plantKey);
        if (!ch || ch.unsubFirestore) return;
        if (!auth.currentUser) return;

        const inspectionsRef = collection(db, this.COLLECTION_NAME);
        const inspectionsQuery = (!isAdmin && plantId && plantId !== 'default-plant')
          ? query(inspectionsRef, where('plantId', '==', plantId), limit(150))
          : query(inspectionsRef, limit(150));

        try {
          ch.unsubFirestore = onSnapshot(
            inspectionsQuery,
            (snapshot) => {
              const allDocs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
              const filtered = (isAdmin || !plantId || plantId === 'default-plant')
                ? allDocs
                : allDocs.filter((insp: any) => !insp.plantId || insp.plantId === plantId);

              const currentCh = this.channels.get(plantKey);
              if (currentCh) {
                currentCh.latestData = filtered;
                currentCh.subscribers.forEach(cb => {
                  try { cb(filtered); } catch (e) { console.error('[InspectionService] Subscriber error:', e); }
                });
              }
            },
            (error) => {
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

      channel.unsubAuth = onAuthStateChanged(auth, (firebaseUser) => {
        if (firebaseUser) {
          attachFirestoreListener();
        } else {
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
}
