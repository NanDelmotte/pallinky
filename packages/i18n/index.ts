/**
 * Path: packages/i18n/index.ts
<<<<<<< HEAD
 * Description: Server-safe exports for translations, language types, and i18n constants.
 */

export { DEFAULT_LANGUAGE, LANGUAGE_OPTIONS, LANGUAGE_STORAGE_KEY } from './constants';
export { t, t as translate } from './translate';
export type { AppLanguage, TranslationKey } from './types';
=======
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
>>>>>>> codex/add-internationalization-support-for-english,-french,-and-du
