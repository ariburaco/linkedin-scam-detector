import { createHash } from "crypto";

import prisma from "@acme/db";
import { z } from "zod";

import { router, publicProcedure } from "../index";
import { aiService } from "../services/ai-service";

import { globalCacheMiddleware } from "./middlewares/trpc-cache";

export const scamDetectorRouter = router({
  // Scan a job posting
  scanJob: publicProcedure
    .input(
      z.object({
        jobText: z.string().min(10),
        jobUrl: z.string().url(),
        companyName: z.string().optional(),
      })
    )
    .use(globalCacheMiddleware)
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

      // 5. Return result
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
