/**
 * Path: app/event/[slug]/index.tsx
 * Description: Legacy event details entrypoint. Redirects to the canonical details page.
 */

import React from 'react';
import { Redirect, useLocalSearchParams } from 'expo-router';

export default function EventIndexRedirect() {
  const { slug, token } = useLocalSearchParams<{ slug: string; token?: string }>();

  if (!slug) {
    return <Redirect href="/(tabs)" />;
  }

  return (
    <Redirect
      href={{
        pathname: '/event/[slug]/details',
        params: {
          slug,
          ...(token ? { token } : {}),
        },
      }}
    />
  );
}
