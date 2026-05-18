/**
 * Path: apps/mobile/app/m/[token]/studio/index.tsx
 * Description: Design Studio for event theming. Theme is now the first step,
 * using existing palettes as themes. Selecting a theme can also seed default
 * font, cover image, and thank-you GIF when those values are empty.
 */
import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  Platform,
  Alert,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';

import { supabase } from '@pallinky/core';
import { useI18n } from '@pallinky/i18n/client';
import {
  StyledText,
  GiphyPicker,
  StudioPreview,
  ImageSearchModal,
} from '@pallinky/ui';

const THEMES: Record<
  string,
  { bg: string; accent: string; text: string; isDark: boolean; label: string }
> = {
  zen: { bg: '#F6F7F9', accent: '#43691b', text: '#1f2a1b', isDark: false, label: 'Zen' },
  girly: { bg: '#f4bbd3', accent: '#fe5d9f', text: '#2b1f24', isDark: false, label: 'Girly' },
  fiesta: { bg: '#1729ae', accent: '#fe20e8', text: '#ffffff', isDark: true, label: 'Fiesta' },
  classy: { bg: '#03172f', accent: '#efd466', text: '#fff7b6', isDark: true, label: 'Classy' },
  spicy: { bg: '#656c12', accent: '#ecc216', text: '#ffffff', isDark: true, label: 'Spicy' },
  submerged: { bg: '#F6F7F9', accent: '#6A4C93', text: '#1f2a1b', isDark: false, label: 'Submerged' },
};

const FONTS = [
  {
    id: 'Sans',
    family: Platform.OS === 'ios' ? 'Arial-BoldMT' : 'sans-serif-condensed',
    sample: 'Sunday Roast',
  },
  {
    id: 'Serif',
    family: Platform.OS === 'ios' ? 'Times New Roman' : 'serif',
    sample: 'Dinner at 8',
  },
  {
    id: 'Cursive',
    family: Platform.OS === 'ios' ? 'SnellRoundhand-Bold' : 'cursive',
    sample: 'Poetry Night',
  },
  {
    id: 'Gothic',
    family: Platform.OS === 'ios' ? 'Copperplate-Bold' : 'monospace',
    sample: 'Fiesta',
  },
];

const THEME_DEFAULTS: Record<
  string,
  { font: string; coverImageUrl: string; thanksGifUrl: string }
> = {
  zen: {
    font: 'Sans',
    coverImageUrl:
      'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1400&q=80',
    thanksGifUrl:
      'https://media.giphy.com/media/3o7TKtnuHOHHUjR38Y/giphy.gif',
  },
  girly: {
    font: 'Cursive',
    coverImageUrl:
      'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=1400&q=80',
    thanksGifUrl:
      'https://media.giphy.com/media/l0MYt5jPR6QX5pnqM/giphy.gif',
  },
  fiesta: {
    font: 'Gothic',
    coverImageUrl:
      'https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?auto=format&fit=crop&w=1400&q=80',
    thanksGifUrl:
      'https://media.giphy.com/media/26ufdipQqU2lhNA4g/giphy.gif',
  },
  classy: {
    font: 'Serif',
    coverImageUrl:
      'https://images.unsplash.com/photo-1464366400600-7168b8af9bc3?auto=format&fit=crop&w=1400&q=80',
    thanksGifUrl:
      'https://media.giphy.com/media/89x4osEodHEoo/giphy.gif',
  },
  spicy: {
    font: 'Sans',
    coverImageUrl:
      'https://images.unsplash.com/photo-1530103862676-de8c9debad1d?auto=format&fit=crop&w=1400&q=80',
    thanksGifUrl:
      'https://media.giphy.com/media/xUPGcguWZHRC2HyBRS/giphy.gif',
  },
  submerged: {
    font: 'Sans',
    coverImageUrl:
      'https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?auto=format&fit=crop&w=1400&q=80',
    thanksGifUrl:
      'https://media.giphy.com/media/26BRv0ThflsHCqDrG/giphy.gif',
  },
};

type StudioState = {
  theme: string;
  font: string;
  coverImageUrl: string;
  thanksGifUrl: string;
};

const THUMB_ORDER = ['zen', 'girly', 'fiesta', 'classy', 'spicy', 'submerged'] as const;
const DEFAULT_COVER_IMAGE_URLS = new Set(
  Object.values(THEME_DEFAULTS).map((defaults) => defaults.coverImageUrl)
);

export default function DesignStudioScreen() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const router = useRouter();
  const { t } = useI18n();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [showGiphy, setShowGiphy] = useState(false);
  const [event, setEvent] = useState<any>(null);
  const [step, setStep] = useState<1 | 2>(1);
  const [showSearch, setShowSearch] = useState(false);
  const [previewTab, setPreviewTab] = useState<'event' | 'thanks'>('event');

  const [studioState, setStudioState] = useState<StudioState>({
    theme: 'zen',
    font: 'Sans',
    coverImageUrl: '',
    thanksGifUrl: '',
  });

  const [initialStudioState, setInitialStudioState] = useState<StudioState>({
    theme: 'zen',
    font: 'Sans',
    coverImageUrl: '',
    thanksGifUrl: '',
  });

  useEffect(() => {
    async function getEventData() {
      try {
        if (!token) {
          setLoading(false);
          return;
        }

        const { data: ev, error } = await supabase.rpc('get_event_by_manage_token', {
          p_manage_token: token,
        });

        if (error) throw error;

        if (ev?.[0]) {
          const e = ev[0];
          setEvent(e);

          const nextState: StudioState = {
            theme: e.gif_key && THEMES[e.gif_key] ? e.gif_key : 'zen',
            font: e.font_family || 'Sans',
            coverImageUrl: e.cover_image_url || '',
            thanksGifUrl: e.thanks_gif_url || '',
          };

          setStudioState(nextState);
          setInitialStudioState(nextState);
        }
      } catch {
        Alert.alert(t('common_error'), t('studio_load_error'));
      } finally {
        setLoading(false);
      }
    }

    void getEventData();
  }, [token]);

  const hasChanges = useMemo(
    () => JSON.stringify(studioState) !== JSON.stringify(initialStudioState),
    [studioState, initialStudioState]
  );

  const theme = THEMES[studioState.theme] || THEMES.zen;
  const fontStyle = {
    fontFamily: FONTS.find((f) => f.id === studioState.font)?.family || 'System',
  };

  const persistStudioState = async (nextState: StudioState) => {
    if (!token) return;

    setSaving(true);

    try {
      const { error } = await supabase.rpc('update_event_studio_by_manage_token', {
        p_manage_token: token,
        p_gif_key: nextState.theme,
        p_cover_image_url: nextState.coverImageUrl || null,
        p_font_family: nextState.font,
        p_thanks_gif_url: nextState.thanksGifUrl || null,
      });

      if (error) throw error;

      setInitialStudioState(nextState);
      setEvent((prev: any) =>
        prev
          ? {
              ...prev,
              gif_key: nextState.theme,
              cover_image_url: nextState.coverImageUrl || null,
              font_family: nextState.font,
              thanks_gif_url: nextState.thanksGifUrl || null,
            }
          : prev
      );
    } catch (error) {
      console.error('Studio autosave failed', error);
      Alert.alert(t('studio_save_failed'), t('studio_save_failed_body'));
    } finally {
      setSaving(false);
    }
  };

  const updateStudioState = (patch: Partial<StudioState>) => {
    setStudioState((prev) => {
      const next = { ...prev, ...patch };
      void persistStudioState(next);
      return next;
    });
  };

  const selectTheme = (themeKey: string) => {
    const defaults = THEME_DEFAULTS[themeKey] || THEME_DEFAULTS.zen;

    updateStudioState({
      theme: themeKey,
      font: studioState.font || defaults.font,
      coverImageUrl:
        !studioState.coverImageUrl || DEFAULT_COVER_IMAGE_URLS.has(studioState.coverImageUrl)
          ? defaults.coverImageUrl
          : studioState.coverImageUrl,
      thanksGifUrl: studioState.thanksGifUrl || defaults.thanksGifUrl,
    });

    setStep(2);
  };

  const handleDismiss = () => {
    if (!hasChanges) {
      router.back();
      return;
    }

    Alert.alert(t('studio_discard_title'), t('studio_discard_body'), [
      { text: t('common_keep_editing'), style: 'cancel' },
      { text: t('common_discard'), style: 'destructive', onPress: () => router.back() },
    ]);
  };

  const handleImageUpload = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permission.granted) {
        Alert.alert(t('studio_permission_title'), t('studio_permission_body'));
        return;
      }

      setUploadingCover(true);

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [16, 9],
        quality: 0.7,
      });

      const asset = result.assets?.[0];

      if (result.canceled || !asset?.uri) {
        return;
      }

      const contentType = asset.mimeType || 'image/jpeg';
      const extension = contentType.includes('png') ? 'png' : 'jpg';
      const safeManageToken = String(token || 'event').replace(/[^a-zA-Z0-9_-]/g, '_');
      const fileName = `${safeManageToken}/cover_${Date.now()}.${extension}`;
      const response = await fetch(asset.uri);
      const arrayBuffer = await response.arrayBuffer();

      const { error } = await supabase.storage
        .from('covers')
        .upload(fileName, arrayBuffer, {
          contentType,
          upsert: false,
        });

      if (error) throw error;

      const {
        data: { publicUrl },
      } = supabase.storage.from('covers').getPublicUrl(fileName);

      updateStudioState({ coverImageUrl: publicUrl });
    } catch (error) {
      console.error('Cover upload failed', error);
      Alert.alert(t('studio_upload_failed'), t('studio_upload_failed_body'));
    } finally {
      setUploadingCover(false);
    }
  };

  const resetChanges = () => {
    updateStudioState(initialStudioState);
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#43691b" />
      </View>
    );
  }

  if (!event) {
    return (
      <View style={styles.centered}>
        <StyledText>{t('manage_event_not_found')}</StyledText>
        <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 20 }}>
          <StyledText style={{ color: '#43691b' }}>{t('common_close')}</StyledText>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <GiphyPicker
        visible={showGiphy}
        onClose={() => setShowGiphy(false)}
        onSelect={(url: string) => {
          updateStudioState({ thanksGifUrl: url });
          setShowGiphy(false);
        }}
      />

      <ImageSearchModal
        visible={showSearch}
        initialQuery={event?.title || ''}
        onClose={() => setShowSearch(false)}
        onSelect={(url: string) => {
          updateStudioState({ coverImageUrl: url });
          setShowSearch(false);
        }}
      />

      <View style={styles.headerNav}>
        <TouchableOpacity onPress={step === 1 ? handleDismiss : () => setStep(1)}>
          <Ionicons
            name={step === 1 ? 'close' : 'arrow-back'}
            size={26}
            color="#1a1a1a"
          />
        </TouchableOpacity>

        <StyledText style={styles.headerTitle}>{t('studio_title')}</StyledText>

        <View style={styles.headerStatusSlot}>
          {saving ? <ActivityIndicator size="small" color="#43691b" /> : null}
        </View>
      </View>

      {step === 1 ? (
        <View style={styles.stepOneCenterWrap}>
          <View style={styles.stepOneContainer}>
            <StyledText style={styles.stepOneTitle}>{t('studio_color_scheme')}</StyledText>
            <StyledText style={styles.stepOneSubtitle}>
              {t('studio_palette_subtitle')}
            </StyledText>

            <View style={styles.themeGrid}>
              {THUMB_ORDER.map((key) => {
                const item = THEMES[key];
                const isSelected = studioState.theme === key;
                const thumbImage = THEME_DEFAULTS[key].coverImageUrl;

                return (
                  <TouchableOpacity
                    key={key}
                    style={[styles.themeCard, isSelected && styles.themeCardSelected]}
                    activeOpacity={0.9}
                    onPress={() => selectTheme(key)}
                  >
                    <Image source={{ uri: thumbImage }} style={styles.themeThumb} />
                    <View style={styles.thumbOverlay} />

                    {isSelected ? (
                      <View style={styles.selectedPill}>
                        <Ionicons name="checkmark" size={14} color="#fff" />
                      </View>
                    ) : null}

                    <View
                      style={[
                        styles.themeInfoPanel,
                        { backgroundColor: item.bg, borderTopColor: item.accent },
                      ]}
                    >
                      <StyledText style={[styles.themeLabel, { color: item.text }]}>
                        {item.label}
                      </StyledText>
                      <View style={styles.themePaletteRow}>
                        {[item.bg, item.accent, item.text].map((color) => (
                          <View
                            key={`${key}-${color}`}
                            style={[styles.themePaletteChip, { backgroundColor: color }]}
                          />
                        ))}
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </View>
      ) : (
        <View style={styles.stepTwoWrap}>
          <View style={styles.controlsPanel}>
            {previewTab === 'event' ? (
              <>
                <View style={styles.controlRowGroup}>
                  <TouchableOpacity style={styles.controlRow} onPress={() => setShowSearch(true)}>
                    <Ionicons name="search-outline" size={20} color="#6b7280" />
                    <StyledText style={styles.controlText}>{t('studio_search_cover')}</StyledText>
                    <StyledText style={styles.controlValue}>{t('studio_search')}</StyledText>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.controlRow}
                    onPress={handleImageUpload}
                    disabled={uploadingCover}
                  >
                    <Ionicons name="cloud-upload-outline" size={20} color="#6b7280" />
                    <StyledText style={styles.controlText}>
                      {uploadingCover ? t('studio_uploading_image') : t('studio_upload_image')}
                    </StyledText>
                  </TouchableOpacity>
                </View>

                <TouchableOpacity
                  style={styles.controlRow}
                  onPress={() => {
                    const currentIndex = FONTS.findIndex((f) => f.id === studioState.font);
                    const nextIndex = currentIndex >= 0 ? (currentIndex + 1) % FONTS.length : 0;
                    updateStudioState({ font: FONTS[nextIndex].id });
                  }}
                >
                  <Ionicons name="text-outline" size={20} color="#6b7280" />
                  <StyledText style={styles.controlText}>{t('studio_font')}</StyledText>
                  <StyledText style={styles.controlValue}>{studioState.font}</StyledText>
                </TouchableOpacity>
              </>
            ) : (
              <TouchableOpacity style={styles.controlRow} onPress={() => setShowGiphy(true)}>
                <Ionicons name="happy-outline" size={20} color="#6b7280" />
                <StyledText style={styles.controlText}>{t('studio_giphy')}</StyledText>
              </TouchableOpacity>
            )}

            {hasChanges ? (
              <TouchableOpacity style={styles.revertBtn} onPress={resetChanges}>
                <StyledText style={styles.revertText}>{t('studio_revert')}</StyledText>
              </TouchableOpacity>
            ) : null}
          </View>

          <StudioPreview
            theme={theme}
            fontStyle={fontStyle}
            event={event}
            coverImageUrl={studioState.coverImageUrl}
            thanksGifUrl={studioState.thanksGifUrl}
            activeTab={previewTab}
            onTabChange={setPreviewTab}
          />
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#f3f4f6' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  headerNav: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 14,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111827',
  },
  headerStatusSlot: {
    width: 28,
    alignItems: 'flex-end',
  },

  stepOneCenterWrap: {
    flex: 1,
    justifyContent: 'flex-start',
    paddingHorizontal: 20,
    paddingTop: 28,
    paddingBottom: 24,
  },
  stepOneContainer: {
    width: '100%',
    alignSelf: 'center',
    maxWidth: 520,
  },
  stepOneTitle: {
    fontSize: 26,
    fontWeight: '900',
    color: '#111827',
    marginBottom: 6,
  },
  stepOneSubtitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6b7280',
    lineHeight: 20,
    marginBottom: 18,
  },

  controlRowGroup: {
    gap: 0,
  },
  themeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 18,
    marginBottom: 22,
  },
  themeCard: {
    width: '48%',
    aspectRatio: 0.92,
    borderRadius: 22,
    overflow: 'hidden',
    backgroundColor: '#ddd',
    position: 'relative',
    borderWidth: 3,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOpacity: 0.14,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  themeCardSelected: {
    borderColor: '#111827',
    transform: [{ scale: 1.02 }],
  },
  themeThumb: {
    width: '100%',
    height: '100%',
  },
  thumbOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.08)',
  },
  selectedPill: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#111827',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  themeInfoPanel: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 12,
    borderTopWidth: 4,
  },
  themeLabel: {
    fontSize: 15,
    fontWeight: '900',
  },
  themePaletteRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 8,
  },
  themePaletteChip: {
    flex: 1,
    height: 18,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.8)',
  },

  stepTwoWrap: {
    flex: 1,
  },
  controlsPanel: {
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 12,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    gap: 2,
  },
  controlRow: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#ececec',
  },
  controlText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#374151',
    flex: 1,
  },
  controlValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#9ca3af',
  },
  revertBtn: {
    marginTop: 12,
    alignSelf: 'flex-start',
  },
  revertText: {
    color: '#dc2626',
    fontWeight: '700',
  },
});