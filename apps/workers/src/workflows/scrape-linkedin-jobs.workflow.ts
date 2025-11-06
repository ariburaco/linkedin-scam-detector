/**
 * Scrape LinkedIn Jobs Workflow
 * Orchestrates LinkedIn job scraping and saving
 */

import { proxyActivities, workflowInfo } from "@temporalio/workflow";

import type { ScrapeJobSearchParams } from "@acme/scraper";

// Import activities
const { scrapeLinkedInJobs, scrapeLinkedInJobDetails } = proxyActivities<{
  scrapeLinkedInJobs: (
    params: ScrapeJobSearchParams
  ) => Promise<Array<{ linkedinJobId: string; url: string; title: string; company: string; location?: string; employmentType?: string; workType?: string; isPromoted?: boolean; isEasyApply?: boolean; hasVerified?: boolean; insight?: string; postedDate?: string; companyLogoUrl?: string; discoverySource: string; discoveryUrl?: string; rawData?: Record<string, unknown> }>>;
  scrapeLinkedInJobDetails: (
    params: { url: string; linkedinJobId?: string }
  ) => Promise<{ linkedinJobId: string; url: string; title: string; company: string; location?: string; employmentType?: string; workType?: string; isPromoted?: boolean; isEasyApply?: boolean; hasVerified?: boolean; insight?: string; postedDate?: string; companyLogoUrl?: string; discoverySource: string; discoveryUrl?: string; rawData?: Record<string, unknown> } | null>;
}>({
  startToCloseTimeout: "10 minutes",
  retry: {
    initialInterval: "5s",
    backoffCoefficient: 2,
    maximumAttempts: 3,
  },
});

const { saveDiscoveredJobs } = proxyActivities<{
  saveDiscoveredJobs: (input: {
    jobs: Array<{
      linkedinJobId: string;
      url: string;
      title: string;
      company: string;
      location?: string;
      employmentType?: string;
      workType?: string;
      isPromoted?: boolean;
      isEasyApply?: boolean;
      hasVerified?: boolean;
      insight?: string;
      postedDate?: string;
      companyLogoUrl?: string;
      discoverySource: string;
      discoveryUrl?: string;
      rawData?: Record<string, unknown>;
    }>;
  }) => Promise<{ created: number; updated: number; total: number }>;
}>({
  startToCloseTimeout: "5 minutes",
  retry: {
    initialInterval: "2s",
    backoffCoefficient: 2,
    maximumAttempts: 3,
  },
});

export interface ScrapeLinkedInJobsWorkflowInput {
  searchParams: ScrapeJobSearchParams;
  scrapeDetails?: boolean; // Whether to scrape full job details
  discoveredBy?: string;
}

export interface ScrapeLinkedInJobsWorkflowOutput {
  workflowId: string;
  jobsFound: number;
  jobsSaved: number;
  created: number;
  updated: number;
}

/**
 * Scrape LinkedIn Jobs Workflow
 */
export async function ScrapeLinkedInJobs(
  input: ScrapeLinkedInJobsWorkflowInput
): Promise<ScrapeLinkedInJobsWorkflowOutput> {
  const { workflowId } = workflowInfo();

  // Scrape job search results
  const jobs = await scrapeLinkedInJobs(input.searchParams);

  if (jobs.length === 0) {
    return {
      workflowId,
      jobsFound: 0,
      jobsSaved: 0,
      created: 0,
      updated: 0,
    };
  }

  // Optionally scrape full details for each job
  let jobsToSave = jobs;
  if (input.scrapeDetails) {
    // Scrape details for each job (with rate limiting)
    const jobsWithDetails = [];
    for (const job of jobs) {
      try {
        const details = await scrapeLinkedInJobDetails({
          url: job.url,
          linkedinJobId: job.linkedinJobId,
        });
        if (details) {
          jobsWithDetails.push({
            ...job,
            ...details,
            // Merge data, details take precedence
          });
        } else {
          jobsWithDetails.push(job);
        }
      } catch (error) {
        // If details scraping fails, use basic job data
        jobsWithDetails.push(job);
      }
    }
    jobsToSave = jobsWithDetails;
  }

  // Add discoveredBy to all jobs
  const jobsWithUser = jobsToSave.map((job) => ({
    ...job,
    discoveredBy: input.discoveredBy,
  }));

  // Save jobs to database
  const result = await saveDiscoveredJobs({
    jobs: jobsWithUser,
  });

  return {
    workflowId,
    jobsFound: jobs.length,
    jobsSaved: result.total,
    created: result.created,
    updated: result.updated,
  };
}

