import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X } from 'lucide-react';

export interface IOSBottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
  showCloseButton?: boolean;
}

export const IOSBottomSheet: React.FC<IOSBottomSheetProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  showCloseButton = true
}) => {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center overflow-hidden">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/40 dark:bg-black/70 backdrop-blur-sm"
          />

          {/* Sheet Container */}
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 320 }}
            className="relative w-full max-w-lg bg-white dark:bg-[#1C1C1E] rounded-t-[28px] shadow-2xl border-t border-[#D2D2D7]/40 dark:border-white/10 max-h-[90vh] flex flex-col overflow-hidden z-10"
          >
            {/* Grab Handle */}
            <div className="pt-3 pb-1 flex justify-center shrink-0">
              <div className="w-10 h-1.5 rounded-full bg-[#D2D2D7] dark:bg-[#3A3A3C]" />
            </div>

            {/* Header */}
            {(title || showCloseButton) && (
              <div className="flex items-center justify-between px-5 py-3 border-b border-[#D2D2D7]/30 dark:border-white/5 shrink-0">
                <div className="min-w-0 flex-1 pr-3">
                  {title && (
                    <h3 className="text-base font-bold text-[#1D1D1F] dark:text-[#F5F5F7] truncate tracking-tight">
                      {title}
                    </h3>
                  )}
                  {subtitle && (
                    <p className="text-xs text-[#6E6E73] dark:text-[#98989D] truncate mt-0.5">
                      {subtitle}
                    </p>
                  )}
                </div>

                {showCloseButton && (
                  <button
                    onClick={onClose}
                    className="w-8 h-8 rounded-full bg-[#E5E5EA] dark:bg-[#2C2C2E] text-[#6E6E73] dark:text-[#98989D] hover:text-[#1D1D1F] dark:hover:text-[#F5F5F7] flex items-center justify-center transition-colors cursor-pointer shrink-0"
                    title="Cerrar"
                  >
                    <X className="w-4 h-4 stroke-[2.5]" />
                  </button>
                )}
              </div>
            )}

            {/* Content */}
            <div className="p-5 overflow-y-auto custom-scrollbar flex-1">
              {children}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
