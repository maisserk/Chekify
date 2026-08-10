/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Chekify Enterprise Industrial SaaS Framework
 * Module: EquipmentService
 * 
 * High-performance, isolated domain service for Equipment management.
 * Integrates our offline queuing adapter, ensures correct types, and
 * enforces plant scoping for multi-tenant isolation.
 */

import { db, handleFirestoreError } from '../firebase';
import { 
  collection, 
  doc, 
  getDocs, 
  query, 
  where, 
  orderBy, 
  onSnapshot 
} from 'firebase/firestore';
import { Equipment } from '../types';
import { offlineQueueService } from './OfflineQueueService';

export class EquipmentService {
  private static readonly COLLECTION_NAME = 'equipment';

  /**
   * Fetches equipment lists scoped by plantId to prevent unauthorized read leaks.
   * Leverages Firestore cache-first policies when applicable.
   */
  public static async fetchEquipment(plantId?: string): Promise<Equipment[]> {
    try {
      const equipRef = collection(db, this.COLLECTION_NAME);
      const snapshot = await getDocs(equipRef);
      let list = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Equipment));
      
      // Filter out deleted items and apply plant filter client-side
      list = list.filter(item => item.status !== 'deleted');
      if (plantId) {
        list = list.filter(item => item.plantId === plantId);
      }
      return list;
    } catch (err) {
      handleFirestoreError(err, 'list', this.COLLECTION_NAME);
    }
  }

  /**
   * Establishes a real-time reactive socket subscription with auto plant filter scoping.
   */
  public static subscribeToEquipment(
    callback: (equipment: Equipment[]) => void,
    plantId?: string
  ): () => void {
    const equipRef = collection(db, this.COLLECTION_NAME);

    return onSnapshot(
      equipRef,
      (snapshot) => {
        let list = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Equipment));
        
        // Filter out deleted and apply plant filter client-side
        list = list.filter(item => item.status !== 'deleted');
        if (plantId) {
          list = list.filter(item => item.plantId === plantId);
        }

        // Sort items by inspectionOrder on client or memory
        list.sort((a, b) => (a.inspectionOrder || 0) - (b.inspectionOrder || 0));
        callback(list);
      },
      (error) => {
        handleFirestoreError(error, 'list', this.COLLECTION_NAME);
      }
    );
  }

  /**
   * Saves or registers an equipment record.
   * Directs the transaction through the Offline Queue system for reliability of terrenos.
   */
  public static async saveEquipment(equipment: Equipment): Promise<{ queued: boolean }> {
    try {
      // Validate mandatory fields before queue entry
      if (!equipment.name || !equipment.plantId || !equipment.areaId) {
        throw new Error('Name, plantId, and areaId are mandatory fields.');
      }

      const cleanPayload: Partial<Equipment> = {
        name: equipment.name,
        tag: equipment.tag || '',
        plantId: equipment.plantId,
        areaId: equipment.areaId,
        inspectionOrder: Number(equipment.inspectionOrder) || 0,
        checkItems: equipment.checkItems || [],
        inspeccionVOSO: equipment.inspeccionVOSO,
        status: equipment.status || 'active',
        qrCode: equipment.qrCode || `EQ-${equipment.id.toUpperCase()}`
      };

      // Push document write action to the offline-enabled queue adapter
      const result = await offlineQueueService.enqueue(
        this.COLLECTION_NAME,
        equipment.id,
        cleanPayload,
        'create'
      );

      return { queued: result.queued };
    } catch (err: any) {
      throw new Error(`Failed to save equipment: ${err.message}`);
    }
  }

  /**
   * Marks an equipment item as deleted.
   * Performs soft deletion to prevent accidental operational data loss and broken foreign relations.
   */
  public static async deleteEquipment(id: string): Promise<{ queued: boolean }> {
    try {
      const result = await offlineQueueService.enqueue(
        this.COLLECTION_NAME,
        id,
        { status: 'deleted' },
        'delete'
      );
      return { queued: result.queued };
    } catch (err: any) {
      throw new Error(`Failed to delete equipment: ${err.message}`);
    }
  }
}
