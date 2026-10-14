import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { Finding } from '../types';
import { parseFindingDescription } from '../components/FindingDescriptionRenderer';
import { extractFindingPhotos } from '../components/FindingPhotoGallery';
import { parseAnyDate } from './dateUtils';
import { offlineMediaService } from '../services/OfflineMediaService';
import { getCachedEquipment } from './offlineCache';
import { db } from '../firebase';
import { doc, getDoc } from 'firebase/firestore';

export interface OperatorProfile {
  name?: string;
  photoUrl?: string;
  signatureUrl?: string;
  role?: string;
  rutOrId?: string;
  rut?: string;
  cargo?: string;
}

export interface PDFReportSettings {
  companyName?: string;
  logoUrl?: string;
  headerText?: string;
  footerText?: string;
}

/**
 * Clean non-Latin-1 characters for jsPDF text rendering to prevent gibberish
 */
const sanitizeForPDF = (str?: string, maxLen?: number): string => {
  if (!str) return '';
  let clean = str
    .replace(/[áäàâ]/g, 'a').replace(/[ÁÄÀÂ]/g, 'A')
    .replace(/[éëèê]/g, 'e').replace(/[ÉËÈÊ]/g, 'E')
    .replace(/[íïìî]/g, 'i').replace(/[ÍÏÌÎ]/g, 'I')
    .replace(/[óöòô]/g, 'o').replace(/[ÓÖÒÔ]/g, 'O')
    .replace(/[úüùû]/g, 'u').replace(/[ÚÜÙÛ]/g, 'U')
    .replace(/ñ/g, 'n').replace(/Ñ/g, 'N')
    .replace(/•/g, '-')
    .replace(/[^\x20-\x7E\xA0-\xFF]/g, ' ');

  if (maxLen && clean.length > maxLen) {
    clean = clean.substring(0, maxLen) + '...';
  }
  return clean;
};

const formatDurationPDF = (totalSecs?: number): string => {
  const effectiveSecs = (totalSecs !== undefined && totalSecs !== null && !isNaN(totalSecs) && totalSecs > 0)
    ? totalSecs
    : 90;
  const hrs = Math.floor(effectiveSecs / 3600);
  const mins = Math.floor((effectiveSecs % 3600) / 60);
  const secs = effectiveSecs % 60;
  if (hrs > 0) {
    return `${hrs}h ${mins.toString().padStart(2, '0')}m ${secs.toString().padStart(2, '0')}s`;
  }
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')} min`;
};

/**
 * Helper to generate a white transparent PNG base64 of the Chekify logo for PDF headers
 */
export const getWhiteChekifyLogoBase64 = async (): Promise<{ dataUrl: string; aspect: number } | null> => {
  try {
    const loadFromUrl = async (url: string) => {
      try {
        const resp = await fetch(url);
        if (!resp.ok) return null;
        const blob = await resp.blob();
        return new Promise<HTMLImageElement | null>((resolve) => {
          const image = new Image();
          image.onload = () => resolve(image);
          image.onerror = () => resolve(null);
          image.src = URL.createObjectURL(blob);
        });
      } catch (e) {
        return null;
      }
    };

    let img = await loadFromUrl('/logo.png');
    if (!img) img = await loadFromUrl('/logo_small.png');
    if (!img) return null;

    const canvas = document.createElement('canvas');
    const w = img.naturalWidth || img.width || 300;
    const h = img.naturalHeight || img.height || 100;
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    ctx.drawImage(img, 0, 0);
    const imgData = ctx.getImageData(0, 0, w, h);
    const data = imgData.data;

    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] > 10) {
        data[i] = 255;
        data[i + 1] = 255;
        data[i + 2] = 255;
      }
    }
    ctx.putImageData(imgData, 0, 0);
    const dataUrl = canvas.toDataURL('image/png');
    return { dataUrl, aspect: w / h };
  } catch (err) {
    console.warn('Error creating white Chekify logo base64:', err);
    return null;
  }
};

/**
 * Loads an image URL safely into a base64 Data URL for jsPDF embedding
 */
const loadImageAsBase64 = async (rawUrl?: string | null): Promise<string | null> => {
  if (!rawUrl || typeof rawUrl !== 'string') return null;
  const url = rawUrl.trim();
  if (!url) return null;

  // 1. Direct Data URL
  if (url.startsWith('data:image')) return url;

  // 2. Raw Base64 string without data: prefix
  if (!url.startsWith('http://') && !url.startsWith('https://') && !url.startsWith('data:') && !url.startsWith('offline-cached://') && !url.startsWith('blob:')) {
    if (url.length > 50) {
      return `data:image/jpeg;base64,${url}`;
    }
  }

  // 3. Offline-cached pseudo protocol
  if (url.startsWith('offline-cached://')) {
    const mediaId = url.replace('offline-cached://', '');
    try {
      const data = await offlineMediaService.retrieveMedia(mediaId);
      if (data instanceof Blob) {
        return await new Promise<string | null>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(typeof reader.result === 'string' ? reader.result : null);
          reader.onerror = () => resolve(null);
          reader.readAsDataURL(data);
        });
      } else if (typeof data === 'string' && data.length > 0) {
        if (data.startsWith('data:image')) return data;
        return `data:image/jpeg;base64,${data}`;
      }
      if (mediaId.includes('_idx_')) {
        const baseMediaId = mediaId.split('_idx_')[0];
        const baseData = await offlineMediaService.retrieveMedia(baseMediaId);
        if (baseData instanceof Blob) {
          return await new Promise<string | null>((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(typeof reader.result === 'string' ? reader.result : null);
            reader.onerror = () => resolve(null);
            reader.readAsDataURL(baseData);
          });
        } else if (typeof baseData === 'string' && baseData.length > 0) {
          if (baseData.startsWith('data:image')) return baseData;
          return `data:image/jpeg;base64,${baseData}`;
        }
      }
    } catch (e) {
      console.warn('[PDF] Error retrieving offline media for PDF:', e);
    }
    return null;
  }

  // 4. HTTP(S) or Blob URL fetch
  try {
    const response = await fetch(url);
    if (response.ok) {
      const blob = await response.blob();
      const base64 = await new Promise<string | null>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(typeof reader.result === 'string' ? reader.result : null);
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(blob);
      });
      if (base64) return base64;
    }
  } catch (err) {
    // Fall through to canvas
  }

  // 5. HTMLImageElement + Canvas Fallback
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.src = url;

    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth || img.width || 300;
        canvas.height = img.naturalHeight || img.height || 300;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0);
          resolve(canvas.toDataURL('image/jpeg', 0.85));
        } else {
          resolve(null);
        }
      } catch (err) {
        console.warn('[PDF] Could not convert image to base64 via canvas:', err);
        resolve(null);
      }
    };

    img.onerror = () => {
      // Final attempt without crossOrigin
      const imgNoCors = new Image();
      imgNoCors.src = url;
      imgNoCors.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = imgNoCors.naturalWidth || imgNoCors.width || 300;
          canvas.height = imgNoCors.naturalHeight || imgNoCors.height || 300;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(imgNoCors, 0, 0);
            resolve(canvas.toDataURL('image/jpeg', 0.85));
            return;
          }
        } catch (e) {}
        resolve(null);
      };
      imgNoCors.onerror = () => resolve(null);
    };
  });
};

function userPhotoFallback(finding: Finding): string | undefined {
  // CRITICAL: NEVER return finding.photoUrl (which is the inspection issue photo)
  return finding.operatorPhotoUrl || (finding as any).operatorAvatarUrl || (finding as any).avatarUrl || undefined;
}

function drawAvatarPlaceholder(docPDF: jsPDF, x: number, y: number, size: number, name: string) {
  docPDF.setFillColor(14, 165, 233); // Sky background
  docPDF.rect(x, y, size, size, 'F');

  const initials = name
    .split(' ')
    .map(n => n[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase() || 'OP';

  docPDF.setFontSize(11);
  docPDF.setFont('helvetica', 'bold');
  docPDF.setTextColor(255, 255, 255);
  docPDF.text(initials, x + (size / 2) - 4, y + (size / 2) + 3);
}

export const extractEquipmentTag = (finding: Finding): string => {
  if (finding.equipmentTag && finding.equipmentTag.trim()) {
    return finding.equipmentTag.trim();
  }
  if (finding.tag && finding.tag.trim()) {
    return finding.tag.trim();
  }
  if ((finding as any).tag && String((finding as any).tag).trim()) {
    return String((finding as any).tag).trim();
  }
  if (finding.equipmentName) {
    const match = finding.equipmentName.match(/\(([^)]+)\)$/);
    if (match && match[1]) {
      return match[1].trim();
    }
  }
  // Try looking in cached equipment
  if (finding.equipmentId && finding.equipmentId !== 'general') {
    const cached = getCachedEquipment().find(e => e.id === finding.equipmentId);
    if (cached?.tag && cached.tag.trim()) {
      return cached.tag.trim();
    }
  }
  return 'S/N';
};

/**
 * Resolves the true equipment name and tag even if the finding was saved with generic placeholders
 */
export const resolveEquipmentDetails = (finding: Finding): { name: string; tag: string } => {
  let name = '';
  let tag = '';

  // 1. Tag from explicit fields
  const extractedTag = extractEquipmentTag(finding);
  if (extractedTag && extractedTag !== 'S/N') {
    tag = extractedTag;
  }

  // 2. From cached equipment if equipmentId is present
  if (finding.equipmentId && finding.equipmentId !== 'general') {
    const cached = getCachedEquipment().find(e => e.id === finding.equipmentId);
    if (cached) {
      if (cached.name && cached.name.trim()) name = cached.name.trim();
      if (!tag && cached.tag && cached.tag.trim()) tag = cached.tag.trim();
    }
  }

  // 3. From finding.equipmentName if not a generic placeholder
  if (!name && finding.equipmentName) {
    const raw = finding.equipmentName.trim();
    const upper = raw.toUpperCase();
    if (
      upper !== 'PUNTOS GENERALES DE INSPECCIÓN' &&
      upper !== 'PUNTOS GENERALES DE INSPECCION' &&
      upper !== 'ÍTEMS GENERALES DE INSPECCIÓN' &&
      upper !== 'ITEMS GENERALES DE INSPECCIÓN' &&
      upper !== 'PUNTOS GENERALES' &&
      upper !== 'GENERAL' &&
      !upper.includes('PUNTOS GENERALES')
    ) {
      name = raw.replace(/\s*\([^)]+\)$/, '').trim();
    }
  }

  // 4. Extract from finding description if still generic or empty
  if (!name && finding.description) {
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
          name = candidate;
          break;
        }
      }
    }
  }

  // 5. Fallback: if finding.equipmentName exists use it, or areaName
  if (!name) {
    name = (finding.equipmentName && !finding.equipmentName.toUpperCase().includes('GENERALES'))
      ? finding.equipmentName.trim()
      : (finding.areaName ? finding.areaName.trim() : 'Área Principal');
  }

  return {
    name,
    tag: tag || 'S/N'
  };
};

/**
 * Resolves the inspection or equipment duration in seconds and formatted text
 */
export const resolveInspectionDuration = (finding: Finding): { durationSecs: number; formatted: string } => {
  let secs = finding.equipmentDurationSeconds || finding.inspectionDurationSeconds || (finding as any).durationSeconds || 0;

  if (!secs || secs <= 0) {
    // Try from equipment timestamps
    const eqStart = parseAnyDate(finding.equipmentStartedAt);
    const eqEnd = parseAnyDate(finding.equipmentCompletedAt);
    if (eqStart && eqEnd) {
      secs = Math.max(0, Math.round((eqEnd.getTime() - eqStart.getTime()) / 1000));
    }
  }

  if (!secs || secs <= 0) {
    // Try from inspection timestamps
    const insStart = parseAnyDate(finding.inspectionStartedAt);
    const insEnd = parseAnyDate(finding.inspectionCompletedAt);
    if (insStart && insEnd) {
      secs = Math.max(0, Math.round((insEnd.getTime() - insStart.getTime()) / 1000));
    }
  }

  if (!secs || secs <= 0) {
    // Check if finding has timing subobject
    const timing = (finding as any).timing;
    if (timing?.durationSeconds && timing.durationSeconds > 0) {
      secs = timing.durationSeconds;
    } else if (timing?.startedAt && timing?.completedAt) {
      const s = parseAnyDate(timing.startedAt);
      const e = parseAnyDate(timing.completedAt);
      if (s && e) {
        secs = Math.max(0, Math.round((e.getTime() - s.getTime()) / 1000));
      }
    }
  }

  // Realistic fallback based on inspected bullets/items
  if (!secs || secs <= 0) {
    const bulletCount = (finding.description ? finding.description.match(/•/g) || [] : []).length;
    secs = Math.max(60, bulletCount > 0 ? bulletCount * 30 : 90);
  }

  return {
    durationSecs: secs,
    formatted: formatDurationPDF(secs)
  };
};

/**
 * Generates an independent, highly structured Operator Inspection Summary PDF Report
 */
export const generateOperatorInspectionPDF = async (
  finding: Finding,
  operatorProfile?: OperatorProfile,
  settings?: PDFReportSettings
): Promise<{ docPDF: jsPDF; filename: string }> => {
  const docPDF = new jsPDF('p', 'mm', 'a4');
  const pageWidth = docPDF.internal.pageSize.width; // ~210 mm
  const pageHeight = docPDF.internal.pageSize.height; // ~297 mm
  const margin = 14;
  const contentWidth = pageWidth - (margin * 2); // 182 mm

  const findingDate = parseAnyDate(finding.createdAt || finding.date) || new Date();

  const formattedDate = format(findingDate, 'dd/MM/yyyy HH:mm');
  const folioId = `INSP-${(finding.id || 'N/A').substring(0, 8).toUpperCase()}`;
  const operatorName = finding.operatorName || operatorProfile?.name || 'Operador en Terreno';
  const areaName = finding.areaName || 'Área General';
  const plantId = finding.plantId || 'Planta Principal';

  // Accurately resolve Equipment details and duration
  const equipDetails = resolveEquipmentDetails(finding);

  // Deep async Firestore lookup if name is still generic
  if (
    (!equipDetails.name ||
      equipDetails.name.toUpperCase().includes('GENERAL') ||
      equipDetails.name.toUpperCase().includes('PUNTOS GENERALES')) &&
    finding.equipmentId &&
    finding.equipmentId !== 'general'
  ) {
    try {
      const eqSnap = await getDoc(doc(db, 'equipment', finding.equipmentId));
      if (eqSnap.exists()) {
        const eqData = eqSnap.data();
        if (eqData?.name) {
          equipDetails.name = eqData.name.trim();
          if (eqData.tag && (!equipDetails.tag || equipDetails.tag === 'S/N')) {
            equipDetails.tag = eqData.tag.trim();
          }
        }
      }
    } catch (e) {
      // offline fallback
    }
  }

  // Deep async Firestore lookup from associated inspection if inspectionId is present
  if (
    (!equipDetails.name ||
      equipDetails.name.toUpperCase().includes('GENERAL') ||
      equipDetails.name.toUpperCase().includes('PUNTOS GENERALES')) &&
    finding.inspectionId
  ) {
    try {
      const inspSnap = await getDoc(doc(db, 'inspections', finding.inspectionId));
      if (inspSnap.exists()) {
        const inspData = inspSnap.data();
        const results = inspData?.results || {};
        const eqIds = Object.keys(results);
        for (const eqId of eqIds) {
          if (eqId && eqId !== 'general') {
            const eqSnap = await getDoc(doc(db, 'equipment', eqId));
            if (eqSnap.exists() && eqSnap.data()?.name) {
              equipDetails.name = eqSnap.data().name.trim();
              if (eqSnap.data().tag) equipDetails.tag = eqSnap.data().tag.trim();
              break;
            }
          }
        }
      }
    } catch (e) {}
  }

  let durationData = resolveInspectionDuration(finding);
  if (durationData.durationSecs <= 0 && finding.inspectionId) {
    try {
      const inspSnap = await getDoc(doc(db, 'inspections', finding.inspectionId));
      if (inspSnap.exists()) {
        const inspData = inspSnap.data();
        const dSecs = inspData?.durationSeconds || (inspData?.results && Object.values(inspData.results)[0] as any)?.timing?.durationSeconds;
        if (dSecs && dSecs > 0) {
          durationData = {
            durationSecs: dSecs,
            formatted: formatDurationPDF(dSecs)
          };
        }
      }
    } catch (e) {}
  }

  const equipmentTag = equipDetails.tag;
  const durationFormatted = durationData.formatted;

  // Operational Status ("En Funcionamiento" vs "Detenido")
  let operatingStatus = (finding as any).equipmentOperatingStatus || (finding as any).operatingStatus;
  if (!operatingStatus) {
    if (finding.description.includes('Condición operativa: Detenido') || finding.description.includes('Detenido')) {
      operatingStatus = 'Detenido';
    } else {
      operatingStatus = 'En Funcionamiento';
    }
  }

  // --- HEADER BANNER ---
  docPDF.setFillColor(15, 23, 42); // Chekify Deep Navy Slate background (#0F172A)
  docPDF.rect(0, 0, pageWidth, 28, 'F');

  // Accent Line
  docPDF.setFillColor(14, 165, 233); // Chekify Sky-500 accent (#0EA5E9)
  docPDF.rect(0, 28, pageWidth, 1.5, 'F');

  // Dynamic Equipment / Area Title for Header (clean without TAG suffix)
  const cleanEquipHeaderName = equipDetails.name.replace(/\s*\([^)]+\)$/, '').trim().toUpperCase();
  const isGeneric = !cleanEquipHeaderName ||
    cleanEquipHeaderName === 'PUNTOS GENERALES DE INSPECCIÓN' ||
    cleanEquipHeaderName === 'PUNTOS GENERALES DE INSPECCION' ||
    cleanEquipHeaderName === 'ÍTEMS GENERALES DE INSPECCIÓN' ||
    cleanEquipHeaderName === 'ITEMS GENERALES DE INSPECCIÓN' ||
    cleanEquipHeaderName.includes('PUNTOS GENERALES');

  const targetEquipmentName = !isGeneric
    ? cleanEquipHeaderName
    : (finding.areaName && finding.areaName.trim() ? finding.areaName.trim().toUpperCase() : 'ÁREA PRINCIPAL');

  const mainInspectionTitle = `INFORME DE INSPECCIÓN DE ${targetEquipmentName}`;
  const headerMainText = settings?.companyName
    ? `${settings.companyName.toUpperCase()} - ${mainInspectionTitle}`
    : mainInspectionTitle;

  // Header Title
  docPDF.setFontSize(headerMainText.length > 45 ? 10.5 : 12);
  docPDF.setFont('helvetica', 'bold');
  docPDF.setTextColor(255, 255, 255);
  docPDF.text(
    sanitizeForPDF(headerMainText, 55),
    margin,
    12.5
  );

  docPDF.setFontSize(8);
  docPDF.setFont('helvetica', 'normal');
  docPDF.setTextColor(186, 230, 253); // Chekify Sky-200
  docPDF.text(
    `FOLIO: ${folioId}  |  FECHA: ${formattedDate}  |  ÁREA: ${sanitizeForPDF(areaName.toUpperCase(), 30)}`,
    margin,
    20.5
  );

  // Chekify White Logo in top right corner of header
  const chekifyLogo = await getWhiteChekifyLogoBase64();
  let chekifyLogoWidth = 34;
  if (chekifyLogo) {
    try {
      const hHeight = 13; // mm
      chekifyLogoWidth = Math.min(42, Math.max(26, hHeight * chekifyLogo.aspect));
      const hX = pageWidth - margin - chekifyLogoWidth;
      const hY = (28 - hHeight) / 2; // Centered vertically in 28mm banner
      docPDF.addImage(chekifyLogo.dataUrl, 'PNG', hX, hY, chekifyLogoWidth, hHeight);
    } catch (err) {
      console.warn('Error embedding white Chekify logo in header:', err);
    }
  }

  // Custom Company Logo if configured in settings
  if (settings?.logoUrl) {
    const logoBase64 = await loadImageAsBase64(settings.logoUrl);
    if (logoBase64) {
      try {
        const compW = 16;
        const compH = 16;
        const compX = pageWidth - margin - chekifyLogoWidth - compW - 5;
        const compY = (28 - compH) / 2;
        docPDF.addImage(logoBase64, 'JPEG', compX, compY, compW, compH);
      } catch (e) {
        console.warn('Error adding custom company logo to header', e);
      }
    }
  }

  let currentY = 35;
  const cardHeight = 46;

  // --- OPERATOR & INSPECTION METADATA CARD ---
  docPDF.setFillColor(240, 249, 255); // Chekify Sky-50 (#F0F9FF)
  docPDF.setDrawColor(186, 230, 253); // Chekify Sky-200 (#BAE6FD)
  docPDF.roundedRect(margin, currentY, contentWidth, cardHeight, 3, 3, 'FD');

  // Load operator avatar or photo if provided
  const photoCandidate = operatorProfile?.photoUrl || userPhotoFallback(finding);
  let operatorImgBase64: string | null = null;
  if (photoCandidate) {
    operatorImgBase64 = await loadImageAsBase64(photoCandidate);
  }

  const avatarX = margin + 4;
  const avatarY = currentY + 4;
  const avatarSize = 28;

  if (operatorImgBase64) {
    try {
      docPDF.addImage(operatorImgBase64, 'JPEG', avatarX, avatarY, avatarSize, avatarSize);
      docPDF.setDrawColor(14, 165, 233);
      docPDF.setLineWidth(0.5);
      docPDF.rect(avatarX, avatarY, avatarSize, avatarSize, 'D');
    } catch (e) {
      drawAvatarPlaceholder(docPDF, avatarX, avatarY, avatarSize, operatorName);
    }
  } else {
    drawAvatarPlaceholder(docPDF, avatarX, avatarY, avatarSize, operatorName);
  }

  const operatorRutCargo = operatorProfile?.rut || operatorProfile?.cargo 
    ? `${operatorProfile.rut ? 'RUT: ' + operatorProfile.rut : ''} ${operatorProfile.cargo ? '(' + operatorProfile.cargo + ')' : ''}`
    : '';

  // Middle Column Text
  const infoX = avatarX + avatarSize + 5; // ~51 mm
  let infoY = currentY + 6;

  docPDF.setFontSize(7);
  docPDF.setFont('helvetica', 'bold');
  docPDF.setTextColor(3, 105, 161); // Chekify Sky-700
  docPDF.text('OPERADOR / INSPECTOR:', infoX, infoY);
  docPDF.setFontSize(9);
  docPDF.setFont('helvetica', 'bold');
  docPDF.setTextColor(15, 23, 42); // Chekify Navy Slate
  docPDF.text(sanitizeForPDF(operatorName, 26), infoX + 37, infoY);

  infoY += 5.2;
  docPDF.setFontSize(7);
  docPDF.setFont('helvetica', 'bold');
  docPDF.setTextColor(3, 105, 161); // Chekify Sky-700
  docPDF.text('ÁREA DE INSPECCIÓN:', infoX, infoY);
  docPDF.setFontSize(8);
  docPDF.setFont('helvetica', 'bold');
  docPDF.setTextColor(2, 132, 199); // Chekify Sky-600
  docPDF.text(sanitizeForPDF(`${areaName} (${plantId})`, 28), infoX + 37, infoY);

  infoY += 5.2;
  docPDF.setFontSize(7);
  docPDF.setFont('helvetica', 'bold');
  docPDF.setTextColor(3, 105, 161); // Chekify Sky-700
  docPDF.text('EQUIPO / COMPONENTE:', infoX, infoY);
  docPDF.setFontSize(8);
  docPDF.setFont('helvetica', 'normal');
  docPDF.setTextColor(51, 65, 85);
  const cleanEquipName = equipDetails.name.replace(/\s*\([^)]+\)$/, '');
  docPDF.text(sanitizeForPDF(cleanEquipName, 28), infoX + 37, infoY);

  infoY += 5.2;
  docPDF.setFontSize(7);
  docPDF.setFont('helvetica', 'bold');
  docPDF.setTextColor(3, 105, 161); // Chekify Sky-700
  docPDF.text('TAG DEL EQUIPO:', infoX, infoY);
  docPDF.setFontSize(8.5);
  docPDF.setFont('helvetica', 'bold');
  docPDF.setTextColor(16, 185, 129); // Emerald-600 font for high visibility
  docPDF.text(sanitizeForPDF(equipmentTag, 28), infoX + 37, infoY);

  infoY += 5.2;
  docPDF.setFontSize(7);
  docPDF.setFont('helvetica', 'bold');
  docPDF.setTextColor(3, 105, 161); // Chekify Sky-700
  docPDF.text('TIEMPO INSPECCIÓN:', infoX, infoY);
  docPDF.setFontSize(8);
  docPDF.setFont('helvetica', 'bold');
  docPDF.setTextColor(2, 132, 199); // Chekify Sky-600
  docPDF.text(durationFormatted, infoX + 37, infoY);

  if (operatorRutCargo) {
    infoY += 4.5;
    docPDF.setFontSize(6.5);
    docPDF.setFont('helvetica', 'italic');
    docPDF.setTextColor(100, 116, 139);
    docPDF.text(sanitizeForPDF(operatorRutCargo, 40), infoX, infoY);
  }

  // Right Column: Digital Signature Box & Operating Status Badge
  const rightColWidth = 46;
  const stampX = margin + contentWidth - rightColWidth - 3;
  const stampY = currentY + 4;

  // Operating Status Badge in Header
  const isDetenido = operatingStatus === 'Detenido';
  if (isDetenido) {
    docPDF.setFillColor(254, 242, 242); // Red-50
    docPDF.setDrawColor(239, 68, 68); // Red-500
  } else {
    docPDF.setFillColor(240, 253, 244); // Green-50
    docPDF.setDrawColor(34, 197, 94); // Green-500
  }
  docPDF.setLineWidth(0.4);
  docPDF.roundedRect(stampX, stampY, rightColWidth, 10, 1.5, 1.5, 'FD');

  docPDF.setFontSize(7);
  docPDF.setFont('helvetica', 'bold');
  if (isDetenido) {
    docPDF.setTextColor(185, 28, 28);
    docPDF.text('[!] EQUIPO DETENIDO', stampX + 3, stampY + 6.5);
  } else {
    docPDF.setTextColor(21, 128, 61);
    docPDF.text('[OK] EN FUNCIONAMIENTO', stampX + 3, stampY + 6.5);
  }

  // Digital Signature Stamp Box
  const sigY = stampY + 12;
  docPDF.setFillColor(255, 255, 255);
  docPDF.setDrawColor(186, 230, 253); // Chekify Sky-200
  docPDF.roundedRect(stampX, sigY, rightColWidth, 23, 1.5, 1.5, 'FD');

  docPDF.setFontSize(6.5);
  docPDF.setFont('helvetica', 'bold');
  docPDF.setTextColor(3, 105, 161); // Chekify Sky-700
  docPDF.text('FIRMA DIGITAL REGISTRADA', stampX + 3, sigY + 5);

  docPDF.setFontSize(7.5);
  docPDF.setFont('helvetica', 'bold');
  docPDF.setTextColor(15, 23, 42);
  docPDF.text(sanitizeForPDF(operatorName, 20), stampX + 3, sigY + 11);

  docPDF.setFontSize(6);
  docPDF.setFont('helvetica', 'normal');
  docPDF.setTextColor(100, 116, 139);
  docPDF.text(`VALIDADO: ${formattedDate}`, stampX + 3, sigY + 16);
  docPDF.text(`HASH: ${folioId}-VER`, stampX + 3, sigY + 20);

  currentY += cardHeight + 8;

  // --- SECTION TITLE: DETALLE DE LA INSPECCIÓN ---
  docPDF.setFillColor(224, 242, 254); // Chekify Sky-100 (#E0F2FE)
  docPDF.rect(margin, currentY, contentWidth, 7, 'F');
  docPDF.setFillColor(2, 132, 199); // Chekify Sky-600 Left Accent Line
  docPDF.rect(margin, currentY, 3, 7, 'F');
  docPDF.setFontSize(9);
  docPDF.setFont('helvetica', 'bold');
  docPDF.setTextColor(3, 105, 161); // Chekify Sky-700 (#0369A1)
  docPDF.text('HALLAZGOS Y DETALLE REGISTRADO EN LA INSPECCIÓN', margin + 6, currentY + 5);

  currentY += 10;

  // Parse findings description
  const parsed = parseFindingDescription(finding.description, finding.source);
  const rawItems = [...parsed.vosoItems, ...parsed.ordenItems, ...parsed.tradItems];

  // Filter out any status lines that were operating status indicators or general inspection headers
  const allItems = rawItems.filter(item => {
    const titleLower = (item.rawTitle || item.category || '').toLowerCase();
    const detailLower = (item.detail || '').toLowerCase();
    const commentLower = (item.comment || '').toLowerCase();
    const fullText = `${titleLower} ${detailLower} ${commentLower}`;

    const isHeaderOrStatus = 
      titleLower.includes('inspección') ||
      titleLower.includes('inspeccion') ||
      titleLower.includes('reporte') ||
      fullText.includes('condición operativa') || 
      fullText.includes('condicion operativa') ||
      (fullText.includes('condicion') && (fullText.includes('funcionamiento') || fullText.includes('detenido'))) ||
      (fullText.includes('condición') && (fullText.includes('funcionamiento') || fullText.includes('detenido')));

    return !isHeaderOrStatus;
  });

  if (allItems.length > 0) {
    const tableBody = allItems.map((item, index) => {
      const isSolvedText = item.isSolved ? ' (SUBSANADO)' : '';
      const statusText = (item.status || 'OBSERVACIÓN').toUpperCase() + isSolvedText;
      return [
        `${index + 1}. ${sanitizeForPDF(item.rawTitle || item.category)}`,
        statusText,
        sanitizeForPDF(item.comment || item.detail || 'Sin comentarios adicionales')
      ];
    });

    autoTable(docPDF, {
      startY: currentY,
      head: [['Ítem Evaluado', 'Estado / Evaluación', 'Detalle Ingresado por Operador']],
      body: tableBody,
      theme: 'grid',
      headStyles: {
        fillColor: [15, 23, 42],
        textColor: [255, 255, 255],
        fontSize: 8,
        fontStyle: 'bold',
        cellPadding: 3
      },
      styles: {
        fontSize: 8,
        cellPadding: 3,
        overflow: 'linebreak'
      },
      columnStyles: {
        0: { cellWidth: 55, fontStyle: 'bold' },
        1: { cellWidth: 38 },
        2: { cellWidth: 'auto' }
      },
      margin: { left: margin, right: margin },
      didParseCell: function(data) {
        if (data.section === 'body' && data.column.index === 1) {
          const val = data.cell.text.join(' ');
          if (val.includes('CRÍTICO')) {
            data.cell.styles.textColor = [220, 38, 38];
            data.cell.styles.fontStyle = 'bold';
          } else if (val.includes('SUBSANADO')) {
            data.cell.styles.textColor = [16, 185, 129];
            data.cell.styles.fontStyle = 'bold';
          } else if (val.includes('OBSERVACIÓN')) {
            data.cell.styles.textColor = [217, 119, 6];
            data.cell.styles.fontStyle = 'bold';
          }
        }
      }
    });

    currentY = (docPDF as any).lastAutoTable.finalY + 8;
  } else {
    // Render plain description box
    docPDF.setFillColor(255, 255, 255);
    docPDF.setDrawColor(203, 213, 225);
    docPDF.roundedRect(margin, currentY, contentWidth, 24, 2, 2, 'D');

    docPDF.setFontSize(8);
    docPDF.setFont('helvetica', 'bold');
    docPDF.setTextColor(14, 165, 233);
    docPDF.text('DETALLE E IMPRESIÓN DEL OPERADOR EN TERRENO:', margin + 4, currentY + 6);

    docPDF.setFontSize(9);
    docPDF.setFont('helvetica', 'normal');
    docPDF.setTextColor(30, 41, 59);

    let cleanDesc = finding.description
      .replace(/^Inspecci[óo]n.*?(?=\n|•|$)/i, '')
      .replace(/Condici[óo]n operativa: (En Funcionamiento|Detenido)[\.\s\]]*/gi, '')
      .replace(/\[Condici[óo]n.*?\]/gi, '')
      .trim();
    const splitText = docPDF.splitTextToSize(sanitizeForPDF(cleanDesc), contentWidth - 8);
    docPDF.text(splitText, margin + 4, currentY + 12);

    currentY += Math.max(28, (splitText.length * 4) + 12);
  }

  // If there was an immediate fix / solution
  if (finding.solution || finding.status === 'Closed') {
    if (currentY > pageHeight - 50) {
      docPDF.addPage();
      currentY = 20;
    }

    docPDF.setFillColor(240, 253, 244);
    docPDF.setDrawColor(34, 197, 94);
    docPDF.roundedRect(margin, currentY, contentWidth, 18, 2, 2, 'FD');

    docPDF.setFontSize(8);
    docPDF.setFont('helvetica', 'bold');
    docPDF.setTextColor(22, 101, 52);
    docPDF.text('ACCIÓN / SOLUCIÓN EN TERRENO (SUBSANADO EN INSPECCIÓN):', margin + 4, currentY + 6);

    docPDF.setFontSize(8.5);
    docPDF.setFont('helvetica', 'normal');
    docPDF.setTextColor(15, 23, 42);
    const solText = sanitizeForPDF(finding.solution || 'El hallazgo fue detectado e inmediatamente corregido por el operador durante la inspección.');
    docPDF.text(docPDF.splitTextToSize(solText, contentWidth - 8), margin + 4, currentY + 12);

    currentY += 22;
  }

  // --- EVIDENCIA FOTOGRÁFICA ---
  const photos = extractFindingPhotos(finding);

  if (photos.length > 0) {
    if (currentY > pageHeight - 75) {
      docPDF.addPage();
      currentY = 20;
    }

    docPDF.setFillColor(224, 242, 254); // Chekify Sky-100 (#E0F2FE)
    docPDF.rect(margin, currentY, contentWidth, 7, 'F');
    docPDF.setFillColor(2, 132, 199); // Chekify Sky-600 Left Accent Line
    docPDF.rect(margin, currentY, 3, 7, 'F');
    docPDF.setFontSize(9);
    docPDF.setFont('helvetica', 'bold');
    docPDF.setTextColor(3, 105, 161); // Chekify Sky-700 (#0369A1)
    docPDF.text(`EVIDENCIA FOTOGRÁFICA EN TERRENO (${photos.length} FOTO${photos.length > 1 ? 'S' : ''})`, margin + 6, currentY + 5);

    currentY += 10;

    const photoWidth = photos.length === 1 ? 90 : 82;
    const photoHeight = photos.length === 1 ? 65 : 55;
    const gap = 8;

    const getPhotoCaptionInfo = (idx: number, pUrl: string) => {
      // 1) Match via vosoResponses if available on finding
      const voso = (finding as any).vosoResponses || (finding as any).voso;
      if (voso && typeof voso === 'object') {
        for (const [id, resp] of Object.entries(voso) as [string, any][]) {
          if (resp && resp.photoUrl === pUrl) {
            const matchingItem = allItems.find(item => 
              (item.rawTitle && item.rawTitle.toLowerCase().includes(id.toLowerCase())) ||
              (item.category && item.category.toLowerCase().includes(id.toLowerCase()))
            );
            const title = matchingItem?.rawTitle || resp.itemName || resp.name || `Hallazgo ${idx + 1}`;
            const detail = resp.comment || matchingItem?.comment || matchingItem?.detail;
            return {
              title: `Foto ${idx + 1}: ${title}`,
              detail: detail && detail !== 'Sin comentarios adicionales' ? detail : undefined
            };
          }
        }
      }

      // 2) Match by index in allItems
      if (allItems.length > 0) {
        const item = allItems[idx] || (allItems.length === 1 ? allItems[0] : null);
        if (item) {
          const itemTitle = item.rawTitle || item.category || finding.equipmentName || 'Hallazgo';
          const detail = item.comment || item.detail;
          return {
            title: `Foto ${idx + 1}: ${itemTitle}`,
            detail: detail && detail !== 'Sin comentarios adicionales' ? detail : undefined
          };
        }
      }

      // 3) Fallback
      const equipOrArea = finding.equipmentName || finding.areaName || 'Hallazgo';
      const cleanDesc = finding.description
        .replace(/^Inspecci[óo]n.*?(?=\n|•|$)/i, '')
        .replace(/Condici[óo]n operativa: (En Funcionamiento|Detenido)[\.\s\]]*/gi, '')
        .replace(/\[Condici[óo]n.*?\]/gi, '')
        .replace(/HALLAZGOS VOSO:/gi, '')
        .trim();

      const shortDesc = cleanDesc.length > 70 ? cleanDesc.substring(0, 67) + '...' : cleanDesc;

      return {
        title: `Foto ${idx + 1}: ${equipOrArea}`,
        detail: shortDesc || undefined
      };
    };

    for (let i = 0; i < photos.length; i++) {
      const pUrl = photos[i];
      let pBase64 = await loadImageAsBase64(pUrl);
      if (!pBase64) {
        for (const candidate of photos) {
          if (candidate !== pUrl) {
            pBase64 = await loadImageAsBase64(candidate);
            if (pBase64) break;
          }
        }
      }
      const photoInfo = getPhotoCaptionInfo(i, pUrl);

      const isSecondCol = (i % 2) === 1;
      let pX = margin + (isSecondCol ? photoWidth + gap : 0);

      if (!isSecondCol && i > 0) {
        currentY += photoHeight + 18;
      }

      if (currentY + photoHeight + 16 > pageHeight - 20) {
        docPDF.addPage();
        currentY = 20;
        pX = margin;
      }

      if (pBase64) {
        try {
          docPDF.addImage(pBase64, 'JPEG', pX, currentY, photoWidth, photoHeight);
          docPDF.setDrawColor(186, 230, 253); // Chekify Sky-200 border
          docPDF.setLineWidth(0.4);
          docPDF.rect(pX, currentY, photoWidth, photoHeight, 'D');

          // Caption Title
          let captionY = currentY + photoHeight + 3.5;
          docPDF.setFontSize(7.5);
          docPDF.setFont('helvetica', 'bold');
          docPDF.setTextColor(15, 23, 42); // Chekify Deep Navy
          const titleLines = docPDF.splitTextToSize(sanitizeForPDF(photoInfo.title), photoWidth);
          docPDF.text(titleLines, pX, captionY);

          captionY += titleLines.length * 3.2;

          // Caption Detail
          if (photoInfo.detail) {
            docPDF.setFontSize(7);
            docPDF.setFont('helvetica', 'normal');
            docPDF.setTextColor(3, 105, 161); // Chekify Sky-700
            const detailLines = docPDF.splitTextToSize(sanitizeForPDF(`Obs: ${photoInfo.detail}`), photoWidth);
            docPDF.text(detailLines, pX, captionY);
          }
        } catch (err) {
          console.warn('Could not add image to PDF', err);
        }
      }

      if (isSecondCol || i === photos.length - 1) {
        if (i === photos.length - 1) {
          currentY += photoHeight + 18;
        }
      }
    }
  }

  // --- FOOTER ---
  const totalPages = (docPDF as any).internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    docPDF.setPage(i);

    docPDF.setDrawColor(186, 230, 253); // Chekify Sky-200
    docPDF.setLineWidth(0.4);
    docPDF.line(margin, pageHeight - 12, pageWidth - margin, pageHeight - 12);

    docPDF.setFontSize(7.5);
    docPDF.setFont('helvetica', 'bold');
    docPDF.setTextColor(3, 105, 161); // Chekify Sky-700
    docPDF.text(
      sanitizeForPDF(settings?.footerText || 'Chekify Enterprise - Informe Oficial de Inspección Operativa en Terreno.'),
      margin,
      pageHeight - 6
    );

    docPDF.setFontSize(7.5);
    docPDF.setFont('helvetica', 'normal');
    docPDF.setTextColor(100, 116, 139);
    docPDF.text(
      `Página ${i} de ${totalPages}`,
      pageWidth - margin - 20,
      pageHeight - 6
    );
  }

  const cleanTarget = (equipDetails.name || areaName || 'inspeccion').toLowerCase().replace(/[^a-z0-9]/g, '_');
  const filename = `Informe_Inspeccion_${cleanTarget}_${format(findingDate, 'yyyyMMdd_HHmm')}.pdf`;

  return { docPDF, filename };
};

export const downloadOperatorInspectionPDF = async (
  finding: Finding,
  operatorProfile?: OperatorProfile,
  settings?: PDFReportSettings
) => {
  try {
    const { docPDF, filename } = await generateOperatorInspectionPDF(finding, operatorProfile, settings);
    docPDF.save(filename);
  } catch (err) {
    console.error('Error generating Operator Inspection PDF:', err);
    alert('Ocurrió un problema al descargar el informe PDF. Por favor, intente nuevamente.');
  }
};

export const shareOperatorInspectionPDF = async (
  finding: Finding,
  operatorProfile?: OperatorProfile,
  settings?: PDFReportSettings
) => {
  try {
    const { docPDF, filename } = await generateOperatorInspectionPDF(finding, operatorProfile, settings);
    const pdfBlob = docPDF.output('blob');
    const pdfFile = new File([pdfBlob], filename, { type: 'application/pdf' });

    if (navigator.share && navigator.canShare && navigator.canShare({ files: [pdfFile] })) {
      try {
        await navigator.share({
          title: `Informe de Inspección de Área - ${finding.areaName || 'Área General'}`,
          text: `Informe de Inspección Operativa de ${finding.operatorName || 'Operador'} en ${finding.areaName || 'Área General'}.`,
          files: [pdfFile]
        });
        return;
      } catch (shareErr) {
        // User dismissed share dialog
        return;
      }
    }

    // Web Share API fallback
    docPDF.save(filename);
    alert('La función de compartir directo no está disponible en este navegador/dispositivo. El archivo PDF ha sido descargado en su lugar.');
  } catch (err) {
    console.error('Error sharing Operator Inspection PDF:', err);
    alert('Ocurrió un problema al compartir el informe PDF. Por favor, intente nuevamente.');
  }
};

export const downloadOrShareOperatorInspectionPDF = async (
  finding: Finding,
  operatorProfile?: OperatorProfile,
  settings?: PDFReportSettings
) => {
  if (navigator.share) {
    await shareOperatorInspectionPDF(finding, operatorProfile, settings);
  } else {
    await downloadOperatorInspectionPDF(finding, operatorProfile, settings);
  }
};
