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

/**
 * Extract sentences from text, keeping track of character offsets.
 */
function extractSentences(text: string): { sentence: string; start: number; end: number }[] {
  const result: { sentence: string; start: number; end: number }[] = [];
  const sentenceEnders = /([.!?]+[\s\n]+)/;
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
    result.push({ sentence: current.trim(), start, end: start + current.trim().length });
  }

  return result;
}

/**
 * Score a sentence by its information density.
 */
function scoreSentence(sentence: string): number {
  if (sentence.length < 20) return 0;

  const words = sentence.toLowerCase().split(/\s+/);
  if (words.length < 3) return 0;

  const stopWords = new Set([
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
  ]);

  const wordSet = new Set(words);
  const infoWords = words.filter((w) => !stopWords.has(w)).length;
  const density = infoWords / words.length;

  const hasNumbers = /\d/.test(sentence);
  const hasQuoted = /["']/.test(sentence);
  const hasProperNoun = /^[A-Z][a-z]+/.test(sentence);

  let score = density * 10;
  if (hasNumbers) score += 1;
  if (hasQuoted) score += 1;
  if (hasProperNoun) score += 0.5;

  return score;
}

/**
 * Smart truncate: keep sentences with highest information density.
 */
function smartTruncate(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;

  const sentences = extractSentences(text);
  if (sentences.length <= 2) return text.slice(0, maxChars);

  const scored = sentences.map((s) => ({
    ...s,
    score: scoreSentence(s.sentence),
  }));

  scored.sort((a, b) => b.score - a.score);

  const topSentences = scored.slice(0, Math.ceil(sentences.length * 0.7));
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

/**
 * Build a formatted citation block from search results.
 */
function formatChunkForContext(chunk: SearchResult, index: number, options: BuildContextOptions): { text: string; citation: Citation } {
  let content = chunk.content;

  if (options.compressMode === "smart_truncate") {
    const maxPerChunk = Math.floor((options.maxChars ?? DEFAULT_MAX_CHARS) / (options.maxChars ?? DEFAULT_MAX_CHARS));
    content = smartTruncate(chunk.content, (options.maxChars ?? DEFAULT_MAX_CHARS) / 3);
  }

  const prefix = `[${index}]`;
  const meta = options.includeMetadata !== false && chunk.metadata
    ? (chunk.metadata.title || chunk.metadata.section
      ? ` (${[chunk.metadata.title, chunk.metadata.section].filter(Boolean).join(" / ")})`
      : "")
    : "";

  return {
    text: `${prefix}${meta} ${content}`,
    citation: {
      index,
      snippet: chunk.content.slice(0, 280),
      metadata: chunk.metadata,
      source: chunk.source,
    },
  };
}

/**
 * Build optimized context + citations from search results.
 */
export function buildContext(
  chunks: SearchResult[],
  options: BuildContextOptions = {},
): { context: string; citations: Citation[] } {
  const {
    maxChars = DEFAULT_MAX_CHARS,
    includeMetadata = true,
    compressMode = DEFAULT_COMPRESS_MODE,
  } = options;

  if (chunks.length === 0) {
    return { context: "", citations: [] };
  }

  const resolvedOptions = { maxChars, includeMetadata, compressMode };

  const chunkTexts: string[] = [];
  const citations: Citation[] = [];

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const { text, citation } = formatChunkForContext(chunk, i + 1, resolvedOptions);

    if ((chunkTexts.join("\n\n").length + text.length + 2) > maxChars) {
      break;
    }

    chunkTexts.push(text);
    citations.push(citation);
  }

  return {
    context: chunkTexts.join("\n\n"),
    citations,
  };
}

/**
 * Simple context builder for backward compatibility.
 */
export function buildSimpleContext(chunks: SearchResult[], maxChars = 3000): string {
  const { context } = buildContext(chunks, { maxChars, compressMode: "none" });
  return context;
}
