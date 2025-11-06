/**
 * Feature Flags Router
 * Manages feature flags for the application
 */

import { z } from "zod";

import { publicProcedure, protectedProcedure, router } from "../index";
import { FEATURE_FLAG_KEYS, type FeatureFlags } from "../schemas/feature-flags";
import { FeatureFlagsService } from "../services/feature-flags.service";

export const featureFlagsRouter = router({
  /**
   * Get all feature flags (public endpoint for extension)
   */
  getAll: publicProcedure.query(async (): Promise<FeatureFlags> => {
    return FeatureFlagsService.getAll();
  }),

  /**
   * Get a specific feature flag
   */
  get: publicProcedure
    .input(
      z.object({
        key: z.enum([
          FEATURE_FLAG_KEYS.JOB_EXTRACTION,
          FEATURE_FLAG_KEYS.JOB_EMBEDDINGS,
          FEATURE_FLAG_KEYS.JOB_DISCOVERY,
        ]),
      })
    )
    .query(async ({ input }) => {
      return FeatureFlagsService.get(input.key);
    }),

  /**
   * Set a feature flag (protected - admin only)
   */
  set: protectedProcedure
    .input(
      z.object({
        key: z.enum([
          FEATURE_FLAG_KEYS.JOB_EXTRACTION,
          FEATURE_FLAG_KEYS.JOB_EMBEDDINGS,
          FEATURE_FLAG_KEYS.JOB_DISCOVERY,
        ]),
        enabled: z.boolean(),
      })
    )
    .mutation(async ({ input }) => {
      await FeatureFlagsService.set(input.key, input.enabled);
      return { success: true };
    }),

  /**
   * Initialize default feature flags (protected - admin only)
   */
  initializeDefaults: protectedProcedure.mutation(async () => {
    await FeatureFlagsService.initializeDefaults();
    return { success: true };
  }),
});
