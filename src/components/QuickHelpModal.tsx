import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, HelpCircle, Lightbulb, CheckCircle2, ShieldCheck, Activity, Sparkles, QrCode, FileSpreadsheet, ArrowRight } from 'lucide-react';

export interface ModuleHelpContent {
  title: string;
  badge: string;
  description: string;
  tips: {
    icon: React.ElementType;
    title: string;
    text: string;
  }[];
}

const MODULE_HELP_DATA: Record<string, ModuleHelpContent> = {
  'Inspeccion': {
    title: 'Inspección Primaria de Planta',
    badge: 'Módulo de Terreno',
    description: 'Guía práctica para realizar inspecciones operativas, escanear códigos QR y reportar hallazgos VOSO.',
    tips: [
      {
        icon: QrCode,
        title: 'Escanear Código QR',
        text: 'Utiliza el botón "Escanear QR" para identificar inmediatamente la planta, área o equipo específico antes de iniciar el checklist.'
      },
      {
        icon: CheckCircle2,
        title: 'Verificación VOSO',
        text: 'Evalúa la condición con tus sentidos (Ver, Oír, Sentir, Oler). Registra desviaciones adjuntando fotografías comprimidas.'
      },
      {
        icon: ShieldCheck,
        title: 'Modo Offline Automático',
        text: 'Si pierdes señal en terreno, tus inspecciones se guardan localmente y se sincronizan al recuperar la conectividad.'
      }
    ]
  },
  'VOSO': {
    title: 'Panel VOSO (Ver, Oír, Sentir, Oler)',
    badge: 'Panel Administrador',
    description: 'Consolidador de hallazgos HSEC, gestión de criticidades y seguimiento de acciones correctivas.',
    tips: [
      {
        icon: Activity,
        title: 'Evaluación de Criticidad',
        text: 'Filtra hallazgos por nivel de riesgo (Baja, Media, Alta, Crítica) para priorizar las acciones correctivas inmediatas.'
      },
      {
        icon: FileSpreadsheet,
        title: 'Reportes y Exportación',
        text: 'Exporta consolidados en formato CSV o PDF corporativo para enviar en reuniones diarias de seguridad (DDS).'
      },
      {
        icon: CheckCircle2,
        title: 'Cierre de Acciones',
        text: 'Cambia el estado de los hallazgos a "Resuelto" adjuntando evidencia de la mejora efectuada en planta.'
      }
    ]
  },
  '5S': {
    title: 'Orden y Limpieza (5S)',
    badge: 'Módulo Especializado',
    description: 'Gestión y control de orden, aseo industrial, manejo de residuos y estandarización 5S.',
    tips: [
      {
        icon: Sparkles,
        title: 'Categorías 5S',
        text: 'Clasifica las desviaciones en Clasificar (Seiri), Ordenar (Seiton), Limpiar (Seiso), Estandarizar (Seiketsu) y Disciplina (Shitsuke).'
      },
      {
        icon: Lightbulb,
        title: 'Filtros Rápidos',
        text: 'Filtra por planta, nivel de criticidad o tipo de hallazgo (residuos, derrames, herramientas) para auditorías rápidas.'
      },
      {
        icon: FileSpreadsheet,
        title: 'Exportación Directa',
        text: 'Genera informes de auditoría 5S en PDF con un solo clic para presentación en comités de excelencia operacional.'
      }
    ]
  }
};

interface ModuleColorTheme {
  headerBg: string;
  badgeBg: string;
  badgeText: string;
  badgeBorder: string;
  badgeIcon: string;
  glowColor: string;
  buttonBg: string;
  buttonShadow: string;
  tipIconBg: string;
  tipIconText: string;
  tipIconBorder: string;
}

const MODULE_THEMES: Record<string, ModuleColorTheme> = {
  'Inspeccion': {
    headerBg: 'bg-gradient-to-r from-sky-950 via-blue-900 to-indigo-950',
    badgeBg: 'bg-sky-500/20',
    badgeText: 'text-sky-200',
    badgeBorder: 'border-sky-400/30',
    badgeIcon: 'text-sky-300',
    glowColor: 'bg-sky-500/10',
    buttonBg: 'bg-sky-600 hover:bg-sky-500',
    buttonShadow: 'shadow-sky-600/30',
    tipIconBg: 'bg-sky-500/10',
    tipIconText: 'text-sky-600 dark:text-sky-400',
    tipIconBorder: 'border-sky-500/20'
  },
  'VOSO': {
    headerBg: 'bg-gradient-to-r from-slate-950 via-emerald-950 to-zinc-950',
    badgeBg: 'bg-emerald-500/20',
    badgeText: 'text-emerald-200',
    badgeBorder: 'border-emerald-400/30',
    badgeIcon: 'text-emerald-300',
    glowColor: 'bg-emerald-500/10',
    buttonBg: 'bg-emerald-600 hover:bg-emerald-500',
    buttonShadow: 'shadow-emerald-600/30',
    tipIconBg: 'bg-emerald-500/10',
    tipIconText: 'text-emerald-600 dark:text-emerald-400',
    tipIconBorder: 'border-emerald-500/20'
  },
  '5S': {
    headerBg: 'bg-gradient-to-r from-slate-950 via-purple-950 to-indigo-950',
    badgeBg: 'bg-purple-500/20',
    badgeText: 'text-purple-200',
    badgeBorder: 'border-purple-400/30',
    badgeIcon: 'text-purple-300',
    glowColor: 'bg-purple-500/10',
    buttonBg: 'bg-purple-600 hover:bg-purple-500',
    buttonShadow: 'shadow-purple-600/30',
    tipIconBg: 'bg-purple-500/10',
    tipIconText: 'text-purple-600 dark:text-purple-400',
    tipIconBorder: 'border-purple-500/20'
  }
};

interface QuickHelpModalProps {
  isOpen: boolean;
  onClose: () => void;
  moduleKey?: 'Inspeccion' | 'VOSO' | '5S' | string;
}

export const QuickHelpModal: React.FC<QuickHelpModalProps> = ({
  isOpen,
  onClose,
  moduleKey = 'Inspeccion'
}) => {
  if (!isOpen) return null;

  const content = MODULE_HELP_DATA[moduleKey] || MODULE_HELP_DATA['Inspeccion'];
  const theme = MODULE_THEMES[moduleKey] || MODULE_THEMES['Inspeccion'];

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

        {/* Modal Window */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="relative w-full max-w-lg bg-white dark:bg-zinc-950 rounded-3xl border border-zinc-200/80 dark:border-white/10 shadow-2xl overflow-hidden z-10 my-auto"
        >
          {/* Header Banner */}
          <div className={`${theme.headerBg} p-6 text-white relative overflow-hidden`}>
            <div className={`absolute top-0 right-0 w-48 h-48 ${theme.glowColor} rounded-full -mr-16 -mt-16 blur-2xl pointer-events-none`} />
            <div className="relative z-10 flex items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className={`px-2.5 py-0.5 ${theme.badgeBg} border ${theme.badgeBorder} ${theme.badgeText} rounded-full text-[10px] font-black uppercase tracking-wider flex items-center gap-1`}>
                    <HelpCircle className={`w-3 h-3 ${theme.badgeIcon}`} />
                    {content.badge}
                  </span>
                </div>
                <h3 className="text-lg sm:text-xl font-black uppercase tracking-tight">{content.title}</h3>
                <p className="text-xs text-white/80 font-medium leading-relaxed">
                  {content.description}
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

          {/* Tips Content */}
          <div className="p-5 sm:p-6 space-y-4 max-h-[70vh] overflow-y-auto">
            <h4 className="text-xs font-black uppercase tracking-wider text-zinc-400 dark:text-zinc-500 flex items-center gap-1.5">
              <Lightbulb className="w-3.5 h-3.5 text-amber-500" />
              Consejos Clave de Uso
            </h4>

            <div className="space-y-3">
              {content.tips.map((tip, idx) => {
                const IconComponent = tip.icon;
                return (
                  <div
                    key={idx}
                    className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200/60 dark:border-white/5 flex items-start gap-3.5"
                  >
                    <div className={`p-2.5 rounded-xl ${theme.tipIconBg} ${theme.tipIconText} border ${theme.tipIconBorder} shrink-0`}>
                      <IconComponent className="w-4 h-4" />
                    </div>
                    <div className="space-y-1 min-w-0">
                      <h5 className="text-xs font-black text-zinc-900 dark:text-white uppercase tracking-tight">
                        {tip.title}
                      </h5>
                      <p className="text-xs text-zinc-600 dark:text-zinc-400 font-medium leading-relaxed">
                        {tip.text}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Footer Close Action */}
            <div className="pt-3 border-t border-zinc-200/80 dark:border-white/10 flex justify-end">
              <button
                onClick={onClose}
                className={`px-5 py-2.5 rounded-2xl ${theme.buttonBg} text-white font-black text-xs uppercase tracking-wider shadow-lg ${theme.buttonShadow} flex items-center gap-2 transition-all active:scale-95 cursor-pointer`}
              >
                <span>Entendido</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
