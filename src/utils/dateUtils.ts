/**
 * Chekify Enterprise Date & MTTR Utilities
 */

import { Finding } from '../types';

/**
 * Extracts a valid Date object from a finding's creation date field.
 */
export const getFindingDate = (f: Finding | null): Date | null => {
  if (!f) return null;
  const d = f.date || f.createdAt;
  if (!d) return null;
  try {
    if (typeof d.toDate === 'function') return d.toDate();
    if (typeof d.toMillis === 'function') return new Date(d.toMillis());
    if (d.seconds) return new Date(d.seconds * 1000);
    if (d instanceof Date) return isNaN(d.getTime()) ? null : d;
    const parsed = new Date(d);
    return isNaN(parsed.getTime()) ? null : parsed;
  } catch (err) {
    console.error("Error parsing created date:", err);
    return null;
  }
};

/**
 * Extracts a valid Date object from a finding's resolution (closedAt) date field.
 */
export const getFindingClosedDate = (f: Finding | null): Date | null => {
  if (!f || !f.closedAt) return null;
  const d = f.closedAt;
  try {
    if (typeof d.toDate === 'function') return d.toDate();
    if (typeof d.toMillis === 'function') return new Date(d.toMillis());
    if (d.seconds) return new Date(d.seconds * 1000);
    if (d instanceof Date) return isNaN(d.getTime()) ? null : d;
    const parsed = new Date(d);
    return isNaN(parsed.getTime()) ? null : parsed;
  } catch (err) {
    console.error("Error parsing closed date:", err);
    return null;
  }
};

/**
 * Formats a Date object into a 'YYYY-MM-DDTHH:mm' string suitable for <input type="datetime-local">.
 */
export const formatToDatetimeLocal = (dateVal?: Date | string | number | null): string => {
  if (!dateVal) return '';
  const target = dateVal instanceof Date ? dateVal : new Date(dateVal);
  if (isNaN(target.getTime())) return '';
  const pad = (n: number) => n.toString().padStart(2, '0');
  const yyyy = target.getFullYear();
  const MM = pad(target.getMonth() + 1);
  const dd = pad(target.getDate());
  const hh = pad(target.getHours());
  const mm = pad(target.getMinutes());
  return `${yyyy}-${MM}-${dd}T${hh}:${mm}`;
};

/**
 * Formats MTTR (Mean Time To Resolve) human-readable duration between created date and closed date.
 */
export const getCalculatedMTTRText = (createdDate?: Date | null, closedDateVal?: Date | string | null): string => {
  if (!createdDate || !closedDateVal) return '';
  const closedDate = closedDateVal instanceof Date ? closedDateVal : new Date(closedDateVal);
  if (isNaN(closedDate.getTime())) return '';
  const diffMs = closedDate.getTime() - createdDate.getTime();
  
  if (diffMs < 0) return '⚠️ La fecha de solución es anterior a la fecha de creación';
  
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = (diffMs / (1000 * 60 * 60)).toFixed(1);
  const diffDays = (diffMs / (1000 * 60 * 60 * 24)).toFixed(1);

  if (diffMinutes < 60) {
    return `${diffMinutes} min`;
  } else if (Number(diffHours) < 48) {
    return `${diffHours} horas`;
  } else {
    return `${diffDays} días (${diffHours} hrs)`;
  }
};
