import React from 'react';
import { Loader2 } from 'lucide-react';

export interface IOSButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'tinted' | 'plain' | 'destructive';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  fullWidth?: boolean;
}

export const IOSButton = React.forwardRef<HTMLButtonElement, IOSButtonProps>(({
  children,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  leftIcon,
  rightIcon,
  fullWidth = false,
  className = '',
  disabled,
  ...props
}, ref) => {
  const baseStyles = "inline-flex items-center justify-center font-semibold rounded-xl md:rounded-2xl transition-all duration-150 select-none cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0071E3] focus-visible:ring-offset-2 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100 min-h-[44px]";

  const variantStyles = {
    primary: "bg-[#0071E3] hover:bg-[#0077ED] active:bg-[#0062C4] text-white shadow-sm shadow-[#0071E3]/20",
    secondary: "bg-[#E5E5EA] hover:bg-[#DCDCE2] active:bg-[#D1D1D6] text-[#1D1D1F] dark:bg-[#2C2C2E] dark:hover:bg-[#3A3A3C] dark:active:bg-[#48484A] dark:text-[#F5F5F7]",
    tinted: "bg-[#0071E3]/10 hover:bg-[#0071E3]/15 active:bg-[#0071E3]/20 text-[#0071E3] dark:bg-[#0071E3]/20 dark:hover:bg-[#0071E3]/25 dark:text-[#0A84FF]",
    plain: "bg-transparent hover:bg-black/5 active:bg-black/10 text-[#0071E3] dark:hover:bg-white/5 dark:active:bg-white/10 dark:text-[#0A84FF]",
    destructive: "bg-[#FF3B30] hover:bg-[#E0342A] active:bg-[#C42E25] text-white shadow-sm shadow-[#FF3B30]/20"
  }[variant];

  const sizeStyles = {
    sm: "px-3 py-1.5 text-xs gap-1.5 min-h-[36px]",
    md: "px-4 py-2.5 text-sm gap-2 min-h-[44px]",
    lg: "px-6 py-3.5 text-base gap-2.5 min-h-[50px]"
  }[size];

  return (
    <button
      ref={ref}
      disabled={disabled || isLoading}
      className={`
        ${baseStyles}
        ${variantStyles}
        ${sizeStyles}
        ${fullWidth ? 'w-full' : ''}
        ${className}
      `}
      {...props}
    >
      {isLoading ? (
        <Loader2 className="w-4 h-4 animate-spin shrink-0" />
      ) : (
        leftIcon && <span className="shrink-0">{leftIcon}</span>
      )}
      <span className="truncate">{children}</span>
      {!isLoading && rightIcon && <span className="shrink-0">{rightIcon}</span>}
    </button>
  );
});

IOSButton.displayName = 'IOSButton';
