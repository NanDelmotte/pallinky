/**
 * Path: apps/mobile/app/add.tsx
 * Description: Compatibility route for profile add deep links.
 */

import { Redirect, useLocalSearchParams } from 'expo-router';

export default function AddProfileRedirect() {
  const { profileId } = useLocalSearchParams<{ profileId?: string | string[] }>();
  const cleanProfileId = Array.isArray(profileId) ? profileId[0] : profileId;

  if (!cleanProfileId) {
    return <Redirect href="/(tabs)/people" />;
  }

  return (
    <Redirect
      href={{
        pathname: '/people/add',
        params: { profileId: cleanProfileId },
      }}
    />
  );
}
