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
  metadata?: unknown;
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

// documents table columns: id, filename, content, summary, created_at, user_id, deleted_at
export async function listUserDocuments(userId: string) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("documents")
    .select("id, filename, summary")
    .eq("user_id", userId)
    .is("deleted_at", null)
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
    .is("deleted_at", null)
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
    .select("chunk_index, content, embedding, metadata")
    .eq("document_id", documentId);

  if (error) {
    console.error("[listDocumentEmbeddings]", error.code, error.message);
    throw new Error(error.message || "Could not load document embeddings.");
  }

  const chunks = (data ?? []).map(row => ({
    chunkIndex: row.chunk_index,
    content: row.content,
    embedding: row.embedding,
    metadata: row.metadata ?? { chunkType: "fixed" },
  }));
  setCachedChunks(documentId, chunks);

  return chunks;
}

export async function deleteUserDocument(userId: string, documentId: string) {
  const supabase = createSupabaseAdminClient();

  // Soft delete: set deleted_at timestamp
  const { error: documentError } = await supabase
    .from("documents")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", documentId)
    .eq("user_id", userId);

  if (documentError) {
    throw new Error(documentError.message || "Could not delete document.");
  }

  // Embeddings remain but are inaccessible because the parent document is soft-deleted
  // and listUserDocuments / getUserDocument filter them out
  invalidateChunkCache(documentId);

  return true;
}

export async function softDeleteDocument(userId: string, documentId: string) {
  return deleteUserDocument(userId, documentId);
}

export async function restoreDocument(userId: string, documentId: string) {
  const supabase = createSupabaseAdminClient();

  // Restore document
  const { error: documentError } = await supabase
    .from("documents")
    .update({ deleted_at: null })
    .eq("id", documentId)
    .eq("user_id", userId);

  if (documentError) {
    throw new Error(documentError.message || "Could not restore document.");
  }

  // Restore embeddings metadata (clear deleted_at)
  await supabase
    .from("document_embeddings")
    .update({ metadata: { chunkType: "fixed" } })
    .eq("document_id", documentId);

  invalidateChunkCache(documentId);

  return true;
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
