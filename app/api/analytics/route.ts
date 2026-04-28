import { currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import { createSupabaseAdminClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const user = await currentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createSupabaseAdminClient();
  const userId = user.id;

  // Helper: safe count that returns 0 if table doesn't exist
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async function safeCount(queryBuilder: any) {
    try {
      const result = await queryBuilder;
      return (result as { count: number | null }).count ?? 0;
    } catch {
      return 0;
    }
  }

  // Helper: safe query that returns [] if table doesn't exist
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async function safeData<T>(queryBuilder: any): Promise<T[]> {
    try {
      const result = await queryBuilder;
      return result.data ?? [];
    } catch {
      return [];
    }
  }

  // Helper: count messages across user sessions
  async function getMessageCount() {
    try {
      const sessions = await supabase
        .from("chat_sessions")
        .select("id")
        .eq("user_id", userId);
      const ids = sessions.data?.map((s) => s.id) ?? [];
      if (ids.length === 0) return 0;
      const msgs = await supabase
        .from("messages")
        .select("*", { count: "exact", head: true })
        .in("session_id", ids);
      return msgs.count ?? 0;
    } catch {
      return 0;
    }
  }

  // Run all queries in parallel
  const [
    totalQueries,
    totalDocuments,
    totalSessions,
    totalMessages,
    totalFeedback,
    totalUpvotes,
    totalDownvotes,
    dailyEvents,
    recentQueries,
  ] = await Promise.all([
    safeCount(
      supabase
        .from("usage_events")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("event_type", "query")
    ),
    safeCount(
      supabase
        .from("documents")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId)
        .is("deleted_at", null)
    ),
    safeCount(
      supabase
        .from("chat_sessions")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId)
    ),
    getMessageCount(),
    safeCount(
      supabase
        .from("message_feedback")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId)
    ),
    safeCount(
      supabase
        .from("message_feedback")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("vote", "up")
    ),
    safeCount(
      supabase
        .from("message_feedback")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("vote", "down")
    ),
    safeData(
      supabase
        .from("usage_events")
        .select("event_type, created_at")
        .eq("user_id", userId)
        .gte("created_at", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
        .order("created_at", { ascending: true })
    ),
    safeData(
      supabase
        .from("usage_events")
        .select("event_type, event_data, created_at")
        .eq("user_id", userId)
        .eq("event_type", "query")
        .order("created_at", { ascending: false })
        .limit(50)
    ),
  ]);

  // Compute queries per day (last 30 days)
  const queriesPerDay: Record<string, number> = {};
  const now = new Date();
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    queriesPerDay[d.toISOString().slice(0, 10)] = 0;
  }
  for (const event of dailyEvents as Array<{ event_type: string; created_at: string }>) {
    if (event.event_type === "query") {
      const key = event.created_at.slice(0, 10);
      if (key in queriesPerDay) queriesPerDay[key]++;
    }
  }

  // Compute cache hit rate from recent queries
  // TrackEvent sends: reused=true/false and elapsedMs
  let cacheHits = 0;
  let cacheMisses = 0;
  const latencies: number[] = [];
  for (const q of recentQueries as Array<{ event_type: string; event_data: Record<string, unknown>; created_at: string }>) {
    const reused = q.event_data?.reused as boolean | undefined;
    if (reused === true) cacheHits++;
    else if (reused === false) cacheMisses++;
    // TrackEvent sends elapsedMs; analytics historically read latency_ms — support both
    const ms = (q.event_data?.elapsedMs ?? q.event_data?.latencyMs ?? q.event_data?.latency_ms) as number | undefined;
    if (typeof ms === "number" && ms > 0) latencies.push(ms);
  }
  const totalCache = cacheHits + cacheMisses;
  const cacheHitRate = totalCache > 0 ? Math.round((cacheHits / totalCache) * 100) : 0;
  const avgLatency = latencies.length > 0
    ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length)
    : null;

  return NextResponse.json({
    stats: {
      totalQueries,
      totalDocuments,
      totalSessions,
      totalMessages,
      totalFeedback,
      totalUpvotes,
      totalDownvotes,
      feedbackScore: totalUpvotes - totalDownvotes,
      cacheHitRate,
      avgLatency,
    },
    queriesPerDay: Object.entries(queriesPerDay).map(([date, count]) => ({ date, count })),
    generatedAt: new Date().toISOString(),
  });
}

// Server-side helper: track a usage event
export async function trackEvent(
  supabase: ReturnType<typeof import("@/lib/supabase").createSupabaseAdminClient>,
  userId: string,
  eventType: string,
  eventData: Record<string, unknown> = {}
) {
  try {
    await supabase.from("usage_events").insert({
      user_id: userId,
      event_type: eventType,
      event_data: eventData,
    });
  } catch (error) {
    console.error("[analytics] Failed to track event:", error);
  }
}
