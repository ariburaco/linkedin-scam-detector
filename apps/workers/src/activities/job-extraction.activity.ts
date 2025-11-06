/**
 * Job Extraction Activities
 * Activities for extracting structured job data using AI and saving embeddings
 */

import prisma from '@acme/db';
import { aiService } from '@acme/api/services/ai.service';
import { embeddingService } from '@acme/api/services/embedding.service';
import { Logger } from '@acme/shared/Logger';
import type { JobExtractionResult } from '@acme/api/schemas/job-extraction';

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
      const job = await prisma.job.findUnique({
        where: { id: input.jobId },
        select: { title: true, company: true },
      });

      if (!job) {
        throw new Error(`Job not found: ${input.jobId}`);
      }

      jobTitle = jobTitle || job.title;
      companyName = companyName || job.company;
    }

    const extractionResult = await aiService.extractJobData({
      jobText: input.jobText,
      jobTitle,
      companyName,
    });

    logger.info('Job data extracted successfully', {
      jobId: input.jobId,
      hasRequirements: !!extractionResult.requirements?.length,
      hasSkills: !!extractionResult.skills?.length,
    });

    return {
      success: true,
      extractionResult,
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

    const embedding = await embeddingService.embedStructuredData(
      input.extractionResult
    );

    logger.info('Structured embedding generated successfully', {
      embeddingLength: embedding.length,
    });

    return {
      success: true,
      embedding,
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

    // Save extraction to database
    const extraction = await prisma.jobExtraction.create({
      data: {
        jobId: input.jobId,
        ...input.extractionResult,
        extractedData: input.extractionResult, // Store full result for flexibility
        extractionModel: 'gemini-2.0-flash-exp',
        extractionSource: 'gemini',
      },
    });

    // If structured embedding was generated, save it using raw SQL
    if (input.structuredEmbedding) {
      try {
        const vectorString = `[${input.structuredEmbedding.join(',')}]`;
        await prisma.$executeRawUnsafe(
          `UPDATE scam_detector_job_extraction SET structured_embedding = $1::vector WHERE id = $2`,
          vectorString,
          extraction.id
        );

        logger.info('Structured embedding saved successfully', {
          extractionId: extraction.id,
        });
      } catch (error) {
        // Log but don't fail - embedding is optional
        logger.warn('Failed to save structured embedding', {
          extractionId: extraction.id,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

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
