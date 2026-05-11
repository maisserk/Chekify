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
  ChevronUp,
  ChevronDown,
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
  Ear,
  Hand,
  Wind,
  Settings2,
  ArrowLeft,
  ShieldCheck,
  ListChecks
} from 'lucide-react';

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

// --- Types ---

type UserRole = 'Administrador' | 'Supervisor' | 'Operador';

interface AppUser {
  uid: string;
  email: string;
  name: string;
  role: UserRole;
  plantId?: string;
  dismissedNotifications?: string[];
  readNotifications?: string[];
}

interface Area {
  id: string;
  plantId: string;
  name: string;
  qrCode: string;
}

type VOSOPreference = 'Crítico' | 'Operacional' | 'Seguridad' | 'Mantenimiento';

interface VOSOItem {
  id: string;
  name: string;
  type: VOSOPreference;
}

interface VOSOInspection {
  ver: VOSOItem[];
  oir: VOSOItem[];
  sentir: VOSOItem[];
  oler: VOSOItem[];
}

interface Equipment {
  id: string;
  plantId: string;
  areaId: string;
  name: string;
  qrCode?: string;
  inspectionOrder: number;
  checkItems?: { id: string; name: string }[];
  inspeccionVOSO?: VOSOInspection;
}

interface HistoryEntry {
  status: 'Open' | 'Closed' | 'InReview';
  userName: string;
  userId: string;
  timestamp: any;
  comment?: string;
  action: string;
}

interface Finding {
  id: string;
  inspectionId: string;
  areaId: string;
  operatorId: string;
  description: string;
  photoUrl?: string;
  status: 'Open' | 'Closed' | 'InReview';
  solution?: string;
  closedBy?: string;
  closedAt?: any;
  supervisorComments?: string;
  createdAt: any;
  areaName?: string;
  operatorName?: string;
  plantId?: string;
  inspectionStartedAt?: any;
  inspectionCompletedAt?: any;
  history?: HistoryEntry[];
}

interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'Finding' | 'System' | 'Announcement';
  targetRole: 'All' | 'Administrador' | 'Supervisor' | 'Operador';
  scheduledAt: any;
  sentAt?: any;
  status: 'Pending' | 'Sent';
  createdBy: string;
  createdAt: any;
  referenceId?: string;
  plantId?: string;
}

interface ReportSettings {
  logoUrl?: string;
  headerText?: string;
  footerText?: string;
  companyName?: string;
}

// --- Components ---

const AuthWrapper = ({ children }: { children: (user: AppUser) => React.ReactNode }) => {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [loginMode, setLoginMode] = useState<'Google' | 'Password'>('Password');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

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
      } else if (error.code === 'auth/popup-blocked') {
        setError("El navegador bloqueó la ventana emergente. Por favor, permite las ventanas emergentes para este sitio.");
      } else if (error.code === 'auth/network-request-failed') {
        setError("Error de red: No se pudo conectar con el servidor de autenticación. Revisa tu internet o desactiva bloqueadores de anuncios.");
      } else {
        setError("Error al iniciar sesión con Google. Intenta de nuevo.");
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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50">
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="w-12 h-12 border-4 border-zinc-900 border-t-transparent rounded-full"
        />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-zinc-50 p-6">
        <div className="max-w-md w-full bg-white rounded-3xl shadow-xl p-8 text-center border border-zinc-100">
          <div className="flex justify-center mb-6">
            <Logo className="h-16" />
          </div>
          <p className="text-zinc-500 mb-8 font-medium">Gestión avanzada de inspecciones industriales.</p>
          
          {loginMode === 'Password' ? (
            <form onSubmit={handlePasswordLogin} className="space-y-4 text-left">
              <div>
                <label className="block text-xs font-bold text-zinc-400 uppercase tracking-widest mb-1 ml-1">Usuario</label>
                <input 
                  type="text" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full p-4 bg-zinc-50 border border-zinc-100 rounded-2xl outline-none focus:ring-2 focus:ring-brand-blue transition-all"
                  placeholder="nombre.usuario"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-zinc-400 uppercase tracking-widest mb-1 ml-1">Contraseña</label>
                <input 
                  type="password" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full p-4 bg-zinc-50 border border-zinc-100 rounded-2xl outline-none focus:ring-2 focus:ring-brand-blue transition-all"
                  placeholder="••••••••"
                  required
                />
              </div>
              {error && <p className="text-red-500 text-xs font-bold text-center">{error}</p>}
              <button
                type="submit"
                disabled={isLoggingIn}
                className={`w-full py-4 px-6 bg-gradient-to-r from-brand-blue to-brand-green text-white rounded-2xl font-bold transition-all shadow-lg shadow-sky-100 flex items-center justify-center gap-3 ${isLoggingIn ? 'opacity-50 cursor-wait' : 'hover:opacity-90'}`}
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
                className={`w-full py-4 px-6 bg-white border border-zinc-100 text-zinc-900 rounded-2xl font-semibold flex items-center justify-center gap-3 transition-all shadow-sm ${isLoggingIn ? 'opacity-50 cursor-wait' : 'hover:bg-zinc-50'}`}
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

          <div className="mt-8 pt-6 border-t border-zinc-50">
            <p className="text-[10px] font-bold text-zinc-300 uppercase tracking-widest">Powered by maisser.cl</p>
          </div>
        </div>
      </div>
    );
  }

  return <>{children(user)}</>;
};

interface VOSOResponse {
  status: 'OK' | 'Observación' | 'Crítico' | 'NA';
  comment?: string;
  photoUrl?: string;
}

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
  onUpdate: (id: string, status: any, comment?: string, photo?: string) => void,
  colorClass: string
}) => {
  const [activeCommentId, setActiveCommentId] = useState<string | null>(null);

  if (!items || items.length === 0) return null;

  return (
    <div className={`p-6 rounded-[2.5rem] border border-zinc-100 ${colorClass} space-y-4 shadow-sm`}>
       <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-white rounded-xl shadow-sm">
            <Icon className="w-5 h-5 text-zinc-600" />
          </div>
          <h4 className="font-bold text-zinc-900">{title}</h4>
        </div>
        <span className="text-[8px] font-black text-zinc-300 uppercase tracking-[0.2em]">{items.length} ítems</span>
      </div>

      <div className="space-y-4">
        {items.map((item) => {
          const res = responses[item.id];
          const hasIssue = res?.status === 'Observación' || res?.status === 'Crítico';
          
          return (
            <div key={item.id} className="bg-white/60 backdrop-blur-sm p-4 rounded-3xl border border-white/40 space-y-4 transition-all">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <p className="text-sm font-bold text-zinc-800 leading-tight">{item.name}</p>
                  <div className="flex gap-2 mt-1">
                    <span className={`text-[8px] font-bold uppercase px-1.5 py-0.5 rounded tracking-widest ${
                      item.type === 'Crítico' ? 'bg-red-50 text-red-500' :
                      item.type === 'Seguridad' ? 'bg-amber-50 text-amber-600' :
                      item.type === 'Mantenimiento' ? 'bg-brand-blue/5 text-brand-blue' :
                      'bg-zinc-100 text-zinc-400'
                    }`}>
                      {item.type}
                    </span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-4 gap-1.5">
                {[
                  { label: 'OK', value: 'OK', selectedClasses: 'bg-emerald-500 text-white border-emerald-600 shadow-lg shadow-emerald-200' },
                  { label: 'Obs.', value: 'Observación', selectedClasses: 'bg-amber-500 text-white border-amber-600 shadow-lg shadow-amber-200' },
                  { label: 'Crit.', value: 'Crítico', selectedClasses: 'bg-red-500 text-white border-red-600 shadow-lg shadow-red-200' },
                  { label: 'N/A', value: 'NA', selectedClasses: 'bg-zinc-600 text-white border-zinc-700 shadow-lg shadow-zinc-200' }
                ].map((opt) => {
                  const isSelected = res?.status === opt.value;
                  return (
                    <button
                      key={opt.label}
                      onClick={() => onUpdate(item.id, opt.value as any)}
                      className={`py-3 px-1 rounded-xl text-[9px] font-bold uppercase transition-all border ${
                        isSelected 
                          ? `${opt.selectedClasses} scale-[1.05] z-10`
                          : 'bg-white text-zinc-400 border-zinc-100 hover:border-zinc-200 shadow-sm active:scale-95'
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
                    className="space-y-3 pt-2 overflow-hidden"
                  >
                    <textarea 
                      value={res?.comment || ''}
                      onChange={e => onUpdate(item.id, res.status, e.target.value)}
                      placeholder="Escribe el detalle del hallazgo..."
                      className="w-full p-3 bg-white/80 border border-zinc-200 rounded-2xl text-xs outline-none focus:ring-2 focus:ring-amber-200 min-h-[80px] font-medium text-zinc-700 shadow-sm"
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
                              const compressed = await compressImage(reader.result as string);
                              onUpdate(item.id, res.status, res.comment, compressed);
                            };
                            reader.readAsDataURL(file);
                          }
                        }}
                      />
                      <button 
                        onClick={() => document.getElementById(`photo-${item.id}`)?.click()}
                        className="flex-1 py-3 bg-zinc-900 text-white rounded-2xl text-[10px] font-bold flex items-center justify-center gap-2 active:scale-[0.98] transition-all shadow-lg shadow-zinc-200"
                      >
                        <Camera className="w-4 h-4" />
                        CAPTURAR EVIDENCIA
                      </button>
                      {res?.photoUrl && (
                        <div className="w-12 h-12 rounded-xl overflow-hidden bg-zinc-100 border-2 border-white shadow-sm flex-shrink-0">
                          <img src={res.photoUrl} className="w-full h-full object-cover" />
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

const OperatorDashboard = ({ user }: { user: AppUser }) => {
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
  const [isSaving, setIsSaving] = useState(false);
  const [searchingArea, setSearchingArea] = useState(false);
  const [areaSearchQuery, setAreaSearchQuery] = useState('');
  const [allActiveFindings, setAllActiveFindings] = useState<Finding[]>([]);
  const [duplicateFinding, setDuplicateFinding] = useState<Finding | null>(null);
  
  const [checkItemStates, setCheckItemStates] = useState<Record<string, 'Bueno' | 'Regular' | 'Malo'>>({});
  const [vosoResponses, setVosoResponses] = useState<Record<string, VOSOResponse>>({});
  const [inspectionResults, setInspectionResults] = useState<Record<string, { trad: any, voso: any }>>({});
  
  // Tracking inspection times
  const [inspectionStartTime, setInspectionStartTime] = useState<Date | null>(null);

  useEffect(() => {
    // Save current results to the list before resetting for next equipment
    if (currentEquipment) {
      setInspectionResults(prev => ({
        ...prev,
        [currentEquipment.id]: {
          trad: { ...checkItemStates },
          voso: { ...vosoResponses }
        }
      }));
    }
    setCheckItemStates({});
    setVosoResponses({});
  }, [currentEquipmentIndex, selectedArea]);

  const handleSetItemState = (itemId: string, state: 'Bueno' | 'Regular' | 'Malo') => {
    setCheckItemStates(prev => ({ ...prev, [itemId]: state }));
  };

  const handleSetVOSOResponse = (itemId: string, status: any, comment?: string, photo?: string) => {
    setVosoResponses(prev => ({
      ...prev,
      [itemId]: {
        ...prev[itemId],
        status,
        comment: comment !== undefined ? comment : prev[itemId]?.comment,
        photoUrl: photo !== undefined ? photo : prev[itemId]?.photoUrl
      }
    }));
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
    });

    // Listen for equipment
    const unsubEquip = onSnapshot(collection(db, 'equipment'), (snapshot) => {
      setEquipment(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Equipment)));
    });

    // Listen for all findings in the user's plant to calculate KPIs
    if (!user.plantId) {
      return unsubAreas;
    }
    
    const q = query(collection(db, 'findings'), where('plantId', '==', user.plantId));
    const unsubStats = onSnapshot(q, (snapshot) => {
      const plantFindings = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Finding));
      setAllActiveFindings(plantFindings.filter(f => f.status !== 'Closed'));
      
      const closedFindings = plantFindings.filter(f => f.status === 'Closed' && f.closedAt && f.createdAt);
      
      let totalResolutionMs = 0;
      closedFindings.forEach(f => {
        const resolutionTime = f.closedAt.toDate().getTime() - f.createdAt.toDate().getTime();
        totalResolutionMs += resolutionTime;
      });
      
      const avgHours = closedFindings.length > 0 
        ? (totalResolutionMs / (1000 * 60 * 60)) / closedFindings.length 
        : 0;

      // Avg Inspection time
      const inspectionsWithTime = plantFindings.filter(f => f.inspectionStartedAt && f.inspectionCompletedAt);
      let totalInspectionMs = 0;
      inspectionsWithTime.forEach(f => {
        totalInspectionMs += f.inspectionCompletedAt.toDate().getTime() - f.inspectionStartedAt.toDate().getTime();
      });
      const avgInsSeconds = inspectionsWithTime.length > 0
        ? (totalInspectionMs / 1000) / inspectionsWithTime.length
        : 0;

      setPlantStats({
        avgResolutionHours: Math.round(avgHours * 10) / 10,
        avgInspectionSeconds: Math.round(avgInsSeconds),
        totalOpen: plantFindings.filter(f => f.status === 'Open').length,
        totalInReview: plantFindings.filter(f => f.status === 'InReview').length,
        totalClosed: plantFindings.filter(f => f.status === 'Closed').length
      });
    });

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

  const handleNextEquipment = () => {
    if (currentEquipmentIndex < areaEquipment.length - 1) {
      setCurrentEquipmentIndex(currentEquipmentIndex + 1);
    } else {
      // Final capture for the last equipment
      const finalResults = {
        ...inspectionResults,
        [currentEquipment.id]: {
          trad: { ...checkItemStates },
          voso: { ...vosoResponses }
        }
      };

      // Finished all equipment
      addDoc(collection(db, 'inspections'), {
        areaId: selectedArea!.id,
        operatorId: user.uid,
        plantId: selectedArea!.plantId,
        timestamp: serverTimestamp(),
        startedAt: inspectionStartTime ? Timestamp.fromDate(inspectionStartTime) : serverTimestamp(),
        completedAt: serverTimestamp(),
        status: 'Completed',
        results: finalResults
      });
      setSelectedArea(null);
      setInspectionStartTime(null);
      setCurrentEquipmentIndex(0);
      setInspectionResults({});
      setMessage({ text: "Inspección de área finalizada correctamente", type: 'success' });
    }
  };

  const handleSubmitFinding = async (forceDuplicate = false) => {
    if (!selectedArea || !findingDescription) return;

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
      plantId: selectedArea.plantId,
      operatorId: user.uid,
      operatorName: user.name,
      description: findingDescription,
      photoUrl: findingPhoto || 'https://picsum.photos/seed/finding/400/300',
      status: isClosingImmediately ? 'Closed' : 'Open',
      solution: isClosingImmediately ? immediateSolution : '',
      closedBy: isClosingImmediately ? user.uid : null,
      closedAt: isClosingImmediately ? serverTimestamp() : null,
      createdAt: serverTimestamp(),
      inspectionStartedAt: inspectionStartTime ? Timestamp.fromDate(inspectionStartTime) : serverTimestamp(),
      inspectionCompletedAt: serverTimestamp(),
      history: [
        {
          status: isClosingImmediately ? 'Closed' : 'Open' as any,
          userId: user.uid,
          userName: user.name,
          timestamp: new Date(), // using local date for initial array is okay as it's client-side defined but usually we want serverTimestamp for sorting
          action: 'Creación de hallazgo',
          comment: isClosingImmediately ? `Cerrado inmediatamente: ${immediateSolution}` : 'Hallazgo reportado'
        }
      ]
    };

    try {
      const findingRef = await addDoc(collection(db, 'findings'), findingData);
      
      // Auto-generate notification for supervisors and admins
      await addDoc(collection(db, 'notifications'), {
        title: 'Nuevo Hallazgo',
        message: `${user.name} ha reportado: ${findingDescription.substring(0, 40)}${findingDescription.length > 40 ? '...' : ''}`,
        type: 'Finding',
        targetRole: 'Supervisor',
        scheduledAt: serverTimestamp(),
        status: 'Sent',
        createdBy: user.uid,
        createdAt: serverTimestamp(),
        referenceId: findingRef.id,
        plantId: selectedArea.plantId // Target supervisors of THIS plant
      });

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
        {message && (
          <motion.div 
            key="operator-feedback-msg"
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}
            className={`fixed top-4 left-1/2 -translate-x-1/2 z-[100] px-4 py-3 rounded-2xl shadow-xl border text-sm font-bold flex items-center gap-2 ${
              message.type === 'success' ? 'bg-brand-green/10 border-brand-green/20 text-brand-green' : 'bg-red-50 border-red-100 text-red-700'
            }`}
          >
            {message.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
            {message.text}
          </motion.div>
        )}
      </AnimatePresence>
      {/* Plant Stats for Operator */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-brand-blue text-white p-4 rounded-3xl shadow-lg shadow-sky-100 border border-sky-400/20">
          <p className="text-[10px] font-bold text-sky-100 uppercase tracking-widest mb-1">Cierre Prom.</p>
          <div className="flex items-baseline gap-1">
            <p className="text-xl font-bold">{plantStats.avgResolutionHours}</p>
            <span className="text-[10px] font-bold text-sky-200">hrs</span>
          </div>
        </div>
        <div className="bg-white text-zinc-900 p-4 rounded-3xl border border-zinc-100 flex flex-col justify-center shadow-sm">
          <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">Insp. Prom.</p>
          <div className="flex items-baseline gap-1">
            <p className="text-xl font-bold text-brand-green">{plantStats.avgInspectionSeconds}</p>
            <span className="text-[10px] font-bold text-zinc-400">s</span>
          </div>
        </div>
        <div className="bg-white p-4 rounded-3xl shadow-sm border border-zinc-100 flex flex-col justify-center">
          <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">Pendientes</p>
          <p className="text-xl font-bold text-zinc-900">{plantStats.totalOpen}</p>
        </div>
        <div className="bg-white p-4 rounded-3xl shadow-sm border border-zinc-100 flex flex-col justify-center">
          <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">En Revisión</p>
          <p className="text-xl font-bold text-orange-600">{plantStats.totalInReview}</p>
        </div>
        <div className="bg-white p-4 rounded-3xl shadow-sm border border-zinc-100 hidden sm:flex flex-col justify-center">
          <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">Total Cerrados</p>
          <p className="text-xl font-bold text-zinc-900">{plantStats.totalClosed}</p>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-zinc-900 tracking-tight">Nueva Inspección</h2>
        <div className="bg-zinc-100 px-3 py-1 rounded-full text-xs font-medium text-zinc-600">
          Operador: {user.name}
        </div>
      </div>

      {!selectedArea && !scanning && (
        <div className="space-y-4">
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={startScanner}
            className="w-full aspect-square max-w-sm mx-auto bg-white border-2 border-dashed border-zinc-200 rounded-3xl flex flex-col items-center justify-center gap-4 hover:border-zinc-900 transition-colors group"
          >
            <div className="w-20 h-20 bg-zinc-50 rounded-full flex items-center justify-center group-hover:bg-zinc-900 transition-colors">
              <QrCode className="w-10 h-10 text-zinc-400 group-hover:text-white" />
            </div>
            <span className="text-zinc-500 font-medium group-hover:text-brand-blue transition-colors text-center px-4">Escanear Código QR de Área</span>
          </motion.button>
          
          <div className="max-w-sm mx-auto">
            <p className="text-center text-xs font-bold text-zinc-400 uppercase tracking-widest mb-3">O selecciona manualmente</p>
            <div className="grid gap-2">
              {areas.length > 0 ? (
                areas.slice(0, 3).map((area, idx) => (
                  <button 
                    key={`quick-${area.id}-${idx}`}
                    onClick={() => {
                      setSelectedArea(area);
                      setInspectionStartTime(new Date());
                    }}
                    className="w-full p-4 bg-white border border-zinc-100 rounded-2xl flex items-center justify-between hover:bg-zinc-50 transition-colors"
                  >
                    <span className="font-bold text-zinc-900">{area.name}</span>
                    <Plus className="w-4 h-4 text-zinc-400" />
                  </button>
                ))
              ) : (
                <p className="text-center text-sm text-zinc-400 py-4 bg-zinc-50 rounded-2xl border border-dashed border-zinc-200 italic">
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
              className="relative w-full max-w-md bg-white rounded-[2.5rem] shadow-2xl flex flex-col max-h-[80vh] overflow-hidden"
            >
              <div className="p-6 border-b border-zinc-50">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl font-bold text-zinc-900">Seleccionar Área</h3>
                  <button onClick={() => setSearchingArea(false)} className="p-2 hover:bg-zinc-100 rounded-full transition-colors">
                    <X className="w-5 h-5 text-zinc-400" />
                  </button>
                </div>
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                  <input 
                    autoFocus
                    value={areaSearchQuery}
                    onChange={(e) => setAreaSearchQuery(e.target.value)}
                    placeholder="Buscar por nombre o QR..."
                    className="w-full pl-11 pr-4 py-3 bg-zinc-50 border border-zinc-100 rounded-2xl outline-none focus:ring-2 focus:ring-zinc-900 transition-all font-medium"
                  />
                </div>
              </div>
              
              <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
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
                          setSearchingArea(false);
                          setAreaSearchQuery('');
                        }}
                        className="w-full p-4 hover:bg-zinc-50 rounded-2xl border border-transparent hover:border-zinc-100 transition-all text-left flex items-center justify-between group"
                      >
                        <div>
                          <p className="font-bold text-zinc-900">{area.name}</p>
                          <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest uppercase">ID: {area.id}</p>
                        </div>
                        <Plus className="w-4 h-4 text-zinc-300 group-hover:text-zinc-900 transition-colors" />
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
            className="absolute top-4 right-4 bg-white/80 backdrop-blur p-2 rounded-full shadow-lg z-10"
          >
            <X className="w-6 h-6" />
          </button>
        </div>
      )}

      {selectedArea && !showFindingForm && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-3xl p-6 border border-zinc-100 shadow-sm space-y-6"
        >
          <div className="flex items-center justify-between border-b border-zinc-50 pb-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-gradient-to-br from-brand-blue to-brand-green rounded-2xl flex items-center justify-center shadow-md">
                <MapPin className="text-white w-6 h-6" />
              </div>
              <div>
                <p className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Área Seleccionada</p>
                <h3 className="text-xl font-bold text-zinc-900">{selectedArea.name}</h3>
              </div>
            </div>
            <button onClick={() => setSelectedArea(null)} className="p-2 bg-zinc-50 text-zinc-400 rounded-full hover:bg-zinc-100">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-bold text-zinc-900 uppercase tracking-tight flex items-center gap-2">
                <ChevronRight className="w-4 h-4 text-zinc-900" />
                {areaEquipment.length > 0 ? 'Equipo Actual' : 'Inspección General'}
              </h4>
              {areaEquipment.length > 0 && (
                <span className="text-[10px] bg-zinc-900 text-white px-2 py-1 rounded-full font-bold">
                  {currentEquipmentIndex + 1} DE {areaEquipment.length}
                </span>
              )}
            </div>
            
            <div className="p-6 bg-gradient-to-br from-brand-blue to-brand-green rounded-[2.5rem] text-white shadow-xl shadow-sky-100 relative overflow-hidden">
               <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-2xl" />
               <div className="relative z-10 space-y-4">
                 <div>
                   <p className="text-[10px] font-bold text-sky-100/90 uppercase tracking-widest mb-1">{areaEquipment.length > 0 ? 'Inspeccionando' : 'Área sin equipos registrados'}</p>
                   <h2 className="text-2xl font-bold">{currentEquipment?.name || selectedArea.name}</h2>
                 </div>
                 
                 <div className="flex gap-2">
                   {areaEquipment.length > 0 && (
                     <div className="px-3 py-1 bg-white/10 rounded-full text-[10px] font-bold uppercase tracking-wider">
                       Ruta: {currentEquipmentIndex + 1}
                     </div>
                   )}
                   <div className="px-3 py-1 bg-emerald-500/20 text-emerald-400 rounded-full text-[10px] font-bold uppercase tracking-wider">
                     {areaEquipment.length > 0 ? 'Activo' : 'General'}
                   </div>
                 </div>
               </div>
            </div>

            {areaEquipment.length > 0 && (
              <div className="space-y-3">
                 <div className="flex items-center justify-between text-zinc-400 px-1">
                   <span className="text-[10px] font-bold uppercase tracking-widest">Progreso de la ruta</span>
                   <span className="text-[10px] font-bold">{Math.round(((currentEquipmentIndex) / areaEquipment.length) * 100)}%</span>
                 </div>
                 <div className="flex gap-1.5 h-1.5 px-1">
                   {areaEquipment.map((e, idx) => (
                     <div 
                       key={`prog-bar-${e.id}-${idx}`} 
                       className={`flex-1 rounded-full transition-all duration-500 ${
                         idx === currentEquipmentIndex ? 'bg-brand-blue scale-y-125' : idx < currentEquipmentIndex ? 'bg-brand-green' : 'bg-zinc-100'
                       }`} 
                     />
                   ))}
                 </div>
              </div>
            )}

            {areaEquipment.length > 0 && currentEquipment?.inspeccionVOSO && (
              <div className="space-y-6 py-2 border-t border-zinc-50 mt-4">
                <div className="flex items-center justify-between px-1">
                  <h4 className="text-[10px] font-bold text-zinc-400 uppercase tracking-[0.2em]">Inspección Primaria VOSO</h4>
                  <div className="flex gap-1">
                    {[Eye, Ear, Hand, Wind].map((Ico, i) => <Ico key={`mini-voso-${i}`} className="w-3 h-3 text-zinc-300" />)}
                  </div>
                </div>
                
                <div className="space-y-6">
                  <VOSOExecutionCategory 
                    title="👁 Ver" 
                    icon={Eye} 
                    items={currentEquipment.inspeccionVOSO.ver || []} 
                    responses={vosoResponses}
                    colorClass="bg-sky-50/30"
                    onUpdate={handleSetVOSOResponse}
                  />
                  <VOSOExecutionCategory 
                    title="👂 Oír" 
                    icon={Ear} 
                    items={currentEquipment.inspeccionVOSO.oir || []} 
                    responses={vosoResponses}
                    colorClass="bg-indigo-50/30"
                    onUpdate={handleSetVOSOResponse}
                  />
                  <VOSOExecutionCategory 
                    title="✋ Sentir" 
                    icon={Hand} 
                    items={currentEquipment.inspeccionVOSO.sentir || []} 
                    responses={vosoResponses}
                    colorClass="bg-emerald-50/30"
                    onUpdate={handleSetVOSOResponse}
                  />
                  <VOSOExecutionCategory 
                    title="👃 Oler" 
                    icon={Wind} 
                    items={currentEquipment.inspeccionVOSO.oler || []} 
                    responses={vosoResponses}
                    colorClass="bg-orange-50/30"
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
                                ? state === 'Bueno' ? 'bg-brand-green text-white border-brand-green shadow-md shadow-emerald-100' 
                                : state === 'Regular' ? 'bg-amber-500 text-white border-amber-500 shadow-md shadow-amber-100'
                                : 'bg-red-500 text-white border-red-500 shadow-md shadow-red-100'
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

            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={handleNextEquipment}
                disabled={!allItemsChecked() || hasAnyDefect()}
                className={`py-6 rounded-3xl font-bold flex flex-col items-center gap-2 transition-all border ${
                  allItemsChecked() && !hasAnyDefect() 
                    ? 'bg-brand-blue text-white shadow-lg shadow-sky-100 border-white/10 active:scale-95' 
                    : 'bg-zinc-100 text-zinc-300 border-zinc-200 cursor-not-allowed grayscale'
                }`}
              >
                <CheckCircle2 className={`w-6 h-6 ${allItemsChecked() && !hasAnyDefect() ? 'text-white' : 'text-zinc-300'}`} />
                <span className="text-sm">Correcto</span>
              </button>
              <button
                onClick={() => {
                  if (hasAnyDefect()) {
                    let defects = Object.entries(checkItemStates)
                      .filter(([_, state]) => state !== 'Bueno')
                      .map(([itemId, state]) => `${currentEquipment?.checkItems?.find(i => i.id === itemId)?.name}: ${state}`)
                      .join(', ');
                    
                    const vosoDefects = (Object.entries(vosoResponses) as [string, VOSOResponse][])
                      .filter(([_, resp]) => resp.status === 'Observación' || resp.status === 'Crítico')
                      .map(([itemId, resp]) => {
                        const voso = currentEquipment?.inspeccionVOSO;
                        const allVOSO = [...(voso?.ver || []), ...(voso?.oir || []), ...(voso?.sentir || []), ...(voso?.oler || [])];
                        const item = allVOSO.find(i => i.id === itemId);
                        return `${item?.name} (${resp.status}): ${resp.comment || 'Sin comentario'}`;
                      })
                      .join(', ');
                    
                    if (vosoDefects) defects = defects ? `${defects}. VOSO: ${vosoDefects}` : `VOSO: ${vosoDefects}`;

                    setFindingDescription(`Hallazgo en ${currentEquipment?.name}. Defectos: ${defects}. `);
                  }
                  setShowFindingForm(true);
                }}
                disabled={!allItemsChecked() && currentEquipment?.checkItems && currentEquipment.checkItems.length > 0}
                className={`py-6 rounded-3xl font-bold flex flex-col items-center gap-2 transition-all border ${
                  (allItemsChecked() && hasAnyDefect()) || (!currentEquipment?.checkItems || currentEquipment.checkItems.length === 0)
                    ? 'bg-amber-500 text-white shadow-lg shadow-amber-100 border-amber-400 active:scale-95'
                    : 'bg-zinc-100 text-zinc-400 border-zinc-200 hover:bg-zinc-200 active:scale-95'
                }`}
              >
                <AlertCircle className={`w-6 h-6 ${allItemsChecked() && hasAnyDefect() ? 'text-white' : 'text-amber-500'}`} />
                <span className="text-sm">Observación</span>
              </button>
            </div>

            <div className="flex items-center justify-between pt-2">
              <button 
                onClick={() => currentEquipmentIndex > 0 && setCurrentEquipmentIndex(currentEquipmentIndex - 1)}
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
          className="bg-white rounded-3xl p-6 border border-zinc-100 shadow-xl space-y-6"
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
                      const reader = new FileReader();
                      reader.onloadend = async () => {
                        const base64 = reader.result as string;
                        try {
                          const compressed = await compressImage(base64);
                          setFindingPhoto(compressed);
                        } catch (err) {
                          console.error("Compression failed", err);
                          setFindingPhoto(base64); // Fallback
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
                      className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"
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
              disabled={!findingDescription || isSaving}
              className="flex-[2] py-4 bg-brand-blue text-white rounded-2xl font-bold hover:opacity-90 transition-colors disabled:opacity-50 shadow-lg shadow-sky-100 flex items-center justify-center gap-2"
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
                className="relative bg-white p-6 rounded-[2.5rem] shadow-2xl max-w-sm w-full space-y-4"
              >
                <div className="w-12 h-12 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto">
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <div className="text-center">
                  <h4 className="text-lg font-bold text-zinc-900">Posible Duplicado</h4>
                  <p className="text-xs text-zinc-500 mt-1">
                    Ya existe un hallazgo activo para esta ubicación. Revisa si es el mismo:
                  </p>
                  <div className="mt-4 p-4 bg-amber-50 rounded-2xl border border-amber-100 text-left">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-[10px] font-bold text-amber-600 uppercase tracking-widest">Reportado por {duplicateFinding.operatorName}</p>
                      <span className="text-[10px] text-amber-400 font-bold">{duplicateFinding.status === 'Open' ? 'ABIERTO' : 'EN REVISIÓN'}</span>
                    </div>
                    <p className="text-sm text-zinc-700 italic leading-relaxed">"{duplicateFinding.description}"</p>
                  </div>
                  <p className="text-[10px] text-zinc-400 mt-4 font-bold uppercase tracking-[0.2em]">¿Deseas reportarlo de todas formas?</p>
                </div>
                <div className="flex flex-col gap-2 pt-2">
                  <button 
                    onClick={() => { setDuplicateFinding(null); handleSubmitFinding(true); }}
                    className="w-full py-4 bg-brand-blue text-white rounded-2xl font-bold text-sm active:scale-95 transition-all shadow-lg shadow-sky-100"
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
    </div>
  );
};

// --- Supervisor Stats Component ---

const SupervisorStats = ({ findings }: { findings: Finding[] }) => {
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [groupBy, setGroupBy] = useState<'area' | 'operador'>('area');

  const filteredByDate = findings.filter(f => {
    if (!f.createdAt?.toDate) return true;
    const date = f.createdAt.toDate();
    const start = dateRange.start ? new Date(dateRange.start) : null;
    const end = dateRange.end ? new Date(dateRange.end) : null;
    if (start && date < start) return false;
    if (end) {
      const endOfDay = new Date(end);
      endOfDay.setHours(23, 59, 59, 999);
      if (date > endOfDay) return false;
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

    return Object.values(counts).sort((a, b) => (b.open + b.closed + b.inReview) - (a.open + a.closed + a.inReview)).slice(0, 8);
  }, [filteredByDate, groupBy]);

  return (
    <div className="bg-white rounded-3xl p-6 border border-zinc-100 shadow-sm space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-zinc-900" />
          <h3 className="font-bold text-zinc-900">Estadísticas de Hallazgos</h3>
        </div>
        <div className="flex items-center gap-2 bg-zinc-100 p-1 rounded-xl">
          <button 
            onClick={() => setGroupBy('area')}
            className={`px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all ${groupBy === 'area' ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500'}`}
          >
            Por Área
          </button>
          <button 
            onClick={() => setGroupBy('operador')}
            className={`px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all ${groupBy === 'operador' ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500'}`}
          >
            Por Operador
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1">
          <label className="text-[10px] font-bold text-zinc-400 uppercase ml-1">Desde</label>
          <div className="relative">
            <CalendarIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400" />
            <input 
              type="date" 
              value={dateRange.start}
              onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
              className="w-full pl-9 pr-4 py-2 bg-zinc-50 border border-zinc-100 rounded-xl text-xs outline-none focus:ring-2 focus:ring-brand-blue"
            />
          </div>
        </div>
        <div className="space-y-1">
          <label className="text-[10px] font-bold text-zinc-400 uppercase ml-1">Hasta</label>
          <div className="relative">
            <CalendarIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400" />
            <input 
              type="date" 
              value={dateRange.end}
              onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
              className="w-full pl-9 pr-4 py-2 bg-zinc-50 border border-zinc-100 rounded-xl text-xs outline-none focus:ring-2 focus:ring-brand-blue"
            />
          </div>
        </div>
      </div>

      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart id="stats-summary-chart" data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
            <XAxis 
              dataKey="name" 
              axisLine={false} 
              tickLine={false} 
              tick={{ fontSize: 10, fill: '#a1a1aa' }}
              interval={0}
            />
            <YAxis 
              axisLine={false} 
              tickLine={false} 
              tick={{ fontSize: 10, fill: '#a1a1aa' }}
            />
            <Tooltip 
              contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
              cursor={{ fill: '#f4f4f5' }}
            />
            <Bar dataKey="open" name="Pendientes" fill="#0ea5e9" radius={[4, 4, 0, 0]} />
            <Bar dataKey="inReview" name="En Revisión" fill="#f59e0b" radius={[4, 4, 0, 0]} />
            <Bar dataKey="closed" name="Cerrados" fill="#10b981" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
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
    let q = query(collection(db, 'findings'), orderBy('createdAt', 'desc'));
    return onSnapshot(q, (snapshot) => {
      let data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Finding));
      
      // Filter by user plant if not Admin
      if (user.role !== 'Administrador') {
        if (user.plantId) {
          data = data.filter(f => f.plantId === user.plantId);
        } else {
          data = [];
        }
      }
      
      setFindings(data);
    });
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
    if (f.createdAt?.toDate) {
      const date = f.createdAt.toDate();
      if (startDate) {
        const start = new Date(startDate);
        if (date < start) matchesDate = false;
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        if (date > end) matchesDate = false;
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
    await updateDoc(doc(db, 'findings', selectedFinding.id), {
      status: 'Closed',
      supervisorComments: supervisorComments,
      closedBy: user.uid,
      closedAt: serverTimestamp(),
      history: arrayUnion({
        status: 'Closed',
        userId: user.uid,
        userName: user.name,
        timestamp: new Date(),
        action: 'Cierre de hallazgo',
        comment: supervisorComments || 'Hallazgo cerrado por supervisor'
      })
    });
    
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
    alert("Hallazgo cerrado exitosamente");
  };

  const handleSetInReview = async () => {
    if (!selectedFinding) return;
    await updateDoc(doc(db, 'findings', selectedFinding.id), {
      status: 'InReview',
      supervisorComments: supervisorComments,
      updatedAt: serverTimestamp(),
      history: arrayUnion({
        status: 'InReview',
        userId: user.uid,
        userName: user.name,
        timestamp: new Date(),
        action: 'Marcar en revisión',
        comment: supervisorComments || 'Puesto en revisión por supervisor'
      })
    });

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
    alert("Hallazgo marcado como En Revisión");
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
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-zinc-900 tracking-tight">Gestión de Hallazgos</h2>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setShowStats(!showStats)}
              className={`p-2 rounded-xl transition-all ${showStats ? 'bg-brand-blue text-white shadow-md shadow-sky-100' : 'bg-zinc-100 text-zinc-500 hover:text-zinc-900'}`}
              title="Estadísticas"
            >
              <BarChart3 className="w-5 h-5" />
            </button>
            <button 
              onClick={() => setShowFilters(!showFilters)}
              className={`p-2 rounded-xl transition-all ${showFilters || startDate || endDate || operatorFilter !== 'All' ? 'bg-brand-green text-white shadow-md shadow-emerald-100' : 'bg-zinc-100 text-zinc-500 hover:text-zinc-900'}`}
              title="Filtros Avanzados"
            >
              <Filter className="w-5 h-5" />
            </button>
            <div className="hidden sm:flex bg-zinc-100 p-1 rounded-xl">
              {(['Open', 'InReview', 'Closed', 'All'] as const).map((f, fIdx) => (
                <button
                  key={`filter-tab-${f}-${fIdx}`}
                  onClick={() => setFilter(f)}
                  className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    filter === f ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500 hover:text-zinc-700'
                  }`}
                >
                  {f === 'Open' ? 'Pendientes' : f === 'InReview' ? 'En Revisión' : f === 'Closed' ? 'Cerrados' : 'Todos'}
                </button>
              ))}
            </div>
          </div>
        </div>

        <AnimatePresence>
          {showFilters && (
            <motion.div
              key="supervisor-filter-panel"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="bg-white p-6 rounded-3xl border border-zinc-100 shadow-sm space-y-4 mb-4"
            >
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-bold text-zinc-900 uppercase tracking-widest">Filtros Avanzados</h4>
                <button onClick={clearFilters} className="text-[10px] font-bold text-zinc-400 hover:text-zinc-900 uppercase tracking-widest">
                  Limpiar Filtros
                </button>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-zinc-400 uppercase ml-1">Rango de Fecha</label>
                  <div className="flex flex-col sm:flex-row items-center gap-2">
                    <input 
                      type="date" 
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="w-full p-2 bg-zinc-50 border border-zinc-100 rounded-xl text-xs outline-none focus:ring-2 focus:ring-brand-blue"
                    />
                    <span className="text-zinc-300 hidden sm:block">-</span>
                    <input 
                      type="date" 
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="w-full p-2 bg-zinc-50 border border-zinc-100 rounded-xl text-xs outline-none focus:ring-2 focus:ring-brand-blue"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-zinc-400 uppercase ml-1">Operador</label>
                  <select 
                    value={operatorFilter}
                    onChange={(e) => setOperatorFilter(e.target.value)}
                    className="w-full p-3 bg-zinc-50 border border-zinc-100 rounded-xl text-xs outline-none focus:ring-2 focus:ring-brand-blue appearance-none"
                  >
                    <option value="All">Todos los Operadores</option>
                    {uniqueOperators.map((op, idx) => (
                      <option key={`op-opt-${op}-${idx}`} value={op}>{op}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1 sm:hidden">
                  <label className="text-[10px] font-bold text-zinc-400 uppercase ml-1">Estado</label>
                  <select 
                    value={filter}
                    onChange={(e) => setFilter(e.target.value as any)}
                    className="w-full p-3 bg-zinc-50 border border-zinc-100 rounded-xl text-xs outline-none focus:ring-2 focus:ring-brand-blue appearance-none"
                  >
                    <option value="All">Todos los Estados</option>
                    <option value="Open">Pendientes</option>
                    <option value="InReview">En Revisión</option>
                    <option value="Closed">Cerrados</option>
                  </select>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {showStats && (
            <motion.div
              key="supervisor-stats"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <SupervisorStats findings={findings} />
            </motion.div>
          )}
        </AnimatePresence>

        <div className="space-y-2">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
            <input 
              type="text"
              placeholder="Buscar por área, descripción u operador..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-11 pr-4 py-3 bg-white border border-zinc-100 rounded-2xl outline-none focus:ring-2 focus:ring-brand-blue shadow-sm transition-all text-sm"
            />
          </div>
          {(startDate || endDate || operatorFilter !== 'All') && !showFilters && (
            <div className="flex flex-wrap gap-2 px-1">
              {startDate && <span className="bg-zinc-100 text-zinc-600 px-2 py-1 rounded-lg text-[10px] font-bold uppercase">Desde: {startDate}</span>}
              {endDate && <span className="bg-zinc-100 text-zinc-600 px-2 py-1 rounded-lg text-[10px] font-bold uppercase">Hasta: {endDate}</span>}
              {operatorFilter !== 'All' && <span className="bg-zinc-100 text-zinc-600 px-2 py-1 rounded-lg text-[10px] font-bold uppercase">Op: {operatorFilter}</span>}
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
              className="bg-white p-4 rounded-2xl border border-zinc-100 shadow-sm hover:shadow-md transition-all cursor-pointer group"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                    finding.status === 'Open' ? 'bg-amber-50 text-amber-600' : 
                    finding.status === 'InReview' ? 'bg-orange-50 text-orange-600' :
                    'bg-emerald-50 text-emerald-600'
                  }`}>
                    {finding.status === 'Open' ? <AlertCircle className="w-5 h-5" /> : 
                     finding.status === 'InReview' ? <Clock className="w-5 h-5" /> :
                     <CheckCircle2 className="w-5 h-5" />}
                  </div>
                  <div>
                    <h4 className="font-bold text-zinc-900">{finding.areaName}</h4>
                    <p className="text-xs text-zinc-400 italic">
                      {finding.createdAt?.toDate ? format(finding.createdAt.toDate(), 'EEE dd MMM, HH:mm', { locale: es }) : 'Recién'}
                    </p>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-zinc-300 group-hover:text-zinc-900 transition-colors" />
              </div>
              <p className="text-sm text-zinc-600 line-clamp-2">{finding.description}</p>
              <div className="mt-4 pt-3 border-t border-zinc-50 flex items-center justify-between gap-4">
                <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 truncate flex-1">Por: {finding.operatorName}</span>
                {finding.photoUrl && (
                  <div className="w-12 h-12 rounded-xl bg-zinc-900 overflow-hidden shrink-0 shadow-sm">
                    <img src={finding.photoUrl} className="w-full h-full object-contain" alt="" />
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
              className="relative w-full max-w-lg sm:max-w-5xl bg-white rounded-t-[2.5rem] sm:rounded-[2.5rem] overflow-hidden shadow-2xl flex flex-col sm:flex-row max-h-[90vh]"
            >
              <div className="min-h-[200px] max-h-[400px] sm:max-h-none sm:h-auto sm:w-1/2 shrink-0 relative bg-zinc-900 flex items-center justify-center">
                <img 
                  src={selectedFinding.photoUrl} 
                  className="w-full h-full object-contain" 
                  alt="Finding" 
                  referrerPolicy="no-referrer" 
                />
                <button 
                  onClick={() => setSelectedFinding(null)}
                  className="absolute top-4 right-4 bg-white/80 backdrop-blur p-2 rounded-full hover:bg-white transition-colors shadow-md z-10"
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
                    <span className="text-xs text-zinc-400">{selectedFinding.areaName}</span>
                  </div>
                  <h3 className="text-2xl font-bold text-zinc-900">{selectedFinding.description}</h3>
                </div>

                {selectedFinding.status !== 'Closed' ? (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-zinc-700 mb-1">Comentarios del Supervisor</label>
                      <textarea 
                        value={supervisorComments}
                        onChange={(e) => setSupervisorComments(e.target.value)}
                        className="w-full p-4 bg-zinc-50 border border-zinc-200 rounded-2xl focus:ring-2 focus:ring-brand-blue outline-none transition-all"
                        placeholder="Instrucciones o notas de cierre..."
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <button 
                        onClick={handleSetInReview}
                        disabled={selectedFinding.status === 'InReview'}
                        className={`py-4 rounded-2xl font-bold transition-all border ${
                          selectedFinding.status === 'InReview' 
                            ? 'bg-zinc-100 text-zinc-400 border-transparent cursor-not-allowed'
                            : 'bg-white border-orange-200 text-orange-600 hover:bg-orange-50'
                        }`}
                      >
                        Poner en Revisión
                      </button>
                      <button 
                        onClick={handleCloseFinding}
                        className="py-4 bg-brand-blue text-white rounded-2xl font-bold hover:opacity-90 transition-colors shadow-lg shadow-sky-100"
                      >
                        Cerrar Hallazgo
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="bg-zinc-50 p-4 rounded-2xl space-y-3">
                    <div>
                      <p className="text-[10px] font-bold text-zinc-400 uppercase">Solución Aplicada</p>
                      <p className="text-zinc-700">{selectedFinding.solution || 'Cerrado por supervisor'}</p>
                    </div>
                    {selectedFinding.supervisorComments && (
                      <div>
                        <p className="text-[10px] font-bold text-zinc-400 uppercase">Comentarios de Supervisión</p>
                        <p className="text-zinc-700 italic">"{selectedFinding.supervisorComments}"</p>
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
                            className="flex-1 py-3 bg-red-500 text-white rounded-xl font-bold text-sm shadow-md shadow-red-100 active:scale-95 transition-all"
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

  useEffect(() => {
    const q = query(collection(db, 'findings'), orderBy('createdAt', 'desc'));
    return onSnapshot(q, (snapshot) => {
      let data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Finding));
      
      // Filter by plant
      if (user.role !== 'Administrador') {
        if (user.plantId) {
          data = data.filter(f => f.plantId === user.plantId);
        } else {
          data = [];
        }
      }

      setFindings(data);
      setStats({
        total: data.length,
        open: data.filter(f => f.status === 'Open').length,
        inReview: data.filter(f => f.status === 'InReview').length,
        closed: data.filter(f => f.status === 'Closed').length,
      });
    });
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
        f.createdAt?.toDate ? format(f.createdAt.toDate(), 'dd/MM/yy') : '-',
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

  return (
    <div className="space-y-8">
      <h2 className="text-2xl font-bold text-zinc-900 tracking-tight">Reportes Históricos</h2>
      
      <div className="grid grid-cols-3 sm:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-zinc-100 shadow-sm">
          <p className="text-[10px] font-bold text-zinc-400 uppercase mb-1">Total</p>
          <p className="text-2xl font-bold text-zinc-900">{stats.total}</p>
        </div>
        <div className="bg-amber-50 p-4 rounded-2xl border border-amber-100 shadow-sm">
          <p className="text-[10px] font-bold text-amber-600 uppercase mb-1">Pendientes</p>
          <p className="text-2xl font-bold text-amber-700">{stats.open}</p>
        </div>
        <div className="bg-orange-50 p-4 rounded-2xl border border-orange-100 shadow-sm">
          <p className="text-[10px] font-bold text-orange-600 uppercase mb-1">En Revisión</p>
          <p className="text-2xl font-bold text-orange-700">{stats.inReview}</p>
        </div>
        <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-100 shadow-sm">
          <p className="text-[10px] font-bold text-emerald-600 uppercase mb-1">Cerrados</p>
          <p className="text-2xl font-bold text-emerald-700">{stats.closed}</p>
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-zinc-100 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-zinc-50 bg-zinc-50/50 flex items-center justify-between">
          <h3 className="font-bold text-zinc-900">Historial de Hallazgos</h3>
          <button 
            onClick={exportToPDF}
            className="text-xs font-bold text-zinc-500 hover:text-zinc-900 flex items-center gap-1 bg-white border border-zinc-100 px-3 py-1.5 rounded-xl hover:bg-zinc-50 transition-colors"
          >
            <FileText className="w-3 h-3" /> Exportar PDF
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm min-w-[800px]">
            <thead>
              <tr className="text-zinc-400 border-b border-zinc-50">
                <th 
                  className="px-6 py-4 font-medium cursor-pointer hover:text-zinc-900 transition-colors"
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
                  className="px-6 py-4 font-medium cursor-pointer hover:text-zinc-900 transition-colors"
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
                  className="px-6 py-4 font-medium cursor-pointer hover:text-zinc-900 transition-colors"
                  onClick={() => handleSort('operatorName')}
                >
                  <div className="flex items-center gap-1">
                    Operador
                    {sortConfig?.key === 'operatorName' && (
                      sortConfig.direction === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
                    )}
                  </div>
                </th>
                <th className="px-6 py-4 font-medium">Inspección (Inicio/Fin)</th>
                <th className="px-6 py-4 font-medium">Resuelto en</th>
                <th 
                  className="px-6 py-4 font-medium cursor-pointer hover:text-zinc-900 transition-colors"
                  onClick={() => handleSort('status')}
                >
                  <div className="flex items-center gap-1">
                    Estado
                    {sortConfig?.key === 'status' && (
                      sortConfig.direction === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
                    )}
                  </div>
                </th>
                {user.role === 'Administrador' && <th className="px-6 py-4 font-medium text-right">Acciones</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-50">
              {sortedFindings.map((f, index) => {
                const duration = f.inspectionStartedAt && f.inspectionCompletedAt 
                  ? Math.round((f.inspectionCompletedAt.toDate().getTime() - f.inspectionStartedAt.toDate().getTime()) / 1000) 
                  : null;
                
                const resolutionTime = f.status === 'Closed' && f.createdAt && f.closedAt
                  ? Math.round((f.closedAt.toDate().getTime() - f.createdAt.toDate().getTime()) / (1000 * 60 * 60) * 10) / 10
                  : null;

                return (
                  <tr 
                    key={`rep-row-${f.id}-${index}`} 
                    onClick={() => setSelectedFinding(f)}
                    className="hover:bg-zinc-50/50 transition-colors group cursor-pointer"
                  >
                    <td className="px-6 py-4 text-zinc-500 whitespace-nowrap">
                      {f.createdAt?.toDate ? format(f.createdAt.toDate(), 'dd/MM/yy') : '-'}
                    </td>
                    <td className="px-6 py-4 font-medium text-zinc-900">
                      <div className="flex flex-col">
                        <span>{f.areaName}</span>
                        <span className="text-[10px] text-zinc-400 uppercase tracking-tight truncate max-w-[120px]">{f.description}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-zinc-500">
                      {f.operatorName || '-'}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col text-[11px] text-zinc-500 font-mono">
                        <span>{f.inspectionStartedAt?.toDate ? format(f.inspectionStartedAt.toDate(), 'HH:mm:ss') : '--'}</span>
                        <span className="text-zinc-300">↓</span>
                        <span>{f.inspectionCompletedAt?.toDate ? format(f.inspectionCompletedAt.toDate(), 'HH:mm:ss') : '--'}</span>
                        {duration !== null && (
                          <span className="text-zinc-900 font-bold mt-1 text-[9px] uppercase tracking-tighter">
                            ⏱ {duration}s
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {resolutionTime !== null ? (
                        <div className="flex flex-col">
                          <span className="text-zinc-900 font-bold">{resolutionTime} hrs</span>
                          <span className="text-[9px] text-zinc-400 uppercase tracking-tighter">Tiempo Cierre</span>
                        </div>
                      ) : (
                        <span className="text-zinc-300 italic text-xs">Pendiente</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase ${
                      f.status === 'Open' ? 'bg-amber-100 text-amber-700' : 
                      f.status === 'InReview' ? 'bg-orange-100 text-orange-700' :
                      'bg-emerald-100 text-emerald-700'
                    }`}>
                      {f.status === 'Open' ? 'Abierto' : f.status === 'InReview' ? 'En Revisión' : 'Cerrado'}
                    </span>
                    </td>
                    {user.role === 'Administrador' && (
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end items-center gap-1">
                          {confirmingDelete === f.id ? (
                            <div className="flex items-center gap-1 bg-red-50 p-1 rounded-xl border border-red-100">
                              <span className="text-[10px] font-bold text-red-600 px-2">¿Seguro?</span>
                              <button 
                                onClick={(e) => { e.stopPropagation(); handleDelete(f.id); }}
                                className="p-1.5 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors shadow-sm"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                              <button 
                                onClick={(e) => { e.stopPropagation(); setConfirmingDelete(null); }}
                                className="p-1.5 bg-zinc-200 text-zinc-600 rounded-lg hover:bg-zinc-300 transition-colors"
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
                className="relative w-full max-w-lg sm:max-w-5xl bg-white rounded-t-[2.5rem] sm:rounded-[2.5rem] overflow-hidden shadow-2xl flex flex-col sm:flex-row max-h-[90vh]"
              >
                <div className="min-h-[200px] max-h-[400px] sm:max-h-none sm:h-auto sm:w-1/2 shrink-0 relative bg-zinc-900 flex items-center justify-center">
                  <img 
                    src={selectedFinding.photoUrl} 
                    className="w-full h-full object-contain" 
                    alt="Finding" 
                    referrerPolicy="no-referrer" 
                  />
                  <button 
                    onClick={() => setSelectedFinding(null)}
                    className="absolute top-4 right-4 bg-white/80 backdrop-blur p-2 rounded-full hover:bg-white transition-colors shadow-md z-10"
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
                    <h3 className="text-2xl font-bold text-zinc-900">{selectedFinding.areaName}</h3>
                    <p className="text-zinc-500 text-sm mt-1">Reportado por {selectedFinding.operatorName}</p>
                  </div>

                  <div className="space-y-4">
                    <div className="bg-zinc-50 p-4 rounded-2xl">
                      <h4 className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-2">Descripción del Hallazgo</h4>
                      <p className="text-zinc-800 leading-relaxed text-sm">{selectedFinding.description}</p>
                    </div>

                    {selectedFinding.supervisorComments && (
                      <div className="bg-brand-blue/5 p-4 rounded-2xl border border-brand-blue/10">
                        <h4 className="text-[10px] font-bold text-brand-blue uppercase tracking-widest mb-2">Respuesta del Supervisor</h4>
                        <p className="text-brand-blue/80 text-sm italic">{selectedFinding.supervisorComments}</p>
                      </div>
                    )}

                    {selectedFinding.history && selectedFinding.history.length > 0 && (
                      <div className="bg-zinc-50 p-4 rounded-2xl">
                        <h4 className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                          <History className="w-3 h-3" />
                          Historial de Cambios
                        </h4>
                        <div className="space-y-4">
                          {selectedFinding.history.map((entry, i) => (
                            <div key={`hist-${i}`} className="relative flex gap-4">
                              {i !== selectedFinding.history!.length - 1 && (
                                <div className="absolute left-[11px] top-6 bottom-[-16px] w-[2px] bg-zinc-200" />
                              )}
                              <div className={`mt-1.5 w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 z-10 ${
                                entry.status === 'Open' ? 'bg-amber-50 border-amber-200 text-amber-600' :
                                entry.status === 'InReview' ? 'bg-orange-50 border-orange-200 text-orange-600' :
                                'bg-emerald-50 border-emerald-200 text-emerald-600'
                              }`}>
                                <div className="w-2 h-2 rounded-full bg-current" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between gap-2 mb-1">
                                  <span className="text-xs font-bold text-zinc-900">{entry.action}</span>
                                  <span className="text-[10px] text-zinc-400 font-mono">
                                    {entry.timestamp?.toDate ? format(entry.timestamp.toDate(), 'dd/MM HH:mm') : 
                                     entry.timestamp instanceof Date ? format(entry.timestamp, 'dd/MM HH:mm') : '--/--'}
                                  </span>
                                </div>
                                <p className="text-[11px] text-zinc-500 font-medium">Por: {entry.userName}</p>
                                {entry.comment && (
                                  <p className="mt-1 text-[11px] text-zinc-600 italic">"{entry.comment}"</p>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-4 pt-4 border-t border-zinc-100">
                    <div className="space-y-1">
                      <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Reportado en</p>
                      <div className="flex items-center gap-1.5 text-zinc-600 text-sm">
                        <Clock className="w-3.5 h-3.5" />
                        <span>{selectedFinding.createdAt?.toDate ? format(selectedFinding.createdAt.toDate(), 'dd MMM, HH:mm', { locale: es }) : '--:--'}</span>
                      </div>
                    </div>
                    {selectedFinding.closedAt && (
                      <div className="space-y-1">
                        <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Cerrado en</p>
                        <div className="flex items-center gap-1.5 text-emerald-600 text-sm">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>{selectedFinding.closedAt?.toDate ? format(selectedFinding.closedAt.toDate(), 'dd MMM, HH:mm', { locale: es }) : '--:--'}</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
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
  readIds
}: { 
  show: boolean, 
  onClose: () => void, 
  notifications: Notification[],
  onDismiss: (id: string) => void,
  onRead: (id: string) => void,
  onAction: (n: Notification) => void,
  readIds: string[]
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
            className="fixed top-0 right-0 w-full max-w-sm h-screen bg-white shadow-2xl z-50 flex flex-col"
          >
            <div className="p-6 border-b border-zinc-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BellRing className="w-5 h-5 text-brand-blue" />
                <h3 className="font-bold text-zinc-900">Notificaciones</h3>
              </div>
              <button onClick={onClose} className="p-2 hover:bg-zinc-100 rounded-full transition-colors">
                <X className="w-5 h-5 text-zinc-400" />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
              {notifications.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-zinc-400 gap-4 opacity-50">
                  <div className="w-16 h-16 bg-zinc-50 rounded-full flex items-center justify-center">
                    <Bell className="w-8 h-8" />
                  </div>
                  <p className="font-medium text-sm">No tienes notificaciones</p>
                </div>
              ) : (
                notifications.map((n, idx) => {
                  const isRead = readIds.includes(n.id);
                  return (
                    <div 
                      key={`${n.id}-${idx}`} 
                      onClick={() => {
                        if (!isRead) onRead(n.id);
                        onAction(n);
                      }}
                      className={`p-4 rounded-2xl border transition-all cursor-pointer relative group ${
                        isRead 
                          ? 'bg-white border-zinc-100 opacity-60' 
                          : 'bg-zinc-50 border-zinc-100 hover:bg-white hover:shadow-md hover:border-brand-blue/30'
                      }`}
                    >
                      {!isRead && (
                        <div className="absolute top-4 right-4 w-2 h-2 bg-brand-blue rounded-full shadow-[0_0_8px_rgba(14,165,233,0.5)]" />
                      )}
                      
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          onDismiss(n.id);
                        }}
                        className="absolute bottom-2 right-2 p-1.5 text-zinc-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all rounded-lg hover:bg-red-50"
                        title="Eliminar notificación"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>

                      <div className="flex items-center justify-between pr-6 mb-2">
                         <span className={`text-[8px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                           n.type === 'Finding' ? 'bg-red-100 text-red-600' : 
                           n.type === 'System' ? 'bg-brand-blue/10 text-brand-blue' : 
                           'bg-amber-100 text-amber-600'
                         }`}>
                           {n.type === 'Finding' ? 'Hallazgo' : n.type === 'System' ? 'Sistema' : 'Anuncio'}
                         </span>
                         <span className="text-[10px] text-zinc-400 font-medium">
                           {n.createdAt?.toDate ? format(n.createdAt.toDate(), 'EEE dd/MM, HH:mm', { locale: es }) : '--:--'}
                         </span>
                      </div>
                      <p className={`font-bold text-sm leading-tight ${isRead ? 'text-zinc-600' : 'text-zinc-900'}`}>{n.title}</p>
                      <p className={`text-xs leading-relaxed mt-1 ${isRead ? 'text-zinc-400' : 'text-zinc-600'}`}>{n.message}</p>
                    </div>
                  );
                })
              )}
            </div>
            
            <div className="p-6 border-t border-zinc-100 bg-zinc-50/50">
               <p className="text-[10px] text-zinc-400 text-center font-bold uppercase tracking-[0.2em]">Chekify Hub</p>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

const AdminNotificationManagement = () => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [targetRole, setTargetRole] = useState<'All' | 'Administrador' | 'Supervisor' | 'Operador'>('All');
  const [selectedPlantId, setSelectedPlantId] = useState('');
  const [plants, setPlants] = useState<{id: string, name: string}[]>([]);
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleTime, setScheduleTime] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ text: string, type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    const unsubNotif = onSnapshot(query(collection(db, 'notifications'), orderBy('createdAt', 'desc')), (snapshot) => {
      setNotifications(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any)));
    });
    const unsubPlants = onSnapshot(collection(db, 'plants'), (snapshot) => {
      setPlants(snapshot.docs.map(doc => ({ id: doc.id, name: doc.data().name } as any)));
    });
    return () => {
      unsubNotif();
      unsubPlants();
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
        <h3 className="text-xl font-bold text-zinc-900">Mensajes Push & Segmentación</h3>
        <button 
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 bg-zinc-900 text-white px-4 py-2 rounded-2xl font-bold text-xs hover:bg-zinc-800"
        >
          <Plus className="w-4 h-4" />
          Nueva Notificación
        </button>
      </div>

      {feedback && <p className="text-xs font-bold text-emerald-600 uppercase tracking-widest">{feedback.text}</p>}

      <div className="grid gap-3">
        {notifications.map((n, nIdx) => (
          <div key={`notif-admin-list-${n.id}-${nIdx}`} className="bg-white border border-zinc-100 p-4 rounded-2xl group relative">
            <div className="flex justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-[8px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full ${n.status === 'Sent' ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'}`}>
                    {n.status === 'Sent' ? 'Enviado' : 'Programado'}
                  </span>
                  <span className="text-[8px] text-zinc-400 font-bold uppercase tracking-widest">{n.targetRole}</span>
                  {n.plantId && (
                    <span className="text-[8px] text-brand-blue font-bold uppercase tracking-widest bg-sky-50 px-2 py-0.5 rounded-full">
                      {plants.find(p => p.id === n.plantId)?.name || 'Planta'}
                    </span>
                  )}
                </div>
                <h4 className="font-bold text-zinc-900 text-sm">{n.title}</h4>
                <p className="text-xs text-zinc-500">{n.message}</p>
                <div className="flex items-center gap-1 mt-2 text-[9px] text-zinc-400 font-bold">
                  <Clock className="w-3 h-3" />
                  {n.scheduledAt?.toDate ? format(n.scheduledAt.toDate(), "dd MMM, HH:mm", { locale: es }) : 'Instantáneo'}
                </div>
              </div>
              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => handleEdit(n)} className="p-2 text-zinc-400 hover:text-zinc-900"><Edit3 className="w-4 h-4"/></button>
                <button onClick={() => handleDelete(n.id)} className="p-2 text-zinc-400 hover:text-red-500"><Trash2 className="w-4 h-4"/></button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {showForm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
           <div onClick={resetForm} className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
           <div className="relative bg-white w-full max-w-lg rounded-3xl p-8 shadow-2xl">
              <h3 className="text-xl font-bold mb-6">{editingId ? 'Editar' : 'Programar'} Notificación</h3>
              <div className="space-y-4">
                <input value={title} onChange={e => setTitle(e.target.value)} className="w-full p-4 bg-zinc-50 border border-zinc-100 rounded-2xl outline-none" placeholder="Título" />
                <textarea value={message} onChange={e => setMessage(e.target.value)} className="w-full p-4 bg-zinc-50 border border-zinc-100 rounded-2xl outline-none" placeholder="Mensaje..." />
                <div className="grid grid-cols-2 gap-4">
                  <select value={targetRole} onChange={e => setTargetRole(e.target.value as any)} className="w-full p-4 bg-zinc-50 border border-zinc-100 rounded-2xl outline-none">
                    <option value="All">Todos los Roles</option>
                    <option value="Administrador">Solo Admins</option>
                    <option value="Supervisor">Solo Supervisores</option>
                    <option value="Operador">Solo Operadores</option>
                  </select>
                  <select value={selectedPlantId} onChange={e => setSelectedPlantId(e.target.value)} className="w-full p-4 bg-zinc-50 border border-zinc-100 rounded-2xl outline-none">
                    <option value="">Todas las Plantas (Global)</option>
                    {plants.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <label className="block text-[8px] font-bold text-zinc-400 uppercase mb-1 ml-1">Fecha Programada (Opcional)</label>
                    <input type="date" value={scheduleDate} onChange={e => setScheduleDate(e.target.value)} className="w-full p-3 bg-zinc-50 border border-zinc-100 rounded-xl text-xs" />
                  </div>
                  <div className="flex-1">
                    <label className="block text-[8px] font-bold text-zinc-400 uppercase mb-1 ml-1">Hora Programada</label>
                    <input type="time" value={scheduleTime} onChange={e => setScheduleTime(e.target.value)} className="w-full p-3 bg-zinc-50 border border-zinc-100 rounded-xl text-xs" />
                  </div>
                </div>
                <div className="flex gap-3 pt-4">
                  <button onClick={handleSave} disabled={isSaving} className="flex-1 py-4 bg-zinc-900 text-white rounded-2xl font-bold flex items-center justify-center gap-2">
                    {isSaving && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/>}
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
      <div className="w-8 h-8 border-4 border-zinc-900 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="bg-white p-8 rounded-[2rem] border border-zinc-100 shadow-sm space-y-8">
      <div className="flex items-center gap-3">
        <FileText className="w-6 h-6 text-zinc-900" />
        <h3 className="text-xl font-bold text-zinc-900">Configuración de Reportes PDF</h3>
      </div>
      
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-[0.2em] ml-1">Logo de la Empresa</label>
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
                className="flex-1 p-4 bg-zinc-50 border border-zinc-100 rounded-2xl flex items-center justify-center gap-2 cursor-pointer hover:bg-zinc-100 transition-all border-dashed"
              >
                <Camera className="w-5 h-5 text-zinc-400" />
                <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Subir Logo</span>
              </label>
            </div>
            <textarea 
              value={settings.logoUrl} 
              onChange={e => setSettings({...settings, logoUrl: e.target.value})}
              className="w-full p-4 bg-zinc-50 border border-zinc-100 rounded-2xl outline-none focus:ring-2 focus:ring-zinc-900 transition-all font-mono text-[8px] text-zinc-300"
              placeholder="O pega el Data URL (Base64) aquí..."
              rows={2}
            />
          </div>
          <div className="space-y-2">
             <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-[0.2em] ml-1">Nombre de la Empresa</label>
             <input 
              type="text"
              value={settings.companyName} 
              onChange={e => setSettings({...settings, companyName: e.target.value})}
              className="w-full p-4 bg-zinc-50 border border-zinc-100 rounded-2xl outline-none focus:ring-2 focus:ring-zinc-900 transition-all"
              placeholder="Ej: Industrial Corp S.A."
            />
            <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-[0.2em] mt-4 ml-1">Vista Previa Logo</label>
            <div className="w-full h-24 bg-zinc-50 rounded-2xl border border-dashed border-zinc-200 flex items-center justify-center overflow-hidden">
               {settings.logoUrl ? (
                 <img src={settings.logoUrl} className="max-h-full max-w-full object-contain" alt="Logo Preview" />
               ) : (
                 <p className="text-[10px] text-zinc-300 font-bold uppercase tracking-widest">Sin Logo</p>
               )}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-[0.2em] mb-1 ml-1">Texto del Encabezado</label>
            <input 
              type="text"
              value={settings.headerText} 
              onChange={e => setSettings({...settings, headerText: e.target.value})}
              className="w-full p-4 bg-zinc-50 border border-zinc-100 rounded-2xl outline-none focus:ring-2 focus:ring-zinc-900 transition-all"
              placeholder="Texto secundario en el encabezado"
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-[0.2em] mb-1 ml-1">Texto del Pie de Página</label>
            <input 
              type="text"
              value={settings.footerText} 
              onChange={e => setSettings({...settings, footerText: e.target.value})}
              className="w-full p-4 bg-zinc-50 border border-zinc-100 rounded-2xl outline-none focus:ring-2 focus:ring-zinc-900 transition-all"
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
            className={`text-xs font-bold uppercase tracking-widest text-center ${message.type === 'success' ? 'text-emerald-600' : 'text-red-600'}`}
          >
            {message.text}
          </motion.p>
        )}
      </AnimatePresence>

      <button 
        onClick={handleSave}
        disabled={saving}
        className="w-full py-4 bg-zinc-900 text-white rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-zinc-800 transition-all shadow-xl shadow-zinc-200 disabled:opacity-50"
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
              const id = item.id || name.toLowerCase().replace(/\s+/g, '-');
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

              const id = item.id || name.toLowerCase().replace(/\s+/g, '-');
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

              const id = item.id || item.tag || item.etiqueta_tag || name.toLowerCase().replace(/\s+/g, '-');
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
    <div className="bg-zinc-50 border border-zinc-100 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-white rounded-xl shadow-sm flex items-center justify-center text-zinc-400">
          <Upload className="w-5 h-5" />
        </div>
        <div>
          <p className="text-xs font-bold text-zinc-900">Carga Masiva de {
            entityType === 'Users' ? 'Usuarios' :
            entityType === 'Plants' ? 'Plantas' :
            entityType === 'Areas' ? 'Áreas' : 'Equipos'
          }</p>
          <p className="text-[10px] text-zinc-400 font-medium tracking-tight">Sube un archivo CSV con los datos</p>
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
          className="flex-1 sm:flex-none px-3 py-2 text-[10px] font-bold text-brand-blue hover:bg-white rounded-lg transition-all border border-transparent hover:border-brand-blue/10"
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
            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-zinc-900 text-white rounded-xl text-[10px] font-bold hover:bg-zinc-800 transition-all disabled:opacity-50"
          >
            {isProcessing ? (
              <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : <Upload className="w-3 h-3" />}
            Subir CSV
          </button>
        </div>
      </div>
    </div>
  );
};

const AdminManagement = () => {
  const [activeSubTab, setActiveSubTab] = useState<'Users' | 'Plants' | 'Areas' | 'Equipment'>('Users');
  
  return (
    <div className="space-y-6">
      <div className="flex bg-zinc-100 p-1 rounded-2xl overflow-x-auto no-scrollbar">
        {(['Users', 'Plants', 'Areas', 'Equipment'] as const).map((tab, tIdx) => (
          <button
            key={`admin-tab-${tab}-${tIdx}`}
            onClick={() => setActiveSubTab(tab)}
            className={`flex-1 min-w-[100px] px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
              activeSubTab === tab ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500 hover:text-zinc-700'
            }`}
          >
            {tab === 'Users' ? 'Usuarios' : 
             tab === 'Plants' ? 'Plantas' : 
             tab === 'Areas' ? 'Áreas' : 
             'Equipos'}
          </button>
        ))}
      </div>

      {activeSubTab === 'Users' && <AdminUserManagement />}
      {activeSubTab === 'Plants' && <AdminPlantManagement />}
      {activeSubTab === 'Areas' && <AdminAreaManagement />}
      {activeSubTab === 'Equipment' && <AdminEquipmentManagement />}
    </div>
  );
};

const AdminPlantManagement = () => {
  const [plants, setPlants] = useState<{id: string, name: string}[]>([]);
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

  useEffect(() => {
    return onSnapshot(collection(db, 'plants'), (snapshot) => {
      setPlants(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any)));
    });
  }, []);

  const handleSave = async () => {
    console.log("Iniciando handleSave Planta, name:", name);
    if (!name) {
      console.warn("Nombre de planta vacío");
      return;
    }
    
    try {
      const id = editingPlant ? editingPlant.id : name.toLowerCase().replace(/\s+/g, '-');
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
        <h3 className="font-bold text-zinc-900">Plantas Industriales</h3>
        <button onClick={() => { setEditingPlant(null); setName(''); setShowForm(true); }} className="p-2 bg-brand-blue text-white rounded-xl hover:opacity-90 transition-all shadow-md shadow-sky-100"><Plus className="w-4 h-4" /></button>
      </div>

      <BulkUpload 
        entityType="Plants" 
        onComplete={(count) => setMessage({ text: `Se cargaron ${count} plantas exitosamente`, type: 'success' })}
        onError={(err) => setMessage({ text: err, type: 'error' })}
      />

      <div className="grid gap-3">
        {plants.filter(p => (p as any).status !== 'deleted').map((p, pIdx) => (
          <div key={`pl-${p.id}-${pIdx}`} className="bg-white p-4 rounded-2xl border border-zinc-100 flex justify-between items-center hover:shadow-sm transition-all">
            <div>
              <span className="font-bold text-zinc-900">{p.name}</span>
              <p className="text-[10px] text-zinc-400 uppercase font-bold tracking-wider">{p.id}</p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => { setEditingPlant(p); setName(p.name); setShowForm(true); }} className="p-2 text-zinc-400 hover:text-zinc-900 transition-colors"><FileText className="w-4 h-4" /></button>
              <button onClick={() => setConfirmDeleteId(p.id)} className="p-2 text-zinc-400 hover:text-red-500 transition-colors"><X className="w-4 h-4" /></button>
            </div>
          </div>
        ))}
      </div>
      <AnimatePresence>
        {message && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}
            className={`fixed top-4 right-4 z-[60] px-4 py-3 rounded-2xl shadow-xl border text-sm font-bold flex items-center gap-2 ${
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
              className="bg-white rounded-3xl p-8 max-w-sm w-full shadow-2xl space-y-6"
            >
              <div className="w-12 h-12 bg-red-50 rounded-2xl flex items-center justify-center text-red-500 mx-auto">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div className="text-center space-y-2">
                <h3 className="text-xl font-bold text-zinc-900">¿Eliminar planta?</h3>
                <p className="text-zinc-500 text-sm leading-relaxed">
                  Esta acción desactivará la planta. Los datos históricos se mantendrán pero la planta ya no aparecerá en las selecciones.
                </p>
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setConfirmDeleteId(null)} className="flex-1 px-4 py-3 rounded-2xl bg-zinc-100 text-zinc-600 font-bold text-sm hover:bg-zinc-200 transition-all">Cancelar</button>
                <button onClick={() => handleDelete(confirmDeleteId)} className="flex-1 px-4 py-3 rounded-2xl bg-red-500 text-white font-bold text-sm hover:bg-red-600 transition-all shadow-lg shadow-red-200">Eliminar</button>
              </div>
            </motion.div>
          </div>
        )}

        {showForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowForm(false)} className="absolute inset-0 bg-zinc-900/60 backdrop-blur-sm" />
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }} className="relative w-full max-w-md bg-white rounded-[2.5rem] shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
              <div className="p-8 border-b border-zinc-50">
                <h3 className="text-xl font-bold text-zinc-900">{editingPlant ? 'Editar Planta' : 'Nueva Planta'}</h3>
              </div>
              <div className="flex-1 overflow-y-auto p-8 pt-4 custom-scrollbar">
                <input value={name} onChange={e => setName(e.target.value)} placeholder="Nombre de la planta" className="w-full p-4 bg-zinc-50 border border-zinc-100 rounded-2xl mb-4 outline-none focus:ring-2 focus:ring-brand-blue" />
              </div>
              <div className="p-8 border-t border-zinc-50 bg-zinc-50/50">
                <div className="flex gap-3">
                  <button onClick={() => setShowForm(false)} className="flex-1 py-4 bg-zinc-100 text-zinc-600 rounded-2xl font-bold hover:bg-zinc-200 transition-colors">Cancelar</button>
                  <button onClick={handleSave} className="flex-1 py-4 bg-brand-blue text-white rounded-2xl font-bold hover:opacity-90 transition-colors shadow-lg shadow-sky-100">Guardar</button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

const AdminAreaManagement = () => {
  const [areas, setAreas] = useState<Area[]>([]);
  const [plants, setPlants] = useState<{id: string, name: string}[]>([]);
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

  useEffect(() => {
    onSnapshot(collection(db, 'plants'), (s) => setPlants(s.docs.map(d => ({id: d.id, ...d.data()} as any))));
    return onSnapshot(collection(db, 'areas'), (s) => setAreas(s.docs.map(d => ({id: d.id, ...d.data()} as any))));
  }, []);

  const handleSave = async () => {
    if (!formData.name || !formData.plantId) return;
    try {
      const id = editingArea ? editingArea.id : formData.name.toLowerCase().replace(/\s+/g, '-');
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
        <h3 className="font-bold text-zinc-900">Áreas de Inspección</h3>
        <button onClick={() => { setEditingArea(null); setFormData({name:'', plantId:'', qrCode:''}); setShowForm(true); }} className="p-2 bg-zinc-900 text-white rounded-xl hover:bg-zinc-800 transition-colors"><Plus className="w-4 h-4" /></button>
      </div>

      <BulkUpload 
        entityType="Areas"
        plants={plants}
        onComplete={(count) => setMessage({ text: `Se cargaron ${count} áreas exitosamente`, type: 'success' })}
        onError={(err) => setMessage({ text: err, type: 'error' })}
      />

      <div className="grid gap-3">
        {areas.filter(a => (a as any).status !== 'deleted').map((a, aIdx) => (
          <div key={`ar-${a.id}-${aIdx}`} className="bg-white p-4 rounded-2xl border border-zinc-100 flex justify-between items-center hover:shadow-sm transition-all">
            <div>
              <p className="font-bold text-zinc-900">{a.name}</p>
              <p className="text-[10px] text-zinc-400 uppercase font-bold">Planta: {plants.find(p => p.id === (a as any).plantId)?.name || (a as any).plantId}</p>
            </div>
            <div className="flex gap-2 items-center">
              <span className="text-[10px] text-zinc-400 uppercase font-bold mr-2 tracking-wider">QR: {a.qrCode}</span>
              <button onClick={() => { setEditingArea(a); setFormData({name: a.name, plantId: (a as any).plantId, qrCode: a.qrCode}); setShowForm(true); }} className="p-2 text-zinc-400 hover:text-zinc-900 transition-colors"><FileText className="w-4 h-4" /></button>
              <button onClick={() => setConfirmDeleteId(a.id)} className="p-2 text-zinc-400 hover:text-red-500 transition-colors"><X className="w-4 h-4" /></button>
            </div>
          </div>
        ))}
      </div>
      <AnimatePresence>
        {message && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}
            className={`fixed top-4 right-4 z-[60] px-4 py-3 rounded-2xl shadow-xl border text-sm font-bold flex items-center gap-2 ${
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
              className="bg-white rounded-3xl p-8 max-w-sm w-full shadow-2xl space-y-6"
            >
              <div className="w-12 h-12 bg-red-50 rounded-2xl flex items-center justify-center text-red-500 mx-auto">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div className="text-center space-y-2">
                <h3 className="text-xl font-bold text-zinc-900">¿Eliminar área?</h3>
                <p className="text-zinc-500 text-sm leading-relaxed">
                  Esta acción desactivará el área. Los datos históricos de inspecciones y hallazgos se mantendrán.
                </p>
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setConfirmDeleteId(null)} className="flex-1 px-4 py-3 rounded-2xl bg-zinc-100 text-zinc-600 font-bold text-sm hover:bg-zinc-200 transition-all">Cancelar</button>
                <button onClick={() => handleDelete(confirmDeleteId)} className="flex-1 px-4 py-3 rounded-2xl bg-red-500 text-white font-bold text-sm hover:bg-red-600 transition-all shadow-lg shadow-red-200">Eliminar</button>
              </div>
            </motion.div>
          </div>
        )}

        {showForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowForm(false)} className="absolute inset-0 bg-zinc-900/60 backdrop-blur-sm" />
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }} className="relative w-full max-w-md bg-white rounded-[2.5rem] shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
              <div className="p-8 border-b border-zinc-50">
                <h3 className="text-xl font-bold text-zinc-900">{editingArea ? 'Editar Área' : 'Nueva Área'}</h3>
              </div>
              <div className="flex-1 overflow-y-auto p-8 pt-4 custom-scrollbar">
                <div className="space-y-4">
                  <input value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="Nombre del área" className="w-full p-4 bg-zinc-50 border border-zinc-100 rounded-2xl outline-none focus:ring-2 focus:ring-brand-blue" />
                  <select value={formData.plantId} onChange={e => setFormData({...formData, plantId: e.target.value})} className="w-full p-4 bg-zinc-50 border border-zinc-100 rounded-2xl outline-none focus:ring-2 focus:ring-brand-blue">
                    <option value="">Seleccionar Planta</option>
                    {plants.map((p, idx) => <option key={`pl-opt-1-${p.id}-${idx}`} value={p.id}>{p.name}</option>)}
                  </select>
                  <input value={formData.qrCode} onChange={e => setFormData({...formData, qrCode: e.target.value})} placeholder="Código QR (opcional)" className="w-full p-4 bg-zinc-50 border border-zinc-100 rounded-2xl outline-none focus:ring-2 focus:ring-brand-blue" />
                </div>
              </div>
              <div className="p-8 border-t border-zinc-50 bg-zinc-50/50">
                <div className="flex gap-3 mt-0">
                  <button onClick={() => setShowForm(false)} className="flex-1 py-4 bg-zinc-100 text-zinc-600 rounded-2xl font-bold hover:bg-zinc-200 transition-colors">Cancelar</button>
                  <button onClick={handleSave} className="flex-1 py-4 bg-brand-blue text-white rounded-2xl font-bold hover:opacity-90 transition-colors shadow-lg shadow-sky-100">Guardar</button>
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
  items, 
  onUpdate, 
  colorClass 
}: { 
  title: string, 
  icon: any, 
  items: VOSOItem[], 
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
    <div className={`p-6 rounded-[2rem] border border-zinc-100 ${colorClass} space-y-4`}>
      <div className="flex items-center gap-3">
        <div className="p-2 bg-white rounded-xl shadow-sm">
          <Icon className="w-5 h-5 text-zinc-600" />
        </div>
        <h4 className="font-bold text-zinc-900">{title}</h4>
      </div>

      <div className="space-y-2">
        {items.map((item, idx) => (
          <div key={item.id} className="bg-white/60 backdrop-blur-sm p-3 rounded-2xl border border-white/40 flex flex-col gap-2 group">
            <div className="flex items-center gap-2">
              <input 
                value={item.name} 
                onChange={e => updateItemName(item.id, e.target.value)}
                className="flex-1 bg-transparent border-none p-0 text-sm font-bold text-zinc-800 focus:ring-0" 
              />
              <button onClick={() => removeItem(item.id)} className="p-1 text-zinc-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all">
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
                      ? 'bg-zinc-900 text-white' 
                      : 'bg-white text-zinc-400 hover:bg-zinc-100'
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
          className="flex-1 p-3 bg-white/80 border border-white rounded-xl text-xs outline-none focus:ring-2 focus:ring-brand-blue"
          onKeyPress={e => e.key === 'Enter' && addItem()}
        />
        <button onClick={addItem} className="p-3 bg-zinc-900 text-white rounded-xl active:scale-95 transition-all">
          <Plus className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

const AdminEquipmentManagement = () => {
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [plants, setPlants] = useState<{id: string, name: string}[]>([]);
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

  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => setMessage(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [message]);

  useEffect(() => {
    onSnapshot(collection(db, 'plants'), (s) => setPlants(s.docs.map(d => ({id: d.id, ...d.data()} as any))));
    onSnapshot(collection(db, 'areas'), (s) => setAreas(s.docs.map(d => ({id: d.id, ...d.data()} as any))));
    return onSnapshot(collection(db, 'equipment'), (s) => setEquipment(s.docs.map(d => ({id: d.id, ...d.data()} as any))));
  }, []);

  const handleSave = async () => {
    if (!formData.name || !formData.areaId || !formData.plantId) {
      setMessage({ text: "Completa los campos obligatorios (Nombre, Planta y Área)", type: 'error' });
      return;
    }
    try {
      const id = editingEquip ? editingEquip.id : formData.name.toLowerCase().replace(/\s+/g, '-');
      await setDoc(doc(db, 'equipment', id), { 
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
      setMessage({ text: "Equipo guardado correctamente", type: 'success' });
    } catch (err: any) {
      setMessage({ text: "Error al guardar equipo", type: 'error' });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await setDoc(doc(db, 'equipment', id), { status: 'deleted' }, { merge: true });
      setMessage({ text: "Equipo eliminado correctamente", type: 'success' });
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
        className="fixed inset-0 z-[100] bg-zinc-50 flex flex-col h-screen overflow-hidden"
      >
        <div className="bg-white border-b border-zinc-100 p-4 sm:px-8 sm:py-6 flex items-center justify-between shadow-sm sticky top-0 z-10">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setShowForm(false)} 
              className="p-2 hover:bg-zinc-100 rounded-xl transition-colors text-zinc-500"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h3 className="text-xl font-bold text-zinc-900 leading-tight">
                {editingEquip ? 'Editar Equipo Industrial' : 'Configurar Nuevo Equipo'}
              </h3>
              <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Administración de Activos</p>
            </div>
          </div>
          <div className="flex gap-3">
            <button 
              onClick={() => setShowForm(false)} 
              className="hidden sm:block px-6 py-2.5 bg-zinc-100 text-zinc-600 rounded-xl font-bold text-sm hover:bg-zinc-200 transition-all"
            >
              Cancelar
            </button>
            <button 
              onClick={handleSave} 
              className="px-8 py-2.5 bg-brand-blue text-white rounded-xl font-bold text-sm hover:opacity-90 transition-all shadow-lg shadow-sky-200"
            >
              {editingEquip ? 'Actualizar' : 'Guardar Equipo'}
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-8 custom-scrollbar pb-24">
          <div className="max-w-4xl mx-auto space-y-8">
            {/* General Info Card */}
            <div className="bg-white rounded-[2.5rem] p-8 border border-zinc-100 shadow-sm space-y-6">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-brand-blue/5 rounded-xl">
                  <Settings2 className="w-5 h-5 text-brand-blue" />
                </div>
                <h4 className="font-bold text-zinc-900">Información General</h4>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest ml-1">Nombre del Equipo</label>
                  <input 
                    value={formData.name} 
                    onChange={e => setFormData({...formData, name: e.target.value})} 
                    placeholder="Ej: Motor Principal 45KW" 
                    className="w-full p-4 bg-zinc-50 border border-zinc-100 rounded-2xl outline-none focus:ring-2 focus:ring-brand-blue transition-all" 
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest ml-1">Orden de Inspección</label>
                  <input 
                    type="number"
                    value={formData.inspectionOrder} 
                    onChange={e => setFormData({...formData, inspectionOrder: parseInt(e.target.value) || 0})} 
                    placeholder="Ej: 1" 
                    className="w-full p-4 bg-zinc-50 border border-zinc-100 rounded-2xl outline-none focus:ring-2 focus:ring-brand-blue transition-all" 
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest ml-1">Planta</label>
                  <select 
                    value={formData.plantId} 
                    onChange={e => setFormData({...formData, plantId: e.target.value, areaId: ''})} 
                    className="w-full p-4 bg-zinc-50 border border-zinc-100 rounded-2xl outline-none focus:ring-2 focus:ring-brand-blue transition-all"
                  >
                    <option value="">Seleccionar Planta</option>
                    {plants.map((p, idx) => <option key={`pl-opt-3-${p.id}-${idx}`} value={p.id}>{p.name}</option>)}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest ml-1">Área</label>
                  <select 
                    value={formData.areaId} 
                    onChange={e => setFormData({...formData, areaId: e.target.value})} 
                    className="w-full p-4 bg-zinc-50 border border-zinc-100 rounded-2xl outline-none focus:ring-2 focus:ring-brand-blue transition-all" 
                    disabled={!formData.plantId}
                  >
                    <option value="">{formData.plantId ? 'Seleccionar Área' : 'Primero selecciona una Planta'}</option>
                    {areas.filter(a => a.plantId === formData.plantId).map((a, aIdx) => <option key={`ar-opt-${a.id}-${aIdx}`} value={a.id}>{a.name}</option>)}
                  </select>
                </div>
              </div>
            </div>

            {/* VOSO Methodology Card */}
            <div className="bg-white rounded-[2.5rem] p-8 border border-zinc-100 shadow-sm space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-sky-50 rounded-xl">
                    <ShieldCheck className="w-5 h-5 text-brand-blue" />
                  </div>
                  <h4 className="font-bold text-zinc-900">Configuración VOSO (Inspección Primaria)</h4>
                </div>
                <span className="text-[10px] bg-sky-50 text-brand-blue px-3 py-1 rounded-full font-bold uppercase tracking-wider">Estándar Klist</span>
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
              </div>
            </div>

            {/* CheckItems Card */}
            <div className="bg-white rounded-[2.5rem] p-8 border border-zinc-100 shadow-sm space-y-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-zinc-50 rounded-xl">
                  <ListChecks className="w-5 h-5 text-zinc-600" />
                </div>
                <h4 className="font-bold text-zinc-900">Otros Puntos de Revisión</h4>
              </div>

              <div className="space-y-3">
                {formData.checkItems.map((item, idx) => (
                  <div key={`edit-item-${item.id}-${idx}`} className="flex items-center gap-4 bg-zinc-50/50 p-4 rounded-2xl border border-zinc-100 group transition-all">
                    <div className="w-8 h-8 rounded-xl bg-white border border-zinc-100 flex items-center justify-center text-[10px] font-bold text-zinc-400">
                      {idx + 1}
                    </div>
                    <input 
                      value={item.name} 
                      onChange={e => {
                        const newItems = [...formData.checkItems];
                        newItems[idx].name = e.target.value;
                        setFormData({...formData, checkItems: newItems});
                      }}
                      className="flex-1 bg-transparent border-none p-0 text-sm font-bold text-zinc-900 focus:ring-0" 
                    />
                    <button 
                      onClick={() => {
                        const newItems = formData.checkItems.filter(i => i.id !== item.id);
                        setFormData({...formData, checkItems: newItems});
                      }}
                      className="p-2 text-red-100 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
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
                  className="flex-1 p-4 bg-zinc-100 border border-zinc-200 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-brand-blue transition-all" 
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
                  className="px-6 bg-zinc-900 text-white rounded-2xl shadow-xl active:scale-95 transition-all outline-none"
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
              className={`fixed bottom-8 left-1/2 -translate-x-1/2 z-[110] px-6 py-4 rounded-[2rem] shadow-2xl border text-sm font-bold flex items-center gap-3 ${
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
        <h3 className="font-bold text-zinc-900">Equipos Industriales</h3>
        <div className="flex items-center gap-3">
          <select 
            value={selectedPlantFilter} 
            onChange={(e) => setSelectedPlantFilter(e.target.value)}
            className="text-xs p-2 bg-zinc-50 border border-zinc-100 rounded-xl outline-none"
          >
            <option value="All">Todas las Plantas</option>
            {plants.map((p, idx) => <option key={`pl-opt-select-1-${p.id}-${idx}`} value={p.id}>{p.name}</option>)}
          </select>
          <button onClick={() => { 
            setEditingEquip(null); 
            setFormData({name:'', areaId:'', plantId: '', inspectionOrder: 0, checkItems: [], inspeccionVOSO: DEFAULT_VOSO}); 
            setShowForm(true); 
          }} className="p-2 bg-brand-blue text-white rounded-xl shadow-md shadow-sky-100">
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

      <div className="grid gap-3">
        {equipment
          .filter(e => {
            const isNotDeleted = (e as any).status !== 'deleted';
            const matchesPlant = selectedPlantFilter === 'All' || e.plantId === selectedPlantFilter;
            return isNotDeleted && matchesPlant;
          })
          .map((e, eIdx) => (
          <div key={`equip-${e.id}-${eIdx}`} className="bg-white p-4 rounded-2xl border border-zinc-100 flex justify-between items-center hover:shadow-sm transition-all">
            <div>
              <p className="font-bold text-zinc-900">
                <span className="text-zinc-400 mr-2 text-xs">#{e.inspectionOrder || '0'}</span>
                {e.name}
              </p>
              <div className="flex gap-2 items-center mt-1">
                <span className="text-[9px] bg-zinc-100 text-zinc-500 px-1.5 py-0.5 rounded font-bold uppercase">
                  Planta: {plants.find(p => p.id === e.plantId)?.name || 'Sin Planta'}
                </span>
                <span className="text-[9px] bg-zinc-50 text-zinc-400 px-1.5 py-0.5 rounded font-bold uppercase">
                  Área: {areas.find(a => a.id === e.areaId)?.name || e.areaId}
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
              }} className="p-2 text-zinc-400 hover:text-zinc-900 transition-colors">
                <FileText className="w-4 h-4" />
              </button>
              <button onClick={() => setConfirmDeleteId(e.id)} className="p-2 text-zinc-400 hover:text-red-500 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
        {equipment.filter(e => (e as any).status !== 'deleted' && (selectedPlantFilter === 'All' || e.plantId === selectedPlantFilter)).length === 0 && (
          <div className="text-center py-8 text-zinc-400 text-sm italic">
            No se encontraron equipos para esta selección
          </div>
        )}
      </div>
      <AnimatePresence>
        {message && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}
            className={`fixed top-4 right-4 z-[60] px-4 py-3 rounded-2xl shadow-xl border text-sm font-bold flex items-center gap-2 ${
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
              className="bg-white rounded-3xl p-8 max-w-sm w-full shadow-2xl space-y-6"
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
                <button onClick={() => handleDelete(confirmDeleteId)} className="flex-1 px-4 py-3 rounded-2xl bg-red-500 text-white font-bold text-sm hover:bg-red-600 transition-all shadow-lg shadow-red-200">Eliminar</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

const AdminUserManagement = () => {
  const [users, setUsers] = useState<AppUser[]>([]);
  const [plants, setPlants] = useState<{id: string, name: string}[]>([]);
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
    const unsubPlants = onSnapshot(collection(db, 'plants'), (snapshot) => {
      setPlants(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any)));
    });
    return () => {
      unsubUsers();
      unsubPlants();
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
        <h2 className="text-2xl font-bold text-zinc-900 tracking-tight">Gestión de Usuarios</h2>
        <button 
          onClick={() => { setShowForm(true); setEditingUser(null); }}
          className="p-2 bg-brand-blue text-white rounded-xl hover:opacity-90 transition-all shadow-md shadow-sky-100"
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
          <div key={`user-row-${u.uid || index}`} className="bg-white p-4 rounded-2xl border border-zinc-100 shadow-sm flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-sky-50 rounded-full flex items-center justify-center text-brand-blue font-bold">
                {u.name ? u.name[0] : '?'}
              </div>
              <div>
                <h4 className="font-bold text-zinc-900">{u.name}</h4>
                <p className="text-xs text-zinc-400">
                  {u.email.replace('@chekify.local', '')} • <span className="text-zinc-900 font-semibold">{u.role}</span>
                  {u.plantId && (
                    <span className="ml-2 text-zinc-500">• {plants.find(p => p.id === u.plantId)?.name}</span>
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
                className="p-2 text-zinc-400 hover:text-zinc-900 transition-colors"
              >
                <FileText className="w-4 h-4" />
              </button>
              <button 
                onClick={() => setResetPasswordFor(u)}
                className="p-2 text-zinc-400 hover:text-brand-blue transition-colors rounded-xl hover:bg-brand-blue/5"
                title="Reestablecer contraseña"
              >
                <div className="flex items-center gap-1.5">
                  <RotateCcw className="w-4 h-4" />
                  <span className="text-[10px] font-bold">Reseteo</span>
                </div>
              </button>
              <button 
                onClick={() => setConfirmDeleteUid(u.uid)}
                className="p-2 text-zinc-400 hover:text-red-500 transition-colors"
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
            className={`fixed top-4 right-4 z-[60] px-4 py-3 rounded-2xl shadow-xl border text-sm font-bold flex items-center gap-2 ${
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
            className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl border border-zinc-100"
          >
            <div className="w-12 h-12 bg-amber-50 rounded-2xl flex items-center justify-center text-amber-500 mb-4">
              <RotateCcw className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-zinc-900 mb-1">Cambiar Contraseña</h3>
            <p className="text-xs text-zinc-500 mb-6 font-medium leading-relaxed">
              Ingresa una nueva contraseña para <b>{resetPasswordFor.name}</b>. 
              El cambio es instantáneo y se aplicará en el próximo inicio de sesión.
            </p>
            
            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1 ml-1">Nueva Contraseña</label>
                <input 
                  type="password"
                  placeholder="Mínimo 6 caracteres"
                  value={newAdminPassword}
                  onChange={(e) => setNewAdminPassword(e.target.value)}
                  className="w-full p-4 bg-zinc-50 border border-zinc-100 rounded-2xl outline-none focus:ring-2 focus:ring-brand-blue transition-all"
                  autoFocus
                />
              </div>
            </div>

            <div className="flex gap-3">
              <button 
                onClick={() => { setResetPasswordFor(null); setNewAdminPassword(''); }}
                className="flex-1 py-4 text-xs font-bold text-zinc-400 hover:text-zinc-900 transition-colors"
                disabled={isResetting}
              >
                Cancelar
              </button>
              <button 
                onClick={handleResetPasswordDirectly}
                disabled={isResetting || newAdminPassword.length < 6}
                className="flex-1 py-4 bg-zinc-900 text-white rounded-2xl text-xs font-bold hover:bg-zinc-800 transition-all shadow-lg shadow-zinc-200 disabled:opacity-50"
              >
                {isResetting ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mx-auto" />
                ) : 'Aplicar Cambio Solicitado'}
              </button>
            </div>

            <div className="mt-4 pt-4 border-t border-zinc-50">
              <p className="text-[9px] text-zinc-400 text-center mb-3">¿Problemas con el servidor? Prueba la alternativa:</p>
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
                className="w-full py-3 bg-brand-blue/5 text-brand-blue rounded-xl text-[10px] font-bold hover:bg-brand-blue/10 transition-all"
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
              className="bg-white rounded-3xl p-8 max-w-sm w-full shadow-2xl space-y-6"
            >
              <div className="w-12 h-12 bg-red-50 rounded-2xl flex items-center justify-center text-red-500 mx-auto">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div className="text-center space-y-2">
                <h3 className="text-xl font-bold text-zinc-900">¿Eliminar usuario?</h3>
                <p className="text-zinc-500 text-sm leading-relaxed">
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
                  className="flex-1 px-4 py-3 rounded-2xl bg-red-500 text-white font-bold text-sm hover:bg-red-600 transition-all shadow-lg shadow-red-200"
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
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="relative w-full max-w-md bg-white rounded-[2.5rem] shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
              <div className="p-8 border-b border-zinc-50">
                <h3 className="text-xl font-bold text-zinc-900">{editingUser ? 'Editar Usuario' : 'Nuevo Usuario'}</h3>
              </div>
              <div className="flex-1 overflow-y-auto p-8 pt-4 custom-scrollbar">
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-zinc-700 mb-1 font-bold lowercase tracking-wider text-[10px] uppercase">Nombre</label>
                    <input 
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({...formData, name: e.target.value})}
                      className="w-full p-4 bg-zinc-50 border border-zinc-200 rounded-2xl outline-none focus:ring-2 focus:ring-brand-blue"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-zinc-700 mb-1 font-bold lowercase tracking-wider text-[10px] uppercase">Usuario</label>
                    <input 
                      type="text"
                      value={formData.email}
                      onChange={(e) => setFormData({...formData, email: e.target.value})}
                      className="w-full p-4 bg-zinc-50 border border-zinc-200 rounded-2xl outline-none focus:ring-2 focus:ring-brand-blue"
                      disabled={!!editingUser}
                      placeholder="ej. juan.perez"
                    />
                  </div>
                  {!editingUser && (
                    <div>
                      <label className="block text-sm font-medium text-zinc-700 mb-1 font-bold lowercase tracking-wider text-[10px] uppercase">Contraseña Inicial</label>
                      <input 
                        type="password"
                        value={formData.password}
                        onChange={(e) => setFormData({...formData, password: e.target.value})}
                        className="w-full p-4 bg-zinc-50 border border-zinc-200 rounded-2xl outline-none focus:ring-2 focus:ring-brand-blue"
                        placeholder="Mínimo 6 caracteres"
                      />
                    </div>
                  )}
                  <div>
                    <label className="block text-sm font-medium text-zinc-700 mb-1 font-bold lowercase tracking-wider text-[10px] uppercase">Planta</label>
                    <select 
                      value={formData.plantId}
                      onChange={(e) => setFormData({...formData, plantId: e.target.value})}
                      className="w-full p-4 bg-zinc-50 border border-zinc-200 rounded-2xl outline-none focus:ring-2 focus:ring-brand-blue"
                    >
                      <option value="">Seleccionar Planta</option>
                      {plants.map((p, idx) => (
                        <option key={`pl-opt-select-2-${p.id}-${idx}`} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-zinc-700 mb-1 font-bold lowercase tracking-wider text-[10px] uppercase">Rol</label>
                    <select 
                      value={formData.role}
                      onChange={(e) => setFormData({...formData, role: e.target.value as UserRole})}
                      className="w-full p-4 bg-zinc-50 border border-zinc-200 rounded-2xl outline-none focus:ring-2 focus:ring-brand-blue"
                    >
                      <option value="Operador">Operador</option>
                      <option value="Supervisor">Supervisor</option>
                      <option value="Administrador">Administrador</option>
                    </select>
                  </div>
                </div>
              </div>
              <div className="p-8 border-t border-zinc-50 bg-zinc-50/50">
                <div className="flex gap-3">
                  <button onClick={() => setShowForm(false)} className="flex-1 py-4 bg-zinc-100 text-zinc-600 rounded-2xl font-bold hover:bg-zinc-200 transition-colors">Cancelar</button>
                  <button 
                    disabled={isSaving}
                    onClick={handleSaveUser} 
                    className={`flex-1 py-4 bg-brand-blue text-white rounded-2xl font-bold transition-colors shadow-lg shadow-sky-100 flex items-center justify-center gap-2 ${isSaving ? 'opacity-50 cursor-not-allowed' : 'hover:opacity-90'}`}
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

// --- Error Boundary ---
export default function App() {
  const [activeTab, setActiveTab] = useState<'Home' | 'History' | 'Admin'>('Home');
  const [currentTime, setCurrentTime] = useState(new Date());
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showNotificationCenter, setShowNotificationCenter] = useState(false);
  const [isOffline, setIsOffline] = useState(false);

  return (
    <AuthWrapper>
      {(user) => (
        <AppLayout 
          user={user} 
          notifications={notifications} 
          setNotifications={setNotifications} 
          showNotificationCenter={showNotificationCenter}
          setShowNotificationCenter={setShowNotificationCenter}
          isOffline={isOffline}
          setIsOffline={setIsOffline}
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
  setIsOffline
}: { 
  user: AppUser, 
  notifications: Notification[], 
  setNotifications: (n: Notification[]) => void,
  showNotificationCenter: boolean,
  setShowNotificationCenter: (s: boolean) => void,
  isOffline: boolean,
  setIsOffline: (o: boolean) => void
}) => {
  const [activeTab, setActiveTab] = useState<'Home' | 'History' | 'Admin' | 'Notifications' | 'PDFConfig'>('Home');
  const [currentTime, setCurrentTime] = useState(new Date());
  const [pendingFindingId, setPendingFindingId] = useState<string | null>(null);

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
    <div className="min-h-screen bg-zinc-50 bg-concrete flex flex-col md:flex-row">
          {/* Sidebar Navigation (Desktop & Tablet) */}
          <aside className="hidden md:flex flex-col w-64 bg-white border-r border-zinc-100 h-screen sticky top-0 z-40 p-6">
            <div className="flex items-center gap-3 mb-10 px-2 h-10">
              <Logo />
            </div>

            <div className="flex-1 space-y-2">
              <button 
                onClick={() => setActiveTab('Home')}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl transition-all font-bold text-sm ${
                  activeTab === 'Home' ? 'bg-brand-blue text-white shadow-md shadow-sky-100' : 'text-zinc-500 hover:bg-zinc-50'
                }`}
              >
                <LayoutDashboard className="w-5 h-5" />
                <span>Panel</span>
              </button>
              <button 
                onClick={() => setActiveTab('History')}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl transition-all font-bold text-sm ${
                  activeTab === 'History' ? 'bg-brand-blue text-white shadow-md shadow-sky-100' : 'text-zinc-500 hover:bg-zinc-50'
                }`}
              >
                <History className="w-5 h-5" />
                <span>Historial</span>
              </button>
              {user.role === 'Administrador' && (
                <>
                  <button 
                    onClick={() => setActiveTab('Admin')}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl transition-all font-bold text-sm ${
                      activeTab === 'Admin' ? 'bg-brand-blue text-white shadow-md shadow-sky-100' : 'text-zinc-500 hover:bg-zinc-50'
                    }`}
                  >
                    <Users className="w-5 h-5" />
                    <span>Administración</span>
                  </button>
                  <button 
                    onClick={() => setActiveTab('Notifications')}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl transition-all font-bold text-sm ${
                      activeTab === 'Notifications' ? 'bg-brand-blue text-white shadow-md shadow-sky-100' : 'text-zinc-500 hover:bg-zinc-50'
                    }`}
                  >
                    <Bell className="w-5 h-5" />
                    <span>Notificaciones</span>
                  </button>
                  <button 
                    onClick={() => setActiveTab('PDFConfig')}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl transition-all font-bold text-sm ${
                      activeTab === 'PDFConfig' ? 'bg-brand-blue text-white shadow-md shadow-sky-100' : 'text-zinc-500 hover:bg-zinc-50'
                    }`}
                  >
                    <Shield className="w-5 h-5" />
                    <span>Configuración PDF</span>
                  </button>
                </>
              )}
            </div>

            <div className="mt-auto space-y-4">
              <div className="px-4 py-4 bg-zinc-50 rounded-2xl">
                <p className="text-[8px] font-bold text-zinc-400 uppercase tracking-[0.2em] mb-1">
                  {user.role}
                </p>
                <p className="text-xs font-bold text-zinc-900 truncate">{user.name}</p>
                <p className="text-[10px] text-zinc-400 truncate mt-1">{user.email.replace('@chekify.local', '')}</p>
              </div>
              <button 
                onClick={() => signOut(auth)}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-red-500 hover:bg-red-50 transition-all font-bold text-sm"
              >
                <LogOut className="w-5 h-5" />
                <span>Cerrar Sesión</span>
              </button>
              <div className="text-center pt-2">
                <p className="text-[8px] font-bold text-zinc-300 uppercase tracking-[0.2em]">Powered by maisser.cl</p>
              </div>
            </div>
          </aside>

          {/* Main Content Area */}
          <div className="flex-1 flex flex-col min-w-0">
            {/* Header (Mobile & Sticky desktop header) */}
            <header className="bg-white border-b border-zinc-100 px-6 py-4 sticky top-0 z-40 backdrop-blur-md bg-white/80">
              <div className="max-w-4xl mx-auto flex items-center justify-between">
                {/* Mobile Identity */}
                <div className="flex items-center gap-3 md:hidden h-10">
                  <Logo />
                </div>

                {/* Welcome & Time (Desktop) */}
                <div className="hidden md:flex flex-col">
                  <div className="flex items-center gap-2">
                    <h2 className="text-zinc-900 font-bold text-lg leading-tight">
                      ¡Bienvenido! {user.name}
                    </h2>
                    {isOffline && (
                      <span className="flex items-center gap-1 px-2 py-0.5 bg-red-50 border border-red-100 text-red-600 text-[8px] font-bold uppercase rounded-full animate-pulse">
                        <AlertCircle className="w-2.5 h-2.5" />
                        Desconectado
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-zinc-400 font-medium">
                    {format(currentTime, "EEEE, dd 'de' MMMM • HH:mm:ss", { locale: es })}
                  </p>
                </div>

                <div className="flex items-center gap-4">
                  <button 
                    onClick={() => setShowNotificationCenter(true)}
                    className="relative text-zinc-400 hover:text-zinc-900 transition-colors p-2"
                  >
                    <Bell className="w-6 h-6" />
                    {unreadCount > 0 && (
                      <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-[8px] font-bold rounded-full flex items-center justify-center border-2 border-white animate-pulse-subtle">
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
            <main className="flex-1 p-6 md:p-10 max-w-4xl mx-auto w-full mb-24 md:mb-0">
              <NotificationCenter 
                show={showNotificationCenter}
                onClose={() => setShowNotificationCenter(false)}
                notifications={notifications}
                onDismiss={handleDismissNotification}
                onRead={handleMarkAsRead}
                onAction={handleNotificationAction}
                readIds={user.readNotifications || []}
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
                      <OperatorDashboard user={user} />
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
                    <AdminManagement />
                  </motion.div>
                )}
                {activeTab === 'Notifications' && (
                  <motion.div 
                    key="admin-notifications"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                  >
                    <AdminNotificationManagement />
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
              </AnimatePresence>
            </main>

            {/* Mobile Navigation */}
            <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-zinc-100 px-6 pt-4 pb-2 z-40">
              <div className="max-w-2xl mx-auto flex items-center justify-around mb-2">
                <button 
                  onClick={() => setActiveTab('Home')}
                  className={`flex flex-col items-center gap-1 transition-all ${activeTab === 'Home' ? 'text-zinc-900' : 'text-zinc-400'}`}
                >
                  <LayoutDashboard className="w-6 h-6" />
                  <span className="text-[10px] font-bold uppercase tracking-widest">Inicio</span>
                </button>
                <button 
                  onClick={() => setActiveTab('History')}
                  className={`flex flex-col items-center gap-1 transition-all ${activeTab === 'History' ? 'text-zinc-900' : 'text-zinc-400'}`}
                >
                  <History className="w-6 h-6" />
                  <span className="text-[10px] font-bold uppercase tracking-widest">Historial</span>
                </button>
                {user.role === 'Administrador' && (
                  <>
                    <button 
                      onClick={() => setActiveTab('Admin')}
                      className={`flex flex-col items-center gap-1 transition-all ${activeTab === 'Admin' ? 'text-zinc-900' : 'text-zinc-400'}`}
                    >
                      <Users className="w-6 h-6" />
                      <span className="text-[10px] font-bold uppercase tracking-widest text-center leading-[1]">General</span>
                    </button>
                    <button 
                      onClick={() => setActiveTab('Notifications')}
                      className={`flex flex-col items-center gap-1 transition-all ${activeTab === 'Notifications' ? 'text-zinc-900' : 'text-zinc-400'}`}
                    >
                      <Bell className="w-6 h-6" />
                      <span className="text-[10px] font-bold uppercase tracking-widest text-center leading-[1]">Msjes</span>
                    </button>
                    <button 
                      onClick={() => setActiveTab('PDFConfig')}
                      className={`flex flex-col items-center gap-1 transition-all ${activeTab === 'PDFConfig' ? 'text-zinc-900' : 'text-zinc-400'}`}
                    >
                      <Shield className="w-6 h-6" />
                      <span className="text-[10px] font-bold uppercase tracking-widest text-center leading-[1]">PDF</span>
                    </button>
                  </>
                )}
              </div>
              <div className="text-center">
                <p className="text-[8px] font-bold text-zinc-300 uppercase tracking-[0.2em]">Powered by maisser.cl</p>
              </div>
            </nav>
          </div>
    </div>
  );
};
