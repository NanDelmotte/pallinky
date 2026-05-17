/**
 * Path: app/event/[slug]/guest-poll.tsx
 * Description: Guest poll page with Table + Calendar views over the same poll data.
 * - guests can vote on dates
 * - guests can add a note
 * - guests can see live poll results in a participant/date matrix
 * - guests can DM host and voters from avatars/chips
 * - host is redirected to the host poll page
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  Alert,
  TextInput,
  StatusBar,
  Image,
  Text,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { supabase, useSession } from '@pallinky/core';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

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
};

const PALETTES: Record<
  string,
  { bg: string; accent: string; text: string; textMuted: string; isDark: boolean }
> = {
  submerged: {
    bg: '#F6F7F9',
    accent: '#6A4C93',
    text: '#1f2a1b',
    textMuted: '#66715f',
    isDark: false,
  },
  zen: {
    bg: '#F6F7F9',
    accent: '#43691b',
    text: '#1f2a1b',
    textMuted: '#66715f',
    isDark: false,
  },
  girly: {
    bg: '#f4bbd3',
    accent: '#fe5d9f',
    text: '#2b1f24',
    textMuted: '#6f4b58',
    isDark: false,
  },
  fiesta: {
    bg: '#1729ae',
    accent: '#fe20e8',
    text: '#ffffff',
    textMuted: 'rgba(255,255,255,0.75)',
    isDark: true,
  },
  classy: {
    bg: '#03172f',
    accent: '#efd466',
    text: '#fff7b6',
    textMuted: 'rgba(255,247,182,0.72)',
    isDark: true,
  },
  spicy: {
    bg: '#656c12',
    accent: '#ecc216',
    text: '#ffffff',
    textMuted: 'rgba(255,255,255,0.75)',
    isDark: true,
  },
};

const FONT_MAP: Record<string, string> = {
  Sans: Platform.OS === 'ios' ? 'Arial-BoldMT' : 'sans-serif-condensed',
  Serif: Platform.OS === 'ios' ? 'Times New Roman' : 'serif',
  Cursive: Platform.OS === 'ios' ? 'SnellRoundhand-Bold' : 'cursive',
  Gothic: Platform.OS === 'ios' ? 'Copperplate-Bold' : 'monospace',
};

const NAME_CELL_WIDTH = 150;

const FIXED_NAME_COLUMN = {
  width: NAME_CELL_WIDTH,
  minWidth: NAME_CELL_WIDTH,
  maxWidth: NAME_CELL_WIDTH,
} as const;
const DATE_CELL_WIDTH = 78;
const ROW_HEIGHT = 68;
const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

type VoteRow = {
  id?: string;
  guest_name?: string | null;
  user_email?: string | null;
  selected_dates?: string[] | null;
  note?: string | null;
};

type PersonLite = {
  email: string;
  label: string;
  avatar_url: string | null;
};

type PollColumn = {
  iso: string;
  count: number;
  isLeading: boolean;
};

type PollParticipant = {
  email: string;
  label: string;
  avatar_url: string | null;
  isHost: boolean;
  hasVoted: boolean;
  selectedDates: string[];
  note: string | null;
};

type CalendarCell =
  | {
      type: 'empty';
      key: string;
    }
  | {
      type: 'date';
      key: string;
      column: PollColumn;
      dayNumber: number;
      isToday: boolean;
      isSelectedByViewer: boolean;
      voterCount: number;
    };

type CalendarMonthGroup = {
  monthKey: string;
  monthLabel: string;
  cells: CalendarCell[];
};

function normalizeEmail(value: string | null | undefined) {
  return value?.toLowerCase().trim() || '';
}

function getFirstName(value: string | null | undefined) {
  return (value || '').trim().split(' ')[0] || 'Guest';
}

function formatFriendlyDate(isoString: string) {
  const date = new Date(isoString);
  return date.toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDateCellTop(isoString: string) {
  const date = new Date(isoString);
  return date.toLocaleDateString(undefined, {
    weekday: 'short',
  });
}

function formatDateCellBottom(isoString: string) {
  const date = new Date(isoString);
  return date.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
  });
}

function formatMonthLabel(year: number, monthIndex: number) {
  return new Date(year, monthIndex, 1).toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
  });
}

function initialsFromName(value: string | null | undefined) {
  const parts = (value || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'G';
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return `${parts[0].charAt(0)}${parts[1].charAt(0)}`.toUpperCase();
}

function sameLocalDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function buildCalendarMonthGroups(columns: PollColumn[], viewerSelectedDates: string[]) {
  const byMonth: Record<string, PollColumn[]> = {};

  columns.forEach((column) => {
    const date = new Date(column.iso);
    const key = `${date.getFullYear()}-${date.getMonth()}`;
    if (!byMonth[key]) byMonth[key] = [];
    byMonth[key].push(column);
  });

  const today = new Date();

  return Object.entries(byMonth)
    .sort(([a], [b]) => {
      const [aYear, aMonth] = a.split('-').map(Number);
      const [bYear, bMonth] = b.split('-').map(Number);
      return new Date(aYear, aMonth, 1).getTime() - new Date(bYear, bMonth, 1).getTime();
    })
    .map(([monthKey, monthColumns]) => {
      const firstPollDate = new Date(monthColumns[0].iso);
      const year = firstPollDate.getFullYear();
      const monthIndex = firstPollDate.getMonth();

      const firstOfMonth = new Date(year, monthIndex, 1);
      const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
      const mondayIndex = (firstOfMonth.getDay() + 6) % 7;

      const columnByDay = new Map<number, PollColumn>();
      monthColumns.forEach((column) => {
        const dayNumber = new Date(column.iso).getDate();
        columnByDay.set(dayNumber, column);
      });

      const cells: CalendarCell[] = [];

      for (let i = 0; i < mondayIndex; i += 1) {
        cells.push({ type: 'empty', key: `${monthKey}-empty-start-${i}` });
      }

      for (let day = 1; day <= daysInMonth; day += 1) {
        const column = columnByDay.get(day);

        if (!column) {
          cells.push({ type: 'empty', key: `${monthKey}-day-${day}-empty` });
          continue;
        }

        const date = new Date(column.iso);

        cells.push({
          type: 'date',
          key: column.iso,
          column,
          dayNumber: day,
          isToday: sameLocalDay(date, today),
          isSelectedByViewer: viewerSelectedDates.includes(column.iso),
          voterCount: column.count,
        });
      }

      while (cells.length % 7 !== 0) {
        cells.push({ type: 'empty', key: `${monthKey}-empty-end-${cells.length}` });
      }

      return {
        monthKey,
        monthLabel: formatMonthLabel(year, monthIndex),
        cells,
      } as CalendarMonthGroup;
    });
}

function Avatar({
  uri,
  label,
  size,
}: {
  uri: string | null;
  label: string;
  size: number;
}) {
  if (uri) {
    return (
      <Image
        source={{ uri }}
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: SYSTEM.surface,
        }}
      />
    );
  }

  return (
    <View
      style={[
        styles.avatarFallback,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
        },
      ]}
    >
      <Text style={[styles.avatarFallbackText, { fontSize: size * 0.36 }]}>
        {initialsFromName(label)}
      </Text>
    </View>
  );
}

export default function GuestPollPage() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const router = useRouter();
  const { userEmail, loading: sessionLoading } = useSession();

  const [event, setEvent] = useState<any>(null);
  const [allVotes, setAllVotes] = useState<VoteRow[]>([]);
  const [invitees, setInvitees] = useState<PersonLite[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [selectedDates, setSelectedDates] = useState<string[]>([]);
const [notThisTime, setNotThisTime] = useState(false);
const [note, setNote] = useState('');
  const [hasPendingRequest, setHasPendingRequest] = useState(false);
  const [profileNamesByEmail, setProfileNamesByEmail] = useState<Record<string, string>>({});
  const [profileAvatarsByEmail, setProfileAvatarsByEmail] = useState<Record<string, string>>({});
  const [openingDmForEmail, setOpeningDmForEmail] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'table' | 'calendar'>('table');
  

  const nameColumnScrollRef = useRef<ScrollView | null>(null);
const gridScrollRef = useRef<ScrollView | null>(null);
const headerHorizontalScrollRef = useRef<ScrollView | null>(null);
const gridHorizontalScrollRef = useRef<ScrollView | null>(null);
const syncingNameScrollRef = useRef(false);
const syncingGridScrollRef = useRef(false);
const syncingHeaderHorizontalRef = useRef(false);
const syncingGridHorizontalRef = useRef(false);

  const themeKey = event?.gif_key && PALETTES[event.gif_key] ? event.gif_key : 'submerged';
  const theme = PALETTES[themeKey];
  const cleanViewerEmail = normalizeEmail(userEmail);
  const hostEmail = normalizeEmail(event?.host_email);

  const customFont = useMemo(
    () => ({
      fontFamily:
        FONT_MAP[event?.font_family] || (Platform.OS === 'ios' ? 'Arial-BoldMT' : 'sans-serif'),
    }),
    [event?.font_family]
  );

  const requiresApproval =
    event?.forwarding_mode === 'approval_required' ||
    event?.forwarding_mode === 'host_approval';

  const canDmTarget = useCallback(
    (targetEmail: string | null | undefined) => {
      const target = normalizeEmail(targetEmail);
      if (!cleanViewerEmail || !target) return false;
      if (target === cleanViewerEmail) return false;
      return true;
    },
    [cleanViewerEmail]
  );

  const handleGridVerticalScroll = useCallback((y: number) => {
    if (syncingNameScrollRef.current) {
      syncingNameScrollRef.current = false;
      return;
    }
    syncingGridScrollRef.current = true;
    nameColumnScrollRef.current?.scrollTo({ y, animated: false });
  }, []);

  const handleNameVerticalScroll = useCallback((y: number) => {
    if (syncingGridScrollRef.current) {
      syncingGridScrollRef.current = false;
      return;
    }
    syncingNameScrollRef.current = true;
    gridScrollRef.current?.scrollTo({ y, animated: false });
  }, []);

  const handleOpenOrCreateDm = useCallback(
    async (targetEmail: string | null | undefined) => {
      const target = normalizeEmail(targetEmail);

      if (!event?.id || !slug || !cleanViewerEmail || !target) return;
      if (target === cleanViewerEmail) return;

      try {
        setOpeningDmForEmail(target);

        const { data, error } = await supabase.rpc('get_or_create_event_dm_thread', {
          p_event_id: event.id,
          p_user_email: cleanViewerEmail,
          p_other_email: target,
        });

        if (error) {
          const message = String(error.message || '');

          if (
            message.includes('recipient_cannot_see_event') ||
            message.includes('sender_cannot_see_event')
          ) {
            Alert.alert('Unable to message this person');
            return;
          }

          if (message.includes('cannot_dm_self')) return;

          throw error;
        }

        if (!data) throw new Error('Missing thread id');

        router.push({
          pathname: '/event/[slug]/dm/[thread_id]',
          params: {
            slug,
            thread_id: String(data),
          },
        } as any);
      } catch (err: any) {
        const message = String(err?.message || '');

        if (message.includes('blocked_user_interaction')) {
          Alert.alert(
            'Messaging unavailable',
            'You can no longer message this user.'
          );
          return;
        }

        console.log('Unable to open message', err);
        Alert.alert('Unable to open message');
      } finally {
        setOpeningDmForEmail(null);
      }
    },
    [event?.id, slug, cleanViewerEmail, router]
  );

  const loadData = useCallback(async () => {
    try {
      const { data: eventData, error: eventError } = await supabase
        .from('events')
        .select('*')
        .eq('slug', slug)
        .single();

      if (eventError) throw eventError;
      if (!eventData) return;

      const isHost = cleanViewerEmail && normalizeEmail(eventData.host_email) === cleanViewerEmail;

      if (isHost) {
        router.replace(`/event/${slug}/poll` as any);
        return;
      }

      setEvent(eventData);

      const [{ data: voteData, error: voteError }, { data: inviteData, error: inviteError }] =
        await Promise.all([
          supabase
            .from('vibe_responses')
            .select('id, guest_name, user_email, selected_dates, note')
            .eq('event_id', eventData.id),
          supabase
            .from('event_invites')
            .select('invitee_name, invitee_email_lc')
            .eq('event_id', eventData.id),
        ]);

      if (voteError) throw voteError;
      if (inviteError) throw inviteError;

      const votes = (voteData || []) as VoteRow[];
      setAllVotes(votes);

      const myVote = votes.find((v) => normalizeEmail(v.user_email) === cleanViewerEmail);

      if (myVote) {
  const nextSelectedDates = myVote.selected_dates || [];
  setSelectedDates(nextSelectedDates);
  setNotThisTime(nextSelectedDates.length === 0);
  setNote(myVote.note || '');
} else {
  setSelectedDates([]);
  setNotThisTime(false);
  setNote('');
}

      if (cleanViewerEmail) {
        const { data: pendingRequest } = await supabase
          .from('rsvp_join_requests')
          .select('id')
          .eq('event_id', eventData.id)
          .eq('requester_email', cleanViewerEmail)
          .maybeSingle();

        setHasPendingRequest(!!pendingRequest);
      } else {
        setHasPendingRequest(false);
      }

      const emailSet = new Set<string>();
      const nextHostEmail = normalizeEmail(eventData.host_email);

      if (nextHostEmail) emailSet.add(nextHostEmail);

      votes.forEach((vote) => {
        const email = normalizeEmail(vote.user_email);
        if (email) emailSet.add(email);
      });

      (inviteData || []).forEach((invite: any) => {
        const email = normalizeEmail(invite.invitee_email_lc);
        if (email) emailSet.add(email);
      });

      const emails = Array.from(emailSet);

      if (emails.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('email_lc, full_name, avatar_url')
          .in('email_lc', emails);

        const nameMap: Record<string, string> = {};
        const avatarMap: Record<string, string> = {};

        (profiles || []).forEach((p: any) => {
          const emailLc = normalizeEmail(p.email_lc);
          if (!emailLc) return;
          if (p.full_name) nameMap[emailLc] = p.full_name;
          if (p.avatar_url) avatarMap[emailLc] = p.avatar_url;
        });

        setProfileNamesByEmail(nameMap);
        setProfileAvatarsByEmail(avatarMap);

        const nextInvitees: PersonLite[] = (inviteData || [])
          .map((invite: any) => {
            const email = normalizeEmail(invite.invitee_email_lc);
            if (!email) return null;

            return {
              email,
              label: nameMap[email] || invite.invitee_name || email.split('@')[0] || 'Guest',
              avatar_url: avatarMap[email] || null,
            };
          })
          .filter(Boolean) as PersonLite[];

        setInvitees(nextInvitees);
      } else {
        setProfileNamesByEmail({});
        setProfileAvatarsByEmail({});
        setInvitees([]);
      }
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'Could not load this poll.');
    } finally {
      setLoading(false);
    }
  }, [slug, cleanViewerEmail, router]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const voteMapByEmail = useMemo(() => {
    const map: Record<string, VoteRow> = {};

    allVotes.forEach((vote) => {
      const email = normalizeEmail(vote.user_email);
      if (!email) return;
      map[email] = vote;
    });

    return map;
  }, [allVotes]);

  const columns = useMemo<PollColumn[]>(() => {
    const proposedDates: string[] = Array.isArray(event?.proposed_dates) ? event.proposed_dates : [];
    const counts: Record<string, number> = {};

    proposedDates.forEach((iso) => {
      counts[iso] = 0;
    });

    allVotes.forEach((vote) => {
      (vote.selected_dates || []).forEach((iso) => {
        counts[iso] = (counts[iso] || 0) + 1;
      });
    });

    const maxCount = Math.max(0, ...Object.values(counts));

    return proposedDates.map((iso) => ({
      iso,
      count: counts[iso] || 0,
      isLeading: maxCount > 0 && (counts[iso] || 0) === maxCount,
    }));
  }, [event?.proposed_dates, allVotes]);

  const participants = useMemo<PollParticipant[]>(() => {
    const seen = new Set<string>();
    const rows: PollParticipant[] = [];

    const pushRow = ({
      email,
      fallbackLabel,
      avatar_url,
      isHost = false,
    }: {
      email: string;
      fallbackLabel: string;
      avatar_url: string | null;
      isHost?: boolean;
    }) => {
      const cleanEmail = normalizeEmail(email);
      if (!cleanEmail || seen.has(cleanEmail)) return;

      seen.add(cleanEmail);

      const vote = voteMapByEmail[cleanEmail];
      const label =
        profileNamesByEmail[cleanEmail] ||
        vote?.guest_name?.trim() ||
        fallbackLabel ||
        cleanEmail.split('@')[0] ||
        'Guest';

      rows.push({
        email: cleanEmail,
        label,
        avatar_url: avatar_url || profileAvatarsByEmail[cleanEmail] || null,
        isHost,
        hasVoted: !!vote && (vote.selected_dates || []).length > 0,
        selectedDates: vote?.selected_dates || [],
        note: vote?.note || null,
      });
    };

    if (hostEmail) {
      pushRow({
        email: hostEmail,
        fallbackLabel: event?.host_name || 'Host',
        avatar_url: profileAvatarsByEmail[hostEmail] || event?.host_avatar_url || null,
        isHost: true,
      });
    }

    if (cleanViewerEmail && cleanViewerEmail !== hostEmail) {
      const myVote = voteMapByEmail[cleanViewerEmail];
      const myInvite = invitees.find((person) => person.email === cleanViewerEmail);

      pushRow({
        email: cleanViewerEmail,
        fallbackLabel:
          profileNamesByEmail[cleanViewerEmail] ||
          myVote?.guest_name ||
          myInvite?.label ||
          cleanViewerEmail.split('@')[0] ||
          'You',
        avatar_url: profileAvatarsByEmail[cleanViewerEmail] || myInvite?.avatar_url || null,
      });
    }

    const voterRows = allVotes
      .map((vote) => {
        const email = normalizeEmail(vote.user_email);
        if (!email || email === hostEmail || email === cleanViewerEmail) return null;

        return {
          email,
          fallbackLabel: vote.guest_name?.trim() || email.split('@')[0] || 'Guest',
          avatar_url: profileAvatarsByEmail[email] || null,
        };
      })
      .filter(Boolean) as Array<{ email: string; fallbackLabel: string; avatar_url: string | null }>;

    voterRows
      .sort((a, b) => a.fallbackLabel.localeCompare(b.fallbackLabel))
      .forEach((row) => pushRow(row));

    invitees
      .filter((person) => person.email !== hostEmail && person.email !== cleanViewerEmail)
      .sort((a, b) => a.label.localeCompare(b.label))
      .forEach((person) =>
        pushRow({
          email: person.email,
          fallbackLabel: person.label,
          avatar_url: person.avatar_url,
        })
      );

    return rows;
  }, [
    allVotes,
    cleanViewerEmail,
    event?.host_avatar_url,
    event?.host_name,
    hostEmail,
    invitees,
    profileAvatarsByEmail,
    profileNamesByEmail,
    voteMapByEmail,
  ]);

  const notVoted = useMemo(() => {
    return participants
      .filter((person) => !person.isHost && !person.hasVoted)
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [participants]);

  const calendarGroups = useMemo(
    () => buildCalendarMonthGroups(columns, selectedDates),
    [columns, selectedDates]
  );

  const myVoteCount = selectedDates.length;

  const toggleDate = useCallback(
    (dateIso: string) => {
      if (hasPendingRequest) return;

      setNotThisTime(false);

setSelectedDates((prev) =>
  prev.includes(dateIso) ? prev.filter((d) => d !== dateIso) : [...prev, dateIso]
);
    },
    [hasPendingRequest]
  );

  const handleVote = async () => {
    if (!userEmail) {
      router.push(`/auth?slug=${slug}` as any);
      return;
    }

    if (hasPendingRequest) return;

 

    setSubmitting(true);

    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('email_lc', cleanViewerEmail)
        .maybeSingle();

      const guestName = profile?.full_name?.trim() || null;

      const { data, error } = await supabase.rpc('submit_vibe_rsvp', {
        p_slug: slug,
        p_user_email: cleanViewerEmail,
        p_guest_name: guestName,
        p_selected_dates: notThisTime ? [] : selectedDates,
p_note: note.trim() || null,
p_status: notThisTime ? 'no' : 'interested',
      });

      if (error) throw error;

      if ((data as any)?.deadline_passed) {
        return Alert.alert(
          'RSVP closed',
          'The RSVP deadline has passed, so responses are now closed.'
        );
      }

      if ((data as any)?.error) throw new Error((data as any).error);

      const pendingApproval = (data as any)?.pending_approval === true;
      if (pendingApproval) {
        setHasPendingRequest(true);
      }

      await loadData();

      router.push({
        pathname: `/event/${slug}/thanks` as any,
        params: {
          theme: themeKey,
        },
      });
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Could not save vote');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || sessionLoading || !event) {
    return (
      <ActivityIndicator
        color={theme?.accent || SYSTEM.primary}
        style={{ flex: 1, backgroundColor: theme?.bg || SYSTEM.background }}
      />
    );
  }

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.bg }]}>
      <StatusBar barStyle={theme.isDark ? 'light-content' : 'dark-content'} />
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 24 : 0}
      >
        <View style={styles.headerBar}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={[
              styles.backBtn,
              {
                backgroundColor: theme.isDark ? 'rgba(255,255,255,0.1)' : SYSTEM.surface,
                borderColor: theme.isDark ? 'rgba(255,255,255,0.12)' : SYSTEM.borderSoft,
              },
            ]}
          >
            <Ionicons name="arrow-back" size={20} color={theme.text} />
          </TouchableOpacity>
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
        >
          {event.cover_image_url ? (
            <View style={styles.coverContainer}>
              <Image source={{ uri: event.cover_image_url }} style={styles.coverImage} />
              <View style={styles.vibeBadge}>
                <MaterialCommunityIcons name="calendar-question" size={16} color="#fff" />
                <Text style={styles.vibeBadgeText}>POLL</Text>
              </View>
            </View>
          ) : null}

          <View style={styles.headerSection}>
            <View style={styles.headerTopRow}>
              <View style={styles.headerTitleWrap}>
                <View style={styles.row}>
                  <MaterialCommunityIcons
                    name="waves"
                    size={20}
                    color={theme.accent}
                    style={{ marginRight: 6 }}
                  />
                  <Text style={[styles.hostLabel, { color: theme.accent }, customFont]}>
                    {event.host_name}&apos;s Poll
                  </Text>
                </View>

                <Text style={[styles.title, { color: theme.text }, customFont]}>{event.title}</Text>
              </View>

              <TouchableOpacity
                style={styles.hostAvatarWrap}
                disabled={!canDmTarget(event.host_email) || openingDmForEmail === hostEmail}
                onPress={() => handleOpenOrCreateDm(event.host_email)}
              >
                <Avatar
                  uri={profileAvatarsByEmail[hostEmail] || event?.host_avatar_url || null}
                  label={event.host_name || 'Host'}
                  size={44}
                />

                {canDmTarget(event.host_email) ? (
                  <View style={[styles.hostAvatarBadge, { backgroundColor: theme.accent }]}>
                    {openingDmForEmail === hostEmail ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <MaterialCommunityIcons name="message-text-outline" size={10} color="#fff" />
                    )}
                  </View>
                ) : null}
              </TouchableOpacity>
            </View>

            {event.description ? (
              <Text style={[styles.desc, { color: theme.text, opacity: 0.82 }, customFont]}>
                {event.description}
              </Text>
            ) : null}

            <Text style={[styles.voteSummary, { color: theme.textMuted }]}>
              {myVoteCount > 0
                ? `You selected ${myVoteCount} date${myVoteCount === 1 ? '' : 's'}`
                : 'Select the dates that work for you'}
            </Text>

            <View
              style={[
                styles.summaryStrip,
                {
                  backgroundColor: theme.isDark ? 'rgba(255,255,255,0.08)' : SYSTEM.surface,
                  borderColor: theme.isDark ? 'rgba(255,255,255,0.12)' : SYSTEM.borderSoft,
                },
              ]}
            >
              <View style={styles.summaryPill}>
                <Text style={[styles.summaryValue, { color: theme.text }]}>{columns.length}</Text>
                <Text style={styles.summaryLabel}>dates</Text>
              </View>
              <View style={styles.summaryDivider} />
              <View style={styles.summaryPill}>
                <Text style={[styles.summaryValue, { color: theme.text }]}>
                  {participants.filter((p) => p.hasVoted).length}
                </Text>
                <Text style={styles.summaryLabel}>voted</Text>
              </View>
              <View style={styles.summaryDivider} />
              <View style={styles.summaryPill}>
                <Text style={[styles.summaryValue, { color: theme.text }]}>{notVoted.length}</Text>
                <Text style={styles.summaryLabel}>waiting</Text>
              </View>
            </View>
          </View>

          <View
            style={[
              styles.tabsWrap,
              {
                backgroundColor: theme.isDark ? 'rgba(255,255,255,0.08)' : SYSTEM.surface,
                borderColor: theme.isDark ? 'rgba(255,255,255,0.10)' : SYSTEM.borderSoft,
              },
            ]}
          >



          </View>

          {viewMode === 'table' ? (
            <View style={styles.section}>
              <Text style={[styles.sectionLabel, { color: theme.text, opacity: 0.62 }, customFont]}>
                Availability table
              </Text>

              <View
                style={[
                  styles.tableCard,
                  {
                    backgroundColor: theme.isDark ? 'rgba(255,255,255,0.06)' : SYSTEM.surface,
                    borderColor: theme.isDark ? 'rgba(255,255,255,0.10)' : SYSTEM.borderSoft,
                  },
                ]}
              >
                <View
  style={[
    styles.tableHeaderRow,
    {
      borderBottomColor: theme.isDark ? 'rgba(255,255,255,0.10)' : SYSTEM.borderSoft,
    },
  ]}
>
  <View
  style={[
    styles.matrixNameHeaderCell,
    FIXED_NAME_COLUMN,
    {
      borderRightColor: theme.isDark
        ? 'rgba(255,255,255,0.10)'
        : SYSTEM.borderSoft,
    },
  ]}
>
    <Text style={[styles.matrixNameHeaderText, { color: theme.textMuted }]}>
      People
    </Text>
  </View>

  <ScrollView
  ref={headerHorizontalScrollRef}
  horizontal
  showsHorizontalScrollIndicator={false}
  scrollEventThrottle={16}
  onScroll={(event) => {
    if (syncingHeaderHorizontalRef.current) {
      syncingHeaderHorizontalRef.current = false;
      return;
    }

    const x = event.nativeEvent.contentOffset.x;
    syncingGridHorizontalRef.current = true;
    gridHorizontalScrollRef.current?.scrollTo({ x, animated: false });
  }}
>
    <View style={styles.matrixHeaderDatesRow}>
      {columns.map((column) => {
        const isSelectedByViewer = selectedDates.includes(column.iso);

        return (
          <TouchableOpacity
            key={`header-${column.iso}`}
            style={[
              styles.matrixDateHeaderCell,
              {
                width: DATE_CELL_WIDTH,
                borderRightColor: theme.isDark
                  ? 'rgba(255,255,255,0.10)'
                  : SYSTEM.borderSoft,
                backgroundColor: isSelectedByViewer
                  ? `${theme.accent}16`
                  : column.isLeading
                  ? `${theme.accent}12`
                  : 'transparent',
              },
            ]}
            disabled={hasPendingRequest}
            onPress={() => toggleDate(column.iso)}
          >
            <Text style={[styles.matrixDateTop, { color: theme.textMuted }]}>
              {formatDateCellTop(column.iso)}
            </Text>
            <Text style={[styles.matrixDateBottom, { color: theme.text }]}>
              {formatDateCellBottom(column.iso)}
            </Text>

            {isSelectedByViewer ? (
              <View
                style={[
                  styles.matrixSelectedDot,
                  {
                    width: 22,
                    height: 22,
                    borderRadius: 11,
                    backgroundColor: theme.accent,
                    marginTop: 2,
                  },
                ]}
              >
                <Ionicons name="checkmark" size={12} color="#fff" />
              </View>
            ) : (
              <View
                style={[
                  styles.matrixCountPill,
                  {
                    backgroundColor: column.isLeading
                      ? `${theme.accent}20`
                      : theme.isDark
                      ? 'rgba(255,255,255,0.08)'
                      : '#f2f4f1',
                  },
                ]}
              >
                <Text
                  style={[
                    styles.matrixCountPillText,
                    { color: column.isLeading ? theme.accent : theme.textMuted },
                  ]}
                >
                  {column.count}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        );
      })}
    </View>
  </ScrollView>
</View>

<View style={styles.tableBodyWrap}>
  <ScrollView
  ref={nameColumnScrollRef}
  scrollEventThrottle={16}
  showsVerticalScrollIndicator={false}
  bounces={false}
  onScroll={(event) =>
    handleNameVerticalScroll(event.nativeEvent.contentOffset.y)
  }
  style={[
    styles.tableFrozenColumn,
    FIXED_NAME_COLUMN,
    {
      borderRightColor: theme.isDark
        ? 'rgba(255,255,255,0.10)'
        : SYSTEM.borderSoft,
    },
  ]}
>
    {participants.map((person) => {
      const isViewer = person.email === cleanViewerEmail;
      const busy = openingDmForEmail === person.email;
      const canDm = canDmTarget(person.email);

      return (
        <TouchableOpacity
  key={`name-${person.email}`}
  style={[
    styles.matrixNameCell,
    FIXED_NAME_COLUMN,
    {
      height: ROW_HEIGHT,
      backgroundColor: isViewer ? `${theme.accent}08` : 'transparent',
      borderBottomColor: theme.isDark
        ? 'rgba(255,255,255,0.10)'
        : SYSTEM.borderSoft,
    },
  ]}
          activeOpacity={canDm ? 0.82 : 1}
          disabled={!canDm || busy}
          onPress={() => handleOpenOrCreateDm(person.email)}
        >
          <Avatar uri={person.avatar_url} label={person.label} size={28} />

          <View style={styles.matrixNameTextWrap}>
            <Text
              numberOfLines={1}
              style={[styles.matrixNameText, { color: theme.text }]}
            >
              {getFirstName(person.label)}
            </Text>

            <Text
              numberOfLines={1}
              style={[styles.matrixMetaText, { color: theme.textMuted }]}
            >
              {person.isHost
                ? 'Host'
                : isViewer
                ? 'You'
                : person.hasVoted
                ? 'Voted'
                : 'Waiting'}
            </Text>
          </View>

          {canDm ? (
            busy ? (
              <ActivityIndicator size="small" color={theme.accent} />
            ) : (
              <MaterialCommunityIcons
                name="message-text-outline"
                size={14}
                color={theme.accent}
              />
            )
          ) : null}
        </TouchableOpacity>
      );
    })}
  </ScrollView>

  <ScrollView
  ref={gridHorizontalScrollRef}
  horizontal
  showsHorizontalScrollIndicator={false}
  scrollEventThrottle={16}
  onScroll={(event) => {
    if (syncingGridHorizontalRef.current) {
      syncingGridHorizontalRef.current = false;
      return;
    }

    const x = event.nativeEvent.contentOffset.x;
    syncingHeaderHorizontalRef.current = true;
    headerHorizontalScrollRef.current?.scrollTo({ x, animated: false });
  }}
>
    <ScrollView
      ref={gridScrollRef}
      scrollEventThrottle={16}
      showsVerticalScrollIndicator={false}
      bounces={false}
      onScroll={(event) =>
        handleGridVerticalScroll(event.nativeEvent.contentOffset.y)
      }
    >
      <View>
        {participants.map((person) => {
          const isViewer = person.email === cleanViewerEmail;

          return (
            <View
              key={`row-${person.email}`}
              style={[
                styles.matrixRow,
                {
                  height: ROW_HEIGHT,
                  backgroundColor: isViewer ? `${theme.accent}08` : 'transparent',
                  borderBottomColor: theme.isDark
                    ? 'rgba(255,255,255,0.10)'
                    : SYSTEM.borderSoft,
                },
              ]}
            >
              {columns.map((column) => {
                const rowSelected = isViewer
  ? selectedDates.includes(column.iso)
  : person.selectedDates.includes(column.iso);
                const viewerSelected = selectedDates.includes(column.iso);
                const isInteractive = isViewer && !hasPendingRequest;

                return (
                  <TouchableOpacity
                    key={`${person.email}-${column.iso}`}
                    style={[
                      styles.matrixCell,
                      {
                        width: DATE_CELL_WIDTH,
                        height: ROW_HEIGHT,
                        borderRightColor: theme.isDark
                          ? 'rgba(255,255,255,0.10)'
                          : SYSTEM.borderSoft,
                        backgroundColor: rowSelected
                          ? person.isHost
                            ? `${theme.accent}0f`
                            : `${theme.accent}16`
                          : viewerSelected && isViewer
                          ? `${theme.accent}08`
                          : 'transparent',
                      },
                    ]}
                    activeOpacity={isInteractive ? 0.82 : 1}
                    disabled={!isInteractive}
                    onPress={() => toggleDate(column.iso)}
                  >
                    {rowSelected ? (
                      <View
                        style={[
                          styles.matrixSelectedDot,
                          {
                            backgroundColor: person.isHost
                              ? theme.textMuted
                              : theme.accent,
                          },
                        ]}
                      >
                        <Ionicons name="checkmark" size={14} color="#fff" />
                      </View>
                    ) : isViewer ? (
                      <View
                        style={[
                          styles.matrixEmptyDot,
                          {
                            borderColor: viewerSelected
                              ? `${theme.accent}55`
                              : theme.isDark
                              ? 'rgba(255,255,255,0.22)'
                              : SYSTEM.border,
                          },
                        ]}
                      />
                    ) : (
                      <View
                        style={[
                          styles.matrixTinyDot,
                          {
                            backgroundColor: theme.isDark
                              ? 'rgba(255,255,255,0.10)'
                              : '#eef1ed',
                          },
                        ]}
                      />
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          );
        })}
      </View>
    </ScrollView>
  </ScrollView>
</View>
              </View>
            </View>
          ) : (
            <View style={styles.section}>
              <Text style={[styles.sectionLabel, { color: theme.text, opacity: 0.62 }, customFont]}>
                Calendar
              </Text>

              {calendarGroups.map((group) => (
                <View key={group.monthKey} style={styles.calendarMonthSection}>
                  <Text style={[styles.calendarMonthTitle, { color: theme.text }]}>
                    {group.monthLabel}
                  </Text>

                  <View style={styles.weekdayHeaderRow}>
                    {WEEKDAY_LABELS.map((label) => (
                      <View key={`${group.monthKey}-${label}`} style={styles.weekdayHeaderCell}>
                        <Text style={[styles.weekdayHeaderText, { color: theme.textMuted }]}>
                          {label}
                        </Text>
                      </View>
                    ))}
                  </View>

                  <View style={styles.calendarGrid}>
                    {group.cells.map((cell) => {
                      if (cell.type === 'empty') {
                        return <View key={cell.key} style={styles.calendarEmptyCell} />;
                      }

                      return (
                        <TouchableOpacity
  key={cell.key}
  style={styles.calendarDayTile}
                          activeOpacity={hasPendingRequest ? 1 : 0.86}
                          disabled={hasPendingRequest}
                          onPress={() => toggleDate(cell.column.iso)}
                        >
                          <View
  style={[
    styles.calendarDayInner,
    {
      backgroundColor: cell.isSelectedByViewer
        ? `${theme.accent}16`
        : theme.isDark
        ? 'rgba(255,255,255,0.06)'
        : SYSTEM.surface,
      borderColor: cell.isSelectedByViewer
        ? `${theme.accent}55`
        : cell.column.isLeading
        ? `${theme.accent}35`
        : theme.isDark
        ? 'rgba(255,255,255,0.10)'
        : SYSTEM.borderSoft,
    },
  ]}
>
  <View style={styles.calendarDayTopRow}>
    <Text
      style={[
        styles.calendarDayNumber,
        {
          color: cell.isToday ? theme.accent : theme.text,
        },
      ]}
    >
      {cell.dayNumber}
    </Text>

    {cell.isSelectedByViewer ? (
      <View
        style={[
          styles.calendarSelectedBadge,
          { backgroundColor: theme.accent },
        ]}
      >
        <Ionicons name="checkmark" size={12} color="#fff" />
      </View>
    ) : null}
  </View>

  <Text style={[styles.calendarVoteCount, { color: theme.text }]}>
    {cell.voterCount}
  </Text>
  <Text style={[styles.calendarVoteLabel, { color: theme.textMuted }]}>
    vote{cell.voterCount === 1 ? '' : 's'}
  </Text>


</View>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              ))}
            </View>
          )}

          {notVoted.length > 0 ? (
            <View style={styles.section}>
              <Text style={[styles.sectionLabel, { color: theme.text, opacity: 0.62 }, customFont]}>
                Still waiting
              </Text>

              <View style={styles.votersWrap}>
                {notVoted.map((person) => {
                  const busy = openingDmForEmail === person.email;
                  const canDm = canDmTarget(person.email);

                  return (
                    <TouchableOpacity
                      key={`not-voted-${person.email}`}
                      style={[
                        styles.voterChip,
                        {
                          backgroundColor: theme.isDark ? 'rgba(255,255,255,0.08)' : SYSTEM.surface,
                          borderColor: theme.isDark ? 'rgba(255,255,255,0.10)' : SYSTEM.borderSoft,
                          borderWidth: 1,
                        },
                      ]}
                      activeOpacity={canDm ? 0.82 : 1}
                      disabled={!canDm || busy}
                      onPress={() => handleOpenOrCreateDm(person.email)}
                    >
                      <Avatar uri={person.avatar_url} label={person.label} size={18} />

                      <Text style={[styles.voterChipText, { color: theme.textMuted }]}>
                        {getFirstName(person.label)}
                      </Text>

                      {canDm ? (
                        busy ? (
                          <ActivityIndicator size="small" color={theme.accent} />
                        ) : (
                          <MaterialCommunityIcons
                            name="message-text-outline"
                            size={13}
                            color={theme.accent}
                          />
                        )
                      ) : null}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          ) : null}
<TouchableOpacity
  style={[
    styles.notThisTimeCard,
    {
      borderColor: notThisTime ? theme.accent : theme.isDark ? 'rgba(255,255,255,0.10)' : SYSTEM.borderSoft,
      backgroundColor: notThisTime
        ? `${theme.accent}14`
        : theme.isDark
        ? 'rgba(255,255,255,0.06)'
        : SYSTEM.surface,
    },
  ]}
  onPress={() => {
    setNotThisTime((prev) => !prev);
    setSelectedDates([]);
  }}
  disabled={hasPendingRequest}
>
  <Ionicons
    name={notThisTime ? 'checkbox-outline' : 'square-outline'}
    size={22}
    color={notThisTime ? theme.accent : theme.textMuted}
  />
  <Text style={[styles.notThisTimeText, { color: theme.text }]}>Not this time</Text>
</TouchableOpacity>
          <View style={styles.noteSection}>
            <Text style={[styles.sectionLabel, { color: theme.text, opacity: 0.62 }, customFont]}>
              Optional note
            </Text>

            <TextInput
              style={[
                styles.noteInput,
                {
                  borderColor: theme.isDark ? `${theme.accent}33` : SYSTEM.border,
                  color: theme.text,
                  backgroundColor: theme.isDark ? 'rgba(255,255,255,0.05)' : SYSTEM.surface,
                  opacity: hasPendingRequest ? 0.65 : 1,
                },
              ]}
              placeholder="Add a note (optional)"
              placeholderTextColor={theme.text + '50'}
              multiline
              value={note}
              onChangeText={setNote}
              editable={!hasPendingRequest}
            />
          </View>

          <TouchableOpacity
            style={[
              styles.mainBtn,
              {
                backgroundColor: theme.accent,
                opacity: hasPendingRequest ? 0.6 : 1,
              },
            ]}
            onPress={handleVote}
            disabled={submitting || hasPendingRequest}
          >
            {submitting ? (
              <ActivityIndicator color={theme.bg} />
            ) : (
              <Text style={[styles.mainBtnText, { color: theme.bg }, customFont]}>
                {hasPendingRequest
                  ? 'Request Pending'
                  : allVotes.some((v) => normalizeEmail(v.user_email) === cleanViewerEmail)
                  ? 'Update vote'
                  : requiresApproval
                  ? 'Request to Join'
                  : 'Submit vote'}
              </Text>
            )}
          </TouchableOpacity>

          <View style={{ height: 100 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  container: { flex: 1 },

  headerBar: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 5,
  },

  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },

  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },

  coverContainer: {
    width: '100%',
    height: 220,
    borderRadius: 24,
    overflow: 'hidden',
    marginBottom: 22,
    position: 'relative',
  },

  coverImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },

  vibeBadge: {
    position: 'absolute',
    top: 15,
    right: 15,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
matrixNameHeaderCell: {
  justifyContent: 'center',
  paddingHorizontal: 12,
  minHeight: 86,
  borderRightWidth: 1,
  overflow: 'hidden',
  flexGrow: 0,
  flexShrink: 0,
},
  vibeBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1,
  },

  headerSection: {
    marginBottom: 18,
  },

  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
    marginBottom: 10,
  },

  headerTitleWrap: {
    flex: 1,
  },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },

  hostLabel: {
    fontSize: 13,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  title: {
    fontSize: 32,
    fontWeight: '900',
    marginBottom: 2,
  },

  desc: {
    fontSize: 17,
    lineHeight: 24,
    fontWeight: '500',
    marginBottom: 10,
  },

  voteSummary: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 12,
  },

  summaryStrip: {
    minHeight: 62,
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },

  summaryPill: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  summaryValue: {
    fontSize: 18,
    fontWeight: '900',
  },

  summaryLabel: {
    fontSize: 12,
    color: SYSTEM.textMuted,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.7,
    marginTop: 2,
  },

  summaryDivider: {
    width: 1,
    height: 28,
    backgroundColor: SYSTEM.borderSoft,
  },

  hostAvatarWrap: {
    width: 44,
    height: 44,
    position: 'relative',
  },

  hostAvatarBadge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },

  avatarFallback: {
    backgroundColor: '#f1efe8',
    borderWidth: 1,
    borderColor: SYSTEM.borderSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },

  avatarFallbackText: {
    fontWeight: '900',
    color: SYSTEM.text,
  },

  tabsWrap: {
    minHeight: 50,
    borderRadius: 16,
    borderWidth: 1,
    padding: 4,
    marginBottom: 18,
    flexDirection: 'row',
    gap: 6,
  },

  tabBtn: {
    flex: 1,
    minHeight: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },

  tabBtnText: {
    fontSize: 14,
    fontWeight: '800',
  },

  section: {
    marginBottom: 22,
  },
calendarDayInner: {
  flex: 1,
  borderRadius: 14,
  borderWidth: 1,
  padding: 6,
  justifyContent: 'space-between',
},
calendarDayTopRow: {
  flexDirection: 'row',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
},

calendarDayNumber: {
  fontSize: 12,
  fontWeight: '900',
},
  sectionLabel: {
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    marginBottom: 10,
    letterSpacing: 1,
  },

  tableCard: {
    borderWidth: 1,
    borderRadius: 20,
    overflow: 'hidden',
  },

  tableHeaderRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
  },

  

  tableFrozenColumn: {
  borderRightWidth: 1,
  flexGrow: 0,
  flexShrink: 0,
},

  matrixHeaderDatesRow: {
    flexDirection: 'row',
  },

 

  matrixNameHeaderText: {
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },

  matrixDateHeaderCell: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    minHeight: 86,
    borderRightWidth: 1,
  },

  matrixDateTop: {
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 2,
    textTransform: 'uppercase',
  },

  matrixDateBottom: {
    fontSize: 12,
    fontWeight: '900',
    marginBottom: 7,
  },

  matrixCountPill: {
    minWidth: 28,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
    alignItems: 'center',
  },

  matrixCountPillText: {
    fontSize: 11,
    fontWeight: '900',
  },

  matrixRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
  },

 matrixNameCell: {
  paddingHorizontal: 10,
  flexDirection: 'row',
  alignItems: 'center',
  gap: 8,
  borderBottomWidth: 1,
  overflow: 'hidden',
  flexGrow: 0,
  flexShrink: 0,
},

  matrixNameTextWrap: {
    flex: 1,
    minWidth: 0,
  },

  matrixNameText: {
    fontSize: 13,
    fontWeight: '800',
  },

  matrixMetaText: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 1,
  },

  matrixCell: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRightWidth: 1,
  },

  matrixSelectedDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },

  matrixEmptyDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
  },

  matrixTinyDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },

  calendarMonthSection: {
    marginBottom: 20,
  },

  calendarMonthTitle: {
    fontSize: 18,
    fontWeight: '900',
    marginBottom: 10,
  },

  weekdayHeaderRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },

  weekdayHeaderCell: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 6,
  },

  weekdayHeaderText: {
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },

  calendarGrid: {
  flexDirection: 'row',
  flexWrap: 'wrap',
  marginHorizontal: -4,
},

calendarEmptyCell: {
  width: '14.2857%',
  aspectRatio: 1,
  paddingHorizontal: 4,
  paddingVertical: 4,
},

calendarDayTile: {
  width: '14.2857%',
  aspectRatio: 1,
  paddingHorizontal: 4,
  paddingVertical: 4,
},

calendarSelectedBadge: {
  width: 18,
  height: 18,
  borderRadius: 9,
  alignItems: 'center',
  justifyContent: 'center',
},
tableBodyWrap: {
  flexDirection: 'row',
  maxHeight: 420,
  alignItems: 'flex-start',
},


calendarVoteCount: {
  fontSize: 12,
  fontWeight: '900',
  textAlign: 'center',
},

calendarVoteLabel: {
  fontSize: 10,
  fontWeight: '700',
  textAlign: 'center',
},

calendarLeadingText: {
  fontSize: 10,
  fontWeight: '800',
  textAlign: 'center',
},

  votersWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },

  voterChip: {
    minHeight: 30,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 5,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },

  voterChipText: {
    fontSize: 12,
    fontWeight: '800',
  },

  noteSection: {
    marginBottom: 28,
  },
notThisTimeCard: {
  minHeight: 54,
  borderRadius: 16,
  borderWidth: 1,
  paddingHorizontal: 14,
  flexDirection: 'row',
  alignItems: 'center',
  gap: 10,
  marginBottom: 18,
},

notThisTimeText: {
  fontSize: 16,
  fontWeight: '800',
},
  noteInput: {
    borderRadius: 16,
    padding: 16,
    minHeight: 96,
    fontSize: 16,
    borderWidth: 1,
    textAlignVertical: 'top',
  },

  mainBtn: {
    paddingVertical: 18,
    borderRadius: 16,
    alignItems: 'center',
  },

  mainBtnText: {
    fontSize: 18,
    fontWeight: '800',
  },
});