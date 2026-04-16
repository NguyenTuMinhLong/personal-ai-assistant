import { createOpenAI } from "@ai-sdk/openai";

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

export function getChatModel() {
  const provider = createProvider();
  const apiKey = getAIApiKey();

  if (apiKey.startsWith("sk-or-v1-")) {
    return provider("openai/gpt-4o-mini");
  }

  return provider("gpt-4o-mini");
}
