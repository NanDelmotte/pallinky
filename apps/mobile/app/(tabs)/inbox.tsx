/**
 * Path: app/(tabs)/inbox.tsx
 * Description: Inbox tab backed by notifications_inbox with grouped rows per event/type,
 * direct chat routing for chat notifications, DM routing for event DM notifications,
 * and swipe-left dismiss except for DM rows.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { ScrollView, Swipeable } from 'react-native-gesture-handler';
import { StyledText } from '@pallinky/ui';
import { supabase, useSession } from '@pallinky/core';
import { useI18n } from '@pallinky/i18n/client';
import { syncAppIconBadge } from '../../lib/appBadge';

const COLORS = {
  background: '#F6F7F9',
  surface: '#FFFFFF',
  text: '#1f2a1b',
  textMuted: '#66715f',
  primary: '#43691b',
  borderSoft: '#e7ede2',
  secondary: '#6A4C93',
  secondaryBg: '#efe9f7',
  unreadBg: '#f7fbf3',
  danger: '#c62828',
};

type InboxRow = {
  id: string;
  user_email_lc: string;
  event_id: string | null;
  notification_type: string;
  latest_payload: any;
  latest_message: string | null;
  unread_count: number;
  total_count: number;
  is_read: boolean;
  first_received_at: string;
  last_received_at: string;
  read_at: string | null;
  thread_id?: string | null;
  can_dismiss?: boolean;
};

type EventMap = Record<
  string,
  {
    slug: string;
    title: string | null;
  }
>;

function formatRelativeDate(value: string | null | undefined, t: any) {
  if (!value) return '';
  const date = new Date(value);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);

  if (diffMin < 1) return t('inbox_just_now');
  if (diffMin < 60) return `${diffMin}m ago`;

  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;

  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d ago`;

  return date.toLocaleDateString();
}

function isEventDmRow(row: InboxRow) {
  return row.notification_type === 'event_dm_message';
}

function getChatThreadId(row: InboxRow) {
  return row.thread_id || row.latest_payload?.thread_id || null;
}

function getDmThreadId(row: InboxRow) {
  return row.thread_id || row.latest_payload?.thread_id || null;
}

function getDmCounterpartName(row: InboxRow, t: any) {
  return row.latest_payload?.counterpart_name || t('inbox_direct_message');
}

function getDmPreview(row: InboxRow, t: any) {
  return row.latest_message || row.latest_payload?.preview || t('inbox_new_message');
}

function getRowTitle(row: InboxRow, eventTitle: string, t: any) {
  if (isEventDmRow(row)) {
    return getDmCounterpartName(row, t);
  }

  const payload = row.latest_payload || {};

  switch (row.notification_type) {
    case 'invite_created':
      if (payload.event_type === 'reach_out') return t('inbox_reaching_out');
      return payload.is_series === true ? t('inbox_series_invitation') : t('inbox_invitation');

    case 'chat_message_batch':
      return row.unread_count > 1 ? t('inbox_unread', { count: String(row.unread_count) }) : t('inbox_new_message');
    case 'event_updated':
      return t('inbox_event_updated');
    case 'rsvp_received':
      return row.unread_count > 1 ? t('inbox_unread', { count: String(row.unread_count) }) : t('inbox_new_rsvp');
    case 'join_request_created':
      return row.unread_count > 1 ? t('inbox_unread', { count: String(row.unread_count) }) : t('inbox_join_request');
    case 'join_request_approved':
      return t('inbox_request_approved');
    case 'join_request_denied':
      return t('inbox_request_declined');
    case 'event_cancelled':
      return t('inbox_event_cancelled');
    case 'host_message':
      return t('inbox_message_from_host');
    case 'reach_out_suggestion':
      return t('inbox_plan_suggestion');
    case 'friend_event_created':
      return t('inbox_friend_event_created', {
        host: payload.host_name || t('inbox_someone'),
      });
    case 'rsvp_deadline_reminder':
      return t('inbox_rsvp_reminder');
    case 'guest_rsvp_confirmation':
      return t('inbox_rsvp_recorded');
    default:
      return eventTitle || t('inbox_notification');
  }
}

function getRowBody(row: InboxRow, eventTitle: string, t: any) {
  const payload = row.latest_payload || {};

  if (isEventDmRow(row)) {
    return `${eventTitle} — ${getDmPreview(row, t)}`;
  }

  switch (row.notification_type) {
    case 'invite_created':
  return payload.event_type === 'reach_out'
    ? t('inbox_reached_out_body', { host: payload.host_name || t('inbox_someone'), event: eventTitle })
    : t('inbox_invited_body', { host: payload.host_name || t('inbox_someone'), event: eventTitle });
    case 'chat_message_batch':
      if (!row.event_id) return row.latest_message || payload.preview || t('inbox_new_message');
      return t('inbox_in_event', { event: eventTitle });
    case 'event_updated':
      return t('inbox_details_changed', { event: eventTitle });
    case 'rsvp_received':
      return row.unread_count > 1
        ? t('inbox_people_responded', { count: String(row.unread_count), event: eventTitle })
        : t('inbox_someone_responded', { name: payload.guest_name || t('inbox_someone'), event: eventTitle });
    case 'join_request_created':
      return row.unread_count > 1
        ? t('inbox_people_want_join', { count: String(row.unread_count), event: eventTitle })
        : t('inbox_someone_wants_join', { name: payload.guest_name || t('inbox_someone'), event: eventTitle });
    case 'join_request_approved':
      return t('inbox_youre_in_for', { event: eventTitle });
    case 'join_request_denied':
      return t('inbox_request_declined_body', { event: eventTitle });
    case 'reach_out_suggestion':
  return t('inbox_suggested_body', { name: payload.guest_name || t('inbox_someone'), event: eventTitle });
    case 'friend_event_created':
      return t('inbox_friend_event_created_body', {
        host: payload.host_name || t('inbox_someone'),
        event: eventTitle,
      });
    case 'event_cancelled':
      return payload.message
        ? `${eventTitle} — ${payload.message}`
        : t('inbox_cancelled_body', { event: eventTitle });
    case 'host_message':
      return payload.message || row.latest_message || t('inbox_message_about', { event: eventTitle });
    case 'rsvp_deadline_reminder':
      return t('inbox_reply_to', { event: eventTitle });
    case 'guest_rsvp_confirmation':
      return t('inbox_rsvp_recorded_body', { event: eventTitle });
    default:
      return row.latest_message || eventTitle || t('inbox_new_notification');
  }
}

function getRowIcon(row: InboxRow) {
  if (isEventDmRow(row)) {
    return <Ionicons name="chatbubble-ellipses-outline" size={20} color={COLORS.secondary} />;
  }

  switch (row.notification_type) {
    case 'invite_created':
      return <Ionicons name="mail-open-outline" size={20} color={COLORS.secondary} />;
    case 'chat_message_batch':
      return <MaterialCommunityIcons name="chat-outline" size={20} color={COLORS.secondary} />;
    case 'event_updated':
      return <MaterialCommunityIcons name="calendar-edit" size={20} color={COLORS.secondary} />;
    case 'rsvp_received':
      return <Ionicons name="checkmark-circle-outline" size={20} color={COLORS.secondary} />;
    case 'join_request_created':
      return <Ionicons name="person-add-outline" size={20} color={COLORS.secondary} />;
    case 'join_request_approved':
      return <Ionicons name="thumbs-up-outline" size={20} color={COLORS.secondary} />;
    case 'join_request_denied':
      return <Ionicons name="close-circle-outline" size={20} color={COLORS.secondary} />;
    case 'event_cancelled':
      return <MaterialCommunityIcons name="calendar-remove" size={20} color={COLORS.secondary} />;
    case 'host_message':
      return <Ionicons name="chatbox-ellipses-outline" size={20} color={COLORS.secondary} />;
    case 'friend_event_created':
      return <MaterialCommunityIcons name="calendar-plus" size={20} color={COLORS.secondary} />;
    case 'rsvp_deadline_reminder':
      return <Ionicons name="alarm-outline" size={20} color={COLORS.secondary} />;
    case 'guest_rsvp_confirmation':
      return <Ionicons name="receipt-outline" size={20} color={COLORS.secondary} />;
    default:
      return <Ionicons name="notifications-outline" size={20} color={COLORS.secondary} />;
  }
}

export default function InboxTabScreen() {
  const router = useRouter();
  const { session } = useSession();
  const { t } = useI18n();

  const userEmailLc = session?.user?.email?.toLowerCase().trim() || '';
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [rows, setRows] = useState<InboxRow[]>([]);
  const [eventsById, setEventsById] = useState<EventMap>({});
  const [dismissingId, setDismissingId] = useState<string | null>(null);
useEffect(() => {
  setRows([]);
  setEventsById({});
  setDismissingId(null);
}, [userEmailLc]);
  const loadInbox = useCallback(async () => {
  if (!userEmailLc) {
    setRows([]);
    setEventsById({});
    setLoading(false);
    setRefreshing(false);
    return;
  }

  try {
      const { data, error } = await supabase.rpc('get_my_notifications_inbox');

      if (error) throw error;

      const inboxRows = ((data || []) as InboxRow[]).filter(
  (row) => row.user_email_lc === userEmailLc
);
      setRows(inboxRows);

      const eventIds = Array.from(
        new Set(inboxRows.map((row) => row.event_id).filter((value): value is string => !!value))
      );

      if (eventIds.length === 0) {
        setEventsById({});
        return;
      }

      const { data: events, error: eventsError } = await supabase
        .from('events')
        .select('id, slug, title')
        .in('id', eventIds);

      if (eventsError) throw eventsError;

      const nextMap: EventMap = {};
      (events || []).forEach((event: any) => {
        nextMap[event.id] = {
          slug: event.slug,
          title: event.title,
        };
      });

      setEventsById(nextMap);
    } catch (err) {
      console.log('Inbox load error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [userEmailLc]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      void loadInbox();
    }, [loadInbox])
  );

  const unreadTotal = useMemo(
    () => rows.reduce((sum, row) => sum + (row.is_read ? 0 : row.unread_count || 0), 0),
    [rows]
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    void loadInbox();
  }, [loadInbox]);

  const handleDismissRow = useCallback(
    async (row: InboxRow) => {
      if (isEventDmRow(row) || row.can_dismiss === false) return;

      const previousRows = rows;
      setDismissingId(row.id);
      setRows((current) => current.filter((item) => item.id !== row.id));

      try {
        const { error } = await supabase.rpc('dismiss_notification_group', {
          p_inbox_id: row.id,
        });

        if (error) throw error;
        void syncAppIconBadge();
      } catch (err: any) {
        console.log('Inbox dismiss error:', err);
        setRows(previousRows);
        Alert.alert(t('common_error'), err?.message || t('inbox_remove_error_body'));
      } finally {
        setDismissingId(null);
      }
    },
    [rows, t]
  );

  const handleOpenRow = useCallback(
    async (row: InboxRow) => {
      if (row.notification_type === 'chat_message_batch' && !row.event_id) {
        const threadId = getChatThreadId(row);

        if (!threadId) {
          Alert.alert(t('inbox_dm_unavailable'), t('inbox_dm_missing'));
          return;
        }

        try {
          await supabase.rpc('mark_chat_thread_read', {
            p_thread_id: threadId,
            p_user_email: userEmailLc,
          });

          setRows((current) =>
            current.map((item) =>
              item.id === row.id
                ? {
                    ...item,
                    is_read: true,
                    unread_count: 0,
                    read_at: new Date().toISOString(),
                  }
                : item
            )
          );
          void syncAppIconBadge();
        } catch (err) {
          console.log('Chat inbox mark read error:', err);
        }

        router.push(`/chat/${threadId}` as any);
        return;
      }

      const eventInfo = row.event_id ? eventsById[row.event_id] : null;
      if (!row.event_id || !eventInfo?.slug) return;

      if (isEventDmRow(row)) {
        const threadId = getDmThreadId(row);

        if (!threadId) {
          Alert.alert(t('inbox_dm_unavailable'), t('inbox_missing_dm_thread'));
          return;
        }

        router.push(`/event/${eventInfo.slug}/dm/${threadId}` as any);
        return;
      }

      try {
        await supabase.rpc('mark_notification_group_read', {
          p_event_id: row.event_id,
          p_notification_type: row.notification_type,
        });

        setRows((current) =>
          current.map((item) =>
            item.id === row.id
              ? {
                  ...item,
                  is_read: true,
                  unread_count: 0,
                  read_at: new Date().toISOString(),
                }
              : item
          )
        );
        void syncAppIconBadge();
      } catch (err) {
        console.log('Inbox mark read error:', err);
      }

      if (row.notification_type === 'chat_message_batch') {
        router.push(`/event/${eventInfo.slug}/chat` as any);
        return;
      }

      router.push(`/event/${eventInfo.slug}/details` as any);
    },
    [eventsById, router, t, userEmailLc]
  );

  const renderDismissActions = useCallback(() => {
  return (
    <View style={styles.dismissAction}>
      <Ionicons name="trash-outline" size={20} color="#fff" />
      <StyledText style={styles.dismissActionText}>{t('inbox_dismiss')}</StyledText>
    </View>
  );
}, [t]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <StyledText style={styles.title}>{t('inbox_title')}</StyledText>
        <StyledText style={styles.subtitle}>
          {unreadTotal > 0 ? t('inbox_unread', { count: String(unreadTotal) }) : t('inbox_all_caught_up')}
        </StyledText>
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          showsVerticalScrollIndicator={false}
        >
          {rows.length === 0 ? (
            <View style={styles.emptyCard}>
              <Ionicons name="mail-open-outline" size={28} color={COLORS.textMuted} />
              <StyledText style={styles.emptyTitle}>{t('inbox_empty_title')}</StyledText>
              <StyledText style={styles.emptyBody}>
                {t('inbox_empty_body')}
              </StyledText>
            </View>
          ) : (
            rows.map((row) => {
              const eventInfo = row.event_id ? eventsById[row.event_id] : null;
              const eventTitle =
                row.latest_payload?.event_title ||
                eventInfo?.title ||
                row.latest_payload?.title ||
                t('inbox_your_event');

              const isDm = isEventDmRow(row);
              const canDismiss = !isDm && row.can_dismiss !== false;

              const rowContent = (
                <TouchableOpacity
                  style={[styles.rowCard, !row.is_read && styles.rowCardUnread]}
                  onPress={() => void handleOpenRow(row)}
                  activeOpacity={0.8}
                >
                  <View style={styles.rowIconWrap}>{getRowIcon(row)}</View>

                  <View style={styles.rowMain}>
                    <View style={styles.rowTop}>
                      <StyledText style={styles.rowTitle}>
                        {getRowTitle(row, eventTitle, t)}
                      </StyledText>
                      <StyledText style={styles.rowTime}>
                        {formatRelativeDate(row.last_received_at, t)}
                      </StyledText>
                    </View>

                    <StyledText style={styles.rowBody}>
                      {getRowBody(row, eventTitle, t)}
                    </StyledText>

                    <View style={styles.rowBottom}>
                      <StyledText style={styles.eventLabel}>{eventTitle}</StyledText>

                      {!row.is_read && row.unread_count > 0 ? (
                        <View style={styles.unreadBadge}>
                          <StyledText style={styles.unreadBadgeText}>
                            {row.unread_count}
                          </StyledText>
                        </View>
                      ) : null}
                    </View>
                  </View>
                </TouchableOpacity>
              );

              if (!canDismiss) {
                return <View key={row.id}>{rowContent}</View>;
              }

              return (
               <Swipeable
  key={row.id}
  renderLeftActions={renderDismissActions}
  renderRightActions={renderDismissActions}
  leftThreshold={30}
  rightThreshold={30}
  overshootLeft={false}
  overshootRight={false}
  enabled={dismissingId !== row.id}
  onSwipeableOpen={() => {
    void handleDismissRow(row);
  }}
>
  {rowContent}
</Swipeable>
              );
            })
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 10,
  },
  title: {
    fontSize: 28,
    fontWeight: '900',
    color: COLORS.text,
  },
  subtitle: {
    marginTop: 4,
    fontSize: 14,
    color: COLORS.textMuted,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    paddingHorizontal: 16,
    paddingBottom: 120,
  },
  emptyCard: {
    marginTop: 16,
    backgroundColor: COLORS.surface,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: COLORS.borderSoft,
    padding: 24,
    alignItems: 'center',
  },
  emptyTitle: {
    marginTop: 12,
    fontSize: 18,
    fontWeight: '900',
    color: COLORS.text,
  },
  emptyBody: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 20,
    color: COLORS.textMuted,
    textAlign: 'center',
  },
  rowCard: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.borderSoft,
    padding: 14,
    marginTop: 12,
  },
  rowCardUnread: {
    backgroundColor: COLORS.unreadBg,
  },
  rowIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.secondaryBg,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  rowMain: {
    flex: 1,
    minWidth: 0,
  },
  rowTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  rowTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: '900',
    color: COLORS.text,
  },
  rowTime: {
    fontSize: 12,
    color: COLORS.textMuted,
  },
  rowBody: {
    marginTop: 4,
    fontSize: 14,
    lineHeight: 20,
    color: COLORS.textMuted,
  },
  rowBottom: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  eventLabel: {
    flex: 1,
    fontSize: 12,
    color: COLORS.secondary,
    fontWeight: '800',
  },
  unreadBadge: {
    minWidth: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 7,
  },
  unreadBadgeText: {
    fontSize: 12,
    fontWeight: '900',
    color: '#fff',
  },
  dismissAction: {
    marginTop: 12,
    marginBottom: 0,
    borderRadius: 20,
    backgroundColor: COLORS.danger,
    alignItems: 'center',
    justifyContent: 'center',
    width: 104,
    gap: 6,
  },
  dismissActionText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '900',
  },
});
