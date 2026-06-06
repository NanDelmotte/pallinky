import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

import { supabase, useSession } from '@pallinky/core';
import { StyledText } from '@pallinky/ui';
import { goBackOrReplace } from '../../lib/navigation';

type EventRow = {
  id: string;
  slug: string;
  title: string | null;
  starts_at: string | null;
  cover_image_url: string | null;
};

const COLORS = {
  background: '#F8FAF6',
  surface: '#EFF4EA',
  text: '#1F2A1B',
  muted: '#66715F',
  border: '#D6DED0',
  purple: '#6A4C93',
  purpleSoft: '#EFE9F7',
  purpleText: '#5B3F84',
};

function normalizeEmail(value: string | null | undefined) {
  return (value || '').toLowerCase().trim();
}

function isAttachableEvent(event: any) {
  if (!event) return false;
  if (!event.starts_at) return true;
  const eventMs = new Date(event.starts_at).getTime();
  if (!Number.isFinite(eventMs)) return true;
  const fourteenDaysAgo = Date.now() - 14 * 24 * 60 * 60 * 1000;
  return eventMs >= fourteenDaysAgo;
}

function formatEventMeta(event: EventRow) {
  const parts: string[] = [];
  if (event.starts_at) {
    const date = new Date(event.starts_at);
    if (Number.isFinite(date.getTime())) {
      parts.push(
        date.toLocaleString(undefined, {
          month: 'short',
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
        })
      );
    }
  }

  return parts.join(' • ');
}

export default function AttachEventPage() {
  const { threadId } = useLocalSearchParams<{ threadId: string }>();
  const router = useRouter();
  const { session } = useSession();
  const viewerEmail = normalizeEmail(session?.user?.email);

  const [loading, setLoading] = useState(true);
  const [attachingId, setAttachingId] = useState<string | null>(null);
  const [events, setEvents] = useState<EventRow[]>([]);

  const loadEvents = useCallback(async () => {
    if (!viewerEmail) {
      setLoading(false);
      setEvents([]);
      return;
    }

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('events')
        .select('id, slug, title, starts_at, cover_image_url')
        .eq('host_email', viewerEmail)
        .order('starts_at', { ascending: true });

      if (error) throw error;

      setEvents((((data || []) as any[]) || []).filter(isAttachableEvent));
    } catch (err: any) {
      console.error('Failed to load attachable events', err);
      Alert.alert('Could not load events', err?.message || 'Please try again.');
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, [viewerEmail]);

  useFocusEffect(
    useCallback(() => {
      void loadEvents();
    }, [loadEvents])
  );

  const sortedEvents = useMemo(
    () =>
      [...events].sort((a, b) => {
        const aMs = new Date(a.starts_at || 0).getTime();
        const bMs = new Date(b.starts_at || 0).getTime();
        return aMs - bMs;
      }),
    [events]
  );

  const attachEvent = useCallback(
    async (event: EventRow) => {
      if (!threadId || !viewerEmail || attachingId) return;

      try {
        setAttachingId(event.id);
        const { error } = await supabase.rpc('attach_event_to_chat_thread', {
          p_thread_id: threadId,
          p_event_id: event.id,
          p_attached_by_email: viewerEmail,
        });

        if (error) throw error;

        router.replace({
          pathname: '/chat/[threadId]',
          params: { threadId: String(threadId), eventSlug: event.slug },
        } as any);
      } catch (err: any) {
        console.error('Failed to attach event', err);
        Alert.alert('Could not attach event', err?.message || 'Please try again.');
      } finally {
        setAttachingId(null);
      }
    },
    [attachingId, router, threadId, viewerEmail]
  );

  const handleCreateNewEvent = useCallback(async () => {
    if (!threadId) {
      router.push('/create' as any);
      return;
    }

    router.push({
      pathname: '/create',
      params: { chatThreadId: String(threadId) },
    } as any);
  }, [router, threadId]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerButton} onPress={() => goBackOrReplace(router, threadId ? `/chat/${threadId}` : '/(tabs)/chat')}>
          <Ionicons name="chevron-back" size={26} color={COLORS.text} />
        </TouchableOpacity>

        <View style={styles.headerTextWrap}>
          <StyledText style={styles.title}>Add event</StyledText>
          <StyledText style={styles.subtitle}>Everyone in the chat will be invited</StyledText>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <TouchableOpacity
          style={styles.createRow}
          activeOpacity={0.82}
          onPress={() => void handleCreateNewEvent()}
        >
          <View style={styles.createIconWrap}>
            <Ionicons name="add" size={22} color="#FFFFFF" />
          </View>

          <View style={styles.rowText}>
            <StyledText style={styles.rowTitle}>Create new event</StyledText>
            <StyledText style={styles.rowSubtitle}>
              Make a new plan, then attach it to this chat
            </StyledText>
          </View>

          <Ionicons name="chevron-forward" size={18} color={COLORS.muted} />
        </TouchableOpacity>

        {loading ? (
          <View style={styles.centered}>
            <ActivityIndicator color={COLORS.purple} />
          </View>
        ) : sortedEvents.length === 0 ? (
          <View style={styles.centered}>
            <StyledText style={styles.emptyText}>No events ready to attach</StyledText>
          </View>
        ) : (
          sortedEvents.map((event) => (
            <TouchableOpacity
              key={event.id}
              style={styles.row}
              activeOpacity={0.82}
              onPress={() => void attachEvent(event)}
              disabled={!!attachingId}
            >
              <View style={styles.iconWrap}>
                <MaterialCommunityIcons name="calendar-heart" size={22} color={COLORS.purpleText} />
              </View>

              <View style={styles.rowText}>
                <StyledText style={styles.rowTitle}>{event.title || 'Untitled event'}</StyledText>
                <StyledText style={styles.rowSubtitle}>{formatEventMeta(event)}</StyledText>
              </View>

              {attachingId === event.id ? (
                <ActivityIndicator color={COLORS.purple} />
              ) : (
                <Ionicons name="chevron-forward" size={18} color={COLORS.muted} />
              )}
            </TouchableOpacity>
          ))
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
    paddingHorizontal: 16,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontSize: 28,
    lineHeight: 32,
    fontWeight: '900',
    color: COLORS.text,
  },
  subtitle: {
    marginTop: 2,
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.muted,
  },
  content: {
    paddingTop: 8,
    paddingBottom: 30,
  },
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 60,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.muted,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  createRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
  },
  iconWrap: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: COLORS.purpleSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  createIconWrap: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: COLORS.purple,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: {
    flex: 1,
    minWidth: 0,
  },
  rowTitle: {
    fontSize: 17,
    lineHeight: 21,
    fontWeight: '800',
    color: COLORS.text,
  },
  rowSubtitle: {
    marginTop: 2,
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '500',
    color: COLORS.muted,
  },
});
