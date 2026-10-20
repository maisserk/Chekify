import React, { Component, ReactNode, ErrorInfo, useEffect, useRef, useState, useCallback } from 'react';
import { ShieldCheck, WifiOff, RefreshCw, CheckCircle2, AlertCircle } from 'lucide-react';

export interface RecaptchaWidgetProps {
  onVerify: (token: string) => void;
  onExpire?: () => void;
  onError?: (err?: any) => void;
  siteKey?: string;
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

/**
 * Resolves the public reCAPTCHA site key from props or import.meta.env.VITE_RECAPTCHA_SITE_KEY.
 * Never uses automatic test keys or fallback keys when the variable is missing.
 */
export function resolveRecaptchaSiteKey(propKey?: string): string {
  if (propKey && typeof propKey === 'string' && propKey.trim().length > 0) {
    return propKey.trim();
  }

  const envKey = import.meta.env?.VITE_RECAPTCHA_SITE_KEY;
  if (typeof envKey === 'string' && envKey.trim().length > 0) {
    return envKey.trim();
  }

  return '';
}

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage?: string;
}

/**
 * Dedicated Error Boundary for reCAPTCHA to prevent any widget-level crash
 * from propagating to the login screen or creating a UI blackout.
 */
export class RecaptchaErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: any): ErrorBoundaryState {
    return { 
      hasError: true, 
      errorMessage: error?.message || 'Error al inicializar el componente de seguridad' 
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.warn('[reCAPTCHA ErrorBoundary] Caught error safely without UI blackout:', error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, errorMessage: undefined });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="my-3 p-3 bg-red-500/10 border border-red-500/20 text-zinc-300 rounded-2xl flex flex-col items-center justify-center text-xs shadow-md">
          <div className="flex items-center gap-1.5 text-red-500 font-bold text-[11px] mb-1">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>Error en reCAPTCHA</span>
          </div>
          <p className="text-[10px] text-zinc-400 text-center mb-2">
            Ocurrió un error inesperado al renderizar el widget de seguridad.
          </p>
          <button
            type="button"
            onClick={this.handleRetry}
            className="px-2.5 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 rounded-lg text-[10px] font-medium transition cursor-pointer"
          >
            Reintentar
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export const RecaptchaWidgetInner: React.FC<RecaptchaWidgetProps> = ({
  onVerify,
  onExpire,
  onError,
  siteKey: propSiteKey,
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
  const [retryTrigger, setRetryTrigger] = useState(0);

  // Read public site key exclusively from prop or import.meta.env.VITE_RECAPTCHA_SITE_KEY
  const activeSiteKey = resolveRecaptchaSiteKey(propSiteKey);

  // Handle offline / online connectivity
  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => {
      setIsOffline(true);
      setIsVerified(false);
      if (onExpire) onExpire();
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [onExpire]);

  // Load Google reCAPTCHA v2 script and mount widget
  useEffect(() => {
    // If offline or siteKey is not configured, do not attempt to load script
    if (isOffline || !activeSiteKey) {
      return;
    }

    let isSubscribed = true;

    const renderWidget = () => {
      if (!isSubscribed || !window.grecaptcha || !containerRef.current) return;

      try {
        if (widgetIdRef.current !== null) {
          try {
            window.grecaptcha.reset(widgetIdRef.current);
          } catch (_) {}
          widgetIdRef.current = null;
        }

        containerRef.current.innerHTML = '';

        const widgetId = window.grecaptcha.render(containerRef.current, {
          sitekey: activeSiteKey,
          theme: isDark ? 'dark' : 'light',
          size: 'normal',
          callback: (token: string) => {
            if (isSubscribed) {
              setIsVerified(true);
              setLoadError(false);
              onVerify(token);
            }
          },
          'expired-callback': () => {
            if (isSubscribed) {
              setIsVerified(false);
              if (onExpire) onExpire();
            }
          },
          'error-callback': (err: any) => {
            console.warn('[reCAPTCHA] Domain or key error reported by Google:', err);
            if (isSubscribed) {
              setLoadError(true);
              setIsVerified(false);
              if (onError) onError(err);
            }
          },
          hl: 'es',
        });

        if (isSubscribed) {
          widgetIdRef.current = widgetId;
          setIsLoaded(true);
        }
      } catch (err) {
        console.warn('[reCAPTCHA] Failed to render widget safely:', err);
        if (isSubscribed) {
          setLoadError(true);
          setIsVerified(false);
          if (onError) onError(err);
        }
      }
    };

    if (window.grecaptcha && window.grecaptcha.render) {
      window.grecaptcha.ready(renderWidget);
      return () => {
        isSubscribed = false;
      };
    }

    const existingScript = document.getElementById('google-recaptcha-script');
    if (!existingScript) {
      window.__onRecaptchaLoaded__ = () => {
        if (window.grecaptcha && isSubscribed) {
          window.grecaptcha.ready(renderWidget);
        }
      };

      const script = document.createElement('script');
      script.id = 'google-recaptcha-script';
      script.src = 'https://www.google.com/recaptcha/api.js?onload=__onRecaptchaLoaded__&render=explicit&hl=es';
      script.async = true;
      script.defer = true;
      script.onerror = () => {
        console.warn('[reCAPTCHA] Failed to load Google script (network restriction or adblocker)');
        if (isSubscribed) setLoadError(true);
      };
      document.head.appendChild(script);
    } else {
      const checkInterval = setInterval(() => {
        if (window.grecaptcha && window.grecaptcha.render) {
          clearInterval(checkInterval);
          if (isSubscribed) window.grecaptcha.ready(renderWidget);
        }
      }, 100);

      const timeout = setTimeout(() => {
        clearInterval(checkInterval);
        if (isSubscribed && !isLoaded && widgetIdRef.current === null) {
          setLoadError(true);
        }
      }, 5000);

      return () => {
        isSubscribed = false;
        clearInterval(checkInterval);
        clearTimeout(timeout);
      };
    }

    return () => {
      isSubscribed = false;
    };
  }, [activeSiteKey, isDark, isOffline, onError, onExpire, onVerify, retryTrigger]);

  // Handle programmatic reset (e.g. after failed login)
  useEffect(() => {
    if (resetCount > 0) {
      setIsVerified(false);
      if (window.grecaptcha && widgetIdRef.current !== null) {
        try {
          window.grecaptcha.reset(widgetIdRef.current);
        } catch (e) {
          console.warn('[reCAPTCHA] Reset failed:', e);
        }
      }
    }
  }, [resetCount]);

  const handleRetry = useCallback(() => {
    setLoadError(false);
    setIsVerified(false);
    setIsLoaded(false);
    widgetIdRef.current = null;
    setRetryTrigger((prev) => prev + 1);
  }, []);

  if (isOffline) {
    return (
      <div className="p-3 bg-zinc-100 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700/80 rounded-2xl flex items-center justify-between text-xs text-zinc-600 dark:text-zinc-300 w-full my-3">
        <div className="flex items-center gap-2">
          <WifiOff className="w-4 h-4 text-amber-500 shrink-0" />
          <span>Modo sin conexión • Se requiere internet para validar reCAPTCHA</span>
        </div>
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
          <span className="text-[10px] font-extrabold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 px-2 py-0.5 rounded-full flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3 text-emerald-500" />
            Verificado ✓
          </span>
        ) : (
          <span className="text-[10px] font-medium text-zinc-400">
            {activeSiteKey ? 'Completa la casilla' : 'Configuración requerida'}
          </span>
        )}
      </div>

      <div className="w-full flex flex-col items-center justify-center min-h-[78px] bg-zinc-50 dark:bg-zinc-950/50 p-2 rounded-2xl border border-zinc-200 dark:border-zinc-800 transition-colors">
        {!activeSiteKey ? (
          /* Inform about missing configuration without marking as verified */
          <div className="w-full flex flex-col items-center justify-center p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-center text-xs">
            <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400 font-bold mb-1">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>reCAPTCHA no configurado</span>
            </div>
            <p className="text-[11px] text-zinc-600 dark:text-zinc-400 max-w-xs leading-snug">
              Falta configurar la variable pública <code className="bg-zinc-200 dark:bg-zinc-800 px-1 py-0.5 rounded text-[10px] font-mono text-zinc-800 dark:text-zinc-200">VITE_RECAPTCHA_SITE_KEY</code> en las variables de entorno.
            </p>
          </div>
        ) : isVerified ? (
          /* Verification success */
          <div className="flex items-center gap-2.5 py-3 px-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-600 dark:text-emerald-400 text-xs font-semibold w-full justify-center">
            <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
            <span>Identidad verificada correctamente. Puedes ingresar.</span>
          </div>
        ) : loadError ? (
          /* Error notice without bypass or fictitious tokens */
          <div className="flex flex-col items-center gap-2 p-3 text-center text-xs bg-red-500/10 border border-red-500/20 rounded-xl w-full">
            <div className="flex items-center gap-1.5 text-red-600 dark:text-red-400 font-bold text-[11px]">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>No se pudo cargar Google reCAPTCHA</span>
            </div>
            
            <p className="text-[11px] text-zinc-600 dark:text-zinc-400 leading-snug max-w-xs">
              Verifica tu conexión a internet o comprueba que este dominio esté autorizado en la consola de Google reCAPTCHA para la clave configurada.
            </p>

            <button
              type="button"
              onClick={handleRetry}
              className="mt-1 inline-flex items-center gap-1.5 px-3 py-1.5 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-200 rounded-xl text-[11px] font-semibold transition border border-zinc-200 dark:border-zinc-700 cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Reintentar carga
            </button>
          </div>
        ) : (
          /* Normal Google reCAPTCHA container */
          <div 
            ref={containerRef} 
            className="recaptcha-box-wrapper overflow-hidden rounded-md min-w-[304px] min-h-[78px]" 
          />
        )}
      </div>
    </div>
  );
};

export const RecaptchaWidget: React.FC<RecaptchaWidgetProps> = (props) => {
  return (
    <RecaptchaErrorBoundary>
      <RecaptchaWidgetInner {...props} />
    </RecaptchaErrorBoundary>
  );
};
