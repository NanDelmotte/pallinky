/**
 * Path: apps/mobile/app/create/success-vibe.tsx
 * Description: Success screen shown after a Vibe draft is created. Displays the
 * share hub, keeps share/invite actions soft-locked until the host verifies identity,
 * and leaves Design Studio always available via the manage handle.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
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
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

import { StyledText } from '@pallinky/ui';
import { buildInviteMessage, supabase, useHostGate, useSession } from '@pallinky/core';
import { useI18n } from '@pallinky/i18n/client';

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
  secondary: '#6A4C93',
  secondaryBg: '#efe9f7',
  danger: '#e63946',
};

type PendingAction = 'share' | 'circles' | 'native' | null;
const PENDING_CHAT_EVENT_THREAD_KEY = 'pallinky:pending_chat_event_thread';

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

export default function VibeSuccessScreen() {
  const {
    slug,
    title,
    default_message,
    manage_handle,
    email,
    visibility,
    invite_option,
    circleId,
  } = useLocalSearchParams<{
    slug: string;
    title: string;
    default_message?: string;
    manage_handle?: string;
    email?: string;
    visibility?: string;
    invite_option?: string;
    circleId?: string;
  }>();

  const visibilityMode = Number(visibility ?? 3);
  const isPublicEvent = visibilityMode === 3;
  const inviteOption =
    invite_option === 'direct' ||
    invite_option === 'circle' ||
    invite_option === 'friends_of_friends'
      ? invite_option
      : visibilityMode === 1
      ? 'direct'
      : 'circle';

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

  const [customMessage, setCustomMessage] = useState(
    default_message || buildInviteMessage({ title, link: shareLink })
  );

  const colors = [COLORS.primary, '#7aa340', COLORS.secondary, '#ffd700', '#ff7a59'];
  

  const qrImageUri = useMemo(() => {
    return `https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=12&data=${encodeURIComponent(
      shareLink
    )}`;
  }, [shareLink]);

  useEffect(() => {
    const timer = setTimeout(() => setShowConfetti(false), 5000);
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
      Share.share({ message: `${customMessage}\n${shareLink}` }).catch(() => {
        Alert.alert(t('create_success_share_error'), t('create_success_share_sheet_error'));
      });
    }

    setPendingAction(null);
    setIdentityVisible(false);
  }, [isHost, pendingAction, slug, title, circleId, customMessage, shareLink, t]);

  const requireHost = (action: PendingAction) => {
    if (isHost) {
      if (action === 'share') {
        router.push({
          pathname: '/circles/share-picker',
          params: { slug, title, circleId },
        });
      }

      if (action === 'circles') {
        router.push({
          pathname: '/circles/share-picker',
          params: { slug, title, circleId },
        });
      }

      return;
    }

    setPendingAction(action);
    setIdentityVisible(true);
  };

  const requireNativeShare = () => {
    if (isHost) {
      shareNative();
      return;
    }

    setPendingAction('native');
    setIdentityVisible(true);
  };

  const shareNative = async () => {
    try {
      await Share.share({ message: `${customMessage}\n${shareLink}` });
    } catch {
      Alert.alert(t('create_success_share_error'), t('create_success_share_sheet_error'));
    }
  };

  const selectedShareOption =
    inviteOption === 'direct'
      ? {
          icon: 'chatbubble-ellipses-outline' as const,
          title: t('invite_options_direct_title'),
          badge: t('invite_options_direct_badge'),
          body: t('invite_options_direct_body'),
          primaryLabel: t('create_success_share_link'),
          primaryAction: requireNativeShare,
          secondaryAction: () => requireHost('share'),
          primaryIcon: isHost ? ('share-outline' as const) : ('lock-closed' as const),
          secondaryIcon: isHost ? ('people' as const) : ('lock-closed' as const),
        }
      : inviteOption === 'friends_of_friends'
      ? {
          icon: 'git-network-outline' as const,
          title: t('invite_options_friends_title'),
          badge: t('invite_options_friends_badge'),
          body: t('invite_options_friends_body'),
          primaryLabel: t('create_success_share_link'),
          primaryAction: requireNativeShare,
          secondaryAction: () => requireHost('share'),
          primaryIcon: isHost ? ('share-outline' as const) : ('lock-closed' as const),
          secondaryIcon: isHost ? ('people' as const) : ('lock-closed' as const),
        }
      : {
          icon: 'people-outline' as const,
          title: t('invite_options_circle_title'),
          badge: t('invite_options_circle_badge'),
          body: t('invite_options_circle_body'),
          primaryLabel: t('create_success_share_pallinky_friends'),
          primaryAction: () => requireHost('share'),
          secondaryAction: requireNativeShare,
          primaryIcon: isHost ? ('people' as const) : ('lock-closed' as const),
          secondaryIcon: isHost ? ('share-outline' as const) : ('lock-closed' as const),
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
            <ConfettiPiece key={i} delay={i * 150} color={colors[i % colors.length]} />
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
                <MaterialCommunityIcons name="waves" size={50} color={COLORS.secondary} />
              </View>
              <StyledText style={styles.mainTitle}>Line Thrown!</StyledText>
            </View>

            <View style={styles.shareCard}>
                <StyledText style={styles.label}>{t('event_share')}</StyledText>

                <View style={styles.selectedShareCard}>
                  <View style={styles.selectedShareIcon}>
                    <Ionicons
                      name={selectedShareOption.icon}
                      size={22}
                      color={COLORS.primary}
                    />
                  </View>

                  <View style={styles.selectedShareText}>
                    <View style={styles.selectedShareHeader}>
                      <StyledText style={styles.selectedShareTitle}>
                        {selectedShareOption.title}
                      </StyledText>

                      <View style={styles.selectedShareBadge}>
                        <StyledText style={styles.selectedShareBadgeText}>
                          {selectedShareOption.badge}
                        </StyledText>
                      </View>
                    </View>

                    <StyledText style={styles.selectedShareBody}>
                      {selectedShareOption.body}
                    </StyledText>
                  </View>
                </View>

                <TextInput
                  style={styles.messageInput}
                  value={customMessage}
                  onChangeText={setCustomMessage}
                  multiline
                  placeholder={t('create_success_add_message')}
                  placeholderTextColor={COLORS.textMuted}
                />

                <View style={styles.buttonRow}>
                  <TouchableOpacity
                    style={styles.primaryBtn}
                    onPress={selectedShareOption.primaryAction}
                  >
                    <Ionicons
                      name={selectedShareOption.primaryIcon}
                      size={20}
                      color="#fff"
                    />
                    <StyledText style={styles.btnText}>
                      {selectedShareOption.primaryLabel}
                    </StyledText>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.nativeShareBtn}
                    onPress={selectedShareOption.secondaryAction}
                    accessibilityRole="button"
                    accessibilityLabel={t('create_success_share_native')}
                  >
                    <Ionicons
                      name={selectedShareOption.secondaryIcon}
                      size={22}
                      color={COLORS.primary}
                    />
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
        
{/*
            <TouchableOpacity style={styles.circlesCard} onPress={() => requireHost('circles')}>
              <View style={[styles.studioIcon, { backgroundColor: COLORS.secondary }]}>
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
                color={COLORS.secondary}
              />
            </TouchableOpacity>
*/}
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
          returnTo={`/create/success-vibe?slug=${encodeURIComponent(
            slug || ''
          )}&title=${encodeURIComponent(title || '')}&manage_handle=${encodeURIComponent(
            manage_handle || ''
          )}&email=${encodeURIComponent(email || '')}&visibility=${encodeURIComponent(
            visibility || ''
          )}&invite_option=${encodeURIComponent(inviteOption || '')}&circleId=${encodeURIComponent(
            circleId || ''
          )}`}
        />
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  confettiPiece: {
    position: 'absolute',
    width: 10,
    height: 10,
    zIndex: 1000,
    top: 0,
  },
  scrollContent: {
    padding: 24,
    paddingTop: 16,
    paddingBottom: 60,
  },
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
  header: {
    alignItems: 'center',
    marginBottom: 20,
  },
  iconCircle: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: '#e5daf1',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 15,
  },
  mainTitle: {
    fontSize: 32,
    fontWeight: '900',
    color: COLORS.text,
  },
  temptationCard: {
    width: '100%',
    marginBottom: 16,
    padding: 20,
    backgroundColor: COLORS.secondaryBg,
    borderRadius: 24,
    borderStyle: 'dashed',
    borderWidth: 2,
    borderColor: '#d9cdea',
  },
  temptationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 5,
  },
  temptationTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: COLORS.secondary,
  },
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
  studioContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  miniPreviewFiesta: {
    width: 40,
    height: 40,
    backgroundColor: COLORS.secondary,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  miniText: {
    color: '#fff',
    fontSize: 8,
    fontWeight: '900',
  },
  studioTextWrap: {
    flex: 1,
  },
  studioBtnTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.text,
  },
  shareCard: {
    backgroundColor: COLORS.surface,
    padding: 20,
    borderRadius: 24,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.borderSoft,
  },
  label: {
    fontSize: 11,
    fontWeight: '900',
    color: COLORS.textMuted,
    textTransform: 'uppercase',
    marginBottom: 10,
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
  messageInput: {
    backgroundColor: '#f9faf7',
    borderRadius: 12,
    padding: 15,
    fontSize: 15,
    color: COLORS.text,
    minHeight: 60,
    textAlignVertical: 'top',
    borderWidth: 1,
    borderColor: COLORS.borderSoft,
    marginBottom: 12,
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
  qrContent: {
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingBottom: 16,
  },
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
  buttonRow: {
    flexDirection: 'row',
    gap: 10,
  },
  primaryBtn: {
    flex: 1,
    backgroundColor: COLORS.primary,
    minHeight: 52,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  nativeShareBtn: {
    width: 52,
    height: 52,
    borderRadius: 15,
    borderWidth: 2,
    borderColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.surface,
  },
  btnText: {
    color: '#fff',
    flexShrink: 1,
    fontWeight: '800',
    fontSize: 15,
    lineHeight: 18,
    textAlign: 'center',
  },
  circlesCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    padding: 20,
    borderRadius: 24,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: COLORS.borderSoft,
  },
  studioIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  cardTextContent: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.text,
  },
  cardDesc: {
    fontSize: 13,
    color: COLORS.textMuted,
    marginTop: 2,
  },
});
