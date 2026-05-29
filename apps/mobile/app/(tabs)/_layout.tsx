/**
 * Path: app/(tabs)/_layout.tsx 
 * Description: Main tab layout.
 */

import { Tabs } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { HapticTab } from '@pallinky/ui';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@pallinky/core';
import { useI18n } from '@pallinky/i18n/client';

export default function TabLayout() {
  const { t } = useI18n();
  const [chatBadgeCount, setChatBadgeCount] = useState(0);

  const loadChatBadgeCount = useCallback(async () => {
    try {
      const { data, error } = await supabase.rpc('get_my_notifications_inbox');

      if (error) {
        console.log('Chat badge load error:', error);
        return;
      }

      const total = ((data || []) as any[])
        .filter((row) => row.notification_type === 'chat_message_batch' && row.is_read === false)
        .reduce((sum, row) => sum + Number(row.unread_count || 0), 0);

      setChatBadgeCount(total);
    } catch (err) {
      console.log('Chat badge load exception:', err);
    }
  }, []);

  useEffect(() => {
  void loadChatBadgeCount();

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
        void loadChatBadgeCount();
      }
    )
    .subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
}, [loadChatBadgeCount]);

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
        name="chat"
        options={{
          title: t('tab_chat'),
          tabBarBadge: chatBadgeCount > 0 ? chatBadgeCount : undefined,
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? 'chatbubbles' : 'chatbubbles-outline'}
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
        name={focused ? 'person-add' : 'person-add-outline'}
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
          href: null,
        }}
      />
    </Tabs>
  );
}
