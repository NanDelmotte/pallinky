/**
 * Path: apps/mobile/app/_layout.tsx
 * Version: v19.5 (robust push token registration + badge sync)
 */

import React, { useEffect } from 'react';
import { AppState, Platform } from 'react-native';
import { Stack, useGlobalSearchParams, useRouter } from 'expo-router';
import * as Linking from 'expo-linking';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { supabase, SessionProvider } from '@pallinky/core';
import { completeSupabaseAuthFromUrl, isAuthCallbackUrl } from '../lib/authRedirect';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { I18nProvider, useI18n } from '@pallinky/i18n/client';
import { isAppLanguage } from '@pallinky/i18n';
import EasUpdateModal from '../components/EasUpdateModal';
import { useEasUpdate } from '../lib/useEasUpdate';

const PENDING_INVITE_DESTINATION_KEY = 'pallinky_pending_invite_destination_v1';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

async function getExpoPushToken(): Promise<string | null> {
  try {
    if (!Device.isDevice) {
      console.log('Push: not a physical device');
      return null;
    }

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
      });
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync({
        ios: {
          allowAlert: true,
          allowBadge: true,
          allowSound: true,
        },
      });
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.log('Push: permission denied');
      return null;
    }

    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ??
      Constants.easConfig?.projectId;

    if (!projectId) {
      console.log('Push: missing projectId');
      return null;
    }

    const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
    const token = tokenData.data;

    return token;
  } catch (err) {
    console.log('Push token fetch error:', err);
    return null;
  }
}

async function savePushTokenForCurrentUser(token: string) {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    const email = session?.user?.email?.toLowerCase().trim();

    if (!email) {
      console.log('Push: no user email');
      return;
    }

    const { error } = await supabase.rpc('save_push_token', {
      p_email: email,
      p_device_token: token,
      p_platform: Platform.OS,
    });

    if (error) {
      console.log('Push token save error:', error);
    } else {
    }
  } catch (err) {
    console.log('Push token save exception:', err);
  }
}

async function registerForPushNotifications() {
  const token = await getExpoPushToken();

  if (!token) {
    return;
  }

  await savePushTokenForCurrentUser(token);
}

async function syncBadgeWithInbox() {
  try {
    const { data, error } = await supabase.rpc('get_my_unread_inbox_count');

    if (error) {
      console.log('Badge sync error:', error);
      return;
    }

    const count = typeof data === 'number' ? data : 0;
    await Notifications.setBadgeCountAsync(count);
  } catch (err) {
    console.log('Badge sync exception:', err);
  }
}

function AppNavigator() {
  const router = useRouter();
  const params = useGlobalSearchParams<{ lang?: string; locale?: string; language?: string }>();
  const { language, setLanguage } = useI18n();

  useEffect(() => {
    const rawLanguage = params.lang || params.locale || params.language;
    const requestedLanguage = Array.isArray(rawLanguage) ? rawLanguage[0] : rawLanguage;

    if (isAppLanguage(requestedLanguage) && requestedLanguage !== language) {
      void setLanguage(requestedLanguage);
    }
  }, [language, params.lang, params.locale, params.language, setLanguage]);

  useEffect(() => {
    const openNotificationTarget = async (
      response: Notifications.NotificationResponse
    ) => {
      try {
        await syncBadgeWithInbox();

        const data = response.notification.request.content.data as {
          event_id?: string;
          thread_id?: string;
          type?: string;
        };

        if (data?.thread_id && data?.type === 'chat_message_batch') {
          router.push(`/chat/${data.thread_id}` as any);
          return;
        }

        const eventId = data?.event_id;
        if (!eventId) return;

        const { data: eventRow, error } = await supabase
          .from('events')
          .select('slug')
          .eq('id', eventId)
          .maybeSingle();

        if (error) {
          console.log('Push route lookup error:', error);
          router.push('/(tabs)' as any);
          return;
        }

        if (!eventRow?.slug) {
          console.log('Push route lookup: no slug found');
          router.push('/(tabs)' as any);
          return;
        }

        router.push(`/event/${eventRow.slug}/details` as any);
      } catch (err) {
        console.log('Push route open error:', err);
        router.push('/(tabs)' as any);
      }
    };

    const extractEventTargetFromUrl = (url: string): { slug: string; token?: string } | null => {
      try {
        const normalized = String(url || '').trim();
        const token = (() => {
          try {
            const parsed = new URL(normalized);
            return parsed.searchParams.get('token')?.trim() || undefined;
          } catch {
            const match = normalized.match(/[?&]token=([^&#]+)/i);
            return match?.[1] ? decodeURIComponent(match[1]) : undefined;
          }
        })();

        let match = normalized.match(/^https?:\/\/(?:www\.)?pallinky\.com\/event\/([^/?#]+)/i);
        if (match?.[1]) return { slug: decodeURIComponent(match[1]), token };

        match = normalized.match(/^pallinky(?:-dev)?:\/\/event\/([^/?#]+)/i);
        if (match?.[1]) return { slug: decodeURIComponent(match[1]), token };

        match = normalized.match(/\/event\/([^/?#]+)/i);
        if (match?.[1]) return { slug: decodeURIComponent(match[1]), token };

        return null;
      } catch {
        return null;
      }
    };

    const extractProfileIdFromAddUrl = (url: string): string | null => {
      try {
        const parsed = new URL(String(url || '').trim());
        const protocol = parsed.protocol.toLowerCase();
        const hostname = parsed.hostname.toLowerCase();
        const pathname = parsed.pathname.toLowerCase();
        const isWebAddLink =
          protocol === 'https:' &&
          (hostname === 'pallinky.com' || hostname === 'www.pallinky.com') &&
          pathname === '/add';
        const isAppAddLink =
          (protocol === 'pallinky:' || protocol === 'pallinky-dev:') &&
          (hostname === 'add' ||
            (hostname === 'people' && pathname === '/add') ||
            pathname === '/add' ||
            pathname === '/people/add');

        if (!isWebAddLink && !isAppAddLink) {
          return null;
        }

        const profileId = parsed.searchParams.get('profileId')?.trim();
        return profileId || null;
      } catch {
        return null;
      }
    };

    const handleIncomingUrl = async (url: string | null) => {
      if (!url) return;

      try {
        const eventTarget = extractEventTargetFromUrl(url);

        if (eventTarget) {
          const pendingDestination = `/event/${encodeURIComponent(eventTarget.slug)}/details${
            eventTarget.token ? `?token=${encodeURIComponent(eventTarget.token)}` : ''
          }`;
          await AsyncStorage.setItem(PENDING_INVITE_DESTINATION_KEY, pendingDestination);

          router.push({
            pathname: '/event/[slug]/details',
            params: {
              slug: eventTarget.slug,
              ...(eventTarget.token ? { token: eventTarget.token } : {}),
            },
          } as any);
          return;
        }

        const profileId = extractProfileIdFromAddUrl(url);

        if (profileId) {
          router.push({
            pathname: '/people/add',
            params: { profileId },
          } as any);
          return;
        }

        if (isAuthCallbackUrl(url)) {
          await completeSupabaseAuthFromUrl(url);
          await registerForPushNotifications();
          await syncBadgeWithInbox();
        }
      } catch (err) {
        console.log('Incoming URL handling error:', err);
      }
    };

    const linkingSubscription = Linking.addEventListener('url', ({ url }) => {
      void handleIncomingUrl(url);
    });

    void Linking.getInitialURL().then((url) => {
      void handleIncomingUrl(url);
    });

    const notificationSubscription =
      Notifications.addNotificationResponseReceivedListener((response) => {
        void openNotificationTarget(response);
      });

    void Notifications.getLastNotificationResponseAsync().then((response) => {
      if (response) {
        void openNotificationTarget(response);
      }
    });

    const appStateSubscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        void registerForPushNotifications();
        void syncBadgeWithInbox();
      }
    });

    const {
      data: { subscription: authSubscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (
        (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') &&
        session?.user?.email
      ) {
        void registerForPushNotifications();
        void syncBadgeWithInbox();
      }
    });

    void registerForPushNotifications();
    void syncBadgeWithInbox();

    return () => {
      linkingSubscription.remove();
      notificationSubscription.remove();
      appStateSubscription.remove();
      authSubscription.unsubscribe();
    };
  }, [router]);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="create" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="m" />
      <Stack.Screen
        name="auth"
        options={{
          presentation: 'card',
          gestureEnabled: false,
        }}
      />
    </Stack>
  );
}

function EasUpdateController() {
  const { updateAvailable, restarting, dismissUpdate, applyUpdate } = useEasUpdate();

  return (
    <EasUpdateModal
      visible={updateAvailable}
      restarting={restarting}
      onLater={dismissUpdate}
      onUpdateNow={() => {
        void applyUpdate();
      }}
    />
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <I18nProvider storage={AsyncStorage}>
        <SessionProvider>
          <AppNavigator />
          <EasUpdateController />
        </SessionProvider>
      </I18nProvider>
    </GestureHandlerRootView>
  );
}
