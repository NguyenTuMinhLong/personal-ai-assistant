/**
 * Context Builder Library
 *
 * Builds optimized, compressed prompts from search results.
 * Preserves sentence boundaries and includes rich metadata in citations.
 */

import type { ChunkMetadata, SearchResult } from "@/types";

export type Citation = {
  index: number;
  snippet: string;
  metadata?: ChunkMetadata;
  source?: "document" | "file";
};

type BuildContextOptions = {
  maxChars?: number;
  includeMetadata?: boolean;
  compressMode?: "none" | "smart_truncate";
};

const DEFAULT_MAX_CHARS = 3000;
const DEFAULT_COMPRESS_MODE: BuildContextOptions["compressMode"] = "smart_truncate";
const MIN_CHUNK_CHARS = 50;

// ─── Sentence extraction ───────────────────────────────────────────
function extractSentences(text: string): { sentence: string; start: number; end: number }[] {
  if (!text || !text.trim()) return [];

  const result: { sentence: string; start: number; end: number }[] = [];
  const sentenceEnders = /([.!?]+\s+|\n+)/;
  let current = "";
  let start = 0;

  const parts = text.split(sentenceEnders);
  for (let i = 0; i < parts.length; i += 2) {
    const part = parts[i] ?? "";
    const delimiter = parts[i + 1] ?? "";
    const sentence = (current + part + delimiter).trim();
    if (delimiter) {
      if (sentence.length > 0) {
        result.push({ sentence, start, end: start + sentence.length });
      }
      current = "";
      start += sentence.length;
    } else {
      current += part;
    }
  }

  if (current.trim().length > 0) {
    const trimmed = current.trim();
    result.push({ sentence: trimmed, start, end: start + trimmed.length });
  }

  return result;
}

// ─── Sentence scoring ─────────────────────────────────────────────
const STOP_WORDS = new Set([
  "the", "a", "an", "is", "are", "was", "were", "be", "been", "being",
  "have", "has", "had", "do", "does", "did", "will", "would", "could",
  "should", "may", "might", "must", "shall", "can", "need", "dare",
  "ought", "used", "to", "of", "in", "for", "on", "with", "at", "by",
  "from", "as", "into", "through", "during", "before", "after", "above",
  "below", "between", "under", "again", "further", "then", "once",
  "here", "there", "when", "where", "why", "how", "all", "each",
  "few", "more", "most", "other", "some", "such", "no", "nor", "not",
  "only", "own", "same", "so", "than", "too", "very", "just", "also",
  "and", "but", "or", "if", "because", "until", "while", "although",
  "this", "that", "these", "those", "it", "its", "i", "me", "my",
  "we", "our", "you", "your", "he", "she", "they", "them", "their",
  "what", "which", "who", "whom", "whose",
]);

function scoreSentence(sentence: string): number {
  if (sentence.length < MIN_CHUNK_CHARS) return 0;

  const words = sentence.toLowerCase().split(/\s+/);
  if (words.length < 3) return 0;

  const infoWords = words.filter((w) => !STOP_WORDS.has(w)).length;
  const density = infoWords / Math.max(words.length, 1);

  const hasNumbers = /\d/.test(sentence);
  const hasQuoted = /["']/.test(sentence);
  const hasProperNoun = /^[A-Z][a-z]+/.test(sentence);
  const isTableLike = /^\|.+\|$/m.test(sentence);
  const isListLike = /^[-*]\s/m.test(sentence) || /^\d+\.\s/m.test(sentence);

  let score = density * 10;
  if (hasNumbers) score += 1.5;
  if (hasQuoted) score += 1;
  if (hasProperNoun) score += 0.5;
  if (isTableLike) score += 2;
  if (isListLike) score += 0.5;

  return score;
}

// ─── Smart truncate ───────────────────────────────────────────────
function smartTruncate(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;

  const sentences = extractSentences(text);
  if (sentences.length === 0) {
    return text.slice(0, maxChars);
  }

  if (sentences.length <= 2) {
    const truncated = text.slice(0, maxChars);
    const lastPeriod = truncated.lastIndexOf(".");
    const lastNewline = truncated.lastIndexOf("\n");
    const cutAt = Math.max(lastPeriod, lastNewline);
    return cutAt > maxChars * 0.5 ? truncated.slice(0, cutAt + 1) : truncated;
  }

  const scored = sentences.map((s) => ({
    ...s,
    score: scoreSentence(s.sentence),
  }));

  scored.sort((a, b) => b.score - a.score);

  const keepCount = Math.max(2, Math.ceil(sentences.length * 0.7));
  const topSentences = scored.slice(0, keepCount);
  topSentences.sort((a, b) => a.start - b.start);

  let result = "";
  for (const s of topSentences) {
    const candidate = result ? `${result}\n\n${s.sentence}` : s.sentence;
    if (candidate.length > maxChars) break;
    result = candidate;
  }

  if (!result) {
    return text.slice(0, maxChars);
  }

  return result;
}

// ─── Chunk formatter ───────────────────────────────────────────────
function formatChunkForContext(
  chunk: SearchResult,
  index: number,
  options: BuildContextOptions,
): { text: string; citation: Citation } {
  const maxChars = options.maxChars ?? DEFAULT_MAX_CHARS;
  let content = chunk.content;

  if (options.compressMode === "smart_truncate") {
    const perChunkBudget = Math.floor(maxChars / 3);
    if (content.length > perChunkBudget) {
      content = smartTruncate(content, perChunkBudget);
    }
  }

  const prefix = `[${index}]`;
  const meta = options.includeMetadata !== false && chunk.metadata
    ? (() => {
      const parts: string[] = [];
      if (chunk.metadata.title) parts.push(chunk.metadata.title);
      if (chunk.metadata.section) parts.push(chunk.metadata.section);
      if (chunk.metadata.pageNumber !== undefined) parts.push(`p.${chunk.metadata.pageNumber}`);
      return parts.length > 0 ? ` (${parts.join(" / ")})` : "";
    })()
    : "";

  const sourceTag = chunk.source === "file" ? " [file]" : "";

  return {
    text: `${prefix}${meta}${sourceTag} ${content}`,
    citation: {
      index,
      snippet: content.slice(0, 280),
      metadata: chunk.metadata,
      source: chunk.source,
    },
  };
}

// ─── Main builder ─────────────────────────────────────────────────
export function buildContext(
  chunks: SearchResult[],
  options: BuildContextOptions = {},
): { context: string; citations: Citation[] } {
  const {
    maxChars = DEFAULT_MAX_CHARS,
    includeMetadata = true,
    compressMode = DEFAULT_COMPRESS_MODE,
  } = options;

  if (!chunks || chunks.length === 0) {
    return { context: "", citations: [] };
  }

  const resolvedOptions = { maxChars, includeMetadata, compressMode };
  const chunkTexts: string[] = [];
  const citations: Citation[] = [];
  let usedChars = 0;

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const { text, citation } = formatChunkForContext(chunk, i + 1, resolvedOptions);
    const withSeparator = i > 0 ? "\n\n" : "";

    if (usedChars + withSeparator.length + text.length > maxChars) {
      break;
    }

    chunkTexts.push(withSeparator + text);
    citations.push(citation);
    usedChars += withSeparator.length + text.length;
  }

  return {
    context: chunkTexts.join(""),
    citations,
  };
}

export function buildSimpleContext(
  chunks: SearchResult[],
  maxChars = 3000,
): string {
  const { context } = buildContext(chunks, { maxChars, compressMode: "none" });
  return context;
}
