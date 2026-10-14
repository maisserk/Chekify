import React from 'react';

export interface IOSKpiCardProps {
  title: string;
  value: string | number;
  unit?: string;
  subtitle?: string;
  trend?: {
    value: string;
    isPositive?: boolean;
    neutral?: boolean;
  };
  icon?: React.ReactNode;
  iconBgColor?: string;
  onClick?: () => void;
  className?: string;
}

export const IOSKpiCard: React.FC<IOSKpiCardProps> = ({
  title,
  value,
  unit,
  subtitle,
  trend,
  icon,
  iconBgColor = 'bg-[#0071E3]',
  onClick,
  className = ''
}) => {
  const isInteractive = !!onClick;

  return (
    <div
      onClick={onClick}
      role={isInteractive ? 'button' : undefined}
      tabIndex={isInteractive ? 0 : undefined}
      className={`
        bg-white dark:bg-[#1C1C1E] rounded-2xl md:rounded-3xl p-4 sm:p-5
        border border-[#D2D2D7]/40 dark:border-white/10 ios-card-shadow
        flex flex-col justify-between transition-all
        ${isInteractive ? 'ios-card-hover cursor-pointer active:scale-[0.98]' : ''}
        ${className}
      `}
    >
      <div className="flex items-center justify-between gap-3 mb-2">
        <span className="text-xs sm:text-sm font-semibold text-[#6E6E73] dark:text-[#98989D] truncate tracking-tight">
          {title}
        </span>
        {icon && (
          <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-white shrink-0 shadow-xs ${iconBgColor}`}>
            {icon}
          </div>
        )}
      </div>

      <div className="flex items-baseline gap-1 mt-0.5">
        <span className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#1D1D1F] dark:text-[#F5F5F7] font-mono tabular-nums">
          {value}
        </span>
        {unit && (
          <span className="text-xs sm:text-sm font-semibold text-[#6E6E73] dark:text-[#98989D]">
            {unit}
          </span>
        )}
      </div>

      {(subtitle || trend) && (
        <div className="flex items-center justify-between gap-2 mt-2 pt-2 border-t border-[#D2D2D7]/20 dark:border-white/5 text-[11px]">
          {subtitle && (
            <span className="text-[#6E6E73] dark:text-[#98989D] truncate">
              {subtitle}
            </span>
          )}
          {trend && (
            <span
              className={`font-semibold shrink-0 ${
                trend.neutral
                  ? 'text-[#6E6E73] dark:text-[#98989D]'
                  : trend.isPositive
                  ? 'text-[#34C759] dark:text-[#30D158]'
                  : 'text-[#FF3B30] dark:text-[#FF453A]'
              }`}
            >
              {trend.value}
            </span>
          )}
        </div>
      )}
    </div>
  );
};
