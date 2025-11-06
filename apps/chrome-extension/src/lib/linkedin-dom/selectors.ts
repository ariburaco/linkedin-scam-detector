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
  // Collections pages use .jobs-details__main-content with --single-pane and full-width classes
  jobPosting: [
    ".jobs-details__main-content", // Primary selector for collections/single-pane view
    ".jobs-details__main-content--single-pane", // Collections page variant
    ".jobs-details-top-card",
    "[data-job-id]",
  ],

  // Job title selectors
  jobTitle: [
    "h1.job-details-jobs-unified-top-card__job-title a", // H1 with link variant
    ".job-details-jobs-unified-top-card__job-title h1", // Container with h1 inside
    ".job-details-jobs-unified-top-card__job-title", // Base selector
    "h1.top-card-layout__title", // Alternative LinkedIn structure
    ".jobs-details-top-card__job-title", // Older structure
    ".job-search-card__title", // Search results
    "h2.job-title", // Generic h2
    "a[data-control-name='job_search_job_title']", // Data attribute selector
  ],

  // Company name selectors
  companyName: [
    "a.job-details-jobs-unified-top-card__company-name", // Link variant
    ".job-details-jobs-unified-top-card__company-name a", // Container with link inside
    ".job-details-jobs-unified-top-card__company-name", // Base selector
    ".topcard__org-name-link", // Alternative LinkedIn structure
    ".top-card-layout__second-subline a", // Another alternative
    ".jobs-details-top-card__company-name", // Older structure
    ".job-search-card__subtitle", // Search results
    "a[data-control-name='job_search_company_name']", // Data attribute selector
    ".artdeco-entity-lockup__subtitle a", // Entity lockup variant
    ".artdeco-entity-lockup__subtitle span", // Entity lockup span variant
  ],

  // Job description selectors
  jobDescription: [
    "#job-details", // Direct ID selector for job details section
    ".jobs-box__html-content", // Main content container
    ".jobs-description-content__text--stretch", // Stretch variant
    ".jobs-description-content__text", // Base class
    ".jobs-description__text", // Alternative class
    ".job-search-card__description", // For search results cards
    "[data-job-id] .jobs-box__html-content", // Fallback with data attribute
    ".jobs-description__text--stretch", // Stretch variant alternative
    ".jobs-details__main-content .jobs-box__html-content", // Main content area
    ".jobs-details__main-content--single-pane .jobs-box__html-content", // Single pane variant
    ".jobs-details__job-description", // Alternative description container
    ".jobs-details__job-description__text", // Text variant
    "div[data-job-id] .jobs-box__html-content", // Div with data attribute
    "section.jobs-box__html-content", // Section variant
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
    ".job-details-jobs-unified-top-card__tertiary-description-container span.tvm__text--low-emphasis", // New structure - first span in tertiary container
    ".job-details-jobs-unified-top-card__primary-description", // Primary description container
    ".job-details-jobs-unified-top-card__primary-description-without-tagline", // Without tagline variant
    ".job-search-card__location", // Search results
    "[data-test-id='job-location']", // Data attribute selector
    ".job-card-container__metadata-wrapper li", // Metadata wrapper variant
    ".jobs-unified-top-card__primary-description", // Unified top card variant
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
