import { google } from "@ai-sdk/google";
import { generateObject } from "ai";

import { buildJobExtractionPrompt } from "../prompts/job-extraction";
import {
  buildFallbackPrompt,
  buildScamDetectionPrompt,
} from "../prompts/scam-detection";
import {
  jobExtractionSchema,
  type JobExtractionResult,
} from "../schemas/job-extraction";
import {
  scamAnalysisSchema,
  type ScamAnalysisResult,
} from "../schemas/scam-analysis";
import {
  calculateCost,
  extractUsageFromResponse,
  type CostMetadata,
} from "../utils/llm-cost-calculator";

export interface AnalyzeJobOptions {
  jobText: string;
  jobTitle?: string;
  companyName?: string;
  jobUrl?: string;
}

export interface AnalyzeJobResult {
  result: ScamAnalysisResult;
  costMetadata: CostMetadata | null;
}

export interface ExtractJobDataResult {
  result: JobExtractionResult;
  costMetadata: CostMetadata | null;
}

/**
 * AI Service for scam detection using Gemini 2.0 Flash
 * Provides a clean, class-based interface for AI operations
 */
export class AIService {
  private readonly model: ReturnType<typeof google>;
  private readonly maxRetries: number;
  private readonly retryDelay: number;

  constructor() {
    // Initialize Gemini 2.0 Flash model
    this.model = google("gemini-2.0-flash-exp");

    // Retry configuration
    this.maxRetries = 3;
    this.retryDelay = 1000; // 1 second
  }

  /**
   * Analyze a job posting for scam indicators
   */
  async analyzeJob(options: AnalyzeJobOptions): Promise<AnalyzeJobResult> {
    const { jobText, jobTitle, companyName } = options;

    // Use centralized prompt builder
    const prompt = buildScamDetectionPrompt({
      jobText,
      jobTitle,
      companyName,
    });

    // Retry logic for API calls
    let lastError: Error | null = null;
    let useFallbackPrompt = false;

    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        // Use fallback prompt on retries after first attempt
        const currentPrompt = useFallbackPrompt
          ? buildFallbackPrompt({ jobText, jobTitle, companyName })
          : prompt;

        const result = await generateObject({
          model: this.model,
          schema: scamAnalysisSchema,
          prompt: currentPrompt,
          temperature: 0.3, // Lower temperature for more consistent results
          maxOutputTokens: 2000, // AI SDK v5 uses maxOutputTokens instead of maxTokens
        });

        // Extract usage and calculate cost
        const usage = extractUsageFromResponse(result);
        const costMetadata = calculateCost(
          "gemini-2.0-flash-exp",
          usage,
          "scam-analysis"
        );

        return {
          result: result.object,
          costMetadata,
        };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // Log error for debugging
        console.error(
          `[AIService] Attempt ${attempt + 1} failed:`,
          lastError.message
        );

        // Don't retry on certain errors (e.g., invalid API key, rate limit exceeded)
        if (this.shouldNotRetry(lastError)) {
          throw lastError;
        }

        // Use fallback prompt on next retry
        if (attempt === 0) {
          useFallbackPrompt = true;
        }

        // Wait before retrying (exponential backoff)
        if (attempt < this.maxRetries - 1) {
          await this.delay(this.retryDelay * Math.pow(2, attempt));
        }
      }
    }

    // If all retries failed, throw the last error
    throw new Error(
      `Failed to analyze job after ${this.maxRetries} attempts: ${lastError?.message}`
    );
  }

  /**
   * Determine if an error should not be retried
   */
  private shouldNotRetry(error: Error): boolean {
    const errorMessage = error.message.toLowerCase();

    // Don't retry on authentication errors
    if (
      errorMessage.includes("api key") ||
      errorMessage.includes("unauthorized")
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
   * Extract structured job data from job posting
   * This extracts requirements, responsibilities, benefits, skills, etc.
   */
  async extractJobData(
    options: AnalyzeJobOptions
  ): Promise<ExtractJobDataResult> {
    const { jobText, jobTitle, companyName } = options;

    // Use job extraction prompt
    const prompt = buildJobExtractionPrompt({
      jobText,
      jobTitle,
      companyName,
    });

    // Retry logic for API calls
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        const result = await generateObject({
          model: this.model,
          schema: jobExtractionSchema,
          prompt,
          temperature: 0.2, // Lower temperature for more consistent extraction
          maxOutputTokens: 3000, // More tokens for detailed extraction
        });

        // Extract usage and calculate cost
        const usage = extractUsageFromResponse(result);
        const costMetadata = calculateCost(
          "gemini-2.0-flash-exp",
          usage,
          "job-extraction"
        );

        return {
          result: result.object,
          costMetadata,
        };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // Log error for debugging
        console.error(
          `[AIService] Extraction attempt ${attempt + 1} failed:`,
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
      `Failed to extract job data after ${this.maxRetries} attempts: ${lastError?.message}`
    );
  }

  /**
   * Delay helper for retries
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// Export singleton instance
export const aiService = new AIService();
