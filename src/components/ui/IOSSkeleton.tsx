import React from 'react';

export interface IOSSkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'text' | 'circular' | 'rectangular' | 'card';
  width?: string | number;
  height?: string | number;
}

export const IOSSkeleton: React.FC<IOSSkeletonProps> = ({
  variant = 'text',
  width,
  height,
  className = '',
  style,
  ...props
}) => {
  const variantStyles = {
    text: 'h-4 w-full rounded-md',
    circular: 'rounded-full',
    rectangular: 'rounded-xl md:rounded-2xl',
    card: 'h-32 w-full rounded-2xl md:rounded-3xl'
  }[variant];

  return (
    <div
      className={`
        animate-pulse bg-[#E5E5EA] dark:bg-[#2C2C2E]
        ${variantStyles}
        ${className}
      `}
      style={{
        width,
        height,
        ...style
      }}
      {...props}
    />
  );
};

export const IOSCardSkeleton: React.FC<{ rows?: number }> = ({ rows = 3 }) => {
  return (
    <div className="bg-white dark:bg-[#1C1C1E] rounded-2xl md:rounded-3xl p-5 border border-[#D2D2D7]/30 dark:border-white/5 space-y-3.5">
      <div className="flex items-center gap-3">
        <IOSSkeleton variant="circular" className="w-10 h-10" />
        <div className="flex-1 space-y-1.5">
          <IOSSkeleton variant="text" className="w-1/3 h-4" />
          <IOSSkeleton variant="text" className="w-1/2 h-3" />
        </div>
      </div>
      <div className="space-y-2 pt-2">
        {Array.from({ length: rows }).map((_, i) => (
          <IOSSkeleton key={i} variant="text" className={`h-3 ${i === rows - 1 ? 'w-2/3' : 'w-full'}`} />
        ))}
      </div>
    </div>
  );
};
