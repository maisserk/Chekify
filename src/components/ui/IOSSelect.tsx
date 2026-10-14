import React from 'react';
import { ChevronDown } from 'lucide-react';

export interface IOSSelectOption {
  value: string;
  label: string;
}

export interface IOSSelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  helperText?: string;
  leftIcon?: React.ReactNode;
  options?: IOSSelectOption[];
}

export const IOSSelect = React.forwardRef<HTMLSelectElement, IOSSelectProps>(({
  label,
  error,
  helperText,
  leftIcon,
  options,
  children,
  className = '',
  id,
  ...props
}, ref) => {
  const selectId = id || (label ? `ios-select-${label.toLowerCase().replace(/\s+/g, '-')}` : undefined);

  return (
    <div className="w-full space-y-1.5">
      {label && (
        <label htmlFor={selectId} className="block text-xs font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] tracking-tight">
          {label}
        </label>
      )}
      <div className="relative flex items-center">
        {leftIcon && (
          <div className="absolute left-3.5 text-[#8E8E93] dark:text-[#98989D] pointer-events-none shrink-0 z-10">
            {leftIcon}
          </div>
        )}
        <select
          ref={ref}
          id={selectId}
          className={`
            w-full appearance-none bg-[#E5E5EA]/50 dark:bg-[#2C2C2E]/60 text-[#1D1D1F] dark:text-[#F5F5F7]
            text-sm rounded-xl md:rounded-2xl
            px-3.5 py-2.5 pr-10 min-h-[44px]
            ${leftIcon ? 'pl-10' : ''}
            border border-transparent
            focus:outline-none focus:bg-white dark:focus:bg-[#1C1C1E]
            focus:border-[#0071E3]/40 focus:ring-2 focus:ring-[#0071E3]/20
            transition-all duration-150 cursor-pointer
            ${error ? 'border-[#FF3B30] focus:border-[#FF3B30] focus:ring-[#FF3B30]/20' : ''}
            ${className}
          `}
          {...props}
        >
          {options ? options.map(opt => (
            <option key={opt.value} value={opt.value} className="bg-white dark:bg-[#1C1C1E] text-[#1D1D1F] dark:text-[#F5F5F7]">
              {opt.label}
            </option>
          )) : children}
        </select>
        <div className="absolute right-3.5 text-[#8E8E93] dark:text-[#98989D] pointer-events-none shrink-0">
          <ChevronDown className="w-4 h-4 stroke-[2.5]" />
        </div>
      </div>
      {error && (
        <p className="text-[11px] font-medium text-[#FF3B30] pl-1">
          {error}
        </p>
      )}
      {!error && helperText && (
        <p className="text-[11px] text-[#6E6E73] dark:text-[#98989D] pl-1">
          {helperText}
        </p>
      )}
    </div>
  );
});

IOSSelect.displayName = 'IOSSelect';
