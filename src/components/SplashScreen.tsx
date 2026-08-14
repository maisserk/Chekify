import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { WifiOff, RefreshCw, CheckCircle2, Shield } from 'lucide-react';

interface SplashScreenProps {
  statusMessage?: string;
  isOffline?: boolean;
  onTimeoutRetry?: () => void;
  onForceContinue?: () => void;
}

export const SplashScreen: React.FC<SplashScreenProps> = ({
  statusMessage = 'Iniciando Checkify...',
  isOffline = false,
  onTimeoutRetry,
  onForceContinue,
}) => {
  const [showRetryOption, setShowRetryOption] = useState(false);

  // Remove the static HTML pre-splash if present
  useEffect(() => {
    const preSplash = document.getElementById('pwa-presplash');
    if (preSplash) {
      preSplash.style.opacity = '0';
      preSplash.style.transition = 'opacity 0.2s ease-out';
      setTimeout(() => {
        preSplash.remove();
      }, 200);
    }
  }, []);

  // Show friendly recovery if initialization takes longer than 4.5 seconds
  useEffect(() => {
    const timer = setTimeout(() => {
      setShowRetryOption(true);
    }, 4500);

    return () => clearTimeout(timer);
  }, []);

  return (
    <motion.div
      initial={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className="fixed inset-0 z-[99999] flex flex-col items-center justify-between bg-zinc-950 text-white p-6 select-none overflow-hidden"
      style={{
        paddingTop: 'max(24px, env(safe-area-inset-top))',
        paddingBottom: 'max(24px, env(safe-area-inset-bottom))'
      }}
    >
      {/* Top Status / Offline Pill */}
      <div className="w-full flex justify-center items-center h-10">
        <AnimatePresence>
          {isOffline && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-bold rounded-full shadow-sm"
            >
              <WifiOff className="w-3.5 h-3.5" />
              <span>Modo Offline</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Centered Identity & Tagline */}
      <div className="flex flex-col items-center justify-center text-center max-w-sm w-full -mt-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
          className="relative mb-4 flex items-center justify-center"
        >
          {/* Subtle Ambient Industrial Glow */}
          <div className="absolute -inset-4 bg-sky-500/10 rounded-full blur-2xl pointer-events-none" />
          
          <img
            src="/logo.png"
            alt="Checkify"
            className="h-14 sm:h-16 w-auto object-contain brightness-0 invert relative z-10 drop-shadow-md"
          />
        </motion.div>

        {/* Corporate Tagline */}
        <motion.h2
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.15, ease: 'easeOut' }}
          className="text-xs sm:text-sm font-semibold tracking-wide text-zinc-400 uppercase"
        >
          Gestión inteligente de inspecciones
        </motion.h2>

        {/* Loading Indicator & Real Dynamic Status */}
        <div className="mt-8 flex flex-col items-center w-full max-w-[220px]">
          {/* Industrial progress track */}
          <div className="w-full h-1 bg-zinc-800/80 rounded-full overflow-hidden relative">
            <motion.div
              className="absolute inset-y-0 left-0 bg-gradient-to-r from-sky-500 via-blue-500 to-sky-400 rounded-full shadow-sm"
              initial={{ x: '-100%', width: '40%' }}
              animate={{ x: ['-100%', '250%'] }}
              transition={{
                repeat: Infinity,
                duration: 1.2,
                ease: 'easeInOut'
              }}
            />
          </div>

          <motion.p
            key={statusMessage}
            initial={{ opacity: 0, y: 2 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -2 }}
            transition={{ duration: 0.2 }}
            className="text-[11px] font-medium text-zinc-400 mt-3 text-center tracking-normal truncate max-w-full"
          >
            {statusMessage}
          </motion.p>
        </div>

        {/* Fallback Action when waiting on network */}
        <AnimatePresence>
          {showRetryOption && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mt-6 flex flex-col items-center gap-2"
            >
              <p className="text-[11px] text-zinc-400 max-w-xs">
                Estamos preparando Checkify para su uso en terreno...
              </p>
              <div className="flex items-center gap-2 mt-1">
                {onTimeoutRetry && (
                  <button
                    onClick={onTimeoutRetry}
                    className="px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-200 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 shadow-sm active:scale-95"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>Reintentar</span>
                  </button>
                )}
                {onForceContinue && (
                  <button
                    onClick={onForceContinue}
                    className="px-3 py-1.5 bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold rounded-xl transition-all shadow-sm active:scale-95"
                  >
                    <span>Continuar</span>
                  </button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Bottom Footer Info */}
      <div className="w-full flex items-center justify-between text-[10px] text-zinc-400 font-medium px-2">
        <div className="flex items-center gap-1.5">
          <Shield className="w-3 h-3 text-sky-500" />
          <span>Industrial Enterprise PWA</span>
        </div>
        <span className="font-mono text-zinc-400">v2.4.0</span>
      </div>
    </motion.div>
  );
};
