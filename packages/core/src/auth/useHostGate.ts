/**
 * Path: packages/core/src/auth/useHostGate.ts
 * Description: Shared hook that determines whether the currently authenticated
 * user is the host of a given event by comparing session.user.email with
 * events.host_email for the provided slug.
 */

import { useEffect, useState } from 'react';
import { supabase } from '../supabase';
import { getEventHostBySlug } from '../events/getEventHostBySlug';

export type UseHostGateResult = {
  loading: boolean;
  isHost: boolean;
  hostEmail: string | null;
  userEmail: string | null;
};

export function useHostGate(slug?: string): UseHostGateResult {
  const [loading, setLoading] = useState(true);
  const [isHost, setIsHost] = useState(false);
  const [hostEmail, setHostEmail] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const check = async () => {
      const cleanSlug = slug?.trim();

      if (!cleanSlug) {
        if (!active) return;
        setLoading(false);
        setIsHost(false);
        setHostEmail(null);
        setUserEmail(null);
        return;
      }

      if (active) {
        setLoading(true);
      }

      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        const currentUserEmail = session?.user?.email?.toLowerCase().trim() ?? null;
        const host = await getEventHostBySlug(cleanSlug);

        if (!active) return;

        const normalizedHostEmail = host?.host_email ?? null;
        const hostMatch =
          !!currentUserEmail &&
          !!normalizedHostEmail &&
          currentUserEmail === normalizedHostEmail;

        setUserEmail(currentUserEmail);
        setHostEmail(normalizedHostEmail);
        setIsHost(hostMatch);
      } catch {
        if (!active) return;
        setUserEmail(null);
        setHostEmail(null);
        setIsHost(false);
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    void check();

    const { data } = supabase.auth.onAuthStateChange(() => {
      void check();
    });

    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, [slug]);

  return { loading, isHost, hostEmail, userEmail };
}