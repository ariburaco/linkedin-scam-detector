/**
 * Job Extraction Service
 * Handles all database operations for JobExtraction model
 */

import prisma, { type InputJsonValue, type JobExtraction } from "@acme/db";
import { Logger } from "@acme/shared/Logger";

import type { JobExtractionResult } from "../schemas/job-extraction";

const logger = new Logger("JobExtractionService");

export interface CreateJobExtractionInput {
  jobId: string;
  extractionResult: JobExtractionResult;
  extractionModel?: string;
  extractionSource?: string;
  metadata?: InputJsonValue | null;
}

export class JobExtractionService {
  /**
   * Create a new job extraction
   */
  static async create(input: CreateJobExtractionInput): Promise<JobExtraction> {
    try {
      return await prisma.jobExtraction.create({
        data: {
          jobId: input.jobId,
          ...input.extractionResult,
          extractedData: input.extractionResult, // Store full result for flexibility
          extractionModel: input.extractionModel,
          extractionSource: input.extractionSource,
          metadata: input.metadata
            ? (input.metadata as InputJsonValue)
            : undefined,
        },
      });
    } catch (error) {
      logger.error("Failed to create job extraction", {
        jobId: input.jobId,
        error: error instanceof Error ? error.message : "Unknown error",
      });
      throw error;
    }
  }

  /**
   * Update extraction's structured embedding (using raw SQL for vector type)
   */
  static async updateStructuredEmbedding(
    extractionId: string,
    embedding: number[]
  ): Promise<void> {
    try {
      const vectorString = `[${embedding.join(",")}]`;
      await prisma.$executeRawUnsafe(
        `UPDATE scam_detector_job_extraction SET structured_embedding = $1::vector WHERE id = $2`,
        vectorString,
        extractionId
      );
    } catch (error) {
      logger.error("Failed to update structured embedding", {
        extractionId,
        error: error instanceof Error ? error.message : "Unknown error",
      });
      throw error;
    }
  }

  /**
   * Create extraction with structured embedding
   */
  static async createWithEmbedding(
    input: CreateJobExtractionInput,
    structuredEmbedding?: number[]
  ): Promise<JobExtraction> {
    try {
      // Create extraction first
      const extraction = await this.create(input);

      // Update structured embedding if provided
      if (structuredEmbedding) {
        await this.updateStructuredEmbedding(
          extraction.id,
          structuredEmbedding
        );
      }

      return extraction;
    } catch (error) {
      logger.error("Failed to create job extraction with embedding", {
        jobId: input.jobId,
        error: error instanceof Error ? error.message : "Unknown error",
      });
      throw error;
    }
  }

  /**
   * Find extractions for a job
   */
  static async findByJobId(jobId: string) {
    try {
      return await prisma.jobExtraction.findMany({
        where: { jobId },
        orderBy: { extractedAt: "desc" },
      });
    } catch (error) {
      logger.error("Failed to find job extractions", {
        jobId,
        error: error instanceof Error ? error.message : "Unknown error",
      });
      throw error;
    }
  }

  /**
   * Get latest extraction for a job
   */
  static async findLatestByJobId(jobId: string) {
    try {
      return await prisma.jobExtraction.findFirst({
        where: { jobId },
        orderBy: { extractedAt: "desc" },
      });
    } catch (error) {
      logger.error("Failed to find latest job extraction", {
        jobId,
        error: error instanceof Error ? error.message : "Unknown error",
      });
      throw error;
    }
  }
}
