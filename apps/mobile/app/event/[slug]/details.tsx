/**
 * Path: app/event/[slug]/details.tsx
 * Description: Canonical event details page with clearer RSVP hierarchy and chat actions.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  TouchableOpacity,
  Image,
  Platform,
  Linking,
  StatusBar,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { supabase, useSession } from '@pallinky/core';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

import { CalendarButton } from '@pallinky/ui';
import { getEventAccessDecision } from '../../../lib/visibility/getEventAccessDecision';
import DetailsGuestsSection from './components/DetailsGuestsSection';
import DetailsApprovalsModal from './components/DetailsApprovalsModal';
import DetailsSeriesSection from './components/DetailsSeriesSection';
import { useI18n } from '@pallinky/i18n/client';
import type { AppLanguage } from '@pallinky/i18n/types';
import { getExternalUrlDomain, normalizeExternalUrl } from '../../../lib/externalUrl';

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
  danger: '#C62828',
  dangerBg: '#fdecec',
  successBg: '#eef6e8',
};

const PALETTES: Record<string, { bg: string; accent: string; text: string; isDark: boolean }> = {
  zen: { bg: '#F6F7F9', accent: '#43691b', text: '#1f2a1b', isDark: false },
  girly: { bg: '#f4bbd3', accent: '#fe5d9f', text: '#2b1f24', isDark: false },
  fiesta: { bg: '#1729ae', accent: '#fe20e8', text: '#ffffff', isDark: true },
  classy: { bg: '#03172f', accent: '#efd466', text: '#fff7b6', isDark: true },
  spicy: { bg: '#656c12', accent: '#ecc216', text: '#ffffff', isDark: true },
  submerged: { bg: '#F6F7F9', accent: '#6A4C93', text: '#1f2a1b', isDark: false },
};

type Theme = {
  bg: string;
  accent: string;
  text: string;
  isDark: boolean;
};

type BaseEventKind = 'fixed_date' | 'poll' | 'reach_out';
type EventKind = BaseEventKind | 'series';

type EventModel = {
  kind: EventKind;
  baseKind: BaseEventKind;
  isSeries: boolean;
};

function getExternalLinkText(value: string | null | undefined, fallback: string) {
  return getExternalUrlDomain(value) || fallback;
}

function getEventModel(event: any): EventModel {
  const eventType = normalizeStatus(event?.event_type);
  const isSeries = !!event?.series_id;

  let baseKind: BaseEventKind = 'fixed_date';

  if (eventType === 'poll' || eventType === 'vibe') {
    baseKind = 'poll';
  } else if (eventType === 'reach_out') {
    baseKind = 'reach_out';
  }

  return {
    kind: isSeries ? 'series' : baseKind,
    baseKind,
    isSeries,
  };
}

function normalizeEmail(value: string | null | undefined) {
  return value?.toLowerCase().trim() || '';
}

function normalizeStatus(value: string | null | undefined) {
  return value?.toLowerCase().trim() || '';
}

function getFirstName(value: string | null | undefined, fallback = 'Guest') {
  return (value || '').trim().split(' ')[0] || fallback;
}

function getInviteName(inv: any) {
  return (
    inv.invitee_name ||
    inv.invitee_phone_e164 ||
    'Guest'
  );
}

function localeForLanguage(language: AppLanguage) {
  return language === 'fr' ? 'fr-FR' : language === 'nl' ? 'nl-NL' : 'en-US';
}

function formatEventDate(event: any, language: AppLanguage, t: any) {
  if (!event?.starts_at) return t('event_card_date_tbd');

  const date = new Date(event.starts_at);
  return date.toLocaleDateString(localeForLanguage(language), {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    ...(event?.event_time_zone ? { timeZone: event.event_time_zone } : {}),
  });
}

function formatEventTime(event: any, language: AppLanguage) {
  if (!event?.starts_at) return '';

  const date = new Date(event.starts_at);
  const formatOptions = {
    hour: 'numeric' as const,
    minute: '2-digit' as const,
    ...(event?.event_time_zone ? { timeZone: event.event_time_zone } : {}),
  };
  const startTime = date.toLocaleTimeString(localeForLanguage(language), formatOptions);

  if (!event?.ends_at) return startTime;

  const endDate = new Date(event.ends_at);
  if (Number.isNaN(endDate.getTime())) return startTime;

  return `${startTime}–${endDate.toLocaleTimeString(localeForLanguage(language), formatOptions)}`;
}

function getRsvpLabel(status: string | null | undefined, t: any) {
  const normalized = normalizeStatus(status);

  if (normalized === 'yes' || normalized === 'going') return t('event_status_going');
  if (normalized === 'maybe' || normalized === 'interested') return t('event_status_maybe');
  if (normalized === 'no' || normalized === 'not_going' || normalized === 'declined') {
    return t('event_status_not_going');
  }

  return t('event_status_invited');
}
function getSeriesIndex(seriesEvents: any[], currentEventId: string) {
  const sorted = [...seriesEvents]
    .filter(e => !!e.starts_at)
    .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime());

  const index = sorted.findIndex(e => e.id === currentEventId);
  return index >= 0 ? index + 1 : null;
}
function HostHeaderSection({
  theme,
  hostAvatarUrl,
  hostNameFirst,
  hostName,
  canOpenHostDm,
  openingDmForEmail,
  hostEmailLc,
  onOpenHostDm,
  t,
}: {
  theme: Theme;
  hostAvatarUrl: string | null;
  hostNameFirst: string;
  hostName: string;
  canOpenHostDm: boolean;
  openingDmForEmail: string | null;
  hostEmailLc: string;
  onOpenHostDm: () => void;
  t: any;
}) {
  return (
    <View style={styles.hostHeaderWrap}>
      <TouchableOpacity
        style={styles.hostHeaderRow}
        activeOpacity={canOpenHostDm ? 0.82 : 1}
        onPress={canOpenHostDm ? onOpenHostDm : undefined}
        disabled={!canOpenHostDm || openingDmForEmail === hostEmailLc}
      >
        <View style={styles.hostAvatarWrap}>
          {hostAvatarUrl ? (
            <Image source={{ uri: hostAvatarUrl }} style={styles.hostAvatarImage} />
          ) : (
            <View style={styles.hostAvatarFallback}>
              <Text style={styles.hostAvatarFallbackText}>
                {hostNameFirst.charAt(0).toUpperCase()}
              </Text>
            </View>
          )}

          {canOpenHostDm ? (
            <View style={[styles.hostAvatarMessageBadge, { backgroundColor: theme.accent }]}>
              <MaterialCommunityIcons name="message-text-outline" size={10} color="#fff" />
            </View>
          ) : null}
        </View>

        <View style={styles.hostHeaderTextWrap}>
          <Text style={[styles.hostHeaderText, { color: theme.text }]}>
           {t('event_organized_by', { host: hostName })}
          </Text>

          {canOpenHostDm && openingDmForEmail === hostEmailLc ? (
            <Text style={[styles.hostHeaderSubtext, { color: theme.accent }]}>
              Opening message...
            </Text>
          ) : null}
        </View>
      </TouchableOpacity>
    </View>
  );
}

function EventInfoSection({
  theme,
  locationText,
  description,
  eventDateText,
  eventTimeText,
}: {
  theme: Theme;
  locationText: string | null | undefined;
  description: string | null | undefined;
  eventDateText: string;
  eventTimeText: string;
}) {
  const openMap = () =>
    Linking.openURL(
      Platform.OS === 'ios' ? `maps:0,0?q=${locationText}` : `geo:0,0?q=${locationText}`
    );

  return (
    <View
      style={[
        styles.eventInfoCard,
        {
          backgroundColor: theme.isDark ? 'rgba(255,255,255,0.08)' : SYSTEM.surface,
          borderColor: theme.accent,
          shadowColor: '#000',
          shadowOpacity: theme.isDark ? 0.25 : 0.08,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 6 },
          elevation: 3,
        },
      ]}
    >
      <View style={styles.eventInfoTopRow}>
        <View style={[styles.eventInfoIconWrap, { backgroundColor: `${theme.accent}18` }]}>
          <MaterialCommunityIcons name="calendar-clock" size={22} color={theme.accent} />
        </View>

        <View style={styles.eventInfoTextWrap}>
          <Text style={[styles.eventInfoTitle, { color: theme.text }]}>
            {eventDateText}
            {eventTimeText ? `, ${eventTimeText}` : ''}
          </Text>

          {!!locationText && (
            <TouchableOpacity activeOpacity={0.8} onPress={openMap}>
              <Text
                style={[
                  styles.eventInfoLocation,
                  { color: theme.accent, marginBottom: description ? 4 : 0 },
                ]}
                numberOfLines={1}
              >
                {locationText}
              </Text>
            </TouchableOpacity>
          )}

          {!!description && (
            <Text style={[styles.eventInfoDescription, { color: theme.text }]} numberOfLines={2}>
              {description}
            </Text>
          )}
        </View>
      </View>

    </View>
  );
}

function PollDatesSection({
  theme,
  proposedDates,
  pollResponses,
  t,
  language,
}: {
  theme: Theme;
  proposedDates: string[];
  pollResponses: any[];
  t: any;
  language: AppLanguage;
}) {
  if (!proposedDates?.length) return null;

  const results = proposedDates
    .map((dateValue: string) => {
      const voters = (pollResponses || []).filter((response: any) =>
        Array.isArray(response.selected_dates) &&
        response.selected_dates.includes(dateValue)
      );

      return {
        dateValue,
        voters,
        voteCount: voters.length,
      };
    })
    .sort((a, b) => b.voteCount - a.voteCount);

  const topVoteCount = results[0]?.voteCount || 0;

  return (
    <View style={styles.pollContainer}>
      <Text style={[styles.sectionTitle, { color: theme.text }]}>{t('event_poll_results')}</Text>

      <View style={styles.pollResultsList}>
        {results.map((result) => {
          const isMostPopular = result.voteCount > 0 && result.voteCount === topVoteCount;

          return (
            <View
              key={result.dateValue}
              style={[
                styles.pollResultCard,
                {
                  backgroundColor: theme.isDark ? 'rgba(255,255,255,0.08)' : SYSTEM.surface,
                  borderColor: isMostPopular ? theme.accent : SYSTEM.borderSoft,
                },
              ]}
            >
              <View style={styles.pollResultHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.pollResultDate, { color: theme.text }]}>
                    {new Date(result.dateValue).toLocaleDateString(localeForLanguage(language), {
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric',
                    })}
                  </Text>

                  <Text style={[styles.pollResultTime, { color: theme.text }]}>
                    {new Date(result.dateValue).toLocaleTimeString(localeForLanguage(language), {
                      hour: 'numeric',
                      minute: '2-digit',
                    })}
                  </Text>
                </View>

                <View
                  style={[
                    styles.pollVoteBadge,
                    { backgroundColor: isMostPopular ? theme.accent : SYSTEM.borderSoft },
                  ]}
                >
                  <Text
                    style={[
                      styles.pollVoteBadgeText,
                      { color: isMostPopular ? '#fff' : SYSTEM.text },
                    ]}
                  >
                    {result.voteCount}
                  </Text>
                </View>
              </View>

              {isMostPopular ? (
                <Text style={[styles.pollPopularLabel, { color: theme.accent }]}>
                  {t('event_most_popular')}
                </Text>
              ) : null}

              <View style={styles.pollVoterList}>
                {result.voters.length > 0 ? (
                  result.voters.map((voter: any, index: number) => (
                    <Text
                      key={`${result.dateValue}-${voter.id || voter.user_email || index}`}
                      style={[styles.pollVoterName, { color: theme.text }]}
                    >
                      {voter.guest_name || t('event_guest_fallback')}
                    </Text>
                  ))
                ) : (
                  <Text style={[styles.pollNoVotes, { color: theme.text }]}>{t('event_no_votes')}</Text>
                )}
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}

function HostActionsSection({
  theme,
  pendingApprovals,
  onInvite,
  onOpenRequests,
  t,
}: {
  theme: Theme;
  pendingApprovals: any[];
  onInvite: () => void;
  onOpenRequests: () => void;
  t: any;
}) {
  return (
    <View style={styles.hostActionsRow}>
      <TouchableOpacity
        style={[
          styles.hostActionBtn,
          {
            borderColor: theme.accent,
            backgroundColor: theme.isDark ? 'transparent' : SYSTEM.surface,
          },
        ]}
        onPress={onInvite}
      >
        <Text style={[styles.hostActionText, { color: theme.text }]}>{t('event_share')}</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[
          styles.hostActionBtn,
          {
            borderColor: theme.accent,
            backgroundColor: theme.isDark ? 'transparent' : SYSTEM.surface,
          },
        ]}
        onPress={onOpenRequests}
      >
        <Text style={[styles.hostActionText, { color: theme.text }]}>
          {t('event_requests')}{pendingApprovals.length > 0 ? ` (${pendingApprovals.length})` : ''}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

function PendingApprovalsPreviewSection({
  theme,
  pendingApprovals,
  profileNamesByEmail,
  t,
}: {
  theme: Theme;
  pendingApprovals: any[];
  profileNamesByEmail: Record<string, string>;
  t: any;
}) {
  if (!pendingApprovals.length) return null;

  return (
    <>
      <Text style={[styles.sectionTitle, { color: theme.text }]}>
        {t('event_pending_approvals')} ({pendingApprovals.length})
      </Text>

      <View style={styles.peopleList}>
        {pendingApprovals.map((req: any, i: number) => {
          const emailLc = normalizeEmail(req.requester_email || req.email);
          const label =
            profileNamesByEmail[emailLc] ||
            req.requester_name ||
            req.requester_email ||
            req.email ||
            'Guest';

          return (
            <View
              key={req.id || `${label}-${i}`}
              style={[
                styles.personCard,
                {
                  backgroundColor: theme.isDark ? 'rgba(255,255,255,0.08)' : SYSTEM.surface,
                  borderColor: theme.isDark ? 'rgba(255,255,255,0.10)' : SYSTEM.borderSoft,
                },
              ]}
            >
              <Text style={[styles.personName, { color: theme.text }]}>
                {getFirstName(label, t('event_guest_fallback'))}
              </Text>
              <Text style={[styles.personStatus, { color: theme.text }]}>{t('event_pending_approval')}</Text>
            </View>
          );
        })}
      </View>
    </>
  );
}

export default function EventDetailsPage() {
  const { language, t } = useI18n();
  const { slug, token, fromOnboardingGate } = useLocalSearchParams<{
    slug: string;
    token?: string;
    fromOnboardingGate?: string;
  }>();
  const router = useRouter();
  const { session } = useSession();

  const [loading, setLoading] = useState(true);
  const [event, setEvent] = useState<any>(null);
  const [seriesEvents, setSeriesEvents] = useState<any[]>([]);
  const [guests, setGuests] = useState<any[]>([]);
  const [invites, setInvites] = useState<any[]>([]);
  const [approvalsOpen, setApprovalsOpen] = useState(false);
  const [resolvingRequestId, setResolvingRequestId] = useState<string | null>(null);
  const [allRsvps, setAllRsvps] = useState<any[]>([]);
const [pollResponses, setPollResponses] = useState<any[]>([]);
const [pendingApprovals, setPendingApprovals] = useState<any[]>([]);
  const [profileNamesByEmail, setProfileNamesByEmail] = useState<Record<string, string>>({});
  const [profileAvatarsByEmail, setProfileAvatarsByEmail] = useState<Record<string, string>>({});
  const [hostAvatarUrl, setHostAvatarUrl] = useState<string | null>(null);
  const [myRsvp, setMyRsvp] = useState<any>(null);
  const [myPersonIds, setMyPersonIds] = useState<string[]>([]);
  const [chatSummary, setChatSummary] = useState<any>(null);
  const [accessDecision, setAccessDecision] = useState<any>(null);
  const [blocked, setBlocked] = useState(false);
  const [openingDmForEmail, setOpeningDmForEmail] = useState<string | null>(null);

  const viewerEmail = normalizeEmail(session?.user?.email);

  const theme = useMemo(
    () => (event?.gif_key && event.gif_key in PALETTES ? PALETTES[event.gif_key] : PALETTES.zen),
    [event]
  );

  const fetchData = useCallback(async () => {
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
        setSeriesEvents([]);
        setGuests([]);
        setInvites([]);
        setAllRsvps([]);
setPollResponses([]);
        setPendingApprovals([]);
        setProfileNamesByEmail({});
        setProfileAvatarsByEmail({});
        setHostAvatarUrl(null);
        setMyRsvp(null);
        setChatSummary(null);
        return;
      }

      let claimedPersonId: string | null = null;
      const cleanToken = typeof token === 'string' ? token.trim() : '';

      if (cleanToken && session?.user?.id) {
        const { data: claimData, error: claimError } = await supabase.rpc(
          'claim_guest_event_token',
          {
            p_slug: slug,
            p_guest_token: cleanToken,
          }
        );

        if (claimError) {
          console.error('Guest token claim failed', claimError);
        } else {
          const claimRow = Array.isArray(claimData) ? claimData[0] : claimData;
          claimedPersonId = claimRow?.person_id ? String(claimRow.person_id) : null;
        }
      }

      const { data: personRows } = session?.user?.id
        ? await supabase
            .from('people')
            .select('id')
            .or(`matched_user_id.eq.${session.user.id},email_lc.eq.${viewerEmail}`)
        : { data: [] as any[] };

      const nextMyPersonIds = Array.from(
        new Set(
          [
            claimedPersonId,
            ...((personRows || []).map((row: any) => (row?.id ? String(row.id) : null))),
          ].filter(Boolean) as string[]
        )
      );

      setMyPersonIds(nextMyPersonIds);

      const decision = await getEventAccessDecision({
        eventId: String(eventData.id),
        viewerEmail: viewerEmail || null,
        guestToken: cleanToken || null,
      });

      const [claimedRsvpAccess, claimedRequestAccess] = nextMyPersonIds.length > 0
        ? await Promise.all([
            supabase
              .from('rsvps')
              .select('id')
              .eq('event_id', eventData.id)
              .in('person_id', nextMyPersonIds)
              .limit(1),
            supabase
              .from('rsvp_join_requests')
              .select('id')
              .eq('event_id', eventData.id)
              .eq('status', 'pending')
              .in('person_id', nextMyPersonIds)
              .limit(1),
          ])
        : [{ data: [] as any[] }, { data: [] as any[] }];

      const hasClaimedAccess =
        (claimedRsvpAccess.data || []).length > 0 ||
        (claimedRequestAccess.data || []).length > 0;

      const effectiveDecision =
        decision.can_see === true || hasClaimedAccess
          ? {
              ...decision,
              can_see: true,
              has_existing_rsvp:
                decision.has_existing_rsvp === true ||
                (claimedRsvpAccess.data || []).length > 0,
            }
          : decision;

      setAccessDecision(effectiveDecision);

      if (effectiveDecision.can_see !== true) {
        setBlocked(true);
        setEvent(eventData);
        setSeriesEvents([]);
        setGuests([]);
        setInvites([]);
        setAllRsvps([]);
setPollResponses([]);
        setPendingApprovals([]);
        setProfileNamesByEmail({});
        setProfileAvatarsByEmail({});
        setHostAvatarUrl(null);
        setMyRsvp(null);
        setChatSummary(null);
        return;
      }

      setBlocked(false);
      setEvent(eventData);

      const hostEmail = normalizeEmail(eventData.host_email);

      setHostAvatarUrl(
        profileAvatarsByEmail[hostEmail] ??
          eventData.hostAvatarUrl ??
          eventData.host_avatar_url ??
          null
      );

      const seriesPromise = eventData.series_id
        ? supabase
            .from('events')
            .select('id, slug, title, starts_at, ends_at, event_time_zone, event_type, manage_handle, series_id')
            .eq('series_id', eventData.series_id)
            .order('starts_at', { ascending: true, nullsFirst: false })
        : Promise.resolve({ data: [], error: null });

      const isHostViewer =
        viewerEmail !== '' && normalizeEmail(eventData.host_email) === viewerEmail;

      const canSeeInviteList = isHostViewer || eventData.invite_list_visibility !== 'host_only';

      const invitesPromise = canSeeInviteList
        ? supabase
            .from('event_invites')
            .select(
              'id, invitee_name, invitee_email_lc, invitee_phone_e164, created_at, status, revoked_at, source_type, source_ref, invite_link_mode'
            )
.eq('event_id', eventData.id)
.is('revoked_at', null)
.order('created_at', { ascending: false })
        : Promise.resolve({ data: [], error: null });

      const [seriesRes, rsvpRes, pollResponsesRes, guestListRes, pendingRes, invitesRes] =
  await Promise.all([
    seriesPromise,
    supabase.from('rsvps').select('*').eq('event_id', eventData.id),
    supabase
      .from('vibe_responses')
      .select('id, event_id, guest_name, user_email, selected_dates, note, created_at')
      .eq('event_id', eventData.id),
    supabase.rpc('get_guest_list', {
      p_slug: slug,
      p_viewer_email: viewerEmail || null,
    }),
    isHostViewer
      ? supabase
          .from('rsvp_join_requests')
          .select('*')
          .eq('event_id', eventData.id)
          .eq('status', 'pending')
          .order('created_at', { ascending: false })
      : Promise.resolve({ data: [], error: null }),
    invitesPromise,
  ]);
    if (seriesRes.error) throw seriesRes.error;
if (pollResponsesRes.error) throw pollResponsesRes.error;
if (invitesRes.error) throw invitesRes.error;

      setSeriesEvents(seriesRes.data || []);

      const rsvps = rsvpRes.data || [];
      const guestList = effectiveDecision.can_see_guest_list === true ? guestListRes.data || [] : [];

    setAllRsvps(rsvps);
setPollResponses(pollResponsesRes.data || []);
setGuests(guestList);
setInvites(invitesRes.data || []);
      setPendingApprovals(pendingRes.data || []);

      const emailSet = new Set<string>();

      if (hostEmail) emailSet.add(hostEmail);

      (pendingRes.data || []).forEach((r: any) => {
        const email = normalizeEmail(r.requester_email || r.email);
        if (email) emailSet.add(email);
      });

      (rsvps || []).forEach((rsvp: any) => {
        const email = normalizeEmail(rsvp.email_lc || rsvp.email);
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
          const key = normalizeEmail(p.email_lc);
          if (!key) return;
          if (p.full_name) nameMap[key] = p.full_name;
          if (p.avatar_url) avatarMap[key] = p.avatar_url;
        });

        setProfileNamesByEmail(nameMap);
        setProfileAvatarsByEmail(avatarMap);
        setHostAvatarUrl(
          avatarMap[hostEmail] ?? eventData.hostAvatarUrl ?? eventData.host_avatar_url ?? null
        );
      } else {
        setProfileNamesByEmail({});
        setProfileAvatarsByEmail({});
        setHostAvatarUrl(eventData.hostAvatarUrl ?? eventData.host_avatar_url ?? null);
      }

      const nextMyRsvp =
        rsvps.find((rsvp: any) => {
          const rsvpPersonId = rsvp.person_id ? String(rsvp.person_id) : '';
          return (
            normalizeEmail(rsvp.email_lc || rsvp.email) === viewerEmail ||
            (!!rsvpPersonId && nextMyPersonIds.includes(rsvpPersonId))
          );
        }) ||
        null;

      setMyRsvp(nextMyRsvp);

      if (viewerEmail) {
        const { data: chatData } = await supabase.rpc('get_event_chat_summary', {
          p_event_id: eventData.id,
          p_user_email: viewerEmail,
        });

        if (chatData && chatData.length > 0) {
          setChatSummary(chatData[0]);
        } else {
          setChatSummary(null);
        }
      } else {
        setChatSummary(null);
      }
    } catch (err) {
      console.error(err);
      setSeriesEvents([]);
      setGuests([]);
      setInvites([]);
      setPendingApprovals([]);
      setProfileNamesByEmail({});
      setProfileAvatarsByEmail({});
      setHostAvatarUrl(null);
      setChatSummary(null);
    } finally {
      setLoading(false);
    }
  }, [session?.user?.id, slug, token, viewerEmail]);

  const handleResolveApproval = useCallback(
    async (requestId: string, decision: 'approved' | 'denied') => {
      if (!viewerEmail || !requestId) return;

      try {
        setResolvingRequestId(requestId);

        const { error } = await supabase.rpc('resolve_join_request', {
          p_request_id: requestId,
          p_decision: decision,
          p_decided_by_email: viewerEmail,
        });

        if (error) throw error;

        await fetchData();
        setApprovalsOpen(false);
        Alert.alert('Done', decision === 'approved' ? 'Request approved.' : 'Request declined.');
      } finally {
        setResolvingRequestId(null);
      }
    },
    [viewerEmail, fetchData]
  );

  const canDmTarget = useCallback(
    (targetEmail: string | null | undefined) => {
      const target = normalizeEmail(targetEmail);

      if (!viewerEmail || !target) return false;
      if (target === viewerEmail) return false;

      return true;
    },
    [viewerEmail]
  );

  const handleOpenOrCreateDm = useCallback(
    async (targetEmail: string | null | undefined) => {
      const target = normalizeEmail(targetEmail);

      if (!event?.id || !slug || !viewerEmail || !target) return;
      if (target === viewerEmail) return;

      try {
        setOpeningDmForEmail(target);

        const { data, error } = await supabase.rpc('get_or_create_event_dm_thread', {
          p_event_id: event.id,
          p_user_email: viewerEmail,
          p_other_email: target,
        });

        if (error) {
          const message = String(error.message || '');

          if (
            message.includes('recipient_cannot_see_event') ||
            message.includes('sender_cannot_see_event')
          ) {
            Alert.alert(t('event_unable_message'));
            return;
          }

          if (message.includes('cannot_dm_self')) {
            return;
          }

          throw error;
        }

        if (!data) {
          throw new Error('Missing thread id');
        }

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
            t('event_messaging_unavailable'),
            t('event_messaging_unavailable_body')
          );
          return;
        }

        console.log('Unable to open message', err);
        Alert.alert(t('event_unable_open_message'));
      } finally {
        setOpeningDmForEmail(null);
      }
    },
    [event?.id, slug, viewerEmail, router, t]
  );

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  useFocusEffect(
    useCallback(() => {
      const run = async () => {
        await fetchData();

        if (event?.id) {
          await supabase.rpc('mark_notification_group_read', {
            p_event_id: event.id,
            p_notification_type: null,
          });
        }
      };

      void run();
    }, [fetchData, event?.id])
  );

  const handleBackPress = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
      return;
    }

    router.replace('/(tabs)' as any);
  }, [router]);

  if (loading) {
    return (
      <View style={[styles.centered, { backgroundColor: SYSTEM.background }]}>
        <ActivityIndicator color={SYSTEM.primary} />
      </View>
    );
  }

  if (!event || blocked) {
    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: SYSTEM.background }]}>
        <View style={styles.centered}>
          <Text style={{ fontSize: 18, fontWeight: '800', color: SYSTEM.text }}>
            This event is not available to you.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const eventModel = getEventModel(event);
  const isFixedDate = eventModel.baseKind === 'fixed_date';
  const isPoll = eventModel.baseKind === 'poll';
  const isReachOut = eventModel.baseKind === 'reach_out';
  const isHost = viewerEmail !== '' && normalizeEmail(event.host_email) === viewerEmail;
  const myStatus = normalizeStatus(myRsvp?.status);
  const myStatusLabel = getRsvpLabel(myStatus, t);
  const isSeries = eventModel.kind === 'series';
  const visibleSeriesEvents = seriesEvents.filter((item) => item?.id !== event?.id);
  const seriesIndex = getSeriesIndex(seriesEvents, event.id);
  const seriesTotal = seriesEvents.length;
  const hostEmailLc = normalizeEmail(event.host_email);
  const hostNameFirst = getFirstName(event.host_name);
  const eventDateText = formatEventDate(event, language, t);
  const eventTimeText = formatEventTime(event, language);
  const showOnboardingReturn = fromOnboardingGate === '1';

  const hasRsvpAccess =
    ['yes', 'going', 'interested', 'maybe'].includes(myStatus) ||
    allRsvps.some(
      (rsvp: any) =>
        (
          normalizeEmail(rsvp.email_lc || rsvp.email) === viewerEmail ||
          (rsvp.person_id && myPersonIds.includes(String(rsvp.person_id)))
        ) &&
        ['yes', 'going', 'interested', 'maybe'].includes(
          (rsvp.status || '').toLowerCase().trim()
        )
    );

  const canOpenChat = isHost || hasRsvpAccess;
  const canShowPrimaryCta = isHost
    ? isPoll || isReachOut
    : isReachOut || accessDecision?.can_rsvp === true || !!myRsvp;
  const canOpenHostDm = !!hostEmailLc && canDmTarget(hostEmailLc);
  const canOpenEventSettings = isHost && !!event.manage_handle;

  const hasLocationInDesc = event.description?.includes('Location: ');
  const description = hasLocationInDesc
    ? event.description.split('Location: ')[0].trim()
    : event.description;

  const locationText = hasLocationInDesc
    ? event.description.split('Location: ')[1].trim()
    : event.location;

  const cta = (() => {
    if (isPoll && isHost) {
      return {
        label: t('event_manage_poll'),
        onPress: () => router.push(`/event/${slug}/poll` as any),
      };
    }

    if (isHost && isReachOut) {
      return {
        label: t('event_manage_reach_out'),
        onPress: () => router.push(`/event/${slug}/reach-out` as any),
      };
    }

    if (isHost) {
      return null;
    }

    if (isReachOut) {
      return {
        label: t('event_help_make_plan'),
        onPress: () => router.push(`/event/${slug}/reach-out` as any),
      };
    }

    if (isPoll) {
      return {
        label: myRsvp ? t('event_edit_vote') : t('event_vote_on_dates'),
        onPress: () =>
          router.push({
            pathname: '/event/[slug]/guest-poll',
            params: { slug, token: typeof token === 'string' ? token : '' },
          } as any),
      };
    }

    return {
      label: myStatus ? t('event_edit_rsvp') : t('event_rsvp'),
      onPress: () =>
        router.push({
          pathname: '/event/[slug]/formalRSVP',
          params: { slug, token: typeof token === 'string' ? token : '' },
        } as any),
    };
  })();

  const handleOpenEventSettings = () => {
    if (!event.manage_handle) return;
    router.push(`/m/${event.manage_handle}` as any);
  };

  const handleInvitePress = () => {
    router.push({
      pathname: '/create/event-success',
      params: {
        slug: event.slug,
        manage_handle: event.manage_handle,
        title: event.title,
        visibility: String(event.visibility ?? 3),
        visible_in_feed: String(event.visible_in_feed ?? event.visibility !== 1),
        requires_approval: String(event.requires_approval ?? false),
      },
    } as any);
  };

  const handleOpenSeriesEvent = (nextSlug: string) => {
    router.push({
      pathname: '/event/[slug]/details',
      params: { slug: nextSlug },
    } as any);
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.bg }]}>
      <StatusBar barStyle={theme.isDark ? 'light-content' : 'dark-content'} />

      <View style={styles.header}>
        <TouchableOpacity
          style={styles.headerIconBtn}
          onPress={handleBackPress}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Ionicons name="arrow-back" size={20} color={theme.accent} />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {event.cover_image_url ? (
          <View style={styles.imageWrapper}>
            <Image source={{ uri: event.cover_image_url }} style={styles.coverImage} />
          </View>
        ) : null}

        <View style={styles.content}>
          <View style={styles.titleRow}>
            <View style={styles.titleTextWrap}>
              <Text style={[styles.title, { color: theme.text }]}>
                {event.title}
                {seriesIndex ? ` (Part ${seriesIndex} of ${seriesTotal})` : ''}
              </Text>
            </View>

            <View style={styles.titleActions}>
              {canOpenChat ? (
                <TouchableOpacity
                  style={[
                    styles.titleActionBtn,
                    {
                      borderColor: theme.isDark ? 'rgba(255,255,255,0.10)' : SYSTEM.borderSoft,
                      backgroundColor: theme.isDark ? 'rgba(255,255,255,0.08)' : SYSTEM.surface,
                    },
                  ]}
                  onPress={() => router.push(`/event/${slug}/chat` as any)}
                  accessibilityRole="button"
                  accessibilityLabel="Open event chat"
                >
                  <MaterialCommunityIcons name="chat-outline" size={20} color={theme.accent} />

                  {chatSummary?.unread_count > 0 ? (
                    <View style={[styles.titleActionBadge, { backgroundColor: theme.accent }]}>
                      <Text style={styles.titleActionBadgeText}>{chatSummary.unread_count}</Text>
                    </View>
                  ) : null}
                </TouchableOpacity>
              ) : null}

              {isFixedDate && event.starts_at ? (
                <CalendarButton
                  event={event}
                  theme={theme}
                  touchableStyle={[
                    styles.titleActionBtn,
                    {
                      borderColor: theme.isDark ? 'rgba(255,255,255,0.10)' : SYSTEM.borderSoft,
                      backgroundColor: theme.isDark ? 'rgba(255,255,255,0.08)' : SYSTEM.surface,
                    },
                  ]}
                  accessibilityLabel="Add event to calendar"
                >
                  <Ionicons name="calendar-outline" size={20} color={theme.accent} />
                </CalendarButton>
              ) : null}

              {canOpenEventSettings ? (
                <TouchableOpacity
                  style={[
                    styles.titleActionBtn,
                    {
                      borderColor: theme.isDark ? 'rgba(255,255,255,0.10)' : SYSTEM.borderSoft,
                      backgroundColor: theme.isDark ? 'rgba(255,255,255,0.08)' : SYSTEM.surface,
                    },
                  ]}
                  onPress={handleOpenEventSettings}
                  accessibilityRole="button"
                  accessibilityLabel="Open event tools"
                >
                  <Ionicons name="ellipsis-horizontal" size={20} color={theme.accent} />
                </TouchableOpacity>
              ) : null}
            </View>
          </View>
          <HostHeaderSection
            theme={theme}
            hostAvatarUrl={hostAvatarUrl}
            hostNameFirst={hostNameFirst}
            hostName={event.host_name}
            canOpenHostDm={canOpenHostDm}
            openingDmForEmail={openingDmForEmail}
            hostEmailLc={hostEmailLc}
            onOpenHostDm={() => handleOpenOrCreateDm(hostEmailLc)}
            t={t}
          />

          {showOnboardingReturn ? (
            <TouchableOpacity
              style={[
                styles.onboardingReturn,
                {
                  backgroundColor: theme.isDark ? 'rgba(255,255,255,0.08)' : SYSTEM.surface,
                  borderColor: theme.isDark ? 'rgba(255,255,255,0.10)' : SYSTEM.borderSoft,
                },
              ]}
              onPress={() =>
                router.push({
                  pathname: '/onboarding',
                  params: { destination: encodeURIComponent('/create') },
                } as any)
              }
            >
              <Ionicons name="sparkles-outline" size={18} color={theme.accent} />
              <Text style={[styles.onboardingReturnText, { color: theme.text }]}>
                {t('rsvp_gate_learn_more')}
              </Text>
              <Ionicons name="arrow-forward" size={18} color={theme.accent} />
            </TouchableOpacity>
          ) : null}

          {isFixedDate && event.starts_at ? (
            <EventInfoSection
              theme={theme}
              locationText={locationText}
              description={description}
              eventDateText={eventDateText}
              eventTimeText={eventTimeText}
            />
          ) : null}

          {!isFixedDate && locationText ? (
            <TouchableOpacity
              style={styles.infoRow}
              onPress={() =>
                Linking.openURL(
                  Platform.OS === 'ios'
                    ? `maps:0,0?q=${locationText}`
                    : `geo:0,0?q=${locationText}`
                )
              }
            >
              <MaterialCommunityIcons name="map-marker-radius" size={22} color={theme.accent} />
              <Text
                style={[styles.infoText, { color: theme.accent, textDecorationLine: 'underline' }]}
              >
                {locationText}
              </Text>
            </TouchableOpacity>
          ) : null}

          {!isFixedDate && description ? (
            <View style={styles.descriptionContainer}>
              <Text style={[styles.descriptionText, { color: theme.text }]}>{description}</Text>
            </View>
          ) : null}
{normalizeExternalUrl(event.external_url) ? (
  <TouchableOpacity
    style={[
      styles.eventLinkCard,
      {
        backgroundColor: theme.isDark ? 'rgba(255,255,255,0.08)' : SYSTEM.surface,
        borderColor: theme.isDark ? 'rgba(255,255,255,0.10)' : SYSTEM.borderSoft,
      },
    ]}
    onPress={() => {
      const url = normalizeExternalUrl(event.external_url);
      if (url) Linking.openURL(url);
    }}
  >
    <MaterialCommunityIcons name="link-variant" size={22} color={theme.accent} />
    <View style={styles.eventLinkTextWrap}>
      <Text style={[styles.eventLinkTitle, { color: theme.text }]}>
        {getExternalLinkText(event.external_url, t('external_link_open'))}
      </Text>
      <Text style={[styles.eventLinkUrl, { color: theme.accent }]} numberOfLines={1}>
        {normalizeExternalUrl(event.external_url)}
      </Text>
    </View>
    <Ionicons name="open-outline" size={18} color={theme.accent} />
  </TouchableOpacity>
) : null}
          {isPoll ? (
            <PollDatesSection
  theme={theme}
  proposedDates={event.proposed_dates || []}
  pollResponses={pollResponses}
              t={t}
  language={language}
/>
          ) : null}

          {isSeries ? (
            <DetailsSeriesSection
              theme={theme}
              event={event}
              visibleSeriesEvents={visibleSeriesEvents}
              onOpenSeriesEvent={handleOpenSeriesEvent}
            />
          ) : null}

          {canShowPrimaryCta && cta ? (
            <TouchableOpacity
              style={[styles.primaryBtn, { backgroundColor: theme.accent }]}
              onPress={cta.onPress}
            >
              <Text style={[styles.primaryBtnText, { color: theme.isDark ? theme.bg : '#fff' }]}>
                {cta.label}
              </Text>
              {!!myRsvp && !isPoll && !isHost && !isReachOut ? (
                <Text
                  style={[
                    styles.primaryBtnSubtext,
                    { color: theme.isDark ? theme.bg : 'rgba(255,255,255,0.92)' },
                  ]}
                >
                  {t('event_currently', { status: myStatusLabel })}
                </Text>
              ) : null}
            </TouchableOpacity>
          ) : null}

          {isHost ? (
            <>
              <HostActionsSection
                theme={theme}
                pendingApprovals={pendingApprovals}
                onInvite={handleInvitePress}
                onOpenRequests={() => setApprovalsOpen(true)}
                t={t}
              />

              <PendingApprovalsPreviewSection
                theme={theme}
                pendingApprovals={pendingApprovals}
                profileNamesByEmail={profileNamesByEmail}
                t={t}
              />
            </>
          ) : null}

          {accessDecision?.can_see_guest_list === true && !isPoll ? (
  <DetailsGuestsSection
    theme={theme}
    guests={guests}
    allRsvps={allRsvps}
    invites={invites}
    isHost={isHost}
    canDmTarget={canDmTarget}
    handleOpenOrCreateDm={handleOpenOrCreateDm}
    openingDmForEmail={openingDmForEmail}
    profileNamesByEmail={profileNamesByEmail}
    profileAvatarsByEmail={profileAvatarsByEmail}
    t={t}
  />
) : null}
        </View>

        <View style={{ height: 60 }} />
      </ScrollView>

      <DetailsApprovalsModal
        approvalsOpen={approvalsOpen}
        setApprovalsOpen={setApprovalsOpen}
        pendingApprovals={pendingApprovals}
        profileNamesByEmail={profileNamesByEmail}
        resolvingRequestId={resolvingRequestId}
        handleResolveApproval={handleResolveApproval}
        t={t}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },

  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  header: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },

  headerIconBtn: {
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
    paddingBottom: 20,
  },

  imageWrapper: {
    width: '100%',
    paddingHorizontal: 20,
  },

  coverImage: {
    width: '100%',
    height: 220,
    borderRadius: 24,
  },

  content: {
    padding: 25,
  },

  titleRow: {
    gap: 10,
    marginBottom: 10,
  },

  titleTextWrap: {
    width: '100%',
  },

  title: {
    fontSize: 34,
    fontWeight: '900',
  },

  titleActions: {
    flexDirection: 'row',
    gap: 8,
    alignSelf: 'flex-end',
  },

  titleActionBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  titleActionBadge: {
    position: 'absolute',
    top: -5,
    right: -5,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },

  titleActionBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '900',
  },

  hostHeaderWrap: {
    marginBottom: 16,
  },

  hostHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  hostAvatarWrap: {
    width: 42,
    height: 42,
    marginRight: 12,
    position: 'relative',
  },

  hostAvatarImage: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: SYSTEM.surface,
    borderWidth: 1,
    borderColor: SYSTEM.borderSoft,
  },

  hostAvatarFallback: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#f1efe8',
    borderWidth: 1,
    borderColor: SYSTEM.borderSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },

  hostAvatarFallbackText: {
    fontSize: 16,
    fontWeight: '900',
    color: SYSTEM.text,
  },

  hostAvatarMessageBadge: {
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

  hostHeaderTextWrap: {
    flex: 1,
  },

  hostHeaderText: {
    fontSize: 18,
    lineHeight: 24,
  },

  hostHeaderMuted: {
    opacity: 0.65,
    fontWeight: '500',
  },

  hostHeaderName: {
    fontWeight: '800',
  },

  hostHeaderSubtext: {
    marginTop: 2,
    fontSize: 13,
    fontWeight: '700',
  },

  eventInfoCard: {
    borderWidth: 1,
    borderRadius: 20,
    padding: 14,
    marginBottom: 18,
  },

  eventInfoTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },

  eventInfoIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },

  eventInfoTextWrap: {
    flex: 1,
    paddingTop: 1,
  },

  eventInfoTitle: {
    fontSize: 17,
    fontWeight: '900',
    lineHeight: 22,
    marginBottom: 4,
  },

  eventInfoLocation: {
    fontSize: 15,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },

  eventInfoDescription: {
    fontSize: 15,
    lineHeight: 21,
    opacity: 0.82,
  },

  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },

  infoText: {
    fontSize: 17,
    fontWeight: '600',
    flex: 1,
  },

  descriptionContainer: {
    marginBottom: 28,
  },

  descriptionText: {
    fontSize: 17,
    lineHeight: 26,
  },

  pollContainer: {
    marginBottom: 28,
  },

  dateGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },

  dateChip: {
    width: '47%',
    minHeight: 44,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: 'center',
  },

  dateChipText: {
    color: SYSTEM.text,
    fontSize: 15,
    fontWeight: '700',
  },

  primaryBtn: {
    minHeight: 60,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },

  primaryBtnText: {
    fontSize: 17,
    fontWeight: '900',
  },

  primaryBtnSubtext: {
    marginTop: 4,
    fontSize: 13,
    fontWeight: '600',
  },

  hostActionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 24,
  },

  hostActionBtn: {
    flex: 1,
    minHeight: 52,
    borderRadius: 16,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },

  hostActionText: {
    fontSize: 15,
    fontWeight: '800',
  },

  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 15,
  },

  peopleList: {
    gap: 10,
    marginBottom: 24,
  },

  personCard: {
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },

  personName: {
    fontSize: 15,
    fontWeight: '800',
  },

  personStatus: {
    fontSize: 14,
    fontWeight: '600',
    opacity: 0.9,
  },
  pollResultsList: {
  gap: 10,
},

pollResultCard: {
  borderWidth: 1.5,
  borderRadius: 16,
  padding: 14,
},

pollResultHeader: {
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 12,
},

pollResultDate: {
  fontSize: 16,
  fontWeight: '900',
},

pollResultTime: {
  fontSize: 14,
  fontWeight: '600',
  opacity: 0.75,
  marginTop: 2,
},

pollVoteBadge: {
  minWidth: 34,
  height: 34,
  borderRadius: 17,
  alignItems: 'center',
  justifyContent: 'center',
  paddingHorizontal: 8,
},

pollVoteBadgeText: {
  fontSize: 15,
  fontWeight: '900',
},

pollPopularLabel: {
  fontSize: 13,
  fontWeight: '900',
  marginTop: 8,
},

pollVoterList: {
  marginTop: 10,
  gap: 4,
},

pollVoterName: {
  fontSize: 14,
  fontWeight: '700',
  opacity: 0.9,
},

pollNoVotes: {
  fontSize: 14,
  fontWeight: '600',
  opacity: 0.55,
},
eventLinkCard: {
  minHeight: 58,
  borderRadius: 16,
  borderWidth: 1,
  paddingHorizontal: 14,
  paddingVertical: 12,
  marginBottom: 18,
  flexDirection: 'row',
  alignItems: 'center',
  gap: 10,
},

eventLinkTextWrap: {
  flex: 1,
  minWidth: 0,
},

eventLinkTitle: {
  fontSize: 15,
  fontWeight: '900',
},

eventLinkUrl: {
  marginTop: 2,
  fontSize: 13,
  fontWeight: '700',
},

onboardingReturn: {
  alignItems: 'center',
  borderRadius: 16,
  borderWidth: 1,
  flexDirection: 'row',
  gap: 10,
  marginBottom: 18,
  minHeight: 54,
  paddingHorizontal: 14,
  paddingVertical: 12,
},

onboardingReturnText: {
  flex: 1,
  fontSize: 15,
  fontWeight: '900',
},
});
