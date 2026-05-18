/**
 * Path: packages/i18n/index.ts
 * Description: Server-safe exports for translations, language types, and i18n constants.
 */

export { DEFAULT_LANGUAGE, LANGUAGE_OPTIONS, LANGUAGE_STORAGE_KEY, isAppLanguage } from './constants';
export { t, t as translate } from './translate';
export type { AppLanguage, TranslationKey } from './types';
