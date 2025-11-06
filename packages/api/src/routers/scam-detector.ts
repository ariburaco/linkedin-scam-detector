import { createHash } from "crypto";

import prisma from "@acme/db";
import { z } from "zod";

import { publicProcedure, router } from "../index";
import { aiService } from "../services/ai-service";
import { batchEmbeddingService } from "../services/batch-embedding-service";
import { embeddingService } from "../services/embedding-service";

import { scanJobCacheMiddleware } from "./middlewares/trpc-cache";

/**
 * Helper to parse posted date string to DateTime
 */
function parsePostedDate(dateString?: string): Date | null {
  if (!dateString) return null;

  // Try to parse relative dates like "Posted 2 days ago"
  const match = dateString.match(
    /(\d+)\s+(day|days|week|weeks|month|months)\s+ago/i
  );
  if (match) {
    const amount = parseInt(match[1] || "0", 10);
    const unit = match[2]?.toLowerCase() || "";

    const now = new Date();
    if (unit.startsWith("day")) {
      now.setDate(now.getDate() - amount);
    } else if (unit.startsWith("week")) {
      now.setDate(now.getDate() - amount * 7);
    } else if (unit.startsWith("month")) {
      now.setMonth(now.getMonth() - amount);
    }
    return now;
  }

  return null;
}

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

      // Try to find existing job by linkedinJobId or jobUrlHash
      const existingJob = linkedinJobId
        ? await prisma.job.findUnique({
            where: { linkedinJobId },
          })
        : await prisma.job.findFirst({
            where: { jobUrlHash },
          });

      // Generate embedding for the job (async, don't block)
      let embeddingPromise: Promise<number[]> | null = null;
      try {
        embeddingPromise = embeddingService.embedJob({
          title: jobData.title,
          company: jobData.company,
          description: jobData.description,
        });
      } catch (error) {
        console.error("[saveJob] Failed to generate embedding:", error);
        // Continue without embedding - it's optional
      }

      let job;
      if (existingJob) {
        // Update existing job
        const updateData = {
          ...jobData,
          linkedinJobId: linkedinJobId || existingJob.linkedinJobId,
          jobUrlHash,
          postedAt,
          updatedAt: new Date(),
          rawData:
            input.rawData || (existingJob.rawData as Record<string, unknown>),
          scrapedBy: scrapedBy || existingJob.scrapedBy,
        };

        // If embedding was generated, add it (using raw SQL since Prisma doesn't support vector type directly)
        if (embeddingPromise) {
          try {
            const embedding = await embeddingPromise;
            // Format embedding as PostgreSQL vector: '[1,2,3,...]'
            const vectorString = `[${embedding.join(",")}]`;
            // Update embedding using raw SQL
            await prisma.$executeRawUnsafe(
              `UPDATE scam_detector_job SET embedding = $1::vector WHERE id = $2`,
              vectorString,
              existingJob.id
            );
          } catch (error) {
            console.error("[saveJob] Failed to update embedding:", error);
          }
        }

        job = await prisma.job.update({
          where: { id: existingJob.id },
          data: updateData,
        });
      } else {
        // Create new job
        const createData = {
          linkedinJobId: linkedinJobId || null,
          jobUrlHash,
          url,
          ...jobData,
          postedAt,
          scrapedBy,
          rawData: input.rawData || undefined,
        };

        job = await prisma.job.create({
          data: createData,
        });

        // If embedding was generated, add it using raw SQL
        if (embeddingPromise) {
          try {
            const embedding = await embeddingPromise;
            const vectorString = `[${embedding.join(",")}]`;
            await prisma.$executeRawUnsafe(
              `UPDATE scam_detector_job SET embedding = $1::vector WHERE id = $2`,
              vectorString,
              job.id
            );
          } catch (error) {
            console.error("[saveJob] Failed to set embedding:", error);
          }
        }
      }

      return { jobId: job.id, success: true };
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

      // Check if job exists
      const job = await prisma.job.findUnique({
        where: { id: jobId },
      });

      if (!job) {
        throw new Error("Job not found");
      }

      // Extract structured data using AI
      let extractionResult;
      try {
        extractionResult = await aiService.extractJobData({
          jobText,
          jobTitle: jobTitle || job.title,
          companyName: companyName || job.company,
        });
      } catch (error) {
        console.error("[scamDetectorRouter] Job extraction failed:", error);
        throw new Error(
          `Failed to extract job data: ${error instanceof Error ? error.message : "Unknown error"}`
        );
      }

      // Generate structured embedding for the extracted data
      let structuredEmbeddingPromise: Promise<number[]> | null = null;
      try {
        structuredEmbeddingPromise =
          embeddingService.embedStructuredData(extractionResult);
      } catch (error) {
        console.error(
          "[extractJobData] Failed to generate structured embedding:",
          error
        );
        // Continue without embedding - it's optional
      }

      // Save extraction to database
      const extraction = await prisma.jobExtraction.create({
        data: {
          jobId,
          ...extractionResult,
          extractedData: extractionResult, // Store full result for flexibility
          extractionModel: "gemini-2.0-flash-exp",
          extractionSource: "gemini",
        },
      });

      // If structured embedding was generated, add it using raw SQL
      if (structuredEmbeddingPromise) {
        try {
          const embedding = await structuredEmbeddingPromise;
          const vectorString = `[${embedding.join(",")}]`;
          await prisma.$executeRawUnsafe(
            `UPDATE scam_detector_job_extraction SET structured_embedding = $1::vector WHERE id = $2`,
            vectorString,
            extraction.id
          );
        } catch (error) {
          console.error(
            "[extractJobData] Failed to set structured embedding:",
            error
          );
        }
      }

      return { extractionId: extraction.id, ...extractionResult };
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

      // Generate embedding for the search query
      let queryEmbedding: number[];
      try {
        queryEmbedding = await embeddingService.embedText({ text: query });
      } catch (error) {
        console.error(
          "[searchJobs] Failed to generate query embedding:",
          error
        );
        throw new Error(
          "Failed to process search query. Please try again later."
        );
      }

      // Format embedding as PostgreSQL vector
      const vectorString = `[${queryEmbedding.join(",")}]`;

      // Perform cosine similarity search using raw SQL
      // Cosine distance (<->) returns smaller values for more similar vectors
      const results = await prisma.$queryRaw<
        Array<{
          id: string;
          title: string;
          company: string;
          description: string;
          url: string;
          location: string | null;
          salary: string | null;
          similarity: number;
        }>
      >`
        SELECT 
          id,
          title,
          company,
          description,
          url,
          location,
          salary,
          1 - (embedding <-> ${vectorString}::vector) AS similarity
        FROM scam_detector_job
        WHERE embedding IS NOT NULL
        ORDER BY embedding <-> ${vectorString}::vector
        LIMIT ${limit}
      `;

      return {
        results: results.map((r) => ({
          id: r.id,
          title: r.title,
          company: r.company,
          description: r.description,
          url: r.url,
          location: r.location,
          salary: r.salary,
          similarity: Number(r.similarity), // Convert to number (0-1, higher = more similar)
        })),
        count: results.length,
      };
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

      // 2. Check database cache (24-hour TTL)
      const cached = await prisma.scanCache.findUnique({
        where: { jobUrlHash },
      });

      if (cached && cached.expiresAt > new Date()) {
        return {
          riskScore: cached.riskScore,
          riskLevel:
            cached.riskScore < 40
              ? "safe"
              : cached.riskScore < 70
                ? "caution"
                : "danger",
          flags: cached.flags as Array<{
            type: string;
            confidence: "low" | "medium" | "high";
            message: string;
            reasoning?: string;
          }>,
          summary: "Analysis retrieved from cache",
          source: "cache",
        };
      }

      // 3. Call Gemini 2.0 Flash via AI Service
      let geminiResult;
      try {
        geminiResult = await aiService.analyzeJob({
          jobText,
          companyName,
          jobUrl,
        });
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

      // 4. Cache result in database (24-hour TTL)
      await prisma.scanCache.create({
        data: {
          jobUrlHash,
          riskScore: geminiResult.riskScore,
          flags: geminiResult.flags,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
        },
      });

      // 5. Try to save analysis to JobAnalysis if job exists
      try {
        const job = await prisma.job.findFirst({
          where: { jobUrlHash },
          orderBy: { scrapedAt: "desc" },
        });

        if (job) {
          await prisma.jobAnalysis.create({
            data: {
              jobId: job.id,
              riskScore: geminiResult.riskScore,
              riskLevel: geminiResult.riskLevel,
              flags: geminiResult.flags,
              summary: geminiResult.summary,
              analysisSource: "gemini",
            },
          });
        }
      } catch (error) {
        // Log but don't fail the request if JobAnalysis save fails
        console.error(
          "[scamDetectorRouter] Failed to save JobAnalysis:",
          error
        );
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
      await prisma.feedback.create({
        data: {
          jobUrlHash: input.jobUrlHash,
          feedbackType: input.feedbackType,
          details: input.details,
        },
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
});
