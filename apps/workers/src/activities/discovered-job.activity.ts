/**
 * Discovered Job Activities
 * Activities for processing discovered jobs from LinkedIn
 */

import { Logger } from '@acme/shared/Logger';
import { createHash } from 'crypto';
import prisma from '@acme/db';

import type { CreateDiscoveredJobInput } from '@acme/api/services/discovered-job.service';
import { DiscoveredJobService } from '@acme/api/services/discovered-job.service';
import { JobService } from '@acme/api/services/job.service';
import { parsePostedDate } from '@acme/api/utils/date-utils';
import { scrapeLinkedInJobDetails } from './linkedin-scraper.activity';

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

/**
 * Get unprocessed discovered jobs
 */
export interface GetUnprocessedDiscoveredJobsInput {
  limit?: number;
  priority?: boolean;
}

export interface GetUnprocessedDiscoveredJobsOutput {
  jobs: Array<{
    id: string;
    linkedinJobId: string;
    url: string;
    title: string;
    company: string;
    location?: string | null;
    employmentType?: string | null;
    workType?: string | null;
    isPromoted: boolean;
    isEasyApply: boolean;
    hasVerified: boolean;
    insight?: string | null;
    postedDate?: string | null;
    companyLogoUrl?: string | null;
    discoveredBy?: string | null;
    discoverySource: string;
    discoveryUrl?: string | null;
    rawData?: Record<string, unknown> | null;
  }>;
  count: number;
}

export async function getUnprocessedDiscoveredJobs(
  input: GetUnprocessedDiscoveredJobsInput = {}
): Promise<GetUnprocessedDiscoveredJobsOutput> {
  const limit = input.limit ?? 50;
  const priority = input.priority ?? true;

  logger.info('Getting unprocessed discovered jobs', {
    limit,
    priority,
  });

  const discoveredJobs = await DiscoveredJobService.getUnprocessedJobs(
    limit,
    priority
  );

  const jobs = discoveredJobs.map((dj) => ({
    id: dj.id,
    linkedinJobId: dj.linkedinJobId,
    url: dj.url,
    title: dj.title,
    company: dj.company,
    location: dj.location,
    employmentType: dj.employmentType,
    workType: dj.workType,
    isPromoted: dj.isPromoted,
    isEasyApply: dj.isEasyApply,
    hasVerified: dj.hasVerified,
    insight: dj.insight,
    postedDate: dj.postedDate,
    companyLogoUrl: dj.companyLogoUrl,
    discoveredBy: dj.discoveredBy,
    discoverySource: dj.discoverySource,
    discoveryUrl: dj.discoveryUrl,
    rawData: dj.rawData as Record<string, unknown> | null,
  }));

  logger.info('Retrieved unprocessed discovered jobs', {
    count: jobs.length,
  });

  return {
    jobs,
    count: jobs.length,
  };
}

/**
 * Process discovered job to full job
 */
export interface ProcessDiscoveredJobToJobInput {
  discoveredJobId: string;
}

export interface ProcessDiscoveredJobToJobOutput {
  jobId: string;
  linkedinJobId: string;
  success: boolean;
  error?: string;
}

export async function processDiscoveredJobToJob(
  input: ProcessDiscoveredJobToJobInput
): Promise<ProcessDiscoveredJobToJobOutput> {
  logger.info('Processing discovered job to full job', {
    discoveredJobId: input.discoveredJobId,
  });

  try {
    // Mark as processing
    await DiscoveredJobService.markAsProcessing(input.discoveredJobId);

    // Get discovered job
    const discoveredJobRecord = await prisma.discoveredJob.findUnique({
      where: { id: input.discoveredJobId },
    });

    if (!discoveredJobRecord) {
      throw new Error(`Discovered job not found: ${input.discoveredJobId}`);
    }

    const discoveredJob = await DiscoveredJobService.findByLinkedInId(
      discoveredJobRecord.linkedinJobId
    );

    if (!discoveredJob) {
      throw new Error(
        `Discovered job not found by LinkedIn ID: ${discoveredJobRecord.linkedinJobId}`
      );
    }

    // Check if job already exists
    const jobExists = await JobService.existsByLinkedInId(
      discoveredJob.linkedinJobId
    );
    if (jobExists) {
      logger.info('Job already exists, marking as completed', {
        linkedinJobId: discoveredJob.linkedinJobId,
      });
      const existingJob = await JobService.findByLinkedInId(
        discoveredJob.linkedinJobId
      );
      if (existingJob) {
        await DiscoveredJobService.markAsCompleted(
          input.discoveredJobId,
          existingJob.id
        );
        return {
          jobId: existingJob.id,
          linkedinJobId: discoveredJob.linkedinJobId,
          success: true,
        };
      }
    }

    // Scrape full job details
    logger.info('Scraping full job details', {
      url: discoveredJob.url,
      linkedinJobId: discoveredJob.linkedinJobId,
    });

    const scrapedDetails = await scrapeLinkedInJobDetails({
      url: discoveredJob.url,
      linkedinJobId: discoveredJob.linkedinJobId,
    });

    if (!scrapedDetails) {
      throw new Error('Failed to scrape job details');
    }

    // Create job URL hash
    const jobUrlHash = createHash('sha256')
      .update(scrapedDetails.url)
      .digest('hex');

    // Create Job entry
    const job = await JobService.createOrUpdate({
      linkedinJobId: scrapedDetails.linkedinJobId,
      jobUrlHash,
      url: scrapedDetails.url,
      title: scrapedDetails.title,
      company: scrapedDetails.company,
      description: scrapedDetails.description || '',
      location: scrapedDetails.location || null,
      salary: scrapedDetails.salary || null,
      employmentType: scrapedDetails.employmentType || null,
      postedAt: parsePostedDate(scrapedDetails.postedDate),
      scrapedBy: discoveredJob.discoveredBy || null,
      rawData: scrapedDetails.rawData || null,
    });

    // Update discovered job as completed
    await DiscoveredJobService.markAsCompleted(input.discoveredJobId, job.id);

    logger.info('Successfully processed discovered job to full job', {
      discoveredJobId: input.discoveredJobId,
      jobId: job.id,
      linkedinJobId: job.linkedinJobId,
    });

    return {
      jobId: job.id,
      linkedinJobId: job.linkedinJobId || discoveredJob.linkedinJobId,
      success: true,
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';
    logger.error('Failed to process discovered job to full job', {
      discoveredJobId: input.discoveredJobId,
      error: errorMessage,
    });

    // Mark as failed
    await DiscoveredJobService.markAsFailed(
      input.discoveredJobId,
      errorMessage
    );

    return {
      jobId: '',
      linkedinJobId: '',
      success: false,
      error: errorMessage,
    };
  }
}
