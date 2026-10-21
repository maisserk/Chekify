/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, Component } from 'react';
import { 
  auth, db 
} from './firebase';
import { 
  onAuthStateChanged, 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail
} from 'firebase/auth';
import { 
  doc, 
  getDoc, 
  setDoc, 
  deleteDoc,
  collection, 
  query, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  serverTimestamp,
  orderBy,
  where,
  limit,
  Timestamp,
  arrayUnion
} from 'firebase/firestore';
import { 
  QrCode, 
  ScanLine,
  Camera, 
  CheckCircle2, 
  XCircle,
  AlertCircle, 
  History, 
  Users, 
  LogOut, 
  LayoutDashboard,
  Search,
  Plus,
  X,
  AlertTriangle,
  ChevronRight,
  MessageSquare,
  Check,
  ChevronUp,
  ChevronDown,
  PowerOff,
  Zap,
  Layout,
  Box,
  Bell,
  FileText,
  MapPin,
  Send,
  Upload,
  Clock,
  Pause,
  PauseCircle,
  Play,
  PlayCircle,
  Timer,
  Trash2,
  Edit3,
  Shield,
  BellRing,
  RotateCcw,
  Key,
  ShieldAlert,
  Filter,
  BarChart3,
  Calendar as CalendarIcon,
  Eye,
  EyeOff,
  Ear,
  Hand,
  Wind,
  Settings2,
  ArrowLeft,
  ShieldCheck,
  ListChecks,
  FileSearch,
  Sparkles,
  Copy,
  Maximize2,
  Minimize2,
  GripVertical,
  PanelLeftClose,
  PanelLeftOpen,
  Menu,
  Sun,
  Moon,
  Loader2,
  Wifi,
  WifiOff,
  Database,
  RefreshCw,
  Compass,
  Activity,
  Download,
  HelpCircle,
  BookOpen,
  Smartphone,
  Share,
  Share2,
  CloudSun,
  Thermometer,
  Droplets,
  CloudRain,
  CloudOff,
  UserCheck,
  HardHat,
  Briefcase
} from 'lucide-react';

import { EquipmentService } from './services/EquipmentService';
import { FindingService } from './services/FindingService';
import { AreaService } from './services/AreaService';
import { InspectionService } from './services/InspectionService';
import { offlineQueueService } from './services/OfflineQueueService';
import { weatherService, WeatherData } from './services/weatherService';
import { Plant } from './types';
import { TEMPORARY_DISABLE_RECAPTCHA } from './config/authConfig';
import { WeatherModule } from './components/WeatherModule';
import { WeatherSafetyModal } from './components/WeatherSafetyModal';
import { UserProfileModal } from './components/UserProfileModal';
import { QuickHelpModal } from './components/QuickHelpModal';
import { OfflineImage } from './components/OfflineImage';
import { useOfflineStatus } from './hooks/useOfflineStatus';
import { useFindingAnalytics } from './hooks/useHSECAnalytics';
import { OrdenYLimpiezaDashboard, isOrdenYLimpiezaFinding, isVOSOFinding } from './components/OrdenYLimpiezaDashboard';
import { VOSOHeatmapChart } from './components/VOSOHeatmapChart';
import { PushNotificationWidget } from './components/PushNotificationWidget';
import { FlashlightWidget } from './components/FlashlightWidget';
import { FindingPhotoGallery, FindingPhotoThumbnails, extractFindingPhotos } from './components/FindingPhotoGallery';
import { FindingDescriptionRenderer } from './components/FindingDescriptionRenderer';
import { OperatingStatusBadge } from './components/OperatingStatusBadge';
import { downloadOperatorInspectionPDF, shareOperatorInspectionPDF, downloadOrShareOperatorInspectionPDF, getWhiteChekifyLogoBase64 } from './utils/generateOperatorInspectionPDF';
import { useAppUsers } from './hooks/useAppUsers';
import { getFindingDate, getFindingClosedDate, formatToDatetimeLocal, getCalculatedMTTRText, parseAnyDate } from './utils/dateUtils';
import { getCachedAreas, cacheAreas, getCachedEquipment, cacheEquipment, clearAllCaches } from './utils/offlineCache';
import { SplashScreen } from './components/SplashScreen';
import { AreaQRModal } from './components/AreaQRModal';
import { CameraCaptureModal } from './components/CameraCaptureModal';

function withTimeout<T>(promise: Promise<T>, timeoutMs: number = 5000, errorMsg = 'Operation timed out'): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(errorMsg)), timeoutMs)
    )
  ]);
}

const generateSafeId = (name: string): string => {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9-_]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
};

const DEFAULT_VOSO: VOSOInspection = {
  ver: [
    { id: 'v1', name: 'Fugas', type: 'Crítico' },
    { id: 'v2', name: 'Pernos sueltos', type: 'Mantenimiento' },
    { id: 'v3', name: 'Desgaste', type: 'Mantenimiento' },
    { id: 'v4', name: 'Vibración visible', type: 'Crítico' },
    { id: 'v5', name: 'Temperatura visual anormal', type: 'Crítico' }
  ],
  oir: [
    { id: 'o1', name: 'Ruidos metálicos', type: 'Crítico' },
    { id: 'o2', name: 'Golpeteos', type: 'Operacional' },
    { id: 'o3', name: 'Chillidos', type: 'Mantenimiento' },
    { id: 'o4', name: 'Cavitación', type: 'Crítico' },
    { id: 'o5', name: 'Sonido irregular', type: 'Operacional' }
  ],
  sentir: [
    { id: 's1', name: 'Vibración excesiva', type: 'Mantenimiento' },
    { id: 's2', name: 'Temperatura elevada', type: 'Seguridad' },
    { id: 's3', name: 'Holguras', type: 'Mantenimiento' },
    { id: 's4', name: 'Fricción anormal', type: 'Mantenimiento' }
  ],
  oler: [
    { id: 'ol1', name: 'Olor a quemado', type: 'Crítico' },
    { id: 'ol2', name: 'Olor químico', type: 'Seguridad' },
    { id: 'ol3', name: 'Olor a aceite', type: 'Mantenimiento' },
    { id: 'ol4', name: 'Olor eléctrico', type: 'Crítico' }
  ],
  orden: [
    { id: 'l1', name: 'Residuos en el área', type: 'Seguridad' },
    { id: 'l2', name: 'Herramientas fuera de lugar', type: 'Operacional' },
    { id: 'l3', name: 'Derrame de lubricantes', type: 'Seguridad' },
    { id: 'l4', name: 'Obstrucciones en accesos', type: 'Crítico' },
    { id: 'l5', name: 'Limpieza del equipo', type: 'Mantenimiento' }
  ]
};
import { motion, AnimatePresence } from 'motion/react';

// Memory-safe image compressor that processes directly from File, Blob, or String without allocating massive memory buffers
const compressImage = (source: File | Blob | string, maxWidth = 1024, maxHeight = 1024, quality = 0.65): Promise<string> => {
  return new Promise((resolve, reject) => {
    let objectUrl: string | null = null;
    const img = new Image();

    const cleanup = () => {
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
        objectUrl = null;
      }
    };

    img.onload = () => {
      try {
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d', { alpha: false, desynchronized: true });
        
        if (!ctx) {
          cleanup();
          if (typeof source === 'string') resolve(source);
          else reject(new Error('No se pudo inicializar el procesador de imagen.'));
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        cleanup();

        let result: string;
        try {
          result = canvas.toDataURL('image/webp', quality);
          if (!result.startsWith('data:image/webp')) {
            result = canvas.toDataURL('image/jpeg', quality);
          }
        } catch (e) {
          result = canvas.toDataURL('image/jpeg', quality);
        }
        resolve(result);
      } catch (err) {
        cleanup();
        if (typeof source === 'string') resolve(source);
        else reject(err);
      }
    };

    img.onerror = () => {
      cleanup();
      if (typeof source === 'string') resolve(source);
      else reject(new Error('El archivo seleccionado no es una imagen válida o está dañado.'));
    };

    if (typeof source === 'string') {
      img.src = source;
    } else {
      objectUrl = URL.createObjectURL(source);
      img.src = objectUrl;
    }
  });
};

// Memory-safe image validator and compressor directly from File, Blob, or Base64
const validateAndCompressImage = (source: File | Blob | string, minWidth = 150, minHeight = 150): Promise<string> => {
  return new Promise((resolve, reject) => {
    let objectUrl: string | null = null;
    const img = new Image();

    const cleanup = () => {
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
        objectUrl = null;
      }
    };

    img.onload = async () => {
      const origW = img.width;
      const origH = img.height;
      cleanup();

      if (origW < minWidth || origH < minHeight) {
        reject(new Error(`La imagen debe tener al menos ${minWidth}x${minHeight} píxeles de resolución (actual: ${origW}x${origH}px).`));
        return;
      }

      try {
        const compressed = await compressImage(source, 800, 800, 0.6);
        resolve(compressed);
      } catch (err) {
        if (typeof source === 'string') resolve(source);
        else reject(err);
      }
    };

    img.onerror = () => {
      cleanup();
      reject(new Error('El archivo seleccionado no es una imagen válida o está dañado.'));
    };

    if (typeof source === 'string') {
      img.src = source;
    } else {
      objectUrl = URL.createObjectURL(source);
      img.src = objectUrl;
    }
  });
};

import { Logo } from './components/Logo';
import { RecaptchaWidget } from './components/RecaptchaWidget';
import { Html5QrcodeScanner, Html5Qrcode } from 'html5-qrcode';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Cell
} from 'recharts';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { sanitizeForPDF } from './utils/textSanitizer';

import {
  UserRole,
  AppUser,
  Area,
  VOSOPreference,
  VOSOItem,
  VOSOInspection,
  Equipment,
  HistoryEntry,
  Finding,
  Notification,
  ReportSettings,
  VOSOResponse
} from './types';

// --- Components ---

const AuthWrapper = ({ children, theme }: { children: (user: AppUser) => React.ReactNode, theme: 'light' | 'dark' }) => {
  const [user, setUser] = useState<AppUser | null>(() => {
    if (typeof window !== 'undefined') {
      try {
        const cached = localStorage.getItem('chekify_cached_user');
        return cached ? JSON.parse(cached) : null;
      } catch {
        return null;
      }
    }
    return null;
  });

  const [loading, setLoading] = useState(true);
  const [authReady, setAuthReady] = useState(false);
  const [showSplash, setShowSplash] = useState(true);
  const [statusMessage, setStatusMessage] = useState('Iniciando Checkify...');
  const [isOfflineMode, setIsOfflineMode] = useState(!navigator.onLine);

  const [loginMode, setLoginMode] = useState<'Google' | 'Password'>('Password');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [recaptchaToken, setRecaptchaToken] = useState<string | null>(null);
  const [recaptchaResetCount, setRecaptchaResetCount] = useState(0);

  // Progressive real startup indicators
  useEffect(() => {
    // 1. Connection check
    const t1 = setTimeout(() => {
      if (!navigator.onLine) {
        setIsOfflineMode(true);
        setStatusMessage('Modo offline activo');
      } else {
        setStatusMessage('Verificando conexión...');
      }
    }, 280);

    // 2. Application preparation
    const t2 = setTimeout(() => {
      const pendingItems = offlineQueueService.getQueueItems();
      if (pendingItems.length > 0 && navigator.onLine) {
        setStatusMessage('Sincronizando información...');
      } else {
        setStatusMessage('Preparando aplicación...');
      }
    }, 600);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, []);

  // Guarantee minimum professional splash duration (1.1s) and smooth dismissal
  useEffect(() => {
    if (!loading && authReady) {
      const dismissTimer = setTimeout(() => {
        setShowSplash(false);
      }, 950);
      return () => clearTimeout(dismissTimer);
    }
  }, [loading, authReady]);

  // Auth State Listener
  useEffect(() => {
    let userUnsub: (() => void) | null = null;
    
    const authUnsub = onAuthStateChanged(auth, async (firebaseUser) => {
      if (userUnsub) {
        userUnsub();
        userUnsub = null;
      }

      if (firebaseUser) {
        const baseUser: AppUser = {
          uid: firebaseUser.uid,
          email: firebaseUser.email || '',
          name: firebaseUser.displayName || 'Usuario',
          role: firebaseUser.email === 'maisserk@gmail.com' ? 'Administrador' : 'Operador',
        };

        setUser(prev => prev ? { ...prev, ...baseUser } : baseUser);

        // Real-time listener for user document
        userUnsub = onSnapshot(doc(db, 'users', firebaseUser.uid), async (snapshot) => {
          if (snapshot.exists()) {
            const userData = snapshot.data() as AppUser;
            let normalizedRole = userData.role;
            if ((userData.role as string) === 'Admin') normalizedRole = 'Administrador';
            if ((userData.role as string) === 'Operator') normalizedRole = 'Operador';
            
            const resolvedUser = { ...userData, role: normalizedRole };
            if (normalizedRole !== userData.role) {
              try {
                await updateDoc(doc(db, 'users', firebaseUser.uid), { role: normalizedRole });
              } catch (e) { console.warn("Failed to update role in DB:", e); }
            }
            setUser(resolvedUser);
            try {
              localStorage.setItem('chekify_cached_user', JSON.stringify(resolvedUser));
            } catch (e) { console.warn("Error caching user:", e); }
          } else {
            const isAdmin = firebaseUser.email === 'maisserk@gmail.com';
            const newUser: AppUser = {
              uid: firebaseUser.uid,
              email: firebaseUser.email || '',
              name: firebaseUser.displayName || 'Usuario',
              role: isAdmin ? 'Administrador' : 'Operador',
            };
            try {
              await setDoc(doc(db, 'users', firebaseUser.uid), newUser);
              setUser(newUser);
              localStorage.setItem('chekify_cached_user', JSON.stringify(newUser));
            } catch (e) { 
              console.warn("Failed to create user doc in DB:", e);
              setUser(newUser);
            }
          }
          setLoading(false);
          setAuthReady(true);
        }, (err) => {
          console.error("User doc listener error:", err);
          // If offline error, allow cached user to proceed immediately
          setLoading(false);
          setAuthReady(true);
        });
      } else {
        AreaService.reset();
        EquipmentService.reset();
        InspectionService.reset();
        FindingService.reset();
        localStorage.removeItem('chekify_cached_user');
        setUser(null);
        setLoading(false);
        setAuthReady(true);
      }
    });

    return () => {
      authUnsub();
      if (userUnsub) userUnsub();
    };
  }, []);

  const handleGoogleLogin = async () => {
    if (isLoggingIn) return;
    setIsLoggingIn(true);
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    
    try {
      await signInWithPopup(auth, provider);
    } catch (error: any) {
      console.error("Login failed", error);
      if (error.code === 'auth/cancelled-popup-request') {
        console.warn("Popup request was cancelled.");
      } else if (error.code === 'auth/popup-closed-by-user') {
        setError("Inicio de sesión cancelado o bloqueado (Ventana emergente cerrada). Inicia sesión con tu usuario y contraseña corporativa.");
      } else if (error.code === 'auth/popup-blocked') {
        setError("El navegador bloqueó la ventana emergente. Por favor, permite las ventanas emergentes para este sitio o utiliza tu usuario y contraseña corporativa.");
      } else if (error.code === 'auth/network-request-failed') {
        setError("Error de red: No se pudo conectar con el servidor de autenticación. Revisa tu conexión a internet.");
      } else {
        setError("Error al iniciar sesión con Google. Intenta de nuevo o inicia sesión con usuario y contraseña.");
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoggingIn) return;

    // Check reCAPTCHA verification when online and reCAPTCHA is active
    if (!TEMPORARY_DISABLE_RECAPTCHA && navigator.onLine && !recaptchaToken) {
      setError("Por favor, completa la verificación de seguridad (reCAPTCHA) para continuar.");
      return;
    }

    setIsLoggingIn(true);
    setError('');

    try {
      // Strict server token verification when reCAPTCHA is active
      if (!TEMPORARY_DISABLE_RECAPTCHA && navigator.onLine) {
        if (!recaptchaToken) {
          setError("Por favor, completa la verificación de seguridad (reCAPTCHA) para continuar.");
          setIsLoggingIn(false);
          return;
        }

        try {
          const verifyRes = await fetch('/api/verify-recaptcha', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: recaptchaToken }),
          });
          const verifyData = await verifyRes.json().catch(() => null);
          if (!verifyRes.ok || !verifyData || verifyData.success !== true) {
            setError(verifyData?.error || "La verificación de reCAPTCHA no fue válida. Por favor, resuelve nuevamente la casilla de seguridad.");
            setRecaptchaToken(null);
            setRecaptchaResetCount(prev => prev + 1);
            setIsLoggingIn(false);
            return;
          }
        } catch (vErr) {
          console.error("Error al validar reCAPTCHA con el servidor:", vErr);
          setError("No se pudo conectar con el servidor para validar reCAPTCHA. Comprueba tu conexión.");
          setRecaptchaToken(null);
          setRecaptchaResetCount(prev => prev + 1);
          setIsLoggingIn(false);
          return;
        }
      }

      const loginEmail = email.includes('@') ? email : `${email}@chekify.local`;
      await signInWithEmailAndPassword(auth, loginEmail, password);
    } catch (err: any) {
      console.error("Password login failed", err);
      // Reset reCAPTCHA so a fresh check is required on the next attempt
      if (!TEMPORARY_DISABLE_RECAPTCHA) {
        setRecaptchaToken(null);
        setRecaptchaResetCount(prev => prev + 1);
      }

      if (err.code === 'auth/network-request-failed') {
        setError("Error de red: No se pudo conectar con el servidor. Revisa tu conexión a internet.");
      } else if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        setError("Usuario o contraseña incorrectos");
      } else if (err.code === 'auth/too-many-requests') {
        setError("Demasiados intentos fallidos. Tu cuenta ha sido bloqueada temporalmente por seguridad. Intenta más tarde.");
      } else {
        setError("Error al iniciar sesión. Verifica tus credenciales.");
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  return (
    <AnimatePresence mode="wait">
      {showSplash || loading || !authReady ? (
        <SplashScreen
          key="chekify-splash"
          statusMessage={statusMessage}
          isOffline={isOfflineMode}
          onTimeoutRetry={() => window.location.reload()}
          onForceContinue={() => {
            if (auth.currentUser) {
              setShowSplash(false);
            } else {
              setLoading(false);
              setAuthReady(true);
              setShowSplash(false);
            }
          }}
        />
      ) : (!user || !auth.currentUser) ? (
        <motion.div
          key="chekify-login"
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.98 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
          className="relative min-h-screen flex flex-col items-center justify-center p-4 sm:p-6 overflow-hidden bg-zinc-950"
        >
          {/* Responsive Industrial Background: Desktop horizontal / Mobile vertical */}
          <div className="absolute inset-0 w-full h-full pointer-events-none select-none overflow-hidden">
            <picture className="w-full h-full block">
              <source 
                media="(min-width: 768px)" 
                srcSet="/assets/aistudio/Fondo_corporativo_de_planta_cementera_51ed88b8.png" 
              />
              <img 
                src="/assets/aistudio/Planta_industrial_con_dise_o_geom_trico_1e4261c8.png" 
                alt="Planta Industrial CheKify" 
                className="w-full h-full object-cover object-center transform scale-[1.01]" 
              />
            </picture>

            {/* Industrial Contrast Overlay for Pristine Readability */}
            <div className="absolute inset-0 bg-gradient-to-b from-zinc-950/40 via-zinc-950/25 to-zinc-950/65 dark:from-zinc-950/75 dark:via-zinc-950/60 dark:to-zinc-950/85 backdrop-blur-[2px]" />
          </div>

          <div className="relative z-10 max-w-md w-full bg-white/95 dark:bg-zinc-900/90 backdrop-blur-xl rounded-3xl shadow-2xl p-6 sm:p-8 text-center border border-white/70 dark:border-white/10 transition-colors duration-200">
            <div className="flex justify-center mb-4">
              <Logo className="h-14 sm:h-16" />
            </div>
            <p className="text-zinc-500 dark:text-zinc-400 mb-6 font-semibold text-xs sm:text-sm tracking-wide">
              Gestión inteligente de inspecciones
            </p>

            {/* Offline Alert on Login Screen */}
            {!navigator.onLine && (
              <div className="mb-4 p-3 bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 text-xs font-bold rounded-2xl flex items-center justify-center gap-2">
                <WifiOff className="w-4 h-4 shrink-0" />
                <span>Modo offline • Inicia sesión con tus credenciales previas</span>
              </div>
            )}

            {/* Unified Error Message Display */}
            {error && (
              <div className="mb-6 p-4 bg-red-50 dark:bg-red-950/30 border border-red-100 dark:border-red-900 text-red-600 dark:text-red-400 text-sm font-medium rounded-2xl text-left leading-relaxed">
                <span className="font-bold block mb-1">⚠️ Error al iniciar sesión:</span>
                {error}
              </div>
            )}
            
            {loginMode === 'Password' ? (
              <form onSubmit={handlePasswordLogin} className="space-y-4 text-left">
                <div>
                  <label className="block text-xs font-bold text-zinc-400 uppercase tracking-widest mb-1 ml-1">Usuario</label>
                  <input 
                    type="text" 
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full p-3.5 sm:p-4 bg-zinc-50 dark:bg-zinc-800 border border-zinc-100 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 rounded-2xl outline-none focus:ring-2 focus:ring-brand-blue text-sm sm:text-base transition-all"
                    placeholder="nombre.usuario"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-zinc-400 uppercase tracking-widest mb-1 ml-1">Contraseña</label>
                  <div className="relative">
                    <input 
                      type={showPassword ? "text" : "password"} 
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full p-3.5 sm:p-4 bg-zinc-50 dark:bg-zinc-800 border border-zinc-100 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 rounded-2xl outline-none focus:ring-2 focus:ring-brand-blue text-sm sm:text-base transition-all pr-12"
                      placeholder="••••••••"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 transition-colors p-1 cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                {/* Google reCAPTCHA Verification (Active unless temporarily disabled for demo) */}
                {!TEMPORARY_DISABLE_RECAPTCHA && (
                  <RecaptchaWidget
                    siteKey={import.meta.env.VITE_RECAPTCHA_SITE_KEY}
                    onVerify={(token) => {
                      setRecaptchaToken(token);
                      setError('');
                    }}
                    onExpire={() => setRecaptchaToken(null)}
                    onError={() => {
                      setRecaptchaToken(null);
                    }}
                    resetCount={recaptchaResetCount}
                    isDark={document.documentElement.classList.contains('dark')}
                  />
                )}

                <button
                  type="submit"
                  disabled={isLoggingIn}
                  className={`w-full py-3.5 sm:py-4 px-6 bg-gradient-to-r from-brand-blue to-brand-green text-white rounded-2xl font-bold text-sm sm:text-base transition-all shadow-lg shadow-sky-100 dark:shadow-none flex items-center justify-center gap-3 cursor-pointer ${isLoggingIn ? 'opacity-50 cursor-wait' : 'hover:opacity-90 active:scale-[0.99]'}`}
                >
                  {isLoggingIn && <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                  {isLoggingIn ? "Iniciando sesión..." : "Entrar al Sistema"}
                </button>
                <button
                  type="button"
                  onClick={() => setLoginMode('Google')}
                  className="w-full py-2 text-zinc-400 text-xs font-bold uppercase tracking-widest hover:text-zinc-900 dark:hover:text-zinc-200 transition-colors cursor-pointer"
                >
                  O usar Google
                </button>
              </form>
            ) : (
              <div className="space-y-4">
                <button
                  disabled={isLoggingIn}
                  onClick={handleGoogleLogin}
                  className={`w-full py-3.5 sm:py-4 px-6 bg-white dark:bg-zinc-800 border border-zinc-100 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 rounded-2xl font-semibold flex items-center justify-center gap-3 transition-all shadow-sm dark:shadow-none cursor-pointer ${isLoggingIn ? 'opacity-50 cursor-wait' : 'hover:bg-zinc-50 dark:hover:bg-zinc-700 active:scale-[0.99]'}`}
                >
                  {isLoggingIn ? (
                    <div className="w-5 h-5 border-2 border-zinc-300 border-t-zinc-600 rounded-full animate-spin" />
                  ) : (
                    <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-6 h-6" alt="Google" />
                  )}
                  {isLoggingIn ? "Autenticando..." : "Continuar con Google"}
                </button>
                <button
                  onClick={() => setLoginMode('Password')}
                  className="w-full py-2 text-zinc-400 text-xs font-bold uppercase tracking-widest hover:text-zinc-900 dark:hover:text-zinc-200 transition-colors cursor-pointer"
                >
                  Volver a Usuario/Contraseña
                </button>
              </div>
            )}

            <div className="mt-8 pt-4 border-t border-zinc-100 dark:border-white/5">
              <p className="text-[9px] font-bold text-zinc-400 dark:text-zinc-600 uppercase tracking-widest">Industrial Enterprise PWA • Developed by maisser.cl</p>
            </div>
          </div>
        </motion.div>
      ) : (
        <motion.div
          key="chekify-app-ready"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="w-full min-h-screen"
        >
          {children(user)}
        </motion.div>
      )}
    </AnimatePresence>
  );
};

const VOSOExecutionCategory = ({ 
  title, 
  icon: Icon, 
  items, 
  responses, 
  onUpdate,
  onRequestCamera,
  colorClass 
}: { 
  title: string, 
  icon: any, 
  items: VOSOItem[], 
  responses: Record<string, VOSOResponse>,
  onUpdate: (id: string, status: any, comment?: string, photo?: string | string[], solved?: boolean) => void,
  onRequestCamera?: (itemId: string) => void,
  colorClass: string
}) => {
  const [activeCommentId, setActiveCommentId] = useState<string | null>(null);

  if (!items || items.length === 0) return null;

  // Determine border color based on colorClass
  const borderColor = colorClass.includes('sky') ? 'border-sky-200' :
                    colorClass.includes('indigo') ? 'border-indigo-200' :
                    colorClass.includes('emerald') ? 'border-emerald-200' :
                    colorClass.includes('orange') ? 'border-orange-200' : 'border-zinc-200';

  return (
    <div className={`p-10 rounded-[4rem] border-2 ${borderColor} dark:border-white/20 ${colorClass} dark:bg-black/40 space-y-8 shadow-xl dark:shadow-none relative overflow-hidden transition-all hover:shadow-2xl dark:hover:shadow-none`}>
       {/* Background accent */}
       <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 dark:bg-white/5 rounded-full -mr-32 -mt-32 blur-3xl pointer-events-none" />
       
       <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 relative z-10">
        <div className="flex items-center gap-6">
          <div className="p-4 bg-white dark:bg-black rounded-3xl shadow-md dark:shadow-none border border-white/50 dark:border-white/20 flex-shrink-0">
            <Icon className="w-10 h-10 text-zinc-900 dark:text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-4xl font-black text-zinc-900 dark:text-white leading-tight tracking-tighter uppercase mb-0.5">{title.split(' ')[1]}</h4>
              <div className="w-3 h-3 rounded-full bg-zinc-900 dark:bg-white opacity-20 animate-pulse" />
            </div>
            <p className="text-xs font-black text-zinc-500 dark:text-zinc-400 uppercase tracking-[0.3em] opacity-80 flex items-center gap-2">
              <span className="w-4 h-[1px] bg-zinc-400 dark:bg-zinc-600" />
              Metodología VOSO
            </p>
          </div>
        </div>
        <div className="bg-white/90 dark:bg-black/60 backdrop-blur-md px-6 py-3 rounded-2xl border-2 border-white dark:border-white/20 shadow-lg dark:shadow-none flex items-center gap-3 self-start sm:self-center">
          <div className="flex -space-x-2">
            {[1,2,3].map(i => (
              <div key={i} className="w-5 h-5 rounded-full border-2 border-white dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-800" />
            ))}
          </div>
          <span className="text-xs font-black text-zinc-900 dark:text-white uppercase tracking-widest">{items.length} Tareas Pendientes</span>
        </div>
      </div>

      <div className="space-y-6 relative z-10">
        {items.map((item) => {
          const res = responses[item.id];
          const hasIssue = res?.status === 'Observación' || res?.status === 'Crítico';
          
          return (
            <div key={item.id} className={`bg-white/80 dark:bg-black p-7 rounded-[3rem] border-2 transition-all duration-500 ${hasIssue ? 'border-amber-400 shadow-2xl dark:shadow-none scale-[1.03] z-20' : 'border-white dark:border-white/10 shadow-sm dark:shadow-none hover:border-zinc-200 dark:hover:border-white/30'}`}>
              <div className="flex items-start justify-between gap-6 mb-6">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="w-2 h-2 rounded-full bg-zinc-200 dark:bg-zinc-800" />
                    <span className="text-[10px] font-black text-zinc-400 dark:text-zinc-600 uppercase tracking-widest leading-none">Ítem de Inspección</span>
                  </div>
                  <p className="text-xl font-black text-zinc-900 dark:text-white leading-tight tracking-tight">{item.name}</p>
                  <div className="flex flex-wrap gap-2 mt-4">
                    <span className={`text-[10px] font-black uppercase px-3 py-1 rounded-xl tracking-widest flex items-center gap-1.5 ${
                      item.type === 'Crítico' ? 'bg-red-500 text-white shadow-lg shadow-red-100 dark:shadow-none' :
                      item.type === 'Seguridad' ? 'bg-amber-500 text-white shadow-lg shadow-amber-100 dark:shadow-none' :
                      item.type === 'Mantenimiento' ? 'bg-brand-blue text-white shadow-lg shadow-sky-100 dark:shadow-none' :
                      'bg-zinc-100 dark:bg-zinc-900 text-zinc-500 dark:text-zinc-500'
                    }`}>
                      <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                      {item.type}
                    </span>
                    <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-700 uppercase tracking-widest bg-zinc-50/80 dark:bg-zinc-900/40 px-3 py-1 rounded-xl border border-zinc-100/50 dark:border-white/10">ID: {item.id.slice(0,6)}</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: 'OK', value: 'OK', selectedClasses: 'bg-emerald-500 text-white border-emerald-600 shadow-2xl shadow-emerald-200 dark:shadow-none ring-4 ring-emerald-50 dark:ring-emerald-500/10' },
                  { label: 'Obs.', value: 'Observación', selectedClasses: 'bg-amber-500 text-white border-amber-600 shadow-2xl shadow-amber-200 dark:shadow-none ring-4 ring-amber-50 dark:ring-amber-500/10' },
                  { label: 'Crit.', value: 'Crítico', selectedClasses: 'bg-red-500 text-white border-red-600 shadow-2xl shadow-red-200 dark:shadow-none ring-4 ring-red-50 dark:ring-red-500/10' },
                  { label: 'N/A', value: 'NA', selectedClasses: 'bg-zinc-800 dark:bg-black text-white border-zinc-950 dark:border-white shadow-2xl shadow-zinc-200 dark:shadow-none ring-4 ring-zinc-50 dark:ring-zinc-500/10' }
                ].map((opt) => {
                  const isSelected = res?.status === opt.value;
                  return (
                    <button
                      key={opt.label}
                      onClick={() => onUpdate(item.id, opt.value as any)}
                      className={`py-5 px-4 rounded-[1.8rem] text-xs font-black uppercase transition-all duration-300 border-2 ${
                        isSelected 
                          ? `${opt.selectedClasses} scale-[1.1] z-10`
                          : 'bg-white dark:bg-zinc-950/20 text-zinc-400 dark:text-zinc-600 border-zinc-100/80 dark:border-white/5 hover:border-zinc-300 dark:hover:border-white/20 shadow-sm dark:shadow-none active:scale-90 hover:scale-[1.03] hover:text-zinc-600 dark:hover:text-zinc-300'
                      }`}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>

              <AnimatePresence>
                {hasIssue && (
                  <motion.div 
                    initial={{ height: 0, opacity: 0 }} 
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="space-y-3 pt-2 overflow-hidden border-t border-zinc-100/50 dark:border-white/10 mt-2"
                  >
                    <div className="flex items-center justify-between bg-zinc-50/50 dark:bg-black/20 p-3 rounded-2xl border border-zinc-100/50 dark:border-white/10">
                      <div className="flex items-center gap-3">
                        <div className={`p-1.5 rounded-lg ${res?.solvedByOperator ? 'bg-emerald-500 text-white' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-500'}`}>
                          <ShieldCheck className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="text-[10px] font-bold text-zinc-900 dark:text-white leading-none">Solucionado en sitio</p>
                          <p className="text-[8px] text-zinc-400 dark:text-zinc-500 mt-0.5">Acción correctiva inmediata</p>
                        </div>
                      </div>
                      <button 
                         onClick={() => onUpdate(item.id, res.status, res.comment, res.photoUrl, !res?.solvedByOperator)}
                         className={`w-12 h-6 rounded-full transition-all relative ${res?.solvedByOperator ? 'bg-emerald-500' : 'bg-zinc-200 dark:bg-zinc-700'}`}
                      >
                        <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${res?.solvedByOperator ? 'left-7' : 'left-1'}`} />
                      </button>
                    </div>

                    <textarea 
                      value={res?.comment || ''}
                      onChange={e => onUpdate(item.id, res.status, e.target.value)}
                      placeholder="Escribe el detalle del hallazgo..."
                      className="w-full p-3 bg-white/80 dark:bg-black/40 border border-zinc-200 dark:border-white/10 rounded-2xl text-xs outline-none focus:ring-2 focus:ring-amber-200 min-h-[80px] font-medium text-zinc-700 dark:text-zinc-300 shadow-sm dark:shadow-none"
                    />
                    
                    {(() => {
                      const itemPhotos: string[] = res?.photoUrls && res.photoUrls.length > 0
                        ? res.photoUrls
                        : (res?.photoUrl ? [res.photoUrl] : []);
                      const isPhotoMissing = itemPhotos.length === 0;
                      
                      return (
                        <div className="space-y-3 pt-1">
                          {isPhotoMissing && (
                            <div className="p-2.5 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-500/30 rounded-xl flex items-center gap-2 text-red-600 dark:text-red-400 text-[10px] font-bold">
                              <span>⚠️</span>
                              <span>FOTO OBLIGATORIA: Debes adjuntar al menos una foto evidencia para este hallazgo.</span>
                            </div>
                          )}

                          <input 
                            type="file" 
                            accept="image/*" 
                            className="hidden" 
                            id={`photo-${item.id}`}
                            onChange={async (e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                if (itemPhotos.length >= 3) {
                                  e.target.value = '';
                                  return;
                                }
                                try {
                                  const compressed = await validateAndCompressImage(file, 150, 150);
                                  const updated = [...itemPhotos, compressed].slice(0, 3);
                                  onUpdate(item.id, res.status, res.comment, updated, res.solvedByOperator);
                                  e.target.value = '';
                                } catch (err: any) {
                                  console.error("Checklist image processing error:", err);
                                  e.target.value = '';
                                }
                              }
                            }}
                          />

                          <div className="flex flex-wrap items-center gap-2.5">
                            {itemPhotos.length < 3 && (
                              <div className="flex items-center gap-2 w-full sm:w-auto">
                                <button 
                                  type="button"
                                  onClick={() => {
                                    if (onRequestCamera) {
                                      onRequestCamera(item.id);
                                    } else {
                                      document.getElementById(`photo-${item.id}`)?.click();
                                    }
                                  }}
                                  className={`flex-1 sm:flex-initial py-3 px-4 rounded-2xl text-[11px] font-black uppercase tracking-wide flex items-center justify-center gap-2 active:scale-95 transition-all cursor-pointer shadow-md ${
                                    isPhotoMissing 
                                      ? 'bg-red-600 hover:bg-red-700 text-white shadow-red-500/25 animate-pulse' 
                                      : 'bg-[#0071E3] hover:bg-[#0077ED] text-white shadow-blue-500/20'
                                  }`}
                                  title="Tomar foto directamente con la cámara de la aplicación"
                                >
                                  <Camera className="w-4 h-4 shrink-0" />
                                  <span>{itemPhotos.length === 0 ? '📷 Tomar Foto (Cámara)' : `+ Foto (${itemPhotos.length}/3)`}</span>
                                </button>

                                <label 
                                  htmlFor={`photo-${item.id}`}
                                  className="py-3 px-3.5 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 rounded-2xl text-[11px] font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer border border-zinc-200 dark:border-zinc-700 active:scale-95 shrink-0"
                                  title="Subir foto desde la galería o archivos del dispositivo"
                                >
                                  <Upload className="w-4 h-4 shrink-0" />
                                  <span>Galería</span>
                                </label>
                              </div>
                            )}

                            {itemPhotos.map((pUrl, pIdx) => (
                              <div key={`item-${item.id}-p-${pIdx}`} className="relative group w-12 h-12 rounded-xl overflow-hidden bg-zinc-100 dark:bg-zinc-800 border-2 border-white dark:border-white/20 shadow-sm flex-shrink-0">
                                <OfflineImage src={pUrl} className="w-full h-full object-cover" />
                                <button
                                  type="button"
                                  onClick={() => {
                                    const updated = itemPhotos.filter((_, idx) => idx !== pIdx);
                                    onUpdate(item.id, res.status, res.comment, updated, res.solvedByOperator);
                                  }}
                                  className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5 shadow-md opacity-90 hover:opacity-100 transition-opacity cursor-pointer z-10"
                                  title="Eliminar foto"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })()}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// --- Operator View ---

const OperatorDashboard = ({ 
  user, 
  setActiveTab,
  weather = null,
  loadingWeather = false,
  weatherError = false,
  plant = null
}: { 
  user: AppUser; 
  setActiveTab?: (tab: 'Home' | 'History' | 'Admin' | 'Notifications' | 'PDFConfig') => void;
  weather?: WeatherData | null;
  loadingWeather?: boolean;
  weatherError?: boolean;
  plant?: Plant | null;
}) => {
  const [scanning, setScanning] = useState(false);
  const [showQuickHelp, setShowQuickHelp] = useState(false);
  const [selectedArea, setSelectedArea] = useState<Area | null>(null);
  const [areas, setAreas] = useState<Area[]>(() => getCachedAreas());
  const [equipment, setEquipment] = useState<Equipment[]>(() => getCachedEquipment());
  const [currentEquipmentIndex, setCurrentEquipmentIndex] = useState(0);
  const [showFindingForm, setShowFindingForm] = useState(false);
  const [message, setMessage] = useState<{ text: string, type: 'success' | 'error' } | null>(null);
  const [findingDescription, setFindingDescription] = useState('');
  const [findingCategory, setFindingCategory] = useState<'VOSO' | 'OrdenYLimpieza'>('VOSO');
  const [findingSubcat, setFindingSubcat] = useState<'Residuos' | 'Herramientas' | 'Derrames' | 'Obstrucciones' | 'Limpieza' | 'General'>('Residuos');
  const [findingPhotos, setFindingPhotos] = useState<string[]>([]);
  const findingPhoto = findingPhotos[0] || null;
  const [immediateSolution, setImmediateSolution] = useState('');
  const [isClosingImmediately, setIsClosingImmediately] = useState(false);
  const [formValidationError, setFormValidationError] = useState<string | null>(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successModalConfig, setSuccessModalConfig] = useState<{ title: string; message: string } | null>(null);
  const [lastSavedFindingForPdf, setLastSavedFindingForPdf] = useState<Finding | null>(null);
  const { getOperatorProfile } = useAppUsers();

  useEffect(() => {
    if (!showFindingForm) {
      setFormValidationError(null);
    }
  }, [showFindingForm]);

  const [isSaving, setIsSaving] = useState(false);
  const [searchingArea, setSearchingArea] = useState(false);
  const [areaSearchQuery, setAreaSearchQuery] = useState('');
  const [allActiveFindings, setAllActiveFindings] = useState<Finding[]>([]);
  const [duplicateFinding, setDuplicateFinding] = useState<Finding | null>(null);
  const [cameraCaptureTarget, setCameraCaptureTarget] = useState<
    | { type: 'finding' }
    | { type: 'voso'; itemId: string }
    | null
  >(null);
  const showInAppCameraModal = cameraCaptureTarget !== null;

  // Focus Mode (100% full-screen distraction-free inspection view)
  const [isFocusInspectionMode, setIsFocusInspectionMode] = useState<boolean>(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFocusInspectionMode) {
        setIsFocusInspectionMode(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFocusInspectionMode]);

  const toggleFocusMode = async () => {
    const nextState = !isFocusInspectionMode;
    setIsFocusInspectionMode(nextState);

    // Optional native fullscreen toggle with safety try-catch
    try {
      if (nextState) {
        if (document.documentElement.requestFullscreen && !document.fullscreenElement) {
          await document.documentElement.requestFullscreen().catch(() => {});
        }
      } else {
        if (document.exitFullscreen && document.fullscreenElement) {
          await document.exitFullscreen().catch(() => {});
        }
      }
    } catch {}
  };


  
  // Collapsible areas and inspection tracking
  const [expandedAreaIds, setExpandedAreaIds] = useState<Record<string, boolean>>({});
  const [allInspections, setAllInspections] = useState<any[]>([]);

  const toggleAreaExpand = (areaId: string) => {
    setExpandedAreaIds(prev => ({ ...prev, [areaId]: !prev[areaId] }));
  };

  const getEquipInspectionStatus = (areaId: string, equipId: string): 'completed' | 'pending' => {
    // Check current active session first
    if (selectedArea?.id === areaId && inspectionResults[equipId]) {
      const res = inspectionResults[equipId];
      if (res.trad || res.voso) return 'completed';
    }

    // Check today's completed inspections from DB
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const isDone = allInspections.some((insp: any) => {
      if (insp.areaId !== areaId) return false;

      let inspDate: Date | null = null;
      if (insp.completedAt?.toDate) inspDate = insp.completedAt.toDate();
      else if (insp.timestamp?.toDate) inspDate = insp.timestamp.toDate();
      else if (insp.completedAt) inspDate = new Date(insp.completedAt);
      else if (insp.timestamp) inspDate = new Date(insp.timestamp);

      if (!inspDate || inspDate < startOfToday) return false;

      if (insp.results && (insp.results[equipId] || Object.keys(insp.results).length > 0)) {
        if (insp.results[equipId]) return true;
      }
      return false;
    });

    return isDone ? 'completed' : 'pending';
  };
  
  const [checkItemStates, setCheckItemStates] = useState<Record<string, 'Bueno' | 'Regular' | 'Malo'>>({});
  const [vosoResponses, setVosoResponses] = useState<Record<string, VOSOResponse>>({});
  const [equipmentOperatingStatus, setEquipmentOperatingStatus] = useState<Record<string, 'En Funcionamiento' | 'Detenido'>>({});
  const [inspectionResults, setInspectionResults] = useState<Record<string, { trad: any, voso: any, operatingStatus?: 'En Funcionamiento' | 'Detenido' }>>({});
  const [showEquipmentSummary, setShowEquipmentSummary] = useState(false);
  const [slideDirection, setSlideDirection] = useState<'next' | 'prev'>('next');
  
  // Tracking inspection times & pause state
  const [inspectionStartTime, setInspectionStartTime] = useState<Date | null>(null);
  const [equipmentStartTime, setEquipmentStartTime] = useState<Date | null>(null);
  const [inspectionTimerSeconds, setInspectionTimerSeconds] = useState<number>(0);
  const [equipmentTimerSeconds, setEquipmentTimerSeconds] = useState<number>(0);
  const [isInspectionPaused, setIsInspectionPaused] = useState<boolean>(false);
  const [isPauseModalOpen, setIsPauseModalOpen] = useState<boolean>(false);
  const [pauseReason, setPauseReason] = useState<string>('');

  // Active timer ticker (freezes automatically when paused or in summary)
  useEffect(() => {
    if (!selectedArea || isInspectionPaused || showEquipmentSummary) return;

    const interval = setInterval(() => {
      setInspectionTimerSeconds(prev => prev + 1);
      setEquipmentTimerSeconds(prev => prev + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [selectedArea, isInspectionPaused, showEquipmentSummary]);

  const formatTimer = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    const hours = Math.floor(mins / 60);
    const displayMins = mins % 60;
    if (hours > 0) {
      return `${hours.toString().padStart(2, '0')}:${displayMins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${displayMins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Robust auto-restore active inspection draft from localStorage to prevent loss if mobile camera restarts browser
  useEffect(() => {
    try {
      const savedDraft = localStorage.getItem('chekify_active_inspection_draft_v2') || sessionStorage.getItem('chekify_active_inspection_draft');
      if (savedDraft) {
        const parsed = JSON.parse(savedDraft);
        if (parsed.selectedArea) {
          setSelectedArea(parsed.selectedArea);
          if (typeof parsed.currentEquipmentIndex === 'number') setCurrentEquipmentIndex(parsed.currentEquipmentIndex);
          if (parsed.showFindingForm) setShowFindingForm(true);
          if (parsed.findingDescription) setFindingDescription(parsed.findingDescription);
          if (parsed.findingCategory) setFindingCategory(parsed.findingCategory);
          if (parsed.findingSubcat) setFindingSubcat(parsed.findingSubcat);
          if (Array.isArray(parsed.findingPhotos) && parsed.findingPhotos.length > 0) setFindingPhotos(parsed.findingPhotos);
          if (parsed.immediateSolution) setImmediateSolution(parsed.immediateSolution);
          if (parsed.inspectionResults) setInspectionResults(parsed.inspectionResults);
          if (parsed.checkItemStates) setCheckItemStates(parsed.checkItemStates);
          if (parsed.vosoResponses) setVosoResponses(parsed.vosoResponses);
          if (parsed.equipmentOperatingStatus) setEquipmentOperatingStatus(parsed.equipmentOperatingStatus);
          if (typeof parsed.inspectionTimerSeconds === 'number') setInspectionTimerSeconds(parsed.inspectionTimerSeconds);
        }
      }
    } catch (e) {
      console.warn("Could not restore inspection draft", e);
    }
  }, []);

  // Robust auto-save active inspection draft to localStorage
  useEffect(() => {
    if (selectedArea) {
      try {
        const draft = {
          selectedArea,
          currentEquipmentIndex,
          showFindingForm,
          findingDescription,
          findingCategory,
          findingSubcat,
          findingPhotos: (findingPhotos || []).slice(0, 3),
          immediateSolution,
          inspectionResults,
          checkItemStates,
          vosoResponses,
          equipmentOperatingStatus,
          inspectionTimerSeconds,
          savedAt: Date.now()
        };
        localStorage.setItem('chekify_active_inspection_draft_v2', JSON.stringify(draft));
      } catch (e) {
        // Ignore quota limits
      }
    } else {
      localStorage.removeItem('chekify_active_inspection_draft_v2');
      sessionStorage.removeItem('chekify_active_inspection_draft');
    }
  }, [
    selectedArea, 
    currentEquipmentIndex, 
    showFindingForm, 
    findingDescription, 
    findingCategory, 
    findingSubcat, 
    findingPhotos, 
    immediateSolution, 
    inspectionResults, 
    checkItemStates, 
    vosoResponses, 
    equipmentOperatingStatus,
    inspectionTimerSeconds
  ]);

  // Scroll back to the top of the view when the equipment index, selected area, or summary state changes
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [currentEquipmentIndex, selectedArea?.id, showEquipmentSummary]);

  // Weather & Safety Pre-Inspection Warning Pop-up State
  const [pendingAreaForInspection, setPendingAreaForInspection] = useState<Area | null>(null);
  const [pendingEquipIndexForInspection, setPendingEquipIndexForInspection] = useState<number>(0);
  const [showWeatherSafetyModal, setShowWeatherSafetyModal] = useState<boolean>(false);

  const executeStartAreaInspection = (area: Area, initialEquipIndex = 0) => {
    setSelectedArea(area);
    setCurrentEquipmentIndex(initialEquipIndex);
    setInspectionStartTime(new Date());
    setEquipmentStartTime(new Date());
    setInspectionTimerSeconds(0);
    setEquipmentTimerSeconds(0);
    setIsInspectionPaused(false);
    setIsPauseModalOpen(false);
    setPauseReason('');
  };

  const startAreaInspection = (area: Area, initialEquipIndex = 0) => {
    setPendingAreaForInspection(area);
    setPendingEquipIndexForInspection(initialEquipIndex);
    setShowWeatherSafetyModal(true);
  };

  const resetInspectionState = () => {
    setSelectedArea(null);
    setInspectionStartTime(null);
    setInspectionTimerSeconds(0);
    setEquipmentTimerSeconds(0);
    setIsInspectionPaused(false);
    setIsPauseModalOpen(false);
    setPauseReason('');
    setCurrentEquipmentIndex(0);
    setInspectionResults({});
    setCheckItemStates({});
    setVosoResponses({});
    setEquipmentOperatingStatus({});
    setShowEquipmentSummary(false);
    try { sessionStorage.removeItem('chekify_active_inspection_draft'); } catch(e) {}
  };
  
  const saveCurrentToResults = () => {
    if (currentEquipment) {
      const currentOpStatus = equipmentOperatingStatus[currentEquipment.id] || 'En Funcionamiento';
      const currentData = {
        trad: { ...checkItemStates },
        voso: { ...vosoResponses },
        operatingStatus: currentOpStatus
      };
      setInspectionResults(prev => ({
        ...prev,
        [currentEquipment.id]: currentData
      }));
      return currentData;
    }
    return null;
  };

  const loadEquipmentData = (index: number, resultsOverride?: any) => {
    const targetEquip = areaEquipment[index];
    if (targetEquip) {
      const results = resultsOverride || inspectionResults;
      const saved = results[targetEquip.id];
      setCheckItemStates(saved?.trad || {});
      setVosoResponses(saved?.voso || {});
      if (saved?.operatingStatus) {
        setEquipmentOperatingStatus(prev => ({ ...prev, [targetEquip.id]: saved.operatingStatus }));
      }
    } else {
      setCheckItemStates({});
      setVosoResponses({});
    }
  };

  const handleSetItemState = (itemId: string, state: 'Bueno' | 'Regular' | 'Malo') => {
    setCheckItemStates(prev => ({ ...prev, [itemId]: state }));
  };

   const handleSetVOSOResponse = (itemId: string, status: any, comment?: string, photo?: string | string[], solved?: boolean) => {
    setVosoResponses(prev => {
      const current = prev[itemId] || { status: 'OK' };
      let photoUrl = current.photoUrl;
      let photoUrls = current.photoUrls || (current.photoUrl ? [current.photoUrl] : []);

      if (Array.isArray(photo)) {
        photoUrls = photo;
        photoUrl = photo[0] || null;
      } else if (photo !== undefined) {
        if (photo) {
          if (!photoUrls.includes(photo)) {
            photoUrls = [...photoUrls, photo].slice(0, 3);
          }
          photoUrl = photoUrls[0] || null;
        } else {
          photoUrl = null;
          photoUrls = [];
        }
      }

      return {
        ...prev,
        [itemId]: {
          ...current,
          status,
          comment: comment !== undefined ? comment : (current.comment ?? null),
          photoUrl: photoUrl ?? null,
          photoUrls,
          solvedByOperator: solved !== undefined ? solved : (current.solvedByOperator ?? false)
        }
      };
    });
  };

  const allItemsChecked = () => {
    const tradChecked = !currentEquipment?.checkItems || currentEquipment.checkItems.length === 0 || 
                        currentEquipment.checkItems.every(item => checkItemStates[item.id]);
    
    const voso = currentEquipment?.inspeccionVOSO;
    const vosoChecked = !voso || [
      ...(voso.ver || []), 
      ...(voso.oir || []), 
      ...(voso.sentir || []), 
      ...(voso.oler || []),
      ...(voso.orden || [])
    ].every(item => {
      const resp = vosoResponses[item.id];
      if (!resp?.status) return false;
      if (resp.status === 'Observación' || resp.status === 'Crítico') {
        const hasPhoto = (resp.photoUrls && resp.photoUrls.length > 0) || (!!resp.photoUrl && resp.photoUrl.trim().length > 0);
        if (!hasPhoto) return false;
      }
      return true;
    });

    return tradChecked && vosoChecked;
  };

  const getVosoIssuesMissingPhotos = () => {
    const voso = currentEquipment?.inspeccionVOSO;
    if (!voso) return [];
    const allVosoItems = [
      ...(voso.ver || []), 
      ...(voso.oir || []), 
      ...(voso.sentir || []), 
      ...(voso.oler || []),
      ...(voso.orden || [])
    ];
    return allVosoItems.filter(item => {
      const resp = vosoResponses[item.id];
      if (resp && (resp.status === 'Observación' || resp.status === 'Crítico')) {
        const hasPhoto = (resp.photoUrls && resp.photoUrls.length > 0) || (!!resp.photoUrl && resp.photoUrl.trim().length > 0);
        return !hasPhoto;
      }
      return false;
    });
  };

  const hasAnyDefect = () => {
    const tradDefect = Object.values(checkItemStates).some(state => state === 'Regular' || state === 'Malo');
    const vosoDefect = (Object.values(vosoResponses) as VOSOResponse[]).some(resp => resp.status === 'Observación' || resp.status === 'Crítico');
    return tradDefect || vosoDefect;
  };
  const scannerRef = useRef<Html5Qrcode | null>(null);
  
  // Cleanup on unmount
  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => setMessage(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [message]);

  useEffect(() => {
    return () => {
      if (scannerRef.current && scannerRef.current.isScanning) {
        scannerRef.current.stop().catch(console.error);
      }
    };
  }, []);

  const [plantStats, setPlantStats] = useState({
    avgResolutionHours: 0,
    avgInspectionSeconds: 0,
    avgEquipSeconds: 0,
    totalOpen: 0,
    totalInReview: 0,
    totalClosed: 0
  });

  useEffect(() => {
    // Listen for areas scoped by plant via multiplexed AreaService
    const unsubAreas = AreaService.subscribeToAreas((areaData) => {
      setAreas(areaData);
    }, user.role === 'Administrador' ? undefined : (user.plantId || undefined));

    // Listen for equipment via enterprise EquipmentService honoring plant permissions
    const unsubEquip = EquipmentService.subscribeToEquipment((equipData) => {
      setEquipment(equipData);
    }, user.role === 'Administrador' ? undefined : (user.plantId || undefined));

    // Listen for recent inspections via multiplexed InspectionService
    const unsubInspections = InspectionService.subscribeToRecentInspections((inspectionsData) => {
      setAllInspections(inspectionsData);
    }, user.plantId, user.role === 'Administrador');

    // Listen for findings in user's plant via shared multiplexed FindingService
    let unsubStats: (() => void) | null = null;
    if (user.plantId || user.role === 'Administrador') {
      unsubStats = FindingService.subscribeToFindings((plantFindings) => {
        setAllActiveFindings(plantFindings.filter(f => f.status !== 'Closed'));
        
        const closedFindings = plantFindings.filter(f => f.status === 'Closed' && f.closedAt && f.createdAt);
        
        let totalResolutionMs = 0;
        closedFindings.forEach(f => {
          const createdMs = parseAnyDate(f.createdAt)?.getTime() || 0;
          const closedMs = parseAnyDate(f.closedAt)?.getTime() || 0;
          const resolutionTime = closedMs - createdMs;
          if (resolutionTime > 0) totalResolutionMs += resolutionTime;
        });
        
        const avgHours = closedFindings.length > 0 
          ? (totalResolutionMs / (1000 * 60 * 60)) / closedFindings.length 
          : 0;

        // Avg Inspection time
        const inspectionsWithTime = plantFindings.filter(f => f.inspectionDurationSeconds !== undefined || (f.inspectionStartedAt && f.inspectionCompletedAt));
        let totalAreaSeconds = 0;
        let totalEquipSeconds = 0;
        let equipCount = 0;

        inspectionsWithTime.forEach(f => {
          let areaSec = f.inspectionDurationSeconds || 0;
          if (!areaSec && f.inspectionStartedAt && f.inspectionCompletedAt) {
            const startMs = parseAnyDate(f.inspectionStartedAt)?.getTime() || 0;
            const compMs = parseAnyDate(f.inspectionCompletedAt)?.getTime() || 0;
            areaSec = (compMs - startMs) / 1000;
          }
          totalAreaSeconds += areaSec;
          
          if (f.equipmentDurationSeconds !== undefined) {
            totalEquipSeconds += f.equipmentDurationSeconds;
            equipCount++;
          }
        });

        const avgAreaSeconds = inspectionsWithTime.length > 0 ? totalAreaSeconds / inspectionsWithTime.length : 0;
        const avgEquipSeconds = equipCount > 0 ? totalEquipSeconds / equipCount : 0;

        setPlantStats({
          avgResolutionHours: Math.round(avgHours * 10) / 10,
          avgInspectionSeconds: Math.round(avgAreaSeconds),
          avgEquipSeconds: Math.round(avgEquipSeconds),
          totalOpen: plantFindings.filter(f => f.status === 'Open').length,
          totalInReview: plantFindings.filter(f => f.status === 'InReview').length,
          totalClosed: plantFindings.filter(f => f.status === 'Closed').length
        });
      }, user.plantId);
    }

    return () => {
      unsubAreas();
      unsubEquip();
      unsubInspections();
      if (unsubStats) unsubStats();
    };
  }, [user.plantId, user.role]);

  const startScanner = async () => {
    if (scannerRef.current && scannerRef.current.isScanning) {
      return;
    }

    setScanning(true);
    // Give more time for the #reader div to be ready in the DOM
    setTimeout(async () => {
      try {
        const readerElement = document.getElementById("reader");
        if (!readerElement) {
          throw new Error("Elemento de escaneo no encontrado en el DOM.");
        }

        if (scannerRef.current) {
          try {
            await scannerRef.current.stop();
          } catch(e) {}
        }

        const scanner = new Html5Qrcode("reader");
        scannerRef.current = scanner;
        
        const config = { fps: 10, qrbox: { width: 250, height: 250 } };
        
        const onScanSuccess = (decodedText: string) => {
          const raw = (decodedText || '').trim();
          const lower = raw.toLowerCase();
          const area = areas.find(a => {
            const aId = (a.id || '').trim();
            const aQr = (a.qrCode || '').trim();
            return (
              aId === raw || 
              aQr === raw ||
              aId.toLowerCase() === lower ||
              (aQr && aQr.toLowerCase() === lower) ||
              (lower.includes('area=') && lower.includes(aId.toLowerCase())) ||
              (aQr && lower.includes('qr=') && lower.includes(aQr.toLowerCase()))
            );
          });
          if (area) {
            startAreaInspection(area);
            scanner.stop().then(() => {
              scannerRef.current = null;
              setScanning(false);
            }).catch(() => {
              setScanning(false);
            });
          }
        };

        // Try-catch chain for different device scenarios
        try {
          // 1. Standard: Back camera
          await scanner.start({ facingMode: "environment" }, config, onScanSuccess, () => {});
        } catch (err1: any) {
          console.warn("Retrying with facingMode: user...");
          try {
            // 2. Fallback: Front/Default camera
            await scanner.start({ facingMode: "user" }, config, onScanSuccess, () => {});
          } catch (err2: any) {
            console.warn("Retrying with camera enumeration...");
                try {
                  // Final broad attempt: any video
                  await scanner.start({ video: true } as any, config, onScanSuccess, () => {});
                } catch (err3: any) {
                  // Some devices need a clean stream request first to unlock
                  try {
                    const tempStream = await navigator.mediaDevices.getUserMedia({ video: true });
                    tempStream.getTracks().forEach(track => track.stop()); // Immediately stop it
                    await scanner.start({ video: true } as any, config, onScanSuccess, () => {});
                  } catch (errFinal) {
                    throw errFinal;
                  }
                }
          }
        }

      } catch (err: any) {
        console.error("Critical Scanner Error Details:", err);
        const name = err?.name || "";
        const msg = String(err).toLowerCase();

        if (name === "NotReadableError" || msg.includes("notreadable")) {
          setMessage({ text: "La cámara está siendo usada por otra aplicación.", type: 'error' });
        } else if (name === "NotAllowedError" || msg.includes("notallowed") || msg.includes("permission")) {
          setMessage({ text: "Acceso a cámara denegado. Por favor, concede permisos en la barra de direcciones y recarga.", type: 'error' });
        } else if (name === "NotFoundError" || msg.includes("notfound") || msg.includes("no camera")) {
          setMessage({ text: "No se encontró ninguna cámara en este dispositivo.", type: 'error' });
        } else if (msg.includes("insecure") || msg.includes("http:")) {
          setMessage({ text: "La cámara requiere una conexión segura (HTTPS).", type: 'error' });
        } else {
          setMessage({ text: "Error crítico del escáner: " + (err?.message || "Permiso denegado"), type: 'error' });
        }
        setScanning(false);
        scannerRef.current = null;
      }
    }, 600); // 600ms to ensure DOM is ready and stable
  };

  const stopScanner = () => {
    if (scannerRef.current && scannerRef.current.isScanning) {
      scannerRef.current.stop().then(() => {
        scannerRef.current = null;
        setScanning(false);
      }).catch(() => {
        setScanning(false);
      });
    } else {
      setScanning(false);
    }
  };

  const areaEquipment = equipment
    .filter(e => e.areaId === selectedArea?.id && (e as any).status !== 'deleted')
    .sort((a, b) => (a.inspectionOrder || 0) - (b.inspectionOrder || 0));

  const currentEquipment = areaEquipment[currentEquipmentIndex];

  const sanitizeForFirestore = (obj: any): any => {
    if (obj === undefined) return null;
    if (obj === null || typeof obj !== 'object') return obj;
    if (obj instanceof Date || obj instanceof Timestamp) return obj;
    // Check for Firestore FieldValue
    if (obj?._methodName || obj?.constructor?.name === 'FieldValue') return obj;
    
    if (Array.isArray(obj)) return obj.map(v => sanitizeForFirestore(v));
    
    const newObj: any = {};
    for (const [k, v] of Object.entries(obj)) {
      if (v !== undefined) {
        newObj[k] = sanitizeForFirestore(v);
      }
    }
    return newObj;
  };

  const handleNextEquipment = async (finishEarly: boolean = false) => {
    const missingPhotos = getVosoIssuesMissingPhotos();
    if (missingPhotos.length > 0) {
      const names = missingPhotos.map(i => i.name).join(', ');
      setMessage({ 
        text: `Debes tomar al menos 1 foto evidencia para los hallazgos: ${names}`, 
        type: 'error' 
      });
      return;
    }

    const now = new Date();
    const currentOpStatus = (currentEquipment && equipmentOperatingStatus[currentEquipment.id]) || 'En Funcionamiento';
    const computedSecs = equipmentTimerSeconds > 0
      ? equipmentTimerSeconds
      : (equipmentStartTime ? Math.max(1, Math.round((now.getTime() - equipmentStartTime.getTime()) / 1000)) : 0);

    const currentData = {
      trad: { ...checkItemStates },
      voso: { ...vosoResponses },
      operatingStatus: currentOpStatus,
      timing: {
        startedAt: equipmentStartTime || now,
        completedAt: now,
        durationSeconds: computedSecs
      }
    };
    
    const updatedRawResults = {
      ...inspectionResults,
      [currentEquipment.id]: currentData
    };

    const updatedResults = sanitizeForFirestore(updatedRawResults);

    if (currentEquipmentIndex < areaEquipment.length - 1 && !finishEarly) {
      setInspectionResults(updatedResults);
      setSlideDirection('next');
      // Load next equipment data (or empty if new)
      const nextIndex = currentEquipmentIndex + 1;
      const nextEquip = areaEquipment[nextIndex];
      const nextSaved = updatedResults[nextEquip.id] as { trad: any, voso: any, operatingStatus?: 'En Funcionamiento' | 'Detenido', timing: any } | undefined;
      setCheckItemStates(nextSaved?.trad || {});
      setVosoResponses(nextSaved?.voso || {});
      if (nextSaved?.operatingStatus) {
        setEquipmentOperatingStatus(prev => ({ ...prev, [nextEquip.id]: nextSaved.operatingStatus! }));
      }
      setCurrentEquipmentIndex(nextIndex);
      setEquipmentStartTime(new Date());
      setEquipmentTimerSeconds(0);
    } else {
      // Finished all equipment or exited early
      setIsSaving(true);
      try {
        const isPartial = currentEquipmentIndex < areaEquipment.length - 1;
        const hasFindings = Object.values(updatedResults).some(resAny => {
          const res = resAny as { trad: any, voso: any };
          const trad = res?.trad || {};
          const voso = res?.voso || {};
          return Object.values(trad).some(s => s !== 'Bueno') ||
                 (Object.values(voso) as VOSOResponse[]).some(v => v?.status === 'Observación' || v?.status === 'Crítico');
        });

        const inspectionCompletedTime = new Date();
        const totalDurationSeconds = inspectionTimerSeconds > 0 
          ? inspectionTimerSeconds 
          : (inspectionStartTime ? Math.round((inspectionCompletedTime.getTime() - inspectionStartTime.getTime()) / 1000) : 0);

        const inspectionId = doc(collection(db, 'inspections')).id;
        const isOnline = offlineQueueService.getConnectivityStatus();

        const climaPayload = weather ? {
          temperature: weather.temperature,
          apparentTemperature: weather.apparentTemperature,
          humidity: weather.humidity,
          windSpeed: weather.windSpeed,
          windDirection: weather.windDirection ?? 'N/A',
          windGusts: weather.windGusts,
          precipitation: weather.precipitation,
          rain: weather.rain,
          uvIndex: weather.uvIndex ?? 'N/A',
          uvIndexClearSky: weather.uvIndexClearSky,
          weatherCode: weather.weatherCode,
          cloudCover: weather.cloudCover,
          pressure: weather.pressure,
          visibility: weather.visibility,
          solarRadiation: weather.solarRadiation,
          sunrise: weather.sunrise,
          sunset: weather.sunset,
          symbol: weather.symbol ?? 'N/A',
          forecastDate: weather.forecastDate,
          latitude: weather.latitude,
          longitude: weather.longitude,
          timezone: weather.timezone,
          capturedAt: weather.capturedAt || new Date().toISOString()
        } : null;

        const inspectionPayload = {
          id: inspectionId,
          areaId: selectedArea!.id,
          areaName: selectedArea!.name,
          operatorId: user.uid,
          operatorName: user.name || user.email,
          plantId: selectedArea!.plantId || user.plantId || 'default-plant',
          timestamp: isOnline ? serverTimestamp() : new Date(),
          startedAt: inspectionStartTime ? Timestamp.fromDate(inspectionStartTime) : (isOnline ? serverTimestamp() : new Date()),
          completedAt: Timestamp.fromDate(inspectionCompletedTime),
          durationSeconds: totalDurationSeconds,
          status: isPartial ? (hasFindings ? 'Parcial con Hallazgos' : 'Parcial Completada') : (hasFindings ? 'With Findings' : 'Completed'),
          isPartial: isPartial,
          inspectedEquipmentCount: Object.keys(updatedResults).length,
          totalAreaEquipmentCount: areaEquipment.length,
          results: updatedResults,
          clima: climaPayload
        };

        if (isOnline) {
          try {
            await withTimeout(setDoc(doc(db, 'inspections', inspectionId), inspectionPayload), 5000, 'Inspection setDoc timeout');
          } catch (err) {
            console.warn('[Inspections] Direct save failed or timed out, queuing offline:', err);
            await offlineQueueService.enqueue('inspections', inspectionId, inspectionPayload, 'create');
          }
        } else {
          await offlineQueueService.enqueue('inspections', inspectionId, inspectionPayload, 'create');
        }

        // Register findings in the 'findings' collection for each equipment that has issues or is compliant
        for (const [equipId, resAny] of Object.entries(updatedResults)) {
          const res = resAny as { trad: any, voso: any, operatingStatus?: string, timing?: { startedAt: any, completedAt: any, durationSeconds?: number } };
          const equip = areaEquipment.find(e => e.id === equipId)
            || equipment.find(e => e.id === equipId)
            || getCachedEquipment().find(e => e.id === equipId)
            || (currentEquipment?.id === equipId ? currentEquipment : null)
            || (areaEquipment.length === 1 ? areaEquipment[0] : null);
          
          const equipStarted = res?.timing?.startedAt instanceof Date ? res.timing.startedAt : (res?.timing?.startedAt?.toDate ? res.timing.startedAt.toDate() : null);
          const equipCompleted = res?.timing?.completedAt instanceof Date ? res.timing.completedAt : (res?.timing?.completedAt?.toDate ? res.timing.completedAt.toDate() : null);
          const timingSecs = res?.timing?.durationSeconds;
          let equipDuration = (timingSecs && timingSecs > 0)
            ? timingSecs
            : ((equipStarted && equipCompleted) ? Math.round((equipCompleted.getTime() - equipStarted.getTime()) / 1000) : (equipmentTimerSeconds > 0 ? equipmentTimerSeconds : totalDurationSeconds));
          if (equipDuration <= 0) {
            equipDuration = totalDurationSeconds > 0 ? totalDurationSeconds : 90;
          }

          const resTrad = res?.trad || {};
          const resVoso = res?.voso || {};

          const tradIssues = Object.entries(resTrad).filter(([_, s]) => s !== 'Bueno');
          const vosoIssues = (Object.entries(resVoso) as [string, VOSOResponse][]).filter(([_, v]) => v && (v.status === 'Observación' || v.status === 'Crítico'));

          const ordenList = equip?.inspeccionVOSO?.orden || [];
          const pureVosoIssues = vosoIssues.filter(([id]) => !ordenList.some(o => o.id === id));
          const pureOrdenIssues = vosoIssues.filter(([id]) => ordenList.some(o => o.id === id));

          const currentPlantId = user.plantId || selectedArea?.plantId || 'default-plant';
          const opStatusLabel = res?.operatingStatus === 'Detenido' ? 'Detenido' : 'En Funcionamiento';
          const resolvedEquipName = equip 
            ? (equip.tag && equip.tag.trim() ? `${equip.name} (${equip.tag.trim()})` : equip.name) 
            : (currentEquipment?.name || (selectedArea ? selectedArea.name : 'Equipo'));
          const resolvedTag = equip?.tag?.trim() || undefined;

          // 1. Create VOSO Finding if pure VOSO or traditional issues exist
          if (pureVosoIssues.length > 0 || tradIssues.length > 0) {
            try {
              let description = `Inspección VOSO en ${equip?.name || resolvedEquipName}. Condición operativa: ${opStatusLabel}.\n\n`;
              
              if (pureVosoIssues.length > 0) {
                description += "HALLAZGOS VOSO:\n";
                pureVosoIssues.forEach(([id, v]) => {
                  const ver = equip?.inspeccionVOSO?.ver || [];
                  const oir = equip?.inspeccionVOSO?.oir || [];
                  const sentir = equip?.inspeccionVOSO?.sentir || [];
                  const oler = equip?.inspeccionVOSO?.oler || [];

                  let categoryName = "GENERAL";
                  if (ver.some(i => i.id === id)) { categoryName = "VER"; }
                  else if (oir.some(i => i.id === id)) { categoryName = "OÍR"; }
                  else if (sentir.some(i => i.id === id)) { categoryName = "SENTIR"; }
                  else if (oler.some(i => i.id === id)) { categoryName = "OLER"; }

                  const allVOSO = [...ver, ...oir, ...sentir, ...oler];
                  const item = allVOSO.find(i => i.id === id);
                  const itemName = item?.name || id;
                  const commentText = v.comment ? ` - ${v.comment}` : '';
                  const solvedText = v.solvedByOperator ? ' - Solucionado por operador' : '';
                  description += `• ${categoryName} - ${itemName}: ${v.status}${commentText}${solvedText}\n`;
                });
              }

              if (tradIssues.length > 0) {
                description += "\nOTRAS EVALUACIONES DE INSPECCIÓN:\n";
                tradIssues.forEach(([id, s]) => {
                  const item = equip?.checkItems?.find(i => id === id);
                  description += `• ${item?.name || id}: ${s}\n`;
                });
              }

              const priority = pureVosoIssues.some(v => v[1]?.status === 'Crítico') ? 'Alta' : 'Media';
              const allPhotos: string[] = [];
              pureVosoIssues.forEach(v => {
                const resp = v[1];
                if (Array.isArray(resp?.photoUrls) && resp.photoUrls.length > 0) {
                  resp.photoUrls.forEach((p: string) => {
                    if (p && typeof p === 'string' && p.trim() && !allPhotos.includes(p.trim())) {
                      allPhotos.push(p.trim());
                    }
                  });
                } else if (resp?.photoUrl && typeof resp.photoUrl === 'string' && resp.photoUrl.trim() && !allPhotos.includes(resp.photoUrl.trim())) {
                  allPhotos.push(resp.photoUrl.trim());
                }
              });
              const firstPhoto = allPhotos[0] || null;

              const vosoPayloadData = {
                inspectionId: inspectionId,
                areaId: selectedArea!.id,
                areaName: selectedArea!.name,
                plantId: currentPlantId,
                equipmentId: equipId,
                equipmentName: resolvedEquipName,
                equipmentTag: resolvedTag,
                tag: resolvedTag,
                description: description,
                photoUrl: firstPhoto || undefined,
                photoUrls: allPhotos,
                status: (pureVosoIssues.every(v => v[1]?.solvedByOperator) && tradIssues.length === 0 ? 'Closed' : 'Open') as any,
                priority,
                date: new Date(),
                inspectionStartedAt: inspectionStartTime ? Timestamp.fromDate(inspectionStartTime) : Timestamp.now(),
                inspectionCompletedAt: Timestamp.fromDate(inspectionCompletedTime),
                inspectionDurationSeconds: totalDurationSeconds,
                equipmentStartedAt: equipStarted ? Timestamp.fromDate(equipStarted) : null,
                equipmentCompletedAt: equipCompleted ? Timestamp.fromDate(equipCompleted) : null,
                equipmentDurationSeconds: equipDuration,
                equipmentOperatingStatus: opStatusLabel,
                operatorId: user.uid,
                operatorName: user.name || user.email,
                operatorPhotoUrl: user.avatarUrl || (user as any).photoURL || undefined,
                source: 'VOSO',
                clima: climaPayload,
                history: [
                  {
                    status: (pureVosoIssues.every(v => v[1]?.solvedByOperator) && tradIssues.length === 0 ? 'Closed' : 'Open') as any,
                    userId: user.uid,
                    userName: user.name || user.email,
                    timestamp: new Date().toISOString(),
                    action: 'Hallazgo detectado (Inspección VOSO)',
                    comment: 'Hallazgo detectado durante la inspección de ruta.'
                  } as any
                ]
              };

              const resultObj = await FindingService.createFinding(vosoPayloadData, firstPhoto);

              // Set the complete finding object for PDF download / sharing
              const fullVosoFindingForPdf: Finding = {
                id: resultObj.id,
                ...vosoPayloadData,
                photoUrl: resultObj.photoUrl || firstPhoto || undefined,
                createdAt: new Date()
              } as Finding;
              setLastSavedFindingForPdf(fullVosoFindingForPdf);

              const notificationId = doc(collection(db, 'notifications')).id;
              const notificationPayload = {
                id: notificationId,
                title: 'Nuevo Hallazgo VOSO',
                message: `${user.name || user.email} ha reportado hallazgos VOSO en ${equip?.name || equipId}`,
                type: 'Finding',
                targetRole: 'Supervisor',
                scheduledAt: isOnline ? serverTimestamp() : new Date(),
                status: 'Sent',
                createdBy: user.uid,
                createdAt: isOnline ? serverTimestamp() : new Date(),
                referenceId: resultObj.id,
                plantId: currentPlantId
              };

              if (isOnline) {
                try {
                  await withTimeout(setDoc(doc(db, 'notifications', notificationId), notificationPayload), 3000, 'Notification setDoc timeout');
                } catch (err) {
                  console.warn('Notification setDoc error:', err);
                }
              }
            } catch (vosoErr) {
              console.warn('[Inspections] Failed creating VOSO finding for equip:', equipId, vosoErr);
            }
          }

          // 2. Create Orden y Limpieza Finding if Orden issues exist
          if (pureOrdenIssues.length > 0) {
            try {
              let ordenDesc = `[ORDEN] Programa 5S / Aseo en ${equip?.name || resolvedEquipName}.\n\n`;
              pureOrdenIssues.forEach(([id, v]) => {
                const item = ordenList.find(i => i.id === id);
                const itemName = item?.name || id;
                const commentText = v.comment ? ` - ${v.comment}` : '';
                const solvedText = v.solvedByOperator ? ' - Solucionado por operador' : '';
                ordenDesc += `• [ORDEN] ${itemName}: ${v.status}${commentText}${solvedText}\n`;
              });

              const ordenPhotos: string[] = [];
              pureOrdenIssues.forEach(v => {
                const resp = v[1];
                if (Array.isArray(resp?.photoUrls) && resp.photoUrls.length > 0) {
                  resp.photoUrls.forEach((p: string) => {
                    if (p && typeof p === 'string' && p.trim() && !ordenPhotos.includes(p.trim())) {
                      ordenPhotos.push(p.trim());
                    }
                  });
                } else if (resp?.photoUrl && typeof resp.photoUrl === 'string' && resp.photoUrl.trim() && !ordenPhotos.includes(resp.photoUrl.trim())) {
                  ordenPhotos.push(resp.photoUrl.trim());
                }
              });
              const firstOrdenPhoto = ordenPhotos[0] || null;

              const ordenPayloadData = {
                inspectionId: inspectionId,
                areaId: selectedArea!.id,
                areaName: selectedArea!.name,
                plantId: currentPlantId,
                equipmentId: equipId,
                equipmentName: resolvedEquipName,
                equipmentTag: resolvedTag,
                tag: resolvedTag,
                description: ordenDesc,
                photoUrl: firstOrdenPhoto || undefined,
                photoUrls: ordenPhotos,
                status: (pureOrdenIssues.every(v => v[1]?.solvedByOperator) ? 'Closed' : 'Open') as any,
                priority: 'Media',
                date: new Date(),
                inspectionStartedAt: inspectionStartTime ? Timestamp.fromDate(inspectionStartTime) : Timestamp.now(),
                inspectionCompletedAt: Timestamp.fromDate(inspectionCompletedTime),
                inspectionDurationSeconds: totalDurationSeconds,
                equipmentStartedAt: equipStarted ? Timestamp.fromDate(equipStarted) : null,
                equipmentCompletedAt: equipCompleted ? Timestamp.fromDate(equipCompleted) : null,
                equipmentDurationSeconds: equipDuration,
                equipmentOperatingStatus: opStatusLabel,
                operatorId: user.uid,
                operatorName: user.name || user.email,
                operatorPhotoUrl: user.avatarUrl || (user as any).photoURL || undefined,
                source: 'OrdenYLimpieza',
                clima: climaPayload,
                history: [
                  {
                    status: (pureOrdenIssues.every(v => v[1]?.solvedByOperator) ? 'Closed' : 'Open') as any,
                    userId: user.uid,
                    userName: user.name || user.email,
                    timestamp: new Date().toISOString(),
                    action: 'Hallazgo detectado (Orden & Limpieza)',
                    comment: 'Desviación de 5S detectada durante la inspección.'
                  } as any
                ]
              };

              const ordenResultObj = await FindingService.createFinding(ordenPayloadData, firstOrdenPhoto);

              if (pureVosoIssues.length === 0 && tradIssues.length === 0) {
                const fullOrdenFindingForPdf: Finding = {
                  id: ordenResultObj.id,
                  ...ordenPayloadData,
                  photoUrl: ordenResultObj.photoUrl || firstOrdenPhoto || undefined,
                  createdAt: new Date()
                } as Finding;
                setLastSavedFindingForPdf(fullOrdenFindingForPdf);
              }
            } catch (ordenErr) {
              console.warn('[Inspections] Failed creating Orden finding for equip:', equipId, ordenErr);
            }
          }

          // 3. If entirely compliant (no deviations detected), prepare a complete compliant inspection finding for PDF report
          if (pureVosoIssues.length === 0 && tradIssues.length === 0 && pureOrdenIssues.length === 0) {
            const compliantFindingForPdf: Finding = {
              id: inspectionId,
              areaId: selectedArea!.id,
              areaName: selectedArea!.name,
              plantId: currentPlantId,
              equipmentId: equipId,
              equipmentName: resolvedEquipName,
              equipmentTag: resolvedTag,
              tag: resolvedTag,
              description: `Inspección VOSO en ${equip?.name || resolvedEquipName}. Condición operativa: ${opStatusLabel}.\n\n• Todos los ítems evaluados conformes (Sin observaciones detectadas).`,
              status: 'Closed',
              priority: 'Baja',
              date: new Date(),
              inspectionStartedAt: inspectionStartTime ? Timestamp.fromDate(inspectionStartTime) : Timestamp.now(),
              inspectionCompletedAt: Timestamp.fromDate(inspectionCompletedTime),
              inspectionDurationSeconds: totalDurationSeconds,
              equipmentStartedAt: equipStarted ? Timestamp.fromDate(equipStarted) : null,
              equipmentCompletedAt: equipCompleted ? Timestamp.fromDate(equipCompleted) : null,
              equipmentDurationSeconds: equipDuration,
              equipmentOperatingStatus: opStatusLabel,
              operatorId: user.uid,
              operatorName: user.name || user.email,
              operatorPhotoUrl: user.avatarUrl || (user as any).photoURL || undefined,
              source: 'VOSO',
              clima: climaPayload,
              createdAt: new Date()
            } as Finding;

            setLastSavedFindingForPdf(compliantFindingForPdf);
          }
        }

        resetInspectionState();

        setSuccessModalConfig({
          title: isPartial ? "¡Inspección Parcial Guardada!" : "¡Inspección Finalizada con Éxito!",
          message: isPartial 
            ? `Se registraron y guardaron correctamente los hallazgos de los ${Object.keys(updatedResults).length} equipo(s) inspeccionados en ${selectedArea?.name || 'el área'}. Quedan los demás equipos libres para que otro operador continúe.` 
            : "El hallazgo o la inspección fue finalizada con éxito. Se guardaron todos los cambios y se notificará al supervisor."
        });
        setShowSuccessModal(true);
      } catch (err) {
        console.error("Error finalizing inspection:", err);
        setMessage({ text: "Error al registrar la inspección", type: 'error' });
      } finally {
        setIsSaving(false);
      }
    }
  };

  const handleSubmitFinding = async (forceDuplicate = false) => {
    if (!selectedArea) return;

    if (!findingDescription || !findingDescription.trim()) {
      setFormValidationError("La descripción del hallazgo no puede estar vacía.");
      setMessage({ text: "La descripción no puede estar vacía.", type: 'error' });
      return;
    }

    if (findingPhotos.length === 0) {
      setFormValidationError("Es obligatorio adjuntar al menos una foto evidencia del hallazgo.");
      setMessage({ text: "Es obligatorio adjuntar una foto para el hallazgo.", type: 'error' });
      return;
    }

    if (isClosingImmediately && (!immediateSolution || !immediateSolution.trim())) {
      setFormValidationError("Si marcas 'Solucionar ahora mismo', debes detallar la solución aplicada.");
      setMessage({ text: "Debes detallar la solución aplicada.", type: 'error' });
      return;
    }

    setFormValidationError(null);

    if (!forceDuplicate) {
      const existing = allActiveFindings.find(f => 
        f.areaId === selectedArea.id && 
        f.equipmentId === (currentEquipment?.id || null)
      );
      if (existing) {
        setDuplicateFinding(existing);
        return;
      }
    }

    setIsSaving(true);
    const isOrden = findingCategory === 'OrdenYLimpieza';
    const finalDescription = isOrden 
      ? `[ORDEN] [${findingSubcat}] ${findingDescription.trim()}`
      : findingDescription.trim();

    const climaPayload = weather ? {
      temperature: weather.temperature,
      apparentTemperature: weather.apparentTemperature,
      humidity: weather.humidity,
      windSpeed: weather.windSpeed,
      windDirection: weather.windDirection ?? 'N/A',
      windGusts: weather.windGusts,
      precipitation: weather.precipitation,
      rain: weather.rain,
      uvIndex: weather.uvIndex ?? 'N/A',
      uvIndexClearSky: weather.uvIndexClearSky,
      weatherCode: weather.weatherCode,
      cloudCover: weather.cloudCover,
      pressure: weather.pressure,
      visibility: weather.visibility,
      solarRadiation: weather.solarRadiation,
      sunrise: weather.sunrise,
      sunset: weather.sunset,
      symbol: weather.symbol ?? 'N/A',
      forecastDate: weather.forecastDate,
      latitude: weather.latitude,
      longitude: weather.longitude,
      timezone: weather.timezone,
      capturedAt: weather.capturedAt || new Date().toISOString()
    } : null;

    const primaryPhoto = findingPhotos[0] || null;
    const findingData = {
      areaId: selectedArea.id,
      areaName: selectedArea.name,
      equipmentId: currentEquipment?.id || null,
      equipmentName: currentEquipment ? (currentEquipment.tag ? `${currentEquipment.name} (${currentEquipment.tag})` : currentEquipment.name) : null,
      equipmentTag: currentEquipment?.tag?.trim() || undefined,
      tag: currentEquipment?.tag?.trim() || undefined,
      equipmentDurationSeconds: equipmentTimerSeconds > 0 ? equipmentTimerSeconds : (inspectionTimerSeconds > 0 ? inspectionTimerSeconds : 60),
      equipmentOperatingStatus: (currentEquipment && equipmentOperatingStatus[currentEquipment.id]) || 'En Funcionamiento',
      plantId: selectedArea.plantId || user.plantId || 'default-plant',
      operatorId: user.uid,
      operatorName: user.name || user.email || 'Operador',
      operatorPhotoUrl: user.avatarUrl || (user as any).photoURL || undefined,
      description: finalDescription,
      photoUrl: primaryPhoto || undefined,
      photoUrls: findingPhotos,
      source: isOrden ? 'OrdenYLimpieza' : 'VOSO',
      category: isOrden ? 'OrdenYLimpieza' : 'VOSO',
      status: (isClosingImmediately ? 'Closed' : 'Open') as any,
      solution: isClosingImmediately ? immediateSolution : '',
      closedBy: isClosingImmediately ? user.uid : null,
      closedAt: isClosingImmediately ? new Date() : null,
      inspectionStartedAt: inspectionStartTime ? Timestamp.fromDate(inspectionStartTime) : Timestamp.now(),
      inspectionCompletedAt: Timestamp.now(),
      inspectionDurationSeconds: inspectionTimerSeconds > 0 ? inspectionTimerSeconds : 60,
      date: new Date(),
      clima: climaPayload,
      history: [
        {
          status: (isClosingImmediately ? 'Closed' : 'Open') as any,
          userId: user.uid,
          userName: user.name || user.email || 'Operador',
          timestamp: new Date().toISOString(),
          action: 'Creación de hallazgo',
          comment: isClosingImmediately ? `Cerrado inmediatamente: ${immediateSolution}` : 'Hallazgo reportado'
        } as any
      ]
    };

    try {
      const resultObj = await FindingService.createFinding(findingData, primaryPhoto);
      const fullFindingForPdf: Finding = {
        id: resultObj.id,
        ...findingData,
        photoUrl: resultObj.photoUrl || primaryPhoto || undefined,
        createdAt: new Date()
      } as Finding;
      setLastSavedFindingForPdf(fullFindingForPdf);
      const findingRef = { id: resultObj.id };
      
      // Auto-generate notification for supervisors and admins supporting offline queueing
      const notificationId = doc(collection(db, 'notifications')).id;
      const isOnline = offlineQueueService.getConnectivityStatus();
      const notificationPayload = {
        id: notificationId,
        title: 'Nuevo Hallazgo',
        message: `${user.name || user.email} ha reportado: ${findingDescription.substring(0, 40)}${findingDescription.length > 40 ? '...' : ''}`,
        type: 'Finding',
        targetRole: 'Supervisor',
        scheduledAt: isOnline ? serverTimestamp() : new Date(),
        status: 'Sent',
        createdBy: user.uid,
        createdAt: isOnline ? serverTimestamp() : new Date(),
        referenceId: findingRef.id,
        plantId: selectedArea.plantId || user.plantId || 'default-plant'
      };

      if (isOnline) {
        try {
          await setDoc(doc(db, 'notifications', notificationId), notificationPayload);
        } catch (err) {
          await offlineQueueService.enqueue('notifications', notificationId, notificationPayload, 'create');
        }
      } else {
        await offlineQueueService.enqueue('notifications', notificationId, notificationPayload, 'create');
      }

      setShowFindingForm(false);
      setFindingDescription('');
      setFindingPhotos([]);
      setImmediateSolution('');
      setIsClosingImmediately(false);
      setMessage({ text: "Hallazgo registrado exitosamente", type: 'success' });
      handleNextEquipment();
    } catch (error) {
      console.error("Error saving finding:", error);
      setMessage({ text: "Error al registrar hallazgo", type: 'error' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <AnimatePresence>
        {isSaving && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-zinc-950/40 backdrop-blur-md flex items-center justify-center z-[150]"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="bg-white dark:bg-zinc-900 p-8 rounded-[2.5rem] shadow-2xl flex flex-col items-center gap-4 max-w-xs text-center border border-zinc-100 dark:border-white/10"
            >
              <div className="w-12 h-12 border-4 border-zinc-200 dark:border-zinc-800 border-t-zinc-900 dark:border-t-white rounded-full animate-spin" />
              <div className="space-y-1">
                <p className="font-extrabold text-zinc-900 dark:text-white uppercase tracking-wider text-xs">Guardando Inspección</p>
                <p className="text-[10px] text-zinc-400 dark:text-zinc-500 font-bold uppercase tracking-wider">Reportando hallazgos al supervisor...</p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {message && (
          <motion.div 
            key="operator-feedback-msg"
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}
            className={`fixed top-4 left-1/2 -translate-x-1/2 z-[100] px-4 py-3 rounded-2xl shadow-xl dark:shadow-none border text-sm font-bold flex items-center gap-2 ${
              message.type === 'success' ? 'bg-brand-green/10 border-brand-green/20 text-brand-green' : 'bg-red-50 border-red-100 text-red-700'
            }`}
          >
            {message.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
            {message.text}
          </motion.div>
        )}
      </AnimatePresence>
      {/* Header Banner Card for Inspección Primaria - Modern, Adaptive Industrial Design */}
      <div className="relative overflow-hidden rounded-3xl sm:rounded-[2rem] border border-sky-500/25 bg-gradient-to-br from-[#0B1528] via-[#0F2347] to-[#0A1220] p-5 sm:p-6 lg:p-7 text-white shadow-xl shadow-sky-950/30">
        {/* Ambient Glows */}
        <div className="absolute -top-24 -right-24 w-80 h-80 bg-sky-500/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-20 -left-20 w-64 h-64 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
        
        {/* Subtle Industrial Grid Pattern */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-5 sm:gap-6 min-w-0">
          {/* Main Info */}
          <div className="space-y-3 min-w-0 flex-1">
            {/* Badges / Chips Row */}
            <div className="flex flex-wrap items-center gap-2">
              {selectedArea ? (
                <span className="px-3 py-1 bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 rounded-full text-[10px] sm:text-xs font-bold tracking-wide flex items-center gap-1.5 shadow-xs shrink-0 animate-pulse">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />
                  <span>En Ruta: {selectedArea.name}</span>
                </span>
              ) : (
                <span className="px-3 py-1 bg-sky-500/20 border border-sky-400/30 text-sky-200 rounded-full text-[10px] sm:text-xs font-bold tracking-wide flex items-center gap-1.5 shadow-xs shrink-0">
                  <ShieldCheck className="w-3.5 h-3.5 text-sky-300 shrink-0" />
                  <span>Módulo Inspección Primaria</span>
                </span>
              )}

              <span className="px-2.5 py-1 bg-white/10 border border-white/15 text-white/90 rounded-full text-[10px] font-semibold tracking-wide flex items-center gap-1">
                <MapPin className="w-3 h-3 text-sky-300 shrink-0" />
                <span>{plant?.name || user.plantId || 'Planta Operativa'}</span>
              </span>

              <span className="hidden sm:inline-flex px-2.5 py-1 bg-white/5 border border-white/10 text-sky-200/80 rounded-full text-[10px] font-medium tracking-wide items-center gap-1">
                <HardHat className="w-3 h-3 text-amber-400 shrink-0" />
                <span>{user.name?.split(' ')[0] || user.name || 'Operador'}</span>
              </span>
            </div>

            {/* Title & Description */}
            <div>
              <h2 className="text-xl sm:text-2xl lg:text-3xl font-black tracking-tight text-white leading-tight break-normal">
                Inspección Primaria de Planta
              </h2>
              <p className="text-xs sm:text-sm text-sky-100/80 font-normal max-w-xl leading-relaxed mt-1">
                Transformando inspecciones en decisiones operacionales con metodología VOSO y trazabilidad digital en terreno.
              </p>
            </div>

            {/* Active inspection progression notice if area is selected */}
            {selectedArea && areaEquipment.length > 0 && (
              <div className="pt-1 flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1.5 px-3 py-1 bg-white/10 rounded-xl border border-white/15 text-[11px] font-bold text-sky-200">
                  <Activity className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Progreso: Equipo {Math.min(currentEquipmentIndex + 1, areaEquipment.length)} de {areaEquipment.length}</span>
                </div>
                <button
                  type="button"
                  onClick={toggleFocusMode}
                  className="px-2.5 py-1 bg-sky-500/25 hover:bg-sky-500/40 border border-sky-400/35 rounded-xl text-[11px] font-bold text-white flex items-center gap-1.5 transition-all cursor-pointer active:scale-95 shadow-xs"
                  title="Expandir inspección a 100% de la pantalla (Modo Enfoque sin distracciones)"
                >
                  <Maximize2 className="w-3.5 h-3.5 text-sky-300 shrink-0" />
                  <span>Modo Enfoque 100%</span>
                </button>
              </div>
            )}
          </div>

          {/* Adaptable Telemetry / KPI Cards Container */}
          <div className="w-full lg:w-auto shrink-0 pt-3 lg:pt-0 border-t lg:border-t-0 border-white/10">
            <div className="grid grid-cols-3 gap-2 sm:gap-3">
              {/* Telemetry Tile 1: Áreas */}
              <div className="p-3 sm:p-3.5 rounded-2xl bg-white/10 dark:bg-black/30 backdrop-blur-md border border-white/15 text-center flex flex-col items-center justify-center min-w-[85px] sm:min-w-[105px] shadow-sm">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-sky-300/90 block mb-0.5">
                  Áreas
                </span>
                <span className="text-lg sm:text-2xl font-black text-white tabular-nums">
                  {areas.length}
                </span>
                <span className="text-[9px] text-zinc-300/80 font-medium">
                  disponibles
                </span>
              </div>

              {/* Telemetry Tile 2: Equipos */}
              <div className="p-3 sm:p-3.5 rounded-2xl bg-white/10 dark:bg-black/30 backdrop-blur-md border border-white/15 text-center flex flex-col items-center justify-center min-w-[85px] sm:min-w-[105px] shadow-sm">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-indigo-300/90 block mb-0.5">
                  Equipos
                </span>
                <span className="text-lg sm:text-2xl font-black text-white tabular-nums">
                  {equipment.length}
                </span>
                <span className="text-[9px] text-zinc-300/80 font-medium">
                  en planta
                </span>
              </div>

              {/* Telemetry Tile 3: Inspecciones Totales */}
              <div 
                className="p-3 sm:p-3.5 rounded-2xl bg-white/10 dark:bg-black/30 backdrop-blur-md border border-white/15 text-center flex flex-col items-center justify-center min-w-[85px] sm:min-w-[105px] shadow-sm"
                title={`${allInspections.length} inspecciones totales registradas`}
              >
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-300/90 block mb-0.5">
                  Inspecciones
                </span>
                <span className="text-lg sm:text-2xl font-black text-white tabular-nums">
                  {allInspections.length}
                </span>
                <span className="text-[9px] text-zinc-300/80 font-medium">
                  totales
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Standalone Actions & Status Bar - Centered 2x2 grid on mobile, 4 columns on desktop with coherent margin */}
      <div className="w-full max-w-xl sm:max-w-none mx-auto my-2 sm:my-3 p-2.5 sm:p-3 bg-white dark:bg-[#1C1C1E] border border-zinc-200/80 dark:border-white/10 rounded-2xl shadow-xs grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3 items-stretch justify-center">
        {/* Prominent Dedicated Scan QR Button */}
        {!selectedArea && !scanning ? (
          <button
            onClick={startScanner}
            className="w-full h-12 py-2.5 sm:py-3 flex items-center justify-center gap-2 px-3 sm:px-4 bg-[#0071E3] hover:bg-[#0077ED] text-white text-xs font-semibold rounded-xl shadow-xs hover:scale-[1.02] active:scale-95 transition-all cursor-pointer text-center"
            title="Escanear Código QR de Área o Equipo"
          >
            <ScanLine className="w-[18px] h-[18px] shrink-0" />
            <span className="truncate">Escanear QR</span>
          </button>
        ) : (
          <div className="w-full h-12 py-2.5 sm:py-3 flex items-center justify-center gap-2 px-3 sm:px-4 text-xs font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 rounded-xl border border-emerald-500/20 text-center truncate">
            <ShieldCheck className="w-4 h-4 shrink-0 text-emerald-500" />
            <span className="truncate">{selectedArea ? selectedArea.name : 'Escaneando...'}</span>
          </div>
        )}

        {/* Clima & EPP Button */}
        <button
          onClick={() => {
            setPendingAreaForInspection(selectedArea || areas[0] || null);
            setShowWeatherSafetyModal(true);
          }}
          className="w-full h-12 py-2.5 sm:py-3 flex items-center justify-center gap-2 px-3 sm:px-4 bg-amber-500/10 hover:bg-amber-500/15 border border-amber-500/25 text-amber-700 dark:text-amber-300 text-xs font-semibold rounded-xl hover:scale-[1.02] active:scale-95 transition-all cursor-pointer text-center"
          title="Ver Advertencias Climáticas y EPP Reglamentario"
        >
          <ShieldAlert className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400" />
          <span className="truncate">Clima & EPP</span>
        </button>

        {/* Ayuda Rápida Button */}
        <button
          onClick={() => setShowQuickHelp(true)}
          className="w-full h-12 py-2.5 sm:py-3 flex items-center justify-center gap-2 px-3 sm:px-4 bg-zinc-100 hover:bg-zinc-200/70 dark:bg-white/5 dark:hover:bg-white/10 border border-zinc-200/70 dark:border-white/10 text-zinc-700 dark:text-zinc-300 text-xs font-semibold rounded-xl hover:scale-[1.02] active:scale-95 transition-all cursor-pointer text-center"
          title="Guía y ayuda rápida"
        >
          <HelpCircle className="w-4 h-4 shrink-0 text-[#0071E3] dark:text-[#0A84FF]" />
          <span className="truncate">Ayuda Rápida</span>
        </button>

        {/* Operador Activo Chip */}
        <div className="w-full h-12 py-2.5 sm:py-3 flex items-center justify-center gap-2 px-3 sm:px-4 bg-zinc-100/80 dark:bg-white/5 border border-zinc-200/60 dark:border-white/10 rounded-xl text-center">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
          <div className="min-w-0 text-left">
            <p className="text-[9px] font-medium text-zinc-400 dark:text-zinc-500 leading-none">Operador</p>
            <p className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 truncate max-w-[110px] leading-tight">{user.name}</p>
          </div>
        </div>
      </div>

      {/* Plant Stats for Operator - Centered and optimized for mobile */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-3 text-center">
        <div className="bg-brand-blue text-white p-3.5 sm:p-4 rounded-2xl shadow-xs border border-sky-400/20 flex flex-col items-center justify-center text-center">
          <p className="text-[10px] font-bold text-sky-100 uppercase tracking-wider mb-1 text-center truncate w-full">Cierre Prom.</p>
          <div className="flex items-baseline justify-center gap-1">
            <p className="text-xl sm:text-2xl font-extrabold">{plantStats.avgResolutionHours}</p>
            <span className="text-[10px] font-bold text-sky-200">hrs</span>
          </div>
        </div>
        <div className="bg-white dark:bg-black text-zinc-900 dark:text-white p-3.5 sm:p-4 rounded-2xl border border-zinc-100 dark:border-white/10 flex flex-col items-center justify-center text-center shadow-xs">
          <p className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider mb-1 text-center truncate w-full">Área Prom.</p>
          <p className="text-xl sm:text-2xl font-extrabold text-zinc-900 dark:text-white text-center">
            {Math.floor(plantStats.avgInspectionSeconds / 60)}m {plantStats.avgInspectionSeconds % 60}s
          </p>
        </div>
        <div className="bg-white dark:bg-black text-zinc-900 dark:text-white p-3.5 sm:p-4 rounded-2xl border border-zinc-100 dark:border-white/10 flex flex-col items-center justify-center text-center shadow-xs">
          <p className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider mb-1 text-center truncate w-full">Equipo Prom.</p>
          <p className="text-xl sm:text-2xl font-extrabold text-sky-600 dark:text-sky-400 text-center">
            {(plantStats as any).avgEquipSeconds}s
          </p>
        </div>
        <div className="bg-white dark:bg-black p-3.5 sm:p-4 rounded-2xl shadow-xs border border-zinc-100 dark:border-white/10 flex flex-col items-center justify-center text-center">
          <p className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider mb-1 text-center truncate w-full">Pendientes</p>
          <p className="text-xl sm:text-2xl font-extrabold text-amber-600 dark:text-amber-400 text-center">{plantStats.totalOpen}</p>
        </div>
        <div className="bg-white dark:bg-black p-3.5 sm:p-4 rounded-2xl shadow-xs border border-zinc-100 dark:border-white/10 flex flex-col items-center justify-center text-center">
          <p className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider mb-1 text-center truncate w-full">En Revisión</p>
          <p className="text-xl sm:text-2xl font-extrabold text-orange-600 dark:text-orange-400 text-center">{plantStats.totalInReview}</p>
        </div>
        <div className="bg-white dark:bg-black p-3.5 sm:p-4 rounded-2xl shadow-xs border border-zinc-100 dark:border-white/10 flex flex-col items-center justify-center text-center">
          <p className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider mb-1 text-center truncate w-full">Total Cerrados</p>
          <p className="text-xl sm:text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 text-center">{plantStats.totalClosed}</p>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-zinc-900 dark:text-white tracking-tight uppercase">Nueva Inspección</h2>
        <div className="bg-zinc-100 px-3 py-1 rounded-full text-xs font-medium text-zinc-600">
          Operador: {user.name}
        </div>
      </div>

      {!selectedArea && (
        <div className="space-y-4">
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={startScanner}
            className="w-full max-w-md mx-auto py-5 px-4 bg-white dark:bg-black border-2 border-dashed border-zinc-200 dark:border-white/20 rounded-2xl flex flex-col items-center justify-center gap-2 hover:border-zinc-900 dark:hover:border-white transition-colors group cursor-pointer shadow-2xs"
          >
            <div className="w-12 h-12 bg-zinc-50 dark:bg-zinc-900 rounded-full flex items-center justify-center group-hover:bg-zinc-900 dark:group-hover:bg-white transition-colors">
              <QrCode className="w-6 h-6 text-zinc-400 dark:text-zinc-500 group-hover:text-white dark:group-hover:text-black" />
            </div>
            <span className="text-zinc-600 dark:text-zinc-300 font-bold group-hover:text-brand-blue dark:group-hover:text-white transition-colors text-center px-4 uppercase tracking-tight text-xs">Escanear Código QR de Área</span>
          </motion.button>
          
          <div className="max-w-3xl mx-auto space-y-3">
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest">
                Áreas y Estado de Equipos a Revisar
              </p>
              <span className="text-[10px] font-extrabold text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-500/10 px-2.5 py-0.5 rounded-full border border-sky-200/50 dark:border-sky-500/20">
                {areas.length} {areas.length === 1 ? 'Área' : 'Áreas'}
              </span>
            </div>

            <div className="space-y-3">
              {areas.length > 0 ? (
                areas.map((area, idx) => {
                  const areaEquip = equipment
                    .filter(e => e.areaId === area.id && (e as any).status !== 'deleted')
                    .sort((a, b) => (a.inspectionOrder || 0) - (b.inspectionOrder || 0));

                  const completedEquip = areaEquip.filter(e => getEquipInspectionStatus(area.id, e.id) === 'completed').length;
                  const totalEquip = areaEquip.length;
                  const isAllDone = totalEquip > 0 && completedEquip === totalEquip;
                  const isExpanded = !!expandedAreaIds[area.id];

                  return (
                    <div 
                      key={`area-accordion-${area.id}-${idx}`}
                      className="bg-white dark:bg-black border border-zinc-200/80 dark:border-white/10 rounded-2xl overflow-hidden shadow-xs transition-all duration-200 hover:border-sky-500/40"
                    >
                      {/* Accordion Trigger Header */}
                      <div className="p-3.5 sm:p-4 flex items-center justify-between gap-2.5 bg-zinc-50/50 dark:bg-zinc-900/40">
                        <button
                          type="button"
                          onClick={() => toggleAreaExpand(area.id)}
                          className="flex items-center gap-3 min-w-0 flex-1 text-left cursor-pointer group"
                        >
                          <div className={`p-2 rounded-xl shrink-0 transition-colors ${
                            isAllDone 
                              ? 'bg-emerald-500/10 text-emerald-500' 
                              : completedEquip > 0 
                                ? 'bg-amber-500/10 text-amber-500' 
                                : 'bg-sky-500/10 text-sky-500'
                          }`}>
                            <MapPin className="w-5 h-5" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <h3 className="font-bold text-zinc-900 dark:text-white text-xs sm:text-sm tracking-tight truncate group-hover:text-sky-600 dark:group-hover:text-sky-400 transition-colors">
                              {area.name}
                            </h3>
                            <div className="flex items-center gap-2 mt-0.5">
                              {totalEquip > 0 ? (
                                <span className={`inline-flex items-center gap-1 text-[10px] font-black uppercase px-2 py-0.5 rounded-md border ${
                                  isAllDone 
                                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' 
                                    : completedEquip > 0 
                                      ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20' 
                                      : 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20'
                                }`}>
                                  {isAllDone ? (
                                    <>
                                      <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                                      {completedEquip}/{totalEquip} Listos
                                    </>
                                  ) : (
                                    <>
                                      <XCircle className="w-3 h-3 text-red-500" />
                                      {completedEquip}/{totalEquip} Equipos
                                    </>
                                  )}
                                </span>
                              ) : (
                                <span className="text-[10px] font-bold text-zinc-400">Sin equipos</span>
                              )}
                            </div>
                          </div>
                          <div className="p-1.5 rounded-lg hover:bg-zinc-200/50 dark:hover:bg-zinc-800/50 text-zinc-400">
                            <ChevronDown className={`w-5 h-5 transition-transform duration-200 shrink-0 ${isExpanded ? 'rotate-180' : ''}`} />
                          </div>
                        </button>

                        <button
                          type="button"
                          onClick={() => startAreaInspection(area)}
                          className="px-3 py-2 bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs uppercase tracking-wider rounded-xl flex items-center gap-1 shrink-0 transition-all shadow-xs active:scale-95 cursor-pointer"
                        >
                          <span>Inspeccionar</span>
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>

                      {/* Collapsible Equipment List Body */}
                      {isExpanded && (
                        <div className="border-t border-zinc-100 dark:border-white/5 p-3 sm:p-4 bg-white dark:bg-zinc-950 space-y-2">
                          <p className="text-[10px] font-black uppercase tracking-wider text-zinc-400 dark:text-zinc-500 mb-2">
                            Equipos en este área ({totalEquip})
                          </p>
                          {totalEquip > 0 ? (
                            <div className="grid grid-cols-1 gap-2">
                              {areaEquip.map((equip) => {
                                const status = getEquipInspectionStatus(area.id, equip.id);
                                const isInspected = status === 'completed';

                                return (
                                  <div
                                    key={`equip-row-${equip.id}`}
                                    onClick={() => {
                                      const equipIdx = areaEquip.findIndex(e => e.id === equip.id);
                                      startAreaInspection(area, equipIdx >= 0 ? equipIdx : 0);
                                    }}
                                    className={`p-3 rounded-xl border flex items-center justify-between gap-3 transition-all cursor-pointer ${
                                      isInspected 
                                        ? 'bg-emerald-500/5 dark:bg-emerald-500/10 border-emerald-500/30 hover:border-emerald-500/60' 
                                        : 'bg-red-500/5 dark:bg-red-500/10 border-red-500/30 hover:border-red-500/60'
                                    }`}
                                  >
                                    <div className="flex items-center gap-2.5 min-w-0">
                                      {isInspected ? (
                                        <div className="w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0 shadow-2xs">
                                          <Check className="w-4 h-4 stroke-[3]" />
                                        </div>
                                      ) : (
                                        <div className="w-6 h-6 rounded-full bg-red-500/20 text-red-500 border border-red-500/40 flex items-center justify-center shrink-0">
                                          <X className="w-3.5 h-3.5 stroke-[3]" />
                                        </div>
                                      )}
                                      <div className="min-w-0">
                                        <p className="font-extrabold text-xs sm:text-sm text-zinc-900 dark:text-white truncate">
                                          {equip.name}
                                        </p>
                                        <div className="flex items-center gap-1.5 mt-0.5 text-[10px] font-bold text-zinc-400 dark:text-zinc-500">
                                          <span className="font-mono bg-zinc-100 dark:bg-zinc-800/80 px-1.5 py-0.2 rounded text-zinc-600 dark:text-zinc-300 font-bold uppercase tracking-wider">
                                            {equip.code || `EQ-${equip.id.substring(0, 6).toUpperCase()}`}
                                          </span>
                                          {equip.description && (
                                            <>
                                              <span className="text-zinc-300 dark:text-zinc-700">•</span>
                                              <span className="truncate max-w-[180px] sm:max-w-[280px] text-zinc-500 dark:text-zinc-400 font-medium">
                                                {equip.description}
                                              </span>
                                            </>
                                          )}
                                        </div>
                                      </div>
                                    </div>

                                    <div className="shrink-0">
                                      {isInspected ? (
                                        <span className="px-2.5 py-1 rounded-full bg-emerald-500 text-white text-[10px] font-black uppercase tracking-wider flex items-center gap-1 shadow-2xs">
                                          <CheckCircle2 className="w-3 h-3" />
                                          Listo
                                        </span>
                                      ) : (
                                        <span className="px-2.5 py-1 rounded-full bg-red-500/15 border border-red-500/30 text-red-600 dark:text-red-400 text-[10px] font-black uppercase tracking-wider flex items-center gap-1">
                                          <XCircle className="w-3 h-3 text-red-500" />
                                          Pendiente
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <p className="text-xs text-zinc-400 dark:text-zinc-600 italic py-2 text-center">
                              No hay equipos configurados en esta área.
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              ) : (
                <p className="text-center text-sm text-zinc-400 py-6 bg-zinc-50 dark:bg-black rounded-2xl border border-dashed border-zinc-200 dark:border-white/10 italic">
                  Cargando áreas de inspección...
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      <AnimatePresence>
        {searchingArea && (
          <motion.div 
            key="operator-area-search-modal"
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
          >
            <motion.div 
              key="operator-area-search-overlay"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setSearchingArea(false)}
              className="absolute inset-0 bg-zinc-900/60 backdrop-blur-sm"
            />
            <motion.div 
              key="operator-area-search-content"
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative w-full max-w-md bg-white dark:bg-black border border-transparent dark:border-white/10 rounded-[2.5rem] shadow-2xl dark:shadow-none flex flex-col max-h-[80vh] overflow-hidden"
            >
              <div className="p-6 border-b border-zinc-50 dark:border-white/5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl font-bold text-zinc-900 dark:text-white uppercase tracking-tight">Seleccionar Área</h3>
                  <button onClick={() => setSearchingArea(false)} className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-900 rounded-full transition-colors text-zinc-400 dark:text-zinc-600">
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 dark:text-zinc-600" />
                  <input 
                    autoFocus
                    value={areaSearchQuery}
                    onChange={(e) => setAreaSearchQuery(e.target.value)}
                    placeholder="Buscar por nombre o QR..."
                    className="w-full pl-11 pr-4 py-3 bg-zinc-50 dark:bg-zinc-900 border border-zinc-100 dark:border-white/5 rounded-2xl outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-white transition-all font-bold dark:text-white uppercase tracking-tight text-xs"
                  />
                </div>
              </div>
              
              <div className="flex-1 overflow-y-auto p-4 custom-scrollbar dark:bg-zinc-950/20">
                <div className="grid gap-2">
                  {areas
                    .filter(a => 
                      (a.name || '').toLowerCase().includes((areaSearchQuery || '').toLowerCase()) || 
                      (a.id || '').toLowerCase().includes((areaSearchQuery || '').toLowerCase()) ||
                      ((a as any).qrCode || '').toLowerCase().includes((areaSearchQuery || '').toLowerCase())
                    )
                    .map((area, idx) => (
                      <button 
                        key={`search-area-${area.id}-${idx}`}
                        onClick={() => {
                          startAreaInspection(area);
                          setSearchingArea(false);
                          setAreaSearchQuery('');
                        }}
                        className="w-full p-4 hover:bg-zinc-50 dark:hover:bg-white/5 rounded-2xl border border-transparent hover:border-zinc-100 dark:hover:border-white/10 transition-all text-left flex items-center justify-between group"
                      >
                        <div>
                          <p className="font-bold text-zinc-900 dark:text-white uppercase tracking-tight">{area.name}</p>
                          <p className="text-[10px] font-black text-zinc-400 dark:text-zinc-700 uppercase tracking-widest mt-0.5">ID: {area.id}</p>
                        </div>
                        <Plus className="w-4 h-4 text-zinc-300 dark:text-zinc-800 group-hover:text-zinc-900 dark:group-hover:text-white transition-colors" />
                      </button>
                    ))}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {scanning && (
          <motion.div 
            key="qr-scanner-modal"
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6"
          >
            {/* Backdrop (Dark blur) */}
            <motion.div 
              key="qr-scanner-overlay"
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }}
              onClick={stopScanner}
              className="absolute inset-0 bg-black/85 ios-glass"
            />

            {/* iOS Native Camera Style Box */}
            <motion.div 
              key="qr-scanner-content"
              initial={{ scale: 0.95, opacity: 0, y: 16 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 16 }}
              transition={{ type: "spring", stiffness: 350, damping: 28 }}
              className="relative w-full max-w-sm sm:max-w-md bg-[#1C1C1E] border border-white/10 rounded-[28px] shadow-2xl overflow-hidden z-10 flex flex-col"
            >
              {/* Top Controls Bar */}
              <div className="p-4 sm:p-5 flex items-center justify-between bg-black/40 border-b border-white/5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-[#0071E3]/15 text-[#0A84FF] flex items-center justify-center shrink-0">
                    <QrCode className="w-5 h-5 stroke-[2.2]" />
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-base tracking-tight">Escanear Código QR</h3>
                    <p className="text-[11px] text-[#98989D] font-medium">Apunta al código del área o equipo</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <FlashlightWidget variant="compact" />
                  <button 
                    onClick={stopScanner}
                    className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 active:scale-95 text-white flex items-center justify-center transition-all cursor-pointer"
                    title="Cerrar escáner"
                  >
                    <X className="w-4 h-4 stroke-[2.5]" />
                  </button>
                </div>
              </div>

              {/* Reader Camera Viewfinder */}
              <div className="p-6 flex flex-col items-center justify-center bg-black relative min-h-[320px]">
                <div id="reader" className="w-full max-w-[280px] sm:max-w-[320px] overflow-hidden rounded-[24px] border border-white/20 shadow-2xl relative"></div>
              </div>

              {/* Bottom Status Bar */}
              <div className="p-4 bg-black/50 border-t border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[#34C759] animate-pulse" />
                  <span className="text-xs font-medium text-[#98989D]">Buscando código QR...</span>
                </div>
                <button
                  onClick={stopScanner}
                  className="px-4 py-2 bg-white/10 hover:bg-white/15 active:scale-95 text-[#F5F5F7] font-semibold text-xs rounded-xl transition-all cursor-pointer"
                >
                  Cancelar
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {selectedArea && !showFindingForm && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className={
            isFocusInspectionMode
              ? "fixed inset-0 z-50 overflow-y-auto bg-slate-100/95 dark:bg-zinc-950/95 backdrop-blur-md p-3 sm:p-6 md:p-8 space-y-6"
              : "bg-white dark:bg-black rounded-3xl p-4 sm:p-6 border border-zinc-100 dark:border-white/10 shadow-sm dark:shadow-none space-y-6"
          }
        >
          {/* Top Focus Bar when 100% Focus Mode is active */}
          {isFocusInspectionMode && (
            <div className="sticky top-0 z-40 -mt-1 sm:-mt-2 mb-4 bg-zinc-900/95 dark:bg-black/95 backdrop-blur-xl border border-white/15 text-white px-4 sm:px-6 py-3 rounded-2xl sm:rounded-3xl shadow-2xl flex flex-wrap items-center justify-between gap-3 max-w-5xl mx-auto w-full">
              <div className="flex items-center gap-2.5 sm:gap-3">
                <span className="flex items-center gap-1.5 px-3 py-1 bg-sky-500/20 border border-sky-400/40 text-sky-300 rounded-full text-[10px] sm:text-xs font-black uppercase tracking-wider shadow-xs">
                  <span className="w-2 h-2 rounded-full bg-sky-400 animate-ping shrink-0" />
                  Modo Enfoque 100%
                </span>
                <div className="hidden sm:flex items-center gap-2 text-xs text-zinc-300 font-bold">
                  <span className="text-white">{selectedArea.name}</span>
                  {currentEquipment && (
                    <>
                      <span className="text-zinc-500">•</span>
                      <span className="text-sky-300">{currentEquipment.name}</span>
                      {areaEquipment.length > 0 && (
                        <span className="px-2 py-0.5 rounded-lg bg-white/10 text-[10px] font-mono text-zinc-300">
                          {currentEquipmentIndex + 1}/{areaEquipment.length}
                        </span>
                      )}
                    </>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <div className="px-3 py-1.5 bg-white/10 rounded-xl border border-white/15 text-xs font-mono font-black text-emerald-400 flex items-center gap-1.5">
                  <Timer className="w-3.5 h-3.5 animate-pulse" />
                  <span>{formatTimer(inspectionTimerSeconds)}</span>
                </div>

                <FlashlightWidget variant="compact" />

                <button
                  type="button"
                  onClick={toggleFocusMode}
                  className="px-3.5 py-1.5 bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 active:scale-95 text-white text-xs font-black uppercase tracking-wider rounded-xl shadow-md shadow-sky-500/20 border border-sky-400/30 flex items-center gap-1.5 transition-all cursor-pointer"
                  title="Restaurar vista normal (Esc)"
                >
                  <Minimize2 className="w-3.5 h-3.5 text-white shrink-0" />
                  <span className="hidden sm:inline">Restaurar Vista (Esc)</span>
                  <span className="sm:hidden">Salir</span>
                </button>
              </div>
            </div>
          )}

          <div className={isFocusInspectionMode ? "max-w-5xl mx-auto w-full space-y-6 pb-24" : "space-y-6"}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-zinc-50 dark:border-white/5 pb-4 gap-3">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-gradient-to-br from-brand-blue to-brand-green rounded-2xl flex items-center justify-center shadow-md dark:shadow-none flex-shrink-0">
                  <MapPin className="text-white w-6 h-6" />
                </div>
                <div>
                  <p className="text-xs font-medium text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">Área Seleccionada</p>
                  <h3 className="text-xl font-bold text-zinc-900 dark:text-white">{selectedArea.name}</h3>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                {/* Inspection Live Timer Badge */}
                <div className={`px-3 py-1.5 rounded-2xl border flex items-center gap-2 transition-all ${
                  isInspectionPaused
                    ? 'bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400'
                    : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
                }`}>
                  <Timer className={`w-4 h-4 ${isInspectionPaused ? 'text-amber-500' : 'text-emerald-500 animate-pulse'}`} />
                  <div className="flex flex-col">
                    <span className="text-[9px] font-black uppercase tracking-widest text-zinc-400 leading-none">
                      {isInspectionPaused ? 'Pausado' : 'Tiempo Área'}
                    </span>
                    <span className="text-xs font-mono font-black leading-tight">
                      {formatTimer(inspectionTimerSeconds)}
                    </span>
                  </div>
                </div>

                {/* Pause / Resume Button */}
                <button
                  type="button"
                  onClick={() => {
                    saveCurrentToResults();
                    if (!isInspectionPaused) {
                      setIsInspectionPaused(true);
                      setIsPauseModalOpen(true);
                    } else {
                      setIsInspectionPaused(false);
                      setIsPauseModalOpen(false);
                    }
                  }}
                  className={`px-3.5 py-2 rounded-2xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 transition-all shadow-xs active:scale-95 cursor-pointer ${
                    isInspectionPaused
                      ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/20'
                      : 'bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 text-amber-700 dark:text-amber-300'
                  }`}
                >
                  {isInspectionPaused ? (
                    <>
                      <Play className="w-4 h-4 fill-current text-white" />
                      <span>Reanudar</span>
                    </>
                  ) : (
                    <>
                      <Pause className="w-4 h-4 fill-current" />
                      <span>Pausar</span>
                    </>
                  )}
                </button>

                {/* Focus Mode 100% Toggle Button */}
                <button
                  type="button"
                  onClick={toggleFocusMode}
                  className={`px-3 py-2 rounded-2xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 transition-all shadow-xs active:scale-95 cursor-pointer ${
                    isFocusInspectionMode
                      ? 'bg-sky-600 text-white shadow-sky-600/20'
                      : 'bg-sky-500/10 hover:bg-sky-500/20 border border-sky-500/30 text-sky-700 dark:text-sky-300'
                  }`}
                  title={isFocusInspectionMode ? "Restaurar vista normal (Esc)" : "Expandir inspección al 100% de la pantalla (Modo Enfoque sin distracciones)"}
                >
                  {isFocusInspectionMode ? (
                    <>
                      <Minimize2 className="w-4 h-4 text-white shrink-0" />
                      <span className="hidden sm:inline">Restaurar</span>
                      <span className="sm:hidden">Normal</span>
                    </>
                  ) : (
                    <>
                      <Maximize2 className="w-4 h-4 text-sky-500 shrink-0" />
                      <span className="hidden sm:inline">Enfoque 100%</span>
                      <span className="sm:hidden">100%</span>
                    </>
                  )}
                </button>

                <FlashlightWidget variant="compact" />

                <button onClick={() => { setIsFocusInspectionMode(false); setSelectedArea(null); }} className="p-2 bg-zinc-50 dark:bg-zinc-900 text-zinc-400 dark:text-zinc-500 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer" title="Cerrar Área">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

          <div className="space-y-8">
            <AnimatePresence mode="wait" custom={slideDirection}>
              <motion.div
                key={currentEquipment?.id || 'general'}
                variants={{
                  initial: (dir: 'next' | 'prev') => ({
                    opacity: 0,
                    x: dir === 'next' ? 120 : -120
                  }),
                  animate: { opacity: 1, x: 0 },
                  exit: (dir: 'next' | 'prev') => ({
                    opacity: 0,
                    x: dir === 'next' ? -120 : 120
                  })
                }}
                initial="initial"
                animate="animate"
                exit="exit"
                transition={{ type: "spring", stiffness: 280, damping: 28 }}
                className="space-y-8"
              >
                <div className="flex items-center justify-between px-2">
              <h4 className="text-lg font-black text-zinc-900 dark:text-white uppercase tracking-tighter flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-zinc-900 dark:bg-white flex items-center justify-center text-white dark:text-black text-[10px] font-black">
                   {currentEquipmentIndex + 1}
                </div>
                {areaEquipment.length > 0 ? 'Equipo en Revisión' : 'Inspección de Área'}
              </h4>
              {areaEquipment.length > 0 && (
                <div className="flex items-center gap-2 bg-zinc-100 dark:bg-zinc-900 px-4 py-2 rounded-2xl border border-zinc-200/50 dark:border-white/5">
                  <span className="text-[10px] font-black text-zinc-900 dark:text-white uppercase tracking-[0.2em]">
                    {currentEquipmentIndex + 1} / {areaEquipment.length}
                  </span>
                </div>
              )}
            </div>
            
            <div className="p-5 sm:p-7 bg-zinc-900 dark:bg-zinc-950/40 border border-transparent dark:border-white/10 rounded-2xl sm:rounded-3xl text-white shadow-xl dark:shadow-none relative overflow-hidden group">
               <div className="absolute top-0 right-0 w-80 h-80 bg-brand-blue/20 rounded-full -mr-32 -mt-32 blur-[100px] group-hover:bg-brand-green/20 transition-all duration-1000" />
               <div className="relative z-10">
                 <div className="flex items-center gap-4 mb-3 sm:mb-5">
                    <div className="px-3 py-1 bg-white/10 backdrop-blur-md rounded-full border border-white/10 text-[9px] sm:text-[10px] font-black uppercase tracking-[0.25em] text-sky-400">
                      {areaEquipment.length > 0 ? 'Ruta de Inspección' : 'Área sin equipos'}
                    </div>
                 </div>

                 <h2 className="text-2xl sm:text-4xl font-black tracking-tighter mb-4 leading-tight text-white flex items-center gap-3 flex-wrap">
                    <span>{currentEquipment?.name || selectedArea.name}</span>
                    {currentEquipment?.tag && (
                      <span className="text-xs sm:text-sm font-bold tracking-wider bg-white/10 text-sky-300 border border-white/20 px-3 py-1 rounded-xl uppercase">
                        TAG: {currentEquipment.tag}
                      </span>
                    )}
                 </h2>
                 
                 <div className="flex flex-wrap gap-3">
                   {areaEquipment.length > 0 && (
                     <div className="flex items-center gap-2 px-4 py-2 bg-white/5 rounded-2xl border border-white/10 backdrop-blur-md">
                       <BarChart3 className="w-4 h-4 text-sky-400" />
                       <span className="text-xs font-black uppercase tracking-widest text-zinc-300">Orden: {currentEquipmentIndex + 1}</span>
                     </div>
                   )}
                   <div className="flex items-center gap-2 px-4 py-2 bg-emerald-500/10 text-emerald-400 rounded-2xl border border-emerald-500/20 backdrop-blur-md">
                     <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                     <span className="text-xs font-black uppercase tracking-widest">
                       {areaEquipment.length > 0 ? 'Estado: Activo' : 'Inspección General'}
                     </span>
                   </div>
                   <div className="flex items-center gap-2 px-4 py-2 bg-white/5 rounded-2xl border border-white/10 backdrop-blur-md">
                     <Clock className="w-4 h-4 text-amber-400" />
                     <span className="text-xs font-mono font-black uppercase tracking-widest text-zinc-300">
                       Equipo: {formatTimer(equipmentTimerSeconds)}
                     </span>
                   </div>
                 </div>
               </div>
            </div>

            {areaEquipment.length > 0 && (
              <div className="space-y-3 bg-zinc-50/50 dark:bg-black/20 p-4 sm:p-5 rounded-2xl border border-zinc-100 dark:border-white/5 shadow-2xs dark:shadow-none">
                 <div className="flex items-center justify-between text-zinc-900 dark:text-white px-1">
                   <div className="flex items-center gap-2">
                     <span className="text-xs font-black uppercase tracking-[0.2em]">Progreso</span>
                     <span className="text-xs font-black text-brand-blue">{Math.round(((currentEquipmentIndex) / areaEquipment.length) * 100)}%</span>
                   </div>
                   <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-600 uppercase tracking-widest">{areaEquipment.length - currentEquipmentIndex} equipos restantes</span>
                 </div>
                 <div className="flex gap-2 h-3 px-1">
                   {areaEquipment.map((e, idx) => (
                     <div 
                       key={`prog-bar-${e.id}-${idx}`} 
                       className={`flex-1 rounded-full border transition-all duration-700 ${
                         idx === currentEquipmentIndex ? 'bg-brand-blue border-brand-blue shadow-lg shadow-sky-100 dark:shadow-none scale-y-125' : 
                         idx < currentEquipmentIndex ? 'bg-brand-green border-brand-green opacity-40' : 
                         'bg-white dark:bg-zinc-800 border-zinc-200 dark:border-white/10'
                       }`} 
                     />
                   ))}
                 </div>
              </div>
            )}

             {/* Item de Estado Operativo del Equipo (En Funcionamiento / Detenido) */}
             {areaEquipment.length > 0 && currentEquipment && (
               <div className="bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-white/10 p-4 sm:p-5 rounded-2xl sm:rounded-3xl shadow-xs space-y-3 my-2">
                 <div className="flex items-center justify-between gap-2">
                   <div className="flex items-center gap-2.5 min-w-0">
                     <div className="w-8 h-8 rounded-xl bg-sky-500/10 text-sky-500 flex items-center justify-center font-bold shrink-0">
                       <Activity className="w-4 h-4" />
                     </div>
                     <div className="min-w-0">
                       <h4 className="text-xs font-black uppercase tracking-wider text-zinc-900 dark:text-white truncate">
                         Condición Operativa del Equipo
                       </h4>
                       <p className="text-[11px] text-zinc-500 dark:text-zinc-400 font-medium truncate">
                         ¿El equipo fue inspeccionado en funcionamiento o detenido?
                       </p>
                     </div>
                   </div>
                   <span className={`text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full border shrink-0 ${
                     (equipmentOperatingStatus[currentEquipment.id] || 'En Funcionamiento') === 'En Funcionamiento'
                       ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                       : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30'
                   }`}>
                     {(equipmentOperatingStatus[currentEquipment.id] || 'En Funcionamiento') === 'En Funcionamiento' ? '⚡ Operando' : '🛑 Detenido'}
                   </span>
                 </div>

                 <div className="grid grid-cols-2 gap-3 pt-1">
                   <button
                     type="button"
                     onClick={() => {
                       setEquipmentOperatingStatus(prev => ({
                         ...prev,
                         [currentEquipment.id]: 'En Funcionamiento'
                       }));
                     }}
                     className={`p-3.5 rounded-2xl border flex items-center justify-between transition-all cursor-pointer ${
                       (equipmentOperatingStatus[currentEquipment.id] || 'En Funcionamiento') === 'En Funcionamiento'
                         ? 'bg-emerald-500/10 border-emerald-500 text-emerald-700 dark:text-emerald-300 ring-2 ring-emerald-500/30 shadow-xs'
                         : 'bg-zinc-50 dark:bg-zinc-800/50 border-zinc-200 dark:border-white/5 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                     }`}
                   >
                     <div className="flex items-center gap-2.5 min-w-0">
                       <div className={`p-2 rounded-xl shrink-0 ${
                         (equipmentOperatingStatus[currentEquipment.id] || 'En Funcionamiento') === 'En Funcionamiento'
                           ? 'bg-emerald-500 text-white'
                           : 'bg-zinc-200 dark:bg-zinc-700 text-zinc-500 dark:text-zinc-400'
                       }`}>
                         <Zap className="w-4 h-4 fill-current" />
                       </div>
                       <div className="text-left min-w-0">
                         <span className="text-xs font-extrabold block truncate">En Funcionamiento</span>
                         <span className="text-[10px] opacity-75 font-medium block truncate">Equipo operando</span>
                       </div>
                     </div>
                     {(equipmentOperatingStatus[currentEquipment.id] || 'En Funcionamiento') === 'En Funcionamiento' && (
                       <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 ml-1" />
                     )}
                   </button>

                   <button
                     type="button"
                     onClick={() => {
                       setEquipmentOperatingStatus(prev => ({
                         ...prev,
                         [currentEquipment.id]: 'Detenido'
                       }));
                     }}
                     className={`p-3.5 rounded-2xl border flex items-center justify-between transition-all cursor-pointer ${
                       equipmentOperatingStatus[currentEquipment.id] === 'Detenido'
                         ? 'bg-amber-500/10 border-amber-500 text-amber-700 dark:text-amber-300 ring-2 ring-amber-500/30 shadow-xs'
                         : 'bg-zinc-50 dark:bg-zinc-800/50 border-zinc-200 dark:border-white/5 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                     }`}
                   >
                     <div className="flex items-center gap-2.5 min-w-0">
                       <div className={`p-2 rounded-xl shrink-0 ${
                         equipmentOperatingStatus[currentEquipment.id] === 'Detenido'
                           ? 'bg-amber-500 text-white'
                           : 'bg-zinc-200 dark:bg-zinc-700 text-zinc-500 dark:text-zinc-400'
                       }`}>
                         <PowerOff className="w-4 h-4" />
                       </div>
                       <div className="text-left min-w-0">
                         <span className="text-xs font-extrabold block truncate">Detenido</span>
                         <span className="text-[10px] opacity-75 font-medium block truncate">Equipo en parada</span>
                       </div>
                     </div>
                     {equipmentOperatingStatus[currentEquipment.id] === 'Detenido' && (
                       <CheckCircle2 className="w-5 h-5 text-amber-500 shrink-0 ml-1" />
                     )}
                   </button>
                 </div>
               </div>
             )}

             {areaEquipment.length > 0 && currentEquipment?.inspeccionVOSO && (
               <div className="space-y-10 py-4">
                 <div className="flex flex-col gap-4 px-2">
                   <div className="flex items-center justify-between">
                     <h4 className="text-2xl font-black text-zinc-900 dark:text-white tracking-tighter uppercase">Inspección Primaria</h4>
                     <div className="flex gap-2">
                       {[Eye, Ear, Hand, Wind, Sparkles].map((Ico, i) => (
                         <div key={`mini-voso-${i}`} className="w-8 h-8 rounded-full bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-white/10 flex items-center justify-center shadow-sm dark:shadow-none">
                           <Ico className="w-4 h-4 text-zinc-400 dark:text-zinc-500" />
                         </div>
                       ))}
                     </div>
                   </div>
                  <div className="h-1 w-20 bg-zinc-900 dark:bg-white rounded-full" />
                  <p className="text-sm text-zinc-500 dark:text-zinc-400 font-medium leading-relaxed max-w-sm">
                    Utiliza tus sentidos para detectar anomalías tempranas. La metodología <span className="font-black text-zinc-900 dark:text-white">VOSO</span> es el estándar para el mantenimiento proactivo.
                  </p>
                </div>
                
                <div className="space-y-6">
                  <VOSOExecutionCategory 
                    title="👁 Ver" 
                    icon={Eye} 
                    items={currentEquipment.inspeccionVOSO.ver || []} 
                    responses={vosoResponses}
                    colorClass="bg-sky-50/80"
                    onUpdate={handleSetVOSOResponse}
                    onRequestCamera={(itemId) => setCameraCaptureTarget({ type: 'voso', itemId })}
                  />
                  <VOSOExecutionCategory 
                    title="👂 Oír" 
                    icon={Ear} 
                    items={currentEquipment.inspeccionVOSO.oir || []} 
                    responses={vosoResponses}
                    colorClass="bg-indigo-50/80"
                    onUpdate={handleSetVOSOResponse}
                    onRequestCamera={(itemId) => setCameraCaptureTarget({ type: 'voso', itemId })}
                  />
                  <VOSOExecutionCategory 
                    title="✋ Sentir" 
                    icon={Hand} 
                    items={currentEquipment.inspeccionVOSO.sentir || []} 
                    responses={vosoResponses}
                    colorClass="bg-emerald-50/80"
                    onUpdate={handleSetVOSOResponse}
                    onRequestCamera={(itemId) => setCameraCaptureTarget({ type: 'voso', itemId })}
                  />
                  <VOSOExecutionCategory 
                    title="👃 Oler" 
                    icon={Wind} 
                    items={currentEquipment.inspeccionVOSO.oler || []} 
                    responses={vosoResponses}
                    colorClass="bg-orange-50/80"
                    onUpdate={handleSetVOSOResponse}
                    onRequestCamera={(itemId) => setCameraCaptureTarget({ type: 'voso', itemId })}
                  />
                  <VOSOExecutionCategory 
                    title="✨ Orden y Limpieza" 
                    icon={Sparkles} 
                    items={currentEquipment.inspeccionVOSO.orden || []} 
                    responses={vosoResponses}
                    colorClass="bg-purple-50/80"
                    onUpdate={handleSetVOSOResponse}
                    onRequestCamera={(itemId) => setCameraCaptureTarget({ type: 'voso', itemId })}
                  />
                </div>
              </div>
            )}

            {areaEquipment.length > 0 && currentEquipment?.checkItems && currentEquipment.checkItems.length > 0 && (
              <div className="space-y-4 py-2">
                <h4 className="text-[10px] font-bold text-zinc-400 uppercase tracking-[0.2em] px-1">Ítems de Revisión</h4>
                <div className="space-y-3">
                  {currentEquipment.checkItems.map((item, idx) => (
                    <div key={`insp-item-${item.id}-${idx}`} className="bg-zinc-50 p-4 rounded-2xl border border-zinc-100 flex flex-col gap-3">
                      <p className="text-sm font-bold text-zinc-700">{item.name}</p>
                      <div className="grid grid-cols-3 gap-2">
                        {(['Bueno', 'Regular', 'Malo'] as const).map((state, sIdx) => (
                          <button
                            key={`btn-state-${state}-${sIdx}`}
                            onClick={() => handleSetItemState(item.id, state)}
                            className={`py-2 px-3 rounded-xl text-[10px] font-bold uppercase transition-all border ${
                              checkItemStates[item.id] === state 
                                ? state === 'Bueno' ? 'bg-brand-green text-white border-brand-green shadow-md shadow-emerald-100 dark:shadow-none' 
                                : state === 'Regular' ? 'bg-amber-500 text-white border-amber-500 shadow-md shadow-amber-100 dark:shadow-none'
                                : 'bg-red-500 text-white border-red-500 shadow-md shadow-red-100 dark:shadow-none'
                                : 'bg-white text-zinc-400 border-zinc-200 hover:border-zinc-300'
                            }`}
                          >
                            {state}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="pt-4 flex flex-col sm:flex-row items-center gap-3">
              {currentEquipmentIndex < areaEquipment.length - 1 && (
                <button
                  type="button"
                  onClick={() => {
                    if (!allItemsChecked()) {
                      setMessage({ text: 'Debes responder todos los ítems del equipo actual antes de salir de la inspección.', type: 'error' });
                      return;
                    }
                    setShowEquipmentSummary(true);
                  }}
                  disabled={!allItemsChecked()}
                  className={`w-full sm:w-1/2 py-4 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all border cursor-pointer ${
                    allItemsChecked()
                      ? 'bg-amber-500 hover:bg-amber-600 text-white border-amber-500 shadow-md shadow-amber-200/50 dark:shadow-none active:scale-[0.98]'
                      : 'bg-zinc-100 text-zinc-300 border-zinc-200 grayscale cursor-not-allowed'
                  }`}
                >
                  <LogOut className="w-4 h-4 text-white" />
                  <span className="text-xs uppercase tracking-wider font-black">Salir de Inspección</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setShowEquipmentSummary(true)}
                disabled={!allItemsChecked()}
                className={`w-full ${currentEquipmentIndex < areaEquipment.length - 1 ? 'sm:w-1/2' : 'w-full'} py-4 rounded-2xl font-bold flex items-center justify-center gap-2 sm:gap-3 transition-all border cursor-pointer ${
                  allItemsChecked() 
                    ? 'bg-zinc-900 text-white shadow-xl shadow-zinc-200 dark:shadow-none active:scale-[0.98]' 
                    : 'bg-zinc-100 text-zinc-300 border-zinc-200 grayscale cursor-not-allowed'
                }`}
              >
                <CheckCircle2 className={`w-5 h-5 ${allItemsChecked() ? 'text-emerald-400' : 'text-zinc-300'}`} />
                <span className="text-xs sm:text-sm uppercase tracking-widest font-black">
                  {currentEquipmentIndex < areaEquipment.length - 1 ? 'Siguiente Equipo' : 'Finalizar Inspección'}
                </span>
                <ChevronRight className={`w-5 h-5 transition-transform ${allItemsChecked() ? 'translate-x-1' : ''}`} />
              </button>
            </div>
          </motion.div>
        </AnimatePresence>

        <div className="flex items-center justify-between pt-2">
              <button 
                onClick={() => {
                  if (currentEquipmentIndex > 0) {
                    const currentData = {
                      trad: { ...checkItemStates },
                      voso: { ...vosoResponses }
                    };
                    const updatedResults = {
                      ...inspectionResults,
                      [currentEquipment.id]: currentData
                    };
                    setInspectionResults(updatedResults);
                    setSlideDirection('prev');
                    
                    const prevIndex = currentEquipmentIndex - 1;
                    const prevEquip = areaEquipment[prevIndex];
                    const prevSaved = updatedResults[prevEquip.id] as { trad: any, voso: any } | undefined;
                    setCheckItemStates(prevSaved?.trad || {});
                    setVosoResponses(prevSaved?.voso || {});
                    setCurrentEquipmentIndex(prevIndex);
                  }
                }}
                disabled={currentEquipmentIndex === 0}
                className={`text-xs font-bold uppercase tracking-wider transition-opacity ${currentEquipmentIndex === 0 ? 'opacity-0' : 'opacity-100'}`}
              >
                ← Anterior
              </button>
              <button 
                onClick={() => { setSelectedArea(null); setCurrentEquipmentIndex(0); }}
                className="text-xs font-bold uppercase tracking-wider text-red-400 hover:text-red-500"
              >
                Cancelar Ruta
              </button>
            </div>
          </div>
        </div>
      </motion.div>
      )}

      {showFindingForm && (
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white dark:bg-black rounded-3xl p-6 border border-zinc-100 dark:border-white/10 shadow-xl dark:shadow-none space-y-6"
        >
          <h3 className="text-xl font-bold text-zinc-900 dark:text-white">Detalle del Hallazgo</h3>
          
          <div className="space-y-4">
            <div className="p-4 bg-amber-50 dark:bg-amber-500/10 rounded-2xl border border-amber-100 dark:border-amber-500/20">
               <p className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-widest mb-1">Equipo afectado</p>
               <p className="font-bold text-amber-900 dark:text-amber-200">{currentEquipment?.name || 'Área General'}</p>
            </div>

            {/* Category Selector */}
            <div className="space-y-2">
              <label className="block text-xs font-black text-zinc-500 uppercase tracking-wider">Módulo / Categoría</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setFindingCategory('VOSO')}
                  className={`py-3 px-4 rounded-2xl text-xs font-black uppercase transition-all flex items-center justify-center gap-2 border ${
                    findingCategory === 'VOSO'
                      ? 'bg-brand-blue text-white border-brand-blue shadow-md'
                      : 'bg-zinc-50 dark:bg-zinc-900 text-zinc-500 border-zinc-200 dark:border-white/10'
                  }`}
                >
                  <span>👁️👂 VOSO</span>
                </button>
                <button
                  type="button"
                  onClick={() => setFindingCategory('OrdenYLimpieza')}
                  className={`py-3 px-4 rounded-2xl text-xs font-black uppercase transition-all flex items-center justify-center gap-2 border ${
                    findingCategory === 'OrdenYLimpieza'
                      ? 'bg-purple-600 text-white border-purple-600 shadow-md'
                      : 'bg-zinc-50 dark:bg-zinc-900 text-zinc-500 border-zinc-200 dark:border-white/10'
                  }`}
                >
                  <Sparkles className="w-4 h-4 text-purple-300" />
                  <span>Orden & Limpieza</span>
                </button>
              </div>
            </div>

            {findingCategory === 'OrdenYLimpieza' && (
              <div className="space-y-2 bg-purple-50 dark:bg-purple-500/10 p-4 rounded-2xl border border-purple-100 dark:border-purple-500/20">
                <label className="block text-xs font-black text-purple-700 dark:text-purple-300 uppercase tracking-wider">Subcategoría 5S</label>
                <select
                  value={findingSubcat}
                  onChange={(e) => setFindingSubcat(e.target.value as any)}
                  className="w-full p-3 bg-white dark:bg-zinc-900 border border-purple-200 dark:border-white/10 rounded-xl text-xs font-bold text-zinc-900 dark:text-white outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option value="Residuos">Residuos en el área</option>
                  <option value="Herramientas">Herramientas fuera de lugar</option>
                  <option value="Derrames">Derrame de lubricantes/fluidos</option>
                  <option value="Obstrucciones">Obstrucciones en accesos/pasillos</option>
                  <option value="Limpieza">Limpieza de equipo/área</option>
                  <option value="General">General 5S</option>
                </select>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Descripción</label>
              <textarea 
                value={findingDescription}
                onChange={(e) => setFindingDescription(e.target.value)}
                className="w-full p-4 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 rounded-2xl focus:ring-2 focus:ring-brand-blue outline-none transition-all min-h-[100px] text-xs font-medium dark:text-white"
                placeholder={findingCategory === 'OrdenYLimpieza' ? "Detalla el problema de orden, aseo o residuo..." : "¿Qué problema VOSO encontraste?"}
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Fotos del Hallazgo <span className="text-xs text-red-500 font-bold">* Obligatoria (al menos 1)</span>
                </label>
                <FlashlightWidget variant="compact" />
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <input 
                  type="file" 
                  accept="image/*" 
                  id="findingPhotoInput"
                  className="hidden" 
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      if (findingPhotos.length >= 3) {
                        setFormValidationError("Límite alcanzado: máximo 3 fotos por hallazgo.");
                        e.target.value = '';
                        return;
                      }
                      setFormValidationError(null);
                      try {
                        const compressed = await validateAndCompressImage(file, 150, 150);
                        setFindingPhotos(prev => [...prev, compressed].slice(0, 3));
                        e.target.value = '';
                      } catch (err: any) {
                        console.error("Manual finding validation/compression error:", err);
                        setFormValidationError(err.message || "Error al procesar la foto del hallazgo");
                        setMessage({ text: err.message || "Error al procesar la foto del hallazgo", type: 'error' });
                        e.target.value = '';
                      }
                    }
                  }}
                />
                
                {findingPhotos.length < 3 && (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setCameraCaptureTarget({ type: 'finding' })}
                      className={`h-20 px-3.5 rounded-2xl flex flex-col items-center justify-center cursor-pointer transition-all active:scale-95 text-[10px] font-bold gap-1 shadow-xs ${
                        findingPhotos.length === 0 
                          ? 'bg-red-50 dark:bg-red-950/30 border-2 border-red-500 text-red-600 dark:text-red-400 animate-pulse' 
                          : 'bg-zinc-900 dark:bg-white text-white dark:text-black border border-transparent'
                      }`}
                      title="Tomar foto con cámara en vivo sin salir de la app"
                    >
                      <Camera className="w-5 h-5 text-sky-400" />
                      <span className="whitespace-nowrap">📷 Cámara</span>
                    </button>

                    <label 
                      htmlFor="findingPhotoInput"
                      className="h-20 px-3 rounded-2xl flex flex-col items-center justify-center cursor-pointer transition-all active:scale-95 text-[10px] font-bold gap-1 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 text-zinc-600 dark:text-zinc-400 hover:text-sky-600 hover:border-sky-500"
                      title="Subir foto desde galería o archivos"
                    >
                      <Upload className="w-5 h-5" />
                      <span className="whitespace-nowrap">📁 Galería</span>
                    </label>
                  </div>
                )}

                {findingPhotos.map((photo, pIdx) => (
                  <div key={`finding-preview-${pIdx}`} className="relative group w-20 h-20">
                    <OfflineImage src={photo} className="w-20 h-20 object-cover rounded-2xl border border-zinc-200 dark:border-white/10" alt={`Preview ${pIdx + 1}`} />
                    <button 
                      type="button"
                      onClick={() => setFindingPhotos(prev => prev.filter((_, i) => i !== pIdx))}
                      className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow-md hover:bg-red-600 transition-colors cursor-pointer z-10"
                      title="Eliminar foto"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-3 p-4 bg-zinc-50 rounded-2xl">
              <input 
                type="checkbox" 
                id="closeNow" 
                checked={isClosingImmediately}
                onChange={(e) => setIsClosingImmediately(e.target.checked)}
                className="w-5 h-5 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-900"
              />
              <label htmlFor="closeNow" className="text-sm font-medium text-zinc-700">Solucionar ahora mismo</label>
            </div>

            {isClosingImmediately && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}>
                <label className="block text-sm font-medium text-zinc-700 mb-1">Solución Aplicada</label>
                <textarea 
                  value={immediateSolution}
                  onChange={(e) => setImmediateSolution(e.target.value)}
                  className="w-full p-4 bg-zinc-50 border border-zinc-200 rounded-2xl focus:ring-2 focus:ring-zinc-900 focus:border-transparent outline-none transition-all"
                  placeholder="¿Cómo lo arreglaste?"
                />
              </motion.div>
            )}

            {formValidationError && (
              <div className="p-4 bg-red-50 dark:bg-red-505/10 border border-red-100 dark:border-red-500/20 text-red-600 dark:text-red-400 rounded-2xl text-xs font-bold leading-relaxed flex items-start gap-2">
                <span>⚠️</span>
                <span>{formValidationError}</span>
              </div>
            )}
          </div>

          <div className="flex gap-3">
            <button 
              onClick={() => setShowFindingForm(false)}
              className="flex-1 py-4 bg-zinc-100 text-zinc-600 rounded-2xl font-bold hover:bg-zinc-200 transition-colors"
            >
              Atrás
            </button>
            <button 
              onClick={() => handleSubmitFinding(false)}
              disabled={isSaving}
              className="flex-[2] py-4 bg-brand-blue text-white rounded-2xl font-bold hover:opacity-90 transition-colors disabled:opacity-50 shadow-lg shadow-sky-100 dark:shadow-none flex items-center justify-center gap-2"
            >
              {isSaving ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Guardando...</span>
                </>
              ) : (
                'Guardar Reporte'
              )}
            </button>
          </div>

          {duplicateFinding && (
            <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute inset-0 bg-zinc-900/60 backdrop-blur-sm" onClick={() => setDuplicateFinding(null)} />
              <motion.div 
                initial={{ scale: 0.9, opacity: 0, y: 20 }} 
                animate={{ scale: 1, opacity: 1, y: 0 }}
                className="relative bg-white dark:bg-black p-6 rounded-[2.5rem] shadow-2xl dark:shadow-none max-w-sm w-full space-y-4 border border-transparent dark:border-white/20"
              >
                <div className="w-12 h-12 bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 rounded-full flex items-center justify-center mx-auto">
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <div className="text-center">
                  <h4 className="text-lg font-bold text-zinc-900 dark:text-white uppercase tracking-tight">Posible Duplicado</h4>
                  <p className="text-xs text-zinc-500 mt-1">
                    Ya existe un hallazgo activo para esta ubicación. Revisa si es el mismo:
                  </p>
                  <div className="mt-4 p-4 bg-amber-50 rounded-2xl border border-amber-100 text-left">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-[10px] font-bold text-amber-600 uppercase tracking-widest">Reportado por {duplicateFinding.operatorName}</p>
                      <span className="text-[10px] text-amber-400 font-bold">{duplicateFinding.status === 'Open' ? 'ABIERTO' : 'EN REVISIÓN'}</span>
                    </div>
                    <FindingDescriptionRenderer description={duplicateFinding.description} className="text-zinc-700" />
                  </div>
                  <p className="text-[10px] text-zinc-400 mt-4 font-bold uppercase tracking-[0.2em]">¿Deseas reportarlo de todas formas?</p>
                </div>
                <div className="flex flex-col gap-2 pt-2">
                  <button 
                    onClick={() => { setDuplicateFinding(null); handleSubmitFinding(true); }}
                    className="w-full py-4 bg-brand-blue text-white rounded-2xl font-bold text-sm active:scale-95 transition-all shadow-lg shadow-sky-100 dark:shadow-none"
                  >
                    No es el mismo, reportar nuevo
                  </button>
                  <button 
                    onClick={() => { setDuplicateFinding(null); setShowFindingForm(false); setFindingDescription(''); handleNextEquipment(); }}
                    className="w-full py-3 text-zinc-400 hover:text-zinc-600 font-bold text-xs uppercase tracking-widest transition-all"
                  >
                    Sí, es el mismo (Cancelar)
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </motion.div>
      )}

      <AnimatePresence>
        {showEquipmentSummary && currentEquipment && (
          <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:p-4">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }} 
              onClick={() => setShowEquipmentSummary(false)} 
              className="absolute inset-0 bg-zinc-900/60 backdrop-blur-sm" 
            />
            <motion.div 
              initial={{ y: "100%" }} 
              animate={{ y: 0 }} 
              exit={{ y: "100%" }} 
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="relative w-full max-w-lg bg-white dark:bg-black rounded-t-[2.5rem] sm:rounded-[2.5rem] shadow-2xl dark:shadow-none flex flex-col max-h-[90vh] overflow-hidden border-t sm:border border-zinc-100 dark:border-white/20"
            >
              <div className="p-8 border-b border-zinc-50 dark:border-white/10 flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-bold text-zinc-900 dark:text-white uppercase tracking-tight">Resumen de Inspección</h3>
                  <div className="flex items-center gap-2 mt-0.5">
                    <p className="text-sm text-zinc-500 dark:text-zinc-400">{currentEquipment.name}</p>
                    <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border ${
                      (equipmentOperatingStatus[currentEquipment.id] || 'En Funcionamiento') === 'En Funcionamiento'
                        ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                        : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30'
                    }`}>
                      {(equipmentOperatingStatus[currentEquipment.id] || 'En Funcionamiento') === 'En Funcionamiento' ? '⚡ Operando' : '🛑 Detenido'}
                    </span>
                  </div>
                </div>
                <button onClick={() => setShowEquipmentSummary(false)} className="p-2 bg-zinc-50 dark:bg-zinc-900 rounded-full">
                  <X className="w-5 h-5 text-zinc-400 dark:text-zinc-500" />
                </button>
              </div>
              
              <div className="flex-1 overflow-y-auto p-8 pt-4 custom-scrollbar">
                <div className="space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-emerald-50 p-4 rounded-3xl border border-emerald-100 flex items-center gap-3">
                      <div className="p-2 bg-white dark:bg-zinc-800 rounded-xl shadow-sm dark:shadow-none text-emerald-500">
                        <CheckCircle2 className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest">Normal</p>
                        <h4 className="text-xl font-black text-emerald-700">
                          {(Object.values(vosoResponses) as VOSOResponse[]).filter(r => r.status === 'OK' || r.status === 'NA').length + 
                           Object.values(checkItemStates).filter(s => s === 'Bueno').length}
                        </h4>
                      </div>
                    </div>
                    <div className="bg-amber-50 p-4 rounded-3xl border border-amber-100 flex items-center gap-3">
                      <div className="p-2 bg-white dark:bg-zinc-800 rounded-xl shadow-sm dark:shadow-none text-amber-500">
                         <AlertTriangle className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-amber-600 uppercase tracking-widest">Hallazgos</p>
                        <h4 className="text-xl font-black text-amber-700">
                           {(Object.values(vosoResponses) as VOSOResponse[]).filter(r => r.status === 'Observación' || r.status === 'Crítico').length + 
                            Object.values(checkItemStates).filter(s => s !== 'Bueno').length}
                        </h4>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    {(() => {
                      const equipPhotos = (Object.values(vosoResponses) as VOSOResponse[])
                        .map(r => r.photoUrl)
                        .filter((p): p is string => Boolean(p && typeof p === 'string' && p.trim() !== ''));
                      if (equipPhotos.length > 0) {
                        return (
                          <div className="space-y-2 mb-4">
                            <h4 className="text-[10px] font-bold text-zinc-400 uppercase tracking-[0.2em] ml-1">
                              Galería de Fotos del Equipo ({equipPhotos.length})
                            </h4>
                            <div className="rounded-2xl overflow-hidden border border-zinc-200 dark:border-white/10 h-60 shadow-sm">
                              <FindingPhotoGallery photos={equipPhotos} altPrefix={currentEquipment?.name || 'Equipo'} />
                            </div>
                          </div>
                        );
                      }
                      return null;
                    })()}

                    <h4 className="text-[10px] font-bold text-zinc-400 uppercase tracking-[0.2em] ml-1">Detalle de Hallazgos</h4>
                     
                     {(Object.entries(vosoResponses) as [string, VOSOResponse][])
                       .filter(([_, r]) => r.status === 'Observación' || r.status === 'Crítico')
                       .map(([id, r]) => {
                         const voso = currentEquipment?.inspeccionVOSO;
                         const item = [...(voso?.ver || []), ...(voso?.oir || []), ...(voso?.sentir || []), ...(voso?.oler || [])].find(i => i.id === id);
                         return (
                           <div key={`sum-voso-${id}`} className="bg-zinc-50/50 p-4 rounded-2xl border border-zinc-100 flex items-start gap-4">
                             <div className={`p-2 rounded-xl text-white ${r.status === 'Crítico' ? 'bg-red-500' : 'bg-amber-500'}`}>
                               {r.status === 'Crítico' ? <AlertCircle className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                             </div>
                             <div className="flex-1 min-w-0">
                               <p className="text-sm font-bold text-zinc-900 truncate">{item?.name}</p>
                               <div className="flex items-center gap-2 mt-0.5">
                                 <span className={`text-[8px] font-bold uppercase px-1 rounded ${r.status === 'Crítico' ? 'bg-red-50 text-red-500' : 'bg-amber-50 text-amber-600'}`}>
                                   {r.status}
                                 </span>
                                 <p className="text-[10px] text-zinc-500 truncate">{r.comment || 'Sin observación escrita'}</p>
                               </div>
                               {r.solvedByOperator && (
                                 <div className="flex items-center gap-1.5 mt-2 text-emerald-600 bg-emerald-50 w-fit px-2 py-0.5 rounded-full">
                                   <ShieldCheck className="w-3 h-3" />
                                   <span className="text-[9px] font-bold uppercase tracking-wider">Solucionado en sitio</span>
                                 </div>
                               )}
                             </div>
                             {r.photoUrl && (
                               <div className="w-10 h-10 rounded-lg overflow-hidden border border-white dark:border-white/20 shadow-sm dark:shadow-none flex-shrink-0">
                                 <OfflineImage src={r.photoUrl} className="w-full h-full object-cover" />
                               </div>
                             )}
                           </div>
                         );
                       })
                     }

                     {Object.entries(checkItemStates)
                       .filter(([_, s]) => s !== 'Bueno')
                       .map(([id, s]) => {
                         const item = currentEquipment.checkItems?.find(i => i.id === id);
                         return (
                           <div key={`sum-trad-${id}`} className="bg-zinc-50/50 p-4 rounded-2xl border border-zinc-100 flex items-start gap-4">
                             <div className={`p-2 rounded-xl text-white ${s === 'Malo' ? 'bg-red-500' : 'bg-amber-500'}`}>
                                <AlertTriangle className="w-4 h-4" />
                             </div>
                             <div className="flex-1">
                               <p className="text-sm font-bold text-zinc-900">{item?.name}</p>
                               <p className="text-[10px] text-zinc-500 mt-0.5 uppercase font-bold tracking-widest">{s}</p>
                             </div>
                           </div>
                         );
                       })
                     }

                     {((Object.values(vosoResponses) as VOSOResponse[]).every(r => r.status === 'OK' || r.status === 'NA') && 
                      Object.values(checkItemStates).every(s => s === 'Bueno')) && (
                       <div className="py-12 text-center bg-zinc-50 rounded-[2.5rem] border border-dashed border-zinc-200">
                         <div className="w-16 h-16 bg-white dark:bg-zinc-800 rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm dark:shadow-none">
                           <CheckCircle2 className="w-8 h-8 text-emerald-400" />
                         </div>
                         <p className="text-sm font-bold text-zinc-900">Sin hallazgos reportados</p>
                         <p className="text-xs text-zinc-400 mt-1">Todo se encuentra en orden en este equipo.</p>
                       </div>
                     )}
                  </div>
                </div>
              </div>

              <div className="p-6 border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50 flex flex-col sm:flex-row items-center gap-3">
                {currentEquipmentIndex < areaEquipment.length - 1 && (
                  <button 
                    type="button"
                    onClick={async () => {
                      setShowEquipmentSummary(false);
                      await handleNextEquipment(true);
                    }}
                    disabled={isSaving}
                    className="w-full sm:w-1/2 py-4 px-4 bg-amber-500 hover:bg-amber-600 text-white rounded-2xl font-bold shadow-lg shadow-amber-500/20 active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    <LogOut className="w-5 h-5" />
                    <span className="text-xs sm:text-sm uppercase tracking-wider font-black">
                      Salir de Inspección
                    </span>
                  </button>
                )}
                <button 
                  type="button"
                  onClick={async () => {
                    setShowEquipmentSummary(false);
                    await handleNextEquipment(false);
                  }}
                  disabled={isSaving}
                  className={`w-full ${currentEquipmentIndex < areaEquipment.length - 1 ? 'sm:w-1/2' : 'w-full'} py-4 px-4 bg-zinc-900 dark:bg-white dark:text-black text-white rounded-2xl font-bold shadow-lg shadow-zinc-200 dark:shadow-none active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50`}
                >
                  <span className="text-xs sm:text-sm uppercase tracking-widest font-black">
                    {currentEquipmentIndex < areaEquipment.length - 1 ? 'Siguiente Equipo' : 'Finalizar y Guardar'}
                  </span>
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal de Inspección Pausada */}
      <AnimatePresence>
        {isPauseModalOpen && (
          <div className="fixed inset-0 z-[130] flex items-center justify-center p-4 sm:p-6">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }} 
              onClick={() => setIsPauseModalOpen(false)} 
              className="absolute inset-0 bg-zinc-950/80 backdrop-blur-md" 
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }} 
              animate={{ scale: 1, opacity: 1, y: 0 }} 
              exit={{ scale: 0.9, opacity: 0, y: 20 }} 
              className="relative w-full max-w-md bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 rounded-[2.5rem] shadow-2xl overflow-hidden z-10 p-6 sm:p-8 text-center space-y-6"
            >
              <div className="w-16 h-16 rounded-3xl bg-amber-500/10 border border-amber-500/20 text-amber-500 mx-auto flex items-center justify-center shadow-inner">
                <PauseCircle className="w-9 h-9" />
              </div>

              <div>
                <span className="px-3.5 py-1 bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[10px] font-black uppercase tracking-widest rounded-full border border-amber-500/20">
                  Inspección Pausada
                </span>
                <h3 className="text-xl font-extrabold text-zinc-900 dark:text-white mt-2">
                  {selectedArea?.name || 'Área en Inspección'}
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                  Los cronómetros de área y de equipo se encuentran pausados.
                </p>
              </div>

              {/* Live Timer Badges */}
              <div className="p-4 bg-zinc-50 dark:bg-zinc-950 rounded-2xl border border-zinc-200/60 dark:border-white/5 flex items-center justify-around">
                <div className="text-center">
                  <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Tiempo Área</p>
                  <p className="text-2xl font-mono font-black text-amber-500">{formatTimer(inspectionTimerSeconds)}</p>
                </div>
                <div className="h-8 w-px bg-zinc-200 dark:bg-zinc-800" />
                <div className="text-center">
                  <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Tiempo Equipo</p>
                  <p className="text-2xl font-mono font-black text-sky-500">{formatTimer(equipmentTimerSeconds)}</p>
                </div>
              </div>

              {/* Pause Motive Selector */}
              <div className="space-y-2 text-left">
                <label className="text-[10px] font-black uppercase tracking-wider text-zinc-400 block">
                  Motivo de la Pausa (Opcional)
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    '🚨 Atención de Urgencia',
                    '☕ Pausa / Descanso',
                    '📞 Coordinación Operativa',
                    '🔧 Acción en Sitio'
                  ].map((motive) => (
                    <button
                      key={motive}
                      type="button"
                      onClick={() => setPauseReason(motive)}
                      className={`p-2.5 rounded-xl text-left text-[11px] font-bold transition-all border cursor-pointer ${
                        pauseReason === motive
                          ? 'bg-amber-500/10 border-amber-500 text-amber-700 dark:text-amber-300 shadow-xs'
                          : 'bg-zinc-50 dark:bg-zinc-800/50 border-zinc-200 dark:border-white/5 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100'
                      }`}
                    >
                      {motive}
                    </button>
                  ))}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="space-y-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsInspectionPaused(false);
                    setIsPauseModalOpen(false);
                  }}
                  className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs uppercase tracking-wider rounded-2xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-600/20 active:scale-95 cursor-pointer"
                >
                  <Play className="w-5 h-5 fill-current text-white" />
                  <span>Reanudar Inspección</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsPauseModalOpen(false)}
                  className="w-full py-3 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 font-bold text-xs uppercase tracking-wider rounded-2xl transition-all cursor-pointer"
                >
                  Atender Urgencia / Ir al Menú
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Bar Fija Flotante cuando la inspección está en pausa y el operador navega */}
      <AnimatePresence>
        {selectedArea && isInspectionPaused && !isPauseModalOpen && (
          <motion.div
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            className="fixed bottom-5 left-4 right-4 sm:left-auto sm:right-6 sm:w-96 z-50 bg-zinc-950 border border-amber-500/50 text-white p-4 rounded-3xl shadow-2xl backdrop-blur-md flex items-center justify-between gap-3"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="p-2.5 bg-amber-500/20 border border-amber-500/30 text-amber-400 rounded-2xl shrink-0 animate-pulse">
                <Pause className="w-5 h-5 fill-current" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black uppercase text-amber-400 tracking-wider">En Pausa</span>
                  <span className="text-[10px] font-mono font-bold text-zinc-400">{formatTimer(inspectionTimerSeconds)}</span>
                </div>
                <p className="font-extrabold text-xs text-white truncate">
                  {selectedArea.name}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                setIsInspectionPaused(false);
                setIsPauseModalOpen(false);
              }}
              className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs uppercase tracking-wider rounded-2xl flex items-center gap-1.5 shrink-0 transition-all shadow-md shadow-emerald-600/30 active:scale-95 cursor-pointer"
            >
              <Play className="w-4 h-4 fill-current text-white" />
              <span>Continuar</span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showSuccessModal && successModalConfig && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }} 
              className="absolute inset-0 bg-zinc-900/60 backdrop-blur-sm" 
              onClick={() => {
                setShowSuccessModal(false);
                resetInspectionState();
              }} 
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 30 }} 
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 30 }}
              className="relative bg-white dark:bg-zinc-900 p-8 rounded-[2.5rem] shadow-2xl dark:shadow-none max-w-sm w-full space-y-6 border border-zinc-100 dark:border-white/10 text-center"
            >
              <div className="w-16 h-16 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-500 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-8 h-8 animate-bounce" />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-black text-zinc-900 dark:text-white tracking-tight">
                  {successModalConfig.title}
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                  {successModalConfig.message}
                </p>
              </div>
              
              <div className="flex flex-col gap-2 pt-2">
                {lastSavedFindingForPdf && (
                  <div className="grid grid-cols-2 gap-2 mb-1">
                    <button
                      type="button"
                      onClick={() => {
                        const opProf = getOperatorProfile(lastSavedFindingForPdf.operatorId, lastSavedFindingForPdf.operatorName, lastSavedFindingForPdf.operatorPhotoUrl);
                        downloadOperatorInspectionPDF(lastSavedFindingForPdf, {
                          name: lastSavedFindingForPdf.operatorName || opProf.name,
                          photoUrl: opProf.photoUrl || lastSavedFindingForPdf.operatorPhotoUrl,
                          rut: opProf.rut,
                          cargo: opProf.cargo
                        });
                      }}
                      className="py-3 px-3 bg-sky-600 hover:bg-sky-500 text-white rounded-2xl font-black text-xs uppercase tracking-wider transition-all shadow-md active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Download className="w-4 h-4" />
                      <span>Descargar PDF</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const opProf = getOperatorProfile(lastSavedFindingForPdf.operatorId, lastSavedFindingForPdf.operatorName, lastSavedFindingForPdf.operatorPhotoUrl);
                        shareOperatorInspectionPDF(lastSavedFindingForPdf, {
                          name: lastSavedFindingForPdf.operatorName || opProf.name,
                          photoUrl: opProf.photoUrl || lastSavedFindingForPdf.operatorPhotoUrl,
                          rut: opProf.rut,
                          cargo: opProf.cargo
                        });
                      }}
                      className="py-3 px-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl font-black text-xs uppercase tracking-wider transition-all shadow-md active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Share2 className="w-4 h-4" />
                      <span>Compartir PDF</span>
                    </button>
                  </div>
                )}
                <div className="flex flex-col sm:flex-row gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowSuccessModal(false);
                      resetInspectionState();
                      if (setActiveTab) {
                        setActiveTab('History');
                      }
                    }}
                    className="flex-1 py-3 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 rounded-2xl font-bold text-[10px] uppercase tracking-wider transition-all active:scale-95 flex items-center justify-center gap-1.5"
                  >
                    <Eye className="w-4 h-4" />
                    Ver Historial
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowSuccessModal(false);
                      resetInspectionState();
                    }}
                    className="flex-1 py-3 bg-zinc-900 hover:bg-zinc-800 dark:bg-white dark:hover:bg-zinc-100 text-white dark:text-black rounded-2xl font-bold text-[10px] uppercase tracking-wider transition-all shadow-md active:scale-95 flex items-center justify-center gap-1.5"
                  >
                    <Plus className="w-4 h-4" />
                    Nueva Inspección
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      <WeatherSafetyModal
        isOpen={showWeatherSafetyModal}
        onClose={() => {
          setShowWeatherSafetyModal(false);
          setPendingAreaForInspection(null);
        }}
        onConfirm={() => {
          if (pendingAreaForInspection) {
            executeStartAreaInspection(pendingAreaForInspection, pendingEquipIndexForInspection);
          }
          setShowWeatherSafetyModal(false);
          setPendingAreaForInspection(null);
        }}
        area={pendingAreaForInspection}
        equipment={pendingAreaForInspection ? equipment.filter(e => e.areaId === pendingAreaForInspection.id)[pendingEquipIndexForInspection] : null}
        weather={weather}
        loadingWeather={loadingWeather}
        plant={plant}
      />
      <QuickHelpModal
        isOpen={showQuickHelp}
        onClose={() => setShowQuickHelp(false)}
        moduleKey="Inspeccion"
      />
      <CameraCaptureModal
        isOpen={cameraCaptureTarget !== null}
        onClose={() => setCameraCaptureTarget(null)}
        onCapture={async (blobOrData) => {
          try {
            const compressed = await validateAndCompressImage(blobOrData, 150, 150);
            if (cameraCaptureTarget?.type === 'finding') {
              setFindingPhotos(prev => [...prev, compressed].slice(0, 3));
            } else if (cameraCaptureTarget?.type === 'voso') {
              const itemId = cameraCaptureTarget.itemId;
              const current = vosoResponses[itemId];
              const existingPhotos = current?.photoUrls && current.photoUrls.length > 0
                ? current.photoUrls
                : (current?.photoUrl ? [current.photoUrl] : []);
              const updatedPhotos = [...existingPhotos, compressed].slice(0, 3);
              handleSetVOSOResponse(
                itemId, 
                current?.status || 'Observación', 
                current?.comment || '', 
                updatedPhotos, 
                current?.solvedByOperator
              );
            }
          } catch (e: any) {
            console.error("Camera capture error:", e);
            setFormValidationError(e.message || "Error al procesar la foto tomada");
          } finally {
            setCameraCaptureTarget(null);
          }
        }}
        title={
          cameraCaptureTarget?.type === 'voso'
            ? "Foto de Evidencia del Hallazgo VOSO"
            : "Foto de Evidencia del Hallazgo"
        }
      />
    </div>
  );
};

// --- Supervisor Stats Component ---
const SupervisorStats = ({ findings }: { findings: Finding[] }) => {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('theme') as 'light' | 'dark') || 'light';
    }
    return 'light';
  });

  const [activeTab, setActiveTab] = useState<'summary' | 'heatmap' | 'full'>('summary');

  useEffect(() => {
    const handleStorageChange = () => {
      setTheme((localStorage.getItem('theme') as 'light' | 'dark') || 'light');
    };
    window.addEventListener('storage', handleStorageChange);
    const observer = new MutationObserver(() => {
      const isDark = document.documentElement.classList.contains('dark');
      setTheme(isDark ? 'dark' : 'light');
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      observer.disconnect();
    };
  }, []);

  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [groupBy, setGroupBy] = useState<'area' | 'operador'>('area');

  const findingStats = useFindingAnalytics(findings);

  const filteredByDate = React.useMemo(() => {
    return findings.filter(f => {
      const fDate = getFindingDate(f);
      if (!fDate) return true;
      const start = dateRange.start ? new Date(dateRange.start) : null;
      const end = dateRange.end ? new Date(dateRange.end) : null;
      if (start && fDate < start) return false;
      if (end) {
        const endOfDay = new Date(end);
        endOfDay.setHours(23, 59, 59, 999);
        if (fDate > endOfDay) return false;
      }
      return true;
    });
  }, [findings, dateRange]);

  const setPresetRange = (days: number | 'all') => {
    if (days === 'all') {
      setDateRange({ start: '', end: '' });
      return;
    }
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - days);
    setDateRange({
      start: start.toISOString().split('T')[0],
      end: end.toISOString().split('T')[0],
    });
  };

  const chartData = React.useMemo(() => {
    const counts: Record<string, { name: string, open: number, closed: number, inReview: number }> = {};
    
    filteredByDate.forEach(f => {
      const key = groupBy === 'area' ? (f.areaName || 'Sin Área') : (f.operatorName || 'Sin Operador');
      if (!counts[key]) {
        counts[key] = { name: key, open: 0, closed: 0, inReview: 0 };
      }
      if (f.status === 'Open') counts[key].open++;
      else if (f.status === 'InReview') counts[key].inReview++;
      else counts[key].closed++;
    });

    return Object.values(counts)
      .sort((a, b) => (b.open + b.closed + b.inReview) - (a.open + a.closed + a.inReview))
      .slice(0, 8);
  }, [filteredByDate, groupBy]);

  const criticalCount = findingStats.findingsByPriority.find(p => p.name.includes('Alta'))?.value || 0;

  return (
    <div className="space-y-4">
      {/* Top Header Controls Bar */}
      <div className="bg-white dark:bg-zinc-950 p-4 rounded-2xl border border-zinc-100 dark:border-white/10 shadow-xs flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-sky-500/10 text-sky-500 flex items-center justify-center font-bold">
            <BarChart3 className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-extrabold text-sm text-zinc-900 dark:text-white tracking-tight">Dashboard Analítico de Hallazgos</h3>
            <p className="text-[10px] text-zinc-400 dark:text-zinc-500 font-medium">Visualización compacta de métricas y reportes operativos en planta</p>
          </div>
        </div>
      </div>

      {/* KPI Cards Grid - Compact 2x2 on Mobile, 4x1 on Desktop */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Compliance Card */}
        <div className="bg-white dark:bg-zinc-950 p-4 rounded-2xl border border-zinc-100 dark:border-white/10 shadow-xs space-y-2 hover:border-emerald-500/30 transition-all">
          <div className="flex items-center justify-between text-zinc-400">
            <span className="text-[9px] font-extrabold uppercase tracking-widest text-zinc-400">Cumplimiento</span>
            <div className="w-6 h-6 rounded-lg bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
              <CheckCircle2 className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl sm:text-3xl font-black tracking-tight text-zinc-900 dark:text-white">{findingStats.complianceRate}%</span>
            <span className="text-[9px] font-bold text-emerald-500 bg-emerald-500/10 px-1.5 py-0.5 rounded-md">Cerrados</span>
          </div>
          <div className="w-full bg-zinc-100 dark:bg-zinc-900 h-1.5 rounded-full overflow-hidden">
            <div className="bg-emerald-500 h-full rounded-full transition-all duration-500" style={{ width: `${Math.min(findingStats.complianceRate, 100)}%` }} />
          </div>
        </div>

        {/* MTTR Card */}
        <div className="bg-white dark:bg-zinc-950 p-4 rounded-2xl border border-zinc-100 dark:border-white/10 shadow-xs space-y-2 hover:border-sky-500/30 transition-all">
          <div className="flex items-center justify-between text-zinc-400">
            <span className="text-[9px] font-extrabold uppercase tracking-widest text-zinc-400">Tiempo de Cierre</span>
            <div className="w-6 h-6 rounded-lg bg-sky-500/10 text-sky-500 flex items-center justify-center">
              <Clock className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl sm:text-3xl font-black tracking-tight text-zinc-900 dark:text-white">{findingStats.meanTimeToResolutionHours}h</span>
            <span className="text-[9px] font-bold text-sky-500 bg-sky-500/10 px-1.5 py-0.5 rounded-md">Promedio</span>
          </div>
          <p className="text-[9px] text-zinc-400 dark:text-zinc-500 truncate">Tiempo medio de resolución</p>
        </div>

        {/* High Priority count */}
        <div className="bg-white dark:bg-zinc-950 p-4 rounded-2xl border border-zinc-100 dark:border-white/10 shadow-xs space-y-2 hover:border-red-500/30 transition-all">
          <div className="flex items-center justify-between text-zinc-400">
            <span className="text-[9px] font-extrabold uppercase tracking-widest text-zinc-400">Críticos</span>
            <div className="w-6 h-6 rounded-lg bg-red-500/10 text-red-500 flex items-center justify-center">
              <AlertTriangle className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl sm:text-3xl font-black tracking-tight text-zinc-900 dark:text-white">{criticalCount}</span>
            <span className="text-[9px] font-bold text-red-500 bg-red-500/10 px-1.5 py-0.5 rounded-md flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
              Alta
            </span>
          </div>
          <p className="text-[9px] text-zinc-400 dark:text-zinc-500 truncate">Requieren acción prioritaria</p>
        </div>

        {/* Total stats */}
        <div className="bg-white dark:bg-zinc-950 p-4 rounded-2xl border border-zinc-100 dark:border-white/10 shadow-xs space-y-2 hover:border-indigo-500/30 transition-all">
          <div className="flex items-center justify-between text-zinc-400">
            <span className="text-[9px] font-extrabold uppercase tracking-widest text-zinc-400">Total Histórico</span>
            <div className="w-6 h-6 rounded-lg bg-indigo-500/10 text-indigo-500 flex items-center justify-center">
              <FileText className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl sm:text-3xl font-black tracking-tight text-zinc-900 dark:text-white">{findingStats.totalFindings}</span>
            <span className="text-[9px] font-bold text-zinc-500 bg-zinc-100 dark:bg-zinc-900 px-1.5 py-0.5 rounded-md">Reportes</span>
          </div>
          <p className="text-[9px] text-zinc-400 dark:text-zinc-500 truncate">Registros totales en planta</p>
        </div>
      </div>

      {/* View Switcher Bar - Placed directly above the content it toggles */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between bg-white dark:bg-zinc-950 p-2 sm:p-2.5 rounded-2xl border border-zinc-100 dark:border-white/10 shadow-xs gap-2">
        <span className="text-[10px] font-extrabold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider px-2">
          Seleccionar Vista
        </span>
        <div className="flex items-center gap-1 bg-zinc-100 dark:bg-zinc-900 p-1 rounded-xl w-full sm:w-auto overflow-x-auto">
          <button
            onClick={() => setActiveTab('summary')}
            className={`flex-1 sm:flex-initial px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 whitespace-nowrap ${
              activeTab === 'summary' 
                ? 'bg-white dark:bg-black text-zinc-900 dark:text-white shadow-xs' 
                : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5 text-sky-500" />
            <span>Resumen</span>
          </button>
          <button
            onClick={() => setActiveTab('heatmap')}
            className={`flex-1 sm:flex-initial px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 whitespace-nowrap ${
              activeTab === 'heatmap' 
                ? 'bg-white dark:bg-black text-zinc-900 dark:text-white shadow-xs' 
                : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
            }`}
          >
            <Compass className="w-3.5 h-3.5 text-amber-500" />
            <span>Mapa de Calidez VOSO</span>
          </button>
          <button
            onClick={() => setActiveTab('full')}
            className={`flex-1 sm:flex-initial px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 whitespace-nowrap ${
              activeTab === 'full' 
                ? 'bg-white dark:bg-black text-zinc-900 dark:text-white shadow-xs' 
                : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
            }`}
          >
            <Activity className="w-3.5 h-3.5 text-emerald-500" />
            <span>Consolidado</span>
          </button>
        </div>
      </div>

      {/* Main Interactive Content Panel */}
      {(activeTab === 'summary' || activeTab === 'full') && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Core Bar Chart Card */}
          <div className="lg:col-span-2 bg-white dark:bg-zinc-950 rounded-2xl p-4 sm:p-5 border border-zinc-100 dark:border-white/10 shadow-xs space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-sky-500" />
                <h3 className="font-extrabold text-xs text-zinc-900 dark:text-white uppercase tracking-wider">Frecuencia de Hallazgos</h3>
              </div>
              
              {/* Group By selector */}
              <div className="flex items-center gap-1 bg-zinc-100 dark:bg-zinc-900 p-1 rounded-xl">
                <button 
                  onClick={() => setGroupBy('area')}
                  className={`px-2.5 py-1 rounded-lg text-[9px] font-bold uppercase tracking-wider transition-all ${groupBy === 'area' ? 'bg-white dark:bg-black text-zinc-900 dark:text-white shadow-xs' : 'text-zinc-500'}`}
                >
                  Por Área
                </button>
                <button 
                  onClick={() => setGroupBy('operador')}
                  className={`px-2.5 py-1 rounded-lg text-[9px] font-bold uppercase tracking-wider transition-all ${groupBy === 'operador' ? 'bg-white dark:bg-black text-zinc-900 dark:text-white shadow-xs' : 'text-zinc-500'}`}
                >
                  Por Operador
                </button>
              </div>
            </div>

            {/* Quick Date Presets & Date Pickers Bar */}
            <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 bg-zinc-50 dark:bg-zinc-900/60 rounded-xl border border-zinc-100 dark:border-white/5">
              <div className="flex items-center gap-1 overflow-x-auto">
                <span className="text-[9px] font-bold text-zinc-400 uppercase mr-1">Rango:</span>
                <button 
                  onClick={() => setPresetRange(7)} 
                  className={`px-2 py-0.5 rounded-md text-[9px] font-bold transition-colors ${dateRange.start && !dateRange.end ? 'bg-sky-500 text-white' : 'bg-zinc-200/60 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-300 dark:hover:bg-zinc-700'}`}
                >
                  7 días
                </button>
                <button 
                  onClick={() => setPresetRange(30)} 
                  className="px-2 py-0.5 rounded-md text-[9px] font-bold bg-zinc-200/60 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-300 dark:hover:bg-zinc-700 transition-colors"
                >
                  30 días
                </button>
                <button 
                  onClick={() => setPresetRange('all')} 
                  className={`px-2 py-0.5 rounded-md text-[9px] font-bold transition-colors ${!dateRange.start && !dateRange.end ? 'bg-sky-500 text-white' : 'bg-zinc-200/60 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-300 dark:hover:bg-zinc-700'}`}
                >
                  Todo
                </button>
              </div>

              <div className="flex items-center gap-2">
                <input 
                  type="date" 
                  value={dateRange.start}
                  onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                  className="px-2 py-1 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-white/10 rounded-lg text-[10px] outline-none focus:ring-1 focus:ring-sky-500 font-medium dark:text-white"
                />
                <span className="text-zinc-400 text-xs">-</span>
                <input 
                  type="date" 
                  value={dateRange.end}
                  onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                  className="px-2 py-1 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-white/10 rounded-lg text-[10px] outline-none focus:ring-1 focus:ring-sky-500 font-medium dark:text-white"
                />
              </div>
            </div>

            <div className="h-56 sm:h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart id="stats-summary-chart" data={chartData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={theme === 'dark' ? '#27272a' : '#e4e4e7'} />
                  <XAxis 
                    dataKey="name" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 9, fill: '#71717a' }}
                    interval={0}
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 9, fill: '#71717a' }}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      borderRadius: '12px', 
                      border: theme === 'dark' ? '1px solid #27272a' : '1px solid #e4e4e7', 
                      backgroundColor: theme === 'dark' ? '#18181b' : '#ffffff', 
                      color: theme === 'dark' ? '#ffffff' : '#18181b', 
                      boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' 
                    }}
                    cursor={{ fill: theme === 'dark' ? '#27272a' : '#f4f4f5' }}
                  />
                  <Bar dataKey="open" name="Pendientes" fill="#0ea5e9" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="inReview" name="En Revisión" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="closed" name="Cerrados" fill="#10b981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Dynamic Hotspots & Operator Contribution side Card */}
          <div className="bg-white dark:bg-zinc-950 p-4 sm:p-5 rounded-2xl border border-zinc-100 dark:border-white/10 shadow-xs flex flex-col justify-between gap-4">
            {/* Areas Section */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between border-b border-zinc-100 dark:border-white/5 pb-2">
                <div className="flex items-center gap-1.5">
                  <Compass className="w-3.5 h-3.5 text-amber-500" />
                  <h4 className="font-extrabold text-[10px] text-zinc-900 dark:text-white uppercase tracking-wider">Áreas con Mayor Frecuencia</h4>
                </div>
                <span className="text-[9px] font-bold text-zinc-400 bg-zinc-100 dark:bg-zinc-900 px-1.5 py-0.5 rounded-md">Top Áreas</span>
              </div>

              {findingStats.vulnerableAreas.length === 0 ? (
                <p className="text-xs text-zinc-400 dark:text-zinc-600 py-3 text-center font-medium">Planta sin incidencias activas.</p>
              ) : (
                <div className="space-y-1.5 max-h-[140px] overflow-y-auto pr-1 custom-scrollbar">
                  {findingStats.vulnerableAreas.slice(0, 5).map((area, index) => (
                    <div key={`vln-${index}`} className="flex items-center justify-between text-xs p-1.5 rounded-lg bg-zinc-50 dark:bg-zinc-900/40 hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors">
                      <span className="font-semibold text-zinc-700 dark:text-zinc-300 truncate max-w-[140px]">{area.name}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono font-extrabold bg-zinc-200/70 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 px-1.5 py-0.5 rounded-md">
                          {area.count}
                        </span>
                        <span className={`w-2 h-2 rounded-full ${
                          area.status === 'Crítico' ? 'bg-red-500 animate-pulse' :
                          area.status === 'Estable' ? 'bg-amber-500' : 'bg-emerald-500'
                        }`} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Leaderboard Section */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between border-b border-zinc-100 dark:border-white/5 pb-2">
                <div className="flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5 text-emerald-500" />
                  <h4 className="font-extrabold text-[10px] text-zinc-900 dark:text-white uppercase tracking-wider">Aporte Operacional</h4>
                </div>
                <span className="text-[9px] font-bold text-zinc-400 bg-zinc-100 dark:bg-zinc-900 px-1.5 py-0.5 rounded-md">Ranking</span>
              </div>

              {findingStats.operatorLeaderboard.length === 0 ? (
                <p className="text-xs text-zinc-400 dark:text-zinc-600 py-3 text-center font-medium">Sin datos de operadores.</p>
              ) : (
                <div className="space-y-1.5 max-h-[140px] overflow-y-auto pr-1 custom-scrollbar">
                  {findingStats.operatorLeaderboard.slice(0, 5).map((op, index) => (
                    <div key={`ldr-${index}`} className="flex items-center justify-between text-xs p-1.5 rounded-lg bg-zinc-50 dark:bg-zinc-900/40 hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors">
                      <span className="font-semibold text-zinc-700 dark:text-zinc-300 truncate max-w-[130px]">{op.name}</span>
                      <div className="flex items-center gap-2 text-[10px] font-bold text-zinc-400">
                        <span className="bg-sky-500/10 text-sky-600 dark:text-sky-400 px-1.5 py-0.5 rounded-md">Rep: {op.reportsCount}</span>
                        <span className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-1.5 py-0.5 rounded-md">Res: {op.resolvedCount}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Heatmap Tab View */}
      {(activeTab === 'heatmap' || activeTab === 'full') && (
        <div className="bg-white dark:bg-zinc-950 p-4 sm:p-5 rounded-2xl border border-zinc-100 dark:border-white/10 shadow-xs">
          <VOSOHeatmapChart findings={filteredByDate} />
        </div>
      )}
    </div>
  );
};

// --- Supervisor View ---

const SupervisorDashboard = ({ 
  user, 
  initialFindingId, 
  onClearPending,
  onStartOperatorInspection
}: { 
  user: AppUser, 
  initialFindingId?: string | null, 
  onClearPending?: () => void,
  onStartOperatorInspection?: () => void
}) => {
  const [findings, setFindings] = useState<Finding[]>([]);
  const [filter, setFilter] = useState<'All' | 'Open' | 'Closed' | 'InReview'>('Open');
  const [showStats, setShowStats] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [selectedFinding, setSelectedFinding] = useState<Finding | null>(null);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [supervisorComments, setSupervisorComments] = useState('');
  const [showQuickHelp, setShowQuickHelp] = useState(false);
  
  const [moduleFilter, setModuleFilter] = useState<'ALL' | 'VOSO' | 'OrdenYLimpieza'>('VOSO');

  // Custom Resolution Date/Time State for MTTR calculation
  const [customClosedDate, setCustomClosedDate] = useState<string>('');
  const [useCustomClosedDate, setUseCustomClosedDate] = useState<boolean>(false);
  const [isEditingClosedDate, setIsEditingClosedDate] = useState<boolean>(false);

  // Advanced Filter States
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [operatorFilter, setOperatorFilter] = useState('All');

  const [searchTerm, setSearchTerm] = useState('');
  const { getOperatorProfile } = useAppUsers();

  useEffect(() => {
    if (selectedFinding) {
      setSupervisorComments(selectedFinding.solution || selectedFinding.supervisorComments || '');
      setUseCustomClosedDate(false);
      const closedD = getFindingClosedDate(selectedFinding);
      setCustomClosedDate(formatToDatetimeLocal(closedD || new Date()));
      setIsEditingClosedDate(false);
    } else {
      setSupervisorComments('');
      setUseCustomClosedDate(false);
      setCustomClosedDate(formatToDatetimeLocal(new Date()));
      setIsEditingClosedDate(false);
    }
  }, [selectedFinding?.id]);

  useEffect(() => {
    // Elegant plant-scoped real-time listener using Enterprise FindingService
    const plantIdScope = user.role !== 'Administrador' ? user.plantId : undefined;
    return FindingService.subscribeToFindings((data) => {
      setFindings(data);
    }, plantIdScope);
  }, [user.uid, user.plantId, user.role]);

  useEffect(() => {
    if (initialFindingId && findings.length > 0) {
      const finding = findings.find(f => f.id === initialFindingId);
      if (finding) {
        setSelectedFinding(finding);
        if (onClearPending) onClearPending();
      }
    }
  }, [initialFindingId, findings, onClearPending]);

  // Extract findings scoped by module selector
  const activeModuleFindings = React.useMemo(() => {
    if (moduleFilter === 'VOSO') return findings.filter(isVOSOFinding);
    if (moduleFilter === 'OrdenYLimpieza') return findings.filter(isOrdenYLimpiezaFinding);
    return findings;
  }, [findings, moduleFilter]);

  const uniqueOperators = React.useMemo(() => {
    const operators = activeModuleFindings.map(f => f.operatorName).filter(Boolean);
    return Array.from(new Set(operators)).sort();
  }, [activeModuleFindings]);

  const filteredFindings = activeModuleFindings.filter(f => {
    const matchesFilter = filter === 'All' || f.status === filter;
    
    const matchesSearch = (f.description || '').toLowerCase().includes((searchTerm || '').toLowerCase()) || 
                          f.areaName?.toLowerCase().includes((searchTerm || '').toLowerCase()) ||
                          f.equipmentName?.toLowerCase().includes((searchTerm || '').toLowerCase()) ||
                          f.operatorName?.toLowerCase().includes((searchTerm || '').toLowerCase());
    
    const matchesOperator = operatorFilter === 'All' || f.operatorName === operatorFilter;
    
    let matchesDate = true;
    const fDate = getFindingDate(f);
    if (fDate) {
      if (startDate) {
        const start = new Date(startDate);
        if (fDate < start) matchesDate = false;
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        if (fDate > end) matchesDate = false;
      }
    } else if (startDate || endDate) {
      matchesDate = false;
    }
                          
    return matchesFilter && matchesSearch && matchesOperator && matchesDate;
  });

  const clearFilters = () => {
    setFilter('Open');
    setSearchTerm('');
    setStartDate('');
    setEndDate('');
    setOperatorFilter('All');
  };

  const handleCloseFinding = async () => {
    if (!selectedFinding) return;
    const dateToUse = useCustomClosedDate && customClosedDate ? new Date(customClosedDate) : null;
    const resultStatus = await FindingService.transitionStatus(selectedFinding.id, 'Closed', user, supervisorComments, dateToUse);
    
    // Notify operator
    await addDoc(collection(db, 'notifications'), {
      title: 'Hallazgo Cerrado',
      message: `Tu hallazgo en ${selectedFinding.areaName} ha sido cerrado por el supervisor.`,
      type: 'Finding',
      targetRole: 'Operador',
      scheduledAt: serverTimestamp(),
      status: 'Sent',
      createdBy: user.uid,
      createdAt: serverTimestamp(),
      referenceId: selectedFinding.id,
      plantId: selectedFinding.plantId
    });

    setSelectedFinding(null);
    setSupervisorComments('');
    setUseCustomClosedDate(false);
    
    if (resultStatus.queued) {
      showToast("Cierre Encolado", "Cierre registrado localmente en cola offline. Se sincronizará al recuperar señal.", "warning");
    } else {
      showToast("Hallazgo Cerrado", "El hallazgo se ha cerrado exitosamente.", "success");
    }
  };

  const handleUpdateClosureDate = async () => {
    if (!selectedFinding) return;
    const dateToUse = customClosedDate ? new Date(customClosedDate) : new Date();
    const result = await FindingService.updateFindingClosure(
      selectedFinding.id,
      user,
      supervisorComments,
      dateToUse
    );
    setIsEditingClosedDate(false);
    showToast("Fecha de Cierre Actualizada", "La fecha y hora de solución del hallazgo se actualizó correctamente.", "success");
  };

  const handleSetInReview = async () => {
    if (!selectedFinding) return;
    const resultStatus = await FindingService.transitionStatus(selectedFinding.id, 'InReview', user, supervisorComments);

    // Notify operator
    await addDoc(collection(db, 'notifications'), {
      title: 'Hallazgo en Revisión',
      message: `Tu hallazgo en ${selectedFinding.areaName} está siendo revisado.`,
      type: 'Finding',
      targetRole: 'Operador',
      scheduledAt: serverTimestamp(),
      status: 'Sent',
      createdBy: user.uid,
      createdAt: serverTimestamp(),
      referenceId: selectedFinding.id,
      plantId: selectedFinding.plantId
    });

    setSelectedFinding(null);
    setSupervisorComments('');
    
    if (resultStatus.queued) {
      showToast("Revisión Encolada", "Estado 'En Revisión' encolado localmente.", "warning");
    } else {
      showToast("Hallazgo en Revisión", "El hallazgo ha sido marcado en revisión.", "info");
    }
  };

  const handleDeleteFinding = async () => {
    if (!selectedFinding) return;
    
    try {
      await FindingService.deleteFinding(selectedFinding.id);
      setSelectedFinding(null);
      setIsConfirmingDelete(false);
      showToast("Hallazgo Eliminado", "El hallazgo ha sido eliminado correctamente.", "success");
    } catch (err) {
      console.error("Error deleting finding:", err);
      showToast("Error", "Error al eliminar el hallazgo.", "error");
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-4">
      <PushNotificationWidget user={user} />
      {/* Header Banner Card for Panel VOSO Administrador - Responsive & Adaptable Design */}
      <div className="relative overflow-hidden rounded-3xl sm:rounded-[2rem] border border-emerald-500/30 bg-gradient-to-br from-[#061810] via-[#0B251A] to-[#04120B] p-5 sm:p-6 lg:p-7 text-white shadow-xl shadow-emerald-950/25 transition-all">
        {/* Ambient Lights & Tech Grid */}
        <div className="absolute -top-24 -right-24 w-80 h-80 bg-emerald-500/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-80 h-80 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none" />

        <div className="relative z-10 flex flex-col xl:flex-row xl:items-center justify-between gap-6 min-w-0">
          {/* Main Info Column */}
          <div className="space-y-3 min-w-0 flex-1">
            {/* Badges / Context Pills */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-3 py-1 bg-emerald-500/25 border border-emerald-400/35 text-emerald-200 rounded-full text-[10px] sm:text-xs font-black uppercase tracking-widest flex items-center gap-1.5 shrink-0 shadow-xs">
                <Activity className="w-3.5 h-3.5 text-emerald-300 animate-pulse shrink-0" />
                Módulo VOSO Admin
              </span>
              <span className="px-2.5 py-1 bg-white/10 border border-white/15 text-white/95 rounded-full text-[10px] sm:text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 shrink-0">
                <MapPin className="w-3 h-3 text-emerald-300 shrink-0" />
                {user.plantId || 'Todas las Plantas'}
              </span>
              <span className="hidden sm:inline-flex px-2.5 py-1 bg-white/5 border border-white/10 text-emerald-200/80 rounded-full text-[10px] font-semibold tracking-wide items-center gap-1 shrink-0">
                <Shield className="w-3 h-3 text-amber-400 shrink-0" />
                {user.role}
              </span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-500/10 border border-emerald-400/20 text-emerald-300 text-[10px] font-bold rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping shrink-0" />
                Monitoreo Activo
              </span>
            </div>

            {/* Title & Methodology */}
            <div>
              <h2 className="text-xl sm:text-2xl lg:text-3xl font-black uppercase tracking-tight text-white leading-tight break-normal">
                Panel VOSO <span className="text-emerald-400 font-extrabold text-base sm:text-xl lg:text-2xl tracking-normal normal-case ml-1.5 opacity-90">(Ver • Oír • Sentir • Oler)</span>
              </h2>
              <p className="text-xs sm:text-sm text-emerald-100/80 font-normal max-w-2xl leading-relaxed mt-1">
                Consolidador de hallazgos en terreno, indicadores de criticidad y seguimiento de acciones correctivas en tiempo real.
              </p>
            </div>
          </div>

          {/* Adaptable Right Column: Telemetry & Actions */}
          <div className="w-full xl:w-auto shrink-0 flex flex-col sm:flex-row xl:flex-col items-stretch sm:items-center xl:items-end justify-between xl:justify-center gap-3 pt-4 xl:pt-0 border-t xl:border-t-0 border-emerald-500/20">
            {/* Quick Metrics / Telemetry Badges */}
            <div className="grid grid-cols-2 sm:flex sm:items-center gap-2 sm:gap-2.5 w-full sm:w-auto">
              <div className="px-3 sm:px-3.5 py-2 sm:py-2.5 bg-white/10 dark:bg-black/40 hover:bg-white/15 dark:hover:bg-black/50 backdrop-blur-md rounded-2xl border border-white/15 flex items-center gap-2.5 shadow-xs transition-colors min-w-0 sm:min-w-[130px]">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/25 border border-emerald-400/30 text-emerald-300 flex items-center justify-center shrink-0 shadow-xs">
                  <Activity className="w-4 h-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <span className="text-[9px] font-black uppercase text-emerald-300/90 tracking-wider block leading-none truncate">Registros</span>
                  <span className="text-xs sm:text-sm font-black text-white leading-none mt-1 inline-block truncate">{activeModuleFindings.length} Hallazgos</span>
                </div>
              </div>

              <div className="px-3 sm:px-3.5 py-2 sm:py-2.5 bg-white/10 dark:bg-black/40 hover:bg-white/15 dark:hover:bg-black/50 backdrop-blur-md rounded-2xl border border-white/15 flex items-center gap-2.5 shadow-xs transition-colors min-w-0 sm:min-w-[130px]">
                <div className="w-8 h-8 rounded-xl bg-amber-500/25 border border-amber-400/30 text-amber-300 flex items-center justify-center shrink-0 shadow-xs">
                  <HardHat className="w-4 h-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <span className="text-[9px] font-black uppercase text-emerald-300/90 tracking-wider block leading-none truncate">Administrador</span>
                  <span className="text-xs sm:text-sm font-black text-white leading-none mt-1 inline-block truncate max-w-[160px]" title={user.name}>{user.name}</span>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2 sm:gap-2.5 w-full sm:w-auto">
              {onStartOperatorInspection && (
                <button
                  type="button"
                  onClick={onStartOperatorInspection}
                  className="flex-1 sm:flex-initial h-10 sm:h-11 px-3.5 sm:px-4.5 bg-gradient-to-r from-sky-500 via-blue-600 to-indigo-600 hover:from-sky-400 hover:to-blue-500 active:scale-95 text-white text-xs sm:text-xs font-black uppercase tracking-wider rounded-xl shadow-lg shadow-sky-500/25 border border-sky-400/30 flex items-center justify-center gap-2 transition-all cursor-pointer whitespace-nowrap group"
                  title="Cambiar a Vista de Operador Mantenedor para realizar la ronda de inspección"
                >
                  <HardHat className="w-4 h-4 text-white shrink-0 group-hover:rotate-6 transition-transform" />
                  <span className="sm:hidden">Ronda Inspección</span>
                  <span className="hidden sm:inline">Ronda de Inspección (Modo Operador)</span>
                </button>
              )}
              <button
                onClick={() => setShowQuickHelp(true)}
                className="h-10 sm:h-11 px-3 sm:px-3.5 bg-white/10 hover:bg-white/20 active:scale-95 backdrop-blur-md rounded-xl border border-white/20 text-white text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all cursor-pointer whitespace-nowrap shadow-xs shrink-0"
                title="Ayuda rápida del módulo"
              >
                <HelpCircle className="w-4 h-4 text-emerald-300 shrink-0" />
                <span className="hidden sm:inline">Ayuda rápida</span>
                <span className="sm:hidden">Ayuda</span>
              </button>
            </div>
          </div>
        </div>
      </div>

        {/* Global Statistics */}
        <SupervisorStats findings={activeModuleFindings} />

        {/* Advanced Filters Panel */}
        <div className="bg-white dark:bg-zinc-900 p-6 rounded-3xl border border-zinc-100 dark:border-white/10 shadow-sm dark:shadow-none space-y-4 mb-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-zinc-100 dark:border-white/5">
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-bold text-zinc-900 dark:text-white uppercase tracking-widest">Módulo de Inspección:</h4>
              <div className="flex bg-zinc-100 dark:bg-zinc-950 p-1 rounded-xl border border-zinc-200/50 dark:border-white/5 gap-1">
                <button
                  type="button"
                  onClick={() => setModuleFilter('ALL')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase transition-all cursor-pointer ${
                    moduleFilter === 'ALL'
                      ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 shadow-xs'
                      : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
                  }`}
                >
                  📋 General (Todos)
                </button>
                <button
                  type="button"
                  onClick={() => setModuleFilter('VOSO')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase transition-all cursor-pointer ${
                    moduleFilter === 'VOSO'
                      ? 'bg-brand-blue text-white shadow-xs'
                      : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
                  }`}
                >
                  👁️ Metodología VOSO
                </button>
                <button
                  type="button"
                  onClick={() => setModuleFilter('OrdenYLimpieza')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase transition-all cursor-pointer ${
                    moduleFilter === 'OrdenYLimpieza'
                      ? 'bg-purple-600 text-white shadow-xs'
                      : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
                  }`}
                >
                  ✨ Orden y Limpieza
                </button>
              </div>
            </div>

            <button onClick={clearFilters} className="text-[10px] font-bold text-zinc-400 hover:text-zinc-900 dark:hover:text-white uppercase tracking-widest transition-colors self-end sm:self-center">
              Limpiar Filtros
            </button>
          </div>
          
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase ml-1">Rango de Fecha</label>
                <div className="flex flex-col sm:flex-row items-center gap-2">
                  <input 
                    type="date" 
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full p-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-100 dark:border-white/10 rounded-xl text-xs outline-none focus:ring-2 focus:ring-brand-blue text-zinc-900 dark:text-zinc-100"
                  />
                  <span className="text-zinc-300 dark:text-zinc-700 hidden sm:block">-</span>
                  <input 
                    type="date" 
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full p-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-100 dark:border-white/10 rounded-xl text-xs outline-none focus:ring-2 focus:ring-brand-blue text-zinc-900 dark:text-zinc-100"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase ml-1">Operador</label>
                <select 
                  value={operatorFilter}
                  onChange={(e) => setOperatorFilter(e.target.value)}
                  className="w-full p-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-100 dark:border-white/10 rounded-xl text-xs outline-none focus:ring-2 focus:ring-brand-blue appearance-none text-zinc-900 dark:text-zinc-100 font-bold"
                >
                  <option value="All" className="dark:bg-zinc-900">Todos los Operadores</option>
                  {uniqueOperators.map((op, idx) => (
                    <option key={`op-opt-${op}-${idx}`} value={op} className="dark:bg-zinc-900">{op}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-1.5 pt-4 border-t border-zinc-100 dark:border-white/5">
              <label className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase ml-1">Estado de Hallazgos</label>
              <div className="flex bg-zinc-100 dark:bg-zinc-950 p-1 rounded-xl border border-zinc-100 dark:border-white/5 gap-1">
                {(['Open', 'InReview', 'Closed', 'All'] as const).map((f, fIdx) => (
                  <button
                    key={`filter-tab-${f}-${fIdx}`}
                    onClick={() => setFilter(f)}
                    className={`flex-1 py-2 text-center rounded-lg text-xs font-bold transition-all ${
                      filter === f 
                        ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-xs' 
                        : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200'
                    }`}
                  >
                    {f === 'Open' ? 'Pendientes' : f === 'InReview' ? 'En Revisión' : f === 'Closed' ? 'Cerrados' : 'Todos'}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
            <input 
              type="text"
              placeholder="Buscar por área, descripción u operador..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-11 pr-4 py-3 bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-white/10 rounded-2xl outline-none focus:ring-2 focus:ring-brand-blue shadow-sm dark:shadow-none transition-all text-sm text-zinc-900 dark:text-zinc-100 placeholder-zinc-400"
            />
          </div>
          {(startDate || endDate || operatorFilter !== 'All') && !showFilters && (
            <div className="flex flex-wrap gap-2 px-1">
              {startDate && <span className="bg-zinc-100 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 border border-transparent dark:border-white/10 px-2 py-1 rounded-lg text-[10px] font-bold uppercase">Desde: {startDate}</span>}
              {endDate && <span className="bg-zinc-100 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 border border-transparent dark:border-white/10 px-2 py-1 rounded-lg text-[10px] font-bold uppercase">Hasta: {endDate}</span>}
              {operatorFilter !== 'All' && <span className="bg-zinc-100 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 border border-transparent dark:border-white/10 px-2 py-1 rounded-lg text-[10px] font-bold uppercase">Op: {operatorFilter}</span>}
              <button 
                onClick={clearFilters}
                className="text-[10px] font-bold text-brand-blue hover:underline"
              >
                Limpiar todo
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="grid gap-4">
        <AnimatePresence>
          {filteredFindings.map((finding, index) => (
            <motion.div
              layout
              key={`find-card-${finding.id}-${index}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onClick={() => setSelectedFinding(finding)}
              className="bg-white dark:bg-black p-4 rounded-2xl border border-zinc-100 dark:border-white/10 shadow-sm dark:shadow-none hover:shadow-md dark:hover:shadow-none transition-all cursor-pointer group"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                    finding.status === 'Open' ? 'bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400' : 
                    finding.status === 'InReview' ? 'bg-orange-50 dark:bg-orange-500/10 text-orange-600 dark:text-orange-400' :
                    'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                  }`}>
                    {finding.status === 'Open' ? <AlertCircle className="w-5 h-5" /> : 
                     finding.status === 'InReview' ? <Clock className="w-5 h-5" /> :
                     <CheckCircle2 className="w-5 h-5" />}
                  </div>
                  <div>
                    <h4 className="font-bold text-zinc-900 dark:text-white uppercase tracking-tight leading-tighter mb-0.5">
                      {finding.equipmentName || finding.equipmentId || finding.areaName || 'Sin Equipo'}
                    </h4>
                    <p className="text-[10px] font-black text-zinc-400 dark:text-zinc-600 uppercase tracking-widest">
                      {finding.equipmentName && finding.areaName && finding.equipmentName !== finding.areaName ? `${finding.areaName} • ` : ''}
                      {getFindingDate(finding) ? format(getFindingDate(finding)!, 'EEE dd MMM, HH:mm', { locale: es }) : 'Recién'}
                    </p>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-zinc-300 dark:text-zinc-800 group-hover:text-zinc-900 dark:group-hover:text-white transition-colors" />
              </div>
              <p className="text-sm text-zinc-600 dark:text-zinc-400 line-clamp-2 font-medium">{finding.description}</p>
              <div className="mt-4 pt-3 border-t border-zinc-50 dark:border-white/5 flex items-center justify-between gap-4">
                <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400 dark:text-zinc-600 truncate flex-1">Por: {finding.operatorName}</span>
                <FindingPhotoThumbnails
                  photos={extractFindingPhotos(finding)}
                  onSelectPhoto={() => setSelectedFinding(finding)}
                  size="sm"
                />
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
        
        {filteredFindings.length === 0 && (
          <div className="text-center py-12 text-zinc-400">
            <LayoutDashboard className="w-12 h-12 mx-auto mb-4 opacity-20" />
            <p>No hay hallazgos en esta categoría</p>
          </div>
        )}
      </div>

      <AnimatePresence>
        {selectedFinding && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 md:p-6 overflow-y-auto">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }}
              onClick={() => setSelectedFinding(null)}
              className="fixed inset-0 bg-zinc-900/70 backdrop-blur-sm" 
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 15 }} 
              animate={{ opacity: 1, scale: 1, y: 0 }} 
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="relative w-full max-w-lg sm:max-w-5xl bg-white dark:bg-black rounded-3xl sm:rounded-[2.5rem] overflow-hidden shadow-2xl dark:shadow-none flex flex-col sm:flex-row max-h-[88vh] sm:max-h-[90vh] border border-zinc-100 dark:border-white/10 my-auto z-10"
            >
              <div className="h-56 sm:h-auto sm:min-h-[380px] sm:w-1/2 shrink-0 relative bg-zinc-950 flex flex-col">
                <FindingPhotoGallery 
                  photos={extractFindingPhotos(selectedFinding)} 
                  altPrefix={selectedFinding.equipmentName || selectedFinding.areaName || 'Hallazgo'}
                  showCloseButton
                  onClose={() => setSelectedFinding(null)}
                />
              </div>
              <div className="flex-1 overflow-y-auto p-4 sm:p-8 md:p-10 space-y-4 sm:space-y-6 custom-scrollbar dark:bg-zinc-950/20">
                <div>
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className={`px-2.5 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider ${
                      isVOSOFinding(selectedFinding)
                        ? 'bg-sky-100 dark:bg-sky-500/20 text-sky-800 dark:text-sky-300 border border-sky-300 dark:border-sky-700/50'
                        : 'bg-purple-100 dark:bg-purple-500/20 text-purple-800 dark:text-purple-300 border border-purple-300 dark:border-purple-700/50'
                    }`}>
                      {isVOSOFinding(selectedFinding) ? '👁️ Metodología VOSO' : '✨ Orden y Limpieza'}
                    </span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest ${
                      selectedFinding.status === 'Open' ? 'bg-amber-100 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400' : 
                      selectedFinding.status === 'InReview' ? 'bg-orange-100 dark:bg-orange-500/10 text-orange-700 dark:text-orange-400' :
                      'bg-emerald-100 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                    }`}>
                      {selectedFinding.status === 'Open' ? 'Abierto' : 
                       selectedFinding.status === 'InReview' ? 'En Revisión' : 
                       'Cerrado'}
                    </span>
                    <span className="text-[10px] font-black text-zinc-400 dark:text-zinc-600 uppercase tracking-widest leading-none">
                      {selectedFinding.equipmentName || selectedFinding.equipmentId || selectedFinding.areaName || 'Sin Equipo'}
                    </span>
                    <OperatingStatusBadge finding={selectedFinding} size="sm" />
                  </div>
                  <div className="mt-3 pt-3 border-t border-zinc-100 dark:border-white/10 space-y-3">
                    <FindingDescriptionRenderer 
                      description={selectedFinding.description} 
                      source={selectedFinding.source || selectedFinding.category} 
                      filterModule={moduleFilter === 'ALL' ? (isVOSOFinding(selectedFinding) ? 'VOSO' : 'OrdenYLimpieza') : moduleFilter}
                      onSolveItem={async (item, solutionText, solutionDate) => {
                        if (!selectedFinding) return;
                        try {
                          const solDate = solutionDate || new Date();
                          const { newDescription, isFullyClosed } = await FindingService.solveFindingItem(
                            selectedFinding.id,
                            selectedFinding.description,
                            item.category,
                            item.rawTitle,
                            solutionText,
                            user,
                            solDate
                          );

                          setSelectedFinding(prev => prev ? {
                            ...prev,
                            description: newDescription,
                            status: isFullyClosed ? 'Closed' : 'InReview',
                            solution: isFullyClosed ? solutionText : prev.solution,
                            closedAt: isFullyClosed ? solDate : prev.closedAt
                          } : null);

                          showToast("Solución Registrada", `Se registró la solución para "${item.rawTitle}"`, "success");
                        } catch (err: any) {
                          showToast("Error", `No se pudo registrar la solución: ${err.message}`, "error");
                        }
                      }}
                    />

                    {extractFindingPhotos(selectedFinding).length === 0 && (
                      <div className="p-3.5 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-500/30 rounded-2xl space-y-2">
                        <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
                          <AlertCircle className="w-4 h-4 shrink-0" />
                          <span className="text-[11px] font-bold uppercase tracking-wider">Hallazgo pasado sin foto evidencia</span>
                        </div>
                        <p className="text-[10px] text-zinc-600 dark:text-zinc-400 font-medium">
                          Este hallazgo reportado anteriormente no incluye evidencia fotográfica. Adjunta la foto para completar el reporte.
                        </p>
                        <input 
                          type="file" 
                          accept="image/*" 
                          id={`attach-photo-app-${selectedFinding.id}`}
                          className="hidden"
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              try {
                                const res = await FindingService.attachPhotoToFinding(selectedFinding.id, file, user);
                                setSelectedFinding({
                                  ...selectedFinding,
                                  photoUrl: res.photoUrl,
                                  photoUrls: [res.photoUrl]
                                });
                                showToast("Foto Adjuntada", "Foto evidencia adjuntada exitosamente al hallazgo.", "success");
                              } catch (err: any) {
                                showToast("Error", `Error al subir foto: ${err.message}`, "error");
                              }
                            }
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => document.getElementById(`attach-photo-app-${selectedFinding.id}`)?.click()}
                          className="w-full py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm"
                        >
                          <Camera className="w-4 h-4" />
                          <span>Adjuntar Foto Evidencia</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {selectedFinding.status !== 'Closed' ? (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-[10px] font-black text-zinc-700 dark:text-zinc-500 uppercase tracking-widest mb-1 ml-1">Comentarios del Supervisor</label>
                      <textarea 
                        value={supervisorComments}
                        onChange={(e) => setSupervisorComments(e.target.value)}
                        className="w-full p-4 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-white/5 rounded-2xl focus:ring-2 focus:ring-zinc-900 dark:focus:ring-white outline-none transition-all dark:text-white font-medium"
                        placeholder="Instrucciones o notas de cierre..."
                      />
                    </div>

                    {/* Resolution Date & Time (MTTR Adjustment) */}
                    <div className="bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-500/20 p-4 rounded-2xl space-y-3">
                      <div 
                        className="flex items-center justify-between cursor-pointer select-none" 
                        onClick={() => setUseCustomClosedDate(!useCustomClosedDate)}
                      >
                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                          <span className="text-xs font-bold text-amber-900 dark:text-amber-200">
                            ¿Ajustar fecha/hora de solución? (Cierre retroactivo)
                          </span>
                        </div>
                        <input 
                          type="checkbox" 
                          checked={useCustomClosedDate}
                          onChange={(e) => setUseCustomClosedDate(e.target.checked)}
                          className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500 cursor-pointer"
                        />
                      </div>

                      {useCustomClosedDate ? (
                        <div className="space-y-3 pt-2 border-t border-amber-200/50 dark:border-amber-500/10">
                          <p className="text-[11px] text-amber-800 dark:text-amber-300 font-medium">
                            Indica cuándo se solucionó realmente en terreno para mantener el cálculo de MTTR preciso sin retrasos ficticios.
                          </p>

                          <div>
                            <label className="block text-[10px] font-black text-amber-900 dark:text-amber-300 uppercase tracking-widest mb-1">
                              Fecha y Hora de Solución
                            </label>
                            <input 
                              type="datetime-local"
                              value={customClosedDate}
                              onChange={(e) => setCustomClosedDate(e.target.value)}
                              max={formatToDatetimeLocal(new Date())}
                              className="w-full p-3 bg-white dark:bg-zinc-900 border border-amber-300 dark:border-amber-500/30 rounded-xl text-xs font-bold text-zinc-900 dark:text-white outline-none focus:ring-2 focus:ring-amber-500"
                            />
                          </div>

                          {/* Quick Presets */}
                          <div className="flex flex-wrap gap-1.5 pt-1">
                            <button
                              type="button"
                              onClick={() => setCustomClosedDate(formatToDatetimeLocal(new Date()))}
                              className="px-2.5 py-1 text-[10px] font-bold bg-white dark:bg-zinc-900 hover:bg-amber-100 dark:hover:bg-amber-900/40 text-amber-900 dark:text-amber-200 border border-amber-200 dark:border-amber-800/50 rounded-lg transition-colors"
                            >
                              ⚡ Ahora mismo
                            </button>
                            <button
                              type="button"
                              onClick={() => setCustomClosedDate(formatToDatetimeLocal(new Date(Date.now() - 3600 * 1000)))}
                              className="px-2.5 py-1 text-[10px] font-bold bg-white dark:bg-zinc-900 hover:bg-amber-100 dark:hover:bg-amber-900/40 text-amber-900 dark:text-amber-200 border border-amber-200 dark:border-amber-800/50 rounded-lg transition-colors"
                            >
                              ⏱️ Hace 1 hr
                            </button>
                            <button
                              type="button"
                              onClick={() => setCustomClosedDate(formatToDatetimeLocal(new Date(Date.now() - 4 * 3600 * 1000)))}
                              className="px-2.5 py-1 text-[10px] font-bold bg-white dark:bg-zinc-900 hover:bg-amber-100 dark:hover:bg-amber-900/40 text-amber-900 dark:text-amber-200 border border-amber-200 dark:border-amber-800/50 rounded-lg transition-colors"
                            >
                              🕒 Hace 4 hrs
                            </button>
                            <button
                              type="button"
                              onClick={() => setCustomClosedDate(formatToDatetimeLocal(new Date(Date.now() - 24 * 3600 * 1000)))}
                              className="px-2.5 py-1 text-[10px] font-bold bg-white dark:bg-zinc-900 hover:bg-amber-100 dark:hover:bg-amber-900/40 text-amber-900 dark:text-amber-200 border border-amber-200 dark:border-amber-800/50 rounded-lg transition-colors"
                            >
                              📅 Ayer
                            </button>
                            {getFindingDate(selectedFinding) && (
                              <button
                                type="button"
                                onClick={() => setCustomClosedDate(formatToDatetimeLocal(getFindingDate(selectedFinding)))}
                                className="px-2.5 py-1 text-[10px] font-bold bg-white dark:bg-zinc-900 hover:bg-amber-100 dark:hover:bg-amber-900/40 text-amber-900 dark:text-amber-200 border border-amber-200 dark:border-amber-800/50 rounded-lg transition-colors"
                              >
                                📋 Hora de reporte
                              </button>
                            )}
                          </div>

                          {/* Dynamic MTTR Preview */}
                          {getFindingDate(selectedFinding) && customClosedDate && (
                            <div className="p-2.5 bg-amber-100/70 dark:bg-amber-900/40 rounded-xl text-[11px] font-bold text-amber-950 dark:text-amber-200 flex items-center justify-between">
                              <span>MTTR Resultante:</span>
                              <span className="font-mono">{getCalculatedMTTRText(getFindingDate(selectedFinding)!, customClosedDate)}</span>
                            </div>
                          )}
                        </div>
                      ) : (
                        <p className="text-[11px] text-amber-800/80 dark:text-amber-300/80 italic">
                          Se utilizará la fecha y hora actual al presionar "Cerrar Hallazgo".
                        </p>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <button 
                        onClick={handleSetInReview}
                        disabled={selectedFinding.status === 'InReview'}
                        className={`py-4 rounded-2xl font-black uppercase tracking-widest text-xs transition-all border ${
                          selectedFinding.status === 'InReview' 
                            ? 'bg-zinc-100 dark:bg-zinc-900 text-zinc-400 dark:text-zinc-700 border-transparent cursor-not-allowed'
                            : 'bg-white dark:bg-black border-orange-200 dark:border-orange-500/20 text-orange-600 dark:text-orange-500 hover:bg-orange-50 dark:hover:bg-orange-500/10'
                        }`}
                      >
                        Poner en Revisión
                      </button>
                      <button 
                        onClick={handleCloseFinding}
                        className="py-4 bg-zinc-900 dark:bg-white text-white dark:text-black rounded-2xl font-black uppercase tracking-widest text-xs hover:opacity-90 transition-colors shadow-lg shadow-zinc-200 dark:shadow-none"
                      >
                        Cerrar Hallazgo
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="bg-zinc-50 dark:bg-zinc-900 p-4 rounded-2xl space-y-3 border border-zinc-100 dark:border-white/5">
                    <div>
                      <p className="text-[10px] font-black text-zinc-400 dark:text-zinc-600 uppercase tracking-widest">Solución Aplicada</p>
                      <p className="text-zinc-700 dark:text-zinc-300 font-medium">{selectedFinding.solution || 'Cerrado por supervisor'}</p>
                    </div>

                    <div className="pt-2 border-t border-zinc-200/60 dark:border-white/5 flex items-center justify-between">
                      <div>
                        <p className="text-[10px] font-black text-zinc-400 dark:text-zinc-600 uppercase tracking-widest">Fecha / Hora de Solución</p>
                        <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                          {getFindingClosedDate(selectedFinding) ? getFindingClosedDate(selectedFinding)!.toLocaleString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'No especificada'}
                        </p>
                        {getFindingDate(selectedFinding) && getFindingClosedDate(selectedFinding) && (
                          <p className="text-[10px] text-zinc-500 dark:text-zinc-400 font-medium">
                            MTTR: {getCalculatedMTTRText(getFindingDate(selectedFinding)!, getFindingClosedDate(selectedFinding))}
                          </p>
                        )}
                      </div>
                      
                      <button
                        type="button"
                        onClick={() => setIsEditingClosedDate(!isEditingClosedDate)}
                        className="px-3 py-1.5 bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 text-[11px] font-bold rounded-xl transition-colors"
                      >
                        {isEditingClosedDate ? 'Cancelar' : '✏️ Editar Fecha'}
                      </button>
                    </div>

                    {isEditingClosedDate && (
                      <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-500/20 rounded-xl space-y-2">
                        <label className="block text-[10px] font-black text-amber-900 dark:text-amber-300 uppercase">Nueva Fecha y Hora de Solución:</label>
                        <input 
                          type="datetime-local"
                          value={customClosedDate}
                          onChange={(e) => setCustomClosedDate(e.target.value)}
                          className="w-full p-2.5 bg-white dark:bg-zinc-900 border border-amber-300 dark:border-amber-500/30 rounded-lg text-xs font-bold dark:text-white"
                        />
                        <button
                          type="button"
                          onClick={handleUpdateClosureDate}
                          className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-xs uppercase"
                        >
                          Guardar Cambio de Fecha (Ajustar MTTR)
                        </button>
                      </div>
                    )}
                  </div>
                )}

                <div className="pt-3 border-t border-zinc-100 dark:border-white/10 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const opProf = getOperatorProfile(selectedFinding.operatorId, selectedFinding.operatorName, selectedFinding.operatorPhotoUrl);
                      downloadOperatorInspectionPDF(selectedFinding, {
                        name: selectedFinding.operatorName || opProf.name,
                        photoUrl: opProf.photoUrl || selectedFinding.operatorPhotoUrl,
                        rut: opProf.rut,
                        cargo: opProf.cargo
                      });
                    }}
                    className="w-full py-3.5 px-3 bg-gradient-to-r from-sky-600 to-sky-700 hover:from-sky-500 hover:to-sky-600 text-white rounded-2xl font-black text-xs uppercase tracking-wider transition-all shadow-md active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    <span>Descargar PDF</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      const opProf = getOperatorProfile(selectedFinding.operatorId, selectedFinding.operatorName, selectedFinding.operatorPhotoUrl);
                      shareOperatorInspectionPDF(selectedFinding, {
                        name: selectedFinding.operatorName || opProf.name,
                        photoUrl: opProf.photoUrl || selectedFinding.operatorPhotoUrl,
                        rut: opProf.rut,
                        cargo: opProf.cargo
                      });
                    }}
                    className="w-full py-3.5 px-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-2xl font-black text-xs uppercase tracking-wider transition-all shadow-md active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Share2 className="w-4 h-4" />
                    <span>Compartir PDF</span>
                  </button>
                </div>

                {(user.role === 'Administrador' || user.role === 'Supervisor') && (
                  <div className="pt-4 border-t border-zinc-100 font-sans">
                    {isConfirmingDelete ? (
                      <div className="flex flex-col gap-3 p-4 bg-red-50 rounded-2xl border border-red-100 animate-in fade-in slide-in-from-bottom-2">
                        <p className="text-xs font-bold text-red-600 text-center uppercase tracking-widest">¿Confirmar eliminación permanente?</p>
                        <div className="flex gap-2">
                          <button 
                            onClick={handleDeleteFinding}
                            className="flex-1 py-3 bg-red-500 text-white rounded-xl font-bold text-sm shadow-md shadow-red-100 dark:shadow-none active:scale-95 transition-all"
                          >
                            Sí, Eliminar
                          </button>
                          <button 
                            onClick={() => setIsConfirmingDelete(false)}
                            className="flex-1 py-3 bg-zinc-200 text-zinc-600 rounded-xl font-bold text-sm active:scale-95 transition-all"
                          >
                            Cancelar
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button 
                        onClick={() => setIsConfirmingDelete(true)}
                        className="w-full py-3 flex items-center justify-center gap-2 text-red-500 hover:bg-red-50 rounded-2xl transition-all font-bold text-sm"
                      >
                        <Trash2 className="w-4 h-4" />
                        <span>Eliminar Hallazgo Permanentemente</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      <QuickHelpModal
        isOpen={showQuickHelp}
        onClose={() => setShowQuickHelp(false)}
        moduleKey="VOSO"
      />
    </div>
  );
};

// --- Components ---

const VOSO_ICONS: Record<string, any> = {
  'VER': Eye,
  'OÍR': Ear,
  'SENTIR': Hand,
  'OLER': Wind,
  'ORDEN': Sparkles
};

// FindingDescriptionRenderer is imported from ./components/FindingDescriptionRenderer


// --- Reports View ---

const ReportsView = ({ 
  user, 
  initialFindingId, 
  onClearPending 
}: { 
  user: AppUser, 
  initialFindingId?: string | null, 
  onClearPending?: () => void 
}) => {
  const [findings, setFindings] = useState<Finding[]>([]);
  const [moduleTab, setModuleTab] = useState<'ALL' | 'VOSO' | 'OrdenYLimpieza'>('ALL');
  const [historySearchQuery, setHistorySearchQuery] = useState<string>('');
  const [historyEquipmentFilter, setHistoryEquipmentFilter] = useState<string>('ALL');
  const [confirmingDelete, setConfirmingDelete] = useState<string | null>(null);
  const [selectedFinding, setSelectedFinding] = useState<Finding | null>(null);
  const [sortConfig, setSortConfig] = useState<{ key: keyof Finding; direction: 'asc' | 'desc' } | null>({
    key: 'createdAt',
    direction: 'desc'
  });
  const [subTab, setSubTab] = useState<'active' | 'closed' | 'user_rounds'>('active');
  const [selectedUserFilter, setSelectedUserFilter] = useState<string>('ALL');
  const [userSearchQuery, setUserSearchQuery] = useState<string>('');
  const { getOperatorProfile } = useAppUsers();

  const uniqueEquipments = React.useMemo(() => {
    const set = new Set<string>();
    findings.forEach(f => {
      const eq = f.equipmentName || f.equipmentId || f.areaName;
      if (eq) set.add(eq);
    });
    return Array.from(set).sort();
  }, [findings]);

  const moduleFindings = React.useMemo(() => {
    return findings.filter(f => {
      // 1. Module separation filter
      if (moduleTab === 'VOSO' && !isVOSOFinding(f)) return false;
      if (moduleTab === 'OrdenYLimpieza' && !isOrdenYLimpiezaFinding(f)) return false;

      // 2. Equipment / Area filter
      if (historyEquipmentFilter !== 'ALL') {
        const eq = f.equipmentName || f.equipmentId || f.areaName || '';
        if (eq !== historyEquipmentFilter) return false;
      }

      // 3. Search query filter
      if (historySearchQuery.trim()) {
        const q = historySearchQuery.toLowerCase();
        const descMatches = (f.description || '').toLowerCase().includes(q);
        const equipMatches = (f.equipmentName || '').toLowerCase().includes(q);
        const areaMatches = (f.areaName || '').toLowerCase().includes(q);
        const operatorMatches = (f.operatorName || '').toLowerCase().includes(q);
        if (!descMatches && !equipMatches && !areaMatches && !operatorMatches) return false;
      }

      return true;
    });
  }, [findings, moduleTab, historyEquipmentFilter, historySearchQuery]);

  const userStatsList = React.useMemo(() => {
    const statsMap: Record<string, {
      operatorName: string;
      operatorPhotoUrl?: string;
      operatorId?: string;
      rut?: string;
      cargo?: string;
      totalRounds: number;
      vosoRounds: number;
      ordenRounds: number;
      activeRounds: number;
      closedRounds: number;
      lastRoundDate: Date | null;
      findingsList: Finding[];
    }> = {};

    findings.forEach((f) => {
      const opName = (f.operatorName || 'Operador en Terreno').trim();
      const prof = getOperatorProfile(f.operatorId, opName);

      if (!statsMap[opName]) {
        statsMap[opName] = {
          operatorName: opName,
          operatorPhotoUrl: prof.photoUrl,
          operatorId: f.operatorId,
          rut: prof.rut,
          cargo: prof.cargo,
          totalRounds: 0,
          vosoRounds: 0,
          ordenRounds: 0,
          activeRounds: 0,
          closedRounds: 0,
          lastRoundDate: null,
          findingsList: []
        };
      } else if (!statsMap[opName].operatorPhotoUrl && prof.photoUrl) {
        statsMap[opName].operatorPhotoUrl = prof.photoUrl;
      }

      const record = statsMap[opName];
      record.totalRounds += 1;
      if (isVOSOFinding(f)) record.vosoRounds += 1;
      if (isOrdenYLimpiezaFinding(f)) record.ordenRounds += 1;
      if (f.status === 'Closed') record.closedRounds += 1;
      else record.activeRounds += 1;

      record.findingsList.push(f);

      const fDate = getFindingDate(f);
      if (fDate) {
        if (!record.lastRoundDate || fDate.getTime() > record.lastRoundDate.getTime()) {
          record.lastRoundDate = fDate;
        }
      }
    });

    return Object.values(statsMap).sort((a, b) => b.totalRounds - a.totalRounds);
  }, [findings, getOperatorProfile]);

  const stats = React.useMemo(() => {
    return {
      total: moduleFindings.length,
      open: moduleFindings.filter(f => f.status === 'Open').length,
      inReview: moduleFindings.filter(f => f.status === 'InReview').length,
      closed: moduleFindings.filter(f => f.status === 'Closed').length,
    };
  }, [moduleFindings]);

  const handleSort = (key: keyof Finding) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const sortedFindings = React.useMemo(() => {
    let sortableItems = [...moduleFindings];
    if (sortConfig !== null) {
      sortableItems.sort((a, b) => {
        const aValue = a[sortConfig.key];
        const bValue = b[sortConfig.key];

        if (aValue === undefined || bValue === undefined) return 0;

        // Handle timestamps
        if (sortConfig.key === 'createdAt' || sortConfig.key === 'closedAt') {
          const aTime = parseAnyDate(aValue)?.getTime() || 0;
          const bTime = parseAnyDate(bValue)?.getTime() || 0;
          return sortConfig.direction === 'asc' ? aTime - bTime : bTime - aTime;
        }

        // Handle strings
        if (typeof aValue === 'string' && typeof bValue === 'string') {
          return sortConfig.direction === 'asc' 
            ? aValue.localeCompare(bValue) 
            : bValue.localeCompare(aValue);
        }

        return 0;
      });
    }
    return sortableItems;
  }, [moduleFindings, sortConfig]);

  const activeFindingsList = React.useMemo(() => {
    return sortedFindings.filter(f => f.status !== 'Closed');
  }, [sortedFindings]);

  const closedFindingsList = React.useMemo(() => {
    return sortedFindings.filter(f => f.status === 'Closed');
  }, [sortedFindings]);

  useEffect(() => {
    // Elegant plant-scoped real-time listener using Enterprise FindingService
    const plantIdScope = user.role !== 'Administrador' ? user.plantId : undefined;
    return FindingService.subscribeToFindings((data) => {
      setFindings(data);
    }, plantIdScope);
  }, [user.uid, user.plantId, user.role]);

  useEffect(() => {
    if (initialFindingId && findings.length > 0) {
      const finding = findings.find(f => f.id === initialFindingId);
      if (finding) {
        setSelectedFinding(finding);
        if (onClearPending) onClearPending();
      }
    }
  }, [initialFindingId, findings, onClearPending]);

  const handleDelete = async (id: string) => {
    try {
      await FindingService.deleteFinding(id);
      setConfirmingDelete(null);
    } catch (err) {
      console.error("Error deleting finding:", err);
      alert("Error al eliminar el hallazgo. Revisa tus permisos.");
    }
  };

  const exportToPDF = async () => {
    if (moduleFindings.length === 0) {
      alert("No hay hallazgos para exportar en este momento.");
      return;
    }
    try {
      // Get settings
      const settingsDoc = await getDoc(doc(db, 'settings', 'reportConfig'));
      const sett = settingsDoc.exists() ? settingsDoc.data() as ReportSettings : {};

      const docPDF = new jsPDF();
      const reportTitle = moduleTab === 'VOSO' 
        ? 'Reporte de Inspecciones VOSO' 
        : moduleTab === 'OrdenYLimpieza' 
        ? 'Reporte de Orden y Limpieza (5S)' 
        : 'Reporte General de Inspecciones (VOSO y Orden & Limpieza)';
      
      // Header Banner with Chekify Brand Colors
      docPDF.setFillColor(15, 23, 42); // Chekify Deep Navy Slate background (#0F172A)
      docPDF.rect(0, 0, 210, 28, 'F');

      docPDF.setFillColor(14, 165, 233); // Chekify Sky-500 accent (#0EA5E9)
      docPDF.rect(0, 28, 210, 1.5, 'F');

      // Header Text & Company
      docPDF.setFontSize(13);
      docPDF.setFont('helvetica', 'bold');
      docPDF.setTextColor(255, 255, 255);
      docPDF.text(sanitizeForPDF(sett.companyName ? `${sett.companyName} - ${reportTitle}` : reportTitle, 40), 14, 13);
      
      docPDF.setFontSize(8.5);
      docPDF.setFont('helvetica', 'normal');
      docPDF.setTextColor(186, 230, 253); // Chekify Sky-200
      docPDF.text(sanitizeForPDF(sett.headerText || (moduleTab === 'VOSO' ? 'Sistema de Gestión de Inspecciones VOSO' : moduleTab === 'OrdenYLimpieza' ? 'Módulo de Orden y Limpieza 5S' : 'Consolidado General de Inspecciones'), 60), 14, 20.5);

      // White Chekify Logo
      const chekifyLogo = await getWhiteChekifyLogoBase64();
      let logoW = 34;
      if (chekifyLogo) {
        try {
          const hHeight = 13;
          logoW = Math.min(42, Math.max(26, hHeight * chekifyLogo.aspect));
          docPDF.addImage(chekifyLogo.dataUrl, 'PNG', 210 - 14 - logoW, (28 - hHeight) / 2, logoW, hHeight);
        } catch (e) {
          console.warn('Error embedding white Chekify logo in exportToPDF:', e);
        }
      }

      // Add Company Logo if configured
      if (sett.logoUrl) {
        try {
          docPDF.addImage(sett.logoUrl, 'JPEG', 210 - 14 - logoW - 20, 6, 16, 16);
        } catch (e) {
          console.error("Error adding logo to PDF", e);
        }
      }

      const tableData = moduleFindings.map(f => {
        let tag = (f as any).equipmentTag || (f as any).tag || '';
        if (!tag && f.equipmentName) {
          const match = f.equipmentName.match(/\(([^)]+)\)$/);
          if (match && match[1]) tag = match[1].trim();
        }
        const cleanEquip = f.equipmentName ? f.equipmentName.replace(/\s*\([^)]+\)$/, '') : '';

        return [
          getFindingDate(f) ? format(getFindingDate(f)!, 'dd/MM/yy HH:mm') : '-',
          sanitizeForPDF(isVOSOFinding(f) ? 'VOSO' : '5S Orden'),
          sanitizeForPDF(f.areaName || 'General'),
          sanitizeForPDF(cleanEquip || 'General'),
          sanitizeForPDF(tag || 'S/N'),
          sanitizeForPDF(f.operatorName || f.inspector || 'Operador'),
          sanitizeForPDF(f.priority || 'Media'),
          sanitizeForPDF(f.description, 0),
          f.status === 'Open' ? 'Pendiente' : f.status === 'InReview' ? 'En Revisión' : 'Cerrado',
          f.closedAt?.toDate ? format(f.closedAt.toDate(), 'dd/MM/yy HH:mm') : '-'
        ];
      });

      autoTable(docPDF, {
        startY: 35,
        head: [['Fecha', 'Módulo', 'Área', 'Equipo', 'TAG', 'Operador', 'Prioridad', 'Descripción y Detalle', 'Estado', 'Cierre']],
        body: tableData,
        theme: 'grid',
        headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7.5, cellPadding: 2.5 },
        alternateRowStyles: { fillColor: [240, 249, 255] },
        styles: { fontSize: 7.5, cellPadding: 2.5, overflow: 'linebreak', lineColor: [226, 232, 240] },
        columnStyles: {
          0: { cellWidth: 18 },
          1: { cellWidth: 14 },
          2: { cellWidth: 18 },
          3: { cellWidth: 20 },
          4: { cellWidth: 15 },
          5: { cellWidth: 18 },
          6: { cellWidth: 14 },
          7: { cellWidth: 'auto' },
          8: { cellWidth: 15 },
          9: { cellWidth: 18 }
        },
        margin: { top: 35, left: 14, right: 14 }
      });

      // Footer
      const pageCount = (docPDF as any).internal.getNumberOfPages();
      for(let i = 1; i <= pageCount; i++) {
        docPDF.setPage(i);
        docPDF.setDrawColor(186, 230, 253);
        docPDF.setLineWidth(0.4);
        docPDF.line(14, docPDF.internal.pageSize.height - 12, docPDF.internal.pageSize.width - 14, docPDF.internal.pageSize.height - 12);

        docPDF.setFontSize(7.5);
        docPDF.setFont('helvetica', 'bold');
        docPDF.setTextColor(3, 105, 161);
        docPDF.text(
          sanitizeForPDF(sett.footerText || 'Chekify Enterprise - Reporte Oficial de Inspecciones.', 90),
          14, 
          docPDF.internal.pageSize.height - 6
        );

        docPDF.setFontSize(7.5);
        docPDF.setFont('helvetica', 'normal');
        docPDF.setTextColor(100, 116, 139);
        docPDF.text(`Página ${i} de ${pageCount}`, docPDF.internal.pageSize.width - 30, docPDF.internal.pageSize.height - 6);
      }

      const fileName = moduleTab === 'VOSO' ? 'reporte-voso' : moduleTab === 'OrdenYLimpieza' ? 'reporte-orden-limpieza' : 'reporte-general-inspecciones';
      docPDF.save(`${fileName}-${format(new Date(), 'yyyyMMdd')}.pdf`);
    } catch (err) {
      console.error("Error generating PDF", err);
      alert("Error al generar el PDF.");
    }
  };

  const exportToCSV = () => {
    const activeList = subTab === 'active' ? activeFindingsList : closedFindingsList;
    if (activeList.length === 0) {
      alert("No hay hallazgos filtrados para exportar en este momento.");
      return;
    }

    try {
      const headers = [
        "ID",
        "Modulo / Metodologia",
        "Fecha Reporte",
        "Planta ID",
        "Area",
        "Equipo",
        "Operador",
        "Descripcion / Hallazgo",
        "Prioridad",
        "Estado",
        "Hora Inicio Area",
        "Hora Fin Area",
        "Duracion Inspeccion Area (seg)",
        "Hora Inicio Equipo",
        "Hora Fin Equipo",
        "Duracion Inspeccion Equipo (seg)",
        "Fecha Cierre",
        "Horas de Cierre (MTTR)",
        "Comentarios Supervisor"
      ];

      const escapeCSVCell = (val: any) => {
        if (val === null || val === undefined) return '';
        let str = String(val);
        str = str.replace(/"/g, '""');
        if (str.includes(',') || str.includes('\n') || str.includes('\r') || str.includes('"')) {
          str = `"${str}"`;
        }
        return str;
      };

      const rows = [headers.join(",")];

      activeList.forEach((f) => {
        const fDate = getFindingDate(f);
        const createdAtStr = fDate ? format(fDate, 'dd/MM/yyyy HH:mm:ss') : '';
        const closedDate = getFindingClosedDate(f);
        const closedAtStr = closedDate ? format(closedDate, 'dd/MM/yyyy HH:mm:ss') : '';

        let resolutionHours = '';
        if (fDate && closedDate) {
          const createdTime = fDate.getTime();
          const closedTime = closedDate.getTime();
          if (createdTime && closedTime && closedTime >= createdTime) {
            resolutionHours = (Math.round((closedTime - createdTime) / (1000 * 60 * 60) * 10) / 10).toString();
          }
        }

        const areaStart = parseAnyDate(f.inspectionStartedAt);
        const areaEnd = parseAnyDate(f.inspectionCompletedAt);
        const equipStart = parseAnyDate(f.equipmentStartedAt);
        const equipEnd = parseAnyDate(f.equipmentCompletedAt);

        const areaStartStr = areaStart ? format(areaStart, 'HH:mm:ss') : '';
        const areaEndStr = areaEnd ? format(areaEnd, 'HH:mm:ss') : '';
        const equipStartStr = equipStart ? format(equipStart, 'HH:mm:ss') : '';
        const equipEndStr = equipEnd ? format(equipEnd, 'HH:mm:ss') : '';

        const row = [
          escapeCSVCell(f.id),
          escapeCSVCell(isVOSOFinding(f) ? 'VOSO' : 'Orden y Limpieza'),
          escapeCSVCell(createdAtStr),
          escapeCSVCell(f.plantId || ''),
          escapeCSVCell(f.areaName || 'Área General'),
          escapeCSVCell(f.equipmentName || 'Puntos Generales de Inspección'),
          escapeCSVCell(f.operatorName || ''),
          escapeCSVCell(f.description),
          escapeCSVCell(f.priority || 'N/A'),
          escapeCSVCell(f.status === 'Open' ? 'Abierto' : f.status === 'InReview' ? 'En Revision' : 'Cerrado'),
          escapeCSVCell(areaStartStr),
          escapeCSVCell(areaEndStr),
          escapeCSVCell(f.inspectionDurationSeconds !== undefined && f.inspectionDurationSeconds !== null ? f.inspectionDurationSeconds : ''),
          escapeCSVCell(equipStartStr),
          escapeCSVCell(equipEndStr),
          escapeCSVCell(f.equipmentDurationSeconds !== undefined && f.equipmentDurationSeconds !== null ? f.equipmentDurationSeconds : ''),
          escapeCSVCell(closedAtStr),
          escapeCSVCell(resolutionHours),
          escapeCSVCell(f.supervisorComments || f.solution || '')
        ];
        rows.push(row.join(","));
      });

      const csvContent = "\uFEFF" + rows.join("\n");
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      const filenameTag = moduleTab === 'VOSO' ? 'voso' : moduleTab === 'OrdenYLimpieza' ? 'orden-limpieza' : 'general';
      link.setAttribute("download", `reporte-inspecciones-${filenameTag}-${subTab}-${format(new Date(), 'yyyyMMdd_HHmmss')}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error("Error exporting to CSV:", err);
      alert("Error al exportar los datos a CSV.");
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h2 className="text-2xl font-bold text-zinc-900 dark:text-white tracking-tight uppercase">Reportes Históricos</h2>
        
        {/* Module Tab Selector */}
        <div className="flex bg-zinc-100 dark:bg-zinc-900 p-1 rounded-2xl border border-zinc-200/50 dark:border-white/10 gap-1 overflow-x-auto">
          <button
            onClick={() => setModuleTab('ALL')}
            className={`px-3.5 py-2 rounded-xl text-xs font-black uppercase transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              moduleTab === 'ALL'
                ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 shadow-xs'
                : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
            }`}
          >
            <span>📋 General (Todos)</span>
          </button>
          <button
            onClick={() => setModuleTab('VOSO')}
            className={`px-3.5 py-2 rounded-xl text-xs font-black uppercase transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              moduleTab === 'VOSO'
                ? 'bg-brand-blue text-white shadow-xs'
                : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
            }`}
          >
            <span>👁️ Metodología VOSO</span>
          </button>
          <button
            onClick={() => setModuleTab('OrdenYLimpieza')}
            className={`px-3.5 py-2 rounded-xl text-xs font-black uppercase transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              moduleTab === 'OrdenYLimpieza'
                ? 'bg-purple-600 text-white shadow-xs'
                : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-purple-300" />
            <span>Orden y Limpieza (5S)</span>
          </button>
        </div>
      </div>

      {/* History Search & Equipment Filter Bar */}
      <div className="bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-zinc-100 dark:border-white/10 shadow-xs flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="relative w-full md:w-80">
          <input
            type="text"
            placeholder="Buscar por descripción, área o equipo..."
            value={historySearchQuery}
            onChange={(e) => setHistorySearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200/60 dark:border-white/10 rounded-xl text-xs outline-none focus:ring-2 focus:ring-brand-blue text-zinc-900 dark:text-zinc-100 font-medium"
          />
          <Filter className="w-4 h-4 text-zinc-400 absolute left-3 top-2.5 pointer-events-none" />
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="flex items-center gap-2 w-full md:w-auto">
            <span className="text-xs font-bold text-zinc-500 uppercase shrink-0">Equipo:</span>
            <select
              value={historyEquipmentFilter}
              onChange={(e) => setHistoryEquipmentFilter(e.target.value)}
              className="w-full md:w-64 p-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200/60 dark:border-white/10 rounded-xl text-xs font-bold text-zinc-900 dark:text-zinc-100 outline-none focus:ring-2 focus:ring-brand-blue"
            >
              <option value="ALL">Todos los Equipos ({uniqueEquipments.length})</option>
              {uniqueEquipments.map((eq, i) => (
                <option key={`history-eq-${i}`} value={eq}>
                  {eq}
                </option>
              ))}
            </select>
          </div>

          {(historySearchQuery || historyEquipmentFilter !== 'ALL') && (
            <button
              onClick={() => {
                setHistorySearchQuery('');
                setHistoryEquipmentFilter('ALL');
              }}
              className="px-3 py-2 text-[10px] font-black uppercase tracking-wider text-rose-500 hover:text-rose-600 bg-rose-50 dark:bg-rose-500/10 rounded-xl shrink-0 transition-colors cursor-pointer"
            >
              Limpiar
            </button>
          )}
        </div>
      </div>
      
      <div className="grid grid-cols-3 sm:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-black p-4 rounded-2xl border border-zinc-100 dark:border-white/10 shadow-sm dark:shadow-none">
          <p className="text-[10px] font-bold text-zinc-400 dark:text-zinc-600 uppercase mb-1">Total</p>
          <p className="text-2xl font-bold text-zinc-900 dark:text-white">{stats.total}</p>
        </div>
        <div className="bg-amber-50 dark:bg-amber-500/10 p-4 rounded-2xl border border-amber-100 dark:border-amber-500/20 shadow-sm dark:shadow-none">
          <p className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase mb-1">Pendientes</p>
          <p className="text-2xl font-bold text-amber-700 dark:text-amber-300">{stats.open}</p>
        </div>
        <div className="bg-orange-50 dark:bg-orange-500/10 p-4 rounded-2xl border border-orange-100 dark:border-orange-500/20 shadow-sm dark:shadow-none">
          <p className="text-[10px] font-bold text-orange-600 dark:text-orange-400 uppercase mb-1">En Revisión</p>
          <p className="text-2xl font-bold text-orange-700 dark:text-orange-300">{stats.inReview}</p>
        </div>
        <div className="bg-emerald-50 dark:bg-emerald-500/10 p-4 rounded-2xl border border-emerald-100 dark:border-emerald-500/20 shadow-sm dark:shadow-none">
          <p className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase mb-1">Cerrados</p>
          <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-300">{stats.closed}</p>
        </div>
      </div>

      <div className="bg-white dark:bg-black rounded-3xl border border-zinc-100 dark:border-white/10 shadow-sm dark:shadow-none overflow-hidden">
        <div className="p-4 sm:p-6 border-b border-zinc-50 dark:border-white/5 bg-zinc-50/50 dark:bg-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <h3 className="font-bold text-zinc-900 dark:text-white text-base uppercase tracking-tight">Historial de Hallazgos</h3>
            <p className="text-xs text-zinc-400 dark:text-zinc-500 font-medium">Registro histórico y auditoría del estado de inspecciones</p>
          </div>
          
          <div className="flex flex-wrap items-center gap-3">
            <div className="bg-zinc-100 dark:bg-zinc-900 p-1 rounded-xl flex items-center border border-zinc-200/50 dark:border-white/5">
              <button
                onClick={() => setSubTab('active')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                  subTab === 'active' 
                    ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-xs' 
                    : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                }`}
              >
                <span>Activos</span>
                <span className={`px-1.5 py-0.5 rounded-md text-[9px] font-black ${
                  subTab === 'active' 
                    ? 'bg-zinc-100 dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300' 
                    : 'bg-zinc-200 dark:bg-zinc-805 text-zinc-550 dark:text-zinc-400'
                }`}>
                  {stats.open + stats.inReview}
                </span>
              </button>
              <button
                onClick={() => setSubTab('closed')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                  subTab === 'closed' 
                    ? 'bg-white dark:bg-zinc-800 text-emerald-600 dark:text-emerald-400 shadow-xs' 
                    : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-905 dark:hover:text-white'
                }`}
              >
                <span>Cerrados</span>
                <span className={`px-1.5 py-0.5 rounded-md text-[9px] font-black ${
                  subTab === 'closed' 
                    ? 'bg-emerald-100/50 dark:bg-emerald-500/10 text-emerald-650 dark:text-emerald-400' 
                    : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400'
                }`}>
                  {stats.closed}
                </span>
              </button>
              <button
                onClick={() => setSubTab('user_rounds')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                  subTab === 'user_rounds' 
                    ? 'bg-white dark:bg-zinc-800 text-sky-600 dark:text-sky-400 shadow-xs' 
                    : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                <span>Inspecciones por Usuario</span>
                <span className={`px-1.5 py-0.5 rounded-md text-[9px] font-black ${
                  subTab === 'user_rounds' 
                    ? 'bg-sky-100 dark:bg-sky-500/20 text-sky-700 dark:text-sky-300' 
                    : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400'
                }`}>
                  {userStatsList.length}
                </span>
              </button>
            </div>

            <button 
              onClick={exportToPDF}
              className="text-xs font-bold text-zinc-505 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white flex items-center gap-1.5 bg-white dark:bg-black border border-zinc-100 dark:border-white/10 px-3 py-1.5 rounded-xl hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors uppercase tracking-widest cursor-pointer shadow-xs"
            >
              <FileText className="w-3.5 h-3.5" /> Exportar PDF
            </button>

            <button 
              onClick={exportToCSV}
              className="text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 flex items-center gap-1.5 bg-emerald-500/5 dark:bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-xl hover:bg-emerald-505 dark:hover:bg-emerald-500/20 transition-colors uppercase tracking-widest cursor-pointer shadow-xs"
            >
              <Download className="w-3.5 h-3.5" /> Exportar CSV
            </button>
          </div>
        </div>

        {subTab === 'user_rounds' ? (
          <div className="p-4 sm:p-6 space-y-8 animate-fadeIn">
            {/* Top KPI Cards for Users */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="bg-sky-50/50 dark:bg-sky-500/10 p-4 rounded-2xl border border-sky-100 dark:border-sky-500/20 shadow-xs">
                <p className="text-[10px] font-bold text-sky-600 dark:text-sky-400 uppercase tracking-widest mb-1">Total Inspecciones Realizadas</p>
                <p className="text-2xl font-black text-sky-900 dark:text-sky-200">{findings.length}</p>
                <p className="text-[10px] text-sky-600/70 dark:text-sky-400/70 mt-1 font-medium">Inspecciones registradas</p>
              </div>

              <div className="bg-indigo-50/50 dark:bg-indigo-500/10 p-4 rounded-2xl border border-indigo-100 dark:border-indigo-500/20 shadow-xs">
                <p className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-widest mb-1">Operadores Activos</p>
                <p className="text-2xl font-black text-indigo-900 dark:text-indigo-200">{userStatsList.length}</p>
                <p className="text-[10px] text-indigo-600/70 dark:text-indigo-400/70 mt-1 font-medium">Usuarios con registros</p>
              </div>

              <div className="bg-amber-50/50 dark:bg-amber-500/10 p-4 rounded-2xl border border-amber-100 dark:border-amber-500/20 shadow-xs col-span-2 sm:col-span-2">
                <p className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-widest mb-1">Operador Líder de Inspecciones</p>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-lg font-black text-amber-950 dark:text-amber-100 truncate">
                      {userStatsList[0]?.operatorName || 'Sin datos'}
                    </p>
                    <p className="text-[10px] text-amber-600 dark:text-amber-400 font-bold uppercase tracking-wider">
                      {userStatsList[0]?.totalRounds || 0} Inspecciones completadas
                    </p>
                  </div>
                  <span className="text-2xl">🏆</span>
                </div>
              </div>
            </div>

            {/* Operator Cards & Filters */}
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h4 className="text-sm font-black text-zinc-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                    <Users className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                    <span>Conteo de Inspecciones por Usuario</span>
                  </h4>
                  <p className="text-xs text-zinc-400 dark:text-zinc-500">Selecciona un usuario para filtrar sus inspecciones o descargar sus informes</p>
                </div>

                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Buscar operador..."
                      value={userSearchQuery}
                      onChange={(e) => setUserSearchQuery(e.target.value)}
                      className="pl-8 pr-3 py-1.5 text-xs bg-zinc-100 dark:bg-zinc-900 border border-zinc-200/60 dark:border-white/10 rounded-xl text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                    />
                  </div>

                  {selectedUserFilter !== 'ALL' && (
                    <button
                      type="button"
                      onClick={() => setSelectedUserFilter('ALL')}
                      className="px-2.5 py-1.5 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-300 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-colors flex items-center gap-1"
                    >
                      <X className="w-3 h-3" /> Ver Todos
                    </button>
                  )}
                </div>
              </div>

              {/* Grid of Operators */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {userStatsList
                  .filter(u => (u.operatorName || '').toLowerCase().includes((userSearchQuery || '').toLowerCase()))
                  .map((stat, idx) => {
                    const isSelected = selectedUserFilter === stat.operatorName;
                    return (
                      <div
                        key={`user-stat-${idx}-${stat.operatorName}`}
                        onClick={() => setSelectedUserFilter(isSelected ? 'ALL' : stat.operatorName)}
                        className={`p-4 rounded-2xl border transition-all cursor-pointer relative overflow-hidden flex flex-col justify-between gap-3 ${
                          isSelected
                            ? 'bg-sky-50/80 dark:bg-sky-500/15 border-sky-400 dark:border-sky-500 ring-2 ring-sky-500/20 shadow-md'
                            : 'bg-white dark:bg-zinc-900/60 border-zinc-100 dark:border-white/10 hover:border-zinc-300 dark:hover:border-white/20 shadow-xs'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-sky-600 to-indigo-600 text-white font-black text-sm flex items-center justify-center uppercase shadow-sm overflow-hidden shrink-0 border border-sky-300 dark:border-sky-700">
                              {stat.operatorPhotoUrl ? (
                                <img src={stat.operatorPhotoUrl} alt={stat.operatorName} className="w-full h-full object-cover" />
                              ) : (
                                stat.operatorName.slice(0, 2)
                              )}
                            </div>
                            <div>
                              <h5 className="font-bold text-zinc-900 dark:text-white text-sm line-clamp-1">
                                {stat.operatorName}
                              </h5>
                              <p className="text-[10px] text-zinc-400 dark:text-zinc-500 font-medium">
                                Última inspección: {stat.lastRoundDate ? format(stat.lastRoundDate, 'dd/MM/yyyy') : 'Sin fecha'}
                              </p>
                            </div>
                          </div>

                          <span className="px-2.5 py-1 bg-sky-100 dark:bg-sky-500/20 text-sky-800 dark:text-sky-300 rounded-xl text-[11px] font-black uppercase tracking-wider shrink-0 border border-sky-200 dark:border-sky-500/30">
                            {stat.totalRounds} Inspecciones de Área
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-[10px] pt-2 border-t border-zinc-100 dark:border-white/5">
                          <div className="bg-zinc-50 dark:bg-black/40 p-2 rounded-xl text-center">
                            <span className="block text-zinc-400 dark:text-zinc-500 font-bold uppercase tracking-wider">VOSO</span>
                            <span className="font-black text-brand-blue dark:text-sky-400 text-xs">{stat.vosoRounds}</span>
                          </div>
                          <div className="bg-zinc-50 dark:bg-black/40 p-2 rounded-xl text-center">
                            <span className="block text-zinc-400 dark:text-zinc-500 font-bold uppercase tracking-wider">5S Orden</span>
                            <span className="font-black text-purple-600 dark:text-purple-400 text-xs">{stat.ordenRounds}</span>
                          </div>
                        </div>

                        <div className="pt-1 flex items-center justify-between text-[10px] font-bold text-sky-600 dark:text-sky-400">
                          <span>{isSelected ? '✓ Filtrando inspecciones de este usuario' : 'Filtrar inspecciones de este operador'}</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>

            {/* List / Table of Completed Inspections for the selected / all user(s) */}
            <div className="pt-4 border-t border-zinc-100 dark:border-white/10 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h4 className="text-sm font-black text-zinc-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                    <FileText className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    <span>Registro General de Inspecciones de Área e Informes PDF</span>
                  </h4>
                  <p className="text-xs text-zinc-400 dark:text-zinc-500">
                    {selectedUserFilter === 'ALL'
                      ? 'Mostrando todas las inspecciones de área realizadas'
                      : `Mostrando inspecciones realizadas por: ${selectedUserFilter}`}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <label className="text-[10px] font-bold text-zinc-400 uppercase">Filtrar por Usuario:</label>
                  <select
                    value={selectedUserFilter}
                    onChange={(e) => setSelectedUserFilter(e.target.value)}
                    className="text-xs bg-zinc-100 dark:bg-zinc-900 border border-zinc-200/60 dark:border-white/10 rounded-xl px-3 py-1.5 text-zinc-900 dark:text-white font-bold focus:outline-none"
                  >
                    <option value="ALL">Todos los Usuarios ({findings.length} Inspecciones)</option>
                    {userStatsList.map((stat, i) => (
                      <option key={`opt-usr-${i}`} value={stat.operatorName}>
                        {stat.operatorName} ({stat.totalRounds} inspecciones)
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Table of rounds */}
              {(() => {
                const filteredRounds = findings.filter(f => {
                  if (selectedUserFilter !== 'ALL' && (f.operatorName || 'Operador en Terreno').trim() !== selectedUserFilter) {
                    return false;
                  }
                  return true;
                });

                if (filteredRounds.length === 0) {
                  return (
                    <div className="p-12 text-center text-zinc-400 dark:text-zinc-600 bg-zinc-50 dark:bg-zinc-900/30 rounded-3xl border border-zinc-100 dark:border-white/5">
                      <FileText className="w-8 h-8 mx-auto mb-2 opacity-40" />
                      <p className="text-xs font-bold uppercase tracking-wider">No hay inspecciones registradas para este filtro</p>
                    </div>
                  );
                }

                return (
                  <div className="overflow-x-auto rounded-2xl border border-zinc-100 dark:border-white/10 shadow-xs">
                    <table className="w-full text-left text-sm min-w-[850px]">
                      <thead>
                        <tr className="bg-zinc-50 dark:bg-zinc-900/80 text-zinc-400 dark:text-zinc-500 border-b border-zinc-100 dark:border-white/5 text-[10px] uppercase font-bold tracking-widest">
                          <th className="px-4 py-3.5">Fecha</th>
                          <th className="px-4 py-3.5">Módulo</th>
                          <th className="px-4 py-3.5">Operador / Usuario</th>
                          <th className="px-4 py-3.5">Área de Inspección</th>
                          <th className="px-4 py-3.5">Resumen de Inspección</th>
                          <th className="px-4 py-3.5">Estado</th>
                          <th className="px-4 py-3.5 text-right">Informe PDF</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-100 dark:divide-white/5 bg-white dark:bg-black">
                        {filteredRounds.map((f, idx) => {
                          const fDate = getFindingDate(f);
                          const isVoso = isVOSOFinding(f);
                          const opProfile = getOperatorProfile(f.operatorId, f.operatorName);

                          return (
                            <tr
                              key={`round-row-${f.id}-${idx}`}
                              onClick={() => setSelectedFinding(f)}
                              className="hover:bg-zinc-50/80 dark:hover:bg-white/5 transition-colors cursor-pointer group"
                            >
                              <td className="px-4 py-3.5 text-xs font-mono text-zinc-500 dark:text-zinc-400 whitespace-nowrap">
                                {fDate ? format(fDate, 'dd/MM/yyyy HH:mm') : '-'}
                              </td>

                              <td className="px-4 py-3.5 whitespace-nowrap">
                                <span className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider ${
                                  isVoso
                                    ? 'bg-sky-100 text-sky-800 dark:bg-sky-500/20 dark:text-sky-300'
                                    : 'bg-purple-100 text-purple-800 dark:bg-purple-500/20 dark:text-purple-300'
                                }`}>
                                  {isVoso ? '👁️ VOSO' : '✨ 5S Orden'}
                                </span>
                              </td>

                              <td className="px-4 py-3.5 font-bold text-zinc-900 dark:text-white whitespace-nowrap">
                                <div className="flex items-center gap-2">
                                  <div className="w-7 h-7 rounded-full overflow-hidden bg-sky-100 dark:bg-sky-900/40 border border-sky-300 dark:border-sky-700/50 flex items-center justify-center shrink-0">
                                    {opProfile.photoUrl ? (
                                      <img src={opProfile.photoUrl} alt={f.operatorName || 'Operador'} className="w-full h-full object-cover" />
                                    ) : (
                                      <span className="text-[10px] font-black text-sky-600 dark:text-sky-400 uppercase">
                                        {(f.operatorName || 'OP').slice(0, 2)}
                                      </span>
                                    )}
                                  </div>
                                  <span>{f.operatorName || 'Operador'}</span>
                                </div>
                              </td>

                              <td className="px-4 py-3.5 text-xs text-zinc-600 dark:text-zinc-300 font-medium whitespace-nowrap">
                                <div className="flex flex-col">
                                  <span className="font-bold text-zinc-900 dark:text-white">{f.areaName || 'Área Principal'}</span>
                                  <span className="text-[10px] text-sky-600 dark:text-sky-400 font-semibold uppercase tracking-wider">
                                    {f.equipmentName && !f.equipmentName.toLowerCase().includes('puntos generales') && !f.equipmentName.toLowerCase().includes('área completa')
                                      ? f.equipmentName
                                      : 'Área Completa'}
                                  </span>
                                </div>
                              </td>

                              <td className="px-4 py-3.5 max-w-[220px]">
                                <FindingDescriptionRenderer
                                  description={f.description}
                                  isPreview
                                  className="text-xs text-zinc-500 dark:text-zinc-400 truncate"
                                />
                              </td>

                              <td className="px-4 py-3.5 whitespace-nowrap">
                                <span className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider ${
                                  f.status === 'Closed'
                                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400'
                                    : f.status === 'InReview'
                                    ? 'bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-400'
                                    : 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400'
                                }`}>
                                  {f.status === 'Closed' ? 'Cerrado' : f.status === 'InReview' ? 'En Revisión' : 'Abierto'}
                                </span>
                              </td>

                              <td className="px-4 py-3.5 text-right whitespace-nowrap">
                                <div className="flex items-center justify-end gap-1.5">
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      const opProf = getOperatorProfile(f.operatorId, f.operatorName, f.operatorPhotoUrl);
                                      downloadOperatorInspectionPDF(f, {
                                        name: f.operatorName || opProf.name,
                                        photoUrl: opProf.photoUrl || f.operatorPhotoUrl,
                                        rut: opProf.rut,
                                        cargo: opProf.cargo
                                      });
                                    }}
                                    className="px-2.5 py-1.5 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-[10px] font-black uppercase tracking-wider shadow-xs transition-all active:scale-95 inline-flex items-center gap-1 cursor-pointer"
                                    title="Descargar Informe PDF"
                                  >
                                    <Download className="w-3.5 h-3.5" />
                                    <span className="hidden sm:inline">Descargar</span>
                                  </button>

                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      const opProf = getOperatorProfile(f.operatorId, f.operatorName, f.operatorPhotoUrl);
                                      shareOperatorInspectionPDF(f, {
                                        name: f.operatorName || opProf.name,
                                        photoUrl: opProf.photoUrl || f.operatorPhotoUrl,
                                        rut: opProf.rut,
                                        cargo: opProf.cargo
                                      });
                                    }}
                                    className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-[10px] font-black uppercase tracking-wider shadow-xs transition-all active:scale-95 inline-flex items-center gap-1 cursor-pointer"
                                    title="Compartir Informe PDF"
                                  >
                                    <Share2 className="w-3.5 h-3.5" />
                                    <span className="hidden sm:inline">Compartir</span>
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                );
              })()}
            </div>
          </div>
        ) : subTab === 'active' ? (
          <div>
            {activeFindingsList.length === 0 ? (
              <div className="p-16 text-center space-y-3">
                <div className="w-16 h-16 bg-zinc-50 dark:bg-zinc-900 text-zinc-400 dark:text-zinc-650 rounded-full flex items-center justify-center mx-auto border border-zinc-100 dark:border-white/5">
                  <Check className="w-8 h-8" />
                </div>
                <h4 className="text-sm font-black text-zinc-900 dark:text-white uppercase tracking-tight">Sin Hallazgos Activos</h4>
                <p className="text-xs text-zinc-400 dark:text-zinc-500 max-w-md mx-auto">No hay hallazgos con estado pendiente o en revisión asignados a esta planta de producción.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm min-w-[800px]">
                  <thead>
                    <tr className="text-zinc-400 dark:text-zinc-500 border-b border-zinc-50 dark:border-white/5">
                      <th 
                        className="px-4 py-4 font-bold uppercase tracking-widest cursor-pointer hover:text-zinc-900 dark:hover:text-white transition-colors"
                        onClick={() => handleSort('createdAt')}
                      >
                        <div className="flex items-center gap-1">
                          Fecha
                          {sortConfig?.key === 'createdAt' && (
                            sortConfig.direction === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
                          )}
                        </div>
                      </th>
                      <th 
                        className="px-4 py-4 font-bold uppercase tracking-widest cursor-pointer hover:text-zinc-900 dark:hover:text-white transition-colors"
                        onClick={() => handleSort('areaName')}
                      >
                        <div className="flex items-center gap-1">
                          Área
                          {sortConfig?.key === 'areaName' && (
                            sortConfig.direction === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
                          )}
                        </div>
                      </th>
                      <th 
                        className="px-4 py-4 font-bold uppercase tracking-widest cursor-pointer hover:text-zinc-900 dark:hover:text-white transition-colors"
                        onClick={() => handleSort('operatorName')}
                      >
                        <div className="flex items-center gap-1">
                          Operador
                          {sortConfig?.key === 'operatorName' && (
                            sortConfig.direction === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
                          )}
                        </div>
                      </th>
                      <th className="px-4 py-4 font-bold uppercase tracking-widest">Inspección</th>
                      <th 
                        className="px-4 py-4 font-bold uppercase tracking-widest cursor-pointer hover:text-zinc-900 dark:hover:text-white transition-colors"
                        onClick={() => handleSort('status')}
                      >
                        <div className="flex items-center gap-1">
                          Estado
                          {sortConfig?.key === 'status' && (
                            sortConfig.direction === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
                          )}
                        </div>
                      </th>
                      <th className="px-4 py-4 font-bold uppercase tracking-widest text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-50 dark:divide-white/5">
                    {activeFindingsList.map((f, index) => {
                      const areaStart = parseAnyDate(f.inspectionStartedAt);
                      const areaEnd = parseAnyDate(f.inspectionCompletedAt);
                      const areaDuration = f.inspectionDurationSeconds || (areaStart && areaEnd 
                        ? Math.round((areaEnd.getTime() - areaStart.getTime()) / 1000) 
                        : null);
                      
                      const equipStart = parseAnyDate(f.equipmentStartedAt);
                      const equipEnd = parseAnyDate(f.equipmentCompletedAt);
                      const equipDuration = f.equipmentDurationSeconds || (equipStart && equipEnd
                        ? Math.round((equipEnd.getTime() - equipStart.getTime()) / 1000)
                        : null);

                      return (
                        <tr 
                          key={`rep-row-${f.id}-${index}`} 
                          onClick={() => setSelectedFinding(f)}
                          className="hover:bg-zinc-50/50 dark:hover:bg-white/5 transition-colors group cursor-pointer"
                        >
                          <td className="px-4 py-4 text-zinc-500 dark:text-zinc-650 whitespace-nowrap">
                            {getFindingDate(f) ? format(getFindingDate(f)!, 'dd/MM/yy') : '-'}
                          </td>
                          <td className="px-4 py-4 font-medium text-zinc-900 dark:text-white">
                            <div className="flex flex-col">
                              <span>{f.areaName || 'Área General'}</span>
                              <FindingDescriptionRenderer 
                                description={f.description} 
                                isPreview 
                                className="text-[10px] text-zinc-400 dark:text-zinc-600 uppercase tracking-tight truncate max-w-[150px]" 
                              />
                            </div>
                          </td>
                          <td className="px-4 py-4 text-zinc-500 dark:text-zinc-500">
                            {f.operatorName || '-'}
                          </td>
                          <td className="px-4 py-4">
                            <div className="flex flex-col gap-2">
                              {/* Area Duration */}
                              <div className="bg-zinc-50 dark:bg-zinc-900 border border-zinc-100 dark:border-white/10 rounded-xl p-2 flex items-center justify-between gap-3 min-w-[120px]">
                                 <div className="flex flex-col text-[9px] text-zinc-400 dark:text-zinc-500 leading-none">
                                    <span className="font-bold uppercase tracking-tighter mb-1">TOTAL ÁREA</span>
                                    <div className="flex items-center gap-1 font-mono">
                                      <span>{areaStart ? format(areaStart, 'HH:mm') : '--:--'}</span>
                                      <span className="opacity-30">→</span>
                                      <span>{areaEnd ? format(areaEnd, 'HH:mm') : '--:--'}</span>
                                    </div>
                                 </div>
                                 {areaDuration !== null && (
                                    <div className="bg-white dark:bg-black px-2 py-1 rounded-lg border border-zinc-100 dark:border-white/10 shadow-sm dark:shadow-none flex flex-col items-center">
                                       <span className="text-[10px] font-black text-zinc-905 dark:text-white leading-none">{Math.floor(areaDuration / 60)}m</span>
                                       <span className="text-[8px] text-zinc-400 dark:text-zinc-500 font-bold uppercase tracking-tighter">{areaDuration % 60}s</span>
                                    </div>
                                 )}
                              </div>

                              {/* Equipment Duration */}
                              {equipDuration !== null && (
                                <div className="flex items-center gap-2 px-2 text-[10px]">
                                  <span className="text-zinc-400 dark:text-zinc-600 font-bold tracking-tighter uppercase">Equipo:</span>
                                  <span className="font-black text-zinc-900 dark:text-white bg-sky-50 dark:bg-sky-500/10 text-sky-600 dark:text-sky-400 px-1.5 py-0.5 rounded-md border border-sky-100 dark:border-sky-500/20">
                                    {equipDuration < 60 ? `${equipDuration}s` : `${Math.floor(equipDuration / 60)}m ${equipDuration % 60}s`}
                                  </span>
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-4">
                            <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase ${
                              f.status === 'Open' ? 'bg-amber-100 text-amber-700' : 'bg-orange-100 text-orange-700'
                            }`}>
                              {f.status === 'Open' ? 'Abierto' : 'En Revisión'}
                            </span>
                          </td>
                          <td className="px-4 py-4 text-right">
                            <div className="flex justify-end items-center gap-1">
                              <button 
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const opProf = getOperatorProfile(f.operatorId, f.operatorName, f.operatorPhotoUrl);
                                  downloadOperatorInspectionPDF(f, {
                                    name: f.operatorName || opProf.name,
                                    photoUrl: opProf.photoUrl || f.operatorPhotoUrl,
                                    rut: opProf.rut,
                                    cargo: opProf.cargo
                                  });
                                }}
                                className="p-1.5 text-sky-600 hover:text-sky-700 hover:bg-sky-50 dark:text-sky-400 dark:hover:bg-sky-500/10 rounded-lg transition-all flex items-center gap-1 cursor-pointer"
                                title="Descargar Informe PDF"
                              >
                                <Download className="w-4 h-4" />
                                <span className="text-[10px] font-bold uppercase hidden sm:inline">Descargar</span>
                              </button>

                              <button 
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const opProf = getOperatorProfile(f.operatorId, f.operatorName, f.operatorPhotoUrl);
                                  shareOperatorInspectionPDF(f, {
                                    name: f.operatorName || opProf.name,
                                    photoUrl: opProf.photoUrl || f.operatorPhotoUrl,
                                    rut: opProf.rut,
                                    cargo: opProf.cargo
                                  });
                                }}
                                className="p-1.5 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-500/10 rounded-lg transition-all flex items-center gap-1 cursor-pointer"
                                title="Compartir Informe PDF"
                              >
                                <Share2 className="w-4 h-4" />
                                <span className="text-[10px] font-bold uppercase hidden sm:inline">Compartir</span>
                              </button>

                              {user.role === 'Administrador' && (
                                confirmingDelete === f.id ? (
                                  <div className="flex items-center gap-1 bg-red-50 p-1 rounded-xl border border-red-100">
                                    <span className="text-[10px] font-bold text-red-600 px-2">¿Seguro?</span>
                                    <button 
                                      onClick={(e) => { e.stopPropagation(); handleDelete(f.id); }}
                                      className="p-1.5 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors shadow-sm dark:shadow-none"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                    <button 
                                      onClick={(e) => { e.stopPropagation(); setConfirmingDelete(null); }}
                                      className="p-1.5 bg-zinc-200 text-zinc-650 rounded-lg hover:bg-zinc-300 transition-colors"
                                    >
                                      <X className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                ) : (
                                  <button 
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setConfirmingDelete(f.id);
                                    }}
                                    className="p-2 text-zinc-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                                    title="Eliminar permanentemente"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                )
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : (
          <div className="p-4 sm:p-6">
            {closedFindingsList.length === 0 ? (
              <div className="p-16 text-center space-y-3">
                <div className="w-16 h-16 bg-zinc-50 dark:bg-zinc-905 text-zinc-300 dark:text-zinc-700 rounded-full flex items-center justify-center mx-auto border border-zinc-100 dark:border-white/5">
                  <CheckCircle2 className="w-8 h-8 font-light" />
                </div>
                <h4 className="text-sm font-black text-zinc-900 dark:text-zinc-100 uppercase tracking-tight">Sin Hallazgos Cerrados</h4>
                <p className="text-xs text-zinc-400 dark:text-zinc-500 max-w-sm mx-auto">No se ha cerrado ningún hallazgo todavía. Los hallazgos cerrados por los supervisores aparecerán aquí.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-fadeIn">
                {closedFindingsList.map((f, index) => {
                  const fDate = getFindingDate(f);
                  const closedDate = parseAnyDate(f.closedAt);
                  const resolutionTime = fDate && closedDate ? Math.round((closedDate.getTime() - fDate.getTime()) / (1000 * 60 * 60) * 10) / 10 : null;

                  return (
                    <div 
                      key={`closed-card-${f.id}-${index}`}
                      onClick={() => setSelectedFinding(f)}
                      className="bg-zinc-50/50 dark:bg-zinc-900/10 hover:bg-zinc-100/50 dark:hover:bg-zinc-800/10 border border-zinc-100 dark:border-white/10 rounded-3xl p-5 sm:p-6 transition-all duration-300 shadow-sm hover:shadow-md cursor-pointer flex flex-col justify-between hover:border-zinc-200 dark:hover:border-white/20 relative overflow-hidden group"
                    >
                      {/* Accent decoration */}
                      <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 dark:bg-emerald-500/10 rounded-full -mr-8 -mt-8 blur-xl opacity-60 pointer-events-none" />
                      
                      <div className="space-y-4">
                        {/* Header info */}
                        <div className="flex items-start justify-between gap-3 relative z-10">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400 text-[9px] font-black uppercase tracking-widest rounded-md border border-emerald-500/20">
                                Cerrado
                              </span>
                              <span className="text-[10px] text-zinc-400 dark:text-zinc-500 font-mono">
                                {closedDate ? format(closedDate, 'dd/MM/yy') : '-'}
                              </span>
                            </div>
                            <h4 className="text-sm font-black text-zinc-900 dark:text-white uppercase tracking-tight leading-tight mt-1 group-hover:text-brand-blue dark:group-hover:text-emerald-400 transition-colors">
                              {f.areaName}
                            </h4>
                            <p className="text-[10px] text-zinc-450 dark:text-zinc-500 font-bold uppercase tracking-wider">
                              Por {f.operatorName || 'Operador'}
                            </p>
                          </div>

                          {/* Photo Thumbnail / Gallery */}
                          <FindingPhotoThumbnails
                            photos={extractFindingPhotos(f)}
                            onSelectPhoto={() => setSelectedFinding(f)}
                            size="md"
                          />
                        </div>

                        {/* Resolution Time Badge */}
                        {resolutionTime !== null && (
                          <div className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-500/5 px-3 py-1.5 rounded-xl border border-emerald-500/10 w-fit">
                            <Clock className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-450" />
                            <span>Resuelto en: <span className="font-extrabold text-emerald-700 dark:text-emerald-300">{resolutionTime} horas</span></span>
                          </div>
                        )}

                        {/* Solución Aplicada (Parsed or clean description) */}
                        <div className="space-y-1">
                          <span className="text-[9px] font-extrabold text-zinc-405 dark:text-zinc-500 uppercase tracking-[0.15em] block">
                            Solución / Hallazgo Reportado
                          </span>
                          <div className="bg-white dark:bg-zinc-950 p-3 rounded-2xl border border-zinc-100/80 dark:border-white/5 shadow-xs">
                            <FindingDescriptionRenderer 
                              description={f.description} 
                              isPreview 
                              className="text-xs font-semibold text-zinc-650 dark:text-zinc-300 leading-relaxed" 
                            />
                          </div>
                        </div>

                        {/* Supervisor Comments */}
                        {f.supervisorComments && (
                          <div className="space-y-1 pt-1">
                            <span className="text-[9px] font-extrabold text-[#00a8cc] dark:text-sky-450 uppercase tracking-[0.15em] flex items-center gap-1">
                              <MessageSquare className="w-3 h-3 text-sky-550" />
                              Comentarios del Supervisor
                            </span>
                            <div className="bg-sky-50 dark:bg-sky-500/5 p-3 rounded-2xl border border-sky-100 dark:border-sky-500/10">
                              <p className="text-zinc-700 dark:text-sky-200 text-xs italic font-semibold leading-relaxed">
                                "{f.supervisorComments}"
                              </p>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Action Footer */}
                      <div className="flex items-center justify-between pt-4 mt-4 border-t border-zinc-100 dark:border-white/5">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest flex items-center gap-1">
                            <Check className="w-3 h-3 text-emerald-500" /> RESUELTO
                          </span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              const opProf = getOperatorProfile(f.operatorId, f.operatorName, f.operatorPhotoUrl);
                              downloadOperatorInspectionPDF(f, {
                                name: f.operatorName || opProf.name,
                                photoUrl: opProf.photoUrl || f.operatorPhotoUrl,
                                rut: opProf.rut,
                                cargo: opProf.cargo
                              });
                            }}
                            className="px-2 py-1 bg-sky-50 dark:bg-sky-500/10 hover:bg-sky-100 dark:hover:bg-sky-500/20 text-sky-700 dark:text-sky-300 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all flex items-center gap-1 border border-sky-200 dark:border-sky-500/30 cursor-pointer"
                            title="Descargar Informe PDF"
                          >
                            <Download className="w-3 h-3" />
                            <span>Descargar</span>
                          </button>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              const opProf = getOperatorProfile(f.operatorId, f.operatorName, f.operatorPhotoUrl);
                              shareOperatorInspectionPDF(f, {
                                name: f.operatorName || opProf.name,
                                photoUrl: opProf.photoUrl || f.operatorPhotoUrl,
                                rut: opProf.rut,
                                cargo: opProf.cargo
                              });
                            }}
                            className="px-2 py-1 bg-emerald-50 dark:bg-emerald-500/10 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all flex items-center gap-1 border border-emerald-200 dark:border-emerald-500/30 cursor-pointer"
                            title="Compartir Informe PDF"
                          >
                            <Share2 className="w-3 h-3" />
                            <span>Compartir</span>
                          </button>
                        </div>
                        <span className="text-[10px] font-extrabold text-zinc-450 dark:text-zinc-500 group-hover:text-zinc-900 dark:group-hover:text-white uppercase tracking-wider flex items-center gap-1 group-hover:underline">
                          Detalles <ChevronRight className="w-3 h-3" />
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

        <AnimatePresence>
          {selectedFinding && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 md:p-6 overflow-y-auto">
              <motion.div 
                initial={{ opacity: 0 }} 
                animate={{ opacity: 1 }} 
                exit={{ opacity: 0 }}
                onClick={() => setSelectedFinding(null)}
                className="fixed inset-0 bg-zinc-900/70 backdrop-blur-sm" 
              />
              <motion.div 
                initial={{ opacity: 0, scale: 0.95, y: 15 }} 
                animate={{ opacity: 1, scale: 1, y: 0 }} 
                exit={{ opacity: 0, scale: 0.95, y: 15 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
                className="relative w-full max-w-lg sm:max-w-5xl bg-white dark:bg-black rounded-3xl sm:rounded-[2.5rem] overflow-hidden shadow-2xl dark:shadow-none flex flex-col sm:flex-row max-h-[88vh] sm:max-h-[90vh] border border-zinc-100 dark:border-white/10 my-auto z-10"
              >
                <div className="h-56 sm:h-auto sm:min-h-[380px] sm:w-1/2 shrink-0 relative bg-zinc-950 flex flex-col">
                  <FindingPhotoGallery 
                    photos={extractFindingPhotos(selectedFinding)} 
                    altPrefix={selectedFinding.equipmentName || selectedFinding.areaName || 'Hallazgo'}
                    showCloseButton
                    onClose={() => setSelectedFinding(null)}
                  />
                </div>
                <div className="flex-1 overflow-y-auto p-4 sm:p-8 md:p-10 space-y-4 sm:space-y-6 custom-scrollbar">
                  <div>
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className={`px-2.5 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider ${
                        isVOSOFinding(selectedFinding)
                          ? 'bg-sky-100 dark:bg-sky-500/20 text-sky-800 dark:text-sky-300 border border-sky-300 dark:border-sky-700/50'
                          : 'bg-purple-100 dark:bg-purple-500/20 text-purple-800 dark:text-purple-300 border border-purple-300 dark:border-purple-700/50'
                      }`}>
                        {isVOSOFinding(selectedFinding) ? '👁️ Metodología VOSO' : '✨ Orden y Limpieza'}
                      </span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        selectedFinding.status === 'Open' ? 'bg-amber-100 text-amber-700' : 
                        selectedFinding.status === 'InReview' ? 'bg-orange-100 text-orange-700' :
                        'bg-emerald-100 text-emerald-700'
                      }`}>
                        {selectedFinding.status === 'Open' ? 'Abierto' : 
                         selectedFinding.status === 'InReview' ? 'En Revisión' : 
                         'Cerrado'}
                      </span>
                      <span className="text-zinc-400 text-[10px]">ID: {selectedFinding.id}</span>
                      <OperatingStatusBadge finding={selectedFinding} size="sm" />
                    </div>
                    <h3 className="text-2xl font-bold text-zinc-900 dark:text-white">
                      {selectedFinding.equipmentName || selectedFinding.equipmentId || selectedFinding.areaName || 'Sin Equipo'}
                    </h3>
                    <p className="text-zinc-500 dark:text-zinc-400 text-sm mt-1">Reportado por {selectedFinding.operatorName}</p>
                  </div>

                  <div className="space-y-4">
                    <div className="bg-zinc-50 dark:bg-zinc-900 p-6 rounded-[2rem] border border-transparent dark:border-white/5">
                      <h4 className="text-[10px] font-extrabold text-zinc-400 dark:text-zinc-500 uppercase tracking-[0.2em] mb-4">Descripción del Hallazgo</h4>
                      <FindingDescriptionRenderer 
                        description={selectedFinding.description} 
                        source={selectedFinding.source} 
                        filterModule={isVOSOFinding(selectedFinding) ? 'VOSO' : 'OrdenYLimpieza'} 
                        className="text-zinc-800 dark:text-zinc-200" 
                        onSolveItem={(user.role === 'Supervisor' || user.role === 'Administrador') ? async (item, solutionText, solutionDate) => {
                          if (!selectedFinding) return;
                          try {
                            const solDate = solutionDate || new Date();
                            const { newDescription, isFullyClosed } = await FindingService.solveFindingItem(
                              selectedFinding.id,
                              selectedFinding.description,
                              item.category,
                              item.rawTitle,
                              solutionText,
                              user,
                              solDate
                            );

                            setSelectedFinding(prev => prev ? {
                              ...prev,
                              description: newDescription,
                              status: isFullyClosed ? 'Closed' : 'InReview',
                              solution: isFullyClosed ? solutionText : prev.solution,
                              closedAt: isFullyClosed ? solDate : prev.closedAt
                            } : null);

                            showToast("Solución Registrada", `Se registró la solución para "${item.rawTitle}"`, "success");
                          } catch (err: any) {
                            showToast("Error", `No se pudo registrar la solución: ${err.message}`, "error");
                          }
                        } : undefined}
                      />
                    </div>

                    {selectedFinding.supervisorComments && (
                      <div className="bg-brand-blue/5 dark:bg-sky-500/10 p-4 rounded-2xl border border-brand-blue/10 dark:border-sky-500/20">
                        <h4 className="text-[10px] font-black text-brand-blue dark:text-sky-400 uppercase tracking-widest mb-2">Respuesta del Supervisor</h4>
                        <p className="text-brand-blue/80 dark:text-sky-300/80 text-sm italic font-medium">"{selectedFinding.supervisorComments}"</p>
                      </div>
                    )}

                    {selectedFinding.history && selectedFinding.history.length > 0 && (
                      <div className="bg-zinc-50 dark:bg-zinc-900 p-4 rounded-2xl border border-zinc-100 dark:border-white/5">
                        <h4 className="text-[10px] font-black text-zinc-400 dark:text-zinc-600 uppercase tracking-widest mb-4 flex items-center gap-2">
                          <History className="w-3 h-3" />
                          Historial de Cambios
                        </h4>
                        <div className="space-y-4">
                          {selectedFinding.history.map((entry, i) => (
                            <div key={`hist-${i}`} className="relative flex gap-4">
                              {i !== selectedFinding.history!.length - 1 && (
                                <div className="absolute left-[11px] top-6 bottom-[-16px] w-[2px] bg-zinc-200 dark:bg-zinc-800" />
                              )}
                              <div className={`mt-1.5 w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 z-10 ${
                                entry.status === 'Open' ? 'bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/20 text-amber-600 dark:text-amber-400' :
                                entry.status === 'InReview' ? 'bg-orange-50 dark:bg-orange-500/10 border-orange-200 dark:border-orange-500/20 text-orange-600 dark:text-orange-400' :
                                'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                              }`}>
                                <div className="w-2 h-2 rounded-full bg-current" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between gap-2 mb-1">
                                  <span className="text-xs font-black text-zinc-900 dark:text-white uppercase tracking-tight">{entry.action}</span>
                                  <span className="text-[10px] text-zinc-400 dark:text-zinc-600 font-black">
                                    {entry.timestamp?.toDate ? format(entry.timestamp.toDate(), 'dd/MM HH:mm') : 
                                     entry.timestamp instanceof Date ? format(entry.timestamp, 'dd/MM HH:mm') : '--/--'}
                                  </span>
                                </div>
                                <p className="text-[11px] text-zinc-500 dark:text-zinc-500 font-bold uppercase tracking-tight">Por: {entry.userName}</p>
                                {entry.comment && (
                                  <p className="mt-1 text-[11px] text-zinc-600 dark:text-zinc-400 italic font-medium leading-relaxed">"{entry.comment}"</p>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-6 border-t border-zinc-100 dark:border-white/5">
                    <div className="space-y-4">
                      <div className="space-y-1">
                        <p className="text-[10px] font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-widest flex items-center gap-1.5">
                           <Layout className="w-3 h-3" />
                           Inspección de Área (Total)
                        </p>
                        <div className="bg-zinc-50 dark:bg-zinc-900 p-3 rounded-2xl border border-zinc-100 dark:border-white/5 flex items-center justify-between">
                           <div className="flex flex-col text-xs text-zinc-600 dark:text-zinc-400 font-mono">
                              <span>{parseAnyDate(selectedFinding.inspectionStartedAt) ? format(parseAnyDate(selectedFinding.inspectionStartedAt)!, 'HH:mm:ss') : '--:--:--'}</span>
                              <span className="text-zinc-300 dark:text-zinc-700">↓</span>
                              <span>{parseAnyDate(selectedFinding.inspectionCompletedAt) ? format(parseAnyDate(selectedFinding.inspectionCompletedAt)!, 'HH:mm:ss') : '--:--:--'}</span>
                           </div>
                           {(selectedFinding.inspectionDurationSeconds || (selectedFinding.inspectionStartedAt && selectedFinding.inspectionCompletedAt)) && (
                              <div className="text-right">
                                 <p className="text-lg font-black text-zinc-900 dark:text-white leading-none">
                                    {Math.floor((selectedFinding.inspectionDurationSeconds || (((parseAnyDate(selectedFinding.inspectionCompletedAt)?.getTime() || 0) - (parseAnyDate(selectedFinding.inspectionStartedAt)?.getTime() || 0)) / 1000)) / 60)} min
                                 </p>
                                 <p className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-tighter">Duración Total</p>
                              </div>
                           )}
                        </div>
                      </div>

                      <div className="space-y-1">
                        <p className="text-[10px] font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-widest flex items-center gap-1.5">
                           <Box className="w-3 h-3" />
                           Inspección de Equipo
                        </p>
                        <div className="bg-sky-50/20 dark:bg-sky-950/20 p-3 rounded-2xl border border-sky-100/30 dark:border-sky-500/10 flex items-center justify-between">
                           <div className="flex flex-col text-xs text-sky-700/60 dark:text-sky-400 font-mono">
                              <span>{parseAnyDate(selectedFinding.equipmentStartedAt) ? format(parseAnyDate(selectedFinding.equipmentStartedAt)!, 'HH:mm:ss') : '--:--:--'}</span>
                              <span className="text-sky-200 dark:text-sky-800">↓</span>
                              <span>{parseAnyDate(selectedFinding.equipmentCompletedAt) ? format(parseAnyDate(selectedFinding.equipmentCompletedAt)!, 'HH:mm:ss') : '--:--:--'}</span>
                           </div>
                           {(selectedFinding.equipmentDurationSeconds || (selectedFinding.equipmentStartedAt && selectedFinding.equipmentCompletedAt)) && (
                              <div className="text-right">
                                 <p className="text-lg font-black text-sky-600 dark:text-sky-450 leading-none">
                                    {(selectedFinding.equipmentDurationSeconds || Math.round(((parseAnyDate(selectedFinding.equipmentCompletedAt)?.getTime() || 0) - (parseAnyDate(selectedFinding.equipmentStartedAt)?.getTime() || 0)) / 1000))}s
                                 </p>
                                 <p className="text-[10px] font-bold text-sky-400 dark:text-sky-500 uppercase tracking-tighter">Tiempo Equipo</p>
                              </div>
                           )}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="space-y-1">
                        <p className="text-[10px] font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-widest">Estado y Cierre</p>
                        <div className="bg-zinc-50 dark:bg-zinc-900 p-3 rounded-2xl border border-zinc-100 dark:border-white/5 space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-zinc-500 dark:text-zinc-400 font-medium font-medium">Reportado</span>
                            <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100">{getFindingDate(selectedFinding) ? format(getFindingDate(selectedFinding)!, 'dd MMM, HH:mm') : '--:--'}</span>
                          </div>
                          {selectedFinding.closedAt && (
                            <div className="flex items-center justify-between pt-2 border-t border-zinc-200/50 dark:border-white/5">
                              <span className="text-xs text-emerald-600 dark:text-emerald-450 font-medium font-medium">Resolución</span>
                              <div className="text-right">
                                <p className="text-xs font-bold text-emerald-700 dark:text-emerald-400">{parseAnyDate(selectedFinding.closedAt) ? format(parseAnyDate(selectedFinding.closedAt)!, 'dd MMM, HH:mm') : '--:--'}</p>
                                {getFindingDate(selectedFinding) && parseAnyDate(selectedFinding.closedAt) && (
                                  <p className="text-[9px] font-black text-emerald-500 dark:text-emerald-400 uppercase tracking-tighter">
                                    En {Math.round(((parseAnyDate(selectedFinding.closedAt)!.getTime() - getFindingDate(selectedFinding)!.getTime()) / (1000 * 60 * 60)) * 10) / 10} horas
                                  </p>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="pt-3 border-t border-zinc-100 dark:border-white/10 grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          const opProf = getOperatorProfile(selectedFinding.operatorId, selectedFinding.operatorName, selectedFinding.operatorPhotoUrl);
                          downloadOperatorInspectionPDF(selectedFinding, {
                            name: selectedFinding.operatorName || opProf.name,
                            photoUrl: opProf.photoUrl || selectedFinding.operatorPhotoUrl,
                            rut: opProf.rut,
                            cargo: opProf.cargo
                          });
                        }}
                        className="w-full py-3.5 px-3 bg-gradient-to-r from-sky-600 to-sky-700 hover:from-sky-500 hover:to-sky-600 text-white rounded-2xl font-black text-xs uppercase tracking-wider transition-all shadow-md active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <Download className="w-4 h-4" />
                        <span>Descargar PDF</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          const opProf = getOperatorProfile(selectedFinding.operatorId, selectedFinding.operatorName, selectedFinding.operatorPhotoUrl);
                          shareOperatorInspectionPDF(selectedFinding, {
                            name: selectedFinding.operatorName || opProf.name,
                            photoUrl: opProf.photoUrl || selectedFinding.operatorPhotoUrl,
                            rut: opProf.rut,
                            cargo: opProf.cargo
                          });
                        }}
                        className="w-full py-3.5 px-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-2xl font-black text-xs uppercase tracking-wider transition-all shadow-md active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <Share2 className="w-4 h-4" />
                        <span>Compartir PDF</span>
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
    </div>
  );
};

// --- Admin View ---

const NotificationCenter = ({ 
  show, 
  onClose, 
  notifications,
  onDismiss,
  onRead,
  onAction,
  readIds,
  user
}: { 
  show: boolean, 
  onClose: () => void, 
  notifications: Notification[],
  onDismiss: (id: string) => void,
  onRead: (id: string) => void,
  onAction: (n: Notification) => void,
  readIds: string[],
  user: AppUser
}) => {
  const [filterMode, setFilterMode] = useState<'unread' | 'all'>('unread');

  const unreadNotifications = notifications.filter(n => !readIds.includes(n.id));
  const displayNotifications = filterMode === 'unread' ? unreadNotifications : notifications;

  const handleMarkAllRead = () => {
    unreadNotifications.forEach(n => onRead(n.id));
  };

  return (
    <AnimatePresence>
      {show && (
        <>
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/20 backdrop-blur-sm z-50"
          />
          <motion.div 
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed top-0 right-0 w-full max-w-sm h-screen bg-white dark:bg-black shadow-2xl dark:shadow-none z-50 flex flex-col border-l border-transparent dark:border-white/20"
          >
            <div className="p-6 border-b border-zinc-100 dark:border-white/10 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <BellRing className="w-5 h-5 text-brand-blue dark:text-sky-400" />
                  <h3 className="font-bold text-zinc-900 dark:text-white uppercase tracking-tight">Notificaciones</h3>
                </div>
                <button onClick={onClose} className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-900 rounded-full transition-colors text-zinc-400 dark:text-zinc-600">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Filter Tabs */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center bg-zinc-100 dark:bg-zinc-900 p-1 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setFilterMode('unread')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                      filterMode === 'unread'
                        ? 'bg-white dark:bg-black text-brand-blue dark:text-sky-400 shadow-xs font-black'
                        : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
                    }`}
                  >
                    <span>Nuevas</span>
                    {unreadNotifications.length > 0 && (
                      <span className="px-1.5 py-0.2 bg-brand-blue dark:bg-sky-500 text-white text-[9px] font-black rounded-full">
                        {unreadNotifications.length}
                      </span>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterMode('all')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      filterMode === 'all'
                        ? 'bg-white dark:bg-black text-zinc-900 dark:text-white shadow-xs font-black'
                        : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
                    }`}
                  >
                    Todas ({notifications.length})
                  </button>
                </div>

                {unreadNotifications.length > 0 && (
                  <button
                    type="button"
                    onClick={handleMarkAllRead}
                    className="text-[10px] font-bold text-brand-blue dark:text-sky-400 hover:underline uppercase tracking-tight cursor-pointer"
                  >
                    Marcar leídas
                  </button>
                )}
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar dark:bg-black">
              {displayNotifications.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-zinc-400 gap-3 opacity-60 p-6 text-center">
                  <div className="w-14 h-14 bg-zinc-50 dark:bg-zinc-900 rounded-2xl flex items-center justify-center border border-zinc-100 dark:border-white/10">
                    <CheckCircle2 className="w-7 h-7 text-emerald-500/60" />
                  </div>
                  <div>
                    <p className="font-bold text-sm text-zinc-800 dark:text-white">
                      {filterMode === 'unread' ? '¡Estás al día!' : 'Sin notificaciones'}
                    </p>
                    <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-1">
                      {filterMode === 'unread' 
                        ? 'No tienes notificaciones nuevas sin leer.' 
                        : 'No se encontraron notificaciones registradas.'}
                    </p>
                  </div>
                </div>
              ) : (
                displayNotifications.map((n, idx) => {
                  const isRead = readIds.includes(n.id);
                  const isAdmin = user.role === 'Administrador';
                  
                  return (
                    <div 
                      key={`${n.id}-${idx}`} 
                      onClick={() => {
                        if (!isRead) onRead(n.id);
                        onAction(n);
                      }}
                      className={`p-5 rounded-[2rem] border transition-all cursor-pointer relative group ${
                        isRead 
                          ? 'bg-zinc-50/50 dark:bg-black border-zinc-100 dark:border-white/10 opacity-60' 
                          : 'bg-white dark:bg-black border-zinc-200 dark:border-white/20 hover:border-brand-blue/30 dark:hover:border-white shadow-sm dark:shadow-none'
                      }`}
                    >
                      {!isRead && (
                        <div className="absolute top-5 right-5 w-2 h-2 bg-brand-blue dark:bg-sky-400 rounded-full shadow-[0_0_8px_rgba(14,165,233,0.5)] dark:shadow-none" />
                      )}
                      
                      <div className="absolute bottom-3 right-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
                        {isAdmin && (
                          <button 
                            onClick={async (e) => {
                              e.stopPropagation();
                              if (window.confirm('¿ELIMINAR ESTA NOTIFICACIÓN GLOBALMENTE?')) {
                                try {
                                  await deleteDoc(doc(db, 'notifications', n.id));
                                } catch (err) {
                                  console.error("Error deleting notification:", err);
                                }
                              }
                            }}
                            className="p-2 text-zinc-400 dark:text-zinc-600 hover:text-red-500 dark:hover:text-red-400 rounded-xl hover:bg-red-50 dark:hover:bg-red-500/10 border border-transparent hover:border-red-100 dark:hover:border-red-500/20"
                            title="Eliminar globalmente (Admin)"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            onDismiss(n.id);
                          }}
                          className="p-2 text-zinc-400 dark:text-zinc-600 hover:text-zinc-900 dark:hover:text-white rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-900 border border-transparent hover:border-zinc-200 dark:hover:border-white/10"
                          title="Ocultar"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="flex items-center justify-between pr-8 mb-3">
                         <span className={`text-[8px] font-black uppercase tracking-[0.2em] px-2.5 py-1 rounded-full ${
                           n.type === 'Finding' ? 'bg-red-100 dark:bg-red-500/10 text-red-600 dark:text-red-400' : 
                           n.type === 'System' ? 'bg-sky-100 dark:bg-sky-500/10 text-brand-blue dark:text-sky-400' : 
                           'bg-amber-100 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400'
                         }`}>
                           {n.type === 'Finding' ? 'Hallazgo' : n.type === 'System' ? 'Sistema' : 'Anuncio'}
                         </span>
                         <span className="text-[10px] text-zinc-400 dark:text-zinc-600 font-bold italic">
                           {n.createdAt?.toDate ? format(n.createdAt.toDate(), 'dd/MM, HH:mm', { locale: es }) : '--:--'}
                         </span>
                      </div>
                      <p className={`font-black text-sm uppercase tracking-tight leading-tighter ${isRead ? 'text-zinc-500 dark:text-zinc-400' : 'text-zinc-900 dark:text-white'}`}>{n.title}</p>
                      <p className={`text-xs leading-relaxed mt-1 font-medium ${isRead ? 'text-zinc-400 dark:text-zinc-500' : 'text-zinc-600 dark:text-zinc-300'}`}>{n.message}</p>
                    </div>
                  );
                })
              )}
            </div>
            
            <div className="p-8 border-t border-zinc-100 dark:border-white/10 bg-zinc-50/50 dark:bg-black">
               <p className="text-[10px] text-zinc-400 dark:text-zinc-500 text-center font-black uppercase tracking-[0.3em]">Chekify Hub 2024</p>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

const AdminNotificationManagement = ({ plants }: { plants: {id: string, name: string}[] }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [targetRole, setTargetRole] = useState<'All' | 'Administrador' | 'Supervisor' | 'Operador'>('All');
  const [selectedPlantId, setSelectedPlantId] = useState('');
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleTime, setScheduleTime] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ text: string, type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    const unsubNotif = onSnapshot(query(collection(db, 'notifications'), orderBy('createdAt', 'desc'), limit(50)), (snapshot) => {
      setNotifications(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any)));
    });
    return () => {
      unsubNotif();
    };
  }, []);

  const handleSave = async () => {
    if (!title || !message) return;
    setIsSaving(true);
    
    try {
      const scheduledAt = scheduleDate && scheduleTime 
        ? Timestamp.fromDate(new Date(`${scheduleDate}T${scheduleTime}`)) 
        : serverTimestamp();

      const data = {
        title,
        message,
        type: 'Announcement',
        targetRole,
        plantId: selectedPlantId || null,
        scheduledAt,
        status: (scheduleDate && scheduleTime) ? 'Pending' : 'Sent',
        createdAt: serverTimestamp(),
        createdBy: auth.currentUser?.uid || 'system'
      };

      if (editingId) {
        await updateDoc(doc(db, 'notifications', editingId), data);
        setFeedback({ text: 'Notificación actualizada', type: 'success' });
      } else {
        await addDoc(collection(db, 'notifications'), data);
        setFeedback({ text: 'Notificación enviada/programada', type: 'success' });
      }

      resetForm();
    } catch (err) {
      setFeedback({ text: 'Error al procesar', type: 'error' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleEdit = (n: Notification) => {
    setEditingId(n.id);
    setTitle(n.title);
    setMessage(n.message);
    setTargetRole(n.targetRole);
    setSelectedPlantId(n.plantId || '');
    if (n.scheduledAt?.toDate) {
      const d = n.scheduledAt.toDate();
      setScheduleDate(format(d, 'yyyy-MM-dd'));
      setScheduleTime(format(d, 'HH:mm'));
    }
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('¿Eliminar esta notificación?')) {
      await deleteDoc(doc(db, 'notifications', id));
    }
  };

  const resetForm = () => {
    setShowForm(false);
    setEditingId(null);
    setTitle('');
    setMessage('');
    setTargetRole('All');
    setSelectedPlantId('');
    setScheduleDate('');
    setScheduleTime('');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-bold text-zinc-900 dark:text-white uppercase tracking-tight">Mensajes Push & Segmentación</h3>
        <button 
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 bg-zinc-900 dark:bg-white text-white dark:text-black px-4 py-2 rounded-2xl font-bold text-xs hover:bg-zinc-800 dark:hover:bg-zinc-100 transition-all uppercase tracking-widest shadow-lg shadow-zinc-200 dark:shadow-none"
        >
          <Plus className="w-4 h-4" />
          Nueva Notificación
        </button>
      </div>

      <PushNotificationWidget user={{ uid: auth.currentUser?.uid || 'admin', email: auth.currentUser?.email || '', name: 'Administrador', role: 'Supervisor' }} />

      {feedback && <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest ml-1">{feedback.text}</p>}

      <div className="grid gap-3">
        {notifications.map((n, nIdx) => (
          <div key={`notif-admin-list-${n.id}-${nIdx}`} className="bg-white dark:bg-black border border-zinc-100 dark:border-white/10 p-4 rounded-2xl group relative hover:shadow-md dark:hover:shadow-none transition-all">
            <div className="flex justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-[8px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full ${n.status === 'Sent' ? 'bg-emerald-100 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-amber-100 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400'}`}>
                    {n.status === 'Sent' ? 'Enviado' : 'Programado'}
                  </span>
                  <span className="text-[8px] text-zinc-400 dark:text-zinc-600 font-black uppercase tracking-[0.2em]">{n.targetRole}</span>
                  {n.plantId && (
                    <span className="text-[8px] text-brand-blue dark:text-sky-400 font-bold uppercase tracking-widest bg-sky-50 dark:bg-sky-500/10 px-2 py-0.5 rounded-full">
                      {plants.find(p => p.id === n.plantId)?.name || 'Planta'}
                    </span>
                  )}
                </div>
                <h4 className="font-bold text-zinc-900 dark:text-white text-sm uppercase tracking-tight">{n.title}</h4>
                <p className="text-xs text-zinc-500 dark:text-zinc-500 font-medium">{n.message}</p>
                <div className="flex items-center gap-1 mt-2 text-[9px] text-zinc-400 dark:text-zinc-600 font-bold">
                  <Clock className="w-3 h-3" />
                  {n.scheduledAt?.toDate ? format(n.scheduledAt.toDate(), "dd MMM, HH:mm", { locale: es }) : 'Instantáneo'}
                </div>
              </div>
              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => handleEdit(n)} className="p-2 text-zinc-400 dark:text-zinc-600 hover:text-zinc-900 dark:hover:text-white transition-colors"><Edit3 className="w-4 h-4"/></button>
                <button onClick={() => handleDelete(n.id)} className="p-2 text-zinc-400 dark:text-zinc-600 hover:text-red-500 transition-colors"><Trash2 className="w-4 h-4"/></button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {showForm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
           <div onClick={resetForm} className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
           <div className="relative bg-white dark:bg-black w-full max-w-lg rounded-[2.5rem] p-8 shadow-2xl dark:shadow-none border border-transparent dark:border-white/10">
              <h3 className="text-xl font-bold mb-6 text-zinc-900 dark:text-white uppercase tracking-tight">{editingId ? 'Editar' : 'Programar'} Notificación</h3>
              <div className="space-y-4">
                <input value={title} onChange={e => setTitle(e.target.value)} className="w-full p-4 bg-zinc-50 dark:bg-zinc-900 border border-zinc-100 dark:border-white/5 rounded-2xl outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-white transition-all dark:text-white font-bold" placeholder="Título" />
                <textarea value={message} onChange={e => setMessage(e.target.value)} className="w-full p-4 bg-zinc-50 dark:bg-zinc-900 border border-zinc-100 dark:border-white/5 rounded-2xl outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-white transition-all dark:text-white font-medium" placeholder="Mensaje..." rows={3} />
                <div className="grid grid-cols-2 gap-4">
                  <select value={targetRole} onChange={e => setTargetRole(e.target.value as any)} className="w-full p-4 bg-zinc-50 dark:bg-zinc-900 border border-zinc-100 dark:border-white/5 rounded-2xl outline-none dark:text-white font-bold text-xs uppercase tracking-tight">
                    <option value="All" className="dark:bg-black">Todos los Roles</option>
                    <option value="Administrador" className="dark:bg-black">Solo Admins</option>
                    <option value="Supervisor" className="dark:bg-black">Solo Supervisores</option>
                    <option value="Operador" className="dark:bg-black">Solo Operadores</option>
                  </select>
                  <select value={selectedPlantId} onChange={e => setSelectedPlantId(e.target.value)} className="w-full p-4 bg-zinc-50 dark:bg-zinc-900 border border-zinc-100 dark:border-white/5 rounded-2xl outline-none dark:text-white font-bold text-xs uppercase tracking-tight">
                    <option value="" className="dark:bg-black">Todas las Plantas (Global)</option>
                    {plants.map(p => (
                      <option key={p.id} value={p.id} className="dark:bg-black">{p.name}</option>
                    ))}
                  </select>
                </div>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <label className="block text-[8px] font-black text-zinc-400 dark:text-zinc-600 uppercase tracking-widest mb-1 ml-1 leading-none">Fecha Programada (Opcional)</label>
                    <input type="date" value={scheduleDate} onChange={e => setScheduleDate(e.target.value)} className="w-full p-3 bg-zinc-50 dark:bg-zinc-900 border border-zinc-100 dark:border-white/5 rounded-xl text-xs dark:text-white font-bold" />
                  </div>
                  <div className="flex-1">
                    <label className="block text-[8px] font-black text-zinc-400 dark:text-zinc-600 uppercase tracking-widest mb-1 ml-1 leading-none">Hora Programada</label>
                    <input type="time" value={scheduleTime} onChange={e => setScheduleTime(e.target.value)} className="w-full p-3 bg-zinc-50 dark:bg-zinc-900 border border-zinc-100 dark:border-white/5 rounded-xl text-xs dark:text-white font-bold" />
                  </div>
                </div>
                <div className="flex gap-3 pt-4">
                  <button onClick={handleSave} disabled={isSaving} className="flex-1 py-4 bg-zinc-900 dark:bg-white text-white dark:text-black rounded-2xl font-black uppercase tracking-widest text-xs flex items-center justify-center gap-2 hover:opacity-90 transition-all shadow-xl shadow-zinc-200 dark:shadow-none">
                    {isSaving && <div className="w-4 h-4 border-2 border-white/30 dark:border-black/30 border-t-white dark:border-t-black rounded-full animate-spin"/>}
                    {editingId ? 'Actualizar' : 'Enviar/Programar'}
                  </button>
                </div>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

const AdminReportSettings = () => {
  const [settings, setSettings] = useState<ReportSettings>({
    logoUrl: '',
    headerText: '',
    footerText: '',
    companyName: ''
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ text: string, type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const docRef = doc(db, 'settings', 'reportConfig');
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setSettings(docSnap.data() as ReportSettings);
        }
      } catch (err) {
        console.error("Error loading settings", err);
      } finally {
        setLoading(false);
      }
    };
    fetchSettings();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await setDoc(doc(db, 'settings', 'reportConfig'), {
        ...settings,
        updatedAt: serverTimestamp()
      });
      setMessage({ text: 'Configuración guardada exitosamente', type: 'success' });
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      console.error(error);
      setMessage({ text: 'Error al guardar configuración', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center p-12">
      <div className="w-8 h-8 border-4 border-zinc-400 dark:border-white/10 border-t-zinc-900 dark:border-t-white rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="bg-white dark:bg-black p-8 rounded-[2rem] border border-zinc-100 dark:border-white/10 shadow-sm dark:shadow-none space-y-8">
      <div className="flex items-center gap-3">
        <FileText className="w-6 h-6 text-zinc-900 dark:text-white" />
        <h3 className="text-xl font-bold text-zinc-900 dark:text-white uppercase tracking-tight">Configuración de Reportes PDF</h3>
      </div>
      
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="block text-[10px] font-bold text-zinc-400 dark:text-zinc-600 uppercase tracking-[0.2em] ml-1">Logo de la Empresa</label>
            <div className="flex items-center gap-4">
              <input 
                type="file" 
                accept="image/*" 
                id="reportLogoInput"
                className="hidden" 
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    const reader = new FileReader();
                    reader.onloadend = async () => {
                      const base64 = reader.result as string;
                      try {
                        const compressed = await compressImage(base64);
                        setSettings(prev => ({ ...prev, logoUrl: compressed }));
                      } catch (err) {
                        setSettings(prev => ({ ...prev, logoUrl: base64 }));
                      }
                    };
                    reader.readAsDataURL(file);
                  }
                }}
              />
              <label 
                htmlFor="reportLogoInput"
                className="flex-1 p-4 bg-zinc-50 dark:bg-zinc-900 border border-zinc-100 dark:border-white/5 rounded-2xl flex items-center justify-center gap-2 cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all border-dashed"
              >
                <Camera className="w-5 h-5 text-zinc-400 dark:text-zinc-600" />
                <span className="text-xs font-black text-zinc-500 dark:text-zinc-400 uppercase tracking-widest">Subir Logo</span>
              </label>
            </div>
          </div>
          <div className="space-y-2">
             <label className="block text-[10px] font-bold text-zinc-400 dark:text-zinc-600 uppercase tracking-[0.2em] ml-1">Nombre de la Empresa</label>
             <input 
              type="text"
              value={settings.companyName} 
              onChange={e => setSettings({...settings, companyName: e.target.value})}
              className="w-full p-4 bg-zinc-50 dark:bg-zinc-900 border border-zinc-100 dark:border-white/5 rounded-2xl outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-white transition-all dark:text-white font-bold"
              placeholder="Ej: Industrial Corp S.A."
            />
            <label className="block text-[10px] font-bold text-zinc-400 dark:text-zinc-600 uppercase tracking-[0.2em] mt-4 ml-1">Vista Previa Logo</label>
            <div className="w-full h-24 bg-zinc-50 dark:bg-zinc-900 rounded-2xl border border-dashed border-zinc-200 dark:border-white/10 flex items-center justify-center overflow-hidden">
               {settings.logoUrl ? (
                 <img src={settings.logoUrl} className="max-h-full max-w-full object-contain" alt="Logo Preview" />
               ) : (
                 <p className="text-[10px] text-zinc-300 dark:text-zinc-700 font-bold uppercase tracking-widest">Sin Logo</p>
               )}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-[10px] font-bold text-zinc-400 dark:text-zinc-600 uppercase tracking-[0.2em] mb-1 ml-1">Texto del Encabezado</label>
            <input 
              type="text"
              value={settings.headerText} 
              onChange={e => setSettings({...settings, headerText: e.target.value})}
              className="w-full p-4 bg-zinc-50 dark:bg-zinc-900 border border-zinc-100 dark:border-white/5 rounded-2xl outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-white transition-all dark:text-white font-bold"
              placeholder="Texto secundario en el encabezado"
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-zinc-400 dark:text-zinc-600 uppercase tracking-[0.2em] mb-1 ml-1">Texto del Pie de Página</label>
            <input 
              type="text"
              value={settings.footerText} 
              onChange={e => setSettings({...settings, footerText: e.target.value})}
              className="w-full p-4 bg-zinc-50 dark:bg-zinc-900 border border-zinc-100 dark:border-white/5 rounded-2xl outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-white transition-all dark:text-white font-bold"
              placeholder="Notas legales o pies de página personalizados..."
            />
          </div>
        </div>
      </div>

      <AnimatePresence>
        {message && (
          <motion.p 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className={`text-xs font-black uppercase tracking-widest text-center ${message.type === 'success' ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}
          >
            {message.text}
          </motion.p>
        )}
      </AnimatePresence>

      <button 
        onClick={handleSave}
        disabled={saving}
        className="w-full py-4 bg-zinc-900 dark:bg-white text-white dark:text-black rounded-2xl font-black flex items-center justify-center gap-2 hover:bg-zinc-800 dark:hover:bg-zinc-100 transition-all shadow-xl shadow-zinc-200 dark:shadow-none disabled:opacity-50 uppercase tracking-[0.2em]"
      >
        {saving ? 'Guardando...' : 'Guardar Configuración de Reportes'}
      </button>
    </div>
  );
};

// --- Bulk Upload Helper ---

const BulkUpload = ({ 
  entityType, 
  onComplete, 
  onError,
  plants, 
  areas 
}: { 
  entityType: 'Users' | 'Plants' | 'Areas' | 'Equipment',
  onComplete: (count: number) => void,
  onError: (err: string) => void,
  plants?: {id: string, name: string}[],
  areas?: Area[]
}) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processCsv = async (file: File) => {
    setIsProcessing(true);
    const reader = new FileReader();

    reader.onload = async (e) => {
      try {
        const text = e.target?.result as string;
        const lines = text.split('\n').map(l => l.trim()).filter(l => l);
        if (lines.length < 2) throw new Error("El archivo está vacío o no tiene encabezados.");

        const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
        const data = lines.slice(1).map(line => {
          const values = line.split(',').map(v => v.trim());
          const obj: any = {};
          headers.forEach((header, index) => {
            obj[header] = values[index];
          });
          return obj;
        });

        let count = 0;

        for (const item of data) {
          try {
            if (entityType === 'Plants') {
              const name = item.nombre || item.name;
              if (!name) continue;
              const baseSlug = generateSafeId(name) || 'plant';
              const id = item.id || `plant-${baseSlug}-${Math.random().toString(36).substring(2, 6)}`;
              await setDoc(doc(db, 'plants', id), { id, name });
              count++;
            } 
            else if (entityType === 'Areas') {
              const name = item.nombre || item.name;
              const plantInput = item.planta_id || item.planta || item.plantid;
              if (!name || !plantInput) continue;
              
              // Find plant ID if name was provided
              let plantId = plantInput;
              if (plants) {
                const found = plants.find(p => p.id === plantInput || (p.name || '').toLowerCase() === (plantInput || '').toLowerCase());
                if (found) plantId = found.id;
              }

              const baseSlug = generateSafeId(name) || 'area';
              const id = item.id || `area-${plantId}-${baseSlug}-${Math.random().toString(36).substring(2, 6)}`;
              await setDoc(doc(db, 'areas', id), { 
                id, 
                name, 
                plantId, 
                qrCode: item.qr || item.qrcode || id.toUpperCase() 
              });
              count++;
            }
            else if (entityType === 'Equipment') {
              const name = item.nombre || item.name || item.nombre_equipo;
              const plantInput = item.planta || item.planta_id;
              const areaInput = item.area || item.area_id;
              
              if (!name || !plantInput || !areaInput) continue;

              // Resolve Plant
              let plantId = plantInput;
              if (plants) {
                const found = plants.find(p => p.id === plantInput || (p.name || '').toLowerCase() === (plantInput || '').toLowerCase());
                if (found) plantId = found.id;
              }

              // Resolve Area
              let areaId = areaInput;
              if (areas) {
                const found = areas.find(a => a.id === areaInput || (a.name || '').toLowerCase() === (areaInput || '').toLowerCase());
                if (found) areaId = found.id;
              }

              const baseSlug = generateSafeId(name) || 'equipo';
              const id = item.id || (item.tag ? `eq-${areaId}-${generateSafeId(item.tag)}-${Math.random().toString(36).substring(2, 6)}` : `eq-${areaId}-${baseSlug}-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`);
              const checkItemsStr = item.tipo_de_equipo || item.items || item.check_items || "";
              const checkItems = checkItemsStr.split(';').map((s: string) => s.trim()).filter((s: string) => s).map((s: string) => ({
                id: Math.random().toString(36).substr(2, 9),
                name: s
              }));

              const equipmentTag = item.tag || item.etiqueta_tag || item.tag_equipo || item.codigo_tag || "";

              await setDoc(doc(db, 'equipment', id), {
                id,
                name,
                tag: equipmentTag,
                plantId,
                areaId,
                inspectionOrder: parseInt(item.orden || "0"),
                checkItems,
                qrCode: equipmentTag || id.toUpperCase(),
                inspeccionVOSO: DEFAULT_VOSO
              });
              count++;
            }
            else if (entityType === 'Users') {
              let email = item.usuario || item.email || item.correo;
              const name = item.nombre || item.name;
              const roleIn = (item.rol || item.role || 'Operador') as any;
              const plantInput = item.planta || item.planta_id;

              if (!email || !name) continue;

              // Force dummy domain if it looks like a username
              if (!email.includes('@')) {
                email = `${email}@chekify.local`;
              }

              let plantId = plantInput || "";
              if (plants && plantInput) {
                const found = plants.find(p => p.id === plantInput || (p.name || '').toLowerCase() === (plantInput || '').toLowerCase());
                if (found) plantId = found.id;
              }

              // Map role
              let role: UserRole = 'Operador';
              if (['admin', 'administrador'].includes(roleIn?.toLowerCase())) role = 'Administrador';
              if (['supervisor'].includes(roleIn?.toLowerCase())) role = 'Supervisor';

              await setDoc(doc(db, 'users', email.replace(/[^a-zA-Z0-9]/g, '_')), {
                email,
                name,
                role,
                plantId,
                uid: email.replace(/[^a-zA-Z0-9]/g, '_')
              }, { merge: true });
              count++;
            }
          } catch (err: any) {
            console.error(`Error processing item:`, item, err);
          }
        }

        onComplete(count);
      } catch (err: any) {
        onError(err.message || "Error al procesar el archivo");
      } finally {
        setIsProcessing(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };

    reader.readAsText(file);
  };

  const getTemplate = () => {
    if (entityType === 'Plants') return "id,nombre\nPLANTA-01,Planta Norte";
    if (entityType === 'Areas') return "id,planta_id,nombre,qr\nAREA-01,PLANTA-01,Zona de Carga,QR001";
    if (entityType === 'Equipment') return "id,planta,area,nombre,orden,check_items\nEQ-01,Planta Norte,Zona de Carga,Motor Principal,1,Cableado;Aceite;Temperatura";
    if (entityType === 'Users') return "nombre,usuario,rol,planta\nJuan Perez,juan.perez,Operador,Planta Norte";
    return "";
  };

  return (
    <div className="bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-100 dark:border-white/5 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-white dark:bg-black rounded-xl shadow-sm dark:shadow-none flex items-center justify-center text-zinc-400 dark:text-zinc-600">
          <Upload className="w-5 h-5" />
        </div>
        <div>
          <p className="text-xs font-black text-zinc-900 dark:text-white uppercase tracking-tight">Carga Masiva de {
            entityType === 'Users' ? 'Usuarios' :
            entityType === 'Plants' ? 'Plantas' :
            entityType === 'Areas' ? 'Áreas' : 'Equipos'
          }</p>
          <p className="text-[10px] text-zinc-400 dark:text-zinc-500 font-bold tracking-tight uppercase">Sube un archivo CSV con los datos</p>
        </div>
      </div>
      
      <div className="flex items-center gap-2 w-full sm:w-auto">
        <button 
          onClick={() => {
            const blob = new Blob([getTemplate()], { type: 'text/csv' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `plantilla_${entityType.toLowerCase()}.csv`;
            a.click();
          }}
          className="flex-1 sm:flex-none px-3 py-2 text-[10px] font-black uppercase text-brand-blue dark:text-sky-400 hover:bg-white dark:hover:bg-black rounded-lg transition-all border border-transparent hover:border-brand-blue/10 dark:hover:border-sky-400/10"
        >
          Descargar Plantilla
        </button>
        <div className="relative flex-1 sm:flex-none">
          <input 
            type="file" 
            accept=".csv"
            ref={fileInputRef}
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) processCsv(file);
            }}
          />
          <button 
            disabled={isProcessing}
            onClick={() => fileInputRef.current?.click()}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-zinc-900 dark:bg-white text-white dark:text-black rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-zinc-800 dark:hover:bg-zinc-100 transition-all shadow-lg shadow-zinc-200 dark:shadow-none disabled:opacity-50"
          >
            {isProcessing ? (
              <div className="w-3 h-3 border-2 border-white/30 dark:border-black/30 border-t-white dark:border-t-black rounded-full animate-spin" />
            ) : <Upload className="w-3 h-3" />}
            Subir CSV
          </button>
        </div>
      </div>
    </div>
  );
};

const AdminManagement = ({ plants }: { plants: {id: string, name: string}[] }) => {
  const [activeSubTab, setActiveSubTab] = useState<'Users' | 'Plants' | 'Areas' | 'Equipment'>('Users');
  const [areas, setAreas] = useState<Area[]>([]);
  const [equipmentList, setEquipmentList] = useState<Equipment[]>([]);

  useEffect(() => {
    const unsubAreas = AreaService.subscribeToAreas((areaData) => {
      setAreas(areaData);
    });
    const unsubEquip = EquipmentService.subscribeToEquipment((items) => {
      setEquipmentList(items);
    });

    return () => {
      unsubAreas();
      unsubEquip();
    };
  }, []);
  
  return (
    <div className="space-y-6">
      <div className="flex bg-zinc-100 dark:bg-zinc-900 p-1 rounded-2xl overflow-x-auto no-scrollbar border border-transparent dark:border-white/5">
        {(['Users', 'Plants', 'Areas', 'Equipment'] as const).map((tab, tIdx) => (
          <button
            key={`admin-tab-${tab}-${tIdx}`}
            onClick={() => setActiveSubTab(tab)}
            className={`flex-1 min-w-[100px] px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
              activeSubTab === tab ? 'bg-white dark:bg-black text-zinc-900 dark:text-white shadow-sm dark:shadow-none' : 'text-zinc-500 dark:text-zinc-600 hover:text-zinc-700 dark:hover:text-zinc-400'
            }`}
          >
            {tab === 'Users' ? 'Usuarios' : 
             tab === 'Plants' ? 'Plantas' : 
             tab === 'Areas' ? 'Áreas' : 'Equipos'}
          </button>
        ))}
      </div>

      {activeSubTab === 'Users' && <AdminUserManagement plants={plants} />}
      {activeSubTab === 'Plants' && <AdminPlantManagement plants={plants} />}
      {activeSubTab === 'Areas' && <AdminAreaManagement plants={plants} areas={areas} equipment={equipmentList} />}
      {activeSubTab === 'Equipment' && <AdminEquipmentManagement plants={plants} areas={areas} equipment={equipmentList} />}
    </div>
  );
};

const AdminPlantManagement = ({ plants }: { plants: Plant[] }) => {
  const [showForm, setShowForm] = useState(false);
  const [editingPlant, setEditingPlant] = useState<Plant | null>(null);
  const [plantData, setPlantData] = useState({
    name: '',
    city: '',
    country: '',
    latitude: '',
    longitude: '',
    timezone: 'auto'
  });
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string, type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => setMessage(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [message]);

  const handleOpenForm = (p?: Plant) => {
    if (p) {
      setEditingPlant(p);
      setPlantData({
        name: p.name || '',
        city: p.city || '',
        country: p.country || '',
        latitude: p.latitude !== undefined ? String(p.latitude) : '',
        longitude: p.longitude !== undefined ? String(p.longitude) : '',
        timezone: p.timezone || 'auto'
      });
    } else {
      setEditingPlant(null);
      setPlantData({ name: '', city: '', country: '', latitude: '', longitude: '', timezone: 'auto' });
    }
    setShowForm(true);
  };

  const handleGetLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setPlantData(prev => ({
            ...prev,
            latitude: position.coords.latitude.toFixed(4),
            longitude: position.coords.longitude.toFixed(4)
          }));
          setMessage({ text: "Coordenadas GPS capturadas con éxito", type: 'success' });
        },
        (err) => {
          console.error("Error GPS:", err);
          setMessage({ text: "No se pudo obtener el GPS actual: " + err.message, type: 'error' });
        }
      );
    } else {
      setMessage({ text: "Geolocalización no soportada por el navegador", type: 'error' });
    }
  };

  const handleSave = async () => {
    if (!plantData.name) {
      setMessage({ text: "Ingresa el nombre de la planta", type: 'error' });
      return;
    }
    
    try {
      const baseSlug = generateSafeId(plantData.name) || 'plant';
      const id = editingPlant ? editingPlant.id : `plant-${baseSlug}-${Math.random().toString(36).substring(2, 6)}`;
      
      const payload: any = {
        id,
        name: plantData.name,
        city: plantData.city,
        country: plantData.country,
        timezone: plantData.timezone || 'auto'
      };

      if (plantData.latitude) payload.latitude = parseFloat(plantData.latitude);
      if (plantData.longitude) payload.longitude = parseFloat(plantData.longitude);

      await setDoc(doc(db, 'plants', id), payload, { merge: true });
      setShowForm(false);
      setEditingPlant(null);
      setMessage({ text: "Planta guardada correctamente con datos Open-Meteo", type: 'success' });
    } catch (err: any) {
      console.error("Error al guardar planta:", err);
      setMessage({ text: "Error al guardar planta", type: 'error' });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await setDoc(doc(db, 'plants', id), { status: 'deleted' }, { merge: true });
      setMessage({ text: "Planta eliminada correctamente", type: 'success' });
      setConfirmDeleteId(null);
    } catch (err: any) {
      setMessage({ text: "Error al eliminar planta", type: 'error' });
      setConfirmDeleteId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-zinc-900 dark:text-white uppercase tracking-tight">Plantas Industriales</h3>
        <button onClick={() => handleOpenForm()} className="p-2 bg-brand-blue text-white rounded-xl hover:opacity-90 transition-all shadow-md shadow-sky-100 dark:shadow-none"><Plus className="w-4 h-4" /></button>
      </div>

      <BulkUpload 
        entityType="Plants" 
        onComplete={(count) => setMessage({ text: `Se cargaron ${count} plantas exitosamente`, type: 'success' })}
        onError={(err) => setMessage({ text: err, type: 'error' })}
      />

      <div className="grid gap-3">
        {plants.filter(p => (p as any).status !== 'deleted').map((p, pIdx) => (
          <div key={`pl-${p.id}-${pIdx}`} className="bg-white dark:bg-black p-4 rounded-2xl border border-zinc-100 dark:border-white/10 flex justify-between items-center hover:shadow-sm dark:hover:shadow-none transition-all">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-zinc-900 dark:text-white">{p.name}</span>
                {p.latitude && p.longitude && (
                  <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400 text-[10px] font-bold">
                    GPS Open-Meteo OK
                  </span>
                )}
              </div>
              <p className="text-[10px] text-zinc-400 dark:text-zinc-600 uppercase font-black tracking-widest">
                ID: {p.id} {p.city ? `• ${p.city}` : ''} {p.latitude ? `(${p.latitude}, ${p.longitude})` : ''}
              </p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => handleOpenForm(p)} className="p-2 text-zinc-400 dark:text-zinc-600 hover:text-zinc-900 dark:hover:text-white transition-colors"><FileText className="w-4 h-4" /></button>
              <button onClick={() => setConfirmDeleteId(p.id)} className="p-2 text-zinc-400 dark:text-zinc-600 hover:text-red-500 transition-colors"><X className="w-4 h-4" /></button>
            </div>
          </div>
        ))}
      </div>
      <AnimatePresence>
        {message && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}
            className={`fixed top-4 right-4 z-[60] px-4 py-3 rounded-2xl shadow-xl dark:shadow-none border text-sm font-bold flex items-center gap-2 ${
              message.type === 'success' ? 'bg-emerald-50 border-emerald-100 text-emerald-700' : 'bg-red-50 border-red-100 text-red-700'
            }`}
          >
            {message.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
            {message.text}
          </motion.div>
        )}

        {confirmDeleteId && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-6">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white dark:bg-black rounded-3xl p-8 max-w-sm w-full shadow-2xl dark:shadow-none space-y-6 border border-zinc-100 dark:border-white/10"
            >
              <div className="w-12 h-12 bg-red-50 dark:bg-red-500/10 rounded-2xl flex items-center justify-center text-red-500 mx-auto">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div className="text-center space-y-2">
                <h3 className="text-xl font-bold text-zinc-900 dark:text-white">¿Eliminar planta?</h3>
                <p className="text-zinc-500 dark:text-zinc-400 text-sm leading-relaxed">
                  Esta acción desactivará la planta. Los datos históricos se mantendrán pero la planta ya no aparecerá en las selecciones.
                </p>
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setConfirmDeleteId(null)} className="flex-1 px-4 py-3 rounded-2xl bg-zinc-100 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 font-bold text-sm hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-all">Cancelar</button>
                <button onClick={() => handleDelete(confirmDeleteId)} className="flex-1 px-4 py-3 rounded-2xl bg-red-500 text-white font-bold text-sm hover:bg-red-600 transition-all shadow-lg shadow-red-200 dark:shadow-none">Eliminar</button>
              </div>
            </motion.div>
          </div>
        )}

        {showForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowForm(false)} className="absolute inset-0 bg-zinc-900/60 backdrop-blur-sm" />
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }} className="relative w-full max-w-md bg-white dark:bg-black rounded-[2.5rem] shadow-2xl dark:shadow-none flex flex-col max-h-[90vh] overflow-hidden border border-zinc-100 dark:border-white/10">
              <div className="p-8 border-b border-zinc-50 dark:border-white/5">
                <h3 className="text-xl font-bold text-zinc-900 dark:text-white">{editingPlant ? 'Editar Planta' : 'Nueva Planta'}</h3>
                <p className="text-xs text-zinc-500 mt-1">Configura las coordenadas para el módulo Open-Meteo</p>
              </div>
              <div className="flex-1 overflow-y-auto p-8 pt-4 custom-scrollbar space-y-4">
                <div>
                  <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block mb-1">Nombre de la Planta</label>
                  <input value={plantData.name} onChange={e => setPlantData({...plantData, name: e.target.value})} placeholder="Ej: Planta Minera Norte" className="w-full p-4 bg-zinc-50 dark:bg-zinc-900 border border-zinc-100 dark:border-white/10 text-zinc-900 dark:text-white rounded-2xl outline-none focus:ring-2 focus:ring-brand-blue" />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block mb-1">Ciudad</label>
                    <input value={plantData.city} onChange={e => setPlantData({...plantData, city: e.target.value})} placeholder="Ej: Antofagasta" className="w-full p-3 bg-zinc-50 dark:bg-zinc-900 border border-zinc-100 dark:border-white/10 text-zinc-900 dark:text-white rounded-xl outline-none text-sm" />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block mb-1">País</label>
                    <input value={plantData.country} onChange={e => setPlantData({...plantData, country: e.target.value})} placeholder="Ej: Chile" className="w-full p-3 bg-zinc-50 dark:bg-zinc-900 border border-zinc-100 dark:border-white/10 text-zinc-900 dark:text-white rounded-xl outline-none text-sm" />
                  </div>
                </div>

                <div className="p-4 bg-sky-50/50 dark:bg-sky-500/5 rounded-2xl border border-sky-100 dark:border-sky-500/10 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-brand-blue dark:text-sky-400 flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5" /> Ubicación GPS (Open-Meteo)
                    </span>
                    <button type="button" onClick={handleGetLocation} className="text-[10px] font-bold bg-brand-blue text-white px-2.5 py-1 rounded-lg hover:opacity-90 transition-opacity">
                      Usar GPS Actual
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block mb-1">Latitud</label>
                      <input value={plantData.latitude} onChange={e => setPlantData({...plantData, latitude: e.target.value})} placeholder="Ej: -23.6500" className="w-full p-2.5 bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-white/10 text-zinc-900 dark:text-white rounded-xl outline-none text-xs font-mono" />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block mb-1">Longitud</label>
                      <input value={plantData.longitude} onChange={e => setPlantData({...plantData, longitude: e.target.value})} placeholder="Ej: -70.4000" className="w-full p-2.5 bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-white/10 text-zinc-900 dark:text-white rounded-xl outline-none text-xs font-mono" />
                    </div>
                  </div>
                </div>
              </div>
              <div className="p-8 border-t border-zinc-50 dark:border-white/5 bg-zinc-50 dark:bg-zinc-900/20">
                <div className="flex gap-3">
                  <button onClick={() => setShowForm(false)} className="flex-1 py-4 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 rounded-2xl font-bold hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors">Cancelar</button>
                  <button onClick={handleSave} className="flex-1 py-4 bg-brand-blue text-white rounded-2xl font-bold hover:opacity-90 transition-colors shadow-lg shadow-sky-100 dark:shadow-none">Guardar</button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

const AdminAreaManagement = ({ plants, areas, equipment = [] }: { plants: {id: string, name: string}[], areas: Area[], equipment?: Equipment[] }) => {
  const [showForm, setShowForm] = useState(false);
  const [editingArea, setEditingArea] = useState<Area | null>(null);
  const [formData, setFormData] = useState({ name: '', plantId: '', qrCode: '' });
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string, type: 'success' | 'error' } | null>(null);
  const [qrModalArea, setQrModalArea] = useState<Area | null>(null);
  const [showQRModal, setShowQRModal] = useState(false);

  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => setMessage(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [message]);

  const handleSave = async () => {
    if (!formData.name || !formData.plantId) return;
    try {
      const baseSlug = generateSafeId(formData.name) || 'area';
      const id = editingArea ? editingArea.id : `area-${formData.plantId}-${baseSlug}-${Math.random().toString(36).substring(2, 6)}`;
      await setDoc(doc(db, 'areas', id), { ...formData, id, qrCode: formData.qrCode || id.toUpperCase() });
      setShowForm(false);
      setEditingArea(null);
      setFormData({ name: '', plantId: '', qrCode: '' });
      setMessage({ text: "Área guardada correctamente", type: 'success' });
    } catch (err: any) {
      setMessage({ text: "Error al guardar área", type: 'error' });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await setDoc(doc(db, 'areas', id), { status: 'deleted' }, { merge: true });
      setMessage({ text: "Área eliminada correctamente", type: 'success' });
      setConfirmDeleteId(null);
    } catch (err: any) {
      setMessage({ text: "Error al eliminar área", type: 'error' });
      setConfirmDeleteId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="font-bold text-zinc-900 dark:text-white">Áreas de Inspección</h3>
          <p className="text-[11px] text-zinc-500 dark:text-zinc-400">Gestiona zonas e imprime códigos QR oficiales con logo CheKify para instalación en planta</p>
        </div>
        <div className="flex items-center gap-2">
          {areas.filter(a => (a as any).status !== 'deleted').length > 0 && (
            <button
              type="button"
              onClick={() => {
                setQrModalArea(areas.find(a => (a as any).status !== 'deleted') || null);
                setShowQRModal(true);
              }}
              title="Generar e imprimir fichas o stickers QR de áreas"
              className="px-3 py-2 bg-[#0071E3]/10 hover:bg-[#0071E3]/20 text-[#0071E3] dark:text-[#0A84FF] border border-[#0071E3]/25 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <QrCode className="w-4 h-4" />
              <span>Imprimir Fichas QR</span>
            </button>
          )}
          <button 
            type="button"
            onClick={() => { setEditingArea(null); setFormData({name:'', plantId:'', qrCode:''}); setShowForm(true); }} 
            className="p-2 bg-zinc-900 dark:bg-white text-white dark:text-black rounded-xl hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors cursor-pointer"
            title="Crear Nueva Área"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </div>

      <BulkUpload 
        entityType="Areas"
        plants={plants}
        onComplete={(count) => setMessage({ text: `Se cargaron ${count} áreas exitosamente`, type: 'success' })}
        onError={(err) => setMessage({ text: err, type: 'error' })}
      />

      <div className="grid gap-3">
        {areas.filter(a => (a as any).status !== 'deleted').map((a, aIdx) => (
          <div key={`ar-${a.id}-${aIdx}`} className="bg-white dark:bg-black p-4 rounded-2xl border border-zinc-100 dark:border-white/10 flex justify-between items-center hover:shadow-sm dark:hover:shadow-none transition-all">
            <div>
              <p className="font-bold text-zinc-900 dark:text-white">{a.name}</p>
              <p className="text-[10px] text-zinc-400 dark:text-zinc-600 uppercase font-bold">Planta: {plants.find(p => p.id === (a as any).plantId)?.name || (a as any).plantId}</p>
            </div>
            <div className="flex gap-1.5 items-center">
              <span className="text-[10px] text-zinc-400 dark:text-zinc-600 uppercase font-bold mr-1 tracking-wider">QR: {a.qrCode}</span>
              <button 
                type="button"
                onClick={() => {
                  setQrModalArea(a);
                  setShowQRModal(true);
                }} 
                title="Generar e imprimir código QR con logo CheKify"
                className="p-2 text-[#0071E3] hover:bg-blue-50 dark:hover:bg-blue-950/30 rounded-xl transition-colors cursor-pointer"
              >
                <QrCode className="w-4 h-4" />
              </button>
              <button onClick={() => { setEditingArea(a); setFormData({name: a.name, plantId: (a as any).plantId, qrCode: a.qrCode}); setShowForm(true); }} className="p-2 text-zinc-400 dark:text-zinc-600 hover:text-zinc-900 dark:hover:text-white transition-colors cursor-pointer" title="Editar"><FileText className="w-4 h-4" /></button>
              <button onClick={() => setConfirmDeleteId(a.id)} className="p-2 text-zinc-400 dark:text-zinc-600 hover:text-red-500 transition-colors cursor-pointer" title="Eliminar"><X className="w-4 h-4" /></button>
            </div>
          </div>
        ))}
      </div>
      <AnimatePresence>
        {message && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}
            className={`fixed top-4 right-4 z-[60] px-4 py-3 rounded-2xl shadow-xl dark:shadow-none border text-sm font-bold flex items-center gap-2 ${
              message.type === 'success' ? 'bg-emerald-50 border-emerald-100 text-emerald-700' : 'bg-red-50 border-red-100 text-red-700'
            }`}
          >
            {message.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
            {message.text}
          </motion.div>
        )}

        {confirmDeleteId && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-6">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white dark:bg-black rounded-3xl p-8 max-w-sm w-full shadow-2xl dark:shadow-none space-y-6 border border-zinc-100 dark:border-white/10"
            >
              <div className="w-12 h-12 bg-red-50 dark:bg-red-500/10 rounded-2xl flex items-center justify-center text-red-500 mx-auto">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div className="text-center space-y-2">
                <h3 className="text-xl font-bold text-zinc-900 dark:text-white">¿Eliminar área?</h3>
                <p className="text-zinc-500 dark:text-zinc-400 text-sm leading-relaxed">
                  Esta acción desactivará el área. Los datos históricos de inspecciones y hallazgos se mantendrán.
                </p>
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setConfirmDeleteId(null)} className="flex-1 px-4 py-3 rounded-2xl bg-zinc-100 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 font-bold text-sm hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-all">Cancelar</button>
                <button onClick={() => handleDelete(confirmDeleteId)} className="flex-1 px-4 py-3 rounded-2xl bg-red-500 text-white font-bold text-sm hover:bg-red-600 transition-all shadow-lg shadow-red-200 dark:shadow-none">Eliminar</button>
              </div>
            </motion.div>
          </div>
        )}

        {showForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowForm(false)} className="absolute inset-0 bg-zinc-900/60 backdrop-blur-sm" />
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }} className="relative w-full max-w-md bg-white dark:bg-black rounded-[2.5rem] shadow-2xl dark:shadow-none flex flex-col max-h-[90vh] overflow-hidden border-t sm:border border-zinc-100 dark:border-white/20">
              <div className="p-8 border-b border-zinc-50 dark:border-white/5">
                <h3 className="text-xl font-bold text-zinc-900 dark:text-white">{editingArea ? 'Editar Área' : 'Nueva Área'}</h3>
              </div>
              <div className="flex-1 overflow-y-auto p-8 pt-4 custom-scrollbar">
                <div className="space-y-4">
                  <input value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="Nombre del área" className="w-full p-4 bg-zinc-50 dark:bg-zinc-900 border border-zinc-100 dark:border-white/10 text-zinc-900 dark:text-white rounded-2xl outline-none focus:ring-2 focus:ring-brand-blue" />
                  <select value={formData.plantId} onChange={e => setFormData({...formData, plantId: e.target.value})} className="w-full p-4 bg-zinc-50 dark:bg-zinc-900 border border-zinc-100 dark:border-white/10 text-zinc-900 dark:text-white rounded-2xl outline-none focus:ring-2 focus:ring-brand-blue">
                    <option value="">Seleccionar Planta</option>
                    {plants.map((p, idx) => <option key={`pl-opt-1-${p.id}-${idx}`} value={p.id}>{p.name}</option>)}
                  </select>
                  <input value={formData.qrCode} onChange={e => setFormData({...formData, qrCode: e.target.value})} placeholder="Código QR (opcional)" className="w-full p-4 bg-zinc-50 dark:bg-zinc-900 border border-zinc-100 dark:border-white/10 text-zinc-900 dark:text-white rounded-2xl outline-none focus:ring-2 focus:ring-brand-blue" />
                </div>
              </div>
              <div className="p-8 border-t border-zinc-50 dark:border-white/5 bg-zinc-50 dark:bg-zinc-900/20">
                <div className="flex gap-3 mt-0">
                  <button onClick={() => setShowForm(false)} className="flex-1 py-4 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 rounded-2xl font-bold hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors">Cancelar</button>
                  <button onClick={handleSave} className="flex-1 py-4 bg-brand-blue text-white rounded-2xl font-bold hover:opacity-90 transition-colors shadow-lg shadow-sky-100 dark:shadow-none">Guardar</button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AreaQRModal
        isOpen={showQRModal}
        onClose={() => setShowQRModal(false)}
        area={qrModalArea}
        allAreas={areas.filter(a => (a as any).status !== 'deleted')}
        plants={plants}
        equipment={equipment}
        onSelectArea={(a) => setQrModalArea(a)}
      />
    </div>
  );
};

const VOSOEditorCategory = ({ 
  title, 
  icon: Icon, 
  items = [], 
  onUpdate, 
  colorClass 
}: { 
  title: string, 
  icon: any, 
  items?: VOSOItem[], 
  onUpdate: (items: VOSOItem[]) => void,
  colorClass: string
}) => {
  const [newItemName, setNewItemName] = useState('');
  
  const addItem = () => {
    if (!newItemName) return;
    const newItem: VOSOItem = {
      id: Math.random().toString(36).substr(2, 9),
      name: newItemName,
      type: 'Operacional'
    };
    onUpdate([...items, newItem]);
    setNewItemName('');
  };

  const removeItem = (id: string) => {
    onUpdate(items.filter(i => i.id !== id));
  };

  const updateItemType = (id: string, type: VOSOPreference) => {
    onUpdate(items.map(i => i.id === id ? { ...i, type } : i));
  };

  const updateItemName = (id: string, name: string) => {
    onUpdate(items.map(i => i.id === id ? { ...i, name } : i));
  };

  return (
    <div className={`p-6 rounded-[2rem] border border-zinc-100 dark:border-white/10 ${colorClass} dark:bg-black/40 space-y-4`}>
      <div className="flex items-center gap-3">
        <div className="p-2 bg-white dark:bg-black rounded-xl shadow-sm dark:shadow-none border border-transparent dark:border-white/5">
          <Icon className="w-5 h-5 text-zinc-600 dark:text-zinc-400" />
        </div>
        <h4 className="font-bold text-zinc-900 dark:text-white">{title}</h4>
      </div>

      <div className="space-y-2">
        {items.map((item, idx) => (
          <div key={item.id} className="bg-white/60 dark:bg-black/60 backdrop-blur-sm p-3 rounded-2xl border border-white/40 dark:border-white/10 flex flex-col gap-2 group">
            <div className="flex items-center gap-2">
              <input 
                value={item.name} 
                onChange={e => updateItemName(item.id, e.target.value)}
                className="flex-1 bg-transparent border-none p-0 text-sm font-bold text-zinc-800 dark:text-zinc-200 focus:ring-0" 
              />
              <button onClick={() => removeItem(item.id)} className="p-1 text-zinc-300 dark:text-zinc-600 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all">
                <X className="w-3 h-3" />
              </button>
            </div>
            <div className="flex gap-1 overflow-x-auto pb-1 no-scrollbar">
              {['Crítico', 'Operacional', 'Seguridad', 'Mantenimiento'].map((t) => (
                <button
                  key={t}
                  onClick={() => updateItemType(item.id, t as VOSOPreference)}
                  className={`text-[8px] font-bold uppercase px-2 py-1 rounded-full whitespace-nowrap transition-all ${
                    item.type === t 
                      ? 'bg-zinc-900 dark:bg-white text-white dark:text-black shadow-sm dark:shadow-none' 
                      : 'bg-white dark:bg-zinc-950 text-zinc-400 dark:text-zinc-600 border border-zinc-100 dark:border-white/5 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        <input 
          value={newItemName} 
          onChange={e => setNewItemName(e.target.value)}
          placeholder={`Agregar a ${title.toLowerCase()}...`}
          className="flex-1 p-3 bg-white/80 dark:bg-zinc-950 border border-white dark:border-white/10 text-zinc-900 dark:text-white rounded-xl text-xs outline-none focus:ring-2 focus:ring-brand-blue"
          onKeyPress={e => e.key === 'Enter' && addItem()}
        />
        <button onClick={addItem} className="p-3 bg-zinc-900 dark:bg-white text-white dark:text-black rounded-xl active:scale-95 transition-all">
          <Plus className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

const AdminEquipmentManagement = ({ plants, areas, equipment }: { plants: {id: string, name: string}[], areas: Area[], equipment: Equipment[] }) => {
  const [showForm, setShowForm] = useState(false);
  const [editingEquip, setEditingEquip] = useState<any | null>(null);
  const [formData, setFormData] = useState({ 
    name: '', 
    tag: '',
    areaId: '', 
    plantId: '', 
    inspectionOrder: 0, 
    checkItems: [] as { id: string; name: string }[],
    inspeccionVOSO: DEFAULT_VOSO
  });
  const [newCheckItemName, setNewCheckItemName] = useState('');
  const [selectedPlantFilter, setSelectedPlantFilter] = useState<string>('All');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string, type: 'success' | 'error' } | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [draggedEquipId, setDraggedEquipId] = useState<string | null>(null);
  const [dragOverEquipId, setDragOverEquipId] = useState<string | null>(null);
  const [isReordering, setIsReordering] = useState(false);

  // Batch Equipment Generator States
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [batchPlantId, setBatchPlantId] = useState<string>('');
  const [batchAreaId, setBatchAreaId] = useState<string>('');
  const [batchMode, setBatchMode] = useState<'range' | 'lines'>('range');
  const [batchPrefix, setBatchPrefix] = useState<string>('Equipo ');
  const [batchStart, setBatchStart] = useState<number>(1);
  const [batchEnd, setBatchEnd] = useState<number>(100);
  const [batchLinesText, setBatchLinesText] = useState<string>('');
  const [batchIsGenerating, setBatchIsGenerating] = useState(false);
  const [batchProgress, setBatchProgress] = useState<string>('');

  const handleGenerateBatch = async () => {
    if (!batchPlantId || !batchAreaId) {
      setMessage({ text: "Selecciona Planta y Área destino", type: 'error' });
      return;
    }
    let namesToCreate: string[] = [];
    if (batchMode === 'range') {
      const start = Math.max(1, Number(batchStart) || 1);
      const end = Math.max(start, Number(batchEnd) || start);
      for (let i = start; i <= end; i++) {
        namesToCreate.push(`${batchPrefix.trim()} ${i}`.trim());
      }
    } else {
      namesToCreate = batchLinesText
        .split('\n')
        .map(s => s.trim())
        .filter(s => s.length > 0);
    }

    if (namesToCreate.length === 0) {
      setMessage({ text: "No ingresaste ningún equipo para generar", type: 'error' });
      return;
    }

    setBatchIsGenerating(true);
    try {
      let createdCount = 0;
      const currentAreaEquips = equipment.filter(e => e.areaId === batchAreaId && (e as any).status !== 'deleted');
      const startOrder = currentAreaEquips.length + 1;

      for (let idx = 0; idx < namesToCreate.length; idx++) {
        const equipName = namesToCreate[idx];
        const baseSlug = generateSafeId(equipName) || 'equipo';
        const uniqueId = `eq-${batchAreaId}-${baseSlug}-${Date.now().toString(36)}-${idx}-${Math.random().toString(36).substring(2, 6)}`;
        
        await EquipmentService.saveEquipment({
          id: uniqueId,
          name: equipName,
          tag: `EQ-${String(startOrder + idx).padStart(3, '0')}`,
          plantId: batchPlantId,
          areaId: batchAreaId,
          inspectionOrder: startOrder + idx,
          checkItems: [],
          inspeccionVOSO: DEFAULT_VOSO,
          status: 'active'
        });
        createdCount++;
        setBatchProgress(`Generando equipo ${createdCount} de ${namesToCreate.length}...`);
      }

      setMessage({ text: `¡Se generaron e instalaron ${createdCount} equipos exitosamente!`, type: 'success' });
      setShowBatchModal(false);
      setBatchLinesText('');
    } catch (err: any) {
      console.error("Error en generación masiva:", err);
      setMessage({ text: "Error en generación masiva: " + (err.message || String(err)), type: 'error' });
    } finally {
      setBatchIsGenerating(false);
      setBatchProgress('');
    }
  };

  const handleReorderInArea = async (areaEquips: any[], draggedId: string, targetId: string) => {
    if (draggedId === targetId || isReordering) return;
    const oldIndex = areaEquips.findIndex(e => e.id === draggedId);
    const newIndex = areaEquips.findIndex(e => e.id === targetId);
    if (oldIndex === -1 || newIndex === -1) return;

    const newEquips = [...areaEquips];
    const [moved] = newEquips.splice(oldIndex, 1);
    newEquips.splice(newIndex, 0, moved);

    setIsReordering(true);
    try {
      for (let idx = 0; idx < newEquips.length; idx++) {
        const eq = newEquips[idx];
        const newOrder = idx + 1;
        if (Number(eq.inspectionOrder) !== newOrder) {
          await EquipmentService.saveEquipment({
            ...eq,
            inspectionOrder: newOrder
          });
        }
      }
      setMessage({ text: "Orden de inspección actualizado correctamente", type: 'success' });
    } catch (err: any) {
      console.error("Error al reordenar equipos:", err);
      setMessage({ text: "Error al actualizar el orden de los equipos", type: 'error' });
    } finally {
      setIsReordering(false);
      setDraggedEquipId(null);
      setDragOverEquipId(null);
    }
  };

  const handleMoveOrder = async (areaEquips: any[], index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= areaEquips.length) return;
    
    const draggedId = areaEquips[index].id;
    const targetId = areaEquips[targetIndex].id;
    await handleReorderInArea(areaEquips, draggedId, targetId);
  };

  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => setMessage(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [message]);

  const handleSave = async () => {
    if (isSaving) return;
    if (!formData.name || !formData.areaId || !formData.plantId) {
      setMessage({ text: "Completa los campos obligatorios (Nombre, Planta y Área)", type: 'error' });
      return;
    }
    setIsSaving(true);
    try {
      const baseSlug = generateSafeId(formData.name) || 'equipo';
      const id = editingEquip ? editingEquip.id : `eq-${formData.areaId}-${baseSlug}-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
      
      // Save data utilizing the transaction-reliable queue mechanism
      const result = await EquipmentService.saveEquipment({
        ...formData,
        id,
        tag: formData.tag?.trim() || '',
        inspectionOrder: Number(formData.inspectionOrder) || 0,
        checkItems: formData.checkItems || [],
        inspeccionVOSO: formData.inspeccionVOSO || DEFAULT_VOSO
      });

      setShowForm(false);
      setEditingEquip(null);
      setFormData({ name: '', tag: '', areaId: '', plantId: '', inspectionOrder: 0, checkItems: [], inspeccionVOSO: DEFAULT_VOSO });
      setNewCheckItemName('');
      
      if (result.queued) {
        setMessage({ text: "Equipo guardado localmente. Se sincronizará al recuperar conexión.", type: 'success' });
      } else {
        setMessage({ text: "Equipo guardado correctamente online", type: 'success' });
      }
    } catch (err: any) {
      console.error("Error al guardar equipo:", err);
      setMessage({ text: "Error al guardar equipo: " + (err.message || String(err)), type: 'error' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const result = await EquipmentService.deleteEquipment(id);
      if (result.queued) {
        setMessage({ text: "Equipo retirado localmente. Sincronización pendiente.", type: 'success' });
      } else {
        setMessage({ text: "Equipo eliminado correctamente", type: 'success' });
      }
      setConfirmDeleteId(null);
    } catch (err: any) {
      setMessage({ text: "Error al eliminar equipo", type: 'error' });
      setConfirmDeleteId(null);
    }
  };

  if (showForm) {
    return (
      <motion.div 
        initial={{ opacity: 0, x: 20 }} 
        animate={{ opacity: 1, x: 0 }} 
        className="fixed inset-0 z-[100] bg-zinc-50 dark:bg-zinc-950 flex flex-col h-screen overflow-hidden"
      >
        <div className="bg-white dark:bg-black border-b border-zinc-100 dark:border-white/10 p-4 sm:px-8 sm:py-6 flex items-center justify-between shadow-sm dark:shadow-none sticky top-0 z-10 transition-colors duration-200">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => !isSaving && setShowForm(false)} 
              disabled={isSaving}
              className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-900 rounded-xl transition-colors text-zinc-500 dark:text-zinc-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h3 className="text-xl font-bold text-zinc-900 dark:text-white leading-tight">
                {editingEquip ? 'Editar Equipo Industrial' : 'Configurar Nuevo Equipo'}
              </h3>
              <p className="text-[10px] font-bold text-zinc-400 dark:text-zinc-600 uppercase tracking-widest">Administración de Activos</p>
            </div>
          </div>
          <div className="flex gap-3">
            <button 
              onClick={() => !isSaving && setShowForm(false)} 
              disabled={isSaving}
              className="hidden sm:block px-6 py-2.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 rounded-xl font-bold text-sm hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancelar
            </button>
            <button 
              onClick={handleSave} 
              disabled={isSaving}
              className="px-8 py-2.5 bg-brand-blue text-white rounded-xl font-bold text-sm hover:opacity-90 transition-all shadow-lg shadow-sky-100 dark:shadow-none flex items-center justify-center gap-2 disabled:opacity-75 disabled:cursor-not-allowed min-w-[120px]"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin animate-duration-1000" />
                  <span>Guardando...</span>
                </>
              ) : (
                <span>{editingEquip ? 'Actualizar' : 'Guardar Equipo'}</span>
              )}
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-8 custom-scrollbar pb-24 dark:bg-zinc-950 transition-colors duration-200">
          <div className="max-w-4xl mx-auto space-y-8">
            {/* General Info Card */}
            <div className="bg-white dark:bg-black rounded-[2.5rem] p-8 border border-zinc-100 dark:border-white/10 shadow-sm dark:shadow-none space-y-6">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-brand-blue/5 dark:bg-brand-blue/10 rounded-xl">
                  <Settings2 className="w-5 h-5 text-brand-blue" />
                </div>
                <h4 className="font-bold text-zinc-900 dark:text-white">Información General</h4>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-zinc-400 dark:text-zinc-600 uppercase tracking-widest ml-1">Nombre del Equipo</label>
                  <input 
                    value={formData.name} 
                    onChange={e => setFormData({...formData, name: e.target.value})} 
                    placeholder="Ej: Motor Principal 45KW" 
                    className="w-full p-4 bg-zinc-50 dark:bg-zinc-900 border border-zinc-100 dark:border-white/10 text-zinc-900 dark:text-white rounded-2xl outline-none focus:ring-2 focus:ring-brand-blue transition-all" 
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-zinc-400 dark:text-zinc-600 uppercase tracking-widest ml-1">TAG / Código de Equipo</label>
                  <input 
                    value={formData.tag} 
                    onChange={e => setFormData({...formData, tag: e.target.value})} 
                    placeholder="Ej: TAG-MTR-101" 
                    className="w-full p-4 bg-zinc-50 dark:bg-zinc-900 border border-zinc-100 dark:border-white/10 text-zinc-900 dark:text-white rounded-2xl outline-none focus:ring-2 focus:ring-brand-blue transition-all uppercase font-mono text-sm" 
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-zinc-400 dark:text-zinc-600 uppercase tracking-widest ml-1">Orden de Inspección</label>
                  <input 
                    type="number"
                    value={formData.inspectionOrder} 
                    onChange={e => setFormData({...formData, inspectionOrder: parseInt(e.target.value) || 0})} 
                    placeholder="Ej: 1" 
                    className="w-full p-4 bg-zinc-50 dark:bg-zinc-900 border border-zinc-100 dark:border-white/10 text-zinc-900 dark:text-white rounded-2xl outline-none focus:ring-2 focus:ring-brand-blue transition-all" 
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-zinc-400 dark:text-zinc-600 uppercase tracking-widest ml-1">Planta</label>
                  <select 
                    value={formData.plantId} 
                    onChange={e => setFormData({...formData, plantId: e.target.value, areaId: ''})} 
                    className="w-full p-4 bg-zinc-50 dark:bg-zinc-900 border border-zinc-100 dark:border-white/10 text-zinc-900 dark:text-white rounded-2xl outline-none focus:ring-2 focus:ring-brand-blue transition-all"
                  >
                    <option value="">Seleccionar Planta</option>
                    {plants.map((p, idx) => <option key={`pl-opt-3-${p.id}-${idx}`} value={p.id}>{p.name}</option>)}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-zinc-400 dark:text-zinc-600 uppercase tracking-widest ml-1">Área</label>
                  <select 
                    value={formData.areaId} 
                    onChange={e => setFormData({...formData, areaId: e.target.value})} 
                    className="w-full p-4 bg-zinc-50 dark:bg-zinc-900 border border-zinc-100 dark:border-white/10 text-zinc-900 dark:text-white rounded-2xl outline-none focus:ring-2 focus:ring-brand-blue transition-all" 
                    disabled={!formData.plantId}
                  >
                    <option value="">{formData.plantId ? 'Seleccionar Área' : 'Primero selecciona una Planta'}</option>
                    {areas.filter(a => a.plantId === formData.plantId).map((a, aIdx) => <option key={`ar-opt-${a.id}-${aIdx}`} value={a.id}>{a.name}</option>)}
                  </select>
                </div>
              </div>
            </div>

            {/* VOSO Methodology Card */}
            <div className="bg-white dark:bg-black rounded-[2.5rem] p-8 border border-zinc-100 dark:border-white/10 shadow-sm dark:shadow-none space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-sky-50 dark:bg-sky-500/10 rounded-xl">
                    <ShieldCheck className="w-5 h-5 text-brand-blue" />
                  </div>
                  <h4 className="font-bold text-zinc-900 dark:text-white">Configuración VOSO (Inspección Primaria)</h4>
                </div>
                <span className="text-[10px] bg-sky-50 dark:bg-sky-500/10 text-brand-blue dark:text-sky-400 px-3 py-1 rounded-full font-bold uppercase tracking-wider">Estándar Klist</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <VOSOEditorCategory 
                  title="Ver" 
                  icon={Eye} 
                  items={formData.inspeccionVOSO.ver} 
                  colorClass="bg-sky-50/50"
                  onUpdate={(ver) => setFormData({...formData, inspeccionVOSO: {...formData.inspeccionVOSO, ver}})}
                />
                <VOSOEditorCategory 
                  title="Oír" 
                  icon={Ear} 
                  items={formData.inspeccionVOSO.oir} 
                  colorClass="bg-indigo-50/50"
                  onUpdate={(oir) => setFormData({...formData, inspeccionVOSO: {...formData.inspeccionVOSO, oir}})}
                />
                <VOSOEditorCategory 
                  title="Sentir" 
                  icon={Hand} 
                  items={formData.inspeccionVOSO.sentir} 
                  colorClass="bg-emerald-50/50"
                  onUpdate={(sentir) => setFormData({...formData, inspeccionVOSO: {...formData.inspeccionVOSO, sentir}})}
                />
                <VOSOEditorCategory 
                  title="Oler" 
                  icon={Wind} 
                  items={formData.inspeccionVOSO.oler} 
                  colorClass="bg-orange-50/50"
                  onUpdate={(oler) => setFormData({...formData, inspeccionVOSO: {...formData.inspeccionVOSO, oler}})}
                />
                <VOSOEditorCategory 
                  title="Orden y Limpieza" 
                  icon={Sparkles} 
                  items={formData.inspeccionVOSO.orden || []} 
                  colorClass="bg-purple-50/50"
                  onUpdate={(orden) => setFormData({...formData, inspeccionVOSO: {...formData.inspeccionVOSO, orden}})}
                />
              </div>
            </div>

            {/* CheckItems Card */}
            <div className="bg-white dark:bg-black rounded-[2.5rem] p-8 border border-zinc-100 dark:border-white/10 shadow-sm dark:shadow-none space-y-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-zinc-50 dark:bg-zinc-900 rounded-xl">
                  <ListChecks className="w-5 h-5 text-zinc-600 dark:text-zinc-400" />
                </div>
                <h4 className="font-bold text-zinc-900 dark:text-white">Otros Ítems de Revisión</h4>
              </div>

              <div className="space-y-3">
                {formData.checkItems.map((item, idx) => (
                  <div key={`edit-item-${item.id}-${idx}`} className="flex items-center gap-4 bg-zinc-50/50 dark:bg-zinc-900/50 p-4 rounded-2xl border border-zinc-100 dark:border-white/10 group transition-all">
                    <div className="w-8 h-8 rounded-xl bg-white dark:bg-black border border-zinc-100 dark:border-white/10 flex items-center justify-center text-[10px] font-bold text-zinc-400">
                      {idx + 1}
                    </div>
                    <input 
                      value={item.name} 
                      onChange={e => {
                        const newItems = [...formData.checkItems];
                        newItems[idx].name = e.target.value;
                        setFormData({...formData, checkItems: newItems});
                      }}
                      className="flex-1 bg-transparent border-none p-0 text-sm font-bold text-zinc-900 dark:text-white focus:ring-0" 
                    />
                    <button 
                      onClick={() => {
                        const newItems = formData.checkItems.filter(i => i.id !== item.id);
                        setFormData({...formData, checkItems: newItems});
                      }}
                      className="p-2 text-red-100 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>

              <div className="flex gap-3 pt-2">
                <input 
                  value={newCheckItemName} 
                  onChange={e => setNewCheckItemName(e.target.value)} 
                  placeholder="Agregar nuevo ítem de revisión (ej: Nivel de aceite)"
                  onKeyPress={e => {
                    if (e.key === 'Enter' && newCheckItemName) {
                      e.preventDefault();
                      setFormData({
                        ...formData, 
                        checkItems: [...formData.checkItems, { id: Math.random().toString(36).substr(2, 9), name: newCheckItemName }]
                      });
                      setNewCheckItemName('');
                    }
                  }}
                  className="flex-1 p-4 bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 text-zinc-900 dark:text-white rounded-2xl text-sm outline-none focus:ring-2 focus:ring-brand-blue transition-all" 
                />
                <button 
                  onClick={() => {
                    if (newCheckItemName) {
                      setFormData({
                        ...formData, 
                        checkItems: [...formData.checkItems, { id: Math.random().toString(36).substr(2, 9), name: newCheckItemName }]
                      });
                      setNewCheckItemName('');
                    }
                  }}
                  type="button"
                  className="px-6 bg-zinc-900 dark:bg-white text-white dark:text-black rounded-2xl shadow-xl dark:shadow-none active:scale-95 transition-all outline-none"
                >
                  <Plus className="w-5 h-5 transition-transform group-active:scale-90" />
                </button>
              </div>
            </div>
          </div>
        </div>

        <AnimatePresence>
          {message && (
            <motion.div 
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}
              className={`fixed bottom-8 left-1/2 -translate-x-1/2 z-[110] px-6 py-4 rounded-[2rem] shadow-2xl dark:shadow-none border text-sm font-bold flex items-center gap-3 ${
                message.type === 'success' ? 'bg-zinc-900 border-zinc-800 text-white' : 'bg-red-500 border-red-400 text-white'
              }`}
            >
              {message.type === 'success' ? <CheckCircle2 className="w-5 h-5 text-emerald-400" /> : <AlertCircle className="w-5 h-5" />}
              {message.text}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h3 className="font-bold text-zinc-900 dark:text-white uppercase tracking-tight">Equipos Industriales</h3>
        <div className="flex items-center gap-3">
          <select 
            value={selectedPlantFilter} 
            onChange={(e) => setSelectedPlantFilter(e.target.value)}
            className="text-xs p-2 bg-zinc-50 dark:bg-zinc-900 border border-zinc-100 dark:border-white/10 text-zinc-900 dark:text-white rounded-xl outline-none focus:ring-1 focus:ring-brand-blue"
          >
            <option value="All" className="bg-white dark:bg-black text-zinc-900 dark:text-white">Todas las Plantas</option>
            {plants.map((p, idx) => <option key={`pl-opt-select-1-${p.id}-${idx}`} value={p.id} className="bg-white dark:bg-black text-zinc-900 dark:text-white">{p.name}</option>)}
          </select>
          <button 
            type="button"
            onClick={() => {
              setBatchPlantId(selectedPlantFilter !== 'All' ? selectedPlantFilter : (plants[0]?.id || ''));
              setBatchAreaId('');
              setShowBatchModal(true);
            }}
            className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md shadow-emerald-500/20 transition-all cursor-pointer"
            title="Generación masiva de equipos para un área"
          >
            <Zap className="w-4 h-4" />
            <span className="hidden sm:inline">Generador Masivo</span>
          </button>
          <button onClick={() => { 
            setEditingEquip(null); 
            setFormData({name:'', tag: '', areaId:'', plantId: '', inspectionOrder: 0, checkItems: [], inspeccionVOSO: DEFAULT_VOSO}); 
            setShowForm(true); 
          }} className="p-2 bg-brand-blue text-white rounded-xl shadow-md shadow-sky-100 dark:shadow-none" title="Nuevo Equipo">
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </div>

      <BulkUpload 
        entityType="Equipment"
        plants={plants}
        areas={areas}
        onComplete={(count) => setMessage({ text: `Se cargaron ${count} equipos exitosamente`, type: 'success' })}
        onError={(err) => setMessage({ text: err, type: 'error' })}
      />

      <div className="space-y-6">
        {(() => {
          const seenEquipIds = new Set<string>();
          const filteredEquipment = equipment.filter(e => {
            const isNotDeleted = (e as any).status !== 'deleted';
            const matchesPlant = selectedPlantFilter === 'All' || e.plantId === selectedPlantFilter;
            const isUnique = e.id && !seenEquipIds.has(e.id);
            if (isNotDeleted && matchesPlant && isUnique) {
              seenEquipIds.add(e.id);
              return true;
            }
            return false;
          });

          if (filteredEquipment.length === 0) {
            return (
              <div className="text-center py-12 bg-white dark:bg-black rounded-3xl border border-zinc-100 dark:border-white/10 text-zinc-400 dark:text-zinc-500 text-sm italic shadow-xs">
                No se encontraron equipos para esta selección
              </div>
            );
          }

          const seenAreaIds = new Set<string>();
          const activeAreas = areas.filter(a => {
            const matchesPlant = selectedPlantFilter === 'All' || a.plantId === selectedPlantFilter;
            const isUnique = a.id && !seenAreaIds.has(a.id);
            if (matchesPlant && isUnique) {
              seenAreaIds.add(a.id);
              return true;
            }
            return false;
          });
          const unassignedEquips = filteredEquipment.filter(e => !e.areaId || !areas.some(a => a.id === e.areaId));

          return (
            <>
              {activeAreas.map((area, aIdx) => {
                const areaEquips = filteredEquipment
                  .filter(e => e.areaId === area.id)
                  .sort((a, b) => (Number(a.inspectionOrder) || 0) - (Number(b.inspectionOrder) || 0));
                if (areaEquips.length === 0) return null;

                return (
                  <div key={`area-group-${area.id}-${aIdx}`} className="bg-zinc-50/50 dark:bg-white/5 p-5 rounded-3xl border border-zinc-100 dark:border-white/5 space-y-4">
                    <div className="flex items-center justify-between border-b border-zinc-100 dark:border-white/5 pb-3">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-brand-blue" />
                        <h4 className="font-bold text-zinc-900 dark:text-white text-sm uppercase tracking-wider">
                          {area.name}
                        </h4>
                        <span className="text-[9px] bg-sky-50 dark:bg-sky-500/10 text-brand-blue dark:text-sky-400 px-2 py-0.5 rounded-full font-bold uppercase transition-colors">
                          {plants.find(p => p.id === area.plantId)?.name || 'Sin Planta'}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-[10px] text-zinc-400 font-medium hidden sm:inline">Arrastra para reordenar inspección</span>
                        <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest">
                          {areaEquips.length} {areaEquips.length === 1 ? 'equipo' : 'equipos'}
                        </span>
                      </div>
                    </div>

                    <div className="grid gap-3">
                      {areaEquips.map((e, eIdx) => (
                        <div 
                          key={`equip-${e.id}-${eIdx}`} 
                          draggable={!isReordering}
                          onDragStart={(evt) => {
                            evt.dataTransfer.setData('text/plain', e.id);
                            setDraggedEquipId(e.id);
                          }}
                          onDragOver={(evt) => {
                            evt.preventDefault();
                            if (dragOverEquipId !== e.id) setDragOverEquipId(e.id);
                          }}
                          onDragLeave={(evt) => {
                            evt.preventDefault();
                            if (dragOverEquipId === e.id) setDragOverEquipId(null);
                          }}
                          onDrop={(evt) => {
                            evt.preventDefault();
                            const sourceId = evt.dataTransfer.getData('text/plain') || draggedEquipId;
                            if (sourceId) handleReorderInArea(areaEquips, sourceId, e.id);
                          }}
                          className={`bg-white dark:bg-black p-4 rounded-2xl border transition-all flex justify-between items-center ${
                            dragOverEquipId === e.id 
                              ? 'border-brand-blue ring-2 ring-brand-blue/30 bg-sky-50/50 dark:bg-sky-500/10' 
                              : 'border-zinc-100/80 dark:border-white/10 hover:shadow-xs'
                          } ${draggedEquipId === e.id ? 'opacity-40 scale-[0.99]' : ''}`}
                        >
                          <div className="flex items-center gap-3">
                            <div 
                              className="cursor-grab active:cursor-grabbing p-1.5 text-zinc-300 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-900" 
                              title="Arrastra para reordenar la posición de inspección"
                            >
                              <GripVertical className="w-4 h-4" />
                            </div>
                            <div>
                              <p className="font-bold text-zinc-900 dark:text-white text-sm flex items-center gap-2 flex-wrap">
                                <span className="text-[10px] font-black bg-brand-blue/10 dark:bg-brand-blue/20 text-brand-blue dark:text-sky-400 px-2 py-0.5 rounded-md">
                                  #{e.inspectionOrder || (eIdx + 1)}
                                </span>
                                <span>{e.name}</span>
                                {e.tag && (
                                  <span className="text-[10px] font-bold tracking-wider bg-[#2a2728] text-zinc-100 px-2 py-0.5 rounded-md border border-[#3d393a] dark:border-white/10 uppercase shadow-2xs">
                                    TAG: {e.tag}
                                  </span>
                                )}
                              </p>
                              <div className="flex gap-2 items-center mt-1.5">
                                <span className="text-[9px] bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-100 dark:border-white/5 text-zinc-500 dark:text-zinc-400 px-1.5 py-0.5 rounded font-bold uppercase">
                                  Planta: {plants.find(p => p.id === e.plantId)?.name || 'Sin Planta'}
                                </span>
                                <span className="text-[9px] bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-100 dark:border-white/5 text-zinc-400 dark:text-zinc-500 px-1.5 py-0.5 rounded font-bold uppercase">
                                  Área: {area.name}
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="flex gap-1 items-center">
                            <button 
                              disabled={eIdx === 0 || isReordering} 
                              onClick={() => handleMoveOrder(areaEquips, eIdx, 'up')}
                              title="Subir orden de inspección"
                              className="p-1.5 text-zinc-400 hover:text-zinc-900 dark:hover:text-white disabled:opacity-20 disabled:cursor-not-allowed transition-colors rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-900"
                            >
                              <ChevronUp className="w-4 h-4" />
                            </button>
                            <button 
                              disabled={eIdx === areaEquips.length - 1 || isReordering} 
                              onClick={() => handleMoveOrder(areaEquips, eIdx, 'down')}
                              title="Bajar orden de inspección"
                              className="p-1.5 text-zinc-400 hover:text-zinc-900 dark:hover:text-white disabled:opacity-20 disabled:cursor-not-allowed transition-colors rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-900"
                            >
                              <ChevronDown className="w-4 h-4" />
                            </button>
                            <div className="w-[1px] h-4 bg-zinc-200 dark:bg-zinc-800 mx-1" />
                            <button onClick={() => { 
                              setEditingEquip(e); 
                              setFormData({
                                name: e.name, 
                                tag: e.tag || '',
                                areaId: e.areaId, 
                                plantId: e.plantId || '', 
                                inspectionOrder: e.inspectionOrder || 0,
                                checkItems: e.checkItems || [],
                                inspeccionVOSO: e.inspeccionVOSO || DEFAULT_VOSO
                              }); 
                              setShowForm(true); 
                            }} title="Editar Equipo" className="p-2 text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-900">
                              <FileText className="w-4 h-4" />
                            </button>
                            <button onClick={() => { 
                              setEditingEquip(null); 
                              setFormData({
                                name: `${e.name} (Copia)`, 
                                tag: e.tag ? `${e.tag}-CP` : '',
                                areaId: e.areaId, 
                                plantId: e.plantId || '', 
                                inspectionOrder: (e.inspectionOrder || 0) + 1,
                                checkItems: (e.checkItems || []).map(item => ({ id: Math.random().toString(36).substring(2, 9), name: item.name })),
                                inspeccionVOSO: JSON.parse(JSON.stringify(e.inspeccionVOSO || DEFAULT_VOSO))
                              }); 
                              setShowForm(true); 
                            }} title="Copiar / Duplicar Equipo" className="p-2 text-zinc-400 hover:text-brand-blue transition-colors rounded-lg hover:bg-sky-50 dark:hover:bg-sky-500/10">
                              <Copy className="w-4 h-4" />
                            </button>
                            <button onClick={() => setConfirmDeleteId(e.id)} title="Eliminar Equipo" className="p-2 text-zinc-400 hover:text-red-500 transition-colors rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10">
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}

              {unassignedEquips.length > 0 && (
                <div className="bg-amber-500/5 p-5 rounded-3xl border border-amber-500/10 space-y-4">
                  <div className="flex items-center justify-between border-b border-amber-500/10 pb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-amber-500" />
                      <h4 className="font-bold text-amber-700 dark:text-amber-400 text-sm uppercase tracking-wider">
                        Equipos sin Área Asignada
                      </h4>
                    </div>
                    <span className="text-[10px] font-bold text-amber-500 uppercase tracking-widest">
                      {unassignedEquips.length} {unassignedEquips.length === 1 ? 'equipo' : 'equipos'}
                    </span>
                  </div>

                  <div className="grid gap-3">
                    {unassignedEquips.map((e, eIdx) => (
                      <div key={`equip-unassigned-${e.id}-${eIdx}`} className="bg-white dark:bg-black p-4 rounded-2xl border border-zinc-100/80 dark:border-white/10 flex justify-between items-center hover:shadow-xs dark:hover:shadow-none transition-all">
                        <div>
                          <p className="font-bold text-zinc-900 dark:text-white text-sm">
                            <span className="text-zinc-400 mr-2 text-xs">#{e.inspectionOrder || '0'}</span>
                            {e.name}
                          </p>
                          <div className="flex gap-2 items-center mt-1.5">
                            <span className="text-[9px] bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-100 dark:border-white/5 text-zinc-500 dark:text-zinc-400 px-1.5 py-0.5 rounded font-bold uppercase">
                              Planta: {plants.find(p => p.id === e.plantId)?.name || 'Sin Planta'}
                            </span>
                            <span className="text-[9px] bg-amber-500/10 text-amber-600 dark:text-amber-400 px-1.5 py-0.5 rounded font-bold uppercase">
                              Sin Área
                            </span>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button onClick={() => { 
                            setEditingEquip(e); 
                            setFormData({
                              name: e.name, 
                              tag: e.tag || '',
                              areaId: e.areaId, 
                              plantId: e.plantId || '', 
                              inspectionOrder: e.inspectionOrder || 0,
                              checkItems: e.checkItems || [],
                              inspeccionVOSO: e.inspeccionVOSO || DEFAULT_VOSO
                            }); 
                            setShowForm(true); 
                          }} title="Editar Equipo" className="p-2 text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-900">
                            <FileText className="w-4 h-4" />
                          </button>
                          <button onClick={() => { 
                            setEditingEquip(null); 
                            setFormData({
                              name: `${e.name} (Copia)`, 
                              tag: e.tag ? `${e.tag}-Copia` : '',
                              areaId: e.areaId, 
                              plantId: e.plantId || '', 
                              inspectionOrder: (e.inspectionOrder || 0) + 1,
                              checkItems: (e.checkItems || []).map(item => ({ id: Math.random().toString(36).substring(2, 9), name: item.name })),
                              inspeccionVOSO: JSON.parse(JSON.stringify(e.inspeccionVOSO || DEFAULT_VOSO))
                            }); 
                            setShowForm(true); 
                          }} title="Copiar / Duplicar Equipo" className="p-2 text-zinc-400 hover:text-brand-blue transition-colors rounded-lg hover:bg-sky-50 dark:hover:bg-sky-500/10">
                            <Copy className="w-4 h-4" />
                          </button>
                          <button onClick={() => setConfirmDeleteId(e.id)} title="Eliminar Equipo" className="p-2 text-zinc-400 hover:text-red-500 transition-colors rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10">
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          );
        })()}
      </div>
      <AnimatePresence>
        {message && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}
            className={`fixed top-4 right-4 z-[60] px-4 py-3 rounded-2xl shadow-xl dark:shadow-none border text-sm font-bold flex items-center gap-2 ${
              message.type === 'success' ? 'bg-emerald-50 border-emerald-100 text-emerald-700' : 'bg-red-50 border-red-100 text-red-700'
            }`}
          >
            {message.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
            {message.text}
          </motion.div>
        )}

        {confirmDeleteId && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-6">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white dark:bg-black rounded-3xl p-8 max-w-sm w-full shadow-2xl dark:shadow-none space-y-6"
            >
              <div className="w-12 h-12 bg-red-50 rounded-2xl flex items-center justify-center text-red-500 mx-auto">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div className="text-center space-y-2">
                <h3 className="text-xl font-bold text-zinc-900">¿Eliminar equipo?</h3>
                <p className="text-zinc-500 text-sm leading-relaxed">
                  Esta acción desactivará el equipo de la lista activa.
                </p>
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setConfirmDeleteId(null)} className="flex-1 px-4 py-3 rounded-2xl bg-zinc-100 text-zinc-600 font-bold text-sm hover:bg-zinc-200 transition-all">Cancelar</button>
                <button onClick={() => handleDelete(confirmDeleteId)} className="flex-1 px-4 py-3 rounded-2xl bg-red-500 text-white font-bold text-sm hover:bg-red-600 transition-all shadow-lg shadow-red-200 dark:shadow-none">Eliminar</button>
              </div>
            </motion.div>
          </div>
        )}

        {showBatchModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => !batchIsGenerating && setShowBatchModal(false)} className="absolute inset-0 bg-zinc-900/60 backdrop-blur-sm" />
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="relative w-full max-w-lg bg-white dark:bg-black rounded-[2.5rem] shadow-2xl dark:shadow-none flex flex-col max-h-[90vh] overflow-hidden border border-zinc-100 dark:border-white/10">
              <div className="p-6 border-b border-zinc-100 dark:border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-xl">
                    <Zap className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-zinc-900 dark:text-white">Generador Masivo de Equipos</h3>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">Crea hasta 100 o más equipos por área sin límite de capacidad</p>
                  </div>
                </div>
                {!batchIsGenerating && (
                  <button onClick={() => setShowBatchModal(false)} className="p-2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200">
                    <X className="w-5 h-5" />
                  </button>
                )}
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-zinc-600 dark:text-zinc-400 mb-1">Planta Target</label>
                    <select
                      value={batchPlantId}
                      onChange={(e) => {
                        setBatchPlantId(e.target.value);
                        setBatchAreaId('');
                      }}
                      disabled={batchIsGenerating}
                      className="w-full p-3 bg-zinc-50 dark:bg-zinc-900 border border-zinc-100 dark:border-white/10 text-zinc-900 dark:text-white rounded-xl text-xs outline-none focus:ring-2 focus:ring-emerald-500"
                    >
                      <option value="">Selecciona Planta</option>
                      {plants.map(p => (
                        <option key={`batch-p-${p.id}`} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-zinc-600 dark:text-zinc-400 mb-1">Área Target</label>
                    <select
                      value={batchAreaId}
                      onChange={(e) => setBatchAreaId(e.target.value)}
                      disabled={batchIsGenerating || !batchPlantId}
                      className="w-full p-3 bg-zinc-50 dark:bg-zinc-900 border border-zinc-100 dark:border-white/10 text-zinc-900 dark:text-white rounded-xl text-xs outline-none focus:ring-2 focus:ring-emerald-500"
                    >
                      <option value="">Selecciona Área</option>
                      {areas.filter(a => a.plantId === batchPlantId && (a as any).status !== 'deleted').map(a => (
                        <option key={`batch-a-${a.id}`} value={a.id}>{a.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex bg-zinc-100 dark:bg-zinc-900 p-1 rounded-xl gap-1">
                  <button
                    type="button"
                    onClick={() => setBatchMode('range')}
                    disabled={batchIsGenerating}
                    className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                      batchMode === 'range' ? 'bg-white dark:bg-zinc-800 text-emerald-600 dark:text-emerald-400 shadow-xs' : 'text-zinc-500 dark:text-zinc-400'
                    }`}
                  >
                    Por Rango Numérico (p.ej. 1 al 100)
                  </button>
                  <button
                    type="button"
                    onClick={() => setBatchMode('lines')}
                    disabled={batchIsGenerating}
                    className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                      batchMode === 'lines' ? 'bg-white dark:bg-zinc-800 text-emerald-600 dark:text-emerald-400 shadow-xs' : 'text-zinc-500 dark:text-zinc-400'
                    }`}
                  >
                    Pegar Lista (un equipo x línea)
                  </button>
                </div>

                {batchMode === 'range' ? (
                  <div className="space-y-3 bg-zinc-50 dark:bg-zinc-900/50 p-4 rounded-2xl border border-zinc-100 dark:border-white/5">
                    <div>
                      <label className="block text-xs font-bold text-zinc-600 dark:text-zinc-400 mb-1">Prefijo del Equipo</label>
                      <input
                        type="text"
                        value={batchPrefix}
                        onChange={(e) => setBatchPrefix(e.target.value)}
                        placeholder="Ej: Motor "
                        disabled={batchIsGenerating}
                        className="w-full p-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 text-zinc-900 dark:text-white rounded-xl text-xs outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-bold text-zinc-600 dark:text-zinc-400 mb-1">Número Inicial</label>
                        <input
                          type="number"
                          value={batchStart}
                          onChange={(e) => setBatchStart(Number(e.target.value))}
                          disabled={batchIsGenerating}
                          className="w-full p-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 text-zinc-900 dark:text-white rounded-xl text-xs outline-none focus:ring-2 focus:ring-emerald-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-zinc-600 dark:text-zinc-400 mb-1">Número Final</label>
                        <input
                          type="number"
                          value={batchEnd}
                          onChange={(e) => setBatchEnd(Number(e.target.value))}
                          disabled={batchIsGenerating}
                          className="w-full p-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 text-zinc-900 dark:text-white rounded-xl text-xs outline-none focus:ring-2 focus:ring-emerald-500"
                        />
                      </div>
                    </div>
                    <p className="text-[11px] text-zinc-500 dark:text-zinc-400 italic">
                      Se generarán: <span className="font-bold text-emerald-600 dark:text-emerald-400">{Math.max(0, batchEnd - batchStart + 1)}</span> equipos (`{batchPrefix}{batchStart}` hasta `{batchPrefix}{batchEnd}`).
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <label className="block text-xs font-bold text-zinc-600 dark:text-zinc-400">Nombres de Equipos (un equipo por línea)</label>
                    <textarea
                      value={batchLinesText}
                      onChange={(e) => setBatchLinesText(e.target.value)}
                      placeholder={`Bomba de Agua 1\nBomba de Agua 2\nCompresor Principal\nEstructura A1`}
                      rows={6}
                      disabled={batchIsGenerating}
                      className="w-full p-3 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 text-zinc-900 dark:text-white rounded-xl text-xs outline-none focus:ring-2 focus:ring-emerald-500 custom-scrollbar font-mono"
                    />
                    <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                      Total detectado: <span className="font-bold text-emerald-600 dark:text-emerald-400">{batchLinesText.split('\n').filter(s => s.trim().length > 0).length}</span> equipos.
                    </p>
                  </div>
                )}

                {batchIsGenerating && (
                  <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-center gap-3">
                    <Loader2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 animate-spin" />
                    <span className="text-xs font-bold text-emerald-700 dark:text-emerald-300">{batchProgress || 'Procesando equipos...'}</span>
                  </div>
                )}
              </div>

              <div className="p-6 border-t border-zinc-100 dark:border-white/5 bg-zinc-50 dark:bg-zinc-900/20 flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowBatchModal(false)}
                  disabled={batchIsGenerating}
                  className="flex-1 py-3 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 rounded-xl font-bold text-xs hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleGenerateBatch}
                  disabled={batchIsGenerating || !batchPlantId || !batchAreaId}
                  className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs transition-colors shadow-md shadow-emerald-500/20 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {batchIsGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                  <span>{batchIsGenerating ? 'Generando...' : 'Generar Equipos'}</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

const AdminUserManagement = ({ plants }: { plants: {id: string, name: string}[] }) => {
  const { users } = useAppUsers();
  const [editingUser, setEditingUser] = useState<AppUser | null>(null);
  const [confirmDeleteUid, setConfirmDeleteUid] = useState<string | null>(null);
  const [resetPasswordFor, setResetPasswordFor] = useState<AppUser | null>(null);
  const [newAdminPassword, setNewAdminPassword] = useState('');
  const [isResetting, setIsResetting] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ name: '', email: '', role: 'Operador' as UserRole, password: '', plantId: '' });
  const [message, setMessage] = useState<{ text: string, type: 'success' | 'error' } | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const handleResetPasswordDirectly = async () => {
    if (!resetPasswordFor || !newAdminPassword) return;
    setIsResetting(true);
    try {
      const adminToken = await auth.currentUser?.getIdToken();
      const response = await fetch('/api/admin/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identifier: resetPasswordFor.email,
          newPassword: newAdminPassword,
          adminToken
        })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Error al reestablecer contraseña');

      setMessage({ text: `Contraseña actualizada correctamente para ${resetPasswordFor.name}`, type: 'success' });
      setResetPasswordFor(null);
      setNewAdminPassword('');
    } catch (err: any) {
      console.error("Error resetting password", err);
      setMessage({ text: "Error: " + (err.message || "Error desconocido"), type: 'error' });
    } finally {
      setIsResetting(false);
    }
  };

  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => setMessage(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [message]);


  const handleSaveUser = async () => {
    if (!formData.email || !formData.name || isSaving) return;
    setIsSaving(true);
    
    try {
      let uid = editingUser?.uid;

      if (!editingUser) {
        // Create new user in Firebase Auth
        const loginEmail = formData.email.includes('@') ? formData.email : `${formData.email}@chekify.local`;
        try {
          const userCredential = await createUserWithEmailAndPassword(auth, loginEmail, formData.password || '123456');
          uid = userCredential.user.uid;
        } catch (authErr: any) {
          if (authErr.code === 'auth/email-already-in-use') {
            const loginEmail = formData.email.includes('@') ? formData.email : `${formData.email}@chekify.local`;
            const existingUser = users.find(u => u.email === formData.email || u.email === loginEmail);
            if (existingUser) {
              uid = existingUser.uid;
            } else {
              throw new Error("El usuario ya existe en el sistema de autenticación pero no tiene perfil en esta base de datos. Contacte a soporte para vincular la cuenta.");
            }
          } else {
            throw authErr;
          }
        }
      }

      if (uid) {
        const userRef = doc(db, 'users', uid);
        try {
          await setDoc(userRef, {
            uid: uid,
            name: formData.name,
            email: formData.email,
            role: formData.role,
            plantId: formData.plantId
          }, { merge: true });
        } catch (fsErr: any) {
          if (fsErr.code === 'permission-denied') {
            const errInfo = {
              error: fsErr.message,
              operationType: 'WRITE',
              path: `users/${uid}`,
              authInfo: {
                userId: auth.currentUser?.uid,
                email: auth.currentUser?.email,
              }
            };
            console.error('Firestore Permission Denied:', JSON.stringify(errInfo, null, 2));
          }
          throw fsErr;
        }
      }

      setShowForm(false);
      setEditingUser(null);
      setFormData({ name: '', email: '', role: 'Operador', password: '', plantId: '' });
      setMessage({ text: "Usuario guardado correctamente", type: 'success' });
    } catch (err: any) {
      console.error("Error saving user", err);
      if (err.code === 'auth/network-request-failed') {
        setMessage({ text: "Error de red: No se pudo conectar con el servidor de autenticación. Revisa tu internet o desactiva bloqueadores de anuncios (uBlock, AdBlock).", type: 'error' });
      } else if (err.code === 'auth/operation-not-allowed') {
        setMessage({ text: "Error: El método de inicio de sesión con Correo/Contraseña no está habilitado en Firebase.", type: 'error' });
      } else if (err.code === 'permission-denied') {
        setMessage({ text: "Error de permisos: No tienes autorización para guardar este usuario.", type: 'error' });
      } else if (err.code === 'auth/email-already-in-use') {
        setMessage({ text: "Error: El correo o usuario ya está en uso.", type: 'error' });
      } else {
        setMessage({ text: "Error al guardar el usuario: " + (err.message || "Error desconocido"), type: 'error' });
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteUser = async (uid: string) => {
    if (uid === auth.currentUser?.uid) {
      setMessage({ text: "No puedes eliminar tu propia cuenta.", type: 'error' });
      return;
    }

    try {
      await deleteDoc(doc(db, 'users', uid));
      setMessage({ text: "Usuario eliminado correctamente", type: 'success' });
      setConfirmDeleteUid(null);
    } catch (err: any) {
      console.error("Error deleting user", err);
      if (err.code === 'permission-denied') {
        setMessage({ text: "Error de permisos: No tienes autorización para eliminar usuarios.", type: 'error' });
      } else {
        setMessage({ text: "Error al eliminar: " + err.message, type: 'error' });
      }
      setConfirmDeleteUid(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-zinc-900 dark:text-white tracking-tight uppercase">Gestión de Usuarios</h2>
        <button 
          onClick={() => { setShowForm(true); setEditingUser(null); }}
          className="p-2 bg-brand-blue text-white rounded-xl hover:opacity-90 transition-all shadow-md shadow-sky-100 dark:shadow-none"
        >
          <Plus className="w-5 h-5" />
        </button>
      </div>

      <BulkUpload 
        entityType="Users"
        plants={plants}
        onComplete={(count) => setMessage({ text: `Se cargaron ${count} usuarios exitosamente.`, type: 'success' })}
        onError={(err) => setMessage({ text: err, type: 'error' })}
      />

      <div className="grid gap-4">
        {users.map((u, index) => (
          <div key={`user-row-${u.uid || index}`} className="bg-white dark:bg-black p-4 rounded-2xl border border-zinc-100 dark:border-white/10 shadow-sm dark:shadow-none flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-sky-50 dark:bg-sky-500/10 rounded-full flex items-center justify-center text-brand-blue dark:text-sky-400 font-black">
                {u.name ? u.name[0] : '?'}
              </div>
              <div>
                <h4 className="font-bold text-zinc-900 dark:text-white uppercase tracking-tight">{u.name}</h4>
                <p className="text-xs text-zinc-400 dark:text-zinc-600 italic">
                  {u.email.replace('@chekify.local', '')} • <span className="text-zinc-900 dark:text-zinc-400 font-black">{u.role}</span>
                  {u.plantId && (
                    <span className="ml-2 text-zinc-500 dark:text-zinc-700 font-bold tracking-tight">• {plants.find(p => p.id === u.plantId)?.name}</span>
                  )}
                </p>
              </div>
            </div>
              <div className="flex gap-2">
              <button 
                onClick={() => { 
                  setEditingUser(u); 
                  setFormData({ 
                    name: u.name, 
                    email: u.email, 
                    role: u.role, 
                    password: '',
                    plantId: u.plantId || '' 
                  }); 
                  setShowForm(true); 
                }}
                className="p-2 text-zinc-400 dark:text-zinc-600 hover:text-zinc-900 dark:hover:text-white transition-colors"
              >
                <FileText className="w-4 h-4" />
              </button>
              <button 
                onClick={() => setResetPasswordFor(u)}
                className="p-2 text-zinc-400 dark:text-zinc-600 hover:text-brand-blue dark:hover:text-sky-400 transition-colors rounded-xl hover:bg-brand-blue/5 dark:hover:bg-sky-500/5"
                title="Reestablecer contraseña"
              >
                <div className="flex items-center gap-1.5">
                  <RotateCcw className="w-4 h-4" />
                  <span className="text-[10px] font-bold uppercase">Reseteo</span>
                </div>
              </button>
              <button 
                onClick={() => setConfirmDeleteUid(u.uid)}
                className="p-2 text-zinc-400 dark:text-zinc-600 hover:text-red-500 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      <AnimatePresence>
        {message && (
          <motion.div 
            key="admin-message"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className={`fixed top-4 right-4 z-[60] px-4 py-3 rounded-2xl shadow-xl dark:shadow-none border text-sm font-bold flex items-center gap-2 ${
              message.type === 'success' ? 'bg-green-50 border-green-100 text-green-700' : 'bg-red-50 border-red-100 text-red-700'
            }`}
          >
            {message.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
            {message.text}
          </motion.div>
        )}

      {resetPasswordFor && (
        <motion.div 
          key="admin-reset-pw-modal"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
        >
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="bg-white dark:bg-black rounded-3xl p-6 w-full max-w-sm shadow-2xl dark:shadow-none border border-zinc-100 dark:border-white/20"
          >
            <div className="w-12 h-12 bg-amber-50 dark:bg-amber-500/10 rounded-2xl flex items-center justify-center text-amber-500 dark:text-amber-400 mb-4">
              <RotateCcw className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-zinc-900 dark:text-white uppercase tracking-tight mb-1">Cambiar Contraseña</h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-6 font-medium leading-relaxed">
              Ingresa una nueva contraseña para <b>{resetPasswordFor.name}</b>. 
              El cambio es instantáneo y se aplicará en el próximo inicio de sesión.
            </p>
            
            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest mb-1 ml-1">Nueva Contraseña</label>
                <input 
                  type="password"
                  placeholder="Mínimo 6 caracteres"
                  value={newAdminPassword}
                  onChange={(e) => setNewAdminPassword(e.target.value)}
                  className="w-full p-4 bg-zinc-50 dark:bg-zinc-900 border border-zinc-100 dark:border-white/10 text-zinc-900 dark:text-white rounded-2xl outline-none focus:ring-2 focus:ring-brand-blue transition-all"
                  autoFocus
                />
              </div>
            </div>

            <div className="flex gap-3">
              <button 
                onClick={() => { setResetPasswordFor(null); setNewAdminPassword(''); }}
                className="flex-1 py-4 text-xs font-bold text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors"
                disabled={isResetting}
              >
                Cancelar
              </button>
              <button 
                onClick={handleResetPasswordDirectly}
                disabled={isResetting || newAdminPassword.length < 6}
                className="flex-1 py-4 bg-zinc-900 dark:bg-white text-white dark:text-black rounded-2xl text-xs font-bold hover:bg-zinc-800 transition-all shadow-lg shadow-zinc-200 dark:shadow-none disabled:opacity-50"
              >
                {isResetting ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white dark:border-t-black rounded-full animate-spin mx-auto" />
                ) : 'Aplicar Cambio Solicitado'}
              </button>
            </div>

            <div className="mt-4 pt-4 border-t border-zinc-50 dark:border-white/10">
              <p className="text-[9px] text-zinc-400 dark:text-zinc-600 text-center mb-3">¿Problemas con el servidor? Prueba la alternativa:</p>
              <button 
                onClick={async () => {
                  if (!resetPasswordFor) return;
                  try {
                    await sendPasswordResetEmail(auth, resetPasswordFor.email);
                    setMessage({ text: "Correo de recuperación enviado exitosamente a " + resetPasswordFor.email, type: 'success' });
                    setResetPasswordFor(null);
                  } catch (e: any) {
                    setMessage({ text: "Error: " + e.message, type: 'error' });
                  }
                }}
                className="w-full py-3 bg-brand-blue/5 dark:bg-sky-500/10 text-brand-blue dark:text-sky-400 rounded-xl text-[10px] font-bold hover:bg-brand-blue/10 dark:hover:bg-sky-500/20 transition-all"
              >
                Enviar Correo de Recuperación
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}

      {confirmDeleteUid && (
        <motion.div 
          key="admin-delete-confirm-modal"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-6"
        >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white dark:bg-black rounded-3xl p-8 max-w-sm w-full shadow-2xl dark:shadow-none space-y-6 border border-transparent dark:border-white/20"
            >
              <div className="w-12 h-12 bg-red-50 dark:bg-red-500/10 rounded-2xl flex items-center justify-center text-red-500 dark:text-red-400 mx-auto">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div className="text-center space-y-2">
                <h3 className="text-xl font-bold text-zinc-900 dark:text-white uppercase tracking-tight">¿Eliminar usuario?</h3>
                <p className="text-zinc-500 dark:text-zinc-400 text-sm leading-relaxed">
                  Esta acción es permanente y eliminará todos los datos asociados al perfil de este usuario en la base de datos.
                </p>
              </div>
              <div className="flex gap-3 pt-2">
                <button 
                  onClick={() => setConfirmDeleteUid(null)}
                  className="flex-1 px-4 py-3 rounded-2xl bg-zinc-100 text-zinc-600 font-bold text-sm hover:bg-zinc-200 transition-all"
                >
                  Cancelar
                </button>
                <button 
                  onClick={() => handleDeleteUser(confirmDeleteUid!)}
                  className="flex-1 px-4 py-3 rounded-2xl bg-red-500 text-white font-bold text-sm hover:bg-red-600 transition-all shadow-lg shadow-red-200 dark:shadow-none"
                >
                  Eliminar
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
        {showForm && (
          <motion.div 
            key="admin-edit-form-modal"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
          >
            <motion.div onClick={() => setShowForm(false)} className="absolute inset-0 bg-zinc-900/60 backdrop-blur-sm" />
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="relative w-full max-w-md bg-white dark:bg-black rounded-[2.5rem] shadow-2xl dark:shadow-none flex flex-col max-h-[90vh] overflow-hidden border border-transparent dark:border-white/20">
              <div className="p-8 border-b border-zinc-50 dark:border-white/10">
                <h3 className="text-xl font-bold text-zinc-900 dark:text-white uppercase tracking-tight">{editingUser ? 'Editar Usuario' : 'Nuevo Usuario'}</h3>
              </div>
              <div className="flex-1 overflow-y-auto p-8 pt-4 custom-scrollbar">
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-500 mb-1 font-bold lowercase tracking-wider text-[10px] uppercase">Nombre</label>
                    <input 
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({...formData, name: e.target.value})}
                      className="w-full p-4 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 text-zinc-900 dark:text-white rounded-2xl outline-none focus:ring-2 focus:ring-brand-blue"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-500 mb-1 font-bold lowercase tracking-wider text-[10px] uppercase">Usuario</label>
                    <input 
                      type="text"
                      value={formData.email}
                      onChange={(e) => setFormData({...formData, email: e.target.value})}
                      className="w-full p-4 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 text-zinc-900 dark:text-white rounded-2xl outline-none focus:ring-2 focus:ring-brand-blue"
                      disabled={!!editingUser}
                      placeholder="ej. juan.perez"
                    />
                  </div>
                  {!editingUser && (
                    <div>
                      <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-500 mb-1 font-bold lowercase tracking-wider text-[10px] uppercase">Contraseña Inicial</label>
                      <input 
                        type="password"
                        value={formData.password}
                        onChange={(e) => setFormData({...formData, password: e.target.value})}
                        className="w-full p-4 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 text-zinc-900 dark:text-white rounded-2xl outline-none focus:ring-2 focus:ring-brand-blue"
                        placeholder="Mínimo 6 caracteres"
                      />
                    </div>
                  )}
                  <div>
                    <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-500 mb-1 font-bold lowercase tracking-wider text-[10px] uppercase">Planta</label>
                    <select 
                      value={formData.plantId}
                      onChange={(e) => setFormData({...formData, plantId: e.target.value})}
                      className="w-full p-4 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 text-zinc-900 dark:text-white rounded-2xl outline-none focus:ring-2 focus:ring-brand-blue"
                    >
                      <option value="">Seleccionar Planta</option>
                      {plants.map((p, idx) => (
                        <option key={`pl-opt-select-2-${p.id}-${idx}`} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-500 mb-1 font-bold lowercase tracking-wider text-[10px] uppercase">Rol</label>
                    <select 
                      value={formData.role}
                      onChange={(e) => setFormData({...formData, role: e.target.value as UserRole})}
                      className="w-full p-4 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 text-zinc-900 dark:text-white rounded-2xl outline-none focus:ring-2 focus:ring-brand-blue"
                    >
                      <option value="Operador">Operador</option>
                      <option value="Supervisor">Supervisor</option>
                      <option value="Administrador">Administrador</option>
                    </select>
                  </div>
                </div>
              </div>
              <div className="p-8 border-t border-zinc-50 dark:border-white/10 bg-zinc-50 dark:bg-zinc-900/20">
                <div className="flex gap-3">
                  <button onClick={() => setShowForm(false)} className="flex-1 py-4 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 rounded-2xl font-bold hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors">Cancelar</button>
                  <button 
                    disabled={isSaving}
                    onClick={handleSaveUser} 
                    className={`flex-1 py-4 bg-brand-blue text-white rounded-2xl font-bold transition-colors shadow-lg shadow-sky-100 dark:shadow-none flex items-center justify-center gap-2 ${isSaving ? 'opacity-50 cursor-not-allowed' : 'hover:opacity-90'}`}
                  >
                    {isSaving && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                    {isSaving ? 'Guardando...' : 'Guardar'}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const SyncStatusTray = () => {
  const { isOnline, pendingCount, syncBacklog, forceSync, clearFailed } = useOfflineStatus();
  const [isOpen, setIsOpen] = useState(false);
  const [isRotating, setIsRotating] = useState(false);

  const handleForceTrigger = () => {
    setIsRotating(true);
    forceSync();
    setTimeout(() => setIsRotating(false), 1500);
  };

  return (
    <div className="fixed bottom-24 md:bottom-6 right-6 z-[90] font-sans">
      <div className="relative">
        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.95 }}
              className="absolute bottom-16 right-0 w-80 bg-white/95 dark:bg-zinc-950/95 backdrop-blur-xl border border-zinc-200 dark:border-white/10 rounded-3xl shadow-2xl overflow-hidden p-5 space-y-4"
            >
              <div className="flex items-center justify-between border-b border-zinc-100 dark:border-white/5 pb-3">
                <div className="flex items-center gap-2">
                  <Database className="w-4 h-4 text-brand-blue" />
                  <h4 className="font-bold text-xs text-zinc-900 dark:text-white uppercase tracking-wider">Centro de Sincronización</h4>
                </div>
                <button 
                  onClick={() => setIsOpen(false)}
                  className="p-1 rounded-lg text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Status Band */}
              <div className="flex items-center justify-between py-2 px-3 bg-zinc-50 dark:bg-zinc-900/60 rounded-2xl border border-zinc-100 dark:border-white/5 text-xs">
                <span className="text-zinc-500 font-medium">Estado de Red:</span>
                <div className="flex items-center gap-1.5 font-bold">
                  <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-red-500 animate-pulse'}`} />
                  <span className={isOnline ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'}>
                    {isOnline ? 'CONECTADO' : 'SIN CONEXIÓN (OFFLINE)'}
                  </span>
                </div>
              </div>

              {/* Backlog Status */}
              <div className="space-y-2">
                <div className="flex justify-between items-center text-[10px] font-bold text-zinc-400 dark:text-zinc-600 uppercase tracking-widest leading-none">
                  <span>Cola de operaciones ({pendingCount})</span>
                  {syncBacklog.some(item => item.state === 'failed') && (
                    <button 
                      onClick={clearFailed}
                      className="text-red-500 hover:underline hover:text-red-600 normal-case cursor-pointer"
                    >
                      Purgar fallidos
                    </button>
                  )}
                </div>

                {syncBacklog.length === 0 ? (
                  <div className="text-center py-6 text-zinc-400 dark:text-zinc-600">
                    <CheckCircle2 className="w-8 h-8 text-emerald-500/20 mx-auto mb-2" />
                    <p className="text-[10px] font-bold uppercase tracking-wider">Todo Sincronizado</p>
                    <p className="text-[9px] mt-0.5 normal-case font-medium text-zinc-500 dark:text-zinc-400">No hay transacciones pendientes en terreno.</p>
                  </div>
                ) : (
                  <div className="max-h-40 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                    {syncBacklog.map((item) => {
                      const collectionNames: Record<string, string> = {
                        equipment: 'Equipos',
                        findings: 'Hallazgos',
                        inspections: 'Inspecciones',
                        notifications: 'Notificaciones',
                        users: 'Usuarios',
                        areas: 'Áreas'
                      };
                      const collectionLabel = collectionNames[item.collection] || item.collection;

                      const stateLabels: Record<string, string> = {
                        syncing: 'SINCRONIZANDO',
                        failed: 'FALLIDO',
                        pending: 'PENDIENTE'
                      };
                      const stateLabel = stateLabels[item.state] || item.state.toUpperCase();

                      const opLabels: Record<string, string> = {
                        create: 'CREAR',
                        update: 'ACTUALIZAR',
                        delete: 'ELIMINAR',
                        merge: 'ACTUALIZAR'
                      };
                      const opLabel = opLabels[item.operation] || item.operation.toUpperCase();

                      return (
                        <div 
                          key={item.id} 
                          className="p-2.5 rounded-xl bg-zinc-50/50 dark:bg-zinc-900/40 border border-zinc-100 dark:border-white/5 flex flex-col gap-1 text-[11px]"
                        >
                          <div className="flex justify-between">
                            <span className="font-bold text-zinc-800 dark:text-zinc-200 capitalize">
                              {collectionLabel}
                            </span>
                            <span className={`px-1.5 py-0.5 rounded-md text-[8px] font-extrabold uppercase tracking-widest ${
                              item.state === 'syncing' ? 'bg-sky-50 dark:bg-sky-500/10 text-brand-blue dark:text-sky-400' :
                              item.state === 'failed' ? 'bg-red-50 dark:bg-red-500/10 text-red-500' :
                              'bg-amber-50 dark:bg-amber-500/10 text-amber-500'
                            }`}>
                              {stateLabel}
                            </span>
                          </div>
                          <div className="text-[9px] text-zinc-400 dark:text-zinc-500 flex justify-between">
                            <span className="font-mono truncate max-w-[120px]">ID Doc: {item.docId}</span>
                            <span className="font-mono">{opLabel}</span>
                          </div>
                          {item.error && (
                            <p className="text-[8px] text-red-500/80 font-mono mt-0.5 max-h-8 overflow-y-auto">
                              {item.error}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Force sync actions */}
              {syncBacklog.length > 0 && (
                <button
                  type="button"
                  onClick={handleForceTrigger}
                  disabled={!isOnline || isRotating}
                  className="w-full py-3 bg-zinc-900 dark:bg-white text-white dark:text-black hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed rounded-2xl font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isRotating ? 'animate-spin' : ''}`} />
                  <span>Sincronizar ahora ({pendingCount})</span>
                </button>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Trigger Badge */}
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={`flex items-center gap-2.5 p-3.5 rounded-full shadow-lg hover:scale-105 active:scale-95 transition-all text-xs font-bold leading-none cursor-pointer ${
            pendingCount > 0 
              ? 'bg-amber-500 hover:bg-amber-600 text-white animate-pulse-subtle' 
              : isOnline 
                ? 'bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-200 border border-zinc-100 dark:border-white/10 shadow-md' 
                : 'bg-red-500 text-white'
          }`}
        >
          {isOnline ? (
            <Wifi className="w-4 h-4 text-emerald-500" />
          ) : (
            <WifiOff className="w-4 h-4 text-red-500 animate-pulse" />
          )}
          
          {pendingCount > 0 ? (
            <span className="flex items-center gap-1.5">
              <span className="bg-white/20 text-white px-2 py-0.5 rounded-full font-mono text-[10px]">{pendingCount}</span>
              <span className="hidden sm:inline">Cola Local</span>
            </span>
          ) : (
            <span className="hidden sm:inline text-zinc-500 dark:text-zinc-400">
              {isOnline ? 'En Línea' : 'Sin Conexión'}
            </span>
          )}
        </button>
      </div>
    </div>
  );
};

// --- Help & Instructions View ---
const HelpView = () => {
  const [activeSubTab, setActiveSubTab] = useState<'general' | 'operator' | 'supervisor' | 'faq'>('general');
  const [activeFaq, setActiveFaq] = useState<number | null>(null);

  const faqs = [
    {
      q: "¿Qué sucede si no tengo señal de internet durante una inspección?",
      a: "No te preocupes. La aplicación cuenta con soporte offline completo. Sigue realizando el checklist de los equipos normalmente y reporta los hallazgos que encuentres. Toda la información y fotos se encolarán de forma segura en tu dispositivo (verás un indicador de 'Cola Local' en la parte inferior). Una vez que vuelvas a tener internet, se sincronizará automáticamente con Firestore."
    },
    {
      q: "¿Por qué se rechaza mi fotografía al reportar un hallazgo o checklist?",
      a: "Para asegurar la máxima veracidad y nitidez de la evidencia física de planta, la aplicación valida que la foto tenga una resolución mínima de 300x300 píxeles. Si el archivo que subes o la cámara entrega una imagen de dimensiones menores, el formulario te alertará de que aumentes la resolución o selecciones una imagen de mejor calidad."
    },
    {
      q: "¿Cómo exporto los datos históricos a Excel o planilla de cálculo?",
      a: "En la pestaña 'Historial', selecciona los filtros que requieras (planta, área, fechas, estados). Una vez filtrada la lista de hallazgos abiertos o cerrados, pulsa el botón verde 'Exportar CSV' para descargar un archivo totalmente estructurado y legible por Excel, que incluye el cálculo de horas de resolución y comentarios aplicados."
    },
    {
      q: "¿Cómo puedo cambiar entre modo de visualización visual (VOSO) y tradicional?",
      a: "Al iniciar la inspección de un equipo, la aplicación determina la configuración guardada por la administración. El checklist visual te permite registrar fácil y rápidamente los sentidos (Visual, Olfativo, Auditivo, Sensorial) con botones interactivos, mientras que el tradicional utiliza un check clásico para cada componente."
    },
    {
      q: "¿Cómo configuro las firmas, cargos y plantillas de los reportes PDF?",
      a: "Si tienes credenciales de Administrador, la pestaña 'Configuración PDF' te permitirá habilitar/deshabilitar firmas preestablecidas, definir nombres y cargos de los aprobadores autorizados, cargar el logo corporativo del reporte, y habilitar un resumen ejecutivo automático que se añade a cada PDF generado."
    }
  ];

  const stepsConfig = [
    {
      id: "01",
      title: "Selección",
      desc: "El operador selecciona la planta y área, o bien escanea el código QR directo del equipo a inspeccionar.",
      icon: MapPin,
      borderColor: "border-l-4 border-sky-500",
      iconBg: "bg-sky-50 dark:bg-sky-950/40 text-sky-600 dark:text-sky-400"
    },
    {
      id: "02",
      title: "Inspección",
      desc: "Se responde el checklist modular (VOSO o Tradicional). También se puede declarar un hallazgo general o anomalía sin checklist.",
      icon: ListChecks,
      borderColor: "border-l-4 border-indigo-500",
      iconBg: "bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400"
    },
    {
      id: "03",
      title: "Reporte",
      desc: "Si falta algo, se añade una foto descriptiva (mín. 300x300px) y texto. El 'Autocierre' puede resolverlo en el acto.",
      icon: Camera,
      borderColor: "border-l-4 border-amber-500",
      iconBg: "bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400"
    },
    {
      id: "04",
      title: "Auditoría",
      desc: "Los supervisores reciben alertas instantáneas, auditan la foto, cambian estados y asignan cuadrillas de reparación.",
      icon: Bell,
      borderColor: "border-l-4 border-purple-500",
      iconBg: "bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400"
    },
    {
      id: "05",
      title: "Cierre",
      desc: "Tras resolver el hallazgo, se liquida el ciclo de horas reales. Los reportes consolidados se bajan en formato PDF o CSV.",
      icon: Download,
      borderColor: "border-l-4 border-emerald-500",
      iconBg: "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400"
    }
  ];

  return (
    <div className="space-y-8 animate-fade-in max-w-full overflow-hidden">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-100 dark:border-white/5 pb-6">
        <div>
          <h2 className="text-xl md:text-2xl font-black text-zinc-900 dark:text-white tracking-tight uppercase flex items-center gap-3">
            <div className="p-2 bg-brand-blue/10 rounded-2xl shrink-0">
              <BookOpen className="w-5 h-5 md:w-6 md:h-6 text-brand-blue" />
            </div>
            Guía de Ayuda e Instructivo de Uso
          </h2>
          <p className="text-xs md:text-sm text-zinc-500 dark:text-zinc-400 mt-1.5 leading-relaxed">
            Revisa los flujos de inspección, requerimientos técnicos, perfiles y soluciones rápidas del sistema.
          </p>
        </div>
      </div>

      {/* Tabs Menu */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 border-b border-zinc-100 dark:border-white/5 pb-3">
        <button
          onClick={() => { setActiveSubTab('general'); setActiveFaq(null); }}
          className={`px-3 py-2.5 text-[10px] md:text-xs font-bold uppercase tracking-wider rounded-xl transition-all border text-center cursor-pointer ${
            activeSubTab === 'general'
              ? 'bg-brand-blue text-white border-brand-blue shadow-lg shadow-brand-blue/10 font-black'
              : 'bg-white dark:bg-zinc-900/40 text-zinc-500 dark:text-zinc-450 border-zinc-100 dark:border-white/5 hover:bg-zinc-50 dark:hover:bg-zinc-900'
          }`}
        >
          Flujo General
        </button>
        <button
          onClick={() => { setActiveSubTab('operator'); setActiveFaq(null); }}
          className={`px-3 py-2.5 text-[10px] md:text-xs font-bold uppercase tracking-wider rounded-xl transition-all border text-center cursor-pointer ${
            activeSubTab === 'operator'
              ? 'bg-brand-blue text-white border-brand-blue shadow-lg shadow-brand-blue/10 font-black'
              : 'bg-white dark:bg-zinc-900/40 text-zinc-500 dark:text-zinc-455 border-zinc-100 dark:border-white/5 hover:bg-zinc-50 dark:hover:bg-zinc-900'
          }`}
        >
          Operadores
        </button>
        <button
          onClick={() => { setActiveSubTab('supervisor'); setActiveFaq(null); }}
          className={`px-3 py-2.5 text-[10px] md:text-xs font-bold uppercase tracking-wider rounded-xl transition-all border text-center cursor-pointer ${
            activeSubTab === 'supervisor'
              ? 'bg-brand-blue text-white border-brand-blue shadow-lg shadow-brand-blue/10 font-black'
              : 'bg-white dark:bg-zinc-900/40 text-zinc-500 dark:text-zinc-455 border-zinc-100 dark:border-white/5 hover:bg-zinc-50 dark:hover:bg-zinc-900'
          }`}
        >
          Supervisores y Admin
        </button>
        <button
          onClick={() => { setActiveSubTab('faq'); setActiveFaq(null); }}
          className={`px-3 py-2.5 text-[10px] md:text-xs font-bold uppercase tracking-wider rounded-xl transition-all border text-center cursor-pointer ${
            activeSubTab === 'faq'
              ? 'bg-brand-blue text-white border-brand-blue shadow-lg shadow-brand-blue/10 font-black'
              : 'bg-white dark:bg-zinc-900/40 text-zinc-500 dark:text-zinc-455 border-zinc-100 dark:border-white/5 hover:bg-zinc-50 dark:hover:bg-zinc-900'
          }`}
        >
          Preguntas Frecuentes
        </button>
      </div>

      {activeSubTab === 'general' && (
        <div className="space-y-8">
          <div className="bg-white dark:bg-zinc-900 p-5 md:p-6 rounded-[2rem] border border-zinc-100 dark:border-white/10 space-y-4">
            <h3 className="text-base font-black text-zinc-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
              <span className="p-1.5 bg-zinc-100 dark:bg-white/5 rounded-lg">🔄</span> Ciclo Integral de Inspección y Hallazgos
            </h3>
            <p className="text-zinc-600 dark:text-zinc-400 text-xs md:text-sm leading-relaxed">
              La plataforma permite controlar, registrar y dar seguimiento en tiempo real a las condiciones industriales de todas las áreas y equipos. El flujo se compone de 5 etapas automatizadas sumamente intuitivas:
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 pt-4">
              {stepsConfig.map((item, idx) => {
                const IconComp = item.icon;
                return (
                  <div 
                    key={`gen-step-${idx}`}
                    className={`bg-zinc-50 dark:bg-white/5 p-5 rounded-2xl border border-zinc-100 dark:border-white/5 relative overflow-hidden flex flex-col justify-between min-h-[12rem] hover:-translate-y-1 transition-transform duration-300 ${item.borderColor}`}
                  >
                    <span className="absolute right-4 top-2 font-mono text-3xl font-black text-zinc-200 dark:text-white/5 select-none">{item.id}</span>
                    <div className="space-y-4 h-full flex flex-col justify-between">
                      <div>
                        <div className={`p-2 w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mb-3 ${item.iconBg}`}>
                          <IconComp className="w-4 h-4" />
                        </div>
                        <h4 className="text-xs font-black text-zinc-900 dark:text-white uppercase tracking-widest mb-1.5">
                          {item.title}
                        </h4>
                        <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-relaxed font-medium">
                          {item.desc}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white dark:bg-zinc-900 p-6 rounded-[2rem] border border-zinc-100 dark:border-white/10 space-y-4 hover:shadow-xs transition-shadow duration-300">
              <h4 className="text-sm font-black text-zinc-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                <div className="p-1.5 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-xl">
                  <Database className="w-4 h-4" />
                </div>
                Conectividad & Sincronización Local
              </h4>
              <p className="text-xs text-[#52525b] dark:text-[#a1a1aa] leading-relaxed">
                Este software incluye un motor interno inteligente capaz de retener checklists completos, imágenes y reportes de anomalías directamente en la sesión del dispositivo. Si el inspector pierde internet en las profundidades de la planta:
              </p>
              <ul className="text-xs text-zinc-500 dark:text-zinc-450 space-y-2.5">
                <li className="flex items-start gap-2">
                  <Check className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                  <span>La aplicación <strong className="text-zinc-800 dark:text-zinc-200">no se congelará ni perderá datos</strong>.</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                  <span>Habilitará la <strong className="text-zinc-800 dark:text-zinc-200">persistencia temporal</strong> en formato de base de datos local HTML5.</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                  <span>Apenas se consiga señal o conexión wifi, enviará la cola remanente automáticamente de manera ordenada.</span>
                </li>
              </ul>
            </div>

            <div className="bg-white dark:bg-zinc-900 p-6 rounded-[2rem] border border-zinc-100 dark:border-white/10 space-y-4 hover:shadow-xs transition-shadow duration-300">
              <h4 className="text-sm font-black text-zinc-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                <div className="p-1.5 bg-sky-100 dark:bg-sky-950 text-brand-blue rounded-xl">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                Validación de Fotos e Integridad
              </h4>
              <p className="text-xs text-[#52525b] dark:text-[#a1a1aa] leading-relaxed">
                Cada hallazgo o reporte que requiera evidencia visual pasa por una prueba automática de dimensiones y compresión inteligente en tiempo real para optimizar ancho de banda pero priorizando la legibilidad técnica:
              </p>
              <ul className="text-xs text-zinc-500 dark:text-zinc-450 space-y-2.5">
                <li className="flex items-start gap-2">
                  <Check className="w-4 h-4 text-brand-blue shrink-0 mt-0.5" />
                  <span><strong className="text-zinc-800 dark:text-zinc-200">Dimensión Mínima de Foto:</strong> Obligatorio <span className="bg-sky-50 dark:bg-sky-900/30 text-brand-blue dark:text-sky-300 px-2 py-0.5 rounded text-[10px] font-mono font-black">300x300 píxeles</span> para evitar imágenes borrosas o nulas.</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="w-4 h-4 text-brand-blue shrink-0 mt-0.5" />
                  <span><strong className="text-zinc-800 dark:text-zinc-200">Compresión Dinámica:</strong> Escala imágenes pesadas reduciendo megabytes pero preservando bordes definidos.</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {activeSubTab === 'operator' && (
        <div className="space-y-6 animate-fade-in">
          <div className="bg-white dark:bg-zinc-900 p-5 md:p-6 rounded-[2rem] border border-zinc-100 dark:border-white/10 space-y-6">
            <div>
              <h3 className="text-sm font-black text-zinc-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                <span className="p-1.5 bg-zinc-100 dark:bg-white/5 rounded-lg">👷</span> Funciones y Operación de Inspectores en Terreno
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1.5">
                La labor del operador es registrar de forma fidedigna el estado mecánico y de seguridad operacional. Sigue este orden de pasos:
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4">
              <div className="border border-zinc-100 dark:border-white/5 p-5 rounded-2xl space-y-3 bg-zinc-50/50 dark:bg-white/5">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-1 bg-sky-500 text-white text-[10px] font-black uppercase rounded-lg">
                    Paso 1
                  </span>
                  <h4 className="text-xs font-black text-zinc-900 dark:text-white uppercase tracking-wider">Identificación rápida de Planta, Área o Equipo</h4>
                </div>
                <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed font-medium">
                  Al ingresar con tu cuenta de operador, selecciona la planta asignada. Podrás buscar tu área en el listado haciendo clic en ella, o usar el cómodo lector de códigos QR ubicado en la barra para escanear directamente la etiqueta del equipo. Esto te dirigirá a sus puntos de inspección sin demoras.
                </p>
              </div>

              <div className="border border-zinc-100 dark:border-white/5 p-5 rounded-2xl space-y-3 bg-zinc-50/50 dark:bg-white/5">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-1 bg-brand-blue text-white text-[10px] font-black uppercase rounded-lg">
                    Paso 2
                  </span>
                  <h4 className="text-xs font-black text-zinc-900 dark:text-white uppercase tracking-wider">Responder el checklist (Visual VOSO o Tradicional)</h4>
                </div>
                <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed font-medium">
                  Para el checklist <strong className="text-zinc-800 dark:text-zinc-200">Visual VOSO</strong>, responde cómodamente el estado de los componentes utilizando los sentidos:
                </p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 py-1">
                  <div className="p-3 border border-zinc-100 dark:border-white/5 rounded-2xl text-center bg-white dark:bg-zinc-900 flex flex-col items-center gap-1 hover:border-sky-500/30 transition-all duration-300">
                    <div className="p-1.5 bg-sky-100 dark:bg-sky-950/40 text-sky-600 dark:text-sky-455 rounded-xl">
                      <Eye className="w-5 h-5" />
                    </div>
                    <span className="block text-xs font-black text-zinc-900 dark:text-white uppercase tracking-wider">👁️ V</span>
                    <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">Inspección Visual</span>
                  </div>
                  <div className="p-3 border border-zinc-100 dark:border-white/5 rounded-2xl text-center bg-white dark:bg-zinc-900 flex flex-col items-center gap-1 hover:border-purple-500/30 transition-all duration-300">
                    <div className="p-1.5 bg-purple-100 dark:bg-purple-950/40 text-purple-600 dark:text-purple-455 rounded-xl">
                      <Wind className="w-5 h-5" />
                    </div>
                    <span className="block text-xs font-black text-zinc-900 dark:text-white uppercase tracking-wider">👃 O</span>
                    <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">Olfativa / Olores</span>
                  </div>
                  <div className="p-3 border border-zinc-100 dark:border-white/5 rounded-2xl text-center bg-white dark:bg-zinc-900 flex flex-col items-center gap-1 hover:border-amber-500/30 transition-all duration-300">
                    <div className="p-1.5 bg-amber-100 dark:bg-amber-950/40 text-amber-600 dark:text-amber-455 rounded-xl">
                      <Ear className="w-5 h-5" />
                    </div>
                    <span className="block text-xs font-black text-zinc-900 dark:text-white uppercase tracking-wider">👂 S</span>
                    <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">Sónicos / Sonido</span>
                  </div>
                  <div className="p-3 border border-zinc-100 dark:border-white/5 rounded-2xl text-center bg-white dark:bg-zinc-900 flex flex-col items-center gap-1 hover:border-emerald-500/30 transition-all duration-300">
                    <div className="p-1.5 bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-455 rounded-xl">
                      <Hand className="w-5 h-5" />
                    </div>
                    <span className="block text-xs font-black text-zinc-900 dark:text-white uppercase tracking-wider">✋ O</span>
                    <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">Sensorial / Tacto</span>
                  </div>
                </div>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed font-medium mt-2">
                  Si un área no posee equipos creados, el botón principal cambiará automáticamente a <strong className="text-zinc-800 dark:text-zinc-200">"Declarar Hallazgo de Área"</strong>, facilitándote enviar la información directamente de un solo clic.
                </p>
              </div>

              <div className="border border-zinc-100 dark:border-white/5 p-5 rounded-2xl space-y-3 bg-zinc-50/50 dark:bg-white/5">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-1 bg-amber-500 text-white text-[10px] font-black uppercase rounded-lg">
                    Paso 3
                  </span>
                  <h4 className="text-xs font-black text-zinc-900 dark:text-white uppercase tracking-wider">Reportar un Hallazgo y Evidencia Crítica</h4>
                </div>
                <p className="text-xs text-zinc-650 dark:text-zinc-400 leading-relaxed font-medium">
                  Si detectas una anomalía o falla, se requiere adjuntar información estructurada:
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="p-3 bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-white/5 rounded-xl">
                    <span className="text-xs font-bold text-zinc-950 dark:text-white block mb-1">📝 Descripción</span>
                    <span className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-relaxed block">
                      Detalla la falla de forma clara. Al menos 2 palabras (Ej: <i>"Goteo en válvula"</i>).
                    </span>
                  </div>
                  <div className="p-3 bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-white/5 rounded-xl">
                    <span className="text-xs font-bold text-zinc-950 dark:text-white block mb-1">📸 Foto Técnica</span>
                    <span className="text-[11px] text-zinc-505 dark:text-zinc-400 leading-relaxed block">
                      Obligatorio adjuntar foto clara del daño (mínimo 300x300px), usando la cámara del dispositivo móvil.
                    </span>
                  </div>
                  <div className="p-3 bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-white/5 rounded-xl">
                    <span className="text-xs font-bold text-zinc-950 dark:text-white block mb-1">⚡ Autocierre técnico</span>
                    <span className="text-[11px] text-zinc-505 dark:text-zinc-400 leading-relaxed block">
                      Si lo solucionaste altiro, márcale para guardarlo como resuelto, sin sobrecargar tareas de supervisores.
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeSubTab === 'supervisor' && (
        <div className="space-y-6 animate-fade-in">
          <div className="bg-white dark:bg-zinc-900 p-5 md:p-6 rounded-[2rem] border border-zinc-100 dark:border-white/10 space-y-6">
            <div>
              <h3 className="text-sm font-black text-zinc-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                <span className="p-1.5 bg-zinc-100 dark:bg-white/5 rounded-lg">🕵️</span> Panel Administrativo y de Gestión de Supervisores
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1.5">
                La labor del supervisor es comandar las inspecciones, dar seguimiento analítico a hallazgos históricos, crear áreas/equipos y autorizar cierres.
              </p>
            </div>

            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-5 border border-zinc-100 dark:border-white/5 rounded-2xl bg-zinc-50/50 dark:bg-white/5 relative overflow-hidden flex flex-col justify-between">
                  <div>
                    <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mb-3">
                      <BellRing className="w-4 h-4" />
                    </div>
                    <h4 className="text-xs font-black uppercase tracking-wider text-zinc-900 dark:text-white mb-2">1. Alertabilidad Técnica</h4>
                    <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-relaxed font-medium">
                      La campana superior te notificará de inmediato con un sonido y aviso en pantalla cuando un operador guarde un nuevo hallazgo abierto o en revisión.
                    </p>
                  </div>
                </div>

                <div className="p-5 border border-zinc-100 dark:border-white/5 rounded-2xl bg-zinc-50/50 dark:bg-white/5 relative overflow-hidden flex flex-col justify-between">
                  <div>
                    <div className="w-8 h-8 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center mb-3">
                      <Edit3 className="w-4 h-4" />
                    </div>
                    <h4 className="text-xs font-black uppercase tracking-wider text-zinc-900 dark:text-white mb-2">2. Intervención Activa</h4>
                    <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-relaxed font-medium">
                      Haz clic en cualquier hallazgo activo. Podrás pasarlo a "En Revisión" para coordinar técnicos o digitar la solución y presionar "Aprobar Cierre".
                    </p>
                  </div>
                </div>

                <div className="p-5 border border-zinc-100 dark:border-white/5 rounded-2xl bg-zinc-50/50 dark:bg-white/5 relative overflow-hidden flex flex-col justify-between md:col-span-3 lg:col-span-1">
                  <div>
                    <div className="w-8 h-8 rounded-lg bg-pink-50 dark:bg-pink-950/40 text-pink-600 dark:text-pink-400 flex items-center justify-center mb-3">
                      <BarChart3 className="w-4 h-4" />
                    </div>
                    <h4 className="text-xs font-black uppercase tracking-wider text-zinc-900 dark:text-white mb-2">3. Monitor de Métricas</h4>
                    <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-relaxed font-medium">
                      Monitorea gráficos por planta y área de: cantidad de incidentes reportados, porcentaje con fallas, y el tiempo de respuesta promedio (MTTR).
                    </p>
                  </div>
                </div>
              </div>

              <div className="border border-zinc-100 dark:border-white/5 p-5 rounded-2xl space-y-4">
                <div className="flex items-center gap-2">
                  <div className="p-1 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-lg">
                    <FileText className="w-4 h-4" />
                  </div>
                  <h4 className="text-xs font-black uppercase text-zinc-900 dark:text-white tracking-wider">Sistemas de Exportación y Auditoría Avanzada</h4>
                </div>
                <p className="text-xs text-zinc-650 dark:text-zinc-400 leading-relaxed font-medium">
                  Para respaldar auditorías externas, comités de seguridad o reportes a la gerencia, puedes usar los botones del <strong>Historial</strong>:
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="bg-white dark:bg-black p-4 border border-zinc-100 dark:border-white/5 rounded-xl space-y-1.5">
                    <span className="font-black text-brand-blue text-xs block uppercase tracking-wider">📋 Exportar PDF Profesional</span>
                    <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-relaxed font-medium">
                      Genera un informe súper detallado con las firmas del supervisor configurados en "Configuración PDF", fotos nítidas con zoom de los hallazgos, y gráficos listos para imprimir.
                    </p>
                  </div>
                  <div className="bg-white dark:bg-black p-4 border border-zinc-100 dark:border-white/5 rounded-xl space-y-1.5">
                    <span className="font-black text-emerald-600 dark:text-emerald-400 text-xs block uppercase tracking-wider">🍏 Exportar Planilla CSV (Excel)</span>
                    <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-relaxed font-medium">
                      Descarga un listado plano que registra la fecha del reporte, nombre del operador, duraciones exactas en segundos, cálculo de tiempos de resolución y observaciones técnicas.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeSubTab === 'faq' && (
        <div className="space-y-3 animate-fade-in">
          {faqs.map((faq, index) => {
            const isOpen = activeFaq === index;
            return (
              <div 
                key={`faq-item-${index}`} 
                onClick={() => setActiveFaq(isOpen ? null : index)}
                className="bg-white dark:bg-zinc-900 p-5 rounded-3xl border border-zinc-100 dark:border-white/10 hover:shadow-xs transition-all duration-300 cursor-pointer select-none space-y-1"
              >
                <div className="flex items-center justify-between gap-4">
                  <h4 className="text-xs md:text-sm font-black text-zinc-900 dark:text-white flex items-center gap-3">
                    <span className="w-6 h-6 rounded-lg bg-brand-blue/10 dark:bg-sky-400/10 text-brand-blue dark:text-sky-300 text-xs font-black flex items-center justify-center shrink-0">?</span>
                    {faq.q}
                  </h4>
                  <ChevronDown className={`w-4 h-4 text-zinc-400 transition-transform duration-300 shrink-0 ${isOpen ? 'rotate-180 text-brand-blue' : ''}`} />
                </div>
                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed pl-9 pt-3 font-medium border-t border-zinc-50 dark:border-white/5 mt-3">
                        {faq.a}
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export interface ToastMessage {
  id: string;
  title: string;
  message: string;
  type: 'success' | 'info' | 'warning' | 'error';
}

export const showToast = (title: string, message: string, type: 'success' | 'info' | 'warning' | 'error' = 'success') => {
  const event = new CustomEvent('app-toast', { detail: { title, message, type } });
  window.dispatchEvent(event);
};

const ToastContainer = ({ toasts, setToasts }: { toasts: ToastMessage[], setToasts: React.Dispatch<React.SetStateAction<ToastMessage[]>> }) => {
  return (
    <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2.5 pointer-events-none max-w-sm w-full px-4 sm:px-0">
      <AnimatePresence>
        {toasts.map((toast) => (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ type: 'spring', damping: 25, stiffness: 350 }}
            className="pointer-events-auto w-full bg-white/95 dark:bg-[#1C1C1E]/95 ios-glass border border-[#D2D2D7]/50 dark:border-white/10 rounded-2xl shadow-xl shadow-black/5 p-3.5 flex items-start gap-3 transition-colors duration-150"
          >
            <div className="flex-shrink-0 mt-0.5">
              {toast.type === 'success' && <CheckCircle2 className="w-5 h-5 text-[#34C759]" />}
              {toast.type === 'error' && <AlertCircle className="w-5 h-5 text-[#FF3B30]" />}
              {toast.type === 'warning' && <AlertTriangle className="w-5 h-5 text-[#FF9500]" />}
              {toast.type === 'info' && <Bell className="w-5 h-5 text-[#0071E3] dark:text-[#0A84FF]" />}
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="font-semibold text-xs sm:text-sm text-[#1D1D1F] dark:text-[#F5F5F7] tracking-tight">{toast.title}</h4>
              <p className="text-xs text-[#6E6E73] dark:text-[#98989D] mt-0.5 leading-relaxed font-normal">{toast.message}</p>
            </div>
            <button
              onClick={() => setToasts(prev => prev.filter(t => t.id !== toast.id))}
              className="flex-shrink-0 text-[#8E8E93] hover:text-[#1D1D1F] dark:hover:text-[#F5F5F7] transition-colors p-1 rounded-full hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer"
              title="Cerrar"
            >
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
};


export default function App() {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('theme') as 'light' | 'dark') || 'light';
    }
    return 'light';
  });

  useEffect(() => {
    let themeColorMeta = document.querySelector('meta[name="theme-color"]');
    if (!themeColorMeta) {
      themeColorMeta = document.createElement('meta');
      themeColorMeta.setAttribute('name', 'theme-color');
      document.head.appendChild(themeColorMeta);
    }

    let appleStatusBarMeta = document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]');

    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
      document.documentElement.style.colorScheme = 'dark';
      themeColorMeta.setAttribute('content', '#000000');
      if (appleStatusBarMeta) appleStatusBarMeta.setAttribute('content', 'black');
    } else {
      document.documentElement.classList.remove('dark');
      document.documentElement.style.colorScheme = 'light';
      themeColorMeta.setAttribute('content', '#ffffff');
      if (appleStatusBarMeta) appleStatusBarMeta.setAttribute('content', 'default');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  const [activeTab, setActiveTab] = useState<'Home' | 'History' | 'Admin'>('Home');
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showNotificationCenter, setShowNotificationCenter] = useState(false);
  const [isOffline, setIsOffline] = useState(false);

  return (
    <AuthWrapper theme={theme}>
      {(user) => (
        <AppLayout 
          user={user} 
          notifications={notifications} 
          setNotifications={setNotifications} 
          showNotificationCenter={showNotificationCenter}
          setShowNotificationCenter={setShowNotificationCenter}
          isOffline={isOffline}
          setIsOffline={setIsOffline}
          theme={theme}
          setTheme={setTheme}
        />
      )}
    </AuthWrapper>
  );
}

const LiveClock = React.memo(({ formatString }: { formatString: string }) => {
  const [time, setTime] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);
  return <>{format(time, formatString, { locale: es })}</>;
});

const AppLayout = ({ 
  user, 
  notifications, 
  setNotifications, 
  showNotificationCenter, 
  setShowNotificationCenter,
  isOffline,
  setIsOffline,
  theme,
  setTheme
}: { 
  user: AppUser, 
  notifications: Notification[], 
  setNotifications: (n: Notification[]) => void, 
  showNotificationCenter: boolean, 
  setShowNotificationCenter: (s: boolean) => void,
  isOffline: boolean,
  setIsOffline: (s: boolean) => void,
  theme: 'light' | 'dark',
  setTheme: (t: 'light' | 'dark') => void
}) => {
  const [activeTab, setActiveTab] = useState<'Home' | 'OrdenLimpieza' | 'History' | 'Admin' | 'Notifications' | 'PDFConfig' | 'Help'>('Home');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileMoreOpen, setIsMobileMoreOpen] = useState(false);

  // View mode switcher: allows Admins and Supervisors to toggle between "Operador Mantenedor" and "Supervisor/Admin"
  const [activeRoleView, setActiveRoleView] = useState<UserRole>(() => {
    if (user.role === 'Operador') return 'Operador';
    const saved = typeof window !== 'undefined' ? localStorage.getItem('chekify_active_role_view') : null;
    return (saved as UserRole) || 'Operador'; // Default to Operador so user immediately has access to inspections
  });

  const handleSignOut = async () => {
    AreaService.reset();
    EquipmentService.reset();
    InspectionService.reset();
    FindingService.reset();
    localStorage.removeItem('chekify_cached_user');
    await signOut(auth);
  };

  const effectiveRole = (user.role === 'Administrador' || user.role === 'Supervisor') ? activeRoleView : 'Operador';
  const effectiveRoleUser = React.useMemo(() => ({ ...user, role: effectiveRole }), [user, effectiveRole]);
  const [pendingFindingId, setPendingFindingId] = useState<string | null>(null);
  const [showProfileModal, setShowProfileModal] = useState(false);
  
  // Single, cache-reliable global plants list for the app
  const [plants, setPlants] = useState<Plant[]>([]);

  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  // PWA states
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [showIOSInstructions, setShowIOSInstructions] = useState(false);

  // Open-Meteo Weather state for global Header
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [loadingWeather, setLoadingWeather] = useState<boolean>(false);
  const [weatherError, setWeatherError] = useState<boolean>(false);
  const [isWeatherExpanded, setIsWeatherExpanded] = useState<boolean>(false);

  useEffect(() => {
    let isMounted = true;
    const fetchWeatherConditions = async () => {
      setLoadingWeather(true);
      setWeatherError(false);
      try {
        const userPlant = plants.find(p => p.id === user.plantId);
        const data = await weatherService.getCurrentWeather(
          userPlant?.latitude,
          userPlant?.longitude,
          userPlant?.timezone
        );
        if (isMounted) {
          if (data) {
            setWeather(data);
          } else {
            setWeatherError(true);
          }
        }
      } catch (err) {
        console.error("Error fetching Open-Meteo weather:", err);
        if (isMounted) {
          setWeatherError(true);
        }
      } finally {
        if (isMounted) {
          setLoadingWeather(false);
        }
      }
    };

    fetchWeatherConditions();

    return () => {
      isMounted = false;
    };
  }, [user.plantId, plants]);

  useEffect(() => {
    // 1. Detect if already in standalone mode (installed)
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone;
    if (isStandalone) {
      return;
    }

    // 2. Check if dismissed previously
    const isDismissed = localStorage.getItem('pwa_install_dismissed') === 'true';
    if (isDismissed) {
      return;
    }

    // 3. Listen for the native browser install prompt
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowInstallBanner(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // 4. Detect iOS devices
    const ua = window.navigator.userAgent;
    const isIOSDevice = /iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream;
    setIsIOS(isIOSDevice);
    if (isIOSDevice && !isStandalone) {
      setShowInstallBanner(true);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      console.log('[PWA] Native install prompt outcome:', outcome);
      setDeferredPrompt(null);
      setShowInstallBanner(false);
    } else if (isIOS) {
      setShowIOSInstructions(true);
    }
  };

  const handleDismissBanner = () => {
    localStorage.setItem('pwa_install_dismissed', 'true');
    setShowInstallBanner(false);
  };

  useEffect(() => {
    const handleToastEvent = (e: Event) => {
      const customEvent = e as CustomEvent<Omit<ToastMessage, 'id'>>;
      const { title, message, type } = customEvent.detail;
      const id = Math.random().toString(36).substr(2, 9);
      // Keep at most 3 toasts on screen to prevent visual clutter
      setToasts(prev => [...prev.slice(-2), { id, title, message, type }]);
      
      // Auto dismiss after 4 seconds
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== id));
      }, 4000);
    };

    window.addEventListener('app-toast', handleToastEvent);
    return () => window.removeEventListener('app-toast', handleToastEvent);
  }, []);

  useEffect(() => {
    const unsubPlants = onSnapshot(collection(db, 'plants'), (snapshot) => {
      setPlants(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any)));
    }, (error) => {
      console.warn("Global plants listener error:", error);
    });
    return () => unsubPlants();
  }, []);

  useEffect(() => {
    // Notification listener for Notification Center & badge count
    let notifyQuery;
    
    if (user.role === 'Administrador') {
      notifyQuery = query(
        collection(db, 'notifications'), 
        orderBy('scheduledAt', 'desc'),
        limit(30)
      );
    } else {
      // For non-admins, we must filter to match security rules exactly
      notifyQuery = query(
        collection(db, 'notifications'), 
        where('targetRole', 'in', ['All', user.role]),
        where('scheduledAt', '<=', Timestamp.now()),
        orderBy('scheduledAt', 'desc'),
        limit(30)
      );
    }
    
    const unsubNotify = onSnapshot(notifyQuery, (snapshot) => {
      setIsOffline(false);
      const all = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
      const filtered = all.filter(n => {
        if (user.dismissedNotifications?.includes(n.id)) return false;
        
        // Admins see everything
        if (user.role === 'Administrador') return true;
        
        // 1. Check if target role matches
        const roleMatches = (n.targetRole === 'All' || n.targetRole === user.role);
        if (!roleMatches) return false;

        // 2. Strict Plant Filtering
        if (n.type === 'Finding' || n.plantId) {
          if (!user.plantId) return false;
          return n.plantId === user.plantId;
        }
        
        // Announcement type with no plantId is considered global
        return true;
      });

      // Silently populate notifications for the Bell Notification Center and badge.
      // Never trigger automatic toast popups or boxes on login/session start.
      setNotifications(filtered);
    }, (error) => {
      console.warn("Notification listener error:", error);
      if (error.code === 'unavailable') {
        setIsOffline(true);
      }
    });

    return () => unsubNotify();
  }, [user.role, user.plantId, user.dismissedNotifications]);

  const handleDismissNotification = async (notificationId: string) => {
    try {
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        dismissedNotifications: arrayUnion(notificationId)
      });
    } catch (err) {
      console.error("Error dismissing notification:", err);
    }
  };

  const handleMarkAsRead = async (notificationId: string) => {
    try {
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        readNotifications: arrayUnion(notificationId)
      });
    } catch (err) {
      console.error("Error marking notification as read:", err);
    }
  };

  const handleNotificationAction = (n: Notification) => {
    if (n.referenceId && n.type === 'Finding') {
      setPendingFindingId(n.referenceId);
      if (user.role === 'Operador') {
        setActiveTab('History');
      } else {
        setActiveTab('Home');
      }
      setShowNotificationCenter(false);
    }
  };

  const unreadCount = notifications.filter(n => !user.readNotifications?.includes(n.id)).length;


  return (
    <div data-theme={theme} className="min-h-screen bg-[#F5F5F7] dark:bg-black text-[#1D1D1F] dark:text-[#F5F5F7] flex flex-col md:flex-row transition-colors duration-200">
          {/* Sidebar Navigation (Desktop & Tablet) - Modern Apple macOS/iPadOS HIG Style */}
          <aside className={`hidden md:flex flex-col ${isSidebarCollapsed ? 'w-20 p-3' : 'w-64 p-5'} bg-white/90 dark:bg-[#1C1C1E]/90 ios-glass border-r border-[#D2D2D7]/40 dark:border-white/10 h-screen sticky top-0 z-40 transition-all duration-300 ease-in-out`}>
            <div className={`flex flex-col mb-5 gap-3.5 ${isSidebarCollapsed ? 'items-center' : ''}`}>
              <div className="flex items-center justify-between w-full">
                <button 
                  onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                  className={`p-2 hover:bg-black/5 dark:hover:bg-white/5 rounded-xl text-[#6E6E73] dark:text-[#98989D] transition-colors flex shrink-0 cursor-pointer ${isSidebarCollapsed ? 'mx-auto' : ''}`}
                  title={isSidebarCollapsed ? "Expandir barra lateral" : "Contraer barra lateral"}
                >
                  {isSidebarCollapsed ? <PanelLeftOpen className="w-5 h-5" /> : <PanelLeftClose className="w-5 h-5" />}
                </button>
                {!isSidebarCollapsed && (
                  <button
                    onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
                    className="p-2 hover:bg-black/5 dark:hover:bg-white/5 rounded-xl text-[#6E6E73] dark:text-[#98989D] transition-colors cursor-pointer"
                    title={theme === 'light' ? 'Activar modo oscuro' : 'Activar modo claro'}
                  >
                    {theme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
                  </button>
                )}
              </div>
              <div className={isSidebarCollapsed ? 'w-full flex justify-center py-1' : 'px-1 py-1'}>
                <Logo isCollapsed={isSidebarCollapsed} className={isSidebarCollapsed ? 'h-16 px-1' : 'h-11'} />
              </div>

              {/* Operator Profile Card directly under Logo */}
              <div 
                onClick={() => setShowProfileModal(true)}
                className={`w-full p-3 bg-[#F5F5F7] dark:bg-[#2C2C2E]/60 rounded-2xl border border-[#D2D2D7]/40 dark:border-white/5 hover:border-[#0071E3]/40 hover:bg-[#E5E5EA]/70 dark:hover:bg-[#2C2C2E] cursor-pointer transition-all shadow-xs group ${isSidebarCollapsed ? 'flex justify-center p-2' : ''}`}
                title="Ver y editar mi perfil personal"
              >
                {isSidebarCollapsed ? (
                  <div className="relative group/avatar cursor-pointer">
                    <div className="w-10 h-10 rounded-2xl bg-[#0071E3] text-white font-bold text-sm flex items-center justify-center border border-white/20 shadow-xs shrink-0 overflow-hidden">
                      {user.avatarUrl ? (
                        <img src={user.avatarUrl} alt={user.name} className="w-full h-full object-cover" />
                      ) : (
                        user.name?.charAt(0) || user.email.charAt(0)
                      )}
                    </div>
                    {isOffline && (
                      <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-[#FF9500] border-2 border-white dark:border-black rounded-full animate-ping" />
                    )}
                  </div>
                ) : (
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-2xl bg-[#0071E3] text-white font-bold text-sm flex items-center justify-center border border-white/20 shadow-xs shrink-0 overflow-hidden relative">
                      {user.avatarUrl ? (
                        <img src={user.avatarUrl} alt={user.name} className="w-full h-full object-cover" />
                      ) : (
                        user.name?.charAt(0) || user.email.charAt(0)
                      )}
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                        <Edit3 className="w-3.5 h-3.5" />
                      </div>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-[10px] font-semibold text-[#0071E3] dark:text-[#0A84FF] tracking-tight flex items-center gap-1">
                          {user.role}
                          <Edit3 className="w-2.5 h-2.5 text-[#0071E3] opacity-0 group-hover:opacity-100 transition-opacity" />
                        </span>
                      </div>
                      <p className="text-xs font-bold text-[#1D1D1F] dark:text-[#F5F5F7] truncate leading-tight mt-0.5 group-hover:text-[#0071E3] transition-colors">
                        {user.name}
                      </p>
                      <p className="text-[10px] font-medium text-[#6E6E73] dark:text-[#98989D] truncate mt-0.5">
                        {user.cargo || user.email.replace('@chekify.local', '')}
                      </p>
                      {isOffline && (
                        <div className="mt-1 flex items-center gap-1 px-1.5 py-0.5 bg-[#FF9500]/10 border border-[#FF9500]/20 text-[#C96800] dark:text-[#FF9F0A] text-[9px] font-semibold rounded-md">
                          <AlertCircle className="w-2.5 h-2.5 shrink-0" />
                          <span>Sin conexión</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="flex-1 space-y-1 overflow-y-auto custom-scrollbar">
              <button 
                onClick={() => setShowProfileModal(true)}
                className={`w-full flex items-center ${isSidebarCollapsed ? 'justify-center px-2.5' : 'gap-3 px-3.5'} py-2.5 rounded-xl transition-all font-medium text-sm text-[#1D1D1F] dark:text-[#F5F5F7] hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer`}
                title={isSidebarCollapsed ? "Mi Perfil" : undefined}
              >
                <div className="w-8 h-8 rounded-xl bg-[#0071E3]/12 text-[#0071E3] dark:text-[#0A84FF] flex items-center justify-center shrink-0">
                  <UserCheck className="w-4 h-4" />
                </div>
                {!isSidebarCollapsed && <span className="truncate">Mi Perfil</span>}
              </button>
              <button 
                onClick={() => setActiveTab('Home')}
                className={`w-full flex items-center ${isSidebarCollapsed ? 'justify-center px-2.5' : 'gap-3 px-3.5'} py-2.5 rounded-xl transition-all font-semibold text-sm cursor-pointer ${
                  activeTab === 'Home' 
                    ? 'bg-[#0071E3] text-white shadow-xs' 
                    : 'text-[#1D1D1F] dark:text-[#F5F5F7] hover:bg-black/5 dark:hover:bg-white/5 font-medium'
                }`}
                title={isSidebarCollapsed ? "Inspección Primaria" : undefined}
              >
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${activeTab === 'Home' ? 'bg-white/20 text-white' : 'bg-[#0071E3]/12 text-[#0071E3] dark:text-[#0A84FF]'}`}>
                  <ShieldCheck className="w-4 h-4" />
                </div>
                {!isSidebarCollapsed && <span className="truncate">Inspección VOSO</span>}
              </button>
              <button 
                onClick={() => setActiveTab('OrdenLimpieza')}
                className={`w-full flex items-center ${isSidebarCollapsed ? 'justify-center px-2.5' : 'gap-3 px-3.5'} py-2.5 rounded-xl transition-all font-semibold text-sm cursor-pointer ${
                  activeTab === 'OrdenLimpieza' 
                    ? 'bg-[#0071E3] text-white shadow-xs' 
                    : 'text-[#1D1D1F] dark:text-[#F5F5F7] hover:bg-black/5 dark:hover:bg-white/5 font-medium'
                }`}
                title={isSidebarCollapsed ? "Orden & Limpieza" : undefined}
              >
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${activeTab === 'OrdenLimpieza' ? 'bg-white/20 text-white' : 'bg-[#AF52DE]/15 text-[#AF52DE]'}`}>
                  <Sparkles className="w-4 h-4" />
                </div>
                {!isSidebarCollapsed && <span className="truncate">Orden & Limpieza</span>}
              </button>
              <button 
                onClick={() => setActiveTab('History')}
                className={`w-full flex items-center ${isSidebarCollapsed ? 'justify-center px-2.5' : 'gap-3 px-3.5'} py-2.5 rounded-xl transition-all font-semibold text-sm cursor-pointer ${
                  activeTab === 'History' 
                    ? 'bg-[#0071E3] text-white shadow-xs' 
                    : 'text-[#1D1D1F] dark:text-[#F5F5F7] hover:bg-black/5 dark:hover:bg-white/5 font-medium'
                }`}
                title={isSidebarCollapsed ? "Historial" : undefined}
              >
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${activeTab === 'History' ? 'bg-white/20 text-white' : 'bg-[#34C759]/15 text-[#34C759]'}`}>
                  <History className="w-4 h-4" />
                </div>
                {!isSidebarCollapsed && <span className="truncate">Historial</span>}
              </button>
              {user.role === 'Administrador' && (
                <>
                  <button 
                    onClick={() => setActiveTab('Admin')}
                    className={`w-full flex items-center ${isSidebarCollapsed ? 'justify-center px-2.5' : 'gap-3 px-3.5'} py-2.5 rounded-xl transition-all font-semibold text-sm cursor-pointer ${
                      activeTab === 'Admin' 
                        ? 'bg-[#0071E3] text-white shadow-xs' 
                        : 'text-[#1D1D1F] dark:text-[#F5F5F7] hover:bg-black/5 dark:hover:bg-white/5 font-medium'
                    }`}
                    title={isSidebarCollapsed ? "Administración" : undefined}
                  >
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${activeTab === 'Admin' ? 'bg-white/20 text-white' : 'bg-[#5856D6]/15 text-[#5856D6]'}`}>
                      <Users className="w-4 h-4" />
                    </div>
                    {!isSidebarCollapsed && <span className="truncate">Administración</span>}
                  </button>
                  <button 
                    onClick={() => setActiveTab('Notifications')}
                    className={`w-full flex items-center ${isSidebarCollapsed ? 'justify-center px-2.5' : 'gap-3 px-3.5'} py-2.5 rounded-xl transition-all font-semibold text-sm cursor-pointer ${
                      activeTab === 'Notifications' 
                        ? 'bg-[#0071E3] text-white shadow-xs' 
                        : 'text-[#1D1D1F] dark:text-[#F5F5F7] hover:bg-black/5 dark:hover:bg-white/5 font-medium'
                    }`}
                    title={isSidebarCollapsed ? "Notificaciones" : undefined}
                  >
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${activeTab === 'Notifications' ? 'bg-white/20 text-white' : 'bg-[#FF9500]/15 text-[#FF9500]'}`}>
                      <Bell className="w-4 h-4" />
                    </div>
                    {!isSidebarCollapsed && (
                      <div className="flex items-center justify-between flex-1 min-w-0">
                        <span className="truncate">Notificaciones</span>
                        {unreadCount > 0 && (
                          <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-[#FF3B30] text-white">
                            {unreadCount}
                          </span>
                        )}
                      </div>
                    )}
                  </button>
                  <button 
                    onClick={() => setActiveTab('PDFConfig')}
                    className={`w-full flex items-center ${isSidebarCollapsed ? 'justify-center px-2.5' : 'gap-3 px-3.5'} py-2.5 rounded-xl transition-all font-semibold text-sm cursor-pointer ${
                      activeTab === 'PDFConfig' 
                        ? 'bg-[#0071E3] text-white shadow-xs' 
                        : 'text-[#1D1D1F] dark:text-[#F5F5F7] hover:bg-black/5 dark:hover:bg-white/5 font-medium'
                    }`}
                    title={isSidebarCollapsed ? "Configuración PDF" : undefined}
                  >
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${activeTab === 'PDFConfig' ? 'bg-white/20 text-white' : 'bg-[#FF2D55]/15 text-[#FF2D55]'}`}>
                      <Shield className="w-4 h-4" />
                    </div>
                    {!isSidebarCollapsed && <span className="truncate">Configuración PDF</span>}
                  </button>
                </>
              )}
              <button 
                onClick={() => setActiveTab('Help')}
                className={`w-full flex items-center ${isSidebarCollapsed ? 'justify-center px-2.5' : 'gap-3 px-3.5'} py-2.5 rounded-xl transition-all font-semibold text-sm cursor-pointer ${
                  activeTab === 'Help' 
                    ? 'bg-[#0071E3] text-white shadow-xs' 
                    : 'text-[#1D1D1F] dark:text-[#F5F5F7] hover:bg-black/5 dark:hover:bg-white/5 font-medium'
                }`}
                title={isSidebarCollapsed ? "Ayuda" : undefined}
              >
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${activeTab === 'Help' ? 'bg-white/20 text-white' : 'bg-[#0071E3]/12 text-[#0071E3] dark:text-[#0A84FF]'}`}>
                  <HelpCircle className="w-4 h-4" />
                </div>
                {!isSidebarCollapsed && <span className="truncate">Ayuda / Instructivo</span>}
              </button>
            </div>

            <div className="mt-auto pt-3 border-t border-[#D2D2D7]/30 dark:border-white/5 space-y-1.5">
              {isSidebarCollapsed && (
                <button
                  onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
                  className="w-full flex items-center justify-center p-2.5 hover:bg-black/5 dark:hover:bg-white/5 rounded-xl text-[#6E6E73] dark:text-[#98989D] transition-colors"
                  title={theme === 'light' ? 'Activar modo oscuro' : 'Activar modo claro'}
                >
                  {theme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
                </button>
              )}
              <button 
                onClick={async () => {
                  if (window.confirm('¿Deseas borrar toda la memoria caché local? Se recargará la aplicación.')) {
                    await clearAllCaches();
                    window.location.reload();
                  }
                }}
                className={`w-full flex items-center ${isSidebarCollapsed ? 'justify-center px-2.5' : 'gap-2.5 px-3'} py-2 rounded-xl text-[#6E6E73] dark:text-[#98989D] hover:text-[#1D1D1F] dark:hover:text-[#F5F5F7] hover:bg-black/5 dark:hover:bg-white/5 transition-all text-xs font-medium cursor-pointer`}
                title={isSidebarCollapsed ? "Limpiar Caché Local" : undefined}
              >
                <RefreshCw className="w-3.5 h-3.5 shrink-0" />
                {!isSidebarCollapsed && <span>Limpiar Caché</span>}
              </button>
              <button 
                onClick={handleSignOut}
                className={`w-full flex items-center ${isSidebarCollapsed ? 'justify-center px-2.5' : 'gap-2.5 px-3'} py-2 rounded-xl text-[#FF3B30] hover:bg-[#FF3B30]/10 transition-all text-xs font-semibold cursor-pointer`}
                title={isSidebarCollapsed ? "Cerrar Sesión" : undefined}
              >
                <LogOut className="w-3.5 h-3.5 shrink-0" />
                {!isSidebarCollapsed && <span>Cerrar Sesión</span>}
              </button>
              {!isSidebarCollapsed && (
                <div className="text-center pt-1">
                  <p className="text-[10px] text-[#8E8E93] dark:text-[#636366]">Chekify Industrial · v2.5</p>
                </div>
              )}
            </div>
          </aside>

          {/* Main Content Area */}
          <div className="flex-1 flex flex-col min-w-0">
            {/* Header (Apple HIG Translucent Sticky Header) */}
            <header className="bg-[#F5F5F7]/85 dark:bg-black/80 ios-glass border-b border-[#D2D2D7]/30 dark:border-white/5 px-3.5 sm:px-6 md:px-8 py-2.5 sm:py-3 sticky top-0 z-40 transition-colors duration-200">
              <div className="max-w-7xl mx-auto flex flex-col gap-2 sm:gap-2.5">
                <div className="flex items-center justify-between gap-2 sm:gap-4 min-w-0">
                  {/* Mobile Identity / Avatar Photo */}
                  <div className="flex items-center gap-2 md:hidden shrink-0">
                    <Logo className="h-7 sm:h-8 shrink-0" />
                    <button 
                      onClick={() => setShowProfileModal(true)}
                      className="cursor-pointer p-0.5 rounded-full ring-2 ring-[#0071E3]/30 hover:ring-[#0071E3]/80 shrink-0 ml-0.5 transition-all"
                      title={`Perfil: ${user.name || user.email}`}
                    >
                      <div className="w-8 h-8 rounded-full bg-[#0071E3] text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-xs overflow-hidden border border-white/20">
                        {user.avatarUrl ? (
                          <img src={user.avatarUrl} alt={user.name} className="w-full h-full object-cover" />
                        ) : (
                          user.name?.charAt(0) || user.email.charAt(0)
                        )}
                      </div>
                    </button>
                  </div>

                  {/* Active View Title & Date/Time (Desktop) */}
                  <div className="hidden md:flex flex-col min-w-0 flex-1 pr-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <h1 className="text-[#1D1D1F] dark:text-[#F5F5F7] font-bold text-base lg:text-lg leading-tight transition-colors truncate tracking-tight">
                        {activeTab === 'Home' ? `¡Bienvenido, ${user.name?.split(' ')[0] || user.name || 'Usuario'}!` : activeTab === 'OrdenLimpieza' ? 'Orden & Limpieza' : activeTab === 'History' ? 'Historial de Inspecciones' : activeTab === 'Admin' ? 'Administración' : activeTab === 'Notifications' ? 'Notificaciones' : activeTab === 'PDFConfig' ? 'Configuración PDF' : 'Ayuda / Instructivo'}
                      </h1>
                      {isOffline && (
                        <span className="flex items-center gap-1 px-2 py-0.5 bg-[#FF9500]/10 border border-[#FF9500]/20 text-[#C96800] dark:text-[#FF9F0A] text-[9px] font-semibold rounded-full shrink-0">
                          <AlertCircle className="w-2.5 h-2.5" />
                          Sin conexión
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-[#6E6E73] dark:text-[#98989D] font-medium truncate mt-0.5">
                      <LiveClock formatString="EEEE, dd 'de' MMMM • HH:mm:ss" />
                    </p>
                  </div>

                  {/* Header Actions & Weather Summary Pill */}
                  <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                    {/* View Switcher for Admins & Supervisors - Apple HIG Segmented Control (Desktop Only) */}
                    {(user.role === 'Administrador' || user.role === 'Supervisor') && (
                      <div className="hidden md:flex items-center bg-[#E5E5EA]/70 dark:bg-[#2C2C2E]/70 p-1 rounded-xl shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            setActiveRoleView('Operador');
                            if (typeof window !== 'undefined') localStorage.setItem('chekify_active_role_view', 'Operador');
                          }}
                          className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                            effectiveRole === 'Operador'
                              ? 'bg-white dark:bg-[#1C1C1E] text-[#1D1D1F] dark:text-[#F5F5F7] shadow-xs'
                              : 'text-[#6E6E73] dark:text-[#98989D] hover:text-[#1D1D1F] dark:hover:text-[#F5F5F7]'
                          }`}
                          title="Cambiar a Vista de Operador Mantenedor (Inspecciones de Terreno)"
                        >
                          <HardHat className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">Operador</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setActiveRoleView(user.role);
                            if (typeof window !== 'undefined') localStorage.setItem('chekify_active_role_view', user.role);
                          }}
                          className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                            effectiveRole !== 'Operador'
                              ? 'bg-white dark:bg-[#1C1C1E] text-[#1D1D1F] dark:text-[#F5F5F7] shadow-xs'
                              : 'text-[#6E6E73] dark:text-[#98989D] hover:text-[#1D1D1F] dark:hover:text-[#F5F5F7]'
                          }`}
                          title={`Cambiar a Vista de ${user.role}`}
                        >
                          <Briefcase className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">{user.role}</span>
                        </button>
                      </div>
                    )}

                    {/* Compact Weather Summary Pill in Header */}
                    <button
                      onClick={() => setIsWeatherExpanded(true)}
                      className="flex items-center gap-1.5 px-2 sm:px-2.5 py-1.5 rounded-xl bg-white dark:bg-[#1C1C1E] border border-[#D2D2D7]/40 dark:border-white/10 text-xs font-medium transition-all shadow-xs shrink-0 cursor-pointer hover:bg-[#F2F2F7] dark:hover:bg-[#2C2C2E] active:scale-98"
                      title="Ver condiciones meteorológicas detalladas"
                    >
                      {loadingWeather ? (
                        <div className="flex items-center gap-1 text-[#0071E3] dark:text-[#0A84FF]">
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span className="hidden sm:inline text-[11px]">Clima...</span>
                        </div>
                      ) : weatherError || !weather ? (
                        <div className="flex items-center gap-1 text-[#FF9500]">
                          <CloudOff className="w-3.5 h-3.5" />
                          <span className="text-[11px]">N/A</span>
                        </div>
                      ) : (
                        <>
                          <CloudSun className="w-3.5 h-3.5 text-[#0071E3] dark:text-[#0A84FF] shrink-0" />
                          <div className="flex items-center gap-1 text-xs font-semibold">
                            <span className="text-[#1D1D1F] dark:text-[#F5F5F7] tabular-nums">{weather.temperature}</span>
                            <span className="text-[#8E8E93] hidden sm:inline">·</span>
                            <span className="text-[#6E6E73] dark:text-[#98989D] hidden sm:inline text-[11px]">Hum {weather.humidity}</span>
                            {weather.uvIndex !== undefined && (
                              <>
                                <span className="text-[#8E8E93] hidden md:inline">·</span>
                                <span className="text-[#FF9500] font-bold hidden md:inline text-[11px]">UV {weather.uvIndex}</span>
                              </>
                            )}
                          </div>
                        </>
                      )}
                    </button>

                    <div className="h-4 w-px bg-[#D2D2D7]/50 dark:bg-white/10 hidden sm:block mx-0.5" />

                    {/* Theme Toggle (Hidden on extra small mobile, accessible in mobile drawer) */}
                    <button
                      onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
                      className="hidden sm:flex text-[#6E6E73] dark:text-[#98989D] hover:text-[#1D1D1F] dark:hover:text-[#F5F5F7] transition-colors p-2 rounded-xl bg-white dark:bg-[#1C1C1E] border border-[#D2D2D7]/40 dark:border-white/10 shrink-0 items-center justify-center w-8 h-8 sm:w-9 sm:h-9 cursor-pointer shadow-xs"
                      title={theme === 'light' ? 'Activar modo oscuro' : 'Activar modo claro'}
                    >
                      {theme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
                    </button>

                    {/* Notification Center Trigger */}
                    <button 
                      onClick={() => setShowNotificationCenter(true)}
                      className="relative text-[#6E6E73] dark:text-[#98989D] hover:text-[#1D1D1F] dark:hover:text-[#F5F5F7] transition-colors p-2 rounded-xl bg-white dark:bg-[#1C1C1E] border border-[#D2D2D7]/40 dark:border-white/10 shrink-0 flex items-center justify-center w-8 h-8 sm:w-9 sm:h-9 cursor-pointer shadow-xs"
                      title="Notificaciones"
                    >
                      <Bell className="w-4 h-4" />
                      {unreadCount > 0 && (
                        <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-[#FF3B30] text-white text-[9px] font-bold flex items-center justify-center leading-none">
                          {unreadCount}
                        </span>
                      )}
                    </button>

                    {/* Mobile Menu Button with Indicator */}
                    <button 
                      onClick={() => setIsMobileMoreOpen(true)}
                      className="md:hidden text-[#6E6E73] dark:text-[#98989D] hover:text-[#1D1D1F] dark:hover:text-[#F5F5F7] transition-colors p-2 rounded-xl bg-white dark:bg-[#1C1C1E] border border-[#D2D2D7]/40 dark:border-white/10 shrink-0 flex items-center justify-center w-8 h-8 sm:w-9 sm:h-9 cursor-pointer shadow-xs relative"
                      title="Menú Móvil"
                    >
                      <Menu className="w-4 h-4" />
                      {unreadCount > 0 && (
                        <span className="absolute -top-1 -right-1 min-w-[14px] h-3.5 px-0.5 rounded-full bg-[#FF3B30] text-white text-[8px] font-bold flex items-center justify-center leading-none">
                          {unreadCount}
                        </span>
                      )}
                    </button>

                    {/* Logout Button (Desktop only in header, mobile has it in drawer) */}
                    <button 
                      onClick={handleSignOut}
                      className="hidden md:flex text-[#FF3B30] hover:bg-[#FF3B30]/10 transition-colors p-2 rounded-xl bg-white dark:bg-[#1C1C1E] border border-[#D2D2D7]/40 dark:border-white/10 shrink-0 items-center justify-center w-8 h-8 sm:w-9 sm:h-9 cursor-pointer shadow-xs"
                      title="Cerrar Sesión"
                    >
                      <LogOut className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Mobile Sub-Header: Active Module Title & Time Bar */}
                <div className="md:hidden flex items-center justify-between pt-1.5 border-t border-[#D2D2D7]/30 dark:border-white/5 min-w-0">
                  <div className="flex items-center gap-1.5 min-w-0 flex-1 pr-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#0071E3] shrink-0" />
                    <h1 className="text-[#1D1D1F] dark:text-[#F5F5F7] font-bold text-xs tracking-tight truncate">
                      {activeTab === 'Home' ? (effectiveRole === 'Operador' ? 'Inspección Terreno' : 'Panel Supervisión') : activeTab === 'OrdenLimpieza' ? 'Orden & Limpieza' : activeTab === 'History' ? 'Historial' : activeTab === 'Admin' ? 'Administración' : activeTab === 'Notifications' ? 'Notificaciones' : activeTab === 'PDFConfig' ? 'Configuración PDF' : 'Ayuda'}
                    </h1>
                    {isOffline && (
                      <span className="px-1.5 py-0.2 bg-red-50 dark:bg-red-500/10 border border-red-100 dark:border-red-500/20 text-red-600 dark:text-red-400 text-[8px] font-black uppercase rounded-full shrink-0">
                        Offline
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] text-zinc-400 dark:text-zinc-500 font-bold shrink-0 ml-1.5 tabular-nums">
                    <LiveClock formatString="HH:mm:ss" />
                  </span>
                </div>
              </div>
            </header>

            {/* Content Body */}
            <main className="flex-1 p-3 sm:p-6 md:p-8 max-w-7xl mx-auto w-full pb-20 sm:pb-24 md:pb-8 transition-all duration-300 dark:text-white">
              <NotificationCenter 
                show={showNotificationCenter}
                onClose={() => setShowNotificationCenter(false)}
                notifications={notifications}
                onDismiss={handleDismissNotification}
                onRead={handleMarkAsRead}
                onAction={handleNotificationAction}
                readIds={user.readNotifications || []}
                user={user}
              />
              <AnimatePresence mode="wait">
                {activeTab === 'Home' && (
                  <motion.div 
                    key="home"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                  >
                    {effectiveRole === 'Operador' ? (
                      <OperatorDashboard 
                        user={user} 
                        setActiveTab={setActiveTab} 
                        weather={weather}
                        loadingWeather={loadingWeather}
                        weatherError={weatherError}
                        plant={plants.find(p => p.id === user.plantId) || plants[0] || null}
                      />
                    ) : (
                      <SupervisorDashboard 
                        user={user} 
                        initialFindingId={pendingFindingId} 
                        onClearPending={() => setPendingFindingId(null)}
                        onStartOperatorInspection={() => {
                          setActiveRoleView('Operador');
                          if (typeof window !== 'undefined') localStorage.setItem('chekify_active_role_view', 'Operador');
                        }}
                      />
                    )}
                  </motion.div>
                )}
                {activeTab === 'OrdenLimpieza' && (
                  <motion.div 
                    key="orden-limpieza"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                  >
                    <OrdenYLimpiezaDashboard user={effectiveRoleUser} initialFindingId={pendingFindingId} onClearPending={() => setPendingFindingId(null)} />
                  </motion.div>
                )}
                {activeTab === 'History' && (
                  <motion.div 
                    key="history"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                  >
                    <ReportsView user={effectiveRoleUser} initialFindingId={pendingFindingId} onClearPending={() => setPendingFindingId(null)} />
                  </motion.div>
                )}
                {activeTab === 'Admin' && (
                  <motion.div 
                    key="admin"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                  >
                    <AdminManagement plants={plants} />
                  </motion.div>
                )}
                {activeTab === 'Notifications' && (
                  <motion.div 
                    key="admin-notifications"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                  >
                    <AdminNotificationManagement plants={plants} />
                  </motion.div>
                )}
                {activeTab === 'PDFConfig' && (
                  <motion.div 
                    key="admin-pdf-config"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                  >
                    <AdminReportSettings />
                  </motion.div>
                )}
                {activeTab === 'Help' && (
                  <motion.div 
                    key="help"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                  >
                    <HelpView />
                  </motion.div>
                )}
              </AnimatePresence>
            </main>
            <SyncStatusTray />

            {/* Mobile Navigation Bar (Apple HIG Translucent Tab Bar) */}
            <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white/85 dark:bg-[#1C1C1E]/85 ios-glass border-t border-[#D2D2D7]/40 dark:border-white/10 px-2 pt-1.5 pb-[max(env(safe-area-inset-bottom,0.5rem),0.5rem)] z-40 shadow-sm transition-all duration-200">
              <div className="flex items-center justify-around max-w-md mx-auto">
                {/* 1. Home VOSO */}
                <button 
                  onClick={() => { setActiveTab('Home'); setIsMobileMoreOpen(false); }}
                  className={`flex-1 py-1 px-1 rounded-xl flex flex-col items-center justify-center gap-1 transition-all cursor-pointer active:scale-95 ${
                    activeTab === 'Home' 
                      ? 'text-[#0071E3] dark:text-[#0A84FF]' 
                      : 'text-[#8E8E93] hover:text-[#1D1D1F] dark:hover:text-[#F5F5F7]'
                  }`}
                >
                  <div className={`p-1 rounded-xl transition-colors ${activeTab === 'Home' ? 'bg-[#0071E3]/12' : ''}`}>
                    <LayoutDashboard className="w-5 h-5 shrink-0 stroke-[2.2]" />
                  </div>
                  <span className="text-[10px] font-semibold tracking-tight leading-none">VOSO</span>
                </button>

                {/* 2. Orden & Limpieza */}
                <button 
                  onClick={() => { setActiveTab('OrdenLimpieza'); setIsMobileMoreOpen(false); }}
                  className={`flex-1 py-1 px-1 rounded-xl flex flex-col items-center justify-center gap-1 transition-all cursor-pointer active:scale-95 ${
                    activeTab === 'OrdenLimpieza' 
                      ? 'text-[#AF52DE] dark:text-[#BF5AF2]' 
                      : 'text-[#8E8E93] hover:text-[#1D1D1F] dark:hover:text-[#F5F5F7]'
                  }`}
                >
                  <div className={`p-1 rounded-xl transition-colors ${activeTab === 'OrdenLimpieza' ? 'bg-[#AF52DE]/12' : ''}`}>
                    <Sparkles className="w-5 h-5 shrink-0 stroke-[2.2]" />
                  </div>
                  <span className="text-[10px] font-semibold tracking-tight leading-none">5S Limp.</span>
                </button>

                {/* 3. Historial */}
                <button 
                  onClick={() => { setActiveTab('History'); setIsMobileMoreOpen(false); }}
                  className={`flex-1 py-1 px-1 rounded-xl flex flex-col items-center justify-center gap-1 transition-all cursor-pointer active:scale-95 ${
                    activeTab === 'History' 
                      ? 'text-[#34C759] dark:text-[#30D158]' 
                      : 'text-[#8E8E93] hover:text-[#1D1D1F] dark:hover:text-[#F5F5F7]'
                  }`}
                >
                  <div className={`p-1 rounded-xl transition-colors ${activeTab === 'History' ? 'bg-[#34C759]/12' : ''}`}>
                    <History className="w-5 h-5 shrink-0 stroke-[2.2]" />
                  </div>
                  <span className="text-[10px] font-semibold tracking-tight leading-none">Historial</span>
                </button>

                {/* 4. Notificaciones */}
                <button 
                  onClick={() => { setShowNotificationCenter(true); setIsMobileMoreOpen(false); }}
                  className="flex-1 py-1 px-1 rounded-xl flex flex-col items-center justify-center gap-1 transition-all cursor-pointer active:scale-95 text-[#8E8E93] hover:text-[#1D1D1F] dark:hover:text-[#F5F5F7] relative"
                  title="Notificaciones"
                >
                  <div className="p-1 rounded-xl relative">
                    <Bell className="w-5 h-5 shrink-0 stroke-[2.2]" />
                    {unreadCount > 0 && (
                      <span className="absolute -top-0.5 -right-0.5 min-w-[14px] h-3.5 px-0.5 rounded-full bg-[#FF3B30] text-white text-[8px] font-bold flex items-center justify-center leading-none">
                        {unreadCount}
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] font-semibold tracking-tight leading-none">Alertas</span>
                </button>

                {/* 5. Menú Móvil (Para todos los roles) */}
                <button 
                  onClick={() => setIsMobileMoreOpen(!isMobileMoreOpen)}
                  className={`flex-1 py-1 px-1 rounded-xl flex flex-col items-center justify-center gap-1 transition-all cursor-pointer active:scale-95 relative ${
                    ['Admin', 'Notifications', 'PDFConfig', 'Help'].includes(activeTab) || isMobileMoreOpen
                      ? 'text-[#0071E3] dark:text-[#0A84FF]' 
                      : 'text-[#8E8E93] hover:text-[#1D1D1F] dark:hover:text-[#F5F5F7]'
                  }`}
                >
                  <div className={`p-1 rounded-xl relative transition-colors ${(['Admin', 'Notifications', 'PDFConfig', 'Help'].includes(activeTab) || isMobileMoreOpen) ? 'bg-[#0071E3]/12' : ''}`}>
                    <Menu className="w-5 h-5 shrink-0 stroke-[2.2]" />
                  </div>
                  <span className="text-[10px] font-semibold tracking-tight leading-none">Menú</span>
                </button>
              </div>
            </nav>

            {/* Mobile Slide-Up Sheet: Navigation & Role Switcher */}
            <AnimatePresence>
              {isMobileMoreOpen && (
                <div className="fixed inset-0 z-50 md:hidden flex flex-col justify-end">
                  {/* Backdrop */}
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={() => setIsMobileMoreOpen(false)}
                    className="fixed inset-0 bg-black/60 backdrop-blur-xs"
                  />

                  {/* Sheet */}
                  <motion.div 
                    initial={{ y: "100%" }}
                    animate={{ y: 0 }}
                    exit={{ y: "100%" }}
                    transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                    className="relative bg-white dark:bg-zinc-950 border-t border-zinc-200 dark:border-zinc-800 rounded-t-3xl p-5 shadow-2xl z-10 space-y-4 max-h-[85vh] overflow-y-auto"
                  >
                    {/* Drawer Header */}
                    <div className="flex items-center justify-between pb-3 border-b border-zinc-100 dark:border-zinc-900">
                      <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-full bg-[#0071E3] text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-xs overflow-hidden border border-white/20">
                          {user.avatarUrl ? (
                            <img src={user.avatarUrl} alt={user.name} className="w-full h-full object-cover" />
                          ) : (
                            user.name?.charAt(0) || user.email.charAt(0)
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-black text-sm uppercase tracking-tight text-zinc-900 dark:text-white truncate max-w-[170px]">
                              {user.name || 'Usuario'}
                            </h3>
                            <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20">
                              {user.role}
                            </span>
                          </div>
                          <p className="text-[10px] text-zinc-400 font-semibold truncate max-w-[200px]">
                            {user.email} • {plants.find(p => p.id === user.plantId)?.name || 'Planta General'}
                          </p>
                        </div>
                      </div>
                      <button 
                        onClick={() => setIsMobileMoreOpen(false)}
                        className="p-2 rounded-full bg-zinc-100 dark:bg-zinc-900 text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors cursor-pointer"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Mode Switcher for Admins & Supervisors in Mobile Menu */}
                    {(user.role === 'Administrador' || user.role === 'Supervisor') && (
                      <div className="p-3.5 bg-gradient-to-r from-sky-500/10 via-indigo-500/10 to-sky-500/10 border border-sky-500/20 dark:border-sky-500/30 rounded-2xl space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-black uppercase tracking-wider text-sky-700 dark:text-sky-300 flex items-center gap-1.5">
                            <Sparkles className="w-3.5 h-3.5 text-sky-500" />
                            Modo de Vista (Rol Activo)
                          </span>
                          <span className="text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-700 dark:text-sky-300">
                            Activo: {effectiveRole}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 bg-white/90 dark:bg-zinc-900/90 p-1 rounded-xl border border-zinc-200/80 dark:border-white/10">
                          <button
                            type="button"
                            onClick={() => {
                              setActiveRoleView('Operador');
                              if (typeof window !== 'undefined') localStorage.setItem('chekify_active_role_view', 'Operador');
                              setIsMobileMoreOpen(false);
                            }}
                            className={`py-2.5 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                              effectiveRole === 'Operador'
                                ? 'bg-[#0071E3] text-white shadow-sm'
                                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                            }`}
                          >
                            <HardHat className="w-4 h-4 shrink-0" />
                            <span>Operador</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setActiveRoleView(user.role);
                              if (typeof window !== 'undefined') localStorage.setItem('chekify_active_role_view', user.role);
                              setIsMobileMoreOpen(false);
                            }}
                            className={`py-2.5 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                              effectiveRole !== 'Operador'
                                ? 'bg-[#0071E3] text-white shadow-sm'
                                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                            }`}
                          >
                            <Briefcase className="w-4 h-4 shrink-0" />
                            <span>{user.role}</span>
                          </button>
                        </div>
                        <p className="text-[9.5px] text-zinc-500 dark:text-zinc-400 text-center font-medium leading-tight">
                          {effectiveRole === 'Operador'
                            ? 'Inspecciones en terreno, listas de verificación y escaneo QR'
                            : `Gestión y control de ${user.role}, reportes y estadísticas`}
                        </p>
                      </div>
                    )}

                    {/* Section 1: Módulos Principales de Inspección */}
                    <div className="space-y-1.5">
                      <p className="text-[10px] font-black uppercase tracking-wider text-zinc-400 dark:text-zinc-500 px-1">
                        Módulos de Inspección
                      </p>
                      <div className="grid grid-cols-2 gap-2">
                        {/* VOSO */}
                        <button 
                          onClick={() => { setActiveTab('Home'); setIsMobileMoreOpen(false); }}
                          className={`p-3 rounded-2xl border text-left flex flex-col gap-1.5 transition-all cursor-pointer ${
                            activeTab === 'Home'
                              ? 'bg-[#0071E3] text-white border-[#0071E3] shadow-md'
                              : 'bg-zinc-50 dark:bg-zinc-900/60 border-zinc-200/60 dark:border-white/5 text-zinc-800 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <LayoutDashboard className={`w-4 h-4 ${activeTab === 'Home' ? 'text-white' : 'text-[#0071E3]'}`} />
                            <p className="text-xs font-black uppercase tracking-tight">VOSO</p>
                          </div>
                          <p className={`text-[9px] font-medium leading-tight ${activeTab === 'Home' ? 'text-white/80' : 'text-zinc-500 dark:text-zinc-400'}`}>
                            Inspección en terreno
                          </p>
                        </button>

                        {/* 5S Orden y Limpieza */}
                        <button 
                          onClick={() => { setActiveTab('OrdenLimpieza'); setIsMobileMoreOpen(false); }}
                          className={`p-3 rounded-2xl border text-left flex flex-col gap-1.5 transition-all cursor-pointer ${
                            activeTab === 'OrdenLimpieza'
                              ? 'bg-purple-600 text-white border-purple-600 shadow-md'
                              : 'bg-zinc-50 dark:bg-zinc-900/60 border-zinc-200/60 dark:border-white/5 text-zinc-800 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <Sparkles className={`w-4 h-4 ${activeTab === 'OrdenLimpieza' ? 'text-white' : 'text-purple-500'}`} />
                            <p className="text-xs font-black uppercase tracking-tight">5S Limpieza</p>
                          </div>
                          <p className={`text-[9px] font-medium leading-tight ${activeTab === 'OrdenLimpieza' ? 'text-white/80' : 'text-zinc-500 dark:text-zinc-400'}`}>
                            Orden y limpieza
                          </p>
                        </button>

                        {/* Historial */}
                        <button 
                          onClick={() => { setActiveTab('History'); setIsMobileMoreOpen(false); }}
                          className={`p-3 rounded-2xl border text-left flex flex-col gap-1.5 transition-all cursor-pointer ${
                            activeTab === 'History'
                              ? 'bg-emerald-600 text-white border-emerald-600 shadow-md'
                              : 'bg-zinc-50 dark:bg-zinc-900/60 border-zinc-200/60 dark:border-white/5 text-zinc-800 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <History className={`w-4 h-4 ${activeTab === 'History' ? 'text-white' : 'text-emerald-500'}`} />
                            <p className="text-xs font-black uppercase tracking-tight">Historial</p>
                          </div>
                          <p className={`text-[9px] font-medium leading-tight ${activeTab === 'History' ? 'text-white/80' : 'text-zinc-500 dark:text-zinc-400'}`}>
                            Registros y reportes
                          </p>
                        </button>

                        {/* Notificaciones */}
                        <button 
                          onClick={() => { setShowNotificationCenter(true); setIsMobileMoreOpen(false); }}
                          className="p-3 rounded-2xl border text-left flex flex-col gap-1.5 transition-all relative bg-zinc-50 dark:bg-zinc-900/60 border-zinc-200/60 dark:border-white/5 text-zinc-800 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Bell className="w-4 h-4 text-amber-500" />
                              <p className="text-xs font-black uppercase tracking-tight">Alertas</p>
                            </div>
                            {unreadCount > 0 && (
                              <span className="px-1.5 py-0.5 rounded-full bg-red-500 text-white text-[8px] font-black">
                                {unreadCount}
                              </span>
                            )}
                          </div>
                          <p className="text-[9px] text-zinc-500 dark:text-zinc-400 font-medium leading-tight">
                            Bandeja de avisos
                          </p>
                        </button>
                      </div>
                    </div>

                    {/* Section 2: Administración y Ajustes (Si es Admin o Supervisor) */}
                    {(user.role === 'Administrador' || user.role === 'Supervisor') && (
                      <div className="space-y-1.5">
                        <p className="text-[10px] font-black uppercase tracking-wider text-zinc-400 dark:text-zinc-500 px-1">
                          Gestión y Configuración
                        </p>
                        <div className="grid grid-cols-2 gap-2">
                          {user.role === 'Administrador' && (
                            <button 
                              onClick={() => { setActiveTab('Admin'); setIsMobileMoreOpen(false); }}
                              className={`p-3 rounded-2xl border text-left flex flex-col gap-1.5 transition-all cursor-pointer ${
                                activeTab === 'Admin'
                                  ? 'bg-[#0071E3] text-white border-[#0071E3] shadow-md'
                                  : 'bg-zinc-50 dark:bg-zinc-900/60 border-zinc-200/60 dark:border-white/5 text-zinc-800 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                <Users className={`w-4 h-4 ${activeTab === 'Admin' ? 'text-white' : 'text-sky-500'}`} />
                                <p className="text-xs font-black uppercase tracking-tight">Administración</p>
                              </div>
                              <p className={`text-[9px] font-medium leading-tight ${activeTab === 'Admin' ? 'text-white/80' : 'text-zinc-500 dark:text-zinc-400'}`}>
                                Áreas QR, plantas y equipos
                              </p>
                            </button>
                          )}

                          {user.role === 'Administrador' && (
                            <button 
                              onClick={() => { setActiveTab('PDFConfig'); setIsMobileMoreOpen(false); }}
                              className={`p-3 rounded-2xl border text-left flex flex-col gap-1.5 transition-all cursor-pointer ${
                                activeTab === 'PDFConfig'
                                  ? 'bg-[#0071E3] text-white border-[#0071E3] shadow-md'
                                  : 'bg-zinc-50 dark:bg-zinc-900/60 border-zinc-200/60 dark:border-white/5 text-zinc-800 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                <Shield className={`w-4 h-4 ${activeTab === 'PDFConfig' ? 'text-white' : 'text-emerald-500'}`} />
                                <p className="text-xs font-black uppercase tracking-tight">Config. PDF</p>
                              </div>
                              <p className={`text-[9px] font-medium leading-tight ${activeTab === 'PDFConfig' ? 'text-white/80' : 'text-zinc-500 dark:text-zinc-400'}`}>
                                Encabezados de reportes
                              </p>
                            </button>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Section 3: Perfil y Ayuda */}
                    <div className="grid grid-cols-2 gap-2">
                      <button 
                        onClick={() => { setShowProfileModal(true); setIsMobileMoreOpen(false); }}
                        className="p-3 rounded-2xl border text-left flex flex-col gap-1.5 transition-all bg-sky-50/70 dark:bg-sky-500/10 border-sky-200/60 dark:border-sky-500/20 text-zinc-800 dark:text-zinc-200 hover:bg-sky-100 dark:hover:bg-sky-500/20 cursor-pointer"
                      >
                        <div className="flex items-center gap-2">
                          <UserCheck className="w-4 h-4 text-sky-500" />
                          <p className="text-xs font-black uppercase tracking-tight">Mi Perfil</p>
                        </div>
                        <p className="text-[9px] opacity-70 font-medium leading-tight">
                          Foto y credenciales
                        </p>
                      </button>

                      <button 
                        onClick={() => { setActiveTab('Help'); setIsMobileMoreOpen(false); }}
                        className={`p-3 rounded-2xl border text-left flex flex-col gap-1.5 transition-all cursor-pointer ${
                          activeTab === 'Help'
                            ? 'bg-[#0071E3] text-white border-[#0071E3] shadow-md'
                            : 'bg-zinc-50 dark:bg-zinc-900/60 border-zinc-200/60 dark:border-white/5 text-zinc-800 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <HelpCircle className={`w-4 h-4 ${activeTab === 'Help' ? 'text-white' : 'text-indigo-500'}`} />
                          <p className="text-xs font-black uppercase tracking-tight">Ayuda</p>
                        </div>
                        <p className={`text-[9px] font-medium leading-tight ${activeTab === 'Help' ? 'text-white/80' : 'text-zinc-500 dark:text-zinc-400'}`}>
                          Manuales e instructivos
                        </p>
                      </button>
                    </div>

                    <div className="pt-2 flex items-center gap-2">
                      <button 
                        onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
                        className="flex-1 py-3 px-4 rounded-xl bg-zinc-100 dark:bg-zinc-900 text-zinc-800 dark:text-zinc-200 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 border border-zinc-200/50 dark:border-white/5 cursor-pointer"
                      >
                        {theme === 'light' ? <Moon className="w-4 h-4 text-indigo-500" /> : <Sun className="w-4 h-4 text-amber-500" />}
                        <span>Modo {theme === 'light' ? 'Oscuro' : 'Claro'}</span>
                      </button>

                      <button 
                        onClick={handleSignOut}
                        className="flex-1 py-3 px-4 rounded-xl bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 border border-red-200/50 dark:border-red-500/20 cursor-pointer"
                      >
                        <LogOut className="w-4 h-4" />
                        <span>Salir</span>
                      </button>
                    </div>

                    <div className="text-center pt-1 pb-1">
                      <p className="text-[8px] font-bold text-zinc-400 uppercase tracking-[0.2em]">Developed by maisser.cl</p>
                    </div>
                  </motion.div>
                </div>
              )}
            </AnimatePresence>
            
            {/* PWA Install Banner */}
            <AnimatePresence>
              {showInstallBanner && (
                <motion.div 
                  initial={{ opacity: 0, y: 50, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 50, scale: 0.95 }}
                  transition={{ type: 'spring', damping: 25, stiffness: 350 }}
                  className="fixed bottom-24 md:bottom-6 left-4 right-4 md:left-auto md:right-6 md:w-96 bg-zinc-950/95 dark:bg-zinc-900/95 backdrop-blur-md border border-zinc-800 text-white rounded-2xl shadow-2xl p-4.5 z-50 flex flex-col gap-3.5"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-zinc-900 border border-zinc-800/80 flex items-center justify-center p-1.5 flex-shrink-0 shadow-xs overflow-hidden">
                        <img src="/logo_small.png?v=2" alt="CheKify Logo" className="w-full h-full object-contain" />
                      </div>
                      <div>
                        <h4 className="font-extrabold text-xs tracking-wider text-zinc-100 uppercase">Instalar CheKify</h4>
                        <p className="text-[11px] text-zinc-400 font-medium leading-normal mt-0.5">Accede directamente desde tu pantalla de inicio con soporte de conexión mejorado.</p>
                      </div>
                    </div>
                    <button 
                      onClick={handleDismissBanner}
                      className="text-zinc-500 hover:text-zinc-300 p-1 rounded-full hover:bg-zinc-900 transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <button
                    onClick={handleInstallClick}
                    className="w-full bg-white hover:bg-zinc-100 text-zinc-950 font-black text-[10px] uppercase tracking-wider py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 transition-colors duration-200 shadow-sm"
                  >
                    <Download className="w-4.5 h-4.5" />
                    Instalar Aplicación
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            {/* iOS PWA Instructions Modal */}
            <AnimatePresence>
              {showIOSInstructions && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-xs z-[100] flex items-center justify-center p-4">
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="bg-white dark:bg-zinc-950 border border-zinc-150 dark:border-zinc-800 rounded-3xl p-6 max-w-sm w-full shadow-2xl flex flex-col gap-4 text-zinc-900 dark:text-white"
                  >
                    <div className="flex justify-between items-start gap-2">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200/60 dark:border-zinc-800 flex items-center justify-center p-1.5 flex-shrink-0 shadow-xs overflow-hidden">
                          <img src="/logo_small.png?v=2" alt="CheKify Logo" className="w-full h-full object-contain" />
                        </div>
                        <div>
                          <h3 className="font-extrabold text-sm uppercase tracking-tight">Instalar en iOS</h3>
                          <p className="text-[10px] text-zinc-500 dark:text-zinc-400">Sigue estos sencillos pasos:</p>
                        </div>
                      </div>
                      <button 
                        onClick={() => setShowIOSInstructions(false)}
                        className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 p-1 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="space-y-3.5 my-1 text-xs">
                      <div className="flex items-start gap-3">
                        <div className="w-5.5 h-5.5 rounded-full bg-zinc-100 dark:bg-zinc-900 flex items-center justify-center font-bold text-[10px] flex-shrink-0 mt-0.5">
                          1
                        </div>
                        <p className="text-zinc-600 dark:text-zinc-300 leading-relaxed">
                          Abre la app usando el navegador <strong className="text-zinc-900 dark:text-white font-bold">Safari</strong>.
                        </p>
                      </div>
                      <div className="flex items-start gap-3">
                        <div className="w-5.5 h-5.5 rounded-full bg-zinc-100 dark:bg-zinc-900 flex items-center justify-center font-bold text-[10px] flex-shrink-0 mt-0.5">
                          2
                        </div>
                        <div className="text-zinc-600 dark:text-zinc-300 flex flex-col gap-1.5">
                          <span className="leading-relaxed">Presiona el botón de <strong className="text-zinc-900 dark:text-white font-bold">Compartir</strong> en la barra de Safari:</span>
                          <div className="flex items-center gap-1.5 bg-zinc-50 dark:bg-zinc-900/50 px-2.5 py-1.5 rounded-lg border border-zinc-100 dark:border-zinc-800 text-[10px] w-fit text-zinc-500 dark:text-zinc-400 font-bold">
                            <Share className="w-3.5 h-3.5 text-sky-500" />
                            <span>Compartir / Share</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-start gap-3">
                        <div className="w-5.5 h-5.5 rounded-full bg-zinc-100 dark:bg-zinc-900 flex items-center justify-center font-bold text-[10px] flex-shrink-0 mt-0.5">
                          3
                        </div>
                        <p className="text-zinc-600 dark:text-zinc-300 leading-relaxed">
                          Desplázate y pulsa <strong className="text-zinc-900 dark:text-white font-bold">"Añadir a pantalla de inicio"</strong>.
                        </p>
                      </div>
                    </div>

                    <button
                      onClick={() => setShowIOSInstructions(false)}
                      className="w-full bg-zinc-900 dark:bg-white text-white dark:text-zinc-950 hover:bg-zinc-800 dark:hover:bg-zinc-100 font-bold text-[10px] uppercase tracking-wider py-3 px-4 rounded-xl transition-colors duration-200"
                    >
                      Entendido
                    </button>
                  </motion.div>
                </div>
              )}
            </AnimatePresence>

            <UserProfileModal
              user={user}
              isOpen={showProfileModal}
              onClose={() => setShowProfileModal(false)}
              plants={plants}
            />

            {/* Global Centered Weather Detail Popup Modal (Full Front Overlay) */}
            <AnimatePresence>
              {isWeatherExpanded && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 md:p-6 overflow-y-auto">
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={() => setIsWeatherExpanded(false)}
                    className="fixed inset-0 bg-zinc-950/75 backdrop-blur-md"
                  />
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 15 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 15 }}
                    transition={{ duration: 0.2, ease: "easeOut" }}
                    className="relative w-full max-w-4xl my-auto z-10"
                  >
                    <WeatherModule plant={plants.find(p => p.id === user.plantId)} onClose={() => setIsWeatherExpanded(false)} />
                  </motion.div>
                </div>
              )}
            </AnimatePresence>

            <ToastContainer toasts={toasts} setToasts={setToasts} />
          </div>
    </div>
  );
};
