/**
 * Path: src/app/peek/[id].tsx
 * Description: Peek Page.
 * Bridge surface only:
 * - explains why the viewer is seeing the event
 * - shows event snapshot + social proof
 * - routes into canonical event details / RSVP flow
 * - optional lightweight network intent via social_intent
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Switch,
  StatusBar,
  Share,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StyledText } from '@pallinky/ui';
import { Ionicons } from '@expo/vector-icons';
import { supabase, useSession } from '@pallinky/core';
import * as SecureStore from 'expo-secure-store';
import { goBackOrReplace } from '../../lib/navigation';
import { getEventAccessDecision } from '../../lib/visibility/getEventAccessDecision';
import { useI18n } from '@pallinky/i18n/client';

const SYSTEM = {
  bg: '#EEF2EC',
  surface: '#F8FAF7',
  text: '#162014',
  textMuted: '#556250',
  primary: '#355a16',
  secondary: '#5E3F86',
  secondaryBg: '#E8DEF1',
  border: '#A8B997',
  borderSoft: '#C9D5BE',
};

function normalizeEmail(value: string | null | undefined) {
  return value?.toLowerCase().trim() || '';
}

function capitalize(str: string) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function formatStatus(status: string | null | undefined, t: any) {
  const v = String(status || '').toLowerCase().trim();
  if (!v) return t('event_status_responded');
  if (v === 'yes' || v === 'going') return t('event_status_going');
  if (v === 'maybe' || v === 'interested') return t('event_interested');
  if (v === 'no' || v === 'declined' || v === 'not_going') return t('event_status_not_going');
  return capitalize(v);
}

function localeForLanguage(language: string) {
  return language === 'fr' ? 'fr-FR' : language === 'nl' ? 'nl-NL' : 'en-US';
}

function formatDateTime(value: string | null | undefined, language: string, t: any) {
  if (!value) return t('event_card_date_tbd');
  const d = new Date(value);
  return d.toLocaleDateString(localeForLanguage(language), {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getDescriptionText(event: any) {
  const raw = String(event?.description || '').trim();
  if (!raw) return '';
  if (raw.includes('Location: ')) {
    return raw.split('Location: ')[0].trim();
  }
  return raw;
}

function getLocationText(event: any) {
  const raw = String(event?.description || '').trim();
  if (raw.includes('Location: ')) {
    return raw.split('Location: ')[1].trim();
  }
  return String(event?.location || '').trim();
}

export default function PeekPage() {
  const { id, peek_source_signal, peek_actor_name } = useLocalSearchParams<{
  id: string;
  peek_source_signal?: string;
  peek_actor_name?: string;
}>();
  const router = useRouter();
  const { language, t } = useI18n();
  const { userEmail: sessionEmail } = useSession();

  const [event, setEvent] = useState<any>(null);
  const [attendees, setAttendees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [userEmail, setUserEmail] = useState('');
  const [isPastEvent, setIsPastEvent] = useState(false);
  const [keepInLoop, setKeepInLoop] = useState(false);
  const [accessDecision, setAccessDecision] = useState<any>(null);
  const [blocked, setBlocked] = useState(false);

  useEffect(() => {
    if (id) void initPeek();
  }, [id, sessionEmail]);

  async function initPeek() {
    const rememberedGuestEmail = normalizeEmail(
      await SecureStore.getItemAsync('pallinky_guest_email')
    );
    const cleanEmail = normalizeEmail(sessionEmail) || rememberedGuestEmail || '';
    setUserEmail(cleanEmail);

    try {
      const { data: eventData, error: eventError } = await supabase
        .from('events')
        .select('*')
        .eq('id', id)
        .single();

      if (eventError || !eventData) return;

      const decision = await getEventAccessDecision({
        eventId: String(eventData.id),
        viewerEmail: cleanEmail || null,
      });

      setAccessDecision(decision);
      setEvent(eventData);
      setIsPastEvent(
        eventData.starts_at ? new Date(eventData.starts_at).getTime() < Date.now() : false
      );

      if (decision.can_see !== true) {
        setBlocked(true);
        setAttendees([]);
        setKeepInLoop(false);
        return;
      }

      setBlocked(false);

      if (decision.can_see_guest_list === true) {
        await fetchGuestList(eventData.slug, cleanEmail);
      } else {
        setAttendees([]);
      }

      if (cleanEmail) {
        const { data: intent } = await supabase
          .from('social_intent')
          .select('keep_in_loop')
          .eq('event_id', id)
          .eq('user_email', cleanEmail)
          .maybeSingle();

        setKeepInLoop(!!intent?.keep_in_loop);
      } else {
        setKeepInLoop(false);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function fetchGuestList(slug: string, viewerEmail: string) {
    const { data, error } = await supabase.rpc('get_guest_list', {
      p_slug: slug,
      p_viewer_email: viewerEmail || null,
    });

    if (!error) setAttendees(data || []);
  }

  const handleToggleLoop = async (value: boolean) => {
    const cleanEmail = normalizeEmail(userEmail);

    if (!cleanEmail) {
      setKeepInLoop(false);
      return;
    }

    setKeepInLoop(value);

    await supabase.from('social_intent').upsert(
      {
        event_id: id,
        user_email: cleanEmail,
        keep_in_loop: value,
      },
      { onConflict: 'event_id,user_email' }
    );
  };

  const relationshipTitle = useMemo(() => {
    if (!accessDecision) return t('peek_open_friends');

    if (accessDecision.requires_host_approval === true) {
      return t('peek_open_friends_approval');
    }

    if (accessDecision.reason === 'public_event') {
      return t('peek_open_event');
    }

    return t('peek_open_friends');
  }, [accessDecision, t]);

  const relationshipBody = useMemo(() => {
  const hostName = capitalize(event?.host_name || 'the host');
  const actorName = String(peek_actor_name || '').trim();

  // Direct relationship (host is your connection)
  if (peek_source_signal === 'friend_created_event') {
    return t('peek_reason_friend_created', { host: hostName });
  }

  // Friend attending → bridge person
  if (peek_source_signal === 'friend_attending_event' && actorName) {
    return t('peek_reason_friend_attending', { host: hostName, actor: actorName });
  }

  // Fully open event (no network link)
  if (accessDecision?.visibility === 3 && !accessDecision?.is_network_qualified) {
    return t('peek_reason_public', { host: hostName });
  }

  // Network fallback
  if (accessDecision?.is_network_qualified) {
    return t('peek_reason_network', { host: hostName });
  }

  return t('peek_reason_visible');
}, [peek_source_signal, peek_actor_name, accessDecision, event, t]);

  const hostName = capitalize(event?.host_name || 'the host');
  const description = getDescriptionText(event);
  const locationText = getLocationText(event);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={SYSTEM.primary} />
      </View>
    );
  }

  if (blocked || !event) {
    return (
      <View style={styles.centered}>
        <StyledText style={styles.emptyTitle}>{t('peek_unavailable')}</StyledText>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      <View style={styles.header}>
        <TouchableOpacity style={styles.closeBtn} onPress={() => goBackOrReplace(router, '/(tabs)')}>
          <Ionicons name="close-circle" size={32} color={SYSTEM.secondary} />
        </TouchableOpacity>

        <StyledText style={styles.peekLabel}>
          {isPastEvent ? t('peek_you_came_across') : t('peek_label')}
        </StyledText>
        <StyledText style={styles.title}>{event?.title}</StyledText>
        <StyledText style={styles.host}>{t('peek_hosted_by', { host: hostName })}</StyledText>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.contextCard}>
          <View style={styles.contextBadge}>
            <Ionicons name="people-circle-outline" size={16} color={SYSTEM.secondary} />
            <StyledText style={styles.contextBadgeText}>{relationshipTitle}</StyledText>
          </View>

          <StyledText style={styles.contextBody}>{relationshipBody}</StyledText>
        </View>

        <View style={styles.snapshotCard}>
          <StyledText style={styles.sectionTitle}>{t('peek_event')}</StyledText>

          <View style={styles.metaRow}>
            <Ionicons name="calendar-outline" size={16} color={SYSTEM.primary} />
            <StyledText style={styles.metaText}>{formatDateTime(event?.starts_at, language, t)}</StyledText>
          </View>

          {locationText ? (
            <View style={styles.metaRow}>
              <Ionicons name="location-outline" size={16} color={SYSTEM.primary} />
              <StyledText style={styles.metaText}>{locationText}</StyledText>
            </View>
          ) : null}

          {description ? (
            <StyledText style={styles.descriptionText}>{description}</StyledText>
          ) : null}

          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={() => router.push(`/event/${event.slug}` as any)}
          >
            <Ionicons name="arrow-forward-circle-outline" size={20} color="#fff" />
            <StyledText style={styles.primaryBtnText}>{t('peek_view_invite')}</StyledText>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.shareLink}
            onPress={() =>
              Share.share({
                message: t('peek_at_share', { title: String(event?.title || ''), url: `https://pallinky.com/peek/${id}` }),
              })
            }
          >
            <Ionicons name="share-outline" size={16} color={SYSTEM.secondary} />
            <StyledText style={styles.shareLinkText}>{t('peek_share')}</StyledText>
          </TouchableOpacity>
        </View>

        <View style={styles.actionCard}>
          <View style={styles.loopToggle}>
            <View style={styles.loopCopy}>
              <StyledText style={styles.loopLabel}>{t('peek_see_more_from', { host: hostName })}</StyledText>
              <StyledText style={styles.loopSub}>
                {t('peek_keep_loop')}
              </StyledText>
            </View>
            <Switch
              value={keepInLoop}
              onValueChange={handleToggleLoop}
              trackColor={{ false: '#d1d1d1', true: SYSTEM.primary }}
            />
          </View>
        </View>

        {accessDecision?.can_see_guest_list === true ? (
          <>
            <StyledText style={styles.sectionLabel}>
              {t('peek_who_already_in')} ({attendees.length})
            </StyledText>

            {attendees.length === 0 ? (
              <View style={styles.emptyCard}>
                <StyledText style={styles.emptyTitle}>{t('peek_no_responses')}</StyledText>
                <StyledText style={styles.emptyBody}>
                  {t('peek_no_responses_body')}
                </StyledText>
              </View>
            ) : (
              attendees.map((person, index) => (
                <View key={`${person.name || 'person'}-${index}`} style={styles.personRow}>
                  <View style={styles.avatarMini}>
                    <StyledText style={styles.avatarChar}>
                      {String(person.name || '?').charAt(0).toUpperCase()}
                    </StyledText>
                  </View>

                  <View style={styles.personInfo}>
                    <StyledText style={styles.personName}>{person.name || t('event_guest_fallback')}</StyledText>

                    {person.common_event ? (
                      <View style={styles.personContextBadge}>
                        <Ionicons name="sparkles" size={12} color={SYSTEM.primary} />
                        <StyledText style={styles.personContextText}>
                          {t('peek_both_went', { event: String(person.common_event) })}
                        </StyledText>
                      </View>
                    ) : person.mutual_friend_count > 0 ? (
                      <View style={styles.personContextBadge}>
                        <Ionicons name="people" size={12} color={SYSTEM.primary} />
                        <StyledText style={styles.personContextText}>
                          {t('peek_mutual_friends', { count: String(person.mutual_friend_count) })}
                        </StyledText>
                      </View>
                    ) : (
                      <StyledText style={styles.friendOfFriend}>
                        {t('peek_in_host_orbit', { host: hostName })}
                      </StyledText>
                    )}

                    <StyledText style={styles.statusTag}>
                      {formatStatus(person.status, t)}
                    </StyledText>
                  </View>
                </View>
              ))
            )}
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: SYSTEM.bg,
  },

  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: SYSTEM.bg,
    paddingHorizontal: 24,
  },

  header: {
    backgroundColor: SYSTEM.secondaryBg,
    padding: 24,
    paddingTop: 60,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    borderBottomWidth: 1,
    borderColor: SYSTEM.borderSoft,
  },

  closeBtn: {
    alignSelf: 'flex-end',
    marginBottom: 10,
  },

  peekLabel: {
    color: SYSTEM.secondary,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.5,
  },

  title: {
    fontSize: 28,
    fontWeight: '900',
    color: SYSTEM.text,
    marginTop: 4,
  },

  host: {
    fontSize: 15,
    color: SYSTEM.textMuted,
    fontWeight: '600',
    marginTop: 4,
  },

  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },

  contextCard: {
    backgroundColor: SYSTEM.surface,
    borderRadius: 24,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: SYSTEM.border,
  },

  contextBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    backgroundColor: SYSTEM.secondaryBg,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 12,
  },

  contextBadgeText: {
    color: SYSTEM.secondary,
    fontWeight: '800',
    fontSize: 12,
  },

  contextBody: {
    fontSize: 15,
    lineHeight: 22,
    color: SYSTEM.text,
    fontWeight: '600',
  },

  snapshotCard: {
    backgroundColor: SYSTEM.surface,
    borderRadius: 24,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: SYSTEM.border,
  },

  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: SYSTEM.text,
    marginBottom: 14,
  },

  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },

  metaText: {
    flex: 1,
    fontSize: 14,
    color: SYSTEM.text,
    fontWeight: '600',
  },

  descriptionText: {
    marginTop: 6,
    marginBottom: 18,
    fontSize: 14,
    lineHeight: 22,
    color: SYSTEM.textMuted,
  },

  primaryBtn: {
    backgroundColor: SYSTEM.primary,
    paddingVertical: 16,
    paddingHorizontal: 18,
    borderRadius: 18,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },

  primaryBtnText: {
    color: '#fff',
    fontWeight: '800',
  },

  shareLink: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },

  shareLinkText: {
    color: SYSTEM.secondary,
    fontWeight: '700',
    fontSize: 13,
  },

  actionCard: {
    backgroundColor: SYSTEM.surface,
    borderRadius: 24,
    padding: 20,
    marginBottom: 28,
    borderWidth: 1,
    borderColor: SYSTEM.border,
  },

  loopToggle: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  loopCopy: {
    flex: 1,
  },

  loopLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: SYSTEM.text,
  },

  loopSub: {
    fontSize: 12,
    color: SYSTEM.textMuted,
  },

  sectionLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: SYSTEM.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 10,
  },

  emptyCard: {
    backgroundColor: SYSTEM.surface,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: SYSTEM.borderSoft,
  },

  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: SYSTEM.text,
    textAlign: 'center',
  },

  emptyBody: {
    marginTop: 4,
    fontSize: 13,
    color: SYSTEM.textMuted,
    textAlign: 'center',
  },

  personRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: SYSTEM.surface,
    padding: 14,
    borderRadius: 18,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: SYSTEM.borderSoft,
  },

  avatarMini: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: SYSTEM.secondaryBg,
    justifyContent: 'center',
    alignItems: 'center',
  },

  avatarChar: {
    fontWeight: 'bold',
    color: SYSTEM.secondary,
  },

  personInfo: {
    flex: 1,
    marginLeft: 15,
  },

  personName: {
    fontSize: 16,
    fontWeight: '700',
    color: SYSTEM.text,
  },

  statusTag: {
    fontSize: 10,
    color: SYSTEM.textMuted,
    fontWeight: '900',
    textTransform: 'uppercase',
    marginTop: 2,
  },

  personContextBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#EDF4E8',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    marginVertical: 4,
    alignSelf: 'flex-start',
  },

  personContextText: {
    fontSize: 11,
    color: SYSTEM.primary,
    fontWeight: '700',
  },

  friendOfFriend: {
    fontSize: 11,
    color: SYSTEM.textMuted,
    fontStyle: 'italic',
    marginVertical: 4,
  },
});
