// lib/sessions.ts
import { createClient } from "@supabase/supabase-js";
import { getSupabaseUrl } from "@/lib/supabase";
import type { ChatSession, Message } from "@/types";

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
// chat_sessions columns: id, user_id, document_id, title, is_pinned, created_at, updated_at

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
  
  // Get sessions with user filter
  let sessionsQuery = supabase
    .from("chat_sessions")
    .select("id, document_id, title, is_pinned, created_at, updated_at")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(30);

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

  // Get document filenames separately
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

export async function deleteChatSession(userId: string, sessionId: string) {
  const supabase = createSupabaseAdminClient();
  
  // Verify session exists
  const { error: fetchError } = await supabase
    .from("chat_sessions")
    .select("id")
    .eq("id", sessionId)
    .eq("user_id", userId)
    .single();
  
  if (fetchError) {
    throw new Error("Session not found or access denied.");
  }
  
  // Delete annotations
  await supabase
    .from("message_annotations")
    .delete()
    .eq("session_id", sessionId);
  
  // Delete messages
  await supabase
    .from("messages")
    .delete()
    .eq("session_id", sessionId);
  
  // Delete session
  const { error } = await supabase
    .from("chat_sessions")
    .delete()
    .eq("id", sessionId)
    .eq("user_id", userId);

  if (error) {
    throw new Error(error.message || "Could not delete session.");
  }
  return true;
}

// ─── Messages ────────────────────────────────────────────────
// messages columns: id, session_id, role, content, citations, image_url (JSON array), created_at

export async function saveMessage(
  sessionId: string,
  role: "user" | "assistant",
  content: string,
  citations: Message["citations"] = [],
  _imageUrls?: string[] | null,
  _chatFiles?: Array<{ fileId: string; filename: string; mimeType: string; storageUrl: string; fileSize: number; extractedText?: string | null }> | null,
): Promise<Message | null> {
  const supabase = createSupabaseAdminClient();

  // Store as JSON array (supports multiple images)
  const imageUrlValue = _imageUrls && _imageUrls.length > 0
    ? JSON.stringify(_imageUrls)
    : null;

  // Store chat files as JSON array
  const chatFilesValue = _chatFiles && _chatFiles.length > 0
    ? JSON.stringify(_chatFiles)
    : null;

  const { data, error } = await supabase
    .from("messages")
    .insert({ session_id: sessionId, role, content, citations, image_url: imageUrlValue, chat_files: chatFilesValue })
    .select()
    .single();

  if (error) {
    console.error("[saveMessage]", error.code, error.message);
    return null;
  }

  // Map snake_case DB response to camelCase Message type
  const imageUrlRaw = (data as Record<string, unknown>).image_url;
  let imageUrls: string[] = [];
  if (typeof imageUrlRaw === "string" && imageUrlRaw) {
    try {
      imageUrls = JSON.parse(imageUrlRaw);
    } catch {
      // Single URL stored as plain string (backward compat)
      imageUrls = [imageUrlRaw];
    }
  }
  const chatFilesRaw = (data as Record<string, unknown>).chat_files;
  let chatFiles: Array<{ fileId: string; filename: string; mimeType: string; storageUrl: string; fileSize: number; extractedText?: string | null }> = [];
  if (typeof chatFilesRaw === "string" && chatFilesRaw) {
    try {
      chatFiles = JSON.parse(chatFilesRaw);
    } catch {
      chatFiles = [];
    }
  }
  const mapped: Message = {
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
  return mapped;
}

export async function listMessages(sessionId: string): Promise<Message[]> {
  const supabase = createSupabaseAdminClient();

  const { data, error } = await supabase
    .from("messages")
    .select("*")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("[listMessages]", error.code, error.message);
    return [];
  }

  return (data ?? []).map((row) => {
    const imageUrlRaw = (row as Record<string, unknown>).image_url;
    let imageUrls: string[] = [];
    if (typeof imageUrlRaw === "string" && imageUrlRaw) {
      try {
        imageUrls = JSON.parse(imageUrlRaw);
      } catch {
        imageUrls = [imageUrlRaw];
      }
    }
    const chatFilesRaw = (row as Record<string, unknown>).chat_files;
    let chatFiles: Array<{ fileId: string; filename: string; mimeType: string; storageUrl: string; fileSize: number }> = [];
    if (typeof chatFilesRaw === "string" && chatFilesRaw) {
      try {
        chatFiles = JSON.parse(chatFilesRaw);
      } catch {
        chatFiles = [];
      }
    }
    return {
      id: String(row.id),
      session_id: String(row.session_id),
      role: row.role as "user" | "assistant",
      content: String(row.content ?? ""),
      imageUrls: imageUrls.length > 0 ? imageUrls : undefined,
      imageUrl: imageUrls[0] ?? null,
      chatFiles: chatFiles.length > 0 ? chatFiles : undefined,
      citations: Array.isArray(row.citations) ? row.citations : [],
      created_at: String(row.created_at ?? ""),
    };
  }) as Message[];
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
