import { createClient } from "@supabase/supabase-js";
import stringSimilarity from "string-similarity";

import { getSupabaseUrl } from "@/lib/supabase";
import { embed } from "ai";
import { getEmbeddingModel } from "@/lib/ai";
import { getQACache, getQACacheKey } from "@/lib/cache/in-memory-cache";

export type CachedCitation = {
  filename: string;
  chunkIndex: number;
  contentPreview: string;
};

export type QACacheRow = {
  id: string;
  userId: string;
  documentId: string;
  sessionId: string | null;
  question: string;
  normalizedQuestion: string;
  answer: string;
  citations: CachedCitation[];
  createdAt: string;
  updatedAt: string;
};

type RawQACacheRow = Omit<QACacheRow, "citations"> & {
  citations: unknown;
  similarity: number;
};

// ==================== Configuration ====================
const SEMANTIC_THRESHOLD = 0.78;
const SEMANTIC_INITIAL_THRESHOLD = 0.70;
const SEMANTIC_INITIAL_LIMIT = 10;
const FUZZY_THRESHOLD = 0.80;

function createSupabaseAdminClient() {
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseServiceRoleKey) {
    throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY.");
  }

  return createClient(getSupabaseUrl(), supabaseServiceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function parseCitations(value: unknown): CachedCitation[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((item) => {
    const obj = item as Record<string, unknown>;
    if (
      typeof obj === "object" &&
      obj !== null &&
      typeof obj.filename === "string" &&
      typeof obj.chunkIndex === "number" &&
      typeof obj.contentPreview === "string"
    ) {
      return [
        {
          filename: obj.filename,
          chunkIndex: obj.chunkIndex as number,
          contentPreview: obj.contentPreview as string,
        },
      ];
    }
    return [];
  });
}

// ==================== NORMALIZE ====================
const LEADING_FILLERS = [
  "cho mình", "giúp mình", "giup minh", "cho tôi", "cho toi", "giúp tôi", "giup toi",
  "please", "plz", "làm ơn", "lam on", "nhờ bạn", "nho ban", "bạn ơi", "ban oi",
  "bro", "bro ơi", "mày ơi", "anh ơi", "chị ơi", "bạn có thể", "có thể",
  "làm sao", "cho tao", "tao muốn", "mình muốn", "cho anh", "cho chị",
];

const TRAILING_FILLERS = [
  "được không", "duoc khong", "đc không", "dc khong", "đi", "nha", "nhé", "nhe",
  "nhá", "giúp mình nhé", "giup minh nhe", "giúp mình với", "giup minh voi",
  "please", "plz", "thế", "hả", "à", "với", "đi bro", "ko", "không", "đc", "được",
  "thế nào", "hả bro", "nha bro",
];

function stripVietnameseDiacritics(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "d");
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function stripBoundaryPhrases(input: string, phrases: string[]) {
  let output = input;
  for (const phrase of phrases) {
    const pattern = new RegExp(`^${escapeRegExp(phrase)}\\s+|\\s+${escapeRegExp(phrase)}$`, "gi");
    output = output.replace(pattern, " ").trim();
  }
  return output;
}

export function normalizeQuestion(input: string) {
  let normalized = input
    .toLowerCase()
    .normalize("NFKC")
    .replace(/[""'"`'']/g, " ")
    .replace(/[?!.,;:()[\]{}\-_/\\]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  normalized = stripVietnameseDiacritics(normalized);
  normalized = normalized.replace(/\bko\b/g, "khong").replace(/\bdc\b/g, "duoc");
  normalized = stripBoundaryPhrases(normalized, LEADING_FILLERS);
  normalized = stripBoundaryPhrases(normalized, TRAILING_FILLERS);
  normalized = normalized.replace(/\s+/g, " ").trim();

  return normalized;
}

// ==================== Re-ranking ====================
function rerankByKeywordOverlap(
  query: string,
  results: RawQACacheRow[]
): RawQACacheRow[] {
  const queryWords = new Set(
    query.toLowerCase().split(/\s+/).filter((w) => w.length > 2)
  );

  return results
    .map((item) => {
      const itemWords = new Set(
        item.normalizedQuestion.toLowerCase().split(/\s+/).filter((w) => w.length > 2)
      );
      const overlap = [...queryWords].filter((w) => itemWords.has(w)).length;
      return { item, overlap };
    })
    .sort(
      (a, b) =>
        b.overlap - a.overlap ||
        b.item.similarity - a.item.similarity
    )
    .map(({ item }) => item);
}

// ==================== Fuzzy Matching ====================
async function findFuzzyCachedAnswer(
  userId: string,
  documentId: string,
  normalizedQuestion: string
): Promise<QACacheRow | null> {
  const supabase = createSupabaseAdminClient();

  const { data } = await supabase
    .from("qa_cache")
    .select("normalized_question, id")
    .eq("user_id", userId)
    .eq("document_id", documentId);

  if (!data?.length) return null;

  const candidates = data.map((d) => d.normalized_question as string);
  const matches = stringSimilarity.findBestMatch(normalizedQuestion, candidates);

  if (matches.bestMatch.rating >= FUZZY_THRESHOLD) {
    const matchedQuestion = candidates[matches.bestMatch.index];
    return findExactCachedAnswer({
      userId,
      documentId,
      question: matchedQuestion,
    });
  }

  return null;
}

// ==================== FIND CACHED ====================
export async function findCachedAnswer(input: {
  userId: string;
  documentId: string;
  question: string;
  sessionId?: string | null;
  similarityThreshold?: number;
}): Promise<QACacheRow | null> {
  const normalizedQuestion = normalizeQuestion(input.question);
  const threshold = input.similarityThreshold ?? SEMANTIC_THRESHOLD;

  // 0. Check L1 in-memory cache first
  const l1Cache = getQACache();
  const l1CacheKey = getQACacheKey(
    input.userId,
    input.documentId,
    normalizedQuestion,
    input.sessionId
  );
  const l1Cached = l1Cache.get(l1CacheKey);

  if (l1Cached) {
    if (
      !input.sessionId ||
      !l1Cached.sessionId ||
      l1Cached.sessionId === input.sessionId
    ) {
      return {
        id: "",
        userId: input.userId,
        documentId: input.documentId,
        sessionId: l1Cached.sessionId,
        question: input.question,
        normalizedQuestion,
        answer: l1Cached.answer,
        citations: l1Cached.citations as CachedCitation[],
        createdAt: "",
        updatedAt: "",
      };
    }
  }

  // 1. Exact match
  const exact = await findExactCachedAnswer({
    userId: input.userId,
    documentId: input.documentId,
    question: input.question,
    sessionId: input.sessionId,
  });

  if (exact) {
    l1Cache.set(l1CacheKey, {
      answer: exact.answer,
      citations: exact.citations,
      sessionId: exact.sessionId,
    });
    return exact;
  }

  // 2. Fuzzy match
  const fuzzy = await findFuzzyCachedAnswer(
    input.userId,
    input.documentId,
    normalizedQuestion
  );

  if (fuzzy) {
    l1Cache.set(l1CacheKey, {
      answer: fuzzy.answer,
      citations: fuzzy.citations,
      sessionId: fuzzy.sessionId,
    });
    return fuzzy;
  }

  // 3. Semantic search (skip if RPC not available)
  try {
    const { embedding: questionEmbedding } = await embed({
      model: getEmbeddingModel(),
      value: input.question,
    });

    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase.rpc("match_qa_cache", {
      query_embedding: questionEmbedding,
      match_threshold: SEMANTIC_INITIAL_THRESHOLD,
      match_count: SEMANTIC_INITIAL_LIMIT,
      p_user_id: input.userId,
      p_document_id: input.documentId,
    });

    if (error || !data?.length) return null;

    const reranked = rerankByKeywordOverlap(input.question, data as RawQACacheRow[]);
    const bestMatch = reranked[0];

    if (bestMatch.similarity >= threshold) {
      const result = {
        ...bestMatch,
        citations: parseCitations(bestMatch.citations),
      };

      l1Cache.set(l1CacheKey, {
        answer: result.answer,
        citations: result.citations,
        sessionId: result.sessionId,
      });

      return result;
    }
  } catch {
    // RPC not available, skip semantic search
  }

  return null;
}

export async function findExactCachedAnswer(input: {
  userId: string;
  documentId: string;
  question: string;
  sessionId?: string | null;
}): Promise<QACacheRow | null> {
  const supabase = createSupabaseAdminClient();
  const normalizedQuestion = normalizeQuestion(input.question);

  let query = supabase
    .from("qa_cache")
    .select("*")
    .eq("user_id", input.userId)
    .eq("document_id", input.documentId)
    .eq("normalized_question", normalizedQuestion);

  if (input.sessionId) {
    query = query.or(`session_id.eq.${input.sessionId},session_id.is.null`);
  }

  const { data, error } = await query.maybeSingle();

  if (error) {
    console.error("[findExactCachedAnswer]", error.code, error.message);
    return null; // Don't throw, just return null
  }
  if (!data) return null;

  // Map snake_case DB columns to camelCase types
  const raw = data as Record<string, unknown>;
  return {
    id: raw.id as string,
    userId: raw.user_id as string,
    documentId: raw.document_id as string,
    sessionId: raw.session_id as string | null,
    question: raw.question as string,
    normalizedQuestion: raw.normalized_question as string,
    answer: raw.answer as string,
    citations: parseCitations(raw.citations),
    createdAt: raw.created_at as string,
    updatedAt: raw.updated_at as string,
  };
}

// ==================== UPSERT ====================
export async function upsertCachedAnswer(input: {
  userId: string;
  documentId: string;
  sessionId: string | null;
  question: string;
  answer: string;
  citations: CachedCitation[];
}): Promise<QACacheRow | null> {
  const supabase = createSupabaseAdminClient();
  const normalizedQuestion = normalizeQuestion(input.question);

  // Generate embedding
  let embedding: number[] = [];
  try {
    const result = await embed({
      model: getEmbeddingModel(),
      value: input.question,
    });
    embedding = result.embedding;
  } catch {
    // Skip embedding if fails
  }

  const { data, error } = await supabase
    .from("qa_cache")
    .upsert(
      {
        user_id: input.userId,
        document_id: input.documentId,
        session_id: input.sessionId,
        question: input.question,
        normalized_question: normalizedQuestion,
        answer: input.answer,
        citations: input.citations,
        question_embedding: embedding,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,document_id,normalized_question" }
    )
    .select()
    .single();

  if (error) {
    console.error("[upsertCachedAnswer]", error.code, error.message);
    return null;
  }

  // Map snake_case DB columns to camelCase types
  const raw = data as Record<string, unknown>;
  return {
    id: raw.id as string,
    userId: raw.user_id as string,
    documentId: raw.document_id as string,
    sessionId: raw.session_id as string | null,
    question: raw.question as string,
    normalizedQuestion: raw.normalized_question as string,
    answer: raw.answer as string,
    citations: parseCitations(raw.citations),
    createdAt: raw.created_at as string,
    updatedAt: raw.updated_at as string,
  };
}
