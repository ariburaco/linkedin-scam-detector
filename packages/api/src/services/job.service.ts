/**
 * Job Service
 * Handles all database operations for Job model
 */

import prisma, {
  type InputJsonValue,
  type Job,
  type JsonValue,
} from "@acme/db";
import { Logger } from "@acme/shared/Logger";

const logger = new Logger("JobService");

export interface CreateJobInput {
  linkedinJobId?: string | null;
  jobUrlHash: string;
  url: string;
  title: string;
  company: string;
  description: string;
  location?: string | null;
  salary?: string | null;
  employmentType?: string | null;
  postedAt?: Date | null;
  scrapedBy?: string | null;
  rawData?: Record<string, unknown> | null;
  metadata?: JsonValue | null;
}

export interface UpdateJobInput {
  title?: string;
  company?: string;
  description?: string;
  location?: string | null;
  salary?: string | null;
  employmentType?: string | null;
  postedAt?: Date | null;
  linkedinJobId?: string | null;
  jobUrlHash?: string;
  rawData?: Record<string, unknown> | null;
  scrapedBy?: string | null;
  metadata?: JsonValue | null;
}

export class JobService {
  /**
   * Find job by LinkedIn ID
   */
  static async findByLinkedInId(linkedinJobId: string): Promise<Job | null> {
    try {
      return await prisma.job.findUnique({
        where: { linkedinJobId },
      });
    } catch (error) {
      logger.error("Failed to find job by LinkedIn ID", {
        linkedinJobId,
        error: error instanceof Error ? error.message : "Unknown error",
      });
      throw error;
    }
  }

  /**
   * Find job by URL hash
   */
  static async findByUrlHash(jobUrlHash: string): Promise<Job | null> {
    try {
      return await prisma.job.findFirst({
        where: { jobUrlHash },
      });
    } catch (error) {
      logger.error("Failed to find job by URL hash", {
        jobUrlHash,
        error: error instanceof Error ? error.message : "Unknown error",
      });
      throw error;
    }
  }

  /**
   * Find job by ID
   */
  static async findById(id: string): Promise<Job | null> {
    try {
      return await prisma.job.findUnique({
        where: { id },
      });
    } catch (error) {
      logger.error("Failed to find job by ID", {
        id,
        error: error instanceof Error ? error.message : "Unknown error",
      });
      throw error;
    }
  }

  /**
   * Find latest job by URL hash (for getting most recent scrape)
   */
  static async findLatestByUrlHash(jobUrlHash: string): Promise<Job | null> {
    try {
      return await prisma.job.findFirst({
        where: { jobUrlHash },
        orderBy: { scrapedAt: "desc" },
      });
    } catch (error) {
      logger.error("Failed to find latest job by URL hash", {
        jobUrlHash,
        error: error instanceof Error ? error.message : "Unknown error",
      });
      throw error;
    }
  }

  /**
   * Create or update job (upsert-like behavior)
   */
  static async createOrUpdate(input: CreateJobInput): Promise<Job> {
    try {
      // Try to find existing job
      const existingJob = input.linkedinJobId
        ? await this.findByLinkedInId(input.linkedinJobId)
        : await this.findByUrlHash(input.jobUrlHash);

      if (existingJob) {
        // Update existing job
        const updateData = {
          title: input.title,
          company: input.company,
          description: input.description,
          location: input.location,
          salary: input.salary,
          employmentType: input.employmentType,
          postedAt: input.postedAt,
          linkedinJobId: input.linkedinJobId || existingJob.linkedinJobId,
          jobUrlHash: input.jobUrlHash,
          rawData: input.rawData
            ? (input.rawData as InputJsonValue)
            : (existingJob.rawData as InputJsonValue | null),
          scrapedBy: input.scrapedBy || existingJob.scrapedBy,
          metadata: input.metadata
            ? (input.metadata as InputJsonValue)
            : undefined,
        };

        return await prisma.job.update({
          where: { id: existingJob.id },
          data: updateData as any,
        });
      } else {
        // Create new job
        return await prisma.job.create({
          data: {
            ...input,
            rawData: input.rawData
              ? (input.rawData as InputJsonValue)
              : undefined,
            metadata: input.metadata
              ? (input.metadata as InputJsonValue)
              : undefined,
          } as any,
        });
      }
    } catch (error) {
      logger.error("Failed to create or update job", {
        linkedinJobId: input.linkedinJobId,
        jobUrlHash: input.jobUrlHash,
        error: error instanceof Error ? error.message : "Unknown error",
      });
      throw error;
    }
  }

  /**
   * Update job metadata (for storing cost data)
   */
  static async updateMetadata(
    jobId: string,
    metadata: JsonValue | Record<string, unknown>
  ): Promise<void> {
    try {
      await prisma.job.update({
        where: { id: jobId },
        data: {
          metadata: metadata as JsonValue as InputJsonValue,
        },
      });
    } catch (error) {
      logger.error("Failed to update job metadata", {
        jobId,
        error: error instanceof Error ? error.message : "Unknown error",
      });
      throw error;
    }
  }

  /**
   * Update job embedding (using raw SQL for vector type)
   */
  static async updateEmbedding(
    jobId: string,
    embedding: number[]
  ): Promise<void> {
    try {
      const vectorString = `[${embedding.join(",")}]`;
      await prisma.$executeRawUnsafe(
        `UPDATE scam_detector_job SET embedding = $1::vector WHERE id = $2`,
        vectorString,
        jobId
      );
    } catch (error) {
      logger.error("Failed to update job embedding", {
        jobId,
        error: error instanceof Error ? error.message : "Unknown error",
      });
      throw error;
    }
  }

  /**
   * Update job embedding and metadata together
   */
  static async updateEmbeddingAndMetadata(
    jobId: string,
    embedding: number[],
    metadata?: JsonValue | Record<string, unknown>
  ): Promise<void> {
    try {
      // Update embedding using raw SQL
      await this.updateEmbedding(jobId, embedding);

      // Update metadata if provided
      if (metadata) {
        await this.updateMetadata(jobId, metadata as JsonValue);
      }
    } catch (error) {
      logger.error("Failed to update job embedding and metadata", {
        jobId,
        error: error instanceof Error ? error.message : "Unknown error",
      });
      throw error;
    }
  }
}
