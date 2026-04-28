import { createOpenAI } from "@ai-sdk/openai";
import { embed, type EmbeddingModel } from "ai";

function getAIApiKey() {
  const apiKey =
    process.env.OPENROUTER_API_KEY ?? process.env.OPENAI_API_KEY ?? "";

  if (!apiKey) {
    throw new Error("Missing OPENAI_API_KEY or OPENROUTER_API_KEY.");
  }

  return apiKey;
}

function createProvider() {
  const apiKey = getAIApiKey();

  if (apiKey.startsWith("sk-or-v1-")) {
    return createOpenAI({
      apiKey,
      baseURL: "https://openrouter.ai/api/v1",
      name: "openrouter",
    });
  }

  return createOpenAI({ apiKey });
}

export function getEmbeddingModel() {
  const provider = createProvider();
  const apiKey = getAIApiKey();

  if (apiKey.startsWith("sk-or-v1-")) {
    return provider.embedding("openai/text-embedding-3-small");
  }

  return provider.embedding("text-embedding-3-small");
}

export function getChatModel(hasImage = false) {
  const provider = createProvider();
  const apiKey = getAIApiKey();

  if (apiKey.startsWith("sk-or-v1-")) {
    // Use gpt-4o for image support, gpt-4o-mini for text-only
    return provider(hasImage ? "openai/gpt-4o" : "openai/gpt-4o-mini");
  }

  // Use gpt-4o for image support, gpt-4o-mini for text-only
  return provider(hasImage ? "gpt-4o" : "gpt-4o-mini");
}

/**
 * Batch embed multiple texts using parallel API calls.
 * OpenAI's embed endpoint supports up to 2048 inputs per request,
 * but the AI SDK's embed() only supports single values.
 * This function batches texts in groups and calls the API in parallel.
 */
export async function batchEmbed(
  texts: string[],
  options: {
    model?: string;
    batchSize?: number;
    concurrency?: number;
  } = {},
): Promise<number[][]> {
  const {
    model = "text-embedding-3-small",
    batchSize = 100,
    concurrency = 5,
  } = options;

  const provider = createProvider();
  const apiKey = getAIApiKey();
  const isOpenRouter = apiKey.startsWith("sk-or-v1-");

  // Split texts into batches
  const batches: string[][] = [];
  for (let i = 0; i < texts.length; i += batchSize) {
    batches.push(texts.slice(i, i + batchSize));
  }

  // Process batches with concurrency limit
  const results: number[][] = [];
  for (let i = 0; i < batches.length; i += concurrency) {
    const concurrentBatches = batches.slice(i, i + concurrency);
    const batchResults = await Promise.all(
      concurrentBatches.map(async (batch) => {
        const baseURL = isOpenRouter
          ? "https://openrouter.ai/api/v1"
          : "https://api.openai.com/v1";

        const response = await fetch(`${baseURL}/embeddings`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            input: batch,
            model,
          }),
        });

        if (!response.ok) {
          const error = await response.text();
          throw new Error(`Embedding API error: ${response.status} - ${error}`);
        }

        const data = (await response.json()) as {
          data: Array<{ embedding: number[] }>;
        };

        return data.data.map((d) => d.embedding);
      }),
    );

    for (const batchResult of batchResults) {
      results.push(...batchResult);
    }
  }

  return results;
}
