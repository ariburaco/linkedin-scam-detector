import { useEffect, useRef } from "react";
import { createRoot, type Root } from "react-dom/client";

import { RiskBadge } from "./risk-badge";
import type { RiskLevel } from "./risk-badge";

/**
 * Mounts RiskBadge components into badge containers created by linkedin-scanner
 * This component finds all badge containers and mounts React components into them
 */
export function mountBadges() {
  const badgeContainers = document.querySelectorAll(
    '[data-scam-detector="true"]'
  );
  const roots = new Map<HTMLElement, Root>();

  badgeContainers.forEach((container) => {
    const htmlContainer = container as HTMLElement;

    // Skip if already mounted
    if (htmlContainer.hasAttribute("data-badge-mounted")) {
      return;
    }

    // Get data from attributes
    const riskLevel = (htmlContainer.getAttribute("data-risk-level") ||
      "loading") as RiskLevel;
    const riskScoreAttr = htmlContainer.getAttribute("data-risk-score");
    const riskScore = riskScoreAttr ? parseInt(riskScoreAttr, 10) : undefined;
    const jobId = htmlContainer.getAttribute("data-job-id") || "";

    // Create root and mount component
    const root = createRoot(htmlContainer);
    roots.set(htmlContainer, root);

    const handleClick = () => {
      // Dispatch custom event to open report modal
      // This will be handled by the RiskReport component (Task 6)
      const event = new CustomEvent("scam-detector:open-report", {
        detail: {
          jobId,
          container: htmlContainer,
        },
        bubbles: true,
      });
      container.dispatchEvent(event);
    };

    root.render(
      <RiskBadge
        riskLevel={riskLevel}
        riskScore={riskScore}
        onClick={handleClick}
      />
    );

    // Mark as mounted
    htmlContainer.setAttribute("data-badge-mounted", "true");
  });

  // Cleanup function
  return () => {
    roots.forEach((root, container) => {
      root.unmount();
      container.removeAttribute("data-badge-mounted");
    });
    roots.clear();
  };
}

/**
 * React component that watches for badge containers and mounts badges
 */
export function BadgeMount() {
  const cleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    // Initial mount
    const cleanup = mountBadges();
    cleanupRef.current = cleanup;

    // Watch for new badge containers
    const observer = new MutationObserver(() => {
      if (cleanupRef.current) {
        cleanupRef.current();
      }
      const newCleanup = mountBadges();
      cleanupRef.current = newCleanup;
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    return () => {
      observer.disconnect();
      if (cleanupRef.current) {
        cleanupRef.current();
      }
    };
  }, []);

  return null;
}
