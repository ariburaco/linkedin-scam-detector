/**
 * Feature Flags Storage
 * Manages local feature flag overrides using Plasmo Storage
 */

import type { FeatureFlags } from "@acme/shared";
import { Storage } from "@plasmohq/storage";

const storage = new Storage({ area: "local" });

const STORAGE_KEY = "feature_flags_overrides";

/**
 * Get local feature flag overrides
 */
export async function getFeatureFlagOverrides(): Promise<Partial<FeatureFlags> | null> {
  try {
    const overrides = await storage.get<Partial<FeatureFlags>>(STORAGE_KEY);
    return overrides ?? null;
  } catch (error) {
    console.error("[FeatureFlagsStorage] Failed to get overrides:", error);
    return null;
  }
}

/**
 * Set a feature flag override
 */
export async function setFeatureFlagOverride(
  key: keyof FeatureFlags,
  enabled: boolean
): Promise<void> {
  try {
    const overrides = (await getFeatureFlagOverrides()) || {};
    overrides[key] = enabled;
    await storage.set(STORAGE_KEY, overrides);
  } catch (error) {
    console.error("[FeatureFlagsStorage] Failed to set override:", error);
    throw error;
  }
}

/**
 * Remove a feature flag override (revert to server default)
 */
export async function removeFeatureFlagOverride(
  key: keyof FeatureFlags
): Promise<void> {
  try {
    const overrides = (await getFeatureFlagOverrides()) || {};
    delete overrides[key];
    if (Object.keys(overrides).length === 0) {
      await storage.remove(STORAGE_KEY);
    } else {
      await storage.set(STORAGE_KEY, overrides);
    }
  } catch (error) {
    console.error("[FeatureFlagsStorage] Failed to remove override:", error);
    throw error;
  }
}

/**
 * Clear all feature flag overrides
 */
export async function clearFeatureFlagOverrides(): Promise<void> {
  try {
    await storage.remove(STORAGE_KEY);
  } catch (error) {
    console.error("[FeatureFlagsStorage] Failed to clear overrides:", error);
    throw error;
  }
}

/**
 * Merge server flags with local overrides
 * Local overrides take precedence
 */
export function mergeFeatureFlags(
  serverFlags: FeatureFlags | null,
  localOverrides: Partial<FeatureFlags> | null
): FeatureFlags {
  if (!localOverrides || !serverFlags) {
    return serverFlags ?? ({} as FeatureFlags);
  }

  return {
    ...serverFlags,
    ...localOverrides,
  };
}
