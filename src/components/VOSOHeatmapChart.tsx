/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { 
  Flame, 
  Eye, 
  Ear, 
  Hand, 
  Wind, 
  Sparkles, 
  Layers, 
  AlertTriangle, 
  Info, 
  CheckCircle2, 
  X, 
  ChevronRight, 
  Filter,
  ShieldAlert,
  Calendar,
  User,
  MapPin
} from 'lucide-react';
import { Finding } from '../types';

interface VOSOHeatmapChartProps {
  findings: Finding[];
}

export interface VOSOCategoryDef {
  key: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  badgeBg: string;
}

const VOSO_CATEGORIES: VOSOCategoryDef[] = [
  { key: 'VER', label: 'VER (Visual)', icon: Eye, color: 'text-sky-500', badgeBg: 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20' },
  { key: 'OÍR', label: 'OÍR (Auditivo)', icon: Ear, color: 'text-indigo-500', badgeBg: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20' },
  { key: 'SENTIR', label: 'SENTIR (Vibración)', icon: Hand, color: 'text-emerald-500', badgeBg: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' },
  { key: 'OLER', label: 'OLER (Fuga/Olor)', icon: Wind, color: 'text-amber-500', badgeBg: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20' },
  { key: 'ORDEN', label: 'ORDEN (5S/Aseo)', icon: Sparkles, color: 'text-purple-500', badgeBg: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20' },
  { key: 'OTROS', label: 'OTROS (Gral.)', icon: Layers, color: 'text-zinc-500', badgeBg: 'bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border-zinc-500/20' },
];

const PRIORITY_CATEGORIES: VOSOCategoryDef[] = [
  { key: 'Alta', label: 'Alta / Crítica', icon: AlertTriangle, color: 'text-rose-500', badgeBg: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20' },
  { key: 'Media', label: 'Media / Operacional', icon: Info, color: 'text-amber-500', badgeBg: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20' },
  { key: 'Baja', label: 'Baja / Rutinaria', icon: CheckCircle2, color: 'text-emerald-500', badgeBg: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' },
];

export function getVOSOCategoriesForFinding(f: Finding): string[] {
  const desc = (f.description || '').toUpperCase();
  const matched: string[] = [];

  if (desc.includes('VER') || desc.includes('[VER]')) matched.push('VER');
  if (desc.includes('OÍR') || desc.includes('OIR') || desc.includes('[OÍR]') || desc.includes('[OIR]')) matched.push('OÍR');
  if (desc.includes('SENTIR') || desc.includes('[SENTIR]')) matched.push('SENTIR');
  if (desc.includes('OLER') || desc.includes('[OLER]')) matched.push('OLER');
  if (desc.includes('ORDEN') || desc.includes('[ORDEN]')) matched.push('ORDEN');

  return matched.length > 0 ? matched : ['OTROS'];
}

export function getPriorityCategoryForFinding(f: Finding): string {
  const prio = f.priority || 'Media';
  if (prio === 'Alta' || prio === 'Crítico' || prio === 'Critico') return 'Alta';
  if (prio === 'Baja') return 'Baja';
  return 'Media';
}

function getHeatmapCellStyles(count: number, maxCellCount: number) {
  if (count === 0) {
    return {
      bg: 'bg-zinc-50/80 dark:bg-zinc-900/40 text-zinc-300 dark:text-zinc-700 border-zinc-100 dark:border-white/5',
      label: '0',
    };
  }
  if (count === 1) {
    return {
      bg: 'bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30 font-bold hover:bg-sky-500/25',
      label: '1',
    };
  }
  if (count <= 3) {
    return {
      bg: 'bg-amber-500/25 text-amber-900 dark:text-amber-200 border-amber-500/40 font-extrabold hover:bg-amber-500/35',
      label: `${count}`,
    };
  }
  return {
    bg: 'bg-rose-500/35 text-rose-950 dark:text-rose-100 border-rose-500/60 font-black shadow-xs ring-1 ring-rose-500/30 hover:bg-rose-500/45 animate-pulse',
    label: `${count}`,
  };
}

function getEquipmentRiskStatus(totalCount: number): { label: string; bg: string; dot: string } {
  if (totalCount >= 5) {
    return { label: 'Equipo Crítico', bg: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20', dot: 'bg-rose-500 animate-pulse' };
  }
  if (totalCount >= 3) {
    return { label: 'Atención Moderada', bg: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20', dot: 'bg-amber-500' };
  }
  return { label: 'Baja Frecuencia', bg: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20', dot: 'bg-emerald-500' };
}

export const VOSOHeatmapChart: React.FC<VOSOHeatmapChartProps> = ({ findings }) => {
  const [viewMode, setViewMode] = useState<'voso' | 'priority'>('voso');
  const [selectedCell, setSelectedCell] = useState<{ equipmentName: string; categoryKey: string; categoryLabel: string; list: Finding[] } | null>(null);

  const activeCategories = viewMode === 'voso' ? VOSO_CATEGORIES : PRIORITY_CATEGORIES;

  // Aggregate matrix: matrixData[equipmentName][categoryKey] = Finding[]
  const { matrix, sortedEquipments, equipmentAreas, colTotals, grandTotal, topHotspot } = useMemo(() => {
    const mat: Record<string, Record<string, Finding[]>> = {};
    const equipAreaMap: Record<string, string> = {};
    const colTot: Record<string, number> = {};
    let gTotal = 0;

    activeCategories.forEach(c => { colTot[c.key] = 0; });

    let maxCellCount = 0;
    let maxEquipment = '';
    let maxCatKey = '';

    findings.forEach(f => {
      const equip = f.equipmentName || f.equipmentId || f.areaName || 'Sin Equipo';
      if (!mat[equip]) {
        mat[equip] = {};
        activeCategories.forEach(c => { mat[equip][c.key] = []; });
      }
      if (f.areaName && !equipAreaMap[equip]) {
        equipAreaMap[equip] = f.areaName;
      }

      const cats = viewMode === 'voso' ? getVOSOCategoriesForFinding(f) : [getPriorityCategoryForFinding(f)];

      cats.forEach(catKey => {
        if (!mat[equip][catKey]) mat[equip][catKey] = [];
        mat[equip][catKey].push(f);
        colTot[catKey] = (colTot[catKey] || 0) + 1;
        gTotal++;

        if (mat[equip][catKey].length > maxCellCount) {
          maxCellCount = mat[equip][catKey].length;
          maxEquipment = equip;
          maxCatKey = catKey;
        }
      });
    });

    // Sort equipments by total findings descending
    const equipTotals: Record<string, number> = {};
    Object.keys(mat).forEach(equip => {
      equipTotals[equip] = Object.values(mat[equip]).reduce((acc, list) => acc + list.length, 0);
    });

    const sEquipments = Object.keys(mat).sort((a, b) => equipTotals[b] - equipTotals[a]);

    const hotspot = maxCellCount > 0 ? {
      equipment: maxEquipment,
      area: equipAreaMap[maxEquipment] || '',
      categoryKey: maxCatKey,
      count: maxCellCount,
      categoryLabel: activeCategories.find(c => c.key === maxCatKey)?.label || maxCatKey
    } : null;

    return {
      matrix: mat,
      sortedEquipments: sEquipments,
      equipmentAreas: equipAreaMap,
      colTotals: colTot,
      grandTotal: gTotal,
      topHotspot: hotspot
    };
  }, [findings, activeCategories, viewMode]);

  return (
    <div className="bg-white dark:bg-black rounded-3xl p-5 sm:p-6 border border-zinc-100 dark:border-white/10 shadow-sm dark:shadow-none space-y-5">
      {/* Header Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
              <Flame className="w-4 h-4" />
            </div>
            <h3 className="font-extrabold text-xs text-zinc-900 dark:text-white uppercase tracking-wider">
              Mapa de Calor de Reincidencia por Equipo
            </h3>
          </div>
          <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
            Identificación de concentración de hallazgos VOSO por equipo para prevenir fallas repetitivas.
          </p>
        </div>

        {/* View Mode Toggle */}
        <div className="flex items-center gap-1.5 bg-zinc-100 dark:bg-zinc-900 p-1 rounded-xl self-start sm:self-auto">
          <button
            onClick={() => setViewMode('voso')}
            className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 ${
              viewMode === 'voso'
                ? 'bg-white dark:bg-black text-zinc-900 dark:text-white shadow-xs'
                : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
            }`}
          >
            <Eye className="w-3 h-3 text-sky-500" />
            Metodología VOSO
          </button>
          <button
            onClick={() => setViewMode('priority')}
            className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 ${
              viewMode === 'priority'
                ? 'bg-white dark:bg-black text-zinc-900 dark:text-white shadow-xs'
                : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
            }`}
          >
            <AlertTriangle className="w-3 h-3 text-rose-500" />
            Por Prioridad
          </button>
        </div>
      </div>

      {/* Top Hotspot Highlight Banner */}
      {topHotspot && topHotspot.count >= 2 && (
        <div className="p-3.5 rounded-2xl bg-gradient-to-r from-rose-500/10 via-amber-500/10 to-transparent border border-rose-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2.5">
            <ShieldAlert className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
            <div>
              <span className="font-extrabold text-zinc-900 dark:text-white">Alerta de Reincidencia en Equipo:</span>{' '}
              <span className="text-zinc-700 dark:text-zinc-300">
                Equipo <strong className="text-rose-600 dark:text-rose-400">{topHotspot.equipment}</strong>
                {topHotspot.area ? ` (${topHotspot.area})` : ''} concentra{' '}
                <strong className="underline decoration-rose-500">{topHotspot.count} observaciones</strong> en la categoría{' '}
                <strong>{topHotspot.categoryLabel}</strong>.
              </span>
            </div>
          </div>
          <button 
            onClick={() => setSelectedCell({
              equipmentName: topHotspot.equipment,
              categoryKey: topHotspot.categoryKey,
              categoryLabel: topHotspot.categoryLabel,
              list: matrix[topHotspot.equipment]?.[topHotspot.categoryKey] || []
            })}
            className="px-3 py-1 bg-rose-500 text-white rounded-xl text-[10px] font-bold uppercase tracking-wider hover:bg-rose-600 transition-colors shrink-0 self-end sm:self-auto cursor-pointer"
          >
            Ver Detalles
          </button>
        </div>
      )}

      {/* Matrix Table Container */}
      {sortedEquipments.length === 0 ? (
        <div className="py-12 text-center text-xs text-zinc-400 dark:text-zinc-600 border border-dashed border-zinc-200 dark:border-white/10 rounded-2xl">
          No hay hallazgos registrados para generar el mapa de calor en el rango seleccionado.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-zinc-100 dark:border-white/10">
          <table className="w-full text-left border-collapse min-w-[650px]">
            <thead>
              <tr className="bg-zinc-50 dark:bg-zinc-900/60 border-b border-zinc-100 dark:border-white/10 text-[10px] font-black uppercase text-zinc-500 dark:text-zinc-400 tracking-wider">
                <th className="py-3 px-4 w-52">Equipo / Maquinaria</th>
                {activeCategories.map(cat => {
                  const IconComp = cat.icon;
                  return (
                    <th key={cat.key} className="py-3 px-2 text-center">
                      <div className="flex flex-col items-center justify-center gap-1">
                        <IconComp className={`w-3.5 h-3.5 ${cat.color}`} />
                        <span>{cat.key}</span>
                      </div>
                    </th>
                  );
                })}
                <th className="py-3 px-4 text-center w-28">Total Equipo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-white/5 text-xs">
              {sortedEquipments.map(equipName => {
                const equipRow = matrix[equipName];
                const equipTotal = activeCategories.reduce((acc, cat) => acc + (equipRow[cat.key]?.length || 0), 0);
                const riskStatus = getEquipmentRiskStatus(equipTotal);
                const areaName = equipmentAreas[equipName];

                return (
                  <tr key={equipName} className="hover:bg-zinc-50/50 dark:hover:bg-white/[0.02] transition-colors">
                    {/* Equipment Name Column */}
                    <td className="py-3 px-4 font-bold text-zinc-800 dark:text-zinc-200">
                      <div className="flex flex-col gap-1">
                        <span className="truncate max-w-[200px]" title={equipName}>{equipName}</span>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className={`inline-block w-1.5 h-1.5 rounded-full ${riskStatus.dot}`} />
                          <span className="text-[9px] font-medium text-zinc-400 dark:text-zinc-500">
                            {riskStatus.label} {areaName ? `• ${areaName}` : ''}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* Category Cells */}
                    {activeCategories.map(cat => {
                      const cellList = equipRow[cat.key] || [];
                      const cellCount = cellList.length;
                      const cellStyle = getHeatmapCellStyles(cellCount, grandTotal);

                      return (
                        <td key={cat.key} className="py-2.5 px-2 text-center">
                          <button
                            disabled={cellCount === 0}
                            onClick={() => setSelectedCell({
                              equipmentName: equipName,
                              categoryKey: cat.key,
                              categoryLabel: cat.label,
                              list: cellList
                            })}
                            className={`w-full py-2.5 rounded-xl border transition-all text-xs flex items-center justify-center ${cellStyle.bg} ${
                              cellCount > 0 ? 'cursor-pointer active:scale-95' : 'cursor-default'
                            }`}
                            title={cellCount > 0 ? `Ver ${cellCount} hallazgos en ${equipName} (${cat.label})` : 'Sin registros'}
                          >
                            {cellStyle.label}
                          </button>
                        </td>
                      );
                    })}

                    {/* Row Total */}
                    <td className="py-3 px-4 text-center">
                      <span className={`inline-flex items-center justify-center px-2.5 py-1 rounded-xl text-xs font-black border ${riskStatus.bg}`}>
                        {equipTotal}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>

            {/* Matrix Summary Footer */}
            <tfoot>
              <tr className="bg-zinc-50/80 dark:bg-zinc-900/80 border-t-2 border-zinc-200 dark:border-white/10 text-xs font-bold text-zinc-900 dark:text-white">
                <td className="py-3 px-4 font-extrabold uppercase text-[10px] tracking-wider text-zinc-500 dark:text-zinc-400">
                  Total Planta
                </td>
                {activeCategories.map(cat => (
                  <td key={cat.key} className="py-3 px-2 text-center font-black">
                    <span className={`text-[11px] ${colTotals[cat.key] > 0 ? 'text-zinc-900 dark:text-white' : 'text-zinc-400'}`}>
                      {colTotals[cat.key] || 0}
                    </span>
                  </td>
                ))}
                <td className="py-3 px-4 text-center font-black text-brand-blue dark:text-sky-400">
                  {grandTotal}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* Legend & Guidance */}
      <div className="flex flex-wrap items-center justify-between gap-4 pt-2 border-t border-zinc-100 dark:border-white/5 text-[10px]">
        <div className="flex items-center gap-3 text-zinc-500 dark:text-zinc-400 flex-wrap">
          <span className="font-bold uppercase tracking-wider text-zinc-400">Escala de Reincidencia:</span>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-md bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-white/10" />
            <span>0 Sin Hallazgos</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-md bg-sky-500/20 border border-sky-500/40" />
            <span>1 Ocasional</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-md bg-amber-500/30 border border-amber-500/50" />
            <span>2-3 Recurrente</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-md bg-rose-500/40 border border-rose-500/60" />
            <span>4+ Reincidente Crítico</span>
          </div>
        </div>

        <p className="text-zinc-400 dark:text-zinc-500 italic">
          Haz clic en cualquier celda para inspeccionar los hallazgos específicos.
        </p>
      </div>

      {/* Cell Findings Detail Modal */}
      {selectedCell && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-white/10 rounded-3xl max-w-2xl w-full max-h-[85vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="p-5 border-b border-zinc-100 dark:border-white/10 flex items-center justify-between bg-zinc-50/50 dark:bg-zinc-900/50">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Flame className="w-4 h-4 text-rose-500" />
                  <h4 className="font-extrabold text-sm text-zinc-900 dark:text-white uppercase tracking-wider">
                    Detalle de Reincidencia
                  </h4>
                </div>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Equipo: <strong className="text-zinc-800 dark:text-zinc-200">{selectedCell.equipmentName}</strong> | Categoría:{' '}
                  <strong className="text-rose-500">{selectedCell.categoryLabel}</strong> ({selectedCell.list.length} registros)
                </p>
              </div>
              <button
                onClick={() => setSelectedCell(null)}
                className="p-2 rounded-xl text-zinc-400 hover:text-zinc-600 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal List Body */}
            <div className="p-5 overflow-y-auto space-y-3 divide-y divide-zinc-100 dark:divide-white/5">
              {selectedCell.list.map((finding, idx) => {
                const dateObj = finding.createdAt?.toDate ? finding.createdAt.toDate() : new Date(finding.createdAt || Date.now());
                const formattedDate = dateObj ? dateObj.toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'N/A';

                return (
                  <div key={finding.id || idx} className="pt-3 first:pt-0 space-y-2">
                    <div className="flex items-center justify-between text-xs flex-wrap gap-2">
                      <div className="flex items-center gap-2 text-zinc-500 dark:text-zinc-400">
                        <Calendar className="w-3.5 h-3.5 text-zinc-400" />
                        <span className="font-medium">{formattedDate}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {finding.priority && (
                          <span className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase ${
                            finding.priority === 'Alta' ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20' :
                            finding.priority === 'Baja' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20' :
                            'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                          }`}>
                            {finding.priority}
                          </span>
                        )}
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase ${
                          finding.status === 'Open' ? 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20' :
                          finding.status === 'InReview' ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20' :
                          'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                        }`}>
                          {finding.status === 'Open' ? 'Pendiente' : finding.status === 'InReview' ? 'En Revisión' : 'Cerrado'}
                        </span>
                      </div>
                    </div>

                    <p className="text-xs text-zinc-800 dark:text-zinc-200 bg-zinc-50 dark:bg-zinc-900/50 p-3 rounded-2xl border border-zinc-100 dark:border-white/5 whitespace-pre-wrap leading-relaxed">
                      {finding.description}
                    </p>

                    <div className="flex items-center justify-between text-[11px] text-zinc-400 dark:text-zinc-500">
                      <span className="flex items-center gap-1">
                        <User className="w-3 h-3 text-zinc-400" />
                        Operador: <strong className="text-zinc-600 dark:text-zinc-300">{finding.operatorName || 'No registrado'}</strong>
                      </span>
                      {finding.equipmentName && (
                        <span className="flex items-center gap-1">
                          Equipo: <strong className="text-zinc-600 dark:text-zinc-300">{finding.equipmentName}</strong>
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-zinc-100 dark:border-white/10 bg-zinc-50/50 dark:bg-zinc-900/50 flex justify-end">
              <button
                onClick={() => setSelectedCell(null)}
                className="px-4 py-2 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-xl text-xs font-bold uppercase tracking-wider hover:opacity-90 transition-opacity"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
