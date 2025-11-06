/**
 * Process Discovered Jobs Workflow
 * Processes discovered jobs by scraping full details and creating Job entries
 */

import { proxyActivities, workflowInfo } from '@temporalio/workflow';
import type * as activities from '../activities';

// Proxy activities
const { getUnprocessedDiscoveredJobs, processDiscoveredJobToJob } =
  proxyActivities<typeof activities>({
    startToCloseTimeout: '10 minutes',
    retry: {
      initialInterval: '5s',
      backoffCoefficient: 2,
      maximumAttempts: 3,
    },
  });

export interface ProcessDiscoveredJobsWorkflowInput {
  batchSize?: number;
  limit?: number; // Maximum number of jobs to process (stops early if reached)
  priority?: boolean;
  triggerExtraction?: boolean;
  triggerEmbedding?: boolean;
}

export interface ProcessDiscoveredJobsWorkflowOutput {
  workflowId: string;
  processed: number;
  failed: number;
  skipped: number;
  total: number;
}

/**
 * Process Discovered Jobs Workflow
 *
 * Steps:
 * 1. Get batch of unprocessed discovered jobs
 * 2. For each job:
 *    - Scrape full details
 *    - Create Job entry
 *    - Update DiscoveredJob status
 *    - Optionally trigger extraction/embedding workflows
 */
export async function ProcessDiscoveredJobs(
  input: ProcessDiscoveredJobsWorkflowInput = {}
): Promise<ProcessDiscoveredJobsWorkflowOutput> {
  const { workflowId } = workflowInfo();
  const batchSize = input.batchSize ?? 50;
  const limit = input.limit; // Optional limit on how many to process
  const priority = input.priority ?? true;

  // Step 1: Get unprocessed discovered jobs
  // If limit is specified, fetch at least that many (or batchSize, whichever is larger)
  const fetchLimit = limit && limit > batchSize ? limit : batchSize;
  const { jobs, count } = await getUnprocessedDiscoveredJobs({
    limit: fetchLimit,
    priority,
  });

  if (count === 0) {
    return {
      workflowId,
      processed: 0,
      failed: 0,
      skipped: 0,
      total: 0,
    };
  }

  // Step 2: Process each job (up to limit if specified)
  let processed = 0;
  let failed = 0;
  let skipped = 0;
  const jobsToProcess = limit ? jobs.slice(0, limit) : jobs;
  const totalToProcess = jobsToProcess.length;

  for (const discoveredJob of jobsToProcess) {
    try {
      // Process discovered job to full job
      const result = await processDiscoveredJobToJob({
        discoveredJobId: discoveredJob.id,
      });

      if (result.success) {
        processed++;

        // Note: Extraction and embedding workflows would be triggered here
        // if feature flags are enabled, but we'll handle that in a separate
        // workflow or via Temporal signals/updates to keep this workflow simple
        // For now, we just create the Job entry
      } else {
        failed++;
      }
    } catch (error) {
      failed++;
      // Error is already logged in the activity
    }
  }

  return {
    workflowId,
    processed,
    failed,
    skipped,
    total: totalToProcess, // Return the number we actually attempted to process
  };
}
