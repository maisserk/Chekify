/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { WeatherData } from './services/meteoredService';

export type UserRole = 'Administrador' | 'Supervisor' | 'Operador';

export interface AppUser {
  uid: string;
  email: string;
  name: string;
  role: UserRole;
  plantId?: string;
  avatarUrl?: string;
  phone?: string;
  cargo?: string;
  rut?: string;
  departamento?: string;
  dismissedNotifications?: string[];
  readNotifications?: string[];
}

export interface Area {
  id: string;
  plantId: string;
  name: string;
  qrCode: string;
}

export type VOSOPreference = 'Crítico' | 'Operacional' | 'Seguridad' | 'Mantenimiento';

export interface VOSOItem {
  id: string;
  name: string;
  type: VOSOPreference;
}

export interface VOSOInspection {
  ver: VOSOItem[];
  oir: VOSOItem[];
  sentir: VOSOItem[];
  oler: VOSOItem[];
  orden: VOSOItem[];
}

export interface Equipment {
  id: string;
  plantId: string;
  areaId: string;
  name: string;
  qrCode?: string;
  inspectionOrder: number;
  checkItems?: { id: string; name: string }[];
  inspeccionVOSO?: VOSOInspection;
  status?: string;
}

export interface HistoryEntry {
  status: 'Open' | 'Closed' | 'InReview';
  userName: string;
  userId: string;
  timestamp: any;
  comment?: string;
  action: string;
}

export interface Finding {
  id: string;
  inspectionId: string;
  areaId: string;
  operatorId: string;
  operatorPhotoUrl?: string;
  description: string;
  photoUrl?: string;
  photoUrls?: string[];
  status: 'Open' | 'Closed' | 'InReview';
  solution?: string;
  closedBy?: string;
  closedAt?: any;
  supervisorComments?: string;
  createdAt: any;
  areaName?: string;
  operatorName?: string;
  plantId?: string;
  equipmentId?: string | null;
  equipmentName?: string | null;
  priority?: 'Alta' | 'Media' | 'Baja' | string;
  date?: any;
  source?: string;
  inspectionStartedAt?: any;
  inspectionCompletedAt?: any;
  inspectionDurationSeconds?: number;
  equipmentStartedAt?: any;
  equipmentCompletedAt?: any;
  equipmentDurationSeconds?: number;
  history?: HistoryEntry[];
  clima?: WeatherData | null;
}

export interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'Finding' | 'System' | 'Announcement';
  targetRole: 'All' | 'Administrador' | 'Supervisor' | 'Operador';
  scheduledAt: any;
  sentAt?: any;
  status: 'Pending' | 'Sent';
  createdBy: string;
  createdAt: any;
  referenceId?: string;
  plantId?: string;
}

export interface ReportSettings {
  logoUrl?: string;
  headerText?: string;
  footerText?: string;
  companyName?: string;
}

export interface VOSOResponse {
  status: 'OK' | 'Observación' | 'Crítico' | 'NA';
  comment?: string;
  photoUrl?: string;
  solvedByOperator?: boolean;
}
