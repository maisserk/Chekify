/**
 * Chekify Enterprise Date & MTTR Utilities
 */

import { Finding } from '../types';

/**
 * Universally parses any date/timestamp representation (Firestore Timestamp,
 * plain JSON object with seconds/_seconds, ISO string, or Date instance) into a valid JS Date.
 */
export const parseAnyDate = (val: any): Date | null => {
  if (!val) return null;
  try {
    if (typeof val.toDate === 'function') return val.toDate();
    if (typeof val.toMillis === 'function') return new Date(val.toMillis());
    if (typeof val.seconds === 'number') return new Date(val.seconds * 1000 + (val.nanoseconds || 0) / 1000000);
    if (typeof val._seconds === 'number') return new Date(val._seconds * 1000 + (val._nanoseconds || 0) / 1000000);
    if (val instanceof Date) return isNaN(val.getTime()) ? null : val;
    const parsed = new Date(val);
    return isNaN(parsed.getTime()) ? null : parsed;
  } catch {
    return null;
  }
};

/**
 * Extracts a valid Date object from a finding's creation date field.
 */
export const getFindingDate = (f: Finding | null): Date | null => {
  if (!f) return null;
  return parseAnyDate(f.date) || parseAnyDate(f.createdAt);
};

/**
 * Extracts a valid Date object from a finding's resolution (closedAt) date field.
 */
export const getFindingClosedDate = (f: Finding | null): Date | null => {
  if (!f || !f.closedAt) return null;
  return parseAnyDate(f.closedAt);
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
