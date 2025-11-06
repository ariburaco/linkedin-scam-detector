import { convertHtmlToMarkdown } from "@acme/shared/utils";

import { findElement, SELECTORS } from "./selectors";
import type { DiscoveredJobData, JobData } from "./types";

import { extensionLoggerContent } from "@/shared/loggers";

/**
 * Extract LinkedIn job ID from URL
 * Supports multiple URL formats:
 * - /jobs/view/123456
 * - /jobs/view/job-title-slug-123456
 * - /jobs/collections/recommended/?currentJobId=123456
 * - /jobs/search/?currentJobId=123456
 */
function extractLinkedInJobId(url: string): string | undefined {
  if (!url || typeof url !== "string") {
    return undefined;
  }

  try {
    // Format 1: Direct view format with slug: /jobs/view/job-title-slug-123456
    // Extract the numeric ID at the end of the slug (before query params)
    const slugFormatMatch = url.match(/\/jobs\/view\/[^/?]+-(\d+)(?:\/|\?|$)/);
    if (slugFormatMatch?.[1]) {
      return slugFormatMatch[1];
    }

    // Format 2: Direct view format with numeric ID only: /jobs/view/123456
    const directMatch = url.match(/\/jobs\/view\/(\d+)/);
    if (directMatch?.[1]) {
      return directMatch[1];
    }

    // Format 3: Query parameter format (collections, search, etc.)
    // Handle both absolute and relative URLs
    let urlObj: URL;
    try {
      urlObj = new URL(url);
    } catch {
      // If URL is relative, try with window.location.origin
      try {
        urlObj = new URL(url, window.location.origin);
      } catch {
        // If still fails, try parsing manually
        const match = url.match(/[?&]currentJobId=(\d+)/);
        if (match?.[1]) {
          return match[1];
        }
        return undefined;
      }
    }
    const currentJobId = urlObj.searchParams.get("currentJobId");
    if (currentJobId) {
      return currentJobId;
    }
  } catch (error) {
    // Invalid URL format, continue to return undefined
    extensionLoggerContent.debug(
      "[LinkedIn Scam Detector] Failed to extract job ID from URL:",
      error
    );
  }

  return undefined;
}

/**
 * Extract employment type from job insights
 */
function extractEmploymentType(
  container: HTMLElement | Document
): string | undefined {
  // Look for job insights that might contain employment type
  const insights = container.querySelectorAll(
    ".job-details-jobs-unified-top-card__job-insight"
  );
  for (const insight of insights) {
    const text = insight.textContent?.trim().toLowerCase() || "";
    if (text.includes("full-time") || text.includes("full time")) {
      return "Full-time";
    }
    if (text.includes("part-time") || text.includes("part time")) {
      return "Part-time";
    }
    if (text.includes("contract")) {
      return "Contract";
    }
    if (text.includes("temporary") || text.includes("temp")) {
      return "Temporary";
    }
    if (text.includes("internship")) {
      return "Internship";
    }
  }
  return undefined;
}

/**
 * Extract posted date if available
 */
function extractPostedDate(
  container: HTMLElement | Document
): string | undefined {
  // Look for "Posted X days ago" or similar patterns
  const insightElements = container.querySelectorAll(
    ".job-details-jobs-unified-top-card__job-insight, .jobs-unified-top-card__primary-description-without-tagline"
  );
  for (const element of insightElements) {
    const text = element.textContent?.trim() || "";
    // Match patterns like "Posted 2 days ago", "2 days ago", etc.
    if (
      text.toLowerCase().includes("posted") ||
      text.match(/\d+\s+(day|days|week|weeks|month|months)\s+ago/i)
    ) {
      return text;
    }
  }
  return undefined;
}

/**
 * Extract job data from a job card element (search results)
 */
export function extractJobDataFromCard(
  cardElement: HTMLElement
): JobData | null {
  try {
    // Extract job title
    const titleElement = findElement(cardElement, SELECTORS.jobTitle);
    const title = titleElement?.textContent?.trim() || "";

    if (!title) {
      return null;
    }

    // Extract company name
    const companyElement = findElement(cardElement, SELECTORS.companyName);
    const company = companyElement?.textContent?.trim() || "";

    // Extract job URL
    const linkElement = findElement(
      cardElement,
      SELECTORS.jobLink
    ) as HTMLAnchorElement | null;
    const url = linkElement?.href || window.location.href;

    // Extract LinkedIn job ID from URL
    const linkedinJobId = extractLinkedInJobId(url);

    // Extract description as HTML (may be truncated in cards)
    const descriptionElement = findElement(
      cardElement,
      SELECTORS.jobDescription
    );

    // Safely extract HTML - ensure element is HTMLElement and has innerHTML property
    let descriptionHtml = "";
    if (descriptionElement && descriptionElement instanceof HTMLElement) {
      try {
        descriptionHtml = descriptionElement.innerHTML?.trim() || "";
      } catch (error) {
        // Fallback to textContent if innerHTML access fails
        extensionLoggerContent.debug(
          "[LinkedIn Scam Detector] innerHTML access failed, using textContent:",
          error
        );
        descriptionHtml = descriptionElement.textContent?.trim() || "";
      }
    }

    // Convert HTML to Markdown with error handling
    let description = "";
    if (descriptionHtml) {
      try {
        description = convertHtmlToMarkdown(descriptionHtml);
      } catch (error) {
        extensionLoggerContent.error(
          "[LinkedIn Scam Detector] Failed to convert HTML to Markdown:",
          error
        );
        // Fallback to plain text if conversion fails
        description = descriptionHtml.replace(/<[^>]*>/g, "").trim();
      }
    }

    // Extract salary if available
    const salaryElement = findElement(cardElement, SELECTORS.salary);
    const salary = salaryElement?.textContent?.trim();

    // Extract location if available
    const locationElement = findElement(cardElement, SELECTORS.location);
    const location = locationElement?.textContent?.trim();

    // Extract employment type
    const employmentType = extractEmploymentType(cardElement);

    // Extract posted date
    const postedDate = extractPostedDate(cardElement);

    return {
      title,
      company,
      description,
      url,
      salary,
      location,
      employmentType,
      postedDate,
      linkedinJobId,
    };
  } catch (error) {
    extensionLoggerContent.error(
      "[LinkedIn Scam Detector] Error extracting job data from card:",
      {
        error,
        errorMessage: error instanceof Error ? error.message : String(error),
        errorName: error instanceof Error ? error.name : typeof error,
        stack: error instanceof Error ? error.stack : undefined,
        url: window.location.href,
      }
    );
    return null;
  }
}

/**
 * Extract job data from a full job posting page
 */
export function extractJobDataFromPage(): JobData | null {
  try {
    // Extract job title
    const titleElement = findElement(document, SELECTORS.jobTitle);
    const title = titleElement?.textContent?.trim() || "";

    if (!title) {
      return null;
    }

    // Extract company name
    const companyElement = findElement(document, SELECTORS.companyName);
    const company = companyElement?.textContent?.trim() || "";

    // Extract full job description as HTML
    const descriptionElement = findElement(document, SELECTORS.jobDescription);

    // Safely extract HTML - ensure element is HTMLElement and has innerHTML property
    let descriptionHtml = "";
    if (descriptionElement && descriptionElement instanceof HTMLElement) {
      try {
        descriptionHtml = descriptionElement.innerHTML?.trim() || "";
      } catch (error) {
        // Fallback to textContent if innerHTML access fails
        extensionLoggerContent.debug(
          "[LinkedIn Scam Detector] innerHTML access failed, using textContent:",
          error
        );
        descriptionHtml = descriptionElement.textContent?.trim() || "";
      }
    }

    // Convert HTML to Markdown with error handling
    let description = "";
    if (descriptionHtml) {
      try {
        description = convertHtmlToMarkdown(descriptionHtml);
      } catch (error) {
        extensionLoggerContent.error(
          "[LinkedIn Scam Detector] Failed to convert HTML to Markdown:",
          error
        );
        // Fallback to plain text if conversion fails
        description = descriptionHtml.replace(/<[^>]*>/g, "").trim();
      }
    }

    // Use current URL
    const url = window.location.href;

    // Extract LinkedIn job ID from URL
    const linkedinJobId = extractLinkedInJobId(url);

    // Extract salary if available
    const salaryElement = findElement(document, SELECTORS.salary);
    const salary = salaryElement?.textContent?.trim();

    // Extract location if available
    const locationElement = findElement(document, SELECTORS.location);
    const location = locationElement?.textContent?.trim();

    // Extract employment type
    const employmentType = extractEmploymentType(document);

    // Extract posted date
    const postedDate = extractPostedDate(document);

    return {
      title,
      company,
      description,
      url,
      salary,
      location,
      employmentType,
      postedDate,
      linkedinJobId,
    };
  } catch (error) {
    extensionLoggerContent.error(
      "[LinkedIn Scam Detector] Error extracting job data from page:",
      {
        error,
        errorMessage: error instanceof Error ? error.message : String(error),
        errorName: error instanceof Error ? error.name : typeof error,
        stack: error instanceof Error ? error.stack : undefined,
        url: window.location.href,
      }
    );
    return null;
  }
}

/**
 * Check if we're on a job search results page
 */
export function isJobSearchPage(): boolean {
  const pathname = window.location.pathname;
  const isSearchPage =
    pathname.includes("/jobs/search") ||
    pathname.includes("/jobs/collections") ||
    (pathname === "/jobs/search/" && window.location.search.length > 0);

  return isSearchPage;
}

/**
 * Check if we're on an individual job posting page
 * This includes:
 * - Direct job view pages: /jobs/view/123456
 * - Collections pages with currentJobId: /jobs/collections/recommended/?currentJobId=123456
 */
export function isJobPostingPage(): boolean {
  const pathname = window.location.pathname;
  const searchParams = new URLSearchParams(window.location.search);

  // Check for direct job view URL
  if (
    pathname.includes("/jobs/view/") ||
    !!pathname.match(/\/jobs\/view\/\d+/)
  ) {
    return true;
  }

  // Check for collections page with currentJobId query parameter
  if (
    pathname.includes("/jobs/collections/") &&
    searchParams.has("currentJobId")
  ) {
    return true;
  }

  return false;
}

/**
 * Generate a unique ID for a job based on its URL or title
 * Handles both direct job view URLs and collections pages with currentJobId
 */
export function generateJobId(jobData: { url: string; title: string }): string {
  // Extract job ID from URL - supports multiple formats:
  // 1. Direct view: /jobs/view/123456
  // 2. Collections: /jobs/collections/recommended/?currentJobId=123456
  const urlMatch = jobData.url.match(/\/jobs\/view\/(\d+)/);
  if (urlMatch?.[1]) {
    return `job-${urlMatch[1]}`;
  }

  // Check for currentJobId in query parameters (collections pages)
  try {
    const urlObj = new URL(jobData.url);
    const currentJobId = urlObj.searchParams.get("currentJobId");
    if (currentJobId) {
      return `job-${currentJobId}`;
    }
  } catch {
    // Invalid URL, fall through to hash generation
  }

  // Fallback: create hash from title + URL
  const hash = jobData.title + jobData.url;
  let hashValue = 0;
  for (let i = 0; i < hash.length; i++) {
    const char = hash.charCodeAt(i);
    hashValue = (hashValue << 5) - hashValue + char;
    hashValue = hashValue & hashValue; // Convert to 32-bit integer
  }
  return `job-${Math.abs(hashValue)}`;
}

/**
 * Extract work type from location text
 * e.g., "Istanbul, Turkey (Remote)" → "remote"
 */
function extractWorkType(locationText?: string | null): string | undefined {
  if (!locationText) return undefined;
  const lowerText = locationText.toLowerCase();
  if (lowerText.includes("remote")) return "remote";
  if (lowerText.includes("hybrid")) return "hybrid";
  if (lowerText.includes("on-site") || lowerText.includes("onsite"))
    return "on-site";
  return undefined;
}

/**
 * Extract job card data from a list item element (search/collection pages)
 */
export function extractJobCardFromElement(
  li: HTMLElement
): DiscoveredJobData | null {
  try {
    // Extract LinkedIn job ID from data attributes
    const jobId =
      li.dataset.occludableJobId ||
      li.dataset.jobId ||
      li.querySelector("[data-job-id]")?.getAttribute("data-job-id");

    if (!jobId) {
      return null;
    }

    // Extract job link
    const link = li.querySelector<HTMLAnchorElement>('a[href*="/jobs/view/"]');
    const url = link?.href || `https://www.linkedin.com/jobs/view/${jobId}`;

    // Extract title
    const titleElement = li.querySelector(
      ".job-card-list__title strong, .job-card-container__link strong"
    );
    const title = titleElement?.textContent?.trim();

    if (!title) {
      return null;
    }

    // Extract company
    const companyElement = li.querySelector(
      ".artdeco-entity-lockup__subtitle span, .job-card-container__company-name"
    );
    const company = companyElement?.textContent?.trim();

    if (!company) {
      return null;
    }

    // Extract location and work type
    const locationElement = li.querySelector(
      ".job-card-container__metadata-wrapper li"
    );
    const locationText = locationElement?.textContent?.trim();
    const workType = extractWorkType(locationText);

    // Extract employment type (may be in insights or metadata)
    const employmentTypeText = Array.from(
      li.querySelectorAll(".job-card-container__metadata-wrapper li")
    )
      .map((el) => el.textContent?.trim())
      .find((text) =>
        /full-time|part-time|contract|temporary|internship/i.test(text || "")
      );

    // Check for "Promoted" badge
    const isPromoted = !!Array.from(
      li.querySelectorAll(".job-card-container__footer-item")
    ).find((el) => el.textContent?.toLowerCase().includes("promoted"));

    // Check for "Easy Apply" badge
    const isEasyApply = !!li.querySelector(
      'svg[data-test-icon="linkedin-bug-color-small"]'
    );

    // Check for verified badge
    const hasVerified = !!li.querySelector('[aria-label*="Verified"]');

    // Extract insight text
    const insightElement = li.querySelector(
      ".job-card-container__job-insight-text"
    );
    const insight = insightElement?.textContent?.trim();

    // Extract company logo
    const logoImg = li.querySelector<HTMLImageElement>(
      ".job-card-list__logo img, .job-card-container__logo img"
    );
    const companyLogoUrl = logoImg?.src;

    // Extract posted date (may be in footer or insights)
    const postedDateText = Array.from(
      li.querySelectorAll(
        ".job-card-container__footer-item, .job-card-list__footer-item"
      )
    )
      .map((el) => el.textContent?.trim())
      .find((text) =>
        /\d+\s+(day|days|week|weeks|month|months)\s+ago/i.test(text || "")
      );

    // Determine discovery source from URL
    const pathname = window.location.pathname;
    let discoverySource = "search";
    if (pathname.includes("/jobs/collections")) {
      discoverySource = "collections";
    } else if (pathname.includes("/jobs/search")) {
      discoverySource = "search";
    }

    return {
      linkedinJobId: jobId,
      url,
      title,
      company,
      location: locationText,
      employmentType: employmentTypeText,
      workType,
      isPromoted,
      isEasyApply,
      hasVerified,
      insight,
      postedDate: postedDateText,
      companyLogoUrl,
      discoverySource,
      discoveryUrl: window.location.href,
    };
  } catch (error) {
    extensionLoggerContent.error(
      "[LinkedIn Scam Detector] Error extracting job card:",
      {
        error,
        errorMessage: error instanceof Error ? error.message : String(error),
        errorName: error instanceof Error ? error.name : typeof error,
        stack: error instanceof Error ? error.stack : undefined,
        url: window.location.href,
      }
    );
    return null;
  }
}

/**
 * Extract all job cards from search/collection page
 */
export function extractJobCardsFromList(
  container: HTMLElement | Document = document
): DiscoveredJobData[] {
  const jobs: DiscoveredJobData[] = [];

  // Find all job card list items
  const jobCards = container.querySelectorAll<HTMLElement>(
    "li[data-occludable-job-id], li[data-job-id], li.jobs-search-results__list-item"
  );

  for (const card of jobCards) {
    const jobData = extractJobCardFromElement(card);
    if (jobData) {
      jobs.push(jobData);
    }
  }

  return jobs;
}
