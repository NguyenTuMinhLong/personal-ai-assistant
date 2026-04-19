// lib/annotations.ts
import { createClient } from "@supabase/supabase-js";

import { getSupabaseUrl } from "@/lib/supabase";

export type HighlightColor =
  | "rose"
  | "amber"
  | "emerald"
  | "sky"
  | "violet";

export type MessageAnnotation = {
  id: string;
  user_id: string;
  session_id: string;
  document_id: string;
  message_id: string;
  note_content: string | null;
  highlight_color: HighlightColor | null;
  created_at: string;
  updated_at: string;
};

function createSupabaseAdminClient() {
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseServiceRoleKey) {
    throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY.");
  }

  return createClient(getSupabaseUrl(), supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export async function listSessionAnnotations(
  userId: string,
  sessionId: string,
): Promise<MessageAnnotation[]> {
  const supabase = createSupabaseAdminClient();

  const { data, error } = await supabase
    .from("message_annotations")
    .select("*")
    .eq("user_id", userId)
    .eq("session_id", sessionId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message || "Could not load annotations.");
  }

  return (data ?? []) as MessageAnnotation[];
}

export async function upsertMessageAnnotation(input: {
  userId: string;
  sessionId: string;
  documentId: string;
  messageId: string;
  noteContent?: string | null;
  highlightColor?: HighlightColor | null;
}): Promise<MessageAnnotation | null> {
  const supabase = createSupabaseAdminClient();

  const noteContent = input.noteContent?.trim() || null;
  const highlightColor = input.highlightColor ?? null;

  const { data, error } = await supabase
    .from("message_annotations")
    .upsert(
      {
        user_id: input.userId,
        session_id: input.sessionId,
        document_id: input.documentId,
        message_id: input.messageId,
        note_content: noteContent,
        highlight_color: highlightColor,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: "user_id,message_id",
      },
    )
    .select()
    .single();

  if (error) {
    throw new Error(error.message || "Could not save annotation.");
  }

  return data as MessageAnnotation;
}

export async function deleteMessageAnnotation(
  userId: string,
  messageId: string,
) {
  const supabase = createSupabaseAdminClient();

  const { error } = await supabase
    .from("message_annotations")
    .delete()
    .eq("user_id", userId)
    .eq("message_id", messageId);

  if (error) {
    throw new Error(error.message || "Could not delete annotation.");
  }

  return true;
}