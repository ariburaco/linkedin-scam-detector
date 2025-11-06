/**
 * Discovered Job Service
 * Handles database operations for DiscoveredJob model
 */

import prisma, { type DiscoveredJob, type InputJsonValue } from "@acme/db";
import { Logger } from "@acme/shared/Logger";

const logger = new Logger("DiscoveredJobService");

export interface DiscoveredJobData {
  linkedinJobId: string;
  url: string;
  title: string;
  company: string;
  location?: string;
  employmentType?: string;
  workType?: string; // Remote, Hybrid, On-site
  isPromoted?: boolean;
  isEasyApply?: boolean;
  hasVerified?: boolean;
  insight?: string;
  postedDate?: string;
  companyLogoUrl?: string;
  discoverySource: string; // "search", "recommended", etc.
  discoveryUrl?: string;
}

export interface CreateDiscoveredJobInput {
  linkedinJobId: string;
  url: string;
  title: string;
  company: string;
  location?: string;
  employmentType?: string;
  workType?: string;
  isPromoted?: boolean;
  isEasyApply?: boolean;
  hasVerified?: boolean;
  insight?: string;
  postedDate?: string;
  companyLogoUrl?: string;
  discoveredBy?: string;
  discoverySource: string;
  discoveryUrl?: string;
  rawData?: Record<string, unknown>;
}

export interface FindUnprocessedOptions {
  limit?: number;
  offset?: number;
  discoverySource?: string;
  minAge?: number; // Minimum hours since discovery
  orderBy?: "priorityScore" | "discoveredAt";
}

/**
 * Calculate priority score for a discovered job
 * Higher score = process first
 */
export function calculatePriorityScore(job: DiscoveredJobData): number {
  let score = 50; // Base score

  // Boost for Easy Apply (easier to scam)
  if (job.isEasyApply) score += 20;

  // Boost for promoted (paid ads, less likely scam but still check)
  if (job.isPromoted) score += 10;

  // Boost for active reviewing
  if (job.insight?.includes("Actively reviewing")) score += 15;

  // Penalty for verified (likely legitimate)
  if (job.hasVerified) score -= 20;

  // Boost for recent posts
  if (job.postedDate?.includes("hour") || job.postedDate?.includes("today")) {
    score += 25;
  }

  // Boost for remote (more scams in remote jobs)
  if (job.workType?.toLowerCase() === "remote") score += 10;

  return Math.max(0, Math.min(100, score)); // Clamp 0-100
}

export class DiscoveredJobService {
  /**
   * Create or update discovered job (upsert by linkedinJobId)
   */
  static async createOrUpdate(
    input: CreateDiscoveredJobInput
  ): Promise<DiscoveredJob> {
    try {
      const priorityScore = calculatePriorityScore(input);

      return await prisma.discoveredJob.upsert({
        where: { linkedinJobId: input.linkedinJobId },
        create: {
          linkedinJobId: input.linkedinJobId,
          url: input.url,
          title: input.title,
          company: input.company,
          location: input.location || null,
          employmentType: input.employmentType || null,
          workType: input.workType || null,
          isPromoted: input.isPromoted || false,
          isEasyApply: input.isEasyApply || false,
          hasVerified: input.hasVerified || false,
          insight: input.insight || null,
          postedDate: input.postedDate || null,
          companyLogoUrl: input.companyLogoUrl || null,
          discoveredBy: input.discoveredBy || null,
          discoverySource: input.discoverySource,
          discoveryUrl: input.discoveryUrl || null,
          priorityScore,
          rawData: input.rawData
            ? (input.rawData as InputJsonValue)
            : undefined,
        },
        update: {
          // Update fields that might change (title, company, etc.)
          url: input.url,
          title: input.title,
          company: input.company,
          location: input.location || null,
          employmentType: input.employmentType || null,
          workType: input.workType || null,
          isPromoted: input.isPromoted || false,
          isEasyApply: input.isEasyApply || false,
          hasVerified: input.hasVerified || false,
          insight: input.insight || null,
          postedDate: input.postedDate || null,
          companyLogoUrl: input.companyLogoUrl || null,
          priorityScore, // Recalculate priority
          rawData: input.rawData
            ? (input.rawData as InputJsonValue)
            : undefined,
        },
      });
    } catch (error) {
      logger.error("Failed to create or update discovered job", {
        linkedinJobId: input.linkedinJobId,
        error: error instanceof Error ? error.message : "Unknown error",
      });
      throw error;
    }
  }

  /**
   * Bulk create or update discovered jobs
   */
  static async bulkCreateOrUpdate(
    jobs: CreateDiscoveredJobInput[]
  ): Promise<{ created: number; updated: number }> {
    try {
      let created = 0;
      let updated = 0;

      // Check which jobs already exist
      const existingJobIds = new Set(
        (
          await prisma.discoveredJob.findMany({
            where: {
              linkedinJobId: {
                in: jobs.map((j) => j.linkedinJobId),
              },
            },
            select: { linkedinJobId: true },
          })
        ).map((j) => j.linkedinJobId)
      );

      // Count creates vs updates
      for (const job of jobs) {
        if (existingJobIds.has(job.linkedinJobId)) {
          updated++;
        } else {
          created++;
        }
      }

      // Process in batches to avoid overwhelming database
      const batchSize = 50;
      for (let i = 0; i < jobs.length; i += batchSize) {
        const batch = jobs.slice(i, i + batchSize);
        await Promise.allSettled(batch.map((job) => this.createOrUpdate(job)));
      }

      logger.info("Bulk created/updated discovered jobs", {
        total: jobs.length,
        created,
        updated,
      });

      return { created, updated };
    } catch (error) {
      logger.error("Failed to bulk create or update discovered jobs", {
        count: jobs.length,
        error: error instanceof Error ? error.message : "Unknown error",
      });
      throw error;
    }
  }

  /**
   * Find discovered job by LinkedIn ID
   */
  static async findByLinkedInId(linkedinJobId: string) {
    try {
      return await prisma.discoveredJob.findUnique({
        where: { linkedinJobId },
      });
    } catch (error) {
      logger.error("Failed to find discovered job by LinkedIn ID", {
        linkedinJobId,
        error: error instanceof Error ? error.message : "Unknown error",
      });
      throw error;
    }
  }

  /**
   * Find unprocessed discovered jobs
   */
  static async findUnprocessed(options: FindUnprocessedOptions = {}): Promise<{
    results: Array<DiscoveredJob>;
    count: number;
  }> {
    const {
      limit = 50,
      offset = 0,
      discoverySource,
      minAge,
      orderBy = "priorityScore",
    } = options;

    try {
      const where: any = {
        processedAt: null, // Not yet processed
        processingStatus: {
          in: ["pending", "queued"], // Only pending or queued jobs
        },
      };

      if (discoverySource) {
        where.discoverySource = discoverySource;
      }

      if (minAge) {
        const minDate = new Date();
        minDate.setHours(minDate.getHours() - minAge);
        where.discoveredAt = {
          lte: minDate,
        };
      }

      const orderByClause: any =
        orderBy === "priorityScore"
          ? { priorityScore: "desc" }
          : { discoveredAt: "asc" };

      const [results, count] = await Promise.all([
        prisma.discoveredJob.findMany({
          where,
          orderBy: orderByClause,
          take: limit,
          skip: offset,
        }),
        prisma.discoveredJob.count({ where }),
      ]);

      return { results, count };
    } catch (error) {
      logger.error("Failed to find unprocessed discovered jobs", {
        options,
        error: error instanceof Error ? error.message : "Unknown error",
      });
      throw error;
    }
  }

  /**
   * Mark discovered job as processed
   */
  static async markAsProcessed(
    discoveredJobId: string,
    jobId: string
  ): Promise<void> {
    try {
      await prisma.discoveredJob.update({
        where: { id: discoveredJobId },
        data: {
          processedAt: new Date(),
          processedJobId: jobId,
          processingStatus: "completed",
        },
      });
    } catch (error) {
      logger.error("Failed to mark discovered job as processed", {
        discoveredJobId,
        jobId,
        error: error instanceof Error ? error.message : "Unknown error",
      });
      throw error;
    }
  }

  /**
   * Update processing status
   */
  static async updateStatus(
    discoveredJobId: string,
    status: "pending" | "queued" | "processing" | "completed" | "failed"
  ): Promise<void> {
    try {
      await prisma.discoveredJob.update({
        where: { id: discoveredJobId },
        data: { processingStatus: status },
      });
    } catch (error) {
      logger.error("Failed to update discovered job status", {
        discoveredJobId,
        status,
        error: error instanceof Error ? error.message : "Unknown error",
      });
      throw error;
    }
  }

  /**
   * Record processing failure
   */
  static async recordFailure(
    discoveredJobId: string,
    errorMessage: string
  ): Promise<void> {
    try {
      const job = await prisma.discoveredJob.findUnique({
        where: { id: discoveredJobId },
      });

      if (!job) {
        throw new Error(`Discovered job not found: ${discoveredJobId}`);
      }

      const newAttempts = (job.processingAttempts || 0) + 1;
      const newStatus = newAttempts >= 3 ? "failed" : job.processingStatus;

      await prisma.discoveredJob.update({
        where: { id: discoveredJobId },
        data: {
          processingAttempts: newAttempts,
          lastProcessError: errorMessage,
          processingStatus: newStatus,
        },
      });
    } catch (error) {
      logger.error("Failed to record discovered job failure", {
        discoveredJobId,
        error: error instanceof Error ? error.message : "Unknown error",
      });
      throw error;
    }
  }
}
