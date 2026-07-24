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
  // Default location hash provided for the plant
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
   * Gets only the first available hourly record and formats it into a clean WeatherData object.
   * 
   * @param locationHash Optional location hash override (defaults to environment var or static hash)
   * @returns Promise resolving to WeatherData or null on error
   */
  public static async getHourlyForecast(locationHash?: string): Promise<WeatherData | null> {
    try {
      // Retrieve API key from environment variable (never hardcoded in React components)
      const apiKey = import.meta.env.VITE_METEORED_API_KEY;
      
      // Retrieve target location hash from parameter, env, or default fallback
      const hash = locationHash || import.meta.env.VITE_METEORED_LOCATION_HASH || this.DEFAULT_HASH;

      if (!apiKey) {
        console.warn('[meteoredService] VITE_METEORED_API_KEY is not defined in environment variables.');
        return null;
      }

      // Construct API endpoint: GET /api/forecast/v1/hourly/{hash}
      const url = `${this.API_BASE}/api/forecast/v1/hourly/${hash}`;

      // Perform HTTP request using fetch() with async/await
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'x-api-key': apiKey,
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        console.error(`[meteoredService] HTTP error! Status: ${response.status}`);
        return null;
      }

      const jsonResponse = await response.json();

      // Obtain only the first hourly record available
      const firstRecord = this.extractFirstHourlyRecord(jsonResponse);

      if (!firstRecord) {
        console.warn('[meteoredService] No hourly forecast records found in API response.');
        return null;
      }

      // Extract required fields safely with fallbacks
      const temperature = firstRecord.temp ?? firstRecord.temperature ?? firstRecord.t ?? firstRecord.temp_c ?? 'N/A';
      const humidity = firstRecord.humidity ?? firstRecord.rh ?? firstRecord.hum ?? 'N/A';
      const windSpeed = firstRecord.wind_speed ?? firstRecord.windSpeed ?? (typeof firstRecord.wind === 'object' ? firstRecord.wind.speed : firstRecord.wind) ?? 'N/A';
      const windDirection = firstRecord.wind_dir ?? firstRecord.windDirection ?? (typeof firstRecord.wind === 'object' ? firstRecord.wind.dir : undefined) ?? 'N/A';
      const precipitation = firstRecord.precipitation ?? firstRecord.rain ?? firstRecord.precip ?? firstRecord.prec ?? '0';
      const symbol = firstRecord.symbol_description ?? firstRecord.symbol ?? firstRecord.sky ?? firstRecord.condition ?? 'N/A';
      const forecastDate = firstRecord.date ?? firstRecord.forecastDate ?? firstRecord.local_time ?? firstRecord.time ?? new Date().toISOString();

      // Return clean interface structure
      const weatherData: WeatherData = {
        temperature: typeof temperature === 'number' ? `${temperature}°C` : `${temperature}`,
        humidity: typeof humidity === 'number' ? `${humidity}%` : `${humidity}`,
        windSpeed: typeof windSpeed === 'number' ? `${windSpeed} km/h` : `${windSpeed}`,
        windDirection: String(windDirection),
        precipitation: typeof precipitation === 'number' ? `${precipitation} mm` : `${precipitation}`,
        symbol: String(symbol),
        forecastDate: String(forecastDate),
      };

      return weatherData;
    } catch (error) {
      // On any error, log warning and return null so inspection flow is never blocked
      console.error('[meteoredService] Failed to fetch weather forecast:', error);
      return null;
    }
  }
}

// Export singleton/object as meteoredService following project architecture
export const meteoredService = MeteoredService;
