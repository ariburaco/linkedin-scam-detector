import { createHash } from "crypto";

import prisma from "@acme/db";
import { z } from "zod";

import { publicProcedure, protectedProcedure, router } from "../index";
import { aiService } from "../services/ai-service";

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

      let job;
      if (existingJob) {
        // Update existing job
        job = await prisma.job.update({
          where: { id: existingJob.id },
          data: {
            ...jobData,
            linkedinJobId: linkedinJobId || existingJob.linkedinJobId,
            jobUrlHash,
            postedAt,
            updatedAt: new Date(),
            rawData:
              input.rawData || (existingJob.rawData as Record<string, any>),
            scrapedBy: scrapedBy || existingJob.scrapedBy,
          },
        });
      } else {
        // Create new job
        job = await prisma.job.create({
          data: {
            linkedinJobId: linkedinJobId || null,
            jobUrlHash,
            url,
            ...jobData,
            postedAt,
            scrapedBy,
            rawData: input.rawData || undefined,
          },
        });
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

      return { extractionId: extraction.id, ...extractionResult };
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
});
