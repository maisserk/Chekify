import { useState, useCallback, useEffect, useRef } from 'react';

export function useFlashlight() {
  const [isTorchOn, setIsTorchOn] = useState(false);
  const [isSupported, setIsSupported] = useState<boolean | null>(null);
  const [isScreenFlashOn, setIsScreenFlashOn] = useState(false);
  const mediaStreamRef = useRef<MediaStream | null>(null);

  const turnOff = useCallback(() => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => {
        try {
          track.applyConstraints({ advanced: [{ torch: false }] } as any);
        } catch (e) {}
        track.stop();
      });
      mediaStreamRef.current = null;
    }
    setIsTorchOn(false);
    setIsScreenFlashOn(false);
  }, []);

  const toggleFlashlight = useCallback(async () => {
    try {
      if (isTorchOn) {
        turnOff();
        return;
      }

      // Check if MediaDevices API is available
      if (typeof navigator === 'undefined' || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setIsScreenFlashOn(true);
        setIsTorchOn(true);
        return;
      }

      let stream = mediaStreamRef.current;
      if (!stream || stream.getVideoTracks().length === 0 || !stream.active) {
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: { exact: 'environment' } }
          });
        } catch (exactErr) {
          stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'environment' }
          });
        }
        mediaStreamRef.current = stream;
      }

      const track = stream.getVideoTracks()[0];
      if (!track) {
        setIsScreenFlashOn(true);
        setIsTorchOn(true);
        return;
      }

      const capabilities = (track.getCapabilities ? track.getCapabilities() : {}) as any;

      if ('torch' in capabilities || capabilities?.torch) {
        await track.applyConstraints({
          advanced: [{ torch: true }]
        } as any);
        setIsTorchOn(true);
        setIsSupported(true);
      } else {
        // Hardware torch not supported directly on this track, activate screen flash overlay
        console.warn('[useFlashlight] Hardware torch capability not found on track.');
        setIsSupported(false);
        setIsScreenFlashOn(true);
        setIsTorchOn(true);
      }
    } catch (err) {
      console.warn('[useFlashlight] Hardware torch activation fallback:', err);
      setIsSupported(false);
      setIsScreenFlashOn(true);
      setIsTorchOn(true);
    }
  }, [isTorchOn, turnOff]);

  useEffect(() => {
    return () => {
      turnOff();
    };
  }, [turnOff]);

  return {
    isTorchOn,
    isScreenFlashOn,
    toggleFlashlight,
    turnOff,
    isSupported,
  };
}
