import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { supabase, useSession } from '@pallinky/core';
import { useI18n } from '@pallinky/i18n/client';

const PENDING_INVITE_DESTINATION_KEY = 'pallinky_pending_invite_destination_v1';

type RsvpEvent = {
  slug: string;
  title: string;
  hostName: string;
  isHost: boolean;
  isInviteContinuation: boolean;
};

type GateAction = 'event' | 'events' | 'learn';

function extractGuestToken(value: string | null) {
  if (!value) return '';

  try {
    const query = value.includes('?') ? value.slice(value.indexOf('?')) : '';
    return new URLSearchParams(query).get('token')?.trim() || '';
  } catch {
    const match = value.match(/[?&]token=([^&#]+)/i);
    return match?.[1] ? decodeURIComponent(match[1]) : '';
  }
}

function appendOnboardingSource(value: string) {
  const separator = value.includes('?') ? '&' : '?';
  return `${value}${separator}fromOnboardingGate=1`;
}

export default function OnboardingGateScreen() {
  const router = useRouter();
  const { session, loading: sessionLoading } = useSession();
  const { t } = useI18n();
  const [loading, setLoading] = useState(true);
  const [rsvpEvent, setRsvpEvent] = useState<RsvpEvent | null>(null);

  const loadLatestRsvp = useCallback(async () => {
    if (sessionLoading) return;

    const email = session?.user?.email?.toLowerCase().trim();

    if (!email) {
      router.replace({
        pathname: '/auth/verify',
        params: { returnTo: encodeURIComponent('/onboarding-gate') },
      } as any);
      return;
    }

    setLoading(true);

    try {
      const pendingDestination = await AsyncStorage.getItem(PENDING_INVITE_DESTINATION_KEY);
      const guestToken = extractGuestToken(pendingDestination);
      const filters = [`email_lc.eq.${email}`, `email.eq.${email}`];

      if (guestToken) {
        filters.push(`guest_token.eq.${guestToken}`);
      }

      const { data: rsvpRows, error: rsvpError } = await supabase
        .from('rsvps')
        .select('event_id, updated_at, guest_token, email_lc, email')
        .or(filters.join(','))
        .order('updated_at', { ascending: false })
        .limit(1);

      if (rsvpError) throw rsvpError;

      let eventId = rsvpRows?.[0]?.event_id;

      if (!eventId) {
        const requestFilters = [`requester_email_lc.eq.${email}`, `requester_email.eq.${email}`];

        if (guestToken) {
          requestFilters.push(`guest_token.eq.${guestToken}`);
        }

        const { data: requestRows, error: requestError } = await supabase
          .from('rsvp_join_requests')
          .select('event_id, created_at, guest_token, requester_email_lc, requester_email')
          .or(requestFilters.join(','))
          .order('created_at', { ascending: false })
          .limit(1);

        if (requestError) throw requestError;

        eventId = requestRows?.[0]?.event_id;
      }

      if (!eventId) {
        router.replace({
          pathname: '/onboarding',
          params: { destination: encodeURIComponent('/create') },
        } as any);
        return;
      }

      const { data: eventRow, error: eventError } = await supabase
        .from('events')
        .select('slug, title, host_name, host_email')
        .eq('id', eventId)
        .maybeSingle();

      if (eventError) throw eventError;

      if (!eventRow?.slug) {
        router.replace({
          pathname: '/onboarding',
          params: { destination: encodeURIComponent('/create') },
        } as any);
        return;
      }

      setRsvpEvent({
        slug: String(eventRow.slug),
        title: eventRow.title || t('people_event_fallback'),
        hostName: eventRow.host_name || t('common_someone'),
        isHost: eventRow.host_email?.toLowerCase().trim() === email,
        isInviteContinuation: !!pendingDestination,
      });
    } catch {
      router.replace({
        pathname: '/onboarding',
        params: { destination: encodeURIComponent('/create') },
      } as any);
    } finally {
      setLoading(false);
    }
  }, [router, session?.user?.email, sessionLoading, t]);

  useEffect(() => {
    void loadLatestRsvp();
  }, [loadLatestRsvp]);

  const openEvent = async () => {
    if (!rsvpEvent?.slug) return;

    const pendingDestination = await AsyncStorage.getItem(PENDING_INVITE_DESTINATION_KEY);
    await AsyncStorage.removeItem(PENDING_INVITE_DESTINATION_KEY);

    router.replace(
      appendOnboardingSource(pendingDestination || `/event/${rsvpEvent.slug}/details`) as any
    );
  };

  const openOnboarding = () => {
    router.replace({
      pathname: '/onboarding',
      params: { destination: encodeURIComponent('/create') },
    } as any);
  };

  const openMyEvents = async () => {
    await AsyncStorage.removeItem(PENDING_INVITE_DESTINATION_KEY);
    router.replace('/(tabs)' as any);
  };

  if (loading || sessionLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={SYSTEM.primary} size="large" />
      </View>
    );
  }

  if (!rsvpEvent) {
    return null;
  }

  const primaryAction: GateAction = rsvpEvent.isInviteContinuation ? 'event' : 'events';
  const secondaryActions: GateAction[] = rsvpEvent.isInviteContinuation
    ? ['learn', 'events']
    : ['event', 'learn'];

  const renderEventAction = (variant: 'primary' | 'secondary') => (
    <TouchableOpacity
      style={variant === 'primary' ? styles.primary : styles.secondary}
      onPress={() => {
        void openEvent();
      }}
    >
      <Text style={variant === 'primary' ? styles.primaryText : styles.secondaryText}>
        {t('rsvp_gate_view_event')}
      </Text>
    </TouchableOpacity>
  );

  const renderLearnAction = (variant: 'primary' | 'secondary') => (
    <TouchableOpacity
      style={variant === 'primary' ? styles.primary : styles.secondary}
      onPress={openOnboarding}
    >
      <Text style={variant === 'primary' ? styles.primaryText : styles.secondaryText}>
        {t('rsvp_gate_learn_more')}
      </Text>
    </TouchableOpacity>
  );

  const renderEventsAction = (variant: 'primary' | 'secondary') => (
    <TouchableOpacity
      style={variant === 'primary' ? styles.primary : styles.secondary}
      onPress={() => {
        void openMyEvents();
      }}
    >
      <Text style={variant === 'primary' ? styles.primaryText : styles.secondaryText}>
        {t('rsvp_gate_my_events')}
      </Text>
    </TouchableOpacity>
  );

  const renderAction = (action: GateAction, variant: 'primary' | 'secondary') => {
    if (action === 'event') return renderEventAction(variant);
    if (action === 'events') return renderEventsAction(variant);
    return renderLearnAction(variant);
  };

  return (
    <View style={styles.container}>
      <View style={styles.iconWrap}>
        <Ionicons name="checkmark-circle-outline" size={34} color={SYSTEM.primary} />
      </View>

      <Text style={styles.title}>
        {rsvpEvent.isHost ? t('rsvp_gate_host_title') : t('rsvp_gate_title')}
      </Text>
      <Text style={styles.body}>
        {rsvpEvent.isHost
          ? t('rsvp_gate_host_body', { event: rsvpEvent.title })
          : t('rsvp_gate_body', {
              event: rsvpEvent.title,
              host: rsvpEvent.hostName,
            })}
      </Text>

      {renderAction(primaryAction, 'primary')}
      {secondaryActions.map((action) => (
        <React.Fragment key={action}>{renderAction(action, 'secondary')}</React.Fragment>
      ))}
    </View>
  );
}

const SYSTEM = {
  background: '#F6F7F9',
  surface: '#FFFFFF',
  text: '#1f2a1b',
  textMuted: '#66715f',
  primary: '#43691b',
  border: '#bac9ad',
  secondaryBg: '#efe9f7',
};

const styles = StyleSheet.create({
  center: {
    alignItems: 'center',
    backgroundColor: SYSTEM.background,
    flex: 1,
    justifyContent: 'center',
  },
  container: {
    backgroundColor: SYSTEM.background,
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  iconWrap: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#eef4e7',
    borderRadius: 999,
    height: 66,
    justifyContent: 'center',
    marginBottom: 26,
    width: 66,
  },
  title: {
    color: SYSTEM.text,
    fontSize: 32,
    fontWeight: '800',
    lineHeight: 38,
    marginBottom: 14,
  },
  body: {
    color: SYSTEM.textMuted,
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 30,
  },
  primary: {
    backgroundColor: SYSTEM.primary,
    borderRadius: 12,
    padding: 16,
  },
  primaryText: {
    color: '#fff',
    fontWeight: '800',
    textAlign: 'center',
  },
  secondary: {
    borderColor: SYSTEM.border,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 12,
    padding: 16,
  },
  secondaryText: {
    color: SYSTEM.text,
    fontWeight: '800',
    textAlign: 'center',
  },
});
