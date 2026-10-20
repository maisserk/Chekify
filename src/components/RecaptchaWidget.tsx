import React, { useEffect, useRef, useState } from 'react';
import { ShieldCheck, WifiOff, RefreshCw } from 'lucide-react';

interface RecaptchaWidgetProps {
  onVerify: (token: string) => void;
  onExpire?: () => void;
  onError?: (err?: any) => void;
  isDark?: boolean;
  resetCount?: number;
  className?: string;
}

declare global {
  interface Window {
    grecaptcha?: {
      render: (
        container: HTMLElement | string,
        parameters: {
          sitekey: string;
          theme?: 'light' | 'dark';
          size?: 'normal' | 'compact';
          callback?: (token: string) => void;
          'expired-callback'?: () => void;
          'error-callback'?: (err?: any) => void;
          hl?: string;
        }
      ) => number;
      reset: (opt_widget_id?: number) => void;
      getResponse: (opt_widget_id?: number) => string;
      ready: (callback: () => void) => void;
    };
    __onRecaptchaLoaded__?: () => void;
  }
}

// Google Official Test Key for reCAPTCHA v2 (always passes on any domain, no domain restriction)
// Can be overridden at runtime via VITE_RECAPTCHA_SITE_KEY
const SITE_KEY = import.meta.env.VITE_RECAPTCHA_SITE_KEY;

export const RecaptchaWidget: React.FC<RecaptchaWidgetProps> = ({
  onVerify,
  onExpire,
  onError,
  isDark = true,
  resetCount = 0,
  className = '',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<number | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [isVerified, setIsVerified] = useState(false);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  const siteKey = (import.meta as any).env?.VITE_RECAPTCHA_SITE_KEY || DEFAULT_SITE_KEY;

  // Handle offline / online connectivity
  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => {
      setIsOffline(true);
      // If offline, bypass captcha so field operators are not locked out
      setIsVerified(true);
      onVerify('offline-bypass-token');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    if (!navigator.onLine) {
      setIsVerified(true);
      onVerify('offline-bypass-token');
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [onVerify]);

  // Load Google reCAPTCHA v2 script
  useEffect(() => {
    if (isOffline) return;

    const renderWidget = () => {
      if (!window.grecaptcha || !containerRef.current) return;

      try {
        // If already rendered, don't re-render
        if (widgetIdRef.current !== null) return;

        const widgetId = window.grecaptcha.render(containerRef.current, {
          sitekey: siteKey,
          theme: isDark ? 'dark' : 'light',
          size: 'normal',
          callback: (token: string) => {
            setIsVerified(true);
            onVerify(token);
          },
          'expired-callback': () => {
            setIsVerified(false);
            if (onExpire) onExpire();
          },
          'error-callback': (err: any) => {
            console.warn('[reCAPTCHA] Widget error:', err);
            if (onError) onError(err);
          },
          hl: 'es',
        });

        widgetIdRef.current = widgetId;
        setIsLoaded(true);
        setLoadError(false);
      } catch (err) {
        console.error('[reCAPTCHA] Failed to render widget:', err);
        setLoadError(true);
      }
    };

    if (window.grecaptcha && window.grecaptcha.render) {
      window.grecaptcha.ready(renderWidget);
      return;
    }

    // Check if script already exists in document
    const existingScript = document.getElementById('google-recaptcha-script');
    if (!existingScript) {
      window.__onRecaptchaLoaded__ = () => {
        if (window.grecaptcha) {
          window.grecaptcha.ready(renderWidget);
        }
      };

      const script = document.createElement('script');
      script.id = 'google-recaptcha-script';
      script.src = 'https://www.google.com/recaptcha/api.js?onload=__onRecaptchaLoaded__&render=explicit&hl=es';
      script.async = true;
      script.defer = true;
      script.onerror = () => {
        console.error('[reCAPTCHA] Failed to load Google script');
        setLoadError(true);
      };
      document.head.appendChild(script);
    } else {
      // Script already present, wait for ready
      const checkInterval = setInterval(() => {
        if (window.grecaptcha && window.grecaptcha.render) {
          clearInterval(checkInterval);
          window.grecaptcha.ready(renderWidget);
        }
      }, 100);

      const timeout = setTimeout(() => {
        clearInterval(checkInterval);
        if (!isLoaded) setLoadError(true);
      }, 5000);

      return () => {
        clearInterval(checkInterval);
        clearTimeout(timeout);
      };
    }
  }, [siteKey, isDark, isOffline]);

  // Handle programmatic reset (e.g. after failed login)
  useEffect(() => {
    if (resetCount > 0 && window.grecaptcha && widgetIdRef.current !== null) {
      try {
        window.grecaptcha.reset(widgetIdRef.current);
        setIsVerified(false);
      } catch (e) {
        console.warn('[reCAPTCHA] Reset failed:', e);
      }
    }
  }, [resetCount]);

  if (isOffline) {
    return (
      <div className="p-3 bg-zinc-100 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700/80 rounded-2xl flex items-center justify-between text-xs text-zinc-600 dark:text-zinc-300">
        <div className="flex items-center gap-2">
          <WifiOff className="w-4 h-4 text-amber-500 shrink-0" />
          <span>Modo sin conexión • Verificación reCAPTCHA omitida</span>
        </div>
        <span className="font-bold text-[10px] text-emerald-500 uppercase">Activo</span>
      </div>
    );
  }

  return (
    <div className={`flex flex-col items-center justify-center my-3 ${className}`}>
      <div className="w-full flex items-center justify-between mb-1.5 px-1">
        <div className="flex items-center gap-1.5 text-[11px] font-bold text-zinc-500 dark:text-zinc-400">
          <ShieldCheck className="w-3.5 h-3.5 text-brand-blue" />
          <span>Seguridad de Acceso</span>
        </div>
        {isVerified ? (
          <span className="text-[10px] font-extrabold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 px-2 py-0.5 rounded-full">
            Verificado ✓
          </span>
        ) : (
          <span className="text-[10px] font-medium text-zinc-400">
            Completa la casilla
          </span>
        )}
      </div>

      <div className="w-full flex items-center justify-center min-h-[78px] bg-zinc-50 dark:bg-zinc-950/50 p-2 rounded-2xl border border-zinc-200 dark:border-zinc-800 transition-colors">
        {loadError ? (
          <div className="flex flex-col items-center gap-2 p-2 text-center text-xs text-zinc-500 dark:text-zinc-400">
            <p>No se pudo cargar el servicio de reCAPTCHA de Google.</p>
            <button
              type="button"
              onClick={() => {
                setLoadError(false);
                setIsVerified(true);
                onVerify('manual-fallback-token');
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1 bg-zinc-200 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 rounded-lg text-xs font-semibold hover:bg-zinc-300 dark:hover:bg-zinc-700 transition"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Continuar con validación local
            </button>
          </div>
        ) : (
          <div ref={containerRef} className="recaptcha-box-wrapper overflow-hidden rounded-md" />
        )}
      </div>
    </div>
  );
};
