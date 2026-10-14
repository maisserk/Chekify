import React from 'react';

export interface IOSNavigationBarProps {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  leftAction?: React.ReactNode;
  rightAction?: React.ReactNode;
  largeTitle?: boolean;
  className?: string;
}

export const IOSNavigationBar: React.FC<IOSNavigationBarProps> = ({
  title,
  subtitle,
  leftAction,
  rightAction,
  largeTitle = false,
  className = ''
}) => {
  return (
    <header className={`sticky top-0 z-30 bg-[#F5F5F7]/85 dark:bg-black/80 ios-glass border-b border-[#D2D2D7]/30 dark:border-white/5 transition-colors ${className}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-3">
        {/* Left Action */}
        <div className="flex items-center gap-2 min-w-[44px]">
          {leftAction}
        </div>

        {/* Center / Inline Title */}
        {!largeTitle && title && (
          <div className="flex-1 text-center min-w-0 px-2">
            <h1 className="text-sm sm:text-base font-bold text-[#1D1D1F] dark:text-[#F5F5F7] truncate tracking-tight">
              {title}
            </h1>
            {subtitle && (
              <p className="text-[10px] text-[#6E6E73] dark:text-[#98989D] truncate">
                {subtitle}
              </p>
            )}
          </div>
        )}

        {/* Right Action */}
        <div className="flex items-center justify-end gap-2 min-w-[44px]">
          {rightAction}
        </div>
      </div>

      {/* Large Title (iOS style scroll transition) */}
      {largeTitle && title && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-1 pb-3">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#1D1D1F] dark:text-[#F5F5F7] tracking-tight">
            {title}
          </h1>
          {subtitle && (
            <p className="text-xs text-[#6E6E73] dark:text-[#98989D] mt-0.5">
              {subtitle}
            </p>
          )}
        </div>
      )}
    </header>
  );
};

export interface IOSBottomTabBarItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  badge?: number | string;
}

export interface IOSBottomTabBarProps {
  items: IOSBottomTabBarItem[];
  activeId: string;
  onChange: (id: string) => void;
  className?: string;
}

export const IOSBottomTabBar: React.FC<IOSBottomTabBarProps> = ({
  items,
  activeId,
  onChange,
  className = ''
}) => {
  return (
    <nav className={`fixed bottom-0 left-0 right-0 z-40 bg-[#F5F5F7]/90 dark:bg-[#1C1C1E]/90 ios-glass border-t border-[#D2D2D7]/40 dark:border-white/10 md:hidden pwa-safe-bottom ${className}`}>
      <div className="flex items-center justify-around h-14 max-w-md mx-auto px-2">
        {items.map((item) => {
          const isActive = item.id === activeId;
          return (
            <button
              key={item.id}
              onClick={() => onChange(item.id)}
              className={`
                flex flex-col items-center justify-center flex-1 py-1 transition-all duration-150 relative cursor-pointer select-none
                ${isActive ? 'text-[#0071E3] dark:text-[#0A84FF]' : 'text-[#8E8E93] dark:text-[#98989D] hover:text-[#1D1D1F] dark:hover:text-[#F5F5F7]'}
              `}
            >
              <div className="relative">
                <span className={`w-5 h-5 flex items-center justify-center transition-transform ${isActive ? 'scale-110' : ''}`}>
                  {item.icon}
                </span>
                {item.badge !== undefined && (
                  <span className="absolute -top-1.5 -right-2 min-w-[16px] h-4 px-1 rounded-full bg-[#FF3B30] text-white text-[9px] font-bold flex items-center justify-center leading-none">
                    {item.badge}
                  </span>
                )}
              </div>
              <span className={`text-[10px] mt-1 font-semibold tracking-tight ${isActive ? 'font-bold' : ''}`}>
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
