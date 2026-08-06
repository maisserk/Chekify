import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronLeft, ChevronRight, Image as ImageIcon, Camera, Maximize2, X, CloudOff } from 'lucide-react';
import { OfflineImage } from './OfflineImage';
import { Finding } from '../types';

export const isPendingUpload = (url: string | null | undefined): boolean => {
  if (!url || typeof url !== 'string') return false;
  const trimmed = url.trim();
  return trimmed.startsWith('offline-cached://') || trimmed.startsWith('data:');
};

export const extractFindingPhotos = (finding: Finding | null | undefined): string[] => {
  if (!finding) return [];
  const rawList: string[] = [];

  if (Array.isArray(finding.photoUrls) && finding.photoUrls.length > 0) {
    finding.photoUrls.forEach(p => {
      if (p && typeof p === 'string' && p.trim()) {
        rawList.push(p.trim());
      }
    });
  }

  if (finding.photoUrl && typeof finding.photoUrl === 'string' && finding.photoUrl.trim()) {
    rawList.push(finding.photoUrl.trim());
  }

  if ((finding as any).vosoResponses && typeof (finding as any).vosoResponses === 'object') {
    Object.values((finding as any).vosoResponses).forEach((resp: any) => {
      if (resp?.photoUrl && typeof resp.photoUrl === 'string' && resp.photoUrl.trim()) {
        rawList.push(resp.photoUrl.trim());
      }
      if (Array.isArray(resp?.photoUrls)) {
        resp.photoUrls.forEach((p: string) => {
          if (p && typeof p === 'string' && p.trim()) rawList.push(p.trim());
        });
      }
    });
  }

  if ((finding as any).voso && typeof (finding as any).voso === 'object') {
    Object.values((finding as any).voso).forEach((resp: any) => {
      if (resp?.photoUrl && typeof resp.photoUrl === 'string' && resp.photoUrl.trim()) {
        rawList.push(resp.photoUrl.trim());
      }
      if (Array.isArray(resp?.photoUrls)) {
        resp.photoUrls.forEach((p: string) => {
          if (p && typeof p === 'string' && p.trim()) rawList.push(p.trim());
        });
      }
    });
  }

  if (rawList.length === 0) return [];

  const result: string[] = [];
  const seenSignatures = new Set<string>();

  const getSignature = (str: string): string => {
    if (str.startsWith('offline-cached://')) {
      return str;
    }
    if (str.startsWith('data:image/')) {
      const commaIdx = str.indexOf(',');
      const payload = commaIdx !== -1 ? str.substring(commaIdx + 1) : str;
      if (payload.length > 100) {
        return `b64_${payload.length}_${payload.substring(0, 50)}_${payload.substring(payload.length - 50)}`;
      }
      return `b64_${payload}`;
    }
    try {
      const url = new URL(str);
      return `url_${url.origin}${url.pathname}`;
    } catch {
      return `str_${str}`;
    }
  };

  const hasDataUrlOrHttp = rawList.some(p => !p.startsWith('offline-cached://'));

  for (const item of rawList) {
    if (item.startsWith('offline-cached://') && hasDataUrlOrHttp) {
      continue;
    }

    const sig = getSignature(item);
    if (!seenSignatures.has(sig)) {
      seenSignatures.add(sig);
      result.push(item);
    }
  }

  return result;
};

interface FindingPhotoGalleryProps {
  photos: string[];
  initialIndex?: number;
  className?: string;
  altPrefix?: string;
  onClose?: () => void;
  showCloseButton?: boolean;
}

export const FindingPhotoGallery: React.FC<FindingPhotoGalleryProps> = ({
  photos = [],
  initialIndex = 0,
  className = '',
  altPrefix = 'Foto de hallazgo',
  onClose,
  showCloseButton = false,
}) => {
  const validPhotos = Array.from(new Set(photos.filter(p => p && typeof p === 'string' && p.trim() !== '')));
  const [currentIndex, setCurrentIndex] = useState<number>(initialIndex);
  const [isZoomed, setIsZoomed] = useState<boolean>(false);

  useEffect(() => {
    if (initialIndex >= 0 && initialIndex < validPhotos.length) {
      setCurrentIndex(initialIndex);
    }
  }, [initialIndex, validPhotos.length]);

  if (validPhotos.length === 0) {
    return (
      <div className={`w-full h-full min-h-[220px] bg-zinc-900/90 flex flex-col items-center justify-center p-6 text-zinc-500 ${className}`}>
        <Camera className="w-10 h-10 mb-2 opacity-40" />
        <span className="text-xs font-semibold">Sin fotografías registradas</span>
      </div>
    );
  }

  const handlePrev = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setCurrentIndex(prev => (prev === 0 ? validPhotos.length - 1 : prev - 1));
  };

  const handleNext = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setCurrentIndex(prev => (prev === validPhotos.length - 1 ? 0 : prev + 1));
  };

  const currentPhoto = validPhotos[currentIndex] || validPhotos[0];

  return (
    <div className={`relative w-full h-full min-h-[260px] bg-zinc-950 flex flex-col justify-between overflow-hidden select-none ${className}`}>
      {/* Top Bar / Badge */}
      <div className="absolute top-3 left-3 right-3 z-20 flex items-center justify-between pointer-events-none">
        <div className="flex items-center gap-2 pointer-events-auto">
          {validPhotos.length > 1 ? (
            <div className="px-3 py-1.5 rounded-full bg-black/60 backdrop-blur-md text-white text-[11px] font-bold tracking-wider flex items-center gap-1.5 border border-white/10 shadow-lg">
              <Camera className="w-3.5 h-3.5 text-sky-400" />
              <span>
                Foto {currentIndex + 1} de {validPhotos.length}
              </span>
            </div>
          ) : (
            <div className="px-2.5 py-1 rounded-full bg-black/50 backdrop-blur-md text-zinc-300 text-[10px] font-semibold flex items-center gap-1 border border-white/10">
              <Camera className="w-3 h-3 text-emerald-400" />
              <span>1 Foto</span>
            </div>
          )}

          {isPendingUpload(currentPhoto) && (
            <div className="px-3 py-1.5 rounded-full bg-amber-500/95 text-white text-[10px] font-extrabold uppercase tracking-wider flex items-center gap-1.5 border border-amber-300/40 shadow-lg backdrop-blur-md animate-pulse">
              <CloudOff className="w-3.5 h-3.5 text-amber-100 shrink-0" />
              <span>Pendiente de subir a la nube (Offline)</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 pointer-events-auto">
          <button
            type="button"
            onClick={() => setIsZoomed(!isZoomed)}
            className="p-2 rounded-full bg-black/60 hover:bg-black/80 backdrop-blur-md text-white transition-all border border-white/10 shadow-md cursor-pointer"
            title="Ampliar Imagen"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
          {showCloseButton && onClose && (
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-full bg-black/60 hover:bg-black/80 backdrop-blur-md text-white transition-all border border-white/10 shadow-md cursor-pointer"
              title="Cerrar"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Main Image Viewer */}
      <div className="relative flex-1 w-full h-full flex items-center justify-center p-2 bg-zinc-950/90 overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentIndex}
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ duration: 0.2 }}
            className="w-full h-full flex items-center justify-center"
          >
            <OfflineImage
              src={currentPhoto}
              alt={`${altPrefix} ${currentIndex + 1}`}
              className={`w-full h-full ${isZoomed ? 'object-cover' : 'object-contain'} rounded-xl transition-all duration-300`}
              referrerPolicy="no-referrer"
            />
          </motion.div>
        </AnimatePresence>

        {/* Navigation Arrows if > 1 photo */}
        {validPhotos.length > 1 && (
          <>
            <button
              type="button"
              onClick={handlePrev}
              className="absolute left-3 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-black/60 hover:bg-black/90 backdrop-blur-md text-white flex items-center justify-center transition-all border border-white/15 shadow-xl active:scale-90 cursor-pointer"
              aria-label="Foto anterior"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
            <button
              type="button"
              onClick={handleNext}
              className="absolute right-3 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-black/60 hover:bg-black/90 backdrop-blur-md text-white flex items-center justify-center transition-all border border-white/15 shadow-xl active:scale-90 cursor-pointer"
              aria-label="Foto siguiente"
            >
              <ChevronRight className="w-6 h-6" />
            </button>
          </>
        )}
      </div>

      {/* Bottom Thumbnail Strip Gallery */}
      {validPhotos.length > 1 && (
        <div className="w-full p-2.5 bg-zinc-900/90 backdrop-blur-md border-t border-white/10 flex items-center justify-center gap-2 overflow-x-auto custom-scrollbar z-20 shrink-0">
          {validPhotos.map((photo, idx) => {
            const isActive = idx === currentIndex;
            const pending = isPendingUpload(photo);
            return (
              <button
                key={`thumb-${idx}`}
                type="button"
                onClick={() => setCurrentIndex(idx)}
                className={`relative w-12 h-12 rounded-lg overflow-hidden shrink-0 border transition-all cursor-pointer ${
                  isActive
                    ? 'border-sky-500 ring-2 ring-sky-500/80 scale-105 shadow-md shadow-sky-500/20'
                    : 'border-white/10 opacity-60 hover:opacity-100 hover:border-white/30'
                }`}
              >
                <OfflineImage
                  src={photo}
                  alt={`Miniatura ${idx + 1}`}
                  className="w-full h-full object-cover"
                />
                {pending && (
                  <div 
                    className="absolute top-0.5 right-0.5 z-20 w-3.5 h-3.5 rounded-full bg-amber-500 text-white flex items-center justify-center shadow-md border border-white/60 animate-pulse"
                    title="Foto pendiente de subir a la nube"
                  >
                    <CloudOff className="w-2 h-2" />
                  </div>
                )}
                {isActive && (
                  <div className="absolute inset-0 bg-sky-500/10 pointer-events-none" />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

interface FindingPhotoThumbnailsProps {
  photos: string[];
  onSelectPhoto?: (index: number) => void;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export const FindingPhotoThumbnails: React.FC<FindingPhotoThumbnailsProps> = ({
  photos = [],
  onSelectPhoto,
  className = '',
  size = 'md',
}) => {
  const validPhotos = Array.from(new Set(photos.filter(p => p && typeof p === 'string' && p.trim() !== '')));

  if (validPhotos.length === 0) return null;

  const dimensionClasses = {
    sm: 'w-10 h-10 rounded-lg',
    md: 'w-12 h-12 rounded-xl',
    lg: 'w-16 h-16 rounded-2xl',
  }[size];

  if (validPhotos.length === 1) {
    const isSinglePending = isPendingUpload(validPhotos[0]);
    return (
      <div className="inline-flex flex-col items-start gap-1">
        <div 
          onClick={() => onSelectPhoto && onSelectPhoto(0)}
          className={`relative ${dimensionClasses} overflow-hidden border border-zinc-200/60 dark:border-white/10 shadow-xs shrink-0 cursor-pointer group bg-zinc-900 ${className}`}
        >
          <OfflineImage
            src={validPhotos[0]}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            alt="Foto hallazgo"
          />
          {isSinglePending && (
            <div 
              className="absolute top-0.5 right-0.5 z-20 w-4 h-4 rounded-full bg-amber-500 text-white flex items-center justify-center shadow-md border border-white/60 animate-pulse" 
              title="Foto pendiente de subir a la nube (Conexión inestable)"
            >
              <CloudOff className="w-2.5 h-2.5" />
            </div>
          )}
        </div>
        {isSinglePending && (
          <span className="inline-flex items-center gap-1 text-[8px] font-extrabold uppercase tracking-wider text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-1.5 py-0.5 rounded-md border border-amber-200 dark:border-amber-500/30 whitespace-nowrap shadow-2xs animate-pulse">
            <CloudOff className="w-2.5 h-2.5 shrink-0" />
            <span>Pendiente Nube</span>
          </span>
        )}
      </div>
    );
  }

  // Gallery view with multiple photos
  const displayPhotos = validPhotos.slice(0, 3);
  const remainingCount = validPhotos.length - displayPhotos.length;
  const hasPending = validPhotos.some(isPendingUpload);

  return (
    <div className={`flex items-center gap-1.5 ${className}`}>
      <div className="flex items-center -space-x-3">
        {displayPhotos.map((photo, idx) => {
          const pending = isPendingUpload(photo);
          return (
            <div
              key={`grid-thumb-${idx}`}
              onClick={() => onSelectPhoto && onSelectPhoto(idx)}
              className={`relative ${dimensionClasses} overflow-hidden border-2 border-white dark:border-zinc-900 shadow-md shrink-0 cursor-pointer group bg-zinc-900 hover:z-10 transition-transform duration-200 hover:scale-110`}
              style={{ zIndex: displayPhotos.length - idx }}
            >
              <OfflineImage
                src={photo}
                className="w-full h-full object-cover"
                alt={`Foto ${idx + 1}`}
              />
              {pending && (
                <div 
                  className="absolute top-0.5 right-0.5 z-20 w-3.5 h-3.5 rounded-full bg-amber-500 text-white flex items-center justify-center shadow-md border border-white/60 animate-pulse"
                  title="Foto pendiente de subir a la nube"
                >
                  <CloudOff className="w-2 h-2" />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {remainingCount > 0 && (
        <button
          type="button"
          onClick={() => onSelectPhoto && onSelectPhoto(3)}
          className="px-2 py-1 bg-zinc-900/90 text-white dark:bg-white/10 dark:text-white rounded-lg text-[10px] font-black uppercase tracking-wider border border-white/10 shrink-0 hover:bg-zinc-800 cursor-pointer"
        >
          +{remainingCount}
        </button>
      )}

      {hasPending ? (
        <span 
          className="inline-flex items-center gap-1 text-[9px] font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded-full border border-amber-300 dark:border-amber-500/40 whitespace-nowrap shadow-xs animate-pulse"
          title="Fotografías guardadas localmente pendientes de subida automática a la nube"
        >
          <CloudOff className="w-2.5 h-2.5 shrink-0" />
          <span>Pendiente Subida</span>
        </span>
      ) : (
        <span className="text-[10px] font-extrabold text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-500/10 px-2 py-0.5 rounded-full border border-sky-500/20 shrink-0">
          📷 {validPhotos.length} fotos
        </span>
      )}
    </div>
  );
};
