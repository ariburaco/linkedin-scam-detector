import { createHash } from "crypto";

import prisma from "@acme/db";
import { z } from "zod";

import { router, publicProcedure } from "../index";

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
    .mutation(async ({ input }) => {
      const { jobUrl } = input;
      // jobText and companyName will be used in Task 3 for Gemini integration

      // 1. Generate URL hash
      const jobUrlHash = createHash("sha256").update(jobUrl).digest("hex");

      // 2. Check database cache (24-hour TTL)
      const cached = await prisma.scanCache.findUnique({
        where: { jobUrlHash },
      });

      if (cached && cached.expiresAt > new Date()) {
        return {
          riskScore: cached.riskScore,
          flags: cached.flags as Array<{
            type: string;
            confidence: "low" | "medium" | "high";
            message: string;
            reasoning?: string;
          }>,
          source: "cache",
        };
      }

      // 3. TODO: Call Gemini 2.0 Flash via Vercel AI SDK
      // This will be implemented in Task 3
      // For now, return a placeholder response
      const placeholderResult = {
        riskScore: 50,
        riskLevel: "caution" as const,
        flags: [],
        summary: "Analysis pending - Gemini integration coming in Task 3",
      };

      // 4. Cache result in database (24-hour TTL)
      await prisma.scanCache.create({
        data: {
          jobUrlHash,
          riskScore: placeholderResult.riskScore,
          flags: placeholderResult.flags,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
        },
      });

      // 5. Return result
      return {
        ...placeholderResult,
        source: "placeholder",
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
