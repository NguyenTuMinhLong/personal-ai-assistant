import { createClient } from "@supabase/supabase-js";

import { getSupabaseUrl } from "@/lib/supabase";

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

function parseCitations(value: unknown): CachedCitation[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((item) => {
    if (
      typeof item === "object" &&
      item !== null &&
      typeof (item as Record<string, unknown>).filename === "string" &&
      typeof (item as Record<string, unknown>).chunk_index === "number" &&
      typeof (item as Record<string, unknown>).content_preview === "string"
    ) {
      return [
        {
          filename: (item as Record<string, unknown>).filename as string,
          chunk_index: (item as Record<string, unknown>).chunk_index as number,
          content_preview: (item as Record<string, unknown>)
            .content_preview as string,
        },
      ];
    }

    return [];
  });
}

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

const LEADING_FILLERS = [
  "cho mình",
  "giúp mình",
  "giup minh",
  "cho toi",
  "cho tôi",
  "giúp tôi",
  "giup toi",
  "please",
  "plz",
  "làm ơn",
  "lam on",
  "nhờ bạn",
  "nho ban",
  "bạn ơi",
  "ban oi",
  "bro",
];

const TRAILING_FILLERS = [
  "được không",
  "duoc khong",
  "đc không",
  "dc khong",
  "đi",
  "nha",
  "nhé",
  "nhe",
  "nhá",
  "nhá",
  "giúp mình nhé",
  "giup minh nhe",
  "giúp mình với",
  "giup minh voi",
  "please",
  "plz",
];

function stripBoundaryPhrases(input: string, phrases: string[]) {
  let output = input;

  for (const phrase of phrases) {
    const pattern = new RegExp(
      `^${escapeRegExp(phrase)}\\s+|\\s+${escapeRegExp(phrase)}$`,
      "g",
    );

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
  normalized = stripBoundaryPhrases(normalized, LEADING_FILLERS);
  normalized = stripBoundaryPhrases(normalized, TRAILING_FILLERS);
  normalized = normalized.replace(/\s+/g, " ").trim();

  return normalized;
}

export async function findExactCachedAnswer(input: {
  userId: string;
  documentId: string;
  question: string;
}): Promise<QACacheRow | null> {
  const supabase = createSupabaseAdminClient();
  const normalizedQuestion = normalizeQuestion(input.question);

  const { data, error } = await supabase
    .from("qa_cache")
    .select("*")
    .eq("user_id", input.userId)
    .eq("document_id", input.documentId)
    .eq("normalized_question", normalizedQuestion)
    .maybeSingle();

  if (error) {
    throw new Error(error.message || "Could not load cached answer.");
  }

  if (!data) {
    return null;
  }

  return {
    ...(data as Omit<QACacheRow, "citations">),
    citations: parseCitations((data as { citations?: unknown }).citations),
  };
}

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
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: "user_id,document_id,normalized_question",
      },
    )
    .select()
    .single();

  if (error) {
    throw new Error(error.message || "Could not save cached answer.");
  }

  return {
    ...(data as Omit<QACacheRow, "citations">),
    citations: parseCitations((data as { citations?: unknown }).citations),
  };
}