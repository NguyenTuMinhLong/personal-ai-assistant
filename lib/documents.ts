import { createClient } from "@supabase/supabase-js";

import { getSupabaseUrl } from "@/lib/supabase";
import { getCachedChunks, setCachedChunks, invalidateChunkCache, getQACache } from "@/lib/cache/in-memory-cache";

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

export async function listUserDocuments(userId: string) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("documents")
    .select("id, filename, summary")
    .eq("user_id", userId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message || "Could not load documents.");
  }

  return (data ?? []) as StoredDocument[];
}

export async function getUserDocument(userId: string, documentId: string) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("documents")
    .select("id, filename, content, summary")
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
  // Check L1 cache first
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
    throw new Error(error.message || "Could not load document embeddings.");
  }

  const chunks = (data ?? []) as DocumentEmbeddingRow[];
  
  // Cache for future requests
  setCachedChunks(documentId, chunks);
  
  return chunks;
}

export async function deleteUserDocument(userId: string, documentId: string) {
  const supabase = createSupabaseAdminClient();
  const { data: document, error: fetchError } = await supabase
    .from("documents")
    .select("id")
    .eq("user_id", userId)
    .eq("id", documentId)
    .maybeSingle();

  if (fetchError) {
    throw new Error(fetchError.message || "Could not find document.");
  }

  if (!document) {
    return false;
  }

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
    .eq("user_id", userId)
    .eq("id", documentId);

  if (documentError) {
    throw new Error(documentError.message || "Could not delete document.");
  }

  // Invalidate chunk cache
  invalidateChunkCache(documentId);

  return true;
}

export async function softDeleteDocument(userId: string, documentId: string) {
  const supabase = createSupabaseAdminClient();

  const { error } = await supabase
    .from("documents")
    .update({ deleted_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("id", documentId)
    .is("deleted_at", null);

  if (error) {
    throw new Error(error.message || "Could not delete document.");
  }

  // Invalidate chunk cache
  invalidateChunkCache(documentId);

  return true;
}

export async function restoreDocument(userId: string, documentId: string) {
  const supabase = createSupabaseAdminClient();

  const { error } = await supabase
    .from("documents")
    .update({ deleted_at: null })
    .eq("user_id", userId)
    .eq("id", documentId);

  if (error) {
    throw new Error(error.message || "Could not restore document.");
  }

  return true;
}

// ==================== Cache Invalidation ====================
export async function invalidateQACacheForDocument(
  documentId: string,
  userId?: string
) {
  // 1. Invalidate chunk cache
  invalidateChunkCache(documentId);

  // 2. Delete QA cache entries from database for this document
  const supabase = createSupabaseAdminClient();
  
  let query = supabase.from("qa_cache").delete().eq("document_id", documentId);
  
  if (userId) {
    query = query.eq("user_id", userId);
  }
  
  await query;

  // 3. Note: L1 in-memory cache will auto-expire (TTL: 5 min)
  // For immediate invalidation, you'd need Redis (out of scope for now)
}