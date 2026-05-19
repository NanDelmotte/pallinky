// apps/mobile/app/(tabs)/people.tsx
// People page with Connections + Circles tabs.

import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Image,
  Pressable,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import * as Contacts from 'expo-contacts';

import { StyledText } from '@pallinky/ui';
import { supabase, useSession } from '@pallinky/core';
import { t } from '@pallinky/i18n';
import { useI18n } from '@pallinky/i18n/client';
import type { AppLanguage } from '@pallinky/i18n/types';

import FriendCard, { FriendCardData } from '../../components/people/FriendCard';
import CircleManagerSheet from '../../components/circles/CircleManagerSheet';
import type {
  Circle,
  CircleMemberRow,
} from '../../components/circles/circleManagerTypes';
import { deriveFeedSignals, type FeedItem } from '../../lib/feed/deriveFeed';
import {
  dismissPeopleSuggestion,
  getDismissedPeopleSuggestionIds,
} from '../../lib/dismissedPeopleSuggestions';

type PersonProfile = {
  email: string;
  name: string;
  avatarUrl: string | null;
};

type CircleRow = {
  id: string;
  circle_name: string | null;
  created_at?: string | null;
};

type SocialIntentRow = {
  host_email: string | null;
  updated_at?: string | null;
};

type PeopleTab = 'connections' | 'circles';

const COLORS = {
  background: '#F6F7F9',
  surface: '#FFFFFF',
  text: '#1f2a1b',
  textMuted: '#66715f',
  primary: '#43691b',
  secondary: '#6A4C93',
  secondaryBg: '#efe9f7',
  secondaryText: '#5b3f84',
  secondarySoft: '#f6f0fb',
  border: '#eef2ea',
  borderStrong: '#bac9ad',
  iconBg: '#f1f3eb',
  overlay: 'rgba(31, 42, 27, 0.28)',
};

function normalizeEmail(v: unknown) {
  return typeof v === 'string' ? v.toLowerCase().trim() : '';
}

function formatDate(date: string | null | undefined) {
  if (!date) return '';
  return new Date(date).toDateString();
}

function avatarFor(name: string, avatarUrl?: string | null) {
  if (avatarUrl) return avatarUrl;
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(
    name || 'P'
  )}&background=43691b&color=fff`;
}

function initialsFor(value: string | null | undefined) {
  const words = (value || 'Circle')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);

  return words.map((word) => word[0]?.toUpperCase() || '').join('') || 'CI';
}

function getCircleMemberDisplayName(
  member: CircleMemberRow,
  profileMap: Map<string, PersonProfile>,
  lang: AppLanguage
) {
  const email = normalizeEmail(member.member_email_lc);
  const profile = email ? profileMap.get(email) : null;

  return (
    member.member_name?.trim() ||
    profile?.name ||
    member.member_phone_e164 ||
    t(lang, 'people_member_fallback')
  );
}

function buildFriendCardFromSignal(
  signal: FeedItem,
  profileMap: Map<string, PersonProfile>,
  lang: AppLanguage
): FriendCardData {
  const email = normalizeEmail(signal.personEmail);
  const payload = signal.payload || {};
  const profile = profileMap.get(email);

  const name =
  profile?.name ||
  payload?.full_name ||
  payload?.name ||
  payload?.displayName ||
  t(lang, 'people_person_fallback');

  const sharedEvents = Number(payload?.sharedEvents || 0);
  const lastSeenAt = payload?.lastSeenAt || null;

  const bridgeNames = Array.isArray(payload?.bridges)
    ? payload.bridges
        .map((bridge: any) => {
          const bridgeEmail = normalizeEmail(bridge?.bridgePersonEmail);
          const bridgeProfile = profileMap.get(bridgeEmail);
          return bridgeProfile?.name || bridge?.bridgeName || bridgeEmail;
        })
        .filter(Boolean)
    : [];

  const mutualBridgeCount = Number(
    payload?.mutualBridgeCount || bridgeNames.length || 0
  );

  const lastSeenEventTitle =
    signal.type === 'suggested_connection' && payload?.reason === 'friend_of_friend'
      ? bridgeNames.length > 1
        ? t(lang, 'people_you_both_know_plus_others', {
            name: bridgeNames[0],
            count: String(bridgeNames.length - 1),
          })
        : bridgeNames.length === 1
          ? t(lang, 'people_you_both_know', { name: bridgeNames[0] })
          : t(lang, 'people_connected_through_network')
      : payload?.lastSeenEventTitle || t(lang, 'people_event_fallback');

  return {
    id: email,
    name,
    avatarUrl: profile?.avatarUrl || null,
    crossedPathsCount:
      signal.type === 'suggested_connection' && payload?.reason === 'friend_of_friend'
        ? mutualBridgeCount
        : sharedEvents,
    lastSeenLabel: lastSeenAt ? formatDate(lastSeenAt) : '',
    lastSeenAtEventTitle: lastSeenEventTitle,
    sharedEventsCount: sharedEvents,
    hostedByYouCount: Number(payload?.hostedByYouCount || 0),
    hostedByThemCount: Number(payload?.hostedByThemCount || 0),
    wavesCount: Number(payload?.wavesCount || 0),
    activity: Array.isArray(payload?.sharedEventsActivity)
      ? payload.sharedEventsActivity
      : [],
  };
}

function dedupeByPerson(items: FeedItem[]) {
  const map = new Map<string, FeedItem>();

  for (const item of items) {
    const email = normalizeEmail(item.personEmail);
    if (!email) continue;
    if (!map.has(email)) map.set(email, item);
  }

  return Array.from(map.values());
}

function sortBySharedEventsDesc(items: FeedItem[]) {
  return [...items].sort((a, b) => {
    const aCount = Number(a.payload?.sharedEvents || 0);
    const bCount = Number(b.payload?.sharedEvents || 0);
    if (bCount !== aCount) return bCount - aCount;

    const aMs = a.payload?.lastSeenAt ? new Date(a.payload.lastSeenAt).getTime() : 0;
    const bMs = b.payload?.lastSeenAt ? new Date(b.payload.lastSeenAt).getTime() : 0;
    return bMs - aMs;
  });
}

function sortByLastSeenDesc(items: FeedItem[]) {
  return [...items].sort((a, b) => {
    const aMs = a.payload?.lastSeenAt ? new Date(a.payload.lastSeenAt).getTime() : 0;
    const bMs = b.payload?.lastSeenAt ? new Date(b.payload.lastSeenAt).getTime() : 0;
    if (bMs !== aMs) return bMs - aMs;

    const aCount = Number(a.payload?.sharedEvents || 0);
    const bCount = Number(b.payload?.sharedEvents || 0);
    return bCount - aCount;
  });
}

export default function PeopleScreen() {
  const router = useRouter();
  const { session } = useSession();
  const { language: lang } = useI18n();
  

  const [activeTab, setActiveTab] = useState<PeopleTab>('connections');
  const [loading, setLoading] = useState(true);
  const [deviceContactCount, setDeviceContactCount] = useState(0);

  const [data, setData] = useState<any>({
    events: [],
    rsvps: [],
    invites: [],
    socialCircles: [] as Circle[],
    relationships: [],
    socialIntent: [],
    contacts: [],
    chatSummaries: {},
    accessByEventId: {},
    userEmail: '',
  });

  const [profileMap, setProfileMap] = useState<Map<string, PersonProfile>>(new Map());
  const [selectedFriend, setSelectedFriend] = useState<FriendCardData | null>(null);
  const [dismissedPeopleSuggestionIds, setDismissedPeopleSuggestionIds] = useState<string[]>([]);

  const [circleManagerVisible, setCircleManagerVisible] = useState(false);
  const [circleManagerMode, setCircleManagerMode] = useState<'create' | 'edit'>('create');
  const [activeCircle, setActiveCircle] = useState<Circle | null>(null);

  function handleOpenFriend(item: FeedItem) {
    const card = buildFriendCardFromSignal(item, profileMap, lang);
    setSelectedFriend(card);
  }

  function handleDismissPeopleSuggestion(friend: FriendCardData) {
    const suggestionId = normalizeEmail(friend.id);
    if (!suggestionId || !data.userEmail) return;

    Alert.alert(
      t(lang, 'people_hide_suggestion_title'),
      t(lang, 'people_hide_suggestion_body'),
      [
        { text: t(lang, 'common_cancel'), style: 'cancel' },
        {
          text: t(lang, 'common_hide'),
          onPress: async () => {
            const previous = dismissedPeopleSuggestionIds;
            const optimistic = previous.includes(suggestionId)
              ? previous
              : [...previous, suggestionId];

            setDismissedPeopleSuggestionIds(optimistic);

            try {
              const next = await dismissPeopleSuggestion(data.userEmail, suggestionId);
              setDismissedPeopleSuggestionIds(next);
              if (selectedFriend?.id === friend.id) setSelectedFriend(null);
            } catch {
              setDismissedPeopleSuggestionIds(previous);
              Alert.alert(t(lang, 'common_error'), t(lang, 'people_hide_suggestion_error'));
            }
          },
        },
      ]
    );
  }

  const setSocialCircles = useCallback((updater: React.SetStateAction<Circle[]>) => {
    setData((prev: any) => {
      const current = Array.isArray(prev.socialCircles) ? prev.socialCircles : [];
      const next =
        typeof updater === 'function'
          ? (updater as (prevState: Circle[]) => Circle[])(current)
          : updater;

      return {
        ...prev,
        socialCircles: next,
      };
    });
  }, []);

  const openCreateCircle = useCallback(() => {
    setCircleManagerMode('create');
    setActiveCircle(null);
    setCircleManagerVisible(true);
  }, []);

  const openManageCircle = useCallback((circle: Circle) => {
    setCircleManagerMode('edit');
    setActiveCircle(circle);
    setCircleManagerVisible(true);
  }, []);

  const closeCircleManager = useCallback(() => {
    setCircleManagerVisible(false);
    setActiveCircle(null);
    setCircleManagerMode('create');
    void load();
  }, []);

  const load = useCallback(async () => {
    if (!session?.user?.email) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const emailLower = normalizeEmail(session.user.email);
      const hiddenPeopleSuggestionIds = await getDismissedPeopleSuggestionIds(emailLower);
      setDismissedPeopleSuggestionIds(hiddenPeopleSuggestionIds);

      let nextDeviceContactCount = 0;
      const { status } = await Contacts.getPermissionsAsync();
      if (status === 'granted') {
        const { data: contacts } = await Contacts.getContactsAsync({
          fields: [Contacts.Fields.Emails],
          pageSize: 1,
        });
        nextDeviceContactCount = contacts?.length || 0;
      }
      setDeviceContactCount(nextDeviceContactCount);

      const { data: profile } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url')
        .eq('id', session.user.id)
        .maybeSingle();

      const { data: relationshipRows, error: relationshipError } = await supabase
        .from('relationships')
        .select(`
          related_person_id,
          source,
          people:related_person_id (
            id,
            email_lc,
            matched_user_id
          )
        `)
        .eq('owner_user_id', session.user.id)
        .eq('relationship_type', 'direct');

      if (relationshipError) throw relationshipError;

      const directRelationshipEmails = Array.from(
        new Set(
          (relationshipRows || [])
            .map((row: any) => normalizeEmail(row.people?.email_lc))
            .filter((email: string) => email && email !== emailLower)
        )
      );

      const [
        hostedEventsRes,
        invitesRes,
        myRsvpsRes,
        circlesRes,
        socialIntentRes,
        deviceContactsRes,
      ] = await Promise.all([
        supabase.from('events').select('*').eq('host_email', emailLower),

        supabase
          .from('event_invites')
          .select('event_id, invitee_email_lc, status')
          .eq('invitee_email_lc', emailLower),

        supabase.from('rsvps').select('*').eq('email_lc', emailLower),

        profile?.id
          ? supabase
              .from('social_circles')
              .select('id, circle_name, created_at')
              .eq('user_id', profile.id)
              .order('created_at', { ascending: false })
          : Promise.resolve({ data: [] }),

        supabase
          .from('social_intent')
          .select('*')
          .eq('user_email', emailLower)
          .eq('keep_in_loop', true),

        supabase.rpc('get_my_device_contacts'),
      ]);

      const circleRows = (circlesRes.data || []) as CircleRow[];
      const circleIds = circleRows.map((circle) => circle.id);

      let circleMemberRows: CircleMemberRow[] = [];
      if (circleIds.length > 0) {
        const { data: membersRes, error: membersError } = await supabase
          .from('social_circle_members')
          .select(
            'id, circle_id, member_name, member_email_lc, member_phone_e164, member_user_id, sort_order, created_at, device_contact_id, person_id'
          )
          .in('circle_id', circleIds)
          .order('sort_order', { ascending: true, nullsFirst: false })
          .order('created_at', { ascending: true });

        if (membersError) throw membersError;
        circleMemberRows = (membersRes || []) as CircleMemberRow[];
      }

      const membersByCircleId = new Map<string, CircleMemberRow[]>();
      circleRows.forEach((circle) => membersByCircleId.set(circle.id, []));
      circleMemberRows.forEach((row) => {
        const current = membersByCircleId.get(row.circle_id) || [];
        current.push(row);
        membersByCircleId.set(row.circle_id, current);
      });

      const socialCircles: Circle[] = circleRows.map((circle) => ({
        id: circle.id,
        circle_name: circle.circle_name?.trim() || t(lang, 'people_untitled_circle'),
        created_at: circle.created_at || null,
        members: membersByCircleId.get(circle.id) || [],
      }));

      const circleMemberEmails = Array.from(
        new Set(
          socialCircles
            .flatMap((circle) => circle.members || [])
            .map((member) => normalizeEmail(member.member_email_lc))
            .filter((email) => email && email !== emailLower)
        )
      );

      const sharedHistoryEventIds = Array.from(
        new Set(
          (myRsvpsRes.data || [])
            .map((r: any) => (r.event_id ? String(r.event_id) : null))
            .filter(Boolean)
        )
      );

      let sharedHistoryRsvps: any[] = [];
      if (sharedHistoryEventIds.length > 0) {
        const { data } = await supabase
          .from('rsvps')
          .select('event_id, email_lc, email')
          .in('event_id', sharedHistoryEventIds);

        sharedHistoryRsvps = data || [];
      }

      const relatedHostEmails = Array.from(
        new Set([
          ...directRelationshipEmails,
          ...circleMemberEmails,
          ...sharedHistoryRsvps
            .map((r: any) => normalizeEmail(r.email_lc || r.email))
            .filter((email: string) => email && email !== emailLower),
        ])
      );

      let relatedHostedEvents: any[] = [];
      if (relatedHostEmails.length > 0) {
        const { data } = await supabase
          .from('events')
          .select('*')
          .in('host_email', relatedHostEmails);

        relatedHostedEvents = data || [];
      }

      const inviteEventIds = (invitesRes.data || []).map((i: any) => i.event_id);
      const rsvpEventIds = (myRsvpsRes.data || []).map((r: any) => r.event_id);

      const directEventIdsToLoad = Array.from(
        new Set([
          ...(hostedEventsRes.data || []).map((e: any) => e.id),
          ...inviteEventIds,
          ...rsvpEventIds,
          ...relatedHostedEvents.map((e: any) => e.id),
        ])
      );

      let allEvents: any[] = [];
      if (directEventIdsToLoad.length > 0) {
        const { data: allEventsRes } = await supabase
          .from('events')
          .select('*')
          .in('id', directEventIdsToLoad);

        allEvents = allEventsRes || [];
      }

      let directEventRsvps: any[] = [];
      if (directEventIdsToLoad.length > 0) {
        const { data: eventRsvpsRes } = await supabase
          .from('rsvps')
          .select('*')
          .in('event_id', directEventIdsToLoad);

        directEventRsvps = eventRsvpsRes || [];
      }

      const directPersonEmails = Array.from(
        new Set(
          directEventRsvps
            .map((r: any) => normalizeEmail(r.email_lc || r.email))
            .filter((email: string) => email && email !== emailLower)
        )
      );

      let secondDegreeBridgeRsvps: any[] = [];
      if (directPersonEmails.length > 0) {
        const { data } = await supabase
          .from('rsvps')
          .select('*')
          .in('email_lc', directPersonEmails);

        secondDegreeBridgeRsvps = data || [];
      }

      const secondDegreeEventIds = Array.from(
        new Set(secondDegreeBridgeRsvps.map((r: any) => r.event_id).filter(Boolean))
      );

      let secondDegreeEvents: any[] = [];
      if (secondDegreeEventIds.length > 0) {
        const { data } = await supabase
          .from('events')
          .select('*')
          .in('id', secondDegreeEventIds);

        secondDegreeEvents = data || [];
      }

      let secondDegreeEventRsvps: any[] = [];
      if (secondDegreeEventIds.length > 0) {
        const { data } = await supabase
          .from('rsvps')
          .select('*')
          .in('event_id', secondDegreeEventIds);

        secondDegreeEventRsvps = data || [];
      }

      const allEventMap = new Map<string, any>();
      for (const ev of [...allEvents, ...secondDegreeEvents]) {
        allEventMap.set(String(ev.id), ev);
      }

      const allRsvpMap = new Map<string, any>();
      for (const r of [...directEventRsvps, ...secondDegreeEventRsvps]) {
        allRsvpMap.set(String(r.id), r);
      }

      allEvents = Array.from(allEventMap.values());
      const eventRsvps = Array.from(allRsvpMap.values());

      const chatSummaryPairs = await Promise.all(
        allEvents.map(async (ev: any) => {
          try {
            const { data } = await supabase.rpc('get_event_chat_summary', {
              p_event_id: ev.id,
              p_user_email: emailLower,
            });

            return [ev.id, data?.[0] || null] as const;
          } catch {
            return [ev.id, null] as const;
          }
        })
      );

      const chatSummaries = Object.fromEntries(chatSummaryPairs);

      const nextData = {
        events: allEvents,
        rsvps: eventRsvps,
        invites: invitesRes.data || [],
        socialCircles,
        relationships: relationshipRows || [],
        socialIntent: socialIntentRes.data || [],
        contacts: deviceContactsRes.data || [],
        chatSummaries,
        accessByEventId: Object.fromEntries(
          allEvents.map((ev: any) => [String(ev.id), { can_see: true }])
        ),
        userEmail: emailLower,
      };

      setData(nextData);

      const feed = deriveFeedSignals({
        data: nextData,
        deviceContactCount: nextDeviceContactCount,
      });

      const socialIntentRows = (socialIntentRes.data || []) as SocialIntentRow[];

      const socialIntentHostEmails = Array.from(
        new Set(
          socialIntentRows.map((row) => normalizeEmail(row.host_email)).filter(Boolean)
        )
      );

      const personEmails = Array.from(
        new Set(
          [
            ...feed.items
              .flatMap((item) => {
                if (
                  item.type === 'inner_circle_person' ||
                  item.type === 'active_connection' ||
                  item.type === 'reconnect_person' ||
                  item.type === 'suggested_connection'
                ) {
                  return [normalizeEmail(item.personEmail)];
                }

                if (item.type === 'seeing_soon') {
                  const participants = Array.isArray(item.payload?.participants)
                    ? item.payload.participants
                    : [];

                  return participants
                    .map((p: any) => normalizeEmail(p.personEmail))
                    .filter(Boolean);
                }

                return [];
              })
              .filter(Boolean),
            ...socialIntentHostEmails,
            ...circleMemberEmails,
            ...directRelationshipEmails,
          ].filter(Boolean)
        )
      );

      if (personEmails.length === 0) {
        setProfileMap(new Map());
        return;
      }

      const { data: profiles } = await supabase
        .from('profiles')
        .select('email_lc, avatar_url, full_name')
        .in('email_lc', personEmails);

      const nextProfileMap = new Map<string, PersonProfile>();

      for (const email of personEmails) {
        const profileRow = (profiles || []).find(
          (p: any) => normalizeEmail(p.email_lc) === email
        );

        nextProfileMap.set(email, {
          email,
          name:
            profileRow?.full_name ||
            t(lang, 'people_person_fallback'),
          avatarUrl: profileRow?.avatar_url || null,
        });
      }

      setProfileMap(nextProfileMap);
    } finally {
      setLoading(false);
    }
  }, [session, lang]);
  

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const feed = useMemo(() => {
    return deriveFeedSignals({
      data,
      deviceContactCount,
    });
  }, [data, deviceContactCount]);

  const socialCircles = useMemo(() => {
    return (Array.isArray(data.socialCircles) ? data.socialCircles : []) as Circle[];
  }, [data.socialCircles]);

  const directRelationshipEmailSet = useMemo(() => {
    return new Set(
      (Array.isArray(data.relationships) ? data.relationships : [])
        .map((row: any) => normalizeEmail(row.people?.email_lc))
        .filter(Boolean)
    );
  }, [data.relationships]);

  const innerCircleSignals = useMemo(() => {
    return sortBySharedEventsDesc(
      dedupeByPerson(
        feed.items.filter((item) => {
          const email = normalizeEmail(item.personEmail);

          return (
            item.type === 'inner_circle_person' &&
            directRelationshipEmailSet.has(email)
          );
        })
      )
    ).slice(0, 6);
  }, [feed.items, directRelationshipEmailSet]);

  const innerCircleEmails = useMemo(() => {
    return new Set(innerCircleSignals.map((item) => normalizeEmail(item.personEmail)));
  }, [innerCircleSignals]);

  const activeConnectionSignals = useMemo(() => {
    return sortByLastSeenDesc(
      dedupeByPerson(
        feed.items.filter((item) => {
          const email = normalizeEmail(item.personEmail);
          const sharedEvents = Number(item.payload?.sharedEvents || 0);

          return (
            item.type === 'active_connection' &&
            sharedEvents > 0 &&
            !innerCircleEmails.has(email)
          );
        })
      )
    ).slice(0, 15);
  }, [feed.items, innerCircleEmails]);

  const reconnectCards = useMemo(() => {
    return sortByLastSeenDesc(
      dedupeByPerson(
        feed.items.filter((item) => {
          const email = normalizeEmail(item.personEmail);
          return (
            item.type === 'reconnect_person' &&
            !!email &&
            !dismissedPeopleSuggestionIds.includes(email)
          );
        })
      )
    )
      .slice(0, 2)
      .map((item) => buildFriendCardFromSignal(item, profileMap, lang));
  }, [feed.items, profileMap, lang, dismissedPeopleSuggestionIds]);
  

  const reconnectEmails = useMemo(() => {
    return new Set(reconnectCards.map((card) => normalizeEmail(card.id)));
  }, [reconnectCards]);

  const activeConnectionEmails = useMemo(() => {
    return new Set(activeConnectionSignals.map((item) => normalizeEmail(item.personEmail)));
  }, [activeConnectionSignals]);
const sharedHistoryEmailSet = useMemo(() => {
  return new Set(
    feed.items
      .filter((item) => Number(item.payload?.sharedEvents || 0) > 0)
      .map((item) => normalizeEmail(item.personEmail))
      .filter(Boolean)
  );
}, [feed.items]);
  const suggestedCards = useMemo(() => {
    return dedupeByPerson(
      [...feed.items]
        .filter((item) => {
          const email = normalizeEmail(item.personEmail);
          const sharedEvents = Number(item.payload?.sharedEvents || 0);

          return (
            item.type === 'suggested_connection' &&
            item.payload?.reason === 'friend_of_friend' &&
            sharedEvents === 0 &&
            !innerCircleEmails.has(email) &&
            !reconnectEmails.has(email) &&
            !activeConnectionEmails.has(email) &&
            !sharedHistoryEmailSet.has(email) &&
            !dismissedPeopleSuggestionIds.includes(email)
          );
        })
        .sort((a, b) => {
          const aScore =
            (a.payload?.reason === 'friend_of_friend' ? 100 : 0) +
            (Array.isArray(a.payload?.bridges) ? a.payload.bridges.length : 0) +
            Number(a.payload?.mutualBridgeCount || 0) * 10;

          const bScore =
            (b.payload?.reason === 'friend_of_friend' ? 100 : 0) +
            (Array.isArray(b.payload?.bridges) ? b.payload.bridges.length : 0) +
            Number(b.payload?.mutualBridgeCount || 0) * 10;

          return bScore - aScore;
        })
    ).map((item) => buildFriendCardFromSignal(item, profileMap, lang));
  }, [
  feed.items,
  innerCircleEmails,
  reconnectEmails,
  activeConnectionEmails,
  sharedHistoryEmailSet,
  dismissedPeopleSuggestionIds,
  profileMap,
  lang,
]);

  const socialIntentCards = useMemo(() => {
    const rows = (Array.isArray(data.socialIntent) ? data.socialIntent : []) as SocialIntentRow[];

    const dedupedHostEmails = Array.from(
      new Set(rows.map((row: any) => normalizeEmail(row.host_email)).filter(Boolean))
    );

    return dedupedHostEmails
      .map((email) => {
        const profile = profileMap.get(email);
        const name = profile?.name || t(lang, 'people_person_fallback');

        const matchingRows = rows.filter(
          (row: any) => normalizeEmail(row.host_email) === email
        );

        const mostRecentRow = [...matchingRows].sort((a: any, b: any) => {
          const aMs = a?.updated_at ? new Date(a.updated_at).getTime() : 0;
          const bMs = b?.updated_at ? new Date(b.updated_at).getTime() : 0;
          return bMs - aMs;
        })[0];

        return {
          id: email,
          name,
          avatarUrl: profile?.avatarUrl || null,
          crossedPathsCount: 0,
          lastSeenLabel: mostRecentRow?.updated_at
            ? formatDate(mostRecentRow.updated_at)
            : '',
          lastSeenAtEventTitle: t(lang, 'people_future_plans'),
          sharedEventsCount: 0,
          hostedByYouCount: 0,
          hostedByThemCount: 0,
          wavesCount: 0,
          activity: [],
        } satisfies FriendCardData;
      })
      .filter((card) => {
        const email = normalizeEmail(String(card.id));
        return (
          !reconnectEmails.has(email) &&
          !dismissedPeopleSuggestionIds.includes(email)
        );
      });
  }, [data.socialIntent, profileMap, reconnectEmails, dismissedPeopleSuggestionIds, lang]);
  

  const hasAnyPeopleContent =
    innerCircleSignals.length > 0 ||
    activeConnectionSignals.length > 0 ||
    reconnectCards.length > 0 ||
    suggestedCards.length > 0 ||
    socialIntentCards.length > 0;

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <StyledText style={styles.headerTitle}>{t(lang, 'people_header_title')}</StyledText>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={COLORS.primary} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.tabsWrap}>
            <Pressable
              onPress={() => setActiveTab('connections')}
              style={[
                styles.tabPill,
                activeTab === 'connections' && styles.tabPillActive,
              ]}
            >
              <StyledText
                style={[
                  styles.tabPillText,
                  activeTab === 'connections' && styles.tabPillTextActive,
                ]}
              >
                {t(lang, 'people_tab_connections')}
              </StyledText>
            </Pressable>

            <Pressable
              onPress={() => setActiveTab('circles')}
              style={[
                styles.tabPill,
                activeTab === 'circles' && styles.tabPillActive,
              ]}
            >
              <StyledText
                style={[
                  styles.tabPillText,
                  activeTab === 'circles' && styles.tabPillTextActive,
                ]}
              >
                {t(lang, 'people_tab_circles')}
              </StyledText>
            </Pressable>
          </View>

          {activeTab === 'circles' ? (
            <CirclesSection
              circles={socialCircles}
              profileMap={profileMap}
              lang={lang}
              onPressNewCircle={openCreateCircle}
              onPressCircle={openManageCircle}
            />
          ) : hasAnyPeopleContent ? (
            <>
              {innerCircleSignals.length > 0 && (
                <PeopleAvatarSection
                  title={t(lang, 'people_closest_connections_title')}
                  subtitle={t(lang, 'people_closest_connections_subtitle')}
                  items={innerCircleSignals}
                  profileMap={profileMap}
                  showCountBadge
                  onPressPerson={handleOpenFriend}
                />
              )}

              {activeConnectionSignals.length > 0 && (
                <PeopleAvatarSection
                  title={t(lang, 'people_recent_connections_title')}
                  subtitle={t(lang, 'people_recent_connections_subtitle')}
                  items={activeConnectionSignals}
                  profileMap={profileMap}
                  showCountBadge
                  onPressPerson={handleOpenFriend}
                />
              )}

              {reconnectCards.length > 0 && (
                <CardSection
                  title={t(lang, 'people_reconnect_title')}
                  subtitle={t(lang, 'people_reconnect_subtitle')}
                  cards={reconnectCards}
                  lang={lang}
                  onDismissCard={handleDismissPeopleSuggestion}
                />
              )}

              {socialIntentCards.length > 0 && (
                <CardSection
                  title={t(lang, 'people_want_to_hear_from_title')}
                  subtitle={t(lang, 'people_want_to_hear_from_subtitle')}
                  cards={socialIntentCards}
                  lang={lang}
                  onDismissCard={handleDismissPeopleSuggestion}
                />
              )}

              {suggestedCards.length > 0 && (
                <CardSection
                  title={t(lang, 'people_second_degree_title')}
                  subtitle={t(lang, 'people_second_degree_subtitle')}
                  cards={suggestedCards}
                  lang={lang}
                  onDismissCard={handleDismissPeopleSuggestion}
                />
              )}
            </>
          ) : (
            <EmptyPeopleState
              lang={lang}
              onPressCreate={() => router.push('/create' as any)}
            />
          )}

          <View style={{ height: 80 }} />
        </ScrollView>
      )}

      {selectedFriend && (
        <Pressable
          style={styles.friendOverlay}
          onPress={() => setSelectedFriend(null)}
        >
          <View onStartShouldSetResponder={() => true}>
            <FriendCard friend={selectedFriend} lang={lang} />
          </View>
        </Pressable>
      )}

      {!!session?.user?.id && (
        <CircleManagerSheet
          visible={circleManagerVisible}
          circles={socialCircles}
          setCircles={setSocialCircles}
          userId={session.user.id}
          initialMode={circleManagerMode}
          initialCircle={activeCircle}
          onClose={closeCircleManager}
        />
      )}
    </SafeAreaView>
  );
}

function CirclesSection({
  circles,
  profileMap,
  lang,
  onPressNewCircle,
  onPressCircle,
}: {
  circles: Circle[];
  profileMap: Map<string, PersonProfile>;
  lang: AppLanguage;
  onPressNewCircle: () => void;
  onPressCircle: (circle: Circle) => void;
}) {
  const sortedCircles = [...circles].sort((a, b) => {
    return (b.members?.length || 0) - (a.members?.length || 0);
  });

  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <StyledText style={styles.sectionTitle}>{t(lang, 'people_circles_title')}</StyledText>
        <StyledText style={styles.sectionSubtitle}>
          {t(lang, 'people_circles_subtitle')}
        </StyledText>
      </View>

      <Pressable style={styles.newCircleRow} onPress={onPressNewCircle}>
        <View style={styles.newCircleIcon}>
          <StyledText style={styles.newCirclePlus}>+</StyledText>
        </View>

        <View style={{ flex: 1 }}>
          <StyledText style={styles.newCircleTitle}>
            {t(lang, 'people_new_circle_title')}
          </StyledText>
          <StyledText style={styles.newCircleBody}>
            {t(lang, 'people_new_circle_body')}
          </StyledText>
        </View>
      </Pressable>

      <View style={styles.circleList}>
        {sortedCircles.map((circle) => {
          const previewMembers = circle.members.slice(0, 3);
          const overflowCount = Math.max(0, circle.members.length - previewMembers.length);

          return (
            <View key={circle.id} style={styles.circleRowCard}>
              <Pressable
                style={styles.circleRowMain}
                onPress={() => onPressCircle(circle)}
              >
                <View style={styles.circleBadge}>
                  <StyledText style={styles.circleBadgeText}>
                    {initialsFor(circle.circle_name)}
                  </StyledText>
                </View>

                <View style={styles.circleRowContent}>
                  <View style={styles.circleRowHeader}>
                    <StyledText numberOfLines={1} style={styles.circleTitle}>
                      {circle.circle_name || t(lang, 'people_untitled_circle')}
                    </StyledText>

                    <StyledText style={styles.circleMemberCount}>
                      {circle.members.length}{' '}
                      {circle.members.length === 1
                        ? t(lang, 'people_member_singular')
                        : t(lang, 'people_member_plural')}
                    </StyledText>
                  </View>

                  {previewMembers.length > 0 ? (
                    <>
                      <View style={styles.circlePreviewRow}>
                        {previewMembers.map((member, index) => {
                          const email = normalizeEmail(member.member_email_lc);
                          const profile = email ? profileMap.get(email) : null;
                          const displayName = getCircleMemberDisplayName(
                            member,
                            profileMap,
                            lang
                          );

                          return (
                            <View
                              key={member.id}
                              style={[
                                styles.circlePreviewAvatarWrap,
                                index > 0 && styles.circlePreviewAvatarOverlap,
                              ]}
                            >
                              {profile?.avatarUrl ? (
                                <Image
                                  source={{
                                    uri: avatarFor(displayName, profile.avatarUrl),
                                  }}
                                  style={styles.circlePreviewAvatar}
                                />
                              ) : (
                                <View style={styles.circlePreviewFallback}>
                                  <StyledText style={styles.circlePreviewFallbackText}>
                                    {initialsFor(displayName)}
                                  </StyledText>
                                </View>
                              )}
                            </View>
                          );
                        })}

                        {overflowCount > 0 && (
                          <View
                            style={[
                              styles.circlePreviewOverflow,
                              styles.circlePreviewAvatarOverlap,
                            ]}
                          >
                            <StyledText style={styles.circlePreviewOverflowText}>
                              +{overflowCount}
                            </StyledText>
                          </View>
                        )}
                      </View>

                      <StyledText numberOfLines={1} style={styles.circlePreviewNames}>
                        {previewMembers
                          .map((member) =>
                            getCircleMemberDisplayName(member, profileMap, lang)
                          )
                          .join(', ')}
                      </StyledText>
                    </>
                  ) : (
                    <StyledText style={styles.circleEmptyText}>
                      {t(lang, 'people_no_members_yet')}
                    </StyledText>
                  )}
                </View>
              </Pressable>

              <Pressable
                style={styles.circleManageButton}
                onPress={() => onPressCircle(circle)}
              >
                <StyledText style={styles.circleManageButtonText}>
                  {t(lang, 'people_manage')}
                </StyledText>
              </Pressable>
            </View>
          );
        })}
      </View>
    </View>
  );
}

function PeopleAvatarSection({
  title,
  subtitle,
  items,
  profileMap,
  showCountBadge = false,
  onPressPerson,
}: {
  title: string;
  subtitle: string;
  items: FeedItem[];
  profileMap: Map<string, PersonProfile>;
  showCountBadge?: boolean;
  onPressPerson: (item: FeedItem) => void;
}) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <StyledText style={styles.sectionTitle}>{title}</StyledText>
        <StyledText style={styles.sectionSubtitle}>{subtitle}</StyledText>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.avatarRow}
      >
        {[...items]
  .sort((a, b) => {
    const aProfile = profileMap.get(normalizeEmail(a.personEmail));
    const bProfile = profileMap.get(normalizeEmail(b.personEmail));

    if (!!bProfile?.avatarUrl !== !!aProfile?.avatarUrl) {
      return Number(!!bProfile?.avatarUrl) - Number(!!aProfile?.avatarUrl);
    }

    const aName = aProfile?.name || a.payload?.name || '';
    const bName = bProfile?.name || b.payload?.name || '';

    return aName.localeCompare(bName);
  })
  .map((item) => {
          const email = normalizeEmail(item.personEmail);
          const profile = profileMap.get(email);
          const name =
  profile?.name ||
  item.payload?.full_name ||
  item.payload?.name ||
  item.payload?.displayName ||
  'Person';

          const sharedEvents = Number(item.payload?.sharedEvents || 0);

          return (
            <Pressable
              key={item.id}
              style={styles.avatarItem}
              onPress={() => onPressPerson(item)}
            >
              <View style={styles.avatarWrap}>
                <Image
                  source={{ uri: avatarFor(name, profile?.avatarUrl) }}
                  style={styles.avatarImage}
                />
                {showCountBadge && sharedEvents > 0 && (
                  <View style={styles.avatarCountBadge}>
                    <StyledText style={styles.avatarCountText}>
                      {sharedEvents}
                    </StyledText>
                  </View>
                )}
              </View>

              <StyledText numberOfLines={1} style={styles.avatarName}>
                {name}
              </StyledText>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

function CardSection({
  title,
  subtitle,
  cards,
  lang,
  onDismissCard,
}: {
  title: string;
  subtitle: string;
  cards: FriendCardData[];
  lang: AppLanguage;
  onDismissCard?: (friend: FriendCardData) => void;
}) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <StyledText style={styles.sectionTitle}>{title}</StyledText>
        <StyledText style={styles.sectionSubtitle}>{subtitle}</StyledText>
      </View>

      <View style={styles.cardsWrap}>
        {cards.map((friend) => (
          <FriendCard
            key={friend.id}
            friend={friend}
            lang={lang}
            onDismiss={onDismissCard ? () => onDismissCard(friend) : undefined}
          />
        ))}
      </View>
    </View>
  );
}

function EmptyPeopleState({
  lang,
  onPressCreate,
}: {
  lang: AppLanguage;
  onPressCreate: () => void;
}) {
  return (
    <View style={styles.emptyCard}>
      <StyledText style={styles.emptyTitle}>{t(lang, 'people_empty_title')}</StyledText>
      <StyledText style={styles.emptyBody}>{t(lang, 'people_empty_body')}</StyledText>

      <View style={styles.emptyActions}>
        <Pressable onPress={onPressCreate} style={styles.emptyButtonPrimary}>
          <StyledText style={styles.emptyButtonPrimaryText}>
            {t(lang, 'common_create')}
          </StyledText>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.background },
  header: { padding: 20 },
  headerTitle: { fontSize: 28, fontWeight: '900', color: COLORS.text },
  scrollContent: {
    padding: 20,
    gap: 20,
  },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  tabsWrap: {
    flexDirection: 'row',
    gap: 10,
  },
  tabPill: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: COLORS.iconBg,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
  },
  tabPillActive: {
    backgroundColor: COLORS.secondaryBg,
    borderColor: COLORS.borderStrong,
  },
  tabPillText: {
    fontWeight: '900',
    color: COLORS.textMuted,
  },
  tabPillTextActive: {
    color: COLORS.text,
  },

  section: {
    gap: 12,
  },
  sectionHeader: {
    gap: 4,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: COLORS.text,
  },
  sectionSubtitle: {
    fontSize: 13,
    color: COLORS.textMuted,
    lineHeight: 18,
  },

  circlesRow: {
    paddingRight: 10,
    gap: 12,
  },
  newCircleCard: {
    width: 180,
    minHeight: 168,
    borderRadius: 22,
    padding: 16,
    backgroundColor: COLORS.secondarySoft,
    borderWidth: 1,
    borderColor: '#e7d9f7',
    justifyContent: 'space-between',
  },
  newCircleIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.secondaryBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  newCirclePlus: {
    fontSize: 24,
    lineHeight: 24,
    fontWeight: '900',
    color: COLORS.secondaryText,
  },
  newCircleTitle: {
    fontSize: 17,
    fontWeight: '900',
    color: COLORS.text,
  },
  newCircleBody: {
    fontSize: 13,
    lineHeight: 18,
    color: COLORS.textMuted,
  },
  circleCard: {
    width: 220,
    minHeight: 168,
    borderRadius: 22,
    padding: 16,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    justifyContent: 'space-between',
  },
  circleCardMain: {
    flex: 1,
  },
  circleManageButton: {
    marginTop: 12,
    minHeight: 36,
    borderRadius: 12,
    backgroundColor: COLORS.secondarySoft,
    borderWidth: 1,
    borderColor: COLORS.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circleManageButtonText: {
    fontSize: 13,
    fontWeight: '900',
    color: COLORS.primary,
  },
  circleCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  circleBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.secondaryBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circleBadgeText: {
    fontSize: 12,
    fontWeight: '900',
    color: COLORS.secondaryText,
  },
  circleMemberCount: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.textMuted,
  },
  circleTitle: {
    marginTop: 8,
    fontSize: 17,
    fontWeight: '900',
    color: COLORS.text,
  },
  circlePreviewRow: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  circlePreviewAvatarWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: COLORS.surface,
  },
  circlePreviewAvatarOverlap: {
    marginLeft: -8,
  },
  circlePreviewAvatar: {
    width: '100%',
    height: '100%',
    backgroundColor: COLORS.iconBg,
  },
  circlePreviewFallback: {
    width: '100%',
    height: '100%',
    backgroundColor: COLORS.iconBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circlePreviewFallbackText: {
    fontSize: 11,
    fontWeight: '900',
    color: COLORS.text,
  },
  circlePreviewOverflow: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: COLORS.iconBg,
    borderWidth: 2,
    borderColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circlePreviewOverflowText: {
    fontSize: 10,
    fontWeight: '900',
    color: COLORS.textMuted,
  },
  circlePreviewNames: {
    marginTop: 10,
    fontSize: 13,
    color: COLORS.textMuted,
  },
  circleEmptyText: {
    marginTop: 12,
    fontSize: 13,
    color: COLORS.textMuted,
  },

  avatarRow: {
    paddingRight: 10,
    gap: 14,
  },
  avatarItem: {
    width: 72,
    alignItems: 'center',
  },
  avatarWrap: {
    position: 'relative',
  },
  avatarImage: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: COLORS.iconBg,
  },
  avatarCountBadge: {
    position: 'absolute',
    right: -4,
    bottom: -2,
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    paddingHorizontal: 6,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: COLORS.background,
  },
  avatarCountText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#fff',
  },
  avatarName: {
    marginTop: 8,
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.text,
    textAlign: 'center',
    width: '100%',
  },

  cardsWrap: {
    gap: 12,
  },

  emptyCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 10,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: COLORS.text,
  },
  emptyBody: {
    fontSize: 14,
    lineHeight: 20,
    color: COLORS.textMuted,
  },
  emptyActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
  },
  emptyButtonPrimary: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
  },
  emptyButtonPrimaryText: {
    color: '#fff',
    fontWeight: '800',
  },

  friendOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: COLORS.overlay,
    justifyContent: 'center',
    padding: 20,
  },
  newCircleRow: {
  flexDirection: 'row',
  alignItems: 'center',
  gap: 14,
  borderRadius: 22,
  padding: 16,
  backgroundColor: COLORS.secondarySoft,
  borderWidth: 1,
  borderColor: '#e7d9f7',
},

circleList: {
  gap: 12,
},

circleRowCard: {
  backgroundColor: COLORS.surface,
  borderRadius: 22,
  padding: 14,
  borderWidth: 1,
  borderColor: COLORS.border,
  gap: 12,
},

circleRowMain: {
  flexDirection: 'row',
  gap: 12,
},

circleRowContent: {
  flex: 1,
},

circleRowHeader: {
  flexDirection: 'row',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: 10,
},
});
