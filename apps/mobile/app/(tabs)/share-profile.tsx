/**
 * Path: app/(tabs)/share.tsx
 * Description: Profile sharing page with QR code.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { View, StyleSheet, ActivityIndicator } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StyledText } from '@pallinky/ui';
import { supabase, useSession } from '@pallinky/core';

interface ProfileRow {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
}

export default function ShareProfileScreen() {
  const { session } = useSession();

  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function loadProfile() {
      if (!session?.user?.id) {
        setProfile(null);
        setLoadingProfile(false);
        return;
      }

      setLoadingProfile(true);

      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url')
        .eq('id', session.user.id)
        .maybeSingle();

      if (!isMounted) return;

      if (error) {
        console.log('Share profile load error:', error);
        setProfile({ id: session.user.id, full_name: null, avatar_url: null });
        setLoadingProfile(false);
        return;
      }

      setProfile(
        (data as ProfileRow | null) || {
          id: session.user.id,
          full_name: null,
          avatar_url: null,
        },
      );
      setLoadingProfile(false);
    }

    void loadProfile();

    return () => {
      isMounted = false;
    };
  }, [session?.user?.id]);

  const profileShareUrl = useMemo(() => {
    if (!profile?.id) {
      return '';
    }

    const params = new URLSearchParams({ profileId: profile.id });
    const displayName = profile.full_name?.trim();
    const avatarUrl = profile.avatar_url?.trim();

    if (displayName) {
      params.set('name', displayName);
    }

    if (avatarUrl) {
      params.set('avatarUrl', avatarUrl);
    }

    return `https://pallinky.com/add?${params.toString()}`;
  }, [profile?.avatar_url, profile?.full_name, profile?.id]);
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <StyledText style={styles.title}>Share your profile</StyledText>

        <StyledText style={styles.subtitle}>
          Let someone scan this QR code to connect with you on Pallinky.
        </StyledText>

        <View style={styles.qrCard}>
          {profileShareUrl ? (
            <QRCode value={profileShareUrl} size={220} />
          ) : (
            <View style={styles.qrPlaceholder}>
              {loadingProfile ? (
                <ActivityIndicator color="#43691b" />
              ) : (
                <StyledText style={styles.placeholderText}>
                  Sign in to create your share code.
                </StyledText>
              )}
            </View>
          )}
        </View>

        {profileShareUrl ? (
          <StyledText style={styles.linkText}>{profileShareUrl}</StyledText>
        ) : null}
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
  qrPlaceholder: {
    width: 220,
    height: 220,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderText: {
    fontSize: 15,
    color: '#46515f',
    textAlign: 'center',
    lineHeight: 20,
  },
  linkText: {
    fontSize: 13,
    color: '#46515f',
    textAlign: 'center',
  },
});