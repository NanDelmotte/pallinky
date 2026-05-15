/**
 * Path: app/(tabs)/share.tsx
 * Description: Profile sharing page with QR code.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StyledText } from '@pallinky/ui';
import { supabase, useSession } from '@pallinky/core';

interface ProfileRow {
  id: string;
}
export default function ShareProfileScreen() {
 const { session } = useSession();

const [profile, setProfile] = useState<ProfileRow | null>(null);
useEffect(() => {
  async function loadProfile() {
    if (!session?.user?.id) return;

    const { data, error } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', session.user.id)
      .maybeSingle();

    if (error) {
      console.log('Share profile load error:', error);
      return;
    }

    setProfile((data as ProfileRow | null) || null);
  }

  void loadProfile();
}, [session?.user?.id]);

  const profileShareUrl = useMemo(() => {
  if (!profile?.id) {
    return '';
  }

  return `https://pallinky.com/add?profileId=${profile.id}`;
}, [profile?.id]);
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <StyledText style={styles.title}>Share your profile</StyledText>

        <StyledText style={styles.subtitle}>
          Let someone scan this QR code to connect with you on Pallinky.
        </StyledText>

        <View style={styles.qrCard}>
          <QRCode value={profileShareUrl} size={220} />
        </View>

        <StyledText style={styles.linkText}>{profileShareUrl}</StyledText>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f5ef',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#0b1a2b',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#46515f',
    textAlign: 'center',
    marginBottom: 28,
    lineHeight: 22,
  },
  qrCard: {
    backgroundColor: '#ffffff',
    padding: 24,
    borderRadius: 28,
    marginBottom: 20,
  },
  linkText: {
    fontSize: 13,
    color: '#46515f',
    textAlign: 'center',
  },
});