/**
 * Extract Job Data Workflow
 * Orchestrates extracting structured job data using AI and saving embeddings
 */

import { proxyActivities, workflowInfo } from '@temporalio/workflow';
import type * as activities from '../activities';

// Proxy activities with appropriate timeout for AI operations
const { extractJobDataWithAI, generateStructuredEmbedding, saveJobExtraction } =
  proxyActivities<typeof activities>({
    startToCloseTimeout: '10 minutes', // Longer timeout for AI extraction
    retry: {
      initialInterval: '1s',
      maximumInterval: '60s',
      backoffCoefficient: 2,
      maximumAttempts: 3,
    },
  });

export interface ExtractJobDataWorkflowInput {
  jobId: string;
  jobText: string;
  jobTitle?: string;
  companyName?: string;
}

export interface ExtractJobDataWorkflowOutput {
  success: boolean;
  extractionId?: string;
  workflowId: string;
  error?: string;
}

/**
 * Extract Job Data Workflow
 *
 * Steps:
 * 1. Extract structured data using AI
 * 2. Generate structured embedding (optional - continue even if fails)
 * 3. Save extraction and embedding to database
 */
export async function ExtractJobData(
  input: ExtractJobDataWorkflowInput
): Promise<ExtractJobDataWorkflowOutput> {
  const { workflowId } = workflowInfo();

  // Step 1: Extract structured data using AI
  const extractionResult = await extractJobDataWithAI({
    jobId: input.jobId,
    jobText: input.jobText,
    jobTitle: input.jobTitle,
    companyName: input.companyName,
  });

  if (!extractionResult.success || !extractionResult.extractionResult) {
    return {
      success: false,
      workflowId,
      error: extractionResult.error || 'Failed to extract job data with AI',
    };
  }

  // Step 2: Generate structured embedding (optional - don't fail if this fails)
  let structuredEmbedding: number[] | undefined;
  const embeddingResult = await generateStructuredEmbedding({
    extractionResult: extractionResult.extractionResult,
  });

  if (embeddingResult.success && embeddingResult.embedding) {
    structuredEmbedding = embeddingResult.embedding;
  }
  // Continue even if embedding generation fails - it's optional

  // Step 3: Save extraction and embedding to database (with cost metadata)
  const saveResult = await saveJobExtraction({
    jobId: input.jobId,
    extractionResult: extractionResult.extractionResult,
    structuredEmbedding,
    extractionCostMetadata: extractionResult.costMetadata,
    embeddingCostMetadata: embeddingResult.costMetadata,
  });

  if (!saveResult.success) {
    return {
      success: false,
      workflowId,
      error: saveResult.error || 'Failed to save job extraction',
    };
  }

  return {
    success: true,
    extractionId: saveResult.extractionId,
    workflowId,
  };
}
