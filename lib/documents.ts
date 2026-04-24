import { createClient } from "@supabase/supabase-js";

import { getSupabaseUrl } from "@/lib/supabase";
import { getCachedChunks, setCachedChunks, invalidateChunkCache } from "@/lib/cache/in-memory-cache";

export type StoredDocument = {
  id: string;
  filename: string;
  summary?: string | null;
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

// documents table columns: id, filename, content, summary, created_at, user_id
export async function listUserDocuments(userId: string) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("documents")
    .select("id, filename, summary")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[listUserDocuments]", error.code, error.message);
    throw new Error(error.message || "Could not load documents.");
  }

  return (data ?? []) as StoredDocument[];
}

export async function getUserDocument(userId: string, documentId: string) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("documents")
    .select("id, filename, content, summary")
    .eq("id", documentId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    console.error("[getUserDocument]", error.code, error.message);
    throw new Error(error.message || "Could not load document.");
  }

  if (!data || typeof data.content !== "string") {
    return null;
  }

  return data as StoredDocumentWithContent;
}

export async function listDocumentEmbeddings(documentId: string) {
  const cached = getCachedChunks(documentId);
  if (cached) {
    return cached;
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("document_embeddings")
    .select("chunk_index, content, embedding")
    .eq("document_id", documentId);

  if (error) {
    console.error("[listDocumentEmbeddings]", error.code, error.message);
    throw new Error(error.message || "Could not load document embeddings.");
  }

  // Map snake_case to camelCase for internal use
  const chunks = (data ?? []).map(row => ({
    chunkIndex: row.chunk_index,
    content: row.content,
    embedding: row.embedding,
  }));
  setCachedChunks(documentId, chunks);
  
  return chunks;
}

export async function deleteUserDocument(userId: string, documentId: string) {
  const supabase = createSupabaseAdminClient();
  const { error: embeddingError } = await supabase
    .from("document_embeddings")
    .delete()
    .eq("document_id", documentId);

  if (embeddingError) {
    throw new Error(
      embeddingError.message || "Could not delete document embeddings.",
    );
  }

  const { error: documentError } = await supabase
    .from("documents")
    .delete()
    .eq("id", documentId)
    .eq("user_id", userId);

  if (documentError) {
    throw new Error(documentError.message || "Could not delete document.");
  }

  invalidateChunkCache(documentId);

  return true;
}

// Soft delete not supported - table has no deletedAt column
export async function softDeleteDocument(_userId: string, documentId: string) {
  return deleteUserDocument(_userId, documentId);
}

// Restore not supported - no deletedAt column
export async function restoreDocument(_userId: string, _documentId: string) {
  throw new Error("Restore not supported for this table schema.");
}

export async function invalidateQACacheForDocument(
  documentId: string,
  _userId?: string
) {
  invalidateChunkCache(documentId);

  const supabase = createSupabaseAdminClient();
  await supabase
    .from("qa_cache")
    .delete()
    .eq("document_id", documentId);
}
