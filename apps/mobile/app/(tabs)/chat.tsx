/**
 * Path: app/(tabs)/chat.tsx
 * Description: WhatsApp-style chat list for generic threads with optional linked events.
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
import { Swipeable } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as SecureStore from 'expo-secure-store';

import { supabase, useSession } from '@pallinky/core';
import { StyledText } from '@pallinky/ui';

const COLORS = {
  background: '#F8FAF6',
  searchBg: '#EFF4EA',
  text: '#1F2A1B',
  muted: '#66715F',
  divider: '#D6DED0',
  olive: '#43691B',
  purple: '#6A4C93',
  purpleBg: '#EFE9F7',
  purpleText: '#5B3F84',
  avatarBg: '#EFE9F7',
};

type ThreadRow = {
  thread_id: string;
  kind: 'direct' | 'group';
  title: string;
  participant_preview: string | null;
  last_message_preview: string | null;
  last_message_at: string | null;
  unread_count: number;
  participant_count: number;
  latest_event_id: string | null;
  latest_event_title: string | null;
  latest_event_slug: string | null;
  avatar_url: string | null;
  counterpart_email_lc: string | null;
  archived: boolean;
};

function normalizeEmail(value: string | null | undefined) {
  return (value || '').toLowerCase().trim();
}

function archiveKey(email: string) {
  const safeEmail = email.replace(/[^a-zA-Z0-9._-]/g, '_');
  return `pallinky_archived_chat_threads.${safeEmail}`;
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

function getPreview(row: ThreadRow) {
  const body = String(row.last_message_preview || '').trim();
  if (!body) return 'No messages yet';
  if (body === 'Photo') return 'Photo';
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
  const [rows, setRows] = useState<ThreadRow[]>([]);
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
    if (!emailLower) {
      setRows([]);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    try {
      const nextArchivedIds = await loadArchivedIds();

      const { data, error } = await supabase.rpc('get_my_chat_threads', {
        p_user_email: emailLower,
      });

      if (error) throw error;

      const nextRows = ((data || []) as any[]).map((row) => ({
        ...row,
        unread_count: Number(row.unread_count || 0),
        participant_count: Number(row.participant_count || 0),
        archived: nextArchivedIds.includes(String(row.thread_id)),
      })) as ThreadRow[];

      setRows(nextRows);
    } catch (err) {
      console.log('Chat list load error:', err);
      setRows([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [emailLower, loadArchivedIds]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      void loadChats();
    }, [loadChats])
  );

  useEffect(() => {
    if (!emailLower) return;

    const existing = supabase
      .getChannels()
      .find((channel: any) => channel.topic === 'realtime:generic-chat-list');

    if (existing) {
      void supabase.removeChannel(existing);
    }

    const channel = supabase
      .channel('generic-chat-list')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_messages' }, () => {
        void loadChats();
      })
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'chat_thread_participants' },
        () => {
          void loadChats();
        }
      )
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

      const title = String(row.title || '').toLowerCase();
      const preview = getPreview(row).toLowerCase();
      const participantPreview = String(row.participant_preview || '').toLowerCase();
      return (
        title.includes(cleanQuery) ||
        preview.includes(cleanQuery) ||
        participantPreview.includes(cleanQuery)
      );
    });
  }, [query, rows, showArchived]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    void loadChats();
  }, [loadChats]);

  const toggleArchive = useCallback(
    async (threadId: string) => {
      if (!emailLower) return;

      const isArchived = archivedIds.includes(threadId);
      const next = isArchived
        ? archivedIds.filter((id) => id !== threadId)
        : [...archivedIds, threadId];

      setArchivedIds(next);
      setRows((current) =>
        current.map((row) =>
          String(row.thread_id) === threadId ? { ...row, archived: !isArchived } : row
        )
      );
      await SecureStore.setItemAsync(archiveKey(emailLower), JSON.stringify(next));
    },
    [archivedIds, emailLower]
  );

  const renderArchiveAction = useCallback(
    (isArchived: boolean) => (
      <View style={[styles.swipeAction, isArchived ? styles.unarchiveAction : styles.archiveAction]}>
        <Ionicons
          name={isArchived ? 'arrow-undo-outline' : 'archive-outline'}
          size={18}
          color="#FFFFFF"
        />
        <StyledText style={styles.swipeActionText}>
          {isArchived ? 'Unarchive' : 'Archive'}
        </StyledText>
      </View>
    ),
    []
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <StyledText style={styles.title}>Chats</StyledText>
          {!showArchived ? (
            <TouchableOpacity
              style={styles.composeButton}
              activeOpacity={0.85}
              onPress={() => router.push('/chat/new' as any)}
            >
              <Ionicons name="create-outline" size={20} color="#FFFFFF" />
            </TouchableOpacity>
          ) : null}
        </View>

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
        </TouchableOpacity>

        {loading ? (
          <View style={styles.centered}>
            <ActivityIndicator color={COLORS.purple} />
          </View>
        ) : visibleRows.length === 0 ? (
          <View style={styles.emptyState}>
            <MaterialCommunityIcons name="chat-outline" size={28} color={COLORS.muted} />
            <StyledText style={styles.emptyTitle}>
              {showArchived ? 'No archived chats' : 'No chats yet'}
            </StyledText>
          </View>
        ) : (
          visibleRows.map((row) => {
            const title = row.title || row.latest_event_title || 'Untitled chat';
            const unreadCount = Number(row.unread_count || 0);
            const preview = getPreview(row);
            const isPhoto = preview === 'Photo';
            const time = formatTime(row.last_message_at);

            const params = row.latest_event_slug
              ? { threadId: row.thread_id, eventSlug: row.latest_event_slug }
              : { threadId: row.thread_id };

            return (
              <Swipeable
                key={row.thread_id}
                renderRightActions={() => renderArchiveAction(row.archived)}
                rightThreshold={32}
                overshootRight={false}
                onSwipeableOpen={() => {
                  void toggleArchive(String(row.thread_id));
                }}
              >
                <TouchableOpacity
                  style={styles.chatRow}
                  activeOpacity={0.75}
                  onPress={() => router.push({ pathname: '/chat/[threadId]', params } as any)}
                >
                  {row.avatar_url ? (
                    <Image source={{ uri: row.avatar_url }} style={styles.avatar} />
                  ) : (
                    <View style={styles.avatarFallback}>
                      {row.kind === 'direct' ? (
                        <Ionicons name="person" size={22} color={COLORS.purpleText} />
                      ) : (
                        <MaterialCommunityIcons
                          name={getEventIconName(title) as any}
                          size={23}
                          color={COLORS.purpleText}
                        />
                      )}
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
              </Swipeable>
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
  headerTop: {
    marginTop: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
  },
  title: {
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
    fontWeight: '600',
    color: COLORS.text,
    paddingVertical: 10,
  },
  content: {
    paddingBottom: 120,
  },
  archiveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingVertical: 12,
    gap: 22,
    backgroundColor: '#F8FAF6',
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
    marginLeft: 14,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.divider,
  },
  rowTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  rowBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  chatTitle: {
    flex: 1,
    fontSize: 18,
    lineHeight: 21,
    fontWeight: '900',
    color: COLORS.text,
  },
  timeText: {
    fontSize: 15,
    lineHeight: 18,
    fontWeight: '600',
    color: COLORS.muted,
  },
  previewWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    minWidth: 0,
  },
  previewText: {
    flex: 1,
    fontSize: 15,
    lineHeight: 19,
    fontWeight: '400',
    color: COLORS.muted,
  },
  unreadBadge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    paddingHorizontal: 6,
    marginLeft: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.purple,
  },
  unreadText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#fff',
  },
  swipeAction: {
    width: 112,
    minHeight: 68,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  archiveAction: {
    backgroundColor: COLORS.purple,
  },
  unarchiveAction: {
    backgroundColor: COLORS.olive,
  },
  swipeActionText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  centered: {
    paddingTop: 40,
    alignItems: 'center',
  },
  emptyState: {
    paddingTop: 60,
    alignItems: 'center',
    gap: 10,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.muted,
  },
  composeButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: COLORS.purple,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
    elevation: 3,
  },
});
