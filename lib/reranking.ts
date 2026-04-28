/**
 * Cross-Encoder Reranking Library
 *
 * Uses a cross-encoder model to re-score and rank search results.
 * Cross-encoders provide better relevance scores than bi-encoders (embedding models)
 * by jointly encoding the query-document pair.
 *
 * Supported providers: Jina AI (recommended), Cohere, OpenAI
 */

import type { SearchResult } from "@/types";

type RerankResult = SearchResult & {
  rerankScore: number;
};

type RerankerOptions = {
  model?: string;
  topK?: number;
  batchSize?: number;
};

const DEFAULT_RERANKER_MODEL = "jinaai/jina-reranker-v1-base-en";
const DEFAULT_TOP_K = 10;
const DEFAULT_BATCH_SIZE = 32;

function getRerankerConfig() {
  const apiKey = process.env.OPENROUTER_API_KEY ?? process.env.OPENAI_API_KEY ?? "";

  if (!apiKey) {
    return null;
  }

  const isOpenRouter = apiKey.startsWith("sk-or-v1-");

  return {
    apiKey,
    baseURL: isOpenRouter
      ? "https://openrouter.ai/api/v1"
      : "https://api.openai.com/v1",
  };
}

/**
 * Check if reranking is available (requires API key)
 */
export function isRerankerAvailable(): boolean {
  return getRerankerConfig() !== null;
}

/**
 * Rerank search results using a cross-encoder model.
 *
 * @param query - The search query
 * @param results - Initial search results (from hybrid search)
 * @param options - Reranking options
 * @returns Reranked results with relevance scores
 */
export async function rerankSearchResults(
  query: string,
  results: SearchResult[],
  options: RerankerOptions = {},
): Promise<RerankResult[]> {
  const {
    model = DEFAULT_RERANKER_MODEL,
    topK = DEFAULT_TOP_K,
    batchSize = DEFAULT_BATCH_SIZE,
  } = options;

  if (results.length === 0) {
    return [];
  }

  const config = getRerankerConfig();
  if (!config) {
    console.warn("[rerank] Reranker not available, returning original results");
    return results.map((r) => ({ ...r, rerankScore: r.score }));
  }

  try {
    // Process in batches to avoid token limits
    const allScores: number[] = [];

    for (let i = 0; i < results.length; i += batchSize) {
      const batch = results.slice(i, i + batchSize);

      // Call reranker API
      const response = await fetch(
        `${config.baseURL}/rerank`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${config.apiKey}`,
          },
          body: JSON.stringify({
            model,
            query,
            documents: batch.map((r) => r.content),
            top_n: batch.length,
            return_documents: false,
          }),
        },
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[rerank] API error: ${response.status} - ${errorText}`);
        // Fall back to original scores
        return results.map((r) => ({ ...r, rerankScore: r.score }));
      }

      const data = (await response.json()) as {
        results: Array<{ index: number; relevance_score: number }>;
      };

      for (const result of data.results) {
        allScores.push(result.relevance_score);
      }
    }

    // Combine rerank scores with original scores
    const reranked = results.map((result, idx) => ({
      ...result,
      rerankScore: allScores[idx] ?? result.score,
    }));

    // Sort by rerank score (descending)
    reranked.sort((a, b) => b.rerankScore - a.rerankScore);

    return reranked.slice(0, topK);
  } catch (error) {
    console.error("[rerank] Failed to rerank results:", error);
    // Return original results with original scores on error
    return results.map((r) => ({ ...r, rerankScore: r.score }));
  }
}

/**
 * Rerank with fusion: combines original scores with rerank scores.
 *
 * @param query - The search query
 * @param results - Initial search results
 * @param options - Reranking + fusion options
 * @returns Fused and reranked results
 */
export async function rerankWithFusion(
  query: string,
  results: SearchResult[],
  options: {
    topK?: number;
    fusionWeight?: number;
    rerankerOptions?: RerankerOptions;
  } = {},
): Promise<RerankResult[]> {
  const { topK = DEFAULT_TOP_K, fusionWeight = 0.5, rerankerOptions = {} } = options;

  if (results.length === 0) {
    return [];
  }

  // Normalize original scores to 0-1 range
  const maxScore = Math.max(...results.map((r) => r.score));
  const minScore = Math.min(...results.map((r) => r.score));
  const range = maxScore - minScore || 1;

  const normalizedResults = results.map((r) => ({
    ...r,
    normalizedScore: (r.score - minScore) / range,
  }));

  // Rerank
  const reranked = await rerankSearchResults(query, results, rerankerOptions);

  if (reranked.every((r) => r.rerankScore === r.score)) {
    // Reranker not available or failed, return normalized results
    return normalizedResults.map((r) => ({
      ...r,
      rerankScore: r.normalizedScore,
    })).slice(0, topK);
  }

  // Normalize rerank scores
  const maxRerank = Math.max(...reranked.map((r) => r.rerankScore));
  const minRerank = Math.min(...reranked.map((r) => r.rerankScore));
  const rerankRange = maxRerank - minRerank || 1;

  // Fuse scores
  const fusedResults = normalizedResults.map((r) => {
    const rerankResult = reranked.find(
      (rr) => rr.chunkIndex === r.chunkIndex && rr.source === r.source
    );
    const rerankScore = rerankResult
      ? (rerankResult.rerankScore - minRerank) / rerankRange
      : 0;

    return {
      ...r,
      rerankScore: (1 - fusionWeight) * r.normalizedScore + fusionWeight * rerankScore,
    };
  });

  // Sort by fused score
  fusedResults.sort((a, b) => b.rerankScore - a.rerankScore);

  return fusedResults.slice(0, topK);
}
