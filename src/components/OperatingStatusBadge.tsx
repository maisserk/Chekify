import React from 'react';
import { Finding } from '../types';

export function getFindingOperatingStatus(finding: Finding | null | undefined): 'En Funcionamiento' | 'Detenido' {
  if (!finding) return 'En Funcionamiento';
  const directStatus = (finding as any).equipmentOperatingStatus || (finding as any).operatingStatus;
  if (directStatus === 'Detenido') return 'Detenido';
  if (directStatus === 'En Funcionamiento') return 'En Funcionamiento';

  const desc = finding.description || '';
  const lower = desc.toLowerCase();
  if (
    lower.includes('condición operativa: detenido') ||
    lower.includes('condicion operativa: detenido') ||
    lower.includes('equipo detenido') ||
    lower.includes('inspeccionado detenido') ||
    lower.includes('detenido')
  ) {
    return 'Detenido';
  }

  return 'En Funcionamiento';
}

interface OperatingStatusBadgeProps {
  finding: Finding | null | undefined;
  size?: 'sm' | 'md';
  className?: string;
}

export const OperatingStatusBadge: React.FC<OperatingStatusBadgeProps> = ({
  finding,
  size = 'sm',
  className = ''
}) => {
  const status = getFindingOperatingStatus(finding);
  const isDetenido = status === 'Detenido';

  const label = isDetenido ? 'Inspeccionado Detenido' : 'Inspeccionado en Funcionamiento';
  const icon = isDetenido ? '🛑' : '⚡';

  const sizeClasses = size === 'md' 
    ? 'px-2.5 py-1 text-xs gap-1.5' 
    : 'px-2 py-0.5 text-[9px] gap-1';

  return (
    <span
      className={`inline-flex items-center font-extrabold uppercase tracking-wider rounded-md border shadow-2xs whitespace-nowrap ${sizeClasses} ${
        isDetenido
          ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/30'
          : 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/30'
      } ${className}`}
    >
      <span>{icon}</span>
      <span>{label}</span>
    </span>
  );
};
