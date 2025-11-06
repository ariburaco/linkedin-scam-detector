import { z } from "zod";

/**
 * Schema for extracted job requirement
 */
export const requirementSchema = z.object({
  type: z.enum([
    "skill",
    "experience",
    "education",
    "certification",
    "language",
    "other",
  ]),
  name: z.string(),
  required: z.boolean().optional(),
  level: z.string().optional(), // e.g., "3+ years", "Expert", "Beginner"
  description: z.string().optional(),
});

/**
 * Schema for extracted job responsibility
 */
export const responsibilitySchema = z.object({
  title: z.string(),
  description: z.string().optional(),
});

/**
 * Schema for extracted benefit/perk
 */
export const benefitSchema = z.object({
  type: z.string(), // e.g., "health insurance", "401k", "remote work", etc.
  description: z.string().optional(),
});

/**
 * Schema for extracted qualification
 */
export const qualificationSchema = z.object({
  type: z.enum(["education", "experience", "certification", "skill", "other"]),
  value: z.string(),
  required: z.boolean().optional(),
});

/**
 * Schema for extracted skill with category
 */
export const skillSchema = z.object({
  name: z.string(),
  category: z
    .enum(["technical", "soft", "language", "tool", "framework", "other"])
    .optional(),
  required: z.boolean().optional(),
  experience: z.string().optional(), // e.g., "2+ years", "Expert level"
});

/**
 * Schema for complete job extraction result
 */
export const jobExtractionSchema = z.object({
  // Requirements array
  requirements: z.array(requirementSchema).optional(),

  // Responsibilities array
  responsibilities: z.array(responsibilitySchema).optional(),

  // Benefits/perks array
  benefits: z.array(benefitSchema).optional(),

  // Qualifications array
  qualifications: z.array(qualificationSchema).optional(),

  // Skills array (structured)
  skills: z.array(skillSchema).optional(),

  // Structured salary data
  salaryMin: z.number().optional(),
  salaryMax: z.number().optional(),
  salaryCurrency: z.string().optional(), // USD, EUR, GBP, etc.
  salaryPeriod: z.enum(["hourly", "monthly", "yearly"]).optional(),

  // Experience level
  experienceLevel: z.enum(["entry", "mid", "senior", "executive"]).optional(),

  // Education level
  educationLevel: z
    .enum(["high-school", "associate", "bachelor", "master", "phd", "none"])
    .optional(),

  // Work type and schedule
  workType: z.enum(["remote", "hybrid", "on-site"]).optional(),
  workSchedule: z
    .enum(["full-time", "part-time", "contract", "temporary", "internship"])
    .optional(),
});

export type Requirement = z.infer<typeof requirementSchema>;
export type Responsibility = z.infer<typeof responsibilitySchema>;
export type Benefit = z.infer<typeof benefitSchema>;
export type Qualification = z.infer<typeof qualificationSchema>;
export type Skill = z.infer<typeof skillSchema>;
export type JobExtractionResult = z.infer<typeof jobExtractionSchema>;
