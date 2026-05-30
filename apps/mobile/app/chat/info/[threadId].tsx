import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

import { supabase, useSession } from '@pallinky/core';
import { StyledText } from '@pallinky/ui';

type ThreadDetails = {
  thread_id: string;
  kind: 'direct' | 'group';
  title: string;
  participant_preview: string | null;
  participant_count: number;
  latest_event_id: string | null;
  latest_event_title: string | null;
  latest_event_slug: string | null;
  avatar_url: string | null;
};

type LinkedEvent = {
  event_id: string;
  event_slug: string | null;
  event_title: string | null;
  starts_at: string | null;
  cover_image_url: string | null;
  host_name: string | null;
  attached_at: string;
};

type Member = {
  user_email_lc: string;
  display_name: string;
  avatar_url: string | null;
  joined_at: string;
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
  avatarBg: '#EFE9F7',
};

function normalizeEmail(value: string | null | undefined) {
  return (value || '').toLowerCase().trim();
}

function getInitials(value: string | null | undefined) {
  return String(value || 'Chat')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('') || 'CH';
}

function formatEventMeta(event: LinkedEvent) {
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

export default function ChatInfoPage() {
  const { threadId } = useLocalSearchParams<{ threadId: string }>();
  const router = useRouter();
  const { session } = useSession();
  const viewerEmail = normalizeEmail(session?.user?.email);

  const [loading, setLoading] = useState(true);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [thread, setThread] = useState<ThreadDetails | null>(null);
  const [events, setEvents] = useState<LinkedEvent[]>([]);
  const [members, setMembers] = useState<Member[]>([]);

  const loadInfo = useCallback(async () => {
    if (!threadId || !viewerEmail) {
      setThread(null);
      setEvents([]);
      setMembers([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const [
        { data: threadData, error: threadError },
        { data: eventData, error: eventError },
        { data: memberData, error: memberError },
      ] = await Promise.all([
        supabase.rpc('get_chat_thread_details', {
          p_thread_id: threadId,
          p_user_email: viewerEmail,
        }),
        supabase.rpc('get_chat_thread_events', {
          p_thread_id: threadId,
          p_user_email: viewerEmail,
        }),
        supabase.rpc('get_chat_thread_members', {
          p_thread_id: threadId,
          p_user_email: viewerEmail,
        }),
      ]);

      if (threadError) throw threadError;
      if (eventError) throw eventError;
      if (memberError) throw memberError;

      setThread(((threadData || [])[0] || null) as ThreadDetails | null);
      setEvents((eventData || []) as LinkedEvent[]);
      setMembers((memberData || []) as Member[]);
    } catch (err) {
      console.error('Failed to load chat info', err);
      setThread(null);
      setEvents([]);
      setMembers([]);
    } finally {
      setLoading(false);
    }
  }, [threadId, viewerEmail]);

  useFocusEffect(
    useCallback(() => {
      void loadInfo();
    }, [loadInfo])
  );

  const upcomingCount = useMemo(() => {
    const now = Date.now();
    return events.filter((event) => {
      const startsAtMs = event.starts_at ? new Date(event.starts_at).getTime() : Number.NaN;
      return !Number.isFinite(startsAtMs) || startsAtMs >= now;
    }).length;
  }, [events]);

  const handleChangeAvatar = useCallback(async () => {
    if (!threadId || !viewerEmail || uploadingAvatar) return;

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Photo access needed', 'Please allow photo library access to change the chat picture.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.82,
    });

    const asset = result.assets?.[0];
    if (result.canceled || !asset?.uri) return;

    try {
      setUploadingAvatar(true);
      const extension = asset.mimeType?.includes('png') ? 'png' : 'jpg';
      const safeThreadId = String(threadId).replace(/[^a-zA-Z0-9_-]/g, '_');
      const safeEmail = viewerEmail.replace(/[^a-zA-Z0-9_-]/g, '_');
      const fileName = `thread-avatars/${safeThreadId}/${safeEmail}_${Date.now()}.${extension}`;

      const response = await fetch(asset.uri);
      const arrayBuffer = await response.arrayBuffer();

      const { error: uploadError } = await supabase.storage
        .from('chat-images')
        .upload(fileName, arrayBuffer, {
          contentType: asset.mimeType || 'image/jpeg',
          upsert: true,
        });

      if (uploadError) throw uploadError;

      const {
        data: { publicUrl },
      } = supabase.storage.from('chat-images').getPublicUrl(fileName);

      const { error: updateError } = await supabase.rpc('update_chat_thread_avatar', {
        p_thread_id: threadId,
        p_user_email: viewerEmail,
        p_avatar_url: publicUrl,
      });

      if (updateError) throw updateError;

      await loadInfo();
    } catch (err: any) {
      console.error('Failed to update chat avatar', err);
      Alert.alert('Could not update chat picture', err?.message || 'Please try again.');
    } finally {
      setUploadingAvatar(false);
    }
  }, [loadInfo, threadId, uploadingAvatar, viewerEmail]);

  if (loading) {
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator color={COLORS.purple} />
      </SafeAreaView>
    );
  }

  if (!thread) {
    return (
      <SafeAreaView style={styles.centered}>
        <StyledText style={styles.emptyTitle}>Chat not found</StyledText>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerButton} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={26} color={COLORS.text} />
        </TouchableOpacity>
        <StyledText style={styles.headerTitle}>Chat info</StyledText>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.heroCard}>
          <TouchableOpacity
            style={styles.heroAvatarButton}
            activeOpacity={0.84}
            onPress={() => void handleChangeAvatar()}
          >
            {thread.avatar_url ? (
              <Image source={{ uri: thread.avatar_url }} style={styles.heroAvatar} />
            ) : (
              <View style={styles.heroAvatarFallback}>
                {thread.kind === 'direct' ? (
                  <Ionicons name="person" size={28} color={COLORS.purpleText} />
                ) : (
                  <StyledText style={styles.heroAvatarText}>{getInitials(thread.title)}</StyledText>
                )}
              </View>
            )}
            <View style={styles.heroAvatarBadge}>
              {uploadingAvatar ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Ionicons name="camera-outline" size={14} color="#FFFFFF" />
              )}
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.heroTitleButton}
            activeOpacity={0.82}
            onPress={() =>
              router.push({ pathname: '/chat/edit/[threadId]', params: { threadId } } as any)
            }
          >
            <StyledText style={styles.heroTitle}>{thread.title || 'Chat'}</StyledText>
            <Ionicons name="pencil-outline" size={18} color={COLORS.muted} />
          </TouchableOpacity>

          <StyledText style={styles.heroSubtitle}>
            {thread.kind === 'direct'
              ? thread.participant_preview || 'Direct chat'
              : `${thread.participant_count} people`}
          </StyledText>
        </View>

        <View style={styles.actionRow}>
          <TouchableOpacity
            style={styles.actionPill}
            activeOpacity={0.82}
            onPress={() =>
              router.push({ pathname: '/chat/people/[threadId]', params: { threadId } } as any)
            }
          >
            <Ionicons name="person-add-outline" size={18} color={COLORS.text} />
            <StyledText style={styles.actionPillText}>Add people</StyledText>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionPill}
            activeOpacity={0.82}
            onPress={() =>
              router.push({ pathname: '/chat/events/[threadId]', params: { threadId } } as any)
            }
          >
            <Ionicons name="calendar-outline" size={18} color={COLORS.text} />
            <StyledText style={styles.actionPillText}>Events</StyledText>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <StyledText style={styles.sectionTitle}>People</StyledText>
            <StyledText style={styles.sectionMeta}>{members.length}</StyledText>
          </View>

          <View style={styles.card}>
            {members.map((member, index) => (
              <View
                key={member.user_email_lc}
                style={[styles.memberRow, index === members.length - 1 && styles.memberRowLast]}
              >
                {member.avatar_url ? (
                  <Image source={{ uri: member.avatar_url }} style={styles.memberAvatar} />
                ) : (
                  <View style={styles.memberAvatarFallback}>
                    <StyledText style={styles.memberAvatarText}>
                      {getInitials(member.display_name)}
                    </StyledText>
                  </View>
                )}

                <View style={styles.memberTextWrap}>
                  <StyledText style={styles.memberName}>
                    {normalizeEmail(member.user_email_lc) === viewerEmail
                      ? 'You'
                      : member.display_name}
                  </StyledText>
                  <StyledText style={styles.memberEmail}>{member.user_email_lc}</StyledText>
                </View>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <StyledText style={styles.sectionTitle}>Linked events</StyledText>
            <StyledText style={styles.sectionMeta}>
              {upcomingCount > 0 ? `${upcomingCount} upcoming` : `${events.length} total`}
            </StyledText>
          </View>

          <TouchableOpacity
            style={styles.card}
            activeOpacity={0.82}
            onPress={() =>
              router.push({ pathname: '/chat/events/[threadId]', params: { threadId } } as any)
            }
          >
            {events.length === 0 ? (
              <View style={styles.emptyRow}>
                <MaterialCommunityIcons name="calendar-heart" size={20} color={COLORS.purpleText} />
                <StyledText style={styles.emptyRowText}>No events linked yet</StyledText>
              </View>
            ) : (
              <>
                {events.slice(0, 3).map((event, index) => (
                  <View
                    key={event.event_id}
                    style={[styles.eventPreviewRow, index === Math.min(events.length, 3) - 1 && styles.memberRowLast]}
                  >
                    {event.cover_image_url ? (
                      <Image source={{ uri: event.cover_image_url }} style={styles.eventPreviewImage} />
                    ) : (
                      <View style={styles.eventPreviewIcon}>
                        <MaterialCommunityIcons name="calendar-heart" size={18} color={COLORS.purpleText} />
                      </View>
                    )}

                    <View style={styles.memberTextWrap}>
                      <StyledText style={styles.memberName}>{event.event_title || 'Untitled event'}</StyledText>
                      <StyledText style={styles.memberEmail}>{formatEventMeta(event)}</StyledText>
                    </View>
                  </View>
                ))}

                {events.length > 3 ? (
                  <View style={styles.moreEventsRow}>
                    <StyledText style={styles.moreEventsText}>See all {events.length} events</StyledText>
                    <Ionicons name="chevron-forward" size={16} color={COLORS.muted} />
                  </View>
                ) : null}
              </>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.background,
    padding: 24,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.text,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 18,
    paddingTop: 4,
    paddingBottom: 10,
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.surface,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '900',
    color: COLORS.text,
  },
  content: {
    paddingHorizontal: 18,
    paddingBottom: 36,
  },
  heroCard: {
    marginTop: 6,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 24,
    backgroundColor: COLORS.surface,
    paddingHorizontal: 20,
    paddingVertical: 24,
  },
  heroAvatarButton: {
    width: 72,
    height: 72,
  },
  heroAvatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: COLORS.purpleSoft,
  },
  heroAvatarFallback: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.avatarBg,
  },
  heroAvatarText: {
    fontSize: 24,
    fontWeight: '900',
    color: COLORS.purpleText,
  },
  heroAvatarBadge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.purple,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  heroTitle: {
    marginTop: 14,
    fontSize: 24,
    fontWeight: '900',
    color: COLORS.text,
    textAlign: 'center',
  },
  heroTitleButton: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  heroSubtitle: {
    marginTop: 4,
    fontSize: 14,
    color: COLORS.muted,
    textAlign: 'center',
  },
  actionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 14,
  },
  actionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  actionPillText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.text,
  },
  section: {
    marginTop: 22,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '900',
    color: COLORS.text,
  },
  sectionMeta: {
    fontSize: 13,
    color: COLORS.muted,
  },
  card: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 20,
    backgroundColor: COLORS.surface,
    overflow: 'hidden',
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
  },
  memberRowLast: {
    borderBottomWidth: 0,
  },
  memberAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: COLORS.purpleSoft,
  },
  memberAvatarFallback: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.purpleSoft,
  },
  memberAvatarText: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.text,
  },
  memberTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  memberName: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.text,
  },
  memberEmail: {
    marginTop: 2,
    fontSize: 13,
    color: COLORS.muted,
  },
  emptyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 16,
  },
  emptyRowText: {
    fontSize: 14,
    color: COLORS.muted,
  },
  eventPreviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
  },
  eventPreviewImage: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: COLORS.purpleSoft,
  },
  eventPreviewIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.purpleSoft,
  },
  moreEventsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: COLORS.border,
  },
  moreEventsText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.muted,
  },
});
