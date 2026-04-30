// app/api/cron/cleanup-expired/route.ts
// Vercel Cron endpoint to clean up expired trial documents
// Configured in vercel.json
// Runs every 5 minutes: */5 * * * *

import { NextRequest, NextResponse } from "next/server";

import { createSupabaseAdminClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Vercel Cron sends POST requests
export async function POST(req: NextRequest) {
  // Verify cron secret for security
  // Vercel automatically sets VERCEL_CRONS_SECRET env var
  const cronSecret = process.env.VERCEL_CRONS_SECRET;
  if (cronSecret) {
    const authHeader = req.headers.get("authorization");
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const supabase = createSupabaseAdminClient();

  try {
    // Count expired documents before deleting
    const { count: expiredDocsCount } = await supabase
      .from("documents")
      .select("*", { count: "exact", head: true })
      .not("expires_at", "is", null)
      .lt("expires_at", new Date().toISOString());

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

    // Count orphaned guest sessions before deleting
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();

    const { count: orphanedSessionsCount } = await supabase
      .from("guest_sessions")
      .select("*", { count: "exact", head: true })
      .lt("last_active_at", twoHoursAgo)
      .eq("message_count", 0);

    // Clean up orphaned guest sessions (no activity in 2 hours and no messages)
    const { error: sessionsError } = await supabase
      .from("guest_sessions")
      .delete()
      .lt("last_active_at", twoHoursAgo)
      .eq("message_count", 0);

    if (sessionsError) {
      console.error("[cleanup] Error cleaning up guest sessions:", sessionsError);
    }

    console.log(`[cleanup] Deleted ${expiredDocsCount ?? 0} expired docs, ${orphanedSessionsCount ?? 0} orphaned sessions`);

    return NextResponse.json({
      success: true,
      deletedDocuments: expiredDocsCount ?? 0,
      deletedSessions: orphanedSessionsCount ?? 0,
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
