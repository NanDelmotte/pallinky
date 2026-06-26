/**
 * Path: app/event/[slug]/thanks.tsx
 * Description: Success page with scale-in animation. Added App Store bridge for Web users.
 */

import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  ActivityIndicator,
  Platform,
  Animated,
  StatusBar,
  Linking,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { supabase } from '@pallinky/core';
import { useI18n } from '@pallinky/i18n/client';
import { CalendarButton } from '@pallinky/ui';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';

const SYSTEM = {
  background: '#F6F7F9',
  surface: '#FFFFFF',
  text: '#1f2a1b',
  textMuted: '#66715f',
  primary: '#43691b',
  border: '#bac9ad',
  secondary: '#6A4C93',
  secondaryBg: '#efe9f7',
};

const PALETTES: Record<string, { bg: string; accent: string; text: string; isDark: boolean }> = {
  submerged: { bg: '#F6F7F9', accent: '#6A4C93', text: '#1f2a1b', isDark: false },
  zen: { bg: '#F6F7F9', accent: '#43691b', text: '#1f2a1b', isDark: false },
  girly: { bg: '#f4bbd3', accent: '#fe5d9f', text: '#2b1f24', isDark: false },
  fiesta: { bg: '#1729ae', accent: '#fe20e8', text: '#ffffff', isDark: true },
  classy: { bg: '#03172f', accent: '#efd466', text: '#fff7b6', isDark: true },
  spicy: { bg: '#656c12', accent: '#ecc216', text: '#ffffff', isDark: true },
};

const FONT_MAP: Record<string, string> = {
  Sans: Platform.OS === 'ios' ? 'Arial-BoldMT' : 'sans-serif-condensed',
  Serif: Platform.OS === 'ios' ? 'Times New Roman' : 'serif',
  Cursive: Platform.OS === 'ios' ? 'SnellRoundhand-Bold' : 'cursive',
  Gothic: Platform.OS === 'ios' ? 'Copperplate-Bold' : 'monospace',
};

const STORE_URL =
  Platform.OS === 'ios'
    ? 'https://apps.apple.com/app/idYOUR_APP_ID'
    : 'https://play.google.com/store/apps/details?id=com.your.package';

export default function ThanksPage() {
  const { slug, status } = useLocalSearchParams<{ slug: string; status: string }>();
  const router = useRouter();
  const { t } = useI18n();
  const [loading, setLoading] = useState(true);
  const [event, setEvent] = useState<any>(null);

  const scaleAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    async function loadEvent() {
      const { data } = await supabase.from('events').select('*').eq('slug', slug).single();
      if (data) setEvent(data);
      setLoading(false);

      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 50,
        friction: 7,
        useNativeDriver: true,
      }).start();
    }
    loadEvent();
  }, [slug]);

  if (loading || !event) {
    return <ActivityIndicator style={{ flex: 1 }} color={SYSTEM.primary} />;
  }

  const canOpenChat = ['yes', 'maybe', 'interested'].includes(String(status || '').toLowerCase());
  const isPlanningChat = event.event_type === 'reach_out';
  const theme = PALETTES[event.gif_key] || PALETTES.zen;
  const customFont = {
    fontFamily:
      FONT_MAP[event.font_family] || (Platform.OS === 'ios' ? 'Arial-BoldMT' : 'sans-serif'),
  };

  const finalGif =
    event.thanks_gif_url ||
    'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExeTV1bmo3bXRrcGc1cmZtM3lzY2prdnV3aDcxazduOWUxY29uZDNteCZlcD12MV9naWZzX3RyZW5kaW5nJmN0PWc/89x4osEodHEoo/giphy.gif';

  const getStatusMessage = () => {
    if (isPlanningChat && status === 'interested') return t('event_planning_chat_joined');
    if (status === 'yes') return "You're on the list!";
    if (status === 'maybe') return "We've marked you as a maybe.";
    if (status === 'interested') return "You're Hooked!";
    if (status === 'no') return "Sorry you can't make it!";
    return 'Response recorded!';
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.bg }]}>
      <StatusBar barStyle={theme.isDark ? 'light-content' : 'dark-content'} />
      <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>
        <View style={styles.content}>
          <Animated.View
            style={[
              styles.gifContainer,
              {
                borderColor: theme.accent,
                transform: [{ scale: scaleAnim }],
              },
            ]}
          >
            <Image source={{ uri: finalGif }} style={styles.gif} />
          </Animated.View>

          <Text style={[styles.title, { color: theme.text }, customFont]}>{getStatusMessage()}</Text>
          <Text style={[styles.subtitle, { color: theme.text, opacity: 0.7 }, customFont]}>
            {isPlanningChat
              ? t('event_planning_chat_host_notified', { host: event.host_name || 'The host' })
              : `${event.host_name} has been notified.`}
          </Text>

          {Platform.OS === 'web' && (
            <TouchableOpacity
              style={[styles.appPrompt, { backgroundColor: SYSTEM.surface, borderColor: SYSTEM.border }]}
              onPress={() => Linking.openURL(STORE_URL)}
            >
              <View style={[styles.appPromptIcon, { backgroundColor: SYSTEM.secondaryBg }]}>
                <MaterialCommunityIcons
                  name="cellphone-arrow-down"
                  size={24}
                  color={SYSTEM.secondary}
                />
              </View>
              <View style={styles.appPromptCopy}>
                <Text style={[styles.appPromptTitle, { color: SYSTEM.text }]}>
                  Get the Pallinky App
                </Text>
                <Text style={[styles.appPromptSub, { color: SYSTEM.textMuted }]}>
                  Never miss a group update.
                </Text>
              </View>
            </TouchableOpacity>
          )}

          {event.event_type !== 'vibe' &&
            ['yes', 'maybe'].includes(String(status).toLowerCase()) &&
            event.starts_at && (
              <View
                style={[
                  styles.card,
                  {
                    backgroundColor: theme.isDark ? 'rgba(255,255,255,0.12)' : SYSTEM.surface,
                    borderColor: theme.isDark ? 'rgba(255,255,255,0.12)' : SYSTEM.border,
                  },
                ]}
              >
                <Text style={[styles.cardTitle, { color: theme.text }, customFont]}>
                  Don&apos;t forget!
                </Text>
                <CalendarButton event={event} theme={theme} />
              </View>
            )}

          <View style={styles.buttonStack}>
            {canOpenChat && (
              <TouchableOpacity
                style={[
                  styles.primaryBtn,
                  { backgroundColor: theme.accent, borderColor: theme.accent, marginBottom: 12 },
                ]}
                onPress={() => router.replace(`/event/${slug}/chat` as any)}
              >
                <Text style={[styles.primaryBtnText, { color: theme.bg }]}>
                  {isPlanningChat ? t('event_open_planning_chat') : t('event_open_chat')}
                </Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={[styles.secondaryBtn, { borderColor: theme.accent }]}
              onPress={() => router.replace(`/event/${slug}/details` as any)}
            >
              <Text style={[styles.secondaryBtnText, { color: theme.accent }]}>Back to Details</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => router.replace('/(tabs)')} style={styles.homeBtn}>
              <Text style={[styles.homeLink, { color: theme.text, opacity: 0.6 }]}>Go to Home</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  scrollContainer: { flexGrow: 1, justifyContent: 'center' },
  content: { padding: 40, alignItems: 'center', paddingBottom: 60 },

  gifContainer: {
    width: 220,
    height: 220,
    borderRadius: 110,
    borderWidth: 6,
    overflow: 'hidden',
    marginBottom: 30,
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  gif: { width: '100%', height: '100%' },

  title: {
    fontSize: 32,
    fontWeight: '900',
    textAlign: 'center',
    marginBottom: 12,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 18,
    textAlign: 'center',
    marginBottom: 30,
    fontWeight: '500',
  },

  appPrompt: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 15,
    padding: 20,
    borderRadius: 24,
    marginBottom: 30,
    width: '100%',
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  appPromptIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  appPromptCopy: { flex: 1 },
  appPromptTitle: { fontSize: 18, fontWeight: '800' },
  appPromptSub: { fontSize: 13, fontWeight: '600' },

  card: {
    width: '100%',
    padding: 25,
    borderRadius: 28,
    alignItems: 'center',
    marginBottom: 30,
    borderWidth: 1,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 15,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },

  buttonStack: { width: '100%', alignItems: 'center' },

  primaryBtn: {
    width: '100%',
    paddingVertical: 18,
    borderRadius: 20,
    borderWidth: 2,
    alignItems: 'center',
  },
  primaryBtnText: { fontSize: 16, fontWeight: '800' },

  secondaryBtn: {
    width: '100%',
    paddingVertical: 18,
    borderRadius: 20,
    borderWidth: 2,
    alignItems: 'center',
    backgroundColor: SYSTEM.surface,
  },
  secondaryBtnText: { fontSize: 16, fontWeight: '800' },

  homeBtn: { marginTop: 25, padding: 10 },
  homeLink: { fontSize: 15, fontWeight: '700', textDecorationLine: 'underline' },
});
