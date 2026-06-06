import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
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
import { goBackOrReplace } from '../../../lib/navigation';

type LinkedEvent = {
  event_id: string;
  event_slug: string | null;
  event_title: string | null;
  starts_at: string | null;
  cover_image_url: string | null;
  host_name: string | null;
  attached_at: string;
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

function formatMeta(event: LinkedEvent) {
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
  if (event.host_name) parts.push(event.host_name);
  return parts.join(' • ');
}

export default function ChatEventsPage() {
  const { threadId } = useLocalSearchParams<{ threadId: string }>();
  const router = useRouter();
  const { session } = useSession();
  const viewerEmail = normalizeEmail(session?.user?.email);

  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<LinkedEvent[]>([]);

  const loadEvents = useCallback(async () => {
    if (!threadId || !viewerEmail) {
      setEvents([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const { data, error } = await supabase.rpc('get_chat_thread_events', {
        p_thread_id: threadId,
        p_user_email: viewerEmail,
      });

      if (error) throw error;
      setEvents((data || []) as LinkedEvent[]);
    } catch (err) {
      console.error('Failed to load chat events', err);
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, [threadId, viewerEmail]);

  useFocusEffect(
    useCallback(() => {
      void loadEvents();
    }, [loadEvents])
  );

  const [upcomingEvents, pastEvents] = useMemo(() => {
    const now = Date.now();
    const upcoming: LinkedEvent[] = [];
    const past: LinkedEvent[] = [];

    events.forEach((event) => {
      const startsAtMs = event.starts_at ? new Date(event.starts_at).getTime() : Number.NaN;
      if (Number.isFinite(startsAtMs) && startsAtMs < now) {
        past.push(event);
      } else {
        upcoming.push(event);
      }
    });

    return [upcoming, past];
  }, [events]);

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

  const renderEventRow = useCallback(
    (event: LinkedEvent) => (
      <TouchableOpacity
        key={event.event_id}
        style={styles.row}
        activeOpacity={0.82}
        onPress={() => {
          if (!event.event_slug) return;
          router.push(`/event/${event.event_slug}/details` as any);
        }}
      >
        {event.cover_image_url ? (
          <Image source={{ uri: event.cover_image_url }} style={styles.cover} />
        ) : (
          <View style={styles.iconWrap}>
            <MaterialCommunityIcons name="calendar-heart" size={22} color={COLORS.purpleText} />
          </View>
        )}

        <View style={styles.rowText}>
          <StyledText style={styles.rowTitle}>{event.event_title || 'Untitled event'}</StyledText>
          <StyledText style={styles.rowSubtitle}>{formatMeta(event)}</StyledText>
        </View>

        <Ionicons name="chevron-forward" size={18} color={COLORS.muted} />
      </TouchableOpacity>
    ),
    [router]
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerButton} onPress={() => goBackOrReplace(router, `/chat/info/${threadId}`)}>
          <Ionicons name="chevron-back" size={26} color={COLORS.text} />
        </TouchableOpacity>

        <View style={styles.headerTextWrap}>
          <StyledText style={styles.title}>Events</StyledText>
          <StyledText style={styles.subtitle}>Past and future plans from this chat</StyledText>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <TouchableOpacity
          style={styles.actionRow}
          activeOpacity={0.82}
          onPress={() => void handleCreateNewEvent()}
        >
          <View style={styles.actionIconWrap}>
            <Ionicons name="add" size={20} color="#FFFFFF" />
          </View>
          <View style={styles.rowText}>
            <StyledText style={styles.rowTitle}>Create new event</StyledText>
            <StyledText style={styles.rowSubtitle}>Make a new plan in this chat</StyledText>
          </View>
          <Ionicons name="chevron-forward" size={18} color={COLORS.muted} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionRow}
          activeOpacity={0.82}
          onPress={() => router.push({ pathname: '/chat/attach-event', params: { threadId } } as any)}
        >
          <View style={[styles.actionIconWrap, styles.secondaryActionIconWrap]}>
            <Ionicons name="link-outline" size={18} color={COLORS.purpleText} />
          </View>
          <View style={styles.rowText}>
            <StyledText style={styles.rowTitle}>Attach existing event</StyledText>
            <StyledText style={styles.rowSubtitle}>Bring another plan into this chat</StyledText>
          </View>
          <Ionicons name="chevron-forward" size={18} color={COLORS.muted} />
        </TouchableOpacity>

        {loading ? (
          <View style={styles.centered}>
            <ActivityIndicator color={COLORS.purple} />
          </View>
        ) : (
          <>
            {upcomingEvents.length > 0 ? (
              <>
                <StyledText style={styles.sectionTitle}>Upcoming</StyledText>
                {upcomingEvents.map(renderEventRow)}
              </>
            ) : null}

            {pastEvents.length > 0 ? (
              <>
                <StyledText style={styles.sectionTitle}>Past</StyledText>
                {pastEvents.map(renderEventRow)}
              </>
            ) : null}

            {events.length === 0 ? (
              <View style={styles.emptyWrap}>
                <StyledText style={styles.emptyTitle}>No events yet</StyledText>
                <StyledText style={styles.emptyBody}>
                  Create one here or attach an existing plan from this chat.
                </StyledText>
              </View>
            ) : null}
          </>
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
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingTop: 4,
    paddingBottom: 10,
    gap: 12,
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.surface,
  },
  headerTextWrap: {
    flex: 1,
  },
  title: {
    fontSize: 28,
    fontWeight: '900',
    color: COLORS.text,
  },
  subtitle: {
    marginTop: 3,
    fontSize: 14,
    color: COLORS.muted,
  },
  content: {
    paddingHorizontal: 18,
    paddingBottom: 40,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 12,
    marginTop: 12,
  },
  actionIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.purple,
  },
  secondaryActionIconWrap: {
    backgroundColor: COLORS.purpleSoft,
  },
  sectionTitle: {
    marginTop: 22,
    marginBottom: 8,
    fontSize: 17,
    fontWeight: '900',
    color: COLORS.text,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 12,
    marginTop: 10,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.purpleSoft,
  },
  cover: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: COLORS.purpleSoft,
  },
  rowText: {
    flex: 1,
    minWidth: 0,
  },
  rowTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.text,
  },
  rowSubtitle: {
    marginTop: 2,
    fontSize: 13,
    color: COLORS.muted,
  },
  centered: {
    paddingTop: 32,
    alignItems: 'center',
  },
  emptyWrap: {
    marginTop: 28,
    padding: 24,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 20,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '900',
    color: COLORS.text,
  },
  emptyBody: {
    marginTop: 6,
    fontSize: 14,
    color: COLORS.muted,
    textAlign: 'center',
  },
});
