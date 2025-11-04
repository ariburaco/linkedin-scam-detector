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
 * Find the anchor element for badge injection
 * Works for both search detail panels and single job posting pages
 * Badge is ONLY mounted next to Apply/Save buttons - never next to title
 */
export const getInlineAnchor: PlasmoGetInlineAnchor = async () => {
  const findButtonsContainer = () => {
    // More specific selector: look for the mt4 container that holds the buttons
    // This is the container that directly contains Apply and Save buttons
    const containers = document.querySelectorAll(".mt4 > div.display-flex");

    for (const container of containers) {
      const hasApply = container.querySelector(".jobs-s-apply");
      const hasSave = container.querySelector(".jobs-save-button");
      // Only return if BOTH buttons are direct children or descendants
      if (hasApply && hasSave) {
        return container as HTMLElement;
      }
    }

    // Fallback: search more broadly but still verify buttons exist
    const selectors = [
      ".job-details-jobs-unified-top-card__container--two-pane .mt4 > div.display-flex",
      ".jobs-details__main-content .mt4 > div.display-flex",
      ".jobs-search__job-details--container .mt4 > div.display-flex",
    ];

    for (const selector of selectors) {
      const container = document.querySelector(selector) as HTMLElement | null;
      if (
        container &&
        container.querySelector(".jobs-s-apply") &&
        container.querySelector(".jobs-save-button")
      ) {
        return container;
      }
    }

    return null;
  };

  let anchor = findButtonsContainer();
  let insertPosition: "beforeend" | "afterend" = "beforeend";

  // Poll for buttons container if not found (for dynamically loaded content)
  // Only mount badge next to Apply/Save buttons - no fallback to title
  if (!anchor) {
    for (let i = 0; i < 10; i++) {
      await new Promise((resolve) => setTimeout(resolve, 500));
      anchor = findButtonsContainer();
      if (anchor) {
        insertPosition = "beforeend";
        break;
      }
    }
  }

  // Only return anchor if buttons container found
  // If not found, return a hidden element to prevent badge from appearing
  // This ensures badge only appears next to Apply/Save buttons, never next to title
  if (!anchor) {
    // Create a hidden div that won't be visible
    const hiddenDiv = document.createElement("div");
    hiddenDiv.style.display = "none";
    hiddenDiv.style.position = "absolute";
    hiddenDiv.style.visibility = "hidden";
    document.body.appendChild(hiddenDiv);
    return {
      element: hiddenDiv,
      insertPosition: "beforeend",
    };
  }

  return {
    element: anchor,
    insertPosition,
  };
};

/**
 * Content script for all LinkedIn job pages
 * Handles both search detail panels and single job posting pages
 * Uses Plasmo's getInlineAnchor to automatically mount the badge next to Apply/Save buttons
 */
export default function LinkedInJobBadge() {
  return (
    <>
      <JobRiskBadge />
      <RiskReportManager />
    </>
  );
}
