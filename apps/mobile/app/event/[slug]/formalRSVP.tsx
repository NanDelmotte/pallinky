/**
 * Path: app/event/[slug]/formalRSVP.tsx
 * Description: Formal RSVP page for formal plans.
 * Uses submit_rsvp for canonical participant writes and backend guest list for display.
 * Approval-aware:
 * - approval_required / host_approval / gated visibility shows Request to Join
 * - canonical submit_rsvp may return pending_approval
 */

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Alert,
  ScrollView,
  TouchableOpacity,
  Modal,
  TextInput,
  Image,
  Platform,
  Linking,
  StatusBar,
  KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { formatInEventTimeZone, supabase, useSession } from '@pallinky/core';
import { CalendarButton } from '@pallinky/ui';
import { Ionicons } from '@expo/vector-icons';

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
};

const FONT_MAP: Record<string, string> = {
  Sans: Platform.OS === 'ios' ? 'Arial-BoldMT' : 'sans-serif-condensed',
  Serif: Platform.OS === 'ios' ? 'Times New Roman' : 'serif',
  Cursive: Platform.OS === 'ios' ? 'SnellRoundhand-Bold' : 'cursive',
  Gothic: Platform.OS === 'ios' ? 'Copperplate-Bold' : 'monospace',
};

function normalizeEmail(value: string | null | undefined) {
  return value?.toLowerCase().trim() || '';
}

export default function FormalRSVP() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const router = useRouter();
  const { session, userEmail: sessionEmail } = useSession();

  const [loading, setLoading] = useState(true);
  const [event, setEvent] = useState<any>(null);
  const [guests, setGuests] = useState<any[]>([]);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [existingStatus, setExistingStatus] = useState<string | null>(null);
  const [hasPendingRequest, setHasPendingRequest] = useState(false);
  const [deadlineMessage, setDeadlineMessage] = useState('');

  const [modalVisible, setModalVisible] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<'yes' | 'maybe' | 'no' | null>(null);
  const [guestName, setGuestName] = useState('');
  const [guestEmail, setGuestEmail] = useState('');
  const [confirmEmail, setConfirmEmail] = useState('');
  const [message, setMessage] = useState('');

  const themeKey = event?.gif_key && PALETTES[event.gif_key] ? event.gif_key : 'zen';
  const theme = PALETTES[themeKey];
  const customFont = {
    fontFamily:
      FONT_MAP[event?.font_family] || (Platform.OS === 'ios' ? 'Arial-BoldMT' : 'sans-serif'),
  };

  const badgeBg = theme.isDark ? 'rgba(255,255,255,0.12)' : SYSTEM.surface;
  const badgeText = theme.isDark ? '#ffffff' : theme.text;

  const hasLocationInDesc = event?.description?.includes('Location: ');
  const displayDescription = hasLocationInDesc
    ? event.description.split('Location: ')[0].trim()
    : event?.description;
  const locationText = hasLocationInDesc
    ? event.description.split('Location: ')[1].trim()
    : event?.location;

  const requiresApproval =
    event?.forwarding_mode === 'approval_required' ||
    event?.forwarding_mode === 'host_approval';

  const isPending = hasPendingRequest || existingStatus === 'pending';

  const openInMaps = () => {
    if (!locationText) return;
    const url = Platform.select({
      ios: `maps:0,0?q=${encodeURIComponent(locationText)}`,
      android: `geo:0,0?q=${encodeURIComponent(locationText)}`,
    });
    if (url) Linking.openURL(url);
  };

  useEffect(() => {
    void fetchData();
  }, [slug, session?.user?.id, sessionEmail]);

  const fetchData = async () => {
    setLoading(true);
    setDeadlineMessage('');

    try {
      const { data: eventData, error: eventError } = await supabase
        .from('events')
        .select('*')
        .eq('slug', slug)
        .single();

      if (eventError) throw eventError;
      setEvent(eventData);

      if (!eventData) {
        setGuests([]);
        return;
      }

      const rememberedGuestEmail = normalizeEmail(
        await SecureStore.getItemAsync('pallinky_guest_email')
      );

      const effectiveEmail = normalizeEmail(sessionEmail) || rememberedGuestEmail || '';

      if (effectiveEmail) {
        setUserEmail(effectiveEmail);
        setGuestEmail(effectiveEmail);
        setConfirmEmail(effectiveEmail);

        let profileName = '';
        if (session?.user?.id) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('full_name')
            .eq('id', session.user.id)
            .maybeSingle();

          profileName = profile?.full_name || '';
        }

        const { data: existingRsvp } = await supabase
          .from('rsvps')
          .select('id, status, name, message')
          .eq('event_id', eventData.id)
          .eq('email_lc', effectiveEmail)
          .maybeSingle();

        const { data: pendingRequest } = await supabase
          .from('rsvp_join_requests')
          .select('id')
          .eq('event_id', eventData.id)
          .eq('requester_email', effectiveEmail)
          .maybeSingle();

        const knownName = existingRsvp?.name || profileName || effectiveEmail.split('@')[0];

        setGuestName(knownName);
        setHasPendingRequest(!!pendingRequest);

        if (existingRsvp?.status && existingRsvp.status !== 'pending') {
          setExistingStatus(existingRsvp.status);
          setSelectedStatus(existingRsvp.status);
          setMessage(existingRsvp.message || '');
        } else {
          setExistingStatus(null);
          setSelectedStatus(null);
          setMessage('');
        }
      } else {
        setUserEmail(null);
        setGuestName('');
        setGuestEmail('');
        setConfirmEmail('');
        setExistingStatus(null);
        setSelectedStatus(null);
        setMessage('');
        setHasPendingRequest(false);
      }

      const { data: guestData, error: guestError } = await supabase.rpc('get_guest_list', {
        p_slug: slug,
        p_viewer_email: effectiveEmail || null,
      });

      if (guestError) throw guestError;
      setGuests(guestData || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSwitchUser = async () => {
    await SecureStore.deleteItemAsync('pallinky_guest_email');
    setUserEmail(null);
    setGuestName('');
    setGuestEmail('');
    setConfirmEmail('');
    setExistingStatus(null);
    setSelectedStatus(null);
    setMessage('');
    setHasPendingRequest(false);
  };

  const submitRSVP = async () => {
    const cleanGuestName = guestName.trim();
    const cleanGuestEmail = normalizeEmail(guestEmail);
    const cleanConfirmEmail = normalizeEmail(confirmEmail);

    setDeadlineMessage('');

    if (!selectedStatus) {
      return Alert.alert(
        'Wait',
        requiresApproval ? 'Please choose a response.' : 'Please choose Yes, Maybe, or No.'
      );
    }

    if (!cleanGuestName || !cleanGuestEmail) {
      return Alert.alert('Wait', 'Please enter your name and email.');
    }

    const isSignedInMember = !!normalizeEmail(sessionEmail);

    if (!isSignedInMember && cleanGuestEmail !== cleanConfirmEmail) {
      return Alert.alert('Check Email', "The emails don't match.");
    }

    try {
      const { data, error } = await supabase.rpc('submit_rsvp', {
        p_slug: slug,
        p_name: cleanGuestName,
        p_email: cleanGuestEmail,
        p_status: selectedStatus,
        p_message: message.trim() || null,
      });

      if (error) throw error;

      if (data?.deadline_passed) {
        const message = 'The RSVP deadline has passed, so responses are now closed.';
        setModalVisible(false);
        setDeadlineMessage(message);
        return Alert.alert('RSVP closed', message);
      }

      if (data?.error) throw new Error(data.error);

      if (!isSignedInMember) {
        await SecureStore.setItemAsync('pallinky_guest_email', cleanGuestEmail);
      }

      const pendingApproval = data?.pending_approval === true;

      setModalVisible(false);

      if (pendingApproval) {
        setHasPendingRequest(true);
      }

      router.push({
        pathname: `/event/${slug}/thanks` as any,
        params: {
          status: pendingApproval ? 'pending' : selectedStatus,
          theme: themeKey,
        },
      });
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Submission failed.');
    }
  };

  if (loading || !event) {
    return (
      <ActivityIndicator
        color={theme?.accent || SYSTEM.primary}
        style={{ flex: 1, backgroundColor: theme?.bg || SYSTEM.background }}
      />
    );
  }

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.bg }]}>
      <StatusBar barStyle={theme.isDark ? 'light-content' : 'dark-content'} />

      <View style={styles.headerContainer}>
        <TouchableOpacity
          style={[
            styles.backBtn,
            {
              backgroundColor: theme.isDark ? 'rgba(255,255,255,0.1)' : SYSTEM.surface,
              borderColor: theme.isDark ? 'rgba(255,255,255,0.12)' : SYSTEM.borderSoft,
            },
          ]}
          onPress={() => router.push(`/event/${slug}/details` as any)}
        >
          <Ionicons name="arrow-back" size={20} color={theme.text} />
          <Text style={[styles.backBtnText, { color: theme.text }, customFont]}>Event</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.container}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {event.cover_image_url ? (
          <View style={styles.imageWrapper}>
            <Image source={{ uri: event.cover_image_url }} style={styles.coverImage} />
          </View>
        ) : null}

        <View style={styles.content}>
          <Text style={[styles.title, { color: theme.text }, customFont]}>{event.title}</Text>
          <Text style={[styles.host, { color: theme.text, opacity: 0.7 }, customFont]}>
            Invited by {event.host_name}
          </Text>

          <View style={styles.infoBox}>
            <Text style={[styles.infoText, { color: theme.text }, customFont]}>
              {formatInEventTimeZone(
                event.starts_at,
                { weekday: 'long', month: 'short', day: 'numeric' },
                event
              )}
            </Text>

            {locationText ? (
              <TouchableOpacity onPress={openInMaps} style={styles.locationLink}>
                <Text style={[styles.infoText, { color: theme.accent, marginTop: 8 }, customFont]}>
                  📍 {locationText}
                </Text>
                <Text style={[styles.mapsHint, { color: theme.accent }]}>Open in Maps</Text>
              </TouchableOpacity>
            ) : null}

            <View style={{ marginTop: 15 }}>
              <CalendarButton event={event} theme={theme} />
            </View>
          </View>

          {deadlineMessage ? (
            <View style={styles.deadlineNotice}>
              <Text style={[styles.deadlineNoticeTitle, customFont]}>RSVP closed</Text>
              <Text style={styles.deadlineNoticeText}>{deadlineMessage}</Text>
            </View>
          ) : null}

          {displayDescription ? (
            <View style={styles.descriptionContainer}>
              <Text
                style={[styles.descriptionText, { color: theme.text, opacity: 0.9 }, customFont]}
              >
                {displayDescription}
              </Text>
            </View>
          ) : null}

          <View style={styles.btnStack}>
            {isPending ? (
              <View style={[styles.primaryBtn, { backgroundColor: theme.accent, opacity: 0.6 }]}>
                <Text style={[styles.primaryBtnText, { color: theme.bg }]}>Request Pending</Text>
              </View>
            ) : requiresApproval ? (
              <TouchableOpacity
                style={[styles.primaryBtn, { backgroundColor: theme.accent }]}
                onPress={() => {
                  setSelectedStatus('yes');
                  setModalVisible(true);
                }}
              >
                <Text style={[styles.primaryBtnText, { color: theme.bg }]}>Request to Join</Text>
              </TouchableOpacity>
            ) : existingStatus ? (
              <TouchableOpacity
                style={[styles.primaryBtn, { backgroundColor: theme.accent }]}
                onPress={() => setModalVisible(true)}
              >
                <Text style={[styles.primaryBtnText, { color: theme.bg }]}>Change RSVP</Text>
              </TouchableOpacity>
            ) : (
              <>
                <TouchableOpacity
                  style={[styles.primaryBtn, { backgroundColor: theme.accent }]}
                  onPress={() => {
                    setSelectedStatus('yes');
                    setModalVisible(true);
                  }}
                >
                  <Text style={[styles.primaryBtnText, { color: theme.bg }]}>I&apos;m Going</Text>
                </TouchableOpacity>

                <View style={styles.secondaryRow}>
                  <TouchableOpacity
                    style={[
                      styles.secondaryBtn,
                      {
                        borderColor: theme.accent,
                        backgroundColor: theme.isDark ? 'transparent' : SYSTEM.surface,
                      },
                    ]}
                    onPress={() => {
                      setSelectedStatus('maybe');
                      setModalVisible(true);
                    }}
                  >
                    <Text style={[styles.secondaryBtnText, { color: theme.accent }]}>Maybe</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.secondaryBtn,
                      {
                        borderColor: theme.accent,
                        backgroundColor: theme.isDark ? 'transparent' : SYSTEM.surface,
                      },
                    ]}
                    onPress={() => {
                      setSelectedStatus('no');
                      setModalVisible(true);
                    }}
                  >
                    <Text style={[styles.secondaryBtnText, { color: theme.accent }]}>No</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>

          <TouchableOpacity
            onPress={() => router.replace('/(tabs)/events')}
            style={{ alignItems: 'center', marginTop: 2, marginBottom: 12 }}
          >
            <Text
              style={{
                color: theme.text,
                opacity: 0.65,
                fontWeight: '600',
              }}
            >
              Skip for now
            </Text>
          </TouchableOpacity>

          <Text
            style={[
              styles.sectionTitle,
              {
                color: theme.text,
                borderBottomColor: theme.isDark ? `${theme.accent}40` : SYSTEM.border,
              },
              customFont,
            ]}
          >
            Guest List
          </Text>

          <View style={styles.guestList}>
            {guests.map((guest, i) => (
              <View
                key={i}
                style={[
                  styles.guestCard,
                  {
                    backgroundColor: badgeBg,
                    borderColor: theme.isDark ? 'rgba(255,255,255,0.10)' : SYSTEM.borderSoft,
                  },
                ]}
              >
                <Text style={[styles.statusIcon, { color: badgeText }]}>
                  {guest.status === 'yes' ? '✓' : guest.status === 'maybe' ? '?' : '✕'}
                </Text>
                <Text style={[styles.guestName, { color: badgeText }, customFont]}>
                  {guest.name?.split(' ')[0] || 'Guest'}
                </Text>
              </View>
            ))}
          </View>
        </View>

        <Modal visible={modalVisible} animationType="slide" transparent>
         <KeyboardAvoidingView
  style={{ flex: 1 }}
  behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
>
            <View style={styles.modalOverlay}>
              <View
                style={[
                  styles.modalContent,
                  {
                    backgroundColor: theme.bg,
                    borderTopColor: theme.isDark ? 'rgba(255,255,255,0.10)' : SYSTEM.border,
                  },
                ]}
              >
                <ScrollView
  showsVerticalScrollIndicator={false}
  keyboardShouldPersistTaps="handled"
  keyboardDismissMode="on-drag"
  contentContainerStyle={{ paddingBottom: 120 }}
>
                  <Text style={[styles.modalTitle, { color: theme.text }, customFont]}>
                    {requiresApproval ? 'Request to Join' : 'RSVP'}
                  </Text>

                  {!userEmail ? (
                    <>
                      <View style={styles.guestInfoBox}>
                        <Text style={[styles.guestInfoTitle, { color: theme.text }, customFont]}>
                          We don’t recognize you yet
                        </Text>
                        <Text style={[styles.guestInfoBody, { color: theme.text, opacity: 0.72 }]}>
                          Enter your details so we know who this RSVP belongs to.
                        </Text>
                      </View>

                      <TextInput
                        style={[
                          styles.input,
                          {
                            color: theme.text,
                            borderColor: theme.isDark ? `${theme.accent}33` : SYSTEM.border,
                            backgroundColor: theme.isDark
                              ? 'rgba(255,255,255,0.05)'
                              : SYSTEM.surface,
                          },
                          customFont,
                        ]}
                        placeholder="Full Name"
                        placeholderTextColor={theme.text + '50'}
                        value={guestName}
                        onChangeText={setGuestName}
                        returnKeyType="next"
                      />
                      <TextInput
                        style={[
                          styles.input,
                          {
                            color: theme.text,
                            borderColor: theme.isDark ? `${theme.accent}33` : SYSTEM.border,
                            backgroundColor: theme.isDark
                              ? 'rgba(255,255,255,0.05)'
                              : SYSTEM.surface,
                          },
                        ]}
                        placeholder="Email Address"
                        placeholderTextColor={theme.text + '50'}
                        value={guestEmail}
                        onChangeText={setGuestEmail}
                        keyboardType="email-address"
                        autoCapitalize="none"
                        returnKeyType="next"
                      />
                      <TextInput
                        style={[
                          styles.input,
                          {
                            color: theme.text,
                            borderColor: theme.isDark ? `${theme.accent}33` : SYSTEM.border,
                            backgroundColor: theme.isDark
                              ? 'rgba(255,255,255,0.05)'
                              : SYSTEM.surface,
                          },
                        ]}
                        placeholder="Confirm Email"
                        placeholderTextColor={theme.text + '50'}
                        value={confirmEmail}
                        onChangeText={setConfirmEmail}
                        keyboardType="email-address"
                        autoCapitalize="none"
                        returnKeyType="done"
                      />
                    </>
                  ) : (
                    <View style={styles.knownUserBox}>
                      <View style={styles.knownUserHeader}>
                        <View>
                          <Text style={[styles.knownUserText, { color: theme.text }, customFont]}>
                            {requiresApproval
                              ? `Requesting as ${guestName}`
                              : `Going as ${guestName}`}
                          </Text>
                          <Text style={[styles.knownUserSub, { color: theme.text, opacity: 0.6 }]}>
                            {userEmail}
                          </Text>
                        </View>

                        {!sessionEmail ? (
                          <TouchableOpacity onPress={handleSwitchUser}>
                            <Text style={[styles.notYouText, { color: theme.accent }]}>
                              Not you?
                            </Text>
                          </TouchableOpacity>
                        ) : null}
                      </View>
                    </View>
                  )}

                  {!requiresApproval ? (
                    <View style={styles.statusToggleRow}>
                      {(['yes', 'maybe', 'no'] as const).map((s) => (
                        <TouchableOpacity
                          key={s}
                          onPress={() => setSelectedStatus(s)}
                          style={[
                            styles.statusTab,
                            {
                              borderColor: theme.isDark ? `${theme.accent}33` : SYSTEM.border,
                              backgroundColor:
                                selectedStatus === s
                                  ? theme.accent
                                  : theme.isDark
                                    ? 'rgba(255,255,255,0.04)'
                                    : SYSTEM.surface,
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.statusTabText,
                              { color: selectedStatus === s ? theme.bg : theme.text },
                            ]}
                          >
                            {s.toUpperCase()}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  ) : null}

                  <TextInput
                    style={[
                      styles.input,
                      {
                        color: theme.text,
                        borderColor: theme.isDark ? `${theme.accent}33` : SYSTEM.border,
                        backgroundColor: theme.isDark ? 'rgba(255,255,255,0.05)' : SYSTEM.surface,
                        height: 80,
                      },
                    ]}
                    placeholder="Note for the host..."
                    placeholderTextColor={theme.text + '50'}
                    value={message}
                    onChangeText={setMessage}
                    multiline
                    textAlignVertical="top"
                  />

                  <TouchableOpacity
                    style={[styles.primaryBtn, { backgroundColor: theme.accent, marginTop: 10 }]}
                    onPress={submitRSVP}
                  >
                    <Text style={[styles.primaryBtnText, { color: theme.bg }]}>
                      {requiresApproval
                        ? 'Send Request'
                        : `Confirm ${selectedStatus?.toUpperCase() || ''}`.trim()}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => setModalVisible(false)}
                    style={styles.cancelWrap}
                  >
                    <Text style={{ color: theme.text, opacity: 0.6, fontWeight: '700' }}>
                      Cancel
                    </Text>
                  </TouchableOpacity>
                </ScrollView>
              </View>
            </View>
          </KeyboardAvoidingView>
        </Modal>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  headerContainer: {
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'android' ? 10 : 0,
    paddingBottom: 10,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  backBtnText: { fontSize: 14, fontWeight: '700' },
  container: { flex: 1 },
  imageWrapper: { width: '100%', paddingHorizontal: 20, marginTop: 5 },
  coverImage: { width: '100%', height: 220, borderRadius: 24 },
  content: { padding: 25, paddingTop: 15 },
  title: { fontSize: 34, fontWeight: '900', letterSpacing: -1, marginBottom: 4 },
  host: { fontSize: 18, marginBottom: 25 },
  infoBox: { marginBottom: 30 },
  infoText: { fontSize: 18, fontWeight: '600' },
  locationLink: { marginTop: 4, marginBottom: 5 },
  mapsHint: {
    fontSize: 11,
    opacity: 0.8,
    marginLeft: 24,
    fontWeight: '700',
  },
  descriptionContainer: { marginBottom: 35, padding: 5 },
  descriptionText: { fontSize: 17, lineHeight: 26 },
  deadlineNotice: {
    marginBottom: 24,
    padding: 16,
    borderRadius: 16,
    backgroundColor: 'rgba(193, 18, 31, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(193, 18, 31, 0.35)',
  },
  deadlineNoticeTitle: {
    color: '#c1121f',
    fontSize: 16,
    fontWeight: '900',
    marginBottom: 4,
  },
  deadlineNoticeText: {
    color: '#7f1d1d',
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
  },
  btnStack: { gap: 10, marginBottom: 50 },
  primaryBtn: {
    height: 60,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  primaryBtnText: { fontSize: 19, fontWeight: '800' },
  secondaryRow: { flexDirection: 'row', gap: 10 },
  secondaryBtn: {
    flex: 1,
    height: 55,
    borderRadius: 16,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  secondaryBtnText: { fontSize: 15, fontWeight: '700' },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 15,
    paddingBottom: 8,
    borderBottomWidth: 1,
  },
  guestList: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 40 },
  guestCard: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
  },
  statusIcon: { fontSize: 13, fontWeight: '900', marginRight: 6 },
  guestName: { fontSize: 14, fontWeight: '600' },
  modalKeyboardWrap: { flex: 1, justifyContent: 'flex-end' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'flex-end' },
  modalContent: {
    maxHeight: '88%',
    paddingHorizontal: 25,
    paddingTop: 25,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    borderTopWidth: 1,
  },
  modalScrollContent: {
    paddingBottom: 36,
  },
  modalTitle: { fontSize: 24, fontWeight: '900', marginBottom: 20 },
  guestInfoBox: {
    marginBottom: 16,
    padding: 14,
    borderRadius: 14,
    backgroundColor: 'rgba(106, 76, 147, 0.08)',
  },
  guestInfoTitle: {
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 4,
  },
  guestInfoBody: {
    fontSize: 14,
    lineHeight: 20,
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 15,
    marginBottom: 12,
    fontSize: 16,
  },
  knownUserBox: { marginBottom: 20, paddingHorizontal: 5 },
  knownUserHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  knownUserText: { fontSize: 18, fontWeight: '800' },
  knownUserSub: { fontSize: 14, marginTop: 2 },
  notYouText: {
    fontWeight: 'bold',
    fontSize: 12,
    textDecorationLine: 'underline',
  },
  statusToggleRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  statusTab: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusTabText: { fontSize: 12, fontWeight: 'bold' },
  cancelWrap: { marginTop: 25, alignItems: 'center' },
});