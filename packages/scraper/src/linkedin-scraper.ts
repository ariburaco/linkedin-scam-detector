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
  dismissContextualSignInModal,
  expandJobDescription,
  extractHtml,
  extractLinkedInJobIdFromUrl,
  extractText,
  isRateLimited,
  requiresLogin,
  scrollToBottom,
  sleep,
  waitForSelector,
} from './utils';
import { convertHtmlToMarkdown } from '@acme/shared/utils';

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
      logger.info('Scraping job search', {
        url: searchUrl,
        keywords: params.keywords,
        location: params.location,
      });

      // Navigate to search URL
      await page.goto(searchUrl, {
        waitUntil: 'networkidle2',
        timeout: this.config.pageTimeout,
      });

      // Wait a bit for page to load
      await sleep(1000);

      // Dismiss contextual sign-in modal if present
      const modalDismissed = await dismissContextualSignInModal(page);
      if (modalDismissed) {
        logger.info('Dismissed contextual sign-in modal');
        await sleep(500); // Wait for modal to fully disappear
      }

      // Even if login is required, try to scrape anyway (content might still be accessible)
      const loginRequired = await requiresLogin(page);
      if (loginRequired) {
        logger.warn(
          'LinkedIn login may be required, but attempting to scrape anyway...'
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
      // Clean URL: remove query parameters, keep only base job URL
      const urlObj = new URL(params.url);
      const jobIdMatch = urlObj.pathname.match(/\/jobs\/view\/(\d+)/);
      const cleanUrl = jobIdMatch
        ? `https://www.linkedin.com/jobs/view/${jobIdMatch[1]}`
        : params.url; // Fallback to original if pattern doesn't match

      logger.info('Scraping job details', {
        url: cleanUrl,
        originalUrl: params.url,
      });

      // Navigate to job URL
      await page.goto(cleanUrl, {
        waitUntil: 'networkidle2',
        timeout: this.config.pageTimeout,
      });

      // Wait a bit for page to load
      await sleep(1000);

      // Dismiss contextual sign-in modal if present
      const modalDismissed = await dismissContextualSignInModal(page);
      if (modalDismissed) {
        logger.info('Dismissed contextual sign-in modal');
        await sleep(500); // Wait for modal to fully disappear
      }

      // Even if login is required, try to scrape anyway (content might still be accessible)
      const loginRequired = await requiresLogin(page);
      if (loginRequired) {
        logger.warn(
          'LinkedIn login may be required, but attempting to scrape anyway...'
        );
      }

      // Check for rate limiting
      if (await isRateLimited(page)) {
        throw new Error('LinkedIn rate limit detected');
      }

      // Extract job details
      const jobData = await this.extractJobDetails(page, cleanUrl);

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
      // Try to extract job ID from URL first, fallback to hidden element
      let linkedinJobId = extractLinkedInJobIdFromUrl(url);

      // Fallback: Extract job ID from hidden code element
      if (!linkedinJobId) {
        try {
          const jobIdElement = await page.$('#decoratedJobPostingId');
          if (jobIdElement) {
            const jobIdHtml = await page.evaluate(
              (el) => el.innerHTML,
              jobIdElement
            );
            // Extract ID from comment like <!--"4318011752"-->
            const match = jobIdHtml.match(/"(\d+)"/);
            if (match?.[1]) {
              linkedinJobId = match[1];
            }
          }
        } catch (error) {
          // Ignore errors in fallback extraction
        }
      }

      // Expand job description if "Show more" button exists
      await expandJobDescription(page);

      // Extract title (try new selectors first, fallback to old ones)
      const title =
        (await extractText(
          page,
          '.top-card-layout__title, h1.top-card-layout__title, .jobs-details-top-card__job-title, h1.job-details-jobs-unified-top-card__job-title'
        )) || null;

      if (!title) {
        logger.warn('Failed to extract job title', { url });
        return null;
      }

      // Extract company (try new selectors first, fallback to old ones)
      const company =
        (await extractText(
          page,
          '.topcard__org-name-link, .top-card-layout__second-subline a, .jobs-details-top-card__company-name, a.job-details-jobs-unified-top-card__company-name'
        )) || null;

      if (!company) {
        logger.warn('Failed to extract company name', { url });
        return null;
      }

      // Extract location (try new selectors first, fallback to old ones)
      const location =
        (await extractText(
          page,
          '.topcard__flavor.topcard__flavor--bullet, .jobs-details-top-card__bullet, .job-details-jobs-unified-top-card__primary-description-without-tagline'
        )) || null;

      // Extract posted date (try new selectors first, fallback to old ones)
      const postedDate =
        (await extractText(
          page,
          '.posted-time-ago__text, .jobs-details-top-card__posted-date, time'
        )) || null;

      // Extract applicants count (new field)
      const applicants =
        (await extractText(page, '.num-applicants__caption')) || null;

      // Extract description as HTML (try new selectors first, fallback to old ones)
      const descriptionHtml =
        (await extractHtml(
          page,
          '.description__text.description__text--rich, .jobs-description-content__text, .jobs-box__html-content, .show-more-less-html__markup'
        )) || null;

      // Convert HTML to Markdown
      const description = descriptionHtml
        ? convertHtmlToMarkdown(descriptionHtml)
        : null;

      // Extract salary (try new selectors first, fallback to old ones)
      const salary =
        (await extractText(
          page,
          '.jobs-details-top-card__job-insight, .job-details-jobs-unified-top-card__job-insight'
        )) || null;

      // Extract employment type (try new selectors first, fallback to old ones)
      let employmentType =
        (await extractText(
          page,
          '.jobs-details-top-card__job-insight--highlight'
        )) || null;

      // Extract job criteria (seniority level, employment type, job function, industries)
      // Use position-based extraction instead of text matching for language independence
      let seniorityLevel: string | undefined;
      let jobFunction: string | undefined;
      let industries: string | undefined;

      try {
        const criteriaItems = await page.$$('.description__job-criteria-item');

        // Extract all criteria items and map by position/index
        // LinkedIn typically shows them in a consistent order:
        // 0: Seniority level
        // 1: Employment type
        // 2: Job function
        // 3: Industries
        for (let i = 0; i < criteriaItems.length; i++) {
          const item = criteriaItems[i];
          if (!item) continue;

          const text = await page.evaluate(
            (el) =>
              el
                .querySelector('.description__job-criteria-text')
                ?.textContent?.trim() || null,
            item
          );

          if (text) {
            // Map by position (most reliable across languages)
            if (i === 0) {
              seniorityLevel = text;
            } else if (i === 1) {
              // Use criteria employment type if we don't have one yet
              if (!employmentType) {
                employmentType = text;
              }
            } else if (i === 2) {
              jobFunction = text;
            } else if (i === 3) {
              industries = text;
            }
          }
        }
      } catch (error) {
        // Ignore errors in criteria extraction
        logger.debug('Failed to extract job criteria', {
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }

      // Check for Easy Apply (use class-based selector, not text-based)
      // Look for apply button with specific classes or data attributes
      const hasEasyApply = await page.evaluate(() => {
        // Try multiple selectors for Easy Apply button
        const easyApplySelectors = [
          'button[data-tracking-control-name*="easy-apply"]',
          'button[data-tracking-control-name*="easyApply"]',
          'button[aria-label*="Easy Apply"]',
          'button[aria-label*="easy apply"]',
          '.jobs-apply-button--top-card',
          'button.jobs-s-apply',
        ];

        for (const selector of easyApplySelectors) {
          const button = document.querySelector(selector);
          if (button) {
            return true;
          }
        }

        // Fallback: check if apply button exists (but this is less reliable)
        const applyButton = document.querySelector(
          'button[data-tracking-control-name*="apply"]'
        );
        return applyButton !== null;
      });

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
        applicants: applicants || undefined,
        isEasyApply: hasEasyApply,
        seniorityLevel: seniorityLevel || undefined,
        jobFunction,
        industries,
        discoverySource: 'scraper',
      };
    } catch (error) {
      logger.error('Failed to extract job details', {
        error: error instanceof Error ? error.message : 'Unknown error',
        url,
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
