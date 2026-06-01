/**
 * Path: apps/mobile/app/(tabs)/index.tsx
 * Description: Feed surface composed into:
 * - What is Happening
 * - Reconnect
 * - Start Something
 */

import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import {
  ScrollView,
  View,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Pressable,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { Ionicons } from '@expo/vector-icons';

import { supabase, useSession } from '@pallinky/core';
import { StyledText, DASHBOARD_THEMES } from '@pallinky/ui';
import { t } from '@pallinky/i18n';
import { useI18n } from '@pallinky/i18n/client';
import type { AppLanguage, TranslationKey } from '@pallinky/i18n/types';

import MyPlansList from '../../components/dashboard/MyPlansList';
import FriendsActivities from '../../components/dashboard/FriendsActivities';
import PeopleYouMayKnow from '../../components/dashboard/PeopleYouMayKnow';
import { deriveFeedSignals, type FeedState } from '../../lib/feed/deriveFeed';
import {
  getEventAccessDecision,
  type EventAccessDecision,
} from '../../lib/visibility/getEventAccessDecision';

type IdeaPrompt = {
  key: string;
  emoji: string;
  titleKey: TranslationKey;
  subtitleKey: TranslationKey;
  prefillTitleKey?: TranslationKey;
  prefillDescKey?: TranslationKey;
  route: string;
};

const IDEA_PROMPTS: IdeaPrompt[] = [
  {
    key: 'start',
    emoji: '📅',
    titleKey: 'home_idea_make_plan_title',
    subtitleKey: 'home_idea_make_plan_subtitle',
    route: '/create',
  },
  {
    key: 'coffee',
  emoji: '☕',
  titleKey: 'home_idea_coffee_title',
  subtitleKey: 'home_idea_coffee_subtitle',
  prefillTitleKey: 'home_idea_coffee_prefill_title',
  prefillDescKey: 'home_idea_coffee_prefill_desc',
  route: '/create/vibe',
},
  {
    key: 'drinks',
    emoji: '🍸',
    titleKey: 'home_idea_drinks_title',
    subtitleKey: 'home_idea_drinks_subtitle',
    prefillTitleKey: 'home_idea_drinks_prefill_title',
prefillDescKey: 'home_idea_drinks_prefill_desc',
    route: '/create/vibe',
  },
  {
    key: 'dinner',
    emoji: '🍽️',
    titleKey: 'home_idea_dinner_title',
    subtitleKey: 'home_idea_dinner_subtitle',
    route: '/create/formal',
    prefillTitleKey: 'home_idea_dinner_prefill_title',
prefillDescKey: 'home_idea_dinner_prefill_desc',
    },
  {
    key: 'walk',
    emoji: '🚶',
    titleKey: 'home_idea_walk_title',
    subtitleKey: 'home_idea_walk_subtitle',
    route: '/create/vibe',
    
     prefillTitleKey: 'home_idea_walk_prefill_title',
prefillDescKey: 'home_idea_walk_prefill_desc',
    },

  {
    key: 'movie',
    emoji: '🎬',
    titleKey: 'home_idea_movie_title',
    subtitleKey: 'home_idea_movie_subtitle',
    route: '/create/vibe',
    
     prefillTitleKey: 'home_idea_movie_prefill_title',
prefillDescKey: 'home_idea_movie_prefill_desc',
    }, ];



function normalizeEmail(value: string | null | undefined) {
  return (value || '').toLowerCase().trim();
}

function normalizeId(value: unknown) {
  return String(value || '').trim();
}

export default function HomeScreen() {
  const router = useRouter();
  const { session } = useSession();
  const { language: lang } = useI18n();
  const inboxBadgeChannelName = useRef(
    `home-notifications-inbox-badge-${Date.now()}-${Math.random()}`
  );
  
useEffect(() => {
  if (!session?.user?.email) {
    router.replace('/welcome');
  }
}, [session?.user?.email, router]);
  const [loading, setLoading] = useState(true);
  const [themeKey, setThemeKey] = useState('classic');
  const [deviceContactCount, setDeviceContactCount] = useState(0);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [inboxBadgeCount, setInboxBadgeCount] = useState(0);

  const [data, setData] = useState<any>({
  events: [],
  rsvps: [],
  vibeResponses: [],
  secondDegreeEvents: [],
  secondDegreeRsvps: [],
  invites: [],
  socialCircles: [],
  relationships: [],
  contacts: [],
  userEmail: '',
  userPersonId: '',
  chatSummaries: {},
  accessByEventId: {},
});

  const loadData = async () => {
    if (!session?.user?.email) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const emailLower = normalizeEmail(session.user.email);

      const theme = await SecureStore.getItemAsync('pallinky_theme');
      if (theme) setThemeKey(theme);

      setDeviceContactCount(0);

      const [{ data: profile }, { data: mePeople }] = await Promise.all([
        supabase
          .from('profiles')
          .select('id, avatar_url')
          .eq('id', session.user.id)
          .maybeSingle(),
        supabase
          .from('people')
          .select('id, email_lc, matched_user_id')
          .or(`matched_user_id.eq.${session.user.id},email_lc.eq.${emailLower}`)
      ]);

      setAvatarUrl((profile as any)?.avatar_url || null);

const userPersonIds = Array.from(
  new Set(((mePeople as any[]) || []).map((person: any) => normalizeId(person?.id)).filter(Boolean))
);
const userPersonId = userPersonIds[0] || '';

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
        myRsvpsByEmailRes,
        myRsvpsByPersonRes,
        myVibeResponsesRes,
        circlesRes,
      ] = await Promise.all([
        supabase.from('events').select('*').eq('host_email', emailLower),

        supabase
          .from('event_invites')
          .select('event_id, invitee_email_lc, invitee_phone_e164, person_id, status')
          .eq('invitee_email_lc', emailLower),

        supabase
          .from('rsvps')
          .select('*')
          .eq('email_lc', emailLower),

        userPersonIds.length > 0
          ? supabase
              .from('rsvps')
              .select('*')
              .in('person_id', userPersonIds)
          : Promise.resolve({ data: [] }),

        supabase
          .from('vibe_responses')
          .select('*')
          .eq('user_email', emailLower),

        profile?.id
          ? supabase
              .from('social_circles')
              .select('id, circle_name, created_at')
              .eq('user_id', profile.id)
              .order('created_at', { ascending: false })
          : Promise.resolve({ data: [] }),

      ]);

      const myRsvpRows = Array.from(
        new Map(
          [...(myRsvpsByEmailRes.data || []), ...(myRsvpsByPersonRes.data || [])].map(
            (row: any) => [String(row.id), row]
          )
        ).values()
      );

      const circleRows = circlesRes.data || [];
      const circleIds = circleRows.map((circle: any) => circle.id);

      let circleMemberRows: any[] = [];
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
        circleMemberRows = membersRes || [];
      }

      const membersByCircleId = new Map<string, any[]>();
      circleRows.forEach((circle: any) => membersByCircleId.set(circle.id, []));
      circleMemberRows.forEach((row: any) => {
        const current = membersByCircleId.get(row.circle_id) || [];
        current.push(row);
        membersByCircleId.set(row.circle_id, current);
      });

      const socialCircles = circleRows.map((circle: any) => ({
        ...circle,
        members: membersByCircleId.get(circle.id) || [],
      }));

      const circleMemberEmails = Array.from(
        new Set(
          socialCircles
            .flatMap((circle: any) => (Array.isArray(circle?.members) ? circle.members : []))
            .map((member: any) => normalizeEmail(member?.member_email_lc))
            .filter((email: string) => email && email !== emailLower)
        )
      );

      const sharedHistoryEventIds = Array.from(
        new Set(
          myRsvpRows
            .map((r: any) => (r.event_id ? String(r.event_id) : null))
            .filter(Boolean)
        )
      );

      let sharedHistoryRsvps: any[] = [];
      if (sharedHistoryEventIds.length > 0) {
        const { data: sharedHistoryRows } = await supabase
          .from('rsvps')
          .select('event_id, person_id, email_lc, email')
          .in('event_id', sharedHistoryEventIds);

        sharedHistoryRsvps = sharedHistoryRows || [];
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
        const { data: relatedHostedEventsRes } = await supabase
          .from('events')
          .select('*')
          .in('host_email', relatedHostEmails);

        relatedHostedEvents = relatedHostedEventsRes || [];
      }

      const inviteEventIds = (invitesRes.data || []).map((i: any) => i.event_id);
      const rsvpEventIds = myRsvpRows.map((r: any) => r.event_id);
      const rsvpEventIdSet = new Set(rsvpEventIds.map((eventId: any) => String(eventId)));
      const vibeResponseEventIds = (myVibeResponsesRes.data || []).map((r: any) => r.event_id);

      const directEventIdsToLoad = Array.from(
        new Set([
          ...(hostedEventsRes.data || []).map((e: any) => e.id),
          ...inviteEventIds,
          ...rsvpEventIds,
          ...vibeResponseEventIds,
          ...relatedHostedEvents.map((e: any) => e.id),
        ])
      );

      let directEvents: any[] = [];
      if (directEventIdsToLoad.length > 0) {
        const { data: allEventsRes } = await supabase
          .from('events')
          .select('*')
          .in('id', directEventIdsToLoad);

        directEvents = allEventsRes || [];
      }

      const accessEntries = await Promise.all(
        directEvents.map(async (ev: any) => {
          const decision = await getEventAccessDecision({
            eventId: String(ev.id),
            viewerEmail: emailLower,
          });

          if (decision.can_see !== true && rsvpEventIdSet.has(String(ev.id))) {
            return [
              String(ev.id),
              {
                ...decision,
                can_see: true,
                has_existing_rsvp: true,
                reason: 'existing_rsvp',
              },
            ] as const;
          }

          return [String(ev.id), decision] as const;
        })
      );

      const accessByEventId: Record<string, EventAccessDecision> = Object.fromEntries(accessEntries);

      const visibleDirectEvents = directEvents.filter(
        (ev: any) => accessByEventId[String(ev.id)]?.can_see === true
      );

      const visibleDirectEventIds = visibleDirectEvents.map((ev: any) => String(ev.id));

      let directEventRsvps: any[] = [];
      if (visibleDirectEventIds.length > 0) {
        const { data: eventRsvpsRes } = await supabase
          .from('rsvps')
          .select('*')
          .in('event_id', visibleDirectEventIds);

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
        new Set(
          secondDegreeBridgeRsvps
            .map((r: any) => r.event_id)
            .filter(Boolean)
        )
      );

      let secondDegreeEvents: any[] = [];
      if (secondDegreeEventIds.length > 0) {
        const { data } = await supabase
          .from('events')
          .select('*')
          .in('id', secondDegreeEventIds);

        secondDegreeEvents = data || [];
      }

      const secondDegreeAccessEntries = await Promise.all(
        secondDegreeEvents.map(async (ev: any) => {
          const decision = await getEventAccessDecision({
            eventId: String(ev.id),
            viewerEmail: emailLower,
          });

          return [String(ev.id), decision] as const;
        })
      );

      for (const [eventId, decision] of secondDegreeAccessEntries) {
        if (!accessByEventId[eventId]) {
          accessByEventId[eventId] = decision;
        }
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
      for (const ev of [...visibleDirectEvents, ...secondDegreeEvents]) {
        allEventMap.set(String(ev.id), ev);
      }

      const allRsvpMap = new Map<string, any>();
      for (const r of [...directEventRsvps, ...secondDegreeEventRsvps]) {
        allRsvpMap.set(String(r.id), r);
      }

      const allEvents = Array.from(allEventMap.values());
      const eventRsvps = Array.from(allRsvpMap.values());

      const visibleInviteEventIds = new Set(visibleDirectEventIds);
      const visibleInvites = (invitesRes.data || []).filter((invite: any) =>
        visibleInviteEventIds.has(String(invite.event_id))
      );

      const chatSummaryPairs = await Promise.all(
        visibleDirectEvents.map(async (ev: any) => {
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

      setData({
  events: allEvents,
  rsvps: eventRsvps,
  vibeResponses: myVibeResponsesRes.data || [],
  secondDegreeEvents,
  secondDegreeRsvps: secondDegreeEventRsvps,
  invites: visibleInvites,
  socialCircles,
  relationships: relationshipRows || [],
  contacts: [],
  chatSummaries,
  accessByEventId,
  userEmail: emailLower,
  userPersonId,
  userPersonIds,
});
    } catch (error) {
      console.error('Social Feed data load failed', error);
    } finally {
      setLoading(false);
    }
  };

  const loadInboxBadgeCount = useCallback(async () => {
    try {
      const { data, error } = await supabase.rpc('get_my_unread_inbox_count');

      if (error) {
        console.log('Inbox badge load error:', error);
        return;
      }

      setInboxBadgeCount(typeof data === 'number' ? data : 0);
    } catch (err) {
      console.log('Inbox badge load exception:', err);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadData();
      void loadInboxBadgeCount();
    }, [session, loadInboxBadgeCount])
  );

  useEffect(() => {
    const channel = supabase
      .channel(inboxBadgeChannelName.current)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notifications_inbox' },
        () => {
          void loadInboxBadgeCount();
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [loadInboxBadgeCount]);

 const theme = DASHBOARD_THEMES[themeKey] || DASHBOARD_THEMES.classic;

  const feed = useMemo(() => {
    
    const result = deriveFeedSignals({
      data,
      deviceContactCount,
    });

    return result;
  }, [data, deviceContactCount]);

  const feedState: FeedState = feed.feedState;

  const brewingSignals = useMemo(() => {
  const accessByEventId = data.accessByEventId || {};

  const base = feed.items.filter((s) => {
    const evId = String(s?.payload?.id || s?.eventId || '');
    if (!evId) return false;
    if (accessByEventId[evId]?.can_see !== true) return false;

    return s.type === 'upcoming_plan' || s.type === 'event_starting_soon';
  });

  const hostedEvents = data.events
    .filter(
      (ev: any) =>
        normalizeEmail(ev.host_email) === data.userEmail &&
        accessByEventId[String(ev.id)]?.can_see === true
    )
    .map((ev: any) => ({
      id: `hosted_event:${ev.id}`,
      type: 'upcoming_plan',
      payload: ev,
    }));

  return [...hostedEvents, ...base];
}, [feed.items, data]);

const directFriendActivitySignals = useMemo(() => {
  return feed.items.filter(
    (s) =>
      (s.type === 'friend_created_event' || s.type === 'friend_attending_event') &&
      s.payload?._feed_scope !== 'second_degree'
  );
}, [feed.items]);

const secondDegreeActivitySignals = useMemo(() => {
  return feed.items.filter(
    (s) =>
      (s.type === 'friend_created_event' || s.type === 'friend_attending_event') &&
      s.payload?._feed_scope === 'second_degree'
  );
}, [feed.items]);

  const compactStartSomething = feedState === 'mature_network';
  const visibleIdeaPrompts =
    feedState === 'cold_start'
      ? IDEA_PROMPTS.slice(0, 5)
      : compactStartSomething
      ? IDEA_PROMPTS.slice(0, 3)
      : IDEA_PROMPTS.slice(0, 4);

  if (loading || !session?.user?.email) {
  return (
    <View style={styles.centered}>
      <ActivityIndicator color="#0077b6" size="large" />
    </View>
  );
}
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg }}>
      <View style={styles.header}>
        <View style={{ flex: 1, paddingRight: 12 }}>
          <StyledText style={[styles.mainTitle, { color: theme.text }]}>
            {t(lang, 'home_title')}
          </StyledText>
          <StyledText style={[styles.mainSubtitle, { color: '#66715f' }]}>
            {t(lang, 'home_subtitle')}
          </StyledText>
        </View>

        <View style={styles.headerActions}>
          <TouchableOpacity
            accessibilityLabel={t(lang, 'tab_inbox')}
            onPress={() => router.push('/inbox' as any)}
            style={styles.headerIconButton}
          >
            <Ionicons name="mail-outline" size={22} color="#0b1a2b" />
            {inboxBadgeCount > 0 ? (
              <View style={styles.headerBadge}>
                <StyledText style={styles.headerBadgeText}>
                  {inboxBadgeCount > 9 ? '9+' : inboxBadgeCount}
                </StyledText>
              </View>
            ) : null}
          </TouchableOpacity>

          <TouchableOpacity onPress={() => router.push('/profile')}>
            {session?.user?.email ? (
              <Image
                source={{
                  uri:
                    avatarUrl ||
                    `https://ui-avatars.com/api/?name=${encodeURIComponent(
                      session.user.email
                    )}&background=43691b&color=fff`,
                }}
                style={styles.avatar}
              />
            ) : null}
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {feedState === 'cold_start' ? (
          <>
            <FeedSectionHeader
              title={t(lang, 'home_start_something_title')}
              subtitle={t(lang, 'home_start_something_cold_subtitle')}
              theme={theme}
            />
            
<StartSomethingSection
  prompts={visibleIdeaPrompts}
  lang={lang}
  onPressPrompt={(prompt) =>
    router.push({
      pathname: prompt.route as any,
      params: {
        prefill_title: prompt.prefillTitleKey
          ? t(lang, prompt.prefillTitleKey)
          : t(lang, prompt.titleKey),
        prefill_desc: prompt.prefillDescKey
          ? t(lang, prompt.prefillDescKey)
          : t(lang, prompt.subtitleKey),
      },
    } as any)
  }
/>

            <FeedSectionHeader
              title={t(lang, 'home_happening_title')}
              subtitle={t(lang, 'home_happening_cold_subtitle')}
              theme={theme}
            />
            <EmptyBrewingCard theme={theme} lang={lang} />
          </>
        ) : (
          <>
            <FeedSectionHeader
              title={t(lang, 'home_happening_title')}
              subtitle={t(lang, 'home_happening_active_subtitle')}
              theme={theme}
            />
            <WhatIsBrewingSection
              data={data}
              theme={theme}
              signals={brewingSignals}
              onRefresh={loadData}
            />

            {directFriendActivitySignals.length > 0 && (
  <>
    <FeedSectionHeader
      title={t(lang, 'home_friends_active_title')}
      subtitle={t(lang, 'home_friends_active_subtitle')}
      theme={theme}
    />
    <FriendsActivities
      data={data}
      theme={theme}
      signals={directFriendActivitySignals}
      onRefresh={loadData}
    />
  </>
)}


{secondDegreeActivitySignals.length > 0 && (
  <>
    <FeedSectionHeader
      title={t(lang, 'home_extended_network_title')}
      subtitle={t(lang, 'home_extended_network_subtitle')}
      theme={theme}
    />
    <FriendsActivities
      data={data}
      theme={theme}
      signals={secondDegreeActivitySignals}
      onRefresh={loadData}
    />
  </>
)}

            {/* 
<ReconnectSection
  data={data}
  theme={theme}
  signals={feed.items}
  onRefresh={loadData}
  lang={lang}
/>
*/}

            <FeedSectionHeader
              title={t(lang, 'home_start_something_title')}
              subtitle={t(lang, 'home_start_something_warm_subtitle')}
              theme={theme}
              compact={compactStartSomething}
            />
           

<StartSomethingSection
  prompts={visibleIdeaPrompts}
  lang={lang}
  compact={compactStartSomething}
  onPressPrompt={(prompt) =>
    router.push({
      pathname: prompt.route as any,
      params: {
        prefill_title: prompt.prefillTitleKey
          ? t(lang, prompt.prefillTitleKey)
          : t(lang, prompt.titleKey),
        prefill_desc: prompt.prefillDescKey
          ? t(lang, prompt.prefillDescKey)
          : t(lang, prompt.subtitleKey),
      },
    } as any)
  }
/>
          </>
        )}

        <View style={{ height: 24 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function FeedSectionHeader({
  title,
  subtitle,
  theme,
  compact = false,
}: {
  title: string;
  subtitle?: string;
  theme: any;
  compact?: boolean;
}) {
  return (
    <View style={[styles.sectionHeader, compact && styles.sectionHeaderCompact]}>
      <StyledText style={[styles.sectionTitle, { color: theme.text }]}>{title}</StyledText>
      {subtitle ? (
        <StyledText style={styles.sectionSubtitle}>
          {subtitle}
        </StyledText>
      ) : null}
    </View>
  );
}

function WhatIsBrewingSection({
  data,
  theme,
  onRefresh,
  signals,
}: {
  data: any;
  theme: any;
  signals: any[];
  onRefresh?: () => void;
}) {
  return (
    <View>
      <MyPlansList
        data={data}
        theme={theme}
        signals={signals}
        onRefresh={onRefresh}
      />
    </View>
  );
}

function ReconnectSection({
  data,
  theme,
  signals,
  onRefresh,
  lang,
}: {
  data: any;
  theme: any;
  signals: any[];
  onRefresh?: () => void;
  lang: AppLanguage;
}) {
  const suggestionSignals = signals.filter((s) => s.type === 'suggested_connection');

  if (suggestionSignals.length === 0) return null;

  return (
    <>
      <FeedSectionHeader
        title={t(lang, 'home_connect_title')}
        subtitle={t(lang, 'home_connect_subtitle')}
        theme={theme}
      />

      <PeopleYouMayKnow
        data={data}
        theme={theme}
        signals={suggestionSignals}
        onRefresh={onRefresh}
      />
    </>
  );
}

function StartSomethingSection({
  prompts,
  onPressPrompt,
  lang,
  compact = false,
}: {
  prompts: IdeaPrompt[];
  onPressPrompt: (prompt: IdeaPrompt) => void;
  lang: AppLanguage;
  compact?: boolean;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.ideaScrollContent}
    >
      {prompts.map((prompt) => (
        <Pressable
          key={prompt.key}
          onPress={() => onPressPrompt(prompt)}
          style={({ pressed }) => [
            styles.ideaCard,
            compact && styles.ideaCardCompact,
            pressed && { opacity: 0.9 },
          ]}
        >
          <StyledText style={styles.ideaEmoji}>{prompt.emoji}</StyledText>
          <StyledText style={styles.ideaTitle}>{t(lang, prompt.titleKey)}</StyledText>
          <StyledText style={styles.ideaSubtitle}>{t(lang, prompt.subtitleKey)}</StyledText>

          <View style={styles.ideaFooter}>
            <StyledText style={styles.ideaAction}>{t(lang, 'common_start')}</StyledText>
            <Ionicons name="arrow-forward" size={14} color="#1f2a1b" />
          </View>
        </Pressable>
      ))}
    </ScrollView>
  );
}

function EmptyBrewingCard({ theme, lang }: { theme: any; lang: AppLanguage }) {
  return (
    <View
      style={[
        styles.utilityCard,
        { borderColor: theme.border || '#e5e7eb', backgroundColor: '#ffffff' },
      ]}
    >
      <View style={styles.utilityIconWrap}>
        <Ionicons name="sparkles-outline" size={20} color="#1f2a1b" />
      </View>
      <View style={{ flex: 1 }}>
        <StyledText style={styles.utilityTitle}>{t(lang, 'home_empty_activity_title')}</StyledText>
        <StyledText style={styles.utilitySubtitle}>
          {t(lang, 'home_empty_activity_subtitle')}
        </StyledText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F6F7F9',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerIconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  headerBadge: {
    position: 'absolute',
    right: 1,
    top: 1,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    paddingHorizontal: 4,
    backgroundColor: '#6A4C93',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerBadgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '900',
    lineHeight: 11,
  },
  avatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#eee',
  },
  mainTitle: {
    fontSize: 26,
    fontWeight: '900',
    letterSpacing: 0,
    color: '#1f2a1b',
    lineHeight: 31,
  },
  scrollContent: {
    paddingBottom: 132,
    backgroundColor: '#F6F7F9',
  },
  sectionHeader: {
    paddingHorizontal: 16,
    marginTop: 16,
    marginBottom: 8,
  },
  sectionHeaderCompact: {
    marginTop: 12,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: 0,
    color: '#1f2a1b',
  },
  sectionSubtitle: {
    fontSize: 13,
    marginTop: 4,
    color: '#66715f',
  },
  ideaScrollContent: {
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 4,
  },
  ideaCard: {
    width: 170,
    minHeight: 150,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    padding: 14,
    marginRight: 12,
    borderWidth: 1,
    borderColor: '#bac9ad',
    justifyContent: 'space-between',
  },
  ideaCardCompact: {
    width: 155,
    minHeight: 136,
  },
  ideaEmoji: {
    fontSize: 24,
  },
  ideaTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1f2a1b',
    marginTop: 10,
  },
  ideaSubtitle: {
    fontSize: 12,
    color: '#66715f',
    marginTop: 6,
    lineHeight: 17,
  },
  ideaFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 14,
  },
  ideaAction: {
    fontSize: 12,
    fontWeight: '800',
    color: '#43691b',
  },
  utilityCard: {
    marginHorizontal: 16,
    marginTop: 6,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#bac9ad',
    backgroundColor: '#FFFFFF',
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  utilityIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#bac9ad',
    alignItems: 'center',
    justifyContent: 'center',
  },
  utilityTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1f2a1b',
  },
  mainSubtitle: {
    marginTop: 6,
    fontSize: 13,
    color: '#66715f',
    lineHeight: 18,
  },
  utilitySubtitle: {
    fontSize: 12,
    color: '#66715f',
    marginTop: 3,
    lineHeight: 17,
  },
});
