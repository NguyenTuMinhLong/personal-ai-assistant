// app/api/cron/cleanup-expired/route.ts
// Vercel Cron endpoint to clean up expired trial documents
// Configured in vercel.json

import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

import { getSupabaseUrl } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  // Verify cron secret for security
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  const supabaseUrl = getSupabaseUrl();
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseServiceRoleKey) {
    console.error("[cleanup] Missing SUPABASE_SERVICE_ROLE_KEY");
    return NextResponse.json(
      { error: "Server configuration error" },
      { status: 500 }
    );
  }

  const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  try {
    // Delete expired trial documents
    const { error: docsError } = await supabase
      .from("documents")
      .delete()
      .not("expires_at", "is", null)
      .lt("expires_at", new Date().toISOString());

    if (docsError) {
      console.error("[cleanup] Error deleting expired documents:", docsError);
      return NextResponse.json(
        { error: "Failed to clean up documents" },
        { status: 500 }
      );
    }

    // Get count of deleted documents
    const { count: deletedDocs } = await supabase
      .from("documents")
      .select("*", { count: "exact", head: true })
      .not("expires_at", "is", null)
      .lt("expires_at", new Date().toISOString());

    // Clean up orphaned guest sessions (no activity in 2 hours and no messages)
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    
    const { error: sessionsError } = await supabase
      .from("guest_sessions")
      .delete()
      .lt("last_active_at", twoHoursAgo)
      .eq("message_count", 0);

    if (sessionsError) {
      console.error("[cleanup] Error cleaning up guest sessions:", sessionsError);
    }

    // Get count of deleted sessions
    const { count: deletedSessions } = await supabase
      .from("guest_sessions")
      .select("*", { count: "exact", head: true })
      .lt("last_active_at", twoHoursAgo)
      .eq("message_count", 0);

    console.log(`[cleanup] Deleted expired documents and sessions`);

    return NextResponse.json({
      success: true,
      deletedDocuments: deletedDocs ?? 0,
      deletedSessions: deletedSessions ?? 0,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[cleanup] Unexpected error:", error);
    return NextResponse.json(
      { error: "Cleanup failed" },
      { status: 500 }
    );
  }
}
