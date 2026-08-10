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
  UserCheck
} from 'lucide-react';

import { EquipmentService } from './services/EquipmentService';
import { FindingService } from './services/FindingService';
import { offlineQueueService } from './services/OfflineQueueService';
import { meteoredService, WeatherData } from './services/meteoredService';
import { WeatherModule } from './components/WeatherModule';
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
import { getCachedAreas, cacheAreas, getCachedEquipment, cacheEquipment } from './utils/offlineCache';

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

// Utility to compress images before saving to Firestore
const compressImage = (base64Str: string): Promise<string> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.src = base64Str;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const MAX_WIDTH = 800; // Reduced slightly for better optimization
      const MAX_HEIGHT = 800;
      let width = img.width;
      let height = img.height;

      if (width > height) {
        if (width > MAX_WIDTH) {
          height *= MAX_WIDTH / width;
          width = MAX_WIDTH;
        }
      } else {
        if (height > MAX_HEIGHT) {
          width *= MAX_HEIGHT / height;
          height = MAX_HEIGHT;
        }
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx?.drawImage(img, 0, 0, width, height);
      
      // Use webp for better compression if supported
      // Fallback to jpeg 0.7 if webp is not supported (handled by toDataURL internally)
      resolve(canvas.toDataURL('image/webp', 0.6)); // 0.6 quality for webp is usually excellent and very small
    };
    img.onerror = () => {
      resolve(base64Str); // Return original if compression fails
    };
  });
};

// Utility to validate image dimensions and compress
const validateAndCompressImage = (base64Str: string, minWidth = 300, minHeight = 300): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.src = base64Str;
    img.onload = async () => {
      if (img.width < minWidth || img.height < minHeight) {
        reject(new Error(`La imagen debe tener al menos ${minWidth}x${minHeight} píxeles de resolución (actual: ${img.width}x${img.height}px).`));
        return;
      }
      try {
        const compressed = await compressImage(base64Str);
        resolve(compressed);
      } catch (err) {
        resolve(base64Str); // Fallback
      }
    };
    img.onerror = () => {
      reject(new Error('El archivo seleccionado no es una imagen válida o está dañado.'));
    };
  });
};

import { Logo } from './components/Logo';
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
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [loginMode, setLoginMode] = useState<'Google' | 'Password'>('Password');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    let userUnsub: (() => void) | null = null;
    
    const authUnsub = onAuthStateChanged(auth, async (firebaseUser) => {
      if (userUnsub) {
        userUnsub();
        userUnsub = null;
      }

      if (firebaseUser) {
        // Initial quick set to avoid blank screen while document is being listened to
        setUser({
          uid: firebaseUser.uid,
          email: firebaseUser.email || '',
          name: firebaseUser.displayName || 'Usuario',
          role: firebaseUser.email === 'maisserk@gmail.com' ? 'Administrador' : 'Operador',
        });

        // Real-time listener for user document
        userUnsub = onSnapshot(doc(db, 'users', firebaseUser.uid), async (snapshot) => {
          if (snapshot.exists()) {
            const userData = snapshot.data() as AppUser;
            // Normalize legacy roles
            let normalizedRole = userData.role;
            if ((userData.role as string) === 'Admin') normalizedRole = 'Administrador';
            if ((userData.role as string) === 'Operator') normalizedRole = 'Operador';
            
            if (normalizedRole !== userData.role) {
              try {
                await updateDoc(doc(db, 'users', firebaseUser.uid), { role: normalizedRole });
              } catch (e) { console.warn("Failed to update role in DB:", e); }
              setUser({ ...userData, role: normalizedRole });
            } else {
              setUser(userData);
            }
          } else {
            // First time user, create doc
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
            } catch (e) { 
              console.warn("Failed to create user doc in DB:", e);
              // Fallback to minimal user if doc creation fails
              setUser(newUser);
            }
          }
          setLoading(false);
        }, (err) => {
          console.error("User doc listener error:", err);
          setLoading(false);
        });
      } else {
        setUser(null);
        setLoading(false);
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
        // This is often a benign race condition in iframes, we can just log it
        console.warn("Popup request was cancelled, likely a duplicate call or browser restriction.");
      } else if (error.code === 'auth/popup-closed-by-user') {
        setError("Inicio de sesión cancelado o bloqueado (Ventana emergente cerrada). Como estás en un entorno embebido (iframe), te recomendamos utilizar la sección de 'Acceso Rápido Demo' de abajo o iniciar sesión con tu usuario y contraseña tradicionales.");
      } else if (error.code === 'auth/popup-blocked') {
        setError("El navegador bloqueó la ventana emergente. Por favor, permite las ventanas emergentes para este sitio o utiliza el acceso rápido demo de abajo.");
      } else if (error.code === 'auth/network-request-failed') {
        setError("Error de red: No se pudo conectar con el servidor de autenticación. Revisa tu internet o desactiva bloqueadores de anuncios.");
      } else {
        setError("Error al iniciar sesión con Google. Intenta de nuevo o utiliza la sección de Acceso Rápido abajo.");
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoggingIn) return;
    setIsLoggingIn(true);
    setError('');
    try {
      // If user enters just a username, we append a dummy domain for Firebase Auth
      const loginEmail = email.includes('@') ? email : `${email}@chekify.local`;
      await signInWithEmailAndPassword(auth, loginEmail, password);
    } catch (err: any) {
      console.error("Password login failed", err);
      if (err.code === 'auth/network-request-failed') {
        setError("Error de red: No se pudo conectar con el servidor. Revisa tu conexión a internet o intenta desactivar bloqueadores de anuncios.");
      } else if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        setError("Usuario o contraseña incorrectos");
      } else if (err.code === 'auth/too-many-requests') {
        setError("Demasiados intentos fallidos. Tu cuenta ha sido bloqueada temporalmente. Intenta más tarde.");
      } else {
        setError("Error al iniciar sesión. Intenta de nuevo.");
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleDemoLogin = async (role: 'Administrador' | 'Supervisor' | 'Operador') => {
    if (isLoggingIn) return;
    setIsLoggingIn(true);
    setError('');
    
    let targetEmail = '';
    let targetName = '';
    let targetPlantId = 'plant_a';
    
    if (role === 'Administrador') {
      targetEmail = 'maisserk@gmail.com';
      targetName = 'Administrador Demo';
    } else if (role === 'Supervisor') {
      targetEmail = 'supervisor@chekify.local';
      targetName = 'Supervisor Demo';
    } else {
      targetEmail = 'operador@chekify.local';
      targetName = 'Operador Demo';
    }
    
    const demoPassword = 'password123';
    
    try {
      await signInWithEmailAndPassword(auth, targetEmail, demoPassword);
    } catch (err: any) {
      if (err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password') {
        try {
          console.log("Demo user not found, auto-registering:", targetEmail);
          const userCredential = await createUserWithEmailAndPassword(auth, targetEmail, demoPassword);
          await setDoc(doc(db, 'users', userCredential.user.uid), {
            uid: userCredential.user.uid,
            email: targetEmail,
            name: targetName,
            role: role,
            plantId: targetPlantId
          });
        } catch (regErr: any) {
          console.error("Auto-registration of demo user failed", regErr);
          setError(`No se pudo crear automáticamente el acceso rápido: ${regErr.message || regErr}`);
        }
      } else {
        console.error("Demo login error", err);
        setError(`Error en acceso rápido: ${err.message || err.code || err}`);
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950 transition-colors duration-200">
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="w-12 h-12 border-4 border-zinc-900 dark:border-zinc-100 border-t-transparent rounded-full"
        />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-zinc-50 dark:bg-zinc-950 p-6 transition-colors duration-200">
        <div className="max-w-md w-full bg-white dark:bg-zinc-900 rounded-3xl shadow-xl dark:shadow-none p-8 text-center border border-zinc-100 dark:border-zinc-800 transition-colors duration-200">
          <div className="flex justify-center mb-6">
            <Logo className="h-16" />
          </div>
          <p className="text-zinc-500 dark:text-zinc-400 mb-8 font-medium">Gestión avanzada de inspecciones industriales.</p>

          {/* Unified Error Message Display */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 dark:bg-red-950/30 border border-red-100 dark:border-red-900 text-red-650 dark:text-red-400 text-sm font-medium rounded-2xl text-left leading-relaxed">
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
                  className="w-full p-4 bg-zinc-50 dark:bg-zinc-800 border border-zinc-100 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 rounded-2xl outline-none focus:ring-2 focus:ring-brand-blue transition-all"
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
                    className="w-full p-4 bg-zinc-50 dark:bg-zinc-800 border border-zinc-100 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 rounded-2xl outline-none focus:ring-2 focus:ring-brand-blue transition-all pr-12"
                    placeholder="••••••••"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-650 transition-colors p-1"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>
              <button
                type="submit"
                disabled={isLoggingIn}
                className={`w-full py-4 px-6 bg-gradient-to-r from-brand-blue to-brand-green text-white rounded-2xl font-bold transition-all shadow-lg shadow-sky-100 dark:shadow-none flex items-center justify-center gap-3 ${isLoggingIn ? 'opacity-50 cursor-wait' : 'hover:opacity-90'}`}
              >
                {isLoggingIn && <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                {isLoggingIn ? "Iniciando sesión..." : "Entrar al Sistema"}
              </button>
              <button
                type="button"
                onClick={() => setLoginMode('Google')}
                className="w-full py-2 text-zinc-400 text-xs font-bold uppercase tracking-widest hover:text-zinc-900 transition-colors"
              >
                O usar Google
              </button>
            </form>
          ) : (
            <div className="space-y-4">
              <button
                disabled={isLoggingIn}
                onClick={handleGoogleLogin}
                className={`w-full py-4 px-6 bg-white dark:bg-zinc-800 border border-zinc-100 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 rounded-2xl font-semibold flex items-center justify-center gap-3 transition-all shadow-sm dark:shadow-none ${isLoggingIn ? 'opacity-50 cursor-wait' : 'hover:bg-zinc-50 dark:hover:bg-zinc-700'}`}
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
                className="w-full py-2 text-zinc-400 text-xs font-bold uppercase tracking-widest hover:text-zinc-900 transition-colors"
              >
                Volver a Usuario/Contraseña
              </button>
            </div>
          )}

          <div className="mt-8 pt-6 border-t border-zinc-150/40 dark:border-white/10">
            <p className="text-[10px] font-bold text-zinc-300 dark:text-zinc-650 uppercase tracking-widest">Developed by maisser.cl</p>
          </div>
        </div>
      </div>
    );
  }

  return <>{children(user)}</>;
};

const VOSOExecutionCategory = ({ 
  title, 
  icon: Icon, 
  items, 
  responses, 
  onUpdate,
  colorClass 
}: { 
  title: string, 
  icon: any, 
  items: VOSOItem[], 
  responses: Record<string, VOSOResponse>,
  onUpdate: (id: string, status: any, comment?: string, photo?: string | string[], solved?: boolean) => void,
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
                            capture="environment" 
                            className="hidden" 
                            id={`photo-${item.id}`}
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                if (itemPhotos.length >= 3) {
                                  alert("Límite alcanzado: máximo 3 fotos por hallazgo.");
                                  e.target.value = '';
                                  return;
                                }
                                const reader = new FileReader();
                                reader.onloadend = async () => {
                                  const base64 = reader.result as string;
                                  try {
                                    const compressed = await validateAndCompressImage(base64, 300, 300);
                                    const updated = [...itemPhotos, compressed].slice(0, 3);
                                    onUpdate(item.id, res.status, res.comment, updated, res.solvedByOperator);
                                    e.target.value = '';
                                  } catch (err: any) {
                                    console.error("Checklist image validation error:", err);
                                    alert(err.message || "Error al validar la imagen.");
                                    e.target.value = '';
                                  }
                                };
                                reader.readAsDataURL(file);
                              }
                            }}
                          />

                          <div className="flex flex-wrap items-center gap-3">
                            {itemPhotos.length < 3 && (
                              <button 
                                type="button"
                                onClick={() => document.getElementById(`photo-${item.id}`)?.click()}
                                className={`flex-1 min-w-[160px] py-3 rounded-2xl text-[10px] font-bold flex items-center justify-center gap-2 active:scale-[0.98] transition-all cursor-pointer ${
                                  isPhotoMissing 
                                    ? 'bg-red-600 dark:bg-red-500 text-white border-2 border-red-400 animate-pulse shadow-lg shadow-red-200 dark:shadow-none' 
                                    : 'bg-zinc-900 dark:bg-white text-white dark:text-black shadow-lg shadow-zinc-200 dark:shadow-none'
                                }`}
                              >
                                <Camera className="w-4 h-4" />
                                {itemPhotos.length === 0 ? '📷 CAPTURAR FOTO (OBLIGATORIO *)' : `AÑADIR OTRA FOTO (${itemPhotos.length}/3)`}
                              </button>
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
  weatherError = false
}: { 
  user: AppUser; 
  setActiveTab?: (tab: 'Home' | 'History' | 'Admin' | 'Notifications' | 'PDFConfig') => void;
  weather?: WeatherData | null;
  loadingWeather?: boolean;
  weatherError?: boolean;
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
  
  // Collapsible areas and inspection tracking
  const [expandedAreaIds, setExpandedAreaIds] = useState<Record<string, boolean>>({});
  const [todayInspections, setTodayInspections] = useState<any[]>([]);

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

    const isDone = todayInspections.some((insp: any) => {
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

  // Scroll back to the top of the view when the equipment index, selected area, or summary state changes
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [currentEquipmentIndex, selectedArea?.id, showEquipmentSummary]);

  const startAreaInspection = (area: Area, initialEquipIndex = 0) => {
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
    // Listen for areas
    const unsubAreas = onSnapshot(collection(db, 'areas'), (snapshot) => {
      let areaData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Area));
      if (user.role !== 'Administrador' && user.plantId) {
        areaData = areaData.filter(a => a.plantId === user.plantId);
      }
      setAreas(areaData);
      cacheAreas(areaData);
    }, (error) => {
      console.error("Error listening to areas:", error);
    });

    // Listen for equipment
    const unsubEquip = onSnapshot(collection(db, 'equipment'), (snapshot) => {
      const equipData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Equipment));
      setEquipment(equipData);
      cacheEquipment(equipData);
    }, (error) => {
      console.error("Error listening to equipment:", error);
    });

    // Listen for inspections
    const unsubInspections = onSnapshot(collection(db, 'inspections'), (snapshot) => {
      setTodayInspections(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      console.error("Error listening to inspections:", error);
    });

    // Listen for all findings in the user's plant to calculate KPIs using enterprise service layer
    if (!user.plantId) {
      return unsubAreas;
    }
    
    const unsubStats = FindingService.subscribeToFindings((plantFindings) => {
      setAllActiveFindings(plantFindings.filter(f => f.status !== 'Closed'));
      
      const closedFindings = plantFindings.filter(f => f.status === 'Closed' && f.closedAt && f.createdAt);
      
      let totalResolutionMs = 0;
      closedFindings.forEach(f => {
        const createdMs = f.createdAt.seconds ? f.createdAt.toDate().getTime() : new Date(f.createdAt).getTime();
        const closedMs = f.closedAt.seconds ? f.closedAt.toDate().getTime() : new Date(f.closedAt).getTime();
        const resolutionTime = closedMs - createdMs;
        totalResolutionMs += resolutionTime;
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
          const startMs = f.inspectionStartedAt.seconds ? f.inspectionStartedAt.toDate().getTime() : new Date(f.inspectionStartedAt).getTime();
          const compMs = f.inspectionCompletedAt.seconds ? f.inspectionCompletedAt.toDate().getTime() : new Date(f.inspectionCompletedAt).getTime();
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

    return () => {
      unsubAreas();
      unsubEquip();
      unsubInspections();
      unsubStats();
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
          const area = areas.find(a => a.id === decodedText || a.qrCode === decodedText);
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

  const handleNextEquipment = async () => {
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
    const currentData = {
      trad: { ...checkItemStates },
      voso: { ...vosoResponses },
      operatingStatus: currentOpStatus,
      timing: {
        startedAt: equipmentStartTime,
        completedAt: now
      }
    };
    
    const updatedRawResults = {
      ...inspectionResults,
      [currentEquipment.id]: currentData
    };

    const updatedResults = sanitizeForFirestore(updatedRawResults);

    if (currentEquipmentIndex < areaEquipment.length - 1) {
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
      // Finished all equipment
      setIsSaving(true);
      try {
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
          humidity: weather.humidity,
          windSpeed: weather.windSpeed,
          windDirection: weather.windDirection ?? 'N/A',
          precipitation: weather.precipitation,
          uvIndex: weather.uvIndex ?? 'N/A',
          symbol: weather.symbol ?? 'N/A',
          forecastDate: weather.forecastDate
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
          status: hasFindings ? 'With Findings' : 'Completed',
          results: updatedResults,
          clima: climaPayload
        };

        if (isOnline) {
          try {
            await setDoc(doc(db, 'inspections', inspectionId), inspectionPayload);
          } catch (err) {
            console.warn('[Inspections] Direct save failed, queuing offline:', err);
            await offlineQueueService.enqueue('inspections', inspectionId, inspectionPayload, 'create');
          }
        } else {
          await offlineQueueService.enqueue('inspections', inspectionId, inspectionPayload, 'create');
        }

        // Register findings in the 'findings' collection for each equipment that has issues
        for (const [equipId, resAny] of Object.entries(updatedResults)) {
          const res = resAny as { trad: any, voso: any, operatingStatus?: string, timing?: { startedAt: any, completedAt: any } };
          const equip = equipment.find(e => e.id === equipId);
          
          const equipStarted = res?.timing?.startedAt instanceof Date ? res.timing.startedAt : (res?.timing?.startedAt?.toDate ? res.timing.startedAt.toDate() : null);
          const equipCompleted = res?.timing?.completedAt instanceof Date ? res.timing.completedAt : (res?.timing?.completedAt?.toDate ? res.timing.completedAt.toDate() : null);
          const equipDuration = (equipStarted && equipCompleted) ? Math.round((equipCompleted.getTime() - equipStarted.getTime()) / 1000) : 0;

          const resTrad = res?.trad || {};
          const resVoso = res?.voso || {};

          const tradIssues = Object.entries(resTrad).filter(([_, s]) => s !== 'Bueno');
          const vosoIssues = (Object.entries(resVoso) as [string, VOSOResponse][]).filter(([_, v]) => v && (v.status === 'Observación' || v.status === 'Crítico'));

          const ordenList = equip?.inspeccionVOSO?.orden || [];
          const pureVosoIssues = vosoIssues.filter(([id]) => !ordenList.some(o => o.id === id));
          const pureOrdenIssues = vosoIssues.filter(([id]) => ordenList.some(o => o.id === id));

          // 1. Create VOSO Finding if pure VOSO or traditional issues exist
          if (pureVosoIssues.length > 0 || tradIssues.length > 0) {
            const opStatusLabel = res?.operatingStatus === 'Detenido' ? 'Detenido' : 'En Funcionamiento';
            let description = `Inspección VOSO en ${equip?.name || equipId}. Condición operativa: ${opStatusLabel}.\n\n`;
            
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

            const resultObj = await FindingService.createFinding({
              areaId: selectedArea!.id,
              areaName: selectedArea!.name,
              plantId: selectedArea!.plantId || user.plantId || 'default-plant',
              equipmentId: equipId,
              equipmentName: equip?.name || null,
              description: description,
              photoUrl: firstPhoto || undefined,
              photoUrls: allPhotos,
              status: pureVosoIssues.every(v => v[1]?.solvedByOperator) && tradIssues.length === 0 ? 'Closed' : 'Open',
              priority,
              date: new Date(),
              inspectionStartedAt: inspectionStartTime ? Timestamp.fromDate(inspectionStartTime) : Timestamp.now(),
              inspectionCompletedAt: Timestamp.fromDate(inspectionCompletedTime),
              inspectionDurationSeconds: totalDurationSeconds,
              equipmentStartedAt: equipStarted ? Timestamp.fromDate(equipStarted) : null,
              equipmentCompletedAt: equipCompleted ? Timestamp.fromDate(equipCompleted) : null,
              equipmentDurationSeconds: equipDuration,
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
                  action: 'Hallazgo autogenerado (Inspección VOSO)',
                  comment: 'Hallazgo detectado durante la inspección de ruta.'
                } as any
              ]
            }, firstPhoto);

            setLastSavedFindingForPdf(resultObj as unknown as Finding);

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
              plantId: selectedArea!.plantId || user.plantId || 'default-plant'
            };

            if (isOnline) {
              try {
                await setDoc(doc(db, 'notifications', notificationId), notificationPayload);
              } catch (err) {
                console.warn('Notification setDoc error:', err);
              }
            }
          }

          // 2. Create Orden y Limpieza Finding if Orden issues exist
          if (pureOrdenIssues.length > 0) {
            let ordenDesc = `[ORDEN] Programa 5S / Aseo en ${equip?.name || equipId}.\n\n`;
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

            const ordenResultObj = await FindingService.createFinding({
              areaId: selectedArea!.id,
              areaName: selectedArea!.name,
              plantId: selectedArea!.plantId || user.plantId || 'default-plant',
              equipmentId: equipId,
              equipmentName: equip?.name || null,
              description: ordenDesc,
              photoUrl: firstOrdenPhoto || undefined,
              photoUrls: ordenPhotos,
              status: pureOrdenIssues.every(v => v[1]?.solvedByOperator) ? 'Closed' : 'Open',
              priority: 'Media',
              date: new Date(),
              inspectionStartedAt: inspectionStartTime ? Timestamp.fromDate(inspectionStartTime) : Timestamp.now(),
              inspectionCompletedAt: Timestamp.fromDate(inspectionCompletedTime),
              inspectionDurationSeconds: totalDurationSeconds,
              equipmentStartedAt: equipStarted ? Timestamp.fromDate(equipStarted) : null,
              equipmentCompletedAt: equipCompleted ? Timestamp.fromDate(equipCompleted) : null,
              equipmentDurationSeconds: equipDuration,
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
                  action: 'Hallazgo autogenerado (Orden & Limpieza)',
                  comment: 'Desviación de 5S detectada durante la inspección.'
                } as any
              ]
            }, firstOrdenPhoto);

            if (pureVosoIssues.length === 0 && tradIssues.length === 0) {
              setLastSavedFindingForPdf(ordenResultObj as unknown as Finding);
            }
          }
        }

        resetInspectionState();

        setSuccessModalConfig({
          title: "¡Inspección Finalizada con Éxito!",
          message: "El hallazgo o la inspección fue finalizada con éxito. Se guardaron todos los cambios y se notificará al supervisor."
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
      humidity: weather.humidity,
      windSpeed: weather.windSpeed,
      windDirection: weather.windDirection ?? 'N/A',
      precipitation: weather.precipitation,
      uvIndex: weather.uvIndex ?? 'N/A',
      symbol: weather.symbol ?? 'N/A',
      forecastDate: weather.forecastDate
    } : null;

    const primaryPhoto = findingPhotos[0] || null;
    const findingData = {
      areaId: selectedArea.id,
      areaName: selectedArea.name,
      equipmentId: currentEquipment?.id || null,
      equipmentName: currentEquipment?.name || null,
      plantId: selectedArea.plantId || user.plantId || 'default-plant',
      operatorId: user.uid,
      operatorName: user.name || user.email || 'Operador',
      operatorPhotoUrl: user.avatarUrl || (user as any).photoURL || undefined,
      description: finalDescription,
      photoUrl: primaryPhoto || undefined,
      photoUrls: findingPhotos,
      source: isOrden ? 'OrdenYLimpieza' : 'VOSO',
      category: isOrden ? 'OrdenYLimpieza' : 'VOSO',
      status: isClosingImmediately ? 'Closed' : 'Open' as any,
      solution: isClosingImmediately ? immediateSolution : '',
      closedBy: isClosingImmediately ? user.uid : null,
      closedAt: isClosingImmediately ? new Date() : null,
      inspectionStartedAt: inspectionStartTime ? Timestamp.fromDate(inspectionStartTime) : Timestamp.now(),
      inspectionCompletedAt: Timestamp.now(),
      date: new Date(),
      clima: climaPayload,
      history: [
        {
          status: isClosingImmediately ? 'Closed' : 'Open' as any,
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
      setLastSavedFindingForPdf(resultObj as unknown as Finding);
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
      {/* Header Banner Card for Inspección Primaria */}
      <div className="bg-gradient-to-r from-sky-950 via-blue-900 to-zinc-950 p-5 sm:p-7 md:p-8 rounded-3xl md:rounded-[2.5rem] border border-sky-500/20 text-white shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-sky-500/10 rounded-full -mr-32 -mt-32 blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-5 sm:gap-6 min-w-0">
          <div className="space-y-2.5 min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-3 py-1 bg-sky-500/25 border border-sky-400/30 text-sky-200 rounded-full text-[10px] sm:text-xs font-black uppercase tracking-widest flex items-center gap-1.5 shrink-0">
                <ShieldCheck className="w-3.5 h-3.5 text-sky-300" />
                Módulo Inspección Primaria
              </span>
              <span className="px-2.5 py-1 bg-white/10 border border-white/10 text-white/90 rounded-full text-[10px] font-bold uppercase tracking-wider">
                {user.plantId || 'Planta General'}
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-black uppercase tracking-tight text-white leading-tight break-words">
              Inspección Primaria de Planta
            </h2>
            <p className="text-xs sm:text-sm md:text-base text-sky-100/90 font-medium max-w-2xl leading-relaxed">
              Transformando inspecciones en decisiones.
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center sm:justify-end gap-2.5 sm:gap-3 w-full lg:w-auto shrink-0 pt-3 lg:pt-0 border-t lg:border-t-0 border-sky-500/20">
            <button
              onClick={() => setShowQuickHelp(true)}
              className="px-3.5 py-3 bg-white/10 hover:bg-white/20 backdrop-blur-md rounded-2xl border border-white/20 text-white text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 transition-all active:scale-95 cursor-pointer whitespace-nowrap shadow-sm flex-1 sm:flex-initial"
            >
              <HelpCircle className="w-4 h-4 text-sky-300 shrink-0" />
              <span>Ayuda rápida</span>
            </button>
            {!selectedArea && !scanning && (
              <button
                onClick={startScanner}
                className="px-4 py-3 bg-sky-600 hover:bg-sky-500 text-white font-black text-xs uppercase tracking-wider rounded-2xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-sky-900/50 active:scale-95 cursor-pointer whitespace-nowrap flex-1 sm:flex-initial"
              >
                <QrCode className="w-4 h-4 shrink-0" />
                <span>Escanear QR</span>
              </button>
            )}
            <div className="px-3.5 py-2.5 bg-white/10 backdrop-blur-md rounded-2xl border border-white/10 text-center sm:text-right min-w-[120px] flex-1 sm:flex-initial">
              <p className="text-[9px] font-black uppercase text-sky-300 tracking-wider">Operador Activo</p>
              <p className="text-xs font-black text-white truncate max-w-[150px] mx-auto sm:ml-auto">{user.name}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Plant Stats for Operator */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2 sm:gap-3">
        <div className="bg-brand-blue text-white p-4 rounded-3xl shadow-lg shadow-sky-100 dark:shadow-none border border-sky-400/20">
          <p className="text-[10px] font-bold text-sky-100 uppercase tracking-widest mb-1">Cierre Prom.</p>
          <div className="flex items-baseline gap-1">
            <p className="text-xl font-bold">{plantStats.avgResolutionHours}</p>
            <span className="text-[10px] font-bold text-sky-200">hrs</span>
          </div>
        </div>
        <div className="bg-white dark:bg-black text-zinc-900 dark:text-white p-4 rounded-3xl border border-zinc-100 dark:border-white/20 flex flex-col justify-center shadow-sm dark:shadow-none">
          <p className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest mb-1">Área Prom.</p>
          <div className="flex items-baseline gap-1">
            <p className="text-xl font-bold text-zinc-900 dark:text-white">{Math.floor(plantStats.avgInspectionSeconds / 60)}m {plantStats.avgInspectionSeconds % 60}s</p>
          </div>
        </div>
        <div className="bg-white dark:bg-black text-zinc-900 dark:text-white p-4 rounded-3xl border border-zinc-100 dark:border-white/20 flex flex-col justify-center shadow-sm dark:shadow-none">
          <p className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest mb-1">Equipo Prom.</p>
          <div className="flex items-baseline gap-1">
            <p className="text-xl font-bold text-sky-600 dark:text-sky-400">{(plantStats as any).avgEquipSeconds}s</p>
          </div>
        </div>
        <div className="bg-white p-4 rounded-3xl shadow-sm dark:shadow-none border border-zinc-100 dark:bg-black dark:border-white/20 flex flex-col justify-center">
          <p className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest mb-1">Pendientes</p>
          <p className="text-xl font-bold text-zinc-900 dark:text-white">{plantStats.totalOpen}</p>
        </div>
        <div className="bg-white p-4 rounded-3xl shadow-sm dark:shadow-none border border-zinc-100 dark:bg-black dark:border-white/20 flex flex-col justify-center">
          <p className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest mb-1">En Revisión</p>
          <p className="text-xl font-bold text-orange-600 dark:text-orange-400">{plantStats.totalInReview}</p>
        </div>
        <div className="bg-white p-4 rounded-3xl shadow-sm dark:shadow-none border border-zinc-100 dark:bg-black dark:border-white/20 hidden sm:flex flex-col justify-center">
          <p className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest mb-1">Total Cerrados</p>
          <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400">{plantStats.totalClosed}</p>
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
                            <h3 className="font-extrabold text-zinc-900 dark:text-white text-sm sm:text-base tracking-tight truncate group-hover:text-sky-600 dark:group-hover:text-sky-400 transition-colors">
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
            className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
          >
            {/* Backdrop */}
            <motion.div 
              key="qr-scanner-overlay"
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }}
              onClick={stopScanner}
              className="absolute inset-0 bg-zinc-950/80 backdrop-blur-md"
            />

            {/* Modal Box */}
            <motion.div 
              key="qr-scanner-content"
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative w-full max-w-md bg-zinc-900 border border-white/10 rounded-[2rem] shadow-2xl overflow-hidden z-10 flex flex-col"
            >
              {/* Modal Header */}
              <div className="p-4 sm:p-5 border-b border-white/10 flex items-center justify-between bg-zinc-950/60">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-sky-500/20 text-sky-400">
                    <QrCode className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-white text-sm sm:text-base uppercase tracking-tight">Escanear Código QR</h3>
                    <p className="text-[10px] font-bold text-zinc-400">Apunta la cámara al código QR del área</p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <FlashlightWidget variant="compact" />
                  <button 
                    onClick={stopScanner}
                    className="p-2 rounded-full hover:bg-white/10 text-zinc-400 hover:text-white transition-colors cursor-pointer"
                    title="Cerrar escáner"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Reader Camera Frame */}
              <div className="p-4 flex flex-col items-center justify-center bg-black relative min-h-[300px]">
                <div id="reader" className="w-full max-w-[320px] overflow-hidden rounded-2xl border-2 border-sky-500/40 shadow-inner"></div>
              </div>

              {/* Modal Footer */}
              <div className="p-4 bg-zinc-950/80 border-t border-white/10 flex items-center justify-between">
                <p className="text-[11px] font-medium text-zinc-400 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  Buscando código QR...
                </p>
                <button
                  onClick={stopScanner}
                  className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all cursor-pointer"
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
          className="bg-white dark:bg-black rounded-3xl p-4 sm:p-6 border border-zinc-100 dark:border-white/10 shadow-sm dark:shadow-none space-y-6"
        >
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

              <FlashlightWidget variant="compact" />

              <button onClick={() => setSelectedArea(null)} className="p-2 bg-zinc-50 dark:bg-zinc-900 text-zinc-400 dark:text-zinc-500 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer" title="Cerrar Área">
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div className="space-y-8">
            <AnimatePresence mode="wait" custom={slideDirection}>
              <motion.div
                key={currentEquipment?.id || 'general'}
                custom={slideDirection}
                initial={(dir: 'next' | 'prev') => ({
                  opacity: 0,
                  x: dir === 'next' ? 120 : -120
                })}
                animate={{ opacity: 1, x: 0 }}
                exit={(dir: 'next' | 'prev') => ({
                  opacity: 0,
                  x: dir === 'next' ? -120 : 120
                })}
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
                  />
                  <VOSOExecutionCategory 
                    title="👂 Oír" 
                    icon={Ear} 
                    items={currentEquipment.inspeccionVOSO.oir || []} 
                    responses={vosoResponses}
                    colorClass="bg-indigo-50/80"
                    onUpdate={handleSetVOSOResponse}
                  />
                  <VOSOExecutionCategory 
                    title="✋ Sentir" 
                    icon={Hand} 
                    items={currentEquipment.inspeccionVOSO.sentir || []} 
                    responses={vosoResponses}
                    colorClass="bg-emerald-50/80"
                    onUpdate={handleSetVOSOResponse}
                  />
                  <VOSOExecutionCategory 
                    title="👃 Oler" 
                    icon={Wind} 
                    items={currentEquipment.inspeccionVOSO.oler || []} 
                    responses={vosoResponses}
                    colorClass="bg-orange-50/80"
                    onUpdate={handleSetVOSOResponse}
                  />
                  <VOSOExecutionCategory 
                    title="✨ Orden y Limpieza" 
                    icon={Sparkles} 
                    items={currentEquipment.inspeccionVOSO.orden || []} 
                    responses={vosoResponses}
                    colorClass="bg-purple-50/80"
                    onUpdate={handleSetVOSOResponse}
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

            <div className="pt-4">
              <button
                onClick={() => setShowEquipmentSummary(true)}
                disabled={!allItemsChecked()}
                className={`w-full py-4 rounded-2xl font-bold flex items-center justify-center gap-2 sm:gap-3 transition-all border ${
                  allItemsChecked() 
                    ? 'bg-zinc-900 text-white shadow-xl shadow-zinc-200 dark:shadow-none active:scale-[0.98]' 
                    : 'bg-zinc-100 text-zinc-300 border-zinc-200 grayscale cursor-not-allowed'
                }`}
              >
                <CheckCircle2 className={`w-5 h-5 ${allItemsChecked() ? 'text-emerald-400' : 'text-zinc-300'}`} />
                <span className="text-sm uppercase tracking-widest font-black">
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
                  capture="environment"
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
                      const reader = new FileReader();
                      reader.onloadend = async () => {
                        const base64 = reader.result as string;
                        try {
                          const compressed = await validateAndCompressImage(base64, 300, 300);
                          setFindingPhotos(prev => [...prev, compressed].slice(0, 3));
                          e.target.value = '';
                        } catch (err: any) {
                          console.error("Manual finding validation/compression error:", err);
                          setFormValidationError(err.message || "Error al validar la foto del hallazgo");
                          setMessage({ text: err.message || "Error al validar la foto del hallazgo", type: 'error' });
                          e.target.value = ''; // Reset file input
                        }
                      };
                      reader.readAsDataURL(file);
                    }
                  }}
                />
                
                {findingPhotos.length < 3 && (
                  <label 
                    htmlFor="findingPhotoInput"
                    className={`w-20 h-20 rounded-2xl flex flex-col items-center justify-center cursor-pointer transition-all active:scale-95 text-[10px] font-bold gap-1 ${
                      findingPhotos.length === 0 
                        ? 'bg-red-50 dark:bg-red-950/30 border-2 border-red-500 text-red-600 dark:text-red-400 animate-pulse' 
                        : 'bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 text-zinc-400 hover:text-brand-blue hover:border-brand-blue'
                    }`}
                  >
                    <Camera className="w-6 h-6" />
                    <span>{findingPhotos.length === 0 ? '+ Foto *' : `${findingPhotos.length}/3`}</span>
                  </label>
                )}

                {findingPhotos.map((photo, pIdx) => (
                  <div key={`finding-preview-${pIdx}`} className="relative group w-20 h-20">
                    <img src={photo} className="w-20 h-20 object-cover rounded-2xl border border-zinc-200 dark:border-white/10" alt={`Preview ${pIdx + 1}`} />
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

              <div className="p-8 border-t border-zinc-50 bg-zinc-50/50">
                <button 
                  onClick={() => {
                    setShowEquipmentSummary(false);
                    handleNextEquipment();
                  }}
                  className="w-full py-4 bg-zinc-900 dark:bg-white dark:text-black text-white rounded-2xl font-bold shadow-lg shadow-zinc-200 dark:shadow-none active:scale-95 transition-all flex items-center justify-center gap-3"
                >
                  <span className="uppercase tracking-widest">
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
      <QuickHelpModal
        isOpen={showQuickHelp}
        onClose={() => setShowQuickHelp(false)}
        moduleKey="Inspeccion"
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
            <span className="text-2xl sm:text-3xl font-black tracking-tight dark:text-white">{findingStats.complianceRate}%</span>
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
            <span className="text-2xl sm:text-3xl font-black tracking-tight dark:text-white">{findingStats.meanTimeToResolutionHours}h</span>
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
            <span className="text-2xl sm:text-3xl font-black tracking-tight dark:text-white">{criticalCount}</span>
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
            <span className="text-2xl sm:text-3xl font-black tracking-tight dark:text-white">{findingStats.totalFindings}</span>
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
  onClearPending 
}: { 
  user: AppUser, 
  initialFindingId?: string | null, 
  onClearPending?: () => void 
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
  }, [user]);

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
      {/* Header Banner Card for Panel VOSO Administrador */}
      <div className="bg-gradient-to-r from-slate-950 via-emerald-950 to-zinc-950 p-5 sm:p-7 md:p-8 rounded-3xl md:rounded-[2.5rem] border border-emerald-500/20 text-white shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/10 rounded-full -mr-32 -mt-32 blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-5 sm:gap-6 min-w-0">
          <div className="space-y-2.5 min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-3 py-1 bg-emerald-500/25 border border-emerald-400/30 text-emerald-200 rounded-full text-[10px] sm:text-xs font-black uppercase tracking-widest flex items-center gap-1.5 shrink-0">
                <Activity className="w-3.5 h-3.5 text-emerald-300" />
                Módulo VOSO Admin
              </span>
              <span className="px-2.5 py-1 bg-white/10 border border-white/10 text-white/90 rounded-full text-[10px] font-bold uppercase tracking-wider">
                {user.plantId || 'Todas las Plantas'}
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-black uppercase tracking-tight text-white leading-tight break-words">
              Panel VOSO (Ver, Oír, Sentir, Oler)
            </h2>
            <p className="text-xs sm:text-sm md:text-base text-emerald-100/90 font-medium max-w-2xl leading-relaxed">
              Consolidador de hallazgos en terreno, indicadores, gestión de criticidades y seguimiento de acciones correctivas.
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center sm:justify-end gap-2.5 sm:gap-3 w-full lg:w-auto shrink-0 pt-3 lg:pt-0 border-t lg:border-t-0 border-emerald-500/20">
            <button
              onClick={() => setShowQuickHelp(true)}
              className="px-3.5 py-3 bg-white/10 hover:bg-white/20 backdrop-blur-md rounded-2xl border border-white/20 text-white text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 transition-all active:scale-95 cursor-pointer whitespace-nowrap shadow-sm flex-1 sm:flex-initial"
            >
              <HelpCircle className="w-4 h-4 text-emerald-300 shrink-0" />
              <span>Ayuda rápida</span>
            </button>
            <div className="px-3.5 py-2.5 bg-white/10 backdrop-blur-md rounded-2xl border border-white/10 text-center sm:text-right min-w-[120px] flex-1 sm:flex-initial">
              <p className="text-[9px] font-black uppercase text-emerald-300 tracking-wider">Registros</p>
              <p className="text-xs font-black text-white">{activeModuleFindings.length} Hallazgos</p>
            </div>
            <div className="px-3.5 py-2.5 bg-white/10 backdrop-blur-md rounded-2xl border border-white/10 text-center sm:text-right min-w-[120px] flex-1 sm:flex-initial">
              <p className="text-[9px] font-black uppercase text-emerald-300 tracking-wider">ADMINISTRADOR</p>
              <p className="text-xs font-black text-white truncate max-w-[140px] mx-auto sm:ml-auto">{user.name}</p>
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
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }}
              onClick={() => setSelectedFinding(null)}
              className="absolute inset-0 bg-zinc-900/60 backdrop-blur-sm" 
            />
            <motion.div 
              initial={{ y: '100%' }} 
              animate={{ y: 0 }} 
              exit={{ y: '100%' }}
              className="relative w-full max-w-lg sm:max-w-5xl bg-white dark:bg-black rounded-t-[2.5rem] sm:rounded-[2.5rem] overflow-hidden shadow-2xl dark:shadow-none flex flex-col sm:flex-row max-h-[90vh] border border-transparent dark:border-white/10"
            >
              <div className="min-h-[260px] sm:min-h-[380px] max-h-[450px] sm:max-h-none sm:h-auto sm:w-1/2 shrink-0 relative bg-zinc-950 flex flex-col">
                <FindingPhotoGallery 
                  photos={extractFindingPhotos(selectedFinding)} 
                  altPrefix={selectedFinding.equipmentName || selectedFinding.areaName || 'Hallazgo'}
                  showCloseButton
                  onClose={() => setSelectedFinding(null)}
                />
              </div>
              <div className="flex-1 overflow-y-auto p-6 sm:p-10 space-y-6 custom-scrollbar dark:bg-zinc-950/20">
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
          const aTime = aValue?.toDate ? aValue.toDate().getTime() : 0;
          const bTime = bValue?.toDate ? bValue.toDate().getTime() : 0;
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
  }, [user]);

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
      await deleteDoc(doc(db, 'findings', id));
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

      const tableData = moduleFindings.map(f => [
        getFindingDate(f) ? format(getFindingDate(f)!, 'dd/MM/yy HH:mm') : '-',
        sanitizeForPDF(isVOSOFinding(f) ? 'VOSO' : '5S Orden'),
        sanitizeForPDF(`${f.areaName || 'General'}${f.equipmentName ? ' - ' + f.equipmentName : ''}`),
        sanitizeForPDF(f.operatorName || f.inspector || 'Operador'),
        sanitizeForPDF(f.priority || 'Media'),
        sanitizeForPDF(f.description, 0),
        f.status === 'Open' ? 'Pendiente' : f.status === 'InReview' ? 'En Revisión' : 'Cerrado',
        f.closedAt?.toDate ? format(f.closedAt.toDate(), 'dd/MM/yy HH:mm') : '-'
      ]);

      autoTable(docPDF, {
        startY: 35,
        head: [['Fecha', 'Módulo', 'Área / Equipo', 'Operador', 'Prioridad', 'Descripción y Detalle', 'Estado', 'Cierre']],
        body: tableData,
        theme: 'grid',
        headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8, cellPadding: 3 },
        alternateRowStyles: { fillColor: [240, 249, 255] },
        styles: { fontSize: 8, cellPadding: 3, overflow: 'linebreak', lineColor: [226, 232, 240] },
        columnStyles: {
          0: { cellWidth: 20 },
          1: { cellWidth: 18 },
          2: { cellWidth: 26 },
          3: { cellWidth: 20 },
          4: { cellWidth: 15 },
          5: { cellWidth: 'auto' },
          6: { cellWidth: 18 },
          7: { cellWidth: 20 }
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
                                    {f.equipmentName ? `Área Completa (${f.equipmentName})` : 'Área Completa'}
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
                  const resolutionTime = fDate && f.closedAt ? Math.round((f.closedAt.toDate().getTime() - fDate.getTime()) / (1000 * 60 * 60) * 10) / 10 : null;

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
                                {f.closedAt?.toDate ? format(f.closedAt.toDate(), 'dd/MM/yy') : '-'}
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
            <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0 }} 
                animate={{ opacity: 1 }} 
                exit={{ opacity: 0 }}
                onClick={() => setSelectedFinding(null)}
                className="absolute inset-0 bg-zinc-900/60 backdrop-blur-sm" 
              />
              <motion.div 
                initial={{ y: '100%' }} 
                animate={{ y: 0 }} 
                exit={{ y: '100%' }}
                className="relative w-full max-w-lg sm:max-w-5xl bg-white dark:bg-black rounded-t-[2.5rem] sm:rounded-[2.5rem] overflow-hidden shadow-2xl dark:shadow-none flex flex-col sm:flex-row max-h-[90vh] border border-transparent dark:border-white/10"
              >
                <div className="min-h-[260px] sm:min-h-[380px] max-h-[450px] sm:max-h-none sm:h-auto sm:w-1/2 shrink-0 relative bg-zinc-950 flex flex-col">
                  <FindingPhotoGallery 
                    photos={extractFindingPhotos(selectedFinding)} 
                    altPrefix={selectedFinding.equipmentName || selectedFinding.areaName || 'Hallazgo'}
                    showCloseButton
                    onClose={() => setSelectedFinding(null)}
                  />
                </div>
                <div className="flex-1 overflow-y-auto p-6 sm:p-10 space-y-6 custom-scrollbar">
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
                                    {Math.floor((selectedFinding.inspectionDurationSeconds || (selectedFinding.inspectionCompletedAt.toDate().getTime() - selectedFinding.inspectionStartedAt.toDate().getTime()) / 1000) / 60)} min
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
                                    {(selectedFinding.equipmentDurationSeconds || Math.round((selectedFinding.equipmentCompletedAt.toDate().getTime() - selectedFinding.equipmentStartedAt.toDate().getTime()) / 1000))}s
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
                                <p className="text-xs font-bold text-emerald-700 dark:text-emerald-400">{format(selectedFinding.closedAt.toDate(), 'dd MMM, HH:mm')}</p>
                                {getFindingDate(selectedFinding) && (
                                  <p className="text-[9px] font-black text-emerald-500 dark:text-emerald-400 uppercase tracking-tighter">
                                    En {Math.round((selectedFinding.closedAt.toDate().getTime() - getFindingDate(selectedFinding)!.getTime()) / (1000 * 60 * 60) * 10) / 10} horas
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
    const unsubNotif = onSnapshot(query(collection(db, 'notifications'), orderBy('createdAt', 'desc')), (snapshot) => {
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
  entityType: 'Users' | 'Plants' | 'Areas' | 'Equipment' | 'Findings',
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
              const id = item.id || generateSafeId(name);
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

              const id = item.id || generateSafeId(name);
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

              const id = item.id || item.tag || item.etiqueta_tag || generateSafeId(name);
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
            else if (entityType === 'Findings') {
              const desc = item.descripcion || item.hallazgo || item.description || item.observacion;
              if (!desc) continue;

              const plantInput = item.planta_id || item.planta || item.plantid;
              let plantId = plantInput || 'PLANTA-01';
              if (plants && plantInput) {
                const found = plants.find(p => p.id === plantInput || (p.name || '').toLowerCase() === (plantInput || '').toLowerCase());
                if (found) plantId = found.id;
              }

              const areaInput = item.area_id || item.area || item.nombre_area;
              let areaId = areaInput || '';
              let areaName = item.area_nombre || item.area || item.nombre_area || 'Área General';
              if (areas && areaInput) {
                const found = areas.find(a => a.id === areaInput || (a.name || '').toLowerCase() === (areaInput || '').toLowerCase());
                if (found) {
                  areaId = found.id;
                  areaName = found.name;
                }
              }

              const equipNameInput = item.equipo || item.nombre_equipo || item.equipment || 'Puntos Generales de Inspección';
              const operatorName = item.operador || item.operador_nombre || item.operator || 'Operador Carga Masiva';
              
              const id = item.id || `FIND-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
              
              const rawDate = item.fecha_reporte || item.fecha || item.createdat;
              const parsedDate = parseAnyDate(rawDate) || new Date();
              const tsDate = Timestamp.fromDate(parsedDate);

              const rawClosedDate = item.fecha_cierre || item.closedat;
              let closedTs: Timestamp | null = null;
              if (rawClosedDate) {
                const pClosed = parseAnyDate(rawClosedDate);
                if (pClosed) closedTs = Timestamp.fromDate(pClosed);
              }

              const statusInput = (item.estado || item.status || 'Abierto').toLowerCase();
              let status: 'Open' | 'InReview' | 'Closed' = 'Open';
              if (statusInput.includes('cerrad') || statusInput === 'closed') status = 'Closed';
              else if (statusInput.includes('revis') || statusInput === 'inreview') status = 'InReview';

              const priorityInput = (item.prioridad || item.priority || 'Media').toLowerCase();
              let priority = 'Media';
              if (priorityInput.includes('alta') || priorityInput.includes('high')) priority = 'Alta';
              else if (priorityInput.includes('critica') || priorityInput.includes('critical')) priority = 'Crítica';
              else if (priorityInput.includes('baja') || priorityInput.includes('low')) priority = 'Baja';

              const inspDuration = item.duracion_area_seg ? parseInt(item.duracion_area_seg) : 0;
              const equipDuration = item.duracion_equipo_seg ? parseInt(item.duracion_equipo_seg) : 0;

              const payload: any = {
                id,
                plantId,
                areaId,
                areaName,
                equipmentId: item.equipo_id || 'general',
                equipmentName: equipNameInput,
                operatorName,
                description: desc,
                priority,
                status,
                createdAt: tsDate,
                date: tsDate,
                inspectionStartedAt: tsDate,
                inspectionCompletedAt: tsDate,
                inspectionDurationSeconds: inspDuration,
                equipmentStartedAt: tsDate,
                equipmentCompletedAt: tsDate,
                equipmentDurationSeconds: equipDuration,
                supervisorComments: item.comentarios_supervisor || item.solucion || '',
                photoUrl: item.foto_url || '',
                closedAt: closedTs
              };

              await setDoc(doc(db, 'findings', id), payload, { merge: true });
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
    if (entityType === 'Findings') return "id,planta_id,area,equipo,operador,descripcion,prioridad,estado,fecha_reporte,duracion_area_seg,duracion_equipo_seg,fecha_cierre,comentarios_supervisor\nHALL-01,PLANTA-01,Zona de Carga,Motor Principal,Juan Perez,Falta orden y limpieza en la base del equipo,Alta,Abierto,2026-08-10 08:00:00,120,45,,";
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
            entityType === 'Areas' ? 'Áreas' :
            entityType === 'Equipment' ? 'Equipos' : 'Registros / Hallazgos'
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
  const [activeSubTab, setActiveSubTab] = useState<'Users' | 'Plants' | 'Areas' | 'Equipment' | 'Findings'>('Users');
  const [areas, setAreas] = useState<Area[]>([]);
  const [equipmentList, setEquipmentList] = useState<Equipment[]>([]);

  useEffect(() => {
    const unsubAreas = onSnapshot(collection(db, 'areas'), (snapshot) => {
      setAreas(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any)));
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
        {(['Users', 'Plants', 'Areas', 'Equipment', 'Findings'] as const).map((tab, tIdx) => (
          <button
            key={`admin-tab-${tab}-${tIdx}`}
            onClick={() => setActiveSubTab(tab)}
            className={`flex-1 min-w-[100px] px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
              activeSubTab === tab ? 'bg-white dark:bg-black text-zinc-900 dark:text-white shadow-sm dark:shadow-none' : 'text-zinc-500 dark:text-zinc-600 hover:text-zinc-700 dark:hover:text-zinc-400'
            }`}
          >
            {tab === 'Users' ? 'Usuarios' : 
             tab === 'Plants' ? 'Plantas' : 
             tab === 'Areas' ? 'Áreas' : 
             tab === 'Equipment' ? 'Equipos' : 'Carga Masiva Registros'}
          </button>
        ))}
      </div>

      {activeSubTab === 'Users' && <AdminUserManagement plants={plants} />}
      {activeSubTab === 'Plants' && <AdminPlantManagement plants={plants} />}
      {activeSubTab === 'Areas' && <AdminAreaManagement plants={plants} areas={areas} />}
      {activeSubTab === 'Equipment' && <AdminEquipmentManagement plants={plants} areas={areas} equipment={equipmentList} />}
      {activeSubTab === 'Findings' && (
        <div className="space-y-4">
          <BulkUpload 
            entityType="Findings" 
            plants={plants} 
            areas={areas} 
            onComplete={(c) => alert(`Se cargaron ${c} hallazgos/registros exitosamente.`)} 
            onError={(err) => alert(err)} 
          />
        </div>
      )}
    </div>
  );
};

const AdminPlantManagement = ({ plants }: { plants: {id: string, name: string}[] }) => {
  const [showForm, setShowForm] = useState(false);
  const [editingPlant, setEditingPlant] = useState<{id: string, name: string} | null>(null);
  const [name, setName] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string, type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => setMessage(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [message]);

  const handleSave = async () => {
    console.log("Iniciando handleSave Planta, name:", name);
    if (!name) {
      console.warn("Nombre de planta vacío");
      return;
    }
    
    try {
      const id = editingPlant ? editingPlant.id : generateSafeId(name);
      console.log("Guardando planta con ID:", id);
      await setDoc(doc(db, 'plants', id), { id, name });
      console.log("Planta guardada correctamente");
      setName('');
      setEditingPlant(null);
      setShowForm(false);
      setMessage({ text: "Planta guardada correctamente", type: 'success' });
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
        <button onClick={() => { setEditingPlant(null); setName(''); setShowForm(true); }} className="p-2 bg-brand-blue text-white rounded-xl hover:opacity-90 transition-all shadow-md shadow-sky-100 dark:shadow-none"><Plus className="w-4 h-4" /></button>
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
              <span className="font-bold text-zinc-900 dark:text-white">{p.name}</span>
              <p className="text-[10px] text-zinc-400 dark:text-zinc-600 uppercase font-black tracking-widest">{p.id}</p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => { setEditingPlant(p); setName(p.name); setShowForm(true); }} className="p-2 text-zinc-400 dark:text-zinc-600 hover:text-zinc-900 dark:hover:text-white transition-colors"><FileText className="w-4 h-4" /></button>
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
              </div>
              <div className="flex-1 overflow-y-auto p-8 pt-4 custom-scrollbar">
                <input value={name} onChange={e => setName(e.target.value)} placeholder="Nombre de la planta" className="w-full p-4 bg-zinc-50 dark:bg-zinc-900 border border-zinc-100 dark:border-white/10 text-zinc-900 dark:text-white rounded-2xl mb-4 outline-none focus:ring-2 focus:ring-brand-blue" />
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

const AdminAreaManagement = ({ plants, areas }: { plants: {id: string, name: string}[], areas: Area[] }) => {
  const [showForm, setShowForm] = useState(false);
  const [editingArea, setEditingArea] = useState<Area | null>(null);
  const [formData, setFormData] = useState({ name: '', plantId: '', qrCode: '' });
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string, type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => setMessage(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [message]);

  const handleSave = async () => {
    if (!formData.name || !formData.plantId) return;
    try {
      const id = editingArea ? editingArea.id : generateSafeId(formData.name);
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
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-zinc-900 dark:text-white">Áreas de Inspección</h3>
        <button onClick={() => { setEditingArea(null); setFormData({name:'', plantId:'', qrCode:''}); setShowForm(true); }} className="p-2 bg-zinc-900 dark:bg-white text-white dark:text-black rounded-xl hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors"><Plus className="w-4 h-4" /></button>
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
            <div className="flex gap-2 items-center">
              <span className="text-[10px] text-zinc-400 dark:text-zinc-600 uppercase font-bold mr-2 tracking-wider">QR: {a.qrCode}</span>
              <button onClick={() => { setEditingArea(a); setFormData({name: a.name, plantId: (a as any).plantId, qrCode: a.qrCode}); setShowForm(true); }} className="p-2 text-zinc-400 dark:text-zinc-600 hover:text-zinc-900 dark:hover:text-white transition-colors"><FileText className="w-4 h-4" /></button>
              <button onClick={() => setConfirmDeleteId(a.id)} className="p-2 text-zinc-400 dark:text-zinc-600 hover:text-red-500 transition-colors"><X className="w-4 h-4" /></button>
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
      const id = editingEquip ? editingEquip.id : generateSafeId(formData.name);
      
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
          <button onClick={() => { 
            setEditingEquip(null); 
            setFormData({name:'', tag: '', areaId:'', plantId: '', inspectionOrder: 0, checkItems: [], inspeccionVOSO: DEFAULT_VOSO}); 
            setShowForm(true); 
          }} className="p-2 bg-brand-blue text-white rounded-xl shadow-md shadow-sky-100 dark:shadow-none">
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
                                  <span className="text-[10px] font-bold tracking-wider bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 px-2 py-0.5 rounded-md border border-zinc-200/80 dark:border-white/10 uppercase">
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
      </AnimatePresence>
    </div>
  );
};

const AdminUserManagement = ({ plants }: { plants: {id: string, name: string}[] }) => {
  const [users, setUsers] = useState<AppUser[]>([]);
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

  useEffect(() => {
    const unsubUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
      setUsers(snapshot.docs.map(doc => ({ ...doc.data(), uid: doc.id } as AppUser)));
    });
    return () => {
      unsubUsers();
    };
  }, []);

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
    <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-3 pointer-events-none max-w-sm w-full px-4 sm:px-0">
      <AnimatePresence>
        {toasts.map((toast) => (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, x: 50, scale: 0.95 }}
            transition={{ type: 'spring', damping: 20, stiffness: 300 }}
            className="pointer-events-auto w-full bg-white dark:bg-zinc-950 border rounded-2xl shadow-lg dark:shadow-none p-4 flex items-start gap-3 border-zinc-150/80 dark:border-zinc-800 transition-colors duration-200"
          >
            <div className="flex-shrink-0 mt-0.5">
              {toast.type === 'success' && <CheckCircle2 className="w-5 h-5 text-emerald-500 dark:text-emerald-400" />}
              {toast.type === 'error' && <AlertCircle className="w-5 h-5 text-red-500 dark:text-red-400" />}
              {toast.type === 'warning' && <AlertTriangle className="w-5 h-5 text-amber-500 dark:text-amber-400" />}
              {toast.type === 'info' && <Bell className="w-5 h-5 text-brand-blue dark:text-sky-400" />}
            </div>
            <div className="flex-1">
              <h4 className="font-bold text-sm text-zinc-900 dark:text-white uppercase tracking-tight">{toast.title}</h4>
              <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-0.5 leading-relaxed font-medium">{toast.message}</p>
            </div>
            <button
              onClick={() => setToasts(prev => prev.filter(t => t.id !== toast.id))}
              className="flex-shrink-0 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors p-1 rounded-full hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
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
  const [currentTime, setCurrentTime] = useState(new Date());
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

  const [currentTime, setCurrentTime] = useState(new Date());
  const [pendingFindingId, setPendingFindingId] = useState<string | null>(null);
  const [showProfileModal, setShowProfileModal] = useState(false);
  
  // Single, cache-reliable global plants list for the app
  const [plants, setPlants] = useState<{ id: string; name: string }[]>([]);

  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const seenNotificationIdsRef = useRef<Set<string>>(new Set());
  const isFirstSnapshotRef = useRef(true);

  // PWA states
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [showIOSInstructions, setShowIOSInstructions] = useState(false);

  // Meteored Weather state for global Header
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
        const data = await meteoredService.getHourlyForecast();
        if (isMounted) {
          if (data) {
            setWeather(data);
          } else {
            setWeatherError(true);
          }
        }
      } catch (err) {
        console.error("Error fetching Meteored weather:", err);
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
  }, []);

  useEffect(() => {
    // 1. Detect if already in standalone mode (installed)
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone;
    if (isStandalone) {
      return;
    }

    // 2. Check if dismissed in this session
    const isDismissed = sessionStorage.getItem('pwa_install_dismissed') === 'true';
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
    sessionStorage.setItem('pwa_install_dismissed', 'true');
    setShowInstallBanner(false);
  };

  useEffect(() => {
    const handleToastEvent = (e: Event) => {
      const customEvent = e as CustomEvent<Omit<ToastMessage, 'id'>>;
      const { title, message, type } = customEvent.detail;
      const id = Math.random().toString(36).substr(2, 9);
      setToasts(prev => [...prev, { id, title, message, type }]);
      
      // Auto dismiss after 5 seconds
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== id));
      }, 5000);
    };

    window.addEventListener('app-toast', handleToastEvent);
    return () => window.removeEventListener('app-toast', handleToastEvent);
  }, []);

  useEffect(() => {
    // Check for any newly added notifications
    notifications.forEach(n => {
      if (!seenNotificationIdsRef.current.has(n.id)) {
        seenNotificationIdsRef.current.add(n.id);
        
        if (n.title === 'Hallazgo Cerrado' || n.message?.toLowerCase().includes('cerrado')) {
          showToast('🔒 ' + n.title, n.message, 'success');
        } else if (n.title === 'Hallazgo en Revisión' || n.message?.toLowerCase().includes('revisado')) {
          showToast('🕵️ ' + n.title, n.message, 'info');
        } else {
          showToast('🔔 ' + n.title, n.message, 'info');
        }
      }
    });
  }, [notifications]);

  useEffect(() => {
    const unsubPlants = onSnapshot(collection(db, 'plants'), (snapshot) => {
      setPlants(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any)));
    }, (error) => {
      console.warn("Global plants listener error:", error);
    });
    return () => unsubPlants();
  }, []);

  useEffect(() => {
    // Notification listener
    let notifyQuery;
    
    if (user.role === 'Administrador') {
      notifyQuery = query(
        collection(db, 'notifications'), 
        orderBy('scheduledAt', 'desc'),
        limit(30)
      );
    } else {
      // For non-admins, we must filter to match security rules exactly
      // to avoid permission-denied
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
        // If it's a finding NOT belonging to the user's plant, reject it
        if (n.type === 'Finding' || n.plantId) {
          // If the user has no plant assigned, they shouldn't see plant-specific notifications
          if (!user.plantId) return false;
          return n.plantId === user.plantId;
        }
        
        // Announcement type with no plantId is considered global
        return true;
      });

      if (isFirstSnapshotRef.current) {
        filtered.forEach(n => seenNotificationIdsRef.current.add(n.id));
        isFirstSnapshotRef.current = false;
      }

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

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div data-theme={theme} className="min-h-screen bg-zinc-50 dark:bg-black bg-concrete flex flex-col md:flex-row transition-colors duration-200">
          {/* Sidebar Navigation (Desktop & Tablet) */}
          <aside className={`hidden md:flex flex-col ${isSidebarCollapsed ? 'w-24' : 'w-64'} bg-white dark:bg-black border-r border-zinc-100 dark:border-white/10 h-screen sticky top-0 z-40 p-6 transition-all duration-300 ease-in-out`}>
            <div className={`flex flex-col mb-6 gap-4 ${isSidebarCollapsed ? 'items-center' : ''}`}>
              <div className="flex items-center justify-between w-full">
                <button 
                  onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                  className={`p-2 hover:bg-zinc-50 dark:hover:bg-zinc-900 rounded-xl text-zinc-400 transition-colors flex shrink-0 ${isSidebarCollapsed ? 'mx-auto' : ''}`}
                  title={isSidebarCollapsed ? "Expandir" : "Contraer"}
                >
                  {isSidebarCollapsed ? <PanelLeftOpen className="w-6 h-6" /> : <PanelLeftClose className="w-5 h-5" />}
                </button>
                {!isSidebarCollapsed && (
                  <button
                    onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
                    className="p-2 hover:bg-zinc-50 dark:hover:bg-zinc-900 rounded-xl text-zinc-400 transition-colors"
                    title={theme === 'light' ? 'Activar modo oscuro' : 'Activar modo claro'}
                  >
                    {theme === 'light' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
                  </button>
                )}
              </div>
              <div className={isSidebarCollapsed ? 'w-full flex justify-center' : 'px-2'}>
                <Logo isCollapsed={isSidebarCollapsed} className={isSidebarCollapsed ? 'h-24 px-2' : 'h-12'} />
              </div>

              {/* Operator Profile Card directly under Logo */}
              <div 
                onClick={() => setShowProfileModal(true)}
                className={`w-full p-3 bg-gradient-to-br from-zinc-50 via-sky-500/5 to-blue-500/5 dark:from-zinc-900 dark:via-zinc-900 dark:to-sky-950/20 rounded-2xl border border-zinc-200/70 dark:border-white/10 hover:border-sky-500/40 hover:shadow-md cursor-pointer transition-all shadow-2xs group ${isSidebarCollapsed ? 'flex justify-center p-2' : ''}`}
                title="Ver y editar mi perfil personal"
              >
                {isSidebarCollapsed ? (
                  <div className="relative group/avatar cursor-pointer">
                    <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-sky-600 to-blue-500 text-white font-black text-sm flex items-center justify-center border border-white/20 shadow-md shadow-sky-500/20 shrink-0 overflow-hidden">
                      {user.avatarUrl ? (
                        <img src={user.avatarUrl} alt={user.name} className="w-full h-full object-cover" />
                      ) : (
                        user.name?.charAt(0) || user.email.charAt(0)
                      )}
                    </div>
                    {isOffline && (
                      <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 border-2 border-white dark:border-black rounded-full animate-ping" />
                    )}
                  </div>
                ) : (
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-sky-600 to-blue-500 text-white font-black text-sm flex items-center justify-center border border-white/20 shadow-md shadow-sky-500/20 shrink-0 overflow-hidden relative">
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
                        <span className="text-[9px] font-black uppercase text-sky-600 dark:text-sky-400 tracking-wider flex items-center gap-1">
                          {user.role}
                          <Edit3 className="w-2.5 h-2.5 text-sky-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </span>
                      </div>
                      <p className="text-xs font-black text-zinc-900 dark:text-white truncate transition-colors leading-tight mt-0.5 group-hover:text-sky-600 dark:group-hover:text-sky-400">
                        {user.name}
                      </p>
                      <p className="text-[10px] font-medium text-zinc-400 dark:text-zinc-500 truncate mt-0.5">
                        {user.cargo || user.email.replace('@chekify.local', '')}
                      </p>
                      {isOffline && (
                        <div className="mt-1.5 flex items-center gap-1 px-2 py-0.5 bg-red-50 dark:bg-red-500/10 border border-red-100 dark:border-red-500/20 text-red-600 dark:text-red-400 text-[8px] font-extrabold uppercase rounded-md">
                          <AlertCircle className="w-2.5 h-2.5 shrink-0" />
                          <span>Desconectado</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="flex-1 space-y-2">
              <button 
                onClick={() => setShowProfileModal(true)}
                className={`w-full flex items-center ${isSidebarCollapsed ? 'justify-center px-3' : 'gap-3 px-4'} py-3 rounded-2xl transition-all font-bold text-sm text-zinc-600 dark:text-zinc-400 hover:bg-sky-500/10 hover:text-sky-600 dark:hover:text-sky-400 cursor-pointer`}
                title={isSidebarCollapsed ? "Mi Perfil" : undefined}
              >
                <UserCheck className="w-5 h-5 shrink-0 text-sky-500" />
                {!isSidebarCollapsed && <span>Mi Perfil</span>}
              </button>
              <button 
                onClick={() => setActiveTab('Home')}
                className={`w-full flex items-center ${isSidebarCollapsed ? 'justify-center px-3' : 'gap-3 px-4'} py-3 rounded-2xl transition-all font-bold text-sm ${
                  activeTab === 'Home' 
                    ? 'bg-gradient-to-r from-sky-600 to-blue-600 text-white shadow-md shadow-sky-500/25 ring-1 ring-sky-400/30' 
                    : 'text-zinc-600 dark:text-zinc-400 hover:bg-sky-500/10 hover:text-sky-600 dark:hover:text-sky-400'
                }`}
                title={isSidebarCollapsed ? "Inspección Primaria" : undefined}
              >
                <ShieldCheck className={`w-5 h-5 shrink-0 ${activeTab === 'Home' ? 'text-white' : 'text-sky-500'}`} />
                {!isSidebarCollapsed && <span>Inspección Primaria</span>}
              </button>
              <button 
                onClick={() => setActiveTab('OrdenLimpieza')}
                className={`w-full flex items-center ${isSidebarCollapsed ? 'justify-center px-3' : 'gap-3 px-4'} py-3 rounded-2xl transition-all font-bold text-sm ${
                  activeTab === 'OrdenLimpieza' 
                    ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md shadow-purple-500/25 ring-1 ring-purple-400/30' 
                    : 'text-zinc-600 dark:text-zinc-400 hover:bg-purple-500/10 hover:text-purple-600 dark:hover:text-purple-400'
                }`}
                title={isSidebarCollapsed ? "Orden & Limpieza" : undefined}
              >
                <Sparkles className={`w-5 h-5 shrink-0 ${activeTab === 'OrdenLimpieza' ? 'text-white' : 'text-purple-500'}`} />
                {!isSidebarCollapsed && <span>Orden & Limpieza</span>}
              </button>
              <button 
                onClick={() => setActiveTab('History')}
                className={`w-full flex items-center ${isSidebarCollapsed ? 'justify-center px-3' : 'gap-3 px-4'} py-3 rounded-2xl transition-all font-bold text-sm ${
                  activeTab === 'History' 
                    ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md shadow-emerald-500/25 ring-1 ring-emerald-400/30' 
                    : 'text-zinc-600 dark:text-zinc-400 hover:bg-emerald-500/10 hover:text-emerald-600 dark:hover:text-emerald-400'
                }`}
                title={isSidebarCollapsed ? "Historial" : undefined}
              >
                <History className={`w-5 h-5 shrink-0 ${activeTab === 'History' ? 'text-white' : 'text-emerald-500'}`} />
                {!isSidebarCollapsed && <span>Historial</span>}
              </button>
              {user.role === 'Administrador' && (
                <>
                  <button 
                    onClick={() => setActiveTab('Admin')}
                    className={`w-full flex items-center ${isSidebarCollapsed ? 'justify-center px-3' : 'gap-3 px-4'} py-3 rounded-2xl transition-all font-bold text-sm ${
                      activeTab === 'Admin' 
                        ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-md shadow-indigo-500/25 ring-1 ring-indigo-400/30' 
                        : 'text-zinc-600 dark:text-zinc-400 hover:bg-indigo-500/10 hover:text-indigo-600 dark:hover:text-indigo-400'
                    }`}
                    title={isSidebarCollapsed ? "Administración" : undefined}
                  >
                    <Users className={`w-5 h-5 shrink-0 ${activeTab === 'Admin' ? 'text-white' : 'text-indigo-500'}`} />
                    {!isSidebarCollapsed && <span>Administración</span>}
                  </button>
                  <button 
                    onClick={() => setActiveTab('Notifications')}
                    className={`w-full flex items-center ${isSidebarCollapsed ? 'justify-center px-3' : 'gap-3 px-4'} py-3 rounded-2xl transition-all font-bold text-sm ${
                      activeTab === 'Notifications' 
                        ? 'bg-gradient-to-r from-amber-600 to-orange-600 text-white shadow-md shadow-amber-500/25 ring-1 ring-amber-400/30' 
                        : 'text-zinc-600 dark:text-zinc-400 hover:bg-amber-500/10 hover:text-amber-600 dark:hover:text-amber-400'
                    }`}
                    title={isSidebarCollapsed ? "Notificaciones" : undefined}
                  >
                    <Bell className={`w-5 h-5 shrink-0 ${activeTab === 'Notifications' ? 'text-white' : 'text-amber-500'}`} />
                    {!isSidebarCollapsed && <span>Notificaciones</span>}
                  </button>
                  <button 
                    onClick={() => setActiveTab('PDFConfig')}
                    className={`w-full flex items-center ${isSidebarCollapsed ? 'justify-center px-3' : 'gap-3 px-4'} py-3 rounded-2xl transition-all font-bold text-sm ${
                      activeTab === 'PDFConfig' 
                        ? 'bg-gradient-to-r from-rose-600 to-pink-600 text-white shadow-md shadow-rose-500/25 ring-1 ring-rose-400/30' 
                        : 'text-zinc-600 dark:text-zinc-400 hover:bg-rose-500/10 hover:text-rose-600 dark:hover:text-rose-400'
                    }`}
                    title={isSidebarCollapsed ? "Configuración PDF" : undefined}
                  >
                    <Shield className={`w-5 h-5 shrink-0 ${activeTab === 'PDFConfig' ? 'text-white' : 'text-rose-500'}`} />
                    {!isSidebarCollapsed && <span>Configuración PDF</span>}
                  </button>
                </>
              )}
              <button 
                onClick={() => setActiveTab('Help')}
                className={`w-full flex items-center ${isSidebarCollapsed ? 'justify-center px-3' : 'gap-3 px-4'} py-3 rounded-2xl transition-all font-bold text-sm ${
                  activeTab === 'Help' 
                    ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-md shadow-cyan-500/25 ring-1 ring-cyan-400/30' 
                    : 'text-zinc-600 dark:text-zinc-400 hover:bg-cyan-500/10 hover:text-cyan-600 dark:hover:text-cyan-400'
                }`}
                title={isSidebarCollapsed ? "Ayuda" : undefined}
              >
                <HelpCircle className={`w-5 h-5 shrink-0 ${activeTab === 'Help' ? 'text-white' : 'text-cyan-500'}`} />
                {!isSidebarCollapsed && <span>Ayuda / Instructivo</span>}
              </button>
            </div>

            <div className="mt-auto space-y-4">
              {isSidebarCollapsed && (
                <button
                  onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
                  className="w-full flex items-center justify-center p-3 hover:bg-zinc-50 dark:hover:bg-zinc-900 rounded-2xl text-zinc-400 transition-colors"
                  title={theme === 'light' ? 'Activar modo oscuro' : 'Activar modo claro'}
                >
                  {theme === 'light' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
                </button>
              )}
              <button 
                onClick={() => signOut(auth)}
                className={`w-full flex items-center ${isSidebarCollapsed ? 'justify-center px-3' : 'gap-3 px-4'} py-3 rounded-2xl text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-all font-bold text-sm`}
                title={isSidebarCollapsed ? "Cerrar Sesión" : undefined}
              >
                <LogOut className="w-5 h-5 shrink-0" />
                {!isSidebarCollapsed && <span>Cerrar Sesión</span>}
              </button>
              {!isSidebarCollapsed && (
                <div className="text-center pt-2">
                  <p className="text-[8px] font-bold text-zinc-300 dark:text-zinc-600 uppercase tracking-[0.2em]">Developed by maisser.cl</p>
                </div>
              )}
            </div>
          </aside>

          {/* Main Content Area */}
          <div className="flex-1 flex flex-col min-w-0">
            {/* Header (Mobile & Sticky desktop header) */}
            <header className="bg-white/95 dark:bg-zinc-950/95 border-b border-zinc-200/80 dark:border-white/10 px-2.5 sm:px-6 md:px-8 py-2.5 sm:py-3.5 sticky top-0 z-40 backdrop-blur-md transition-colors duration-200 shadow-xs">
              <div className="max-w-7xl mx-auto flex flex-col gap-2 sm:gap-2.5">
                <div className="flex items-center justify-between gap-1.5 sm:gap-4 min-w-0">
                  {/* Mobile Identity / Avatar Photo */}
                  <div className="flex items-center gap-2 md:hidden shrink-0">
                    <Logo className="h-7 sm:h-8 shrink-0" />
                    <button 
                      onClick={() => setShowProfileModal(true)}
                      className="hover:opacity-80 transition-opacity cursor-pointer p-0.5 rounded-full ring-2 ring-sky-500/30 hover:ring-sky-500/80 shrink-0 ml-0.5"
                      title={`Perfil: ${user.name || user.email}`}
                    >
                      <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-sky-600 to-blue-600 text-white font-black text-xs flex items-center justify-center shrink-0 shadow-xs overflow-hidden border border-white/20">
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
                      <h1 className="text-zinc-900 dark:text-white font-black text-base lg:text-lg leading-tight transition-colors truncate tracking-tight">
                        {activeTab === 'Home' ? `¡Bienvenido ${user.name?.split(' ')[0] || user.name || 'Usuario'}!` : activeTab === 'OrdenLimpieza' ? 'Orden & Limpieza' : activeTab === 'History' ? 'Historial de Inspecciones' : activeTab === 'Admin' ? 'Administración' : activeTab === 'Notifications' ? 'Notificaciones' : activeTab === 'PDFConfig' ? 'Configuración PDF' : 'Ayuda / Instructivo'}
                      </h1>
                      {isOffline && (
                        <span className="flex items-center gap-1 px-2 py-0.5 bg-red-50 dark:bg-red-500/10 border border-red-100 dark:border-red-500/20 text-red-600 dark:text-red-400 text-[8px] font-extrabold uppercase rounded-full animate-pulse shrink-0">
                          <AlertCircle className="w-2.5 h-2.5" />
                          Desconectado
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] lg:text-xs text-zinc-400 dark:text-zinc-500 font-semibold truncate mt-0.5">
                      {format(currentTime, "EEEE, dd 'de' MMMM • HH:mm:ss", { locale: es })}
                    </p>
                  </div>

                  {/* Header Actions & Weather Summary Pill */}
                  <div className="flex items-center gap-1 sm:gap-2 shrink-0">
                    
                    {/* Compact Weather Summary Pill in Header */}
                    <button
                      onClick={() => setIsWeatherExpanded(!isWeatherExpanded)}
                      className={`flex items-center gap-1 px-2 py-1.5 sm:px-3 sm:py-2 rounded-xl border text-[10px] sm:text-xs font-bold transition-all shadow-2xs shrink-0 cursor-pointer ${
                        isWeatherExpanded 
                          ? 'bg-sky-500/20 border-sky-500/40 text-sky-900 dark:text-sky-200 ring-2 ring-sky-500/20' 
                          : 'bg-gradient-to-r from-sky-500/10 via-blue-500/5 to-indigo-500/10 hover:bg-sky-500/15 border-sky-500/20 text-sky-900 dark:text-sky-300'
                      }`}
                      title="Ver condiciones meteorológicas detalladas"
                    >
                      {loadingWeather ? (
                        <div className="flex items-center gap-1 text-sky-600 dark:text-sky-400">
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span className="hidden sm:inline text-[10px]">Clima...</span>
                        </div>
                      ) : weatherError || !weather ? (
                        <div className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
                          <CloudOff className="w-3.5 h-3.5" />
                          <span className="text-[10px]">N/A</span>
                        </div>
                      ) : (
                        <>
                          <CloudSun className="w-3.5 h-3.5 text-sky-500 shrink-0" />
                          <div className="flex items-center gap-0.5 sm:gap-1 text-[10px] sm:text-xs">
                            <span className="font-extrabold text-zinc-900 dark:text-white">{weather.temperature}</span>
                            <span className="text-zinc-300 dark:text-zinc-700 hidden sm:inline">•</span>
                            <span className="text-zinc-600 dark:text-zinc-300 hidden sm:inline">Hum: {weather.humidity}</span>
                            {weather.uvIndex !== undefined && (
                              <>
                                <span className="text-zinc-300 dark:text-zinc-700 hidden md:inline">•</span>
                                <span className="text-amber-600 dark:text-amber-400 font-bold hidden md:inline">UV: {weather.uvIndex}</span>
                              </>
                            )}
                          </div>
                          <ChevronDown className={`w-3 h-3 text-sky-500 transition-transform duration-200 ${isWeatherExpanded ? 'rotate-180' : ''}`} />
                        </>
                      )}
                    </button>

                    <div className="h-4 w-px bg-zinc-200 dark:bg-white/10 hidden sm:block mx-0.5" />

                    <button
                      onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
                      className="text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors p-1.5 sm:p-2 rounded-xl bg-zinc-100/80 dark:bg-zinc-900/80 border border-zinc-200/50 dark:border-white/5 shrink-0 flex items-center justify-center w-8 h-8 sm:w-9 sm:h-9"
                      title={theme === 'light' ? 'Activar modo oscuro' : 'Activar modo claro'}
                    >
                      {theme === 'light' ? <Moon className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> : <Sun className="w-3.5 h-3.5 sm:w-4 sm:h-4" />}
                    </button>
                    <button 
                      onClick={() => setShowNotificationCenter(true)}
                      className="relative text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors p-1.5 sm:p-2 rounded-xl bg-zinc-100/80 dark:bg-zinc-900/80 border border-zinc-200/50 dark:border-white/5 shrink-0 flex items-center justify-center w-8 h-8 sm:w-9 sm:h-9"
                      title="Notificaciones"
                    >
                      <Bell className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                      {unreadCount > 0 && (
                        <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-red-500 text-white text-[7px] font-black rounded-full flex items-center justify-center border-2 border-white dark:border-black animate-pulse-subtle">
                          {unreadCount}
                        </span>
                      )}
                    </button>
                    <button 
                      onClick={() => signOut(auth)}
                      className="text-zinc-400 hover:text-red-600 dark:hover:text-red-400 transition-colors p-1.5 sm:p-2 rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-100/50 dark:border-red-500/20 text-red-500 shrink-0 flex items-center justify-center w-8 h-8 sm:w-9 sm:h-9"
                      title="Cerrar Sesión"
                    >
                      <LogOut className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    </button>
                  </div>
                </div>

                {/* Mobile Sub-Header: Active Module Title & Time Bar */}
                <div className="md:hidden flex items-center justify-between pt-2 border-t border-zinc-100 dark:border-white/5 min-w-0">
                  <div className="flex items-center gap-1.5 min-w-0 flex-1 pr-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-sky-500 shrink-0" />
                    <h1 className="text-zinc-900 dark:text-white font-extrabold text-xs tracking-tight truncate">
                      {activeTab === 'Home' ? `¡Bienvenido ${user.name?.split(' ')[0] || user.name || 'Usuario'}!` : activeTab === 'OrdenLimpieza' ? 'Orden & Limpieza' : activeTab === 'History' ? 'Historial' : activeTab === 'Admin' ? 'Administración' : activeTab === 'Notifications' ? 'Notificaciones' : activeTab === 'PDFConfig' ? 'Configuración PDF' : 'Ayuda'}
                    </h1>
                    {isOffline && (
                      <span className="px-1.5 py-0.2 bg-red-50 dark:bg-red-500/10 border border-red-100 dark:border-red-500/20 text-red-600 dark:text-red-400 text-[8px] font-black uppercase rounded-full shrink-0">
                        Offline
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] text-zinc-400 dark:text-zinc-500 font-bold shrink-0">
                    {format(currentTime, "HH:mm:ss", { locale: es })}
                  </span>
                </div>

                {/* Expandable Weather Detail Drawer in Header */}
                <AnimatePresence>
                  {isWeatherExpanded && (
                    <motion.div
                      initial={{ opacity: 0, height: 0, y: -6 }}
                      animate={{ opacity: 1, height: 'auto', y: 0 }}
                      exit={{ opacity: 0, height: 0, y: -6 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden pt-2 pb-1 border-t border-sky-500/15"
                    >
                      <WeatherModule onClose={() => setIsWeatherExpanded(false)} />
                    </motion.div>
                  )}
                </AnimatePresence>
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
                    {user.role === 'Operador' ? (
                      <OperatorDashboard 
                        user={user} 
                        setActiveTab={setActiveTab} 
                        weather={weather}
                        loadingWeather={loadingWeather}
                        weatherError={weatherError}
                      />
                    ) : (
                      <SupervisorDashboard user={user} initialFindingId={pendingFindingId} onClearPending={() => setPendingFindingId(null)} />
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
                    <OrdenYLimpiezaDashboard user={user} initialFindingId={pendingFindingId} onClearPending={() => setPendingFindingId(null)} />
                  </motion.div>
                )}
                {activeTab === 'History' && (
                  <motion.div 
                    key="history"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                  >
                    <ReportsView user={user} initialFindingId={pendingFindingId} onClearPending={() => setPendingFindingId(null)} />
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

            {/* Mobile Navigation Dock */}
            <nav className="md:hidden fixed bottom-3 left-3 right-3 bg-white/95 dark:bg-zinc-900/95 border border-zinc-200/80 dark:border-white/10 rounded-2xl p-1.5 shadow-xl shadow-black/10 z-40 backdrop-blur-xl transition-all duration-200">
              <div className="flex items-center justify-around gap-1">
                {/* 1. Home VOSO */}
                <button 
                  onClick={() => { setActiveTab('Home'); setIsMobileMoreOpen(false); }}
                  className={`flex-1 py-2 px-1 rounded-xl flex flex-col items-center justify-center gap-1 transition-all ${
                    activeTab === 'Home' 
                      ? 'bg-gradient-to-r from-sky-600 to-blue-600 text-white shadow-md shadow-sky-500/25' 
                      : 'text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                  }`}
                >
                  <LayoutDashboard className="w-4 h-4 shrink-0" />
                  <span className="text-[9px] font-black uppercase tracking-wider leading-none">VOSO</span>
                </button>

                {/* 2. Orden & Limpieza */}
                <button 
                  onClick={() => { setActiveTab('OrdenLimpieza'); setIsMobileMoreOpen(false); }}
                  className={`flex-1 py-2 px-1 rounded-xl flex flex-col items-center justify-center gap-1 transition-all ${
                    activeTab === 'OrdenLimpieza' 
                      ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md shadow-purple-500/25' 
                      : 'text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                  }`}
                >
                  <Sparkles className="w-4 h-4 shrink-0" />
                  <span className="text-[9px] font-black uppercase tracking-wider leading-none">5S Limp.</span>
                </button>

                {/* 3. Historial */}
                <button 
                  onClick={() => { setActiveTab('History'); setIsMobileMoreOpen(false); }}
                  className={`flex-1 py-2 px-1 rounded-xl flex flex-col items-center justify-center gap-1 transition-all ${
                    activeTab === 'History' 
                      ? 'bg-gradient-to-r from-sky-600 to-blue-600 text-white shadow-md shadow-sky-500/25' 
                      : 'text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                  }`}
                >
                  <History className="w-4 h-4 shrink-0" />
                  <span className="text-[9px] font-black uppercase tracking-wider leading-none">Historial</span>
                </button>

                {/* 4. If Non-Admin -> Help */}
                {user.role !== 'Administrador' && (
                  <button 
                    onClick={() => { setActiveTab('Help'); setIsMobileMoreOpen(false); }}
                    className={`flex-1 py-2 px-1 rounded-xl flex flex-col items-center justify-center gap-1 transition-all ${
                      activeTab === 'Help' 
                        ? 'bg-gradient-to-r from-zinc-800 to-zinc-950 dark:from-zinc-100 dark:to-white text-white dark:text-zinc-950 shadow-md' 
                        : 'text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                    }`}
                  >
                    <HelpCircle className="w-4 h-4 shrink-0" />
                    <span className="text-[9px] font-black uppercase tracking-wider leading-none">Ayuda</span>
                  </button>
                )}

                {/* 4. If Admin -> More / Admin Sheet trigger */}
                {user.role === 'Administrador' && (
                  <button 
                    onClick={() => setIsMobileMoreOpen(!isMobileMoreOpen)}
                    className={`flex-1 py-2 px-1 rounded-xl flex flex-col items-center justify-center gap-1 transition-all relative ${
                      ['Admin', 'Notifications', 'PDFConfig', 'Help'].includes(activeTab) || isMobileMoreOpen
                        ? 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-950 shadow-md' 
                        : 'text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                    }`}
                  >
                    <div className="relative">
                      <Menu className="w-4 h-4 shrink-0" />
                      {unreadCount > 0 && (
                        <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full animate-ping" />
                      )}
                    </div>
                    <span className="text-[9px] font-black uppercase tracking-wider leading-none">Menú</span>
                  </button>
                )}
              </div>
            </nav>

            {/* Mobile "Más" Slide-Up Sheet for Admins / Extra links */}
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
                    <div className="flex items-center justify-between pb-3 border-b border-zinc-100 dark:border-zinc-900">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-black text-sm uppercase tracking-tight text-zinc-900 dark:text-white">Menú de Control</h3>
                          <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20">
                            {user.role}
                          </span>
                        </div>
                        <p className="text-[10px] text-zinc-400 font-semibold mt-0.5">Opciones avanzadas y configuración</p>
                      </div>
                      <button 
                        onClick={() => setIsMobileMoreOpen(false)}
                        className="p-2 rounded-full bg-zinc-100 dark:bg-zinc-900 text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-2.5">
                      <button 
                        onClick={() => { setShowProfileModal(true); setIsMobileMoreOpen(false); }}
                        className="p-3.5 rounded-2xl border text-left flex flex-col gap-2 transition-all bg-sky-50 dark:bg-sky-500/10 border-sky-200/60 dark:border-sky-500/20 text-zinc-800 dark:text-zinc-200 hover:bg-sky-100 dark:hover:bg-sky-500/20"
                      >
                        <UserCheck className="w-5 h-5 text-sky-500" />
                        <div>
                          <p className="text-xs font-extrabold uppercase tracking-tight">Mi Perfil</p>
                          <p className="text-[9px] opacity-70 font-medium leading-tight mt-0.5">Editar foto y datos personales</p>
                        </div>
                      </button>

                      <button 
                        onClick={() => { setActiveTab('Admin'); setIsMobileMoreOpen(false); }}
                        className={`p-3.5 rounded-2xl border text-left flex flex-col gap-2 transition-all ${
                          activeTab === 'Admin'
                            ? 'bg-brand-blue text-white border-brand-blue shadow-md'
                            : 'bg-zinc-50 dark:bg-zinc-900/60 border-zinc-200/60 dark:border-white/5 text-zinc-800 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                        }`}
                      >
                        <Users className="w-5 h-5 text-sky-500" />
                        <div>
                          <p className="text-xs font-extrabold uppercase tracking-tight">Administración</p>
                          <p className="text-[9px] opacity-70 font-medium leading-tight mt-0.5">Gestión de usuarios y plantas</p>
                        </div>
                      </button>

                      <button 
                        onClick={() => { setActiveTab('Notifications'); setIsMobileMoreOpen(false); }}
                        className={`p-3.5 rounded-2xl border text-left flex flex-col gap-2 transition-all relative ${
                          activeTab === 'Notifications'
                            ? 'bg-brand-blue text-white border-brand-blue shadow-md'
                            : 'bg-zinc-50 dark:bg-zinc-900/60 border-zinc-200/60 dark:border-white/5 text-zinc-800 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <Bell className="w-5 h-5 text-amber-500" />
                          {unreadCount > 0 && (
                            <span className="px-1.5 py-0.5 rounded-full bg-red-500 text-white text-[8px] font-black">
                              {unreadCount}
                            </span>
                          )}
                        </div>
                        <div>
                          <p className="text-xs font-extrabold uppercase tracking-tight">Notificaciones</p>
                          <p className="text-[9px] opacity-70 font-medium leading-tight mt-0.5">Mensajes del sistema</p>
                        </div>
                      </button>

                      <button 
                        onClick={() => { setActiveTab('PDFConfig'); setIsMobileMoreOpen(false); }}
                        className={`p-3.5 rounded-2xl border text-left flex flex-col gap-2 transition-all ${
                          activeTab === 'PDFConfig'
                            ? 'bg-brand-blue text-white border-brand-blue shadow-md'
                            : 'bg-zinc-50 dark:bg-zinc-900/60 border-zinc-200/60 dark:border-white/5 text-zinc-800 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                        }`}
                      >
                        <Shield className="w-5 h-5 text-emerald-500" />
                        <div>
                          <p className="text-xs font-extrabold uppercase tracking-tight">Config. PDF</p>
                          <p className="text-[9px] opacity-70 font-medium leading-tight mt-0.5">Encabezados e imágenes</p>
                        </div>
                      </button>

                      <button 
                        onClick={() => { setActiveTab('Help'); setIsMobileMoreOpen(false); }}
                        className={`p-3.5 rounded-2xl border text-left flex flex-col gap-2 transition-all ${
                          activeTab === 'Help'
                            ? 'bg-brand-blue text-white border-brand-blue shadow-md'
                            : 'bg-zinc-50 dark:bg-zinc-900/60 border-zinc-200/60 dark:border-white/5 text-zinc-800 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                        }`}
                      >
                        <HelpCircle className="w-5 h-5 text-indigo-500" />
                        <div>
                          <p className="text-xs font-extrabold uppercase tracking-tight">Ayuda</p>
                          <p className="text-[9px] opacity-70 font-medium leading-tight mt-0.5">Manuales e instructivos</p>
                        </div>
                      </button>
                    </div>

                    <div className="pt-2 flex items-center gap-2">
                      <button 
                        onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
                        className="flex-1 py-3 px-4 rounded-xl bg-zinc-100 dark:bg-zinc-900 text-zinc-800 dark:text-zinc-200 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 border border-zinc-200/50 dark:border-white/5"
                      >
                        {theme === 'light' ? <Moon className="w-4 h-4 text-indigo-500" /> : <Sun className="w-4 h-4 text-amber-500" />}
                        <span>Modo {theme === 'light' ? 'Oscuro' : 'Claro'}</span>
                      </button>

                      <button 
                        onClick={() => signOut(auth)}
                        className="flex-1 py-3 px-4 rounded-xl bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 border border-red-200/50 dark:border-red-500/20"
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
                      <div className="w-10 h-10 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-white flex-shrink-0">
                        <Smartphone className="w-5 h-5 text-emerald-400" />
                      </div>
                      <div>
                        <h4 className="font-extrabold text-xs tracking-wider text-zinc-100 uppercase">Instalar Checkify</h4>
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
                        <div className="w-10 h-10 rounded-xl bg-zinc-100 dark:bg-zinc-900 flex items-center justify-center text-zinc-900 dark:text-white flex-shrink-0">
                          <Smartphone className="w-5 h-5 text-emerald-500" />
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

            <ToastContainer toasts={toasts} setToasts={setToasts} />
          </div>
    </div>
  );
};
