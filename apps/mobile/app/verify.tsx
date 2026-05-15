/**
 * Path: app/verify.tsx
 * Description: Deprecated verification page.
 * Redirects to the canonical auth verify screen.
 */

import { useEffect } from 'react';
import { useRouter } from 'expo-router';

export default function VerifyRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/auth/verify');
  }, []);

  return null;
}