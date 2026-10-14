import React from 'react';

export type FindingStatusType = 'Cerrado' | 'En proceso' | 'Crítico' | 'Pendiente' | 'Abierto' | 'En Revisión' | 'En Proceso';

export interface IOSStatusIndicatorProps {
  status: FindingStatusType | string;
  size?: 'sm' | 'md';
  className?: string;
}

export const IOSStatusIndicator: React.FC<IOSStatusIndicatorProps> = ({
  status,
  size = 'md',
  className = ''
}) => {
  const normalized = (status || '').toLowerCase().trim();

  let config = {
    label: status,
    dotColor: 'bg-[#8E8E93]',
    textColor: 'text-[#6E6E73] dark:text-[#98989D]',
    bgColor: 'bg-[#8E8E93]/10 dark:bg-[#8E8E93]/15'
  };

  if (normalized.includes('cerrad')) {
    config = {
      label: 'Cerrado',
      dotColor: 'bg-[#34C759]',
      textColor: 'text-[#248A3D] dark:text-[#30D158]',
      bgColor: 'bg-[#34C759]/10 dark:bg-[#34C759]/15'
    };
  } else if (normalized.includes('proceso') || normalized.includes('revisión')) {
    config = {
      label: normalized.includes('revisión') ? 'En Revisión' : 'En proceso',
      dotColor: 'bg-[#FF9500]',
      textColor: 'text-[#C96800] dark:text-[#FF9F0A]',
      bgColor: 'bg-[#FF9500]/10 dark:bg-[#FF9F0A]/15'
    };
  } else if (normalized.includes('crític') || normalized.includes('critic') || normalized.includes('alta')) {
    config = {
      label: 'Crítico',
      dotColor: 'bg-[#FF3B30]',
      textColor: 'text-[#D70015] dark:text-[#FF453A]',
      bgColor: 'bg-[#FF3B30]/10 dark:bg-[#FF453A]/15'
    };
  } else if (normalized.includes('pend') || normalized.includes('abierto')) {
    config = {
      label: 'Pendiente',
      dotColor: 'bg-[#8E8E93]',
      textColor: 'text-[#6E6E73] dark:text-[#AEAEB2]',
      bgColor: 'bg-[#8E8E93]/10 dark:bg-[#8E8E93]/15'
    };
  }

  const sizeStyles = {
    sm: 'text-[10px] px-2 py-0.5 gap-1.5',
    md: 'text-xs px-2.5 py-1 gap-1.5'
  }[size];

  return (
    <span
      className={`
        inline-flex items-center font-semibold rounded-full select-none
        ${config.bgColor}
        ${config.textColor}
        ${sizeStyles}
        ${className}
      `}
    >
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${config.dotColor}`} />
      <span className="truncate">{config.label}</span>
    </span>
  );
};
