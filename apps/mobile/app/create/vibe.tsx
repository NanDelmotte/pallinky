/**
 * Path: apps/mobile/app/create/vibe.tsx
 * Description: Compatibility route.
 * The unified create UI now lives in /create/formal and this route forwards to it.
 */

import React, { useEffect } from 'react';
import { ActivityIndicator, View, StyleSheet } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';

export default function VibeRouteShim() {
  const params = useLocalSearchParams();

  useEffect(() => {
    router.replace({
      pathname: '/create/formal',
      params,
    });
  }, [params]);

  return (
    <View style={styles.wrapper}>
      <ActivityIndicator />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});