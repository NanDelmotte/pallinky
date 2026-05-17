/**
 * Path: packages/i18n/translate.ts
 * Description: Translation helper (t function) to resolve localized strings with variables.
 */

import { en } from './en';
import { nl } from './nl';
import { fr } from './fr';
import type { AppLanguage, TranslationKey } from './types';

const dictionaries: Record<AppLanguage, Record<TranslationKey, string>> = {
  en,
  nl,
  fr,
};

export function t(
  lang: AppLanguage,
  key: TranslationKey,
  vars: Record<string, string> = {}
) {
  const dict = dictionaries[lang] ?? dictionaries.en;
  let text = dict[key] ?? dictionaries.en[key] ?? key;

  Object.entries(vars).forEach(([k, v]) => {
    text = text.replace(new RegExp(`\\{${k}\\}`, 'g'), v);
  });

  return text;
}
