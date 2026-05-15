/**
 * Path: apps/mobile/app/person/[personId].tsx
 * Description: CRM-style relationship page showing a user's interaction
 * history with another person, including shared events, vibe responses,
 * and circle membership.
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  ActivityIndicator,
  Image,
  TouchableOpacity,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StyledText } from '@pallinky/ui';
import { supabase } from '@pallinky/core';
import { Ionicons } from '@expo/vector-icons';

interface EventRow {
  id: string;
  slug: string;
  title: string;
  host_email: string | null;
  host_name: string | null;
  host_person_id?: string | null;
  starts_at: string | null;
  event_type?: string | null;
}

interface RsvpRow {
  event_id: string;
  person_id?: string | null;
  email: string | null;
  email_lc: string | null;
  name: string | null;
  status: string | null;
  responded_at: string | null;
}

interface VibeResponseRow {
  id: string;
  event_id: string | null;
  guest_name: string | null;
  selected_dates: string[] | null;
  note: string | null;
  created_at: string | null;
  user_email: string | null;
}

interface ProfileRow {
  id?: string;
  email_lc: string | null;
  avatar_url: string | null;
  full_name: string | null;
}

interface PersonRow {
  id: string;
  email_lc: string | null;
  matched_user_id?: string | null;
}

interface SocialCircleRow {
  circle_name: string;
  members: string[] | null;
}

function normalizeEmail(v: string | null | undefined) {
  return v?.toLowerCase().trim() || '';
}

function normalizeId(v: string | null | undefined) {
  return (v || '').trim();
}

function firstName(name: string | null | undefined, email?: string) {
  const trimmed = name?.trim();
  if (trimmed) return trimmed.split(/\s+/)[0];
  if (email) return email.split('@')[0];
  return 'Friend';
}

function avatarFallback(name: string) {
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(
    name
  )}&background=6A4C93&color=fff`;
}

function formatDate(date: string | null | undefined) {
  if (!date) return '';
  return new Date(date).toDateString();
}

function dedupeRsvps(rows: RsvpRow[]) {
  const map = new Map<string, RsvpRow>();

  for (const row of rows) {
    const key = [
      row.event_id,
      normalizeId(row.person_id),
      normalizeEmail(row.email_lc || row.email),
      normalizeEmail(row.status),
      row.responded_at || '',
    ].join('|');

    if (!map.has(key)) {
      map.set(key, row);
    }
  }

  return Array.from(map.values());
}

export default function PersonScreen() {
  const { personId } = useLocalSearchParams<{ personId: string }>();
  const router = useRouter();

  const friendPersonId = useMemo(
    () => normalizeId(decodeURIComponent(personId || '')),
    [personId]
  );

  const [loading, setLoading] = useState(true);
  const [myEmail, setMyEmail] = useState('');
  const [viewerPersonId, setViewerPersonId] = useState('');
  const [friendEmail, setFriendEmail] = useState('');
  const [friendName, setFriendName] = useState('Friend');
  const [friendAvatar, setFriendAvatar] = useState<string | null>(null);

  const [sharedEvents, setSharedEvents] = useState<EventRow[]>([]);
  const [sharedRsvpMap, setSharedRsvpMap] = useState<Record<string, RsvpRow>>({});
  const [ideaResponses, setIdeaResponses] = useState<
    Array<{
      id: string;
      eventTitle: string;
      eventSlug: string;
      created_at: string | null;
      note: string | null;
      selected_dates: string[] | null;
    }>
  >([]);
  const [circles, setCircles] = useState<string[]>([]);

  const [stats, setStats] = useState({
    sharedEvents: 0,
    hostedByMe: 0,
    hostedByThem: 0,
    waves: 0,
    lastSeen: null as string | null,
  });

  useEffect(() => {
    void load();
  }, [friendPersonId]);

  async function load() {
    setLoading(true);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const me = normalizeEmail(session?.user?.email);
      const viewerUserId = normalizeId(session?.user?.id);
      setMyEmail(me);

      if (!me || !friendPersonId) {
        setSharedEvents([]);
        setSharedRsvpMap({});
        setIdeaResponses([]);
        setCircles([]);
        setStats({
          sharedEvents: 0,
          hostedByMe: 0,
          hostedByThem: 0,
          waves: 0,
          lastSeen: null,
        });
        setLoading(false);
        return;
      }

      const [{ data: mePersonRes }, { data: friendPersonRes }] = await Promise.all([
        supabase
          .from('people')
          .select('id, email_lc, matched_user_id')
          .or(`matched_user_id.eq.${viewerUserId},email_lc.eq.${me}`)
          .limit(1)
          .maybeSingle(),
        supabase
          .from('people')
          .select('id, email_lc, matched_user_id')
          .eq('id', friendPersonId)
          .maybeSingle(),
      ]);

      const mePerson = (mePersonRes as PersonRow | null) || null;
      const friendPerson = (friendPersonRes as PersonRow | null) || null;

      const resolvedViewerPersonId = normalizeId(mePerson?.id);
      const resolvedFriendEmail = normalizeEmail(friendPerson?.email_lc);

      setViewerPersonId(resolvedViewerPersonId);
      setFriendEmail(resolvedFriendEmail);

      if (
        (resolvedViewerPersonId && resolvedViewerPersonId === friendPersonId) ||
        (!resolvedViewerPersonId && resolvedFriendEmail && resolvedFriendEmail === me)
      ) {
        setFriendName('You');
        setFriendAvatar(null);
        setSharedEvents([]);
        setSharedRsvpMap({});
        setIdeaResponses([]);
        setCircles([]);
        setStats({
          sharedEvents: 0,
          hostedByMe: 0,
          hostedByThem: 0,
          waves: 0,
          lastSeen: null,
        });
        setLoading(false);
        return;
      }

      let profile: ProfileRow | null = null;
      if (resolvedFriendEmail) {
        const { data: profileRes } = await supabase
          .from('profiles')
          .select('id, email_lc, avatar_url, full_name')
          .eq('email_lc', resolvedFriendEmail)
          .maybeSingle();

        profile = (profileRes as ProfileRow) || null;
      }

      if (profile?.full_name) {
        setFriendName(firstName(profile.full_name, resolvedFriendEmail));
      } else if (resolvedFriendEmail) {
        setFriendName(firstName(null, resolvedFriendEmail));
      } else {
        setFriendName('Friend');
      }

      setFriendAvatar(profile?.avatar_url || null);

       const myRsvpQueries: any[] = [];
      if (resolvedViewerPersonId) {
        myRsvpQueries.push(
          supabase.from('rsvps').select('event_id').eq('person_id', resolvedViewerPersonId)
        );
      }
      if (me) {
        myRsvpQueries.push(
          supabase.from('rsvps').select('event_id').eq('email_lc', me)
        );
      }

      const [hostedEventsRes, ...myRsvpResults] = await Promise.all([
        supabase
          .from('events')
          .select('id, slug, title, host_email, host_name, host_person_id, starts_at, event_type')
          .eq('host_email', me),
        ...myRsvpQueries,
      ]);

      const hostedEvents = (hostedEventsRes.data as EventRow[]) || [];
      const hostedEventIds = hostedEvents.map((e) => e.id);

      const attendedEventIds = Array.from(
        new Set(
          myRsvpResults
            .flatMap((res: any) => (res?.data || []) as Array<{ event_id: string }>)
            .map((r) => r.event_id)
            .filter(Boolean)
        )
      );

      const allMyEventIds = Array.from(new Set([...hostedEventIds, ...attendedEventIds]));

      if (allMyEventIds.length === 0) {
        setSharedEvents([]);
        setSharedRsvpMap({});
        setIdeaResponses([]);
        setCircles([]);
        setStats({
          sharedEvents: 0,
          hostedByMe: 0,
          hostedByThem: 0,
          waves: 0,
          lastSeen: null,
        });
        setLoading(false);
        return;
      }

      const friendRsvpQueries: any[] = [
        supabase
          .from('rsvps')
          .select('event_id, person_id, email, email_lc, name, status, responded_at')
          .eq('person_id', friendPersonId)
          .in('event_id', allMyEventIds),
      ];

      if (resolvedFriendEmail) {
        friendRsvpQueries.push(
          supabase
            .from('rsvps')
            .select('event_id, person_id, email, email_lc, name, status, responded_at')
            .eq('email_lc', resolvedFriendEmail)
            .in('event_id', allMyEventIds)
        );
      }

      const friendRsvpResults = await Promise.all(friendRsvpQueries);
      const friendRsvps = dedupeRsvps(
        friendRsvpResults.flatMap((res: any) => ((res?.data as RsvpRow[]) || []))
      );

      const sharedEventIds = Array.from(new Set(friendRsvps.map((r) => r.event_id)));

      const rsvpName = friendRsvps.find((r) => r.name)?.name;
      if (!profile?.full_name && rsvpName) {
        setFriendName(firstName(rsvpName, resolvedFriendEmail));
      }

      let events: EventRow[] = [];
      if (sharedEventIds.length > 0) {
        const { data: sharedEventsRes } = await supabase
          .from('events')
          .select('id, slug, title, host_email, host_name, host_person_id, starts_at, event_type')
          .in('id', sharedEventIds);

        events =
          ((sharedEventsRes as EventRow[]) || []).sort((a, b) => {
            const at = a.starts_at ? new Date(a.starts_at).getTime() : 0;
            const bt = b.starts_at ? new Date(b.starts_at).getTime() : 0;
            return bt - at;
          }) || [];
      }

      const rsvpMap: Record<string, RsvpRow> = {};
      for (const row of friendRsvps) {
        if (!rsvpMap[row.event_id]) {
          rsvpMap[row.event_id] = row;
        }
      }

      setSharedEvents(events);
      setSharedRsvpMap(rsvpMap);

      const hostedByMe = events.filter((e) => normalizeEmail(e.host_email) === me).length;
      const hostedByThem = events.filter((e) => {
        const hostPersonId = normalizeId(e.host_person_id || '');
        const hostEmail = normalizeEmail(e.host_email);
        if (hostPersonId && hostPersonId === friendPersonId) return true;
        if (!hostPersonId && resolvedFriendEmail && hostEmail === resolvedFriendEmail) return true;
        return false;
      }).length;

      const lastSeen =
        friendRsvps
          .map((r) => r.responded_at)
          .filter(Boolean)
          .sort()
          .pop() || null;

      let waveCount = 0;
      let ideaRows: Array<{
        id: string;
        eventTitle: string;
        eventSlug: string;
        created_at: string | null;
        note: string | null;
        selected_dates: string[] | null;
      }> = [];

      if (hostedEventIds.length > 0 && resolvedFriendEmail) {
        const { data: vibeRes } = await supabase
          .from('vibe_responses')
          .select('id, event_id, guest_name, selected_dates, note, created_at, user_email')
          .eq('user_email', resolvedFriendEmail)
          .in('event_id', hostedEventIds);

        const vibeRows = (vibeRes as VibeResponseRow[]) || [];
        waveCount = vibeRows.length;

        const hostedMap = new Map<string, EventRow>();
        hostedEvents.forEach((event) => hostedMap.set(event.id, event));

        ideaRows = vibeRows
          .map((row) => {
            const event = row.event_id ? hostedMap.get(row.event_id) : null;
            return {
              id: row.id,
              eventTitle: event?.title || 'Idea',
              eventSlug: event?.slug || '',
              created_at: row.created_at,
              note: row.note,
              selected_dates: row.selected_dates,
            };
          })
          .sort((a, b) => {
            const at = a.created_at ? new Date(a.created_at).getTime() : 0;
            const bt = b.created_at ? new Date(b.created_at).getTime() : 0;
            return bt - at;
          });
      }

      setIdeaResponses(ideaRows);

      const { data: circlesRes } = await supabase
        .from('social_circles')
        .select('circle_name, members')
        .eq('user_id', session?.user?.id);

      const displayName = profile?.full_name
        ? firstName(profile.full_name, resolvedFriendEmail)
        : firstName(rsvpName, resolvedFriendEmail);

      const inCircles =
        ((circlesRes as SocialCircleRow[]) || [])
          .filter((circle) => {
            const members = circle.members || [];
            return (
              (!!resolvedFriendEmail && members.includes(resolvedFriendEmail)) ||
              members.includes(displayName) ||
              members.includes(displayName.toLowerCase())
            );
          })
          .map((circle) => circle.circle_name) || [];

      setCircles(inCircles);

      setStats({
        sharedEvents: events.length,
        hostedByMe,
        hostedByThem,
        waves: waveCount,
        lastSeen,
      });
    } finally {
      setLoading(false);
    }
  }

  const displayAvatar = friendAvatar || avatarFallback(friendName);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#6A4C93" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={26} color="#fff" />
        </TouchableOpacity>
        <StyledText style={styles.headerTitle}>Connection</StyledText>
        <View style={{ width: 26 }} />
      </View>

      <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
        <View style={styles.profile}>
          <Image source={{ uri: displayAvatar }} style={styles.avatar} />
          <StyledText style={styles.name}>{friendName}</StyledText>
          <StyledText style={styles.subtitle}>
            You&apos;ve crossed paths {stats.sharedEvents} times
          </StyledText>
          {stats.lastSeen && (
            <StyledText style={styles.subtitle}>
              Last seen {formatDate(stats.lastSeen)}
            </StyledText>
          )}
        </View>

        <View style={styles.stats}>
          <Stat label="Shared" value={stats.sharedEvents} />
          <Stat label="Hosted by you" value={stats.hostedByMe} />
          <Stat label="Hosted by them" value={stats.hostedByThem} />
          <Stat label="Waves" value={stats.waves} />
        </View>

        <Section title="Shared Events">
          {sharedEvents.length === 0 ? (
            <StyledText style={styles.empty}>No shared events yet</StyledText>
          ) : (
            sharedEvents.map((event) => {
              const friendRsvp = sharedRsvpMap[event.id];
              const hostedLabel =
                normalizeEmail(event.host_email) === myEmail
                  ? 'Hosted by you'
                  : normalizeId(event.host_person_id || '') === friendPersonId
                  ? `Hosted by ${friendName}`
                  : friendEmail && normalizeEmail(event.host_email) === friendEmail
                  ? `Hosted by ${friendName}`
                  : `Hosted by ${firstName(event.host_name, event.host_email || undefined)}`;

              return (
                <TouchableOpacity
                  key={event.id}
                  style={styles.card}
                  onPress={() => router.push(`/event/${event.slug}/details`)}
                >
                  <StyledText style={styles.cardTitle}>{event.title}</StyledText>
                  <StyledText style={styles.cardMeta}>{hostedLabel}</StyledText>
                  {event.starts_at ? (
                    <StyledText style={styles.cardMeta}>{formatDate(event.starts_at)}</StyledText>
                  ) : null}
                  {friendRsvp?.status ? (
                    <StyledText style={styles.cardMeta}>
                      {friendName} RSVP&apos;d {friendRsvp.status}
                    </StyledText>
                  ) : null}
                </TouchableOpacity>
              );
            })
          )}
        </Section>

        <Section title="Responses to Your Ideas">
          {ideaResponses.length === 0 ? (
            <StyledText style={styles.empty}>They haven&apos;t responded to your ideas yet</StyledText>
          ) : (
            ideaResponses.map((response) => (
              <TouchableOpacity
                key={response.id}
                style={styles.card}
                onPress={() =>
                  response.eventSlug ? router.push(`/event/${response.eventSlug}/details`) : undefined
                }
                disabled={!response.eventSlug}
              >
                <StyledText style={styles.cardTitle}>{response.eventTitle}</StyledText>
                <StyledText style={styles.cardMeta}>
                  {response.selected_dates?.length
                    ? `Picked ${response.selected_dates.length} date${
                        response.selected_dates.length !== 1 ? 's' : ''
                      }`
                    : 'Waved 🌊'}
                </StyledText>
                {response.note ? (
                  <StyledText style={styles.cardMeta}>Note: {response.note}</StyledText>
                ) : null}
                {response.created_at ? (
                  <StyledText style={styles.cardMeta}>{formatDate(response.created_at)}</StyledText>
                ) : null}
              </TouchableOpacity>
            ))
          )}
        </Section>

        <Section title="In Your Circles">
          {circles.length === 0 ? (
            <StyledText style={styles.empty}>Not in one of your saved circles yet</StyledText>
          ) : (
            <View style={styles.pills}>
              {circles.map((circle) => (
                <View key={circle} style={styles.pill}>
                  <StyledText style={styles.pillText}>{circle}</StyledText>
                </View>
              ))}
            </View>
          )}
        </Section>

        <View style={{ height: 80 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <StyledText style={styles.sectionTitle}>{title}</StyledText>
      {children}
    </View>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.stat}>
      <StyledText style={styles.statValue}>{value}</StyledText>
      <StyledText style={styles.statLabel}>{label}</StyledText>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#6A4C93' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 20,
    alignItems: 'center',
  },
  headerTitle: { color: '#fff', fontSize: 20, fontWeight: '900' },
  body: {
    backgroundColor: '#F8F9FB',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    flex: 1,
  },
  bodyContent: {
    padding: 20,
    paddingBottom: 40,
  },
  profile: { alignItems: 'center', marginTop: 10 },
  avatar: { width: 90, height: 90, borderRadius: 45, marginBottom: 10, backgroundColor: '#eee' },
  name: { fontSize: 26, fontWeight: '900' },
  subtitle: { color: '#666', marginTop: 3 },
  stats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 24,
  },
  stat: { alignItems: 'center', width: '23%' },
  statValue: { fontSize: 20, fontWeight: '900' },
  statLabel: { fontSize: 12, color: '#777', textAlign: 'center', marginTop: 4 },
  section: { marginTop: 30 },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '900',
    marginBottom: 12,
  },
  card: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
  },
  cardTitle: { fontWeight: '800', fontSize: 16 },
  cardMeta: { fontSize: 12, color: '#666', marginTop: 4 },
  empty: { color: '#777', fontSize: 13 },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill: {
    backgroundColor: '#E8E0F7',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  pillText: { color: '#6A4C93', fontWeight: '700' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
});