import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

import { supabase, useSession } from '@pallinky/core';
import { GiphyPicker } from '@pallinky/ui';

const COLORS = {
  background: '#F3F5F1',
  header: '#F8FAF6',
  headerText: '#1F2A1B',
  muted: '#66715F',
  bubbleMine: '#EFE9F7',
  bubbleOther: '#FFFFFF',
  inputBg: '#FFFFFF',
  divider: '#DCE5D4',
  green: '#6A4C93',
  purple: '#6A4C93',
  iconBg: '#F1ECF7',
};

const NAME_COLORS = ['#C83F5D', '#2E8B57', '#2D70C9', '#8B5FBF', '#D27A20', '#078A8A'];
const QUICK_EMOJIS = ['😀', '😂', '🥰', '🎉', '❤️', '👍', '🙏', '🔥'];

type ChatMessage = {
  id: string;
  thread_id: string;
  sender_email_lc: string;
  message_type: 'text' | 'image' | 'system' | 'event_attachment';
  body: string | null;
  image_url?: string | null;
  metadata?: any;
  created_at: string;
  edited_at?: string | null;
};

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

function normalizeEmail(value: string | null | undefined) {
  return value?.toLowerCase().trim() || '';
}

function formatMessageTime(value: string) {
  const date = new Date(value);
  return date.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getInitials(title: string | null | undefined) {
  return String(title || 'Chat')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('') || 'CH';
}

function colorForEmail(email: string) {
  let total = 0;
  for (let index = 0; index < email.length; index += 1) {
    total += email.charCodeAt(index);
  }
  return NAME_COLORS[total % NAME_COLORS.length];
}

function getMessageImageUrl(message: ChatMessage) {
  if (message.image_url) return message.image_url;
  return null;
}

function DoodleBackground() {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {Array.from({ length: 56 }).map((_, index) => {
        const left = `${(index * 23) % 100}%` as `${number}%`;
        const top = `${(index * 17) % 100}%` as `${number}%`;
        const rotate = `${(index * 29) % 360}deg`;
        const icon = ['○', '·', '□', '◇', '✦', '◌'][index % 6];
        const color = index % 5 === 0 ? 'rgba(106, 76, 147, 0.10)' : 'rgba(67, 105, 27, 0.09)';

        return (
          <Text
            key={index}
            style={[
              styles.doodle,
              {
                color,
                left,
                top,
                transform: [{ rotate }],
              },
            ]}
          >
            {icon}
          </Text>
        );
      })}
    </View>
  );
}

function titleForSystemMessage(message: ChatMessage) {
  if (message.message_type === 'event_attachment') {
    return message.body || 'Event added';
  }
  return message.body || 'System message';
}

export default function ChatThreadPage() {
  const { threadId } = useLocalSearchParams<{ threadId: string }>();
  const router = useRouter();
  const { session } = useSession();
  const scrollRef = useRef<ScrollView | null>(null);

  const viewerEmail = normalizeEmail(session?.user?.email);

  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [thread, setThread] = useState<ThreadDetails | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [profilesByEmail, setProfilesByEmail] = useState<Record<string, string>>({});
  const [linkedEventsById, setLinkedEventsById] = useState<Record<string, LinkedEvent>>({});
  const [body, setBody] = useState('');
  const [showEmojiTray, setShowEmojiTray] = useState(false);
  const [showGiphyPicker, setShowGiphyPicker] = useState(false);

  const fetchChat = useCallback(async () => {
    if (!threadId || !viewerEmail) {
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      const [
        { data: threadData, error: threadError },
        { data: messageData, error: messageError },
        { data: linkedEventData, error: linkedEventError },
      ] =
        await Promise.all([
          supabase.rpc('get_chat_thread_details', {
            p_thread_id: threadId,
            p_user_email: viewerEmail,
          }),
          supabase.rpc('get_chat_thread_messages', {
            p_thread_id: threadId,
            p_user_email: viewerEmail,
          }),
          supabase.rpc('get_chat_thread_events', {
            p_thread_id: threadId,
            p_user_email: viewerEmail,
          }),
        ]);

      if (threadError) throw threadError;
      if (messageError) throw messageError;
      if (linkedEventError) throw linkedEventError;

      const nextThread = ((threadData || [])[0] || null) as ThreadDetails | null;
      const nextMessages = (messageData || []) as ChatMessage[];
      const nextLinkedEvents = (linkedEventData || []) as LinkedEvent[];

      setThread(nextThread);
      setMessages(nextMessages);
      setLinkedEventsById(
        nextLinkedEvents.reduce<Record<string, LinkedEvent>>((acc, eventRow) => {
          acc[String(eventRow.event_id)] = eventRow;
          return acc;
        }, {})
      );

      const senderEmails = Array.from(
        new Set(nextMessages.map((item) => normalizeEmail(item.sender_email_lc)).filter(Boolean))
      );

      if (senderEmails.length > 0) {
        const { data: profileData } = await supabase
          .from('profiles')
          .select('email_lc, full_name')
          .in('email_lc', senderEmails);

        const nextProfiles: Record<string, string> = {};
        (profileData || []).forEach((profile: any) => {
          nextProfiles[normalizeEmail(profile.email_lc)] = profile.full_name || '';
        });
        setProfilesByEmail(nextProfiles);
      } else {
        setProfilesByEmail({});
      }

      await supabase.rpc('mark_chat_thread_read', {
        p_thread_id: threadId,
        p_user_email: viewerEmail,
      });
    } catch (err) {
      console.error(err);
      setThread(null);
      setMessages([]);
      setLinkedEventsById({});
    } finally {
      setLoading(false);
    }
  }, [threadId, viewerEmail]);

  useEffect(() => {
    void fetchChat();
  }, [fetchChat]);

  useFocusEffect(
    useCallback(() => {
      void fetchChat();
    }, [fetchChat])
  );

  useEffect(() => {
    if (!threadId) return;

    const existing = supabase
      .getChannels()
      .find((channel: any) => channel.topic === `realtime:chat-thread:${threadId}`);

    if (existing) {
      void supabase.removeChannel(existing);
    }

    const channel = supabase
      .channel(`chat-thread:${threadId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'chat_threads', filter: `id=eq.${threadId}` },
        () => {
          void fetchChat();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'chat_thread_events', filter: `thread_id=eq.${threadId}` },
        () => {
          void fetchChat();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'chat_messages', filter: `thread_id=eq.${threadId}` },
        () => {
          void fetchChat();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'chat_thread_participants', filter: `thread_id=eq.${threadId}` },
        () => {
          void fetchChat();
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [threadId, fetchChat]);

  useEffect(() => {
    if (messages.length === 0) return;

    requestAnimationFrame(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
    });
  }, [messages.length]);

  const getDisplayName = useCallback(
    (email: string) => {
      const cleanEmail = normalizeEmail(email);
      if (!cleanEmail) return 'Guest';
      if (cleanEmail === viewerEmail) return 'You';
      return profilesByEmail[cleanEmail] || cleanEmail.split('@')[0] || 'Guest';
    },
    [profilesByEmail, viewerEmail]
  );

  const uploadImage = useCallback(
    async (uri: string, contentType = 'image/jpeg') => {
      if (!threadId || !viewerEmail) return;

      setUploadingImage(true);

      try {
        const extension = contentType.includes('png') ? 'png' : 'jpg';
        const safeThreadId = String(threadId).replace(/[^a-zA-Z0-9_-]/g, '_');
        const safeEmail = viewerEmail.replace(/[^a-zA-Z0-9_-]/g, '_');
        const fileName = `threads/${safeThreadId}/${safeEmail}_${Date.now()}.${extension}`;
        const response = await fetch(uri);
        const arrayBuffer = await response.arrayBuffer();

        const { error: uploadError } = await supabase.storage
          .from('chat-images')
          .upload(fileName, arrayBuffer, {
            contentType,
            upsert: false,
          });

        if (uploadError) throw uploadError;

        const {
          data: { publicUrl },
        } = supabase.storage.from('chat-images').getPublicUrl(fileName);

        const { error } = await supabase.rpc('send_chat_message', {
          p_thread_id: threadId,
          p_sender_email: viewerEmail,
          p_body: 'Photo',
          p_image_url: publicUrl,
        });

        if (error) throw error;

        await fetchChat();
      } catch (err: any) {
        console.error('Chat image upload failed', err);
        Alert.alert('Could not send photo', err?.message || 'Please try again.');
      } finally {
        setUploadingImage(false);
      }
    },
    [fetchChat, threadId, viewerEmail]
  );

  const pickImage = useCallback(async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Photo access needed', 'Please allow photo library access to send pictures.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      quality: 0.78,
    });

    const asset = result.assets?.[0];
    if (result.canceled || !asset?.uri) return;

    await uploadImage(asset.uri, asset.mimeType || 'image/jpeg');
  }, [uploadImage]);

  const handleSend = useCallback(async () => {
    const cleanBody = body.trim();

    if (!threadId || !viewerEmail || !cleanBody || sending) return;

    setSending(true);

    try {
      const { error } = await supabase.rpc('send_chat_message', {
        p_thread_id: threadId,
        p_sender_email: viewerEmail,
        p_body: cleanBody,
      });

      if (error) throw error;

      setBody('');
      await fetchChat();
    } catch (err: any) {
      console.error(err);
      Alert.alert('Could not send message', err?.message || 'Please try again.');
    } finally {
      setSending(false);
    }
  }, [body, fetchChat, sending, threadId, viewerEmail]);

  const appendEmoji = useCallback((emoji: string) => {
    setBody((current) => `${current}${emoji}`);
  }, []);

  const handleSendGif = useCallback(
    async (url: string) => {
      if (!threadId || !viewerEmail || !url) return;

      try {
        const { error } = await supabase.rpc('send_chat_message', {
          p_thread_id: threadId,
          p_sender_email: viewerEmail,
          p_body: null,
          p_image_url: url,
          p_metadata: { media_kind: 'gif' },
        });

        if (error) throw error;

        setShowGiphyPicker(false);
        await fetchChat();
      } catch (err: any) {
        console.error('Could not send GIF', err);
        Alert.alert('Could not send GIF', err?.message || 'Please try again.');
      }
    },
    [fetchChat, threadId, viewerEmail]
  );

  const title = thread?.title || 'Chat';
  const participantPreview = thread?.participant_preview || 'Chat';
  const avatarUrl = thread?.avatar_url || null;
  const openEventFromMessage = useCallback(
    (message: ChatMessage) => {
      const metadataEventId = message.metadata?.event_id ? String(message.metadata.event_id) : '';
      const metadataEventSlug = message.metadata?.event_slug ? String(message.metadata.event_slug) : '';
      const linkedEvent = metadataEventId ? linkedEventsById[metadataEventId] : null;
      const slug = metadataEventSlug || linkedEvent?.event_slug || '';
      if (!slug) return;
      router.push(`/event/${slug}/details` as any);
    },
    [linkedEventsById, router]
  );

  const groupedMessages = useMemo(() => messages, [messages]);

  if (!viewerEmail) {
    return (
      <SafeAreaView style={styles.centered}>
        <Text style={styles.emptyTitle}>Sign in required</Text>
      </SafeAreaView>
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator color={COLORS.green} />
      </SafeAreaView>
    );
  }

  if (!thread) {
    return (
      <SafeAreaView style={styles.centered}>
        <Text style={styles.emptyTitle}>Chat not found</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 24}
      >
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.headerCircle}
            onPress={() => router.replace('/(tabs)/chat' as any)}
          >
            <Ionicons name="chevron-back" size={28} color={COLORS.headerText} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.headerIdentity}
            activeOpacity={0.8}
            onPress={() =>
              router.push({ pathname: '/chat/info/[threadId]', params: { threadId } } as any)
            }
          >
            {avatarUrl ? (
              <Image source={{ uri: avatarUrl }} style={styles.headerAvatar} />
            ) : (
              <View style={styles.headerAvatarFallback}>
                {thread.kind === 'direct' ? (
                  <Ionicons name="person" size={20} color={COLORS.purple} />
                ) : (
                  <Text style={styles.headerAvatarText}>{getInitials(title)}</Text>
                )}
              </View>
            )}

            <View style={styles.headerTextWrap}>
              <Text style={styles.headerTitle} numberOfLines={1}>
                {title}
              </Text>
              <Text style={styles.headerSubtitle} numberOfLines={1}>
                {participantPreview}
              </Text>
            </View>
          </TouchableOpacity>

            <View style={styles.headerActions}>
              <TouchableOpacity
                style={styles.headerCircle}
                onPress={() =>
                  router.push({ pathname: '/chat/people/[threadId]', params: { threadId } } as any)
                }
              >
                <Ionicons name="person-add-outline" size={20} color={COLORS.headerText} />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.headerCircle}
                onPress={() =>
                  router.push({ pathname: '/chat/events/[threadId]', params: { threadId } } as any)
                }
              >
                <Ionicons name="calendar-outline" size={22} color={COLORS.headerText} />
              </TouchableOpacity>
            </View>
          </View>

        <View style={styles.chatArea}>
          <DoodleBackground />

          <ScrollView
            ref={scrollRef}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}
          >
            {groupedMessages.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyStateText}>No messages yet</Text>
              </View>
            ) : (
              groupedMessages.map((message) => {
                const isMine = normalizeEmail(message.sender_email_lc) === viewerEmail;
                const imageUrl = getMessageImageUrl(message);
                const senderName = getDisplayName(message.sender_email_lc);

                if (message.message_type === 'event_attachment') {
                  const metadataEventId = message.metadata?.event_id
                    ? String(message.metadata.event_id)
                    : '';
                  const metadataEventSlug = message.metadata?.event_slug
                    ? String(message.metadata.event_slug)
                    : '';
                  const eventRow = metadataEventId ? linkedEventsById[metadataEventId] : null;
                  const canOpenEvent = Boolean(metadataEventSlug || eventRow?.event_slug);

                  return (
                    <View key={message.id} style={styles.systemRow}>
                      <TouchableOpacity
                        activeOpacity={canOpenEvent ? 0.8 : 1}
                        disabled={!canOpenEvent}
                        onPress={() => openEventFromMessage(message)}
                        style={styles.systemBubble}
                      >
                        <MaterialCommunityIcons
                          name="calendar-heart"
                          size={16}
                          color={COLORS.green}
                        />
                        <Text style={styles.systemText}>
                          {eventRow?.event_title || titleForSystemMessage(message)}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  );
                }

                return (
                  <View
                    key={message.id}
                    style={[
                      styles.messageRow,
                      isMine ? styles.messageRowMine : styles.messageRowOther,
                    ]}
                  >
                    {!isMine ? (
                      <View
                        style={[
                          styles.senderDot,
                          { backgroundColor: colorForEmail(message.sender_email_lc) },
                        ]}
                      >
                        <Text style={styles.senderDotText}>{senderName.charAt(0).toUpperCase()}</Text>
                      </View>
                    ) : null}

                    <View
                      style={[
                        styles.messageBubble,
                        isMine ? styles.messageBubbleMine : styles.messageBubbleOther,
                        imageUrl ? styles.imageBubble : null,
                      ]}
                    >
                      {!isMine && thread.kind !== 'direct' ? (
                        <Text
                          style={[
                            styles.messageSender,
                            { color: colorForEmail(message.sender_email_lc) },
                          ]}
                        >
                          {senderName}
                        </Text>
                      ) : null}

                      {imageUrl ? (
                        <Image source={{ uri: imageUrl }} style={styles.messageImage} />
                      ) : null}

                      {message.body ? <Text style={styles.messageBody}>{message.body}</Text> : null}

                      <View style={styles.messageMeta}>
                        <Text style={styles.messageTime}>{formatMessageTime(message.created_at)}</Text>
                        {isMine ? (
                          <Ionicons name="checkmark-done" size={17} color="#5A766E" />
                        ) : null}
                      </View>
                    </View>
                  </View>
                );
              })
            )}
          </ScrollView>
        </View>

        {showEmojiTray ? (
          <View style={styles.emojiTray}>
            {QUICK_EMOJIS.map((emoji) => (
              <TouchableOpacity
                key={emoji}
                style={styles.emojiChip}
                activeOpacity={0.82}
                onPress={() => appendEmoji(emoji)}
              >
                <Text style={styles.emojiText}>{emoji}</Text>
              </TouchableOpacity>
            ))}
          </View>
        ) : null}

        <View style={styles.composerWrap}>
          <View style={styles.inputWrap}>
            <TouchableOpacity
              style={styles.inlineIconButton}
              onPress={() => setShowEmojiTray((current) => !current)}
            >
              <Ionicons
                name={showEmojiTray ? 'happy' : 'happy-outline'}
                size={22}
                color={COLORS.headerText}
              />
            </TouchableOpacity>

            <TextInput
              style={styles.input}
              placeholder=""
              placeholderTextColor={COLORS.muted}
              value={body}
              onChangeText={setBody}
              multiline
            />

            <TouchableOpacity
              style={styles.inlineIconButton}
              onPress={() => setShowGiphyPicker(true)}
            >
              <Text style={styles.gifButtonText}>GIF</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.inlineIconButton}
              onPress={pickImage}
              disabled={uploadingImage}
            >
              {uploadingImage ? (
                <ActivityIndicator color={COLORS.green} />
              ) : (
                <Ionicons name="camera-outline" size={23} color={COLORS.headerText} />
              )}
            </TouchableOpacity>
          </View>

          {body.trim() ? (
            <TouchableOpacity style={styles.sendBtn} onPress={handleSend} disabled={sending}>
              {sending ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Ionicons name="arrow-up" size={19} color="#fff" />
              )}
            </TouchableOpacity>
          ) : null}
        </View>

        <GiphyPicker
          visible={showGiphyPicker}
          onClose={() => setShowGiphyPicker(false)}
          onSelect={(url) => {
            void handleSendGif(url);
          }}
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.header,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: COLORS.background,
  },
  header: {
    minHeight: 68,
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: COLORS.header,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerCircle: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: COLORS.iconBg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerCirclePlaceholder: {
    width: 46,
    height: 46,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerIdentity: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#DCE8D0',
  },
  headerAvatarFallback: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#E3ECD9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerAvatarText: {
    fontSize: 14,
    fontWeight: '900',
    color: COLORS.purple,
  },
  headerTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  headerTitle: {
    fontSize: 17,
    lineHeight: 21,
    fontWeight: '900',
    color: COLORS.headerText,
  },
  headerSubtitle: {
    marginTop: 2,
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.muted,
  },
  chatArea: {
    flex: 1,
    backgroundColor: COLORS.background,
    overflow: 'hidden',
  },
  doodle: {
    position: 'absolute',
    fontSize: 22,
    fontWeight: '800',
  },
  scrollContent: {
    paddingHorizontal: 10,
    paddingTop: 10,
    paddingBottom: 14,
  },
  emptyState: {
    marginTop: 24,
    alignSelf: 'center',
    backgroundColor: 'rgba(255,255,255,0.88)',
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 14,
  },
  emptyStateText: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.muted,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.headerText,
  },
  messageRow: {
    flexDirection: 'row',
    marginVertical: 5,
    alignItems: 'flex-end',
  },
  messageRowMine: {
    justifyContent: 'flex-end',
    paddingLeft: 58,
  },
  messageRowOther: {
    justifyContent: 'flex-start',
    paddingRight: 42,
  },
  senderDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  senderDotText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '900',
  },
  messageBubble: {
    maxWidth: '88%',
    borderRadius: 12,
    paddingHorizontal: 9,
    paddingVertical: 6,
    shadowColor: '#1F2A1B',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  messageBubbleMine: {
    backgroundColor: COLORS.bubbleMine,
    borderTopRightRadius: 5,
  },
  messageBubbleOther: {
    backgroundColor: COLORS.bubbleOther,
    borderTopLeftRadius: 5,
  },
  imageBubble: {
    padding: 5,
  },
  messageSender: {
    fontSize: 13,
    lineHeight: 16,
    fontWeight: '900',
    marginBottom: 4,
  },
  messageBody: {
    fontSize: 16,
    lineHeight: 21,
    fontWeight: '400',
    color: COLORS.headerText,
  },
  messageImage: {
    width: 210,
    height: 210,
    borderRadius: 9,
    backgroundColor: COLORS.divider,
  },
  messageMeta: {
    alignSelf: 'flex-end',
    marginTop: 2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  messageTime: {
    fontSize: 11,
    fontWeight: '400',
    color: COLORS.muted,
  },
  systemRow: {
    alignItems: 'center',
    marginVertical: 6,
  },
  systemBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
    backgroundColor: 'rgba(248,250,246,0.96)',
    borderWidth: 1,
    borderColor: 'rgba(106,76,147,0.10)',
  },
  systemText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.headerText,
  },
  emojiTray: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 4,
    backgroundColor: COLORS.header,
  },
  emojiChip: {
    minWidth: 40,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: 'rgba(106,76,147,0.10)',
  },
  emojiText: {
    fontSize: 20,
  },
  composerWrap: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 10,
    paddingTop: 8,
    paddingBottom: 10,
    backgroundColor: COLORS.header,
    gap: 8,
  },
  inlineIconButton: {
    minWidth: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inputWrap: {
    flex: 1,
    minHeight: 42,
    maxHeight: 120,
    borderRadius: 22,
    backgroundColor: COLORS.inputBg,
    paddingLeft: 14,
    paddingRight: 10,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
  },
  input: {
    flex: 1,
    fontSize: 16,
    lineHeight: 20,
    color: COLORS.headerText,
    paddingTop: 0,
    paddingBottom: 0,
  },
  gifButtonText: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.headerText,
  },
  sendBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: COLORS.green,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
});
