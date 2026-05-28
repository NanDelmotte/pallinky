/**
 * Path: app/(tabs)/chat.tsx
 * Description: WhatsApp-style event chat list for active event conversations.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as SecureStore from 'expo-secure-store';

import { supabase, useSession } from '@pallinky/core';
import { StyledText } from '@pallinky/ui';

const COLORS = {
  background: '#FFFFFF',
  searchBg: '#F0F0F0',
  text: '#050505',
  muted: '#717171',
  divider: '#E8E8E8',
  green: '#25D366',
  blue: '#3478F6',
  avatarBg: '#D9F0FA',
};

type ChatRow = {
  event: any;
  summary: any;
  archived: boolean;
};

function normalizeEmail(value: string | null | undefined) {
  return (value || '').toLowerCase().trim();
}

function normalizeId(value: unknown) {
  return String(value || '').trim();
}

function isPositiveRsvpStatus(status: string | null | undefined) {
  const normalized = normalizeEmail(status);
  return ['yes', 'going', 'interested', 'maybe'].includes(normalized);
}

function archiveKey(email: string) {
  const safeEmail = email.replace(/[^a-zA-Z0-9._-]/g, '_');
  return `pallinky_archived_event_chats.${safeEmail}`;
}

function isActiveEvent(event: any) {
  if (!event || event.cancelled_at || event.status === 'cancelled') return false;
  if (!event.starts_at) return true;

  const eventMs = new Date(event.starts_at).getTime();
  if (!Number.isFinite(eventMs)) return true;

  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  return eventMs >= sevenDaysAgo;
}

function formatTime(value: string | null | undefined) {
  if (!value) return '';

  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '';

  const now = new Date();
  const sameDay = date.toDateString() === now.toDateString();

  if (sameDay) {
    return date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  }

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';

  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function getPreview(summary: any) {
  const body = String(summary?.last_message_body || summary?.latest_message || '').trim();
  if (!body) return 'No messages yet';
  if (body.startsWith('Photo: ') || summary?.last_message_image_url) return 'Photo';
  return body;
}

function getEventIconName(title: string) {
  const cleanTitle = title.toLowerCase();

  if (/(birthday|celebration|party|feest|borrel|drinks)/.test(cleanTitle)) return 'party-popper';
  if (/(dinner|lunch|brunch|food|restaurant|meal|pizza|coffee|breakfast)/.test(cleanTitle)) {
    return 'silverware-fork-knife';
  }
  if (/(walk|hike|run|park|outside|outdoor)/.test(cleanTitle)) return 'walk';
  if (/(movie|film|cinema|show|theater|concert|music)/.test(cleanTitle)) return 'ticket-outline';
  if (/(work|meeting|cowork|office)/.test(cleanTitle)) return 'briefcase-outline';
  if (/(sport|game|match|tennis|football|soccer)/.test(cleanTitle)) return 'soccer';

  return 'calendar-heart';
}

export default function ChatTabScreen() {
  const router = useRouter();
  const { session } = useSession();
  const emailLower = normalizeEmail(session?.user?.email);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [rows, setRows] = useState<ChatRow[]>([]);
  const [archivedIds, setArchivedIds] = useState<string[]>([]);

  const loadArchivedIds = useCallback(async () => {
    if (!emailLower) {
      setArchivedIds([]);
      return [];
    }

    const raw = await SecureStore.getItemAsync(archiveKey(emailLower));
    const parsed = raw ? JSON.parse(raw) : [];
    const next = Array.isArray(parsed) ? parsed.map(String) : [];
    setArchivedIds(next);
    return next;
  }, [emailLower]);

  const loadChats = useCallback(async () => {
    if (!emailLower || !session?.user?.id) {
      setRows([]);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    try {
      const nextArchivedIds = await loadArchivedIds();

      const { data: mePeople } = await supabase
        .from('people')
        .select('id, email_lc, matched_user_id')
        .or(`matched_user_id.eq.${session.user.id},email_lc.eq.${emailLower}`);

      const userPersonIds = Array.from(
        new Set(((mePeople as any[]) || []).map((person) => normalizeId(person?.id)).filter(Boolean))
      );

      const [
        { data: hostedEvents },
        { data: emailInvites },
        { data: personInvites },
        { data: emailRsvps },
        { data: personRsvps },
        { data: vibeResponses },
      ] =
        await Promise.all([
          supabase.from('events').select('*').eq('host_email', emailLower),
          supabase
            .from('event_invites')
            .select('event_id, invitee_email_lc, person_id, status')
            .eq('invitee_email_lc', emailLower),
          userPersonIds.length > 0
            ? supabase
                .from('event_invites')
                .select('event_id, invitee_email_lc, person_id, status')
                .in('person_id', userPersonIds)
            : Promise.resolve({ data: [] }),
          supabase
            .from('rsvps')
            .select('id, event_id, status, email_lc, email, person_id')
            .eq('email_lc', emailLower),
          userPersonIds.length > 0
            ? supabase
                .from('rsvps')
                .select('id, event_id, status, email_lc, email, person_id')
                .in('person_id', userPersonIds)
            : Promise.resolve({ data: [] }),
          supabase.from('vibe_responses').select('event_id, user_email').eq('user_email', emailLower),
        ]);

      const invites = [...((emailInvites || []) as any[]), ...((personInvites || []) as any[])];
      const rsvpRows = Array.from(
        new Map(
          [...((emailRsvps || []) as any[]), ...((personRsvps || []) as any[])].map((rsvp) => [
            String(rsvp.id || `${rsvp.event_id}:${rsvp.email_lc || rsvp.person_id}`),
            rsvp,
          ])
        ).values()
      );

      const eventIds = Array.from(
        new Set([
          ...((hostedEvents || []) as any[]).map((event) => event.id),
          ...invites.map((invite) => invite.event_id),
          ...rsvpRows
            .filter((rsvp) => isPositiveRsvpStatus(rsvp.status))
            .map((rsvp) => rsvp.event_id),
          ...((vibeResponses || []) as any[]).map((response) => response.event_id),
        ].filter(Boolean))
      );

      let events = hostedEvents || [];
      const hostedIds = new Set(events.map((event: any) => String(event.id)));
      const missingIds = eventIds.filter((id) => !hostedIds.has(String(id)));

      if (missingIds.length > 0) {
        const { data: loadedEvents } = await supabase
          .from('events')
          .select('*')
          .in('id', missingIds);

        events = [...events, ...(loadedEvents || [])];
      }

      const activeEvents = (events || []).filter(isActiveEvent);

      const summaryPairs = await Promise.all(
        activeEvents.map(async (event: any) => {
          try {
            const { data } = await supabase.rpc('get_event_chat_summary', {
              p_event_id: event.id,
              p_user_email: emailLower,
            });

            return [event.id, data?.[0] || null] as const;
          } catch {
            return [event.id, null] as const;
          }
        })
      );

      const summaries = Object.fromEntries(summaryPairs);

      const nextRows = activeEvents
        .map((event: any) => ({
          event,
          summary: summaries[event.id] || null,
          archived: nextArchivedIds.includes(String(event.id)),
        }))
        .sort((a, b) => {
          const aDate = new Date(
            a.summary?.last_message_at || a.event.starts_at || a.event.created_at || 0
          ).getTime();
          const bDate = new Date(
            b.summary?.last_message_at || b.event.starts_at || b.event.created_at || 0
          ).getTime();
          return bDate - aDate;
        });

      setRows(nextRows);
    } catch (err) {
      console.log('Chat list load error:', err);
      setRows([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [emailLower, loadArchivedIds, session?.user?.id]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      void loadChats();
    }, [loadChats])
  );

  useEffect(() => {
    if (!emailLower) return;

    const channel = supabase
      .channel('event-chat-list')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications_inbox' }, () => {
        void loadChats();
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [emailLower, loadChats]);

  const visibleRows = useMemo(() => {
    const cleanQuery = query.trim().toLowerCase();

    return rows.filter((row) => {
      if (row.archived !== showArchived) return false;
      if (!cleanQuery) return true;

      const title = String(row.event.title || '').toLowerCase();
      const preview = getPreview(row.summary).toLowerCase();
      return title.includes(cleanQuery) || preview.includes(cleanQuery);
    });
  }, [query, rows, showArchived]);

  const archivedCount = rows.filter((row) => row.archived).length;

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    void loadChats();
  }, [loadChats]);

  const toggleArchive = useCallback(
    async (eventId: string) => {
      if (!emailLower) return;

      const isArchived = archivedIds.includes(eventId);
      const next = isArchived
        ? archivedIds.filter((id) => id !== eventId)
        : [...archivedIds, eventId];

      setArchivedIds(next);
      setRows((current) =>
        current.map((row) =>
          String(row.event.id) === eventId ? { ...row, archived: !isArchived } : row
        )
      );
      await SecureStore.setItemAsync(archiveKey(emailLower), JSON.stringify(next));
    },
    [archivedIds, emailLower]
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.moreButton} activeOpacity={0.8}>
          <Ionicons name="ellipsis-horizontal" size={24} color={COLORS.text} />
        </TouchableOpacity>

        <StyledText style={styles.title}>Chats</StyledText>

        <View style={styles.searchWrap}>
          <Ionicons name="search" size={18} color={COLORS.muted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search"
            placeholderTextColor={COLORS.muted}
            style={styles.searchInput}
          />
        </View>
      </View>

      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <TouchableOpacity
          style={styles.archiveRow}
          activeOpacity={0.75}
          onPress={() => setShowArchived((current) => !current)}
        >
          <Ionicons name="archive-outline" size={19} color={COLORS.muted} />
          <StyledText style={styles.archiveText}>
            {showArchived ? 'Active chats' : 'Archived'}
          </StyledText>
          {archivedCount > 0 && !showArchived ? (
            <StyledText style={styles.archiveCount}>{archivedCount}</StyledText>
          ) : null}
        </TouchableOpacity>

        {loading ? (
          <View style={styles.centered}>
            <ActivityIndicator color={COLORS.green} />
          </View>
        ) : visibleRows.length === 0 ? (
          <View style={styles.emptyState}>
            <MaterialCommunityIcons name="chat-outline" size={28} color={COLORS.muted} />
            <StyledText style={styles.emptyTitle}>
              {showArchived ? 'No archived chats' : 'No active chats'}
            </StyledText>
          </View>
        ) : (
          visibleRows.map((row) => {
            const title = row.event.title || 'Untitled event';
            const coverImageUrl = row.event.cover_image_url || null;
            const unreadCount = Number(row.summary?.unread_count || 0);
            const preview = getPreview(row.summary);
            const isPhoto = preview === 'Photo';
            const time = formatTime(row.summary?.last_message_at || row.event.starts_at);

            return (
              <TouchableOpacity
                key={row.event.id}
                style={styles.chatRow}
                activeOpacity={0.75}
                onPress={() => router.push(`/event/${row.event.slug}/chat` as any)}
                onLongPress={() => void toggleArchive(String(row.event.id))}
              >
                {coverImageUrl ? (
                  <Image source={{ uri: coverImageUrl }} style={styles.avatar} />
                ) : (
                  <View style={styles.avatarFallback}>
                    <MaterialCommunityIcons
                      name={getEventIconName(title) as any}
                      size={23}
                      color="#2A80B9"
                    />
                  </View>
                )}

                <View style={styles.chatMain}>
                  <View style={styles.rowTop}>
                    <StyledText style={styles.chatTitle} numberOfLines={1}>
                      {title}
                    </StyledText>
                    <StyledText style={styles.timeText}>{time}</StyledText>
                  </View>

                  <View style={styles.rowBottom}>
                    <View style={styles.previewWrap}>
                      {isPhoto ? (
                        <Ionicons name="camera" size={14} color={COLORS.muted} />
                      ) : null}
                      <StyledText style={styles.previewText} numberOfLines={2}>
                        {preview}
                      </StyledText>
                    </View>

                    {unreadCount > 0 ? (
                      <View style={styles.unreadBadge}>
                        <StyledText style={styles.unreadText}>{unreadCount}</StyledText>
                      </View>
                    ) : null}
                  </View>
                </View>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    paddingHorizontal: 18,
    paddingTop: 0,
    paddingBottom: 6,
  },
  moreButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FAFAFA',
  },
  title: {
    marginTop: 10,
    fontSize: 32,
    lineHeight: 37,
    fontWeight: '900',
    color: COLORS.text,
  },
  searchWrap: {
    marginTop: 14,
    minHeight: 42,
    borderRadius: 21,
    backgroundColor: COLORS.searchBg,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 13,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.text,
    paddingVertical: 10,
  },
  content: {
    paddingBottom: 110,
  },
  archiveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingVertical: 12,
    gap: 22,
  },
  archiveText: {
    flex: 1,
    fontSize: 19,
    fontWeight: '800',
    color: COLORS.muted,
  },
  archiveCount: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.muted,
  },
  chatRow: {
    minHeight: 68,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 18,
    paddingRight: 16,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.avatarBg,
  },
  avatarFallback: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.avatarBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chatMain: {
    flex: 1,
    minHeight: 68,
    marginLeft: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
    justifyContent: 'center',
  },
  rowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  chatTitle: {
    flex: 1,
    fontSize: 18,
    lineHeight: 22,
    fontWeight: '900',
    color: COLORS.text,
  },
  timeText: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.muted,
  },
  rowBottom: {
    marginTop: 2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  previewWrap: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  previewText: {
    flex: 1,
    fontSize: 15,
    lineHeight: 19,
    fontWeight: '400',
    color: COLORS.muted,
  },
  unreadBadge: {
    minWidth: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: COLORS.green,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 7,
  },
  unreadText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '900',
  },
  centered: {
    paddingTop: 80,
    alignItems: 'center',
  },
  emptyState: {
    paddingTop: 80,
    alignItems: 'center',
    gap: 10,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.muted,
  },
});
