import { currentUser } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";

import { createSupabaseAdminClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type FeedbackBody = {
  messageId: string;
  vote: "up" | "down";
};

type GetQuery = {
  messageId?: string;
};

export async function GET(req: NextRequest) {
  const user = await currentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const messageId = searchParams.get("messageId");

  if (!messageId) {
    return NextResponse.json({ error: "messageId is required." }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("message_feedback")
    .select("id, vote, created_at, updated_at")
    .eq("message_id", messageId)
    .eq("user_id", user.id)
    .single();

  if (error && error.code !== "PGRST116") {
    return NextResponse.json({ error: "Failed to fetch feedback." }, { status: 500 });
  }

  return NextResponse.json({ feedback: data ?? null });
}

export async function POST(req: NextRequest) {
  const user = await currentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: FeedbackBody;
  try {
    body = (await req.json()) as FeedbackBody;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const { messageId, vote } = body;

  if (!messageId) {
    return NextResponse.json({ error: "messageId is required." }, { status: 400 });
  }

  if (vote !== "up" && vote !== "down") {
    return NextResponse.json({ error: "vote must be 'up' or 'down'." }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();

  // Try to upsert with the unique constraint on (message_id, user_id)
  // If the table doesn't have the constraint yet, fall back to insert/update
  let result;
  const { error: upsertError } = await supabase
    .from("message_feedback")
    .upsert(
      {
        message_id: messageId,
        user_id: user.id,
        vote,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "message_id,user_id" }
    )
    .select("id, message_id, vote, created_at, updated_at")
    .single();

  result = { data: null, error: upsertError };

  // Fallback: if upsert failed, try insert (for first-time feedback)
  if (result.error) {
    const { data, error: insertError } = await supabase
      .from("message_feedback")
      .insert({
        message_id: messageId,
        user_id: user.id,
        vote,
      })
      .select("id, message_id, vote, created_at, updated_at")
      .single();

    if (!insertError && data) {
      result = { data, error: null };
    }
  }

  if (result.error) {
    console.error("[feedback] Error saving feedback:", result.error);
    const msg = result.error.message ?? "Failed to save feedback.";
    if (msg.includes("does not exist")) {
      return NextResponse.json(
        { error: "Database not ready. Please run the migration first." },
        { status: 503 }
      );
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  return NextResponse.json({ success: true, feedback: result.data });
}

export async function DELETE(req: NextRequest) {
  const user = await currentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const messageId = searchParams.get("messageId");

  if (!messageId) {
    return NextResponse.json({ error: "messageId is required." }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from("message_feedback")
    .delete()
    .eq("message_id", messageId)
    .eq("user_id", user.id);

  // Silently succeed if table doesn't exist yet
  if (error && !error.message.includes("does not exist")) {
    return NextResponse.json({ error: "Failed to remove feedback." }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
