/**
 * Path: apps/mobile/components/dashboard/MyPlansList.tsx
 * Description: Horizontal plans list driven by feed signals when available.
 * Falls back to raw data only if signals are not passed.
 * Dedupe by event id so one event cannot render twice from multiple signals.
 * Series-aware:
 * - collapse siblings into one representative card on list surfaces
 * - representative = nearest upcoming sibling, else latest past sibling
 * - only mark Past when all siblings are past
 */

import React, { useEffect, useMemo, useState } from 'react';
import { View, StyleSheet, ScrollView, Alert } from 'react-native';
import { useRouter } from 'expo-router';

import { supabase } from '@pallinky/core';
import { useI18n } from '@pallinky/i18n/client';
import EventFeedCard from '../../../../packages/ui/src/EventFeedCard';

interface MyPlansListProps {
  data: {
    events: any[];
    rsvps: any[];
    chatSummaries?: Record<string, any>;
    userEmail: string;
    contacts?: any[];
    accessByEventId?: Record<string, any>;
  };
  theme: any;
  onRefresh?: () => void;
  signals?: any[];
}

function normalizeEmail(value: string | null | undefined) {
  return (value || '').toLowerCase().trim();
}

function normalizeId(value: unknown) {
  return String(value || '').trim();
}

function seedFromName(name: string | null | undefined, email?: string | null) {
  const source = (name || '').trim() || (email || '').trim() || '?';
  return source.charAt(0).toUpperCase();
}

function getEventMs(event: any) {
  if (!event?.starts_at) return null;
  const ms = new Date(event.starts_at).getTime();
  return Number.isFinite(ms) ? ms : null;
}

function isPositiveRsvpStatus(status: string | null | undefined) {
  const normalized = normalizeEmail(status);
  return ['yes', 'going', 'interested', 'maybe'].includes(normalized);
}

function getSeriesGroupKey(event: any) {
  const seriesId = normalizeId(event?.series_id);
  if (seriesId) return `series:${seriesId}`;
  return `event:${String(event?.id)}`;
}

function pickRepresentativeEvent(events: any[], now: number) {
  const withMs = events.map((ev) => ({ ev, ms: getEventMs(ev) }));

  const upcoming = withMs
    .filter(({ ms }) => ms !== null && ms >= now)
    .sort((a, b) => (a.ms as number) - (b.ms as number));

  if (upcoming.length > 0) {
    return upcoming[0].ev;
  }

  const past = withMs
    .filter(({ ms }) => ms !== null && ms < now)
    .sort((a, b) => (b.ms as number) - (a.ms as number));

  if (past.length > 0) {
    return past[0].ev;
  }

  const undated = events.filter((ev) => !ev?.starts_at);
  return undated[0] || events[0] || null;
}

export default function MyPlansList({
  data,
  theme,
  onRefresh,
  signals = [],
}: MyPlansListProps) {
  const router = useRouter();
  const { language, t } = useI18n();
  const {
    events = [],
    rsvps = [],
    chatSummaries = {},
    userEmail = '',
    contacts = [],
    accessByEventId = {},
  } = data;

  const emailLower = userEmail.toLowerCase().trim();
  const [avatarByEmail, setAvatarByEmail] = useState<Record<string, string>>({});
  const [dismissedKeys, setDismissedKeys] = useState<string[]>([]);

useEffect(() => {
  const loadDismissed = async () => {
    if (!emailLower) {
      setDismissedKeys([]);
      return;
    }

    const { data, error } = await supabase
      .from('closed_cards')
      .select('event_id')
      .eq('user_email_lc', emailLower);

    if (error) {
      console.error('Failed to load closed cards', error);
      setDismissedKeys([]);
      return;
    }

    const keys = (data || []).map((row: any) => `event:${row.event_id}`);
    setDismissedKeys(keys);
  };

  loadDismissed();
}, [emailLower]);

  const signalPlans =
    signals.length > 0
      ? signals
          .filter(
            (s) =>
              (s.type === 'upcoming_plan' || s.type === 'event_starting_soon') &&
              accessByEventId[String(s?.payload?.id)]?.can_see === true
          )
          .map((s) => s.payload)
          .filter(Boolean)
      : [];

  const fallbackPlans =
    signals.length === 0
      ? events.filter((ev) => {
          if (accessByEventId[String(ev?.id)]?.can_see !== true) return false;
          const isHost = normalizeEmail(ev.host_email) === emailLower;
          const hasJoined = rsvps.some(
            (r) =>
              String(r.event_id) === String(ev.id) &&
              normalizeEmail(r.email_lc || r.email) === emailLower &&
              isPositiveRsvpStatus(r.status)
          );
          return isHost || hasJoined;
        })
      : [];

  const rawPlans = (signals.length > 0 ? signalPlans : fallbackPlans).filter(
  (ev) => normalizeEmail(ev?.status) !== 'cancelled'
);

  const myPlans = useMemo(() => {
    const now = Date.now();

    const deduped = Array.from(
      new Map(
        rawPlans
          .filter(
  (ev) =>
    ev?.id &&
    normalizeEmail(ev?.status) !== 'cancelled' &&
    accessByEventId[String(ev.id)]?.can_see === true &&
    !dismissedKeys.includes(`event:${ev.id}`)
)
          .map((ev) => [String(ev.id), ev])
      ).values()
    );

    const grouped = new Map<
      string,
      {
        key: string;
        seriesId: string | null;
        siblings: any[];
        representative: any;
        representativeMs: number | null;
        isSeries: boolean;
        isPast: boolean;
      }
    >();

    for (const ev of deduped) {
      const groupKey = getSeriesGroupKey(ev);
      const seriesId = normalizeId(ev?.series_id) || null;
      const existing = grouped.get(groupKey);

      if (existing) {
        existing.siblings.push(ev);
      } else {
        grouped.set(groupKey, {
          key: groupKey,
          seriesId,
          siblings: [ev],
          representative: ev,
          representativeMs: getEventMs(ev),
          isSeries: !!seriesId,
          isPast: false,
        });
      }
    }

    const collapsed = Array.from(grouped.values()).map((group) => {
      const representative = pickRepresentativeEvent(group.siblings, now);
      const siblingMs = group.siblings
        .map((ev) => getEventMs(ev))
        .filter((ms): ms is number => ms !== null);

      const hasUpcomingSibling = siblingMs.some((ms) => ms >= now);
      const allSiblingsPast =
        siblingMs.length > 0 && siblingMs.every((ms) => ms < now);

      return {
        ...group,
        representative,
        representativeMs: getEventMs(representative),
        isPast: !hasUpcomingSibling && allSiblingsPast,
      };
    });

    return collapsed.sort((a, b) => {
      const aHasDate = a.representativeMs !== null;
      const bHasDate = b.representativeMs !== null;

      if (!aHasDate && !bHasDate) return 0;
      if (!aHasDate) return -1;
      if (!bHasDate) return 1;

      return (b.representativeMs as number) - (a.representativeMs as number);
    });
  }, [rawPlans, dismissedKeys]);

  useEffect(() => {
    const loadAvatars = async () => {
      const emailSet = new Set<string>();

      myPlans.forEach((group) => {
        const ev = group.representative;
        const siblingIds = new Set(group.siblings.map((s: any) => String(s.id)));
        const hostEmail = normalizeEmail(ev.host_email);

        if (hostEmail) emailSet.add(hostEmail);

        rsvps.forEach((r) => {
          if (!siblingIds.has(String(r.event_id))) return;

          const status = normalizeEmail(r.status);
          const email = normalizeEmail(r.email_lc || r.email);

          if (
            email &&
            email !== hostEmail &&
            ['yes', 'going', 'interested', 'maybe'].includes(status)
          ) {
            emailSet.add(email);
          }
        });
      });

      const contactAvatarByEmail = Object.fromEntries(
        (contacts || [])
          .filter((c: any) => normalizeEmail(c.email_lc || c.email))
          .map((c: any) => [
            normalizeEmail(c.email_lc || c.email),
            c.avatar_url || '',
          ])
      );

      const profileEmails = Array.from(emailSet).filter(
        (email) => !contactAvatarByEmail[email]
      );

      let profileAvatarByEmail: Record<string, string> = {};

      if (profileEmails.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('email_lc, avatar_url')
          .in('email_lc', profileEmails);

        profileAvatarByEmail = Object.fromEntries(
          (profiles || [])
            .filter((p: any) => normalizeEmail(p.email_lc) && p.avatar_url)
            .map((p: any) => [normalizeEmail(p.email_lc), p.avatar_url])
        );
      }

      const nextAvatarByEmail = {
        ...contactAvatarByEmail,
        ...profileAvatarByEmail,
      };

      setAvatarByEmail((prev) => {
        const prevKeys = Object.keys(prev);
        const nextKeys = Object.keys(nextAvatarByEmail);

        if (prevKeys.length !== nextKeys.length) return nextAvatarByEmail;
        for (const key of nextKeys) {
          if (prev[key] !== nextAvatarByEmail[key]) return nextAvatarByEmail;
        }
        return prev;
      });
    };

    loadAvatars();
  }, [myPlans, rsvps, contacts]);

  if (myPlans.length === 0) return null;

  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollPadding}
      >
        {myPlans.map((group) => {
          const ev = group.representative;
          const siblingIds = new Set(group.siblings.map((s: any) => String(s.id)));
          const isHost = normalizeEmail(ev.host_email) === emailLower;
          const hostEmail = normalizeEmail(ev.host_email);

          const aggregateUnread = group.siblings.reduce((sum: number, sibling: any) => {
            const chat = chatSummaries[sibling.id] || null;
            return sum + Number(chat?.unread_count || 0);
          }, 0);

          const participantMap = new Map<
            string,
            { seed: string; avatarUrl?: string | null }
          >();

          rsvps.forEach((r) => {
            if (!siblingIds.has(String(r.event_id))) return;

            const status = normalizeEmail(r.status);
            const email = normalizeEmail(r.email_lc || r.email);

            if (
              !email ||
              email === hostEmail ||
              !['yes', 'going', 'interested', 'maybe'].includes(status) ||
              participantMap.has(email)
            ) {
              return;
            }

            participantMap.set(email, {
              seed: seedFromName(r.name, r.email_lc || r.email),
              avatarUrl: avatarByEmail[email] || null,
            });
          });

          const participantAvatars = Array.from(participantMap.values());

const viewerRsvp = rsvps.find((r) => {
  if (!siblingIds.has(String(r.event_id))) return false;
  return normalizeEmail(r.email_lc || r.email) === emailLower;
});

const viewerHasJoined = isPositiveRsvpStatus(viewerRsvp?.status);

const cardStatus = group.isPast
  ? 'past'
  : isHost
    ? 'host'
    : 'guest';

return (
            <View key={`my-plan-wrapper-${group.key}`} style={styles.cardWrapper}>
              <EventFeedCard
                id={ev.id}
                currentUserEmail={emailLower}
                hostEmail={ev.host_email}
                hostAvatarUrl={avatarByEmail[hostEmail] || null}
                title={ev.title}
                startsAt={ev.starts_at}
                eventTimeZone={ev.event_time_zone}
                location={ev.location}
                coverImageUrl={ev.cover_image_url || null}
                gifKey={ev.gif_key}
                fontFamily={ev.font_family}
                hostName={ev.host_name}
                status={cardStatus as any}
                actionLabel={isHost ? t('common_manage') : t('common_view_event')}
                unreadMessages={aggregateUnread}
                lastMessagePreview={null}
                participantAvatars={participantAvatars}
                participantCount={participantAvatars.length}
                isSeries={group.isSeries}
                lang={language}
                onPress={() => router.push(`/event/${ev.slug}/details` as any)}
                onDismiss={async () => {
  const key = `event:${ev.id}`;

  const executeDismiss = async () => {
    setDismissedKeys((prev) =>
      prev.includes(key) ? prev : [...prev, key]
    );

    const { error } = await supabase
      .from('closed_cards')
      .upsert(
        {
          user_email_lc: emailLower,
          event_id: ev.id,
        },
        { onConflict: 'user_email_lc,event_id' }
      );

    if (error) {
      console.error('Failed to hide card', error);
      setDismissedKeys((prev) => prev.filter((item) => item !== key));
      Alert.alert(t('common_error'), t('common_hide_card_error'));
    }
  };

  Alert.alert(
    t('common_hide_card_title'),
    t('common_hide_card_body'),
    [
      {
        text: t('common_cancel'),
        style: 'cancel',
      },
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
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginTop: 6 },
  scrollPadding: { paddingRight: 16, paddingLeft: 16 },
  cardWrapper: { width: 344, marginRight: 12 },
});