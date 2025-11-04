import { sendToBackground } from "@plasmohq/messaging";
import { useEffect, useRef, useState } from "react";

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
      setJobData(extractedData);
    }
  }, [providedJobData, container]);

  // Generate job ID and trigger scan
  useEffect(() => {
    if (!jobData || hasScannedRef.current) return;

    const jobId = generateJobId(jobData);
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
