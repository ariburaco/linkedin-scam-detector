import type { PlasmoCSConfig } from "plasmo";
import { useEffect, useRef, useState } from "react";

import { BadgeMount } from "@/components/badge-mount";
import {
  extractJobDataFromCard,
  extractJobDataFromPage,
  generateJobId,
  injectBadgeContainer,
  isJobPostingPage,
  isJobSearchPage,
} from "@/lib/linkedin-dom";
import type { JobData } from "@/lib/linkedin-dom/types";
import { analyzeJobPosting } from "@/lib/local-rules";

export const config: PlasmoCSConfig = {
  matches: ["https://www.linkedin.com/jobs/*"],
  run_at: "document_end",
  world: "MAIN",
};

/**
 * LinkedIn Job Scanner Content Script
 *
 * Monitors LinkedIn job pages for job postings and injects scam detection badges.
 * Uses MutationObserver to handle dynamically loaded content (infinite scroll).
 */
export default function LinkedInScanner() {
  const [processedJobs, setProcessedJobs] = useState<Set<string>>(new Set());
  const observerRef = useRef<MutationObserver | null>(null);
  const processedJobsRef = useRef<Set<string>>(new Set());

  // Sync ref with state
  useEffect(() => {
    processedJobsRef.current = processedJobs;
  }, [processedJobs]);

  /**
   * Process a single job element
   */
  const processJobElement = (jobElement: HTMLElement) => {
    try {
      // Extract job data
      const jobData: JobData | null = isJobPostingPage()
        ? extractJobDataFromPage()
        : extractJobDataFromCard(jobElement);

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

      // Run local rules engine for instant analysis
      const localResult = analyzeJobPosting({
        description: jobData.description || "",
        title: jobData.title,
        company: jobData.company || "",
        salary: jobData.salary,
      });

      // Inject badge container
      const badgeContainer = injectBadgeContainer(jobElement, jobId);
      if (!badgeContainer) {
        console.warn(
          "[LinkedIn Scam Detector] Failed to inject badge container"
        );
        return;
      }

      // Store job data and analysis result in the badge container
      // This will be used by the badge component (to be created in Task 5)
      badgeContainer.setAttribute("data-job-id", jobId);
      badgeContainer.setAttribute("data-risk-level", localResult.riskLevel);
      badgeContainer.setAttribute(
        "data-risk-score",
        String(localResult.riskScore)
      );
      badgeContainer.setAttribute("data-job-data", JSON.stringify(jobData));
      badgeContainer.setAttribute(
        "data-local-result",
        JSON.stringify(localResult)
      );

      // Log for debugging (will be removed in production)
      console.log("[LinkedIn Scam Detector] Processed job:", {
        jobId,
        title: jobData.title,
        riskLevel: localResult.riskLevel,
        riskScore: localResult.riskScore,
        flags: localResult.flags.length,
      });

      // TODO: In Task 7, we'll send this to background worker for Gemini analysis
      // and update the badge when complete
    } catch (error) {
      console.error(
        "[LinkedIn Scam Detector] Error processing job element:",
        error
      );
    }
  };

  /**
   * Find and process all job elements on the page
   */
  const scanPageForJobs = () => {
    // For individual job posting pages
    if (isJobPostingPage()) {
      const jobData = extractJobDataFromPage();
      if (jobData) {
        const jobId = generateJobId(jobData);
        if (!processedJobsRef.current.has(jobId)) {
          // Use the document body as the container for individual pages
          processJobElement(document.body);
        }
      }
      return;
    }

    // For job search results pages
    if (isJobSearchPage()) {
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
          processJobElement(card);
        }

        // If we found cards with this selector, break
        if (jobCards.length > 0) {
          break;
        }
      }
    }
  };

  /**
   * Setup MutationObserver to watch for new job postings
   */
  useEffect(() => {
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
    };
  }, []);

  // Rescan when URL changes (SPA navigation)
  useEffect(() => {
    const handleLocationChange = () => {
      // Reset processed jobs for new page
      setProcessedJobs(new Set());
      setTimeout(() => {
        scanPageForJobs();
      }, 500);
    };

    // Watch for URL changes
    let lastUrl = window.location.href;
    const urlCheckInterval = setInterval(() => {
      if (window.location.href !== lastUrl) {
        lastUrl = window.location.href;
        handleLocationChange();
      }
    }, 1000);

    return () => {
      clearInterval(urlCheckInterval);
    };
  }, []);

  // Render BadgeMount component to mount React badges into containers
  return <BadgeMount />;
}
