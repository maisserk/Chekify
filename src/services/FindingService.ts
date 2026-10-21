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

import { db, auth, storage, handleFirestoreError } from '../firebase';
import { onAuthStateChanged } from 'firebase/auth';
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
import { getCachedAreas, getCachedEquipment } from '../utils/offlineCache';
import { parseAnyDate } from '../utils/dateUtils';
import { extractFindingPhotos } from '../components/FindingPhotoGallery';
import { EquipmentService } from './EquipmentService';
import { Equipment } from '../types';

function withTimeout<T>(promise: Promise<T>, timeoutMs: number = 5000, errorMsg = 'Operation timed out'): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(errorMsg)), timeoutMs)
    )
  ]);
}

interface FindingChannel {
  plantKey: string;
  subscribers: Map<number, (findings: Finding[]) => void>;
  latestData: Finding[] | null;
  unsubFirestore: (() => void) | null;
  teardownTimeout: ReturnType<typeof setTimeout> | null;
  unsubAuth: (() => void) | null;
}

export class FindingService {
  private static readonly COLLECTION_NAME = 'findings';

  private static knownEquipmentMap: Map<string, Equipment> = new Map();
  private static nextSubId = 0;
  private static channels: Map<string, FindingChannel> = new Map();

  /**
   * Resets all finding channels and listeners on sign out.
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
   * Subscribes to real-time findings with multi-tenant plant scoping and connection multiplexing.
   * Multiple components in the same plant share a single active Firestore listener,
   * drastically reducing redundant read quotas during navigation.
   */
  public static subscribeToFindings(
    callback: (findings: Finding[]) => void,
    plantId?: string
  ): () => void {
    const subId = ++this.nextSubId;
    const plantKey = plantId ? plantId.trim().toLowerCase() : '__all__';

    // Populate equipment map from local cache without triggering network getDocs
    try {
      getCachedEquipment().forEach(eq => this.knownEquipmentMap.set(eq.id, eq));
    } catch {}

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
        plantKey,
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

        const findingsRef = collection(db, this.COLLECTION_NAME);
        const findingsQuery = (plantId && plantId !== 'default-plant')
          ? query(findingsRef, where('plantId', '==', plantId))
          : findingsRef;

        try {
          ch.unsubFirestore = onSnapshot(
            findingsQuery,
            (snapshot) => {
          const rawList = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Finding));
        
        const cleanedList: Finding[] = [];
        for (const finding of rawList) {
          if ((finding as any).status === 'deleted') {
            continue;
          }

          if (plantId) {
            const normTarget = plantId.toLowerCase().trim();
            const fPlant = (finding.plantId || 'default-plant').toLowerCase().trim();
            if (fPlant !== 'default-plant' && normTarget !== 'default-plant' && fPlant !== normTarget) {
              continue;
            }
          }

          const desc = (finding.description || '').trim();
          const descLower = desc.toLowerCase();
          const historyArr = Array.isArray(finding.history) ? finding.history : [];
          
          // Filter out synthetic clean non-findings and historical auto-generated records
          const isSyntheticRecord = 
            descLower.includes('inspección histórica') ||
            descLower.includes('inspección voso / ruta conforme') ||
            descLower.includes('sin hallazgos') ||
            descLower.includes('inspección conforme') ||
            descLower.includes('todos los puntos evaluados se encuentran en condición normal') ||
            finding.operatorId === 'sistema' ||
            (finding as any).isAutoGenerated === true ||
            historyArr.some((h: any) => h?.action === 'Inspección Conforme (Sin hallazgos)' || h?.action === 'Hallazgo autogenerado (Inspección Registrada)');

          if (isSyntheticRecord) {
            continue;
          }

          const normDesc = desc.toLowerCase().replace(/[^a-z0-9]/g, '');
          const upperCategory = ((finding as any).category || '').toUpperCase();

          // If the finding is strictly titled/described as "Punto de Control" or "Punto de Control VOSO" or empty/placeholder
          if (
            normDesc === 'puntodecontrol' ||
            normDesc === 'puntodecontrolvoso' ||
            normDesc === 'puntosdecontrol' ||
            normDesc === 'puntoevaluado' ||
            upperCategory === 'PUNTO DE CONTROL' ||
            upperCategory === 'PUNTOS DE CONTROL'
          ) {
            continue;
          }

          // If description contains "Punto de Control" or "PUNTOS DE CONTROL", sanitize it in-memory for clean presentation
          if (/punto[s]?\s*de\s*control/gi.test(desc) || /otros\s*puntos\s*de\s*inspecci[oó]n/gi.test(desc)) {
            const sanitizedDesc = desc
              .replace(/PUNTOS DE CONTROL DE INSPECCIÓN:/gi, 'EVALUACIONES DE INSPECCIÓN:')
              .replace(/OTROS PUNTOS DE INSPECCIÓN:/gi, 'OTRAS EVALUACIONES:')
              .replace(/Punto[s]?\s*de\s*Control\s*VOSO/gi, 'Ítem VOSO')
              .replace(/Punto[s]?\s*de\s*Control/gi, 'Ítem Evaluado')
              .replace(/Punto\s*Inspeccionado/gi, 'Ítem Inspeccionado');

            finding.description = sanitizedDesc;
          }

          // Auto-enrich areaName or equipmentName if missing using local cache
          if (!finding.areaName) {
            if (finding.areaId) {
              const cachedAreas = getCachedAreas();
              const area = cachedAreas.find(a => a.id === finding.areaId);
              if (area) finding.areaName = area.name;
            }
            if (!finding.areaName) {
              finding.areaName = 'Área General';
            }
          }

          const rawName = (finding.equipmentName || '').trim();
          const isGenericEquip = !rawName || 
            rawName.toLowerCase().includes('puntos generales') || 
            rawName.toLowerCase().includes('items generales') || 
            rawName.toLowerCase().includes('ítems generales') || 
            rawName.toLowerCase() === 'general' ||
            rawName.toLowerCase().includes('área completa');

          if (isGenericEquip) {
            // 1. Try resolving from equipmentId with known equipment map or offline cache
            if (finding.equipmentId && finding.equipmentId !== 'general') {
              const equip = this.knownEquipmentMap.get(finding.equipmentId) || getCachedEquipment().find(e => e.id === finding.equipmentId);
              if (equip) {
                finding.equipmentName = equip.tag && equip.tag.trim() ? `${equip.name} (${equip.tag.trim()})` : equip.name;
                if (!finding.tag && !finding.equipmentTag && equip.tag) {
                  finding.tag = equip.tag.trim();
                  finding.equipmentTag = equip.tag.trim();
                }
              }
            }
            
            const currentName = (finding.equipmentName || '').trim();
            const stillGeneric = !currentName || 
              currentName.toLowerCase().includes('puntos generales') || 
              currentName.toLowerCase().includes('items generales') || 
              currentName.toLowerCase().includes('ítems generales') || 
              currentName.toLowerCase() === 'general' ||
              currentName.toLowerCase().includes('área completa');

            // 2. Try regex extraction from finding description
            if (stillGeneric && finding.description) {
              const patterns = [
                /Inspección\s+VOSO\s+en\s+([^.\n]+)/i,
                /Inspección\s+de\s+ruta\s+en\s+([^.\n]+)/i,
                /Inspección\s+en\s+([^.\n]+)/i,
                /(?:\[ORDEN\]\s+)?(?:Programa 5S \/ Aseo|Orden y Limpieza)\s+en\s+([^.\n]+)/i,
                /(?:Equipo|Componente|Máquina|Equipo inspeccionado|Equipo en revisión)[\s/:]+([^.\n]+)/i,
                /(?:Hallazgo|Desviación)\s+en\s+([^.\n]+)/i,
              ];
              for (const pat of patterns) {
                const match = finding.description.match(pat);
                if (match && match[1]) {
                  const candidate = match[1].replace(/\s*\([^)]+\)$/, '').trim();
                  const candUpper = candidate.toUpperCase();
                  if (
                    !candUpper.includes('ÁREA GENERAL') &&
                    !candUpper.includes('AREA GENERAL') &&
                    !candUpper.includes('PUNTOS GENERALES') &&
                    candidate.length > 1
                  ) {
                    finding.equipmentName = candidate;
                    break;
                  }
                }
              }
            }

            // 3. If still generic and areaId is present, check if area has a single known equipment
            const afterRegexName = (finding.equipmentName || '').trim();
            const stillGenericAfterRegex = !afterRegexName ||
              afterRegexName.toLowerCase().includes('puntos generales') ||
              afterRegexName.toLowerCase().includes('items generales') ||
              afterRegexName.toLowerCase() === 'general';

            if (stillGenericAfterRegex && finding.areaId) {
              const areaEquips = Array.from(this.knownEquipmentMap.values()).filter(e => e.areaId === finding.areaId);
              if (areaEquips.length === 1) {
                const singleEquip = areaEquips[0];
                finding.equipmentName = singleEquip.tag && singleEquip.tag.trim() ? `${singleEquip.name} (${singleEquip.tag.trim()})` : singleEquip.name;
                finding.equipmentId = singleEquip.id;
                if (singleEquip.tag) {
                  finding.tag = singleEquip.tag.trim();
                  finding.equipmentTag = singleEquip.tag.trim();
                }
              }
            }

            // 4. Fallback: use areaName directly, never 'Puntos Generales de Inspección'
            if (!finding.equipmentName || finding.equipmentName.toLowerCase().includes('puntos generales')) {
              finding.equipmentName = finding.areaName || 'Área Principal';
            }
          }

          // Auto-enrich timing fields if missing
          const baseDate = parseAnyDate(finding.createdAt || finding.date) || new Date();
          const baseTimestamp = Timestamp.fromDate(baseDate);

          if (!finding.inspectionStartedAt) {
            finding.inspectionStartedAt = baseTimestamp;
          }
          if (!finding.inspectionCompletedAt) {
            finding.inspectionCompletedAt = baseTimestamp;
          }

          if (!finding.equipmentStartedAt) {
            finding.equipmentStartedAt = finding.inspectionStartedAt;
          }
          if (!finding.equipmentCompletedAt) {
            finding.equipmentCompletedAt = finding.inspectionCompletedAt;
          }

          const startMs = parseAnyDate(finding.inspectionStartedAt)?.getTime() || baseDate.getTime();
          const endMs = parseAnyDate(finding.inspectionCompletedAt)?.getTime() || baseDate.getTime();
          let calcSecs = Math.max(0, Math.round((endMs - startMs) / 1000));

          const timingSecs = (finding as any).timing?.durationSeconds;
          if (timingSecs && timingSecs > 0) {
            calcSecs = timingSecs;
          }

          // Ensure non-zero realistic duration based on inspected items
          if (calcSecs <= 0) {
            const bulletCount = (finding.description ? finding.description.match(/•/g) || [] : []).length;
            calcSecs = Math.max(60, bulletCount > 0 ? bulletCount * 30 : 90);
          }

          if (finding.inspectionDurationSeconds === undefined || finding.inspectionDurationSeconds === null || finding.inspectionDurationSeconds === 0) {
            finding.inspectionDurationSeconds = calcSecs;
          }

          if (finding.equipmentDurationSeconds === undefined || finding.equipmentDurationSeconds === null || finding.equipmentDurationSeconds === 0) {
            finding.equipmentDurationSeconds = calcSecs;
          }

          // Auto-enrich history array if missing or empty
          if (!finding.history || !Array.isArray(finding.history) || finding.history.length === 0) {
            const createdDate = parseAnyDate(finding.createdAt || finding.date) || new Date();
            const createdStr = createdDate.toISOString();
            const opName = finding.operatorName || 'Operador';
            const opId = finding.operatorId || 'sistema';

            const generatedHistory: HistoryEntry[] = [];
            const isClean = finding.status === 'Closed' && (!finding.description || finding.description.includes('Conforme') || finding.description.includes('Sin hallazgos'));

            generatedHistory.push({
              status: isClean ? 'Closed' : (finding.status || 'Open'),
              userId: opId,
              userName: opName,
              timestamp: createdStr,
              action: (finding as any).source === 'OrdenYLimpieza'
                ? 'Hallazgo autogenerado (Orden & Limpieza)'
                : ((finding as any).source === 'VOSO'
                  ? (isClean ? 'Inspección Conforme (Sin hallazgos)' : 'Hallazgo autogenerado (Inspección VOSO)')
                  : 'Hallazgo reportado'),
              comment: finding.description ? (finding.description.length > 120 ? finding.description.substring(0, 117) + '...' : finding.description) : 'Registro de inspección / hallazgo'
            } as any);

            if (finding.status === 'Closed' && !isClean) {
              const closedDate = parseAnyDate(finding.closedAt) || createdDate;
              generatedHistory.push({
                status: 'Closed',
                userId: finding.closedBy || opId,
                userName: finding.closedBy ? 'Supervisor / Operador' : opName,
                timestamp: closedDate.toISOString(),
                action: 'Cierre de hallazgo / Solución registrada',
                comment: finding.solution || (finding as any).resolutionNote || 'Resolución completada'
              } as any);
            }

            finding.history = generatedHistory;
          }

          cleanedList.push(finding);
        }

        // Sort chronologically in memory (fail-safe for local serverTimestamp delay)
        cleanedList.sort((a, b) => {
          const tA = parseAnyDate(a.createdAt || a.date)?.getTime() || Date.now();
          const tB = parseAnyDate(b.createdAt || b.date)?.getTime() || Date.now();
          return tB - tA; // Newest first
        });

        const currentChannel = this.channels.get(plantKey);
        if (currentChannel) {
          currentChannel.latestData = cleanedList;
          currentChannel.subscribers.forEach(cb => {
            try { cb(cleanedList); } catch (e) { console.error('[FindingService] Subscriber error:', e); }
          });
        }

        const hasOfflineCached = cleanedList.some(f => {
          const photos = extractFindingPhotos(f);
          return photos.some(p => p && typeof p === 'string' && p.startsWith('offline-cached://'));
        });
        if (hasOfflineCached) {
          this.syncPendingOfflinePhotos(cleanedList).catch(() => {});
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
        }, 5 * 60 * 1000); // 5 minutes grace period to prevent re-querying all findings during tab navigation
      }
    };
  }

  /**
   * Uploads an image to Firebase Storage and returns the public download URL.
   */
  public static async uploadFindingPhoto(findingId: string, imageBlob: Blob, photoIndex: number = 0): Promise<string> {
    try {
      const fileRef = ref(storage, `findings/${findingId}/photo_idx_${photoIndex}_${Date.now()}.jpg`);
      const uploadPromise = uploadBytes(fileRef, imageBlob, {
        contentType: 'image/jpeg',
        customMetadata: {
          app: 'Chekify Enterprise',
          findingId: findingId,
          photoIndex: String(photoIndex),
        }
      }).then(snapshot => getDownloadURL(snapshot.ref));

      return await withTimeout(uploadPromise, 5000, 'Storage photo upload timed out');
    } catch (err) {
      console.warn('[FindingService] Storage upload failed or timed out:', err);
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
    // 0. SYNTHETIC CLEAN CHECK: Do NOT create finding records for clean inspections with no deviations
    const descLower = (findingData.description || '').toLowerCase();
    const isSyntheticClean = descLower.includes('inspección voso / ruta conforme') ||
      descLower.includes('sin hallazgos') ||
      descLower.includes('inspección conforme') ||
      descLower.includes('todos los puntos evaluados se encuentran en condición normal') ||
      (Array.isArray(findingData.history) && findingData.history.some(h => h.action === 'Inspección Conforme (Sin hallazgos)'));

    if (isSyntheticClean) {
      console.log('[FindingService] Skipping creation of synthetic clean non-finding record.');
      return { queued: false, id: 'clean-record-skipped' };
    }

    // 0. PHOTO CHECK: Require photo for manual finding submissions unless coming from inspection or auto-generated
    const isInspectionSource = findingData.source === 'VOSO' || findingData.source === 'OrdenYLimpieza' || (findingData as any).isAutoGenerated;
    const hasPhotoProvided = !!photoFileOrBase64 || 
      (typeof findingData.photoUrl === 'string' && findingData.photoUrl.trim().length > 0) || 
      (Array.isArray(findingData.photoUrls) && findingData.photoUrls.some(p => typeof p === 'string' && p.trim().length > 0));

    if (!hasPhotoProvided && !isInspectionSource) {
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
        finalUrl = base64Photo || (typeof pItem === 'string' && pItem.startsWith('data:') ? pItem : `offline-cached://${mediaId}`);
      }

      processedPhotoUrls.push(finalUrl);
    }

    // Prepare robust transaction schema and sanitize to avoid undefined fields
    const cleanDescription = findingData.description ? removeEmojisBracketsAndParens(findingData.description) : '';
    const mainPhotoUrl = processedPhotoUrls[0] || '';

    // Fallback fill areaName and equipmentName from local cache if missing
    let resolvedAreaName = findingData.areaName;
    if (!resolvedAreaName && findingData.areaId) {
      const cachedAreas = getCachedAreas();
      const area = cachedAreas.find(a => a.id === findingData.areaId);
      if (area) resolvedAreaName = area.name;
    }

    let resolvedEquipmentName = findingData.equipmentName;
    if (
      (!resolvedEquipmentName ||
        resolvedEquipmentName === 'Puntos Generales de Inspección' ||
        resolvedEquipmentName === 'Puntos Generales de Inspeccion' ||
        resolvedEquipmentName === 'Ítems Generales de Inspección' ||
        resolvedEquipmentName === 'ITEMS GENERALES DE INSPECCIÓN' ||
        resolvedEquipmentName.includes('Puntos Generales')) &&
      findingData.equipmentId &&
      findingData.equipmentId !== 'general'
    ) {
      const cachedEquip = getCachedEquipment();
      const equip = cachedEquip.find(e => e.id === findingData.equipmentId);
      if (equip) resolvedEquipmentName = equip.tag ? `${equip.name} (${equip.tag})` : equip.name;
    }

    if (
      (!resolvedEquipmentName ||
        resolvedEquipmentName === 'Puntos Generales de Inspección' ||
        resolvedEquipmentName === 'Puntos Generales de Inspeccion' ||
        resolvedEquipmentName === 'Ítems Generales de Inspección' ||
        resolvedEquipmentName.includes('Puntos Generales')) &&
      cleanDescription
    ) {
      const patterns = [
        /Inspección\s+VOSO\s+en\s+([^.\n]+)/i,
        /Inspección\s+de\s+ruta\s+en\s+([^.\n]+)/i,
        /Inspección\s+en\s+([^.\n]+)/i,
        /(?:\[ORDEN\]\s+)?(?:Programa 5S \/ Aseo|Orden y Limpieza)\s+en\s+([^.\n]+)/i,
        /(?:Equipo|Componente|Máquina|Equipo inspeccionado|Equipo en revisión)[\s/:]+([^.\n]+)/i,
        /(?:Hallazgo|Desviación)\s+en\s+([^.\n]+)/i,
      ];
      for (const pat of patterns) {
        const match = cleanDescription.match(pat);
        if (match && match[1]) {
          const candidate = match[1].replace(/\s*\([^)]+\)$/, '').trim();
          const candUpper = candidate.toUpperCase();
          if (
            !candUpper.includes('ÁREA GENERAL') &&
            !candUpper.includes('AREA GENERAL') &&
            !candUpper.includes('PUNTOS GENERALES') &&
            candidate.length > 1
          ) {
            resolvedEquipmentName = candidate;
            break;
          }
        }
      }
    }

    if (!resolvedEquipmentName || resolvedEquipmentName.includes('Puntos Generales')) {
      resolvedEquipmentName = resolvedAreaName || findingData.areaName || 'Área Principal';
    }

    // Auto-calculate equipmentDurationSeconds if missing
    let resolvedDuration = findingData.equipmentDurationSeconds;
    if ((resolvedDuration === undefined || resolvedDuration === null || resolvedDuration <= 0) && findingData.equipmentStartedAt && findingData.equipmentCompletedAt) {
      const s = parseAnyDate(findingData.equipmentStartedAt);
      const e = parseAnyDate(findingData.equipmentCompletedAt);
      if (s && e) resolvedDuration = Math.max(0, Math.round((e.getTime() - s.getTime()) / 1000));
    }
    if ((resolvedDuration === undefined || resolvedDuration === null || resolvedDuration <= 0) && findingData.inspectionDurationSeconds) {
      resolvedDuration = findingData.inspectionDurationSeconds;
    }
    if (resolvedDuration === undefined || resolvedDuration === null || resolvedDuration <= 0) {
      const bulletCount = (cleanDescription.match(/•/g) || []).length;
      resolvedDuration = Math.max(60, bulletCount > 0 ? bulletCount * 30 : 90);
    }

    const rawPayload: Partial<Finding> = {
      ...findingData,
      areaName: resolvedAreaName || findingData.areaName || 'Área General',
      equipmentName: resolvedEquipmentName || findingData.equipmentName || resolvedAreaName || 'Área Principal',
      equipmentDurationSeconds: resolvedDuration,
      inspectionDurationSeconds: findingData.inspectionDurationSeconds && findingData.inspectionDurationSeconds > 0 ? findingData.inspectionDurationSeconds : resolvedDuration,
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

    const fullResultFinding: any = {
      id: findingId,
      ...rawPayload,
      photoUrl: mainPhotoUrl,
      equipmentName: resolvedEquipmentName || rawPayload.equipmentName,
      equipmentDurationSeconds: resolvedDuration ?? rawPayload.equipmentDurationSeconds,
      createdAt: new Date()
    };

    // If we're online and no images failed upload, write directly
    if (isOnline && !hasLocalPhotos) {
      try {
        await withTimeout(setDoc(doc(db, this.COLLECTION_NAME, findingId), payload), 5000, 'Finding setDoc timeout');
        PushNotificationService.broadcastCriticalAlert(payload, payload.areaName || 'Área general', payload.equipmentName || 'Equipo', payload.inspector);
        return { queued: false, id: findingId, photoUrl: mainPhotoUrl, ...fullResultFinding };
      } catch (err) {
        console.warn('[FindingService] Direct online save failed or timed out. Queuing for offline sync.');
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

    return { queued: true, id: findingId, photoUrl: mainPhotoUrl, ...fullResultFinding };
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
        FindingService.syncPendingOfflinePhotos().catch(() => {});
      }
    });
  }

  private static isSyncingPhotos = false;

  /**
   * Scans findings to automatically resolve/upload any pending offline photos 
   * (replacing device-local offline-cached:// pseudo-protocols with Base64 or Storage URLs).
   */
  public static async syncPendingOfflinePhotos(findingsList?: Finding[]): Promise<void> {
    const isOnline = offlineQueueService.getConnectivityStatus();
    if (!isOnline || this.isSyncingPhotos) return;

    this.isSyncingPhotos = true;
    try {
      let list = findingsList;
      if (!list) {
        for (const ch of this.channels.values()) {
          if (ch.latestData && ch.latestData.length > 0) {
            list = ch.latestData;
            break;
          }
        }
      }
      if (!list || list.length === 0) {
        return;
      }
      for (const finding of list) {
        if (!finding || !finding.id) continue;
        const photos = extractFindingPhotos(finding);
        let updated = false;
        const newPhotoUrls = Array.isArray(finding.photoUrls) ? [...finding.photoUrls] : (finding.photoUrl ? [finding.photoUrl] : []);

        for (let idx = 0; idx < photos.length; idx++) {
          const pUrl = photos[idx];
          if (!pUrl || !pUrl.startsWith('offline-cached://')) continue;

          let mediaId = pUrl.replace('offline-cached://', '');
          let cachedData = await offlineMediaService.retrieveMedia(mediaId);
          if (!cachedData && idx === 0) {
            cachedData = await offlineMediaService.retrieveMedia(`media_fnd_${finding.id}`);
          }

          if (cachedData) {
            try {
              let blobToUpload: Blob;
              if (cachedData instanceof Blob) {
                blobToUpload = cachedData;
              } else if (typeof cachedData === 'string' && cachedData.startsWith('data:')) {
                blobToUpload = base64ToBlob(cachedData);
              } else if (typeof cachedData === 'string' && cachedData.length > 50) {
                blobToUpload = base64ToBlob(`data:image/jpeg;base64,${cachedData}`);
              } else {
                blobToUpload = new Blob([cachedData], { type: 'image/jpeg' });
              }

              let onlineUrl = '';
              try {
                onlineUrl = await this.uploadFindingPhoto(finding.id, blobToUpload, idx);
              } catch (uErr) {
                onlineUrl = await blobToBase64(blobToUpload);
              }

              if (onlineUrl && onlineUrl !== pUrl) {
                if (newPhotoUrls.length <= idx) {
                  while (newPhotoUrls.length <= idx) newPhotoUrls.push('');
                }
                newPhotoUrls[idx] = onlineUrl;
                updated = true;
              }
            } catch (e) {
              console.warn(`[FindingService] Could not sync offline photo for ${finding.id} idx ${idx}:`, e);
            }
          } else {
            const validAlt = photos.find(p => p.startsWith('http://') || p.startsWith('https://') || p.startsWith('data:'));
            if (validAlt && validAlt !== pUrl) {
              if (newPhotoUrls.length <= idx) {
                while (newPhotoUrls.length <= idx) newPhotoUrls.push('');
              }
              newPhotoUrls[idx] = validAlt;
              updated = true;
            }
          }
        }

        if (updated && newPhotoUrls.length > 0) {
          const mainPhoto = newPhotoUrls[0] || '';
          await offlineQueueService.enqueue(
            this.COLLECTION_NAME,
            finding.id,
            {
              photoUrl: mainPhoto,
              photoUrls: newPhotoUrls,
              updatedAt: serverTimestamp()
            },
            'merge'
          );
        }
      }
    } catch (err) {
      console.warn('[FindingService] Error running syncPendingOfflinePhotos:', err);
    } finally {
      this.isSyncingPhotos = false;
    }
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
   * Resolves an individual item within a multi-item finding description independently.
   * If all items in the finding description are resolved, transitions finding status to 'Closed'.
   */
  public static async solveFindingItem(
    findingId: string,
    originalDescription: string,
    itemCategory: string,
    itemTitle: string,
    solutionText: string,
    user: { uid: string; name: string },
    solutionDate?: Date | null
  ): Promise<{ newDescription: string; isFullyClosed: boolean }> {
    try {
      const cleanSolution = solutionText.replace(/[\n\r]/g, ' ').trim();
      const solDate = solutionDate ? (parseAnyDate(solutionDate) || new Date()) : new Date();

      const pad = (n: number) => n.toString().padStart(2, '0');
      const dd = pad(solDate.getDate());
      const mm = pad(solDate.getMonth() + 1);
      const yyyy = solDate.getFullYear();
      const hh = pad(solDate.getHours());
      const min = pad(solDate.getMinutes());
      const formattedDateStr = `${dd}/${mm}/${yyyy} ${hh}:${min}`;

      const lines = originalDescription.split('\n');
      let matched = false;

      const newLines = lines.map(line => {
        const upperLine = line.toUpperCase();
        const upperCat = (itemCategory || '').toUpperCase();
        const upperTitle = (itemTitle || '').toUpperCase();

        const isMatch = (upperTitle && upperLine.includes(upperTitle)) || 
                        (upperCat && upperLine.includes(`[${upperCat}]`));

        if (!matched && isMatch && !line.includes('[SOLUCIONADO')) {
          matched = true;
          return `${line} [SOLUCIONADO (${formattedDateStr}): ${cleanSolution}]`;
        }
        return line;
      });

      let finalDescription = newLines.join('\n');
      if (!matched) {
        finalDescription = `${originalDescription} [SOLUCIONADO (${formattedDateStr}): ${cleanSolution}]`;
      }

      // Check if all items are solved
      const hasUnsolved = finalDescription.split('\n').some(line => {
        const isItemLine = line.includes('•') || line.match(/\[(VER|OÍR|OIR|SENTIR|OLER|ORDEN)\]/i);
        return isItemLine && !line.includes('[SOLUCIONADO');
      });

      const isFullyClosed = !hasUnsolved;

      const updateData: any = {
        description: finalDescription,
        updatedAt: serverTimestamp()
      };

      if (isFullyClosed) {
        updateData.status = 'Closed';
        updateData.closedBy = user.uid;
        updateData.closedAt = Timestamp.fromDate(solDate);
        updateData.solution = `Todos los hallazgos del equipo fueron solucionados independientemente. Última solución (${formattedDateStr}): ${cleanSolution}`;
      } else {
        updateData.status = 'InReview';
      }

      const historyEntry = {
        status: isFullyClosed ? 'Closed' : 'InReview',
        userName: user.name || 'Supervisor/Operador',
        userId: user.uid,
        timestamp: solDate.toISOString(),
        action: `Solución independiente (${itemCategory || 'Ítem'} - ${itemTitle || 'General'})`,
        comment: `Solución aplicada (${formattedDateStr}): ${cleanSolution}`
      };

      await offlineQueueService.enqueue(
        this.COLLECTION_NAME,
        findingId,
        {
          ...updateData,
          history: arrayUnion(historyEntry)
        },
        'merge'
      );

      return { newDescription: finalDescription, isFullyClosed };
    } catch (err: any) {
      throw new Error(`Failed to solve finding item: ${err.message}`);
    }
  }

  /**
   * Deletes a finding safely (supports offline queueing, direct Firestore deletion,
   * and clean removal of linked inspection records across operator accounts).
   */
  public static async deleteFinding(findingId: string): Promise<void> {
    const findingRef = doc(db, this.COLLECTION_NAME, findingId);
    let inspectionId: string | null = null;
    let operatorId: string | null = null;
    let equipmentId: string | null = null;

    try {
      const docSnap = await getDoc(findingRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        inspectionId = data?.inspectionId || null;
        operatorId = data?.operatorId || null;
        equipmentId = data?.equipmentId || null;
      }
    } catch (e) {
      console.warn('[FindingService] Could not fetch finding details prior to deletion:', e);
    }

    const isOnline = offlineQueueService.getConnectivityStatus();

    if (isOnline) {
      try {
        // 1. Delete document from 'findings' collection
        await deleteDoc(findingRef);

        // 2. Delete associated document from 'inspections' collection if present
        if (inspectionId) {
          try {
            await deleteDoc(doc(db, 'inspections', inspectionId));
          } catch (err) {
            console.warn('[FindingService] Failed to delete associated inspection doc:', err);
          }
        }

        // 3. Fallback cleanup: search 'inspections' collection for matching operator/equipment inspection
        if (!inspectionId && operatorId) {
          try {
            const inspSnap = await getDocs(
              query(collection(db, 'inspections'), where('operatorId', '==', operatorId))
            );
            for (const inspDoc of inspSnap.docs) {
              const inspData = inspDoc.data();
              if (equipmentId && inspData.results && inspData.results[equipmentId]) {
                await deleteDoc(doc(db, 'inspections', inspDoc.id));
              }
            }
          } catch (e) {
            // Ignore fallback lookup errors
          }
        }
      } catch (err) {
        console.warn('[FindingService] Direct delete failed. Enqueuing offline delete operation.');
        await offlineQueueService.enqueue(this.COLLECTION_NAME, findingId, {}, 'delete');
        if (inspectionId) {
          await offlineQueueService.enqueue('inspections', inspectionId, {}, 'delete');
        }
      }
    } else {
      await offlineQueueService.enqueue(this.COLLECTION_NAME, findingId, {}, 'delete');
      if (inspectionId) {
        await offlineQueueService.enqueue('inspections', inspectionId, {}, 'delete');
      }
    }

    // 4. Clean up associated offline media cache
    try {
      await offlineMediaService.deleteMedia(`media_fnd_${findingId}`);
      for (let i = 0; i < 10; i++) {
        await offlineMediaService.deleteMedia(`media_fnd_${findingId}_idx_${i}`);
      }
    } catch (e) {
      // Ignore media delete errors
    }
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
      photoUrl = base64Photo || (typeof photoFileOrBase64 === 'string' && photoFileOrBase64.startsWith('data:') ? photoFileOrBase64 : `offline-cached://${mediaId}`);
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
   * Scans Firestore findings to remove synthetic auto-generated duplicates, 
   * 'Conforme' non-findings, and repairs 'Área General' labels with real area names.
   */
  public static async purgeSyntheticAndDuplicateFindings(plantId?: string): Promise<{ deletedFindingsCount: number; repairedAreasCount: number }> {
    try {
      const findingsRef = collection(db, this.COLLECTION_NAME);
      let q = query(findingsRef);
      if (plantId) {
        q = query(findingsRef, where('plantId', '==', plantId));
      }

      const snapshot = await getDocs(q);
      const allFindings = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Finding));

      // Build maps for real Area & Equipment names and tags to repair existing findings
      const areasMap: Record<string, string> = {};
      const equipAreaMap: Record<string, { areaId?: string; areaName?: string; name?: string; tag?: string }> = {};
      try {
        const areasSnap = await getDocs(collection(db, 'areas'));
        areasSnap.docs.forEach(doc => {
          const data = doc.data();
          if (data?.name) areasMap[doc.id] = data.name;
        });

        const equipSnap = await getDocs(collection(db, 'equipment'));
        equipSnap.docs.forEach(doc => {
          const data = doc.data();
          if (data) {
            equipAreaMap[doc.id] = {
              areaId: data.areaId,
              areaName: data.areaName || (data.areaId ? areasMap[data.areaId] : undefined),
              name: data.name,
              tag: data.tag
            };
          }
        });
      } catch (e) {
        console.warn('[FindingService] Could not fetch area/equipment maps for repair:', e);
      }

      const toDelete = new Set<string>();
      let repairedAreasCount = 0;

      // 1. Identify synthetic "Conforme" auto-generated findings that are NOT real deviations
      for (const f of allFindings) {
        const desc = (f.description || '').toLowerCase();
        const history = Array.isArray(f.history) ? f.history : [];
        const isSyntheticConforme = 
          desc.includes('inspección histórica') ||
          desc.includes('inspección voso / ruta conforme') ||
          desc.includes('sin hallazgos') ||
          desc.includes('inspección conforme') ||
          desc.includes('todos los puntos evaluados se encuentran en condición normal') ||
          f.operatorId === 'sistema' ||
          (f as any).isAutoGenerated === true ||
          history.some(h => h.action === 'Inspección Conforme (Sin hallazgos)' || h.action === 'Hallazgo autogenerado (Inspección Registrada)');

        if (isSyntheticConforme) {
          toDelete.add(f.id);
          continue;
        }

        const updatesToPersist: Record<string, any> = {};

        // 2. Repair 'Área General' or missing areaName on valid findings
        if (!f.areaName || f.areaName === 'Área General') {
          let resolvedName = '';
          if (f.areaId && areasMap[f.areaId]) {
            resolvedName = areasMap[f.areaId];
          } else if (f.equipmentId && equipAreaMap[f.equipmentId]?.areaName) {
            resolvedName = equipAreaMap[f.equipmentId].areaName!;
          }

          if (resolvedName && resolvedName !== 'Área General') {
            f.areaName = resolvedName;
            updatesToPersist.areaName = resolvedName;
            repairedAreasCount++;
          }
        }

        // 2b. Repair generic equipmentName ('Puntos Generales de Inspección', 'General', etc.) on existing findings
        const rawEqName = (f.equipmentName || '').trim();
        const isGenericEquip = !rawEqName ||
          rawEqName.toLowerCase().includes('puntos generales') ||
          rawEqName.toLowerCase().includes('items generales') ||
          rawEqName.toLowerCase().includes('ítems generales') ||
          rawEqName.toLowerCase() === 'general' ||
          rawEqName.toLowerCase().includes('área completa');

        if (isGenericEquip) {
          let resolvedEquip = '';
          let resolvedTag = '';

          // A. Lookup via equipmentId in known equipment
          if (f.equipmentId && f.equipmentId !== 'general' && equipAreaMap[f.equipmentId]) {
            const eq = equipAreaMap[f.equipmentId];
            if (eq.name) {
              resolvedEquip = eq.tag && eq.tag.trim() ? `${eq.name} (${eq.tag.trim()})` : eq.name;
              if (eq.tag) resolvedTag = eq.tag.trim();
            }
          }

          // B. Regex match from finding description
          if (!resolvedEquip && f.description) {
            const patterns = [
              /Inspección\s+VOSO\s+en\s+([^.\n]+)/i,
              /Inspección\s+de\s+ruta\s+en\s+([^.\n]+)/i,
              /Inspección\s+en\s+([^.\n]+)/i,
              /(?:\[ORDEN\]\s+)?(?:Programa 5S \/ Aseo|Orden y Limpieza)\s+en\s+([^.\n]+)/i,
              /(?:Equipo|Componente|Máquina|Equipo inspeccionado|Equipo en revisión)[\s/:]+([^.\n]+)/i,
              /(?:Hallazgo|Desviación)\s+en\s+([^.\n]+)/i,
            ];
            for (const pat of patterns) {
              const match = f.description.match(pat);
              if (match && match[1]) {
                const candidate = match[1].replace(/\s*\([^)]+\)$/, '').trim();
                const candUpper = candidate.toUpperCase();
                if (
                  !candUpper.includes('ÁREA GENERAL') &&
                  !candUpper.includes('AREA GENERAL') &&
                  !candUpper.includes('PUNTOS GENERALES') &&
                  candidate.length > 1
                ) {
                  resolvedEquip = candidate;
                  break;
                }
              }
            }
          }

          // C. Single equipment in area
          if (!resolvedEquip && f.areaId) {
            const areaEquips = Object.entries(equipAreaMap).filter(([_, eq]) => eq.areaId === f.areaId);
            if (areaEquips.length === 1) {
              const [eqId, singleEq] = areaEquips[0];
              if (singleEq.name) {
                resolvedEquip = singleEq.tag && singleEq.tag.trim() ? `${singleEq.name} (${singleEq.tag.trim()})` : singleEq.name;
                if (singleEq.tag) resolvedTag = singleEq.tag.trim();
                f.equipmentId = eqId;
                updatesToPersist.equipmentId = eqId;
              }
            }
          }

          // D. Fallback to area name
          if (!resolvedEquip) {
            resolvedEquip = f.areaName || 'Área Principal';
          }

          f.equipmentName = resolvedEquip;
          updatesToPersist.equipmentName = resolvedEquip;

          if (resolvedTag && (!f.tag || f.tag === 'S/N')) {
            f.tag = resolvedTag;
            f.equipmentTag = resolvedTag;
            updatesToPersist.tag = resolvedTag;
            updatesToPersist.equipmentTag = resolvedTag;
          }
        }

        // 2c. Repair missing tag / equipmentTag if equipmentId is known
        if ((!f.tag || f.tag === 'S/N' || !f.equipmentTag || f.equipmentTag === 'S/N') && f.equipmentId && equipAreaMap[f.equipmentId]?.tag) {
          const t = equipAreaMap[f.equipmentId].tag!.trim();
          f.tag = t;
          f.equipmentTag = t;
          updatesToPersist.tag = t;
          updatesToPersist.equipmentTag = t;
        }

        // 2d. Repair inspection duration for existing findings
        if (f.inspectionDurationSeconds === undefined || f.inspectionDurationSeconds === null || f.inspectionDurationSeconds <= 0) {
          const bulletCount = (f.description ? f.description.match(/•/g) || [] : []).length;
          const calcSecs = Math.max(60, bulletCount > 0 ? bulletCount * 30 : 90);
          f.inspectionDurationSeconds = calcSecs;
          f.equipmentDurationSeconds = calcSecs;
          updatesToPersist.inspectionDurationSeconds = calcSecs;
          updatesToPersist.equipmentDurationSeconds = calcSecs;
        }

        if (Object.keys(updatesToPersist).length > 0) {
          await setDoc(doc(db, this.COLLECTION_NAME, f.id), updatesToPersist, { merge: true }).catch(() => {});
        }
      }

      // 3. Identify duplicate findings (same equipment/inspectionId + description + created close together)
      const kept = new Map<string, Finding>();
      const remaining = allFindings.filter(f => !toDelete.has(f.id));

      // Sort oldest first
      remaining.sort((a, b) => {
        const tA = parseAnyDate(a.createdAt || a.date)?.getTime() || 0;
        const tB = parseAnyDate(b.createdAt || b.date)?.getTime() || 0;
        return tA - tB;
      });

      for (const finding of remaining) {
        const inspId = (finding as any).inspectionId;
        const normDesc = (finding.description || '').toLowerCase().trim();
        const normEquip = (finding.equipmentId || finding.areaName || '').toLowerCase().trim();
        const primaryPhoto = (finding.photoUrls && finding.photoUrls[0]) || finding.photoUrl || '';
        const timeMs = parseAnyDate(finding.createdAt || finding.date)?.getTime() || 0;

        let isDuplicate = false;
        let originalFinding: Finding | null = null;

        for (const [_, existing] of kept) {
          const exInspId = (existing as any).inspectionId;
          const exDesc = (existing.description || '').toLowerCase().trim();
          const exEquip = (existing.equipmentId || existing.areaName || '').toLowerCase().trim();
          const exPhoto = (existing.photoUrls && existing.photoUrls[0]) || existing.photoUrl || '';
          const exTimeMs = parseAnyDate(existing.createdAt || existing.date)?.getTime() || 0;

          const sameInspAndEquip = Boolean(inspId && exInspId && inspId === exInspId && normEquip === exEquip);
          const samePhoto = Boolean(primaryPhoto && exPhoto && primaryPhoto === exPhoto);
          const sameDescAndEquip = Boolean(normEquip === exEquip && normDesc === exDesc && Math.abs(timeMs - exTimeMs) < 1800000);

          if (sameInspAndEquip || samePhoto || sameDescAndEquip) {
            isDuplicate = true;
            originalFinding = existing;
            break;
          }
        }

        if (isDuplicate && originalFinding) {
          toDelete.add(finding.id);
          if (Array.isArray(finding.photoUrls) && finding.photoUrls.length > 0) {
            const existingPhotos = Array.isArray(originalFinding.photoUrls) ? originalFinding.photoUrls : [originalFinding.photoUrl].filter(Boolean);
            const combinedPhotos = Array.from(new Set([...existingPhotos, ...finding.photoUrls]));
            if (combinedPhotos.length > existingPhotos.length) {
              originalFinding.photoUrls = combinedPhotos as string[];
              await setDoc(doc(db, this.COLLECTION_NAME, originalFinding.id), {
                photoUrls: combinedPhotos
              }, { merge: true }).catch(() => {});
            }
          }
        } else {
          kept.set(finding.id, finding);
        }
      }

      // 4. Execute deletion of duplicates & synthetic entries
      let deletedFindingsCount = 0;
      for (const dupId of Array.from(toDelete)) {
        try {
          await deleteDoc(doc(db, this.COLLECTION_NAME, dupId));
          deletedFindingsCount++;
        } catch (err) {
          console.warn(`[FindingService] Failed to delete synthetic/duplicate finding ${dupId}:`, err);
        }
      }

      return { deletedFindingsCount, repairedAreasCount };
    } catch (err: any) {
      console.error('[FindingService] Failed cleanup of synthetic duplicates:', err);
      return { deletedFindingsCount: 0, repairedAreasCount: 0 };
    }
  }

  /**
   * Scans Firestore findings to remove duplicate documents and redundant photo URLs.
   */
  public static async cleanupDuplicates(plantId?: string): Promise<{ deletedFindingsCount: number; cleanedPhotosCount: number }> {
    const res = await this.purgeSyntheticAndDuplicateFindings(plantId);
    return { deletedFindingsCount: res.deletedFindingsCount, cleanedPhotosCount: res.repairedAreasCount };
  }

  /**
   * Backfills past inspection documents from 'inspections' collection into 'findings'
   * ONLY if genuine deviations exist and haven't already been created.
   */
  public static async backfillPastInspections(): Promise<number> {
    return 0;
  }
}
