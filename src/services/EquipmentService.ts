/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Chekify Enterprise Industrial SaaS Framework
 * Module: EquipmentService
 * 
 * High-performance, isolated domain service for Equipment management.
 * Integrates channel multiplexing to prevent duplicate Firestore onSnapshot reads across
 * OperatorDashboard, AdminManagement, and inspections.
 */

import { db, auth, handleFirestoreError } from '../firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { 
  collection, 
  doc, 
  query, 
  where, 
  onSnapshot,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc
} from 'firebase/firestore';
import { Equipment } from '../types';
import { cacheEquipment, getCachedEquipment } from '../utils/offlineCache';
import { offlineQueueService } from './OfflineQueueService';

interface EquipmentChannel {
  plantKey: string;
  subscribers: Map<number, (equipment: Equipment[]) => void>;
  latestData: Equipment[] | null;
  unsubFirestore: (() => void) | null;
  teardownTimeout: ReturnType<typeof setTimeout> | null;
  unsubAuth: (() => void) | null;
}

export class EquipmentService {
  private static readonly COLLECTION_NAME = 'equipment';
  private static nextSubId = 0;
  private static channels: Map<string, EquipmentChannel> = new Map();
  private static readonly TEARDOWN_GRACE_PERIOD_MS = 5 * 60 * 1000; // 5 minutes grace period

  /**
   * Resets all equipment channels and listeners on sign out.
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
   * Subscribes to real-time equipment scoped by plant.
   * If a channel for the plant already exists, reuses the active Firestore onSnapshot listener.
   * Only attaches Firestore listeners when authentication is confirmed.
   */
  public static subscribeToEquipment(
    callback: (equipment: Equipment[]) => void,
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
      // Seed with cached equipment if available for instant UI rendering
      const initialCached = getCachedEquipment().filter(item => {
        if (item.status === 'deleted') return false;
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

        const equipRef = collection(db, this.COLLECTION_NAME);
        const equipmentQuery = plantId
          ? query(equipRef, where('plantId', '==', plantId))
          : equipRef;

        try {
          ch.unsubFirestore = onSnapshot(
            equipmentQuery,
            (snapshot) => {
              let list = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Equipment));
              list = list.filter(item => item.status !== 'deleted');
              if (plantId) {
                list = list.filter(item => item.plantId === plantId);
              }
              list.sort((a, b) => (a.inspectionOrder || 0) - (b.inspectionOrder || 0));

              const currentCh = this.channels.get(plantKey);
              if (currentCh) {
                currentCh.latestData = list;
                currentCh.subscribers.forEach(cb => {
                  try { cb(list); } catch (e) { console.error('[EquipmentService] Subscriber error:', e); }
                });
              }
              cacheEquipment(list);
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

  /**
   * Fetches equipment list scoped by plantId, leveraging active channel memory or cache.
   */
  public static async fetchEquipment(plantId?: string): Promise<Equipment[]> {
    const plantKey = plantId ? plantId.trim().toLowerCase() : '__all__';
    const channel = this.channels.get(plantKey);
    if (channel && channel.latestData) {
      return channel.latestData;
    }

    const cached = getCachedEquipment();
    if (cached.length > 0) {
      const filtered = cached.filter(item => {
        if (item.status === 'deleted') return false;
        if (plantId) return item.plantId === plantId;
        return true;
      });
      if (filtered.length > 0) return filtered;
    }

    if (!auth.currentUser) {
      return cached.filter(item => item.status !== 'deleted' && (!plantId || item.plantId === plantId));
    }

    try {
      const equipRef = collection(db, this.COLLECTION_NAME);
      const equipmentQuery = plantId
        ? query(equipRef, where('plantId', '==', plantId))
        : equipRef;
      const snapshot = await getDocs(equipmentQuery);
      let list = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Equipment));
      list = list.filter(item => item.status !== 'deleted');
      if (plantId) {
        list = list.filter(item => item.plantId === plantId);
      }
      list.sort((a, b) => (a.inspectionOrder || 0) - (b.inspectionOrder || 0));
      cacheEquipment(list);
      return list;
    } catch (err) {
      if (!auth.currentUser) return cached;
      handleFirestoreError(err, 'list', this.COLLECTION_NAME);
      return [];
    }
  }

  public static async saveEquipment(equipment: Equipment): Promise<{ queued: boolean; error?: string }> {
    try {
      const cached = getCachedEquipment();
      const existingIdx = cached.findIndex(e => e.id === equipment.id);
      if (existingIdx >= 0) {
        cached[existingIdx] = equipment;
      } else {
        cached.push(equipment);
      }
      cacheEquipment(cached);

      return await offlineQueueService.enqueue(this.COLLECTION_NAME, equipment.id, equipment, 'create');
    } catch (err) {
      if (!auth.currentUser) {
        return { queued: true };
      }
      handleFirestoreError(err, 'create', `${this.COLLECTION_NAME}/${equipment.id}`);
      return { queued: false, error: String(err) };
    }
  }

  public static async createEquipment(equipment: Equipment): Promise<void> {
    try {
      await setDoc(doc(db, this.COLLECTION_NAME, equipment.id), equipment);
    } catch (err) {
      handleFirestoreError(err, 'create', `${this.COLLECTION_NAME}/${equipment.id}`);
    }
  }

  public static async updateEquipment(equipmentId: string, updates: Partial<Equipment>): Promise<void> {
    try {
      await updateDoc(doc(db, this.COLLECTION_NAME, equipmentId), updates);
    } catch (err) {
      handleFirestoreError(err, 'update', `${this.COLLECTION_NAME}/${equipmentId}`);
    }
  }

  public static async softDeleteEquipment(equipmentId: string): Promise<void> {
    try {
      await updateDoc(doc(db, this.COLLECTION_NAME, equipmentId), { status: 'deleted' });
    } catch (err) {
      handleFirestoreError(err, 'update', `${this.COLLECTION_NAME}/${equipmentId}`);
    }
  }

  public static async deleteEquipment(equipmentId: string): Promise<{ queued: boolean; error?: string }> {
    try {
      const cached = getCachedEquipment().filter(e => e.id !== equipmentId);
      cacheEquipment(cached);

      return await offlineQueueService.enqueue(this.COLLECTION_NAME, equipmentId, { status: 'deleted' }, 'merge');
    } catch (err) {
      if (!auth.currentUser) {
        return { queued: true };
      }
      handleFirestoreError(err, 'delete', `${this.COLLECTION_NAME}/${equipmentId}`);
      return { queued: false, error: String(err) };
    }
  }
}
