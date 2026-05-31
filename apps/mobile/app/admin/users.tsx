// users.tsx

/** * Path: app/admin/users.tsx 
 * Description: Admin tool to manage beta tester profiles and photos. */

import React, { useCallback, useState, useEffect } from 'react';
import { View, StyleSheet, Image, TouchableOpacity, Alert, ActivityIndicator, FlatList } from 'react-native';
import { StyledText } from '@pallinky/ui';
import { supabase } from '@pallinky/core';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useI18n } from '@pallinky/i18n/client';

interface Profile {
  id: string;
  email_lc: string;
  full_name: string | null;
  avatar_url: string | null;
}

export default function AdminUserManagement() {
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadingFor, setUploadingFor] = useState<string | null>(null);
  const [deletingFor, setDeletingFor] = useState<string | null>(null);
  const router = useRouter();
  const { t } = useI18n();

  const fetchUsers = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, email_lc, full_name, avatar_url')
        .order('email_lc', { ascending: true });
      
      if (error) throw error;
      setUsers(data || []);
    } catch (e: any) {
      Alert.alert(t("common_error"), e.message);
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void fetchUsers();
  }, [fetchUsers]);

  const pickAndUpload = async (targetEmail: string) => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
    });

    if (!result.canceled) {
      uploadForUser(targetEmail, result.assets[0].uri);
    }
  };

  const uploadForUser = async (targetEmail: string, uri: string) => {
    setUploadingFor(targetEmail);
    try {
      const fileName = `admin_upd_${targetEmail.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}.jpg`;
      const response = await fetch(uri);
      const arrayBuffer = await response.arrayBuffer();

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, arrayBuffer, { contentType: 'image/jpeg', upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(fileName);

      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: publicUrl, updated_at: new Date() })
        .eq('email_lc', targetEmail.toLowerCase());

      if (updateError) throw updateError;

      // Refresh local state
      setUsers(prev => prev.map(u => u.email_lc === targetEmail ? { ...u, avatar_url: publicUrl } : u));
      Alert.alert(t("common_success"), t("admin_photo_updated", { email: targetEmail }));
    } catch (err: any) {
      Alert.alert(t("admin_upload_error"), err.message);
    } finally {
      setUploadingFor(null);
    }
  };

  const deleteUser = async (target: Profile) => {
    setDeletingFor(target.id);

    try {
      const { data, error } = await supabase.functions.invoke(
        'admin-delete-user',
        {
          method: 'POST',
          body: {
            target_user_id: target.id,
            target_email: target.email_lc,
          },
        },
      );

      if (error || !data?.ok) {
        let details = error?.message;
        const context = (
          error as { context?: { json?: () => Promise<unknown> } } | null
        )?.context;

        if (context?.json) {
          try {
            const body = await context.json();

            if (body && typeof body === 'object') {
              const { details: responseDetails, error: responseError } =
                body as {
                  details?: string;
                  error?: string;
                };

              details = responseDetails || responseError || details;
            }
          } catch {
            // Keep the original error message.
          }
        }

        throw new Error(details || t('admin_user_delete_failed'));
      }

      setUsers((prev) => prev.filter((user) => user.id !== target.id));
      Alert.alert(
        t('common_success'),
        t('admin_user_deleted', { email: target.email_lc }),
      );
    } catch (err: any) {
      Alert.alert(
        t('admin_user_delete_failed'),
        err?.message || t('delete_account_generic_error'),
      );
    } finally {
      setDeletingFor(null);
    }
  };

  const confirmDeleteUser = (target: Profile) => {
    Alert.alert(
      t('admin_user_delete_confirm_title'),
      t('admin_user_delete_confirm_body', { email: target.email_lc }),
      [
        { text: t('common_cancel'), style: 'cancel' },
        {
          text: t('common_delete'),
          style: 'destructive',
          onPress: () => void deleteUser(target),
        },
      ],
    );
  };

  if (loading) return <View style={styles.centered}><ActivityIndicator size="large" color="#43691b" /></View>;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#1f2a1b" />
        </TouchableOpacity>
        <StyledText style={styles.headerTitle}>{t("admin_users_title")}</StyledText>
        <View style={{ width: 24 }} />
      </View>

      <FlatList
        data={users}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 20 }}
        renderItem={({ item }) => (
          <View style={styles.userCard}>
            <View style={styles.userInfo}>
              {item.avatar_url ? (
                <Image source={{ uri: item.avatar_url }} style={styles.miniAvatar} />
              ) : (
                <View style={[styles.miniAvatar, { backgroundColor: '#ddd', justifyContent: 'center', alignItems: 'center' }]}>
                  <Ionicons name="person" size={20} color="#999" />
                </View>
              )}
              <View style={styles.userTextWrap}>
                <StyledText style={styles.userEmail}>{item.email_lc}</StyledText>
                {!!item.full_name && (
                  <StyledText style={styles.userName}>{item.full_name}</StyledText>
                )}
              </View>
            </View>

            <View style={styles.actions}>
              <TouchableOpacity
                style={styles.actionBtn}
                onPress={() => pickAndUpload(item.email_lc)}
                disabled={!!uploadingFor || !!deletingFor}
              >
                {uploadingFor === item.email_lc ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Ionicons name="camera" size={20} color="#fff" />
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionBtn, styles.deleteBtn]}
                onPress={() => confirmDeleteUser(item)}
                disabled={!!uploadingFor || !!deletingFor}
              >
                {deletingFor === item.id ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Ionicons name="trash-outline" size={20} color="#fff" />
                )}
              </TouchableOpacity>
            </View>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8e9dc' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f8e9dc' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 60, paddingBottom: 20 },
  headerTitle: { fontSize: 20, fontWeight: '900', color: '#1f2a1b' },
  userCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#fff', padding: 12, borderRadius: 16, marginBottom: 10, borderWidth: 1, borderColor: '#bac9ad' },
  userInfo: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  miniAvatar: { width: 44, height: 44, borderRadius: 22 },
  userTextWrap: { flex: 1, minWidth: 0 },
  userEmail: { fontSize: 14, fontWeight: '700', color: '#1f2a1b' },
  userName: { fontSize: 12, fontWeight: '600', color: '#66715f', marginTop: 2 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 8, marginLeft: 10 },
  actionBtn: { backgroundColor: '#43691b', width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  deleteBtn: { backgroundColor: '#e63946' }
});
