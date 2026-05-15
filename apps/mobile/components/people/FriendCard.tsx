/**
 * Path: apps/mobile/components/people/FriendCard.tsx
 * Description:
 * Expandable relationship card for People sections.
 */

import React, { useMemo, useState } from 'react';
import { View, StyleSheet, Image, Pressable } from 'react-native';
import { StyledText } from '@pallinky/ui';

import { t } from '@pallinky/i18n';
import type { AppLanguage } from '@pallinky/i18n/types';

export type FriendActivity =
  | {
      type: 'shared_event';
      id: string;
      title: string;
      subtitle: string;
      dateLabel: string;
      detail: string;
    }
  | {
      type: 'idea_response';
      id: string;
      title: string;
      subtitle: string;
      dateLabel: string;
      detail: string;
    };

export type FriendCardData = {
  id: string;
  name: string;
  avatarUrl: string | null;
  crossedPathsCount: number;
  lastSeenLabel: string;
  lastSeenAtEventTitle: string;
  sharedEventsCount: number;
  hostedByYouCount: number;
  hostedByThemCount: number;
  wavesCount: number;
  activity: FriendActivity[];
};

function avatarFor(name: string, avatarUrl?: string | null) {
  if (avatarUrl) return avatarUrl;

  return `https://ui-avatars.com/api/?name=${encodeURIComponent(
    name || 'P'
  )}&background=6A4C93&color=fff`;
}

function formatActivityDate(value: string | null | undefined, lang: AppLanguage) {
  if (!value) return t(lang, 'common_tbd');

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return t(lang, 'common_tbd');

  return date.toDateString();
}

function isFutureDate(value: string | null | undefined) {
  if (!value) return false;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;

  return date.getTime() > Date.now();
}

export default function FriendCard({
  friend,
  lang = 'en',
}: {
  friend: FriendCardData;
  lang?: AppLanguage;
}) {
  const [expanded, setExpanded] = useState(false);

  const sharedEvents = useMemo(
    () => friend.activity.filter((item) => item.type === 'shared_event'),
    [friend.activity]
  );

  const ideaResponses = useMemo(
    () => friend.activity.filter((item) => item.type === 'idea_response'),
    [friend.activity]
  );

  const isSecondDegree =
    friend.sharedEventsCount === 0 &&
    friend.crossedPathsCount > 0 &&
    friend.lastSeenAtEventTitle.toLowerCase().includes('know');

  const futureEvent = isFutureDate(friend.lastSeenLabel);

  const summaryText = isSecondDegree
    ? t(lang, 'people_mutual_connections_count', {
        count: String(friend.crossedPathsCount),
      })
    : t(lang, 'people_shared_events_count', {
        count: String(friend.crossedPathsCount),
      });

  const contextLabel = isSecondDegree
    ? friend.lastSeenAtEventTitle
    : futureEvent
      ? t(lang, 'people_going_to_event', {
          event: friend.lastSeenAtEventTitle,
        })
      : t(lang, 'people_last_seen_at_event', {
          event: friend.lastSeenAtEventTitle,
        });

  return (
    <View style={styles.friendCard}>
      <Pressable onPress={() => setExpanded((prev) => !prev)} style={styles.friendCardTop}>
        <Image
          source={{ uri: avatarFor(friend.name, friend.avatarUrl) }}
          style={styles.friendAvatar}
        />

        <View style={styles.friendMainText}>
          <StyledText numberOfLines={1} style={styles.friendName}>
            {friend.name}
          </StyledText>

          <StyledText style={styles.friendSummary}>{summaryText}</StyledText>

          <StyledText numberOfLines={2} style={styles.friendSummarySub}>
            {contextLabel}
          </StyledText>

          {!!friend.lastSeenLabel && (
            <StyledText style={styles.friendSummarySubMuted}>
              {friend.lastSeenLabel}
            </StyledText>
          )}
        </View>

     
      </Pressable>

      {expanded && !isSecondDegree && (
  <View style={styles.expandedContent}>
    <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <StyledText style={styles.statNumber}>{friend.sharedEventsCount}</StyledText>
              <StyledText style={styles.statLabel}>
                {t(lang, 'people_stat_shared_events')}
              </StyledText>
            </View>
{expanded && isSecondDegree && (
  <View style={styles.expandedContent}>
    <View style={styles.activityCard}>
      <StyledText style={styles.emptyText}>
        {t(lang, 'people_second_degree_card_hint')}
      </StyledText>
    </View>
  </View>
)}
            <View style={styles.statItem}>
              <StyledText style={styles.statNumber}>{friend.hostedByYouCount}</StyledText>
              <StyledText style={styles.statLabel}>
                {t(lang, 'people_stat_hosted_by_you')}
              </StyledText>
            </View>

            <View style={styles.statItem}>
              <StyledText style={styles.statNumber}>{friend.hostedByThemCount}</StyledText>
              <StyledText style={styles.statLabel}>
                {t(lang, 'people_stat_hosted_by_them')}
              </StyledText>
            </View>

            <View style={styles.statItem}>
              <StyledText style={styles.statNumber}>{friend.wavesCount}</StyledText>
              <StyledText style={styles.statLabel}>
                {t(lang, 'people_stat_waves')}
              </StyledText>
            </View>
          </View>

          <View style={styles.sectionBlock}>
            <StyledText style={styles.sectionTitle}>
              {t(lang, 'people_shared_events_title')}
            </StyledText>

            {sharedEvents.length === 0 ? (
              <View style={styles.activityCard}>
                <StyledText style={styles.emptyText}>
                  {t(lang, 'people_no_shared_events')}
                </StyledText>
              </View>
            ) : (
              sharedEvents.map((item) => (
                <View key={item.id} style={styles.activityCard}>
                  <StyledText style={styles.activitySubtitle}>{item.title}</StyledText>

                  <StyledText style={styles.activityDate}>
                    {formatActivityDate(item.dateLabel, lang)}
                  </StyledText>

                  {!!item.detail && (
                    <StyledText style={styles.activityDetail}>{item.detail}</StyledText>
                  )}
                </View>
              ))
            )}
          </View>

          <View style={styles.sectionBlock}>
            <StyledText style={styles.sectionTitle}>
              {t(lang, 'people_idea_responses_title')}
            </StyledText>

            {ideaResponses.length === 0 ? (
              <View style={styles.activityCard}>
                <StyledText style={styles.emptyText}>
                  {t(lang, 'people_no_idea_responses')}
                </StyledText>
              </View>
            ) : (
              ideaResponses.map((item) => (
                <View key={item.id} style={styles.activityCard}>
                  <StyledText style={styles.activitySubtitle}>
                    {item.subtitle || item.title}
                  </StyledText>

                  <StyledText style={styles.activityDate}>
                    {formatActivityDate(item.dateLabel, lang)}
                  </StyledText>

                  {!!item.detail && (
                    <StyledText style={styles.activityDetail}>{item.detail}</StyledText>
                  )}
                </View>
              ))
            )}
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  friendCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E4E7EC',
  },
  friendCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  friendAvatar: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: '#DDD',
  },
  friendMainText: {
    flex: 1,
    minWidth: 0,
    paddingRight: 6,
  },
  friendName: {
    fontSize: 17,
    fontWeight: '900',
    color: '#111111',
    marginBottom: 3,
  },
  friendSummary: {
    fontSize: 13,
    fontWeight: '800',
    color: '#43691b',
    marginBottom: 3,
  },
  friendSummarySub: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1f2a1b',
    lineHeight: 19,
  },
  friendSummarySubMuted: {
    fontSize: 12,
    color: '#66715f',
    marginTop: 3,
    fontWeight: '700',
  },
  expandedContent: {
    paddingTop: 18,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 22,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: '#F6F7F9',
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 6,
  },
  statNumber: {
    fontSize: 18,
    fontWeight: '900',
    color: '#111111',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 11,
    lineHeight: 14,
    textAlign: 'center',
    color: '#66715f',
    fontWeight: '800',
  },
  sectionBlock: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#111111',
    marginBottom: 10,
  },
  activityCard: {
    backgroundColor: '#F8F9FB',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#EEF1F4',
    marginBottom: 10,
  },
  activitySubtitle: {
    fontSize: 14,
    color: '#1f2a1b',
    fontWeight: '800',
    marginBottom: 4,
  },
  activityDate: {
    fontSize: 13,
    color: '#66715f',
    fontWeight: '700',
    marginBottom: 4,
  },
  activityDetail: {
    fontSize: 13,
    color: '#4a524b',
    fontWeight: '700',
  },
  emptyText: {
    color: '#66715f',
    fontWeight: '700',
  },
});