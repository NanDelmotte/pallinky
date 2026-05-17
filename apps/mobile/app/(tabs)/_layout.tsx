/**
 * Path: app/(tabs)/_layout.tsx 
 * Description: 5-tab layout with Inbox badge from notifications_inbox.
 */

import { Tabs } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { HapticTab } from '@pallinky/ui';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@pallinky/core';
import { useI18n } from '@pallinky/i18n';

export default function TabLayout() {
  const { t } = useI18n();
  const [inboxBadgeCount, setInboxBadgeCount] = useState(0);

  const loadInboxBadgeCount = useCallback(async () => {
    try {
      const { data, error } = await supabase.rpc('get_my_unread_inbox_count');

      if (error) {
        console.log('Inbox badge load error:', error);
        return;
      }

      setInboxBadgeCount(typeof data === 'number' ? data : 0);
    } catch (err) {
      console.log('Inbox badge load exception:', err);
    }
  }, []);

  useEffect(() => {
  void loadInboxBadgeCount();

  const existing = supabase
    .getChannels()
    .find((c: any) => c.topic === 'realtime:notifications-inbox-badge');

  if (existing) {
    void supabase.removeChannel(existing);
  }

  const channel = supabase
    .channel('notifications-inbox-badge')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'notifications_inbox' },
      () => {
        void loadInboxBadgeCount();
      }
    )
    .subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
}, [loadInboxBadgeCount]);

  return (
    <Tabs
      initialRouteName="index"
      screenOptions={{
        tabBarActiveTintColor: '#43691b',
        tabBarInactiveTintColor: '#0b1a2b',
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarStyle: Platform.select({
          ios: {
            position: 'absolute',
            backgroundColor: 'rgba(255, 255, 255, 0.9)',
          },
          default: {},
        }),
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t('tab_events'),
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? 'calendar' : 'calendar-outline'}
              size={24}
              color={color}
            />
          ),
        }}
      />
<Tabs.Screen
  name="events"
  options={{
    href: null,
  }}
/>
      <Tabs.Screen
  name="share-profile"
  options={{
    title: t('tab_share'),
    tabBarIcon: ({ color, focused }) => (
      <Ionicons
        name={focused ? 'qr-code' : 'qr-code-outline'}
        size={24}
        color={color}
      />
    ),
  }}
/>

      <Tabs.Screen
        name="people"
        options={{
          title: t('tab_people'),
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? 'people' : 'people-outline'}
              size={24}
              color={color}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="create"
        options={{
          title: t('tab_create'),
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? 'rocket' : 'rocket-outline'}
              size={24}
              color={color}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="inbox"
        options={{
          title: t('tab_inbox'),
          tabBarBadge: inboxBadgeCount > 0 ? inboxBadgeCount : undefined,
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? 'mail' : 'mail-outline'}
              size={24}
              color={color}
            />
          ),
        }}
      />
    </Tabs>
  );
}