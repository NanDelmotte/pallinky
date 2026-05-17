/**
 * Path: apps/mobile/components/LanguageSelector.tsx
 * Description: Manual language picker for app startup and settings.
 */

import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { StyledText } from '@pallinky/ui';
import { Ionicons } from '@expo/vector-icons';
import type { AppLanguage } from '@pallinky/i18n/types';
import { LANGUAGE_OPTIONS, useI18n } from '@pallinky/i18n';

type LanguageSelectorProps = {
  compact?: boolean;
};

export default function LanguageSelector({ compact = false }: LanguageSelectorProps) {
  const { language, setLanguage, t } = useI18n();

  return (
    <View style={[styles.container, compact && styles.compactContainer]}>
      <StyledText style={styles.title}>{t('language_title')}</StyledText>
      {!compact && <StyledText style={styles.subtitle}>{t('language_subtitle')}</StyledText>}

      <View style={styles.options}>
        {LANGUAGE_OPTIONS.map((option) => {
          const selected = language === option.code;
          const labelKey = languageLabelKey(option.code);

          return (
            <Pressable
              key={option.code}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected }}
              onPress={() => void setLanguage(option.code)}
              style={[styles.option, selected && styles.optionSelected]}
            >
              <Ionicons
                name={selected ? 'radio-button-on' : 'radio-button-off'}
                size={20}
                color={selected ? '#43691b' : '#66715f'}
              />
              <StyledText style={[styles.optionLabel, selected && styles.optionLabelSelected]}>
                {t(labelKey)}
              </StyledText>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function languageLabelKey(language: AppLanguage) {
  switch (language) {
    case 'nl':
      return 'language_dutch';
    case 'fr':
      return 'language_french';
    case 'en':
    default:
      return 'language_english';
  }
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 28,
  },
  compactContainer: {
    marginBottom: 0,
  },
  title: {
    color: '#1f2a1b',
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 4,
  },
  subtitle: {
    color: '#66715f',
    fontSize: 13,
    marginBottom: 12,
  },
  options: {
    gap: 8,
  },
  option: {
    alignItems: 'center',
    backgroundColor: '#fff',
    borderColor: '#bac9ad',
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  optionSelected: {
    backgroundColor: '#f1f6ec',
    borderColor: '#43691b',
  },
  optionLabel: {
    color: '#66715f',
    fontWeight: '700',
  },
  optionLabelSelected: {
    color: '#1f2a1b',
  },
});
