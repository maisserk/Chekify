/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Chekify Enterprise Industrial SaaS Framework
 * Legacy re-export wrapper for weatherService (Open-Meteo REST API)
 */

export * from './weatherService';
import { weatherService } from './weatherService';
export const meteoredService = weatherService;
