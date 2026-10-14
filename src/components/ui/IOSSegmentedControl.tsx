import React from 'react';
import { motion } from 'motion/react';

export interface IOSSegmentedControlOption<T extends string = string> {
  id: T;
  label: React.ReactNode;
  icon?: React.ReactNode;
  badge?: number | string;
}

export interface IOSSegmentedControlProps<T extends string = string> {
  options: IOSSegmentedControlOption<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
  size?: 'sm' | 'md';
}

export function IOSSegmentedControl<T extends string = string>({
  options,
  value,
  onChange,
  className = '',
  size = 'md'
}: IOSSegmentedControlProps<T>) {
  return (
    <div
      role="tablist"
      className={`
        inline-flex items-center p-1 bg-[#E5E5EA]/70 dark:bg-[#2C2C2E]/70 rounded-xl md:rounded-2xl select-none backdrop-blur-md
        ${className}
      `}
    >
      {options.map((option) => {
        const isActive = option.id === value;
        return (
          <button
            key={option.id}
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(option.id)}
            className={`
              relative flex items-center justify-center gap-1.5 font-semibold transition-colors duration-150 rounded-lg md:rounded-xl cursor-pointer
              ${size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-3.5 py-1.5 text-xs sm:text-sm'}
              ${isActive ? 'text-[#1D1D1F] dark:text-[#F5F5F7]' : 'text-[#6E6E73] dark:text-[#98989D] hover:text-[#1D1D1F] dark:hover:text-[#F5F5F7]'}
            `}
          >
            {isActive && (
              <motion.div
                layoutId="ios-segmented-pill"
                transition={{ type: 'spring', stiffness: 450, damping: 35 }}
                className="absolute inset-0 bg-white dark:bg-[#1C1C1E] rounded-lg md:rounded-xl shadow-xs"
              />
            )}
            <span className="relative z-10 flex items-center gap-1.5">
              {option.icon && <span className="shrink-0">{option.icon}</span>}
              <span className="truncate">{option.label}</span>
              {option.badge !== undefined && (
                <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded-full ${isActive ? 'bg-[#0071E3] text-white' : 'bg-black/10 dark:bg-white/10 text-inherit'}`}>
                  {option.badge}
                </span>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}
