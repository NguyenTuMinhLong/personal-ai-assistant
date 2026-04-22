import { createClient } from "@supabase/supabase-js";
import { getSupabaseUrl } from "@/lib/supabase";
import { embed } from "ai";
import { getEmbeddingModel } from "@/lib/ai";
import { getQACache, getQACacheKey } from "@/lib/cache/in-memory-cache";

export type CachedCitation = {
  filename: string;
  chunk_index: number;
  content_preview: string;
};

export type QACacheRow = {
  id: string;
  user_id: string;
  document_id: string;
  session_id: string | null;
  question: string;
  normalized_question: string;
  answer: string;
  citations: CachedCitation[];
  created_at: string;
  updated_at: string;
};

// Type cho raw data từ Supabase (tránh any)
type RawQACacheRow = Omit<QACacheRow, "citations"> & {
  citations: unknown;
  similarity: number;
};

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
      typeof obj.chunk_index === "number" &&
      typeof obj.content_preview === "string"
    ) {
      return [
        {
          filename: obj.filename,
          chunk_index: obj.chunk_index,
          content_preview: obj.content_preview,
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
    .replace(/[“”"'"`’‘]/g, " ")
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

// ==================== FIND CACHED (Exact + Semantic) ====================
export async function findCachedAnswer(input: {
  userId: string;
  documentId: string;
  question: string;
  sessionId?: string | null;
  similarityThreshold?: number;
}): Promise<QACacheRow | null> {
  const normalizedQuestion = normalizeQuestion(input.question);
  const threshold = input.similarityThreshold ?? 0.90;

  // 0. Check L1 in-memory cache first (sub-millisecond lookup)
  const l1Cache = getQACache();
  const l1CacheKey = getQACacheKey(input.userId, input.documentId, normalizedQuestion);
  const l1Cached = l1Cache.get(l1CacheKey);
  
  if (l1Cached) {
    // Return L1 cached result if session matches or is null
    if (!input.sessionId || !l1Cached.sessionId || l1Cached.sessionId === input.sessionId) {
      return {
        id: "",
        user_id: input.userId,
        document_id: input.documentId,
        session_id: l1Cached.sessionId,
        question: input.question,
        normalized_question: normalizedQuestion,
        answer: l1Cached.answer,
        citations: l1Cached.citations as CachedCitation[],
        created_at: "",
        updated_at: "",
      };
    }
  }

  // 1. Exact match in database
  const exact = await findExactCachedAnswer({
    userId: input.userId,
    documentId: input.documentId,
    question: input.question,
    sessionId: input.sessionId,
  });
  
  if (exact) {
    // Store in L1 cache for future lookups
    l1Cache.set(l1CacheKey, {
      answer: exact.answer,
      citations: exact.citations,
      sessionId: exact.session_id,
    });
    return exact;
  }

  // 2. Semantic search
  const { embedding: questionEmbedding } = await embed({
    model: getEmbeddingModel(),
    value: input.question,
  });

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.rpc("match_qa_cache", {
    query_embedding: questionEmbedding,
    match_threshold: threshold,
    match_count: 5,
    p_user_id: input.userId,
    p_document_id: input.documentId,
  });

  if (error || !data?.length) return null;

  const bestMatch = data[0] as RawQACacheRow;
  if (bestMatch.similarity >= threshold) {
    const result = {
      ...bestMatch,
      citations: parseCitations(bestMatch.citations),
    };
    
    // Store semantic match in L1 cache
    l1Cache.set(l1CacheKey, {
      answer: result.answer,
      citations: result.citations,
      sessionId: result.session_id,
    });
    
    return result;
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

  if (error) throw new Error(error.message || "Could not load cached answer.");
  if (!data) return null;

  const raw = data as RawQACacheRow;
  return {
    ...raw,
    citations: parseCitations(raw.citations),
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

  // 1. Generate embedding
  const { embedding: questionEmbedding } = await embed({
    model: getEmbeddingModel(),
    value: input.question,
  });

  // 2. Upsert to database
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
        question_embedding: questionEmbedding,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,document_id,normalized_question" }
    )
    .select()
    .single();

  if (error) throw new Error(error.message || "Could not save cached answer.");

  const raw = data as RawQACacheRow;
  const result = {
    ...raw,
    citations: parseCitations(raw.citations),
  };

  // 3. Update L1 cache with the new answer
  const l1Cache = getQACache();
  const l1CacheKey = getQACacheKey(input.userId, input.documentId, normalizedQuestion);
  l1Cache.set(l1CacheKey, {
    answer: result.answer,
    citations: result.citations,
    sessionId: result.session_id,
  });

  return result;
}