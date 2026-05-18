/**
 * Path: app/(tabs)/events.tsx
 * Description:
 * Events coordination surface.
 *
 * Partitions one unified dataset into:
 * - Action Needed
 * - Upcoming
 * - Coordinating
 * - Past
 *
 * Uses EventFeedCard for all formal event card rendering so the
 * Events tab matches the feed surface and supports participant avatars.
 */

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Modal,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StyledText } from '@pallinky/ui';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { supabase, useSession } from '@pallinky/core';
import { useI18n } from '@pallinky/i18n/client';

import EventFeedCard from '../../../../packages/ui/src/EventFeedCard';

type EventRow = Record<string, any>;
type RsvpRow = Record<string, any>;
type InviteRow = Record<string, any>;
type VibeResponseRow = Record<string, any>;
type DeviceContactRow = Record<string, any>;

const FALLBACK_IMAGE =
  'https://images.unsplash.com/photo-1493246318656-5bbd4afb293c?q=80&w=1000&auto=format&fit=crop';

function normalizeEmail(value: any) {
  return String(value || '').toLowerCase().trim();
}

function normalizeStatus(value: any) {
  return String(value || '').toLowerCase().trim();
}

function isVibeEvent(ev: EventRow) {
  return normalizeStatus(ev?.event_type) === 'vibe' || !ev?.starts_at;
}

function isFuture(ev: EventRow) {
  if (!ev?.starts_at) return false;
  return new Date(ev.starts_at).getTime() > Date.now();
}

function isPast(ev: EventRow) {
  if (!ev?.starts_at) return false;
  return new Date(ev.starts_at).getTime() < Date.now();
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

function seedFromName(name: string | null | undefined, email?: string | null) {
  const source = (name || '').trim() || (email || '').trim() || '?';
  return source.charAt(0).toUpperCase();
}

function isPositiveRsvpStatus(status: string | null | undefined) {
  const normalized = normalizeStatus(status);
  return ['yes', 'going', 'interested', 'maybe'].includes(normalized);
}

function getMyInviteRows(invites: InviteRow[], eventId: string, userEmail: string) {
  return invites.filter((row) => {
    if (String(row.event_id) !== String(eventId)) return false;
    return [
      row.invitee_email_lc,
      row.invitee_email,
      row.email_lc,
      row.email,
    ].some((v) => normalizeEmail(v) === userEmail);
  });
}

function getMyRsvpRows(rsvps: RsvpRow[], eventId: string, userEmail: string) {
  return rsvps.filter((row) => {
    if (String(row.event_id) !== String(eventId)) return false;
    return [
      row.email_lc,
      row.email,
      row.user_email_lc,
      row.user_email,
    ].some((v) => normalizeEmail(v) === userEmail);
  });
}

function getMyVibeResponseRows(
  vibeResponses: VibeResponseRow[],
  eventId: string,
  userEmail: string
) {
  return vibeResponses.filter((row) => {
    if (String(row.event_id) !== String(eventId)) return false;
    return [
      row.email_lc,
      row.email,
      row.user_email_lc,
      row.user_email,
    ].some((v) => normalizeEmail(v) === userEmail);
  });
}

function hasQualifyingRsvp(rows: RsvpRow[]) {
  return rows.some((row) => {
    const status = normalizeStatus(row.status);
    return ['yes', 'going', 'interested', 'maybe'].includes(status);
  });
}

function hasCommittedRsvp(rows: RsvpRow[]) {
  return rows.some((row) => {
    const status = normalizeStatus(row.status);
    return ['yes', 'going'].includes(status);
  });
}

function hasDeclinedRsvp(rows: RsvpRow[]) {
  return rows.some((row) => {
    const status = normalizeStatus(row.status);
    return ['no', 'declined', 'not_going'].includes(status);
  });
}

function Section({
  title,
  count,
  icon,
  children,
}: {
  title: string;
  count: number;
  icon: keyof typeof Ionicons.glyphMap;
  children: React.ReactNode;
}) {
  if (!count) return null;

  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionHeaderLeft}>
          <Ionicons name={icon} size={18} color="#43691b" />
          <StyledText style={styles.sectionTitle}>{title}</StyledText>
        </View>
        <View style={styles.sectionCount}>
          <StyledText style={styles.sectionCountText}>{count}</StyledText>
        </View>
      </View>
      {children}
    </View>
  );
}

function SummaryStat({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.summaryCard}>
      <StyledText style={styles.summaryValue}>{value}</StyledText>
      <StyledText style={styles.summaryLabel}>{label}</StyledText>
    </View>
  );
}

function CoordinatingPlanCard({
  item,
  currentUserEmail,
  onHostOpenResults,
}: {
  item: EventRow;
  currentUserEmail: string;
  onHostOpenResults: (item: EventRow) => void;
}) {
  const isHost = normalizeEmail(item.host_email) === currentUserEmail;

  return (
    <TouchableOpacity
      activeOpacity={0.92}
      style={styles.coordinatingCard}
      onPress={() => {
        if (isHost) {
          onHostOpenResults(item);
        } else {
          router.push(`/event/${item.slug}/guest-poll`);
        }
      }}
    >
      <View style={styles.coordinatingTopRow}>
        <View
          style={[
            styles.coordinatingBadge,
            { backgroundColor: isHost ? '#efe9f7' : '#fff3e8' },
          ]}
        >
          <StyledText
            style={[
              styles.coordinatingBadgeText,
              { color: isHost ? '#6A4C93' : '#c2410c' },
            ]}
          >
            {isHost ? 'MY POLL' : 'An idea'}
          </StyledText>
        </View>
        <Ionicons name="calendar-outline" size={18} color="#6A4C93" />
      </View>

      <StyledText style={styles.coordinatingTitle}>
        {item.title || 'Untitled plan'}
      </StyledText>

      <View style={styles.metaRow}>
        <Ionicons name="person-outline" size={14} color="#6A4C93" />
        <StyledText style={styles.metaText}>
          {item.host_name || item.host_email || 'Unknown host'}
        </StyledText>
      </View>

      <View style={styles.metaRow}>
        <Ionicons name="time-outline" size={14} color="#6A4C93" />
        <StyledText style={styles.metaText}>DATE TBD</StyledText>
      </View>

      {!!item.location && (
        <View style={styles.metaRow}>
          <Ionicons name="location-outline" size={14} color="#6A4C93" />
          <StyledText style={styles.metaText}>{item.location}</StyledText>
        </View>
      )}

      <TouchableOpacity
        style={styles.coordinatingCta}
        onPress={() => {
          if (isHost) {
            onHostOpenResults(item);
          } else {
            router.push(`/event/${item.slug}/guest-poll`);
          }
        }}
      >
        <StyledText style={styles.coordinatingCtaText}>
          {isHost ? 'View results' : 'Vote on a date'}
        </StyledText>
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

function FormalEventCard({
  item,
  currentUserEmail,
  variant,
  rsvps,
  avatarByEmail,
  unreadMessages = 0,
  onPress,
  lang,
  labels,
}: {
  item: EventRow;
  currentUserEmail: string;
  variant: 'action' | 'upcoming' | 'past';
  rsvps: RsvpRow[];
  avatarByEmail: Record<string, string>;
  unreadMessages?: number;
  onPress: () => void;
  lang: any;
  labels: { respond: string; manage: string; viewEvent: string };
}) {
  const isHost = normalizeEmail(item.host_email) === currentUserEmail;
  const hostEmail = normalizeEmail(item.host_email);

  const participantMap = new Map<string, { seed: string; avatarUrl?: string | null }>();

  rsvps.forEach((r) => {
    if (String(r.event_id) !== String(item.id)) return;
    if (!isPositiveRsvpStatus(r.status)) return;

    const email = normalizeEmail(r.email_lc || r.email);
    if (!email || email === hostEmail || participantMap.has(email)) return;

    participantMap.set(email, {
      seed: seedFromName(r.name, r.email_lc || r.email),
      avatarUrl: avatarByEmail[email] || null,
    });
  });

  const participantAvatars = Array.from(participantMap.values());

  const hasMyPositiveRsvp = hasQualifyingRsvp(getMyRsvpRows(rsvps, item.id, currentUserEmail));
  const hasMyDeclinedRsvp = hasDeclinedRsvp(getMyRsvpRows(rsvps, item.id, currentUserEmail));

  const status =
    variant === 'past'
      ? 'past'
      : isHost
      ? 'host'
      : variant === 'action' && !hasMyPositiveRsvp && !hasMyDeclinedRsvp
      ? 'pending'
      : 'guest';

  const actionLabel =
    variant === 'action'
      ? labels.respond
      : isHost
      ? labels.manage
      : labels.viewEvent;

  return (
    <View style={styles.cardWrapper}>
      <EventFeedCard
        id={item.id}
        currentUserEmail={currentUserEmail}
        hostEmail={item.host_email}
        title={item.title}
        startsAt={item.starts_at || ''}
        location={item.location}
        coverImageUrl={item.cover_image_url || FALLBACK_IMAGE}
        gifKey={item.gif_key}
        fontFamily={item.font_family}
        hostName={item.host_name}
        status={status}
        actionLabel={actionLabel}
        unreadMessages={unreadMessages}
        participantAvatars={participantAvatars}
        participantCount={participantAvatars.length}
        isSeries={!!item.series_id}
        lang={lang}
        onPress={onPress}
      />
    </View>
  );
}

export default function EventsScreen() {
  const { userEmail: sessionEmail } = useSession();
  const { language, t } = useI18n();
  const cardLabels = useMemo(() => ({
    respond: t('common_respond'),
    manage: t('common_manage'),
    viewEvent: t('common_view_event'),
  }), [t]);

  const [events, setEvents] = useState<EventRow[]>([]);
  const [rsvps, setRsvps] = useState<RsvpRow[]>([]);
  const [invites, setInvites] = useState<InviteRow[]>([]);
  const [contacts, setContacts] = useState<DeviceContactRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [selectedIdea, setSelectedIdea] = useState<EventRow | null>(null);
  const [insightModal, setInsightModal] = useState(false);
  const [isFinalizingWinner, setIsFinalizingWinner] = useState(false);

  const [avatarByEmail, setAvatarByEmail] = useState<Record<string, string>>({});

  const userEmail = normalizeEmail(sessionEmail);

  const fetchEventsData = useCallback(async () => {
    try {
      const cleanEmail = normalizeEmail(sessionEmail);

      if (!cleanEmail) {
        setEvents([]);
        setRsvps([]);
        setInvites([]);
        setContacts([]);
        return;
      }

      setRefreshing(true);

      const [eventsRes, rsvpsRes, invitesRes, contactsRes] = await Promise.all([
        supabase
          .from('events')
          .select(`*, responses:vibe_responses(*)`)
          .order('created_at', { ascending: false }),
        supabase.from('rsvps').select('*'),
        supabase.from('event_invites').select('*'),
        supabase.rpc('get_my_device_contacts'),
      ]);

      if (eventsRes.error) throw eventsRes.error;
      if (rsvpsRes.error) throw rsvpsRes.error;
      if (invitesRes.error) throw invitesRes.error;

      setEvents(eventsRes.data || []);
      setRsvps(rsvpsRes.data || []);
      setInvites(invitesRes.data || []);
      setContacts(contactsRes.data || []);
    } catch (e: any) {
      console.error('Events load failed:', e.message);
      Alert.alert('Load failed', 'Could not load events right now.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [sessionEmail]);

  useFocusEffect(
    useCallback(() => {
      fetchEventsData();
    }, [fetchEventsData])
  );

  useEffect(() => {
    const loadAvatars = async () => {
      const emailSet = new Set<string>();

      events.forEach((ev) => {
        const hostEmail = normalizeEmail(ev.host_email);
        if (hostEmail) emailSet.add(hostEmail);
      });

      rsvps.forEach((r) => {
        const email = normalizeEmail(r.email_lc || r.email);
        if (email) emailSet.add(email);
      });

      const contactAvatarByEmail = Object.fromEntries(
        (contacts || [])
          .filter((c: any) => normalizeEmail(c.email_lc))
          .map((c: any) => [normalizeEmail(c.email_lc), c.avatar_uri || ''])
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

      setAvatarByEmail({
        ...contactAvatarByEmail,
        ...profileAvatarByEmail,
      });
    };

    void loadAvatars();
  }, [events, rsvps, contacts]);

  const derived = useMemo(() => {
    const involvedEvents = events.filter((ev) => {
      const isHost = normalizeEmail(ev.host_email) === userEmail;
      const myInvites = getMyInviteRows(invites, ev.id, userEmail);
      const myRsvps = getMyRsvpRows(rsvps, ev.id, userEmail);
      const myVibeResponses = getMyVibeResponseRows(
        ev.responses || [],
        ev.id,
        userEmail
      );

      return isHost || myInvites.length > 0 || myRsvps.length > 0 || myVibeResponses.length > 0;
    });

    const actionNeeded: EventRow[] = [];
    const upcoming: EventRow[] = [];
    const coordinating: EventRow[] = [];
    const past: EventRow[] = [];

    involvedEvents.forEach((ev) => {
      const isHost = normalizeEmail(ev.host_email) === userEmail;
      const vibe = isVibeEvent(ev);

      const myInvites = getMyInviteRows(invites, ev.id, userEmail);
      const myRsvps = getMyRsvpRows(rsvps, ev.id, userEmail);
      const myVibeResponses = getMyVibeResponseRows(
        ev.responses || [],
        ev.id,
        userEmail
      );

      const inviteAwaitingResponse =
        !isHost &&
        !vibe &&
        myInvites.length > 0 &&
        !hasCommittedRsvp(myRsvps) &&
        !hasDeclinedRsvp(myRsvps);

      const vibeAwaitingResponse =
        !isHost &&
        vibe &&
        myVibeResponses.length === 0;

      if (inviteAwaitingResponse || vibeAwaitingResponse) {
        actionNeeded.push(ev);
        return;
      }

      if (vibe) {
        coordinating.push(ev);
        return;
      }

      if (isFuture(ev) && (isHost || hasQualifyingRsvp(myRsvps))) {
        upcoming.push(ev);
        return;
      }

      if (isPast(ev) && (isHost || myInvites.length > 0 || myRsvps.length > 0)) {
        past.push(ev);
      }
    });

    const upcomingSorted = [...upcoming].sort((a, b) => {
      const aTime = a?.starts_at
        ? new Date(a.starts_at).getTime()
        : Number.MAX_SAFE_INTEGER;
      const bTime = b?.starts_at
        ? new Date(b.starts_at).getTime()
        : Number.MAX_SAFE_INTEGER;
      return aTime - bTime;
    });

    const coordinatingSorted = [...coordinating].sort((a, b) => {
      const aTime = a?.created_at ? new Date(a.created_at).getTime() : 0;
      const bTime = b?.created_at ? new Date(b.created_at).getTime() : 0;
      return bTime - aTime;
    });

    const pastSorted = [...past].sort((a, b) => {
      const aTime = a?.starts_at ? new Date(a.starts_at).getTime() : 0;
      const bTime = b?.starts_at ? new Date(b.starts_at).getTime() : 0;
      return bTime - aTime;
    });

    const eventsCreatedCount = events.filter(
      (ev) => normalizeEmail(ev.host_email) === userEmail && !isVibeEvent(ev)
    ).length;

    const eventsAttendingCount = events.filter((ev) => {
      if (normalizeEmail(ev.host_email) === userEmail) return false;
      if (isVibeEvent(ev)) return false;
      if (!isFuture(ev)) return false;
      return hasQualifyingRsvp(getMyRsvpRows(rsvps, ev.id, userEmail));
    }).length;

    const pendingInviteCount = actionNeeded.filter((ev) => !isVibeEvent(ev)).length;
    const coordinatingPlanCount =
      coordinatingSorted.length + actionNeeded.filter((ev) => isVibeEvent(ev)).length;

    return {
      actionNeeded,
      upcoming: upcomingSorted,
      coordinating: coordinatingSorted,
      past: pastSorted,
      eventsCreatedCount,
      eventsAttendingCount,
      pendingInviteCount,
      coordinatingPlanCount,
      coldStart:
        actionNeeded.length === 0 &&
        upcomingSorted.length === 0 &&
        coordinatingSorted.length === 0 &&
        pastSorted.length === 0,
    };
  }, [events, invites, rsvps, userEmail]);

  async function handlePickWinner(date: string) {
    if (!selectedIdea?.manage_handle) {
      Alert.alert('Error', 'Missing manage token for this event.');
      return;
    }

    setIsFinalizingWinner(true);

    try {
      const winnerDate = new Date(date);

      if (Number.isNaN(winnerDate.getTime())) {
        throw new Error('Invalid winning date');
      }

      const { error } = await supabase.rpc('finalize_vibe_by_manage_token', {
        p_manage_token: selectedIdea.manage_handle,
        p_winning_starts_at: winnerDate.toISOString(),
      });

      if (error) throw error;

      setInsightModal(false);
      setSelectedIdea(null);
      await fetchEventsData();

      router.push(`/m/${selectedIdea.manage_handle}` as any);
    } catch (err) {
      Alert.alert('Error', 'Could not finalize this poll.');
    } finally {
      setIsFinalizingWinner(false);
    }
  }

  const renderInsights = () => {
    if (!selectedIdea) return null;

    const tallies: Record<string, number> = {};
    (selectedIdea.proposed_dates || []).forEach((d: string) => {
      tallies[d] = 0;
    });

    (selectedIdea.responses || []).forEach((r: any) => {
      (r.selected_dates || []).forEach((d: string) => {
        tallies[d] = (tallies[d] || 0) + 1;
      });
    });

    return (
      <Modal visible={insightModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <StyledText style={styles.modalTitle}>Poll Results</StyledText>
              <TouchableOpacity
                onPress={() => {
                  if (!isFinalizingWinner) setInsightModal(false);
                }}
              >
                <Ionicons name="close-circle" size={32} color="#6A4C93" />
              </TouchableOpacity>
            </View>

            <ScrollView>
              {Object.entries(tallies).map(([date, count]) => (
                <View key={date} style={styles.tallyRow}>
                  <View style={styles.tallyInfo}>
                    <StyledText style={styles.tallyDate}>{formatDate(date)}</StyledText>
                    <TouchableOpacity
                      style={[
                        styles.pickWinnerBtn,
                        isFinalizingWinner && styles.disabledBtn,
                      ]}
                      disabled={isFinalizingWinner}
                      onPress={() => handlePickWinner(date)}
                    >
                      {isFinalizingWinner ? (
                        <ActivityIndicator color="#fff" size="small" />
                      ) : (
                        <StyledText style={styles.pickWinnerText}>Pick Winner</StyledText>
                      )}
                    </TouchableOpacity>
                  </View>

                  <View style={styles.tallyBarContainer}>
                    <View
                      style={[
                        styles.tallyBar,
                        {
                          width: `${Math.max(
                            (count / ((selectedIdea.responses || []).length || 1)) * 100,
                            5
                          )}%`,
                        },
                      ]}
                    />
                    <StyledText style={styles.tallyCountText}>{count} votes</StyledText>
                  </View>
                </View>
              ))}

              {!Object.keys(tallies).length && (
                <View style={styles.noVotesBlock}>
                  <StyledText style={styles.noVotesText}>
                    No votes yet for this poll.
                  </StyledText>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    );
  };

  if (loading && !events.length) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color="#43691b" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={fetchEventsData} />
        }
      >
        <View style={styles.topHeader}>
          <StyledText style={styles.topTitle}>Events</StyledText>
          <StyledText style={styles.topSubtitle}>
            Your plans, votes, and history.
          </StyledText>
        </View>

        <View style={styles.summaryRow}>
          <SummaryStat label="Created" value={derived.eventsCreatedCount} />
          <SummaryStat label="Attending" value={derived.eventsAttendingCount} />
          <SummaryStat label="Pending" value={derived.pendingInviteCount} />
          <SummaryStat label="In Planning" value={derived.coordinatingPlanCount} />
        </View>

        {derived.coldStart && (
          <View style={styles.emptyState}>
            <Ionicons name="calendar-clear-outline" size={32} color="#43691b" />
            <StyledText style={styles.emptyStateTitle}>No events yet</StyledText>
            <StyledText style={styles.emptyStateText}>
              When you create a plan or get invited to one, it will appear here.
            </StyledText>
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={() => router.push('/create')}
            >
              <StyledText style={styles.primaryButtonText}>Start a plan</StyledText>
            </TouchableOpacity>
          </View>
        )}

        <Section
          title="Action Needed"
          count={derived.actionNeeded.length}
          icon="alert-circle-outline"
        >
          {derived.actionNeeded.map((item) => {
            if (isVibeEvent(item)) {
              return (
                <CoordinatingPlanCard
                  key={String(item.id)}
                  item={item}
                  currentUserEmail={userEmail}
                  onHostOpenResults={(idea) => {
                    setSelectedIdea(idea);
                    setInsightModal(true);
                  }}
                />
              );
            }

            return (
              <FormalEventCard
                key={String(item.id)}
                item={item}
                currentUserEmail={userEmail}
                variant="action"
                rsvps={rsvps}
                avatarByEmail={avatarByEmail}
                onPress={() => router.push(`/event/${item.slug}/details`)}
                lang={language}
                labels={cardLabels}
              />
            );
          })}
        </Section>

                <Section title="Upcoming" count={derived.upcoming.length} icon="calendar-outline">
          {derived.upcoming.map((item) => (
            <FormalEventCard
              key={String(item.id)}
              item={item}
              currentUserEmail={userEmail}
              variant="upcoming"
              rsvps={rsvps}
              avatarByEmail={avatarByEmail}
              unreadMessages={0}
              onPress={() => router.push(`/event/${item.slug}/details`)}
              lang={language}
              labels={cardLabels}
            />
          ))}
        </Section>
        <Section
          title="Plans Under construction"
          count={derived.coordinating.length}
          icon="git-merge-outline"
        >
          {derived.coordinating.map((item) => (
            <CoordinatingPlanCard
              key={String(item.id)}
              item={item}
              currentUserEmail={userEmail}
              onHostOpenResults={(idea) => {
                setSelectedIdea(idea);
                setInsightModal(true);
              }}
            />
          ))}
        </Section>

        <Section title="Past" count={derived.past.length} icon="time-outline">
          {derived.past.map((item) => (
            <FormalEventCard
              key={String(item.id)}
              item={item}
              currentUserEmail={userEmail}
              variant="past"
              rsvps={rsvps}
              avatarByEmail={avatarByEmail}
              onPress={() => router.push(`/event/${item.slug}/details`)}
              lang={language}
              labels={cardLabels}
            />
          ))}
        </Section>
      </ScrollView>

      {renderInsights()}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F6F7F9' },
  scrollContent: { paddingBottom: 32 },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F6F7F9',
  },

  topHeader: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },
  topTitle: {
    fontSize: 28,
    fontWeight: '900',
    color: '#1f2a1b',
    letterSpacing: -0.4,
  },
  topSubtitle: {
    marginTop: 4,
    fontSize: 13,
    color: '#66715f',
  },

  summaryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    paddingHorizontal: 16,
    marginTop: 10,
  },
  summaryCard: {
    flexGrow: 1,
    minWidth: '22%',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: '#bac9ad',
  },
  summaryValue: { fontSize: 20, fontWeight: '900', color: '#43691b' },
  summaryLabel: { marginTop: 4, fontSize: 12, fontWeight: '700', color: '#66715f' },

  section: {
    paddingHorizontal: 16,
    marginTop: 24,
  },
  sectionHeader: {
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionTitle: { fontSize: 20, fontWeight: '900', color: '#1f2a1b' },
  sectionCount: {
    minWidth: 30,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#bac9ad',
    alignItems: 'center',
  },
  sectionCountText: { fontSize: 12, fontWeight: '900', color: '#1f2a1b' },

  cardWrapper: { marginBottom: 16 },

  coordinatingCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    borderWidth: 2,
    borderColor: '#bac9ad',
    borderStyle: 'dashed',
    padding: 16,
    marginBottom: 14,
  },
  coordinatingTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  coordinatingBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: '#bac9ad',
  },
  coordinatingBadgeText: {
    fontSize: 11,
    fontWeight: '900',
  },
  coordinatingTitle: {
    marginTop: 12,
    fontSize: 20,
    fontWeight: '900',
    color: '#1f2a1b',
  },

  metaRow: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaText: {
    flex: 1,
    fontSize: 14,
    color: '#66715f',
  },

  coordinatingCta: {
    marginTop: 14,
    backgroundColor: '#43691b',
    borderRadius: 12,
    paddingVertical: 11,
    alignItems: 'center',
  },
  coordinatingCtaText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '900',
  },

  emptyState: {
    marginHorizontal: 16,
    marginTop: 24,
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#bac9ad',
    padding: 24,
    alignItems: 'center',
  },
  emptyStateTitle: {
    marginTop: 10,
    fontSize: 20,
    fontWeight: '900',
    color: '#1f2a1b',
  },
  emptyStateText: {
    marginTop: 8,
    textAlign: 'center',
    color: '#66715f',
    fontSize: 14,
    lineHeight: 20,
  },
  primaryButton: {
    marginTop: 16,
    backgroundColor: '#43691b',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 14,
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(31, 42, 27, 0.35)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    padding: 25,
    maxHeight: '80%',
    borderTopWidth: 1,
    borderColor: '#bac9ad',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 25,
  },
  modalTitle: { fontSize: 24, fontWeight: '900', color: '#1f2a1b' },
  tallyRow: { marginBottom: 20 },
  tallyInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    gap: 12,
  },
  tallyDate: { fontSize: 15, fontWeight: '700', color: '#1f2a1b', flex: 1 },
  pickWinnerBtn: {
    backgroundColor: '#43691b',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    minWidth: 110,
    alignItems: 'center',
  },
  pickWinnerText: { color: '#FFFFFF', fontSize: 11, fontWeight: '900' },
  tallyBarContainer: {
    height: 24,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#bac9ad',
  },
  tallyBar: { height: '100%', backgroundColor: '#43691b' },
  tallyCountText: {
    position: 'absolute',
    right: 10,
    fontSize: 11,
    fontWeight: '800',
    color: '#66715f',
  },
  noVotesBlock: {
    paddingVertical: 24,
    alignItems: 'center',
  },
  noVotesText: {
    color: '#66715f',
    fontSize: 14,
    fontWeight: '600',
  },
  disabledBtn: { opacity: 0.5 },
});