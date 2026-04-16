import { createClient } from "@supabase/supabase-js";

import { getSupabaseUrl } from "@/lib/supabase";

export type StoredDocument = {
  id: string;
  filename: string;
};

export type StoredDocumentWithContent = StoredDocument & {
  content: string;
};

type DocumentEmbeddingRow = {
  chunk_index: number;
  content: string;
  embedding: unknown;
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

export async function listUserDocuments(userId: string) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("documents")
    .select("id, filename")
    .eq("user_id", userId);

  if (error) {
    throw new Error(error.message || "Could not load documents.");
  }

  return (data ?? []) as StoredDocument[];
}

export async function getUserDocument(userId: string, documentId: string) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("documents")
    .select("id, filename, content")
    .eq("user_id", userId)
    .eq("id", documentId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message || "Could not load document.");
  }

  if (!data || typeof data.content !== "string") {
    return null;
  }

  return data as StoredDocumentWithContent;
}

export async function listDocumentEmbeddings(documentId: string) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("document_embeddings")
    .select("chunk_index, content, embedding")
    .eq("document_id", documentId);

  if (error) {
    throw new Error(error.message || "Could not load document embeddings.");
  }

  return (data ?? []) as DocumentEmbeddingRow[];
}
