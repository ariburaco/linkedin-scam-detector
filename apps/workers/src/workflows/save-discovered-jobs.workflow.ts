/**
 * Save Discovered Jobs Workflow
 * Processes discovered jobs from LinkedIn search/collection pages
 */

import { proxyActivities, workflowInfo } from "@temporalio/workflow";

import type {
  SaveDiscoveredJobsInput,
  SaveDiscoveredJobsOutput,
} from "../activities/discovered-job.activity";

// Configure activity options
const { saveDiscoveredJobs } = proxyActivities<{
  saveDiscoveredJobs: (
    input: SaveDiscoveredJobsInput
  ) => Promise<SaveDiscoveredJobsOutput>;
}>({
  startToCloseTimeout: "5 minutes",
  retry: {
    initialInterval: "1s",
    maximumInterval: "30s",
    backoffCoefficient: 2,
    maximumAttempts: 3,
  },
});

export interface SaveDiscoveredJobsWorkflowInput {
  jobs: SaveDiscoveredJobsInput["jobs"];
  discoveredBy?: string;
}

export interface SaveDiscoveredJobsWorkflowOutput {
  workflowId: string;
  created: number;
  updated: number;
  total: number;
}

/**
 * Save Discovered Jobs Workflow
 *
 * Steps:
 * 1. Save all discovered jobs to database with upsert logic
 * 2. Calculate priority scores for each job
 * 3. Return statistics
 */
export async function SaveDiscoveredJobs(
  input: SaveDiscoveredJobsWorkflowInput
): Promise<SaveDiscoveredJobsWorkflowOutput> {
  const { workflowId } = workflowInfo();

  // Add discoveredBy to all jobs
  const jobsWithUser = input.jobs.map((job) => ({
    ...job,
    discoveredBy: input.discoveredBy,
  }));

  // Save jobs to database
  const result = await saveDiscoveredJobs({
    jobs: jobsWithUser,
  });

  return {
    workflowId,
    created: result.created,
    updated: result.updated,
    total: result.total,
  };
}
