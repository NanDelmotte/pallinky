/**
 * Path: app/event/[slug]/chat.tsx
 * Description: WhatsApp-style shared event chat for hosts and participants.
 */

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
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { supabase, useSession } from '@pallinky/core';

const COLORS = {
  background: '#EFEAE2',
  header: '#F7F5F0',
  headerText: '#111111',
  muted: '#656565',
  bubbleMine: '#D9FDD3',
  bubbleOther: '#FFFFFF',
  inputBg: '#FFFFFF',
  divider: '#E5DED4',
  green: '#1F9D55',
  iconBg: '#FFFFFF',
};

const NAME_COLORS = ['#C83F5D', '#2E8B57', '#2D70C9', '#8B5FBF', '#D27A20', '#078A8A'];

type ChatMessage = {
  id: string;
  sender_email_lc: string;
  body: string | null;
  created_at: string;
  image_url?: string | null;
  attachment_url?: string | null;
  photo_url?: string | null;
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
  return String(title || 'Event')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('') || 'EV';
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
  if (message.attachment_url) return message.attachment_url;
  if (message.photo_url) return message.photo_url;

  const body = String(message.body || '').trim();
  if (body.startsWith('Photo: ')) {
    return body.slice('Photo: '.length).trim();
  }

  return null;
}

function getMessageBody(message: ChatMessage) {
  const body = String(message.body || '').trim();
  if (body.startsWith('Photo: ')) return '';
  return body;
}

function DoodleBackground() {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {Array.from({ length: 56 }).map((_, index) => {
        const left = `${(index * 23) % 100}%` as `${number}%`;
        const top = `${(index * 17) % 100}%` as `${number}%`;
        const rotate = `${(index * 29) % 360}deg`;
        const icon = ['○', '+', '□', '◇', '♡', '✦'][index % 6];

        return (
          <Text
            key={index}
            style={[
              styles.doodle,
              {
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

export default function EventChatPage() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const router = useRouter();
  const { session } = useSession();
  const scrollRef = useRef<ScrollView | null>(null);

  const viewerEmail = normalizeEmail(session?.user?.email);

  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [event, setEvent] = useState<any>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [profilesByEmail, setProfilesByEmail] = useState<Record<string, string>>({});
  const [participantPreview, setParticipantPreview] = useState('');
  const [body, setBody] = useState('');

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

      const nextMessages = (messageData || []) as ChatMessage[];
      setMessages(nextMessages);

      const { data: rsvps } = await supabase
        .from('rsvps')
        .select('name, email_lc, email, status')
        .eq('event_id', eventData.id);

      const senderEmails = Array.from(
        new Set([
          ...nextMessages.map((item) => normalizeEmail(item.sender_email_lc)),
          normalizeEmail(eventData.host_email),
          ...((rsvps || []) as any[]).map((item) => normalizeEmail(item.email_lc || item.email)),
        ].filter(Boolean))
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

      (rsvps || []).forEach((rsvp: any) => {
        const email = normalizeEmail(rsvp.email_lc || rsvp.email);
        if (!email || nextProfiles[email]) return;
        nextProfiles[email] = rsvp.name || '';
      });

      setProfilesByEmail(nextProfiles);

      const participantNames = Object.entries(nextProfiles)
        .filter(([email]) => email !== viewerEmail)
        .map(([, name]) => name)
        .filter(Boolean)
        .slice(0, 3);

      setParticipantPreview(
        participantNames.length > 0 ? participantNames.join(', ') : 'Event chat'
      );

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

  useEffect(() => {
    if (!event?.id) return;

    const channel = supabase
      .channel(`event-chat:${event.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'event_chat_messages' }, () => {
        void fetchChat();
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [event?.id, fetchChat]);

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
      if (cleanEmail === normalizeEmail(event?.host_email)) {
        return profilesByEmail[cleanEmail] || event?.host_name || 'Host';
      }

      return profilesByEmail[cleanEmail] || 'Guest';
    },
    [event?.host_email, event?.host_name, profilesByEmail, viewerEmail]
  );

  const uploadImage = useCallback(
    async (uri: string, contentType = 'image/jpeg') => {
      if (!event?.id || !viewerEmail) return;

      setUploadingImage(true);

      try {
        const extension = contentType.includes('png') ? 'png' : 'jpg';
        const safeEventId = String(event.id).replace(/[^a-zA-Z0-9_-]/g, '_');
        const safeEmail = viewerEmail.replace(/[^a-zA-Z0-9_-]/g, '_');
        const fileName = `${safeEventId}/${safeEmail}_${Date.now()}.${extension}`;
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

        const { error } = await supabase.rpc('post_event_chat_message', {
          p_event_id: event.id,
          p_sender_email: viewerEmail,
          p_body: 'Photo',
          p_image_url: publicUrl,
        });

        if (error) {
          const fallback = await supabase.rpc('post_event_chat_message', {
            p_event_id: event.id,
            p_sender_email: viewerEmail,
            p_body: `Photo: ${publicUrl}`,
          });

          if (fallback.error) throw fallback.error;
        }

        await fetchChat();
      } catch (err: any) {
        console.error('Chat image upload failed', err);
        Alert.alert('Could not send photo', err?.message || 'Please try again.');
      } finally {
        setUploadingImage(false);
      }
    },
    [event?.id, fetchChat, viewerEmail]
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
    } catch (err: any) {
      console.error(err);
      Alert.alert('Could not send message', err?.message || 'Please try again.');
    } finally {
      setSending(false);
    }
  }, [body, event, fetchChat, sending, viewerEmail]);

  const title = event?.title || 'Chat';
  const avatarUrl = event?.cover_image_url || null;

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

  if (!event) {
    return (
      <SafeAreaView style={styles.centered}>
        <Text style={styles.emptyTitle}>Event not found</Text>
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
          <TouchableOpacity style={styles.headerCircle} onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={28} color={COLORS.headerText} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.headerIdentity}
            activeOpacity={0.8}
            onPress={() => router.push(`/event/${slug}/details` as any)}
          >
            {avatarUrl ? (
              <Image source={{ uri: avatarUrl }} style={styles.headerAvatar} />
            ) : (
              <View style={styles.headerAvatarFallback}>
                <Text style={styles.headerAvatarText}>{getInitials(title)}</Text>
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

          <TouchableOpacity
            style={styles.headerCircle}
            onPress={() => router.push(`/event/${slug}/details` as any)}
          >
            <Ionicons name="calendar-outline" size={22} color={COLORS.headerText} />
          </TouchableOpacity>
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
                const messageBody = getMessageBody(message);
                const senderName = getDisplayName(message.sender_email_lc);

                return (
                  <View
                    key={message.id}
                    style={[
                      styles.messageRow,
                      isMine ? styles.messageRowMine : styles.messageRowOther,
                    ]}
                  >
                    {!isMine ? (
                      <View style={[styles.senderDot, { backgroundColor: colorForEmail(message.sender_email_lc) }]}>
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
                      {!isMine ? (
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

                      {messageBody ? <Text style={styles.messageBody}>{messageBody}</Text> : null}

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

        <View style={styles.composerWrap}>
          <TouchableOpacity
            style={styles.composerIcon}
            onPress={pickImage}
            disabled={uploadingImage}
          >
            <Ionicons name="add" size={30} color={COLORS.headerText} />
          </TouchableOpacity>

          <View style={styles.inputWrap}>
            <TextInput
              style={styles.input}
              placeholder=""
              placeholderTextColor={COLORS.muted}
              value={body}
              onChangeText={setBody}
              multiline
            />

            <TouchableOpacity onPress={pickImage} disabled={uploadingImage}>
              {uploadingImage ? (
                <ActivityIndicator color={COLORS.green} />
              ) : (
                <Ionicons name="camera-outline" size={23} color={COLORS.headerText} />
              )}
            </TouchableOpacity>
          </View>

          {body.trim() ? (
            <TouchableOpacity
              style={styles.sendBtn}
              onPress={handleSend}
              disabled={sending}
            >
              {sending ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Ionicons name="arrow-up" size={19} color="#fff" />
              )}
            </TouchableOpacity>
          ) : null}
        </View>
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
    backgroundColor: '#D9F0FA',
  },
  headerAvatarFallback: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#CFEFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerAvatarText: {
    fontSize: 14,
    fontWeight: '900',
    color: '#2A80B9',
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
    color: 'rgba(171, 150, 120, 0.16)',
    fontSize: 24,
    fontWeight: '900',
  },
  scrollContent: {
    paddingHorizontal: 10,
    paddingTop: 10,
    paddingBottom: 14,
  },
  emptyState: {
    marginTop: 24,
    alignSelf: 'center',
    backgroundColor: 'rgba(255,255,255,0.78)',
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 1,
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
    color: '#111',
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
  composerWrap: {
    minHeight: 58,
    paddingHorizontal: 10,
    paddingTop: 7,
    paddingBottom: 8,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 9,
    backgroundColor: COLORS.header,
    borderTopWidth: 1,
    borderTopColor: COLORS.divider,
  },
  composerIcon: {
    width: 34,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inputWrap: {
    flex: 1,
    minHeight: 40,
    maxHeight: 104,
    borderRadius: 20,
    backgroundColor: COLORS.inputBg,
    borderWidth: 1,
    borderColor: '#D4D4D4',
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 10,
  },
  input: {
    flex: 1,
    minHeight: 28,
    maxHeight: 88,
    fontSize: 16,
    color: COLORS.headerText,
    paddingTop: 3,
    paddingBottom: 3,
    textAlignVertical: 'top',
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.green,
  },
});
