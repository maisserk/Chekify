import React from 'react';
import { ChevronRight } from 'lucide-react';

export interface IOSListItemProps {
  icon?: React.ReactNode;
  iconBgColor?: string;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  detail?: React.ReactNode;
  badge?: React.ReactNode;
  chevron?: boolean;
  onClick?: () => void;
  destructive?: boolean;
  disabled?: boolean;
  className?: string;
}

export const IOSListItem: React.FC<IOSListItemProps> = ({
  icon,
  iconBgColor = 'bg-[#0071E3]',
  title,
  subtitle,
  detail,
  badge,
  chevron = false,
  onClick,
  destructive = false,
  disabled = false,
  className = ''
}) => {
  const isClickable = !!onClick && !disabled;

  return (
    <div
      onClick={isClickable ? onClick : undefined}
      role={isClickable ? 'button' : undefined}
      tabIndex={isClickable ? 0 : undefined}
      className={`
        flex items-center justify-between gap-3.5 px-4 py-3 sm:py-3.5 transition-colors
        ${isClickable ? 'hover:bg-black/[0.02] dark:hover:bg-white/[0.03] active:bg-black/[0.05] dark:active:bg-white/[0.06] cursor-pointer select-none' : ''}
        ${disabled ? 'opacity-40 cursor-not-allowed' : ''}
        ${className}
      `}
    >
      <div className="flex items-center gap-3.5 min-w-0 flex-1">
        {icon && (
          <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-white shrink-0 shadow-xs ${iconBgColor}`}>
            {icon}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className={`text-sm font-medium tracking-tight truncate ${destructive ? 'text-[#FF3B30]' : 'text-[#1D1D1F] dark:text-[#F5F5F7]'}`}>
            {title}
          </div>
          {subtitle && (
            <div className="text-xs text-[#6E6E73] dark:text-[#98989D] truncate mt-0.5">
              {subtitle}
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {badge}
        {detail && (
          <span className="text-xs text-[#8E8E93] dark:text-[#98989D] font-normal">
            {detail}
          </span>
        )}
        {chevron && (
          <ChevronRight className="w-4 h-4 text-[#C7C7CC] dark:text-[#48484A] stroke-[2.5]" />
        )}
      </div>
    </div>
  );
};
