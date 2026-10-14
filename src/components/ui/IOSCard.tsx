import React from 'react';

export interface IOSCardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'elevated' | 'grouped' | 'flat';
  padding?: 'none' | 'sm' | 'md' | 'lg';
  interactive?: boolean;
}

export const IOSCard = React.forwardRef<HTMLDivElement, IOSCardProps>(({
  children,
  variant = 'elevated',
  padding = 'md',
  interactive = false,
  className = '',
  ...props
}, ref) => {
  const variantStyles = {
    elevated: "bg-white dark:bg-[#1C1C1E] border border-[#D2D2D7]/40 dark:border-white/10 ios-card-shadow",
    grouped: "bg-white dark:bg-[#1C1C1E] border border-[#D2D2D7]/30 dark:border-white/5",
    flat: "bg-[#E5E5EA]/40 dark:bg-[#2C2C2E]/40 border border-transparent"
  }[variant];

  const paddingStyles = {
    none: "p-0",
    sm: "p-3 sm:p-4",
    md: "p-4 sm:p-5 md:p-6",
    lg: "p-6 sm:p-7 md:p-8"
  }[padding];

  return (
    <div
      ref={ref}
      className={`
        rounded-2xl md:rounded-3xl
        ${variantStyles}
        ${paddingStyles}
        ${interactive ? 'ios-card-hover cursor-pointer active:scale-[0.99] select-none' : ''}
        ${className}
      `}
      {...props}
    >
      {children}
    </div>
  );
});

IOSCard.displayName = 'IOSCard';

export interface IOSGroupedListProps extends React.HTMLAttributes<HTMLDivElement> {
  header?: React.ReactNode;
  footer?: React.ReactNode;
}

export const IOSGroupedList: React.FC<IOSGroupedListProps> = ({
  header,
  footer,
  children,
  className = '',
  ...props
}) => {
  return (
    <div className={`space-y-1.5 ${className}`} {...props}>
      {header && (
        <div className="px-4 text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-[#6E6E73] dark:text-[#98989D]">
          {header}
        </div>
      )}
      <div className="bg-white dark:bg-[#1C1C1E] rounded-2xl md:rounded-3xl border border-[#D2D2D7]/40 dark:border-white/10 ios-card-shadow overflow-hidden divide-y divide-[#D2D2D7]/30 dark:divide-white/5">
        {children}
      </div>
      {footer && (
        <div className="px-4 text-[11px] text-[#6E6E73] dark:text-[#98989D]">
          {footer}
        </div>
      )}
    </div>
  );
};

export interface IOSGroupedRowProps extends React.HTMLAttributes<HTMLDivElement> {
  icon?: React.ReactNode;
  iconBgColor?: string;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  value?: React.ReactNode;
  chevron?: boolean;
  onClick?: () => void;
}

export const IOSGroupedRow: React.FC<IOSGroupedRowProps> = ({
  icon,
  iconBgColor = 'bg-[#0071E3]',
  title,
  subtitle,
  value,
  chevron = false,
  onClick,
  className = '',
  ...props
}) => {
  const isClickable = !!onClick;

  return (
    <div
      onClick={onClick}
      role={isClickable ? 'button' : undefined}
      tabIndex={isClickable ? 0 : undefined}
      className={`
        flex items-center justify-between gap-3 px-4 py-3 sm:py-3.5 transition-colors
        ${isClickable ? 'hover:bg-black/[0.02] dark:hover:bg-white/[0.03] active:bg-black/[0.05] dark:active:bg-white/[0.06] cursor-pointer select-none' : ''}
        ${className}
      `}
      {...props}
    >
      <div className="flex items-center gap-3 min-w-0 flex-1">
        {icon && (
          <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-white shrink-0 shadow-xs ${iconBgColor}`}>
            {icon}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-[#1D1D1F] dark:text-[#F5F5F7] truncate">
            {title}
          </div>
          {subtitle && (
            <div className="text-xs text-[#6E6E73] dark:text-[#98989D] truncate mt-0.5">
              {subtitle}
            </div>
          )}
        </div>
      </div>

      {(value || chevron) && (
        <div className="flex items-center gap-2 shrink-0">
          {value && (
            <span className="text-xs sm:text-sm text-[#6E6E73] dark:text-[#98989D] font-medium">
              {value}
            </span>
          )}
          {chevron && (
            <svg className="w-4 h-4 text-[#D2D2D7] dark:text-[#6E6E73]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
            </svg>
          )}
        </div>
      )}
    </div>
  );
};
