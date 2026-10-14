import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Wifi, WifiOff, RefreshCw, CheckCircle2 } from 'lucide-react';
import { useOfflineStatus } from '../hooks/useOfflineStatus';

interface ConnectivityBarProps {
  className?: string;
  isCompact?: boolean;
}

export const ConnectivityBar: React.FC<ConnectivityBarProps> = ({ 
  className = '', 
  isCompact = false 
}) => {
  const { isOnline, pendingCount, forceSync } = useOfflineStatus();
  const [showStatusToast, setShowStatusToast] = useState(false);
  const [statusMessage, setStatusMessage] = useState<'online' | 'offline' | 'syncing'>(
    isOnline ? 'online' : 'offline'
  );
  const [hasInitialized, setHasInitialized] = useState(false);

  useEffect(() => {
    if (!hasInitialized) {
      setHasInitialized(true);
      return;
    }

    if (!isOnline) {
      setStatusMessage('offline');
      setShowStatusToast(true);
    } else {
      if (pendingCount > 0) {
        setStatusMessage('syncing');
        setShowStatusToast(true);
        forceSync();
      } else {
        setStatusMessage('online');
        setShowStatusToast(true);
        const timer = setTimeout(() => {
          setShowStatusToast(false);
        }, 2500);
        return () => clearTimeout(timer);
      }
    }
  }, [isOnline, pendingCount, hasInitialized]);

  return (
    <div className={`inline-flex items-center ${className}`}>
      {/* Discreet Header Badge */}
      {!isOnline ? (
        <div 
          className="flex items-center gap-1.5 px-2.5 py-1 bg-[#8E8E93]/12 text-[#6E6E73] dark:text-[#AEAEB2] border border-[#D2D2D7]/40 dark:border-white/10 text-xs font-semibold rounded-full select-none"
          title="Sin conexión. Continuando en modo local."
        >
          <span className="w-1.5 h-1.5 rounded-full bg-[#FF9500]" />
          <span>Sin conexión</span>
          {pendingCount > 0 && (
            <span className="ml-0.5 px-1.5 py-0.2 bg-[#FF9500] text-white font-bold text-[10px] rounded-full">
              {pendingCount}
            </span>
          )}
        </div>
      ) : pendingCount > 0 ? (
        <button
          onClick={forceSync}
          className="flex items-center gap-1.5 px-2.5 py-1 bg-[#0071E3]/12 text-[#0071E3] dark:text-[#0A84FF] border border-[#0071E3]/20 text-xs font-semibold rounded-full hover:bg-[#0071E3]/20 transition-all cursor-pointer select-none"
          title="Sincronizando inspecciones pendientes con el servidor..."
        >
          <RefreshCw className="w-3 h-3 text-[#0071E3] dark:text-[#0A84FF] animate-spin shrink-0" />
          <span>Sincronizando...</span>
          <span className="ml-0.5 px-1.5 py-0.2 bg-[#0071E3] text-white font-bold text-[10px] rounded-full">
            {pendingCount}
          </span>
        </button>
      ) : isCompact ? (
        <div 
          className="flex items-center gap-1.5 px-2.5 py-1 bg-[#34C759]/10 text-[#248A3D] dark:text-[#30D158] border border-[#34C759]/20 text-xs font-semibold rounded-full select-none"
          title="Todo sincronizado con el servidor."
        >
          <span className="w-1.5 h-1.5 rounded-full bg-[#34C759]" />
          <span className="hidden sm:inline">Todo sincronizado</span>
        </div>
      ) : null}

      {/* Discreet Apple-style pill toast when network connectivity changes */}
      <AnimatePresence>
        {showStatusToast && !isCompact && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ type: 'spring', damping: 25, stiffness: 350 }}
            className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] pointer-events-none"
          >
            {statusMessage === 'offline' && (
              <div className="flex items-center gap-2 px-4 py-2 bg-white/95 dark:bg-[#1C1C1E]/95 ios-glass border border-[#D2D2D7]/50 dark:border-white/10 text-[#1D1D1F] dark:text-[#F5F5F7] rounded-full shadow-lg shadow-black/5 text-xs font-semibold">
                <WifiOff className="w-4 h-4 text-[#FF9500] shrink-0" />
                <span>Sin conexión</span>
                <span className="text-[#8E8E93] font-normal">· Guardando en dispositivo</span>
              </div>
            )}
            {statusMessage === 'syncing' && (
              <div className="flex items-center gap-2 px-4 py-2 bg-white/95 dark:bg-[#1C1C1E]/95 ios-glass border border-[#D2D2D7]/50 dark:border-white/10 text-[#1D1D1F] dark:text-[#F5F5F7] rounded-full shadow-lg shadow-black/5 text-xs font-semibold">
                <RefreshCw className="w-4 h-4 text-[#0071E3] dark:text-[#0A84FF] animate-spin shrink-0" />
                <span>Sincronizando...</span>
              </div>
            )}
            {statusMessage === 'online' && (
              <div className="flex items-center gap-2 px-4 py-2 bg-white/95 dark:bg-[#1C1C1E]/95 ios-glass border border-[#D2D2D7]/50 dark:border-white/10 text-[#1D1D1F] dark:text-[#F5F5F7] rounded-full shadow-lg shadow-black/5 text-xs font-semibold">
                <CheckCircle2 className="w-4 h-4 text-[#34C759] shrink-0" />
                <span>Todo sincronizado</span>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
