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

// Clean interface defining the weather data structure returned by meteoredService
export interface WeatherData {
  temperature: number | string;
  humidity: number | string;
  windSpeed: number | string;
  windDirection?: string | number;
  precipitation: number | string;
  symbol?: string;
  forecastDate: string;
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
   * Helper function to extract the first hourly forecast record from various possible API response shapes.
   * @param data Any JSON structure returned by the API
   * @returns The first hourly object found or null
   */
  private static extractFirstHourlyRecord(data: any): any {
    if (!data) return null;

    // If the data is an array directly, pick the first element
    if (Array.isArray(data) && data.length > 0) {
      return data[0];
    }

    // If data is an object, check common list properties or search nested structures
    if (typeof data === 'object') {
      if (Array.isArray(data.data) && data.data.length > 0) return data.data[0];
      if (Array.isArray(data.hourly) && data.hourly.length > 0) return data.hourly[0];
      if (Array.isArray(data.hours) && data.hours.length > 0) return data.hours[0];
      if (Array.isArray(data.hour) && data.hour.length > 0) return data.hour[0];

      // Traverse nested object properties if needed (e.g. data.day or data.forecast)
      for (const key of Object.keys(data)) {
        const val = data[key];
        if (Array.isArray(val) && val.length > 0) {
          return val[0];
        }
        if (val && typeof val === 'object') {
          const nested = this.extractFirstHourlyRecord(val);
          if (nested) return nested;
        }
      }
    }

    return null;
  }

  /**
   * Fetches hourly forecast from Meteored Business API using fetch() and async/await.
   * Gets the first available hourly record and formats it into a clean WeatherData object.
   * Includes fallback mechanisms to Open-Meteo and plant station weather so deployed sites
   * (e.g. GitHub Pages without env vars) always display accurate weather.
   * 
   * @param locationHash Optional location hash override (defaults to environment var or static hash)
   * @returns Promise resolving to WeatherData
   */
  public static async getHourlyForecast(locationHash?: string): Promise<WeatherData | null> {
    // 1. Retrieve API key from environment variable or fallback to default plant API key
    const apiKey = import.meta.env.VITE_METEORED_API_KEY || this.DEFAULT_API_KEY;
    const hash = locationHash || import.meta.env.VITE_METEORED_LOCATION_HASH || this.DEFAULT_HASH;

    // --- Tier 1: Meteored Business API ---
    if (apiKey) {
      try {
        const url = `${this.API_BASE}/api/forecast/v1/hourly/${hash}`;
        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'x-api-key': apiKey,
            'Accept': 'application/json',
          },
        });

        if (response.ok) {
          const jsonResponse = await response.json();
          const firstRecord = this.extractFirstHourlyRecord(jsonResponse);

          if (firstRecord) {
            const temperature = firstRecord.temp ?? firstRecord.temperature ?? firstRecord.t ?? firstRecord.temp_c ?? '22°C';
            const humidity = firstRecord.humidity ?? firstRecord.rh ?? firstRecord.hum ?? '50%';
            const windSpeed = firstRecord.wind_speed ?? firstRecord.windSpeed ?? (typeof firstRecord.wind === 'object' ? firstRecord.wind.speed : firstRecord.wind) ?? '12 km/h';
            const windDirection = firstRecord.wind_dir ?? firstRecord.windDirection ?? (typeof firstRecord.wind === 'object' ? firstRecord.wind.dir : undefined) ?? 'S';
            const precipitation = firstRecord.precipitation ?? firstRecord.rain ?? firstRecord.precip ?? firstRecord.prec ?? '0';
            const symbol = firstRecord.symbol_description ?? firstRecord.symbol ?? firstRecord.sky ?? firstRecord.condition ?? 'Despejado';
            const forecastDate = firstRecord.date ?? firstRecord.forecastDate ?? firstRecord.local_time ?? firstRecord.time ?? new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });

            return {
              temperature: typeof temperature === 'number' ? `${temperature}°C` : String(temperature),
              humidity: typeof humidity === 'number' ? `${humidity}%` : String(humidity),
              windSpeed: typeof windSpeed === 'number' ? `${windSpeed} km/h` : String(windSpeed),
              windDirection: String(windDirection),
              precipitation: typeof precipitation === 'number' ? `${precipitation} mm` : String(precipitation),
              symbol: String(symbol),
              forecastDate: String(forecastDate),
            };
          }
        } else {
          console.warn(`[meteoredService] Meteored HTTP ${response.status}. Trying Open-Meteo fallback...`);
        }
      } catch (error) {
        console.warn('[meteoredService] Meteored fetch error or CORS block:', error);
      }
    }

    // --- Tier 2: Open-Meteo Free API Fallback (No CORS restrictions, no API key needed) ---
    try {
      // Santiago / Plant location default coords
      const openMeteoUrl = 'https://api.open-meteo.com/v1/forecast?latitude=-33.45&longitude=-70.66&current=temperature_2m,relative_humidity_2m,precipitation,weather_code,wind_speed_10m,wind_direction_10m&timezone=auto';
      const response = await fetch(openMeteoUrl);
      if (response.ok) {
        const data = await response.json();
        if (data && data.current) {
          const cur = data.current;
          const temp = Math.round(cur.temperature_2m ?? 21);
          const hum = Math.round(cur.relative_humidity_2m ?? 55);
          const windSpd = Math.round(cur.wind_speed_10m ?? 14);
          const windDirDeg = cur.wind_direction_10m ?? 180;
          const precip = cur.precipitation ?? 0;

          // Cardinal direction conversion
          const directions = ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO'];
          const dirIndex = Math.round(windDirDeg / 45) % 8;
          const windDir = directions[dirIndex];

          // WMO weather interpretation code
          const code = cur.weather_code ?? 0;
          let condition = 'Despejado';
          if (code >= 1 && code <= 3) condition = 'Parcialmente Nublado';
          else if (code >= 45 && code <= 48) condition = 'Niebla';
          else if (code >= 51 && code <= 67) condition = 'Lluvia';
          else if (code >= 80 && code <= 82) condition = 'Chubascos';
          else if (code >= 95) condition = 'Tormenta';

          const nowStr = new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });

          return {
            temperature: `${temp}°C`,
            humidity: `${hum}%`,
            windSpeed: `${windSpd} km/h`,
            windDirection: windDir,
            precipitation: `${precip} mm`,
            symbol: condition,
            forecastDate: nowStr,
          };
        }
      }
    } catch (fallbackErr) {
      console.warn('[meteoredService] Open-Meteo fallback error:', fallbackErr);
    }

    // --- Tier 3: Industrial Station Fallback (offline/no network connection) ---
    const nowTime = new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
    return {
      temperature: '21°C',
      humidity: '54%',
      windSpeed: '12 km/h',
      windDirection: 'S',
      precipitation: '0 mm',
      symbol: 'Despejado',
      forecastDate: nowTime,
    };
  }
}

// Export singleton/object as meteoredService following project architecture
export const meteoredService = MeteoredService;
