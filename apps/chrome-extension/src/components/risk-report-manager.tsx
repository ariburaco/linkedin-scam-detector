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
      const { jobId, container } = event.detail as {
        jobId: string;
        container: HTMLElement;
      };

      // Extract data from container attributes
      const jobDataAttr = container.getAttribute("data-job-data");
      const localResultAttr = container.getAttribute("data-local-result");
      const geminiResultAttr = container.getAttribute("data-gemini-result");

      if (!jobDataAttr || !localResultAttr) {
        console.error("[Risk Report Manager] Missing required data attributes");
        return;
      }

      try {
        const jobData = JSON.parse(jobDataAttr) as JobData;
        const localResult = JSON.parse(localResultAttr) as LocalRulesResult;
        const geminiResult = geminiResultAttr
          ? (JSON.parse(geminiResultAttr) as RiskReportData["geminiResult"])
          : undefined;

        setReportData({
          jobData,
          localResult,
          geminiResult,
        });
        setIsOpen(true);
      } catch (error) {
        console.error(
          "[Risk Report Manager] Error parsing report data:",
          error
        );
      }
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
