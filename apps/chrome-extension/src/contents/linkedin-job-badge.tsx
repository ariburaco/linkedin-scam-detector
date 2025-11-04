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
    // Strategy 1: Look for container that has both Apply and Save buttons
    // Try multiple approaches to find the buttons container

    // First, try finding by the buttons themselves and work backwards
    const applyButton = document.querySelector(".jobs-s-apply");
    const saveButton = document.querySelector(".jobs-save-button");

    if (applyButton && saveButton) {
      // Find common ancestor that contains both buttons
      let applyParent = applyButton.parentElement;

      // Look for common parent that has display-flex class
      while (applyParent) {
        if (applyParent.classList.contains("display-flex")) {
          // Check if this container also has the save button
          if (applyParent.contains(saveButton)) {
            return applyParent as HTMLElement;
          }
        }
        applyParent = applyParent.parentElement;
      }

      // If not found, try finding the mt4 container that contains both
      const mt4Containers = document.querySelectorAll(".mt4");
      for (const mt4 of mt4Containers) {
        if (mt4.contains(applyButton) && mt4.contains(saveButton)) {
          const flexContainer = mt4.querySelector("div.display-flex");
          if (
            flexContainer &&
            flexContainer.contains(applyButton) &&
            flexContainer.contains(saveButton)
          ) {
            return flexContainer as HTMLElement;
          }
        }
      }
    }

    // Strategy 2: Look for the mt4 container that holds the buttons
    const containers = document.querySelectorAll(".mt4 > div.display-flex");

    for (const container of containers) {
      const hasApply = container.querySelector(".jobs-s-apply");
      const hasSave = container.querySelector(".jobs-save-button");
      // Only return if BOTH buttons are direct children or descendants
      if (hasApply && hasSave) {
        return container as HTMLElement;
      }
    }

    // Strategy 3: Search more broadly but still verify buttons exist
    const selectors = [
      ".job-details-jobs-unified-top-card__container--two-pane .mt4 > div.display-flex",
      ".jobs-details__main-content .mt4 > div.display-flex",
      ".jobs-search__job-details--container .mt4 > div.display-flex",
      ".jobs-details__main-content .mt4",
      ".jobs-search__job-details--container .mt4",
    ];

    for (const selector of selectors) {
      const container = document.querySelector(selector) as HTMLElement | null;
      if (
        container &&
        container.querySelector(".jobs-s-apply") &&
        container.querySelector(".jobs-save-button")
      ) {
        // If we found mt4, try to find the display-flex child
        const flexChild = container.querySelector("div.display-flex");
        if (
          flexChild &&
          flexChild.querySelector(".jobs-s-apply") &&
          flexChild.querySelector(".jobs-save-button")
        ) {
          return flexChild as HTMLElement;
        }
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

  // Debug logging (only in development)
  if (process.env.NODE_ENV === "development") {
    if (anchor) {
      console.log("[LinkedIn Job Badge] Found buttons container:", anchor);
      console.log("[LinkedIn Job Badge] Container classes:", anchor.className);
      console.log("[LinkedIn Job Badge] Insert position:", insertPosition);
    } else {
      console.warn(
        "[LinkedIn Job Badge] Buttons container not found - badge will be hidden"
      );
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
      {/* Badge rendered inline with buttons - match height and align */}
      <div className="ml-2 flex h-10 items-center">
        <JobRiskBadge />
      </div>
      {/* RiskReportManager for dialogs - rendered separately */}
      <RiskReportManager />
    </>
  );
}
