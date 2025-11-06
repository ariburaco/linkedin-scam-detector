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
  embedding: number[];
  costMetadata?: unknown; // Cost metadata from embedding service
}

/**
 * Generate embedding for a job
 */
export async function generateJobEmbedding(
  input: GenerateJobEmbeddingInput
): Promise<GenerateJobEmbeddingOutput> {
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
    embedding: result.embedding,
    costMetadata: result.costMetadata,
  };
}

export interface SaveJobEmbeddingInput {
  jobId: string;
  embedding: number[];
  costMetadata?: unknown; // Cost metadata to store
}

export interface SaveJobEmbeddingOutput {
  jobId: string;
}

/**
 * Save embedding to database using raw SQL (Prisma doesn't support vector type directly)
 */
export async function saveJobEmbedding(
  input: SaveJobEmbeddingInput
): Promise<SaveJobEmbeddingOutput> {
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
    jobId: input.jobId,
  };
}
