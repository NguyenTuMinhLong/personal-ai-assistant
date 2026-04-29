// hooks/useGuestSession.ts
"use client";

import { useAuth } from "@clerk/nextjs";
import { useCallback, useEffect, useRef, useState } from "react";
import { createSupabaseAnonClient } from "@/lib/supabase";
import { toast } from "sonner";

const GUEST_SESSION_KEY = "guest_session_id";
const TRIAL_MESSAGE_LIMIT = 10;

export type GuestSession = {
  id: string;
  anonymousId: string;
  messageCount: number;
  uploadUsed: boolean;
  createdAt: string;
  lastActiveAt: string;
};

export type GuestState = {
  isGuest: boolean;
  isLoading: boolean;
  session: GuestSession | null;
  messagesRemaining: number;
  canUpload: boolean;
  isBlocked: boolean;
  showPopup: boolean;
};

type UseGuestSessionReturn = GuestState & {
  initGuestSession: () => Promise<void>;
  incrementMessageCount: (anonymousId: string) => Promise<void>;
  markUploadUsed: (anonymousId: string) => Promise<void>;
  dismissPopup: () => void;
  resetGuestSession: () => Promise<void>;
};

/**
 * Manages guest/anonymous user sessions for the trial experience.
 * Only activates when the user is NOT authenticated with Clerk.
 *
 * - On first visit (unauthenticated), signs in anonymously via Supabase and creates a guest_session record.
 * - Tracks message_count and upload_used in the guest_sessions table.
 * - Resets session on page reload to prevent guest spam.
 * - Blocks the user after 10 messages with a registration popup.
 */
export function useGuestSession(): UseGuestSessionReturn {
  const { isSignedIn, isLoaded } = useAuth();

  const [state, setState] = useState<GuestState>({
    isGuest: false,
    isLoading: false,
    session: null,
    messagesRemaining: TRIAL_MESSAGE_LIMIT,
    canUpload: true,
    isBlocked: false,
    showPopup: false,
  });

  const supabaseRef = useRef<ReturnType<typeof createSupabaseAnonClient> | null>(null);
  const initRanRef = useRef(false);

  const getSupabase = useCallback(() => {
    if (!supabaseRef.current) {
      supabaseRef.current = createSupabaseAnonClient();
    }
    return supabaseRef.current;
  }, []);

  const fetchGuestSession = useCallback(
    async (anonymousId: string): Promise<GuestSession | null> => {
      const supabase = getSupabase();
      const { data } = await supabase
        .from("guest_sessions")
        .select("*")
        .eq("anonymous_id", anonymousId)
        .single();

      if (!data) return null;
      return {
        id: data.id,
        anonymousId: data.anonymous_id,
        messageCount: data.message_count,
        uploadUsed: data.upload_used,
        createdAt: data.created_at,
        lastActiveAt: data.last_active_at,
      };
    },
    [getSupabase]
  );

  const createGuestSessionRecord = useCallback(
    async (anonymousId: string): Promise<GuestSession | null> => {
      const supabase = getSupabase();
      const { data, error } = await supabase
        .from("guest_sessions")
        .insert({
          anonymous_id: anonymousId,
          message_count: 0,
          upload_used: false,
        })
        .select()
        .single();

      if (error) {
        console.error("[guest] Failed to create guest session record:", error);
        return null;
      }

      return {
        id: data.id,
        anonymousId: data.anonymous_id,
        messageCount: data.message_count,
        uploadUsed: data.upload_used,
        createdAt: data.created_at,
        lastActiveAt: data.last_active_at,
      };
    },
    [getSupabase]
  );

  const deleteGuestSessionRecord = useCallback(
    async (anonymousId: string): Promise<void> => {
      const supabase = getSupabase();
      await supabase
        .from("guest_sessions")
        .delete()
        .eq("anonymous_id", anonymousId);
    },
    [getSupabase]
  );

  const initGuestSession = useCallback(async () => {
    // Only run for unauthenticated users
    if (isSignedIn) {
      initRanRef.current = true;
      setState({
        isGuest: false,
        isLoading: false,
        session: null,
        messagesRemaining: TRIAL_MESSAGE_LIMIT,
        canUpload: true,
        isBlocked: false,
        showPopup: false,
      });
      return;
    }

    if (typeof window === "undefined") return;
    if (initRanRef.current) return;
    initRanRef.current = true;

    setState((s) => ({ ...s, isLoading: true }));

    const supabase = getSupabase();

    // Check for existing anonymous session in localStorage
    const storedSessionId = localStorage.getItem(GUEST_SESSION_KEY);

    if (storedSessionId) {
      const existingSession = await fetchGuestSession(storedSessionId);
      if (existingSession) {
        // Reload detected: delete old session and start fresh
        await deleteGuestSessionRecord(storedSessionId);
      }
    }

    // Sign in anonymously to get a fresh user ID
    const { data: sessionData } = await supabase.auth.getSession();

    if (sessionData?.session?.user) {
      await deleteGuestSessionRecord(sessionData.session.user.id);
      await supabase.auth.signOut();
    }

    const { data: anonData, error: anonError } = await supabase.auth.signInAnonymously();
    if (anonError || !anonData?.user) {
      console.error("[guest] Failed to sign in anonymously:", anonError);
      toast.error("Could not start guest session. Please refresh.");
      setState((s) => ({ ...s, isLoading: false }));
      return;
    }

    const anonymousId = anonData.user.id;
    const guestSession = await createGuestSessionRecord(anonymousId);
    if (!guestSession) {
      setState((s) => ({ ...s, isLoading: false }));
      return;
    }

    localStorage.setItem(GUEST_SESSION_KEY, anonymousId);

    setState({
      isGuest: true,
      isLoading: false,
      session: guestSession,
      messagesRemaining: TRIAL_MESSAGE_LIMIT - guestSession.messageCount,
      canUpload: !guestSession.uploadUsed,
      isBlocked: guestSession.messageCount >= TRIAL_MESSAGE_LIMIT,
      showPopup: guestSession.messageCount >= TRIAL_MESSAGE_LIMIT,
    });
  }, [createGuestSessionRecord, deleteGuestSessionRecord, fetchGuestSession, getSupabase, isSignedIn]);

  const incrementMessageCount = useCallback(
    async (anonymousId: string) => {
      const supabase = getSupabase();

      const { data } = await supabase
        .from("guest_sessions")
        .select("message_count")
        .eq("anonymous_id", anonymousId)
        .single();

      const currentCount = data?.message_count ?? 0;
      const newCount = currentCount + 1;

      await supabase
        .from("guest_sessions")
        .update({
          message_count: newCount,
          last_active_at: new Date().toISOString(),
        })
        .eq("anonymous_id", anonymousId);

      const blocked = newCount >= TRIAL_MESSAGE_LIMIT;
      setState((s) => ({
        ...s,
        messagesRemaining: TRIAL_MESSAGE_LIMIT - newCount,
        isBlocked: blocked,
        showPopup: blocked,
      }));
    },
    [getSupabase]
  );

  const markUploadUsed = useCallback(
    async (anonymousId: string) => {
      const supabase = getSupabase();
      await supabase
        .from("guest_sessions")
        .update({
          upload_used: true,
          last_active_at: new Date().toISOString(),
        })
        .eq("anonymous_id", anonymousId);
      setState((s) => ({ ...s, canUpload: false }));
    },
    [getSupabase]
  );

  const dismissPopup = useCallback(() => {
    setState((s) => ({ ...s, showPopup: false }));
  }, []);

  const resetGuestSession = useCallback(async () => {
    const supabase = getSupabase();
    await supabase.auth.signOut();
    localStorage.removeItem(GUEST_SESSION_KEY);
    initRanRef.current = false;
    setState({
      isGuest: false,
      isLoading: true,
      session: null,
      messagesRemaining: TRIAL_MESSAGE_LIMIT,
      canUpload: true,
      isBlocked: false,
      showPopup: false,
    });
    await initGuestSession();
  }, [getSupabase, initGuestSession]);

  // Init on mount when Clerk auth is loaded
  useEffect(() => {
    if (!isLoaded) return;
    void initGuestSession();
  }, [isLoaded, initGuestSession]);

  return {
    ...state,
    initGuestSession,
    incrementMessageCount,
    markUploadUsed,
    dismissPopup,
    resetGuestSession,
  };
}
