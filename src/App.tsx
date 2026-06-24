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
  Layout,
  Box,
  Bell,
  FileText,
  MapPin,
  Send,
  Upload,
  Clock,
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
  BookOpen
} from 'lucide-react';

import { EquipmentService } from './services/EquipmentService';
import { FindingService } from './services/FindingService';
import { offlineQueueService } from './services/OfflineQueueService';
import { OfflineImage } from './components/OfflineImage';
import { useOfflineStatus } from './hooks/useOfflineStatus';
import { useHSECAnalytics } from './hooks/useHSECAnalytics';

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

const getFindingDate = (f: Finding | null): Date | null => {
  if (!f) return null;
  const d = f.date || f.createdAt;
  if (!d) return null;
  try {
    return d.toDate ? d.toDate() : (d instanceof Date ? d : new Date(d));
  } catch (err) {
    console.error("Error parsing date:", err);
    return null;
  }
};

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
  onUpdate: (id: string, status: any, comment?: string, photo?: string, solved?: boolean) => void,
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
                    <span className="text-[10px] font-black text-zinc-400 dark:text-zinc-600 uppercase tracking-widest leading-none">Punto de Control</span>
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
                    
                    <div className="flex items-center gap-3">
                      <input 
                        type="file" 
                        accept="image/*" 
                        capture="environment" 
                        className="hidden" 
                        id={`photo-${item.id}`}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            const reader = new FileReader();
                            reader.onloadend = async () => {
                              const base64 = reader.result as string;
                              try {
                                const compressed = await validateAndCompressImage(base64, 300, 300);
                                onUpdate(item.id, res.status, res.comment, compressed);
                              } catch (err: any) {
                                console.error("Checklist image validation error:", err);
                                alert(err.message || "Error al validar la imagen.");
                                e.target.value = ''; // Reset file input
                              }
                            };
                            reader.readAsDataURL(file);
                          }
                        }}
                      />
                      <button 
                        onClick={() => document.getElementById(`photo-${item.id}`)?.click()}
                        className="flex-1 py-3 bg-zinc-900 dark:bg-white text-white dark:text-black rounded-2xl text-[10px] font-bold flex items-center justify-center gap-2 active:scale-[0.98] transition-all shadow-lg shadow-zinc-200 dark:shadow-none"
                      >
                        <Camera className="w-4 h-4" />
                        CAPTURAR EVIDENCIA
                      </button>
                      {res?.photoUrl && (
                        <div className="w-12 h-12 rounded-xl overflow-hidden bg-zinc-100 dark:bg-zinc-800 border-2 border-white dark:border-white/20 shadow-sm dark:shadow-none flex-shrink-0 flex items-center justify-center">
                          <OfflineImage src={res.photoUrl} className="w-full h-full object-cover" />
                        </div>
                      )}
                    </div>
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

const OperatorDashboard = ({ user, setActiveTab }: { user: AppUser, setActiveTab?: (tab: 'Home' | 'History' | 'Admin' | 'Notifications' | 'PDFConfig') => void }) => {
  const [scanning, setScanning] = useState(false);
  const [selectedArea, setSelectedArea] = useState<Area | null>(null);
  const [areas, setAreas] = useState<Area[]>([]);
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [currentEquipmentIndex, setCurrentEquipmentIndex] = useState(0);
  const [showFindingForm, setShowFindingForm] = useState(false);
  const [message, setMessage] = useState<{ text: string, type: 'success' | 'error' } | null>(null);
  const [findingDescription, setFindingDescription] = useState('');
  const [findingPhoto, setFindingPhoto] = useState<string | null>(null);
  const [immediateSolution, setImmediateSolution] = useState('');
  const [isClosingImmediately, setIsClosingImmediately] = useState(false);
  const [formValidationError, setFormValidationError] = useState<string | null>(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successModalConfig, setSuccessModalConfig] = useState<{ title: string; message: string } | null>(null);

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
  
  const [checkItemStates, setCheckItemStates] = useState<Record<string, 'Bueno' | 'Regular' | 'Malo'>>({});
  const [vosoResponses, setVosoResponses] = useState<Record<string, VOSOResponse>>({});
  const [inspectionResults, setInspectionResults] = useState<Record<string, { trad: any, voso: any }>>({});
  const [showEquipmentSummary, setShowEquipmentSummary] = useState(false);
  
  // Tracking inspection times
  const [inspectionStartTime, setInspectionStartTime] = useState<Date | null>(null);
  const [equipmentStartTime, setEquipmentStartTime] = useState<Date | null>(null);

  // Scroll back to the top of the view when the equipment index, selected area, or summary state changes
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [currentEquipmentIndex, selectedArea?.id, showEquipmentSummary]);

  // Removed problematic useEffect that caused data mismatch
  
  const resetInspectionState = () => {
    setSelectedArea(null);
    setInspectionStartTime(null);
    setCurrentEquipmentIndex(0);
    setInspectionResults({});
    setCheckItemStates({});
    setVosoResponses({});
    setShowEquipmentSummary(false);
  };
  
  const saveCurrentToResults = () => {
    if (currentEquipment) {
      const currentData = {
        trad: { ...checkItemStates },
        voso: { ...vosoResponses }
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
    } else {
      setCheckItemStates({});
      setVosoResponses({});
    }
  };

  const handleSetItemState = (itemId: string, state: 'Bueno' | 'Regular' | 'Malo') => {
    setCheckItemStates(prev => ({ ...prev, [itemId]: state }));
  };

   const handleSetVOSOResponse = (itemId: string, status: any, comment?: string, photo?: string, solved?: boolean) => {
    setVosoResponses(prev => {
      const current = prev[itemId] || { status: 'OK' };
      return {
        ...prev,
        [itemId]: {
          ...current,
          status,
          comment: comment !== undefined ? comment : (current.comment ?? null),
          photoUrl: photo !== undefined ? photo : (current.photoUrl ?? null),
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
      ...(voso.oler || [])
    ].every(item => vosoResponses[item.id]?.status);

    return tradChecked && vosoChecked;
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
    }, (error) => {
      console.error("Error listening to areas:", error);
    });

    // Listen for equipment
    const unsubEquip = onSnapshot(collection(db, 'equipment'), (snapshot) => {
      setEquipment(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Equipment)));
    }, (error) => {
      console.error("Error listening to equipment:", error);
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
            setSelectedArea(area);
            setInspectionStartTime(new Date());
            setEquipmentStartTime(new Date());
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
    const now = new Date();
    const currentData = {
      trad: { ...checkItemStates },
      voso: { ...vosoResponses },
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
      // Load next equipment data (or empty if new)
      const nextIndex = currentEquipmentIndex + 1;
      const nextEquip = areaEquipment[nextIndex];
      const nextSaved = updatedResults[nextEquip.id] as { trad: any, voso: any, timing: any } | undefined;
      setCheckItemStates(nextSaved?.trad || {});
      setVosoResponses(nextSaved?.voso || {});
      setCurrentEquipmentIndex(nextIndex);
      setEquipmentStartTime(new Date());
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
        const totalDurationSeconds = inspectionStartTime ? Math.round((inspectionCompletedTime.getTime() - inspectionStartTime.getTime()) / 1000) : 0;

        const inspectionId = doc(collection(db, 'inspections')).id;
        const isOnline = offlineQueueService.getConnectivityStatus();

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
          results: updatedResults
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
          const res = resAny as { trad: any, voso: any, timing?: { startedAt: any, completedAt: any } };
          const equip = equipment.find(e => e.id === equipId);
          
          const equipStarted = res?.timing?.startedAt instanceof Date ? res.timing.startedAt : (res?.timing?.startedAt?.toDate ? res.timing.startedAt.toDate() : null);
          const equipCompleted = res?.timing?.completedAt instanceof Date ? res.timing.completedAt : (res?.timing?.completedAt?.toDate ? res.timing.completedAt.toDate() : null);
          const equipDuration = (equipStarted && equipCompleted) ? Math.round((equipCompleted.getTime() - equipStarted.getTime()) / 1000) : 0;

          const resTrad = res?.trad || {};
          const resVoso = res?.voso || {};

          const tradIssues = Object.entries(resTrad).filter(([_, s]) => s !== 'Bueno');
          const vosoIssues = (Object.entries(resVoso) as [string, VOSOResponse][]).filter(([_, v]) => v && (v.status === 'Observación' || v.status === 'Crítico'));

          if (tradIssues.length > 0 || vosoIssues.length > 0) {
            let description = `Inspección VOSO en ${equip?.name || equipId}.\n\n`;
            
            if (vosoIssues.length > 0) {
              description += "🚨 HALLAZGOS VOSO:\n";
              vosoIssues.forEach(([id, v]) => {
                const ver = equip?.inspeccionVOSO?.ver || [];
                const oir = equip?.inspeccionVOSO?.oir || [];
                const sentir = equip?.inspeccionVOSO?.sentir || [];
                const oler = equip?.inspeccionVOSO?.oler || [];
                const orden = equip?.inspeccionVOSO?.orden || [];

                let icon = "🔍";
                let categoryName = "GENERAL";
                if (ver.some(i => i.id === id)) { icon = "👁️"; categoryName = "VER"; }
                else if (oir.some(i => i.id === id)) { icon = "👂"; categoryName = "OÍR"; }
                else if (sentir.some(i => i.id === id)) { icon = "🖐️"; categoryName = "SENTIR"; }
                else if (oler.some(i => i.id === id)) { icon = "👃"; categoryName = "OLER"; }
                else if (orden.some(i => i.id === id)) { icon = "✨"; categoryName = "ORDEN"; }

                const allVOSO = [...ver, ...oir, ...sentir, ...oler, ...orden];
                const item = allVOSO.find(i => i.id === id);
                description += `${icon} [${categoryName}] ${item?.name || id}: ${v.status}${v.comment ? ` - ${v.comment}` : ''}${v.solvedByOperator ? ' [SOLUCIONADO]' : ''}\n`;
              });
            }

            if (tradIssues.length > 0) {
              description += "\n📋 OTROS PUNTOS:\n";
              tradIssues.forEach(([id, s]) => {
                const item = equip?.checkItems?.find(i => id === id);
                description += `• ${item?.name || id}: ${s}\n`;
              });
            }

            const priority = vosoIssues.some(v => v[1]?.status === 'Crítico') ? 'Alta' : 'Media';
            const firstPhoto = vosoIssues.find(v => v[1]?.photoUrl)?.[1]?.photoUrl || null;

            const resultObj = await FindingService.createFinding({
              areaId: selectedArea!.id,
              areaName: selectedArea!.name,
              plantId: selectedArea!.plantId || user.plantId || 'default-plant',
              equipmentId: equipId,
              equipmentName: equip?.name || null,
              description: description,
              status: vosoIssues.every(v => v[1]?.solvedByOperator) && tradIssues.length === 0 ? 'Closed' : 'Open',
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
              source: 'Inspection',
              history: [
                {
                  status: (vosoIssues.every(v => v[1]?.solvedByOperator) && tradIssues.length === 0 ? 'Closed' : 'Open') as any,
                  userId: user.uid,
                  userName: user.name || user.email,
                  timestamp: new Date().toISOString(),
                  action: 'Hallazgo autogenerado (Inspección VOSO)',
                  comment: 'Hallazgo detectado durante la inspección de ruta.'
                } as any
              ]
            }, firstPhoto);

            const findingRef = { id: resultObj.id };

            const notificationId = doc(collection(db, 'notifications')).id;
            const notificationPayload = {
              id: notificationId,
              title: 'Nuevo Hallazgo VOSO',
              message: `${user.name || user.email} ha reportado hallazgos en ${equip?.name || equipId}`,
              type: 'Finding',
              targetRole: 'Supervisor',
              scheduledAt: isOnline ? serverTimestamp() : new Date(),
              status: 'Sent',
              createdBy: user.uid,
              createdAt: isOnline ? serverTimestamp() : new Date(),
              referenceId: findingRef.id,
              plantId: selectedArea!.plantId || user.plantId || 'default-plant'
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
    const findingData = {
      areaId: selectedArea.id,
      areaName: selectedArea.name,
      equipmentId: currentEquipment?.id || null,
      equipmentName: currentEquipment?.name || null,
      plantId: selectedArea.plantId || user.plantId || 'default-plant',
      operatorId: user.uid,
      operatorName: user.name || user.email || 'Operador',
      description: findingDescription,
      status: isClosingImmediately ? 'Closed' : 'Open' as any,
      solution: isClosingImmediately ? immediateSolution : '',
      closedBy: isClosingImmediately ? user.uid : null,
      closedAt: isClosingImmediately ? new Date() : null,
      inspectionStartedAt: inspectionStartTime ? Timestamp.fromDate(inspectionStartTime) : Timestamp.now(),
      inspectionCompletedAt: Timestamp.now(),
      date: new Date(),
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
      const resultObj = await FindingService.createFinding(findingData, findingPhoto);
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
      setFindingPhoto(null);
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

      {!selectedArea && !scanning && (
        <div className="space-y-4">
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={startScanner}
            className="w-full aspect-square max-w-md mx-auto bg-white dark:bg-black border-2 border-dashed border-zinc-200 dark:border-white/20 rounded-3xl flex flex-col items-center justify-center gap-4 hover:border-zinc-900 dark:hover:border-white transition-colors group"
          >
            <div className="w-20 h-20 bg-zinc-50 dark:bg-zinc-900 rounded-full flex items-center justify-center group-hover:bg-zinc-900 dark:group-hover:bg-white transition-colors">
              <QrCode className="w-10 h-10 text-zinc-400 dark:text-zinc-500 group-hover:text-white dark:group-hover:text-black" />
            </div>
            <span className="text-zinc-500 dark:text-zinc-400 font-medium group-hover:text-brand-blue dark:group-hover:text-white transition-colors text-center px-4 uppercase tracking-tight text-xs">Escanear Código QR de Área</span>
          </motion.button>
          
          <div className="max-w-md mx-auto">
            <p className="text-center text-xs font-bold text-zinc-400 dark:text-zinc-600 uppercase tracking-widest mb-3">O selecciona manualmente</p>
            <div className="grid gap-2">
              {areas.length > 0 ? (
                areas.slice(0, 3).map((area, idx) => (
                  <button 
                    key={`quick-${area.id}-${idx}`}
                    onClick={() => {
                      setSelectedArea(area);
                      setInspectionStartTime(new Date());
                      setEquipmentStartTime(new Date());
                    }}
                    className="w-full p-4 bg-white dark:bg-black border border-zinc-100 dark:border-white/20 rounded-2xl flex items-center justify-between hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors shadow-sm dark:shadow-none"
                  >
                    <span className="font-bold text-zinc-900 dark:text-white tracking-tight">{area.name}</span>
                    <Plus className="w-4 h-4 text-zinc-400 dark:text-zinc-600" />
                  </button>
                ))
              ) : (
                <p className="text-center text-sm text-zinc-400 dark:text-zinc-600 py-4 bg-zinc-50 dark:bg-black rounded-2xl border border-dashed border-zinc-200 dark:border-white/10 italic">
                  Cargando áreas...
                </p>
              )}
              {areas.length > 3 && (
                 <button 
                   onClick={() => setSearchingArea(true)}
                   className="text-center text-zinc-400 text-xs font-bold py-2 hover:text-zinc-900 transition-colors"
                 >
                   Ver todas las áreas ({areas.length})
                 </button>
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
                      a.name.toLowerCase().includes(areaSearchQuery.toLowerCase()) || 
                      a.id.toLowerCase().includes(areaSearchQuery.toLowerCase()) ||
                      (a as any).qrCode?.toLowerCase().includes(areaSearchQuery.toLowerCase())
                    )
                    .map((area, idx) => (
                      <button 
                        key={`search-area-${area.id}-${idx}`}
                        onClick={() => {
                          setSelectedArea(area);
                          setInspectionStartTime(new Date());
                          setEquipmentStartTime(new Date());
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

      {scanning && (
        <div className="relative">
          <div id="reader" className="overflow-hidden rounded-3xl border-2 border-zinc-900"></div>
          <button 
            onClick={stopScanner}
            className="absolute top-4 right-4 bg-white/80 backdrop-blur p-2 rounded-full shadow-lg dark:shadow-none z-10"
          >
            <X className="w-6 h-6" />
          </button>
        </div>
      )}

      {selectedArea && !showFindingForm && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white dark:bg-black rounded-3xl p-4 sm:p-6 border border-zinc-100 dark:border-white/10 shadow-sm dark:shadow-none space-y-6"
        >
          <div className="flex items-center justify-between border-b border-zinc-50 dark:border-white/5 pb-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-gradient-to-br from-brand-blue to-brand-green rounded-2xl flex items-center justify-center shadow-md dark:shadow-none">
                <MapPin className="text-white w-6 h-6" />
              </div>
              <div>
                <p className="text-xs font-medium text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">Área Seleccionada</p>
                <h3 className="text-xl font-bold text-zinc-900 dark:text-white">{selectedArea.name}</h3>
              </div>
            </div>
            <button onClick={() => setSelectedArea(null)} className="p-2 bg-zinc-50 dark:bg-zinc-900 text-zinc-400 dark:text-zinc-500 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="space-y-8">
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
            
            <div className="p-10 bg-zinc-900 dark:bg-zinc-950/40 border border-transparent dark:border-white/10 rounded-[3.5rem] text-white shadow-2xl dark:shadow-none relative overflow-hidden group">
               <div className="absolute top-0 right-0 w-80 h-80 bg-brand-blue/20 rounded-full -mr-32 -mt-32 blur-[100px] group-hover:bg-brand-green/20 transition-all duration-1000" />
               <div className="relative z-10">
                 <div className="flex items-center gap-4 mb-6">
                    <div className="px-4 py-1.5 bg-white/10 backdrop-blur-md rounded-full border border-white/10 text-[10px] font-black uppercase tracking-[0.3em] text-sky-400">
                      {areaEquipment.length > 0 ? 'Ruta de Inspección' : 'Área sin equipos'}
                    </div>
                 </div>

                 <h2 className="text-5xl font-black tracking-tighter mb-6 leading-none text-white">
                    {currentEquipment?.name || selectedArea.name}
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
                 </div>
               </div>
            </div>

            {areaEquipment.length > 0 && (
              <div className="space-y-4 bg-zinc-50/50 dark:bg-black/20 p-6 rounded-[2.5rem] border border-zinc-100 dark:border-white/5 shadow-sm dark:shadow-none">
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
                <h4 className="text-[10px] font-bold text-zinc-400 uppercase tracking-[0.2em] px-1">Puntos de Revisión</h4>
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
                className={`w-full py-6 rounded-3xl font-bold flex items-center justify-center gap-3 transition-all border ${
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
          <h3 className="text-xl font-bold text-zinc-900">Detalle del Hallazgo</h3>
          
          <div className="space-y-4">
            <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100">
               <p className="text-[10px] font-bold text-amber-600 uppercase tracking-widest mb-1">Equipo afectado</p>
               <p className="font-bold text-amber-900">{currentEquipment?.name || 'Área General'}</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">Descripción</label>
              <textarea 
                value={findingDescription}
                onChange={(e) => setFindingDescription(e.target.value)}
                className="w-full p-4 bg-zinc-50 border border-zinc-200 rounded-2xl focus:ring-2 focus:ring-zinc-900 focus:border-transparent outline-none transition-all min-h-[100px]"
                placeholder="¿Qué problema encontraste?"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">Foto del Hallazgo</label>
              <div className="flex items-center gap-4">
                <input 
                  type="file" 
                  accept="image/*" 
                  capture="environment"
                  id="findingPhotoInput"
                  className="hidden" 
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      setFormValidationError(null);
                      const reader = new FileReader();
                      reader.onloadend = async () => {
                        const base64 = reader.result as string;
                        try {
                          const compressed = await validateAndCompressImage(base64, 300, 300);
                          setFindingPhoto(compressed);
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
                <label 
                  htmlFor="findingPhotoInput"
                  className="w-20 h-20 bg-zinc-50 border border-zinc-200 rounded-2xl flex items-center justify-center text-zinc-400 hover:text-brand-blue hover:border-brand-blue cursor-pointer transition-all active:scale-95"
                >
                  <Camera className="w-8 h-8" />
                </label>
                {findingPhoto && (
                  <div className="relative group">
                    <img src={findingPhoto} className="w-20 h-20 object-cover rounded-2xl border border-zinc-200" alt="Preview" />
                    <button 
                      onClick={() => setFindingPhoto('')}
                      className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow-lg dark:shadow-none opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                )}
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
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">{currentEquipment.name}</p>
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
              
              <div className="flex flex-col sm:flex-row gap-2 pt-2">
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
            </motion.div>
          </div>
        )}
      </AnimatePresence>
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

  const hsecStats = useHSECAnalytics(findings);

  const filteredByDate = findings.filter(f => {
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

  return (
    <div className="space-y-6">
      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Compliance Card */}
        <div className="bg-white dark:bg-zinc-950 p-5 rounded-3xl border border-zinc-100 dark:border-white/10 shadow-sm dark:shadow-none space-y-2">
          <div className="flex items-center justify-between text-zinc-400">
            <span className="text-[10px] font-bold uppercase tracking-wider">Cumplimiento</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold tracking-tight dark:text-white">{hsecStats.complianceRate}%</span>
            <span className="text-[10px] font-bold text-emerald-500">Cerrados + Revisión</span>
          </div>
          <p className="text-[10px] text-zinc-400 dark:text-zinc-500">Indicador clave de mitigación de riesgos en terreno.</p>
        </div>

        {/* MTTR Card */}
        <div className="bg-white dark:bg-zinc-950 p-5 rounded-3xl border border-zinc-100 dark:border-white/10 shadow-sm dark:shadow-none space-y-2">
          <div className="flex items-center justify-between text-zinc-400">
            <span className="text-[10px] font-bold uppercase tracking-wider">Tiempo de Cierre</span>
            <Clock className="w-4 h-4 text-sky-500" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold tracking-tight dark:text-white">{hsecStats.meanTimeToResolutionHours}h</span>
            <span className="text-[10px] font-bold text-sky-500">Horas promedio</span>
          </div>
          <p className="text-[10px] text-zinc-400 dark:text-zinc-500">Tiempo medio para resolver un hallazgo de terreno.</p>
        </div>

        {/* High Priority count */}
        <div className="bg-white dark:bg-zinc-950 p-5 rounded-3xl border border-zinc-100 dark:border-white/10 shadow-sm dark:shadow-none space-y-2">
          <div className="flex items-center justify-between text-zinc-400">
            <span className="text-[10px] font-bold uppercase tracking-wider">Hallazgos Críticos</span>
            <AlertTriangle className="w-4 h-4 text-red-500" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold tracking-tight dark:text-white">
              {hsecStats.findingsByPriority.find(p => p.name.includes('Alta'))?.value || 0}
            </span>
            <span className="text-[10px] font-bold text-red-500">Prioridad Alta</span>
          </div>
          <p className="text-[10px] text-zinc-400 dark:text-zinc-500">Amenazas activas que requieren acción inmediata.</p>
        </div>

        {/* Total stats */}
        <div className="bg-white dark:bg-zinc-950 p-5 rounded-3xl border border-zinc-100 dark:border-white/10 shadow-sm dark:shadow-none space-y-2">
          <div className="flex items-center justify-between text-zinc-400">
            <span className="text-[10px] font-bold uppercase tracking-wider">Total Histórico</span>
            <FileText className="w-4 h-4 text-brand-blue" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold tracking-tight dark:text-white">{hsecStats.totalFindings}</span>
            <span className="text-[10px] font-bold text-zinc-500">Reportados</span>
          </div>
          <p className="text-[10px] text-zinc-400 dark:text-zinc-500">Registros consolidados de riesgos en planta.</p>
        </div>
      </div>

      {/* Main Charts area */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Core Bar Chart */}
        <div className="lg:col-span-2 bg-white dark:bg-black rounded-3xl p-5 border border-zinc-100 dark:border-white/10 shadow-sm dark:shadow-none space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-zinc-900 dark:text-white" />
              <h3 className="font-bold text-xs text-zinc-900 dark:text-white uppercase tracking-wider">Frecuencia de Hallazgos</h3>
            </div>
            <div className="flex items-center gap-1.5 bg-zinc-100 dark:bg-zinc-900 p-1 rounded-xl">
              <button 
                onClick={() => setGroupBy('area')}
                className={`px-3 py-1 rounded-lg text-[9px] font-bold uppercase tracking-wider transition-all ${groupBy === 'area' ? 'bg-white dark:bg-black text-zinc-900 dark:text-white shadow-xs' : 'text-zinc-500'}`}
              >
                Por Área
              </button>
              <button 
                onClick={() => setGroupBy('operador')}
                className={`px-3 py-1 rounded-lg text-[9px] font-bold uppercase tracking-wider transition-all ${groupBy === 'operador' ? 'bg-white dark:bg-black text-zinc-900 dark:text-white shadow-xs' : 'text-zinc-500'}`}
              >
                Por Operador
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pb-2 border-b border-zinc-50 dark:border-white/5">
            <div className="space-y-1">
              <label className="text-[9px] font-bold text-zinc-400 dark:text-zinc-600 uppercase ml-1">Desde</label>
              <div className="relative">
                <CalendarIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400 dark:text-zinc-600" />
                <input 
                  type="date" 
                  value={dateRange.start}
                  onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                  className="w-full pl-9 pr-4 py-2 bg-zinc-50 dark:bg-zinc-900 border border-zinc-100 dark:border-white/5 rounded-xl text-xs outline-none focus:ring-2 focus:ring-brand-blue font-bold dark:text-white"
                />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-[9px] font-bold text-zinc-400 dark:text-zinc-600 uppercase ml-1">Hasta</label>
              <div className="relative">
                <CalendarIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400 dark:text-zinc-600" />
                <input 
                  type="date" 
                  value={dateRange.end}
                  onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                  className="w-full pl-9 pr-4 py-2 bg-zinc-50 dark:bg-zinc-900 border border-zinc-100 dark:border-white/5 rounded-xl text-xs outline-none focus:ring-2 focus:ring-brand-blue font-bold dark:text-white"
                />
              </div>
            </div>
          </div>

          <div className="h-64 w-full">
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
                    borderRadius: '16px', 
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

        {/* Dynamic vulnerable areas list & leaderboard */}
        <div className="bg-white dark:bg-zinc-950 p-5 rounded-3xl border border-zinc-100 dark:border-white/10 shadow-sm dark:shadow-none flex flex-col justify-between gap-6">
          {/* Areas Section */}
          <div className="space-y-3">
            <div className="flex items-center gap-1.5 border-b border-zinc-100 dark:border-white/5 pb-2">
              <Compass className="w-3.5 h-3.5 text-zinc-400" />
              <h4 className="font-bold text-[10px] text-zinc-900 dark:text-white uppercase tracking-wider">Hotspots de Riesgo</h4>
            </div>

            {hsecStats.vulnerableAreas.length === 0 ? (
              <p className="text-xs text-zinc-400 dark:text-zinc-600 py-4 text-center">Planta sin incidencias activas registradas.</p>
            ) : (
              <div className="space-y-2">
                {hsecStats.vulnerableAreas.map((area, index) => (
                  <div key={`vln-${index}`} className="flex items-center justify-between text-xs">
                    <span className="font-medium text-zinc-700 dark:text-zinc-300 truncate max-w-[150px]">{area.name}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono font-extrabold bg-zinc-50 dark:bg-zinc-900/60 text-zinc-500 dark:text-zinc-400 px-1.5 py-0.5 rounded-md">
                        {area.count}
                      </span>
                      <span className={`w-1.5 h-1.5 rounded-full ${
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
          <div className="space-y-3">
            <div className="flex items-center gap-1.5 border-b border-zinc-100 dark:border-white/5 pb-2">
              <Activity className="w-3.5 h-3.5 text-zinc-400" />
              <h4 className="font-bold text-[10px] text-zinc-900 dark:text-white uppercase tracking-wider">Aporte Operacional</h4>
            </div>

            {hsecStats.operatorLeaderboard.length === 0 ? (
              <p className="text-xs text-zinc-400 dark:text-zinc-600 py-4 text-center font-medium">Buscando contribuciones de operadores...</p>
            ) : (
              <div className="space-y-2">
                {hsecStats.operatorLeaderboard.map((op, index) => (
                  <div key={`ldr-${index}`} className="flex items-center justify-between text-xs">
                    <span className="font-medium text-zinc-600 dark:text-zinc-400 truncate max-w-[140px]">{op.name}</span>
                    <div className="flex items-center gap-3 text-[10px] font-bold text-zinc-400">
                      <span>R: <b className="text-zinc-700 dark:text-zinc-200">{op.reportsCount}</b></span>
                      <span>C: <b className="text-emerald-500">{op.resolvedCount}</b></span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
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
  
  // Advanced Filter States
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [operatorFilter, setOperatorFilter] = useState('All');

  const [searchTerm, setSearchTerm] = useState('');

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

  // Extract unique operators for the filter dropdown
  const uniqueOperators = React.useMemo(() => {
    const operators = findings.map(f => f.operatorName).filter(Boolean);
    return Array.from(new Set(operators)).sort();
  }, [findings]);

  const filteredFindings = findings.filter(f => {
    const matchesFilter = filter === 'All' || f.status === filter;
    
    const matchesSearch = f.description.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          f.areaName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          f.operatorName?.toLowerCase().includes(searchTerm.toLowerCase());
    
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
      matchesDate = false; // "Recién" findings won't match fixed date filters usually
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
    const resultStatus = await FindingService.transitionStatus(selectedFinding.id, 'Closed', user, supervisorComments);
    
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
    
    if (resultStatus.queued) {
      alert("Cierre registrado localmente en cola offline. Se sincronizará al recuperar señal.");
    } else {
      alert("Hallazgo cerrado exitosamente");
    }
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
      alert("Estado 'En Revisión' encolado localmente.");
    } else {
      alert("Hallazgo marcado como En Revisión");
    }
  };

  const handleDeleteFinding = async () => {
    if (!selectedFinding) return;
    
    try {
      await deleteDoc(doc(db, 'findings', selectedFinding.id));
      setSelectedFinding(null);
      setIsConfirmingDelete(false);
    } catch (err) {
      console.error("Error deleting finding:", err);
      alert("Error al eliminar el hallazgo. Revisa tus permisos de administrador.");
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <h2 className="text-2xl font-bold text-zinc-900 dark:text-white tracking-tight uppercase">Panel de Hallazgos</h2>
        </div>

        {/* Global Statistics (Fixed) */}
        <SupervisorStats findings={findings} />

        {/* Advanced Filters Panel (Fixed) */}
        <div className="bg-white dark:bg-zinc-900 p-6 rounded-3xl border border-zinc-100 dark:border-white/10 shadow-sm dark:shadow-none space-y-4 mb-4">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-bold text-zinc-900 dark:text-white uppercase tracking-widest">Filtros Avanzados</h4>
            <button onClick={clearFilters} className="text-[10px] font-bold text-zinc-400 hover:text-zinc-900 dark:hover:text-white uppercase tracking-widest transition-colors">
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
                    <h4 className="font-bold text-zinc-900 dark:text-white uppercase tracking-tight leading-tighter">{finding.areaName}</h4>
                    <p className="text-[10px] font-black text-zinc-400 dark:text-zinc-600 uppercase tracking-widest mt-0.5">
                      {getFindingDate(finding) ? format(getFindingDate(finding)!, 'EEE dd MMM, HH:mm', { locale: es }) : 'Recién'}
                    </p>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-zinc-300 dark:text-zinc-800 group-hover:text-zinc-900 dark:group-hover:text-white transition-colors" />
              </div>
              <p className="text-sm text-zinc-600 dark:text-zinc-400 line-clamp-2 font-medium">{finding.description}</p>
              <div className="mt-4 pt-3 border-t border-zinc-50 dark:border-white/5 flex items-center justify-between gap-4">
                <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400 dark:text-zinc-600 truncate flex-1">Por: {finding.operatorName}</span>
                {finding.photoUrl && (
                  <div className="w-12 h-12 rounded-xl bg-zinc-900 dark:bg-zinc-800 overflow-hidden shrink-0 shadow-sm dark:shadow-none border border-zinc-100 dark:border-white/10">
                    <OfflineImage src={finding.photoUrl} className="w-full h-full object-contain" alt="" />
                  </div>
                )}
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
              <div className="min-h-[200px] max-h-[400px] sm:max-h-none sm:h-auto sm:w-1/2 shrink-0 relative bg-zinc-900 dark:bg-black flex items-center justify-center">
                <OfflineImage 
                  src={selectedFinding.photoUrl} 
                  className="w-full h-full object-contain" 
                  alt="Finding" 
                  referrerPolicy="no-referrer" 
                />
                <button 
                  onClick={() => setSelectedFinding(null)}
                  className="absolute top-4 right-4 bg-white/80 dark:bg-black/60 backdrop-blur p-2 rounded-full hover:bg-white dark:hover:bg-black transition-colors shadow-md dark:shadow-none z-10 border border-transparent dark:border-white/10"
                >
                  <X className="w-5 h-5 dark:text-white" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-6 sm:p-10 space-y-6 custom-scrollbar dark:bg-zinc-950/20">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest ${
                      selectedFinding.status === 'Open' ? 'bg-amber-100 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400' : 
                      selectedFinding.status === 'InReview' ? 'bg-orange-100 dark:bg-orange-500/10 text-orange-700 dark:text-orange-400' :
                      'bg-emerald-100 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                    }`}>
                      {selectedFinding.status === 'Open' ? 'Abierto' : 
                       selectedFinding.status === 'InReview' ? 'En Revisión' : 
                       'Cerrado'}
                    </span>
                    <span className="text-[10px] font-black text-zinc-400 dark:text-zinc-600 uppercase tracking-widest leading-none">{selectedFinding.areaName}</span>
                  </div>
                  <h3 className="text-2xl font-black text-zinc-900 dark:text-white uppercase tracking-tight leading-tighter">{selectedFinding.description}</h3>
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
                    {selectedFinding.supervisorComments && (
                      <div>
                        <p className="text-[10px] font-black text-zinc-400 dark:text-zinc-600 uppercase tracking-widest">Comentarios de Supervisión</p>
                        <p className="text-zinc-700 dark:text-zinc-400 italic">"{selectedFinding.supervisorComments}"</p>
                      </div>
                    )}
                  </div>
                )}

                {user.role === 'Administrador' && (
                  <div className="pt-4 border-t border-zinc-100">
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

const VOSO_COLORS: Record<string, string> = {
  'VER': 'bg-sky-500/10 text-sky-600 border-sky-200/50',
  'OÍR': 'bg-indigo-500/10 text-indigo-600 border-indigo-200/50',
  'SENTIR': 'bg-emerald-500/10 text-emerald-600 border-emerald-200/50',
  'OLER': 'bg-orange-500/10 text-orange-600 border-orange-200/50',
  'ORDEN': 'bg-purple-500/10 text-purple-600 border-purple-200/50'
};

const FindingDescriptionRenderer = ({ description, className = "", isPreview = false }: { description: string, className?: string, isPreview?: boolean }) => {
  if (!description) return <p className={className}>-</p>;

  const cleanDescription = (desc: string) => desc.replace('Reporte autogenerado de ', '').replace('Inspección VOSO en ', '');

  if (isPreview) {
    // Return a simplified version for lists
    return <span className={`truncate block ${className}`}>{cleanDescription(description.split('\n')[0])}</span>;
  }

  // Check if it's an autogenerated or VOSO inspection report
  if (description.startsWith('Reporte autogenerado') || description.startsWith('Inspección VOSO')) {
    const sections = description.split('\n\n');
    const header = sections[0];
    const rest = sections.slice(1).join('\n\n');
    
    // Parse VOSO items and Otros items
    const vosoPart = rest.match(/🚨 HALLAZGOS VOSO:\n([\s\S]*?)(?=\n(\n)?📋 OTROS PUNTOS:|$)/);
    const tradPart = rest.match(/📋 OTROS PUNTOS:\n([\s\S]*)/);

    const vosoLines = vosoPart ? vosoPart[1].split('\n').filter(l => l.trim()) : [];
    const criticalCount = vosoLines.filter(l => l.includes('Crítico')).length;
    const observationCount = vosoLines.filter(l => l.includes('Observación')).length;

    return (
      <div className={`space-y-8 ${className}`}>
        {/* Header - Location */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 bg-zinc-900 p-4 sm:p-6 rounded-[2rem] sm:rounded-[2.5rem] shadow-xl dark:shadow-none relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-48 h-48 bg-sky-500/10 rounded-full -mr-24 -mt-24 blur-3xl opacity-50" />
          <div className="w-14 h-14 rounded-2xl bg-white/10 flex items-center justify-center flex-shrink-0 backdrop-blur-md border border-white/20 shadow-inner dark:shadow-none">
            <LayoutDashboard className="w-8 h-8 text-sky-400" />
          </div>
          <div className="relative z-10 flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2 py-0.5 bg-sky-500/20 text-sky-300 text-[9px] font-black uppercase tracking-widest rounded-md border border-sky-500/30">Reporte de Inspección</span>
              <span className="w-1 h-1 rounded-full bg-zinc-700" />
              <span className="text-zinc-500 text-[10px] font-bold">VOSO Professional v2</span>
            </div>
            <h4 className="text-white font-black text-xl leading-tight tracking-tight uppercase">{cleanDescription(header)}</h4>
          </div>
        </div>

        {/* Summary Dashboard */}
        {(criticalCount > 0 || observationCount > 0) && (
          <div className="grid grid-cols-2 gap-3 sm:gap-4">
            <div className={`p-4 rounded-3xl border-2 flex flex-col items-center justify-center text-center transition-all ${criticalCount > 0 ? 'bg-red-50 border-red-100' : 'bg-zinc-50 border-zinc-100 opacity-50'}`}>
              <div className={`w-10 h-10 rounded-full flex items-center justify-center mb-2 ${criticalCount > 0 ? 'bg-red-500 text-white shadow-lg shadow-red-100 dark:shadow-none' : 'bg-zinc-200 text-zinc-400 dark:bg-zinc-800'}`}>
                <AlertCircle className="w-6 h-6" />
              </div>
              <p className={`text-2xl font-black ${criticalCount > 0 ? 'text-red-600' : 'text-zinc-400'}`}>{criticalCount}</p>
              <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Críticos</p>
            </div>
            <div className={`p-4 rounded-3xl border-2 flex flex-col items-center justify-center text-center transition-all ${observationCount > 0 ? 'bg-amber-50 border-amber-100' : 'bg-zinc-50 border-zinc-100 opacity-50'}`}>
              <div className={`w-10 h-10 rounded-full flex items-center justify-center mb-2 ${observationCount > 0 ? 'bg-amber-500 text-white shadow-lg shadow-amber-100 dark:shadow-none' : 'bg-zinc-200 text-zinc-400 dark:bg-zinc-800'}`}>
                <AlertTriangle className="w-6 h-6" />
              </div>
              <p className={`text-2xl font-black ${observationCount > 0 ? 'text-amber-600' : 'text-zinc-400'}`}>{observationCount}</p>
              <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Observaciones</p>
            </div>
          </div>
        )}
        
        {vosoPart && (
          <div className="space-y-4">
            <div className="flex items-center justify-between px-1">
              <h5 className="text-[11px] font-black text-zinc-400 uppercase tracking-[0.25em]">Detalle Metodología VOSO</h5>
              <div className="h-[2px] bg-zinc-100 flex-1 ml-4 rounded-full" />
            </div>
            
            <div className="grid gap-4">
              {vosoLines.map((line, i) => {
                const categoryMatch = line.match(/\[(.*?)\]/);
                const category = categoryMatch ? categoryMatch[1] : 'GENERAL';
                const IconComp = VOSO_ICONS[category] || AlertTriangle;
                const colorStyles = VOSO_COLORS[category] || 'bg-zinc-100 text-zinc-500 border-zinc-200';
                
                const afterCategory = line.split(']').pop() || line;
                const rawTitle = afterCategory.split(':').shift()?.trim() || 'Ítem';
                const detail = afterCategory.split(':').slice(1).join(':').trim();
                const isSolved = detail.includes('[SOLUCIONADO]');

                const statusMatch = detail.match(/^(Crítico|Observación|Bueno)/);
                const status = statusMatch ? statusMatch[1] : null;
                const comment = status ? detail.replace(status, '').replace(/^-/, '').trim().replace('[SOLUCIONADO]', '') : detail.replace('[SOLUCIONADO]', '');

                return (
                  <div key={i} className={`flex flex-col gap-4 p-6 bg-white dark:bg-black border rounded-[2.5rem] shadow-sm dark:shadow-none transition-all hover:shadow-lg dark:hover:shadow-none hover:border-zinc-200 dark:hover:border-white/20 relative overflow-hidden group ${isSolved ? 'border-emerald-100 dark:border-emerald-500/20 bg-emerald-50/10 dark:bg-emerald-500/5' : 'border-zinc-100 dark:border-white/10'}`}>
                    {/* Decorative accent */}
                    <div className={`absolute top-0 left-0 w-2 h-full ${
                      category === 'VER' ? 'bg-sky-500' :
                      category === 'OÍR' ? 'bg-indigo-500' :
                      category === 'SENTIR' ? 'bg-emerald-500' :
                      category === 'OLER' ? 'bg-orange-500' :
                      'bg-zinc-300'
                    }`} />

                    <div className="flex flex-col lg:flex-row lg:items-start gap-4">
                      <div className={`w-14 h-14 sm:w-16 sm:h-16 rounded-[1.5rem] flex items-center justify-center flex-shrink-0 border-2 ${colorStyles} shadow-sm dark:shadow-none group-hover:scale-105 transition-transform`}>
                        <IconComp className="w-8 h-8 sm:w-9 sm:h-9" />
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-3">
                          <span className={`text-[10px] font-black px-3 py-1 rounded-xl border-2 uppercase tracking-[0.15em] flex items-center gap-1.5 ${colorStyles}`}>
                            <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
                            {category}
                          </span>
                          
                          {status && (
                            <span className={`text-[10px] font-black px-3 py-1 rounded-xl border-2 uppercase tracking-[0.15em] ${
                              status === 'Crítico' ? 'bg-red-500 text-white border-red-500 shadow-sm shadow-red-100 dark:shadow-none' :
                              status === 'Observación' ? 'bg-amber-100 text-amber-700 border-amber-200' :
                              'bg-zinc-100 text-zinc-500 border-zinc-200'
                            }`}>
                              {status}
                            </span>
                          )}

                          {isSolved && (
                            <span className="text-[10px] font-black bg-emerald-500 text-white px-3 py-1 rounded-xl uppercase tracking-widest flex items-center gap-1.5 shadow-sm shadow-emerald-200 dark:shadow-none">
                               <CheckCircle2 className="w-3.5 h-3.5" />
                               SUBSANADO
                            </span>
                          )}
                        </div>
                        
                        <div className="space-y-3">
                          <div className="flex flex-col gap-1">
                            <p className="text-zinc-400 text-[10px] font-black uppercase tracking-widest">Punto de control inspeccionado</p>
                            <h5 className="text-zinc-900 font-black text-lg leading-tight tracking-tight">
                              {rawTitle}
                            </h5>
                          </div>
                          
                          <div className="bg-zinc-50 border border-zinc-100 p-4 rounded-[1.5rem]">
                            <p className="text-zinc-600 text-sm font-semibold leading-relaxed">
                              {comment || (isSolved ? 'El hallazgo fue detectado y corregido inmediatamente por el operador.' : 'Reportado sin comentarios adicionales.')}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {tradPart && (
          <div className="space-y-4 pt-6 border-t border-zinc-100 border-dashed">
            <h5 className="text-[11px] font-black text-zinc-400 uppercase tracking-[0.25em] px-1 flex items-center gap-2">
               <div className="w-2 h-2 rounded-full bg-zinc-200 dark:bg-zinc-800 shadow-inner dark:shadow-none" />
               Controles Estándar Adicionales
            </h5>
            <div className="grid gap-3">
              {tradPart[1].split('\n').filter(l => l.trim()).map((line, i) => (
                <div key={i} className="flex gap-4 items-center text-xs text-zinc-600 dark:text-zinc-400 bg-white dark:bg-black p-4 px-6 rounded-3xl border border-zinc-100 dark:border-white/10 shadow-sm dark:shadow-none transition-all hover:bg-zinc-50 dark:hover:bg-zinc-900/50 hover:border-zinc-200 dark:hover:border-white/20 hover:shadow-md dark:hover:shadow-none">
                  <div className="w-10 h-10 rounded-xl bg-zinc-50 dark:bg-zinc-900 shadow-inner dark:shadow-none flex items-center justify-center text-xs border border-zinc-100 dark:border-white/10 shrink-0">
                    <FileSearch className="w-5 h-5 text-zinc-400" />
                  </div>
                  <div className="flex-1">
                    <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider mb-0.5">Checklist Tradicional</p>
                    <span className="font-black text-zinc-800 tracking-tight text-sm uppercase">{line.replace('• ', '')}</span>
                  </div>
                  <div className="flex items-center gap-1.5 px-3 py-1 bg-amber-500 text-white rounded-lg text-[9px] font-black tracking-widest">
                    <AlertTriangle className="w-3 h-3" />
                    FALLA
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="pt-6 border-t border-zinc-100 text-center">
            <p className="text-[9px] text-zinc-400 font-black uppercase tracking-[0.3em] opacity-50">— Fin del Reporte Estructurado —</p>
        </div>
      </div>
    );
  }

  return <p className={`leading-relaxed whitespace-pre-wrap ${className}`}>{description}</p>;
};

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
  const [stats, setStats] = useState({ total: 0, open: 0, inReview: 0, closed: 0 });
  const [confirmingDelete, setConfirmingDelete] = useState<string | null>(null);
  const [selectedFinding, setSelectedFinding] = useState<Finding | null>(null);
  const [sortConfig, setSortConfig] = useState<{ key: keyof Finding; direction: 'asc' | 'desc' } | null>({
    key: 'createdAt',
    direction: 'desc'
  });
  const [subTab, setSubTab] = useState<'active' | 'closed'>('active');

  const handleSort = (key: keyof Finding) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const sortedFindings = React.useMemo(() => {
    let sortableItems = [...findings];
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
  }, [findings, sortConfig]);

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
      setStats({
        total: data.length,
        open: data.filter(f => f.status === 'Open').length,
        inReview: data.filter(f => f.status === 'InReview').length,
        closed: data.filter(f => f.status === 'Closed').length,
      });
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
    if (findings.length === 0) {
      alert("No hay hallazgos para exportar en este momento.");
      return;
    }
    try {
      // Get settings
      const settingsDoc = await getDoc(doc(db, 'settings', 'reportConfig'));
      const sett = settingsDoc.exists() ? settingsDoc.data() as ReportSettings : {};

      const docPDF = new jsPDF();
      
      // Header Text & Company
      docPDF.setFontSize(20);
      docPDF.setTextColor(24, 24, 27); // zinc-900
      docPDF.text(sett.companyName || 'Reporte de Hallazgos', 14, 22);
      
      docPDF.setFontSize(10);
      docPDF.setTextColor(113, 113, 122); // zinc-500
      docPDF.text(sett.headerText || 'Sistema de Gestión de Inspecciones', 14, 30);
      docPDF.text(`Generado el: ${format(new Date(), 'dd/MM/yyyy HH:mm:ss')}`, 14, 36);

      // Add Logo if exists (at the end for layering if needed, but simple for now)
      if (sett.logoUrl) {
        try {
          docPDF.addImage(sett.logoUrl, 'JPEG', 160, 10, 35, 35);
        } catch (e) {
          console.error("Error adding logo to PDF", e);
        }
      }

      const tableData = findings.map(f => [
        getFindingDate(f) ? format(getFindingDate(f)!, 'dd/MM/yy') : '-',
        f.areaName || '-',
        f.operatorName || '-',
        f.description || '-',
        f.status === 'Open' ? 'Pendiente' : f.status === 'InReview' ? 'En Revisión' : 'Cerrado',
        f.closedAt?.toDate ? format(f.closedAt.toDate(), 'dd/MM/yy') : '-'
      ]);

      autoTable(docPDF, {
        startY: 45,
        head: [['Fecha', 'Área', 'Operador', 'Descripción', 'Estado', 'Cierre']],
        body: tableData,
        theme: 'striped',
        headStyles: { fillColor: [24, 24, 27], textColor: [255, 255, 255], fontStyle: 'bold' },
        styles: { fontSize: 8, cellPadding: 3 },
        margin: { top: 45 }
      });

      // Footer
      const pageCount = (docPDF as any).internal.getNumberOfPages();
      for(let i = 1; i <= pageCount; i++) {
        docPDF.setPage(i);
        docPDF.setFontSize(8);
        docPDF.setTextColor(161, 161, 170); // zinc-400
        docPDF.text(
          sett.footerText || 'Este documento es un reporte oficial generado por el sistema de inspecciones.',
          14, 
          docPDF.internal.pageSize.height - 10
        );
        docPDF.text(`Página ${i} de ${pageCount}`, docPDF.internal.pageSize.width - 30, docPDF.internal.pageSize.height - 10);
      }

      docPDF.save(`reporte-inspecciones-${format(new Date(), 'yyyyMMdd')}.pdf`);
    } catch (err) {
      console.error("Error generating PDF", err);
      alert("Error al generar el PDF. Verifica la configuración del logo (debe ser una URL válida o Base64 JPEG).");
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
        "Fecha Reporte",
        "Planta ID",
        "Area",
        "Equipo",
        "Operador",
        "Descripcion / Hallazgo",
        "Prioridad",
        "Estado",
        "Duracion Inspeccion Area (seg)",
        "Duracion Inspeccion Equipo (seg)",
        "Fecha Cierre",
        "Horas de Cierre",
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
        const closedAtStr = f.closedAt?.toDate ? format(f.closedAt.toDate(), 'dd/MM/yyyy HH:mm:ss') : '';

        let resolutionHours = '';
        if (fDate && f.closedAt) {
          const createdTime = fDate.getTime();
          const closedTime = f.closedAt.toDate ? f.closedAt.toDate().getTime() : 0;
          if (createdTime && closedTime) {
            resolutionHours = (Math.round((closedTime - createdTime) / (1000 * 60 * 60) * 10) / 10).toString();
          }
        }

        const row = [
          escapeCSVCell(f.id),
          escapeCSVCell(createdAtStr),
          escapeCSVCell(f.plantId || ''),
          escapeCSVCell(f.areaName || ''),
          escapeCSVCell(f.equipmentName || ''),
          escapeCSVCell(f.operatorName || ''),
          escapeCSVCell(f.description),
          escapeCSVCell(f.priority || 'N/A'),
          escapeCSVCell(f.status === 'Open' ? 'Abierto' : f.status === 'InReview' ? 'En Revision' : 'Cerrado'),
          escapeCSVCell(f.inspectionDurationSeconds || ''),
          escapeCSVCell(f.equipmentDurationSeconds || ''),
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
      link.setAttribute("download", `reporte-inspecciones-${subTab}-${format(new Date(), 'yyyyMMdd_HHmmss')}.csv`);
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
      <h2 className="text-2xl font-bold text-zinc-900 dark:text-white tracking-tight uppercase">Reportes Históricos</h2>
      
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

        {subTab === 'active' ? (
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
                      {user.role === 'Administrador' && <th className="px-4 py-4 font-bold uppercase tracking-widest text-right">Acciones</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-50 dark:divide-white/5">
                    {activeFindingsList.map((f, index) => {
                      const areaDuration = f.inspectionDurationSeconds || (f.inspectionStartedAt && f.inspectionCompletedAt 
                        ? Math.round((f.inspectionCompletedAt.toDate().getTime() - f.inspectionStartedAt.toDate().getTime()) / 1000) 
                        : null);
                      
                      const equipDuration = f.equipmentDurationSeconds || (f.equipmentStartedAt && f.equipmentCompletedAt
                        ? Math.round((f.equipmentCompletedAt.toDate().getTime() - f.equipmentStartedAt.toDate().getTime()) / 1000)
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
                              <span>{f.areaName}</span>
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
                                      <span>{f.inspectionStartedAt?.toDate ? format(f.inspectionStartedAt.toDate(), 'HH:mm') : '--:--'}</span>
                                      <span className="opacity-30">→</span>
                                      <span>{f.inspectionCompletedAt?.toDate ? format(f.inspectionCompletedAt.toDate(), 'HH:mm') : '--:--'}</span>
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
                          {user.role === 'Administrador' && (
                            <td className="px-4 py-4 text-right">
                              <div className="flex justify-end items-center gap-1">
                                {confirmingDelete === f.id ? (
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
                                )}
                              </div>
                            </td>
                          )}
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

                          {/* Photo Thumbnail */}
                          {f.photoUrl && (
                            <div className="relative w-14 h-14 sm:w-16 sm:h-16 rounded-2xl overflow-hidden border border-zinc-200/50 dark:border-white/10 shrink-0 shadow-sm bg-zinc-100 dark:bg-zinc-850">
                              <OfflineImage 
                                src={f.photoUrl} 
                                className="w-full h-full object-cover group-hover:scale-105 duration-300 transition-transform" 
                                alt="Finding" 
                                referrerPolicy="no-referrer" 
                              />
                            </div>
                          )}
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
                        <span className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest flex items-center gap-1">
                          <Check className="w-3 h-3 text-emerald-500" /> RESUELTO
                        </span>
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
                <div className="min-h-[200px] max-h-[400px] sm:max-h-none sm:h-auto sm:w-1/2 shrink-0 relative bg-zinc-900 flex items-center justify-center">
                <OfflineImage 
                  src={selectedFinding.photoUrl} 
                  className="w-full h-full object-contain" 
                  alt="Finding" 
                  referrerPolicy="no-referrer" 
                />
                  <button 
                    onClick={() => setSelectedFinding(null)}
                    className="absolute top-4 right-4 bg-white/80 dark:bg-black/60 backdrop-blur p-2 rounded-full hover:bg-white dark:hover:bg-black transition-colors shadow-md dark:shadow-none z-10 border border-transparent dark:border-white/10"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto p-6 sm:p-10 space-y-6 custom-scrollbar">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
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
                    </div>
                    <h3 className="text-2xl font-bold text-zinc-900 dark:text-white">{selectedFinding.areaName}</h3>
                    <p className="text-zinc-500 dark:text-zinc-400 text-sm mt-1">Reportado por {selectedFinding.operatorName}</p>
                  </div>

                  <div className="space-y-4">
                    <div className="bg-zinc-50 dark:bg-zinc-900 p-6 rounded-[2rem] border border-transparent dark:border-white/5">
                      <h4 className="text-[10px] font-extrabold text-zinc-400 dark:text-zinc-500 uppercase tracking-[0.2em] mb-4">Descripción del Hallazgo</h4>
                      <FindingDescriptionRenderer description={selectedFinding.description} className="text-zinc-800 dark:text-zinc-205" />
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
                              <span>{selectedFinding.inspectionStartedAt?.toDate ? format(selectedFinding.inspectionStartedAt.toDate(), 'HH:mm:ss') : '--:--:--'}</span>
                              <span className="text-zinc-300 dark:text-zinc-700">↓</span>
                              <span>{selectedFinding.inspectionCompletedAt?.toDate ? format(selectedFinding.inspectionCompletedAt.toDate(), 'HH:mm:ss') : '--:--:--'}</span>
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
                              <span>{selectedFinding.equipmentStartedAt?.toDate ? format(selectedFinding.equipmentStartedAt.toDate(), 'HH:mm:ss') : '--:--:--'}</span>
                              <span className="text-sky-200 dark:text-sky-800">↓</span>
                              <span>{selectedFinding.equipmentCompletedAt?.toDate ? format(selectedFinding.equipmentCompletedAt.toDate(), 'HH:mm:ss') : '--:--:--'}</span>
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
            <div className="p-6 border-b border-zinc-100 dark:border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BellRing className="w-5 h-5 text-brand-blue dark:text-sky-400" />
                <h3 className="font-bold text-zinc-900 dark:text-white uppercase tracking-tight">Notificaciones</h3>
              </div>
              <button onClick={onClose} className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-900 rounded-full transition-colors text-zinc-400 dark:text-zinc-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar dark:bg-black">
              {notifications.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-zinc-400 gap-4 opacity-50">
                  <div className="w-16 h-16 bg-zinc-50 dark:bg-zinc-900 rounded-full flex items-center justify-center border dark:border-white/10">
                    <Bell className="w-8 h-8 text-zinc-400 dark:text-white" />
                  </div>
                  <p className="font-medium text-sm dark:text-white">No tienes notificaciones</p>
                </div>
              ) : (
                notifications.map((n, idx) => {
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
                const found = plants.find(p => p.id === plantInput || p.name.toLowerCase() === plantInput.toLowerCase());
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
                const found = plants.find(p => p.id === plantInput || p.name.toLowerCase() === plantInput.toLowerCase());
                if (found) plantId = found.id;
              }

              // Resolve Area
              let areaId = areaInput;
              if (areas) {
                const found = areas.find(a => a.id === areaInput || a.name.toLowerCase() === areaInput.toLowerCase());
                if (found) areaId = found.id;
              }

              const id = item.id || item.tag || item.etiqueta_tag || generateSafeId(name);
              const checkItemsStr = item.tipo_de_equipo || item.items || item.check_items || "";
              const checkItems = checkItemsStr.split(';').map((s: string) => s.trim()).filter((s: string) => s).map((s: string) => ({
                id: Math.random().toString(36).substr(2, 9),
                name: s
              }));

              await setDoc(doc(db, 'equipment', id), {
                id,
                name,
                plantId,
                areaId,
                inspectionOrder: parseInt(item.orden || "0"),
                checkItems,
                qrCode: item.tag || item.etiqueta_tag || id.toUpperCase(),
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
                const found = plants.find(p => p.id === plantInput || p.name.toLowerCase() === plantInput.toLowerCase());
                if (found) plantId = found.id;
              }

              // Map role
              let role: UserRole = 'Operador';
              if (['admin', 'administrador'].includes(roleIn?.toLowerCase())) role = 'Administrador';
              if (['supervisor'].includes(roleIn?.toLowerCase())) role = 'Supervisor';

              // Since we can't create Auth users easily in bulk from client, we just create Firestore doc
              // We'll use a deterministic temporary ID or let them sign up later
              // For now, let's use email as temporary ID or check if user exists
              const usersRef = collection(db, 'users');
              const q = query(usersRef, where('email', '==', email));
              const snap = await getDoc(doc(db, 'users', email)); // Simple check

              await setDoc(doc(db, 'users', email.replace(/[^a-zA-Z0-9]/g, '_')), {
                email,
                name,
                role,
                plantId,
                uid: email.replace(/[^a-zA-Z0-9]/g, '_') // Note: This will need linking when they actually login
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
             tab === 'Areas' ? 'Áreas' : 
             'Equipos'}
          </button>
        ))}
      </div>

      {activeSubTab === 'Users' && <AdminUserManagement plants={plants} />}
      {activeSubTab === 'Plants' && <AdminPlantManagement plants={plants} />}
      {activeSubTab === 'Areas' && <AdminAreaManagement plants={plants} areas={areas} />}
      {activeSubTab === 'Equipment' && <AdminEquipmentManagement plants={plants} areas={areas} equipment={equipmentList} />}
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
        inspectionOrder: Number(formData.inspectionOrder) || 0,
        checkItems: formData.checkItems || [],
        inspeccionVOSO: formData.inspeccionVOSO || DEFAULT_VOSO
      });

      setShowForm(false);
      setEditingEquip(null);
      setFormData({ name: '', areaId: '', plantId: '', inspectionOrder: 0, checkItems: [], inspeccionVOSO: DEFAULT_VOSO });
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
                <h4 className="font-bold text-zinc-900 dark:text-white">Otros Puntos de Revisión</h4>
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
                  placeholder="Agregar nuevo punto de revisión (ej: Nivel de aceite)"
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
            setFormData({name:'', areaId:'', plantId: '', inspectionOrder: 0, checkItems: [], inspeccionVOSO: DEFAULT_VOSO}); 
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
                const areaEquips = filteredEquipment.filter(e => e.areaId === area.id);
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
                      <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest">
                        {areaEquips.length} {areaEquips.length === 1 ? 'equipo' : 'equipos'}
                      </span>
                    </div>

                    <div className="grid gap-3">
                      {areaEquips.map((e, eIdx) => (
                        <div key={`equip-${e.id}-${eIdx}`} className="bg-white dark:bg-black p-4 rounded-2xl border border-zinc-100/80 dark:border-white/10 flex justify-between items-center hover:shadow-xs dark:hover:shadow-none transition-all">
                          <div>
                            <p className="font-bold text-zinc-900 dark:text-white text-sm">
                              <span className="text-zinc-400 mr-2 text-xs">#{e.inspectionOrder || '0'}</span>
                              {e.name}
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
                            }} className="p-2 text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-900">
                              <FileText className="w-4 h-4" />
                            </button>
                            <button onClick={() => setConfirmDeleteId(e.id)} className="p-2 text-zinc-400 hover:text-red-500 transition-colors rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10">
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
                          }} className="p-2 text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-900">
                            <FileText className="w-4 h-4" />
                          </button>
                          <button onClick={() => setConfirmDeleteId(e.id)} className="p-2 text-zinc-400 hover:text-red-500 transition-colors rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10">
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
                <span className="text-zinc-500 font-medium">Estado Red:</span>
                <div className="flex items-center gap-1.5 font-bold">
                  <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-red-500 animate-pulse'}`} />
                  <span className={isOnline ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'}>
                    {isOnline ? 'ONLINE' : 'DEGRADADO (OFFLINE)'}
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
                      className="text-red-500 hover:underline hover:text-red-600 normal-case"
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
                    {syncBacklog.map((item) => (
                      <div 
                        key={item.id} 
                        className="p-2.5 rounded-xl bg-zinc-50/50 dark:bg-zinc-900/40 border border-zinc-100 dark:border-white/5 flex flex-col gap-1 text-[11px]"
                      >
                        <div className="flex justify-between">
                          <span className="font-bold text-zinc-800 dark:text-zinc-200 capitalize">
                            {item.collection === 'equipment' ? 'Equipo' : item.collection}
                          </span>
                          <span className={`px-1.5 py-0.5 rounded-md text-[8px] font-extrabold uppercase tracking-widest ${
                            item.state === 'syncing' ? 'bg-sky-50 dark:bg-sky-500/10 text-brand-blue dark:text-sky-400' :
                            item.state === 'failed' ? 'bg-red-50 dark:bg-red-500/10 text-red-500' :
                            'bg-amber-50 dark:bg-amber-500/10 text-amber-500'
                          }`}>
                            {item.state}
                          </span>
                        </div>
                        <div className="text-[9px] text-zinc-400 dark:text-zinc-500 flex justify-between">
                          <span className="font-mono truncate max-w-[120px]">Payload ID: {item.docId}</span>
                          <span className="font-mono">{item.operation.toUpperCase()}</span>
                        </div>
                        {item.error && (
                          <p className="text-[8px] text-red-500/80 font-mono mt-0.5 max-h-8 overflow-y-auto">
                            {item.error}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Force sync actions */}
              {syncBacklog.length > 0 && (
                <button
                  type="button"
                  onClick={handleForceTrigger}
                  disabled={!isOnline || isRotating}
                  className="w-full py-3 bg-zinc-900 dark:bg-white text-white dark:text-black hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed rounded-2xl font-bold text-xs flex items-center justify-center gap-2 transition-all"
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
          className={`flex items-center gap-2.5 p-3.5 rounded-full shadow-lg hover:scale-105 active:scale-95 transition-all text-xs font-bold leading-none ${
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
              {isOnline ? 'Online' : 'Conexión Offline'}
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
                  Al ingresar con tu cuenta de operador, selecciona la planta asignada. Podrás buscar tu área en el listado haciendo clic en ella, o usar el cómodo lector de códigos QR ubicado en la barra para escanear directamente la etiqueta del equipo. Esto te dirigirá a sus puntos de control sin demoras.
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
  const [activeTab, setActiveTab] = useState<'Home' | 'History' | 'Admin' | 'Notifications' | 'PDFConfig'>('Home');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  const [currentTime, setCurrentTime] = useState(new Date());
  const [pendingFindingId, setPendingFindingId] = useState<string | null>(null);
  
  // Single, cache-reliable global plants list for the app
  const [plants, setPlants] = useState<{ id: string; name: string }[]>([]);

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
            <div className={`flex flex-col mb-10 gap-6 ${isSidebarCollapsed ? 'items-center' : ''}`}>
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
            </div>

            <div className="flex-1 space-y-2">
              <button 
                onClick={() => setActiveTab('Home')}
                className={`w-full flex items-center ${isSidebarCollapsed ? 'justify-center px-3' : 'gap-3 px-4'} py-3 rounded-2xl transition-all font-bold text-sm ${
                  activeTab === 'Home' ? 'bg-brand-blue text-white shadow-md shadow-sky-100 dark:shadow-none' : 'text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-900/50'
                }`}
                title={isSidebarCollapsed ? "Panel" : undefined}
              >
                <LayoutDashboard className="w-5 h-5 shrink-0" />
                {!isSidebarCollapsed && <span>Panel</span>}
              </button>
              <button 
                onClick={() => setActiveTab('History')}
                className={`w-full flex items-center ${isSidebarCollapsed ? 'justify-center px-3' : 'gap-3 px-4'} py-3 rounded-2xl transition-all font-bold text-sm ${
                  activeTab === 'History' ? 'bg-brand-blue text-white shadow-md shadow-sky-100 dark:shadow-none' : 'text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-900/50'
                }`}
                title={isSidebarCollapsed ? "Historial" : undefined}
              >
                <History className="w-5 h-5 shrink-0" />
                {!isSidebarCollapsed && <span>Historial</span>}
              </button>
              {user.role === 'Administrador' && (
                <>
                  <button 
                    onClick={() => setActiveTab('Admin')}
                    className={`w-full flex items-center ${isSidebarCollapsed ? 'justify-center px-3' : 'gap-3 px-4'} py-3 rounded-2xl transition-all font-bold text-sm ${
                      activeTab === 'Admin' ? 'bg-brand-blue text-white shadow-md shadow-sky-100 dark:shadow-none' : 'text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-900/50'
                    }`}
                    title={isSidebarCollapsed ? "Administración" : undefined}
                  >
                    <Users className="w-5 h-5 shrink-0" />
                    {!isSidebarCollapsed && <span>Administración</span>}
                  </button>
                  <button 
                    onClick={() => setActiveTab('Notifications')}
                    className={`w-full flex items-center ${isSidebarCollapsed ? 'justify-center px-3' : 'gap-3 px-4'} py-3 rounded-2xl transition-all font-bold text-sm ${
                      activeTab === 'Notifications' ? 'bg-brand-blue text-white shadow-md shadow-sky-100 dark:shadow-none' : 'text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-900/50'
                    }`}
                    title={isSidebarCollapsed ? "Notificaciones" : undefined}
                  >
                    <Bell className="w-5 h-5 shrink-0" />
                    {!isSidebarCollapsed && <span>Notificaciones</span>}
                  </button>
                  <button 
                    onClick={() => setActiveTab('PDFConfig')}
                    className={`w-full flex items-center ${isSidebarCollapsed ? 'justify-center px-3' : 'gap-3 px-4'} py-3 rounded-2xl transition-all font-bold text-sm ${
                      activeTab === 'PDFConfig' ? 'bg-brand-blue text-white shadow-md shadow-sky-100 dark:shadow-none' : 'text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-900/50'
                    }`}
                    title={isSidebarCollapsed ? "Configuración PDF" : undefined}
                  >
                    <Shield className="w-5 h-5 shrink-0" />
                    {!isSidebarCollapsed && <span>Configuración PDF</span>}
                  </button>
                </>
              )}
              <button 
                onClick={() => setActiveTab('Help')}
                className={`w-full flex items-center ${isSidebarCollapsed ? 'justify-center px-3' : 'gap-3 px-4'} py-3 rounded-2xl transition-all font-bold text-sm ${
                  activeTab === 'Help' ? 'bg-brand-blue text-white shadow-md shadow-sky-100 dark:shadow-none' : 'text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-900/50'
                }`}
                title={isSidebarCollapsed ? "Ayuda" : undefined}
              >
                <HelpCircle className="w-5 h-5 shrink-0" />
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
              <div className={`px-4 py-4 bg-zinc-50 dark:bg-zinc-900 rounded-2xl ${isSidebarCollapsed ? 'flex justify-center' : ''} border border-transparent dark:border-white/5`}>
                {isSidebarCollapsed ? (
                  <div className="w-10 h-10 rounded-full bg-zinc-900 dark:bg-black flex items-center justify-center text-[10px] text-white font-black border-2 border-white dark:border-white/20 shadow-sm dark:shadow-none shrink-0">
                    {user.name?.charAt(0) || user.email.charAt(0)}
                  </div>
                ) : (
                  <>
                    <p className="text-[8px] font-bold text-zinc-400 uppercase tracking-[0.2em] mb-1">
                      {user.role}
                    </p>
                    <p className="text-xs font-bold text-zinc-900 dark:text-white transition-colors truncate">{user.name}</p>
                    <p className="text-[10px] text-zinc-400 dark:text-zinc-500 truncate mt-1">{user.email.replace('@chekify.local', '')}</p>
                  </>
                )}
              </div>
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
            <header className="bg-white/80 dark:bg-black/80 border-b border-zinc-100 dark:border-white/10 px-4 md:px-8 py-4 sticky top-0 z-40 backdrop-blur-md transition-colors duration-200">
              <div className="max-w-7xl mx-auto flex items-center justify-between">
                {/* Mobile Identity */}
                <div className="flex items-center gap-3 md:hidden h-10">
                  <Logo />
                </div>

                {/* Welcome & Time (Desktop) */}
                <div className="hidden md:flex flex-col">
                  <div className="flex items-center gap-2">
                    <h2 className="text-zinc-900 dark:text-white font-bold text-lg leading-tight transition-colors">
                      ¡Bienvenido! {user.name}
                    </h2>
                    {isOffline && (
                      <span className="flex items-center gap-1 px-2 py-0.5 bg-red-50 dark:bg-red-500/10 border border-red-100 dark:border-red-500/20 text-red-600 dark:text-red-400 text-[8px] font-bold uppercase rounded-full animate-pulse">
                        <AlertCircle className="w-2.5 h-2.5" />
                        Desconectado
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-zinc-400 dark:text-zinc-500 font-medium">
                    {format(currentTime, "EEEE, dd 'de' MMMM • HH:mm:ss", { locale: es })}
                  </p>
                </div>

                <div className="flex items-center gap-4">
                  <button
                    onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
                    className="text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors p-2"
                    title={theme === 'light' ? 'Activar modo oscuro' : 'Activar modo claro'}
                  >
                    {theme === 'light' ? <Moon className="w-6 h-6" /> : <Sun className="w-6 h-6" />}
                  </button>
                  <button 
                    onClick={() => setShowNotificationCenter(true)}
                    className="relative text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors p-2"
                  >
                    <Bell className="w-6 h-6" />
                    {unreadCount > 0 && (
                      <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-[8px] font-bold rounded-full flex items-center justify-center border-2 border-white dark:border-black animate-pulse-subtle">
                        {unreadCount}
                      </span>
                    )}
                  </button>
                  {/* Mobile logout */}
                  <button 
                    onClick={() => signOut(auth)}
                    className="md:hidden text-zinc-400 hover:text-red-500 transition-colors p-2"
                  >
                    <LogOut className="w-6 h-6" />
                  </button>
                </div>
              </div>
            </header>

            {/* Content Body */}
            <main className="flex-1 p-3 sm:p-6 md:p-8 max-w-7xl mx-auto w-full mb-24 md:mb-0 transitioning-all duration-300 dark:text-white">
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
                      <OperatorDashboard user={user} setActiveTab={setActiveTab} />
                    ) : (
                      <SupervisorDashboard user={user} initialFindingId={pendingFindingId} onClearPending={() => setPendingFindingId(null)} />
                    )}
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

            {/* Mobile Navigation */}
            <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white dark:bg-zinc-900 border-t border-zinc-100 dark:border-zinc-800 px-6 pt-4 pb-2 z-40 transition-colors duration-200">
              <div className="max-w-2xl mx-auto flex items-center justify-around mb-2">
                <button 
                  onClick={() => setActiveTab('Home')}
                  className={`flex flex-col items-center gap-1 transition-all ${activeTab === 'Home' ? 'text-zinc-900 dark:text-zinc-50' : 'text-zinc-400'}`}
                >
                  <LayoutDashboard className="w-6 h-6" />
                  <span className="text-[10px] font-bold uppercase tracking-widest">Inicio</span>
                </button>
                <button 
                  onClick={() => setActiveTab('History')}
                  className={`flex flex-col items-center gap-1 transition-all ${activeTab === 'History' ? 'text-zinc-900 dark:text-zinc-50' : 'text-zinc-400'}`}
                >
                  <History className="w-6 h-6" />
                  <span className="text-[10px] font-bold uppercase tracking-widest">Historial</span>
                </button>
                {user.role === 'Administrador' && (
                  <>
                    <button 
                      onClick={() => setActiveTab('Admin')}
                      className={`flex flex-col items-center gap-1 transition-all ${activeTab === 'Admin' ? 'text-zinc-900 dark:text-zinc-50' : 'text-zinc-400'}`}
                    >
                      <Users className="w-6 h-6" />
                      <span className="text-[10px] font-bold uppercase tracking-widest text-center leading-[1]">General</span>
                    </button>
                    <button 
                      onClick={() => setActiveTab('Notifications')}
                      className={`flex flex-col items-center gap-1 transition-all ${activeTab === 'Notifications' ? 'text-zinc-900 dark:text-zinc-50' : 'text-zinc-400'}`}
                    >
                      <Bell className="w-6 h-6" />
                      <span className="text-[10px] font-bold uppercase tracking-widest text-center leading-[1]">Msjes</span>
                    </button>
                    <button 
                      onClick={() => setActiveTab('PDFConfig')}
                      className={`flex flex-col items-center gap-1 transition-all ${activeTab === 'PDFConfig' ? 'text-zinc-900 dark:text-zinc-50' : 'text-zinc-400'}`}
                    >
                      <Shield className="w-6 h-6" />
                      <span className="text-[10px] font-bold uppercase tracking-widest text-center leading-[1]">PDF</span>
                    </button>
                  </>
                )}
                <button 
                  onClick={() => setActiveTab('Help')}
                  className={`flex flex-col items-center gap-1 transition-all ${activeTab === 'Help' ? 'text-zinc-900 dark:text-zinc-50' : 'text-zinc-400'}`}
                >
                  <HelpCircle className="w-6 h-6" />
                  <span className="text-[10px] font-bold uppercase tracking-widest text-center leading-[1]">Ayuda</span>
                </button>
              </div>
              <div className="text-center">
                <p className="text-[8px] font-bold text-zinc-300 uppercase tracking-[0.2em]">Developed by maisser.cl</p>
              </div>
            </nav>
          </div>
    </div>
  );
};
