import React from 'react';
import { CheckCircle2, AlertTriangle, AlertCircle, Info, X } from 'lucide-react';

export interface IOSAlertProps {
  variant?: 'info' | 'success' | 'warning' | 'danger';
  title?: string;
  children: React.ReactNode;
  onClose?: () => void;
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

export const IOSAlert: React.FC<IOSAlertProps> = ({
  variant = 'info',
  title,
  children,
  onClose,
  action,
  className = ''
}) => {
  const variantStyles = {
    info: {
      bg: 'bg-[#0071E3]/8 dark:bg-[#0071E3]/15',
      border: 'border-[#0071E3]/20 dark:border-[#0071E3]/30',
      iconColor: 'text-[#0071E3] dark:text-[#0A84FF]',
      titleColor: 'text-[#0071E3] dark:text-[#0A84FF]',
      Icon: Info
    },
    success: {
      bg: 'bg-[#34C759]/8 dark:bg-[#34C759]/15',
      border: 'border-[#34C759]/20 dark:border-[#34C759]/30',
      iconColor: 'text-[#34C759] dark:text-[#30D158]',
      titleColor: 'text-[#248A3D] dark:text-[#30D158]',
      Icon: CheckCircle2
    },
    warning: {
      bg: 'bg-[#FF9500]/8 dark:bg-[#FF9500]/15',
      border: 'border-[#FF9500]/20 dark:border-[#FF9500]/30',
      iconColor: 'text-[#FF9500] dark:text-[#FF9F0A]',
      titleColor: 'text-[#C96800] dark:text-[#FF9F0A]',
      Icon: AlertTriangle
    },
    danger: {
      bg: 'bg-[#FF3B30]/8 dark:bg-[#FF3B30]/15',
      border: 'border-[#FF3B30]/20 dark:border-[#FF3B30]/30',
      iconColor: 'text-[#FF3B30] dark:text-[#FF453A]',
      titleColor: 'text-[#D70015] dark:text-[#FF453A]',
      Icon: AlertCircle
    }
  }[variant];

  const Icon = variantStyles.Icon;

  return (
    <div
      className={`
        rounded-2xl p-4 border transition-colors flex items-start gap-3.5
        ${variantStyles.bg}
        ${variantStyles.border}
        ${className}
      `}
    >
      <div className={`shrink-0 mt-0.5 ${variantStyles.iconColor}`}>
        <Icon className="w-5 h-5 stroke-[2.2]" />
      </div>

      <div className="flex-1 min-w-0">
        {title && (
          <h4 className={`text-sm font-semibold tracking-tight ${variantStyles.titleColor}`}>
            {title}
          </h4>
        )}
        <div className="text-xs text-[#1D1D1F] dark:text-[#F5F5F7] leading-relaxed mt-0.5">
          {children}
        </div>

        {action && (
          <div className="mt-2.5">
            <button
              onClick={action.onClick}
              className="text-xs font-semibold text-[#0071E3] dark:text-[#0A84FF] hover:underline cursor-pointer"
            >
              {action.label}
            </button>
          </div>
        )}
      </div>

      {onClose && (
        <button
          onClick={onClose}
          className="text-[#8E8E93] hover:text-[#1D1D1F] dark:hover:text-[#F5F5F7] p-1 rounded-full transition-colors shrink-0"
          title="Cerrar"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
};
