/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Chekify Enterprise Industrial SaaS Framework
 * Module: OfflineQueueService
 * 
 * Provides robust transactional queueing for high-risk write operations
 * (such as marking findings, creating inspections, saving equipment)
 * in environments with low, intermittent, or non-existent connectivity.
 */

import { db, handleFirestoreError } from '../firebase';
import { doc, setDoc, writeBatch } from 'firebase/firestore';

export interface QueueItem {
  id: string;
  collection: string;
  docId: string;
  payload: any;
  timestamp: number;
  operation: 'create' | 'update' | 'delete' | 'merge';
  retryCount: number;
  state: 'pending' | 'syncing' | 'failed';
  error?: string;
}

type OnQueueChangeCallback = (items: QueueItem[]) => void;
type OnConnectivityChangeCallback = (online: boolean) => void;

class OfflineQueueService {
  private queue: QueueItem[] = [];
  private isSyncing = false;
  private changeListeners: Set<OnQueueChangeCallback> = new Set();
  private networkListeners: Set<OnConnectivityChangeCallback> = new Set();
  private checkInterval: NodeJS.Timeout | null = null;
  private isOnline = false;

  constructor() {
    this.isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
    this.loadQueueFromStorage();
    this.setupNetworkMonitoring();
  }

  /**
   * Loads the transaction queue from browser's local storage.
   */
  private loadQueueFromStorage(): void {
    try {
      const stored = localStorage.getItem('chekify_offline_write_queue');
      if (stored) {
        this.queue = JSON.parse(stored);
        // Reset any sticking 'syncing' state to 'pending' upon boot reload
        this.queue = this.queue.map(item => 
          item.state === 'syncing' ? { ...item, state: 'pending' } : item
        );
      }
    } catch (e) {
      console.error('[OfflineQueue] Failed to read queue from localStorage:', e);
      this.queue = [];
    }
  }

  /**
   * Persists the transaction queue back to local storage.
   */
  private saveQueueToStorage(): void {
    try {
      localStorage.setItem('chekify_offline_write_queue', JSON.stringify(this.queue));
      this.notifyQueueChange();
    } catch (e) {
      console.error('[OfflineQueue] Failed to write queue to localStorage:', e);
    }
  }

  /**
   * Actively monitors both navigator.onLine and validates actual internet/server reachability
   * using a periodic lightweight heartbeat ping.
   */
  private setupNetworkMonitoring(): void {
    if (typeof window === 'undefined') return;

    window.addEventListener('online', () => this.handleNetworkEvent(true));
    window.addEventListener('offline', () => this.handleNetworkEvent(false));

    // Periodic actual physical ping to prevent false-positives (such as captive industrial Wi-Fi portals)
    this.checkInterval = setInterval(async () => {
      await this.verifyActualHeartbeat();
    }, 15000); // Check every 15s

    // Run first verification
    this.verifyActualHeartbeat();
  }

  /**
   * Verifies actual internet access by executing a lightweight HEAD/GET request
   */
  private async verifyActualHeartbeat(): Promise<void> {
    if (!navigator.onLine) {
      this.handleNetworkEvent(false);
      return;
    }

    try {
      // Use a fast, cache-bypassing fetch to checking real connectivity
      const response = await fetch('https://www.google.com/favicon.ico', {
        method: 'HEAD',
        mode: 'no-cors',
        cache: 'no-store',
      });
      this.handleNetworkEvent(true);
    } catch (e) {
      // Failed fetch implies we are behind a portal or have no outgoing route
      this.handleNetworkEvent(false);
    }
  }

  private handleNetworkEvent(online: boolean): void {
    if (this.isOnline !== online) {
      this.isOnline = online;
      console.log(`[OfflineQueue] Connection state updated: ${online ? 'ONLINE' : 'OFFLINE'}`);
      this.notifyNetworkChange(online);
      if (online) {
        this.flushQueue();
      }
    }
  }

  /**
   * Enqueues a write transaction to write to Firestore.
   * If online, attempts instant execution. If offline (or if instant execution fails),
   * queues the item, returning optimistic success to the client UI.
   */
  public async enqueue(
    collection: string,
    docId: string,
    payload: any,
    operation: QueueItem['operation'] = 'create'
  ): Promise<{ queued: boolean; error?: string }> {
    const freshItem: QueueItem = {
      id: `${collection}_${docId}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      collection,
      docId,
      payload,
      timestamp: Date.now(),
      operation,
      retryCount: 0,
      state: 'pending',
    };

    // Remove any older duplicate operations for the exact same document to avoid redundant sync writes
    this.queue = this.queue.filter(
      item => !(item.collection === collection && item.docId === docId && item.state === 'pending')
    );

    this.queue.push(freshItem);
    this.saveQueueToStorage();

    if (this.isOnline && !this.isSyncing) {
      // Trigger instant flush non-blocking to improve operational latency
      this.flushQueue();
    }

    return { queued: !this.isOnline };
  }

  /**
   * Synchronizes queued items to Firestore. Processes items sequentially or in batches.
   */
  public async flushQueue(): Promise<void> {
    if (this.isSyncing || this.queue.length === 0 || !this.isOnline) return;

    this.isSyncing = true;
    console.log(`[OfflineQueue] Beginning synchronization of ${this.queue.length} items to Firestore...`);

    // We process items sequentially to ensure chronological order is respected
    const pendingItems = [...this.queue].filter(item => item.state !== 'syncing');

    for (const item of pendingItems) {
      if (!this.isOnline) break;

      item.state = 'syncing';
      this.notifyQueueChange();

      try {
        const docRef = doc(db, item.collection, item.docId);
        
        if (item.operation === 'delete') {
          await setDoc(docRef, { status: 'deleted' }, { merge: true });
        } else if (item.operation === 'merge') {
          await setDoc(docRef, item.payload, { merge: true });
        } else {
          // 'create' or 'update' writes complete payload
          await setDoc(docRef, item.payload);
        }

        // Execution success: remove item from memory & disk
        this.queue = this.queue.filter(i => i.id !== item.id);
        this.saveQueueToStorage();
        console.log(`[OfflineQueue] Successfully synced document: ${item.collection}/${item.docId}`);
      } catch (err: any) {
        item.retryCount += 1;
        item.error = err.message || String(err);
        
        if (item.retryCount >= 5) {
          item.state = 'failed';
          console.error(`[OfflineQueue] Critical failure syncing ${item.collection}/${item.docId} after 5 retries. Halting auto-retry for this record.`);
        } else {
          item.state = 'pending'; // Let it retry in the next cycle
        }
        
        this.saveQueueToStorage();
        
        // Let standard skill-compliant handler catch permissions errors or quotas
        try {
          handleFirestoreError(err, 'write', `${item.collection}/${item.docId}`);
        } catch (capturedErr) {
          console.error('[OfflineQueue] Handled firebase security/write error:', capturedErr);
        }

        // Halt syncing process for subsequent objects to maintain relational order
        break;
      }
    }

    this.isSyncing = false;
    this.notifyQueueChange();
    console.log('[OfflineQueue] Sync cycle completed.');
  }

  /**
   * Clears all failed transactions from the queue.
   */
  public clearFailed(): void {
    this.queue = this.queue.filter(i => i.state !== 'failed');
    this.saveQueueToStorage();
  }

  /**
   * Forces synchronization of all pending actions.
   */
  public forceSync(): void {
    this.flushQueue();
  }

  // --- Subscriptions and Hook Hooks ---

  public subscribeToQueue(cb: OnQueueChangeCallback): () => void {
    this.changeListeners.add(cb);
    cb([...this.queue]);
    return () => this.changeListeners.delete(cb);
  }

  public subscribeToNetwork(cb: OnConnectivityChangeCallback): () => void {
    this.networkListeners.add(cb);
    cb(this.isOnline);
    return () => this.networkListeners.delete(cb);
  }

  private notifyQueueChange(): void {
    const currentQueue = [...this.queue];
    this.changeListeners.forEach(cb => cb(currentQueue));
  }

  private notifyNetworkChange(online: boolean): void {
    this.networkListeners.forEach(cb => cb(online));
  }

  public getQueueLength(): number {
    return this.queue.length;
  }

  public getQueueItems(): QueueItem[] {
    return [...this.queue];
  }

  public getConnectivityStatus(): boolean {
    return this.isOnline;
  }
}

// Single instance shared across whole application to avoid multiple storage listeners and timer allocations
export const offlineQueueService = new OfflineQueueService();
