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
// chat_sessions columns: id, user_id, document_id, title, created_at, updated_at

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
    .select("id, document_id, title, created_at, updated_at")
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
// messages columns: id, session_id, role, content, citations, created_at

export async function saveMessage(
  sessionId: string,
  role: "user" | "assistant",
  content: string,
  citations: Message["citations"] = [],
  _imageUrl?: string | null,
): Promise<Message | null> {
  const supabase = createSupabaseAdminClient();
  fetch('http://127.0.0.1:7702/ingest/d3a58fcc-6d4a-4e7e-8e0f-d2ead933442d',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'9324ab'},body:JSON.stringify({sessionId:'9324ab',location:'sessions.ts:saveMessage',message:'_imageUrl param',data:{imageUrl:_imageUrl,sessionId,role},timestamp:Date.now()})}).catch(()=>{});

  const { data, error } = await supabase
    .from("messages")
    .insert({ session_id: sessionId, role, content, citations, image_url: _imageUrl })
    .select()
    .single();

  if (error) {
    console.error("[saveMessage]", error.code, error.message);
    return null;
  }
  fetch('http://127.0.0.1:7702/ingest/d3a58fcc-6d4a-4e7e-8e0f-d2ead933442d',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'9324ab'},body:JSON.stringify({sessionId:'9324ab',location:'sessions.ts:saveMessageResult',message:'DB insert result',data:{id:data?.id,image_url:(data as Record<string,unknown>)?.image_url},timestamp:Date.now()})}).catch(()=>{});

  return data as Message;
}

export async function listMessages(sessionId: string): Promise<Message[]> {
  const supabase = createSupabaseAdminClient();

  const { data, error } = await supabase
    .from("messages")
    .select("*")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true });

  // DEBUG: trace raw rows from DB for image_url
  if (data && data.length > 0) {
    fetch('http://127.0.0.1:7702/ingest/d3a58fcc-6d4a-4e7e-8e0f-d2ead933442d',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'9324ab'},body:JSON.stringify({sessionId:'9324ab',location:'sessions.ts:listMessages',message:'DB rows image_url',data:{sessionId,count:data.length,imageUrls:data.map((r:Record<string,unknown>)=>r.image_url)},timestamp:Date.now()})}).catch(()=>{});
  }
  if (error) {
    console.error("[listMessages]", error.code, error.message);
    return [];
  }

  return (data ?? []) as Message[];
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
