import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  QrCode, 
  Printer, 
  Download, 
  Copy, 
  Check, 
  X, 
  ShieldCheck, 
  MapPin, 
  Layers, 
  Sparkles, 
  Wrench, 
  ExternalLink,
  ChevronDown,
  Info
} from 'lucide-react';
import { QRCodeCanvas } from 'qrcode.react';
import { Area, Equipment } from '../types';

interface AreaQRModalProps {
  isOpen: boolean;
  onClose: () => void;
  area: Area | null;
  allAreas?: Area[];
  plants?: { id: string; name: string }[];
  equipment?: Equipment[];
  onSelectArea?: (area: Area) => void;
}

type BadgeFormat = 'placard' | 'sticker' | 'detailed';
type BadgeTheme = 'brand' | 'emerald' | 'monochrome';

export const AreaQRModal: React.FC<AreaQRModalProps> = ({
  isOpen,
  onClose,
  area,
  allAreas = [],
  plants = [],
  equipment = [],
  onSelectArea
}) => {
  const [currentArea, setCurrentArea] = useState<Area | null>(area);
  const [format, setFormat] = useState<BadgeFormat>('placard');
  const [theme, setTheme] = useState<BadgeTheme>('brand');
  const [withLogo, setWithLogo] = useState(true);
  const [includeEquipList, setIncludeEquipList] = useState(true);
  const [isBatchMode, setIsBatchMode] = useState(false);
  const [selectedBatchIds, setSelectedBatchIds] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);
  const [isGeneratingDownload, setIsGeneratingDownload] = useState(false);

  const previewCardRef = useRef<HTMLDivElement>(null);
  const qrCanvasRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (area) {
      setCurrentArea(area);
      setSelectedBatchIds(allAreas.map(a => a.id));
    }
  }, [area, allAreas]);

  if (!isOpen || (!currentArea && !isBatchMode)) return null;

  const activePlant = plants.find(p => p.id === (currentArea as any)?.plantId);
  const plantName = activePlant?.name || 'Planta Operativa';
  const qrValue = currentArea?.qrCode || currentArea?.id || '';

  const areaEquip = currentArea 
    ? equipment.filter(e => e.areaId === currentArea.id && (e as any).status !== 'deleted')
    : [];

  // Theme styling helpers
  const themeColors = {
    brand: {
      primary: '#0071E3',
      border: 'border-[#0071E3]',
      text: 'text-[#0071E3]',
      bgLight: 'bg-blue-50/70',
      badge: 'bg-[#0071E3] text-white',
      accent: '#0A84FF'
    },
    emerald: {
      primary: '#059669',
      border: 'border-emerald-600',
      text: 'text-emerald-600',
      bgLight: 'bg-emerald-50/70',
      badge: 'bg-emerald-600 text-white',
      accent: '#10B981'
    },
    monochrome: {
      primary: '#18181B',
      border: 'border-zinc-900',
      text: 'text-zinc-900',
      bgLight: 'bg-zinc-100/70',
      badge: 'bg-zinc-900 text-white',
      accent: '#27272A'
    }
  };

  const currentTheme = themeColors[theme];

  // Print function using dedicated isolated print window
  const handlePrint = (printAll: boolean = false) => {
    const areasToPrint = printAll 
      ? allAreas.filter(a => selectedBatchIds.includes(a.id) && (a as any).status !== 'deleted')
      : (currentArea ? [currentArea] : []);

    if (areasToPrint.length === 0) return;

    const printWindow = window.open('', '_blank', 'width=900,height=750');
    if (!printWindow) {
      alert('Por favor permite ventanas emergentes para poder imprimir.');
      return;
    }

    const cardsHtml = areasToPrint.map((a, idx) => {
      const aPlant = plants.find(p => p.id === (a as any).plantId)?.name || 'Planta Operativa';
      const aEquip = equipment.filter(e => e.areaId === a.id && (e as any).status !== 'deleted');
      const val = a.qrCode || a.id;

      // Render QR as standalone high-contrast image using svg/canvas
      // We will inject the generated QR data URL or SVG
      return `
        <div class="print-card ${format}">
          <div class="card-inner">
            <div class="card-header">
              <div class="brand-badge">
                <img src="/logo.png" alt="CheKify" class="brand-logo" />
                <span class="checkpoint-tag">PUNTO DE INSPECCIÓN OFICIAL</span>
              </div>
              <div class="plant-label">${aPlant.toUpperCase()}</div>
            </div>

            <div class="card-body">
              <div class="area-name-container">
                <span class="area-type-label">ÁREA DESIGNADA</span>
                <h1 class="area-title">${a.name}</h1>
                <div class="area-code-chip">CÓDIGO: <strong>${val}</strong></div>
              </div>

              <div class="qr-wrapper">
                <div class="qr-frame">
                  <!-- The QR will be injected via JS inside printWindow -->
                  <div class="qr-target" data-value="${val}"></div>
                </div>
              </div>

              ${format === 'detailed' && aEquip.length > 0 ? `
                <div class="equip-list-section">
                  <div class="equip-list-title">EQUIPOS REGISTRADOS EN ESTA ÁREA (${aEquip.length}):</div>
                  <div class="equip-tags">
                    ${aEquip.slice(0, 8).map(e => `<span class="equip-tag">• ${e.name}</span>`).join('')}
                    ${aEquip.length > 8 ? `<span class="equip-tag">+${aEquip.length - 8} más...</span>` : ''}
                  </div>
                </div>
              ` : ''}
            </div>

            <div class="card-footer">
              <div class="instruction-box">
                <div class="inst-step">
                  <span class="inst-num">1</span>
                  <span>Abre <strong>CheKify</strong> o tu cámara</span>
                </div>
                <div class="inst-step">
                  <span class="inst-num">2</span>
                  <span>Escanea este código QR</span>
                </div>
                <div class="inst-step">
                  <span class="inst-num">3</span>
                  <span>Inicia la inspección del área</span>
                </div>
              </div>
              <div class="footer-meta">
                <span>Sistema CheKify • Verificación Operativa y de Seguridad</span>
                <span>ID: ${a.id}</span>
              </div>
            </div>
          </div>
        </div>
      `;
    }).join('\n');

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Fichas QR de Áreas - CheKify</title>
          <meta charset="utf-8" />
          <style>
            @page {
              size: A4;
              margin: 8mm;
            }
            * {
              box-sizing: border-box;
              margin: 0;
              padding: 0;
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            }
            body {
              background: #ffffff;
              color: #111827;
              padding: 8px;
            }
            .grid-container {
              display: flex;
              flex-wrap: wrap;
              gap: 16px;
              justify-content: center;
            }
            .print-card {
              background: #ffffff;
              border: 3px solid #1e293b;
              border-radius: 16px;
              page-break-inside: avoid;
              margin-bottom: 16px;
              box-shadow: none;
              overflow: hidden;
            }
            /* Formats */
            .print-card.placard {
              width: 140mm;
              min-height: 190mm;
              padding: 18px;
            }
            .print-card.sticker {
              width: 95mm;
              min-height: 110mm;
              padding: 12px;
            }
            .print-card.detailed {
              width: 160mm;
              min-height: 220mm;
              padding: 20px;
            }
            .card-inner {
              display: flex;
              flex-direction: column;
              height: 100%;
              border: 1.5px dashed #94a3b8;
              border-radius: 12px;
              padding: 16px;
              text-align: center;
            }
            .card-header {
              display: flex;
              justify-content: space-between;
              align-items: center;
              border-bottom: 2px solid #0f172a;
              padding-bottom: 10px;
              margin-bottom: 14px;
            }
            .brand-badge {
              display: flex;
              flex-direction: column;
              align-items: flex-start;
              gap: 2px;
            }
            .brand-logo {
              height: 26px;
              width: auto;
              object-fit: contain;
            }
            .checkpoint-tag {
              font-size: 8px;
              font-weight: 900;
              letter-spacing: 1px;
              color: #0369a1;
            }
            .plant-label {
              font-size: 9px;
              font-weight: 800;
              background: #f1f5f9;
              padding: 4px 8px;
              border-radius: 6px;
              border: 1px solid #cbd5e1;
            }
            .area-type-label {
              font-size: 9px;
              font-weight: 800;
              letter-spacing: 1.5px;
              color: #64748b;
              text-transform: uppercase;
            }
            .area-title {
              font-size: 22px;
              font-weight: 900;
              line-height: 1.2;
              color: #0f172a;
              margin: 4px 0 6px 0;
              text-transform: uppercase;
            }
            .area-code-chip {
              display: inline-block;
              font-size: 11px;
              font-weight: 800;
              background: #f8fafc;
              border: 1px solid #cbd5e1;
              padding: 3px 10px;
              border-radius: 6px;
              margin-bottom: 12px;
            }
            .qr-wrapper {
              display: flex;
              justify-content: center;
              align-items: center;
              margin: 10px 0;
            }
            .qr-frame {
              padding: 10px;
              background: #ffffff;
              border: 2px solid #0f172a;
              border-radius: 12px;
              display: inline-block;
            }
            .equip-list-section {
              margin-top: 10px;
              padding: 8px;
              background: #f8fafc;
              border-radius: 8px;
              border: 1px solid #e2e8f0;
              text-align: left;
            }
            .equip-list-title {
              font-size: 9px;
              font-weight: 800;
              color: #475569;
              margin-bottom: 4px;
            }
            .equip-tags {
              display: flex;
              flex-wrap: wrap;
              gap: 4px;
            }
            .equip-tag {
              font-size: 9px;
              font-weight: 600;
              color: #334155;
            }
            .card-footer {
              margin-top: auto;
              padding-top: 12px;
              border-top: 1.5px solid #e2e8f0;
            }
            .instruction-box {
              display: flex;
              justify-content: space-around;
              gap: 8px;
              margin-bottom: 8px;
            }
            .inst-step {
              display: flex;
              align-items: center;
              gap: 4px;
              font-size: 9px;
              color: #334155;
              text-align: left;
            }
            .inst-num {
              width: 16px;
              height: 16px;
              border-radius: 50%;
              background: #0f172a;
              color: #ffffff;
              font-size: 9px;
              font-weight: 800;
              display: flex;
              align-items: center;
              justify-content: center;
              flex-shrink: 0;
            }
            .footer-meta {
              display: flex;
              justify-content: space-between;
              font-size: 7.5px;
              color: #94a3b8;
              font-weight: 600;
              margin-top: 4px;
            }
          </style>
          <!-- Include qrcodejs from CDN for instant crisp rendering inside the isolated print window -->
          <script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"></script>
        </head>
        <body>
          <div class="grid-container">
            ${cardsHtml}
          </div>
          <script>
            // Render QRs for all cards
            document.querySelectorAll('.qr-target').forEach(function(el) {
              var val = el.getAttribute('data-value');
              new QRCode(el, {
                text: val,
                width: 170,
                height: 170,
                colorDark: "#000000",
                colorLight: "#ffffff",
                correctLevel: QRCode.CorrectLevel.H
              });
            });

            // Auto-trigger print after short delay
            setTimeout(function() {
              window.focus();
              window.print();
            }, 500);
          </script>
        </body>
      </html>
    `);

    printWindow.document.close();
  };

  // Download high-resolution PNG of the placard/sticker
  const handleDownloadImage = async () => {
    if (!currentArea) return;
    setIsGeneratingDownload(true);

    try {
      // Find the rendered canvas element
      const qrCanvas = document.getElementById('area-qr-canvas') as HTMLCanvasElement;
      if (!qrCanvas) {
        throw new Error('Canvas not found');
      }

      // Create a high-resolution export canvas (1200 x 1600 px)
      const exportCanvas = document.createElement('canvas');
      const isSticker = format === 'sticker';
      const width = isSticker ? 1000 : 1200;
      const height = isSticker ? 1100 : 1600;
      exportCanvas.width = width;
      exportCanvas.height = height;
      const ctx = exportCanvas.getContext('2d');
      if (!ctx) throw new Error('Could not get canvas context');

      // 1. Clean White Background
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, width, height);

      // 2. Outer industrial frame
      ctx.strokeStyle = currentTheme.primary;
      ctx.lineWidth = 14;
      ctx.strokeRect(20, 20, width - 40, height - 40);

      // 3. Inner dashed frame
      ctx.strokeStyle = '#CBD5E1';
      ctx.lineWidth = 4;
      ctx.setLineDash([16, 12]);
      ctx.strokeRect(40, 40, width - 80, height - 80);
      ctx.setLineDash([]); // Reset dash

      // 4. Header Bar
      ctx.fillStyle = currentTheme.primary;
      ctx.fillRect(50, 50, width - 100, 110);

      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 36px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('CHEKIFY • PUNTO DE INSPECCIÓN OFICIAL', width / 2, 115);

      ctx.font = 'bold 22px sans-serif';
      ctx.fillStyle = '#E0F2FE';
      ctx.fillText(plantName.toUpperCase(), width / 2, 145);

      // 5. Area Title
      ctx.textAlign = 'center';
      ctx.fillStyle = '#64748B';
      ctx.font = 'bold 24px sans-serif';
      ctx.fillText('ÁREA DESIGNADA', width / 2, 230);

      ctx.fillStyle = '#0F172A';
      ctx.font = 'bold 54px sans-serif';
      // Word wrap if long
      const areaTitle = currentArea.name.toUpperCase();
      ctx.fillText(areaTitle, width / 2, 290);

      // Code badge
      const codeText = `CÓDIGO: ${qrValue}`;
      ctx.font = 'bold 26px monospace';
      const textMetrics = ctx.measureText(codeText);
      const chipW = textMetrics.width + 40;
      ctx.fillStyle = '#F1F5F9';
      ctx.fillRect((width - chipW) / 2, 325, chipW, 46);
      ctx.strokeStyle = '#94A3B8';
      ctx.lineWidth = 2;
      ctx.strokeRect((width - chipW) / 2, 325, chipW, 46);
      ctx.fillStyle = '#0F172A';
      ctx.fillText(codeText, width / 2, 357);

      // 6. Draw QR Code in Center
      const qrSize = isSticker ? 460 : 540;
      const qrX = (width - qrSize) / 2;
      const qrY = isSticker ? 420 : 420;

      // Draw white backing and border for QR
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(qrX - 16, qrY - 16, qrSize + 32, qrSize + 32);
      ctx.strokeStyle = '#0F172A';
      ctx.lineWidth = 6;
      ctx.strokeRect(qrX - 16, qrY - 16, qrSize + 32, qrSize + 32);

      // Draw the QR canvas contents
      ctx.drawImage(qrCanvas, qrX, qrY, qrSize, qrSize);

      // 7. Instructions / Footer
      if (!isSticker) {
        const instY = 1040;
        ctx.fillStyle = '#F8FAFC';
        ctx.fillRect(70, instY, width - 140, 240);
        ctx.strokeStyle = '#E2E8F0';
        ctx.lineWidth = 3;
        ctx.strokeRect(70, instY, width - 140, 240);

        ctx.fillStyle = '#0F172A';
        ctx.font = 'bold 26px sans-serif';
        ctx.fillText('INSTRUCCIONES PARA EL OPERADOR / SUPERVISOR', width / 2, instY + 50);

        ctx.font = 'normal 22px sans-serif';
        ctx.fillStyle = '#334155';
        ctx.textAlign = 'left';
        ctx.fillText('1. Abre la aplicación CheKify desde tu móvil o activa tu cámara.', 110, instY + 105);
        ctx.fillText('2. Apunta el escáner a este código QR para cargar la lista de chequeo.', 110, instY + 145);
        ctx.fillText('3. Realiza la inspección de equipos y reporta cualquier hallazgo.', 110, instY + 185);

        // Meta Footer
        ctx.textAlign = 'center';
        ctx.fillStyle = '#94A3B8';
        ctx.font = 'bold 20px sans-serif';
        ctx.fillText('Gestión Inteligente de Inspecciones Industriales • CheKify', width / 2, 1370);
        ctx.font = '16px monospace';
        ctx.fillText(`ID Único: ${currentArea.id}`, width / 2, 1400);
      } else {
        ctx.textAlign = 'center';
        ctx.fillStyle = '#64748B';
        ctx.font = 'bold 22px sans-serif';
        ctx.fillText('ESCANEA CON CHEKIFY PARA INICIAR INSPECCIÓN', width / 2, 980);
      }

      // Export as Blob and trigger download
      exportCanvas.toBlob((blob) => {
        if (!blob) throw new Error('Blob conversion failed');
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        const filename = `QR-Chekify-${currentArea.name.replace(/[^a-zA-Z0-9]/g, '_')}-${format}.png`;
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        setIsGeneratingDownload(false);
      }, 'image/png');

    } catch (e) {
      console.error('Error generating image download:', e);
      alert('Error al generar la imagen. Puedes usar la opción de imprimir directamente.');
      setIsGeneratingDownload(false);
    }
  };

  // Copy QR text/code to clipboard
  const handleCopyCode = () => {
    if (!qrValue) return;
    navigator.clipboard.writeText(qrValue);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-sm overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        className="relative w-full max-w-4xl bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
      >
        {/* Header Bar */}
        <div className="p-4 sm:p-5 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between bg-zinc-50 dark:bg-zinc-900/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#0071E3]/15 text-[#0071E3] flex items-center justify-center shrink-0">
              <QrCode className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-zinc-900 dark:text-white text-base sm:text-lg tracking-tight">
                  Generador de QR para Áreas
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black tracking-wider uppercase bg-[#0071E3]/10 text-[#0071E3]">
                  Listo para Instalar
                </span>
              </div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Imprime o descarga fichas personalizadas con el logo oficial de CheKify
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="w-9 h-9 rounded-full bg-zinc-200/70 hover:bg-zinc-300 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-300 flex items-center justify-center transition-colors cursor-pointer"
            >
              <X className="w-4 h-4 stroke-[2.5]" />
            </button>
          </div>
        </div>

        {/* Mode Selector: Individual Area vs Batch Mode */}
        <div className="px-4 py-2.5 bg-zinc-100/60 dark:bg-zinc-900/30 border-b border-zinc-200 dark:border-zinc-800 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsBatchMode(false)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                !isBatchMode 
                  ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-xs border border-zinc-200 dark:border-zinc-700' 
                  : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
              }`}
            >
              Área Individual
            </button>
            {allAreas.length > 1 && (
              <button
                onClick={() => setIsBatchMode(true)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  isBatchMode 
                    ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-xs border border-zinc-200 dark:border-zinc-700' 
                    : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
                }`}
              >
                <Layers className="w-3.5 h-3.5 text-sky-500" />
                <span>Imprimir Lote Completo ({allAreas.length})</span>
              </button>
            )}
          </div>

          {/* Area selector dropdown for individual mode */}
          {!isBatchMode && allAreas.length > 1 && (
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold text-zinc-400 uppercase">Cambiar Área:</span>
              <select
                value={currentArea?.id || ''}
                onChange={(e) => {
                  const found = allAreas.find(a => a.id === e.target.value);
                  if (found) {
                    setCurrentArea(found);
                    if (onSelectArea) onSelectArea(found);
                  }
                }}
                className="bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 text-zinc-800 dark:text-zinc-200 text-xs font-bold rounded-xl px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#0071E3] cursor-pointer"
              >
                {allAreas.map(a => (
                  <option key={a.id} value={a.id}>
                    {a.name} ({a.qrCode})
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Modal Main Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* LEFT COLUMN: Controls & Customization */}
          <div className="lg:col-span-5 space-y-5">
            
            {/* Format Selection */}
            <div className="space-y-2.5">
              <label className="text-xs font-black uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                1. Formato de la Ficha
              </label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setFormat('placard')}
                  className={`p-3 rounded-2xl border text-center transition-all cursor-pointer flex flex-col items-center gap-1.5 ${
                    format === 'placard'
                      ? 'border-[#0071E3] bg-[#0071E3]/5 text-[#0071E3] font-bold shadow-xs'
                      : 'border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-900 text-zinc-600 dark:text-zinc-400'
                  }`}
                >
                  <div className="w-6 h-8 border-2 border-current rounded-sm flex items-center justify-center">
                    <QrCode className="w-3.5 h-3.5" />
                  </div>
                  <span className="text-[11px] leading-tight">Placa de Pared</span>
                </button>

                <button
                  type="button"
                  onClick={() => setFormat('sticker')}
                  className={`p-3 rounded-2xl border text-center transition-all cursor-pointer flex flex-col items-center gap-1.5 ${
                    format === 'sticker'
                      ? 'border-[#0071E3] bg-[#0071E3]/5 text-[#0071E3] font-bold shadow-xs'
                      : 'border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-900 text-zinc-600 dark:text-zinc-400'
                  }`}
                >
                  <div className="w-7 h-7 border-2 border-current rounded-lg flex items-center justify-center">
                    <QrCode className="w-3.5 h-3.5" />
                  </div>
                  <span className="text-[11px] leading-tight">Sticker / Etiqueta</span>
                </button>

                <button
                  type="button"
                  onClick={() => setFormat('detailed')}
                  className={`p-3 rounded-2xl border text-center transition-all cursor-pointer flex flex-col items-center gap-1.5 ${
                    format === 'detailed'
                      ? 'border-[#0071E3] bg-[#0071E3]/5 text-[#0071E3] font-bold shadow-xs'
                      : 'border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-900 text-zinc-600 dark:text-zinc-400'
                  }`}
                >
                  <div className="w-6 h-8 border-2 border-current rounded-sm flex flex-col items-center justify-center gap-0.5">
                    <QrCode className="w-2.5 h-2.5" />
                    <div className="w-3 h-0.5 bg-current" />
                  </div>
                  <span className="text-[11px] leading-tight">Ficha con Equipos</span>
                </button>
              </div>
            </div>

            {/* Customization Options */}
            <div className="space-y-3 bg-zinc-50 dark:bg-zinc-900/40 p-4 rounded-2xl border border-zinc-200/80 dark:border-zinc-800">
              <label className="text-xs font-black uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                2. Personalización del QR
              </label>

              {/* Logo in center toggle */}
              <label className="flex items-center justify-between p-2.5 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 cursor-pointer">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center p-1 overflow-hidden">
                    <img src="/logo_small.png" alt="CheKify Logo" className="w-full h-full object-contain" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-zinc-900 dark:text-white block">Logo CheKify en el centro</span>
                    <span className="text-[10px] text-zinc-400">Identidad de marca y mayor presencia visual</span>
                  </div>
                </div>
                <input 
                  type="checkbox" 
                  checked={withLogo} 
                  onChange={(e) => setWithLogo(e.target.checked)}
                  className="w-4 h-4 text-[#0071E3] rounded-md focus:ring-0 cursor-pointer"
                />
              </label>

              {/* Theme color */}
              <div className="space-y-1.5 pt-1">
                <span className="text-[11px] font-bold text-zinc-600 dark:text-zinc-300">Color de Marco & Acento:</span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setTheme('brand')}
                    className={`flex-1 py-1.5 px-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 border transition-all cursor-pointer ${
                      theme === 'brand' 
                        ? 'border-[#0071E3] bg-[#0071E3] text-white shadow-xs' 
                        : 'border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300'
                    }`}
                  >
                    <span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block" />
                    <span>Azul CheKify</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setTheme('emerald')}
                    className={`flex-1 py-1.5 px-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 border transition-all cursor-pointer ${
                      theme === 'emerald' 
                        ? 'border-emerald-600 bg-emerald-600 text-white shadow-xs' 
                        : 'border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300'
                    }`}
                  >
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
                    <span>Seguridad</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setTheme('monochrome')}
                    className={`flex-1 py-1.5 px-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 border transition-all cursor-pointer ${
                      theme === 'monochrome' 
                        ? 'border-zinc-900 bg-zinc-900 text-white shadow-xs' 
                        : 'border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300'
                    }`}
                  >
                    <span className="w-2.5 h-2.5 rounded-full bg-zinc-900 inline-block" />
                    <span>B&N</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Quick Actions Panel */}
            <div className="space-y-2.5 pt-2">
              <label className="text-xs font-black uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                3. Acciones de Impresión e Instalación
              </label>

              <button
                type="button"
                onClick={() => handlePrint(isBatchMode)}
                className="w-full py-3.5 px-4 bg-[#0071E3] hover:bg-[#0077ED] text-white rounded-2xl font-black text-sm flex items-center justify-center gap-2.5 shadow-lg shadow-blue-500/20 active:scale-98 transition-all cursor-pointer"
              >
                <Printer className="w-5 h-5" />
                <span>
                  {isBatchMode 
                    ? `Imprimir Lote de Fichas (${selectedBatchIds.length} Áreas)` 
                    : 'Imprimir Ficha para Instalación'}
                </span>
              </button>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={handleDownloadImage}
                  disabled={isGeneratingDownload}
                  className="py-2.5 px-3 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-900 dark:text-white rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer border border-zinc-200 dark:border-zinc-700"
                >
                  <Download className="w-4 h-4 text-sky-500" />
                  <span>{isGeneratingDownload ? 'Generando...' : 'Descargar PNG'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleCopyCode}
                  className="py-2.5 px-3 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-900 dark:text-white rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer border border-zinc-200 dark:border-zinc-700"
                >
                  {copied ? (
                    <>
                      <Check className="w-4 h-4 text-emerald-500" />
                      <span className="text-emerald-500">¡Copiado!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4 text-zinc-400" />
                      <span>Copiar Código</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Installation advice tip */}
            <div className="p-3 bg-sky-50/70 dark:bg-sky-950/20 rounded-2xl border border-sky-100 dark:border-sky-900/30 flex items-start gap-2.5 text-sky-900 dark:text-sky-300 text-xs">
              <Info className="w-4 h-4 text-[#0071E3] shrink-0 mt-0.5" />
              <p className="leading-relaxed">
                <strong>Consejo de instalación:</strong> Plastifica o enmarca la ficha en un protector acrílico a 1.40 m del suelo cerca del acceso al área o sobre el tablero principal de los equipos para garantizar un escaneo rápido y sin reflejos.
              </p>
            </div>

          </div>

          {/* RIGHT COLUMN: Live Interactive Badge Preview */}
          <div className="lg:col-span-7 flex flex-col items-center justify-center bg-zinc-100/70 dark:bg-black/60 p-4 sm:p-6 rounded-3xl border border-zinc-200/80 dark:border-zinc-800">
            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400 dark:text-zinc-500 mb-3 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              Vista Previa de Impresión
            </span>

            {/* The Badge Card Container */}
            <div 
              ref={previewCardRef}
              className={`bg-white text-zinc-900 rounded-2xl shadow-xl transition-all duration-300 w-full max-w-sm flex flex-col items-center border-[3px] ${
                theme === 'brand' ? 'border-[#0071E3]' : theme === 'emerald' ? 'border-emerald-600' : 'border-zinc-900'
              } p-4 sm:p-5 text-center relative select-none`}
            >
              {/* Inner dashed perimeter cut-line */}
              <div className="w-full h-full border border-dashed border-zinc-300 rounded-xl p-3 flex flex-col items-center">
                
                {/* Header */}
                <div className="w-full flex items-center justify-between border-b-2 border-zinc-900 pb-2.5 mb-3">
                  <div className="flex flex-col items-start">
                    <img src="/logo.png" alt="CheKify Logo" className="h-6 w-auto object-contain" />
                    <span className="text-[8px] font-black tracking-widest text-sky-600 uppercase mt-0.5">
                      Punto de Inspección Oficial
                    </span>
                  </div>
                  <span className="text-[9px] font-extrabold uppercase bg-zinc-100 text-zinc-700 px-2 py-1 rounded-md border border-zinc-200">
                    {plantName}
                  </span>
                </div>

                {/* Area Designation */}
                <div className="mb-2">
                  <span className="text-[9px] font-black uppercase tracking-widest text-zinc-400 block">
                    Área Designada
                  </span>
                  <h2 className="text-xl sm:text-2xl font-black text-zinc-900 uppercase tracking-tight leading-tight my-1">
                    {currentArea?.name}
                  </h2>
                  <div className="inline-block bg-zinc-100 border border-zinc-300 rounded-md px-2.5 py-0.5 text-xs font-mono font-extrabold text-zinc-800">
                    CÓDIGO: {qrValue}
                  </div>
                </div>

                {/* QR Code Canvas with CheKify Logo */}
                <div ref={qrCanvasRef} className="my-2 p-2.5 bg-white border-2 border-zinc-900 rounded-2xl shadow-xs">
                  <QRCodeCanvas
                    id="area-qr-canvas"
                    value={qrValue}
                    size={format === 'sticker' ? 180 : 210}
                    level="H" // High error correction (30%)
                    marginSize={1}
                    imageSettings={withLogo ? {
                      src: "/logo_small.png",
                      height: 48,
                      width: 48,
                      excavate: true,
                    } : undefined}
                  />
                </div>

                {/* Optional Detailed Equipments Section */}
                {format === 'detailed' && areaEquip.length > 0 && (
                  <div className="w-full my-2 p-2 bg-zinc-50 border border-zinc-200 rounded-xl text-left">
                    <div className="text-[9px] font-black uppercase text-zinc-500 mb-1 flex items-center gap-1">
                      <Wrench className="w-3 h-3 text-sky-500" />
                      <span>Equipos en esta área ({areaEquip.length}):</span>
                    </div>
                    <div className="flex flex-wrap gap-1 max-h-20 overflow-y-auto">
                      {areaEquip.map((eq, i) => (
                        <span key={eq.id || i} className="text-[9px] font-bold bg-white px-1.5 py-0.5 rounded border border-zinc-200 text-zinc-700">
                          {eq.name}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Instructions */}
                <div className="w-full mt-auto pt-3 border-t border-zinc-200 space-y-1.5">
                  <div className="grid grid-cols-3 gap-1 text-[9px] font-bold text-zinc-600">
                    <div className="flex items-center gap-1 justify-center">
                      <span className="w-4 h-4 rounded-full bg-zinc-900 text-white text-[8px] flex items-center justify-center font-bold">1</span>
                      <span>Abre CheKify</span>
                    </div>
                    <div className="flex items-center gap-1 justify-center">
                      <span className="w-4 h-4 rounded-full bg-zinc-900 text-white text-[8px] flex items-center justify-center font-bold">2</span>
                      <span>Escanea QR</span>
                    </div>
                    <div className="flex items-center gap-1 justify-center">
                      <span className="w-4 h-4 rounded-full bg-zinc-900 text-white text-[8px] flex items-center justify-center font-bold">3</span>
                      <span>Inspecciona</span>
                    </div>
                  </div>
                  <div className="flex justify-between items-center text-[7.5px] text-zinc-400 font-semibold pt-1">
                    <span>Protocolo de Inspección Industrial</span>
                    <span>Trazabilidad Operativa</span>
                  </div>
                </div>

              </div>
            </div>

            {/* Format specifier notice */}
            <p className="text-[11px] text-zinc-400 mt-3 text-center">
              Tamaño óptimo recomendado para impresión: {format === 'sticker' ? '10 x 10 cm' : '10 x 15 cm (A6) o 15 x 21 cm (A5)'}
            </p>
          </div>

        </div>

        {/* Batch Selection Drawer (When in Batch Mode) */}
        {isBatchMode && (
          <div className="p-4 bg-zinc-50 dark:bg-zinc-900/90 border-t border-zinc-200 dark:border-zinc-800">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                Selecciona las áreas a incluir en la impresión por lote:
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedBatchIds(allAreas.map(a => a.id))}
                  className="text-[11px] font-bold text-[#0071E3] hover:underline"
                >
                  Seleccionar Todas
                </button>
                <span className="text-zinc-300 dark:text-zinc-700">|</span>
                <button
                  type="button"
                  onClick={() => setSelectedBatchIds([])}
                  className="text-[11px] font-bold text-zinc-500 hover:underline"
                >
                  Deseleccionar
                </button>
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 max-h-32 overflow-y-auto pr-1">
              {allAreas.map(a => {
                const isChecked = selectedBatchIds.includes(a.id);
                return (
                  <label
                    key={a.id}
                    className={`flex items-center gap-2 p-2 rounded-xl border text-xs cursor-pointer transition-colors ${
                      isChecked 
                        ? 'bg-sky-50 dark:bg-sky-950/30 border-sky-300 dark:border-sky-800 text-sky-900 dark:text-sky-200 font-bold' 
                        : 'bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedBatchIds(prev => [...prev, a.id]);
                        } else {
                          setSelectedBatchIds(prev => prev.filter(id => id !== a.id));
                        }
                      }}
                      className="w-3.5 h-3.5 text-[#0071E3] rounded-md focus:ring-0"
                    />
                    <span className="truncate">{a.name}</span>
                  </label>
                );
              })}
            </div>
          </div>
        )}

      </motion.div>
    </div>
  );
};
