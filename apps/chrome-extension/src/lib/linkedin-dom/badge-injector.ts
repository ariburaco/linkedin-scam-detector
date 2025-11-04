import type { JobElement } from "./types";

const BADGE_CONTAINER_CLASS = "linkedin-scam-detector-badge-container";
const BADGE_CONTAINER_DATA_ATTR = "data-scam-detector-id";

/**
 * Create a badge container element
 */
export function createBadgeContainer(): HTMLElement {
  const container = document.createElement("div");
  container.className = BADGE_CONTAINER_CLASS;
  container.setAttribute("data-scam-detector", "true");
  container.style.display = "inline-flex";
  container.style.alignItems = "center";
  container.style.marginLeft = "8px";
  container.style.verticalAlign = "middle";
  return container;
}

/**
 * Inject badge container next to job title
 */
export function injectBadgeContainer(
  jobElement: HTMLElement,
  jobId: string
): HTMLElement | null {
  try {
    // Check if badge already exists
    const existingBadge = jobElement.querySelector(
      `.${BADGE_CONTAINER_CLASS}[${BADGE_CONTAINER_DATA_ATTR}="${jobId}"]`
    );
    if (existingBadge) {
      return existingBadge as HTMLElement;
    }

    // Find job title element to inject next to
    const titleSelectors = [
      ".job-details-jobs-unified-top-card__job-title",
      ".job-search-card__title",
      "h2.job-title",
      "a[data-control-name='job_search_job_title']",
    ];

    let titleElement: HTMLElement | null = null;
    for (const selector of titleSelectors) {
      titleElement = jobElement.querySelector(selector) as HTMLElement | null;
      if (titleElement) break;
    }

    // Fallback: use the job element itself
    if (!titleElement) {
      titleElement = jobElement;
    }

    // Create and inject badge container
    const badgeContainer = createBadgeContainer();
    badgeContainer.setAttribute(BADGE_CONTAINER_DATA_ATTR, jobId);

    // Insert after title or as first child
    if (titleElement.parentElement) {
      // Try to insert after the title
      if (titleElement.nextSibling) {
        titleElement.parentElement.insertBefore(
          badgeContainer,
          titleElement.nextSibling
        );
      } else {
        titleElement.parentElement.appendChild(badgeContainer);
      }
    } else {
      // Fallback: prepend to job element
      jobElement.insertBefore(badgeContainer, jobElement.firstChild);
    }

    return badgeContainer;
  } catch (error) {
    console.error(
      "[LinkedIn Scam Detector] Error injecting badge container:",
      error
    );
    return null;
  }
}

/**
 * Remove badge container for a job
 */
export function removeBadgeContainer(jobId: string): void {
  const badge = document.querySelector(
    `.${BADGE_CONTAINER_CLASS}[${BADGE_CONTAINER_DATA_ATTR}="${jobId}"]`
  );
  if (badge) {
    badge.remove();
  }
}

/**
 * Generate a unique ID for a job based on its URL or title
 */
export function generateJobId(jobData: { url: string; title: string }): string {
  // Use URL hash or create hash from title + URL
  const urlMatch = jobData.url.match(/\/jobs\/view\/(\d+)/);
  if (urlMatch?.[1]) {
    return `job-${urlMatch[1]}`;
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
