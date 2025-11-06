/**
 * Feedback Service
 * Handles database operations for Feedback model
 */

import prisma from "@acme/db";
import { Logger } from "@acme/shared/Logger";

const logger = new Logger("FeedbackService");

export interface CreateFeedbackInput {
  jobUrlHash: string;
  feedbackType: "false_positive" | "false_negative" | "other";
  details?: string | null;
}

export class FeedbackService {
  /**
   * Create a new feedback entry
   */
  static async create(input: CreateFeedbackInput) {
    try {
      return await prisma.feedback.create({
        data: {
          jobUrlHash: input.jobUrlHash,
          feedbackType: input.feedbackType,
          details: input.details || null,
        },
      });
    } catch (error) {
      logger.error("Failed to create feedback", {
        jobUrlHash: input.jobUrlHash,
        error: error instanceof Error ? error.message : "Unknown error",
      });
      throw error;
    }
  }

  /**
   * Find feedback by job URL hash
   */
  static async findByJobUrlHash(jobUrlHash: string) {
    try {
      return await prisma.feedback.findMany({
        where: { jobUrlHash },
        orderBy: { submittedAt: "desc" },
      });
    } catch (error) {
      logger.error("Failed to find feedback", {
        jobUrlHash,
        error: error instanceof Error ? error.message : "Unknown error",
      });
      throw error;
    }
  }
}
