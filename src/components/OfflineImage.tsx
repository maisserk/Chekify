import React, { useState, useEffect } from 'react';
import { CameraOff } from 'lucide-react';
import { offlineMediaService } from '../services/OfflineMediaService';

interface OfflineImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src?: string;
  fallbackUrl?: string;
}

export const OfflineImage: React.FC<OfflineImageProps> = ({
  src,
  fallbackUrl = '',
  alt = '',
  className = '',
  referrerPolicy,
  ...props
}) => {
  const [localSrc, setLocalSrc] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    let active = true;
    let objectUrl: string | null = null;
    setHasError(false);

    if (!src) {
      setLocalSrc(fallbackUrl || null);
      setIsLoading(false);
      return;
    }

    if (src.startsWith('offline-cached://')) {
      const mediaId = src.replace('offline-cached://', '');
      setIsLoading(true);
      offlineMediaService.retrieveMedia(mediaId)
        .then((data) => {
          if (!active) return;
          if (data instanceof Blob) {
            objectUrl = URL.createObjectURL(data);
            setLocalSrc(objectUrl);
          } else if (typeof data === 'string' && data.length > 0) {
            setLocalSrc(data);
          } else {
            setLocalSrc(fallbackUrl || null);
            if (!fallbackUrl) setHasError(true);
          }
          setIsLoading(false);
        })
        .catch((err) => {
          console.warn('[OfflineImage] Error retrieving offline media:', err);
          if (active) {
            setLocalSrc(fallbackUrl || null);
            if (!fallbackUrl) setHasError(true);
            setIsLoading(false);
          }
        });
    } else {
      setLocalSrc(src);
      setIsLoading(false);
    }

    return () => {
      active = false;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [src, fallbackUrl]);

  if (isLoading) {
    return (
      <div className={`animate-pulse bg-zinc-200 dark:bg-zinc-800 rounded-xl ${className}`} />
    );
  }

  const finalSrc = localSrc || fallbackUrl;

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
      onError={() => setHasError(true)}
      referrerPolicy={referrerPolicy || "no-referrer"}
      {...props}
    />
  );
};

