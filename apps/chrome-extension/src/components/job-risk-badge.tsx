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
  isJobPostingPage,
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
  const detectJobChange = useCallback(() => {
    try {
      // Skip if provided job data (used for search results)
      if (providedJobData) {
        return;
      }

      // Extract from DOM
      const extractedData = isJobPostingPage()
        ? extractJobDataFromPage()
        : container
          ? extractJobDataFromCard(container)
          : null;

      if (!extractedData || !extractedData.title) {
        return;
      }

      // Generate job ID
      const newJobId = generateJobId(extractedData);

      // Only reset if job ID changed
      if (newJobId !== lastJobIdRef.current) {
        console.log(
          "[JobRiskBadge] Job changed detected:",
          lastJobIdRef.current,
          "->",
          newJobId
        );

        // Reset state
        lastJobIdRef.current = newJobId;
        jobIdRef.current = null;
        hasScannedRef.current = false;
        setRiskLevel("loading");
        setRiskScore(undefined);
        setLocalResult(null);
        setGeminiResult(null);
        setJobData(extractedData);
      }
    } catch (error) {
      console.error("[JobRiskBadge] Error detecting job change:", error);
    }
  }, [providedJobData, container]);

  // Debounced version of detectJobChange
  const debouncedDetectJobChange = useCallback(debounce(detectJobChange, 300), [
    detectJobChange,
  ]);

  // Extract job data on mount if not provided
  useEffect(() => {
    if (providedJobData) {
      setJobData(providedJobData);
      return;
    }

    // Extract from DOM
    const extractedData = isJobPostingPage()
      ? extractJobDataFromPage()
      : container
        ? extractJobDataFromCard(container)
        : null;

    if (extractedData) {
      const initialJobId = generateJobId(extractedData);
      lastJobIdRef.current = initialJobId;
      setJobData(extractedData);
    }
  }, [providedJobData, container]);

  // Generate job ID and trigger scan
  useEffect(() => {
    if (!jobData || hasScannedRef.current) return;

    const jobId = generateJobId(jobData);

    // Update lastJobIdRef if this is a new scan
    if (jobId !== lastJobIdRef.current) {
      lastJobIdRef.current = jobId;
    }

    jobIdRef.current = jobId;
    hasScannedRef.current = true;

    const jobUrl = jobData.url || window.location.href;

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
    detectJobChange();

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
      const mainContentSelectors = [
        ".jobs-details__main-content",
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
          break; // Only observe the first found element
        }
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
    } catch (error) {
      console.error("[JobRiskBadge] Error setting up observer:", error);
    }

    return () => {
      if (observer) {
        try {
          observer.disconnect();
        } catch (error) {
          console.error("[JobRiskBadge] Error disconnecting observer:", error);
        }
      }
    };
  }, [detectJobChange, debouncedDetectJobChange, providedJobData]);

  // URL change detection for SPA navigation
  useEffect(() => {
    // Skip if provided job data (used for search results)
    if (providedJobData) {
      return;
    }

    // Track URL changes (including query parameters like currentJobId)
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
        console.log("[JobRiskBadge] URL change detected:", {
          lastUrl,
          currentUrl,
          lastPathname,
          currentPathname,
          lastSearch,
          currentSearch,
        });

        lastUrl = currentUrl;
        lastPathname = currentPathname;
        lastSearch = currentSearch;

        // Trigger job change detection
        debouncedDetectJobChange();
      }
    }, 500); // Check more frequently for better SPA navigation detection

    return () => {
      clearInterval(urlCheckInterval);
    };
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
