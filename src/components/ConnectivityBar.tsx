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
        }, 3000);
        return () => clearTimeout(timer);
      }
    }
  }, [isOnline, pendingCount, hasInitialized]);

  // If permanent compact badge requested (e.g. for header)
  return (
    <div className={`inline-flex items-center ${className}`}>
      {/* Permanent discreet badge */}
      {!isOnline ? (
        <div 
          className="flex items-center gap-1 px-2 py-0.5 bg-amber-500/10 dark:bg-amber-500/15 border border-amber-500/30 text-amber-700 dark:text-amber-300 text-[10px] font-bold rounded-lg shadow-2xs"
          title="Sin conexión a internet. La aplicación continuará funcionando con los datos almacenados localmente."
        >
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
          <WifiOff className="w-3 h-3 text-amber-500 shrink-0" />
          <span className="truncate">Modo offline</span>
          {pendingCount > 0 && (
            <span className="ml-0.5 px-1 py-0.2 bg-amber-500 text-black font-extrabold text-[8px] rounded-sm">
              {pendingCount}
            </span>
          )}
        </div>
      ) : pendingCount > 0 ? (
        <button
          onClick={forceSync}
          className="flex items-center gap-1 px-2 py-0.5 bg-sky-500/10 dark:bg-sky-500/15 border border-sky-500/30 text-sky-700 dark:text-sky-300 text-[10px] font-bold rounded-lg shadow-2xs hover:bg-sky-500/20 transition-all cursor-pointer"
          title="Sincronizando inspecciones pendientes con el servidor..."
        >
          <RefreshCw className="w-3 h-3 text-sky-500 animate-spin shrink-0" />
          <span className="truncate">Sincronizando...</span>
          <span className="ml-0.5 px-1 py-0.2 bg-sky-500 text-white font-extrabold text-[8px] rounded-sm">
            {pendingCount}
          </span>
        </button>
      ) : isCompact ? (
        <div 
          className="flex items-center gap-1 px-2 py-0.5 bg-emerald-500/10 dark:bg-emerald-500/15 border border-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold rounded-lg shadow-2xs"
          title="Conexión en línea activa y sincronizada."
        >
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          <Wifi className="w-3 h-3 text-emerald-500 shrink-0" />
          <span className="truncate hidden sm:inline">Conectado</span>
        </div>
      ) : null}

      {/* Floating Transition Toast when network switches */}
      <AnimatePresence>
        {showStatusToast && !isCompact && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -15, scale: 0.95 }}
            transition={{ duration: 0.25 }}
            className="fixed top-3 left-1/2 -translate-x-1/2 z-[100] max-w-sm pointer-events-none"
          >
            {statusMessage === 'offline' && (
              <div className="flex items-center gap-2 px-3.5 py-1.5 bg-zinc-900/95 backdrop-blur-md border border-amber-500/40 text-amber-300 rounded-2xl shadow-xl text-xs font-bold">
                <WifiOff className="w-4 h-4 text-amber-400 shrink-0" />
                <span>Modo offline • Datos locales activos</span>
              </div>
            )}
            {statusMessage === 'syncing' && (
              <div className="flex items-center gap-2 px-3.5 py-1.5 bg-zinc-900/95 backdrop-blur-md border border-sky-500/40 text-sky-300 rounded-2xl shadow-xl text-xs font-bold">
                <RefreshCw className="w-4 h-4 text-sky-400 animate-spin shrink-0" />
                <span>Conexión restaurada • Sincronizando...</span>
              </div>
            )}
            {statusMessage === 'online' && (
              <div className="flex items-center gap-2 px-3.5 py-1.5 bg-zinc-900/95 backdrop-blur-md border border-emerald-500/40 text-emerald-300 rounded-2xl shadow-xl text-xs font-bold">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Conectado al servidor</span>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
