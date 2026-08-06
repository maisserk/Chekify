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
import { removeEmojisBracketsAndParens } from '../utils/textSanitizer';
import { 
  collection, 
  doc, 
  getDoc,
  addDoc,
  setDoc,
  deleteDoc,
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
import { compressImage, blobToBase64, base64ToBlob } from '../utils/imageCompressor';
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
  public static async uploadFindingPhoto(findingId: string, imageBlob: Blob, photoIndex: number = 0): Promise<string> {
    try {
      const fileRef = ref(storage, `findings/${findingId}/photo_idx_${photoIndex}_${Date.now()}.jpg`);
      const snapshot = await uploadBytes(fileRef, imageBlob, {
        contentType: 'image/jpeg',
        customMetadata: {
          app: 'Chekify Enterprise',
          findingId: findingId,
          photoIndex: String(photoIndex),
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
   * Preserves exact photo index references when creating offline records.
   */
  public static async createFinding(
    findingData: Partial<Finding>,
    photoFileOrBase64?: File | string | null
  ): Promise<{ queued: boolean; id: string; photoUrl?: string }> {
    // 0. MANDATORY PHOTO CHECK: Reject finding creation if no photo is provided
    const hasPhotoProvided = !!photoFileOrBase64 || 
      (typeof findingData.photoUrl === 'string' && findingData.photoUrl.trim().length > 0) || 
      (Array.isArray(findingData.photoUrls) && findingData.photoUrls.some(p => typeof p === 'string' && p.trim().length > 0));

    if (!hasPhotoProvided) {
      throw new Error("No se puede reportar un hallazgo sin adjuntar al menos una foto evidencia.");
    }

    const findingId = doc(collection(db, this.COLLECTION_NAME)).id;
    const isOnline = offlineQueueService.getConnectivityStatus();

    let inputPhotoUrls: (File | string)[] = [];
    if (Array.isArray(findingData.photoUrls) && findingData.photoUrls.length > 0) {
      inputPhotoUrls = [...findingData.photoUrls];
    } else if (findingData.photoUrl) {
      inputPhotoUrls = [findingData.photoUrl];
    }

    if (photoFileOrBase64) {
      if (inputPhotoUrls.length > 0) {
        inputPhotoUrls[0] = photoFileOrBase64;
      } else {
        inputPhotoUrls = [photoFileOrBase64];
      }
    }

    const processedPhotoUrls: string[] = [];
    let hasLocalPhotos = false;
    const offlinePhotoIndices: number[] = [];

    for (let idx = 0; idx < inputPhotoUrls.length; idx++) {
      const pItem = inputPhotoUrls[idx];
      if (!pItem) continue;

      const shouldCompress = (pItem instanceof File) || (typeof pItem === 'string' && pItem.startsWith('data:'));

      let compressedBlob: Blob | null = null;
      if (shouldCompress) {
        try {
          compressedBlob = await compressImage(pItem as any, 1024, 768, 0.75);
        } catch (err) {
          console.warn(`[FindingService] Image compression warning for index ${idx}:`, err);
        }
      }

      let base64Photo: string | null = null;
      if (compressedBlob) {
        try {
          base64Photo = await blobToBase64(compressedBlob);
        } catch (err) {
          console.warn(`[FindingService] Base64 conversion warning for index ${idx}:`, err);
        }
      }

      let finalUrl = '';
      let isLocal = false;

      if (isOnline && compressedBlob) {
        try {
          finalUrl = await this.uploadFindingPhoto(findingId, compressedBlob, idx);
        } catch (err) {
          console.warn(`[FindingService] Online upload failed for photo index ${idx}. Falling back to offline cache.`);
          finalUrl = base64Photo || (typeof pItem === 'string' ? pItem : '');
          isLocal = true;
        }
      } else if (compressedBlob) {
        finalUrl = base64Photo || (typeof pItem === 'string' ? pItem : '');
        isLocal = true;
      } else if (typeof pItem === 'string') {
        finalUrl = pItem;
        if (pItem.startsWith('data:') || pItem.startsWith('offline-cached://')) {
          isLocal = true;
        }
      }

      if (isLocal && (compressedBlob || base64Photo || (typeof pItem === 'string' && pItem.startsWith('data:')))) {
        hasLocalPhotos = true;
        offlinePhotoIndices.push(idx);
        const mediaId = `media_fnd_${findingId}_idx_${idx}`;
        const dataToSave = compressedBlob || base64Photo || pItem;
        try {
          await offlineMediaService.storeMedia(mediaId, dataToSave as any);
          if (idx === 0) {
            await offlineMediaService.storeMedia(`media_fnd_${findingId}`, dataToSave as any);
          }
        } catch (err) {
          console.warn(`[FindingService] Failed storing offline media for index ${idx}:`, err);
        }
        finalUrl = `offline-cached://${mediaId}`;
      }

      processedPhotoUrls.push(finalUrl);
    }

    // Prepare robust transaction schema and sanitize to avoid undefined fields
    const cleanDescription = findingData.description ? removeEmojisBracketsAndParens(findingData.description) : '';
    const mainPhotoUrl = processedPhotoUrls[0] || '';

    const rawPayload: Partial<Finding> = {
      ...findingData,
      description: cleanDescription || findingData.description || '',
      id: findingId,
      photoUrl: mainPhotoUrl,
      photoUrls: processedPhotoUrls,
      createdAt: isOnline ? serverTimestamp() : new Date(),
    };

    const payload: any = {};
    for (const [key, value] of Object.entries(rawPayload)) {
      if (value !== undefined) {
        payload[key] = value;
      }
    }

    // If we're online and no images failed upload, write directly
    if (isOnline && !hasLocalPhotos) {
      try {
        await setDoc(doc(db, this.COLLECTION_NAME, findingId), payload);
        PushNotificationService.broadcastCriticalAlert(payload, payload.areaName || 'Área general', payload.equipmentName || 'Equipo', payload.inspector);
        return { queued: false, id: findingId, photoUrl: mainPhotoUrl };
      } catch (err) {
        console.warn('[FindingService] Direct online save failed. Queuing for offline sync.');
      }
    }

    // Write metadata to Queue
    await offlineQueueService.enqueue(
      this.COLLECTION_NAME,
      findingId,
      payload,
      'create'
    );

    // Schedule background sync for each offline photo retaining its exact index position
    if (hasLocalPhotos) {
      offlinePhotoIndices.forEach(photoIndex => {
        this.schedulePhotoBackgroundSync(findingId, photoIndex);
      });
    }

    if (isOnline) {
      PushNotificationService.broadcastCriticalAlert(payload, payload.areaName || 'Área general', payload.equipmentName || 'Equipo', payload.inspector);
    }

    return { queued: true, id: findingId, photoUrl: mainPhotoUrl };
  }

  /**
   * Monitor for reconnect to safely trigger offline-cached media processing,
   * accurately replacing the photo at photoIndex in photoUrls.
   */
  private static schedulePhotoBackgroundSync(findingId: string, photoIndex: number = 0) {
    const checkAndSync = async () => {
      const isOnline = offlineQueueService.getConnectivityStatus();
      if (!isOnline) return;

      const mediaIdWithIndex = `media_fnd_${findingId}_idx_${photoIndex}`;
      const fallbackMediaId = `media_fnd_${findingId}`;
      
      let cachedData = await offlineMediaService.retrieveMedia(mediaIdWithIndex);
      if (!cachedData && photoIndex === 0) {
        cachedData = await offlineMediaService.retrieveMedia(fallbackMediaId);
      }

      if (cachedData) {
        try {
          console.log(`[FindingService] Background syncing offline image for Finding ${findingId} at photoIndex ${photoIndex}...`);
          
          let blobToUpload: Blob;
          if (cachedData instanceof Blob) {
            blobToUpload = cachedData;
          } else if (typeof cachedData === 'string' && cachedData.startsWith('data:')) {
            blobToUpload = base64ToBlob(cachedData);
          } else {
            blobToUpload = new Blob([cachedData], { type: 'image/jpeg' });
          }

          const onlineUrl = await this.uploadFindingPhoto(findingId, blobToUpload, photoIndex);

          // Get document to preserve existing photoUrls array structure
          const docRef = doc(db, this.COLLECTION_NAME, findingId);
          let currentPhotoUrls: string[] = [];
          try {
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
              currentPhotoUrls = Array.isArray(docSnap.data().photoUrls) ? [...docSnap.data().photoUrls] : [];
            }
          } catch (e) {
            console.warn(`[FindingService] Document fetch warning for sync at index ${photoIndex}:`, e);
          }

          // Replace placeholder at exact photoIndex
          if (currentPhotoUrls.length <= photoIndex) {
            while (currentPhotoUrls.length <= photoIndex) {
              currentPhotoUrls.push('');
            }
          }
          currentPhotoUrls[photoIndex] = onlineUrl;

          const updatePayload: any = {
            photoUrls: currentPhotoUrls,
            updatedAt: serverTimestamp()
          };

          if (photoIndex === 0 || !currentPhotoUrls[0] || currentPhotoUrls[0].startsWith('offline-cached://') || currentPhotoUrls[0].startsWith('data:')) {
            updatePayload.photoUrl = onlineUrl;
          }

          // Enqueue merge patch to sync to Firestore
          await offlineQueueService.enqueue(
            this.COLLECTION_NAME,
            findingId,
            updatePayload,
            'merge'
          );

          // Clear Cached DB binary footprint for this index
          await offlineMediaService.deleteMedia(mediaIdWithIndex);
          if (photoIndex === 0) {
            await offlineMediaService.deleteMedia(fallbackMediaId);
          }

          console.log(`[FindingService] Background image sync completed for Finding ${findingId} at photoIndex ${photoIndex}`);
          unsubscribe();
        } catch (err) {
          console.warn(`[FindingService] Failed background image sync for Finding ${findingId} at photoIndex ${photoIndex}:`, err);
        }
      } else {
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
   * Supports custom resolution timestamp (customClosedAt) for retroactive closing and MTTR accuracy.
   */
  public static async transitionStatus(
    findingId: string,
    newStatus: Finding['status'],
    user: { uid: string; name: string },
    comment?: string,
    customClosedAt?: Date | string | null
  ): Promise<{ queued: boolean }> {
    try {
      const updateData: any = {
        status: newStatus,
        updatedAt: serverTimestamp()
      };

      if (newStatus === 'Closed') {
        updateData.closedBy = user.uid;
        if (customClosedAt) {
          const dateObj = typeof customClosedAt === 'string' ? new Date(customClosedAt) : customClosedAt;
          updateData.closedAt = Timestamp.fromDate(dateObj);
        } else {
          updateData.closedAt = serverTimestamp();
        }
        if (comment !== undefined) {
          updateData.solution = comment;
        }
      }

      // Read current document state or prepare the transition append
      const historyEntry: HistoryEntry = {
        status: newStatus,
        userName: user.name || 'Supervisor',
        userId: user.uid,
        timestamp: new Date().toISOString(),
        action: newStatus === 'Closed' && customClosedAt ? `Cierre de hallazgo (Fecha de solución: ${new Date(customClosedAt).toLocaleString('es-CL')})` : `Cambio de estado a ${newStatus}`,
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

  /**
   * Updates solution details or resolution timestamp on an existing closed finding.
   */
  public static async updateFindingClosure(
    findingId: string,
    user: { uid: string; name: string },
    solution?: string,
    customClosedAt?: Date | string | null
  ): Promise<{ queued: boolean }> {
    try {
      const updateData: any = {
        updatedAt: serverTimestamp()
      };

      if (solution !== undefined) {
        updateData.solution = solution;
      }

      if (customClosedAt) {
        const dateObj = typeof customClosedAt === 'string' ? new Date(customClosedAt) : customClosedAt;
        updateData.closedAt = Timestamp.fromDate(dateObj);
      }

      const historyEntry: HistoryEntry = {
        status: 'Closed',
        userName: user.name || 'Supervisor',
        userId: user.uid,
        timestamp: new Date().toISOString(),
        action: 'Ajuste de fecha de solución (MTTR)',
        comment: `Fecha de solución modificada a ${customClosedAt ? new Date(customClosedAt).toLocaleString('es-CL') : 'Fecha actual'}.`
      } as any;

      const result = await offlineQueueService.enqueue(
        this.COLLECTION_NAME,
        findingId,
        {
          ...updateData,
          history: arrayUnion(historyEntry)
        },
        'merge'
      );

      return { queued: result.queued };
    } catch (err: any) {
      throw new Error(`Failed to update finding closure: ${err.message}`);
    }
  }

  /**
   * Deletes a finding safely (supports offline queueing and direct Firestore deletion).
   */
  public static async deleteFinding(findingId: string): Promise<void> {
    const isOnline = offlineQueueService.getConnectivityStatus();
    if (isOnline) {
      try {
        await deleteDoc(doc(db, this.COLLECTION_NAME, findingId));
        return;
      } catch (err) {
        console.warn('[FindingService] Direct delete failed. Enqueuing offline delete operation.');
      }
    }
    await offlineQueueService.enqueue(this.COLLECTION_NAME, findingId, {}, 'delete');
  }

  /**
   * Attaches photo evidence to an existing finding that lacked photos.
   * Preserves exact photo index position when offline.
   */
  public static async attachPhotoToFinding(
    findingId: string,
    photoFileOrBase64: File | string,
    user: { uid: string; name: string },
    targetPhotoIndex?: number
  ): Promise<{ photoUrl: string }> {
    const isOnline = offlineQueueService.getConnectivityStatus();
    let compressedBlob: Blob | null = null;
    try {
      compressedBlob = await compressImage(photoFileOrBase64 as any, 1024, 768, 0.75);
    } catch (err) {
      console.warn('[FindingService] Image compression warning:', err);
    }

    let photoIndex = targetPhotoIndex ?? 0;
    if (targetPhotoIndex === undefined) {
      try {
        const docSnap = await getDoc(doc(db, this.COLLECTION_NAME, findingId));
        if (docSnap.exists() && Array.isArray(docSnap.data().photoUrls)) {
          photoIndex = docSnap.data().photoUrls.length;
        }
      } catch (e) {
        console.warn('[FindingService] Could not determine photo array length:', e);
      }
    }

    let photoUrl = '';
    let isOfflineLocal = false;
    let base64Photo = '';

    if (compressedBlob) {
      try {
        base64Photo = await blobToBase64(compressedBlob);
      } catch (e) {
        console.warn('[FindingService] Base64 conversion failed:', e);
      }
    }

    if (isOnline && compressedBlob) {
      try {
        photoUrl = await this.uploadFindingPhoto(findingId, compressedBlob, photoIndex);
      } catch (err) {
        console.warn(`[FindingService] Online attach photo failed for finding ${findingId}. Caching offline.`);
        photoUrl = base64Photo || (typeof photoFileOrBase64 === 'string' ? photoFileOrBase64 : '');
        isOfflineLocal = true;
      }
    } else if (compressedBlob) {
      photoUrl = base64Photo;
      isOfflineLocal = true;
    } else if (typeof photoFileOrBase64 === 'string') {
      photoUrl = photoFileOrBase64;
      if (photoUrl.startsWith('data:') || photoUrl.startsWith('offline-cached://')) {
        isOfflineLocal = true;
      }
    }

    if (!photoUrl) {
      throw new Error("No se pudo procesar la imagen.");
    }

    if (isOfflineLocal) {
      const mediaId = `media_fnd_${findingId}_idx_${photoIndex}`;
      const dataToSave = compressedBlob || base64Photo || photoFileOrBase64;
      try {
        await offlineMediaService.storeMedia(mediaId, dataToSave as any);
        if (photoIndex === 0) {
          await offlineMediaService.storeMedia(`media_fnd_${findingId}`, dataToSave as any);
        }
      } catch (e) {
        console.warn('[FindingService] IndexedDB store failed during attachPhotoToFinding:', e);
      }
      photoUrl = `offline-cached://${mediaId}`;
    }

    await offlineQueueService.enqueue(
      this.COLLECTION_NAME,
      findingId,
      {
        photoUrl: photoIndex === 0 ? photoUrl : undefined,
        photoUrls: arrayUnion(photoUrl),
        updatedAt: isOnline ? serverTimestamp() : new Date()
      },
      'merge'
    );

    if (isOfflineLocal) {
      this.schedulePhotoBackgroundSync(findingId, photoIndex);
    }

    return { photoUrl };
  }

  /**
   * Scans Firestore findings to remove duplicate documents and redundant photo URLs.
   */
  public static async cleanupDuplicates(plantId?: string): Promise<{ deletedFindingsCount: number; cleanedPhotosCount: number }> {
    try {
      const findingsRef = collection(db, this.COLLECTION_NAME);
      let q = query(findingsRef);
      if (plantId) {
        q = query(findingsRef, where('plantId', '==', plantId));
      }

      const snapshot = await getDocs(q);
      const allFindings = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Finding));

      let deletedFindingsCount = 0;
      let cleanedPhotosCount = 0;

      // 1. Deduplicate photoUrls inside individual findings
      for (const f of allFindings) {
        if (Array.isArray(f.photoUrls) && f.photoUrls.length > 1) {
          const uniquePhotos = Array.from(new Set(f.photoUrls.filter(p => typeof p === 'string' && p.trim().length > 0)));
          if (uniquePhotos.length < f.photoUrls.length) {
            cleanedPhotosCount += (f.photoUrls.length - uniquePhotos.length);
            await setDoc(doc(db, this.COLLECTION_NAME, f.id), {
              photoUrls: uniquePhotos,
              photoUrl: uniquePhotos[0] || f.photoUrl || ''
            }, { merge: true });
          }
        }
      }

      // 2. Identify duplicate findings by similarity (same equipment/area + description + photo within 30 min window)
      const kept = new Map<string, Finding>();
      const toDelete: string[] = [];

      // Sort by creation date ascending (keep oldest)
      const sorted = [...allFindings].sort((a, b) => {
        const tA = a.createdAt?.seconds || (a.createdAt instanceof Date ? a.createdAt.getTime() / 1000 : 0);
        const tB = b.createdAt?.seconds || (b.createdAt instanceof Date ? b.createdAt.getTime() / 1000 : 0);
        return tA - tB;
      });

      for (const finding of sorted) {
        const normDesc = (finding.description || '').toLowerCase().trim();
        const normEquip = (finding.equipmentId || finding.areaName || '').toLowerCase().trim();
        const primaryPhoto = (finding.photoUrls && finding.photoUrls[0]) || finding.photoUrl || '';
        const timeSec = finding.createdAt?.seconds || 0;

        let isDuplicate = false;
        let originalFinding: Finding | null = null;

        for (const [_, existing] of kept) {
          const exDesc = (existing.description || '').toLowerCase().trim();
          const exEquip = (existing.equipmentId || existing.areaName || '').toLowerCase().trim();
          const exPhoto = (existing.photoUrls && existing.photoUrls[0]) || existing.photoUrl || '';
          const exTimeSec = existing.createdAt?.seconds || 0;

          const samePhoto = primaryPhoto && exPhoto && primaryPhoto === exPhoto;
          const sameDescAndEquip = normEquip === exEquip && normDesc === exDesc && Math.abs(timeSec - exTimeSec) < 1800;

          if (samePhoto || sameDescAndEquip) {
            isDuplicate = true;
            originalFinding = existing;
            break;
          }
        }

        if (isDuplicate && originalFinding) {
          toDelete.push(finding.id);
          if (Array.isArray(finding.photoUrls) && finding.photoUrls.length > 0) {
            const existingPhotos = Array.isArray(originalFinding.photoUrls) ? originalFinding.photoUrls : [originalFinding.photoUrl].filter(Boolean);
            const combinedPhotos = Array.from(new Set([...existingPhotos, ...finding.photoUrls]));
            if (combinedPhotos.length > existingPhotos.length) {
              originalFinding.photoUrls = combinedPhotos as string[];
              await setDoc(doc(db, this.COLLECTION_NAME, originalFinding.id), {
                photoUrls: combinedPhotos
              }, { merge: true });
            }
          }
        } else {
          kept.set(finding.id, finding);
        }
      }

      // 3. Delete duplicates from Firestore
      for (const dupId of toDelete) {
        try {
          await deleteDoc(doc(db, this.COLLECTION_NAME, dupId));
          deletedFindingsCount++;
        } catch (err) {
          console.error(`Failed to delete duplicate finding ${dupId}:`, err);
        }
      }

      return { deletedFindingsCount, cleanedPhotosCount };
    } catch (err: any) {
      console.error('[FindingService] Failed cleanup of duplicates:', err);
      throw err;
    }
  }
}
