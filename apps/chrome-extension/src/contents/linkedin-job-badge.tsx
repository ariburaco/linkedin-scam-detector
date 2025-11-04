import cssText from "data-text:~style.css";
import type { PlasmoCSConfig, PlasmoGetInlineAnchor } from "plasmo";

import { JobRiskBadge } from "@/components/job-risk-badge";
import { RiskReportManager } from "@/components/risk-report-manager";

export const config: PlasmoCSConfig = {
  matches: ["https://www.linkedin.com/jobs/*"],
  run_at: "document_end",
};

// Define CSS for Shadow DOM
export const getStyle = (): HTMLStyleElement => {
  const baseFontSize = 16;

  let updatedCssText = cssText.replaceAll(":root", ":host(plasmo-csui)");
  const remRegex = /([\d.]+)rem/g;
  updatedCssText = updatedCssText.replace(remRegex, (match, remValue) => {
    const pixelsValue = parseFloat(remValue) * baseFontSize;

    return `${pixelsValue}px`;
  });

  const styleElement = document.createElement("style");

  styleElement.textContent = updatedCssText;

  return styleElement;
};

/**
 * Find the anchor element for badge injection on single job posting pages
 * Supports both direct job view pages and collections pages
 */
export const getInlineAnchor: PlasmoGetInlineAnchor = async () => {
  const findJobTitle = () => {
    // Try multiple selectors for job title area
    const selectors = [
      ".job-details-jobs-unified-top-card__job-title",
      ".job-details-jobs-unified-top-card__container--two-pane",
      ".jobs-details__main-content .job-details-jobs-unified-top-card__job-title",
    ];

    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element) {
        return element as HTMLElement;
      }
    }

    return null;
  };

  let anchor = findJobTitle();

  // Poll for element if not found (for dynamically loaded content)
  if (!anchor) {
    for (let i = 0; i < 10; i++) {
      await new Promise((resolve) => setTimeout(resolve, 500));
      anchor = findJobTitle();
      if (anchor) break;
    }
  }

  // Return anchor with insert position - element must be non-null
  // Fallback to document.body if anchor not found
  return {
    element: anchor || document.body,
    insertPosition: "afterend" as const,
  };
};

/**
 * Content script for single job posting pages
 * Uses Plasmo's getInlineAnchor to automatically mount the badge
 */
export default function LinkedInJobBadge() {
  return (
    <>
      <JobRiskBadge />
      <RiskReportManager />
    </>
  );
}
