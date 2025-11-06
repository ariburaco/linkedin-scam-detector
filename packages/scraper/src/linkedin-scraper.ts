/**
 * LinkedIn Scraper
 * Scrapes LinkedIn job listings and details
 */

import type { Page } from 'puppeteer';
import { env } from '@acme/shared/env';
import { Logger } from '@acme/shared/Logger';

import { BrowserManager } from './browser-manager';
import type {
  ScrapeJobDetailsParams,
  ScrapeJobSearchParams,
  ScrapedJobData,
  ScraperConfig,
} from './types';
import {
  extractLinkedInJobIdFromUrl,
  extractText,
  isRateLimited,
  requiresLogin,
  scrollToBottom,
  sleep,
  waitForSelector,
} from './utils';

const logger = new Logger('LinkedInScraper');

export class LinkedInScraper {
  private browserManager: BrowserManager;
  private config: ScraperConfig;

  constructor(browserManager?: BrowserManager, config?: ScraperConfig) {
    this.browserManager = browserManager || new BrowserManager();
    this.config = {
      rateLimitDelay: env.SCRAPER_RATE_LIMIT_DELAY ?? 2000,
      pageTimeout: env.SCRAPER_TIMEOUT ?? 30000,
      maxRetries: 3,
      retryDelay: 5000,
      ...config,
    };
  }

  /**
   * Scrape LinkedIn job search results
   */
  async scrapeJobSearch(
    params: ScrapeJobSearchParams
  ): Promise<ScrapedJobData[]> {
    const page = await this.browserManager.createPage();

    try {
      // Build LinkedIn job search URL
      const searchUrl = this.buildSearchUrl(params);
      logger.info('Scraping job search', { url: searchUrl, params });

      // Navigate to search page
      await page.goto(searchUrl, {
        waitUntil: 'networkidle2',
        timeout: this.config.pageTimeout,
      });

      // Check for login requirement
      if (await requiresLogin(page)) {
        // Check if we have cookies (might be expired)
        const hasCookies = this.browserManager['cookieProvider'] !== undefined;
        if (hasCookies) {
          logger.warn(
            'LinkedIn login required despite cookies - cookies may be expired or invalid'
          );
          return []; // Return empty results instead of throwing (graceful degradation)
        }
        throw new Error(
          'LinkedIn login required - no authentication cookies available'
        );
      }

      // Check for rate limiting
      if (await isRateLimited(page)) {
        throw new Error('LinkedIn rate limit detected');
      }

      // Wait for job list to load
      await waitForSelector(
        page,
        'ul[class*="jobs-search-results-list"], ul.scaffold-layout__list-container',
        10000
      );

      // Scroll to load more jobs (LinkedIn uses infinite scroll)
      const maxScrolls = Math.ceil((params.maxResults || 25) / 10);
      for (let i = 0; i < maxScrolls; i++) {
        await scrollToBottom(page, 1000);
        await sleep(1000); // Wait for lazy loading
      }

      // Extract job cards
      const jobs = await this.extractJobCards(page);

      // Limit results if specified
      const limitedJobs = params.maxResults
        ? jobs.slice(0, params.maxResults)
        : jobs;

      logger.info('Job search completed', {
        found: jobs.length,
        returned: limitedJobs.length,
      });

      return limitedJobs;
    } catch (error) {
      logger.error('Failed to scrape job search', {
        error: error instanceof Error ? error.message : 'Unknown error',
        params,
      });
      throw error;
    } finally {
      await page.close();
    }
  }

  /**
   * Scrape individual job posting details
   */
  async scrapeJobDetails(
    params: ScrapeJobDetailsParams
  ): Promise<ScrapedJobData | null> {
    const page = await this.browserManager.createPage();

    try {
      const url = params.url;
      logger.info('Scraping job details', { url });

      await page.goto(url, {
        waitUntil: 'networkidle2',
        timeout: this.config.pageTimeout,
      });

      // Check for login requirement
      if (await requiresLogin(page)) {
        // Check if we have cookies (might be expired)
        // Access cookieProvider via private property check
        const hasCookies =
          (this.browserManager as any).cookieProvider !== undefined;
        if (hasCookies) {
          logger.warn(
            'LinkedIn login required despite cookies - cookies may be expired or invalid'
          );
          return null; // Return null instead of throwing (graceful degradation)
        }
        throw new Error(
          'LinkedIn login required - no authentication cookies available'
        );
      }

      // Check for rate limiting
      if (await isRateLimited(page)) {
        throw new Error('LinkedIn rate limit detected');
      }

      // Extract job details
      const jobData = await this.extractJobDetails(page, url);

      logger.info('Job details scraped', {
        linkedinJobId: jobData?.linkedinJobId,
        title: jobData?.title,
      });

      return jobData;
    } catch (error) {
      logger.error('Failed to scrape job details', {
        error: error instanceof Error ? error.message : 'Unknown error',
        params,
      });
      throw error;
    } finally {
      await page.close();
    }
  }

  /**
   * Build LinkedIn job search URL
   */
  private buildSearchUrl(params: ScrapeJobSearchParams): string {
    const baseUrl = 'https://www.linkedin.com/jobs/search';
    const url = new URL(baseUrl);

    if (params.keywords) {
      url.searchParams.set('keywords', params.keywords);
    }
    if (params.location) {
      url.searchParams.set('location', params.location);
    }
    if (params.experienceLevel) {
      url.searchParams.set('f_E', params.experienceLevel);
    }
    if (params.jobType) {
      url.searchParams.set('f_JT', params.jobType);
    }
    if (params.remote) {
      url.searchParams.set('f_WT', '2'); // Remote
    }
    if (params.datePosted) {
      url.searchParams.set('f_TPR', params.datePosted);
    }
    if (params.start) {
      url.searchParams.set('start', params.start.toString());
    }

    return url.toString();
  }

  /**
   * Extract job cards from search results page
   */
  private async extractJobCards(page: Page): Promise<ScrapedJobData[]> {
    const jobs: ScrapedJobData[] = [];

    try {
      // Try multiple selectors for job cards
      const cardSelectors = [
        'li[class*="jobs-search-results__list-item"]',
        'li[class*="job-card-container"]',
        'li.scaffold-layout__list-item',
      ];

      let cards: any[] = [];
      for (const selector of cardSelectors) {
        cards = await page.$$(selector);
        if (cards.length > 0) break;
      }

      for (const card of cards) {
        try {
          const jobData = await this.extractJobCardData(page, card);
          if (jobData) {
            jobs.push(jobData);
          }
        } catch (error) {
          logger.warn('Failed to extract job card', {
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }
    } catch (error) {
      logger.error('Failed to extract job cards', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    return jobs;
  }

  /**
   * Extract data from a single job card
   */
  private async extractJobCardData(
    page: Page,
    card: any
  ): Promise<ScrapedJobData | null> {
    try {
      // Extract job ID from data attributes
      const jobId =
        (await page.evaluate(
          (el) =>
            el.getAttribute('data-occludable-job-id') ||
            el.getAttribute('data-job-id') ||
            el.querySelector('[data-job-id]')?.getAttribute('data-job-id'),
          card
        )) || null;

      if (!jobId) {
        return null;
      }

      // Extract job link
      const linkElement = await card.$('a[href*="/jobs/view/"]');
      const url =
        (await page.evaluate((el) => el?.getAttribute('href'), linkElement)) ||
        `https://www.linkedin.com/jobs/view/${jobId}`;

      // Extract title
      const titleElement = await card.$(
        ".job-card-list__title, .job-card-container__link, a[class*='job-card-list__title']"
      );
      const title =
        (await page.evaluate((el) => el?.textContent?.trim(), titleElement)) ||
        null;

      if (!title) {
        return null;
      }

      // Extract company
      const companyElement = await card.$(
        '.job-card-container__company-name, .artdeco-entity-lockup__subtitle'
      );
      const company =
        (await page.evaluate(
          (el) => el?.textContent?.trim(),
          companyElement
        )) || null;

      if (!company) {
        return null;
      }

      // Extract location
      const locationElement = await card.$(
        '.job-card-container__metadata-wrapper li, .job-card-list__metadata-wrapper li'
      );
      const location =
        (await page.evaluate(
          (el) => el?.textContent?.trim(),
          locationElement
        )) || null;

      // Extract employment type
      const employmentTypeElements = await card.$$(
        '.job-card-container__metadata-wrapper li'
      );
      let employmentType: string | null = null;
      for (const el of employmentTypeElements) {
        const text = await page.evaluate((e) => e.textContent?.trim(), el);
        if (
          text &&
          /full-time|part-time|contract|temporary|internship/i.test(text)
        ) {
          employmentType = text;
          break;
        }
      }

      // Check for promoted badge
      const isPromoted = await card.$('.job-card-container__footer-item');
      const promotedText = isPromoted
        ? await page.evaluate(
            (el) => el?.textContent?.toLowerCase(),
            isPromoted
          )
        : '';
      const hasPromoted = promotedText?.includes('promoted') || false;

      // Check for Easy Apply
      const isEasyApply = await card.$('span:has-text("Easy Apply")');
      const hasEasyApply = isEasyApply !== null;

      return {
        linkedinJobId: jobId,
        url: url.startsWith('http') ? url : `https://www.linkedin.com${url}`,
        title,
        company,
        location: location || undefined,
        employmentType: employmentType || undefined,
        isPromoted: hasPromoted,
        isEasyApply: hasEasyApply,
        discoverySource: 'scraper',
      };
    } catch (error) {
      logger.warn('Failed to extract job card data', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return null;
    }
  }

  /**
   * Extract full job details from job posting page
   */
  private async extractJobDetails(
    page: Page,
    url: string
  ): Promise<ScrapedJobData | null> {
    try {
      const linkedinJobId = extractLinkedInJobIdFromUrl(url);

      // Extract title
      const title =
        (await extractText(
          page,
          '.jobs-details-top-card__job-title, h1.job-details-jobs-unified-top-card__job-title'
        )) || null;

      if (!title) {
        return null;
      }

      // Extract company
      const company =
        (await extractText(
          page,
          '.jobs-details-top-card__company-name, a.job-details-jobs-unified-top-card__company-name'
        )) || null;

      if (!company) {
        return null;
      }

      // Extract location
      const location =
        (await extractText(
          page,
          '.jobs-details-top-card__bullet, .job-details-jobs-unified-top-card__primary-description-without-tagline'
        )) || null;

      // Extract description
      const description =
        (await extractText(
          page,
          '.jobs-description-content__text, .jobs-box__html-content'
        )) || null;

      // Extract posted date
      const postedDate =
        (await extractText(
          page,
          '.jobs-details-top-card__posted-date, time'
        )) || null;

      // Extract salary
      const salary =
        (await extractText(
          page,
          '.jobs-details-top-card__job-insight, .job-details-jobs-unified-top-card__job-insight'
        )) || null;

      // Extract employment type
      const employmentType =
        (await extractText(
          page,
          '.jobs-details-top-card__job-insight--highlight'
        )) || null;

      // Check for Easy Apply
      const isEasyApply = await page.$('span:has-text("Easy Apply")');
      const hasEasyApply = isEasyApply !== null;

      return {
        linkedinJobId: linkedinJobId || '',
        url,
        title,
        company,
        location: location || undefined,
        employmentType: employmentType || undefined,
        description: description || undefined,
        postedDate: postedDate || undefined,
        salary: salary || undefined,
        isEasyApply: hasEasyApply,
        discoverySource: 'scraper',
      };
    } catch (error) {
      logger.error('Failed to extract job details', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return null;
    }
  }

  /**
   * Cleanup browser resources
   */
  async cleanup(): Promise<void> {
    await this.browserManager.cleanup();
  }
}
