import { sendToBackground } from "@plasmohq/messaging";
import type { PlasmoCSConfig } from "plasmo";
import * as React from "react";
import { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";

import type {
  ScanJobRequestBody,
  ScanJobResponseBody,
} from "@/background/messages/scan-job";
import { RiskBadge } from "@/components/risk-badge";
import type { RiskLevel } from "@/components/risk-badge";
import { RiskReportManager } from "@/components/risk-report-manager";
import {
  extractJobDataFromCard,
  extractJobDataFromPage,
  generateJobId,
  injectBadgeContainer,
  isJobPostingPage,
  isJobSearchPage,
} from "@/lib/linkedin-dom";
import type { JobData } from "@/lib/linkedin-dom/types";

export const config: PlasmoCSConfig = {
  matches: ["https://www.linkedin.com/jobs/*"],
  run_at: "document_end",
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
  const badgeContainersRef = useRef<Map<string, HTMLElement>>(new Map());

  // Sync ref with state
  useEffect(() => {
    processedJobsRef.current = processedJobs;
  }, [processedJobs]);

  // Set up listener for final result messages from background
  // In ISOLATED world, chrome.runtime.onMessage is available
  useEffect(() => {
    const handleMessage = (
      message: {
        type?: string;
        jobId?: string;
        final?: {
          riskScore: number;
          riskLevel: "safe" | "caution" | "danger";
          flags: Array<{
            type: string;
            confidence: "low" | "medium" | "high";
            message: string;
            reasoning?: string;
          }>;
          summary?: string;
          source: "gemini" | "cache" | "fallback";
        };
        error?: string;
      },
      _sender: chrome.runtime.MessageSender,
      sendResponse: (response?: { success: boolean; error?: string }) => void
    ) => {
      if (message.type === "scam-detector:final-result") {
        const { jobId, final, error } = message;
        if (!jobId) {
          console.warn(
            "[LinkedIn Scam Detector] Received message without jobId"
          );
          sendResponse({ success: false, error: "Missing jobId" });
          return false;
        }
        const badgeContainer = badgeContainersRef.current.get(jobId);

        if (!badgeContainer) {
          console.warn(
            `[LinkedIn Scam Detector] No badge container found for jobId: ${jobId}`
          );
          sendResponse({ success: false, error: "Badge container not found" });
          return false;
        }

        if (final) {
          const { riskLevel, riskScore, flags, summary, source } = final;

          // Update badge with final result
          mountBadgeToContainer(badgeContainer, riskLevel, riskScore);

          // Store final result
          badgeContainer.setAttribute(
            "data-gemini-result",
            JSON.stringify({
              riskScore,
              riskLevel,
              flags,
              summary,
              source,
            })
          );

          console.log("[LinkedIn Scam Detector] Final result:", {
            jobId,
            riskLevel,
            riskScore,
            source,
          });
        }

        if (error) {
          console.error("[LinkedIn Scam Detector] Analysis error:", error);
        }

        sendResponse({ success: true });
        return true; // Indicates we will send response asynchronously
      }
      return false;
    };

    chrome.runtime.onMessage.addListener(handleMessage);

    return () => {
      chrome.runtime.onMessage.removeListener(handleMessage);
    };
  }, []);

  /**
   * Mount or update badge in a container
   * Creates React root if needed, or reuses existing root
   */
  const mountBadgeToContainer = (
    container: HTMLElement,
    riskLevel: RiskLevel,
    riskScore?: number
  ) => {
    // Update data attributes
    container.setAttribute("data-risk-level", riskLevel);
    if (riskScore !== undefined) {
      container.setAttribute("data-risk-score", String(riskScore));
    }

    // Get or create React root
    // Store root on container for reuse during updates
    interface ContainerWithRoot extends HTMLElement {
      __badgeRoot?: ReturnType<typeof createRoot>;
    }
    const containerWithRoot = container as ContainerWithRoot;
    let root = containerWithRoot.__badgeRoot;
    if (!root || typeof root.render !== "function") {
      root = createRoot(container);
      containerWithRoot.__badgeRoot = root;
    }

    // Get job ID for click handler
    const jobId = container.getAttribute("data-job-id") || "";

    const handleClick = () => {
      const event = new CustomEvent("scam-detector:open-report", {
        detail: {
          jobId,
          container,
        },
        bubbles: true,
      });
      container.dispatchEvent(event);
    };

    // Render badge component
    root.render(
      React.createElement(RiskBadge, {
        riskLevel,
        riskScore,
        onClick: handleClick,
      })
    );
  };

  /**
   * Process a single job element
   */
  const processJobElement = async (jobElement: HTMLElement) => {
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

      // Get job URL
      const jobUrl = jobData.url || window.location.href;

      // Inject badge container with loading state
      const badgeContainer = injectBadgeContainer(jobElement, jobId);
      if (!badgeContainer) {
        console.warn(
          "[LinkedIn Scam Detector] Failed to inject badge container"
        );
        return;
      }

      // Store badge container reference
      badgeContainersRef.current.set(jobId, badgeContainer);

      // Initialize badge container with loading state
      badgeContainer.setAttribute("data-job-id", jobId);
      badgeContainer.setAttribute("data-job-data", JSON.stringify(jobData));
      badgeContainer.setAttribute("data-scam-detector", "true");

      // Mount badge with loading state immediately
      mountBadgeToContainer(badgeContainer, "loading");

      // Send job data to background worker for analysis
      const requestBody: ScanJobRequestBody = {
        jobData,
        jobUrl,
        jobId,
      };

      // Send message to background (works in ISOLATED world)
      sendToBackground<ScanJobRequestBody, ScanJobResponseBody>({
        name: "scan-job",
        body: requestBody,
      })
        .then((response) => {
          if (!response) return;

          // Handle preliminary result (local rules)
          if (response.preliminary) {
            const { riskLevel, riskScore, flags } = response.preliminary;

            // Update badge with preliminary result
            mountBadgeToContainer(badgeContainer, riskLevel, riskScore);

            // Store preliminary result
            badgeContainer.setAttribute(
              "data-local-result",
              JSON.stringify({
                riskScore,
                riskLevel,
                flags,
              })
            );

            console.log("[LinkedIn Scam Detector] Preliminary result:", {
              jobId,
              riskLevel,
              riskScore,
            });
          }

          // Handle errors in preliminary phase
          if (response.error) {
            console.error(
              "[LinkedIn Scam Detector] Analysis error:",
              response.error
            );
            mountBadgeToContainer(badgeContainer, "caution", 50);
          }
        })
        .catch((error) => {
          console.error(
            "[LinkedIn Scam Detector] Failed to send scan request:",
            error
          );
          // Show error state
          mountBadgeToContainer(badgeContainer, "caution", 50);
        });
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
      badgeContainersRef.current.clear();
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

  // Render RiskReportManager to handle report modal
  return <RiskReportManager />;
}
