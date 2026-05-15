/**
 * Path: packages/core/src/session.tsx
 * Description: Shared session context for mobile flows using Supabase auth.
 * App-member identity only. Does not persist guest RSVP email.
 */
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { supabase } from './supabase';

type SessionContextType = {
  session: any;
  loading: boolean;
  userId: string | null;
  userEmail: string | null;
};

const SessionContext = createContext<SessionContextType | null>(null);

function normalizeEmail(email?: string | null): string | null {
  return email ? email.toLowerCase().trim() : null;
}

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const timeout = setTimeout(() => {
      if (mounted) {
        setLoading(false);
      }
    }, 3000);

    const syncSessionState = async (nextSession: any) => {
      if (!mounted) return;

      const nextUserId = nextSession?.user?.id ?? null;
      const nextUserEmail = normalizeEmail(nextSession?.user?.email ?? null);

      setSession(nextSession);
      setUserId(nextUserId);
      setUserEmail(nextUserEmail);
      setLoading(false);
      clearTimeout(timeout);
    };

    const initializeAuth = async () => {
      try {
        const {
          data: { session: initialSession },
          error,
        } = await supabase.auth.getSession();

        if (error) {
          throw error;
        }

        await syncSessionState(initialSession);
      } catch {
        if (!mounted) return;
        setSession(null);
        setUserId(null);
        setUserEmail(null);
        setLoading(false);
        clearTimeout(timeout);
      }
    };

    void initializeAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, currentSession) => {
      await syncSessionState(currentSession);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, []);

  const value = useMemo(
    () => ({
      session,
      loading,
      userId,
      userEmail,
    }),
    [session, loading, userId, userEmail]
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export const useSession = () => {
  const context = useContext(SessionContext);

  if (!context) {
    return { session: null, loading: true, userId: null, userEmail: null };
  }

  return context;
};