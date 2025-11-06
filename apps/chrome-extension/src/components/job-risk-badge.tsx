import { sendToBackground } from "@plasmohq/messaging";
import { useCallback, useEffect, useRef, useState } from "react";

import type {
  ScanJobRequestBody,
  ScanJobResponseBody,
} from "@/background/messages/scan-job";
import { RiskBadge } from "@/components/risk-badge";
import type { RiskLevel } from "@/components/risk-badge";
import {
  extractJobDataFromCard,
  extractJobDataFromPage,
  generateJobId,
} from "@/lib/linkedin-dom";
import type { JobData } from "@/lib/linkedin-dom/types";
import type { LocalRulesResult } from "@/lib/local-rules/types";
import { debounce } from "@/utils/debounce";

interface JobRiskBadgeProps {
  /**
   * Optional: Pass job data directly if available
   * If not provided, will extract from DOM
   */
  jobData?: JobData;
  /**
   * Optional: Container element to extract job data from (for search results)
   */
  container?: HTMLElement;
}

/**
 * Self-contained badge component that handles job scanning
 * Can be mounted via Plasmo's getInlineAnchor
 */
export function JobRiskBadge({
  jobData: providedJobData,
  container,
}: JobRiskBadgeProps) {
  const [riskLevel, setRiskLevel] = useState<RiskLevel>("loading");
  const [riskScore, setRiskScore] = useState<number | undefined>(undefined);
  const [jobData, setJobData] = useState<JobData | null>(
    providedJobData || null
  );
  const [localResult, setLocalResult] = useState<LocalRulesResult | null>(null);
  const [geminiResult, setGeminiResult] = useState<{
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
  } | null>(null);
  const jobIdRef = useRef<string | null>(null);
  const hasScannedRef = useRef(false);
  const lastJobIdRef = useRef<string | null>(null);

  /**
   * Extract job data from DOM and reset state if job changed
   */
  const detectJobChange = useCallback(async () => {
    try {
      // Skip if provided job data (used for search results)
      if (providedJobData) {
        return;
      }

      // Extract from DOM
      // Priority: 1) container (for search result cards), 2) full page (for detail panels or single job pages)
      let extractedData: JobData | null = null;

      if (container) {
        // Try extracting from card container first (for search result cards)
        extractedData = extractJobDataFromCard(container);
      }

      // If no container or extraction failed, try full page extraction
      // This works for both single job pages and search detail panels
      if (!extractedData) {
        extractedData = await extractJobDataFromPage();
      }

      if (!extractedData || !extractedData.title) {
        return;
      }

      // Generate job ID
      const newJobId = generateJobId(extractedData);

      // Only reset if job ID changed
      if (newJobId !== lastJobIdRef.current) {
        // Debug logging removed to prevent excessive console output
        // MutationObserver triggers frequently on dynamic pages

        // Reset state - set loading FIRST to show spinner immediately
        setRiskLevel("loading");
        setRiskScore(undefined);
        setLocalResult(null);
        setGeminiResult(null);

        // Then reset refs and update job data
        lastJobIdRef.current = newJobId;
        jobIdRef.current = null;
        hasScannedRef.current = false;
        setJobData(extractedData);
      }
    } catch (error) {
      console.error("[JobRiskBadge] Error detecting job change:", error);
    }
  }, [providedJobData, container]);

  // Debounced version of detectJobChange
  // Note: debounce works with async functions, but we need to handle the promise
  const debouncedDetectJobChange = useCallback(
    debounce(() => {
      void detectJobChange();
    }, 300),
    [detectJobChange]
  );

  // Extract job data on mount if not provided
  useEffect(() => {
    let isMounted = true;

    const extractData = async () => {
      if (providedJobData) {
        // Ensure loading state when provided job data changes
        setRiskLevel("loading");
        setJobData(providedJobData);
        return;
      }

      // Extract from DOM
      // Priority: 1) container (for search result cards), 2) full page (for detail panels or single job pages)
      let extractedData: JobData | null = null;

      if (container) {
        // Try extracting from card container first (for search result cards)
        extractedData = extractJobDataFromCard(container);
      }

      // If no container or extraction failed, try full page extraction
      // This works for both single job pages and search detail panels
      if (!extractedData) {
        extractedData = await extractJobDataFromPage();
      }

      if (!isMounted) return;

      if (extractedData) {
        const initialJobId = generateJobId(extractedData);
        lastJobIdRef.current = initialJobId;
        // Ensure loading state when new job data is extracted
        setRiskLevel("loading");
        setJobData(extractedData);
      }
    };

    void extractData();

    return () => {
      isMounted = false;
    };
  }, [providedJobData, container]);

  // Generate job ID and trigger scan
  useEffect(() => {
    if (!jobData || hasScannedRef.current) return;

    // Ensure loading state is set before starting scan
    setRiskLevel("loading");
    setRiskScore(undefined); // Clear old score immediately

    const jobId = generateJobId(jobData);

    // Update lastJobIdRef if this is a new scan
    if (jobId !== lastJobIdRef.current) {
      lastJobIdRef.current = jobId;
    }

    jobIdRef.current = jobId;
    hasScannedRef.current = true;

    // Clean URL - remove query parameters
    let jobUrl = jobData.url || window.location.href;
    try {
      const urlObj = new URL(jobUrl);
      jobUrl = `${urlObj.origin}${urlObj.pathname}`;
      // Ensure trailing slash for job view URLs
      if (jobUrl.match(/\/jobs\/view\/\d+$/) && !jobUrl.endsWith('/')) {
        jobUrl += '/';
      }
    } catch (error) {
      // If URL parsing fails, use original
      jobUrl = jobData.url || window.location.href;
    }

    // Add 300ms artificial delay before starting scan
    const delayTimeout = setTimeout(() => {
      // Send scan request
      const requestBody: ScanJobRequestBody = {
        jobData,
        jobUrl,
        jobId,
      };

      sendToBackground<ScanJobRequestBody, ScanJobResponseBody>({
        name: "scan-job",
        body: requestBody,
      })
        .then((response) => {
          if (!response) return;

          // Handle preliminary result (local rules)
          if (response.preliminary) {
            const {
              riskLevel: level,
              riskScore: score,
              flags,
            } = response.preliminary;
            setRiskLevel(level);
            setRiskScore(score);
            setLocalResult({
              riskScore: score,
              riskLevel: level,
              flags: flags.map((f) => ({
                type: f.type,
                confidence: f.confidence,
                message: f.message,
              })),
            });
          }

          // Handle errors in preliminary phase
          if (response.error) {
            console.error("[JobRiskBadge] Analysis error:", response.error);
            setRiskLevel("caution");
            setRiskScore(50);
          }
        })
        .catch((error) => {
          console.error("[JobRiskBadge] Failed to send scan request:", error);
          setRiskLevel("caution");
          setRiskScore(50);
        });
    }, 300);

    // Cleanup timeout if component unmounts or job changes
    return () => {
      clearTimeout(delayTimeout);
    };
  }, [jobData]);

  // Listen for final result messages from background
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

        // Only process if this message is for our job
        if (jobId !== jobIdRef.current) {
          return false;
        }

        if (final) {
          const { riskLevel: level, riskScore: score } = final;
          setRiskLevel(level);
          setRiskScore(score);
          setGeminiResult(final);
        }

        if (error) {
          console.error("[JobRiskBadge] Analysis error:", error);
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

  // MutationObserver for SPA navigation detection
  useEffect(() => {
    // Skip if provided job data (used for search results)
    if (providedJobData) {
      return;
    }

    // Initial detection
    void detectJobChange();

    // Set up MutationObserver for LinkedIn's dynamic content
    let observer: MutationObserver;

    try {
      observer = new MutationObserver((mutations) => {
        const shouldUpdate = mutations.some(
          (mutation) =>
            (mutation.type === "childList" && mutation.addedNodes.length > 0) ||
            mutation.target.nodeName === "TITLE"
        );

        if (shouldUpdate) {
          debouncedDetectJobChange();
        }
      });

      // Observe title changes
      const titleElement = document.querySelector("title");
      if (titleElement) {
        observer.observe(titleElement, {
          childList: true,
          characterData: true,
        });
      }

      // Observe main content area changes
      // Include search detail panel containers
      const mainContentSelectors = [
        ".jobs-details__main-content",
        ".jobs-search__job-details--container",
        ".job-details-jobs-unified-top-card__container--two-pane",
        ".job-details-jobs-unified-top-card__job-title",
      ];

      let mainContentFound = false;
      for (const selector of mainContentSelectors) {
        const mainContent = document.querySelector(selector);
        if (mainContent) {
          observer.observe(mainContent, {
            childList: true,
            subtree: true,
            attributes: false,
            characterData: false,
          });
          mainContentFound = true;
          // Don't break - observe multiple containers for better coverage
        }
      }

      // Also observe the buttons container area where badge is mounted
      const buttonsContainer = document.querySelector(
        ".mt4 > div.display-flex"
      );
      if (buttonsContainer && buttonsContainer.parentElement) {
        observer.observe(buttonsContainer.parentElement, {
          childList: true,
          subtree: true,
        });
      }

      // Fallback: observe body if no specific content area found
      if (!mainContentFound) {
        observer.observe(document.body, {
          childList: true,
          subtree: true,
          attributes: false,
          characterData: false,
        });
      }

      // Listen for URL changes (LinkedIn updates URL when clicking different jobs)
      // This is important for search detail panels where currentJobId changes
      let lastUrl = window.location.href;
      const checkUrlChange = () => {
        const currentUrl = window.location.href;
        if (currentUrl !== lastUrl) {
          lastUrl = currentUrl;
          // Small delay to let DOM update after URL change
          setTimeout(() => {
            debouncedDetectJobChange();
          }, 100);
        }
      };

      // Override pushState and replaceState to detect URL changes
      const originalPushState = history.pushState;
      const originalReplaceState = history.replaceState;

      history.pushState = function (...args) {
        originalPushState.apply(history, args);
        checkUrlChange();
      };

      history.replaceState = function (...args) {
        originalReplaceState.apply(history, args);
        checkUrlChange();
      };

      // Listen for popstate (back/forward navigation)
      window.addEventListener("popstate", checkUrlChange);

      return () => {
        if (observer) {
          try {
            observer.disconnect();
          } catch (error) {
            console.error(
              "[JobRiskBadge] Error disconnecting observer:",
              error
            );
          }
        }
        // Restore original methods
        history.pushState = originalPushState;
        history.replaceState = originalReplaceState;
        window.removeEventListener("popstate", checkUrlChange);
      };
    } catch (error) {
      console.error("[JobRiskBadge] Error setting up observer:", error);
      return () => {};
    }
  }, [debouncedDetectJobChange, providedJobData]);

  // Handle badge click - open report modal
  const handleClick = () => {
    if (!jobData || !localResult) return;

    const event = new CustomEvent("scam-detector:open-report", {
      detail: {
        jobId: jobIdRef.current,
        jobData,
        localResult,
        geminiResult: geminiResult || undefined,
      },
      bubbles: true,
    });
    window.dispatchEvent(event);
  };

  // Don't render if no job data
  if (!jobData) {
    return null;
  }

  return (
    <RiskBadge
      riskLevel={riskLevel}
      riskScore={riskScore}
      onClick={handleClick}
    />
  );
}
