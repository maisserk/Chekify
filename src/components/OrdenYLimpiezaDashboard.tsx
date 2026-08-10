/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { FindingPhotoGallery, FindingPhotoThumbnails, extractFindingPhotos } from './FindingPhotoGallery';
import { FindingDescriptionRenderer } from './FindingDescriptionRenderer';
import { OperatingStatusBadge } from './OperatingStatusBadge';
import { 
  Sparkles, 
  Search, 
  Filter, 
  Download, 
  FileText, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  ChevronRight, 
  X, 
  Trash2, 
  BarChart3, 
  Calendar as CalendarIcon,
  Compass,
  Activity,
  Plus,
  HelpCircle,
  Share2
} from 'lucide-react';
import { useAppUsers } from '../hooks/useAppUsers';
import { QuickHelpModal } from './QuickHelpModal';
import { getFindingDate, getFindingClosedDate, formatToDatetimeLocal, getCalculatedMTTRText, parseAnyDate } from '../utils/dateUtils';
import { 
  doc, 
  getDoc, 
  deleteDoc, 
  addDoc, 
  collection, 
  serverTimestamp 
} from 'firebase/firestore';
import { db } from '../firebase';
import { Finding, AppUser, ReportSettings } from '../types';
import { FindingService } from '../services/FindingService';
import { OfflineImage } from './OfflineImage';
import { sanitizeForPDF } from '../utils/textSanitizer';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { motion, AnimatePresence } from 'motion/react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { downloadOperatorInspectionPDF, shareOperatorInspectionPDF } from '../utils/generateOperatorInspectionPDF';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Cell
} from 'recharts';

export const isOrdenYLimpiezaFinding = (f: Finding): boolean => {
  if (!f) return false;
  if (f.source === 'OrdenYLimpieza' || (f as any).category === 'OrdenYLimpieza') return true;
  const desc = (f.description || '').toUpperCase();
  if (desc.includes('[ORDEN]') || desc.includes('ORDEN Y LIMPIEZA') || desc.includes('ORDEN Y LIMPIEZA:')) {
    return true;
  }
  return false;
};

export const isVOSOFinding = (f: Finding): boolean => {
  return !isOrdenYLimpiezaFinding(f);
};

export const getOrdenSubcategory = (desc: string): string => {
  const u = (desc || '').toUpperCase();
  if (u.includes('RESIDUO') || u.includes('DESECHO') || u.includes('BASURA')) return 'Residuos';
  if (u.includes('HERRAMIENTA') || u.includes('FUERA DE LUGAR')) return 'Herramientas';
  if (u.includes('DERRAME') || u.includes('ACEITE') || u.includes('LUBRICANTE') || u.includes('FLUIDO')) return 'Derrames';
  if (u.includes('OBSTRUCC') || u.includes('ACCESO') || u.includes('PASILLO')) return 'Obstrucciones';
  if (u.includes('LIMPIEZA') || u.includes('SUCIO') || u.includes('POLVO')) return 'Limpieza';
  return 'General 5S';
};

const showToast = (title: string, message: string, type: 'success' | 'error' | 'info' | 'warning') => {
  window.dispatchEvent(new CustomEvent('app-toast', {
    detail: { title, message, type }
  }));
};

export const exportFindingsToCSV = (findingsList: Finding[], filenamePrefix: string = 'reporte-orden-limpieza') => {
  if (findingsList.length === 0) {
    alert("No hay hallazgos de Orden y Limpieza para exportar.");
    return;
  }
  try {
    const headers = [
      "ID",
      "Fecha Reporte",
      "Planta ID",
      "Área",
      "Subcategoría 5S",
      "Equipo",
      "Operador",
      "Descripción / Hallazgo",
      "Prioridad",
      "Estado",
      "Hora Inicio Área",
      "Hora Fin Área",
      "Duración Área (seg)",
      "Hora Inicio Equipo",
      "Hora Fin Equipo",
      "Duración Equipo (seg)",
      "Fecha Cierre",
      "Horas de Cierre (MTTR)",
      "Comentarios Supervisor / Solución"
    ];

    const escapeCSV = (val: any) => {
      if (val === null || val === undefined) return '';
      let str = String(val).replace(/"/g, '""');
      if (str.includes(',') || str.includes('\n') || str.includes('\r') || str.includes('"')) {
        str = `"${str}"`;
      }
      return str;
    };

    const rows = [headers.join(",")];
    findingsList.forEach(f => {
      const fDate = getFindingDate(f);
      const dateStr = fDate ? format(fDate, 'dd/MM/yyyy HH:mm:ss') : '';
      
      const closedDate = getFindingClosedDate(f);
      const closedStr = closedDate ? format(closedDate, 'dd/MM/yyyy HH:mm:ss') : '';

      let resolutionHours = '';
      if (fDate && closedDate) {
        const startTime = fDate.getTime();
        const endTime = closedDate.getTime();
        if (endTime >= startTime) {
          resolutionHours = (Math.round((endTime - startTime) / (1000 * 60 * 60) * 10) / 10).toString();
        }
      }

      const areaStart = parseAnyDate(f.inspectionStartedAt);
      const areaEnd = parseAnyDate(f.inspectionCompletedAt);
      const equipStart = parseAnyDate(f.equipmentStartedAt);
      const equipEnd = parseAnyDate(f.equipmentCompletedAt);

      const areaStartStr = areaStart ? format(areaStart, 'HH:mm:ss') : '';
      const areaEndStr = areaEnd ? format(areaEnd, 'HH:mm:ss') : '';
      const equipStartStr = equipStart ? format(equipStart, 'HH:mm:ss') : '';
      const equipEndStr = equipEnd ? format(equipEnd, 'HH:mm:ss') : '';

      const row = [
        escapeCSV(f.id),
        escapeCSV(dateStr),
        escapeCSV(f.plantId || ''),
        escapeCSV(f.areaName || 'Área General'),
        escapeCSV(getOrdenSubcategory(f.description)),
        escapeCSV(f.equipmentName || 'Puntos Generales de Inspección'),
        escapeCSV(f.operatorName || ''),
        escapeCSV(f.description),
        escapeCSV(f.priority || 'N/A'),
        escapeCSV(f.status === 'Open' ? 'Abierto' : f.status === 'InReview' ? 'En Revisión' : 'Cerrado'),
        escapeCSV(areaStartStr),
        escapeCSV(areaEndStr),
        escapeCSV(f.inspectionDurationSeconds !== undefined && f.inspectionDurationSeconds !== null ? f.inspectionDurationSeconds : ''),
        escapeCSV(equipStartStr),
        escapeCSV(equipEndStr),
        escapeCSV(f.equipmentDurationSeconds !== undefined && f.equipmentDurationSeconds !== null ? f.equipmentDurationSeconds : ''),
        escapeCSV(closedStr),
        escapeCSV(resolutionHours),
        escapeCSV(f.supervisorComments || f.solution || '')
      ];
      rows.push(row.join(","));
    });

    const csvContent = "\uFEFF" + rows.join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `${filenamePrefix}-${format(new Date(), 'yyyyMMdd_HHmmss')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } catch (err) {
    console.error("Error exporting CSV:", err);
    alert("Error al exportar los hallazgos a CSV.");
  }
};

export const exportFindingsToPDF = async (findingsList: Finding[], title: string = 'Reporte de Orden y Limpieza', filename: string = 'reporte-orden-limpieza') => {
  if (findingsList.length === 0) {
    alert("No hay hallazgos de Orden y Limpieza para exportar en PDF.");
    return;
  }
  try {
    const settingsDoc = await getDoc(doc(db, 'settings', 'reportConfig'));
    const sett = settingsDoc.exists() ? settingsDoc.data() as ReportSettings : {};

    const docPDF = new jsPDF();
    docPDF.setFontSize(18);
    docPDF.setTextColor(147, 51, 234); // Purple 5S brand
    docPDF.text(sanitizeForPDF(sett.companyName || title, 40), 14, 22);

    docPDF.setFontSize(10);
    docPDF.setTextColor(113, 113, 122);
    docPDF.text(sanitizeForPDF(sett.headerText || 'Módulo Especializado de Orden y Limpieza (5S / Housekeeping)', 80), 14, 30);
    docPDF.text(`Generado el: ${format(new Date(), 'dd/MM/yyyy HH:mm:ss')}`, 14, 36);

    if (sett.logoUrl) {
      try {
        docPDF.addImage(sett.logoUrl, 'JPEG', 160, 10, 35, 35);
      } catch (e) {}
    }

    const tableData = findingsList.map(f => {
      const fDate = getFindingDate(f);
      const dateStr = fDate ? format(fDate, 'dd/MM/yy HH:mm') : '-';
      return [
        dateStr,
        sanitizeForPDF(f.areaName),
        sanitizeForPDF(getOrdenSubcategory(f.description)),
        sanitizeForPDF(f.operatorName),
        sanitizeForPDF(f.description, 0),
        f.status === 'Open' ? 'Pendiente' : f.status === 'InReview' ? 'En Revisión' : 'Cerrado',
        f.closedAt?.toDate ? format(f.closedAt.toDate(), 'dd/MM/yy HH:mm') : '-'
      ];
    });

    autoTable(docPDF, {
      startY: 45,
      head: [['Fecha', 'Área', 'Subcategoría', 'Operador', 'Descripción y Detalle', 'Estado', 'Cierre']],
      body: tableData,
      theme: 'striped',
      headStyles: { fillColor: [147, 51, 234], textColor: [255, 255, 255], fontStyle: 'bold' },
      styles: { fontSize: 8, cellPadding: 3, overflow: 'linebreak' },
      columnStyles: {
        0: { cellWidth: 22 },
        1: { cellWidth: 25 },
        2: { cellWidth: 22 },
        3: { cellWidth: 22 },
        4: { cellWidth: 'auto' },
        5: { cellWidth: 18 },
        6: { cellWidth: 22 }
      },
      margin: { top: 45 }
    });

    const pageCount = (docPDF as any).internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      docPDF.setPage(i);
      docPDF.setFontSize(8);
      docPDF.setTextColor(161, 161, 170);
      docPDF.text(
        sanitizeForPDF(sett.footerText || 'Reporte oficial del Módulo de Orden y Limpieza (5S).', 90),
        14, 
        docPDF.internal.pageSize.height - 10
      );
      docPDF.text(`Página ${i} de ${pageCount}`, docPDF.internal.pageSize.width - 30, docPDF.internal.pageSize.height - 10);
    }

    docPDF.save(`${filename}-${format(new Date(), 'yyyyMMdd')}.pdf`);
  } catch (err) {
    console.error("Error generating PDF", err);
    alert("Error al generar el PDF de Orden y Limpieza.");
  }
};

export const OrdenYLimpiezaDashboard = ({
  user,
  initialFindingId,
  onClearPending
}: {
  user: AppUser;
  initialFindingId?: string | null;
  onClearPending?: () => void;
}) => {
  const { getOperatorProfile } = useAppUsers();
  const [allFindings, setAllFindings] = useState<Finding[]>([]);
  const [filter, setFilter] = useState<'All' | 'Open' | 'Closed' | 'InReview'>('Open');
  const [subcatFilter, setSubcatFilter] = useState<string>('All');
  const [selectedFinding, setSelectedFinding] = useState<Finding | null>(null);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [supervisorComments, setSupervisorComments] = useState('');

  // Custom Resolution Date/Time State for MTTR calculation
  const [customClosedDate, setCustomClosedDate] = useState<string>('');
  const [useCustomClosedDate, setUseCustomClosedDate] = useState<boolean>(false);
  const [isEditingClosedDate, setIsEditingClosedDate] = useState<boolean>(false);

  // Advanced Filters
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [operatorFilter, setOperatorFilter] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');
  const [showQuickHelp, setShowQuickHelp] = useState(false);

  useEffect(() => {
    if (selectedFinding) {
      setSupervisorComments(selectedFinding.solution || selectedFinding.supervisorComments || '');
      setUseCustomClosedDate(false);
      const closedD = getFindingClosedDate(selectedFinding);
      setCustomClosedDate(formatToDatetimeLocal(closedD || new Date()));
      setIsEditingClosedDate(false);
    } else {
      setSupervisorComments('');
      setUseCustomClosedDate(false);
      setCustomClosedDate(formatToDatetimeLocal(new Date()));
      setIsEditingClosedDate(false);
    }
  }, [selectedFinding?.id]);

  useEffect(() => {
    const plantIdScope = user.role !== 'Administrador' ? user.plantId : undefined;
    return FindingService.subscribeToFindings((data) => {
      setAllFindings(data);
    }, plantIdScope);
  }, [user]);

  // Filter findings specifically for Orden y Limpieza
  const ordenFindings = useMemo(() => {
    return allFindings.filter(isOrdenYLimpiezaFinding);
  }, [allFindings]);

  useEffect(() => {
    if (initialFindingId && ordenFindings.length > 0) {
      const finding = ordenFindings.find(f => f.id === initialFindingId);
      if (finding) {
        setSelectedFinding(finding);
        if (onClearPending) onClearPending();
      }
    }
  }, [initialFindingId, ordenFindings, onClearPending]);

  // Metrics specifically for Orden y Limpieza
  const stats = useMemo(() => {
    const total = ordenFindings.length;
    const open = ordenFindings.filter(f => f.status === 'Open').length;
    const inReview = ordenFindings.filter(f => f.status === 'InReview').length;
    const closed = ordenFindings.filter(f => f.status === 'Closed').length;

    const complianceRate = total > 0 ? Math.round(((closed + inReview) / total) * 100) : 100;

    let totalResMs = 0;
    let resCount = 0;
    ordenFindings.forEach(f => {
      if (f.status === 'Closed' && f.closedAt && (f.date || f.createdAt)) {
        const start = getFindingDate(f)?.getTime() || 0;
        const end = f.closedAt.toDate ? f.closedAt.toDate().getTime() : new Date(f.closedAt).getTime();
        if (end > start && start > 0) {
          totalResMs += (end - start);
          resCount++;
        }
      }
    });

    const mttrHours = resCount > 0 ? Number((totalResMs / (1000 * 60 * 60 * resCount)).toFixed(1)) : 12.0;

    // Subcategories breakdown
    const subcats: Record<string, number> = {
      'Residuos': 0,
      'Herramientas': 0,
      'Derrames': 0,
      'Obstrucciones': 0,
      'Limpieza': 0,
      'General 5S': 0
    };

    ordenFindings.forEach(f => {
      const sc = getOrdenSubcategory(f.description);
      subcats[sc] = (subcats[sc] || 0) + 1;
    });

    const chartData = Object.entries(subcats)
      .map(([name, value]) => ({ name, value }))
      .filter(item => item.value > 0);

    // Area Hotspots
    const areaMap: Record<string, number> = {};
    ordenFindings.forEach(f => {
      const aName = f.areaName || 'Área General';
      areaMap[aName] = (areaMap[aName] || 0) + 1;
    });

    const hotspots = Object.entries(areaMap)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // Operator Leaderboard
    const opMap: Record<string, { total: number; closed: number }> = {};
    ordenFindings.forEach(f => {
      const op = f.operatorName || 'Operador';
      if (!opMap[op]) opMap[op] = { total: 0, closed: 0 };
      opMap[op].total++;
      if (f.status === 'Closed') opMap[op].closed++;
    });

    const leaderboard = Object.entries(opMap)
      .map(([name, data]) => ({ name, reports: data.total, closed: data.closed }))
      .sort((a, b) => b.reports - a.reports)
      .slice(0, 5);

    return {
      total,
      open,
      inReview,
      closed,
      complianceRate,
      mttrHours,
      chartData,
      hotspots,
      leaderboard
    };
  }, [ordenFindings]);

  const uniqueOperators = useMemo(() => {
    const operators = ordenFindings.map(f => f.operatorName).filter(Boolean);
    return Array.from(new Set(operators)).sort();
  }, [ordenFindings]);

  const filteredFindings = useMemo(() => {
    return ordenFindings.filter(f => {
      const matchesFilter = filter === 'All' || f.status === filter;
      const matchesSubcat = subcatFilter === 'All' || getOrdenSubcategory(f.description) === subcatFilter;
      const matchesSearch = (f.description || '').toLowerCase().includes((searchTerm || '').toLowerCase()) || 
                            f.areaName?.toLowerCase().includes((searchTerm || '').toLowerCase()) ||
                            f.operatorName?.toLowerCase().includes((searchTerm || '').toLowerCase());
      const matchesOperator = operatorFilter === 'All' || f.operatorName === operatorFilter;
      
      let matchesDate = true;
      const fDate = getFindingDate(f);
      if (fDate) {
        if (startDate) {
          const start = new Date(startDate);
          if (fDate < start) matchesDate = false;
        }
        if (endDate) {
          const end = new Date(endDate);
          end.setHours(23, 59, 59, 999);
          if (fDate > end) matchesDate = false;
        }
      }

      return matchesFilter && matchesSubcat && matchesSearch && matchesOperator && matchesDate;
    });
  }, [ordenFindings, filter, subcatFilter, searchTerm, operatorFilter, startDate, endDate]);

  const clearFilters = () => {
    setFilter('Open');
    setSubcatFilter('All');
    setSearchTerm('');
    setStartDate('');
    setEndDate('');
    setOperatorFilter('All');
  };

  const handleCloseFinding = async () => {
    if (!selectedFinding) return;
    const dateToUse = useCustomClosedDate && customClosedDate ? new Date(customClosedDate) : null;
    const resultStatus = await FindingService.transitionStatus(selectedFinding.id, 'Closed', user, supervisorComments, dateToUse);
    
    await addDoc(collection(db, 'notifications'), {
      title: 'Hallazgo de Orden y Limpieza Cerrado',
      message: `Tu reporte de Orden y Limpieza en ${selectedFinding.areaName} fue cerrado por el supervisor.`,
      type: 'Finding',
      targetRole: 'Operador',
      scheduledAt: serverTimestamp(),
      status: 'Sent',
      createdBy: user.uid,
      createdAt: serverTimestamp(),
      referenceId: selectedFinding.id,
      plantId: selectedFinding.plantId
    });

    setSelectedFinding(null);
    setSupervisorComments('');
    setUseCustomClosedDate(false);
    
    if (resultStatus.queued) {
      showToast("Cierre Encolado", "Guardado localmente. Se sincronizará al recuperar conexión.", "warning");
    } else {
      showToast("Hallazgo Cerrado", "Cierre registrado exitosamente.", "success");
    }
  };

  const handleUpdateClosureDate = async () => {
    if (!selectedFinding) return;
    const dateToUse = customClosedDate ? new Date(customClosedDate) : new Date();
    const result = await FindingService.updateFindingClosure(
      selectedFinding.id,
      user,
      supervisorComments,
      dateToUse
    );
    setIsEditingClosedDate(false);
    showToast("Fecha de Cierre Actualizada", "La fecha y hora de solución del hallazgo se actualizó correctamente.", "success");
  };

  const handleSetInReview = async () => {
    if (!selectedFinding) return;
    const resultStatus = await FindingService.transitionStatus(selectedFinding.id, 'InReview', user, supervisorComments);

    await addDoc(collection(db, 'notifications'), {
      title: 'Orden y Limpieza en Revisión',
      message: `Tu reporte de Orden y Limpieza en ${selectedFinding.areaName} está en revisión.`,
      type: 'Finding',
      targetRole: 'Operador',
      scheduledAt: serverTimestamp(),
      status: 'Sent',
      createdBy: user.uid,
      createdAt: serverTimestamp(),
      referenceId: selectedFinding.id,
      plantId: selectedFinding.plantId
    });

    setSelectedFinding(null);
    setSupervisorComments('');
    
    if (resultStatus.queued) {
      showToast("Encolado", "Puesto en revisión localmente.", "warning");
    } else {
      showToast("En Revisión", "Marcado en revisión exitosamente.", "info");
    }
  };

  const [isCleaningDuplicates, setIsCleaningDuplicates] = useState(false);

  const handleCleanupDuplicates = async () => {
    setIsCleaningDuplicates(true);
    try {
      const res = await FindingService.cleanupDuplicates();
      showToast(
        "Depuración Exitosa",
        `Se eliminaron ${res.deletedFindingsCount} hallazgos duplicados y se depuraron ${res.cleanedPhotosCount} fotos duplicadas.`,
        "success"
      );
    } catch (err: any) {
      showToast("Error", `Error al depurar duplicados: ${err.message}`, "error");
    } finally {
      setIsCleaningDuplicates(false);
    }
  };

  const handleDeleteFinding = async () => {
    if (!selectedFinding) return;
    try {
      await FindingService.deleteFinding(selectedFinding.id);
      setSelectedFinding(null);
      setIsConfirmingDelete(false);
      showToast("Eliminado", "Hallazgo de Orden y Limpieza eliminado.", "success");
    } catch (err) {
      console.error("Error deleting finding:", err);
      showToast("Error", "No se pudo eliminar el registro.", "error");
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-purple-950 via-indigo-900 to-zinc-950 p-5 sm:p-7 md:p-8 rounded-3xl md:rounded-[2.5rem] border border-purple-500/20 text-white shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-purple-500/10 rounded-full -mr-32 -mt-32 blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-5 sm:gap-6 min-w-0">
          <div className="space-y-2.5 min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-3 py-1 bg-purple-500/25 border border-purple-400/30 text-purple-200 rounded-full text-[10px] sm:text-xs font-black uppercase tracking-widest flex items-center gap-1.5 shrink-0">
                <Sparkles className="w-3.5 h-3.5 text-purple-300" />
                Modulo Orden & Limpieza (5S)
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-black uppercase tracking-tight text-white leading-tight break-words">
              Dashboard Orden y Limpieza
            </h2>
            <p className="text-xs sm:text-sm md:text-base text-purple-100/90 font-medium max-w-2xl leading-relaxed">
              Gestión exclusiva de hallazgos de orden, aseo, 5S, residuos, derrames y herramientas en terreno.
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center sm:justify-end gap-2.5 sm:gap-3 w-full lg:w-auto shrink-0 pt-3 lg:pt-0 border-t lg:border-t-0 border-purple-500/20">
            <button
              onClick={handleCleanupDuplicates}
              disabled={isCleaningDuplicates}
              className="px-3.5 py-3 bg-red-500/20 hover:bg-red-500/30 text-red-200 border border-red-400/30 rounded-2xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2 backdrop-blur-md active:scale-95 shadow-md flex-1 sm:flex-initial whitespace-nowrap cursor-pointer disabled:opacity-50"
              title="Elimina hallazgos duplicados realizados anteriormente y limpia fotos duplicadas"
            >
              <Trash2 className="w-4 h-4 text-red-300 shrink-0" />
              <span>{isCleaningDuplicates ? 'Depurando...' : '🧹 Depurar Duplicados'}</span>
            </button>

            <button
              onClick={() => setShowQuickHelp(true)}
              className="px-3.5 py-3 bg-white/10 hover:bg-white/20 text-white border border-white/20 rounded-2xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2 backdrop-blur-md active:scale-95 shadow-md flex-1 sm:flex-initial whitespace-nowrap cursor-pointer"
            >
              <HelpCircle className="w-4 h-4 text-purple-300 shrink-0" />
              <span>Ayuda rápida</span>
            </button>
            <button
              onClick={() => exportFindingsToCSV(filteredFindings, 'reporte-orden-limpieza')}
              className="px-4 py-3 bg-white/10 hover:bg-white/20 text-white border border-white/20 rounded-2xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2 backdrop-blur-md active:scale-95 shadow-md flex-1 sm:flex-initial whitespace-nowrap cursor-pointer"
            >
              <Download className="w-4 h-4 text-purple-300 shrink-0" />
              <span>CSV ({filteredFindings.length})</span>
            </button>
            <button
              onClick={() => exportFindingsToPDF(filteredFindings, 'Reporte de Orden y Limpieza', 'reporte-orden-limpieza')}
              className="px-4 py-3 bg-purple-600 hover:bg-purple-500 text-white rounded-2xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2 active:scale-95 shadow-lg shadow-purple-900/50 flex-1 sm:flex-initial whitespace-nowrap cursor-pointer"
            >
              <FileText className="w-4 h-4 shrink-0" />
              <span>Exportar PDF</span>
            </button>
          </div>
        </div>
      </div>

      {/* Stats Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-white dark:bg-black p-4 rounded-2xl border border-zinc-100 dark:border-white/10 shadow-sm">
          <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-1">Total Hallazgos</p>
          <p className="text-2xl font-black text-zinc-900 dark:text-white">{stats.total}</p>
        </div>
        <div className="bg-amber-50 dark:bg-amber-500/10 p-4 rounded-2xl border border-amber-100 dark:border-amber-500/20 shadow-sm">
          <p className="text-[10px] font-black text-amber-600 dark:text-amber-400 uppercase tracking-widest mb-1">Pendientes</p>
          <p className="text-2xl font-black text-amber-700 dark:text-amber-300">{stats.open}</p>
        </div>
        <div className="bg-orange-50 dark:bg-orange-500/10 p-4 rounded-2xl border border-orange-100 dark:border-orange-500/20 shadow-sm">
          <p className="text-[10px] font-black text-orange-600 dark:text-orange-400 uppercase tracking-widest mb-1">En Revisión</p>
          <p className="text-2xl font-black text-orange-700 dark:text-orange-300">{stats.inReview}</p>
        </div>
        <div className="bg-emerald-50 dark:bg-emerald-500/10 p-4 rounded-2xl border border-emerald-100 dark:border-emerald-500/20 shadow-sm">
          <p className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest mb-1">Cerrados</p>
          <p className="text-2xl font-black text-emerald-700 dark:text-emerald-300">{stats.closed}</p>
        </div>
        <div className="bg-purple-50 dark:bg-purple-500/10 p-4 rounded-2xl border border-purple-100 dark:border-purple-500/20 shadow-sm">
          <p className="text-[10px] font-black text-purple-600 dark:text-purple-400 uppercase tracking-widest mb-1">Cumplimiento</p>
          <p className="text-2xl font-black text-purple-700 dark:text-purple-300">{stats.complianceRate}%</p>
        </div>
        <div className="bg-sky-50 dark:bg-sky-500/10 p-4 rounded-2xl border border-sky-100 dark:border-sky-500/20 shadow-sm">
          <p className="text-[10px] font-black text-sky-600 dark:text-sky-400 uppercase tracking-widest mb-1">MTTR Solución</p>
          <p className="text-2xl font-black text-sky-700 dark:text-sky-300">{stats.mttrHours}h</p>
        </div>
      </div>

      {/* Analytics Charts & Rankings */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Subcategory Distribution Chart */}
        <div className="lg:col-span-2 bg-white dark:bg-zinc-900 p-6 rounded-3xl border border-zinc-100 dark:border-white/10 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-zinc-100 dark:border-white/5 pb-3">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-purple-500" />
              <h4 className="font-extrabold text-xs text-zinc-900 dark:text-white uppercase tracking-wider">
                Distribución por Subcategoría de Orden y Limpieza
              </h4>
            </div>
          </div>

          <div className="h-60 w-full">
            {stats.chartData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-zinc-400 italic">
                Sin hallazgos registrados para graficar
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#3f3f4620" />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#a1a1aa' }} />
                  <YAxis tick={{ fontSize: 10, fill: '#a1a1aa' }} />
                  <Tooltip 
                    contentStyle={{ borderRadius: '16px', backgroundColor: '#18181b', color: '#fff', border: '1px solid #27272a' }}
                  />
                  <Bar dataKey="value" name="Cantidad" fill="#a855f7" radius={[6, 6, 0, 0]}>
                    {stats.chartData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={['#a855f7', '#ec4899', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6'][index % 6]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Area Hotspots & Operator Leaderboard */}
        <div className="bg-white dark:bg-zinc-900 p-6 rounded-3xl border border-zinc-100 dark:border-white/10 shadow-sm space-y-6 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center gap-2 border-b border-zinc-100 dark:border-white/5 pb-2">
              <Compass className="w-4 h-4 text-purple-500" />
              <h4 className="font-extrabold text-xs text-zinc-900 dark:text-white uppercase tracking-wider">Hotspots por Área</h4>
            </div>
            {stats.hotspots.length === 0 ? (
              <p className="text-xs text-zinc-400 py-3 text-center">Sin áreas críticas registradas.</p>
            ) : (
              <div className="space-y-2">
                {stats.hotspots.map((area, idx) => (
                  <div key={`hs-${idx}`} className="flex items-center justify-between text-xs">
                    <span className="font-bold text-zinc-700 dark:text-zinc-300 truncate max-w-[150px]">{area.name}</span>
                    <span className="px-2 py-0.5 bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400 font-black rounded-lg text-[10px]">
                      {area.count} incidencias
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-3 pt-4 border-t border-zinc-100 dark:border-white/5">
            <div className="flex items-center gap-2 border-b border-zinc-100 dark:border-white/5 pb-2">
              <Activity className="w-4 h-4 text-purple-500" />
              <h4 className="font-extrabold text-xs text-zinc-900 dark:text-white uppercase tracking-wider">Aporte de Operadores</h4>
            </div>
            {stats.leaderboard.length === 0 ? (
              <p className="text-xs text-zinc-400 py-3 text-center">Sin actividad de operadores registrada.</p>
            ) : (
              <div className="space-y-2">
                {stats.leaderboard.map((op, idx) => (
                  <div key={`op-ld-${idx}`} className="flex items-center justify-between text-xs">
                    <span className="font-medium text-zinc-600 dark:text-zinc-400 truncate max-w-[140px]">{op.name}</span>
                    <div className="flex items-center gap-2 text-[10px] font-bold">
                      <span className="text-zinc-400">R: <b className="text-zinc-800 dark:text-zinc-200">{op.reports}</b></span>
                      <span className="text-emerald-500">C: <b>{op.closed}</b></span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Advanced Filters Panel */}
      <div className="bg-white dark:bg-zinc-900 p-6 rounded-3xl border border-zinc-100 dark:border-white/10 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-black text-zinc-900 dark:text-white uppercase tracking-widest flex items-center gap-2">
            <Filter className="w-4 h-4 text-purple-500" />
            Filtros del Dashboard
          </h4>
          <button onClick={clearFilters} className="text-[10px] font-bold text-purple-500 hover:underline uppercase tracking-widest">
            Restablecer Filtros
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-zinc-400 uppercase ml-1">Rango de Fechas</label>
            <div className="flex items-center gap-2">
              <input 
                type="date" 
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full p-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-100 dark:border-white/10 rounded-xl text-xs outline-none focus:ring-2 focus:ring-purple-500 dark:text-white font-medium"
              />
              <span className="text-zinc-400">-</span>
              <input 
                type="date" 
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full p-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-100 dark:border-white/10 rounded-xl text-xs outline-none focus:ring-2 focus:ring-purple-500 dark:text-white font-medium"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-zinc-400 uppercase ml-1">Subcategoría 5S</label>
            <select
              value={subcatFilter}
              onChange={(e) => setSubcatFilter(e.target.value)}
              className="w-full p-2.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-100 dark:border-white/10 rounded-xl text-xs outline-none focus:ring-2 focus:ring-purple-500 dark:text-white font-bold"
            >
              <option value="All">Todas las Subcategorías</option>
              <option value="Residuos">Residuos en el Área</option>
              <option value="Herramientas">Herramientas fuera de lugar</option>
              <option value="Derrames">Derrame de lubricantes/fluidos</option>
              <option value="Obstrucciones">Obstrucciones en accesos</option>
              <option value="Limpieza">Limpieza de equipo/área</option>
              <option value="General 5S">General 5S</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-zinc-400 uppercase ml-1">Operador</label>
            <select
              value={operatorFilter}
              onChange={(e) => setOperatorFilter(e.target.value)}
              className="w-full p-2.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-100 dark:border-white/10 rounded-xl text-xs outline-none focus:ring-2 focus:ring-purple-500 dark:text-white font-bold"
            >
              <option value="All">Todos los Operadores</option>
              {uniqueOperators.map((op, idx) => (
                <option key={`op-opt-ol-${op}-${idx}`} value={op}>{op}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Status Filters Bar & Search */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-3 border-t border-zinc-100 dark:border-white/5">
          <div className="flex bg-zinc-100 dark:bg-zinc-950 p-1 rounded-xl border border-zinc-100 dark:border-white/5 gap-1 w-full sm:w-auto">
            {(['Open', 'InReview', 'Closed', 'All'] as const).map((f) => (
              <button
                key={`ol-filter-tab-${f}`}
                onClick={() => setFilter(f)}
                className={`flex-1 sm:flex-initial px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                  filter === f 
                    ? 'bg-purple-600 text-white shadow-xs' 
                    : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
                }`}
              >
                {f === 'Open' ? 'Pendientes' : f === 'InReview' ? 'En Revisión' : f === 'Closed' ? 'Cerrados' : 'Todos'}
              </button>
            ))}
          </div>

          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
            <input 
              type="text"
              placeholder="Buscar hallazgo, área..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-100 dark:border-white/10 rounded-xl text-xs outline-none focus:ring-2 focus:ring-purple-500 dark:text-white"
            />
          </div>
        </div>
      </div>

      {/* Cards List */}
      <div className="grid gap-4">
        <AnimatePresence>
          {filteredFindings.map((finding, index) => (
            <motion.div
              layout
              key={`ol-card-${finding.id}-${index}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onClick={() => setSelectedFinding(finding)}
              className="bg-white dark:bg-black p-5 rounded-2xl border border-zinc-100 dark:border-white/10 shadow-sm hover:shadow-md transition-all cursor-pointer group"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                    finding.status === 'Open' ? 'bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400' : 
                    finding.status === 'InReview' ? 'bg-orange-50 dark:bg-orange-500/10 text-orange-600 dark:text-orange-400' :
                    'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                  }`}>
                    {finding.status === 'Open' ? <AlertCircle className="w-5 h-5" /> : 
                     finding.status === 'InReview' ? <Clock className="w-5 h-5" /> :
                     <CheckCircle2 className="w-5 h-5" />}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="font-black text-zinc-900 dark:text-white uppercase tracking-tight">
                        {finding.equipmentName || finding.equipmentId || finding.areaName || 'Sin Equipo'}
                      </h4>
                      <span className="px-2 py-0.5 bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-300 text-[9px] font-black uppercase rounded-md">
                        {getOrdenSubcategory(finding.description)}
                      </span>
                    </div>
                    <p className="text-[10px] font-extrabold text-zinc-400 uppercase tracking-widest mt-0.5">
                      {getFindingDate(finding) ? format(getFindingDate(finding)!, 'EEE dd MMM, HH:mm', { locale: es }) : 'Recién'}
                    </p>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-zinc-300 group-hover:text-purple-600 transition-colors" />
              </div>

              <p className="text-sm text-zinc-600 dark:text-zinc-300 line-clamp-2 font-medium">{finding.description}</p>

              <div className="mt-4 pt-3 border-t border-zinc-50 dark:border-white/5 flex items-center justify-between gap-4 text-[10px]">
                <span className="font-black uppercase tracking-widest text-zinc-400 truncate">
                  Por: {finding.operatorName}
                </span>
                <FindingPhotoThumbnails
                  photos={extractFindingPhotos(finding)}
                  onSelectPhoto={() => setSelectedFinding(finding)}
                  size="sm"
                />
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {filteredFindings.length === 0 && (
          <div className="text-center py-16 text-zinc-400 space-y-3 bg-white dark:bg-black rounded-3xl border border-dashed border-zinc-200 dark:border-white/10">
            <Sparkles className="w-12 h-12 mx-auto text-purple-400 opacity-40" />
            <p className="font-bold text-sm">No hay hallazgos de Orden y Limpieza en esta categoría</p>
          </div>
        )}
      </div>

      {/* Detail Modal */}
      <AnimatePresence>
        {selectedFinding && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setSelectedFinding(null)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm" 
            />
            <motion.div 
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              className="relative w-full max-w-lg sm:max-w-4xl bg-white dark:bg-black rounded-t-[2.5rem] sm:rounded-[2.5rem] overflow-hidden shadow-2xl flex flex-col sm:flex-row max-h-[90vh] border border-transparent dark:border-white/10"
            >
              <div className="min-h-[260px] sm:min-h-[380px] max-h-[450px] sm:max-h-none sm:h-auto sm:w-1/2 shrink-0 relative bg-zinc-950 flex flex-col">
                <FindingPhotoGallery 
                  photos={extractFindingPhotos(selectedFinding)} 
                  altPrefix={selectedFinding.equipmentName || selectedFinding.areaName || 'Hallazgo'}
                  showCloseButton
                  onClose={() => setSelectedFinding(null)}
                />
              </div>

              <div className="flex-1 overflow-y-auto p-6 sm:p-8 space-y-6 custom-scrollbar dark:bg-zinc-950/20">
                <div>
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <span className="px-2.5 py-1 bg-purple-600 text-white font-black text-[9px] uppercase rounded-lg border border-purple-400/30">
                      ✨ Orden y Limpieza (5S)
                    </span>
                    <span className="px-2.5 py-1 bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300 font-bold text-[9px] uppercase rounded-lg">
                      {getOrdenSubcategory(selectedFinding.description)}
                    </span>
                    <span className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase ${
                      selectedFinding.status === 'Open' ? 'bg-amber-100 text-amber-800' :
                      selectedFinding.status === 'InReview' ? 'bg-orange-100 text-orange-800' :
                      'bg-emerald-100 text-emerald-800'
                    }`}>
                      {selectedFinding.status === 'Open' ? 'Abierto' : selectedFinding.status === 'InReview' ? 'En Revisión' : 'Cerrado'}
                    </span>
                    <OperatingStatusBadge finding={selectedFinding} size="sm" />
                  </div>
                  <h3 className="text-2xl font-black text-zinc-900 dark:text-white uppercase leading-tight">
                    {selectedFinding.equipmentName || selectedFinding.equipmentId || selectedFinding.areaName || 'Sin Equipo'}
                  </h3>
                  <div className="mt-3 pt-3 border-t border-zinc-100 dark:border-white/10">
                    <FindingDescriptionRenderer 
                      description={selectedFinding.description} 
                      source="OrdenYLimpieza" 
                      filterModule="OrdenYLimpieza"
                    />
                  </div>
                </div>

                {selectedFinding.status !== 'Closed' ? (
                  <div className="space-y-4 pt-2">
                    <div>
                      <label className="block text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-1">Comentarios del Supervisor</label>
                      <textarea 
                        value={supervisorComments}
                        onChange={(e) => setSupervisorComments(e.target.value)}
                        className="w-full p-4 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 rounded-2xl focus:ring-2 focus:ring-purple-500 outline-none text-xs font-medium dark:text-white"
                        placeholder="Instrucciones o acciones correctivas aplicadas..."
                      />
                    </div>

                    {/* Resolution Date & Time (MTTR Adjustment) */}
                    <div className="bg-purple-50/70 dark:bg-purple-950/20 border border-purple-200/60 dark:border-purple-500/20 p-4 rounded-2xl space-y-3">
                      <div 
                        className="flex items-center justify-between cursor-pointer select-none" 
                        onClick={() => setUseCustomClosedDate(!useCustomClosedDate)}
                      >
                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                          <span className="text-xs font-bold text-purple-900 dark:text-purple-200">
                            ¿Ajustar fecha/hora de solución? (Cierre retroactivo)
                          </span>
                        </div>
                        <input 
                          type="checkbox" 
                          checked={useCustomClosedDate}
                          onChange={(e) => setUseCustomClosedDate(e.target.checked)}
                          className="w-4 h-4 rounded text-purple-600 focus:ring-purple-500 cursor-pointer"
                        />
                      </div>

                      {useCustomClosedDate ? (
                        <div className="space-y-3 pt-2 border-t border-purple-200/50 dark:border-purple-500/10">
                          <p className="text-[11px] text-purple-800 dark:text-purple-300 font-medium">
                            Indica cuándo se solucionó realmente en terreno para mantener el cálculo de MTTR preciso sin retrasos ficticios.
                          </p>

                          <div>
                            <label className="block text-[10px] font-black text-purple-900 dark:text-purple-300 uppercase tracking-widest mb-1">
                              Fecha y Hora de Solución
                            </label>
                            <input 
                              type="datetime-local"
                              value={customClosedDate}
                              onChange={(e) => setCustomClosedDate(e.target.value)}
                              max={formatToDatetimeLocal(new Date())}
                              className="w-full p-3 bg-white dark:bg-zinc-900 border border-purple-300 dark:border-purple-500/30 rounded-xl text-xs font-bold text-zinc-900 dark:text-white outline-none focus:ring-2 focus:ring-purple-500"
                            />
                          </div>

                          {/* Quick Presets */}
                          <div className="flex flex-wrap gap-1.5 pt-1">
                            <button
                              type="button"
                              onClick={() => setCustomClosedDate(formatToDatetimeLocal(new Date()))}
                              className="px-2.5 py-1 text-[10px] font-bold bg-white dark:bg-zinc-900 hover:bg-purple-100 dark:hover:bg-purple-900/40 text-purple-900 dark:text-purple-200 border border-purple-200 dark:border-purple-800/50 rounded-lg transition-colors"
                            >
                              ⚡ Ahora mismo
                            </button>
                            <button
                              type="button"
                              onClick={() => setCustomClosedDate(formatToDatetimeLocal(new Date(Date.now() - 3600 * 1000)))}
                              className="px-2.5 py-1 text-[10px] font-bold bg-white dark:bg-zinc-900 hover:bg-purple-100 dark:hover:bg-purple-900/40 text-purple-900 dark:text-purple-200 border border-purple-200 dark:border-purple-800/50 rounded-lg transition-colors"
                            >
                              ⏱️ Hace 1 hr
                            </button>
                            <button
                              type="button"
                              onClick={() => setCustomClosedDate(formatToDatetimeLocal(new Date(Date.now() - 4 * 3600 * 1000)))}
                              className="px-2.5 py-1 text-[10px] font-bold bg-white dark:bg-zinc-900 hover:bg-purple-100 dark:hover:bg-purple-900/40 text-purple-900 dark:text-purple-200 border border-purple-200 dark:border-purple-800/50 rounded-lg transition-colors"
                            >
                              🕒 Hace 4 hrs
                            </button>
                            <button
                              type="button"
                              onClick={() => setCustomClosedDate(formatToDatetimeLocal(new Date(Date.now() - 24 * 3600 * 1000)))}
                              className="px-2.5 py-1 text-[10px] font-bold bg-white dark:bg-zinc-900 hover:bg-purple-100 dark:hover:bg-purple-900/40 text-purple-900 dark:text-purple-200 border border-purple-200 dark:border-purple-800/50 rounded-lg transition-colors"
                            >
                              📅 Ayer
                            </button>
                            {getFindingDate(selectedFinding) && (
                              <button
                                type="button"
                                onClick={() => setCustomClosedDate(formatToDatetimeLocal(getFindingDate(selectedFinding)))}
                                className="px-2.5 py-1 text-[10px] font-bold bg-white dark:bg-zinc-900 hover:bg-purple-100 dark:hover:bg-purple-900/40 text-purple-900 dark:text-purple-200 border border-purple-200 dark:border-purple-800/50 rounded-lg transition-colors"
                              >
                                📋 Hora de reporte
                              </button>
                            )}
                          </div>

                          {/* Dynamic MTTR Preview */}
                          {getFindingDate(selectedFinding) && customClosedDate && (
                            <div className="p-2.5 bg-purple-100/70 dark:bg-purple-900/40 rounded-xl text-[11px] font-bold text-purple-950 dark:text-purple-200 flex items-center justify-between">
                              <span>MTTR Resultante:</span>
                              <span className="font-mono">{getCalculatedMTTRText(getFindingDate(selectedFinding)!, customClosedDate)}</span>
                            </div>
                          )}
                        </div>
                      ) : (
                        <p className="text-[11px] text-purple-800/80 dark:text-purple-300/80 italic">
                          Se utilizará la fecha y hora actual al presionar "Cerrar Hallazgo".
                        </p>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <button 
                        onClick={handleSetInReview}
                        disabled={selectedFinding.status === 'InReview'}
                        className="py-3.5 bg-white dark:bg-black border border-orange-300 text-orange-600 rounded-2xl font-black uppercase text-xs hover:bg-orange-50 disabled:opacity-50"
                      >
                        Poner en Revisión
                      </button>
                      <button 
                        onClick={handleCloseFinding}
                        className="py-3.5 bg-purple-600 text-white rounded-2xl font-black uppercase text-xs hover:bg-purple-700 shadow-lg shadow-purple-200 dark:shadow-none"
                      >
                        Cerrar Hallazgo
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="bg-zinc-50 dark:bg-zinc-900 p-4 rounded-2xl space-y-3 border border-zinc-100 dark:border-white/5">
                    <div>
                      <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Solución Aplicada</p>
                      <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">{selectedFinding.solution || 'Solucionado por supervisor/operador'}</p>
                    </div>

                    <div className="pt-2 border-t border-zinc-200/60 dark:border-white/5 flex items-center justify-between">
                      <div>
                        <p className="text-[10px] font-black text-zinc-400 dark:text-zinc-600 uppercase tracking-widest">Fecha / Hora de Solución</p>
                        <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                          {getFindingClosedDate(selectedFinding) ? getFindingClosedDate(selectedFinding)!.toLocaleString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'No especificada'}
                        </p>
                        {getFindingDate(selectedFinding) && getFindingClosedDate(selectedFinding) && (
                          <p className="text-[10px] text-zinc-500 dark:text-zinc-400 font-medium">
                            MTTR: {getCalculatedMTTRText(getFindingDate(selectedFinding)!, getFindingClosedDate(selectedFinding))}
                          </p>
                        )}
                      </div>
                      
                      <button
                        type="button"
                        onClick={() => setIsEditingClosedDate(!isEditingClosedDate)}
                        className="px-3 py-1.5 bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 text-[11px] font-bold rounded-xl transition-colors"
                      >
                        {isEditingClosedDate ? 'Cancelar' : '✏️ Editar Fecha'}
                      </button>
                    </div>

                    {isEditingClosedDate && (
                      <div className="p-3 bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-500/20 rounded-xl space-y-2">
                        <label className="block text-[10px] font-black text-purple-900 dark:text-purple-300 uppercase">Nueva Fecha y Hora de Solución:</label>
                        <input 
                          type="datetime-local"
                          value={customClosedDate}
                          onChange={(e) => setCustomClosedDate(e.target.value)}
                          className="w-full p-2.5 bg-white dark:bg-zinc-900 border border-purple-300 dark:border-purple-500/30 rounded-lg text-xs font-bold dark:text-white"
                        />
                        <button
                          type="button"
                          onClick={handleUpdateClosureDate}
                          className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-xs uppercase"
                        >
                          Guardar Cambio de Fecha (Ajustar MTTR)
                        </button>
                      </div>
                    )}
                  </div>
                )}

                <div className="pt-3 border-t border-zinc-100 dark:border-white/5 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const opProf = getOperatorProfile(selectedFinding.operatorId, selectedFinding.operatorName, (selectedFinding as any).operatorPhotoUrl);
                      downloadOperatorInspectionPDF(selectedFinding, {
                        name: selectedFinding.operatorName || opProf.name,
                        photoUrl: opProf.photoUrl || (selectedFinding as any).operatorPhotoUrl,
                        rut: opProf.rut,
                        cargo: opProf.cargo
                      });
                    }}
                    className="w-full py-3.5 px-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-2xl font-black text-xs uppercase tracking-wider transition-all shadow-md active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    <span>Descargar PDF</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      const opProf = getOperatorProfile(selectedFinding.operatorId, selectedFinding.operatorName, (selectedFinding as any).operatorPhotoUrl);
                      shareOperatorInspectionPDF(selectedFinding, {
                        name: selectedFinding.operatorName || opProf.name,
                        photoUrl: opProf.photoUrl || (selectedFinding as any).operatorPhotoUrl,
                        rut: opProf.rut,
                        cargo: opProf.cargo
                      });
                    }}
                    className="w-full py-3.5 px-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-2xl font-black text-xs uppercase tracking-wider transition-all shadow-md active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Share2 className="w-4 h-4" />
                    <span>Compartir PDF</span>
                  </button>
                </div>

                {user.role === 'Administrador' && (
                  <div className="pt-4 border-t border-zinc-100 dark:border-white/5">
                    {isConfirmingDelete ? (
                      <div className="flex items-center gap-2">
                        <button onClick={handleDeleteFinding} className="flex-1 py-2.5 bg-red-600 text-white rounded-xl font-bold text-xs">
                          Confirmar Eliminar
                        </button>
                        <button onClick={() => setIsConfirmingDelete(false)} className="flex-1 py-2.5 bg-zinc-200 text-zinc-700 rounded-xl font-bold text-xs">
                          Cancelar
                        </button>
                      </div>
                    ) : (
                      <button onClick={() => setIsConfirmingDelete(true)} className="w-full py-2.5 text-red-500 hover:bg-red-50 rounded-xl font-bold text-xs flex items-center justify-center gap-2">
                        <Trash2 className="w-4 h-4" />
                        <span>Eliminar Registro</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      <QuickHelpModal
        isOpen={showQuickHelp}
        onClose={() => setShowQuickHelp(false)}
        moduleKey="5S"
      />
    </div>
  );
};
