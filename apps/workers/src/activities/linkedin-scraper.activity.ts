/**
 * LinkedIn Scraper Activities
 * Temporal activities for LinkedIn job scraping
 */

import { Logger } from "@acme/shared/Logger";
import {
  LinkedInScraper,
  type ScrapeJobDetailsParams,
  type ScrapeJobSearchParams,
  type ScrapedJobData,
} from "@acme/scraper";

const logger = new Logger("LinkedInScraperActivity");

// Shared scraper instance (reused across activities)
let scraperInstance: LinkedInScraper | null = null;

function getScraper(): LinkedInScraper {
  if (!scraperInstance) {
    scraperInstance = new LinkedInScraper();
  }
  return scraperInstance;
}

/**
 * Scrape LinkedIn job search results
 */
export async function scrapeLinkedInJobs(
  params: ScrapeJobSearchParams
): Promise<ScrapedJobData[]> {
  logger.info("Starting LinkedIn job search scrape", { params });

  const scraper = getScraper();

  try {
    const jobs = await scraper.scrapeJobSearch(params);

    logger.info("LinkedIn job search completed", {
      found: jobs.length,
      keywords: params.keywords,
      location: params.location,
    });

    return jobs;
  } catch (error) {
    logger.error("Failed to scrape LinkedIn jobs", {
      error: error instanceof Error ? error.message : "Unknown error",
      params,
    });
    throw error;
  }
}

/**
 * Scrape LinkedIn job details
 */
export async function scrapeLinkedInJobDetails(
  params: ScrapeJobDetailsParams
): Promise<ScrapedJobData | null> {
  logger.info("Starting LinkedIn job details scrape", { params });

  const scraper = getScraper();

  try {
    const job = await scraper.scrapeJobDetails(params);

    if (job) {
      logger.info("LinkedIn job details scraped", {
        linkedinJobId: job.linkedinJobId,
        title: job.title,
      });
    } else {
      logger.warn("No job details found", { params });
    }

    return job;
  } catch (error) {
    logger.error("Failed to scrape LinkedIn job details", {
      error: error instanceof Error ? error.message : "Unknown error",
      params,
    });
    throw error;
  }
}

/**
 * Cleanup scraper resources
 */
export async function cleanupScraper(): Promise<void> {
  logger.info("Cleaning up scraper resources");

  if (scraperInstance) {
    try {
      await scraperInstance.cleanup();
      scraperInstance = null;
      logger.info("Scraper cleanup completed");
    } catch (error) {
      logger.error("Failed to cleanup scraper", {
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
}

