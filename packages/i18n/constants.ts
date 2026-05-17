/**
 * Path: packages/i18n/constants.ts
 * Description: Server-safe language constants shared by translation helpers and client i18n UI.
 */

import type { AppLanguage } from './types';

export const LANGUAGE_STORAGE_KEY = 'pallinky_language_v1';
export const DEFAULT_LANGUAGE: AppLanguage = 'en';

export const LANGUAGE_OPTIONS: { code: AppLanguage; label: string }[] = [
  { code: 'en', label: 'English' },
  { code: 'nl', label: 'Nederlands' },
  { code: 'fr', label: 'Français' },
];

export function isAppLanguage(value: unknown): value is AppLanguage {
  return value === 'en' || value === 'nl' || value === 'fr';
}
