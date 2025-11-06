/**
 * Job Embedding Activities
 * Activities for generating and saving job embeddings
 */

import { JobService } from '@acme/api/services/job.service';
import { embeddingService } from '@acme/api/services/embedding.service';
import { Logger } from '@acme/shared/Logger';

const logger = new Logger('JobEmbeddingActivity');

export interface GenerateJobEmbeddingInput {
  jobId: string;
  title: string;
  company: string;
  description: string;
}

export interface GenerateJobEmbeddingOutput {
  success: boolean;
  embedding?: number[];
  costMetadata?: unknown; // Cost metadata from embedding service
  error?: string;
}

/**
 * Generate embedding for a job
 */
export async function generateJobEmbedding(
  input: GenerateJobEmbeddingInput
): Promise<GenerateJobEmbeddingOutput> {
  try {
    logger.info('Generating job embedding', {
      jobId: input.jobId,
      title: input.title,
      company: input.company,
    });

    const result = await embeddingService.embedJob({
      title: input.title,
      company: input.company,
      description: input.description,
    });

    logger.info('Job embedding generated successfully', {
      jobId: input.jobId,
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
    logger.error('Failed to generate job embedding', {
      jobId: input.jobId,
      error: errorMessage,
    });

    return {
      success: false,
      error: errorMessage,
    };
  }
}

export interface SaveJobEmbeddingInput {
  jobId: string;
  embedding: number[];
  costMetadata?: unknown; // Cost metadata to store
}

export interface SaveJobEmbeddingOutput {
  success: boolean;
  error?: string;
}

/**
 * Save embedding to database using raw SQL (Prisma doesn't support vector type directly)
 */
export async function saveJobEmbedding(
  input: SaveJobEmbeddingInput
): Promise<SaveJobEmbeddingOutput> {
  try {
    logger.info('Saving job embedding to database', {
      jobId: input.jobId,
      embeddingLength: input.embedding.length,
    });

    // Update embedding and metadata using service
    await JobService.updateEmbeddingAndMetadata(
      input.jobId,
      input.embedding,
      input.costMetadata || undefined
    );

    logger.info('Job embedding saved successfully', {
      jobId: input.jobId,
    });

    return {
      success: true,
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';
    logger.error('Failed to save job embedding', {
      jobId: input.jobId,
      error: errorMessage,
    });

    return {
      success: false,
      error: errorMessage,
    };
  }
}
