/**
 * Job Analysis Service
 * Handles all database operations for JobAnalysis model
 */

import prisma, { type InputJsonValue, type JobAnalysis } from "@acme/db";
import { Logger } from "@acme/shared/Logger";

const logger = new Logger("JobAnalysisService");

export interface CreateJobAnalysisInput {
  jobId: string;
  riskScore: number;
  riskLevel: "safe" | "caution" | "danger";
  flags: Array<{
    type: string;
    confidence: "low" | "medium" | "high";
    message: string;
    reasoning?: string;
  }>;
  summary?: string | null;
  analysisSource?: string;
  localRulesResult?: Record<string, unknown> | null;
  metadata?: InputJsonValue | undefined;
}

export class JobAnalysisService {
  /**
   * Create a new job analysis
   */
  static async create(input: CreateJobAnalysisInput): Promise<JobAnalysis> {
    try {
      return await prisma.jobAnalysis.create({
        data: {
          jobId: input.jobId,
          riskScore: input.riskScore,
          riskLevel: input.riskLevel,
          flags: input.flags,
          summary: input.summary || null,
          analysisSource: input.analysisSource || "gemini",
          localRulesResult: input.localRulesResult
            ? (input.localRulesResult as InputJsonValue)
            : undefined,
          metadata: input.metadata,
        },
      });
    } catch (error) {
      logger.error("Failed to create job analysis", {
        jobId: input.jobId,
        error: error instanceof Error ? error.message : "Unknown error",
      });
      throw error;
    }
  }

  /**
   * Find analyses for a job
   */
  static async findByJobId(jobId: string) {
    try {
      return await prisma.jobAnalysis.findMany({
        where: { jobId },
        orderBy: { analyzedAt: "desc" },
      });
    } catch (error) {
      logger.error("Failed to find job analyses", {
        jobId,
        error: error instanceof Error ? error.message : "Unknown error",
      });
      throw error;
    }
  }

  /**
   * Get latest analysis for a job
   */
  static async findLatestByJobId(jobId: string) {
    try {
      return await prisma.jobAnalysis.findFirst({
        where: { jobId },
        orderBy: { analyzedAt: "desc" },
      });
    } catch (error) {
      logger.error("Failed to find latest job analysis", {
        jobId,
        error: error instanceof Error ? error.message : "Unknown error",
      });
      throw error;
    }
  }
}
