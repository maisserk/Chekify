import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Camera, X, RefreshCw, Zap, ZapOff, Check, Image as ImageIcon } from 'lucide-react';

interface CameraCaptureModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCapture: (imageBlob: Blob | string) => void;
  title?: string;
}

export const CameraCaptureModal: React.FC<CameraCaptureModalProps> = ({
  isOpen,
  onClose,
  onCapture,
  title = "Capturar Evidencia"
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [torchEnabled, setTorchEnabled] = useState(false);
  const [hasTorch, setHasTorch] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [cameraLoading, setCameraLoading] = useState(true);

  // Stop camera stream safely
  const stopStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => {
        try {
          track.stop();
        } catch (e) {
          console.warn("Error stopping camera track", e);
        }
      });
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  // Start camera stream
  const startCamera = async (mode: 'environment' | 'user') => {
    stopStream();
    setCameraLoading(true);
    setError(null);

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("Tu navegador no soporta captura de cámara en tiempo real.");
      }

      // Constraints optimized for fluid preview and low memory footprint
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: { ideal: mode },
          width: { ideal: 1280, max: 1920 },
          height: { ideal: 720, max: 1080 }
        },
        audio: false
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      // Check if torch/flashlight is supported
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        const capabilities = (videoTrack.getCapabilities ? videoTrack.getCapabilities() : {}) as any;
        setHasTorch(!!capabilities.torch);
      }

      setCameraLoading(false);
    } catch (err: any) {
      console.error("Camera capture error:", err);
      setCameraLoading(false);
      setError(
        err.name === 'NotAllowedError' 
          ? "Acceso a la cámara denegado. Permite el permiso en tu navegador o selecciona una foto desde tus archivos."
          : (err.message || "No se pudo acceder a la cámara del dispositivo.")
      );
    }
  };

  useEffect(() => {
    if (isOpen) {
      startCamera(facingMode);
    } else {
      stopStream();
    }
    return () => {
      stopStream();
    };
  }, [isOpen, facingMode]);

  // Toggle Torch/Flashlight if supported
  const toggleTorch = async () => {
    if (!streamRef.current) return;
    const track = streamRef.current.getVideoTracks()[0];
    if (track && hasTorch) {
      try {
        const nextState = !torchEnabled;
        await (track as any).applyConstraints({
          advanced: [{ torch: nextState }]
        });
        setTorchEnabled(nextState);
      } catch (e) {
        console.warn("Torch constraint error:", e);
      }
    }
  };

  // Flip camera between front and back
  const toggleFacingMode = () => {
    setFacingMode(prev => (prev === 'environment' ? 'user' : 'environment'));
  };

  // Shutter action: grabs frame directly from video element
  const handleShutter = () => {
    if (!videoRef.current || isCapturing) return;
    setIsCapturing(true);

    try {
      const video = videoRef.current;
      const vWidth = video.videoWidth || 1280;
      const vHeight = video.videoHeight || 720;

      // Create an off-screen canvas with standard photo dimensions (max 1280)
      const canvas = document.createElement('canvas');
      const maxDim = 1280;
      let targetW = vWidth;
      let targetH = vHeight;

      if (targetW > maxDim || targetH > maxDim) {
        if (targetW > targetH) {
          targetH = Math.round((targetH * maxDim) / targetW);
          targetW = maxDim;
        } else {
          targetW = Math.round((targetW * maxDim) / targetH);
          targetH = maxDim;
        }
      }

      canvas.width = targetW;
      canvas.height = targetH;
      const ctx = canvas.getContext('2d', { alpha: false, desynchronized: true });

      if (!ctx) {
        throw new Error("No se pudo inicializar el procesador de captura.");
      }

      // If user camera, mirror horizontally
      if (facingMode === 'user') {
        ctx.translate(targetW, 0);
        ctx.scale(-1, 1);
      }

      ctx.drawImage(video, 0, 0, targetW, targetH);

      // Convert to blob or jpeg string
      canvas.toBlob((blob) => {
        stopStream();
        setIsCapturing(false);
        if (blob) {
          onCapture(blob);
          onClose();
        } else {
          const fallbackData = canvas.toDataURL('image/jpeg', 0.7);
          onCapture(fallbackData);
          onClose();
        }
      }, 'image/jpeg', 0.75);

    } catch (e: any) {
      console.error("Shutter capture error:", e);
      setIsCapturing(false);
      alert("Error al capturar la imagen. Intenta nuevamente.");
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-3 sm:p-6 bg-black/90 backdrop-blur-md">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="relative w-full max-w-md bg-zinc-950 border border-zinc-800 rounded-[28px] overflow-hidden flex flex-col shadow-2xl"
      >
        {/* Top Controls Bar */}
        <div className="p-4 flex items-center justify-between border-b border-zinc-800/80 bg-zinc-900/60 z-10">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-sky-500/20 text-sky-400 flex items-center justify-center">
              <Camera className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-extrabold text-white text-sm tracking-tight">{title}</h3>
              <p className="text-[10px] text-zinc-400 font-medium">Cámara en vivo (sin salir de la app)</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {hasTorch && (
              <button
                type="button"
                onClick={toggleTorch}
                className={`p-2 rounded-xl transition-colors cursor-pointer ${
                  torchEnabled ? 'bg-amber-500 text-black font-bold' : 'bg-zinc-800 text-zinc-400 hover:text-white'
                }`}
                title={torchEnabled ? "Apagar linterna" : "Encender linterna"}
              >
                {torchEnabled ? <Zap className="w-4 h-4" /> : <ZapOff className="w-4 h-4" />}
              </button>
            )}

            <button
              type="button"
              onClick={toggleFacingMode}
              className="p-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl transition-colors cursor-pointer"
              title="Cambiar cámara"
            >
              <RefreshCw className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl transition-colors cursor-pointer"
              title="Cerrar"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Live Camera Viewfinder */}
        <div className="relative aspect-[4/3] sm:aspect-square bg-black flex items-center justify-center overflow-hidden">
          {cameraLoading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 z-10 bg-black/60 text-white">
              <RefreshCw className="w-7 h-7 text-sky-400 animate-spin" />
              <span className="text-xs font-bold tracking-wide">Iniciando cámara...</span>
            </div>
          )}

          {error ? (
            <div className="p-6 text-center space-y-3 z-10 max-w-xs">
              <p className="text-xs text-red-400 font-medium leading-relaxed">{error}</p>
              <button
                type="button"
                onClick={() => startCamera(facingMode)}
                className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                Reintentar
              </button>
            </div>
          ) : (
            <video
              ref={videoRef}
              playsInline
              muted
              autoPlay
              className="w-full h-full object-cover"
            />
          )}

          {/* Viewfinder crosshairs overlay */}
          <div className="absolute inset-8 pointer-events-none border border-white/20 rounded-2xl flex items-center justify-center">
            <div className="w-10 h-10 border border-white/30 rounded-full" />
          </div>
        </div>

        {/* Bottom Shutter Controls Bar */}
        <div className="p-5 bg-zinc-950 border-t border-zinc-800/80 flex items-center justify-around z-10">
          <div className="w-12 text-center">
            <span className="text-[10px] text-zinc-500 font-bold block">1/1</span>
          </div>

          {/* Big Circular Shutter Button */}
          <button
            type="button"
            disabled={cameraLoading || !!error || isCapturing}
            onClick={handleShutter}
            className="w-18 h-18 rounded-full border-4 border-white/80 p-1 bg-transparent hover:scale-105 active:scale-95 transition-all cursor-pointer disabled:opacity-40 flex items-center justify-center shadow-xl shadow-sky-500/10"
            title="Tomar Foto"
          >
            <div className="w-full h-full bg-white rounded-full flex items-center justify-center">
              <div className="w-3.5 h-3.5 rounded-full bg-sky-500" />
            </div>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="w-12 text-center text-xs font-bold text-zinc-400 hover:text-white cursor-pointer"
          >
            Cancelar
          </button>
        </div>
      </motion.div>
    </div>
  );
};
