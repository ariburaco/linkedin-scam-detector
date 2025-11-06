import { findElement, SELECTORS } from "./selectors";
import type { JobData } from "./types";

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
    const urlObj = new URL(url);
    const currentJobId = urlObj.searchParams.get("currentJobId");
    if (currentJobId) {
      return currentJobId;
    }
  } catch {
    // Invalid URL format, continue to return undefined
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

    // Extract description (may be truncated in cards)
    const descriptionElement = findElement(
      cardElement,
      SELECTORS.jobDescription
    );
    const description = descriptionElement?.textContent?.trim() || "";

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
    console.error("[LinkedIn Scam Detector] Error extracting job data:", error);
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

    // Extract full job description
    const descriptionElement = findElement(document, SELECTORS.jobDescription);
    const description = descriptionElement?.textContent?.trim() || "";

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
    console.error("[LinkedIn Scam Detector] Error extracting job data:", error);
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

  // Debug logging
  if (process.env.NODE_ENV === "development") {
    console.log("[isJobSearchPage] Checking:", {
      pathname,
      search: window.location.search,
      isSearchPage,
    });
  }

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
