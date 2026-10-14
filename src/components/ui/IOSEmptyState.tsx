import React from 'react';
import { IOSButton } from './IOSButton';

export interface IOSEmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
    icon?: React.ReactNode;
  };
  className?: string;
}

export const IOSEmptyState: React.FC<IOSEmptyStateProps> = ({
  icon,
  title,
  description,
  action,
  className = ''
}) => {
  return (
    <div className={`flex flex-col items-center justify-center text-center p-8 sm:p-12 max-w-md mx-auto ${className}`}>
      {icon && (
        <div className="w-16 h-16 rounded-3xl bg-[#E5E5EA]/60 dark:bg-[#2C2C2E]/60 text-[#8E8E93] dark:text-[#98989D] flex items-center justify-center mb-4 shadow-xs">
          {icon}
        </div>
      )}
      <h3 className="text-base sm:text-lg font-bold text-[#1D1D1F] dark:text-[#F5F5F7] tracking-tight">
        {title}
      </h3>
      {description && (
        <p className="text-xs sm:text-sm text-[#6E6E73] dark:text-[#98989D] mt-1.5 leading-relaxed">
          {description}
        </p>
      )}
      {action && (
        <div className="mt-5">
          <IOSButton
            variant="primary"
            size="md"
            onClick={action.onClick}
            leftIcon={action.icon}
          >
            {action.label}
          </IOSButton>
        </div>
      )}
    </div>
  );
};
