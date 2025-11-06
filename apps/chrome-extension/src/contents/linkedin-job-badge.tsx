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
    // Try multiple selectors for Apply button
    const applyButtonSelectors = [
      ".jobs-s-apply",
      "button[data-control-name='job_apply']",
      "a[data-control-name='job_apply']",
      'button[aria-label*="Apply"]',
      'a[aria-label*="Apply"]',
    ];
    const saveButtonSelectors = [
      ".jobs-save-button",
      "button[data-control-name='save_job']",
      "button[aria-label*='Save']",
    ];

    let applyButton: Element | null = null;
    let saveButton: Element | null = null;

    for (const selector of applyButtonSelectors) {
      applyButton = document.querySelector(selector);
      if (applyButton) break;
    }

    for (const selector of saveButtonSelectors) {
      saveButton = document.querySelector(selector);
      if (saveButton) break;
    }

    if (applyButton && saveButton) {
      // Find common ancestor that contains both buttons
      // First check if they're already in the same display-flex container
      let applyParent = applyButton.parentElement;
      let saveParent = saveButton.parentElement;

      // Check if they share the same direct parent
      if (
        applyParent === saveParent &&
        applyParent?.classList.contains("display-flex")
      ) {
        return applyParent as HTMLElement;
      }

      // Look for common parent that has display-flex class
      // Note: .jobs-s-apply might be a wrapper div, so traverse up
      while (applyParent) {
        if (applyParent.classList.contains("display-flex")) {
          // Check if this container also has the save button (or its wrapper)
          if (applyParent.contains(saveButton)) {
            return applyParent as HTMLElement;
          }
          // Also check if it contains .jobs-save-button anywhere
          if (applyParent.querySelector(".jobs-save-button")) {
            return applyParent as HTMLElement;
          }
        }
        applyParent = applyParent.parentElement;
      }

      // Also try from save button's perspective
      while (saveParent) {
        if (saveParent.classList.contains("display-flex")) {
          if (saveParent.contains(applyButton)) {
            return saveParent as HTMLElement;
          }
          // Also check if it contains .jobs-s-apply or .jobs-apply-button anywhere
          if (
            saveParent.querySelector(".jobs-s-apply") ||
            saveParent.querySelector(".jobs-apply-button")
          ) {
            return saveParent as HTMLElement;
          }
        }
        saveParent = saveParent.parentElement;
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

    // Strategy 2: Look for display-flex containers (with or without mt4 parent)
    // Try both mt4 > div.display-flex and direct div.display-flex
    const containerSelectors = [
      ".mt4 > div.display-flex",
      "div.display-flex", // Direct display-flex containers
    ];

    for (const containerSelector of containerSelectors) {
      const containers = document.querySelectorAll(containerSelector);

      for (const container of containers) {
        // Try multiple selectors for buttons
        const hasApply =
          container.querySelector(".jobs-s-apply") ||
          container.querySelector(".jobs-apply-button") ||
          container.querySelector("button[data-control-name='job_apply']") ||
          container.querySelector("a[data-control-name='job_apply']") ||
          container.querySelector('button[aria-label*="Apply"]');
        const hasSave =
          container.querySelector(".jobs-save-button") ||
          container.querySelector("button[data-control-name='save_job']") ||
          container.querySelector('button[aria-label*="Save"]');
        // Only return if BOTH buttons are direct children or descendants
        if (hasApply && hasSave) {
          return container as HTMLElement;
        }
      }
    }

    // Strategy 3: Search more broadly but still verify buttons exist
    const selectors = [
      ".job-details-jobs-unified-top-card__container--two-pane .mt4 > div.display-flex",
      ".job-details-jobs-unified-top-card__container--single-pane .mt4 > div.display-flex",
      ".jobs-details__main-content .mt4 > div.display-flex",
      ".jobs-details__main-content--single-pane .mt4 > div.display-flex",
      ".jobs-search__job-details--container .mt4 > div.display-flex",
      ".jobs-details__main-content .mt4",
      ".jobs-details__main-content--single-pane .mt4",
      ".jobs-search__job-details--container .mt4",
      ".job-details-jobs-unified-top-card__container--two-pane .mt4",
      ".job-details-jobs-unified-top-card__container--single-pane .mt4",
      ".jobs-unified-top-card__container .mt4 > div.display-flex",
      ".jobs-unified-top-card__container .mt4",
      "div.mt4 > div.display-flex:has(.jobs-s-apply)",
      "div.mt4:has(.jobs-s-apply):has(.jobs-save-button)",
    ];

    for (const selector of selectors) {
      const container = document.querySelector(selector) as HTMLElement | null;
      if (!container) continue;

      // Try multiple selectors for buttons
      const hasApply =
        container.querySelector(".jobs-s-apply") ||
        container.querySelector(".jobs-apply-button") ||
        container.querySelector("button[data-control-name='job_apply']") ||
        container.querySelector("a[data-control-name='job_apply']") ||
        container.querySelector('button[aria-label*="Apply"]');
      const hasSave =
        container.querySelector(".jobs-save-button") ||
        container.querySelector("button[data-control-name='save_job']") ||
        container.querySelector('button[aria-label*="Save"]');

      if (hasApply && hasSave) {
        // If we found mt4, try to find the display-flex child
        const flexChild = container.querySelector("div.display-flex");
        if (flexChild) {
          const flexHasApply =
            flexChild.querySelector(".jobs-s-apply") ||
            flexChild.querySelector(".jobs-apply-button") ||
            flexChild.querySelector("button[data-control-name='job_apply']") ||
            flexChild.querySelector("a[data-control-name='job_apply']") ||
            flexChild.querySelector('button[aria-label*="Apply"]');
          const flexHasSave =
            flexChild.querySelector(".jobs-save-button") ||
            flexChild.querySelector("button[data-control-name='save_job']") ||
            flexChild.querySelector('button[aria-label*="Save"]');
          if (flexHasApply && flexHasSave) {
            return flexChild as HTMLElement;
          }
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

  // Debug logging removed to prevent excessive console output
  // The function is called multiple times by Plasmo on dynamic pages

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
