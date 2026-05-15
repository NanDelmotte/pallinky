/**
 * Path: apps/mobile/app/index.tsx
 * Description: Root entry point. Redirects Guests to the Create landing page.
 */
import React, { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useSession } from '@pallinky/core';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function RootIndex() {
  const { session, loading } = useSession();
  const router = useRouter();

 const WELCOME_KEY = 'pallinky_welcome_seen_v1';

useEffect(() => {
  const run = async () => {
    if (loading) return;

    if (session) {
      router.replace('/(tabs)');
      return;
    }

    const hasSeen = await AsyncStorage.getItem(WELCOME_KEY);

    if (!hasSeen) {
      router.replace('/welcome');
    } else {
      router.replace('/(tabs)');
    }
  };

  run();
}, [loading, session]);

  return (
    <View style={styles.container}>
      <ActivityIndicator color="#43691b" size="large" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center', 
    backgroundColor: '#F6F7F9' 
  },
});