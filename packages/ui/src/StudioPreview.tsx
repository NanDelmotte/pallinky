import React, { useMemo } from 'react';
import {
  View,
  StyleSheet,
  Image,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { StyledText } from './BaseComponents';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

interface PreviewProps {
  theme: { bg: string; accent: string; text: string; isDark: boolean };
  fontStyle: { fontFamily: string };
  event: any;
  coverImageUrl: string;
  thanksGifUrl: string;
  activeTab?: 'event' | 'thanks';
  onTabChange?: (tab: 'event' | 'thanks') => void;
}

const SYSTEM = {
  surface: '#FFFFFF',
  border: '#d1d5db',
  borderSoft: '#e5e7eb',
};

export const StudioPreview = (props: PreviewProps) => {
  const {
    theme,
    fontStyle,
    event,
    coverImageUrl,
    thanksGifUrl,
    activeTab = 'event',
    onTabChange,
  } = props;

  const locationText = useMemo(() => {
    if (!event) return '';
    const hasLocationInDesc = event.description?.includes('Location: ');
    return hasLocationInDesc
      ? event.description.split('Location: ')[1]?.trim() || ''
      : event.location || '';
  }, [event]);

  const displayDescription = useMemo(() => {
    if (!event?.description) return '';
    const hasLocationInDesc = event.description.includes('Location: ');
    return hasLocationInDesc
      ? event.description.split('Location: ')[0].trim()
      : event.description;
  }, [event?.description]);

  const formattedDate = useMemo(() => {
    if (!event?.starts_at) return 'Friday, Mar 20';
    return new Date(event.starts_at).toLocaleDateString(undefined, {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
    });
  }, [event?.starts_at]);

  const gifUrl =
    thanksGifUrl ||
    'https://media.giphy.com/media/89x4osEodHEoo/giphy.gif';

  return (
    <View style={styles.wrap}>
      <View style={styles.topTabs}>
        <TouchableOpacity
          style={[styles.topTab, activeTab === 'event' && styles.topTabActive]}
          onPress={() => onTabChange?.('event')}
        >
          <StyledText
            style={[styles.topTabText, activeTab === 'event' && styles.topTabTextActive]}
          >
            RSVP
          </StyledText>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.topTab, activeTab === 'thanks' && styles.topTabActive]}
          onPress={() => onTabChange?.('thanks')}
        >
          <StyledText
            style={[styles.topTabText, activeTab === 'thanks' && styles.topTabTextActive]}
          >
            Thank You
          </StyledText>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.previewArea}
        showsVerticalScrollIndicator={false}
      >
        {activeTab === 'event' ? (
          <View style={[styles.eventScreen, { backgroundColor: theme.bg }]}>
            <View pointerEvents="none" style={styles.previewWatermark}>
              <StyledText style={styles.previewWatermarkText}>PREVIEW</StyledText>
            </View>

            {coverImageUrl ? (
              <View style={styles.previewImageWrap}>
                <Image source={{ uri: coverImageUrl }} style={styles.previewCoverImage} />
              </View>
            ) : null}

            <View style={styles.previewContent}>
              <StyledText style={[styles.previewTitle, { color: theme.text }, fontStyle]}>
                {event?.title || 'Coffee?'}
              </StyledText>

              <StyledText
                style={[styles.previewHost, { color: theme.text, opacity: 0.7 }, fontStyle]}
              >
                Hosted by {event?.host_name || 'Renata'}
              </StyledText>

              <View style={styles.previewInfoBox}>
                <View style={styles.previewInfoRow}>
                  <MaterialCommunityIcons
                    name="calendar-clock"
                    size={18}
                    color={theme.accent}
                  />
                  <StyledText style={[styles.previewInfoText, { color: theme.text }, fontStyle]}>
                    {formattedDate}
                  </StyledText>
                </View>

                {locationText ? (
                  <View style={styles.previewInfoRow}>
                    <Ionicons name="location-outline" size={18} color={theme.accent} />
                    <StyledText
                      style={[
                        styles.previewInfoText,
                        styles.previewLocationText,
                        { color: theme.accent },
                        fontStyle,
                      ]}
                      numberOfLines={1}
                    >
                      {locationText}
                    </StyledText>
                  </View>
                ) : null}

                <View style={styles.previewCalendarRow}>
                  <StyledText style={[styles.previewCalendarText, { color: theme.accent }]}>
                    + Add to Calendar
                  </StyledText>
                </View>
              </View>

              {displayDescription ? (
                <View style={styles.previewDescriptionWrap}>
                  <StyledText
                    style={[
                      styles.previewDescription,
                      { color: theme.text, opacity: 0.9 },
                      fontStyle,
                    ]}
                    numberOfLines={3}
                  >
                    {displayDescription}
                  </StyledText>
                </View>
              ) : null}

              <View style={styles.previewBtnStack}>
                <View style={[styles.previewPrimaryBtn, { backgroundColor: theme.accent }]}>
                  <StyledText
                    style={[
                      styles.previewPrimaryBtnText,
                      { color: theme.isDark ? theme.bg : '#fff' },
                    ]}
                  >
                    I&apos;m Going
                  </StyledText>
                </View>

                <View style={styles.previewTwoColRow}>
                  <View
                    style={[
                      styles.previewSecondaryHalfBtn,
                      {
                        borderColor: theme.accent,
                        backgroundColor: theme.isDark ? 'transparent' : SYSTEM.surface,
                      },
                    ]}
                  >
                    <StyledText style={[styles.previewSecondaryHalfBtnText, { color: theme.accent }]}>
                      Maybe
                    </StyledText>
                  </View>

                  <View
                    style={[
                      styles.previewSecondaryHalfBtn,
                      {
                        borderColor: theme.accent,
                        backgroundColor: theme.isDark ? 'transparent' : SYSTEM.surface,
                      },
                    ]}
                  >
                    <StyledText style={[styles.previewSecondaryHalfBtnText, { color: theme.accent }]}>
                      No
                    </StyledText>
                  </View>
                </View>
              </View>

              <StyledText
                style={[
                  styles.previewGuestTitle,
                  {
                    color: theme.text,
                    borderBottomColor: theme.isDark ? `${theme.accent}40` : SYSTEM.border,
                  },
                  fontStyle,
                ]}
              >
                Guest List
              </StyledText>

              <View style={styles.previewGuestList}>
                {['Amy', 'Leo', 'Sam'].map((name, i) => (
                  <View
                    key={name}
                    style={[
                      styles.previewGuestCard,
                      {
                        backgroundColor: theme.isDark ? 'rgba(255,255,255,0.12)' : SYSTEM.surface,
                        borderColor: theme.isDark ? 'rgba(255,255,255,0.10)' : SYSTEM.borderSoft,
                      },
                    ]}
                  >
                    <StyledText style={[styles.previewGuestStatus, { color: theme.isDark ? '#fff' : theme.text }]}>
                      {i === 0 ? '✓' : i === 1 ? '?' : '✕'}
                    </StyledText>
                    <StyledText
                      style={[
                        styles.previewGuestName,
                        { color: theme.isDark ? '#fff' : theme.text },
                        fontStyle,
                      ]}
                    >
                      {name}
                    </StyledText>
                  </View>
                ))}
              </View>
            </View>
          </View>
        ) : (
          <View style={[styles.thanksScreen, { backgroundColor: theme.bg }]}>
            <View style={[styles.gifContainer, { borderColor: theme.accent }]}>
              <Image source={{ uri: gifUrl }} style={styles.gif} />
            </View>

            <StyledText style={[styles.thanksPageTitle, { color: theme.text }, fontStyle]}>
              You&apos;re on the list!
            </StyledText>

            <StyledText style={[styles.thanksPageSubtitle, { color: theme.text, opacity: 0.7 }, fontStyle]}>
              {event?.host_name || 'Host'} has been notified.
            </StyledText>

            <View
              style={[
                styles.thanksReminderCard,
                {
                  backgroundColor: theme.isDark ? 'rgba(255,255,255,0.12)' : SYSTEM.surface,
                  borderColor: theme.isDark ? 'rgba(255,255,255,0.12)' : SYSTEM.border,
                },
              ]}
            >
              <StyledText style={[styles.thanksReminderTitle, { color: theme.text }, fontStyle]}>
                Don&apos;t forget!
              </StyledText>

              <View
                style={[
                  styles.thanksCalendarBtn,
                  {
                    borderColor: theme.accent,
                    backgroundColor: theme.isDark ? 'transparent' : SYSTEM.surface,
                  },
                ]}
              >
                <Ionicons name="calendar-outline" size={16} color={theme.accent} />
                <StyledText style={[styles.thanksCalendarBtnText, { color: theme.accent }]}>
                  Add to Calendar
                </StyledText>
              </View>
            </View>

            <View style={styles.thanksButtonStack}>
              <View
                style={[
                  styles.thanksPrimaryBtn,
                  { backgroundColor: theme.accent, borderColor: theme.accent },
                ]}
              >
                <StyledText style={[styles.thanksPrimaryBtnText, { color: theme.bg }]}>
                  Open Chat
                </StyledText>
              </View>

              <View style={[styles.thanksSecondaryBtn, { borderColor: theme.accent }]}>
                <StyledText style={[styles.thanksSecondaryBtnText, { color: theme.accent }]}>
                  Back to Details
                </StyledText>
              </View>

              <StyledText style={[styles.thanksHomeLink, { color: theme.text, opacity: 0.6 }]}>
                Go to Home
              </StyledText>
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    backgroundColor: '#f3f4f6',
  },

  topTabs: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingTop: 12,
    gap: 8,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  topTab: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
    backgroundColor: '#ececec',
  },
  topTabActive: {
    backgroundColor: '#e85d7b',
  },
  topTabText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#4b5563',
  },
  topTabTextActive: {
    color: '#fff',
  },

  previewArea: {
    padding: 12,
    paddingBottom: 14,
  },

  eventScreen: {
    borderRadius: 18,
    overflow: 'hidden',
    paddingBottom: 14,
    position: 'relative',
  },
  previewWatermark: {
    position: 'absolute',
    top: 12,
    left: 14,
    right: 14,
    zIndex: 3,
    alignItems: 'center',
  },
  previewWatermarkText: {
    backgroundColor: 'rgba(17,24,39,0.62)',
    color: '#fff',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 3,
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 999,
    overflow: 'hidden',
  },
  previewImageWrap: {
    width: '100%',
    paddingHorizontal: 14,
    paddingTop: 14,
  },
  previewCoverImage: {
    width: '100%',
    height: 118,
    borderRadius: 18,
  },
  previewContent: {
    paddingHorizontal: 18,
    paddingTop: 12,
  },
  previewTitle: {
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: -0.5,
    marginBottom: 2,
  },
  previewHost: {
    fontSize: 14,
    marginBottom: 8,
  },
  previewInfoBox: {
    marginBottom: 8,
  },
  previewInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 7,
  },
  previewInfoText: {
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
  previewLocationText: {
    textDecorationLine: 'underline',
  },
  previewCalendarRow: {
    marginTop: 2,
  },
  previewCalendarText: {
    fontSize: 15,
    fontWeight: '800',
  },
  previewDescriptionWrap: {
    marginBottom: 8,
    paddingHorizontal: 3,
  },
  previewDescription: {
    fontSize: 13,
    lineHeight: 18,
  },
  previewBtnStack: {
    gap: 8,
    marginBottom: 14,
  },
  previewPrimaryBtn: {
    height: 42,
    borderRadius: 13,
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewPrimaryBtnText: {
    fontSize: 15,
    fontWeight: '800',
  },
  previewTwoColRow: {
    flexDirection: 'row',
    gap: 10,
  },
  previewSecondaryHalfBtn: {
    flex: 1,
    height: 38,
    borderRadius: 13,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewSecondaryHalfBtnText: {
    fontSize: 15,
    fontWeight: '700',
  },
  previewGuestTitle: {
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 9,
    paddingBottom: 6,
    borderBottomWidth: 1,
  },
  previewGuestList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  previewGuestCard: {
    flexDirection: 'row',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
  },
  previewGuestStatus: {
    fontSize: 13,
    fontWeight: '900',
    marginRight: 6,
  },
  previewGuestName: {
    fontSize: 14,
    fontWeight: '600',
  },

  thanksScreen: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    paddingVertical: 24,
    borderRadius: 18,
  },
  gifContainer: {
    width: 136,
    height: 136,
    borderRadius: 68,
    borderWidth: 5,
    overflow: 'hidden',
    marginBottom: 16,
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  gif: {
    width: '100%',
    height: '100%',
  },
  thanksPageTitle: {
    fontSize: 24,
    fontWeight: '900',
    textAlign: 'center',
    marginBottom: 8,
    letterSpacing: -0.5,
  },
  thanksPageSubtitle: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 16,
    fontWeight: '500',
  },
  thanksReminderCard: {
    width: '100%',
    padding: 16,
    borderRadius: 22,
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
  },
  thanksReminderTitle: {
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 15,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  thanksCalendarBtn: {
    width: '100%',
    minHeight: 42,
    borderRadius: 15,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  thanksCalendarBtnText: {
    fontSize: 15,
    fontWeight: '800',
  },
  thanksButtonStack: {
    width: '100%',
    alignItems: 'center',
  },
  thanksPrimaryBtn: {
    width: '100%',
    paddingVertical: 12,
    borderRadius: 16,
    borderWidth: 2,
    alignItems: 'center',
    marginBottom: 8,
  },
  thanksPrimaryBtnText: {
    fontSize: 16,
    fontWeight: '800',
  },
  thanksSecondaryBtn: {
    width: '100%',
    paddingVertical: 12,
    borderRadius: 16,
    borderWidth: 2,
    alignItems: 'center',
    backgroundColor: SYSTEM.surface,
  },
  thanksSecondaryBtnText: {
    fontSize: 16,
    fontWeight: '800',
  },
  thanksHomeLink: {
    fontSize: 15,
    fontWeight: '700',
    textDecorationLine: 'underline',
    marginTop: 14,
  },
});