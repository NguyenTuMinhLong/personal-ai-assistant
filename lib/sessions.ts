// lib/sessions.ts
import { createClient } from "@supabase/supabase-js";
import { getSupabaseUrl } from "@/lib/supabase";
import type { ChatSession, Message } from "@/types";

// ✅ Dùng admin client giống lib/documents.ts
function createSupabaseAdminClient() {
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseServiceRoleKey) {
    throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY.");
  }
  return createClient(getSupabaseUrl(), supabaseServiceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

// ─── Sessions ────────────────────────────────────────────────

export async function createChatSession(
  userId: string,
  documentId: string,
  title: string,
): Promise<ChatSession | null> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("chat_sessions")
    .insert({ user_id: userId, document_id: documentId, title })
    .select()
    .single();

  if (error) {
    console.error("[createChatSession]", error.message);
    return null;
  }

  return data as ChatSession;
}

export async function listChatSessions(
  userId: string,
  documentId?: string,
): Promise<ChatSession[]> {
  const supabase = createSupabaseAdminClient();
  let query = supabase
    .from("chat_sessions")
    .select("*")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(30);

  if (documentId) {
    query = query.eq("document_id", documentId);
  }

  const { data, error } = await query;

  if (error) {
    console.error("[listChatSessions]", error.message);
    return [];
  }

  return (data ?? []) as ChatSession[];
}

export async function getChatSession(
  userId: string,
  sessionId: string,
): Promise<ChatSession | null> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("chat_sessions")
    .select("*")
    .eq("id", sessionId)
    .eq("user_id", userId)
    .single();

  if (error) return null;
  return data as ChatSession;
}

export async function touchChatSession(sessionId: string) {
  const supabase = createSupabaseAdminClient();
  await supabase
    .from("chat_sessions")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", sessionId);
}

// ─── Messages ────────────────────────────────────────────────

export async function saveMessage(
  sessionId: string,
  role: "user" | "assistant",
  content: string,
  citations: Message["citations"] = [],
): Promise<Message | null> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("messages")
    .insert({ session_id: sessionId, role, content, citations })
    .select()
    .single();

  if (error) {
    console.error("[saveMessage]", error.message);
    return null;
  }

  return data as Message;
}

export async function listMessages(sessionId: string): Promise<Message[]> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("messages")
    .select("*")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("[listMessages]", error.message);
    return [];
  }

  return (data ?? []) as Message[];
}