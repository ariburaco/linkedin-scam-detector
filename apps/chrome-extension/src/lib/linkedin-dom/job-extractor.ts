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
  return (
    window.location.pathname.includes("/jobs/search") ||
    window.location.pathname.includes("/jobs/collections")
  );
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
