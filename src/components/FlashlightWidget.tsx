import React from 'react';
import { Flashlight, FlashlightOff, Sun } from 'lucide-react';
import { useFlashlight } from '../hooks/useFlashlight';

interface FlashlightWidgetProps {
  className?: string;
  variant?: 'button' | 'floating' | 'compact';
}

export const FlashlightWidget: React.FC<FlashlightWidgetProps> = ({
  className = '',
  variant = 'button'
}) => {
  const { isTorchOn, isScreenFlashOn, toggleFlashlight, turnOff } = useFlashlight();

  if (variant === 'compact') {
    return (
      <>
        <button
          type="button"
          onClick={toggleFlashlight}
          title={isTorchOn ? 'Apagar linterna' : 'Encender linterna para inspección nocturna'}
          className={`px-3 py-2 rounded-xl border flex items-center gap-2 text-xs font-bold transition-all shadow-sm ${
            isTorchOn
              ? 'bg-amber-500 text-slate-950 border-amber-400 animate-pulse ring-2 ring-amber-400/50'
              : 'bg-zinc-100 dark:bg-zinc-800/80 text-zinc-700 dark:text-zinc-200 border-zinc-200 dark:border-white/10 hover:bg-zinc-200 dark:hover:bg-zinc-700'
          } ${className}`}
        >
          {isTorchOn ? (
            <>
              <Flashlight className="w-4 h-4 text-slate-950 fill-slate-950" />
              <span>Linterna ON</span>
            </>
          ) : (
            <>
              <FlashlightOff className="w-4 h-4 text-zinc-500 dark:text-zinc-400" />
              <span>Linterna</span>
            </>
          )}
        </button>

        {/* Screen flash light fallback overlay when hardware torch is unavailable */}
        {isScreenFlashOn && (
          <div className="fixed inset-0 z-[9999] bg-white flex flex-col items-center justify-between p-8 text-black select-none">
            <div className="pt-8 text-center space-y-2">
              <Sun className="w-16 h-16 mx-auto animate-spin text-amber-500" />
              <h2 className="text-2xl font-extrabold uppercase tracking-tight">Luz de Inspección Nocturna</h2>
              <p className="text-sm text-zinc-600 max-w-xs mx-auto font-medium">
                Pantalla en brillo máximo activada para iluminar el equipo en la noche.
              </p>
            </div>

            <button
              type="button"
              onClick={turnOff}
              className="w-full max-w-xs py-4 bg-zinc-900 text-white font-extrabold rounded-2xl shadow-2xl active:scale-95 transition-all text-base"
            >
              Apagar Luz
            </button>
          </div>
        )}
      </>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={toggleFlashlight}
        className={`px-4 py-3 rounded-2xl border flex items-center justify-center gap-2 font-bold text-sm transition-all active:scale-95 shadow-sm ${
          isTorchOn
            ? 'bg-amber-400 text-zinc-950 border-amber-300 ring-4 ring-amber-400/30 font-black shadow-amber-500/20 shadow-lg'
            : 'bg-zinc-900 dark:bg-zinc-800 text-white border-zinc-800 dark:border-white/10 hover:bg-zinc-800 dark:hover:bg-zinc-700'
        } ${className}`}
      >
        {isTorchOn ? (
          <>
            <Flashlight className="w-5 h-5 text-zinc-950 fill-zinc-950 animate-bounce" />
            <span>Linterna Activada</span>
          </>
        ) : (
          <>
            <Flashlight className="w-5 h-5 text-amber-400" />
            <span>Encender Linterna</span>
          </>
        )}
      </button>

      {/* Screen flash light fallback overlay when hardware torch is unavailable */}
      {isScreenFlashOn && (
        <div className="fixed inset-0 z-[9999] bg-white flex flex-col items-center justify-between p-8 text-black select-none">
          <div className="pt-12 text-center space-y-2">
            <Sun className="w-20 h-20 mx-auto text-amber-500 animate-pulse" />
            <h2 className="text-3xl font-black uppercase tracking-tight">Luz de Inspección Nocturna</h2>
            <p className="text-sm text-zinc-600 max-w-sm mx-auto font-semibold">
              Pantalla en iluminación máxima para apoyar la revisión táctica de equipos en baja visibilidad.
            </p>
          </div>

          <button
            type="button"
            onClick={turnOff}
            className="w-full max-w-sm py-4 bg-zinc-950 text-white font-black rounded-2xl shadow-2xl active:scale-95 transition-all text-base uppercase tracking-wider"
          >
            Apagar Luz Nocturna
          </button>
        </div>
      )}
    </>
  );
};
