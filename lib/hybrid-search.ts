/**
 * Hybrid Search Library
 *
 * Combines BM25 (keyword/sparse) + vector similarity (dense) using
 * Reciprocal Rank Fusion (RRF) for robust retrieval across query types.
 */

import { createClient } from "@supabase/supabase-js";
import type { ChunkMetadata, SearchResult } from "@/types";

import { getSupabaseUrl } from "@/lib/supabase";

function createSupabaseAdminClient() {
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseServiceRoleKey) {
    throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY.");
  }
  return createClient(getSupabaseUrl(), supabaseServiceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

type MetadataFilters = {
  section?: string;
  pageNumber?: number;
  chunkType?: string;
};

type HybridSearchOptions = {
  query: string;
  queryEmbedding: number[];
  documentId?: string;
  filters?: MetadataFilters;
  topK?: number;
  weights?: { bm25: number; vector: number };
};

type RankedItem = {
  chunkIndex: number;
  content: string;
  metadata: ChunkMetadata;
  score: number;
  source: "document" | "file";
  rank: number;
};

const RRF_K = 60;
const DEFAULT_BM25_WEIGHT = 0.3;
const DEFAULT_VECTOR_WEIGHT = 0.7;

/**
 * Calculate cosine similarity between two vectors.
 */
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

/**
 * Reciprocal Rank Fusion: combine ranked lists into a unified ranking.
 */
function reciprocalRankFusion(bm25Items: RankedItem[], vectorItems: RankedItem[]): RankedItem[] {
  const fused = new Map<string, RankedItem & { rrfScore: number }>();

  bm25Items.forEach((item, idx) => {
    const key = `${item.source}-${item.chunkIndex}`;
    fused.set(key, { ...item, rrfScore: 0 });
  });

  vectorItems.forEach((item, idx) => {
    const key = `${item.source}-${item.chunkIndex}`;
    if (fused.has(key)) {
      fused.get(key)!.rrfScore += DEFAULT_BM25_WEIGHT / (RRF_K + idx + 1);
      fused.get(key)!.score = Math.max(fused.get(key)!.score, item.score);
    } else {
      fused.set(key, { ...item, rrfScore: DEFAULT_VECTOR_WEIGHT / (RRF_K + idx + 1) });
    }
  });

  bm25Items.forEach((item, idx) => {
    const key = `${item.source}-${item.chunkIndex}`;
    fused.get(key)!.rrfScore += DEFAULT_BM25_WEIGHT / (RRF_K + idx + 1);
  });

  return Array.from(fused.values())
    .sort((a, b) => b.rrfScore - a.rrfScore)
    .map((item) => ({ rank: item.rank, chunkIndex: item.chunkIndex, content: item.content, metadata: item.metadata, score: item.score, source: item.source }));
}

function parseMetadata(metadata: unknown): ChunkMetadata {
  if (typeof metadata === "object" && metadata !== null) {
    const m = metadata as Record<string, unknown>;
    return {
      title: typeof m.title === "string" ? m.title : undefined,
      section: typeof m.section === "string" ? m.section : undefined,
      pageNumber: typeof m.pageNumber === "number" ? m.pageNumber : (typeof m.page_number === "number" ? m.page_number : undefined),
      chunkType: (typeof m.chunkType === "string" ? m.chunkType : (typeof m.chunk_type === "string" ? m.chunk_type : "fixed")) as ChunkMetadata["chunkType"],
    };
  }
  return { chunkType: "fixed" };
}

type BM25Row = {
  chunk_index: number;
  content: string;
  metadata: unknown;
  bm25_score: number;
};

type VectorRow = {
  chunk_index: number;
  content: string;
  metadata: unknown;
  embedding: unknown;
  source: "document" | "file";
};

/**
 * Hybrid search combining BM25 + vector similarity with RRF fusion.
 */
export async function hybridSearch(options: HybridSearchOptions): Promise<SearchResult[]> {
  const {
    query,
    queryEmbedding,
    documentId,
    filters,
    topK = 8,
    weights = { bm25: DEFAULT_BM25_WEIGHT, vector: DEFAULT_VECTOR_WEIGHT },
  } = options;

  const supabase = createSupabaseAdminClient();
  const rrfK = parseInt(process.env.RAG_RRF_K ?? "", 10) || RRF_K;

  let bm25Rows: BM25Row[] = [];
  let vectorRows: VectorRow[] = [];

  // BM25 search via full-text search (fallback if pgvector not available yet)
  try {
    let queryBuilder = supabase
      .from("document_embeddings")
      .select("chunk_index, content, metadata, ts_rank(to_tsvector('english', content), plainto_tsquery('english', $1)) as bm25_score")
      .textSearch("content", query, { type: "websearch" })
      .order("bm25_score", { ascending: false })
      .limit(topK * 3);

    if (documentId) {
      queryBuilder = queryBuilder.eq("document_id", documentId);
    }

    const { data, error } = await queryBuilder;

    if (!error && data) {
      bm25Rows = data as unknown as BM25Row[];
    }
  } catch {
    // BM25 not available — fall through
  }

  // Vector search via pgvector cosine distance
  try {
    let queryBuilder = supabase
      .from("document_embeddings")
      .select("chunk_index, content, metadata, embedding")
      .limit(topK * 3);

    if (documentId) {
      queryBuilder = queryBuilder.eq("document_id", documentId);
    }

    const { data, error } = await queryBuilder;

    if (!error && data) {
      vectorRows = (data as VectorRow[]).map((row) => ({
        ...row,
        source: "document" as const,
      }));
    }
  } catch {
    // pgvector not available — fall through
  }

  // Fallback: if pgvector is not set up yet, do in-memory cosine on raw rows
  if (vectorRows.length === 0) {
    try {
      let queryBuilder = supabase
        .from("document_embeddings")
        .select("chunk_index, content, metadata, embedding");

      if (documentId) {
        queryBuilder = queryBuilder.eq("document_id", documentId);
      }

      const { data, error } = await queryBuilder;

      if (!error && data) {
        vectorRows = (data as VectorRow[])
          .map((row) => ({
            ...row,
            source: "document" as const,
          }))
          .filter((row) => {
            if (!Array.isArray(row.embedding)) return false;
            if ((row.embedding as number[]).length !== queryEmbedding.length) return false;
            return true;
          })
          .map((row) => ({
            ...row,
            score: cosineSimilarity(queryEmbedding, row.embedding as number[]),
          }))
          .filter((row) => row.score >= 0)
          .sort((a, b) => b.score - a.score)
          .slice(0, topK * 3)
          .map((row) => {
            const { score: _s, ...rest } = row;
            return rest;
          });
      }
    } catch {
      // Vector fallback also failed
    }
  }

  // Apply metadata filters
  if (filters && (bm25Rows.length > 0 || vectorRows.length > 0)) {
    const matchesFilter = (metadata: ChunkMetadata) => {
      if (filters.section && metadata.section !== filters.section) return false;
      if (filters.pageNumber !== undefined && metadata.pageNumber !== filters.pageNumber) return false;
      if (filters.chunkType && metadata.chunkType !== filters.chunkType) return false;
      return true;
    };

    bm25Rows = bm25Rows.filter((row) => {
      const meta = parseMetadata(row.metadata);
      if (filters && Object.keys(filters).length > 0 && !matchesFilter(meta)) {
        return false;
      }
      return true;
    });

    vectorRows = vectorRows.filter((row) => {
      const meta = parseMetadata(row.metadata);
      if (filters && Object.keys(filters).length > 0 && !matchesFilter(meta)) {
        return false;
      }
      return true;
    });
  }

  // Sort BM25 by score
  const rankedBM25: RankedItem[] = bm25Rows
    .slice(0, topK * 3)
    .map((row, idx) => ({
      chunkIndex: row.chunk_index,
      content: row.content,
      metadata: parseMetadata(row.metadata),
      score: row.bm25_score,
      source: "document" as const,
      rank: idx,
    }));

  // Score vector results by cosine similarity
  const rankedVector: RankedItem[] = vectorRows
    .slice(0, topK * 3)
    .map((row, idx) => {
      const emb = row.embedding;
      let score = 0;
      if (Array.isArray(emb) && emb.length === queryEmbedding.length) {
        score = cosineSimilarity(queryEmbedding, emb as number[]);
      }
      return {
        chunkIndex: row.chunk_index,
        content: row.content,
        metadata: parseMetadata(row.metadata),
        score: score >= 0 ? score : 0,
        source: row.source,
        rank: idx,
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, topK * 3)
    .map((item, idx) => ({ ...item, rank: idx }));

  // If both empty, return empty
  if (rankedBM25.length === 0 && rankedVector.length === 0) {
    return [];
  }

  // If only one has results, return that
  if (rankedBM25.length === 0) {
    return rankedVector.slice(0, topK).map((item) => ({
      chunkIndex: item.chunkIndex,
      content: item.content,
      metadata: item.metadata,
      score: item.score,
      source: item.source,
    }));
  }

  if (rankedVector.length === 0) {
    return rankedBM25.slice(0, topK).map((item) => ({
      chunkIndex: item.chunkIndex,
      content: item.content,
      metadata: item.metadata,
      score: item.score,
      source: item.source,
    }));
  }

  // RRF fusion
  const fused = reciprocalRankFusion(rankedBM25, rankedVector);
  return fused.slice(0, topK).map((item) => ({
    chunkIndex: item.chunkIndex,
    content: item.content,
    metadata: item.metadata,
    score: item.score,
    source: item.source,
  }));
}

/**
 * Pure vector similarity search (used as fallback / for files).
 */
export async function vectorSearch(
  queryEmbedding: number[],
  documentId: string,
  topK = 8,
): Promise<SearchResult[]> {
  const supabase = createSupabaseAdminClient();

  const { data, error } = await supabase
    .from("document_embeddings")
    .select("chunk_index, content, metadata, embedding")
    .eq("document_id", documentId);

  if (error || !data) {
    return [];
  }

  return (data as unknown as VectorRow[])
    .map((row) => {
      let score = 0;
      if (Array.isArray(row.embedding) && (row.embedding as number[]).length === queryEmbedding.length) {
        score = cosineSimilarity(queryEmbedding, row.embedding as number[]);
      }
      return {
        chunkIndex: row.chunk_index,
        content: row.content,
        metadata: parseMetadata(row.metadata),
        score: score >= 0 ? score : 0,
        source: "document" as const,
      };
    })
    .filter((row) => row.score >= 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
}
