import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  QrCode, 
  Printer, 
  Download, 
  FileDown, 
  Copy, 
  Check, 
  X, 
  Layers, 
  Sparkles, 
  Wrench, 
  Info,
  CheckCircle2,
  FileText
} from 'lucide-react';
import { QRCodeCanvas, QRCodeSVG } from 'qrcode.react';
import { toPng } from 'html-to-image';
import { jsPDF } from 'jspdf';
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

// Cache for base64 converted logos to prevent foreignObject CORS / taint issues
let cachedFullLogoDataUrl: string | null = null;
let cachedSmallLogoDataUrl: string | null = null;

const convertImgToDataUrl = (src: string, targetWidth: number, targetHeight: number): Promise<string> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth || targetWidth;
        canvas.height = img.naturalHeight || targetHeight;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0);
          resolve(canvas.toDataURL('image/png'));
          return;
        }
      } catch (e) {
        console.warn('Canvas export error for logo:', e);
      }
      resolve(src);
    };
    img.onerror = () => resolve(src);
    img.src = src;
  });
};

const loadFullLogoAsDataUrl = async (): Promise<string> => {
  if (cachedFullLogoDataUrl) return cachedFullLogoDataUrl;
  cachedFullLogoDataUrl = await convertImgToDataUrl('/logo.png', 1536, 400);
  return cachedFullLogoDataUrl;
};

const loadSmallLogoAsDataUrl = async (): Promise<string> => {
  if (cachedSmallLogoDataUrl) return cachedSmallLogoDataUrl;
  cachedSmallLogoDataUrl = await convertImgToDataUrl('/logo_small.png?v=2', 120, 120);
  return cachedSmallLogoDataUrl;
};

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
  const [isBatchMode, setIsBatchMode] = useState(false);
  const [selectedBatchIds, setSelectedBatchIds] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);
  const [isGeneratingPNG, setIsGeneratingPNG] = useState(false);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const [fullLogoDataUrl, setFullLogoDataUrl] = useState<string>('/logo.png');
  const [smallLogoDataUrl, setSmallLogoDataUrl] = useState<string>('/logo_small.png');
  const [feedbackMsg, setFeedbackMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const previewCardRef = useRef<HTMLDivElement>(null);

  // Preload base64 logos on mount/open
  useEffect(() => {
    let isMounted = true;
    Promise.all([loadFullLogoAsDataUrl(), loadSmallLogoAsDataUrl()]).then(([fullUri, smallUri]) => {
      if (isMounted) {
        setFullLogoDataUrl(fullUri);
        setSmallLogoDataUrl(smallUri);
      }
    });
    return () => { isMounted = false; };
  }, []);

  useEffect(() => {
    if (area) {
      setCurrentArea(area);
      setSelectedBatchIds(allAreas.map(a => a.id));
    }
  }, [area, allAreas]);

  useEffect(() => {
    if (feedbackMsg) {
      const timer = setTimeout(() => setFeedbackMsg(null), 3500);
      return () => clearTimeout(timer);
    }
  }, [feedbackMsg]);

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
      borderClass: 'border-[#0071E3]',
      textClass: 'text-[#0071E3]',
      headerBg: '#0071E3',
      accentColor: '#0A84FF',
      hexBorder: '#0071E3',
      hexBg: '#F0F7FF'
    },
    emerald: {
      primary: '#059669',
      borderClass: 'border-emerald-600',
      textClass: 'text-emerald-600',
      headerBg: '#059669',
      accentColor: '#10B981',
      hexBorder: '#059669',
      hexBg: '#ECFDF5'
    },
    monochrome: {
      primary: '#18181B',
      borderClass: 'border-zinc-900',
      textClass: 'text-zinc-900',
      headerBg: '#18181B',
      accentColor: '#27272A',
      hexBorder: '#18181B',
      hexBg: '#F4F4F5'
    }
  };

  const currentTheme = themeColors[theme];

  // 1. DOWNLOAD EXACT PREVIEW AS PNG
  const handleDownloadPNG = async () => {
    if (!previewCardRef.current || !currentArea) return;
    setIsGeneratingPNG(true);

    try {
      // Ensure all images are loaded
      await new Promise(r => setTimeout(r, 100));

      const dataUrl = await toPng(previewCardRef.current, {
        pixelRatio: 3, // 300 DPI high-resolution
        cacheBust: true,
        backgroundColor: '#ffffff'
      });

      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = `Ficha-QR-${currentArea.name.replace(/[^a-zA-Z0-9]/g, '_')}-${format}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setFeedbackMsg({ text: 'Imagen PNG descargada idéntica a la vista previa', type: 'success' });
    } catch (e: any) {
      console.error('Error generating exact PNG:', e);
      setFeedbackMsg({ text: 'Error al generar la imagen PNG. Puedes descargar el PDF.', type: 'error' });
    } finally {
      setIsGeneratingPNG(false);
    }
  };

  // 2. DOWNLOAD AS PDF SIZED FOR HOJA TAMAÑO CARTA (Letter: 215.9 x 279.4 mm)
  const handleDownloadPDF = async () => {
    if (!previewCardRef.current || !currentArea) return;
    setIsGeneratingPDF(true);

    try {
      await new Promise(r => setTimeout(r, 100));

      // Capture exact preview card at 3x resolution
      const cardPng = await toPng(previewCardRef.current, {
        pixelRatio: 3,
        cacheBust: true,
        backgroundColor: '#ffffff'
      });

      // Initialize PDF in Carta format (Letter: 215.9 x 279.4 mm)
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'letter'
      });

      const pageWidth = 215.9;
      const pageHeight = 279.4;

      // Calculate placement: Center card on Carta page
      const imgProps = pdf.getImageProperties(cardPng);
      const imgAspect = imgProps.width / imgProps.height;

      // Scale to fit comfortably on Carta sheet
      let printW = format === 'sticker' ? 140 : 170;
      let printH = printW / imgAspect;

      if (printH > 240) {
        printH = 240;
        printW = printH * imgAspect;
      }

      const posX = (pageWidth - printW) / 2;
      const posY = (pageHeight - printH) / 2 - 5;

      // Draw subtle corner cut marks (guías de corte)
      pdf.setDrawColor(180, 190, 205);
      pdf.setLineWidth(0.3);
      const markLen = 6;

      // Top-left
      pdf.line(posX - 4, posY, posX - 4 - markLen, posY);
      pdf.line(posX, posY - 4, posX, posY - 4 - markLen);
      // Top-right
      pdf.line(posX + printW + 4, posY, posX + printW + 4 + markLen, posY);
      pdf.line(posX + printW, posY - 4, posX + printW, posY - 4 - markLen);
      // Bottom-left
      pdf.line(posX - 4, posY + printH, posX - 4 - markLen, posY + printH);
      pdf.line(posX, posY + printH + 4, posX, posY + printH + 4 + markLen);
      // Bottom-right
      pdf.line(posX + printW + 4, posY + printH, posX + printW + 4 + markLen, posY + printH);
      pdf.line(posX + printW, posY + printH + 4, posX + printW, posY + printH + 4 + markLen);

      // Add the exact card image to the PDF
      pdf.addImage(cardPng, 'PNG', posX, posY, printW, printH);

      // Add Carta footer note
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(8);
      pdf.setTextColor(140, 150, 165);
      pdf.text(
        'CheKify • Sistema Inteligente de Inspecciones Industriales • Ficha Oficial para Instalación (Hoja Tamaño Carta)',
        pageWidth / 2,
        pageHeight - 10,
        { align: 'center' }
      );

      const filename = `Ficha-QR-${currentArea.name.replace(/[^a-zA-Z0-9]/g, '_')}-Carta.pdf`;
      pdf.save(filename);
      setFeedbackMsg({ text: 'PDF en Hoja Tamaño Carta descargado correctamente', type: 'success' });
    } catch (e: any) {
      console.error('Error generating Letter PDF:', e);
      setFeedbackMsg({ text: 'Error al generar el PDF.', type: 'error' });
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  // 3. PRINT USING HIDDEN IFRAME (No window.open, keeps logo in QR center & Letter format)
  const handlePrint = async () => {
    if (!previewCardRef.current || !currentArea) return;
    setIsPrinting(true);

    try {
      await new Promise(r => setTimeout(r, 100));

      // Generate exact high-res PNG of the card
      const cardPng = await toPng(previewCardRef.current, {
        pixelRatio: 3,
        cacheBust: true,
        backgroundColor: '#ffffff'
      });

      // Use a hidden iframe for 100% reliable printing without window.open or popup blockers
      const existingIframe = document.getElementById('chekify-print-frame');
      if (existingIframe) existingIframe.remove();

      const printIframe = document.createElement('iframe');
      printIframe.id = 'chekify-print-frame';
      printIframe.style.position = 'fixed';
      printIframe.style.right = '0';
      printIframe.style.bottom = '0';
      printIframe.style.width = '0';
      printIframe.style.height = '0';
      printIframe.style.border = '0';
      document.body.appendChild(printIframe);

      const iframeDoc = printIframe.contentWindow?.document;
      if (!iframeDoc) {
        throw new Error('No se pudo inicializar el servicio de impresión.');
      }

      iframeDoc.open();
      iframeDoc.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Ficha QR - ${currentArea.name} (Tamaño Carta)</title>
            <meta charset="utf-8" />
            <style>
              @page {
                size: letter portrait;
                margin: 12mm;
              }
              * {
                box-sizing: border-box;
                margin: 0;
                padding: 0;
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
              }
              body {
                background: #ffffff;
                color: #0f172a;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                min-height: 100vh;
                padding: 10px;
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
              }
              .sheet-container {
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                width: 100%;
                max-width: 180mm;
                page-break-inside: avoid;
              }
              .exact-card-img {
                width: 100%;
                max-width: 175mm;
                height: auto;
                display: block;
                border-radius: 16px;
                box-shadow: none;
              }
              .cut-instructions {
                margin-top: 14px;
                font-size: 10px;
                font-weight: 700;
                color: #64748b;
                text-align: center;
                letter-spacing: 0.5px;
              }
            </style>
          </head>
          <body>
            <div class="sheet-container">
              <img src="${cardPng}" class="exact-card-img" alt="Ficha QR CheKify" />
              <div class="cut-instructions">
                ✂️ Corta por la línea punteada e instala a 1.40 m de altura en el área o sobre el tablero principal • Tamaño Carta (Letter)
              </div>
            </div>
          </body>
        </html>
      `);
      iframeDoc.close();

      // Wait for image in iframe to load then trigger print
      setTimeout(() => {
        printIframe.contentWindow?.focus();
        printIframe.contentWindow?.print();
        setIsPrinting(false);
        setTimeout(() => printIframe.remove(), 2000);
      }, 350);

    } catch (e: any) {
      console.error('Error during print preparation:', e);
      setFeedbackMsg({ text: 'Error al preparar la impresión.', type: 'error' });
      setIsPrinting(false);
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
                  Tamaño Carta
                </span>
              </div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Imprime o descarga fichas con el logo oficial de CheKify en el centro del QR
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

        {/* Feedback Alert if any */}
        {feedbackMsg && (
          <div className={`px-4 py-2 text-xs font-bold flex items-center justify-between ${
            feedbackMsg.type === 'success' 
              ? 'bg-emerald-500 text-white' 
              : 'bg-red-500 text-white'
          }`}>
            <span>{feedbackMsg.text}</span>
            <button onClick={() => setFeedbackMsg(null)} className="opacity-80 hover:opacity-100">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Area selector dropdown */}
        {allAreas.length > 1 && (
          <div className="px-4 py-2.5 bg-zinc-100/60 dark:bg-zinc-900/30 border-b border-zinc-200 dark:border-zinc-800 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold text-zinc-500 uppercase">Área Seleccionada:</span>
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
            <div className="text-[11px] font-bold text-zinc-400">
              Formato de Impresión: <strong className="text-zinc-700 dark:text-zinc-300">Carta (Letter 8.5" × 11")</strong>
            </div>
          </div>
        )}

        {/* Modal Main Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* LEFT COLUMN: Controls & Customization */}
          <div className="lg:col-span-5 space-y-4">
            
            {/* Format Selection */}
            <div className="space-y-2">
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
                  <span className="text-[11px] font-bold">Placa Carta</span>
                  <span className="text-[9px] opacity-75">17 × 23 cm</span>
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
                  <div className="w-7 h-7 border-2 border-current rounded-md flex items-center justify-center">
                    <QrCode className="w-3.5 h-3.5" />
                  </div>
                  <span className="text-[11px] font-bold">Sticker Carta</span>
                  <span className="text-[9px] opacity-75">14 × 14 cm</span>
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
                  <div className="w-6 h-8 border-2 border-current rounded-sm flex flex-col items-center justify-around p-0.5">
                    <QrCode className="w-2.5 h-2.5" />
                    <div className="w-4 h-0.5 bg-current rounded-full" />
                  </div>
                  <span className="text-[11px] font-bold">Con Equipos</span>
                  <span className="text-[9px] opacity-75">Hoja Carta</span>
                </button>
              </div>
            </div>

            {/* Customization Options */}
            <div className="space-y-3 p-3.5 bg-zinc-50 dark:bg-zinc-900/60 rounded-2xl border border-zinc-200 dark:border-zinc-800">
              <label className="text-xs font-black uppercase tracking-wider text-zinc-500 dark:text-zinc-400 block">
                2. Personalización
              </label>

              {/* Logo in QR switch */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-zinc-800 dark:text-zinc-200">Logo CheKify en QR</p>
                  <p className="text-[10px] text-zinc-500">Centrado con corrección de errores nivel H (30%)</p>
                </div>
                <button
                  type="button"
                  onClick={() => setWithLogo(!withLogo)}
                  className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
                    withLogo ? 'bg-[#0071E3]' : 'bg-zinc-300 dark:bg-zinc-700'
                  }`}
                >
                  <div className={`w-5 h-5 rounded-full bg-white transition-transform ${
                    withLogo ? 'translate-x-5' : 'translate-x-0.5'
                  }`} />
                </button>
              </div>

              {/* Theme Selector */}
              <div className="pt-2 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
                <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200">Estilo de Color:</span>
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    onClick={() => setTheme('brand')}
                    className={`flex-1 py-1.5 px-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 border transition-all cursor-pointer ${
                      theme === 'brand' 
                        ? 'border-[#0071E3] bg-[#0071E3] text-white shadow-xs' 
                        : 'border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300'
                    }`}
                  >
                    <span className="w-2.5 h-2.5 rounded-full bg-[#0071E3] inline-block" />
                    <span>Azul</span>
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
                    <span>Verde</span>
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

            {/* Action Buttons Panel */}
            <div className="space-y-2 pt-1">
              <label className="text-xs font-black uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                3. Descarga e Impresión (Hoja Carta)
              </label>

              {/* Primary: Download PDF in Carta size */}
              <button
                type="button"
                onClick={handleDownloadPDF}
                disabled={isGeneratingPDF}
                className="w-full py-3.5 px-4 bg-emerald-600 hover:bg-emerald-500 active:scale-98 text-white rounded-2xl font-black text-sm flex items-center justify-center gap-2.5 shadow-lg shadow-emerald-600/20 transition-all cursor-pointer disabled:opacity-50"
              >
                <FileDown className="w-5 h-5" />
                <span>{isGeneratingPDF ? 'Generando PDF...' : 'Descargar PDF (Tamaño Carta)'}</span>
              </button>

              <div className="grid grid-cols-2 gap-2">
                {/* Print Direct */}
                <button
                  type="button"
                  onClick={handlePrint}
                  disabled={isPrinting}
                  className="py-3 px-3 bg-[#0071E3] hover:bg-[#0077ED] text-white rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-md shadow-blue-500/15 active:scale-98 transition-all cursor-pointer disabled:opacity-50"
                >
                  <Printer className="w-4 h-4" />
                  <span>{isPrinting ? 'Imprimiendo...' : 'Imprimir Ficha'}</span>
                </button>

                {/* Download Exact PNG */}
                <button
                  type="button"
                  onClick={handleDownloadPNG}
                  disabled={isGeneratingPNG}
                  className="py-3 px-3 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-900 dark:text-white rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer border border-zinc-200 dark:border-zinc-700 disabled:opacity-50"
                >
                  <Download className="w-4 h-4 text-sky-500" />
                  <span>{isGeneratingPNG ? 'Generando...' : 'Descargar PNG'}</span>
                </button>
              </div>

              {/* Copy Code Button */}
              <button
                type="button"
                onClick={handleCopyCode}
                className="w-full py-2 px-3 text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-500" />
                    <span className="text-emerald-500">¡Código copiado al portapapeles!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copiar Código: {qrValue}</span>
                  </>
                )}
              </button>
            </div>

            {/* Advice notice */}
            <div className="p-3 bg-sky-50/70 dark:bg-sky-950/20 rounded-2xl border border-sky-100 dark:border-sky-900/30 flex items-start gap-2 text-sky-900 dark:text-sky-300 text-xs">
              <Info className="w-4 h-4 text-[#0071E3] shrink-0 mt-0.5" />
              <p className="leading-relaxed text-[11px]">
                <strong>Hoja Carta Lista:</strong> El PDF y la función de imprimir están adaptados para <strong>Hoja Tamaño Carta (Letter: 21.6 × 27.9 cm)</strong>. Al imprimir o descargar en PNG, el logo central de CheKify se mantiene exactamente igual a la vista previa.
              </p>
            </div>

          </div>

          {/* RIGHT COLUMN: Live Interactive Badge Preview (Exact Card) */}
          <div className="lg:col-span-7 flex flex-col items-center justify-center bg-zinc-100/70 dark:bg-black/60 p-4 sm:p-6 rounded-3xl border border-zinc-200/80 dark:border-zinc-800">
            <div className="flex items-center justify-between w-full mb-3 px-1">
              <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400 dark:text-zinc-500 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                Vista Previa de Impresión
              </span>
              <span className="text-[10px] font-bold text-zinc-500 bg-white dark:bg-zinc-900 px-2.5 py-0.5 rounded-full border border-zinc-200 dark:border-zinc-800">
                {format === 'placard' ? 'Placa Carta 17 × 23 cm' : format === 'sticker' ? 'Sticker 14 × 14 cm' : 'Ficha Carta con Equipos'}
              </span>
            </div>

            {/* THE EXACT BADGE CARD (Captured for PNG and Print) */}
            <div 
              ref={previewCardRef}
              id="printable-preview-card"
              className={`bg-white text-zinc-900 rounded-3xl shadow-xl transition-all duration-300 w-full max-w-[360px] flex flex-col items-center border-[3.5px] ${currentTheme.borderClass} p-4 sm:p-5 text-center relative select-none`}
            >
              {/* Inner dashed perimeter cut-line */}
              <div className="w-full h-full border-2 border-dashed border-zinc-300 rounded-2xl p-3.5 flex flex-col items-center bg-white">
                
                {/* Header with CheKify Logo */}
                <div className="w-full flex items-center justify-between border-b-2 border-zinc-900 pb-2.5 mb-3 gap-2">
                  <div className="flex flex-col items-start">
                    <img 
                      src={fullLogoDataUrl || "/logo.png"} 
                      alt="CheKify Logo" 
                      className="h-8 sm:h-9 w-auto max-w-[170px] sm:max-w-[210px] object-contain object-left"
                      crossOrigin="anonymous" 
                    />
                    <span className="text-[8px] font-black tracking-widest text-sky-600 uppercase mt-0.5">
                      PUNTO DE INSPECCIÓN OFICIAL
                    </span>
                  </div>
                  <span className="text-[9px] font-extrabold uppercase bg-zinc-100 text-zinc-700 px-2 py-1 rounded-md border border-zinc-200 shrink-0">
                    {plantName}
                  </span>
                </div>

                {/* Area Designation */}
                <div className="mb-2">
                  <span className="text-[9px] font-black uppercase tracking-widest text-zinc-400 block">
                    ÁREA DESIGNADA
                  </span>
                  <h2 className="text-xl sm:text-2xl font-black text-zinc-900 uppercase tracking-tight leading-tight my-1">
                    {currentArea?.name}
                  </h2>
                  <div className="inline-block bg-zinc-100 border border-zinc-300 rounded-md px-2.5 py-0.5 text-xs font-mono font-extrabold text-zinc-800">
                    CÓDIGO: {qrValue}
                  </div>
                </div>

                {/* QR Code Canvas with Guaranteed CheKify Centered Logo */}
                <div className="my-2 p-2.5 bg-white border-2 border-zinc-900 rounded-2xl shadow-xs relative flex items-center justify-center">
                  <QRCodeCanvas
                    id="area-qr-canvas"
                    data-value={qrValue}
                    value={qrValue}
                    size={format === 'sticker' ? 180 : 210}
                    level="H" // High error correction (30%)
                    marginSize={1}
                    imageSettings={withLogo ? {
                      src: smallLogoDataUrl || "/logo_small.png",
                      height: 48,
                      width: 48,
                      excavate: true,
                    } : undefined}
                  />

                  {/* DOM Centered Logo Overlay: Guarantees logo is NEVER missing in live preview, prints, or exports */}
                  {withLogo && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <div className="w-12 h-12 bg-white rounded-xl shadow-xs border-2 border-white flex items-center justify-center p-1">
                        <img 
                          src={smallLogoDataUrl || "/logo_small.png"} 
                          alt="Logo QR" 
                          className="w-full h-full object-contain"
                          crossOrigin="anonymous" 
                        />
                      </div>
                    </div>
                  )}
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

            {/* Scale indicator */}
            <p className="text-[11px] text-zinc-400 mt-3 text-center">
              Ajustada proporcionalmente para caber limpia y centrada en una <strong>hoja tamaño carta</strong>.
            </p>
          </div>

        </div>

      </motion.div>
    </div>
  );
};
