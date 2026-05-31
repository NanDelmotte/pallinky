import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { supabase, useSession } from '@pallinky/core';
import { StyledText } from '@pallinky/ui';
import { goBackOrReplace } from '../../../lib/navigation';

const COLORS = {
  background: '#F8FAF6',
  surface: '#EFF4EA',
  text: '#1F2A1B',
  muted: '#66715F',
  purple: '#6A4C93',
};

function normalizeEmail(value: string | null | undefined) {
  return (value || '').toLowerCase().trim();
}

export default function EditChatThreadPage() {
  const { threadId } = useLocalSearchParams<{ threadId: string }>();
  const router = useRouter();
  const { session } = useSession();
  const viewerEmail = normalizeEmail(session?.user?.email);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState('');

  const loadThread = useCallback(async () => {
    if (!threadId || !viewerEmail) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const { data, error } = await supabase.rpc('get_chat_thread_details', {
        p_thread_id: threadId,
        p_user_email: viewerEmail,
      });

      if (error) throw error;
      setTitle(String(data?.[0]?.title || '').trim());
    } catch (err) {
      console.error('Failed to load thread title', err);
      setTitle('');
    } finally {
      setLoading(false);
    }
  }, [threadId, viewerEmail]);

  useEffect(() => {
    void loadThread();
  }, [loadThread]);

  const handleSave = useCallback(async () => {
    const cleanTitle = title.trim();
    if (!threadId || !viewerEmail || !cleanTitle || saving) return;

    try {
      setSaving(true);
      const { error } = await supabase.rpc('rename_chat_thread', {
        p_thread_id: threadId,
        p_user_email: viewerEmail,
        p_title: cleanTitle,
      });

      if (error) throw error;
      goBackOrReplace(router, `/chat/info/${threadId}`);
    } catch (err: any) {
      console.error('Failed to rename chat', err);
      Alert.alert('Could not save title', err?.message || 'Please try again.');
    } finally {
      setSaving(false);
    }
  }, [saving, threadId, title, viewerEmail, router]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerButton} onPress={() => goBackOrReplace(router, `/chat/info/${threadId}`)}>
          <Ionicons name="chevron-back" size={26} color={COLORS.text} />
        </TouchableOpacity>

        <View style={styles.headerTextWrap}>
          <StyledText style={styles.title}>Edit chat name</StyledText>
          <StyledText style={styles.subtitle}>Choose what people see</StyledText>
        </View>
      </View>

      <View style={styles.body}>
        {loading ? (
          <ActivityIndicator color={COLORS.purple} />
        ) : (
          <>
            <View style={styles.inputWrap}>
              <TextInput
                value={title}
                onChangeText={setTitle}
                placeholder="Chat name"
                placeholderTextColor={COLORS.muted}
                style={styles.input}
                autoFocus
              />
            </View>

            <TouchableOpacity
              style={[styles.saveButton, !title.trim() && styles.saveButtonDisabled]}
              onPress={handleSave}
              disabled={!title.trim() || saving}
            >
              {saving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <StyledText style={styles.saveButtonText}>Save</StyledText>
              )}
            </TouchableOpacity>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontSize: 28,
    lineHeight: 32,
    fontWeight: '900',
    color: COLORS.text,
  },
  subtitle: {
    marginTop: 2,
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.muted,
  },
  body: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
    gap: 16,
  },
  inputWrap: {
    borderRadius: 18,
    backgroundColor: COLORS.surface,
    paddingHorizontal: 14,
  },
  input: {
    minHeight: 48,
    fontSize: 17,
    color: COLORS.text,
  },
  saveButton: {
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.purple,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.45,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#fff',
  },
});
