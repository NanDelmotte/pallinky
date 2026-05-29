/**
 * Path: apps/mobile/components/dashboard/FriendsActivities.tsx
 * Description: Friends' activities list driven by feed signals when available.
 * Falls back to raw data only if signals are not passed.
 * Hidden cards are sourced from Supabase closed_cards only.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { View, StyleSheet, ScrollView, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import ActivityFeedCard from '../../../../packages/ui/src/ActivityFeedCard';
import { supabase } from '@pallinky/core';
import { useI18n } from '@pallinky/i18n/client';

interface FriendsActivitiesProps {
  data: {
    events: any[];
    rsvps: any[];
    chatSummaries?: Record<string, any>;
    userEmail: string;
    userPersonId?: string;
    accessByEventId?: Record<string, any>;
  };
  theme: any;
  onRefresh?: () => void;
  signals?: any[];
}

type ActivityItem = {
  key: string;
  signalType: 'friend_created_event' | 'friend_attending_event';
  actorKey?: string;
  actorPersonId?: string;
  actorPersonEmail?: string;
  actorName: string;
  event: any;
};

function normalizeEmail(value: string | null | undefined) {
  return (value || '').toLowerCase().trim();
}

function normalizePersonId(value: unknown) {
  const id = String(value || '').trim();
  return id || '';
}

function resolveIdentity(input: any) {
  const personId = normalizePersonId(
    input?.person_id ??
      input?.personId ??
      input?.matched_user_id ??
      input?.member_user_id ??
      null
  );

  const personEmail = normalizeEmail(
    input?.email_lc ??
      input?.email ??
      input?.personEmail ??
      input?.host_email ??
      null
  );

  const identityKey = personId
    ? `person:${personId}`
    : personEmail
    ? `email:${personEmail}`
    : '';

  return {
    identityKey,
    personId: personId || undefined,
    personEmail: personEmail || undefined,
  };
}

function isPositiveStatus(status: string | null | undefined) {
  const normalized = normalizeEmail(status);
  return (
    normalized === 'yes' ||
    normalized === 'maybe' ||
    normalized === 'going' ||
    normalized === 'interested'
  );
}

function isQaPlaceholderEvent(event: any) {
  const title = String(event?.title || '').trim();
  const location = String(event?.location || '').trim();

  return (
    /^QA\s+\d{8,}\s+FEED\b/i.test(title) ||
    /^QA\s+Dev\s+Location$/i.test(location)
  );
}

export default function FriendsActivities({
  data,
  theme,
  onRefresh,
  signals = [],
}: FriendsActivitiesProps) {
  const router = useRouter();
  const { language, t } = useI18n();
  const {
    events = [],
    rsvps = [],
    userEmail = '',
    userPersonId = '',
    accessByEventId = {},
  } = data;

  const emailLower = normalizeEmail(userEmail);
  const [dismissedEventIds, setDismissedEventIds] = useState<string[]>([]);

  useEffect(() => {
    const loadDismissed = async () => {
      if (!emailLower) {
        setDismissedEventIds([]);
        return;
      }

      const { data: closedRows, error } = await supabase
        .from('closed_cards')
        .select('event_id')
        .eq('user_email_lc', emailLower);

      if (error) {
        console.error('Failed to load closed activity cards', error);
        setDismissedEventIds([]);
        return;
      }

      setDismissedEventIds(
        (closedRows || [])
          .map((row: any) => String(row.event_id || '').trim())
          .filter(Boolean)
      );
    };

    loadDismissed();
  }, [emailLower]);

  const meIdentity = useMemo(() => {
    const personId = normalizePersonId(userPersonId);
    const personEmail = normalizeEmail(userEmail);

    return {
      identityKey: personId
        ? `person:${personId}`
        : personEmail
        ? `email:${personEmail}`
        : '',
      personId: personId || undefined,
      personEmail: personEmail || undefined,
    };
  }, [userEmail, userPersonId]);

  const activityItems = useMemo(() => {
    if (signals.length > 0) {
      const map = new Map<string, ActivityItem>();

      for (const signal of signals) {
        if (
          signal.type !== 'friend_created_event' &&
          signal.type !== 'friend_attending_event'
        ) {
          continue;
        }

        const event = signal.payload;
        if (!event?.id) continue;
        if (isQaPlaceholderEvent(event)) continue;
        if (accessByEventId[String(event.id)]?.can_see !== true) continue;
        if (dismissedEventIds.includes(String(event.id))) continue;

        const actorIdentity = resolveIdentity({
          person_id: signal.personId,
          personId: signal.personId,
          personEmail: signal.personEmail,
          email_lc: signal.personEmail,
        });

        const dedupeKey = `${signal.type}:${event.id}:${actorIdentity.identityKey || 'unknown'}`;
        if (map.has(dedupeKey)) continue;

        map.set(dedupeKey, {
          key: `activity:${dedupeKey}`,
          signalType: signal.type,
          actorKey: actorIdentity.identityKey || undefined,
          actorPersonId: actorIdentity.personId,
          actorPersonEmail: actorIdentity.personEmail,
          actorName:
            signal.actor_name ||
            signal.actor?.name ||
            signal.actor?.first_name ||
            event.host_name ||
            'Someone',
          event,
        });
      }

      return Array.from(map.values());
    }

    const rsvpsByEventId = new Map<string, any[]>();
    for (const r of rsvps) {
      const eventId = String(r.event_id || '');
      if (!eventId) continue;
      const list = rsvpsByEventId.get(eventId) || [];
      list.push(r);
      rsvpsByEventId.set(eventId, list);
    }

    const items: ActivityItem[] = [];

    for (const ev of events) {
      if (!ev?.id) continue;
      if (isQaPlaceholderEvent(ev)) continue;
      if (accessByEventId[String(ev.id)]?.can_see !== true) continue;
      if (dismissedEventIds.includes(String(ev.id))) continue;

      const hostIdentity = resolveIdentity({
        person_id: ev.host_person_id,
        host_email: ev.host_email,
        email_lc: ev.host_email,
      });

      const isNotHost =
        !hostIdentity.identityKey ||
        hostIdentity.identityKey !== meIdentity.identityKey;

      if (!isNotHost) continue;

      const eventRsvps = rsvpsByEventId.get(String(ev.id)) || [];
      const participantMap = new Map<string, any>();

      for (const r of eventRsvps) {
        const participantIdentity = resolveIdentity(r);
        if (!participantIdentity.identityKey) continue;
        if (participantIdentity.identityKey === meIdentity.identityKey) continue;
        if (!isPositiveStatus(r.status)) continue;

        if (!participantMap.has(participantIdentity.identityKey)) {
          participantMap.set(participantIdentity.identityKey, {
            ...participantIdentity,
            row: r,
          });
        }
      }

      if (participantMap.size === 0) continue;

      const firstParticipant = Array.from(participantMap.values())[0];

      items.push({
        key: `activity:friend_attending_event:${ev.id}:${firstParticipant.identityKey}`,
        signalType: 'friend_attending_event',
        actorKey: firstParticipant.identityKey,
        actorPersonId: firstParticipant.personId,
        actorPersonEmail: firstParticipant.personEmail,
        actorName: firstParticipant.row?.name || ev.host_name || 'Someone',
        event: ev,
      });
    }

    return items;
  }, [signals, events, rsvps, meIdentity.identityKey, dismissedEventIds]);

  if (activityItems.length === 0) return null;

  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollPadding}
      >
        {activityItems.map((item) => (
          <View key={item.key} style={styles.cardWrapper}>
            <ActivityFeedCard
              signalType={item.signalType}
              actorName={item.actorName}
              event={item.event}
              lang={language}
              onPress={() =>
  router.push({
    pathname: '/peek/[id]',
    params: {
      id: String(item.event.id),
      peek_source_signal: item.signalType,
      peek_actor_name: item.actorName || '',
    },
  } as any)
}
              onDismiss={async () => {
                const eventId = String(item.event?.id || '').trim();
                if (!eventId || !emailLower) return;

                const executeDismiss = async () => {
                  setDismissedEventIds((prev) =>
                    prev.includes(eventId) ? prev : [...prev, eventId]
                  );

                  const { error } = await supabase
                    .from('closed_cards')
                    .upsert(
                      {
                        user_email_lc: emailLower,
                        event_id: eventId,
                      },
                      { onConflict: 'user_email_lc,event_id' }
                    );

                  if (error) {
                    console.error('Failed to hide activity card', error);
                    setDismissedEventIds((prev) =>
                      prev.filter((id) => id !== eventId)
                    );
                    Alert.alert(t('common_error'), t('common_hide_card_error'));
                    return;
                  }

                  onRefresh?.();
                };

                Alert.alert(
                  t('common_hide_card_title'),
                  t('common_hide_card_body'),
                  [
                    { text: t('common_cancel'), style: 'cancel' },
                    {
                      text: t('common_hide'),
                      onPress: async () => {
                        await executeDismiss();
                      },
                    },
                  ]
                );
              }}
            />
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginTop: 10 },
  scrollPadding: { paddingLeft: 16, paddingRight: 16 },
  cardWrapper: { width: 284, marginRight: 12 },
});
