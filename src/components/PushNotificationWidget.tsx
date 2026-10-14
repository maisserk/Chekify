import React, { useState, useEffect } from 'react';
import { Bell, BellRing, Smartphone, CheckCircle2, AlertTriangle, Loader2, Radio, Volume2, ShieldAlert, X } from 'lucide-react';
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
  const [dismissed, setDismissed] = useState(() => {
    return localStorage.getItem('push_notification_widget_dismissed') === 'true';
  });

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

  const handleDismiss = () => {
    setDismissed(true);
    localStorage.setItem('push_notification_widget_dismissed', 'true');
  };

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
        text: '¡Notificación de prueba enviada! Revisa el panel de tu dispositivo.',
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

  // Do not flash empty or loading boxes on login
  if (loading) {
    return null;
  }

  // If dismissed by user and not currently subscribed, don't show the card
  if (dismissed && !isSubscribed) {
    return null;
  }

  // If browser doesn't support push notifications, do not block or show intrusive alert
  if (!isSupported) {
    if (compact) {
      return (
        <div className="p-3 rounded-2xl bg-[#FF9500]/10 text-[#C96800] dark:text-[#FF9F0A] text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>Alertas Push no soportadas en este navegador.</span>
        </div>
      );
    }
    return null;
  }

  // Compact / Active mode
  if (compact || isSubscribed) {
    return (
      <div className="p-3.5 px-4 rounded-2xl bg-white dark:bg-[#1C1C1E] border border-[#D2D2D7]/40 dark:border-white/10 text-[#1D1D1F] dark:text-[#F5F5F7] flex flex-wrap items-center justify-between gap-3 shadow-xs transition-all">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-[#34C759]/15 text-[#34C759] flex items-center justify-center shrink-0">
            <BellRing className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-bold text-[#1D1D1F] dark:text-[#F5F5F7] truncate">
              {isSubscribed ? 'Alertas Push Activas' : 'Alertas Push'}
            </p>
            <p className="text-[11px] text-[#6E6E73] dark:text-[#98989D] truncate">
              {isSubscribed ? 'Notificaciones en segundo plano habilitadas' : 'Recibe avisos de hallazgos críticos'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {isSubscribed && (
            <button
              type="button"
              onClick={handleTestNotification}
              disabled={testing}
              className="px-3 py-1.5 rounded-xl bg-[#0071E3] hover:bg-[#0077ED] text-white text-xs font-semibold transition-all disabled:opacity-50 cursor-pointer flex items-center gap-1.5 active:scale-98"
            >
              <Radio className="w-3.5 h-3.5" />
              <span>{testing ? 'Enviando...' : 'Probar'}</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleToggleSubscribe}
            disabled={actionLoading}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              isSubscribed
                ? 'bg-[#E5E5EA] dark:bg-[#2C2C2E] text-[#6E6E73] dark:text-[#98989D] hover:text-[#FF3B30]'
                : 'bg-[#0071E3] text-white hover:bg-[#0077ED]'
            }`}
          >
            {actionLoading ? '...' : isSubscribed ? 'Desactivar' : 'Activar'}
          </button>
        </div>

        {feedback && (
          <div className="w-full text-xs font-medium text-[#34C759] dark:text-[#30D158] pt-1">
            {feedback.text}
          </div>
        )}
      </div>
    );
  }

  // Expanded banner (subtle Apple HIG card with close button)
  return (
    <div className="p-4 sm:p-5 rounded-2xl md:rounded-3xl bg-white dark:bg-[#1C1C1E] border border-[#D2D2D7]/40 dark:border-white/10 shadow-xs relative transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3.5 min-w-0">
          <div className="w-10 h-10 rounded-2xl bg-[#0071E3]/12 text-[#0071E3] dark:text-[#0A84FF] flex items-center justify-center shrink-0">
            <Bell className="w-5 h-5 stroke-[2.2]" />
          </div>
          <div className="min-w-0">
            <h4 className="text-sm sm:text-base font-bold text-[#1D1D1F] dark:text-[#F5F5F7] tracking-tight">
              Alertas Push en Terreno
            </h4>
            <p className="text-xs text-[#6E6E73] dark:text-[#98989D] mt-1 leading-relaxed max-w-xl">
              Recibe avisos inmediatos en tu dispositivo cuando se reporte un <strong>Hallazgo Crítico</strong> en planta.
            </p>
          </div>
        </div>

        <button
          onClick={handleDismiss}
          className="w-7 h-7 rounded-full bg-[#E5E5EA]/60 dark:bg-[#2C2C2E] text-[#6E6E73] dark:text-[#98989D] hover:text-[#1D1D1F] dark:hover:text-[#F5F5F7] flex items-center justify-center transition-colors cursor-pointer shrink-0"
          title="Descartar"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-[#D2D2D7]/30 dark:border-white/5">
        <div className="flex items-center gap-4 text-xs text-[#6E6E73] dark:text-[#98989D]">
          <span className="flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-[#34C759]" />
            Segundo plano
          </span>
          <span className="flex items-center gap-1.5">
            <Radio className="w-3.5 h-3.5 text-[#0071E3]" />
            Tiempo real
          </span>
        </div>

        <button
          type="button"
          onClick={handleToggleSubscribe}
          disabled={actionLoading}
          className="px-4 py-2 rounded-xl bg-[#0071E3] hover:bg-[#0077ED] text-white text-xs font-semibold transition-all cursor-pointer flex items-center gap-2 active:scale-98 shadow-sm"
        >
          {actionLoading ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <ShieldAlert className="w-3.5 h-3.5" />
          )}
          <span>Activar Alertas</span>
        </button>
      </div>

      {feedback && (
        <div className="mt-2 text-xs font-medium text-[#34C759] dark:text-[#30D158]">
          {feedback.text}
        </div>
      )}
    </div>
  );
};
