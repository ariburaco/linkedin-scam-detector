/**
 * Content script for LinkedIn job search/collection pages
 * Discovers job cards and sends them to background for storage
 */

import { sendToBackground } from "@plasmohq/messaging";
import type { PlasmoCSConfig } from "plasmo";

import { extractJobCardsFromList } from "../lib/linkedin-dom/job-extractor";

export const config: PlasmoCSConfig = {
  matches: [
    "https://www.linkedin.com/jobs/search/*",
    "https://www.linkedin.com/jobs/collections/*",
  ],
  run_at: "document_end",
};

// Debounce function to avoid excessive API calls
function debounce<T extends (...args: any[]) => void>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;
  return function executedFunction(...args: Parameters<T>) {
    const later = () => {
      timeout = null;
      func(...args);
    };
    if (timeout) {
      clearTimeout(timeout);
    }
    timeout = setTimeout(later, wait);
  };
}

/**
 * Extract and send discovered jobs
 */
async function discoverAndSendJobs() {
  try {
    // Find the job list container
    // Try multiple selectors as LinkedIn may change them
    const jobListSelectors = [
      "ul.jalfrDfgHGsKmZcPRnpnqhARxalryxRlmo", // From your HTML
      'ul[class*="job-card-list"]',
      'ul[class*="jobs-search-results"]',
      "ul.scaffold-layout__list",
    ];

    let jobListContainer: HTMLElement | null = null;
    for (const selector of jobListSelectors) {
      jobListContainer = document.querySelector<HTMLElement>(selector);
      if (jobListContainer) break;
    }

    if (!jobListContainer) {
      // Silently return - container may not exist on all pages
      return;
    }

    // Extract job cards (discoverySource and discoveryUrl are extracted from window.location inside the function)
    const jobCards = extractJobCardsFromList(jobListContainer);

    if (jobCards.length === 0) {
      // Silently return - no jobs to process
      return;
    }

    // Only log when jobs are actually discovered (less verbose)
    if (process.env.NODE_ENV === "development") {
      console.log(`[LinkedIn Search Badge] Discovered ${jobCards.length} jobs`);
    }

    // Send to background script
    const result = await sendToBackground({
      name: "discover-jobs",
      body: {
        type: "discover-jobs",
        jobs: jobCards,
      },
    });

    if (result?.success) {
      console.log(
        `[LinkedIn Search Badge] Successfully stored ${result.created || 0} new jobs, updated ${result.updated || 0}`
      );
    }
  } catch (error) {
    console.error("[LinkedIn Search Badge] Error discovering jobs:", error);
  }
}

// Debounced version (wait 2 seconds after last change)
const debouncedDiscover = debounce(discoverAndSendJobs, 2000);

/**
 * Observe job list for changes (infinite scroll, new jobs loaded)
 */
function observeJobList() {
  // Find job list container
  const jobListSelectors = [
    "ul.jalfrDfgHGsKmZcPRnpnqhARxalryxRlmo",
    'ul[class*="job-card-list"]',
    'ul[class*="jobs-search-results"]',
  ];

  let jobListContainer: HTMLElement | null = null;
  for (const selector of jobListSelectors) {
    jobListContainer = document.querySelector<HTMLElement>(selector);
    if (jobListContainer) break;
  }

  if (!jobListContainer) {
    // Retry after a short delay if container not found yet
    setTimeout(observeJobList, 1000);
    return;
  }

  // Initial extraction
  discoverAndSendJobs();

  // Observe for changes (infinite scroll, etc.)
  const observer = new MutationObserver(() => {
    debouncedDiscover();
  });

  observer.observe(jobListContainer, {
    childList: true,
    subtree: true,
  });

  // Logging removed to reduce console noise
}

// Initialize when page loads
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", observeJobList);
} else {
  observeJobList();
}

// Also listen for URL changes (LinkedIn uses SPA navigation)
let lastUrl = window.location.href;
new MutationObserver(() => {
  const currentUrl = window.location.href;
  if (currentUrl !== lastUrl) {
    lastUrl = currentUrl;
    // Re-observe when navigating to new search/collection page
    setTimeout(observeJobList, 500);
  }
}).observe(document.body, {
  childList: true,
  subtree: true,
});

/**
 * Default export required by Plasmo for content scripts
 * Returns null since this script only runs side effects (job discovery)
 */
export default function LinkedInSearchBadge() {
  return null;
}
