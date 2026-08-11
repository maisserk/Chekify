import { Area, Equipment } from '../types';
import { offlineMediaService } from '../services/OfflineMediaService';
import { offlineQueueService } from '../services/OfflineQueueService';

export const cacheAreas = (areas: Area[]): void => {
  if (!Array.isArray(areas) || areas.length === 0) return;
  try {
    localStorage.setItem('chekify_cached_areas', JSON.stringify(areas));
  } catch (err) {
    console.warn('[OfflineCache] Failed to cache areas:', err);
  }
};

export const getCachedAreas = (): Area[] => {
  try {
    const raw = localStorage.getItem('chekify_cached_areas');
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

export const cacheEquipment = (equipment: Equipment[]): void => {
  if (!Array.isArray(equipment) || equipment.length === 0) return;
  try {
    localStorage.setItem('chekify_cached_equipment', JSON.stringify(equipment));
  } catch (err) {
    console.warn('[OfflineCache] Failed to cache equipment:', err);
  }
};

export const getCachedEquipment = (): Equipment[] => {
  try {
    const raw = localStorage.getItem('chekify_cached_equipment');
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

export const clearAllCaches = async (): Promise<void> => {
  try {
    localStorage.clear();
    sessionStorage.clear();
    offlineQueueService.clearQueue();
    await offlineMediaService.clearAllMedia();

    if ('caches' in window) {
      const cacheNames = await caches.keys();
      await Promise.all(cacheNames.map(name => caches.delete(name)));
    }

    console.log('[OfflineCache] All browser caches successfully cleared.');
  } catch (err) {
    console.error('[OfflineCache] Failed clearing caches:', err);
  }
};

