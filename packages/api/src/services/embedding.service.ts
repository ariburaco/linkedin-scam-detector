import { google } from "@ai-sdk/google";
import { embed } from "ai";

export interface EmbeddingOptions {
  text: string;
  model?: string;
}

/**
 * Embedding Service for generating vector embeddings
 * Uses Google Gemini Embedding API (text-embedding-004) via Vercel AI SDK
 */
export class EmbeddingService {
  private readonly defaultModel: ReturnType<typeof google.textEmbedding>;
  private readonly maxRetries: number;
  private readonly retryDelay: number;

  constructor() {
    // Use text-embedding-004 model (768 dimensions) via Vercel AI SDK
    this.defaultModel = google.textEmbedding("text-embedding-004");

    // Retry configuration
    this.maxRetries = 3;
    this.retryDelay = 1000; // 1 second
  }

  /**
   * Generate embedding for a single text
   */
  async embedText(options: EmbeddingOptions): Promise<number[]> {
    const { text, model } = options;

    if (!text || text.trim().length === 0) {
      throw new Error("Text cannot be empty");
    }

    // Use the specified model or default
    const embeddingModel = model
      ? google.textEmbedding(model)
      : this.defaultModel;

    let lastError: Error | null = null;

    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        // Use Vercel AI SDK's embed function
        const result = await embed({
          model: embeddingModel,
          value: text,
        });

        const embedding = result.embedding;

        if (!embedding || !Array.isArray(embedding) || embedding.length === 0) {
          throw new Error(
            "Failed to generate embedding: empty or invalid response"
          );
        }

        return embedding;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // Log error for debugging
        console.error(
          `[EmbeddingService] Attempt ${attempt + 1} failed:`,
          lastError.message
        );

        // Don't retry on certain errors
        if (this.shouldNotRetry(lastError)) {
          throw lastError;
        }

        // Wait before retrying (exponential backoff)
        if (attempt < this.maxRetries - 1) {
          await this.delay(this.retryDelay * Math.pow(2, attempt));
        }
      }
    }

    // If all retries failed, throw the last error
    throw new Error(
      `Failed to generate embedding after ${this.maxRetries} attempts: ${lastError?.message}`
    );
  }

  /**
   * Generate embeddings for multiple texts (batch)
   */
  async embedTexts(texts: string[]): Promise<number[][]> {
    // Process in parallel with a reasonable concurrency limit
    const batchSize = 10;
    const results: number[][] = [];

    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map((text) => this.embedText({ text }))
      );
      results.push(...batchResults);
    }

    return results;
  }

  /**
   * Generate embedding for job data (title + company + description)
   */
  async embedJob(job: {
    title: string;
    company: string;
    description: string;
  }): Promise<number[]> {
    // Combine title, company, and description for embedding
    const combinedText = `${job.title} at ${job.company}\n\n${job.description}`;

    // Truncate to reasonable length (embedding models have token limits)
    // Gemini embedding-004 supports up to ~8000 tokens, roughly 32k characters
    const maxLength = 30000;
    const truncatedText =
      combinedText.length > maxLength
        ? combinedText.substring(0, maxLength) + "..."
        : combinedText;

    return this.embedText({ text: truncatedText });
  }

  /**
   * Generate embedding from structured job extraction data
   */
  async embedStructuredData(extraction: {
    requirements?: Array<{ type: string; name: string }>;
    skills?: Array<{ name: string; category?: string }>;
    qualifications?: Array<{ type: string; value: string }>;
    experienceLevel?: string;
    educationLevel?: string;
    workType?: string;
    workSchedule?: string;
  }): Promise<number[]> {
    // Format structured data as text for embedding
    const parts: string[] = [];

    if (extraction.skills && extraction.skills.length > 0) {
      const skillsList = extraction.skills.map((s) => s.name).join(", ");
      parts.push(`Skills: ${skillsList}`);
    }

    if (extraction.requirements && extraction.requirements.length > 0) {
      const requirementsList = extraction.requirements
        .map((r) => `${r.type}: ${r.name}`)
        .join(". ");
      parts.push(`Requirements: ${requirementsList}`);
    }

    if (extraction.qualifications && extraction.qualifications.length > 0) {
      const qualificationsList = extraction.qualifications
        .map((q) => `${q.type}: ${q.value}`)
        .join(". ");
      parts.push(`Qualifications: ${qualificationsList}`);
    }

    if (extraction.experienceLevel) {
      parts.push(`Experience Level: ${extraction.experienceLevel}`);
    }

    if (extraction.educationLevel) {
      parts.push(`Education: ${extraction.educationLevel}`);
    }

    if (extraction.workType) {
      parts.push(`Work Type: ${extraction.workType}`);
    }

    if (extraction.workSchedule) {
      parts.push(`Schedule: ${extraction.workSchedule}`);
    }

    const structuredText = parts.join(". ");

    if (!structuredText || structuredText.trim().length === 0) {
      throw new Error("No structured data provided for embedding");
    }

    return this.embedText({ text: structuredText });
  }

  /**
   * Determine if an error should not be retried
   */
  private shouldNotRetry(error: Error): boolean {
    const errorMessage = error.message.toLowerCase();

    // Don't retry on authentication errors
    if (
      errorMessage.includes("api key") ||
      errorMessage.includes("unauthorized") ||
      errorMessage.includes("permission")
    ) {
      return true;
    }

    // Don't retry on invalid input
    if (errorMessage.includes("invalid") && errorMessage.includes("input")) {
      return true;
    }

    return false;
  }

  /**
   * Delay helper for retries
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// Export singleton instance
export const embeddingService = new EmbeddingService();
