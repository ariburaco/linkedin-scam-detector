/**
 * Feature Flags Cache
 * Caches feature flags in memory with TTL to reduce API calls
 */

import type { FeatureFlags } from "@acme/shared";

import {
  getFeatureFlagOverrides,
  mergeFeatureFlags,
} from "./feature-flags-storage";

import { callerApi } from "@/trpc/caller";

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
let cachedFlags: FeatureFlags | null = null;
let cacheTimestamp: number = 0;

/**
 * Get cached feature flags (with TTL)
 * Fetches from API if cache is expired or missing
 */
export async function getCachedFeatureFlags(): Promise<FeatureFlags> {
  const now = Date.now();
  const isCacheValid = cachedFlags && now - cacheTimestamp < CACHE_TTL;

  if (isCacheValid) {
    // Merge with local overrides (which can change independently)
    const localOverrides = await getFeatureFlagOverrides();
    return mergeFeatureFlags(cachedFlags, localOverrides);
  }

  try {
    // Fetch fresh flags from server
    const serverFlags = await callerApi.featureFlags.getAll.query();

    // Update cache
    cachedFlags = serverFlags;
    cacheTimestamp = now;

    // Merge with local overrides
    const localOverrides = await getFeatureFlagOverrides();
    return mergeFeatureFlags(serverFlags, localOverrides);
  } catch (error) {
    console.error("[FeatureFlagsCache] Failed to fetch flags:", error);

    // If we have stale cache, use it (fail gracefully)
    if (cachedFlags) {
      const localOverrides = await getFeatureFlagOverrides();
      return mergeFeatureFlags(cachedFlags, localOverrides);
    }

    // Last resort: return defaults
    return {
      job_extraction: true,
      job_embeddings: true,
      job_discovery: true,
    };
  }
}

/**
 * Invalidate the cache (force refresh on next call)
 */
export function invalidateFeatureFlagsCache(): void {
  cachedFlags = null;
  cacheTimestamp = 0;
}

/**
 * Get cached flags without fetching (returns null if cache expired)
 */
export function getCachedFlagsOnly(): FeatureFlags | null {
  const now = Date.now();
  const isCacheValid = cachedFlags && now - cacheTimestamp < CACHE_TTL;
  return isCacheValid ? cachedFlags : null;
}
