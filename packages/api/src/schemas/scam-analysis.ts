import { z } from "zod";

/**
 * Schema for individual red flag detected in job posting
 */
export const redFlagSchema = z.object({
  type: z.string().describe("Flag category (e.g., 'personal_email', 'upfront_payment')"),
  confidence: z.enum(["low", "medium", "high"]).describe("Confidence level of the flag"),
  message: z.string().describe("User-friendly explanation of the flag"),
  reasoning: z.string().describe("Detailed reasoning why this is a red flag"),
});

export type RedFlag = z.infer<typeof redFlagSchema>;

/**
 * Schema for complete scam analysis result from Gemini AI
 */
export const scamAnalysisSchema = z.object({
  riskScore: z
    .number()
    .min(0)
    .max(100)
    .describe("Overall risk score from 0-100"),
  riskLevel: z
    .enum(["safe", "caution", "danger"])
    .describe("Risk level category"),
  flags: z
    .array(redFlagSchema)
    .describe("Array of detected red flags"),
  summary: z
    .string()
    .describe("One-sentence summary of the analysis"),
});

export type ScamAnalysisResult = z.infer<typeof scamAnalysisSchema>;

/**
 * Schema for job analysis input
 */
export const jobAnalysisInputSchema = z.object({
  jobText: z.string().min(10),
  jobTitle: z.string().optional(),
  companyName: z.string().optional(),
  jobUrl: z.string().url().optional(),
});

export type JobAnalysisInput = z.infer<typeof jobAnalysisInputSchema>;

