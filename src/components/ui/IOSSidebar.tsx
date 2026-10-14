import React from 'react';

export interface IOSSidebarItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  badge?: number | string;
}

export interface IOSSidebarGroup {
  title?: string;
  items: IOSSidebarItem[];
}

export interface IOSSidebarProps {
  groups: IOSSidebarGroup[];
  activeId: string;
  onChange: (id: string) => void;
  header?: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
}

export const IOSSidebar: React.FC<IOSSidebarProps> = ({
  groups,
  activeId,
  onChange,
  header,
  footer,
  className = ''
}) => {
  return (
    <aside className={`w-64 bg-[#F5F5F7]/80 dark:bg-[#1C1C1E]/80 ios-glass border-r border-[#D2D2D7]/30 dark:border-white/5 flex flex-col h-screen sticky top-0 shrink-0 select-none ${className}`}>
      {header && (
        <div className="p-4 border-b border-[#D2D2D7]/30 dark:border-white/5">
          {header}
        </div>
      )}

      <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-6">
        {groups.map((group, gIdx) => (
          <div key={gIdx} className="space-y-1">
            {group.title && (
              <div className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-[#6E6E73] dark:text-[#98989D]">
                {group.title}
              </div>
            )}
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const isActive = item.id === activeId;
                return (
                  <button
                    key={item.id}
                    onClick={() => onChange(item.id)}
                    className={`
                      w-full flex items-center justify-between gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-colors cursor-pointer text-left
                      ${isActive
                        ? 'bg-[#0071E3] text-white font-semibold shadow-xs'
                        : 'text-[#1D1D1F] dark:text-[#F5F5F7] hover:bg-black/5 dark:hover:bg-white/5'
                      }
                    `}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-[#6E6E73] dark:text-[#98989D]'}`}>
                        {item.icon}
                      </span>
                      <span className="truncate">{item.label}</span>
                    </div>

                    {item.badge !== undefined && (
                      <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded-full shrink-0 ${
                        isActive
                          ? 'bg-white/20 text-white'
                          : 'bg-[#E5E5EA] dark:bg-[#2C2C2E] text-[#1D1D1F] dark:text-[#F5F5F7]'
                      }`}>
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {footer && (
        <div className="p-4 border-t border-[#D2D2D7]/30 dark:border-white/5">
          {footer}
        </div>
      )}
    </aside>
  );
};
