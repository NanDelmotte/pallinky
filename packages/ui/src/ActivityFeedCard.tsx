import React from 'react';
import { View, StyleSheet, Pressable, ImageBackground } from 'react-native';
import { StyledText } from './BaseComponents';
import { Ionicons } from '@expo/vector-icons';
import { t } from '@pallinky/i18n';
import type { AppLanguage } from '@pallinky/i18n/types';

export interface ActivityFeedCardProps {
  signalType: 'friend_created_event' | 'friend_attending_event';
  event: any;
  actorName?: string;
  onPress?: () => void;
  onDismiss?: () => void;
  lang?: AppLanguage;
}

const COLORS = {
  text: '#ffffff',
  textMuted: 'rgba(255,255,255,0.86)',
  primary: '#43691b',
  secondary: '#6A4C93',
};

const FALLBACK_IMAGE =
  'https://images.unsplash.com/photo-1493246318656-5bbd4afb293c?q=80&w=1000&auto=format&fit=crop';

function getAccent(signalType: ActivityFeedCardProps['signalType']) {
  return signalType === 'friend_created_event'
    ? COLORS.secondary
    : COLORS.primary;
}

function getChipLabel(signalType: ActivityFeedCardProps['signalType'], lang: AppLanguage) {
  return signalType === 'friend_created_event'
    ? t(lang, 'activity_card_badge_idea')
    : t(lang, 'activity_card_badge_activity');
}

function getSentence(
  signalType: ActivityFeedCardProps['signalType'],
  lang: AppLanguage,
  actorName?: string
) {
  const name = actorName || t(lang, 'activity_card_someone');
  return signalType === 'friend_created_event'
    ? t(lang, 'activity_card_started_this', { name })
    : t(lang, 'activity_card_is_going', { name });
}

const ActivityFeedCard = ({
  signalType,
  event,
  actorName,
  onPress,
  onDismiss,
  lang = 'en',
}: ActivityFeedCardProps) => {
  const accent = getAccent(signalType);

  const imageSource = event?.cover_image_url
    ? { uri: event.cover_image_url }
    : { uri: FALLBACK_IMAGE };

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
          <View style={[styles.badge, { backgroundColor: accent }]}>
            <StyledText style={styles.badgeText}>
              {getChipLabel(signalType, lang)}
            </StyledText>
          </View>

          {onDismiss ? (
            <Pressable
              onPress={(e) => {
                e.stopPropagation();
                onDismiss?.();
              }}
              hitSlop={10}
              style={styles.dismissButton}
            >
              <Ionicons name="close" size={16} color="#fff" />
            </Pressable>
          ) : null}
        </View>

        <View style={styles.content}>
          <StyledText style={styles.titleText} numberOfLines={2}>
            {event?.title || t(lang, 'activity_card_untitled_event')}
          </StyledText>

          <StyledText style={styles.subtitleText} numberOfLines={1}>
            {getSentence(signalType, lang, actorName)}
          </StyledText>

          {!!event?.location && (
            <View style={styles.metaRow}>
              <Ionicons name="location-outline" size={13} color={COLORS.textMuted} />
              <StyledText style={styles.metaText} numberOfLines={1}>
                {event.location}
              </StyledText>
            </View>
          )}

          <View style={styles.footerRow}>
            <View style={styles.peopleHint}>
              <Ionicons name="sparkles-outline" size={14} color="#fff" />
              <StyledText style={styles.peopleHintText}>{t(lang, 'activity_card_peekable')}</StyledText>
            </View>

            <View style={styles.ctaButton}>
              <StyledText style={styles.ctaText}>{t(lang, 'activity_card_peek')}</StyledText>
              <Ionicons name="chevron-forward" size={14} color="#fff" />
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
    opacity: 0.96,
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
    backgroundColor: 'rgba(0,0,0,0.38)',
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 12,
    alignItems: 'center',
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 20,
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
    lineHeight: 22,
    fontWeight: '800',
    color: COLORS.text,
  },
  subtitleText: {
    marginTop: 4,
    fontSize: 13,
    color: COLORS.textMuted,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  metaText: {
    marginLeft: 6,
    fontSize: 12,
    color: COLORS.textMuted,
    flexShrink: 1,
  },
  footerRow: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  peopleHint: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  peopleHintText: {
    marginLeft: 6,
    fontSize: 12,
    fontWeight: '700',
    color: '#fff',
  },
  ctaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(71,85,105,0.8)',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    gap: 4,
  },
  ctaText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
});

export default ActivityFeedCard;