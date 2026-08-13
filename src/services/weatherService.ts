/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Chekify Enterprise Industrial SaaS Framework
 * Service: weatherService (Open-Meteo REST API)
 */

export interface WeatherData {
  temperature: number | string;
  apparentTemperature?: number | string;
  humidity: number | string;
  windSpeed: number | string;
  windDirection?: string | number;
  windGusts?: number | string;
  precipitation: number | string;
  rain?: number | string;
  uvIndex?: number | string;
  uvIndexClearSky?: number | string;
  weatherCode?: number;
  cloudCover?: number | string;
  pressure?: number | string;
  visibility?: number | string;
  solarRadiation?: number | string;
  sunrise?: string;
  sunset?: string;
  symbol?: string;
  forecastDate: string;
  latitude?: number;
  longitude?: number;
  cityName?: string;
  timezone?: string;
  capturedAt?: string;
}

export interface DailyWeatherData {
  tempMin: string;
  tempMax: string;
  rainAccumulated: string;
  rainProbabilityMax: string;
  windSpeedMax: string;
  uvIndexMax?: number | string;
  sunrise?: string;
  sunset?: string;
  predominantSymbol: string;
  date: string;
}

export interface HourlyForecastItem {
  time: string;           // e.g. "01:00", "14:00"
  timestamp: number;      // Epoch ms
  temperature: number;
  tempFormatted: string;
  apparentTemperature?: number;
  apparentTempFormatted?: string;
  humidity: number;
  humidityFormatted: string;
  windSpeed: number;
  windSpeedFormatted: string;
  windDirection: string;
  windGusts?: number;
  windGustsFormatted?: string;
  precipitation: number;
  precipFormatted: string;
  rain?: number;
  rainFormatted?: string;
  uvIndex?: number;
  uvIndexFormatted?: string;
  uvIndexClearSky?: number;
  cloudCover?: number;
  cloudCoverFormatted?: string;
  pressure?: number;
  pressureFormatted?: string;
  visibility?: number;
  visibilityFormatted?: string;
  solarRadiation?: number;
  solarRadiationFormatted?: string;
  weatherCode?: number;
  symbol: string;
  isNight?: boolean;
}

export interface FullWeatherData {
  current: WeatherData | null;
  today: DailyWeatherData | null;
  hourly: HourlyForecastItem[];
  latitude?: number;
  longitude?: number;
  cityName?: string;
  timezone?: string;
}

/**
 * WMO Weather Code Translator to Spanish descriptions.
 */
export function getWeatherDescription(code: number): string {
  switch (code) {
    case 0: return 'Despejado';
    case 1: return 'Principalmente despejado';
    case 2: return 'Parcialmente nublado';
    case 3: return 'Nublado';
    case 45:
    case 48: return 'Niebla';
    case 51:
    case 53:
    case 55: return 'Llovizna';
    case 56:
    case 57: return 'Llovizna helada';
    case 61:
    case 63:
    case 65: return 'Lluvia';
    case 66:
    case 67: return 'Lluvia helada';
    case 71:
    case 73:
    case 75: return 'Nieve';
    case 77: return 'Granos de nieve';
    case 80:
    case 81:
    case 82: return 'Chubascos';
    case 85:
    case 86: return 'Chubascos de nieve';
    case 95: return 'Tormenta';
    case 96:
    case 99: return 'Tormenta con granizo';
    default: return 'Despejado';
  }
}

export function getWeatherSymbol(code: number): string {
  return getWeatherDescription(code);
}

/**
 * Converts wind degrees (0-360) to compass direction.
 */
export function degreesToCompass(deg?: number): string {
  if (deg === undefined || deg === null || isNaN(deg)) return 'N/A';
  const val = Math.floor((deg / 22.5) + 0.5);
  const arr = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
  return arr[val % 16] || 'N/A';
}

/**
 * Determines UV index category and styling color.
 */
export function getUVLevelInfo(uv?: number | string | null): { text: string; category: string; color: string; badgeBg: string } {
  if (uv === undefined || uv === null || uv === 'N/A' || uv === '') {
    return { text: 'N/A', category: 'N/A', color: 'text-zinc-400', badgeBg: 'bg-zinc-100 dark:bg-zinc-800' };
  }
  const val = typeof uv === 'number' ? uv : parseFloat(String(uv));
  if (isNaN(val)) return { text: String(uv), category: 'N/A', color: 'text-zinc-400', badgeBg: 'bg-zinc-100 dark:bg-zinc-800' };

  if (val <= 2) {
    return { text: `${val}`, category: 'Bajo', color: 'text-emerald-600 dark:text-emerald-400', badgeBg: 'bg-emerald-500/10 border-emerald-500/20' };
  } else if (val <= 5) {
    return { text: `${val}`, category: 'Moderado', color: 'text-yellow-600 dark:text-yellow-400', badgeBg: 'bg-yellow-500/10 border-yellow-500/20' };
  } else if (val <= 7) {
    return { text: `${val}`, category: 'Alto', color: 'text-amber-600 dark:text-amber-400', badgeBg: 'bg-amber-500/10 border-amber-500/20' };
  } else if (val <= 10) {
    return { text: `${val}`, category: 'Muy Alto', color: 'text-rose-600 dark:text-rose-400', badgeBg: 'bg-rose-500/10 border-rose-500/20' };
  } else {
    return { text: `${val}`, category: 'Extremo', color: 'text-purple-600 dark:text-purple-400', badgeBg: 'bg-purple-500/10 border-purple-500/20' };
  }
}

/**
 * Gets real device GPS coordinates if allowed, or IP-based geolocation as fallback.
 */
export async function getDeviceCoordinates(): Promise<{ latitude: number; longitude: number } | null> {
  // 1. Try Browser HTML5 Geolocation (GPS)
  if (typeof navigator !== 'undefined' && navigator.geolocation) {
    try {
      const gpsResult = await new Promise<{ latitude: number; longitude: number } | null>((resolve) => {
        navigator.geolocation.getCurrentPosition(
          (pos) => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
          (err) => {
            console.warn('[weatherService] GPS Geolocation Error/Denied:', err.message);
            resolve(null);
          },
          { timeout: 3500, maximumAge: 60000, enableHighAccuracy: true }
        );
      });
      if (gpsResult) {
        console.log('[weatherService] Coordenadas obtenidas via GPS:', gpsResult);
        return gpsResult;
      }
    } catch (e) {
      console.warn('[weatherService] Excepción en GPS:', e);
    }
  }

  // 2. IP-based Geolocation Fallback 1 (ipapi.co)
  try {
    console.log('[weatherService] Consultando geolocalización por IP (ipapi.co)...');
    const res = await fetch('https://ipapi.co/json/', { signal: AbortSignal.timeout(3000) });
    if (res.ok) {
      const ipData = await res.json();
      if (typeof ipData.latitude === 'number' && typeof ipData.longitude === 'number') {
        console.log('[weatherService] Ubicación IP detectada:', ipData.city, ipData.latitude, ipData.longitude);
        return { latitude: ipData.latitude, longitude: ipData.longitude };
      }
    }
  } catch (e) {
    console.warn('[weatherService] Error ipapi.co:', e);
  }

  // 3. IP-based Geolocation Fallback 2 (ipwho.is)
  try {
    console.log('[weatherService] Consultando geolocalización por IP secundaria (ipwho.is)...');
    const res2 = await fetch('https://ipwho.is/', { signal: AbortSignal.timeout(3000) });
    if (res2.ok) {
      const ipData2 = await res2.json();
      if (ipData2.success && typeof ipData2.latitude === 'number' && typeof ipData2.longitude === 'number') {
        console.log('[weatherService] Ubicación IP secundaria detectada:', ipData2.city, ipData2.latitude, ipData2.longitude);
        return { latitude: ipData2.latitude, longitude: ipData2.longitude };
      }
    }
  } catch (e) {
    console.warn('[weatherService] Error ipwho.is:', e);
  }

  return null;
}

// In-memory cache for Open-Meteo responses (valid for 15 minutes)
interface CacheEntry {
  data: FullWeatherData;
  timestamp: number;
}
const cacheMap = new Map<string, CacheEntry>();
const pendingRequests = new Map<string, Promise<FullWeatherData>>();
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes

export class WeatherService {
  private static readonly API_ENDPOINT = 'https://api.open-meteo.com/v1/forecast';

  /**
   * Main function to fetch full weather data from Open-Meteo.
   * Handles dynamic coordinates, caching, deduplication, and offline fallback.
   */
  public static async getFullWeather(
    lat?: number | null,
    lon?: number | null,
    tz?: string
  ): Promise<FullWeatherData> {
    // 1. Resolve coordinates: Priority 1 is AUTOMATIC DEVICE GEOLOCATION
    let latitude: number | null = null;
    let longitude: number | null = null;

    const devCoords = await getDeviceCoordinates();
    if (devCoords) {
      latitude = devCoords.latitude;
      longitude = devCoords.longitude;
      console.log('[WEATHER] Geolocalización automática detectada desde dispositivo:', devCoords);
    } else if (lat != null && lon != null && !isNaN(Number(lat)) && !isNaN(Number(lon))) {
      latitude = Number(lat);
      longitude = Number(lon);
      console.log('[WEATHER] GPS de dispositivo no disponible. Usando coordenadas de planta:', { latitude, longitude });
    } else {
      latitude = -23.6500;
      longitude = -70.4000;
      console.log('[WEATHER] Sin GPS ni coordenadas de planta. Usando fallback:', { latitude, longitude });
    }

    latitude = Number(latitude);
    longitude = Number(longitude);

    console.log('[WEATHER] Coordenadas finales para Open-Meteo:', {
      latitude,
      longitude
    });

    const cacheKey = `${latitude.toFixed(2)},${longitude.toFixed(2)}`;
    const now = Date.now();

    // 2. Check valid cache
    const cached = cacheMap.get(cacheKey);
    if (cached && (now - cached.timestamp) < CACHE_TTL_MS) {
      console.log('[WEATHER] Devolviendo datos en caché para:', cacheKey);
      return cached.data;
    }

    // 3. Check in-flight request deduplication
    if (pendingRequests.has(cacheKey)) {
      return pendingRequests.get(cacheKey)!;
    }

    // 4. Perform actual fetch to Open-Meteo REST API
    const fetchPromise = (async (): Promise<FullWeatherData> => {
      try {
        const url = new URL(this.API_ENDPOINT);
        url.searchParams.set('latitude', String(latitude));
        url.searchParams.set('longitude', String(longitude));
        url.searchParams.set('wind_speed_unit', 'kmh');
        url.searchParams.set('current', [
          'temperature_2m',
          'relative_humidity_2m',
          'apparent_temperature',
          'precipitation',
          'rain',
          'weather_code',
          'cloud_cover',
          'pressure_msl',
          'wind_speed_10m',
          'wind_direction_10m',
          'wind_gusts_10m'
        ].join(','));
        url.searchParams.set('hourly', [
          'uv_index',
          'uv_index_clear_sky',
          'shortwave_radiation',
          'visibility',
          'temperature_2m',
          'relative_humidity_2m',
          'apparent_temperature',
          'precipitation',
          'rain',
          'weather_code',
          'cloud_cover',
          'pressure_msl',
          'wind_speed_10m',
          'wind_direction_10m',
          'wind_gusts_10m'
        ].join(','));
        url.searchParams.set('daily', [
          'uv_index_max',
          'sunrise',
          'sunset',
          'temperature_2m_max',
          'temperature_2m_min',
          'precipitation_sum',
          'precipitation_probability_max',
          'wind_speed_10m_max',
          'weather_code'
        ].join(','));
        url.searchParams.set('timezone', tz || 'auto');

        console.log('[WEATHER] Open-Meteo URL:', url.toString());

        const response = await fetch(url.toString());
        console.log('[WEATHER] HTTP status:', response.status);

        if (!response.ok) {
          throw new Error(`Open-Meteo HTTP ${response.status}`);
        }

        const data = await response.json();
        console.log('[WEATHER] Open-Meteo response:', data);

        // Helper function for hourly values matched to current time
        const getCurrentHourlyValue = <T>(
          hourlyTimes?: string[],
          hourlyValues?: T[],
          currentTimeIso?: string
        ): { value: T | undefined; index: number } => {
          if (!Array.isArray(hourlyTimes) || !Array.isArray(hourlyValues) || hourlyTimes.length === 0) {
            return { value: undefined, index: 0 };
          }
          if (!currentTimeIso) {
            return { value: hourlyValues[0], index: 0 };
          }

          let idx = hourlyTimes.indexOf(currentTimeIso);
          if (idx === -1) {
            const targetMs = new Date(currentTimeIso).getTime();
            let minDiff = Infinity;
            idx = 0;
            hourlyTimes.forEach((tStr, i) => {
              const diff = Math.abs(new Date(tStr).getTime() - targetMs);
              if (diff < minDiff) {
                minDiff = diff;
                idx = i;
              }
            });
          }
          return { value: hourlyValues[idx], index: idx };
        };

        const currentTimeIso = data.current?.time;
        const currentHourlyUv = getCurrentHourlyValue(data.hourly?.time, data.hourly?.uv_index, currentTimeIso);
        const currentHourlyUvClear = getCurrentHourlyValue(data.hourly?.time, data.hourly?.uv_index_clear_sky, currentTimeIso);
        const currentHourlySolar = getCurrentHourlyValue(data.hourly?.time, data.hourly?.shortwave_radiation, currentTimeIso);
        const currentHourlyVis = getCurrentHourlyValue(data.hourly?.time, data.hourly?.visibility, currentTimeIso);

        // Current weather parsing
        const cur = data.current || {};
        const curCode = cur.weather_code ?? 0;
        const curTemp = cur.temperature_2m !== undefined ? Math.round(cur.temperature_2m * 10) / 10 : 0;
        const curApparent = cur.apparent_temperature !== undefined ? Math.round(cur.apparent_temperature * 10) / 10 : curTemp;
        const curHum = cur.relative_humidity_2m !== undefined ? Math.round(cur.relative_humidity_2m) : 0;
        const curWind = cur.wind_speed_10m !== undefined ? Math.round(cur.wind_speed_10m) : 0;
        const curWindDir = degreesToCompass(cur.wind_direction_10m);
        const curGusts = cur.wind_gusts_10m !== undefined ? Math.round(cur.wind_gusts_10m) : undefined;
        const curPrecip = cur.precipitation !== undefined ? Math.round(cur.precipitation * 10) / 10 : 0;
        const curRain = cur.rain !== undefined ? Math.round(cur.rain * 10) / 10 : curPrecip;

        const curUv = currentHourlyUv.value !== undefined ? Math.round(Number(currentHourlyUv.value) * 10) / 10 : undefined;
        const curUvClear = currentHourlyUvClear.value !== undefined ? Math.round(Number(currentHourlyUvClear.value) * 10) / 10 : undefined;
        const curSolarRad = currentHourlySolar.value !== undefined ? Math.round(Number(currentHourlySolar.value)) : undefined;
        const curVisMeters = currentHourlyVis.value;
        const curVis = curVisMeters !== undefined ? Math.round(Number(curVisMeters) / 100) / 10 : undefined; // km

        const curCloud = cur.cloud_cover !== undefined ? Math.round(cur.cloud_cover) : undefined;
        const curPressure = cur.pressure_msl !== undefined ? Math.round(cur.pressure_msl) : undefined;

        // Daily sunrise/sunset time format
        const sunriseIso = data.daily?.sunrise?.[0];
        const sunsetIso = data.daily?.sunset?.[0];
        const formatTime = (iso?: string) => iso && iso.includes('T') ? iso.split('T')[1].slice(0, 5) : (iso || '');
        const sunriseStr = formatTime(sunriseIso);
        const sunsetStr = formatTime(sunsetIso);

        const forecastDate = new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });

        // Reverse Geocoding to get real City/Locality Name
        let resolvedCityName = '';
        try {
          const geoRes = await fetch(
            `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=es`,
            { signal: AbortSignal.timeout(2500) }
          );
          if (geoRes.ok) {
            const geoData = await geoRes.json();
            resolvedCityName = geoData.city || geoData.locality || geoData.principalSubdivision || '';
          }
        } catch (e) {
          console.warn('[WEATHER] Reverse geocode fetch warning:', e);
        }

        const currentWeather: WeatherData = {
          temperature: `${curTemp}°C`,
          apparentTemperature: `${curApparent}°C`,
          humidity: `${curHum}%`,
          windSpeed: `${curWind} km/h`,
          windDirection: curWindDir,
          windGusts: curGusts !== undefined ? `${curGusts} km/h` : undefined,
          precipitation: `${curPrecip} mm`,
          rain: `${curRain} mm`,
          uvIndex: curUv,
          uvIndexClearSky: curUvClear,
          weatherCode: curCode,
          cloudCover: curCloud !== undefined ? `${curCloud}%` : undefined,
          pressure: curPressure !== undefined ? `${curPressure} hPa` : undefined,
          visibility: curVis !== undefined ? `${curVis} km` : undefined,
          solarRadiation: curSolarRad !== undefined ? `${curSolarRad} W/m²` : undefined,
          sunrise: sunriseStr,
          sunset: sunsetStr,
          symbol: getWeatherDescription(curCode),
          forecastDate: forecastDate,
          latitude: latitude,
          longitude: longitude,
          cityName: resolvedCityName,
          timezone: data.timezone || tz || 'auto',
          capturedAt: new Date().toISOString()
        };

        console.log('[WEATHER] WeatherData normalizado:', currentWeather);

        // Today weather parsing
        const d = data.daily || {};
        const tMin = d.temperature_2m_min?.[0] !== undefined ? Math.round(d.temperature_2m_min[0]) : 0;
        const tMax = d.temperature_2m_max?.[0] !== undefined ? Math.round(d.temperature_2m_max[0]) : 0;
        const rSum = d.precipitation_sum?.[0] !== undefined ? Math.round(d.precipitation_sum[0] * 10) / 10 : 0;
        const rProb = d.precipitation_probability_max?.[0] !== undefined ? Math.round(d.precipitation_probability_max[0]) : 0;
        const wMax = d.wind_speed_10m_max?.[0] !== undefined ? Math.round(d.wind_speed_10m_max[0]) : 0;
        const uvMax = d.uv_index_max?.[0] !== undefined ? Math.round(d.uv_index_max[0] * 10) / 10 : undefined;
        const dCode = d.weather_code?.[0] ?? curCode;
        const dateStr = new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'short' });

        const todayWeather: DailyWeatherData = {
          tempMin: `${tMin}°C`,
          tempMax: `${tMax}°C`,
          rainAccumulated: `${rSum} mm`,
          rainProbabilityMax: `${rProb}%`,
          windSpeedMax: `${wMax} km/h`,
          uvIndexMax: uvMax,
          sunrise: sunriseStr,
          sunset: sunsetStr,
          predominantSymbol: getWeatherDescription(dCode),
          date: dateStr,
        };

        // Hourly forecast parsing
        const h = data.hourly || {};
        const times: string[] = h.time || [];
        const hourly: HourlyForecastItem[] = times.slice(0, 24).map((tStr: string, idx: number) => {
          const dt = new Date(tStr);
          const timeFormatted = dt.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
          const code = h.weather_code?.[idx] ?? 0;
          const temp = h.temperature_2m?.[idx] !== undefined ? Math.round(h.temperature_2m[idx] * 10) / 10 : 0;
          const appTemp = h.apparent_temperature?.[idx] !== undefined ? Math.round(h.apparent_temperature[idx] * 10) / 10 : temp;
          const hum = h.relative_humidity_2m?.[idx] !== undefined ? Math.round(h.relative_humidity_2m[idx]) : 0;
          const wind = h.wind_speed_10m?.[idx] !== undefined ? Math.round(h.wind_speed_10m[idx]) : 0;
          const windDir = degreesToCompass(h.wind_direction_10m?.[idx]);
          const gusts = h.wind_gusts_10m?.[idx] !== undefined ? Math.round(h.wind_gusts_10m[idx]) : undefined;
          const precip = h.precipitation?.[idx] !== undefined ? Math.round(h.precipitation[idx] * 10) / 10 : 0;
          const rain = h.rain?.[idx] !== undefined ? Math.round(h.rain[idx] * 10) / 10 : precip;
          const uv = h.uv_index?.[idx] !== undefined ? Math.round(h.uv_index[idx] * 10) / 10 : undefined;
          const uvClear = h.uv_index_clear_sky?.[idx] !== undefined ? Math.round(h.uv_index_clear_sky[idx] * 10) / 10 : undefined;
          const cloud = h.cloud_cover?.[idx] !== undefined ? Math.round(h.cloud_cover[idx]) : undefined;
          const press = h.pressure_msl?.[idx] !== undefined ? Math.round(h.pressure_msl[idx]) : undefined;
          const visM = h.visibility?.[idx];
          const vis = visM !== undefined ? Math.round(visM / 100) / 10 : undefined;
          const solRad = h.shortwave_radiation?.[idx] !== undefined ? Math.round(h.shortwave_radiation[idx]) : undefined;

          return {
            time: timeFormatted,
            timestamp: dt.getTime(),
            temperature: temp,
            tempFormatted: `${temp}°C`,
            apparentTemperature: appTemp,
            apparentTempFormatted: `${appTemp}°C`,
            humidity: hum,
            humidityFormatted: `${hum}%`,
            windSpeed: wind,
            windSpeedFormatted: `${wind} km/h`,
            windDirection: windDir,
            windGusts: gusts,
            windGustsFormatted: gusts !== undefined ? `${gusts} km/h` : undefined,
            precipitation: precip,
            precipFormatted: `${precip} mm`,
            rain: rain,
            rainFormatted: `${rain} mm`,
            uvIndex: uv,
            uvIndexFormatted: uv !== undefined ? `${uv}` : undefined,
            uvIndexClearSky: uvClear,
            cloudCover: cloud,
            cloudCoverFormatted: cloud !== undefined ? `${cloud}%` : undefined,
            pressure: press,
            pressureFormatted: press !== undefined ? `${press} hPa` : undefined,
            visibility: vis,
            visibilityFormatted: vis !== undefined ? `${vis} km` : undefined,
            solarRadiation: solRad,
            solarRadiationFormatted: solRad !== undefined ? `${solRad} W/m²` : undefined,
            weatherCode: code,
            symbol: getWeatherDescription(code),
            isNight: dt.getHours() < 7 || dt.getHours() > 20,
          };
        });

        const fullResult: FullWeatherData = {
          current: currentWeather,
          today: todayWeather,
          hourly: hourly,
          latitude: latitude,
          longitude: longitude,
          cityName: resolvedCityName,
          timezone: data.timezone || tz || 'auto',
        };

        // Cache result
        cacheMap.set(cacheKey, { data: fullResult, timestamp: Date.now() });
        return fullResult;

      } catch (err) {
        console.warn('[WEATHER] Fetch failed:', err);
        // Offline / error fallback: Return expired cache if available
        if (cached) {
          console.warn('[WEATHER] Returning expired cache as offline fallback.');
          return cached.data;
        }
        return {
          current: null,
          today: null,
          hourly: [],
        };
      } finally {
        pendingRequests.delete(cacheKey);
      }
    })();

    pendingRequests.set(cacheKey, fetchPromise);
    return fetchPromise;
  }

  public static async getCurrentWeather(
    lat?: number | null,
    lon?: number | null,
    tz?: string
  ): Promise<WeatherData | null> {
    const full = await this.getFullWeather(lat, lon, tz);
    return full.current;
  }

  public static async getHourlyForecast(
    lat?: number | null,
    lon?: number | null,
    tz?: string
  ): Promise<WeatherData | null> {
    return this.getCurrentWeather(lat, lon, tz);
  }

  public static async getDailyForecast(
    lat?: number | null,
    lon?: number | null,
    tz?: string
  ): Promise<DailyWeatherData | null> {
    const full = await this.getFullWeather(lat, lon, tz);
    return full.today;
  }

  public static async getHourlyList(
    lat?: number | null,
    lon?: number | null,
    tz?: string
  ): Promise<HourlyForecastItem[]> {
    const full = await this.getFullWeather(lat, lon, tz);
    return full.hourly;
  }
}

export const weatherService = WeatherService;
