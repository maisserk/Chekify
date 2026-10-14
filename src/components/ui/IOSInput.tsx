import React from 'react';

export interface IOSInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const IOSInput = React.forwardRef<HTMLInputElement, IOSInputProps>(({
  label,
  error,
  helperText,
  leftIcon,
  rightIcon,
  className = '',
  id,
  ...props
}, ref) => {
  const inputId = id || (label ? `ios-input-${label.toLowerCase().replace(/\s+/g, '-')}` : undefined);

  return (
    <div className="w-full space-y-1.5">
      {label && (
        <label htmlFor={inputId} className="block text-xs font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] tracking-tight">
          {label}
        </label>
      )}
      <div className="relative flex items-center">
        {leftIcon && (
          <div className="absolute left-3.5 text-[#8E8E93] dark:text-[#98989D] pointer-events-none shrink-0">
            {leftIcon}
          </div>
        )}
        <input
          ref={ref}
          id={inputId}
          className={`
            w-full bg-[#E5E5EA]/50 dark:bg-[#2C2C2E]/60 text-[#1D1D1F] dark:text-[#F5F5F7]
            placeholder:text-[#8E8E93] dark:placeholder:text-[#636366]
            text-sm rounded-xl md:rounded-2xl
            px-3.5 py-2.5 min-h-[44px]
            ${leftIcon ? 'pl-10' : ''}
            ${rightIcon ? 'pr-10' : ''}
            border border-transparent
            focus:outline-none focus:bg-white dark:focus:bg-[#1C1C1E]
            focus:border-[#0071E3]/40 focus:ring-2 focus:ring-[#0071E3]/20
            transition-all duration-150
            ${error ? 'border-[#FF3B30] focus:border-[#FF3B30] focus:ring-[#FF3B30]/20' : ''}
            ${className}
          `}
          {...props}
        />
        {rightIcon && (
          <div className="absolute right-3.5 text-[#8E8E93] dark:text-[#98989D] pointer-events-none shrink-0">
            {rightIcon}
          </div>
        )}
      </div>
      {error ? (
        <p className="text-[11px] font-medium text-[#FF3B30] mt-1 pl-1">
          {error}
        </p>
      ) : helperText ? (
        <p className="text-[11px] text-[#6E6E73] dark:text-[#98989D] mt-1 pl-1">
          {helperText}
        </p>
      ) : null}
    </div>
  );
});

IOSInput.displayName = 'IOSInput';

export interface IOSTextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

export const IOSTextarea = React.forwardRef<HTMLTextAreaElement, IOSTextareaProps>(({
  label,
  error,
  helperText,
  className = '',
  id,
  ...props
}, ref) => {
  const textareaId = id || (label ? `ios-textarea-${label.toLowerCase().replace(/\s+/g, '-')}` : undefined);

  return (
    <div className="w-full space-y-1.5">
      {label && (
        <label htmlFor={textareaId} className="block text-xs font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] tracking-tight">
          {label}
        </label>
      )}
      <textarea
        ref={ref}
        id={textareaId}
        className={`
          w-full bg-[#E5E5EA]/50 dark:bg-[#2C2C2E]/60 text-[#1D1D1F] dark:text-[#F5F5F7]
          placeholder:text-[#8E8E93] dark:placeholder:text-[#636366]
          text-sm rounded-xl md:rounded-2xl
          p-3.5 min-h-[90px]
          border border-transparent
          focus:outline-none focus:bg-white dark:focus:bg-[#1C1C1E]
          focus:border-[#0071E3]/40 focus:ring-2 focus:ring-[#0071E3]/20
          transition-all duration-150 resize-y
          ${error ? 'border-[#FF3B30] focus:border-[#FF3B30] focus:ring-[#FF3B30]/20' : ''}
          ${className}
        `}
        {...props}
      />
      {error ? (
        <p className="text-[11px] font-medium text-[#FF3B30] mt-1 pl-1">
          {error}
        </p>
      ) : helperText ? (
        <p className="text-[11px] text-[#6E6E73] dark:text-[#98989D] mt-1 pl-1">
          {helperText}
        </p>
      ) : null}
    </div>
  );
});

IOSTextarea.displayName = 'IOSTextarea';
