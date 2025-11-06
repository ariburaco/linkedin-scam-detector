/**
 * Feature Flags Hook
 * Fetches feature flags from the API and merges with local overrides
 */

import type { RouterOutputs } from "@acme/api";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import {
  getFeatureFlagOverrides,
  mergeFeatureFlags,
  setFeatureFlagOverride,
  removeFeatureFlagOverride,
  clearFeatureFlagOverrides,
} from "../lib/storage/feature-flags-storage";
import { callerApi } from "../trpc/caller";

const FEATURE_FLAGS_CACHE_KEY = "feature-flags";
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

type FeatureFlags = RouterOutputs["featureFlags"]["getAll"];

export function useFeatureFlags() {
  const queryClient = useQueryClient();
  const [localOverrides, setLocalOverrides] =
    useState<Partial<FeatureFlags> | null>(null);

  // Fetch server-side feature flags
  const {
    data: serverFlags,
    isLoading: isLoadingServer,
    error,
  } = useQuery<FeatureFlags>({
    queryKey: [FEATURE_FLAGS_CACHE_KEY],
    queryFn: async () => {
      return await callerApi.featureFlags.getAll.query();
    },
    staleTime: CACHE_DURATION,
    gcTime: CACHE_DURATION,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
    retry: 2,
  });

  // Load local overrides from storage
  useEffect(() => {
    getFeatureFlagOverrides().then(setLocalOverrides);
  }, []);

  // Merge server flags with local overrides
  const mergedFlags: FeatureFlags | undefined = serverFlags
    ? mergeFeatureFlags(serverFlags, localOverrides)
    : undefined;

  // Helper to set a feature flag override
  const setOverride = async (
    key: keyof FeatureFlags,
    enabled: boolean
  ): Promise<void> => {
    await setFeatureFlagOverride(key, enabled);
    const updated = await getFeatureFlagOverrides();
    setLocalOverrides(updated);
    // Invalidate cache to trigger re-render
    queryClient.invalidateQueries({ queryKey: [FEATURE_FLAGS_CACHE_KEY] });
  };

  // Helper to remove a feature flag override
  const removeOverride = async (key: keyof FeatureFlags): Promise<void> => {
    await removeFeatureFlagOverride(key);
    const updated = await getFeatureFlagOverrides();
    setLocalOverrides(updated);
    queryClient.invalidateQueries({ queryKey: [FEATURE_FLAGS_CACHE_KEY] });
  };

  // Helper to clear all overrides
  const clearOverrides = async (): Promise<void> => {
    await clearFeatureFlagOverrides();
    setLocalOverrides(null);
    queryClient.invalidateQueries({ queryKey: [FEATURE_FLAGS_CACHE_KEY] });
  };

  return {
    flags: mergedFlags,
    serverFlags,
    localOverrides,
    isLoading: isLoadingServer,
    error,
    // Convenience getters (use merged flags)
    isJobExtractionEnabled: mergedFlags?.job_extraction ?? true,
    isJobEmbeddingsEnabled: mergedFlags?.job_embeddings ?? true,
    isJobDiscoveryEnabled: mergedFlags?.job_discovery ?? true,
    // Override management functions
    setOverride,
    removeOverride,
    clearOverrides,
  };
}
