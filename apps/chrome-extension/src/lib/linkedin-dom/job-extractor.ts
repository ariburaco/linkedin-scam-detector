import { findElement, SELECTORS } from "./selectors";
import type { JobData } from "./types";

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

    return {
      title,
      company,
      description,
      url,
      salary,
      location,
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

    // Extract salary if available
    const salaryElement = findElement(document, SELECTORS.salary);
    const salary = salaryElement?.textContent?.trim();

    // Extract location if available
    const locationElement = findElement(document, SELECTORS.location);
    const location = locationElement?.textContent?.trim();

    return {
      title,
      company,
      description,
      url,
      salary,
      location,
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
