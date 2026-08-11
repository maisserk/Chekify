/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Chekify Enterprise Industrial SaaS Framework
 * Service: OfflineMediaService
 * 
 * Provides fully isolated IndexedDB transactional storage for offline high-res
 * images. This bypasses the 5MB limits of localStorage and ensures the field operators
 * never lose inspection proof, even when operating entirely offline underground or in deep mines.
 */

const DB_NAME = 'chekify_offline_media';
const STORE_NAME = 'media_cache';
const DB_VERSION = 1;

class OfflineMediaService {
  private db: IDBDatabase | null = null;
  private initializingPromise: Promise<IDBDatabase> | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      this.initializingPromise = this.initDB();
    }
  }

  private initDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve(request.result);
      };

      request.onerror = () => {
        console.error('[OfflineMedia] IndexedDB failed to launch:', request.error);
        reject(request.error);
      };
    });
  }

  private async getDB(): Promise<IDBDatabase> {
    if (this.db) return this.db;
    if (this.initializingPromise) return this.initializingPromise;
    this.initializingPromise = this.initDB();
    return this.initializingPromise;
  }

  /**
   * Stores a compressed Blob or base64 string with a unique reference ID.
   */
  public async storeMedia(id: string, fileData: Blob | string): Promise<void> {
    try {
      const db = await this.getDB();
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.put(fileData, id);

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    } catch (e) {
      console.error('[OfflineMedia] Save failed:', e);
    }
  }

  /**
   * Retrieves offline cached media file.
   */
  public async retrieveMedia(id: string): Promise<Blob | string | null> {
    try {
      const db = await this.getDB();
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.get(id);

        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => reject(request.error);
      });
    } catch (e) {
      console.error('[OfflineMedia] Retrieval failed:', e);
      return null;
    }
  }

  /**
   * Removes all media files from IndexedDB cache.
   */
  public async clearAllMedia(): Promise<void> {
    try {
      const db = await this.getDB();
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.clear();

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    } catch (e) {
      console.error('[OfflineMedia] Clear all failed:', e);
    }
  }

  /**
   * Removes from local disk cache once successfully flushed to Firebase Storage.
   */
  public async deleteMedia(id: string): Promise<void> {
    try {
      const db = await this.getDB();
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.delete(id);

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    } catch (e) {
      console.error('[OfflineMedia] Delete failed:', e);
    }
  }
}

export const offlineMediaService = new OfflineMediaService();
