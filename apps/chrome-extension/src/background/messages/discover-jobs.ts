/**
 * Message handler for discovering jobs from LinkedIn search/collection pages
 */

import type { PlasmoMessaging } from "@plasmohq/messaging";

import type { DiscoveredJobData } from "../../lib/linkedin-dom/types";
import { callerApi } from "../../trpc/caller";

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

    // Batch send (max 50 at a time to avoid payload size issues)
    const batchSize = 50;

    for (let i = 0; i < uniqueJobs.length; i += batchSize) {
      const batch = uniqueJobs.slice(i, i + batchSize) as DiscoveredJobData[];
      await callerApi.scamDetector.discoverJobs.mutate({
        jobs: batch,
      });
    }

    res.send({ success: true });
  } catch (error) {
    console.error("[Background] Failed to discover jobs:", error);
    res.send({
      success: false,
    });
  }
};

export default handler;
