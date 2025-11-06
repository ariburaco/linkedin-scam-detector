/**
 * LLM Cost Calculator
 * Calculates costs based on token usage for different models
 */

// Pricing per 1M tokens (as of 2024)
// Source: Google Cloud Pricing
const PRICING = {
  // Gemini 2.0 Flash (Experimental)
  "gemini-2.0-flash-exp": {
    input: 0.075, // $0.075 per 1M input tokens
    output: 0.3, // $0.30 per 1M output tokens
  },
  // Text Embedding 004
  "text-embedding-004": {
    input: 0.075, // $0.075 per 1M tokens (no output tokens for embeddings)
    output: 0,
  },
  // Default fallback pricing (Gemini 1.5 Flash)
  default: {
    input: 0.075,
    output: 0.3,
  },
} as const;

export interface UsageData {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
}

export interface CostMetadata {
  model: string;
  operation: string; // e.g., "scam-analysis", "job-extraction", "embedding"
  usage: UsageData;
  cost: {
    inputCost: number; // Cost for input tokens in USD
    outputCost: number; // Cost for output tokens in USD
    totalCost: number; // Total cost in USD
  };
  timestamp: string; // ISO timestamp
}

/**
 * Calculate cost based on model and token usage
 */
export function calculateCost(
  model: string,
  usage: UsageData,
  operation: string
): CostMetadata {
  // Get pricing for model, fallback to default
  const pricing = PRICING[model as keyof typeof PRICING] || PRICING.default;

  const inputTokens = usage.promptTokens || usage.totalTokens || 0;
  const outputTokens = usage.completionTokens || 0;

  // Calculate costs (per million tokens)
  const inputCost = (inputTokens / 1_000_000) * pricing.input;
  const outputCost = (outputTokens / 1_000_000) * pricing.output;
  const totalCost = inputCost + outputCost;

  return {
    model,
    operation,
    usage: {
      promptTokens: inputTokens,
      completionTokens: outputTokens,
      totalTokens: usage.totalTokens || inputTokens + outputTokens,
    },
    cost: {
      inputCost: parseFloat(inputCost.toFixed(8)), // Round to 8 decimal places
      outputCost: parseFloat(outputCost.toFixed(8)),
      totalCost: parseFloat(totalCost.toFixed(8)),
    },
    timestamp: new Date().toISOString(),
  };
}

/**
 * Extract usage data from Vercel AI SDK response
 * The response object should have a `usage` property with token counts
 */
export function extractUsageFromResponse(response: {
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
}): UsageData {
  if (!response.usage) {
    return {};
  }

  return {
    promptTokens: response.usage.promptTokens,
    completionTokens: response.usage.completionTokens,
    totalTokens: response.usage.totalTokens,
  };
}

/**
 * Extract usage data from Vercel AI SDK embed response
 * Embed responses have a different usage structure (EmbeddingModelUsage)
 * The usage structure can vary, so we handle it flexibly
 */
export function extractEmbeddingUsageFromResponse(response: {
  usage?: unknown;
}): UsageData {
  if (!response.usage || typeof response.usage !== "object") {
    return {};
  }

  const usage = response.usage as Record<string, unknown>;

  // Handle different possible usage structures
  // EmbeddingModelUsage might have: inputTokens, outputTokens, or totalTokens
  // Some models might use: promptTokens, completionTokens, totalTokens
  const inputTokens =
    (typeof usage.inputTokens === "number" ? usage.inputTokens : undefined) ??
    (typeof usage.promptTokens === "number" ? usage.promptTokens : undefined) ??
    (typeof usage.totalTokens === "number" ? usage.totalTokens : undefined) ??
    0;

  const totalTokens =
    (typeof usage.totalTokens === "number" ? usage.totalTokens : undefined) ??
    inputTokens;

  // For embeddings, inputTokens maps to promptTokens
  // There are no completion tokens for embeddings
  return {
    promptTokens: inputTokens,
    completionTokens: 0,
    totalTokens,
  };
}
