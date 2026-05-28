import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useI18n } from '@pallinky/i18n/client';
import LanguageSelector from '../components/LanguageSelector';

const WELCOME_KEY = 'pallinky_welcome_seen_v1';

export default function WelcomeScreen() {
  const router = useRouter();
  const { t } = useI18n();

  const continueToLogin = async () => {
    await AsyncStorage.setItem(WELCOME_KEY, 'true');
    router.replace({
      pathname: '/auth/verify',
      params: { returnTo: encodeURIComponent('/onboarding-gate') },
    } as any);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.brand}>{t('welcome_title')}</Text>
      <Text style={styles.title}>{t('welcome_language_headline')}</Text>
      <Text style={styles.body}>{t('welcome_language_body')}</Text>

      <LanguageSelector />

      <TouchableOpacity
        style={styles.primary}
        onPress={() => {
          void continueToLogin();
        }}
      >
        <Text style={styles.primaryText}>{t('common_next')}</Text>
      </TouchableOpacity>
    </View>
  );
}

const SYSTEM = {
  background: '#F6F7F9',
  text: '#1f2a1b',
  primary: '#43691b',
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: SYSTEM.background,
    padding: 24,
    justifyContent: 'center',
  },
  brand: {
    color: SYSTEM.text,
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 42,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: SYSTEM.text,
    marginBottom: 16,
    lineHeight: 38,
  },
  body: {
    fontSize: 16,
    lineHeight: 24,
    color: '#66715f',
    marginBottom: 30,
  },
  primary: {
    backgroundColor: SYSTEM.primary,
    padding: 16,
    borderRadius: 12,
  },
  primaryText: {
    color: '#fff',
    textAlign: 'center',
    fontWeight: '700',
  },
});
