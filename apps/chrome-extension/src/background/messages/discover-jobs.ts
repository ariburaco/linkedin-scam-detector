/**
 * Message handler for discovering jobs from LinkedIn search/collection pages
 */

import { FEATURE_FLAG_KEYS } from "@acme/shared";
import type { PlasmoMessaging } from "@plasmohq/messaging";

import type { DiscoveredJobData } from "../../lib/linkedin-dom/types";
import {
  discoveredJobsCache,
  getJobId,
} from "../../lib/storage/discovered-jobs-cache";
import { getCachedFeatureFlags } from "../../lib/storage/feature-flags-cache";

import { callerApi } from "@/trpc/caller";

export interface DiscoverJobsRequestBody {
  jobs: DiscoveredJobData[];
}

export interface DiscoverJobsResponseBody {
  success: boolean;
}

/**
 * Plasmo message handler for discovering jobs
 */
const handler: PlasmoMessaging.MessageHandler<
  DiscoverJobsRequestBody,
  DiscoverJobsResponseBody
> = async (req, res) => {
  try {
    // Check if job discovery feature is enabled (using cached flags)
    const flags = await getCachedFeatureFlags();
    const discoveryEnabled = flags[FEATURE_FLAG_KEYS.JOB_DISCOVERY] ?? true;

    if (!discoveryEnabled) {
      // Silently return success - feature is disabled
      res.send({ success: true });
      return;
    }

    const jobs = req.body?.jobs;

    if (!jobs || jobs.length === 0) {
      res.send({ success: true });
      return;
    }

    // Deduplicate by LinkedIn ID (user might scroll past same jobs)
    const uniqueJobs = Array.from(
      new Map(jobs.map((j: DiscoveredJobData) => [j.linkedinJobId, j])).values()
    );

    if (uniqueJobs.length === 0) {
      res.send({ success: true });
      return;
    }

    // Filter out already processed jobs (fail open if cache fails)
    let unprocessedJobs = uniqueJobs;
    try {
      const jobIds = uniqueJobs.map(getJobId);
      const unprocessedJobIds = await discoveredJobsCache.filterProcessed(jobIds);
      unprocessedJobs = uniqueJobs.filter((job) =>
        unprocessedJobIds.includes(job.linkedinJobId)
      );
    } catch (error) {
      console.warn(
        "[DiscoverJobs] Failed to filter processed jobs, proceeding with all jobs:",
        error
      );
      // Fail open - proceed with all jobs if cache fails
    }

    const stats = {
      total: uniqueJobs.length,
      alreadyProcessed: uniqueJobs.length - unprocessedJobs.length,
      toSend: unprocessedJobs.length,
    };

    if (unprocessedJobs.length === 0) {
      console.log(
        `[DiscoverJobs] All ${stats.total} jobs already processed, skipping API call`
      );
      res.send({ success: true });
      return;
    }

    console.log(
      `[DiscoverJobs] Processing ${stats.toSend}/${stats.total} jobs (${stats.alreadyProcessed} already processed)`
    );

    // Batch send (max 50 at a time to avoid payload size issues)
    const batchSize = 50;
    const processedJobIds: string[] = [];

    try {
      for (let i = 0; i < unprocessedJobs.length; i += batchSize) {
        const batch = unprocessedJobs.slice(
          i,
          i + batchSize
        ) as DiscoveredJobData[];
        await callerApi.scamDetector.discoverJobs.mutate({
          jobs: batch,
        });

        // Mark as processed after successful API call
        const batchIds = batch.map(getJobId);
        processedJobIds.push(...batchIds);
      }

      // Mark all successfully sent jobs as processed (fail silently if cache write fails)
      if (processedJobIds.length > 0) {
        try {
          await discoveredJobsCache.markProcessedBatch(processedJobIds);
        } catch (error) {
          console.warn(
            "[DiscoverJobs] Failed to mark jobs as processed:",
            error
          );
          // Don't fail the request if cache write fails
        }
      }

      console.log(
        `[DiscoverJobs] Successfully processed ${processedJobIds.length} jobs`
      );
      res.send({ success: true });
    } catch (error) {
      console.error("[DiscoverJobs] Failed to send jobs:", error);
      // Don't mark as processed if API call failed
      res.send({ success: false });
    }
  } catch (error) {
    console.error("[Background] Failed to discover jobs:", error);
    res.send({
      success: false,
    });
  }
};

export default handler;
