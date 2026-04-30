// lib/guest-auth.ts
// Server-side helpers for verifying guest/anonymous sessions
// These are used by API routes to check guest trial limits.

import { createSupabaseAdminClient } from "@/lib/supabase";

const TRIAL_MESSAGE_LIMIT = 10;

export type GuestLimits = {
  isGuest: boolean;
  anonymousId: string | null;
  messageCount: number;
  messagesRemaining: number;
  uploadUsed: boolean;
  isBlocked: boolean;
};

/**
 * Check guest session limits from the server side.
 * Called by API routes when an anonymous user makes a request.
 *
 * Returns guest limits based on the anonymousId in the request header.
 * The client sends `x-anonymous-id` after signing in anonymously.
 */
export async function getGuestLimits(anonymousId: string | null): Promise<GuestLimits> {
  if (!anonymousId) {
    return {
      isGuest: false,
      anonymousId: null,
      messageCount: 0,
      messagesRemaining: TRIAL_MESSAGE_LIMIT,
      uploadUsed: false,
      isBlocked: false,
    };
  }

  const supabase = createSupabaseAdminClient();

  const { data, error } = await supabase
    .from("guest_sessions")
    .select("message_count, upload_used")
    .eq("anonymous_id", anonymousId)
    .single();

  if (error || !data) {
    // No session found — treat as new guest
    console.log(`[guest-auth] No session found for ${anonymousId}, treating as new guest`);
    return {
      isGuest: true,
      anonymousId,
      messageCount: 0,
      messagesRemaining: TRIAL_MESSAGE_LIMIT,
      uploadUsed: false,
      isBlocked: false,
    };
  }

  const messageCount = data.message_count ?? 0;
  const uploadUsed = data.upload_used ?? false;

  console.log(`[guest-auth] Session found for ${anonymousId}: messageCount=${messageCount}, uploadUsed=${uploadUsed}`);

  return {
    isGuest: true,
    anonymousId,
    messageCount,
    messagesRemaining: Math.max(0, TRIAL_MESSAGE_LIMIT - messageCount),
    uploadUsed,
    isBlocked: messageCount >= TRIAL_MESSAGE_LIMIT,
  };
}

/**
 * Increment message count for a guest session.
 * Called by API routes after successfully processing a message.
 */
export async function incrementGuestMessageCount(anonymousId: string): Promise<void> {
  const supabase = createSupabaseAdminClient();

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
}

/**
 * Mark upload as used for a guest session.
 * Called by /api/chat-files and /api/chat-images after successful upload.
 */
export async function markGuestUploadUsed(anonymousId: string): Promise<void> {
  const supabase = createSupabaseAdminClient();

  await supabase
    .from("guest_sessions")
    .update({
      upload_used: true,
      last_active_at: new Date().toISOString(),
    })
    .eq("anonymous_id", anonymousId);
}
