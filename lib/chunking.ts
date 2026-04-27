/**
 * Semantic Text Chunking Library
 *
 * Splits text by sentence/paragraph boundaries instead of fixed size,
 * preserving semantic coherence. Each chunk includes extracted metadata
 * like title, section, page number, and chunk type.
 */

export type ChunkMetadata = {
  title?: string;
  section?: string;
  pageNumber?: number;
  chunkType: "paragraph" | "sentence" | "fixed";
};

export type Chunk = {
  content: string;
  metadata: ChunkMetadata;
};

type SemanticChunkOptions = {
  maxChunkTokens?: number;
  overlapTokens?: number;
  minChunkLength?: number;
  filename?: string;
  chunkType?: "document" | "file";
};

const DEFAULT_MAX_CHUNK_TOKENS = 512;
const DEFAULT_OVERLAP_TOKENS = 64;
const DEFAULT_MIN_CHUNK_LENGTH = 50;
const CHARS_PER_TOKEN = 4;

function countTokens(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

function splitByParagraphs(text: string): string[] {
  return text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
}

function splitIntoSentences(text: string): string[] {
  const sentenceEnders = /([.!?]+[\s]+)/;
  const sentences: string[] = [];
  let current = "";

  const parts = text.split(sentenceEnders);
  for (let i = 0; i < parts.length; i += 2) {
    const part = parts[i] ?? "";
    const delimiter = parts[i + 1] ?? "";
    current += part + delimiter;
    if (delimiter && i + 1 < parts.length) {
      const trimmed = current.trim();
      if (trimmed.length > 0) {
        sentences.push(trimmed);
      }
      current = "";
    }
  }

  const remaining = current.trim();
  if (remaining.length > 0) {
    sentences.push(remaining);
  }

  return sentences.filter((s) => s.trim().length > 0);
}

function mergeIntoTokenLimit(
  sentences: string[],
  maxTokens: number,
  overlapTokens: number,
  minLength: number,
): string[] {
  if (sentences.length === 0) return [];

  const chunks: string[] = [];
  let currentChunk: string[] = [];
  let currentTokens = 0;

  const overlapChars = overlapTokens * CHARS_PER_TOKEN;

  for (const sentence of sentences) {
    const sentenceTokens = countTokens(sentence);

    if (currentTokens + sentenceTokens > maxTokens && currentChunk.length > 0) {
      const chunkText = currentChunk.join(" ");
      if (chunkText.length >= minLength) {
        chunks.push(chunkText);
      }

      if (overlapChars > 0 && chunks.length > 0) {
        const lastChunk = chunks[chunks.length - 1];
        const overlapText = lastChunk.slice(-overlapChars);
        currentChunk = [overlapText, sentence];
        currentTokens = countTokens(overlapText) + sentenceTokens;
      } else {
        currentChunk = [sentence];
        currentTokens = sentenceTokens;
      }
    } else {
      currentChunk.push(sentence);
      currentTokens += sentenceTokens;
    }
  }

  const remainingText = currentChunk.join(" ");
  if (remainingText.length >= minLength) {
    chunks.push(remainingText);
  }

  return chunks;
}

function extractTitleFromFilename(filename?: string): string | undefined {
  if (!filename) return undefined;
  const withoutExt = filename.replace(/\.[^/.]+$/, "");
  const cleaned = withoutExt.replace(/[-_]/g, " ").replace(/[0-9]+/g, "").trim();
  return cleaned.length > 2 ? cleaned : undefined;
}

function detectSection(text: string): string | undefined {
  const sectionMatch = text.match(/^(#{1,3}\s+(.+?)(?:\n|$)|([A-Z][A-Z\s]{2,20})(?:\n|$))/) ?? [];
  const heading = sectionMatch[2] ?? sectionMatch[3];
  if (heading) {
    const trimmed = heading.trim().replace(/^#+\s*/, "");
    return trimmed.length > 2 && trimmed.length < 100 ? trimmed : undefined;
  }
  return undefined;
}

function detectPageNumber(text: string): number | undefined {
  const pageMatch = text.match(/(?:page|trang|p\.?)\s*(\d+)/i) ?? [];
  const pageNum = parseInt(pageMatch[1] ?? "", 10);
  return isNaN(pageNum) ? undefined : pageNum;
}

function determineChunkType(paragraphs: string[], sentences: string[]): "paragraph" | "sentence" | "fixed" {
  if (paragraphs.length >= 2 && sentences.length > paragraphs.length * 2) {
    return "sentence";
  }
  if (paragraphs.length >= 2) {
    return "paragraph";
  }
  return "fixed";
}

/**
 * Split text into semantically coherent chunks respecting sentence boundaries.
 */
export function semanticChunk(text: string, options: SemanticChunkOptions = {}): { chunks: Chunk[] } {
  const {
    maxChunkTokens = DEFAULT_MAX_CHUNK_TOKENS,
    overlapTokens = DEFAULT_OVERLAP_TOKENS,
    minChunkLength = DEFAULT_MIN_CHUNK_LENGTH,
    filename,
    chunkType: chunkTypeOption = "document",
  } = options;

  if (!text || text.trim().length === 0) {
    return { chunks: [] };
  }

  const cleaned = text.trim();
  const paragraphs = splitByParagraphs(cleaned);
  const sentences = splitIntoSentences(cleaned);

  const chunkType = determineChunkType(paragraphs, sentences);
  const title = extractTitleFromFilename(filename);

  let rawChunks: string[];
  if (paragraphs.length <= 3 && sentences.length <= 5) {
    rawChunks = [cleaned];
  } else if (paragraphs.length >= 3) {
    const paragraphTokens = paragraphs.map((p) => countTokens(p));
    const targetChunkTokens = maxChunkTokens - overlapTokens;
    let currentGroup: string[] = [];
    let currentTokens = 0;
    const chunks: string[] = [];

    for (let i = 0; i < paragraphs.length; i++) {
      const pTokens = paragraphTokens[i];

      if (currentTokens + pTokens > targetChunkTokens && currentGroup.length > 0) {
        chunks.push(currentGroup.join("\n\n"));
        const overlapChars = overlapTokens * CHARS_PER_TOKEN;
        if (overlapChars > 0 && chunks.length > 0) {
          const lastChunk = chunks[chunks.length - 1];
          const overlapText = lastChunk.slice(-overlapChars);
          currentGroup = [overlapText, paragraphs[i]];
          currentTokens = countTokens(overlapText) + pTokens;
        } else {
          currentGroup = [paragraphs[i]];
          currentTokens = pTokens;
        }
      } else {
        currentGroup.push(paragraphs[i]);
        currentTokens += pTokens;
      }
    }

    const remaining = currentGroup.join("\n\n");
    if (remaining.length >= minChunkLength) {
      chunks.push(remaining);
    }

    rawChunks = chunks;
  } else {
    rawChunks = mergeIntoTokenLimit(sentences, maxChunkTokens, overlapTokens, minChunkLength);
  }

  const chunks: Chunk[] = rawChunks
    .filter((c) => c.length >= minChunkLength)
    .map((content) => {
      const section = detectSection(content);
      const pageNumber = detectPageNumber(content);

      return {
        content,
        metadata: {
          title,
          section,
          pageNumber,
          chunkType,
        },
      };
    });

  return { chunks };
}

/**
 * Legacy wrapper for backward compatibility with existing fixed-size chunking.
 * Wraps semantic chunking results into the flat content array format.
 */
export function chunkText(text: string, options: SemanticChunkOptions = {}): { chunks: string[] } {
  const { chunks } = semanticChunk(text, options);
  return { chunks: chunks.map((c) => c.content) };
}
