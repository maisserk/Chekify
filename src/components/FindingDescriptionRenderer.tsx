import React from 'react';
import { 
  Eye, 
  Volume2, 
  Activity, 
  Wind, 
  Sparkles, 
  AlertTriangle, 
  AlertCircle, 
  CheckCircle2, 
  LayoutDashboard, 
  FileSearch, 
  ClipboardList,
  MessageSquare,
  FileText
} from 'lucide-react';

const VOSO_ICONS: Record<string, React.ElementType> = {
  'VER': Eye,
  'OÍR': Volume2,
  'SENTIR': Activity,
  'OLER': Wind,
  'ORDEN': Sparkles,
};

const VOSO_COLORS: Record<string, { bg: string; text: string; border: string; accent: string }> = {
  'VER': { bg: 'bg-sky-50 dark:bg-sky-500/10', text: 'text-sky-600 dark:text-sky-400', border: 'border-sky-200 dark:border-sky-500/20', accent: 'bg-sky-500' },
  'OÍR': { bg: 'bg-indigo-50 dark:bg-indigo-500/10', text: 'text-indigo-600 dark:text-indigo-400', border: 'border-indigo-200 dark:border-indigo-500/20', accent: 'bg-indigo-500' },
  'SENTIR': { bg: 'bg-emerald-50 dark:bg-emerald-500/10', text: 'text-emerald-600 dark:text-emerald-400', border: 'border-emerald-200 dark:border-emerald-500/20', accent: 'bg-emerald-500' },
  'OLER': { bg: 'bg-orange-50 dark:bg-orange-500/10', text: 'text-orange-600 dark:text-orange-400', border: 'border-orange-200 dark:border-orange-500/20', accent: 'bg-orange-500' },
  'ORDEN': { bg: 'bg-purple-50 dark:bg-purple-500/10', text: 'text-purple-600 dark:text-purple-400', border: 'border-purple-200 dark:border-purple-500/20', accent: 'bg-purple-500' },
};

export interface ParsedItem {
  category: string;
  rawTitle: string;
  detail: string;
  status: 'Crítico' | 'Observación' | 'Bueno' | null;
  isSolved: boolean;
  comment: string;
}

export const parseFindingDescription = (
  description: string, 
  source?: string, 
  filterModule?: 'ALL' | 'VOSO' | 'OrdenYLimpieza'
) => {
  if (!description) {
    return { header: null, vosoItems: [], ordenItems: [], tradItems: [], rawText: '' };
  }

  const effectiveModule = filterModule || (source === 'VOSO' ? 'VOSO' : source === 'OrdenYLimpieza' ? 'OrdenYLimpieza' : 'ALL');

  const desc = description.trim();
  const upperDesc = desc.toUpperCase();

  // Check if it has inspection features
  const isInspection = desc.includes('Inspección') || 
                       desc.includes('Reporte autogenerado') || 
                       desc.includes('HALLAZGOS') || 
                       desc.includes('• ') ||
                       desc.includes('OTROS PUNTOS');

  if (!isInspection) {
    const isOrdenBracket = upperDesc.startsWith('[ORDEN]') || 
                           upperDesc.startsWith('[5S]') || 
                           source === 'OrdenYLimpieza';
    const isVOSOBracket = desc.match(/^\[(VER|OÍR|OIR|SENTIR|OLER)\]/i);

    if (isOrdenBracket) {
      if (effectiveModule === 'VOSO') {
        return { header: null, vosoItems: [], ordenItems: [], tradItems: [], rawText: '' };
      }
      const clean = desc.replace(/^\[ORDEN\]/i, '').replace(/^\[5S\]/i, '').trim();
      const subcatMatch = clean.match(/^\[(.*?)\]/);
      const subcat = subcatMatch ? subcatMatch[1] : '5S / Aseo';
      const comment = subcatMatch ? clean.replace(/^\[.*?\]/, '').trim() : clean;

      return {
        header: null,
        vosoItems: [],
        ordenItems: [{
          category: 'ORDEN',
          rawTitle: subcat !== comment ? subcat : 'Programa 5S - Orden & Limpieza',
          detail: comment,
          status: 'Observación' as const,
          isSolved: desc.includes('[SOLUCIONADO]'),
          comment: comment.replace('[SOLUCIONADO]', '').replace(/-\s*Solucionado por operador/gi, '').trim()
        }],
        tradItems: [],
        rawText: desc
      };
    }

    if (isVOSOBracket) {
      if (effectiveModule === 'OrdenYLimpieza') {
        return { header: null, vosoItems: [], ordenItems: [], tradItems: [], rawText: '' };
      }
      let category = isVOSOBracket[1].toUpperCase();
      if (category === 'OIR') category = 'OÍR';
      const clean = desc.replace(/^\[(VER|OÍR|OIR|SENTIR|OLER)\]/i, '').trim();

      return {
        header: null,
        vosoItems: [{
          category,
          rawTitle: `Ítem VOSO (${category})`,
          detail: clean,
          status: 'Observación' as const,
          isSolved: desc.includes('[SOLUCIONADO]'),
          comment: clean.replace('[SOLUCIONADO]', '').replace(/-\s*Solucionado por operador/gi, '').trim()
        }],
        ordenItems: [],
        tradItems: [],
        rawText: desc
      };
    }

    if (source === 'OrdenYLimpieza' || effectiveModule === 'OrdenYLimpieza') {
      if (effectiveModule === 'VOSO') {
        return { header: null, vosoItems: [], ordenItems: [], tradItems: [], rawText: '' };
      }
      return {
        header: null,
        vosoItems: [],
        ordenItems: [{
          category: 'ORDEN',
          rawTitle: 'Programa 5S - Orden & Limpieza',
          detail: desc,
          status: 'Observación' as const,
          isSolved: desc.includes('[SOLUCIONADO]'),
          comment: desc.replace('[SOLUCIONADO]', '').replace(/-\s*Solucionado por operador/gi, '').trim()
        }],
        tradItems: [],
        rawText: desc
      };
    }

    if (source === 'VOSO' || effectiveModule === 'VOSO') {
      return {
        header: null,
        vosoItems: [{
          category: 'VER',
          rawTitle: 'Observación VOSO',
          detail: desc,
          status: 'Observación' as const,
          isSolved: desc.includes('[SOLUCIONADO]'),
          comment: desc.replace('[SOLUCIONADO]', '').replace(/-\s*Solucionado por operador/gi, '').trim()
        }],
        ordenItems: [],
        tradItems: [],
        rawText: desc
      };
    }

    return {
      header: null,
      vosoItems: [],
      ordenItems: [],
      tradItems: [],
      rawText: desc
    };
  }

  // Multi-item or inspection report
  const lines = desc.split('\n').map(l => l.trim()).filter(Boolean);
  const firstLine = lines[0] || '';
  const firstLower = firstLine.toLowerCase();
  const header = (firstLower.includes('inspección') || firstLower.includes('inspeccion') || firstLower.includes('reporte')) ? firstLine : null;

  let vosoItems: ParsedItem[] = [];
  let ordenItems: ParsedItem[] = [];
  let tradItems: ParsedItem[] = [];

  let currentSection: 'VOSO' | 'TRAD' | 'NONE' = 'NONE';

  for (const line of lines) {
    const upperLine = line.toUpperCase();
    const lowerLine = line.toLowerCase();

    // Skip section titles
    if (upperLine.includes('HALLAZGOS VOSO') || upperLine.includes('HALLAZGOS:')) {
      currentSection = 'VOSO';
      continue;
    }
    if (upperLine.includes('OTROS PUNTOS') || upperLine.includes('CHECKLIST TRADICIONAL')) {
      currentSection = 'TRAD';
      continue;
    }

    // Skip header line or lines describing overall inspection / operating status
    const isHeaderLine = 
      line === header ||
      lowerLine.startsWith('inspección') || 
      lowerLine.startsWith('inspeccion') || 
      lowerLine.startsWith('reporte') ||
      lowerLine.includes('condición operativa') ||
      lowerLine.includes('condicion operativa') ||
      (lowerLine.includes('condicion') && (lowerLine.includes('funcionamiento') || lowerLine.includes('detenido'))) ||
      (lowerLine.includes('condición') && (lowerLine.includes('funcionamiento') || lowerLine.includes('detenido')));

    if (isHeaderLine) {
      continue;
    }

    if (line.startsWith('•') || line.match(/^\[?(VER|OÍR|OIR|SENTIR|OLER|ORDEN)\]?/i) || line.includes(' - ') || line.includes(': ')) {
      const cleanLine = line.replace(/^•\s*/, '').trim();

      const categoryMatch = cleanLine.match(/^\[?(VER|OÍR|OIR|SENTIR|OLER|ORDEN|ORDEN Y LIMPIEZA|5S)\]?[\s\-:]*/i);
      
      let category = categoryMatch ? categoryMatch[1].toUpperCase() : 'GENERAL';
      if (category === 'OIR') category = 'OÍR';

      const afterCat = categoryMatch ? cleanLine.substring(categoryMatch[0].length).trim() : cleanLine;
      
      const parts = afterCat.split(':');
      let rawTitle = parts[0]?.replace(/^-\s*/, '').trim() || 'Punto Inspeccionado';
      let detail = parts.slice(1).join(':').trim() || parts[0]?.trim() || '';

      const isSolved = detail.includes('[SOLUCIONADO]') || line.includes('Solucionado por operador');
      const statusMatch = detail.match(/^(Crítico|Observación|Bueno|Falla)/i);
      const statusStr = statusMatch ? statusMatch[1] : null;

      let status: 'Crítico' | 'Observación' | 'Bueno' | null = null;
      if (statusStr) {
        if (statusStr.toLowerCase().startsWith('crít') || statusStr.toLowerCase().startsWith('crit')) status = 'Crítico';
        else if (statusStr.toLowerCase().startsWith('obs')) status = 'Observación';
        else if (statusStr.toLowerCase().startsWith('buen')) status = 'Bueno';
      }

      let comment = statusStr ? detail.substring(statusStr.length).replace(/^[\s\-:]+/, '').trim() : detail;
      comment = comment.replace(/\[SOLUCIONADO\]/g, '').replace(/-\s*Solucionado por operador/gi, '').trim();

      if (rawTitle.toLowerCase() === comment.toLowerCase() || !comment) {
        rawTitle = `Ítem (${category})`;
        comment = detail.replace(/\[SOLUCIONADO\]/g, '').replace(/-\s*Solucionado por operador/gi, '').trim();
      }

      const item: ParsedItem = {
        category,
        rawTitle,
        detail,
        status,
        isSolved,
        comment: comment || (isSolved ? 'El hallazgo fue solucionado en terreno por el operador.' : 'Reportado por el operador sin detalles adicionales.')
      };

      if (category === 'ORDEN' || category === 'ORDEN Y LIMPIEZA' || category === '5S') {
        ordenItems.push(item);
      } else if (['VER', 'OÍR', 'SENTIR', 'OLER'].includes(category)) {
        vosoItems.push(item);
      } else if (currentSection === 'TRAD' || category === 'GENERAL') {
        // If raw title or comment explicitly marks [ORDEN] or Limpieza
        if (rawTitle.toUpperCase().includes('[ORDEN]') || rawTitle.toUpperCase().includes('LIMPIEZA') || comment.toUpperCase().includes('LIMPIEZA DE') || comment.toUpperCase().includes('ACUMULACION')) {
          ordenItems.push({ ...item, category: 'ORDEN' });
        } else {
          tradItems.push(item);
        }
      } else {
        vosoItems.push(item);
      }
    }
  }

  // Strict separation per active module filter
  if (effectiveModule === 'VOSO') {
    ordenItems = [];
    tradItems = tradItems.filter(i => {
      const u = (i.rawTitle + ' ' + i.comment + ' ' + i.category).toUpperCase();
      return !u.includes('[ORDEN]') && !u.includes('LIMPIEZA') && !u.includes('ASEO') && !u.includes('5S');
    });
  } else if (effectiveModule === 'OrdenYLimpieza') {
    vosoItems = [];
    tradItems = [];
  }

  return {
    header,
    vosoItems,
    ordenItems,
    tradItems,
    rawText: desc
  };
};

interface FindingDescriptionRendererProps {
  description: string;
  source?: string;
  filterModule?: 'ALL' | 'VOSO' | 'OrdenYLimpieza';
  className?: string;
  isPreview?: boolean;
}

export const FindingDescriptionRenderer: React.FC<FindingDescriptionRendererProps> = ({
  description,
  source,
  filterModule,
  className = "",
  isPreview = false
}) => {
  if (!description) return <p className={className}>-</p>;

  const effectiveModule = filterModule || (source === 'VOSO' ? 'VOSO' : source === 'OrdenYLimpieza' ? 'OrdenYLimpieza' : 'ALL');

  const cleanHeader = (desc: string) => {
    if (!desc) return '';
    let result = desc
      .replace(/^Reporte autogenerado de\s*/i, '')
      .replace(/^Inspección VOSO en\s*/i, '')
      .replace(/^Inspección en\s*/i, '')
      .replace(/^Inspección:\s*/i, '');

    result = result
      .replace(/[\.\s]*Condici[óo]n operativa: (En Funcionamiento|Detenido)[\.\s\]]*/gi, '')
      .replace(/[\s\.]*\[Condici[óo]n:.*?\]/gi, '')
      .replace(/[\s\.]*Condición operativa:.*?(\.|$)/gi, '')
      .replace(/[\s\.]*Condicion operativa:.*?(\.|$)/gi, '')
      .trim();

    if (result.endsWith('.')) {
      result = result.slice(0, -1).trim();
    }

    return result || desc;
  };

  if (isPreview) {
    const parsed = parseFindingDescription(description, source, effectiveModule);

    if (parsed.vosoItems.length > 0 || parsed.ordenItems.length > 0) {
      const vosoCats = Array.from(new Set(parsed.vosoItems.map(i => i.category)));
      const hasOrden = parsed.ordenItems.length > 0;
      
      const summaryText = parsed.vosoItems[0]?.comment || parsed.ordenItems[0]?.comment || parsed.rawText.split('\n')[0];

      return (
        <div className={`truncate flex items-center gap-2 ${className}`}>
          {vosoCats.length > 0 && (
            <span className="px-1.5 py-0.5 bg-sky-100 text-sky-800 dark:bg-sky-500/20 dark:text-sky-300 text-[9px] font-black rounded uppercase shrink-0">
              VOSO
            </span>
          )}
          {hasOrden && (
            <span className="px-1.5 py-0.5 bg-purple-100 text-purple-800 dark:bg-purple-500/20 dark:text-purple-300 text-[9px] font-black rounded uppercase shrink-0">
              5S
            </span>
          )}
          <span className="truncate">{cleanHeader(summaryText)}</span>
        </div>
      );
    }

    return <span className={`truncate block ${className}`}>{cleanHeader(description.split('\n')[0])}</span>;
  }

  const parsed = parseFindingDescription(description, source, effectiveModule);

  // If no items extracted and plain text, show elegant single observation card
  if (parsed.vosoItems.length === 0 && parsed.ordenItems.length === 0 && parsed.tradItems.length === 0) {
    return (
      <div className={`p-4 sm:p-5 bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-white/10 rounded-2xl shadow-xs ${className}`}>
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-sky-50 dark:bg-sky-500/10 text-sky-600 dark:text-sky-400 flex items-center justify-center shrink-0 border border-sky-100 dark:border-sky-500/20">
            <MessageSquare className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <span className="text-[10px] font-black text-sky-600 dark:text-sky-400 uppercase tracking-widest block mb-1">
              Detalle Ingresado por el Operador
            </span>
            <p className="text-zinc-900 dark:text-zinc-100 text-sm font-bold leading-relaxed whitespace-pre-wrap">
              {parsed.rawText}
            </p>
          </div>
        </div>
      </div>
    );
  }

  const criticalCount = [...parsed.vosoItems, ...parsed.ordenItems].filter(l => l.status === 'Crítico').length;
  const obsCount = [...parsed.vosoItems, ...parsed.ordenItems].filter(l => l.status === 'Observación').length;

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header Banner if available */}
      {parsed.header && (
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 bg-zinc-900 dark:bg-zinc-950 p-4 sm:p-5 rounded-2xl sm:rounded-3xl shadow-md border border-zinc-800 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-sky-500/10 rounded-full -mr-16 -mt-16 blur-2xl pointer-events-none" />
          <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center shrink-0 backdrop-blur-md border border-white/20">
            <LayoutDashboard className="w-6 h-6 text-sky-400" />
          </div>
          <div className="relative z-10 flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2 py-0.5 bg-sky-500/20 text-sky-300 text-[9px] font-black uppercase tracking-widest rounded border border-sky-500/30">
                Reporte Estructurado
              </span>
            </div>
            <h4 className="text-white font-black text-base sm:text-lg leading-tight uppercase tracking-tight">
              {cleanHeader(parsed.header)}
            </h4>
          </div>
        </div>
      )}

      {/* Summary Stats Badges */}
      {(criticalCount > 0 || obsCount > 0) && (
        <div className="grid grid-cols-2 gap-3">
          <div className={`p-3 rounded-2xl border flex items-center gap-3 ${criticalCount > 0 ? 'bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/20' : 'bg-zinc-50 dark:bg-zinc-900 border-zinc-200 dark:border-white/5 opacity-60'}`}>
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${criticalCount > 0 ? 'bg-red-500 text-white' : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-400'}`}>
              <AlertCircle className="w-5 h-5" />
            </div>
            <div>
              <p className={`text-xl font-black leading-none ${criticalCount > 0 ? 'text-red-600 dark:text-red-400' : 'text-zinc-400'}`}>{criticalCount}</p>
              <p className="text-[9px] font-black text-zinc-400 uppercase tracking-widest mt-0.5">Críticos</p>
            </div>
          </div>

          <div className={`p-3 rounded-2xl border flex items-center gap-3 ${obsCount > 0 ? 'bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/20' : 'bg-zinc-50 dark:bg-zinc-900 border-zinc-200 dark:border-white/5 opacity-60'}`}>
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${obsCount > 0 ? 'bg-amber-500 text-white' : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-400'}`}>
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <p className={`text-xl font-black leading-none ${obsCount > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-zinc-400'}`}>{obsCount}</p>
              <p className="text-[9px] font-black text-zinc-400 uppercase tracking-widest mt-0.5">Observaciones</p>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 1: INSPECCIÓN PRIMARIA (VOSO) */}
      {parsed.vosoItems.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 border-b border-sky-100 dark:border-sky-500/20 pb-2">
            <div className="w-7 h-7 rounded-lg bg-sky-500/10 text-sky-600 dark:text-sky-400 flex items-center justify-center">
              <Eye className="w-4 h-4" />
            </div>
            <h5 className="text-xs font-black text-sky-900 dark:text-sky-300 uppercase tracking-wider">
              1. Inspección Primaria (Metodología VOSO)
            </h5>
            <span className="ml-auto text-[10px] font-bold text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-500/10 px-2 py-0.5 rounded-full border border-sky-200 dark:border-sky-500/20">
              {parsed.vosoItems.length} {parsed.vosoItems.length === 1 ? 'ítem' : 'ítems'}
            </span>
          </div>

          <div className="grid gap-3">
            {parsed.vosoItems.map((item, i) => {
              const IconComp = VOSO_ICONS[item.category] || Eye;
              const styles = VOSO_COLORS[item.category] || VOSO_COLORS['VER'];

              return (
                <div 
                  key={`voso-item-${i}`} 
                  className={`p-4 bg-white dark:bg-zinc-900 border rounded-2xl shadow-xs transition-all relative overflow-hidden ${item.isSolved ? 'border-emerald-200 dark:border-emerald-500/30 bg-emerald-50/20 dark:bg-emerald-500/5' : 'border-zinc-200/80 dark:border-white/10'}`}
                >
                  <div className={`absolute top-0 left-0 w-1.5 h-full ${styles.accent}`} />
                  
                  <div className="flex items-start gap-3 pl-1">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${styles.bg} ${styles.text} ${styles.border}`}>
                      <IconComp className="w-5 h-5" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5 mb-2">
                        <span className={`text-[9px] font-black px-2 py-0.5 rounded-md border uppercase tracking-wider ${styles.bg} ${styles.text} ${styles.border}`}>
                          {item.category}
                        </span>

                        {item.status && (
                          <span className={`text-[9px] font-black px-2 py-0.5 rounded-md uppercase tracking-wider ${
                            item.status === 'Crítico' ? 'bg-red-500 text-white' :
                            item.status === 'Observación' ? 'bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300' :
                            'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400'
                          }`}>
                            {item.status}
                          </span>
                        )}

                        {item.isSolved && (
                          <span className="text-[9px] font-black bg-emerald-500 text-white px-2 py-0.5 rounded-md uppercase tracking-wider flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" />
                            SUBSANADO EN TERRENO
                          </span>
                        )}
                      </div>

                      <h6 className="text-zinc-900 dark:text-white font-black text-sm leading-tight tracking-tight mb-2">
                        {item.rawTitle}
                      </h6>

                      <div className="p-3 bg-zinc-50 dark:bg-zinc-950/80 rounded-xl border border-zinc-200/80 dark:border-white/10 space-y-1">
                        <div className="flex items-center gap-1.5 text-sky-600 dark:text-sky-400">
                          <MessageSquare className="w-3.5 h-3.5 shrink-0" />
                          <span className="text-[10px] font-black uppercase tracking-wider">
                            Detalle Ingresado por Operador:
                          </span>
                        </div>
                        <p className="text-zinc-800 dark:text-zinc-100 text-xs sm:text-sm font-semibold leading-relaxed">
                          {item.comment || item.detail || 'Sin comentarios adicionales.'}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* SECTION 2: ORDEN & LIMPIEZA (5S / ASEO) */}
      {parsed.ordenItems.length > 0 && (
        <div className="space-y-3 pt-2">
          <div className="flex items-center gap-2 border-b border-purple-100 dark:border-purple-500/20 pb-2">
            <div className="w-7 h-7 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center">
              <Sparkles className="w-4 h-4" />
            </div>
            <h5 className="text-xs font-black text-purple-900 dark:text-purple-300 uppercase tracking-wider">
              2. Orden & Limpieza (Programa 5S / Aseo)
            </h5>
            <span className="ml-auto text-[10px] font-bold text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-500/10 px-2 py-0.5 rounded-full border border-purple-200 dark:border-purple-500/20">
              {parsed.ordenItems.length} {parsed.ordenItems.length === 1 ? 'ítem' : 'ítems'}
            </span>
          </div>

          <div className="grid gap-3">
            {parsed.ordenItems.map((item, i) => (
              <div 
                key={`orden-item-${i}`} 
                className={`p-4 bg-white dark:bg-zinc-900 border rounded-2xl shadow-xs transition-all relative overflow-hidden ${item.isSolved ? 'border-emerald-200 dark:border-emerald-500/30 bg-emerald-50/20 dark:bg-emerald-500/5' : 'border-purple-200/80 dark:border-purple-500/20 bg-purple-50/10 dark:bg-purple-500/5'}`}
              >
                <div className="absolute top-0 left-0 w-1.5 h-full bg-purple-500" />
                
                <div className="flex items-start gap-3 pl-1">
                  <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0 border border-purple-200 dark:border-purple-500/20">
                    <Sparkles className="w-5 h-5" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5 mb-2">
                      <span className="text-[9px] font-black px-2 py-0.5 rounded-md border uppercase tracking-wider bg-purple-500 text-white border-purple-500">
                        5S - ORDEN & LIMPIEZA
                      </span>

                      {item.status && (
                        <span className={`text-[9px] font-black px-2 py-0.5 rounded-md uppercase tracking-wider ${
                          item.status === 'Crítico' ? 'bg-red-500 text-white' :
                          item.status === 'Observación' ? 'bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300' :
                          'bg-purple-100 text-purple-800 dark:bg-purple-500/20 dark:text-purple-300'
                        }`}>
                          {item.status}
                        </span>
                      )}

                      {item.isSolved && (
                        <span className="text-[9px] font-black bg-emerald-500 text-white px-2 py-0.5 rounded-md uppercase tracking-wider flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" />
                          SUBSANADO EN TERRENO
                        </span>
                      )}
                    </div>

                    <h6 className="text-zinc-900 dark:text-white font-black text-sm leading-tight tracking-tight mb-2">
                      {item.rawTitle}
                    </h6>

                    <div className="p-3 bg-purple-50/50 dark:bg-zinc-950/80 rounded-xl border border-purple-200/60 dark:border-purple-500/20 space-y-1">
                      <div className="flex items-center gap-1.5 text-purple-700 dark:text-purple-300">
                        <MessageSquare className="w-3.5 h-3.5 shrink-0" />
                        <span className="text-[10px] font-black uppercase tracking-wider">
                          Detalle Ingresado por Operador:
                        </span>
                      </div>
                      <p className="text-zinc-900 dark:text-zinc-100 text-xs sm:text-sm font-semibold leading-relaxed">
                        {item.comment || item.detail || 'Falta de orden, aseo o disposición detectada.'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SECTION 3: CONTROLES ESTÁNDAR ADICIONALES */}
      {parsed.tradItems.length > 0 && (
        <div className="space-y-3 pt-2">
          <div className="flex items-center gap-2 border-b border-zinc-200 dark:border-white/10 pb-2">
            <div className="w-7 h-7 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 flex items-center justify-center">
              <FileSearch className="w-4 h-4" />
            </div>
            <h5 className="text-xs font-black text-zinc-700 dark:text-zinc-300 uppercase tracking-wider">
              Controles Estándar Adicionales
            </h5>
          </div>

          <div className="grid gap-2">
            {parsed.tradItems.map((item, i) => (
              <div key={`trad-item-${i}`} className="p-3 bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-white/10 rounded-xl flex items-center gap-3">
                <FileSearch className="w-4 h-4 text-zinc-400 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-black text-zinc-400 uppercase tracking-wider">Checklist Adicional</p>
                  <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200 block truncate">{item.rawTitle}</span>
                  {item.comment && item.comment !== item.rawTitle && (
                    <p className="text-xs font-semibold text-zinc-600 dark:text-zinc-300 mt-1 pl-2 border-l-2 border-amber-400">
                      {item.comment}
                    </p>
                  )}
                </div>
                <span className="text-[9px] font-black bg-amber-500 text-white px-2 py-0.5 rounded uppercase shrink-0">
                  {item.status || 'FALLA'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

