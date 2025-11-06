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
   * Parse ISO date string to Date object, return null if invalid or undefined
   */
  private static parseDate(dateString: string | undefined | null): Date | null {
    if (!dateString) return null;
    try {
      const date = new Date(dateString);
      return isNaN(date.getTime()) ? null : date;
    } catch {
      return null;
    }
  }

  /**
   * Create a new job extraction
   */
  static async create(input: CreateJobExtractionInput): Promise<JobExtraction> {
    try {
      const {
        startDate: startDateStr,
        applicationDeadline: deadlineStr,
        scamIndicators,
        ...restResult
      } = input.extractionResult;

      // Parse dates from ISO strings
      const startDate = this.parseDate(startDateStr);
      const applicationDeadline = this.parseDate(deadlineStr);

      // Prepare data object with proper field mapping
      const data = {
        jobId: input.jobId,
        // Map existing fields
        requirements: restResult.requirements as InputJsonValue | undefined,
        responsibilities: restResult.responsibilities as InputJsonValue | undefined,
        benefits: restResult.benefits as InputJsonValue | undefined,
        qualifications: restResult.qualifications as InputJsonValue | undefined,
        skills: restResult.skills as InputJsonValue | undefined,
        salaryMin: restResult.salaryMin,
        salaryMax: restResult.salaryMax,
        salaryCurrency: restResult.salaryCurrency,
        salaryPeriod: restResult.salaryPeriod,
        experienceLevel: restResult.experienceLevel,
        educationLevel: restResult.educationLevel,
        workType: restResult.workType,
        workSchedule: restResult.workSchedule,
        isAgency: restResult.isAgency,
        // Map new metrics
        urgencyScore: restResult.urgencyScore,
        qualityScore: restResult.qualityScore,
        competitivenessScore: restResult.competitivenessScore,
        scamIndicators: scamIndicators
          ? (scamIndicators as InputJsonValue)
          : undefined,
        startDate,
        applicationDeadline,
        // Store full result in extractedData for flexibility
        extractedData: input.extractionResult as InputJsonValue,
        extractionModel: input.extractionModel,
        extractionSource: input.extractionSource,
        metadata: input.metadata
          ? (input.metadata as InputJsonValue)
          : undefined,
      };

      return await prisma.jobExtraction.create({ data });
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
   * Check if job already has any extraction
   */
  static async hasExtraction(jobId: string): Promise<boolean> {
    try {
      const extraction = await prisma.jobExtraction.findFirst({
        where: { jobId },
        select: { id: true },
      });

      return extraction !== null;
    } catch (error) {
      logger.error("Failed to check if job has extraction", {
        jobId,
        error: error instanceof Error ? error.message : "Unknown error",
      });
      // Return false on error to allow workflow to proceed (fail-safe)
      return false;
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
