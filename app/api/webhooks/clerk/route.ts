// app/api/webhooks/clerk/route.ts
// Migrates guest/anonymous data to authenticated user after Clerk sign-up.

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
 * 1. User clicks "Sign Up" from guest mode → anonymousId stored in localStorage
 * 2. Clerk handles sign-up → redirects to /documents
 * 3. GuestMigrationWrapper detects authenticated user and calls this endpoint
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

    // Migrate all guest data to the authenticated user
    // Tables that use user_id: chat_sessions, documents, file_cache, messages, message_annotations
    await Promise.all([
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

    // Delete the guest session record
    await supabase
      .from("guest_sessions")
      .delete()
      .eq("anonymous_id", anonymousId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[webhook] Clerk migration error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
