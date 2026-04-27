// lib/sessions.ts
import { createClient } from "@supabase/supabase-js";
import { getSupabaseUrl } from "@/lib/supabase";
import type { ChatSession, Message } from "@/types";

// ─── Config ─────────────────────────────────────────────────────
const MAX_SESSIONS_PER_DOCUMENT = 50;
const MAX_MESSAGES_PER_SESSION = 200;
const CLEANUP_BATCH_SIZE = 20;

// ─── Admin client factory ─────────────────────────────────────────
function createSupabaseAdminClient() {
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseServiceRoleKey) {
    throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY.");
  }
  return createClient(getSupabaseUrl(), supabaseServiceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

// ─── Sessions ───────────────────────────────────────────────────
// chat_sessions columns: id, user_id, document_id, title, is_pinned, created_at, updated_at

export async function createChatSession(
  userId: string,
  documentId: string,
  title: string,
): Promise<ChatSession | null> {
  const supabase = createSupabaseAdminClient();

  const { data: existing } = await supabase
    .from("chat_sessions")
    .select("id")
    .eq("user_id", userId)
    .eq("document_id", documentId)
    .eq("title", title)
    .limit(1);

  if (existing && existing.length > 0) {
    const { data } = await supabase
      .from("chat_sessions")
      .select("*")
      .eq("id", existing[0].id)
      .single();
    return (data as ChatSession) ?? null;
  }

  const { data, error } = await supabase
    .from("chat_sessions")
    .insert({ user_id: userId, document_id: documentId, title })
    .select()
    .single();

  if (error) {
    console.error("[createChatSession]", error.code, error.message);
    return null;
  }

  return data as ChatSession;
}

export async function listChatSessions(
  userId: string,
  documentId?: string,
): Promise<ChatSession[]> {
  const supabase = createSupabaseAdminClient();

  let sessionsQuery = supabase
    .from("chat_sessions")
    .select("id, document_id, title, is_pinned, created_at, updated_at")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(MAX_SESSIONS_PER_DOCUMENT + 10);

  if (documentId) {
    sessionsQuery = sessionsQuery.eq("document_id", documentId);
  }

  const { data: sessions, error } = await sessionsQuery;

  if (error) {
    console.error("[listChatSessions]", error.code, error.message);
    return [];
  }

  if (!sessions?.length) {
    return [];
  }

  const docIds = [...new Set(sessions.map(s => s.document_id))];
  const { data: docs } = await supabase
    .from("documents")
    .select("id, filename")
    .in("id", docIds);

  const docMap = new Map((docs ?? []).map(d => [d.id, d.filename]));

  return sessions.map(session => ({
    ...session,
    document_name: docMap.get(session.document_id),
  })) as ChatSession[];
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

  if (error) {
    console.log("[getChatSession]", error.code, error.message);
    return null;
  }
  return data as ChatSession;
}

export async function touchChatSession(sessionId: string) {
  const supabase = createSupabaseAdminClient();
  await supabase
    .from("chat_sessions")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", sessionId);
}

export async function updateSessionPin(
  userId: string,
  sessionId: string,
  isPinned: boolean,
) {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from("chat_sessions")
    .update({ is_pinned: isPinned, updated_at: new Date().toISOString() })
    .eq("id", sessionId)
    .eq("user_id", userId);

  if (error) {
    console.error("[updateSessionPin]", error.code, error.message);
    throw new Error(error.message || "Could not update session pin.");
  }
  return true;
}

export async function renameSession(
  userId: string,
  sessionId: string,
  newTitle: string,
): Promise<boolean> {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from("chat_sessions")
    .update({ title: newTitle.trim().slice(0, 120), updated_at: new Date().toISOString() })
    .eq("id", sessionId)
    .eq("user_id", userId);

  if (error) {
    console.error("[renameSession]", error.code, error.message);
    return false;
  }
  return true;
}

export async function deleteChatSession(userId: string, sessionId: string) {
  const supabase = createSupabaseAdminClient();

  const { error: fetchError } = await supabase
    .from("chat_sessions")
    .select("id")
    .eq("id", sessionId)
    .eq("user_id", userId)
    .single();

  if (fetchError) {
    throw new Error("Session not found or access denied.");
  }

  const [, , { error: sessionError }] = await Promise.all([
    supabase.from("message_annotations").delete().eq("session_id", sessionId),
    supabase.from("messages").delete().eq("session_id", sessionId),
    supabase.from("chat_sessions").delete().eq("id", sessionId).eq("user_id", userId),
  ]);

  if (sessionError) {
    throw new Error(sessionError.message || "Could not delete session.");
  }
  return true;
}

// ─── Session cleanup: remove sessions with no messages ──────────
export async function cleanupEmptySessions(userId: string): Promise<number> {
  const supabase = createSupabaseAdminClient();

  const { data: sessions } = await supabase
    .from("chat_sessions")
    .select("id")
    .eq("user_id", userId);

  if (!sessions?.length) return 0;

  const sessionIds = sessions.map(s => s.id);

  const { data: messages } = await supabase
    .from("messages")
    .select("session_id")
    .in("session_id", sessionIds)
    .limit(CLEANUP_BATCH_SIZE);

  const sessionsWithMessages = new Set((messages ?? []).map(m => m.session_id));
  const emptySessions = sessions
    .filter(s => !sessionsWithMessages.has(s.id))
    .slice(0, CLEANUP_BATCH_SIZE);

  if (emptySessions.length === 0) return 0;

  const { error } = await supabase
    .from("chat_sessions")
    .delete()
    .in("id", emptySessions.map(s => s.id))
    .eq("user_id", userId);

  if (error) {
    console.error("[cleanupEmptySessions]", error.code, error.message);
    return 0;
  }

  return emptySessions.length;
}

// ─── Messages ────────────────────────────────────────────────────
// messages columns: id, session_id, role, content, citations, image_url (JSON array), created_at

export async function saveMessage(
  sessionId: string,
  role: "user" | "assistant",
  content: string,
  citations: Message["citations"] = [],
  _imageUrls?: string[] | null,
  _chatFiles?: Array<{
    fileId: string;
    filename: string;
    mimeType: string;
    storageUrl: string;
    fileSize: number;
    extractedText?: string | null;
  }> | null,
): Promise<Message | null> {
  const supabase = createSupabaseAdminClient();

  const imageUrlValue = _imageUrls && _imageUrls.length > 0
    ? JSON.stringify(_imageUrls)
    : null;

  const chatFilesValue = _chatFiles && _chatFiles.length > 0
    ? JSON.stringify(_chatFiles)
    : null;

  const { data, error } = await supabase
    .from("messages")
    .insert({
      session_id: sessionId,
      role,
      content,
      citations,
      image_url: imageUrlValue,
      chat_files: chatFilesValue,
    })
    .select()
    .single();

  if (error) {
    console.error("[saveMessage]", error.code, error.message);
    return null;
  }

  const mapped = mapRowToMessage(data as Record<string, unknown>);
  return mapped;
}

export async function listMessages(
  sessionId: string,
  options?: {
    limit?: number;
    offset?: number;
    cursor?: string;
  },
): Promise<Message[]> {
  const supabase = createSupabaseAdminClient();
  const { limit = MAX_MESSAGES_PER_SESSION, offset, cursor } = options ?? {};

  let query = supabase
    .from("messages")
    .select("*")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true })
    .limit(limit);

  if (cursor) {
    query = query.gt("id", cursor);
  } else if (offset !== undefined) {
    query = query.range(offset, offset + limit - 1);
  }

  const { data, error } = await query;

  if (error) {
    console.error("[listMessages]", error.code, error.message);
    return [];
  }

  return (data ?? []).map(row => mapRowToMessage(row as Record<string, unknown>)) as Message[];
}

export async function getSessionMessage(
  sessionId: string,
  messageId: string,
): Promise<Message | null> {
  const supabase = createSupabaseAdminClient();

  const { data, error } = await supabase
    .from("messages")
    .select("*")
    .eq("id", messageId)
    .eq("session_id", sessionId)
    .maybeSingle();

  if (error) {
    return null;
  }

  return (data as Message | null) ?? null;
}

export async function countMessages(sessionId: string): Promise<number> {
  const supabase = createSupabaseAdminClient();

  const { count, error } = await supabase
    .from("messages")
    .select("*", { count: "exact", head: true })
    .eq("session_id", sessionId);

  if (error) {
    console.error("[countMessages]", error.code, error.message);
    return 0;
  }

  return count ?? 0;
}

export async function deleteMessage(
  sessionId: string,
  messageId: string,
): Promise<boolean> {
  const supabase = createSupabaseAdminClient();

  const { error } = await supabase
    .from("messages")
    .delete()
    .eq("id", messageId)
    .eq("session_id", sessionId);

  if (error) {
    console.error("[deleteMessage]", error.code, error.message);
    return false;
  }

  await supabase
    .from("message_annotations")
    .delete()
    .eq("message_id", messageId);

  return true;
}

// ─── Internal mapper ─────────────────────────────────────────────
function mapRowToMessage(data: Record<string, unknown>): Message {
  const imageUrlRaw = data.image_url;
  let imageUrls: string[] = [];
  if (typeof imageUrlRaw === "string" && imageUrlRaw) {
    try {
      imageUrls = JSON.parse(imageUrlRaw);
    } catch {
      imageUrls = [imageUrlRaw];
    }
  }

  const chatFilesRaw = data.chat_files;
  let chatFiles: Array<{
    fileId: string;
    filename: string;
    mimeType: string;
    storageUrl: string;
    fileSize: number;
    extractedText?: string | null;
  }> = [];
  if (typeof chatFilesRaw === "string" && chatFilesRaw) {
    try {
      chatFiles = JSON.parse(chatFilesRaw);
    } catch {
      chatFiles = [];
    }
  }

  return {
    id: String(data.id),
    session_id: String(data.session_id),
    role: data.role as "user" | "assistant",
    content: String(data.content ?? ""),
    imageUrls: imageUrls.length > 0 ? imageUrls : undefined,
    imageUrl: imageUrls[0] ?? null,
    chatFiles: chatFiles.length > 0 ? chatFiles : undefined,
    citations: Array.isArray(data.citations) ? data.citations : [],
    created_at: String(data.created_at ?? ""),
  };
}
