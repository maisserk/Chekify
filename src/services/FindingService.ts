/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Chekify Enterprise Industrial SaaS Framework
 * Service: FindingService
 * 
 * High-reliability domain service for Finding management.
 * Controls compressions, robust Firebase Storage uploads, plant scoping, and offline syncing.
 */

import { db, storage, handleFirestoreError } from '../firebase';
import { 
  collection, 
  doc, 
  addDoc,
  setDoc,
  getDocs, 
  query, 
  where, 
  onSnapshot,
  Timestamp,
  serverTimestamp,
  arrayUnion
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { Finding, HistoryEntry } from '../types';
import { offlineQueueService } from './OfflineQueueService';
import { offlineMediaService } from './OfflineMediaService';
import { compressImage, blobToBase64 } from '../utils/imageCompressor';
import { PushNotificationService } from './PushNotificationService';

export class FindingService {
  private static readonly COLLECTION_NAME = 'findings';

  /**
   * Subscribes to real-time findings with multi-tenant plant scoping.
   */
  public static subscribeToFindings(
    callback: (findings: Finding[]) => void,
    plantId?: string
  ): () => void {
    const findingsRef = collection(db, this.COLLECTION_NAME);
    let q = query(findingsRef);

    if (plantId) {
      q = query(findingsRef, where('plantId', '==', plantId));
    }

    return onSnapshot(
      q,
      (snapshot) => {
        const list = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Finding));
        // Sort chronologically in memory (fail-safe for local serverTimestamp delay)
        list.sort((a, b) => {
          const tA = a.createdAt?.seconds || a.createdAt?.toMillis?.() || Date.now();
          const tB = b.createdAt?.seconds || b.createdAt?.toMillis?.() || Date.now();
          return tB - tA; // Newest first
        });
        callback(list);
      },
      (error) => {
        handleFirestoreError(error, 'list', this.COLLECTION_NAME);
      }
    );
  }

  /**
   * Uploads an image to Firebase Storage and returns the public download URL.
   */
  public static async uploadFindingPhoto(findingId: string, imageBlob: Blob): Promise<string> {
    try {
      const fileRef = ref(storage, `findings/${findingId}/photo_${Date.now()}.jpg`);
      const snapshot = await uploadBytes(fileRef, imageBlob, {
        contentType: 'image/jpeg',
        customMetadata: {
          app: 'Chekify Enterprise',
          findingId: findingId,
        }
      });
      return await getDownloadURL(snapshot.ref);
    } catch (err) {
      console.error('[FindingService] Storage upload failed:', err);
      throw err;
    }
  }

  /**
   * Saves or enqueues a new Finding, compressing images automatically to prevent Firestore bloat.
   */
  public static async createFinding(
    findingData: Partial<Finding>,
    photoFileOrBase64?: File | string | null
  ): Promise<{ queued: boolean; id: string; photoUrl?: string }> {
    const findingId = doc(collection(db, this.COLLECTION_NAME)).id;
    const isOnline = offlineQueueService.getConnectivityStatus();

    let imageUrl = findingData.photoUrl || '';
    let hasLocalPhoto = false;

    // 1. Process client side compression only if it is a File or a base64 data-URL
    let compressedBlob: Blob | null = null;
    const shouldCompress = photoFileOrBase64 && 
      (photoFileOrBase64 instanceof File || 
       (typeof photoFileOrBase64 === 'string' && photoFileOrBase64.startsWith('data:')));

    if (shouldCompress) {
      try {
        compressedBlob = await compressImage(photoFileOrBase64 as any, 1024, 768, 0.75);
      } catch (err) {
        console.warn('[FindingService] Fine-grained compression warning, using fallback source:', err);
      }
    }

    let base64Photo: string | null = null;
    if (compressedBlob) {
      try {
        base64Photo = await blobToBase64(compressedBlob);
      } catch (err) {
        console.warn('[FindingService] Failed to convert compressed blob to base64:', err);
      }
    }

    // 2. Upload online or Cache offline
    if (isOnline && compressedBlob) {
      try {
        imageUrl = await this.uploadFindingPhoto(findingId, compressedBlob);
      } catch (err) {
        console.warn('[FindingService] Failed uploading online. Falling back to Base64 fallback.');
        imageUrl = base64Photo || '';
        hasLocalPhoto = true;
      }
    } else if (compressedBlob) {
      imageUrl = base64Photo || '';
      hasLocalPhoto = true;
    }

    if (hasLocalPhoto && compressedBlob) {
      // Store raw compressed binary inside IndexedDB safely representing offline cache
      const mediaId = `media_fnd_${findingId}`;
      try {
        await offlineMediaService.storeMedia(mediaId, compressedBlob);
      } catch (err) {
        console.warn('[FindingService] Failed to store media in IndexedDB:', err);
      }
    }

    // Prepare robust transaction schema and sanitize to avoid undefined fields
    const rawPayload: Partial<Finding> = {
      ...findingData,
      id: findingId,
      photoUrl: imageUrl || (hasLocalPhoto ? `offline-cached://media_fnd_${findingId}` : ''),
      createdAt: isOnline ? serverTimestamp() : new Date(),
    };

    const payload: any = {};
    for (const [key, value] of Object.entries(rawPayload)) {
      if (value !== undefined) {
        payload[key] = value;
      }
    }

    // If we're online and image went through normal upload, write directly
    if (isOnline && !hasLocalPhoto) {
      try {
        await setDoc(doc(db, this.COLLECTION_NAME, findingId), payload);
        // Trigger push notification to supervisors/admins if finding is critical
        PushNotificationService.broadcastCriticalAlert(payload, payload.areaName || 'Área general', payload.equipmentName || 'Equipo', payload.inspector);
        return { queued: false, id: findingId, photoUrl: imageUrl };
      } catch (err) {
        console.warn('[FindingService] Direct online save failed. Queuing for offline sync.');
      }
    }

    // Write metadata to Queue
    const result = await offlineQueueService.enqueue(
      this.COLLECTION_NAME,
      findingId,
      payload,
      'create'
    );

    // Let the offlineQueueService background controller know that if we reconnect or sync, 
    // we should process and upload the offline-cached photo
    if (hasLocalPhoto) {
      this.schedulePhotoBackgroundSync(findingId);
    }

    // Trigger push notification even if queued (will broadcast to connected supervisors immediately if online)
    if (isOnline) {
      PushNotificationService.broadcastCriticalAlert(payload, payload.areaName || 'Área general', payload.equipmentName || 'Equipo', payload.inspector);
    }

    return { queued: true, id: findingId, photoUrl: imageUrl };
  }

  /**
   * Monitor for reconnect to safely trigger offline-cached media processing.
   */
  private static schedulePhotoBackgroundSync(findingId: string) {
    const checkAndSync = async () => {
      const isOnline = offlineQueueService.getConnectivityStatus();
      if (!isOnline) return;

      const mediaId = `media_fnd_${findingId}`;
      const cachedBlob = await offlineMediaService.retrieveMedia(mediaId);

      if (cachedBlob && cachedBlob instanceof Blob) {
        try {
          console.log(`[FindingService] Background syncing offline image for Finding: ${findingId}`);
          const onlineUrl = await this.uploadFindingPhoto(findingId, cachedBlob);
          
          // Send merge patch to write queue/database
          await offlineQueueService.enqueue(
            this.COLLECTION_NAME,
            findingId,
            { photoUrl: onlineUrl },
            'merge'
          );

          // Clear Cached DB binary footprint
          await offlineMediaService.deleteMedia(mediaId);
          console.log(`[FindingService] Background image sync completed for: ${findingId}`);

          // Remove subscription listener
          unsubscribe();
        } catch (err) {
          console.warn(`[FindingService] Failed to background-upload offline image to Storage for Finding ${findingId}. Falling back to Base64 in Firestore.`, err);
          try {
            const base64 = await blobToBase64(cachedBlob);
            await offlineQueueService.enqueue(
              this.COLLECTION_NAME,
              findingId,
              { photoUrl: base64 },
              'merge'
            );
            await offlineMediaService.deleteMedia(mediaId);
            unsubscribe();
          } catch (fallbackErr) {
            console.error(`[FindingService] Critical failure in Base64 sync fallback for Finding ${findingId}`, fallbackErr);
          }
        }
      } else {
        // No cached image found, cleanup subscription
        unsubscribe();
      }
    };

    const unsubscribe = offlineQueueService.subscribeToNetwork((online) => {
      if (online) {
        checkAndSync();
      }
    });
  }

  /**
   * Updates state transition history for a Finding, enforcing traceability.
   */
  public static async transitionStatus(
    findingId: string,
    newStatus: Finding['status'],
    user: { uid: string; name: string },
    comment?: string
  ): Promise<{ queued: boolean }> {
    try {
      const updateData: any = {
        status: newStatus,
        updatedAt: serverTimestamp()
      };

      if (newStatus === 'Closed') {
        updateData.closedBy = user.uid;
        updateData.closedAt = serverTimestamp();
        if (comment) {
          updateData.solution = comment;
        }
      }

      // Read current document state or prepare the transition append
      const historyEntry: HistoryEntry = {
        status: newStatus,
        userName: user.name || 'Supervisor',
        userId: user.uid,
        timestamp: new Date().toISOString(),
        action: `Cambio de estado a ${newStatus}`,
        comment: comment || `Estado cambiado a ${newStatus}.`
      } as any;

      // Queue an atomic merge operation for consistency
      const result = await offlineQueueService.enqueue(
        this.COLLECTION_NAME,
        findingId,
        {
          ...updateData,
          history: arrayUnion(historyEntry)
        },
        'merge'
      );

      // We also update history safely
      return { queued: result.queued };
    } catch (err: any) {
      throw new Error(`Failed to update finding status: ${err.message}`);
    }
  }
}
