import React, { useState, useEffect } from 'react';
import { offlineMediaService } from '../services/OfflineMediaService';

interface OfflineImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src?: string;
  fallbackUrl?: string;
}

export const OfflineImage: React.FC<OfflineImageProps> = ({
  src,
  fallbackUrl = 'https://picsum.photos/seed/finding_fallback/400/300',
  alt = '',
  className,
  referrerPolicy,
  ...props
}) => {
  const [localSrc, setLocalSrc] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let active = true;
    let objectUrl: string | null = null;

    if (!src) {
      setLocalSrc(fallbackUrl);
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
            setLocalSrc(fallbackUrl);
          }
          setIsLoading(false);
        })
        .catch((err) => {
          console.warn('[OfflineImage] Error retrieving offline media:', err);
          if (active) {
            setLocalSrc(fallbackUrl);
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
      <div className={`animate-pulse bg-zinc-200 dark:bg-zinc-800 ${className}`} />
    );
  }

  return (
    <img
      src={localSrc || fallbackUrl}
      className={className}
      alt={alt}
      referrerPolicy={referrerPolicy || "no-referrer"}
      {...props}
    />
  );
};
