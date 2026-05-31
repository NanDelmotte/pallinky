import React from 'react';
import {
  ScrollView,
  StatusBar,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { StyledText } from '@pallinky/ui';
import { useI18n } from '@pallinky/i18n/client';
import { useFormalDraft } from '../../lib/formalDraft';

const COLORS = {
  background: '#F6F7F9',
  surface: '#FAFBF8',
  text: '#1f2a1b',
  textMuted: '#6f7669',
  primary: '#43691b',
  border: '#dce5d3',
  selectedBg: '#EEF4E9',
  selectedBorder: '#43691b',
};

export default function InviteOptionsScreen() {
  const { t } = useI18n();
  const { form, setForm } = useFormalDraft();

  const chooseInviteOption = (
    option: 'direct' | 'circle' | 'friends_of_friends'
  ) => {
    setForm((prev) => {
      if (option === 'direct') {
        return {
          ...prev,
          invite_option: option,
          visibility: 1,
          visible_in_feed: false,
          requires_approval: false,
          forwarding_mode: null,
        };
      }

      if (option === 'friends_of_friends') {
        return {
          ...prev,
          invite_option: option,
          visibility: 2,
          visible_in_feed: true,
          requires_approval: true,
          forwarding_mode: 'host_approval',
        };
      }

      return {
        ...prev,
        invite_option: option,
        visibility: 2,
        visible_in_feed: true,
        requires_approval: false,
        forwarding_mode: null,
      };
    });

    router.replace('/create/event-details');
  };

  const options = [
    {
      key: 'direct',
      emoji: '💬',
      title: t('invite_options_direct_title'),
      badge: t('invite_options_direct_badge'),
      body: t('invite_options_direct_body'),
      onPress: () => chooseInviteOption('direct'),
    },
    {
      key: 'circle',
      emoji: '👥',
      title: t('invite_options_circle_title'),
      badge: t('invite_options_circle_badge'),
      body: t('invite_options_circle_body'),
      onPress: () => chooseInviteOption('circle'),
    },
    {
      key: 'friends_of_friends',
      emoji: '🌐',
      title: t('invite_options_friends_title'),
      badge: t('invite_options_friends_badge'),
      body: t('invite_options_friends_body'),
      onPress: () => chooseInviteOption('friends_of_friends'),
    },
  ];

  const isSelected = (key: string) => {
    return form.invite_option === key;
  };

  return (
    <SafeAreaView style={styles.wrapper} edges={['top', 'left', 'right']}>
      <StatusBar barStyle="dark-content" />
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.topBar}>
        <TouchableOpacity
          onPress={() => router.replace('/create/event-type')}
          style={styles.navIconBtn}
        >
          <Ionicons name="arrow-back" size={28} color={COLORS.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.container}>
        <StyledText style={styles.title}>
          {t('invite_options_title')}
        </StyledText>

        <StyledText style={styles.subtitle}>
          {t('invite_options_subtitle')}
        </StyledText>

        {options.map((option) => (
          <TouchableOpacity
            key={option.key}
            style={[styles.card, isSelected(option.key) && styles.cardSelected]}
            activeOpacity={0.9}
            onPress={option.onPress}
          >
            <StyledText style={styles.emoji}>{option.emoji}</StyledText>

            <View style={styles.cardContent}>
              <View style={styles.cardHeader}>
                <StyledText style={styles.cardTitle}>
                  {option.title}
                </StyledText>

                <View style={styles.badge}>
                  <StyledText style={styles.badgeText}>
                    {option.badge}
                  </StyledText>
                </View>
              </View>

              <StyledText style={styles.cardBody}>
                {option.body}
              </StyledText>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  topBar: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 6,
  },

  navIconBtn: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },

  container: {
    padding: 25,
    paddingTop: 10,
    paddingBottom: 40,
  },

  title: {
    fontSize: 32,
    fontWeight: '900',
    color: COLORS.text,
    marginBottom: 8,
  },

  subtitle: {
    fontSize: 16,
    lineHeight: 23,
    color: COLORS.textMuted,
    marginBottom: 22,
  },

  card: {
    flexDirection: 'row',
    backgroundColor: COLORS.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 14,
    marginBottom: 12,
  },

  cardSelected: {
    borderColor: COLORS.selectedBorder,
    backgroundColor: COLORS.selectedBg,
  },

  emoji: {
    fontSize: 26,
    marginRight: 12,
    marginTop: 2,
  },

  cardContent: {
    flex: 1,
  },

  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 6,
  },

  cardTitle: {
    fontSize: 19,
    lineHeight: 23,
    fontWeight: '900',
    color: COLORS.text,
  },

  badge: {
    backgroundColor: COLORS.selectedBg,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },

  badgeText: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.primary,
  },

  cardBody: {
    fontSize: 14,
    lineHeight: 20,
    color: COLORS.textMuted,
  },
});
