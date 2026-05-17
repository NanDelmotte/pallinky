'use client';

/**
 * Path: packages/i18n/provider.tsx
 * Description: App-wide i18n provider with manually selected, locally persisted language.
 */

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { DEFAULT_LANGUAGE, LANGUAGE_STORAGE_KEY, isAppLanguage } from './constants';
import { t as translate } from './translate';
import type { AppLanguage, TranslationKey } from './types';

type I18nStorage = {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
};

type I18nContextValue = {
  language: AppLanguage;
  setLanguage: (language: AppLanguage) => Promise<void>;
  t: (key: TranslationKey, vars?: Record<string, string>) => string;
  hydrated: boolean;
};

const I18nContext = createContext<I18nContextValue | null>(null);

type I18nProviderProps = {
  children: React.ReactNode;
  storage: I18nStorage;
};

export function I18nProvider({ children, storage }: I18nProviderProps) {
  const [language, setLanguageState] = useState<AppLanguage>(DEFAULT_LANGUAGE);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let active = true;

    storage
      .getItem(LANGUAGE_STORAGE_KEY)
      .then((storedLanguage) => {
        if (!active) return;
        setLanguageState(isAppLanguage(storedLanguage) ? storedLanguage : DEFAULT_LANGUAGE);
      })
      .catch(() => {
        if (active) setLanguageState(DEFAULT_LANGUAGE);
      })
      .finally(() => {
        if (active) setHydrated(true);
      });

    return () => {
      active = false;
    };
  }, [storage]);

  const setLanguage = useCallback(
    async (nextLanguage: AppLanguage) => {
      setLanguageState(nextLanguage);
      await storage.setItem(LANGUAGE_STORAGE_KEY, nextLanguage);
    },
    [storage]
  );

  const value = useMemo<I18nContextValue>(
    () => ({
      language,
      setLanguage,
      hydrated,
      t: (key, vars) => translate(language, key, vars),
    }),
    [hydrated, language, setLanguage]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const context = useContext(I18nContext);

  if (!context) {
    throw new Error('useI18n must be used inside I18nProvider');
  }

  return context;
}
