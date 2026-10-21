/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Chekify Enterprise Industrial SaaS Framework
 * Module: AuthConfig
 * 
 * Configuración temporal para demostraciones del sistema.
 * 
 * ADVERTENCIA DE SEGURIDAD:
 * Cuando TEMPORARY_DISABLE_RECAPTCHA es true, se suspende temporalmente la
 * verificación anti-bot de Google reCAPTCHA v2 en el formulario de inicio de sesión.
 * Firebase Authentication sigue plenamente activo y requiere credenciales válidas.
 * 
 * Para reactivar reCAPTCHA después de la demostración:
 * Cambiar TEMPORARY_DISABLE_RECAPTCHA a false (o VITE_DISABLE_RECAPTCHA="false").
 */

export const TEMPORARY_DISABLE_RECAPTCHA = 
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_DISABLE_RECAPTCHA === 'false')
    ? false
    : true;
