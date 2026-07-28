import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  Camera, 
  User, 
  Mail, 
  Phone, 
  Briefcase, 
  Building2, 
  IdCard, 
  Check, 
  Loader2, 
  Trash2, 
  Sparkles, 
  ShieldCheck, 
  Upload,
  AlertCircle
} from 'lucide-react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { AppUser } from '../types';
import { showToast } from '../App';

interface UserProfileModalProps {
  user: AppUser;
  isOpen: boolean;
  onClose: () => void;
  plants?: { id: string; name: string }[];
}

/**
 * Micro-compress avatar images to a square 150x150 webp canvas.
 * Produces ~4KB - 12KB payload, minimizing Firestore storage usage
 * and ensuring lightning fast loading on basic/free tier plans.
 */
const compressAvatarImage = (base64Str: string): Promise<string> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.src = base64Str;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const TARGET_SIZE = 150; // 150x150px avatar is super sharp and minimal byte size
      canvas.width = TARGET_SIZE;
      canvas.height = TARGET_SIZE;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        // High quality smooth image scaling
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';

        // Centered square crop
        const minDim = Math.min(img.width, img.height);
        const sx = (img.width - minDim) / 2;
        const sy = (img.height - minDim) / 2;
        ctx.drawImage(img, sx, sy, minDim, minDim, 0, 0, TARGET_SIZE, TARGET_SIZE);
      }
      // Compress with 0.65 WebP
      const compressedDataUrl = canvas.toDataURL('image/webp', 0.65);
      resolve(compressedDataUrl);
    };
    img.onerror = () => resolve(base64Str);
  });
};

export const UserProfileModal: React.FC<UserProfileModalProps> = ({
  user,
  isOpen,
  onClose,
  plants = []
}) => {
  const [name, setName] = useState(user.name || '');
  const [email, setEmail] = useState(user.email || '');
  const [phone, setPhone] = useState(user.phone || '');
  const [cargo, setCargo] = useState(user.cargo || '');
  const [rut, setRut] = useState(user.rut || '');
  const [departamento, setDepartamento] = useState(user.departamento || '');
  const [plantId, setPlantId] = useState(user.plantId || '');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(user.avatarUrl || null);

  const [saving, setSaving] = useState(false);
  const [compressing, setCompressing] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Re-sync local state when user prop updates
  React.useEffect(() => {
    setName(user.name || '');
    setEmail(user.email || '');
    setPhone(user.phone || '');
    setCargo(user.cargo || '');
    setRut(user.rut || '');
    setDepartamento(user.departamento || '');
    setPlantId(user.plantId || '');
    setAvatarUrl(user.avatarUrl || null);
  }, [user]);

  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate type
    if (!file.type.startsWith('image/')) {
      setFileError('Por favor selecciona un archivo de imagen válido (JPG, PNG, WEBP).');
      return;
    }

    setFileError(null);
    setCompressing(true);

    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const rawBase64 = event.target?.result as string;
        if (rawBase64) {
          const tinyAvatar = await compressAvatarImage(rawBase64);
          setAvatarUrl(tinyAvatar);
        }
        setCompressing(false);
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.error("Error processing avatar:", err);
      setFileError('Error al procesar la imagen de perfil.');
      setCompressing(false);
    }
  };

  const handleRemovePhoto = () => {
    setAvatarUrl(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      showToast('Atención', 'El nombre no puede estar vacío.', 'warning');
      return;
    }

    setSaving(true);
    try {
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim(),
        cargo: cargo.trim(),
        rut: rut.trim(),
        departamento: departamento.trim(),
        plantId: plantId || null,
        avatarUrl: avatarUrl || null
      });

      showToast('Perfil Actualizado', 'Los datos personales y foto de perfil han sido guardados.', 'success');
      onClose();
    } catch (err: any) {
      console.error("Error updating user profile:", err);
      showToast('Error', 'No se pudieron guardar las modificaciones en el servidor.', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[999] flex items-center justify-center p-3 sm:p-4 sm:p-6 overflow-y-auto">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm cursor-pointer"
        />

        {/* Modal Container */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="relative w-full max-w-2xl bg-white dark:bg-zinc-950 rounded-3xl border border-zinc-200/80 dark:border-white/10 shadow-2xl overflow-hidden z-10 my-auto"
        >
          {/* Header Banner */}
          <div className="bg-gradient-to-r from-sky-900 via-blue-900 to-indigo-950 p-6 sm:p-8 text-white relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-sky-500/10 rounded-full -mr-20 -mt-20 blur-2xl pointer-events-none" />
            <div className="relative z-10 flex items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 bg-sky-500/20 border border-sky-400/30 text-sky-200 rounded-full text-[10px] font-black uppercase tracking-wider flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3 text-sky-300" />
                    {user.role}
                  </span>
                  <span className="px-2 py-0.5 bg-white/10 text-white/80 rounded-full text-[10px] font-bold uppercase tracking-wider">
                    Ficha de Usuario
                  </span>
                </div>
                <h3 className="text-xl sm:text-2xl font-black uppercase tracking-tight">Mi Perfil Personal</h3>
                <p className="text-xs text-sky-100/80 font-medium">
                  Personaliza tu foto, información de contacto y credenciales operativas.
                </p>
              </div>

              <button
                onClick={onClose}
                className="p-2 rounded-2xl bg-white/10 hover:bg-white/20 text-white/80 hover:text-white transition-all shrink-0 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Form Body */}
          <form onSubmit={handleSave} className="p-5 sm:p-7 space-y-6 max-h-[80vh] overflow-y-auto">
            
            {/* Profile Avatar Upload Section */}
            <div className="bg-zinc-50 dark:bg-zinc-900/60 p-5 rounded-2xl border border-zinc-200/60 dark:border-white/5 flex flex-col sm:flex-row items-center gap-5">
              <div className="relative group shrink-0">
                <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-3xl bg-gradient-to-tr from-sky-600 to-blue-600 text-white font-black text-3xl flex items-center justify-center border-2 border-white dark:border-zinc-800 shadow-lg overflow-hidden relative">
                  {avatarUrl ? (
                    <img 
                      src={avatarUrl} 
                      alt={name || 'Avatar'} 
                      className="w-full h-full object-cover" 
                    />
                  ) : (
                    <span>{name?.charAt(0)?.toUpperCase() || user.email?.charAt(0)?.toUpperCase() || 'U'}</span>
                  )}

                  {compressing && (
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center text-white">
                      <Loader2 className="w-8 h-8 animate-spin" />
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute -bottom-1 -right-1 p-2 bg-sky-600 hover:bg-sky-500 text-white rounded-2xl shadow-md transition-all active:scale-95 cursor-pointer border border-white/30"
                  title="Cambiar foto de perfil"
                >
                  <Camera className="w-4 h-4" />
                </button>
              </div>

              <div className="flex-1 space-y-2 text-center sm:text-left min-w-0">
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                  <h4 className="text-sm font-black text-zinc-900 dark:text-white uppercase tracking-tight">Foto de Perfil</h4>
                  <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20">
                    Auto-Optimizado (&lt;10 KB)
                  </span>
                </div>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 font-medium leading-relaxed">
                  Sube una foto clara. La imagen se redimensiona y comprime automáticamente para conservar el mínimo espacio en la nube.
                </p>

                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handlePhotoSelect}
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                />

                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={compressing}
                    className="px-3.5 py-2 bg-sky-50 dark:bg-sky-500/10 hover:bg-sky-100 dark:hover:bg-sky-500/20 text-sky-700 dark:text-sky-300 font-black text-xs uppercase tracking-wider rounded-xl border border-sky-200 dark:border-sky-500/30 flex items-center gap-1.5 transition-all cursor-pointer"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>{avatarUrl ? 'Cambiar Foto' : 'Subir Foto'}</span>
                  </button>

                  {avatarUrl && (
                    <button
                      type="button"
                      onClick={handleRemovePhoto}
                      className="px-3 py-2 bg-red-50 dark:bg-red-500/10 hover:bg-red-100 text-red-600 dark:text-red-400 font-extrabold text-xs uppercase tracking-wider rounded-xl border border-red-200 dark:border-red-500/20 flex items-center gap-1.5 transition-all cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Quitar</span>
                    </button>
                  )}
                </div>

                {fileError && (
                  <p className="text-xs text-red-500 font-bold flex items-center gap-1 mt-1">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>{fileError}</span>
                  </p>
                )}
              </div>
            </div>

            {/* Form Fields Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              
              {/* Full Name */}
              <div className="space-y-1.5">
                <label className="text-xs font-black uppercase tracking-wider text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-sky-500" />
                  Nombre Completo *
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ej: Juan Pérez Morales"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-white text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-sky-500 transition-all"
                />
              </div>

              {/* Email Address */}
              <div className="space-y-1.5">
                <label className="text-xs font-black uppercase tracking-wider text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-sky-500" />
                  Correo Electrónico
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="ejemplo@empresa.cl"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-white text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-sky-500 transition-all"
                />
              </div>

              {/* RUT / Identification */}
              <div className="space-y-1.5">
                <label className="text-xs font-black uppercase tracking-wider text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                  <IdCard className="w-3.5 h-3.5 text-sky-500" />
                  RUT / ID de Identificación
                </label>
                <input
                  type="text"
                  value={rut}
                  onChange={(e) => setRut(e.target.value)}
                  placeholder="Ej: 12.345.678-9"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-white text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-sky-500 transition-all"
                />
              </div>

              {/* Phone Number */}
              <div className="space-y-1.5">
                <label className="text-xs font-black uppercase tracking-wider text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-sky-500" />
                  Teléfono de Contacto
                </label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="Ej: +56 9 8765 4321"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-white text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-sky-500 transition-all"
                />
              </div>

              {/* Cargo / Job Title */}
              <div className="space-y-1.5">
                <label className="text-xs font-black uppercase tracking-wider text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                  <Briefcase className="w-3.5 h-3.5 text-sky-500" />
                  Cargo / Función
                </label>
                <input
                  type="text"
                  value={cargo}
                  onChange={(e) => setCargo(e.target.value)}
                  placeholder="Ej: Supervisor HSEC / Operador Senior"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-white text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-sky-500 transition-all"
                />
              </div>

              {/* Departamento / Area */}
              <div className="space-y-1.5">
                <label className="text-xs font-black uppercase tracking-wider text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-sky-500" />
                  Departamento / Área
                </label>
                <input
                  type="text"
                  value={departamento}
                  onChange={(e) => setDepartamento(e.target.value)}
                  placeholder="Ej: Mantenimiento & Planta"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-white text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-sky-500 transition-all"
                />
              </div>

              {/* Plant Select (if available) */}
              {plants.length > 0 && (
                <div className="space-y-1.5 sm:col-span-2">
                  <label className="text-xs font-black uppercase tracking-wider text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-sky-500" />
                    Planta Asignada
                  </label>
                  <select
                    value={plantId}
                    onChange={(e) => setPlantId(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-white text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-sky-500 transition-all"
                  >
                    <option value="">Planta General (Todas)</option>
                    {plants.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Role Readonly Badge */}
            <div className="p-3.5 rounded-2xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-sky-600 dark:text-sky-400 shrink-0" />
                <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider">
                  Rol de Sistema: <strong className="text-sky-600 dark:text-sky-400">{user.role}</strong>
                </span>
              </div>
              <span className="text-[10px] text-zinc-400 font-semibold">ID: {user.uid.substring(0, 8)}...</span>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-zinc-200/80 dark:border-white/10">
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2.5 rounded-2xl border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 font-bold text-xs uppercase tracking-wider hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-all cursor-pointer"
              >
                Cancelar
              </button>

              <button
                type="submit"
                disabled={saving || compressing}
                className="px-6 py-2.5 rounded-2xl bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-500 hover:to-blue-500 text-white font-black text-xs uppercase tracking-wider shadow-lg shadow-sky-600/30 flex items-center gap-2 transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Guardando...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Guardar Cambios</span>
                  </>
                )}
              </button>
            </div>

          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
