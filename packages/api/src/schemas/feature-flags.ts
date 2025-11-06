/**
 * Feature Flags Schema
 * Re-exports types and creates Zod schemas for tRPC type inference
 */

import { z } from "zod";

import {
  FEATURE_FLAG_KEYS,
  type FeatureFlags,
} from "@acme/shared/feature-flags";

// Re-export types for use in API package
export type { FeatureFlags, FeatureFlagKey } from "@acme/shared/feature-flags";
export { FEATURE_FLAG_KEYS } from "@acme/shared/feature-flags";

/**
 * Zod schema for FeatureFlags
 * Ensures proper type inference in tRPC routers
 */
export const featureFlagsSchema = z.object({
  [FEATURE_FLAG_KEYS.JOB_EXTRACTION]: z.boolean(),
  [FEATURE_FLAG_KEYS.JOB_EMBEDDINGS]: z.boolean(),
  [FEATURE_FLAG_KEYS.JOB_DISCOVERY]: z.boolean(),
}) satisfies z.ZodType<FeatureFlags>;
