import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { Finding } from '../types';
import { parseFindingDescription } from '../components/FindingDescriptionRenderer';
import { extractFindingPhotos } from '../components/FindingPhotoGallery';

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
  if (totalSecs === undefined || totalSecs === null || isNaN(totalSecs) || totalSecs <= 0) {
    return 'N/A';
  }
  const hrs = Math.floor(totalSecs / 3600);
  const mins = Math.floor((totalSecs % 3600) / 60);
  const secs = totalSecs % 60;
  if (hrs > 0) {
    return `${hrs}h ${mins.toString().padStart(2, '0')}m ${secs.toString().padStart(2, '0')}s`;
  }
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')} min`;
};

/**
 * Loads an image URL safely into a base64 Data URL for jsPDF embedding
 */
const loadImageAsBase64 = async (url: string): Promise<string | null> => {
  if (!url) return null;
  if (url.startsWith('data:image')) return url;

  try {
    const response = await fetch(url);
    if (response.ok) {
      const blob = await response.blob();
      const base64 = await new Promise<string | null>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          if (typeof reader.result === 'string') {
            resolve(reader.result);
          } else {
            resolve(null);
          }
        };
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(blob);
      });
      if (base64) return base64;
    }
  } catch (err) {
    // Fallback below
  }

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
          const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
          resolve(dataUrl);
        } else {
          resolve(null);
        }
      } catch (err) {
        console.warn('Could not convert image to base64 for PDF:', err);
        resolve(null);
      }
    };

    img.onerror = () => {
      console.warn('Failed to load image for PDF embedding:', url);
      resolve(null);
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

  const findingDate = finding.createdAt?.toDate 
    ? finding.createdAt.toDate() 
    : finding.date 
      ? new Date(finding.date) 
      : new Date();

  const formattedDate = format(findingDate, 'dd/MM/yyyy HH:mm');
  const folioId = `INSP-${(finding.id || 'N/A').substring(0, 8).toUpperCase()}`;
  const operatorName = finding.operatorName || operatorProfile?.name || 'Operador en Terreno';
  const areaName = finding.areaName || 'Área General';
  const equipmentName = finding.equipmentName || 'Puntos Generales de Inspección';
  const plantId = finding.plantId || 'Planta Principal';

  // Duration calculation
  const durationSecs = finding.equipmentDurationSeconds || finding.inspectionDurationSeconds || (finding as any).durationSeconds || 0;
  const durationFormatted = formatDurationPDF(durationSecs);

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
  docPDF.setFillColor(24, 24, 27); // Dark Zinc background
  docPDF.rect(0, 0, pageWidth, 28, 'F');

  // Accent Line
  docPDF.setFillColor(14, 165, 233); // Sky-500 accent
  docPDF.rect(0, 28, pageWidth, 1.5, 'F');

  // Header Title
  docPDF.setFontSize(13);
  docPDF.setFont('helvetica', 'bold');
  docPDF.setTextColor(255, 255, 255);
  docPDF.text(
    sanitizeForPDF(settings?.companyName ? `${settings.companyName} - INFORME DE INSPECCIÓN DE ÁREA` : 'INFORME DE INSPECCIÓN DE ÁREA COMPLETA'),
    margin,
    13
  );

  docPDF.setFontSize(8.5);
  docPDF.setFont('helvetica', 'normal');
  docPDF.setTextColor(186, 230, 253);
  docPDF.text(
    `FOLIO: ${folioId}  |  FECHA: ${formattedDate}  |  INSPECCIÓN DE ÁREA`,
    margin,
    21
  );

  if (settings?.logoUrl) {
    const logoBase64 = await loadImageAsBase64(settings.logoUrl);
    if (logoBase64) {
      try {
        docPDF.addImage(logoBase64, 'JPEG', pageWidth - margin - 22, 4, 20, 20);
      } catch (e) {
        console.warn('Error adding logo to header', e);
      }
    }
  }

  let currentY = 35;
  const cardHeight = 44;

  // --- OPERATOR & INSPECTION METADATA CARD ---
  docPDF.setFillColor(248, 250, 252); // Slate-50
  docPDF.setDrawColor(226, 232, 240); // Slate-200
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
  let infoY = currentY + 7;

  docPDF.setFontSize(7.5);
  docPDF.setFont('helvetica', 'bold');
  docPDF.setTextColor(100, 116, 139);
  docPDF.text('OPERADOR / INSPECTOR:', infoX, infoY);
  docPDF.setFontSize(9.5);
  docPDF.setFont('helvetica', 'bold');
  docPDF.setTextColor(15, 23, 42);
  docPDF.text(sanitizeForPDF(operatorName, 26), infoX + 37, infoY);

  infoY += 6;
  docPDF.setFontSize(7.5);
  docPDF.setFont('helvetica', 'bold');
  docPDF.setTextColor(100, 116, 139);
  docPDF.text('ÁREA DE INSPECCIÓN:', infoX, infoY);
  docPDF.setFontSize(8.5);
  docPDF.setFont('helvetica', 'bold');
  docPDF.setTextColor(14, 116, 144);
  docPDF.text(sanitizeForPDF(`${areaName} (${plantId})`, 28), infoX + 37, infoY);

  infoY += 6;
  docPDF.setFontSize(7.5);
  docPDF.setFont('helvetica', 'bold');
  docPDF.setTextColor(100, 116, 139);
  docPDF.text('EQUIPO / COMPONENTE:', infoX, infoY);
  docPDF.setFontSize(8.5);
  docPDF.setFont('helvetica', 'normal');
  docPDF.setTextColor(51, 65, 85);
  docPDF.text(sanitizeForPDF(equipmentName || 'Área Completa', 28), infoX + 37, infoY);

  infoY += 6;
  docPDF.setFontSize(7.5);
  docPDF.setFont('helvetica', 'bold');
  docPDF.setTextColor(100, 116, 139);
  docPDF.text('TIEMPO INSPECCIÓN:', infoX, infoY);
  docPDF.setFontSize(8.5);
  docPDF.setFont('helvetica', 'bold');
  docPDF.setTextColor(2, 132, 199); // Sky-600
  docPDF.text(durationFormatted, infoX + 37, infoY);

  if (operatorRutCargo) {
    infoY += 5;
    docPDF.setFontSize(7);
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
  docPDF.setDrawColor(203, 213, 225);
  docPDF.roundedRect(stampX, sigY, rightColWidth, 23, 1.5, 1.5, 'FD');

  docPDF.setFontSize(6.5);
  docPDF.setFont('helvetica', 'bold');
  docPDF.setTextColor(15, 23, 42);
  docPDF.text('FIRMA DIGITAL REGISTRADA', stampX + 3, sigY + 5);

  docPDF.setFontSize(7.5);
  docPDF.setFont('helvetica', 'bold');
  docPDF.setTextColor(14, 116, 144);
  docPDF.text(sanitizeForPDF(operatorName, 20), stampX + 3, sigY + 11);

  docPDF.setFontSize(6);
  docPDF.setFont('helvetica', 'normal');
  docPDF.setTextColor(100, 116, 139);
  docPDF.text(`VALIDADO: ${formattedDate}`, stampX + 3, sigY + 16);
  docPDF.text(`HASH: ${folioId}-VER`, stampX + 3, sigY + 20);

  currentY += cardHeight + 8;

  // --- SECTION TITLE: DETALLE DE LA INSPECCIÓN ---
  docPDF.setFillColor(241, 245, 249);
  docPDF.rect(margin, currentY, contentWidth, 7, 'F');
  docPDF.setFontSize(9);
  docPDF.setFont('helvetica', 'bold');
  docPDF.setTextColor(15, 23, 42);
  docPDF.text('HALLAZGOS Y DETALLE REGISTRADO EN LA INSPECCIÓN', margin + 3, currentY + 5);

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
      head: [['Punto de Control / Ítem Evaluado', 'Estado / Evaluación', 'Detalle Ingresado por Operador']],
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

    docPDF.setFillColor(241, 245, 249);
    docPDF.rect(margin, currentY, contentWidth, 7, 'F');
    docPDF.setFontSize(9);
    docPDF.setFont('helvetica', 'bold');
    docPDF.setTextColor(15, 23, 42);
    docPDF.text(`EVIDENCIA FOTOGRÁFICA EN TERRENO (${photos.length} FOTO${photos.length > 1 ? 'S' : ''})`, margin + 3, currentY + 5);

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
      const pBase64 = await loadImageAsBase64(pUrl);
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
          docPDF.setDrawColor(203, 213, 225);
          docPDF.setLineWidth(0.3);
          docPDF.rect(pX, currentY, photoWidth, photoHeight, 'D');

          // Caption Title
          let captionY = currentY + photoHeight + 3.5;
          docPDF.setFontSize(7.5);
          docPDF.setFont('helvetica', 'bold');
          docPDF.setTextColor(30, 41, 59);
          const titleLines = docPDF.splitTextToSize(sanitizeForPDF(photoInfo.title), photoWidth);
          docPDF.text(titleLines, pX, captionY);

          captionY += titleLines.length * 3.2;

          // Caption Detail
          if (photoInfo.detail) {
            docPDF.setFontSize(7);
            docPDF.setFont('helvetica', 'normal');
            docPDF.setTextColor(100, 116, 139);
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

    docPDF.setDrawColor(226, 232, 240);
    docPDF.setLineWidth(0.3);
    docPDF.line(margin, pageHeight - 12, pageWidth - margin, pageHeight - 12);

    docPDF.setFontSize(7.5);
    docPDF.setFont('helvetica', 'bold');
    docPDF.setTextColor(148, 163, 184);
    docPDF.text(
      sanitizeForPDF(settings?.footerText || 'Este documento es un informe independiente autogenerado de inspección operativa en terreno.'),
      margin,
      pageHeight - 6
    );

    docPDF.text(
      `Página ${i} de ${totalPages}`,
      pageWidth - margin - 20,
      pageHeight - 6
    );
  }

  const cleanArea = (areaName || 'inspeccion').toLowerCase().replace(/[^a-z0-9]/g, '_');
  const filename = `Informe_Inspeccion_${cleanArea}_${format(findingDate, 'yyyyMMdd_HHmm')}.pdf`;

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
