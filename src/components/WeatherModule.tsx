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
              <span className="px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20">
                Checkify Weather
              </span>
            </div>
            <p className="text-xs font-semibold text-zinc-400 dark:text-zinc-500">Estación San Antonio — Planta Industrial</p>
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
              {/* Highlight Card */}
              <div className="p-6 rounded-2xl bg-gradient-to-br from-sky-500 via-sky-600 to-blue-700 text-white shadow-lg relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl pointer-events-none" />
                <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
                  <div>
                    <span className="px-3 py-1 rounded-full bg-white/20 backdrop-blur text-[10px] font-black uppercase tracking-widest text-sky-100 border border-white/20">
                      Condición Actual
                    </span>
                    <div className="flex items-baseline gap-2 mt-3">
                      <h1 className="text-5xl font-black tracking-tight">{current?.temperature || '21°C'}</h1>
                      <span className="text-lg font-bold text-sky-100">{current?.symbol || 'Despejado'}</span>
                    </div>
                    <p className="text-xs text-sky-100/80 font-medium mt-1">
                      Último registro de la hora: <strong className="text-white">{current?.forecastDate || 'Actual'}</strong>
                    </p>
                  </div>

                  <div className="w-20 h-20 rounded-2xl bg-white/10 backdrop-blur border border-white/20 flex items-center justify-center shrink-0 shadow-inner">
                    {renderWeatherIcon(current?.symbol, false, "w-12 h-12")}
                  </div>
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
              <div className="p-5 rounded-2xl bg-zinc-900 dark:bg-zinc-950 text-white border border-zinc-800 dark:border-white/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Calendar className="w-4 h-4 text-sky-400" />
                    <span className="text-xs font-bold uppercase text-sky-400 tracking-wider">Resumen del Día</span>
                  </div>
                  <h4 className="text-xl font-black uppercase tracking-tight">{today?.date || 'Hoy'}</h4>
                </div>

                <div className="flex items-center gap-3">
                  <div className="px-3 py-1.5 rounded-xl bg-zinc-800/80 border border-white/10 text-center">
                    <span className="text-[9px] font-extrabold text-zinc-400 uppercase tracking-widest block">Mínima</span>
                    <span className="text-base font-black text-cyan-400">{today?.tempMin || 'N/A'}</span>
                  </div>
                  <div className="px-3 py-1.5 rounded-xl bg-zinc-800/80 border border-white/10 text-center">
                    <span className="text-[9px] font-extrabold text-zinc-400 uppercase tracking-widest block">Máxima</span>
                    <span className="text-base font-black text-amber-400">{today?.tempMax || 'N/A'}</span>
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
