/**
 * Path: apps/mobile/app/create/success-vibe.tsx
 * Description: Compatibility route for older vibe success links.
 */

import React, { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';

export default function SuccessVibeRouteShim() {
  const params = useLocalSearchParams();

  useEffect(() => {
    router.replace({
      pathname: '/create/event-success',
      params,
    } as any);
  }, [params]);

  return (
    <View style={styles.wrapper}>
      <ActivityIndicator />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
});
