import React, { useState, useEffect } from 'react';
import { CameraOff } from 'lucide-react';
import { offlineMediaService } from '../services/OfflineMediaService';

interface OfflineImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src?: string;
  fallbackUrl?: string;
  fallbackSrcs?: string[];
}

export const OfflineImage: React.FC<OfflineImageProps> = ({
  src,
  fallbackUrl = '',
  fallbackSrcs = [],
  alt = '',
  className = '',
  referrerPolicy,
  ...props
}) => {
  const [localSrc, setLocalSrc] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [triedFallbackIndex, setTriedFallbackIndex] = useState<number>(-1);

  // Helper to normalize photo strings (e.g. raw base64)
  const normalizeSrc = (raw?: string | null): string | null => {
    if (!raw || typeof raw !== 'string') return null;
    let s = raw.trim();
    if (!s) return null;
    if (!s.startsWith('http://') && !s.startsWith('https://') && !s.startsWith('data:') && !s.startsWith('offline-cached://') && !s.startsWith('blob:')) {
      if (s.length > 50) {
        return `data:image/jpeg;base64,${s}`;
      }
    }
    return s;
  };

  useEffect(() => {
    let active = true;
    let objectUrl: string | null = null;
    setHasError(false);
    setTriedFallbackIndex(-1);

    const cleanSrc = normalizeSrc(src);

    if (!cleanSrc) {
      const fb = normalizeSrc(fallbackUrl) || (fallbackSrcs.length > 0 ? normalizeSrc(fallbackSrcs[0]) : null);
      setLocalSrc(fb);
      setIsLoading(false);
      if (!fb) setHasError(true);
      return;
    }

    if (cleanSrc.startsWith('offline-cached://')) {
      const mediaId = cleanSrc.replace('offline-cached://', '');
      setIsLoading(true);
      offlineMediaService.retrieveMedia(mediaId)
        .then(async (data) => {
          if (!active) return;
          if (data instanceof Blob) {
            objectUrl = URL.createObjectURL(data);
            setLocalSrc(objectUrl);
            setIsLoading(false);
          } else if (typeof data === 'string' && data.length > 0) {
            setLocalSrc(normalizeSrc(data));
            setIsLoading(false);
          } else {
            // Fallback: if mediaId has index suffix (e.g. media_fnd_123_idx_0), try base mediaId (media_fnd_123)
            if (mediaId.includes('_idx_')) {
              const baseMediaId = mediaId.split('_idx_')[0];
              try {
                const baseData = await offlineMediaService.retrieveMedia(baseMediaId);
                if (active) {
                  if (baseData instanceof Blob) {
                    objectUrl = URL.createObjectURL(baseData);
                    setLocalSrc(objectUrl);
                    setIsLoading(false);
                    return;
                  } else if (typeof baseData === 'string' && baseData.length > 0) {
                    setLocalSrc(normalizeSrc(baseData));
                    setIsLoading(false);
                    return;
                  }
                }
              } catch (e) {
                // Ignore fallback error
              }
            }

            const fb = normalizeSrc(fallbackUrl) || (fallbackSrcs.length > 0 ? normalizeSrc(fallbackSrcs[0]) : null);
            setLocalSrc(fb);
            if (!fb) setHasError(true);
            setIsLoading(false);
          }
        })
        .catch((err) => {
          console.warn('[OfflineImage] Error retrieving offline media:', err);
          if (active) {
            const fb = normalizeSrc(fallbackUrl) || (fallbackSrcs.length > 0 ? normalizeSrc(fallbackSrcs[0]) : null);
            setLocalSrc(fb);
            if (!fb) setHasError(true);
            setIsLoading(false);
          }
        });
    } else {
      setLocalSrc(cleanSrc);
      setIsLoading(false);
    }

    return () => {
      active = false;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [src, fallbackUrl]);

  const handleError = () => {
    const allFallbacks = [
      fallbackUrl,
      ...fallbackSrcs
    ].map(normalizeSrc).filter((item): item is string => !!item && item !== localSrc);

    const nextIdx = triedFallbackIndex + 1;
    if (nextIdx < allFallbacks.length) {
      setTriedFallbackIndex(nextIdx);
      const nextSrc = allFallbacks[nextIdx];

      if (nextSrc.startsWith('offline-cached://')) {
        const mediaId = nextSrc.replace('offline-cached://', '');
        offlineMediaService.retrieveMedia(mediaId).then((data) => {
          if (data instanceof Blob) {
            setLocalSrc(URL.createObjectURL(data));
          } else if (typeof data === 'string' && data.length > 0) {
            setLocalSrc(normalizeSrc(data));
          } else {
            setHasError(true);
          }
        }).catch(() => setHasError(true));
      } else {
        setLocalSrc(nextSrc);
      }
    } else {
      setHasError(true);
    }
  };

  if (isLoading) {
    return (
      <div className={`animate-pulse bg-zinc-200 dark:bg-zinc-800 rounded-xl ${className}`} />
    );
  }

  const finalSrc = localSrc;

  if (hasError || !finalSrc) {
    return (
      <div className={`flex flex-col items-center justify-center bg-zinc-100 dark:bg-zinc-800/80 text-zinc-400 dark:text-zinc-500 rounded-xl p-3 border border-zinc-200/50 dark:border-white/5 text-center ${className}`}>
        <CameraOff className="w-6 h-6 mb-1 opacity-50" />
        <span className="text-[10px] font-bold uppercase tracking-wider">Sin Fotografía</span>
      </div>
    );
  }

  return (
    <img
      src={finalSrc}
      className={className}
      alt={alt}
      onError={handleError}
      referrerPolicy={referrerPolicy || "no-referrer"}
      {...props}
    />
  );
};

