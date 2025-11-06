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
  extractionResult: JobExtractionResult;
  costMetadata?: unknown; // Cost metadata from extraction
}

/**
 * Extract structured job data using AI
 */
export async function extractJobDataWithAI(
  input: ExtractJobDataInput
): Promise<ExtractJobDataOutput> {
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
    extractionResult: result.result,
    costMetadata: result.costMetadata,
  };
}

export interface GenerateStructuredEmbeddingInput {
  extractionResult: JobExtractionResult;
}

export interface GenerateStructuredEmbeddingOutput {
  embedding: number[];
  costMetadata?: unknown; // Cost metadata from embedding
}

/**
 * Generate embedding from structured extraction data
 */
export async function generateStructuredEmbedding(
  input: GenerateStructuredEmbeddingInput
): Promise<GenerateStructuredEmbeddingOutput> {
  logger.info('Generating structured embedding from extraction data');

  const result = await embeddingService.embedStructuredData(
    input.extractionResult
  );

  logger.info('Structured embedding generated successfully', {
    embeddingLength: result.embedding.length,
    cost: result.costMetadata?.cost?.totalCost,
  });

  return {
    embedding: result.embedding,
    costMetadata: result.costMetadata,
  };
}

export interface SaveJobExtractionInput {
  jobId: string;
  extractionResult: JobExtractionResult;
  structuredEmbedding?: number[];
  extractionCostMetadata?: unknown; // Cost metadata from extraction
  embeddingCostMetadata?: unknown; // Cost metadata from embedding
}

export interface SaveJobExtractionOutput {
  extractionId: string;
}

/**
 * Save job extraction and structured embedding to database
 */
export async function saveJobExtraction(
  input: SaveJobExtractionInput
): Promise<SaveJobExtractionOutput> {
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
    extractionId: extraction.id,
  };
}
