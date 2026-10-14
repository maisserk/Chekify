import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  AlertTriangle,
  Sun,
  CloudRain,
  Zap,
  Wind,
  Thermometer,
  ShieldCheck,
  CheckCircle2,
  HardHat,
  Glasses,
  Footprints,
  Droplets,
  Radio,
  Eye,
  RefreshCw,
  X,
  ChevronRight,
  ShieldAlert,
  Info,
  Sparkles,
  MapPin,
  Clock,
  Shirt
} from 'lucide-react';
import { weatherService, WeatherData, getUVLevelInfo, getWeatherDescription } from '../services/weatherService';
import { Area, Equipment, Plant } from '../types';

interface WeatherSafetyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  area: Area | null;
  equipment?: Equipment | null;
  weather?: WeatherData | null;
  loadingWeather?: boolean;
  plant?: Plant | null;
}

export const WeatherSafetyModal: React.FC<WeatherSafetyModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  area,
  equipment,
  weather: initialWeather = null,
  loadingWeather = false,
  plant = null
}) => {
  const [currentWeather, setCurrentWeather] = useState<WeatherData | null>(initialWeather);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);
  const [checkedEpp, setCheckedEpp] = useState<Record<string, boolean>>({
    helmet: true,
    glasses: true,
    sunscreen: true,
    vest: true,
    gloves: true,
    footwear: true,
    longSleeve: true,
    hydration: true
  });

  useEffect(() => {
    if (initialWeather) {
      setCurrentWeather(initialWeather);
    }
  }, [initialWeather]);

  // If weather was not passed or is null, fetch live weather for plant
  useEffect(() => {
    if (isOpen && !currentWeather) {
      fetchLiveWeather();
    }
  }, [isOpen]);

  const fetchLiveWeather = async () => {
    setIsRefreshing(true);
    try {
      const data = await weatherService.getCurrentWeather(
        plant?.latitude,
        plant?.longitude,
        plant?.timezone
      );
      if (data) {
        setCurrentWeather(data);
      }
    } catch (e) {
      console.warn('[WeatherSafetyModal] Error fetching weather:', e);
    } finally {
      setIsRefreshing(false);
    }
  };

  const displayArea = area || { id: 'general', name: 'Ronda de Inspección de Planta', plantId: plant?.id };

  // Weather parameters extraction
  const temp = currentWeather?.temperature !== undefined ? parseFloat(String(currentWeather.temperature)) : 22;
  const apparentTemp = currentWeather?.apparentTemperature !== undefined ? parseFloat(String(currentWeather.apparentTemperature)) : temp;
  const humidity = currentWeather?.humidity !== undefined ? parseFloat(String(currentWeather.humidity)) : 45;
  const windSpeed = currentWeather?.windSpeed !== undefined ? parseFloat(String(currentWeather.windSpeed)) : 12;
  const windGusts = currentWeather?.windGusts !== undefined ? parseFloat(String(currentWeather.windGusts)) : 18;
  const precipitation = currentWeather?.precipitation !== undefined ? parseFloat(String(currentWeather.precipitation)) : 0;
  const rain = currentWeather?.rain !== undefined ? parseFloat(String(currentWeather.rain)) : 0;
  const uvRaw = currentWeather?.uvIndex !== undefined ? currentWeather.uvIndex : 5.5;
  const uvVal = typeof uvRaw === 'number' ? uvRaw : parseFloat(String(uvRaw)) || 5.0;
  const uvInfo = getUVLevelInfo(uvVal);
  const weatherCode = currentWeather?.weatherCode ?? 0;
  const weatherSymbol = currentWeather?.symbol || getWeatherDescription(weatherCode);

  // Conditions analysis
  const hasThunderstorm = [95, 96, 99].includes(weatherCode) || /tormenta|rayo|eléctric/i.test(weatherSymbol);
  const hasRain = precipitation > 0 || rain > 0 || [51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82].includes(weatherCode) || /lluvia|llovizna|chubasco/i.test(weatherSymbol);
  const isHighUV = uvVal >= 6;
  const isExtremeUV = uvVal >= 11;
  const isHighWind = windSpeed >= 35 || windGusts >= 50;
  const isExtremeHeat = temp >= 30;
  const isExtremeCold = temp <= 5;

  const toggleEpp = (key: string) => {
    setCheckedEpp(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const eppList = [
    {
      id: 'helmet',
      title: 'Casco con Barbiquejo y Legionario (NCh 461)',
      desc: isHighUV ? 'Exigencia MINSAL / DS 594: Legionario obligatorio para proteger cuello y orejas de radiación solar.' : 'Barbiquejo abrochado para evitar caídas del casco con viento.',
      icon: HardHat,
      color: 'text-amber-500 bg-amber-500/10 border-amber-500/30'
    },
    {
      id: 'glasses',
      title: 'Lentes con Filtro UV 100% y Sello Lateral',
      desc: isHighUV ? 'Protección UV400 contra deslumbramiento solar e impacto de partículas volantes.' : 'Lentes oscuros o fotocromáticos con protección lateral certificada.',
      icon: Glasses,
      color: 'text-sky-500 bg-sky-500/10 border-sky-500/30'
    },
    {
      id: 'sunscreen',
      title: 'Protector Solar FPS 50+ Certificado ISP (DS 594 Art. 109a)',
      desc: isHighUV ? 'Aplicar en rostro, cuello, brazos y orejas 20 min antes de la ronda. Reaplicar cada 2 horas.' : 'Fotoprotección obligatoria según Guía Técnica de Radiación UV del MINSAL.',
      icon: Sun,
      color: 'text-orange-500 bg-orange-500/10 border-orange-500/30'
    },
    {
      id: 'vest',
      title: 'Chaleco Reflectante Alta Visibilidad (NCh 3253)',
      desc: 'Cintas retrorreflectantes clase 2 de 2 pulgadas para alta visibilidad ante maquinaria pesada.',
      icon: Eye,
      color: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/30'
    },
    {
      id: 'footwear',
      title: 'Calzado Dieléctrico con Suela Antideslizante (NCh 772)',
      desc: hasRain ? 'Crítico con lluvia: Suela de agarre profundo y técnica de 3 puntos de apoyo en escaleras/grating.' : 'Puntera de seguridad y aislación dieléctrica certificada para planta.',
      icon: Footprints,
      color: 'text-purple-500 bg-purple-500/10 border-purple-500/30'
    },
    {
      id: 'longSleeve',
      title: hasRain ? 'Traje Impermeable / Ropa para Lluvia' : 'Ropa de Trabajo Manga Larga UPF 50+',
      desc: hasRain ? 'Chaqueta y pantalón impermeable para prevenir hipotermia y humedad corporal.' : 'Tela con filtro solar para evitar quemaduras y abrasiones en estructuras.',
      icon: Shirt,
      color: 'text-blue-500 bg-blue-500/10 border-blue-500/30'
    },
    {
      id: 'gloves',
      title: 'Guantes de Seguridad para Mantenedor',
      desc: 'Cabritilla, nitrilo o anticorte nivel C/D según intervención en equipos rotativos o tableros.',
      icon: ShieldCheck,
      color: 'text-teal-500 bg-teal-500/10 border-teal-500/30'
    },
    {
      id: 'hydration',
      title: 'Botella de Hidratación / Agua Fresca',
      desc: isExtremeHeat ? 'Consumo de agua cada 15-20 min. Riesgo de estrés térmico por calor en faena.' : 'Hidratación constante durante el recorrido de inspección.',
      icon: Droplets,
      color: 'text-cyan-500 bg-cyan-500/10 border-cyan-500/30'
    }
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md overflow-y-auto">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-white/10 rounded-3xl shadow-2xl max-w-2xl w-full my-auto overflow-hidden flex flex-col max-h-[92vh]"
          >
            {/* MODAL HEADER */}
            <div className="relative bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 p-5 sm:p-6 text-white shrink-0 border-b border-white/10">
              <button
                onClick={onClose}
                className="absolute top-4 right-4 p-2 rounded-xl bg-white/10 hover:bg-white/20 text-zinc-300 hover:text-white transition-all cursor-pointer"
                title="Cerrar advertencia"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg shadow-amber-500/30 text-white shrink-0">
                  <ShieldAlert className="w-7 h-7" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/40">
                      Seguridad en Terreno
                    </span>
                    <span className="text-[10px] text-zinc-400 font-semibold flex items-center gap-1">
                      <Clock className="w-3 h-3" /> Pre-Inspección Operador
                    </span>
                  </div>
                  <h2 className="text-lg sm:text-xl font-black text-white mt-1 leading-tight">
                    Advertencias Meteorológicas y EPP
                  </h2>
                  <p className="text-xs text-zinc-300 mt-0.5 flex items-center gap-1.5 flex-wrap">
                    <span className="font-bold text-sky-400">Área a Inspeccionar:</span> {displayArea.name}
                    {equipment && (
                      <span className="text-zinc-400">
                        • <strong className="text-emerald-400">{equipment.name}</strong> {equipment.tag ? `(${equipment.tag})` : ''}
                      </span>
                    )}
                  </p>
                </div>
              </div>

          {/* Quick plant badge & live refresh */}
          <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between gap-2 flex-wrap text-xs text-zinc-300">
            <div className="flex items-center gap-1.5 text-zinc-300">
              <MapPin className="w-3.5 h-3.5 text-sky-400 shrink-0" />
              <span>{plant?.name || 'Faena / Planta Principal'}</span>
              {currentWeather?.cityName && <span className="text-zinc-400">({currentWeather.cityName})</span>}
            </div>

            <button
              onClick={fetchLiveWeather}
              disabled={isRefreshing}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-zinc-200 text-[11px] font-semibold transition-all cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3 h-3 ${isRefreshing ? 'animate-spin text-sky-400' : ''}`} />
              <span>{isRefreshing ? 'Actualizando...' : 'Refrescar Clima'}</span>
            </button>
          </div>
        </div>

        {/* MODAL BODY (SCROLLABLE) */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-5 text-zinc-800 dark:text-zinc-200">
          
          {/* SECTION 1: METEOROLOGICAL MODULE LIVE METRICS BAR */}
          <div className="bg-zinc-50 dark:bg-zinc-900/80 border border-zinc-200 dark:border-white/10 rounded-2xl p-4 shadow-xs">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-black uppercase tracking-wider text-zinc-500 dark:text-zinc-400 flex items-center gap-1.5">
                <Thermometer className="w-3.5 h-3.5 text-sky-500" />
                Módulo Meteorológico en Vivo (Open-Meteo)
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20">
                {weatherSymbol}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {/* Temperature */}
              <div className="p-2.5 rounded-xl bg-white dark:bg-black/50 border border-zinc-200/80 dark:border-white/5">
                <div className="flex items-center gap-1.5 text-zinc-500 dark:text-zinc-400 text-[11px] font-medium">
                  <Thermometer className="w-3.5 h-3.5 text-rose-500" />
                  <span>Temp. Actual</span>
                </div>
                <div className="text-lg font-black text-zinc-900 dark:text-white mt-0.5">
                  {temp}°C
                </div>
                <div className="text-[10px] text-zinc-400 mt-0.5">
                  Sensación: {apparentTemp}°C
                </div>
              </div>

              {/* UV Index */}
              <div className="p-2.5 rounded-xl bg-white dark:bg-black/50 border border-zinc-200/80 dark:border-white/5">
                <div className="flex items-center gap-1.5 text-zinc-500 dark:text-zinc-400 text-[11px] font-medium">
                  <Sun className="w-3.5 h-3.5 text-amber-500" />
                  <span>Índice UV Solar</span>
                </div>
                <div className="flex items-baseline gap-1.5 mt-0.5">
                  <span className="text-lg font-black text-zinc-900 dark:text-white">{uvVal}</span>
                  <span className={`text-[10px] font-black uppercase px-1.5 py-0.2 rounded ${uvInfo.color} ${uvInfo.badgeBg} border`}>
                    {uvInfo.category}
                  </span>
                </div>
                <div className="text-[10px] text-zinc-400 mt-0.5">
                  Guía MINSAL / DS 594
                </div>
              </div>

              {/* Rain / Precip */}
              <div className="p-2.5 rounded-xl bg-white dark:bg-black/50 border border-zinc-200/80 dark:border-white/5">
                <div className="flex items-center gap-1.5 text-zinc-500 dark:text-zinc-400 text-[11px] font-medium">
                  <CloudRain className="w-3.5 h-3.5 text-blue-500" />
                  <span>Precipitación</span>
                </div>
                <div className="text-lg font-black text-zinc-900 dark:text-white mt-0.5">
                  {precipitation > 0 ? `${precipitation} mm/h` : (rain > 0 ? `${rain} mm/h` : '0.0 mm')}
                </div>
                <div className="text-[10px] text-zinc-400 mt-0.5">
                  Humedad: {humidity}%
                </div>
              </div>

              {/* Wind */}
              <div className="p-2.5 rounded-xl bg-white dark:bg-black/50 border border-zinc-200/80 dark:border-white/5">
                <div className="flex items-center gap-1.5 text-zinc-500 dark:text-zinc-400 text-[11px] font-medium">
                  <Wind className="w-3.5 h-3.5 text-teal-500" />
                  <span>Viento y Ráfagas</span>
                </div>
                <div className="text-lg font-black text-zinc-900 dark:text-white mt-0.5">
                  {windSpeed} km/h
                </div>
                <div className="text-[10px] text-zinc-400 mt-0.5">
                  Ráfagas: {windGusts} km/h
                </div>
              </div>
            </div>
          </div>

          {/* SECTION 2: DYNAMIC INDUSTRIAL WEATHER WARNINGS */}
          <div className="space-y-2.5">
            <h3 className="text-xs font-black uppercase tracking-wider text-zinc-900 dark:text-white flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              Alertas de Seguridad para la Vuelta de Inspección
            </h3>

            {/* 1. THUNDERSTORM / LIGHTNING (RAYOS) */}
            {hasThunderstorm ? (
              <div className="p-3.5 rounded-2xl bg-rose-500/10 border-2 border-rose-500/40 text-rose-950 dark:text-rose-100 flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-rose-500 text-white flex items-center justify-center shrink-0 shadow-md">
                  <Zap className="w-5 h-5 animate-pulse" />
                </div>
                <div className="text-xs">
                  <div className="flex items-center gap-2 font-black uppercase text-rose-600 dark:text-rose-400 text-[11px] tracking-wider">
                    <span>PELIGRO CRÍTICO: TORMENTA ELÉCTRICA / DESCARGAS ATMOSFÉRICAS</span>
                  </div>
                  <p className="mt-1 font-semibold leading-relaxed">
                    <strong>PROHIBIDO</strong> subir a estructuras elevadas, techumbres, pasarelas metálicas a cielo abierto o cercanía de fajas transportadoras y estanques.
                  </p>
                  <p className="text-[11px] text-rose-700 dark:text-rose-300 mt-1">
                    • Refugiarse en recintos cerrados con jaula de Faraday.<br />
                    • Aplicar regla 30/30 (si el tiempo entre relámpago y trueno es menor a 30s, detener ronda inmediatamente).
                  </p>
                </div>
              </div>
            ) : (
              <div className="p-2.5 rounded-xl bg-emerald-500/5 border border-emerald-500/20 text-emerald-800 dark:text-emerald-300 text-xs flex items-center gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                <span><strong>Rayos / Tormentas:</strong> Condición atmosférica estable. Sin alertas de descargas eléctricas activas en faena.</span>
              </div>
            )}

            {/* 2. RAIN / PRECIPITACIONES (LLUVIA) */}
            {hasRain ? (
              <div className="p-3.5 rounded-2xl bg-sky-500/10 border-2 border-sky-500/40 text-sky-950 dark:text-sky-100 flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-sky-500 text-white flex items-center justify-center shrink-0 shadow-md">
                  <CloudRain className="w-5 h-5" />
                </div>
                <div className="text-xs">
                  <div className="flex items-center gap-2 font-black uppercase text-sky-600 dark:text-sky-400 text-[11px] tracking-wider">
                    <span>ADVERTENCIA: PRECIPITACIONES Y SUPERFICIES RESBALADIZAS</span>
                  </div>
                  <p className="mt-1 font-semibold leading-relaxed">
                    Piso mojado y alto riesgo de resbalones / caídas en grating, escaleras y pasarelas metálicas.
                  </p>
                  <p className="text-[11px] text-sky-700 dark:text-sky-300 mt-1">
                    • Mantener 3 puntos de apoyo en todo momento en escaleras.<br />
                    • Extremar precaución con tableros y cajas eléctricas: verificar que no haya filtración de agua antes de operar.<br />
                    • Utilizar traje impermeable para evitar enfriamiento.
                  </p>
                </div>
              </div>
            ) : (
              <div className="p-2.5 rounded-xl bg-emerald-500/5 border border-emerald-500/20 text-emerald-800 dark:text-emerald-300 text-xs flex items-center gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                <span><strong>Lluvia y Superficies:</strong> Sin precipitaciones activas. Vías y pasarelas secas en la ruta.</span>
              </div>
            )}

            {/* 3. SUN / UV RADIATION (SOL Y RADIACIÓN UV CHILE) */}
            {isHighUV ? (
              <div className={`p-3.5 rounded-2xl ${isExtremeUV ? 'bg-purple-500/10 border-2 border-purple-500/40 text-purple-950 dark:text-purple-100' : 'bg-amber-500/10 border-2 border-amber-500/40 text-amber-950 dark:text-amber-100'} flex items-start gap-3`}>
                <div className={`w-9 h-9 rounded-xl ${isExtremeUV ? 'bg-purple-600' : 'bg-amber-500'} text-white flex items-center justify-center shrink-0 shadow-md`}>
                  <Sun className="w-5 h-5" />
                </div>
                <div className="text-xs">
                  <div className={`flex items-center gap-2 font-black uppercase ${isExtremeUV ? 'text-purple-600 dark:text-purple-400' : 'text-amber-600 dark:text-amber-400'} text-[11px] tracking-wider`}>
                    <span>NORMATIVA CHILENA MINSAL - RADIACIÓN UV {uvInfo.category.toUpperCase()} (ÍNDICE: {uvVal})</span>
                  </div>
                  <p className="mt-1 font-semibold leading-relaxed">
                    Exigencia legal según <strong>DS 594 Art. 109</strong> y Guía Técnica de Radiación Solar MINSAL.
                  </p>
                  <p className={`text-[11px] ${isExtremeUV ? 'text-purple-700 dark:text-purple-300' : 'text-amber-700 dark:text-amber-300'} mt-1`}>
                    • <strong>Obligatorio:</strong> Protector solar FPS 50+ certificado ISP cada 2 horas.<br />
                    • <strong>Obligatorio:</strong> Legionario (cubrenuca) adosado al casco de seguridad.<br />
                    • <strong>Obligatorio:</strong> Lentes de seguridad con filtro UV 100% y sello lateral.<br />
                    • Hidratación continua en el recorrido para evitar golpes de calor.
                  </p>
                </div>
              </div>
            ) : (
              <div className="p-2.5 rounded-xl bg-emerald-500/5 border border-emerald-500/20 text-emerald-800 dark:text-emerald-300 text-xs flex items-center gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                <span><strong>Radiación UV ({uvVal} - {uvInfo.category}):</strong> Dentro de rangos moderados/bajos. Mantener fotoprotección estándar.</span>
              </div>
            )}

            {/* 4. WIND (VIENTO) */}
            {isHighWind && (
              <div className="p-3.5 rounded-2xl bg-teal-500/10 border-2 border-teal-500/40 text-teal-950 dark:text-teal-100 flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-teal-600 text-white flex items-center justify-center shrink-0 shadow-md">
                  <Wind className="w-5 h-5" />
                </div>
                <div className="text-xs">
                  <div className="flex items-center gap-2 font-black uppercase text-teal-600 dark:text-teal-400 text-[11px] tracking-wider">
                    <span>PRECAUCIÓN POR VIENTO FUERTE ({windSpeed} km/h - RÁFAGAS {windGusts} km/h)</span>
                  </div>
                  <p className="mt-1 text-[11px] text-teal-800 dark:text-teal-200">
                    • Asegurar barbiquejo del casco y lentes de seguridad ajustados contra polvo en suspensión.<br />
                    • Atención a puertas de tableros batientes y objetos sueltos en altura.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* SECTION 3: EPP RECOMENDADOS EN CHILE (NORMATIVA NACIONAL) */}
          <div className="space-y-3 pt-2 border-t border-zinc-200 dark:border-white/10">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xs font-black uppercase tracking-wider text-zinc-900 dark:text-white flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-sky-500" />
                  EPP Recomendados en Chile (DS 594 / Ley 16.744 / NCh)
                </h3>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                  Verifica que cuentas con todos tus elementos antes de iniciar la vuelta de inspección:
                </p>
              </div>
              <span className="text-[10px] font-bold text-sky-600 dark:text-sky-400 bg-sky-500/10 px-2 py-0.5 rounded-full border border-sky-500/20">
                {Object.values(checkedEpp).filter(Boolean).length} / {eppList.length} Verificados
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {eppList.map((item) => {
                const IconComponent = item.icon;
                const isChecked = !!checkedEpp[item.id];
                return (
                  <div
                    key={item.id}
                    onClick={() => toggleEpp(item.id)}
                    className={`p-2.5 rounded-xl border transition-all cursor-pointer flex items-start gap-2.5 ${
                      isChecked
                        ? 'bg-zinc-50 dark:bg-white/5 border-zinc-200 dark:border-white/10 hover:border-sky-500/50'
                        : 'bg-red-500/5 border-red-500/20 opacity-75'
                    }`}
                  >
                    <div className="mt-0.5 shrink-0">
                      <div className={`w-4 h-4 rounded-md border flex items-center justify-center transition-colors ${
                        isChecked
                          ? 'bg-sky-600 border-sky-600 text-white'
                          : 'border-zinc-400 dark:border-zinc-600'
                      }`}>
                        {isChecked && <CheckCircle2 className="w-3.5 h-3.5" />}
                      </div>
                    </div>

                    <div className="text-xs min-w-0">
                      <p className="font-bold text-zinc-900 dark:text-white leading-tight flex items-center gap-1.5">
                        <IconComponent className="w-3.5 h-3.5 shrink-0 text-sky-500" />
                        <span className="truncate">{item.title}</span>
                      </p>
                      <p className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-0.5 leading-snug line-clamp-2">
                        {item.desc}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* SECTION 4: SAFETY ACKNOWLEDGMENT CHECKBOX */}
          <div className="pt-2 border-t border-zinc-200 dark:border-white/10">
            <label className="flex items-start gap-3 p-3 rounded-2xl bg-amber-500/5 dark:bg-amber-500/10 border border-amber-500/30 cursor-pointer hover:bg-amber-500/10 transition-colors">
              <input
                type="checkbox"
                checked={acknowledged}
                onChange={(e) => setAcknowledged(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded text-sky-600 focus:ring-sky-500 border-zinc-300 dark:border-zinc-700 shrink-0 cursor-pointer"
              />
              <div className="text-xs">
                <span className="font-bold text-zinc-900 dark:text-white">
                  Declaración de Verificación de Seguridad del Mantenedor:
                </span>
                <p className="text-zinc-600 dark:text-zinc-300 text-[11px] mt-0.5 leading-relaxed">
                  Declaro que he revisado las advertencias climáticas actuales, cuento con todos mis EPP reglamentarios según normativa chilena y aplicaré las precauciones correspondientes durante la ronda de inspección técnica en terreno.
                </p>
              </div>
            </label>
          </div>

        </div>

        {/* MODAL FOOTER */}
        <div className="p-4 sm:p-5 bg-zinc-50 dark:bg-zinc-900/90 border-t border-zinc-200 dark:border-white/10 flex items-center justify-between gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-white/10 text-xs font-bold text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-white/5 transition-all cursor-pointer"
          >
            Cancelar / Volver
          </button>

          <button
            type="button"
            onClick={onConfirm}
            className="flex-1 sm:flex-initial px-6 py-2.5 rounded-xl bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-500 hover:to-blue-500 text-white font-extrabold text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-sky-500/25 active:scale-98 transition-all cursor-pointer"
          >
            <span>Iniciar Inspección Segura</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </motion.div>
    </div>
  )}
</AnimatePresence>
  );
};
