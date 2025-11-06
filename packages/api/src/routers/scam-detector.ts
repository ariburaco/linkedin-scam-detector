import { createHash } from "crypto";

import { Logger } from "@acme/shared/Logger";
import { z } from "zod";

import { publicProcedure, router } from "../index";
import type { ScamAnalysisResult } from "../schemas/scam-analysis";
import { aiService } from "../services/ai.service";
import { batchEmbeddingService } from "../services/batch-embedding.service";
import { DiscoveredJobService } from "../services/discovered-job.service";
import { FeedbackService } from "../services/feedback.service";
import { JobAnalysisService } from "../services/job-analysis.service";
import { JobExtractionService } from "../services/job-extraction.service";
import { JobSearchService } from "../services/job-search.service";
import { JobService } from "../services/job.service";
import { TemporalService } from "../services/temporal.service";
import { parsePostedDate } from "../utils/date-utils";
import { extractLinkedInJobId } from "../utils/linkedin-url-parser";

import { scanJobCacheMiddleware } from "./middlewares/trpc-cache";

const logger = new Logger("ScamDetectorRouter");

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

      // Extract LinkedIn job ID from URL if not provided
      const extractedJobId = linkedinJobId || extractLinkedInJobId(url) || null;

      // Generate URL hash
      const jobUrlHash = createHash("sha256").update(url).digest("hex");

      // Parse posted date if provided
      const postedAt = parsePostedDate(input.postedDate);

      // Get user ID from session if available (optional - can be null for anonymous scrapes)
      const scrapedBy = ctx.session?.user?.id || null;

      // Create or update job using service
      const job = await JobService.createOrUpdate({
        linkedinJobId: extractedJobId,
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

      // Check if embedding already exists before starting workflow
      const hasExistingEmbedding = await JobService.hasEmbedding(job.id);

      let workflowId: string | undefined;
      if (!hasExistingEmbedding) {
        // Trigger async embedding generation workflow (fire-and-forget)
        try {
          const workflowResult =
            await TemporalService.startJobEmbeddingWorkflow({
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
      } else {
        console.log(
          `[saveJob] Skipping embedding workflow - job ${job.id} already has embedding`
        );
      }

      return { jobId: job.id, workflowId };
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

      // Check if extraction already exists before starting workflow
      const hasExistingExtraction =
        await JobExtractionService.hasExtraction(jobId);

      let workflowId: string | undefined;
      if (!hasExistingExtraction) {
        // Trigger async extraction workflow (fire-and-forget)
        try {
          const workflowResult =
            await TemporalService.startJobExtractionWorkflow({
              jobId,
              jobText,
              jobTitle: jobTitle || job.title,
              companyName: companyName || job.company,
            });
          workflowId = workflowResult.workflowId;
        } catch (error) {
          // Log but don't fail - extraction is optional enhancement
          console.error(
            "[extractJobData] Failed to start extraction workflow:",
            error instanceof Error ? error.message : "Unknown error"
          );
          // Still return success since workflow start failure shouldn't break the API
        }
      } else {
        console.log(
          `[extractJobData] Skipping extraction workflow - job ${jobId} already has extraction`
        );
      }

      return { jobId, workflowId };
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
        // Additional fields for job saving
        title: z.string().min(1),
        linkedinJobId: z.string().optional(),
        location: z.string().optional(),
        salary: z.string().optional(),
        employmentType: z.string().optional(),
        postedDate: z.string().optional(),
        rawData: z.record(z.any(), z.any()).optional(),
      })
    )
    .use(scanJobCacheMiddleware)
    .mutation(async ({ input, ctx }) => {
      const {
        jobText,
        jobUrl,
        companyName,
        title,
        linkedinJobId,
        location,
        salary,
        employmentType,
        postedDate,
        rawData,
      } = input;

      // 1. Generate URL hash
      const jobUrlHash = createHash("sha256").update(jobUrl).digest("hex");

      // 2. Save/update job data (fire-and-forget, don't block on errors)
      let savedJob: { id: string } | null = null;
      try {
        // Extract LinkedIn job ID from URL if not provided
        const extractedJobId =
          linkedinJobId || extractLinkedInJobId(jobUrl) || null;

        // Parse posted date if provided
        const postedAt = parsePostedDate(postedDate);

        // Get user ID from session if available
        const scrapedBy = ctx.session?.user?.id || null;

        // Create or update job using service
        const job = await JobService.createOrUpdate({
          linkedinJobId: extractedJobId,
          jobUrlHash,
          url: jobUrl,
          title,
          company: companyName || "",
          description: jobText,
          location: location || null,
          salary: salary || null,
          employmentType: employmentType || null,
          postedAt,
          scrapedBy,
          rawData: rawData || null,
        });
        savedJob = { id: job.id };

        // Trigger embedding workflow if needed (fire-and-forget)
        const hasExistingEmbedding = await JobService.hasEmbedding(job.id);
        if (!hasExistingEmbedding) {
          TemporalService.startJobEmbeddingWorkflow({
            jobId: job.id,
            title,
            company: companyName || "",
            description: jobText,
          }).catch((error) => {
            // Log but don't fail - embedding is optional enhancement
            console.error(
              "[scanJob] Failed to start embedding workflow:",
              error instanceof Error ? error.message : "Unknown error"
            );
          });
        }

        // Trigger extraction workflow if needed (fire-and-forget)
        const hasExistingExtraction = await JobExtractionService.hasExtraction(
          job.id
        );
        if (!hasExistingExtraction) {
          TemporalService.startJobExtractionWorkflow({
            jobId: job.id,
            jobText,
            jobTitle: title,
            companyName: companyName || "",
          }).catch((error) => {
            // Log but don't fail - extraction is optional enhancement
            console.error(
              "[scanJob] Failed to start extraction workflow:",
              error instanceof Error ? error.message : "Unknown error"
            );
          });
        }
      } catch (error) {
        // Log but don't fail the request if job save fails
        console.error(
          "[scanJob] Failed to save job:",
          error instanceof Error ? error.message : "Unknown error"
        );
      }

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
      // If job was saved, link it; if not, we still track the scan by URL hash
      if (savedJob) {
        try {
          await JobAnalysisService.create({
            jobId: savedJob.id,
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

      // 5. Return only scan analysis results (no jobId, workflowIds, etc.)
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

  // Discover jobs from LinkedIn search/collection pages
  discoverJobs: publicProcedure
    .input(
      z.object({
        jobs: z.array(
          z.object({
            linkedinJobId: z.string(),
            url: z.string().url(),
            title: z.string().min(1),
            company: z.string().min(1),
            location: z.string().optional(),
            employmentType: z.string().optional(),
            workType: z.string().optional(),
            isPromoted: z.boolean().optional(),
            isEasyApply: z.boolean().optional(),
            hasVerified: z.boolean().optional(),
            insight: z.string().optional(),
            postedDate: z.string().optional(),
            companyLogoUrl: z.string().url().optional(),
            discoverySource: z.string(),
            discoveryUrl: z.string().url().optional(),
          })
        ),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const discoveredBy = ctx.session?.user?.id;

      // Fire-and-forget: trigger workflow to save jobs asynchronously
      try {
        const { workflowId } =
          await TemporalService.startSaveDiscoveredJobsWorkflow({
            jobs: input.jobs,
            discoveredBy,
          });

        // Log workflow start for monitoring
        logger.info("Started save discovered jobs workflow", {
          workflowId,
          jobCount: input.jobs.length,
        });
      } catch (error) {
        // Log error but don't fail - discovery is best-effort
        logger.error("Failed to start save discovered jobs workflow", {
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }

      // Always return success to client
      return { success: true };
    }),

  // Get unprocessed discovered jobs
  getUnprocessedJobs: publicProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100).optional().default(50),
        offset: z.number().min(0).optional().default(0),
        discoverySource: z.string().optional(),
        minAge: z.number().min(0).optional(), // Minimum hours since discovery
      })
    )
    .query(async ({ input }) => {
      return await DiscoveredJobService.findUnprocessed({
        limit: input.limit,
        offset: input.offset,
        discoverySource: input.discoverySource,
        minAge: input.minAge,
      });
    }),

  // Mark discovered job as processed
  markJobProcessed: publicProcedure
    .input(
      z.object({
        discoveredJobId: z.string(),
        jobId: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      await DiscoveredJobService.markAsProcessed(
        input.discoveredJobId,
        input.jobId
      );
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
