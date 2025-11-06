/**
 * Generate Job Embedding Workflow
 * Orchestrates generating and saving job embeddings asynchronously
 */

import { proxyActivities, workflowInfo } from '@temporalio/workflow';
import type * as activities from '../activities';

// Proxy activities with appropriate timeout for AI operations
const { generateJobEmbedding, saveJobEmbedding } = proxyActivities<
  typeof activities
>({
  startToCloseTimeout: '5 minutes',
  retry: {
    initialInterval: '1s',
    maximumInterval: '30s',
    backoffCoefficient: 2,
    maximumAttempts: 3,
  },
});

export interface GenerateJobEmbeddingWorkflowInput {
  jobId: string;
  title: string;
  company: string;
  description: string;
}

export interface GenerateJobEmbeddingWorkflowOutput {
  jobId: string;
  workflowId: string;
}

/**
 * Generate Job Embedding Workflow
 *
 * Steps:
 * 1. Generate embedding using EmbeddingService
 * 2. Save embedding to database
 */
export async function GenerateJobEmbedding(
  input: GenerateJobEmbeddingWorkflowInput
): Promise<GenerateJobEmbeddingWorkflowOutput> {
  const { workflowId } = workflowInfo();

  // Step 1: Generate embedding
  const generateResult = await generateJobEmbedding({
    jobId: input.jobId,
    title: input.title,
    company: input.company,
    description: input.description,
  });

  // Step 2: Save embedding to database (with cost metadata)
  await saveJobEmbedding({
    jobId: input.jobId,
    embedding: generateResult.embedding,
    costMetadata: generateResult.costMetadata,
  });

  return {
    jobId: input.jobId,
    workflowId,
  };
}
