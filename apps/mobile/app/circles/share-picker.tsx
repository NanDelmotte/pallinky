/**
 * Path: apps/mobile/app/circles/share-picker.tsx
 * Description: Invite surface led by Circles. Supports circle selection,
 * known people selection, limited-access phone-contact expansion, and invite send flow.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Keyboard,
  Modal,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { StyledText } from '@pallinky/ui';
import { buildInviteMessage, supabase } from '@pallinky/core';
import { goBackOrReplace } from '../../lib/navigation';
import CircleManagerSheet from '../../components/circles/CircleManagerSheet';
import {
  Circle,
  CircleMemberRow,
  CircleRow,
} from '../../components/circles/circleManagerTypes';

type PersonSource = 'pallinky' | 'contact';

interface PredictedFriend {
  name: string | null;
  email_lc: string | null;
  total_hangouts: number | null;
  avatar_url: string | null;
}

interface ProfileAvatarRow {
  id: string;
  email_lc: string | null;
  full_name: string | null;
  avatar_url: string | null;
}

interface HiddenPersonRow {
  email_lc: string | null;
  phone_e164: string | null;
  matched_user_id: string | null;
}

interface RelationshipRow {
  related_person_id: string;
  relationship_type: string;
  source: string | null;
  people:
    | {
    id: string;
    email_lc: string | null;
    phone_e164: string | null;
    matched_user_id: string | null;
      }
    | {
        id: string;
        email_lc: string | null;
        phone_e164: string | null;
        matched_user_id: string | null;
      }[]
    | null;
}

interface EventRow {
  id: string;
  title: string | null;
  starts_at: string | null;
  host_name: string | null;
  host_email: string | null;
}

interface RsvpRow {
  id: string;
  event_id: string;
  person_id: string | null;
  email_lc: string | null;
  email: string | null;
  name: string | null;
  status: string | null;
}

interface UnifiedPerson {
  key: string;
  selection_id: string;
  email_lc: string | null;
  name: string;
  avatar_url: string | null;
  source: PersonSource;
  total_hangouts: number;
  device_contact_id: string | null;
  phone_e164: string | null;
  matched_user_id: string | null;
  person_id: string | null;
}

const COLORS = {
  background: '#F6F7F9',
  surface: '#FFFFFF',
  surfaceAlt: '#F9FBF7',
  text: '#1f2a1b',
  textMuted: '#66715f',
  primary: '#43691b',
  primarySoft: '#eef4e8',
  border: '#bac9ad',
  borderSoft: '#e7ede2',
  secondary: '#6A4C93',
  secondaryBg: '#efe9f7',
  overlay: 'rgba(31, 42, 27, 0.35)',
};

function normalizeEmail(value: string | null | undefined) {
  return value?.toLowerCase().trim() || '';
}

function normalizePhone(value: string | null | undefined) {
  if (!value) return '';
  return value.trim().replace(/[\s\-()]/g, '');
}

function isPositiveRsvpStatus(value: string | null | undefined) {
  return ['yes', 'going', 'interested', 'maybe'].includes(normalizeEmail(value));
}

function getRelationshipPerson(relationship: RelationshipRow) {
  const people = relationship.people;
  return Array.isArray(people) ? people[0] || null : people;
}

function firstName(value: string | null | undefined) {
  return value?.trim().split(/\s+/)[0] || '';
}

function emailToFallbackName(email: string) {
  const first = email.split('@')[0].split(/[._-]+/)[0]?.trim();
  return first || 'Friend';
}

function phoneToFallbackName(phone: string) {
  const digits = phone.replace(/[^\d+]/g, '');
  const tail = digits.slice(-4);
  return tail ? `Contact ${tail}` : 'Contact';
}

function avatarFor(name: string | null | undefined, avatarUrl: string | null | undefined) {
  if (avatarUrl) return avatarUrl;
  const safeName = name?.trim() || 'Friend';
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(
    safeName,
  )}&background=6A4C93&color=fff`;
}

function getSelectionId(input: {
  device_contact_id?: string | null;
  phone_e164?: string | null;
  email_lc?: string | null;
  person_id?: string | null;
}) {
  const deviceContactId = input.device_contact_id?.trim();
  if (deviceContactId) return `device:${deviceContactId}`;

  const phone = normalizePhone(input.phone_e164);
  if (phone) return `phone:${phone}`;

  const email = normalizeEmail(input.email_lc);
  if (email) return `email:${email}`;

  const personId = input.person_id?.trim();
  if (personId) return `person:${personId}`;

  return '';
}

function dedupePeople(people: UnifiedPerson[]) {
  const seen = new Set<string>();
  const result: UnifiedPerson[] = [];

  for (const person of people) {
    const keys = [
      person.selection_id ? `selection:${person.selection_id}` : '',
      person.email_lc ? `email:${person.email_lc}` : '',
      person.phone_e164 ? `phone:${person.phone_e164}` : '',
      person.person_id ? `person:${person.person_id}` : '',
    ].filter(Boolean);

    const match = keys.find((key) => seen.has(key));
    if (match) continue;

    keys.forEach((key) => seen.add(key));
    result.push(person);
  }

  return result;
}

export default function CircleSharePickerScreen() {
  const { slug, circleId } = useLocalSearchParams<{ slug: string; circleId?: string }>();

  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  const [userId, setUserId] = useState<string>('');
  const [search, setSearch] = useState('');
  const [eventTitle, setEventTitle] = useState('this event');

  const [circles, setCircles] = useState<Circle[]>([]);
  const [people, setPeople] = useState<UnifiedPerson[]>([]);
  const [recentConnections, setRecentConnections] = useState<UnifiedPerson[]>([]);

  const [selectedCircleIds, setSelectedCircleIds] = useState<string[]>([]);
  const [selectedPersonIds, setSelectedPersonIds] = useState<string[]>([]);
  const [didPreloadCircle, setDidPreloadCircle] = useState(false);

  const [circleManagerVisible, setCircleManagerVisible] = useState(false);
  const circleManagerMode: 'create' | 'edit' = 'create';
  const circleManagerInitialCircle: Circle | null = null;

  const [confirmVisible, setConfirmVisible] = useState(false);

  const buildMergedPeople = useCallback(
    (
      predictedFriends: PredictedFriend[],
      relationships: RelationshipRow[],
      profileRows: ProfileAvatarRow[],
      hiddenRows: HiddenPersonRow[],
      userEmail: string,
    ): UnifiedPerson[] => {
      const personMap = new Map<string, UnifiedPerson>();
      const profileAvatarByEmail = new Map<string, string>();
      const profileAvatarById = new Map<string, string>();
      const profileNameByEmail = new Map<string, string>();
      const profileNameById = new Map<string, string>();

      const hiddenEmailSet = new Set(
        hiddenRows.map((row) => normalizeEmail(row.email_lc)).filter(Boolean),
      );
      const hiddenPhoneSet = new Set(
        hiddenRows.map((row) => normalizePhone(row.phone_e164)).filter(Boolean),
      );
      const hiddenMatchedUserIdSet = new Set(
        hiddenRows.map((row) => row.matched_user_id || '').filter(Boolean),
      );

      profileRows.forEach((profile) => {
        const email = normalizeEmail(profile.email_lc);
        const avatar = profile.avatar_url?.trim() || '';
        const fullName = profile.full_name?.trim() || '';

        if (email && avatar) profileAvatarByEmail.set(email, avatar);
        if (profile.id && avatar) profileAvatarById.set(profile.id, avatar);

        if (email && fullName) profileNameByEmail.set(email, fullName);
        if (profile.id && fullName) profileNameById.set(profile.id, fullName);
      });

      relationships
        .filter((relationship) => relationship.relationship_type === 'direct')
        .forEach((relationship) => {
          const person = getRelationshipPerson(relationship);
          const email = normalizeEmail(person?.email_lc) || null;
          const phone = normalizePhone(person?.phone_e164) || null;
          const matchedUserId = person?.matched_user_id || null;
          const personId = relationship.related_person_id || person?.id || null;

          if (!personId && !email && !phone) return;
          if (email && (email === userEmail || hiddenEmailSet.has(email))) return;
          if (phone && hiddenPhoneSet.has(phone)) return;
          if (matchedUserId && hiddenMatchedUserIdSet.has(matchedUserId)) return;

          const selectionId = getSelectionId({
            email_lc: email,
            phone_e164: phone,
            person_id: personId,
          });

          if (!selectionId) return;

          const key = email
            ? `email:${email}`
            : personId
              ? `person:${personId}`
              : `phone:${phone}`;

          personMap.set(key, {
            key,
            selection_id: selectionId,
            email_lc: email,
            name:
              (matchedUserId ? profileNameById.get(matchedUserId) : '') ||
              (email ? profileNameByEmail.get(email) : '') ||
              (email ? emailToFallbackName(email) : phoneToFallbackName(phone || '')),
            avatar_url:
              (matchedUserId ? profileAvatarById.get(matchedUserId) : null) ||
              (email ? profileAvatarByEmail.get(email) : null) ||
              null,
            source: matchedUserId || email ? 'pallinky' : 'contact',
            total_hangouts: 0,
            device_contact_id: null,
            phone_e164: phone,
            matched_user_id: matchedUserId,
            person_id: personId,
          });
        });

      predictedFriends
        .filter((friend) => {
          const cleanEmail = normalizeEmail(friend.email_lc);
          return cleanEmail !== '' && cleanEmail !== userEmail && !hiddenEmailSet.has(cleanEmail);
        })
        .forEach((friend) => {
          const email = normalizeEmail(friend.email_lc);
          if (!email) return;

          personMap.set(`email:${email}`, {
            key: `email:${email}`,
            selection_id: getSelectionId({ email_lc: email }),
            email_lc: email,
            name: profileNameByEmail.get(email) || friend.name?.trim() || emailToFallbackName(email),
            avatar_url: profileAvatarByEmail.get(email) || friend.avatar_url || null,
            source: 'pallinky',
            total_hangouts: friend.total_hangouts || 0,
            device_contact_id: null,
            phone_e164: null,
            matched_user_id: null,
            person_id: null,
          });
        });

      return Array.from(personMap.values()).sort((a, b) => {
        if (a.source !== b.source) return a.source === 'pallinky' ? -1 : 1;
        if (b.total_hangouts !== a.total_hangouts) return b.total_hangouts - a.total_hangouts;
        return a.name.localeCompare(b.name);
      });
    },
    [],
  );

  const buildRecentConnections = useCallback(
    (
      events: EventRow[],
      rsvps: RsvpRow[],
      relationships: RelationshipRow[],
      profileRows: ProfileAvatarRow[],
      hiddenRows: HiddenPersonRow[],
      userEmail: string,
      userPersonIds: string[],
    ): UnifiedPerson[] => {
      const profileAvatarByEmail = new Map<string, string>();
      const profileNameByEmail = new Map<string, string>();
      const hiddenEmailSet = new Set(
        hiddenRows.map((row) => normalizeEmail(row.email_lc)).filter(Boolean),
      );
      const directEmailSet = new Set<string>();
      const directPersonIdSet = new Set<string>();
      const viewerPersonIdSet = new Set(userPersonIds.filter(Boolean));

      profileRows.forEach((profile) => {
        const email = normalizeEmail(profile.email_lc);
        const avatar = profile.avatar_url?.trim() || '';
        const fullName = profile.full_name?.trim() || '';

        if (email && avatar) profileAvatarByEmail.set(email, avatar);
        if (email && fullName) profileNameByEmail.set(email, fullName);
      });

      relationships.forEach((relationship) => {
        const person = getRelationshipPerson(relationship);
        const email = normalizeEmail(person?.email_lc);
        const personId = relationship.related_person_id || person?.id || '';
        if (email) directEmailSet.add(email);
        if (personId) directPersonIdSet.add(personId);
      });

      const recentMap = new Map<
        string,
        {
          email: string | null;
          personId: string | null;
          name: string;
          sharedEvents: number;
          lastSeenAtMs: number;
        }
      >();

      function upsertRecent(input: {
        email?: string | null;
        personId?: string | null;
        name?: string | null;
        event?: EventRow | null;
      }) {
        const email = normalizeEmail(input.email) || null;
        const personId = input.personId?.trim() || null;

        if (!email && !personId) return;
        if (email && email === userEmail) return;
        if (personId && viewerPersonIdSet.has(personId)) return;
        if (email && hiddenEmailSet.has(email)) return;
        if (email && directEmailSet.has(email)) return;
        if (personId && directPersonIdSet.has(personId)) return;

        const profile = email ? profileNameByEmail.get(email) : '';
        const key = personId ? `person:${personId}` : `email:${email}`;
        const ms = input.event?.starts_at ? new Date(input.event.starts_at).getTime() : 0;
        const safeMs = Number.isFinite(ms) ? ms : 0;
        const existing = recentMap.get(key);

        recentMap.set(key, {
          email,
          personId,
          name:
            profile ||
            input.name?.trim() ||
            (email ? emailToFallbackName(email) : 'Recent connection'),
          sharedEvents: (existing?.sharedEvents || 0) + 1,
          lastSeenAtMs: Math.max(existing?.lastSeenAtMs || 0, safeMs),
        });
      }

      const rsvpsByEventId = new Map<string, RsvpRow[]>();
      rsvps.forEach((rsvp) => {
        const current = rsvpsByEventId.get(rsvp.event_id) || [];
        current.push(rsvp);
        rsvpsByEventId.set(rsvp.event_id, current);
      });

      events.forEach((event) => {
        upsertRecent({
          email: event.host_email,
          name: event.host_name,
          event,
        });

        (rsvpsByEventId.get(event.id) || [])
          .filter((rsvp) => isPositiveRsvpStatus(rsvp.status))
          .forEach((rsvp) => {
            upsertRecent({
              email: rsvp.email_lc || rsvp.email,
              personId: rsvp.person_id,
              name: rsvp.name,
              event,
            });
          });
      });

      return Array.from(recentMap.values())
        .map((person) => {
          const selectionId = getSelectionId({
            email_lc: person.email,
            person_id: person.personId,
          });

          return {
            key: person.personId ? `person:${person.personId}` : `email:${person.email}`,
            selection_id: selectionId,
            email_lc: person.email,
            name: person.name,
            avatar_url: person.email ? profileAvatarByEmail.get(person.email) || null : null,
            source: 'pallinky' as const,
            total_hangouts: person.sharedEvents,
            device_contact_id: null,
            phone_e164: null,
            matched_user_id: null,
            person_id: person.personId,
          };
        })
        .filter((person) => person.selection_id)
        .sort((a, b) => {
          if (b.total_hangouts !== a.total_hangouts) return b.total_hangouts - a.total_hangouts;

          const aRaw = recentMap.get(a.key)?.lastSeenAtMs || 0;
          const bRaw = recentMap.get(b.key)?.lastSeenAtMs || 0;
          if (bRaw !== aRaw) return bRaw - aRaw;

          return a.name.localeCompare(b.name);
        });
    },
    [],
  );

  const fetchData = useCallback(async (): Promise<UnifiedPerson[]> => {
    try {
      setLoading(true);

      const {
        data: { session },
      } = await supabase.auth.getSession();

      const nextUserId = session?.user?.id;
      const userEmail = normalizeEmail(session?.user?.email);

      if (!nextUserId || !userEmail) {
        Alert.alert('Login Required', 'Please sign in before inviting people.');
        goBackOrReplace(router, '/(tabs)/people');
        return [];
      }

      setUserId(nextUserId);

      const [eventRes, circleRes, predictedRes, mePeopleRes] = await Promise.all([
        supabase.from('events').select('id, title').eq('slug', slug).single(),
        supabase
          .from('social_circles')
          .select('id, circle_name, created_at')
          .eq('user_id', nextUserId)
          .order('created_at', { ascending: false }),
 Promise.resolve({ data: [], error: null }), 
        supabase
          .from('people')
          .select('id, email_lc, matched_user_id')
          .or(`matched_user_id.eq.${nextUserId},email_lc.eq.${userEmail}`),
      ]);

      const relationshipRes = await supabase
        .from('relationships')
        .select(`
          related_person_id,
          relationship_type,
          source,
          people:related_person_id (
            id,
            email_lc,
            phone_e164,
            matched_user_id
          )
        `)
        .eq('owner_user_id', nextUserId)
        .eq('relationship_type', 'direct');

      const hiddenRes = await supabase
        .from('hidden_people')
        .select('email_lc, phone_e164, matched_user_id')
        .eq('user_id', nextUserId);

      if (eventRes.error) throw eventRes.error;
      if (circleRes.error) throw circleRes.error;
      if (predictedRes.error) throw predictedRes.error;
      if (mePeopleRes.error) throw mePeopleRes.error;
      if (relationshipRes.error) throw relationshipRes.error;
      if (hiddenRes.error) throw hiddenRes.error;

      setEventTitle(eventRes.data?.title || 'this event');

      const predictedFriends = (predictedRes.data as PredictedFriend[]) || [];
      const relationships = (relationshipRes.data as RelationshipRow[]) || [];
      const hiddenRows = (hiddenRes.data as HiddenPersonRow[]) || [];
      const userPersonIds = Array.from(
        new Set(
          ((mePeopleRes.data as { id: string }[]) || [])
            .map((person) => person.id?.trim())
            .filter(Boolean),
        ),
      );

      const [myRsvpsByEmailRes, myRsvpsByPersonRes] = await Promise.all([
        supabase.from('rsvps').select('id, event_id, person_id, email_lc, email, name, status').eq('email_lc', userEmail),
        userPersonIds.length > 0
          ? supabase
              .from('rsvps')
              .select('id, event_id, person_id, email_lc, email, name, status')
              .in('person_id', userPersonIds)
          : Promise.resolve({ data: [], error: null }),
      ]);

      if (myRsvpsByEmailRes.error) throw myRsvpsByEmailRes.error;
      if (myRsvpsByPersonRes.error) throw myRsvpsByPersonRes.error;

      const myRsvps = Array.from(
        new Map(
          [
            ...((myRsvpsByEmailRes.data as RsvpRow[]) || []),
            ...((myRsvpsByPersonRes.data as RsvpRow[]) || []),
          ].map((row) => [row.id, row]),
        ).values(),
      ).filter((row) => isPositiveRsvpStatus(row.status));

      const sharedEventIds = Array.from(
        new Set(myRsvps.map((row) => row.event_id).filter(Boolean)),
      );

      let sharedEvents: EventRow[] = [];
      let sharedEventRsvps: RsvpRow[] = [];

      if (sharedEventIds.length > 0) {
        const [sharedEventsRes, sharedEventRsvpsRes] = await Promise.all([
          supabase
            .from('events')
            .select('id, title, starts_at, host_name, host_email')
            .in('id', sharedEventIds),
          supabase
            .from('rsvps')
            .select('id, event_id, person_id, email_lc, email, name, status')
            .in('event_id', sharedEventIds),
        ]);

        if (sharedEventsRes.error) throw sharedEventsRes.error;
        if (sharedEventRsvpsRes.error) throw sharedEventRsvpsRes.error;

        sharedEvents = (sharedEventsRes.data as EventRow[]) || [];
        sharedEventRsvps = (sharedEventRsvpsRes.data as RsvpRow[]) || [];
      }

      const profileEmailSet = new Set<string>();
      const profileIdSet = new Set<string>();

      predictedFriends.forEach((friend) => {
        const email = normalizeEmail(friend.email_lc);
        if (email) profileEmailSet.add(email);
      });

      relationships.forEach((relationship) => {
        const person = getRelationshipPerson(relationship);
        const email = normalizeEmail(person?.email_lc);
        const matchedId = person?.matched_user_id || '';
        if (email) profileEmailSet.add(email);
        if (matchedId) profileIdSet.add(matchedId);
      });

      sharedEvents.forEach((event) => {
        const email = normalizeEmail(event.host_email);
        if (email) profileEmailSet.add(email);
      });

      sharedEventRsvps.forEach((rsvp) => {
        const email = normalizeEmail(rsvp.email_lc || rsvp.email);
        if (email) profileEmailSet.add(email);
      });

      let profileRows: ProfileAvatarRow[] = [];
      if (profileEmailSet.size || profileIdSet.size) {
        let profileQuery = supabase.from('profiles').select('id, email_lc, full_name, avatar_url');
        if (profileEmailSet.size && profileIdSet.size) {
          profileQuery = profileQuery.or(
            `email_lc.in.(${Array.from(profileEmailSet).join(',')}),id.in.(${Array.from(profileIdSet).join(',')})`,
          );
        } else if (profileEmailSet.size) {
          profileQuery = profileQuery.in('email_lc', Array.from(profileEmailSet));
        } else {
          profileQuery = profileQuery.in('id', Array.from(profileIdSet));
        }

        const { data: profilesRes, error: profilesError } = await profileQuery;
        if (profilesError) throw profilesError;
        profileRows = (profilesRes as ProfileAvatarRow[]) || [];
      }

      const circleRows = (circleRes.data as CircleRow[]) || [];
      const circleIds = circleRows.map((circle) => circle.id);

      let circleMemberRows: CircleMemberRow[] = [];
      if (circleIds.length > 0) {
        const { data: membersRes, error: membersError } = await supabase
          .from('social_circle_members')
          .select(
            'id, circle_id, member_name, member_email_lc, member_phone_e164, member_user_id, sort_order, created_at, device_contact_id, person_id',
          )
          .in('circle_id', circleIds)
          .order('sort_order', { ascending: true, nullsFirst: false })
          .order('created_at', { ascending: true });

        if (membersError) throw membersError;
        circleMemberRows = (membersRes as CircleMemberRow[]) || [];
      }

      const membersByCircleId = new Map<string, CircleMemberRow[]>();
      circleRows.forEach((circle) => membersByCircleId.set(circle.id, []));
      circleMemberRows.forEach((row) => {
        const current = membersByCircleId.get(row.circle_id) || [];
        current.push(row);
        membersByCircleId.set(row.circle_id, current);
      });

      const safeCircles: Circle[] = circleRows.map((circle) => ({
        id: circle.id,
        circle_name: circle.circle_name,
        created_at: circle.created_at || null,
        members: membersByCircleId.get(circle.id) || [],
      }));

      const mergedPeople = buildMergedPeople(
        predictedFriends,
        relationships,
        profileRows,
        hiddenRows,
        userEmail,
      );

      const mergedRecentConnections = buildRecentConnections(
        sharedEvents,
        sharedEventRsvps,
        relationships,
        profileRows,
        hiddenRows,
        userEmail,
        userPersonIds,
      );

      setCircles(safeCircles);
      setPeople(mergedPeople);
      setRecentConnections(mergedRecentConnections);

      return mergedPeople;
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Could not load invite picker.');
      return [];
    } finally {
      setLoading(false);
    }
  }, [buildMergedPeople, buildRecentConnections, slug]);

  useFocusEffect(
    React.useCallback(() => {
      void fetchData();
    }, [fetchData]),
  );

  useEffect(() => {
    if (!circleId || didPreloadCircle) return;
    if (!circles.length) return;

    const circle = circles.find((item) => item.id === circleId);
    if (!circle) {
      setDidPreloadCircle(true);
      return;
    }

    setSelectedCircleIds((prev) => (prev.includes(circle.id) ? prev : [...prev, circle.id]));
    setDidPreloadCircle(true);
  }, [circleId, circles, didPreloadCircle]);

  const selectedCircleSet = useMemo(() => new Set(selectedCircleIds), [selectedCircleIds]);
  const selectedPersonSet = useMemo(() => new Set(selectedPersonIds), [selectedPersonIds]);

  const circleMemberPeople = useMemo(() => {
    const out: UnifiedPerson[] = [];

    for (const circle of circles) {
      if (!selectedCircleSet.has(circle.id)) continue;

      for (const member of circle.members) {
        const email = normalizeEmail(member.member_email_lc) || null;
        const phone = normalizePhone(member.member_phone_e164) || null;

        const fromPeople =
          people.find(
            (person) =>
              (email && person.email_lc === email) ||
              (phone && person.phone_e164 === phone) ||
              (member.person_id && person.person_id === member.person_id),
          ) || null;

        if (fromPeople) {
          out.push(fromPeople);
          continue;
        }

        const selectionId = getSelectionId({
          device_contact_id: member.device_contact_id,
          phone_e164: phone,
          email_lc: email,
          person_id: member.person_id,
        });

        out.push({
          key: `circle-member:${member.id}`,
          selection_id: selectionId || `circle-member:${member.id}`,
          email_lc: email,
          name:
            member.member_name ||
            (email ? emailToFallbackName(email) : phoneToFallbackName(phone || '')),
          avatar_url: null,
          source: member.member_user_id ? 'pallinky' : 'contact',
          total_hangouts: 0,
          device_contact_id: member.device_contact_id || null,
          phone_e164: phone,
          matched_user_id: member.member_user_id || null,
          person_id: member.person_id || null,
        });
      }
    }

    return dedupePeople(out);
  }, [circles, people, selectedCircleSet]);

  const selectedDirectPeople = useMemo(
    () =>
      dedupePeople([...people, ...recentConnections]).filter((person) =>
        selectedPersonSet.has(person.selection_id),
      ),
    [people, recentConnections, selectedPersonSet],
  );

  const allSelectedPeople = useMemo(
    () => dedupePeople([...circleMemberPeople, ...selectedDirectPeople]),
    [circleMemberPeople, selectedDirectPeople],
  );

  const selectedPills = useMemo(() => {
    const circlePills = circles
      .filter((circle) => selectedCircleSet.has(circle.id))
      .map((circle) => ({
        type: 'circle' as const,
        key: `circle:${circle.id}`,
        label: `${circle.circle_name} (${circle.members.length})`,
        circleId: circle.id,
      }));

    const personPills = dedupePeople(selectedDirectPeople).map((person) => ({
      type: 'person' as const,
      key: `person:${person.key}`,
      label: firstName(person.name) || person.name,
      personSelectionId: person.selection_id,
      avatar_url: person.avatar_url,
      name: person.name,
    }));

    return [...circlePills, ...personPills];
  }, [circles, selectedCircleSet, selectedDirectPeople]);

  const filteredPeople = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q
      ? people.filter((person) => {
          return (
            person.name.toLowerCase().includes(q) ||
            (person.email_lc || '').toLowerCase().includes(q) ||
            (person.phone_e164 || '').toLowerCase().includes(q)
          );
        })
      : people;
  }, [people, search]);

  const filteredRecentConnections = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q
      ? recentConnections.filter((person) => {
          return (
            person.name.toLowerCase().includes(q) ||
            (person.email_lc || '').toLowerCase().includes(q) ||
            (person.phone_e164 || '').toLowerCase().includes(q)
          );
        })
      : recentConnections;
  }, [recentConnections, search]);

  function togglePerson(selectionId: string) {
    Keyboard.dismiss();
    if (!selectionId) return;

    setSelectedPersonIds((prev) =>
      prev.includes(selectionId)
        ? prev.filter((item) => item !== selectionId)
        : [...prev, selectionId],
    );
  }

  async function handleHidePerson(person: UnifiedPerson) {
    try {
      const { error } = await supabase.rpc('hide_person_from_my_people', {
        p_email_lc: person.email_lc,
        p_phone_e164: person.phone_e164,
        p_matched_user_id: person.matched_user_id,
        p_reason: 'removed_from_share_picker',
      });

      if (error) throw error;

      setSelectedPersonIds((prev) => prev.filter((id) => id !== person.selection_id));
      await fetchData();
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Could not remove person.');
    }
  }

  function removeSelectedPill(item: (typeof selectedPills)[number]) {
    if (item.type === 'circle') {
      setSelectedCircleIds((prev) => prev.filter((id) => id !== item.circleId));
      return;
    }

    setSelectedPersonIds((prev) => prev.filter((id) => id !== item.personSelectionId));
  }

  function openConfirm() {
    if (!allSelectedPeople.length) {
      Alert.alert('No recipients', 'Select at least one person or circle.');
      return;
    }
    setConfirmVisible(true);
  }

  async function handleSendInvites() {
    if (!slug) {
      Alert.alert('Missing Event', 'We could not find the event slug.');
      return;
    }

    if (allSelectedPeople.length === 0) {
      Alert.alert('No recipients', 'Select at least one person.');
      return;
    }

    setSending(true);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const inviterEmail = normalizeEmail(session?.user?.email);

      if (!inviterEmail) {
        throw new Error('You must be signed in to send invites.');
      }

      const { data: eventData, error: eventError } = await supabase
        .from('events')
        .select('id')
        .eq('slug', slug)
        .single();

      if (eventError || !eventData?.id) {
        throw new Error('Event not found.');
      }

      const seenEmails = new Set<string>();
      const seenPhones = new Set<string>();
      const seenPersonIds = new Set<string>();

      const peopleToInvite = dedupePeople(allSelectedPeople).filter((person) => {
        const email = normalizeEmail(person.email_lc);
        const phone = normalizePhone(person.phone_e164);
        const personId = person.person_id || '';

        if (
          (email && seenEmails.has(email)) ||
          (phone && seenPhones.has(phone)) ||
          (personId && seenPersonIds.has(personId))
        ) {
          return false;
        }

        if (email) seenEmails.add(email);
        if (phone) seenPhones.add(phone);
        if (personId) seenPersonIds.add(personId);
        return true;
      });

      const personResults = await Promise.all(
        peopleToInvite.map(async (person) => {
          let resolvedPersonId = person.person_id;
          let resolvedMatchedUserId = person.matched_user_id || null;

          if (!resolvedPersonId) {
            const { data, error } = await supabase.rpc('resolve_or_create_person', {
              p_email_lc: person.email_lc,
              p_phone_e164: person.phone_e164,
              p_matched_user_id: person.matched_user_id,
            });

            if (error) throw error;
            resolvedPersonId = data as string;
          }

          if (!resolvedMatchedUserId && resolvedPersonId) {
            const { data: peopleRow, error: peopleError } = await supabase
              .from('people')
              .select('matched_user_id')
              .eq('id', resolvedPersonId)
              .maybeSingle();

            if (peopleError) throw peopleError;
            resolvedMatchedUserId = peopleRow?.matched_user_id || null;
          }

          return {
            ...person,
            person_id: resolvedPersonId,
            matched_user_id: resolvedMatchedUserId,
          };
        }),
      );

      const inviteRows = personResults.map((person) => ({
        event_id: eventData.id,
        invitee_email_lc: person.email_lc,
        invitee_phone_e164: person.source === 'contact' ? person.phone_e164 : null,
        invitee_name: person.name,
        invited_by_email_lc: inviterEmail,
        invited_by_invite_id: null,
        source_type: 'host_friend',
        source_ref: null,
        status: 'pending',
        can_forward: false,
        requires_host_approval: false,
        claimed_at: null,
        revoked_at: null,
        device_contact_id: null,
        person_id: person.person_id,
      }));

      const existingEmails = Array.from(
        new Set(
          inviteRows
            .map((row) => row.invitee_email_lc)
            .filter((value): value is string => Boolean(value)),
        ),
      );

      const existingPhones = Array.from(
        new Set(
          inviteRows
            .map((row) => row.invitee_phone_e164)
            .filter((value): value is string => Boolean(value)),
        ),
      );

      const existingPersonIds = Array.from(
        new Set(
          inviteRows.map((row) => row.person_id).filter((value): value is string => Boolean(value)),
        ),
      );

      let existingInviteRows: {
        invitee_email_lc: string | null;
        invitee_phone_e164: string | null;
        person_id: string | null;
        invitee_name: string | null;
        guest_token: string | null;
      }[] = [];

      if (existingEmails.length || existingPhones.length || existingPersonIds.length) {
        let existingQuery = supabase
          .from('event_invites')
          .select('invitee_name, invitee_email_lc, invitee_phone_e164, person_id, guest_token')
          .eq('event_id', eventData.id);

        if (existingEmails.length + existingPhones.length + existingPersonIds.length > 1) {
          const filters = [
            existingEmails.length ? `invitee_email_lc.in.(${existingEmails.join(',')})` : '',
            existingPhones.length ? `invitee_phone_e164.in.(${existingPhones.join(',')})` : '',
            existingPersonIds.length ? `person_id.in.(${existingPersonIds.join(',')})` : '',
          ].filter(Boolean);

          existingQuery = existingQuery.or(
            filters.join(','),
          );
        } else if (existingEmails.length) {
          existingQuery = existingQuery.in('invitee_email_lc', existingEmails);
        } else if (existingPhones.length) {
          existingQuery = existingQuery.in('invitee_phone_e164', existingPhones);
        } else {
          existingQuery = existingQuery.in('person_id', existingPersonIds);
        }

        const { data: existingData, error: existingError } = await existingQuery;
        if (existingError) throw existingError;
        existingInviteRows = existingData || [];
      }

      const existingEmailSet = new Set(
        existingInviteRows
          .map((row) => row.invitee_email_lc)
          .filter((value): value is string => Boolean(value)),
      );

      const existingPhoneSet = new Set(
        existingInviteRows
          .map((row) => row.invitee_phone_e164)
          .filter((value): value is string => Boolean(value)),
      );

      const existingPersonIdSet = new Set(
        existingInviteRows
          .map((row) => row.person_id)
          .filter((value): value is string => Boolean(value)),
      );

      const rowsToInsert = inviteRows.filter((row) => {
        if (row.invitee_email_lc && existingEmailSet.has(row.invitee_email_lc)) return false;
        if (row.invitee_phone_e164 && existingPhoneSet.has(row.invitee_phone_e164)) return false;
        if (row.person_id && existingPersonIdSet.has(row.person_id)) return false;
        return true;
      });

      if (rowsToInsert.length > 0) {
        const { data: insertedRows, error: inviteError } = await supabase
          .from('event_invites')
          .insert(rowsToInsert)
          .select('invitee_name, invitee_email_lc, invitee_phone_e164, person_id, guest_token');
        if (inviteError) throw inviteError;
        existingInviteRows = [...existingInviteRows, ...((insertedRows || []) as typeof existingInviteRows)];
      }

            // invite_created notifications are produced by the DB trigger on event_invites.
      // Do not insert invite notifications here.

      const inviteTokenForPerson = (person: (typeof personResults)[number]) => {
        const email = normalizeEmail(person.email_lc);
        const phone = normalizePhone(person.phone_e164);
        const personId = person.person_id || '';

        return existingInviteRows.find((row) => {
          if (row.invitee_email_lc && email && row.invitee_email_lc === email) return true;
          if (row.invitee_phone_e164 && phone && row.invitee_phone_e164 === phone) return true;
          if (row.person_id && personId && row.person_id === personId) return true;
          return false;
        })?.guest_token || null;
      };

      const externalInviteLinks = personResults
        .filter(
          (person) =>
            !(person.source === 'pallinky' || !!person.matched_user_id) &&
            Boolean(person.phone_e164 || person.email_lc),
        )
        .map((person) => ({
          name: person.name,
          link: `https://pallinky.com/event/${slug}?token=${encodeURIComponent(
            inviteTokenForPerson(person) || '',
          )}`,
        }))
        .filter((invite) => !invite.link.endsWith('token='));

      setConfirmVisible(false);

      if (externalInviteLinks.length > 0) {
        await new Promise((resolve) => setTimeout(resolve, 250));
        const message =
          externalInviteLinks.length === 1
            ? buildInviteMessage({
                title: eventTitle,
                link: externalInviteLinks[0].link,
              })
            : [
                `You're invited to ${eventTitle}`,
                '',
                ...externalInviteLinks.map((invite) => `${invite.name}: ${invite.link}`),
              ].join('\n');
        await Share.share({ message });
      }

      router.replace('/(tabs)');
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to send invites.');
    } finally {
      setSending(false);
    }
  }

  const renderSelectedPill = ({ item }: { item: (typeof selectedPills)[number] }) => (
    <TouchableOpacity style={styles.selectedPill} onPress={() => removeSelectedPill(item)}>
      {item.type === 'person' ? (
        <Image
          source={{ uri: avatarFor(item.name, item.avatar_url || null) }}
          style={styles.selectedPillAvatar}
        />
      ) : (
        <MaterialCommunityIcons name="account-group" size={16} color={COLORS.secondary} />
      )}
      <StyledText style={styles.selectedPillText}>{item.label}</StyledText>
      <Ionicons name="close" size={14} color={COLORS.textMuted} />
    </TouchableOpacity>
  );

  const selectedCount = allSelectedPeople.length;

  return (
    <SafeAreaView edges={['top']} style={styles.safe}>
      <View style={styles.wrapper}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => goBackOrReplace(router, '/(tabs)/people')} style={styles.headerIcon}>
            <Ionicons name="close" size={28} color={COLORS.primary} />
          </TouchableOpacity>

          <StyledText style={styles.headerTitle}>Invite People</StyledText>

          <View style={styles.headerSpacer} />
        </View>

        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color={COLORS.primary} />
          </View>
        ) : (
          <>
            <ScrollView
              contentContainerStyle={styles.content}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              <View style={styles.eventContext}>
                <StyledText style={styles.eventContextLabel}>Inviting to</StyledText>
                <StyledText style={styles.eventContextTitle}>{eventTitle}</StyledText>
              </View>

              {selectedPills.length > 0 && (
                <View style={styles.selectedRowBlock}>
                  <FlatList
                    horizontal
                    data={selectedPills}
                    keyExtractor={(item) => item.key}
                    renderItem={renderSelectedPill}
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.selectedRow}
                  />
                </View>
              )}

              <View style={styles.searchWrap}>
                <Ionicons name="search" size={18} color={COLORS.textMuted} />
                <TextInput
                  value={search}
                  onChangeText={setSearch}
                  placeholder="Search people, email, or number..."
                  placeholderTextColor={COLORS.textMuted}
                  style={styles.searchInput}
                />
              </View>

              <View style={styles.sectionCard}>
                <View style={styles.sectionCardHeaderRow}>
                  <StyledText style={styles.sectionTitle}>My People</StyledText>
                </View>
                <StyledText style={styles.sectionHint}>Long press to remove</StyledText>

                {filteredPeople.length === 0 ? (
                  <StyledText style={styles.emptyText}>
                    No people yet.
                  </StyledText>
                ) : (
                 <View style={styles.peopleList}>
  {filteredPeople.map((item, index) => {
    const isSelected = selectedPersonSet.has(item.selection_id);

    return (
      <TouchableOpacity
        key={item.key}
        style={styles.personRow}
        onPress={() => togglePerson(item.selection_id)}
        onLongPress={() => {
          Alert.alert(
            'Remove from my people',
            `Remove ${item.name} from your people list?`,
            [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Remove',
                style: 'destructive',
                onPress: () => {
                  void handleHidePerson(item);
                },
              },
            ],
          );
        }}
      >
        <Image
          source={{ uri: avatarFor(item.name, item.avatar_url) }}
          style={styles.personRowAvatar}
        />

        <View style={styles.personRowMain}>
          <View style={styles.personRowTop}>
            <StyledText style={styles.personRowName}>
              {item.name}
            </StyledText>

            {item.source === 'pallinky' && (
              <Ionicons name="sparkles" size={14} color={COLORS.secondary} />
            )}
          </View>

        </View>

        <Ionicons
          name={isSelected ? 'checkbox' : 'square-outline'}
          size={22}
          color={isSelected ? COLORS.primary : '#b0b7c3'}
        />
      </TouchableOpacity>
    );
  })}
</View>
                )}
              </View>

              {filteredRecentConnections.length > 0 && (
                <View style={styles.sectionCard}>
                  <View style={styles.sectionCardHeaderRow}>
                    <StyledText style={styles.sectionTitle}>Recent connections</StyledText>
                  </View>

                  <View style={styles.peopleList}>
                    {filteredRecentConnections.map((item, index) => {
                      const isSelected = selectedPersonSet.has(item.selection_id);

                      return (
                        <TouchableOpacity
                          key={item.key}
                          style={styles.personRow}
                          onPress={() => togglePerson(item.selection_id)}
                          onLongPress={() => {
                            Alert.alert(
                              'Hide recent connection',
                              `Hide ${item.name} from your invite suggestions?`,
                              [
                                { text: 'Cancel', style: 'cancel' },
                                {
                                  text: 'Hide',
                                  style: 'destructive',
                                  onPress: () => {
                                    void handleHidePerson(item);
                                  },
                                },
                              ],
                            );
                          }}
                        >
                          <Image
                            source={{ uri: avatarFor(item.name, item.avatar_url) }}
                            style={styles.personRowAvatar}
                          />

                          <View style={styles.personRowMain}>
                            <View style={styles.personRowTop}>
                              <StyledText style={styles.personRowName}>
                                {item.name}
                              </StyledText>

                              <Ionicons name="time-outline" size={14} color={COLORS.secondary} />
                            </View>

                            {index === 0 && (
                              <StyledText style={styles.personRowHint}>
                                Shared event history
                              </StyledText>
                            )}
                          </View>

                          <Ionicons
                            name={isSelected ? 'checkbox' : 'square-outline'}
                            size={22}
                            color={isSelected ? COLORS.primary : '#b0b7c3'}
                          />
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              )}
            </ScrollView>

            <View style={styles.bottomBar}>
              <StyledText style={styles.bottomBarCount}>
                {selectedCount} {selectedCount === 1 ? 'selected' : 'selected'}
              </StyledText>

              <TouchableOpacity
                style={[styles.inviteButton, selectedCount === 0 && styles.inviteButtonDisabled]}
                disabled={selectedCount === 0}
                onPress={openConfirm}
              >
                <StyledText style={styles.inviteButtonText}>Invite</StyledText>
              </TouchableOpacity>
            </View>
          </>
        )}

        <CircleManagerSheet
          visible={circleManagerVisible}
          circles={circles}
          setCircles={setCircles}
          userId={userId}
          initialMode={circleManagerMode}
          initialCircle={circleManagerInitialCircle}
          onClose={async () => {
            setCircleManagerVisible(false);
            await fetchData();
          }}
          onUseCircle={(circle) => {
            setSelectedCircleIds((prev) =>
              prev.includes(circle.id) ? prev : [...prev, circle.id],
            );
          }}
        />

        <Modal
          visible={confirmVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setConfirmVisible(false)}
        >
          <Pressable style={styles.overlayCenter} onPress={() => setConfirmVisible(false)}>
            <Pressable style={styles.confirmCard} onPress={() => null}>
              <StyledText style={styles.confirmTitle}>Send Invitations</StyledText>

              <ScrollView style={{ maxHeight: 260 }} showsVerticalScrollIndicator={false}>
                {allSelectedPeople.map((person) => (
                  <View key={`${person.key}-${person.selection_id}`} style={styles.confirmRow}>
                    <Image
                      source={{ uri: avatarFor(person.name, person.avatar_url) }}
                      style={styles.confirmAvatar}
                    />
                    <View style={{ flex: 1 }}>
                      <StyledText style={styles.confirmName}>{person.name}</StyledText>
                      <StyledText style={styles.confirmMeta}>
                        {person.email_lc || person.phone_e164 || 'No contact info'}
                      </StyledText>
                    </View>
                  </View>
                ))}
              </ScrollView>

              <TouchableOpacity
                style={[styles.confirmButton, sending && styles.buttonDisabled]}
                onPress={handleSendInvites}
                disabled={sending}
              >
                {sending ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <StyledText style={styles.confirmButtonText}>Send Invites</StyledText>
                )}
              </TouchableOpacity>
            </Pressable>
          </Pressable>
        </Modal>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  wrapper: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    minHeight: 68,
    paddingHorizontal: 20,
    paddingBottom: 10,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderSoft,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerIcon: {
    width: 36,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  headerSpacer: {
    width: 36,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: COLORS.text,
  },
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 180,
  },
  eventContext: {
    marginBottom: 14,
    paddingHorizontal: 2,
  },
  eventContextLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.textMuted,
    textTransform: 'uppercase',
  },
  eventContextTitle: {
    marginTop: 4,
    fontSize: 22,
    fontWeight: '900',
    color: COLORS.text,
  },
  sectionBlock: {
    marginBottom: 14,
  },
  sectionHeaderRow: {
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    fontSize: 19,
    fontWeight: '900',
    color: COLORS.text,
  },
  circlesList: {
    paddingRight: 8,
  },
  peopleList: {
  paddingHorizontal: 12,
},

personRow: {
  flexDirection: 'row',
  alignItems: 'center',
  paddingVertical: 12,
  borderBottomWidth: 1,
  borderBottomColor: COLORS.borderSoft,
},

personRowAvatar: {
  width: 44,
  height: 44,
  borderRadius: 22,
  backgroundColor: COLORS.secondaryBg,
  marginRight: 12,
},

personRowMain: {
  flex: 1,
},

personRowTop: {
  flexDirection: 'row',
  alignItems: 'center',
  gap: 6,
},

personRowName: {
  fontSize: 15,
  fontWeight: '900',
  color: COLORS.text,
},

personRowHint: {
  fontSize: 11,
  color: COLORS.textMuted,
  marginTop: 2,
},
  newCircleCard: {
    width: 170,
    minHeight: 164,
    borderRadius: 24,
    padding: 16,
    marginRight: 12,
    backgroundColor: COLORS.surface,
    borderWidth: 1.5,
    borderColor: '#d8e5cc',
    justifyContent: 'space-between',
  },
  newCircleIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  newCircleTitle: {
    fontSize: 17,
    fontWeight: '900',
    color: COLORS.text,
  },
  newCircleMeta: {
    fontSize: 13,
    lineHeight: 18,
    color: COLORS.textMuted,
  },
  circleCard: {
    width: 192,
    minHeight: 164,
    borderRadius: 24,
    padding: 16,
    marginRight: 12,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: '#e5daf1',
    justifyContent: 'space-between',
  },
  circleCardSelected: {
    borderColor: COLORS.primary,
    backgroundColor: '#f7fbf3',
  },
  circleCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  avatarStack: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 42,
  },
  avatarStackItem: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: COLORS.secondaryBg,
    borderWidth: 2,
    borderColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarStackText: {
    fontSize: 12,
    fontWeight: '900',
    color: COLORS.secondary,
  },
  circleMenuButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#f5f7f3',
    alignItems: 'center',
    justifyContent: 'center',
  },
  circleCardTitle: {
    marginTop: 14,
    fontSize: 20,
    fontWeight: '900',
    color: COLORS.text,
  },
  circleCardMeta: {
    marginTop: 4,
    fontSize: 13,
    color: COLORS.textMuted,
    fontWeight: '700',
  },
  circleSelectedBadge: {
    marginTop: 14,
    alignSelf: 'flex-start',
    height: 28,
    borderRadius: 14,
    paddingHorizontal: 10,
    backgroundColor: COLORS.primary,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  circleSelectedBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '800',
  },
  circleActionHint: {
    marginTop: 14,
    fontSize: 12,
    color: COLORS.secondary,
    fontWeight: '800',
  },
  selectedRowBlock: {
    marginBottom: 12,
  },
  selectedRow: {
    paddingRight: 8,
  },
  selectedPill: {
    height: 38,
    borderRadius: 19,
    paddingHorizontal: 10,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.borderSoft,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginRight: 8,
  },
  selectedPillAvatar: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: COLORS.secondaryBg,
  },
  selectedPillText: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.text,
  },
  searchWrap: {
    marginBottom: 16,
    backgroundColor: COLORS.surface,
    borderRadius: 18,
    paddingHorizontal: 14,
    height: 54,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: COLORS.borderSoft,
  },
  searchWrapModal: {
    marginBottom: 10,
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    paddingHorizontal: 14,
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: COLORS.borderSoft,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: COLORS.text,
  },
  sectionCard: {
    marginBottom: 14,
    borderRadius: 24,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.borderSoft,
    paddingVertical: 16,
  },
  sectionCardHeaderRow: {
    paddingHorizontal: 16,
    marginBottom: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionHint: {
    paddingHorizontal: 16,
    marginBottom: 10,
    fontSize: 11,
    color: COLORS.textMuted,
  },
  addPeopleButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.primarySoft,
    borderWidth: 1,
    borderColor: '#d8e5cc',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  
  bottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: COLORS.surface,
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 34,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderSoft,
  },
  bottomBarCount: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.text,
    marginBottom: 10,
  },
  inviteButton: {
    height: 54,
    borderRadius: 16,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inviteButtonDisabled: {
    backgroundColor: '#b8c2cc',
  },
  inviteButtonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '900',
  },
  modalWrap: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  modalHeader: {
    paddingHorizontal: 20,
    paddingTop: 6,
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  modalHeaderCenter: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  modalHeaderAction: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.primary,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '900',
    color: COLORS.text,
    textAlign: 'center',
  },
  modalSubtitle: {
    fontSize: 13,
    color: COLORS.textMuted,
    marginTop: 4,
    marginBottom: 10,
    textAlign: 'center',
  },
  modalHelpLink: {
    fontSize: 13,
    color: COLORS.primary,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 10,
  },
  helpCard: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.borderSoft,
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
  },
  helpText: {
    fontSize: 14,
    color: COLORS.text,
    lineHeight: 20,
    marginBottom: 8,
  },
  helpTextTopGap: {
    marginTop: 12,
  },
  headerActionDisabled: {
    opacity: 0.35,
  },
  modalContent: {
    flex: 1,
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  modalSummary: {
    marginBottom: 10,
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.textMuted,
  },
  modalListContent: {
    paddingBottom: 24,
  },
  stateWrap: {
    paddingVertical: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contactRow: {
    backgroundColor: COLORS.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.borderSoft,
    paddingHorizontal: 14,
    paddingVertical: 13,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  contactAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.secondaryBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contactAvatarText: {
    fontSize: 13,
    fontWeight: '900',
    color: COLORS.secondary,
  },
  contactMain: {
    flex: 1,
    minWidth: 0,
  },
  contactName: {
    fontSize: 15,
    fontWeight: '900',
    color: COLORS.text,
  },
  contactMeta: {
    marginTop: 2,
    fontSize: 12,
    color: COLORS.textMuted,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  overlayCenter: {
    flex: 1,
    backgroundColor: COLORS.overlay,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  confirmCard: {
    width: '90%',
    maxWidth: 440,
    backgroundColor: COLORS.surface,
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: COLORS.borderSoft,
  },
  confirmTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: COLORS.text,
    marginBottom: 16,
  },
  confirmRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
  },
  confirmAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: COLORS.secondaryBg,
  },
  confirmName: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.text,
  },
  confirmMeta: {
    marginTop: 2,
    fontSize: 12,
    color: COLORS.textMuted,
  },
  confirmButton: {
    height: 52,
    borderRadius: 16,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 14,
  },
  confirmButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '900',
  },
  emptyText: {
    fontSize: 14,
    color: COLORS.textMuted,
    lineHeight: 20,
    paddingHorizontal: 16,
    paddingBottom: 4,
  },
});
