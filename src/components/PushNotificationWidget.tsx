import React, { useState, useEffect } from 'react';
import { Bell, BellRing, Smartphone, CheckCircle2, AlertTriangle, Loader2, Radio, Volume2, ShieldAlert } from 'lucide-react';
import { PushNotificationService } from '../services/PushNotificationService';
import { AppUser } from '../types';

interface PushNotificationWidgetProps {
  user?: AppUser;
  compact?: boolean;
}

export const PushNotificationWidget: React.FC<PushNotificationWidgetProps> = ({ user, compact = false }) => {
  const [isSupported, setIsSupported] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [feedback, setFeedback] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    let mounted = true;
    const checkStatus = async () => {
      const supported = PushNotificationService.isSupported();
      if (!mounted) return;
      setIsSupported(supported);

      if (supported) {
        const subscribed = await PushNotificationService.isSubscribed();
        if (mounted) {
          setIsSubscribed(subscribed);
        }
      }
      if (mounted) {
        setLoading(false);
      }
    };

    checkStatus();
    return () => {
      mounted = false;
    };
  }, []);

  const handleToggleSubscribe = async () => {
    if (!isSupported) return;
    setActionLoading(true);
    setFeedback(null);

    try {
      if (isSubscribed) {
        await PushNotificationService.unsubscribe();
        setIsSubscribed(false);
        setFeedback({ text: 'Notificaciones Push desactivadas para este dispositivo.', type: 'success' });
      } else {
        await PushNotificationService.subscribe(user);
        setIsSubscribed(true);
        setFeedback({
          text: '¡Alertas Push activadas! Recibirás avisos de hallazgos críticos incluso con la app cerrada.',
          type: 'success'
        });
      }
    } catch (error: any) {
      console.error('Error toggling push:', error);
      setFeedback({
        text: error?.message || 'Error al configurar las notificaciones Push.',
        type: 'error'
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handleTestNotification = async () => {
    setTesting(true);
    setFeedback(null);
    try {
      await PushNotificationService.sendTestNotification();
      setFeedback({
        text: '¡Notificación de prueba enviada! Revisa el panel de notificaciones de tu dispositivo.',
        type: 'success'
      });
    } catch (error: any) {
      console.error('Error testing push:', error);
      setFeedback({
        text: error?.message || 'No se pudo enviar la notificación de prueba.',
        type: 'error'
      });
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return (
      <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200/80 dark:border-white/10 flex items-center justify-center gap-2 text-xs text-zinc-500">
        <Loader2 className="w-4 h-4 animate-spin text-sky-500" />
        <span>Verificando estado de notificaciones Push...</span>
      </div>
    );
  }

  if (!isSupported) {
    return (
      <div className="p-4 rounded-2xl bg-amber-50/80 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-800/40 flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
        <div>
          <p className="text-xs font-bold text-amber-900 dark:text-amber-300">
            Alertas Push no soportadas
          </p>
          <p className="text-[11px] text-amber-700/90 dark:text-amber-400/80 mt-0.5 leading-relaxed">
            Tu navegador actual no soporta notificaciones en segundo plano. Te sugerimos usar Chrome, Edge o instalar la app como PWA en Android/iOS.
          </p>
        </div>
      </div>
    );
  }

  if (compact) {
    return (
      <div className="p-4 rounded-2xl bg-gradient-to-r from-sky-950/90 via-slate-900 to-indigo-950 text-white border border-sky-500/30 shadow-md">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className={`p-2.5 rounded-xl shrink-0 ${isSubscribed ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-sky-500/20 text-sky-300 border border-sky-500/30'}`}>
              {isSubscribed ? <BellRing className="w-4 h-4 animate-pulse" /> : <Smartphone className="w-4 h-4" />}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold truncate">Alertas Push en Móvil</span>
                {isSubscribed && (
                  <span className="px-1.5 py-0.5 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded text-[9px] font-black uppercase tracking-wider">
                    Activas
                  </span>
                )}
              </div>
              <p className="text-[11px] text-zinc-300 truncate">
                {isSubscribed
                  ? 'Avisos instantáneos al detectar hallazgos críticos'
                  : 'Recibe alertas aunque la app esté cerrada'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {isSubscribed && (
              <button
                type="button"
                onClick={handleTestNotification}
                disabled={testing}
                className="px-2.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-[11px] font-bold transition-all disabled:opacity-50 cursor-pointer"
                title="Probar notificación push"
              >
                {testing ? 'Probando...' : 'Probar'}
              </button>
            )}
            <button
              type="button"
              onClick={handleToggleSubscribe}
              disabled={actionLoading}
              className={`px-3 py-1.5 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all disabled:opacity-50 cursor-pointer shadow-sm ${
                isSubscribed
                  ? 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-white/10'
                  : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-900/40'
              }`}
            >
              {actionLoading ? 'Guardando...' : isSubscribed ? 'Desactivar' : 'Activar'}
            </button>
          </div>
        </div>

        {feedback && (
          <div
            className={`mt-3 p-2.5 rounded-xl text-[11px] font-medium flex items-start gap-2 ${
              feedback.type === 'success'
                ? 'bg-emerald-500/20 text-emerald-200 border border-emerald-500/30'
                : 'bg-red-500/20 text-red-200 border border-red-500/30'
            }`}
          >
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-0.5 text-emerald-300" />
            ) : (
              <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-red-300" />
            )}
            <span>{feedback.text}</span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="p-5 sm:p-6 rounded-3xl bg-gradient-to-br from-slate-900 via-sky-950 to-indigo-950 text-white border border-sky-500/30 shadow-xl relative overflow-hidden">
      <div className="absolute top-0 right-0 w-64 h-64 bg-sky-500/10 rounded-full -mr-20 -mt-20 blur-3xl pointer-events-none" />
      
      <div className="relative z-10 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3.5">
            <div className={`p-3 rounded-2xl shrink-0 ${isSubscribed ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/30' : 'bg-sky-500/20 text-sky-300 border border-sky-400/30'}`}>
              {isSubscribed ? <BellRing className="w-6 h-6 animate-pulse" /> : <Smartphone className="w-6 h-6" />}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h4 className="text-base font-black tracking-tight">
                  Alertas Push para Supervisores
                </h4>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${
                  isSubscribed 
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400/30' 
                    : 'bg-zinc-500/20 text-zinc-300 border-zinc-400/30'
                }`}>
                  {isSubscribed ? '● Activas' : '○ Inactivas'}
                </span>
              </div>
              <p className="text-xs text-zinc-300 mt-1 max-w-xl leading-relaxed">
                Recibe alertas instantáneas en tu celular o escritorio en cuanto se reporte un <strong>Hallazgo Crítico</strong> en planta, permitiendo actuar de inmediato aunque la app esté cerrada.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
            {isSubscribed && (
              <button
                type="button"
                onClick={handleTestNotification}
                disabled={testing}
                className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition-all disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
              >
                <Radio className="w-3.5 h-3.5 text-sky-300" />
                <span>{testing ? 'Enviando...' : 'Probar Alerta'}</span>
              </button>
            )}
            <button
              type="button"
              onClick={handleToggleSubscribe}
              disabled={actionLoading}
              className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all disabled:opacity-50 cursor-pointer shadow-md flex items-center gap-2 ${
                isSubscribed
                  ? 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-white/10'
                  : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-900/50'
              }`}
            >
              {actionLoading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Procesando...</span>
                </>
              ) : isSubscribed ? (
                <span>Desactivar</span>
              ) : (
                <>
                  <ShieldAlert className="w-3.5 h-3.5" />
                  <span>Activar Alertas</span>
                </>
              )}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2 border-t border-white/10 text-xs">
          <div className="flex items-center gap-2 p-2.5 rounded-xl bg-white/5 border border-white/5">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="text-zinc-300">Funciona en segundo plano</span>
          </div>
          <div className="flex items-center gap-2 p-2.5 rounded-xl bg-white/5 border border-white/5">
            <Radio className="w-4 h-4 text-sky-400 shrink-0" />
            <span className="text-zinc-300">Entrega en tiempo real</span>
          </div>
          <div className="flex items-center gap-2 p-2.5 rounded-xl bg-white/5 border border-white/5">
            <Volume2 className="w-4 h-4 text-amber-400 shrink-0" />
            <span className="text-zinc-300">Aviso acústico y vibración</span>
          </div>
        </div>

        {feedback && (
          <div
            className={`p-3 rounded-2xl text-xs font-medium flex items-start gap-2.5 transition-all ${
              feedback.type === 'success'
                ? 'bg-emerald-500/20 text-emerald-200 border border-emerald-500/30'
                : 'bg-red-500/20 text-red-200 border border-red-500/30'
            }`}
          >
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-300" />
            ) : (
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-red-300" />
            )}
            <span>{feedback.text}</span>
          </div>
        )}
      </div>
    </div>
  );
};
