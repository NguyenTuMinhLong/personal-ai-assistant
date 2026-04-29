// app/api/webhooks/clerk/route.ts
// Handles Clerk webhook events for linking guest data to authenticated users.

import { currentUser } from "@clerk/nextjs/server";
import { createSupabaseAdminClient } from "@/lib/supabase";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Called by the client after a guest user signs up/in with Clerk.
 * Migrates all guest data (sessions, messages, documents, file cache)
 * from the anonymous user to the authenticated user.
 *
 * Flow:
 * 1. User clicks "Sign Up" from guest mode
 * 2. After Clerk sign-up completes, the client calls this endpoint
 * 3. We read the anonymous_id from the request body (sent by the client)
 * 4. We migrate all guest data to the new authenticated user
 */
export async function POST(req: NextRequest) {
  try {
    const user = await currentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { anonymousId } = body as { anonymousId?: string };

    if (!anonymousId) {
      return NextResponse.json({ error: "anonymousId required" }, { status: 400 });
    }

    const supabase = createSupabaseAdminClient();
    const authenticatedUserId = user.id;

    // 1. Delete any existing data for the authenticated user (conflict prevention)
    await Promise.all([
      supabase.from("chat_sessions").delete().eq("user_id", authenticatedUserId),
      supabase.from("documents").delete().eq("user_id", authenticatedUserId),
      supabase.from("file_cache").delete().eq("user_id", authenticatedUserId),
    ]);

    // 2. Migrate chat sessions
    await supabase.rpc("migrate_user_data", {
      from_user: anonymousId,
      to_user: authenticatedUserId,
    }).catch(() => {
      // Fallback if RPC not available: update each table individually
      return Promise.all([
        supabase
          .from("chat_sessions")
          .update({ user_id: authenticatedUserId })
          .eq("user_id", anonymousId),
        supabase
          .from("documents")
          .update({ user_id: authenticatedUserId })
          .eq("user_id", anonymousId),
        supabase
          .from("file_cache")
          .update({ user_id: authenticatedUserId })
          .eq("user_id", anonymousId),
        supabase
          .from("messages")
          .update({ user_id: authenticatedUserId })
          .eq("user_id", anonymousId),
        supabase
          .from("message_annotations")
          .update({ user_id: authenticatedUserId })
          .eq("user_id", anonymousId),
      ]);
    });

    // 3. Delete the guest session record
    await supabase
      .from("guest_sessions")
      .delete()
      .eq("anonymous_id", anonymousId);

    // 4. Sign out the anonymous session (cleanup)
    // Note: The client should also call supabase.auth.signOut() locally

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[webhook] Clerk migration error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
