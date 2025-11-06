/**
 * Discovered Job Activities
 * Activities for processing discovered jobs from LinkedIn
 */

import { Logger } from '@acme/shared/Logger';

import type { CreateDiscoveredJobInput } from '@acme/api/services/discovered-job.service';
import { DiscoveredJobService } from '@acme/api/services/discovered-job.service';

const logger = new Logger('DiscoveredJobActivity');

export interface SaveDiscoveredJobsInput {
  jobs: CreateDiscoveredJobInput[];
}

export interface SaveDiscoveredJobsOutput {
  created: number;
  updated: number;
  total: number;
}

/**
 * Save discovered jobs to database
 */
export async function saveDiscoveredJobs(
  input: SaveDiscoveredJobsInput
): Promise<SaveDiscoveredJobsOutput> {
  logger.info('Saving discovered jobs', {
    count: input.jobs.length,
  });

  const results = await DiscoveredJobService.bulkCreateOrUpdate(input.jobs);

  logger.info('Discovered jobs saved successfully', {
    total: input.jobs.length,
    created: results.created,
    updated: results.updated,
  });

  return {
    total: input.jobs.length,
    created: results.created,
    updated: results.updated,
  };
}
