// lib/file-cache.ts
import { createClient } from "@supabase/supabase-js";
import { createHash } from "crypto";
import { embed } from "ai";

import { getSupabaseUrl } from "@/lib/supabase";
import { getEmbeddingModel } from "@/lib/ai";

function createSupabaseAdminClient() {
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseServiceRoleKey) {
    throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY.");
  }
  return createClient(getSupabaseUrl(), supabaseServiceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export type FileCacheEntry = {
  id: string;
  user_id: string;
  session_id: string | null;
  file_id: string;
  filename: string;
  mime_type: string;
  storage_url: string;
  extracted_text: string | null;
  text_hash: string | null;
  chunks: FileChunk[];
  file_size_bytes: number;
  created_at: string;
  updated_at: string;
};

export type FileChunk = {
  index: number;
  content: string;
  embedding: number[];
};

export type StoredFileCache = {
  id: string;
  userId: string;
  sessionId: string | null;
  fileId: string;
  filename: string;
  mimeType: string;
  storageUrl: string;
  extractedText: string | null;
  textHash: string | null;
  chunks: FileChunk[];
  fileSizeBytes: number;
  createdAt: string;
  updatedAt: string;
};

export function generateFileId(userId: string, filename: string, size: number): string {
  const raw = `${userId}:${filename}:${size}`;
  return createHash("sha256").update(raw).digest("hex").slice(0, 32);
}

export async function embedFileChunks(chunks: FileChunk[]): Promise<FileChunk[]> {
  if (chunks.length === 0) return chunks;

  const model = getEmbeddingModel();
  const result = await Promise.all(
    chunks.map(async (chunk) => {
      const { embedding } = await embed({ model, value: chunk.content });
      return { ...chunk, embedding };
    }),
  );

  return result;
}

export async function upsertFileCache(
  entry: Omit<FileCacheEntry, "id" | "created_at" | "updated_at">,
): Promise<StoredFileCache | null> {
  const supabase = createSupabaseAdminClient();

  const { data, error } = await supabase
    .from("document_file_cache")
    .upsert(
      {
        user_id: entry.user_id,
        session_id: entry.session_id,
        file_id: entry.file_id,
        filename: entry.filename,
        mime_type: entry.mime_type,
        storage_url: entry.storage_url,
        extracted_text: entry.extracted_text,
        text_hash: entry.text_hash,
        chunks: entry.chunks as unknown[],
        file_size_bytes: entry.file_size_bytes,
      },
      { onConflict: "user_id,file_id" },
    )
    .select()
    .single();

  if (error) {
    console.error("[upsertFileCache]", error.code, error.message);
    return null;
  }

  return mapToStored(data);
}

export async function getFileCache(userId: string, fileId: string): Promise<StoredFileCache | null> {
  const supabase = createSupabaseAdminClient();

  const { data, error } = await supabase
    .from("document_file_cache")
    .select("*")
    .eq("user_id", userId)
    .eq("file_id", fileId)
    .maybeSingle();

  if (error) {
    console.error("[getFileCache]", error.code, error.message);
    return null;
  }

  return mapToStored(data);
}

export async function listFileCacheForSession(sessionId: string): Promise<StoredFileCache[]> {
  const supabase = createSupabaseAdminClient();

  const { data, error } = await supabase
    .from("document_file_cache")
    .select("*")
    .eq("session_id", sessionId);

  if (error) {
    console.error("[listFileCacheForSession]", error.code, error.message);
    return [];
  }

  return (data ?? [])
    .map(mapToStored)
    .filter((entry): entry is StoredFileCache => entry !== null);
}

export async function searchFileChunks(
  fileId: string,
  queryEmbedding: number[],
  topK = 3,
): Promise<FileChunk[]> {
  const supabase = createSupabaseAdminClient();

  const { data, error } = await supabase
    .from("document_file_cache")
    .select("chunks")
    .eq("file_id", fileId)
    .maybeSingle();

  if (error || !data) {
    return [];
  }

  const chunks = (data.chunks ?? []) as FileChunk[];
  if (chunks.length === 0) return [];

  const scored = chunks
    .filter((c) => c.embedding && c.embedding.length === 1536)
    .map((c) => ({
      ...c,
      score: cosineSimilarity(queryEmbedding, c.embedding),
    }))
    .filter((c) => c.score >= 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);

  return scored;
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (!a.length || !b.length || a.length !== b.length) return -1;
  let dot = 0, magA = 0, magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  if (!magA || !magB) return -1;
  return dot / (Math.sqrt(magA) * Math.sqrt(magB));
}

function mapToStored(row: Record<string, unknown> | null): StoredFileCache | null {
  if (!row) return null;
  const chunks = (row.chunks as FileChunk[]) ?? [];
  return {
    id: String(row.id),
    userId: String(row.user_id),
    sessionId: row.session_id ? String(row.session_id) : null,
    fileId: String(row.file_id),
    filename: String(row.filename),
    mimeType: String(row.mime_type),
    storageUrl: String(row.storage_url),
    extractedText: row.extracted_text ? String(row.extracted_text) : null,
    textHash: row.text_hash ? String(row.text_hash) : null,
    chunks,
    fileSizeBytes: Number(row.file_size_bytes),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}
