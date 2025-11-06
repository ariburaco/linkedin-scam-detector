/**
 * Message handler for getting feature flags
 * Returns merged flags (server + local overrides)
 */

import type { PlasmoMessaging } from "@plasmohq/messaging";

import { getCachedFeatureFlags } from "../../lib/storage/feature-flags-cache";

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
    // Get cached flags (with local overrides already merged)
    const flags = await getCachedFeatureFlags();
    res.send({ flags });
  } catch (error) {
    console.error("[Background] Failed to get feature flags:", error);
    // Return null on error - fail open (assume features enabled)
    res.send({ flags: null });
  }
};

export default handler;
