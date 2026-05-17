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

  const complete = async (destination: string) => {
    await AsyncStorage.setItem(WELCOME_KEY, 'true');
    router.replace(destination);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t('welcome_title')}</Text>

      <Text style={styles.body}>{t('welcome_body')}</Text>

      <LanguageSelector />

      <View style={styles.buttons}>
        <TouchableOpacity
          style={styles.primary}
          onPress={() => complete('/auth/verify')}
        >
<Text style={styles.primaryText}>{t('welcome_primary')}</Text>
        </TouchableOpacity>
 {/*         <TouchableOpacity
          style={styles.secondary}
          onPress={() => complete('/create/startervideo')}
        >
          <Text style={styles.secondaryText}>
            I want to discover Pallinky
          </Text>
        </TouchableOpacity>
*/}

       
      </View>
    </View>
  );
}

const SYSTEM = {
  background: '#F6F7F9',
  text: '#1f2a1b',
  primary: '#43691b',
  border: '#bac9ad',
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: SYSTEM.background,
    padding: 24,
    justifyContent: 'center',
  },
  title: {
    fontSize: 34,
    fontWeight: '700',
    color: SYSTEM.text,
    marginBottom: 16,
  },
  body: {
    fontSize: 16,
    lineHeight: 22,
    color: '#66715f',
    marginBottom: 40,
  },
  buttons: {
    gap: 12,
  },
  primary: {
    backgroundColor: SYSTEM.primary,
    padding: 16,
    borderRadius: 12,
  },
  primaryText: {
    color: '#fff',
    textAlign: 'center',
    fontWeight: '600',
  },
  secondary: {
    borderWidth: 1,
    borderColor: SYSTEM.border,
    padding: 16,
    borderRadius: 12,
  },
  secondaryText: {
    textAlign: 'center',
    fontWeight: '600',
    color: SYSTEM.text,
  },
  ghost: {
    padding: 12,
  },
  ghostText: {
    textAlign: 'center',
    color: '#66715f',
  },
});