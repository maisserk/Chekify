import { Area, Equipment } from '../types';

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
