/**
 * Job Extraction Activities
 * Activities for extracting structured job data using AI and saving embeddings
 */

import { JobService } from '@acme/api/services/job.service';
import { JobExtractionService } from '@acme/api/services/job-extraction.service';
import { aiService } from '@acme/api/services/ai.service';
import { embeddingService } from '@acme/api/services/embedding.service';
import { Logger } from '@acme/shared/Logger';
import type { JobExtractionResult } from '@acme/api/schemas/job-extraction';
import type { InputJsonValue } from '@acme/db';

const logger = new Logger('JobExtractionActivity');

export interface ExtractJobDataInput {
  jobId: string;
  jobText: string;
  jobTitle?: string;
  companyName?: string;
}

export interface ExtractJobDataOutput {
  success: boolean;
  extractionResult?: JobExtractionResult;
  costMetadata?: unknown; // Cost metadata from extraction
  error?: string;
}

/**
 * Extract structured job data using AI
 */
export async function extractJobDataWithAI(
  input: ExtractJobDataInput
): Promise<ExtractJobDataOutput> {
  try {
    logger.info('Extracting job data with AI', {
      jobId: input.jobId,
      jobTitle: input.jobTitle,
      companyName: input.companyName,
    });

    // Get job data if title/company not provided
    let jobTitle = input.jobTitle;
    let companyName = input.companyName;

    if (!jobTitle || !companyName) {
      const job = await JobService.findById(input.jobId);

      if (!job) {
        throw new Error(`Job not found: ${input.jobId}`);
      }

      jobTitle = jobTitle || job.title;
      companyName = companyName || job.company;
    }

    const result = await aiService.extractJobData({
      jobText: input.jobText,
      jobTitle,
      companyName,
    });

    logger.info('Job data extracted successfully', {
      jobId: input.jobId,
      hasRequirements: !!result.result.requirements?.length,
      hasSkills: !!result.result.skills?.length,
      cost: result.costMetadata?.cost?.totalCost,
    });

    return {
      success: true,
      extractionResult: result.result,
      costMetadata: result.costMetadata,
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';
    logger.error('Failed to extract job data with AI', {
      jobId: input.jobId,
      error: errorMessage,
    });

    return {
      success: false,
      error: errorMessage,
    };
  }
}

export interface GenerateStructuredEmbeddingInput {
  extractionResult: JobExtractionResult;
}

export interface GenerateStructuredEmbeddingOutput {
  success: boolean;
  embedding?: number[];
  costMetadata?: unknown; // Cost metadata from embedding
  error?: string;
}

/**
 * Generate embedding from structured extraction data
 */
export async function generateStructuredEmbedding(
  input: GenerateStructuredEmbeddingInput
): Promise<GenerateStructuredEmbeddingOutput> {
  try {
    logger.info('Generating structured embedding from extraction data');

    const result = await embeddingService.embedStructuredData(
      input.extractionResult
    );

    logger.info('Structured embedding generated successfully', {
      embeddingLength: result.embedding.length,
      cost: result.costMetadata?.cost?.totalCost,
    });

    return {
      success: true,
      embedding: result.embedding,
      costMetadata: result.costMetadata,
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';
    logger.warn('Failed to generate structured embedding', {
      error: errorMessage,
    });

    // Don't fail the workflow if structured embedding fails - it's optional
    return {
      success: false,
      error: errorMessage,
    };
  }
}

export interface SaveJobExtractionInput {
  jobId: string;
  extractionResult: JobExtractionResult;
  structuredEmbedding?: number[];
  extractionCostMetadata?: unknown; // Cost metadata from extraction
  embeddingCostMetadata?: unknown; // Cost metadata from embedding
}

export interface SaveJobExtractionOutput {
  success: boolean;
  extractionId?: string;
  error?: string;
}

/**
 * Save job extraction and structured embedding to database
 */
export async function saveJobExtraction(
  input: SaveJobExtractionInput
): Promise<SaveJobExtractionOutput> {
  try {
    logger.info('Saving job extraction to database', {
      jobId: input.jobId,
      hasStructuredEmbedding: !!input.structuredEmbedding,
    });

    // Combine cost metadata (extraction + embedding if available)
    const combinedMetadata: Record<string, unknown> = {};
    if (input.extractionCostMetadata) {
      combinedMetadata.extraction = input.extractionCostMetadata;
    }
    if (input.embeddingCostMetadata) {
      combinedMetadata.embedding = input.embeddingCostMetadata;
    }

    // Save extraction to database using service
    const extraction = await JobExtractionService.createWithEmbedding(
      {
        jobId: input.jobId,
        extractionResult: input.extractionResult,
        extractionModel: 'gemini-2.0-flash-exp',
        extractionSource: 'gemini',
        metadata:
          Object.keys(combinedMetadata).length > 0
            ? (combinedMetadata as InputJsonValue)
            : undefined,
      },
      input.structuredEmbedding
    );

    logger.info('Job extraction saved successfully', {
      extractionId: extraction.id,
    });

    return {
      success: true,
      extractionId: extraction.id,
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';
    logger.error('Failed to save job extraction', {
      jobId: input.jobId,
      error: errorMessage,
    });

    return {
      success: false,
      error: errorMessage,
    };
  }
}
