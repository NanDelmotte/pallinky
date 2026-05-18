import React from 'react';
import {
  View,
  ImageBackground,
  StyleSheet,
  Pressable,
  Platform,
  Image,
} from 'react-native';
import { StyledText } from './BaseComponents';
import { Ionicons } from '@expo/vector-icons';
import { t } from '@pallinky/i18n';
import type { AppLanguage } from '@pallinky/i18n/types';

const PALETTES: Record<
  string,
  { bg: string; accent: string; text: string; isDark: boolean }
> = {
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

type ParticipantAvatar = {
  seed: string;
  avatarUrl?: string | null;
};

export interface EventFeedCardProps {
  id: string;
  eventType?: string | null;
  title: string;
  startsAt: string;
  endsAt?: string | null;
  eventTimeZone?: string | null;
  location?: string | null;
  coverImageUrl?: string | null;
  gifKey?: string | null;
  fontFamily?: string | null;
  hostName: string;
  hostEmail?: string;
  hostAvatarUrl?: string | null;
  currentUserEmail: string;
  status?: string;
  actionLabel?: string;
  unreadMessages?: number;
  lastMessagePreview?: string | null;
  participantAvatars?: ParticipantAvatar[];
  participantSeeds?: string[];
  participantCount?: number;
  isSeries?: boolean;
  lang?: AppLanguage;
  onPress?: () => void;
  onDismiss?: () => void;
}

function formatDateTime(
  startsAt: string,
  lang: AppLanguage,
  eventTimeZone?: string | null,
  endsAt?: string | null
) {
  if (!startsAt) return t(lang, 'event_card_date_tbd');

  const date = new Date(startsAt);
  const timeZone = eventTimeZone || undefined;
  const locale = lang === 'fr' ? 'fr-FR' : lang === 'nl' ? 'nl-NL' : 'en-US';

  const weekday = date.toLocaleDateString(locale, {
    weekday: 'short',
    ...(timeZone ? { timeZone } : {}),
  });

  const month = date.toLocaleDateString(locale, {
    month: 'short',
    ...(timeZone ? { timeZone } : {}),
  });

  const dayPart = new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    ...(timeZone ? { timeZone } : {}),
  })
    .formatToParts(date)
    .find((part) => part.type === 'day')?.value;

  const time = date.toLocaleTimeString(locale, {
    hour: 'numeric',
    minute: '2-digit',
    ...(timeZone ? { timeZone } : {}),
  });

  let timeRange = time;
  if (endsAt) {
    const endDate = new Date(endsAt);
    if (!Number.isNaN(endDate.getTime())) {
      const endTime = endDate.toLocaleTimeString(locale, {
        hour: 'numeric',
        minute: '2-digit',
        ...(timeZone ? { timeZone } : {}),
      });
      timeRange = `${time}–${endTime}`;
    }
  }

  return `${weekday}. ${month} ${dayPart || date.getDate()} ${timeRange}`;
}

const EventFeedCard = ({
  eventType,
  title,
  startsAt,
  endsAt,
  eventTimeZone,
  location,
  coverImageUrl,
  gifKey,
  fontFamily,
  hostName,
  hostEmail,
  hostAvatarUrl,
  currentUserEmail,
  status,
  actionLabel,
  unreadMessages,
  participantAvatars = [],
  participantSeeds = [],
  participantCount = 0,
  isSeries = false,
  lang = 'en',
  onPress,
  onDismiss,
}: EventFeedCardProps) => {
  const theme =
    gifKey && PALETTES[gifKey] ? PALETTES[gifKey] : PALETTES.classy;

  const customFont = {
    fontFamily: FONT_MAP[fontFamily || 'Sans'] || 'System',
  };

  const imageSource = coverImageUrl
    ? { uri: coverImageUrl }
    : { uri: `https://loremflickr.com/600/400/${gifKey || 'party'}` };

  const normalizedCurrentUser = currentUserEmail?.toLowerCase().trim();
  const normalizedHost = hostEmail?.toLowerCase().trim();
  const isHost = normalizedCurrentUser === normalizedHost;

  const primaryActionLabel =
  actionLabel || (isHost ? t(lang, 'common_manage') : t(lang, 'common_view_event'));

  const isReachOut = eventType === 'reach_out';

const normalizedStatus = status?.toLowerCase();

const baseBadgeLabel =
  normalizedStatus === 'past'
    ? t(lang, 'event_card_badge_past')
    : normalizedStatus === 'host'
    ? isReachOut
      ? t(lang, 'event_card_badge_planning')
      : t(lang, 'event_card_badge_planned')
    : normalizedStatus === 'pending'
    ? t(lang, 'event_card_badge_pending')
    : normalizedStatus === 'guest'
    ? isReachOut
      ? t(lang, 'event_card_badge_planning')
      : t(lang, 'event_card_badge_joined')
    : normalizedStatus === 'network'
    ? t(lang, 'event_card_badge_invited')
    : t(lang, 'event_card_badge_plan');

  const normalizedParticipants: ParticipantAvatar[] =
    participantAvatars.length > 0
      ? participantAvatars
      : participantSeeds.map((seed) => ({ seed }));

  const visibleParticipantAvatars = normalizedParticipants.slice(0, 4);
  const resolvedParticipantCount =
    participantCount > 0 ? participantCount : normalizedParticipants.length;
  const extraParticipants =
    resolvedParticipantCount > visibleParticipantAvatars.length
      ? resolvedParticipantCount - visibleParticipantAvatars.length
      : 0;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.shadowWrap, pressed && styles.pressed]}
    >
      <ImageBackground
        source={imageSource}
        style={styles.card}
        imageStyle={styles.image}
      >
        <View style={styles.overlay} />

        <View style={styles.topRow}>
          <View style={styles.badgeRow}>
            <View
              style={[
                styles.badge,
                status?.toLowerCase() === 'host' && { backgroundColor: '#6A4C93' },
              ]}
            >
              <StyledText style={styles.badgeText}>{baseBadgeLabel}</StyledText>
            </View>

            {isSeries && (
              <View style={[styles.badge, styles.seriesBadge]}>
                <StyledText style={styles.badgeText}>
  {t(lang, 'event_card_badge_series')}
</StyledText>
              </View>
            )}
          </View>

          {onDismiss && (
            <Pressable
              onPress={(e) => {
                e.stopPropagation();
                onDismiss?.();
              }}
              style={styles.dismissButton}
              key="dismiss"
            >
              <Ionicons name="close" size={16} color="#fff" />
            </Pressable>
          )}
        </View>

        <View style={styles.content}>
          <StyledText
            style={[styles.titleText, { color: '#fff' }, customFont]}
            numberOfLines={1}
          >
            {title}
          </StyledText>

          <View style={styles.hostRow}>
            {hostAvatarUrl ? (
              <Image source={{ uri: hostAvatarUrl }} style={styles.hostAvatarImage} />
            ) : (
              <View style={styles.hostAvatar}>
                <StyledText style={styles.hostAvatarText}>
                  {(hostName || '?').trim().charAt(0).toUpperCase()}
                </StyledText>
              </View>
            )}

            <StyledText style={styles.hostText} numberOfLines={1}>
              {normalizedStatus === 'past'
  ? isHost
    ? t(lang, 'event_card_you_organized')
    : t(lang, 'event_card_host_organized', { host: hostName })
  : isHost
  ? t(lang, 'event_card_you_are_organizing')
  : t(lang, 'event_card_host_is_organizing', { host: hostName })}
            </StyledText>
          </View>

          {visibleParticipantAvatars.length > 0 && (
            <View style={styles.avatarStackRow}>
              <View style={styles.avatarStack}>
                {visibleParticipantAvatars.map((participant, index) =>
                  participant.avatarUrl ? (
                    <Image
                      key={`${participant.seed}-${index}`}
                      source={{ uri: participant.avatarUrl }}
                      style={[
                        styles.stackAvatarImage,
                        { marginLeft: index === 0 ? 0 : -10 },
                      ]}
                    />
                  ) : (
                    <View
                      key={`${participant.seed}-${index}`}
                      style={[
                        styles.stackAvatar,
                        { marginLeft: index === 0 ? 0 : -10 },
                      ]}
                    >
                      <StyledText style={styles.stackAvatarText}>
                        {participant.seed}
                      </StyledText>
                    </View>
                  )
                )}

                {extraParticipants > 0 && (
                  <View
                    style={[
                      styles.stackAvatar,
                      styles.countAvatar,
                      { marginLeft: visibleParticipantAvatars.length === 0 ? 0 : -10 },
                    ]}
                  >
                    <StyledText style={[styles.stackAvatarText, styles.countAvatarText]}>
                      +{extraParticipants}
                    </StyledText>
                  </View>
                )}
              </View>
            </View>
          )}

          <View style={styles.footer}>
            <View style={styles.metaBlock}>
              <View style={styles.metaRow}>
                <StyledText style={styles.metaText}>
                  {formatDateTime(startsAt, lang, eventTimeZone, endsAt)}
                </StyledText>
              </View>

              {!!location && (
                <View style={styles.metaRow}>
                  <StyledText style={styles.metaText} numberOfLines={1}>
                    {location}
                  </StyledText>
                </View>
              )}
            </View>

            <View style={styles.footerRight}>
              {(unreadMessages ?? 0) > 0 && (
                <View style={styles.chatBadge}>
                  <StyledText style={styles.chatBadgeText}>
                    {unreadMessages}
                  </StyledText>
                </View>
              )}

              <View style={styles.cta}>
                <StyledText style={styles.ctaText}>{primaryActionLabel}</StyledText>
                <Ionicons name="chevron-forward" size={14} color="#fff" />
              </View>
            </View>
          </View>
        </View>
      </ImageBackground>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  shadowWrap: {
    width: '100%',
    borderRadius: 18,
    overflow: 'hidden',
  },
  pressed: {
    opacity: 0.95,
  },
  card: {
    height: 198,
    borderRadius: 18,
    justifyContent: 'space-between',
  },
  image: {
    borderRadius: 18,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 12,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  badge: {
    backgroundColor: '#43691b',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 20,
  },
  seriesBadge: {
    backgroundColor: 'rgba(255,255,255,0.22)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  badgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '800',
  },
  dismissButton: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(0,0,0,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    paddingHorizontal: 14,
    paddingBottom: 12,
  },
  titleText: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 4,
  },
  hostRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  hostAvatar: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(255,255,255,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  hostAvatarImage: {
    width: 26,
    height: 26,
    borderRadius: 13,
    marginRight: 8,
    backgroundColor: 'rgba(255,255,255,0.92)',
  },
  hostAvatarText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0f172a',
  },
  stackAvatarImage: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.95)',
    backgroundColor: '#ffffff',
  },
  hostText: {
    color: '#fff',
    fontSize: 13,
    opacity: 0.92,
    flex: 1,
  },
  avatarStackRow: {
    marginTop: 6,
    marginBottom: 6,
  },
  avatarStack: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stackAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.95)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stackAvatarText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#0f172a',
  },
  countAvatar: {
    width: 30,
    backgroundColor: 'rgba(71,85,105,0.92)',
  },
  countAvatarText: {
    color: '#fff',
    fontSize: 10,
  },
  footer: {
    marginTop: 2,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  metaBlock: {
    flex: 1,
    paddingRight: 10,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  metaText: {
    color: '#fff',
    fontSize: 12,
    marginLeft: 6,
    flexShrink: 1,
  },
  footerRight: {
    alignItems: 'flex-end',
  },
  chatBadge: {
    backgroundColor: '#ef4444',
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
    marginBottom: 6,
  },
  chatBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '800',
  },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(71,85,105,0.8)',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    gap: 4,
  },
  ctaText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
});

export default EventFeedCard;