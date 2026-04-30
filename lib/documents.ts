import { createClient } from "@supabase/supabase-js";

import { getSupabaseUrl } from "@/lib/supabase";
import { getCachedChunks, setCachedChunks, invalidateChunkCache } from "@/lib/cache/in-memory-cache";

export type StoredDocument = {
  id: string;
  filename: string;
  summary?: string | null;
  expiresAt?: string | null;
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

// documents table columns: id, filename, content, summary, created_at, user_id, deleted_at, expires_at

export async function listUserDocuments(userId: string) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("documents")
    .select("id, filename, summary")
    .eq("user_id", userId)
    .is("deleted_at", null)
    .is("expires_at", null) // Exclude expired trial documents
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
    .select("id, filename, content, summary, expires_at")
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

  return {
    id: data.id,
    filename: data.filename,
    content: data.content,
    summary: data.summary,
    expiresAt: data.expires_at,
  } as StoredDocumentWithContent & { expiresAt?: string | null };
}

export async function getTrialDocument(documentId: string): Promise<StoredDocumentWithContent & { expiresAt?: string | null } | null> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("documents")
    .select("id, filename, content, summary, expires_at")
    .eq("id", documentId)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) {
    console.error("[getTrialDocument]", error.code, error.message);
    return null;
  }

  if (!data || typeof data.content !== "string") {
    return null;
  }

  // Check if expired
  if (data.expires_at && new Date(data.expires_at) < new Date()) {
    return null;
  }

  return {
    id: data.id,
    filename: data.filename,
    content: data.content,
    summary: data.summary,
    expiresAt: data.expires_at,
  };
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
  const now = new Date().toISOString();

  // Soft delete: set deleted_at timestamp
  const { error: documentError } = await supabase
    .from("documents")
    .update({ deleted_at: now })
    .eq("id", documentId)
    .eq("user_id", userId);

  if (documentError) {
    throw new Error(documentError.message || "Could not delete document.");
  }

  // Cascade soft delete to embeddings (preserves ability to restore)
  await supabase
    .from("document_embeddings")
    .update({ deleted_at: now })
    .eq("document_id", documentId)
    .is("deleted_at", null);

  // Clean up QA cache for this document (not recoverable, but keeps cache fresh)
  await supabase
    .from("qa_cache")
    .delete()
    .eq("document_id", documentId);

  // Invalidate chunk cache
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

  // Restore embeddings (clear deleted_at so they're accessible again)
  await supabase
    .from("document_embeddings")
    .update({ deleted_at: null })
    .eq("document_id", documentId)
    .is("deleted_at", null);

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
