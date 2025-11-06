/**
 * Message handler for getting feature flags
 * Returns merged flags (server + local overrides)
 */

import type { PlasmoMessaging } from "@plasmohq/messaging";

import {
  getFeatureFlagOverrides,
  mergeFeatureFlags,
} from "../../lib/storage/feature-flags-storage";
import { callerApi } from "../../trpc/caller";

export interface GetFeatureFlagsRequestBody {
  // Empty - no input needed
}

export interface GetFeatureFlagsResponseBody {
  flags: {
    job_extraction: boolean;
    job_embeddings: boolean;
    job_discovery: boolean;
  } | null;
}

/**
 * Plasmo message handler for getting feature flags
 * Merges server flags with local overrides
 */
const handler: PlasmoMessaging.MessageHandler<
  GetFeatureFlagsRequestBody,
  GetFeatureFlagsResponseBody
> = async (req, res) => {
  try {
    // Get server flags
    const serverFlags = await callerApi.featureFlags.getAll.query();

    // Get local overrides
    const localOverrides = await getFeatureFlagOverrides();

    // Merge flags (local overrides take precedence)
    const mergedFlags = mergeFeatureFlags(serverFlags, localOverrides);

    res.send({ flags: mergedFlags });
  } catch (error) {
    console.error("[Background] Failed to get feature flags:", error);
    // Return null on error - fail open (assume features enabled)
    res.send({ flags: null });
  }
};

export default handler;
