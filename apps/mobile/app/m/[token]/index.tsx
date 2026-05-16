/**
 * Path: apps/mobile/app/m/[token]/index.tsx
 * Description: Host Management Dashboard.
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
  TextInput,
  Modal,
  Platform,
  Keyboard,
  KeyboardAvoidingView,
  TouchableWithoutFeedback,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { supabase } from '@pallinky/core';
import { StyledText } from '@pallinky/ui';
import { Ionicons } from '@expo/vector-icons';

export default function ManageEventScreen() {
  const params = useLocalSearchParams<{ token?: string | string[] }>();
  const token = Array.isArray(params.token) ? params.token[0] : params.token;
  const router = useRouter();

  const [event, setEvent] = useState<any>(null);
  const [guests, setGuests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [showMessageModal, setShowMessageModal] = useState(false);
  const [messageSubject, setMessageSubject] = useState('');
  const [messageText, setMessageText] = useState('');
  const [isSending, setIsSending] = useState(false);

  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelMessage, setCancelMessage] = useState('');
  const [isCancelling, setIsCancelling] = useState(false);

  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    if (!token || typeof token !== 'string') return;
    void fetchData();
  }, [token]);

  useEffect(() => {
    if (!showMessageModal && !showCancelModal) {
      setKeyboardHeight(0);
      return;
    }

    const showSub = Keyboard.addListener('keyboardDidShow', (e) => {
      setKeyboardHeight(e.endCoordinates?.height || 0);
    });

    const hideSub = Keyboard.addListener('keyboardDidHide', () => {
      setKeyboardHeight(0);
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [showMessageModal, showCancelModal]);

  const modalContentStyle = useMemo(
    () => [
      styles.modalContent,
      Platform.OS === 'android' && keyboardHeight > 0
        ? { paddingBottom: Math.max(24, keyboardHeight + 12) }
        : null,
    ],
    [keyboardHeight]
  );

  async function fetchData() {
    setLoading(true);

    try {
      const { data: ev, error } = await supabase.rpc('get_event_by_manage_token', {
        p_manage_token: token,
      });

      if (error) throw error;

      if (ev && ev[0]) {
        const current = ev[0];
        setEvent(current);

        const { data: rsvps, error: rsvpError } = await supabase
          .from('rsvps')
          .select('*')
          .eq('event_id', current.id)
          .order('responded_at', { ascending: false });

        if (rsvpError) throw rsvpError;
        setGuests(rsvps || []);
      }
    } catch (err) {
      Alert.alert('Error', 'Could not load this event.');
    } finally {
      setLoading(false);
    }
  }

  const handleSendMessage = async () => {
    const safeToken = typeof token === 'string' ? token.trim() : '';

    if (!safeToken) {
      Alert.alert('Error', 'Missing manage token.');
      return;
    }

    if (!messageSubject.trim() || !messageText.trim()) {
      Alert.alert('Missing Info', 'Please provide both a subject and a message.');
      return;
    }

    setIsSending(true);

    try {
      const payload = {
        p_manage_token: safeToken,
        p_subject: messageSubject.trim(),
        p_body: messageText.trim(),
      };

      console.log('send_host_message_by_manage_token payload', payload);

      const { data, error } = await supabase.rpc('send_host_message_by_manage_token', payload);

      console.log('send_host_message_by_manage_token result', { data, error });

      if (error) {
        throw error;
      }

      Alert.alert('Sent', 'Your message has been queued for guests.');
      setMessageText('');
      setMessageSubject('');
      setShowMessageModal(false);
    } catch (err: any) {
      console.log('send_host_message_by_manage_token failed', err);

      const message =
        err?.message ||
        err?.details ||
        err?.hint ||
        (typeof err === 'string' ? err : 'Failed to queue messages.');

      Alert.alert('Error', message);
    } finally {
      setIsSending(false);
    }
  };

  const handleCancelEvent = async () => {
    const safeToken = typeof token === 'string' ? token.trim() : '';

    if (!safeToken) {
      Alert.alert('Error', 'Missing manage token.');
      return;
    }



    setIsCancelling(true);

    try {
  const payload = {
  p_manage_token: safeToken,
  p_message: cancelMessage.trim() || null,
};

      console.log('cancel_event_by_manage_token payload', payload);

      const { data, error } = await supabase.rpc(
        'cancel_event_by_manage_token',
        payload as {
          p_manage_token: string;
          p_message: string;
        }
      );

      console.log('cancel_event_by_manage_token result', { data, error });

      if (error) {
        throw error;
      }

      setShowCancelModal(false);
      setCancelMessage('');

      Alert.alert('Event Cancelled', 'Event cancelled and your guests have been notified.', [
        {
          text: 'OK',
          onPress: () => router.replace('/(tabs)'),
        },
      ]);
    } catch (err: any) {
      console.log('cancel_event_by_manage_token failed', err);

      const message =
        err?.message ||
        err?.details ||
        err?.hint ||
        (typeof err === 'string' ? err : 'Failed to cancel event.');

      Alert.alert('Error', message);
    } finally {
      setIsCancelling(false);
    }
  };

  const openCancelFlow = () => {
    Alert.alert(
      'Cancel event?',
      'This will cancel the event and notify all RSVPd guests.',
      [
        { text: 'Keep Event', style: 'cancel' },
        {
          text: 'Continue',
          style: 'destructive',
          onPress: () => setShowCancelModal(true),
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color="#43691b" />
      </View>
    );
  }

  if (!event) {
    return (
      <View style={styles.centered}>
        <StyledText>Event not found.</StyledText>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <View style={styles.headerNav}>
        <TouchableOpacity onPress={() => router.replace('/(tabs)')} style={styles.closeBtn}>
          <Ionicons name="arrow-back" size={24} color="#1a1a1a" />
          <StyledText style={styles.backText}>My Social Hub</StyledText>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
        <StyledText style={styles.title}>{event.title}</StyledText>

        <View style={styles.actionGrid}>
          <TouchableOpacity
            style={styles.actionItem}
            onPress={() =>
              router.push({
                pathname: '/m/[token]/edit',
                params: {
                  token,
                  title: event.title || '',
                  description: event.description || '',
                  location: event.location || '',
                  host_name: event.host_name || '',
                  host_email: event.host_email || '',
                  event_type: event.event_type || 'formal',
                  starts_at: event.starts_at || '',
                  ends_at: event.ends_at || '',
                  proposed_dates: JSON.stringify(event.proposed_dates || []),
                  visibility: String(event.visibility || 3),
                  invite_list_visibility: event.invite_list_visibility || 'host_only',
                  guest_list_visibility: event.guest_list_visibility || 'guests_can_see',
                  send_rsvp_reminders: String(!!event.send_rsvp_reminders),
                  remind_after_days: String(event.remind_after_days || 3),
                  rsvp_deadline: event.rsvp_deadline || '',
                  send_final_reminder_at_deadline: String(
                    !!event.send_final_reminder_at_deadline
                  ),
                  forwarding_mode: event.forwarding_mode || '',
                },
              })
            }
          >
            <View style={[styles.iconCircle, { backgroundColor: '#eef2ff' }]}>
              <Ionicons name="create" size={24} color="#4338ca" />
            </View>
            <StyledText style={styles.actionLabel}>Edit Info</StyledText>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionItem}
            onPress={() => router.push(`/m/${token}/studio` as any)}
          >
            <View style={[styles.iconCircle, { backgroundColor: '#fff1f2' }]}>
              <Ionicons name="color-palette" size={24} color="#be123c" />
            </View>
            <StyledText style={styles.actionLabel}>Studio</StyledText>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionItem}
            onPress={() =>
  router.push({
    pathname: event.event_type === 'formal' ? '/create/success' : '/create/success-vibe',
    params: {
      slug: event.slug,
      manage_handle: event.manage_handle || token,      title: event.title,
      visibility: String(event.visibility ?? 3),
    },
  })
}
          >
            <View style={[styles.iconCircle, { backgroundColor: '#f0fdf4' }]}>
              <Ionicons name="send" size={24} color="#15803d" />
            </View>
            <StyledText style={styles.actionLabel}>Invite</StyledText>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionItem}
            onPress={() =>
              router.push({
                pathname: '/create/duplicate',
                params: {
                  title: event.title || '',
                  description: event.description || '',
                  location: event.location || '',
                  host_name: event.host_name || '',
                  host_email: event.host_email || '',
                  event_type: event.event_type || 'formal',
                  starts_at: event.starts_at || '',
                  ends_at: event.ends_at || '',
                  proposed_dates: JSON.stringify(event.proposed_dates || []),
                  visibility: String(event.visibility || 3),
                  invite_list_visibility: event.invite_list_visibility || 'host_only',
                  guest_list_visibility: event.guest_list_visibility || 'guests_can_see',
                  send_rsvp_reminders: String(!!event.send_rsvp_reminders),
                  remind_after_days: String(event.remind_after_days || 3),
                  rsvp_deadline: event.rsvp_deadline || '',
                  send_final_reminder_at_deadline: String(
                    !!event.send_final_reminder_at_deadline
                  ),
                  forwarding_mode: event.forwarding_mode || '',
                },
              })
            }
          >
            <View style={[styles.iconCircle, { backgroundColor: '#f3e8ff' }]}>
              <Ionicons name="copy-outline" size={24} color="#7c3aed" />
            </View>
            <StyledText style={styles.actionLabel}>Duplicate</StyledText>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.cancelActionRow} onPress={openCancelFlow}>
          <StyledText style={styles.cancelActionText}>Cancel Event</StyledText>
        </TouchableOpacity>

        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <StyledText style={styles.statNum}>
              {guests.filter((g) => g.status === 'yes').length}
            </StyledText>
            <StyledText style={styles.statLabel}>Going</StyledText>
          </View>

          <View style={styles.statCard}>
            <StyledText style={styles.statNum}>
              {guests.filter((g) => g.status === 'maybe').length}
            </StyledText>
            <StyledText style={styles.statLabel}>Maybe</StyledText>
          </View>
        </View>

        <TouchableOpacity style={styles.messageCard} onPress={() => setShowMessageModal(true)}>
          <View style={[styles.messageIconCircle, { backgroundColor: '#fefce8' }]}>
            <Ionicons name="mail" size={24} color="#a16207" />
          </View>

          <View style={styles.messageCardCopy}>
            <StyledText style={styles.messageCardTitle}>Message guests</StyledText>
            <StyledText style={styles.messageCardText}>
              Send a quick update to everyone on the guest list.
            </StyledText>
          </View>

          <Ionicons name="chevron-forward" size={20} color="#999" />
        </TouchableOpacity>

        <StyledText style={styles.sectionTitle}>Guest List ({guests.length})</StyledText>

        {guests.map((guest, i) => (
          <View key={i} style={styles.guestRow}>
            <View style={styles.guestTextWrap}>
              <StyledText style={styles.guestName}>{guest.name}</StyledText>
              {guest.message ? (
                <StyledText style={styles.guestMsg}>{`"${guest.message}"`}</StyledText>
              ) : null}
            </View>

            <View
              style={[
                styles.statusBadge,
                {
                  backgroundColor: guest.status === 'yes' ? '#e8f0e0' : '#f5f5f5',
                },
              ]}
            >
              <StyledText style={styles.statusText}>{guest.status}</StyledText>
            </View>
          </View>
        ))}
      </ScrollView>

      <Modal
        visible={showMessageModal}
        animationType="slide"
        transparent
        statusBarTranslucent
        onRequestClose={() => {
          Keyboard.dismiss();
          setShowMessageModal(false);
        }}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalRoot}
        >
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <View style={styles.modalOverlay}>
              <TouchableWithoutFeedback>
                <View style={modalContentStyle}>
                  <ScrollView
                    keyboardShouldPersistTaps="handled"
                    keyboardDismissMode="interactive"
                    contentContainerStyle={styles.modalScrollContent}
                    showsVerticalScrollIndicator={false}
                  >
                    <View style={styles.modalHeader}>
                      <StyledText style={styles.modalTitle}>Update Guests</StyledText>
                      <TouchableOpacity
                        onPress={() => {
                          Keyboard.dismiss();
                          setShowMessageModal(false);
                        }}
                      >
                        <Ionicons name="close-circle" size={28} color="#ccc" />
                      </TouchableOpacity>
                    </View>

                    <TextInput
                      style={styles.subjectInput}
                      placeholder="Subject (e.g. Quick Update)"
                      value={messageSubject}
                      onChangeText={setMessageSubject}
                      returnKeyType="next"
                      blurOnSubmit={false}
                    />

                    <TextInput
                      style={styles.messageInput}
                      placeholder="Your message to guests..."
                      multiline
                      value={messageText}
                      onChangeText={setMessageText}
                      textAlignVertical="top"
                    />

                    <TouchableOpacity
                      style={[
                        styles.sendBtn,
                        (!messageText.trim() || !messageSubject.trim() || isSending) &&
                          styles.disabledBtn,
                      ]}
                      onPress={handleSendMessage}
                      disabled={!messageText.trim() || !messageSubject.trim() || isSending}
                    >
                      {isSending ? (
                        <ActivityIndicator color="#fff" />
                      ) : (
                        <>
                          <StyledText style={styles.sendBtnText}>
                            Send to {guests.length} Guests
                          </StyledText>
                          <Ionicons name="paper-plane" size={18} color="#fff" />
                        </>
                      )}
                    </TouchableOpacity>
                  </ScrollView>
                </View>
              </TouchableWithoutFeedback>
            </View>
          </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
      </Modal>

      <Modal
        visible={showCancelModal}
        animationType="slide"
        transparent
        statusBarTranslucent
        onRequestClose={() => {
          Keyboard.dismiss();
          setShowCancelModal(false);
        }}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalRoot}
        >
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <View style={styles.modalOverlay}>
              <TouchableWithoutFeedback>
                <View style={modalContentStyle}>
                  <ScrollView
                    keyboardShouldPersistTaps="handled"
                    keyboardDismissMode="interactive"
                    contentContainerStyle={styles.modalScrollContent}
                    showsVerticalScrollIndicator={false}
                  >
                    <View style={styles.modalHeader}>
                      <StyledText style={styles.modalTitle}>Cancel Event</StyledText>
                      <TouchableOpacity
                        onPress={() => {
                          Keyboard.dismiss();
                          setShowCancelModal(false);
                        }}
                      >
                        <Ionicons name="close-circle" size={28} color="#ccc" />
                      </TouchableOpacity>
                    </View>

                    <StyledText style={styles.cancelBodyText}>
                      Add a note for your guests. This event will be cancelled and RSVPd guests will
                      be notified.
                    </StyledText>

                    <TextInput
                      style={styles.messageInput}
                      placeholder="Write a short cancellation message..."
                      multiline
                      value={cancelMessage}
                      onChangeText={setCancelMessage}
                      textAlignVertical="top"
                    />

                    <TouchableOpacity
  style={[
    styles.cancelBtn,
    isCancelling && styles.disabledBtn,
  ]}
  onPress={handleCancelEvent}
  disabled={isCancelling}
>
                      {isCancelling ? (
                        <ActivityIndicator color="#fff" />
                      ) : (
                        <>
                         <StyledText style={styles.sendBtnText}>Cancel Event</StyledText>
                          <Ionicons name="close-circle" size={18} color="#fff" />
                        </>
                      )}
                    </TouchableOpacity>
                  </ScrollView>
                </View>
              </TouchableWithoutFeedback>
            </View>
          </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#fff' },
  headerNav: { paddingTop: 60, paddingHorizontal: 20, paddingBottom: 10 },
  closeBtn: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  backText: { fontSize: 16, fontWeight: '600' },
  container: { flex: 1, padding: 24 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  title: {
    fontSize: 32,
    fontWeight: '900',
    marginBottom: 24,
    color: '#1a1a1a',
  },

  modalRoot: {
    flex: 1,
  },

  modalScrollContent: {
    flexGrow: 1,
    paddingBottom: 24,
  },

  actionGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 18,
  },

  actionItem: {
    width: '22%',
    alignItems: 'center',
  },

  iconCircle: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },

  actionLabel: {
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
  },

  cancelActionRow: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },

  cancelActionText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FF3B30',
  },

  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },

  statCard: {
    flex: 1,
    padding: 16,
    backgroundColor: '#f9fbf7',
    borderRadius: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e8f0e0',
  },

  statNum: {
    fontSize: 22,
    fontWeight: '900',
    color: '#43691b',
  },

  statLabel: {
    fontSize: 10,
    color: '#666',
    fontWeight: '600',
  },

  messageCard: {
    marginBottom: 28,
    backgroundColor: '#fffdf5',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#f3e7a4',
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },

  messageIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },

  messageCardCopy: {
    flex: 1,
  },

  messageCardTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1a1a1a',
    marginBottom: 2,
  },

  messageCardText: {
    fontSize: 13,
    color: '#666',
    lineHeight: 18,
  },

  sectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    textTransform: 'uppercase',
    marginBottom: 16,
    color: '#43691b',
  },

  guestRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },

  guestTextWrap: {
    flex: 1,
    paddingRight: 10,
  },

  guestName: {
    fontSize: 16,
    fontWeight: '600',
  },

  guestMsg: {
    fontSize: 13,
    color: '#666',
    fontStyle: 'italic',
    marginTop: 2,
  },

  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },

  statusText: {
    fontSize: 11,
    fontWeight: '700',
  },

  disabledBtn: {
    opacity: 0.5,
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },

  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingHorizontal: 24,
    paddingTop: 24,
    maxHeight: '90%',
  },

  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },

  modalTitle: {
    fontSize: 24,
    fontWeight: '900',
    color: '#1a1a1a',
  },

  subjectInput: {
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    padding: 15,
    fontSize: 16,
    marginBottom: 12,
    fontWeight: '600',
  },

  messageInput: {
    backgroundColor: '#f5f5f5',
    borderRadius: 16,
    padding: 18,
    minHeight: 140,
    fontSize: 16,
    textAlignVertical: 'top',
  },

  cancelBodyText: {
    fontSize: 14,
    lineHeight: 20,
    color: '#555',
    marginBottom: 12,
  },

  sendBtn: {
    backgroundColor: '#1a1a1a',
    padding: 20,
    borderRadius: 20,
    alignItems: 'center',
    marginTop: 20,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
  },

  cancelBtn: {
    backgroundColor: '#b91c1c',
    padding: 20,
    borderRadius: 20,
    alignItems: 'center',
    marginTop: 20,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
  },

  sendBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '900',
  },
});