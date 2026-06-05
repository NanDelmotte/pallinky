/**
 * Path: apps/mobile/app/create/event-success.tsx
 * Description: Unified success screen shown after an event is created. Displays the
 * share hub, keeps share/invite actions soft-locked until the host verifies identity,
 * and leaves Design Studio always available via the manage handle.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Dimensions,
  Image,
  KeyboardAvoidingView,
  Platform,
  Share,
  ScrollView,
  StatusBar,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Clipboard from 'expo-clipboard';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { StyledText } from '@pallinky/ui';
import { useI18n } from '@pallinky/i18n/client';
import { buildInviteMessage, supabase, useHostGate, useSession } from '@pallinky/core';

import IdentityModal from '../../components/IdentityModal';

const { width, height } = Dimensions.get('window');

const COLORS = {
  background: '#F6F7F9',
  surface: '#FFFFFF',
  text: '#1f2a1b',
  textMuted: '#66715f',
  primary: '#43691b',
  border: '#bac9ad',
  borderSoft: '#e7ede2',
  danger: '#e63946',
  dangerBorder: '#ffd6d6',
  secondary: '#6A4C93',
  secondaryBg: '#efe9f7',
  pallinkyInvite: '#5F8428',
};

type PendingAction = 'share' | 'circles' | 'native' | null;
const PENDING_CHAT_EVENT_THREAD_KEY = 'pallinky:pending_chat_event_thread';

function getInviteLinkErrorMessage(error: unknown) {
  if (!error || typeof error !== 'object') return '';

  const message =
    'message' in error && typeof error.message === 'string'
      ? error.message
      : '';
  const details =
    'details' in error && typeof error.details === 'string'
      ? error.details
      : '';
  const code =
    'code' in error && typeof error.code === 'string'
      ? error.code
      : '';

  return [message, details, code].filter(Boolean).join('\n');
}

const ConfettiPiece = ({ delay, color }: { delay: number; color: string }) => {
  const fallAnim = useRef(new Animated.Value(-20)).current;
  const horizontalAnim = useRef(new Animated.Value(Math.random() * width)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.delay(delay),
      Animated.timing(fallAnim, {
        toValue: height + 50,
        duration: 2500 + Math.random() * 1000,
        useNativeDriver: true,
      }),
    ]).start();
  }, [delay, fallAnim]);

  return (
    <Animated.View
      style={[
        styles.confettiPiece,
        {
          backgroundColor: color,
          transform: [
            { translateY: fallAnim },
            { translateX: horizontalAnim },
            { rotate: '45deg' },
          ],
        },
      ]}
    />
  );
};

export default function EventSuccessScreen() {
  const {
    slug,
    manage_handle,
    title,
    email,
    visibility,
    visible_in_feed,
    requires_approval,
    circleId,
  } = useLocalSearchParams<{
    slug: string;
    manage_handle?: string;
    title?: string;
    email?: string;
    visibility?: string;
    visible_in_feed?: string;
    requires_approval?: string;
    circleId?: string;
  }>();

  const visibilityMode = Number(visibility ?? 2);
  const isPublicEvent = visibilityMode === 3;

  const { isHost } = useHostGate(slug);
  const { session } = useSession();
  const { t } = useI18n();

  const [showConfetti, setShowConfetti] = useState(true);
  const [identityVisible, setIdentityVisible] = useState(false);
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [qrExpanded, setQrExpanded] = useState(false);
  const [pendingChatThreadId, setPendingChatThreadId] = useState<string | null>(null);
  const [chatAttachReady, setChatAttachReady] = useState(false);
  const shareLink = useMemo(() => `https://pallinky.com/event/${slug}`, [slug]);

  const colors = [COLORS.primary, '#7aa340', COLORS.secondary, '#ffd700', '#ff7a59'];

  const qrImageUri = useMemo(() => {
    return `https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=12&data=${encodeURIComponent(
      shareLink
    )}`;
  }, [shareLink]);

  const shareNative = useCallback(async () => {
    let groupLink = shareLink;

    try {
      const { data, error } = await supabase.rpc('create_external_event_invite', {
        p_slug: slug,
        p_invitee_name: null,
        p_link_mode: 'multi',
      });

      if (error) throw error;

      const inviteRow = Array.isArray(data) ? data[0] : data;
      groupLink = inviteRow?.invite_url || shareLink;
    } catch (err) {
      console.error('Failed to create external event invite link', err);
      const detail = getInviteLinkErrorMessage(err);
      Alert.alert(
        t('create_success_share_error'),
        detail || t('create_success_share_sheet_error')
      );
      return;
    }

    try {
      const message = buildInviteMessage({ title, link: groupLink });
      await Share.share({ message });
    } catch (err) {
      console.error('Failed to open native share sheet', err);

      try {
        await Clipboard.setStringAsync(groupLink);
        Alert.alert(t('create_success_link_copied'), t('create_success_link_copied_body'));
      } catch (copyErr) {
        console.error('Failed to copy invite link after share sheet error', copyErr);
        Alert.alert(t('create_success_share_error'), t('create_success_share_sheet_error'));
      }
    }
  }, [shareLink, slug, t, title]);

  useEffect(() => {
    const timer = setTimeout(() => setShowConfetti(false), 4000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    AsyncStorage.getItem(PENDING_CHAT_EVENT_THREAD_KEY)
      .then((raw) => {
        if (!raw) return;
        const parsed = JSON.parse(raw);
        const nextThreadId = typeof parsed?.threadId === 'string' ? parsed.threadId : '';
        if (nextThreadId) setPendingChatThreadId(nextThreadId);
      })
      .catch((err) => {
        console.error('Failed to load pending chat thread', err);
      });
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function attachIfNeeded() {
      const viewerEmail = session?.user?.email?.toLowerCase().trim() || '';
      if (!slug || !viewerEmail || chatAttachReady) return;

      try {
        const { data: eventData, error: eventError } = await supabase
          .from('events')
          .select('id, slug')
          .eq('slug', slug)
          .single();

        if (eventError) throw eventError;
        if (!eventData?.id) throw new Error('Event not found');

        if (pendingChatThreadId) {
          const { error: attachError } = await supabase.rpc('attach_event_to_chat_thread', {
            p_thread_id: pendingChatThreadId,
            p_event_id: eventData.id,
            p_attached_by_email: viewerEmail,
          });

          if (attachError) throw attachError;
        } else {
          const { error: threadError } = await supabase.rpc('get_or_create_event_primary_chat_thread', {
            p_event_id: eventData.id,
            p_user_email: viewerEmail,
          });

          if (threadError) throw threadError;
        }

        if (cancelled) return;

        setChatAttachReady(true);
        if (pendingChatThreadId) {
          await AsyncStorage.removeItem(PENDING_CHAT_EVENT_THREAD_KEY);
        }
      } catch (err) {
        console.error(
          pendingChatThreadId
            ? 'Failed to attach new event to chat thread'
            : 'Failed to initialize event chat thread',
          err
        );
      }
    }

    void attachIfNeeded();

    return () => {
      cancelled = true;
    };
  }, [chatAttachReady, pendingChatThreadId, session?.user?.email, slug]);

  useEffect(() => {
    if (!isHost || !pendingAction) return;

    if (pendingAction === 'share') {
      router.push({
        pathname: '/circles/share-picker',
        params: { slug, title, circleId },
      });
    }

    if (pendingAction === 'circles') {
      router.push({
        pathname: '/circles/share-picker',
        params: { slug, title, circleId },
      });
    }

    if (pendingAction === 'native') {
      void shareNative();
    }

    setPendingAction(null);
    setIdentityVisible(false);
  }, [isHost, pendingAction, slug, title, circleId, shareNative]);

  const requireNativeShare = () => {
    if (isHost) {
      void shareNative();
      return;
    }

    setPendingAction('native');
    setIdentityVisible(true);
  };

  const handleStudioNav = () => {
    if (!manage_handle) {
      Alert.alert(t('create_success_missing_link'), t('create_success_missing_manage_handle'));
      return;
    }

    router.push(`/m/${manage_handle}/studio` as any);
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false, gestureEnabled: false }} />

      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" />

        {showConfetti &&
          colors.map((color, i) => (
            <ConfettiPiece key={i} delay={i * 100} color={colors[i % colors.length]} />
          ))}

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.flex}
        >
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <TouchableOpacity
              style={styles.backBtn}
              onPress={() =>
                pendingChatThreadId && chatAttachReady
                  ? router.replace({
                      pathname: '/chat/[threadId]',
                      params: { threadId: pendingChatThreadId, eventSlug: slug },
                    } as any)
                  : router.replace(`/event/${slug}/details`)
              }
              accessibilityRole="button"
              accessibilityLabel={t('create_success_back_event')}
            >
              <Ionicons name="arrow-back" size={24} color={COLORS.text} />
            </TouchableOpacity>

            <View style={styles.header}>
              <View style={styles.iconCircle}>
                <Ionicons name="checkmark-circle" size={60} color={COLORS.primary} />
              </View>
              <StyledText style={styles.title}>{t('create_success_title')}</StyledText>
            </View>

{/*
            <TouchableOpacity style={styles.circlesCard} onPress={() => requireHost('circles')}>
              <View style={styles.circlesIcon}>
                <Ionicons name="people" size={24} color="#fff" />
              </View>

              <View style={styles.cardTextContent}>
                <StyledText style={styles.cardTitle}>Invite People</StyledText>
                <StyledText style={styles.cardDesc}>
                  Select Pallinky friends or upload contacts.
                </StyledText>
              </View>

              <Ionicons
                name={isHost ? 'chevron-forward' : 'lock-closed'}
                size={20}
                color={COLORS.primary}
              />
            </TouchableOpacity>
*/}
            
            <View style={styles.card}>
              <StyledText style={styles.label}>{t('event_share')}</StyledText>

              <View style={styles.buttonRow}>
                {/*
                <TouchableOpacity
                  style={styles.pallinkyShareBtn}
                  onPress={() => requireHost('share')}
                  accessibilityRole="button"
                  accessibilityLabel={t('create_success_share_pallinky_friends')}
                >
                  <Ionicons
                    name={isHost ? 'people' : 'lock-closed'}
                    size={24}
                    color="#fff"
                  />
                  <View style={styles.shareActionText}>
                    <StyledText style={styles.btnText}>
                      {t('create_success_share_pallinky_invite')}
                    </StyledText>
                    <StyledText style={styles.btnSubText}>
                      {t('create_success_share_inside_pallinky')}
                    </StyledText>
                  </View>
                </TouchableOpacity>
                */}

                <TouchableOpacity
                  style={styles.shareBtn}
                  onPress={requireNativeShare}
                >
                  <Ionicons
                    name={isHost ? 'share-outline' : 'lock-closed'}
                    size={24}
                    color={COLORS.primary}
                  />
                  <View style={styles.shareActionText}>
                    <StyledText style={[styles.btnText, styles.externalBtnText]}>
                      {t('create_success_share_link')}
                    </StyledText>
                    {/*
                    <StyledText style={[styles.btnSubText, styles.externalBtnSubText]}>
                      {t('create_success_share_outside_pallinky')}
                    </StyledText>
                    */}
                  </View>
                </TouchableOpacity>
              </View>

              {isPublicEvent ? (
                <View style={styles.qrDisclosure}>
                  <TouchableOpacity
                    style={styles.qrToggle}
                    onPress={() => setQrExpanded((current) => !current)}
                  >
                    <StyledText style={styles.qrTitle}>
                      {qrExpanded ? t('create_success_hide_qr') : t('create_success_show_qr')}
                    </StyledText>
                    <Ionicons
                      name={qrExpanded ? 'chevron-up' : 'chevron-down'}
                      size={20}
                      color={COLORS.primary}
                    />
                  </TouchableOpacity>

                  {qrExpanded ? (
                    <View style={styles.qrContent}>
                      <Image source={{ uri: qrImageUri }} style={styles.qrImage} />
                      <StyledText style={styles.qrSub}>{t('create_success_qr_body')}</StyledText>
                    </View>
                  ) : null}
                </View>
              ) : null}
            </View>

            <View style={styles.temptationCard}>
              <View style={styles.temptationHeader}>
                <Ionicons name="sparkles" size={18} color={COLORS.secondary} />
                <StyledText style={styles.temptationTitle}>{t('create_success_make_pop')}</StyledText>
              </View>

              <StyledText style={styles.temptationSub}>
                {t('create_success_make_pop_body')}
              </StyledText>

              <TouchableOpacity style={styles.studioBtn} onPress={handleStudioNav}>
                <View style={styles.studioContent}>
                  <View style={styles.miniPreviewFiesta}>
                    <StyledText style={styles.miniText}>Fiesta!</StyledText>
                  </View>
                  <View style={styles.studioTextWrap}>
                    <StyledText style={styles.studioBtnTitle}>{t('create_success_open_studio')}</StyledText>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={COLORS.secondary} />
                </View>
              </TouchableOpacity>
            </View>

          </ScrollView>
        </KeyboardAvoidingView>

        <IdentityModal
          visible={identityVisible}
          onClose={() => {
            setIdentityVisible(false);
            setPendingAction(null);
          }}
          initialEmail={typeof email === 'string' ? email : ''}
          returnTo={`/create/event-success?slug=${encodeURIComponent(
            slug || ''
          )}&title=${encodeURIComponent(title || '')}&manage_handle=${encodeURIComponent(
            manage_handle || ''
          )}&email=${encodeURIComponent(email || '')}&visibility=${encodeURIComponent(
            visibility || ''
          )}&visible_in_feed=${encodeURIComponent(
            visible_in_feed || ''
          )}&requires_approval=${encodeURIComponent(
            requires_approval || ''
          )}&circleId=${encodeURIComponent(
            circleId || ''
          )}`}
        />

      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flex: 1, backgroundColor: COLORS.background },
  confettiPiece: { position: 'absolute', width: 8, height: 8, zIndex: 100, top: 0 },
  scrollContent: { padding: 25, paddingTop: 16, paddingBottom: 60, alignItems: 'center' },

  backBtn: {
    alignSelf: 'flex-start',
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.borderSoft,
    marginBottom: 10,
  },

  header: { alignItems: 'center', marginBottom: 18 },
  iconCircle: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.borderSoft,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: { fontSize: 28, fontWeight: '900', color: COLORS.text },

  card: {
    backgroundColor: COLORS.surface,
    width: '100%',
    padding: 20,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: COLORS.borderSoft,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
    marginBottom: 20,
  },

  label: {
    fontSize: 11,
    fontWeight: '900',
    color: COLORS.textMuted,
    textTransform: 'uppercase',
    marginBottom: 12,
  },

  selectedShareCard: {
    flexDirection: 'row',
    backgroundColor: '#f9faf7',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.borderSoft,
    padding: 12,
    marginBottom: 14,
  },

  selectedShareIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#EEF4E9',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 11,
  },

  selectedShareText: {
    flex: 1,
  },

  selectedShareHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 4,
  },

  selectedShareTitle: {
    fontSize: 17,
    lineHeight: 21,
    fontWeight: '900',
    color: COLORS.text,
  },

  selectedShareBadge: {
    borderRadius: 999,
    backgroundColor: '#EEF4E9',
    paddingHorizontal: 9,
    paddingVertical: 4,
  },

  selectedShareBadgeText: {
    fontSize: 11,
    fontWeight: '900',
    color: COLORS.primary,
  },

  selectedShareBody: {
    fontSize: 13,
    lineHeight: 18,
    color: COLORS.textMuted,
  },

  previewBox: {
    backgroundColor: '#f9faf7',
    borderRadius: 12,
    padding: 15,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: COLORS.borderSoft,
  },

  messageInput: {
    fontSize: 16,
    color: COLORS.text,
    minHeight: 40,
    textAlignVertical: 'top',
  },

  qrDisclosure: {
    backgroundColor: '#f9faf7',
    borderRadius: 16,
    marginTop: 14,
    borderWidth: 1,
    borderColor: COLORS.borderSoft,
  },

  qrToggle: {
    minHeight: 50,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  qrContent: { alignItems: 'center', paddingHorizontal: 12, paddingBottom: 16 },

  qrImage: {
    width: 180,
    height: 180,
    borderRadius: 12,
    marginBottom: 12,
    backgroundColor: COLORS.surface,
  },

  qrTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.text,
    textAlign: 'center',
  },

  qrSub: {
    fontSize: 12,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 17,
  },

  buttonRow: { flexDirection: 'row', gap: 10 },

  pallinkyShareBtn: {
    flex: 1,
    backgroundColor: COLORS.pallinkyInvite,
    minHeight: 82,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 14,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },

  shareBtn: {
    flex: 1,
    minHeight: 82,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.surface,
    gap: 7,
  },

  shareActionText: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },

  btnText: {
    color: '#fff',
    flexShrink: 1,
    fontWeight: '800',
    fontSize: 14,
    lineHeight: 18,
    textAlign: 'center',
  },

  externalBtnText: {
    color: COLORS.primary,
  },

  btnSubText: {
    color: 'rgba(255,255,255,0.82)',
    flexShrink: 1,
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '700',
    textAlign: 'center',
  },

  externalBtnSubText: {
    color: COLORS.textMuted,
  },

  guestPreviewLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    marginTop: 15,
  },

  guestPreviewText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textMuted,
    textDecorationLine: 'underline',
  },

  circlesCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.borderSoft,
    width: '100%',
    padding: 20,
    borderRadius: 24,
    marginBottom: 20,
  },

  circlesIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },

  cardTextContent: { flex: 1 },
  cardTitle: { fontSize: 18, fontWeight: '800', color: COLORS.text },
  cardDesc: { fontSize: 13, color: COLORS.textMuted, marginTop: 2 },

  temptationCard: {
    width: '100%',
    padding: 20,
    backgroundColor: COLORS.secondaryBg,
    borderRadius: 24,
    borderStyle: 'dashed',
    borderWidth: 2,
    borderColor: '#d9cdea',
    marginBottom: 20,
  },

  temptationHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 5 },
  temptationTitle: { fontSize: 16, fontWeight: '900', color: COLORS.secondary },

  temptationSub: {
    fontSize: 13,
    color: COLORS.text,
    opacity: 0.75,
    marginBottom: 15,
    lineHeight: 18,
  },

  studioBtn: {
    backgroundColor: COLORS.surface,
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e5daf1',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 1,
  },

  studioContent: { flexDirection: 'row', alignItems: 'center', gap: 12 },

  miniPreviewFiesta: {
    width: 40,
    height: 40,
    backgroundColor: COLORS.secondary,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },

  miniText: { color: '#fff', fontSize: 8, fontWeight: '900' },

  studioTextWrap: { flex: 1 },
  studioBtnTitle: { fontSize: 15, fontWeight: '800', color: COLORS.text },

});
