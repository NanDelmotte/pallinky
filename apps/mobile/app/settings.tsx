/**
 * Path: app/settings.tsx
 * Description: Settings-only page.
 * Identity/profile behavior lives on /profile.
 */

import React, { useEffect, useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Alert, ScrollView } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { StyledText } from '@pallinky/ui';
import { supabase, useSession } from '@pallinky/core';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export default function SettingsScreen() {
  const { session } = useSession();
  const router = useRouter();

  const [email, setEmail] = useState(session?.user?.email || '');

  const isAdmin = email.toLowerCase().trim() === 'nanbowles@gmail.com';

  useEffect(() => {
    if (session?.user?.email) {
      setEmail(session.user.email);
    }
  }, [session?.user?.email]);

  function handleSignOut() {
    Alert.alert('Sign Out', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          await supabase.auth.signOut();
          router.replace('/auth');
        },
      },
    ]);
  }

  async function clearDismissedCardState() {
  await SecureStore.deleteItemAsync('dismissed_vibes');
}

function resetDismissedCards() {
  Alert.alert('Restore Cards', 'Bring back all hidden cards?', [
    { text: 'Cancel', style: 'cancel' },
    {
      text: 'Yes',
      onPress: async () => {
        const emailLc = email.toLowerCase().trim();

        const { error } = await supabase
          .from('closed_cards')
          .delete()
          .eq('user_email_lc', emailLc);

        if (error) {
          Alert.alert('Error', error.message);
          return;
        }

        await clearDismissedCardState();
        Alert.alert('Success', 'Restored.');
      },
    },
  ]);
}

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <TouchableOpacity onPress={() => router.back()} style={styles.backArrow}>
        <Ionicons name="arrow-back" size={28} color="#43691b" />
      </TouchableOpacity>

      <StyledText style={styles.headerTitle}>Settings</StyledText>

      {isAdmin && (
        <View style={styles.section}>
          <StyledText style={styles.sectionLabel}>Admin Tools</StyledText>
          <TouchableOpacity style={styles.dataBtn} onPress={() => router.push('/admin/users')}>
            <Ionicons name="people-circle-outline" size={24} color="#43691b" />
            <StyledText style={styles.dataBtnText}>Manage Tester Photos</StyledText>
          </TouchableOpacity>
          <TouchableOpacity style={styles.dataBtn} onPress={() => router.push('/admin/seed-confirmed')}>
            <Ionicons name="people-circle-outline" size={24} color="#43691b" />
            <StyledText style={styles.dataBtnText}>seed date </StyledText>
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.section}>
        <StyledText style={styles.sectionLabel}>Data Management</StyledText>
        <TouchableOpacity style={styles.dataBtn} onPress={resetDismissedCards}>
          <Ionicons name="refresh-circle-outline" size={24} color="#43691b" />
          <StyledText style={styles.dataBtnText}>Restore Hidden Cards</StyledText>
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut}>
        <Ionicons name="log-out-outline" size={20} color="#e63946" />
        <StyledText style={styles.signOutBtnText}>Sign Out</StyledText>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: '#F6F7F9',
    padding: 30,
    paddingTop: 60,
    paddingBottom: 50,
  },
  backArrow: {
    marginBottom: 10,
    width: 40,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '900',
    color: '#1f2a1b',
    marginBottom: 20,
  },
  profileLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#bac9ad',
    padding: 16,
  },
  profileLinkLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  profileLinkTitle: {
    fontWeight: '800',
    color: '#1f2a1b',
    fontSize: 15,
  },
  profileLinkSubtitle: {
    color: '#66715f',
    fontSize: 12,
    marginTop: 2,
  },
  section: {
    marginTop: 30,
    borderTopWidth: 1,
    borderTopColor: '#bac9ad',
    paddingTop: 20,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#43691b',
    opacity: 0.6,
    marginBottom: 10,
    textTransform: 'uppercase',
  },
  dataBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#43691b',
    marginBottom: 10,
  },
  dataBtnText: {
    color: '#43691b',
    fontWeight: 'bold',
  },
  signOutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginTop: 40,
    padding: 15,
    borderRadius: 12,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ffd6d6',
  },
  signOutBtnText: {
    color: '#e63946',
    fontWeight: 'bold',
  },
});