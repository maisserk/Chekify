import React from 'react';

export interface IOSTabItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
  badge?: number | string;
}

export interface IOSTabsProps {
  tabs: IOSTabItem[];
  activeTab: string;
  onChange: (id: string) => void;
  variant?: 'segmented' | 'underline' | 'pills';
  fullWidth?: boolean;
  className?: string;
}

export const IOSTabs: React.FC<IOSTabsProps> = ({
  tabs,
  activeTab,
  onChange,
  variant = 'segmented',
  fullWidth = true,
  className = ''
}) => {
  if (variant === 'segmented') {
    return (
      <div
        role="tablist"
        className={`
          flex items-center p-1 bg-[#E5E5EA]/70 dark:bg-[#2C2C2E]/70 rounded-xl md:rounded-2xl
          ${fullWidth ? 'w-full' : 'inline-flex'}
          ${className}
        `}
      >
        {tabs.map((tab) => {
          const isActive = tab.id === activeTab;
          return (
            <button
              key={tab.id}
              role="tab"
              aria-selected={isActive}
              onClick={() => onChange(tab.id)}
              className={`
                relative flex items-center justify-center gap-2 py-2 px-3 text-xs md:text-sm font-semibold rounded-lg md:rounded-xl transition-all duration-200 select-none cursor-pointer
                ${fullWidth ? 'flex-1' : ''}
                ${isActive
                  ? 'bg-white dark:bg-[#1C1C1E] text-[#1D1D1F] dark:text-[#F5F5F7] shadow-sm font-bold'
                  : 'text-[#6E6E73] dark:text-[#98989D] hover:text-[#1D1D1F] dark:hover:text-[#F5F5F7]'
                }
              `}
            >
              {tab.icon && <span className="shrink-0">{tab.icon}</span>}
              <span className="truncate">{tab.label}</span>
              {tab.badge !== undefined && (
                <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded-full ${
                  isActive ? 'bg-[#0071E3] text-white' : 'bg-[#D2D2D7] dark:bg-[#3A3A3C] text-[#1D1D1F] dark:text-[#F5F5F7]'
                }`}>
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div
      role="tablist"
      className={`
        flex items-center gap-1 border-b border-[#D2D2D7]/40 dark:border-white/10
        ${fullWidth ? 'w-full' : ''}
        ${className}
      `}
    >
      {tabs.map((tab) => {
        const isActive = tab.id === activeTab;
        return (
          <button
            key={tab.id}
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(tab.id)}
            className={`
              relative flex items-center gap-2 py-3 px-4 text-sm font-semibold transition-colors cursor-pointer select-none
              ${isActive
                ? 'text-[#0071E3] dark:text-[#0A84FF]'
                : 'text-[#6E6E73] dark:text-[#98989D] hover:text-[#1D1D1F] dark:hover:text-[#F5F5F7]'
              }
            `}
          >
            {tab.icon && <span className="shrink-0">{tab.icon}</span>}
            <span>{tab.label}</span>
            {isActive && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#0071E3] dark:bg-[#0A84FF] rounded-full" />
            )}
          </button>
        );
      })}
    </div>
  );
};
