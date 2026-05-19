/**
 * Path: app/event/[slug]/chat.tsx
 * Description: Shared event chat for hosts and participants.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { supabase, useSession } from '@pallinky/core';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

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
};

const PALETTES: Record<string, { bg: string; accent: string; text: string; isDark: boolean }> = {
  zen: { bg: '#F6F7F9', accent: '#43691b', text: '#1f2a1b', isDark: false },
  girly: { bg: '#f4bbd3', accent: '#fe5d9f', text: '#2b1f24', isDark: false },
  fiesta: { bg: '#1729ae', accent: '#fe20e8', text: '#ffffff', isDark: true },
  classy: { bg: '#03172f', accent: '#efd466', text: '#fff7b6', isDark: true },
  spicy: { bg: '#656c12', accent: '#ecc216', text: '#ffffff', isDark: true },
  submerged: { bg: '#F6F7F9', accent: '#6A4C93', text: '#1f2a1b', isDark: false },
};

function normalizeEmail(value: string | null | undefined) {
  return value?.toLowerCase().trim() || '';
}

function formatMessageTime(value: string) {
  const date = new Date(value);
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function EventChatPage() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const router = useRouter();
  const { session } = useSession();

  const viewerEmail = normalizeEmail(session?.user?.email);

  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [event, setEvent] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [profilesByEmail, setProfilesByEmail] = useState<Record<string, string>>({});
  const [body, setBody] = useState('');

  const theme = useMemo(
    () => (event?.gif_key && PALETTES[event.gif_key]) ? PALETTES[event.gif_key] : PALETTES.zen,
    [event]
  );

  const fetchChat = useCallback(async () => {
    if (!slug || !viewerEmail) {
      setLoading(false);
      return;
    }

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
        setMessages([]);
        return;
      }

      setEvent(eventData);

      const { data: messageData, error: messageError } = await supabase.rpc(
        'get_event_chat_messages',
        {
          p_event_id: eventData.id,
          p_user_email: viewerEmail,
        }
      );

      if (messageError) throw messageError;

      const nextMessages = messageData || [];
      setMessages(nextMessages);

      const senderEmails = Array.from(
        new Set(
          nextMessages
            .map((item: any) => normalizeEmail(item.sender_email_lc))
            .filter(Boolean)
        )
      );

      const nextProfiles: Record<string, string> = {};

      if (senderEmails.length > 0) {
        const { data: profileData } = await supabase
          .from('profiles')
          .select('email_lc, full_name')
          .in('email_lc', senderEmails);

        (profileData || []).forEach((profile: any) => {
          nextProfiles[normalizeEmail(profile.email_lc)] = profile.full_name || '';
        });
      }

      if (normalizeEmail(eventData.host_email)) {
        nextProfiles[normalizeEmail(eventData.host_email)] =
          nextProfiles[normalizeEmail(eventData.host_email)] || eventData.host_name || '';
      }

      setProfilesByEmail(nextProfiles);

      await supabase.rpc('mark_event_chat_read', {
        p_event_id: eventData.id,
        p_user_email: viewerEmail,
      });
    } catch (err) {
      console.error(err);
      setMessages([]);
    } finally {
      setLoading(false);
    }
  }, [slug, viewerEmail]);

  useEffect(() => {
    void fetchChat();
  }, [fetchChat]);

  const handleSend = async () => {
    const cleanBody = body.trim();

    if (!event || !viewerEmail || !cleanBody || sending) return;

    setSending(true);

    try {
      const { error } = await supabase.rpc('post_event_chat_message', {
        p_event_id: event.id,
        p_sender_email: viewerEmail,
        p_body: cleanBody,
      });

      if (error) throw error;

      setBody('');
      await fetchChat();
    } catch (err) {
      console.error(err);
    } finally {
      setSending(false);
    }
  };

  const getDisplayName = (email: string) => {
    const cleanEmail = normalizeEmail(email);

    if (!cleanEmail) return 'Guest';
    if (cleanEmail === normalizeEmail(event?.host_email)) {
      return profilesByEmail[cleanEmail] || event?.host_name || 'Host';
    }

    return profilesByEmail[cleanEmail] || 'Guest';
  };

  if (!viewerEmail) {
    return (
      <SafeAreaView style={styles.centered}>
        <Text style={styles.emptyTitle}>Sign in required</Text>
      </SafeAreaView>
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={[styles.centered, { backgroundColor: theme.bg }]}>
        <ActivityIndicator color={theme.accent} />
      </SafeAreaView>
    );
  }

  if (!event) {
    return (
      <SafeAreaView style={styles.centered}>
        <Text style={styles.emptyTitle}>Event not found</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.bg }]}>
      <StatusBar barStyle={theme.isDark ? 'light-content' : 'dark-content'} />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 24}
      >
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={20} color={theme.accent} />
          </TouchableOpacity>

          <View style={styles.headerTextWrap}>
            <Text style={[styles.headerTitle, { color: theme.text }]}>Chat</Text>
            <Text style={[styles.headerSubtitle, { color: theme.text }]}>
              {event.title}
            </Text>
          </View>
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {messages.length === 0 ? (
            <View style={styles.emptyState}>
              <MaterialCommunityIcons
                name="chat-outline"
                size={28}
                color={theme.accent}
              />
              <Text style={[styles.emptyStateTitle, { color: theme.text }]}>
                No messages yet
              </Text>
              <Text style={[styles.emptyStateText, { color: theme.text }]}>
                Use chat to coordinate the event.
              </Text>
            </View>
          ) : (
            messages.map((message) => {
              const isMine = normalizeEmail(message.sender_email_lc) === viewerEmail;

              return (
                <View
                  key={message.id}
                  style={[
                    styles.messageRow,
                    isMine ? styles.messageRowMine : styles.messageRowOther,
                  ]}
                >
                  <View
                    style={[
                      styles.messageBubble,
                      isMine
                        ? {
                            backgroundColor: theme.accent,
                            borderColor: theme.accent,
                          }
                        : {
                            backgroundColor: theme.isDark
                              ? 'rgba(255,255,255,0.08)'
                              : SYSTEM.surface,
                            borderColor: theme.isDark
                              ? 'rgba(255,255,255,0.10)'
                              : SYSTEM.borderSoft,
                          },
                    ]}
                  >
                    <Text
                      style={[
                        styles.messageSender,
                        { color: isMine ? (theme.isDark ? theme.bg : '#fff') : theme.text },
                      ]}
                    >
                      {isMine ? 'You' : getDisplayName(message.sender_email_lc)}
                    </Text>

                    <Text
                      style={[
                        styles.messageBody,
                        { color: isMine ? (theme.isDark ? theme.bg : '#fff') : theme.text },
                      ]}
                    >
                      {message.body}
                    </Text>

                    <Text
                      style={[
                        styles.messageTime,
                        {
                          color: isMine
                            ? (theme.isDark ? theme.bg : '#fff')
                            : theme.text,
                          opacity: 0.65,
                        },
                      ]}
                    >
                      {formatMessageTime(message.created_at)}
                    </Text>
                  </View>
                </View>
              );
            })
          )}
        </ScrollView>

        <View
          style={[
            styles.composerWrap,
            {
              borderTopColor: theme.isDark ? `${theme.accent}33` : SYSTEM.borderSoft,
              backgroundColor: theme.bg,
            },
          ]}
        >
          <TextInput
            style={[
              styles.input,
              {
                color: theme.text,
                borderColor: theme.isDark ? `${theme.accent}55` : SYSTEM.border,
                backgroundColor: theme.isDark
                  ? 'rgba(255,255,255,0.06)'
                  : SYSTEM.surface,
              },
            ]}
            placeholder="Write a message…"
            placeholderTextColor={theme.text + '66'}
            value={body}
            onChangeText={setBody}
            multiline
          />

          <TouchableOpacity
            style={[
              styles.sendBtn,
              {
                backgroundColor: body.trim() ? theme.accent : theme.accent + '66',
              },
            ]}
            onPress={handleSend}
            disabled={!body.trim() || sending}
          >
            {sending ? (
              <ActivityIndicator color={theme.isDark ? theme.bg : '#fff'} />
            ) : (
              <Ionicons
                name="arrow-up"
                size={18}
                color={theme.isDark ? theme.bg : '#fff'}
              />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  safeArea: { flex: 1 },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: SYSTEM.background,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: SYSTEM.surface,
    borderWidth: 1,
    borderColor: SYSTEM.borderSoft,
  },
  headerTextWrap: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '900',
  },
  headerSubtitle: {
    fontSize: 14,
    opacity: 0.7,
    marginTop: 2,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 24,
    gap: 12,
  },
  emptyState: {
    minHeight: 240,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 24,
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: '800',
  },
  emptyStateText: {
    fontSize: 15,
    textAlign: 'center',
    opacity: 0.75,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: SYSTEM.text,
  },
  messageRow: {
    flexDirection: 'row',
  },
  messageRowMine: {
    justifyContent: 'flex-end',
  },
  messageRowOther: {
    justifyContent: 'flex-start',
  },
  messageBubble: {
    maxWidth: '82%',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
  },
  messageSender: {
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 6,
  },
  messageBody: {
    fontSize: 16,
    lineHeight: 22,
  },
  messageTime: {
    fontSize: 11,
    marginTop: 8,
  },
  composerWrap: {
    borderTopWidth: 1,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 16,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
  },
  input: {
    flex: 1,
    minHeight: 48,
    maxHeight: 120,
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    textAlignVertical: 'top',
  },
  sendBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
