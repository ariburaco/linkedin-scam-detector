/**
 * Discovered Jobs Cache
 * Tracks processed discovered job IDs to prevent duplicate API calls
 */

import { ProcessedItemsCache } from "./processed-items-cache";

// Cache name and TTL configuration
const CACHE_NAME = "discovered_jobs";
const TTL_DAYS = 30;
const TTL_MS = TTL_DAYS * 24 * 60 * 60 * 1000;

/**
 * Cache instance for discovered jobs
 * Uses LinkedIn job ID as the key
 */
export const discoveredJobsCache = new ProcessedItemsCache<string>(
  CACHE_NAME,
  TTL_MS
);

/**
 * Helper to extract LinkedIn job ID from DiscoveredJobData
 */
export function getJobId(job: { linkedinJobId: string }): string {
  return job.linkedinJobId;
}
