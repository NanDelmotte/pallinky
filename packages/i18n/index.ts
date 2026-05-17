/**
 * Path: packages/i18n/index.ts
 * Description: Central exports for translations, language types, and the app-wide i18n provider.
 */

export { t } from './translate';
export type { AppLanguage, TranslationKey } from './types';
export {
  DEFAULT_LANGUAGE,
  I18nProvider,
  LANGUAGE_OPTIONS,
  LANGUAGE_STORAGE_KEY,
  useI18n,
} from './provider';
