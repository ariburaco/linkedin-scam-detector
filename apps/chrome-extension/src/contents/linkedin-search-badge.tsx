import type { PlasmoCSConfig } from "plasmo";
import { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";

import { JobRiskBadge } from "@/components/job-risk-badge";
import { RiskReportManager } from "@/components/risk-report-manager";
import {
  extractJobDataFromCard,
  generateJobId,
  isJobSearchPage,
} from "@/lib/linkedin-dom";

export const config: PlasmoCSConfig = {
  matches: ["https://www.linkedin.com/jobs/*"],
  run_at: "document_end",
};

/**
 * Content script for job search results pages
 * Uses MutationObserver to detect job cards and mount badges dynamically
 */
export default function LinkedInSearchBadge() {
  const [processedJobs, setProcessedJobs] = useState<Set<string>>(new Set());
  const processedJobsRef = useRef<Set<string>>(new Set());
  const badgeRootsRef = useRef<Map<string, ReturnType<typeof createRoot>>>(
    new Map()
  );
  const observerRef = useRef<MutationObserver | null>(null);

  // Sync ref with state
  useEffect(() => {
    processedJobsRef.current = processedJobs;
  }, [processedJobs]);

  /**
   * Mount badge to a job card
   */
  const mountBadgeToCard = (cardElement: HTMLElement) => {
    try {
      // Extract job data
      const jobData = extractJobDataFromCard(cardElement);
      if (!jobData || !jobData.title) {
        return;
      }

      // Generate unique ID for this job
      const jobId = generateJobId(jobData);

      // Skip if already processed
      if (processedJobsRef.current.has(jobId)) {
        return;
      }

      // Mark as processed
      setProcessedJobs((prev) => new Set(prev).add(jobId));

      // Find job title element to mount badge next to
      const titleSelectors = [
        ".job-search-card__title",
        "a[data-control-name='job_search_job_title']",
        "h3",
        "h2",
      ];

      let titleElement: HTMLElement | null = null;
      for (const selector of titleSelectors) {
        titleElement = cardElement.querySelector(
          selector
        ) as HTMLElement | null;
        if (titleElement) break;
      }

      // Fallback: use card element itself
      if (!titleElement) {
        titleElement = cardElement;
      }

      // Create badge container
      const badgeContainer = document.createElement("span");
      badgeContainer.style.display = "inline-flex";
      badgeContainer.style.alignItems = "center";
      badgeContainer.style.marginLeft = "8px";
      badgeContainer.style.verticalAlign = "middle";

      // Insert badge container after title
      if (titleElement.parentElement) {
        if (titleElement.nextSibling) {
          titleElement.parentElement.insertBefore(
            badgeContainer,
            titleElement.nextSibling
          );
        } else {
          titleElement.parentElement.appendChild(badgeContainer);
        }
      } else {
        cardElement.insertBefore(badgeContainer, cardElement.firstChild);
      }

      // Create React root and render badge
      const root = createRoot(badgeContainer);
      badgeRootsRef.current.set(jobId, root);

      root.render(<JobRiskBadge jobData={jobData} container={cardElement} />);
    } catch (error) {
      console.error(
        "[LinkedIn Search Badge] Error mounting badge to card:",
        error
      );
    }
  };

  /**
   * Scan page for job cards and mount badges
   */
  const scanPageForJobs = () => {
    if (!isJobSearchPage()) {
      return;
    }

    // Try multiple selectors to find job cards
    const jobCardSelectors = [
      ".job-search-card",
      "[data-job-id]",
      ".jobs-search-results__list-item",
      ".job-card-container",
    ];

    for (const selector of jobCardSelectors) {
      const jobCards = Array.from(
        document.querySelectorAll(selector)
      ) as HTMLElement[];

      for (const card of jobCards) {
        mountBadgeToCard(card);
      }

      // If we found cards with this selector, break
      if (jobCards.length > 0) {
        break;
      }
    }
  };

  /**
   * Setup MutationObserver to watch for new job postings
   */
  useEffect(() => {
    if (!isJobSearchPage()) {
      return;
    }

    // Initial scan
    scanPageForJobs();

    // Setup MutationObserver for dynamically loaded content
    const observer = new MutationObserver((mutations) => {
      let shouldRescan = false;

      for (const mutation of mutations) {
        // Check if new nodes were added
        if (mutation.addedNodes.length > 0) {
          shouldRescan = true;
          break;
        }
      }

      if (shouldRescan) {
        // Debounce rescanning
        setTimeout(() => {
          scanPageForJobs();
        }, 300);
      }
    });

    // Start observing
    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    observerRef.current = observer;

    // Also rescan on scroll (for infinite scroll pages)
    let scrollTimeout: NodeJS.Timeout;
    const handleScroll = () => {
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => {
        scanPageForJobs();
      }, 500);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });

    // Cleanup
    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", handleScroll);
      // Cleanup React roots
      badgeRootsRef.current.forEach((root) => {
        try {
          root.unmount();
        } catch {
          // Ignore unmount errors
        }
      });
      badgeRootsRef.current.clear();
    };
  }, []);

  // Rescan when URL changes (SPA navigation)
  useEffect(() => {
    const handleLocationChange = () => {
      // Reset processed jobs for new page
      setProcessedJobs(new Set());
      // Cleanup React roots
      badgeRootsRef.current.forEach((root) => {
        try {
          root.unmount();
        } catch {
          // Ignore unmount errors
        }
      });
      badgeRootsRef.current.clear();
      setTimeout(() => {
        scanPageForJobs();
      }, 500);
    };

    // Track both URL and search params to detect collections page navigation
    let lastUrl = window.location.href;
    let lastPathname = window.location.pathname;
    let lastSearch = window.location.search;

    const urlCheckInterval = setInterval(() => {
      const currentUrl = window.location.href;
      const currentPathname = window.location.pathname;
      const currentSearch = window.location.search;

      // Detect any URL change (including query parameters like currentJobId)
      if (
        currentUrl !== lastUrl ||
        currentPathname !== lastPathname ||
        currentSearch !== lastSearch
      ) {
        lastUrl = currentUrl;
        lastPathname = currentPathname;
        lastSearch = currentSearch;
        handleLocationChange();
      }
    }, 500); // Check more frequently for better SPA navigation detection

    return () => {
      clearInterval(urlCheckInterval);
    };
  }, []);

  // Only render on search pages
  if (!isJobSearchPage()) {
    return null;
  }

  return <RiskReportManager />;
}
