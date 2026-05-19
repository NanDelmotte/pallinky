/**
 * Path: app/event/[slug]/dm/[thread_id].tsx
 * Description: Event-scoped direct message thread screen for 1:1 event DMs.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { StyledText } from '@pallinky/ui';
import { supabase } from '@pallinky/core';
import { useI18n } from '@pallinky/i18n/client';

const COLORS = {
  background: '#F6F7F9',
  surface: '#FFFFFF',
  text: '#1f2a1b',
  textMuted: '#66715f',
  primary: '#43691b',
  borderSoft: '#e7ede2',
  secondary: '#6A4C93',
  secondaryBg: '#efe9f7',
  mineBg: '#43691b',
  mineText: '#FFFFFF',
  theirsBg: '#FFFFFF',
  theirsText: '#1f2a1b',
};

type ThreadHeader = {
  thread_id: string;
  event_id: string;
  event_title: string;
  other_person_email_lc: string;
  other_person_name: string;
};

type DmMessage = {
  id: string;
  thread_id: string;
  event_id: string;
  sender_email_lc: string;
  recipient_email_lc: string;
  body: string;
  created_at: string;
  edited_at?: string | null;
};

function normalizeEmail(value: string | null | undefined) {
  return (value || '').trim().toLowerCase();
}

function formatMessageTime(value: string | null | undefined) {
  if (!value) return '';
  const date = new Date(value);
  return date.toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default function EventDmThreadScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ slug?: string; thread_id?: string }>();
  const { t } = useI18n();
  const threadId = Array.isArray(params.thread_id) ? params.thread_id[0] : params.thread_id;

  const [viewerEmail, setViewerEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sending, setSending] = useState(false);
  const [header, setHeader] = useState<ThreadHeader | null>(null);
  const [messages, setMessages] = useState<DmMessage[]>([]);
  const [draft, setDraft] = useState('');
  const flatListRef = useRef<FlatList<DmMessage>>(null);

  const canSend = useMemo(
    () => draft.trim().length > 0 && !!header && !!viewerEmail,
    [draft, header, viewerEmail]
  );

  const loadViewerEmail = useCallback(async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error) throw error;

    const email = normalizeEmail(data.user?.email);
    if (!email) {
      throw new Error('Missing signed-in user email.');
    }

    setViewerEmail(email);
    return email;
  }, []);

  const loadHeader = useCallback(
    async (email: string) => {
      if (!threadId) throw new Error('Missing thread id.');

      const { data: thread, error: threadError } = await supabase
        .from('event_dm_threads')
        .select('id, event_id, user_a_email_lc, user_b_email_lc')
        .eq('id', threadId)
        .single();

      if (threadError) throw threadError;
      if (!thread) throw new Error('Thread not found.');

      const otherEmail =
        normalizeEmail(thread.user_a_email_lc) === email
          ? normalizeEmail(thread.user_b_email_lc)
          : normalizeEmail(thread.user_a_email_lc);

      const [{ data: event, error: eventError }, { data: profile, error: profileError }] =
        await Promise.all([
          supabase.from('events').select('id, title').eq('id', thread.event_id).single(),
          supabase.from('profiles').select('full_name').eq('email_lc', otherEmail).maybeSingle(),
        ]);

      if (eventError) throw eventError;
      if (profileError) throw profileError;

      const nextHeader: ThreadHeader = {
        thread_id: thread.id,
        event_id: thread.event_id,
        event_title: event?.title || t('event_guest_fallback'),
        other_person_email_lc: otherEmail,
        other_person_name: profile?.full_name?.trim() || t('event_guest_fallback'),
      };

      setHeader(nextHeader);
      return nextHeader;
    },
    [t, threadId]
  );

  const loadMessages = useCallback(
    async (email: string) => {
      if (!threadId) throw new Error('Missing thread id.');

      const { data, error } = await supabase.rpc('get_event_dm_messages', {
        p_thread_id: threadId,
        p_user_email: email,
      });

      if (error) throw error;

      const nextMessages = ((data || []) as DmMessage[]).sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );

      setMessages(nextMessages);
    },
    [threadId]
  );

  const markRead = useCallback(
    async (email: string) => {
      if (!threadId) return;

      const { error } = await supabase.rpc('mark_event_dm_thread_read', {
        p_thread_id: threadId,
        p_user_email: email,
      });

      if (error) {
        console.log('DM mark read error:', error);
      }
    },
    [threadId]
  );

  const loadThread = useCallback(async () => {
    try {
      if (!threadId) {
        throw new Error('Missing thread id.');
      }

      const email = viewerEmail || (await loadViewerEmail());

      await Promise.all([loadHeader(email), loadMessages(email)]);
      await markRead(email);
    } catch (err: any) {
      console.log('DM thread load error:', err);
      Alert.alert(t('common_error'), err?.message || t('event_dm_load_error'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [loadHeader, loadMessages, loadViewerEmail, markRead, t, threadId, viewerEmail]);

  useEffect(() => {
    void loadThread();
  }, [loadThread]);

  useEffect(() => {
    if (messages.length > 0) {
      requestAnimationFrame(() => {
        flatListRef.current?.scrollToEnd({ animated: false });
      });
    }
  }, [messages.length]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    void loadThread();
  }, [loadThread]);

  const handleSend = useCallback(async () => {
    if (!header || !viewerEmail) return;

    const body = draft.trim();
    if (!body) return;

    setSending(true);

    try {
      const { error } = await supabase.rpc('send_event_dm_message', {
        p_event_id: header.event_id,
        p_sender_email: viewerEmail,
        p_recipient_email: header.other_person_email_lc,
        p_body: body,
      });

      if (error) throw error;

      setDraft('');
      await loadMessages(viewerEmail);
      await markRead(viewerEmail);

      requestAnimationFrame(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      });
    } catch (err: any) {
      console.log('DM send error:', err);
      Alert.alert(t('common_error'), err?.message || t('event_dm_send_error'));
    } finally {
      setSending(false);
    }
  }, [draft, header, loadMessages, markRead, t, viewerEmail]);

  const renderMessage = useCallback(
    ({ item }: { item: DmMessage }) => {
      const isMine = normalizeEmail(item.sender_email_lc) === viewerEmail;

      return (
        <View style={[styles.messageRow, isMine ? styles.messageRowMine : styles.messageRowTheirs]}>
          <View style={[styles.bubble, isMine ? styles.bubbleMine : styles.bubbleTheirs]}>
            <StyledText
              style={[styles.messageText, isMine ? styles.messageTextMine : styles.messageTextTheirs]}
            >
              {item.body}
            </StyledText>
            <StyledText
              style={[styles.messageTime, isMine ? styles.messageTimeMine : styles.messageTimeTheirs]}
            >
              {formatMessageTime(item.created_at)}
            </StyledText>
          </View>
        </View>
      );
    },
    [viewerEmail]
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top : 0}
      >
        <View style={styles.header}>
          <TouchableOpacity
            accessibilityRole="button"
            onPress={() => router.back()}
            style={styles.backButton}
          >
            <Ionicons name="chevron-back" size={22} color={COLORS.text} />
          </TouchableOpacity>

          <View style={styles.headerTextWrap}>
            <StyledText style={styles.headerTitle}>
              {header?.other_person_name || t('event_chat')}
            </StyledText>
            <StyledText style={styles.headerSubtitle}>
              {header?.event_title || t('common_loading')}
            </StyledText>
          </View>
        </View>

        {loading ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={COLORS.primary} />
          </View>
        ) : (
          <>
            <FlatList
              ref={flatListRef}
              data={messages}
              keyExtractor={(item) => item.id}
              renderItem={renderMessage}
              contentContainerStyle={[
                styles.listContent,
                { paddingBottom: Math.max(insets.bottom, 12) },
              ]}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              onRefresh={onRefresh}
              refreshing={refreshing}
              ListEmptyComponent={
                <View style={styles.emptyCard}>
                  <Ionicons name="chatbubble-ellipses-outline" size={28} color={COLORS.textMuted} />
                  <StyledText style={styles.emptyTitle}>{t('event_no_messages')}</StyledText>
                  <StyledText style={styles.emptyBody}>
                    {t('event_dm_empty_body', { event: header?.event_title || t('event_guest_fallback') })}
                  </StyledText>
                </View>
              }
            />

            <View
              style={[
                styles.composerWrap,
                { paddingBottom: Math.max(insets.bottom, 12) },
              ]}
            >
              <View style={styles.composer}>
                <TextInput
                  value={draft}
                  onChangeText={setDraft}
                  placeholder={t('event_dm_placeholder')}
                  placeholderTextColor={COLORS.textMuted}
                  style={styles.input}
                  multiline
                  maxLength={2000}
                  editable={!sending}
                />

                <TouchableOpacity
                  onPress={() => void handleSend()}
                  disabled={!canSend || sending}
                  style={[
                    styles.sendButton,
                    (!canSend || sending) && styles.sendButtonDisabled,
                  ]}
                >
                  {sending ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Ionicons name="send" size={18} color="#fff" />
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  flex: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 10,
    backgroundColor: COLORS.background,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  headerTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: COLORS.text,
  },
  headerSubtitle: {
    marginTop: 2,
    fontSize: 13,
    color: COLORS.textMuted,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    flexGrow: 1,
  },
  emptyCard: {
    marginTop: 24,
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
  messageRow: {
    marginTop: 10,
    flexDirection: 'row',
  },
  messageRowMine: {
    justifyContent: 'flex-end',
  },
  messageRowTheirs: {
    justifyContent: 'flex-start',
  },
  bubble: {
    maxWidth: '82%',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
  },
  bubbleMine: {
    backgroundColor: COLORS.mineBg,
    borderColor: COLORS.mineBg,
    borderBottomRightRadius: 8,
  },
  bubbleTheirs: {
    backgroundColor: COLORS.theirsBg,
    borderColor: COLORS.borderSoft,
    borderBottomLeftRadius: 8,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 20,
  },
  messageTextMine: {
    color: COLORS.mineText,
  },
  messageTextTheirs: {
    color: COLORS.theirsText,
  },
  messageTime: {
    marginTop: 6,
    fontSize: 11,
  },
  messageTimeMine: {
    color: 'rgba(255,255,255,0.8)',
  },
  messageTimeTheirs: {
    color: COLORS.textMuted,
  },
  composerWrap: {
    paddingHorizontal: 12,
    paddingTop: 8,
    backgroundColor: COLORS.background,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderSoft,
  },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.borderSoft,
    borderRadius: 22,
    paddingLeft: 14,
    paddingRight: 8,
    paddingTop: 10,
    paddingBottom: 8,
  },
  input: {
    flex: 1,
    minHeight: 22,
    maxHeight: 120,
    fontSize: 15,
    color: COLORS.text,
    paddingTop: 0,
    paddingBottom: 0,
  },
  sendButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.45,
  },
});
