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
import { decode } from 'base64-arraybuffer';
import { Ionicons } from '@expo/vector-icons';

import { supabase } from '@pallinky/core';
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
      'https://images.unsplash.com/photo-1516589178581-6cd7833ae3b2?auto=format&fit=crop&w=1400&q=80',
    thanksGifUrl:
      'https://media.giphy.com/media/l0MYt5jPR6QX5pnqM/giphy.gif',
  },
  fiesta: {
    font: 'Gothic',
    coverImageUrl:
      'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=1400&q=80',
    thanksGifUrl:
      'https://media.giphy.com/media/26ufdipQqU2lhNA4g/giphy.gif',
  },
  classy: {
    font: 'Serif',
    coverImageUrl:
      'https://images.unsplash.com/photo-1519167758481-83f550bb49b3?auto=format&fit=crop&w=1400&q=80',
    thanksGifUrl:
      'https://media.giphy.com/media/89x4osEodHEoo/giphy.gif',
  },
  spicy: {
    font: 'Sans',
    coverImageUrl:
      'https://images.unsplash.com/photo-1519671482749-fd09be7ccebf?auto=format&fit=crop&w=1400&q=80',
    thanksGifUrl:
      'https://media.giphy.com/media/xUPGcguWZHRC2HyBRS/giphy.gif',
  },
  submerged: {
    font: 'Sans',
    coverImageUrl:
      'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1400&q=80',
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

export default function DesignStudioScreen() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const router = useRouter();

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
        Alert.alert('Error', 'Could not load Design Studio.');
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

  const updateStudioState = (patch: Partial<StudioState>) => {
    setStudioState((prev) => ({ ...prev, ...patch }));
  };

  const selectTheme = (themeKey: string) => {
    const defaults = THEME_DEFAULTS[themeKey] || THEME_DEFAULTS.zen;

    setStudioState((prev) => ({
      ...prev,
      theme: themeKey,
      font: prev.font || defaults.font,
      coverImageUrl: prev.coverImageUrl || defaults.coverImageUrl,
      thanksGifUrl: prev.thanksGifUrl || defaults.thanksGifUrl,
    }));

    setStep(2);
  };

  const handleDismiss = () => {
    if (!hasChanges) {
      router.back();
      return;
    }

    Alert.alert('Discard changes?', 'You have unsaved studio changes.', [
      { text: 'Keep editing', style: 'cancel' },
      { text: 'Discard', style: 'destructive', onPress: () => router.back() },
    ]);
  };

  const handleImageUpload = async () => {
    try {
      setUploadingCover(true);

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [16, 9],
        quality: 0.7,
        base64: true,
      });

      if (result.canceled || !result.assets?.[0]?.base64) {
        setUploadingCover(false);
        return;
      }

      const fileName = `cover_${Date.now()}.jpg`;

      const { error } = await supabase.storage
        .from('covers')
        .upload(fileName, decode(result.assets[0].base64), {
          contentType: 'image/jpeg',
          upsert: false,
        });

      if (error) throw error;

      const {
        data: { publicUrl },
      } = supabase.storage.from('covers').getPublicUrl(fileName);

      updateStudioState({ coverImageUrl: publicUrl });
    } catch {
      Alert.alert('Upload failed', 'Could not upload the cover image.');
    } finally {
      setUploadingCover(false);
    }
  };

  const handleSave = async () => {
    if (!event?.id) return;

    try {
      setSaving(true);

      const { error } = await supabase
        .from('events')
        .update({
          gif_key: studioState.theme,
          cover_image_url: studioState.coverImageUrl || null,
          font_family: studioState.font,
          thanks_gif_url: studioState.thanksGifUrl || null,
        })
        .eq('id', event.id);

      if (error) throw error;

      setInitialStudioState(studioState);
      router.back();
    } catch {
      Alert.alert('Error', 'Could not save changes.');
    } finally {
      setSaving(false);
    }
  };

  const resetChanges = () => {
    setStudioState(initialStudioState);
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
        <StyledText>Event not found.</StyledText>
        <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 20 }}>
          <StyledText style={{ color: '#43691b' }}>Close</StyledText>
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

        <StyledText style={styles.headerTitle}>Studio</StyledText>

        <TouchableOpacity onPress={handleSave} disabled={!hasChanges || saving}>
          {saving ? (
            <ActivityIndicator size="small" />
          ) : (
            <StyledText style={[styles.saveAction, !hasChanges && styles.disabledText]}>
              Save
            </StyledText>
          )}
        </TouchableOpacity>
      </View>

      {step === 1 ? (
        <View style={styles.stepOneCenterWrap}>
          <View style={styles.stepOneContainer}>
            <StyledText style={styles.stepOneTitle}>Theme Selection</StyledText>

            <View style={styles.themeGrid}>
              {THUMB_ORDER.map((key) => {
                const item = THEMES[key];
                const isSelected = studioState.theme === key;
                const thumbImage =
                  studioState.theme === key && studioState.coverImageUrl
                    ? studioState.coverImageUrl
                    : THEME_DEFAULTS[key].coverImageUrl;

                return (
                  <TouchableOpacity
                    key={key}
                    style={[styles.themeCard, isSelected && styles.themeCardSelected]}
                    activeOpacity={0.9}
                    onPress={() => selectTheme(key)}
                  >
                    <Image source={{ uri: thumbImage }} style={styles.themeThumb} />
                    <View style={styles.thumbOverlay} />

                    <View style={styles.themeSwatchWrap}>
                      <View
                        style={[
                          styles.themeSwatchOuter,
                          { backgroundColor: item.bg, borderColor: item.accent },
                        ]}
                      >
                        <View
                          style={[
                            styles.themeSwatchInner,
                            { backgroundColor: item.accent },
                          ]}
                        />
                      </View>
                    </View>

                    <StyledText style={styles.themeLabel}>{item.label}</StyledText>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </View>
      ) : (
        <View style={styles.stepTwoWrap}>
          <StudioPreview
            theme={theme}
            fontStyle={fontStyle}
            event={event}
            coverImageUrl={studioState.coverImageUrl}
            thanksGifUrl={studioState.thanksGifUrl}
            activeTab={previewTab}
            onTabChange={setPreviewTab}
          />

          <View style={styles.controlsPanel}>
            {previewTab === 'event' ? (
              <>
                <View style={styles.controlRowGroup}>
                  <TouchableOpacity style={styles.controlRow} onPress={() => setShowSearch(true)}>
                    <Ionicons name="search-outline" size={20} color="#6b7280" />
                    <StyledText style={styles.controlText}>Cover Image</StyledText>
                    <StyledText style={styles.controlValue}>Search</StyledText>
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.controlRow} onPress={handleImageUpload}>
                    <Ionicons name="cloud-upload-outline" size={20} color="#6b7280" />
                    <StyledText style={styles.controlText}>Upload Your Own Image</StyledText>
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
                  <StyledText style={styles.controlText}>Font</StyledText>
                  <StyledText style={styles.controlValue}>{studioState.font}</StyledText>
                </TouchableOpacity>
              </>
            ) : (
              <TouchableOpacity style={styles.controlRow} onPress={() => setShowGiphy(true)}>
                <Ionicons name="happy-outline" size={20} color="#6b7280" />
                <StyledText style={styles.controlText}>Thank You GIF</StyledText>
              </TouchableOpacity>
            )}

            {hasChanges ? (
              <TouchableOpacity style={styles.revertBtn} onPress={resetChanges}>
                <StyledText style={styles.revertText}>Revert Changes</StyledText>
              </TouchableOpacity>
            ) : null}
          </View>
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
  saveAction: {
    color: '#43691b',
    fontWeight: '800',
    fontSize: 16,
  },
  disabledText: {
    color: '#c7c7c7',
  },

  stepOneCenterWrap: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  stepOneContainer: {
    width: '100%',
    alignSelf: 'center',
    maxWidth: 520,
  },
  stepOneTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#374151',
    marginBottom: 16,
  },

  controlRowGroup: {
    gap: 0,
  },
  themeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 16,
    marginBottom: 22,
  },
  themeCard: {
    width: '31%',
    aspectRatio: 1,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: '#ddd',
    position: 'relative',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  themeCardSelected: {
    borderColor: '#111827',
  },
  themeThumb: {
    width: '100%',
    height: '100%',
  },
  thumbOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.16)',
  },
  themeSwatchWrap: {
    position: 'absolute',
    top: 10,
    right: 10,
  },
  themeSwatchOuter: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  themeSwatchInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  themeLabel: {
    position: 'absolute',
    left: 10,
    bottom: 10,
    color: '#fff',
    fontSize: 14,
    fontWeight: '900',
    textShadowColor: 'rgba(0,0,0,0.35)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },

  stepTwoWrap: {
    flex: 1,
  },
  controlsPanel: {
    marginTop: 'auto',
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 28,
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