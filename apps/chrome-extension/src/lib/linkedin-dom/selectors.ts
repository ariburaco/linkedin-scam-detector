/**
 * LinkedIn DOM selectors for job postings
 * These selectors may need to be updated if LinkedIn changes their UI
 */

// Job search results page selectors
export const SELECTORS = {
  // Job cards in search results
  jobCard: [
    ".job-search-card",
    "[data-job-id]",
    ".jobs-search-results__list-item",
    ".job-card-container",
  ],

  // Individual job posting page selectors
  jobPosting: [
    ".jobs-details__main-content",
    ".jobs-details-top-card",
    "[data-job-id]",
  ],

  // Job title selectors
  jobTitle: [
    ".job-details-jobs-unified-top-card__job-title",
    ".job-search-card__title",
    "h2.job-title",
    "a[data-control-name='job_search_job_title']",
  ],

  // Company name selectors
  companyName: [
    ".job-details-jobs-unified-top-card__company-name",
    ".job-search-card__subtitle",
    "a[data-control-name='job_search_company_name']",
  ],

  // Job description selectors
  jobDescription: [
    ".jobs-description__text",
    ".jobs-description-content__text",
    ".job-search-card__description",
    "[data-job-id] .jobs-box__html-content",
  ],

  // Job URL selector (usually from the link)
  jobLink: [
    "a[data-control-name='job_search_job_title']",
    ".job-search-card__link-wrapper a",
    "a.job-card-list__title",
  ],

  // Salary information (if available)
  salary: [
    ".job-details-jobs-unified-top-card__job-insight",
    ".job-search-card__salary-info",
    "[data-test-id='job-salary']",
  ],

  // Location information
  location: [
    ".job-details-jobs-unified-top-card__primary-description",
    ".job-search-card__location",
    "[data-test-id='job-location']",
  ],
} as const;

/**
 * Find element using multiple possible selectors
 */
export function findElement(
  container: HTMLElement | Document,
  selectors: readonly string[]
): HTMLElement | null {
  for (const selector of selectors) {
    const element = container.querySelector(selector) as HTMLElement | null;
    if (element) {
      return element;
    }
  }
  return null;
}

/**
 * Find all elements using multiple possible selectors
 */
export function findAllElements(
  container: HTMLElement | Document,
  selectors: readonly string[]
): HTMLElement[] {
  const results: HTMLElement[] = [];
  for (const selector of selectors) {
    const elements = Array.from(
      container.querySelectorAll(selector)
    ) as HTMLElement[];
    if (elements.length > 0) {
      results.push(...elements);
    }
  }
  // Remove duplicates
  return Array.from(new Set(results));
}
