import { createHash } from "crypto";

import { z } from "zod";

import { publicProcedure, router } from "../index";
import type { ScamAnalysisResult } from "../schemas/scam-analysis";
import { aiService } from "../services/ai.service";
import { batchEmbeddingService } from "../services/batch-embedding.service";
import { FeedbackService } from "../services/feedback.service";
import { JobAnalysisService } from "../services/job-analysis.service";
import { JobSearchService } from "../services/job-search.service";
import { JobService } from "../services/job.service";
import { TemporalService } from "../services/temporal.service";
import { parsePostedDate } from "../utils/date-utils";

import { scanJobCacheMiddleware } from "./middlewares/trpc-cache";

export const scamDetectorRouter = router({
  // Save job data to database
  saveJob: publicProcedure
    .input(
      z.object({
        linkedinJobId: z.string().optional(),
        url: z.string().url(),
        title: z.string().min(1),
        company: z.string().min(1),
        description: z.string().min(1),
        location: z.string().optional(),
        salary: z.string().optional(),
        employmentType: z.string().optional(),
        postedDate: z.string().optional(),
        rawData: z.record(z.any(), z.any()).optional(), // Additional scraped data
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { linkedinJobId, url, ...jobData } = input;

      // Generate URL hash
      const jobUrlHash = createHash("sha256").update(url).digest("hex");

      // Parse posted date if provided
      const postedAt = parsePostedDate(input.postedDate);

      // Get user ID from session if available (optional - can be null for anonymous scrapes)
      const scrapedBy = ctx.session?.user?.id || null;

      // Create or update job using service
      const job = await JobService.createOrUpdate({
        linkedinJobId: linkedinJobId || null,
        jobUrlHash,
        url,
        title: jobData.title,
        company: jobData.company,
        description: jobData.description,
        location: jobData.location || null,
        salary: jobData.salary || null,
        employmentType: jobData.employmentType || null,
        postedAt,
        scrapedBy,
        rawData: input.rawData || null,
      });

      // Trigger async embedding generation workflow (fire-and-forget)
      let workflowId: string | undefined;
      try {
        const workflowResult = await TemporalService.startJobEmbeddingWorkflow({
          jobId: job.id,
          title: jobData.title,
          company: jobData.company,
          description: jobData.description,
        });
        workflowId = workflowResult.workflowId;
      } catch (error) {
        // Log but don't fail - embedding is optional enhancement
        console.error(
          "[saveJob] Failed to start embedding workflow:",
          error instanceof Error ? error.message : "Unknown error"
        );
      }

      return { jobId: job.id, success: true, workflowId };
    }),

  // Extract structured job data using AI
  extractJobData: publicProcedure
    .input(
      z.object({
        jobId: z.string(), // Job ID from database
        jobText: z.string().min(10),
        jobTitle: z.string().optional(),
        companyName: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const { jobId, jobText, jobTitle, companyName } = input;

      // Check if job exists using service
      const job = await JobService.findById(jobId);

      if (!job) {
        throw new Error("Job not found");
      }

      // Trigger async extraction workflow (fire-and-forget)
      let workflowId: string | undefined;
      try {
        const workflowResult = await TemporalService.startJobExtractionWorkflow(
          {
            jobId,
            jobText,
            jobTitle: jobTitle || job.title,
            companyName: companyName || job.company,
          }
        );
        workflowId = workflowResult.workflowId;
      } catch (error) {
        // Log but don't fail - extraction is optional enhancement
        console.error(
          "[extractJobData] Failed to start extraction workflow:",
          error instanceof Error ? error.message : "Unknown error"
        );
        // Still return success since workflow start failure shouldn't break the API
      }

      return { success: true, workflowId, jobId };
    }),

  // Search jobs using semantic similarity
  searchJobs: publicProcedure
    .input(
      z.object({
        query: z.string().min(1),
        limit: z.number().min(1).max(100).default(10),
      })
    )
    .query(async ({ input }) => {
      const { query, limit } = input;

      // Use search service
      return await JobSearchService.searchJobs({ query, limit });
    }),

  // Scan a job posting
  scanJob: publicProcedure
    .input(
      z.object({
        jobText: z.string().min(10),
        jobUrl: z.string().url(),
        companyName: z.string().optional(),
      })
    )
    .use(scanJobCacheMiddleware)
    .mutation(async ({ input }) => {
      const { jobText, jobUrl, companyName } = input;

      // 1. Generate URL hash
      const jobUrlHash = createHash("sha256").update(jobUrl).digest("hex");

      // 2. Check if job exists and has recent analysis (tRPC middleware handles Redis caching)
      // Try to find job first
      const job = await JobService.findLatestByUrlHash(jobUrlHash);

      // 3. Call Gemini 2.0 Flash via AI Service
      let geminiResult: ScamAnalysisResult;
      let costMetadata: { cost?: { totalCost?: number } } | null = null;
      try {
        const analysisResult = await aiService.analyzeJob({
          jobText,
          companyName,
          jobUrl,
        });
        geminiResult = analysisResult.result;
        costMetadata = analysisResult.costMetadata;
      } catch (error) {
        console.error("[scamDetectorRouter] AI analysis failed:", error);
        // Return fallback result instead of throwing
        return {
          riskScore: 50,
          riskLevel: "caution" as const,
          flags: [
            {
              type: "analysis_error",
              confidence: "low" as const,
              message:
                "Unable to complete full analysis. Proceed with caution.",
              reasoning:
                "AI service temporarily unavailable. Please verify job details manually.",
            },
          ],
          summary: "Analysis incomplete - use your judgment.",
          source: "fallback",
        };
      }

      // 4. Save analysis to JobAnalysis (always create new analysis record)
      // If job exists, link it; if not, we still track the scan by URL hash
      if (job) {
        try {
          await JobAnalysisService.create({
            jobId: job.id,
            riskScore: geminiResult.riskScore,
            riskLevel: geminiResult.riskLevel,
            flags: geminiResult.flags,
            summary: geminiResult.summary,
            analysisSource: "gemini",
            metadata: costMetadata
              ? (JSON.parse(
                  JSON.stringify(costMetadata)
                ) as typeof costMetadata)
              : undefined,
          });
        } catch (error) {
          // Log but don't fail the request if JobAnalysis save fails
          console.error(
            "[scamDetectorRouter] Failed to save JobAnalysis:",
            error
          );
        }
      }

      // 6. Return result
      return {
        ...geminiResult,
        source: "gemini",
      };
    }),

  // Submit feedback
  submitFeedback: publicProcedure
    .input(
      z.object({
        jobUrlHash: z.string().length(64), // SHA-256 hash length
        feedbackType: z.enum(["false_positive", "false_negative", "other"]),
        details: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      await FeedbackService.create({
        jobUrlHash: input.jobUrlHash,
        feedbackType: input.feedbackType,
        details: input.details || null,
      });

      return { success: true };
    }),

  // Generate embeddings for jobs without them (batch operation)
  generateMissingEmbeddings: publicProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(1000).optional().default(100),
        offset: z.number().min(0).optional().default(0),
      })
    )
    .mutation(async ({ input }) => {
      const result = await batchEmbeddingService.generateMissingEmbeddings({
        limit: input.limit,
        offset: input.offset,
      });

      return result;
    }),

  // Generate structured embeddings for extractions without them (batch operation)
  generateMissingStructuredEmbeddings: publicProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(1000).optional().default(100),
        offset: z.number().min(0).optional().default(0),
      })
    )
    .mutation(async ({ input }) => {
      const result =
        await batchEmbeddingService.generateMissingStructuredEmbeddings({
          limit: input.limit,
          offset: input.offset,
        });

      return result;
    }),

  // Get workflow status (for checking async operation progress)
  getWorkflowStatus: publicProcedure
    .input(
      z.object({
        workflowId: z.string().min(1),
      })
    )
    .query(async ({ input }) => {
      try {
        const status = await TemporalService.getWorkflowStatus(
          input.workflowId
        );
        return status;
      } catch (error) {
        console.error(
          "[getWorkflowStatus] Failed to get workflow status:",
          error instanceof Error ? error.message : "Unknown error"
        );
        throw new Error(
          `Failed to get workflow status: ${error instanceof Error ? error.message : "Unknown error"}`
        );
      }
    }),
});
