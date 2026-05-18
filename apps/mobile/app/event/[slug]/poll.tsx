/**
 * Path: app/event/[slug]/poll.tsx
 * Description: Shared poll page.
 * - host sees poll management controls
 * - guests see poll results
 * - both can see who voted and how votes are distributed
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { formatInEventTimeZone, supabase, useSession } from '@pallinky/core';
import { Ionicons } from '@expo/vector-icons';
import { useI18n } from '@pallinky/i18n/client';

const SYSTEM = {
  background: '#F6F7F9',
  surface: '#FFFFFF',
  text: '#1f2a1b',
  textMuted: '#66715f',
  primary: '#43691b',
  border: '#bac9ad',
  borderSoft: '#e7ede2',
  secondary: '#6A4C93',
  secondaryBg: '#efe9f7',
  danger: '#b42318',
  dangerBg: '#fef3f2',
};

const PALETTES: Record<string, { bg: string; accent: string; text: string; isDark: boolean }> = {
  zen: { bg: '#F6F7F9', accent: '#43691b', text: '#1f2a1b', isDark: false },
  girly: { bg: '#f4bbd3', accent: '#fe5d9f', text: '#2b1f24', isDark: false },
  fiesta: { bg: '#1729ae', accent: '#fe20e8', text: '#ffffff', isDark: true },
  classy: { bg: '#03172f', accent: '#efd466', text: '#fff7b6', isDark: true },
  spicy: { bg: '#656c12', accent: '#ecc216', text: '#ffffff', isDark: true },
  submerged: { bg: '#F6F7F9', accent: '#6A4C93', text: '#1f2a1b', isDark: false },
};

type EventRow = Record<string, any>;
type VoteRow = {
  id?: string;
  guest_name?: string | null;
  user_email?: string | null;
  selected_dates?: string[] | null;
  note?: string | null;
};

function normalizeEmail(value: string | null | undefined) {
  return String(value || '').toLowerCase().trim();
}

function getFirstName(value: string | null | undefined, fallback: string) {
  return (value || '').trim().split(' ')[0] || fallback;
}

function formatDateTime(value: string | null | undefined, event: any, fallback: string) {
  if (!value) return fallback;

  return formatInEventTimeZone(
    value,
    {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    },
    event
  );
}

function formatDateOnly(value: string | null | undefined, event: any, fallback: string) {
  if (!value) return fallback;

  return formatInEventTimeZone(
    value,
    { weekday: 'long', month: 'short', day: 'numeric' },
    event
  );
}

export default function PollPage() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const router = useRouter();
  const { session } = useSession();
  const { t } = useI18n();

  const viewerEmail = normalizeEmail(session?.user?.email);

  const [loading, setLoading] = useState(true);
  const [finalizingDate, setFinalizingDate] = useState<string | null>(null);
  const [deletingDate, setDeletingDate] = useState<string | null>(null);
  const [event, setEvent] = useState<EventRow | null>(null);
  const [votes, setVotes] = useState<VoteRow[]>([]);

  const theme = useMemo(() => {
    if (event?.gif_key && PALETTES[event.gif_key]) return PALETTES[event.gif_key];
    return PALETTES.submerged;
  }, [event]);

  const isHost = useMemo(() => {
    return !!event && normalizeEmail(event.host_email) === viewerEmail;
  }, [event, viewerEmail]);

  const loadData = useCallback(async () => {
    setLoading(true);

    try {
      const { data: eventData, error: eventError } = await supabase
        .from('events')
        .select('*')
        .eq('slug', slug)
        .single();

      if (eventError) throw eventError;

      if (!eventData) {
        setEvent(null);
        setVotes([]);
        return;
      }

      const isPoll =
        eventData.event_type === 'poll' ||
        (Array.isArray(eventData.proposed_dates) && eventData.proposed_dates.length > 0);

      if (!isPoll) {
        Alert.alert(t('event_not_poll'), t('event_not_poll_body'));
        router.replace(`/event/${slug}/details` as any);
        return;
      }

      const { data: voteData, error: voteError } = await supabase
        .from('vibe_responses')
        .select('id, guest_name, user_email, selected_dates, note')
        .eq('event_id', eventData.id);

      if (voteError) throw voteError;

      setEvent(eventData);
      setVotes(voteData || []);
    } catch (err) {
      console.error(err);
      Alert.alert(t('event_poll_load_failed'), t('event_poll_load_failed_body'));
    } finally {
      setLoading(false);
    }
  }, [slug, router, t]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const tallies = useMemo(() => {
    const map: Record<string, { count: number; voters: string[] }> = {};

    (event?.proposed_dates || []).forEach((date: string) => {
      map[date] = { count: 0, voters: [] };
    });

    votes.forEach((vote) => {
      const voterLabel = vote.guest_name?.trim() || vote.user_email?.trim() || t('common_guest');

      (vote.selected_dates || []).forEach((date) => {
        if (!map[date]) {
          map[date] = { count: 0, voters: [] };
        }

        map[date].count += 1;
        map[date].voters.push(voterLabel);
      });
    });

    return map;
  }, [event, votes, t]);

  const sortedDates = useMemo(() => {
    return Object.keys(tallies).sort(
      (a, b) => new Date(a).getTime() - new Date(b).getTime()
    );
  }, [tallies]);

  const notifyGuestsOfFinalDate = useCallback(
    async (winningDateIso: string) => {
      if (!event) return;

      const recipientSet = new Set<string>();

      votes.forEach((vote) => {
        const email = normalizeEmail(vote.user_email);
        if (email && email !== normalizeEmail(event.host_email)) {
          recipientSet.add(email);
        }
      });

      const recipients = Array.from(recipientSet);
      if (recipients.length === 0) return;

      const rows = recipients.map((recipientEmail) => ({
        event_id: event.id,
        recipient_email: recipientEmail,
        template: 'event_updated',
        type: 'event_updated',
        status: 'pending',
        payload: {
          event_title: event.title,
          host_name: event.host_name,
          starts_at: winningDateIso,
          location: event.location || null,
          slug: event.slug,
          final_date_chosen: true,
        },
      }));

      const { error } = await supabase.from('notifications_outbox').insert(rows);
      if (error) throw error;
    },
    [event, votes]
  );

  const handleFinalize = useCallback(
    async (winningDateIso: string) => {
      if (!event?.manage_handle) {
        Alert.alert(t('common_error'), t('event_poll_manage_missing_token_body'));
        return;
      }

      setFinalizingDate(winningDateIso);

      try {
        const normalizedIso = new Date(winningDateIso).toISOString();

        const { error } = await supabase.rpc('finalize_vibe_by_manage_token', {
          p_manage_token: event.manage_handle,
          p_winning_starts_at: normalizedIso,
        });

        if (error) throw error;

        await notifyGuestsOfFinalDate(normalizedIso);

        Alert.alert(t('event_poll_date_confirmed'), t('event_poll_date_confirmed_body'));
        router.replace(`/event/${slug}/details` as any);
      } catch (err) {
        console.error(err);
        Alert.alert(t('common_error'), t('event_poll_finalize_error'));
      } finally {
        setFinalizingDate(null);
      }
    },
    [event, slug, router, notifyGuestsOfFinalDate, t]
  );

  const handleDeleteDate = useCallback(
    async (dateToDelete: string) => {
      if (!event) return;

      const remainingDates = (event.proposed_dates || []).filter(
        (date: string) => date !== dateToDelete
      );

      if (remainingDates.length === 0) {
        Alert.alert(t('event_poll_cannot_delete'), t('event_poll_cannot_delete_body'));
        return;
      }

      setDeletingDate(dateToDelete);

      try {
        const { error } = await supabase
          .from('events')
          .update({ proposed_dates: remainingDates })
          .eq('id', event.id);

        if (error) throw error;

        const filteredVotes = votes.map((vote) => ({
          ...vote,
          selected_dates: (vote.selected_dates || []).filter((date) => date !== dateToDelete),
        }));

        setEvent({
          ...event,
          proposed_dates: remainingDates,
        });
        setVotes(filteredVotes);
      } catch (err) {
        console.error(err);
        Alert.alert(t('common_error'), t('event_poll_delete_error'));
      } finally {
        setDeletingDate(null);
      }
    },
    [event, votes, t]
  );

  const confirmDeleteDate = useCallback(
    (dateToDelete: string) => {
      Alert.alert(
        t('event_poll_delete_date'),
        t('event_poll_delete_date_body', { date: formatDateOnly(dateToDelete, event, t('common_tbd')) }),
        [
          { text: t('common_cancel'), style: 'cancel' },
          {
            text: t('common_delete'),
            style: 'destructive',
            onPress: () => {
              void handleDeleteDate(dateToDelete);
            },
          },
        ]
      );
    },
    [event, handleDeleteDate, t]
  );

  if (loading) {
    return (
      <View style={[styles.centered, { backgroundColor: SYSTEM.background }]}>
        <ActivityIndicator color={SYSTEM.primary} />
      </View>
    );
  }

  if (!event) {
    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: SYSTEM.background }]}>
        <View style={styles.centered}>
          <Text style={styles.emptyTitle}>{t('event_poll_not_found')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.bg }]}>
      <StatusBar barStyle={theme.isDark ? 'light-content' : 'dark-content'} />

      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => router.replace(`/event/${slug}/details` as any)}
        >
          <Ionicons name="arrow-back" size={20} color={theme.accent} />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <View style={styles.content}>
          <Text style={[styles.eyebrow, { color: theme.accent }]}>
            {isHost ? t('event_poll_management_label') : t('event_poll_results_label')}
          </Text>

          <Text style={[styles.title, { color: theme.text }]}>{event.title}</Text>

          <Text style={[styles.subtitle, { color: theme.text }]}>
            {isHost
              ? t('event_poll_host_subtitle')
              : t('event_poll_guest_subtitle')}
          </Text>

          {isHost && !!event.manage_handle && (
            <TouchableOpacity
              style={[styles.manageLink, { borderColor: theme.accent }]}
              onPress={() => router.push(`/m/${event.manage_handle}/` as any)}
            >
              <Ionicons name="create-outline" size={16} color={theme.accent} />
              <Text style={[styles.manageLinkText, { color: theme.accent }]}>
                {t('event_poll_edit_details')}
              </Text>
            </TouchableOpacity>
          )}

          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>{t('event_poll_date_options')}</Text>

            {sortedDates.length === 0 ? (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyText}>{t('event_poll_no_date_options')}</Text>
              </View>
            ) : (
              sortedDates.map((date) => {
                const tally = tallies[date];
                const busyFinalize = finalizingDate === date;
                const busyDelete = deletingDate === date;
                const anyBusy = !!finalizingDate || !!deletingDate;

                return (
                  <View key={date} style={styles.dateCard}>
                    <View style={styles.dateHeaderRow}>
                      <View style={styles.dateTextWrap}>
                        <Text style={[styles.dateTitle, { color: theme.text }]}>
                          {formatDateOnly(date, event, t('common_tbd'))}
                        </Text>
                        <Text style={styles.dateMeta}>
                          {formatDateTime(date, event, t('common_tbd'))} • {t(tally.count === 1 ? 'event_poll_vote_count_one' : 'event_poll_vote_count_other', { count: String(tally.count) })}
                        </Text>
                      </View>

                      {isHost && (
                        <View style={styles.inlineActions}>
                          <TouchableOpacity
                            style={[
                              styles.inlineConfirmBtn,
                              { backgroundColor: theme.accent },
                              anyBusy && !busyFinalize ? styles.subtleDisabled : null,
                            ]}
                            disabled={anyBusy}
                            onPress={() => handleFinalize(date)}
                          >
                            {busyFinalize ? (
                              <ActivityIndicator size="small" color="#fff" />
                            ) : (
                              <Text style={styles.inlineConfirmBtnText}>{t('common_confirm')}</Text>
                            )}
                          </TouchableOpacity>

                          <TouchableOpacity
                            style={[
                              styles.iconOnlyBtn,
                              busyDelete ? styles.subtleDisabled : null,
                            ]}
                            disabled={anyBusy}
                            onPress={() => confirmDeleteDate(date)}
                          >
                            {busyDelete ? (
                              <ActivityIndicator size="small" color={SYSTEM.danger} />
                            ) : (
                              <Ionicons name="trash-outline" size={18} color={SYSTEM.danger} />
                            )}
                          </TouchableOpacity>
                        </View>
                      )}
                    </View>

                    {tally.voters.length > 0 ? (
                      <View style={styles.voterChips}>
                        {tally.voters.map((name, index) => (
                          <View key={`${date}-${name}-${index}`} style={styles.voterChip}>
                            <Text style={styles.voterChipText}>{getFirstName(name, t('common_guest'))}</Text>
                          </View>
                        ))}
                      </View>
                    ) : (
                      <Text style={styles.emptyInline}>{t('event_poll_no_one_voted')}</Text>
                    )}
                  </View>
                );
              })
            )}
          </View>

          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>{t('event_poll_who_voted')}</Text>

            {votes.length === 0 ? (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyText}>{t('event_no_votes')}</Text>
              </View>
            ) : (
              votes.map((vote, index) => {
                const voterName =
                  vote.guest_name?.trim() ||
                  vote.user_email?.trim() ||
                  t('common_guest');

                return (
                  <View key={vote.id || `${voterName}-${index}`} style={styles.voteCard}>
                    <Text style={[styles.voteName, { color: theme.text }]}>{voterName}</Text>

                    {(vote.selected_dates || []).length > 0 ? (
                      <View style={styles.voteSelections}>
                        {(vote.selected_dates || []).map((date) => (
                          <View key={`${voterName}-${date}`} style={styles.selectionChip}>
                            <Text style={styles.selectionChipText}>{formatDateOnly(date, event, t('common_tbd'))}</Text>
                          </View>
                        ))}
                      </View>
                    ) : (
                      <Text style={styles.emptyInline}>{t('event_poll_no_date_selections')}</Text>
                    )}

                    {!!vote.note?.trim() ? (
                      <View style={styles.noteBox}>
                        <Text style={styles.noteLabel}>{t('event_poll_note')}</Text>
                        <Text style={styles.noteText}>{vote.note.trim()}</Text>
                      </View>
                    ) : null}
                  </View>
                );
              })
            )}
          </View>
        </View>

        {!isHost && (
          <TouchableOpacity
            style={[
              styles.secondaryBtn,
              {
                borderColor: theme.accent,
              },
            ]}
            onPress={() => router.push(`/event/${slug}/guest-poll` as any)}
          >
            <Text style={[styles.secondaryBtnText, { color: theme.accent }]}>
              {t('event_poll_change_vote')}
            </Text>
          </TouchableOpacity>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },

  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  header: {
    paddingHorizontal: 20,
    paddingVertical: 10,
  },

  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: SYSTEM.surface,
    borderWidth: 1,
    borderColor: SYSTEM.borderSoft,
  },

  scrollContent: {
    paddingBottom: 24,
  },

  content: {
    paddingHorizontal: 20,
    paddingTop: 8,
  },

  eyebrow: {
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1,
    marginBottom: 8,
  },

  title: {
    fontSize: 32,
    fontWeight: '900',
    marginBottom: 8,
  },

  subtitle: {
    fontSize: 16,
    opacity: 0.72,
    marginBottom: 16,
  },

  manageLink: {
    minHeight: 42,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    marginBottom: 24,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.45)',
  },

  manageLinkText: {
    fontSize: 14,
    fontWeight: '800',
  },

  section: {
    marginBottom: 28,
  },

  sectionTitle: {
    fontSize: 20,
    fontWeight: '900',
    marginBottom: 14,
  },

  dateCard: {
    backgroundColor: SYSTEM.surface,
    borderWidth: 1,
    borderColor: SYSTEM.borderSoft,
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
  },

  dateHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 12,
  },

  dateTextWrap: {
    flex: 1,
    minWidth: 0,
  },

  dateTitle: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 4,
  },

  dateMeta: {
    fontSize: 14,
    color: SYSTEM.textMuted,
  },

  inlineActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },

  inlineConfirmBtn: {
    minHeight: 36,
    borderRadius: 10,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },

  inlineConfirmBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '900',
  },

  iconOnlyBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: SYSTEM.dangerBg,
    borderWidth: 1,
    borderColor: '#fecdca',
  },

  subtleDisabled: {
    opacity: 0.55,
  },

  voterChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },

  voterChip: {
    backgroundColor: SYSTEM.secondaryBg,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },

  voterChipText: {
    color: SYSTEM.secondary,
    fontSize: 12,
    fontWeight: '800',
  },

  voteCard: {
    backgroundColor: SYSTEM.surface,
    borderWidth: 1,
    borderColor: SYSTEM.borderSoft,
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
  },

  voteName: {
    fontSize: 16,
    fontWeight: '900',
    marginBottom: 10,
  },

  voteSelections: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },

  selectionChip: {
    backgroundColor: '#F2F4F1',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },

  selectionChipText: {
    color: SYSTEM.text,
    fontSize: 12,
    fontWeight: '700',
  },

  noteBox: {
    marginTop: 12,
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#F8F9F7',
    borderWidth: 1,
    borderColor: SYSTEM.borderSoft,
  },

  noteLabel: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.6,
    color: SYSTEM.textMuted,
    marginBottom: 6,
    textTransform: 'uppercase',
  },

  noteText: {
    fontSize: 14,
    color: SYSTEM.text,
    lineHeight: 20,
  },

  secondaryBtn: {
    marginTop: 8,
    marginHorizontal: 20,
    paddingVertical: 16,
    borderRadius: 14,
    borderWidth: 1.5,
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.45)',
  },

  secondaryBtnText: {
    fontSize: 15,
    fontWeight: '800',
  },

  emptyCard: {
    backgroundColor: SYSTEM.surface,
    borderWidth: 1,
    borderColor: SYSTEM.borderSoft,
    borderRadius: 18,
    padding: 18,
  },

  emptyTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: SYSTEM.text,
  },

  emptyText: {
    fontSize: 14,
    color: SYSTEM.textMuted,
  },

  emptyInline: {
    fontSize: 13,
    color: SYSTEM.textMuted,
  },
});