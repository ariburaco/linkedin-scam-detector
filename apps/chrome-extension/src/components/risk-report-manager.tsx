import { useEffect, useState } from "react";

import { FeedbackModal } from "./feedback-modal";
import { RiskReport } from "./risk-report";
import type { RiskReportData } from "./risk-report";

import type { JobData } from "@/lib/linkedin-dom/types";
import type { LocalRulesResult } from "@/lib/local-rules/types";

/**
 * Manages the RiskReport modal state and listens for badge click events
 */
export function RiskReportManager() {
  const [isOpen, setIsOpen] = useState(false);
  const [reportData, setReportData] = useState<RiskReportData | null>(null);
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);

  useEffect(() => {
    const handleOpenReport = (event: CustomEvent) => {
      const { jobData, localResult, geminiResult } = event.detail as {
        jobId: string;
        jobData: JobData;
        localResult: LocalRulesResult;
        geminiResult?: {
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
      };

      if (!jobData || !localResult) {
        console.error("[Risk Report Manager] Missing required data");
        return;
      }

      setReportData({
        jobData,
        localResult,
        geminiResult,
      });
      setIsOpen(true);
    };

    // Listen for custom event from badge clicks
    window.addEventListener(
      "scam-detector:open-report",
      handleOpenReport as EventListener
    );

    return () => {
      window.removeEventListener(
        "scam-detector:open-report",
        handleOpenReport as EventListener
      );
    };
  }, []);

  const handleReportIssue = () => {
    // Close risk report and open feedback modal
    setIsOpen(false);
    setIsFeedbackOpen(true);
  };

  const handleFeedbackSubmitted = () => {
    // Feedback was submitted successfully
    // Modal will close automatically
  };

  if (!reportData) {
    return null;
  }

  const jobUrl = reportData.jobData.url || window.location.href;

  return (
    <>
      <RiskReport
        open={isOpen}
        onOpenChange={setIsOpen}
        data={reportData}
        onReportIssue={handleReportIssue}
      />
      <FeedbackModal
        open={isFeedbackOpen}
        onOpenChange={setIsFeedbackOpen}
        jobUrl={jobUrl}
        onSubmit={handleFeedbackSubmitted}
      />
    </>
  );
}
