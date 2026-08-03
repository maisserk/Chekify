import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronLeft, ChevronRight, Image as ImageIcon, Camera, Maximize2, X } from 'lucide-react';
import { OfflineImage } from './OfflineImage';
import { Finding } from '../types';

export const extractFindingPhotos = (finding: Finding | null | undefined): string[] => {
  if (!finding) return [];
  const list: string[] = [];

  if (Array.isArray(finding.photoUrls) && finding.photoUrls.length > 0) {
    finding.photoUrls.forEach(p => {
      if (p && typeof p === 'string' && p.trim() && !list.includes(p)) {
        list.push(p);
      }
    });
  }

  if (finding.photoUrl && typeof finding.photoUrl === 'string' && finding.photoUrl.trim()) {
    if (!list.includes(finding.photoUrl)) {
      list.push(finding.photoUrl);
    }
  }

  if ((finding as any).vosoResponses && typeof (finding as any).vosoResponses === 'object') {
    Object.values((finding as any).vosoResponses).forEach((resp: any) => {
      if (resp?.photoUrl && typeof resp.photoUrl === 'string' && resp.photoUrl.trim() && !list.includes(resp.photoUrl)) {
        list.push(resp.photoUrl);
      }
    });
  }

  return list;
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
  const validPhotos = photos.filter(p => p && typeof p === 'string' && p.trim() !== '');
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
        {validPhotos.length > 1 ? (
          <div className="px-3 py-1.5 rounded-full bg-black/60 backdrop-blur-md text-white text-[11px] font-bold tracking-wider flex items-center gap-1.5 border border-white/10 shadow-lg pointer-events-auto">
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
  const validPhotos = photos.filter(p => p && typeof p === 'string' && p.trim() !== '');

  if (validPhotos.length === 0) return null;

  const dimensionClasses = {
    sm: 'w-10 h-10 rounded-lg',
    md: 'w-12 h-12 rounded-xl',
    lg: 'w-16 h-16 rounded-2xl',
  }[size];

  if (validPhotos.length === 1) {
    return (
      <div 
        onClick={() => onSelectPhoto && onSelectPhoto(0)}
        className={`relative ${dimensionClasses} overflow-hidden border border-zinc-200/60 dark:border-white/10 shadow-xs shrink-0 cursor-pointer group bg-zinc-900 ${className}`}
      >
        <OfflineImage
          src={validPhotos[0]}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          alt="Foto hallazgo"
        />
      </div>
    );
  }

  // Gallery view with multiple photos
  const displayPhotos = validPhotos.slice(0, 3);
  const remainingCount = validPhotos.length - displayPhotos.length;

  return (
    <div className={`flex items-center gap-1.5 ${className}`}>
      <div className="flex items-center -space-x-3">
        {displayPhotos.map((photo, idx) => (
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
          </div>
        ))}
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

      <span className="text-[10px] font-extrabold text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-500/10 px-2 py-0.5 rounded-full border border-sky-500/20 shrink-0">
        📷 {validPhotos.length} fotos
      </span>
    </div>
  );
};
