/**
 * Feature Flags Service
 * Manages feature flags stored in the database
 */

import prisma from "@acme/db";
import {
  DEFAULT_FEATURE_FLAGS,
  FEATURE_FLAG_KEYS,
  type FeatureFlags,
} from "@acme/shared/feature-flags";
import { Logger } from "@acme/shared/Logger";

const logger = new Logger("FeatureFlagsService");

export class FeatureFlagsService {
  /**
   * Get all feature flags
   */
  static async getAll(): Promise<FeatureFlags> {
    try {
      const flags = await prisma.featureFlag.findMany({
        where: {
          key: {
            in: Object.values(FEATURE_FLAG_KEYS),
          },
        },
      });

      // Build result with defaults for missing flags
      const result: FeatureFlags = { ...DEFAULT_FEATURE_FLAGS };

      for (const flag of flags) {
        const flagKey = flag.key as keyof FeatureFlags;
        if (flagKey in DEFAULT_FEATURE_FLAGS) {
          result[flagKey] = flag.enabled;
        }
      }

      return result;
    } catch (error) {
      logger.error("Failed to get feature flags", {
        error: error instanceof Error ? error.message : "Unknown error",
      });
      // Return defaults on error
      return DEFAULT_FEATURE_FLAGS;
    }
  }

  /**
   * Get a specific feature flag
   */
  static async get(key: string): Promise<boolean> {
    try {
      const flag = await prisma.featureFlag.findUnique({
        where: { key },
      });

      if (!flag) {
        // Return default if flag doesn't exist
        return DEFAULT_FEATURE_FLAGS[key as keyof FeatureFlags] ?? true;
      }

      return flag.enabled;
    } catch (error) {
      logger.error("Failed to get feature flag", {
        key,
        error: error instanceof Error ? error.message : "Unknown error",
      });
      // Return default on error
      return DEFAULT_FEATURE_FLAGS[key as keyof FeatureFlags] ?? true;
    }
  }

  /**
   * Set a feature flag
   */
  static async set(key: string, enabled: boolean): Promise<void> {
    try {
      await prisma.featureFlag.upsert({
        where: { key },
        create: {
          key,
          enabled,
        },
        update: {
          enabled,
        },
      });

      logger.info("Feature flag updated", { key, enabled });
    } catch (error) {
      logger.error("Failed to set feature flag", {
        key,
        enabled,
        error: error instanceof Error ? error.message : "Unknown error",
      });
      throw error;
    }
  }

  /**
   * Initialize default feature flags if they don't exist
   */
  static async initializeDefaults(): Promise<void> {
    try {
      for (const [key, defaultValue] of Object.entries(DEFAULT_FEATURE_FLAGS)) {
        await prisma.featureFlag.upsert({
          where: { key },
          create: {
            key,
            enabled: defaultValue,
            description: getFlagDescription(key),
          },
          update: {},
        });
      }

      logger.info("Feature flags initialized with defaults");
    } catch (error) {
      logger.error("Failed to initialize default feature flags", {
        error: error instanceof Error ? error.message : "Unknown error",
      });
      throw error;
    }
  }
}

function getFlagDescription(key: string): string {
  const descriptions: Record<string, string> = {
    [FEATURE_FLAG_KEYS.JOB_EXTRACTION]:
      "Enable/disable job data extraction workflow",
    [FEATURE_FLAG_KEYS.JOB_EMBEDDINGS]:
      "Enable/disable job embedding generation workflow",
    [FEATURE_FLAG_KEYS.JOB_DISCOVERY]:
      "Enable/disable job discovery from LinkedIn search pages",
  };
  return descriptions[key] ?? "Feature flag";
}
