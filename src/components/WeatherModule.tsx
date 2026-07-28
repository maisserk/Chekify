import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Sun, Moon, CloudSun, CloudMoon, Cloud, CloudRain, 
  CloudDrizzle, CloudLightning, Wind, CloudFog, Snowflake,
  Droplets, Thermometer, ThermometerSun, ThermometerSnowflake,
  Clock, Calendar, RefreshCw, X, ShieldAlert, ChevronRight,
  TrendingUp, Umbrella, Navigation
} from 'lucide-react';
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import { meteoredService, FullWeatherData, WeatherData, DailyWeatherData, HourlyForecastItem } from '../services/meteoredService';

interface WeatherModuleProps {
  onClose?: () => void;
  isEmbedded?: boolean;
}

// Background Animation Component for Weather Cards
const WeatherAnimatedBackground: React.FC<{ symbol?: string; isNight?: boolean }> = ({ symbol = '', isNight = false }) => {
  const sym = symbol.toLowerCase();

  const isClear = sym.includes('despejado') || sym.includes('soleado');
  const isPartial = sym.includes('parcialmente') || sym.includes('algo');
  const isCloudy = sym.includes('cubierto') || sym.includes('nublado');
  const isRain = sym.includes('lluvia') || sym.includes('chubasco') || sym.includes('precipitac');
  const isStorm = sym.includes('tormenta') || sym.includes('eléctrica');
  const isFog = sym.includes('niebla') || sym.includes('bruma');
  const isSnow = sym.includes('nieve') || sym.includes('granizo');
  const isWind = sym.includes('viento');

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none rounded-2xl">
      {/* 1. SUN / CLEAR / SOLEADO ANIMATION */}
      {(isClear || (isPartial && !isNight)) && (
        <>
          {/* Glowing Sun Aura */}
          <motion.div
            animate={{ scale: [1, 1.25, 1], opacity: [0.3, 0.6, 0.3] }}
            transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
            className="absolute -top-10 -right-10 w-64 h-64 bg-amber-400/40 rounded-full blur-2xl pointer-events-none"
          />
          {/* Rotating Sun Rays SVG */}
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: 25, ease: "linear" }}
            className="absolute -top-2 right-2 w-40 h-40 opacity-30 pointer-events-none"
          >
            <svg viewBox="0 0 100 100" className="w-full h-full stroke-amber-200 fill-none" strokeWidth="1.5">
              <circle cx="50" cy="50" r="28" strokeDasharray="4 6" />
              <line x1="50" y1="5" x2="50" y2="15" />
              <line x1="50" y1="85" x2="50" y2="95" />
              <line x1="5" y1="50" x2="15" y2="50" />
              <line x1="85" y1="50" x2="95" y2="50" />
              <line x1="18" y1="18" x2="25" y2="25" />
              <line x1="75" y1="75" x2="82" y2="82" />
              <line x1="82" y1="18" x2="75" y2="25" />
              <line x1="18" y1="75" x2="25" y2="82" />
            </svg>
          </motion.div>
        </>
      )}

      {/* 2. MOVING CLOUDS ANIMATION */}
      {(isCloudy || isPartial || isRain || isStorm || isFog) && (
        <>
          <motion.div
            animate={{ x: [-80, 320] }}
            transition={{ repeat: Infinity, duration: 18, ease: "linear" }}
            className="absolute top-2 left-0 opacity-25 text-white/80 pointer-events-none"
          >
            <Cloud className="w-20 h-20 fill-white/20" />
          </motion.div>

          <motion.div
            animate={{ x: [-120, 350] }}
            transition={{ repeat: Infinity, duration: 26, ease: "linear", delay: 4 }}
            className="absolute top-8 left-0 opacity-35 text-white/90 pointer-events-none"
          >
            <Cloud className="w-28 h-28 fill-white/30" />
          </motion.div>

          <motion.div
            animate={{ x: [-60, 300] }}
            transition={{ repeat: Infinity, duration: 22, ease: "linear", delay: 10 }}
            className="absolute top-0 right-10 opacity-20 text-white pointer-events-none"
          >
            <Cloud className="w-24 h-24 fill-white/10" />
          </motion.div>
        </>
      )}

      {/* 3. RAIN STREAKS */}
      {(isRain || isStorm) && (
        <div className="absolute inset-0 pointer-events-none">
          {[...Array(12)].map((_, i) => (
            <motion.div
              key={`rain-${i}`}
              initial={{ y: -20, x: i * 28 + (i % 3) * 10, opacity: 0 }}
              animate={{
                y: [0, 160],
                x: [i * 28, i * 28 - 25],
                opacity: [0, 0.7, 0]
              }}
              transition={{
                repeat: Infinity,
                duration: 0.8 + (i % 4) * 0.2,
                ease: "linear",
                delay: i * 0.12
              }}
              className="absolute w-0.5 h-6 bg-gradient-to-b from-sky-200 to-white/90 rounded-full"
            />
          ))}
        </div>
      )}

      {/* 4. LIGHTNING FLASHES FOR STORM */}
      {isStorm && (
        <motion.div
          animate={{ opacity: [0, 0, 0.85, 0, 0.4, 0, 0] }}
          transition={{ repeat: Infinity, duration: 4.5, ease: "linear", delay: 1 }}
          className="absolute inset-0 bg-amber-200/25 mix-blend-overlay pointer-events-none"
        />
      )}

      {/* 5. WIND LINES */}
      {isWind && (
        <div className="absolute inset-0 pointer-events-none">
          {[...Array(5)].map((_, i) => (
            <motion.div
              key={`wind-${i}`}
              animate={{ x: [-60, 320], opacity: [0, 0.6, 0] }}
              transition={{ repeat: Infinity, duration: 2 + i * 0.5, ease: "easeInOut", delay: i * 0.6 }}
              className="absolute h-0.5 bg-gradient-to-r from-transparent via-teal-200 to-transparent rounded-full"
              style={{ top: `${20 + i * 25}%`, width: `${60 + i * 20}px` }}
            />
          ))}
        </div>
      )}

      {/* 6. FOG / MIST */}
      {isFog && (
        <motion.div
          animate={{ x: [-20, 20], opacity: [0.3, 0.6, 0.3] }}
          transition={{ repeat: Infinity, duration: 8, ease: "easeInOut" }}
          className="absolute inset-0 bg-gradient-to-r from-zinc-300/20 via-white/30 to-zinc-300/20 backdrop-blur-[2px] pointer-events-none"
        />
      )}

      {/* 7. SNOW PARTICLES */}
      {isSnow && (
        <div className="absolute inset-0 pointer-events-none">
          {[...Array(14)].map((_, i) => (
            <motion.div
              key={`snow-${i}`}
              animate={{
                y: [-10, 150],
                x: [i * 24, i * 24 + (i % 2 === 0 ? 15 : -15)],
                opacity: [0, 0.9, 0]
              }}
              transition={{ repeat: Infinity, duration: 3 + (i % 3), ease: "easeInOut", delay: i * 0.3 }}
              className="absolute w-2 h-2 bg-white rounded-full shadow-sm shadow-white"
            />
          ))}
        </div>
      )}
    </div>
  );
};

const getWeatherCardGradient = (symbol?: string, isNight?: boolean) => {
  const sym = (symbol || '').toLowerCase();
  if (sym.includes('tormenta')) return 'bg-gradient-to-br from-slate-950 via-indigo-950 to-blue-950';
  if (sym.includes('lluvia') || sym.includes('chubasco')) return 'bg-gradient-to-br from-slate-900 via-sky-900 to-blue-950';
  if (sym.includes('cubierto') || sym.includes('niebla')) return 'bg-gradient-to-br from-zinc-800 via-slate-800 to-zinc-900';
  if (sym.includes('parcialmente') || sym.includes('algo')) return 'bg-gradient-to-br from-sky-600 via-blue-600 to-indigo-700';
  if (sym.includes('despejado') || sym.includes('soleado')) {
    return isNight 
      ? 'bg-gradient-to-br from-indigo-950 via-slate-900 to-sky-950'
      : 'bg-gradient-to-br from-amber-500 via-sky-500 to-blue-600';
  }
  return 'bg-gradient-to-br from-sky-500 via-sky-600 to-blue-700';
};

export const WeatherModule: React.FC<WeatherModuleProps> = ({ onClose, isEmbedded = false }) => {
  const [activeTab, setActiveTab] = useState<'ahora' | 'hoy' | 'porHora'>('ahora');
  const [weatherData, setWeatherData] = useState<FullWeatherData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<boolean>(false);

  const fetchWeather = async () => {
    setLoading(true);
    setError(false);
    try {
      const data = await meteoredService.getFullWeather();
      setWeatherData(data);
    } catch (err) {
      console.error('Error fetching weather module data:', err);
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWeather();
  }, []);

  // Icon selector based on symbol string and night flag
  const renderWeatherIcon = (symbol?: string, isNight?: boolean, className: string = "w-6 h-6") => {
    const sym = (symbol || '').toLowerCase();
    
    if (sym.includes('despejado') || sym.includes('soleado')) {
      return isNight ? <Moon className={`${className} text-indigo-300`} /> : <Sun className={`${className} text-amber-500 animate-spin-slow`} />;
    }
    if (sym.includes('parcialmente') || sym.includes('algo')) {
      return isNight ? <CloudMoon className={`${className} text-indigo-300`} /> : <CloudSun className={`${className} text-amber-400`} />;
    }
    if (sym.includes('cubierto') || sym.includes('nublado')) {
      return <Cloud className={`${className} text-zinc-400`} />;
    }
    if (sym.includes('chubasco')) {
      return <CloudDrizzle className={`${className} text-sky-400`} />;
    }
    if (sym.includes('lluvia') || sym.includes('precipitac')) {
      return <CloudRain className={`${className} text-blue-500`} />;
    }
    if (sym.includes('tormenta') || sym.includes('eléctrica')) {
      return <CloudLightning className={`${className} text-amber-400`} />;
    }
    if (sym.includes('niebla') || sym.includes('bruma')) {
      return <CloudFog className={`${className} text-zinc-400`} />;
    }
    if (sym.includes('nieve') || sym.includes('granizo')) {
      return <Snowflake className={`${className} text-cyan-300`} />;
    }
    if (sym.includes('viento')) {
      return <Wind className={`${className} text-teal-400`} />;
    }

    return isNight ? <Moon className={`${className} text-indigo-300`} /> : <CloudSun className={`${className} text-amber-400`} />;
  };

  const current: WeatherData | null = weatherData?.current || null;
  const today: DailyWeatherData | null = weatherData?.today || null;
  const hourly: HourlyForecastItem[] = weatherData?.hourly || [];

  return (
    <div className={`w-full bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-white/10 ${isEmbedded ? 'rounded-2xl p-4' : 'rounded-3xl p-6 shadow-2xl dark:shadow-none'}`}>
      
      {/* Header with Title, Location, Refresh & Close */}
      <div className="flex items-center justify-between pb-4 border-b border-zinc-100 dark:border-white/10 mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-sky-50 dark:bg-sky-500/10 border border-sky-100 dark:border-sky-500/20 flex items-center justify-center text-sky-600 dark:text-sky-400 shadow-sm">
            {current ? renderWeatherIcon(current.symbol, false, "w-6 h-6") : <CloudSun className="w-6 h-6 text-sky-500" />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-black text-zinc-900 dark:text-white uppercase tracking-tight">Condiciones Meteorológicas</h3>
            </div>
            <p className="text-xs font-semibold text-zinc-400 dark:text-zinc-500">Datos obtenidos de meteored.cl</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchWeather}
            disabled={loading}
            className="p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-800 text-zinc-500 hover:text-zinc-900 dark:hover:text-white border border-zinc-200/50 dark:border-white/10 transition-all active:scale-95 disabled:opacity-50"
            title="Actualizar datos"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-800 text-zinc-500 hover:text-zinc-900 dark:hover:text-white border border-zinc-200/50 dark:border-white/10 transition-all active:scale-95"
              title="Cerrar"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Navigation Tabs: Ahora, Hoy, Por Hora */}
      <div className="flex bg-zinc-100 dark:bg-zinc-950 p-1.5 rounded-2xl border border-zinc-200/50 dark:border-white/5 mb-6">
        <button
          onClick={() => setActiveTab('ahora')}
          className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2 ${
            activeTab === 'ahora'
              ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-sm border border-zinc-200/50 dark:border-white/10'
              : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
          }`}
        >
          <Clock className="w-3.5 h-3.5" />
          Ahora
        </button>

        <button
          onClick={() => setActiveTab('hoy')}
          className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2 ${
            activeTab === 'hoy'
              ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-sm border border-zinc-200/50 dark:border-white/10'
              : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
          }`}
        >
          <Calendar className="w-3.5 h-3.5" />
          Hoy
        </button>

        <button
          onClick={() => setActiveTab('porHora')}
          className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2 ${
            activeTab === 'porHora'
              ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-sm border border-zinc-200/50 dark:border-white/10'
              : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
          }`}
        >
          <TrendingUp className="w-3.5 h-3.5" />
          Por Hora
        </button>
      </div>

      {/* Loading Skeleton */}
      {loading && !weatherData && (
        <div className="py-12 flex flex-col items-center justify-center gap-3 text-zinc-400">
          <RefreshCw className="w-8 h-8 animate-spin text-sky-500" />
          <p className="text-xs font-bold uppercase tracking-widest">Obteniendo pronóstico meteorológico...</p>
        </div>
      )}

      {/* Main Content Area */}
      {!loading && weatherData && (
        <AnimatePresence mode="wait">
          
          {/* TAB 1: AHORA */}
          {activeTab === 'ahora' && (
            <motion.div
              key="tab-ahora"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="space-y-6"
            >
              {/* Highlight Card with Dynamic Condition Animation */}
              <div className={`p-6 rounded-2xl ${getWeatherCardGradient(current?.symbol, false)} text-white shadow-xl relative overflow-hidden transition-all duration-700 border border-white/20`}>
                <WeatherAnimatedBackground symbol={current?.symbol} isNight={false} />
                <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
                  <div>
                    <span className="px-3 py-1 rounded-full bg-white/20 backdrop-blur-md text-[10px] font-black uppercase tracking-widest text-white border border-white/25 shadow-sm">
                      Condición Actual
                    </span>
                    <div className="flex items-baseline gap-2 mt-3">
                      <h1 className="text-5xl font-black tracking-tight drop-shadow-sm">{current?.temperature || '21°C'}</h1>
                      <span className="text-lg font-bold text-white/95 drop-shadow-sm">{current?.symbol || 'Despejado'}</span>
                    </div>
                    <p className="text-xs text-white/80 font-medium mt-1">
                      Último registro de la hora: <strong className="text-white">{current?.forecastDate || 'Actual'}</strong>
                    </p>
                  </div>

                  <motion.div 
                    animate={{ y: [0, -4, 0] }}
                    transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
                    className="w-20 h-20 rounded-2xl bg-white/15 backdrop-blur-md border border-white/30 flex items-center justify-center shrink-0 shadow-lg"
                  >
                    {renderWeatherIcon(current?.symbol, false, "w-12 h-12")}
                  </motion.div>
                </div>
              </div>

              {/* 6 Grid Metrics */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-100 dark:border-white/5 space-y-1">
                  <div className="flex items-center gap-2 text-zinc-400 dark:text-zinc-500">
                    <Thermometer className="w-4 h-4 text-rose-500" />
                    <span className="text-[10px] font-bold uppercase tracking-wider">Temperatura</span>
                  </div>
                  <p className="text-lg font-black text-zinc-900 dark:text-white">{current?.temperature || 'N/A'}</p>
                </div>

                <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-100 dark:border-white/5 space-y-1">
                  <div className="flex items-center gap-2 text-zinc-400 dark:text-zinc-500">
                    <Droplets className="w-4 h-4 text-sky-500" />
                    <span className="text-[10px] font-bold uppercase tracking-wider">Humedad</span>
                  </div>
                  <p className="text-lg font-black text-zinc-900 dark:text-white">{current?.humidity || 'N/A'}</p>
                </div>

                <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-100 dark:border-white/5 space-y-1">
                  <div className="flex items-center gap-2 text-zinc-400 dark:text-zinc-500">
                    <Wind className="w-4 h-4 text-teal-500" />
                    <span className="text-[10px] font-bold uppercase tracking-wider">Viento</span>
                  </div>
                  <p className="text-lg font-black text-zinc-900 dark:text-white">
                    {current?.windSpeed || 'N/A'} {current?.windDirection ? `(${current.windDirection})` : ''}
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-100 dark:border-white/5 space-y-1">
                  <div className="flex items-center gap-2 text-zinc-400 dark:text-zinc-500">
                    <Umbrella className="w-4 h-4 text-indigo-500" />
                    <span className="text-[10px] font-bold uppercase tracking-wider">Precipitación</span>
                  </div>
                  <p className="text-lg font-black text-zinc-900 dark:text-white">{current?.precipitation || '0 mm'}</p>
                </div>

                <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-100 dark:border-white/5 space-y-1">
                  <div className="flex items-center gap-2 text-zinc-400 dark:text-zinc-500">
                    <CloudSun className="w-4 h-4 text-amber-500" />
                    <span className="text-[10px] font-bold uppercase tracking-wider">Estado</span>
                  </div>
                  <p className="text-base font-bold text-zinc-900 dark:text-white truncate">{current?.symbol || 'Despejado'}</p>
                </div>

                <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-100 dark:border-white/5 space-y-1">
                  <div className="flex items-center gap-2 text-zinc-400 dark:text-zinc-500">
                    <Clock className="w-4 h-4 text-emerald-500" />
                    <span className="text-[10px] font-bold uppercase tracking-wider">Hora Pronóstico</span>
                  </div>
                  <p className="text-base font-bold text-zinc-900 dark:text-white">{current?.forecastDate || 'Actual'}</p>
                </div>
              </div>
            </motion.div>
          )}

          {/* TAB 2: HOY */}
          {activeTab === 'hoy' && (
            <motion.div
              key="tab-hoy"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="space-y-6"
            >
              {/* Daily Banner */}
              <div className={`p-5 rounded-2xl ${getWeatherCardGradient(today?.predominantSymbol, false)} text-white border border-white/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 relative overflow-hidden shadow-lg`}>
                <WeatherAnimatedBackground symbol={today?.predominantSymbol} isNight={false} />
                <div className="relative z-10">
                  <div className="flex items-center gap-2 mb-1">
                    <Calendar className="w-4 h-4 text-sky-200" />
                    <span className="text-xs font-black uppercase text-sky-200 tracking-wider">Resumen del Día</span>
                  </div>
                  <h4 className="text-xl font-black uppercase tracking-tight">{today?.date || 'Hoy'}</h4>
                </div>

                <div className="flex items-center gap-3 relative z-10">
                  <div className="px-3 py-1.5 rounded-xl bg-black/30 backdrop-blur-md border border-white/15 text-center">
                    <span className="text-[9px] font-extrabold text-sky-200 uppercase tracking-widest block">Mínima</span>
                    <span className="text-base font-black text-cyan-300">{today?.tempMin || 'N/A'}</span>
                  </div>
                  <div className="px-3 py-1.5 rounded-xl bg-black/30 backdrop-blur-md border border-white/15 text-center">
                    <span className="text-[9px] font-extrabold text-amber-200 uppercase tracking-widest block">Máxima</span>
                    <span className="text-base font-black text-amber-300">{today?.tempMax || 'N/A'}</span>
                  </div>
                </div>
              </div>

              {/* Required 6 Daily Metrics */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-100 dark:border-white/5 space-y-1">
                  <div className="flex items-center gap-2 text-zinc-400 dark:text-zinc-500">
                    <ThermometerSnowflake className="w-4 h-4 text-cyan-500" />
                    <span className="text-[10px] font-bold uppercase tracking-wider">Temp. Mínima</span>
                  </div>
                  <p className="text-xl font-black text-cyan-600 dark:text-cyan-400">{today?.tempMin || 'N/A'}</p>
                </div>

                <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-100 dark:border-white/5 space-y-1">
                  <div className="flex items-center gap-2 text-zinc-400 dark:text-zinc-500">
                    <ThermometerSun className="w-4 h-4 text-amber-500" />
                    <span className="text-[10px] font-bold uppercase tracking-wider">Temp. Máxima</span>
                  </div>
                  <p className="text-xl font-black text-amber-600 dark:text-amber-400">{today?.tempMax || 'N/A'}</p>
                </div>

                <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-100 dark:border-white/5 space-y-1">
                  <div className="flex items-center gap-2 text-zinc-400 dark:text-zinc-500">
                    <CloudRain className="w-4 h-4 text-blue-500" />
                    <span className="text-[10px] font-bold uppercase tracking-wider">Lluvia Acumulada</span>
                  </div>
                  <p className="text-xl font-black text-blue-600 dark:text-blue-400">{today?.rainAccumulated || '0 mm'}</p>
                </div>

                <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-100 dark:border-white/5 space-y-1">
                  <div className="flex items-center gap-2 text-zinc-400 dark:text-zinc-500">
                    <Umbrella className="w-4 h-4 text-indigo-500" />
                    <span className="text-[10px] font-bold uppercase tracking-wider">Prob. Máx. Lluvia</span>
                  </div>
                  <p className="text-xl font-black text-indigo-600 dark:text-indigo-400">{today?.rainProbabilityMax || '0%'}</p>
                </div>

                <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-100 dark:border-white/5 space-y-1">
                  <div className="flex items-center gap-2 text-zinc-400 dark:text-zinc-500">
                    <Wind className="w-4 h-4 text-teal-500" />
                    <span className="text-[10px] font-bold uppercase tracking-wider">Viento Máximo</span>
                  </div>
                  <p className="text-xl font-black text-teal-600 dark:text-teal-400">{today?.windSpeedMax || 'N/A'}</p>
                </div>

                <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-100 dark:border-white/5 space-y-1">
                  <div className="flex items-center gap-2 text-zinc-400 dark:text-zinc-500">
                    <CloudSun className="w-4 h-4 text-emerald-500" />
                    <span className="text-[10px] font-bold uppercase tracking-wider">Estado Predominante</span>
                  </div>
                  <p className="text-base font-bold text-zinc-900 dark:text-white truncate">{today?.predominantSymbol || 'Despejado'}</p>
                </div>
              </div>
            </motion.div>
          )}

          {/* TAB 3: POR HORA */}
          {activeTab === 'porHora' && (
            <motion.div
              key="tab-por-hora"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="space-y-6"
            >
              {/* Temperature & Rain Recharts Graph */}
              <div className="p-4 sm:p-5 rounded-2xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-100 dark:border-white/5 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-sky-500" />
                    <h4 className="text-xs font-bold uppercase text-zinc-900 dark:text-white tracking-wider">
                      Gráfico de Temperatura (°C) y Precipitación (mm)
                    </h4>
                  </div>
                  <div className="flex items-center gap-4 text-[10px] font-bold">
                    <span className="flex items-center gap-1.5 text-sky-500">
                      <span className="w-2.5 h-2.5 rounded-full bg-sky-500 inline-block" /> Temp (°C)
                    </span>
                    <span className="flex items-center gap-1.5 text-blue-600">
                      <span className="w-2.5 h-2.5 rounded-sm bg-blue-500 inline-block" /> Precip (mm)
                    </span>
                  </div>
                </div>

                <div className="w-full h-56 pt-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={hourly.slice(0, 24)} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="tempGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#0284c7" stopOpacity={0.4}/>
                          <stop offset="95%" stopColor="#0284c7" stopOpacity={0.0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#3f3f46" opacity={0.2} />
                      <XAxis 
                        dataKey="time" 
                        tick={{ fontSize: 10, fill: '#888' }} 
                        axisLine={false} 
                        tickLine={false} 
                      />
                      <YAxis 
                        yAxisId="left" 
                        tick={{ fontSize: 10, fill: '#0284c7' }} 
                        axisLine={false} 
                        tickLine={false} 
                        domain={['auto', 'auto']}
                      />
                      <YAxis 
                        yAxisId="right" 
                        orientation="right" 
                        tick={{ fontSize: 10, fill: '#3b82f6' }} 
                        axisLine={false} 
                        tickLine={false} 
                      />
                      <Tooltip 
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            const data: HourlyForecastItem = payload[0].payload;
                            return (
                              <div className="bg-zinc-900 border border-white/10 p-3 rounded-xl shadow-xl text-white text-xs space-y-1">
                                <p className="font-black text-sky-400 border-b border-white/10 pb-1 mb-1">{data.time} hrs</p>
                                <p className="font-bold flex justify-between gap-4">
                                  <span className="text-zinc-400">Temperatura:</span>
                                  <span className="text-white">{data.temperature}°C</span>
                                </p>
                                <p className="font-bold flex justify-between gap-4">
                                  <span className="text-zinc-400">Precipitación:</span>
                                  <span className="text-blue-400">{data.precipitation} mm</span>
                                </p>
                                <p className="font-bold flex justify-between gap-4">
                                  <span className="text-zinc-400">Humedad:</span>
                                  <span className="text-zinc-200">{data.humidity}%</span>
                                </p>
                                <p className="font-bold flex justify-between gap-4">
                                  <span className="text-zinc-400">Viento:</span>
                                  <span className="text-teal-400">{data.windSpeed} km/h</span>
                                </p>
                                <p className="font-bold flex justify-between gap-4 pt-1 border-t border-white/10">
                                  <span className="text-zinc-400">Estado:</span>
                                  <span className="text-amber-300">{data.symbol}</span>
                                </p>
                              </div>
                            );
                          }
                          return null;
                        }} 
                      />
                      <Bar yAxisId="right" dataKey="precipitation" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={12} />
                      <Area yAxisId="left" type="monotone" dataKey="temperature" stroke="#0284c7" strokeWidth={2.5} fillOpacity={1} fill="url(#tempGradient)" />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Responsive Hourly Table */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold uppercase text-zinc-900 dark:text-white tracking-wider px-1">
                  Tabla Detallada por Hora
                </h4>

                <div className="overflow-x-auto rounded-2xl border border-zinc-200/80 dark:border-white/10 bg-white dark:bg-zinc-900 shadow-sm custom-scrollbar">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="bg-zinc-100 dark:bg-zinc-950/80 text-zinc-500 dark:text-zinc-400 border-b border-zinc-200 dark:border-white/10 font-bold uppercase text-[10px] tracking-wider">
                        <th className="py-3 px-4">Hora</th>
                        <th className="py-3 px-4">Temperatura</th>
                        <th className="py-3 px-4">Humedad</th>
                        <th className="py-3 px-4">Viento</th>
                        <th className="py-3 px-4">Precipitación</th>
                        <th className="py-3 px-4 text-center">Estado</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100 dark:divide-white/5 font-semibold text-zinc-800 dark:text-zinc-200">
                      {hourly.map((item, idx) => (
                        <tr key={`hourly-row-${idx}`} className="hover:bg-zinc-50 dark:hover:bg-white/5 transition-colors">
                          <td className="py-3 px-4 font-black text-zinc-900 dark:text-white whitespace-nowrap">
                            {item.time}
                          </td>
                          <td className="py-3 px-4 font-bold text-sky-600 dark:text-sky-400 whitespace-nowrap">
                            {item.tempFormatted}
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap">
                            {item.humidityFormatted}
                          </td>
                          <td className="py-3 px-4 text-teal-600 dark:text-teal-400 whitespace-nowrap">
                            {item.windSpeedFormatted} {item.windDirection ? `(${item.windDirection})` : ''}
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap">
                            <span className={item.precipitation > 0 ? 'text-blue-600 dark:text-blue-400 font-bold' : 'text-zinc-400'}>
                              {item.precipFormatted}
                            </span>
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              {renderWeatherIcon(item.symbol, item.isNight, "w-4 h-4")}
                              <span className="text-[11px] font-medium text-zinc-600 dark:text-zinc-400">{item.symbol}</span>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </motion.div>
          )}

        </AnimatePresence>
      )}

      {/* Error state */}
      {error && !weatherData && (
        <div className="py-8 text-center space-y-3">
          <p className="text-xs font-bold text-rose-500 uppercase">Error al obtener los datos meteorológicos</p>
          <button 
            onClick={fetchWeather}
            className="px-4 py-2 bg-zinc-900 text-white dark:bg-white dark:text-black rounded-xl text-xs font-bold uppercase tracking-wider"
          >
            Reintentar
          </button>
        </div>
      )}
    </div>
  );
};
