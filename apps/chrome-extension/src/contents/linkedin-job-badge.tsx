import cssText from "data-text:~style.css";
import type { PlasmoCSConfig, PlasmoGetInlineAnchor } from "plasmo";
import { useEffect } from "react";

import { JobRiskBadge } from "@/components/job-risk-badge";
import { RiskReportManager } from "@/components/risk-report-manager";
import { waitForElement } from "@/lib/linkedin-dom/wait-for-element";
import { extensionLoggerContent } from "@/shared/loggers";

export const config: PlasmoCSConfig = {
  matches: ["https://www.linkedin.com/jobs/*"],
  run_at: "document_end",
};

// Cache the anchor element to ensure Plasmo gets a stable reference
let cachedAnchor: HTMLElement | null = null;
let anchorCacheTime = 0;
const ANCHOR_CACHE_DURATION = 5000; // 5 seconds

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
 * - For job detail pages (/jobs/view/): Mounts badge in the title container div
 * - For other pages (search results, etc.): Mounts badge next to Apply/Save buttons
 */
export const getInlineAnchor: PlasmoGetInlineAnchor = async () => {
  // Check if we're on a job detail page (/jobs/view)
  const isJobDetailPage = window.location.pathname.includes("/jobs/view/");

  if (isJobDetailPage) {
    // For job detail pages, mount badge in the title container div
    // display-flex justify-space-between flex-wrap mt2
    const titleContainer = document.querySelector(
      "div.display-flex.justify-space-between.flex-wrap.mt2"
    );
    return {
      element: titleContainer as HTMLElement,
      insertPosition: "beforeend",
    };
  }
  // For other pages (search results, etc.), mount next to buttons (fall through to button logic)

  // Check cache first - Plasmo needs a stable anchor reference
  const now = Date.now();
  if (
    cachedAnchor &&
    cachedAnchor.isConnected &&
    now - anchorCacheTime < ANCHOR_CACHE_DURATION
  ) {
    extensionLoggerContent.info("[LinkedIn Job Badge] Using cached anchor");
    return {
      element: cachedAnchor,
      insertPosition: "beforeend",
    };
  }

  const findButtonsContainer = () => {
    // Strategy 1: Look for container that has both Apply and Save buttons
    // Try multiple approaches to find the buttons container

    // First, try finding by the buttons themselves and work backwards
    // Try multiple selectors for Apply button (priority: specific > general)
    const applyButtonSelectors = [
      "#jobs-apply-button-id", // Specific ID from DOM (most reliable)
      ".jobs-apply-button", // The actual button element
      'button[aria-label*="Easy Apply"]', // Specific aria-label
      'button[aria-label*="Apply"]', // Generic Apply button
      ".jobs-s-apply", // The wrapper div
      "button[data-control-name='job_apply']",
      "a[data-control-name='job_apply']",
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
      // This matches the exact structure: div.display-flex > (jobs-s-apply, span, button.jobs-save-button)
      if (
        applyParent === saveParent &&
        applyParent?.classList.contains("display-flex")
      ) {
        return applyParent as HTMLElement;
      }

      // Also check if save button's parent is display-flex and contains apply button
      // Handle case where save button is direct child but apply is nested
      if (
        saveParent?.classList.contains("display-flex") &&
        saveParent.contains(applyButton)
      ) {
        return saveParent as HTMLElement;
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

  // Always use waitForElement to ensure buttons are loaded (not skeleton)
  // This handles the case where buttons load dynamically after page load
  let anchor: HTMLElement | null = null;
  // Try "beforeend" first - Plasmo might not fully support "afterend" for inline anchors
  // We'll insert inside the flex container but use inline-flex to prevent layout issues
  let insertPosition: "beforeend" | "afterend" = "beforeend";

  // Try immediate lookup first (for faster mounting if already loaded)
  anchor = findButtonsContainer();

  // Wait for buttons container if not found (for dynamically loaded content)
  // Use waitForElement utility to handle skeleton/loader detection
  if (!anchor) {
    // Try waiting for the display-flex container that contains both buttons
    // Note: :has() selector may not be supported in all browsers, so we use validator instead
    anchor = await waitForElement(
      [".mt4 > div.display-flex", "div.display-flex", ".mt4"],
      document,
      {
        maxRetries: 20,
        initialDelay: 300,
        retryDelay: 500,
        validator: (el) => {
          // Skip if it's a skeleton/loader
          if (
            el.classList.contains("scaffold-skeleton-container") ||
            el.querySelector(".artdeco-loader") !== null
          ) {
            return false;
          }

          // Check if this container has both Apply and Save buttons
          const hasApply =
            el.querySelector(".jobs-s-apply") !== null ||
            el.querySelector(".jobs-apply-button") !== null ||
            el.querySelector('button[aria-label*="Apply"]') !== null ||
            el.querySelector('a[aria-label*="Apply"]') !== null ||
            el.querySelector('button[aria-label*="Easy Apply"]') !== null;
          const hasSave =
            el.querySelector(".jobs-save-button") !== null ||
            el.querySelector('button[aria-label*="Save"]') !== null;

          // Must have both buttons
          if (!hasApply || !hasSave) {
            return false;
          }

          // Prefer display-flex containers (they're the direct parent of buttons)
          if (el.classList.contains("display-flex")) {
            return true;
          }

          // If it's an mt4 container, check if it has a display-flex child with buttons
          const flexChild = el.querySelector("div.display-flex");
          if (flexChild) {
            const flexHasApply =
              flexChild.querySelector(".jobs-s-apply") !== null ||
              flexChild.querySelector(".jobs-apply-button") !== null ||
              flexChild.querySelector('button[aria-label*="Apply"]') !== null ||
              flexChild.querySelector('a[aria-label*="Apply"]') !== null;
            const flexHasSave =
              flexChild.querySelector(".jobs-save-button") !== null ||
              flexChild.querySelector('button[aria-label*="Save"]') !== null;
            return flexHasApply && flexHasSave;
          }

          return true;
        },
      }
    );

    // If we found an mt4 container, try to get the display-flex child
    if (
      anchor &&
      anchor.classList.contains("mt4") &&
      !anchor.classList.contains("display-flex")
    ) {
      const flexChild = anchor.querySelector("div.display-flex");
      if (
        flexChild &&
        (flexChild.querySelector(".jobs-s-apply") ||
          flexChild.querySelector(".jobs-apply-button")) &&
        flexChild.querySelector(".jobs-save-button")
      ) {
        anchor = flexChild as HTMLElement;
      }
    }

    // Fallback: Try the original polling method
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
  }

  // Debug logging - always log to help diagnose mounting issues
  if (anchor) {
    extensionLoggerContent.info("[LinkedIn Job Badge] Found anchor:", {
      tagName: anchor.tagName,
      className: anchor.className,
      hasApply: !!anchor.querySelector(".jobs-s-apply, .jobs-apply-button"),
      hasSave: !!anchor.querySelector(".jobs-save-button"),
      insertPosition,
      parentElement: anchor.parentElement?.tagName,
      nextSibling: anchor.nextSibling?.nodeName,
      isConnected: anchor.isConnected,
    });
    extensionLoggerContent.info(
      "[LinkedIn Job Badge] About to return anchor for Plasmo mounting"
    );
  } else {
    extensionLoggerContent.info(
      "[LinkedIn Job Badge] Anchor not found after waiting"
    );
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

  // Cache the anchor for stable reference
  if (anchor) {
    cachedAnchor = anchor;
    anchorCacheTime = Date.now();
    extensionLoggerContent.info(
      "[LinkedIn Job Badge] Cached anchor for stable reference"
    );
  }

  const result = {
    element: anchor,
    insertPosition,
  };

  extensionLoggerContent.info(
    "[LinkedIn Job Badge] Returning anchor result to Plasmo:",
    {
      element: anchor?.tagName,
      className: anchor?.className,
      insertPosition: result.insertPosition,
      isCached: anchor === cachedAnchor,
    }
  );

  return result;
};

/**
 * Content script for all LinkedIn job pages
 * Handles both search detail panels and single job posting pages
 * Uses Plasmo's getInlineAnchor to automatically mount the badge next to Apply/Save buttons
 */
export default function LinkedInJobBadge() {
  // Debug logging to verify component is mounting
  extensionLoggerContent.info(
    "[LinkedIn Job Badge] Component rendering/mounting"
  );

  // Use useEffect to verify component actually mounted
  useEffect(() => {
    extensionLoggerContent.info(
      "[LinkedIn Job Badge] Component MOUNTED successfully!"
    );
    extensionLoggerContent.info(
      "[LinkedIn Job Badge] Component is in DOM:",
      document.body.contains(document.querySelector('[class*="ml-2"]'))
    );

    return () => {
      extensionLoggerContent.info("[LinkedIn Job Badge] Component UNMOUNTING");
    };
  }, []);

  return (
    <>
      {/* Badge rendered inline with buttons - match height and align */}
      <div className="ml-2 inline-flex h-10 items-center">
        <JobRiskBadge />
      </div>
      {/* RiskReportManager for dialogs - rendered separately */}
      <RiskReportManager />
    </>
  );
}
