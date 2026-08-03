import { useState, useCallback, useEffect, useRef } from 'react';

export function useFlashlight() {
  const [isTorchOn, setIsTorchOn] = useState(false);
  const [isSupported, setIsSupported] = useState<boolean | null>(null);
  const [isScreenFlashOn, setIsScreenFlashOn] = useState(false);
  const mediaStreamRef = useRef<MediaStream | null>(null);

  const turnOff = useCallback(() => {
    // Turn off torch on any active video elements (e.g. QR scanner)
    try {
      const activeVideoEls = document.querySelectorAll('video');
      activeVideoEls.forEach(videoEl => {
        if (videoEl.srcObject instanceof MediaStream) {
          videoEl.srcObject.getVideoTracks().forEach(track => {
            try {
              track.applyConstraints({ advanced: [{ torch: false }] } as any);
            } catch (e) {}
          });
        }
      });
    } catch (e) {}

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

      // 1. First check if there is an active video element currently running (e.g. QR scanner)
      const activeVideoEls = document.querySelectorAll('video');
      for (let i = 0; i < activeVideoEls.length; i++) {
        const videoEl = activeVideoEls[i];
        if (videoEl.srcObject instanceof MediaStream) {
          const stream = videoEl.srcObject;
          const track = stream.getVideoTracks()[0];
          if (track && track.readyState === 'live') {
            try {
              await track.applyConstraints({
                advanced: [{ torch: true }]
              } as any);
              setIsTorchOn(true);
              setIsSupported(true);
              return;
            } catch (activeTrackErr) {
              console.warn('[useFlashlight] Failed to set torch on active video element:', activeTrackErr);
            }
          }
        }
      }

      // 2. Check if MediaDevices API is available for standalone flashlight
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
