import React from 'react';

export interface IOSAvatarProps {
  src?: string;
  name?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  status?: 'online' | 'offline' | 'busy';
  className?: string;
}

export const IOSAvatar: React.FC<IOSAvatarProps> = ({
  src,
  name,
  size = 'md',
  status,
  className = ''
}) => {
  const sizeStyles = {
    sm: 'w-7 h-7 text-xs',
    md: 'w-9 h-9 text-sm',
    lg: 'w-12 h-12 text-base font-semibold',
    xl: 'w-16 h-16 text-xl font-bold'
  }[size];

  const getInitials = (n?: string) => {
    if (!n) return 'U';
    const parts = n.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  const statusColors = {
    online: 'bg-[#34C759]',
    offline: 'bg-[#8E8E93]',
    busy: 'bg-[#FF3B30]'
  };

  return (
    <div className={`relative inline-flex shrink-0 ${className}`}>
      {src ? (
        <img
          src={src}
          alt={name || 'Avatar'}
          referrerPolicy="no-referrer"
          className={`${sizeStyles} rounded-full object-cover border border-[#D2D2D7]/40 dark:border-white/10`}
        />
      ) : (
        <div
          className={`
            ${sizeStyles} rounded-full bg-[#E5E5EA] dark:bg-[#2C2C2E]
            text-[#1D1D1F] dark:text-[#F5F5F7] font-semibold
            flex items-center justify-center select-none
            border border-[#D2D2D7]/30 dark:border-white/10
          `}
        >
          {getInitials(name)}
        </div>
      )}
      {status && (
        <span
          className={`
            absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full ring-2 ring-white dark:ring-[#1C1C1E]
            ${statusColors[status]}
          `}
        />
      )}
    </div>
  );
};
