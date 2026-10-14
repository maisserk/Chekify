import React from 'react';
import { Loader2 } from 'lucide-react';

export interface IOSLoadingStateProps {
  message?: string;
  className?: string;
}

export const IOSLoadingState: React.FC<IOSLoadingStateProps> = ({
  message = 'Cargando datos...',
  className = ''
}) => {
  return (
    <div className={`flex flex-col items-center justify-center p-10 text-center ${className}`}>
      <div className="w-10 h-10 rounded-2xl bg-white dark:bg-[#1C1C1E] border border-[#D2D2D7]/40 dark:border-white/10 ios-card-shadow flex items-center justify-center mb-3">
        <Loader2 className="w-5 h-5 text-[#0071E3] dark:text-[#0A84FF] animate-spin" />
      </div>
      <p className="text-xs font-semibold text-[#6E6E73] dark:text-[#98989D] tracking-tight">
        {message}
      </p>
    </div>
  );
};
