/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Chekify Enterprise Industrial SaaS Framework
 * Service: meteoredService
 * 
 * Service to interface with Meteored Business API for fetching
 * real-time weather and forecast data for industrial inspections.
 */

// Interface defining the current weather structure (Ahora)
export interface WeatherData {
  temperature: number | string;
  humidity: number | string;
  windSpeed: number | string;
  windDirection?: string | number;
  precipitation: number | string;
  symbol?: string;
  forecastDate: string;
}

// Interface defining the daily weather structure (Hoy)
export interface DailyWeatherData {
  tempMin: string;
  tempMax: string;
  rainAccumulated: string;
  rainProbabilityMax: string;
  windSpeedMax: string;
  predominantSymbol: string;
  date: string;
}

// Interface defining an hourly record (Por Hora)
export interface HourlyForecastItem {
  time: string;           // e.g. "01:00", "14:00"
  timestamp: number;      // Epoch ms
  temperature: number;    // e.g. 15.2
  tempFormatted: string;  // e.g. "15°C"
  humidity: number;       // e.g. 92
  humidityFormatted: string; // e.g. "92%"
  windSpeed: number;      // e.g. 18
  windSpeedFormatted: string; // e.g. "18 km/h"
  windDirection: string;  // e.g. "NW"
  precipitation: number;  // e.g. 0.2
  precipFormatted: string; // e.g. "0.2 mm"
  symbol: string;         // e.g. "Chubascos", "Despejado"
  isNight?: boolean;
}

// Full weather data structure containing Ahora, Hoy, and Por Hora
export interface FullWeatherData {
  current: WeatherData | null;
  today: DailyWeatherData | null;
  hourly: HourlyForecastItem[];
}

/**
 * Service class for fetching and processing weather conditions from Meteored API.
 */
export class MeteoredService {
  // Base endpoint for Meteored Business API
  private static readonly API_BASE = 'https://api.meteored.com';
  // Default credentials provided for the plant (used if env vars are missing on GitHub/production)
  private static readonly DEFAULT_API_KEY = 'b12e4e4a64c6dbd4289a59d4dfe8ba18aab9200d4f3e1ee1e73f5f301e7d0177';
  private static readonly DEFAULT_HASH = 'fa24b07ef5f5451424fe67082d99e981';

  /**
   * Translates numeric symbol codes from Meteored API into human-readable weather conditions.
   */
  public static formatSymbol(sym: any): string {
    if (sym === undefined || sym === null) return 'Despejado';
    if (typeof sym === 'string' && isNaN(Number(sym))) return sym;

    const num = Number(sym);
    switch (num) {
      case 1: return 'Despejado';
      case 2: return 'Algo Nublado';
      case 3: return 'Parcialmente Nublado';
      case 4: return 'Nublado';
      case 5: return 'Cubierto';
      case 6: return 'Lluvia Débil';
      case 7: return 'Lluvia';
      case 8: return 'Lluvia Fuerte';
      case 9: return 'Nieve';
      case 10: return 'Tormenta';
      case 11: return 'Niebla';
      case 12: return 'Lluvia Ligera';
      case 13: return 'Chubascos';
      case 14: return 'Lluvia Intensa';
      case 15: return 'Tormenta Eléctrica';
      case 16: return 'Granizo';
      default: return typeof sym === 'string' ? sym : 'Despejado';
    }
  }

  /**
   * Helper function to extract the hours list from Meteored API response.
   */
  private static extractHoursArray(data: any): any[] {
    if (!data) return [];
    if (Array.isArray(data)) return data;
    if (typeof data === 'object') {
      if (data.data) {
        if (Array.isArray(data.data.hours)) return data.data.hours;
        if (Array.isArray(data.data)) return data.data;
      }
      if (Array.isArray(data.hours)) return data.hours;
      if (Array.isArray(data.hourly)) return data.hourly;
      if (Array.isArray(data.hour)) return data.hour;
    }
    return [];
  }

  /**
   * Helper function to extract days list from Meteored API response.
   */
  private static extractDaysArray(data: any): any[] {
    if (!data) return [];
    if (Array.isArray(data)) return data;
    if (typeof data === 'object') {
      if (data.data) {
        if (Array.isArray(data.data.days)) return data.data.days;
        if (Array.isArray(data.data)) return data.data;
      }
      if (Array.isArray(data.days)) return data.days;
      if (Array.isArray(data.daily)) return data.daily;
    }
    return [];
  }

  /**
   * Helper function to extract the forecast record matching the current hour/time.
   */
  private static findCurrentRecord(rawHours: any[]): any {
    if (!rawHours || rawHours.length === 0) return null;

    const now = Date.now();
    const currentHour = new Date().getHours();
    let bestItem = rawHours[0];
    let minDiff = Infinity;

    for (let i = 0; i < rawHours.length; i++) {
      const h = rawHours[i];
      let ts: number | null = null;
      if (h.end || h.start) {
        ts = Number(h.end || h.start);
        if (ts < 10000000000) ts = ts * 1000;
      } else if (typeof h.hour === 'number') {
        const d = new Date();
        d.setHours(h.hour, 0, 0, 0);
        ts = d.getTime();
      } else if (typeof h.time === 'string') {
        const parts = h.time.split(':');
        if (parts.length >= 1) {
          const hr = parseInt(parts[0], 10);
          if (!isNaN(hr)) {
            const d = new Date();
            d.setHours(hr, 0, 0, 0);
            ts = d.getTime();
          }
        }
      }

      if (ts !== null) {
        const diff = Math.abs(ts - now);
        if (diff < minDiff) {
          minDiff = diff;
          bestItem = h;
        }
      } else {
        if (i === currentHour) {
          bestItem = h;
          break;
        }
      }
    }

    return bestItem;
  }

  /**
   * Helper function to extract the first forecast record from various possible API response shapes.
   */
  private static extractFirstRecord(data: any): any {
    const hours = this.extractHoursArray(data);
    if (hours.length > 0) return this.findCurrentRecord(hours) || hours[0];

    const days = this.extractDaysArray(data);
    if (days.length > 0) return days[0];

    return null;
  }

  /**
   * Fetches full weather data (Ahora, Hoy, Por Hora) combining GET /api/forecast/v1/hourly and GET /api/forecast/v1/daily.
   */
  public static async getFullWeather(locationHash?: string): Promise<FullWeatherData> {
    const apiKey = import.meta.env.VITE_METEORED_API_KEY || this.DEFAULT_API_KEY;
    const hash = locationHash || import.meta.env.VITE_METEORED_LOCATION_HASH || this.DEFAULT_HASH;

    let currentRes: WeatherData | null = null;
    let todayRes: DailyWeatherData | null = null;
    let hourlyRes: HourlyForecastItem[] = [];

    if (apiKey) {
      // 1. Fetch Hourly endpoint GET /api/forecast/v1/hourly/{hash}
      try {
        const hourlyUrl = `${this.API_BASE}/api/forecast/v1/hourly/${hash}`;
        const response = await fetch(hourlyUrl, {
          method: 'GET',
          headers: {
            'x-api-key': apiKey,
            'Accept': 'application/json',
          },
        });

        if (response.ok) {
          const json = await response.json();
          const rawHours = this.extractHoursArray(json);

          if (rawHours.length > 0) {
            // Build hourly array
            hourlyRes = rawHours.map((h: any, idx: number) => {
              const ts = h.end || h.start || (Date.now() + idx * 3600000);
              const dateObj = new Date(ts);
              const timeStr = dateObj.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });

              const tempVal = typeof h.temperature === 'number' ? h.temperature : (typeof h.temp === 'number' ? h.temp : 20);
              const humVal = typeof h.humidity === 'number' ? h.humidity : 50;
              const windVal = typeof h.wind_speed === 'number' ? h.wind_speed : 10;
              const windDirVal = String(h.wind_direction || h.wind_dir || 'S');
              const precipVal = typeof h.rain === 'number' ? h.rain : (typeof h.precipitation === 'number' ? h.precipitation : 0);
              const symText = this.formatSymbol(h.symbol ?? h.symbol_description);

              return {
                time: timeStr,
                timestamp: ts,
                temperature: Math.round(tempVal * 10) / 10,
                tempFormatted: `${Math.round(tempVal)}°C`,
                humidity: Math.round(humVal),
                humidityFormatted: `${Math.round(humVal)}%`,
                windSpeed: Math.round(windVal),
                windSpeedFormatted: `${Math.round(windVal)} km/h`,
                windDirection: windDirVal,
                precipitation: Math.round(precipVal * 10) / 10,
                precipFormatted: `${Math.round(precipVal * 10) / 10} mm`,
                symbol: symText,
                isNight: Boolean(h.night),
              };
            });

            // Set Ahora from current time record
            const currentRec = this.findCurrentRecord(rawHours) || rawHours[0];
            const tempRaw = currentRec.temperature ?? currentRec.temp ?? 21;
            const humRaw = currentRec.humidity ?? 50;
            const windRaw = currentRec.wind_speed ?? 12;
            const windDirRaw = currentRec.wind_direction ?? 'S';
            const precipRaw = currentRec.rain ?? currentRec.precipitation ?? 0;
            const symbolRaw = currentRec.symbol ?? currentRec.symbol_description;
            const forecastDateRaw = new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });

            currentRes = {
              temperature: `${Math.round(tempRaw)}°C`,
              humidity: `${Math.round(humRaw)}%`,
              windSpeed: `${Math.round(windRaw)} km/h`,
              windDirection: String(windDirRaw),
              precipitation: `${precipRaw} mm`,
              symbol: this.formatSymbol(symbolRaw),
              forecastDate: forecastDateRaw,
            };
          }
        }
      } catch (err) {
        console.warn('[meteoredService] Error fetching hourly forecast:', err);
      }

      // 2. Fetch Daily endpoint GET /api/forecast/v1/daily/{hash}
      try {
        const dailyUrl = `${this.API_BASE}/api/forecast/v1/daily/${hash}`;
        const response = await fetch(dailyUrl, {
          method: 'GET',
          headers: {
            'x-api-key': apiKey,
            'Accept': 'application/json',
          },
        });

        if (response.ok) {
          const json = await response.json();
          const rawDays = this.extractDaysArray(json);

          if (rawDays.length > 0) {
            const today = rawDays[0];
            const tempMin = today.temperature_min ?? today.temp_min ?? 12;
            const tempMax = today.temperature_max ?? today.temp_max ?? 18;
            const rainAcc = today.rain ?? today.precipitation ?? 0;
            const rainProb = today.rain_probability ?? today.pop ?? 0;
            const windMax = today.wind_gust ?? today.wind_speed ?? 15;
            const symbolText = this.formatSymbol(today.symbol);
            const dateStr = today.start ? new Date(today.start).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'short' }) : 'Hoy';

            todayRes = {
              tempMin: `${Math.round(tempMin)}°C`,
              tempMax: `${Math.round(tempMax)}°C`,
              rainAccumulated: `${rainAcc} mm`,
              rainProbabilityMax: `${Math.round(rainProb)}%`,
              windSpeedMax: `${Math.round(windMax)} km/h`,
              predominantSymbol: symbolText,
              date: dateStr,
            };
          }
        }
      } catch (err) {
        console.warn('[meteoredService] Error fetching daily forecast:', err);
      }
    }

    // --- Fallback if data is missing or network failed ---
    if (!currentRes || !todayRes || hourlyRes.length === 0) {
      const openMeteoData = await this.getOpenMeteoFallback();
      if (!currentRes) currentRes = openMeteoData.current;
      if (!todayRes) todayRes = openMeteoData.today;
      if (hourlyRes.length === 0) hourlyRes = openMeteoData.hourly;
    }

    return {
      current: currentRes,
      today: todayRes,
      hourly: hourlyRes,
    };
  }

  /**
   * Backward-compatible method to fetch current hourly forecast.
   */
  public static async getHourlyForecast(locationHash?: string): Promise<WeatherData | null> {
    const full = await this.getFullWeather(locationHash);
    return full.current;
  }

  /**
   * Fetches daily forecast data.
   */
  public static async getDailyForecast(locationHash?: string): Promise<DailyWeatherData | null> {
    const full = await this.getFullWeather(locationHash);
    return full.today;
  }

  /**
   * Fetches hourly list.
   */
  public static async getHourlyList(locationHash?: string): Promise<HourlyForecastItem[]> {
    const full = await this.getFullWeather(locationHash);
    return full.hourly;
  }

  /**
   * Open-Meteo fallback when Meteored is unavailable or blocked by CORS.
   */
  private static async getOpenMeteoFallback(): Promise<FullWeatherData> {
    const nowTime = new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
    const dateStr = new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'short' });

    try {
      const url = 'https://api.open-meteo.com/v1/forecast?latitude=-33.45&longitude=-70.66&current=temperature_2m,relative_humidity_2m,precipitation,weather_code,wind_speed_10m,wind_direction_10m&hourly=temperature_2m,relative_humidity_2m,precipitation,weather_code,wind_speed_10m,wind_direction_10m&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,wind_speed_10m_max,weather_code&timezone=auto';
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        
        // Current
        const cur = data.current || {};
        const curTemp = Math.round(cur.temperature_2m ?? 21);
        const curHum = Math.round(cur.relative_humidity_2m ?? 55);
        const curWind = Math.round(cur.wind_speed_10m ?? 14);
        const curPrecip = cur.precipitation ?? 0;
        const curCond = this.wmoToCondition(cur.weather_code ?? 0);

        const current: WeatherData = {
          temperature: `${curTemp}°C`,
          humidity: `${curHum}%`,
          windSpeed: `${curWind} km/h`,
          windDirection: 'S',
          precipitation: `${curPrecip} mm`,
          symbol: curCond,
          forecastDate: nowTime,
        };

        // Today
        const d = data.daily || {};
        const tMin = Math.round((d.temperature_2m_min && d.temperature_2m_min[0]) ?? 12);
        const tMax = Math.round((d.temperature_2m_max && d.temperature_2m_max[0]) ?? 18);
        const rSum = (d.precipitation_sum && d.precipitation_sum[0]) ?? 0;
        const rProb = Math.round((d.precipitation_probability_max && d.precipitation_probability_max[0]) ?? 20);
        const wMax = Math.round((d.wind_speed_10m_max && d.wind_speed_10m_max[0]) ?? 18);
        const dCond = this.wmoToCondition((d.weather_code && d.weather_code[0]) ?? 0);

        const today: DailyWeatherData = {
          tempMin: `${tMin}°C`,
          tempMax: `${tMax}°C`,
          rainAccumulated: `${rSum} mm`,
          rainProbabilityMax: `${rProb}%`,
          windSpeedMax: `${wMax} km/h`,
          predominantSymbol: dCond,
          date: dateStr,
        };

        // Hourly
        const h = data.hourly || {};
        const times: string[] = h.time || [];
        const hourly: HourlyForecastItem[] = times.slice(0, 24).map((tStr: string, idx: number) => {
          const dt = new Date(tStr);
          const tVal = h.temperature_2m?.[idx] ?? 20;
          const hVal = h.relative_humidity_2m?.[idx] ?? 50;
          const wVal = h.wind_speed_10m?.[idx] ?? 12;
          const pVal = h.precipitation?.[idx] ?? 0;
          const code = h.weather_code?.[idx] ?? 0;

          return {
            time: dt.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }),
            timestamp: dt.getTime(),
            temperature: Math.round(tVal * 10) / 10,
            tempFormatted: `${Math.round(tVal)}°C`,
            humidity: Math.round(hVal),
            humidityFormatted: `${Math.round(hVal)}%`,
            windSpeed: Math.round(wVal),
            windSpeedFormatted: `${Math.round(wVal)} km/h`,
            windDirection: 'S',
            precipitation: Math.round(pVal * 10) / 10,
            precipFormatted: `${Math.round(pVal * 10) / 10} mm`,
            symbol: this.wmoToCondition(code),
            isNight: dt.getHours() < 7 || dt.getHours() > 20,
          };
        });

        return { current, today, hourly };
      }
    } catch (err) {
      console.warn('[meteoredService] Open-Meteo fallback error:', err);
    }

    // Default static fallback
    return {
      current: {
        temperature: '21°C',
        humidity: '54%',
        windSpeed: '12 km/h',
        windDirection: 'S',
        precipitation: '0 mm',
        symbol: 'Despejado',
        forecastDate: nowTime,
      },
      today: {
        tempMin: '12°C',
        tempMax: '22°C',
        rainAccumulated: '0 mm',
        rainProbabilityMax: '10%',
        windSpeedMax: '18 km/h',
        predominantSymbol: 'Despejado',
        date: dateStr,
      },
      hourly: Array.from({ length: 12 }, (_, i) => {
        const h = (new Date().getHours() + i) % 24;
        const timeStr = `${h.toString().padStart(2, '0')}:00`;
        return {
          time: timeStr,
          timestamp: Date.now() + i * 3600000,
          temperature: 18 + Math.round(Math.sin(i / 2) * 4),
          tempFormatted: `${18 + Math.round(Math.sin(i / 2) * 4)}°C`,
          humidity: 50 + (i * 2) % 30,
          humidityFormatted: `${50 + (i * 2) % 30}%`,
          windSpeed: 10 + (i * 3) % 15,
          windSpeedFormatted: `${10 + (i * 3) % 15} km/h`,
          windDirection: 'NE',
          precipitation: i === 3 ? 0.4 : 0,
          precipFormatted: i === 3 ? '0.4 mm' : '0 mm',
          symbol: i === 3 ? 'Lluvia Ligera' : 'Despejado',
          isNight: h < 7 || h > 20,
        };
      }),
    };
  }

  /**
   * Helper to map WMO codes to condition strings.
   */
  private static wmoToCondition(code: number): string {
    if (code === 0) return 'Despejado';
    if (code >= 1 && code <= 3) return 'Parcialmente Nublado';
    if (code >= 45 && code <= 48) return 'Niebla';
    if (code >= 51 && code <= 67) return 'Lluvia';
    if (code >= 80 && code <= 82) return 'Chubascos';
    if (code >= 95) return 'Tormenta';
    return 'Despejado';
  }
}

// Export singleton/object as meteoredService following project architecture
export const meteoredService = MeteoredService;

