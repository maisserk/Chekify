import React from 'react';

export interface IOSBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'primary' | 'success' | 'warning' | 'danger' | 'neutral';
  size?: 'sm' | 'md';
  dot?: boolean;
}

export const IOSBadge: React.FC<IOSBadgeProps> = ({
  children,
  variant = 'neutral',
  size = 'md',
  dot = false,
  className = '',
  ...props
}) => {
  const variantStyles = {
    primary: "bg-[#0071E3]/12 text-[#0071E3] dark:bg-[#0071E3]/20 dark:text-[#0A84FF]",
    success: "bg-[#34C759]/12 text-[#248A3D] dark:bg-[#30D158]/20 dark:text-[#30D158]",
    warning: "bg-[#FF9500]/12 text-[#C96800] dark:bg-[#FF9F0A]/20 dark:text-[#FF9F0A]",
    danger: "bg-[#FF3B30]/12 text-[#D70015] dark:bg-[#FF453A]/20 dark:text-[#FF453A]",
    neutral: "bg-[#8E8E93]/12 text-[#636366] dark:bg-[#8E8E93]/20 dark:text-[#AEAEB2]"
  }[variant];

  const dotColors = {
    primary: "bg-[#0071E3] dark:bg-[#0A84FF]",
    success: "bg-[#34C759] dark:bg-[#30D158]",
    warning: "bg-[#FF9500] dark:bg-[#FF9F0A]",
    danger: "bg-[#FF3B30] dark:bg-[#FF453A]",
    neutral: "bg-[#8E8E93] dark:bg-[#AEAEB2]"
  }[variant];

  const sizeStyles = {
    sm: "px-2 py-0.5 text-[10px]",
    md: "px-2.5 py-0.5 text-xs"
  }[size];

  return (
    <span
      className={`
        inline-flex items-center gap-1.5 font-semibold rounded-full tracking-tight select-none
        ${variantStyles}
        ${sizeStyles}
        ${className}
      `}
      {...props}
    >
      {dot && <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotColors}`} />}
      <span>{children}</span>
    </span>
  );
};
