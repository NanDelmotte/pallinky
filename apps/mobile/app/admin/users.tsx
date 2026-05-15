// users.tsx

/** * Path: app/admin/users.tsx 
 * Description: Admin tool to manage beta tester profiles and photos. */

import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Image, TouchableOpacity, Alert, ActivityIndicator, FlatList } from 'react-native';
import { StyledText } from '@pallinky/ui';
import { supabase } from '@pallinky/core';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';

interface Profile {
  email_lc: string;
  avatar_url: string | null;
}

export default function AdminUserManagement() {
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadingFor, setUploadingFor] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    fetchUsers();
  }, []);

  async function fetchUsers() {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('email_lc, avatar_url')
        .order('email_lc', { ascending: true });
      
      if (error) throw error;
      setUsers(data || []);
    } catch (e: any) {
      Alert.alert("Error", e.message);
    } finally {
      setLoading(false);
    }
  }

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
      Alert.alert("Success", `Updated photo for ${targetEmail}`);
    } catch (err: any) {
      Alert.alert("Upload Error", err.message);
    } finally {
      setUploadingFor(null);
    }
  };

  if (loading) return <View style={styles.centered}><ActivityIndicator size="large" color="#43691b" /></View>;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#1f2a1b" />
        </TouchableOpacity>
        <StyledText style={styles.headerTitle}>Beta Testers</StyledText>
        <View style={{ width: 24 }} />
      </View>

      <FlatList
        data={users}
        keyExtractor={(item) => item.email_lc}
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
              <StyledText style={styles.userEmail}>{item.email_lc}</StyledText>
            </View>
            
            <TouchableOpacity 
              style={styles.actionBtn} 
              onPress={() => pickAndUpload(item.email_lc)}
              disabled={!!uploadingFor}
            >
              {uploadingFor === item.email_lc ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Ionicons name="camera" size={20} color="#fff" />
              )}
            </TouchableOpacity>
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
  userEmail: { fontSize: 14, fontWeight: '700', color: '#1f2a1b', flex: 1 },
  actionBtn: { backgroundColor: '#43691b', width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' }
});